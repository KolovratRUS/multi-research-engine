import type { HistoricalMLBGame, MLBGameOutcome, HistoricalPitcherProfile, HistoricalTeamProfile, HistoricalTeamGame, MLBHistoricalDataProvider } from '@/lib/backtesting/types';

export interface MLBHistoricalFixture {
  readonly games: readonly HistoricalMLBGame[];
  readonly outcomes: readonly MLBGameOutcome[];
  readonly recentWinRates: Readonly<Record<number, number>>;
  readonly seasonWinRates: Readonly<Record<number, number>>;
  readonly pitcherProfiles: Readonly<Record<number, HistoricalPitcherProfile | null>>;
  readonly teamProfiles: Readonly<Record<number, HistoricalTeamProfile | null>>;
  readonly recentTeamGames: Readonly<Record<number, readonly HistoricalTeamGame[]>>;
  readonly intentionallyMissingPitcherProfileIds: readonly number[];
}

const CUTOFF_MS = 30 * 60 * 1000;

function makeCutoff(gameDate: Date): { readonly eventId: string; readonly cutoffTime: Date } {
  return {
    eventId: `event-${gameDate.toISOString()}`,
    cutoffTime: new Date(gameDate.getTime() - CUTOFF_MS),
  };
}

function makeHistoricalGame(
  overrides: Partial<HistoricalMLBGame> & Pick<HistoricalMLBGame, 'gamePk' | 'officialDate' | 'gameDate'>,
): HistoricalMLBGame {
  const cutoff = makeCutoff(overrides.gameDate);

  const defaults: HistoricalMLBGame = {
    gamePk: overrides.gamePk,
    officialDate: overrides.officialDate,
    gameDate: overrides.gameDate,
    homeTeamId: 0,
    awayTeamId: 0,
    homeTeamName: '',
    awayTeamName: '',
    venueId: 0,
    status: 'UPCOMING',
    probablePitchers: null,
    cutoff,
  };

  return { ...defaults, ...overrides, cutoff };
}

function makeOutcome(
  overrides: Partial<MLBGameOutcome> & Pick<MLBGameOutcome, 'gamePk' | 'status'>,
): MLBGameOutcome {
  const defaults: MLBGameOutcome = {
    gamePk: overrides.gamePk,
    homeScore: null,
    awayScore: null,
    winner: null,
    innings: null,
    status: overrides.status,
    linescore: null,
  };
  return { ...defaults, ...overrides };
}

function makeAvailablePitcher(overrides: {
  personId: number;
  teamId: number;
  fullName: string;
  fetchedAt: Date;
}): import('@/lib/research-data/types').PitcherAssignment & { readonly availability: 'AVAILABLE' } {
  return {
    availability: 'AVAILABLE',
    personId: overrides.personId,
    fullName: overrides.fullName,
    teamId: overrides.teamId,
    status: 'CONFIRMED',
    fetchedAt: overrides.fetchedAt,
    warnings: [],
  };
}

function makeUnavailablePitcher(overrides: {
  teamId: number;
  fetchedAt: Date;
  warnings?: readonly string[];
}): import('@/lib/research-data/types').PitcherAssignment & { readonly availability: 'UNAVAILABLE' } {
  return {
    availability: 'UNAVAILABLE',
    teamId: overrides.teamId,
    status: 'UNAVAILABLE',
    fetchedAt: overrides.fetchedAt,
    warnings: overrides.warnings ? [...overrides.warnings] : [],
  };
}

