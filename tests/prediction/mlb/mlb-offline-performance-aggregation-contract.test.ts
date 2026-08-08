import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  MLB_OFFLINE_PERFORMANCE_AGGREGATION_CONTRACT_VERSION,
  type MLBOfflinePerformanceAggregationInput,
  type MLBOfflineSinglePickPerformance,
  type MLBOfflineMultiPerformance,
  type MLBOfflineMultiLegPerformance,
  type MLBOfflinePerformanceAggregation,
  type MLBOfflinePerformanceAggregationIssue,
  buildMLBOfflinePerformanceAggregation,
  validateMLBOfflinePerformanceAggregation,
} from '@/prediction/mlb/mlb-offline-performance-aggregation-contract';
import {
  buildMLBOfflineRecommendationBundleGrading,
  validateMLBOfflineRecommendationBundleGrading,
  type MLBOfflineRecommendationBundleGrading,
} from '@/prediction/mlb/mlb-offline-recommendation-bundle-grading-contract';
import {
  buildMLBOfflineOfficialFinalGameOutcomeSet,
  type MLBOfflineOfficialFinalGameOutcome,
  type MLBOfflineOfficialFinalGameOutcomeSet,
} from '@/prediction/mlb/mlb-offline-official-final-game-outcome-set-contract';
import { buildMLBOfflinePredictionSlate } from '@/prediction/mlb/mlb-offline-prediction-slate-contract';
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
  validateMLBOfflineRecommendationBundle,
  type MLBOfflineRecommendationBundle,
} from '@/prediction/mlb/mlb-offline-recommendation-bundle-contract';
import { buildMLBOfflineMultiRiskGuidanceSet } from '@/prediction/mlb/mlb-offline-multi-risk-guidance-contract';
import { isProhibitedOddsBoundaryKey } from '@/prediction/firewall/odds-contamination-guard';

const BASE_RELEASE_ID = 'release-1';
const BASE_SNAPSHOT_ID = 'snapshot-1';
const BASE_GAME_ID = 'game-1';
const BASE_OFFICIAL_DATE = '2024-06-01';
const BASE_DATA_CUTOFF = '2024-05-30T09:00:00.000Z';
const BASE_RECOMMENDED_AT = '2024-05-30T10:00:00.000Z';

let predictionCounter = 0;
let minimalCounter = 0;

function encodeComponent(value: string): string {
  return `${value.length}:${value}`;
}

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
      encodeComponent('OFFICIAL_FINAL') +
      encodeComponent('OFFICIAL_FINAL_GAME_WINNER') +
      encodeComponent(outcome.gameId) +
      encodeComponent(outcome.officialDate) +
      encodeComponent(outcome.scheduledStartAt) +
      encodeComponent(outcome.homeTeamId) +
      encodeComponent(outcome.awayTeamId) +
      encodeComponent(String(outcome.homeRuns)) +
      encodeComponent(String(outcome.awayRuns)) +
      encodeComponent(outcome.winnerTeamId) +
      encodeComponent(outcome.finalizedAt) +
      encodeComponent(outcome.source.sourceName) +
      encodeComponent(outcome.source.sourceRecordId) +
      encodeComponent(outcome.source.fetchedAt) +
      '::offline-official-final-game-outcome-v1';
    return Object.freeze({ ...outcome, outcomeId: id }) as MLBOfflineOfficialFinalGameOutcome;
  }
  return outcome;
}

function buildValidOutcomeSet(outcomes: readonly MLBOfflineOfficialFinalGameOutcome[]): MLBOfflineOfficialFinalGameOutcomeSet {
  const sortedOutcomes = outcomes.slice().sort((a, b) => {
    if (a.gameId < b.gameId) return -1;
    if (a.gameId > b.gameId) return 1;
    if (a.officialDate < b.officialDate) return -1;
    if (a.officialDate > b.officialDate) return 1;
    if (a.outcomeId < b.outcomeId) return -1;
    if (a.outcomeId > b.outcomeId) return 1;
    return 0;
  });
  const outcomeIds = sortedOutcomes.map((o) => o.outcomeId);
  const outcomeSetId = `${outcomeIds.length}${outcomeIds.length > 0 ? ':' : ''}${outcomeIds.map((id) => `${id.length}:${id}`).join('')}::offline-official-final-game-outcome-set-v1`;
  return Object.freeze({
    contractVersion: 'mlb-offline-official-final-game-outcome-set-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    outcomeSetId,
    outcomeCount: sortedOutcomes.length,
    outcomeIds: Object.freeze(outcomeIds) as readonly string[],
    outcomes: Object.freeze(sortedOutcomes) as readonly MLBOfflineOfficialFinalGameOutcome[],
  });
}

