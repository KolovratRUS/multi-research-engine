/* -------------------------------------------------------------------------- */
/*  MRS-7 P5F-C7B-S1 — Real MLB Data Readiness Preflight Tests                  */
/*  Read-only. No live API calls. No model execution. No prediction writes.    */
/* -------------------------------------------------------------------------- */

import { describe, it, expect, vi } from 'vitest';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type {
  DataProvenance,
  MLBGameResearchSnapshot,
  MLBScheduleGame,
  MLBScheduleResult,
} from '@/lib/research-data/types';

import {
  runMLBOperationalLiveReadonlyPreflight,
  type MLBOperationalLivePreflightDependencies,
} from '../../../scripts/mlb-operational-live-readonly-preflight';
import { MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1 } from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';

/* === Shared fixture constants === */

const GAME_PK = 900001;
const OFFICIAL_DATE = '2027-07-15';
const SCHEDULED_START_ISO = '2027-07-15T12:00:00.000Z';
const SCHEDULED_START = new Date(SCHEDULED_START_ISO);
const DATA_CUTOFF_ISO = '2027-07-15T09:30:00.000Z';
const FETCHED_AT = new Date(DATA_CUTOFF_ISO);
const SOURCE_TIMESTAMP = new Date('2027-07-15T09:00:00Z');
const DEFAULT_NOW = new Date('2027-07-15T10:00:00Z');

/* === Fixture builders === */

function makeScheduleGame(opts: {
  status?: MLBScheduleGame['status'];
  startTimeUtc?: Date;
  officialDate?: string;
  gameDate?: string;
  gamePk?: number;
  homeTeamName?: string;
  awayTeamName?: string;
}): MLBScheduleGame {
  return {
    gamePk: opts.gamePk ?? GAME_PK,
    gameType: 'R',
    gameNumber: 1,
    officialDate: opts.officialDate ?? OFFICIAL_DATE,
    gameDate: opts.gameDate ?? OFFICIAL_DATE,
    startTimeUtc: opts.startTimeUtc ?? SCHEDULED_START,
    status: opts.status ?? 'UPCOMING',
    homeTeamId: 101,
    homeTeamName: opts.homeTeamName ?? 'Synthetic Home',
    awayTeamId: 102,
    awayTeamName: opts.awayTeamName ?? 'Synthetic Away',
    venueId: 1001,
    venueName: 'Synthetic Park',
    dayNight: 'day',
    scheduledInnings: 9,
    doubleHeader: 'N',
    seriesGameNumber: 1,
    gamesInSeries: 3,
    seriesDescription: 'Synthetic Regular Season',
    leagueRecord: {
      home: { wins: 50, losses: 40, pct: '0.556' },
      away: { wins: 45, losses: 45, pct: '0.500' },
    },
    probablePitchers: { home: null, away: null },
  };
}

function makeResearchSnapshot(opts: {
  externalId?: string;
  homeTeam?: string;
  awayTeam?: string;
  startTimeUtc?: Date;
  eventStatus?: string;
  fetchedAt?: Date;
  sourceTimestamp?: Date;
  provenance?: DataProvenance[];
}): MLBGameResearchSnapshot {
  const fetchedAt = opts.fetchedAt ?? FETCHED_AT;
  const srcTs = opts.sourceTimestamp ?? SOURCE_TIMESTAMP;
  return {
    event: {
      id: 'synthetic-event-' + (opts.externalId ?? String(GAME_PK)),
      externalId: opts.externalId ?? String(GAME_PK),
      sport: 'mlb',
      league: 'MLB',
      leagueSlug: 'mlb',
      homeTeam: opts.homeTeam ?? 'Synthetic Home',
      awayTeam: opts.awayTeam ?? 'Synthetic Away',
      homeTeamSlug: 'synthetic-home',
      awayTeamSlug: 'synthetic-away',
      startTimeUtc: opts.startTimeUtc ?? SCHEDULED_START,
      status: opts.eventStatus ?? 'UPCOMING',
      createdAt: new Date('2027-07-15T08:00:00Z'),
      updatedAt: srcTs,
    },
    probablePitchers: { home: null, away: null },
    pitcherStats: { home: null, away: null },
    teamBatting: { home: null, away: null },
    bullpen: { home: null, away: null },
    venue: null,
    weather: null,
    completeness: 100,
    warnings: [],
    provenance: opts.provenance ?? [
      {
        source: 'mlb-stats-api:schedule',
        fetchedAt,
        sourceTimestamp: srcTs,
        isLive: false,
        warnings: [],
      },
    ],
    generatedAt: fetchedAt,
  };
}

