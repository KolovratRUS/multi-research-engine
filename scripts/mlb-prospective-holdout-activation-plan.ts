#!/usr/bin/env tsx
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MLBResearchDataAdapter } from '@/lib/research-data/mlb/provider';
import type { MLBScheduleGame } from '@/lib/research-data/types';
import {
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_BOUNDARY_SELECTION_POLICY_ID,
  planMLBProspectiveHoldoutActivation,
  type MLBProspectiveHoldoutActivationPlanInput,
  type MLBProspectiveHoldoutActivationPlanResult,
  type MLBProspectiveHoldoutActivationPlan,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-plan';
import { MLB_PROSPECTIVE_HOLDOUT_SCI_CUTOFF_MINUTES } from '@/prediction/mlb/mlb-prospective-holdout-protocol-contract';

/* -------------------------------------------------------------------------- */
/*  Known provider codes                                                       */
/* -------------------------------------------------------------------------- */

const KNOWN_GAME_TYPES = new Set(['R', 'S', 'A', 'P', 'F', 'D', 'L', 'W', 'I']);
const KNOWN_STATUSES = new Set(['UPCOMING', 'LIVE', 'FINAL', 'POSTPONED', 'CANCELLED']);

/* -------------------------------------------------------------------------- */
/*  Host-specific error domain                                                 */
/* -------------------------------------------------------------------------- */

type HostErrorKind =
  | 'INVALID_ARGUMENTS'
  | 'PROVIDER_FAILURE'
  | 'MALFORMED_SCHEDULE'
  | 'UNKNOWN_GAME_TYPE'
  | 'UNKNOWN_STATUS'
  | 'DUPLICATE_GAME_PK'
  | 'OUT_OF_SCOPE_SCHEDULE_DATE'
  | 'AUTHORIZED_SEASON_EXHAUSTED_VALIDATION_SHORTFALL'
  | 'AUTHORIZED_SEASON_EXHAUSTED_TEST_SHORTFALL'
  | 'PLAN_FAILED';

interface HostErrorIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

interface HostError {
  readonly kind: HostErrorKind;
  readonly issues: readonly HostErrorIssue[];
}

type HostResult =
  | { readonly ok: true; readonly plan: MLBProspectiveHoldoutActivationPlan }
  | { readonly ok: false; readonly error: HostError };

/* -------------------------------------------------------------------------- */
/*  Validation errors                                                          */
/* -------------------------------------------------------------------------- */

class ValidationError extends Error {
  readonly kind = 'VALIDATION' as const;
  constructor(message: string) {
    super(message);
  }
}

class ScheduleProviderError extends Error {
  readonly kind = 'SCHEDULE_PROVIDER_ERROR' as const;
  constructor(message: string) {
    super(message);
  }
}

/* -------------------------------------------------------------------------- */
/*  Dependencies                                                               */
/* -------------------------------------------------------------------------- */

export interface MLBProspectiveHoldoutActivationPlanDependencies {
  readonly provider: {
    fetchSchedule(date: string): Promise<unknown>;
  };
  readonly now: () => Date;
  readonly plan: (input: MLBProspectiveHoldoutActivationPlanInput) => MLBProspectiveHoldoutActivationPlanResult;
}

/* -------------------------------------------------------------------------- */
/*  UTC helpers                                                                */
/* -------------------------------------------------------------------------- */

function addOneUtcCalendarDay(date: Date): Date {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
  ));
}

/* -------------------------------------------------------------------------- */
/*  Issue helpers                                                              */
/* -------------------------------------------------------------------------- */

function addHostIssue(
  issues: HostErrorIssue[],
  code: string,
  path: string,
  message: string,
): void {
  const exists = issues.some((item) => item.path === path && item.code === code);
  if (!exists) {
    issues.push({ code, path, message });
  }
}

function sortHostIssues(
  issues: readonly HostErrorIssue[],
): readonly HostErrorIssue[] {
  return Object.freeze(
    issues
      .slice()
      .sort((a, b) => (a.path < b.path ? -1 : a.path === b.path ? 0 : 1)
        || (a.code < b.code ? -1 : a.code === b.code ? 0 : 1))
      .filter((item, index, array) =>
        index === 0 || item.path !== array[index - 1].path || item.code !== array[index - 1].code,
      ),
  );
}

/* -------------------------------------------------------------------------- */
/*  Acquisition completeness                                                   */
/* -------------------------------------------------------------------------- */

interface AcquisitionCompleteness {
  readonly complete: boolean;
  readonly d67Date: string | null;
  readonly testSideCount: number;
  readonly cumulativeMax: number;
}

