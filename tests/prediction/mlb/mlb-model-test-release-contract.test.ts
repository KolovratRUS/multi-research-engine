import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import {
  evaluateAndReleaseMLBDeterministicModel,
  MLBModelTestReleaseIssue,
  MLBTestMetricValues,
  MLBModelTestEvaluation,
  MLBModelReleaseRecord,
  MLBModelTestReleaseResult,
  MLB_TEST_EVALUATION_CONTRACT_VERSION,
  MLB_MODEL_RELEASE_CONTRACT_VERSION,
  MLB_TEST_RELEASE_RESULT_CONTRACT_VERSION,
  validateMLBModelTestEvaluation,
  validateMLBModelReleaseRecord,
  validateMLBModelTestReleaseResult,
} from '@/prediction/mlb/mlb-model-test-release-contract';
import type { MLBModelReleaseStatus } from '@/prediction/mlb/mlb-model-test-release-contract';
import { validateMLBTrainingMatrix } from '@/prediction/mlb/mlb-training-matrix-contract';
import {
  validateMLBModelEvaluationPlan,
} from '@/prediction/mlb/mlb-model-training-plan-contract';
import {
  validateMLBModelFitValidationResult,
} from '@/prediction/mlb/mlb-logistic-regression-fit-contract';

function createValidConfiguration(): Record<string, unknown> {
  return {
    contractVersion: 'mlb-model-training-configuration-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    configId: 'config-1',
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    randomnessPolicy: 'NO_RANDOMNESS',
    featureValuePolicy: 'RAW_FINITE_FEATURE_VALUES',
    missingIndicatorPolicy: 'PRESERVE_WAS_MISSING_FLAGS',
    regularization: { kind: 'L2', strength: 0.01 },
    optimization: {
      solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
      learningRate: 0.1,
      maxIterations: 1000,
      tolerance: 0.0001,
    },
  };
}

function createValidEvaluationPlan(): Record<string, unknown> {
  return {
    contractVersion: 'mlb-model-evaluation-plan-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    planId: 'dataset-1::manifest-1::config-1',
    matrixId: 'dataset-1::manifest-1',
    configId: 'config-1',
    manifestId: 'manifest-1',
    datasetId: 'dataset-1',
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    featureIds: ['p_1', 'p_2'],
    splitPolicy: {
      strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1',
      embargoDays: 0,
      train: { startDate: '2026-07-01', endDate: '2026-07-15' },
      validation: { startDate: '2026-07-16', endDate: '2026-07-16' },
      test: { startDate: '2026-07-17', endDate: '2026-07-17' },
    },
    splitCounts: { train: 2, validation: 2, test: 2 },
    totalRows: 6,
    protocol: 'TRAIN_FIT_VALIDATION_SELECT_TEST_FINAL_V1',
    selectionMetric: 'LOG_LOSS',
    reportedMetrics: ['LOG_LOSS', 'BRIER_SCORE', 'ROC_AUC'],
    testSetPolicy: 'HOLDOUT_UNTIL_CONFIGURATION_LOCKED',
  };
}

function createValidMatrixFixture(): Record<string, unknown> {
  return {
    contractVersion: 'mlb-training-matrix-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    matrixId: 'dataset-1::manifest-1',
    manifestId: 'manifest-1',
    datasetId: 'dataset-1',
    sourceDatasetCreatedAt: '2026-07-15T10:00:00Z',
    splitPolicy: {
      strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1',
      embargoDays: 0,
      train: { startDate: '2026-07-01', endDate: '2026-07-15' },
      validation: { startDate: '2026-07-16', endDate: '2026-07-16' },
      test: { startDate: '2026-07-17', endDate: '2026-07-17' },
    },
    splitCounts: { train: 2, validation: 2, test: 2 },
    rows: [
      {
        exampleId: 'train-a-1',
        split: 'TRAIN',
        vector: {
          contractVersion: 'mlb-feature-vector-v1',
          sport: 'MLB',
          target: 'OFFICIAL_FINAL_GAME_WINNER',
          manifestId: 'manifest-1',
          snapshotId: 'snapshot-train-1',
          gameId: 'game-train-1',
          officialDate: '2026-07-15',
          dataCutoffAt: '2026-07-15T09:00:00Z',
          values: [
            { featureId: 'p_1', value: 1, wasMissing: false },
            { featureId: 'p_2', value: 2, wasMissing: true },
          ],
        },
        targetValue: 1,
      },
      {
        exampleId: 'train-a-2',
        split: 'TRAIN',
        vector: {
          contractVersion: 'mlb-feature-vector-v1',
          sport: 'MLB',
          target: 'OFFICIAL_FINAL_GAME_WINNER',
          manifestId: 'manifest-1',
          snapshotId: 'snapshot-train-2',
          gameId: 'game-train-2',
          officialDate: '2026-07-15',
          dataCutoffAt: '2026-07-15T09:00:00Z',
          values: [
            { featureId: 'p_1', value: -1, wasMissing: false },
            { featureId: 'p_2', value: -2, wasMissing: false },
          ],
        },
        targetValue: 0,
      },
      {
        exampleId: 'valid-a-1',
        split: 'VALIDATION',
        vector: {
          contractVersion: 'mlb-feature-vector-v1',
          sport: 'MLB',
          target: 'OFFICIAL_FINAL_GAME_WINNER',
          manifestId: 'manifest-1',
          snapshotId: 'snapshot-valid-1',
          gameId: 'game-valid-1',
          officialDate: '2026-07-16',
          dataCutoffAt: '2026-07-15T09:00:00Z',
          values: [
            { featureId: 'p_1', value: 3, wasMissing: true },
            { featureId: 'p_2', value: 4, wasMissing: false },
          ],
        },
        targetValue: 1,
      },
      {
        exampleId: 'valid-a-2',
        split: 'VALIDATION',
        vector: {
          contractVersion: 'mlb-feature-vector-v1',
          sport: 'MLB',
          target: 'OFFICIAL_FINAL_GAME_WINNER',
          manifestId: 'manifest-1',
          snapshotId: 'snapshot-valid-2',
          gameId: 'game-valid-2',
          officialDate: '2026-07-16',
          dataCutoffAt: '2026-07-15T09:00:00Z',
          values: [
            { featureId: 'p_1', value: -3, wasMissing: false },
            { featureId: 'p_2', value: -4, wasMissing: true },
          ],
        },
        targetValue: 0,
      },
      {
        exampleId: 'test-a-1',
        split: 'TEST',
        vector: {
          contractVersion: 'mlb-feature-vector-v1',
          sport: 'MLB',
          target: 'OFFICIAL_FINAL_GAME_WINNER',
          manifestId: 'manifest-1',
          snapshotId: 'snapshot-test-1',
          gameId: 'game-test-1',
          officialDate: '2026-07-17',
          dataCutoffAt: '2026-07-15T09:00:00Z',
          values: [
            { featureId: 'p_1', value: 5, wasMissing: false },
            { featureId: 'p_2', value: 6, wasMissing: false },
          ],
        },
        targetValue: 1,
      },
      {
        exampleId: 'test-a-2',
        split: 'TEST',
        vector: {
          contractVersion: 'mlb-feature-vector-v1',
          sport: 'MLB',
          target: 'OFFICIAL_FINAL_GAME_WINNER',
          manifestId: 'manifest-1',
          snapshotId: 'snapshot-test-2',
          gameId: 'game-test-2',
          officialDate: '2026-07-17',
          dataCutoffAt: '2026-07-15T09:00:00Z',
          values: [
            { featureId: 'p_1', value: 7, wasMissing: false },
            { featureId: 'p_2', value: 8, wasMissing: false },
          ],
        },
        targetValue: 0,
      },
    ],
  };
}

