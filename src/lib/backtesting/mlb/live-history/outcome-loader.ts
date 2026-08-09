import { z } from 'zod';
import type {
  CanonicalHistoricalOutcome,
  CacheProvenance,
  MLBHistoricalCache,
  MLBHistoricalCacheWithProvenance,
  HistoricalCompletionTimeSource,
  MLBHistoricalAcquisitionProvenance,
  MLBHistoricalOutcomeWithProvenance,
} from './types';
import type { MLBHistoricalHttpClient } from './client';
import { MLBOutcomeFeedSchema } from './schemas';
import { extractLastCompletedPlayEnd } from './completion-extractor';

export interface OutcomeLoaderOptions {
  readonly client: MLBHistoricalHttpClient;
  readonly cache: MLBHistoricalCache;
  readonly forceRefresh?: boolean;
  readonly now?: () => Date;
}

export function createOutcomeLoader(options: OutcomeLoaderOptions) {
  const { client, cache } = options;
  const getNow = options.now ?? (() => new Date());
  const defaultForceRefresh = options.forceRefresh ?? false;

  const provenanceCapable = isMLBHistoricalCacheWithProvenance(cache);

  return {
    async loadOutcome(
      gamePk: number,
      options?: { forceRefresh?: boolean },
    ): Promise<CanonicalHistoricalOutcome> {
      if (!provenanceCapable) {
        return loadOutcomeLegacy(gamePk, {
          client,
          cache,
          forceRefresh: Boolean(options?.forceRefresh ?? defaultForceRefresh),
          getNow,
        });
      }
      const { outcome } = await loadOutcomeWithProvenanceInner(gamePk, {
        client,
        cache: cache as MLBHistoricalCacheWithProvenance,
        forceRefresh: Boolean(options?.forceRefresh ?? defaultForceRefresh),
        getNow,
      });
      return outcome;
    },

    async loadOutcomeWithProvenance(
      gamePk: number,
      options?: { forceRefresh?: boolean },
    ): Promise<MLBHistoricalOutcomeWithProvenance> {
      if (!provenanceCapable) {
        throw new Error(
          'Outcome provenance loader requires MLBHistoricalCacheWithProvenance capability',
        );
      }
      return loadOutcomeWithProvenanceInner(gamePk, {
        client,
        cache: cache as MLBHistoricalCacheWithProvenance,
        forceRefresh: Boolean(options?.forceRefresh ?? defaultForceRefresh),
        getNow,
      });
    },
  };
}

function isMLBHistoricalCacheWithProvenance(
  cache: MLBHistoricalCache,
): cache is MLBHistoricalCacheWithProvenance {
  return typeof (cache as MLBHistoricalCacheWithProvenance).getWithProvenance === 'function';
}

async function loadOutcomeLegacy(
  gamePk: number,
  options: {
    readonly client: MLBHistoricalHttpClient;
    readonly cache: MLBHistoricalCache;
    readonly forceRefresh: boolean;
    readonly getNow: () => Date;
  },
): Promise<CanonicalHistoricalOutcome> {
  const endpoint = `/api/v1.1/game/${gamePk}/feed/live`;
  const params = { gamePk };
  const forceRefresh = options.forceRefresh;

  let raw: z.infer<typeof MLBOutcomeFeedSchema>;
  if (!forceRefresh) {
    const cached = await options.cache.get(endpoint, params, MLBOutcomeFeedSchema);
    if (cached) {
      raw = cached;
    } else {
      raw = await options.client.getJson(endpoint, params, MLBOutcomeFeedSchema);
      await options.cache.set(endpoint, params, raw, {
        endpoint,
        fetchedAt: options.getNow(),
        sourceTimestamp: null,
      });
    }
  } else {
    raw = await options.client.getJson(endpoint, params, MLBOutcomeFeedSchema);
    await options.cache.set(endpoint, params, raw, {
      endpoint,
      fetchedAt: options.getNow(),
      sourceTimestamp: null,
    });
  }

  return normalizeOutcome(raw, gamePk);
}

