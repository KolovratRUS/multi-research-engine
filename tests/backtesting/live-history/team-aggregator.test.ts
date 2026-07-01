import { describe, it, expect } from 'vitest';
import type { CompletedHistoricalTeamGame } from '@/lib/backtesting/mlb/live-history/types';
import { aggregateTeamHistory } from '@/lib/backtesting/mlb/live-history/team-aggregator';

function game(params: Partial<CompletedHistoricalTeamGame> = {}): CompletedHistoricalTeamGame {
  return {
    gamePk: 0,
    gameStart: new Date('2024-06-10T19:00:00Z'),
    completedAt: new Date('2024-06-10T22:00:00Z'),
    completedAtSource: null,
    status: 'FINAL',
    teamId: 1,
    opponentTeamId: 2,
    isHome: false,
    runsScored: 3,
    runsAllowed: 1,
    innings: 9,
    ...params,
  };
}

describe('aggregateTeamHistory', () => {
  it('excludes future games by cutoff', () => {
    const future = game({ gamePk: 1, gameStart: new Date('2099-01-01T00:00:00Z'), completedAt: new Date('2099-01-01T03:00:00Z') });
    const cutoff = new Date('2024-06-11T00:00:00Z');
    const result = aggregateTeamHistory([future], 1, cutoff);
    expect(result.sampleSize).toBe(0);
  });

  it('excludes suspended games', () => {
    const suspended = game({ gamePk: 2, status: 'SUSPENDED' });
    const cutoff = new Date('2024-06-20T00:00:00Z');
    const result = aggregateTeamHistory([suspended], 1, cutoff);
    expect(result.sampleSize).toBe(0);
  });

  it('malformed tied scores excluded with warning', () => {
    const tied = game({ gamePk: 3, runsScored: 4, runsAllowed: 4 });
    const cutoff = new Date('2024-06-20T00:00:00Z');
    const result = aggregateTeamHistory([tied], 1, cutoff);
    expect(result.sampleSize).toBe(0);
    expect(result.warnings).toContain('tied_score_excluded_3');
  });

  it('requested team filtering', () => {
    const home = game({ gamePk: 4, teamId: 1, opponentTeamId: 2, isHome: true });
    const away = game({ gamePk: 5, teamId: 2, opponentTeamId: 1, isHome: false });
    const cutoff = new Date('2024-06-20T00:00:00Z');
    const result = aggregateTeamHistory([home, away], 1, cutoff);
    expect(result.sampleSize).toBe(1);
    expect(result.wins).toBe(1);
  });

  it('sorts without mutating input', () => {
    const g1 = game({ gamePk: 1, gameStart: new Date('2024-06-15T19:00:00Z'), completedAt: new Date('2024-06-15T22:00:00Z') });
    const g2 = game({ gamePk: 2, gameStart: new Date('2024-06-14T19:00:00Z'), completedAt: new Date('2024-06-14T22:00:00Z') });
    const input = [g1, g2];
    const cutoff = new Date('2024-06-20T00:00:00Z');
    aggregateTeamHistory(input, 1, cutoff);
    expect(input[0]).toBe(g1);
    expect(input[1]).toBe(g2);
  });

  it('computes recent10 and run differential', () => {
    const cutoff = new Date('2024-06-30T00:00:00Z');
    const games = [
      game({ gamePk: 1, gameStart: new Date('2024-06-10T19:00:00Z'), completedAt: new Date('2024-06-10T22:00:00Z'), runsScored: 5, runsAllowed: 2, isHome: true }),
      game({ gamePk: 2, gameStart: new Date('2024-06-12T19:00:00Z'), completedAt: new Date('2024-06-12T22:00:00Z'), runsScored: 1, runsAllowed: 3, isHome: false }),
      game({ gamePk: 3, gameStart: new Date('2024-06-14T19:00:00Z'), completedAt: new Date('2024-06-14T22:00:00Z'), runsScored: 4, runsAllowed: 1, isHome: true }),
      game({ gamePk: 4, gameStart: new Date('2024-06-16T19:00:00Z'), completedAt: new Date('2024-06-16T22:00:00Z'), runsScored: 2, runsAllowed: 5, isHome: false }),
      game({ gamePk: 5, gameStart: new Date('2024-06-18T19:00:00Z'), completedAt: new Date('2024-06-18T22:00:00Z'), runsScored: 6, runsAllowed: 2, isHome: true }),
      game({ gamePk: 6, gameStart: new Date('2024-06-20T19:00:00Z'), completedAt: new Date('2024-06-20T22:00:00Z'), runsScored: 5, runsAllowed: 2, isHome: false }),
    ];
    const result = aggregateTeamHistory(games, 1, cutoff);
    expect(result.gamesPlayed).toBe(6);
    expect(result.wins).toBe(4);
    expect(result.losses).toBe(2);
    expect(result.runsScored).toBe(23);
    expect(result.runsAllowed).toBe(15);
    expect(result.runDifferential).toBe(8);
    expect(result.recent5Wins).toBe(3);
    expect(result.homeWins).toBe(3);
    expect(result.awayWins).toBe(1);
    expect(result.awayLosses).toBe(2);
  });

  it('computes rest days and games in previous 3 days', () => {
    const cutoff = new Date('2024-06-25T00:00:00Z');
    const games = [
      game({ gamePk: 1, completedAt: new Date('2024-06-18T22:00:00Z'), isHome: true }),
      game({ gamePk: 2, completedAt: new Date('2024-06-20T22:00:00Z'), isHome: true }),
    ];
    const result = aggregateTeamHistory(games, 1, cutoff);
    expect(result.restDays).toBe(4);
    expect(result.gamesInPrevious3Days).toBe(0);
  });

  it('counts games inside the 72-hour window', () => {
    const cutoff = new Date('2024-06-25T00:00:00Z');
    const games = [
      game({ gamePk: 1, completedAt: new Date('2024-06-22T01:00:00Z'), isHome: true }),
      game({ gamePk: 2, completedAt: new Date('2024-06-23T23:00:00Z'), isHome: true }),
      game({ gamePk: 3, completedAt: new Date('2024-06-24T22:00:00Z'), isHome: true }),
    ];
    const result = aggregateTeamHistory(games, 1, cutoff);
    expect(result.gamesInPrevious3Days).toBe(3);
  });

  it('returns 0 when all games fall outside the 72-hour window', () => {
    const cutoff = new Date('2024-06-25T00:00:00Z');
    const games = [
      game({ gamePk: 1, completedAt: new Date('2024-06-20T22:00:00Z'), isHome: true }),
      game({ gamePk: 2, completedAt: new Date('2024-06-21T23:59:59Z'), isHome: true }),
    ];
    const result = aggregateTeamHistory(games, 1, cutoff);
    expect(result.gamesInPrevious3Days).toBe(0);
  });

  it('excludes a game completed exactly 72 hours before cutoff', () => {
    const cutoff = new Date('2024-06-25T00:00:00Z');
    const games = [
      game({ gamePk: 1, completedAt: new Date('2024-06-22T00:00:00Z'), isHome: true }),
    ];
    const result = aggregateTeamHistory(games, 1, cutoff);
    expect(result.gamesInPrevious3Days).toBe(0);
  });

  it('does not use latest-game-relative window for workload calculation', () => {
    const cutoff = new Date('2024-06-25T00:00:00Z');
    const games = [
      game({ gamePk: 1, completedAt: new Date('2024-06-18T22:00:00Z'), isHome: true }),
      game({ gamePk: 2, completedAt: new Date('2024-06-20T22:00:00Z'), isHome: true }),
    ];
    const result = aggregateTeamHistory(games, 1, cutoff);
    expect(result.gamesInPrevious3Days).toBe(0);
  });

  it('same-day doubleheader rule', () => {
    const cutoff = new Date('2024-06-20T00:00:00Z');
    const game1 = game({ gamePk: 1, completedAt: new Date('2024-06-19T23:59:00Z') });
    const game2 = game({ gamePk: 2, completedAt: new Date('2024-06-19T22:00:00Z') });
    const result = aggregateTeamHistory([game1, game2], 1, cutoff);
    expect(result.sampleSize).toBe(2);
  });

  it('handles extra innings', () => {
    const g = game({ gamePk: 1, innings: 12 });
    const result = aggregateTeamHistory([g], 1, new Date('2024-06-20T00:00:00Z'));
    expect(result.extraInningGames).toBe(1);
  });

  it('records missing completedAt warning', () => {
    const g = game({ gamePk: 10, completedAt: null, runsScored: 3, runsAllowed: 2 });
    const result = aggregateTeamHistory([g], 1, new Date('2024-06-20T00:00:00Z'));
    expect(result.sampleSize).toBe(0);
    expect(result.warnings).toContain('missing_completed_at_10');
  });

  it('records missing scores warning', () => {
    const g = game({ gamePk: 11, runsScored: null, runsAllowed: null });
    const result = aggregateTeamHistory([g], 1, new Date('2024-06-20T00:00:00Z'));
    expect(result.sampleSize).toBe(0);
    expect(result.warnings).toContain('missing_scores_11');
  });
});