const games = [
  makeHistoricalGame({
    gamePk: 1001,
    officialDate: '2024-06-01',
    gameDate: new Date('2024-06-01T16:20:00Z'),
    homeTeamId: 100101,
    awayTeamId: 100102,
    homeTeamName: 'Home Alpha',
    awayTeamName: 'Away Alpha',
    status: 'FINAL',
    venueId: 1,
    probablePitchers: {
      home: makeAvailablePitcher({ personId: 2001, teamId: 100101, fullName: 'Starter Alpha', fetchedAt: new Date('2024-06-01T14:00:00Z') }),
      away: makeAvailablePitcher({ personId: 2002, teamId: 100102, fullName: 'Starter Beta', fetchedAt: new Date('2024-06-01T14:00:00Z') }),
    },
  }),
  makeHistoricalGame({
    gamePk: 1002,
    officialDate: '2024-06-01',
    gameDate: new Date('2024-06-01T19:05:00Z'),
    homeTeamId: 100103,
    awayTeamId: 100104,
    homeTeamName: 'Home Gamma',
    awayTeamName: 'Away Delta',
    status: 'FINAL',
    venueId: 2,
    probablePitchers: {
      home: makeAvailablePitcher({ personId: 2003, teamId: 100103, fullName: 'Starter Gamma', fetchedAt: new Date('2024-06-01T17:00:00Z') }),
      away: makeUnavailablePitcher({ teamId: 100104, fetchedAt: new Date('2024-06-01T17:00:00Z'), warnings: ['Missing pitcher'] }),
    },
  }),
  makeHistoricalGame({
    gamePk: 1003,
    officialDate: '2024-06-02',
    gameDate: new Date('2024-06-02T13:10:00Z'),
    homeTeamId: 100101,
    awayTeamId: 100105,
    homeTeamName: 'Home Alpha',
    awayTeamName: 'Away Epsilon',
    status: 'SUSPENDED',
    venueId: 1,
    probablePitchers: {
      home: makeAvailablePitcher({ personId: 2004, teamId: 100101, fullName: 'Starter Delta', fetchedAt: new Date('2024-06-02T11:00:00Z') }),
      away: makeAvailablePitcher({ personId: 2005, teamId: 100105, fullName: 'Starter Epsilon', fetchedAt: new Date('2024-06-02T11:00:00Z') }),
    },
  }),
  makeHistoricalGame({
    gamePk: 1004,
    officialDate: '2024-06-03',
    gameDate: new Date('2024-06-03T17:40:00Z'),
    homeTeamId: 100102,
    awayTeamId: 100103,
    homeTeamName: 'Away Alpha',
    awayTeamName: 'Home Gamma',
    status: 'POSTPONED',
    venueId: 2,
    probablePitchers: {
      home: makeAvailablePitcher({ personId: 2006, teamId: 100103, fullName: 'Starter Zeta', fetchedAt: new Date('2024-06-03T15:00:00Z') }),
      away: makeUnavailablePitcher({ teamId: 100102, fetchedAt: new Date('2024-06-03T15:00:00Z'), warnings: ['Missing pitcher'] }),
    },
  }),
  makeHistoricalGame({
    gamePk: 1005,
    officialDate: '2024-06-05',
    gameDate: new Date('2024-06-05T19:10:00Z'),
    homeTeamId: 100104,
    awayTeamId: 100101,
    homeTeamName: 'Away Delta',
    awayTeamName: 'Home Alpha',
    status: 'FINAL',
    venueId: 1,
    probablePitchers: {
      home: makeAvailablePitcher({ personId: 2007, teamId: 100104, fullName: 'Starter Eta', fetchedAt: new Date('2024-06-05T17:00:00Z') }),
      away: makeAvailablePitcher({ personId: 2004, teamId: 100101, fullName: 'Starter Delta', fetchedAt: new Date('2024-06-05T17:00:00Z') }),
    },
  }),
  makeHistoricalGame({
    gamePk: 1006,
    officialDate: '2024-06-08',
    gameDate: new Date('2024-06-08T16:15:00Z'),
    homeTeamId: 100105,
    awayTeamId: 100103,
    homeTeamName: 'Away Epsilon',
    awayTeamName: 'Home Gamma',
    status: 'SUSPENDED',
    venueId: 2,
    probablePitchers: {
      home: makeAvailablePitcher({ personId: 2008, teamId: 100105, fullName: 'Starter Theta', fetchedAt: new Date('2024-06-08T14:00:00Z') }),
      away: makeUnavailablePitcher({ teamId: 100103, fetchedAt: new Date('2024-06-08T14:00:00Z'), warnings: ['Missing pitcher'] }),
    },
  }),
  makeHistoricalGame({
    gamePk: 1007,
    officialDate: '2024-06-09',
    gameDate: new Date('2024-06-09T19:20:00Z'),
    homeTeamId: 100101,
    awayTeamId: 100102,
    homeTeamName: 'Home Alpha',
    awayTeamName: 'Away Alpha',
    status: 'FINAL',
    venueId: 0,
    probablePitchers: {
      home: makeAvailablePitcher({ personId: 2001, teamId: 100101, fullName: 'Starter Alpha', fetchedAt: new Date('2024-06-09T17:00:00Z') }),
      away: makeAvailablePitcher({ personId: 2002, teamId: 100102, fullName: 'Starter Beta', fetchedAt: new Date('2024-06-09T17:00:00Z') }),
    },
  }),
  makeHistoricalGame({
    gamePk: 1008,
    officialDate: '2024-06-10',
    gameDate: new Date('2024-06-10T14:00:00Z'),
    homeTeamId: 100103,
    awayTeamId: 100104,
    homeTeamName: 'Home Gamma',
    awayTeamName: 'Away Delta',
    status: 'FINAL',
    venueId: 2,
    probablePitchers: {
      home: null,
      away: makeAvailablePitcher({ personId: 2005, teamId: 100104, fullName: 'Starter Epsilon', fetchedAt: new Date('2024-06-10T12:00:00Z') }),
    },
  }),
  makeHistoricalGame({
    gamePk: 1009,
    officialDate: '2024-06-12',
    gameDate: new Date('2024-06-12T18:00:00Z'),
    homeTeamId: 100102,
    awayTeamId: 100101,
    homeTeamName: 'Away Alpha',
    awayTeamName: 'Home Alpha',
    status: 'SUSPENDED',
    venueId: 1,
    probablePitchers: {
      home: null,
      away: null,
    },
  }),
  makeHistoricalGame({
    gamePk: 1010,
    officialDate: '2024-06-14',
    gameDate: new Date('2024-06-14T20:00:00Z'),
    homeTeamId: 100105,
    awayTeamId: 100104,
    homeTeamName: 'Away Epsilon',
    awayTeamName: 'Away Delta',
    status: 'CANCELLED',
    venueId: 2,
    probablePitchers: {
      home: makeAvailablePitcher({ personId: 2008, teamId: 100105, fullName: 'Starter Theta', fetchedAt: new Date('2024-06-14T18:00:00Z') }),
      away: makeAvailablePitcher({ personId: 2007, teamId: 100104, fullName: 'Starter Eta', fetchedAt: new Date('2024-06-14T18:00:00Z') }),
    },
  }),
  makeHistoricalGame({
    gamePk: 1011,
    officialDate: '2024-06-15',
    gameDate: new Date('2024-06-15T12:00:00Z'),
    homeTeamId: 100101,
    awayTeamId: 100105,
    homeTeamName: 'Home Alpha',
    awayTeamName: 'Away Epsilon',
    status: 'FINAL',
    venueId: 1,
    probablePitchers: {
      home: makeAvailablePitcher({ personId: 2001, teamId: 100101, fullName: 'Starter Alpha', fetchedAt: new Date('2024-06-15T10:00:00Z') }),
      away: makeAvailablePitcher({ personId: 2005, teamId: 100105, fullName: 'Starter Epsilon', fetchedAt: new Date('2024-06-15T10:00:00Z') }),
    },
  }),
  makeHistoricalGame({
    gamePk: 1012,
    officialDate: '2024-06-15',
    gameDate: new Date('2024-06-15T15:30:00Z'),
    homeTeamId: 100102,
    awayTeamId: 100101,
    homeTeamName: 'Away Alpha',
    awayTeamName: 'Home Alpha',
    status: 'FINAL',
    venueId: 2,
    probablePitchers: {
      home: makeAvailablePitcher({ personId: 2009, teamId: 100102, fullName: 'Starter Iota', fetchedAt: new Date('2024-06-15T13:00:00Z') }),
      away: makeAvailablePitcher({ personId: 2004, teamId: 100101, fullName: 'Starter Delta', fetchedAt: new Date('2024-06-15T13:00:00Z') }),
    },
  }),
  makeHistoricalGame({
    gamePk: 1013,
    officialDate: '2024-06-16',
    gameDate: new Date('2024-06-16T16:00:00Z'),
    homeTeamId: 100103,
    awayTeamId: 100102,
    homeTeamName: 'Home Gamma',
    awayTeamName: 'Away Alpha',
    status: 'FINAL',
    venueId: 1,
    probablePitchers: {
      home: makeAvailablePitcher({ personId: 2003, teamId: 100103, fullName: 'Starter Gamma', fetchedAt: new Date('2024-06-16T14:00:00Z') }),
      away: makeAvailablePitcher({ personId: 2009, teamId: 100102, fullName: 'Starter Iota', fetchedAt: new Date('2024-06-16T14:00:00Z') }),
    },
  }),
  makeHistoricalGame({
    gamePk: 1014,
    officialDate: '2024-06-18',
    gameDate: new Date('2024-06-18T17:10:00Z'),
    homeTeamId: 100104,
    awayTeamId: 100105,
    homeTeamName: 'Away Delta',
    awayTeamName: 'Away Epsilon',
    status: 'FINAL',
    venueId: 1,
    probablePitchers: {
      home: makeUnavailablePitcher({ teamId: 100104, fetchedAt: new Date('2024-06-18T15:00:00Z'), warnings: ['Missing pitcher'] }),
      away: makeUnavailablePitcher({ teamId: 100105, fetchedAt: new Date('2024-06-18T15:00:00Z'), warnings: ['Missing pitcher'] }),
    },
  }),
  makeHistoricalGame({
    gamePk: 1015,
    officialDate: '2024-06-20',
    gameDate: new Date('2024-06-20T19:00:00Z'),
    homeTeamId: 100101,
    awayTeamId: 100103,
    homeTeamName: 'Home Alpha',
    awayTeamName: 'Home Gamma',
    status: 'FINAL',
    venueId: 2,
    probablePitchers: {
      home: makeAvailablePitcher({ personId: 2001, teamId: 100101, fullName: 'Starter Alpha', fetchedAt: new Date('2024-06-20T17:00:00Z') }),
      away: makeAvailablePitcher({ personId: 2006, teamId: 100103, fullName: 'Starter Zeta', fetchedAt: new Date('2024-06-20T17:00:00Z') }),
    },
  }),
  makeHistoricalGame({
    gamePk: 1016,
    officialDate: '2024-06-22',
    gameDate: new Date('2024-06-22T13:05:00Z'),
    homeTeamId: 100102,
    awayTeamId: 100105,
    homeTeamName: 'Away Alpha',
    awayTeamName: 'Away Epsilon',
    status: 'FINAL',
    venueId: 1,
    probablePitchers: {
      home: makeAvailablePitcher({ personId: 2009, teamId: 100102, fullName: 'Starter Iota', fetchedAt: new Date('2024-06-22T11:00:00Z') }),
      away: makeAvailablePitcher({ personId: 2008, teamId: 100105, fullName: 'Starter Theta', fetchedAt: new Date('2024-06-22T11:00:00Z') }),
    },
  }),
  makeHistoricalGame({
    gamePk: 1017,
    officialDate: '2024-06-24',
    gameDate: new Date('2024-06-24T19:30:00Z'),
    homeTeamId: 100103,
    awayTeamId: 100101,
    homeTeamName: 'Home Gamma',
    awayTeamName: 'Home Alpha',
    status: 'FINAL',
    venueId: 2,
    probablePitchers: {
      home: null,
      away: null,
    },
  }),
];

