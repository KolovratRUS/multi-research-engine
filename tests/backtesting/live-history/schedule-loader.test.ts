import { promises as fs } from 'node:fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { createScheduleLoader } from '@/lib/backtesting/mlb/live-history/schedule-loader';
import { createMLBHistoricalCache } from '@/lib/backtesting/mlb/live-history/cache';
import { createMLBHistoricalHttpClient } from '@/lib/backtesting/mlb/live-history/client';
import type { CanonicalHistoricalScheduleGame, MLBHistoricalCache } from '@/lib/backtesting/mlb/live-history/types';

function makeResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const schedulePayload = {
  dates: [
    {
      date: '2024-06-15',
      games: [
        {
          gamePk: 100,
          officialDate: '2024-06-15',
          gameDate: '2024-06-15T19:05:00Z',
          status: { abstractGameState: 'Preview', detailedState: 'Pre-Game' },
          teams: {
            home: { team: { id: 1, name: 'Home Team' }, probablePitcher: { id: 10, name: 'A', lastName: 'A' } },
            away: { team: { id: 2, name: 'Away Team' }, probablePitcher: { id: 20, name: 'B', lastName: 'B' } },
          },
          venue: { id: 5, name: 'Park' },
          doubleHeader: 'N',
          gameNumber: 1,
          scheduledInnings: 9,
          rescheduledFromGamePk: null,
        },
      ],
    },
  ],
};

