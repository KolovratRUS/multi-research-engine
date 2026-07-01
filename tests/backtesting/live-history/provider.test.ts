import { describe, it, expect, vi } from 'vitest';
import type {
  MLBHistoricalDataProvider,
  HistoricalMLBGame,
  MLBGameOutcome,
  HistoricalPitcherProfile,
  HistoricalTeamProfile,
  HistoricalTeamGame,
} from '@/lib/backtesting/types';
import {
  LiveMLBHistoricalProvider,
  LiveHistoricalProviderError as ProviderError,
} from '@/lib/backtesting/mlb/live-history/provider';
import type {
  HistoricalTeamGameSource,
  HistoricalPitcherAppearanceSource,
  LiveHistoricalProviderDependencies,
} from '@/lib/backtesting/mlb/live-history/provider';
import type {
  CanonicalHistoricalScheduleGame,
  CanonicalHistoricalOutcome,
  CompletedHistoricalTeamGame,
  HistoricalPitcherAppearance,
} from '@/lib/backtesting/mlb/live-history/types';
import { aggregateTeamHistory } from '@/lib/backtesting/mlb/live-history/team-aggregator';
import { aggregatePitcherHistory } from '@/lib/backtesting/mlb/live-history/pitcher-aggregator';

const fixedNow = new Date('2024-06-25T12:00:00Z');

const buildDeps = (
  overrides: Partial<LiveHistoricalProviderDependencies> = {},
): LiveHistoricalProviderDependencies => ({
  scheduleLoader: {
    loadForDateRange: async () => [],
  },
  outcomeLoader: {
    loadOutcome: async () => {
      throw new Error('outcome loader should not be called');
    },
  },
  teamGameSource: {
    getTeamGames: async () => [],
  },
  pitcherAppearanceSource: {
    getPitcherAppearances: async () => [],
  },
  teamAggregator: aggregateTeamHistory,
  pitcherAggregator: aggregatePitcherHistory,
  now: () => fixedNow,
  ...overrides,
});

const canonicalScheduleGame = (overrides: Partial<CanonicalHistoricalScheduleGame> = {}): CanonicalHistoricalScheduleGame => ({
  gamePk: 1001,
  officialDate: '2024-06-25',
  scheduledStart: new Date('2024-06-25T18:30:00Z'),
  cutoffTime: new Date('2024-06-25T18:00:00Z'),
  status: 'UPCOMING',
  homeTeamId: 100,
  homeTeamName: 'Home Team',
  awayTeamId: 200,
  awayTeamName: 'Away Team',
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
    fetchedAt: new Date('2024-06-25T12:00:00Z'),
    sourceTimestamp: new Date('2024-06-25T12:00:00Z'),
  },
  ...overrides,
});

const canonicalOutcome = (overrides: Partial<CanonicalHistoricalOutcome> = {}): CanonicalHistoricalOutcome => ({
  gamePk: 1001,
  status: 'FINAL',
  homeScore: 3,
  awayScore: 1,
  winner: 'HOME',
  innings: 9,
  completedAt: null,
  completedAtSource: null,
  warnings: [],
  ...overrides,
});

const completedTeamGame = (overrides: Partial<CompletedHistoricalTeamGame> = {}): CompletedHistoricalTeamGame => ({
  gamePk: 5001,
  gameStart: new Date('2024-06-01T18:30:00Z'),
  completedAt: new Date('2024-06-01T21:30:00Z'),
  completedAtSource: null,
  status: 'FINAL',
  teamId: 100,
  opponentTeamId: 200,
  isHome: true,
  runsScored: 4,
  runsAllowed: 2,
  innings: 9,
  ...overrides,
});

const pitcherAppearance = (overrides: Partial<HistoricalPitcherAppearance> = {}): HistoricalPitcherAppearance => ({
  gamePk: 6001,
  gameStart: new Date('2024-06-01T18:30:00Z'),
  completedAt: new Date('2024-06-01T21:30:00Z'),
  completedAtSource: 'LAST_COMPLETED_PLAY_END',
  status: 'FINAL',
  personId: 9001,
  teamId: 100,
  started: true,
  inningsPitched: '6.0',
  earnedRuns: 1,
  strikeouts: 7,
  walks: 2,
  hitsAllowed: 4,
  homeRunsAllowed: 0,
  pitches: 95,
  ...overrides,
});

