import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  MLB_OFFLINE_MULTI_RISK_GUIDANCE_SET_CONTRACT_VERSION,
  MLB_OFFLINE_MULTI_RISK_GUIDANCE_POLICY,
  type MLBOfflineMultiRiskGuidanceSet,
  type MLBOfflineMultiRiskGuidanceSetIssue,
  buildMLBOfflineMultiRiskGuidanceSet,
  validateMLBOfflineMultiRiskGuidanceSet,
} from '@/prediction/mlb/mlb-offline-multi-risk-guidance-contract';
import {
  buildMLBOfflineMultiCandidateSet,
  type MLBOfflineMultiCandidateSet,
  validateMLBOfflineMultiCandidateSet,
} from '@/prediction/mlb/mlb-offline-multi-candidate-contract';
import {
  validateMLBOfflineSinglePickRecommendationSet,
} from '@/prediction/mlb/mlb-offline-single-pick-recommendation-contract';
import {
  buildMLBOfflineMultiRecommendationSet,
  type MLBOfflineMultiRecommendationSet,
  validateMLBOfflineMultiRecommendationSet,
} from '@/prediction/mlb/mlb-offline-multi-recommendation-contract';

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
  homeWinProbability?: number;}

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
  const awayWinProbability = 1 - homeWinProbability;

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

function buildGuidanceSet(
  sourceSet: MLBOfflineMultiRecommendationSet,
): MLBOfflineMultiRiskGuidanceSet {
  const built = buildMLBOfflineMultiRiskGuidanceSet(sourceSet);
  if (!built.ok) {
    const issueMessages = built.issues.map((issue) => `${issue.code}:${issue.path}`).join(', ');
    throw new Error(`Invalid guidance set: ${issueMessages}`);
  }
  return built.value;
}

function buildMinimalValidSourceSet(): MLBOfflineMultiRecommendationSet {
  const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
  const rec2 = buildRecommendation({
    snapshotId: 'snapshot-2',
    gameId: 'game-2',
    homeWinProbability: 0.25,
    homeTeamId: 'team-home-2',
    awayTeamId: 'team-away-2',
  });
  return ensureValidMultiRecommendationSet(
    ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2])),
  );
}

