import type {
  CanonicalHistoricalScheduleGame,
  CanonicalHistoricalOutcome,
  CompletedHistoricalTeamGame,
  HistoricalPitcherAppearance,
  HistoricalStarterSource,
  PitcherHistoricalAggregate,
  TeamHistoricalAggregate,
  MLBHistoricalAcquisitionProvenance,
  MLBHistoricalOutcomeWithProvenance,
  MLBHistoricalTeamGamesWithProvenance,
  MLBHistoricalPitcherAppearancesWithProvenance,
} from '@/lib/backtesting/mlb/live-history/types';
import type { MLBHistoricalHttpClient } from '@/lib/backtesting/mlb/live-history/client';
import type { MLBHistoricalCache } from '@/lib/backtesting/mlb/live-history/types';
import type { PregamePitcherObservation } from '@/lib/backtesting/mlb/live-history/pregame-pitcher-observation-store';
import { createScheduleLoader } from '@/lib/backtesting/mlb/live-history/schedule-loader';
import { createOutcomeLoader } from '@/lib/backtesting/mlb/live-history/outcome-loader';
import { createMLBHistoricalTeamGameSource } from '@/lib/backtesting/mlb/live-history/team-game-source';
import { aggregateTeamHistory } from '@/lib/backtesting/mlb/live-history/team-aggregator';
import { createMLBHistoricalPitcherAppearanceSource } from '@/lib/backtesting/mlb/live-history/pitcher-appearance-source';
import { aggregatePitcherHistory } from '@/lib/backtesting/mlb/live-history/pitcher-aggregator';
import { createPitcherFeedLoader } from '@/lib/backtesting/mlb/live-history/pitcher-feed-loader';

export interface MLBHistoricalMaterializationSourceAdapter {
  readonly loadScheduleGamesForDateRange: (
    params: Readonly<{
      readonly start: string;
      readonly end: string;
    }>,
  ) => Promise<readonly CanonicalHistoricalScheduleGame[]>;
  readonly loadTeamStatsAsOf: (
    params: Readonly<{
      readonly teamId: number;
      readonly cutoff: Date;
      readonly season?: number;
    }>,
  ) => Promise<{ readonly aggregate: TeamHistoricalAggregate; readonly provenance: readonly MLBHistoricalAcquisitionProvenance[] }>;
  readonly loadPitcherStatsAsOf: (
    params: Readonly<{
      readonly personId: number;
      readonly cutoff: Date;
      readonly season?: number;
    }>,
  ) => Promise<{ readonly aggregate: PitcherHistoricalAggregate; readonly provenance: readonly MLBHistoricalAcquisitionProvenance[] }>;
  readonly resolveProspectiveStarter: (
    params: Readonly<{
      readonly gamePk: number;
      readonly side: 'home' | 'away';
      readonly cutoff: Date;
    }>,
  ) => Promise<MLBHistoricalProspectiveStarterResult>;
  readonly loadOfficialFinalOutcome: (
    params: Readonly<{
      readonly gamePk: number;
    }>,
  ) => Promise<MLBHistoricalOutcomeWithProvenance>;
}

export interface MLBHistoricalProspectiveStarterResult {
  readonly pitcherId: number | null;
  readonly source: HistoricalStarterSource;
  readonly observedAt: Date | null;
  readonly observation: PregamePitcherObservation | null;
}

export interface MLBHistoricalMaterializationSourceAdapterDependencies {
  readonly scheduleLoader: {
    readonly loadForDateRange: (
      start: string,
      end: string,
    ) => Promise<CanonicalHistoricalScheduleGame[]>;
  };
  readonly outcomeLoader: {
    readonly loadOutcome: (gamePk: number) => Promise<CanonicalHistoricalOutcome>;
    readonly loadOutcomeWithProvenance?: (gamePk: number) => Promise<MLBHistoricalOutcomeWithProvenance>;
  };
  readonly teamGameSource: {
    readonly getTeamGames: (
      teamId: number,
      season: number,
      cutoff: Date,
    ) => Promise<readonly CompletedHistoricalTeamGame[]>;
    readonly getTeamGamesWithProvenance?: (
      teamId: number,
      season: number,
      cutoff: Date,
    ) => Promise<MLBHistoricalTeamGamesWithProvenance>;
  };
  readonly teamAggregator: (
    games: readonly CompletedHistoricalTeamGame[],
    teamId: number,
    cutoff: Date,
  ) => TeamHistoricalAggregate;
  readonly pitcherAppearanceSource: {
    readonly getPitcherAppearances: (
      personId: number,
      season: number,
      cutoff: Date,
    ) => Promise<readonly HistoricalPitcherAppearance[]>;
    readonly getPitcherAppearancesWithProvenance?: (
      personId: number,
      season: number,
      cutoff: Date,
    ) => Promise<MLBHistoricalPitcherAppearancesWithProvenance>;
  };
  readonly pitcherAggregator: (
    appearances: readonly HistoricalPitcherAppearance[],
    personId: number,
    cutoff: Date,
  ) => PitcherHistoricalAggregate;
  readonly observationStore?: {
    readonly findLatestEligible: (
      gamePk: number,
      predictionCutoff: Date,
    ) => Promise<PregamePitcherObservation | null>;
  };
}

