export interface DataProvenance {
  source: string;
  fetchedAt: Date;
  sourceTimestamp?: Date;
  isLive: boolean;
  warnings: string[];
}

export type PitcherAssignmentStatus =
  | 'CONFIRMED'
  | 'PROBABLE'
  | 'UNAVAILABLE'
  | 'CHANGED';

export type PitcherAssignment =
  | {
      availability: 'AVAILABLE';
      personId: number;
      fullName?: string;
      teamId: number;
      status: Exclude<PitcherAssignmentStatus, 'UNAVAILABLE'>;
      fetchedAt: Date;
      warnings: string[];
    }
  | {
      availability: 'UNAVAILABLE';
      teamId: number;
      status: 'UNAVAILABLE';
      fetchedAt: Date;
      warnings: string[];
    };

export interface PitcherSeasonStatsRaw {
  age: number;
  gamesPlayed: number;
  gamesStarted: number;
  inningsPitched: string;
  era: string;
  whip: string;
  strikeOuts: number;
  baseOnBalls: number;
  homeRuns: number;
  hits: number;
  earnedRuns: number;
  gamesPitched: number;
  strikeoutsPer9Inn: string;
  walksPer9Inn: string;
  hitsPer9Inn: string;
  homeRunsPer9: string;
  wins: number;
  losses: number;
  saves: number;
  holds: number;
  blownSaves: number;
  battersFaced: number;
  numberOfPitches: number;
  strikePercentage: string;
  pitchCount?: number;
  hand?: 'L' | 'R' | 'S';
}

export interface PitcherRecentStart {
  date: string;
  opponent: string;
  opponentTeamId: number;
  inningsPitched: string;
  earnedRuns: number;
  strikeOuts: number;
  baseOnBalls: number;
  pitches?: number;
  homeRunsAllowed?: number;
  hits?: number;
  gamePk?: number;
}

export interface PitcherResearchProfile {
  personId: number;
  fullName?: string;
  teamId: number;
  hand?: 'L' | 'R' | 'S';
  seasonStats: PitcherSeasonStatsRaw | null;
  recentStarts: PitcherRecentStart[];
  daysSinceLastStart: number | null;
  completeness: number;
  warnings: string[];
  provenance: DataProvenance;
}

export interface TeamBattingStatsRaw {
  gamesPlayed: number;
  runs: number;
  hits: number;
  homeRuns: number;
  strikeOuts: number;
  baseOnBalls: number;
  avg: string;
  obp: string;
  slg: string;
  ops: string;
  atBats: number;
  plateAppearances: number;
  totalBases: number;
  rbi: number;
  leftOnBase: number;
  babip: string;
  atBatsPerHomeRun: string;
}

export interface TeamBattingProfile {
  teamId: number;
  teamName: string;
  seasonStats: TeamBattingStatsRaw | null;
  homeAwaySplit?: {
    isHome: boolean;
    avg: string;
    obp: string;
    slg: string;
    ops: string;
    runsPerGame: string;
  };
  recentFormWindow?: {
    games: number;
    avg: string;
    obp: string;
    slg: string;
    ops: string;
    runsPerGame: string;
  };
  completeness: number;
  warnings: string[];
  provenance: DataProvenance;
}

export interface TeamPitchingStatsRaw {
  gamesPlayed: number;
  gamesStarted: number;
  inningsPitched: string;
  era: string;
  whip: string;
  strikeOuts: number;
  baseOnBalls: number;
  homeRuns: number;
  hits: number;
  earnedRuns: number;
  gamesPitched: number;
  saves: number;
  saveOpportunities: number;
  holds: number;
  blownSaves: number;
  strikeoutsPer9Inn: string;
  walksPer9Inn: string;
  hitsPer9Inn: string;
  homeRunsPer9: string;
}

export interface BullpenProfile {
  teamId: number;
  teamName: string;
  seasonStats: TeamPitchingStatsRaw | null;
  recentWorkload: {
    games: number;
    inningsPitched: string;
    hits: number;
    walks: number;
    earnedRuns: number;
    battersFaced: number;
  } | null;
  confirmedRelieverAvailability: 'KNOWN' | 'PARTIAL' | 'UNKNOWN';
  completeness: number;
  warnings: string[];
  provenance: DataProvenance;
}

export type RoofType = 'OPEN' | 'RETRACTABLE' | 'DOME' | 'UNKNOWN';

export interface MLBVenue {
  id: number;
  name: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  roofType: RoofType;
  warnings: string[];
}

