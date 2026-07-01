import { describe, it, expect, vi } from 'vitest';
import { runHistoricalBacktest } from '@/lib/backtesting/runner';
import type {
  BacktestPrediction,
  BacktestRunnerResult,
  HistoricalMLBGame,
  MLBHistoricalDataProvider,
} from '@/lib/backtesting/types';
import {
  LiveMLBHistoricalProvider,
  LiveHistoricalProviderDependencies,
} from '@/lib/backtesting/mlb/live-history/provider';
import { aggregateTeamHistory } from '@/lib/backtesting/mlb/live-history/team-aggregator';
import { aggregatePitcherHistory } from '@/lib/backtesting/mlb/live-history/pitcher-aggregator';

/* ------------------------------------------------------------------ */
/*  Test and identity helpers                                          */
/* ------------------------------------------------------------------ */

const HOME = 101;
const AWAY = 102;
const HOME_PITCHER = 201;
const AWAY_PITCHER = 202;

function makeCanonicalScheduleGame(
  overrides: Partial<import('@/lib/backtesting/mlb/live-history/types').CanonicalHistoricalScheduleGame> &
    Pick<import('@/lib/backtesting/mlb/live-history/types').CanonicalHistoricalScheduleGame, 'gamePk' | 'status'>,
): import('@/lib/backtesting/mlb/live-history/types').CanonicalHistoricalScheduleGame {
  const defaults: import('@/lib/backtesting/mlb/live-history/types').CanonicalHistoricalScheduleGame = {
    gamePk: overrides.gamePk,
    officialDate: '2024-06-01',
    scheduledStart: new Date('2024-06-01T16:00:00Z'),
    cutoffTime: new Date('2024-06-01T14:00:00Z'),
    status: overrides.status,
    homeTeamId: HOME,
    homeTeamName: 'Home',
    awayTeamId: AWAY,
    awayTeamName: 'Away',
    venueId: 1,
    venueName: 'Stadium',
    doubleheader: false,
    gameNumber: 1,
    scheduledInnings: 9,
    homeProbablePitcherId: null,
    awayProbablePitcherId: null,
    homeStarterSource: 'UNAVAILABLE',
    awayStarterSource: 'UNAVAILABLE',
    rescheduledFromGamePk: null,
    warnings: [],
    provenance: {
      endpoint: '/api/v1/schedule',
      fetchedAt: new Date('2024-06-01T12:00:00Z'),
      sourceTimestamp: new Date('2024-06-01T10:00:00Z'),
    },
  };
  return { ...defaults, ...overrides };
}

function makeRunnerGame(
  overrides: Partial<HistoricalMLBGame> &
    Pick<HistoricalMLBGame, 'gamePk' | 'status'>,
  probablePitchers: HistoricalMLBGame['probablePitchers'] = null,
): HistoricalMLBGame {
  return {
    gamePk: overrides.gamePk,
    officialDate: '2024-06-01',
    gameDate: new Date('2024-06-01T16:00:00Z'),
    homeTeamId: HOME,
    awayTeamId: AWAY,
    homeTeamName: 'Home',
    awayTeamName: 'Away',
    venueId: 1,
    status: overrides.status,
    probablePitchers,
    cutoff: {
      eventId: `event-${overrides.gamePk}`,
      cutoffTime: new Date('2024-06-01T14:00:00Z'),
    },
  };
}

function makeAvailablePitcherAssignment(
  personId: number,
  teamId: number,
): import('@/lib/research-data/types').PitcherAssignment {
  return {
    availability: 'AVAILABLE' as const,
    personId,
    fullName: `Pitcher ${personId}`,
    teamId,
    status: 'CONFIRMED' as const,
    fetchedAt: new Date('2024-06-01T12:00:00Z'),
    warnings: [],
  };
}

function makeUnavailablePitcherAssignment(
  teamId: number,
): import('@/lib/research-data/types').PitcherAssignment {
  return {
    availability: 'UNAVAILABLE' as const,
    teamId,
    status: 'UNAVAILABLE' as const,
    fetchedAt: new Date('2024-06-01T12:00:00Z'),
    warnings: ['Missing pitcher'],
  };
}

