import { afterEach, describe, expect, it } from 'vitest';
import {
  MLB_PRETEST_GATE_POLICY_ID,
  evaluateMLBPretestCandidateGate,
} from '@/prediction/mlb/mlb-pretest-candidate-gate-contract';
import {
  type MLBModelEvaluationPlan,
  validateMLBModelEvaluationPlan,
} from '@/prediction/mlb/mlb-model-training-plan-contract';
import {
  buildMLBPreTestValidationReferenceFacts,
  type MLBPreTestValidationReferenceFacts,
  validateMLBPreTestValidationReferenceFacts,
} from '@/prediction/mlb/mlb-pretest-validation-reference-contract';
import {
  type MLBDeterministicLogisticRegressionModel,
  type MLBModelFitValidationResult,
  type MLBModelValidationEvaluation,
  validateMLBModelFitValidationResult,
} from '@/prediction/mlb/mlb-logistic-regression-fit-contract';
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
    splitCounts: { train: 2, validation: 2, test: 4 },
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

function createValidFitResult(
  overrides: Partial<MLBModelFitValidationResult> = {},
): MLBModelFitValidationResult {
  const baseValidation: MLBModelValidationEvaluation = {
    contractVersion: 'mlb-model-validation-evaluation-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    evaluationId: 'eval-1',
    modelId: 'model-1',
    planId: 'matrix-1::config-1',
    matrixId: 'matrix-1',
    configId: 'config-1',
    split: 'VALIDATION',
    rowCount: 2,
    metrics: { logLoss: 0.3, brierScore: 0.2, rocAuc: 0.8 },
  };

  return {
    contractVersion: 'mlb-model-fit-validation-result-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    resultId: 'fit-1',
    model: {
      contractVersion: 'mlb-deterministic-logistic-regression-model-v1',
      sport: 'MLB',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
      modelId: 'model-1',
      planId: 'matrix-1::config-1',
      matrixId: 'matrix-1',
      configId: 'config-1',
      manifestId: 'manifest-1',
      datasetId: 'dataset-1',
      algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
      featureIds: ['p_1', 'p_2'],
      trainingRowCount: 4,
      iterationsCompleted: 100,
      converged: true,
      finalTrainingObjective: 0.5,
      intercept: 0.1,
      coefficients: [
        { featureId: 'p_1', valueCoefficient: 0.2, missingIndicatorCoefficient: 0.0 },
        { featureId: 'p_2', valueCoefficient: -0.1, missingIndicatorCoefficient: 0.0 },
      ],
      ...overrides.model,
    },
    validation: {
      ...baseValidation,
      ...overrides.validation,
    },
    ...overrides,
  };
}

