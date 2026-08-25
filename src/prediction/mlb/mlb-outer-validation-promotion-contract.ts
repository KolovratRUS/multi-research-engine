import {
  type MLBDeterministicLogisticRegressionModel,
  type MLBModelValidationEvaluation,
  validateMLBDeterministicLogisticRegressionModel,
  validateMLBModelValidationEvaluation,
} from './mlb-logistic-regression-fit-contract';
import {
  MLB_PRETEST_GATE_POLICY_ID,
  type MLBPreTestValidationReferenceFacts,
  validateMLBPreTestValidationReferenceFacts,
} from './mlb-pretest-validation-reference-contract';
import {
  type MLBPreTestCandidateGateResult,
} from './mlb-pretest-candidate-gate-contract';

/* -------------------------------------------------------------------------- */
/*  Contract version + identity                                                 */
/* -------------------------------------------------------------------------- */

export const MLB_OUTER_VALIDATION_PROMOTION_LEDGER_CONTRACT_VERSION =
  'mlb-outer-validation-promotion-ledger-v1' as const;

export const MLB_OUTER_VALIDATION_PROMOTION_DIRECTORY =
  'var/mlb-development/mlb-outer-validation-promotion-ledger/' as const;

export const MLB_OUTER_VALIDATION_PROMOTION_FILENAME =
  'mlb-v1-outer-validation-promotion-ledger.json' as const;

export const MLB_OUTER_VALIDATION_PROMOTION_MAX_ATTEMPTS = 1 as const;
export const MLB_OUTER_VALIDATION_PROMOTION_MAX_CANDIDATES = 1 as const;

export const MLB_OUTER_VALIDATION_PROMOTION_ATTEMPT_NUMBER = 1 as const;
export const MLB_OUTER_VALIDATION_PROMOTION_INNER_ATTEMPT_NUMBER = 1 as const;

export const MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_RECIPE_ID =
  'mlb-v1-inner-candidate-003' as const;

export const MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_FINGERPRINT =
  'ce35df51cdf38ed9bf91aa2fb78871443f259c963d8c2700e8b6fe5d960a95bc' as const;

export const MLB_OUTER_VALIDATION_PROMOTION_INNER_CAMPAIGN_ID =
  'mlb-v1-train-only-inner-development-cycle-v1' as const;

export const MLB_OUTER_VALIDATION_PROMOTION_INNER_TERMINAL_STATUS =
  'COMPLETED_INNER_ELIGIBLE' as const;

export const MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID =
  'mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360' as const;

export const MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256 =
  'e6730f3b9f8e5b0e32958e1997ff804f1b66cb9c323cc992a55a9d8882d742a7' as const;

export const MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID =
  'mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360::mlb-real-pregame-winner-feature-manifest-v1' as const;

export const MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID =
  'mlb-real-pregame-winner-feature-manifest-v1' as const;

export const MLB_OUTER_VALIDATION_PROMOTION_PREPROCESSING_POLICY_ID =
  'raw-finite-feature-values-with-default-missing-v1' as const;

export const MLB_OUTER_VALIDATION_PROMOTION_FEATURE_POLICY_ID =
  'mlb-real-pregame-winner-feature-policy-v1' as const;

export const MLB_OUTER_VALIDATION_PROMOTION_MODEL_FAMILY_ID =
  'L2_LOGISTIC_REGRESSION_BINARY_V1' as const;

export const MLB_OUTER_VALIDATION_PROMOTION_REGULARIZATION_CONFIG = Object.freeze({
  kind: 'L2',
  strength: 0.1,
});

export const MLB_OUTER_VALIDATION_PROMOTION_OPTIMIZER_CONFIG = Object.freeze({
  solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
  learningRate: 0.01,
  maxIterations: 5000,
  tolerance: 0.0001,
});

export const MLB_OUTER_VALIDATION_PROMOTION_OTHER_MODEL_AFFECTING_CHOICES =
  Object.freeze({});

export const MLB_OUTER_VALIDATION_PROMOTION_COMPLEXITY_RANK = 1 as const;

export const MLB_OUTER_VALIDATION_PROMOTION_ROW_COUNT_METADATA = Object.freeze({
  outerTrainRowCount: 301,
  validationRowCount: 67,
  testRowCount: 69,
});

export const MLB_OUTER_VALIDATION_PROMOTION_DATE_METADATA = Object.freeze({
  trainStart: '2026-04-01',
  trainEnd: '2026-04-23',
  validationStart: '2026-04-24',
  validationEnd: '2026-04-28',
  testStart: '2026-04-29',
  testEnd: '2026-05-03',
});

export const MLB_OUTER_VALIDATION_PROMOTION_TRAIN_DATE_START = '2026-04-01' as const;
export const MLB_OUTER_VALIDATION_PROMOTION_TRAIN_DATE_END = '2026-04-23' as const;
export const MLB_OUTER_VALIDATION_PROMOTION_VALIDATION_DATE_START = '2026-04-24' as const;
export const MLB_OUTER_VALIDATION_PROMOTION_VALIDATION_DATE_END = '2026-04-28' as const;
export const MLB_OUTER_VALIDATION_PROMOTION_TEST_DATE_START = '2026-04-29' as const;
export const MLB_OUTER_VALIDATION_PROMOTION_TEST_DATE_END = '2026-05-03' as const;

export const MLB_OUTER_VALIDATION_PROMOTION_EVALUATION_ID =
  'mlb-v1-outer-validation-promotion-evaluation-003' as const;

/* -------------------------------------------------------------------------- */
/*  Statuses                                                                    */
/* -------------------------------------------------------------------------- */

export const MLB_OUTER_VALIDATION_PROMOTION_STATUSES = [
  'PREPARED',
  'PRE_VALIDATION_FAILED',
  'TRAIN_MODEL_READY',
  'RUNNING_CONSUMED',
  'ELIGIBLE_FOR_TEST',
  'REJECT_BEFORE_TEST',
] as const;

export type MLBOuterValidationPromotionStatus =
  (typeof MLB_OUTER_VALIDATION_PROMOTION_STATUSES)[number];

/* -------------------------------------------------------------------------- */
/*  Failure kinds                                                               */
/* -------------------------------------------------------------------------- */

export const MLB_OUTER_VALIDATION_PROMOTION_PRE_HOLDOUT_FAILURE_KINDS = [
  'PRECONDITION_FAILURE',
  'TRAIN_SOURCE_INTEGRITY_FAILURE',
  'TRAIN_FIT_THROW',
  'TRAIN_NONCONVERGENCE',
  'MODEL_VALIDATION_FAILURE',
  'MODEL_PERSISTENCE_FAILURE',
] as const;

export type MLBOuterValidationPromotionPreHoldoutFailureKind =
  (typeof MLB_OUTER_VALIDATION_PROMOTION_PRE_HOLDOUT_FAILURE_KINDS)[number];

export type MLBOuterValidationPromotionPreHoldoutFailure = Readonly<{
  failureKind: MLBOuterValidationPromotionPreHoldoutFailureKind;
  message: string;
  occurredAt: string;
}>;

/* -------------------------------------------------------------------------- */
/*  Durable state shapes                                                        */
/* -------------------------------------------------------------------------- */

export type MLBOuterValidationPromotionRowCountMetadata = Readonly<{
  outerTrainRowCount: 301;
  validationRowCount: 67;
  testRowCount: 69;
}>;

export type MLBOuterValidationPromotionDateMetadata = Readonly<{
  trainStart: '2026-04-01';
  trainEnd: '2026-04-23';
  validationStart: '2026-04-24';
  validationEnd: '2026-04-28';
  testStart: '2026-04-29';
  testEnd: '2026-05-03';
}>;

export type MLBOuterValidationPromotionSharedGenesis = Readonly<{
  contractVersion: typeof MLB_OUTER_VALIDATION_PROMOTION_LEDGER_CONTRACT_VERSION;
  promotionEvaluationId: typeof MLB_OUTER_VALIDATION_PROMOTION_EVALUATION_ID;
  attemptNumber: typeof MLB_OUTER_VALIDATION_PROMOTION_ATTEMPT_NUMBER;
  maxAttempts: typeof MLB_OUTER_VALIDATION_PROMOTION_MAX_ATTEMPTS;
  maxCandidates: typeof MLB_OUTER_VALIDATION_PROMOTION_MAX_CANDIDATES;
  candidateRecipeId: typeof MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_RECIPE_ID;
  candidateFingerprint: typeof MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_FINGERPRINT;
  innerCampaignId: typeof MLB_OUTER_VALIDATION_PROMOTION_INNER_CAMPAIGN_ID;
  innerAttemptNumber: typeof MLB_OUTER_VALIDATION_PROMOTION_INNER_ATTEMPT_NUMBER;
  innerTerminalStatus: typeof MLB_OUTER_VALIDATION_PROMOTION_INNER_TERMINAL_STATUS;
  pretestGatePolicyId: typeof MLB_PRETEST_GATE_POLICY_ID;
  datasetId: typeof MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID;
  datasetSha256: typeof MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256;
  matrixId: typeof MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID;
  manifestId: typeof MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID;
  preprocessingPolicyId: typeof MLB_OUTER_VALIDATION_PROMOTION_PREPROCESSING_POLICY_ID;
  featurePolicyId: typeof MLB_OUTER_VALIDATION_PROMOTION_FEATURE_POLICY_ID;
  modelFamilyId: typeof MLB_OUTER_VALIDATION_PROMOTION_MODEL_FAMILY_ID;
  regularizationConfig: typeof MLB_OUTER_VALIDATION_PROMOTION_REGULARIZATION_CONFIG;
  optimizerConfig: typeof MLB_OUTER_VALIDATION_PROMOTION_OPTIMIZER_CONFIG;
  otherModelAffectingChoices: typeof MLB_OUTER_VALIDATION_PROMOTION_OTHER_MODEL_AFFECTING_CHOICES;
  complexityRank: typeof MLB_OUTER_VALIDATION_PROMOTION_COMPLEXITY_RANK;
  rowCountMetadata: MLBOuterValidationPromotionRowCountMetadata;
  dateMetadata: MLBOuterValidationPromotionDateMetadata;
}>;

