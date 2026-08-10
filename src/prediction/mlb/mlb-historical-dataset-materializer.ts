import {
  assertNoOddsContamination,
  isProhibitedOddsBoundaryKey,
} from '@/prediction/firewall/odds-contamination-guard';
import type {
  MLBHistoricalMaterializationSourceAdapter,
  MLBHistoricalProspectiveStarterResult,
} from '@/prediction/mlb/mlb-historical-materialization-source-adapter';
import type {
  MLBHistoricalAcquisitionProvenance,
  TeamHistoricalAggregate,
  PitcherHistoricalAggregate,
  CanonicalHistoricalScheduleGame,
  CanonicalHistoricalOutcome,
  MLBHistoricalOutcomeWithProvenance,
  MLBHistoricalTeamGamesWithProvenance,
  MLBHistoricalPitcherAppearancesWithProvenance,
} from '@/lib/backtesting/mlb/live-history/types';
import type { PregamePitcherObservation } from '@/lib/backtesting/mlb/live-history/pregame-pitcher-observation-store';
import {
  buildMLBHistoricalCanonicalPregameSnapshot,
  type MLBHistoricalCanonicalSnapshotAdapterInput,
  type MLBHistoricalCanonicalSnapshotProvenance,
  type MLBHistoricalCanonicalSnapshotProbablePitcher,
} from '@/prediction/mlb/mlb-historical-canonical-snapshot-adapter';
import type { MLBPregameSourceRole } from '@/prediction/mlb/mlb-pregame-snapshot-contract';
import {
  buildMLBHistoricalLabelledDataset,
  type MLBHistoricalLabelledDatasetBuilderInput,
} from '@/prediction/mlb/mlb-historical-labelled-dataset-builder';
import {
  MLB_HISTORICAL_LABELLED_DATASET_BUILDER_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-historical-labelled-dataset-builder';
import type {
  MLBHistoricalDatasetSplit,
  MLBHistoricalDatasetValidationIssue,
  MLBHistoricalSplitPolicy,
} from '@/prediction/mlb/mlb-historical-labelled-dataset-contract';

export interface MLBHistoricalMaterializationClock {
  readonly now: () => Date;
}

export interface MLBHistoricalDatasetMaterializationInput {
  readonly startDate: string;
  readonly endDate: string;
  readonly cutoffMinutesBeforeStart: number;
  readonly sourceAdapter: MLBHistoricalMaterializationSourceAdapter;
  readonly clock: MLBHistoricalMaterializationClock;
  readonly datasetId: string;
  readonly splitPolicy: MLBHistoricalSplitPolicy;
}

export interface MLBHistoricalMaterializationSummary {
  readonly enumeratedGames: number;
  readonly eligibleGames: number;
  readonly materializedExamples: number;
}

export interface MLBHistoricalMaterializationResult {
  readonly dataset: import('./mlb-historical-labelled-dataset-contract').MLBHistoricalLabelledDataset;
  readonly summary: MLBHistoricalMaterializationSummary;
}

function toIsoString(value: Date): string {
  return value.toISOString();
}

function encodeComponent(value: string): string {
  return `${value.length}:${value}`;
}

function resolveSourceName(endpoint: string): string {
  if (endpoint === '/api/v1/schedule') return 'mlb-stats-api:schedule';
  if (endpoint.includes('/game/') && endpoint.includes('/feed/live')) return 'mlb-stats-api:feedLive';
  return `mlb-stats-api:${endpoint}`;
}

function resolveSourceCategory(endpoint: string): 'OFFICIAL' | 'SUPPLEMENTAL' {
  if (endpoint.startsWith('/api/v1')) return 'OFFICIAL';
  return 'SUPPLEMENTAL';
}

type ProvenanceContext = 'schedule' | 'team' | 'pitcher';

function provenanceRoles(
  context: ProvenanceContext,
): readonly import('@/prediction/mlb/mlb-pregame-snapshot-contract').MLBPregameSourceRole[] {
  if (context === 'schedule') {
    return ['GAME_IDENTITY', 'SCHEDULE_CONTEXT', 'TEAM_PLAYER_IDENTITY'];
  }

  if (context === 'team') {
    return ['TEAM_STATS'];
  }

  return ['PITCHER_STATS'];
}

function mapProvenance(
  prov: MLBHistoricalAcquisitionProvenance,
  context: ProvenanceContext,
): MLBHistoricalCanonicalSnapshotProvenance {
  return {
    sourceRefId: `${prov.endpoint}:${toIsoString(prov.fetchedAt)}`,
    sourceName: resolveSourceName(prov.endpoint),
    sourceCategory: resolveSourceCategory(prov.endpoint),
    roles: [...provenanceRoles(context)],
    fetchedAt: prov.fetchedAt,
    sourceUpdatedAt: prov.sourceTimestamp,
  };
}

function mapStarterObservationToProvenance(
  observation: PregamePitcherObservation,
  context: 'home' | 'away',
): MLBHistoricalCanonicalSnapshotProvenance {
  return {
    sourceRefId: `${observation.sourceEndpoint}:${toIsoString(observation.observedAt)}`,
    sourceName: resolveSourceName(observation.sourceEndpoint),
    sourceCategory: resolveSourceCategory(observation.sourceEndpoint),
    roles: ['STARTING_PITCHER'],
    fetchedAt: observation.observedAt,
    sourceUpdatedAt: null,
  };
}

function unionProvenance(
  entries: MLBHistoricalCanonicalSnapshotProvenance[],
): MLBHistoricalCanonicalSnapshotProvenance[] {
  const roleMap = new Map<string, Set<MLBPregameSourceRole>>();
  const metadata = new Map<string, MLBHistoricalCanonicalSnapshotProvenance>();

  for (const entry of entries) {
    if (!roleMap.has(entry.sourceRefId)) {
      roleMap.set(entry.sourceRefId, new Set());
      metadata.set(entry.sourceRefId, entry);
    }

    for (const role of entry.roles) {
      roleMap.get(entry.sourceRefId)!.add(role);
    }
  }

  return Array.from(metadata.entries()).map(([sourceRefId, first]) => ({
    sourceRefId,
    sourceName: first.sourceName,
    sourceCategory: first.sourceCategory,
    roles: Array.from(roleMap.get(sourceRefId)!),
    fetchedAt: first.fetchedAt,
    sourceUpdatedAt: first.sourceUpdatedAt,
  }));
}

function buildSnapshotProvenance(
  scheduleGame: CanonicalHistoricalScheduleGame,
  teamHomeProvenance: readonly MLBHistoricalAcquisitionProvenance[],
  teamAwayProvenance: readonly MLBHistoricalAcquisitionProvenance[],
  pitcherHomeProvenance: readonly MLBHistoricalAcquisitionProvenance[] | undefined,
  pitcherAwayProvenance: readonly MLBHistoricalAcquisitionProvenance[] | undefined,
  homeStarterResult: MLBHistoricalProspectiveStarterResult | null,
  awayStarterResult: MLBHistoricalProspectiveStarterResult | null,
): MLBHistoricalCanonicalSnapshotProvenance[] {
  const entries: MLBHistoricalCanonicalSnapshotProvenance[] = [
    mapProvenance(scheduleGame.provenance, 'schedule'),
    ...teamHomeProvenance.map((prov) => mapProvenance(prov, 'team')),
    ...teamAwayProvenance.map((prov) => mapProvenance(prov, 'team')),
    ...(pitcherHomeProvenance ? pitcherHomeProvenance.map((prov) => mapProvenance(prov, 'pitcher')) : []),
    ...(pitcherAwayProvenance ? pitcherAwayProvenance.map((prov) => mapProvenance(prov, 'pitcher')) : []),
    ...(homeStarterResult && homeStarterResult.observation !== null
      ? [mapStarterObservationToProvenance(homeStarterResult.observation, 'home')]
      : []),
    ...(awayStarterResult && awayStarterResult.observation !== null
      ? [mapStarterObservationToProvenance(awayStarterResult.observation, 'away')]
      : []),
  ];

  return unionProvenance(entries);
}

function validateMaterializationInput(
  input: MLBHistoricalDatasetMaterializationInput,
): void {
  if (
    typeof input.startDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) ||
    input.startDate !== input.startDate.trim()
  ) {
    throw new Error('Invalid startDate: YYYY-MM-DD required');
  }

  if (
    typeof input.endDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate) ||
    input.endDate !== input.endDate.trim()
  ) {
    throw new Error('Invalid endDate: YYYY-MM-DD required');
  }

  if (input.startDate > input.endDate) {
    throw new Error('startDate must be <= endDate');
  }

  if (
    typeof input.cutoffMinutesBeforeStart !== 'number' ||
    !Number.isFinite(input.cutoffMinutesBeforeStart) ||
    !Number.isSafeInteger(input.cutoffMinutesBeforeStart) ||
    input.cutoffMinutesBeforeStart <= 0
  ) {
    throw new Error('cutoffMinutesBeforeStart must be a positive integer');
  }

  if (
    typeof input.datasetId !== 'string' ||
    input.datasetId.length === 0 ||
    input.datasetId !== input.datasetId.trim()
  ) {
    throw new Error('datasetId must be a valid identifier');
  }

  if (
    typeof input.splitPolicy !== 'object' ||
    input.splitPolicy === null ||
    input.splitPolicy.strategy !== 'CHRONOLOGICAL_OFFICIAL_DATE_V1'
  ) {
    throw new Error('splitPolicy must be CHRONOLOGICAL_OFFICIAL_DATE_V1');
  }
}

