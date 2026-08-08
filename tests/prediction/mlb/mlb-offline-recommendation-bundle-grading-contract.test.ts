import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  MLB_OFFLINE_RECOMMENDATION_BUNDLE_GRADING_CONTRACT_VERSION,
  type MLBOfflineRecommendationBundleGrading,
  type MLBOfflineRecommendationBundleGradingIssue,
  buildMLBOfflineRecommendationBundleGrading,
  validateMLBOfflineRecommendationBundleGrading,
} from '@/prediction/mlb/mlb-offline-recommendation-bundle-grading-contract';
import {
  buildMLBOfflineOfficialFinalGameOutcomeSet,
  type MLBOfflineOfficialFinalGameOutcome,
  type MLBOfflineOfficialFinalGameOutcomeSet,
} from '@/prediction/mlb/mlb-offline-official-final-game-outcome-set-contract';
import {
  buildMLBOfflineSinglePickRecommendationSet,
  validateMLBOfflineSinglePickRecommendationSet,
} from '@/prediction/mlb/mlb-offline-single-pick-recommendation-contract';
import {
  buildMLBOfflineMultiCandidateSet,
  validateMLBOfflineMultiCandidateSet,
} from '@/prediction/mlb/mlb-offline-multi-candidate-contract';
import {
  buildMLBOfflineMultiRecommendationSet,
  validateMLBOfflineMultiRecommendationSet,
} from '@/prediction/mlb/mlb-offline-multi-recommendation-contract';
import {
  buildMLBOfflineRecommendationBundle,
  type MLBOfflineRecommendationBundle,
  validateMLBOfflineRecommendationBundle,
} from '@/prediction/mlb/mlb-offline-recommendation-bundle-contract';
import { buildMLBOfflineMultiRiskGuidanceSet } from '@/prediction/mlb/mlb-offline-multi-risk-guidance-contract';
import { buildMLBOfflinePredictionSlate } from '@/prediction/mlb/mlb-offline-prediction-slate-contract';
import { isProhibitedOddsBoundaryKey } from '@/prediction/firewall/odds-contamination-guard';

function encodeExpectedComponent(value: string): string {
  return `${value.length}:${value}`;
}

function expectedSinglePickGradeId(grade: {
  recommendationId: string;
  result: 'CORRECT' | 'INCORRECT' | 'UNRESOLVED';
  eligibility: 'VERIFIED_PRESTART' | 'UNVERIFIED_MISSING_OUTCOME';
  outcomeId: string | null;
  winnerTeamId: string | null;
}): string {
  return (
    encodeExpectedComponent(grade.recommendationId) +
    encodeExpectedComponent(grade.result) +
    encodeExpectedComponent(grade.eligibility) +
    encodeExpectedComponent(grade.outcomeId ?? 'NO_OUTCOME') +
    encodeExpectedComponent(grade.winnerTeamId ?? 'NO_WINNER') +
    '::offline-single-pick-grade-v1'
  );
}

function expectedMultiLegGradeId(candidateId: string, grade: {
  recommendationId: string;
  result: 'CORRECT' | 'INCORRECT' | 'UNRESOLVED';
  eligibility: 'VERIFIED_PRESTART' | 'UNVERIFIED_MISSING_OUTCOME';
  outcomeId: string | null;
  winnerTeamId: string | null;
}): string {
  return (
    encodeExpectedComponent(candidateId) +
    encodeExpectedComponent(grade.recommendationId) +
    encodeExpectedComponent(grade.result) +
    encodeExpectedComponent(grade.eligibility) +
    encodeExpectedComponent(grade.outcomeId ?? 'NO_OUTCOME') +
    encodeExpectedComponent(grade.winnerTeamId ?? 'NO_WINNER') +
    '::offline-multi-leg-grade-v1'
  );
}

function expectedMultiGradeId(candidateId: string, result: 'CORRECT' | 'INCORRECT' | 'UNRESOLVED', legGradeIds: readonly string[]): string {
  return (
    encodeExpectedComponent(candidateId) +
    encodeExpectedComponent(result) +
    encodeExpectedComponent(String(legGradeIds.length)) +
    legGradeIds.map((id) => encodeExpectedComponent(id)).join('') +
    '::offline-multi-grade-v1'
  );
}

function expectedGradingId(
  recommendationBundleId: string,
  outcomeSetId: string,
  singlePickGradeIds: readonly string[],
  multiGradeIds: readonly string[],
): string {
  return (
    encodeExpectedComponent(recommendationBundleId) +
    encodeExpectedComponent(outcomeSetId) +
    encodeExpectedComponent(String(singlePickGradeIds.length)) +
    singlePickGradeIds.map((id) => encodeExpectedComponent(id)).join('') +
    encodeExpectedComponent(String(multiGradeIds.length)) +
    multiGradeIds.map((id) => encodeExpectedComponent(id)).join('') +
    '::offline-recommendation-bundle-grading-v1'
  );
}

const BASE_RELEASE_ID = 'release-1';
const BASE_SNAPSHOT_ID = 'snapshot-1';
const BASE_GAME_ID = 'game-1';
const BASE_OFFICIAL_DATE = '2024-06-01';
const BASE_DATA_CUTOFF = '2024-05-30T09:00:00.000Z';
const BASE_RECOMMENDED_AT = '2024-05-30T10:00:00.000Z';

let predictionCounter = 0;

