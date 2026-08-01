import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import {
  buildMLBDeterministicModelEvaluationPlan,
  MLB_MODEL_EVALUATION_PLAN_CONTRACT_VERSION,
  MLB_MODEL_TRAINING_CONFIGURATION_CONTRACT_VERSION,
  validateMLBModelEvaluationPlan,
  validateMLBModelTrainingConfiguration,
  type MLBModelTrainingPlanIssue,
} from '@/prediction/mlb/mlb-model-training-plan-contract';
import { validateMLBTrainingMatrix } from '@/prediction/mlb/mlb-training-matrix-contract';

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

function createValidPlan(): Record<string, unknown> {
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
    featureIds: ['p_1'],
    splitPolicy: {
      strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1',
      embargoDays: 0,
      train: { startDate: '2026-07-01', endDate: '2026-07-15' },
      validation: { startDate: '2026-07-16', endDate: '2026-07-16' },
      test: { startDate: '2026-07-17', endDate: '2026-07-17' },
    },
    splitCounts: { train: 1, validation: 1, test: 1 },
    totalRows: 3,
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
    splitCounts: { train: 1, validation: 1, test: 1 },
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
          values: [{ featureId: 'p_1', value: 1, wasMissing: false }],
        },
        targetValue: 1,
      },
      {
        exampleId: 'valid-1',
        split: 'VALIDATION',
        vector: {
          contractVersion: 'mlb-feature-vector-v1',
          sport: 'MLB',
          target: 'OFFICIAL_FINAL_GAME_WINNER',
          manifestId: 'manifest-1',
          snapshotId: 'snapshot-2',
          gameId: 'game-2',
          officialDate: '2026-07-16',
          dataCutoffAt: '2026-07-15T09:00:00Z',
          values: [{ featureId: 'p_1', value: 2, wasMissing: false }],
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
          snapshotId: 'snapshot-3',
          gameId: 'game-3',
          officialDate: '2026-07-17',
          dataCutoffAt: '2026-07-15T09:00:00Z',
          values: [{ featureId: 'p_1', value: 3, wasMissing: false }],
        },
        targetValue: 1,
      },
    ],
  };
}

function createMultiFeatureMatrixFixture(): Record<string, unknown> {
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
    splitCounts: { train: 2, validation: 1, test: 1 },
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
          officialDate: '2026-07-14',
          dataCutoffAt: '2026-07-15T09:00:00Z',
          values: [
            { featureId: 'feature_a', value: 1, wasMissing: false },
            { featureId: 'feature_b', value: 2, wasMissing: true },
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
            { featureId: 'feature_a', value: 3, wasMissing: false },
            { featureId: 'feature_b', value: 4, wasMissing: false },
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
            { featureId: 'feature_a', value: 5, wasMissing: true },
            { featureId: 'feature_b', value: 6, wasMissing: false },
          ],
        },
        targetValue: 1,
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
            { featureId: 'feature_a', value: 7, wasMissing: false },
            { featureId: 'feature_b', value: 8, wasMissing: false },
          ],
        },
        targetValue: 1,
      },
    ],
  };
}

function createEmptySplitMatrixFixture({
  emptySplit,
}: {
  emptySplit: 'TRAIN' | 'VALIDATION' | 'TEST';
}): Record<string, unknown> {
  const rows: Record<string, unknown>[] = [];
  const splitCounts: Record<string, number> = { train: 0, validation: 0, test: 0 };

  if (emptySplit !== 'TRAIN') {
    rows.push({
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
        values: [{ featureId: 'p_1', value: 1, wasMissing: false }],
      },
      targetValue: 1,
    });
    splitCounts.train = 1;
  }

  if (emptySplit !== 'VALIDATION') {
    rows.push({
      exampleId: 'valid-1',
      split: 'VALIDATION',
      vector: {
        contractVersion: 'mlb-feature-vector-v1',
        sport: 'MLB',
        target: 'OFFICIAL_FINAL_GAME_WINNER',
        manifestId: 'manifest-1',
        snapshotId: 'snapshot-2',
        gameId: 'game-2',
        officialDate: '2026-07-16',
        dataCutoffAt: '2026-07-15T09:00:00Z',
        values: [{ featureId: 'p_1', value: 2, wasMissing: false }],
      },
      targetValue: 0,
    });
    splitCounts.validation = 1;
  }

  if (emptySplit !== 'TEST') {
    rows.push({
      exampleId: 'test-1',
      split: 'TEST',
      vector: {
        contractVersion: 'mlb-feature-vector-v1',
        sport: 'MLB',
        target: 'OFFICIAL_FINAL_GAME_WINNER',
        manifestId: 'manifest-1',
        snapshotId: 'snapshot-3',
        gameId: 'game-3',
        officialDate: '2026-07-17',
        dataCutoffAt: '2026-07-15T09:00:00Z',
        values: [{ featureId: 'p_1', value: 3, wasMissing: false }],
      },
      targetValue: 1,
    });
    splitCounts.test = 1;
  }

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
    splitCounts,
    rows,
  };
}