const outcomes = [
  makeOutcome({ gamePk: 1001, status: 'FINAL', homeScore: 5, awayScore: 3, winner: 'HOME', innings: 9 }),
  makeOutcome({ gamePk: 1002, status: 'FINAL', homeScore: 2, awayScore: 4, winner: 'AWAY', innings: 9 }),
  makeOutcome({ gamePk: 1003, status: 'SUSPENDED' }),
  makeOutcome({ gamePk: 1004, status: 'POSTPONED' }),
  makeOutcome({ gamePk: 1005, status: 'FINAL', homeScore: 3, awayScore: 6, winner: 'AWAY', innings: 9 }),
  makeOutcome({ gamePk: 1006, status: 'SUSPENDED' }),
  makeOutcome({ gamePk: 1007, status: 'FINAL', homeScore: 4, awayScore: 2, winner: 'HOME', innings: 9 }),
  makeOutcome({ gamePk: 1008, status: 'FINAL', homeScore: 0, awayScore: 1, winner: 'AWAY', innings: 9 }),
  makeOutcome({ gamePk: 1009, status: 'SUSPENDED' }),
  makeOutcome({ gamePk: 1010, status: 'CANCELLED' }),
  makeOutcome({ gamePk: 1011, status: 'FINAL', homeScore: 6, awayScore: 5, winner: 'HOME', innings: 9 }),
  makeOutcome({ gamePk: 1012, status: 'FINAL', homeScore: 3, awayScore: 8, winner: 'AWAY', innings: 9 }),
  makeOutcome({ gamePk: 1013, status: 'FINAL', homeScore: 4, awayScore: 2, winner: 'HOME', innings: 9 }),
  makeOutcome({ gamePk: 1014, status: 'FINAL', homeScore: 2, awayScore: 5, winner: 'AWAY', innings: 9 }),
  makeOutcome({ gamePk: 1015, status: 'FINAL', homeScore: 7, awayScore: 2, winner: 'HOME', innings: 9 }),
  makeOutcome({ gamePk: 1016, status: 'FINAL', homeScore: 3, awayScore: 6, winner: 'AWAY', innings: 9 }),
  makeOutcome({ gamePk: 1017, status: 'FINAL', homeScore: 1, awayScore: 0, winner: 'HOME', innings: 9 }),
];

