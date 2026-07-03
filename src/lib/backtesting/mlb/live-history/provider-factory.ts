import type { LiveHistoricalProviderDependencies } from './provider';
import type { MLBHistoricalHttpClient, MLBHistoricalHttpClientOptions } from './client';
import type { MLBHistoricalCache } from './types';
import { createMLBHistoricalHttpClient } from './client';
import { createMLBHistoricalCache } from './cache';
import { createScheduleLoader } from './schedule-loader';
import { createOutcomeLoader } from './outcome-loader';
import { createMLBHistoricalTeamGameSource } from './team-game-source';
import { createPitcherFeedLoader } from './pitcher-feed-loader';
import { createMLBHistoricalPitcherAppearanceSource } from './pitcher-appearance-source';
import { LiveMLBHistoricalProvider } from './provider';
import { aggregateTeamHistory } from './team-aggregator';
import { aggregatePitcherHistory } from './pitcher-aggregator';
import { createMLBPregamePitcherObservationStore } from './pregame-pitcher-observation-store';
import { createPregamePitcherObservationWriter } from './pregame-pitcher-observation-writer';
import type { PregamePitcherObservationWriter } from './pregame-pitcher-observation-store';
import { capturePregamePitcherObservations } from './pregame-pitcher-observation-capture';

export interface LiveMLBHistoricalProviderFactoryResult {
  readonly provider: LiveMLBHistoricalProvider;
  readonly deps: LiveHistoricalProviderDependencies;
  readonly client: MLBHistoricalHttpClient;
  readonly cache: MLBHistoricalCache;
  readonly scheduleLoader: ReturnType<typeof createScheduleLoader>;
  readonly outcomeLoader: ReturnType<typeof createOutcomeLoader>;
  readonly teamGameSource: ReturnType<typeof createMLBHistoricalTeamGameSource>;
  readonly pitcherFeedLoader: ReturnType<typeof createPitcherFeedLoader>;
  readonly pitcherAppearanceSource: ReturnType<typeof createMLBHistoricalPitcherAppearanceSource>;
  readonly pregamePitcherCapture?: {
    readonly context: 'PROSPECTIVE_LIVE';
    readonly writer: PregamePitcherObservationWriter;
  };
}

export interface LiveMLBHistoricalProviderFactoryOptions {
  readonly cacheRoot: string;
  readonly cacheVersion: string;
  readonly fetchImpl?: typeof fetch;
  readonly forceRefresh?: boolean;
  readonly now?: () => Date;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly capturePregamePitchers?: boolean;
  readonly observationWriterFactory?: (
    store: ReturnType<typeof createMLBPregamePitcherObservationStore>,
    now?: () => Date,
  ) => PregamePitcherObservationWriter;
}

export function createLiveMLBHistoricalProvider(
  options: LiveMLBHistoricalProviderFactoryOptions,
): LiveMLBHistoricalProviderFactoryResult {
  const clientOptions: MLBHistoricalHttpClientOptions = {
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs,
    retryAttempts: options.maxRetries,
  };

  const client = createMLBHistoricalHttpClient(clientOptions);
  const cache = createMLBHistoricalCache({
    root: options.cacheRoot,
    version: options.cacheVersion,
  });

  const scheduleLoader = createScheduleLoader({
    client,
    cache,
    forceRefresh: options.forceRefresh,
    now: options.now,
  });

  const outcomeLoader = createOutcomeLoader({
    client,
    cache,
    forceRefresh: options.forceRefresh,
    now: options.now,
  });

  const teamGameSource = createMLBHistoricalTeamGameSource({
    scheduleLoader,
    outcomeLoader,
  });

  const pitcherFeedLoader = createPitcherFeedLoader({
    client,
    cache,
    forceRefresh: options.forceRefresh,
    now: options.now,
  });

  const pitcherAppearanceSource = createMLBHistoricalPitcherAppearanceSource({
    scheduleLoader,
    gameFeedLoader: pitcherFeedLoader,
  });

  const shouldCapture = options.capturePregamePitchers === true;
  let pregamePitcherCapture: LiveMLBHistoricalProviderFactoryResult['pregamePitcherCapture'];
  if (shouldCapture) {
    const store = createMLBPregamePitcherObservationStore(options.cacheRoot, options.now);
    const writer = options.observationWriterFactory
      ? options.observationWriterFactory(store, options.now)
      : createPregamePitcherObservationWriter({ store, now: options.now });
    pregamePitcherCapture = { context: 'PROSPECTIVE_LIVE', writer };
  }

  const provider = new LiveMLBHistoricalProvider({
    scheduleLoader,
    outcomeLoader,
    teamGameSource,
    pitcherAppearanceSource,
    teamAggregator: aggregateTeamHistory,
    pitcherAggregator: aggregatePitcherHistory,
    now: options.now,
    ...(pregamePitcherCapture ? { pregamePitcherCapture } : {}),
  });

  const deps: LiveHistoricalProviderDependencies = {
    scheduleLoader,
    outcomeLoader,
    teamGameSource,
    pitcherAppearanceSource,
    teamAggregator: aggregateTeamHistory,
    pitcherAggregator: aggregatePitcherHistory,
    now: options.now,
    ...(pregamePitcherCapture ? { pregamePitcherCapture } : {}),
  };

  return {
    provider,
    deps,
    client,
    cache,
    scheduleLoader,
    outcomeLoader,
    teamGameSource,
    pitcherFeedLoader,
    pitcherAppearanceSource,
    ...(pregamePitcherCapture ? { pregamePitcherCapture } : {}),
  };
}
