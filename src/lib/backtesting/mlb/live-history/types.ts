import type { ZodType } from 'zod';

export type MLBHistoricalHttpErrorKind = 'NETWORK' | 'TIMEOUT' | 'HTTP' | 'VALIDATION';

export type HistoricalStarterSource =
  | 'SCHEDULE_PROBABLE_BEFORE_CUTOFF'
  | 'SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN'
  | 'ACTUAL_STARTER_RETROSPECTIVE'
  | 'UNAVAILABLE';

export type CanonicalHistoricalGameStatus =
  | 'UPCOMING'
  | 'LIVE'
  | 'FINAL'
  | 'CANCELLED'
  | 'POSTPONED'
  | 'SUSPENDED'
  | 'UNKNOWN';

export interface CanonicalHistoricalScheduleGame {
  readonly gamePk: number;
  readonly officialDate: string;
  readonly scheduledStart: Date;
  readonly cutoffTime: Date;
  readonly status: CanonicalHistoricalGameStatus;
  readonly homeTeamId: number;
  readonly homeTeamName: string;
  readonly awayTeamId: number;
  readonly awayTeamName: string;
  readonly venueId: number | null;
  readonly venueName: string | null;
  readonly doubleheader: boolean;
  readonly gameNumber: number;
  readonly scheduledInnings: number | null;
  readonly homeProbablePitcherId: number | null;
  readonly awayProbablePitcherId: number | null;
  readonly homeStarterSource: HistoricalStarterSource;
  readonly awayStarterSource: HistoricalStarterSource;
  readonly rescheduledFromGamePk: number | null;
  readonly rawGameType?: string | null;
  readonly warnings: readonly string[];
  readonly provenance: {
    readonly endpoint: string;
    readonly fetchedAt: Date;
    readonly sourceTimestamp: Date | null;
  };
}

export type HistoricalCompletionTimeSource = 'LAST_COMPLETED_PLAY_END';

export interface CanonicalHistoricalOutcome {
  readonly gamePk: number;
  readonly status: 'FINAL' | 'CANCELLED' | 'POSTPONED' | 'SUSPENDED' | 'UNKNOWN';
  readonly homeScore: number | null;
  readonly awayScore: number | null;
  readonly winner: 'HOME' | 'AWAY' | null;
  readonly innings: number | null;
  readonly completedAt: Date | null;
  readonly completedAtSource: HistoricalCompletionTimeSource | null;
  readonly warnings: readonly string[];
}

export interface CompletedHistoricalTeamGame {
  readonly gamePk: number;
  readonly gameStart: Date;
  readonly completedAt: Date | null;
  readonly completedAtSource: HistoricalCompletionTimeSource | null;
  readonly status: 'FINAL' | 'SUSPENDED' | 'POSTPONED' | 'CANCELLED';
  readonly teamId: number;
  readonly opponentTeamId: number;
  readonly isHome: boolean;
  readonly runsScored: number | null;
  readonly runsAllowed: number | null;
  readonly innings: number | null;
}

export interface HistoricalPitcherAppearance {
  readonly gamePk: number;
  readonly gameStart: Date;
  readonly completedAt: Date | null;
  readonly completedAtSource: HistoricalCompletionTimeSource | null;
  readonly status: 'FINAL' | 'SUSPENDED' | 'POSTPONED' | 'CANCELLED';
  readonly personId: number;
  readonly teamId: number;
  readonly started: boolean;
  readonly inningsPitched: string;
  readonly earnedRuns: number;
  readonly strikeouts: number;
  readonly walks: number;
  readonly hitsAllowed: number;
  readonly homeRunsAllowed: number;
  readonly pitches: number | null;
}

export interface CanonicalPitcherFeedPlayer {
  readonly personId: number;
  readonly gamesStarted: number | null;
  readonly pitchingStats: {
    readonly earnedRuns: number | null;
    readonly hits: number | null;
    readonly homeRuns: number | null;
    readonly strikeouts: number | null;
    readonly walks: number | null;
    readonly outs: number | null;
    readonly pitchesThrown: number | null;
  };
}

export interface CanonicalHistoricalPitcherFeed {
  readonly gamePk: number;
  readonly status: CanonicalHistoricalGameStatus;
  readonly homePlayers: readonly CanonicalPitcherFeedPlayer[];
  readonly awayPlayers: readonly CanonicalPitcherFeedPlayer[];
  readonly allPlays: readonly { readonly about?: { readonly isComplete?: boolean; readonly endTime?: string } }[];
  readonly completedAt: Date | null;
  readonly completedAtSource: HistoricalCompletionTimeSource | null;
  readonly completionWarnings: readonly string[];
}

export interface MLBHistoricalHttpClientOptions {
  readonly rootEndpoint?: string;
  readonly timeoutMs?: number;
  readonly retryAttempts?: number;
  readonly baseBackoffMs?: number;
  readonly fetchImpl?: typeof fetch;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}

export interface MLBHistoricalHttpClient {
  getJson<T>(
    endpoint: string,
    params: Record<string, string | number | boolean | undefined>,
    schema: ZodType<T>,
  ): Promise<T>;
  getRequestCount(): number;
  getStats(): MLBHistoricalHttpClientStats;
}

