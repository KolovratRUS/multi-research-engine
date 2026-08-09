import { promises as fs } from 'node:fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { createOutcomeLoader } from '@/lib/backtesting/mlb/live-history/outcome-loader';
import { createMLBHistoricalCache } from '@/lib/backtesting/mlb/live-history/cache';
import { createMLBHistoricalHttpClient } from '@/lib/backtesting/mlb/live-history/client';
import type { CanonicalHistoricalOutcome } from '@/lib/backtesting/mlb/live-history/types';

function makeResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const outcomePayload = {
  gamePk: 100,
  gameData: {
    status: { abstractGameState: 'Final', codedGameState: 'F', detailedState: 'Final' },
    linescore: {},
  },
  liveData: {
    linescore: { currentInning: 9, teams: { home: { runs: 3 }, away: { runs: 1 } } },
    innings: [{ num: 1, home: { runs: 0 }, away: { runs: 0 } }],
    plays: {
      allPlays: [{ about: { isComplete: true, endTime: '2024-06-01T21:35:22Z' } }],
    },
  },
};

describe('createOutcomeLoader', () => {
  it('home win with valid proxy populates completedAt', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, outcomePayload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache });
    const outcome = await loader.loadOutcome(100);
    const expected: CanonicalHistoricalOutcome = {
      gamePk: 100,
      status: 'FINAL',
      homeScore: 3,
      awayScore: 1,
      winner: 'HOME',
      innings: 9,
      completedAt: new Date('2024-06-01T21:35:22Z'),
      completedAtSource: 'LAST_COMPLETED_PLAY_END',
      warnings: [],
    };
    expect(outcome).toEqual(expected);
  });

  it('away win with valid proxy populates completedAt', async () => {
    const payload = {
      gamePk: 101,
      gameData: { status: { abstractGameState: 'Final', codedGameState: 'F', detailedState: 'Final' }, linescore: {} },
      liveData: {
        linescore: { currentInning: 9, teams: { home: { runs: 1 }, away: { runs: 4 } } },
        innings: [],
        plays: {
          allPlays: [{ about: { isComplete: true, endTime: '2024-06-01T22:52:54Z' } }],
        },
      },
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache });
    const outcome = await loader.loadOutcome(101);
    expect(outcome).toEqual({
      gamePk: 101,
      status: 'FINAL',
      homeScore: 1,
      awayScore: 4,
      winner: 'AWAY',
      innings: 9,
      completedAt: new Date('2024-06-01T22:52:54Z'),
      completedAtSource: 'LAST_COMPLETED_PLAY_END',
      warnings: [],
    });
  });

  it('upcoming/live -> UNKNOWN with null winner', async () => {
    const payload = {
      gamePk: 102,
      gameData: { status: { abstractGameState: 'Live', codedGameState: 'O', detailedState: 'In Progress' }, linescore: {} },
      liveData: { linescore: { currentInning: 5, teams: { home: { runs: 2 }, away: { runs: 2 } } }, innings: [] },
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache });
    const outcome = await loader.loadOutcome(102);
    expect(outcome).toEqual({
      gamePk: 102,
      status: 'UNKNOWN',
      homeScore: 2,
      awayScore: 2,
      winner: null,
      innings: 5,
      completedAt: null,
      completedAtSource: null,
      warnings: [],
    });
  });

  it('postponed', async () => {
    const payload = {
      gamePk: 103,
      gameData: { status: { abstractGameState: 'Preview', codedGameState: 'P', detailedState: 'Postponed' }, linescore: {} },
      liveData: { linescore: {} },
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache });
    const outcome = await loader.loadOutcome(103);
    expect(outcome).toEqual({ gamePk: 103, status: 'POSTPONED', homeScore: null, awayScore: null, winner: null, innings: null, completedAt: null, completedAtSource: null, warnings: [] });
  });

  it('cancelled', async () => {
    const payload = {
      gamePk: 104,
      gameData: { status: { abstractGameState: 'Preview', codedGameState: 'C', detailedState: 'Cancelled' }, linescore: {} },
      liveData: { linescore: {} },
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache });
    const outcome = await loader.loadOutcome(104);
    expect(outcome).toEqual({ gamePk: 104, status: 'CANCELLED', homeScore: null, awayScore: null, winner: null, innings: null, completedAt: null, completedAtSource: null, warnings: [] });
  });

  it('suspended', async () => {
    const payload = {
      gamePk: 105,
      gameData: { status: { abstractGameState: 'Live', codedGameState: 'S', detailedState: 'Suspended' }, linescore: {} },
      liveData: { linescore: {} },
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache });
    const outcome = await loader.loadOutcome(105);
    expect(outcome).toEqual({ gamePk: 105, status: 'SUSPENDED', homeScore: null, awayScore: null, winner: null, innings: null, completedAt: null, completedAtSource: null, warnings: [] });
  });

  it('missing liveData', async () => {
    const payload = {
      gamePk: 106,
      gameData: { status: { abstractGameState: 'Final', codedGameState: 'F', detailedState: 'Final' }, linescore: {} },
      liveData: {},
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache });
    const outcome = await loader.loadOutcome(106);
    expect(outcome.status).toBe('UNKNOWN');
    expect(outcome.winner).toBeNull();
    expect(outcome.warnings).toContain('missing_final_scores');
  });

  it('missing linescore', async () => {
    const payload = {
      gamePk: 107,
      gameData: { status: { abstractGameState: 'Final', codedGameState: 'F', detailedState: 'Final' }, linescore: {} },
      liveData: {},
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache });
    const outcome = await loader.loadOutcome(107);
    expect(outcome.status).toBe('UNKNOWN');
    expect(outcome.winner).toBeNull();
    expect(outcome.warnings).toContain('missing_final_scores');
  });

  it('FINAL tied results in UNKNOWN with null winner', async () => {
    const payload = {
      gamePk: 108,
      gameData: { status: { abstractGameState: 'Final', codedGameState: 'F', detailedState: 'Final' }, linescore: {} },
      liveData: { linescore: { currentInning: 9, teams: { home: { runs: 2 }, away: { runs: 2 } } }, innings: [] },
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache });
    const outcome = await loader.loadOutcome(108);
    expect(outcome.status).toBe('UNKNOWN');
    expect(outcome.winner).toBeNull();
    expect(outcome.warnings).toContain('malformed_final_tie');
  });

  it('canonical winner is never TIE', async () => {
    const payload = {
      gamePk: 109,
      gameData: { status: { abstractGameState: 'Final', codedGameState: 'F', detailedState: 'Final' }, linescore: {} },
      liveData: { linescore: { currentInning: 9, teams: { home: { runs: 5 }, away: { runs: 5 } } }, innings: [] },
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache });
    const outcome = await loader.loadOutcome(109);
    expect(outcome.winner).not.toBe('TIE');
    expect(outcome.winner).toBeNull();
  });

  it('cache hit avoids HTTP', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, outcomePayload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache });
    await loader.loadOutcome(100);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await loader.loadOutcome(100);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(cache.stats().hits).toBe(1);
  });

  it('forceRefresh performs HTTP and updates cache', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => makeResponse(200, outcomePayload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache });
    await loader.loadOutcome(100);
    await loader.loadOutcome(100, { forceRefresh: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(cache.stats().writes).toBe(2);
  });

  it('FINAL with empty allPlays warns missing_last_completed_play_end', async () => {
    const payload = {
      gamePk: 201,
      gameData: { status: { abstractGameState: 'Final', codedGameState: 'F', detailedState: 'Final' }, linescore: {} },
      liveData: {
        linescore: { currentInning: 9, teams: { home: { runs: 3 }, away: { runs: 1 } } },
        innings: [],
        plays: { allPlays: [] },
      },
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache });
    const outcome = await loader.loadOutcome(201);
    expect(outcome.status).toBe('FINAL');
    expect(outcome.completedAt).toBeNull();
    expect(outcome.completedAtSource).toBeNull();
    expect(outcome.warnings).toContain('missing_last_completed_play_end');
  });

  it('FINAL with last play missing endTime warns missing_last_completed_play_end', async () => {
    const payload = {
      gamePk: 202,
      gameData: { status: { abstractGameState: 'Final', codedGameState: 'F', detailedState: 'Final' }, linescore: {} },
      liveData: {
        linescore: { currentInning: 9, teams: { home: { runs: 3 }, away: { runs: 1 } } },
        innings: [],
        plays: { allPlays: [{ about: { isComplete: true } }] },
      },
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache });
    const outcome = await loader.loadOutcome(202);
    expect(outcome.warnings).toContain('missing_last_completed_play_end');
  });

  it('FINAL with malformed endTime warns invalid_last_completed_play_end', async () => {
    const payload = {
      gamePk: 203,
      gameData: { status: { abstractGameState: 'Final', codedGameState: 'F', detailedState: 'Final' }, linescore: {} },
      liveData: {
        linescore: { currentInning: 9, teams: { home: { runs: 3 }, away: { runs: 1 } } },
        innings: [],
        plays: { allPlays: [{ about: { isComplete: true, endTime: 'not-a-date' } }] },
      },
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache });
    const outcome = await loader.loadOutcome(203);
    expect(outcome.warnings).toContain('invalid_last_completed_play_end');
  });

  it('FINAL with last play not complete warns last_play_not_complete', async () => {
    const payload = {
      gamePk: 204,
      gameData: { status: { abstractGameState: 'Final', codedGameState: 'F', detailedState: 'Final' }, linescore: {} },
      liveData: {
        linescore: { currentInning: 9, teams: { home: { runs: 3 }, away: { runs: 1 } } },
        innings: [],
        plays: {
          allPlays: [
            { about: { isComplete: true, endTime: '2024-06-01T21:00:00Z' } },
            { about: { isComplete: false, endTime: '2024-06-01T21:30:00Z' } },
          ],
        },
      },
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache });
    const outcome = await loader.loadOutcome(204);
    expect(outcome.warnings).toContain('last_play_not_complete');
  });

  it('non-FINAL game ignores valid-looking last-play timestamp', async () => {
    const payload = {
      gamePk: 205,
      gameData: { status: { abstractGameState: 'Live', codedGameState: 'O', detailedState: 'In Progress' }, linescore: {} },
      liveData: {
        linescore: { currentInning: 7, teams: { home: { runs: 2 }, away: { runs: 2 } } },
        innings: [],
        plays: { allPlays: [{ about: { isComplete: true, endTime: '2024-06-01T20:00:00Z' } }] },
      },
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache });
    const outcome = await loader.loadOutcome(205);
    expect(outcome.completedAt).toBeNull();
    expect(outcome.completedAtSource).toBeNull();
  });

  it('multiple plays selects final array element for proxy', async () => {
    const payload = {
      gamePk: 206,
      gameData: { status: { abstractGameState: 'Final', codedGameState: 'F', detailedState: 'Final' }, linescore: {} },
      liveData: {
        linescore: { currentInning: 9, teams: { home: { runs: 3 }, away: { runs: 1 } } },
        innings: [],
        plays: {
          allPlays: [
            { about: { isComplete: true, endTime: '2024-06-01T21:00:00Z' } },
            { about: { isComplete: true, endTime: '2024-06-01T21:35:22Z' } },
          ],
        },
      },
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache });
    const outcome = await loader.loadOutcome(206);
    expect(outcome.completedAt).toEqual(new Date('2024-06-01T21:35:22Z'));
    expect(outcome.completedAtSource).toBe('LAST_COMPLETED_PLAY_END');
  });

  it('extra-inning FINAL with valid proxy parses UTC instant', async () => {
    const payload = {
      gamePk: 207,
      gameData: { status: { abstractGameState: 'Final', codedGameState: 'F', detailedState: 'Final' }, linescore: {} },
      liveData: {
        linescore: { currentInning: 10, teams: { home: { runs: 4 }, away: { runs: 2 } } },
        innings: [{ num: 1, home: { runs: 1 }, away: { runs: 1 } }],
        plays: {
          allPlays: [{ about: { isComplete: true, endTime: '2024-06-02T00:38:54.586Z' } }],
        },
      },
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache });
    const outcome = await loader.loadOutcome(207);
    expect(outcome.completedAt).toEqual(new Date('2024-06-02T00:38:54.586Z'));
    expect(outcome.completedAtSource).toBe('LAST_COMPLETED_PLAY_END');
  });

  it('zero scores remain valid UNKNOWN result', async () => {
    const payload = {
      gamePk: 208,
      gameData: { status: { abstractGameState: 'Final', codedGameState: 'F', detailedState: 'Final' }, linescore: {} },
      liveData: { linescore: { currentInning: 9, teams: { home: { runs: 0 }, away: { runs: 0 } } }, innings: [] },
    };
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache });
    const outcome = await loader.loadOutcome(208);
    expect(outcome.status).toBe('UNKNOWN');
    expect(outcome.winner).toBeNull();
    expect(outcome.homeScore).toBe(0);
    expect(outcome.awayScore).toBe(0);
  });

  it('network miss stores and returns exact acquisition provenance', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, outcomePayload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache, now: () => new Date('2024-06-01T12:00:00Z') });

    const result = await loader.loadOutcomeWithProvenance(100);

    expect(result.outcome.gamePk).toBe(100);
    expect(result.provenance.fetchedAt).toEqual(new Date('2024-06-01T12:00:00Z'));
    expect(result.provenance.endpoint).toBe('/api/v1.1/game/100/feed/live');
  });

  it('cache hit preserves original cached provenance instead of current time', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, outcomePayload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache, now: () => new Date('2024-06-01T12:00:00Z') });

    await loader.loadOutcomeWithProvenance(100);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const laterLoader = createOutcomeLoader({ client, cache, now: () => new Date('2025-01-01T00:00:00Z') });
    const result = await laterLoader.loadOutcomeWithProvenance(100);

    expect(result.provenance.fetchedAt).toEqual(new Date('2024-06-01T12:00:00Z'));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('force refresh performs new network acquisition with new provenance', async () => {
    const payload = outcomePayload;
    const fetchImpl = vi.fn().mockImplementation(() => makeResponse(200, payload));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-outcome-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const firstLoader = createOutcomeLoader({ client, cache, now: () => new Date('2024-06-01T12:00:00Z') });
    const secondLoader = createOutcomeLoader({ client, cache, now: () => new Date('2024-06-02T12:00:00Z') });

    const first = await firstLoader.loadOutcomeWithProvenance(100);
    const second = await secondLoader.loadOutcomeWithProvenance(100, { forceRefresh: true });

    expect(first.provenance.fetchedAt).toEqual(new Date('2024-06-01T12:00:00Z'));
    expect(second.provenance.fetchedAt).toEqual(new Date('2024-06-02T12:00:00Z'));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
