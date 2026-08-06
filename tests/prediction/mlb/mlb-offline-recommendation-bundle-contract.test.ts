import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  MLB_OFFLINE_RECOMMENDATION_BUNDLE_CONTRACT_VERSION,
  MLB_OFFLINE_RECOMMENDATION_BUNDLE_COMPOSITION_POLICY,
  type MLBOfflineRecommendationBundle,
  type MLBOfflineRecommendationBundleIssue,
  type MLBOfflineRecommendationBundleInput,
  buildMLBOfflineRecommendationBundle,
  validateMLBOfflineRecommendationBundle,
} from '@/prediction/mlb/mlb-offline-recommendation-bundle-contract';
import {
  buildMLBOfflineSinglePickRecommendationSet,
  validateMLBOfflineSinglePickRecommendationSet,
} from '@/prediction/mlb/mlb-offline-single-pick-recommendation-contract';
import {
  buildMLBOfflinePredictionSlate,
  validateMLBOfflinePredictionSlate,
} from '@/prediction/mlb/mlb-offline-prediction-slate-contract';
import {
  buildMLBOfflineMultiCandidateSet,
  type MLBOfflineMultiCandidateSet,
  validateMLBOfflineMultiCandidateSet,
} from '@/prediction/mlb/mlb-offline-multi-candidate-contract';
import {
  buildMLBOfflineMultiRecommendationSet,
  type MLBOfflineMultiRecommendationSet,
  validateMLBOfflineMultiRecommendationSet,
} from '@/prediction/mlb/mlb-offline-multi-recommendation-contract';
import {
  buildMLBOfflineMultiRiskGuidanceSet,
  type MLBOfflineMultiRiskGuidanceSet,
  validateMLBOfflineMultiRiskGuidanceSet,
} from '@/prediction/mlb/mlb-offline-multi-risk-guidance-contract';

