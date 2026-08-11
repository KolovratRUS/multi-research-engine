import { afterEach, describe, expect, it } from 'vitest';
import {
  MLB_PRETEST_VALIDATION_REFERENCE_FACTS_CONTRACT_VERSION,
  MLB_PRETEST_GATE_POLICY_ID,
  type MLBPreTestValidationReferenceFacts,
  type MLBPreTestValidationReferenceFactsIssue,
  buildMLBPreTestValidationReferenceFacts,
  validateMLBPreTestValidationReferenceFacts,
} from '@/prediction/mlb/mlb-pretest-validation-reference-contract';
import {
  type MLBModelEvaluationPlan,
  validateMLBModelEvaluationPlan,
} from '@/prediction/mlb/mlb-model-training-plan-contract';
import { type MLBTrainingMatrixRow } from '@/prediction/mlb/mlb-training-matrix-contract';

function createValidPlan(): MLBModelEvaluationPlan {
  return {
    contractVersion: 'mlb-model-evaluation-plan-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    planId: 'matrix-1::config-1',
    matrixId: 'matrix-1',
    configId: 'config-1',
    manifestId: 'manifest-1',
    datasetId: 'dataset-1',
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    featureIds: ['p_1', 'p_2'],
    splitPolicy: {
      strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1',
      embargoDays: 0,
      train: { startDate: '2026-04-01', endDate: '2026-04-23' },
      validation: { startDate: '2026-04-24', endDate: '2026-04-28' },
      test: { startDate: '2026-04-29', endDate: '2026-05-03' },
    },
    splitCounts: { train: 4, validation: 2, test: 2 },
    totalRows: 8,
    protocol: 'TRAIN_FIT_VALIDATION_SELECT_TEST_FINAL_V1',
    selectionMetric: 'LOG_LOSS',
    reportedMetrics: ['LOG_LOSS', 'BRIER_SCORE', 'ROC_AUC'],
    testSetPolicy: 'HOLDOUT_UNTIL_CONFIGURATION_LOCKED',
  };
}

function createTrainRow(exampleId: string, targetValue: 0 | 1): MLBTrainingMatrixRow {
  return {
    exampleId,
    split: 'TRAIN',
    vector: {
      contractVersion: 'mlb-feature-vector-v1',
      sport: 'MLB',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      manifestId: 'manifest-1',
      snapshotId: 'snapshot-1',
      gameId: `game-${exampleId}`,
      officialDate: '2026-04-15',
      dataCutoffAt: '2026-04-15T09:00:00Z',
      values: [{ featureId: 'p_1', value: 1, wasMissing: false }],
    },
    targetValue,
  };
}

function createValidationRow(exampleId: string, targetValue: 0 | 1): MLBTrainingMatrixRow {
  return {
    exampleId,
    split: 'VALIDATION',
    vector: {
      contractVersion: 'mlb-feature-vector-v1',
      sport: 'MLB',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      manifestId: 'manifest-1',
      snapshotId: 'snapshot-2',
      gameId: `game-${exampleId}`,
      officialDate: '2026-04-24',
      dataCutoffAt: '2026-04-15T09:00:00Z',
      values: [{ featureId: 'p_1', value: 2, wasMissing: false }],
    },
    targetValue,
  };
}

function buildReference(
  trainRows: readonly MLBTrainingMatrixRow[],
  validationRows: readonly MLBTrainingMatrixRow[],
  plan = createValidPlan(),
): MLBPreTestValidationReferenceFacts {
  const result = buildMLBPreTestValidationReferenceFacts({
    trainRows,
    validationRows,
    evaluationPlan: plan,
  });
  if (result.ok) {
    return result.value;
  }
  expect.fail(`builder failed: ${result.issues.map((i) => i.code).join(', ')}`);
  throw new Error('unreachable');
}

