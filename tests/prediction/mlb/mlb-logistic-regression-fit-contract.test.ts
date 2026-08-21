import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import {
  fitAndEvaluateMLBDeterministicLogisticRegression,
  fitMLBDeterministicLogisticRegressionModel,
  MLB_FIT_VALIDATION_RESULT_CONTRACT_VERSION,
  MLB_LOGISTIC_REGRESSION_MODEL_CONTRACT_VERSION,
  MLB_VALIDATION_EVALUATION_CONTRACT_VERSION,
  predictMLBHomeWinProbability,
  type MLBModelFitEvaluationIssue,
  validateMLBDeterministicLogisticRegressionModel,
  validateMLBModelFitValidationResult,
  validateMLBModelValidationEvaluation,
} from '@/prediction/mlb/mlb-logistic-regression-fit-contract';
import { validateMLBTrainingMatrix, type MLBTrainingMatrixRow } from '@/prediction/mlb/mlb-training-matrix-contract';
import { type MLBFeatureVector } from '@/prediction/mlb/mlb-feature-vector-contract';
import {
  validateMLBModelEvaluationPlan,
  validateMLBModelTrainingConfiguration,
  type MLBModelTrainingConfiguration,
} from '@/prediction/mlb/mlb-model-training-plan-contract';

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
        targetValue: 1,
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

function collectIssueCodes(issues: readonly MLBModelFitEvaluationIssue[]): string[] {
  return issues.map((issue) => issue.code);
}

function assertValidMatrix(matrix: Record<string, unknown>): void {
  const result = validateMLBTrainingMatrix(matrix);
  expect(result.ok).toBe(true);
}

function assertValidConfiguration(configuration: Record<string, unknown>): void {
  const result = validateMLBModelTrainingConfiguration(configuration);
  expect(result.ok).toBe(true);
}

function assertValidPlan(plan: Record<string, unknown>): void {
  const result = validateMLBModelEvaluationPlan(plan);
  expect(result.ok).toBe(true);
}

