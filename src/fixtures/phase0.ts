export const FIXTURE_CLOCK = new Date('2026-06-26T00:00:00.000Z');

export interface FixtureEvent {
  id: string;
  externalId: string;
  sport: 'mlb';
  league: string;
  leagueSlug: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamSlug?: string;
  awayTeamSlug?: string;
  startTimeUtc: Date;
  status: 'UPCOMING';
}

export interface FixtureOddsSample {
  id: string;
  eventId: string;
  bookmaker: string;
  marketKey: string;
  selectionId: string;
  selection: string;
  line?: string;
  decimalOdds: number;
  timestamp: Date;
}

export const canonicalEvents: FixtureEvent[] = [
  {
    id: 'event-1',
    externalId: 'mlb-provider-1',
    sport: 'mlb',
    league: 'MLB',
    leagueSlug: 'mlb',
    homeTeam: 'New York Yankees',
    awayTeam: 'Boston Red Sox',
    homeTeamSlug: 'nyy',
    awayTeamSlug: 'bos',
    startTimeUtc: new Date(FIXTURE_CLOCK.getTime() + 24 * 60 * 60 * 1000),
    status: 'UPCOMING',
  },
  {
    id: 'event-2',
    externalId: 'mlb-provider-2',
    sport: 'mlb',
    league: 'MLB',
    leagueSlug: 'mlb',
    homeTeam: 'Los Angeles Dodgers',
    awayTeam: 'San Francisco Giants',
    homeTeamSlug: 'lad',
    awayTeamSlug: 'sfg',
    startTimeUtc: new Date(FIXTURE_CLOCK.getTime() + 26 * 60 * 60 * 1000),
    status: 'UPCOMING',
  },
  {
    id: 'event-3',
    externalId: 'mlb-provider-3',
    sport: 'mlb',
    league: 'MLB',
    leagueSlug: 'mlb',
    homeTeam: 'Chicago Cubs',
    awayTeam: 'St. Louis Cardinals',
    homeTeamSlug: 'chc',
    awayTeamSlug: 'stl',
    startTimeUtc: new Date(FIXTURE_CLOCK.getTime() + 28 * 60 * 60 * 1000),
    status: 'UPCOMING',
  },
  {
    id: 'event-4',
    externalId: 'mlb-provider-4',
    sport: 'mlb',
    league: 'MLB',
    leagueSlug: 'mlb',
    homeTeam: 'Houston Astros',
    awayTeam: 'Seattle Mariners',
    homeTeamSlug: 'hou',
    awayTeamSlug: 'sea',
    startTimeUtc: new Date(FIXTURE_CLOCK.getTime() + 30 * 60 * 60 * 1000),
    status: 'UPCOMING',
  },
  {
    id: 'event-5',
    externalId: 'mlb-provider-5',
    sport: 'mlb',
    league: 'MLB',
    leagueSlug: 'mlb',
    homeTeam: 'Atlanta Braves',
    awayTeam: 'Philadelphia Phillies',
    homeTeamSlug: 'atl',
    awayTeamSlug: 'phi',
    startTimeUtc: new Date(FIXTURE_CLOCK.getTime() + 32 * 60 * 60 * 1000),
    status: 'UPCOMING',
  },
];

export const fixtureOddsSamples: FixtureOddsSample[] = [
  // Sportsbet H2H markets for 4 events
  { id: 'odds-1-1', eventId: 'event-1', bookmaker: 'SPORTSBET', marketKey: 'h2h', selectionId: 'team-a', selection: 'New York Yankees', decimalOdds: 1.85, timestamp: FIXTURE_CLOCK },
  { id: 'odds-1-2', eventId: 'event-1', bookmaker: 'SPORTSBET', marketKey: 'h2h', selectionId: 'team-b', selection: 'Boston Red Sox', decimalOdds: 2.0, timestamp: FIXTURE_CLOCK },
  { id: 'odds-2-1', eventId: 'event-2', bookmaker: 'SPORTSBET', marketKey: 'h2h', selectionId: 'team-a', selection: 'Los Angeles Dodgers', decimalOdds: 1.75, timestamp: FIXTURE_CLOCK },
  { id: 'odds-2-2', eventId: 'event-2', bookmaker: 'SPORTSBET', marketKey: 'h2h', selectionId: 'team-b', selection: 'San Francisco Giants', decimalOdds: 2.1, timestamp: FIXTURE_CLOCK },
  { id: 'odds-3-1', eventId: 'event-3', bookmaker: 'SPORTSBET', marketKey: 'h2h', selectionId: 'team-a', selection: 'Chicago Cubs', decimalOdds: 1.9, timestamp: FIXTURE_CLOCK },
  { id: 'odds-3-2', eventId: 'event-3', bookmaker: 'SPORTSBET', marketKey: 'h2h', selectionId: 'team-b', selection: 'St. Louis Cardinals', decimalOdds: 1.95, timestamp: FIXTURE_CLOCK },
  { id: 'odds-4-1', eventId: 'event-4', bookmaker: 'SPORTSBET', marketKey: 'h2h', selectionId: 'team-a', selection: 'Houston Astros', decimalOdds: 1.8, timestamp: FIXTURE_CLOCK },
  // Sportsbet missing market for event-5 (no Sportsbet odds)
  // Alternative bookmaker for event-5
  { id: 'odds-5-1', eventId: 'event-5', bookmaker: 'LADBROKES', marketKey: 'h2h', selectionId: 'team-a', selection: 'Atlanta Braves', decimalOdds: 1.88, timestamp: FIXTURE_CLOCK },
  { id: 'odds-5-2', eventId: 'event-5', bookmaker: 'LADBROKES', marketKey: 'h2h', selectionId: 'team-b', selection: 'Philadelphia Phillies', decimalOdds: 1.95, timestamp: FIXTURE_CLOCK },
];

export const fixtureStatistics: Record<string, Record<string, unknown>> = {
  'event-1': { mock: true, note: 'No real projection in Phase 0' },
  'event-2': { mock: true, note: 'No real projection in Phase 0' },
  'event-3': { mock: true, note: 'No real projection in Phase 0' },
  'event-4': { mock: true, note: 'No real projection in Phase 0' },
  'event-5': { mock: true, note: 'No real projection in Phase 0' },
};
