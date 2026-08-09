import { promises as fs } from 'node:fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPitcherFeedLoader } from '@/lib/backtesting/mlb/live-history/pitcher-feed-loader';
import { createMLBHistoricalHttpClient } from '@/lib/backtesting/mlb/live-history/client';
import { createMLBHistoricalCache } from '@/lib/backtesting/mlb/live-history/cache';
import type { CanonicalHistoricalPitcherFeed } from '@/lib/backtesting/mlb/live-history/types';

function makeResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function basePayload(overrides: {
  gamePk?: number;
  players?: Record<string, unknown>;
  allPlays?: { about?: { isComplete?: boolean; endTime?: string } }[];
} = {}): unknown {
  return {
    gamePk: overrides.gamePk ?? 1001,
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
          home: { players: overrides.players ?? {} },
          away: { players: {} },
        },
      },
      plays: {
        allPlays: overrides.allPlays ?? [{ about: { isComplete: true, endTime: '2024-06-01T21:30:00Z' } }],
      },
    },
    ...overrides,
  };
}

describe('createPitcherFeedLoader', () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-pitcher-feed-'));
  });

  it('maps final and returns completed proxy', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, basePayload()));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const cache = createMLBHistoricalCache({ root: tempRoot, version: 'v1' });
    const loader = createPitcherFeedLoader({ client, cache });

    const feed = await loader.loadGameFeed(1001);

    expect(feed.status).toBe('FINAL');
    expect(feed.completedAt).toEqual(new Date('2024-06-01T21:30:00Z'));
    expect(feed.completionWarnings).toHaveLength(0);
  });

  it('includes starter and reliever players', async () => {
    const payload = basePayload({
      players: {
        '1': {
          person: { id: 1 },
          stats: { pitching: { gamesStarted: 1, outs: 15 } },
        },
        '2': {
          person: { id: 2 },
          stats: { pitching: { gamesStarted: 0, outs: 3 } },
        },
      },
    });
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const cache = createMLBHistoricalCache({ root: tempRoot, version: 'v1' });
    const loader = createPitcherFeedLoader({ client, cache });

    const feed = await loader.loadGameFeed(1001);

    expect(feed.homePlayers.map((p) => p.personId)).toEqual([1, 2]);
    expect(feed.homePlayers[0].gamesStarted).toBe(1);
    expect(feed.homePlayers[1].gamesStarted).toBe(0);
  });

  it('excludes rostered player without pitching stats', async () => {
    const payload = basePayload({
      players: {
        '1': { person: { id: 1 } },
      },
    });
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const cache = createMLBHistoricalCache({ root: tempRoot, version: 'v1' });
    const loader = createPitcherFeedLoader({ client, cache });

    const feed = await loader.loadGameFeed(1001);

    expect(feed.homePlayers).toHaveLength(0);
  });

  it('excludes player with no pitching entry', async () => {
    const payload = basePayload({
      players: {
        '1': { person: { id: 1 }, stats: {} },
      },
    });
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const cache = createMLBHistoricalCache({ root: tempRoot, version: 'v1' });
    const loader = createPitcherFeedLoader({ client, cache });

    const feed = await loader.loadGameFeed(1001);

    expect(feed.homePlayers).toHaveLength(0);
  });

  it('preserves zero statistics', async () => {
    const payload = basePayload({
      players: {
        '1': {
          person: { id: 1 },
          stats: { pitching: { gamesStarted: 1, outs: 0, earnedRuns: 0, hits: 0, homeRuns: 0, strikeOuts: 0, baseOnBalls: 0, pitchesThrown: 0 } },
        },
      },
    });
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const cache = createMLBHistoricalCache({ root: tempRoot, version: 'v1' });
    const loader = createPitcherFeedLoader({ client, cache });

    const feed = await loader.loadGameFeed(1001);

    const player = feed.homePlayers[0];
    expect(player.pitchingStats.earnedRuns).toBe(0);
    expect(player.pitchingStats.strikeouts).toBe(0);
    expect(player.pitchingStats.walks).toBe(0);
    expect(player.pitchingStats.hits).toBe(0);
    expect(player.pitchingStats.homeRuns).toBe(0);
    expect(player.pitchingStats.pitchesThrown).toBe(0);
  });

  it('leaves missing statistics null', async () => {
    const payload = basePayload({
      players: {
        '1': {
          person: { id: 1 },
          stats: { pitching: { gamesStarted: 1, outs: 15 } },
        },
      },
    });
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const cache = createMLBHistoricalCache({ root: tempRoot, version: 'v1' });
    const loader = createPitcherFeedLoader({ client, cache });

    const feed = await loader.loadGameFeed(1001);

    const stats = feed.homePlayers[0].pitchingStats;
    expect(stats.earnedRuns).toBeNull();
    expect(stats.strikeouts).toBeNull();
    expect(stats.walks).toBeNull();
    expect(stats.hits).toBeNull();
    expect(stats.homeRuns).toBeNull();
    expect(stats.pitchesThrown).toBeNull();
  });

  it('rejects invalid outs values', async () => {
    const payloadInvalid = basePayload({
      players: { '1': { person: { id: 1 }, stats: { pitching: { gamesStarted: 1, outs: 5.3 } } } },
    });
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payloadInvalid));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const cache = createMLBHistoricalCache({ root: tempRoot, version: 'v1' });
    const loader = createPitcherFeedLoader({ client, cache });

    const feed = await loader.loadGameFeed(1001);
    expect(feed.homePlayers).toHaveLength(0);
  });

  it('maps completion proxy correctly', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, basePayload()));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const cache = createMLBHistoricalCache({ root: tempRoot, version: 'v1' });
    const loader = createPitcherFeedLoader({ client, cache });

    const feed = await loader.loadGameFeed(1001);

    expect(feed.completedAt).toEqual(new Date('2024-06-01T21:30:00Z'));
    expect(feed.completedAtSource).toBe('LAST_COMPLETED_PLAY_END');
  });

  it('reuses cache and avoids second HTTP call', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, basePayload()));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const cache = createMLBHistoricalCache({ root: tempRoot, version: 'v1' });
    const loader = createPitcherFeedLoader({ client, cache });

    await loader.loadGameFeed(1001);
    await loader.loadGameFeed(1001);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('revalidates with forceRefresh', async () => {
    const makePayload = () => basePayload();
    const fetchImpl = vi.fn().mockImplementation(() => makeResponse(200, makePayload()));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const cache = createMLBHistoricalCache({ root: tempRoot, version: 'v1' });
    const loader = createPitcherFeedLoader({ client, cache, forceRefresh: false });

    await loader.loadGameFeed(1001);
    const refreshedLoader = createPitcherFeedLoader({ client, cache, forceRefresh: true });
    await refreshedLoader.loadGameFeed(1001);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws on schema failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, { invalid: true }));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const cache = createMLBHistoricalCache({ root: tempRoot, version: 'v1' });
    const loader = createPitcherFeedLoader({ client, cache });

    await expect(loader.loadGameFeed(1001)).rejects.toThrow();
  });

  it('does not mutate the raw payload', async () => {
    const payload = basePayload();
    const frozen = JSON.parse(JSON.stringify(payload));
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const cache = createMLBHistoricalCache({ root: tempRoot, version: 'v1' });
    const loader = createPitcherFeedLoader({ client, cache });

    await loader.loadGameFeed(1001);

    expect(payload).toEqual(frozen);
  });

  it('network miss stores and returns exact acquisition provenance', async () => {
    const payload = basePayload();
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const cache = createMLBHistoricalCache({ root: tempRoot, version: 'v1' });
    const loader = createPitcherFeedLoader({ client, cache, now: () => new Date('2024-06-01T12:00:00Z') });

    const result = await loader.loadGameFeedWithProvenance(1001);

    expect(result.feed.gamePk).toBe(1001);
    expect(result.provenance.fetchedAt).toEqual(new Date('2024-06-01T12:00:00Z'));
    expect(result.provenance.endpoint).toBe('/api/v1.1/game/{gamePk}/feed/live');
  });

  it('cache hit preserves original cached provenance instead of current time', async () => {
    const payload = basePayload();
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const cache = createMLBHistoricalCache({ root: tempRoot, version: 'v1' });
    const loader = createPitcherFeedLoader({ client, cache, now: () => new Date('2024-06-01T12:00:00Z') });

    await loader.loadGameFeedWithProvenance(1001);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const laterLoader = createPitcherFeedLoader({ client, cache, now: () => new Date('2025-01-01T00:00:00Z') });
    const result = await laterLoader.loadGameFeedWithProvenance(1001);

    expect(result.feed.gamePk).toBe(1001);
    expect(result.provenance.fetchedAt).toEqual(new Date('2024-06-01T12:00:00Z'));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('force refresh performs new network acquisition with new provenance', async () => {
    const payload = basePayload();
    const fetchImpl = vi.fn().mockImplementation(() => makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const cache = createMLBHistoricalCache({ root: tempRoot, version: 'v1' });
    const firstLoader = createPitcherFeedLoader({ client, cache, now: () => new Date('2024-06-01T12:00:00Z') });
    const secondLoader = createPitcherFeedLoader({ client, cache, now: () => new Date('2024-06-02T12:00:00Z') });

    const first = await firstLoader.loadGameFeedWithProvenance(1001);
    const second = await secondLoader.loadGameFeedWithProvenance(1001, { forceRefresh: true });

    expect(first.provenance.fetchedAt).toEqual(new Date('2024-06-01T12:00:00Z'));
    expect(second.provenance.fetchedAt).toEqual(new Date('2024-06-02T12:00:00Z'));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
