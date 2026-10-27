/* -------------------------------------------------------------------------- */
/*  MLB Operational Live Read-Only Preflight (P5F-C7B-S1)                      */
/* -------------------------------------------------------------------------- */
/*  Scientific-blindness lock:                                                */
/*    S1_SCIENTIFIC_ROLE              = NONE                                  */
/*    SCIENTIFIC_USE                  = NONE                                  */
/*    IS_PROSPECTIVE_HOLDOUT_EVIDENCE = false                                 */
/*    PUBLIC_OPERATIONAL_API_ALLOWED  = false                                 */
/*                                                                            */
/*  Read-only input readiness preflight — NO model execution, NO prediction     */
/*  persistence, NO live network calls during automated tests.                 */
/*                                                                            */
/*  Flow per game:                                                             */
/*    A. Require UPCOMING schedule status                                     */
/*    B. Require pregame research event status                                */
/*    C. Require current time strictly before scheduledStartAt                 */
/*    D. Require source data timestamps not implying future observations       */
/*    E. Preserve officialDate and gamePk                                    */
/*    F. Call buildMLBRealDataPregameSnapshot (existing)                       */
/*    G. Validate its canonical snapshot                                      */
/*    H. Call extractMLBLeakageSafeFeatureVector using frozen manifest         */
/*    I. Verify extracted vector compatible with all 14 features               */
/*    J. Return structured readiness result                                   */
/* -------------------------------------------------------------------------- */

import type {
  DataProvenance,
  MLBGameResearchSnapshot,
  MLBScheduleGame,
  MLBScheduleResult,
} from '@/lib/research-data/types';
import type { MLBCanonicalPregameSnapshot } from '@/prediction/mlb/mlb-pregame-snapshot-contract';
import type { MLBFeatureVector } from '@/prediction/mlb/mlb-feature-vector-contract';

import { buildMLBRealDataPregameSnapshot } from '@/prediction/mlb/mlb-real-data-pregame-snapshot-bridge';
import { MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1 } from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';
import { extractMLBLeakageSafeFeatureVector } from '@/prediction/mlb/mlb-feature-vector-contract';

import { pathToFileURL } from 'node:url';

/* -------------------------------------------------------------------------- */
/*  Injected dependencies — never auto-instantiate a live provider.            */
/* -------------------------------------------------------------------------- */

export interface MLBOperationalLivePreflightDependencies {
  fetchSchedule: (date: string) => Promise<MLBScheduleResult>;
  buildGameSnapshot: (
    game: MLBScheduleGame,
    options: { season: number; includeWeather: boolean },
  ) => Promise<MLBGameResearchSnapshot>;
  now: () => Date;
}

/* -------------------------------------------------------------------------- */
/*  Timing information per game                                                */
/* -------------------------------------------------------------------------- */

export type MLBOperationalLivePreflightTimingInfo = Readonly<{
  currentTimeIso: string;
  scheduledStartAtIso: string;
  dataCutoffAtIso: string | null;
  isCurrentBeforeStart: boolean;
  isCutoffBeforeStart: boolean | null;
}>;

/* -------------------------------------------------------------------------- */
/*  Per-game result — discriminated union on eligibility                       */
/* -------------------------------------------------------------------------- */

export type MLBOperationalLivePreflightGameResult =
  | Readonly<{
      gamePk: number;
      officialDate: string;
      scheduledStartAtIso: string;
      eligibility: 'READY';
      timing: MLBOperationalLivePreflightTimingInfo;
      provenance: readonly DataProvenance[];
      canonicalSnapshot: MLBCanonicalPregameSnapshot;
      featureVector: MLBFeatureVector;
    }>
  | Readonly<{
      gamePk: number;
      officialDate: string;
      scheduledStartAtIso: string;
      eligibility: 'NOT_READY';
      timing: MLBOperationalLivePreflightTimingInfo;
      provenance: readonly DataProvenance[] | null;
      rejectionReasons: readonly string[];
    }>;

/* -------------------------------------------------------------------------- */
/*  Aggregate preflight result                                                 */
/* -------------------------------------------------------------------------- */

