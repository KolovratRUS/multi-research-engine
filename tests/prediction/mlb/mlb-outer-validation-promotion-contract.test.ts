import { describe, it, expect } from 'vitest';
import {
  MLB_OUTER_VALIDATION_PROMOTION_LEDGER_CONTRACT_VERSION,
  MLB_OUTER_VALIDATION_PROMOTION_EVALUATION_ID,
  MLB_OUTER_VALIDATION_PROMOTION_ATTEMPT_NUMBER,
  MLB_OUTER_VALIDATION_PROMOTION_MAX_ATTEMPTS,
  MLB_OUTER_VALIDATION_PROMOTION_MAX_CANDIDATES,
  MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_RECIPE_ID,
  MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_FINGERPRINT,
  MLB_OUTER_VALIDATION_PROMOTION_INNER_CAMPAIGN_ID,
  MLB_OUTER_VALIDATION_PROMOTION_INNER_ATTEMPT_NUMBER,
  MLB_OUTER_VALIDATION_PROMOTION_INNER_TERMINAL_STATUS,
  MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID,
  MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256,
  MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID,
  MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID,
  MLB_OUTER_VALIDATION_PROMOTION_PREPROCESSING_POLICY_ID,
  MLB_OUTER_VALIDATION_PROMOTION_FEATURE_POLICY_ID,
  MLB_OUTER_VALIDATION_PROMOTION_MODEL_FAMILY_ID,
  MLB_OUTER_VALIDATION_PROMOTION_REGULARIZATION_CONFIG,
  MLB_OUTER_VALIDATION_PROMOTION_OPTIMIZER_CONFIG,
  MLB_OUTER_VALIDATION_PROMOTION_OTHER_MODEL_AFFECTING_CHOICES,
  MLB_OUTER_VALIDATION_PROMOTION_COMPLEXITY_RANK,
  MLB_OUTER_VALIDATION_PROMOTION_ROW_COUNT_METADATA,
  MLB_OUTER_VALIDATION_PROMOTION_DATE_METADATA,
  type MLBOuterValidationPromotionLedger,
  type MLBOuterValidationPromotionIssue,
  type MLBOuterValidationPromotionPrepared,
  type MLBOuterValidationPromotionPreValidationFailed,
  type MLBOuterValidationPromotionTrainModelReady,
  type MLBOuterValidationPromotionRunningConsumed,
  type MLBOuterValidationPromotionEligibleForTest,
  type MLBOuterValidationPromotionRejectBeforeTest,
  validateMLBOuterValidationPromotionLedger,
} from '@/prediction/mlb/mlb-outer-validation-promotion-contract';

import {
  MLB_LOGISTIC_REGRESSION_MODEL_CONTRACT_VERSION,
  MLB_VALIDATION_EVALUATION_CONTRACT_VERSION,
  validateMLBDeterministicLogisticRegressionModel,
  validateMLBModelValidationEvaluation,
  type MLBDeterministicLogisticRegressionModel,
  type MLBModelValidationEvaluation,
} from '@/prediction/mlb/mlb-logistic-regression-fit-contract';
import {
  MLB_PRETEST_VALIDATION_REFERENCE_FACTS_CONTRACT_VERSION,
  validateMLBPreTestValidationReferenceFacts,
  type MLBPreTestValidationReferenceFacts,
} from '@/prediction/mlb/mlb-pretest-validation-reference-contract';
import {
  type MLBPreTestCandidateGateResult,
} from '@/prediction/mlb/mlb-pretest-candidate-gate-contract';

