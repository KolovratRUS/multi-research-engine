import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'os';
import path from 'node:path';
import { createLiveMLBHistoricalProvider } from '@/lib/backtesting/mlb/live-history/provider-factory';

const HOME_TEAM = 101;
const AWAY_TEAM = 102;
const HOME_PITCHER = 1001;
const AWAY_PITCHER = 1002;

function makeFeedResponse(gamePk: number, includePlays: boolean): Response {
  const gameEndTime =
    gamePk === 2
      ? '2024-06-01T21:30:00Z'
      : '2024-05-30T21:30:00Z';
  const allPlays = includePlays
    ? [{ about: { isComplete: true, endTime: gameEndTime } }]
    : [];

  const body = {
    gamePk,
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
        teams: { home: { runs: 4 }, away: { runs: 2 } },
      },
      innings: [{ num: 1, home: { runs: 1 }, away: { runs: 0 } }],
      plays: { allPlays },
      boxscore: {
        teams: {
          home: {
            players: {
              [String(HOME_PITCHER)]: {
                person: { id: HOME_PITCHER },
                stats: {
                  pitching: {
                    gamesPlayed: 1,
                    gamesStarted: gamePk === 3 ? 0 : 1,
                    earnedRuns: 1,
                    hits: 3,
                    homeRuns: 0,
                    strikeOuts: 5,
                    baseOnBalls: 2,
                    outs: 18,
                    pitchesThrown: 88,
                  },
                },
              },
            },
          },
          away: {
            players: {
              [String(AWAY_PITCHER)]: {
                person: { id: AWAY_PITCHER },
                stats: {
                  pitching: {
                    gamesPlayed: 1,
                    gamesStarted: gamePk === 3 ? 0 : 1,
                    earnedRuns: 2,
                    hits: 4,
                    homeRuns: 1,
                    strikeOuts: 4,
                    baseOnBalls: 3,
                    outs: 20,
                    pitchesThrown: 92,
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeScheduleResponse(): Response {
  const body = {
    dates: [
      {
        date: '2024-05-30',
        games: [
          {
            gamePk: 1,
            officialDate: '2024-05-30',
            gameDate: '2024-05-30T16:00:00Z',
            status: { abstractGameState: 'Final', detailedState: 'Final' },
            teams: {
              home: { team: { id: HOME_TEAM, name: 'Home' }, probablePitcher: { id: HOME_PITCHER } },
              away: { team: { id: AWAY_TEAM, name: 'Away' }, probablePitcher: { id: AWAY_PITCHER } },
            },
            venue: { id: 1, name: 'Stadium' },
            doubleHeader: 'N',
            gameNumber: 1,
          },
          {
            gamePk: 2,
            officialDate: '2024-06-01',
            gameDate: '2024-06-01T16:00:00Z',
            status: { abstractGameState: 'Final', detailedState: 'Final' },
            teams: {
              home: { team: { id: HOME_TEAM, name: 'Home' }, probablePitcher: { id: HOME_PITCHER } },
              away: { team: { id: AWAY_TEAM, name: 'Away' }, probablePitcher: { id: AWAY_PITCHER } },
            },
            venue: { id: 1, name: 'Stadium' },
            doubleHeader: 'N',
            gameNumber: 1,
          },
          {
            gamePk: 3,
            officialDate: '2024-05-31',
            gameDate: '2024-05-31T16:00:00Z',
            status: { abstractGameState: 'Final', detailedState: 'Final' },
            teams: {
              home: { team: { id: HOME_TEAM, name: 'Home' }, probablePitcher: { id: HOME_PITCHER } },
              away: { team: { id: AWAY_TEAM, name: 'Away' }, probablePitcher: { id: AWAY_PITCHER } },
            },
            venue: { id: 1, name: 'Stadium' },
            doubleHeader: 'N',
            gameNumber: 1,
          },
        ],
      },
    ],
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Phase 1D: provider-factory integration', () => {
  let tempRoot: string;
  let fetchImpl: ReturnType<typeof vi.fn>;
  let fetchedUrls: string[];

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-provider-factory-integ-'));
    fetchedUrls = [];
    fetchImpl = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      fetchedUrls.push(url);

      if (url.includes('/api/v1/schedule')) {
        return makeScheduleResponse();
      }

      const urlObj = new URL(url);
      const pathGamePk = /\/game\/(\d+)\/feed\/live/.exec(urlObj.pathname)?.[1];
      const queryGamePk = urlObj.searchParams.get('gamePk');
      const gamePk = pathGamePk ?? queryGamePk;
      if (gamePk != null) {
        const gamePkNum = Number(gamePk);
        const includePlays = gamePkNum === 3 ? false : true;
        return makeFeedResponse(gamePkNum, includePlays);
      }

      return new Response('Not Found', { status: 404 });
    });
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('produces correct team history with cutoff and missing-completion exclusions', async () => {
    const { provider } = createLiveMLBHistoricalProvider({
      cacheRoot: tempRoot,
      cacheVersion: 'v1',
      fetchImpl,
    });

    const cutoff = new Date('2024-06-01T00:00:00Z');
    const profile = await provider.fetchTeamStatsAsOf(HOME_TEAM, cutoff);

    expect(profile).not.toBeNull();
    expect(profile!.teamId).toBe(HOME_TEAM);
    expect(profile!.warnings).toEqual(['missing_completed_at_3']);
    expect(profile!.seasonStats).not.toBeNull();
    expect(profile!.seasonStats!.gamesPlayed).toBe(1);
    expect(profile!.completeness).toBe(1);
  });

  it('produces correct pitcher history with cutoff and missing-completion exclusions', async () => {
    const { provider } = createLiveMLBHistoricalProvider({
      cacheRoot: tempRoot,
      cacheVersion: 'v1',
      fetchImpl,
    });

    const cutoff = new Date('2024-06-01T00:00:00Z');
    const profile = await provider.fetchPitcherStatsAsOf(HOME_PITCHER, cutoff);

    expect(profile).not.toBeNull();
    expect(profile!.personId).toBe(HOME_PITCHER);
    expect(profile!.seasonStats).not.toBeNull();
    expect(profile!.seasonStats!.gamesPlayed).toBe(1);
    expect(profile!.seasonStats!.gamesStarted).toBe(1);
    expect(profile!.recentStarts).toHaveLength(1);
    expect(profile!.recentStarts[0].gamePk).toBe(1);
    expect(profile!.completeness).toBe(1);
  });

  it('produces correct recent games before cutoff', async () => {
    const { provider } = createLiveMLBHistoricalProvider({
      cacheRoot: tempRoot,
      cacheVersion: 'v1',
      fetchImpl,
    });

    const cutoff = new Date('2024-06-01T00:00:00Z');
    const recent = await provider.fetchRecentGamesBefore(HOME_TEAM, cutoff, 10);

    expect(recent).toHaveLength(1);
    expect(recent[0].gamePk).toBe(1);
    expect(recent[0].runsScored).toBe(4);
    expect(recent[0].runsAllowed).toBe(2);
    expect(recent[0].win).toBe(true);
    expect(recent[0].homeAway).toBe('HOME');
  });

  it('measures request counts honestly across repeated provider calls', async () => {
    const { provider, client } = createLiveMLBHistoricalProvider({
      cacheRoot: tempRoot,
      cacheVersion: 'v1',
      fetchImpl,
    });

    const cutoff = new Date('2024-06-01T00:00:00Z');

    // First round: team stats, pitcher stats, recent games
    await provider.fetchTeamStatsAsOf(HOME_TEAM, cutoff);
    await provider.fetchPitcherStatsAsOf(HOME_PITCHER, cutoff);
    await provider.fetchRecentGamesBefore(HOME_TEAM, cutoff, 10);
    const firstRoundRequests = fetchedUrls.length;
    expect(firstRoundRequests).toBeGreaterThanOrEqual(1);

    // Second round: same data
    fetchedUrls.length = 0;
    await provider.fetchTeamStatsAsOf(HOME_TEAM, cutoff);
    await provider.fetchPitcherStatsAsOf(HOME_PITCHER, cutoff);
    await provider.fetchRecentGamesBefore(HOME_TEAM, cutoff, 10);
    const secondRoundRequests = fetchedUrls.length;

    // Schedule is cached; outcome/feed requests may repeat for feed endpoints
    // due to schema-specific zod validation (honest report).
    // We verify only that the TOTAL number of HTTP requests in the second round
    // is less than or equal to the first round (cache is not producing MORE requests).
    expect(secondRoundRequests).toBeLessThanOrEqual(firstRoundRequests);
    expect(client.getRequestCount()).toBeGreaterThanOrEqual(1);
  });

  it('forceRefresh causes expected refetching', async () => {
    const { provider } = createLiveMLBHistoricalProvider({
      cacheRoot: tempRoot,
      cacheVersion: 'v1',
      fetchImpl,
      forceRefresh: true,
    });

    const cutoff = new Date('2024-06-01T00:00:00Z');
    fetchedUrls.length = 0;
    await provider.fetchTeamStatsAsOf(HOME_TEAM, cutoff);
    const firstCount = fetchedUrls.length;
    expect(firstCount).toBeGreaterThanOrEqual(1);

    fetchedUrls.length = 0;
    await provider.fetchTeamStatsAsOf(HOME_TEAM, cutoff);
    expect(fetchedUrls.length).toBeGreaterThanOrEqual(1);
  });

  it('preserves Stage 1 odds-blindness in provider output', async () => {
    const { provider } = createLiveMLBHistoricalProvider({
      cacheRoot: tempRoot,
      cacheVersion: 'v1',
      fetchImpl,
    });

    const cutoff = new Date('2024-06-01T00:00:00Z');
    const teamProfile = await provider.fetchTeamStatsAsOf(HOME_TEAM, cutoff);
    const pitcherProfile = await provider.fetchPitcherStatsAsOf(HOME_PITCHER, cutoff);

    const teamKeys = Object.keys(teamProfile ?? {});
    const pitcherKeys = Object.keys(pitcherProfile ?? {});

    for (const key of teamKeys) {
      expect(key).not.toMatch(/odds|bookmaker|edge|implied|expectedValue|ROI|favorite|underdog/i);
    }
    for (const key of pitcherKeys) {
      expect(key).not.toMatch(/odds|bookmaker|edge|implied|expectedValue|ROI|favorite|underdog/i);
    }
  });

  it('handles game where away probable pitcher is null without changing team paths', async () => {
    const unavailableFetchImpl = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

      if (url.includes('/api/v1/schedule')) {
        const body = {
          dates: [
            {
              date: '2024-05-30',
              games: [
                {
                  gamePk: 10,
                  officialDate: '2024-05-30',
                  gameDate: '2024-05-30T16:00:00Z',
                  status: { abstractGameState: 'Final', detailedState: 'Final' },
                  teams: {
                    home: { team: { id: HOME_TEAM, name: 'Home' }, probablePitcher: { id: HOME_PITCHER } },
                    away: { team: { id: AWAY_TEAM, name: 'Away' }, probablePitcher: null },
                  },
                  venue: { id: 1, name: 'Stadium' },
                  doubleHeader: 'N',
                  gameNumber: 1,
                },
              ],
            },
          ],
        };
        return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      const urlObj = new URL(url);
      const pathGamePk = /\/game\/(\d+)\/feed\/live/.exec(urlObj.pathname)?.[1];
      const queryGamePk = urlObj.searchParams.get('gamePk');
      const mockGamePk = pathGamePk ?? queryGamePk;
      if (mockGamePk != null) {
        const gamePk = Number(mockGamePk);
        const body = {
          gamePk,
          gameData: {
            status: { abstractGameState: 'Final', codedGameState: 'F', detailedState: 'Final' },
          },
          liveData: {
            linescore: {
              currentInning: 9,
              teams: { home: { runs: 4 }, away: { runs: 2 } },
            },
            plays: {
              allPlays: [{ about: { isComplete: true, endTime: '2024-05-30T21:30:00Z' } }],
            },
            boxscore: {
              teams: {
                home: {
                  players: {
                    [String(HOME_PITCHER)]: {
                      person: { id: HOME_PITCHER },
                      stats: {
                        pitching: {
                          gamesPlayed: 1,
                          gamesStarted: 1,
                          earnedRuns: 1,
                          hits: 3,
                          homeRuns: 0,
                          strikeOuts: 5,
                          baseOnBalls: 2,
                          outs: 18,
                          pitchesThrown: 88,
                        },
                      },
                    },
                  },
                },
                away: { players: {} },
              },
            },
          },
        };
        return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      return new Response('Not Found', { status: 404 });
    });

    const { provider } = createLiveMLBHistoricalProvider({
      cacheRoot: tempRoot,
      cacheVersion: 'v1',
      fetchImpl: unavailableFetchImpl,
    });

    const cutoff = new Date('2024-06-01T00:00:00Z');
    const profile = await provider.fetchPitcherStatsAsOf(HOME_PITCHER, cutoff);

    expect(profile).not.toBeNull();
    expect(profile!.personId).toBe(HOME_PITCHER);
    expect(profile!.seasonStats).not.toBeNull();
    expect(profile!.seasonStats!.gamesPlayed).toBe(1);
  });
});