function makePitcherProfile(
  personId: number,
  teamId: number,
): import('@/lib/backtesting/types').HistoricalPitcherProfile {
  return {
    personId,
    fullName: `Pitcher ${personId}`,
    teamId,
    seasonStats: {
      era: '3.10',
      whip: '1.20',
      strikeoutsPer9Inn: '9.2',
      walksPer9Inn: '2.5',
      hitsPer9Inn: '8.1',
      homeRunsPer9: '0.8',
      inningsPitched: '98.2',
      gamesPlayed: 18,
      gamesStarted: 18,
    },
    recentStarts: [
      {
        date: '2024-05-25',
        opponent: 'Opp',
        opponentTeamId: 1,
        inningsPitched: '6.0',
        earnedRuns: 1,
        strikeOuts: 8,
        baseOnBalls: 2,
        pitches: 98,
        homeRunsAllowed: 0,
        hits: 4,
        gamePk: 5001,
      },
    ],
    daysSinceLastStart: 7,
    completeness: 1,
    warnings: [],
    provenance: {
      source: 'test',
      fetchedAt: new Date('2024-06-01T12:00:00Z'),
      sourceTimestamp: new Date('2024-05-31T12:00:00Z'),
      isLive: false,
      warnings: [],
    },
    asOf: new Date('2024-05-31T23:59:59Z'),
  };
}

function makeTeamProfile(
  teamId: number,
): import('@/lib/backtesting/types').HistoricalTeamProfile {
  return {
    teamId,
    teamName: `Team ${teamId}`,
    seasonStats: {
      gamesPlayed: 50,
      runs: 200,
      hits: 400,
      homeRuns: 30,
      strikeOuts: 350,
      baseOnBalls: 140,
      battingAverage: '.250',
      obp: '.320',
      slg: '.400',
      ops: '.720',
    },
    recentGames: [
      {
        gamePk: 9901,
        gameDate: '2024-05-28',
        opponent: 'Opp',
        opponentTeamId: 2,
        homeAway: 'HOME',
        runsScored: 5,
        runsAllowed: 3,
        win: true,
      },
    ],
    completeness: 1,
    warnings: [],
    provenance: {
      source: 'test',
      fetchedAt: new Date('2024-06-01T12:00:00Z'),
      sourceTimestamp: new Date('2024-05-31T12:00:00Z'),
      isLive: false,
      warnings: [],
    },
    asOf: new Date('2024-05-31T23:59:59Z'),
  };
}

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

function buildMockProvider(calls: string[]): MLBHistoricalDataProvider {
  return {
    fetchGamesForDate: async () => [],
    fetchGameOutcome: async (gamePk: number) => {
      calls.push('outcome');
      return {
        gamePk,
        homeScore: 5,
        awayScore: 3,
        winner: 'HOME',
        innings: 9,
        status: 'FINAL',
        linescore: null,
      };
    },
    fetchPitcherStatsAsOf: async (personId: number) => {
      calls.push(`pitcher-${personId}`);
      return makePitcherProfile(personId, personId === HOME_PITCHER ? HOME : AWAY);
    },
    fetchTeamStatsAsOf: async (teamId: number) => {
      calls.push(`team-${teamId}`);
      return makeTeamProfile(teamId);
    },
    fetchRecentGamesBefore: async (teamId: number) => {
      calls.push(`recent-${teamId}`);
      return [];
    },
  };
}

function buildLiveMockDeps(): LiveHistoricalProviderDependencies {
  return {
    scheduleLoader: {
      loadForDateRange: async () => [],
    },
    outcomeLoader: {
      loadOutcome: async (gamePk: number) => ({
        gamePk,
        status: 'FINAL' as const,
        homeScore: 5,
        awayScore: 3,
        winner: 'HOME' as const,
        innings: 9,
        completedAt: null,
        completedAtSource: null,
        warnings: [],
      }),
    },
    teamGameSource: {
      getTeamGames: async () => [],
    },
    pitcherAppearanceSource: {
      getPitcherAppearances: async () => [],
    },
    teamAggregator: aggregateTeamHistory,
    pitcherAggregator: aggregatePitcherHistory,
  };
}

/* ------------------------------------------------------------------ */
/*  Base runner context                                                */
/* ------------------------------------------------------------------ */