const recentWinRates: Record<number, number> = {
  100101: 0.6,
  100102: 0.4,
  100103: 0.5,
  100104: 0.3,
  100105: 0.7,
};

const seasonWinRates: Record<number, number> = {
  100101: 0.55,
  100102: 0.45,
  100103: 0.52,
  100104: 0.4,
  100105: 0.6,
};

const pitcherProfiles: Record<number, HistoricalPitcherProfile | null> = {
  2001: {
    personId: 2001,
    fullName: 'Starter Alpha',
    teamId: 100101,
    seasonStats: { era: '3.10', whip: '1.20', strikeoutsPer9Inn: '9.2', walksPer9Inn: '2.5', hitsPer9Inn: '8.1', homeRunsPer9: '0.8', inningsPitched: '98.2', gamesPlayed: 18, gamesStarted: 18 },
    recentStarts: [
      { date: '2024-05-25', opponent: 'Opp X', opponentTeamId: 100103, inningsPitched: '6.0', earnedRuns: 1, strikeOuts: 8, baseOnBalls: 2, pitches: 98, homeRunsAllowed: 0, hits: 4, gamePk: 5001 },
      { date: '2024-05-19', opponent: 'Opp Y', opponentTeamId: 100104, inningsPitched: '5.2', earnedRuns: 3, strikeOuts: 7, baseOnBalls: 3, pitches: 92, homeRunsAllowed: 1, hits: 6, gamePk: 4995 },
    ],
    daysSinceLastStart: 7,
    completeness: 1,
    warnings: [],
    provenance: { source: 'backtesting:fixture:pitcher:2001', fetchedAt: new Date('2024-06-01T10:00:00Z'), sourceTimestamp: new Date('2024-05-31T12:00:00Z'), isLive: false, warnings: [] },
    asOf: new Date('2024-05-31T23:59:59Z'),
  },
  2002: {
    personId: 2002,
    fullName: 'Starter Beta',
    teamId: 100102,
    seasonStats: { era: '4.50', whip: '1.40', strikeoutsPer9Inn: '7.8', walksPer9Inn: '3.1', hitsPer9Inn: '9.2', homeRunsPer9: '1.1', inningsPitched: '85.1', gamesPlayed: 17, gamesStarted: 17 },
    recentStarts: [
      { date: '2024-05-24', opponent: 'Opp Z', opponentTeamId: 100101, inningsPitched: '4.1', earnedRuns: 5, strikeOuts: 5, baseOnBalls: 4, pitches: 87, homeRunsAllowed: 2, hits: 7, gamePk: 5000 },
    ],
    daysSinceLastStart: 8,
    completeness: 1,
    warnings: [],
    provenance: { source: 'backtesting:fixture:pitcher:2002', fetchedAt: new Date('2024-06-01T10:00:00Z'), sourceTimestamp: new Date('2024-05-31T12:00:00Z'), isLive: false, warnings: [] },
    asOf: new Date('2024-05-31T23:59:59Z'),
  },
  2003: null,
  2004: null,
  2005: null,
  2006: null,
  2007: null,
  2008: null,
  2009: null,
};