function assignSplit(
  officialDate: string,
  policy: MLBHistoricalSplitPolicy,
): MLBHistoricalDatasetSplit {
  if (officialDate >= policy.train.startDate && officialDate <= policy.train.endDate) return 'TRAIN';
  if (officialDate >= policy.validation.startDate && officialDate <= policy.validation.endDate) return 'VALIDATION';
  if (officialDate >= policy.test.startDate && officialDate <= policy.test.endDate) return 'TEST';
  throw new Error(`Date ${officialDate} outside split windows`);
}

function compareGameOrder(
  a: CanonicalHistoricalScheduleGame,
  b: CanonicalHistoricalScheduleGame,
): number {
  const startDiff = a.scheduledStart.getTime() - b.scheduledStart.getTime();
  if (startDiff !== 0) return startDiff;
  return a.gamePk - b.gamePk;
}

function mapStarterToProbablePitcher(
  starter: MLBHistoricalProspectiveStarterResult,
  side: 'home' | 'away',
  cutoff: Date,
): MLBHistoricalCanonicalSnapshotProbablePitcher | null {
  if (
    starter.pitcherId === null ||
    starter.source !== 'SCHEDULE_PROBABLE_BEFORE_CUTOFF' ||
    starter.observedAt === null ||
    starter.observation === null
  ) {
    return null;
  }

  if (starter.observedAt.getTime() > cutoff.getTime()) {
    return null;
  }

  return {
    personId: starter.pitcherId,
    observedAt: starter.observedAt,
    sourceRefId: `${starter.observation.sourceEndpoint}:${toIsoString(starter.observedAt)}`,
  };
}

