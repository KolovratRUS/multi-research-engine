import { describe, expect, it } from 'vitest';
import {
  buildMLBOfflineMultiCandidateSet,
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

describe('mlb-offline-multi-candidate-contract', () => {
  it('accepts a minimal valid multi-candidate set and returns the exact original reference', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      awayWinProbability: 0.75,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidRecommendationSet([rec1, rec2]);
    const built = buildMLBOfflineMultiCandidateSet(sourceSet);
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('Expected successful build');
    const validated = validateMLBOfflineMultiCandidateSet(built.value);
    expect(validated.ok).toBe(true);
    if (!validated.ok) throw new Error('Expected successful validation');
    expect(validated.value).toBe(built.value);
  });

  it('validates exact set fields, literals, lineage, source IDs, counts, policies, and deterministic candidate-set ID', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const sourceSet = ensureValidRecommendationSet([rec1]);
    const result = buildMLBOfflineMultiCandidateSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    const set = result.value;
    expect(set.contractVersion).toBe('mlb-offline-candidate-set-v1');
    expect(set.sport).toBe('MLB');
    expect(set.target).toBe('OFFICIAL_FINAL_GAME_WINNER');
    expect(set.targetEncoding).toBe('HOME_WIN_1_AWAY_WIN_0');
    expect(set.candidateSetId).toBe(`${sourceSet.recommendationSetId}::offline-candidate-set-v1`);
    expect(set.recommendationSetId).toBe(sourceSet.recommendationSetId);
    expect(set.slateId).toBe(sourceSet.slateId);
    expect(set.releaseId).toBe(sourceSet.releaseId);
    expect(set.modelId).toBe(sourceSet.modelId);
    expect(set.planId).toBe(sourceSet.planId);
    expect(set.matrixId).toBe(sourceSet.matrixId);
    expect(set.configId).toBe(sourceSet.configId);
    expect(set.manifestId).toBe(sourceSet.manifestId);
    expect(set.algorithm).toBe('L2_LOGISTIC_REGRESSION_BINARY_V1');
    expect(set.decisionPolicy).toBe('HOME_AT_OR_ABOVE_0_5_V1');
    expect(set.officialDate).toBe(sourceSet.officialDate);
    expect(set.sourceRecommendationPolicy).toBe('ALL_VALIDATED_PREDICTIONS_V1');
    expect(set.candidatePolicy).toBe('ALL_UNORDERED_2_AND_3_LEG_COMBINATIONS_V1');
    expect(set.orderPolicy).toBe('MINIMUM_CONFIDENCE_DESC_MEAN_CONFIDENCE_DESC_LEG_COUNT_ASC_CANDIDATE_ID_ASC_V1');
    expect(set.sourceRecommendationCount).toBe(1);
    expect(set.sourceRecommendationIds).toHaveLength(1);
    expect(set.sourceRecommendationIds).toEqual([
      'release-1::snapshot-1::offline-pregame-inference-v1::offline-single-pick-recommendation-v1',
    ]);
    expect(set.candidateCount).toBe(0);
    expect(set.candidates).toHaveLength(0);
  });

  it('validates exact candidate fields, leg fields, identities, leg count, and confidence summaries', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      awayWinProbability: 0.75,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidRecommendationSet([rec1, rec2]);
    const result = buildMLBOfflineMultiCandidateSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    const set = result.value;
    expect(set.candidates).toHaveLength(1);
    const candidate = set.candidates[0];
    expect(candidate.candidateId).toBe(
      'release-1::2026-08-01::mlb-offline-prediction-slate-v1::offline-single-pick-recommendation-set-v1::2::90:release-1::snapshot-1::offline-pregame-inference-v1::offline-single-pick-recommendation-v1|90:release-1::snapshot-2::offline-pregame-inference-v1::offline-single-pick-recommendation-v1::offline-candidate-v1',
    );
    expect(candidate.legCount).toBe(2);
    expect(candidate.minimumLegConfidence).toBe(0.75);
    expect(candidate.meanLegConfidence).toBe(0.75);
    expect(candidate.maximumLegUncertainty).toBe(0.25);
    expect(candidate.legs).toHaveLength(2);
    expect(candidate.legs[0].recommendationId).toBe(
      'release-1::snapshot-1::offline-pregame-inference-v1::offline-single-pick-recommendation-v1',
    );
    expect(candidate.legs[1].recommendationId).toBe(
      'release-1::snapshot-2::offline-pregame-inference-v1::offline-single-pick-recommendation-v1',
    );
  });

  it('validates descriptor-safe roots, source-ID arrays, candidate arrays, candidates, leg arrays, legs, probabilities, symbols, classes, and accessors without invoking getters', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      awayWinProbability: 0.75,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidRecommendationSet([rec1, rec2]);
    const built = buildMLBOfflineMultiCandidateSet(sourceSet);
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('Expected successful build');
    const set = built.value;

    let rootFieldAccessorCount = 0;
    const rootBase: Record<string, unknown> = { ...set };
    delete rootBase.contractVersion;
    Object.defineProperty(rootBase, 'contractVersion', {
      get() { rootFieldAccessorCount++; throw new Error('root accessor'); },
    });
    const rootResult = validateMLBOfflineMultiCandidateSet(rootBase);
    expect(rootResult.ok).toBe(false);
    if (rootResult.ok) throw new Error('Expected invalid');
    expect(rootFieldAccessorCount).toBe(0);

    let sourceRecommendationIdsFieldAccessorCount = 0;
    const sourceIdsBase: Record<string, unknown> = { ...set };
    Object.defineProperty(sourceIdsBase, 'sourceRecommendationIds', {
      get() { sourceRecommendationIdsFieldAccessorCount++; throw new Error('sourceRecommendationIds accessor'); },
    });
    const sourceIdsResult = validateMLBOfflineMultiCandidateSet(sourceIdsBase);
    expect(sourceIdsResult.ok).toBe(false);
    if (sourceIdsResult.ok) throw new Error('Expected invalid');
    expect(sourceRecommendationIdsFieldAccessorCount).toBe(0);

    let sourceRecommendationIdIndexAccessorCount = 0;
    const originalSourceIds = set.sourceRecommendationIds as unknown[];
    const sourceId0 = Object.defineProperty({ ...originalSourceIds[0] as Record<string, unknown> }, '0', {
      get() { sourceRecommendationIdIndexAccessorCount++; throw new Error('source ID index accessor'); },
    });
    const sourceIdArrayWithAccessor = [sourceId0, ...originalSourceIds.slice(1).map((id) => id as Record<string, unknown>)];
    const sourceIdArrayBase = Object.assign({}, set, { sourceRecommendationIds: sourceIdArrayWithAccessor });
    const sourceIdArrayResult = validateMLBOfflineMultiCandidateSet(sourceIdArrayBase);
    expect(sourceIdArrayResult.ok).toBe(false);
    if (sourceIdArrayResult.ok) throw new Error('Expected invalid');
    expect(sourceRecommendationIdIndexAccessorCount).toBe(0);

    let candidatesFieldAccessorCount = 0;
    const candidatesBase: Record<string, unknown> = { ...set };
    Object.defineProperty(candidatesBase, 'candidates', {
      get() { candidatesFieldAccessorCount++; throw new Error('candidates accessor'); },
    });
    const candidatesResult = validateMLBOfflineMultiCandidateSet(candidatesBase);
    expect(candidatesResult.ok).toBe(false);
    if (candidatesResult.ok) throw new Error('Expected invalid');
    expect(candidatesFieldAccessorCount).toBe(0);

    let candidateArrayIndexAccessorCount = 0;
    const originalCandidates = set.candidates as unknown[];
    const candidate0 = Object.defineProperty({ ...originalCandidates[0] as Record<string, unknown> }, '0', {
      get() { candidateArrayIndexAccessorCount++; throw new Error('candidate index accessor'); },
    });
    const candidateArrayWithAccessor = [candidate0, ...originalCandidates.slice(1).map((c) => c as Record<string, unknown>)];
    const candidateArrayBase = Object.assign({}, set, { candidates: candidateArrayWithAccessor });
    const candidateArrayResult = validateMLBOfflineMultiCandidateSet(candidateArrayBase);
    expect(candidateArrayResult.ok).toBe(false);
    if (candidateArrayResult.ok) throw new Error('Expected invalid');
    expect(candidateArrayIndexAccessorCount).toBe(0);

    let candidateFieldAccessorCount = 0;
    const candidateWithAccessor = Object.defineProperty({ ...originalCandidates[0] as Record<string, unknown> }, 'candidateId', {
      get() { candidateFieldAccessorCount++; throw new Error('candidate field accessor'); },
    });
    const candidateBase = Object.assign({}, set, { candidates: [candidateWithAccessor] });
    const candidateResult = validateMLBOfflineMultiCandidateSet(candidateBase);
    expect(candidateResult.ok).toBe(false);
    if (candidateResult.ok) throw new Error('Expected invalid');
    expect(candidateFieldAccessorCount).toBe(0);

    let legsFieldAccessorCount = 0;
    const originalLegs = set.candidates[0].legs as unknown[];
    const candidate0ForLegs = originalCandidates[0] as Record<string, unknown>;
    const legsArrayWithAccessor = [
      { ...originalLegs[0] as Record<string, unknown> },
      ...originalLegs.slice(1).map((l) => l as Record<string, unknown>),
    ];
    const candidateWithLegs = { ...candidate0ForLegs, legs: legsArrayWithAccessor };
    const legsBase = { ...set, candidates: [candidateWithLegs] } as Record<string, unknown>;
    Object.defineProperty((legsBase.candidates as unknown[])[0], 'legs', {
      get() { legsFieldAccessorCount++; throw new Error('legs field accessor'); },
    });
    const legsResult = validateMLBOfflineMultiCandidateSet(legsBase);
    expect(legsResult.ok).toBe(false);
    if (legsResult.ok) throw new Error('Expected invalid');
    expect(legsFieldAccessorCount).toBe(0);

    let legArrayIndexAccessorCount = 0;
    const leg0 = Object.defineProperty({ ...originalLegs[0] as Record<string, unknown> }, '0', {
      get() { legArrayIndexAccessorCount++; throw new Error('leg index accessor'); },
    });
    const legArrayWithAccessor = [leg0, ...originalLegs.slice(1).map((l) => l as Record<string, unknown>)];
    const legArrayBase = { ...set, candidates: [{ ...set.candidates[0] as Record<string, unknown>, legs: legArrayWithAccessor }] };
    const legArrayResult = validateMLBOfflineMultiCandidateSet(legArrayBase);
    expect(legArrayResult.ok).toBe(false);
    if (legArrayResult.ok) throw new Error('Expected invalid');
    expect(legArrayIndexAccessorCount).toBe(0);

    let legFieldAccessorCount = 0;
    const legWithAccessor = Object.defineProperty({ ...originalLegs[0] as Record<string, unknown> }, 'recommendationId', {
      get() { legFieldAccessorCount++; throw new Error('leg field accessor'); },
    });
    const legBase = { ...set, candidates: [{ ...set.candidates[0] as Record<string, unknown>, legs: [legWithAccessor, originalLegs[1]] }] };
    const legResult = validateMLBOfflineMultiCandidateSet(legBase);
    expect(legResult.ok).toBe(false);
    if (legResult.ok) throw new Error('Expected invalid');
    expect(legFieldAccessorCount).toBe(0);

    let probabilitiesFieldAccessorCount = 0;
    const probsBase: Record<string, unknown> = {
      ...set,
      candidates: [{
        ...set.candidates[0] as Record<string, unknown>,
        legs: [{
          ...originalLegs[0] as Record<string, unknown>,
          probabilities: { length: 2, homeWinProbability: 0.75, awayWinProbability: 0.25 },
        }],
      }],
    };
    const probsLegArray = (probsBase.candidates as unknown[])[0] as Record<string, unknown>;
    Object.defineProperty(probsLegArray.legs as unknown[], '0', {
      get() { probabilitiesFieldAccessorCount++; throw new Error('probabilities field accessor'); },
    });
    const probsResult = validateMLBOfflineMultiCandidateSet(probsBase);
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
    const probBase = { ...set, candidates: [{ ...set.candidates[0] as Record<string, unknown>, legs: [{
      ...originalLegs[0] as Record<string, unknown>,
      probabilities: probsWithProbAccessor,
    }] }] };
    const probResult = validateMLBOfflineMultiCandidateSet(probBase);
    expect(probResult.ok).toBe(false);
    if (probResult.ok) throw new Error('Expected invalid');
    expect(probabilityFieldAccessorCount).toBe(0);
  });

  it('maps an invalid Phase 8L recommendation set to one SOURCE_RECOMMENDATION_SET_INVALID issue without partial output or pre-validation access', () => {
    const invalidSource = { invalid: true };
    const result = buildMLBOfflineMultiCandidateSet(invalidSource);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.issues).toEqual([
      {
        code: 'SOURCE_RECOMMENDATION_SET_INVALID',
        path: '$.recommendationSet',
        message: 'Source recommendation set is invalid',
      },
    ]);
  });

  it('builds a valid empty candidate set from one validated recommendation', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const sourceSet = ensureValidRecommendationSet([rec1]);
    const result = buildMLBOfflineMultiCandidateSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    expect(result.value.candidateCount).toBe(0);
    expect(result.value.candidates).toHaveLength(0);
    expect(result.value.sourceRecommendationIds).toHaveLength(1);
  });

  it('builds one two-leg candidate from two validated recommendations', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      awayWinProbability: 0.75,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidRecommendationSet([rec1, rec2]);
    const result = buildMLBOfflineMultiCandidateSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    expect(result.value.candidateCount).toBe(1);
    expect(result.value.candidates).toHaveLength(1);
    expect(result.value.candidates[0].legCount).toBe(2);
    expect(result.value.candidates[0].legs).toHaveLength(2);
  });

  it('builds every unordered two-leg and three-leg combination exactly once', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({ snapshotId: 'snapshot-2', gameId: 'game-2' });
    const rec3 = buildRecommendation({ snapshotId: 'snapshot-3', gameId: 'game-3' });
    const sourceSet = ensureValidRecommendationSet([rec1, rec2, rec3]);
    const result = buildMLBOfflineMultiCandidateSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    expect(result.value.candidates).toHaveLength(4);

    let twoLegCount = 0;
    let threeLegCount = 0;
    for (const candidate of result.value.candidates) {
      if (candidate.legCount === 2) twoLegCount++;
      if (candidate.legCount === 3) threeLegCount++;
    }
    expect(twoLegCount).toBe(3);
    expect(threeLegCount).toBe(1);

    const comboKeys = new Set<string>();
    for (const candidate of result.value.candidates) {
      const key = candidate.legs
        .map((l) => l.recommendationId)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        .join('|');
      expect(comboKeys.has(key)).toBe(false);
      comboKeys.add(key);
    }
    expect(comboKeys.size).toBe(4);
  });

  it('preserves exact Phase 8L recommendation references inside newly constructed candidate leg arrays', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      awayWinProbability: 0.75,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidRecommendationSet([rec1, rec2]);
    const result = buildMLBOfflineMultiCandidateSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    expect(result.value.candidates[0].legs[0]).toBe(rec1);
    expect(result.value.candidates[0].legs[1]).toBe(rec2);
  });

  it('derives minimum confidence, mean confidence, and maximum uncertainty exactly', () => {
    const rec1 = buildRecommendation({
      snapshotId: 'snapshot-1',
      gameId: 'game-1',
      homeWinProbability: 0.875,
      awayWinProbability: 0.125,
    });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.625,
      awayWinProbability: 0.375,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const rec3 = buildRecommendation({
      snapshotId: 'snapshot-3',
      gameId: 'game-3',
      homeWinProbability: 0.75,
      awayWinProbability: 0.25,
      homeTeamId: 'team-home-3',
      awayTeamId: 'team-away-3',
    });
    const sourceSet = ensureValidRecommendationSet([rec1, rec2, rec3]);
    const result = buildMLBOfflineMultiCandidateSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');

    const twoLegCandidate = result.value.candidates.find(
      (c) => c.legs.length === 2 && c.legs.some((l) => l.gameId === 'game-1') && c.legs.some((l) => l.gameId === 'game-2'),
    );
    expect(twoLegCandidate).toBeDefined();
    if (!twoLegCandidate) throw new Error('Expected 2-leg candidate');
    expect(twoLegCandidate.minimumLegConfidence).toBe(0.625);
    expect(twoLegCandidate.meanLegConfidence).toBe(0.75);
    expect(twoLegCandidate.maximumLegUncertainty).toBe(0.375);

    const threeLegCandidate = result.value.candidates.find((c) => c.legs.length === 3);
    expect(threeLegCandidate).toBeDefined();
    if (!threeLegCandidate) throw new Error('Expected 3-leg candidate');
    expect(threeLegCandidate.minimumLegConfidence).toBe(0.625);
    expect(threeLegCandidate.meanLegConfidence).toBe(0.75);
    expect(threeLegCandidate.maximumLegUncertainty).toBe(0.375);
  });

  it('orders legs by game, snapshot, and inference identifiers using code-unit comparison', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-b', gameId: 'game-b' });
    const rec2 = buildRecommendation({ snapshotId: 'snapshot-a', gameId: 'game-a' });
    const rec3 = buildRecommendation({ snapshotId: 'snapshot-c', gameId: 'game-c' });
    const sourceSet = ensureValidRecommendationSet([rec1, rec2, rec3]);
    const result = buildMLBOfflineMultiCandidateSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    const candidate = result.value.candidates.find((c) => c.legs.length === 3);
    expect(candidate).toBeDefined();
    if (!candidate) throw new Error('Expected 3-leg candidate');
    expect(candidate.legs.map((l) => l.gameId)).toEqual(['game-a', 'game-b', 'game-c']);
    expect(candidate.legs.map((l) => l.snapshotId)).toEqual(['snapshot-a', 'snapshot-b', 'snapshot-c']);
    expect(candidate.legs.map((l) => l.inferenceId)).toEqual([
      'release-1::snapshot-a::offline-pregame-inference-v1',
      'release-1::snapshot-b::offline-pregame-inference-v1',
      'release-1::snapshot-c::offline-pregame-inference-v1',
    ]);

    const noncanonicalCandidate = {
      ...candidate,
      legs: [candidate.legs[1], candidate.legs[0]],
    };
    const noncanonicalSet = {
      ...result.value,
      candidates: [noncanonicalCandidate],
    };
    const noncanonicalResult = validateMLBOfflineMultiCandidateSet(noncanonicalSet);
    expect(noncanonicalResult.ok).toBe(false);
    if (noncanonicalResult.ok) throw new Error('Expected failure');
    expect(noncanonicalResult.issues).toEqual([
      { code: 'ORDER_MISMATCH', path: '$.candidates[0].legs', message: 'Legs must be in canonical order' },
    ]);
  });

  it('orders candidates by minimum confidence, mean confidence, leg count, and candidate ID', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-a', gameId: 'game-a', homeWinProbability: 0.875, awayWinProbability: 0.125 });
    const rec2 = buildRecommendation({ snapshotId: 'snapshot-b', gameId: 'game-b', homeWinProbability: 0.75, awayWinProbability: 0.25 });
    const rec3 = buildRecommendation({ snapshotId: 'snapshot-c', gameId: 'game-c', homeWinProbability: 0.625, awayWinProbability: 0.375, homeTeamId: 'team-home-3', awayTeamId: 'team-away-3' });
    const rec4 = buildRecommendation({ snapshotId: 'snapshot-d', gameId: 'game-d', homeWinProbability: 0.625, awayWinProbability: 0.375, homeTeamId: 'team-home-4', awayTeamId: 'team-away-4' });
    const sourceSet = ensureValidRecommendationSet([rec1, rec2, rec3, rec4]);
    const result = buildMLBOfflineMultiCandidateSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    const manualOrder = [...result.value.candidates].sort((a, b) => {
      if (a.minimumLegConfidence > b.minimumLegConfidence) return -1;
      if (a.minimumLegConfidence < b.minimumLegConfidence) return 1;
      if (a.meanLegConfidence > b.meanLegConfidence) return -1;
      if (a.meanLegConfidence < b.meanLegConfidence) return 1;
      if (a.legCount < b.legCount) return -1;
      if (a.legCount > b.legCount) return 1;
      if (a.candidateId < b.candidateId) return -1;
      if (a.candidateId > b.candidateId) return 1;
      return 0;
    });
    expect(result.value.candidates).toEqual(manualOrder);
  });

  it('rejects duplicate source recommendation IDs and noncanonical source-ID order', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({ snapshotId: 'snapshot-2', gameId: 'game-2' });
    const sourceSet = ensureValidRecommendationSet([rec1, rec2]);
    const validResult = buildMLBOfflineMultiCandidateSet(sourceSet);
    expect(validResult.ok).toBe(true);
    if (!validResult.ok) throw new Error('Expected successful build');
    const validSet = validResult.value;

    const duplicateIdSet = {
      ...validSet,
      sourceRecommendationIds: [validSet.sourceRecommendationIds[0], validSet.sourceRecommendationIds[0]],
      sourceRecommendationCount: 2,
    };
    const duplicateIdResult = validateMLBOfflineMultiCandidateSet(duplicateIdSet);
    expect(duplicateIdResult.ok).toBe(false);
    if (duplicateIdResult.ok) throw new Error('Expected failure');
    const duplicateIdIssues = duplicateIdResult.issues;
    expect(duplicateIdIssues).toEqual([
      {
        code: 'DUPLICATE_SOURCE_RECOMMENDATION_ID',
        path: '$.sourceRecommendationIds[1]',
        message: `Duplicate source recommendationId: ${validSet.sourceRecommendationIds[0]}`,
      },
    ]);

    const noncanonicalOrderSet = {
      ...validSet,
      sourceRecommendationIds: [validSet.sourceRecommendationIds[1], validSet.sourceRecommendationIds[0]],
      sourceRecommendationCount: 2,
    };
    const noncanonicalResult = validateMLBOfflineMultiCandidateSet(noncanonicalOrderSet);
    expect(noncanonicalResult.ok).toBe(false);
    if (noncanonicalResult.ok) throw new Error('Expected failure');
    expect(noncanonicalResult.issues).toEqual([
      {
        code: 'ORDER_MISMATCH',
        path: '$.sourceRecommendationIds',
        message: 'sourceRecommendationIds must be in canonical order',
      },
    ]);
  });

  it('proves duplicate candidate combination collapses to the locked duplicate candidate identity', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({ snapshotId: 'snapshot-2', gameId: 'game-2' });
    const rec3 = buildRecommendation({ snapshotId: 'snapshot-3', gameId: 'game-3' });
    const sourceSet = ensureValidRecommendationSet([rec1, rec2, rec3]);
    const validResult = buildMLBOfflineMultiCandidateSet(sourceSet);
    expect(validResult.ok).toBe(true);
    if (!validResult.ok) throw new Error('Expected successful build');
    const validSet = validResult.value;

    const duplicateIdCandidate = { ...validSet.candidates[0] };
    const duplicateIdSet = {
      ...validSet,
      candidates: [validSet.candidates[0], { ...duplicateIdCandidate, candidateId: validSet.candidates[0].candidateId }],
    };
    const duplicateIdResult = validateMLBOfflineMultiCandidateSet(duplicateIdSet);
    expect(duplicateIdResult.ok).toBe(false);
    if (duplicateIdResult.ok) throw new Error('Expected failure');
    expect(duplicateIdResult.issues).toEqual([
      {
        code: 'DUPLICATE_CANDIDATE_ID',
        path: '$.candidates[1].candidateId',
        message: `Duplicate candidateId: ${validSet.candidates[0].candidateId}`,
      },
    ]);

    const duplicateComboCandidate = {
      ...validSet.candidates[0],
      candidateId: validSet.candidates[0].candidateId,
      legs: [validSet.candidates[0].legs[0], validSet.candidates[0].legs[1]],
    };
    const duplicateComboSet = {
      ...validSet,
      candidates: [validSet.candidates[0], duplicateComboCandidate],
    };
    const duplicateComboResult = validateMLBOfflineMultiCandidateSet(duplicateComboSet);
    expect(duplicateComboResult.ok).toBe(false);
    if (duplicateComboResult.ok) throw new Error('Expected failure');
    expect(duplicateComboResult.issues).toEqual([
      {
        code: 'DUPLICATE_CANDIDATE_ID',
        path: '$.candidates[1].candidateId',
        message: `Duplicate candidateId: ${validSet.candidates[0].candidateId}`,
      },
    ]);
  });

  it('rejects duplicate leg recommendation IDs and duplicate leg game IDs inside one candidate', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({ snapshotId: 'snapshot-2', gameId: 'game-2' });
    const rec3 = buildRecommendation({ snapshotId: 'snapshot-3', gameId: 'game-3' });
    const sourceSet = ensureValidRecommendationSet([rec1, rec2, rec3]);
    const validResult = buildMLBOfflineMultiCandidateSet(sourceSet);
    expect(validResult.ok).toBe(true);
    if (!validResult.ok) throw new Error('Expected successful build');
    const validSet = validResult.value;

    const duplicateRecIdCandidate = {
      ...validSet.candidates[0],
      legs: [validSet.candidates[0].legs[0], validSet.candidates[0].legs[0]],
    };
    const duplicateRecIdSet = {
      ...validSet,
      candidates: [duplicateRecIdCandidate],
    };
    const duplicateRecIdResult = validateMLBOfflineMultiCandidateSet(duplicateRecIdSet);
    expect(duplicateRecIdResult.ok).toBe(false);
    if (duplicateRecIdResult.ok) throw new Error('Expected failure');
    expect(duplicateRecIdResult.issues).toEqual([
      {
        code: 'DUPLICATE_LEG_RECOMMENDATION_ID',
        path: '$.candidates[0].legs[1].recommendationId',
        message: `Duplicate leg recommendationId: ${validSet.candidates[0].legs[0].recommendationId}`,
      },
    ]);

    const legA = validSet.candidates[0].legs[0];
    const legB = validSet.candidates[0].legs[1];
    const duplicateGameIdLegB = { ...legB, gameId: legA.gameId };
    const duplicateGameIdCandidate = {
      ...validSet.candidates[0],
      legs: [legA, duplicateGameIdLegB],
    };
    const duplicateGameIdSet = {
      ...validSet,
      candidates: [duplicateGameIdCandidate],
    };
    const duplicateGameIdResult = validateMLBOfflineMultiCandidateSet(duplicateGameIdSet);
    expect(duplicateGameIdResult.ok).toBe(false);
    if (duplicateGameIdResult.ok) throw new Error('Expected failure');
    expect(duplicateGameIdResult.issues).toEqual([
      {
        code: 'DUPLICATE_LEG_GAME_ID',
        path: '$.candidates[0].legs[1].gameId',
        message: `Duplicate leg gameId: ${legA.gameId}`,
      },
    ]);
  });

  it('rejects candidate ID, leg count, confidence summary, candidate count, and candidate-set ID mismatches deterministically', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      awayWinProbability: 0.75,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidRecommendationSet([rec1, rec2]);
    const validResult = buildMLBOfflineMultiCandidateSet(sourceSet);
    expect(validResult.ok).toBe(true);
    if (!validResult.ok) throw new Error('Expected successful build');
    const validSet = validResult.value;

    const candidateIdMismatch = {
      ...validSet,
      candidates: [{ ...validSet.candidates[0], candidateId: 'bad-id' }],
    };
    const candidateIdResult = validateMLBOfflineMultiCandidateSet(candidateIdMismatch);
    expect(candidateIdResult.ok).toBe(false);
    if (candidateIdResult.ok) throw new Error('Expected failure');
    expect(candidateIdResult.issues).toEqual([
      { code: 'CANDIDATE_ID_MISMATCH', path: '$.candidates[0].candidateId', message: 'candidateId does not match the deterministic formula' },
    ]);

    const legCountMismatch = {
      ...validSet,
      candidates: [{ ...validSet.candidates[0], legCount: 3 }],
    };
    const legCountResult = validateMLBOfflineMultiCandidateSet(legCountMismatch);
    expect(legCountResult.ok).toBe(false);
    if (legCountResult.ok) throw new Error('Expected failure');
    expect(legCountResult.issues).toEqual([
      { code: 'LEG_COUNT_MISMATCH', path: '$.candidates[0].legCount', message: 'legCount must equal legs.length' },
    ]);

    const minConfidenceMismatch = {
      ...validSet,
      candidates: [{ ...validSet.candidates[0], minimumLegConfidence: 0.99 }],
    };
    const minConfidenceResult = validateMLBOfflineMultiCandidateSet(minConfidenceMismatch);
    expect(minConfidenceResult.ok).toBe(false);
    if (minConfidenceResult.ok) throw new Error('Expected failure');
    expect(minConfidenceResult.issues).toEqual([
      { code: 'MINIMUM_CONFIDENCE_MISMATCH', path: '$.candidates[0].minimumLegConfidence', message: 'minimumLegConfidence does not match the minimum leg confidence' },
    ]);

    const meanConfidenceMismatch = {
      ...validSet,
      candidates: [{ ...validSet.candidates[0], meanLegConfidence: 0.99 }],
    };
    const meanConfidenceResult = validateMLBOfflineMultiCandidateSet(meanConfidenceMismatch);
    expect(meanConfidenceResult.ok).toBe(false);
    if (meanConfidenceResult.ok) throw new Error('Expected failure');
    expect(meanConfidenceResult.issues).toEqual([
      { code: 'MEAN_CONFIDENCE_MISMATCH', path: '$.candidates[0].meanLegConfidence', message: 'meanLegConfidence does not match the arithmetic mean of leg confidences' },
    ]);

    const maxUncertaintyMismatch = {
      ...validSet,
      candidates: [{ ...validSet.candidates[0], maximumLegUncertainty: 0.99 }],
    };
    const maxUncertaintyResult = validateMLBOfflineMultiCandidateSet(maxUncertaintyMismatch);
    expect(maxUncertaintyResult.ok).toBe(false);
    if (maxUncertaintyResult.ok) throw new Error('Expected failure');
    expect(maxUncertaintyResult.issues).toEqual([
      { code: 'MAXIMUM_UNCERTAINTY_MISMATCH', path: '$.candidates[0].maximumLegUncertainty', message: 'maximumLegUncertainty does not match the maximum leg uncertainty' },
    ]);

    const candidateCountMismatch = {
      ...validSet,
      candidateCount: validSet.candidateCount + 1,
    };
    const candidateCountResult = validateMLBOfflineMultiCandidateSet(candidateCountMismatch);
    expect(candidateCountResult.ok).toBe(false);
    if (candidateCountResult.ok) throw new Error('Expected failure');
    expect(candidateCountResult.issues).toEqual([
      { code: 'CANDIDATE_COUNT_MISMATCH', path: '$.candidateCount', message: 'candidateCount must equal candidates.length and the required formula' },
    ]);

    const candidateSetIdMismatch = {
      ...validSet,
      candidateSetId: 'bad-id',
    };
    const candidateSetIdResult = validateMLBOfflineMultiCandidateSet(candidateSetIdMismatch);
    expect(candidateSetIdResult.ok).toBe(false);
    if (candidateSetIdResult.ok) throw new Error('Expected failure');
    expect(candidateSetIdResult.issues).toEqual([
      { code: 'CANDIDATE_SET_ID_MISMATCH', path: '$.candidateSetId', message: 'candidateSetId does not match the deterministic formula' },
    ]);
  });

  it('proves exact candidate completeness for one through five source recommendations', () => {
    const counts = [1, 2, 3, 4, 5];
    for (const count of counts) {
      const recommendations = Array.from({ length: count }, (_, i) => {
        const idx = String(i + 1).padStart(2, '0');
        return buildRecommendation({
          snapshotId: `snapshot-${idx}`,
          gameId: `game-${idx}`,
          homeWinProbability: 0.5 + (i * 0.125),
            awayWinProbability: 0.5 - (i * 0.125),
        });
      });
      const sourceSet = ensureValidRecommendationSet(recommendations);
      const result = buildMLBOfflineMultiCandidateSet(sourceSet);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected successful build');
      const expectedTwoLeg = (count * (count - 1)) / 2;
      const expectedThreeLeg = (count * (count - 1) * (count - 2)) / 6;
      const expectedTotal = expectedTwoLeg + expectedThreeLeg;
      expect(result.value.candidateCount).toBe(expectedTotal);
      expect(result.value.candidates).toHaveLength(expectedTotal);

      const recIds = recommendations.map((r) => r.recommendationId as string);
      const expectedKeys = new Set<string>();
      for (let i = 0; i < recIds.length; i++) {
        for (let j = i + 1; j < recIds.length; j++) {
          const ids = [recIds[i], recIds[j]].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
          expectedKeys.add(ids.join('|'));
        }
      }
      for (let i = 0; i < recIds.length; i++) {
        for (let j = i + 1; j < recIds.length; j++) {
          for (let k = j + 1; k < recIds.length; k++) {
            const ids = [recIds[i], recIds[j], recIds[k]].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
            expectedKeys.add(ids.join('|'));
          }
        }
      }

      const actualKeys = new Set<string>();
      for (const candidate of result.value.candidates) {
        const ids = candidate.legs
          .map((l) => l.recommendationId)
          .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        const key = ids.join('|');
        expect(actualKeys.has(key)).toBe(false);
        actualKeys.add(key);
      }
      expect(actualKeys.size).toBe(expectedKeys.size);
      for (const key of expectedKeys) {
        expect(actualKeys.has(key)).toBe(true);
      }
    }
  });

  it('produces deeply deterministic output without mutating the source recommendation set, recommendations, or probabilities', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-a', gameId: 'game-a', homeWinProbability: 0.875, awayWinProbability: 0.125 });
    const rec2 = buildRecommendation({ snapshotId: 'snapshot-b', gameId: 'game-b', homeWinProbability: 0.625, awayWinProbability: 0.375 });
    const rec3 = buildRecommendation({ snapshotId: 'snapshot-c', gameId: 'game-c', homeWinProbability: 0.5, awayWinProbability: 0.5 });
    const sourceSet = ensureValidRecommendationSet([rec1, rec2, rec3]);

    const sourceRootNames = Object.getOwnPropertyNames(sourceSet);
    const sourceRootSymbols = Object.getOwnPropertySymbols(sourceSet);
    const sourceRecommendationsReference = sourceSet.recommendations;
    const sourceRecommendationOrder = (sourceSet.recommendations as unknown[]).map((r) => (r as Record<string, unknown>).recommendationId);

    function captureRecommendationState(rec: Record<string, unknown>) {
      const scalarEntries: Array<[string, unknown]> = [];
      for (const key of Object.getOwnPropertyNames(rec)) {
        const descriptor = Object.getOwnPropertyDescriptor(rec, key);
        if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
          scalarEntries.push([key, descriptor.value]);
        }
      }
      const probabilitiesDescriptor = Object.getOwnPropertyDescriptor(rec, 'probabilities');
      const probabilitiesReference =
        probabilitiesDescriptor && Object.prototype.hasOwnProperty.call(probabilitiesDescriptor, 'value')
          ? probabilitiesDescriptor.value as Record<string, unknown>
          : {};
      return {
        rootNames: Object.getOwnPropertyNames(rec),
        rootSymbols: Object.getOwnPropertySymbols(rec),
        scalarEntries,
        probabilitiesReference,
        homeWinProbability: probabilitiesReference.homeWinProbability,
        awayWinProbability: probabilitiesReference.awayWinProbability,
        probabilityNames: Object.getOwnPropertyNames(probabilitiesReference),
        probabilitySymbols: Object.getOwnPropertySymbols(probabilitiesReference),
      };
    }

    const recommendationStates = (sourceSet.recommendations as unknown[]).map((rec) => captureRecommendationState(rec as Record<string, unknown>));
    const sourceProbabilitiesReferences = (sourceSet.recommendations as unknown[]).map((rec) => {
      const descriptor = Object.getOwnPropertyDescriptor(rec as Record<string, unknown>, 'probabilities');
      return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
        ? descriptor.value as Record<string, unknown>
        : {};
    });
    const copiedHomeProbs = (sourceSet.recommendations as unknown[]).map((rec) => {
      const probs = (rec as Record<string, unknown>).probabilities as Record<string, unknown>;
      return probs.homeWinProbability;
    });
    const copiedAwayProbs = (sourceSet.recommendations as unknown[]).map((rec) => {
      const probs = (rec as Record<string, unknown>).probabilities as Record<string, unknown>;
      return probs.awayWinProbability;
    });

    const first = buildMLBOfflineMultiCandidateSet(sourceSet);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('Expected successful build');

    const second = buildMLBOfflineMultiCandidateSet(sourceSet);
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error('Expected successful build');

    expect(second.value).not.toBe(first.value);
    expect(second.value.sourceRecommendationIds).not.toBe(first.value.sourceRecommendationIds);
    expect(second.value.candidates).not.toBe(first.value.candidates);
    for (let i = 0; i < second.value.candidates.length; i++) {
      expect(second.value.candidates[i]).not.toBe(first.value.candidates[i]);
      expect(second.value.candidates[i].legs).not.toBe(first.value.candidates[i].legs);
    }

    expect(Object.getOwnPropertyNames(sourceSet)).toEqual(sourceRootNames);
    expect(Object.getOwnPropertySymbols(sourceSet)).toEqual(sourceRootSymbols);
    expect(sourceSet.recommendations).toBe(sourceRecommendationsReference);
    expect((sourceSet.recommendations as unknown[]).map((r) => (r as Record<string, unknown>).recommendationId)).toEqual(sourceRecommendationOrder);
    for (let i = 0; i < (sourceSet.recommendations as unknown[]).length; i++) {
      const rec = (sourceSet.recommendations as unknown[])[i] as Record<string, unknown>;
      const state = recommendationStates[i];
      expect(Object.getOwnPropertyNames(rec)).toEqual(state.rootNames);
      expect(Object.getOwnPropertySymbols(rec)).toEqual(state.rootSymbols);
      for (const [key, value] of state.scalarEntries) {
        expect(rec[key]).toBe(value);
      }
      const probsDescriptor = Object.getOwnPropertyDescriptor(rec, 'probabilities');
      expect(probsDescriptor).toBeDefined();
      expect(Object.prototype.hasOwnProperty.call(probsDescriptor!, 'value')).toBe(true);
      expect(probsDescriptor!.value).toBe(state.probabilitiesReference);
      expect(Object.getOwnPropertyNames(rec.probabilities as Record<string, unknown>)).toEqual(state.probabilityNames);
      expect(Object.getOwnPropertySymbols(rec.probabilities as Record<string, unknown>)).toEqual(state.probabilitySymbols);
      expect((rec.probabilities as Record<string, unknown>).homeWinProbability).toBe(state.homeWinProbability);
      expect((rec.probabilities as Record<string, unknown>).awayWinProbability).toBe(state.awayWinProbability);
    }
    expect(sourceProbabilitiesReferences.map((p) => p.homeWinProbability)).toEqual(copiedHomeProbs);
    expect(sourceProbabilitiesReferences.map((p) => p.awayWinProbability)).toEqual(copiedAwayProbs);

    expect(first.value).toEqual(second.value);
  });

  it('rejects odds contamination, sportsbook and market concepts, staking, grading, and prohibited fields while allowing phase-owned candidate vocabulary', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      awayWinProbability: 0.75,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidRecommendationSet([rec1, rec2]);
    const validResult = buildMLBOfflineMultiCandidateSet(sourceSet);
    expect(validResult.ok).toBe(true);
    if (!validResult.ok) throw new Error('Expected successful build');
    const validSet = validResult.value;

    const validatedValidSet = validateMLBOfflineMultiCandidateSet(validSet);
    expect(validatedValidSet.ok).toBe(true);
    if (!validatedValidSet.ok) throw new Error('Expected successful validation');
    expect(validatedValidSet.value).toBe(validSet);

    const forbiddenKeys = [
      'sportsbook',
      'odds',
      'price',
      'line',
      'market',
      'edge',
      'value',
      'payout',
      'stake',
      'grade',
      'feature',
      'missing',
      'coefficient',
      'intercept',
      'rawScore',
      'metric',
      'label',
      'row',
    ];
    function hasProhibitedKey(obj: unknown): boolean {
      if (typeof obj !== 'object' || obj === null) return false;
      for (const key of Object.getOwnPropertyNames(obj)) {
        if (forbiddenKeys.includes(key)) return true;
        const value = (obj as Record<string, unknown>)[key];
        if (hasProhibitedKey(value)) return true;
      }
      return false;
    }
    expect(hasProhibitedKey(validSet)).toBe(false);

    const sportsbookSet = { ...validSet, sportsbook: 0 } as Record<string, unknown>;
    const sportsbookResult = validateMLBOfflineMultiCandidateSet(sportsbookSet);
    expect(sportsbookResult.ok).toBe(false);
    if (sportsbookResult.ok) throw new Error('Expected failure');
    expect(sportsbookResult.issues).toEqual([
      { code: 'ODDS_CONTAMINATION', path: '$', message: 'Odds contamination detected' },
    ]);

    const oddsSet = { ...validSet, odds: 0 } as Record<string, unknown>;
    const oddsResult = validateMLBOfflineMultiCandidateSet(oddsSet);
    expect(oddsResult.ok).toBe(false);
    if (oddsResult.ok) throw new Error('Expected failure');
    expect(oddsResult.issues).toEqual([
      { code: 'ODDS_CONTAMINATION', path: '$', message: 'Odds contamination detected' },
    ]);

    const priceSet = { ...validSet, price: 0 } as Record<string, unknown>;
    const priceResult = validateMLBOfflineMultiCandidateSet(priceSet);
    expect(priceResult.ok).toBe(false);
    if (priceResult.ok) throw new Error('Expected failure');
    expect(priceResult.issues).toEqual([
      { code: 'ODDS_CONTAMINATION', path: '$', message: 'Odds contamination detected' },
    ]);

    const lineSet = { ...validSet, line: 0 } as Record<string, unknown>;
    const lineResult = validateMLBOfflineMultiCandidateSet(lineSet);
    expect(lineResult.ok).toBe(false);
    if (lineResult.ok) throw new Error('Expected failure');
    expect(lineResult.issues).toEqual([
      { code: 'ODDS_CONTAMINATION', path: '$', message: 'Odds contamination detected' },
    ]);

    const marketSet = { ...validSet, market: 0 } as Record<string, unknown>;
    const marketResult = validateMLBOfflineMultiCandidateSet(marketSet);
    expect(marketResult.ok).toBe(false);
    if (marketResult.ok) throw new Error('Expected failure');
    expect(marketResult.issues).toEqual([
      { code: 'ODDS_CONTAMINATION', path: '$', message: 'Odds contamination detected' },
    ]);

    const edgeSet = { ...validSet, edge: 0 } as Record<string, unknown>;
    const edgeResult = validateMLBOfflineMultiCandidateSet(edgeSet);
    expect(edgeResult.ok).toBe(false);
    if (edgeResult.ok) throw new Error('Expected failure');
    expect(edgeResult.issues).toEqual([
      { code: 'ODDS_CONTAMINATION', path: '$', message: 'Odds contamination detected' },
    ]);

    const valueSet = { ...validSet, value: 0 } as Record<string, unknown>;
    const valueResult = validateMLBOfflineMultiCandidateSet(valueSet);
    expect(valueResult.ok).toBe(false);
    if (valueResult.ok) throw new Error('Expected failure');
    expect(valueResult.issues).toEqual([
      { code: 'ODDS_CONTAMINATION', path: '$', message: 'Odds contamination detected' },
    ]);

    const stakeSet = { ...validSet, stake: 0 } as Record<string, unknown>;
    const stakeResult = validateMLBOfflineMultiCandidateSet(stakeSet);
    expect(stakeResult.ok).toBe(false);
    if (stakeResult.ok) throw new Error('Expected failure');
    expect(stakeResult.issues).toEqual([
      { code: 'PROHIBITED_CONCEPT', path: '$.stake', message: 'Prohibited field: stake' },
    ]);

    const gradeSet = { ...validSet, grade: 0 } as Record<string, unknown>;
    const gradeResult = validateMLBOfflineMultiCandidateSet(gradeSet);
    expect(gradeResult.ok).toBe(false);
    if (gradeResult.ok) throw new Error('Expected failure');
    expect(gradeResult.issues).toEqual([
      { code: 'PROHIBITED_CONCEPT', path: '$.grade', message: 'Prohibited field: grade' },
    ]);

    const candidateOwnedSet = { ...validSet, candidate: 'x' } as Record<string, unknown>;
    const candidateOwnedResult = validateMLBOfflineMultiCandidateSet(candidateOwnedSet);
    expect(candidateOwnedResult.ok).toBe(false);
    if (candidateOwnedResult.ok) throw new Error('Expected failure');
    expect(candidateOwnedResult.issues).toEqual([
      { code: 'UNKNOWN_FIELD', path: '$.candidate', message: 'Unknown field: candidate' },
    ]);
  });

  it('verifies deterministic issue ordering, exact exports and imports, no live inference, no recommendation rebuilding, no staking, no routes, no UI, and the static architecture boundary', async () => {
    const source = await readFile(new URL('../../../src/prediction/mlb/mlb-offline-multi-candidate-contract.ts', import.meta.url), 'utf-8');

    const expectedExports = Array.from(source.matchAll(/\bexport\s+(?:const|type|function)\s+([A-Za-z0-9_]+)/g)).map((match) => match[1]);
    expect(expectedExports).toEqual([
      'MLB_OFFLINE_MULTI_CANDIDATE_SET_CONTRACT_VERSION',
      'MLB_OFFLINE_MULTI_CANDIDATE_POLICY',
      'MLB_OFFLINE_MULTI_CANDIDATE_ORDER_POLICY',
      'MLBOfflineMultiCandidateLeg',
      'MLBOfflineMultiCandidate',
      'MLBOfflineMultiCandidateSet',
      'MLBOfflineMultiCandidateSetIssue',
      'validateMLBOfflineMultiCandidateSet',
      'buildMLBOfflineMultiCandidateSet',
    ]);

    const expectedImports = Array.from(source.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)).map((match) => match[1]);
    expect(expectedImports).toEqual([
      '../firewall/odds-contamination-guard',
      './mlb-offline-single-pick-recommendation-contract',
    ]);

    expect(source).toContain('validateMLBOfflineMultiCandidateSet(');
    expect(source).toContain('buildMLBOfflineMultiCandidateSet(');
    expect(source).toContain('assertNoOddsContamination(');

    expect(source).not.toMatch(/\bexport\s+(?:enum|interface)\s+/);
    expect(source).not.toMatch(/from\s+['"]node:fs/);
    expect(source).not.toMatch(/fetch\s*\(/);
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/Date\.now/);
    expect(source).not.toMatch(/randomUUID/);
    expect(source).not.toMatch(/process\.env/);
    const forbiddenProcessDotEnv = 'process.env';
    expect(source).not.toMatch(/localeCompare/);
    expect(source).not.toMatch(/\binferMLBOfflinePregameWinner\s*\(/);
    expect(source).not.toMatch(/\bbuildMLBOfflinePredictionSlate\s*\(/);
    expect(source).not.toMatch(/\bvalidateMLBOfflinePredictionSlate\s*\(/);
    expect(source).not.toMatch(/\bbuildMLBOfflinePregameInference\s*\(/);
    expect(source).not.toMatch(/\bvalidateMLBOfflinePregameInference\s*\(/);
    expect(source).not.toMatch(/buildMLBOfflineSinglePickRecommendationSet\s*\(/);
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

    const testSource = await readFile(new URL('../../../tests/prediction/mlb/mlb-offline-multi-candidate-contract.test.ts', import.meta.url), 'utf-8');
    const testCount = (testSource.match(/\bit\s*\(/g) || []).length;
    expect(testCount).toBe(20);

    expect(testSource).not.toMatch(/\b(?:it|test)\s*\.\s*each\s*\(/);

    const testImports = Array.from(testSource.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)).map((match) => match[1]);
    const allowedTestImports = [
      'vitest',
      '@/prediction/mlb/mlb-offline-multi-candidate-contract',
      '@/prediction/mlb/mlb-offline-single-pick-recommendation-contract',
      'node:fs/promises',
    ];
    for (const importPath of testImports) {
      expect(allowedTestImports).toContain(importPath);
    }

  });
});
