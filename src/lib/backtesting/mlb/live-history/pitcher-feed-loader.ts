import type {
  CanonicalHistoricalPitcherFeed,
  CanonicalPitcherFeedPlayer,
  CanonicalHistoricalGameStatus,
  MLBHistoricalCache,
  MLBHistoricalCacheWithProvenance,
  MLBHistoricalHttpClient,
  MLBHistoricalAcquisitionProvenance,
} from './types';
import { z } from 'zod';
import { MLBPitcherFeedSchema, MLBPlayerBoxscoreEntrySchema } from './schemas';
import { extractLastCompletedPlayEnd } from './completion-extractor';

export interface PitcherFeedLoaderOptions {
  readonly client: MLBHistoricalHttpClient;
  readonly cache: MLBHistoricalCache;
  readonly forceRefresh?: boolean;
  readonly now?: () => Date;
}

export function createPitcherFeedLoader(options: PitcherFeedLoaderOptions) {
  const { client, cache } = options;
  const getNow = options.now ?? (() => new Date());
  const defaultForceRefresh = options.forceRefresh ?? false;
  const endpoint = '/api/v1.1/game/{gamePk}/feed/live';
  const provenanceCapable = isMLBHistoricalCacheWithProvenance(cache);

  return {
    async loadGameFeed(
      gamePk: number,
      options?: { forceRefresh?: boolean },
    ): Promise<CanonicalHistoricalPitcherFeed> {
      if (!provenanceCapable) {
        return loadGameFeedLegacy(gamePk, {
          client,
          cache,
          forceRefresh: Boolean(options?.forceRefresh ?? defaultForceRefresh),
          getNow,
          endpoint,
        });
      }
      const { feed } = await loadGameFeedWithProvenanceInner(gamePk, {
        client,
        cache: cache as MLBHistoricalCacheWithProvenance,
        forceRefresh: Boolean(options?.forceRefresh ?? defaultForceRefresh),
        getNow,
        endpoint,
      });
      return feed;
    },

    async loadGameFeedWithProvenance(
      gamePk: number,
      options?: { forceRefresh?: boolean },
    ): Promise<{ readonly feed: CanonicalHistoricalPitcherFeed; readonly provenance: MLBHistoricalAcquisitionProvenance }> {
      if (!provenanceCapable) {
        throw new Error(
          'Pitcher feed provenance loader requires MLBHistoricalCacheWithProvenance capability',
        );
      }
      return loadGameFeedWithProvenanceInner(gamePk, {
        client,
        cache: cache as MLBHistoricalCacheWithProvenance,
        forceRefresh: Boolean(options?.forceRefresh ?? defaultForceRefresh),
        getNow,
        endpoint,
      });
    },
  };
}

function isMLBHistoricalCacheWithProvenance(
  cache: MLBHistoricalCache,
): cache is MLBHistoricalCacheWithProvenance {
  return typeof (cache as MLBHistoricalCacheWithProvenance).getWithProvenance === 'function';
}

async function loadGameFeedLegacy(
  gamePk: number,
  options: {
    readonly client: MLBHistoricalHttpClient;
    readonly cache: MLBHistoricalCache;
    readonly forceRefresh: boolean;
    readonly getNow: () => Date;
    readonly endpoint: string;
  },
): Promise<CanonicalHistoricalPitcherFeed> {
  const params = { gamePk };
  const forceRefresh = options.forceRefresh;

  let raw: z.infer<typeof MLBPitcherFeedSchema>;
  if (!forceRefresh) {
    const cached = await options.cache.get(options.endpoint, params, MLBPitcherFeedSchema);
    if (cached) {
      raw = cached;
    } else {
      raw = await options.client.getJson(options.endpoint, params, MLBPitcherFeedSchema);
      await options.cache.set(options.endpoint, params, raw, {
        endpoint: options.endpoint,
        fetchedAt: options.getNow(),
        sourceTimestamp: null,
      });
    }
  } else {
    raw = await options.client.getJson(options.endpoint, params, MLBPitcherFeedSchema);
    await options.cache.set(options.endpoint, params, raw, {
      endpoint: options.endpoint,
      fetchedAt: options.getNow(),
      sourceTimestamp: null,
    });
  }

  return normalizeFeed(raw);
}