type NormalizationContext = {
  gamePk: number;
  side: 'home' | 'away';
  homeTeamId: number;
  awayTeamId: number;
  scheduledStart: Date;
  cutoff: Date;
};

function normalizeHistoricalProspectiveStarter(
  starter: MLBHistoricalProspectiveStarterResult,
  context: NormalizationContext,
): MLBHistoricalProspectiveStarterResult {
  if (
    starter.pitcherId === null ||
    starter.source !== 'SCHEDULE_PROBABLE_BEFORE_CUTOFF' ||
    starter.observation === null ||
    !(starter.observedAt instanceof Date) ||
    Number.isNaN(starter.observedAt.getTime())
  ) {
    return { pitcherId: null, source: 'UNAVAILABLE', observedAt: null, observation: null };
  }

  const observation = starter.observation;
  if (
    !(observation.observedAt instanceof Date) ||
    Number.isNaN(observation.observedAt.getTime()) ||
    !(observation.scheduledStart instanceof Date) ||
    Number.isNaN(observation.scheduledStart.getTime())
  ) {
    return { pitcherId: null, source: 'UNAVAILABLE', observedAt: null, observation: null };
  }

  if (
    observation.gamePk !== context.gamePk ||
    observation.homeTeamId !== context.homeTeamId ||
    observation.awayTeamId !== context.awayTeamId ||
    observation.scheduledStart.getTime() !== context.scheduledStart.getTime()
  ) {
    return { pitcherId: null, source: 'UNAVAILABLE', observedAt: null, observation: null };
  }

  const expectedPitcherId =
    context.side === 'home' ? observation.homeProbablePitcherId : observation.awayProbablePitcherId;

  if (expectedPitcherId === null || starter.pitcherId !== expectedPitcherId) {
    return { pitcherId: null, source: 'UNAVAILABLE', observedAt: null, observation: null };
  }

  if (starter.observedAt.getTime() > context.cutoff.getTime()) {
    return { pitcherId: null, source: 'UNAVAILABLE', observedAt: null, observation: null };
  }

  if (observation.observedAt.getTime() > context.cutoff.getTime()) {
    return { pitcherId: null, source: 'UNAVAILABLE', observedAt: null, observation: null };
  }

  if (observation.observedAt.getTime() !== starter.observedAt.getTime()) {
    return { pitcherId: null, source: 'UNAVAILABLE', observedAt: null, observation: null };
  }

  return starter;
}

