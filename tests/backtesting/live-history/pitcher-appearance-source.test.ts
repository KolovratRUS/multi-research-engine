import { describe, it, expect, vi } from 'vitest';
import { createMLBHistoricalPitcherAppearanceSource } from '@/lib/backtesting/mlb/live-history/pitcher-appearance-source';
import type {
  CanonicalHistoricalScheduleGame,
  CanonicalHistoricalPitcherFeed,
  CanonicalPitcherFeedPlayer,
  HistoricalPitcherAppearance,
} from '@/lib/backtesting/mlb/live-history/types';

function baseScheduleGame(overrides: Partial<CanonicalHistoricalScheduleGame> = {}): CanonicalHistoricalScheduleGame {
  return {
    gamePk: overrides.gamePk ?? 1001,
    officialDate: '2024-06-01',
    scheduledStart: new Date('2024-06-01T19:00:00Z'),
    cutoffTime: new Date('2024-06-01T22:00:00Z'),
    status: overrides.status ?? 'FINAL',
    homeTeamId: 1,
    homeTeamName: 'Home',
    awayTeamId: 2,
    awayTeamName: 'Away',
    venueId: 1,
    venueName: 'Park',
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
      fetchedAt: new Date('2024-06-01T00:00:00Z'),
      sourceTimestamp: null,
    },
    ...overrides,
  };
}

const defaultPitchingStats: CanonicalHistoricalPitcherFeed['homePlayers'][number]['pitchingStats'] = {
  earnedRuns: 1,
  hits: 2,
  homeRuns: 0,
  strikeouts: 3,
  walks: 1,
  outs: 15,
  pitchesThrown: 90,
};

function canonicalFeed(params: {
  gamePk?: number;
  homePlayers?: readonly CanonicalPitcherFeedPlayer[];
  awayPlayers?: readonly CanonicalPitcherFeedPlayer[];
  completedAt?: Date | null;
  completedAtSource?: HistoricalPitcherAppearance['completedAtSource'];
  allPlays?: readonly { readonly about?: { readonly isComplete?: boolean; readonly endTime?: string } }[];
} = {}): CanonicalHistoricalPitcherFeed {
  const gamePk = params.gamePk ?? 1001;
  return {
    gamePk,
    status: 'FINAL',
    completedAt: params.completedAt !== undefined ? params.completedAt : new Date('2024-06-01T21:30:00Z'),
    completedAtSource: params.completedAtSource !== undefined ? params.completedAtSource : 'LAST_COMPLETED_PLAY_END',
    completionWarnings: [],
    homePlayers: params.homePlayers ?? [
      {
        personId: 1,
        gamesStarted: 1,
        pitchingStats: defaultPitchingStats,
      },
    ],
    awayPlayers: params.awayPlayers ?? [],
    allPlays: params.allPlays ?? [],
  };
}

function homePlayer(personId: number, gamesStarted: number | null, pitchingStats: CanonicalHistoricalPitcherFeed['homePlayers'][number]['pitchingStats'] = defaultPitchingStats): CanonicalPitcherFeedPlayer {
  return { personId, gamesStarted, pitchingStats };
}