export type MLBOuterValidationPromotionPrepared = Readonly<{
  contractVersion: typeof MLB_OUTER_VALIDATION_PROMOTION_LEDGER_CONTRACT_VERSION;
  promotionEvaluationId: typeof MLB_OUTER_VALIDATION_PROMOTION_EVALUATION_ID;
  attemptNumber: typeof MLB_OUTER_VALIDATION_PROMOTION_ATTEMPT_NUMBER;
  maxAttempts: typeof MLB_OUTER_VALIDATION_PROMOTION_MAX_ATTEMPTS;
  maxCandidates: typeof MLB_OUTER_VALIDATION_PROMOTION_MAX_CANDIDATES;
  candidateRecipeId: typeof MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_RECIPE_ID;
  candidateFingerprint: typeof MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_FINGERPRINT;
  innerCampaignId: typeof MLB_OUTER_VALIDATION_PROMOTION_INNER_CAMPAIGN_ID;
  innerAttemptNumber: typeof MLB_OUTER_VALIDATION_PROMOTION_INNER_ATTEMPT_NUMBER;
  innerTerminalStatus: typeof MLB_OUTER_VALIDATION_PROMOTION_INNER_TERMINAL_STATUS;
  pretestGatePolicyId: typeof MLB_PRETEST_GATE_POLICY_ID;
  datasetId: typeof MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID;
  datasetSha256: typeof MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256;
  matrixId: typeof MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID;
  manifestId: typeof MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID;
  preprocessingPolicyId: typeof MLB_OUTER_VALIDATION_PROMOTION_PREPROCESSING_POLICY_ID;
  featurePolicyId: typeof MLB_OUTER_VALIDATION_PROMOTION_FEATURE_POLICY_ID;
  modelFamilyId: typeof MLB_OUTER_VALIDATION_PROMOTION_MODEL_FAMILY_ID;
  regularizationConfig: typeof MLB_OUTER_VALIDATION_PROMOTION_REGULARIZATION_CONFIG;
  optimizerConfig: typeof MLB_OUTER_VALIDATION_PROMOTION_OPTIMIZER_CONFIG;
  otherModelAffectingChoices: typeof MLB_OUTER_VALIDATION_PROMOTION_OTHER_MODEL_AFFECTING_CHOICES;
  complexityRank: typeof MLB_OUTER_VALIDATION_PROMOTION_COMPLEXITY_RANK;
  rowCountMetadata: MLBOuterValidationPromotionRowCountMetadata;
  dateMetadata: MLBOuterValidationPromotionDateMetadata;
  status: 'PREPARED';
  outerValidationConsumed: false;
  modelPersisted: false;
  trainModelReady: false;
  preHoldoutFailure: null;
  holdoutConsumedAt: null;
  validationMetrics: null;
  referenceFacts: null;
  gateResult: null;
  terminalStatus: null;
  testAuthorized: false;
  testExecuted: false;
}>;

export type MLBOuterValidationPromotionPreValidationFailed = Readonly<{
  contractVersion: typeof MLB_OUTER_VALIDATION_PROMOTION_LEDGER_CONTRACT_VERSION;
  promotionEvaluationId: typeof MLB_OUTER_VALIDATION_PROMOTION_EVALUATION_ID;
  attemptNumber: typeof MLB_OUTER_VALIDATION_PROMOTION_ATTEMPT_NUMBER;
  maxAttempts: typeof MLB_OUTER_VALIDATION_PROMOTION_MAX_ATTEMPTS;
  maxCandidates: typeof MLB_OUTER_VALIDATION_PROMOTION_MAX_CANDIDATES;
  candidateRecipeId: typeof MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_RECIPE_ID;
  candidateFingerprint: typeof MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_FINGERPRINT;
  innerCampaignId: typeof MLB_OUTER_VALIDATION_PROMOTION_INNER_CAMPAIGN_ID;
  innerAttemptNumber: typeof MLB_OUTER_VALIDATION_PROMOTION_INNER_ATTEMPT_NUMBER;
  innerTerminalStatus: typeof MLB_OUTER_VALIDATION_PROMOTION_INNER_TERMINAL_STATUS;
  pretestGatePolicyId: typeof MLB_PRETEST_GATE_POLICY_ID;
  datasetId: typeof MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID;
  datasetSha256: typeof MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256;
  matrixId: typeof MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID;
  manifestId: typeof MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID;
  preprocessingPolicyId: typeof MLB_OUTER_VALIDATION_PROMOTION_PREPROCESSING_POLICY_ID;
  featurePolicyId: typeof MLB_OUTER_VALIDATION_PROMOTION_FEATURE_POLICY_ID;
  modelFamilyId: typeof MLB_OUTER_VALIDATION_PROMOTION_MODEL_FAMILY_ID;
  regularizationConfig: typeof MLB_OUTER_VALIDATION_PROMOTION_REGULARIZATION_CONFIG;
  optimizerConfig: typeof MLB_OUTER_VALIDATION_PROMOTION_OPTIMIZER_CONFIG;
  otherModelAffectingChoices: typeof MLB_OUTER_VALIDATION_PROMOTION_OTHER_MODEL_AFFECTING_CHOICES;
  complexityRank: typeof MLB_OUTER_VALIDATION_PROMOTION_COMPLEXITY_RANK;
  rowCountMetadata: MLBOuterValidationPromotionRowCountMetadata;
  dateMetadata: MLBOuterValidationPromotionDateMetadata;
  status: 'PRE_VALIDATION_FAILED';
  outerValidationConsumed: false;
  modelPersisted: false;
  trainModelReady: false;
  preHoldoutFailure: MLBOuterValidationPromotionPreHoldoutFailure;
  holdoutConsumedAt: null;
  validationMetrics: null;
  referenceFacts: null;
  gateResult: null;
  terminalStatus: null;
  testAuthorized: false;
  testExecuted: false;
}>;

export type MLBOuterValidationPromotionTrainModelReady = Readonly<{
  contractVersion: typeof MLB_OUTER_VALIDATION_PROMOTION_LEDGER_CONTRACT_VERSION;
  promotionEvaluationId: typeof MLB_OUTER_VALIDATION_PROMOTION_EVALUATION_ID;
  attemptNumber: typeof MLB_OUTER_VALIDATION_PROMOTION_ATTEMPT_NUMBER;
  maxAttempts: typeof MLB_OUTER_VALIDATION_PROMOTION_MAX_ATTEMPTS;
  maxCandidates: typeof MLB_OUTER_VALIDATION_PROMOTION_MAX_CANDIDATES;
  candidateRecipeId: typeof MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_RECIPE_ID;
  candidateFingerprint: typeof MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_FINGERPRINT;
  innerCampaignId: typeof MLB_OUTER_VALIDATION_PROMOTION_INNER_CAMPAIGN_ID;
  innerAttemptNumber: typeof MLB_OUTER_VALIDATION_PROMOTION_INNER_ATTEMPT_NUMBER;
  innerTerminalStatus: typeof MLB_OUTER_VALIDATION_PROMOTION_INNER_TERMINAL_STATUS;
  pretestGatePolicyId: typeof MLB_PRETEST_GATE_POLICY_ID;
  datasetId: typeof MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID;
  datasetSha256: typeof MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256;
  matrixId: typeof MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID;
  manifestId: typeof MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID;
  preprocessingPolicyId: typeof MLB_OUTER_VALIDATION_PROMOTION_PREPROCESSING_POLICY_ID;
  featurePolicyId: typeof MLB_OUTER_VALIDATION_PROMOTION_FEATURE_POLICY_ID;
  modelFamilyId: typeof MLB_OUTER_VALIDATION_PROMOTION_MODEL_FAMILY_ID;
  regularizationConfig: typeof MLB_OUTER_VALIDATION_PROMOTION_REGULARIZATION_CONFIG;
  optimizerConfig: typeof MLB_OUTER_VALIDATION_PROMOTION_OPTIMIZER_CONFIG;
  otherModelAffectingChoices: typeof MLB_OUTER_VALIDATION_PROMOTION_OTHER_MODEL_AFFECTING_CHOICES;
  complexityRank: typeof MLB_OUTER_VALIDATION_PROMOTION_COMPLEXITY_RANK;
  rowCountMetadata: MLBOuterValidationPromotionRowCountMetadata;
  dateMetadata: MLBOuterValidationPromotionDateMetadata;
  status: 'TRAIN_MODEL_READY';
  outerValidationConsumed: false;
  modelPersisted: true;
  trainModelReady: true;
  preHoldoutFailure: null;
  fittedModel: MLBDeterministicLogisticRegressionModel;
  trainingRowCount: 301;
  converged: true;
  holdoutConsumedAt: null;
  validationMetrics: null;
  referenceFacts: null;
  gateResult: null;
  terminalStatus: null;
  testAuthorized: false;
  testExecuted: false;
}>;

