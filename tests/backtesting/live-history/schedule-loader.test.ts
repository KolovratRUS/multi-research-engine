import { promises as fs } from 'node:fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { createScheduleLoader } from '@/lib/backtesting/mlb/live-history/schedule-loader';
import { createMLBHistoricalCache } from '@/lib/backtesting/mlb/live-history/cache';
import { createMLBHistoricalHttpClient } from '@/lib/backtesting/mlb/live-history/client';
import type { CanonicalHistoricalScheduleGame } from '@/lib/backtesting/mlb/live-history/types';

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
});