describe('mlb-offline-multi-risk-guidance-contract', () => {
  it('accepts a minimal valid risk-guidance set and returns the exact original reference', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidMultiRecommendationSet(
      ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2])),
    );
    const built = buildMLBOfflineMultiRiskGuidanceSet(sourceSet);
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('Expected successful build');
    const validated = validateMLBOfflineMultiRiskGuidanceSet(built.value);
    expect(validated.ok).toBe(true);
    if (!validated.ok) throw new Error('Expected successful validation');
    expect(validated.value).toBe(built.value);
  });

  it('validates exact root fields, literals, source lineage, policy, counts, and deterministic risk-guidance-set identity', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidMultiRecommendationSet(
      ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2])),
    );
    const result = buildMLBOfflineMultiRiskGuidanceSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    const set = result.value;
    expect(set.contractVersion).toBe('mlb-offline-multi-risk-guidance-set-v1');
    expect(set.sport).toBe('MLB');
    expect(set.target).toBe('OFFICIAL_FINAL_GAME_WINNER');
    expect(set.targetEncoding).toBe('HOME_WIN_1_AWAY_WIN_0');
    expect(set.riskGuidanceSetId).toBe(`${sourceSet.multiRecommendationSetId}::offline-multi-risk-guidance-set-v1`);
    expect(set.multiRecommendationSetId).toBe(sourceSet.multiRecommendationSetId);
    expect(set.policy).toBe('MODEL_CONFIDENCE_CONCENTRATION_RISK_UNITS_V1');
    expect(set.sourceMultiRecommendationSet).toBe(sourceSet);
    expect(set.guidanceEntryCount).toBe(set.guidanceEntries.length);
    expect(set.guidanceEntryIds).toHaveLength(set.guidanceEntries.length);
    expect(set.guidanceEntries.length).toBe(1);
  });

  it('validates the embedded Phase 8N multi-recommendation set before guidance semantics', () => {
    const invalidSource = { invalid: true };
    const result = buildMLBOfflineMultiRiskGuidanceSet(invalidSource);
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

  it('validates the exact seven-field guidance-entry shape and selected-candidate membership', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidMultiRecommendationSet(
      ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2])),
    );
    const result = buildMLBOfflineMultiRiskGuidanceSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    for (const entry of result.value.guidanceEntries) {
      const expectedFields = [
        'guidanceEntryId',
        'candidateId',
        'baseRiskUnits',
        'sharedRecommendationIds',
        'overlapAdjustmentUnits',
        'portfolioCapAdjustmentUnits',
        'recommendedRiskUnits',
      ];
      expect(Object.keys(entry).sort()).toEqual(expectedFields.sort());
      const sourceCandidate = sourceSet.selectedRecommendations.find(
        (c) => c.candidateId === entry.candidateId,
      );
      expect(sourceCandidate).toBeDefined();
    }
  });

  it('validates descriptor-safe roots, arrays, embedded sources, guidance entries, symbols, classes, and accessors without invoking getters', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidMultiRecommendationSet(
      ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2])),
    );
    const built = buildMLBOfflineMultiRiskGuidanceSet(sourceSet);
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('Expected successful build');

    let rootFieldAccessorCount = 0;
    const rootBase: Record<string, unknown> = { ...built.value };
    delete rootBase.contractVersion;
    Object.defineProperty(rootBase, 'contractVersion', {
      get() { rootFieldAccessorCount++; throw new Error('root accessor'); },
    });
    const rootResult = validateMLBOfflineMultiRiskGuidanceSet(rootBase);
    expect(rootResult.ok).toBe(false);
    if (rootResult.ok) throw new Error('Expected invalid');
    expect(rootFieldAccessorCount).toBe(0);

    let sourceAccessorCount = 0;
    const sourceBase: Record<string, unknown> = { ...built.value };
    Object.defineProperty(sourceBase, 'sourceMultiRecommendationSet', {
      get() { sourceAccessorCount++; throw new Error('source accessor'); },
    });
    const sourceResult = validateMLBOfflineMultiRiskGuidanceSet(sourceBase);
    expect(sourceResult.ok).toBe(false);
    if (sourceResult.ok) throw new Error('Expected invalid');
    expect(sourceAccessorCount).toBe(0);

    let entryAccessorCount = 0;
    const entryBase: Record<string, unknown> = { ...built.value };
    const entries = (entryBase.guidanceEntries as readonly Record<string, unknown>[]).map((e) => ({ ...e }));
    Object.defineProperty(entries[0], 'baseRiskUnits', {
      get() { entryAccessorCount++; throw new Error('entry accessor'); },
    });
    const entryResult = validateMLBOfflineMultiRiskGuidanceSet({
      ...entryBase,
      guidanceEntries: entries,
    });
    expect(entryResult.ok).toBe(false);
    if (entryResult.ok) throw new Error('Expected invalid');
    expect(entryAccessorCount).toBe(0);
  });

  it('maps an invalid Phase 8N builder source to one SOURCE_MULTI_RECOMMENDATION_SET_INVALID issue without partial output or pre-validation access', () => {
    const invalidSource = { invalid: true };
    const result = buildMLBOfflineMultiRiskGuidanceSet(invalidSource);
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

  it('builds a valid empty risk-guidance set when the source has no selected recommendations', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const sourceSet = ensureValidMultiRecommendationSet(
      ensureValidCandidateSet(ensureValidRecommendationSet([rec1])),
    );
    const result = buildMLBOfflineMultiRiskGuidanceSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    expect(result.value.guidanceEntryCount).toBe(0);
    expect(result.value.guidanceEntryIds).toHaveLength(0);
    expect(result.value.guidanceEntries).toHaveLength(0);
    expect(result.value.portfolioTotalRiskUnits).toBe(0);
  });

  it('builds exactly one guidance entry for one selected recommendation', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidMultiRecommendationSet(
      ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2])),
    );
    const result = buildMLBOfflineMultiRiskGuidanceSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    expect(result.value.guidanceEntries).toHaveLength(1);
    expect(result.value.guidanceEntryIds).toHaveLength(1);
    expect(result.value.guidanceEntries[0].sharedRecommendationIds).toHaveLength(0);
    expect(result.value.guidanceEntries[0].overlapAdjustmentUnits).toBe(0);
  });

  it('builds exactly two guidance entries in source order for two selected recommendations', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const rec3 = buildRecommendation({
      snapshotId: 'snapshot-3',
      gameId: 'game-3',
      homeWinProbability: 0.625,
      homeTeamId: 'team-home-3',
      awayTeamId: 'team-away-3',
    });
    const sourceSet = ensureValidMultiRecommendationSet(
      ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2, rec3])),
    );
    const result = buildMLBOfflineMultiRiskGuidanceSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    expect(result.value.guidanceEntries).toHaveLength(2);
    expect(result.value.guidanceEntries[0].candidateId).toBe(sourceSet.selectedRecommendations[0].candidateId);
    expect(result.value.guidanceEntries[1].candidateId).toBe(sourceSet.selectedRecommendations[1].candidateId);
  });

  it('applies exact minimum-confidence bands and mean-confidence bonuses at every boundary', () => {
    const assertBase = (confidence: number, expected: number) => {
      const homeWin = confidence >= 0.5 ? confidence : 1 - confidence;
      const awayWin = confidence >= 0.5 ? 1 - confidence : confidence;
      const rec1 = buildRecommendation({
        snapshotId: `snapshot-${confidence}-1`,
        gameId: `game-${confidence}-1`,
        homeWinProbability: homeWin,
      });
      const rec2 = buildRecommendation({
        snapshotId: `snapshot-${confidence}-2`,
        gameId: `game-${confidence}-2`,
        homeWinProbability: homeWin,
      });
      const sourceSet = ensureValidMultiRecommendationSet(
        ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2])),
      );
      const result = buildMLBOfflineMultiRiskGuidanceSet(sourceSet);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected successful build');
      expect(result.value.guidanceEntries).toHaveLength(1);
      expect(result.value.guidanceEntries[0].baseRiskUnits).toBe(expected);
    };

    assertBase(0.59, 1);
    assertBase(0.60, 2);
    assertBase(0.69, 2);
    assertBase(0.70, 3);
    assertBase(0.79, 3);
    assertBase(0.80, 4);
    assertBase(0.89, 4);
    assertBase(0.90, 5);
    assertBase(0.99, 5);

    const recLow = buildRecommendation({
      snapshotId: 'snapshot-bonus-low',
      gameId: 'game-bonus-low',
      homeWinProbability: 0.70,
    });
    const recHigh = buildRecommendation({
      snapshotId: 'snapshot-bonus-high',
      gameId: 'game-bonus-high',
      homeWinProbability: 0.90,
    });
    const bonusSourceSet = ensureValidMultiRecommendationSet(
      ensureValidCandidateSet(ensureValidRecommendationSet([recLow, recHigh])),
    );
    const bonusResult = buildMLBOfflineMultiRiskGuidanceSet(bonusSourceSet);
    expect(bonusResult.ok).toBe(true);
    if (!bonusResult.ok) throw new Error('Expected successful build');
    expect(bonusResult.value.guidanceEntries).toHaveLength(1);
    expect(bonusResult.value.guidanceEntries[0].baseRiskUnits).toBe(4);
  });

  it('applies the exact three-leg penalty without double-counting maximum uncertainty', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const rec3 = buildRecommendation({
      snapshotId: 'snapshot-3',
      gameId: 'game-3',
      homeWinProbability: 0.25,
      homeTeamId: 'team-home-3',
      awayTeamId: 'team-away-3',
    });
    const sourceSet = ensureValidMultiRecommendationSet(
      ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2, rec3])),
    );
    const result = buildMLBOfflineMultiRiskGuidanceSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    const twoLeg = result.value.guidanceEntries.find((e) => e.candidateId === sourceSet.selectedRecommendations[0].candidateId);
    const threeLeg = result.value.guidanceEntries.find((e) => e.candidateId === sourceSet.selectedRecommendations[1].candidateId);
    expect(twoLeg).toBeDefined();
    expect(threeLeg).toBeDefined();
    if (!twoLeg || !threeLeg) throw new Error('Expected both entries');
    expect(threeLeg.baseRiskUnits).toBe(twoLeg.baseRiskUnits - 1);
  });

  it('derives exact incremental shared recommendation IDs in JavaScript code-unit order', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const rec3 = buildRecommendation({
      snapshotId: 'snapshot-3',
      gameId: 'game-3',
      homeWinProbability: 0.625,
      homeTeamId: 'team-home-3',
      awayTeamId: 'team-away-3',
    });
    const sourceSet = ensureValidMultiRecommendationSet(
      ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2, rec3])),
    );
    const result = buildMLBOfflineMultiRiskGuidanceSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    const first = result.value.guidanceEntries[0];
    const second = result.value.guidanceEntries[1];
    for (const id of first.sharedRecommendationIds) {
      expect(second.sharedRecommendationIds).toContain(id);
    }
    for (let i = 1; i < second.sharedRecommendationIds.length; i++) {
      const prev = second.sharedRecommendationIds[i - 1];
      const curr = second.sharedRecommendationIds[i];
      expect(prev < curr).toBe(true);
    }
  });

  it('applies exact overlap adjustment only to later source entries', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const rec3 = buildRecommendation({
      snapshotId: 'snapshot-3',
      gameId: 'game-3',
      homeWinProbability: 0.625,
      homeTeamId: 'team-home-3',
      awayTeamId: 'team-away-3',
    });
    const sourceSet = ensureValidMultiRecommendationSet(
      ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2, rec3])),
    );
    const result = buildMLBOfflineMultiRiskGuidanceSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    const first = result.value.guidanceEntries[0];
    const second = result.value.guidanceEntries[1];
    expect(first.overlapAdjustmentUnits).toBe(0);
    expect(second.overlapAdjustmentUnits).toBe(second.sharedRecommendationIds.length);
  });

  it('applies the exact portfolio cap and higher-index-first reduction', () => {
    const rec1 = buildRecommendation({
      snapshotId: 'snapshot-high',
      gameId: 'game-high',
      homeWinProbability: 0.9,
    });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-mid',
      gameId: 'game-mid',
      homeWinProbability: 0.9,
      homeTeamId: 'team-home-mid',
      awayTeamId: 'team-away-mid',
    });
    const rec3 = buildRecommendation({
      snapshotId: 'snapshot-low',
      gameId: 'game-low',
      homeWinProbability: 0.9,
      homeTeamId: 'team-home-low',
      awayTeamId: 'team-away-low',
    });
    const sourceSet = ensureValidMultiRecommendationSet(
      ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2, rec3])),
    );
    const result = buildMLBOfflineMultiRiskGuidanceSet(sourceSet);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected successful build');
    expect(result.value.portfolioTotalRiskUnits).toBe(6);
    const first = result.value.guidanceEntries[0];
    const second = result.value.guidanceEntries[1];
    expect(first.baseRiskUnits).toBe(5);
    expect(first.sharedRecommendationIds).toHaveLength(0);
    expect(first.overlapAdjustmentUnits).toBe(0);
    expect(first.portfolioCapAdjustmentUnits).toBe(0);
    expect(first.recommendedRiskUnits).toBe(5);
    expect(second.baseRiskUnits).toBe(4);
    expect(second.sharedRecommendationIds).toHaveLength(2);
    expect(second.overlapAdjustmentUnits).toBe(2);
    expect(second.portfolioCapAdjustmentUnits).toBe(1);
    expect(second.recommendedRiskUnits).toBe(1);
  });

  it('derives deterministic entry IDs, root identity, and guidance-ID-array mapping', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidMultiRecommendationSet(
      ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2])),
    );
    const first = buildMLBOfflineMultiRiskGuidanceSet(sourceSet);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('Expected successful build');
    const second = buildMLBOfflineMultiRiskGuidanceSet(sourceSet);
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error('Expected successful build');

    expect(second.value).not.toBe(first.value);
    expect(second.value.guidanceEntryIds).not.toBe(first.value.guidanceEntryIds);
    expect(second.value.guidanceEntries).not.toBe(first.value.guidanceEntries);
    for (let i = 0; i < second.value.guidanceEntries.length; i++) {
      expect(second.value.guidanceEntries[i]).toStrictEqual(first.value.guidanceEntries[i]);
    }

    for (let i = 0; i < first.value.guidanceEntries.length; i++) {
      expect(first.value.guidanceEntryIds[i]).toBe(first.value.guidanceEntries[i].guidanceEntryId);
    }
    expect(first.value.riskGuidanceSetId).toBe(`${sourceSet.multiRecommendationSetId}::offline-multi-risk-guidance-set-v1`);
  });

  it('rejects duplicate guidance identities, count mismatches, order mismatches, and set-ID mismatches with exact ownership', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const rec3 = buildRecommendation({
      snapshotId: 'snapshot-3',
      gameId: 'game-3',
      homeWinProbability: 0.625,
      homeTeamId: 'team-home-3',
      awayTeamId: 'team-away-3',
    });
    const sourceSet = ensureValidMultiRecommendationSet(
      ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2, rec3])),
    );
    const built = buildMLBOfflineMultiRiskGuidanceSet(sourceSet);
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('Expected successful build');

    const selected = built.value.guidanceEntries[0];
    const second = built.value.guidanceEntries[1];

    const duplicateSet = {
      ...built.value,
      guidanceEntries: [selected, { ...selected, guidanceEntryId: selected.guidanceEntryId }],
      guidanceEntryIds: [selected.guidanceEntryId, selected.guidanceEntryId],
      guidanceEntryCount: 2,
    };
    const duplicateResult = validateMLBOfflineMultiRiskGuidanceSet(duplicateSet);
    expect(duplicateResult.ok).toBe(false);
    if (duplicateResult.ok) throw new Error('Expected failure');
    expect(duplicateResult.issues).toEqual([
      {
        code: 'DUPLICATE_GUIDANCE_ENTRY_ID',
        path: '$.guidanceEntries[1].guidanceEntryId',
        message: 'Duplicate guidance entry identity',
      },
    ]);

    const countMismatchSet = {
      ...built.value,
      guidanceEntryCount: built.value.guidanceEntryCount + 1,
    };
    const countResult = validateMLBOfflineMultiRiskGuidanceSet(countMismatchSet);
    expect(countResult.ok).toBe(false);
    if (countResult.ok) throw new Error('Expected failure');
    expect(countResult.issues).toEqual([
      {
        code: 'GUIDANCE_ENTRY_COUNT_MISMATCH',
        path: '$.guidanceEntryCount',
        message: 'Guidance entry count does not match guidance arrays',
      },
    ]);

    const reversedSet = {
      ...built.value,
      guidanceEntries: [{ ...second }, { ...selected }],
      guidanceEntryIds: [...built.value.guidanceEntryIds].reverse(),
      guidanceEntryCount: 2,
    };
    const orderResult = validateMLBOfflineMultiRiskGuidanceSet(reversedSet);
    expect(orderResult.ok).toBe(false);
    if (orderResult.ok) throw new Error('Expected failure');
    expect(orderResult.issues).toEqual([
      {
        code: 'ORDER_MISMATCH',
        path: '$.guidanceEntries',
        message: 'Guidance entries are not in source order',
      },
    ]);

    const setIdMismatchSet = {
      ...built.value,
      riskGuidanceSetId: 'bad-id',
    };
    const setIdResult = validateMLBOfflineMultiRiskGuidanceSet(setIdMismatchSet);
    expect(setIdResult.ok).toBe(false);
    if (setIdResult.ok) throw new Error('Expected failure');
    expect(setIdResult.issues).toEqual([
      {
        code: 'RISK_GUIDANCE_SET_ID_MISMATCH',
        path: '$.riskGuidanceSetId',
        message: 'Risk-guidance set ID does not match deterministic identity',
      },
    ]);
  });

  it('proves exact one-entry-per-selected-recommendation completeness', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const rec3 = buildRecommendation({
      snapshotId: 'snapshot-3',
      gameId: 'game-3',
      homeWinProbability: 0.625,
      homeTeamId: 'team-home-3',
      awayTeamId: 'team-away-3',
    });
    const sourceSet = ensureValidMultiRecommendationSet(
      ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2, rec3])),
    );
    const built = buildMLBOfflineMultiRiskGuidanceSet(sourceSet);
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('Expected successful build');

    const omittedSet = {
      ...built.value,
      guidanceEntries: [built.value.guidanceEntries[0]],
      guidanceEntryIds: [built.value.guidanceEntryIds[0]],
      guidanceEntryCount: 1,
    };
    const omittedResult = validateMLBOfflineMultiRiskGuidanceSet(omittedSet);
    expect(omittedResult.ok).toBe(false);
    if (omittedResult.ok) throw new Error('Expected failure');
    expect(omittedResult.issues).toEqual([
      {
        code: 'GUIDANCE_COMPLETENESS_MISMATCH',
        path: '$.guidanceEntries',
        message: 'Guidance entries do not match the selected-recommendation universe',
      },
    ]);
  });

  it('accepts structural clones and preserves exact builder references without mutation', () => {
    const rec1 = buildRecommendation({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const rec2 = buildRecommendation({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeWinProbability: 0.25,
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
    });
    const sourceSet = ensureValidMultiRecommendationSet(
      ensureValidCandidateSet(ensureValidRecommendationSet([rec1, rec2])),
    );
    const built = buildMLBOfflineMultiRiskGuidanceSet(sourceSet);
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('Expected successful build');

    const clone = JSON.parse(JSON.stringify(built.value));
    const validated = validateMLBOfflineMultiRiskGuidanceSet(clone);
    expect(validated.ok).toBe(true);
    if (!validated.ok) throw new Error('Expected successful validation');

    expect(built.value.sourceMultiRecommendationSet).toBe(sourceSet);
    const sourceBefore = sourceSet.selectedRecommendations.length;
    const source = built.value.sourceMultiRecommendationSet;
    expect(source.selectedRecommendations.length).toBe(sourceBefore);
  });

  it('rejects odds contamination and prohibited concepts while classifying unsupported fields as unknown and allowing risk-unit vocabulary', () => {
    const sourceSet = buildMinimalValidSourceSet();
    const built = buildMLBOfflineMultiRiskGuidanceSet(sourceSet);
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('Expected valid source');
    const base = { ...built.value };

    const fields: Array<{ key: string; code: string; path: string; value: unknown }> = [
      { key: 'sportsbook', code: 'ODDS_CONTAMINATION', path: '$', value: 'draftkings' },
      { key: 'odds', code: 'ODDS_CONTAMINATION', path: '$', value: 1.5 },
      { key: 'price', code: 'ODDS_CONTAMINATION', path: '$', value: 1.5 },
      { key: 'line', code: 'ODDS_CONTAMINATION', path: '$', value: 'spread' },
      { key: 'market', code: 'ODDS_CONTAMINATION', path: '$', value: 'favorite' },
      { key: 'edge', code: 'ODDS_CONTAMINATION', path: '$', value: 0.05 },
      { key: 'value', code: 'ODDS_CONTAMINATION', path: '$', value: 0.05 },
      { key: 'payout', code: 'ODDS_CONTAMINATION', path: '$', value: 100 },
      { key: 'stake', code: 'PROHIBITED_CONCEPT', path: '$.stake', value: 'high' },
      { key: 'grade', code: 'PROHIBITED_CONCEPT', path: '$.grade', value: 'A' },
      { key: 'bankroll', code: 'UNKNOWN_FIELD', path: '$.bankroll', value: 100 },
      { key: 'currency', code: 'UNKNOWN_FIELD', path: '$.currency', value: 'USD' },
      { key: 'monetaryStake', code: 'UNKNOWN_FIELD', path: '$.monetaryStake', value: 50 },
      { key: 'profit', code: 'ODDS_CONTAMINATION', path: '$', value: 25 },
      { key: 'return', code: 'UNKNOWN_FIELD', path: '$.return', value: 75 },
      { key: 'route', code: 'UNKNOWN_FIELD', path: '$.route', value: '/api' },
      { key: 'ui', code: 'UNKNOWN_FIELD', path: '$.ui', value: true },
      { key: 'persistence', code: 'UNKNOWN_FIELD', path: '$.persistence', value: true },
    ];

    for (const field of fields) {
      const input = { ...base, [field.key]: field.value };
      const result = validateMLBOfflineMultiRiskGuidanceSet(input);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error(`Expected invalid for ${field.key}`);
      expect(result.issues).toEqual([
        {
          code: field.code,
          path: field.path,
          message: field.code === 'ODDS_CONTAMINATION'
            ? 'Odds contamination detected'
            : field.code === 'PROHIBITED_CONCEPT'
              ? 'Prohibited concept detected'
              : `Unknown field: ${field.key}`,
        },
      ]);
    }

    const accepted = { ...base };
    const acceptedResult = validateMLBOfflineMultiRiskGuidanceSet(accepted);
    expect(acceptedResult.ok).toBe(true);
    if (!acceptedResult.ok) throw new Error('Expected valid');
  });

  it('verifies exact exports and imports, no upstream rebuilding, no money, no routes, no UI, no persistence, no current time, no randomness, and no network access', async () => {
    const content = await readFile(
      new URL(
        '../../../src/prediction/mlb/mlb-offline-multi-risk-guidance-contract.ts',
        import.meta.url,
      ),
      'utf8',
    );

    const exportMatches = content.match(/\bexport\s+(?:const|type|function)\s+([A-Za-z0-9_]+)/g) ?? [];
    const exportNames = exportMatches.map((match) => match.replace(/\bexport\s+(?:const|type|function)\s+/, ''));
    expect(exportNames).toEqual([
      'MLB_OFFLINE_MULTI_RISK_GUIDANCE_SET_CONTRACT_VERSION',
      'MLB_OFFLINE_MULTI_RISK_GUIDANCE_POLICY',
      'MLBOfflineRiskGuidanceEntry',
      'MLBOfflineMultiRiskGuidanceSet',
      'MLBOfflineMultiRiskGuidanceSetIssue',
      'validateMLBOfflineMultiRiskGuidanceSet',
      'buildMLBOfflineMultiRiskGuidanceSet',
    ]);

    const rawLines = content.split('\n');
    const importLines: string[] = [];
    for (const line of rawLines) {
      if (line.includes("from '") || line.includes('from "')) {
        importLines.push(line);
      }
    }
    const importSources: string[] = [];
    for (const line of importLines) {
      const match = line.match(/from\s+['"]([^'"]+)['"]/);
      if (match) {
        importSources.push(match[1]);
      }
    }
    expect(importSources).toEqual([
      '../firewall/odds-contamination-guard',
      './mlb-offline-multi-recommendation-contract',
    ]);

    expect(content).not.toContain('buildMLBOfflineMultiRecommendationSet');
    expect(content).not.toContain('buildMLBOfflineMultiCandidateSet');
    expect(content).not.toContain('buildMLBOfflineSinglePickRecommendationSet');
    expect(content).not.toContain('PrismaClient');
    expect(content).not.toContain('Math.random');
    expect(content).not.toContain('Date.now');
    expect(content).not.toContain('fetch(');
    expect(content).not.toContain('process.env');
    expect(content).not.toContain('console.log');
    expect(content).not.toContain('console.debug');
  });
});