export type MLBOuterValidationPromotionRunningConsumed = Readonly<{
  contractVersion: typeof MLB_OUTER_VALIDATION_PROMOTION_LEDGER_CONTRACT_VERSION;
  promotionEvaluationId: typeof MLB_OUTER_VALIDATION_PROMOTION_EVALUATION_ID;
  attemptNumber: typeof MLB_OUTER_VALIDATION_PROMOTION_ATTEMPT_NUMBER;
  maxAttempts: typeof MLB_OUTER_VALIDATION_PROMOTION_MAX_ATTEMPTS;
  maxCandidates: typeof MLB_OUTER_VALIDATION_PROMOTION_MAX_CANDIDATES;
  candidateRecipeId: typeof MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_RECIPE_ID;
  candidateFingerprint: typeof MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_FINGERPRINT;
  innerCampaignId: typeof MLB_OUTER_VALIDATION_PROMOTION_INNER_CAMPAIGN_ID;
  innerAttemptNumber: typeof MLB_OUTER_VALIDATION_PROMOTION_INNER_ATTEMPT_NUMBER;
  innerTerminalStatus: typeof MLB_OUTER_VALIDATION_PROMOTION_INNER_TERMINAL_STATUS;
  pretestGatePolicyId: typeof MLB_PRETEST_GATE_POLICY_ID;
  datasetId: typeof MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID;
  datasetSha256: typeof MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256;
  matrixId: typeof MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID;
  manifestId: typeof MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID;
  preprocessingPolicyId: typeof MLB_OUTER_VALIDATION_PROMOTION_PREPROCESSING_POLICY_ID;
  featurePolicyId: typeof MLB_OUTER_VALIDATION_PROMOTION_FEATURE_POLICY_ID;
  modelFamilyId: typeof MLB_OUTER_VALIDATION_PROMOTION_MODEL_FAMILY_ID;
  regularizationConfig: typeof MLB_OUTER_VALIDATION_PROMOTION_REGULARIZATION_CONFIG;
  optimizerConfig: typeof MLB_OUTER_VALIDATION_PROMOTION_OPTIMIZER_CONFIG;
  otherModelAffectingChoices: typeof MLB_OUTER_VALIDATION_PROMOTION_OTHER_MODEL_AFFECTING_CHOICES;
  complexityRank: typeof MLB_OUTER_VALIDATION_PROMOTION_COMPLEXITY_RANK;
  rowCountMetadata: MLBOuterValidationPromotionRowCountMetadata;
  dateMetadata: MLBOuterValidationPromotionDateMetadata;
  status: 'RUNNING_CONSUMED';
  outerValidationConsumed: true;
  modelPersisted: true;
  trainModelReady: true;
  preHoldoutFailure: null;
  fittedModel: MLBDeterministicLogisticRegressionModel;
  trainingRowCount: 301;
  converged: true;
  holdoutConsumedAt: string;
  validationMetrics: null;
  referenceFacts: null;
  gateResult: null;
  terminalStatus: null;
  testAuthorized: false;
  testExecuted: false;
}>;

export type MLBOuterValidationPromotionEligibleForTest = Readonly<{
  contractVersion: typeof MLB_OUTER_VALIDATION_PROMOTION_LEDGER_CONTRACT_VERSION;
  promotionEvaluationId: typeof MLB_OUTER_VALIDATION_PROMOTION_EVALUATION_ID;
  attemptNumber: typeof MLB_OUTER_VALIDATION_PROMOTION_ATTEMPT_NUMBER;
  maxAttempts: typeof MLB_OUTER_VALIDATION_PROMOTION_MAX_ATTEMPTS;
  maxCandidates: typeof MLB_OUTER_VALIDATION_PROMOTION_MAX_CANDIDATES;
  candidateRecipeId: typeof MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_RECIPE_ID;
  candidateFingerprint: typeof MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_FINGERPRINT;
  innerCampaignId: typeof MLB_OUTER_VALIDATION_PROMOTION_INNER_CAMPAIGN_ID;
  innerAttemptNumber: typeof MLB_OUTER_VALIDATION_PROMOTION_INNER_ATTEMPT_NUMBER;
  innerTerminalStatus: typeof MLB_OUTER_VALIDATION_PROMOTION_INNER_TERMINAL_STATUS;
  pretestGatePolicyId: typeof MLB_PRETEST_GATE_POLICY_ID;
  datasetId: typeof MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID;
  datasetSha256: typeof MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256;
  matrixId: typeof MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID;
  manifestId: typeof MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID;
  preprocessingPolicyId: typeof MLB_OUTER_VALIDATION_PROMOTION_PREPROCESSING_POLICY_ID;
  featurePolicyId: typeof MLB_OUTER_VALIDATION_PROMOTION_FEATURE_POLICY_ID;
  modelFamilyId: typeof MLB_OUTER_VALIDATION_PROMOTION_MODEL_FAMILY_ID;
  regularizationConfig: typeof MLB_OUTER_VALIDATION_PROMOTION_REGULARIZATION_CONFIG;
  optimizerConfig: typeof MLB_OUTER_VALIDATION_PROMOTION_OPTIMIZER_CONFIG;
  otherModelAffectingChoices: typeof MLB_OUTER_VALIDATION_PROMOTION_OTHER_MODEL_AFFECTING_CHOICES;
  complexityRank: typeof MLB_OUTER_VALIDATION_PROMOTION_COMPLEXITY_RANK;
  rowCountMetadata: MLBOuterValidationPromotionRowCountMetadata;
  dateMetadata: MLBOuterValidationPromotionDateMetadata;
  status: 'ELIGIBLE_FOR_TEST';
  outerValidationConsumed: true;
  modelPersisted: true;
  trainModelReady: true;
  preHoldoutFailure: null;
  fittedModel: MLBDeterministicLogisticRegressionModel;
  trainingRowCount: 301;
  converged: true;
  holdoutConsumedAt: string;
  validationMetrics: MLBModelValidationEvaluation;
  referenceFacts: MLBPreTestValidationReferenceFacts;
  gateResult: MLBPreTestCandidateGateResult & Readonly<{ eligibility: 'ELIGIBLE_FOR_TEST' }>;
  terminalStatus: 'ELIGIBLE_FOR_TEST';
  testAuthorized: false;
  testExecuted: false;
}>;

export type MLBOuterValidationPromotionRejectBeforeTest = Readonly<{
  contractVersion: typeof MLB_OUTER_VALIDATION_PROMOTION_LEDGER_CONTRACT_VERSION;
  promotionEvaluationId: typeof MLB_OUTER_VALIDATION_PROMOTION_EVALUATION_ID;
  attemptNumber: typeof MLB_OUTER_VALIDATION_PROMOTION_ATTEMPT_NUMBER;
  maxAttempts: typeof MLB_OUTER_VALIDATION_PROMOTION_MAX_ATTEMPTS;
  maxCandidates: typeof MLB_OUTER_VALIDATION_PROMOTION_MAX_CANDIDATES;
  candidateRecipeId: typeof MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_RECIPE_ID;
  candidateFingerprint: typeof MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_FINGERPRINT;
  innerCampaignId: typeof MLB_OUTER_VALIDATION_PROMOTION_INNER_CAMPAIGN_ID;
  innerAttemptNumber: typeof MLB_OUTER_VALIDATION_PROMOTION_INNER_ATTEMPT_NUMBER;
  innerTerminalStatus: typeof MLB_OUTER_VALIDATION_PROMOTION_INNER_TERMINAL_STATUS;
  pretestGatePolicyId: typeof MLB_PRETEST_GATE_POLICY_ID;
  datasetId: typeof MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID;
  datasetSha256: typeof MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256;
  matrixId: typeof MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID;
  manifestId: typeof MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID;
  preprocessingPolicyId: typeof MLB_OUTER_VALIDATION_PROMOTION_PREPROCESSING_POLICY_ID;
  featurePolicyId: typeof MLB_OUTER_VALIDATION_PROMOTION_FEATURE_POLICY_ID;
  modelFamilyId: typeof MLB_OUTER_VALIDATION_PROMOTION_MODEL_FAMILY_ID;
  regularizationConfig: typeof MLB_OUTER_VALIDATION_PROMOTION_REGULARIZATION_CONFIG;
  optimizerConfig: typeof MLB_OUTER_VALIDATION_PROMOTION_OPTIMIZER_CONFIG;
  otherModelAffectingChoices: typeof MLB_OUTER_VALIDATION_PROMOTION_OTHER_MODEL_AFFECTING_CHOICES;
  complexityRank: typeof MLB_OUTER_VALIDATION_PROMOTION_COMPLEXITY_RANK;
  rowCountMetadata: MLBOuterValidationPromotionRowCountMetadata;
  dateMetadata: MLBOuterValidationPromotionDateMetadata;
  status: 'REJECT_BEFORE_TEST';
  outerValidationConsumed: true;
  modelPersisted: true;
  trainModelReady: true;
  preHoldoutFailure: null;
  fittedModel: MLBDeterministicLogisticRegressionModel;
  trainingRowCount: 301;
  converged: true;
  holdoutConsumedAt: string;
  validationMetrics: MLBModelValidationEvaluation;
  referenceFacts: MLBPreTestValidationReferenceFacts;
  gateResult: MLBPreTestCandidateGateResult & Readonly<{ eligibility: 'REJECT_BEFORE_TEST' }>;
  terminalStatus: 'REJECT_BEFORE_TEST';
  testAuthorized: false;
  testExecuted: false;
}>;