export async function materializeMLBHistoricalDataset(
  input: MLBHistoricalDatasetMaterializationInput,
): Promise<MLBHistoricalMaterializationResult> {
  validateMaterializationInput(input);

  const scheduleGames = await input.sourceAdapter.loadScheduleGamesForDateRange({
    start: input.startDate,
    end: input.endDate,
  });

  assertNoOddsContamination(scheduleGames);

  const enumeratedGames = scheduleGames.length;
  const eligibleGames = enumeratedGames;

  const sorted = scheduleGames.slice().sort(compareGameOrder);

  const examples: Array<MLBHistoricalLabelledDatasetBuilderInput['entries'][number]> = [];
  const issues: MLBHistoricalDatasetValidationIssue[] = [];
  let materializedExamples = 0;

  for (let i = 0; i < sorted.length; i++) {
    const scheduleGame = sorted[i];
    const gameId = String(scheduleGame.gamePk);
    const season = scheduleGame.scheduledStart.getUTCFullYear();

    const rawGameType = scheduleGame.rawGameType;
    if (!rawGameType || rawGameType.trim().length === 0) {
      throw new Error(`Missing rawGameType for game ${gameId}`);
    }

    const cutoffMs = scheduleGame.scheduledStart.getTime() - input.cutoffMinutesBeforeStart * 60_000;
    const cutoff = new Date(cutoffMs);

    if (cutoffMs >= scheduleGame.scheduledStart.getTime()) {
      throw new Error(`Cutoff must be before scheduledStart for game ${gameId}`);
    }

    let homeTeamProvenance: readonly MLBHistoricalAcquisitionProvenance[] = [];
    let awayTeamProvenance: readonly MLBHistoricalAcquisitionProvenance[] = [];
    let homeAggregate: TeamHistoricalAggregate | null = null;
    let awayAggregate: TeamHistoricalAggregate | null = null;

    try {
      const homeResult = await input.sourceAdapter.loadTeamStatsAsOf({
        teamId: scheduleGame.homeTeamId,
        cutoff,
        season,
      });
      assertNoOddsContamination(homeResult);
      homeAggregate = homeResult.aggregate;
      homeTeamProvenance = homeResult.provenance;

      const awayResult = await input.sourceAdapter.loadTeamStatsAsOf({
        teamId: scheduleGame.awayTeamId,
        cutoff,
        season,
      });
      assertNoOddsContamination(awayResult);
      awayAggregate = awayResult.aggregate;
      awayTeamProvenance = awayResult.provenance;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('ODDS_CONTAMINATION')) {
        throw new Error(`Team stats contain prohibited odds contamination: ${error.message}`);
      }
      throw new Error(`Team reconstruction failed for game ${gameId}: ${error instanceof Error ? error.message : 'unknown'}`);
    }

    const homeStarterResult = normalizeHistoricalProspectiveStarter(
      await input.sourceAdapter.resolveProspectiveStarter({
        gamePk: scheduleGame.gamePk,
        side: 'home',
        cutoff,
      }),
      {
        gamePk: scheduleGame.gamePk,
        side: 'home',
        homeTeamId: scheduleGame.homeTeamId,
        awayTeamId: scheduleGame.awayTeamId,
        scheduledStart: scheduleGame.scheduledStart,
        cutoff,
      },
    );
    assertNoOddsContamination(homeStarterResult);

    const awayStarterResult = normalizeHistoricalProspectiveStarter(
      await input.sourceAdapter.resolveProspectiveStarter({
        gamePk: scheduleGame.gamePk,
        side: 'away',
        cutoff,
      }),
      {
        gamePk: scheduleGame.gamePk,
        side: 'away',
        homeTeamId: scheduleGame.homeTeamId,
        awayTeamId: scheduleGame.awayTeamId,
        scheduledStart: scheduleGame.scheduledStart,
        cutoff,
      },
    );
    assertNoOddsContamination(awayStarterResult);

    let pitcherHomeProvenance: readonly MLBHistoricalAcquisitionProvenance[] | undefined;
    let pitcherAwayProvenance: readonly MLBHistoricalAcquisitionProvenance[] | undefined;
    let pitcherHomeAggregate: PitcherHistoricalAggregate | null = null;
    let pitcherAwayAggregate: PitcherHistoricalAggregate | null = null;

    if (homeStarterResult.pitcherId !== null) {
      try {
        const pitcherResult = await input.sourceAdapter.loadPitcherStatsAsOf({
          personId: homeStarterResult.pitcherId,
          cutoff,
          season,
        });
        assertNoOddsContamination(pitcherResult);
        pitcherHomeAggregate = pitcherResult.aggregate;
        pitcherHomeProvenance = pitcherResult.provenance;
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('ODDS_CONTAMINATION')) {
          throw new Error(`Pitcher stats contain prohibited odds contamination: ${error.message}`);
        }
        throw new Error(`Pitcher reconstruction failed for game ${gameId}: ${error instanceof Error ? error.message : 'unknown'}`);
      }
    }

    if (awayStarterResult.pitcherId !== null) {
      try {
        const pitcherResult = await input.sourceAdapter.loadPitcherStatsAsOf({
          personId: awayStarterResult.pitcherId,
          cutoff,
          season,
        });
        assertNoOddsContamination(pitcherResult);
        pitcherAwayAggregate = pitcherResult.aggregate;
        pitcherAwayProvenance = pitcherResult.provenance;
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('ODDS_CONTAMINATION')) {
          throw new Error(`Pitcher stats contain prohibited odds contamination: ${error.message}`);
        }
        throw new Error(`Pitcher reconstruction failed for game ${gameId}: ${error instanceof Error ? error.message : 'unknown'}`);
      }
    }

    const snapshotProvenance = buildSnapshotProvenance(
      scheduleGame,
      homeTeamProvenance,
      awayTeamProvenance,
      pitcherHomeProvenance,
      pitcherAwayProvenance,
      homeStarterResult,
      awayStarterResult,
    );

    const snapshotResult = buildMLBHistoricalCanonicalPregameSnapshot({
      scheduleGame,
      rawGameType,
      cutoff,
      teamAggregates: {
        homeBatting: homeAggregate,
        awayBatting: awayAggregate,
        homeBullpen: homeAggregate,
        awayBullpen: awayAggregate,
      },
      pitcherAggregates: {
        home: pitcherHomeAggregate,
        away: pitcherAwayAggregate,
      },
      venue: scheduleGame.venueId !== null
        ? { id: scheduleGame.venueId, name: scheduleGame.venueName ?? '', latitude: null, longitude: null }
        : null,
      probablePitchers: {
        home: mapStarterToProbablePitcher(homeStarterResult, 'home', cutoff),
        away: mapStarterToProbablePitcher(awayStarterResult, 'away', cutoff),
      },
      provenance: snapshotProvenance,
    });

    if (!snapshotResult.ok) {
      throw new Error(`Snapshot invalid for game ${gameId}: ${snapshotResult.issues[0]?.code ?? 'INVALID'}`);
    }

    const outcomeWithProvenance = await input.sourceAdapter.loadOfficialFinalOutcome({
      gamePk: scheduleGame.gamePk,
    });
    assertNoOddsContamination(outcomeWithProvenance);

    const reconstructedAtDate = input.clock.now();
    if (!(reconstructedAtDate instanceof Date) || Number.isNaN(reconstructedAtDate.getTime())) {
      throw new Error('Invalid materialization clock');
    }
    const reconstructedAt = toIsoString(reconstructedAtDate);

    examples.push({
      split: assignSplit(scheduleGame.officialDate, input.splitPolicy),
      snapshot: snapshotResult.value,
      outcome: outcomeWithProvenance.outcome,
      labelSource: {
        sourceName: resolveSourceName(outcomeWithProvenance.provenance.endpoint),
        sourceRecordId: gameId,
        fetchedAt: toIsoString(outcomeWithProvenance.provenance.fetchedAt),
      },
      reconstructedAt,
    });

    materializedExamples += 1;
  }

  const datasetCreatedAt = toIsoString(input.clock.now());

  const datasetInput: MLBHistoricalLabelledDatasetBuilderInput = {
    datasetId: input.datasetId,
    createdAt: datasetCreatedAt,
    splitPolicy: input.splitPolicy,
    entries: examples,
  };

  const built = buildMLBHistoricalLabelledDataset(datasetInput);
  if (!built.ok) {
    throw new Error(`Dataset validation failed: ${built.issues.map((issue) => issue.message).join('; ')}`);
  }

  const dataset = built.value;

  try {
    assertNoOddsContamination(dataset);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('ODDS_CONTAMINATION')) {
      throw new Error(`Dataset contains prohibited odds contamination: ${error.message}`);
    }
    throw error;
  }

  return {
    dataset,
    summary: {
      enumeratedGames,
      eligibleGames,
      materializedExamples,
    },
  };
}