export interface MLBHistoricalMaterializationSourceAdapterFactoryOptions {
  readonly client: MLBHistoricalHttpClient;
  readonly cache: MLBHistoricalCache;
  readonly now?: () => Date;
  readonly observationStore?: MLBHistoricalMaterializationSourceAdapterDependencies['observationStore'];
}

export function createMLBHistoricalMaterializationSourceAdapter(
  dependencies: MLBHistoricalMaterializationSourceAdapterDependencies,
): MLBHistoricalMaterializationSourceAdapter {
  const deps = dependencies;

  return {
    async loadScheduleGamesForDateRange({ start, end }) {
      return deps.scheduleLoader.loadForDateRange(start, end);
    },

    async loadTeamStatsAsOf({ teamId, cutoff, season }) {
      validateCutoff(cutoff, 'team');
      const actualSeason = season ?? cutoff.getUTCFullYear();
      if (deps.teamGameSource.getTeamGamesWithProvenance) {
        const result = await deps.teamGameSource.getTeamGamesWithProvenance(teamId, actualSeason, cutoff);
        return {
          aggregate: deps.teamAggregator(result.games, teamId, cutoff),
          provenance: result.provenance,
        };
      }
      const games = await deps.teamGameSource.getTeamGames(teamId, actualSeason, cutoff);
      return {
        aggregate: deps.teamAggregator(games, teamId, cutoff),
        provenance: [],
      };
    },

    async loadPitcherStatsAsOf({ personId, cutoff, season }) {
      validateCutoff(cutoff, 'pitcher');
      const actualSeason = season ?? cutoff.getUTCFullYear();
      if (deps.pitcherAppearanceSource.getPitcherAppearancesWithProvenance) {
        const result = await deps.pitcherAppearanceSource.getPitcherAppearancesWithProvenance(
          personId,
          actualSeason,
          cutoff,
        );
        return {
          aggregate: deps.pitcherAggregator(result.appearances, personId, cutoff),
          provenance: result.provenance,
        };
      }
      const appearances = await deps.pitcherAppearanceSource.getPitcherAppearances(
        personId,
        actualSeason,
        cutoff,
      );
      return {
        aggregate: deps.pitcherAggregator(appearances, personId, cutoff),
        provenance: [],
      };
    },

    async resolveProspectiveStarter({ gamePk, side, cutoff }) {
      validateCutoff(cutoff, 'starter');
      if (!deps.observationStore) {
        return {
          pitcherId: null,
          source: 'UNAVAILABLE',
          observedAt: null,
          observation: null,
        };
      }

      const observation = await deps.observationStore.findLatestEligible(gamePk, cutoff);
      if (!observation) {
        return {
          pitcherId: null,
          source: 'UNAVAILABLE',
          observedAt: null,
          observation: null,
        };
      }

      const pitcherId =
        side === 'home'
          ? observation.homeProbablePitcherId
          : observation.awayProbablePitcherId;

      if (pitcherId === null || pitcherId === undefined) {
        return {
          pitcherId: null,
          source: 'UNAVAILABLE',
          observedAt: null,
          observation: null,
        };
      }

      return {
        pitcherId,
        source: 'SCHEDULE_PROBABLE_BEFORE_CUTOFF',
        observedAt: observation.observedAt,
        observation,
      };
    },

    async loadOfficialFinalOutcome({ gamePk }) {
      if (deps.outcomeLoader.loadOutcomeWithProvenance) {
        return deps.outcomeLoader.loadOutcomeWithProvenance(gamePk);
      }
      throw new Error(
        `provenance-aware loadOfficialFinalOutcome requires outcomeLoader.loadOutcomeWithProvenance for game ${gamePk}`,
      );
    },
  };
}

export function createRealMLBHistoricalMaterializationSourceAdapter(
  options: MLBHistoricalMaterializationSourceAdapterFactoryOptions,
): MLBHistoricalMaterializationSourceAdapter {
  const scheduleLoader = createScheduleLoader({
    client: options.client,
    cache: options.cache,
    now: options.now,
  });

  const outcomeLoader = createOutcomeLoader({
    client: options.client,
    cache: options.cache,
    now: options.now,
  });

  const teamGameSource = createMLBHistoricalTeamGameSource({
    scheduleLoader,
    outcomeLoader,
  });

  const pitcherFeedLoader = createPitcherFeedLoader({
    client: options.client,
    cache: options.cache,
    now: options.now,
  });

  const pitcherAppearanceSource = createMLBHistoricalPitcherAppearanceSource({
    scheduleLoader,
    gameFeedLoader: pitcherFeedLoader,
  });

  return createMLBHistoricalMaterializationSourceAdapter({
    scheduleLoader,
    outcomeLoader,
    teamGameSource,
    teamAggregator: aggregateTeamHistory,
    pitcherAppearanceSource,
    pitcherAggregator: aggregatePitcherHistory,
    observationStore: options.observationStore,
  });
}

function validateCutoff(cutoff: Date, context: string): void {
  if (!(cutoff instanceof Date) || Number.isNaN(cutoff.getTime())) {
    throw new Error(`Invalid ${context} cutoff: ${cutoff}`);
  }
}