describe('createScheduleLoader', () => {
  it('normalizes a normal game', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, schedulePayload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-schedule-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createScheduleLoader({ client, cache });
    const games = await loader.loadForDateRange('2024-06-15', '2024-06-15');
    expect(games).toHaveLength(1);
    const game: CanonicalHistoricalScheduleGame = games[0];
    expect(game.gamePk).toBe(100);
    expect(game.scheduledStart.getTime()).toBe(new Date('2024-06-15T19:05:00Z').getTime());
    expect(game.cutoffTime.getTime()).toBe(new Date('2024-06-15T18:35:00Z').getTime());
    expect(game.status).toBe('UPCOMING');
    expect(game.warnings).toEqual([]);
    expect(game.homeStarterSource).toBe('SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN');
  });

  it('warns on missing home pitcher', async () => {
    const payload = {
      dates: [
        {
          date: '2024-06-15',
          games: [
            {
              gamePk: 101,
              officialDate: '2024-06-15',
              gameDate: '2024-06-15T19:05:00Z',
              status: { abstractGameState: 'Preview', detailedState: 'Pre-Game' },
              teams: {
                home: { team: { id: 1, name: 'Home Team' }, probablePitcher: null },
                away: { team: { id: 2, name: 'Away Team' }, probablePitcher: { id: 20, name: 'B', lastName: 'B' } },
              },
              venue: null,
              doubleHeader: 'N',
              gameNumber: 1,
              scheduledInnings: null,
              rescheduledFromGamePk: null,
            },
          ],
        },
      ],
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-schedule-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createScheduleLoader({ client, cache });
    const games = await loader.loadForDateRange('2024-06-15', '2024-06-15');
    expect(games[0].warnings).toContain('missing_home_probable_pitcher');
    expect(games[0].warnings).toContain('missing_venue');
    expect(games[0].homeStarterSource).toBe('UNAVAILABLE');
  });

  it('marks unknown gameDate as invalid and skips', async () => {
    const payload = {
      dates: [
        {
          date: 'bad',
          games: [
            {
              gamePk: 102,
              officialDate: 'bad',
              gameDate: 'not-a-date',
              status: { abstractGameState: 'Preview', detailedState: 'Pre-Game' },
              teams: {
                home: { team: { id: 1, name: 'Home Team' }, probablePitcher: { id: 10, name: 'A', lastName: 'A' } },
                away: { team: { id: 2, name: 'Away Team' }, probablePitcher: { id: 20, name: 'B', lastName: 'B' } },
              },
              venue: { id: 5, name: 'Park' },
            },
          ],
        },
      ],
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-schedule-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createScheduleLoader({ client, cache });
    const games = await loader.loadForDateRange('2024-06-15', '2024-06-15');
    expect(games).toHaveLength(0);
  });

  it('cache hit avoids HTTP', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, schedulePayload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-schedule-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createScheduleLoader({ client, cache });
    await loader.loadForDateRange('2024-06-15', '2024-06-15');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const stats = cache.stats();
    expect(stats.writes).toBe(1);
    await loader.loadForDateRange('2024-06-15', '2024-06-15');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(cache.stats().hits).toBe(1);
  });

  it('preserves cache stats across calls', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => makeResponse(200, schedulePayload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-schedule-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createScheduleLoader({ client, cache });
    await loader.loadForDateRange('2024-06-15', '2024-06-15');
    await loader.loadForDateRange('2024-06-15', '2024-06-15', { forceRefresh: true });
    expect(cache.stats().writes).toBe(2);
    expect(cache.stats().misses).toBe(1);
  });

  it('shares one in-flight request for overlapping identical calls', async () => {
    let resolveFetch: (value: Response) => void;
    const promise = new Promise<Response>((resolve) => { resolveFetch = resolve; });
    const fetchImpl = vi.fn().mockReturnValueOnce(promise);
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-schedule-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createScheduleLoader({ client, cache });

    const p1 = loader.loadForDateRange('2024-06-15', '2024-06-15');
    const p2 = loader.loadForDateRange('2024-06-15', '2024-06-15');
    resolveFetch!(makeResponse(200, schedulePayload));
    const [result1, result2] = await Promise.all([p1, p2]);
    expect(result1).toHaveLength(1);
    expect(result2).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight request for overlapping identical force-refresh calls', async () => {
    let resolveFetch: (value: Response) => void;
    const promise = new Promise<Response>((resolve) => { resolveFetch = resolve; });
    const fetchImpl = vi.fn().mockReturnValueOnce(promise);
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-schedule-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createScheduleLoader({ client, cache, forceRefresh: true });

    const p1 = loader.loadForDateRange('2024-06-15', '2024-06-15');
    const p2 = loader.loadForDateRange('2024-06-15', '2024-06-15');
    resolveFetch!(makeResponse(200, schedulePayload));
    const [result1, result2] = await Promise.all([p1, p2]);
    expect(result1).toHaveLength(1);
    expect(result2).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(cache.stats().writes).toBe(1);
  });

  it('removes in-flight entry after failed request and retries on next call', async () => {
    const fetchImpl = vi.fn()
      .mockImplementationOnce(() => Promise.reject(new Error('network error')))
      .mockReturnValueOnce(makeResponse(200, schedulePayload));
    const client = createMLBHistoricalHttpClient({ fetchImpl, retryAttempts: 0 });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-schedule-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createScheduleLoader({ client, cache });

    await expect(loader.loadForDateRange('2024-06-15', '2024-06-15')).rejects.toThrow('network error');

    const games = await loader.loadForDateRange('2024-06-15', '2024-06-15');
    expect(games).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight failure for overlapping identical force-refresh calls', async () => {
    const fetchImpl = vi.fn().mockImplementationOnce(() => {
      throw new Error('network error');
    });
    const client = createMLBHistoricalHttpClient({ fetchImpl, retryAttempts: 0 });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-schedule-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createScheduleLoader({ client, cache, forceRefresh: true });

    const p1 = loader.loadForDateRange('2024-06-15', '2024-06-15');
    const p2 = loader.loadForDateRange('2024-06-15', '2024-06-15');
    const [error1, error2] = await Promise.allSettled([p1, p2]);
    expect(error1.status).toBe('rejected');
    expect(error2.status).toBe('rejected');
    const messages = [error1, error2]
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => r.reason.message);
    expect(messages).toEqual(['network error', 'network error']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    fetchImpl.mockReturnValueOnce(makeResponse(200, schedulePayload));
    const games = await loader.loadForDateRange('2024-06-15', '2024-06-15');
    expect(games).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects both concurrent callers when cache.set fails after HTTP success and retries on the same loader', async () => {
    let setCallCount = 0;
    const failingCache: MLBHistoricalCache = {
      get: async () => null,
      set: async () => {
        setCallCount += 1;
        if (setCallCount === 1) {
          throw new Error('cache write failed');
        }
        return;
      },
      stats: () => ({ hits: 0, misses: 0, writes: 0, corruptions: 0, versionMismatches: 0 }),
      clearStats: () => {},
    };
    let resolveFetch: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => { resolveFetch = resolve; });
    const fetchImpl = vi.fn().mockReturnValueOnce(fetchPromise);
    const client = createMLBHistoricalHttpClient({ fetchImpl, retryAttempts: 0 });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-schedule-'));
    const loader = createScheduleLoader({ client, cache: failingCache });

    const p1 = loader.loadForDateRange('2024-06-15', '2024-06-15');
    const p2 = loader.loadForDateRange('2024-06-15', '2024-06-15');
    await Promise.resolve();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    resolveFetch!(makeResponse(200, schedulePayload));
    const [error1, error2] = await Promise.allSettled([p1, p2]);
    expect(error1.status).toBe('rejected');
    expect(error2.status).toBe('rejected');
    if (error1.status === 'rejected') {
      expect(error1.reason.message).toBe('cache write failed');
    }
    if (error2.status === 'rejected') {
      expect(error2.reason.message).toBe('cache write failed');
    }
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(setCallCount).toBe(1);

    fetchImpl.mockReturnValueOnce(makeResponse(200, schedulePayload));
    const games = await loader.loadForDateRange('2024-06-15', '2024-06-15');
    expect(games).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(setCallCount).toBe(2);
  });

  it('uses separate in-flight entries for different date ranges', async () => {
    const fetchImpl = vi.fn().mockReturnValueOnce(makeResponse(200, schedulePayload)).mockReturnValueOnce(makeResponse(200, schedulePayload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-schedule-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createScheduleLoader({ client, cache });

    await loader.loadForDateRange('2024-06-15', '2024-06-15');
    await loader.loadForDateRange('2024-06-16', '2024-06-16');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('allows concurrent requests for different date ranges to proceed independently', async () => {
    let resolveFirst: (value: Response) => void;
    let resolveSecond: (value: Response) => void;
    const promise1 = new Promise<Response>((resolve) => { resolveFirst = resolve; });
    const promise2 = new Promise<Response>((resolve) => { resolveSecond = resolve; });
    const fetchImpl = vi.fn().mockReturnValueOnce(promise1).mockReturnValueOnce(promise2);
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-schedule-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createScheduleLoader({ client, cache });

    const p1 = loader.loadForDateRange('2024-06-15', '2024-06-15');
    const p2 = loader.loadForDateRange('2024-06-16', '2024-06-16');
    resolveFirst!(makeResponse(200, schedulePayload));
    resolveSecond!(makeResponse(200, schedulePayload));
    const [result1, result2] = await Promise.all([p1, p2]);
    expect(result1).toHaveLength(1);
    expect(result2).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('isolates in-flight entries between loader instances', async () => {
    let resolveA: (value: Response) => void;
    let resolveB: (value: Response) => void;
    const promiseA = new Promise<Response>((resolve) => { resolveA = resolve; });
    const promiseB = new Promise<Response>((resolve) => { resolveB = resolve; });
    const fetchImplA = vi.fn().mockReturnValueOnce(promiseA);
    const fetchImplB = vi.fn().mockReturnValueOnce(promiseB);
    const clientA = createMLBHistoricalHttpClient({ fetchImpl: fetchImplA });
    const clientB = createMLBHistoricalHttpClient({ fetchImpl: fetchImplB });
    const rootA = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-schedule-'));
    const rootB = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-schedule-'));
    const cacheA = createMLBHistoricalCache({ root: rootA, version: 'v1' });
    const cacheB = createMLBHistoricalCache({ root: rootB, version: 'v1' });
    const loaderA = createScheduleLoader({ client: clientA, cache: cacheA });
    const loaderB = createScheduleLoader({ client: clientB, cache: cacheB });

    const p1 = loaderA.loadForDateRange('2024-06-15', '2024-06-15');
    const p2 = loaderB.loadForDateRange('2024-06-15', '2024-06-15');
    resolveA!(makeResponse(200, schedulePayload));
    resolveB!(makeResponse(200, schedulePayload));
    const [result1, result2] = await Promise.all([p1, p2]);
    expect(result1).toHaveLength(1);
    expect(result2).toHaveLength(1);
    expect(fetchImplA).toHaveBeenCalledTimes(1);
    expect(fetchImplB).toHaveBeenCalledTimes(1);
  });

  it('cache hit preserves original cached provenance instead of current time', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, schedulePayload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-schedule-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createScheduleLoader({ client, cache, now: () => new Date('2024-06-01T12:00:00Z') });

    const first = await loader.loadForDateRange('2024-06-15', '2024-06-15');
    expect(first).toHaveLength(1);
    expect(first[0].provenance.fetchedAt).toEqual(new Date('2024-06-01T12:00:00Z'));

    await new Promise((resolve) => setTimeout(resolve, 50));
    const laterLoader = createScheduleLoader({ client, cache, now: () => new Date('2025-01-01T00:00:00Z') });
    const second = await laterLoader.loadForDateRange('2024-06-15', '2024-06-15');

    expect(second).toHaveLength(1);
    expect(second[0].provenance.fetchedAt).toEqual(new Date('2024-06-01T12:00:00Z'));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('preserves raw regular-season gameType without mapping', async () => {
    const payload = {
      dates: [
        {
          date: '2024-06-15',
          games: [
            {
              gamePk: 201,
              officialDate: '2024-06-15',
              gameDate: '2024-06-15T19:05:00Z',
              gameType: 'R',
              status: { abstractGameState: 'Preview', detailedState: 'Pre-Game' },
              teams: {
                home: { team: { id: 1, name: 'Home Team' }, probablePitcher: { id: 10, name: 'A', lastName: 'A' } },
                away: { team: { id: 2, name: 'Away Team' }, probablePitcher: { id: 20, name: 'B', lastName: 'B' } },
              },
              venue: { id: 5, name: 'Park' },
              doubleHeader: 'N',
              gameNumber: 1,
              scheduledInnings: 9,
              rescheduledFromGamePk: null,
            },
          ],
        },
      ],
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-schedule-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createScheduleLoader({ client, cache });
    const games = await loader.loadForDateRange('2024-06-15', '2024-06-15');
    expect(games).toHaveLength(1);
    expect(games[0].rawGameType).toBe('R');
  });

  it('preserves raw postseason gameType without mapping', async () => {
    const payload = {
      dates: [
        {
          date: '2024-10-15',
          games: [
            {
              gamePk: 202,
              officialDate: '2024-10-15',
              gameDate: '2024-10-15T19:05:00Z',
              gameType: 'P',
              status: { abstractGameState: 'Preview', detailedState: 'Pre-Game' },
              teams: {
                home: { team: { id: 1, name: 'Home Team' }, probablePitcher: { id: 10, name: 'A', lastName: 'A' } },
                away: { team: { id: 2, name: 'Away Team' }, probablePitcher: { id: 20, name: 'B', lastName: 'B' } },
              },
              venue: { id: 5, name: 'Park' },
              doubleHeader: 'N',
              gameNumber: 1,
              scheduledInnings: 9,
              rescheduledFromGamePk: null,
            },
          ],
        },
      ],
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-schedule-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createScheduleLoader({ client, cache });
    const games = await loader.loadForDateRange('2024-10-15', '2024-10-15');
    expect(games).toHaveLength(1);
    expect(games[0].rawGameType).toBe('P');
  });

  it('preserves raw spring-training and all-star gameTypes without mapping', async () => {
    const payload = {
      dates: [
        {
          date: '2024-02-15',
          games: [
            {
              gamePk: 203,
              officialDate: '2024-02-15',
              gameDate: '2024-02-15T19:05:00Z',
              gameType: 'S',
              status: { abstractGameState: 'Preview', detailedState: 'Pre-Game' },
              teams: {
                home: { team: { id: 1, name: 'Home Team' }, probablePitcher: { id: 10, name: 'A', lastName: 'A' } },
                away: { team: { id: 2, name: 'Away Team' }, probablePitcher: { id: 20, name: 'B', lastName: 'B' } },
              },
              venue: { id: 5, name: 'Park' },
              doubleHeader: 'N',
              gameNumber: 1,
              scheduledInnings: 9,
              rescheduledFromGamePk: null,
            },
          ],
        },
      ],
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-schedule-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createScheduleLoader({ client, cache });
    const games = await loader.loadForDateRange('2024-02-15', '2024-02-15');
    expect(games).toHaveLength(1);
    expect(games[0].rawGameType).toBe('S');
  });

  it('preserves raw exhibition gameType without mapping', async () => {
    const payload = {
      dates: [
        {
          date: '2024-02-15',
          games: [
            {
              gamePk: 204,
              officialDate: '2024-02-15',
              gameDate: '2024-02-15T19:05:00Z',
              gameType: 'I',
              status: { abstractGameState: 'Preview', detailedState: 'Pre-Game' },
              teams: {
                home: { team: { id: 1, name: 'Home Team' }, probablePitcher: { id: 10, name: 'A', lastName: 'A' } },
                away: { team: { id: 2, name: 'Away Team' }, probablePitcher: { id: 20, name: 'B', lastName: 'B' } },
              },
              venue: { id: 5, name: 'Park' },
              doubleHeader: 'N',
              gameNumber: 1,
              scheduledInnings: 9,
              rescheduledFromGamePk: null,
            },
          ],
        },
      ],
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-schedule-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createScheduleLoader({ client, cache });
    const games = await loader.loadForDateRange('2024-02-15', '2024-02-15');
    expect(games).toHaveLength(1);
    expect(games[0].rawGameType).toBe('I');
  });

  it('maps missing upstream gameType to null instead of defaulting to regular season', async () => {
    const payload = {
      dates: [
        {
          date: '2024-06-15',
          games: [
            {
              gamePk: 205,
              officialDate: '2024-06-15',
              gameDate: '2024-06-15T19:05:00Z',
              status: { abstractGameState: 'Preview', detailedState: 'Pre-Game' },
              teams: {
                home: { team: { id: 1, name: 'Home Team' }, probablePitcher: { id: 10, name: 'A', lastName: 'A' } },
                away: { team: { id: 2, name: 'Away Team' }, probablePitcher: { id: 20, name: 'B', lastName: 'B' } },
              },
              venue: { id: 5, name: 'Park' },
              doubleHeader: 'N',
              gameNumber: 1,
              scheduledInnings: 9,
              rescheduledFromGamePk: null,
            },
          ],
        },
      ],
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-schedule-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createScheduleLoader({ client, cache });
    const games = await loader.loadForDateRange('2024-06-15', '2024-06-15');
    expect(games).toHaveLength(1);
    expect(games[0].rawGameType).toBeNull();
  });

  it('preserves rawGameType across cache hit without additional fetch', async () => {
    const payload = {
      dates: [
        {
          date: '2024-06-15',
          games: [
            {
              gamePk: 206,
              officialDate: '2024-06-15',
              gameDate: '2024-06-15T19:05:00Z',
              gameType: 'A',
              status: { abstractGameState: 'Preview', detailedState: 'Pre-Game' },
              teams: {
                home: { team: { id: 1, name: 'Home Team' }, probablePitcher: { id: 10, name: 'A', lastName: 'A' } },
                away: { team: { id: 2, name: 'Away Team' }, probablePitcher: { id: 20, name: 'B', lastName: 'B' } },
              },
              venue: { id: 5, name: 'Park' },
              doubleHeader: 'N',
              gameNumber: 1,
              scheduledInnings: 9,
              rescheduledFromGamePk: null,
            },
          ],
        },
      ],
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-schedule-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createScheduleLoader({ client, cache });

    const first = await loader.loadForDateRange('2024-06-15', '2024-06-15');
    expect(first[0].rawGameType).toBe('A');

    const second = await loader.loadForDateRange('2024-06-15', '2024-06-15');
    expect(second[0].rawGameType).toBe('A');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