const BASE_RELEASE_ID = 'release-1';
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

  const homeTeamId = overrides.homeTeamId ?? 'team-home-1';
  const awayTeamId = overrides.awayTeamId ?? 'team-away-1';
  const probabilities = overrides.probabilities ?? {
    homeWinProbability: 0.75,
    awayWinProbability: 0.25,
  };

  if (
    !Number.isFinite(probabilities.homeWinProbability) ||
    !Number.isFinite(probabilities.awayWinProbability)
  ) {
    throw new Error('Probabilities must be finite');
  }

  if (
    probabilities.homeWinProbability < 0 ||
    probabilities.homeWinProbability > 1 ||
    probabilities.awayWinProbability < 0 ||
    probabilities.awayWinProbability > 1
  ) {
    throw new Error('Probabilities must be within [0,1]');
  }

  if (probabilities.homeWinProbability + probabilities.awayWinProbability !== 1) {
    throw new Error('Probabilities must sum to exactly 1');
  }

  const predictedSide =
    overrides.predictedSide ??
    (probabilities.homeWinProbability >= 0.5 ? 'HOME' : 'AWAY');

  const predictedTeamId =
    overrides.predictedTeamId ??
    (predictedSide === 'HOME' ? homeTeamId : awayTeamId);

  const prediction: Record<string, unknown> = {
    contractVersion: 'mlb-offline-pregame-inference-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    inferenceId,
    releaseId,
    modelId: overrides.modelId ?? 'model-1',
    planId: overrides.planId ?? 'plan-1',
    matrixId: overrides.matrixId ?? 'matrix-1',
    configId: overrides.configId ?? 'config-1',
    manifestId: overrides.manifestId ?? 'manifest-1',
    snapshotId,
    gameId: overrides.gameId ?? BASE_GAME_ID,
    officialDate: overrides.officialDate ?? BASE_OFFICIAL_DATE,
    dataCutoffAt: overrides.dataCutoffAt ?? BASE_DATA_CUTOFF,
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    decisionPolicy: 'HOME_AT_OR_ABOVE_0_5_V1',
    homeTeamId,
    awayTeamId,
    probabilities,
    predictedSide,
    predictedTeamId,
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

function ensureBuiltSinglePickRecommendationSet(
  sourceSlate: Record<string, unknown>,
): Record<string, unknown> {
  const built = buildMLBOfflineSinglePickRecommendationSet(sourceSlate);
  if (!built.ok) {
    const issueMessages = built.issues.map((issue) => `${issue.code}:${issue.path}`).join(', ');
    throw new Error(`Invalid recommendation set: ${issueMessages}`);
  }
  const validated = validateMLBOfflineSinglePickRecommendationSet(built.value);
  if (!validated.ok) {
    const issueMessages = validated.issues.map((issue) => `${issue.code}:${issue.path}`).join(', ');
    throw new Error(`Invalid validated recommendation set: ${issueMessages}`);
  }
  return built.value;
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

function ensureValidMultiRecommendationSet(
  sourceSet: MLBOfflineMultiCandidateSet,
): MLBOfflineMultiRecommendationSet {
  const built = buildMLBOfflineMultiRecommendationSet(sourceSet);
  if (!built.ok) {
    const issueMessages = built.issues.map((issue) => `${issue.code}:${issue.path}`).join(', ');
    throw new Error(`Invalid multi-recommendation set: ${issueMessages}`);
  }
  const validated = validateMLBOfflineMultiRecommendationSet(built.value);
  if (!validated.ok) {
    const issueMessages = validated.issues.map((issue) => `${issue.code}:${issue.path}`).join(', ');
    throw new Error(`Invalid validated multi-recommendation set: ${issueMessages}`);
  }
  return built.value;
}

function ensureValidRiskGuidanceSet(
  sourceSet: MLBOfflineMultiRecommendationSet,
): MLBOfflineMultiRiskGuidanceSet {
  const built = buildMLBOfflineMultiRiskGuidanceSet(sourceSet);
  if (!built.ok) {
    const issueMessages = built.issues.map((issue) => `${issue.code}:${issue.path}`).join(', ');
    throw new Error(`Invalid guidance set: ${issueMessages}`);
  }
  const validated = validateMLBOfflineMultiRiskGuidanceSet(built.value);
  if (!validated.ok) {
    const issueMessages = validated.issues.map((issue) => `${issue.code}:${issue.path}`).join(', ');
    throw new Error(`Invalid validated guidance set: ${issueMessages}`);
  }
  return built.value;
}

function buildMinimalValidPipeline(): {
  singlePick: Record<string, unknown>;
  candidate: MLBOfflineMultiCandidateSet;
  multi: MLBOfflineMultiRecommendationSet;
  risk: MLBOfflineMultiRiskGuidanceSet;
} {
  const prediction1 = buildValidPrediction({ snapshotId: 'snapshot-1', gameId: 'game-1' });
  const prediction2 = buildValidPrediction({
    snapshotId: 'snapshot-2',
    gameId: 'game-2',
    probabilities: { homeWinProbability: 0.25, awayWinProbability: 0.75 },
    predictedSide: 'AWAY',
    predictedTeamId: 'team-away-2',
    homeTeamId: 'team-home-2',
    awayTeamId: 'team-away-2',
  });
  const sourceSlate = ensureValidSourceSlate([prediction1, prediction2]);
  const singlePick = ensureBuiltSinglePickRecommendationSet(sourceSlate);
  const candidate = ensureValidCandidateSet(singlePick);
  const multi = ensureValidMultiRecommendationSet(candidate);
  const risk = ensureValidRiskGuidanceSet(multi);
  return { singlePick, candidate, multi, risk };
}

function buildPipeline(
  overrides: Record<string, unknown> = {},
): {
  singlePick: Record<string, unknown>;
  candidate: MLBOfflineMultiCandidateSet;
  multi: MLBOfflineMultiRecommendationSet;
  risk: MLBOfflineMultiRiskGuidanceSet;
} {
  const prediction1 = buildValidPrediction({
    releaseId: overrides.releaseId as string | undefined,
    snapshotId: overrides.snapshotId1 as string | undefined,
    gameId: overrides.gameId1 as string | undefined,
    homeTeamId: overrides.homeTeamId1 as string | undefined,
    awayTeamId: overrides.awayTeamId1 as string | undefined,
    predictedTeamId: overrides.predictedTeamId1 as string | undefined,
  });
  const prediction2 = buildValidPrediction({
    releaseId: overrides.releaseId as string | undefined,
    snapshotId: overrides.snapshotId2 as string | undefined,
    gameId: overrides.gameId2 as string | undefined,
    homeTeamId: overrides.homeTeamId2 as string | undefined,
    awayTeamId: overrides.awayTeamId2 as string | undefined,
    probabilities: { homeWinProbability: 0.25, awayWinProbability: 0.75 },
    predictedSide: 'AWAY',
    predictedTeamId: overrides.predictedTeamId2 as string | undefined,
  });
  const sourceSlate = ensureValidSourceSlate([prediction1, prediction2]);
  const singlePick = ensureBuiltSinglePickRecommendationSet(sourceSlate);
  const candidate = ensureValidCandidateSet(singlePick);
  const multi = ensureValidMultiRecommendationSet(candidate);
  const risk = ensureValidRiskGuidanceSet(multi);
  return { singlePick, candidate, multi, risk };
}

describe('mlb-offline-recommendation-bundle-contract', () => {
  it('accepts a minimal valid recommendation bundle and returns the exact original reference', () => {
    const { singlePick, candidate, multi, risk } = buildMinimalValidPipeline();
    const result = buildMLBOfflineRecommendationBundle({
      singlePickRecommendationSet: singlePick,
      multiRecommendationSet: multi,
      multiRiskGuidanceSet: risk,
      recommendedAt: '2026-08-01T12:34:56.789Z',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    expect(result.value.sourceSinglePickRecommendationSet).toBe(singlePick);
    expect(result.value.sourceMultiRecommendationSet).toBe(multi);
    expect(result.value.sourceMultiRiskGuidanceSet).toBe(risk);
    const validated = validateMLBOfflineRecommendationBundle(result.value);
    expect(validated.ok).toBe(true);
    if (!validated.ok) throw new Error('Expected successful validation');
    expect(validated.value).toBe(result.value);
  });

  it('validates exact thirteen-field root shape, literals, composition policy, canonical timestamp, source mappings, and deterministic bundle identity', () => {
    const { singlePick, candidate, multi, risk } = buildMinimalValidPipeline();
    const result = buildMLBOfflineRecommendationBundle({
      singlePickRecommendationSet: singlePick,
      multiRecommendationSet: multi,
      multiRiskGuidanceSet: risk,
      recommendedAt: '2026-08-01T12:34:56.789Z',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    const bundle = result.value;
    expect(bundle.contractVersion).toBe(MLB_OFFLINE_RECOMMENDATION_BUNDLE_CONTRACT_VERSION);
    expect(bundle.sport).toBe('MLB');
    expect(bundle.target).toBe('OFFICIAL_FINAL_GAME_WINNER');
    expect(bundle.targetEncoding).toBe('HOME_WIN_1_AWAY_WIN_0');
    expect(bundle.compositionPolicy).toBe(MLB_OFFLINE_RECOMMENDATION_BUNDLE_COMPOSITION_POLICY);
    expect(bundle.recommendedAt).toBe('2026-08-01T12:34:56.789Z');
    expect(bundle.singlePickRecommendationSetId).toBe(singlePick.recommendationSetId);
    expect(bundle.multiRecommendationSetId).toBe(multi.multiRecommendationSetId);
    expect(bundle.riskGuidanceSetId).toBe(risk.riskGuidanceSetId);
    expect(bundle.recommendationBundleId).toBe(
      `${singlePick.recommendationSetId}::${multi.multiRecommendationSetId}::${risk.riskGuidanceSetId}::2026-08-01T12:34:56.789Z::offline-recommendation-bundle-v1`,
    );
    expect(Object.keys(bundle)).toHaveLength(13);
  });

  it('validates the embedded Phase 8L single-pick recommendation set before bundle semantics', () => {
    const { multi, risk } = buildMinimalValidPipeline();
    const invalidSource = { invalid: true };
    const result = buildMLBOfflineRecommendationBundle({
      singlePickRecommendationSet: invalidSource,
      multiRecommendationSet: multi,
      multiRiskGuidanceSet: risk,
      recommendedAt: '2026-08-01T12:34:56.789Z',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.issues).toEqual([
      {
        code: 'SOURCE_SINGLE_PICK_RECOMMENDATION_SET_INVALID',
        path: '$.singlePickRecommendationSet',
        message: 'Source single-pick recommendation set is invalid',
      },
    ]);
  });

  it('validates the embedded Phase 8N multi-recommendation set before bundle semantics', () => {
    const { singlePick, risk } = buildMinimalValidPipeline();
    const result = buildMLBOfflineRecommendationBundle({
      singlePickRecommendationSet: singlePick,
      multiRecommendationSet: { invalid: true },
      multiRiskGuidanceSet: risk,
      recommendedAt: '2026-08-01T12:34:56.789Z',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.issues).toEqual([
      {
        code: 'SOURCE_MULTI_RECOMMENDATION_SET_INVALID',
        path: '$.multiRecommendationSet',
        message: 'Source multi-recommendation set is invalid',
      },
    ]);
  });

  it('validates the embedded Phase 8O multi-risk-guidance set before bundle semantics', () => {
    const { singlePick, multi } = buildMinimalValidPipeline();
    const result = buildMLBOfflineRecommendationBundle({
      singlePickRecommendationSet: singlePick,
      multiRecommendationSet: multi,
      multiRiskGuidanceSet: { invalid: true },
      recommendedAt: '2026-08-01T12:34:56.789Z',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.issues).toEqual([
      {
        code: 'SOURCE_MULTI_RISK_GUIDANCE_SET_INVALID',
        path: '$.multiRiskGuidanceSet',
        message: 'Source multi-risk-guidance set is invalid',
      },
    ]);
  });

  it('validates descriptor-safe public roots, builder inputs, embedded sources, symbols, classes, and accessors without invoking getters', () => {
    const { singlePick, candidate, multi, risk } = buildMinimalValidPipeline();

    let publicAccessorCount = 0;
    const publicBase: Record<string, unknown> = { ...risk };
    delete publicBase.contractVersion;
    Object.defineProperty(publicBase, 'contractVersion', {
      get() { publicAccessorCount++; throw new Error('public accessor'); },
    });
    const publicResult = validateMLBOfflineRecommendationBundle({
      ...publicBase,
      sport: 'MLB',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
      compositionPolicy: MLB_OFFLINE_RECOMMENDATION_BUNDLE_COMPOSITION_POLICY,
      recommendationBundleId: 'test',
      recommendedAt: '2026-08-01T12:34:56.789Z',
      singlePickRecommendationSetId: singlePick.recommendationSetId,
      multiRecommendationSetId: multi.multiRecommendationSetId,
      riskGuidanceSetId: risk.riskGuidanceSetId,
      sourceSinglePickRecommendationSet: singlePick,
      sourceMultiRecommendationSet: multi,
      sourceMultiRiskGuidanceSet: risk,
    });
    expect(publicResult.ok).toBe(false);
    if (publicResult.ok) throw new Error('Expected invalid');
    expect(publicAccessorCount).toBe(0);

    let builderAccessorCount = 0;
    const builderBase: Record<string, unknown> = {
      singlePickRecommendationSet: singlePick,
      multiRecommendationSet: multi,
      multiRiskGuidanceSet: risk,
      recommendedAt: '2026-08-01T12:34:56.789Z',
    };
    Object.defineProperty(builderBase, 'recommendedAt', {
      get() { builderAccessorCount++; throw new Error('builder accessor'); },
    });
    const builderResult = buildMLBOfflineRecommendationBundle(builderBase);
    expect(builderResult.ok).toBe(false);
    if (builderResult.ok) throw new Error('Expected invalid');
    expect(builderAccessorCount).toBe(0);
  });

  it('maps an invalid Phase 8L builder source to one SOURCE_SINGLE_PICK_RECOMMENDATION_SET_INVALID issue without partial output or pre-validation access', () => {
    const { multi, risk } = buildMinimalValidPipeline();
    const invalidSource = Object.defineProperty({}, 'recommendationSetId', {
      get() { throw new Error('Pre-validation access detected'); },
    });
    const result = buildMLBOfflineRecommendationBundle({
      singlePickRecommendationSet: invalidSource,
      multiRecommendationSet: multi,
      multiRiskGuidanceSet: risk,
      recommendedAt: '2026-08-01T12:34:56.789Z',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.issues).toEqual([
      {
        code: 'SOURCE_SINGLE_PICK_RECOMMENDATION_SET_INVALID',
        path: '$.singlePickRecommendationSet',
        message: 'Source single-pick recommendation set is invalid',
      },
    ]);
  });

  it('maps an invalid Phase 8N builder source to one SOURCE_MULTI_RECOMMENDATION_SET_INVALID issue without partial output or pre-validation access', () => {
    const { singlePick, risk } = buildMinimalValidPipeline();
    const invalidSource = Object.defineProperty({}, 'multiRecommendationSetId', {
      get() { throw new Error('Pre-validation access detected'); },
    });
    const result = buildMLBOfflineRecommendationBundle({
      singlePickRecommendationSet: singlePick,
      multiRecommendationSet: invalidSource,
      multiRiskGuidanceSet: risk,
      recommendedAt: '2026-08-01T12:34:56.789Z',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.issues).toEqual([
      {
        code: 'SOURCE_MULTI_RECOMMENDATION_SET_INVALID',
        path: '$.multiRecommendationSet',
        message: 'Source multi-recommendation set is invalid',
      },
    ]);
  });

  it('maps an invalid Phase 8O builder source to one SOURCE_MULTI_RISK_GUIDANCE_SET_INVALID issue without partial output or pre-validation access', () => {
    const { singlePick, multi } = buildMinimalValidPipeline();
    const invalidSource = Object.defineProperty({}, 'riskGuidanceSetId', {
      get() { throw new Error('Pre-validation access detected'); },
    });
    const result = buildMLBOfflineRecommendationBundle({
      singlePickRecommendationSet: singlePick,
      multiRecommendationSet: multi,
      multiRiskGuidanceSet: invalidSource,
      recommendedAt: '2026-08-01T12:34:56.789Z',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.issues).toEqual([
      {
        code: 'SOURCE_MULTI_RISK_GUIDANCE_SET_INVALID',
        path: '$.multiRiskGuidanceSet',
        message: 'Source multi-risk-guidance set is invalid',
      },
    ]);
  });

  it('validates exact canonical UTC recommendedAt format and rejects noncanonical alternatives', () => {
    const { singlePick, multi, risk } = buildMinimalValidPipeline();
    const input: MLBOfflineRecommendationBundleInput = {
      singlePickRecommendationSet: singlePick,
      multiRecommendationSet: multi,
      multiRiskGuidanceSet: risk,
      recommendedAt: '2026-08-01T12:34:56.789Z',
    };

    const validResult = buildMLBOfflineRecommendationBundle(input);
    expect(validResult.ok).toBe(true);
    if (!validResult.ok) throw new Error('Expected success');

    const nonCanonical = [
      '2026-08-01T12:34:56Z',
      '2026-08-01T12:34:56.78Z',
      '2026-08-01T12:34:56.7890Z',
      '2026-08-01T12:34:56.789+00:00',
      '2026-08-01T12:34:56.789z',
      ' 2026-08-01T12:34:56.789Z',
      '2026-08-01T12:34:56.789Z ',
    ];

    for (const timestamp of nonCanonical) {
      const result = buildMLBOfflineRecommendationBundle({
        ...input,
        recommendedAt: timestamp,
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error(`Expected failure for ${timestamp}`);
      expect(result.issues).toEqual([
        {
          code: 'INVALID_TIMESTAMP',
          path: '$.recommendedAt',
          message:
            'recommendedAt must be a canonical UTC timestamp in YYYY-MM-DDTHH:mm:ss.sssZ format',
        },
      ]);
    }
  });

  it('rejects impossible Gregorian timestamps, invalid clock values, and leap seconds', () => {
    const { singlePick, multi, risk } = buildMinimalValidPipeline();
    const validBundle = buildMLBOfflineRecommendationBundle({
      singlePickRecommendationSet: singlePick,
      multiRecommendationSet: multi,
      multiRiskGuidanceSet: risk,
      recommendedAt: '2026-08-01T12:34:56.789Z',
    });
    if (!validBundle.ok) throw new Error('Expected valid bundle');

    const invalidTimestamps = [
      '0000-01-01T00:00:00.000Z',
      '2026-02-29T00:00:00.000Z',
      '2026-02-30T00:00:00.000Z',
      '2026-04-31T00:00:00.000Z',
      '2026-00-01T00:00:00.000Z',
      '2026-13-01T00:00:00.000Z',
      '2026-01-00T00:00:00.000Z',
      '2026-01-01T24:00:00.000Z',
      '2026-01-01T00:60:00.000Z',
      '2026-01-01T00:00:60.000Z',
    ];

    for (const timestamp of invalidTimestamps) {
      const proposal = { ...validBundle.value, recommendedAt: timestamp };
      const result = validateMLBOfflineRecommendationBundle(proposal);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error(`Expected failure for ${timestamp}`);
      expect(result.issues).toEqual([
        {
          code: 'INVALID_TIMESTAMP',
          path: '$.recommendedAt',
          message:
            'recommendedAt must be a canonical UTC timestamp in YYYY-MM-DDTHH:mm:ss.sssZ format',
        },
      ]);
    }
  });

  it('derives deterministic bundle identity from all three canonical source identities and recommendedAt', () => {
    const { singlePick, multi, risk } = buildMinimalValidPipeline();
    const result = buildMLBOfflineRecommendationBundle({
      singlePickRecommendationSet: singlePick,
      multiRecommendationSet: multi,
      multiRiskGuidanceSet: risk,
      recommendedAt: '2026-08-01T12:34:56.789Z',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    expect(result.value.recommendationBundleId).toBe(
      `${singlePick.recommendationSetId}::${multi.multiRecommendationSetId}::${risk.riskGuidanceSetId}::2026-08-01T12:34:56.789Z::offline-recommendation-bundle-v1`,
    );
  });

  it('validates fixed literals and root source-identity mappings with separate exact ownership', () => {
    const { singlePick, multi, risk } = buildMinimalValidPipeline();
    const validBundle = buildMLBOfflineRecommendationBundle({
      singlePickRecommendationSet: singlePick,
      multiRecommendationSet: multi,
      multiRiskGuidanceSet: risk,
      recommendedAt: '2026-08-01T12:34:56.789Z',
    });
    if (!validBundle.ok) throw new Error('Expected valid bundle');

    const singlePickResult = validateMLBOfflineRecommendationBundle({
      ...validBundle.value,
      singlePickRecommendationSetId: 'bad-single',
    });
    expect(singlePickResult.ok).toBe(false);
    if (singlePickResult.ok) throw new Error('Expected failure');
    expect(singlePickResult.issues).toEqual([
      {
        code: 'SOURCE_IDENTITY_MISMATCH',
        path: '$.singlePickRecommendationSetId',
        message: 'Single-pick recommendation-set identity does not match embedded source',
      },
    ]);

    const multiResult = validateMLBOfflineRecommendationBundle({
      ...validBundle.value,
      multiRecommendationSetId: 'bad-multi',
    });
    expect(multiResult.ok).toBe(false);
    if (multiResult.ok) throw new Error('Expected failure');
    expect(multiResult.issues).toEqual([
      {
        code: 'SOURCE_IDENTITY_MISMATCH',
        path: '$.multiRecommendationSetId',
        message: 'Multi-recommendation-set identity does not match embedded source',
      },
    ]);

    const riskResult = validateMLBOfflineRecommendationBundle({
      ...validBundle.value,
      riskGuidanceSetId: 'bad-risk',
    });
    expect(riskResult.ok).toBe(false);
    if (riskResult.ok) throw new Error('Expected failure');
    expect(riskResult.issues).toEqual([
      {
        code: 'SOURCE_IDENTITY_MISMATCH',
        path: '$.riskGuidanceSetId',
        message: 'Risk-guidance-set identity does not match embedded source',
      },
    ]);

    const badBundleId = `${singlePick.recommendationSetId}::${multi.multiRecommendationSetId}::${risk.riskGuidanceSetId}::2026-08-01T12:34:56.789Z::offline-recommendation-bundle-v1`;
    const badSingleBundleId = `bad-single::${multi.multiRecommendationSetId}::${risk.riskGuidanceSetId}::2026-08-01T12:34:56.789Z::offline-recommendation-bundle-v1`;
    const bundleIdResult = validateMLBOfflineRecommendationBundle({
      ...validBundle.value,
      singlePickRecommendationSetId: 'bad-single',
      recommendationBundleId: badSingleBundleId,
    });
    expect(bundleIdResult.ok).toBe(false);
    if (bundleIdResult.ok) throw new Error('Expected failure');
    expect(bundleIdResult.issues).toEqual([
      {
        code: 'SOURCE_IDENTITY_MISMATCH',
        path: '$.singlePickRecommendationSetId',
        message: 'Single-pick recommendation-set identity does not match embedded source',
      },
      {
        code: 'RECOMMENDATION_BUNDLE_ID_MISMATCH',
        path: '$.recommendationBundleId',
        message: 'Recommendation bundle ID does not match deterministic identity',
      },
    ]);
  });

  it('validates Phase 8L recommendation lineage against embedded Phase 8M source metadata, IDs, probabilities, and legs', () => {
    const pipelineA = buildPipeline({
      releaseId: 'release-a',
      snapshotId1: 'snapshot-a1',
      gameId1: 'game-a1',
      snapshotId2: 'snapshot-a2',
      gameId2: 'game-a2',
      homeTeamId1: 'team-home-a1',
      awayTeamId1: 'team-away-a1',
      homeTeamId2: 'team-home-a2',
      awayTeamId2: 'team-away-a2',
    });
    const pipelineB = buildPipeline({
      releaseId: 'release-b',
      snapshotId1: 'snapshot-b1',
      gameId1: 'game-b1',
      snapshotId2: 'snapshot-b2',
      gameId2: 'game-b2',
      homeTeamId1: 'team-home-b1',
      awayTeamId1: 'team-away-b1',
      homeTeamId2: 'team-home-b2',
      awayTeamId2: 'team-away-b2',
    });

    const publicProposal = {
      contractVersion: MLB_OFFLINE_RECOMMENDATION_BUNDLE_CONTRACT_VERSION,
      sport: 'MLB',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
      compositionPolicy: MLB_OFFLINE_RECOMMENDATION_BUNDLE_COMPOSITION_POLICY,
      recommendationBundleId: `${pipelineA.singlePick.recommendationSetId}::${pipelineB.multi.multiRecommendationSetId}::${pipelineB.risk.riskGuidanceSetId}::2026-08-01T12:34:56.789Z::offline-recommendation-bundle-v1`,
      recommendedAt: '2026-08-01T12:34:56.789Z',
      singlePickRecommendationSetId: pipelineA.singlePick.recommendationSetId,
      multiRecommendationSetId: pipelineB.multi.multiRecommendationSetId,
      riskGuidanceSetId: pipelineB.risk.riskGuidanceSetId,
      sourceSinglePickRecommendationSet: pipelineA.singlePick,
      sourceMultiRecommendationSet: pipelineB.multi,
      sourceMultiRiskGuidanceSet: pipelineB.risk,
    };
    const publicResult = validateMLBOfflineRecommendationBundle(publicProposal);
    expect(publicResult.ok).toBe(false);
    if (publicResult.ok) throw new Error('Expected public failure');
    expect(publicResult.issues).toEqual([
      {
        code: 'SOURCE_IDENTITY_MISMATCH',
        path: '$.sourceSinglePickRecommendationSet',
        message: 'Single-pick recommendation set does not match embedded multi-candidate lineage',
      },
    ]);

    const builderResult = buildMLBOfflineRecommendationBundle({
      singlePickRecommendationSet: pipelineA.singlePick,
      multiRecommendationSet: pipelineB.multi,
      multiRiskGuidanceSet: pipelineB.risk,
      recommendedAt: '2026-08-01T12:34:56.789Z',
    });
    expect(builderResult.ok).toBe(false);
    if (builderResult.ok) throw new Error('Expected builder failure');
    expect(builderResult.issues).toEqual([
      {
        code: 'SOURCE_IDENTITY_MISMATCH',
        path: '$.singlePickRecommendationSet',
        message: 'Single-pick recommendation set does not match embedded multi-candidate lineage',
      },
    ]);
  });

  it('validates explicit Phase 8N equivalence with the Phase 8O embedded source without recomputing guidance', () => {
    const pipelineA = buildPipeline({
      releaseId: 'release-a',
      snapshotId1: 'snapshot-a1',
      gameId1: 'game-a1',
      snapshotId2: 'snapshot-a2',
      gameId2: 'game-a2',
      homeTeamId1: 'team-home-a1',
      awayTeamId1: 'team-away-a1',
      homeTeamId2: 'team-home-a2',
      awayTeamId2: 'team-away-a2',
    });
    const pipelineB = buildPipeline({
      releaseId: 'release-b',
      snapshotId1: 'snapshot-b1',
      gameId1: 'game-b1',
      snapshotId2: 'snapshot-b2',
      gameId2: 'game-b2',
      homeTeamId1: 'team-home-b1',
      awayTeamId1: 'team-away-b1',
      homeTeamId2: 'team-home-b2',
      awayTeamId2: 'team-away-b2',
    });

    const publicProposal = {
      contractVersion: MLB_OFFLINE_RECOMMENDATION_BUNDLE_CONTRACT_VERSION,
      sport: 'MLB',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
      compositionPolicy: MLB_OFFLINE_RECOMMENDATION_BUNDLE_COMPOSITION_POLICY,
      recommendationBundleId: `${pipelineA.singlePick.recommendationSetId}::${pipelineA.multi.multiRecommendationSetId}::${pipelineB.risk.riskGuidanceSetId}::2026-08-01T12:34:56.789Z::offline-recommendation-bundle-v1`,
      recommendedAt: '2026-08-01T12:34:56.789Z',
      singlePickRecommendationSetId: pipelineA.singlePick.recommendationSetId,
      multiRecommendationSetId: pipelineA.multi.multiRecommendationSetId,
      riskGuidanceSetId: pipelineB.risk.riskGuidanceSetId,
      sourceSinglePickRecommendationSet: pipelineA.singlePick,
      sourceMultiRecommendationSet: pipelineA.multi,
      sourceMultiRiskGuidanceSet: pipelineB.risk,
    };
    const publicResult = validateMLBOfflineRecommendationBundle(publicProposal);
    expect(publicResult.ok).toBe(false);
    if (publicResult.ok) throw new Error('Expected public failure');
    expect(publicResult.issues).toEqual([
      {
        code: 'SOURCE_IDENTITY_MISMATCH',
        path: '$.sourceMultiRecommendationSet',
        message: 'Multi-recommendation set does not match embedded risk-guidance lineage',
      },
    ]);

    const builderResult = buildMLBOfflineRecommendationBundle({
      singlePickRecommendationSet: pipelineA.singlePick,
      multiRecommendationSet: pipelineA.multi,
      multiRiskGuidanceSet: pipelineB.risk,
      recommendedAt: '2026-08-01T12:34:56.789Z',
    });
    expect(builderResult.ok).toBe(false);
    if (builderResult.ok) throw new Error('Expected builder failure');
    expect(builderResult.issues).toEqual([
      {
        code: 'SOURCE_IDENTITY_MISMATCH',
        path: '$.multiRecommendationSet',
        message: 'Multi-recommendation set does not match embedded risk-guidance lineage',
      },
    ]);
  });

  it('builds deterministic bundles for empty, one-selected, and two-selected recommendation universes', () => {
    const prediction1 = buildValidPrediction({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const prediction2 = buildValidPrediction({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      probabilities: { homeWinProbability: 0.25, awayWinProbability: 0.75 },
      predictedSide: 'AWAY',
      predictedTeamId: 'team-away-2',
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const prediction3 = buildValidPrediction({
      snapshotId: 'snapshot-3',
      gameId: 'game-3',
      probabilities: { homeWinProbability: 0.625, awayWinProbability: 0.375 },
      homeTeamId: 'team-home-3',
      awayTeamId: 'team-away-3',
    });

    const emptySlate = ensureValidSourceSlate([prediction1]);
    const emptySinglePick = ensureBuiltSinglePickRecommendationSet(emptySlate);
    const emptyCandidate = ensureValidCandidateSet(emptySinglePick);
    const emptyMulti = ensureValidMultiRecommendationSet(emptyCandidate);
    const emptyRisk = ensureValidRiskGuidanceSet(emptyMulti);

    const emptyResult = buildMLBOfflineRecommendationBundle({
      singlePickRecommendationSet: emptySinglePick,
      multiRecommendationSet: emptyMulti,
      multiRiskGuidanceSet: emptyRisk,
      recommendedAt: '2026-08-01T12:34:56.789Z',
    });
    expect(emptyResult.ok).toBe(true);
    if (!emptyResult.ok) throw new Error('Expected empty bundle');

    const oneSelectedSlate = ensureValidSourceSlate([prediction1, prediction2]);
    const oneSelectedSinglePick = ensureBuiltSinglePickRecommendationSet(oneSelectedSlate);
    const oneSelectedCandidate = ensureValidCandidateSet(oneSelectedSinglePick);
    const oneSelectedMulti = ensureValidMultiRecommendationSet(oneSelectedCandidate);
    const oneSelectedRisk = ensureValidRiskGuidanceSet(oneSelectedMulti);

    const oneSelected = buildMLBOfflineRecommendationBundle({
      singlePickRecommendationSet: oneSelectedSinglePick,
      multiRecommendationSet: oneSelectedMulti,
      multiRiskGuidanceSet: oneSelectedRisk,
      recommendedAt: '2026-08-01T12:34:56.789Z',
    });
    expect(oneSelected.ok).toBe(true);
    if (!oneSelected.ok) throw new Error('Expected one-selected bundle');

    const twoSelectedSlate = ensureValidSourceSlate([prediction1, prediction2, prediction3]);
    const twoSelectedSinglePick = ensureBuiltSinglePickRecommendationSet(twoSelectedSlate);
    const twoSelectedCandidate = ensureValidCandidateSet(twoSelectedSinglePick);
    const twoSelectedMulti = ensureValidMultiRecommendationSet(twoSelectedCandidate);
    const twoSelectedRisk = ensureValidRiskGuidanceSet(twoSelectedMulti);

    const twoSelected = buildMLBOfflineRecommendationBundle({
      singlePickRecommendationSet: twoSelectedSinglePick,
      multiRecommendationSet: twoSelectedMulti,
      multiRiskGuidanceSet: twoSelectedRisk,
      recommendedAt: '2026-08-01T12:34:56.789Z',
    });
    expect(twoSelected.ok).toBe(true);
    if (!twoSelected.ok) throw new Error('Expected two-selected bundle');
  });

  it('preserves exact upstream references, allocates only the Phase 8P root, repeats deterministically, and performs no mutation', () => {
    const { singlePick, candidate, multi, risk } = buildMinimalValidPipeline();
    const input: MLBOfflineRecommendationBundleInput = {
      singlePickRecommendationSet: singlePick,
      multiRecommendationSet: multi,
      multiRiskGuidanceSet: risk,
      recommendedAt: '2026-08-01T12:34:56.789Z',
    };
    const first = buildMLBOfflineRecommendationBundle(input);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('Expected first build');

    const second = buildMLBOfflineRecommendationBundle(input);
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error('Expected second build');

    expect(first.value).not.toBe(second.value);
    expect(first.value.sourceSinglePickRecommendationSet).toBe(singlePick);
    expect(first.value.sourceMultiRecommendationSet).toBe(multi);
    expect(first.value.sourceMultiRiskGuidanceSet).toBe(risk);
    expect(second.value.sourceSinglePickRecommendationSet).toBe(singlePick);
    expect(second.value.sourceMultiRecommendationSet).toBe(multi);
    expect(second.value.sourceMultiRiskGuidanceSet).toBe(risk);
    expect(first.value).toStrictEqual(second.value);
  });

  it('accepts structural clones for the bundle and all three embedded sources', () => {
    const { singlePick, multi, risk } = buildMinimalValidPipeline();
    const originalBundle = buildMLBOfflineRecommendationBundle({
      singlePickRecommendationSet: singlePick,
      multiRecommendationSet: multi,
      multiRiskGuidanceSet: risk,
      recommendedAt: '2026-08-01T12:34:56.789Z',
    });
    expect(originalBundle.ok).toBe(true);
    if (!originalBundle.ok) throw new Error('Expected valid bundle');

    const clonedSinglePick = structuredClone(originalBundle.value.sourceSinglePickRecommendationSet);
    const clonedMulti = structuredClone(originalBundle.value.sourceMultiRecommendationSet);
    const clonedRisk = {
      ...structuredClone(originalBundle.value.sourceMultiRiskGuidanceSet),
      sourceMultiRecommendationSet: structuredClone(originalBundle.value.sourceMultiRecommendationSet),
    };

    const clonedBundle = {
      ...originalBundle.value,
      sourceSinglePickRecommendationSet: clonedSinglePick,
      sourceMultiRecommendationSet: clonedMulti,
      sourceMultiRiskGuidanceSet: clonedRisk,
    };

    expect(clonedBundle).not.toBe(originalBundle.value);
    expect(clonedBundle.sourceSinglePickRecommendationSet).not.toBe(
      originalBundle.value.sourceSinglePickRecommendationSet,
    );
    expect(clonedBundle.sourceMultiRecommendationSet).not.toBe(
      originalBundle.value.sourceMultiRecommendationSet,
    );
    expect(clonedBundle.sourceMultiRiskGuidanceSet).not.toBe(
      originalBundle.value.sourceMultiRiskGuidanceSet,
    );
    expect(clonedBundle.sourceMultiRiskGuidanceSet.sourceMultiRecommendationSet).not.toBe(
      clonedBundle.sourceMultiRecommendationSet,
    );

    const originalFirstRec = originalBundle.value.sourceSinglePickRecommendationSet.recommendations[0];
    const clonedFirstRec = clonedBundle.sourceSinglePickRecommendationSet.recommendations[0];
    expect(clonedFirstRec.probabilities).not.toBe(originalFirstRec.probabilities);
    expect(clonedFirstRec.probabilities).toEqual(originalFirstRec.probabilities);

    const result = validateMLBOfflineRecommendationBundle(clonedBundle);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful validation');
    expect(result.value).toBe(clonedBundle);
  });

  it('rejects odds contamination and prohibited concepts while classifying unsupported fields as unknown and allowing embedded risk-unit vocabulary', () => {
    const { singlePick, multi, risk } = buildMinimalValidPipeline();
    const validBundle = buildMLBOfflineRecommendationBundle({
      singlePickRecommendationSet: singlePick,
      multiRecommendationSet: multi,
      multiRiskGuidanceSet: risk,
      recommendedAt: '2026-08-01T12:34:56.789Z',
    });
    expect(validBundle.ok).toBe(true);
    if (!validBundle.ok) throw new Error('Expected valid bundle');

    const oddsFields = [
      'sportsbook',
      'odds',
      'price',
      'line',
      'market',
      'edge',
      'value',
      'payout',
      'profit',
    ];

    for (const field of oddsFields) {
      const oddsRoot = { ...validBundle.value, [field]: 'contaminated' };
      const oddsResult = validateMLBOfflineRecommendationBundle(oddsRoot);
      expect(oddsResult.ok).toBe(false);
      if (oddsResult.ok) throw new Error(`Expected odds contamination for ${field}`);
      expect(oddsResult.issues).toEqual([
        {
          code: 'ODDS_CONTAMINATION',
          path: '$',
          message: 'Odds contamination detected',
        },
      ]);
    }

    const stakeRoot = { ...validBundle.value, stake: 100 };
    const stakeResult = validateMLBOfflineRecommendationBundle(stakeRoot);
    expect(stakeResult.ok).toBe(false);
    if (stakeResult.ok) throw new Error('Expected prohibited concept');
    expect(stakeResult.issues).toEqual([
      {
        code: 'PROHIBITED_CONCEPT',
        path: '$.stake',
        message: 'Prohibited concept detected',
      },
    ]);

    const gradeRoot = { ...validBundle.value, grade: 'A' };
    const gradeResult = validateMLBOfflineRecommendationBundle(gradeRoot);
    expect(gradeResult.ok).toBe(false);
    if (gradeResult.ok) throw new Error('Expected prohibited concept');
    expect(gradeResult.issues).toEqual([
      {
        code: 'PROHIBITED_CONCEPT',
        path: '$.grade',
        message: 'Prohibited concept detected',
      },
    ]);

    const unknownFields = [
      'bankroll',
      'currency',
      'monetaryStake',
      'return',
      'route',
      'ui',
      'persistence',
    ];

    for (const field of unknownFields) {
      const unknownRoot = { ...validBundle.value, [field]: 'bad' };
      const unknownResult = validateMLBOfflineRecommendationBundle(unknownRoot);
      expect(unknownResult.ok).toBe(false);
      if (unknownResult.ok) throw new Error(`Expected unknown field for ${field}`);
      expect(unknownResult.issues).toEqual([
        {
          code: 'UNKNOWN_FIELD',
          path: `$.${field}`,
          message: `Unknown field: ${field}`,
        },
      ]);
    }

    const builderInput = {
      singlePickRecommendationSet: singlePick,
      multiRecommendationSet: multi,
      multiRiskGuidanceSet: risk,
      recommendedAt: '2026-08-01T12:34:56.789Z',
      bankroll: 1000,
    };
    const builderResult = buildMLBOfflineRecommendationBundle(builderInput);
    expect(builderResult.ok).toBe(false);
    if (builderResult.ok) throw new Error('Expected unknown builder field');
    expect(builderResult.issues).toEqual([
      {
        code: 'UNKNOWN_FIELD',
        path: '$.bankroll',
        message: 'Unknown field: bankroll',
      },
    ]);
  });

  it('verifies deterministic issue ordering, exact exports and imports, no upstream rebuilding, no money, no routes, no UI, no persistence, no grading, no current time, no randomness, and no network access', async () => {
    const sourcePath = new URL('../../../src/prediction/mlb/mlb-offline-recommendation-bundle-contract.ts', import.meta.url).pathname;
    const sourceText = await readFile(sourcePath, 'utf8');

    const exports = sourceText.match(/\bexport\s+(?:const|type|function)\s+([A-Za-z0-9_]+)/g);
    const exportNames = exports?.map((m) => m.replace(/^export\s+(?:const|type|function)\s+/, '')) ?? [];
    expect(exportNames).toEqual([
      'MLB_OFFLINE_RECOMMENDATION_BUNDLE_CONTRACT_VERSION',
      'MLB_OFFLINE_RECOMMENDATION_BUNDLE_COMPOSITION_POLICY',
      'MLBOfflineRecommendationBundleInput',
      'MLBOfflineRecommendationBundle',
      'MLBOfflineRecommendationBundleIssue',
      'validateMLBOfflineRecommendationBundle',
      'buildMLBOfflineRecommendationBundle',
    ]);

    const imports = sourceText.match(/\bfrom\s+['"]([^'"]+)['"]/g);
    const importPaths = imports?.map((m) => m.replace(/^from\s+['"]|['"]$/g, '')) ?? [];
    expect(importPaths).toEqual([
      '../firewall/odds-contamination-guard',
      './mlb-offline-single-pick-recommendation-contract',
      './mlb-offline-multi-recommendation-contract',
      './mlb-offline-multi-risk-guidance-contract',
    ]);

    const prohibitedPatterns = [
      'JSON.stringify',
      'JSON.parse',
      'localeCompare',
      'Date.now',
      'Date.parse',
      'new Date',
      'toISOString',
      'performance.now',
      'Math.random',
      'randomUUID',
      'fetch(',
      'PrismaClient',
      'process.env',
      'buildMLBOfflineSinglePickRecommendationSet(',
      'buildMLBOfflineMultiCandidateSet(',
      'buildMLBOfflineMultiRecommendationSet(',
      'buildMLBOfflineMultiRiskGuidanceSet(',
    ];

    for (const pattern of prohibitedPatterns) {
      expect(sourceText).not.toContain(pattern);
    }

    expect((sourceText.match(/\bfunction\s+validateMLBOfflineRecommendationBundle\s*\(/g) ?? []).length).toBe(1);
    expect((sourceText.match(/\bfunction\s+buildMLBOfflineRecommendationBundle\s*\(/g) ?? []).length).toBe(1);
    expect((sourceText.match(/\bisProhibitedOddsBoundaryKey\s*\(/g) ?? []).length).toBe(1);
    expect((sourceText.match(/\bassertNoOddsContamination\s*\(/g) ?? []).length).toBe(1);
  });
});
