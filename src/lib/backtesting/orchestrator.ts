import type {
  BacktestRunnerResult,
  HistoricalMLBGame,
  MLBHistoricalDataProvider,
} from './types';
import type { RunnerContext } from './runner';
import { runHistoricalBacktest } from './runner';

/* ------------------------------------------------------------------ */
/*  Domain types                                                       */
/* ------------------------------------------------------------------ */

export interface HistoricalBacktestDateRange {
  readonly startDate: string;
  readonly endDate: string;
}

export interface HistoricalBacktestOrchestrationContext
  extends RunnerContext {
  readonly provider: MLBHistoricalDataProvider;
}

export interface HistoricalBacktestOrchestratorDependencies {
  readonly runBacktest?: typeof runHistoricalBacktest;
}

export interface HistoricalBacktestOrchestrationResult {
  readonly dateRange: HistoricalBacktestDateRange;
  readonly requestedDates: readonly string[];
  readonly scheduleRequests: number;
  readonly discoveredGames: number;
  readonly uniqueGames: number;
  readonly duplicateGamesRemoved: number;
  readonly firstGameStart: Date | null;
  readonly lastGameStart: Date | null;
  readonly games: readonly HistoricalMLBGame[];
  readonly runnerResult: BacktestRunnerResult;
}

export class HistoricalBacktestOrchestrationError extends Error {
  readonly operation: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly failedDate?: string;
  readonly cause?: unknown;

  constructor(params: {
    readonly operation: string;
    readonly message: string;
    readonly startDate?: string;
    readonly endDate?: string;
    readonly failedDate?: string;
    readonly cause?: unknown;
  }) {
    super(params.message);
    this.operation = params.operation;
    this.startDate = params.startDate;
    this.endDate = params.endDate;
    this.failedDate = params.failedDate;
    this.cause = params.cause;
  }
}

/* ------------------------------------------------------------------ */
/*  UTC date expansion                                                 */
/* ------------------------------------------------------------------ */

const MAX_DATE_RANGE_DAYS = 366;
const DATE_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidCalendarDate(dateString: string): boolean {
  const match = DATE_FORMAT.exec(dateString);
  if (!match) return false;

  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (year === 0) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const reconstructed = new Date(`${dateString}T00:00:00Z`);
  return (
    reconstructed.getUTCFullYear() === year &&
    reconstructed.getUTCMonth() === month - 1 &&
    reconstructed.getUTCDate() === day
  );
}

function expandToUtcDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const current = new Date(start);

  while (current.getTime() <= end.getTime()) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

function validateDateRange(range: HistoricalBacktestDateRange): string[] {
  if (!DATE_FORMAT.test(range.startDate)) {
    throw new HistoricalBacktestOrchestrationError({
      operation: 'validateDateRange',
      message: `Invalid startDate format: ${range.startDate}`,
      startDate: range.startDate,
    });
  }
  if (!DATE_FORMAT.test(range.endDate)) {
    throw new HistoricalBacktestOrchestrationError({
      operation: 'validateDateRange',
      message: `Invalid endDate format: ${range.endDate}`,
      endDate: range.endDate,
    });
  }

  if (!isValidCalendarDate(range.startDate)) {
    throw new HistoricalBacktestOrchestrationError({
      operation: 'validateDateRange',
      message: `Invalid startDate calendar value: ${range.startDate}`,
      startDate: range.startDate,
    });
  }
  if (!isValidCalendarDate(range.endDate)) {
    throw new HistoricalBacktestOrchestrationError({
      operation: 'validateDateRange',
      message: `Invalid endDate calendar value: ${range.endDate}`,
      endDate: range.endDate,
    });
  }

  const start = new Date(`${range.startDate}T00:00:00Z`);
  const end = new Date(`${range.endDate}T00:00:00Z`);

  if (start.getTime() > end.getTime()) {
    throw new HistoricalBacktestOrchestrationError({
      operation: 'validateDateRange',
      message: `startDate (${range.startDate}) must not be after endDate (${range.endDate})`,
      startDate: range.startDate,
      endDate: range.endDate,
    });
  }

  const requestedDates = expandToUtcDates(range.startDate, range.endDate);

  if (requestedDates.length > MAX_DATE_RANGE_DAYS) {
    throw new HistoricalBacktestOrchestrationError({
      operation: 'validateDateRange',
      message: `Date range exceeds maximum of ${MAX_DATE_RANGE_DAYS} days`,
      startDate: range.startDate,
      endDate: range.endDate,
    });
  }

  return requestedDates;
}

/* ------------------------------------------------------------------ */
/*  Deduplication and sorting                                          */
/* ------------------------------------------------------------------ */

function deduplicateGames(
  games: HistoricalMLBGame[],
): { unique: HistoricalMLBGame[]; duplicateCount: number } {
  const map = new Map<number, HistoricalMLBGame>();
  let duplicateCount = 0;

  for (const game of games) {
    const existing = map.get(game.gamePk);
    if (existing === undefined) {
      map.set(game.gamePk, game);
    } else {
      duplicateCount += 1;
      map.set(game.gamePk, game);
    }
  }

  return { unique: [...map.values()], duplicateCount };
}

function sortGames(games: HistoricalMLBGame[]): HistoricalMLBGame[] {
  return [...games].sort((a, b) => {
    const startDiff = a.gameDate.getTime() - b.gameDate.getTime();
    if (startDiff !== 0) return startDiff;
    return a.gamePk - b.gamePk;
  });
}

/* ------------------------------------------------------------------ */
/*  Orchestrator                                                       */
/* ------------------------------------------------------------------ */

export async function orchestrateHistoricalBacktest(
  range: HistoricalBacktestDateRange,
  context: HistoricalBacktestOrchestrationContext,
  dependencies: HistoricalBacktestOrchestratorDependencies = {},
): Promise<HistoricalBacktestOrchestrationResult> {
  const requestedDates = validateDateRange(range);
  const frozenRequestedDates = Object.freeze([...requestedDates]);

  const allGames: HistoricalMLBGame[] = [];
  let failedDate: string | undefined;

  for (const date of requestedDates) {
    try {
      const games = await context.provider.fetchGamesForDate(date);
      allGames.push(...games);
    } catch (error) {
      failedDate = date;
      throw new HistoricalBacktestOrchestrationError({
        operation: 'fetchSchedule',
        message: `Schedule request failed for ${date}`,
        startDate: range.startDate,
        endDate: range.endDate,
        failedDate: date,
        cause: error,
      });
    }
  }

  const { unique: uniqueGames, duplicateCount } = deduplicateGames(allGames);
  const orderedGames = sortGames(uniqueGames);
  const frozenGames = Object.freeze([...orderedGames]);

  const firstGameStart =
    frozenGames.length > 0 ? frozenGames[0].gameDate : null;
  const lastGameStart =
    frozenGames.length > 0
      ? frozenGames[frozenGames.length - 1].gameDate
      : null;

  const runBacktest =
    dependencies.runBacktest ?? runHistoricalBacktest;

  const runnerResult = await runBacktest(orderedGames, context);

  const result: HistoricalBacktestOrchestrationResult = {
    dateRange: range,
    requestedDates: frozenRequestedDates,
    scheduleRequests: requestedDates.length,
    discoveredGames: allGames.length,
    uniqueGames: uniqueGames.length,
    duplicateGamesRemoved: duplicateCount,
    firstGameStart,
    lastGameStart,
    games: frozenGames,
    runnerResult,
  };

  return Object.freeze(result);
}
