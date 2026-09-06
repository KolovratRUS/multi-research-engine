#!/usr/bin/env tsx
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { MLBResearchDataAdapter } from '@/lib/research-data/mlb/provider';
import type { MLBGameResearchSnapshot, MLBScheduleGame, MLBScheduleResult } from '@/lib/research-data/types';
import {
  type MLBProspectiveHoldoutCaptureClock,
  type MLBProspectiveHoldoutCaptureSnapshotBuilder,
  runProspectiveHoldoutCaptureOrchestrator,
  type MLBProspectiveHoldoutCaptureOrchestratorResult,
} from '@/prediction/mlb/mlb-prospective-holdout-capture-orchestrator';
import { buildMLBRealDataPregameSnapshot } from '@/prediction/mlb/mlb-real-data-pregame-snapshot-bridge';

/* -------------------------------------------------------------------------- */
/*  Errors                                                                    */
/* -------------------------------------------------------------------------- */

class ValidationError extends Error {
  readonly kind = 'VALIDATION' as const;
  constructor(message: string) {
    super(message);
  }
}

class ScheduleNotFoundError extends Error {
  readonly kind = 'SCHEDULE_NOT_FOUND' as const;
  readonly gamePk: number;
  constructor(gamePk: number) {
    super(`Schedule game ${gamePk} not found`);
    this.gamePk = gamePk;
  }
}

class ScheduleDuplicateError extends Error {
  readonly kind = 'SCHEDULE_DUPLICATE' as const;
  readonly gamePk: number;
  constructor(gamePk: number) {
    super(`Schedule game ${gamePk} is not unique`);
    this.gamePk = gamePk;
  }
}

/* -------------------------------------------------------------------------- */
/*  Dependencies                                                              */
/* -------------------------------------------------------------------------- */

export interface MLBProspectiveHoldoutCaptureDependencies {
  readonly repositoryRoot?: string;
  readonly provider: {
    fetchSchedule(date: string): Promise<MLBScheduleResult>;
    buildGameSnapshot(
      game: MLBScheduleGame,
      options: { season: number; includeWeather: boolean },
    ): Promise<MLBGameResearchSnapshot>;
  };
  readonly orchestrator: typeof runProspectiveHoldoutCaptureOrchestrator;
  readonly now: () => Date;
}

/* -------------------------------------------------------------------------- */
/*  CLI argument parsing                                                     */
/* -------------------------------------------------------------------------- */

function parseGamePk(argv: string[]): number {
  let gamePk: number | undefined;

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];

    if (argument.startsWith('--gamePk=')) {
      const value = argument.slice('--gamePk='.length);
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new ValidationError('gamePk must be a positive integer');
      }
      if (gamePk !== undefined) {
        throw new ValidationError('Multiple gamePk values are not allowed');
      }
      gamePk = parsed;
      continue;
    }

    if (argument === '--gamePk') {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('-')) {
        throw new ValidationError('--gamePk requires a value');
      }
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new ValidationError('gamePk must be a positive integer');
      }
      if (gamePk !== undefined) {
        throw new ValidationError('Multiple gamePk values are not allowed');
      }
      gamePk = parsed;
      index += 1;
      continue;
    }

    throw new ValidationError(`Unsupported flag: ${argument}`);
  }

  if (gamePk === undefined) {
    throw new ValidationError('--gamePk is required');
  }

  return gamePk;
}

/* -------------------------------------------------------------------------- */
/*  Core adapter                                                              */
/* -------------------------------------------------------------------------- */

export async function runProspectiveHoldoutCapture(
  gamePk: number,
  deps: MLBProspectiveHoldoutCaptureDependencies,
): Promise<MLBProspectiveHoldoutCaptureOrchestratorResult> {
  const now = deps.now();
  const today = now.toISOString().slice(0, 10);
  const yesterdayDate = new Date(now);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);

  const [todayResult, yesterdayResult] = await Promise.all([
    deps.provider.fetchSchedule(today),
    deps.provider.fetchSchedule(yesterday),
  ]);

  const matches = [
    ...todayResult.games,
    ...yesterdayResult.games,
  ].filter((game) => game.gamePk === gamePk);

  if (matches.length === 0) {
    throw new ScheduleNotFoundError(gamePk);
  }

  if (matches.length > 1) {
    throw new ScheduleDuplicateError(gamePk);
  }

  return runProspectiveHoldoutCaptureForScheduleGame(matches[0], deps);
}

/* -------------------------------------------------------------------------- */
/*  Shared capture application seam                                           */
/* -------------------------------------------------------------------------- */

export async function runProspectiveHoldoutCaptureForScheduleGame(
  scheduleGame: MLBScheduleGame,
  deps: MLBProspectiveHoldoutCaptureDependencies,
): Promise<MLBProspectiveHoldoutCaptureOrchestratorResult> {
  const researchSnapshot = await deps.provider.buildGameSnapshot(scheduleGame, {
    season: scheduleGame.startTimeUtc.getUTCFullYear(),
    includeWeather: false,
  });

  const bridgeResult = buildMLBRealDataPregameSnapshot({
    scheduleGame,
    researchSnapshot,
  });

  if (!bridgeResult.ok) {
    throw new Error(
      `Snapshot bridge failed: ${bridgeResult.issues.map((issue) => issue.code).join(', ')}`,
    );
  }

  const snapshotBuilder: MLBProspectiveHoldoutCaptureSnapshotBuilder = () => bridgeResult.value;

  const clock: MLBProspectiveHoldoutCaptureClock = {
    now: deps.now,
  };

  return deps.orchestrator({
    repositoryRoot: deps.repositoryRoot ?? resolve(__dirname, '..'),
    scheduleGame,
    clock,
    snapshotBuilder,
  });
}

/* -------------------------------------------------------------------------- */
/*  CLI entrypoint                                                            */
/* -------------------------------------------------------------------------- */

export interface CaptureCLIIO {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
}

export async function runMLBProspectiveHoldoutCaptureCLI(
  argv: readonly string[],
  io?: CaptureCLIIO,
  deps?: MLBProspectiveHoldoutCaptureDependencies,
): Promise<number> {
  const stdout = io?.stdout ?? ((message: string) => process.stdout.write(`${message}\n`));
  const stderr = io?.stderr ?? ((message: string) => process.stderr.write(`${message}\n`));

  const provider =
    deps?.provider ?? new MLBResearchDataAdapter();
  const now = deps?.now ?? (() => new Date());
  const orchestrator = deps?.orchestrator ?? runProspectiveHoldoutCaptureOrchestrator;

  let gamePk: number;
  try {
    gamePk = parseGamePk(argv.slice(2));
  } catch (error) {
    if (error instanceof Error) {
      stderr(`Error: ${error.message}`);
    } else {
      stderr('Error: invalid arguments');
    }
    return 1;
  }

  try {
    const result = await runProspectiveHoldoutCapture(gamePk, {
      repositoryRoot: deps?.repositoryRoot,
      provider,
      orchestrator,
      now,
    });
    stdout(JSON.stringify(result));
    return 0;
  } catch (error) {
    if (error instanceof Error) {
      stderr(`Error: ${error.message}`);
    } else {
      stderr('Error: unexpected failure');
    }
    return 1;
  }
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
    const thisFile = realpathSync(fileURLToPath(import.meta.url));
    const resolvedEntry = realpathSync(entryPoint);
    return thisFile === resolvedEntry;
  } catch {
    return false;
  }
}

if (isDirectExecution()) {
  (async () => {
    process.exitCode = await runMLBProspectiveHoldoutCaptureCLI(process.argv);
  })();
}