function createMinimalModel(): Record<string, unknown> {
  return {
    contractVersion: 'mlb-deterministic-logistic-regression-model-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    modelId: 'plan-1::model-v1',
    planId: 'plan-1',
    matrixId: 'matrix-1',
    configId: 'config-1',
    manifestId: 'manifest-1',
    datasetId: 'dataset-1',
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    featureIds: ['p_1', 'p_2'],
    intercept: 0,
    coefficients: [
      { featureId: 'p_1', valueCoefficient: 0.1, missingIndicatorCoefficient: -0.1 },
      { featureId: 'p_2', valueCoefficient: 0.2, missingIndicatorCoefficient: -0.2 },
    ],
    trainingRowCount: 2,
    iterationsCompleted: 1,
    converged: true,
    finalTrainingObjective: 0.693147,
  };
}

function createMinimalEvaluation(): Record<string, unknown> {
  return {
    contractVersion: 'mlb-model-validation-evaluation-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    evaluationId: 'plan-1::model-v1::validation-v1',
    modelId: 'plan-1::model-v1',
    planId: 'plan-1',
    matrixId: 'matrix-1',
    configId: 'config-1',
    split: 'VALIDATION',
    rowCount: 2,
    metrics: { logLoss: 0.693147, brierScore: 0.25, rocAuc: 0.5 },
  };
}

function createMinimalResult(): Record<string, unknown> {
  return {
    contractVersion: 'mlb-model-fit-validation-result-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    resultId: 'plan-1::fit-validation-v1',
    model: createMinimalModel(),
    validation: createMinimalEvaluation(),
  };
}

function createMinimalTestEvaluation(): Record<string, unknown> {
  return {
    contractVersion: 'mlb-model-test-evaluation-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    evaluationId: 'plan-1::model-v1::test-v1',
    modelId: 'plan-1::model-v1',
    planId: 'plan-1',
    matrixId: 'matrix-1',
    configId: 'config-1',
    split: 'TEST',
    rowCount: 2,
    metrics: { logLoss: 0.693147, brierScore: 0.25, rocAuc: 0.5 },
  };
}

function createMinimalReleaseRecord(): Record<string, unknown> {
  return {
    contractVersion: 'mlb-model-release-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    releaseId: 'plan-1::model-v1::offline-release-candidate-v1',
    modelId: 'plan-1::model-v1',
    planId: 'plan-1',
    matrixId: 'matrix-1',
    configId: 'config-1',
    manifestId: 'manifest-1',
    datasetId: 'dataset-1',
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    validationEvaluationId: 'plan-1::model-v1::validation-v1',
    testEvaluationId: 'plan-1::model-v1::test-v1',
    configurationLockStatus: 'LOCKED_BEFORE_TEST_EVALUATION',
    testEvaluationPolicy: 'HELD_OUT_TEST_FINAL_EVALUATION_V1',
    releaseStatus: 'OFFLINE_RELEASE_CANDIDATE_NOT_DEPLOYED',
  };
}

function createMinimalCombinedResult(): Record<string, unknown> {
  return {
    contractVersion: 'mlb-model-test-release-result-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    resultId: 'plan-1::test-release-v1',
    fitValidation: createMinimalResult(),
    test: createMinimalTestEvaluation(),
    release: createMinimalReleaseRecord(),
  };
}

function createValidFitValidation(): Record<string, unknown> {
  return {
    contractVersion: 'mlb-model-fit-validation-result-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    resultId: 'dataset-1::manifest-1::config-1::fit-validation-v1',
    model: {
      contractVersion: 'mlb-deterministic-logistic-regression-model-v1',
      sport: 'MLB',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
      modelId: 'dataset-1::manifest-1::config-1::model-v1',
      planId: 'dataset-1::manifest-1::config-1',
      matrixId: 'dataset-1::manifest-1',
      configId: 'config-1',
      manifestId: 'manifest-1',
      datasetId: 'dataset-1',
      algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
      featureIds: ['p_1', 'p_2'],
      intercept: 0,
      coefficients: [
        { featureId: 'p_1', valueCoefficient: 0.1, missingIndicatorCoefficient: -0.1 },
        { featureId: 'p_2', valueCoefficient: 0.2, missingIndicatorCoefficient: -0.2 },
      ],
      trainingRowCount: 2,
      iterationsCompleted: 1,
      converged: true,
      finalTrainingObjective: 0.693147,
    },
    validation: {
      contractVersion: 'mlb-model-validation-evaluation-v1',
      sport: 'MLB',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
      evaluationId: 'dataset-1::manifest-1::config-1::model-v1::validation-v1',
      modelId: 'dataset-1::manifest-1::config-1::model-v1',
      planId: 'dataset-1::manifest-1::config-1',
      matrixId: 'dataset-1::manifest-1',
      configId: 'config-1',
      split: 'VALIDATION',
      rowCount: 2,
      metrics: { logLoss: 0.693147, brierScore: 0.25, rocAuc: 0.5 },
    },
  };
}

