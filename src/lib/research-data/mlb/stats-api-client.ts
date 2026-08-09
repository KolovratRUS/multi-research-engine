import { z } from 'zod';
import type {
  DataProvenance,
  MLBVenue,
  MLBScheduleResult,
  ProbablePitchersResult,
  PitcherSeasonStatsResult,
  PitcherRecentFormResult,
  TeamBattingStatsResult,
  TeamPitchingStatsResult,
} from '../types';
import {
  ResearchDataError,
  ResearchDataValidationError,
  ResearchDataTimeoutError,
  ResearchDataUnavailableError,
} from '../errors';

const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1';

function readEnvBaseUrl(): string {
  const raw = process.env.MLB_STATS_API_BASE_URL?.trim();
  if (!raw) return MLB_API_BASE;
  try {
    new URL(raw);
    return raw;
  } catch {
    throw new ResearchDataValidationError({
      message: `Invalid MLB_STATS_API_BASE_URL: ${raw}`,
      source: 'mlb-stats-api',
    });
  }
}

function readEnvTimeoutMs(): number {
  const raw = process.env.RESEARCH_HTTP_TIMEOUT_MS?.trim();
  if (!raw) return 20_000;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ResearchDataValidationError({
      message: `Invalid RESEARCH_HTTP_TIMEOUT_MS: ${raw}. Must be a positive integer.`,
      source: 'mlb-stats-api',
    });
  }
  return Math.floor(parsed);
}

export function resolveMLBConfig(): {
  baseUrl: string;
  timeoutMs: number;
} {
  return {
    baseUrl: readEnvBaseUrl(),
    timeoutMs: readEnvTimeoutMs(),
  };
}

const RETRYABLE_STATUS_CODES = new Set([408, 429, 502, 503, 504]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS_CODES.has(status);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function provenance(source: string, isLive = true): DataProvenance {
  return {
    source,
    fetchedAt: new Date(),
    isLive,
    warnings: [],
  };
}

type JsonValue = unknown;

function safeParseJson(text: string): JsonValue {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ResearchDataValidationError({
      message: 'Invalid JSON from MLB Stats API',
      source: 'mlb-stats-api',
    });
  }
}

function logDev(message: string, payload?: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log(`[mlb-client] ${message}`, payload ?? '');
  }
}

export interface MLBClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new ResearchDataTimeoutError({
              message: `MLB Stats API request timed out after ${timeoutMs}ms`,
              source: 'mlb-stats-api',
            }),
      ),
      timeoutMs,
    ),
  )]);
}