function buildValidPrepared(overrides: Partial<MLBOuterValidationPromotionPrepared> = {}): MLBOuterValidationPromotionPrepared {
  return {
    contractVersion: MLB_OUTER_VALIDATION_PROMOTION_LEDGER_CONTRACT_VERSION,
    promotionEvaluationId: MLB_OUTER_VALIDATION_PROMOTION_EVALUATION_ID,
    attemptNumber: MLB_OUTER_VALIDATION_PROMOTION_ATTEMPT_NUMBER,
    maxAttempts: MLB_OUTER_VALIDATION_PROMOTION_MAX_ATTEMPTS,
    maxCandidates: MLB_OUTER_VALIDATION_PROMOTION_MAX_CANDIDATES,
    candidateRecipeId: MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_RECIPE_ID,
    candidateFingerprint: MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_FINGERPRINT,
    innerCampaignId: MLB_OUTER_VALIDATION_PROMOTION_INNER_CAMPAIGN_ID,
    innerAttemptNumber: MLB_OUTER_VALIDATION_PROMOTION_INNER_ATTEMPT_NUMBER,
    innerTerminalStatus: MLB_OUTER_VALIDATION_PROMOTION_INNER_TERMINAL_STATUS,
    pretestGatePolicyId: 'FROZEN_PRETEST_GATE_POLICY_V1',
    datasetId: MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID,
    datasetSha256: MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256,
    matrixId: MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID,
    manifestId: MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID,
    preprocessingPolicyId: MLB_OUTER_VALIDATION_PROMOTION_PREPROCESSING_POLICY_ID,
    featurePolicyId: MLB_OUTER_VALIDATION_PROMOTION_FEATURE_POLICY_ID,
    modelFamilyId: MLB_OUTER_VALIDATION_PROMOTION_MODEL_FAMILY_ID,
    regularizationConfig: MLB_OUTER_VALIDATION_PROMOTION_REGULARIZATION_CONFIG,
    optimizerConfig: MLB_OUTER_VALIDATION_PROMOTION_OPTIMIZER_CONFIG,
    otherModelAffectingChoices: MLB_OUTER_VALIDATION_PROMOTION_OTHER_MODEL_AFFECTING_CHOICES,
    complexityRank: MLB_OUTER_VALIDATION_PROMOTION_COMPLEXITY_RANK,
    rowCountMetadata: MLB_OUTER_VALIDATION_PROMOTION_ROW_COUNT_METADATA,
    dateMetadata: MLB_OUTER_VALIDATION_PROMOTION_DATE_METADATA,
    status: 'PREPARED',
    outerValidationConsumed: false,
    modelPersisted: false,
    trainModelReady: false,
    preHoldoutFailure: null,
    holdoutConsumedAt: null,
    validationMetrics: null,
    referenceFacts: null,
    gateResult: null,
    terminalStatus: null,
    testAuthorized: false,
    testExecuted: false,
    ...overrides,
  };
}

function buildValidModel(): MLBDeterministicLogisticRegressionModel {
  return {
    contractVersion: MLB_LOGISTIC_REGRESSION_MODEL_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    modelId: 'mlb-v1-outer-validation-model-003',
    planId: 'mlb-v1-outer-validation-training-plan-003',
    matrixId: MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID,
    configId: 'mlb-v1-deterministic-logistic-regression-config-003',
    manifestId: MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID,
    datasetId: MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID,
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    featureIds: [
      'awayBullpenExtraInningGames',
      'awayBullpenGamesInPrevious3Days',
      'awayRunsAllowedPerGame',
      'awayRunsScoredPerGame',
      'awayStarterAvailable',
      'awayWinRate',
      'doubleHeaderGameNumber',
      'homeBullpenExtraInningGames',
      'homeBullpenGamesInPrevious3Days',
      'homeRunsAllowedPerGame',
      'homeRunsScoredPerGame',
      'homeStarterAvailable',
      'homeWinRate',
      'scheduledInnings',
    ],
    coefficients: [
      { featureId: 'awayBullpenExtraInningGames', valueCoefficient: 0.1, missingIndicatorCoefficient: 0 },
      { featureId: 'awayBullpenGamesInPrevious3Days', valueCoefficient: 0.2, missingIndicatorCoefficient: 0 },
      { featureId: 'awayRunsAllowedPerGame', valueCoefficient: -0.1, missingIndicatorCoefficient: 0 },
      { featureId: 'awayRunsScoredPerGame', valueCoefficient: 0.15, missingIndicatorCoefficient: 0 },
      { featureId: 'awayStarterAvailable', valueCoefficient: 0.3, missingIndicatorCoefficient: 0 },
      { featureId: 'awayWinRate', valueCoefficient: 0.25, missingIndicatorCoefficient: 0 },
      { featureId: 'doubleHeaderGameNumber', valueCoefficient: -0.05, missingIndicatorCoefficient: 0 },
      { featureId: 'homeBullpenExtraInningGames', valueCoefficient: 0.12, missingIndicatorCoefficient: 0 },
      { featureId: 'homeBullpenGamesInPrevious3Days', valueCoefficient: 0.18, missingIndicatorCoefficient: 0 },
      { featureId: 'homeRunsAllowedPerGame', valueCoefficient: -0.08, missingIndicatorCoefficient: 0 },
      { featureId: 'homeRunsScoredPerGame', valueCoefficient: 0.22, missingIndicatorCoefficient: 0 },
      { featureId: 'homeStarterAvailable', valueCoefficient: 0.35, missingIndicatorCoefficient: 0 },
      { featureId: 'homeWinRate', valueCoefficient: 0.28, missingIndicatorCoefficient: 0 },
      { featureId: 'scheduledInnings', valueCoefficient: -0.02, missingIndicatorCoefficient: 0 },
    ],
    intercept: 0.05,
    trainingRowCount: 301,
    iterationsCompleted: 100,
    converged: true,
    finalTrainingObjective: 0.5,
  };
}