function makeSchedule(
  games: MLBScheduleGame[] = [makeScheduleGame({})],
): MLBScheduleResult {
  return {
    games,
    provenance: {
      source: 'mlb-stats-api:schedule',
      fetchedAt: FETCHED_AT,
      sourceTimestamp: SOURCE_TIMESTAMP,
      isLive: false,
      warnings: [],
    },
  };
}

function makeSyntheticDeps(opts: {
  schedule: MLBScheduleResult;
  snapshot?: MLBGameResearchSnapshot;
  snapshotError?: Error;
  nowValue?: Date;
}): MLBOperationalLivePreflightDependencies {
  return {
    fetchSchedule: async () => opts.schedule,
    buildGameSnapshot: async () => {
      if (opts.snapshotError) throw opts.snapshotError;
      if (!opts.snapshot) throw new Error('No snapshot configured');
      return opts.snapshot;
    },
    now: () => opts.nowValue ?? DEFAULT_NOW,
  };
}

function makeValidDeps(): MLBOperationalLivePreflightDependencies {
  return makeSyntheticDeps({
    schedule: makeSchedule(),
    snapshot: makeResearchSnapshot({}),
    nowValue: DEFAULT_NOW,
  });
}

/* === CLI helper === */

function runPreflightCLI(): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const tsxPath = path.join(process.cwd(), 'node_modules/.bin/tsx');
    const scriptPath = path.join(
      process.cwd(),
      'scripts',
      'mlb-operational-live-readonly-preflight.ts',
    );
    const child = spawn(tsxPath, [scriptPath], {
      env: { ...process.env },
      timeout: 30000,
      killSignal: 'SIGKILL',
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err: Error) => {
      resolve({ exitCode: -1, stdout, stderr: stderr + err.message });
    });
    child.on('close', (code: number | null) => {
      resolve({ exitCode: code ?? -1, stdout, stderr });
    });
  });
}

/* === Source file path for safety checks === */

const PREFLIGHT_SCRIPT_PATH = path.join(
  process.cwd(),
  'scripts',
  'mlb-operational-live-readonly-preflight.ts',
);