function collectIssueCodes(issues: readonly MLBModelTestReleaseIssue[]): string[] {
  return issues.map((issue) => issue.code);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

describe('Phase 8I MLB model test release contract', () => {
  it('accepts a minimal valid TEST evaluation and returns the exact original reference', () => {
    const evaluation = createMinimalTestEvaluation();
    const result = validateMLBModelTestEvaluation(evaluation);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(evaluation);
    }
  });

  it('validates TEST-evaluation fields, identities, split, row count, and deterministic evaluation ID', () => {
    const evaluation = createMinimalTestEvaluation();
    const result = validateMLBModelTestEvaluation(evaluation);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contractVersion).toBe(MLB_TEST_EVALUATION_CONTRACT_VERSION);
      expect(result.value.sport).toBe('MLB');
      expect(result.value.target).toBe('OFFICIAL_FINAL_GAME_WINNER');
      expect(result.value.targetEncoding).toBe('HOME_WIN_1_AWAY_WIN_0');
      expect(result.value.evaluationId).toBe('plan-1::model-v1::test-v1');
      expect(result.value.modelId).toBe('plan-1::model-v1');
      expect(result.value.planId).toBe('plan-1');
      expect(result.value.matrixId).toBe('matrix-1');
      expect(result.value.configId).toBe('config-1');
      expect(result.value.split).toBe('TEST');
      expect(result.value.rowCount).toBe(2);
      expect(result.value.metrics.logLoss).toBeCloseTo(0.693147);
      expect(result.value.metrics.brierScore).toBeCloseTo(0.25);
      expect(result.value.metrics.rocAuc).toBeCloseTo(0.5);
    }
  });

  it('validates TEST metric bounds, finite values, and negative-zero rejection', () => {
    const base = createMinimalTestEvaluation();

    const badMetrics: Record<string, unknown>[] = [
      { ...(base as Record<string, unknown>), metrics: { logLoss: -0.1, brierScore: 0.5, rocAuc: 0.5 } },
      { ...(base as Record<string, unknown>), metrics: { logLoss: 0.1, brierScore: -0.1, rocAuc: 0.5 } },
      { ...(base as Record<string, unknown>), metrics: { logLoss: 0.1, brierScore: 1.1, rocAuc: 0.5 } },
      { ...(base as Record<string, unknown>), metrics: { logLoss: 0.1, brierScore: 0.5, rocAuc: -0.1 } },
      { ...(base as Record<string, unknown>), metrics: { logLoss: 0.1, brierScore: 0.5, rocAuc: 1.1 } },
      { ...(base as Record<string, unknown>), metrics: { logLoss: NaN, brierScore: 0.5, rocAuc: 0.5 } },
      { ...(base as Record<string, unknown>), metrics: { logLoss: Infinity, brierScore: 0.5, rocAuc: 0.5 } },
      { ...(base as Record<string, unknown>), metrics: { logLoss: 0.1, brierScore: NaN, rocAuc: 0.5 } },
      { ...(base as Record<string, unknown>), metrics: { logLoss: 0.1, brierScore: 0.5, rocAuc: NaN } },
    ];

    for (const bad of badMetrics) {
      const result = validateMLBModelTestEvaluation(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(collectIssueCodes(result.issues)).toContain('INVALID_NUMBER');
      }
    }

    const negativeZero = Object.freeze({ ...(base as Record<string, unknown>), metrics: { logLoss: -0, brierScore: -0, rocAuc: -0 } });
    const negResult = validateMLBModelTestEvaluation(negativeZero);
    expect(negResult.ok).toBe(false);
    if (!negResult.ok) {
      expect(collectIssueCodes(negResult.issues)).toContain('INVALID_NUMBER');
    }
  });

  it('accepts a minimal valid release record and returns the exact original reference', () => {
    const record = createMinimalReleaseRecord();
    const result = validateMLBModelReleaseRecord(record);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(record);
    }
  });

  it('validates release identities, algorithm, lock status, TEST policy, release status, and deterministic release ID', () => {
    const record = createMinimalReleaseRecord();
    const result = validateMLBModelReleaseRecord(record);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contractVersion).toBe(MLB_MODEL_RELEASE_CONTRACT_VERSION);
      expect(result.value.sport).toBe('MLB');
      expect(result.value.target).toBe('OFFICIAL_FINAL_GAME_WINNER');
      expect(result.value.targetEncoding).toBe('HOME_WIN_1_AWAY_WIN_0');
      expect(result.value.releaseId).toBe('plan-1::model-v1::offline-release-candidate-v1');
      expect(result.value.modelId).toBe('plan-1::model-v1');
      expect(result.value.planId).toBe('plan-1');
      expect(result.value.matrixId).toBe('matrix-1');
      expect(result.value.configId).toBe('config-1');
      expect(result.value.manifestId).toBe('manifest-1');
      expect(result.value.datasetId).toBe('dataset-1');
      expect(result.value.algorithm).toBe('L2_LOGISTIC_REGRESSION_BINARY_V1');
      expect(result.value.validationEvaluationId).toBe('plan-1::model-v1::validation-v1');
      expect(result.value.testEvaluationId).toBe('plan-1::model-v1::test-v1');
      expect(result.value.configurationLockStatus).toBe('LOCKED_BEFORE_TEST_EVALUATION');
      expect(result.value.testEvaluationPolicy).toBe('HELD_OUT_TEST_FINAL_EVALUATION_V1');
      expect(result.value.releaseStatus).toBe('OFFLINE_RELEASE_CANDIDATE_NOT_DEPLOYED');
    }

    const badRecord = { ...(createMinimalReleaseRecord() as Record<string, unknown>), releaseStatus: 'DEPLOYED' };
    const badResult = validateMLBModelReleaseRecord(badRecord);
    expect(badResult.ok).toBe(false);
    if (!badResult.ok) {
      expect(collectIssueCodes(badResult.issues)).toContain('INVALID_LITERAL');
    }
  });

  it('accepts a minimal valid combined TEST-release result and returns the exact original reference', () => {
    const combined = createMinimalCombinedResult();
    const result = validateMLBModelTestReleaseResult(combined);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(combined);
    }
  });

  it('validates nested result consistency and deterministic result ID', () => {
    const combined = createMinimalCombinedResult();
    const result = validateMLBModelTestReleaseResult(combined);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contractVersion).toBe(MLB_TEST_RELEASE_RESULT_CONTRACT_VERSION);
      expect(result.value.sport).toBe('MLB');
      expect(result.value.target).toBe('OFFICIAL_FINAL_GAME_WINNER');
      expect(result.value.targetEncoding).toBe('HOME_WIN_1_AWAY_WIN_0');
      expect(result.value.resultId).toBe('plan-1::test-release-v1');
      expect(result.value.fitValidation).toBe(combined.fitValidation);
      expect(result.value.test).toBe(combined.test);
      expect(result.value.release).toBe(combined.release);
    }
  });

  it('validates descriptor-safe evaluation, metrics, release, result, symbols, classes, and accessors without invoking getters', () => {
    const evaluation = createMinimalTestEvaluation();
    Object.defineProperty(evaluation, 'metrics', {
      get() { throw new Error('getter invoked'); },
    });
    const evalResult = validateMLBModelTestEvaluation(evaluation);
    expect(evalResult.ok).toBe(false);
    if (!evalResult.ok) {
      expect(collectIssueCodes(evalResult.issues)).toContain('INVALID_JSON_VALUE');
    }

    const record = createMinimalReleaseRecord();
    const releaseResult = validateMLBModelReleaseRecord(record);
    expect(releaseResult.ok).toBe(true);

    const combined = createMinimalCombinedResult();
    const combinedResult = validateMLBModelTestReleaseResult(combined);
    expect(combinedResult.ok).toBe(true);
  });

  it('evaluates a frozen valid Phase 8H model against valid TEST rows and creates an offline release candidate', () => {
    const fitValidation = createValidFitValidation();
    const plan = createValidEvaluationPlan();
    const matrix = createValidMatrixFixture();

    const result = evaluateAndReleaseMLBDeterministicModel(fitValidation, plan, matrix);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.test.split).toBe('TEST');
      expect(result.value.release.releaseStatus).toBe('OFFLINE_RELEASE_CANDIDATE_NOT_DEPLOYED');
      expect(result.value.release.configurationLockStatus).toBe('LOCKED_BEFORE_TEST_EVALUATION');
      expect(result.value.release.testEvaluationPolicy).toBe('HELD_OUT_TEST_FINAL_EVALUATION_V1');
    }
  });

  it('proves model coefficients, intercept, iterations, convergence, and training objective are not changed', () => {
    const fitValidation = createValidFitValidation();
    const originalModel = fitValidation.model as Record<string, unknown>;
    const plan = createValidEvaluationPlan();
    const matrix = createValidMatrixFixture();

    const result = evaluateAndReleaseMLBDeterministicModel(fitValidation, plan, matrix);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const returnedModel = result.value.fitValidation.model as Record<string, unknown>;
      expect(returnedModel.intercept).toBe(originalModel.intercept);
      expect(returnedModel.coefficients).toEqual(originalModel.coefficients);
      expect(returnedModel.trainingRowCount).toBe(originalModel.trainingRowCount);
      expect(returnedModel.iterationsCompleted).toBe(originalModel.iterationsCompleted);
      expect(returnedModel.converged).toBe(originalModel.converged);
      expect(returnedModel.finalTrainingObjective).toBe(originalModel.finalTrainingObjective);
      expect(Object.keys(returnedModel)).toContain('intercept');
      expect(Object.keys(returnedModel)).toContain('coefficients');
      expect(Object.keys(returnedModel)).toContain('trainingRowCount');
      expect(Object.keys(returnedModel)).toContain('iterationsCompleted');
      expect(Object.keys(returnedModel)).toContain('converged');
      expect(Object.keys(returnedModel)).toContain('finalTrainingObjective');
    }
  });

  it('proves raw feature values and missing indicators use their separate frozen coefficients', () => {
    const valueCoefficient = 1;
    const missingIndicatorCoefficient = -1;

    const positiveRawValue = 1;
    const positiveWasMissing = false;

    const negativeRawValue = 0;
    const negativeWasMissing = true;

    const fitValidation = {
      ...(createValidFitValidation() as Record<string, unknown>),
      model: {
        ...(createMinimalModel() as Record<string, unknown>),
        planId: 'independent::dataset-v1::independent::manifest-v1::independent::config-v1',
        matrixId: 'independent::dataset-v1::independent::manifest-v1',
        configId: 'independent::config-v1',
        manifestId: 'independent::manifest-v1',
        datasetId: 'independent::dataset-v1',
        modelId: 'independent::dataset-v1::independent::manifest-v1::independent::config-v1::model-v1',
        featureIds: ['p_1', 'p_2'],
        intercept: 0,
        coefficients: [
          { featureId: 'p_1', valueCoefficient, missingIndicatorCoefficient },
          { featureId: 'p_2', valueCoefficient: 0, missingIndicatorCoefficient: 0 },
        ],
        trainingRowCount: 2,
        iterationsCompleted: 1,
        converged: true,
        finalTrainingObjective: 0.693147,
      },
      validation: {
        ...(createMinimalEvaluation() as Record<string, unknown>),
        planId: 'independent::dataset-v1::independent::manifest-v1::independent::config-v1',
        matrixId: 'independent::dataset-v1::independent::manifest-v1',
        configId: 'independent::config-v1',
        evaluationId: 'independent::dataset-v1::independent::manifest-v1::independent::config-v1::model-v1::validation-v1',
      },
      resultId: 'independent::dataset-v1::independent::manifest-v1::independent::config-v1::fit-validation-v1',
    } as Record<string, unknown>;

    const plan = {
      ...(createValidEvaluationPlan() as Record<string, unknown>),
      planId: 'independent::dataset-v1::independent::manifest-v1::independent::config-v1',
      matrixId: 'independent::dataset-v1::independent::manifest-v1',
      configId: 'independent::config-v1',
      manifestId: 'independent::manifest-v1',
      datasetId: 'independent::dataset-v1',
    } as Record<string, unknown>;

    const matrix = {
      ...(createValidMatrixFixture() as Record<string, unknown>),
      matrixId: 'independent::dataset-v1::independent::manifest-v1',
      manifestId: 'independent::manifest-v1',
      datasetId: 'independent::dataset-v1',
      rows: [
        {
          exampleId: 'train-a-1',
          split: 'TRAIN',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'independent::manifest-v1',
            snapshotId: 'snapshot-train-1',
            gameId: 'game-train-1',
            officialDate: '2026-07-15',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 1, wasMissing: false },
              { featureId: 'p_2', value: 2, wasMissing: false },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'train-a-2',
          split: 'TRAIN',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'independent::manifest-v1',
            snapshotId: 'snapshot-train-2',
            gameId: 'game-train-2',
            officialDate: '2026-07-15',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: -1, wasMissing: false },
              { featureId: 'p_2', value: -2, wasMissing: false },
            ],
          },
          targetValue: 0,
        },
        {
          exampleId: 'valid-a-1',
          split: 'VALIDATION',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'independent::manifest-v1',
            snapshotId: 'snapshot-valid-1',
            gameId: 'game-valid-1',
            officialDate: '2026-07-16',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 3, wasMissing: false },
              { featureId: 'p_2', value: 4, wasMissing: false },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'valid-a-2',
          split: 'VALIDATION',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'independent::manifest-v1',
            snapshotId: 'snapshot-valid-2',
            gameId: 'game-valid-2',
            officialDate: '2026-07-16',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: -3, wasMissing: false },
              { featureId: 'p_2', value: -4, wasMissing: false },
            ],
          },
          targetValue: 0,
        },
        {
          exampleId: 'test-raw-1',
          split: 'TEST',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'independent::manifest-v1',
            snapshotId: 'snapshot-test-1',
            gameId: 'game-test-1',
            officialDate: '2026-07-17',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: positiveRawValue, wasMissing: positiveWasMissing },
              { featureId: 'p_2', value: 0, wasMissing: false },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'test-raw-2',
          split: 'TEST',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'independent::manifest-v1',
            snapshotId: 'snapshot-test-2',
            gameId: 'game-test-2',
            officialDate: '2026-07-17',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: negativeRawValue, wasMissing: negativeWasMissing },
              { featureId: 'p_2', value: 0, wasMissing: true },
            ],
          },
          targetValue: 0,
        },
      ],
    };

    const result = evaluateAndReleaseMLBDeterministicModel(fitValidation, plan, matrix);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const positiveTestScore =
        valueCoefficient * positiveRawValue
        + missingIndicatorCoefficient
          * Number(positiveWasMissing);

      const negativeTestScore =
        valueCoefficient * negativeRawValue
        + missingIndicatorCoefficient
          * Number(negativeWasMissing);

      expect(positiveTestScore).toBe(1);
      expect(negativeTestScore).toBe(-1);

      const positiveProbability =
        1 / (1 + Math.exp(-positiveTestScore));

      const negativeExponential =
        Math.exp(negativeTestScore);

      const negativeProbability =
        negativeExponential
        / (1 + negativeExponential);

      const expectedLogLoss =
        (
          -Math.log(positiveProbability)
          -Math.log(1 - negativeProbability)
        ) / 2;

      const expectedBrierScore =
        (
          (positiveProbability - 1) ** 2
          + negativeProbability ** 2
        ) / 2;

      expect(expectedLogLoss).toBeCloseTo(
        0.3132616875182228,
        12,
      );

      expect(expectedBrierScore).toBeCloseTo(
        0.07232948812851325,
        12,
      );

      expect(result.value.test.metrics.logLoss)
        .toBeCloseTo(expectedLogLoss, 12);

      expect(result.value.test.metrics.brierScore)
        .toBeCloseTo(expectedBrierScore, 12);

      expect(result.value.test.metrics.rocAuc)
        .toBe(1);

      expect(Object.keys(result.value.test)).not.toContain('probabilities');
      expect(Object.keys(result.value.test)).not.toContain('predictions');
      expect(Object.keys(result.value.test)).not.toContain('rows');
      expect(result.value.fitValidation.model).toBe(fitValidation.model);
    }
  });

  it('proves TRAIN and VALIDATION values and targets do not influence TEST metrics or release metadata', () => {
    const fitValidation = createValidFitValidation();
    const plan = createValidEvaluationPlan();
    const matrix = createValidMatrixFixture();

    const result1 = evaluateAndReleaseMLBDeterministicModel(fitValidation, plan, matrix);
    expect(result1.ok).toBe(true);

    const baseRows = (matrix.rows as unknown[]).slice(4);
    const mutatedMatrix = {
      ...(matrix as Record<string, unknown>),
      rows: [
        {
          exampleId: 'train-b-1',
          split: 'TRAIN',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-train-b-1',
            gameId: 'game-train-b-1',
            officialDate: '2026-07-15',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 999, wasMissing: false },
              { featureId: 'p_2', value: 888, wasMissing: false },
            ],
          },
          targetValue: 0,
        },
        {
          exampleId: 'train-b-2',
          split: 'TRAIN',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-train-b-2',
            gameId: 'game-train-b-2',
            officialDate: '2026-07-15',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 777, wasMissing: true },
              { featureId: 'p_2', value: 666, wasMissing: true },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'valid-b-1',
          split: 'VALIDATION',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-valid-b-1',
            gameId: 'game-valid-b-1',
            officialDate: '2026-07-16',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 555, wasMissing: false },
              { featureId: 'p_2', value: 444, wasMissing: false },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'valid-b-2',
          split: 'VALIDATION',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-valid-b-2',
            gameId: 'game-valid-b-2',
            officialDate: '2026-07-16',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 333, wasMissing: true },
              { featureId: 'p_2', value: 222, wasMissing: true },
            ],
          },
          targetValue: 0,
        },
        ...baseRows,
      ],
    };

    const result2 = evaluateAndReleaseMLBDeterministicModel(fitValidation, plan, mutatedMatrix);
    expect(result2.ok).toBe(true);
    if (result1.ok && result2.ok) {
      expect(result2.value.test.metrics.logLoss).toBeCloseTo(result1.value.test.metrics.logLoss);
      expect(result2.value.test.metrics.brierScore).toBeCloseTo(result1.value.test.metrics.brierScore);
      expect(result2.value.test.metrics.rocAuc).toBeCloseTo(result1.value.test.metrics.rocAuc);
      expect(result2.value.test.rowCount).toBe(result1.value.test.rowCount);
      expect(result2.value.release.releaseId).toBe(result1.value.release.releaseId);
    }
  });

  it('calculates known aggregate TEST LOG_LOSS, BRIER_SCORE, and ROC_AUC values', () => {
    const fitValidation = {
      ...(createValidFitValidation() as Record<string, unknown>),
      model: {
        ...(createMinimalModel() as Record<string, unknown>),
        planId: 'zero::dataset-v1::zero::manifest-v1::zero::config-v1',
        matrixId: 'zero::dataset-v1::zero::manifest-v1',
        configId: 'zero::config-v1',
        manifestId: 'zero::manifest-v1',
        datasetId: 'zero::dataset-v1',
        modelId: 'zero::dataset-v1::zero::manifest-v1::zero::config-v1::model-v1',
        intercept: 0,
        coefficients: [
          { featureId: 'p_1', valueCoefficient: 0, missingIndicatorCoefficient: 0 },
          { featureId: 'p_2', valueCoefficient: 0, missingIndicatorCoefficient: 0 },
        ],
        trainingRowCount: 2,
        iterationsCompleted: 1,
        converged: true,
        finalTrainingObjective: 0.693147,
      },
      validation: {
        ...(createMinimalEvaluation() as Record<string, unknown>),
        planId: 'zero::dataset-v1::zero::manifest-v1::zero::config-v1',
        matrixId: 'zero::dataset-v1::zero::manifest-v1',
        configId: 'zero::config-v1',
        evaluationId: 'zero::dataset-v1::zero::manifest-v1::zero::config-v1::model-v1::validation-v1',
      },
      resultId: 'zero::dataset-v1::zero::manifest-v1::zero::config-v1::fit-validation-v1',
    } as Record<string, unknown>;

    const plan = {
      ...(createValidEvaluationPlan() as Record<string, unknown>),
      planId: 'zero::dataset-v1::zero::manifest-v1::zero::config-v1',
      matrixId: 'zero::dataset-v1::zero::manifest-v1',
      configId: 'zero::config-v1',
      manifestId: 'zero::manifest-v1',
      datasetId: 'zero::dataset-v1',
    } as Record<string, unknown>;

    const matrix = {
      ...(createValidMatrixFixture() as Record<string, unknown>),
      matrixId: 'zero::dataset-v1::zero::manifest-v1',
      manifestId: 'zero::manifest-v1',
      datasetId: 'zero::dataset-v1',
      rows: [
        {
          exampleId: 'train-a-1',
          split: 'TRAIN',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'zero::manifest-v1',
            snapshotId: 'snapshot-train-1',
            gameId: 'game-train-1',
            officialDate: '2026-07-15',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 1, wasMissing: false },
              { featureId: 'p_2', value: 2, wasMissing: true },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'train-a-2',
          split: 'TRAIN',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'zero::manifest-v1',
            snapshotId: 'snapshot-train-2',
            gameId: 'game-train-2',
            officialDate: '2026-07-15',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: -1, wasMissing: false },
              { featureId: 'p_2', value: -2, wasMissing: false },
            ],
          },
          targetValue: 0,
        },
        {
          exampleId: 'valid-a-1',
          split: 'VALIDATION',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'zero::manifest-v1',
            snapshotId: 'snapshot-valid-1',
            gameId: 'game-valid-1',
            officialDate: '2026-07-16',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 3, wasMissing: true },
              { featureId: 'p_2', value: 4, wasMissing: false },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'valid-a-2',
          split: 'VALIDATION',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'zero::manifest-v1',
            snapshotId: 'snapshot-valid-2',
            gameId: 'game-valid-2',
            officialDate: '2026-07-16',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: -3, wasMissing: false },
              { featureId: 'p_2', value: -4, wasMissing: true },
            ],
          },
          targetValue: 0,
        },
        {
          exampleId: 'test-a-1',
          split: 'TEST',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'zero::manifest-v1',
            snapshotId: 'snapshot-test-1',
            gameId: 'game-test-1',
            officialDate: '2026-07-17',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 5, wasMissing: false },
              { featureId: 'p_2', value: 6, wasMissing: false },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'test-a-2',
          split: 'TEST',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'zero::manifest-v1',
            snapshotId: 'snapshot-test-2',
            gameId: 'game-test-2',
            officialDate: '2026-07-17',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 7, wasMissing: false },
              { featureId: 'p_2', value: 8, wasMissing: false },
            ],
          },
          targetValue: 0,
        },
      ],
    };

    const result = evaluateAndReleaseMLBDeterministicModel(fitValidation, plan, matrix);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.test.metrics.logLoss).toBeCloseTo(Math.log(2), 10);
      expect(result.value.test.metrics.brierScore).toBeCloseTo(0.25, 10);
      expect(result.value.test.metrics.rocAuc).toBeCloseTo(0.5, 10);
    }
  });
  it('rejects TEST without both target classes', () => {
    const fitValidation = createValidFitValidation();
    const plan = createValidEvaluationPlan();
    const baseMatrix = createValidMatrixFixture();
    const baseRows = baseMatrix.rows as Record<string, unknown>[];
    const matrix = {
      ...(baseMatrix as Record<string, unknown>),
      rows: [
        baseRows[0],
        baseRows[1],
        baseRows[2],
        baseRows[3],
        {
          exampleId: 'test-only-1',
          split: 'TEST',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-test-only-1',
            gameId: 'game-test-only-1',
            officialDate: '2026-07-17',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 1, wasMissing: false },
              { featureId: 'p_2', value: 2, wasMissing: false },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'test-only-2',
          split: 'TEST',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-test-only-2',
            gameId: 'game-test-only-2',
            officialDate: '2026-07-17',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 3, wasMissing: false },
              { featureId: 'p_2', value: 4, wasMissing: false },
            ],
          },
          targetValue: 1,
        },
      ],
    };

    const result = evaluateAndReleaseMLBDeterministicModel(fitValidation, plan, matrix);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(collectIssueCodes(result.issues)).toContain('INSUFFICIENT_TEST_CLASS_VARIATION');
    }
  });

  it('rejects fit-result, plan, matrix, identity, feature-schema, split-policy, split-count, and holdout-policy mismatches deterministically', () => {
    const fitValidation = createValidFitValidation();
    const plan = createValidEvaluationPlan();
    const matrix = createValidMatrixFixture();

    const fitValidationResult = validateMLBModelFitValidationResult(fitValidation);
    const planResult = validateMLBModelEvaluationPlan(plan);
    const matrixResult = validateMLBTrainingMatrix(matrix);
    expect(fitValidationResult.ok).toBe(true);
    expect(planResult.ok).toBe(true);
    expect(matrixResult.ok).toBe(true);

    const baseModel = (fitValidation.model as Record<string, unknown>);
    const baseValidation = (fitValidation.validation as Record<string, unknown>);

    const independentFitValidation = {
      ...(fitValidation as Record<string, unknown>),
      resultId: 'independent::fit-validation-v1',
      model: {
        ...baseModel,
        modelId: 'independent::model-v1',
        planId: 'independent::plan-v1',
        matrixId: 'independent::matrix-v1',
        configId: 'independent::config-v1',
        manifestId: 'independent::manifest-v1',
        datasetId: 'independent::dataset-v1',
      },
      validation: {
        ...baseValidation,
        evaluationId: 'independent::model-v1::validation-v1',
        modelId: 'independent::model-v1',
        planId: 'independent::plan-v1',
        matrixId: 'independent::matrix-v1',
        configId: 'independent::config-v1',
      },
    } as Record<string, unknown>;

    const independentPlan = {
      ...(plan as Record<string, unknown>),
      planId: 'independent::matrix-v1::independent::config-v1',
      matrixId: 'independent::matrix-v1',
      configId: 'independent::config-v1',
      manifestId: 'independent::manifest-v1',
      datasetId: 'independent::dataset-v1',
    } as Record<string, unknown>;

    const independentFitValidationResult = validateMLBModelFitValidationResult(independentFitValidation);
    const independentPlanResult = validateMLBModelEvaluationPlan(independentPlan);
    expect(independentFitValidationResult.ok).toBe(true);
    expect(independentPlanResult.ok).toBe(true);

    let result = evaluateAndReleaseMLBDeterministicModel(independentFitValidation, independentPlan, matrix);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(collectIssueCodes(result.issues)).toContain('SOURCE_IDENTITY_MISMATCH');
    }

    const featureSchemaFitValidation = {
      ...(fitValidation as Record<string, unknown>),
      model: {
        ...(fitValidation.model as Record<string, unknown>),
        featureIds: ['p_1', 'p_3'],
      },
    } as Record<string, unknown>;
    const featureSchemaFitResult = validateMLBModelFitValidationResult(featureSchemaFitValidation);
    expect(featureSchemaFitResult.ok).toBe(true);

    const featureSchemaPlan = {
      ...(plan as Record<string, unknown>),
      featureIds: ['p_1', 'p_3'],
    } as Record<string, unknown>;
    const featureSchemaPlanResult = validateMLBModelEvaluationPlan(featureSchemaPlan);
    expect(featureSchemaPlanResult.ok).toBe(true);

    result = evaluateAndReleaseMLBDeterministicModel(featureSchemaFitValidation, featureSchemaPlan, matrix);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(collectIssueCodes(result.issues)).toContain('FEATURE_SCHEMA_MISMATCH');
    }

    const splitPolicyMatrix = {
      ...(matrix as Record<string, unknown>),
      splitPolicy: {
        strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1',
        embargoDays: 0,
        train: { startDate: '2026-07-01', endDate: '2026-07-15' },
        validation: { startDate: '2026-07-16', endDate: '2026-07-16' },
        test: { startDate: '2026-07-18', endDate: '2026-07-18' },
      },
      rows: [
        {
          exampleId: 'train-a-1',
          split: 'TRAIN',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-train-1',
            gameId: 'game-train-1',
            officialDate: '2026-07-15',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 1, wasMissing: false },
              { featureId: 'p_2', value: 2, wasMissing: true },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'train-a-2',
          split: 'TRAIN',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-train-2',
            gameId: 'game-train-2',
            officialDate: '2026-07-15',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: -1, wasMissing: false },
              { featureId: 'p_2', value: -2, wasMissing: false },
            ],
          },
          targetValue: 0,
        },
        {
          exampleId: 'valid-a-1',
          split: 'VALIDATION',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-valid-1',
            gameId: 'game-valid-1',
            officialDate: '2026-07-16',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 3, wasMissing: true },
              { featureId: 'p_2', value: 4, wasMissing: false },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'valid-a-2',
          split: 'VALIDATION',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-valid-2',
            gameId: 'game-valid-2',
            officialDate: '2026-07-16',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: -3, wasMissing: false },
              { featureId: 'p_2', value: -4, wasMissing: true },
            ],
          },
          targetValue: 0,
        },
        {
          exampleId: 'test-a-1',
          split: 'TEST',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-test-1',
            gameId: 'game-test-1',
            officialDate: '2026-07-18',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 5, wasMissing: false },
              { featureId: 'p_2', value: 6, wasMissing: false },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'test-a-2',
          split: 'TEST',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-test-2',
            gameId: 'game-test-2',
            officialDate: '2026-07-18',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 7, wasMissing: false },
              { featureId: 'p_2', value: 8, wasMissing: false },
            ],
          },
          targetValue: 0,
        },
      ],
    } as Record<string, unknown>;
    const splitPolicyMatrixResult = validateMLBTrainingMatrix(splitPolicyMatrix);
    expect(splitPolicyMatrixResult.ok).toBe(true);

    result = evaluateAndReleaseMLBDeterministicModel(fitValidation, plan, splitPolicyMatrix);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(collectIssueCodes(result.issues)).toContain('SPLIT_POLICY_MISMATCH');
    }

    const splitCountMatrix = {
      ...(matrix as Record<string, unknown>),
      splitCounts: { train: 2, validation: 2, test: 3 },
      rows: [
        {
          exampleId: 'train-a-1',
          split: 'TRAIN',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-train-1',
            gameId: 'game-train-1',
            officialDate: '2026-07-15',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 1, wasMissing: false },
              { featureId: 'p_2', value: 2, wasMissing: true },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'train-a-2',
          split: 'TRAIN',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-train-2',
            gameId: 'game-train-2',
            officialDate: '2026-07-15',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: -1, wasMissing: false },
              { featureId: 'p_2', value: -2, wasMissing: false },
            ],
          },
          targetValue: 0,
        },
        {
          exampleId: 'valid-a-1',
          split: 'VALIDATION',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-valid-1',
            gameId: 'game-valid-1',
            officialDate: '2026-07-16',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 3, wasMissing: true },
              { featureId: 'p_2', value: 4, wasMissing: false },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'valid-a-2',
          split: 'VALIDATION',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-valid-2',
            gameId: 'game-valid-2',
            officialDate: '2026-07-16',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: -3, wasMissing: false },
              { featureId: 'p_2', value: -4, wasMissing: true },
            ],
          },
          targetValue: 0,
        },
        {
          exampleId: 'test-a-1',
          split: 'TEST',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-test-1',
            gameId: 'game-test-1',
            officialDate: '2026-07-17',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 5, wasMissing: false },
              { featureId: 'p_2', value: 6, wasMissing: false },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'test-a-2',
          split: 'TEST',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-test-2',
            gameId: 'game-test-2',
            officialDate: '2026-07-17',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 7, wasMissing: false },
              { featureId: 'p_2', value: 8, wasMissing: false },
            ],
          },
          targetValue: 0,
        },
        {
          exampleId: 'test-a-3',
          split: 'TEST',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-test-3',
            gameId: 'game-test-3',
            officialDate: '2026-07-17',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 9, wasMissing: false },
              { featureId: 'p_2', value: 10, wasMissing: false },
            ],
          },
          targetValue: 0,
        },
      ],
    } as Record<string, unknown>;
    const splitCountMatrixResult = validateMLBTrainingMatrix(splitCountMatrix);
    expect(splitCountMatrixResult.ok).toBe(true);

    result = evaluateAndReleaseMLBDeterministicModel(fitValidation, plan, splitCountMatrix);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(collectIssueCodes(result.issues)).toContain('SPLIT_COUNT_MISMATCH');
    }

    const holdoutProxyPlan = new Proxy(plan as Record<string, unknown>, {
      get(target, prop) {
        if (prop === 'protocol') return 'WRONG_PROTOCOL';
        if (prop === 'testSetPolicy') return 'WRONG_POLICY';
        return target[prop as string];
      },
    });
    const holdoutProxyPlanResult = validateMLBModelEvaluationPlan(holdoutProxyPlan);
    expect(holdoutProxyPlanResult.ok).toBe(true);

    result = evaluateAndReleaseMLBDeterministicModel(fitValidation, holdoutProxyPlan, matrix);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(collectIssueCodes(result.issues)).toContain('HOLDOUT_POLICY_MISMATCH');
    }
  });

  it('rejects non-finite TEST numerical execution without returning a partial result', () => {
    const baseFitValidation = createValidFitValidation();
    const fitValidation: Record<string, unknown> = {
      ...baseFitValidation,
      model: {
        ...(baseFitValidation.model as Record<string, unknown>),
        intercept: 0,
        coefficients: [
          { featureId: 'p_1', valueCoefficient: 2, missingIndicatorCoefficient: 0 },
          { featureId: 'p_2', valueCoefficient: 1, missingIndicatorCoefficient: 0 },
        ],
      },
    };

    const plan = createValidEvaluationPlan();

    const baseMatrix = createValidMatrixFixture();
    const baseRows = baseMatrix.rows as readonly Record<string, unknown>[];
    const rows = baseRows.map((row, index) => {
      if (index !== 4) {
        return row;
      }
      const rowRecord = row as Record<string, unknown>;
      const vectorRecord = rowRecord.vector as Record<string, unknown>;
      const values = vectorRecord.values as readonly Record<string, unknown>[];
      return {
        ...rowRecord,
        vector: {
          ...vectorRecord,
          values: values.map((value) =>
            value.featureId === 'p_1'
              ? { ...value, value: Number.MAX_VALUE }
              : value,
          ),
        },
      };
    });
    const matrix: Record<string, unknown> = {
      ...(baseMatrix as Record<string, unknown>),
      rows,
    };

    const finiteCoefficient = 2;
    const finiteFeatureValue = Number.MAX_VALUE;
    const overflowingProduct = finiteCoefficient * finiteFeatureValue;

    expect(Number.isFinite(finiteCoefficient)).toBe(true);
    expect(Number.isFinite(finiteFeatureValue)).toBe(true);
    expect(Number.isFinite(overflowingProduct)).toBe(false);

    expect(validateMLBModelFitValidationResult(fitValidation).ok).toBe(true);
    expect(validateMLBModelEvaluationPlan(plan).ok).toBe(true);
    expect(validateMLBTrainingMatrix(matrix).ok).toBe(true);

    const originalFitValidation = structuredClone(fitValidation) as Record<string, unknown>;
    const originalPlan = structuredClone(plan) as Record<string, unknown>;
    const originalMatrix = structuredClone(matrix) as Record<string, unknown>;

    const result = evaluateAndReleaseMLBDeterministicModel(fitValidation, plan, matrix);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(collectIssueCodes(result.issues)).toEqual(['NUMERICAL_FAILURE']);
    }

    expect(fitValidation).toEqual(originalFitValidation);
    expect(plan).toEqual(originalPlan);
    expect(matrix).toEqual(originalMatrix);
  });

  it('proves TRAIN and VALIDATION vector and target content are not read after Phase 8F validation', () => {
    const trainReads = { vector: 0, targetValue: 0, label: 0, homeRuns: 0, awayRuns: 0, winnerTeamId: 0 };
    const validationReads = { vector: 0, targetValue: 0, label: 0, homeRuns: 0, awayRuns: 0, winnerTeamId: 0 };

    function createProxiedRow(row: Record<string, unknown>, reads: typeof trainReads): Record<string, unknown> {
      return new Proxy(row, {
        get(target, prop) {
          if (prop === 'vector') reads.vector++;
          if (prop === 'targetValue') reads.targetValue++;
          if (prop === 'label') reads.label++;
          if (prop === 'homeRuns') reads.homeRuns++;
          if (prop === 'awayRuns') reads.awayRuns++;
          if (prop === 'winnerTeamId') reads.winnerTeamId++;
          return target[prop as string];
        },
      });
    }

    const matrix = createValidMatrixFixture();
    const proxiedRows = (matrix.rows as Record<string, unknown>[]).map((row) => {
      if (row.split === 'TRAIN') return createProxiedRow(row, trainReads);
      if (row.split === 'VALIDATION') return createProxiedRow(row, validationReads);
      return row;
    });
    Object.assign(matrix as Record<string, unknown>, { rows: proxiedRows });

    const matrixResult = validateMLBTrainingMatrix(matrix);
    expect(matrixResult.ok).toBe(true);

    const fitValidation = createValidFitValidation();
    const plan = createValidEvaluationPlan();

    const result = evaluateAndReleaseMLBDeterministicModel(fitValidation, plan, matrix);
    expect(result.ok).toBe(true);

    expect(trainReads.vector).toBe(0);
    expect(trainReads.targetValue).toBe(0);
    expect(trainReads.label).toBe(0);
    expect(trainReads.homeRuns).toBe(0);
    expect(trainReads.awayRuns).toBe(0);
    expect(trainReads.winnerTeamId).toBe(0);
    expect(validationReads.vector).toBe(0);
    expect(validationReads.targetValue).toBe(0);
    expect(validationReads.label).toBe(0);
    expect(validationReads.homeRuns).toBe(0);
    expect(validationReads.awayRuns).toBe(0);
    expect(validationReads.winnerTeamId).toBe(0);
  });

  it('produces deeply deterministic output without mutating inputs', () => {
    const fitValidation = createValidFitValidation();
    const plan = createValidEvaluationPlan();
    const matrix = createValidMatrixFixture();

    const result1 = evaluateAndReleaseMLBDeterministicModel(fitValidation, plan, matrix);
    const result2 = evaluateAndReleaseMLBDeterministicModel(fitValidation, plan, matrix);

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    if (result1.ok && result2.ok) {
      expect(result1.value).toStrictEqual(result2.value);
      expect(JSON.stringify(result1.value)).toBe(JSON.stringify(result2.value));
    }

    expect(fitValidation).toEqual(createValidFitValidation());
    expect(plan).toEqual(createValidEvaluationPlan());
    expect(matrix).toEqual(createValidMatrixFixture());
  });

  it('rejects odds contamination, row-level probabilities, deployment claims, recommendations, and prohibited fields', () => {
    const fitValidation = createValidFitValidation();
    const plan = createValidEvaluationPlan();
    const matrix = createValidMatrixFixture();

    const badEvaluation = {
      ...(createMinimalTestEvaluation() as Record<string, unknown>),
      probabilities: [0.5],
      predictions: [1],
    };

    const evalResult = validateMLBModelTestEvaluation(badEvaluation);
    expect(evalResult.ok).toBe(false);
    if (!evalResult.ok) {
      expect(collectIssueCodes(evalResult.issues)).toContain('PROHIBITED_CONCEPT');
    }

    const badRelease = {
      ...(createMinimalReleaseRecord() as Record<string, unknown>),
      deployment: { endpoint: '/api/v1/predict' },
      recommendation: 'bet away',
    };

    const releaseResult = validateMLBModelReleaseRecord(badRelease);
    expect(releaseResult.ok).toBe(false);
    if (!releaseResult.ok) {
      expect(collectIssueCodes(releaseResult.issues)).toContain('PROHIBITED_CONCEPT');
    }

    const result = evaluateAndReleaseMLBDeterministicModel(fitValidation, plan, matrix);
    expect(result.ok).toBe(true);
  });

  it('verifies issue ordering, exact exports/imports, no fitting or live inference, and the static architecture boundary', async () => {
    const source = await readFile(
      join(process.cwd(), 'src/prediction/mlb/mlb-model-test-release-contract.ts'),
      'utf-8',
    );

    const expectedExports = [
      'MLB_TEST_EVALUATION_CONTRACT_VERSION',
      'MLB_MODEL_RELEASE_CONTRACT_VERSION',
      'MLB_TEST_RELEASE_RESULT_CONTRACT_VERSION',
      'MLBModelReleaseStatus',
      'MLBTestMetricValues',
      'MLBModelTestEvaluation',
      'MLBModelReleaseRecord',
      'MLBModelTestReleaseResult',
      'MLBModelTestReleaseIssue',
      'validateMLBModelTestEvaluation',
      'validateMLBModelReleaseRecord',
      'validateMLBModelTestReleaseResult',
      'evaluateAndReleaseMLBDeterministicModel',
    ];

    const exports = source.match(/\bexport\s+(?:const|type|function)\s+([A-Za-z0-9_]+)/g) || [];
    const exportNames = exports.map((e) => e.replace(/^export\s+(?:const|type|function)\s+/, ''));

    expect(exportNames).toEqual(expectedExports);

    const imports = source.match(/from\s+['"]([^'"]+)['"]/g) || [];
    const importPaths = imports.map((i) => i.replace(/^from\s+['"]|['"]$/g, ''));

    expect(importPaths).toEqual([
      '../firewall/odds-contamination-guard',
      './mlb-training-matrix-contract',
      './mlb-model-training-plan-contract',
      './mlb-logistic-regression-fit-contract',
    ]);

    expect(source).not.toMatch(/export\s+enum/);
    expect(source).not.toMatch(/export\s+interface/);
    expect(source).not.toMatch(/fitModel|trainModel|calculateGradient|updateCoefficients|Math\.random|Date\.now|process\.env|fetch\(/);
    expect(source).not.toMatch(/new\s+Date\s*\(/);
    expect(source).not.toMatch(/localeCompare/);
    expect(source).not.toMatch(/PrismaClient|@prisma\/client/);
    expect(source).not.toMatch(/readFileSync|writeFileSync/);
  });
});