export class MLBStatsApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: MLBClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? MLB_API_BASE;
    this.timeoutMs = config.timeoutMs ?? 20_000;
  }

  private async request<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        logDev(`Fetching ${endpoint}`);

        const response = await withTimeout(
          fetch(url, {
            headers: {
              Accept: 'application/json',
            },
          }),
          this.timeoutMs,
        );

        if (!response.ok) {
          const retryable = isRetryableStatus(response.status);
          const error = new ResearchDataError({
            message: `MLB Stats API error for ${endpoint}: ${response.status} ${response.statusText}`,
            source: 'mlb-stats-api',
            statusCode: response.status,
            isRetryable: retryable,
          });

          if (retryable && attempt < MAX_RETRIES - 1) {
            const backoff = BASE_DELAY_MS * 2 ** attempt;
            logDev(`Retrying ${endpoint} after ${backoff}ms (attempt ${attempt + 1})`);
            await delay(backoff);
            continue;
          }

          throw error;
        }

        const text = await response.text();
        const parsed = safeParseJson(text);

        if (process.env.NODE_ENV !== 'production') {
          logDev(`Fetched ${endpoint}`, {
            sizeBytes: text.length,
            topLevelKeys: parsed && typeof parsed === 'object' && !Array.isArray(parsed)
              ? Object.keys(parsed as Record<string, unknown>).slice(0, 10)
              : Array.isArray(parsed)
                ? [`Array(${(parsed as unknown[]).length})`]
                : ['unknown'],
          });
        }

        return parsed as T;
      } catch (err) {
        if (err instanceof ResearchDataTimeoutError) throw err;
        if (err instanceof ResearchDataError && !err.isRetryable) throw err;
        if (attempt === MAX_RETRIES - 1) throw err;
      }
    }

    throw new ResearchDataUnavailableError({
      message: `MLB Stats API request failed after ${MAX_RETRIES} attempts: ${endpoint}`,
      source: 'mlb-stats-api',
    });
  }

  async fetchSchedule(date: string): Promise<ScheduleResponse> {
    const data = await this.request<JsonValue>(
      `/schedule?sportId=1&date=${encodeURIComponent(date)}&hydrate=probablePitcher,venue`,
    );
    return ScheduleResponseSchema.parse(data);
  }

  async fetchProbablePitchers(
    gamePk: number,
  ): Promise<FeedLiveResponse> {
    const data = await this.request<JsonValue>(
      `/game/${gamePk}/feed/live`,
    );
    return FeedLiveResponseSchema.parse(data);
  }

  async fetchPitcherSeasonStats(
    personId: number,
    season: number,
  ): Promise<PitcherSeasonStatsResult> {
    const data = await this.request<JsonValue>(
      `/people/${personId}/stats?stats=season&season=${season}&group=pitching`,
    );
    const parsed = PersonStatsResponseSchema.parse(data);
    const raw = parsed.stats[0]?.splits[0]?.stat;
    const stats = raw as unknown as PitcherSeasonStatsResult['stats'] | null;
    return {
      personId,
      season,
      stats,
      provenance: provenance('mlb-stats-api:peopleSeasonStats'),
    };
  }

  async fetchPitcherRecentStarts(
    personId: number,
    season: number,
    limit: number,
  ): Promise<PitcherRecentFormResult> {
    const data = await this.request<JsonValue>(
      `/people/${personId}/stats?stats=gameLog&season=${season}&pitcherAppearances=starting&limit=${limit}`,
    );
    const parsed = PersonGameLogResponseSchema.parse(data);
    const starts = parsed.stats[0]?.splits.map((split) => ({
      date: split.date ?? '',
      opponent: split.opponent?.name ?? 'Unknown',
      opponentTeamId: split.opponent?.id ?? 0,
      inningsPitched: String(split.stat.inningsPitched),
      earnedRuns: split.stat.earnedRuns as number,
      strikeOuts: split.stat.strikeOuts as number,
      baseOnBalls: split.stat.baseOnBalls as number,
      pitches: split.stat.numberOfPitches as number | undefined,
      homeRunsAllowed: split.stat.homeRuns as number,
      hits: split.stat.hits as number,
      gamePk: split.game?.gamePk,
    })) ?? [];

    return {
      personId,
      season,
      starts,
      provenance: provenance('mlb-stats-api:peopleGameLog'),
    };
  }

  async fetchTeamBattingStats(
    teamId: number,
    season: number,
  ): Promise<TeamBattingStatsResult> {
    const data = await this.request<JsonValue>(
      `/teams/${teamId}/stats?stats=season&season=${season}&group=hitting`,
    );
    const parsed = TeamStatsResponseSchema.parse(data);
    const raw = parsed.stats[0]?.splits[0]?.stat;
    const stats = raw as unknown as TeamBattingStatsResult['stats'] | null;
    return {
      teamId,
      season,
      stats,
      provenance: provenance('mlb-stats-api:teamBattingStats'),
    };
  }

  async fetchTeamPitchingStats(
    teamId: number,
    season: number,
  ): Promise<TeamPitchingStatsResult> {
    const data = await this.request<JsonValue>(
      `/teams/${teamId}/stats?stats=season&season=${season}&group=pitching`,
    );
    const parsed = TeamStatsResponseSchema.parse(data);
    const raw = parsed.stats[0]?.splits[0]?.stat;
    const stats = raw as unknown as TeamPitchingStatsResult['stats'] | null;
    return {
      teamId,
      season,
      stats,
      provenance: provenance('mlb-stats-api:teamPitchingStats'),
    };
  }

  async fetchVenue(venueId: number): Promise<MLBVenue> {
    const data = await this.request<JsonValue>(`/venues/${venueId}`);
    const parsed = VenueResponseSchema.parse(data);
    const raw = parsed.venues[0];
    if (!raw) {
      throw new ResearchDataUnavailableError({
        message: `MLB venue not found: ${venueId}`,
        source: 'mlb-stats-api:venues',
      });
    }
    return {
      id: raw.id,
      name: raw.name,
      timezone: raw.timeZone?.id,
      roofType: inferRoofType(raw),
      warnings: [],
    };
  }
}

function inferRoofType(raw: {
  name: string;
  timeZone?: { id: string } | null;
}): MLBVenue['roofType'] {
  const knownDomes = new Set([
    'Tropicana Field',
    'Rogers Centre',
    'Minute Maid Park',
    'Chase Field',
    'T-Mobile Park',
    'Globe Life Field',
  ]);
  const knownRetractable = new Set([
    'Daikin Park',
    'American Family Field',
    'Nationals Park',
    'Target Field',
    'LoanDepot Park',
  ]);

  if (knownDomes.has(raw.name)) return 'DOME';
  if (knownRetractable.has(raw.name)) return 'RETRACTABLE';
  if (raw.timeZone && raw.timeZone.id === 'America/Phoenix') return 'UNKNOWN';
  return 'OPEN';
}

