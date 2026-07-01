import { describe, expect, it } from 'vitest';
import {
  normalizeSchedule,
  normalizeProbablePitcher,
  calculateCompleteness,
  calculateDaysSinceLastStart,
  calculatePitcherCompleteness,
} from '@/lib/research-data/mlb/normalization';
import type { MLBScheduleGame, PitcherRecentStart, PitcherSeasonStatsResult } from '@/lib/research-data/types';

function makeScheduleGame(overrides: Partial<MLBScheduleGame> = {}): MLBScheduleGame {
  return {
    gamePk: 1,
    officialDate: '2026-06-26',
    gameDate: '2026-06-26T10:00:00.000Z',
    startTimeUtc: new Date('2026-06-26T10:00:00.000Z'),
    status: 'UPCOMING',
    homeTeamId: 1,
    homeTeamName: 'Home',
    awayTeamId: 2,
    awayTeamName: 'Away',
    venueId: 1,
    venueName: 'Stadium',
    dayNight: 'unknown',
    scheduledInnings: 9,
    doubleHeader: 'N',
    seriesGameNumber: 1,
    gamesInSeries: 3,
    seriesDescription: 'Regular',
    leagueRecord: {
      home: { wins: 0, losses: 0, pct: '.000' },
      away: { wins: 0, losses: 0, pct: '.000' },
    },
    probablePitchers: { home: null, away: null },
    ...overrides,
  };
}

describe('normalizeSchedule', () => {
  it('parses schedule payload into canonical games', () => {
    const raw = {
      totalItems: 1,
      dates: [
        {
          date: '2026-06-26',
          games: [
            {
              gamePk: 824255,
              gameDate: '2026-06-26T10:00:00.000Z',
              officialDate: '2026-06-26',
              status: { abstractGameState: 'Preview', codedGameState: 'P', detailedState: 'Pre-Game', startTimeTBD: false },
              teams: {
                away: {
                  team: { id: 10, name: 'Yankees' },
                  probablePitcher: { id: 650556, fullName: 'Aaron Judge' },
                  leagueRecord: { wins: 50, losses: 40, pct: '.556' },
                },
                home: {
                  team: { id: 20, name: 'Red Sox' },
                  probablePitcher: undefined,
                  leagueRecord: { wins: 45, losses: 45, pct: '.500' },
                },
              },
              venue: { id: 2394, name: 'Comerica Park' },
              dayNight: 'day',
              scheduledInnings: 9,
              doubleHeader: 'N',
              seriesGameNumber: 1,
              gamesInSeries: 3,
              seriesDescription: 'Regular',
            },
          ],
        },
      ],
    };

    const games = normalizeSchedule(raw);
    expect(games).toHaveLength(1);
    const game = games[0];
    expect(game.gamePk).toBe(824255);
    expect(game.homeTeamName).toBe('Red Sox');
    expect(game.awayTeamName).toBe('Yankees');
    expect(game.probablePitchers.away).toEqual({
      availability: 'AVAILABLE',
      personId: 650556,
      fullName: 'Aaron Judge',
      teamId: 10,
      status: 'PROBABLE',
      fetchedAt: expect.any(Date),
      warnings: [],
    });
    expect(game.probablePitchers.home).toBeNull();
  });
});

describe('normalizeProbablePitcher', () => {
  it('returns null when pitcher missing', () => {
    expect(normalizeProbablePitcher(undefined, 10)).toBeNull();
  });

  it('returns assignment when pitcher present', () => {
    const result = normalizeProbablePitcher({ id: 1, fullName: 'Test' }, 99);
    expect(result).toEqual({
      availability: 'AVAILABLE',
      personId: 1,
      fullName: 'Test',
      teamId: 99,
      status: 'PROBABLE',
      fetchedAt: expect.any(Date),
      warnings: [],
    });
  });
});

describe('calculateCompleteness', () => {
  it('computes completeness from filled parts', () => {
    expect(
      calculateCompleteness({
        schedule: true,
        homeProbable: true,
        awayProbable: false,
        homePitcherStats: true,
        awayPitcherStats: true,
        homeBatting: true,
        awayBatting: true,
        homeBullpenQuality: true,
        awayBullpenQuality: false,
        homeBullpenWorkload: false,
        awayBullpenWorkload: false,
        venue: true,
        weather: false,
      }),
    ).toBeCloseTo(0.62, 1);
  });
});

describe('calculateDaysSinceLastStart', () => {
  it('returns null for empty starts', () => {
    expect(calculateDaysSinceLastStart([])).toBeNull();
  });

  it('returns days since most recent start', () => {
    const starts: PitcherRecentStart[] = [{ date: '2026-06-20', opponent: 'OPP', opponentTeamId: 1, inningsPitched: '6.0', earnedRuns: 2, strikeOuts: 7, baseOnBalls: 1 }];
    const result = calculateDaysSinceLastStart(starts);
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

describe('calculatePitcherCompleteness', () => {
  it('returns 0 when season stats missing and no starts', () => {
    expect(calculatePitcherCompleteness(null, [])).toBe(0);
  });

  it('returns fraction when only season stats available', () => {
    const stats = {
      personId: 1,
      season: 2026,
      stats: { age: 28, gamesPlayed: 20, gamesStarted: 20, inningsPitched: '120.0', era: '3.00', whip: '1.10', strikeOuts: 140, baseOnBalls: 40, homeRuns: 12 },
      provenance: { source: 'test', fetchedAt: new Date(), isLive: false, warnings: [] },
    } as unknown as PitcherSeasonStatsResult;
    expect(calculatePitcherCompleteness(stats.stats, [])).toBe(0.5);
  });

  it('returns fraction when starts available but season stats missing', () => {
    const starts: PitcherRecentStart[] = [
      { date: '2026-06-24', opponent: 'OPP', opponentTeamId: 1, inningsPitched: '6.0', earnedRuns: 2, strikeOuts: 7, baseOnBalls: 1 },
      { date: '2026-06-17', opponent: 'OPP', opponentTeamId: 1, inningsPitched: '5.0', earnedRuns: 1, strikeOuts: 8, baseOnBalls: 0 },
      { date: '2026-06-10', opponent: 'OPP', opponentTeamId: 1, inningsPitched: '7.0', earnedRuns: 3, strikeOuts: 6, baseOnBalls: 2 },
    ];
    expect(calculatePitcherCompleteness(null, starts)).toBe(0.5);
  });
});