function computeAcquisitionCompleteness(
  eligibleGames: readonly {
    readonly officialDate: string;
  }[],
): AcquisitionCompleteness {
  const dateCounts = new Map<string, number>();
  for (const game of eligibleGames) {
    dateCounts.set(game.officialDate, (dateCounts.get(game.officialDate) ?? 0) + 1);
  }

  let cumulative = 0;
  let d67Date: string | null = null;
  const sortedDates = Array.from(dateCounts.keys()).sort();
  for (const date of sortedDates) {
    cumulative += dateCounts.get(date)!;
    if (d67Date === null && cumulative >= 67) {
      d67Date = date;
    }
  }

  if (d67Date === null) {
    return { complete: false, d67Date: null, testSideCount: 0, cumulativeMax: cumulative };
  }

  const d67Index = sortedDates.indexOf(d67Date);
  let testSideCount = 0;
  for (let i = d67Index + 1; i < sortedDates.length; i++) {
    testSideCount += dateCounts.get(sortedDates[i])!;
  }

  return { complete: testSideCount >= 69, d67Date, testSideCount, cumulativeMax: cumulative };
}

/* -------------------------------------------------------------------------- */
/*  Host-local planning projection                                             */
/* -------------------------------------------------------------------------- */

interface HostScheduleGameProjection {
  readonly gamePk: number;
  readonly officialDate: string;
  readonly startTimeUtc: Date;
  readonly gameType: string;
  readonly status: string;
}

/* -------------------------------------------------------------------------- */
/*  Core host logic                                                           */
/* -------------------------------------------------------------------------- */

