import { z } from 'zod';
import type { MLBHistoricalCacheConfig, CanonicalHistoricalScheduleGame, CanonicalHistoricalOutcome, CanonicalHistoricalGameStatus, HistoricalStarterSource, CacheProvenance, MLBHistoricalCache, HistoricalCompletionTimeSource } from './types';
import type { MLBHistoricalHttpClient } from './client';
import { MLBOutcomeFeedSchema } from './schemas';
import { extractLastCompletedPlayEnd, type CompletionProxyExtraction } from './completion-extractor';

export interface OutcomeLoaderOptions {
  readonly client: MLBHistoricalHttpClient;
  readonly cache: MLBHistoricalCache;
  readonly forceRefresh?: boolean;
  readonly now?: () => Date;
}

export function createOutcomeLoader(options: OutcomeLoaderOptions) {
  const { client, cache, forceRefresh } = options;
  const getNow = options.now ?? (() => new Date());

  return {
    async loadOutcome(gamePk: number, options?: { forceRefresh?: boolean }): Promise<CanonicalHistoricalOutcome> {
      const endpoint = `/api/v1.1/game/${gamePk}/feed/live`;
      const params = { gamePk };
      const useForceRefresh = options?.forceRefresh ?? forceRefresh;
      if (!useForceRefresh) {
        const cached = await cache.get(endpoint, params, MLBOutcomeFeedSchema);
        if (cached) {
          return normalizeOutcome(cached, gamePk);
        }
      }

      const raw = await client.getJson(endpoint, params, MLBOutcomeFeedSchema);
      const now = getNow();
      await cache.set(endpoint, params, raw, {
        endpoint,
        fetchedAt: now,
        sourceTimestamp: null,
      });

      return normalizeOutcome(raw, gamePk);
    },
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
