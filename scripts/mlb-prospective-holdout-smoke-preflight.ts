#!/usr/bin/env tsx
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { realpathSync } from 'node:fs';

import {
  runMLBProspectiveHoldoutProgress,
} from './mlb-prospective-holdout-progress';
import {
  buildMLBProspectiveHoldoutSmokePreflight,
  validateMLBProspectiveHoldoutFirstSmokeState,
  type MLBProspectiveHoldoutSmokePreflightSuccess,
  type MLBProspectiveHoldoutSmokePreflightError,
  type MLBProspectiveHoldoutSmokeScheduleGame,
} from '@/prediction/mlb/mlb-prospective-holdout-smoke-preflight';

/* -------------------------------------------------------------------------- */
/*  Host-local error domain                                                   */
/* -------------------------------------------------------------------------- */

type HostErrorKind =
  | 'INVALID_ARGUMENTS'
  | 'ACTIVATION_UNAVAILABLE'
  | 'ACTIVATION_READ_FAILURE'
  | 'ACTIVATION_STATE_INVALID'
  | 'DISCOVERY_FAILURE'
  | 'PROGRESS_INTEGRITY_CONFLICT'
  | 'CAPTURE_COUNT_EXCEEDS_TARGET'
  | 'FIRST_SMOKE_PROGRESS_NOT_ZERO'
  | 'FIRST_SMOKE_STATE_NOT_PRISTINE'
  | 'SCHEDULE_FETCH_FAILURE'
  | 'SCHEDULE_STATE_INVALID'
  | 'NO_ELIGIBLE_SMOKE_GAME';

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
  | { readonly ok: true; readonly report: MLBProspectiveHoldoutSmokePreflightSuccess }
  | { readonly ok: false; readonly error: HostError };

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

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

function pushHostIssue(
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

function deriveRepositoryRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

const KNOWN_SCHEDULE_STATUSES = new Set([
  'UPCOMING',
  'LIVE',
  'FINAL',
  'POSTPONED',
  'CANCELLED',
]);

type KnownScheduleStatus = 'UPCOMING' | 'LIVE' | 'FINAL' | 'POSTPONED' | 'CANCELLED';

function isUnknownRecord(
  value: unknown,
): value is { readonly [key: string]: unknown } {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
}

function canonicalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return false;
  }
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return false;
  }
  return parsed.toISOString().slice(0, 10) === value;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function isKnownStatus(value: unknown): value is KnownScheduleStatus {
  return typeof value === 'string' && KNOWN_SCHEDULE_STATUSES.has(value);
}

function isHostErrorIssueArray(
  value: unknown,
): value is readonly HostErrorIssue[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item): boolean =>
        typeof item === 'object' &&
        item !== null &&
        'code' in item &&
        typeof item.code === 'string' &&
        'path' in item &&
        typeof item.path === 'string' &&
        'message' in item &&
        typeof item.message === 'string',
    )
  );
}

