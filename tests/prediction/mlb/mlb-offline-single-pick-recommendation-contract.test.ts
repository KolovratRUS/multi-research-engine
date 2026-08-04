import { describe, expect, it } from 'vitest';
import {
  buildMLBOfflinePredictionSlate,
  validateMLBOfflinePredictionSlate,
} from '@/prediction/mlb/mlb-offline-prediction-slate-contract';
import {
  MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_ORDER_POLICY,
  MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_POLICY,
  MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_SET_CONTRACT_VERSION,
  buildMLBOfflineSinglePickRecommendationSet,
  validateMLBOfflineSinglePickRecommendationSet,
} from '@/prediction/mlb/mlb-offline-single-pick-recommendation-contract';
import { readFile } from 'node:fs/promises';

const BASE_RELEASE_ID = 'release-1';
const BASE_MODEL_ID = 'model-1';
const BASE_PLAN_ID = 'plan-1';
const BASE_MATRIX_ID = 'matrix-1';
const BASE_CONFIG_ID = 'config-1';
const BASE_MANIFEST_ID = 'manifest-1';
const BASE_SNAPSHOT_ID = 'snapshot-1';
const BASE_GAME_ID = 'game-1';
const BASE_OFFICIAL_DATE = '2026-08-01';
const BASE_DATA_CUTOFF = '2026-07-30T09:00:00Z';

interface PredictionOptions {
  releaseId?: string;
  snapshotId?: string;
  inferenceId?: string;
  gameId?: string;
  officialDate?: string;
  dataCutoffAt?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  modelId?: string;
  planId?: string;
  matrixId?: string;
  configId?: string;
  manifestId?: string;
  probabilities?: { homeWinProbability: number; awayWinProbability: number };
  predictedSide?: 'HOME' | 'AWAY';
  predictedTeamId?: string;
}

function buildValidPrediction(
  overrides: PredictionOptions = {},
): Record<string, unknown> {
  const releaseId = overrides.releaseId ?? BASE_RELEASE_ID;
  const snapshotId = overrides.snapshotId ?? BASE_SNAPSHOT_ID;
  const inferenceId =
    overrides.inferenceId ??
    `${releaseId}::${snapshotId}::offline-pregame-inference-v1`;
  const predictedSide = overrides.predictedSide ?? 'HOME';
  const probabilities = overrides.probabilities ?? {
    homeWinProbability: 0.75,
    awayWinProbability: 0.25,
  };

  const prediction: Record<string, unknown> = {
    contractVersion: 'mlb-offline-pregame-inference-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    inferenceId,
    releaseId,
    modelId: overrides.modelId ?? BASE_MODEL_ID,
    planId: overrides.planId ?? BASE_PLAN_ID,
    matrixId: overrides.matrixId ?? BASE_MATRIX_ID,
    configId: overrides.configId ?? BASE_CONFIG_ID,
    manifestId: overrides.manifestId ?? BASE_MANIFEST_ID,
    snapshotId,
    gameId: overrides.gameId ?? BASE_GAME_ID,
    officialDate: overrides.officialDate ?? BASE_OFFICIAL_DATE,
    dataCutoffAt: overrides.dataCutoffAt ?? BASE_DATA_CUTOFF,
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    decisionPolicy: 'HOME_AT_OR_ABOVE_0_5_V1',
    homeTeamId: overrides.homeTeamId ?? 'team-home-1',
    awayTeamId: overrides.awayTeamId ?? 'team-away-1',
    probabilities,
    predictedSide,
    predictedTeamId:
      overrides.predictedTeamId ??
      (predictedSide === 'AWAY' ? 'team-away-1' : 'team-home-1'),
  };

  return prediction;
}

function buildValidSourceSlate(
  predictions: readonly Record<string, unknown>[],
): Record<string, unknown> {
  const result = buildMLBOfflinePredictionSlate(predictions);
  if (!result.ok) {
    const issueMessages = result.issues.map((issue) => `${issue.code}:${issue.path}`).join(', ');
    throw new Error(`Invalid source slate: ${issueMessages}`);
  }
  return result.value;
}

function ensureValidSourceSlate(
  predictions: readonly Record<string, unknown>[],
): Record<string, unknown> {
  const slate = buildValidSourceSlate(predictions);
  const validation = validateMLBOfflinePredictionSlate(slate);
  if (!validation.ok) {
    const issueMessages = validation.issues.map((issue) => `${issue.code}:${issue.path}`).join(', ');
    throw new Error(`Source slate failed validation: ${issueMessages}`);
  }
  return slate;
}

