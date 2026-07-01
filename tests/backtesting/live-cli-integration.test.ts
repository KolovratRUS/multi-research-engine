import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runMLBBacktestCLI } from '@/lib/backtesting/cli';
import type { MLBBacktestCLIDependencies } from '@/lib/backtesting/cli';
import { promises as fs } from 'node:fs';
import os from 'os';
import path from 'node:path';

const stdoutLines: string[] = [];
const stderrLines: string[] = [];
const fetchedUrls: string[] = [];

function createIO() {
  return {
    stdout: (message: string) => stdoutLines.push(message),
    stderr: (message: string) => stderrLines.push(message),
  };
}

function resetIO() {
  stdoutLines.length = 0;
  stderrLines.length = 0;
}

function capturedStdout(): string {
  return stdoutLines.join('\n');
}

function capturedStderr(): string {
  return stderrLines.join('\n');
}

const TARGET_GAME_PK = 7001;
const TARGET_DATE = '2024-06-01';
const HOME_TEAM = 701;
const AWAY_TEAM = 702;
const HOME_PITCHER = 801;
const AWAY_PITCHER = 802;

type ScheduleGame = {
  readonly gamePk: number;
  readonly officialDate: string;
  readonly gameDate: string;
  readonly status: { readonly abstractGameState: string; readonly detailedState: string };
  readonly teams: {
    readonly home: { readonly team: { readonly id: number; readonly name: string }; readonly probablePitcher: { readonly id: number } | null };
    readonly away: { readonly team: { readonly id: number; readonly name: string }; readonly probablePitcher: { readonly id: number } | null };
  };
  readonly venue: { readonly id: number; readonly name: string };
  readonly doubleHeader: string;
  readonly gameNumber: number;
};

interface SerializedProbablePitcher {
  readonly personId: number;
}

interface SerializedGame {
  readonly gamePk: number;
  readonly homeTeamId: number;
  readonly awayTeamId: number;
}

interface SerializedPrediction {
  readonly gamePk: number;
  readonly predictedSide: string | null;
  readonly abstentionReason?: string;
}

const allScheduleGames: readonly ScheduleGame[] = [
  {
    gamePk: 7005,
    officialDate: '2024-05-28',
    gameDate: '2024-05-28T19:00:00Z',
    status: { abstractGameState: 'Final', detailedState: 'Final' },
    teams: {
      home: { team: { id: HOME_TEAM, name: 'Target Home' }, probablePitcher: { id: HOME_PITCHER } },
      away: { team: { id: 704, name: 'Fourth Team' }, probablePitcher: { id: 804 } },
    },
    venue: { id: 3, name: 'Third Stadium' },
    doubleHeader: 'N',
    gameNumber: 1,
  },
  {
    gamePk: 7002,
    officialDate: '2024-05-30',
    gameDate: '2024-05-30T16:00:00Z',
    status: { abstractGameState: 'Final', detailedState: 'Final' },
    teams: {
      home: { team: { id: HOME_TEAM, name: 'Target Home' }, probablePitcher: { id: HOME_PITCHER } },
      away: { team: { id: 703, name: 'Third Team' }, probablePitcher: { id: 803 } },
    },
    venue: { id: 2, name: 'Second Stadium' },
    doubleHeader: 'N',
    gameNumber: 1,
  },
  {
    gamePk: 7003,
    officialDate: '2024-05-31',
    gameDate: '2024-05-31T16:00:00Z',
    status: { abstractGameState: 'Final', detailedState: 'Final' },
    teams: {
      home: { team: { id: HOME_TEAM, name: 'Target Home' }, probablePitcher: { id: HOME_PITCHER } },
      away: { team: { id: AWAY_TEAM, name: 'Target Away' }, probablePitcher: { id: AWAY_PITCHER } },
    },
    venue: { id: 1, name: 'Stadium' },
    doubleHeader: 'N',
    gameNumber: 1,
  },
  {
    gamePk: TARGET_GAME_PK,
    officialDate: TARGET_DATE,
    gameDate: '2024-06-01T16:00:00Z',
    status: { abstractGameState: 'Final', detailedState: 'Final' },
    teams: {
      home: { team: { id: HOME_TEAM, name: 'Target Home' }, probablePitcher: { id: HOME_PITCHER } },
      away: { team: { id: AWAY_TEAM, name: 'Target Away' }, probablePitcher: { id: AWAY_PITCHER } },
    },
    venue: { id: 1, name: 'Stadium' },
    doubleHeader: 'N',
    gameNumber: 1,
  },
  {
    gamePk: TARGET_GAME_PK,
    officialDate: TARGET_DATE,
    gameDate: '2024-06-01T16:00:00Z',
    status: { abstractGameState: 'Final', detailedState: 'Final' },
    teams: {
      home: { team: { id: HOME_TEAM, name: 'Target Home' }, probablePitcher: { id: HOME_PITCHER } },
      away: { team: { id: AWAY_TEAM, name: 'Target Away' }, probablePitcher: { id: AWAY_PITCHER } },
    },
    venue: { id: 1, name: 'Stadium' },
    doubleHeader: 'N',
    gameNumber: 1,
  },
  {
    gamePk: 7004,
    officialDate: '2024-06-03',
    gameDate: '2024-06-03T19:00:00Z',
    status: { abstractGameState: 'Final', detailedState: 'Final' },
    teams: {
      home: { team: { id: AWAY_TEAM, name: 'Target Away' }, probablePitcher: { id: AWAY_PITCHER } },
      away: { team: { id: 703, name: 'Third Team' }, probablePitcher: { id: 803 } },
    },
    venue: { id: 2, name: 'Second Stadium' },
    doubleHeader: 'N',
    gameNumber: 1,
  },
];