function assertValidMatrix(matrix: Record<string, unknown>): void {
  const result = validateMLBTrainingMatrix(matrix);
  expect(result.ok).toBe(true);
}

function collectIssueCodes(issues: readonly MLBModelTrainingPlanIssue[]): string[] {
  return issues.map((issue) => issue.code);
}

describe('Phase 8G MLB model-training plan contract', () => {
  it('accepts a minimal valid training configuration and returns the exact original reference', () => {
    const configuration = createValidConfiguration();
    const result = validateMLBModelTrainingConfiguration(configuration);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(configuration);
    }
  });

  it('validates exact configuration root fields, versions, literals, and config ID', () => {
    const configuration = createValidConfiguration();
    const result = validateMLBModelTrainingConfiguration(configuration);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contractVersion).toBe(MLB_MODEL_TRAINING_CONFIGURATION_CONTRACT_VERSION);
      expect(result.value.sport).toBe('MLB');
      expect(result.value.target).toBe('OFFICIAL_FINAL_GAME_WINNER');
      expect(result.value.targetEncoding).toBe('HOME_WIN_1_AWAY_WIN_0');
      expect(result.value.configId).toBe('config-1');
    }
  });

  it('validates the deterministic algorithm and policy literals', () => {
    const configuration = createValidConfiguration();
    const result = validateMLBModelTrainingConfiguration(configuration);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.algorithm).toBe('L2_LOGISTIC_REGRESSION_BINARY_V1');
      expect(result.value.randomnessPolicy).toBe('NO_RANDOMNESS');
      expect(result.value.featureValuePolicy).toBe('RAW_FINITE_FEATURE_VALUES');
      expect(result.value.missingIndicatorPolicy).toBe('PRESERVE_WAS_MISSING_FLAGS');
    }
  });

  it('validates L2 regularization strength and rejects invalid numbers', () => {
    const configuration = createValidConfiguration();
    const result = validateMLBModelTrainingConfiguration(configuration);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.regularization.kind).toBe('L2');
      expect(result.value.regularization.strength).toBe(0.01);
    }

    const invalidKind = [
      { ...createValidConfiguration(), regularization: { kind: 'L1', strength: 0.01 } },
    ];

    for (const invalid of invalidKind) {
      const invalidResult = validateMLBModelTrainingConfiguration(invalid);
      expect(invalidResult.ok).toBe(false);
      if (!invalidResult.ok) {
        const codes = collectIssueCodes(invalidResult.issues);
        expect(codes).toContain('INVALID_LITERAL');
      }
    }

    const invalidStrengths = [
      { ...createValidConfiguration(), regularization: { kind: 'L2', strength: -0.01 } },
      { ...createValidConfiguration(), regularization: { kind: 'L2', strength: 0 } },
      { ...createValidConfiguration(), regularization: { kind: 'L2', strength: Infinity } },
      { ...createValidConfiguration(), regularization: { kind: 'L2', strength: NaN } },
    ];

    for (const invalid of invalidStrengths) {
      const invalidResult = validateMLBModelTrainingConfiguration(invalid);
      expect(invalidResult.ok).toBe(false);
      if (!invalidResult.ok) {
        const codes = collectIssueCodes(invalidResult.issues);
        expect(codes).toContain('INVALID_NUMBER');
      }
    }
  });

  it('validates optimization solver, learning-rate, iteration, and tolerance bounds', () => {
    const configuration = createValidConfiguration();
    const result = validateMLBModelTrainingConfiguration(configuration);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.optimization.solver).toBe('DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1');
      expect(result.value.optimization.learningRate).toBe(0.1);
      expect(result.value.optimization.maxIterations).toBe(1000);
      expect(result.value.optimization.tolerance).toBe(0.0001);
    }

    const invalid = { ...createValidConfiguration() } as Record<string, unknown>;
    invalid.optimization = {
      solver: 'OTHER_SOLVER',
      learningRate: 0,
      maxIterations: -1,
      tolerance: 1,
    };
    const invalidResult = validateMLBModelTrainingConfiguration(invalid);
    expect(invalidResult.ok).toBe(false);
    if (!invalidResult.ok) {
      const codes = collectIssueCodes(invalidResult.issues);
      expect(codes).toContain('INVALID_LITERAL');
      expect(codes).toContain('INVALID_NUMBER');
    }
  });

  it('validates descriptor-safe configuration objects, real symbols, classes, and accessors without invoking getters', () => {
    const symbol = Symbol('symbol');
    const result = validateMLBModelTrainingConfiguration({
      ...createValidConfiguration(),
      unknown: true,
      [symbol]: 'value',
      get nested() { return {}; },
    } as unknown);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const codes = collectIssueCodes(result.issues);
      expect(codes).toContain('UNKNOWN_FIELD');
      expect(codes).toContain('INVALID_JSON_VALUE');
    }
  });

  it('accepts a minimal valid evaluation plan and returns the exact original reference', () => {
    const plan = createValidPlan();
    const result = validateMLBModelEvaluationPlan(plan);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(plan);
    }
  });

  it('validates exact plan fields, identities, and deterministic plan ID', () => {
    const plan = createValidPlan();
    const result = validateMLBModelEvaluationPlan(plan);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contractVersion).toBe(MLB_MODEL_EVALUATION_PLAN_CONTRACT_VERSION);
      expect(result.value.matrixId).toBe('dataset-1::manifest-1');
      expect(result.value.configId).toBe('config-1');
      expect(result.value.planId).toBe('dataset-1::manifest-1::config-1');
      expect(result.value.manifestId).toBe('manifest-1');
      expect(result.value.datasetId).toBe('dataset-1');
    }
  });

  it('validates non-empty, unique, canonically ordered feature IDs', () => {
    const plan = createValidPlan();
    const result = validateMLBModelEvaluationPlan(plan);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.featureIds).toEqual(['p_1']);
    }

    const badPlan = { ...createValidPlan(), featureIds: ['feature_2', 'feature_1', 'feature_2', 'feature_3'] } as Record<string, unknown>;
    const badResult = validateMLBModelEvaluationPlan(badPlan);
    expect(badResult.ok).toBe(false);
    if (!badResult.ok) {
      const codes = collectIssueCodes(badResult.issues);
      expect(codes).toContain('DUPLICATE_ID');
      expect(codes).toContain('NON_CANONICAL_ORDER');
    }
  });

  it('validates Gregorian split windows, chronology, and embargoes', () => {
    const plan = createValidPlan();
    const result = validateMLBModelEvaluationPlan(plan);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.splitPolicy.strategy).toBe('CHRONOLOGICAL_OFFICIAL_DATE_V1');
    }

    const badPlan = {
      ...createValidPlan(),
      splitPolicy: {
        strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1',
        embargoDays: 2,
        train: { startDate: '2026-07-10', endDate: '2026-07-15' },
        validation: { startDate: '2026-07-16', endDate: '2026-07-16' },
        test: { startDate: '2026-07-17', endDate: '2026-07-17' },
      },
    } as Record<string, unknown>;
    const badResult = validateMLBModelEvaluationPlan(badPlan);
    expect(badResult.ok).toBe(false);
    if (!badResult.ok) {
      expect(badResult.issues.some((issue) => issue.code === 'SPLIT_POLICY_VIOLATION')).toBe(true);
    }
  });

  it('validates positive split counts and exact total-row agreement', () => {
    const plan = createValidPlan();
    const result = validateMLBModelEvaluationPlan(plan);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.splitCounts).toEqual({ train: 1, validation: 1, test: 1 });
      expect(result.value.totalRows).toBe(3);
    }

    const badPlan = {
      ...createValidPlan(),
      splitCounts: { train: 0, validation: 1, test: 1 },
      totalRows: 3,
    } as Record<string, unknown>;
    const badResult = validateMLBModelEvaluationPlan(badPlan);
    expect(badResult.ok).toBe(false);
    if (!badResult.ok) {
      expect(badResult.issues.some((issue) => issue.code === 'INVALID_INTEGER')).toBe(true);
    }
  });

  it('validates exact metrics, metric order, selection metric, protocol, and test policy', () => {
    const plan = createValidPlan();
    const result = validateMLBModelEvaluationPlan(plan);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.protocol).toBe('TRAIN_FIT_VALIDATION_SELECT_TEST_FINAL_V1');
      expect(result.value.selectionMetric).toBe('LOG_LOSS');
      expect(result.value.reportedMetrics).toEqual(['LOG_LOSS', 'BRIER_SCORE', 'ROC_AUC']);
      expect(result.value.testSetPolicy).toBe('HOLDOUT_UNTIL_CONFIGURATION_LOCKED');
    }

    const badPlan = {
      ...createValidPlan(),
      reportedMetrics: ['ROC_AUC', 'LOG_LOSS', 'BRIER_SCORE'],
    } as Record<string, unknown>;
    const badResult = validateMLBModelEvaluationPlan(badPlan);
    expect(badResult.ok).toBe(false);
    if (!badResult.ok) {
      expect(badResult.issues.some((issue) => issue.code === 'METRIC_CONFIGURATION_MISMATCH')).toBe(true);
    }
  });

  it('validates descriptor-safe plan structures, arrays, real symbols, classes, and accessors', () => {
    const symbol = Symbol('symbol');
    const result = validateMLBModelEvaluationPlan({
      ...createValidPlan(),
      unknown: true,
      [symbol]: 'value',
      get forbidden() { return true; },
    } as unknown);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const codes = collectIssueCodes(result.issues);
      expect(codes).toContain('UNKNOWN_FIELD');
      expect(codes).toContain('INVALID_JSON_VALUE');
    }
  });

  it('builds a deterministic plan from a valid configuration and valid Phase 8F matrix', () => {
    const configuration = createValidConfiguration();
    const matrix = createValidMatrixFixture();
    assertValidMatrix(matrix);
    const result = buildMLBDeterministicModelEvaluationPlan(configuration, matrix);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(createValidPlan());
    }
  });

  it('preserves matrix identities, feature schema, split policy, split counts, and total rows', () => {
    const configuration = createValidConfiguration();
    const matrix = createMultiFeatureMatrixFixture();
    assertValidMatrix(matrix);
    const result = buildMLBDeterministicModelEvaluationPlan(configuration, matrix);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const plan = result.value;
      expect(plan.matrixId).toBe(matrix.matrixId);
      expect(plan.manifestId).toBe(matrix.manifestId);
      expect(plan.datasetId).toBe(matrix.datasetId);
      expect(plan.featureIds).toEqual(['feature_a', 'feature_b']);
      expect(plan.splitPolicy).toEqual(matrix.splitPolicy);
      expect(plan.splitCounts).toEqual({ train: 2, validation: 1, test: 1 });
      expect(plan.totalRows).toBe(4);
    }
  });

  it('rejects a valid Phase 8F matrix with an actually empty TRAIN, VALIDATION, or TEST split', () => {
    const configuration = createValidConfiguration();
    const emptySplits = ['TRAIN', 'VALIDATION', 'TEST'] as const;

    for (const emptySplit of emptySplits) {
      const matrix = createEmptySplitMatrixFixture({ emptySplit });
      const matrixValidation = validateMLBTrainingMatrix(matrix);
      expect(matrixValidation.ok).toBe(true);

      const result = buildMLBDeterministicModelEvaluationPlan(configuration, matrix);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0].code).toBe('INSUFFICIENT_SPLIT_ROWS');
        expect(result.issues[0].path).toBe('$.trainingMatrix.splitCounts');
      }
    }
  });

  it('proves no Phase 8G post-validation target, label, score, or winner access', () => {
    const targetValueReads = { count: 0 };
    const labelReads = { count: 0 };
    const homeRunsReads = { count: 0 };
    const awayRunsReads = { count: 0 };
    const winnerTeamIdReads = { count: 0 };

    const vector = {
      contractVersion: 'mlb-feature-vector-v1',
      sport: 'MLB',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      manifestId: 'manifest-1',
      snapshotId: 'snapshot-proxy',
      gameId: 'game-proxy',
      officialDate: '2026-07-15',
      dataCutoffAt: '2026-07-15T09:00:00Z',
      values: [{ featureId: 'p_1', value: 1, wasMissing: false }],
    };

    const targetRow: Record<string, unknown> = {
      exampleId: 'proxy-row',
      split: 'TRAIN',
      vector,
      targetValue: 1,
    };

    const rowProxy = new Proxy(targetRow, {
      get(target, prop, receiver) {
        if (prop === 'targetValue') targetValueReads.count++;
        if (prop === 'label') labelReads.count++;
        if (prop === 'homeRuns') homeRunsReads.count++;
        if (prop === 'awayRuns') awayRunsReads.count++;
        if (prop === 'winnerTeamId') winnerTeamIdReads.count++;
        return Reflect.get(target, prop, receiver);
      },
    });

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
      splitCounts: { train: 1, validation: 1, test: 1 },
      rows: [
        rowProxy,
        {
          exampleId: 'valid-1',
          split: 'VALIDATION',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'manifest-1',
            snapshotId: 'snapshot-2',
            gameId: 'game-2',
            officialDate: '2026-07-16',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [{ featureId: 'p_1', value: 2, wasMissing: false }],
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
            snapshotId: 'snapshot-3',
            gameId: 'game-3',
            officialDate: '2026-07-17',
            dataCutoffAt: '2026-07-15T09:00:00Z',
            values: [{ featureId: 'p_1', value: 3, wasMissing: false }],
          },
          targetValue: 1,
        },
      ],
    };

    const matrixValidation = validateMLBTrainingMatrix(matrix);
    expect(matrixValidation.ok).toBe(true);

    targetValueReads.count = 0;
    labelReads.count = 0;
    homeRunsReads.count = 0;
    awayRunsReads.count = 0;
    winnerTeamIdReads.count = 0;

    const originalRowCount = matrix.rows.length;
    const originalFirstExampleId = matrix.rows[0].exampleId;

    const planResult = buildMLBDeterministicModelEvaluationPlan(createValidConfiguration(), matrix);
    expect(planResult.ok).toBe(true);
    expect(targetValueReads.count).toBe(0);
    expect(labelReads.count).toBe(0);
    expect(homeRunsReads.count).toBe(0);
    expect(awayRunsReads.count).toBe(0);
    expect(winnerTeamIdReads.count).toBe(0);
    if (planResult.ok) {
      expect(planResult.value.featureIds).toEqual(['p_1']);
      expect('rows' in planResult.value).toBe(false);
      expect('targetValue' in planResult.value).toBe(false);
      expect('label' in planResult.value).toBe(false);
    }
    expect(matrix.rows).toHaveLength(originalRowCount);
    expect(matrix.rows[0].exampleId).toBe(originalFirstExampleId);
  });

  it('produces deeply deterministic output without mutating inputs', () => {
    const configuration = createValidConfiguration();
    const matrix = createValidMatrixFixture();
    const first = buildMLBDeterministicModelEvaluationPlan(configuration, matrix);
    const second = buildMLBDeterministicModelEvaluationPlan(configuration, matrix);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value).toEqual(second.value);
    }
    expect(JSON.stringify(matrix)).toBe(JSON.stringify(createValidMatrixFixture()));
  });

  it('rejects odds contamination, rows, vectors, targets, fitted parameters, predictions, and prohibited plan fields', () => {
    const bad = {
      ...createValidPlan(),
      odds: [1.5],
      targetValue: 1,
      prediction: { probability: 0.8 },
    } as Record<string, unknown>;

    const result = validateMLBModelEvaluationPlan(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const codes = collectIssueCodes(result.issues);
      expect(codes).toContain('ODDS_CONTAMINATION');
      expect(codes).toContain('PROHIBITED_CONCEPT');
    }
  });

  it('verifies issue ordering, exact exports/imports, no fitting or inference, and the complete static architecture boundary', async () => {
    const sourcePath = join(__dirname, '..', '..', '..', 'src', 'prediction', 'mlb', 'mlb-model-training-plan-contract.ts');
    const testsPath = join(__dirname, '..', '..', '..', 'tests', 'prediction', 'mlb', 'mlb-model-training-plan-contract.test.ts');
    const source = await readFile(sourcePath, 'utf8');
    const tests = await readFile(testsPath, 'utf8');

    const exports = Array.from(source.matchAll(/export\s+(?:const|type|function)\s+([A-Za-z0-9_]+)/g)).map((m) => m[1]);
    expect(exports).toEqual([
      'MLB_MODEL_TRAINING_CONFIGURATION_CONTRACT_VERSION',
      'MLB_MODEL_EVALUATION_PLAN_CONTRACT_VERSION',
      'MLBModelAlgorithm',
      'MLBModelRandomnessPolicy',
      'MLBModelFeatureValuePolicy',
      'MLBModelMissingIndicatorPolicy',
      'MLBModelRegularization',
      'MLBModelOptimization',
      'MLBModelTrainingConfiguration',
      'MLBModelEvaluationMetric',
      'MLBModelEvaluationPlan',
      'MLBModelTrainingPlanIssue',
      'validateMLBModelTrainingConfiguration',
      'validateMLBModelEvaluationPlan',
      'buildMLBDeterministicModelEvaluationPlan',
    ]);

    const importSources = Array.from(source.matchAll(/from\s+['"]([^'"]+)['"]/g)).map((m) => m[1]);
    expect(importSources).toEqual([
      '../firewall/odds-contamination-guard',
      './mlb-training-matrix-contract',
    ]);

    expect((source.match(/function\s+validateMLBModelTrainingConfiguration\s*\(/g) ?? []).length).toBe(1);
    expect((source.match(/function\s+validateMLBModelEvaluationPlan\s*\(/g) ?? []).length).toBe(1);
    expect((source.match(/function\s+buildMLBDeterministicModelEvaluationPlan\s*\(/g) ?? []).length).toBe(1);

    expect((tests.match(/it\(/g) ?? []).length).toBe(20);

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

    const builderStart = source.indexOf('export function buildMLBDeterministicModelEvaluationPlan');
    expect(builderStart).toBeGreaterThanOrEqual(0);
    const builderSource = source.slice(builderStart);

    expect(builderSource).toContain('validateMLBModelTrainingConfiguration');
    expect(builderSource).toContain('validateMLBTrainingMatrix');
    expect(builderSource).toContain('validateMLBModelEvaluationPlan');
    expect(builderSource).toContain('firstRow.vector.values.map');
    expect(builderSource).not.toContain('.targetValue');
    expect(builderSource).not.toContain('.label');
    expect(builderSource).not.toContain('homeRuns');
    expect(builderSource).not.toContain('awayRuns');
    expect(builderSource).not.toContain('winnerTeamId');
    expect(builderSource).not.toContain('rows:');
    expect(builderSource).toContain('planId: `${validatedMatrix.matrixId}::${validatedConfig.configId}`');
    expect(builderSource).toContain('const planResult = validateMLBModelEvaluationPlan(plan);');

    const { contractVersion: _omit, ...malformedConfiguration } = createValidConfiguration();
    const configurationIssues = validateMLBModelTrainingConfiguration({
      ...malformedConfiguration,
      sport: 'NFL',
      unknown: true,
    });
    expect(configurationIssues.ok).toBe(false);
    if (!configurationIssues.ok) {
      expect(configurationIssues.issues[0]).toEqual(expect.objectContaining({ code: 'MISSING_FIELD', path: '$.contractVersion' }));
      expect(configurationIssues.issues[1]).toEqual(expect.objectContaining({ code: 'INVALID_LITERAL', path: '$.sport' }));
      expect(configurationIssues.issues[2]).toEqual(expect.objectContaining({ code: 'UNKNOWN_FIELD', path: '$.unknown' }));
    }

    const planIssues = validateMLBModelEvaluationPlan({
      ...createValidPlan(),
      featureIds: ['feature_2', 'feature_1'],
    });
    expect(planIssues.ok).toBe(false);
    if (!planIssues.ok) {
      expect(planIssues.issues[0]).toEqual(expect.objectContaining({ code: 'NON_CANONICAL_ORDER', path: '$.featureIds' }));
    }
  });
});