async function loadGameFeedWithProvenanceInner(
  gamePk: number,
  options: {
    readonly client: MLBHistoricalHttpClient;
    readonly cache: MLBHistoricalCacheWithProvenance;
    readonly forceRefresh: boolean;
    readonly getNow: () => Date;
    readonly endpoint: string;
  },
): Promise<{ readonly feed: CanonicalHistoricalPitcherFeed; readonly provenance: MLBHistoricalAcquisitionProvenance }> {
  const params = { gamePk };
  const forceRefresh = options.forceRefresh;

  let raw: z.infer<typeof MLBPitcherFeedSchema>;
  let provenance: MLBHistoricalAcquisitionProvenance;

  if (!forceRefresh) {
    const cached = await options.cache.getWithProvenance(options.endpoint, params, MLBPitcherFeedSchema);
    if (cached) {
      raw = cached.value;
      provenance = cached.provenance;
    } else {
      raw = await options.client.getJson(options.endpoint, params, MLBPitcherFeedSchema);
      const now = options.getNow();
      provenance = { endpoint: options.endpoint, fetchedAt: now, sourceTimestamp: null };
      await options.cache.set(options.endpoint, params, raw, provenance);
    }
  } else {
    raw = await options.client.getJson(options.endpoint, params, MLBPitcherFeedSchema);
    const now = options.getNow();
    provenance = { endpoint: options.endpoint, fetchedAt: now, sourceTimestamp: null };
    await options.cache.set(options.endpoint, params, raw, provenance);
  }

  const feed = normalizeFeed(raw);
  return { feed, provenance };
}

function normalizeFeed(raw: z.infer<typeof MLBPitcherFeedSchema>): CanonicalHistoricalPitcherFeed {
  const status = mapFeedStatus(raw);
  const allPlays = raw.liveData?.plays?.allPlays;
  const proxy = extractLastCompletedPlayEnd(allPlays ?? []);
  let completedAt: Date | null = null;
  let completedAtSource: CanonicalHistoricalPitcherFeed['completedAtSource'] = null;
  const completionWarnings: string[] = [];
  if (proxy.ok) {
    completedAt = proxy.completedAt;
    completedAtSource = proxy.source;
  } else {
    completionWarnings.push(proxy.reason);
  }

  const homePlayers = parsePlayers(raw.liveData?.boxscore?.teams?.home?.players ?? {});
  const awayPlayers = parsePlayers(raw.liveData?.boxscore?.teams?.away?.players ?? {});

  return {
    gamePk: raw.gamePk,
    status,
    completedAt,
    completedAtSource,
    completionWarnings,
    homePlayers,
    awayPlayers,
    allPlays: allPlays ?? [],
  };
}

function mapFeedStatus(raw: z.infer<typeof MLBPitcherFeedSchema>): CanonicalHistoricalGameStatus {
  const coded = raw.gameData.status.codedGameState;
  if (coded === 'F') return 'FINAL';
  if (coded === 'C') return 'CANCELLED';
  if (coded === 'P') return 'POSTPONED';
  if (coded === 'S') return 'SUSPENDED';
  return 'UNKNOWN';
}

function parsePlayers(
  players: Record<string, z.infer<typeof MLBPlayerBoxscoreEntrySchema>>,
): CanonicalPitcherFeedPlayer[] {
  const mutable: CanonicalPitcherFeedPlayer[] = [];
  for (const entry of Object.values(players)) {
    const pitching = entry.stats?.pitching;
    if (!pitching) continue;

    const outs = pitching.outs;
    if (typeof outs !== 'number' || !Number.isFinite(outs) || !Number.isInteger(outs) || outs < 0) continue;

    mutable.push({
      personId: entry.person.id,
      gamesStarted: pitching.gamesStarted ?? null,
      pitchingStats: {
        earnedRuns: pitching.earnedRuns ?? null,
        hits: pitching.hits ?? null,
        homeRuns: pitching.homeRuns ?? null,
        strikeouts: pitching.strikeOuts ?? null,
        walks: pitching.baseOnBalls ?? null,
        outs,
        pitchesThrown: pitching.pitchesThrown ?? null,
      },
    });
  }

  return mutable;
}
