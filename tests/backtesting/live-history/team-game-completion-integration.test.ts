import { promises as fs } from 'node:fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, vi } from 'vitest';
import type {
  CanonicalHistoricalScheduleGame,
} from '@/lib/backtesting/mlb/live-history/types';
import type { TeamGameSourceOptions } from '@/lib/backtesting/mlb/live-history/team-game-source';
import { createMLBHistoricalHttpClient } from '@/lib/backtesting/mlb/live-history/client';
import { createMLBHistoricalCache } from '@/lib/backtesting/mlb/live-history/cache';
import { createOutcomeLoader } from '@/lib/backtesting/mlb/live-history/outcome-loader';
import { createMLBHistoricalTeamGameSource } from '@/lib/backtesting/mlb/live-history/team-game-source';
import { aggregateTeamHistory } from '@/lib/backtesting/mlb/live-history/team-aggregator';

const HOME_TEAM = 101;
const AWAY_TEAM = 102;

function makeResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function canonicalScheduleGame(
  overrides: Partial<CanonicalHistoricalScheduleGame> = {},
): CanonicalHistoricalScheduleGame {
  return {
    gamePk: overrides.gamePk ?? 1,
    officialDate: overrides.officialDate ?? '2024-06-01',
    scheduledStart: new Date('2024-06-01T18:30:00Z'),
    cutoffTime: new Date('2024-06-01T18:00:00Z'),
    status: overrides.status ?? 'FINAL',
    homeTeamId: overrides.homeTeamId ?? HOME_TEAM,
    homeTeamName: overrides.homeTeamName ?? 'Home',
    awayTeamId: overrides.awayTeamId ?? AWAY_TEAM,
    awayTeamName: overrides.awayTeamName ?? 'Away',
    venueId: overrides.venueId ?? 1,
    venueName: overrides.venueName ?? 'Stadium',
    doubleheader: overrides.doubleheader ?? false,
    gameNumber: overrides.gameNumber ?? 1,
    scheduledInnings: overrides.scheduledInnings ?? 9,
    homeProbablePitcherId: overrides.homeProbablePitcherId ?? null,
    awayProbablePitcherId: overrides.awayProbablePitcherId ?? null,
    homeStarterSource: overrides.homeStarterSource ?? 'UNAVAILABLE',
    awayStarterSource: overrides.awayStarterSource ?? 'UNAVAILABLE',
    rescheduledFromGamePk: overrides.rescheduledFromGamePk ?? null,
    warnings: overrides.warnings ?? [],
    provenance: {
      endpoint: '/api/v1/schedule',
      fetchedAt: new Date('2024-06-01T12:00:00Z'),
      sourceTimestamp: null,
    },
    ...overrides,
  };
}

function feedPayload(params: {
  gamePk: number;
  homeScore: number;
  awayScore: number;
  homeTeamId: number;
  awayTeamId?: number;
  allPlays?: Array<{ about: { isComplete?: boolean; endTime?: string } }>;
}): unknown {
  const { gamePk, homeScore, awayScore, homeTeamId, awayTeamId, allPlays } = params;
  return {
    gamePk,
    gameData: {
      status: { abstractGameState: 'Final', codedGameState: 'F', detailedState: 'Final' },
      linescore: {},
    },
    liveData: {
      linescore: {
        currentInning: 9,
        teams: {
          home: { runs: homeScore },
          away: { runs: awayScore },
        },
      },
      innings: [],
      plays: {
        allPlays: allPlays ?? [{ about: { isComplete: true, endTime: '2024-06-01T21:35:22Z' } }],
      },
    },
  };
}

describe('team-game completion integration', () => {
  it('propagates LAST_COMPLETED_PLAY_END through raw feed to aggregation', async () => {
    const beforeCutoff = new Date('2024-06-01T20:00:00Z');
    const afterCutoff = new Date('2024-06-01T23:00:00Z');
    const cutoff = new Date('2024-06-01T22:00:00Z');

    const feeds = new Map<number, unknown>([
      [
        1001,
        feedPayload({
          gamePk: 1001,
          homeScore: 3,
          awayScore: 1,
          homeTeamId: HOME_TEAM,
          allPlays: [{ about: { isComplete: true, endTime: beforeCutoff.toISOString() } }],
        }),
      ],
      [
        1002,
        feedPayload({
          gamePk: 1002,
          homeScore: 2,
          awayScore: 4,
          homeTeamId: HOME_TEAM,
          awayTeamId: AWAY_TEAM,
          allPlays: [{ about: { isComplete: true, endTime: afterCutoff.toISOString() } }],
        }),
      ],
      [
        1003,
        feedPayload({
          gamePk: 1003,
          homeScore: 5,
          awayScore: 0,
          homeTeamId: AWAY_TEAM,
          allPlays: [],
        }),
      ],
    ]);

    const fetchImpl = vi.fn().mockImplementation(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof _input === 'string' ? _input : (_input as Request).url;
      const gamePk = Number(new URL(url).searchParams.get('gamePk'));
      return makeResponse(feeds.get(gamePk) ?? { gamePk, gameData: { status: { codedGameState: 'F' } }, liveData: {} });
    });

    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-completion-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const loader = createOutcomeLoader({ client, cache });

    const scheduleLoader = {
      async loadForDateRange(): Promise<CanonicalHistoricalScheduleGame[]> {
        return [
          canonicalScheduleGame({ gamePk: 1001, homeTeamId: HOME_TEAM }),
          canonicalScheduleGame({ gamePk: 1002, homeTeamId: HOME_TEAM }),
          canonicalScheduleGame({ gamePk: 1003, homeTeamId: AWAY_TEAM, awayTeamId: HOME_TEAM }),
        ];
      },
    };

    const source = createMLBHistoricalTeamGameSource({
      scheduleLoader,
      outcomeLoader: { loadOutcome: async (gamePk: number) => loader.loadOutcome(gamePk) },
    });

    const games = await source.getTeamGames(HOME_TEAM, 2024);

    expect(games).toHaveLength(3);
    expect(games.every((game) => game.status === 'FINAL')).toBe(true);

    const game1001 = games.find((game) => game.gamePk === 1001)!;
    expect(game1001.completedAt).toEqual(beforeCutoff);
    expect(game1001.completedAtSource).toBe('LAST_COMPLETED_PLAY_END');
    expect(game1001.isHome).toBe(true);
    expect(game1001.runsScored).toBe(3);
    expect(game1001.runsAllowed).toBe(1);

    const game1002 = games.find((game) => game.gamePk === 1002)!;
    expect(game1002.completedAt).toEqual(afterCutoff);
    expect(game1002.completedAtSource).toBe('LAST_COMPLETED_PLAY_END');
    expect(game1002.isHome).toBe(true);
    expect(game1002.runsScored).toBe(2);
    expect(game1002.runsAllowed).toBe(4);

    const game1003 = games.find((game) => game.gamePk === 1003)!;
    expect(game1003.completedAt).toBeNull();
    expect(game1003.completedAtSource).toBeNull();
    expect(game1003.isHome).toBe(false);
    expect(game1003.runsScored).toBe(0);
    expect(game1003.runsAllowed).toBe(5);

    const aggregate = aggregateTeamHistory(games, HOME_TEAM, cutoff);
    expect(aggregate.gamesPlayed).toBe(1);
    expect(aggregate.warnings).toEqual([`missing_completed_at_1003`]);
    expect(aggregate.wins).toBe(1);
    expect(aggregate.losses).toBe(0);
    expect(aggregate.runsScored).toBe(3);
    expect(aggregate.runsAllowed).toBe(1);
  });
});