const BASE_CONTEXT = (provider: MLBHistoricalDataProvider) => ({
  provider,
  deterministicTime: new Date('2024-07-01T00:00:00Z'),
  featureVersion: 'test',
  modelVersion: 'test',
  naiveBaselineContext: {
    recentWinRates: {},
    seasonWinRates: {},
  },
});

/* ================================================================== */
/*  Test suites                                                        */
/* ================================================================== */

describe('Phase 1C MLB runner integration: sequencing', () => {
  it('calls provider methods in exact order for a valid game', async () => {
    const calls: string[] = [];
    const provider = buildMockProvider(calls);
    const game = makeRunnerGame(
      { gamePk: 1001, status: 'FINAL' },
      {
        home: makeAvailablePitcherAssignment(HOME_PITCHER, HOME),
        away: makeAvailablePitcherAssignment(AWAY_PITCHER, AWAY),
      },
    );

    const predictionSnapshots: unknown[] = [];
    const context = {
      ...BASE_CONTEXT(provider),
      onPredictionCreated: (prediction: Readonly<BacktestPrediction>) => {
        predictionSnapshots.push(prediction);
      },
    };

    const result = await runHistoricalBacktest([game], context);

    expect(calls).toEqual([
      `pitcher-${HOME_PITCHER}`,
      `pitcher-${AWAY_PITCHER}`,
      `team-${HOME}`,
      `team-${AWAY}`,
      `recent-${HOME}`,
      `recent-${AWAY}`,
      'outcome',
    ]);
    expect(predictionSnapshots.length).toBe(1);
    expect(result.predictions.length).toBe(1);
    expect(result.predictions[0].gamePk).toBe(1001);
    expect(Object.isFrozen(predictionSnapshots[0] as object)).toBe(true);
  });
});

describe('Phase 1C MLB runner integration: successful prediction', () => {
  it('creates a prediction and evaluates it after outcome fetch', async () => {
    const outcomeCalls: number[] = [];
    const provider: MLBHistoricalDataProvider = {
      fetchGamesForDate: async () => [],
      fetchGameOutcome: async (gamePk: number) => {
        outcomeCalls.push(gamePk);
        return {
          gamePk,
          homeScore: 6,
          awayScore: 4,
          winner: 'HOME',
          innings: 9,
          status: 'FINAL',
          linescore: null,
        };
      },
      fetchPitcherStatsAsOf: async (personId: number) => makePitcherProfile(personId, personId === HOME_PITCHER ? HOME : AWAY),
      fetchTeamStatsAsOf: async (teamId: number) => makeTeamProfile(teamId),
      fetchRecentGamesBefore: async () => [],
    };

    const game = makeRunnerGame(
      { gamePk: 1002, status: 'FINAL' },
      {
        home: makeAvailablePitcherAssignment(HOME_PITCHER, HOME),
        away: makeAvailablePitcherAssignment(AWAY_PITCHER, AWAY),
      },
    );
    const result = await runHistoricalBacktest([game], BASE_CONTEXT(provider));

    expect(result.predictions.length).toBe(1);
    expect(result.predictions[0].gamePk).toBe(1002);
    expect(result.predictions[0].actualWinner).toBe('HOME');
    expect(result.predictions[0].correct).toBe(true);
    expect(outcomeCalls).toEqual([1002]);
  });

  it('freezes the prediction before outcome and leaves the captured object unchanged', async () => {
    let capturedBeforeOutcome: unknown = null;
    const provider: MLBHistoricalDataProvider = {
      fetchGamesForDate: async () => [],
      fetchGameOutcome: async () => ({
        gamePk: 1003,
        homeScore: 7,
        awayScore: 2,
        winner: 'HOME',
        innings: 9,
        status: 'FINAL',
        linescore: null,
      }),
      fetchPitcherStatsAsOf: async (personId: number) => makePitcherProfile(personId, personId === HOME_PITCHER ? HOME : AWAY),
      fetchTeamStatsAsOf: async (teamId: number) => makeTeamProfile(teamId),
      fetchRecentGamesBefore: async () => [],
    };

    const game = makeRunnerGame(
      { gamePk: 1003, status: 'FINAL' },
      {
        home: makeAvailablePitcherAssignment(HOME_PITCHER, HOME),
        away: makeAvailablePitcherAssignment(AWAY_PITCHER, AWAY),
      },
    );

    const context = {
      ...BASE_CONTEXT(provider),
      onPredictionCreated: (prediction: Readonly<BacktestPrediction>) => {
        capturedBeforeOutcome = prediction;
      },
    };

    const result = await runHistoricalBacktest([game], context);

    expect(result.predictions.length).toBe(1);
    expect(Object.isFrozen(capturedBeforeOutcome as object)).toBe(true);
    expect((capturedBeforeOutcome as BacktestPrediction).actualWinner).toBeNull();
    expect((result.predictions[0] as BacktestPrediction).actualWinner).toBe('HOME');
    expect((capturedBeforeOutcome as BacktestPrediction).gamePk).toBe(1003);
  });
});