describe('createMLBHistoricalPitcherAppearanceSource', () => {
  it('throws on invalid pitcherId before calling loaders', async () => {
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn() } as any,
      gameFeedLoader: { loadGameFeed: vi.fn() } as any,
    });

    await expect(source.getPitcherAppearances(0, 2024)).rejects.toThrow('Invalid pitcherId: 0');
  });

  it('throws on invalid season before calling loaders', async () => {
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn() } as any,
      gameFeedLoader: { loadGameFeed: vi.fn() } as any,
    });

    await expect(source.getPitcherAppearances(1, 0)).rejects.toThrow('Invalid season: 0');
  });

  it('filters non-final games and does not load feed for them', async () => {
    const schedule = [
      baseScheduleGame({ gamePk: 1, status: 'UPCOMING' }),
      baseScheduleGame({ gamePk: 2, status: 'FINAL' }),
    ];
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn().mockResolvedValue(schedule) },
      gameFeedLoader: { loadGameFeed: vi.fn().mockResolvedValue(canonicalFeed({ gamePk: 2, homePlayers: [homePlayer(1, 1)] })) },
    });

    const appearances = await source.getPitcherAppearances(1, 2024);

    expect(appearances).toHaveLength(1);
    expect(appearances[0].gamePk).toBe(2);
  });

  it('deduplicates by gamePk keeping later occurrence', async () => {
    const schedule = [
      baseScheduleGame({ gamePk: 1, status: 'FINAL' }),
      baseScheduleGame({ gamePk: 1, status: 'FINAL', homeTeamId: 99 }),
    ];
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn().mockResolvedValue(schedule) },
      gameFeedLoader: { loadGameFeed: vi.fn().mockResolvedValue(canonicalFeed({ gamePk: 1, homePlayers: [homePlayer(1, 1)] })) },
    });

    const appearances = await source.getPitcherAppearances(1, 2024);

    expect(appearances).toHaveLength(1);
    expect(appearances[0].teamId).toBe(99);
  });

  it('preserves doubleheaders', async () => {
    const schedule = [
      baseScheduleGame({ gamePk: 1, status: 'FINAL', gameNumber: 1 }),
      baseScheduleGame({ gamePk: 2, status: 'FINAL', gameNumber: 2 }),
    ];
    const loadGameFeed = vi.fn().mockImplementation((gamePk: number) => canonicalFeed({ gamePk, homePlayers: [homePlayer(1, 1)] }));
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn().mockResolvedValue(schedule) },
      gameFeedLoader: { loadGameFeed },
    });

    const appearances = await source.getPitcherAppearances(1, 2024);

    expect(appearances).toHaveLength(2);
    expect(loadGameFeed).toHaveBeenCalledTimes(2);
  });

  it('does not mutate the input schedule array', async () => {
    const schedule = [baseScheduleGame()];
    const original = schedule.map((game) => ({
      ...game,
      provenance: { ...game.provenance },
    }));
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn().mockResolvedValue(schedule) },
      gameFeedLoader: { loadGameFeed: vi.fn().mockResolvedValue(canonicalFeed({ gamePk: 1001 })) },
    });

    await source.getPitcherAppearances(1, 2024);

    expect(schedule).toEqual(original);
  });

  it('includes starter appearance', async () => {
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn().mockResolvedValue([baseScheduleGame()]) },
      gameFeedLoader: { loadGameFeed: vi.fn().mockResolvedValue(canonicalFeed({ homePlayers: [homePlayer(1, 1)] })) },
    });

    const appearances = await source.getPitcherAppearances(1, 2024);

    expect(appearances).toHaveLength(1);
    expect(appearances[0].started).toBe(true);
    expect(appearances[0].inningsPitched).toBe('5.0');
  });

  it('includes reliever appearance', async () => {
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn().mockResolvedValue([baseScheduleGame()]) },
      gameFeedLoader: { loadGameFeed: vi.fn().mockResolvedValue(canonicalFeed({ homePlayers: [homePlayer(1, 0, { ...defaultPitchingStats, outs: 3 })] })) },
    });

    const appearances = await source.getPitcherAppearances(1, 2024);

    expect(appearances).toHaveLength(1);
    expect(appearances[0].started).toBe(false);
    expect(appearances[0].inningsPitched).toBe('1.0');
  });

  it('excludes rostered-but-unused pitcher', async () => {
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn().mockResolvedValue([baseScheduleGame()]) },
      gameFeedLoader: { loadGameFeed: vi.fn().mockResolvedValue(canonicalFeed({ homePlayers: [] })) },
    });

    const appearances = await source.getPitcherAppearances(1, 2024);

    expect(appearances).toHaveLength(0);
  });

  it('excludes pitcher with unknown gamesStarted', async () => {
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn().mockResolvedValue([baseScheduleGame()]) },
      gameFeedLoader: { loadGameFeed: vi.fn().mockResolvedValue(canonicalFeed({ homePlayers: [homePlayer(1, null)] })) },
    });

    const appearances = await source.getPitcherAppearances(1, 2024);

    expect(appearances).toHaveLength(0);
  });

  it('excludes appearance with missing core statistics', async () => {
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn().mockResolvedValue([baseScheduleGame()]) },
      gameFeedLoader: {
        loadGameFeed: vi.fn().mockResolvedValue(
          canonicalFeed({
            homePlayers: [
              homePlayer(1, 1, {
                earnedRuns: null,
                hits: null,
                homeRuns: null,
                strikeouts: null,
                walks: null,
                outs: 15,
                pitchesThrown: 90,
              }),
            ],
          }),
        ),
      },
    });

    const appearances = await source.getPitcherAppearances(1, 2024);

    expect(appearances).toHaveLength(0);
  });

  it('preserves correct team ID', async () => {
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn().mockResolvedValue([baseScheduleGame()]) },
      gameFeedLoader: { loadGameFeed: vi.fn().mockResolvedValue(canonicalFeed({ gamePk: 1001 })) },
    });

    const appearances = await source.getPitcherAppearances(1, 2024);

    expect(appearances[0].teamId).toBe(1);
  });

  it('assigns away team for away player', async () => {
    const schedule = baseScheduleGame();
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn().mockResolvedValue([schedule]) },
      gameFeedLoader: {
        loadGameFeed: vi.fn().mockResolvedValue(
          canonicalFeed({
            gamePk: 1001,
            homePlayers: [],
            awayPlayers: [homePlayer(1, 1)],
          }),
        ),
      },
    });

    const appearances = await source.getPitcherAppearances(1, 2024);

    expect(appearances[0].teamId).toBe(2);
  });

  it('propagates valid completion proxy', async () => {
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn().mockResolvedValue([baseScheduleGame()]) },
      gameFeedLoader: {
        loadGameFeed: vi.fn().mockResolvedValue(
          canonicalFeed({
            homePlayers: [homePlayer(1, 1, { ...defaultPitchingStats, outs: 15 })],
          }),
        ),
      },
    });

    const appearances = await source.getPitcherAppearances(1, 2024);

    expect(appearances[0].completedAt).toEqual(new Date('2024-06-01T21:30:00Z'));
    expect(appearances[0].completedAtSource).toBe('LAST_COMPLETED_PLAY_END');
  });

  it('carries null completion when proxy is missing', async () => {
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn().mockResolvedValue([baseScheduleGame()]) },
      gameFeedLoader: {
        loadGameFeed: vi.fn().mockResolvedValue(
          canonicalFeed({
            completedAt: null,
            completedAtSource: null,
            homePlayers: [homePlayer(1, 1, { ...defaultPitchingStats, outs: 15 })],
          }),
        ),
      },
    });

    const appearances = await source.getPitcherAppearances(1, 2024);

    expect(appearances[0].completedAt).toBeNull();
    expect(appearances[0].completedAtSource).toBeNull();
  });

  it('sorts by completedAt then gameStart then gamePk', async () => {
    const schedule = [
      baseScheduleGame({ gamePk: 3, scheduledStart: new Date('2024-06-03T19:00:00Z') }),
      baseScheduleGame({ gamePk: 1, scheduledStart: new Date('2024-06-01T19:00:00Z') }),
      baseScheduleGame({ gamePk: 2, scheduledStart: new Date('2024-06-02T19:00:00Z') }),
    ];
    const makeFeed = (gamePk: number, completedAt: Date | null): CanonicalHistoricalPitcherFeed => {
      const completedAtSource: HistoricalPitcherAppearance['completedAtSource'] = completedAt ? 'LAST_COMPLETED_PLAY_END' : null;
      return canonicalFeed({
        gamePk,
        completedAt,
        completedAtSource,
        allPlays: completedAt ? [{ about: { isComplete: true, endTime: completedAt.toISOString() } }] : [],
      });
    };
    const callCount = { count: 0 };
    const loadGameFeed = vi.fn().mockImplementation(async (gamePk: number) => {
      callCount.count += 1;
      const date = new Date(`2024-06-0${gamePk}T21:00:00Z`);
      return makeFeed(gamePk, date);
    });
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn().mockResolvedValue(schedule) },
      gameFeedLoader: { loadGameFeed },
    });

    const appearances = await source.getPitcherAppearances(1, 2024);

    expect(appearances.map((a) => a.gamePk)).toEqual([1, 2, 3]);
    expect(callCount.count).toBe(3);
  });

  it('wraps schedule failure with context', async () => {
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: {
        loadForDateRange: vi.fn().mockRejectedValue(new Error('network down')),
      },
      gameFeedLoader: { loadGameFeed: vi.fn() },
    });

    const error = await source.getPitcherAppearances(1, 2024).catch((e) => e);
    expect(error.operation).toBe('loadSchedule');
    expect(error.context).toEqual({ pitcherId: 1, season: 2024 });
    expect(error.cause).toBeInstanceOf(Error);
  });

  it('wraps feed failure with gamePk context', async () => {
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn().mockResolvedValue([baseScheduleGame()]) },
      gameFeedLoader: {
        loadGameFeed: vi.fn().mockRejectedValue(new Error('feed down')),
      },
    });

    const error = await source.getPitcherAppearances(1, 2024).catch((e) => e);
    expect(error.operation).toBe('loadGameFeed');
    expect(error.context).toEqual({ pitcherId: 1, season: 2024, gamePk: 1001 });
  });
});