const teamProfiles: Record<number, HistoricalTeamProfile | null> = {
  100101: {
    teamId: 100101,
    teamName: 'Home Alpha',
    seasonStats: { gamesPlayed: 54, runs: 210, hits: 420, homeRuns: 38, strikeOuts: 390, baseOnBalls: 160, battingAverage: '.250', obp: '.320', slg: '.410', ops: '.730' },
    recentGames: [
      { gamePk: 9901, gameDate: '2024-05-31', opponent: 'Opponent 1', opponentTeamId: 100103, homeAway: 'HOME', runsScored: 6, runsAllowed: 2, win: true },
      { gamePk: 9902, gameDate: '2024-05-29', opponent: 'Opponent 2', opponentTeamId: 100102, homeAway: 'AWAY', runsScored: 3, runsAllowed: 4, win: false },
    ],
    completeness: 1,
    warnings: [],
    provenance: { source: 'backtesting:fixture:team:100101', fetchedAt: new Date('2024-06-01T10:00:00Z'), sourceTimestamp: new Date('2024-05-31T12:00:00Z'), isLive: false, warnings: [] },
    asOf: new Date('2024-05-31T23:59:59Z'),
  },
  100102: {
    teamId: 100102,
    teamName: 'Away Alpha',
    seasonStats: { gamesPlayed: 54, runs: 185, hits: 390, homeRuns: 28, strikeOuts: 420, baseOnBalls: 145, battingAverage: '.240', obp: '.300', slg: '.380', ops: '.680' },
    recentGames: [
      { gamePk: 9903, gameDate: '2024-05-30', opponent: 'Opponent 3', opponentTeamId: 100104, homeAway: 'HOME', runsScored: 4, runsAllowed: 5, win: false },
    ],
    completeness: 1,
    warnings: [],
    provenance: { source: 'backtesting:fixture:team:100102', fetchedAt: new Date('2024-06-01T10:00:00Z'), sourceTimestamp: new Date('2024-05-31T12:00:00Z'), isLive: false, warnings: [] },
    asOf: new Date('2024-05-31T23:59:59Z'),
  },
  100103: {
    teamId: 100103,
    teamName: 'Home Gamma',
    seasonStats: { gamesPlayed: 54, runs: 195, hits: 405, homeRuns: 32, strikeOuts: 380, baseOnBalls: 150, battingAverage: '.245', obp: '.315', slg: '.400', ops: '.715' },
    recentGames: [],
    completeness: 0.6,
    warnings: ['Incomplete season data'],
    provenance: { source: 'backtesting:fixture:team:100103', fetchedAt: new Date('2024-06-01T10:00:00Z'), sourceTimestamp: new Date('2024-05-31T12:00:00Z'), isLive: false, warnings: [] },
    asOf: new Date('2024-05-31T23:59:59Z'),
  },
  100104: null,
  100105: null,
};