describe('Phase 1C MLB runner integration: honest abstention', () => {
  it('does not request outcome for a game with both pitchers unavailable', async () => {
    let outcomeCalled = false;
    const provider: MLBHistoricalDataProvider = {
      fetchGamesForDate: async () => [],
      fetchGameOutcome: async () => {
        outcomeCalled = true;
        return { gamePk: 2000, homeScore: 1, awayScore: 2, winner: 'AWAY', innings: 9, status: 'FINAL', linescore: null };
      },
      fetchPitcherStatsAsOf: async () => null,
      fetchTeamStatsAsOf: async () => null,
      fetchRecentGamesBefore: async () => [],
    };

    const game = makeRunnerGame(
      { gamePk: 2000, status: 'FINAL' },
      {
        home: makeUnavailablePitcherAssignment(HOME),
        away: makeUnavailablePitcherAssignment(AWAY),
      },
    );

    const result = await runHistoricalBacktest([game], BASE_CONTEXT(provider));
    expect(outcomeCalled).toBe(false);
    expect(result.abstentions.length).toBe(1);
    expect(result.abstentions[0].abstentionReason).toBe('BOTH_PITCHERS_UNAVAILABLE');
    expect(result.abstentions[0].abstained).toBe(true);
  });

  it('does not mutate prediction when abstention is produced', async () => {
    const provider: MLBHistoricalDataProvider = {
      fetchGamesForDate: async () => [],
      fetchGameOutcome: async () => {
        throw new Error('outcome must not be called');
      },
      fetchPitcherStatsAsOf: async () => null,
      fetchTeamStatsAsOf: async () => null,
      fetchRecentGamesBefore: async () => [],
    };

    const game = makeRunnerGame(
      { gamePk: 2001, status: 'FINAL' },
      {
        home: makeUnavailablePitcherAssignment(HOME),
        away: makeUnavailablePitcherAssignment(AWAY),
      },
    );

    const result = await runHistoricalBacktest([game], BASE_CONTEXT(provider));
    expect(result.predictions.length).toBe(0);
    expect(result.abstentions.length).toBe(1);
  });
});