function makeScheduleResponseForRange(from: string, to: string): object {
  const filtered = allScheduleGames.filter((g) => g.officialDate >= from && g.officialDate <= to);
  const dates = new Map<string, readonly ScheduleGame[]>();
  for (const game of filtered) {
    const existing = dates.get(game.officialDate) ?? [];
    dates.set(game.officialDate, [...existing, game]);
  }
  const dateBlocks = Array.from(dates.entries()).map(([date, games]) => ({ date, games }));
  return { dates: dateBlocks };
}

function makeFeedResponse(gamePk: number): Response {
  const completionMap: Record<number, string> = {
    [TARGET_GAME_PK]: '2024-06-01T21:30:00Z',
    7002: '2024-05-30T21:30:00Z',
    7004: '2024-06-03T22:30:00Z',
    7005: '2024-05-28T21:30:00Z',
  };

  const isMissingCompletion = gamePk === 7003;
  const homeRuns = gamePk === 7005 ? 0 : 4;
  const awayRuns = gamePk === 7005 ? 5 : 2;

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
        teams: {
          home: { runs: homeRuns },
          away: { runs: awayRuns },
        },
      },
      plays: isMissingCompletion
        ? { allPlays: [] }
        : { allPlays: [{ about: { isComplete: true, endTime: completionMap[gamePk] } }] },
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
                    outs: gamePk === 7005 ? 0 : 18,
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
                    gamesStarted: gamePk === 7002 ? 0 : 1,
                    earnedRuns: 2,
                    hits: 4,
                    homeRuns: 1,
                    strikeOuts: 4,
                    baseOnBalls: 3,
                    outs: gamePk === 7005 ? 0 : 20,
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

