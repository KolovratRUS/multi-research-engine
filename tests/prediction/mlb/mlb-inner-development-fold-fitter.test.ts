import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import {
  fitMLBInnerDevelopmentFold,
  type MLBInnerDevelopmentFoldFitIssue,
  type MLBInnerDevelopmentFoldFitOutcome,
  type MLBInnerDevelopmentFoldFitSuccess,
} from '@/prediction/mlb/mlb-inner-development-fold-fitter';
import {
  fitMLBDeterministicLogisticRegressionModel,
  predictMLBHomeWinProbability,
} from '@/prediction/mlb/mlb-logistic-regression-fit-contract';
import { type MLBFeatureVector, validateMLBFeatureVector } from '@/prediction/mlb/mlb-feature-vector-contract';
import { type MLBModelTrainingConfiguration } from '@/prediction/mlb/mlb-model-training-plan-contract';
import { type MLBTrainingMatrixRow } from '@/prediction/mlb/mlb-training-matrix-contract';

function createValidConfiguration(): MLBModelTrainingConfiguration {
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

function createTrainRow(overrides: Partial<MLBTrainingMatrixRow> = {}): MLBTrainingMatrixRow {
  return {
    exampleId: overrides.exampleId ?? 'train-1',
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
        { featureId: 'p_1', value: 1, wasMissing: false },
        { featureId: 'p_2', value: 2, wasMissing: true },
      ],
    },
    targetValue: overrides.targetValue ?? 1,
    ...overrides,
  };
}

function createValidationRow(overrides: Partial<MLBTrainingMatrixRow> = {}): MLBTrainingMatrixRow {
  return {
    exampleId: overrides.exampleId ?? 'valid-1',
    split: 'TRAIN',
    vector: {
      contractVersion: 'mlb-feature-vector-v1',
      sport: 'MLB',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      manifestId: 'manifest-1',
      snapshotId: 'snapshot-1',
      gameId: 'game-1',
      officialDate: '2026-07-16',
      dataCutoffAt: '2026-07-15T09:00:00Z',
      values: [
        { featureId: 'p_1', value: 3, wasMissing: true },
        { featureId: 'p_2', value: 4, wasMissing: false },
      ],
    },
    targetValue: overrides.targetValue ?? 1,
    ...overrides,
  };
}

function createSyntheticFold() {
  const configuration = createValidConfiguration();
  const trainRows: MLBTrainingMatrixRow[] = [
    createTrainRow({ exampleId: 'train-1', targetValue: 1 }),
    createTrainRow({ exampleId: 'train-2', targetValue: 0 }),
  ];
  const validationRows: MLBTrainingMatrixRow[] = [
    createValidationRow({ exampleId: 'valid-1', targetValue: 1 }),
    createValidationRow({ exampleId: 'valid-2', targetValue: 0 }),
  ];
  return { configuration, trainRows, validationRows };
}

function collectIssueCodes(issues: readonly MLBInnerDevelopmentFoldFitIssue[]): string[] {
  return issues.map((issue) => issue.code);
}

