import { describe, expect, it } from 'vitest';
import {
  MLB_OFFLINE_MULTI_RECOMMENDATION_SET_CONTRACT_VERSION,
  MLB_OFFLINE_MULTI_RECOMMENDATION_SELECTION_POLICY,
  type MLBOfflineMultiRecommendationSet,
  type MLBOfflineMultiRecommendationSetIssue,
  type MLBOfflineSelectedRecommendation,
  buildMLBOfflineMultiRecommendationSet,
  validateMLBOfflineMultiRecommendationSet,
} from '@/prediction/mlb/mlb-offline-multi-recommendation-contract';
import {
  buildMLBOfflineMultiCandidateSet,
  type MLBOfflineMultiCandidateSet,
  validateMLBOfflineMultiCandidateSet,
} from '@/prediction/mlb/mlb-offline-multi-candidate-contract';
import {
  validateMLBOfflineSinglePickRecommendationSet,
} from '@/prediction/mlb/mlb-offline-single-pick-recommendation-contract';
import { readFile } from 'node:fs/promises';

const BASE_RELEASE_ID = 'release-1';
const BASE_SNAPSHOT_ID = 'snapshot-1';
const BASE_GAME_ID = 'game-1';
const BASE_OFFICIAL_DATE = '2026-08-01';
const BASE_DATA_CUTOFF = '2026-07-30T09:00:00Z';

interface StrictRecommendationOptions {
  releaseId?: string;
  snapshotId?: string;
  gameId?: string;
  officialDate?: string;
  dataCutoffAt?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeWinProbability?: number;
  awayWinProbability?: number;
}

function buildRecommendation(
  overrides: StrictRecommendationOptions = {},
): Record<string, unknown> {
  const releaseId = overrides.releaseId ?? BASE_RELEASE_ID;
  const snapshotId = overrides.snapshotId ?? BASE_SNAPSHOT_ID;
  const inferenceId =
    `${releaseId}::${snapshotId}::offline-pregame-inference-v1`;
  const gameId = overrides.gameId ?? BASE_GAME_ID;
  const officialDate = overrides.officialDate ?? BASE_OFFICIAL_DATE;
  const dataCutoffAt = overrides.dataCutoffAt ?? BASE_DATA_CUTOFF;
  const homeTeamId = overrides.homeTeamId ?? 'team-home-1';
  const awayTeamId = overrides.awayTeamId ?? 'team-away-1';

  const homeWinProbability = overrides.homeWinProbability ?? 0.75;
  const awayWinProbability = overrides.awayWinProbability ?? 0.25;

  if (
    !Number.isFinite(homeWinProbability) ||
    !Number.isFinite(awayWinProbability)
  ) {
    throw new Error('Probabilities must be finite');
  }

  if (
    homeWinProbability < 0 ||
    homeWinProbability > 1 ||
    awayWinProbability < 0 ||
    awayWinProbability > 1
  ) {
    throw new Error('Probabilities must be within [0,1]');
  }

  if (homeWinProbability + awayWinProbability !== 1) {
    throw new Error('Probabilities must sum to exactly 1');
  }

  const recommendedSide =
    homeWinProbability >= 0.5 ? 'HOME' : 'AWAY';
  const recommendedTeamId =
    recommendedSide === 'HOME' ? homeTeamId : awayTeamId;
  const modelConfidence =
    recommendedSide === 'HOME'
      ? homeWinProbability
      : awayWinProbability;
  const modelUncertainty =
    recommendedSide === 'HOME'
      ? awayWinProbability
      : homeWinProbability;

  const recommendationId =
    `${inferenceId}::offline-single-pick-recommendation-v1`;

  return {
    recommendationId,
    inferenceId,
    snapshotId,
    gameId,
    officialDate,
    dataCutoffAt,
    homeTeamId,
    awayTeamId,
    recommendedSide,
    recommendedTeamId,
    probabilities: {
      homeWinProbability,
      awayWinProbability,
    },
    modelConfidence,
    modelUncertainty,
  };
}

function buildValidRecommendationSet(
  recommendations: readonly Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const slateId = `${BASE_RELEASE_ID}::${BASE_OFFICIAL_DATE}::mlb-offline-prediction-slate-v1`;
  const recommendationSetId = `${slateId}::offline-single-pick-recommendation-set-v1`;

  const sortedRecommendations = recommendations.slice().sort((a, b) => {
    const aConfidence = a.modelConfidence as number;
    const bConfidence = b.modelConfidence as number;
    if (aConfidence > bConfidence) return -1;
    if (aConfidence < bConfidence) return 1;
    const aGameId = a.gameId as string;
    const bGameId = b.gameId as string;
    if (aGameId < bGameId) return -1;
    if (aGameId > bGameId) return 1;
    const aSnapshotId = a.snapshotId as string;
    const bSnapshotId = b.snapshotId as string;
    if (aSnapshotId < bSnapshotId) return -1;
    if (aSnapshotId > bSnapshotId) return 1;
    const aInferenceId = a.inferenceId as string;
    const bInferenceId = b.inferenceId as string;
    if (aInferenceId < bInferenceId) return -1;
    if (aInferenceId > bInferenceId) return 1;
    return 0;
  });

  const base: Record<string, unknown> = {
    contractVersion: 'mlb-offline-single-pick-recommendation-set-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    recommendationSetId,
    slateId,
    releaseId: BASE_RELEASE_ID,
    modelId: 'model-1',
    planId: 'plan-1',
    matrixId: 'matrix-1',
    configId: 'config-1',
    manifestId: 'manifest-1',
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    decisionPolicy: 'HOME_AT_OR_ABOVE_0_5_V1',
    officialDate: BASE_OFFICIAL_DATE,
    recommendationPolicy: 'ALL_VALIDATED_PREDICTIONS_V1',
    orderPolicy: 'MODEL_CONFIDENCE_DESC_GAME_ID_ASC_SNAPSHOT_ID_ASC_INFERENCE_ID_ASC_V1',
    recommendationCount: recommendations.length,
    recommendations: sortedRecommendations,
  };

  return { ...base, ...overrides };
}