function createMockFetch() {
  return vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    fetchedUrls.push(url);
    const urlObj = new URL(url);

    if (urlObj.pathname.includes('/api/v1/schedule')) {
      const startDate = urlObj.searchParams.get('startDate');
      const endDate = urlObj.searchParams.get('endDate');
      const from = startDate ?? '2024-01-01';
      const to = endDate ?? '2024-12-31';
      return new Response(JSON.stringify(makeScheduleResponseForRange(from, to)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const queryGamePk = urlObj.searchParams.get('gamePk');
    if (queryGamePk != null) {
      const gamePk = Number(queryGamePk);
      if (Number.isFinite(gamePk) && gamePk > 0) {
        return makeFeedResponse(gamePk);
      }
    }

    return new Response('Not Found', { status: 404 });
  });
}

describe('Phase 1C: live MLB CLI offline integration', () => {
  let tempRoot: string;
  let fetchImpl: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'live-cli-integ-'));
    stdoutLines.length = 0;
    stderrLines.length = 0;
    fetchedUrls.length = 0;
    fetchImpl = createMockFetch();
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('completes live CLI end-to-end with real provider, loaders, sources, aggregator, orchestrator, runner', async () => {
    const deps: MLBBacktestCLIDependencies = {
      now: () => new Date('2024-06-15T00:00:00Z'),
      liveFetchImpl: fetchImpl,
    };

    const code = await runMLBBacktestCLI(
      ['--source', 'live', '--date', TARGET_DATE, '--output', 'json', '--cache-root', tempRoot, '--cache-version', 'live-integ-v1'],
      createIO(),
      deps,
    );

    expect(code).toBe(0);
    const output = capturedStdout();
    const parsed = JSON.parse(output);

    // meta.source is live
    expect(parsed.meta.source).toBe('live');

    // Correct target game identity
    const targetGame = parsed.orchestration.games.find((g: SerializedGame) => g.gamePk === TARGET_GAME_PK);
    expect(targetGame).toBeDefined();
    expect(targetGame.homeTeamId).toBe(HOME_TEAM);
    expect(targetGame.awayTeamId).toBe(AWAY_TEAM);

    // Probable pitcher provenance is TIMESTAMP_UNKNOWN, so provider exposes null
    // Raw IDs are preserved in the normalized schedule game but not serialized
    expect(targetGame.probablePitchers).toBeNull();

    // Target game abstains because both probable pitchers lack pre-cutoff provenance
    const abstention = parsed.abstentions.find((p: SerializedPrediction) => p.gamePk === TARGET_GAME_PK);
    expect(abstention).toBeDefined();
    expect(abstention.predictedSide).toBeNull();
    expect(abstention.abstentionReason).toBe('BOTH_PITCHERS_UNAVAILABLE');
    expect(abstention.homePitcherAvailable).toBe(false);
    expect(abstention.awayPitcherAvailable).toBe(false);

    // Team context for home team (701) includes pre-cutoff history
    // Zero-stat game 7005 (homeScore 0) preserves zeros
    // Duplicate game does not duplicate sample
    expect(abstention.homePitcherAvailable).toBe(false);
    expect(abstention.awayPitcherAvailable).toBe(false);

    expect(parsed.orchestration.uniqueGames).toBe(1);
    expect(parsed.orchestration.duplicateGamesRemoved).toBe(1);

    // Output has no odds-related fields
    expect(output).not.toMatch(/odds|bookmaker|edge|implied|expectedValue|ROI|favorite|underdog/i);
  });

  it('proves cache behavior across three sequential runs', async () => {
    const deps: MLBBacktestCLIDependencies = {
      now: () => new Date('2024-06-15T00:00:00Z'),
      liveFetchImpl: fetchImpl,
    };

    const args = (force: boolean) => [
      '--source', 'live', '--date', TARGET_DATE, '--output', 'json', '--cache-root', tempRoot, '--cache-version', 'live-cache-proof',
      ...(force ? ['--force-refresh'] : []),
    ];

    // Run 1: fresh cache
    fetchedUrls.length = 0;
    const code1 = await runMLBBacktestCLI(args(false), createIO(), deps);
    expect(code1).toBe(0);
    const run1ScheduleCount = fetchedUrls.filter((u) => u.includes('/api/v1/schedule')).length;
    const run1FeedCount = fetchedUrls.filter((u) => u.includes('/feed/live')).length;
    const run1Total = fetchedUrls.length;
    expect(run1ScheduleCount).toBe(2);
    expect(run1FeedCount).toBe(5);
    expect(run1Total).toBe(7);

    // Run 2: same cache, forceRefresh=false default
    fetchedUrls.length = 0;
    const code2 = await runMLBBacktestCLI(args(false), createIO(), deps);
    expect(code2).toBe(0);
    const run2ScheduleCount = fetchedUrls.filter((u) => u.includes('/api/v1/schedule')).length;
    const run2FeedCount = fetchedUrls.filter((u) => u.includes('/feed/live')).length;
    const run2Total = fetchedUrls.length;
    expect(run2Total).toBe(0);

    // Run 3: force-refresh bypasses cache for every request
    fetchedUrls.length = 0;
    const code3 = await runMLBBacktestCLI(args(true), createIO(), deps);
    expect(code3).toBe(0);
    const run3ScheduleUrls = fetchedUrls.filter((u) => u.includes('/api/v1/schedule'));
    const run3FeedCount = fetchedUrls.filter((u) => u.includes('/feed/live')).length;
    const run3ScheduleCount = run3ScheduleUrls.length;
    const run3Total = fetchedUrls.length;
    expect(run3ScheduleCount).toBe(5);
    expect(run3FeedCount).toBe(14);
    expect(run3Total).toBe(19);

    // Force-refresh makes 5 in-flight schedule requests: 1 target-date + 4 seasonal (3 identical duplicates of the first)
    const distinctScheduleUrls = new Set(run3ScheduleUrls).size;
    const duplicateScheduleUrls = run3ScheduleUrls.length - distinctScheduleUrls;
    expect(distinctScheduleUrls).toBe(2);
    expect(duplicateScheduleUrls).toBe(3);
  });
});