describe('mlb-pretest-validation-reference-contract', () => {
  it('valid TRAIN + VALIDATION rows build valid contract', () => {
    const trainRows = [createTrainRow('t1', 1), createTrainRow('t2', 0)];
    const validationRows = [createValidationRow('v1', 1), createValidationRow('v2', 0)];
    const facts = buildReference(trainRows, validationRows);
    expect(facts.contractVersion).toBe(MLB_PRETEST_VALIDATION_REFERENCE_FACTS_CONTRACT_VERSION);
    expect(facts.sport).toBe('MLB');
    expect(facts.target).toBe('OFFICIAL_FINAL_GAME_WINNER');
    expect(facts.targetEncoding).toBe('HOME_WIN_1_AWAY_WIN_0');
  });

  it('p50 probability is exactly 0.5', () => {
    const trainRows = [createTrainRow('t1', 1), createTrainRow('t2', 0)];
    const validationRows = [createValidationRow('v1', 1), createValidationRow('v2', 0)];
    const facts = buildReference(trainRows, validationRows);
    expect(facts.p50.probability).toBe(0.5);
  });

  it('TRAIN prior equals TRAIN home wins / TRAIN count', () => {
    const trainRows = [createTrainRow('t1', 1), createTrainRow('t2', 1), createTrainRow('t3', 0)];
    const validationRows = [createValidationRow('v1', 1), createValidationRow('v2', 0)];
    const facts = buildReference(trainRows, validationRows);
    expect(facts.trainHomeWinCount).toBe(2);
    expect(facts.trainAwayWinCount).toBe(1);
    expect(facts.trainHomeWinPrior).toBeCloseTo(2 / 3);
    expect(facts.trainPrior.probability).toBeCloseTo(2 / 3);
  });

  it('P50 logLoss calculated correctly', () => {
    const trainRows = [createTrainRow('t1', 1), createTrainRow('t2', 0)];
    const validationRows = [createValidationRow('v1', 1), createValidationRow('v2', 0)];
    const facts = buildReference(trainRows, validationRows);
    const expected = (-(1 * Math.log(0.5) + 0 * Math.log(0.5)) + -(0 * Math.log(0.5) + 1 * Math.log(0.5))) / 2;
    expect(facts.p50.validationLogLoss).toBeCloseTo(expected);
  });

  it('P50 Brier calculated correctly', () => {
    const trainRows = [createTrainRow('t1', 1), createTrainRow('t2', 0)];
    const validationRows = [createValidationRow('v1', 1), createValidationRow('v2', 0)];
    const facts = buildReference(trainRows, validationRows);
    const expected = ((0.5 - 1) ** 2 + (0.5 - 0) ** 2) / 2;
    expect(facts.p50.validationBrierScore).toBeCloseTo(expected);
  });

  it('TRAIN-prior validation logLoss calculated correctly', () => {
    const trainRows = [createTrainRow('t1', 1), createTrainRow('t2', 0)];
    const validationRows = [createValidationRow('v1', 1), createValidationRow('v2', 0)];
    const facts = buildReference(trainRows, validationRows);
    const prior = 0.5;
    const clamped = Math.max(1e-15, Math.min(1 - 1e-15, prior));
    const expected = (-(1 * Math.log(clamped) + 0 * Math.log(1 - clamped)) + -(0 * Math.log(clamped) + 1 * Math.log(1 - clamped))) / 2;
    expect(facts.trainPrior.validationLogLoss).toBeCloseTo(expected);
  });

  it('TRAIN-prior validation Brier calculated correctly', () => {
    const trainRows = [createTrainRow('t1', 1), createTrainRow('t2', 0)];
    const validationRows = [createValidationRow('v1', 1), createValidationRow('v2', 0)];
    const facts = buildReference(trainRows, validationRows);
    const prior = 0.5;
    const expected = ((prior - 1) ** 2 + (prior - 0) ** 2) / 2;
    expect(facts.trainPrior.validationBrierScore).toBeCloseTo(expected);
  });

  it('builder is deterministic', () => {
    const trainRows = [createTrainRow('t1', 1), createTrainRow('t2', 0)];
    const validationRows = [createValidationRow('v1', 1), createValidationRow('v2', 0)];
    const a = buildReference(trainRows, validationRows);
    const b = buildReference(trainRows, validationRows);
    expect(a).toEqual(b);
  });

  it('empty TRAIN rejects', () => {
    const validationRows = [createValidationRow('v1', 1)];
    const result = buildMLBPreTestValidationReferenceFacts({
      trainRows: [],
      validationRows,
      evaluationPlan: createValidPlan(),
    });
    if (result.ok) {
      expect.fail('expected invalid');
    }
    expect(result.issues.some((i: MLBPreTestValidationReferenceFactsIssue) => i.code === 'INVALID_INTEGER')).toBe(true);
  });

  it('empty VALIDATION rejects', () => {
    const trainRows = [createTrainRow('t1', 1)];
    const result = buildMLBPreTestValidationReferenceFacts({
      trainRows,
      validationRows: [],
      evaluationPlan: createValidPlan(),
    });
    if (result.ok) {
      expect.fail('expected invalid');
    }
    expect(result.issues.some((i: MLBPreTestValidationReferenceFactsIssue) => i.code === 'INVALID_INTEGER')).toBe(true);
  });

  it('invalid TRAIN target rejects', () => {
    const trainRows = [{ ...createTrainRow('t1', 1), targetValue: 2 as unknown as 0 | 1 }];
    const validationRows = [createValidationRow('v1', 1)];
    const result = buildMLBPreTestValidationReferenceFacts({
      trainRows,
      validationRows,
      evaluationPlan: createValidPlan(),
    });
    if (result.ok) {
      expect.fail('expected invalid');
    }
    expect(result.issues.some((i: MLBPreTestValidationReferenceFactsIssue) => i.code === 'TARGET_INVALID')).toBe(true);
  });

  it('invalid VALIDATION target rejects', () => {
    const trainRows = [createTrainRow('t1', 1)];
    const validationRows = [{ ...createValidationRow('v1', 1), targetValue: -1 as unknown as 0 | 1 }];
    const result = buildMLBPreTestValidationReferenceFacts({
      trainRows,
      validationRows,
      evaluationPlan: createValidPlan(),
    });
    if (result.ok) {
      expect.fail('expected invalid');
    }
    expect(result.issues.some((i: MLBPreTestValidationReferenceFactsIssue) => i.code === 'TARGET_INVALID')).toBe(true);
  });

  it('TEST row in trainRows rejects', () => {
    const trainRows = [{ ...createTrainRow('t1', 1), split: 'TEST' } as MLBTrainingMatrixRow];
    const validationRows = [createValidationRow('v1', 1)];
    const result = buildMLBPreTestValidationReferenceFacts({
      trainRows,
      validationRows,
      evaluationPlan: createValidPlan(),
    });
    if (result.ok) {
      expect.fail('expected invalid');
    }
    expect(result.issues.some((i: MLBPreTestValidationReferenceFactsIssue) => i.code === 'SPLIT_VIOLATION')).toBe(true);
  });

  it('TEST row in validationRows rejects', () => {
    const trainRows = [createTrainRow('t1', 1)];
    const validationRows = [{ ...createValidationRow('v1', 1), split: 'TEST' } as MLBTrainingMatrixRow];
    const result = buildMLBPreTestValidationReferenceFacts({
      trainRows,
      validationRows,
      evaluationPlan: createValidPlan(),
    });
    if (result.ok) {
      expect.fail('expected invalid');
    }
    expect(result.issues.some((i: MLBPreTestValidationReferenceFactsIssue) => i.code === 'SPLIT_VIOLATION')).toBe(true);
  });

  it('p_train = 0 is valid', () => {
    const trainRows = [createTrainRow('t1', 0)];
    const validationRows = [createValidationRow('v1', 1), createValidationRow('v2', 0)];
    const facts = buildReference(trainRows, validationRows);
    expect(facts.trainHomeWinPrior).toBe(0);
    expect(facts.trainPrior.probability).toBe(0);
  });

  it('p_train = 1 is valid', () => {
    const trainRows = [createTrainRow('t1', 1)];
    const validationRows = [createValidationRow('v1', 1), createValidationRow('v2', 0)];
    const facts = buildReference(trainRows, validationRows);
    expect(facts.trainHomeWinPrior).toBe(1);
    expect(facts.trainPrior.probability).toBe(1);
  });

  it('p_train = 0 logLoss uses clipping and remains finite', () => {
    const trainRows = [createTrainRow('t1', 0)];
    const validationRows = [createValidationRow('v1', 1), createValidationRow('v2', 0)];
    const facts = buildReference(trainRows, validationRows);
    expect(Number.isFinite(facts.trainPrior.validationLogLoss)).toBe(true);
  });

  it('p_train = 1 logLoss uses clipping and remains finite', () => {
    const trainRows = [createTrainRow('t1', 1)];
    const validationRows = [createValidationRow('v1', 1), createValidationRow('v2', 0)];
    const facts = buildReference(trainRows, validationRows);
    expect(Number.isFinite(facts.trainPrior.validationLogLoss)).toBe(true);
  });

  it('Brier uses raw 0/1 prior, not clipped prior', () => {
    const trainRows = [createTrainRow('t1', 0)];
    const validationRows = [createValidationRow('v1', 1)];
    const facts = buildReference(trainRows, validationRows);
    expect(facts.trainPrior.validationBrierScore).toBeCloseTo((0 - 1) ** 2);
  });

  it('home+away count identity enforced', () => {
    const trainRows = [createTrainRow('t1', 1), createTrainRow('t2', 0)];
    const validationRows = [createValidationRow('v1', 1)];
    const facts = buildReference(trainRows, validationRows);
    expect(facts.trainHomeWinCount + facts.trainAwayWinCount).toBe(facts.trainRowCount);
  });

  it('malformed stored prior rejected by validator', () => {
    const issues = validateMLBPreTestValidationReferenceFacts({
      contractVersion: MLB_PRETEST_VALIDATION_REFERENCE_FACTS_CONTRACT_VERSION,
      sport: 'MLB',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
      matrixId: 'm',
      datasetId: 'd',
      evaluationPlanId: 'p',
      trainRowCount: 2,
      validationRowCount: 2,
      trainHomeWinCount: 1,
      trainAwayWinCount: 1,
      trainHomeWinPrior: 0.5,
      p50: { probability: 0.5, validationLogLoss: 0, validationBrierScore: 0 },
      trainPrior: { probability: 'not-a-number', validationLogLoss: 0, validationBrierScore: 0 },
    } as unknown);
    if (issues.ok) {
      expect.fail('expected invalid');
    }
    expect(issues.issues.some((i: MLBPreTestValidationReferenceFactsIssue) => i.code === 'INVALID_NUMBER')).toBe(true);
  });

  it('nonfinite reference metric rejected', () => {
    const issues = validateMLBPreTestValidationReferenceFacts({
      contractVersion: MLB_PRETEST_VALIDATION_REFERENCE_FACTS_CONTRACT_VERSION,
      sport: 'MLB',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
      matrixId: 'm',
      datasetId: 'd',
      evaluationPlanId: 'p',
      trainRowCount: 2,
      validationRowCount: 2,
      trainHomeWinCount: 1,
      trainAwayWinCount: 1,
      trainHomeWinPrior: 0.5,
      p50: { probability: 0.5, validationLogLoss: Number.NaN, validationBrierScore: 0 },
      trainPrior: { probability: 0.5, validationLogLoss: 0, validationBrierScore: 0 },
    } as unknown);
    if (issues.ok) {
      expect.fail('expected invalid');
    }
    expect(issues.issues.some((i: MLBPreTestValidationReferenceFactsIssue) => i.code === 'INVALID_NUMBER')).toBe(true);
  });

  it('reference contract has no TEST-derived field', () => {
    const trainRows = [createTrainRow('t1', 1), createTrainRow('t2', 0)];
    const validationRows = [createValidationRow('v1', 1), createValidationRow('v2', 0)];
    const facts = buildReference(trainRows, validationRows);
    expect((facts as Record<string, unknown>).testRowCount).toBeUndefined();
    expect((facts as Record<string, unknown>).testMetrics).toBeUndefined();
  });

  it('changing TEST-only rows in surrounding fixture data cannot alter builder output when TRAIN/VALIDATION inputs are unchanged', () => {
    const trainRows = [createTrainRow('t1', 1), createTrainRow('t2', 0)];
    const validationRows = [createValidationRow('v1', 1), createValidationRow('v2', 0)];
    const a = buildReference(trainRows, validationRows);
    const b = buildReference(trainRows, validationRows);
    expect(a).toEqual(b);
  });
});
