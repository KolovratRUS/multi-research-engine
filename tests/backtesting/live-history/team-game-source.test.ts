import { describe, it, expect, vi } from 'vitest';
import type {
  CanonicalHistoricalScheduleGame,
  CanonicalHistoricalOutcome,
  CompletedHistoricalTeamGame,
} from '@/lib/backtesting/mlb/live-history/types';
import type { HistoricalTeamGameSource } from '@/lib/backtesting/mlb/live-history/provider';
import type { TeamGameSourceOptions } from '@/lib/backtesting/mlb/live-history/team-game-source';
import { createMLBHistoricalTeamGameSource, TeamGameSourceError } from '@/lib/backtesting/mlb/live-history/team-game-source';
import { aggregateTeamHistory } from '@/lib/backtesting/mlb/live-history/team-aggregator';

const HOME = 101;
const AWAY = 102;

const canonicalScheduleGame = (overrides: Partial<CanonicalHistoricalScheduleGame> = {}): CanonicalHistoricalScheduleGame => ({
  gamePk: overrides.gamePk ?? 1001,
  officialDate: overrides.officialDate ?? '2024-06-25',
  scheduledStart: new Date('2024-06-25T18:30:00Z'),
  cutoffTime: new Date('2024-06-25T18:00:00Z'),
  status: overrides.status ?? 'FINAL',
  homeTeamId: overrides.homeTeamId ?? HOME,
  homeTeamName: overrides.homeTeamName ?? 'Home',
  awayTeamId: overrides.awayTeamId ?? AWAY,
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
    fetchedAt: new Date('2024-06-25T12:00:00Z'),
    sourceTimestamp: null,
  },
  ...overrides,
});

const canonicalOutcome = (overrides: Partial<CanonicalHistoricalOutcome> = {}): CanonicalHistoricalOutcome => ({
  gamePk: overrides.gamePk ?? 1001,
  status: overrides.status ?? 'FINAL',
  homeScore: overrides.homeScore ?? 3,
  awayScore: overrides.awayScore ?? 1,
  winner: overrides.winner ?? 'HOME',
  innings: overrides.innings ?? 9,
  completedAt: null,
  completedAtSource: null,
  warnings: overrides.warnings ?? [],
  ...overrides,
});