export async function runProspectiveHoldoutActivationPlan(
  activationId: string,
  deps: MLBProspectiveHoldoutActivationPlanDependencies,
): Promise<HostResult> {
  const now = deps.now();
  const planningReferenceAt = now.toISOString();
  const scanStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const scanYear = scanStart.getUTCFullYear();
  const finiteCap = new Date(Date.UTC(scanYear, 11, 31));

  const gamePkSet = new Set<number>();
  const eligibleGames: HostScheduleGameProjection[] = [];
  const issues: HostErrorIssue[] = [];

  let currentDate = new Date(scanStart);
  while (currentDate <= finiteCap) {
    const dateStr = currentDate.toISOString().slice(0, 10);
    let rawResult: unknown;
    try {
      rawResult = await deps.provider.fetchSchedule(dateStr);
    } catch (error) {
      addHostIssue(
        issues,
        'PROVIDER_FAILURE',
        '$.provider',
        `Provider failure for ${dateStr}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return {
        ok: false,
        error: { kind: 'PROVIDER_FAILURE', issues: sortHostIssues(issues) },
      };
    }

    if (typeof rawResult !== 'object' || rawResult === null || !Array.isArray((rawResult as Record<string, unknown>).games)) {
      addHostIssue(
        issues,
        'MALFORMED_SCHEDULE',
        '$.scheduleGames',
        `Provider returned malformed result for ${dateStr}: missing games array`,
      );
      return {
        ok: false,
        error: { kind: 'MALFORMED_SCHEDULE', issues: sortHostIssues(issues) },
      };
    }

    const result = rawResult as Record<string, unknown>;
    const games = result.games as unknown[];

    for (let i = 0; i < games.length; i++) {
      const rawGame = games[i];
      const indexPrefix = `$.scheduleGames[${i}]`;

      if (typeof rawGame !== 'object' || rawGame === null) {
        addHostIssue(issues, 'MALFORMED_SCHEDULE', indexPrefix, 'Game element must be a non-null object');
        continue;
      }

      const game = rawGame as Record<string, unknown>;
      const gamePkRaw = game.gamePk;

      if (typeof gamePkRaw !== 'number' || !Number.isSafeInteger(gamePkRaw) || gamePkRaw <= 0) {
        addHostIssue(issues, 'MALFORMED_SCHEDULE', `${indexPrefix}.gamePk`, 'gamePk must be a positive safe integer');
        continue;
      }

      const gamePk = gamePkRaw;
      const prefix = `$.scheduleGames[${gamePk}]`;

      if (gamePkSet.has(gamePk)) {
        addHostIssue(issues, 'DUPLICATE_GAME_PK', `${prefix}.gamePk`, `Duplicate gamePk: ${gamePk}`);
        continue;
      }
      gamePkSet.add(gamePk);

      const officialDate = game.officialDate;
      if (typeof officialDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(officialDate)) {
        addHostIssue(issues, 'MALFORMED_SCHEDULE', `${prefix}.officialDate`, 'officialDate must be YYYY-MM-DD');
        continue;
      }

      const dateParts = officialDate.split('-');
      const year = Number(dateParts[0]);
      const month = Number(dateParts[1]);
      const day = Number(dateParts[2]);
      if (
        Number.isNaN(year) ||
        Number.isNaN(month) ||
        Number.isNaN(day) ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31 ||
        !Number.isInteger(year) ||
        !Number.isInteger(month) ||
        !Number.isInteger(day)
      ) {
        addHostIssue(issues, 'MALFORMED_SCHEDULE', `${prefix}.officialDate`, 'officialDate must be a real calendar date');
        continue;
      }
      const validatedDate = new Date(Date.UTC(year, month - 1, day));
      if (
        validatedDate.getUTCFullYear() !== year ||
        validatedDate.getUTCMonth() !== month - 1 ||
        validatedDate.getUTCDate() !== day
      ) {
        addHostIssue(issues, 'MALFORMED_SCHEDULE', `${prefix}.officialDate`, 'officialDate must be a real calendar date');
        continue;
      }

      const startTimeUtc = game.startTimeUtc;
      if (!(startTimeUtc instanceof Date) || Number.isNaN(startTimeUtc.getTime())) {
        addHostIssue(issues, 'MALFORMED_SCHEDULE', `${prefix}.startTimeUtc`, 'startTimeUtc must be a valid Date');
        continue;
      }

      const gameType = game.gameType;
      if (typeof gameType !== 'string' || !KNOWN_GAME_TYPES.has(gameType)) {
        addHostIssue(issues, 'UNKNOWN_GAME_TYPE', `${prefix}.gameType`, `Unknown gameType: ${String(gameType)}`);
        continue;
      }

      const status = game.status;
      if (typeof status !== 'string' || !KNOWN_STATUSES.has(status)) {
        addHostIssue(issues, 'UNKNOWN_STATUS', `${prefix}.status`, `Unknown status: ${String(status)}`);
        continue;
      }

      const gameYear = validatedDate.getUTCFullYear();
      if (gameYear !== scanYear) {
        addHostIssue(issues, 'OUT_OF_SCOPE_SCHEDULE_DATE', `${prefix}.officialDate`, `Game ${gamePk} officialDate year ${gameYear} differs from scan year ${scanYear}`);
        return {
          ok: false,
          error: { kind: 'OUT_OF_SCOPE_SCHEDULE_DATE', issues: sortHostIssues(issues) },
        };
      }

      const scheduledStartAt = startTimeUtc.toISOString();
      const scientificCutoffMs = Date.parse(scheduledStartAt) - MLB_PROSPECTIVE_HOLDOUT_SCI_CUTOFF_MINUTES * 60 * 1000;
      const planningMs = Date.parse(planningReferenceAt);
      if (!Number.isFinite(scientificCutoffMs) || !Number.isFinite(planningMs)) {
        continue;
      }
      if (planningMs >= scientificCutoffMs) {
        continue;
      }

      if (gameType !== 'R' || status !== 'UPCOMING') {
        continue;
      }

      eligibleGames.push({
        gamePk,
        officialDate,
        startTimeUtc,
        gameType,
        status,
      });
    }

    if (issues.length === 0) {
      const { complete } = computeAcquisitionCompleteness(eligibleGames);
      if (complete) {
        break;
      }
    }

    currentDate = addOneUtcCalendarDay(currentDate);
  }

  if (issues.length > 0) {
    const firstKind = issues.some((i) => i.code === 'DUPLICATE_GAME_PK')
      ? 'DUPLICATE_GAME_PK'
      : issues.some((i) => i.code === 'UNKNOWN_GAME_TYPE')
        ? 'UNKNOWN_GAME_TYPE'
        : issues.some((i) => i.code === 'UNKNOWN_STATUS')
          ? 'UNKNOWN_STATUS'
          : issues.some((i) => i.code === 'OUT_OF_SCOPE_SCHEDULE_DATE')
            ? 'OUT_OF_SCOPE_SCHEDULE_DATE'
            : 'MALFORMED_SCHEDULE';
    return { ok: false, error: { kind: firstKind, issues: sortHostIssues(issues) } };
  }

  const { complete, d67Date, testSideCount, cumulativeMax } = computeAcquisitionCompleteness(eligibleGames);

  if (!complete) {
    if (d67Date === null) {
      addHostIssue(
        issues,
        'AUTHORIZED_SEASON_EXHAUSTED_VALIDATION_SHORTFALL',
        '$.scheduleGames',
        `AUTHORIZED_SEASON_EXHAUSTED_VALIDATION_SHORTFALL. Max eligible candidates: ${cumulativeMax}`,
      );
      return { ok: false, error: { kind: 'AUTHORIZED_SEASON_EXHAUSTED_VALIDATION_SHORTFALL', issues: sortHostIssues(issues) } };
    } else {
      addHostIssue(
        issues,
        'AUTHORIZED_SEASON_EXHAUSTED_TEST_SHORTFALL',
        '$.scheduleGames',
        `AUTHORIZED_SEASON_EXHAUSTED_TEST_SHORTFALL. Test side candidates: ${testSideCount}`,
      );
      return { ok: false, error: { kind: 'AUTHORIZED_SEASON_EXHAUSTED_TEST_SHORTFALL', issues: sortHostIssues(issues) } };
    }
  }

  const input: MLBProspectiveHoldoutActivationPlanInput = {
    activationId,
    planningReferenceAt,
    scheduleGames: eligibleGames as MLBScheduleGame[],
  };

  const l1Result = deps.plan(input);
  if (l1Result.ok) {
    return { ok: true, plan: l1Result.plan };
  } else {
    return { ok: false, error: { kind: 'PLAN_FAILED', issues: sortHostIssues(l1Result.issues) } };
  }
}

/* -------------------------------------------------------------------------- */
/*  CLI argument parsing                                                       */
/* -------------------------------------------------------------------------- */

function parseActivationId(argv: string[]): string {
  let activationId: string | undefined;

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];

    if (argument.startsWith('--')) {
      throw new ValidationError(`Unsupported flag: ${argument}`);
    }

    if (activationId !== undefined) {
      throw new ValidationError('Only one positional argument (activationId) is allowed');
    }

    activationId = argument;
  }

  if (activationId === undefined) {
    throw new ValidationError('activationId is required');
  }

  if (typeof activationId !== 'string' || activationId !== activationId.trim() || activationId.length === 0) {
    throw new ValidationError('activationId must be a non-empty trimmed string');
  }

  return activationId;
}

/* -------------------------------------------------------------------------- */
/*  CLI entrypoint                                                            */
/* -------------------------------------------------------------------------- */

export interface PlanCLIIO {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
}

export async function runMLBProspectiveHoldoutActivationPlanCLI(
  argv: readonly string[],
  io?: PlanCLIIO,
  deps?: MLBProspectiveHoldoutActivationPlanDependencies,
): Promise<number> {
  const stdout = io?.stdout ?? ((message: string) => process.stdout.write(`${message}\n`));
  const stderr = io?.stderr ?? ((message: string) => process.stderr.write(`${message}\n`));

  const provider = deps?.provider ?? new MLBResearchDataAdapter();
  const now = deps?.now ?? (() => new Date());
  const plan = deps?.plan ?? planMLBProspectiveHoldoutActivation;

  let activationId: string;
  try {
    activationId = parseActivationId(argv.slice(2));
  } catch (error) {
    if (error instanceof ValidationError) {
      stderr(JSON.stringify([{ code: 'VALIDATION_ERROR', message: error.message }]));
    } else {
      stderr(JSON.stringify([{ code: 'VALIDATION_ERROR', message: 'invalid arguments' }]));
    }
    return 1;
  }

  try {
    const result = await runProspectiveHoldoutActivationPlan(activationId, {
      provider,
      now,
      plan,
    });

    if (result.ok) {
      stdout(JSON.stringify(result.plan));
      return 0;
    }
    stderr(JSON.stringify(result.error));
    return 1;
  } catch (error) {
    if (error instanceof ScheduleProviderError) {
      stderr(JSON.stringify([{ code: 'SCHEDULE_PROVIDER_ERROR', message: error.message }]));
    } else if (error instanceof Error) {
      stderr(JSON.stringify([{ code: 'UNKNOWN_ERROR', message: error.message }]));
    } else {
      stderr(JSON.stringify([{ code: 'UNKNOWN_ERROR', message: 'unexpected failure' }]));
    }
    return 1;
  }
}

/* -------------------------------------------------------------------------- */
/*  Direct execution guard                                                    */
/* -------------------------------------------------------------------------- */

function isDirectExecution(): boolean {
  const entryPoint = process.argv[1];
  if (!entryPoint) {
    return false;
  }
  try {
    const thisFile = realpathSync(fileURLToPath(import.meta.url));
    const resolvedEntry = realpathSync(entryPoint);
    return thisFile === resolvedEntry;
  } catch {
    return false;
  }
}

if (isDirectExecution()) {
  (async () => {
    process.exitCode = await runMLBProspectiveHoldoutActivationPlanCLI(process.argv);
  })();
}