export type MLBOuterValidationPromotionLedger =
  | MLBOuterValidationPromotionPrepared
  | MLBOuterValidationPromotionPreValidationFailed
  | MLBOuterValidationPromotionTrainModelReady
  | MLBOuterValidationPromotionRunningConsumed
  | MLBOuterValidationPromotionEligibleForTest
  | MLBOuterValidationPromotionRejectBeforeTest;

/* -------------------------------------------------------------------------- */
/*  Issue types                                                                 */
/* -------------------------------------------------------------------------- */

export type MLBOuterValidationPromotionIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_INTEGER'
    | 'INVALID_NUMBER'
    | 'INVALID_BOOLEAN'
    | 'INVALID_ARRAY'
    | 'DUPLICATE_ID'
    | 'NON_CANONICAL_ORDER'
    | 'SOURCE_IDENTITY_MISMATCH'
    | 'MODEL_INVALID'
    | 'EVALUATION_INVALID'
    | 'REFERENCE_FACTS_INVALID'
    | 'GATE_RESULT_INVALID'
    | 'STATUS_MISMATCH'
    | 'TERMINAL_OUTGOING'
    | 'ILLEGAL_TRANSITION'
    | 'NONFINITE_NUMBER'
    | 'INVALID_TIMESTAMP'
    | 'PROHIBITED_CONCEPT'
    | 'HOSTILE_ACCESSOR'
    | 'HOSTILE_SYMBOL'
    | 'ODDS_CONTAMINATION';
  path: string;
  message: string;
}>;

/* -------------------------------------------------------------------------- */
/*  Shared known keys                                                           */
/* -------------------------------------------------------------------------- */

const SHARED_IDENTITY_KEYS = new Set<string>([
  'contractVersion',
  'promotionEvaluationId',
  'attemptNumber',
  'maxAttempts',
  'maxCandidates',
  'candidateRecipeId',
  'candidateFingerprint',
  'innerCampaignId',
  'innerAttemptNumber',
  'innerTerminalStatus',
  'pretestGatePolicyId',
  'datasetId',
  'datasetSha256',
  'matrixId',
  'manifestId',
  'preprocessingPolicyId',
  'featurePolicyId',
  'modelFamilyId',
  'regularizationConfig',
  'optimizerConfig',
  'otherModelAffectingChoices',
  'complexityRank',
  'rowCountMetadata',
  'dateMetadata',
]);

const COMMON_LIFECYCLE_KEYS = new Set<string>([
  'status',
  'outerValidationConsumed',
  'modelPersisted',
  'trainModelReady',
  'preHoldoutFailure',
  'holdoutConsumedAt',
  'terminalStatus',
  'testAuthorized',
  'testExecuted',
]);

const NULLABLE_LIFECYCLE_KEYS = new Set<string>([
  'validationMetrics',
  'referenceFacts',
  'gateResult',
]);

const MODEL_STATE_EXTRA_KEYS = new Set<string>([
  'fittedModel',
  'trainingRowCount',
  'converged',
]);

const STATE_ALLOWED_KEYS: Record<string, Set<string>> = {
  PREPARED: new Set([
    ...SHARED_IDENTITY_KEYS,
    ...COMMON_LIFECYCLE_KEYS,
    ...NULLABLE_LIFECYCLE_KEYS,
  ]),
  PRE_VALIDATION_FAILED: new Set([
    ...SHARED_IDENTITY_KEYS,
    ...COMMON_LIFECYCLE_KEYS,
    ...NULLABLE_LIFECYCLE_KEYS,
  ]),
  TRAIN_MODEL_READY: new Set([
    ...SHARED_IDENTITY_KEYS,
    ...COMMON_LIFECYCLE_KEYS,
    ...NULLABLE_LIFECYCLE_KEYS,
    ...MODEL_STATE_EXTRA_KEYS,
  ]),
  RUNNING_CONSUMED: new Set([
    ...SHARED_IDENTITY_KEYS,
    ...COMMON_LIFECYCLE_KEYS,
    ...NULLABLE_LIFECYCLE_KEYS,
    ...MODEL_STATE_EXTRA_KEYS,
  ]),
  ELIGIBLE_FOR_TEST: new Set([
    ...SHARED_IDENTITY_KEYS,
    ...COMMON_LIFECYCLE_KEYS,
    ...NULLABLE_LIFECYCLE_KEYS,
    ...MODEL_STATE_EXTRA_KEYS,
  ]),
  REJECT_BEFORE_TEST: new Set([
    ...SHARED_IDENTITY_KEYS,
    ...COMMON_LIFECYCLE_KEYS,
    ...NULLABLE_LIFECYCLE_KEYS,
    ...MODEL_STATE_EXTRA_KEYS,
  ]),
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F]/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { value: unknown } {
  return !!descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value');
}

function isStrictNonEmptyTrimmedString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    !CONTROL_CHARACTER_PATTERN.test(value)
  );
}

type OwnDataPropertyResult =
  | Readonly<{ kind: 'missing' }>
  | Readonly<{ kind: 'accessor' }>
  | Readonly<{ kind: 'data'; value: unknown }>;

function ownDataProperty(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBOuterValidationPromotionIssue[],
): OwnDataPropertyResult {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (!descriptor) {
    return { kind: 'missing' };
  }
  if (!isDataDescriptor(descriptor)) {
    pushIssue(issues, 'HOSTILE_ACCESSOR', path, `${path} is an accessor property`);
    return { kind: 'accessor' };
  }
  return { kind: 'data', value: descriptor.value };
}

function pushIssue(
  issues: MLBOuterValidationPromotionIssue[],
  code: MLBOuterValidationPromotionIssue['code'],
  path: string,
  message: string,
): void {
  const exists = issues.some((item) => item.path === path && item.code === code);
  if (!exists) {
    issues.push({ code, path, message });
  }
}

function pushUniquePathCode(
  issues: MLBOuterValidationPromotionIssue[],
  next: MLBOuterValidationPromotionIssue,
): void {
  const exists = issues.some((item) => item.path === next.path && item.code === next.code);
  if (!exists) {
    issues.push(next);
  }
}

function sortIssues(
  issues: MLBOuterValidationPromotionIssue[],
): MLBOuterValidationPromotionIssue[] {
  return issues
    .slice()
    .sort((a, b) => {
      const pathDiff = a.path < b.path ? -1 : a.path === b.path ? 0 : 1;
      if (pathDiff !== 0) return pathDiff;
      return a.code < b.code ? -1 : a.code === b.code ? 0 : 1;
    })
    .filter((item, index, array) =>
      index === 0 || item.path !== array[index - 1].path || item.code !== array[index - 1].code,
    );
}

function addKnownFieldIssues(
  record: Record<string, unknown>,
  known: Set<string>,
  path: string,
  issues: MLBOuterValidationPromotionIssue[],
): void {
  const names = Object.getOwnPropertyNames(record);
  for (const key of names) {
    if (!known.has(key)) {
      pushIssue(issues, 'UNKNOWN_FIELD', `${path}.${key}`, `Unknown field: ${key}`);
    }
  }
  const symbols = Object.getOwnPropertySymbols(record);
  for (const symbol of symbols) {
    pushIssue(
      issues,
      'HOSTILE_SYMBOL',
      `${path}[${String(symbol)}]`,
      `Unknown symbol property: ${symbol.description ?? symbol.toString()}`,
    );
  }
}

function validateIdentifier(
  value: unknown,
  path: string,
  label: string,
  issues: MLBOuterValidationPromotionIssue[],
): void {
  if (!isStrictNonEmptyTrimmedString(value)) {
    pushIssue(issues, 'INVALID_STRING', path, `${label} must be a valid identifier`);
  }
}

function validatePositiveInteger(
  value: unknown,
  path: string,
  label: string,
  issues: MLBOuterValidationPromotionIssue[],
): void {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    pushIssue(issues, 'INVALID_INTEGER', path, `${label} must be a positive integer`);
  }
}

function validateFiniteNumber(
  value: unknown,
  path: string,
  label: string,
  issues: MLBOuterValidationPromotionIssue[],
): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    pushIssue(issues, 'NONFINITE_NUMBER', path, `${label} must be finite`);
  }
}