describe('createMLBHistoricalTeamGameSource', () => {
  const buildDeps = (overrides: Partial<TeamGameSourceOptions> = {}): TeamGameSourceOptions => ({
    scheduleLoader: {
      loadForDateRange: async () => [],
    },
    outcomeLoader: {
      loadOutcome: async () => ({
        gamePk: 1001,
        status: 'FINAL' as const,
        homeScore: 0,
        awayScore: 0,
        winner: 'HOME' as const,
        innings: 9,
        completedAt: null,
        completedAtSource: null,
        warnings: [],
      }),
    },
    ...overrides,
  });

  it('satisfies HistoricalTeamGameSource interface', async () => {
    const source = createMLBHistoricalTeamGameSource(buildDeps());
    const asInterface: HistoricalTeamGameSource = source;
    const games = await asInterface.getTeamGames(HOME, 2024);
    expect(games).toEqual([]);
  });

  it('validates teamId before calling loaders', async () => {
    const scheduleLoader = { loadForDateRange: vi.fn(async () => []) };
    const outcomeLoader = { loadOutcome: vi.fn(async () => canonicalOutcome()) };
    const source = createMLBHistoricalTeamGameSource(
      buildDeps({ scheduleLoader, outcomeLoader }),
    );

    await expect(source.getTeamGames(0, 2024)).rejects.toThrow(TeamGameSourceError);
    await expect(source.getTeamGames(-1, 2024)).rejects.toThrow(TeamGameSourceError);
    await expect(source.getTeamGames(NaN, 2024)).rejects.toThrow(TeamGameSourceError);
    await expect(source.getTeamGames(Infinity, 2024)).rejects.toThrow(TeamGameSourceError);

    expect(scheduleLoader.loadForDateRange).not.toHaveBeenCalled();
    expect(outcomeLoader.loadOutcome).not.toHaveBeenCalled();
  });

  it('validates season before calling loaders', async () => {
    const scheduleLoader = { loadForDateRange: vi.fn(async () => []) };
    const source = createMLBHistoricalTeamGameSource(
      buildDeps({ scheduleLoader }),
    );

    await expect(source.getTeamGames(HOME, 0)).rejects.toThrow(TeamGameSourceError);
    await expect(source.getTeamGames(HOME, -1)).rejects.toThrow(TeamGameSourceError);
    await expect(source.getTeamGames(HOME, NaN)).rejects.toThrow(TeamGameSourceError);
    await expect(source.getTeamGames(HOME, Infinity)).rejects.toThrow(TeamGameSourceError);

    expect(scheduleLoader.loadForDateRange).not.toHaveBeenCalled();
  });

  it('requests schedule for full season range Jan 1 through Dec 31', async () => {
    const loader = vi.fn(async () => []);
    const source = createMLBHistoricalTeamGameSource(
      buildDeps({ scheduleLoader: { loadForDateRange: loader } }),
    );

    await source.getTeamGames(HOME, 2024);
    expect(loader).toHaveBeenCalledWith('2024-01-01', '2024-12-31');
  });

  it('filters schedule games to requested team', async () => {
    const loader = vi.fn(async () => [
      canonicalScheduleGame({ gamePk: 1, homeTeamId: HOME, awayTeamId: 999 }),
      canonicalScheduleGame({ gamePk: 2, homeTeamId: 999, awayTeamId: HOME }),
      canonicalScheduleGame({ gamePk: 3, homeTeamId: 999, awayTeamId: 888 }),
    ]);
    const source = createMLBHistoricalTeamGameSource(
      buildDeps({ scheduleLoader: { loadForDateRange: loader } }),
    );

    const games = await source.getTeamGames(HOME, 2024);
    expect(games.map((g: CompletedHistoricalTeamGame) => g.gamePk)).toEqual([1, 2]);
  });

  it('preserves doubleheaders with distinct gamePks', async () => {
    const loader = vi.fn(async () => [
      canonicalScheduleGame({ gamePk: 1, doubleheader: true, gameNumber: 1 }),
      canonicalScheduleGame({ gamePk: 2, doubleheader: true, gameNumber: 2 }),
      canonicalScheduleGame({ gamePk: 3 }),
    ]);
    const source = createMLBHistoricalTeamGameSource(
      buildDeps({ scheduleLoader: { loadForDateRange: loader } }),
    );

    const games = await source.getTeamGames(HOME, 2024);
    expect(games.map((g: CompletedHistoricalTeamGame) => g.gamePk)).toEqual([1, 2, 3]);
  });

  it('returns empty array for empty schedule', async () => {
    const source = createMLBHistoricalTeamGameSource(buildDeps());
    const games = await source.getTeamGames(HOME, 2024);
    expect(games).toEqual([]);
  });

  it('maps home team scores correctly', async () => {
    const loader = vi.fn(async () => [
      canonicalScheduleGame({ gamePk: 1, status: 'FINAL', scheduledStart: new Date('2024-06-01T18:30:00Z') }),
    ]);
    const outcomeLoader = vi.fn(async () => canonicalOutcome({ gamePk: 1, homeScore: 4, awayScore: 1 }));

    const source = createMLBHistoricalTeamGameSource(
      buildDeps({
        scheduleLoader: { loadForDateRange: loader },
        outcomeLoader: { loadOutcome: outcomeLoader },
      }),
    );

    const games = await source.getTeamGames(HOME, 2024);
    expect(games).toHaveLength(1);
    expect(games[0].runsScored).toBe(4);
    expect(games[0].runsAllowed).toBe(1);
    expect(games[0].isHome).toBe(true);
  });

  it('maps away team scores correctly', async () => {
    const loader = vi.fn(async () => [
      canonicalScheduleGame({ gamePk: 1, status: 'FINAL', scheduledStart: new Date('2024-06-01T18:30:00Z') }),
    ]);
    const outcomeLoader = vi.fn(async () => canonicalOutcome({ gamePk: 1, homeScore: 4, awayScore: 1 }));

    const source = createMLBHistoricalTeamGameSource(
      buildDeps({
        scheduleLoader: { loadForDateRange: loader },
        outcomeLoader: { loadOutcome: outcomeLoader },
      }),
    );

    const games = await source.getTeamGames(AWAY, 2024);
    expect(games).toHaveLength(1);
    expect(games[0].runsScored).toBe(1);
    expect(games[0].runsAllowed).toBe(4);
    expect(games[0].isHome).toBe(false);
  });

  it('preserves zero scores', async () => {
    const loader = vi.fn(async () => [
      canonicalScheduleGame({ gamePk: 1, status: 'FINAL', scheduledStart: new Date('2024-06-01T18:30:00Z') }),
    ]);
    const source = createMLBHistoricalTeamGameSource(
      buildDeps({
        scheduleLoader: { loadForDateRange: loader },
        outcomeLoader: { loadOutcome: vi.fn(async () => canonicalOutcome({ gamePk: 1, homeScore: 0, awayScore: 1 })) },
      }),
    );

    const homeGames = await source.getTeamGames(HOME, 2024);
    expect(homeGames[0].runsScored).toBe(0);
    expect(homeGames[0].runsAllowed).toBe(1);

    const awayGames = await source.getTeamGames(AWAY, 2024);
    expect(awayGames[0].runsScored).toBe(1);
    expect(awayGames[0].runsAllowed).toBe(0);
  });

  it('preserves legitimate 0-0 result', async () => {
    const loader = vi.fn(async () => [
      canonicalScheduleGame({ gamePk: 1, status: 'FINAL', scheduledStart: new Date('2024-06-01T18:30:00Z') }),
    ]);
    const outcomeLoader = vi.fn(async () => canonicalOutcome({ gamePk: 1, homeScore: 0, awayScore: 0 }));

    const source = createMLBHistoricalTeamGameSource(
      buildDeps({
        scheduleLoader: { loadForDateRange: loader },
        outcomeLoader: { loadOutcome: outcomeLoader },
      }),
    );

    const games = await source.getTeamGames(HOME, 2024);
    expect(games[0].runsScored).toBe(0);
    expect(games[0].runsAllowed).toBe(0);
  });

  it('keeps null scores when outcome is missing', async () => {
    const loader = vi.fn(async () => [
      canonicalScheduleGame({ gamePk: 1, status: 'FINAL', scheduledStart: new Date('2024-06-01T18:30:00Z') }),
    ]);
    const outcomeLoader = vi.fn(async () => ({
      gamePk: 1,
      status: 'UNKNOWN' as const,
      homeScore: null,
      awayScore: null,
      winner: null,
      innings: null,
      completedAt: null,
      completedAtSource: null,
      warnings: ['missing_final_scores'],
    }));

    const source = createMLBHistoricalTeamGameSource(
      buildDeps({
        scheduleLoader: { loadForDateRange: loader },
        outcomeLoader: { loadOutcome: outcomeLoader },
      }),
    );

    const games = await source.getTeamGames(HOME, 2024);
    expect(games).toHaveLength(1);
    expect(games[0].runsScored).toBeNull();
    expect(games[0].runsAllowed).toBeNull();
  });

  it('does not call outcome loader for non-final statuses', async () => {
    const loader = vi.fn(async () => [
      canonicalScheduleGame({ gamePk: 1, status: 'POSTPONED', scheduledStart: new Date('2024-06-01T18:30:00Z') }),
      canonicalScheduleGame({ gamePk: 2, status: 'CANCELLED', scheduledStart: new Date('2024-06-02T18:30:00Z') }),
      canonicalScheduleGame({ gamePk: 3, status: 'SUSPENDED', scheduledStart: new Date('2024-06-03T18:30:00Z') }),
      canonicalScheduleGame({ gamePk: 4, status: 'UPCOMING', scheduledStart: new Date('2024-06-04T18:30:00Z') }),
      canonicalScheduleGame({ gamePk: 5, status: 'LIVE', scheduledStart: new Date('2024-06-05T18:30:00Z') }),
      canonicalScheduleGame({ gamePk: 6, status: 'UNKNOWN', scheduledStart: new Date('2024-06-06T18:30:00Z') }),
    ]);
    const outcomeLoader = vi.fn(async () => canonicalOutcome());

    const source = createMLBHistoricalTeamGameSource(
      buildDeps({
        scheduleLoader: { loadForDateRange: loader },
        outcomeLoader: { loadOutcome: outcomeLoader },
      }),
    );

    const games = await source.getTeamGames(HOME, 2024);
    expect(games).toHaveLength(3);
    expect(games.map((g: CompletedHistoricalTeamGame) => g.status)).toEqual(['POSTPONED', 'CANCELLED', 'SUSPENDED']);
    for (const game of games) {
      expect(game.runsScored).toBeNull();
      expect(game.runsAllowed).toBeNull();
      expect(game.completedAt).toBeNull();
    }
    expect(outcomeLoader).not.toHaveBeenCalled();
  });

  it('excludes UPCOMING and LIVE from eligible games', async () => {
    const loader = vi.fn(async () => [
      canonicalScheduleGame({ gamePk: 2, status: 'UPCOMING', scheduledStart: new Date('2024-06-02T18:30:00Z') }),
      canonicalScheduleGame({ gamePk: 3, status: 'LIVE', scheduledStart: new Date('2024-06-03T18:30:00Z') }),
      canonicalScheduleGame({ gamePk: 4, status: 'UNKNOWN', scheduledStart: new Date('2024-06-04T18:30:00Z') }),
    ]);
    const outcomeLoader = vi.fn(async () => canonicalOutcome());

    const source = createMLBHistoricalTeamGameSource(
      buildDeps({
        scheduleLoader: { loadForDateRange: loader },
        outcomeLoader: { loadOutcome: outcomeLoader },
      }),
    );

    const games = await source.getTeamGames(HOME, 2024);
    expect(games).toHaveLength(0);
    expect(outcomeLoader).not.toHaveBeenCalled();
  });

  it('deduplicates by gamePk and later occurrence wins', async () => {
    const loader = vi.fn(async () => [
      canonicalScheduleGame({ gamePk: 1, status: 'FINAL', scheduledStart: new Date('2024-06-01T18:30:00Z'), homeTeamId: HOME }),
      canonicalScheduleGame({ gamePk: 1, status: 'FINAL', scheduledStart: new Date('2024-06-02T18:30:00Z') }),
    ]);
    const source = createMLBHistoricalTeamGameSource(
      buildDeps({ scheduleLoader: { loadForDateRange: loader } }),
    );

    const games = await source.getTeamGames(HOME, 2024);
    expect(games).toHaveLength(1);
    expect(games[0].gameStart).toEqual(new Date('2024-06-02T18:30:00Z'));
  });

  it('sorts by gameStart then gamePk ascending', async () => {
    const loader = vi.fn(async () => [
      canonicalScheduleGame({ gamePk: 3, scheduledStart: new Date('2024-06-03T18:30:00Z') }),
      canonicalScheduleGame({ gamePk: 1, scheduledStart: new Date('2024-06-01T18:30:00Z') }),
      canonicalScheduleGame({ gamePk: 2, scheduledStart: new Date('2024-06-01T18:30:00Z') }),
    ]);
    const source = createMLBHistoricalTeamGameSource(
      buildDeps({ scheduleLoader: { loadForDateRange: loader } }),
    );

    const games = await source.getTeamGames(HOME, 2024);
    expect(games.map((g: CompletedHistoricalTeamGame) => g.gamePk)).toEqual([1, 2, 3]);
  });

  it('does not mutate the input schedule array', async () => {
    const input = [
      canonicalScheduleGame({ gamePk: 1 }),
      canonicalScheduleGame({ gamePk: 2 }),
    ];
    const loader = vi.fn(async () => input);
    const source = createMLBHistoricalTeamGameSource(
      buildDeps({ scheduleLoader: { loadForDateRange: loader } }),
    );

    const before = [...input];
    await source.getTeamGames(HOME, 2024);
    expect(loader).toHaveBeenCalled();
    expect(input).toEqual(before);
  });

  it('wraps schedule loader failures', async () => {
    const error = new Error('schedule down');
    const source = createMLBHistoricalTeamGameSource(
      buildDeps({
        scheduleLoader: {
          loadForDateRange: vi.fn(async () => { throw error; }),
        },
      }),
    );

    await expect(source.getTeamGames(HOME, 2024)).rejects.toThrow(TeamGameSourceError);
    try {
      await source.getTeamGames(HOME, 2024);
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(TeamGameSourceError);
      expect((thrown as TeamGameSourceError).operation).toBe('getTeamGames');
      expect((thrown as TeamGameSourceError).context).toEqual({ teamId: HOME, season: 2024 });
      expect((thrown as TeamGameSourceError).cause).toBe(error);
    }
  });

  it('wraps outcome loader failures with gamePk', async () => {
    const loader = vi.fn(async () => [
      canonicalScheduleGame({ gamePk: 1, status: 'FINAL', scheduledStart: new Date('2024-06-01T18:30:00Z') }),
    ]);
    const error = new Error('outcome down');
    const source = createMLBHistoricalTeamGameSource(
      buildDeps({
        scheduleLoader: { loadForDateRange: loader },
        outcomeLoader: {
          loadOutcome: vi.fn(async () => { throw error; }),
        },
      }),
    );

    await expect(source.getTeamGames(HOME, 2024)).rejects.toThrow(TeamGameSourceError);
    try {
      await source.getTeamGames(HOME, 2024);
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(TeamGameSourceError);
      expect((thrown as TeamGameSourceError).context).toEqual({
        teamId: HOME,
        season: 2024,
        gamePk: 1,
      });
      expect((thrown as TeamGameSourceError).cause).toBe(error);
    }
  });

  it('returns completedAt null for all games', async () => {
    const loader = vi.fn(async () => [
      canonicalScheduleGame({ gamePk: 1, status: 'FINAL', scheduledStart: new Date('2024-06-01T18:30:00Z') }),
      canonicalScheduleGame({ gamePk: 2, status: 'POSTPONED', scheduledStart: new Date('2024-06-02T18:30:00Z') }),
    ]);
    const source = createMLBHistoricalTeamGameSource(
      buildDeps({ scheduleLoader: { loadForDateRange: loader } }),
    );

    const games = await source.getTeamGames(HOME, 2024);
    for (const game of games) {
      expect(game.completedAt).toBeNull();
    }
  });

  it('excludes final games from aggregation due to null completedAt', async () => {
    const loader = vi.fn(async () => [
      canonicalScheduleGame({ gamePk: 1, status: 'FINAL', scheduledStart: new Date('2024-06-01T18:30:00Z') }),
      canonicalScheduleGame({ gamePk: 2, status: 'FINAL', scheduledStart: new Date('2024-06-02T18:30:00Z') }),
    ]);
    const source = createMLBHistoricalTeamGameSource(
      buildDeps({
        scheduleLoader: { loadForDateRange: loader },
        outcomeLoader: {
          loadOutcome: vi.fn(async (gamePk) =>
            canonicalOutcome({ gamePk, homeScore: 3, awayScore: 1 }),
          ),
        },
      }),
    );

    const games = await source.getTeamGames(HOME, 2024);
    expect(games).toHaveLength(2);
    expect(games.every((g) => g.completedAt === null)).toBe(true);

    const cutoff = new Date('2024-12-31T23:59:59Z');
    const aggregate = aggregateTeamHistory(games, HOME, cutoff);
    expect(aggregate.gamesPlayed).toBe(0);
    expect(aggregate.warnings.length).toBeGreaterThanOrEqual(1);
    expect(aggregate.warnings.some((w) => w.startsWith('missing_completed_at_'))).toBe(true);
  });
});