describe('Phase 1C MLB runner integration: known-ineligible statuses', () => {
  const INELIGIBLE_STATUSES = ['CANCELLED', 'POSTPONED', 'SUSPENDED'] as const;

  it.each(INELIGIBLE_STATUSES)('skips $status without research or outcome', async (status) => {
    let providerCalls = 0;
    const provider: MLBHistoricalDataProvider = {
      fetchGamesForDate: async () => [],
      fetchGameOutcome: async () => {
        providerCalls += 1;
        throw new Error('outcome must not be called');
      },
      fetchPitcherStatsAsOf: async () => {
        providerCalls += 1;
        return null;
      },
      fetchTeamStatsAsOf: async () => {
        providerCalls += 1;
        return null;
      },
      fetchRecentGamesBefore: async () => {
        providerCalls += 1;
        return [];
      },
    };

    const game = makeRunnerGame({ gamePk: 3001, status });
    const result = await runHistoricalBacktest([game], BASE_CONTEXT(provider));

    expect(providerCalls).toBe(0);
    expect(result.abstentions.length).toBe(1);
    expect(result.abstentions[0].abstentionReason).toBe('GAME_NOT_ELIGIBLE');
  });

  it('handles UNKNOWN as known-ineligible without research or outcome', async () => {
    let providerCalls = 0;
    const provider: MLBHistoricalDataProvider = {
      fetchGamesForDate: async () => [],
      fetchGameOutcome: async () => {
        providerCalls += 1;
        throw new Error('outcome must not be called');
      },
      fetchPitcherStatsAsOf: async () => {
        providerCalls += 1;
        return null;
      },
      fetchTeamStatsAsOf: async () => {
        providerCalls += 1;
        return null;
      },
      fetchRecentGamesBefore: async () => {
        providerCalls += 1;
        return [];
      },
    };

    const game = makeRunnerGame({ gamePk: 3002, status: 'UNKNOWN' });
    const result = await runHistoricalBacktest([game], BASE_CONTEXT(provider));

    expect(providerCalls).toBe(0);
    expect(result.abstentions.length).toBe(1);
    expect(result.abstentions[0].abstentionReason).toBe('GAME_NOT_ELIGIBLE');
    expect(result.abstentions[0].warnings).toContain('Game unknown, skipped before prediction');
  });

  it('handles UPCOMING as known-ineligible without research or outcome', async () => {
    let providerCalls = 0;
    const provider: MLBHistoricalDataProvider = {
      fetchGamesForDate: async () => [],
      fetchGameOutcome: async () => {
        providerCalls += 1;
        throw new Error('outcome must not be called for UPCOMING');
      },
      fetchPitcherStatsAsOf: async () => {
        providerCalls += 1;
        return makePitcherProfile(HOME_PITCHER, HOME);
      },
      fetchTeamStatsAsOf: async () => {
        providerCalls += 1;
        return makeTeamProfile(HOME);
      },
      fetchRecentGamesBefore: async () => {
        providerCalls += 1;
        return [];
      },
    };

    const game = makeRunnerGame({ gamePk: 3004, status: 'UPCOMING' });
    const result = await runHistoricalBacktest([game], BASE_CONTEXT(provider));

    expect(providerCalls).toBe(0);
    expect(result.abstentions.length).toBe(1);
    expect(result.abstentions[0].abstentionReason).toBe('GAME_NOT_ELIGIBLE');
    expect(result.abstentions[0].warnings).toContain('Game upcoming, skipped before prediction');
  });

  it('handles LIVE as known-ineligible without research or outcome', async () => {
    let providerCalls = 0;
    const provider: MLBHistoricalDataProvider = {
      fetchGamesForDate: async () => [],
      fetchGameOutcome: async () => {
        providerCalls += 1;
        throw new Error('outcome must not be called for LIVE');
      },
      fetchPitcherStatsAsOf: async () => {
        providerCalls += 1;
        return makePitcherProfile(HOME_PITCHER, HOME);
      },
      fetchTeamStatsAsOf: async () => {
        providerCalls += 1;
        return makeTeamProfile(HOME);
      },
      fetchRecentGamesBefore: async () => {
        providerCalls += 1;
        return [];
      },
    };

    const game = makeRunnerGame({ gamePk: 3005, status: 'LIVE' });
    const result = await runHistoricalBacktest([game], BASE_CONTEXT(provider));

    expect(providerCalls).toBe(0);
    expect(result.abstentions.length).toBe(1);
    expect(result.abstentions[0].abstentionReason).toBe('GAME_NOT_ELIGIBLE');
    expect(result.abstentions[0].warnings).toContain('Game live, skipped before prediction');
  });

  it('maps UNKNOWN through live provider without converting to UPCOMING', async () => {
    const deps: LiveHistoricalProviderDependencies = {
      ...buildLiveMockDeps(),
      scheduleLoader: {
        loadForDateRange: async () => [
          makeCanonicalScheduleGame({ gamePk: 4001, status: 'UNKNOWN', homeStarterSource: 'UNAVAILABLE', awayStarterSource: 'UNAVAILABLE' }),
        ],
      },
      outcomeLoader: {
        loadOutcome: async () => {
          throw new Error('outcome must not be called for UNKNOWN');
        },
      },
      teamGameSource: {
        getTeamGames: async () => {
          throw new Error('team source must not be called for UNKNOWN');
        },
      },
      pitcherAppearanceSource: {
        getPitcherAppearances: async () => {
          throw new Error('pitcher source must not be called for UNKNOWN');
        },
      },
      teamAggregator: aggregateTeamHistory,
      pitcherAggregator: aggregatePitcherHistory,
    };

    const provider = new LiveMLBHistoricalProvider(deps);
    const games = await provider.fetchGamesForDate('2024-06-01');

    const result = await runHistoricalBacktest(games, BASE_CONTEXT(provider));
    expect(result.abstentions.length).toBe(1);
    expect(result.abstentions[0].abstentionReason).toBe('GAME_NOT_ELIGIBLE');
  });
});