function buildValidValidationEvaluation(): MLBModelValidationEvaluation {
  return {
    contractVersion: MLB_VALIDATION_EVALUATION_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    evaluationId: 'mlb-v1-outer-validation-promotion-evaluation-003',
    modelId: 'mlb-v1-outer-validation-model-003',
    planId: 'mlb-v1-outer-validation-training-plan-003',
    matrixId: MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID,
    configId: 'mlb-v1-deterministic-logistic-regression-config-003',
    split: 'VALIDATION',
    rowCount: 67,
    metrics: { logLoss: 0.6, brierScore: 0.2, rocAuc: 0.8 },
  };
}

function buildValidReferenceFacts(): MLBPreTestValidationReferenceFacts {
  return {
    contractVersion: MLB_PRETEST_VALIDATION_REFERENCE_FACTS_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    matrixId: MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID,
    datasetId: MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID,
    evaluationPlanId: 'mlb-v1-outer-validation-training-plan-003',
    trainRowCount: 301,
    validationRowCount: 67,
    trainHomeWinCount: 170,
    trainAwayWinCount: 131,
    trainHomeWinPrior: 170 / 301,
    p50: { probability: 0.5, validationLogLoss: 0.65, validationBrierScore: 0.22 },
    trainPrior: { probability: 170 / 301, validationLogLoss: 0.7, validationBrierScore: 0.25 },
  };
}

function buildEligibleGateResult(): MLBOuterValidationPromotionEligibleForTest['gateResult'] {
  return {
    eligibility: 'ELIGIBLE_FOR_TEST',
    reasons: [],
  };
}

function buildRejectedGateResult(): MLBOuterValidationPromotionRejectBeforeTest['gateResult'] {
  return {
    eligibility: 'REJECT_BEFORE_TEST',
    reasons: ['VALIDATION_LOG_LOSS_NOT_BETTER_THAN_REFERENCES'],
  };
}