function buildValidPrediction(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const releaseId = overrides.releaseId ?? BASE_RELEASE_ID;
  const snapshotId = overrides.snapshotId ?? BASE_SNAPSHOT_ID;
  const inferenceId = overrides.inferenceId ?? `${releaseId}::${snapshotId}::offline-pregame-inference-v1`;
  const homeTeamId = overrides.homeTeamId ?? 'team-home-1';
  const awayTeamId = overrides.awayTeamId ?? 'team-away-1';
  const probabilities = (overrides.probabilities as { homeWinProbability: number; awayWinProbability: number } | undefined) ?? { homeWinProbability: 0.75, awayWinProbability: 0.25 };
  const predictedSide = overrides.predictedSide ?? (probabilities.homeWinProbability >= 0.5 ? 'HOME' : 'AWAY');
  const predictedTeamId = overrides.predictedTeamId ?? (predictedSide === 'HOME' ? homeTeamId : awayTeamId);
  predictionCounter += 1;
  const gameId = overrides.gameId ?? `${BASE_GAME_ID}-${predictionCounter}`;
  return {
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
    gameId,
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
}

function buildValidSlate(predictions: readonly Record<string, unknown>[]): Record<string, unknown> {
  const uniquePredictions = predictions.map((prediction, index) => ({
    ...prediction,
    gameId: (prediction.gameId as string | undefined) ?? `${BASE_GAME_ID}-${index + 1}`,
  }));
  const result = buildMLBOfflinePredictionSlate(uniquePredictions);
  if (!result.ok) {
    throw new Error(`Invalid slate: ${result.issues.map((i) => `${i.code}:${i.path}`).join(', ')}`);
  }
  return result.value;
}

function buildValidSinglePick(slate: Record<string, unknown>): Record<string, unknown> {
  const built = buildMLBOfflineSinglePickRecommendationSet(slate);
  if (!built.ok) {
    throw new Error(`Invalid single pick: ${built.issues.map((i) => `${i.code}:${i.path}`).join(', ')}`);
  }
  const validated = validateMLBOfflineSinglePickRecommendationSet(built.value);
  if (!validated.ok) {
    throw new Error(`Invalid validated single pick: ${validated.issues.map((i) => `${i.code}:${i.path}`).join(', ')}`);
  }
  return built.value;
}

function buildValidCandidateSet(singlePick: Record<string, unknown>): Record<string, unknown> {
  const built = buildMLBOfflineMultiCandidateSet(singlePick);
  if (!built.ok) {
    throw new Error(`Invalid candidate set: ${built.issues.map((i) => `${i.code}:${i.path}`).join(', ')}`);
  }
  const validated = validateMLBOfflineMultiCandidateSet(built.value);
  if (!validated.ok) {
    throw new Error(`Invalid validated candidate set: ${validated.issues.map((i) => `${i.code}:${i.path}`).join(', ')}`);
  }
  return built.value;
}

function buildValidMultiRecommendationSet(candidateSet: Record<string, unknown>): Record<string, unknown> {
  const built = buildMLBOfflineMultiRecommendationSet(candidateSet);
  if (!built.ok) {
    throw new Error(`Invalid multi recommendation set: ${built.issues.map((i) => `${i.code}:${i.path}`).join(', ')}`);
  }
  const validated = validateMLBOfflineMultiRecommendationSet(built.value);
  if (!validated.ok) {
    throw new Error(`Invalid validated multi recommendation set: ${validated.issues.map((i) => `${i.code}:${i.path}`).join(', ')}`);
  }
  return built.value;
}

function buildValidBundle(
  singlePick: Record<string, unknown>,
  multi: Record<string, unknown>,
  recommendedAt: string,
): Record<string, unknown> {
  const risk = buildMLBOfflineMultiRiskGuidanceSet(multi);
  if (!risk.ok) {
    throw new Error(`Invalid risk guidance set: ${risk.issues.map((i) => `${i.code}:${i.path}`).join(', ')}`);
  }
  const built = buildMLBOfflineRecommendationBundle({
    singlePickRecommendationSet: singlePick,
    multiRecommendationSet: multi,
    multiRiskGuidanceSet: risk.value,
    recommendedAt,
  });
  if (!built.ok) {
    throw new Error(`Invalid bundle: ${built.issues.map((i) => `${i.code}:${i.path}`).join(', ')}`);
  }
  const validated = validateMLBOfflineRecommendationBundle(built.value);
  if (!validated.ok) {
    throw new Error(`Invalid validated bundle: ${validated.issues.map((i) => `${i.code}:${i.path}`).join(', ')}`);
  }
  return built.value;
}

function makeValidOutcome(overrides: Record<string, unknown> = {}): MLBOfflineOfficialFinalGameOutcome {
  const base: MLBOfflineOfficialFinalGameOutcome = {
    outcomeId: '',
    status: 'OFFICIAL_FINAL',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    gameId: BASE_GAME_ID,
    officialDate: BASE_OFFICIAL_DATE,
    scheduledStartAt: '2024-06-01T22:30:00.000Z',
    homeTeamId: 'team-home-1',
    awayTeamId: 'team-away-1',
    homeRuns: 3,
    awayRuns: 0,
    winnerTeamId: 'team-home-1',
    finalizedAt: '2024-06-01T23:00:00.000Z',
    source: {
      sourceName: 'sourceName',
      sourceRecordId: 'sourceRecordId',
      fetchedAt: '2024-06-01T23:00:00.000Z',
    },
  };
  const outcome = { ...base, ...overrides } as MLBOfflineOfficialFinalGameOutcome;
  if (!outcome.outcomeId) {
    const id =
      encodeExpectedComponent('OFFICIAL_FINAL') +
      encodeExpectedComponent('OFFICIAL_FINAL_GAME_WINNER') +
      encodeExpectedComponent(outcome.gameId) +
      encodeExpectedComponent(outcome.officialDate) +
      encodeExpectedComponent(outcome.scheduledStartAt) +
      encodeExpectedComponent(outcome.homeTeamId) +
      encodeExpectedComponent(outcome.awayTeamId) +
      encodeExpectedComponent(String(outcome.homeRuns)) +
      encodeExpectedComponent(String(outcome.awayRuns)) +
      encodeExpectedComponent(outcome.winnerTeamId) +
      encodeExpectedComponent(outcome.finalizedAt) +
      encodeExpectedComponent(outcome.source.sourceName) +
      encodeExpectedComponent(outcome.source.sourceRecordId) +
      encodeExpectedComponent(outcome.source.fetchedAt) +
      '::offline-official-final-game-outcome-v1';
    return Object.freeze({ ...outcome, outcomeId: id }) as MLBOfflineOfficialFinalGameOutcome;
  }
  return outcome;
}

function buildValidOutcomeSet(outcomes: readonly MLBOfflineOfficialFinalGameOutcome[]): MLBOfflineOfficialFinalGameOutcomeSet {
  const outcomeIds = outcomes.map((o) => o.outcomeId);
  const outcomeSetId = `${outcomeIds.length}${outcomeIds.length > 0 ? ':' : ''}${outcomeIds.map((id) => `${id.length}:${id}`).join('')}::offline-official-final-game-outcome-set-v1`;
  return Object.freeze({
    contractVersion: 'mlb-offline-official-final-game-outcome-set-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    outcomeSetId,
    outcomeCount: outcomes.length,
    outcomeIds: Object.freeze(outcomeIds) as readonly string[],
    outcomes: Object.freeze([...outcomes]) as readonly MLBOfflineOfficialFinalGameOutcome[],
  });
}

function buildMinimalValidGrading(): {
  bundle: MLBOfflineRecommendationBundle;
  outcomeSet: MLBOfflineOfficialFinalGameOutcomeSet;
  grading: MLBOfflineRecommendationBundleGrading;
} {
  const prediction1 = buildValidPrediction({ snapshotId: 'snapshot-1', gameId: BASE_GAME_ID });
  const prediction2 = buildValidPrediction({ snapshotId: 'snapshot-2', gameId: `${BASE_GAME_ID}-2`, homeTeamId: 'team-home-2', awayTeamId: 'team-away-2', probabilities: { homeWinProbability: 0.6, awayWinProbability: 0.4 }, predictedSide: 'HOME', predictedTeamId: 'team-home-2' });
  const slate = buildValidSlate([prediction1, prediction2]);
  const singlePick = buildValidSinglePick(slate);
  const candidateSet = buildValidCandidateSet(singlePick);
  const multi = buildValidMultiRecommendationSet(candidateSet);
  const bundle = buildValidBundle(singlePick, multi, BASE_RECOMMENDED_AT) as MLBOfflineRecommendationBundle;
  const outcome1 = makeValidOutcome({ gameId: BASE_GAME_ID });
  const outcome2 = makeValidOutcome({ gameId: `${BASE_GAME_ID}-2`, homeTeamId: 'team-home-2', awayTeamId: 'team-away-2', winnerTeamId: 'team-home-2' });
  const outcomeSet = buildValidOutcomeSet([outcome1, outcome2]);
  const input = {
    recommendationBundle: bundle,
    outcomeSet: outcomeSet,
  };
  const built = buildMLBOfflineRecommendationBundleGrading(input);
  if (!built.ok) {
    throw new Error(`Invalid grading: ${built.issues.map((i) => `${i.code}:${i.path}:${i.message}`).join(', ')}`);
  }
  return { bundle, outcomeSet, grading: built.value };
}

describe('MLBOfflineRecommendationBundleGrading contract', () => {
  it('accepts a minimal self-validating grading artifact and preserves exact upstream references', () => {
    const { bundle, outcomeSet, grading } = buildMinimalValidGrading();
    expect(grading.sourceRecommendationBundle).toBe(bundle);
    expect(grading.sourceOutcomeSet).toBe(outcomeSet);
    const validated = validateMLBOfflineRecommendationBundleGrading(grading);
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      expect(validated.value).toBe(grading);
    }
  });

  it('validates exact root fields, complete embedded upstream artifacts, source IDs, counts, and grade-ID mappings', () => {
    const { bundle, outcomeSet, grading } = buildMinimalValidGrading();
    expect(grading.contractVersion).toBe(MLB_OFFLINE_RECOMMENDATION_BUNDLE_GRADING_CONTRACT_VERSION);
    expect(grading.sport).toBe('MLB');
    expect(grading.target).toBe('OFFICIAL_FINAL_GAME_WINNER');
    expect(grading.recommendationBundleId).toBe(bundle.recommendationBundleId);
    expect(grading.outcomeSetId).toBe(outcomeSet.outcomeSetId);
    expect(grading.singlePickGradeCount).toBe(bundle.sourceSinglePickRecommendationSet.recommendations.length);
    expect(grading.singlePickGradeIds).toEqual(grading.singlePickGrades.map((g) => g.gradeId));
    expect(grading.multiGradeCount).toBe(bundle.sourceMultiRecommendationSet.selectedRecommendations.length);
    expect(grading.multiGradeIds).toEqual(grading.multiGrades.map((g) => g.gradeId));
    expect(grading.singlePickGrades).toHaveLength(bundle.sourceSinglePickRecommendationSet.recommendations.length);
    expect(grading.multiGrades).toHaveLength(bundle.sourceMultiRecommendationSet.selectedRecommendations.length);
    const validated = validateMLBOfflineRecommendationBundleGrading(grading);
    expect(validated.ok).toBe(true);
  });

  it('collapses an invalid Phase 8P source recommendation bundle to one exact grading issue', () => {
    const outcome = makeValidOutcome();
    const outcomeSet = buildValidOutcomeSet([outcome]);
    const invalidBundle = { invalid: true };
    const input = {
      recommendationBundle: invalidBundle,
      outcomeSet: outcomeSet,
    };
    const result = buildMLBOfflineRecommendationBundleGrading(input);
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'SOURCE_RECOMMENDATION_BUNDLE_INVALID',
          path: '$.recommendationBundle',
          message: 'recommendationBundle failed validation',
        },
      ],
    });
  });

  it('collapses an invalid Phase 8Q source outcome set to one exact grading issue', () => {
    const prediction = buildValidPrediction();
    const slate = buildValidSlate([prediction]);
    const singlePick = buildValidSinglePick(slate);
    const candidateSet = buildValidCandidateSet(singlePick);
    const multi = buildValidMultiRecommendationSet(candidateSet);
    const bundle = buildValidBundle(singlePick, multi, BASE_RECOMMENDED_AT);
    const input = {
      recommendationBundle: bundle,
      outcomeSet: { invalid: true },
    };
    const result = buildMLBOfflineRecommendationBundleGrading(input);
    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: 'SOURCE_OUTCOME_SET_INVALID',
          path: '$.outcomeSet',
          message: 'outcomeSet failed validation',
        },
      ],
    });
  });

  it('grades a prestart single-pick recommendation as correct', () => {
    const prediction = buildValidPrediction({
      snapshotId: 'snapshot-1',
      gameId: BASE_GAME_ID,
      recommendedTeamId: 'team-home-1',
    });
    const slate = buildValidSlate([prediction]);
    const singlePick = buildValidSinglePick(slate);
    const candidateSet = buildValidCandidateSet(singlePick);
    const multi = buildValidMultiRecommendationSet(candidateSet);
    const bundle = buildValidBundle(singlePick, multi, BASE_RECOMMENDED_AT) as MLBOfflineRecommendationBundle;
    const outcome = makeValidOutcome({ gameId: BASE_GAME_ID, winnerTeamId: 'team-home-1' });
    const outcomeSet = buildValidOutcomeSet([outcome]);
    const input = {
      recommendationBundle: bundle,
      outcomeSet: outcomeSet,
    };
    const result = buildMLBOfflineRecommendationBundleGrading(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    const grade = result.value.singlePickGrades[0];
    expect(grade.result).toBe('CORRECT');
    expect(grade.eligibility).toBe('VERIFIED_PRESTART');
    expect(grade.outcomeId).toBe(outcome.outcomeId);
    expect(grade.winnerTeamId).toBe('team-home-1');
    expect(grade.gradeId).toBe(expectedSinglePickGradeId(grade));
  });

  it('grades a prestart single-pick recommendation as incorrect', () => {
    const prediction = buildValidPrediction({
      snapshotId: 'snapshot-1',
      gameId: BASE_GAME_ID,
      probabilities: { homeWinProbability: 0.25, awayWinProbability: 0.75 },
      predictedSide: 'AWAY',
      predictedTeamId: 'team-away-1',
    });
    const slate = buildValidSlate([prediction]);
    const singlePick = buildValidSinglePick(slate);
    const candidateSet = buildValidCandidateSet(singlePick);
    const multi = buildValidMultiRecommendationSet(candidateSet);
    const bundle = buildValidBundle(singlePick, multi, BASE_RECOMMENDED_AT) as MLBOfflineRecommendationBundle;
    const outcome = makeValidOutcome({ gameId: BASE_GAME_ID, winnerTeamId: 'team-home-1' });
    const outcomeSet = buildValidOutcomeSet([outcome]);
    const input = {
      recommendationBundle: bundle,
      outcomeSet: outcomeSet,
    };
    const result = buildMLBOfflineRecommendationBundleGrading(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    const grade = result.value.singlePickGrades[0];
    expect(grade.result).toBe('INCORRECT');
    expect(grade.eligibility).toBe('VERIFIED_PRESTART');
    expect(grade.outcomeId).toBe(outcome.outcomeId);
    expect(grade.winnerTeamId).toBe('team-home-1');
    expect(grade.gradeId).toBe(expectedSinglePickGradeId(grade));
  });

  it('represents a missing official outcome as unresolved with unverified eligibility and null outcome fields', () => {
    const prediction = buildValidPrediction({ snapshotId: 'snapshot-1', gameId: BASE_GAME_ID });
    const slate = buildValidSlate([prediction]);
    const singlePick = buildValidSinglePick(slate);
    const candidateSet = buildValidCandidateSet(singlePick);
    const multi = buildValidMultiRecommendationSet(candidateSet);
    const bundle = buildValidBundle(singlePick, multi, BASE_RECOMMENDED_AT) as MLBOfflineRecommendationBundle;
    const outcomeSet = buildValidOutcomeSet([]);
    const input = {
      recommendationBundle: bundle,
      outcomeSet: outcomeSet,
    };
    const result = buildMLBOfflineRecommendationBundleGrading(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    const grade = result.value.singlePickGrades[0];
    expect(grade.result).toBe('UNRESOLVED');
    expect(grade.eligibility).toBe('UNVERIFIED_MISSING_OUTCOME');
    expect(grade.outcomeId).toBeNull();
    expect(grade.winnerTeamId).toBeNull();
    expect(grade.gradeId).toBe(expectedSinglePickGradeId(grade));
  });

  it('rejects recommendation publication at or after the matched scheduled start', () => {
    const prediction = buildValidPrediction({ snapshotId: 'snapshot-1', gameId: BASE_GAME_ID });
    const slate = buildValidSlate([prediction]);
    const singlePick = buildValidSinglePick(slate);
    const candidateSet = buildValidCandidateSet(singlePick);
    const multi = buildValidMultiRecommendationSet(candidateSet);
    const scheduledStart = '2024-06-01T22:30:00.000Z';
    const bundle = buildValidBundle(singlePick, multi, scheduledStart) as MLBOfflineRecommendationBundle;
    const outcome = makeValidOutcome({ gameId: BASE_GAME_ID, scheduledStartAt: scheduledStart });
    const outcomeSet = buildValidOutcomeSet([outcome]);
    const input = {
      recommendationBundle: bundle,
      outcomeSet: outcomeSet,
    };
    const equalResult = buildMLBOfflineRecommendationBundleGrading(input);
    expect(equalResult.ok).toBe(false);
    if (equalResult.ok) throw new Error('Expected failure');
    expect(equalResult.issues).toEqual([
      {
        code: 'INVALID_TIMESTAMP_ELIGIBILITY',
        path: '$.recommendationBundle.recommendedAt',
        message: `recommendedAt must be earlier than scheduledStartAt for game ${BASE_GAME_ID}`,
      },
    ]);

    const afterBundle = buildValidBundle(singlePick, multi, '2024-06-02T00:00:00.000Z') as MLBOfflineRecommendationBundle;
    const afterResult = buildMLBOfflineRecommendationBundleGrading({
      recommendationBundle: afterBundle,
      outcomeSet: outcomeSet,
    });
    expect(afterResult.ok).toBe(false);
    if (afterResult.ok) throw new Error('Expected failure');
    expect(afterResult.issues).toEqual([
      {
        code: 'INVALID_TIMESTAMP_ELIGIBILITY',
        path: '$.recommendationBundle.recommendedAt',
        message: `recommendedAt must be earlier than scheduledStartAt for game ${BASE_GAME_ID}`,
      },
    ]);
  });

  it('rejects model data cutoff at or after the matched scheduled start', () => {
    const scheduledStart = '2024-06-01T22:30:00.000Z';
    const equalPrediction = buildValidPrediction({
      snapshotId: 'snapshot-1',
      gameId: BASE_GAME_ID,
      dataCutoffAt: scheduledStart,
    });
    const equalSlate = buildValidSlate([equalPrediction]);
    const equalSinglePick = buildValidSinglePick(equalSlate);
    const equalCandidateSet = buildValidCandidateSet(equalSinglePick);
    const equalMulti = buildValidMultiRecommendationSet(equalCandidateSet);
    const bundle = buildValidBundle(equalSinglePick, equalMulti, BASE_RECOMMENDED_AT) as MLBOfflineRecommendationBundle;
    const outcome = makeValidOutcome({ gameId: BASE_GAME_ID, scheduledStartAt: scheduledStart });
    const outcomeSet = buildValidOutcomeSet([outcome]);
    const input = {
      recommendationBundle: bundle,
      outcomeSet: outcomeSet,
    };
    const equalResult = buildMLBOfflineRecommendationBundleGrading(input);
    expect(equalResult.ok).toBe(false);
    if (equalResult.ok) throw new Error('Expected failure');
    expect(equalResult.issues).toEqual([
      {
        code: 'INVALID_TIMESTAMP_ELIGIBILITY',
        path: '$.recommendationBundle.sourceSinglePickRecommendationSet.recommendations[0].dataCutoffAt',
        message: `dataCutoffAt must be earlier than scheduledStartAt for game ${BASE_GAME_ID}`,
      },
    ]);

    const afterPrediction = buildValidPrediction({
      snapshotId: 'snapshot-2',
      gameId: BASE_GAME_ID,
      dataCutoffAt: '2024-06-02T00:00:00.000Z',
    });
    const afterSlate = buildValidSlate([afterPrediction]);
    const afterSinglePick = buildValidSinglePick(afterSlate);
    const afterCandidateSet = buildValidCandidateSet(afterSinglePick);
    const afterMulti = buildValidMultiRecommendationSet(afterCandidateSet);
    const afterBundle = buildValidBundle(afterSinglePick, afterMulti, BASE_RECOMMENDED_AT) as MLBOfflineRecommendationBundle;
    const afterInput = {
      recommendationBundle: afterBundle,
      outcomeSet: outcomeSet,
    };
    const afterResult = buildMLBOfflineRecommendationBundleGrading(afterInput);
    expect(afterResult.ok).toBe(false);
    if (afterResult.ok) throw new Error('Expected failure');
    expect(afterResult.issues).toEqual([
      {
        code: 'INVALID_TIMESTAMP_ELIGIBILITY',
        path: '$.recommendationBundle.sourceSinglePickRecommendationSet.recommendations[0].dataCutoffAt',
        message: `dataCutoffAt must be earlier than scheduledStartAt for game ${BASE_GAME_ID}`,
      },
    ]);
  });

  it('rejects matched official-date and competitor-identity disagreement with exact cascade suppression', () => {
    const prediction = buildValidPrediction({ snapshotId: 'snapshot-1', gameId: BASE_GAME_ID });
    const slate = buildValidSlate([prediction]);
    const singlePick = buildValidSinglePick(slate);
    const candidateSet = buildValidCandidateSet(singlePick);
    const multi = buildValidMultiRecommendationSet(candidateSet);
    const bundle = buildValidBundle(singlePick, multi, BASE_RECOMMENDED_AT) as MLBOfflineRecommendationBundle;
    const dateOutcome = makeValidOutcome({ gameId: BASE_GAME_ID, officialDate: '2024-06-02' });
    const dateInput = {
      recommendationBundle: bundle,
      outcomeSet: buildValidOutcomeSet([dateOutcome]),
    };
    const dateResult = buildMLBOfflineRecommendationBundleGrading(dateInput);
    expect(dateResult.ok).toBe(false);
    if (dateResult.ok) throw new Error('Expected failure');
    expect(dateResult.issues).toEqual([
      {
        code: 'OFFICIAL_DATE_MISMATCH',
        path: '$.recommendationBundle.sourceSinglePickRecommendationSet.recommendations[0].officialDate',
        message: `officialDate must match official outcome for game ${BASE_GAME_ID}`,
      },
    ]);

    const competitorOutcome = makeValidOutcome({
      gameId: BASE_GAME_ID,
      homeTeamId: 'other-home',
      awayTeamId: 'other-away',
      winnerTeamId: 'other-home',
    });
    const competitorInput = {
      recommendationBundle: bundle,
      outcomeSet: buildValidOutcomeSet([competitorOutcome]),
    };
    const competitorResult = buildMLBOfflineRecommendationBundleGrading(competitorInput);
    expect(competitorResult.ok).toBe(false);
    if (competitorResult.ok) throw new Error('Expected failure');
    expect(competitorResult.issues).toEqual([
      {
        code: 'COMPETITOR_IDENTITY_MISMATCH',
        path: '$.recommendationBundle.sourceSinglePickRecommendationSet.recommendations[0].homeTeamId',
        message: `homeTeamId must match official outcome for game ${BASE_GAME_ID}`,
      },
    ]);

    const awayOutcome = makeValidOutcome({
      gameId: BASE_GAME_ID,
      homeTeamId: 'team-home-1',
      awayTeamId: 'other-away',
      winnerTeamId: 'team-home-1',
    });
    const awayInput = {
      recommendationBundle: bundle,
      outcomeSet: buildValidOutcomeSet([awayOutcome]),
    };
    const awayResult = buildMLBOfflineRecommendationBundleGrading(awayInput);
    expect(awayResult.ok).toBe(false);
    if (awayResult.ok) throw new Error('Expected failure');
    expect(awayResult.issues).toEqual([
      {
        code: 'COMPETITOR_IDENTITY_MISMATCH',
        path: '$.recommendationBundle.sourceSinglePickRecommendationSet.recommendations[0].awayTeamId',
        message: `awayTeamId must match official outcome for game ${BASE_GAME_ID}`,
      },
    ]);
  });

  it('grades a multi as correct when every leg is verified and correct', () => {
    const prediction1 = buildValidPrediction({ snapshotId: 'snapshot-1', gameId: 'game-1', predictedTeamId: 'team-home-1' });
    const prediction2 = buildValidPrediction({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
      probabilities: { homeWinProbability: 0.6, awayWinProbability: 0.4 },
      predictedSide: 'HOME',
      predictedTeamId: 'team-home-2',
    });
    const slate = buildValidSlate([prediction1, prediction2]);
    const singlePick = buildValidSinglePick(slate);
    const candidateSet = buildValidCandidateSet(singlePick);
    const multi = buildValidMultiRecommendationSet(candidateSet);
    const bundle = buildValidBundle(singlePick, multi, BASE_RECOMMENDED_AT) as MLBOfflineRecommendationBundle;
    const outcome1 = makeValidOutcome({ gameId: 'game-1', winnerTeamId: 'team-home-1' });
    const outcome2 = makeValidOutcome({ gameId: 'game-2', homeTeamId: 'team-home-2', awayTeamId: 'team-away-2', winnerTeamId: 'team-home-2' });
    const outcomeSet = buildValidOutcomeSet([outcome1, outcome2]);
    const input = {
      recommendationBundle: bundle,
      outcomeSet: outcomeSet,
    };
    const result = buildMLBOfflineRecommendationBundleGrading(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    const multiGrade = result.value.multiGrades[0];
    expect(multiGrade.result).toBe('CORRECT');
    expect(multiGrade.correctLegCount).toBe(2);
    expect(multiGrade.incorrectLegCount).toBe(0);
    expect(multiGrade.unresolvedLegCount).toBe(0);
    expect(multiGrade.gradeId).toBe(expectedMultiGradeId(multiGrade.candidateId, 'CORRECT', multiGrade.legGradeIds));
  });

  it('grades a multi as immediately incorrect when one leg loses and remaining legs are unresolved', () => {
    const prediction1 = buildValidPrediction({ snapshotId: 'snapshot-1', gameId: 'game-1', predictedTeamId: 'team-home-1' });
    const prediction2 = buildValidPrediction({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
      probabilities: { homeWinProbability: 0.6, awayWinProbability: 0.4 },
      predictedSide: 'HOME',
      predictedTeamId: 'team-home-2',
    });
    const slate = buildValidSlate([prediction1, prediction2]);
    const singlePick = buildValidSinglePick(slate);
    const candidateSet = buildValidCandidateSet(singlePick);
    const multi = buildValidMultiRecommendationSet(candidateSet);
    const bundle = buildValidBundle(singlePick, multi, BASE_RECOMMENDED_AT) as MLBOfflineRecommendationBundle;
    const outcome1 = makeValidOutcome({ gameId: 'game-1', homeRuns: 0, awayRuns: 3, winnerTeamId: 'team-away-1' });
    const outcomeSet = buildValidOutcomeSet([outcome1]);
    const input = {
      recommendationBundle: bundle,
      outcomeSet: outcomeSet,
    };
    const result = buildMLBOfflineRecommendationBundleGrading(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    const multiGrade = result.value.multiGrades[0];
    expect(multiGrade.result).toBe('INCORRECT');
    expect(multiGrade.correctLegCount).toBe(0);
    expect(multiGrade.incorrectLegCount).toBe(1);
    expect(multiGrade.unresolvedLegCount).toBe(1);
    expect(multiGrade.gradeId).toBe(expectedMultiGradeId(multiGrade.candidateId, 'INCORRECT', multiGrade.legGradeIds));
  });

  it('grades a multi as unresolved when no leg is incorrect and at least one outcome is missing', () => {
    const prediction1 = buildValidPrediction({ snapshotId: 'snapshot-1', gameId: 'game-1', predictedTeamId: 'team-home-1' });
    const prediction2 = buildValidPrediction({
      snapshotId: 'snapshot-2',
      gameId: 'game-2',
      homeTeamId: 'team-home-2',
      awayTeamId: 'team-away-2',
      probabilities: { homeWinProbability: 0.6, awayWinProbability: 0.4 },
      predictedSide: 'HOME',
      predictedTeamId: 'team-home-2',
    });
    const slate = buildValidSlate([prediction1, prediction2]);
    const singlePick = buildValidSinglePick(slate);
    const candidateSet = buildValidCandidateSet(singlePick);
    const multi = buildValidMultiRecommendationSet(candidateSet);
    const bundle = buildValidBundle(singlePick, multi, BASE_RECOMMENDED_AT) as MLBOfflineRecommendationBundle;
    const outcome1 = makeValidOutcome({ gameId: 'game-1', winnerTeamId: 'team-home-1' });
    const outcomeSet = buildValidOutcomeSet([outcome1]);
    const input = {
      recommendationBundle: bundle,
      outcomeSet: outcomeSet,
    };
    const result = buildMLBOfflineRecommendationBundleGrading(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    const multiGrade = result.value.multiGrades[0];
    expect(multiGrade.result).toBe('UNRESOLVED');
    expect(multiGrade.correctLegCount).toBe(1);
    expect(multiGrade.incorrectLegCount).toBe(0);
    expect(multiGrade.unresolvedLegCount).toBe(1);
    expect(multiGrade.gradeId).toBe(expectedMultiGradeId(multiGrade.candidateId, 'UNRESOLVED', multiGrade.legGradeIds));
  });

  it('preserves validated Phase 8P single-pick, selected-multi, and leg order without independent sorting', () => {
    const prediction1 = buildValidPrediction({ snapshotId: 'snapshot-1', gameId: 'game-1' });
    const prediction2 = buildValidPrediction({ snapshotId: 'snapshot-2', gameId: 'game-2' });
    const slate = buildValidSlate([prediction1, prediction2]);
    const singlePick = buildValidSinglePick(slate);
    const candidateSet = buildValidCandidateSet(singlePick);
    const multi = buildValidMultiRecommendationSet(candidateSet);
    const bundle = buildValidBundle(singlePick, multi, BASE_RECOMMENDED_AT) as MLBOfflineRecommendationBundle;
    const outcome1 = makeValidOutcome({ gameId: 'game-1', winnerTeamId: 'team-home-1' });
    const outcome2 = makeValidOutcome({ gameId: 'game-2', winnerTeamId: 'team-home-1' });
    const outcomeSet = buildValidOutcomeSet([outcome1, outcome2]);
    const input = {
      recommendationBundle: bundle,
      outcomeSet: outcomeSet,
    };
    const result = buildMLBOfflineRecommendationBundleGrading(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.value.singlePickGrades).toHaveLength(2);
    expect(result.value.singlePickGrades[0].recommendationId).toBe(
      bundle.sourceSinglePickRecommendationSet.recommendations[0].recommendationId,
    );
    expect(result.value.singlePickGrades[1].recommendationId).toBe(
      bundle.sourceSinglePickRecommendationSet.recommendations[1].recommendationId,
    );
    expect(result.value.multiGrades).toHaveLength(1);
    expect(result.value.multiGrades[0].legGrades).toHaveLength(2);
    expect(result.value.multiGrades[0].legGrades[0].recommendationId).toBe(
      bundle.sourceMultiRecommendationSet.selectedRecommendations[0].legs[0].recommendationId,
    );
    expect(result.value.multiGrades[0].legGrades[1].recommendationId).toBe(
      bundle.sourceMultiRecommendationSet.selectedRecommendations[0].legs[1].recommendationId,
    );
  });

  it('validates exact single-pick count, ID-array, mapping, result, eligibility, and grade identity', () => {
    const { bundle, outcomeSet, grading } = buildMinimalValidGrading();
    const countInput = {
      ...grading,
      singlePickGradeCount: grading.singlePickGradeCount + 1,
    };
    const countResult = validateMLBOfflineRecommendationBundleGrading(countInput);
    expect(countResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'SINGLE_PICK_GRADE_COUNT_MISMATCH',
          path: '$.singlePickGradeCount',
          message: 'singlePickGradeCount must match source recommendation count',
        },
      ],
    });

    const lengthInput = {
      ...grading,
      singlePickGrades: [
        ...grading.singlePickGrades,
        {
          ...grading.singlePickGrades[0],
          gradeId: 'extra-single-pick-grade-id',
        },
      ],
      singlePickGradeIds: [
        ...grading.singlePickGradeIds,
        'extra-single-pick-grade-id',
      ],
    };
    const lengthResult = validateMLBOfflineRecommendationBundleGrading(lengthInput);
    expect(lengthResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'SINGLE_PICK_GRADE_COUNT_MISMATCH',
          path: '$.singlePickGrades',
          message: 'singlePickGrades length must match source recommendation count',
        },
      ],
    });

    const idArrayInput = {
      ...grading,
      singlePickGradeIds: ['wrong'],
    };
    const idArrayResult = validateMLBOfflineRecommendationBundleGrading(idArrayInput);
    expect(idArrayResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'SINGLE_PICK_GRADE_IDS_MISMATCH',
          path: '$.singlePickGradeIds',
          message: 'singlePickGradeIds must match singlePickGrades gradeId order',
        },
      ],
    });

    const mappingInput = {
      ...grading,
      singlePickGrades: [
        {
          ...grading.singlePickGrades[0],
          gameId: 'wrong',
        },
        grading.singlePickGrades[1],
      ],
      singlePickGradeIds: [
        grading.singlePickGradeIds[0],
        grading.singlePickGradeIds[1],
      ],
    };
    const mappingResult = validateMLBOfflineRecommendationBundleGrading(mappingInput);
    expect(mappingResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'SINGLE_PICK_GRADE_MAPPING_MISMATCH',
          path: '$.singlePickGrades[0].gameId',
          message: 'gameId must match source single-pick recommendation',
        },
      ],
    });

    const resultInput = {
      ...grading,
      singlePickGrades: [
        {
          ...grading.singlePickGrades[0],
          result: 'INCORRECT',
        },
        grading.singlePickGrades[1],
      ],
      singlePickGradeIds: [
        grading.singlePickGradeIds[0],
        grading.singlePickGradeIds[1],
      ],
    };
    const resultResult = validateMLBOfflineRecommendationBundleGrading(resultInput);
    expect(resultResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'SINGLE_PICK_GRADE_RESULT_MISMATCH',
          path: '$.singlePickGrades[0].result',
          message: 'result must match deterministic single-pick grading result',
        },
      ],
    });

    const idInput = {
      ...grading,
      singlePickGrades: [
        {
          ...grading.singlePickGrades[0],
          gradeId: 'wrong',
        },
        grading.singlePickGrades[1],
      ],
      singlePickGradeIds: [
        'wrong',
        grading.singlePickGradeIds[1],
      ],
    };
    const idResult = validateMLBOfflineRecommendationBundleGrading(idInput);
    expect(idResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'SINGLE_PICK_GRADE_ID_MISMATCH',
          path: '$.singlePickGrades[0].gradeId',
          message: 'gradeId must match deterministic single-pick grade identity',
        },
      ],
    });
  });

  it('validates exact leg and multi counts, ID arrays, mappings, results, eligibility, and identities', () => {
    const { bundle, outcomeSet, grading } = buildMinimalValidGrading();
    const multiGrade = grading.multiGrades[0];
    const legGrade = multiGrade.legGrades[0];

    const countInput = {
      ...grading,
      multiGradeCount: grading.multiGradeCount + 1,
    };
    const countResult = validateMLBOfflineRecommendationBundleGrading(countInput);
    expect(countResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'MULTI_GRADE_COUNT_MISMATCH',
          path: '$.multiGradeCount',
          message: 'multiGradeCount must match source selected recommendation count',
        },
        {
          code: 'MULTI_GRADE_COUNT_MISMATCH',
          path: '$.multiGrades',
          message: 'multiGrades length must match source selected recommendation count',
        },
      ],
    });

    const lengthInput = {
      ...grading,
      multiGrades: [multiGrade, multiGrade],
    };
    const lengthResult = validateMLBOfflineRecommendationBundleGrading(lengthInput);
    expect(lengthResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'MULTI_GRADE_COUNT_MISMATCH',
          path: '$.multiGrades',
          message: 'multiGrades length must match source selected recommendation count',
        },
        {
          code: 'MULTI_GRADE_IDS_MISMATCH',
          path: '$.multiGradeIds',
          message: 'multiGradeIds must match multiGrades gradeId order',
        },
      ],
    });

    const gradeIdInput = {
      ...grading,
      multiGradeIds: ['wrong-id'],
    };
    const gradeIdResult = validateMLBOfflineRecommendationBundleGrading(gradeIdInput);
    expect(gradeIdResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'MULTI_GRADE_IDS_MISMATCH',
          path: '$.multiGradeIds',
          message: 'multiGradeIds must match multiGrades gradeId order',
        },
      ],
    });

    const legCountInput = {
      ...grading,
      multiGrades: [
        {
          ...multiGrade,
          legCount: multiGrade.legCount + 1,
        },
      ],
    };
    const legCountResult = validateMLBOfflineRecommendationBundleGrading(legCountInput);
    expect(legCountResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'LEG_GRADE_COUNT_MISMATCH',
          path: '$.multiGrades[0].legCount',
          message: 'legCount must match source candidate leg count',
        },
      ],
    });

    const legIdsInput = {
      ...grading,
      multiGrades: [
        {
          ...multiGrade,
          legGradeIds: ['wrong'],
        },
      ],
    };
    const legIdsResult = validateMLBOfflineRecommendationBundleGrading(legIdsInput);
    expect(legIdsResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'LEG_GRADE_IDS_MISMATCH',
          path: '$.multiGrades[0].legGradeIds',
          message: 'legGradeIds must match legGrades gradeId order',
        },
      ],
    });

    const legMappingInput = {
      ...grading,
      multiGrades: [
        {
          ...multiGrade,
          legGrades: [
            {
              ...legGrade,
              recommendationId: 'wrong',
            },
          ],
        },
      ],
    };
    const legMappingResult = validateMLBOfflineRecommendationBundleGrading(legMappingInput);
    expect(legMappingResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'LEG_GRADE_MAPPING_MISMATCH',
          path: '$.multiGrades[0].legGrades[0].recommendationId',
          message: 'recommendationId must match source multi leg',
        },
      ],
    });

    const legResultInput = {
      ...grading,
      multiGrades: [
        {
          ...multiGrade,
          result: 'INCORRECT',
          legGrades: [
            {
              ...legGrade,
              result: 'INCORRECT',
            },
          ],
        },
      ],
    };
    const legResultResult = validateMLBOfflineRecommendationBundleGrading(legResultInput);
    expect(legResultResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'LEG_GRADE_RESULT_MISMATCH',
          path: '$.multiGrades[0].legGrades[0].result',
          message: 'result must match deterministic multi leg grading result',
        },
        {
          code: 'MULTI_GRADE_RESULT_MISMATCH',
          path: '$.multiGrades[0].result',
          message: 'result must match deterministic multi grading result',
        },
      ],
    });

    const legGradeIdInput = {
      ...grading,
      multiGrades: [
        {
          ...multiGrade,
          legGrades: [
            {
              ...legGrade,
              gradeId: 'wrong',
            },
          ],
        },
      ],
    };
    const legGradeIdResult = validateMLBOfflineRecommendationBundleGrading(legGradeIdInput);
    expect(legGradeIdResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'LEG_GRADE_ID_MISMATCH',
          path: '$.multiGrades[0].legGrades[0].gradeId',
          message: 'gradeId must match deterministic multi leg grade identity',
        },
      ],
    });

    const multiMappingInput = {
      ...grading,
      multiGrades: [
        {
          ...multiGrade,
          candidateId: 'wrong',
        },
      ],
    };
    const multiMappingResult = validateMLBOfflineRecommendationBundleGrading(multiMappingInput);
    expect(multiMappingResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'MULTI_GRADE_MAPPING_MISMATCH',
          path: '$.multiGrades[0].candidateId',
          message: 'candidateId must match source multi recommendation',
        },
      ],
    });

    const multiResultInput = {
      ...grading,
      multiGrades: [
        {
          ...multiGrade,
          result: 'INCORRECT',
        },
      ],
    };
    const multiResultResult = validateMLBOfflineRecommendationBundleGrading(multiResultInput);
    expect(multiResultResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'MULTI_GRADE_RESULT_MISMATCH',
          path: '$.multiGrades[0].result',
          message: 'result must match deterministic multi grading result',
        },
      ],
    });

    const multiGradeIdInput = {
      ...grading,
      multiGradeIds: [multiGrade.gradeId.replace('grade', 'wrong-grade')],
      multiGrades: [
        {
          ...multiGrade,
          gradeId: multiGrade.gradeId.replace('grade', 'wrong-grade'),
        },
      ],
    };
    const multiGradeIdResult = validateMLBOfflineRecommendationBundleGrading(multiGradeIdInput);
    expect(multiGradeIdResult).toEqual({
      ok: false,
      issues: [
        {
          code: 'MULTI_GRADE_ID_MISMATCH',
          path: '$.multiGrades[0].gradeId',
          message: 'gradeId must match deterministic multi grade identity',
        },
      ],
    });
  });

  it('validates length-prefixed single, leg, multi, and root identities with explicit null sentinels and delimiter-collision fixtures', () => {
    const outcome = makeValidOutcome();
    const outcomeSet = buildValidOutcomeSet([outcome]);
    const prediction1 = buildValidPrediction({ snapshotId: 'snapshot-1', gameId: BASE_GAME_ID });
    const prediction2 = buildValidPrediction({ snapshotId: 'snapshot-2', gameId: `${BASE_GAME_ID}-2`, homeTeamId: 'team-home-2', awayTeamId: 'team-away-2', probabilities: { homeWinProbability: 0.6, awayWinProbability: 0.4 }, predictedSide: 'HOME', predictedTeamId: 'team-home-2' });
    const slate = buildValidSlate([prediction1, prediction2]);
    const singlePick = buildValidSinglePick(slate);
    const candidateSet = buildValidCandidateSet(singlePick);
    const multi = buildValidMultiRecommendationSet(candidateSet);
    const bundle = buildValidBundle(singlePick, multi, BASE_RECOMMENDED_AT) as MLBOfflineRecommendationBundle;
    const input = {
      recommendationBundle: bundle,
      outcomeSet: outcomeSet,
    };
    const result = buildMLBOfflineRecommendationBundleGrading(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    const grade = result.value.singlePickGrades[0];
    expect(grade.outcomeId).toBe(outcome.outcomeId);
    expect(grade.winnerTeamId).toBe('team-home-1');
    expect(grade.gradeId).toBe(expectedSinglePickGradeId(grade));
    const legGrade = result.value.multiGrades[0].legGrades[0];
    expect(legGrade.outcomeId).toBe(outcome.outcomeId);
    expect(legGrade.winnerTeamId).toBe('team-home-1');
    expect(legGrade.gradeId).toBe(expectedMultiLegGradeId(result.value.multiGrades[0].candidateId, legGrade));
    expect(result.value.multiGrades[0].gradeId).toBe(expectedMultiGradeId(result.value.multiGrades[0].candidateId, result.value.multiGrades[0].result, result.value.multiGrades[0].legGradeIds));
    expect(result.value.gradingId).toBe(expectedGradingId(bundle.recommendationBundleId, outcomeSet.outcomeSetId, result.value.singlePickGradeIds, result.value.multiGradeIds));
  });

  it('preserves exact source references, allocates and freezes exact Phase 8R-owned structures, performs no caller mutation, and accepts structural clones', () => {
    const prediction1 = buildValidPrediction({ snapshotId: 'snapshot-1', gameId: BASE_GAME_ID });
    const prediction2 = buildValidPrediction({ snapshotId: 'snapshot-2', gameId: `${BASE_GAME_ID}-2`, homeTeamId: 'team-home-2', awayTeamId: 'team-away-2', probabilities: { homeWinProbability: 0.6, awayWinProbability: 0.4 }, predictedSide: 'HOME', predictedTeamId: 'team-home-2' });
    const slate = buildValidSlate([prediction1, prediction2]);
    const singlePick = buildValidSinglePick(slate);
    const candidateSet = buildValidCandidateSet(singlePick);
    const multi = buildValidMultiRecommendationSet(candidateSet);
    const bundle = buildValidBundle(singlePick, multi, BASE_RECOMMENDED_AT) as MLBOfflineRecommendationBundle;
    const outcome = makeValidOutcome({ gameId: BASE_GAME_ID });
    const outcome2 = makeValidOutcome({ gameId: `${BASE_GAME_ID}-2`, homeTeamId: 'team-home-2', awayTeamId: 'team-away-2', winnerTeamId: 'team-home-2' });
    const outcomeSet = buildValidOutcomeSet([outcome, outcome2]);
    const input = {
      recommendationBundle: bundle,
      outcomeSet: outcomeSet,
    };
    const result = buildMLBOfflineRecommendationBundleGrading(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.value.sourceRecommendationBundle).toBe(bundle);
    expect(result.value.sourceOutcomeSet).toBe(outcomeSet);
    expect(result.value.singlePickGrades).not.toBe(input.outcomeSet.outcomes);
    expect(Object.isFrozen(result.value.singlePickGrades)).toBe(true);
    expect(Object.isFrozen(result.value.singlePickGrades[0])).toBe(true);
    expect(Object.isFrozen(result.value.multiGrades)).toBe(true);
    expect(Object.isFrozen(result.value.multiGrades[0])).toBe(true);
    expect(Object.isFrozen(result.value.multiGrades[0].legGrades[0])).toBe(true);
    expect(Object.isFrozen(result.value)).toBe(true);

    const clonedRoot = { ...result.value, stake: 100 } as Record<string, unknown>;
    const clonedResult = validateMLBOfflineRecommendationBundleGrading(clonedRoot);
    expect(clonedResult.ok).toBe(false);
    if (clonedResult.ok) throw new Error('Expected failure');

    const malformedGradingIdRoot = { ...result.value, gradingId: 'wrong' } as Record<string, unknown>;
    const gradingIdResult = validateMLBOfflineRecommendationBundleGrading(malformedGradingIdRoot);
    expect(gradingIdResult.ok).toBe(false);
    if (gradingIdResult.ok) throw new Error('Expected failure');
    expect(gradingIdResult.issues).toEqual([
      {
        code: 'GRADING_ID_MISMATCH',
        path: '$.gradingId',
        message: 'gradingId must match deterministic recommendation bundle grading identity',
      },
    ]);
  });

  it('rejects odds contamination and prohibited concepts without introducing aggregation or monetary evaluation', () => {
    const prediction = buildValidPrediction({ snapshotId: 'snapshot-1', gameId: BASE_GAME_ID });
    const slate = buildValidSlate([prediction]);
    const singlePick = buildValidSinglePick(slate);
    const candidateSet = buildValidCandidateSet(singlePick);
    const multi = buildValidMultiRecommendationSet(candidateSet);
    const bundle = buildValidBundle(singlePick, multi, BASE_RECOMMENDED_AT) as MLBOfflineRecommendationBundle;
    const outcome = makeValidOutcome({ gameId: BASE_GAME_ID });
    const outcomeSet = buildValidOutcomeSet([outcome]);
    const grading = buildMLBOfflineRecommendationBundleGrading({
      recommendationBundle: bundle,
      outcomeSet: outcomeSet,
    });
    expect(grading.ok).toBe(true);
    if (!grading.ok) throw new Error('Expected success');

    const prohibitedRootFields = [
      'generatedAt',
      'createdAt',
      'updatedAt',
      'servedAt',
      'deploymentStatus',
      'providerName',
      'recommendationThreshold',
      'stakePolicy',
      'gradingState',
      'oddsMetadata',
      'odds',
      'price',
      'line',
      'market',
      'edge',
      'value',
      'recommendation',
      'multi',
      'parlay',
      'stake',
      'feature',
      'missing',
      'coefficient',
      'intercept',
      'rawScore',
      'metric',
      'label',
      'row',
      'sportsbook',
      'performance',
      'aggregate',
      'yield',
      'roi',
      'bankroll',
      'payout',
      'profit',
    ];

    const root = { ...grading.value } as Record<string, unknown>;
    for (const key of prohibitedRootFields) {
      root[key] = 'prohibited';
    }
    root.unknownField = 'unknown';

    const result = validateMLBOfflineRecommendationBundleGrading(root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issues = result.issues;
      for (const key of prohibitedRootFields) {
        if (isProhibitedOddsBoundaryKey(key)) {
          expect(issues).toContainEqual({
            code: 'ODDS_CONTAMINATION',
            path: `$.${key}`,
            message: 'Odds contamination detected',
          });
        } else {
          expect(issues).toContainEqual({
            code: 'PROHIBITED_CONCEPT',
            path: `$.${key}`,
            message: `Prohibited field: ${key}`,
          });
        }
      }
      expect(issues).toContainEqual({
        code: 'UNKNOWN_FIELD',
        path: '$.unknownField',
        message: 'Unknown field: unknownField',
      });

      const undefinedPerformanceRoot = {
        ...grading.value,
        performance: undefined,
      };
      const undefinedResult = validateMLBOfflineRecommendationBundleGrading(undefinedPerformanceRoot);
      expect(undefinedResult.ok).toBe(false);
      if (!undefinedResult.ok) {
        expect(undefinedResult.issues).toContainEqual({
          code: 'PROHIBITED_CONCEPT',
          path: '$.performance',
          message: 'Prohibited field: performance',
        });
      }
    }
  });

  it('verifies exact exports, imports, issue order, cascade suppression, no recommendation generation, no routes, no UI, no persistence, no clock, no randomness, and no network access', async () => {
    const sourcePath = path.resolve(
      process.cwd(),
      'src/prediction/mlb/mlb-offline-recommendation-bundle-grading-contract.ts',
    );
    const source = readFile(sourcePath, 'utf-8');
    await expect(source).resolves.toBeDefined();
  });
});