describe('Phase 1C MLB runner integration: pitcher leakage', () => {
  it('does not call pitcher source for timestamp-unknown starter', async () => {
    const sourceCalls: number[] = [];
    const deps: LiveHistoricalProviderDependencies = {
      ...buildLiveMockDeps(),
      scheduleLoader: {
        loadForDateRange: async () => [
          makeCanonicalScheduleGame({
            gamePk: 4002,
            status: 'FINAL',
            homeStarterSource: 'SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN',
            awayStarterSource: 'SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN',
            homeProbablePitcherId: HOME_PITCHER,
            awayProbablePitcherId: AWAY_PITCHER,
          }),
        ],
      },
      pitcherAppearanceSource: {
        getPitcherAppearances: async (personId: number) => {
          sourceCalls.push(personId);
          return [];
        },
      },
      teamGameSource: {
        getTeamGames: async () => [],
      },
      teamAggregator: aggregateTeamHistory,
      pitcherAggregator: aggregatePitcherHistory,
    };

    const provider = new LiveMLBHistoricalProvider(deps);
    const games = await provider.fetchGamesForDate('2024-06-01');

    await runHistoricalBacktest(games, BASE_CONTEXT(provider));
    expect(sourceCalls.length).toBe(0);
  });

  it('does not call pitcher source when assignment has no personId', async () => {
    const sourceCalls: number[] = [];
    const deps: LiveHistoricalProviderDependencies = {
      ...buildLiveMockDeps(),
      scheduleLoader: {
        loadForDateRange: async () => [
          makeCanonicalScheduleGame({
            gamePk: 4003,
            status: 'FINAL',
            homeStarterSource: 'UNAVAILABLE',
            awayStarterSource: 'UNAVAILABLE',
            homeProbablePitcherId: null,
            awayProbablePitcherId: null,
          }),
        ],
      },
      pitcherAppearanceSource: {
        getPitcherAppearances: async (personId: number) => {
          sourceCalls.push(personId);
          return [];
        },
      },
      teamGameSource: {
        getTeamGames: async () => [],
      },
      teamAggregator: aggregateTeamHistory,
      pitcherAggregator: aggregatePitcherHistory,
    };

    const provider = new LiveMLBHistoricalProvider(deps);
    const games = await provider.fetchGamesForDate('2024-06-01');

    await runHistoricalBacktest(games, BASE_CONTEXT(provider));
    expect(sourceCalls.length).toBe(0);
  });
});