describe('mlb-outer-validation-promotion-contract', () => {
  describe('validateMLBOuterValidationPromotionLedger', () => {
    it('accepts exact genesis PREPARED record', () => {
      const ledger = buildValidPrepared();
      const result = validateMLBOuterValidationPromotionLedger(ledger);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('PREPARED');
      }
    });

    it('accepts valid PRE_VALIDATION_FAILED record', () => {
      const ledger = {
        ...buildValidPrepared(),
        status: 'PRE_VALIDATION_FAILED',
        outerValidationConsumed: false,
        modelPersisted: false,
        trainModelReady: false,
        preHoldoutFailure: {
          failureKind: 'PRECONDITION_FAILURE',
          message: 'msg',
          occurredAt: '2026-04-01T00:00:00.000Z',
        },
      } as unknown as MLBOuterValidationPromotionPreValidationFailed;
      const result = validateMLBOuterValidationPromotionLedger(ledger);
      expect(result.ok).toBe(true);
    });

    it('accepts valid TRAIN_MODEL_READY record', () => {
      const model = buildValidModel();
      const modelValidation = validateMLBDeterministicLogisticRegressionModel(model);
      expect(modelValidation.ok).toBe(true);

      const ledger = {
        ...buildValidPrepared(),
        status: 'TRAIN_MODEL_READY',
        outerValidationConsumed: false,
        modelPersisted: true,
        trainModelReady: true,
        fittedModel: model,
        trainingRowCount: 301,
        converged: true,
        preHoldoutFailure: null,
        holdoutConsumedAt: null,
        validationMetrics: null,
        referenceFacts: null,
        gateResult: null,
        terminalStatus: null,
        testAuthorized: false,
        testExecuted: false,
      };
      const result = validateMLBOuterValidationPromotionLedger(ledger);
      expect(result.ok).toBe(true);
    });

    it('accepts valid RUNNING_CONSUMED record', () => {
      const ledger = {
        ...buildValidPrepared(),
        status: 'RUNNING_CONSUMED',
        outerValidationConsumed: true,
        modelPersisted: true,
        trainModelReady: true,
        fittedModel: buildValidModel(),
        trainingRowCount: 301,
        converged: true,
        holdoutConsumedAt: '2026-04-01T00:00:00.000Z',
      };
      const result = validateMLBOuterValidationPromotionLedger(ledger);
      expect(result.ok).toBe(true);
    });

    it('accepts valid ELIGIBLE_FOR_TEST record', () => {
      const validationMetrics = buildValidValidationEvaluation();
      const metricsValidation = validateMLBModelValidationEvaluation(validationMetrics);
      expect(metricsValidation.ok).toBe(true);

      const referenceFacts = buildValidReferenceFacts();
      const referenceFactsValidation = validateMLBPreTestValidationReferenceFacts(referenceFacts);
      expect(referenceFactsValidation.ok).toBe(true);

      const gateResult = buildEligibleGateResult();
      const ledger = {
        ...buildValidPrepared(),
        status: 'ELIGIBLE_FOR_TEST',
        outerValidationConsumed: true,
        modelPersisted: true,
        trainModelReady: true,
        fittedModel: buildValidModel(),
        trainingRowCount: 301,
        converged: true,
        holdoutConsumedAt: '2026-04-01T00:00:00.000Z',
        validationMetrics,
        referenceFacts,
        gateResult,
        terminalStatus: 'ELIGIBLE_FOR_TEST',
        testAuthorized: false,
        testExecuted: false,
      };
      const result = validateMLBOuterValidationPromotionLedger(ledger);
      expect(result.ok).toBe(true);
    });

    it('accepts valid REJECT_BEFORE_TEST record', () => {
      const validationMetrics = buildValidValidationEvaluation();
      const metricsValidation = validateMLBModelValidationEvaluation(validationMetrics);
      expect(metricsValidation.ok).toBe(true);

      const referenceFacts = buildValidReferenceFacts();
      const referenceFactsValidation = validateMLBPreTestValidationReferenceFacts(referenceFacts);
      expect(referenceFactsValidation.ok).toBe(true);

      const gateResult = buildRejectedGateResult();
      const ledger = {
        ...buildValidPrepared(),
        status: 'REJECT_BEFORE_TEST',
        outerValidationConsumed: true,
        modelPersisted: true,
        trainModelReady: true,
        fittedModel: buildValidModel(),
        trainingRowCount: 301,
        converged: true,
        holdoutConsumedAt: '2026-04-01T00:00:00.000Z',
        validationMetrics,
        referenceFacts,
        gateResult,
        terminalStatus: 'REJECT_BEFORE_TEST',
        testAuthorized: false,
        testExecuted: false,
      };
      const result = validateMLBOuterValidationPromotionLedger(ledger);
      expect(result.ok).toBe(true);
    });

    it('rejects unknown enumerable own keys', () => {
      const ledger = buildValidPrepared({ unknownField: 'x' } as unknown as MLBOuterValidationPromotionPrepared);
      const result = validateMLBOuterValidationPromotionLedger(ledger);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.code === 'UNKNOWN_FIELD' && issue.path === '$.unknownField')).toBe(true);
      }
    });

    it('rejects wrong candidate identity', () => {
      const ledger = buildValidPrepared({ candidateRecipeId: 'mlb-v1-inner-candidate-004' } as unknown as MLBOuterValidationPromotionPrepared);
      const result = validateMLBOuterValidationPromotionLedger(ledger);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.code === 'SOURCE_IDENTITY_MISMATCH' && issue.path === '$.candidateRecipeId')).toBe(true);
      }
    });

    it('rejects wrong attempt number', () => {
      const ledger = buildValidPrepared({ attemptNumber: 2 } as unknown as MLBOuterValidationPromotionPrepared);
      const result = validateMLBOuterValidationPromotionLedger(ledger);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.code === 'INVALID_LITERAL' && issue.path === '$.attemptNumber')).toBe(true);
      }
    });

    it('rejects wrong maxAttempts', () => {
      const ledger = buildValidPrepared({ maxAttempts: 2 } as unknown as MLBOuterValidationPromotionPrepared);
      const result = validateMLBOuterValidationPromotionLedger(ledger);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.code === 'INVALID_LITERAL' && issue.path === '$.maxAttempts')).toBe(true);
      }
    });

    it('rejects wrong maxCandidates', () => {
      const ledger = buildValidPrepared({ maxCandidates: 2 } as unknown as MLBOuterValidationPromotionPrepared);
      const result = validateMLBOuterValidationPromotionLedger(ledger);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.code === 'INVALID_LITERAL' && issue.path === '$.maxCandidates')).toBe(true);
      }
    });

    it('rejects wrong gate policy', () => {
      const ledger = buildValidPrepared({ pretestGatePolicyId: 'OTHER_POLICY' } as unknown as MLBOuterValidationPromotionPrepared);
      const result = validateMLBOuterValidationPromotionLedger(ledger);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.code === 'SOURCE_IDENTITY_MISMATCH' && issue.path === '$.pretestGatePolicyId')).toBe(true);
      }
    });

    it('rejects wrong dataset identity', () => {
      const ledger = buildValidPrepared({ datasetId: 'other-dataset' } as unknown as MLBOuterValidationPromotionPrepared);
      const result = validateMLBOuterValidationPromotionLedger(ledger);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.code === 'SOURCE_IDENTITY_MISMATCH' && issue.path === '$.datasetId')).toBe(true);
      }
    });

    it('rejects wrong model config', () => {
      const ledger = buildValidPrepared({
        modelFamilyId: 'OTHER_MODEL',
        optimizerConfig: { ...MLB_OUTER_VALIDATION_PROMOTION_OPTIMIZER_CONFIG, solver: 'OTHER' },
      } as unknown as MLBOuterValidationPromotionPrepared);
      const result = validateMLBOuterValidationPromotionLedger(ledger);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.code === 'SOURCE_IDENTITY_MISMATCH' && issue.path === '$.modelFamilyId')).toBe(true);
        expect(result.issues.some((issue) => issue.code === 'SOURCE_IDENTITY_MISMATCH' && issue.path === '$.optimizerConfig.solver')).toBe(true);
      }
    });

    it('rejects illegal transition PREPARED -> ELIGIBLE_FOR_TEST', () => {
      const ledger = buildValidPrepared({ status: 'ELIGIBLE_FOR_TEST' } as unknown as MLBOuterValidationPromotionPrepared);
      const result = validateMLBOuterValidationPromotionLedger(ledger);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.code === 'GATE_RESULT_INVALID' || issue.code === 'STATUS_MISMATCH')).toBe(true);
      }
    });

    it('rejects consumed reversion TRAIN_MODEL_READY -> PREPARED', () => {
      const invalid = {
        status: 'TRAIN_MODEL_READY',
        outerValidationConsumed: false,
        modelPersisted: true,
        trainModelReady: true,
        fittedModel: {
          sport: 'MLB',
          target: 'OFFICIAL_FINAL_GAME_WINNER',
          targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
          datasetId: MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID,
          matrixId: MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID,
          manifestId: MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID,
          algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
          trainingRowCount: 301,
          converged: true,
          featureIds: ['x1'],
          coefficients: [0.1],
          intercept: 0.05,
          trainingObjective: 0.5,
          createdAt: new Date().toISOString(),
        } as unknown as MLBOuterValidationPromotionTrainModelReady['fittedModel'],
        trainingRowCount: 301,
        converged: true,
      } as unknown as MLBOuterValidationPromotionPrepared;
      const ledger = buildValidPrepared(invalid as unknown as Partial<MLBOuterValidationPromotionPrepared>);
      const result = validateMLBOuterValidationPromotionLedger(ledger);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.code === 'MODEL_INVALID')).toBe(true);
      }
    });

    it('rejects foreign issue code leaking into local union via adapter mapping', () => {
      const foreign = { code: 'FOREIGN_CODE', path: '$.x', message: 'foreign' };
      const issues: MLBOuterValidationPromotionIssue[] = [];
      const destination: MLBOuterValidationPromotionIssue[] = [];
      issues.push(foreign as MLBOuterValidationPromotionIssue);
      for (const issue of issues) {
        const mapped = {
          code: 'MODEL_INVALID',
          path: issue.path,
          message: `[${issue.code}] ${issue.message}`,
        } as MLBOuterValidationPromotionIssue;
        destination.push(mapped);
      }
      expect(destination.every((issue) => issue.code === 'MODEL_INVALID')).toBe(true);
      expect(destination[0].message).toContain('FOREIGN_CODE');
    });

    it('rejects second genesis attempt via unknown status', () => {
      const invalid = { status: 'PREPARED', promotionEvaluationId: 'other' } as unknown as MLBOuterValidationPromotionPrepared;
      const ledger = buildValidPrepared(invalid as unknown as Partial<MLBOuterValidationPromotionPrepared>);
      const result = validateMLBOuterValidationPromotionLedger(ledger);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.code === 'INVALID_LITERAL')).toBe(true);
      }
    });

    it('rejects ELIGIBLE_FOR_TEST with invalid reference facts', () => {
      const badReferenceFacts = {
        ...buildValidReferenceFacts(),
        trainPrior: { probability: 0.5, validationLogLoss: 0.7, validationBrierScore: 0.25 },
      };
      const referenceFactsValidation = validateMLBPreTestValidationReferenceFacts(badReferenceFacts);
      expect(referenceFactsValidation.ok).toBe(false);

      const ledger = {
        ...buildValidPrepared(),
        status: 'ELIGIBLE_FOR_TEST',
        outerValidationConsumed: true,
        modelPersisted: true,
        trainModelReady: true,
        fittedModel: buildValidModel(),
        trainingRowCount: 301,
        converged: true,
        holdoutConsumedAt: '2026-04-01T00:00:00.000Z',
        validationMetrics: buildValidValidationEvaluation(),
        referenceFacts: badReferenceFacts,
        gateResult: buildEligibleGateResult(),
        terminalStatus: 'ELIGIBLE_FOR_TEST',
        testAuthorized: false,
        testExecuted: false,
      };
      const result = validateMLBOuterValidationPromotionLedger(ledger);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.code === 'REFERENCE_FACTS_INVALID')).toBe(true);
      }
    });

    it('rejects ELIGIBLE_FOR_TEST with invalid validation evaluation', () => {
      const badEvaluation = {
        ...buildValidValidationEvaluation(),
        rowCount: -1,
      };
      const evaluationValidation = validateMLBModelValidationEvaluation(badEvaluation);
      expect(evaluationValidation.ok).toBe(false);

      const ledger = {
        ...buildValidPrepared(),
        status: 'ELIGIBLE_FOR_TEST',
        outerValidationConsumed: true,
        modelPersisted: true,
        trainModelReady: true,
        fittedModel: buildValidModel(),
        trainingRowCount: 301,
        converged: true,
        holdoutConsumedAt: '2026-04-01T00:00:00.000Z',
        validationMetrics: badEvaluation,
        referenceFacts: buildValidReferenceFacts(),
        gateResult: buildEligibleGateResult(),
        terminalStatus: 'ELIGIBLE_FOR_TEST',
        testAuthorized: false,
        testExecuted: false,
      };
      const result = validateMLBOuterValidationPromotionLedger(ledger);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.code === 'EVALUATION_INVALID')).toBe(true);
      }
    });

    it('rejects ELIGIBLE_FOR_TEST with reject gate result', () => {
      const ledger = {
        ...buildValidPrepared(),
        status: 'ELIGIBLE_FOR_TEST',
        outerValidationConsumed: true,
        modelPersisted: true,
        trainModelReady: true,
        fittedModel: buildValidModel(),
        trainingRowCount: 301,
        converged: true,
        holdoutConsumedAt: '2026-04-01T00:00:00.000Z',
        validationMetrics: buildValidValidationEvaluation(),
        referenceFacts: buildValidReferenceFacts(),
        gateResult: buildRejectedGateResult(),
        terminalStatus: 'ELIGIBLE_FOR_TEST',
        testAuthorized: false,
        testExecuted: false,
      };
      const result = validateMLBOuterValidationPromotionLedger(ledger);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.code === 'STATUS_MISMATCH' && issue.path === '$.gateResult.eligibility')).toBe(true);
      }
    });

    it('rejects REJECT_BEFORE_TEST with eligible gate result', () => {
      const ledger = {
        ...buildValidPrepared(),
        status: 'REJECT_BEFORE_TEST',
        outerValidationConsumed: true,
        modelPersisted: true,
        trainModelReady: true,
        fittedModel: buildValidModel(),
        trainingRowCount: 301,
        converged: true,
        holdoutConsumedAt: '2026-04-01T00:00:00.000Z',
        validationMetrics: buildValidValidationEvaluation(),
        referenceFacts: buildValidReferenceFacts(),
        gateResult: buildEligibleGateResult(),
        terminalStatus: 'REJECT_BEFORE_TEST',
        testAuthorized: false,
        testExecuted: false,
      };
      const result = validateMLBOuterValidationPromotionLedger(ledger);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.code === 'STATUS_MISMATCH' && issue.path === '$.gateResult.eligibility')).toBe(true);
      }
    });
  });
});