function buildMinimalValidGrading(suffix = ''): {
  bundle: MLBOfflineRecommendationBundle;
  outcomeSet: MLBOfflineOfficialFinalGameOutcomeSet;
  grading: MLBOfflineRecommendationBundleGrading;
} {
  minimalCounter += 1;
  const officialDate = suffix === 'beta' ? '2024-06-02' : '2024-06-01';
  const prediction1 = buildValidPrediction({ snapshotId: `snapshot-1${suffix}`, gameId: `${BASE_GAME_ID}${suffix}`, officialDate });
  const prediction2 = buildValidPrediction({ snapshotId: `snapshot-2${suffix}`, gameId: `${BASE_GAME_ID}-2${suffix}`, homeTeamId: `team-home-2${suffix}`, awayTeamId: `team-away-2${suffix}`, probabilities: { homeWinProbability: 0.6, awayWinProbability: 0.4 }, predictedSide: 'HOME', predictedTeamId: `team-home-2${suffix}`, officialDate });
  const slate = buildValidSlate([prediction1, prediction2]);
  const singlePick = buildValidSinglePick(slate);
  const candidateSet = buildValidCandidateSet(singlePick);
  const multi = buildValidMultiRecommendationSet(candidateSet);
  const bundle = buildValidBundle(singlePick, multi, BASE_RECOMMENDED_AT) as MLBOfflineRecommendationBundle;
  const outcome1 = makeValidOutcome({ gameId: `${BASE_GAME_ID}${suffix}`, officialDate });
  const outcome2 = makeValidOutcome({ gameId: `${BASE_GAME_ID}-2${suffix}`, homeTeamId: `team-home-2${suffix}`, awayTeamId: `team-away-2${suffix}`, winnerTeamId: `team-home-2${suffix}`, officialDate });
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

function buildGradingWithSinglePickResults(
  results: ('CORRECT' | 'INCORRECT' | 'UNRESOLVED')[],
  recommendedAt: string = BASE_RECOMMENDED_AT,
): MLBOfflineRecommendationBundleGrading {
  if (results.length < 2) {
    throw new Error('At least two predictions are required to build a valid candidate set');
  }
  const predictions: Record<string, unknown>[] = [];
  const outcomes: MLBOfflineOfficialFinalGameOutcome[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const gameId = `${BASE_GAME_ID}-custom-${i}`;
    const homeTeamId = `team-home-${i}`;
    const awayTeamId = `team-away-${i}`;
    predictions.push(
      buildValidPrediction({
        gameId,
        homeTeamId,
        awayTeamId,
        predictedSide: 'HOME',
        predictedTeamId: homeTeamId,
        snapshotId: `snapshot-${i}`,
      }),
    );
    if (result === 'CORRECT') {
      outcomes.push(
        makeValidOutcome({
          gameId,
          homeTeamId,
          awayTeamId,
          winnerTeamId: homeTeamId,
        }),
      );
    } else if (result === 'INCORRECT') {
      outcomes.push(
        makeValidOutcome({
          gameId,
          homeTeamId,
          awayTeamId,
          homeRuns: 0,
          awayRuns: 3,
          winnerTeamId: awayTeamId,
        }),
      );
    }
  }
  const slate = buildValidSlate(predictions);
  const singlePick = buildValidSinglePick(slate);
  const candidateSet = buildValidCandidateSet(singlePick);
  const multi = buildValidMultiRecommendationSet(candidateSet);
  const bundle = buildValidBundle(singlePick, multi, recommendedAt);
  const outcomeSet = buildValidOutcomeSet(outcomes);
  const input = {
    recommendationBundle: bundle,
    outcomeSet: outcomeSet,
  };
  const built = buildMLBOfflineRecommendationBundleGrading(input);
  if (!built.ok) {
    throw new Error(`Invalid grading: ${built.issues.map((i) => `${i.code}:${i.path}:${i.message}`).join(', ')}`);
  }
  return built.value;
}

function performanceSummary(results: readonly string[]): MLBOfflineSinglePickPerformance {
  const totalCount = results.length;
  const correctCount = results.filter((r) => r === 'CORRECT').length;
  const incorrectCount = results.filter((r) => r === 'INCORRECT').length;
  const unresolvedCount = results.filter((r) => r === 'UNRESOLVED').length;
  const resolvedCount = totalCount - unresolvedCount;
  const accuracy = resolvedCount > 0 ? correctCount / resolvedCount : null;
  const resolutionRate = totalCount > 0 ? resolvedCount / totalCount : null;
  return { totalCount, correctCount, incorrectCount, unresolvedCount, resolvedCount, accuracy, resolutionRate };
}

describe('MLBOfflinePerformanceAggregation contract', () => {
  it('accepts an empty self-validating performance aggregation with zero counts and null rates', () => {
    const result = buildMLBOfflinePerformanceAggregation({ gradings: [] });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected empty build to succeed');

    const value = result.value;
    expect(value.contractVersion).toBe(MLB_OFFLINE_PERFORMANCE_AGGREGATION_CONTRACT_VERSION);
    expect(value.sport).toBe('MLB');
    expect(value.target).toBe('OFFICIAL_FINAL_GAME_WINNER');
    expect(value.targetEncoding).toBe('HOME_WIN_1_AWAY_WIN_0');
    expect(value.gradingCount).toBe(0);
    expect(value.gradingIds).toEqual([]);
    expect(value.sourceGradings).toEqual([]);
    expect(value.singlePickPerformance).toEqual({
      totalCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      unresolvedCount: 0,
      resolvedCount: 0,
      accuracy: null,
      resolutionRate: null,
    });
    expect(value.multiPerformance).toEqual({
      totalCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      unresolvedCount: 0,
      resolvedCount: 0,
      accuracy: null,
      resolutionRate: null,
    });
    expect(value.multiLegPerformance).toEqual({
      totalCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      unresolvedCount: 0,
      resolvedCount: 0,
      accuracy: null,
      resolutionRate: null,
    });
    expect(value.aggregationId).toBe(
      encodeComponent(MLB_OFFLINE_PERFORMANCE_AGGREGATION_CONTRACT_VERSION) +
        encodeComponent('0') +
        '::offline-performance-aggregation-v1',
    );

    const selfValidation = validateMLBOfflinePerformanceAggregation(value);
    expect(selfValidation.ok).toBe(true);
    if (selfValidation.ok) {
      expect(selfValidation.value).toBe(value);
    }
  });

  it('aggregates one valid grading into exact single-pick, multi, and multi-leg summaries', () => {
    const { grading } = buildMinimalValidGrading();

    const result = buildMLBOfflinePerformanceAggregation({
      gradings: [grading],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected build to succeed');

    const singlePickResults: string[] = [];
    for (const grade of grading.singlePickGrades) {
      singlePickResults.push(grade.result);
    }
    const multiResults: string[] = [];
    const legResults: string[] = [];
    for (const multiGrade of grading.multiGrades) {
      multiResults.push(multiGrade.result);
      for (const legGrade of multiGrade.legGrades) {
        legResults.push(legGrade.result);
      }
    }

    expect(result.value.gradingCount).toBe(1);
    expect(result.value.gradingIds).toEqual([grading.gradingId]);
    expect(result.value.sourceGradings).toHaveLength(1);
    expect(result.value.sourceGradings[0]).toBe(grading);
    expect(result.value.singlePickPerformance).toEqual(performanceSummary(singlePickResults));
    expect(result.value.multiPerformance).toEqual(performanceSummary(multiResults));
    expect(result.value.multiLegPerformance).toEqual(performanceSummary(legResults));
  });

  it('aggregates mixed grading results into three independent performance summaries', () => {
    const allCorrect = buildGradingWithSinglePickResults(['CORRECT', 'CORRECT'], '2024-05-30T10:00:00.000Z');
    const allIncorrect = buildGradingWithSinglePickResults(['INCORRECT', 'INCORRECT'], '2024-05-30T10:01:00.000Z');
    const allUnresolved = buildGradingWithSinglePickResults(['UNRESOLVED', 'UNRESOLVED'], '2024-05-30T10:02:00.000Z');

    expect(allCorrect.recommendationBundleId).not.toBe(allIncorrect.recommendationBundleId);
    expect(allCorrect.recommendationBundleId).not.toBe(allUnresolved.recommendationBundleId);
    expect(allIncorrect.recommendationBundleId).not.toBe(allUnresolved.recommendationBundleId);
    expect(allCorrect.gradingId).not.toBe(allIncorrect.gradingId);
    expect(allCorrect.gradingId).not.toBe(allUnresolved.gradingId);
    expect(allIncorrect.gradingId).not.toBe(allUnresolved.gradingId);

    expect(validateMLBOfflineRecommendationBundleGrading(allCorrect).ok).toBe(true);
    expect(validateMLBOfflineRecommendationBundleGrading(allIncorrect).ok).toBe(true);
    expect(validateMLBOfflineRecommendationBundleGrading(allUnresolved).ok).toBe(true);

    const result = buildMLBOfflinePerformanceAggregation({
      gradings: [allCorrect, allIncorrect, allUnresolved],
    });

    if (!result.ok) {
      console.log('aggregation issues:', JSON.stringify(result.issues, null, 2));
    }

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected build to succeed');

    const singlePickResults: string[] = [];
    const multiResults: string[] = [];
    const legResults: string[] = [];
    for (const grading of [allCorrect, allIncorrect, allUnresolved]) {
      for (const grade of grading.singlePickGrades) {
        singlePickResults.push(grade.result);
      }
      for (const multiGrade of grading.multiGrades) {
        multiResults.push(multiGrade.result);
        for (const legGrade of multiGrade.legGrades) {
          legResults.push(legGrade.result);
        }
      }
    }

    expect(result.value.singlePickPerformance).toEqual(performanceSummary(singlePickResults));
    expect(result.value.multiPerformance).toEqual(performanceSummary(multiResults));
    expect(result.value.multiLegPerformance).toEqual(performanceSummary(legResults));
  });

  it('excludes UNRESOLVED results from the resolved accuracy denominator', () => {
    const grading = buildGradingWithSinglePickResults(['CORRECT', 'UNRESOLVED']);

    const result = buildMLBOfflinePerformanceAggregation({
      gradings: [grading],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected build to succeed');

    expect(result.value.singlePickPerformance.resolvedCount).toBe(1);
    expect(result.value.singlePickPerformance.accuracy).toBe(1);
    expect(result.value.singlePickPerformance.totalCount).toBe(2);
  });

  it('computes resolutionRate independently from resolved accuracy', () => {
    const grading = buildGradingWithSinglePickResults(['CORRECT', 'UNRESOLVED']);

    const result = buildMLBOfflinePerformanceAggregation({
      gradings: [grading],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected build to succeed');

    expect(result.value.singlePickPerformance.accuracy).toBe(1);
    expect(result.value.singlePickPerformance.resolutionRate).toBe(0.5);
  });

  it('treats zero resolved observations as null accuracy rather than zero', () => {
    const grading = buildGradingWithSinglePickResults(['UNRESOLVED', 'UNRESOLVED']);

    const result = buildMLBOfflinePerformanceAggregation({
      gradings: [grading],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected build to succeed');

    expect(result.value.singlePickPerformance.resolvedCount).toBe(0);
    expect(result.value.singlePickPerformance.accuracy).toBe(null);
    expect(result.value.singlePickPerformance.resolutionRate).toBe(0);
  });

  it('canonicalizes builder input by gradingId, makes caller-order permutations identity-equivalent, and rejects noncanonical stored source order', () => {
    const { grading: gradingA } = buildMinimalValidGrading('alpha');
    const { grading: gradingB } = buildMinimalValidGrading('beta');

    expect(gradingA.gradingId).not.toBe(gradingB.gradingId);
    expect(gradingA.recommendationBundleId).not.toBe(gradingB.recommendationBundleId);

    const inputAB = [gradingA, gradingB];
    const inputBA = [gradingB, gradingA];

    const resultAB = buildMLBOfflinePerformanceAggregation({ gradings: inputAB });
    const resultBA = buildMLBOfflinePerformanceAggregation({ gradings: inputBA });

    expect(resultAB.ok).toBe(true);
    expect(resultBA.ok).toBe(true);
    if (resultAB.ok && resultBA.ok) {
      expect(resultAB.value.aggregationId).toBe(resultBA.value.aggregationId);
      expect(resultAB.value.gradingIds).toEqual(resultBA.value.gradingIds);
      expect(resultAB.value.sourceGradings).toEqual(resultBA.value.sourceGradings);
      expect(resultAB.value.singlePickPerformance).toEqual(resultBA.value.singlePickPerformance);
      expect(resultAB.value.multiPerformance).toEqual(resultBA.value.multiPerformance);
      expect(resultAB.value.multiLegPerformance).toEqual(resultBA.value.multiLegPerformance);
    }

    expect(inputAB).toEqual([gradingA, gradingB]);
    expect(inputBA).toEqual([gradingB, gradingA]);

    if (resultAB.ok) {
      const reversed = {
        ...resultAB.value,
        sourceGradings: [...resultAB.value.sourceGradings].reverse(),
      };
      const reversedValidation = validateMLBOfflinePerformanceAggregation(reversed);
      expect(reversedValidation.ok).toBe(false);
      if (!reversedValidation.ok) {
        expect(reversedValidation.issues).toEqual(
          expect.arrayContaining([
            {
              code: 'SOURCE_GRADING_ORDER_MISMATCH',
              path: '$.sourceGradings',
              message: 'sourceGradings must be ordered by gradingId ascending',
            },
          ]),
        );
      }
    }
  });

  it('rejects duplicate gradingId values without silent deduplication', () => {
    const { grading } = buildMinimalValidGrading();

    const result = buildMLBOfflinePerformanceAggregation({
      gradings: [grading, grading],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          {
            code: 'DUPLICATE_GRADING_ID',
            path: '$.gradings',
            message: 'Duplicate gradingId values are not allowed',
          },
        ]),
      );
    }
  });

  it('rejects duplicate recommendationBundleId values across distinct grading snapshots', () => {
    const { grading: gradingA, bundle } = buildMinimalValidGrading('alpha');

    const differentOutcome = makeValidOutcome({
      gameId: `${BASE_GAME_ID}-custom-0`,
      homeTeamId: 'team-home-custom-0',
      awayTeamId: 'team-away-custom-0',
      winnerTeamId: 'team-home-custom-0',
    });
    const differentOutcomeSet = buildValidOutcomeSet([differentOutcome]);

    const secondInput = {
      recommendationBundle: bundle,
      outcomeSet: differentOutcomeSet,
    };
    const secondBuilt = buildMLBOfflineRecommendationBundleGrading(secondInput);
    if (!secondBuilt.ok) {
      throw new Error(`Invalid second grading: ${secondBuilt.issues.map((i) => `${i.code}:${i.path}`).join(', ')}`);
    }
    const gradingB = secondBuilt.value;

    expect(gradingB.gradingId).not.toBe(gradingA.gradingId);
    expect(gradingB.recommendationBundleId).toBe(gradingA.recommendationBundleId);

    const result = buildMLBOfflinePerformanceAggregation({
      gradings: [gradingA, gradingB],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          {
            code: 'DUPLICATE_RECOMMENDATION_BUNDLE_ID',
            path: '$.gradings',
            message: 'Duplicate recommendationBundleId values are not allowed',
          },
        ]),
      );
    }
  });

  it('collapses an invalid Phase 8R source grading to one exact SOURCE_GRADING_INVALID issue', () => {
    const result = buildMLBOfflinePerformanceAggregation({
      gradings: [{}],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        {
          code: 'SOURCE_GRADING_INVALID',
          path: '$.gradings[0]',
          message: 'Source recommendation bundle grading failed validation',
        },
      ]);
    }
  });

  it('validates exact builder-input root fields and gradings array ownership', () => {
    const missingResult = buildMLBOfflinePerformanceAggregation(
      {} as MLBOfflinePerformanceAggregationInput,
    );
    expect(missingResult.ok).toBe(false);
    if (!missingResult.ok) {
      expect(missingResult.issues).toEqual(
        expect.arrayContaining([
          {
            code: 'MISSING_FIELD',
            path: '$.gradings',
            message: 'gradings is required',
          },
        ]),
      );
    }

    const arrayResult = buildMLBOfflinePerformanceAggregation({
      gradings: 'not-array',
    } as unknown as MLBOfflinePerformanceAggregationInput);
    expect(arrayResult.ok).toBe(false);
    if (!arrayResult.ok) {
      expect(arrayResult.issues).toEqual(
        expect.arrayContaining([
          {
            code: 'INVALID_ARRAY',
            path: '$.gradings',
            message: 'gradings must be an array',
          },
        ]),
      );
    }

    const sparse = [{}];
    delete sparse[0];

    const sparseResult = buildMLBOfflinePerformanceAggregation({
      gradings: sparse,
    });
    expect(sparseResult.ok).toBe(false);
    if (!sparseResult.ok) {
      expect(sparseResult.issues).toEqual(
        expect.arrayContaining([
          {
            code: 'INVALID_ARRAY',
            path: '$.gradings',
            message: 'Sparse array',
          },
        ]),
      );
    }

    const symbolArray = [{}];
    Object.defineProperty(symbolArray, Symbol('test'), { value: true, writable: true });

    const symbolResult = buildMLBOfflinePerformanceAggregation({
      gradings: symbolArray,
    });
    expect(symbolResult.ok).toBe(false);
    if (!symbolResult.ok) {
      expect(symbolResult.issues).toEqual(
        expect.arrayContaining([
          {
            code: 'UNKNOWN_FIELD',
            path: '$.gradings[symbol]',
            message: 'Array symbol property',
          },
        ]),
      );
    }

    const accessorInput = {
      get gradings() {
        return [];
      },
    };

    const accessorResult = buildMLBOfflinePerformanceAggregation(
      accessorInput as unknown as MLBOfflinePerformanceAggregationInput,
    );
    expect(accessorResult.ok).toBe(false);
    if (!accessorResult.ok) {
      expect(accessorResult.issues).toEqual(
        expect.arrayContaining([
          {
            code: 'INVALID_JSON_VALUE',
            path: '$.gradings',
            message: 'Accessor property: gradings',
          },
        ]),
      );
    }

    const emptyResult = buildMLBOfflinePerformanceAggregation({ gradings: [] });
    expect(emptyResult.ok).toBe(true);
    if (emptyResult.ok) {
      expect(emptyResult.value.gradingCount).toBe(0);
    }
  });

  it('validates exact aggregate root fields, grading count, grading IDs, source-grading mappings, and targetEncoding', () => {
    const { grading } = buildMinimalValidGrading();
    const built = buildMLBOfflinePerformanceAggregation({ gradings: [grading] });
    if (!built.ok) throw new Error('Expected build to succeed');

    const value = built.value;
    expect(value).toHaveProperty('contractVersion');
    expect(value).toHaveProperty('sport');
    expect(value).toHaveProperty('target');
    expect(value).toHaveProperty('targetEncoding');
    expect(value).toHaveProperty('aggregationId');
    expect(value).toHaveProperty('gradingCount');
    expect(value).toHaveProperty('gradingIds');
    expect(value).toHaveProperty('singlePickPerformance');
    expect(value).toHaveProperty('multiPerformance');
    expect(value).toHaveProperty('multiLegPerformance');
    expect(value).toHaveProperty('sourceGradings');
    expect(Object.keys(value)).toHaveLength(11);

    expect(value.gradingCount).toBe(value.sourceGradings.length);
    expect(value.gradingIds).toEqual(value.sourceGradings.map((g) => g.gradingId));
    expect(value.targetEncoding).toBe('HOME_WIN_1_AWAY_WIN_0');

    const wrongCount = { ...value, gradingCount: value.gradingCount + 1 };
    const countValidation = validateMLBOfflinePerformanceAggregation(wrongCount);
    expect(countValidation.ok).toBe(false);
    if (!countValidation.ok) {
      expect(countValidation.issues).toEqual(
        expect.arrayContaining([
          {
            code: 'GRADING_COUNT_MISMATCH',
            path: '$.gradingCount',
            message: 'gradingCount does not match sourceGradings',
          },
        ]),
      );
    }

    const wrongIds = { ...value, gradingIds: ['wrong-id'] };
    const idsValidation = validateMLBOfflinePerformanceAggregation(wrongIds);
    expect(idsValidation.ok).toBe(false);
    if (!idsValidation.ok) {
      expect(idsValidation.issues).toEqual(
        expect.arrayContaining([
          {
            code: 'GRADING_IDS_MISMATCH',
            path: '$.gradingIds',
            message: 'gradingIds do not match canonical sourceGradings',
          },
        ]),
      );
    }
  });

  it('validates exact single-pick performance counts, accuracy, and resolution rate', () => {
    const { grading } = buildMinimalValidGrading();
    const built = buildMLBOfflinePerformanceAggregation({ gradings: [grading] });
    if (!built.ok) throw new Error('Expected build to succeed');

    const singlePickResults: string[] = [];
    for (const grade of grading.singlePickGrades) {
      singlePickResults.push(grade.result);
    }
    const expected = performanceSummary(singlePickResults);

    const wrongPerformance = {
      ...built.value,
      singlePickPerformance: { ...expected, totalCount: expected.totalCount + 1 },
    };
    const validation = validateMLBOfflinePerformanceAggregation(wrongPerformance);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.issues).toEqual(
        expect.arrayContaining([
          {
            code: 'SINGLE_PICK_PERFORMANCE_MISMATCH',
            path: '$.singlePickPerformance',
            message: 'singlePickPerformance does not match source gradings',
          },
        ]),
      );
    }
  });

  it('validates exact multi performance counts, accuracy, and resolution rate', () => {
    const { grading } = buildMinimalValidGrading();
    const built = buildMLBOfflinePerformanceAggregation({ gradings: [grading] });
    if (!built.ok) throw new Error('Expected build to succeed');

    const multiResults: string[] = [];
    for (const multiGrade of grading.multiGrades) {
      multiResults.push(multiGrade.result);
    }
    const expected = performanceSummary(multiResults);

    const wrongPerformance = {
      ...built.value,
      multiPerformance: { ...expected, totalCount: expected.totalCount + 1 },
    };
    const validation = validateMLBOfflinePerformanceAggregation(wrongPerformance);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.issues).toEqual(
        expect.arrayContaining([
          {
            code: 'MULTI_PERFORMANCE_MISMATCH',
            path: '$.multiPerformance',
            message: 'multiPerformance does not match source gradings',
          },
        ]),
      );
    }
  });

  it('validates exact multi-leg performance counts, accuracy, and resolution rate', () => {
    const { grading } = buildMinimalValidGrading();
    const built = buildMLBOfflinePerformanceAggregation({ gradings: [grading] });
    if (!built.ok) throw new Error('Expected build to succeed');

    const legResults: string[] = [];
    for (const multiGrade of grading.multiGrades) {
      for (const legGrade of multiGrade.legGrades) {
        legResults.push(legGrade.result);
      }
    }
    const expected = performanceSummary(legResults);

    const wrongPerformance = {
      ...built.value,
      multiLegPerformance: { ...expected, totalCount: expected.totalCount + 1 },
    };
    const validation = validateMLBOfflinePerformanceAggregation(wrongPerformance);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.issues).toEqual(
        expect.arrayContaining([
          {
            code: 'MULTI_LEG_PERFORMANCE_MISMATCH',
            path: '$.multiLegPerformance',
            message: 'multiLegPerformance does not match source gradings',
          },
        ]),
      );
    }
  });

  it('validates primitive integer and nullable rate domains without accepting NaN or Infinity', () => {
    const { grading } = buildMinimalValidGrading();
    const built = buildMLBOfflinePerformanceAggregation({ gradings: [grading] });
    if (!built.ok) throw new Error('Expected build to succeed');

    const base = built.value;

    const invalidCounts = [-1, 1.5, Number.MAX_SAFE_INTEGER + 1];
    for (const count of invalidCounts) {
      const invalid = {
        ...base,
        singlePickPerformance: { ...base.singlePickPerformance, totalCount: count as number },
      };
      const validation = validateMLBOfflinePerformanceAggregation(invalid);
      expect(validation.ok).toBe(false);
      if (!validation.ok) {
        expect(validation.issues).toEqual(
          expect.arrayContaining([
            {
              code: 'INVALID_INTEGER',
              path: '$.singlePickPerformance.totalCount',
              message: 'totalCount must be a non-negative safe integer',
            },
          ]),
        );
      }
    }

    const invalidRates = [-0.1, 1.1, NaN, Infinity, -Infinity, '0.5', true];
    for (const rate of invalidRates) {
      const invalid = {
        ...base,
        singlePickPerformance: { ...base.singlePickPerformance, accuracy: rate as number | string | boolean },
      };
      const validation = validateMLBOfflinePerformanceAggregation(invalid);
      expect(validation.ok).toBe(false);
      if (!validation.ok) {
        expect(validation.issues).toEqual(
          expect.arrayContaining([
            {
              code: 'INVALID_NUMBER',
              path: '$.singlePickPerformance.accuracy',
              message: 'accuracy must be null or a finite number in [0, 1]',
            },
          ]),
        );
      }
    }
  });

  it('validates deterministic length-prefixed aggregate identity and delimiter-collision resistance', () => {
    const { grading: gradingA } = buildMinimalValidGrading('alpha');
    const { grading: gradingB } = buildMinimalValidGrading('beta');

    const built = buildMLBOfflinePerformanceAggregation({ gradings: [gradingA, gradingB] });
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('Expected build to succeed');

    const gradingIds = [gradingA.gradingId, gradingB.gradingId];
    const expectedAggregationId =
      encodeComponent(MLB_OFFLINE_PERFORMANCE_AGGREGATION_CONTRACT_VERSION) +
      encodeComponent(String(gradingIds.length)) +
      gradingIds.map((id) => encodeComponent(id)).join('') +
      '::offline-performance-aggregation-v1';

    expect(built.value.aggregationId).toBe(expectedAggregationId);

    const emptyBuilt = buildMLBOfflinePerformanceAggregation({ gradings: [] });
    expect(emptyBuilt.ok).toBe(true);
    if (!emptyBuilt.ok) throw new Error('Expected empty build to succeed');
    expect(emptyBuilt.value.aggregationId).toBe(
      encodeComponent(MLB_OFFLINE_PERFORMANCE_AGGREGATION_CONTRACT_VERSION) +
        encodeComponent('0') +
        '::offline-performance-aggregation-v1',
    );

    const oldEmptyId = '0::offline-performance-aggregation-v1';
    const oldEmptyValidation = validateMLBOfflinePerformanceAggregation({
      ...emptyBuilt.value,
      aggregationId: oldEmptyId,
    });
    expect(oldEmptyValidation.ok).toBe(false);
    if (!oldEmptyValidation.ok) {
      expect(oldEmptyValidation.issues).toEqual(
        expect.arrayContaining([
          {
            code: 'AGGREGATION_ID_MISMATCH',
            path: '$.aggregationId',
            message: 'aggregationId does not match canonical source gradings',
          },
        ]),
      );
    }

    const collisionA = '10:0123456789';
    const collisionB = '1:0:123456789';
    const naiveConcatenation =
      encodeComponent(MLB_OFFLINE_PERFORMANCE_AGGREGATION_CONTRACT_VERSION) +
      encodeComponent('2') +
      collisionA +
      collisionB +
      '::offline-performance-aggregation-v1';
    const lengthPrefixed =
      encodeComponent(MLB_OFFLINE_PERFORMANCE_AGGREGATION_CONTRACT_VERSION) +
      encodeComponent('2') +
      encodeComponent(collisionA) +
      encodeComponent(collisionB) +
      '::offline-performance-aggregation-v1';

    expect(naiveConcatenation).not.toBe(lengthPrefixed);
  });

  it('preserves exact caller grading element references while allocating and freezing only Phase 8S-owned structures', () => {
    const { grading } = buildMinimalValidGrading();

    const input = { gradings: [grading] };
    const inputGradingsFrozen = Object.isFrozen(input.gradings);
    const gradingFrozen = Object.isFrozen(grading);

    const result = buildMLBOfflinePerformanceAggregation(input);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected build to succeed');

    const value = result.value;
    expect(value.sourceGradings[0]).toBe(grading);
    expect(value.gradingIds[0]).toBe(grading.gradingId);
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.gradingIds)).toBe(true);
    expect(Object.isFrozen(value.sourceGradings)).toBe(true);
    expect(Object.isFrozen(value.singlePickPerformance)).toBe(true);
    expect(Object.isFrozen(value.multiPerformance)).toBe(true);
    expect(Object.isFrozen(value.multiLegPerformance)).toBe(true);
    expect(Object.isFrozen(input.gradings)).toBe(inputGradingsFrozen);
    expect(Object.isFrozen(grading)).toBe(gradingFrozen);
  });

  it('accepts structural clones and returns the exact proposed aggregate root reference on validator success', () => {
    const { grading } = buildMinimalValidGrading();
    const built = buildMLBOfflinePerformanceAggregation({ gradings: [grading] });
    if (!built.ok) throw new Error('Expected build to succeed');

    const proposed = {
      ...built.value,
      gradingIds: [...built.value.gradingIds],
      sourceGradings: [...built.value.sourceGradings],
      singlePickPerformance: { ...built.value.singlePickPerformance },
      multiPerformance: { ...built.value.multiPerformance },
      multiLegPerformance: { ...built.value.multiLegPerformance },
    };

    const validation = validateMLBOfflinePerformanceAggregation(proposed);
    expect(validation.ok).toBe(true);
    if (validation.ok) {
      expect(validation.value).toBe(proposed);
    }
  });

  it('rejects unknown fields while allowing the explicit Phase 8S performance schema', () => {
    const built = buildMLBOfflinePerformanceAggregation({ gradings: [] });
    if (!built.ok) throw new Error('Expected builder to succeed');

    const validatorResult = validateMLBOfflinePerformanceAggregation({
      ...built.value,
      unknownField: 'value',
    });
    expect(validatorResult.ok).toBe(false);
    if (!validatorResult.ok) {
      expect(validatorResult.issues).toEqual(
        expect.arrayContaining([
          {
            code: 'UNKNOWN_FIELD',
            path: '$.unknownField',
            message: 'Unknown field: unknownField',
          },
        ]),
      );
    }

    const performanceValidatorResult = validateMLBOfflinePerformanceAggregation({
      ...built.value,
      singlePickPerformance: { totalCount: 0, correctCount: 0, incorrectCount: 0, unresolvedCount: 0, resolvedCount: 0, accuracy: null, resolutionRate: null },
    });
    expect(performanceValidatorResult.ok).toBe(true);
    if (performanceValidatorResult.ok) {
      expect(performanceValidatorResult.value.singlePickPerformance).toEqual({
        totalCount: 0,
        correctCount: 0,
        incorrectCount: 0,
        unresolvedCount: 0,
        resolvedCount: 0,
        accuracy: null,
        resolutionRate: null,
      });
    }

    const allowedValidatorResult = validateMLBOfflinePerformanceAggregation({
      ...built.value,
      accuracy: 0.9,
    });
    expect(allowedValidatorResult.ok).toBe(false);
    if (!allowedValidatorResult.ok) {
      expect(allowedValidatorResult.issues).toEqual(
        expect.arrayContaining([
          {
            code: 'UNKNOWN_FIELD',
            path: '$.accuracy',
            message: 'Unknown field: accuracy',
          },
        ]),
      );
    }

    const nestedPerformanceValidatorResult = validateMLBOfflinePerformanceAggregation({
      ...built.value,
      singlePickPerformance: {
        totalCount: 0,
        correctCount: 0,
        incorrectCount: 0,
        unresolvedCount: 0,
        resolvedCount: 0,
        accuracy: 0.9,
        resolutionRate: 0.5,
      },
    });
    expect(nestedPerformanceValidatorResult.ok).toBe(false);
    if (!nestedPerformanceValidatorResult.ok) {
      expect(nestedPerformanceValidatorResult.issues).toEqual(
        expect.arrayContaining([
          {
            code: 'SINGLE_PICK_PERFORMANCE_MISMATCH',
            path: '$.singlePickPerformance',
            message: 'singlePickPerformance does not match source gradings',
          },
        ]),
      );
    }
  });
  it('rejects odds contamination and prohibited monetary concepts without rejecting model-performance metrics', () => {
    const oddsBuilt = buildMLBOfflinePerformanceAggregation({ gradings: [] });
    if (!oddsBuilt.ok) throw new Error('Expected builder to succeed');

    const oddsValidatorResult = validateMLBOfflinePerformanceAggregation({
      ...oddsBuilt.value,
      odds: 1.5,
    });
    expect(oddsValidatorResult.ok).toBe(false);
    if (!oddsValidatorResult.ok) {
      expect(oddsValidatorResult.issues).toEqual(
        expect.arrayContaining([
          {
            code: 'ODDS_CONTAMINATION',
            path: '$.odds',
            message: 'Odds contamination detected',
          },
        ]),
      );
    }

    const prohibitedBuilt = buildMLBOfflinePerformanceAggregation({ gradings: [] });
    if (!prohibitedBuilt.ok) throw new Error('Expected builder to succeed');

    const prohibitedValidatorResult = validateMLBOfflinePerformanceAggregation({
      ...prohibitedBuilt.value,
      bankroll: 100,
    });
    expect(prohibitedValidatorResult.ok).toBe(false);
    if (!prohibitedValidatorResult.ok) {
      expect(prohibitedValidatorResult.issues).toEqual(
        expect.arrayContaining([
          {
            code: 'PROHIBITED_CONCEPT',
            path: '$.bankroll',
            message: 'Prohibited field: bankroll',
          },
        ]),
      );
    }

    const allowedBuilt = buildMLBOfflinePerformanceAggregation({ gradings: [] });
    if (!allowedBuilt.ok) throw new Error('Expected builder to succeed');

    const allowedValidatorResult = validateMLBOfflinePerformanceAggregation({
      ...allowedBuilt.value,
      accuracy: 0.9,
    });
    expect(allowedValidatorResult.ok).toBe(false);
    if (!allowedValidatorResult.ok) {
      expect(allowedValidatorResult.issues).toEqual(
        expect.arrayContaining([
          {
            code: 'UNKNOWN_FIELD',
            path: '$.accuracy',
            message: 'Unknown field: accuracy',
          },
        ]),
      );
    }
  });

  it('verifies exact exports, imports, issue order, cascade dependencies, and no routes, UI, persistence, network, clock, randomness, recommendation generation, or monetary evaluation', async () => {
    const sourcePath = path.resolve(
      process.cwd(),
      'src/prediction/mlb/mlb-offline-performance-aggregation-contract.ts',
    );
    const source = await readFile(sourcePath, 'utf-8');

    const fireImportMatch = source.match(/import\s+\{([^}]+)\}\s+from\s+['"]\.\.\/firewall\/odds-contamination-guard['"]/);
    if (!fireImportMatch) throw new Error('Missing firewall import');
    const fireImportNames = fireImportMatch[1]
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    expect(fireImportNames).toEqual(['assertNoOddsContamination', 'isProhibitedOddsBoundaryKey']);

    const r8ImportMatch = source.match(/import\s+\{([^}]+)\}\s+from\s+['"]\.\/mlb-offline-recommendation-bundle-grading-contract['"]/);
    if (!r8ImportMatch) throw new Error('Missing Phase 8R import');
    const r8ImportNames = r8ImportMatch[1]
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    expect(r8ImportNames).toEqual(['type MLBOfflineRecommendationBundleGrading', 'validateMLBOfflineRecommendationBundleGrading']);

    const exportMatches = source.match(/^export\s+(const|function|type)\s+(\w+)/gm);
    if (!exportMatches || exportMatches.length !== 9) throw new Error(`Expected 9 exports, got ${exportMatches?.length}`);
    const exportNames = exportMatches.map((match) => match.replace(/^export\s+(const|function|type)\s+/, ''));
    expect(exportNames).toEqual([
      'MLB_OFFLINE_PERFORMANCE_AGGREGATION_CONTRACT_VERSION',
      'MLBOfflinePerformanceAggregationInput',
      'MLBOfflineSinglePickPerformance',
      'MLBOfflineMultiPerformance',
      'MLBOfflineMultiLegPerformance',
      'MLBOfflinePerformanceAggregation',
      'MLBOfflinePerformanceAggregationIssue',
      'validateMLBOfflinePerformanceAggregation',
      'buildMLBOfflinePerformanceAggregation',
    ]);

    const issueCodes = source.match(/^\s*\| '[A-Z_]+'/gm);
    if (!issueCodes || issueCodes.length < 22) throw new Error('Issue union incomplete');
    const extractedIssueCodes = issueCodes.map((match) => match.replace(/^\s*\| '([^']+)'.*/, '$1'));
    expect(extractedIssueCodes).toEqual([
      'NOT_PLAIN_OBJECT',
      'UNKNOWN_FIELD',
      'INVALID_JSON_VALUE',
      'ODDS_CONTAMINATION',
      'PROHIBITED_CONCEPT',
      'MISSING_FIELD',
      'INVALID_LITERAL',
      'INVALID_STRING',
      'INVALID_INTEGER',
      'INVALID_NUMBER',
      'INVALID_ARRAY',
      'SOURCE_GRADING_INVALID',
      'DUPLICATE_GRADING_ID',
      'DUPLICATE_RECOMMENDATION_BUNDLE_ID',
      'SOURCE_GRADING_ORDER_MISMATCH',
      'GRADING_COUNT_MISMATCH',
      'GRADING_IDS_MISMATCH',
      'SINGLE_PICK_PERFORMANCE_MISMATCH',
      'MULTI_PERFORMANCE_MISMATCH',
      'MULTI_LEG_PERFORMANCE_MISMATCH',
      'AGGREGATION_ID_MISMATCH',
      'GENERATED_AGGREGATION_INVALID',
    ]);

    const forbiddenPatterns = [
      'localeCompare',
      'Intl.Collator',
      'Math.random',
      'Date.now',
      'crypto.randomUUID',
      'fetch(',
      'axios',
      'http.request',
      'https.request',
      'console.log',
      'console.debug',
      'debugger',
    ];
    for (const pattern of forbiddenPatterns) {
      expect(source).not.toContain(pattern);
    }

    const forbiddenImports = [
      'next/router',
      'react-router',
      'localStorage',
      'sessionStorage',
      'mlb-offline-recommendation-bundle-contract',
      'mlb-offline-prediction-slate-contract',
      'mlb-offline-single-pick-recommendation-contract',
      'mlb-offline-multi-candidate-contract',
      'mlb-offline-multi-recommendation-contract',
    ];
    for (const module of forbiddenImports) {
      expect(source).not.toContain(`from '${module}'`);
      expect(source).not.toContain(`from "${module}"`);
    }

    const freezeMatches = source.match(/Object\.freeze/g);
    expect(freezeMatches?.length).toBe(6);

    const normalizeIssuesMatches = source.match(/normalizeIssues/g);
    expect(normalizeIssuesMatches?.length).toBeGreaterThan(0);

    const noIssueArraySorting = !source.includes('issues.sort');
    expect(noIssueArraySorting).toBe(true);
  });
});