async function readdirSafe(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

/* ==================================================================== */
/*  Tests 1–12: Functional preflight tests                               */
/* ==================================================================== */

describe('MRS-7 P5F-C7B-S1: Real MLB data readiness preflight', () => {
  it('1. Valid pregame snapshot readiness — returns READY for an upcoming game', async () => {
    const deps = makeValidDeps();
    const result = await runMLBOperationalLiveReadonlyPreflight(OFFICIAL_DATE, deps);

    expect(result.totalGameCount).toBe(1);
    expect(result.readyCount).toBe(1);
    expect(result.notReadyCount).toBe(0);

    const gameResult = result.games[0];
    expect(gameResult).toBeDefined();
    expect(gameResult?.eligibility).toBe('READY');
    if (gameResult.eligibility !== 'READY') {
      throw new Error('Expected READY');
    }

    /* E. officialDate and gamePk preserved. */
    expect(gameResult.gamePk).toBe(GAME_PK);
    expect(gameResult.officialDate).toBe(OFFICIAL_DATE);
    expect(gameResult.scheduledStartAtIso).toBe(SCHEDULED_START_ISO);

    /* J. Timing, provenance present. */
    expect(gameResult.timing.currentTimeIso).toBe(DEFAULT_NOW.toISOString());
    expect(gameResult.timing.scheduledStartAtIso).toBe(SCHEDULED_START_ISO);
    expect(gameResult.timing.dataCutoffAtIso).toBe(DATA_CUTOFF_ISO);
    expect(gameResult.timing.isCurrentBeforeStart).toBe(true);
    expect(gameResult.timing.isCutoffBeforeStart).toBe(true);

    expect(gameResult.provenance).toHaveLength(1);
    expect(gameResult.provenance[0].source).toBe('mlb-stats-api:schedule');

    /* G. Canonical snapshot present. */
    expect(gameResult.canonicalSnapshot).toBeDefined();
    expect(gameResult.canonicalSnapshot.game.gameId).toBe(String(GAME_PK));
    expect(gameResult.canonicalSnapshot.game.status).toBe('SCHEDULED');
    expect(gameResult.canonicalSnapshot.game.officialDate).toBe(OFFICIAL_DATE);

    /* H/I. Feature vector present. */
    expect(gameResult.featureVector).toBeDefined();
  });

  it('2. Original 14-feature extraction through the real bridge/extractor', async () => {
    const deps = makeValidDeps();
    const result = await runMLBOperationalLiveReadonlyPreflight(OFFICIAL_DATE, deps);

    const gameResult = result.games[0];
    expect(gameResult).toBeDefined();
    if (gameResult.eligibility !== 'READY') {
      throw new Error('Expected READY');
    }

    expect(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features).toHaveLength(14);
    expect(gameResult.featureVector.values).toHaveLength(14);

    const expectedIds = MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.map((f) => f.featureId);
    const actualIds = gameResult.featureVector.values.map((v) => v.featureId);
    expect(actualIds).toEqual(expectedIds);

    for (const val of gameResult.featureVector.values) {
      expect(Number.isFinite(val.value)).toBe(true);
    }
  });

  it('3. Empty schedule — returns zero games with no readiness checks', async () => {
    const deps = makeSyntheticDeps({
      schedule: { games: [], provenance: makeSchedule().provenance },
      snapshot: makeResearchSnapshot({}),
    });
    const result = await runMLBOperationalLiveReadonlyPreflight(OFFICIAL_DATE, deps);

    expect(result.totalGameCount).toBe(0);
    expect(result.readyCount).toBe(0);
    expect(result.notReadyCount).toBe(0);
    expect(result.games).toHaveLength(0);
  });

  it('4. Missing research snapshot — buildGameSnapshot throws, game is NOT_READY', async () => {
    const deps = makeSyntheticDeps({
      schedule: makeSchedule(),
      snapshotError: new Error('Network unreachable: stats API timeout'),
      nowValue: DEFAULT_NOW,
    });
    const result = await runMLBOperationalLiveReadonlyPreflight(OFFICIAL_DATE, deps);

    const gameResult = result.games[0];
    expect(gameResult).toBeDefined();
    if (gameResult.eligibility !== 'NOT_READY') {
      throw new Error('Expected NOT_READY');
    }
    expect(gameResult.rejectionReasons).toHaveLength(1);
    expect(gameResult.rejectionReasons[0]).toContain(
      'Research snapshot acquisition failed',
    );
    expect(gameResult.provenance).toBeNull();
    expect(gameResult.timing.dataCutoffAtIso).toBeNull();
    expect(gameResult.timing.isCutoffBeforeStart).toBeNull();
  });

  it('5. Live game rejected — schedule status LIVE fails check A', async () => {
    const game = makeScheduleGame({ status: 'LIVE' });
    const deps = makeSyntheticDeps({
      schedule: makeSchedule([game]),
      snapshot: makeResearchSnapshot({}),
      nowValue: DEFAULT_NOW,
    });
    const result = await runMLBOperationalLiveReadonlyPreflight(OFFICIAL_DATE, deps);

    const gameResult = result.games[0];
    expect(gameResult).toBeDefined();
    if (gameResult.eligibility !== 'NOT_READY') {
      throw new Error('Expected NOT_READY');
    }
    expect(gameResult.rejectionReasons).toContainEqual(
      expect.stringContaining('LIVE'),
    );
  });

  it('6. Final game rejected — schedule status FINAL fails check A', async () => {
    const game = makeScheduleGame({ status: 'FINAL' });
    const deps = makeSyntheticDeps({
      schedule: makeSchedule([game]),
      snapshot: makeResearchSnapshot({}),
      nowValue: DEFAULT_NOW,
    });
    const result = await runMLBOperationalLiveReadonlyPreflight(OFFICIAL_DATE, deps);

    const gameResult = result.games[0];
    expect(gameResult).toBeDefined();
    if (gameResult.eligibility !== 'NOT_READY') {
      throw new Error('Expected NOT_READY');
    }
    expect(gameResult.rejectionReasons).toContainEqual(
      expect.stringContaining('FINAL'),
    );
  });

  it('7. Postponed/cancelled game rejected — statuses POSTPONED and CANCELLED fail check A', async () => {
    const postponedGame = makeScheduleGame({
      status: 'POSTPONED',
      gamePk: 900002,
    });
    const cancelledGame = makeScheduleGame({
      status: 'CANCELLED',
      gamePk: 900003,
    });
    const deps = makeSyntheticDeps({
      schedule: makeSchedule([postponedGame, cancelledGame]),
      snapshot: makeResearchSnapshot({}),
      nowValue: DEFAULT_NOW,
    });
    const result = await runMLBOperationalLiveReadonlyPreflight(OFFICIAL_DATE, deps);

    expect(result.totalGameCount).toBe(2);
    expect(result.readyCount).toBe(0);
    expect(result.notReadyCount).toBe(2);

    const postResult = result.games[0];
    expect(postResult).toBeDefined();
    if (postResult.eligibility !== 'NOT_READY') {
      throw new Error('Expected NOT_READY');
    }
    expect(postResult.gamePk).toBe(900002);
    expect(postResult.rejectionReasons).toContainEqual(
      expect.stringContaining('POSTPONED'),
    );

    const canResult = result.games[1];
    expect(canResult).toBeDefined();
    if (canResult.eligibility !== 'NOT_READY') {
      throw new Error('Expected NOT_READY');
    }
    expect(canResult.gamePk).toBe(900003);
    expect(canResult.rejectionReasons).toContainEqual(
      expect.stringContaining('CANCELLED'),
    );
  });

  it('8. Scheduled start already passed — now >= scheduledStartAt fails check C', async () => {
    const deps = makeSyntheticDeps({
      schedule: makeSchedule(),
      snapshot: makeResearchSnapshot({}),
      nowValue: new Date('2027-07-15T13:00:00Z'),
    });
    const result = await runMLBOperationalLiveReadonlyPreflight(OFFICIAL_DATE, deps);

    const gameResult = result.games[0];
    expect(gameResult).toBeDefined();
    if (gameResult.eligibility !== 'NOT_READY') {
      throw new Error('Expected NOT_READY');
    }
    expect(gameResult.timing.isCurrentBeforeStart).toBe(false);
    expect(
      gameResult.rejectionReasons.some((r) =>
        r.includes('not strictly before scheduledStartAt'),
      ),
    ).toBe(true);
  });

  it('9. Invalid/future provenance rejected — fetchedAt >= scheduledStartAt fails check D', async () => {
    const futureFetchedAt = new Date('2027-07-15T13:00:00Z');
    const deps = makeSyntheticDeps({
      schedule: makeSchedule(),
      snapshot: makeResearchSnapshot({
        fetchedAt: futureFetchedAt,
        provenance: [{
          source: 'mlb-stats-api:schedule',
          fetchedAt: futureFetchedAt,
          sourceTimestamp: futureFetchedAt,
          isLive: false,
          warnings: [],
        }],
      }),
      nowValue: DEFAULT_NOW,
    });
    const result = await runMLBOperationalLiveReadonlyPreflight(OFFICIAL_DATE, deps);

    const gameResult = result.games[0];
    expect(gameResult).toBeDefined();
    if (gameResult.eligibility !== 'NOT_READY') {
      throw new Error('Expected NOT_READY');
    }
    expect(gameResult.timing.dataCutoffAtIso).toBe(futureFetchedAt.toISOString());
    expect(gameResult.timing.isCutoffBeforeStart).toBe(false);
    expect(
      gameResult.rejectionReasons.some((r) => r.includes('Data cutoff')),
    ).toBe(true);
  });

  it('10. Invalid canonical snapshot rejected — mismatched externalId fails bridge', async () => {
    const deps = makeSyntheticDeps({
      schedule: makeSchedule(),
      snapshot: makeResearchSnapshot({ externalId: '999999' }),
      nowValue: DEFAULT_NOW,
    });
    const result = await runMLBOperationalLiveReadonlyPreflight(OFFICIAL_DATE, deps);

    const gameResult = result.games[0];
    expect(gameResult).toBeDefined();
    if (gameResult.eligibility !== 'NOT_READY') {
      throw new Error('Expected NOT_READY');
    }
    expect(
      gameResult.rejectionReasons.some((r) =>
        r.includes('Canonical snapshot bridge rejected'),
      ),
    ).toBe(true);
  });

  it('11. Missing required features handled — null data yields 14 features via USE_DEFAULT', async () => {
    const deps = makeValidDeps();
    const result = await runMLBOperationalLiveReadonlyPreflight(OFFICIAL_DATE, deps);

    const gameResult = result.games[0];
    expect(gameResult).toBeDefined();
    if (gameResult.eligibility !== 'READY') {
      throw new Error('Expected READY');
    }
    expect(gameResult.featureVector.values).toHaveLength(14);

    /* section-game-context features (from schedule game) should NOT be missing. */
    const scheduledInnings = gameResult.featureVector.values.find(
      (v) => v.featureId === 'scheduledInnings',
    );
    expect(scheduledInnings).toBeDefined();
    expect(scheduledInnings?.wasMissing).toBe(false);
    expect(scheduledInnings?.value).toBe(9);

    const dhGameNumber = gameResult.featureVector.values.find(
      (v) => v.featureId === 'doubleHeaderGameNumber',
    );
    expect(dhGameNumber).toBeDefined();
    /* doubleHeaderGameNumber is undefined in the payload when doubleHeader is
       'N', so it is legitimately missing with default value 0. */
    expect(dhGameNumber?.wasMissing).toBe(true);
    expect(dhGameNumber?.value).toBe(0);

    /* section-home-starter features (from null research snapshot) should be missing. */
    const homeStarterAvailable = gameResult.featureVector.values.find(
      (v) => v.featureId === 'homeStarterAvailable',
    );
    expect(homeStarterAvailable).toBeDefined();
    expect(homeStarterAvailable?.wasMissing).toBe(true);
    expect(homeStarterAvailable?.value).toBe(0);

    const homeBullpenGames = gameResult.featureVector.values.find(
      (v) => v.featureId === 'homeBullpenGamesInPrevious3Days',
    );
    expect(homeBullpenGames).toBeDefined();
    expect(homeBullpenGames?.wasMissing).toBe(true);
    expect(homeBullpenGames?.value).toBe(0);
  });

  it('12. Deterministic repeat — same inputs produce identical results', async () => {
    const deps = makeValidDeps();
    const first = await runMLBOperationalLiveReadonlyPreflight(OFFICIAL_DATE, deps);
    const second = await runMLBOperationalLiveReadonlyPreflight(OFFICIAL_DATE, deps);

    expect(JSON.stringify(first)).toEqual(JSON.stringify(second));
    expect(first.readyCount).toBe(second.readyCount);
    expect(first.notReadyCount).toBe(second.notReadyCount);
    expect(first.games).toHaveLength(second.games.length);
  });
});

/* ==================================================================== */
/*  Tests 13–17: Safety guards                                            */
/* ==================================================================== */

describe('MRS-7 P5F-C7B-S1: Safety guards', () => {
  const NO_FORBIDDEN_IMPORTS = [
    'fixtureMLBOperationalPredictionCollection',
    'orchestrateMLBShadowPreparation',
    'executeStoredMLBShadowPreparedExecutionJobV2',
    'checkPreparedJobDispatchReadiness',
    'getMLBShadowCandidate003AuthorizedModelArtifact',
    'mlb-shadow-execution-adapter-v2',
    'mlb-shadow-model-scoring',
    'mlb-shadow-monitoring-quarantine',
  ];

  it('13. No model execution — preflight source has zero model/scoring imports', async () => {
    const source = await fs.readFile(PREFLIGHT_SCRIPT_PATH, 'utf8');
    const found: string[] = [];
    for (const s of NO_FORBIDDEN_IMPORTS) {
      if (source.includes(s)) found.push(s);
    }
    expect(found).toEqual([]);
  });

  it('14. No prediction persistence — preflight source has no collection/execution imports', async () => {
    const source = await fs.readFile(PREFLIGHT_SCRIPT_PATH, 'utf8');
    expect(source).not.toContain('fixtureMLBOperationalPredictionCollection');
    expect(source).not.toContain('executeStoredMLBShadowPreparedExecutionJobV2');
    expect(source).not.toContain('orchestrateMLBShadowPreparation');
    /* Only the two permitted runtime imports. */
    expect(source).toContain("from '@/prediction/mlb/mlb-real-data-pregame-snapshot-bridge'");
    expect(source).toContain("from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1'");
    expect(source).toContain("from '@/prediction/mlb/mlb-feature-vector-contract'");
  });

  it('15. No network during tests — global fetch is never called', async () => {
    if (typeof globalThis.fetch === 'function') {
      const spy = vi.spyOn(globalThis, 'fetch');
      try {
        const deps = makeValidDeps();
        await runMLBOperationalLiveReadonlyPreflight(OFFICIAL_DATE, deps);
        expect(spy).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    } else {
      const deps = makeValidDeps();
      await runMLBOperationalLiveReadonlyPreflight(OFFICIAL_DATE, deps);
    }
  });

  it('16. No real repository runtime writes — preflight produces zero filesystem changes', async () => {
    const projectRoot = process.cwd();
    const before = await readdirSafe(projectRoot);

    const deps = makeValidDeps();
    await runMLBOperationalLiveReadonlyPreflight(OFFICIAL_DATE, deps);

    const after = await readdirSafe(projectRoot);
    const beforeSet = new Set(before);
    const afterSet = new Set(after);

    const newEntries: string[] = after.filter((e: string) => !beforeSet.has(e));
    const removedEntries: string[] = before.filter((e: string) => !afterSet.has(e));

    expect(newEntries).toEqual([]);
    expect(removedEntries).toEqual([]);
  });

  it('17. CLI/import side effects blocked — CLI fails closed; module import is inert', async () => {
    /* 17a. Module import is inert. */
    expect(runMLBOperationalLiveReadonlyPreflight).toBeDefined();
    expect(typeof runMLBOperationalLiveReadonlyPreflight).toBe('function');

    /* 17b. Direct CLI execution fails closed. */
    const cliResult = await runPreflightCLI();
    expect(cliResult.exitCode).toBe(1);
    expect(cliResult.stderr).toContain('LIVE_PREFLIGHT_NOT_AUTHORIZED');
    expect(cliResult.stderr).toContain('Direct CLI execution');
  });
});

/* ==================================================================== */
/*  C7B-S1-R1: Hard fail-closed timing / provenance regression coverage  */
/* ==================================================================== */

describe('MRS-7 P5F-C7B-S1-R1: no future observations admitted', () => {
  async function rejected(deps: MLBOperationalLivePreflightDependencies) {
    const result = await runMLBOperationalLiveReadonlyPreflight(OFFICIAL_DATE, deps);
    expect(result.readyCount).toBe(0);
    expect(result.notReadyCount).toBe(1);
    const game = result.games[0];
    expect(game.eligibility).toBe('NOT_READY');
    if (game.eligibility !== 'NOT_READY') throw new Error('Expected NOT_READY');
    return game.rejectionReasons;
  }

  it('18. Rejects research fetched after preflight time even if before kickoff', async () => {
    const futureFetch = new Date('2027-07-15T10:30:00Z');
    const reasons = await rejected(makeSyntheticDeps({
      schedule: makeSchedule(),
      snapshot: makeResearchSnapshot({ fetchedAt: futureFetch }),
    }));
    expect(reasons.some((r) => r.includes('provenance[0].fetchedAt') && r.includes('later than current'))).toBe(true);
  });

  it('19. Rejects sourceTimestamp later than now even if fetchedAt is pregame', async () => {
    const reasons = await rejected(makeSyntheticDeps({
      schedule: makeSchedule(),
      snapshot: makeResearchSnapshot({ sourceTimestamp: new Date('2027-07-15T10:30:00Z') }),
    }));
    expect(reasons.some((r) => r.includes('sourceTimestamp') && r.includes('later than current'))).toBe(true);
  });

  it('20. Rejects future schedule source timestamps', async () => {
    const schedule = makeSchedule();
    schedule.provenance.sourceTimestamp = new Date('2027-07-15T10:30:00Z');
    const reasons = await rejected(makeSyntheticDeps({ schedule, snapshot: makeResearchSnapshot({}) }));
    expect(reasons.some((r) => r.includes('schedule.provenance.sourceTimestamp'))).toBe(true);
  });

  it('21. Rejects schedule fetched later than canonical data cutoff', async () => {
    const schedule = makeSchedule();
    schedule.provenance.fetchedAt = new Date('2027-07-15T09:45:00Z');
    const reasons = await rejected(makeSyntheticDeps({ schedule, snapshot: makeResearchSnapshot({}) }));
    expect(reasons).toContain('Schedule provenance was fetched later than canonical data cutoff');
  });

  it('22. Rejects event update timestamps from the future', async () => {
    const snapshot = makeResearchSnapshot({});
    snapshot.event.updatedAt = new Date('2027-07-15T10:30:00Z');
    const reasons = await rejected(makeSyntheticDeps({ schedule: makeSchedule(), snapshot }));
    expect(reasons.some((r) => r.includes('event.updatedAt') && r.includes('later than current'))).toBe(true);
  });

  it('23. Rejects snapshot generated after preflight time', async () => {
    const snapshot = makeResearchSnapshot({});
    snapshot.generatedAt = new Date('2027-07-15T10:30:00Z');
    const reasons = await rejected(makeSyntheticDeps({ schedule: makeSchedule(), snapshot }));
    expect(reasons.some((r) => r.includes('generatedAt') && r.includes('later than current'))).toBe(true);
  });

  it('24. Rejects unknown/nonpregame research event status explicitly', async () => {
    const reasons = await rejected(makeSyntheticDeps({
      schedule: makeSchedule(),
      snapshot: makeResearchSnapshot({ eventStatus: 'UNKNOWN' }),
    }));
    expect(reasons.some((r) => r.includes('expected UPCOMING'))).toBe(true);
  });

  it('25. Does not fetch research when the schedule start has passed', async () => {
    const buildGameSnapshot = vi.fn(async () => makeResearchSnapshot({}));
    const reasons = await rejected({
      fetchSchedule: async () => makeSchedule(),
      buildGameSnapshot,
      now: () => new Date('2027-07-15T13:00:00Z'),
    });
    expect(buildGameSnapshot).not.toHaveBeenCalled();
    expect(reasons.some((r) => r.includes('not strictly before scheduledStartAt'))).toBe(true);
  });

  it('26. Rechecks the clock after async snapshot acquisition', async () => {
    let calls = 0;
    const reasons = await rejected({
      fetchSchedule: async () => makeSchedule(),
      buildGameSnapshot: async () => makeResearchSnapshot({}),
      now: () => (++calls === 1 ? DEFAULT_NOW : new Date('2027-07-15T12:01:00Z')),
    });
    expect(calls).toBe(2);
    expect(reasons.some((r) => r.includes('not strictly before scheduledStartAt'))).toBe(true);
  });

  it('27. Rejects nested pitcher data fetched after canonical cutoff', async () => {
    const snapshot = makeResearchSnapshot({});
    snapshot.probablePitchers.home = {
      availability: 'UNAVAILABLE',
      teamId: 101,
      status: 'UNAVAILABLE',
      fetchedAt: new Date('2027-07-15T09:45:00Z'),
      warnings: [],
    };
    const reasons = await rejected(makeSyntheticDeps({ schedule: makeSchedule(), snapshot }));
    expect(reasons).toContain('Nested source data was fetched later than canonical data cutoff');
  });

  it('28. Rejects invalid provenance timestamps without throwing', async () => {
    const snapshot = makeResearchSnapshot({});
    snapshot.provenance[0].fetchedAt = new Date('invalid');
    const reasons = await rejected(makeSyntheticDeps({ schedule: makeSchedule(), snapshot }));
    expect(reasons.some((r) => r.includes('fetchedAt is missing or invalid'))).toBe(true);
  });
});