// --- Zod Schemas ---

export const ScheduleGameSchema = z.object({
  gamePk: z.number(),
  gameType: z.string(),
  gameNumber: z.number().int(),
  gameDate: z.string(),
  officialDate: z.string(),
  status: z.object({
    abstractGameState: z.string(),
    codedGameState: z.string(),
    detailedState: z.string(),
    startTimeTBD: z.boolean().optional(),
  }),
  teams: z.object({
    away: z.object({
      team: z.object({ id: z.number(), name: z.string() }),
      probablePitcher: z
        .object({
          id: z.number(),
          fullName: z.string(),
        })
        .optional(),
    }),
    home: z.object({
      team: z.object({ id: z.number(), name: z.string() }),
      probablePitcher: z
        .object({
          id: z.number(),
          fullName: z.string(),
        })
        .optional(),
    }),
  }),
  venue: z.object({ id: z.number(), name: z.string() }),
  dayNight: z.string(),
  scheduledInnings: z.number(),
  doubleHeader: z.string(),
  seriesGameNumber: z.number(),
  gamesInSeries: z.number(),
  seriesDescription: z.string(),
});

export const ScheduleResponseSchema = z.object({
  totalItems: z.number(),
  dates: z.array(
    z.object({
      date: z.string(),
      games: z.array(ScheduleGameSchema),
    }),
  ),
});

export type ScheduleResponse = z.infer<typeof ScheduleResponseSchema>;

export const FeedLiveResponseSchema = z.object({
  gamePk: z.number(),
  gameData: z.object({
    status: z.object({
      abstractGameState: z.string(),
      codedGameState: z.string(),
      detailedState: z.string(),
    }),
    datetime: z.object({
      dateTime: z.string(),
      dayNight: z.string(),
    }),
    teams: z.object({
      away: z.object({
        id: z.number(),
        name: z.string(),
        venue: z.object({ id: z.number(), name: z.string() }).optional(),
      }),
      home: z.object({
        id: z.number(),
        name: z.string(),
        venue: z.object({ id: z.number(), name: z.string() }).optional(),
      }),
    }),
    probablePitchers: z
      .object({
        away: z
          .object({
            id: z.number(),
            fullName: z.string(),
          })
          .optional(),
        home: z
          .object({
            id: z.number(),
            fullName: z.string(),
          })
          .optional(),
      })
      .optional(),
  }),
});

export type FeedLiveResponse = z.infer<typeof FeedLiveResponseSchema>;

const StatSplitSchema = z.object({
  season: z.string(),
  stat: z.record(z.unknown()),
  team: z
    .object({ id: z.number(), name: z.string() })
    .optional(),
  player: z
    .object({ id: z.number(), fullName: z.string() })
    .optional(),
  opponent: z
    .object({ id: z.number(), name: z.string() })
    .optional(),
  date: z.string().optional(),
  game: z
    .object({ gamePk: z.number().optional() })
    .optional(),
});

export const PersonStatsResponseSchema = z.object({
  stats: z.array(
    z.object({
      type: z.object({ displayName: z.string() }),
      group: z.object({ displayName: z.string() }),
      splits: z.array(StatSplitSchema),
    }),
  ),
});

export type PersonStatsResponse = z.infer<typeof PersonStatsResponseSchema>;

export const TeamStatsResponseSchema = z.object({
  stats: z.array(
    z.object({
      type: z.object({ displayName: z.string() }),
      group: z.object({ displayName: z.string() }),
      splits: z.array(StatSplitSchema),
    }),
  ),
});

export type TeamStatsResponse = z.infer<typeof TeamStatsResponseSchema>;

export const PersonGameLogResponseSchema = z.object({
  stats: z.array(
    z.object({
      type: z.object({ displayName: z.string() }),
      group: z.object({ displayName: z.string() }),
      splits: z.array(StatSplitSchema),
    }),
  ),
});

export type PersonGameLogResponse = z.infer<typeof PersonGameLogResponseSchema>;

export const VenueResponseSchema = z.object({
  venues: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      timeZone: z.object({ id: z.string() }).optional(),
    }),
  ),
});

export type VenueResponse = z.infer<typeof VenueResponseSchema>;