export interface MLBHistoricalHttpClientStatsByEndpoint {
  readonly logicalRequests: number;
  readonly fetchAttempts: number;
  readonly successfulResponses: number;
  readonly httpFailures: number;
  readonly transportFailures: number;
  readonly timeouts: number;
  readonly parseFailures: number;
  readonly schemaFailures: number;
  readonly retries: number;
}

export interface MLBHistoricalHttpClientStats {
  readonly logicalRequests: number;
  readonly fetchAttempts: number;
  readonly successfulResponses: number;
  readonly httpFailures: number;
  readonly transportFailures: number;
  readonly timeouts: number;
  readonly parseFailures: number;
  readonly schemaFailures: number;
  readonly retries: number;
  readonly byEndpoint: Readonly<Record<string, MLBHistoricalHttpClientStatsByEndpoint>>;
}

export class MLBHistoricalHttpError extends Error {
  readonly endpoint: string;
  readonly status: number | null;
  readonly attempts: number;
  readonly kind: MLBHistoricalHttpErrorKind;
  readonly cause?: unknown;

  constructor(params: {
    readonly endpoint: string;
    readonly status: number | null;
    readonly attempts: number;
    readonly kind: MLBHistoricalHttpErrorKind;
    readonly cause?: unknown;
    readonly message?: string;
  }) {
    super(params.message ?? `MLB historical request failed: ${params.endpoint}`);
    this.endpoint = params.endpoint;
    this.status = params.status;
    this.attempts = params.attempts;
    this.kind = params.kind;
    this.cause = params.cause;
  }
}

export interface MLBHistoricalCacheConfig {
  readonly root: string;
  readonly version: string;
}

export interface CacheProvenance {
  readonly endpoint: string;
  readonly fetchedAt: Date;
  readonly sourceTimestamp: Date | null;
}

export interface CacheEnvelope<T> {
  readonly version: string;
  readonly endpoint: string;
  readonly params: Record<string, unknown>;
  readonly cachedAt: string;
  readonly data: T;
  readonly provenance: CacheProvenance;
}

export interface CacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly writes: number;
  readonly corruptions: number;
  readonly versionMismatches: number;
}

export interface MLBHistoricalCache {
  get<T>(
    endpoint: string,
    params: Record<string, unknown>,
    dataSchema: ZodType<T>,
  ): Promise<T | null>;
  set<T>(
    endpoint: string,
    params: Record<string, unknown>,
    data: T,
    provenance: CacheProvenance,
  ): Promise<void>;
  stats(): CacheStats;
  clearStats(): void;
}

export interface MLBHistoricalCacheWithProvenance
  extends MLBHistoricalCache {
  getWithProvenance<T>(
    endpoint: string,
    params: Record<string, unknown>,
    dataSchema: ZodType<T>,
  ): Promise<{ readonly value: T; readonly provenance: CacheProvenance } | null>;
}

export type MLBHistoricalAcquisitionProvenance = CacheProvenance;

export interface MLBHistoricalOutcomeWithProvenance {
  readonly outcome: CanonicalHistoricalOutcome;
  readonly provenance: MLBHistoricalAcquisitionProvenance;
}

export interface MLBHistoricalTeamGamesWithProvenance {
  readonly games: readonly CompletedHistoricalTeamGame[];
  readonly provenance: readonly MLBHistoricalAcquisitionProvenance[];
}

export interface MLBHistoricalPitcherAppearancesWithProvenance {
  readonly appearances: readonly HistoricalPitcherAppearance[];
  readonly provenance: readonly MLBHistoricalAcquisitionProvenance[];
}

export interface TeamHistoricalAggregate {
  readonly teamId: number;
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly winRate: number | null;
  readonly runsScored: number;
  readonly runsAllowed: number;
  readonly runDifferential: number;
  readonly runsScoredPerGame: number | null;
  readonly runsAllowedPerGame: number | null;
  readonly recent5Wins: number;
  readonly recent5Losses: number;
  readonly recent10Wins: number;
  readonly recent10Losses: number;
  readonly recent10RunsPerGame: number | null;
  readonly homeWins: number;
  readonly homeLosses: number;
  readonly awayWins: number;
  readonly awayLosses: number;
  readonly restDays: number | null;
  readonly gamesInPrevious3Days: number;
  readonly extraInningGames: number;
  readonly sampleSize: number;
  readonly warnings: readonly string[];
}

export interface PitcherHistoricalAggregate {
  readonly personId: number;
  readonly teamId: number | null;
  readonly appearances: number;
  readonly gamesStarted: number;
  readonly outsRecorded: number;
  readonly inningsPitchedDisplay: string;
  readonly earnedRuns: number;
  readonly hitsAllowed: number;
  readonly walks: number;
  readonly strikeouts: number;
  readonly homeRunsAllowed: number;
  readonly era: number | null;
  readonly whip: number | null;
  readonly kPer9: number | null;
  readonly bbPer9: number | null;
  readonly hPer9: number | null;
  readonly hrPer9: number | null;
  readonly previousStartDate: Date | null;
  readonly daysRest: number | null;
  readonly recent3Starts: readonly HistoricalPitcherAppearance[];
  readonly recent5Starts: readonly HistoricalPitcherAppearance[];
  readonly sampleSize: number;
  readonly warnings: readonly string[];
}
