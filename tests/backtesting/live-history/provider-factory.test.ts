import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'os';
import path from 'node:path';
import { createLiveMLBHistoricalProvider } from '@/lib/backtesting/mlb/live-history/provider-factory';

describe('LiveMLBHistoricalProviderFactory', () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-provider-factory-'));
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const makeScheduleResponse = (games: unknown[] = []) => ({
    dates: [{ date: '2024-06-01', games }],
  });

  const makeScheduleGame = (overrides: Record<string, unknown> = {}): unknown => ({
    gamePk: 1001,
    officialDate: '2024-06-01',
    gameDate: '2024-06-01T16:00:00Z',
    status: { abstractGameState: 'Final', detailedState: 'Final' },
    teams: {
      home: {
        team: { id: 101, name: 'Home' },
        probablePitcher: { id: 1001 },
      },
      away: {
        team: { id: 102, name: 'Away' },
        probablePitcher: { id: 1002 },
      },
    },
    venue: { id: 1, name: 'Stadium' },
    doubleHeader: 'N',
    gameNumber: 1,
    scheduledInnings: 9,
    ...overrides,
  });

  const makeFeedPayload = (overrides: Record<string, unknown> = {}): unknown => ({
    gamePk: 1001,
    gameData: {
      status: {
        abstractGameState: 'Final',
        codedGameState: 'F',
        detailedState: 'Final',
      },
    },
    liveData: {
      linescore: {
        currentInning: 9,
        teams: { home: { runs: 3 }, away: { runs: 1 } },
      },
      innings: [{ num: 1, home: { runs: 1 }, away: { runs: 0 } }],
      plays: {
        allPlays: [{ about: { isComplete: true, endTime: '2024-06-01T21:30:00Z' } }],
      },
    },
    ...overrides,
  });

  const makeResponse = (status: number, body: unknown): Response => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  it('constructs a provider with shared client, cache, and loaders', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, {}));
    const result = createLiveMLBHistoricalProvider({
      cacheRoot: tempRoot,
      cacheVersion: 'v1',
      fetchImpl,
    });

    expect(result.provider).toBeDefined();
    expect(result.client).toBeDefined();
    expect(result.cache).toBeDefined();
    expect(result.scheduleLoader).toBeDefined();
    expect(result.outcomeLoader).toBeDefined();
    expect(result.teamGameSource).toBeDefined();
    expect(result.pitcherFeedLoader).toBeDefined();
    expect(result.pitcherAppearanceSource).toBeDefined();
    expect(result.deps).toBeDefined();

    // No network call during construction
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('propagates custom fetchImpl, timeout, and retry options',async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => makeResponse(200, makeScheduleResponse()));
    const result = createLiveMLBHistoricalProvider({
      cacheRoot: tempRoot,
      cacheVersion: 'v1',
      fetchImpl,
      timeoutMs: 55_000,
      maxRetries: 5,
    });

    await result.scheduleLoader.loadForDateRange('2024-06-01', '2024-06-01');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('propagates custom now to loaders cache provenance', async () => {
    const customNow = new Date('2024-06-01T12:00:00Z');
    const nowSpy = vi.fn().mockReturnValue(customNow);
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, makeScheduleResponse()));
    const result = createLiveMLBHistoricalProvider({
      cacheRoot: tempRoot,
      cacheVersion: 'v1',
      fetchImpl,
      now: nowSpy,
    });

    const games = await result.scheduleLoader.loadForDateRange('2024-06-01', '2024-06-01');
    expect(games).toHaveLength(0);
    expect(nowSpy).toHaveBeenCalled();
  });

  it('reuses the same dependency graph across repeated calls', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, makeScheduleResponse([makeScheduleGame()])));
    const result = createLiveMLBHistoricalProvider({
      cacheRoot: tempRoot,
      cacheVersion: 'v1',
      fetchImpl,
    });

    await result.scheduleLoader.loadForDateRange('2024-06-01', '2024-06-01');
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await result.scheduleLoader.loadForDateRange('2024-06-01', '2024-06-01');
    // Cache hit on second identical call when forceRefresh is false
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('forceRefresh triggers refetch even when cache would otherwise hit', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => makeResponse(200, makeScheduleResponse([makeScheduleGame()])));
    const result = createLiveMLBHistoricalProvider({
      cacheRoot: tempRoot,
      cacheVersion: 'v1',
      fetchImpl,
      forceRefresh: true,
    });

    await result.scheduleLoader.loadForDateRange('2024-06-01', '2024-06-01');
    const firstCount = fetchImpl.mock.calls.length;
    expect(firstCount).toBeGreaterThanOrEqual(1);

    await result.scheduleLoader.loadForDateRange('2024-06-01', '2024-06-01');
    expect(fetchImpl.mock.calls.length).toBe(firstCount + 1);
  });

  it('produces isolated caches for different roots', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => makeResponse(200, makeScheduleResponse([makeScheduleGame()])));
    const resultA = createLiveMLBHistoricalProvider({
      cacheRoot: path.join(tempRoot, 'a'),
      cacheVersion: 'v1',
      fetchImpl,
    });

    const resultB = createLiveMLBHistoricalProvider({
      cacheRoot: path.join(tempRoot, 'b'),
      cacheVersion: 'v2',
      fetchImpl,
    });

    await resultA.scheduleLoader.loadForDateRange('2024-06-01', '2024-06-01');
    await resultB.scheduleLoader.loadForDateRange('2024-06-01', '2024-06-01');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('tracks request counts through shared client', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => makeResponse(200, makeScheduleResponse([makeScheduleGame()])));
    const result = createLiveMLBHistoricalProvider({
      cacheRoot: tempRoot,
      cacheVersion: 'v1',
      fetchImpl,
    });

    expect(result.client.getRequestCount()).toBe(0);
    await result.scheduleLoader.loadForDateRange('2024-06-01', '2024-06-01');
    expect(result.client.getRequestCount()).toBeGreaterThanOrEqual(1);
  });

  it('does not import or reference Stage 2 brokerage types', async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), 'src/lib/backtesting/mlb/live-history/provider-factory.ts'),
      'utf8',
    );
    const forbidden = [
      'OddsProvider',
      'Bookmaker',
      'PricedCandidate',
      'decimalOdds',
      'impliedProbability',
      'expectedValue',
      'ROI',
      'edge',
    ];
    for (const token of forbidden) {
      expect(source).not.toContain(token);
    }
  });
});