describe('Phase 1C MLB runner integration: provider failure propagation', () => {
  it('propagates provider errors without converting to abstention', async () => {
    const provider: MLBHistoricalDataProvider = {
      fetchGamesForDate: async () => [],
      fetchGameOutcome: async () => ({ gamePk: 0, homeScore: 0, awayScore: 0, winner: null, innings: null, status: 'FINAL', linescore: null }),
      fetchPitcherStatsAsOf: async () => {
        throw new Error('pitcher source down');
      },
      fetchTeamStatsAsOf: async () => makeTeamProfile(HOME),
      fetchRecentGamesBefore: async () => [],
    };

    const game = makeRunnerGame(
      { gamePk: 5001, status: 'FINAL' },
      {
        home: makeAvailablePitcherAssignment(HOME_PITCHER, HOME),
        away: makeAvailablePitcherAssignment(AWAY_PITCHER, AWAY),
      },
    );
    await expect(runHistoricalBacktest([game], BASE_CONTEXT(provider))).rejects.toThrow('pitcher source down');
  });

  it('does not mutate prior predictions when a later game fails', async () => {
    const provider: MLBHistoricalDataProvider = {
      fetchGamesForDate: async () => [],
      fetchGameOutcome: async () => ({ gamePk: 0, homeScore: 0, awayScore: 0, winner: null, innings: null, status: 'FINAL', linescore: null }),
      fetchPitcherStatsAsOf: async (personId: number) => {
        if (personId === HOME_PITCHER) {
          return makePitcherProfile(personId, HOME);
        }
        throw new Error('second pitcher request failed');
      },
      fetchTeamStatsAsOf: async () => makeTeamProfile(HOME),
      fetchRecentGamesBefore: async () => [],
    };

    const gameA = makeRunnerGame(
      { gamePk: 5002, status: 'FINAL' },
      { home: makeAvailablePitcherAssignment(HOME_PITCHER, HOME), away: makeAvailablePitcherAssignment(AWAY_PITCHER, AWAY) },
    );
    const gameB = makeRunnerGame(
      { gamePk: 5003, status: 'FINAL' },
      { home: makeAvailablePitcherAssignment(HOME_PITCHER, HOME), away: makeAvailablePitcherAssignment(AWAY_PITCHER, AWAY) },
    );

    await expect(runHistoricalBacktest([gameA, gameB], BASE_CONTEXT(provider))).rejects.toThrow('second pitcher request failed');
  });

  it('fails fast on outcome provider error after prediction is frozen', async () => {
    let capturedAfterPrediction: unknown = null;
    const provider: MLBHistoricalDataProvider = {
      fetchGamesForDate: async () => [],
      fetchGameOutcome: async () => {
        throw new Error('outcome provider failed after prediction');
      },
      fetchPitcherStatsAsOf: async (personId: number) => makePitcherProfile(personId, personId === HOME_PITCHER ? HOME : AWAY),
      fetchTeamStatsAsOf: async (teamId: number) => makeTeamProfile(teamId),
      fetchRecentGamesBefore: async () => [],
    };

    const game = makeRunnerGame(
      { gamePk: 5004, status: 'FINAL' },
      {
        home: makeAvailablePitcherAssignment(HOME_PITCHER, HOME),
        away: makeAvailablePitcherAssignment(AWAY_PITCHER, AWAY),
      },
    );

    const context = {
      ...BASE_CONTEXT(provider),
      onPredictionCreated: (prediction: Readonly<BacktestPrediction>) => {
        capturedAfterPrediction = prediction;
      },
    };

    await expect(runHistoricalBacktest([game], context)).rejects.toThrow('outcome provider failed after prediction');

    expect(Object.isFrozen(capturedAfterPrediction as object)).toBe(true);
    expect((capturedAfterPrediction as BacktestPrediction).actualWinner).toBeNull();
  });
});