export interface MLBScheduleGame {
  gamePk: number;
  officialDate: string;
  gameDate: string;
  startTimeUtc: Date;
  status: 'UPCOMING' | 'LIVE' | 'FINAL' | 'POSTPONED' | 'CANCELLED';
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  venueId: number;
  venueName: string;
  dayNight: 'day' | 'night' | 'unknown';
  scheduledInnings: number;
  doubleHeader: string;
  seriesGameNumber: number;
  gamesInSeries: number;
  seriesDescription: string;
  leagueRecord: {
    home: { wins: number; losses: number; pct: string };
    away: { wins: number; losses: number; pct: string };
  };
  probablePitchers: {
    home: PitcherAssignment | null;
    away: PitcherAssignment | null;
  };
}

export interface MLBScheduleResult {
  games: MLBScheduleGame[];
  provenance: DataProvenance;
}

export interface ProbablePitchersResult {
  gamePk: number;
  home: PitcherAssignment | null;
  away: PitcherAssignment | null;
  provenance: DataProvenance;
}

export interface PitcherSeasonStatsResult {
  personId: number;
  season: number;
  stats: PitcherSeasonStatsRaw | null;
  provenance: DataProvenance;
}

export interface PitcherRecentFormResult {
  personId: number;
  season: number;
  starts: PitcherRecentStart[];
  provenance: DataProvenance;
}

export interface TeamBattingStatsResult {
  teamId: number;
  season: number;
  stats: TeamBattingStatsRaw | null;
  provenance: DataProvenance;
}

export interface TeamPitchingStatsResult {
  teamId: number;
  season: number;
  stats: TeamPitchingStatsRaw | null;
  provenance: DataProvenance;
}

export interface GameWeather {
  temperatureC: number;
  precipitationProbability: number;
  precipitationMm: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  humidityPercent: number | null;
  matchedHourUtc: string;
  rawTimestamp: string;
  freshness: DataProvenance;
}

export type ResearchDataMode = 'fixture' | 'live';

export interface FreshnessConfig {
  scheduleStaleMs: number;
  probablePitcherStaleMs: number;
  teamStatsStaleMs: number;
  recentGameStaleMs: number;
  weatherStaleMs: number;
}

export const DEFAULT_FRESHNESS_CONFIG: FreshnessConfig = {
  scheduleStaleMs: 15 * 60 * 1000, // 15 minutes
  probablePitcherStaleMs: 30 * 60 * 1000, // 30 minutes
  teamStatsStaleMs: 6 * 60 * 60 * 1000, // 6 hours
  recentGameStaleMs: 6 * 60 * 60 * 1000, // 6 hours
  weatherStaleMs: 90 * 60 * 1000, // 90 minutes
};

export interface MLBGameResearchSnapshot {
  event: {
    id: string;
    externalId: string;
    sport: string;
    league: string;
    leagueSlug: string;
    homeTeam: string;
    awayTeam: string;
    homeTeamSlug?: string;
    awayTeamSlug?: string;
    startTimeUtc: Date;
    status: string;
    homeScore?: number;
    awayScore?: number;
    createdAt: Date;
    updatedAt: Date;
  };
  probablePitchers: {
    home: PitcherAssignment | null;
    away: PitcherAssignment | null;
  };
  pitcherStats: {
    home: PitcherResearchProfile | null;
    away: PitcherResearchProfile | null;
  };
  teamBatting: {
    home: TeamBattingProfile | null;
    away: TeamBattingProfile | null;
  };
  bullpen: {
    home: BullpenProfile | null;
    away: BullpenProfile | null;
  };
  venue: MLBVenue | null;
  weather: GameWeather | null;
  completeness: number;
  warnings: string[];
  provenance: DataProvenance[];
  generatedAt: Date;
}

export interface SchedulePitcherContext {
  home: PitcherAssignment | null;
  away: PitcherAssignment | null;
  homeTeamId: number;
  awayTeamId: number;
}

export interface MLBResearchDataProvider {
  fetchSchedule(date: string): Promise<MLBScheduleResult>;
  fetchProbablePitchers(
    gamePk: number,
    schedulePitchers?: SchedulePitcherContext,
  ): Promise<ProbablePitchersResult>;
  fetchPitcherSeasonStats(
    personId: number,
    season: number,
  ): Promise<PitcherSeasonStatsResult>;
  fetchPitcherRecentStarts(
    personId: number,
    season: number,
    limit: number,
  ): Promise<PitcherRecentFormResult>;
  fetchTeamBattingStats(
    teamId: number,
    season: number,
  ): Promise<TeamBattingStatsResult>;
  fetchTeamPitchingStats(
    teamId: number,
    season: number,
  ): Promise<TeamPitchingStatsResult>;
  fetchVenue(venueId: number): Promise<MLBVenue>;
}

export interface WeatherProvider {
  fetchGameWeather(
    latitude: number,
    longitude: number,
    firstPitchUtc: Date,
    timezone: string,
  ): Promise<GameWeather>;
}