const recentTeamGames: Record<number, readonly HistoricalTeamGame[]> = {
  100101: [
    { gamePk: 9901, gameDate: new Date('2024-05-31T00:00:00Z'), opponent: 'Opponent 1', opponentTeamId: 100103, homeAway: 'HOME', runsScored: 6, runsAllowed: 2, win: true },
    { gamePk: 9902, gameDate: new Date('2024-05-29T00:00:00Z'), opponent: 'Opponent 2', opponentTeamId: 100102, homeAway: 'AWAY', runsScored: 3, runsAllowed: 4, win: false },
  ],
  100102: [
    { gamePk: 9903, gameDate: new Date('2024-05-30T00:00:00Z'), opponent: 'Opponent 3', opponentTeamId: 100104, homeAway: 'HOME', runsScored: 4, runsAllowed: 5, win: false },
  ],
};

export function buildMLBFixtures(): MLBHistoricalFixture {
  return {
    games: Object.freeze(games),
    outcomes: Object.freeze(outcomes),
    recentWinRates: Object.freeze(recentWinRates),
    seasonWinRates: Object.freeze(seasonWinRates),
    pitcherProfiles: Object.freeze(pitcherProfiles),
    teamProfiles: Object.freeze(teamProfiles),
    recentTeamGames: Object.freeze(recentTeamGames),
    intentionallyMissingPitcherProfileIds: Object.freeze([2003, 2004, 2005, 2006, 2007, 2008, 2009]),
  };
}

