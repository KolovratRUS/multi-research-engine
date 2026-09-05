import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  ScheduleResponseSchema,
  ScheduleGameSchema,
  FeedLiveResponseSchema,
  PersonStatsResponseSchema,
  PersonGameLogResponseSchema,
  TeamStatsResponseSchema,
  VenueResponseSchema,
  resolveMLBConfig,
  MLBStatsApiClient,
} from '@/lib/research-data/mlb/stats-api-client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = join(__dirname, '../../fixtures/research-data/mlb');

describe('MLB client endpoint-specific Zod validation', () => {
  it('validates schedule fixture and infers typed response', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURE_ROOT, 'schedule.json'), 'utf8'));
    const parsed = ScheduleResponseSchema.parse(raw);
    expect(parsed.dates).toHaveLength(1);
    expect(parsed.dates[0].games).toHaveLength(1);
    expect(parsed.dates[0].games[0].gamePk).toBe(100001);
    expect(parsed.dates[0].games[0].gameType).toBe('R');
    expect(parsed.dates[0].games[0].gameNumber).toBe(1);
    expect(parsed.dates[0].games[0].teams.away.team.name).toBe('Fixture Team Alpha');
  });

  it('rejects fractional gameNumber in schedule schema', () => {
    expect(() =>
      ScheduleGameSchema.parse({
        gamePk: 1,
        gameType: 'R',
        gameNumber: 1.5,
        gameDate: '2026-06-26T10:00:00.000Z',
        officialDate: '2026-06-26',
        status: { abstractGameState: 'Preview', codedGameState: 'P', detailedState: 'Pre-Game', startTimeTBD: false },
        teams: {
          away: { team: { id: 1, name: 'Away' }, leagueRecord: { wins: 0, losses: 0, pct: '.000' } },
          home: { team: { id: 2, name: 'Home' }, leagueRecord: { wins: 0, losses: 0, pct: '.000' } },
        },
        venue: { id: 1, name: 'Stadium' },
        dayNight: 'day',
        scheduledInnings: 9,
        doubleHeader: 'N',
        seriesGameNumber: 1,
        gamesInSeries: 1,
        seriesDescription: 'Regular',
      }),
    ).toThrow();
  });

  it('validates game feed fixture and infers typed response', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURE_ROOT, 'game-feed.json'), 'utf8'));
    const parsed = FeedLiveResponseSchema.parse(raw);
    expect(parsed.gamePk).toBe(100001);
    expect(parsed.gameData.teams.home.name).toBe('Fixture Team Beta');
    expect(parsed.gameData.probablePitchers!.away!.fullName).toBe('Fixture Pitcher Alpha');
  });

  it('validates pitcher season stats fixture', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURE_ROOT, 'pitcher-season.json'), 'utf8'));
    const parsed = PersonStatsResponseSchema.parse(raw);
    expect(parsed.stats).toHaveLength(1);
    expect(parsed.stats[0].splits).toHaveLength(1);
    expect(parsed.stats[0].splits[0].stat.strikeOuts).toBe(85);
  });

  it('validates pitcher game log fixture', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURE_ROOT, 'pitcher-game-log.json'), 'utf8'));
    const parsed = PersonGameLogResponseSchema.parse(raw);
    expect(parsed.stats).toHaveLength(1);
    expect(parsed.stats[0].splits).toHaveLength(3);
  });

  it('validates team hitting stats fixture', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURE_ROOT, 'team-hitting.json'), 'utf8'));
    const parsed = TeamStatsResponseSchema.parse(raw);
    expect(parsed.stats).toHaveLength(1);
    expect(parsed.stats[0].splits[0].stat.runs).toBe(180);
  });

  it('validates team pitching stats fixture', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURE_ROOT, 'team-pitching.json'), 'utf8'));
    const parsed = TeamStatsResponseSchema.parse(raw);
    expect(parsed.stats).toHaveLength(1);
    expect(parsed.stats[0].splits[0].stat.era).toBe('3.55');
  });

  it('validates venue fixture', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURE_ROOT, 'venue.json'), 'utf8'));
    const parsed = VenueResponseSchema.parse(raw);
    expect(parsed.venues).toHaveLength(1);
    expect(parsed.venues[0].name).toBe('Fixture Stadium');
  });
});

describe('MLB client environment configuration', () => {
  const originalBaseUrl = process.env.MLB_STATS_API_BASE_URL;
  const originalTimeout = process.env.RESEARCH_HTTP_TIMEOUT_MS;

  afterEach(() => {
    if (originalBaseUrl === undefined) {
      delete process.env.MLB_STATS_API_BASE_URL;
    } else {
      process.env.MLB_STATS_API_BASE_URL = originalBaseUrl;
    }
    if (originalTimeout === undefined) {
      delete process.env.RESEARCH_HTTP_TIMEOUT_MS;
    } else {
      process.env.RESEARCH_HTTP_TIMEOUT_MS = originalTimeout;
    }
  });

  it('returns default config when env vars are unset', () => {
    delete process.env.MLB_STATS_API_BASE_URL;
    delete process.env.RESEARCH_HTTP_TIMEOUT_MS;
    const config = resolveMLBConfig();
    expect(config.baseUrl).toBe('https://statsapi.mlb.com/api/v1');
    expect(config.timeoutMs).toBe(20_000);
  });

  it('reads custom base URL from env', () => {
    process.env.MLB_STATS_API_BASE_URL = 'https://example.test/api/v1';
    const config = resolveMLBConfig();
    expect(config.baseUrl).toBe('https://example.test/api/v1');
  });

  it('reads custom timeout from env', () => {
    process.env.RESEARCH_HTTP_TIMEOUT_MS = '5000';
    const config = resolveMLBConfig();
    expect(config.timeoutMs).toBe(5000);
  });

  it('throws for malformed base URL', () => {
    process.env.MLB_STATS_API_BASE_URL = 'not a url';
    expect(() => resolveMLBConfig()).toThrow('Invalid MLB_STATS_API_BASE_URL');
  });

  it('throws for non-positive timeout', () => {
    process.env.RESEARCH_HTTP_TIMEOUT_MS = '-1';
    expect(() => resolveMLBConfig()).toThrow('Invalid RESEARCH_HTTP_TIMEOUT_MS');
  });
});

describe('MLB client quiet logging behavior', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    Object.defineProperty(globalThis, 'fetch', { value: originalFetch, writable: true, configurable: true });
  });

  it('suppresses [mlb-client] diagnostics when quiet is true', async () => {
    Object.defineProperty(globalThis, 'fetch', {
      value: () =>
        Promise.resolve(
          new Response(JSON.stringify({ venues: [{ id: 1, name: 'Quiet Stadium' }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      writable: true,
      configurable: true,
    });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const client = new MLBStatsApiClient({ quiet: true });
    const result = await client.fetchVenue(1);

    expect(result.id).toBe(1);
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('retains logging behavior when quiet is omitted', async () => {
    Object.defineProperty(globalThis, 'fetch', {
      value: () =>
        Promise.resolve(
          new Response(JSON.stringify({ venues: [{ id: 2, name: 'Loud Stadium' }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      writable: true,
      configurable: true,
    });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const client = new MLBStatsApiClient();
    const result = await client.fetchVenue(2);

    expect(result.id).toBe(2);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