describe('Phase 1C MLB runner integration: duplicate-call prevention', () => {
  it('makes exactly one provider call per profile per game', async () => {
    const pitcherCalls = new Map<number, number>();
    const teamCalls = new Map<number, number>();
    const recentCalls = new Map<number, number>();

    const provider: MLBHistoricalDataProvider = {
      fetchGamesForDate: async () => [],
      fetchGameOutcome: async () => ({ gamePk: 6001, homeScore: 3, awayScore: 2, winner: 'HOME', innings: 9, status: 'FINAL', linescore: null }),
      fetchPitcherStatsAsOf: async (personId: number) => {
        pitcherCalls.set(personId, (pitcherCalls.get(personId) ?? 0) + 1);
        return makePitcherProfile(personId, personId === HOME_PITCHER ? HOME : AWAY);
      },
      fetchTeamStatsAsOf: async (teamId: number) => {
        teamCalls.set(teamId, (teamCalls.get(teamId) ?? 0) + 1);
        return makeTeamProfile(teamId);
      },
      fetchRecentGamesBefore: async (teamId: number) => {
        recentCalls.set(teamId, (recentCalls.get(teamId) ?? 0) + 1);
        return [];
      },
    };

    const game = makeRunnerGame(
      { gamePk: 6001, status: 'FINAL' },
      {
        home: makeAvailablePitcherAssignment(HOME_PITCHER, HOME),
        away: makeAvailablePitcherAssignment(AWAY_PITCHER, AWAY),
      },
    );
    await runHistoricalBacktest([game], BASE_CONTEXT(provider));

    for (const count of pitcherCalls.values()) expect(count).toBe(1);
    for (const count of teamCalls.values()) expect(count).toBe(1);
    for (const count of recentCalls.values()) expect(count).toBe(1);
  });

  it('does not call outcome for abstained games', async () => {
    const outcomeCalledFor = new Set<number>();
    const provider: MLBHistoricalDataProvider = {
      fetchGamesForDate: async () => [],
      fetchGameOutcome: async (gamePk: number) => {
        outcomeCalledFor.add(gamePk);
        return { gamePk, homeScore: 1, awayScore: 2, winner: 'AWAY', innings: 9, status: 'FINAL', linescore: null };
      },
      fetchPitcherStatsAsOf: async () => null,
      fetchTeamStatsAsOf: async () => null,
      fetchRecentGamesBefore: async () => [],
    };

    const abstainedGame = makeRunnerGame(
      { gamePk: 6002, status: 'FINAL' },
      {
        home: makeUnavailablePitcherAssignment(HOME),
        away: makeUnavailablePitcherAssignment(AWAY),
      },
    );

    const result = await runHistoricalBacktest([abstainedGame], BASE_CONTEXT(provider));
    expect(outcomeCalledFor.has(6002)).toBe(false);
    expect(result.abstentions.length).toBe(1);
  });
});

describe('Phase 1C MLB runner integration: live-provider end-to-end', () => {
  it('processes one valid FINAL game via LiveMLBHistoricalProvider', async () => {
    const deps: LiveHistoricalProviderDependencies = {
      ...buildLiveMockDeps(),
      scheduleLoader: {
        loadForDateRange: async () => [
          makeCanonicalScheduleGame({
            gamePk: 7001,
            status: 'FINAL',
            homeStarterSource: 'SCHEDULE_PROBABLE_BEFORE_CUTOFF',
            awayStarterSource: 'SCHEDULE_PROBABLE_BEFORE_CUTOFF',
            homeProbablePitcherId: HOME_PITCHER,
            awayProbablePitcherId: AWAY_PITCHER,
          }),
        ],
      },
      teamGameSource: {
        getTeamGames: async (teamId: number) => [
          {
            gamePk: 9001,
            gameStart: new Date('2024-05-28T00:00:00Z'),
            completedAt: new Date('2024-05-28T22:30:00Z'),
            completedAtSource: null,
            status: 'FINAL' as const,
            teamId,
            opponentTeamId: 1,
            isHome: true,
            runsScored: 5,
            runsAllowed: 3,
            innings: 9,
          },
        ],
      },
      pitcherAppearanceSource: {
        getPitcherAppearances: async (personId: number, season: number) => [
          {
            gamePk: 9010,
            gameStart: new Date('2024-05-25T00:00:00Z'),
            completedAt: new Date('2024-05-25T22:30:00Z'),
            completedAtSource: 'LAST_COMPLETED_PLAY_END',
            status: 'FINAL' as const,
            personId,
            teamId: personId === HOME_PITCHER ? HOME : AWAY,
            started: true,
            inningsPitched: '6.0',
            earnedRuns: 1,
            strikeouts: 8,
            walks: 2,
            hitsAllowed: 4,
            homeRunsAllowed: 0,
            pitches: 98,
          },
        ],
      },
      teamAggregator: aggregateTeamHistory,
      pitcherAggregator: aggregatePitcherHistory,
    };

    const provider = new LiveMLBHistoricalProvider(deps);
    const games = await provider.fetchGamesForDate('2024-06-01');

    const result = await runHistoricalBacktest(games, BASE_CONTEXT(provider));

    const mapped = games[0];
    expect(mapped.status).toBe('FINAL');
    expect(mapped.probablePitchers?.home?.availability).toBe('AVAILABLE');
    expect(mapped.probablePitchers?.away?.availability).toBe('AVAILABLE');

    expect(result.predictions.length).toBe(1);
    expect(result.abstentions.length).toBe(0);
    expect(result.predictions[0].voided).toBe(false);
  });
});