const teamGamesSource = (games: CompletedHistoricalTeamGame[]): HistoricalTeamGameSource => ({
  getTeamGames: async () => games,
});

const pitcherAppearanceSource = (apps: HistoricalPitcherAppearance[]): HistoricalPitcherAppearanceSource => ({
  getPitcherAppearances: async () => apps,
});

describe('LiveMLBHistoricalProvider', () => {
  it('maps schedule games with deterministic order and pitcher availability', async () => {
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        scheduleLoader: {
          loadForDateRange: async () => [
            canonicalScheduleGame({ gamePk: 1002, scheduledStart: new Date('2024-06-25T19:30:00Z') }),
            canonicalScheduleGame({ gamePk: 1001, scheduledStart: new Date('2024-06-25T18:30:00Z') }),
            canonicalScheduleGame({
              gamePk: 1003,
              scheduledStart: new Date('2024-06-25T18:30:00Z'),
              doubleheader: true,
              gameNumber: 2,
            }),
            canonicalScheduleGame({
              gamePk: 1004,
              scheduledStart: new Date('2024-06-25T18:30:00Z'),
              homeProbablePitcherId: 101,
              homeStarterSource: 'SCHEDULE_PROBABLE_BEFORE_CUTOFF',
            }),
          ],
        },
      }),
    );

    const games = await provider.fetchGamesForDate('2024-06-25');

    expect(games).toHaveLength(4);
    expect(games[0].gamePk).toBe(1001);
    expect(games[1].gamePk).toBe(1003);
    expect(games[2].gamePk).toBe(1004);
    expect(games[3].gamePk).toBe(1002);
    expect(games[2].probablePitchers?.home?.status).toBe('PROBABLE');
    expect(games[2].probablePitchers?.home?.availability).toBe('AVAILABLE');
    expect(games[2].probablePitchers?.away).toBeNull();
  });

  it('preserves UNKNOWN status without remapping', async () => {
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        scheduleLoader: {
          loadForDateRange: async () => [
            canonicalScheduleGame({ gamePk: 1001, status: 'UNKNOWN' }),
            canonicalScheduleGame({ gamePk: 1002, status: 'UNKNOWN' }),
          ],
        },
      }),
    );

    const games = await provider.fetchGamesForDate('2024-06-25');
    expect(games.map((g) => g.status)).toEqual(['UNKNOWN', 'UNKNOWN']);
  });

  it('UNKNOWN schedule does not call outcome or research sources', async () => {
    const source = { getTeamGames: vi.fn(), getPitcherAppearances: vi.fn() };
    const outcome = { loadOutcome: vi.fn() };
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        scheduleLoader: {
          loadForDateRange: async () => [
            canonicalScheduleGame({ gamePk: 1001, status: 'UNKNOWN' }),
          ],
        },
        outcomeLoader: outcome,
        teamGameSource: source,
        pitcherAppearanceSource: source,
      }),
    );

    await provider.fetchGamesForDate('2024-06-25');
    expect(outcome.loadOutcome).not.toHaveBeenCalled();
    expect(source.getTeamGames).not.toHaveBeenCalled();
    expect(source.getPitcherAppearances).not.toHaveBeenCalled();
  });

  it('maps unknown-timestamp probable pitchers as unavailable', async () => {
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        scheduleLoader: {
          loadForDateRange: async () => [
            canonicalScheduleGame({
              gamePk: 1001,
              homeProbablePitcherId: 101,
              homeStarterSource: 'SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN',
            }),
            canonicalScheduleGame({
              gamePk: 1002,
              homeProbablePitcherId: 101,
              homeStarterSource: 'ACTUAL_STARTER_RETROSPECTIVE',
            }),
            canonicalScheduleGame({
              gamePk: 1003,
              homeProbablePitcherId: 101,
              homeStarterSource: 'UNAVAILABLE',
            }),
          ],
        },
      }),
    );

    const games = await provider.fetchGamesForDate('2024-06-25');
    expect(games.every((g) => g.probablePitchers === null)).toBe(true);
  });

  it('applies BEFORE_CUTOFF only when loader supplies that trusted source', async () => {
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        scheduleLoader: {
          loadForDateRange: async () => [
            canonicalScheduleGame({
              gamePk: 1001,
              homeProbablePitcherId: 101,
              homeStarterSource: 'SCHEDULE_PROBABLE_BEFORE_CUTOFF',
            }),
            canonicalScheduleGame({
              gamePk: 1002,
              homeProbablePitcherId: 101,
              homeStarterSource: 'SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN',
            }),
            canonicalScheduleGame({
              gamePk: 1003,
              homeProbablePitcherId: 101,
              homeStarterSource: 'ACTUAL_STARTER_RETROSPECTIVE',
            }),
          ],
        },
      }),
    );

    const games = await provider.fetchGamesForDate('2024-06-25');
    expect(games).toHaveLength(3);
    const firstPitchers = games[0].probablePitchers;
    const firstHome = firstPitchers?.home;
    if (firstHome && firstHome.availability === 'AVAILABLE') {
      expect(firstHome.personId).toBe(101);
      expect(firstHome.status).toBe('PROBABLE');
    } else {
      throw new Error('Expected first game home pitcher to be available');
    }
    expect(games[1].probablePitchers).toBeNull();
    expect(games[2].probablePitchers).toBeNull();
  });

  it('preserves known statuses and numeric team IDs', async () => {
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        scheduleLoader: {
          loadForDateRange: async () => [
            canonicalScheduleGame({ gamePk: 1001, status: 'POSTPONED' }),
            canonicalScheduleGame({ gamePk: 1002, status: 'CANCELLED' }),
            canonicalScheduleGame({ gamePk: 1003, status: 'SUSPENDED' }),
            canonicalScheduleGame({ gamePk: 1004, status: 'FINAL' }),
          ],
        },
      }),
    );

    const games = await provider.fetchGamesForDate('2024-06-25');
    expect(games.map((g) => g.status)).toEqual(['POSTPONED', 'CANCELLED', 'SUSPENDED', 'FINAL']);
    expect(games[0].homeTeamId).toBe(100);
    expect(games[0].awayTeamId).toBe(200);
  });

  it('maps outcomes and never calls outcome loader from schedule methods', async () => {
    let outcomeCalls = 0;
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        scheduleLoader: {
          loadForDateRange: async () => [canonicalScheduleGame()],
        },
        outcomeLoader: {
          loadOutcome: async (gamePk) => {
            outcomeCalls += 1;
            return canonicalOutcome({ gamePk });
          },
        },
      }),
    );

    await provider.fetchGamesForDate('2024-06-25');
    expect(outcomeCalls).toBe(0);

    const outcome = await provider.fetchGameOutcome(1001);
    expect(outcomeCalls).toBe(1);
    expect(outcome).toEqual<Partial<MLBGameOutcome>>({
      gamePk: 1001,
      status: 'FINAL',
      homeScore: 3,
      awayScore: 1,
      winner: 'HOME',
      innings: 9,
      linescore: null,
    });
  });

  it('maps all outcome statuses without ties', async () => {
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        outcomeLoader: {
          loadOutcome: async (gamePk) =>
            canonicalOutcome({
              gamePk,
              status: 'UNKNOWN',
              homeScore: null,
              awayScore: null,
              winner: null,
            }),
        },
      }),
    );

    const outcome = await provider.fetchGameOutcome(1001);
    expect(outcome.status).toBe('UNKNOWN');
    expect(outcome.winner).toBeNull();
  });

  it('maps team aggregate using UTC season and null team names', async () => {
    const cutoff = new Date('2024-06-25T00:00:00Z');
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        teamGameSource: teamGamesSource([
          completedTeamGame({ completedAt: new Date('2024-06-20T22:00:00Z') }),
          completedTeamGame({ completedAt: new Date('2024-06-21T22:00:00Z') }),
        ]),
      }),
    );

    const profile = await provider.fetchTeamStatsAsOf(100, cutoff);
    expect(profile).not.toBeNull();
    expect(profile?.teamId).toBe(100);
    expect(profile?.teamName).toBeNull();
    expect(profile?.seasonStats?.gamesPlayed).toBe(2);
    expect(profile?.warnings).toEqual([]);
    expect(profile?.completeness).toBe(1);
    expect(profile?.asOf.getTime()).toBe(cutoff.getTime());
  });

  it('maps pitcher aggregate with nullable teamId and null fullName', async () => {
    const cutoff = new Date('2024-06-25T00:00:00Z');
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        pitcherAppearanceSource: pitcherAppearanceSource([
          pitcherAppearance({ gamePk: 6001, completedAt: new Date('2024-06-10T22:00:00Z'), teamId: 100 }),
          pitcherAppearance({ gamePk: 6002, completedAt: new Date('2024-06-15T22:00:00Z'), teamId: 200 }),
        ]),
      }),
    );

    const profile = await provider.fetchPitcherStatsAsOf(9001, cutoff);
    expect(profile).not.toBeNull();
    expect(profile?.personId).toBe(9001);
    expect(profile?.teamId).toBe(200);
    expect(profile?.fullName).toBeNull();
  });

  it('returns null teamId when no eligible appearances', async () => {
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        pitcherAppearanceSource: pitcherAppearanceSource([]),
      }),
    );

    const profile = await provider.fetchPitcherStatsAsOf(9001, new Date('2024-06-25T00:00:00Z'));
    expect(profile).not.toBeNull();
    expect(profile?.teamId).toBeNull();
    expect(profile?.completeness).toBe(0);
  });

  it('returns null for missing personId without calling source', async () => {
    const source = { getPitcherAppearances: vi.fn() };
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        pitcherAppearanceSource: source,
      }),
    );

    const profile = await provider.fetchPitcherStatsAsOf(NaN, new Date());
    expect(profile).toBeNull();
    expect(source.getPitcherAppearances).not.toHaveBeenCalled();
  });

  it('returns recent games with strict eligibility: null runs excluded, tied excluded, future excluded, exact cutoff excluded, suspended excluded, wrong team excluded', async () => {
    const cutoff = new Date('2024-06-25T00:00:00Z');
    const games = [
      completedTeamGame({ gamePk: 5004, completedAt: new Date('2024-06-24T22:00:00Z'), teamId: 100 }),
      completedTeamGame({ gamePk: 5005, completedAt: new Date('2024-06-23T22:00:00Z'), teamId: 200 }),
      completedTeamGame({ gamePk: 5006, completedAt: new Date('2024-06-22T22:00:00Z'), teamId: 100, runsScored: null, runsAllowed: null }),
      completedTeamGame({ gamePk: 5007, completedAt: new Date('2024-06-21T22:00:00Z'), teamId: 100, runsScored: 2, runsAllowed: 2 }),
      completedTeamGame({ gamePk: 5008, completedAt: new Date('2024-06-20T22:00:00Z'), teamId: 100 }),
      completedTeamGame({ gamePk: 5009, completedAt: new Date('2024-06-25T00:00:00Z'), teamId: 100 }),
      completedTeamGame({ gamePk: 5010, completedAt: new Date('2024-06-19T22:00:00Z'), teamId: 100, status: 'SUSPENDED' }),
    ];
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        teamGameSource: teamGamesSource(games),
      }),
    );

    const recent = await provider.fetchRecentGamesBefore(100, cutoff, 10);
    expect(recent).toHaveLength(2);
    expect(recent[0].gamePk).toBe(5004);
    expect(recent[1].gamePk).toBe(5008);
    expect(recent[0].win).toBe(true);
    expect(recent[1].win).toBe(true);
  });

  it('retains a valid zero-runs record and maps 0-1 result correctly', async () => {
    const cutoff = new Date('2024-06-25T00:00:00Z');
    const games = [
      completedTeamGame({ gamePk: 6004, completedAt: new Date('2024-06-22T22:00:00Z'), teamId: 100, runsScored: 0, runsAllowed: 0 }),
      completedTeamGame({ gamePk: 6005, completedAt: new Date('2024-06-23T22:00:00Z'), teamId: 100, runsScored: 0, runsAllowed: 1 }),
    ];
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        teamGameSource: teamGamesSource(games),
      }),
    );

    const recent = await provider.fetchRecentGamesBefore(100, cutoff, 10);
    expect(recent).toHaveLength(1);
    expect(recent[0].gamePk).toBe(6005);
    expect(recent[0].runsScored).toBe(0);
    expect(recent[0].runsAllowed).toBe(1);
    expect(recent[0].win).toBe(false);
  });

  it('does not fabricate 0-0 for missing scores', async () => {
    const cutoff = new Date('2024-06-25T00:00:00Z');
    const games = [
      completedTeamGame({ gamePk: 7001, completedAt: new Date('2024-06-22T22:00:00Z'), teamId: 100, runsScored: null, runsAllowed: null }),
    ];
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        teamGameSource: teamGamesSource(games),
      }),
    );

    const recent = await provider.fetchRecentGamesBefore(100, cutoff, 10);
    expect(recent).toHaveLength(0);
  });

  it('uses gamePk tie-break when completion timestamps are identical', async () => {
    const cutoff = new Date('2024-06-25T00:00:00Z');
    const games = [
      completedTeamGame({ gamePk: 5010, completedAt: new Date('2024-06-21T22:00:00Z'), teamId: 100 }),
      completedTeamGame({ gamePk: 5009, completedAt: new Date('2024-06-21T22:00:00Z'), teamId: 100 }),
    ];
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        teamGameSource: teamGamesSource(games),
      }),
    );

    const recent = await provider.fetchRecentGamesBefore(100, cutoff, 10);
    expect(recent).toHaveLength(2);
    expect(recent[0].gamePk).toBe(5010);
    expect(recent[1].gamePk).toBe(5009);
  });

  it('applies limit after all filtering', async () => {
    const cutoff = new Date('2024-06-25T00:00:00Z');
    const games = [
      completedTeamGame({ gamePk: 5001, completedAt: new Date('2024-06-24T22:00:00Z'), teamId: 100 }),
      completedTeamGame({ gamePk: 5002, completedAt: new Date('2024-06-23T22:00:00Z'), teamId: 100 }),
      completedTeamGame({ gamePk: 5003, completedAt: new Date('2024-06-22T22:00:00Z'), teamId: 100 }),
      completedTeamGame({ gamePk: 5004, completedAt: new Date('2024-06-21T22:00:00Z'), teamId: 100, runsScored: null, runsAllowed: null }),
    ];
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        teamGameSource: teamGamesSource(games),
      }),
    );

    const recent = await provider.fetchRecentGamesBefore(100, cutoff, 2);
    expect(recent).toHaveLength(2);
    expect(recent[0].gamePk).toBe(5001);
    expect(recent[1].gamePk).toBe(5002);
  });

  it('tracks cumulative stats and failure counts correctly', async () => {
    const scheduleFailure = new Error('schedule down');
    const outcomeFailure = new Error('outcome down');
    const teamFailure = new Error('team down');
    const pitcherFailure = new Error('pitcher down');
    const teamAggFailure = new Error('team agg down');
    const pitcherAggFailure = new Error('pitcher agg down');

    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        scheduleLoader: {
          loadForDateRange: async () => {
            throw scheduleFailure;
          },
        },
        outcomeLoader: {
          loadOutcome: async () => {
            throw outcomeFailure;
          },
        },
        teamGameSource: {
          getTeamGames: async () => {
            throw teamFailure;
          },
        },
        pitcherAppearanceSource: {
          getPitcherAppearances: async () => {
            throw pitcherFailure;
          },
        },
        teamAggregator: () => {
          throw teamAggFailure;
        },
        pitcherAggregator: () => {
          throw pitcherAggFailure;
        },
      }),
    );

    await expect(provider.fetchGamesForDate('2024-06-25')).rejects.toThrow(ProviderError);
    expect(provider.stats().scheduleRequests).toBe(1);

    await expect(provider.fetchGameOutcome(1001)).rejects.toThrow(ProviderError);
    expect(provider.stats().outcomeRequests).toBe(1);

    await expect(provider.fetchTeamStatsAsOf(100, new Date('2024-06-25T00:00:00Z'))).rejects.toThrow(
      ProviderError,
    );
    expect(provider.stats().teamSourceRequests).toBe(1);
    expect(provider.stats().teamAggregations).toBe(0);

    await expect(provider.fetchPitcherStatsAsOf(9001, new Date('2024-06-25T00:00:00Z'))).rejects.toThrow(
      ProviderError,
    );
    expect(provider.stats().pitcherSourceRequests).toBe(1);
    expect(provider.stats().pitcherAggregations).toBe(0);

    provider.clearStats();
    expect(provider.stats()).toEqual({
      scheduleRequests: 0,
      outcomeRequests: 0,
      teamSourceRequests: 0,
      pitcherSourceRequests: 0,
      teamAggregations: 0,
      pitcherAggregations: 0,
    });
  });

  it('failed team source does not increment teamAggregations', async () => {
    const teamAggregator = vi.fn();
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        teamGameSource: {
          getTeamGames: async () => {
            throw new Error('team source down');
          },
        },
        teamAggregator,
      }),
    );

    await expect(provider.fetchTeamStatsAsOf(100, new Date('2024-06-25T00:00:00Z'))).rejects.toThrow(
      ProviderError,
    );
    expect(teamAggregator).not.toHaveBeenCalled();
  });

  it('team aggregator failure increments teamAggregations', async () => {
    const teamAggregator = () => {
      throw new Error('team agg down');
    };
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        teamGameSource: teamGamesSource([completedTeamGame()]),
        teamAggregator,
      }),
    );

    await expect(provider.fetchTeamStatsAsOf(100, new Date('2024-06-25T00:00:00Z'))).rejects.toThrow(
      ProviderError,
    );
    expect(provider.stats().teamAggregations).toBe(1);
  });

  it('failed pitcher source does not increment pitcherAggregations', async () => {
    const pitcherAggregator = vi.fn();
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        pitcherAppearanceSource: {
          getPitcherAppearances: async () => {
            throw new Error('pitcher source down');
          },
        },
        pitcherAggregator,
      }),
    );

    await expect(provider.fetchPitcherStatsAsOf(9001, new Date('2024-06-25T00:00:00Z'))).rejects.toThrow(
      ProviderError,
    );
    expect(pitcherAggregator).not.toHaveBeenCalled();
  });

  it('pitcher aggregator failure increments pitcherAggregations', async () => {
    const pitcherAggregator = () => {
      throw new Error('pitcher agg down');
    };
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        pitcherAppearanceSource: pitcherAppearanceSource([pitcherAppearance()]),
        pitcherAggregator,
      }),
    );

    await expect(provider.fetchPitcherStatsAsOf(9001, new Date('2024-06-25T00:00:00Z'))).rejects.toThrow(
      ProviderError,
    );
    expect(provider.stats().pitcherAggregations).toBe(1);
  });

  it('does not count missing personId against pitcher counters', async () => {
    const source = { getPitcherAppearances: vi.fn() };
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        pitcherAppearanceSource: source,
      }),
    );

    const profile = await provider.fetchPitcherStatsAsOf(NaN, new Date());
    expect(profile).toBeNull();
    expect(source.getPitcherAppearances).not.toHaveBeenCalled();
    expect(provider.stats().pitcherSourceRequests).toBe(0);
    expect(provider.stats().pitcherAggregations).toBe(0);
    provider.clearStats();
  });

  it('uses deterministic now for provenance', async () => {
    const fixed = new Date('2024-06-25T06:00:00Z');
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        scheduleLoader: {
          loadForDateRange: async () => [canonicalScheduleGame()],
        },
        teamGameSource: teamGamesSource([completedTeamGame()]),
        pitcherAppearanceSource: pitcherAppearanceSource([pitcherAppearance()]),
        now: () => fixed,
      }),
    );

    const [game] = await provider.fetchGamesForDate('2024-06-25');
    expect(game.probablePitchers).toBeNull();

    const team = await provider.fetchTeamStatsAsOf(100, new Date('2024-06-25T00:00:00Z'));
    expect(team?.provenance.fetchedAt.getTime()).toBe(fixed.getTime());

    const pitcher = await provider.fetchPitcherStatsAsOf(9001, new Date('2024-06-25T00:00:00Z'));
    expect(pitcher?.provenance.fetchedAt.getTime()).toBe(fixed.getTime());
  });

  it('schedule-derived pitcher assignment preserves schedule provenance', async () => {
    const scheduleFetchedAt = new Date('2024-06-25T05:00:00Z');
    const provider = new LiveMLBHistoricalProvider(
      buildDeps({
        scheduleLoader: {
          loadForDateRange: async () => [
            canonicalScheduleGame({
              homeProbablePitcherId: 101,
              homeStarterSource: 'SCHEDULE_PROBABLE_BEFORE_CUTOFF',
              provenance: {
                endpoint: '/api/v1/schedule',
                fetchedAt: scheduleFetchedAt,
                sourceTimestamp: scheduleFetchedAt,
              },
            }),
          ],
        },
      }),
    );

    const [game] = await provider.fetchGamesForDate('2024-06-25');
    expect(game.probablePitchers?.home?.fetchedAt.getTime()).toBe(
      scheduleFetchedAt.getTime(),
    );
  });
});
