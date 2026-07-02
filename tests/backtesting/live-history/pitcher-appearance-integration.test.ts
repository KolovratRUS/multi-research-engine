import { promises as fs } from 'node:fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPitcherFeedLoader } from '@/lib/backtesting/mlb/live-history/pitcher-feed-loader';
import { createMLBHistoricalPitcherAppearanceSource } from '@/lib/backtesting/mlb/live-history/pitcher-appearance-source';
import { createMLBHistoricalCache } from '@/lib/backtesting/mlb/live-history/cache';
import { createMLBHistoricalHttpClient } from '@/lib/backtesting/mlb/live-history/client';
import { aggregatePitcherHistory } from '@/lib/backtesting/mlb/live-history/pitcher-aggregator';
import type { CanonicalHistoricalScheduleGame, CanonicalHistoricalPitcherFeed } from '@/lib/backtesting/mlb/live-history/types';

function makeResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function basePayload(gamePk: number, players: Record<string, unknown> = {}, allPlays: { about: { isComplete: boolean; endTime: string } }[] = []): unknown {
  return {
    gamePk,
    gameData: {
      status: {
        abstractGameState: 'Final',
        codedGameState: 'F',
        detailedState: 'Final',
      },
      linescore: {},
    },
    liveData: {
      boxscore: {
        teams: {
          home: { players: players.home ?? {} },
          away: { players: players.away ?? {} },
        },
      },
      plays: {
        allPlays,
      },
    },
  };
}

function pitchingEntry(
  playerId: number,
  gamesStarted: number | null,
  overrides: {
    outs?: number;
    earnedRuns?: number;
    hits?: number;
    homeRuns?: number;
    strikeouts?: number;
    walks?: number;
    pitchesThrown?: number;
  } = {},
): Record<string, unknown> {
  return {
    person: { id: playerId },
    stats: {
      pitching: {
        gamesPlayed: 1,
        gamesStarted,
        outs: overrides.outs ?? 15,
        earnedRuns: overrides.earnedRuns ?? 1,
        hits: overrides.hits ?? 2,
        homeRuns: overrides.homeRuns ?? 0,
        strikeOuts: overrides.strikeouts ?? 3,
        baseOnBalls: overrides.walks ?? 1,
        pitchesThrown: overrides.pitchesThrown ?? 90,
      },
    },
  };
}

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