function validateTimestamp(
  value: unknown,
  path: string,
  issues: MLBOuterValidationPromotionIssue[],
): void {
  if (!isStrictNonEmptyTrimmedString(value)) {
    pushIssue(issues, 'INVALID_TIMESTAMP', path, 'timestamp must be a strict non-empty trimmed string');
    return;
  }
  const match = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) {
    pushIssue(issues, 'INVALID_TIMESTAMP', path, 'timestamp must be ISO-8601');
  }
}

/* -------------------------------------------------------------------------- */
/*  Imported-issue adapter                                                     */
/* -------------------------------------------------------------------------- */

type ForeignIssue = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

function adaptForeignIssues(
  destination: MLBOuterValidationPromotionIssue[],
  localCode: MLBOuterValidationPromotionIssue['code'],
  pathPrefix: string,
  foreignIssues: readonly ForeignIssue[],
): void {
  for (const issue of foreignIssues) {
    const prefixedPath = pathPrefix ? `${pathPrefix}.${issue.path.replace(/^\$\.?/, '')}` : issue.path;
    pushUniquePathCode(
      destination,
      {
        code: localCode,
        path: prefixedPath,
        message: `[${issue.code}] ${issue.message}`,
      } as MLBOuterValidationPromotionIssue,
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  Genesis validation                                                         */
/* -------------------------------------------------------------------------- */

function validateSharedGenesis(
  root: Record<string, unknown>,
  issues: MLBOuterValidationPromotionIssue[],
): void {
  const descriptor = Object.getOwnPropertyDescriptor(root, 'contractVersion');
  if (!descriptor || !isDataDescriptor(descriptor)) {
    pushIssue(issues, 'MISSING_FIELD', '$.contractVersion', 'contractVersion is required');
  } else if (descriptor.value !== MLB_OUTER_VALIDATION_PROMOTION_LEDGER_CONTRACT_VERSION) {
    pushIssue(issues, 'INVALID_LITERAL', '$.contractVersion', 'contractVersion mismatch');
  }

  const promotionEvaluationResult = ownDataProperty(root, 'promotionEvaluationId', '$.promotionEvaluationId', issues);
  if (promotionEvaluationResult.kind === 'data' && promotionEvaluationResult.value !== MLB_OUTER_VALIDATION_PROMOTION_EVALUATION_ID) {
    pushIssue(issues, 'INVALID_LITERAL', '$.promotionEvaluationId', 'promotionEvaluationId mismatch');
  }

  const attemptResult = ownDataProperty(root, 'attemptNumber', '$.attemptNumber', issues);
  if (attemptResult.kind === 'data' && attemptResult.value !== MLB_OUTER_VALIDATION_PROMOTION_ATTEMPT_NUMBER) {
    pushIssue(issues, 'INVALID_LITERAL', '$.attemptNumber', 'attemptNumber must be 1');
  }

  const maxAttemptsResult = ownDataProperty(root, 'maxAttempts', '$.maxAttempts', issues);
  if (maxAttemptsResult.kind === 'data' && maxAttemptsResult.value !== MLB_OUTER_VALIDATION_PROMOTION_MAX_ATTEMPTS) {
    pushIssue(issues, 'INVALID_LITERAL', '$.maxAttempts', 'maxAttempts must be 1');
  }

  const maxCandidatesResult = ownDataProperty(root, 'maxCandidates', '$.maxCandidates', issues);
  if (maxCandidatesResult.kind === 'data' && maxCandidatesResult.value !== MLB_OUTER_VALIDATION_PROMOTION_MAX_CANDIDATES) {
    pushIssue(issues, 'INVALID_LITERAL', '$.maxCandidates', 'maxCandidates must be 1');
  }

  const candidateRecipeResult = ownDataProperty(root, 'candidateRecipeId', '$.candidateRecipeId', issues);
  if (candidateRecipeResult.kind === 'data' && candidateRecipeResult.value !== MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_RECIPE_ID) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.candidateRecipeId', 'candidateRecipeId must be candidate 003');
  }

  const fingerprintResult = ownDataProperty(root, 'candidateFingerprint', '$.candidateFingerprint', issues);
  if (fingerprintResult.kind === 'data' && fingerprintResult.value !== MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_FINGERPRINT) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.candidateFingerprint', 'candidateFingerprint mismatch');
  }

  const innerCampaignResult = ownDataProperty(root, 'innerCampaignId', '$.innerCampaignId', issues);
  if (innerCampaignResult.kind === 'data' && innerCampaignResult.value !== MLB_OUTER_VALIDATION_PROMOTION_INNER_CAMPAIGN_ID) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.innerCampaignId', 'innerCampaignId mismatch');
  }

  const innerAttemptResult = ownDataProperty(root, 'innerAttemptNumber', '$.innerAttemptNumber', issues);
  if (innerAttemptResult.kind === 'data' && innerAttemptResult.value !== MLB_OUTER_VALIDATION_PROMOTION_INNER_ATTEMPT_NUMBER) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.innerAttemptNumber', 'innerAttemptNumber must be 1');
  }

  const innerTerminalResult = ownDataProperty(root, 'innerTerminalStatus', '$.innerTerminalStatus', issues);
  if (innerTerminalResult.kind === 'data' && innerTerminalResult.value !== MLB_OUTER_VALIDATION_PROMOTION_INNER_TERMINAL_STATUS) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.innerTerminalStatus', 'innerTerminalStatus must be COMPLETED_INNER_ELIGIBLE');
  }

  const gatePolicyResult = ownDataProperty(root, 'pretestGatePolicyId', '$.pretestGatePolicyId', issues);
  if (gatePolicyResult.kind === 'data' && gatePolicyResult.value !== MLB_PRETEST_GATE_POLICY_ID) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.pretestGatePolicyId', 'pretestGatePolicyId mismatch');
  }

  const datasetIdResult = ownDataProperty(root, 'datasetId', '$.datasetId', issues);
  if (datasetIdResult.kind === 'data' && datasetIdResult.value !== MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.datasetId', 'datasetId mismatch');
  }

  const datasetShaResult = ownDataProperty(root, 'datasetSha256', '$.datasetSha256', issues);
  if (datasetShaResult.kind === 'data' && datasetShaResult.value !== MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.datasetSha256', 'datasetSha256 mismatch');
  }

  const matrixIdResult = ownDataProperty(root, 'matrixId', '$.matrixId', issues);
  if (matrixIdResult.kind === 'data' && matrixIdResult.value !== MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.matrixId', 'matrixId mismatch');
  }

  const manifestIdResult = ownDataProperty(root, 'manifestId', '$.manifestId', issues);
  if (manifestIdResult.kind === 'data' && manifestIdResult.value !== MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.manifestId', 'manifestId mismatch');
  }

  const preprocessingResult = ownDataProperty(root, 'preprocessingPolicyId', '$.preprocessingPolicyId', issues);
  if (preprocessingResult.kind === 'data' && preprocessingResult.value !== MLB_OUTER_VALIDATION_PROMOTION_PREPROCESSING_POLICY_ID) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.preprocessingPolicyId', 'preprocessingPolicyId mismatch');
  }

  const featurePolicyResult = ownDataProperty(root, 'featurePolicyId', '$.featurePolicyId', issues);
  if (featurePolicyResult.kind === 'data' && featurePolicyResult.value !== MLB_OUTER_VALIDATION_PROMOTION_FEATURE_POLICY_ID) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.featurePolicyId', 'featurePolicyId mismatch');
  }

  const modelFamilyResult = ownDataProperty(root, 'modelFamilyId', '$.modelFamilyId', issues);
  if (modelFamilyResult.kind === 'data' && modelFamilyResult.value !== MLB_OUTER_VALIDATION_PROMOTION_MODEL_FAMILY_ID) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.modelFamilyId', 'modelFamilyId mismatch');
  }

  const regularizationResult = ownDataProperty(root, 'regularizationConfig', '$.regularizationConfig', issues);
  if (regularizationResult.kind === 'accessor') {
    pushIssue(issues, 'HOSTILE_ACCESSOR', '$.regularizationConfig', 'regularizationConfig is an accessor');
  } else if (regularizationResult.kind === 'data') {
    if (
      typeof regularizationResult.value !== 'object' ||
      regularizationResult.value === null ||
      Array.isArray(regularizationResult.value)
    ) {
      pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.regularizationConfig', 'regularizationConfig must be an object');
    } else {
      const reg = regularizationResult.value as Record<string, unknown>;
      if (reg.kind !== 'L2') {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.regularizationConfig.kind', 'L2 kind required');
      }
      if (reg.strength !== 0.1) {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.regularizationConfig.strength', 'strength must be 0.1');
      }
    }
  }

  const optimizerResult = ownDataProperty(root, 'optimizerConfig', '$.optimizerConfig', issues);
  if (optimizerResult.kind === 'accessor') {
    pushIssue(issues, 'HOSTILE_ACCESSOR', '$.optimizerConfig', 'optimizerConfig is an accessor');
  } else if (optimizerResult.kind === 'data') {
    if (
      typeof optimizerResult.value !== 'object' ||
      optimizerResult.value === null ||
      Array.isArray(optimizerResult.value)
    ) {
      pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.optimizerConfig', 'optimizerConfig must be an object');
    } else {
      const opt = optimizerResult.value as Record<string, unknown>;
      if (opt.solver !== 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1') {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.optimizerConfig.solver', 'solver mismatch');
      }
      if (opt.learningRate !== 0.01) {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.optimizerConfig.learningRate', 'learningRate must be 0.01');
      }
      if (opt.maxIterations !== 5000) {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.optimizerConfig.maxIterations', 'maxIterations must be 5000');
      }
      if (opt.tolerance !== 0.0001) {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.optimizerConfig.tolerance', 'tolerance must be 0.0001');
      }
    }
  }

  const otherResult = ownDataProperty(root, 'otherModelAffectingChoices', '$.otherModelAffectingChoices', issues);
  if (otherResult.kind === 'data') {
    if (otherResult.value !== null && typeof otherResult.value === 'object') {
      const keys = Object.getOwnPropertyNames(otherResult.value as Record<string, unknown>);
      if (keys.length !== 0) {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.otherModelAffectingChoices', 'otherModelAffectingChoices must be empty');
      }
    } else if (otherResult.value !== null) {
      pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.otherModelAffectingChoices', 'otherModelAffectingChoices must be object or null');
    }
  }

  const complexityResult = ownDataProperty(root, 'complexityRank', '$.complexityRank', issues);
  if (complexityResult.kind === 'data' && complexityResult.value !== MLB_OUTER_VALIDATION_PROMOTION_COMPLEXITY_RANK) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.complexityRank', 'complexityRank must be 1');
  }

  const rowCountResult = ownDataProperty(root, 'rowCountMetadata', '$.rowCountMetadata', issues);
  if (rowCountResult.kind === 'accessor') {
    pushIssue(issues, 'HOSTILE_ACCESSOR', '$.rowCountMetadata', 'rowCountMetadata is an accessor');
  } else if (rowCountResult.kind === 'data') {
    if (
      typeof rowCountResult.value !== 'object' ||
      rowCountResult.value === null ||
      Array.isArray(rowCountResult.value)
    ) {
      pushIssue(issues, 'INVALID_JSON_VALUE', '$.rowCountMetadata', 'rowCountMetadata must be an object');
    } else {
      const counts = rowCountResult.value as Record<string, unknown>;
      if (counts.outerTrainRowCount !== 301) {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.rowCountMetadata.outerTrainRowCount', 'outerTrainRowCount must be 301');
      }
      if (counts.validationRowCount !== 67) {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.rowCountMetadata.validationRowCount', 'validationRowCount must be 67');
      }
      if (counts.testRowCount !== 69) {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.rowCountMetadata.testRowCount', 'testRowCount must be 69');
      }
    }
  }

  const dateResult = ownDataProperty(root, 'dateMetadata', '$.dateMetadata', issues);
  if (dateResult.kind === 'accessor') {
    pushIssue(issues, 'HOSTILE_ACCESSOR', '$.dateMetadata', 'dateMetadata is an accessor');
  } else if (dateResult.kind === 'data') {
    if (typeof dateResult.value !== 'object' || dateResult.value === null || Array.isArray(dateResult.value)) {
      pushIssue(issues, 'INVALID_JSON_VALUE', '$.dateMetadata', 'dateMetadata must be an object');
    } else {
      const dates = dateResult.value as Record<string, unknown>;
      if (dates.trainStart !== '2026-04-01') {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.dateMetadata.trainStart', 'trainStart mismatch');
      }
      if (dates.trainEnd !== '2026-04-23') {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.dateMetadata.trainEnd', 'trainEnd mismatch');
      }
      if (dates.validationStart !== '2026-04-24') {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.dateMetadata.validationStart', 'validationStart mismatch');
      }
      if (dates.validationEnd !== '2026-04-28') {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.dateMetadata.validationEnd', 'validationEnd mismatch');
      }
      if (dates.testStart !== '2026-04-29') {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.dateMetadata.testStart', 'testStart mismatch');
      }
      if (dates.testEnd !== '2026-05-03') {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.dateMetadata.testEnd', 'testEnd mismatch');
      }
    }
  }
}