function validateProviderScheduleResult(
  result: unknown,
): MLBProspectiveHoldoutSmokeScheduleGame[] {
  if (typeof result !== 'object' || result === null || Array.isArray(result)) {
    throw Object.freeze<HostErrorIssue[]>([
      {
        code: 'SCHEDULE_RESULT_INVALID',
        path: '$.result',
        message: 'Schedule result must be a non-null object',
      },
    ]);
  }

  if (!isUnknownRecord(result)) {
    throw Object.freeze<HostErrorIssue[]>([
      {
        code: 'SCHEDULE_RESULT_INVALID',
        path: '$.result',
        message: 'Schedule result must be a non-null object',
      },
    ]);
  }

  const games = result.games;
  if (!Array.isArray(games)) {
    throw Object.freeze<HostErrorIssue[]>([
      {
        code: 'SCHEDULE_RESULT_INVALID',
        path: '$.games',
        message: 'Schedule result.games must be an array',
      },
    ]);
  }

  const issues: HostErrorIssue[] = [];
  const projected: MLBProspectiveHoldoutSmokeScheduleGame[] = [];

  for (const entry of games) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      pushHostIssue(issues, 'SCHEDULE_GAME_INVALID', '$', 'Schedule row must be a non-null object');
      continue;
    }

    if (!isUnknownRecord(entry)) {
      pushHostIssue(issues, 'SCHEDULE_GAME_INVALID', '$', 'Schedule row must be a non-null object');
      continue;
    }

    const game = entry;

    const gamePk = game.gamePk;
    if (!isPositiveSafeInteger(gamePk)) {
      pushHostIssue(issues, 'SCHEDULE_GAME_INVALID', '$.gamePk', `gamePk must be a positive safe integer: ${String(gamePk)}`);
      continue;
    }

    const gameType = game.gameType;
    if (typeof gameType !== 'string' || gameType.trim().length === 0) {
      pushHostIssue(issues, 'SCHEDULE_GAME_INVALID', '$.gameType', `gameType must be a non-empty string: ${String(gameType)}`);
      continue;
    }

    const officialDate = game.officialDate;
    if (typeof officialDate !== 'string' || !canonicalDate(officialDate)) {
      pushHostIssue(issues, 'SCHEDULE_GAME_INVALID', '$.officialDate', `officialDate must be YYYY-MM-DD: ${String(officialDate)}`);
      continue;
    }

    const startTimeUtc = game.startTimeUtc;
    let startDate: Date;
    if (startTimeUtc instanceof Date) {
      startDate = startTimeUtc;
    } else if (typeof startTimeUtc === 'string') {
      startDate = new Date(startTimeUtc);
    } else {
      pushHostIssue(issues, 'SCHEDULE_GAME_INVALID', '$.startTimeUtc', `startTimeUtc must be a Date or ISO string: ${String(startTimeUtc)}`);
      continue;
    }

    if (!isValidDate(startDate)) {
      pushHostIssue(issues, 'SCHEDULE_GAME_INVALID', '$.startTimeUtc', `startTimeUtc is not a valid Date: ${String(startTimeUtc)}`);
      continue;
    }

    const status = game.status;
    if (!isKnownStatus(status)) {
      pushHostIssue(issues, 'SCHEDULE_GAME_INVALID', '$.status', `Unknown status: ${String(status)}`);
      continue;
    }

    projected.push({
      gamePk,
      gameType,
      officialDate,
      startTimeUtc: startDate,
      status,
    });
  }

  if (issues.length > 0) {
    throw issues;
  }

  return projected;
}

/* -------------------------------------------------------------------------- */
/*  Core host logic                                                           */
/* -------------------------------------------------------------------------- */

export interface MLBProspectiveHoldoutSmokePreflightDependencies {
  readonly now?: () => Date;
  readonly provider: {
    fetchSchedule(date: string): Promise<unknown>;
  };
  readonly repositoryRoot?: string;
}

