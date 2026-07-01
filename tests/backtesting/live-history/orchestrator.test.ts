import { describe, it, expect, vi } from 'vitest';
import type {
  HistoricalMLBGame,
  MLBHistoricalDataProvider,
  BacktestRunnerResult,
  BacktestPrediction,
} from '@/lib/backtesting/types';
import type { RunnerContext } from '@/lib/backtesting/runner';
import { runHistoricalBacktest } from '@/lib/backtesting/runner';
import {
  orchestrateHistoricalBacktest,
  HistoricalBacktestOrchestrationError,
} from '@/lib/backtesting/orchestrator';

/* ------------------------------------------------------------------ */
/*  Test data                                                         */
/* ------------------------------------------------------------------ */

const HOME_A = 1;
const AWAY_A = 2;
const HOME_B = 3;
const AWAY_B = 4;

function makeGame(
  overrides: Partial<HistoricalMLBGame> & Pick<HistoricalMLBGame, 'gamePk' | 'gameDate'>,
): HistoricalMLBGame {
  return {
    officialDate: '2024-06-01',
    homeTeamId: HOME_A,
    awayTeamId: AWAY_A,
    homeTeamName: 'Home',
    awayTeamName: 'Away',
    venueId: 1,
    status: 'FINAL',
    probablePitchers: null,
    cutoff: {
      eventId: String(overrides.gamePk),
      cutoffTime: new Date('2024-06-01T14:00:00Z'),
    },
    ...overrides,
  };
}

function makeMockProvider(
  behavior: {
    readonly gamesByDate?: Record<string, readonly HistoricalMLBGame[]>;
    readonly callOrder?: string[];
    readonly failOnDate?: string;
    readonly failError?: Error;
  } = {},
): MLBHistoricalDataProvider {
  const { gamesByDate = {}, callOrder = [], failOnDate, failError } = behavior;

  return {
    fetchGamesForDate: async (date: string) => {
      callOrder.push(date);
      if (failOnDate === date) {
        throw failError ?? new Error(`schedule failed for ${date}`);
      }
      return [...(gamesByDate[date] ?? [])];
    },
    fetchGameOutcome: async () => ({
      gamePk: 0,
      homeScore: 0,
      awayScore: 0,
      winner: null,
      innings: null,
      status: 'FINAL',
      linescore: null,
    }),
    fetchPitcherStatsAsOf: async () => null,
    fetchTeamStatsAsOf: async () => null,
    fetchRecentGamesBefore: async () => [],
  };
}

function makeMockContext(
  provider: MLBHistoricalDataProvider,
  overrides: Partial<RunnerContext> = {},
): RunnerContext & { readonly provider: MLBHistoricalDataProvider } {
  return {
    provider,
    deterministicTime: new Date('2024-07-01T00:00:00Z'),
    featureVersion: 'test',
    modelVersion: 'test',
    naiveBaselineContext: { recentWinRates: {}, seasonWinRates: {} },
    ...overrides,
  };
}