export const fixtureOutcomes = new Map(outcomes.map((o) => [o.gamePk, o]));
export const fixtureGameIndex = new Map(games.map((g) => [g.gamePk, g]));

export function getMLBFixtureDateRange(
  fixture: MLBHistoricalFixture,
): { readonly startDate: string; readonly endDate: string } {
  const dates = fixture.games.map((game) => game.officialDate);
  if (dates.length === 0) {
    throw new Error('Cannot derive MLB fixture date range: fixture contains no games');
  }
  const sorted = [...new Set(dates)].sort();
  return { startDate: sorted[0], endDate: sorted[sorted.length - 1] };
}

export function createMLBFixtureProvider(
  fixture: MLBHistoricalFixture,
): MLBHistoricalDataProvider {
  return {
    fetchGamesForDate: async (date: string) => {
      return fixture.games.filter((game) => game.officialDate === date);
    },
    fetchGameOutcome: async (gamePk: number) => {
      const outcome = fixture.outcomes.find((o) => o.gamePk === gamePk);
      if (!outcome) {
        throw new Error(`Missing outcome for gamePk ${gamePk}`);
      }
      return outcome;
    },
    fetchPitcherStatsAsOf: async (personId: number) => {
      return fixture.pitcherProfiles[personId] ?? null;
    },
    fetchTeamStatsAsOf: async (teamId: number) => {
      return fixture.teamProfiles[teamId] ?? null;
    },
    fetchRecentGamesBefore: async (teamId: number, cutoff: Date, limit?: number) => {
      const all = fixture.recentTeamGames[teamId] ?? [];
      const eligible = all.filter((game) => game.gameDate < cutoff);
      const sorted = [...eligible].sort((a, b) => {
        const aTime = a.gameDate.getTime();
        const bTime = b.gameDate.getTime();
        if (aTime !== bTime) return bTime - aTime;
        return b.gamePk - a.gamePk;
      });
      const limited = limit !== undefined ? sorted.slice(0, limit) : sorted;
      return limited;
    },
  };
}