async function loadOutcomeWithProvenanceInner(
  gamePk: number,
  options: {
    readonly client: MLBHistoricalHttpClient;
    readonly cache: MLBHistoricalCacheWithProvenance;
    readonly forceRefresh: boolean;
    readonly getNow: () => Date;
  },
): Promise<MLBHistoricalOutcomeWithProvenance> {
  const endpoint = `/api/v1.1/game/${gamePk}/feed/live`;
  const params = { gamePk };
  const forceRefresh = options.forceRefresh;

  let raw: z.infer<typeof MLBOutcomeFeedSchema>;
  let provenance: MLBHistoricalAcquisitionProvenance;

  if (!forceRefresh) {
    const cached = await options.cache.getWithProvenance(endpoint, params, MLBOutcomeFeedSchema);
    if (cached) {
      raw = cached.value;
      provenance = cached.provenance;
    } else {
      raw = await options.client.getJson(endpoint, params, MLBOutcomeFeedSchema);
      const now = options.getNow();
      provenance = { endpoint, fetchedAt: now, sourceTimestamp: null };
      await options.cache.set(endpoint, params, raw, provenance);
    }
  } else {
    raw = await options.client.getJson(endpoint, params, MLBOutcomeFeedSchema);
    const now = options.getNow();
    provenance = { endpoint, fetchedAt: now, sourceTimestamp: null };
    await options.cache.set(endpoint, params, raw, provenance);
  }

  return {
    outcome: normalizeOutcome(raw, gamePk),
    provenance,
  };
}

function normalizeOutcome(raw: z.infer<typeof MLBOutcomeFeedSchema>, gamePk: number): CanonicalHistoricalOutcome {
  const status: CanonicalHistoricalOutcome['status'] = mapOutcomeStatus(raw);
  const warnings: string[] = [];
  let winner: 'HOME' | 'AWAY' | null = null;

  const liveData = raw.liveData;
  const linescore = liveData?.linescore;
  const teams = linescore?.teams;
  const homeScore = teams?.home?.runs ?? null;
  const awayScore = teams?.away?.runs ?? null;
  const innings = raw.liveData?.linescore?.currentInning ?? raw.liveData?.innings?.length ?? null;

  let completedAt: Date | null = null;
  let completedAtSource: HistoricalCompletionTimeSource | null = null;

  if (status === 'FINAL') {
    if (homeScore === null || awayScore === null) {
      warnings.push('missing_final_scores');
      return { gamePk, status: 'UNKNOWN', homeScore: null, awayScore: null, winner: null, innings: null, completedAt: null, completedAtSource: null, warnings };
    }
    if (homeScore === awayScore) {
      warnings.push('malformed_final_tie');
      return { gamePk, status: 'UNKNOWN', homeScore, awayScore, winner: null, innings, completedAt: null, completedAtSource: null, warnings };
    }
    winner = homeScore > awayScore ? 'HOME' : 'AWAY';

    const proxy = extractLastCompletedPlayEnd(raw.liveData?.plays?.allPlays);
    if (proxy.ok) {
      completedAt = proxy.completedAt;
      completedAtSource = proxy.source;
    } else {
      warnings.push(proxy.reason);
    }
  }

  return { gamePk, status, homeScore, awayScore, winner, innings, completedAt, completedAtSource, warnings };
}

function mapOutcomeStatus(raw: z.infer<typeof MLBOutcomeFeedSchema>): CanonicalHistoricalOutcome['status'] {
  const coded = raw.gameData.status.codedGameState;
  if (coded === 'F') return 'FINAL';
  if (coded === 'C') return 'CANCELLED';
  if (coded === 'P') return 'POSTPONED';
  if (coded === 'S') return 'SUSPENDED';
  return 'UNKNOWN';
}
