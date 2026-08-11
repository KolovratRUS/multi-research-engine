import { z } from 'zod';
import type { MLBHistoricalCacheConfig, CanonicalHistoricalScheduleGame, CanonicalHistoricalGameStatus, HistoricalStarterSource, CacheProvenance, MLBHistoricalCache, MLBHistoricalCacheWithProvenance } from './types';
import type { MLBHistoricalHttpClient } from './client';
import { MLBScheduleResponseSchema } from './schemas';
import { buildHistoricalCacheKey } from './cache';

export interface ScheduleLoaderOptions {
  readonly client: MLBHistoricalHttpClient;
  readonly cache: MLBHistoricalCache;
  readonly forceRefresh?: boolean;
  readonly now?: () => Date;
}

export function createScheduleLoader(options: ScheduleLoaderOptions) {
  const { client, cache, forceRefresh } = options;
  const getNow = options.now ?? (() => new Date());
  const endpoint = '/api/v1/schedule';
  const provenanceCapable = isMLBHistoricalCacheWithProvenance(cache);
  const inFlight = new Map<string, Promise<{ readonly response: z.infer<typeof MLBScheduleResponseSchema>; readonly provenance: CacheProvenance }>>();

  function makeKey(params: Record<string, unknown>): string {
    return buildHistoricalCacheKey(endpoint, params);
  }

  return {
    async loadForDateRange(from: string, to: string, options?: { forceRefresh?: boolean }): Promise<CanonicalHistoricalScheduleGame[]> {
      const params = { sportId: 1, startDate: from, endDate: to, hydrate: 'probablePitcher,venue' };
      const useForceRefresh = options?.forceRefresh ?? forceRefresh;
      const key = makeKey(params);

      if (!useForceRefresh && provenanceCapable) {
        const cached = await cache.getWithProvenance(endpoint, params, MLBScheduleResponseSchema);
        if (cached) {
          return parseScheduleResponse(cached.value, cached.provenance);
        }
      }

      let pending = inFlight.get(key);
      if (!pending) {
        pending = (async () => {
          const response = await client.getJson(endpoint, params, MLBScheduleResponseSchema);
          const now = getNow();
          const acquisitionProvenance = {
            endpoint,
            fetchedAt: now,
            sourceTimestamp: null,
          };
          await cache.set(endpoint, params, response, acquisitionProvenance);
          return { response, provenance: acquisitionProvenance };
        })();
        inFlight.set(key, pending);
      }

      try {
        const { response, provenance } = await pending;
        return parseScheduleResponse(response, provenance);
      } finally {
        if (inFlight.get(key) === pending) {
          inFlight.delete(key);
        }
      }
    },
  };
}

function isMLBHistoricalCacheWithProvenance(
  cache: MLBHistoricalCache,
): cache is MLBHistoricalCacheWithProvenance {
  return typeof (cache as MLBHistoricalCacheWithProvenance).getWithProvenance === 'function';
}

function parseScheduleResponse(
  response: z.infer<typeof MLBScheduleResponseSchema>,
  provenance: CacheProvenance,
): CanonicalHistoricalScheduleGame[] {
  const records: CanonicalHistoricalScheduleGame[] = [];
  for (const dateBlock of response.dates) {
    for (const game of dateBlock.games) {
      const scheduledStart = new Date(game.gameDate);
      const warnings: string[] = [];
      if (Number.isNaN(scheduledStart.getTime())) {
        warnings.push('invalid_scheduled_start');
        continue;
      }

      const cutoffTime = new Date(scheduledStart.getTime() - 30 * 60 * 1000);
      const status = mapStatus(game.status.abstractGameState, game.status.detailedState);
      const homeProbablePitcherId = game.teams.home.probablePitcher?.id ?? null;
      const awayProbablePitcherId = game.teams.away.probablePitcher?.id ?? null;

      if (!homeProbablePitcherId) warnings.push('missing_home_probable_pitcher');
      if (!awayProbablePitcherId) warnings.push('missing_away_probable_pitcher');
      if (!game.venue?.id) warnings.push('missing_venue');
      if (game.gameNumber == null) warnings.push('missing_game_number');

      records.push({
        gamePk: game.gamePk,
        officialDate: game.officialDate,
        scheduledStart,
        cutoffTime,
        status,
        homeTeamId: game.teams.home.team.id,
        homeTeamName: game.teams.home.team.name,
        awayTeamId: game.teams.away.team.id,
        awayTeamName: game.teams.away.team.name,
        venueId: game.venue?.id ?? null,
        venueName: game.venue?.name ?? null,
        doubleheader: game.doubleHeader === 'Y' || game.doubleHeader === 'S',
        gameNumber: game.gameNumber ?? 1,
        scheduledInnings: game.scheduledInnings ?? null,
        homeProbablePitcherId,
        awayProbablePitcherId,
        homeStarterSource: homeProbablePitcherId ? 'SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN' : 'UNAVAILABLE',
        awayStarterSource: awayProbablePitcherId ? 'SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN' : 'UNAVAILABLE',
        rawGameType: game.gameType ?? null,
        rescheduledFromGamePk: game.rescheduledFromGamePk ?? null,
        warnings,
        provenance,
      });
    }
  }
  return records;
}

function mapStatus(abstractGameState: string, detailedState: string): CanonicalHistoricalGameStatus {
  if (detailedState === 'Final' || detailedState === 'Game Over') return 'FINAL';
  if (detailedState === 'Postponed') return 'POSTPONED';
  if (detailedState === 'Cancelled') return 'CANCELLED';
  if (detailedState === 'Suspended') return 'SUSPENDED';
  if (abstractGameState === 'Live') return 'LIVE';
  if (abstractGameState === 'Preview') return 'UPCOMING';
  return 'UNKNOWN';
}