function buildValidRecommendation(
  prediction: Record<string, unknown>,
): Record<string, unknown> {
  const inferenceId = prediction.inferenceId as string;
  const snapshotId = prediction.snapshotId as string;
  const gameId = prediction.gameId as string;
  const officialDate = prediction.officialDate as string;
  const dataCutoffAt = prediction.dataCutoffAt as string;
  const homeTeamId = prediction.homeTeamId as string;
  const awayTeamId = prediction.awayTeamId as string;
  const predictedSide = prediction.predictedSide as 'HOME' | 'AWAY';
  const predictedTeamId = prediction.predictedTeamId as string;
  const probabilities = prediction.probabilities as { homeWinProbability: number; awayWinProbability: number };

  const recommendationId = `${inferenceId}::offline-single-pick-recommendation-v1`;

  let modelConfidence: number;
  let modelUncertainty: number;
  if (predictedSide === 'HOME') {
    modelConfidence = probabilities.homeWinProbability;
    modelUncertainty = probabilities.awayWinProbability;
  } else {
    modelConfidence = probabilities.awayWinProbability;
    modelUncertainty = probabilities.homeWinProbability;
  }

  return {
    recommendationId,
    inferenceId,
    snapshotId,
    gameId,
    officialDate,
    dataCutoffAt,
    homeTeamId,
    awayTeamId,
    recommendedSide: predictedSide,
    recommendedTeamId: predictedTeamId,
    probabilities: {
      homeWinProbability: probabilities.homeWinProbability,
      awayWinProbability: probabilities.awayWinProbability,
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

  const base: Record<string, unknown> = {
    contractVersion: MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_SET_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    recommendationSetId,
    slateId,
    releaseId: BASE_RELEASE_ID,
    modelId: BASE_MODEL_ID,
    planId: BASE_PLAN_ID,
    matrixId: BASE_MATRIX_ID,
    configId: BASE_CONFIG_ID,
    manifestId: BASE_MANIFEST_ID,
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    decisionPolicy: 'HOME_AT_OR_ABOVE_0_5_V1',
    officialDate: BASE_OFFICIAL_DATE,
    recommendationPolicy: MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_POLICY,
    orderPolicy: MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_ORDER_POLICY,
    recommendationCount: recommendations.length,
    recommendations,
  };

  return { ...base, ...overrides };
}

describe('mlb-offline-single-pick-recommendation-contract', () => {
  it('accepts a minimal valid single-pick recommendation set and returns the exact original reference', () => {
    const predictedSide = buildValidPrediction();
    const sourceSlate = ensureValidSourceSlate([predictedSide]);
    const builderResult = buildMLBOfflineSinglePickRecommendationSet(sourceSlate);
    expect(builderResult.ok).toBe(true);

    const proposed = buildValidRecommendationSet([buildValidRecommendation(predictedSide)]);
    const validated = validateMLBOfflineSinglePickRecommendationSet(proposed);
    expect(validated.ok).toBe(true);
    if (!validated.ok) {
      throw new Error('Expected successful validation');
    }
    expect(validated.value).toBe(proposed);
  });

  it('validates exact set fields, literals, lineage, count, policies, date, and deterministic recommendation-set ID', () => {
    const predictedSide = buildValidPrediction();
    const sourceSlate = ensureValidSourceSlate([predictedSide]);
    const builderResult = buildMLBOfflineSinglePickRecommendationSet(sourceSlate);
    expect(builderResult.ok).toBe(true);
    if (!builderResult.ok) {
      throw new Error('Expected successful build');
    }

    const set = builderResult.value;
    expect(set.contractVersion).toBe('mlb-offline-single-pick-recommendation-set-v1');
    expect(set.sport).toBe('MLB');
    expect(set.target).toBe('OFFICIAL_FINAL_GAME_WINNER');
    expect(set.targetEncoding).toBe('HOME_WIN_1_AWAY_WIN_0');
    expect(set.slateId).toBe(`${BASE_RELEASE_ID}::${BASE_OFFICIAL_DATE}::mlb-offline-prediction-slate-v1`);
    expect(set.releaseId).toBe(BASE_RELEASE_ID);
    expect(set.modelId).toBe(BASE_MODEL_ID);
    expect(set.planId).toBe(BASE_PLAN_ID);
    expect(set.matrixId).toBe(BASE_MATRIX_ID);
    expect(set.configId).toBe(BASE_CONFIG_ID);
    expect(set.manifestId).toBe(BASE_MANIFEST_ID);
    expect(set.algorithm).toBe('L2_LOGISTIC_REGRESSION_BINARY_V1');
    expect(set.decisionPolicy).toBe('HOME_AT_OR_ABOVE_0_5_V1');
    expect(set.officialDate).toBe(BASE_OFFICIAL_DATE);
    expect(set.recommendationPolicy).toBe('ALL_VALIDATED_PREDICTIONS_V1');
    expect(set.orderPolicy).toBe('MODEL_CONFIDENCE_DESC_GAME_ID_ASC_SNAPSHOT_ID_ASC_INFERENCE_ID_ASC_V1');
    expect(set.recommendationCount).toBe(1);
    expect(set.recommendations).toHaveLength(1);
    expect(set.recommendationSetId).toBe(
      `${BASE_RELEASE_ID}::${BASE_OFFICIAL_DATE}::mlb-offline-prediction-slate-v1::offline-single-pick-recommendation-set-v1`,
    );
  });

  it('validates exact recommendation fields, identities, probabilities, selection, confidence, and uncertainty', () => {
    const predictedSide = buildValidPrediction();
    const sourceSlate = ensureValidSourceSlate([predictedSide]);
    const builderResult = buildMLBOfflineSinglePickRecommendationSet(sourceSlate);
    expect(builderResult.ok).toBe(true);
    if (!builderResult.ok) {
      throw new Error('Expected successful build');
    }

    const recs = builderResult.value.recommendations;
    expect(recs).toHaveLength(1);

    const rec = recs[0];
    expect(rec.recommendationId).toBe(
      `${BASE_RELEASE_ID}::${BASE_SNAPSHOT_ID}::offline-pregame-inference-v1::offline-single-pick-recommendation-v1`,
    );
    expect(rec.inferenceId).toBe(`${BASE_RELEASE_ID}::${BASE_SNAPSHOT_ID}::offline-pregame-inference-v1`);
    expect(rec.snapshotId).toBe(BASE_SNAPSHOT_ID);
    expect(rec.gameId).toBe(BASE_GAME_ID);
    expect(rec.officialDate).toBe(BASE_OFFICIAL_DATE);
    expect(rec.dataCutoffAt).toBe(BASE_DATA_CUTOFF);
    expect(rec.homeTeamId).toBe('team-home-1');
    expect(rec.awayTeamId).toBe('team-away-1');
    expect(rec.recommendedSide).toBe('HOME');
    expect(rec.recommendedTeamId).toBe('team-home-1');
    expect(rec.probabilities).toEqual({ homeWinProbability: 0.75, awayWinProbability: 0.25 });
    expect(rec.modelConfidence).toBe(0.75);
    expect(rec.modelUncertainty).toBe(0.25);
  });

  it('validates descriptor-safe roots, arrays, recommendations, probabilities, symbols, classes, and accessors without invoking getters', () => {
    const predictedSide = buildValidPrediction();
    const sourceSlate = ensureValidSourceSlate([predictedSide]);
    const builderResult = buildMLBOfflineSinglePickRecommendationSet(sourceSlate);
    expect(builderResult.ok).toBe(true);
    if (!builderResult.ok) {
      throw new Error('Expected successful build');
    }

    const proposed = buildValidRecommendationSet([buildValidRecommendation(predictedSide)]);

    let rootAccessorCount = 0;
    const rootBase: Record<string, unknown> = { ...proposed };
    delete rootBase.contractVersion;
    Object.defineProperty(rootBase, 'contractVersion', {
      get() { rootAccessorCount++; throw new Error('root accessor'); },
    });
    const rootResult = validateMLBOfflineSinglePickRecommendationSet(rootBase);
    expect(rootResult.ok).toBe(false);
    expect(rootAccessorCount).toBe(0);

    let recommendationsAccessorCount = 0;
    const recsBase: Record<string, unknown> = { ...proposed };
    Object.defineProperty(recsBase, 'recommendations', {
      get() { recommendationsAccessorCount++; throw new Error('recommendations accessor'); },
    });
    const recsResult = validateMLBOfflineSinglePickRecommendationSet(recsBase);
    expect(recsResult.ok).toBe(false);
    expect(recommendationsAccessorCount).toBe(0);

    let indexAccessorCount = 0;
    const originalRecs = proposed.recommendations as unknown[];
    const rec0 = Object.defineProperty({ ...originalRecs[0] as Record<string, unknown> }, 'recommendationId', {
      get() { indexAccessorCount++; throw new Error('index accessor'); },
    });
    const arrayWithAccessor = [rec0, ...originalRecs.slice(1).map((r) => r as Record<string, unknown>)];
    const arrayBase = { ...proposed, recommendations: arrayWithAccessor };
    const arrayResult = validateMLBOfflineSinglePickRecommendationSet(arrayBase);
    expect(arrayResult.ok).toBe(false);
    expect(indexAccessorCount).toBe(0);

    let recFieldAccessorCount = 0;
    const recWithAccessor = Object.defineProperty({ ...originalRecs[0] as Record<string, unknown> }, 'modelConfidence', {
      get() { recFieldAccessorCount++; throw new Error('rec field accessor'); },
    });
    const recBase = { ...proposed, recommendations: [recWithAccessor] };
    const recResult = validateMLBOfflineSinglePickRecommendationSet(recBase);
    expect(recResult.ok).toBe(false);
    expect(recFieldAccessorCount).toBe(0);

    let probsFieldAccessorCount = 0;
    const recWithProbsAccessor = {
      ...originalRecs[0] as Record<string, unknown>,
      probabilities: Object.defineProperty({} as Record<string, unknown>, 'homeWinProbability', {
        get() { probsFieldAccessorCount++; throw new Error('probabilities field accessor'); },
      }),
    };
    const probsBase = { ...proposed, recommendations: [recWithProbsAccessor] };
    const probsResult = validateMLBOfflineSinglePickRecommendationSet(probsBase);
    expect(probsResult.ok).toBe(false);
    expect(probsFieldAccessorCount).toBe(0);

    let probFieldAccessorCount = 0;
    const probsWithProbAccessor = Object.defineProperty(
      { awayWinProbability: 0.25 } as Record<string, unknown>,
      'homeWinProbability',
      {
        get() { probFieldAccessorCount++; throw new Error('probability field accessor'); },
      },
    );
    const recWithProbAccessor = { ...originalRecs[0] as Record<string, unknown>, probabilities: probsWithProbAccessor };
    const probBase = { ...proposed, recommendations: [recWithProbAccessor] };
    const probResult = validateMLBOfflineSinglePickRecommendationSet(probBase);
    expect(probResult.ok).toBe(false);
    expect(probFieldAccessorCount).toBe(0);
  });

  it('maps an invalid Phase 8K prediction slate to one SOURCE_SLATE_INVALID issue without partial output or pre-validation access', () => {
    const invalidSlate = { invalid: true };
    const result = buildMLBOfflineSinglePickRecommendationSet(invalidSlate);
    expect(result.ok).toBe(false);
    const issues = result.ok ? [] : result.issues;
    expect(issues).toEqual([
      {
        code: 'SOURCE_SLATE_INVALID',
        path: '$.predictionSlate',
        message: 'Source prediction slate is invalid',
      },
    ]);
  });

  it('builds one recommendation from one validated Phase 8K prediction', () => {
    const predictedSide = buildValidPrediction();
    const sourceSlate = ensureValidSourceSlate([predictedSide]);
    const builderResult = buildMLBOfflineSinglePickRecommendationSet(sourceSlate);
    expect(builderResult.ok).toBe(true);
    if (!builderResult.ok) {
      throw new Error('Expected successful build');
    }
    expect(builderResult.value.recommendationCount).toBe(1);
    expect(builderResult.value.recommendations).toHaveLength(1);
  });

  it('builds exactly one recommendation per prediction without filtering, suppression, thresholds, or abstention', () => {
    const prediction1 = buildValidPrediction({
      snapshotId: 'snap-1',
      gameId: 'game-1',
      probabilities: { homeWinProbability: 0.75, awayWinProbability: 0.25 },
      predictedSide: 'HOME',
    });
    const prediction2 = buildValidPrediction({
      snapshotId: 'snap-2',
      gameId: 'game-2',
      probabilities: { homeWinProbability: 0.25, awayWinProbability: 0.75 },
      predictedSide: 'AWAY',
    });
    const prediction3 = buildValidPrediction({
      snapshotId: 'snap-3',
      gameId: 'game-3',
      probabilities: { homeWinProbability: 0.5, awayWinProbability: 0.5 },
      predictedSide: 'HOME',
    });

    const sourceSlate = ensureValidSourceSlate([prediction1, prediction2, prediction3]);
    const builderResult = buildMLBOfflineSinglePickRecommendationSet(sourceSlate);
    expect(builderResult.ok).toBe(true);
    if (!builderResult.ok) {
      throw new Error('Expected successful build');
    }
    expect(builderResult.value.recommendationCount).toBe(3);
    expect(builderResult.value.recommendations).toHaveLength(3);
    const inferenceIds = builderResult.value.recommendations
      .map((r) => r.inferenceId)
      .sort();
    expect(inferenceIds).toEqual([
      'release-1::snap-1::offline-pregame-inference-v1',
      'release-1::snap-2::offline-pregame-inference-v1',
      'release-1::snap-3::offline-pregame-inference-v1',
    ]);
  });

  it('orders recommendations by confidence descending with exact game, snapshot, and inference tie-breaks', () => {
    const prediction1 = buildValidPrediction({
      snapshotId: 'snap-b',
      gameId: 'game-b',
      probabilities: { homeWinProbability: 0.75, awayWinProbability: 0.25 },
      predictedSide: 'HOME',
    });
    const prediction2 = buildValidPrediction({
      snapshotId: 'snap-a',
      gameId: 'game-a',
      probabilities: { homeWinProbability: 0.75, awayWinProbability: 0.25 },
      predictedSide: 'HOME',
    });
    const prediction3 = buildValidPrediction({
      snapshotId: 'snap-c',
      gameId: 'game-c',
      probabilities: { homeWinProbability: 0.5, awayWinProbability: 0.5 },
      predictedSide: 'HOME',
    });
    const prediction4 = buildValidPrediction({
      snapshotId: 'snap-d',
      gameId: 'game-d',
      probabilities: { homeWinProbability: 0.5, awayWinProbability: 0.5 },
      predictedSide: 'HOME',
    });

    const sourceSlate = ensureValidSourceSlate([prediction2, prediction1, prediction3, prediction4]);
    const builderResult = buildMLBOfflineSinglePickRecommendationSet(sourceSlate);
    expect(builderResult.ok).toBe(true);
    if (!builderResult.ok) {
      throw new Error('Expected successful build');
    }
    const recs = builderResult.value.recommendations;
    expect(recs).toHaveLength(4);
    expect(recs[0].gameId).toBe('game-a');
    expect(recs[0].modelConfidence).toBe(0.75);
    expect(recs[1].gameId).toBe('game-b');
    expect(recs[1].modelConfidence).toBe(0.75);
    expect(recs[2].gameId).toBe('game-c');
    expect(recs[2].modelConfidence).toBe(0.5);
    expect(recs[3].gameId).toBe('game-d');
    expect(recs[3].modelConfidence).toBe(0.5);
  });

  it('preserves the locked exact 0.5 HOME decision with 0.5 confidence and 0.5 uncertainty', () => {
    const prediction = buildValidPrediction({
      probabilities: { homeWinProbability: 0.5, awayWinProbability: 0.5 },
      predictedSide: 'HOME',
      predictedTeamId: 'team-home-1',
    });
    const sourceSlate = ensureValidSourceSlate([prediction]);
    const builderResult = buildMLBOfflineSinglePickRecommendationSet(sourceSlate);
    expect(builderResult.ok).toBe(true);
    if (!builderResult.ok) {
      throw new Error('Expected successful build');
    }
    const recs = builderResult.value.recommendations;
    expect(recs).toHaveLength(1);
    expect(recs[0].recommendedSide).toBe('HOME');
    expect(recs[0].recommendedTeamId).toBe('team-home-1');
    expect(recs[0].modelConfidence).toBe(0.5);
    expect(recs[0].modelUncertainty).toBe(0.5);
  });

  it('preserves exact source slate, model, manifest, prediction, game, team, date, cutoff, probability, side, and team lineage', () => {
    const prediction = buildValidPrediction({
      snapshotId: 'snapshot-custom',
      gameId: 'game-custom',
      dataCutoffAt: '2026-07-31T08:00:00Z',
      probabilities: { homeWinProbability: 0.75, awayWinProbability: 0.25 },
      predictedSide: 'HOME',
      predictedTeamId: 'team-home-custom',
      homeTeamId: 'team-home-custom',
      awayTeamId: 'team-away-custom',
    });
    const sourceSlate = ensureValidSourceSlate([prediction]);
    const builderResult = buildMLBOfflineSinglePickRecommendationSet(sourceSlate);
    expect(builderResult.ok).toBe(true);
    if (!builderResult.ok) {
      throw new Error('Expected successful build');
    }
    const recs = builderResult.value.recommendations;
    expect(recs).toHaveLength(1);
    expect(recs[0].inferenceId).toBe(
      'release-1::snapshot-custom::offline-pregame-inference-v1',
    );
    expect(recs[0].snapshotId).toBe('snapshot-custom');
    expect(recs[0].gameId).toBe('game-custom');
    expect(recs[0].officialDate).toBe(BASE_OFFICIAL_DATE);
    expect(recs[0].dataCutoffAt).toBe('2026-07-31T08:00:00Z');
    expect(recs[0].homeTeamId).toBe('team-home-custom');
    expect(recs[0].awayTeamId).toBe('team-away-custom');
    expect(recs[0].probabilities).toEqual({ homeWinProbability: 0.75, awayWinProbability: 0.25 });
    expect(recs[0].recommendedSide).toBe('HOME');
    expect(recs[0].recommendedTeamId).toBe('team-home-custom');
    expect(builderResult.value.slateId).toBe(`${BASE_RELEASE_ID}::${BASE_OFFICIAL_DATE}::mlb-offline-prediction-slate-v1`);
    expect(builderResult.value.releaseId).toBe(BASE_RELEASE_ID);
    expect(builderResult.value.modelId).toBe(BASE_MODEL_ID);
    expect(builderResult.value.planId).toBe(BASE_PLAN_ID);
    expect(builderResult.value.matrixId).toBe(BASE_MATRIX_ID);
    expect(builderResult.value.configId).toBe(BASE_CONFIG_ID);
    expect(builderResult.value.manifestId).toBe(BASE_MANIFEST_ID);
    expect(builderResult.value.algorithm).toBe('L2_LOGISTIC_REGRESSION_BINARY_V1');
    expect(builderResult.value.decisionPolicy).toBe('HOME_AT_OR_ABOVE_0_5_V1');
  });

  it('derives HOME confidence from home probability and AWAY confidence from away probability', () => {
    const homePrediction = buildValidPrediction({
      snapshotId: 'snap-home',
      gameId: 'game-home',
      probabilities: { homeWinProbability: 0.75, awayWinProbability: 0.25 },
      predictedSide: 'HOME',
    });
    const awayPrediction = buildValidPrediction({
      snapshotId: 'snap-away',
      gameId: 'game-away',
      probabilities: { homeWinProbability: 0.25, awayWinProbability: 0.75 },
      predictedSide: 'AWAY',
    });
    const sourceSlate = ensureValidSourceSlate([homePrediction, awayPrediction]);
    const builderResult = buildMLBOfflineSinglePickRecommendationSet(sourceSlate);
    expect(builderResult.ok).toBe(true);
    if (!builderResult.ok) {
      throw new Error('Expected successful build');
    }
    const recs = builderResult.value.recommendations;
    expect(recs[0].modelConfidence).toBe(0.75);
    expect(recs[0].modelUncertainty).toBe(0.25);
    expect(recs[1].modelConfidence).toBe(0.75);
    expect(recs[1].modelUncertainty).toBe(0.25);
  });

  it('rejects selection, probability, confidence, and uncertainty mismatches deterministically', () => {
    const baseRec = buildValidRecommendation(buildValidPrediction());

    const sideMismatchSet = buildValidRecommendationSet([baseRec], {
      recommendations: [
        {
          ...baseRec,
          recommendedSide: 'AWAY',
          recommendedTeamId: 'team-home-1',
          modelConfidence: 0.25,
          modelUncertainty: 0.75,
        },
      ],
    });
    const sideResult = validateMLBOfflineSinglePickRecommendationSet(sideMismatchSet);
    expect(sideResult.ok).toBe(false);
    const sideIssues = sideResult.ok ? [] : sideResult.issues;
    expect(sideIssues).toEqual([
      {
        code: 'SELECTION_MISMATCH',
        path: '$.recommendations[0].recommendedTeamId',
        message: 'recommendedTeamId must equal awayTeamId when recommendedSide is AWAY',
      },
    ]);

    const confidenceMismatchSet = buildValidRecommendationSet([baseRec], {
      recommendations: [{ ...baseRec, modelConfidence: 0.99 }],
    });
    const confidenceResult = validateMLBOfflineSinglePickRecommendationSet(confidenceMismatchSet);
    expect(confidenceResult.ok).toBe(false);
    const confidenceIssues = confidenceResult.ok ? [] : confidenceResult.issues;
    expect(confidenceIssues).toEqual([
      {
        code: 'CONFIDENCE_MISMATCH',
        path: '$.recommendations[0].modelConfidence',
        message: 'modelConfidence must equal homeWinProbability when recommendedSide is HOME',
      },
    ]);

    const uncertaintyMismatchSet = buildValidRecommendationSet([baseRec], {
      recommendations: [{ ...baseRec, modelUncertainty: 0.99 }],
    });
    const uncertaintyResult = validateMLBOfflineSinglePickRecommendationSet(uncertaintyMismatchSet);
    expect(uncertaintyResult.ok).toBe(false);
    const uncertaintyIssues = uncertaintyResult.ok ? [] : uncertaintyResult.issues;
    expect(uncertaintyIssues).toEqual([
      {
        code: 'UNCERTAINTY_MISMATCH',
        path: '$.recommendations[0].modelUncertainty',
        message: 'modelUncertainty must equal awayWinProbability when recommendedSide is HOME',
      },
    ]);

    const nonComplementSet = buildValidRecommendationSet([baseRec], {
      recommendations: [
        { ...baseRec, probabilities: { homeWinProbability: 0.7, awayWinProbability: 0.2 } },
      ],
    });
    const nonComplementResult = validateMLBOfflineSinglePickRecommendationSet(nonComplementSet);
    expect(nonComplementResult.ok).toBe(false);
    const nonComplementIssues = nonComplementResult.ok ? [] : nonComplementResult.issues;
    expect(nonComplementIssues).toEqual([
      {
        code: 'PROBABILITY_MISMATCH',
        path: '$.recommendations[0].probabilities',
        message: 'awayWinProbability must equal 1 - homeWinProbability',
      },
    ]);

    const alteredSet = buildValidRecommendationSet([baseRec], {
      recommendations: [
        { ...baseRec, probabilities: { homeWinProbability: 1.5, awayWinProbability: -0.5 } },
      ],
    });
    const alteredResult = validateMLBOfflineSinglePickRecommendationSet(alteredSet);
    expect(alteredResult.ok).toBe(false);
    const alteredIssues = alteredResult.ok ? [] : alteredResult.issues;
    expect(alteredIssues).toEqual([
      {
        code: 'INVALID_NUMBER',
        path: '$.recommendations[0].probabilities.awayWinProbability',
        message: 'awayWinProbability must be a finite number in [0, 1]',
      },
      {
        code: 'INVALID_NUMBER',
        path: '$.recommendations[0].probabilities.homeWinProbability',
        message: 'homeWinProbability must be a finite number in [0, 1]',
      },
    ]);
  });

  it('rejects duplicate recommendation IDs at the second conflicting entry', () => {
    const prediction = buildValidPrediction();
    const rec1 = buildValidRecommendation(prediction);
    const rec2 = {
      ...buildValidRecommendation(prediction),
      snapshotId: 'snapshot-dup',
      gameId: 'game-dup-id',
    };
    const set = buildValidRecommendationSet([rec1, rec2]);
    const result = validateMLBOfflineSinglePickRecommendationSet(set);
    expect(result.ok).toBe(false);
    const issues = result.ok ? [] : result.issues;
    expect(issues).toEqual([
      {
        code: 'DUPLICATE_RECOMMENDATION_ID',
        path: '$.recommendations[1].recommendationId',
        message: `Duplicate recommendationId: ${rec1.recommendationId}`,
      },
    ]);
  });

  it('proves duplicate inference identity collapses to the locked duplicate recommendation identity', () => {
    const prediction = buildValidPrediction();
    const rec1 = buildValidRecommendation(prediction);
    const rec2 = {
      ...buildValidRecommendation(prediction),
      snapshotId: 'snapshot-dup',
      gameId: 'game-dup-inference',
    } as Record<string, unknown>;

    expect(rec2.inferenceId).toBe(rec1.inferenceId);
    expect(rec2.recommendationId).toBe(rec1.recommendationId);

    const set = buildValidRecommendationSet([rec1, rec2]);
    const result = validateMLBOfflineSinglePickRecommendationSet(set);
    expect(result.ok).toBe(false);
    const issues = result.ok ? [] : result.issues;
    expect(issues).toEqual([
      {
        code: 'DUPLICATE_RECOMMENDATION_ID',
        path: '$.recommendations[1].recommendationId',
        message: `Duplicate recommendationId: ${rec1.recommendationId}`,
      },
    ]);
  });

  it('rejects duplicate game IDs at the second conflicting entry', () => {
    const prediction = buildValidPrediction();
    const rec1 = buildValidRecommendation(prediction);
    const rec2 = {
      ...buildValidRecommendation(prediction),
      recommendationId: 'release-1::snapshot-dup::offline-pregame-inference-v1::offline-single-pick-recommendation-v1',
      inferenceId: 'release-1::snapshot-dup::offline-pregame-inference-v1',
      snapshotId: 'snapshot-dup',
      gameId: 'game-1',
    };
    const set = buildValidRecommendationSet([rec1, rec2]);
    const result = validateMLBOfflineSinglePickRecommendationSet(set);
    expect(result.ok).toBe(false);
    const issues = result.ok ? [] : result.issues;
    expect(issues).toEqual([
      {
        code: 'DUPLICATE_GAME_ID',
        path: '$.recommendations[1].gameId',
        message: `Duplicate gameId: ${rec1.gameId}`,
      },
    ]);
  });

  it('rejects noncanonical recommendation order and validates count and deterministic set identity', () => {
    const prediction1 = buildValidPrediction({
      snapshotId: 'snap-a',
      gameId: 'game-a',
      probabilities: { homeWinProbability: 0.75, awayWinProbability: 0.25 },
      predictedSide: 'HOME',
    });
    const prediction2 = buildValidPrediction({
      snapshotId: 'snap-b',
      gameId: 'game-b',
      probabilities: { homeWinProbability: 0.75, awayWinProbability: 0.25 },
      predictedSide: 'HOME',
    });

    const sourceSlate = ensureValidSourceSlate([prediction1, prediction2]);
    const builderResult = buildMLBOfflineSinglePickRecommendationSet(sourceSlate);
    expect(builderResult.ok).toBe(true);
    if (!builderResult.ok) {
      throw new Error('Expected successful build');
    }
    const canonicalSet = builderResult.value;

    const canonicalRecs = canonicalSet.recommendations;
    const reversedRecs = Array.from(canonicalRecs).reverse();
    const reversedSet = { ...canonicalSet, recommendations: reversedRecs };
    const reversedResult = validateMLBOfflineSinglePickRecommendationSet(reversedSet);
    expect(reversedResult.ok).toBe(false);
    const reversedIssues = reversedResult.ok ? [] : reversedResult.issues;
    expect(reversedIssues).toEqual([
      {
        code: 'ORDER_MISMATCH',
        path: '$.recommendations',
        message: 'Recommendations must be in canonical order',
      },
    ]);

    const wrongCountSet = { ...canonicalSet, recommendationCount: 999 };
    const countResult = validateMLBOfflineSinglePickRecommendationSet(wrongCountSet);
    expect(countResult.ok).toBe(false);
    const countIssues = countResult.ok ? [] : countResult.issues;
    expect(countIssues).toEqual([
      {
        code: 'RECOMMENDATION_COUNT_MISMATCH',
        path: '$.recommendationCount',
        message: 'recommendationCount must equal recommendations.length',
      },
    ]);

    const wrongIdSet = { ...canonicalSet, recommendationSetId: 'wrong-id' };
    const idResult = validateMLBOfflineSinglePickRecommendationSet(wrongIdSet);
    expect(idResult.ok).toBe(false);
    const idIssues = idResult.ok ? [] : idResult.issues;
    expect(idIssues).toEqual([
      {
        code: 'RECOMMENDATION_SET_ID_MISMATCH',
        path: '$.recommendationSetId',
        message: 'recommendationSetId does not match the deterministic formula',
      },
    ]);
  });

  it('produces deeply deterministic output without mutating the source slate, predictions, or probabilities', () => {
    const predictedSide = buildValidPrediction();
    const sourceSlate = ensureValidSourceSlate([predictedSide]);

    const beforeRootKeys = Object.getOwnPropertyNames(sourceSlate);
    const beforeRootSymbols = Object.getOwnPropertySymbols(sourceSlate);
    const beforePredictionsRef = sourceSlate.predictions as unknown[];
    const beforeFirstPrediction = beforePredictionsRef[0] as Record<string, unknown>;
    const beforeFirstPredictionKeys = Object.getOwnPropertyNames(beforeFirstPrediction);
    const beforeFirstPredictionSymbols = Object.getOwnPropertySymbols(beforeFirstPrediction);
    const beforeProbabilitiesRef = beforeFirstPrediction.probabilities as Record<string, unknown>;
    const beforeHomeProb = beforeProbabilitiesRef.homeWinProbability;
    const beforeAwayProb = beforeProbabilitiesRef.awayWinProbability;

    const result1 = buildMLBOfflineSinglePickRecommendationSet(sourceSlate);
    const result2 = buildMLBOfflineSinglePickRecommendationSet(sourceSlate);

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    if (!result1.ok || !result2.ok) {
      throw new Error('Expected successful builds');
    }

    const value1 = result1.value;
    const value2 = result2.value;
    expect(value1.recommendations).toEqual(value2.recommendations);
    expect(value1).not.toBe(value2);

    expect(Object.getOwnPropertyNames(sourceSlate)).toEqual(beforeRootKeys);
    expect(Object.getOwnPropertySymbols(sourceSlate)).toEqual(beforeRootSymbols);
    expect(sourceSlate.predictions).toBe(beforePredictionsRef);
    expect(Object.getOwnPropertyNames(beforeFirstPrediction)).toEqual(beforeFirstPredictionKeys);
    expect(Object.getOwnPropertySymbols(beforeFirstPrediction)).toEqual(beforeFirstPredictionSymbols);
    expect(beforeFirstPrediction.probabilities).toBe(beforeProbabilitiesRef);
    expect(beforeProbabilitiesRef.homeWinProbability).toBe(beforeHomeProb);
    expect(beforeProbabilitiesRef.awayWinProbability).toBe(beforeAwayProb);

    const recs1 = value1.recommendations;
    expect(recs1[0]).not.toBe(beforeFirstPrediction);
    expect(recs1[0].probabilities).not.toBe(beforeProbabilitiesRef);
  });

  it('rejects odds contamination, market concepts, multis, stakes, grading, and prohibited fields', () => {
    const proposed = buildValidRecommendationSet([buildValidRecommendation(buildValidPrediction())], {
      odds: 'sportsbook',
    });
    const result = validateMLBOfflineSinglePickRecommendationSet(proposed);
    expect(result.ok).toBe(false);
    const issues = result.ok ? [] : result.issues;
    expect(issues.some((issue) => (issue as Record<string, string>).code === 'ODDS_CONTAMINATION')).toBe(true);

    const multiProposed = buildValidRecommendationSet([buildValidRecommendation(buildValidPrediction())], {
      multi: 'invalid',
    });
    const multiResult = validateMLBOfflineSinglePickRecommendationSet(multiProposed);
    expect(multiResult.ok).toBe(false);
    const multiIssues = multiResult.ok ? [] : multiResult.issues;
    expect(multiIssues.some((issue) => (issue as Record<string, string>).code === 'PROHIBITED_CONCEPT')).toBe(true);
  });

  it('proves successful output contains no odds, value, edge, multi, stake, grade, feature, coefficient, score, metric, label, or row data', () => {
    const predictedSide = buildValidPrediction();
    const sourceSlate = ensureValidSourceSlate([predictedSide]);
    const builderResult = buildMLBOfflineSinglePickRecommendationSet(sourceSlate);
    expect(builderResult.ok).toBe(true);
    if (!builderResult.ok) {
      throw new Error('Expected successful build');
    }
    const set = builderResult.value;

    const prohibited = [
      'odds',
      'price',
      'line',
      'market',
      'edge',
      'value',
      'payout',
      'multi',
      'parlay',
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

    function checkObject(obj: unknown, path: string): void {
      if (typeof obj !== 'object' || obj === null) {
        return;
      }
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          checkObject(obj[i], `${path}[${i}]`);
        }
        return;
      }
      const record = obj as Record<string, unknown>;
      for (const key of Object.getOwnPropertyNames(record)) {
        if (prohibited.includes(key)) {
          throw new Error(`Prohibited concept found at ${path}.${key}`);
        }
        checkObject(record[key], `${path}.${key}`);
      }
    }

    expect(() => checkObject(set as unknown, '$')).not.toThrow();
  });

  it('verifies deterministic issue ordering, exact exports and imports, no live inference, no multis, no staking, no routes, no UI, and the static architecture boundary', async () => {
    const source = await readFile(
      new URL('../../../src/prediction/mlb/mlb-offline-single-pick-recommendation-contract.ts', import.meta.url),
      'utf-8',
    );

    const expectedExports = [
      'MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_SET_CONTRACT_VERSION',
      'MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_POLICY',
      'MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_ORDER_POLICY',
      'MLBOfflineSinglePickRecommendation',
      'MLBOfflineSinglePickRecommendationSet',
      'MLBOfflineSinglePickRecommendationSetIssue',
      'validateMLBOfflineSinglePickRecommendationSet',
      'buildMLBOfflineSinglePickRecommendationSet',
    ];

    const exports = source.match(/\bexport\s+(?:const|type|function)\s+([A-Za-z0-9_]+)/g) || [];
    const exportNames = exports.map((e) => e.replace(/export\s+(?:const|type|function)\s+/, ''));
    expect(exportNames).toEqual(expectedExports);

    const expectedImports = [
      '../firewall/odds-contamination-guard',
      './mlb-offline-prediction-slate-contract',
    ];

    const imports = source.match(/(?:^|\n)\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g) || [];
    const importPaths = imports.map((i) => i.match(/['"]([^'"]+)['"]/)?.[1] || '');
    expect(importPaths).toEqual(expectedImports);

    expect(source).toContain('validateMLBOfflinePredictionSlate(');
    expect(source).toContain('validateMLBOfflineSinglePickRecommendationSet(');
    expect(source).toContain('buildMLBOfflineSinglePickRecommendationSet(');
    expect(source).toContain('assertNoOddsContamination(');

    expect(source).not.toMatch(/\bexport\s+(?:enum|interface)\s+/);
    expect(source).not.toMatch(/from\s+['"]node:fs/);
    expect(source).not.toMatch(/fetch\s*\(/);
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/Date\.now/);
    expect(source).not.toMatch(/randomUUID/);
    expect(source).not.toMatch(/process\.env/);
    expect(source).not.toMatch(/localeCompare/);
    expect(source).not.toMatch(/\bupdateCoefficients\s*\(/);
    expect(source).not.toMatch(/\bfitModel\s*\(/);
    expect(source).not.toMatch(/\btrainModel\s*\(/);
    expect(source).not.toMatch(/\bcalibrate/);
    expect(source).not.toMatch(/\bgenerateRecommendation\s*\(/);
    expect(source).not.toMatch(/\bbuildMulti\s*\(/);
    expect(source).not.toMatch(/\bcalculateStake\s*\(/);
    expect(source).not.toMatch(/\bgradePrediction\s*\(/);
    expect(source).not.toMatch(/from\s+['"]@prisma/);
    expect(source).not.toMatch(/PrismaClient/);
    expect(source).not.toMatch(/readFileSync/);
    expect(source).not.toMatch(/writeFileSync/);

    const testSource = await readFile(
      new URL('../../../tests/prediction/mlb/mlb-offline-single-pick-recommendation-contract.test.ts', import.meta.url),
      'utf-8',
    );

    const testCount = (testSource.match(/\bit\s*\(/g) || []).length;
    expect(testCount).toBe(20);

    const issues: string[] = [];
    const forbiddenTestImports = [
      'mlb-prediction-slate-contract.ts',
      'mlb-offline-pregame-inference-contract',
    ];
    for (const forbidden of forbiddenTestImports) {
      if (
        testSource.includes("from '" + forbidden + "'") ||
        testSource.includes('from "' + forbidden + '"')
      ) {
        issues.push('forbidden-test-import: ' + forbidden);
      }
    }

    const testImports = testSource.match(/from\s+['"]([^'"]+)['"]/g) || [];
    const allowedTestImports = [
      'vitest',
      '@/prediction/mlb/mlb-offline-single-pick-recommendation-contract',
      'node:fs/promises',
      '@/prediction/mlb/mlb-offline-prediction-slate-contract',
    ];
    for (const imp of testImports) {
      const path = imp.match(/['"]([^'"]+)['"]/)?.[1] || '';
      if (!allowedTestImports.includes(path)) {
        issues.push(`unexpected-test-import: ${path}`);
      }
    }

    expect(issues).toEqual([]);
  });
});