describe('pitcher-appearance integration', () => {
  let tempRoot: string;
  let cache: ReturnType<typeof createMLBHistoricalCache>;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-pitcher-integration-'));
    cache = createMLBHistoricalCache({ root: tempRoot, version: 'v1' });
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const makeLoader = (fetchImpl: ReturnType<typeof vi.fn>) => {
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    return createPitcherFeedLoader({ client, cache });
  };

  it('starter before cutoff contributes to aggregate', async () => {
    const gamePk = 5001;
    const playerId = 1;
    const players = {
      home: {
        [playerId]: pitchingEntry(playerId, 1, { outs: 15, strikeouts: 4, walks: 0 }),
      },
    };
    const payload = basePayload(gamePk, players, [
      { about: { isComplete: true, endTime: '2024-06-01T21:30:00Z' } },
    ]);
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn().mockResolvedValue([baseScheduleGame({ gamePk })]) },
      gameFeedLoader: { loadGameFeed: makeLoader(fetchImpl).loadGameFeed.bind(makeLoader(fetchImpl)) },
    });

    const cutoff = new Date('2024-06-02T00:00:00Z');
    const appearances = await source.getPitcherAppearances(playerId, 2024, cutoff);
    const aggregate = aggregatePitcherHistory(appearances, playerId, cutoff);

    expect(appearances).toHaveLength(1);
    expect(appearances[0].started).toBe(true);
    expect(appearances[0].strikeouts).toBe(4);
    expect(appearances[0].walks).toBe(0);
    expect(aggregate.gamesStarted).toBe(1);
    expect(aggregate.strikeouts).toBe(4);
    expect(aggregate.walks).toBe(0);
    expect(aggregate.recent3Starts).toHaveLength(1);
  });

  it('starter after cutoff is excluded from aggregate', async () => {
    const gamePk = 5002;
    const playerId = 1;
    const players = {
      home: {
        [playerId]: pitchingEntry(playerId, 1, { outs: 15 }),
      },
    };
    const payload = basePayload(gamePk, players, [
      { about: { isComplete: true, endTime: '2024-06-01T21:30:00Z' } },
    ]);
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn().mockResolvedValue([baseScheduleGame({ gamePk, scheduledStart: new Date('2024-06-01T19:00:00Z') })]) },
      gameFeedLoader: { loadGameFeed: makeLoader(fetchImpl).loadGameFeed.bind(makeLoader(fetchImpl)) },
    });

    const cutoff = new Date('2024-06-01T20:00:00Z');
    const appearances = await source.getPitcherAppearances(playerId, 2024, cutoff);
    const aggregate = aggregatePitcherHistory(appearances, playerId, cutoff);

    expect(appearances).toHaveLength(1);
    expect(appearances[0].started).toBe(true);
    expect(aggregate.gamesStarted).toBe(0);
    expect(aggregate.sampleSize).toBe(0);
  });

  it('reliever before cutoff appears but does not count as start', async () => {
    const gamePk = 5003;
    const playerId = 1;
    const players = {
      home: {
        [playerId]: pitchingEntry(playerId, 0, { outs: 3 }),
      },
    };
    const payload = basePayload(gamePk, players, [
      { about: { isComplete: true, endTime: '2024-06-01T21:30:00Z' } },
    ]);
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn().mockResolvedValue([baseScheduleGame({ gamePk })]) },
      gameFeedLoader: { loadGameFeed: makeLoader(fetchImpl).loadGameFeed.bind(makeLoader(fetchImpl)) },
    });

    const cutoff = new Date('2024-06-02T00:00:00Z');
    const appearances = await source.getPitcherAppearances(playerId, 2024, cutoff);
    const aggregate = aggregatePitcherHistory(appearances, playerId, cutoff);

    expect(appearances).toHaveLength(1);
    expect(appearances[0].started).toBe(false);
    expect(aggregate.appearances).toBe(1);
    expect(aggregate.gamesStarted).toBe(0);
    expect(aggregate.recent3Starts).toHaveLength(0);
  });

  it('rostered but unused pitcher produces no appearance', async () => {
    const gamePk = 5004;
    const playerId = 1;
    const players = {
      home: {
        [playerId]: {
          person: { id: playerId },
          // no stats.pitching
        },
      },
    };
    const payload = basePayload(gamePk, players, [
      { about: { isComplete: true, endTime: '2024-06-01T21:30:00Z' } },
    ]);
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn().mockResolvedValue([baseScheduleGame({ gamePk })]) },
      gameFeedLoader: { loadGameFeed: makeLoader(fetchImpl).loadGameFeed.bind(makeLoader(fetchImpl)) },
    });

    const cutoff = new Date('2024-06-02T00:00:00Z');
    const appearances = await source.getPitcherAppearances(playerId, 2024, cutoff);

    expect(appearances).toHaveLength(0);
  });

  it('missing completion proxy excludes appearance from aggregate', async () => {
    const gamePk = 5005;
    const playerId = 1;
    const players = {
      home: {
        [playerId]: pitchingEntry(playerId, 1, { outs: 15 }),
      },
    };
    const payload = basePayload(gamePk, players, []);
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn().mockResolvedValue([baseScheduleGame({ gamePk })]) },
      gameFeedLoader: { loadGameFeed: makeLoader(fetchImpl).loadGameFeed.bind(makeLoader(fetchImpl)) },
    });

    const cutoff = new Date('2024-06-02T00:00:00Z');
    const appearances = await source.getPitcherAppearances(playerId, 2024, cutoff);
    const aggregate = aggregatePitcherHistory(appearances, playerId, cutoff);

    expect(appearances).toHaveLength(1);
    expect(appearances[0].completedAt).toBeNull();
    expect(appearances[0].completedAtSource).toBeNull();
    expect(aggregate.sampleSize).toBe(0);
  });

  it('preserves legitimate zero statistics', async () => {
    const gamePk = 5006;
    const playerId = 1;
    const players = {
      home: {
        [playerId]: pitchingEntry(playerId, 1, {
          outs: 15,
          strikeouts: 0,
          walks: 0,
          earnedRuns: 0,
          homeRuns: 0,
          hits: 0,
          pitchesThrown: 0,
        }),
      },
    };
    const payload = basePayload(gamePk, players, [
      { about: { isComplete: true, endTime: '2024-06-01T21:30:00Z' } },
    ]);
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const source = createMLBHistoricalPitcherAppearanceSource({
      scheduleLoader: { loadForDateRange: vi.fn().mockResolvedValue([baseScheduleGame({ gamePk })]) },
      gameFeedLoader: { loadGameFeed: makeLoader(fetchImpl).loadGameFeed.bind(makeLoader(fetchImpl)) },
    });

    const cutoff = new Date('2024-06-02T00:00:00Z');
    const appearances = await source.getPitcherAppearances(playerId, 2024, cutoff);
    const aggregate = aggregatePitcherHistory(appearances, playerId, cutoff);

    expect(appearances[0].strikeouts).toBe(0);
    expect(appearances[0].walks).toBe(0);
    expect(appearances[0].earnedRuns).toBe(0);
    expect(appearances[0].homeRunsAllowed).toBe(0);
    expect(appearances[0].hitsAllowed).toBe(0);
    expect(appearances[0].pitches).toBe(0);
    expect(aggregate.strikeouts).toBe(0);
    expect(aggregate.walks).toBe(0);
    expect(aggregate.earnedRuns).toBe(0);
  });
});