function validateNullableLifecycleNull(
  root: Record<string, unknown>,
  issues: MLBOuterValidationPromotionIssue[],
): void {
  for (const key of NULLABLE_LIFECYCLE_KEYS) {
    const result = ownDataProperty(root, key, `$.${key}`, issues);
    if (result.kind === 'data' && result.value !== null) {
      pushIssue(issues, 'INVALID_LITERAL', `$.${key}`, `${key} must be null in non-terminal state`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  State-specific validators                                                 */
/* -------------------------------------------------------------------------- */

function validatePrepared(
  root: Record<string, unknown>,
  issues: MLBOuterValidationPromotionIssue[],
): void {
  validateSharedGenesis(root, issues);

  const statusResult = ownDataProperty(root, 'status', '$.status', issues);
  if (statusResult.kind === 'data' && statusResult.value !== 'PREPARED') {
    pushIssue(issues, 'INVALID_LITERAL', '$.status', 'status must be PREPARED');
  }

  const consumedResult = ownDataProperty(root, 'outerValidationConsumed', '$.outerValidationConsumed', issues);
  if (consumedResult.kind === 'data' && consumedResult.value !== false) {
    pushIssue(issues, 'INVALID_BOOLEAN', '$.outerValidationConsumed', 'outerValidationConsumed must be false');
  }

  validateNullableLifecycleNull(root, issues);
}

function validatePreValidationFailed(
  root: Record<string, unknown>,
  issues: MLBOuterValidationPromotionIssue[],
): void {
  validateSharedGenesis(root, issues);

  const statusResult = ownDataProperty(root, 'status', '$.status', issues);
  if (statusResult.kind === 'data' && statusResult.value !== 'PRE_VALIDATION_FAILED') {
    pushIssue(issues, 'INVALID_LITERAL', '$.status', 'status must be PRE_VALIDATION_FAILED');
  }

  const consumedResult = ownDataProperty(root, 'outerValidationConsumed', '$.outerValidationConsumed', issues);
  if (consumedResult.kind === 'data' && consumedResult.value !== false) {
    pushIssue(issues, 'INVALID_BOOLEAN', '$.outerValidationConsumed', 'outerValidationConsumed must be false');
  }

  const failureResult = ownDataProperty(root, 'preHoldoutFailure', '$.preHoldoutFailure', issues);
  if (failureResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.preHoldoutFailure', 'preHoldoutFailure is required');
  } else if (failureResult.kind === 'data') {
    if (
      typeof failureResult.value !== 'object' ||
      failureResult.value === null ||
      Array.isArray(failureResult.value)
    ) {
      pushIssue(issues, 'INVALID_JSON_VALUE', '$.preHoldoutFailure', 'preHoldoutFailure must be an object');
    } else {
      const failure = failureResult.value as Record<string, unknown>;
      const failureKindResult = ownDataProperty(failure, 'failureKind', '$.preHoldoutFailure.failureKind', issues);
      if (failureKindResult.kind === 'missing') {
        pushIssue(issues, 'MISSING_FIELD', '$.preHoldoutFailure.failureKind', 'failureKind is required');
      } else if (failureKindResult.kind === 'data' && !MLB_OUTER_VALIDATION_PROMOTION_PRE_HOLDOUT_FAILURE_KINDS.includes(failureKindResult.value as MLBOuterValidationPromotionPreHoldoutFailureKind)) {
        pushIssue(issues, 'INVALID_LITERAL', '$.preHoldoutFailure.failureKind', 'failureKind is invalid');
      }
      const messageResult = ownDataProperty(failure, 'message', '$.preHoldoutFailure.message', issues);
      if (messageResult.kind === 'missing') {
        pushIssue(issues, 'MISSING_FIELD', '$.preHoldoutFailure.message', 'message is required');
      } else if (messageResult.kind === 'data' && typeof messageResult.value !== 'string') {
        pushIssue(issues, 'INVALID_STRING', '$.preHoldoutFailure.message', 'message must be a string');
      }
      const occurredAtResult = ownDataProperty(failure, 'occurredAt', '$.preHoldoutFailure.occurredAt', issues);
      if (occurredAtResult.kind === 'missing') {
        pushIssue(issues, 'MISSING_FIELD', '$.preHoldoutFailure.occurredAt', 'occurredAt is required');
      } else if (occurredAtResult.kind === 'data') {
        validateTimestamp(occurredAtResult.value, '$.preHoldoutFailure.occurredAt', issues);
      }
      addKnownFieldIssues(failure, new Set(['failureKind', 'message', 'occurredAt']), '$.preHoldoutFailure', issues);
    }
  }

  validateNullableLifecycleNull(root, issues);
}

function validateTrainModelReady(
  root: Record<string, unknown>,
  issues: MLBOuterValidationPromotionIssue[],
): void {
  validateSharedGenesis(root, issues);

  const statusResult = ownDataProperty(root, 'status', '$.status', issues);
  if (statusResult.kind === 'data' && statusResult.value !== 'TRAIN_MODEL_READY') {
    pushIssue(issues, 'INVALID_LITERAL', '$.status', 'status must be TRAIN_MODEL_READY');
  }

  const consumedResult = ownDataProperty(root, 'outerValidationConsumed', '$.outerValidationConsumed', issues);
  if (consumedResult.kind === 'data' && consumedResult.value !== false) {
    pushIssue(issues, 'INVALID_BOOLEAN', '$.outerValidationConsumed', 'outerValidationConsumed must be false');
  }

  const modelResult = ownDataProperty(root, 'fittedModel', '$.fittedModel', issues);
  if (modelResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.fittedModel', 'fittedModel is required');
  } else if (modelResult.kind === 'data') {
    const modelValidation = validateMLBDeterministicLogisticRegressionModel(modelResult.value);
    if (!modelValidation.ok) {
      adaptForeignIssues(
        issues,
        'MODEL_INVALID',
        '$.fittedModel',
        modelValidation.issues as readonly ForeignIssue[],
      );
    }
    if (modelValidation.ok) {
      const model = modelValidation.value;
      if (model.sport !== 'MLB') {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.fittedModel.sport', 'model sport must be MLB');
      }
      if (model.target !== 'OFFICIAL_FINAL_GAME_WINNER') {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.fittedModel.target', 'model target mismatch');
      }
      if (model.targetEncoding !== 'HOME_WIN_1_AWAY_WIN_0') {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.fittedModel.targetEncoding', 'model targetEncoding mismatch');
      }
      if (model.datasetId !== MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID) {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.fittedModel.datasetId', 'model datasetId mismatch');
      }
      if (model.matrixId !== MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID) {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.fittedModel.matrixId', 'model matrixId mismatch');
      }
      if (model.manifestId !== MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID) {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.fittedModel.manifestId', 'model manifestId mismatch');
      }
      if (model.algorithm !== 'L2_LOGISTIC_REGRESSION_BINARY_V1') {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.fittedModel.algorithm', 'model algorithm mismatch');
      }
      if (typeof model.trainingRowCount !== 'number' || model.trainingRowCount !== 301) {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.fittedModel.trainingRowCount', 'trainingRowCount must be 301');
      }
      if (model.converged !== true) {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.fittedModel.converged', 'model must be converged');
      }
      if (model.featureIds.length === 0) {
        pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.fittedModel.featureIds', 'model featureIds must not be empty');
      }
    }
  }

  const trainingRowCountResult = ownDataProperty(root, 'trainingRowCount', '$.trainingRowCount', issues);
  if (trainingRowCountResult.kind === 'data' && trainingRowCountResult.value !== 301) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.trainingRowCount', 'trainingRowCount must be 301');
  }

  const convergedResult = ownDataProperty(root, 'converged', '$.converged', issues);
  if (convergedResult.kind === 'data' && convergedResult.value !== true) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.converged', 'converged must be true');
  }

  validateNullableLifecycleNull(root, issues);
}

function validateRunningConsumed(
  root: Record<string, unknown>,
  issues: MLBOuterValidationPromotionIssue[],
): void {
  validateSharedGenesis(root, issues);

  const statusResult = ownDataProperty(root, 'status', '$.status', issues);
  if (statusResult.kind === 'data' && statusResult.value !== 'RUNNING_CONSUMED') {
    pushIssue(issues, 'INVALID_LITERAL', '$.status', 'status must be RUNNING_CONSUMED');
  }

  const consumedResult = ownDataProperty(root, 'outerValidationConsumed', '$.outerValidationConsumed', issues);
  if (consumedResult.kind === 'data' && consumedResult.value !== true) {
    pushIssue(issues, 'INVALID_BOOLEAN', '$.outerValidationConsumed', 'outerValidationConsumed must be true');
  }

  const timestampResult = ownDataProperty(root, 'holdoutConsumedAt', '$.holdoutConsumedAt', issues);
  if (timestampResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.holdoutConsumedAt', 'holdoutConsumedAt is required');
  } else if (timestampResult.kind === 'data') {
    validateTimestamp(timestampResult.value, '$.holdoutConsumedAt', issues);
  }

  validateNullableLifecycleNull(root, issues);
}

function validateTerminalEligible(
  root: Record<string, unknown>,
  issues: MLBOuterValidationPromotionIssue[],
): void {
  validateSharedGenesis(root, issues);

  const statusResult = ownDataProperty(root, 'status', '$.status', issues);
  if (statusResult.kind === 'data' && statusResult.value !== 'ELIGIBLE_FOR_TEST') {
    pushIssue(issues, 'INVALID_LITERAL', '$.status', 'status must be ELIGIBLE_FOR_TEST');
  }

  const terminalStatusResult = ownDataProperty(root, 'terminalStatus', '$.terminalStatus', issues);
  if (terminalStatusResult.kind === 'data' && terminalStatusResult.value !== 'ELIGIBLE_FOR_TEST') {
    pushIssue(issues, 'STATUS_MISMATCH', '$.terminalStatus', 'terminalStatus must match status');
  }

  const gateResult = ownDataProperty(root, 'gateResult', '$.gateResult', issues);
  if (gateResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.gateResult', 'gateResult is required');
  } else if (gateResult.kind === 'data') {
    const gateValidation = validateMLBPreTestCandidateGateResult(gateResult.value);
    if (!gateValidation.ok) {
      adaptForeignIssues(
        issues,
        'GATE_RESULT_INVALID',
        '$.gateResult',
        gateValidation.issues as readonly ForeignIssue[],
      );
    } else if (gateValidation.value.eligibility !== 'ELIGIBLE_FOR_TEST') {
      pushIssue(issues, 'STATUS_MISMATCH', '$.gateResult.eligibility', 'eligibility must be ELIGIBLE_FOR_TEST');
    }
  }

  const validationMetricsResult = ownDataProperty(root, 'validationMetrics', '$.validationMetrics', issues);
  if (validationMetricsResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.validationMetrics', 'validationMetrics is required');
  } else if (validationMetricsResult.kind === 'data') {
    const metricsValidation = validateMLBModelValidationEvaluation(validationMetricsResult.value);
    if (!metricsValidation.ok) {
      adaptForeignIssues(
        issues,
        'EVALUATION_INVALID',
        '$.validationMetrics',
        metricsValidation.issues as readonly ForeignIssue[],
      );
    }
  }

  const referenceFactsResult = ownDataProperty(root, 'referenceFacts', '$.referenceFacts', issues);
  if (referenceFactsResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.referenceFacts', 'referenceFacts is required');
  } else if (referenceFactsResult.kind === 'data') {
    const referenceFactsValidation = validateMLBPreTestValidationReferenceFacts(referenceFactsResult.value);
    if (!referenceFactsValidation.ok) {
      adaptForeignIssues(
        issues,
        'REFERENCE_FACTS_INVALID',
        '$.referenceFacts',
        referenceFactsValidation.issues as readonly ForeignIssue[],
      );
    }
  }
}

function validateTerminalRejected(
  root: Record<string, unknown>,
  issues: MLBOuterValidationPromotionIssue[],
): void {
  validateSharedGenesis(root, issues);

  const statusResult = ownDataProperty(root, 'status', '$.status', issues);
  if (statusResult.kind === 'data' && statusResult.value !== 'REJECT_BEFORE_TEST') {
    pushIssue(issues, 'INVALID_LITERAL', '$.status', 'status must be REJECT_BEFORE_TEST');
  }

  const terminalStatusResult = ownDataProperty(root, 'terminalStatus', '$.terminalStatus', issues);
  if (terminalStatusResult.kind === 'data' && terminalStatusResult.value !== 'REJECT_BEFORE_TEST') {
    pushIssue(issues, 'STATUS_MISMATCH', '$.terminalStatus', 'terminalStatus must match status');
  }

  const gateResult = ownDataProperty(root, 'gateResult', '$.gateResult', issues);
  if (gateResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.gateResult', 'gateResult is required');
  } else if (gateResult.kind === 'data') {
    const gateValidation = validateMLBPreTestCandidateGateResult(gateResult.value);
    if (!gateValidation.ok) {
      adaptForeignIssues(
        issues,
        'GATE_RESULT_INVALID',
        '$.gateResult',
        gateValidation.issues as readonly ForeignIssue[],
      );
    } else if (gateValidation.value.eligibility !== 'REJECT_BEFORE_TEST') {
      pushIssue(issues, 'STATUS_MISMATCH', '$.gateResult.eligibility', 'eligibility must be REJECT_BEFORE_TEST');
    }
  }

  const validationMetricsResult = ownDataProperty(root, 'validationMetrics', '$.validationMetrics', issues);
  if (validationMetricsResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.validationMetrics', 'validationMetrics is required');
  } else if (validationMetricsResult.kind === 'data') {
    const metricsValidation = validateMLBModelValidationEvaluation(validationMetricsResult.value);
    if (!metricsValidation.ok) {
      adaptForeignIssues(
        issues,
        'EVALUATION_INVALID',
        '$.validationMetrics',
        metricsValidation.issues as readonly ForeignIssue[],
      );
    }
  }

  const referenceFactsResult = ownDataProperty(root, 'referenceFacts', '$.referenceFacts', issues);
  if (referenceFactsResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.referenceFacts', 'referenceFacts is required');
  } else if (referenceFactsResult.kind === 'data') {
    const referenceFactsValidation = validateMLBPreTestValidationReferenceFacts(referenceFactsResult.value);
    if (!referenceFactsValidation.ok) {
      adaptForeignIssues(
        issues,
        'REFERENCE_FACTS_INVALID',
        '$.referenceFacts',
        referenceFactsValidation.issues as readonly ForeignIssue[],
      );
    }
  }
}

function validateMLBPreTestCandidateGateResult(
  value: unknown,
): { ok: true; value: MLBPreTestCandidateGateResult } | { ok: false; issues: MLBOuterValidationPromotionIssue[] } {
  const issues: MLBOuterValidationPromotionIssue[] = [];
  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$', 'Expected plain object');
    return { ok: false, issues };
  }
  const root = value as Record<string, unknown>;
  addKnownFieldIssues(root, new Set(['eligibility', 'reasons']), '$', issues);
  const eligibilityResult = ownDataProperty(root, 'eligibility', '$.eligibility', issues);
  if (eligibilityResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.eligibility', 'eligibility is required');
  } else if (eligibilityResult.kind === 'data' && eligibilityResult.value !== 'ELIGIBLE_FOR_TEST' && eligibilityResult.value !== 'REJECT_BEFORE_TEST') {
    pushIssue(issues, 'INVALID_LITERAL', '$.eligibility', 'eligibility must be ELIGIBLE_FOR_TEST or REJECT_BEFORE_TEST');
  }
  const reasonsResult = ownDataProperty(root, 'reasons', '$.reasons', issues);
  if (reasonsResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.reasons', 'reasons is required');
  } else if (reasonsResult.kind === 'data') {
    if (!Array.isArray(reasonsResult.value)) {
      pushIssue(issues, 'INVALID_ARRAY', '$.reasons', 'reasons must be an array');
    } else {
      const reasons = reasonsResult.value as unknown[];
      for (let i = 0; i < reasons.length; i++) {
        if (typeof reasons[i] !== 'string') {
          pushIssue(issues, 'INVALID_STRING', `$.reasons[${i}]`, 'each reason must be a string');
        }
      }
    }
  }
  const finalIssues = sortIssues(issues);
  if (finalIssues.length > 0) {
    return { ok: false, issues: finalIssues };
  }
  return { ok: true, value: value as MLBPreTestCandidateGateResult };
}

/* -------------------------------------------------------------------------- */
/*  Public validator                                                           */
/* -------------------------------------------------------------------------- */

export type MLBOuterValidationPromotionValidationResult =
  | Readonly<{ ok: true; value: MLBOuterValidationPromotionLedger }>
  | Readonly<{ ok: false; issues: readonly MLBOuterValidationPromotionIssue[] }>;

export function validateMLBOuterValidationPromotionLedger(
  value: unknown,
): MLBOuterValidationPromotionValidationResult {
  const issues: MLBOuterValidationPromotionIssue[] = [];

  try {
    assertNoOddsContamination(value);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('ODDS_CONTAMINATION')) {
        for (const line of error.message.split('\n')) {
          if (line.startsWith('path=')) {
            const firewallPath = line.slice(5).split('; ')[0];
            pushUniquePathCode(
              issues,
              {
                code: 'ODDS_CONTAMINATION',
                path: `$${firewallPath.replace(/^\./, '')}`,
                message: `Ledger contains prohibited field at ${firewallPath}`,
              } as MLBOuterValidationPromotionIssue,
            );
          }
        }
      } else if (
        error.name === 'UninspectableAccessorPropertyError' &&
        error.message.startsWith('UNINSPECTABLE_ACCESSOR_PROPERTY\n')
      ) {
        for (const line of error.message.split('\n')) {
          if (line.startsWith('path=')) {
            const accessorPath = line.slice(5);
            pushUniquePathCode(
              issues,
              {
                code: 'HOSTILE_ACCESSOR',
                path: `$${accessorPath.replace(/^\./, '')}`,
                message: 'Ledger contains an accessor property',
              } as MLBOuterValidationPromotionIssue,
            );
          }
        }
      }
    }
  }

  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$', 'Expected plain object');
    const finalIssues = sortIssues(issues);
    return { ok: false, issues: finalIssues };
  }

  const root = value as Record<string, unknown>;

  const statusResult = ownDataProperty(root, 'status', '$.status', issues);
  if (statusResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.status', 'status is required');
  } else if (statusResult.kind === 'data') {
    const allowedKeys = STATE_ALLOWED_KEYS[statusResult.value as string];
    if (allowedKeys) {
      addKnownFieldIssues(root, allowedKeys, '$', issues);
    }
  }

  for (const key of Object.getOwnPropertyNames(root)) {
    if (PROHIBITED_LEDGER_FIELDS.has(key)) {
      const descriptor = Object.getOwnPropertyDescriptor(root, key);
      if (descriptor && isDataDescriptor(descriptor)) {
        pushIssue(issues, 'PROHIBITED_CONCEPT', `$.${key}`, `Prohibited field: ${key}`);
      } else if (descriptor) {
        pushIssue(issues, 'HOSTILE_ACCESSOR', `$.${key}`, `Prohibited accessor: ${key}`);
      }
    }
  }

  const symbols = Object.getOwnPropertySymbols(root);
  for (const symbol of symbols) {
    pushIssue(
      issues,
      'HOSTILE_SYMBOL',
      `$[${String(symbol)}]`,
      `Unknown symbol property: ${symbol.description ?? symbol.toString()}`,
    );
  }

  if (statusResult.kind === 'missing') {
    const finalIssues = sortIssues(issues);
    return { ok: false, issues: finalIssues };
  } else if (statusResult.kind === 'data') {
    switch (statusResult.value) {
      case 'PREPARED':
        validatePrepared(root, issues);
        break;
      case 'PRE_VALIDATION_FAILED':
        validatePreValidationFailed(root, issues);
        break;
      case 'TRAIN_MODEL_READY':
        validateTrainModelReady(root, issues);
        break;
      case 'RUNNING_CONSUMED':
        validateRunningConsumed(root, issues);
        break;
      case 'ELIGIBLE_FOR_TEST':
        validateTerminalEligible(root, issues);
        break;
      case 'REJECT_BEFORE_TEST':
        validateTerminalRejected(root, issues);
        break;
      default:
        pushIssue(issues, 'INVALID_LITERAL', '$.status', `Unknown status: ${String(statusResult.value)}`);
    }
  }

  const finalIssues = sortIssues(issues);
  if (finalIssues.length > 0) {
    return { ok: false, issues: finalIssues };
  }

  if (statusResult.kind === 'data') {
    switch (statusResult.value) {
      case 'PREPARED':
        return { ok: true, value: root as MLBOuterValidationPromotionPrepared };
      case 'PRE_VALIDATION_FAILED':
        return { ok: true, value: root as MLBOuterValidationPromotionPreValidationFailed };
      case 'TRAIN_MODEL_READY':
        return { ok: true, value: root as MLBOuterValidationPromotionTrainModelReady };
      case 'RUNNING_CONSUMED':
        return { ok: true, value: root as MLBOuterValidationPromotionRunningConsumed };
      case 'ELIGIBLE_FOR_TEST':
        return { ok: true, value: root as MLBOuterValidationPromotionEligibleForTest };
      case 'REJECT_BEFORE_TEST':
        return { ok: true, value: root as MLBOuterValidationPromotionRejectBeforeTest };
    }
  }

  return { ok: true, value: root as MLBOuterValidationPromotionLedger };
}

