export interface HistoricalCutoff {
  eventId: string;
  cutoffTime: Date;
}

export interface HistoricalMLBGame {
  gamePk: number;
  officialDate: string;
  gameDate: Date;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  venueId: number;
  status: 'UPCOMING' | 'LIVE' | 'FINAL' | 'CANCELLED' | 'POSTPONED' | 'SUSPENDED' | 'UNKNOWN';
  probablePitchers: {
    home: import('@/lib/research-data/types').PitcherAssignment | null;
    away: import('@/lib/research-data/types').PitcherAssignment | null;
  } | null;
  cutoff: HistoricalCutoff;
}

export interface MLBGameOutcome {
  gamePk: number;
  homeScore: number | null;
  awayScore: number | null;
  winner: 'HOME' | 'AWAY' | 'TIE' | null;
  innings: number | null;
  status: string;
  linescore: unknown | null;
}

export interface HistoricalPitcherProfile {
  personId: number;
  fullName: string | null;
  teamId: number | null;
  hand?: 'L' | 'R' | 'S';
  seasonStats: {
    era: string;
    whip: string;
    strikeoutsPer9Inn: string;
    walksPer9Inn: string;
    hitsPer9Inn: string;
    homeRunsPer9: string;
    inningsPitched: string;
    gamesPlayed: number;
    gamesStarted: number;
  } | null;
  recentStarts: {
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
  }[];
  daysSinceLastStart: number | null;
  completeness: number;
  warnings: string[];
  provenance: {
    source: string;
    fetchedAt: Date;
    sourceTimestamp: Date;
    isLive: boolean;
    warnings: string[];
  };
  asOf: Date;
}

export interface HistoricalTeamProfile {
  teamId: number;
  teamName: string | null;
  seasonStats: {
    gamesPlayed: number;
    runs: number;
    hits: number;
    homeRuns: number;
    strikeOuts: number;
    baseOnBalls: number;
    battingAverage: string;
    obp: string;
    slg: string;
    ops: string;
  } | null;
  recentGames: {
    gamePk: number;
    gameDate: string;
    opponent: string;
    opponentTeamId: number;
    homeAway: 'HOME' | 'AWAY';
    runsScored: number | null;
    runsAllowed: number | null;
    win: boolean | null;
  }[];
  completeness: number;
  warnings: string[];
  provenance: {
    source: string;
    fetchedAt: Date;
    sourceTimestamp: Date;
    isLive: boolean;
    warnings: string[];
  };
  asOf: Date;
}

export interface HistoricalTeamGame {
  gamePk: number;
  gameDate: Date;
  opponent: string;
  opponentTeamId: number;
  homeAway: 'HOME' | 'AWAY';
  runsScored: number | null;
  runsAllowed: number | null;
  win: boolean | null;
}

export interface MLBHistoricalDataProvider {
  fetchGamesForDate(date: string): Promise<HistoricalMLBGame[]>;
  fetchGameOutcome(gamePk: number): Promise<MLBGameOutcome>;
  fetchPitcherStatsAsOf(personId: number, cutoff: Date): Promise<HistoricalPitcherProfile | null>;
  fetchTeamStatsAsOf(teamId: number, cutoff: Date): Promise<HistoricalTeamProfile | null>;
  fetchRecentGamesBefore(teamId: number, cutoff: Date, limit: number): Promise<HistoricalTeamGame[]>;
}

export interface MLBPregameFeatures {
  startingPitcher: {
    homeEra: number | null;
    awayEra: number | null;
    homeWhip: number | null;
    awayWhip: number | null;
    homeKPer9: number | null;
    awayKPer9: number | null;
    homeDaysRest: number | null;
    awayDaysRest: number | null;
    homeAvailable: boolean;
    awayAvailable: boolean;
  };
  offense: {
    homeRunsPerGame: number | null;
    awayRunsPerGame: number | null;
    homeOps: number | null;
    awayOps: number | null;
    homeRecentWinRate: number | null;
    awayRecentWinRate: number | null;
    homeSeasonWinRate: number | null;
    awaySeasonWinRate: number | null;
  };
  context: {
    homeAdvantage: boolean;
    venueKnown: boolean;
    weatherAvailable: boolean;
  };
  availability: Record<string, boolean>;
}

export interface BacktestSnapshot {
  game: HistoricalMLBGame;
  cutoff: Date;
  pitcherProfiles: {
    home: HistoricalPitcherProfile | null;
    away: HistoricalPitcherProfile | null;
  };
  teamProfiles: {
    home: HistoricalTeamProfile | null;
    away: HistoricalTeamProfile | null;
  };
  recentGames: {
    home: readonly HistoricalTeamGame[];
    away: readonly HistoricalTeamGame[];
  };
  features: MLBPregameFeatures;
  warnings: string[];
  dataQuality: number;
  featureVersion: string;
  generatedAt: Date;
}

export interface ExploratoryScoreConfig {
  version: string;
  weights: {
    startingPitcher: number;
    opponentBatting: number;
    bullpen: number;
    offenseLineup: number;
    homePark: number;
    injuriesLineup: number;
    restTravel: number;
    weatherRoof: number;
  };
}

export type AbstentionReason =
  | 'GAME_NOT_ELIGIBLE'
  | 'BOTH_PITCHERS_UNAVAILABLE'
  | 'HOME_PITCHER_UNAVAILABLE'
  | 'AWAY_PITCHER_UNAVAILABLE'
  | 'BOTH_TEAM_PROFILES_UNAVAILABLE'
  | 'INSUFFICIENT_FEATURE_COVERAGE'
  | 'DATA_QUALITY_BELOW_THRESHOLD';

export interface BacktestPrediction {
  eventId: string;
  gamePk: number;
  eventDate: string;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: string;
  awayTeam: string;
  predictedSide: 'HOME' | 'AWAY' | null;
  researchStrengthScore: number;
  confidence: number;
  dataQuality: number;
  volatility: 'LOW' | 'MEDIUM' | 'HIGH';
  componentScores: Record<string, number>;
  warnings: string[];
  modelVersion: string;
  featureVersion: string;
  generatedAt: Date;
  historicalCutoffTime: Date;
  actualWinner: 'HOME' | 'AWAY' | 'TIE' | null;
  correct: boolean | null;
  voided: boolean;
  abstained: boolean;
  abstentionReason?: string;
  homePitcherAvailable: boolean;
  awayPitcherAvailable: boolean;
}

export interface BacktestMetrics {
  predictionsMade: number;
  gamesSkipped: number;
  voids: number;
  accuracy: number;
  homePickRate: number;
  awayPickRate: number;
  accuracyByConfidenceBucket: Record<string, { predictions: number; correct: number; accuracy: number }>;
  accuracyByDataQualityBucket: Record<string, { predictions: number; correct: number; accuracy: number }>;
  accuracyByVolatilityBucket: Record<string, { predictions: number; correct: number; accuracy: number }>;
  accuracyWithBothPitchersKnown: number | null;
  accuracyWithMissingPitcher: number | null;
  accuracyByMonth: Record<string, { predictions: number; correct: number; accuracy: number }>;
  naiveHomeBaseline: number | null;
  naiveRecentBaseline: number | null;
  naiveSeasonBaseline: number | null;
}

export interface NaiveBaselineContext {
  recentWinRates: Record<number, number>;
  seasonWinRates: Record<number, number>;
}

export interface BacktestRunnerResult {
  predictions: BacktestPrediction[];
  abstentions: BacktestPrediction[];
  metrics: BacktestMetrics;
}