function ensureValidRecommendationSet(
  recommendations: readonly Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const set = buildValidRecommendationSet(recommendations, overrides);
  const validation = validateMLBOfflineSinglePickRecommendationSet(set);
  if (!validation.ok) {
    const issueMessages = validation.issues.map((issue) => `${issue.code}:${issue.path}`).join(', ');
    throw new Error(`Invalid recommendation set: ${issueMessages}`);
  }
  return validation.value;
}

function ensureValidCandidateSet(
  sourceSet: Record<string, unknown>,
): MLBOfflineMultiCandidateSet {
  const built = buildMLBOfflineMultiCandidateSet(sourceSet);
  if (!built.ok) {
    const issueMessages = built.issues.map((issue) => `${issue.code}:${issue.path}`).join(', ');
    throw new Error(`Invalid candidate set: ${issueMessages}`);
  }
  const validated = validateMLBOfflineMultiCandidateSet(built.value);
  if (!validated.ok) {
    const issueMessages = validated.issues.map((issue) => `${issue.code}:${issue.path}`).join(', ');
    throw new Error(`Invalid validated candidate set: ${issueMessages}`);
  }
  return built.value;
}

describe('mlb-offline-multi-recommendation-contract', () => {
  it('accepts a minimal valid multi-recommendation set and returns the exact original reference', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      awayWinProbability: 0.75,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2]));
    const built = buildMLBOfflineMultiRecommendationSet(sourceSet);
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('Expected successful build');
    const validated = validateMLBOfflineMultiRecommendationSet(built.value);
    expect(validated.ok).toBe(true);
    if (!validated.ok) throw new Error('Expected successful validation');
    expect(validated.value).toBe(built.value);
  });

  it('validates exact root fields, literals, source lineage, selection policy, counts, and deterministic multi-recommendation-set ID', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      awayWinProbability: 0.75,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2]));
    const result = buildMLBOfflineMultiRecommendationSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    const set = result.value;
    expect(set.contractVersion).toBe('mlb-offline-multi-recommendation-set-v1');
    expect(set.sport).toBe('MLB');
    expect(set.target).toBe('OFFICIAL_FINAL_GAME_WINNER');
    expect(set.targetEncoding).toBe('HOME_WIN_1_AWAY_WIN_0');
    expect(set.multiRecommendationSetId).toBe(`${sourceSet.candidateSetId}::offline-multi-recommendation-set-v1`);
    expect(set.candidateSetId).toBe(sourceSet.candidateSetId);
    expect(set.selectionPolicy).toBe('BEST_CANDIDATE_PER_LEG_COUNT_V1');
    expect(set.sourceCandidateSet).toBe(sourceSet);
    expect(set.selectedRecommendationCount).toBe(1);
    expect(set.selectedRecommendationIds).toHaveLength(1);
    expect(set.selectedRecommendations).toHaveLength(1);
  });

  it('validates the embedded Phase 8M source candidate set before selected recommendation semantics', () => {
    const invalidSource = { invalid: true };
    const result = buildMLBOfflineMultiRecommendationSet(invalidSource);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.issues).toEqual([
      {
        code: 'SOURCE_CANDIDATE_SET_INVALID',
        path: '$.candidateSet',
        message: 'Source candidate set is invalid',
      },
    ]);
  });

  it('validates exact selected recommendation alias fields and source-candidate equivalence', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      awayWinProbability: 0.75,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2]));
    const built = buildMLBOfflineMultiRecommendationSet(sourceSet);
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('Expected successful build');

    for (const selected of built.value.selectedRecommendations) {
      const sourceCandidate = sourceSet.candidates.find(
        (c) => c.candidateId === selected.candidateId,
      );
      expect(sourceCandidate).toBeDefined();
      if (!sourceCandidate) throw new Error('Expected source candidate');
      expect(selected.candidateId).toBe(sourceCandidate.candidateId);
      expect(selected.legCount).toBe(sourceCandidate.legCount);
      expect(selected.minimumLegConfidence).toBe(sourceCandidate.minimumLegConfidence);
      expect(selected.meanLegConfidence).toBe(sourceCandidate.meanLegConfidence);
      expect(selected.maximumLegUncertainty).toBe(sourceCandidate.maximumLegUncertainty);
      expect(selected.legs).toHaveLength(sourceCandidate.legs.length);
      for (let i = 0; i < selected.legs.length; i++) {
        expect(selected.legs[i].recommendationId).toBe(sourceCandidate.legs[i].recommendationId);
      }
    }
  });

  it('validates descriptor-safe roots, arrays, source candidate sets, selected recommendations, symbols, classes, and accessors without invoking getters', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      awayWinProbability: 0.75,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2]));
    const built = buildMLBOfflineMultiRecommendationSet(sourceSet);
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('Expected successful build');

    let rootFieldAccessorCount = 0;
    const rootBase: Record<string, unknown> = { ...built.value };
    delete rootBase.contractVersion;
    Object.defineProperty(rootBase, 'contractVersion', {
      get() { rootFieldAccessorCount++; throw new Error('root accessor'); },
    });
    const rootResult = validateMLBOfflineMultiRecommendationSet(rootBase);
    expect(rootResult.ok).toBe(false);
    if (rootResult.ok) throw new Error('Expected invalid');
    expect(rootFieldAccessorCount).toBe(0);

    let sourceCandidateSetAccessorCount = 0;
    const sourceBase: Record<string, unknown> = { ...built.value };
    Object.defineProperty(sourceBase, 'sourceCandidateSet', {
      get() { sourceCandidateSetAccessorCount++; throw new Error('sourceCandidateSet accessor'); },
    });
    const sourceResult = validateMLBOfflineMultiRecommendationSet(sourceBase);
    expect(sourceResult.ok).toBe(false);
    if (sourceResult.ok) throw new Error('Expected invalid');
    expect(sourceCandidateSetAccessorCount).toBe(0);

    let selectedIdsFieldAccessorCount = 0;
    const selectedIdsBase: Record<string, unknown> = { ...built.value };
    Object.defineProperty(selectedIdsBase, 'selectedRecommendationIds', {
      get() { selectedIdsFieldAccessorCount++; throw new Error('selectedRecommendationIds accessor'); },
    });
    const selectedIdsResult = validateMLBOfflineMultiRecommendationSet(selectedIdsBase);
    expect(selectedIdsResult.ok).toBe(false);
    if (selectedIdsResult.ok) throw new Error('Expected invalid');
    expect(selectedIdsFieldAccessorCount).toBe(0);

    let selectedIdsIndexAccessorCount = 0;
    const originalSelectedIds = built.value.selectedRecommendationIds as unknown[];
    const selectedId0 = Object.defineProperty({ ...originalSelectedIds[0] as Record<string, unknown> }, '0', {
      get() { selectedIdsIndexAccessorCount++; throw new Error('selected ID index accessor'); },
    });
    const selectedIdArrayWithAccessor = [selectedId0, ...originalSelectedIds.slice(1).map((id) => id as Record<string, unknown>)];
    const selectedIdArrayBase = Object.assign({}, built.value, { selectedRecommendationIds: selectedIdArrayWithAccessor });
    const selectedIdArrayResult = validateMLBOfflineMultiRecommendationSet(selectedIdArrayBase);
    expect(selectedIdArrayResult.ok).toBe(false);
    if (selectedIdArrayResult.ok) throw new Error('Expected invalid');
    expect(selectedIdsIndexAccessorCount).toBe(0);

    let selectedFieldAccessorCount = 0;
    const selectedBase: Record<string, unknown> = { ...built.value };
    Object.defineProperty(selectedBase, 'selectedRecommendations', {
      get() { selectedFieldAccessorCount++; throw new Error('selectedRecommendations accessor'); },
    });
    const selectedResult = validateMLBOfflineMultiRecommendationSet(selectedBase);
    expect(selectedResult.ok).toBe(false);
    if (selectedResult.ok) throw new Error('Expected invalid');
    expect(selectedFieldAccessorCount).toBe(0);

    let selectedArrayIndexAccessorCount = 0;
    const originalSelected = built.value.selectedRecommendations as unknown[];
    const selected0 = Object.defineProperty({ ...originalSelected[0] as Record<string, unknown> }, '0', {
      get() { selectedArrayIndexAccessorCount++; throw new Error('selected index accessor'); },
    });
    const selectedArrayWithAccessor = [selected0, ...originalSelected.slice(1).map((s) => s as Record<string, unknown>)];
    const selectedArrayBase = Object.assign({}, built.value, { selectedRecommendations: selectedArrayWithAccessor });
    const selectedArrayResult = validateMLBOfflineMultiRecommendationSet(selectedArrayBase);
    expect(selectedArrayResult.ok).toBe(false);
    if (selectedArrayResult.ok) throw new Error('Expected invalid');
    expect(selectedArrayIndexAccessorCount).toBe(0);

    let selectedCandidateFieldAccessorCount = 0;
    const selectedCandidateWithAccessor = Object.defineProperty({ ...originalSelected[0] as Record<string, unknown> }, 'candidateId', {
      get() { selectedCandidateFieldAccessorCount++; throw new Error('selected candidate field accessor'); },
    });
    const selectedCandidateBase = Object.assign({}, built.value, { selectedRecommendations: [selectedCandidateWithAccessor] });
    const selectedCandidateResult = validateMLBOfflineMultiRecommendationSet(selectedCandidateBase);
    expect(selectedCandidateResult.ok).toBe(false);
    if (selectedCandidateResult.ok) throw new Error('Expected invalid');
    expect(selectedCandidateFieldAccessorCount).toBe(0);

    let selectedLegsFieldAccessorCount = 0;
    const selectedLegsBase: Record<string, unknown> = {
      ...built.value,
      selectedRecommendations: [{
        ...(originalSelected[0] as Record<string, unknown>),
        legs: [{ ...(originalSelected[0] as MLBOfflineSelectedRecommendation).legs[0] as Record<string, unknown> }],
      }],
    };
    Object.defineProperty((selectedLegsBase.selectedRecommendations as unknown[])[0], 'legs', {
      get() { selectedLegsFieldAccessorCount++; throw new Error('selected legs accessor'); },
    });
    const selectedLegsResult = validateMLBOfflineMultiRecommendationSet(selectedLegsBase);
    expect(selectedLegsResult.ok).toBe(false);
    if (selectedLegsResult.ok) throw new Error('Expected invalid');
    expect(selectedLegsFieldAccessorCount).toBe(0);

    let selectedLegArrayIndexAccessorCount = 0;
    const originalLegs = (originalSelected[0] as Record<string, unknown>).legs as unknown[];
    const leg0 = Object.defineProperty({ ...originalLegs[0] as Record<string, unknown> }, '0', {
      get() { selectedLegArrayIndexAccessorCount++; throw new Error('selected leg index accessor'); },
    });
    const selectedLegArrayWithAccessor = [leg0, ...originalLegs.slice(1).map((l) => l as Record<string, unknown>)];
    const selectedLegArrayBase = Object.assign({}, built.value, { selectedRecommendations: [{ ...(originalSelected[0] as Record<string, unknown>), legs: selectedLegArrayWithAccessor }] });
    const selectedLegArrayResult = validateMLBOfflineMultiRecommendationSet(selectedLegArrayBase);
    expect(selectedLegArrayResult.ok).toBe(false);
    if (selectedLegArrayResult.ok) throw new Error('Expected invalid');
    expect(selectedLegArrayIndexAccessorCount).toBe(0);

    let selectedLegFieldAccessorCount = 0;
    const selectedLegWithAccessor = Object.defineProperty({ ...originalLegs[0] as Record<string, unknown> }, 'recommendationId', {
      get() { selectedLegFieldAccessorCount++; throw new Error('selected leg field accessor'); },
    });
    const selectedLegBase = Object.assign({}, built.value, { selectedRecommendations: [{ ...(originalSelected[0] as Record<string, unknown>), legs: [selectedLegWithAccessor, ...originalLegs.slice(1)] }] });
    const selectedLegResult = validateMLBOfflineMultiRecommendationSet(selectedLegBase);
    expect(selectedLegResult.ok).toBe(false);
    if (selectedLegResult.ok) throw new Error('Expected invalid');
    expect(selectedLegFieldAccessorCount).toBe(0);

    let probabilitiesFieldAccessorCount = 0;
    const probsBase: Record<string, unknown> = {
      ...built.value,
      selectedRecommendations: [{
        ...(originalSelected[0] as Record<string, unknown>),
        legs: [{
          ...originalLegs[0] as Record<string, unknown>,
          probabilities: { length: 2, homeWinProbability: 0.75, awayWinProbability: 0.25 },
        }],
      }],
    };
    const probsLegArray = (probsBase.selectedRecommendations as unknown[])[0] as Record<string, unknown>;
    Object.defineProperty(probsLegArray.legs as unknown[], '0', {
      get() { probabilitiesFieldAccessorCount++; throw new Error('probabilities field accessor'); },
    });
    const probsResult = validateMLBOfflineMultiRecommendationSet(probsBase);
    expect(probsResult.ok).toBe(false);
    if (probsResult.ok) throw new Error('Expected invalid');
    expect(probabilitiesFieldAccessorCount).toBe(0);

    let probabilityFieldAccessorCount = 0;
    const probsWithProbAccessor = Object.defineProperty(
      { homeWinProbability: 0.75 } as Record<string, unknown>,
      'awayWinProbability',
      {
        get() { probabilityFieldAccessorCount++; throw new Error('probability field accessor'); },
      },
    );
    const probBase = { ...built.value, selectedRecommendations: [{ ...(originalSelected[0] as Record<string, unknown>), legs: [{
      ...originalLegs[0] as Record<string, unknown>,
      probabilities: probsWithProbAccessor,
    }] }] };
    const probResult = validateMLBOfflineMultiRecommendationSet(probBase);
    expect(probResult.ok).toBe(false);
    if (probResult.ok) throw new Error('Expected invalid');
    expect(probabilityFieldAccessorCount).toBe(0);
  });

  it('maps an invalid Phase 8M candidate set to one SOURCE_CANDIDATE_SET_INVALID issue without partial output or pre-validation access', () => {
    const invalidSource = { invalid: true };
    const result = buildMLBOfflineMultiRecommendationSet(invalidSource);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.issues).toEqual([
      {
        code: 'SOURCE_CANDIDATE_SET_INVALID',
        path: '$.candidateSet',
        message: 'Source candidate set is invalid',
      },
    ]);
  });

  it('builds a valid empty multi-recommendation set when no supported source candidates exist', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const sourceSet = ensureValidCandidateSet(ensureValidRecommendationSet([rec1]));
    const result = buildMLBOfflineMultiRecommendationSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    expect(result.value.selectedRecommendationCount).toBe(0);
    expect(result.value.selectedRecommendationIds).toHaveLength(0);
    expect(result.value.selectedRecommendations).toHaveLength(0);
  });

  it('selects exactly one two-leg recommendation when only two-leg candidates exist', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      awayWinProbability: 0.75,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2]));
    const result = buildMLBOfflineMultiRecommendationSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    expect(result.value.selectedRecommendationCount).toBe(1);
    expect(result.value.selectedRecommendationIds).toHaveLength(1);
    expect(result.value.selectedRecommendations).toHaveLength(1);
    expect(result.value.selectedRecommendations[0].legCount).toBe(2);
  });

  it('selects exactly one two-leg and one three-leg recommendation when both supported categories exist', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      awayWinProbability: 0.75,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const rec3 = buildRecommendation({
      snapshotId: 'snapshot-3',
      gameId: 'game-3',
      homeWinProbability: 0.625,
      awayWinProbability: 0.375,
      homeTeamId: 'team-home-3',
      awayTeamId: 'team-away-3',
    });
    const sourceSet = ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2, rec3]));
    const result = buildMLBOfflineMultiRecommendationSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    expect(result.value.selectedRecommendationCount).toBe(2);
    expect(result.value.selectedRecommendationIds).toHaveLength(2);
    expect(result.value.selectedRecommendations).toHaveLength(2);
    const legCounts = result.value.selectedRecommendations.map((r) => r.legCount).sort((a, b) => a - b);
    expect(legCounts).toEqual([2, 3]);
  });

  it('selects the first canonical candidate from each supported leg-count category', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-a', gameId: 'game-a', homeWinProbability: 0.875, awayWinProbability: 0.125 });
    const rec2 = buildRecommendation({ snapshotId: 'snapshot-b', gameId: 'game-b', homeWinProbability: 0.625, awayWinProbability: 0.375, homeTeamId: 'team-home-b', awayTeamId: 'team-away-b' });
    const rec3 = buildRecommendation({ snapshotId: 'snapshot-c', gameId: 'game-c', homeWinProbability: 0.75, awayWinProbability: 0.25, homeTeamId: 'team-home-c', awayTeamId: 'team-away-c' });
    const rec4 = buildRecommendation({ snapshotId: 'snapshot-d', gameId: 'game-d', homeWinProbability: 0.5, awayWinProbability: 0.5, homeTeamId: 'team-home-d', awayTeamId: 'team-away-d' });
    const sourceSet = ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2, rec3, rec4]));
    const result = buildMLBOfflineMultiRecommendationSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');

    const twoLeg = result.value.selectedRecommendations.find((r) => r.legCount === 2);
    const threeLeg = result.value.selectedRecommendations.find((r) => r.legCount === 3);
    expect(twoLeg).toBeDefined();
    expect(threeLeg).toBeDefined();
    if (!twoLeg || !threeLeg) throw new Error('Expected both selections');

    const sourceTwoLeg = sourceSet.candidates.find((c) => c.candidateId === twoLeg.candidateId);
    const sourceThreeLeg = sourceSet.candidates.find((c) => c.candidateId === threeLeg.candidateId);
    expect(sourceTwoLeg).toBeDefined();
    expect(sourceThreeLeg).toBeDefined();

    const firstSourceTwoLeg = sourceSet.candidates.find((c) => c.legCount === 2);
    const firstSourceThreeLeg = sourceSet.candidates.find((c) => c.legCount === 3);
    expect(firstSourceTwoLeg).toBeDefined();
    expect(firstSourceThreeLeg).toBeDefined();
    expect(twoLeg.candidateId).toBe(firstSourceTwoLeg!.candidateId);
    expect(threeLeg.candidateId).toBe(firstSourceThreeLeg!.candidateId);
  });

  it('preserves the exact Phase 8M source candidate-set and selected candidate references', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      awayWinProbability: 0.75,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2]));
    const built = buildMLBOfflineMultiRecommendationSet(sourceSet);
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('Expected successful build');

    expect(built.value.sourceCandidateSet).toBe(sourceSet);
    for (const selected of built.value.selectedRecommendations) {
      const source = sourceSet.candidates.find((c) => c.candidateId === selected.candidateId);
      expect(source).toBeDefined();
      if (!source) throw new Error('Expected source candidate');
      expect(selected).toBe(source);
    }
  });

  it('preserves exact candidate-leg and Phase 8L recommendation references', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      awayWinProbability: 0.75,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2]));
    const built = buildMLBOfflineMultiRecommendationSet(sourceSet);
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('Expected successful build');

    for (const selected of built.value.selectedRecommendations) {
      const source = sourceSet.candidates.find((c) => c.candidateId === selected.candidateId);
      expect(source).toBeDefined();
      if (!source) throw new Error('Expected source candidate');
      expect(selected.legs).toBe(source.legs);
      for (let i = 0; i < selected.legs.length; i++) {
        expect(selected.legs[i]).toBe(source.legs[i]);
      }
    }
  });

  it('preserves source-relative selected order and proves two-leg dominance over three-leg selection', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-a', gameId: 'game-a', homeWinProbability: 0.875, awayWinProbability: 0.125 });
    const rec2 = buildRecommendation({ snapshotId: 'snapshot-b', gameId: 'game-b', homeWinProbability: 0.75, awayWinProbability: 0.25, homeTeamId: 'team-home-b', awayTeamId: 'team-away-b' });
    const rec3 = buildRecommendation({ snapshotId: 'snapshot-c', gameId: 'game-c', homeWinProbability: 0.625, awayWinProbability: 0.375, homeTeamId: 'team-home-c', awayTeamId: 'team-away-c' });
    const rec4 = buildRecommendation({ snapshotId: 'snapshot-d', gameId: 'game-d', homeWinProbability: 0.5, awayWinProbability: 0.5, homeTeamId: 'team-home-d', awayTeamId: 'team-away-d' });
    const sourceSet = ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2, rec3, rec4]));
    const result = buildMLBOfflineMultiRecommendationSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');

    const twoLegIndex = sourceSet.candidates.findIndex((c) => c.legCount === 2);
    const threeLegIndex = sourceSet.candidates.findIndex((c) => c.legCount === 3);
    expect(twoLegIndex).toBeGreaterThanOrEqual(0);
    expect(threeLegIndex).toBeGreaterThanOrEqual(0);
    expect(twoLegIndex).toBeLessThan(threeLegIndex);

    const selectedTwoLegIndex = result.value.selectedRecommendations.findIndex((r) => r.legCount === 2);
    const selectedThreeLegIndex = result.value.selectedRecommendations.findIndex((r) => r.legCount === 3);
    expect(selectedTwoLegIndex).toBeLessThan(selectedThreeLegIndex);
  });

  it('derives deterministic selected recommendation IDs and multi-recommendation-set identity', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      awayWinProbability: 0.75,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2]));
    const first = buildMLBOfflineMultiRecommendationSet(sourceSet);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('Expected successful build');

    const second = buildMLBOfflineMultiRecommendationSet(sourceSet);
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error('Expected successful build');

    expect(second.value).not.toBe(first.value);
    expect(second.value.selectedRecommendationIds).not.toBe(first.value.selectedRecommendationIds);
    expect(second.value.selectedRecommendations).not.toBe(first.value.selectedRecommendations);
    for (let i = 0; i < second.value.selectedRecommendations.length; i++) {
      expect(second.value.selectedRecommendations[i]).toBe(first.value.selectedRecommendations[i]);
    }

    expect(first.value.multiRecommendationSetId).toBe(
      `${sourceSet.candidateSetId}::offline-multi-recommendation-set-v1`,
    );
    expect(first.value.selectedRecommendationIds).toEqual(
      first.value.selectedRecommendations.map((r) => r.candidateId),
    );
  });

  it('rejects duplicate selected recommendation identities', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      awayWinProbability: 0.75,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const rec3 = buildRecommendation({
      snapshotId: 'snapshot-3',
      gameId: 'game-3',
      homeWinProbability: 0.625,
      awayWinProbability: 0.375,
      homeTeamId: 'team-home-3',
      awayTeamId: 'team-away-3',
    });
    const sourceSet = ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2, rec3]));
    const built = buildMLBOfflineMultiRecommendationSet(sourceSet);
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('Expected successful build');

    const selected = built.value.selectedRecommendations[0];
    const duplicateSet = {
      ...built.value,
      selectedRecommendations: [selected, { ...selected }],
      selectedRecommendationIds: [selected.candidateId, selected.candidateId],
      selectedRecommendationCount: 2,
    };
    const result = validateMLBOfflineMultiRecommendationSet(duplicateSet);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.issues).toEqual([
      {
        code: 'DUPLICATE_SELECTED_RECOMMENDATION_ID',
        path: '$.selectedRecommendations[1].candidateId',
        message: `Duplicate selected recommendationId: ${selected.candidateId}`,
      },
    ]);
  });

  it('rejects selected recommendation ID, count, order, and set-ID mismatches deterministically', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      awayWinProbability: 0.75,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const rec3 = buildRecommendation({
      snapshotId: 'snapshot-3',
      gameId: 'game-3',
      homeWinProbability: 0.625,
      awayWinProbability: 0.375,
      homeTeamId: 'team-home-3',
      awayTeamId: 'team-away-3',
    });
    const sourceSet = ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2, rec3]));
    const built = buildMLBOfflineMultiRecommendationSet(sourceSet);
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('Expected successful build');

    const selected = built.value.selectedRecommendations[0];
    const otherCandidate = sourceSet.candidates.find((c) => c.candidateId !== selected.candidateId);
    const idMismatchSet = {
      ...built.value,
      selectedRecommendationIds: built.value.selectedRecommendationIds.map((id, i) => i === 0 ? otherCandidate!.candidateId : id),
    };
    const idMismatchResult = validateMLBOfflineMultiRecommendationSet(idMismatchSet);
    expect(idMismatchResult.ok).toBe(false);
    if (idMismatchResult.ok) throw new Error('Expected failure');
    expect(idMismatchResult.issues).toEqual([
      {
        code: 'SELECTED_RECOMMENDATION_ID_MISMATCH',
        path: '$.selectedRecommendationIds[0]',
        message: 'selectedRecommendationIds must map selectedRecommendations by candidateId',
      },
    ]);

    const countMismatchSet = {
      ...built.value,
      selectedRecommendationCount: built.value.selectedRecommendationCount + 1,
    };
    const countMismatchResult = validateMLBOfflineMultiRecommendationSet(countMismatchSet);
    expect(countMismatchResult.ok).toBe(false);
    if (countMismatchResult.ok) throw new Error('Expected failure');
    expect(countMismatchResult.issues).toEqual([
      {
        code: 'SELECTED_RECOMMENDATION_COUNT_MISMATCH',
        path: '$.selectedRecommendationCount',
        message: 'selectedRecommendationCount must equal selected arrays length',
      },
    ]);

    const reversedSet = {
      ...built.value,
      selectedRecommendations: [built.value.selectedRecommendations[1], built.value.selectedRecommendations[0]],
      selectedRecommendationIds: [built.value.selectedRecommendationIds[1], built.value.selectedRecommendationIds[0]],
    };
    const reversedResult = validateMLBOfflineMultiRecommendationSet(reversedSet);
    expect(reversedResult.ok).toBe(false);
    if (reversedResult.ok) throw new Error('Expected failure');
    expect(reversedResult.issues).toEqual([
      {
        code: 'ORDER_MISMATCH',
        path: '$.selectedRecommendations',
        message: 'Selected recommendations must be in source-relative order',
      },
    ]);

    const setIdMismatchSet = {
      ...built.value,
      multiRecommendationSetId: 'bad-id',
    };
    const setIdMismatchResult = validateMLBOfflineMultiRecommendationSet(setIdMismatchSet);
    expect(setIdMismatchResult.ok).toBe(false);
    if (setIdMismatchResult.ok) throw new Error('Expected failure');
    expect(setIdMismatchResult.issues).toEqual([
      {
        code: 'MULTI_RECOMMENDATION_SET_ID_MISMATCH',
        path: '$.multiRecommendationSetId',
        message: 'multiRecommendationSetId does not match the deterministic formula',
      },
    ]);
  });

  it('proves exact best-candidate-per-leg-count selection completeness', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1', homeWinProbability: 0.875, awayWinProbability: 0.125 });
    const rec2 = buildRecommendation({ snapshotId: 'snapshot-2', gameId: 'game-2', homeWinProbability: 0.75, awayWinProbability: 0.25, homeTeamId: 'team-home-2', awayTeamId: 'team-away-2' });
    const rec3 = buildRecommendation({ snapshotId: 'snapshot-3', gameId: 'game-3', homeWinProbability: 0.625, awayWinProbability: 0.375, homeTeamId: 'team-home-3', awayTeamId: 'team-away-3' });
    const rec4 = buildRecommendation({ snapshotId: 'snapshot-4', gameId: 'game-4', homeWinProbability: 0.5, awayWinProbability: 0.5, homeTeamId: 'team-home-4', awayTeamId: 'team-away-4' });
    const sourceSet = ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2, rec3, rec4]));
    const built = buildMLBOfflineMultiRecommendationSet(sourceSet);
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('Expected successful build');

    const expectedTwoLeg = sourceSet.candidates.find((c) => c.legCount === 2);
    const expectedThreeLeg = sourceSet.candidates.find((c) => c.legCount === 3);
    expect(expectedTwoLeg).toBeDefined();
    expect(expectedThreeLeg).toBeDefined();

    const selectedTwoLeg = built.value.selectedRecommendations.find((r) => r.legCount === 2);
    const selectedThreeLeg = built.value.selectedRecommendations.find((r) => r.legCount === 3);
    expect(selectedTwoLeg).toBeDefined();
    expect(selectedThreeLeg).toBeDefined();
    expect(selectedTwoLeg!.candidateId).toBe(expectedTwoLeg!.candidateId);
    expect(selectedThreeLeg!.candidateId).toBe(expectedThreeLeg!.candidateId);
    expect(built.value.selectedRecommendationCount).toBe(2);
    expect(built.value.selectedRecommendationIds).toEqual([selectedTwoLeg!.candidateId, selectedThreeLeg!.candidateId]);
  });

  it('produces deeply deterministic output without mutating the source candidate set, candidates, legs, or recommendations', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-a', gameId: 'game-a', homeWinProbability: 0.875, awayWinProbability: 0.125 });
    const rec2 = buildRecommendation({ snapshotId: 'snapshot-b', gameId: 'game-b', homeWinProbability: 0.625, awayWinProbability: 0.375 });
    const rec3 = buildRecommendation({ snapshotId: 'snapshot-c', gameId: 'game-c', homeWinProbability: 0.5, awayWinProbability: 0.5 });
    const sourceSet = ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2, rec3]));

    const sourceRootNames = Object.getOwnPropertyNames(sourceSet);
    const sourceRootSymbols = Object.getOwnPropertySymbols(sourceSet);
    const sourceCandidatesReference = sourceSet.candidates;

    function captureCandidateState(candidate: Record<string, unknown>) {
      const scalarEntries: Array<[string, unknown]> = [];
      for (const key of Object.getOwnPropertyNames(candidate)) {
        const descriptor = Object.getOwnPropertyDescriptor(candidate, key);
        if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
          scalarEntries.push([key, descriptor.value]);
        }
      }
      const legsReference = candidate.legs as unknown[];
      return {
        rootNames: Object.getOwnPropertyNames(candidate),
        rootSymbols: Object.getOwnPropertySymbols(candidate),
        scalarEntries,
        legsReference,
      };
    }

    const candidateStates = (sourceSet.candidates as unknown[]).map((c) => captureCandidateState(c as Record<string, unknown>));

    const first = buildMLBOfflineMultiRecommendationSet(sourceSet);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('Expected successful build');

    const second = buildMLBOfflineMultiRecommendationSet(sourceSet);
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error('Expected successful build');

    expect(second.value).not.toBe(first.value);
    expect(second.value.selectedRecommendationIds).not.toBe(first.value.selectedRecommendationIds);
    expect(second.value.selectedRecommendations).not.toBe(first.value.selectedRecommendations);

    expect(Object.getOwnPropertyNames(sourceSet)).toEqual(sourceRootNames);
    expect(Object.getOwnPropertySymbols(sourceSet)).toEqual(sourceRootSymbols);
    expect(sourceSet.candidates).toBe(sourceCandidatesReference);

    for (let i = 0; i < (sourceSet.candidates as unknown[]).length; i++) {
      const candidate = (sourceSet.candidates as unknown[])[i] as Record<string, unknown>;
      const state = candidateStates[i];
      expect(Object.getOwnPropertyNames(candidate)).toEqual(state.rootNames);
      expect(Object.getOwnPropertySymbols(candidate)).toEqual(state.rootSymbols);
      for (const [key, value] of state.scalarEntries) {
        expect(candidate[key]).toBe(value);
      }
      expect((candidate.legs as unknown[])).toBe(state.legsReference);
    }

    expect(first.value).toEqual(second.value);
  });

  it('rejects odds contamination, staking, grading, and prohibited fields while allowing phase-owned recommendation vocabulary', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      awayWinProbability: 0.75,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2]));

    const baseRoot = {
      contractVersion: 'mlb-offline-multi-recommendation-set-v1',
      sport: 'MLB',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
      multiRecommendationSetId: `${sourceSet.candidateSetId}::offline-multi-recommendation-set-v1`,
      candidateSetId: sourceSet.candidateSetId,
      selectionPolicy: 'BEST_CANDIDATE_PER_LEG_COUNT_V1',
      sourceCandidateSet: sourceSet,
      selectedRecommendationCount: 0,
      selectedRecommendationIds: [],
      selectedRecommendations: [],
    };

    const sportsbookResult = validateMLBOfflineMultiRecommendationSet({
      ...baseRoot,
      sportsbook: 0,
    });
    expect(sportsbookResult.ok).toBe(false);
    if (sportsbookResult.ok) throw new Error('Expected failure');
    expect(sportsbookResult.issues).toEqual([
      { code: 'ODDS_CONTAMINATION', path: '$', message: 'Odds contamination detected' },
    ]);

    const stakeResult = validateMLBOfflineMultiRecommendationSet({
      ...baseRoot,
      stake: 0,
    });
    expect(stakeResult.ok).toBe(false);
    if (stakeResult.ok) throw new Error('Expected failure');
    expect(stakeResult.issues).toEqual([
      { code: 'PROHIBITED_CONCEPT', path: '$.stake', message: 'Prohibited field: stake' },
    ]);

    const gradeResult = validateMLBOfflineMultiRecommendationSet({
      ...baseRoot,
      grade: 0,
    });
    expect(gradeResult.ok).toBe(false);
    if (gradeResult.ok) throw new Error('Expected failure');
    expect(gradeResult.issues).toEqual([
      { code: 'PROHIBITED_CONCEPT', path: '$.grade', message: 'Prohibited field: grade' },
    ]);

    const safeResult = validateMLBOfflineMultiRecommendationSet(baseRoot);
    expect(safeResult.ok).toBe(true);
    if (!safeResult.ok) throw new Error('Expected success');
  });

  it('verifies deterministic issue ordering, exact exports and imports, no live inference, no candidate rebuilding, no staking, no routes, no UI, and the static architecture boundary', async () => {
    const source = await readFile(new URL('../../../src/prediction/mlb/mlb-offline-multi-recommendation-contract.ts', import.meta.url), 'utf-8');

    const expectedExports = Array.from(source.matchAll(/\bexport\s+(?:const|type|function)\s+([A-Za-z0-9_]+)/g)).map((match) => match[1]);
    expect(expectedExports).toEqual([
      'MLB_OFFLINE_MULTI_RECOMMENDATION_SET_CONTRACT_VERSION',
      'MLB_OFFLINE_MULTI_RECOMMENDATION_SELECTION_POLICY',
      'MLBOfflineSelectedRecommendation',
      'MLBOfflineMultiRecommendationSet',
      'MLBOfflineMultiRecommendationSetIssue',
      'validateMLBOfflineMultiRecommendationSet',
      'buildMLBOfflineMultiRecommendationSet',
    ]);

    const expectedImports = Array.from(source.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)).map((match) => match[1]);
    expect(expectedImports).toEqual([
      '../firewall/odds-contamination-guard',
      './mlb-offline-multi-candidate-contract',
    ]);

    expect(source).toContain('validateMLBOfflineMultiRecommendationSet(');
    expect(source).toContain('buildMLBOfflineMultiRecommendationSet(');
    expect(source).toContain('assertNoOddsContamination(');

    expect(source).not.toMatch(/\bexport\s+(?:enum|interface)\s+/);
    expect(source).not.toMatch(/from\s+['"]node:fs/);
    expect(source).not.toMatch(/fetch\s*\(/);
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/Date\.now/);
    expect(source).not.toMatch(/randomUUID/);
    expect(source).not.toMatch(/process\.env/);
    expect(source).not.toMatch(/localeCompare/);
    expect(source).not.toMatch(/\binferMLBOfflinePregameWinner\s*\(/);
    expect(source).not.toMatch(/\bbuildMLBOfflinePredictionSlate\s*\(/);
    expect(source).not.toMatch(/\bvalidateMLBOfflinePredictionSlate\s*\(/);
    expect(source).not.toMatch(/\bbuildMLBOfflinePregameInference\s*\(/);
    expect(source).not.toMatch(/\bvalidateMLBOfflinePregameInference\s*\(/);
    expect(source).not.toMatch(/\bbuildMLBOfflineSinglePickRecommendationSet\s*\(/);
    expect(source).not.toMatch(/from\s+['"]@prisma/);
    expect(source).not.toMatch(/PrismaClient/);
    expect(source).not.toMatch(/readFileSync/);
    expect(source).not.toMatch(/writeFileSync/);
    expect(source).not.toMatch(/\bfitModel\s*\(/);
    expect(source).not.toMatch(/\btrainModel\s*\(/);
    expect(source).not.toMatch(/\bcalibrate/);
    expect(source).not.toMatch(/\bgenerateRecommendation\s*\(/);
    expect(source).not.toMatch(/\bbuildMulti\s*\(/);
    expect(source).not.toMatch(/\bcalculateStake\s*\(/);
    expect(source).not.toMatch(/\bgradePrediction\s*\(/);
    const forbiddenCast = 'as ' + 'any';
    expect(source).not.toContain(forbiddenCast);

    const testSource = await readFile(new URL('../../../tests/prediction/mlb/mlb-offline-multi-recommendation-contract.test.ts', import.meta.url), 'utf-8');
    const testCount = (testSource.match(/\bit\s*\(/g) || []).length;
    expect(testCount).toBe(20);

    expect(testSource).not.toMatch(/\b(?:it|test)\s*\.\s*each\s*\(/);

    const testImports = Array.from(testSource.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)).map((match) => match[1]);
    const allowedTestImports = [
      'vitest',
      '@/prediction/mlb/mlb-offline-multi-recommendation-contract',
      '@/prediction/mlb/mlb-offline-multi-candidate-contract',
      '@/prediction/mlb/mlb-offline-single-pick-recommendation-contract',
      'node:fs/promises',
    ];
    for (const importPath of testImports) {
      expect(allowedTestImports).toContain(importPath);
    }
  });
});