export async function runMLBProspectiveHoldoutSmokePreflight(
  argv: readonly string[],
  deps: MLBProspectiveHoldoutSmokePreflightDependencies = {
    now: () => new Date(),
    provider: {
      fetchSchedule: async (date: string): Promise<unknown> => {
        const { MLBResearchDataAdapter } = await import('@/lib/research-data/mlb/provider');
        const adapter = new MLBResearchDataAdapter();
        return adapter.fetchSchedule(date);
      },
    },
  },
): Promise<HostResult> {
  // 1. Validate argv
  if (argv.length !== 0) {
    return {
      ok: false,
      error: {
        kind: 'INVALID_ARGUMENTS',
        issues: sortHostIssues([
          {
            code: 'INVALID_ARGUMENTS',
            path: '$',
            message: 'This command accepts zero positional arguments',
          },
        ]),
      },
    };
  }

  // 2. L3 progress authority
  const repositoryRoot = deps.repositoryRoot ?? deriveRepositoryRoot();
  const progressDeps = {
    readActivation: async (root: string) => {
      const { readMLBProspectiveHoldoutActivation } = await import('@/prediction/mlb/mlb-prospective-holdout-activation-store');
      return readMLBProspectiveHoldoutActivation(root);
    },
    discoverArtifacts: async (root: string, activation: unknown) => {
      const { discoverMLBProspectiveHoldoutArtifacts } = await import('@/prediction/mlb/mlb-prospective-holdout-artifact-discovery');
      return discoverMLBProspectiveHoldoutArtifacts(root, activation);
    },
    repositoryRoot,
  };

  const progressResult = await runMLBProspectiveHoldoutProgress([], progressDeps);
  if (!progressResult.ok) {
    const error = progressResult.error;
    const mappedIssues: HostErrorIssue[] = error.issues.map((issue) => ({
      code: issue.code,
      path: issue.path,
      message: issue.message,
    }));
    return {
      ok: false,
      error: {
        kind: error.kind,
        issues: sortHostIssues(mappedIssues),
      },
    };
  }

  const report = progressResult.report;

  // 3. Pure first-smoke state validation (before clock/network)
  const stateError = validateMLBProspectiveHoldoutFirstSmokeState(report);
  if (stateError) {
    const mappedIssues: HostErrorIssue[] = stateError.issues.map((issue) => ({
      code: issue.code,
      path: issue.path,
      message: issue.message,
    }));
    return {
      ok: false,
      error: {
        kind: stateError.kind,
        issues: sortHostIssues(mappedIssues),
      },
    };
  }

  // 4. Sample clock exactly once
  const nowFn = deps.now ?? (() => new Date());
  const trustedNow = nowFn();
  if (!isValidDate(trustedNow)) {
    return {
      ok: false,
      error: {
        kind: 'SCHEDULE_STATE_INVALID',
        issues: sortHostIssues([
          {
            code: 'INVALID_TRUSTED_NOW',
            path: '$.trustedNow',
            message: 'trustedNow is not a valid Date',
          },
        ]),
      },
    };
  }

  // 5. Derive scan window
  const scanStart = trustedNow.toISOString().slice(0, 10);
  const scanEnd = report.validationBoundaryOfficialDate;

  if (scanStart.slice(0, 4) !== scanEnd.slice(0, 4)) {
    return {
      ok: false,
      error: {
        kind: 'NO_ELIGIBLE_SMOKE_GAME',
        issues: sortHostIssues([
          {
            code: 'YEAR_MISMATCH',
            path: '$.validationBoundaryOfficialDate',
            message: `trustedNow year ${scanStart.slice(0, 4)} does not match boundary year ${scanEnd.slice(0, 4)}`,
          },
        ]),
      },
    };
  }

  if (scanStart > scanEnd) {
    return {
      ok: false,
      error: {
        kind: 'NO_ELIGIBLE_SMOKE_GAME',
        issues: sortHostIssues([
          {
            code: 'EMPTY_WINDOW',
            path: '$.validationBoundaryOfficialDate',
            message: `scanStart ${scanStart} is after validationBoundaryOfficialDate ${scanEnd}`,
          },
        ]),
      },
    };
  }

  // 6. Enumerate authorized validation dates
  const fetchDates: string[] = [];
  const cursor = new Date(`${scanStart}T00:00:00Z`);
  const endDate = new Date(`${scanEnd}T00:00:00Z`);
  while (cursor <= endDate) {
    fetchDates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // 7. Fetch + runtime validate each date
  const combined: MLBProspectiveHoldoutSmokeScheduleGame[] = [];
  const seenGamePks = new Set<number>();

  for (const requestedDate of fetchDates) {
    let result: unknown;
    try {
      result = await deps.provider.fetchSchedule(requestedDate);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown provider failure';
      return {
        ok: false,
        error: {
          kind: 'SCHEDULE_FETCH_FAILURE',
          issues: sortHostIssues([
            {
              code: 'SCHEDULE_FETCH_FAILURE',
              path: `$.provider.fetchSchedule(${requestedDate})`,
              message,
            },
          ]),
        },
      };
    }

    let projected: MLBProspectiveHoldoutSmokeScheduleGame[];
    try {
      projected = validateProviderScheduleResult(result);
    } catch (rowIssues) {
      if (!isHostErrorIssueArray(rowIssues)) {
        throw rowIssues;
      }
      const mappedIssues: HostErrorIssue[] = rowIssues.map((issue) => ({
        code: issue.code,
        path: issue.path,
        message: issue.message,
      }));
      return {
        ok: false,
        error: {
          kind: 'SCHEDULE_STATE_INVALID',
          issues: sortHostIssues(mappedIssues),
        },
      };
    }

    for (const game of projected) {
      if (game.officialDate !== requestedDate) {
        return {
          ok: false,
          error: {
            kind: 'SCHEDULE_STATE_INVALID',
            issues: sortHostIssues([
              {
                code: 'REQUESTED_DATE_MISMATCH',
                path: `$.games[${game.gamePk}].officialDate`,
                message: `Requested ${requestedDate}, got ${game.officialDate}`,
              },
            ]),
          },
        };
      }

      if (seenGamePks.has(game.gamePk)) {
        return {
          ok: false,
          error: {
            kind: 'SCHEDULE_STATE_INVALID',
            issues: sortHostIssues([
              {
                code: 'DUPLICATE_GAMEPK',
                path: `$.games[${game.gamePk}].gamePk`,
                message: `Duplicate gamePk ${game.gamePk} across acquired window`,
              },
            ]),
          },
        };
      }

      seenGamePks.add(game.gamePk);
      combined.push(game);
    }
  }

  // 8. Pure selection with same trustedNow
  const selection = buildMLBProspectiveHoldoutSmokePreflight({
    progressReport: report,
    scheduleGames: combined,
    trustedNow,
  });

  if (!('contractVersion' in selection)) {
    const pureError = selection;
    const mappedIssues: HostErrorIssue[] = pureError.issues.map((issue) => ({
      code: issue.code,
      path: issue.path,
      message: issue.message,
    }));
    return {
      ok: false,
      error: {
        kind: pureError.kind,
        issues: sortHostIssues(mappedIssues),
      },
    };
  }

  return { ok: true, report: selection };
}

/* -------------------------------------------------------------------------- */
/*  CLI argument parsing                                                     */
/* -------------------------------------------------------------------------- */

interface CLIIO {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
}

export async function runMLBProspectiveHoldoutSmokePreflightCLI(
  argv: readonly string[],
  io?: CLIIO,
  deps?: Parameters<typeof runMLBProspectiveHoldoutSmokePreflight>[1],
): Promise<number> {
  const stdout = io?.stdout ?? ((message: string) => process.stdout.write(`${message}\n`));
  const stderr = io?.stderr ?? ((message: string) => process.stderr.write(`${message}\n`));

  const result = await runMLBProspectiveHoldoutSmokePreflight(argv.slice(2), deps);
  if (result.ok) {
    stdout(JSON.stringify(result.report));
    return 0;
  }

  stderr(JSON.stringify(result.error));
  return 1;
}

/* -------------------------------------------------------------------------- */
/*  main                                                                      */
/* -------------------------------------------------------------------------- */

function isDirectExecution(): boolean {
  const entryPoint = process.argv[1];
  if (!entryPoint) {
    return false;
  }
  try {
    const thisFile = fileURLToPath(import.meta.url);
    return realpathSync(thisFile) === realpathSync(entryPoint);
  } catch {
    return false;
  }
}

if (isDirectExecution()) {
  (async () => {
    process.exitCode = await runMLBProspectiveHoldoutSmokePreflightCLI(process.argv.slice(2));
  })();
}