describe('Phase 8H MLB logistic regression fit contract', () => {
  it('accepts a minimal valid deterministic model and returns the exact original reference', () => {
    const model = createMinimalModel();
    const result = validateMLBDeterministicLogisticRegressionModel(model);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(model);
    }
  });

  it('validates exact model fields, source identities, algorithm, and deterministic model ID', () => {
    const model = createMinimalModel();
    const result = validateMLBDeterministicLogisticRegressionModel(model);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contractVersion).toBe(MLB_LOGISTIC_REGRESSION_MODEL_CONTRACT_VERSION);
      expect(result.value.sport).toBe('MLB');
      expect(result.value.target).toBe('OFFICIAL_FINAL_GAME_WINNER');
      expect(result.value.targetEncoding).toBe('HOME_WIN_1_AWAY_WIN_0');
      expect(result.value.modelId).toBe('plan-1::model-v1');
      expect(result.value.algorithm).toBe('L2_LOGISTIC_REGRESSION_BINARY_V1');
    }
  });

  it('validates feature IDs, coefficient count, exact alignment, canonical order, and finite coefficients', () => {
    const model = createMinimalModel();
    const result = validateMLBDeterministicLogisticRegressionModel(model);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.featureIds).toEqual(['p_1', 'p_2']);
      expect(result.value.coefficients).toHaveLength(2);
      expect(result.value.coefficients[0].featureId).toBe('p_1');
      expect(result.value.coefficients[1].featureId).toBe('p_2');
      expect(result.value.coefficients[0].valueCoefficient).toBeCloseTo(0.1);
      expect(result.value.coefficients[0].missingIndicatorCoefficient).toBeCloseTo(-0.1);
    }

    const badModel = { ...createMinimalModel(), coefficients: [{ featureId: 'p_2', valueCoefficient: 0, missingIndicatorCoefficient: 0 }] } as Record<string, unknown>;
    const badResult = validateMLBDeterministicLogisticRegressionModel(badModel);
    expect(badResult.ok).toBe(false);
    if (!badResult.ok) {
      expect(collectIssueCodes(badResult.issues)).toContain('INVALID_ARRAY');
    }
  });

  it('accepts a minimal valid validation evaluation and returns the exact original reference', () => {
    const evaluation = createMinimalEvaluation();
    const result = validateMLBModelValidationEvaluation(evaluation);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(evaluation);
    }
  });

  it('validates validation IDs, split, row count, and metric bounds', () => {
    const evaluation = createMinimalEvaluation();
    const result = validateMLBModelValidationEvaluation(evaluation);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.evaluationId).toBe('plan-1::model-v1::validation-v1');
      expect(result.value.modelId).toBe('plan-1::model-v1');
      expect(result.value.split).toBe('VALIDATION');
      expect(result.value.rowCount).toBe(2);
      expect(result.value.metrics.logLoss).toBeCloseTo(0.693147);
      expect(result.value.metrics.brierScore).toBeCloseTo(0.25);
      expect(result.value.metrics.rocAuc).toBeCloseTo(0.5);
    }

    const badEvaluation = { ...createMinimalEvaluation(), metrics: { logLoss: -1, brierScore: 0.5, rocAuc: 0.5 } } as Record<string, unknown>;
    const badResult = validateMLBModelValidationEvaluation(badEvaluation);
    expect(badResult.ok).toBe(false);
    if (!badResult.ok) {
      expect(collectIssueCodes(badResult.issues)).toContain('INVALID_NUMBER');
    }
  });

  it('accepts a minimal valid combined fit-validation result and returns the exact original reference', () => {
    const proposed = createMinimalResult();
    const result = validateMLBModelFitValidationResult(proposed);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(proposed);
    }
  });

  it('validates nested result consistency and deterministic result ID', () => {
    const result = validateMLBModelFitValidationResult(createMinimalResult());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.resultId).toBe('plan-1::fit-validation-v1');
      expect(result.value.model.modelId).toBe(result.value.validation.modelId);
    }
  });

  it('validates descriptor-safe model, evaluation, result, arrays, symbols, classes, and accessors without invoking getters', () => {
    const symbol = Symbol('symbol');
    const model = {
      ...createMinimalModel(),
      unknown: true,
      [symbol]: 'value',
      get forbidden() { return {}; },
    } as unknown;

    const result = validateMLBDeterministicLogisticRegressionModel(model);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const codes = collectIssueCodes(result.issues);
      expect(codes).toContain('UNKNOWN_FIELD');
      expect(codes).toContain('INVALID_JSON_VALUE');
    }

    const evaluation = {
      ...createMinimalEvaluation(),
      [symbol]: 'value',
    } as unknown;
    const evaluationResult = validateMLBModelValidationEvaluation(evaluation);
    expect(evaluationResult.ok).toBe(false);
    if (!evaluationResult.ok) {
      expect(collectIssueCodes(evaluationResult.issues)).toContain('UNKNOWN_FIELD');
    }

    const resultObj = {
      ...createMinimalResult(),
      get accessor() { return true; },
    } as unknown;
    const resultValidation = validateMLBModelFitValidationResult(resultObj);
    expect(resultValidation.ok).toBe(false);
    if (!resultValidation.ok) {
      expect(collectIssueCodes(resultValidation.issues)).toContain('INVALID_JSON_VALUE');
    }
  });

  it('fits a deterministic model from valid Phase 8G and Phase 8F inputs', () => {
    const configuration = createValidConfiguration();
    const plan = createValidEvaluationPlan();
    const matrix = createValidMatrixFixture();

    assertValidConfiguration(configuration);
    assertValidPlan(plan);
    assertValidMatrix(matrix);

    const fitResult = fitAndEvaluateMLBDeterministicLogisticRegression(configuration, plan, matrix);
    expect(fitResult.ok).toBe(true);
    if (fitResult.ok) {
      const { model, validation } = fitResult.value;
      expect(model.contractVersion).toBe(MLB_LOGISTIC_REGRESSION_MODEL_CONTRACT_VERSION);
      expect(model.planId).toBe(plan.planId);
      expect(model.matrixId).toBe(matrix.matrixId);
      expect(model.configId).toBe(configuration.configId);
      expect(model.trainingRowCount).toBe(2);
      expect(typeof model.converged).toBe('boolean');
      expect(model.algorithm).toBe('L2_LOGISTIC_REGRESSION_BINARY_V1');
      expect(model.featureIds).toEqual(['p_1', 'p_2']);
      expect(model.coefficients).toHaveLength(2);
      expect(typeof model.intercept).toBe('number');
      expect(typeof model.finalTrainingObjective).toBe('number');

      expect(validation.contractVersion).toBe(MLB_VALIDATION_EVALUATION_CONTRACT_VERSION);
      expect(validation.split).toBe('VALIDATION');
      expect(validation.rowCount).toBe(2);
      expect(typeof validation.metrics.logLoss).toBe('number');
      expect(typeof validation.metrics.brierScore).toBe('number');
      expect(typeof validation.metrics.rocAuc).toBe('number');
      expect(validation.metrics.rocAuc).toBeGreaterThanOrEqual(0);
      expect(validation.metrics.rocAuc).toBeLessThanOrEqual(1);
    }
  });

  it('proves zero initialization and exact one-iteration full-batch update behavior', () => {
    const configuration = {
      ...createValidConfiguration(),
      optimization: {
        solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
        learningRate: 0.1,
        maxIterations: 1,
        tolerance: 1e-12,
      },
    } as Record<string, unknown>;

    const matrix = {
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
      splitCounts: { train: 2, validation: 2, test: 1 },
      rows: [
        {
          exampleId: 'train-positive',
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
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'train-negative',
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
            ],
          },
          targetValue: 0,
        },
        {
          exampleId: 'valid-1',
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
              { featureId: 'p_1', value: 0, wasMissing: false },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'valid-2',
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
              { featureId: 'p_1', value: 0, wasMissing: false },
            ],
          },
          targetValue: 0,
        },
        {
          exampleId: 'test-1',
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
              { featureId: 'p_1', value: 0, wasMissing: false },
            ],
          },
          targetValue: 1,
        },
      ],
    };

    const plan = {
      ...createValidEvaluationPlan(),
      featureIds: ['p_1'],
      splitCounts: { train: 2, validation: 2, test: 1 },
      totalRows: 5,
    } as Record<string, unknown>;

    assertValidConfiguration(configuration);
    assertValidPlan(plan);
    assertValidMatrix(matrix);

    const fitResult = fitAndEvaluateMLBDeterministicLogisticRegression(configuration, plan, matrix);
    expect(fitResult.ok).toBe(true);
    if (fitResult.ok) {
      expect(fitResult.value.model.intercept).toBeCloseTo(0, 10);
      expect(fitResult.value.model.coefficients[0].valueCoefficient).toBeCloseTo(0.05, 10);
      expect(fitResult.value.model.coefficients[0].missingIndicatorCoefficient).toBeCloseTo(0, 10);
      expect(fitResult.value.model.iterationsCompleted).toBe(1);
    }
  });

  it('proves raw values and missing indicators use separate coefficients', () => {
    const configuration = {
      ...createValidConfiguration(),
      regularization: { kind: 'L2', strength: 0.01 },
    } as Record<string, unknown>;
    const matrix = {
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
      splitCounts: { train: 4, validation: 2, test: 2 },
      rows: [
        {
          exampleId: 'train-1',
          split: 'TRAIN',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-1',
            gameId: 'game-1',
            officialDate: '2026-07-15',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'feature_a', value: 1, wasMissing: false },
              { featureId: 'feature_b', value: 0, wasMissing: true },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'train-2',
          split: 'TRAIN',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-2',
            gameId: 'game-2',
            officialDate: '2026-07-15',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'feature_a', value: 0, wasMissing: true },
              { featureId: 'feature_b', value: 1, wasMissing: false },
            ],
          },
          targetValue: 0,
        },
        {
          exampleId: 'train-3',
          split: 'TRAIN',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-3',
            gameId: 'game-3',
            officialDate: '2026-07-15',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'feature_a', value: 1, wasMissing: false },
              { featureId: 'feature_b', value: 0, wasMissing: true },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'train-4',
          split: 'TRAIN',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-4',
            gameId: 'game-4',
            officialDate: '2026-07-15',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'feature_a', value: 0, wasMissing: true },
              { featureId: 'feature_b', value: 1, wasMissing: false },
            ],
          },
          targetValue: 0,
        },
        {
          exampleId: 'valid-1',
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
              { featureId: 'feature_a', value: 1, wasMissing: false },
              { featureId: 'feature_b', value: 0, wasMissing: true },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'valid-2',
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
              { featureId: 'feature_a', value: 0, wasMissing: true },
              { featureId: 'feature_b', value: 1, wasMissing: false },
            ],
          },
          targetValue: 0,
        },
        {
          exampleId: 'test-1',
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
              { featureId: 'feature_a', value: 1, wasMissing: false },
              { featureId: 'feature_b', value: 0, wasMissing: true },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'test-2',
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
              { featureId: 'feature_a', value: 0, wasMissing: true },
              { featureId: 'feature_b', value: 1, wasMissing: false },
            ],
          },
          targetValue: 0,
        },
      ],
    };

    const plan = {
      ...createValidEvaluationPlan(),
      featureIds: ['feature_a', 'feature_b'],
      splitCounts: { train: 4, validation: 2, test: 2 },
      totalRows: 8,
    } as Record<string, unknown>;

    assertValidConfiguration(configuration);
    assertValidPlan(plan);
    assertValidMatrix(matrix);

    const fitResult = fitAndEvaluateMLBDeterministicLogisticRegression(configuration, plan, matrix);
    expect(fitResult.ok).toBe(true);
    if (fitResult.ok) {
      const valueA = fitResult.value.model.coefficients.find((c) => c.featureId === 'feature_a')!.valueCoefficient;
      const missingA = fitResult.value.model.coefficients.find((c) => c.featureId === 'feature_a')!.missingIndicatorCoefficient;
      const valueB = fitResult.value.model.coefficients.find((c) => c.featureId === 'feature_b')!.valueCoefficient;
      const missingB = fitResult.value.model.coefficients.find((c) => c.featureId === 'feature_b')!.missingIndicatorCoefficient;
      expect(valueA).not.toBeCloseTo(missingA);
      expect(valueB).not.toBeCloseTo(missingB);
    }
  });

  it('proves VALIDATION values and targets do not influence fitted model parameters', () => {
    const configuration = createValidConfiguration();
    const plan = createValidEvaluationPlan();
    const baseMatrix = createValidMatrixFixture() as Record<string, unknown>;

    assertValidConfiguration(configuration);
    assertValidPlan(plan);
    assertValidMatrix(baseMatrix);

    const baseResult = fitAndEvaluateMLBDeterministicLogisticRegression(configuration, plan, baseMatrix);
    expect(baseResult.ok).toBe(true);
    if (!baseResult.ok) return;
    const baseIntercept = baseResult.value.model.intercept;
    const baseCoefficients = baseResult.value.model.coefficients.map((c) => c.valueCoefficient);

    const baseMatrixRows = baseMatrix.rows as Record<string, unknown>[];
    const modifiedMatrix = {
      ...baseMatrix,
      rows: baseMatrixRows.map((row: Record<string, unknown>, index: number) => {
        if (row.split === 'VALIDATION') {
          return {
            ...row,
            vector: {
              ...(row.vector as Record<string, unknown>),
              values: ((row.vector as Record<string, unknown>).values as Record<string, unknown>[]).map((v: Record<string, unknown>) => ({ ...v, value: v.value as number * 100 })),
            },
            targetValue: row.targetValue === 1 ? 0 : 1,
          };
        }
        return row;
      }),
    } as Record<string, unknown>;

    assertValidMatrix(modifiedMatrix);
    const modifiedResult = fitAndEvaluateMLBDeterministicLogisticRegression(configuration, plan, modifiedMatrix);
    expect(modifiedResult.ok).toBe(true);
    if (modifiedResult.ok && baseResult.ok) {
      expect(modifiedResult.value.model.intercept).toBeCloseTo(baseIntercept);
      for (let i = 0; i < baseCoefficients.length; i++) {
        expect(modifiedResult.value.model.coefficients[i].valueCoefficient).toBeCloseTo(baseCoefficients[i]);
      }
    }
  });

  it('calculates known aggregate validation LOG_LOSS, BRIER_SCORE, and ROC_AUC values', () => {
    const configuration = {
      ...createValidConfiguration(),
      regularization: { kind: 'L2', strength: 0.0001 },
    } as Record<string, unknown>;

    const matrix = {
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
      splitCounts: { train: 2, validation: 2, test: 1 },
      rows: [
        {
          exampleId: 'train-1',
          split: 'TRAIN',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-1',
            gameId: 'game-1',
            officialDate: '2026-07-15',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 0, wasMissing: false },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'train-2',
          split: 'TRAIN',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-2',
            gameId: 'game-2',
            officialDate: '2026-07-15',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [
              { featureId: 'p_1', value: 0, wasMissing: false },
            ],
          },
          targetValue: 0,
        },
        {
          exampleId: 'valid-1',
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
              { featureId: 'p_1', value: 0, wasMissing: false },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'valid-2',
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
              { featureId: 'p_1', value: 0, wasMissing: false },
            ],
          },
          targetValue: 0,
        },
        {
          exampleId: 'test-1',
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
              { featureId: 'p_1', value: 0, wasMissing: false },
            ],
          },
          targetValue: 1,
        },
      ],
    };

    const plan = {
      ...createValidEvaluationPlan(),
      featureIds: ['p_1'],
      splitCounts: { train: 2, validation: 2, test: 1 },
      totalRows: 5,
    } as Record<string, unknown>;

    assertValidConfiguration(configuration);
    assertValidPlan(plan);
    assertValidMatrix(matrix);

    const fitResult = fitAndEvaluateMLBDeterministicLogisticRegression(configuration, plan, matrix);
    expect(fitResult.ok).toBe(true);
    if (fitResult.ok) {
      expect(fitResult.value.validation.metrics.logLoss).toBeCloseTo(Math.log(2), 10);
      expect(fitResult.value.validation.metrics.brierScore).toBeCloseTo(0.25, 10);
      expect(fitResult.value.validation.metrics.rocAuc).toBeCloseTo(0.5, 10);
    }
  });

  it('rejects TRAIN or VALIDATION without both target classes', () => {
    const configuration = createValidConfiguration();
    const plan = createValidEvaluationPlan();

    const matrixFixture = createValidMatrixFixture() as Record<string, unknown>;
    const matrixFixtureRows = matrixFixture.rows as Record<string, unknown>[];
    const noPositiveMatrix = {
      ...matrixFixture,
      rows: matrixFixtureRows.map((row: Record<string, unknown>) => {
        if (row.split === 'TRAIN') {
          return { ...row, targetValue: 0 };
        }
        return row;
      }),
    } as Record<string, unknown>;

    assertValidConfiguration(configuration);
    assertValidPlan(plan);
    assertValidMatrix(noPositiveMatrix);

    const result = fitAndEvaluateMLBDeterministicLogisticRegression(configuration, plan, noPositiveMatrix);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(collectIssueCodes(result.issues)).toContain('INSUFFICIENT_CLASS_VARIATION');
      expect(result.issues[0].path).toBe('$.trainingMatrix.rows');
    }

    const noNegativeValidation = {
      ...matrixFixture,
      rows: matrixFixtureRows.map((row: Record<string, unknown>) => {
        if (row.split === 'VALIDATION') {
          return { ...row, targetValue: 1 };
        }
        return row;
      }),
    } as Record<string, unknown>;

    assertValidMatrix(noNegativeValidation);
    const validationResult = fitAndEvaluateMLBDeterministicLogisticRegression(configuration, plan, noNegativeValidation);
    expect(validationResult.ok).toBe(false);
    if (!validationResult.ok) {
      expect(collectIssueCodes(validationResult.issues)).toContain('INSUFFICIENT_CLASS_VARIATION');
    }
  });

  it('rejects configuration, plan, matrix, identity, schema, split-policy, and count mismatches deterministically', () => {
    // configuration/plan identity mismatch
    {
      const configuration = { ...createValidConfiguration(), configId: 'config-2' } as Record<string, unknown>;
      const plan = createValidEvaluationPlan() as Record<string, unknown>;
      const matrix = createValidMatrixFixture() as Record<string, unknown>;

      assertValidConfiguration(configuration);
      assertValidPlan(plan);
      assertValidMatrix(matrix);

      const result = fitAndEvaluateMLBDeterministicLogisticRegression(configuration, plan, matrix);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(collectIssueCodes(result.issues)).toContain('SOURCE_IDENTITY_MISMATCH');
      }
    }

    // plan/matrix identity mismatch
    {
      const configuration = createValidConfiguration();
      const plan = createValidEvaluationPlan();
      const matrix = {
        ...createValidMatrixFixture(),
        matrixId: 'dataset-2::manifest-1',
        manifestId: 'manifest-1',
        datasetId: 'dataset-2',
      } as Record<string, unknown>;

      assertValidConfiguration(configuration);
      assertValidPlan(plan);
      assertValidMatrix(matrix);

      const result = fitAndEvaluateMLBDeterministicLogisticRegression(configuration, plan, matrix);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(collectIssueCodes(result.issues)).toContain('SOURCE_IDENTITY_MISMATCH');
      }
    }

    // feature-schema mismatch
    {
      const configuration = createValidConfiguration();
      const plan = {
        ...createValidEvaluationPlan(),
        featureIds: ['p_1'],
      } as Record<string, unknown>;
      const matrix = createValidMatrixFixture() as Record<string, unknown>;

      assertValidConfiguration(configuration);
      assertValidPlan(plan);
      assertValidMatrix(matrix);

      const result = fitAndEvaluateMLBDeterministicLogisticRegression(configuration, plan, matrix);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(collectIssueCodes(result.issues)).toContain('FEATURE_SCHEMA_MISMATCH');
      }
    }

    // split-policy mismatch
    {
      const configuration = createValidConfiguration();
      const plan = {
        ...createValidEvaluationPlan(),
        splitPolicy: {
          strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1',
          embargoDays: 0,
          train: { startDate: '2026-07-01', endDate: '2026-07-14' },
          validation: { startDate: '2026-07-16', endDate: '2026-07-16' },
          test: { startDate: '2026-07-17', endDate: '2026-07-17' },
        },
      } as Record<string, unknown>;
      const matrix = createValidMatrixFixture() as Record<string, unknown>;

      assertValidConfiguration(configuration);
      assertValidPlan(plan);
      assertValidMatrix(matrix);

      const result = fitAndEvaluateMLBDeterministicLogisticRegression(configuration, plan, matrix);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(collectIssueCodes(result.issues)).toContain('SPLIT_POLICY_MISMATCH');
      }
    }

    // split-count mismatch
    {
      const configuration = createValidConfiguration();
      const plan = {
        ...createValidEvaluationPlan(),
        splitCounts: { train: 2, validation: 2, test: 1 },
        totalRows: 5,
      } as Record<string, unknown>;
      const matrix = createValidMatrixFixture() as Record<string, unknown>;

      assertValidConfiguration(configuration);
      assertValidPlan(plan);
      assertValidMatrix(matrix);

      const result = fitAndEvaluateMLBDeterministicLogisticRegression(configuration, plan, matrix);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(collectIssueCodes(result.issues)).toContain('SPLIT_COUNT_MISMATCH');
      }
    }
  });

  it('rejects non-finite numerical execution without returning a partial artifact', () => {
    const configuration = {
      ...createValidConfiguration(),
      optimization: {
        solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
        learningRate: 1,
        maxIterations: 1,
        tolerance: 0.0001,
      },
    } as Record<string, unknown>;

    const matrix = {
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
      splitCounts: { train: 2, validation: 2, test: 1 },
      rows: [
        {
          exampleId: 'train-positive',
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
              { featureId: 'p_1', value: Number.MAX_VALUE, wasMissing: false },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'train-negative',
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
              { featureId: 'p_1', value: -Number.MAX_VALUE, wasMissing: false },
            ],
          },
          targetValue: 0,
        },
        {
          exampleId: 'valid-positive',
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
              { featureId: 'p_1', value: Number.MAX_VALUE, wasMissing: false },
            ],
          },
          targetValue: 1,
        },
        {
          exampleId: 'valid-negative',
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
              { featureId: 'p_1', value: -Number.MAX_VALUE, wasMissing: false },
            ],
          },
          targetValue: 0,
        },
        {
          exampleId: 'test-1',
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
              { featureId: 'p_1', value: 0, wasMissing: false },
            ],
          },
          targetValue: 1,
        },
      ],
    };

    const plan = {
      ...createValidEvaluationPlan(),
      featureIds: ['p_1'],
      splitCounts: { train: 2, validation: 2, test: 1 },
      totalRows: 5,
    } as Record<string, unknown>;

    assertValidConfiguration(configuration);
    assertValidPlan(plan);
    assertValidMatrix(matrix);

    const result = fitAndEvaluateMLBDeterministicLogisticRegression(configuration, plan, matrix);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(collectIssueCodes(result.issues)).toContain('NUMERICAL_FAILURE');
    }
  });

  it('proves TEST vector and target content are not read after Phase 8F validation', () => {
    const configuration = createValidConfiguration();
    const plan = createValidEvaluationPlan();
    const matrix = createValidMatrixFixture();

    assertValidConfiguration(configuration);
    assertValidPlan(plan);
    assertValidMatrix(matrix);

    const testVectorReads = { count: 0 };
    const testTargetValueReads = { count: 0 };
    const testLabelReads = { count: 0 };
    const testHomeRunsReads = { count: 0 };
    const testAwayRunsReads = { count: 0 };
    const testWinnerTeamIdReads = { count: 0 };

    const proxiedRows = (matrix.rows as Record<string, unknown>[]).map((row: Record<string, unknown>) => {
      if (row.split === 'TEST') {
        return new Proxy(row, {
          get(target, prop) {
            if (prop === 'vector') testVectorReads.count++;
            if (prop === 'targetValue') testTargetValueReads.count++;
            if (prop === 'label') testLabelReads.count++;
            if (prop === 'homeRuns') testHomeRunsReads.count++;
            if (prop === 'awayRuns') testAwayRunsReads.count++;
            if (prop === 'winnerTeamId') testWinnerTeamIdReads.count++;
            return Reflect.get(target, prop);
          },
        });
      }
      return row;
    });

    const proxiedMatrix = {
      ...matrix,
      rows: proxiedRows,
    } as unknown as Record<string, unknown>;

    const matrixValidation = validateMLBTrainingMatrix(proxiedMatrix);
    expect(matrixValidation.ok).toBe(true);

    testVectorReads.count = 0;
    testTargetValueReads.count = 0;
    testLabelReads.count = 0;
    testHomeRunsReads.count = 0;
    testAwayRunsReads.count = 0;
    testWinnerTeamIdReads.count = 0;

    const fitResult = fitAndEvaluateMLBDeterministicLogisticRegression(configuration, plan, proxiedMatrix);
    expect(fitResult.ok).toBe(true);

    expect(testVectorReads.count).toBe(0);
    expect(testTargetValueReads.count).toBe(0);
    expect(testLabelReads.count).toBe(0);
    expect(testHomeRunsReads.count).toBe(0);
    expect(testAwayRunsReads.count).toBe(0);
    expect(testWinnerTeamIdReads.count).toBe(0);

    if (fitResult.ok) {
      expect('testEvaluation' in fitResult.value).toBe(false);
    }
  });

  it('produces deeply deterministic output without mutating inputs', () => {
    const configuration = createValidConfiguration();
    const plan = createValidEvaluationPlan();
    const matrix = createValidMatrixFixture();

    assertValidConfiguration(configuration);
    assertValidPlan(plan);
    assertValidMatrix(matrix);

    const first = fitAndEvaluateMLBDeterministicLogisticRegression(configuration, plan, matrix);
    const second = fitAndEvaluateMLBDeterministicLogisticRegression(configuration, plan, matrix);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value).toEqual(second.value);
    }
    expect(JSON.stringify(matrix)).toBe(JSON.stringify(createValidMatrixFixture()));
    expect(JSON.stringify(plan)).toBe(JSON.stringify(createValidEvaluationPlan()));
  });

  it('rejects odds contamination, row-level predictions, TEST evaluation, recommendations, and prohibited fields', () => {
    const badModel = {
      ...createMinimalModel(),
      rows: [],
      probabilities: [0.5],
    } as Record<string, unknown>;

    const modelResult = validateMLBDeterministicLogisticRegressionModel(badModel);
    expect(modelResult.ok).toBe(false);
    if (!modelResult.ok) {
      expect(collectIssueCodes(modelResult.issues)).toContain('PROHIBITED_CONCEPT');
    }

    const badEvaluation = {
      ...createMinimalEvaluation(),
      testEvaluation: {},
    } as Record<string, unknown>;

    const evaluationResult = validateMLBModelValidationEvaluation(badEvaluation);
    expect(evaluationResult.ok).toBe(false);
    if (!evaluationResult.ok) {
      expect(collectIssueCodes(evaluationResult.issues)).toContain('PROHIBITED_CONCEPT');
    }

    const badResult = {
      ...createMinimalResult(),
      recommendation: 'bet',
    } as Record<string, unknown>;

    const resultValidation = validateMLBModelFitValidationResult(badResult);
    expect(resultValidation.ok).toBe(false);
    if (!resultValidation.ok) {
      expect(collectIssueCodes(resultValidation.issues)).toContain('PROHIBITED_CONCEPT');
    }
  });

  it('extracts deterministic model-fit primitive with identical math and no input mutation', () => {
    const configuration = createValidConfiguration();
    const plan = createValidEvaluationPlan();
    const matrix = createValidMatrixFixture() as Record<string, unknown>;

    assertValidConfiguration(configuration);
    assertValidPlan(plan);
    assertValidMatrix(matrix);

    const fitResult = fitAndEvaluateMLBDeterministicLogisticRegression(configuration, plan, matrix);
    expect(fitResult.ok).toBe(true);
    if (!fitResult.ok) return;
    const baseline = fitResult.value.model;

    const featureIds = (plan.featureIds as string[]);
    const trainRows = (matrix.rows as Record<string, unknown>[]).filter((row) => row.split === 'TRAIN') as Record<string, unknown>[];
    const primitiveResult = fitMLBDeterministicLogisticRegressionModel(
      configuration as unknown as MLBModelTrainingConfiguration,
      featureIds,
      trainRows as unknown as readonly MLBTrainingMatrixRow[],
    );
    expect(primitiveResult.ok).toBe(true);
    if (!primitiveResult.ok) return;
    expect(primitiveResult.value.intercept).toBeCloseTo(baseline.intercept, 10);
    expect(primitiveResult.value.iterationsCompleted).toBe(baseline.iterationsCompleted);
    expect(primitiveResult.value.converged).toBe(baseline.converged);
    expect(primitiveResult.value.finalTrainingObjective).toBeCloseTo(baseline.finalTrainingObjective, 10);
    expect(primitiveResult.value.coefficients).toHaveLength(baseline.coefficients.length);
    for (let i = 0; i < baseline.coefficients.length; i++) {
      expect(primitiveResult.value.coefficients[i].featureId).toBe(baseline.coefficients[i].featureId);
      expect(primitiveResult.value.coefficients[i].valueCoefficient).toBeCloseTo(baseline.coefficients[i].valueCoefficient, 10);
      expect(primitiveResult.value.coefficients[i].missingIndicatorCoefficient).toBeCloseTo(baseline.coefficients[i].missingIndicatorCoefficient, 10);
    }
    expect(JSON.stringify(matrix)).toBe(JSON.stringify(createValidMatrixFixture()));
    expect(JSON.stringify(plan)).toBe(JSON.stringify(createValidEvaluationPlan()));
  });

  it('extracts deterministic prediction primitive with bounded probabilities and no mutation', () => {
    const configuration = createValidConfiguration();
    const plan = createValidEvaluationPlan();
    const matrix = createValidMatrixFixture() as Record<string, unknown>;

    assertValidConfiguration(configuration);
    assertValidPlan(plan);
    assertValidMatrix(matrix);

    const fitResult = fitAndEvaluateMLBDeterministicLogisticRegression(configuration, plan, matrix);
    expect(fitResult.ok).toBe(true);
    if (!fitResult.ok) return;
    const model = fitResult.value.model;

    const validationRows = (matrix.rows as Record<string, unknown>[]).filter((row) => row.split === 'VALIDATION') as Record<string, unknown>[];
    for (const row of validationRows) {
      const probability = predictMLBHomeWinProbability(
        model,
        row.vector as unknown as MLBFeatureVector,
      );
      expect(Number.isFinite(probability)).toBe(true);
      expect(probability).toBeGreaterThanOrEqual(0);
      expect(probability).toBeLessThanOrEqual(1);
    }
    expect(JSON.stringify(matrix)).toBe(JSON.stringify(createValidMatrixFixture()));
    expect(JSON.stringify(plan)).toBe(JSON.stringify(createValidEvaluationPlan()));
  });

  it('verifies issue ordering, exact exports/imports, no TEST evaluation or inference route, and the static architecture boundary', async () => {
    const sourcePath = join(__dirname, '..', '..', '..', 'src', 'prediction', 'mlb', 'mlb-logistic-regression-fit-contract.ts');
    const testsPath = join(__dirname, '..', '..', '..', 'tests', 'prediction', 'mlb', 'mlb-logistic-regression-fit-contract.test.ts');
    const source = await readFile(sourcePath, 'utf8');
    const tests = await readFile(testsPath, 'utf8');

    const exports = Array.from(source.matchAll(/export\s+(?:const|type|function)\s+([A-Za-z0-9_]+)/g)).map((m) => m[1]);
    expect(exports).toEqual([
      'MLB_LOGISTIC_REGRESSION_MODEL_CONTRACT_VERSION',
      'MLB_VALIDATION_EVALUATION_CONTRACT_VERSION',
      'MLB_FIT_VALIDATION_RESULT_CONTRACT_VERSION',
      'MLBModelCoefficient',
      'MLBDeterministicLogisticRegressionModel',
      'MLBValidationMetricValues',
      'MLBModelValidationEvaluation',
      'MLBModelFitValidationResult',
      'MLBModelFitEvaluationIssue',
      'MLBDeterministicLogisticRegressionModelFitOutcome',
      'fitMLBDeterministicLogisticRegressionModel',
      'predictMLBHomeWinProbability',
      'validateMLBDeterministicLogisticRegressionModel',
      'validateMLBModelValidationEvaluation',
      'validateMLBModelFitValidationResult',
      'fitAndEvaluateMLBDeterministicLogisticRegression',
    ]);

    const importSources = Array.from(source.matchAll(/from\s+['"]([^'"]+)['"]/g)).map((m) => m[1]);
    expect(importSources).toEqual([
      '../firewall/odds-contamination-guard',
      './mlb-training-matrix-contract',
      './mlb-feature-vector-contract',
      './mlb-model-training-plan-contract',
    ]);

    expect((source.match(/function\s+validateMLBDeterministicLogisticRegressionModel\s*\(/g) ?? []).length).toBe(1);
    expect((source.match(/function\s+validateMLBModelValidationEvaluation\s*\(/g) ?? []).length).toBe(1);
    expect((source.match(/function\s+validateMLBModelFitValidationResult\s*\(/g) ?? []).length).toBe(1);
    expect((source.match(/function\s+fitAndEvaluateMLBDeterministicLogisticRegression\s*\(/g) ?? []).length).toBe(1);

    expect((tests.match(/it\(/g) ?? []).length).toBe(22);
    expect(tests).not.toMatch(/\b(?:it|test)\s*\.\s*each\s*\(/);

    expect(source).not.toMatch(/export\s+(?:enum|interface)\s+/);
    expect(source).not.toContain('read' + 'File' + 'Sync');
    expect(source).not.toContain('write' + 'File' + 'Sync');
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('PrismaClient');
    expect(source).not.toContain('process.env');
    expect(source).not.toContain('Date.now');
    expect(source).not.toMatch(/new\s+Date\s*\(\s*\)/);
    expect(source).not.toContain('Math.random');
    expect(source).not.toContain('randomUUID');
    expect(source).not.toContain('localeCompare');

    const prohibitedPatterns = [
      'fitModel', 'trainModel', 'calculateGradient', 'computeGradient',
      'updateCoefficients', 'runGradientDescent', 'searchHyperparameters',
      'calibrate', 'predictProbability', 'generatePrediction',
      'generateRecommendation', 'buildMulti', 'calculateStake', 'gradePrediction',
    ];
    for (const pattern of prohibitedPatterns) {
      expect(source).not.toContain(pattern);
    }

    const builderStart = source.indexOf('export function fitAndEvaluateMLBDeterministicLogisticRegression');
    expect(builderStart).toBeGreaterThanOrEqual(0);
    const builderSource = source.slice(builderStart);

    expect(builderSource).toContain('validateMLBModelTrainingConfiguration');
    expect(builderSource).toContain('validateMLBModelEvaluationPlan');
    expect(builderSource).toContain('validateMLBTrainingMatrix');
    expect(builderSource).toContain('validateMLBModelFitValidationResult');
    expect(builderSource).toContain('trainRows');
    expect(builderSource).toContain('validationRows');
    expect(builderSource).not.toContain('rows:');
    expect(builderSource).not.toContain('predictions:');
    expect(builderSource).not.toContain('probabilities:');
    expect(builderSource).toContain('predictMLBHomeWinProbability');
  });
});