describe('Phase 8V-D3-C-E4-B4-I1B MLB inner development fold fitter', () => {
  it('succeeds with valid synthetic fold and returns exact metadata', () => {
    const { configuration, trainRows, validationRows } = createSyntheticFold();

    const outcome = fitMLBInnerDevelopmentFold({
      configuration,
      trainRows,
      validationRows,
      foldId: 'fold-1',
      candidateRecipeId: 'recipe-1',
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      const success = outcome.value;
      expect(success.foldId).toBe('fold-1');
      expect(success.candidateRecipeId).toBe('recipe-1');
      expect(success.lowLevelFitCount).toBe(1);
      expect(success.predictions).toHaveLength(2);
      expect(success.modelMetadata.trainingRowCount).toBe(2);
      expect(success.modelMetadata.featureIds).toEqual(['p_1', 'p_2']);
      expect(typeof success.modelMetadata.converged).toBe('boolean');
      expect(typeof success.modelMetadata.iterationsCompleted).toBe('number');
      expect(typeof success.modelMetadata.finalTrainingObjective).toBe('number');

      expect(success.predictions[0].exampleId).toBe('valid-1');
      expect(success.predictions[1].exampleId).toBe('valid-2');
      expect(success.predictions[0].homeWinProbability).toBeGreaterThanOrEqual(0);
      expect(success.predictions[0].homeWinProbability).toBeLessThanOrEqual(1);
      expect(Number.isFinite(success.predictions[0].homeWinProbability)).toBe(true);
      expect(Number.isFinite(success.predictions[1].homeWinProbability)).toBe(true);
    }
  });

  it('produces identical output for identical input', () => {
    const { configuration, trainRows, validationRows } = createSyntheticFold();

    const first = fitMLBInnerDevelopmentFold({
      configuration,
      trainRows,
      validationRows,
      foldId: 'fold-2',
      candidateRecipeId: 'recipe-2',
    });

    const second = fitMLBInnerDevelopmentFold({
      configuration,
      trainRows,
      validationRows,
      foldId: 'fold-2',
      candidateRecipeId: 'recipe-2',
    });

    expect(first).toEqual(second);
  });

  it('does not mutate caller inputs', () => {
    const { configuration, trainRows, validationRows } = createSyntheticFold();
    const configurationClone = { ...configuration } as Record<string, unknown>;
    const trainClone = trainRows.map((row) => ({ ...row, vector: { ...row.vector, values: row.vector.values.map((v) => ({ ...v })) } }));
    const validationClone = validationRows.map((row) => ({ ...row, vector: { ...row.vector, values: row.vector.values.map((v) => ({ ...v })) } }));

    fitMLBInnerDevelopmentFold({
      configuration,
      trainRows,
      validationRows,
      foldId: 'fold-3',
      candidateRecipeId: 'recipe-3',
    });

    expect(configuration).toEqual(configurationClone);
    expect(trainRows).toEqual(trainClone);
    expect(validationRows).toEqual(validationClone);
  });

  it('fails closed on invalid configuration with lowLevelFitCount 0', () => {
    const configuration = { ...createValidConfiguration(), configId: '' };
    const outcome = fitMLBInnerDevelopmentFold({
      configuration,
      trainRows: [createTrainRow()],
      validationRows: [createValidationRow()],
      foldId: 'fold-4',
      candidateRecipeId: 'recipe-4',
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(collectIssueCodes(outcome.issues)).toContain('INVALID_CONFIGURATION');
      expect(outcome.lowLevelFitCount).toBe(0);
    }
  });

  it('fails closed on empty train rows before fitting', () => {
    const outcome = fitMLBInnerDevelopmentFold({
      configuration: createValidConfiguration(),
      trainRows: [],
      validationRows: [createValidationRow()],
      foldId: 'fold-5',
      candidateRecipeId: 'recipe-5',
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(collectIssueCodes(outcome.issues)).toContain('INVALID_TRAIN_ROWS');
      expect(outcome.lowLevelFitCount).toBe(0);
    }
  });

  it('fails closed on malformed train vector before fitting', () => {
    const outcome = fitMLBInnerDevelopmentFold({
      configuration: createValidConfiguration(),
      trainRows: [createTrainRow({ vector: { ...createTrainRow().vector, values: [] } })],
      validationRows: [createValidationRow()],
      foldId: 'fold-6',
      candidateRecipeId: 'recipe-6',
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(collectIssueCodes(outcome.issues)).toContain('INVALID_TRAIN_ROWS');
      expect(outcome.lowLevelFitCount).toBe(0);
    }
  });

  it('fails closed on inconsistent train feature schema before fitting', () => {
    const trainRows: MLBTrainingMatrixRow[] = [
      createTrainRow({ exampleId: 'train-a' }),
      createTrainRow({ exampleId: 'train-b', vector: { ...createTrainRow().vector, values: [{ featureId: 'p_3', value: 1, wasMissing: false }] } }),
    ];

    const outcome = fitMLBInnerDevelopmentFold({
      configuration: createValidConfiguration(),
      trainRows,
      validationRows: [createValidationRow()],
      foldId: 'fold-7',
      candidateRecipeId: 'recipe-7',
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(collectIssueCodes(outcome.issues)).toContain('INVALID_FEATURE_SCHEMA');
      expect(outcome.lowLevelFitCount).toBe(0);
    }
  });

  it('fails closed on insufficient class variation before fitting', () => {
    const trainRows: MLBTrainingMatrixRow[] = [
      createTrainRow({ exampleId: 'train-1', targetValue: 1 }),
      createTrainRow({ exampleId: 'train-2', targetValue: 1 }),
    ];

    const outcome = fitMLBInnerDevelopmentFold({
      configuration: createValidConfiguration(),
      trainRows,
      validationRows: [createValidationRow()],
      foldId: 'fold-8',
      candidateRecipeId: 'recipe-8',
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(collectIssueCodes(outcome.issues)).toContain('INSUFFICIENT_CLASS_VARIATION');
      expect(outcome.lowLevelFitCount).toBe(0);
    }
  });

  it('fails closed on empty validation rows before fitting', () => {
    const outcome = fitMLBInnerDevelopmentFold({
      configuration: createValidConfiguration(),
      trainRows: [createTrainRow(), createTrainRow({ exampleId: 'train-2', targetValue: 0 })],
      validationRows: [],
      foldId: 'fold-9',
      candidateRecipeId: 'recipe-9',
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(collectIssueCodes(outcome.issues)).toContain('INVALID_VALIDATION_ROWS');
      expect(outcome.lowLevelFitCount).toBe(0);
    }
  });

  it('fails closed on malformed validation vector before fitting', () => {
    const outcome = fitMLBInnerDevelopmentFold({
      configuration: createValidConfiguration(),
      trainRows: [createTrainRow(), createTrainRow({ exampleId: 'train-2', targetValue: 0 })],
      validationRows: [createValidationRow({ vector: { ...createValidationRow().vector, values: [] } })],
      foldId: 'fold-10',
      candidateRecipeId: 'recipe-10',
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(collectIssueCodes(outcome.issues)).toContain('INVALID_VALIDATION_ROWS');
      expect(outcome.lowLevelFitCount).toBe(0);
    }
  });

  it('fails closed on validation schema mismatch before fitting', () => {
    const outcome = fitMLBInnerDevelopmentFold({
      configuration: createValidConfiguration(),
      trainRows: [createTrainRow(), createTrainRow({ exampleId: 'train-2', targetValue: 0 })],
      validationRows: [
        createValidationRow({
          exampleId: 'valid-1',
          vector: { ...createValidationRow().vector, values: [{ featureId: 'p_9', value: 1, wasMissing: false }] },
        }),
      ],
      foldId: 'fold-11',
      candidateRecipeId: 'recipe-11',
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(collectIssueCodes(outcome.issues)).toContain('INVALID_FEATURE_SCHEMA');
      expect(outcome.lowLevelFitCount).toBe(0);
    }
  });

  it('fails closed on duplicate validation exampleId before fitting', () => {
    const outcome = fitMLBInnerDevelopmentFold({
      configuration: createValidConfiguration(),
      trainRows: [createTrainRow(), createTrainRow({ exampleId: 'train-2', targetValue: 0 })],
      validationRows: [createValidationRow({ exampleId: 'valid-1' }), createValidationRow({ exampleId: 'valid-1' })],
      foldId: 'fold-12',
      candidateRecipeId: 'recipe-12',
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(collectIssueCodes(outcome.issues)).toContain('INVALID_VALIDATION_ROWS');
      expect(outcome.lowLevelFitCount).toBe(0);
    }
  });

  it('accepts inner validation rows with source split TRAIN', () => {
    const configuration = createValidConfiguration();
    const trainRows: MLBTrainingMatrixRow[] = [
      createTrainRow({ exampleId: 'train-1', targetValue: 1 }),
      createTrainRow({ exampleId: 'train-2', targetValue: 0 }),
    ];
    const validationRows: MLBTrainingMatrixRow[] = [
      createValidationRow({ exampleId: 'valid-1', targetValue: 1 }),
      createValidationRow({ exampleId: 'valid-2', targetValue: 0 }),
    ];

    const outcome = fitMLBInnerDevelopmentFold({
      configuration,
      trainRows,
      validationRows,
      foldId: 'fold-train-split',
      candidateRecipeId: 'recipe-train-split',
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.lowLevelFitCount).toBe(1);
      expect(outcome.value.predictions).toHaveLength(2);
      expect(outcome.value.predictions[0].exampleId).toBe('valid-1');
      expect(outcome.value.predictions[1].exampleId).toBe('valid-2');
    }
  });

  it('rejects outer VALIDATION rows in validationRows for TRAIN-only inner fitter', () => {
    const configuration = createValidConfiguration();
    const trainRows: MLBTrainingMatrixRow[] = [
      createTrainRow({ exampleId: 'train-1', targetValue: 1 }),
      createTrainRow({ exampleId: 'train-2', targetValue: 0 }),
    ];
    const validationRows: MLBTrainingMatrixRow[] = [
      createValidationRow({ exampleId: 'valid-1', targetValue: 1, split: 'VALIDATION' }),
      createValidationRow({ exampleId: 'valid-2', targetValue: 0, split: 'VALIDATION' }),
    ];

    const outcome = fitMLBInnerDevelopmentFold({
      configuration,
      trainRows,
      validationRows,
      foldId: 'fold-outer-val',
      candidateRecipeId: 'recipe-outer-val',
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(collectIssueCodes(outcome.issues)).toContain('INVALID_VALIDATION_ROWS');
      expect(outcome.issues.every(issue => issue.path.startsWith('$.validationRows'))).toBe(true);
      expect(outcome.lowLevelFitCount).toBe(0);
    }
  });

  it('rejects TEST rows in validationRows', () => {
    const configuration = createValidConfiguration();
    const trainRows: MLBTrainingMatrixRow[] = [
      createTrainRow({ exampleId: 'train-1', targetValue: 1 }),
      createTrainRow({ exampleId: 'train-2', targetValue: 0 }),
    ];
    const validationRows: MLBTrainingMatrixRow[] = [
      createValidationRow({ exampleId: 'test-1', targetValue: 1, split: 'TEST' }),
      createValidationRow({ exampleId: 'test-2', targetValue: 0, split: 'TEST' }),
    ];

    const outcome = fitMLBInnerDevelopmentFold({
      configuration,
      trainRows,
      validationRows,
      foldId: 'fold-test-split',
      candidateRecipeId: 'recipe-test-split',
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(collectIssueCodes(outcome.issues)).toContain('INVALID_VALIDATION_ROWS');
      expect(outcome.issues.every(issue => issue.path.startsWith('$.validationRows'))).toBe(true);
      expect(outcome.lowLevelFitCount).toBe(0);
    }
  });

  it('static assertions prove no outer fitter/test/fs/campaign references', async () => {
    const sourcePath = join(__dirname, '..', '..', '..', 'src', 'prediction', 'mlb', 'mlb-inner-development-fold-fitter.ts');
    const source = await readFile(sourcePath, 'utf8');

    expect(source).not.toContain('fitAndEvaluateMLBDeterministicLogisticRegression');
    expect(source).not.toContain('MLBModelEvaluationPlan');
    expect(source).not.toContain('buildMLBDeterministicModelEvaluationPlan');
    expect(source).not.toContain('TEST');
    expect(source).not.toContain('campaign');
    expect(source).not.toContain('node:fs');
    expect(source).not.toContain('node:path');
    expect(source).not.toContain('sportsbook');
    expect(source).not.toContain('odds');
  });
});