const PROHIBITED_LEDGER_FIELDS = new Set([
  'testRowCount',
  'testTargets',
  'testProbabilities',
  'testMetrics',
  'testOutcomes',
  'testAccuracy',
]);

/* -------------------------------------------------------------------------- */
/*  Odds contamination guard (reuses existing project firewall)               */
/* -------------------------------------------------------------------------- */

function assertNoOddsContamination(value: unknown): void {
  const prohibitedKeys = new Set([
    'sportsbookOdds',
    'marketSpread',
    'moneyline',
    'total',
    'impliedProbability',
    'vig',
    'overround',
    'sportsbook',
    'bookmaker',
    'marketTotal',
    'line',
    'odds',
  ]);

  function inspect(target: Record<string, unknown>, path: string): void {
    const names = Object.getOwnPropertyNames(target);
    for (const key of names) {
      const currentPath = path === '$' ? `$.${key}` : `${path}.${key}`;
      if (prohibitedKeys.has(key)) {
        throw new Error(`ODDS_CONTAMINATION\npath=${currentPath}; key=${key}`);
      }
      const descriptor = Object.getOwnPropertyDescriptor(target, key);
      if (descriptor && !isDataDescriptor(descriptor)) {
        throw new Error(
          `UNINSPECTABLE_ACCESSOR_PROPERTY\npath=${currentPath}; key=${key}`,
        );
      }
      const value = descriptor?.value;
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        inspect(value as Record<string, unknown>, currentPath);
      }
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    inspect(value as Record<string, unknown>, '$');
  }
}