function makeMockRunnerResult(): BacktestRunnerResult {
  return {
    predictions: [],
    abstentions: [],
    metrics: {
      predictionsMade: 0,
      gamesSkipped: 0,
      voids: 0,
      accuracy: 0,
      homePickRate: 0,
      awayPickRate: 0,
      accuracyByConfidenceBucket: {},
      accuracyByDataQualityBucket: {},
      accuracyByVolatilityBucket: {},
      accuracyWithBothPitchersKnown: null,
      accuracyWithMissingPitcher: null,
      accuracyByMonth: {},
      naiveHomeBaseline: null,
      naiveRecentBaseline: null,
      naiveSeasonBaseline: null,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Date validation                                                    */
/* ------------------------------------------------------------------ */

describe('orchestrator: date validation', () => {
  const validProvider = makeMockProvider();

  it('accepts a one-day range where start equals end', async () => {
    const result = await orchestrateHistoricalBacktest(
      { startDate: '2024-06-01', endDate: '2024-06-01' },
      makeMockContext(validProvider),
    );
    expect(result.requestedDates).toEqual(['2024-06-01']);
  });

  it('accepts an inclusive multi-day range', async () => {
    const result = await orchestrateHistoricalBacktest(
      { startDate: '2024-06-01', endDate: '2024-06-03' },
      makeMockContext(validProvider),
    );
    expect(result.requestedDates).toEqual([
      '2024-06-01',
      '2024-06-02',
      '2024-06-03',
    ]);
  });

  it('rejects an invalid startDate format', async () => {
    await expect(
      orchestrateHistoricalBacktest(
        { startDate: '2024-06-01abc', endDate: '2024-06-01' },
        makeMockContext(validProvider),
      ),
    ).rejects.toBeInstanceOf(HistoricalBacktestOrchestrationError);
  });

  it('rejects an invalid endDate format', async () => {
    await expect(
      orchestrateHistoricalBacktest(
        { startDate: '2024-06-01', endDate: 'not-a-date' },
        makeMockContext(validProvider),
      ),
    ).rejects.toBeInstanceOf(HistoricalBacktestOrchestrationError);
  });

  it('rejects an invalid calendar date', async () => {
    await expect(
      orchestrateHistoricalBacktest(
        { startDate: '2024-02-30', endDate: '2024-02-30' },
        makeMockContext(validProvider),
      ),
    ).rejects.toBeInstanceOf(HistoricalBacktestOrchestrationError);
  });

  it('rejects month 13', async () => {
    await expect(
      orchestrateHistoricalBacktest(
        { startDate: '2024-13-01', endDate: '2024-13-01' },
        makeMockContext(validProvider),
      ),
    ).rejects.toBeInstanceOf(HistoricalBacktestOrchestrationError);
  });

  it('accepts 1899-12-31', async () => {
    const result = await orchestrateHistoricalBacktest(
      { startDate: '1899-12-31', endDate: '1899-12-31' },
      makeMockContext(validProvider),
    );
    expect(result.requestedDates).toEqual(['1899-12-31']);
  });

  it('accepts 2101-01-01', async () => {
    const result = await orchestrateHistoricalBacktest(
      { startDate: '2101-01-01', endDate: '2101-01-01' },
      makeMockContext(validProvider),
    );
    expect(result.requestedDates).toEqual(['2101-01-01']);
  });

  it('rejects year 0000', async () => {
    await expect(
      orchestrateHistoricalBacktest(
        { startDate: '0000-01-01', endDate: '0000-01-01' },
        makeMockContext(validProvider),
      ),
    ).rejects.toBeInstanceOf(HistoricalBacktestOrchestrationError);
  });

  it('rejects invalid leap day 2025-02-29', async () => {
    await expect(
      orchestrateHistoricalBacktest(
        { startDate: '2025-02-29', endDate: '2025-02-29' },
        makeMockContext(validProvider),
      ),
    ).rejects.toBeInstanceOf(HistoricalBacktestOrchestrationError);
  });

  it('accepts valid leap day 2024-02-29', async () => {
    const result = await orchestrateHistoricalBacktest(
      { startDate: '2024-02-29', endDate: '2024-02-29' },
      makeMockContext(validProvider),
    );
    expect(result.requestedDates).toEqual(['2024-02-29']);
  });

  it('rejects startDate after endDate', async () => {
    await expect(
      orchestrateHistoricalBacktest(
        { startDate: '2024-06-10', endDate: '2024-06-01' },
        makeMockContext(validProvider),
      ),
    ).rejects.toBeInstanceOf(HistoricalBacktestOrchestrationError);
  });

  it('accepts a 366-day range', async () => {
    const result = await orchestrateHistoricalBacktest(
      { startDate: '2024-01-01', endDate: '2024-12-31' },
      makeMockContext(validProvider),
    );
    expect(result.requestedDates.length).toBe(366);
  });

  it('rejects a 367-day range', async () => {
    await expect(
      orchestrateHistoricalBacktest(
        { startDate: '2024-01-01', endDate: '2025-01-01' },
        makeMockContext(validProvider),
      ),
    ).rejects.toBeInstanceOf(HistoricalBacktestOrchestrationError);
  });
});

/* ------------------------------------------------------------------ */
/*  Schedule sequencing                                               */
/* ------------------------------------------------------------------ */

describe('orchestrator: schedule sequencing', () => {
  it('requests dates in ascending order', async () => {
    const callOrder: string[] = [];
    const provider = makeMockProvider({ callOrder });
    await orchestrateHistoricalBacktest(
      { startDate: '2024-06-01', endDate: '2024-06-03' },
      makeMockContext(provider),
    );
    expect(callOrder).toEqual(['2024-06-01', '2024-06-02', '2024-06-03']);
  });

  it('makes sequential calls, not concurrent', async () => {
    const inFlight: number[] = [];
    const maxConcurrent: { current: number } = { current: 0 };
    let observedMax = 0;

    const provider: MLBHistoricalDataProvider = {
      fetchGamesForDate: async (date: string) => {
        inFlight.push(Number(date.slice(-2)));
        maxConcurrent.current += 1;
        if (maxConcurrent.current > observedMax) {
          observedMax = maxConcurrent.current;
        }
        await Promise.resolve();
        maxConcurrent.current -= 1;
        inFlight.pop();
        return [makeGame({ gamePk: Number(date.slice(-2)), gameDate: new Date(date) })];
      },
      fetchGameOutcome: async () => ({ gamePk: 0, homeScore: 0, awayScore: 0, winner: null, innings: null, status: 'FINAL', linescore: null }),
      fetchPitcherStatsAsOf: async () => null,
      fetchTeamStatsAsOf: async () => null,
      fetchRecentGamesBefore: async () => [],
    };

    await orchestrateHistoricalBacktest(
      { startDate: '2024-06-01', endDate: '2024-06-03' },
      makeMockContext(provider),
    );
    expect(observedMax).toBe(1);
  });

  it('stops on failed second date and does not fetch the third', async () => {
    const callOrder: string[] = [];
    const provider = makeMockProvider({
      callOrder,
      failOnDate: '2024-06-02',
      failError: new Error('network down'),
    });

    await expect(
      orchestrateHistoricalBacktest(
        { startDate: '2024-06-01', endDate: '2024-06-03' },
        makeMockContext(provider),
      ),
    ).rejects.toThrow('Schedule request failed for 2024-06-02');

    expect(callOrder).toEqual(['2024-06-01', '2024-06-02']);
  });

  it('does not invoke runner after a schedule failure', async () => {
    let runnerCalled = false;
    const mockRunner = vi.fn(async () => {
      runnerCalled = true;
      return makeMockRunnerResult();
    });

    const provider = makeMockProvider({
      failOnDate: '2024-06-02',
      failError: new Error('network down'),
    });

    await expect(
      orchestrateHistoricalBacktest(
        { startDate: '2024-06-01', endDate: '2024-06-02' },
        makeMockContext(provider),
        { runBacktest: mockRunner },
      ),
    ).rejects.toThrow('Schedule request failed for 2024-06-02');

    expect(runnerCalled).toBe(false);
  });

  it('includes failed date and original cause in the error', async () => {
    const originalError = new Error('rate limited');
    const provider = makeMockProvider({
      failOnDate: '2024-06-02',
      failError: originalError,
    });

    try {
      await orchestrateHistoricalBacktest(
        { startDate: '2024-06-01', endDate: '2024-06-02' },
        makeMockContext(provider),
      );
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(HistoricalBacktestOrchestrationError);
      expect((error as HistoricalBacktestOrchestrationError).failedDate).toBe(
        '2024-06-02',
      );
      expect((error as HistoricalBacktestOrchestrationError).cause).toBe(
        originalError,
      );
      expect((error as HistoricalBacktestOrchestrationError).operation).toBe(
        'fetchSchedule',
      );
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Deduplication                                                      */
/* ------------------------------------------------------------------ */

describe('orchestrator: deduplication', () => {
  it('removes a repeated gamePk and keeps a single copy', async () => {
    const early = makeGame({ gamePk: 5001, gameDate: new Date('2024-06-01T16:00:00Z'), homeTeamName: 'Early' });
    const late = makeGame({ gamePk: 5001, gameDate: new Date('2024-06-02T16:00:00Z'), homeTeamName: 'Late' });
    const provider = makeMockProvider({
      gamesByDate: {
        '2024-06-01': [early],
        '2024-06-02': [late, late], // one duplicate within the same fetch, plus the later date
      },
    });

    const result = await orchestrateHistoricalBacktest(
      { startDate: '2024-06-01', endDate: '2024-06-02' },
      makeMockContext(provider),
    );

    expect(result.discoveredGames).toBe(3);
    expect(result.uniqueGames).toBe(1);
    expect(result.duplicateGamesRemoved).toBe(2);
    expect(result.games).toHaveLength(1);
    // Later fetch replaces earlier
    expect(result.games[0].homeTeamName).toBe('Late');
  });

  it('preserves doubleheader games with different gamePk values', async () => {
    const game1 = makeGame({ gamePk: 6001, gameDate: new Date('2024-06-01T16:00:00Z') });
    const game2 = makeGame({ gamePk: 6002, gameDate: new Date('2024-06-01T21:00:00Z') });
    const provider = makeMockProvider({
      gamesByDate: {
        '2024-06-01': [game1, game2],
      },
    });

    const result = await orchestrateHistoricalBacktest(
      { startDate: '2024-06-01', endDate: '2024-06-01' },
      makeMockContext(provider),
    );

    expect(result.games).toHaveLength(2);
    expect(result.games.map((g) => g.gamePk)).toEqual([6001, 6002]);
  });
});

/* ------------------------------------------------------------------ */
/*  Sorting                                                            */
/* ------------------------------------------------------------------ */

describe('orchestrator: sorting', () => {
  it('sorts games by gameDate ascending with gamePk tie-break', async () => {
    const game1 = makeGame({ gamePk: 9002, gameDate: new Date('2024-06-02T16:00:00Z') });
    const game2 = makeGame({ gamePk: 9001, gameDate: new Date('2024-06-01T16:00:00Z') });
    const game3 = makeGame({ gamePk: 9003, gameDate: new Date('2024-06-01T21:00:00Z') });
    const provider = makeMockProvider({
      gamesByDate: {
        '2024-06-01': [game1, game2],
        '2024-06-02': [game3],
      },
    });

    const result = await orchestrateHistoricalBacktest(
      { startDate: '2024-06-01', endDate: '2024-06-02' },
      makeMockContext(provider),
    );

    expect(result.games.map((g) => g.gamePk)).toEqual([9001, 9003, 9002]);
  });

  it('does not mutate the provider-returned array', async () => {
    const game = makeGame({ gamePk: 8001, gameDate: new Date('2024-06-01T16:00:00Z') });
    const providerArray = [game];
    const provider = makeMockProvider({
      gamesByDate: { '2024-06-01': providerArray },
    });

    await orchestrateHistoricalBacktest(
      { startDate: '2024-06-01', endDate: '2024-06-01' },
      makeMockContext(provider),
    );

    expect(providerArray).toHaveLength(1);
  });

  it('does not mutate the input game objects', async () => {
    const game = makeGame({ gamePk: 8002, gameDate: new Date('2024-06-01T16:00:00Z') });
    const provider = makeMockProvider({
      gamesByDate: { '2024-06-01': [game] },
    });

    const originalGameDate = new Date(game.gameDate);
    await orchestrateHistoricalBacktest(
      { startDate: '2024-06-01', endDate: '2024-06-01' },
      makeMockContext(provider),
    );

    expect(game.gameDate.getTime()).toBe(originalGameDate.getTime());
  });
});

/* ------------------------------------------------------------------ */
/*  Runner invocation                                                  */
/* ------------------------------------------------------------------ */

describe('orchestrator: runner invocation', () => {
  it('calls the runner exactly once', async () => {
    const runnerCalls: number[] = [];
    const mockRunner = vi.fn(async () => {
      runnerCalls.push(1);
      return makeMockRunnerResult();
    });

    const provider = makeMockProvider({
      gamesByDate: {
        '2024-06-01': [
          makeGame({ gamePk: 7001, gameDate: new Date('2024-06-01T16:00:00Z') }),
        ],
      },
    });

    await orchestrateHistoricalBacktest(
      { startDate: '2024-06-01', endDate: '2024-06-01' },
      makeMockContext(provider),
      { runBacktest: mockRunner },
    );

    expect(mockRunner).toHaveBeenCalledTimes(1);
    expect(mockRunner).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ gamePk: 7001 })]),
      expect.anything(),
    );
  });

  it('preserves optional runner callbacks', async () => {
    const snapshots: string[] = [];
    const predictions: string[] = [];

    const mockRunner = vi.fn(async (games: HistoricalMLBGame[], ctx: RunnerContext) => {
      ctx.onSnapshotBuilt?.(games[0]);
      ctx.onPredictionCreated?.({
        eventId: games[0].cutoff.eventId,
        gamePk: games[0].gamePk,
        eventDate: games[0].officialDate,
        homeTeamId: games[0].homeTeamId,
        awayTeamId: games[0].awayTeamId,
        homeTeam: games[0].homeTeamName,
        awayTeam: games[0].awayTeamName,
        predictedSide: 'HOME',
        researchStrengthScore: 50,
        confidence: 60,
        dataQuality: 70,
        volatility: 'MEDIUM',
        componentScores: {},
        warnings: [],
        modelVersion: ctx.modelVersion,
        featureVersion: ctx.featureVersion,
        generatedAt: ctx.deterministicTime,
        historicalCutoffTime: games[0].cutoff.cutoffTime,
        actualWinner: null,
        correct: null,
        voided: false,
        abstained: true,
        abstentionReason: 'BOTH_PITCHERS_UNAVAILABLE',
        homePitcherAvailable: false,
        awayPitcherAvailable: false,
      } as any);
      return makeMockRunnerResult();
    });

    const provider = makeMockProvider({
      gamesByDate: {
        '2024-06-01': [
          makeGame({ gamePk: 7002, gameDate: new Date('2024-06-01T16:00:00Z') }),
        ],
      },
    });

    await orchestrateHistoricalBacktest(
      { startDate: '2024-06-01', endDate: '2024-06-01' },
      {
        ...makeMockContext(provider, {
          onSnapshotBuilt: (game: HistoricalMLBGame) => snapshots.push(`snapshot-${game.gamePk}`),
          onPredictionCreated: (prediction: Readonly<BacktestPrediction>) => predictions.push(`prediction-${prediction.gamePk}`),
        }),
      },
      { runBacktest: mockRunner },
    );

    expect(snapshots).toEqual(['snapshot-7002']);
    expect(predictions).toEqual(['prediction-7002']);
  });

  it('does not call provider outcome, team, pitcher, or recent-game methods during orchestration', async () => {
    const calls: string[] = [];
    const provider: MLBHistoricalDataProvider = {
      fetchGamesForDate: async (date: string) => {
        calls.push(`schedule-${date}`);
        return [makeGame({ gamePk: 7003, gameDate: new Date(`${date}T16:00:00Z`) })];
      },
      fetchGameOutcome: async () => {
        calls.push('outcome');
        return { gamePk: 0, homeScore: 0, awayScore: 0, winner: null, innings: null, status: 'FINAL', linescore: null };
      },
      fetchPitcherStatsAsOf: async () => {
        calls.push('pitcher');
        return null;
      },
      fetchTeamStatsAsOf: async () => {
        calls.push('team');
        return null;
      },
      fetchRecentGamesBefore: async () => {
        calls.push('recent');
        return [];
      },
    };

    const mockRunner = vi.fn(async () => makeMockRunnerResult());

    await orchestrateHistoricalBacktest(
      { startDate: '2024-06-01', endDate: '2024-06-01' },
      makeMockContext(provider),
      { runBacktest: mockRunner },
    );

    expect(calls).toEqual(['schedule-2024-06-01']);
  });
});

/* ------------------------------------------------------------------ */
/*  Empty schedule                                                     */
/* ------------------------------------------------------------------ */

describe('orchestrator: empty schedule', () => {
  it('invokes the runner once with an empty game array', async () => {
    const runnerCalls: HistoricalMLBGame[][] = [];
    const mockRunner = vi.fn(async (games: HistoricalMLBGame[]) => {
      runnerCalls.push(games);
      return makeMockRunnerResult();
    });

    const provider = makeMockProvider();

    const result = await orchestrateHistoricalBacktest(
      { startDate: '2024-06-01', endDate: '2024-06-01' },
      makeMockContext(provider),
      { runBacktest: mockRunner },
    );

    expect(mockRunner).toHaveBeenCalledTimes(1);
    expect(runnerCalls[0]).toEqual([]);
    expect(result.games).toEqual([]);
    expect(result.runnerResult).toEqual(makeMockRunnerResult());
  });
});

/* ------------------------------------------------------------------ */
/*  Immutability                                                       */
/* ------------------------------------------------------------------ */

describe('orchestrator: immutability', () => {
  it('returns a frozen top-level result with frozen arrays', async () => {
    const provider = makeMockProvider();
    const result = await orchestrateHistoricalBacktest(
      { startDate: '2024-06-01', endDate: '2024-06-01' },
      makeMockContext(provider),
    );

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.requestedDates)).toBe(true);
    expect(Object.isFrozen(result.games)).toBe(true);
  });

  it('does not mutate provider-returned arrays', async () => {
    const game = makeGame({ gamePk: 9001, gameDate: new Date('2024-06-01T16:00:00Z') });
    const providerArray = [game];
    const provider = makeMockProvider({
      gamesByDate: { '2024-06-01': providerArray },
    });

    await orchestrateHistoricalBacktest(
      { startDate: '2024-06-01', endDate: '2024-06-01' },
      makeMockContext(provider),
    );

    expect(providerArray).toHaveLength(1);
  });
});