export type MLBOperationalLivePreflightResult = Readonly<{
  date: string;
  games: readonly MLBOperationalLivePreflightGameResult[];
  readyCount: number;
  notReadyCount: number;
  totalGameCount: number;
}>;

/* -------------------------------------------------------------------------- */
/*  Expected frozen feature count from MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1 */
/* -------------------------------------------------------------------------- */

const EXPECTED_FEATURE_COUNT = 14;

/* Reject source timestamps that have not occurred at preflight time.
 * This is stricter than the canonical bridge's pre-start cutoff check.
 * The bridge itself is frozen and must not be modified here. */
function validateObservationTime(
  observedAt: Date | undefined,
  field: string,
  nowMs: number,
  scheduledStartMs: number,
  reasons: string[],
): number | null {
  if (!(observedAt instanceof Date) || !Number.isFinite(observedAt.getTime())) {
    reasons.push(`${field} is missing or invalid`);
    return null;
  }
  const ms = observedAt.getTime();
  if (ms > nowMs) reasons.push(`${field} is later than current preflight time`);
  if (ms >= scheduledStartMs) reasons.push(`${field} is not before scheduled start`);
  return ms;
}

function validateProvenance(
  item: DataProvenance,
  field: string,
  nowMs: number,
  scheduledStartMs: number,
  reasons: string[],
): number | null {
  if (!item || typeof item !== 'object') {
    reasons.push(`${field} is missing or invalid`);
    return null;
  }
  const fetchedMs = validateObservationTime(
    item.fetchedAt, `${field}.fetchedAt`, nowMs, scheduledStartMs, reasons,
  );
  if (item.sourceTimestamp !== undefined) {
    const sourceMs = validateObservationTime(
      item.sourceTimestamp, `${field}.sourceTimestamp`, nowMs, scheduledStartMs, reasons,
    );
    if (sourceMs !== null && fetchedMs !== null && sourceMs > fetchedMs) {
      reasons.push(`${field}.sourceTimestamp is later than its fetchedAt`);
    }
  }
  return fetchedMs;
}

/* -------------------------------------------------------------------------- */
/*  Per-game readiness check                                                  */
/* -------------------------------------------------------------------------- */