describe('mlb-pretest-candidate-gate-contract', () => {
  const validPlan = createValidPlan();
  const reference = buildReference(
    [createTrainRow('t1', 1), createTrainRow('t2', 0)],
    [createValidationRow('v1', 1), createValidationRow('v2', 0)],
    validPlan,
  );

  const validFit = createValidFitResult();

  it('valid converged candidate beating BOTH references on logLoss AND Brier -> ELIGIBLE_FOR_TEST', () => {
    const fit = createValidFitResult({
      model: { ...validFit.model, converged: true },
      validation: {
        ...validFit.validation,
        metrics: { logLoss: 0.1, brierScore: 0.1, rocAuc: 0.9 },
      },
    });
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('ELIGIBLE_FOR_TEST');
    expect(result.reasons).toEqual([]);
  });

  it('non-converged -> REJECT_BEFORE_TEST / NOT_CONVERGED', () => {
    const fit = createValidFitResult({
      model: { ...validFit.model, converged: false },
    });
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['NOT_CONVERGED']);
  });

  it('invalid fit contract -> INVALID_FIT_RESULT', () => {
    const result = evaluateMLBPretestCandidateGate(null as unknown, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['INVALID_FIT_RESULT']);
  });

  it('invalid evaluation plan -> INVALID_EVALUATION_PLAN', () => {
    const result = evaluateMLBPretestCandidateGate(validFit, null as unknown, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['INVALID_EVALUATION_PLAN']);
  });

  it('invalid reference facts -> INVALID_REFERENCE_FACTS', () => {
    const result = evaluateMLBPretestCandidateGate(validFit, validPlan, null as unknown);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['INVALID_REFERENCE_FACTS']);
  });

  it('fit/plan identity mismatch -> IDENTITY_MISMATCH', () => {
    const fit = createValidFitResult({
      model: { ...validFit.model, planId: 'other-plan' },
    });
    expect(validateMLBModelFitValidationResult(fit).ok).toBe(true);
    expect(validateMLBModelEvaluationPlan(validPlan).ok).toBe(true);
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['IDENTITY_MISMATCH']);
  });

  it('reference facts/plan identity mismatch -> IDENTITY_MISMATCH', () => {
    const badReference = { ...reference, evaluationPlanId: 'other-plan' } as MLBPreTestValidationReferenceFacts;
    expect(validateMLBPreTestValidationReferenceFacts(badReference).ok).toBe(true);
    expect(validateMLBModelEvaluationPlan(validPlan).ok).toBe(true);
    const result = evaluateMLBPretestCandidateGate(validFit, validPlan, badReference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['IDENTITY_MISMATCH']);
  });

  it('model manifestId mismatch -> IDENTITY_MISMATCH', () => {
    const fit = createValidFitResult({
      model: { ...validFit.model, manifestId: 'other-manifest' },
    });
    expect(validateMLBModelFitValidationResult(fit).ok).toBe(true);
    expect(validateMLBModelEvaluationPlan(validPlan).ok).toBe(true);
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['IDENTITY_MISMATCH']);
  });

  it('model matrixId mismatch -> IDENTITY_MISMATCH', () => {
    const fit = createValidFitResult({
      model: { ...validFit.model, matrixId: 'other-matrix' },
    });
    expect(validateMLBModelFitValidationResult(fit).ok).toBe(true);
    expect(validateMLBModelEvaluationPlan(validPlan).ok).toBe(true);
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['IDENTITY_MISMATCH']);
  });

  it('model configId mismatch -> IDENTITY_MISMATCH', () => {
    const fit = createValidFitResult({
      model: { ...validFit.model, configId: 'other-config' },
    });
    expect(validateMLBModelFitValidationResult(fit).ok).toBe(true);
    expect(validateMLBModelEvaluationPlan(validPlan).ok).toBe(true);
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['IDENTITY_MISMATCH']);
  });

  it('model datasetId mismatch -> IDENTITY_MISMATCH', () => {
    const fit = createValidFitResult({
      model: { ...validFit.model, datasetId: 'other-dataset' },
    });
    expect(validateMLBModelFitValidationResult(fit).ok).toBe(true);
    expect(validateMLBModelEvaluationPlan(validPlan).ok).toBe(true);
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['IDENTITY_MISMATCH']);
  });

  it('different valid featureIds -> IDENTITY_MISMATCH', () => {
    const fit = createValidFitResult({
      model: {
        ...validFit.model,
        featureIds: ['p_1', 'p_3'],
        coefficients: [
          { featureId: 'p_1', valueCoefficient: 0.2, missingIndicatorCoefficient: 0.0 },
          { featureId: 'p_3', valueCoefficient: -0.1, missingIndicatorCoefficient: 0.0 },
        ],
      },
    });
    const badPlan = {
      ...validPlan,
      featureIds: ['p_1', 'p_2'],
    };
    expect(validateMLBModelFitValidationResult(fit).ok).toBe(true);
    expect(validateMLBModelEvaluationPlan(badPlan).ok).toBe(true);
    const result = evaluateMLBPretestCandidateGate(fit, badPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['IDENTITY_MISMATCH']);
  });

  it('algorithm valid-artifact mismatch is structurally unreachable through authoritative validators', () => {
    const fit = createValidFitResult({
      model: { ...validFit.model, algorithm: 'OTHER_ALGO' as MLBDeterministicLogisticRegressionModel['algorithm'] },
    });
    expect(validateMLBModelFitValidationResult(fit).ok).toBe(false);
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['INVALID_FIT_RESULT']);
  });

  it('same feature IDs different order is structurally unreachable through evaluation-plan validation', () => {
    const badPlan = {
      ...validPlan,
      featureIds: ['p_2', 'p_1'],
    };
    expect(validateMLBModelEvaluationPlan(badPlan).ok).toBe(false);
    const result = evaluateMLBPretestCandidateGate(validFit, badPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['INVALID_EVALUATION_PLAN']);
  });

  it('validation row count mismatch -> ROW_COUNT_MISMATCH', () => {
    const fit = createValidFitResult({
      validation: { ...validFit.validation, rowCount: 99 },
    });
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['ROW_COUNT_MISMATCH']);
  });

  it('TRAIN reference row count mismatch -> ROW_COUNT_MISMATCH where applicable', () => {
    const mismatchPlan = {
      ...validPlan,
      splitCounts: { ...validPlan.splitCounts, train: 3 },
      totalRows: 9,
    };
    const mismatchReference = buildReference(
      [createTrainRow('t1', 1), createTrainRow('t2', 0), createTrainRow('t3', 1)],
      [createValidationRow('v1', 1), createValidationRow('v2', 0)],
      mismatchPlan,
    );
    const result = evaluateMLBPretestCandidateGate(validFit, validPlan, mismatchReference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['ROW_COUNT_MISMATCH']);
  });

  it('nonfinite model value -> INVALID_FIT_RESULT (validator rejects non-finite)', () => {
    const fit = createValidFitResult({
      model: { ...validFit.model, intercept: Number.NaN },
    });
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['INVALID_FIT_RESULT']);
  });

  it('nonfinite candidate validation logLoss -> INVALID_FIT_RESULT (validator rejects non-finite)', () => {
    const fit = createValidFitResult({
      validation: { ...validFit.validation, metrics: { ...validFit.validation.metrics, logLoss: Number.NaN } },
    });
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['INVALID_FIT_RESULT']);
  });

  it('nonfinite candidate validation Brier -> INVALID_FIT_RESULT (validator rejects non-finite)', () => {
    const fit = createValidFitResult({
      validation: { ...validFit.validation, metrics: { ...validFit.validation.metrics, brierScore: Number.NaN } },
    });
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['INVALID_FIT_RESULT']);
  });

  it('nonfinite candidate ROC AUC -> INVALID_FIT_RESULT (validator rejects non-finite)', () => {
    const fit = createValidFitResult({
      validation: { ...validFit.validation, metrics: { ...validFit.validation.metrics, rocAuc: Number.NaN } },
    });
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['INVALID_FIT_RESULT']);
  });

  it('nonfinite valueCoefficient -> INVALID_FIT_RESULT (validator rejects non-finite)', () => {
    const fit = createValidFitResult({
      model: {
        ...validFit.model,
        coefficients: [
          { featureId: 'p_1', valueCoefficient: Number.NaN, missingIndicatorCoefficient: 0.0 },
        ],
      },
    });
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['INVALID_FIT_RESULT']);
  });

  it('nonfinite missingIndicatorCoefficient -> INVALID_FIT_RESULT (validator rejects non-finite)', () => {
    const fit = createValidFitResult({
      model: {
        ...validFit.model,
        coefficients: [
          { featureId: 'p_1', valueCoefficient: 0.2, missingIndicatorCoefficient: Number.NaN },
        ],
      },
    });
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['INVALID_FIT_RESULT']);
  });

  it('nonfinite finalTrainingObjective -> INVALID_FIT_RESULT (validator rejects non-finite)', () => {
    const fit = createValidFitResult({
      model: { ...validFit.model, finalTrainingObjective: Number.NaN },
    });
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['INVALID_FIT_RESULT']);
  });

  it('logLoss beats references but Brier does not -> reject with Brier reason', () => {
    const fit = createValidFitResult({
      validation: { ...validFit.validation, metrics: { logLoss: 0.1, brierScore: 0.8, rocAuc: 0.9 } },
    });
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['VALIDATION_BRIER_NOT_BETTER_THAN_REFERENCES']);
  });

  it('Brier beats references but logLoss does not -> reject with logLoss reason', () => {
    const fit = createValidFitResult({
      validation: { ...validFit.validation, metrics: { logLoss: 0.8, brierScore: 0.1, rocAuc: 0.9 } },
    });
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['VALIDATION_LOG_LOSS_NOT_BETTER_THAN_REFERENCES']);
  });

  it('both performance metrics fail -> both performance reasons in deterministic order', () => {
    const fit = createValidFitResult({
      validation: { ...validFit.validation, metrics: { logLoss: 0.8, brierScore: 0.8, rocAuc: 0.9 } },
    });
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual([
      'VALIDATION_LOG_LOSS_NOT_BETTER_THAN_REFERENCES',
      'VALIDATION_BRIER_NOT_BETTER_THAN_REFERENCES',
    ]);
  });

  it('exact tie with P50 logLoss -> reject', () => {
    const fit = createValidFitResult({
      validation: {
        ...validFit.validation,
        metrics: { logLoss: reference.p50.validationLogLoss, brierScore: 0.1, rocAuc: 0.9 },
      },
    });
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['VALIDATION_LOG_LOSS_NOT_BETTER_THAN_REFERENCES']);
  });

  it('exact tie with TRAIN-prior logLoss -> reject', () => {
    const fit = createValidFitResult({
      validation: {
        ...validFit.validation,
        metrics: { logLoss: reference.trainPrior.validationLogLoss, brierScore: 0.1, rocAuc: 0.9 },
      },
    });
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['VALIDATION_LOG_LOSS_NOT_BETTER_THAN_REFERENCES']);
  });

  it('exact tie with P50 Brier -> reject', () => {
    const fit = createValidFitResult({
      validation: {
        ...validFit.validation,
        metrics: { logLoss: 0.1, brierScore: reference.p50.validationBrierScore, rocAuc: 0.9 },
      },
    });
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['VALIDATION_BRIER_NOT_BETTER_THAN_REFERENCES']);
  });

  it('exact tie with TRAIN-prior Brier -> reject', () => {
    const fit = createValidFitResult({
      validation: {
        ...validFit.validation,
        metrics: { logLoss: 0.1, brierScore: reference.trainPrior.validationBrierScore, rocAuc: 0.9 },
      },
    });
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['VALIDATION_BRIER_NOT_BETTER_THAN_REFERENCES']);
  });

  it('ROC AUC below 0.5 but finite does not itself reject an otherwise passing candidate', () => {
    const fit = createValidFitResult({
      validation: { ...validFit.validation, metrics: { logLoss: 0.1, brierScore: 0.1, rocAuc: 0.3 } },
    });
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('ELIGIBLE_FOR_TEST');
  });

  it('ROC AUC above 0.5 but finite does not rescue a failing candidate', () => {
    const fit = createValidFitResult({
      validation: { ...validFit.validation, metrics: { logLoss: 0.8, brierScore: 0.8, rocAuc: 0.9 } },
    });
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual([
      'VALIDATION_LOG_LOSS_NOT_BETTER_THAN_REFERENCES',
      'VALIDATION_BRIER_NOT_BETTER_THAN_REFERENCES',
    ]);
  });

  it('multiple structural failures emit all safely determinable reasons in frozen ordering', () => {
    const fit = createValidFitResult({
      model: { ...validFit.model, converged: false, intercept: Number.NaN },
      validation: { ...validFit.validation, metrics: { logLoss: Number.NaN, brierScore: 0.8, rocAuc: 0.9 } },
    });
    const result = evaluateMLBPretestCandidateGate(fit, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual([
      'INVALID_FIT_RESULT',
    ]);
  });

  it('invalid outer contract does not cause unsafe nested-field access', () => {
    const result = evaluateMLBPretestCandidateGate(
      null as unknown,
      null as unknown,
      null as unknown,
    );
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual([
      'INVALID_FIT_RESULT',
      'INVALID_EVALUATION_PLAN',
      'INVALID_REFERENCE_FACTS',
    ]);
  });

  it('repeated identical evaluation deeply equals previous output', () => {
    const a = evaluateMLBPretestCandidateGate(validFit, validPlan, reference);
    const b = evaluateMLBPretestCandidateGate(validFit, validPlan, reference);
    expect(a).toEqual(b);
  });

  it('first-real-candidate-shaped non-converged fixture is rejected before TEST without calling release', () => {
    const firstCandidate = createValidFitResult({
      model: {
        ...validFit.model,
        converged: false,
        iterationsCompleted: 1000,
        finalTrainingObjective: 1.8064154994833674,
        intercept: 0.0,
        coefficients: [
          { featureId: 'p_1', valueCoefficient: 0.0, missingIndicatorCoefficient: 0.0 },
          { featureId: 'p_2', valueCoefficient: 0.0, missingIndicatorCoefficient: 0.0 },
        ],
      },
      validation: {
        ...validFit.validation,
        metrics: { logLoss: 2.208008731286957, brierScore: 0.47098992693001585, rocAuc: 0.5017825311942959 },
      },
    });
    const result = evaluateMLBPretestCandidateGate(firstCandidate, validPlan, reference);
    expect(result.eligibility).toBe('REJECT_BEFORE_TEST');
    expect(result.reasons).toEqual(['NOT_CONVERGED', 'VALIDATION_LOG_LOSS_NOT_BETTER_THAN_REFERENCES', 'VALIDATION_BRIER_NOT_BETTER_THAN_REFERENCES']);
  });
});
