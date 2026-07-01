import type {
  CanonicalHistoricalPitcherFeed,
  CanonicalPitcherFeedPlayer,
  CanonicalHistoricalGameStatus,
  MLBHistoricalCache,
  MLBHistoricalHttpClient,
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
  const { client, cache, forceRefresh } = options;
  const getNow = options.now ?? (() => new Date());
  const endpoint = '/api/v1.1/game/{gamePk}/feed/live';

  return {
    async loadGameFeed(gamePk: number): Promise<CanonicalHistoricalPitcherFeed> {
      const params = { gamePk };
      const useForceRefresh = forceRefresh;

      let raw: z.infer<typeof MLBPitcherFeedSchema>;
      if (!useForceRefresh) {
        const cached = await cache.get(endpoint, params, MLBPitcherFeedSchema);
        if (cached) {
          raw = cached;
        } else {
          raw = await client.getJson(endpoint, params, MLBPitcherFeedSchema);
          const now = getNow();
          await cache.set(endpoint, params, raw, {
            endpoint,
            fetchedAt: now,
            sourceTimestamp: null,
          });
        }
      } else {
        raw = await client.getJson(endpoint, params, MLBPitcherFeedSchema);
        const now = getNow();
        await cache.set(endpoint, params, raw, {
          endpoint,
          fetchedAt: now,
          sourceTimestamp: null,
        });
      }

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
    },
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
): CanonicalHistoricalPitcherFeed['homePlayers'] {
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