async function checkGameReadiness(
  game: MLBScheduleGame,
  scheduleProvenance: DataProvenance,
  deps: MLBOperationalLivePreflightDependencies,
): Promise<MLBOperationalLivePreflightGameResult> {
  let currentTime = deps.now();
  const scheduledStartAt = game.startTimeUtc;
  const scheduledStartAtIso = scheduledStartAt.toISOString();
  const officialDate = game.officialDate;
  const gamePk = game.gamePk;

  let isCurrentBeforeStart =
    currentTime.getTime() < scheduledStartAt.getTime();

  /* A. Require genuinely UPCOMING status from the schedule. */
  if (game.status !== 'UPCOMING') {
    return Object.freeze({
      gamePk,
      officialDate,
      scheduledStartAtIso,
      eligibility: 'NOT_READY' as const,
      timing: Object.freeze({
        currentTimeIso: currentTime.toISOString(),
        scheduledStartAtIso,
        dataCutoffAtIso: null,
        isCurrentBeforeStart,
        isCutoffBeforeStart: null,
      }),
      provenance: null,
      rejectionReasons: Object.freeze([
        `Schedule status is ${game.status}, expected UPCOMING`,
      ]),
    });
  }

  /* Reject past-start games BEFORE requesting their research data. */
  if (!isCurrentBeforeStart) {
    return Object.freeze({
      gamePk,
      officialDate,
      scheduledStartAtIso,
      eligibility: 'NOT_READY' as const,
      timing: Object.freeze({
        currentTimeIso: currentTime.toISOString(),
        scheduledStartAtIso,
        dataCutoffAtIso: null,
        isCurrentBeforeStart: false,
        isCutoffBeforeStart: null,
      }),
      provenance: null,
      rejectionReasons: Object.freeze([
        `Current time ${currentTime.toISOString()} is not strictly before scheduledStartAt ${scheduledStartAtIso}`,
      ]),
    });
  }

  /* Build research snapshot (B prerequisite). */
  let researchSnapshot: MLBGameResearchSnapshot;
  try {
    const season = Number(game.gameDate.slice(0, 4));
    researchSnapshot = await deps.buildGameSnapshot(game, {
      season,
      includeWeather: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Object.freeze({
      gamePk,
      officialDate,
      scheduledStartAtIso,
      eligibility: 'NOT_READY' as const,
      timing: Object.freeze({
        currentTimeIso: currentTime.toISOString(),
        scheduledStartAtIso,
        dataCutoffAtIso: null,
        isCurrentBeforeStart,
        isCutoffBeforeStart: null,
      }),
      provenance: null,
      rejectionReasons: Object.freeze([
        `Research snapshot acquisition failed: ${message}`,
      ]),
    });
  }

  /* Recheck after the asynchronous provider read: the game may have started
   * while source data was being acquired. Do not stamp a stale earlier time. */
  currentTime = deps.now();
  isCurrentBeforeStart = currentTime.getTime() < scheduledStartAt.getTime();
  if (!isCurrentBeforeStart) {
    return Object.freeze({
      gamePk,
      officialDate,
      scheduledStartAtIso,
      eligibility: 'NOT_READY' as const,
      timing: Object.freeze({
        currentTimeIso: currentTime.toISOString(),
        scheduledStartAtIso,
        dataCutoffAtIso: null,
        isCurrentBeforeStart: false,
        isCutoffBeforeStart: null,
      }),
      provenance: null,
      rejectionReasons: Object.freeze([
        `Current time ${currentTime.toISOString()} is not strictly before scheduledStartAt ${scheduledStartAtIso}`,
      ]),
    });
  }

  const rejectionReasons: string[] = [];
  const nowMs = currentTime.getTime();
  const startMs = scheduledStartAt.getTime();

  /* Validate EVERY relevant observation clock, not just the fetchedAt max.
   * An observation fetched after now but before kickoff is still future data. */
  const scheduleFetchedMs = validateProvenance(
    scheduleProvenance, 'schedule.provenance', nowMs, startMs, rejectionReasons,
  );
  const fetchedAts: number[] = [];
  if (!Array.isArray(researchSnapshot.provenance) || researchSnapshot.provenance.length === 0) {
    rejectionReasons.push('researchSnapshot.provenance is missing or empty');
  } else {
    researchSnapshot.provenance.forEach((prov, i) => {
      const fetchedMs = validateProvenance(
        prov, `researchSnapshot.provenance[${i}]`, nowMs, startMs, rejectionReasons,
      );
      if (fetchedMs !== null) fetchedAts.push(fetchedMs);
    });
  }

  validateObservationTime(
    researchSnapshot.generatedAt, 'researchSnapshot.generatedAt', nowMs, startMs, rejectionReasons,
  );
  if (researchSnapshot.event) {
    validateObservationTime(
      researchSnapshot.event.updatedAt, 'researchSnapshot.event.updatedAt', nowMs, startMs, rejectionReasons,
    );
    validateObservationTime(
      researchSnapshot.event.createdAt, 'researchSnapshot.event.createdAt', nowMs, startMs, rejectionReasons,
    );
  } else {
    rejectionReasons.push('researchSnapshot.event is missing');
  }

  const nestedFetchedAts: number[] = [];
  for (const side of ['home', 'away'] as const) {
    for (const [name, prov] of [
      ['pitcherStats', researchSnapshot.pitcherStats?.[side]?.provenance],
      ['teamBatting', researchSnapshot.teamBatting?.[side]?.provenance],
      ['bullpen', researchSnapshot.bullpen?.[side]?.provenance],
    ] as const) {
      if (prov) {
        const ms = validateProvenance(
          prov, `researchSnapshot.${name}.${side}.provenance`, nowMs, startMs, rejectionReasons,
        );
        if (ms !== null) nestedFetchedAts.push(ms);
      }
    }
    const pitcher = researchSnapshot.probablePitchers?.[side];
    if (pitcher) {
      const ms = validateObservationTime(
        pitcher.fetchedAt, `researchSnapshot.probablePitchers.${side}.fetchedAt`,
        nowMs, startMs, rejectionReasons,
      );
      if (ms !== null) nestedFetchedAts.push(ms);
    }
    const schedulePitcher = game.probablePitchers?.[side];
    if (schedulePitcher) {
      const ms = validateObservationTime(
        schedulePitcher.fetchedAt, `schedule.probablePitchers.${side}.fetchedAt`,
        nowMs, startMs, rejectionReasons,
      );
      if (ms !== null) nestedFetchedAts.push(ms);
    }
  }
  if (researchSnapshot.weather) {
    const ms = validateProvenance(
      researchSnapshot.weather.freshness, 'researchSnapshot.weather.freshness',
      nowMs, startMs, rejectionReasons,
    );
    if (ms !== null) nestedFetchedAts.push(ms);
  }

  const dataCutoffAtMs = fetchedAts.length ? Math.max(...fetchedAts) : null;
  const dataCutoffAtIso = dataCutoffAtMs === null ? null : new Date(dataCutoffAtMs).toISOString();
  const isCutoffBeforeStart = dataCutoffAtMs === null ? null : dataCutoffAtMs < startMs;
  if (isCutoffBeforeStart === false) {
    rejectionReasons.push(`Data cutoff ${dataCutoffAtIso} is not before scheduledStartAt ${scheduledStartAtIso}`);
  }
  if (scheduleFetchedMs !== null && dataCutoffAtMs !== null && scheduleFetchedMs > dataCutoffAtMs) {
    rejectionReasons.push('Schedule provenance was fetched later than canonical data cutoff');
  }
  if (dataCutoffAtMs !== null && nestedFetchedAts.some((ms) => ms > dataCutoffAtMs)) {
    rejectionReasons.push('Nested source data was fetched later than canonical data cutoff');
  }

  const timing: MLBOperationalLivePreflightTimingInfo = {
    currentTimeIso: currentTime.toISOString(),
    scheduledStartAtIso,
    dataCutoffAtIso,
    isCurrentBeforeStart,
    isCutoffBeforeStart,
  };

  /* A research event must use an explicitly supported pregame status.
   * The frozen bridge currently canonicalizes UPCOMING to SCHEDULED. */
  if (researchSnapshot.event?.status !== 'UPCOMING') {
    rejectionReasons.push(
      `Research event status is ${researchSnapshot.event?.status ?? 'MISSING'}, expected UPCOMING`,
    );
  }

  /* If any pre-bridge guard failed, return NOT_READY before calling the bridge. */
  if (rejectionReasons.length > 0) {
    return Object.freeze({
      gamePk,
      officialDate,
      scheduledStartAtIso,
      eligibility: 'NOT_READY' as const,
      timing: Object.freeze(timing),
      provenance: Object.freeze(researchSnapshot.provenance ?? []),
      rejectionReasons: Object.freeze(rejectionReasons),
    });
  }

  /* F. Call the existing buildMLBRealDataPregameSnapshot. */
  const bridgeResult = buildMLBRealDataPregameSnapshot({
    scheduleGame: game,
    researchSnapshot,
  });

  /* G. Validate canonical snapshot (bridge returns ok: false on rejection). */
  if (!bridgeResult.ok) {
    const issueMessages = bridgeResult.issues
      .map((i) => `${i.code} at ${i.path}: ${i.message}`)
      .join('; ');
    rejectionReasons.push(
      `Canonical snapshot bridge rejected: ${issueMessages}`,
    );
    return Object.freeze({
      gamePk,
      officialDate,
      scheduledStartAtIso,
      eligibility: 'NOT_READY' as const,
      timing: Object.freeze(timing),
      provenance: Object.freeze(researchSnapshot.provenance ?? []),
      rejectionReasons: Object.freeze(rejectionReasons),
    });
  }

  const canonicalSnapshot = bridgeResult.value;

  /* H. Call extractMLBLeakageSafeFeatureVector using the frozen manifest. */
  const featureResult = extractMLBLeakageSafeFeatureVector(
    MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    canonicalSnapshot,
  );

  if (!featureResult.ok) {
    const issueMessages = featureResult.issues
      .map((i) => `${i.code} at ${i.path}: ${i.message}`)
      .join('; ');
    rejectionReasons.push(
      `Feature vector extraction rejected: ${issueMessages}`,
    );
    return Object.freeze({
      gamePk,
      officialDate,
      scheduledStartAtIso,
      eligibility: 'NOT_READY' as const,
      timing: Object.freeze(timing),
      provenance: Object.freeze(researchSnapshot.provenance ?? []),
      rejectionReasons: Object.freeze(rejectionReasons),
    });
  }

  const featureVector = featureResult.value;

  /* I. Verify the extracted vector is compatible with all 14 features. */
  const manifestFeatureCount =
    MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.length;
  const vectorFeatureCount = featureVector.values.length;

  if (
    manifestFeatureCount !== EXPECTED_FEATURE_COUNT ||
    vectorFeatureCount !== EXPECTED_FEATURE_COUNT
  ) {
    rejectionReasons.push(
      `Feature count mismatch: expected ${EXPECTED_FEATURE_COUNT}, ` +
        `manifest has ${manifestFeatureCount}, vector has ${vectorFeatureCount}`,
    );
    return Object.freeze({
      gamePk,
      officialDate,
      scheduledStartAtIso,
      eligibility: 'NOT_READY' as const,
      timing: Object.freeze(timing),
      provenance: Object.freeze(researchSnapshot.provenance ?? []),
      rejectionReasons: Object.freeze(rejectionReasons),
    });
  }

  /* J. Return structured readiness result. */
  /* E. officialDate and gamePk preserved — both are in the result fields. */
  return Object.freeze({
    gamePk,
    officialDate,
    scheduledStartAtIso,
    eligibility: 'READY' as const,
    timing: Object.freeze(timing),
    provenance: Object.freeze(researchSnapshot.provenance ?? []),
    canonicalSnapshot,
    featureVector,
  });
}

/* -------------------------------------------------------------------------- */
/*  Entry point — read-only schedule-level preflight                          */
/* -------------------------------------------------------------------------- */

export async function runMLBOperationalLiveReadonlyPreflight(
  date: string,
  deps: MLBOperationalLivePreflightDependencies,
): Promise<MLBOperationalLivePreflightResult> {
  const schedule = await deps.fetchSchedule(date);

  const gameResults: MLBOperationalLivePreflightGameResult[] = [];
  let readyCount = 0;
  let notReadyCount = 0;

  for (const game of schedule.games) {
    const result = await checkGameReadiness(game, schedule.provenance, deps);
    if (result.eligibility === 'READY') {
      readyCount++;
    } else {
      notReadyCount++;
    }
    gameResults.push(result);
  }

  return Object.freeze({
    date,
    games: Object.freeze(gameResults),
    readyCount,
    notReadyCount,
    totalGameCount: schedule.games.length,
  });
}

/* -------------------------------------------------------------------------- */
/*  CLI guard — direct execution is ALWAYS prohibited                          */
/*                                                                            */
/*  This module is read-only input readiness, not operational collection.      */
/*  Direct CLI execution would imply readiness for live prediction capture,    */
/*  which is NOT authorized in this phase.                                     */
/*  A later checkpoint will separately authorize a controlled read-only call.  */
/* -------------------------------------------------------------------------- */

function isDirectExecution(
  moduleUrl: string,
  argvEntry: string | undefined,
): boolean {
  return argvEntry !== undefined && moduleUrl === pathToFileURL(argvEntry).href;
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  console.error(
    'LIVE_PREFLIGHT_NOT_AUTHORIZED: Direct CLI execution of the ' +
      'read-only preflight is prohibited. Live provider invocation ' +
      'is not authorized in this phase. A later checkpoint will ' +
      'separately authorize a controlled, manual, read-only call.',
  );
  process.exit(1);
}
