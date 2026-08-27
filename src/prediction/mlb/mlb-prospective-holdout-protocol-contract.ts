import {
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
} from './mlb-inner-development-third-real-candidate-recipe';

import {
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE,
} from './mlb-inner-development-train-artifact';

import {
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH,
} from './mlb-inner-development-train-artifact-runtime-provenance';

import { MLB_PRETEST_GATE_POLICY_ID } from './mlb-pretest-validation-reference-contract';

export const MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_CONTRACT_VERSION =
  'mlb-prospective-holdout-protocol-v1' as const;

export const MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID =
  'mlb-v1-candidate-003-prospective-holdout-v1' as const;

export const MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION =
  'mlb-prospective-holdout-activation-v1' as const;

export const MLB_CANDIDATE_003_STARTER_COMPATIBILITY_POLICY_ID =
  'candidate-003-force-starter-availability-default-missing-v1' as const;

export const MLB_TRAIN_STARTER_FEATURES_ALL_DEFAULT_MISSING =
  'TRAIN_STARTER_FEATURES_ALL_DEFAULT_MISSING' as const;

export const MLB_SCIENTIFIC_CUTOFF_POLICY_ID =
  'MLB_FIXED_360_MINUTE_MODEL_INFORMATION_UPPER_BOUND_V1' as const;

export const MLB_CAPTURE_VALIDITY_POLICY_ID =
  'ALL_MODEL_INFORMATION_AT_OR_BEFORE_SCIENTIFIC_CUTOFF_V1' as const;

export const MLB_POST_T360_MODEL_INFORMATION_PROHIBITED_POLICY_ID =
  'POST_T360_MODEL_INFORMATION_PROHIBITED_V1' as const;

export const MLB_PROVENANCE_REWRITE_PROHIBITED_POLICY_ID =
  'PROVENANCE_REWRITE_PROHIBITED_V1' as const;

export const MLB_ACTUAL_DATA_CUTOFF_LTE_T360_REQUIRED_POLICY_ID =
  'ACTUAL_DATA_CUTOFF_LTE_T360_REQUIRED_V1' as const;

export const MLB_PROSPECTIVE_HOLDOUT_BOUNDARY_TYPE =
  'FIXED_MLB_OFFICIAL_DATE_BOUNDARY_V1' as const;

export const MLB_PROSPECTIVE_HOLDOUT_STABLE_SELECTION_ORDER =
  'scheduledStartAt_ASC_gamePk_ASC' as const;

export const MLB_PROSPECTIVE_HOLDOUT_FAIL_CLOSED_REASON =
  'INSUFFICIENT_VALIDATION_CAPTURES_FAIL_CLOSED' as const;

export const MLB_PROSPECTIVE_HOLDOUT_INSUFFICIENT_TEST_COUNT_REASON =
  'INSUFFICIENT_TEST_CAPTURES_FAIL_CLOSED' as const;

export const MLB_PROSPECTIVE_HOLDOUT_SELECTION_EXCLUSION_REASONS = Object.freeze([
  'CANCELLED_BEFORE_VALID_CAPTURE',
  'POSTPONED_OUTSIDE_FROZEN_TEMPORAL_SIDE',
  'SOURCE_OUTAGE_BEFORE_CUTOFF',
  'CAPTURE_NOT_COMPLETED_BY_SCIENTIFIC_CUTOFF',
  'SNAPSHOT_CONTRACT_INVALID_BEFORE_OUTCOME',
  'REQUIRED_MODEL_SOURCE_POST_CUTOFF',
  'DUPLICATE_GAME_IDENTITY',
] as const);

export const MLB_PROSPECTIVE_HOLDOUT_VALIDATION_TARGET_N = 67 as const;

export const MLB_PROSPECTIVE_HOLDOUT_TEST_TARGET_N = 69 as const;

export const MLB_PROSPECTIVE_HOLDOUT_SCI_CUTOFF_MINUTES = 360 as const;

export const MLB_PROSPECTIVE_HOLDOUT_PROTOCOL = Object.freeze({
  contractVersion: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_CONTRACT_VERSION,
  protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
  candidateRecipeId: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
  candidateFingerprint: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
  regularization: Object.freeze({ kind: 'L2', strength: 0.1 }),
  optimizer: Object.freeze({
    solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
    learningRate: 0.01,
    maxIterations: 5000,
    tolerance: 0.0001,
  }),
  featureChangesAllowed: false,
  hyperparameterChangesAllowed: false,
  candidate004Allowed: false,
  validationTuningAllowed: false,
  trainArtifactId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID,
  trainSourceDatasetId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID,
  trainArtifactSha256: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
  trainArtifactByteLength: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH,
  trainRowCount: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT,
  trainFirstOfficialDate: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE,
  trainLastOfficialDate: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE,
  featureManifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
  featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
  preprocessingPolicyId: 'raw-finite-feature-values-with-default-missing-v1',
  scientificCutoffMinutes: MLB_PROSPECTIVE_HOLDOUT_SCI_CUTOFF_MINUTES,
  scientificCutoffPolicyId: MLB_SCIENTIFIC_CUTOFF_POLICY_ID,
  captureValidityPolicyId: MLB_CAPTURE_VALIDITY_POLICY_ID,
  postT360ModelInformationProhibitedPolicyId: MLB_POST_T360_MODEL_INFORMATION_PROHIBITED_POLICY_ID,
  provenanceRewriteProhibitedPolicyId: MLB_PROVENANCE_REWRITE_PROHIBITED_POLICY_ID,
  actualDataCutoffLteT360RequiredPolicyId: MLB_ACTUAL_DATA_CUTOFF_LTE_T360_REQUIRED_POLICY_ID,
  validationTargetRowCount: MLB_PROSPECTIVE_HOLDOUT_VALIDATION_TARGET_N,
  testTargetRowCount: MLB_PROSPECTIVE_HOLDOUT_TEST_TARGET_N,
  insufficientTestCount: MLB_PROSPECTIVE_HOLDOUT_INSUFFICIENT_TEST_COUNT_REASON,
  stableSelectionOrder: MLB_PROSPECTIVE_HOLDOUT_STABLE_SELECTION_ORDER,
  boundaryType: MLB_PROSPECTIVE_HOLDOUT_BOUNDARY_TYPE,
  selectionExclusionReasons: MLB_PROSPECTIVE_HOLDOUT_SELECTION_EXCLUSION_REASONS,
  resultDependentSelectionAllowed: false,
  insufficientValidationCount: MLB_PROSPECTIVE_HOLDOUT_FAIL_CLOSED_REASON,
  automaticTestAfterValidationPass: false,
  gatePolicyId: MLB_PRETEST_GATE_POLICY_ID,
  candidate003StarterCompatibilityPolicyId: MLB_CANDIDATE_003_STARTER_COMPATIBILITY_POLICY_ID,
  starterCompatibilityHomeValue: 0,
  starterCompatibilityHomeWasMissing: true,
  starterCompatibilityAwayValue: 0,
  starterCompatibilityAwayWasMissing: true,
  labelTarget: 'OFFICIAL_FINAL_GAME_WINNER',
  labelEncoding: 'HOME_WIN_1_AWAY_WIN_0',
  oldHoldoutRetirementReason: 'HISTORICAL_PAYLOAD_UNAVAILABLE_AND_NOT_REPRODUCIBLE',
} satisfies MLBProspectiveHoldoutProtocol);

export type MLBProspectiveHoldoutProtocol = Readonly<{
  contractVersion: typeof MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_CONTRACT_VERSION;
  protocolId: typeof MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID;
  candidateRecipeId: typeof MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID;
  candidateFingerprint: typeof MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT;
  regularization: Readonly<{ kind: 'L2'; strength: number }>;
  optimizer: Readonly<{
    solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1';
    learningRate: number;
    maxIterations: number;
    tolerance: number;
  }>;
  featureChangesAllowed: false;
  hyperparameterChangesAllowed: false;
  candidate004Allowed: false;
  validationTuningAllowed: false;
  trainArtifactId: typeof MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID;
  trainSourceDatasetId: typeof MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID;
  trainArtifactSha256: typeof MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256;
  trainArtifactByteLength: typeof MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH;
  trainRowCount: typeof MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT;
  trainFirstOfficialDate: typeof MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE;
  trainLastOfficialDate: typeof MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE;
  featureManifestId: 'mlb-real-pregame-winner-feature-manifest-v1';
  featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1';
  preprocessingPolicyId: 'raw-finite-feature-values-with-default-missing-v1';
  scientificCutoffMinutes: 360;
  scientificCutoffPolicyId: typeof MLB_SCIENTIFIC_CUTOFF_POLICY_ID;
  captureValidityPolicyId: typeof MLB_CAPTURE_VALIDITY_POLICY_ID;
  postT360ModelInformationProhibitedPolicyId: typeof MLB_POST_T360_MODEL_INFORMATION_PROHIBITED_POLICY_ID;
  provenanceRewriteProhibitedPolicyId: typeof MLB_PROVENANCE_REWRITE_PROHIBITED_POLICY_ID;
  actualDataCutoffLteT360RequiredPolicyId: typeof MLB_ACTUAL_DATA_CUTOFF_LTE_T360_REQUIRED_POLICY_ID;
  validationTargetRowCount: 67;
  testTargetRowCount: 69;
  insufficientTestCount: typeof MLB_PROSPECTIVE_HOLDOUT_INSUFFICIENT_TEST_COUNT_REASON;
  stableSelectionOrder: typeof MLB_PROSPECTIVE_HOLDOUT_STABLE_SELECTION_ORDER;
  boundaryType: typeof MLB_PROSPECTIVE_HOLDOUT_BOUNDARY_TYPE;
  selectionExclusionReasons: readonly [
    'CANCELLED_BEFORE_VALID_CAPTURE',
    'POSTPONED_OUTSIDE_FROZEN_TEMPORAL_SIDE',
    'SOURCE_OUTAGE_BEFORE_CUTOFF',
    'CAPTURE_NOT_COMPLETED_BY_SCIENTIFIC_CUTOFF',
    'SNAPSHOT_CONTRACT_INVALID_BEFORE_OUTCOME',
    'REQUIRED_MODEL_SOURCE_POST_CUTOFF',
    'DUPLICATE_GAME_IDENTITY',
  ];
  resultDependentSelectionAllowed: false;
  insufficientValidationCount: typeof MLB_PROSPECTIVE_HOLDOUT_FAIL_CLOSED_REASON;
  automaticTestAfterValidationPass: false;
  gatePolicyId: typeof MLB_PRETEST_GATE_POLICY_ID;
  candidate003StarterCompatibilityPolicyId: typeof MLB_CANDIDATE_003_STARTER_COMPATIBILITY_POLICY_ID;
  starterCompatibilityHomeValue: 0;
  starterCompatibilityHomeWasMissing: true;
  starterCompatibilityAwayValue: 0;
  starterCompatibilityAwayWasMissing: true;
  labelTarget: 'OFFICIAL_FINAL_GAME_WINNER';
  labelEncoding: 'HOME_WIN_1_AWAY_WIN_0';
  oldHoldoutRetirementReason: 'HISTORICAL_PAYLOAD_UNAVAILABLE_AND_NOT_REPRODUCIBLE';
}>;

export type MLBProspectiveHoldoutProtocolIssue = Readonly<{
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
    | 'IDENTITY_MISMATCH'
    | 'PROHIBITED_FIELD';
  path: string;
  message: string;
}>;

export type MLBProspectiveHoldoutActivationSkeleton = Readonly<{
  contractVersion: typeof MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION;
  protocolId: typeof MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID;
  activationId: string;
  activatedAt: string;
  candidateSelectionStartAt: string;
  validationBoundaryOfficialDate: string;
  earliestCandidateScientificCutoffAt: string;
  optionalScheduleSnapshotIdentity: string | null;
}>;

export type MLBProspectiveHoldoutActivationIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_DATE'
    | 'INVALID_TIMESTAMP'
    | 'INVALID_TIMESTAMP_ORDER'
    | 'IDENTITY_MISMATCH';
  path: string;
  message: string;
}>;

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

function ownDataProperty(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBProspectiveHoldoutProtocolIssue[],
): { kind: 'data'; value: unknown } | { kind: 'missing' } | { kind: 'accessor' } {
  const descriptor = Object.getOwnPropertyDescriptor(root, key);
  if (!descriptor) {
    return { kind: 'missing' };
  }
  if (!isDataDescriptor(descriptor)) {
    pushProtocolIssue(issues, 'INVALID_JSON_VALUE', path, `${path} is an accessor property`);
    return { kind: 'accessor' };
  }
  return { kind: 'data', value: descriptor.value };
}

function pushProtocolIssue(
  issues: MLBProspectiveHoldoutProtocolIssue[],
  code: MLBProspectiveHoldoutProtocolIssue['code'],
  path: string,
  message: string,
): void {
  const exists = issues.some((item) => item.path === path && item.code === code);
  if (!exists) {
    issues.push({ code, path, message });
  }
}

function sortProtocolIssues(
  issues: MLBProspectiveHoldoutProtocolIssue[],
): readonly MLBProspectiveHoldoutProtocolIssue[] {
  return Object.freeze(
    issues
      .slice()
      .sort((a, b) => (a.path < b.path ? -1 : a.path === b.path ? 0 : 1)
        || (a.code < b.code ? -1 : a.code === b.code ? 0 : 1))
      .filter((item, index, array) =>
        index === 0 || item.path !== array[index - 1].path || item.code !== array[index - 1].code,
      ),
  );
}

const KNOWN_PROTOCOL_FIELDS = new Set([
  'contractVersion',
  'protocolId',
  'candidateRecipeId',
  'candidateFingerprint',
  'regularization',
  'optimizer',
  'featureChangesAllowed',
  'hyperparameterChangesAllowed',
  'candidate004Allowed',
  'validationTuningAllowed',
  'trainArtifactId',
  'trainSourceDatasetId',
  'trainArtifactSha256',
  'trainArtifactByteLength',
  'trainRowCount',
  'trainFirstOfficialDate',
  'trainLastOfficialDate',
  'featureManifestId',
  'featurePolicyId',
  'preprocessingPolicyId',
  'scientificCutoffMinutes',
  'scientificCutoffPolicyId',
  'captureValidityPolicyId',
  'postT360ModelInformationProhibitedPolicyId',
  'provenanceRewriteProhibitedPolicyId',
  'actualDataCutoffLteT360RequiredPolicyId',
  'validationTargetRowCount',
  'testTargetRowCount',
  'insufficientTestCount',
  'stableSelectionOrder',
  'boundaryType',
  'selectionExclusionReasons',
  'resultDependentSelectionAllowed',
  'insufficientValidationCount',
  'automaticTestAfterValidationPass',
  'gatePolicyId',
  'candidate003StarterCompatibilityPolicyId',
  'starterCompatibilityHomeValue',
  'starterCompatibilityHomeWasMissing',
  'starterCompatibilityAwayValue',
  'starterCompatibilityAwayWasMissing',
  'labelTarget',
  'labelEncoding',
  'oldHoldoutRetirementReason',
]);

function validateProtocolRoot(
  root: Record<string, unknown>,
  issues: MLBProspectiveHoldoutProtocolIssue[],
): void {
  for (const key of Object.getOwnPropertyNames(root)) {
    if (!KNOWN_PROTOCOL_FIELDS.has(key)) {
      const descriptor = Object.getOwnPropertyDescriptor(root, key);
      if (descriptor && isDataDescriptor(descriptor)) {
        pushProtocolIssue(issues, 'PROHIBITED_FIELD', `$.${key}`, `Unknown field: ${key}`);
      } else if (descriptor) {
        pushProtocolIssue(issues, 'INVALID_JSON_VALUE', `$.${key}`, 'Accessor property');
      }
    }
  }
  for (const symbol of Object.getOwnPropertySymbols(root)) {
    pushProtocolIssue(issues, 'PROHIBITED_FIELD', `$[${String(symbol)}]`, `Symbol property: ${symbol.description ?? symbol.toString()}`);
  }
}

function validateContractVersion(root: Record<string, unknown>, issues: MLBProspectiveHoldoutProtocolIssue[]): void {
  const result = ownDataProperty(root, 'contractVersion', '$.contractVersion', issues);
  if (result.kind === 'missing') {
    pushProtocolIssue(issues, 'MISSING_FIELD', '$.contractVersion', 'contractVersion is required');
    return;
  }
  if (result.kind === 'accessor') return;
  if (result.value !== MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_CONTRACT_VERSION) {
    pushProtocolIssue(issues, 'IDENTITY_MISMATCH', '$.contractVersion', 'contractVersion does not match frozen protocol');
  }
}

function validateProtocolId(root: Record<string, unknown>, issues: MLBProspectiveHoldoutProtocolIssue[]): void {
  const result = ownDataProperty(root, 'protocolId', '$.protocolId', issues);
  if (result.kind === 'missing') {
    pushProtocolIssue(issues, 'MISSING_FIELD', '$.protocolId', 'protocolId is required');
    return;
  }
  if (result.kind === 'accessor') return;
  if (!isStrictNonEmptyTrimmedString(result.value) || result.value !== MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID) {
    pushProtocolIssue(issues, 'IDENTITY_MISMATCH', '$.protocolId', 'protocolId does not match frozen protocol');
  }
}

function validateCandidateRecipeId(root: Record<string, unknown>, issues: MLBProspectiveHoldoutProtocolIssue[]): void {
  const result = ownDataProperty(root, 'candidateRecipeId', '$.candidateRecipeId', issues);
  if (result.kind === 'missing') {
    pushProtocolIssue(issues, 'MISSING_FIELD', '$.candidateRecipeId', 'candidateRecipeId is required');
    return;
  }
  if (result.kind === 'accessor') return;
  if (!isStrictNonEmptyTrimmedString(result.value) || result.value !== MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID) {
    pushProtocolIssue(issues, 'IDENTITY_MISMATCH', '$.candidateRecipeId', 'candidateRecipeId does not match frozen candidate');
  }
}

function validateCandidateFingerprint(root: Record<string, unknown>, issues: MLBProspectiveHoldoutProtocolIssue[]): void {
  const result = ownDataProperty(root, 'candidateFingerprint', '$.candidateFingerprint', issues);
  if (result.kind === 'missing') {
    pushProtocolIssue(issues, 'MISSING_FIELD', '$.candidateFingerprint', 'candidateFingerprint is required');
    return;
  }
  if (result.kind === 'accessor') return;
  if (!isStrictNonEmptyTrimmedString(result.value) || result.value !== MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT) {
    pushProtocolIssue(issues, 'IDENTITY_MISMATCH', '$.candidateFingerprint', 'candidateFingerprint does not match frozen candidate');
  }
}

function validateRegularization(root: Record<string, unknown>, issues: MLBProspectiveHoldoutProtocolIssue[]): void {
  const result = ownDataProperty(root, 'regularization', '$.regularization', issues);
  if (result.kind === 'missing') {
    pushProtocolIssue(issues, 'MISSING_FIELD', '$.regularization', 'regularization is required');
    return;
  }
  if (result.kind === 'accessor') return;
  if (!isPlainObject(result.value)) {
    pushProtocolIssue(issues, 'NOT_PLAIN_OBJECT', '$.regularization', 'regularization must be a plain object');
    return;
  }
  const reg = result.value as Record<string, unknown>;
  const kindResult = ownDataProperty(reg, 'kind', '$.regularization.kind', issues);
  if (kindResult.kind === 'missing') {
    pushProtocolIssue(issues, 'MISSING_FIELD', '$.regularization.kind', 'regularization.kind is required');
  } else if (kindResult.kind === 'data' && kindResult.value !== 'L2') {
    pushProtocolIssue(issues, 'INVALID_LITERAL', '$.regularization.kind', 'regularization.kind must be L2');
  }
  const strengthResult = ownDataProperty(reg, 'strength', '$.regularization.strength', issues);
  if (strengthResult.kind === 'missing') {
    pushProtocolIssue(issues, 'MISSING_FIELD', '$.regularization.strength', 'regularization.strength is required');
  } else if (strengthResult.kind === 'data') {
    if (typeof strengthResult.value !== 'number' || !Number.isFinite(strengthResult.value) || strengthResult.value !== 0.1) {
      pushProtocolIssue(issues, 'IDENTITY_MISMATCH', '$.regularization.strength', 'regularization.strength must be 0.1');
    }
  }
}

function validateOptimizer(root: Record<string, unknown>, issues: MLBProspectiveHoldoutProtocolIssue[]): void {
  const result = ownDataProperty(root, 'optimizer', '$.optimizer', issues);
  if (result.kind === 'missing') {
    pushProtocolIssue(issues, 'MISSING_FIELD', '$.optimizer', 'optimizer is required');
    return;
  }
  if (result.kind === 'accessor') return;
  if (!isPlainObject(result.value)) {
    pushProtocolIssue(issues, 'NOT_PLAIN_OBJECT', '$.optimizer', 'optimizer must be a plain object');
    return;
  }
  const opt = result.value as Record<string, unknown>;
  const fields: Array<{ key: string; path: string; expected: unknown }> = [
    { key: 'solver', path: '$.optimizer.solver', expected: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1' },
    { key: 'learningRate', path: '$.optimizer.learningRate', expected: 0.01 },
    { key: 'maxIterations', path: '$.optimizer.maxIterations', expected: 5000 },
    { key: 'tolerance', path: '$.optimizer.tolerance', expected: 0.0001 },
  ];
  for (const field of fields) {
    const fieldResult = ownDataProperty(opt, field.key, field.path, issues);
    if (fieldResult.kind === 'missing') {
      pushProtocolIssue(issues, 'MISSING_FIELD', field.path, `${field.key} is required`);
    } else if (fieldResult.kind === 'data' && fieldResult.value !== field.expected) {
      pushProtocolIssue(issues, 'IDENTITY_MISMATCH', field.path, `${field.key} does not match frozen optimizer`);
    }
  }
}

function validateBooleanFlag(
  root: Record<string, unknown>,
  key: string,
  path: string,
  expected: boolean,
  issues: MLBProspectiveHoldoutProtocolIssue[],
): void {
  const result = ownDataProperty(root, key, path, issues);
  if (result.kind === 'missing') {
    pushProtocolIssue(issues, 'MISSING_FIELD', path, `${key} is required`);
    return;
  }
  if (result.kind === 'accessor') return;
  if (result.value !== expected) {
    pushProtocolIssue(issues, 'INVALID_BOOLEAN', path, `${key} must be ${expected}`);
  }
}

function validateStringLiteral(
  root: Record<string, unknown>,
  key: string,
  path: string,
  expected: string,
  issues: MLBProspectiveHoldoutProtocolIssue[],
): void {
  const result = ownDataProperty(root, key, path, issues);
  if (result.kind === 'missing') {
    pushProtocolIssue(issues, 'MISSING_FIELD', path, `${key} is required`);
    return;
  }
  if (result.kind === 'accessor') return;
  if (!isStrictNonEmptyTrimmedString(result.value) || result.value !== expected) {
    pushProtocolIssue(issues, 'IDENTITY_MISMATCH', path, `${key} does not match frozen value`);
  }
}

function validatePositiveInteger(
  root: Record<string, unknown>,
  key: string,
  path: string,
  expected: number,
  issues: MLBProspectiveHoldoutProtocolIssue[],
): void {
  const result = ownDataProperty(root, key, path, issues);
  if (result.kind === 'missing') {
    pushProtocolIssue(issues, 'MISSING_FIELD', path, `${key} is required`);
    return;
  }
  if (result.kind === 'accessor') return;
  if (typeof result.value !== 'number' || !Number.isSafeInteger(result.value) || result.value !== expected) {
    pushProtocolIssue(issues, 'IDENTITY_MISMATCH', path, `${key} must be ${expected}`);
  }
}

function validateSelectionExclusionReasons(
  root: Record<string, unknown>,
  issues: MLBProspectiveHoldoutProtocolIssue[],
): void {
  const result = ownDataProperty(root, 'selectionExclusionReasons', '$.selectionExclusionReasons', issues);
  if (result.kind === 'missing') {
    pushProtocolIssue(issues, 'MISSING_FIELD', '$.selectionExclusionReasons', 'selectionExclusionReasons is required');
    return;
  }
  if (result.kind === 'accessor') return;
  if (!Array.isArray(result.value)) {
    pushProtocolIssue(issues, 'INVALID_ARRAY', '$.selectionExclusionReasons', 'selectionExclusionReasons must be an array');
    return;
  }
  const values = result.value as unknown[];
  if (values.length !== MLB_PROSPECTIVE_HOLDOUT_SELECTION_EXCLUSION_REASONS.length) {
    pushProtocolIssue(issues, 'INVALID_ARRAY', '$.selectionExclusionReasons', 'selectionExclusionReasons length mismatch');
    return;
  }
  for (let i = 0; i < values.length; i++) {
    const item = values[i];
    const path = `$.selectionExclusionReasons[${i}]`;
    if (!isStrictNonEmptyTrimmedString(item) || item !== MLB_PROSPECTIVE_HOLDOUT_SELECTION_EXCLUSION_REASONS[i]) {
      pushProtocolIssue(issues, 'IDENTITY_MISMATCH', path, `selectionExclusionReasons[${i}] does not match frozen exclusion reason`);
    }
  }
}

export function validateMLBProspectiveHoldoutProtocol(
  value: unknown,
):
  | Readonly<{ ok: true; value: MLBProspectiveHoldoutProtocol }>
  | Readonly<{ ok: false; issues: readonly MLBProspectiveHoldoutProtocolIssue[] }> {
  const issues: MLBProspectiveHoldoutProtocolIssue[] = [];

  if (!isPlainObject(value)) {
    pushProtocolIssue(issues, 'NOT_PLAIN_OBJECT', '$', 'Expected plain object');
    return { ok: false, issues: sortProtocolIssues(issues) };
  }

  const root = value as Record<string, unknown>;

  validateProtocolRoot(root, issues);
  validateContractVersion(root, issues);
  validateProtocolId(root, issues);
  validateCandidateRecipeId(root, issues);
  validateCandidateFingerprint(root, issues);
  validateRegularization(root, issues);
  validateOptimizer(root, issues);
  validateBooleanFlag(root, 'featureChangesAllowed', '$.featureChangesAllowed', false, issues);
  validateBooleanFlag(root, 'hyperparameterChangesAllowed', '$.hyperparameterChangesAllowed', false, issues);
  validateBooleanFlag(root, 'candidate004Allowed', '$.candidate004Allowed', false, issues);
  validateBooleanFlag(root, 'validationTuningAllowed', '$.validationTuningAllowed', false, issues);
  validateStringLiteral(root, 'trainArtifactId', '$.trainArtifactId', MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID, issues);
  validateStringLiteral(root, 'trainSourceDatasetId', '$.trainSourceDatasetId', MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID, issues);
  validateStringLiteral(root, 'trainArtifactSha256', '$.trainArtifactSha256', MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256, issues);
  validatePositiveInteger(root, 'trainArtifactByteLength', '$.trainArtifactByteLength', MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH, issues);
  validatePositiveInteger(root, 'trainRowCount', '$.trainRowCount', MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT, issues);
  validateStringLiteral(root, 'trainFirstOfficialDate', '$.trainFirstOfficialDate', MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE, issues);
  validateStringLiteral(root, 'trainLastOfficialDate', '$.trainLastOfficialDate', MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE, issues);
  validateStringLiteral(root, 'featureManifestId', '$.featureManifestId', 'mlb-real-pregame-winner-feature-manifest-v1', issues);
  validateStringLiteral(root, 'featurePolicyId', '$.featurePolicyId', 'mlb-real-pregame-winner-feature-policy-v1', issues);
  validateStringLiteral(root, 'preprocessingPolicyId', '$.preprocessingPolicyId', 'raw-finite-feature-values-with-default-missing-v1', issues);
  validatePositiveInteger(root, 'scientificCutoffMinutes', '$.scientificCutoffMinutes', 360, issues);
  validateStringLiteral(root, 'scientificCutoffPolicyId', '$.scientificCutoffPolicyId', MLB_SCIENTIFIC_CUTOFF_POLICY_ID, issues);
  validateStringLiteral(root, 'captureValidityPolicyId', '$.captureValidityPolicyId', MLB_CAPTURE_VALIDITY_POLICY_ID, issues);
  validateStringLiteral(root, 'postT360ModelInformationProhibitedPolicyId', '$.postT360ModelInformationProhibitedPolicyId', MLB_POST_T360_MODEL_INFORMATION_PROHIBITED_POLICY_ID, issues);
  validateStringLiteral(root, 'provenanceRewriteProhibitedPolicyId', '$.provenanceRewriteProhibitedPolicyId', MLB_PROVENANCE_REWRITE_PROHIBITED_POLICY_ID, issues);
  validateStringLiteral(root, 'actualDataCutoffLteT360RequiredPolicyId', '$.actualDataCutoffLteT360RequiredPolicyId', MLB_ACTUAL_DATA_CUTOFF_LTE_T360_REQUIRED_POLICY_ID, issues);
  validatePositiveInteger(root, 'validationTargetRowCount', '$.validationTargetRowCount', 67, issues);
  validatePositiveInteger(root, 'testTargetRowCount', '$.testTargetRowCount', 69, issues);
  validateStringLiteral(root, 'insufficientTestCount', '$.insufficientTestCount', MLB_PROSPECTIVE_HOLDOUT_INSUFFICIENT_TEST_COUNT_REASON, issues);
  validateStringLiteral(root, 'stableSelectionOrder', '$.stableSelectionOrder', MLB_PROSPECTIVE_HOLDOUT_STABLE_SELECTION_ORDER, issues);
  validateStringLiteral(root, 'boundaryType', '$.boundaryType', MLB_PROSPECTIVE_HOLDOUT_BOUNDARY_TYPE, issues);
  validateSelectionExclusionReasons(root, issues);
  validateBooleanFlag(root, 'resultDependentSelectionAllowed', '$.resultDependentSelectionAllowed', false, issues);
  validateStringLiteral(root, 'insufficientValidationCount', '$.insufficientValidationCount', MLB_PROSPECTIVE_HOLDOUT_FAIL_CLOSED_REASON, issues);
  validateBooleanFlag(root, 'automaticTestAfterValidationPass', '$.automaticTestAfterValidationPass', false, issues);
  validateStringLiteral(root, 'gatePolicyId', '$.gatePolicyId', MLB_PRETEST_GATE_POLICY_ID, issues);
  validateStringLiteral(root, 'candidate003StarterCompatibilityPolicyId', '$.candidate003StarterCompatibilityPolicyId', MLB_CANDIDATE_003_STARTER_COMPATIBILITY_POLICY_ID, issues);
  validatePositiveInteger(root, 'starterCompatibilityHomeValue', '$.starterCompatibilityHomeValue', 0, issues);
  validateBooleanFlag(root, 'starterCompatibilityHomeWasMissing', '$.starterCompatibilityHomeWasMissing', true, issues);
  validatePositiveInteger(root, 'starterCompatibilityAwayValue', '$.starterCompatibilityAwayValue', 0, issues);
  validateBooleanFlag(root, 'starterCompatibilityAwayWasMissing', '$.starterCompatibilityAwayWasMissing', true, issues);
  validateStringLiteral(root, 'labelTarget', '$.labelTarget', 'OFFICIAL_FINAL_GAME_WINNER', issues);
  validateStringLiteral(root, 'labelEncoding', '$.labelEncoding', 'HOME_WIN_1_AWAY_WIN_0', issues);
  validateStringLiteral(root, 'oldHoldoutRetirementReason', '$.oldHoldoutRetirementReason', 'HISTORICAL_PAYLOAD_UNAVAILABLE_AND_NOT_REPRODUCIBLE', issues);

  if (issues.length > 0) {
    return { ok: false, issues: sortProtocolIssues(issues) };
  }

  return {
    ok: true,
    value: Object.freeze({ ...root }) as MLBProspectiveHoldoutProtocol,
  };
}

/* -------------------------------------------------------------------------- */
/*  Activation skeleton validator                                               */
/* -------------------------------------------------------------------------- */

const KNOWN_ACTIVATION_FIELDS = new Set([
  'contractVersion',
  'protocolId',
  'activationId',
  'activatedAt',
  'candidateSelectionStartAt',
  'validationBoundaryOfficialDate',
  'earliestCandidateScientificCutoffAt',
  'optionalScheduleSnapshotIdentity',
]);

function validateActivationRoot(
  root: Record<string, unknown>,
  issues: MLBProspectiveHoldoutActivationIssue[],
): void {
  for (const key of Object.getOwnPropertyNames(root)) {
    if (!KNOWN_ACTIVATION_FIELDS.has(key)) {
      const descriptor = Object.getOwnPropertyDescriptor(root, key);
      if (descriptor && isDataDescriptor(descriptor)) {
        pushActivationIssue(issues, 'UNKNOWN_FIELD', `$.${key}`, `Unknown field: ${key}`);
      } else if (descriptor) {
        pushActivationIssue(issues, 'INVALID_JSON_VALUE', `$.${key}`, 'Accessor property');
      }
    }
  }
  for (const symbol of Object.getOwnPropertySymbols(root)) {
    pushActivationIssue(issues, 'UNKNOWN_FIELD', `$[${String(symbol)}]`, `Symbol property: ${symbol.description ?? symbol.toString()}`);
  }
}

function validateTimestamp(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBProspectiveHoldoutActivationIssue[],
): void {
  const result = ownDataPropertyActivation(root, key, path, issues);
  if (result.kind === 'missing') {
    pushActivationIssue(issues, 'MISSING_FIELD', path, `${key} is required`);
    return;
  }
  if (result.kind === 'accessor') return;
  if (typeof result.value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(result.value)) {
    pushActivationIssue(issues, 'INVALID_TIMESTAMP', path, 'Must be a strict RFC-3339 timestamp');
    return;
  }
  const ms = Date.parse(result.value);
  if (!Number.isFinite(ms)) {
    pushActivationIssue(issues, 'INVALID_TIMESTAMP', path, 'Must be a finite timestamp');
  }
}

function validateDate(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBProspectiveHoldoutActivationIssue[],
): void {
  const result = ownDataPropertyActivation(root, key, path, issues);
  if (result.kind === 'missing') {
    pushActivationIssue(issues, 'MISSING_FIELD', path, `${key} is required`);
    return;
  }
  if (result.kind === 'accessor') return;
  if (typeof result.value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(result.value)) {
    pushActivationIssue(issues, 'INVALID_DATE', path, 'Must be YYYY-MM-DD');
    return;
  }
  const [year, month, day] = (result.value as string).split('-').map(Number);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    pushActivationIssue(issues, 'INVALID_DATE', path, 'Must be a valid date');
    return;
  }
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1] + (month === 2 && leap ? 1 : 0)) {
    pushActivationIssue(issues, 'INVALID_DATE', path, 'Must be a valid Gregorian date');
  }
}

function ownDataPropertyActivation(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBProspectiveHoldoutActivationIssue[],
): { kind: 'data'; value: unknown } | { kind: 'missing' } | { kind: 'accessor' } {
  const descriptor = Object.getOwnPropertyDescriptor(root, key);
  if (!descriptor) {
    return { kind: 'missing' };
  }
  if (!isDataDescriptor(descriptor)) {
    pushActivationIssue(issues, 'INVALID_JSON_VALUE', path, `${path} is an accessor property`);
    return { kind: 'accessor' };
  }
  return { kind: 'data', value: descriptor.value };
}

function pushActivationIssue(
  issues: MLBProspectiveHoldoutActivationIssue[],
  code: MLBProspectiveHoldoutActivationIssue['code'],
  path: string,
  message: string,
): void {
  const exists = issues.some((item) => item.path === path && item.code === code);
  if (!exists) {
    issues.push({ code, path, message });
  }
}

function sortActivationIssues(
  issues: MLBProspectiveHoldoutActivationIssue[],
): readonly MLBProspectiveHoldoutActivationIssue[] {
  return Object.freeze(
    issues
      .slice()
      .sort((a, b) => (a.path < b.path ? -1 : a.path === b.path ? 0 : 1)
        || (a.code < b.code ? -1 : a.code === b.code ? 0 : 1))
      .filter((item, index, array) =>
        index === 0 || item.path !== array[index - 1].path || item.code !== array[index - 1].code,
      ),
  );
}

export function validateMLBProspectiveHoldoutActivationSkeleton(
  value: unknown,
):
  | Readonly<{ ok: true; value: MLBProspectiveHoldoutActivationSkeleton }>
  | Readonly<{ ok: false; issues: readonly MLBProspectiveHoldoutActivationIssue[] }> {
  const issues: MLBProspectiveHoldoutActivationIssue[] = [];

  if (!isPlainObject(value)) {
    pushActivationIssue(issues, 'NOT_PLAIN_OBJECT', '$', 'Expected plain object');
    return { ok: false, issues: sortActivationIssues(issues) };
  }

  const root = value as Record<string, unknown>;

  validateActivationRoot(root, issues);

  const contractVersionResult = ownDataPropertyActivation(root, 'contractVersion', '$.contractVersion', issues);
  if (contractVersionResult.kind === 'missing') {
    pushActivationIssue(issues, 'MISSING_FIELD', '$.contractVersion', 'contractVersion is required');
  } else if (contractVersionResult.kind === 'data' && contractVersionResult.value !== MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION) {
    pushActivationIssue(issues, 'IDENTITY_MISMATCH', '$.contractVersion', 'contractVersion does not match activation skeleton');
  }

  const protocolIdResult = ownDataPropertyActivation(root, 'protocolId', '$.protocolId', issues);
  if (protocolIdResult.kind === 'missing') {
    pushActivationIssue(issues, 'MISSING_FIELD', '$.protocolId', 'protocolId is required');
  } else if (protocolIdResult.kind === 'data' && (!isStrictNonEmptyTrimmedString(protocolIdResult.value) || protocolIdResult.value !== MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID)) {
    pushActivationIssue(issues, 'IDENTITY_MISMATCH', '$.protocolId', 'protocolId does not match frozen protocol');
  }

  const activationIdResult = ownDataPropertyActivation(root, 'activationId', '$.activationId', issues);
  if (activationIdResult.kind === 'missing') {
    pushActivationIssue(issues, 'MISSING_FIELD', '$.activationId', 'activationId is required');
  } else if (activationIdResult.kind === 'data' && !isStrictNonEmptyTrimmedString(activationIdResult.value)) {
    pushActivationIssue(issues, 'INVALID_STRING', '$.activationId', 'activationId must be a non-empty trimmed string');
  }

  validateTimestamp(root, 'activatedAt', '$.activatedAt', issues);
  validateTimestamp(root, 'candidateSelectionStartAt', '$.candidateSelectionStartAt', issues);
  validateDate(root, 'validationBoundaryOfficialDate', '$.validationBoundaryOfficialDate', issues);
  validateTimestamp(root, 'earliestCandidateScientificCutoffAt', '$.earliestCandidateScientificCutoffAt', issues);

  const optionalResult = ownDataPropertyActivation(root, 'optionalScheduleSnapshotIdentity', '$.optionalScheduleSnapshotIdentity', issues);
  if (optionalResult.kind === 'missing') {
    pushActivationIssue(issues, 'MISSING_FIELD', '$.optionalScheduleSnapshotIdentity', 'optionalScheduleSnapshotIdentity is required');
  } else if (optionalResult.kind === 'data') {
    if (optionalResult.value !== null && typeof optionalResult.value !== 'string') {
      pushActivationIssue(issues, 'INVALID_STRING', '$.optionalScheduleSnapshotIdentity', 'optionalScheduleSnapshotIdentity must be string or null');
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortActivationIssues(issues) };
  }

  const activatedAtMs = Date.parse(root.activatedAt as string);
  const selectionStartMs = Date.parse(root.candidateSelectionStartAt as string);
  const cutoffMs = Date.parse(root.earliestCandidateScientificCutoffAt as string);

  if (Number.isFinite(activatedAtMs) && Number.isFinite(cutoffMs) && activatedAtMs >= cutoffMs) {
    pushActivationIssue(
      issues,
      'INVALID_TIMESTAMP_ORDER',
      '$.activatedAt',
      'activatedAt must be before earliestCandidateScientificCutoffAt',
    );
  }

  if (Number.isFinite(selectionStartMs) && Number.isFinite(cutoffMs) && selectionStartMs >= cutoffMs) {
    pushActivationIssue(
      issues,
      'INVALID_TIMESTAMP_ORDER',
      '$.candidateSelectionStartAt',
      'candidateSelectionStartAt must be before earliestCandidateScientificCutoffAt',
    );
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortActivationIssues(issues) };
  }

  return {
    ok: true,
    value: Object.freeze({
      contractVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
      protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
      activationId: root.activationId as string,
      activatedAt: root.activatedAt as string,
      candidateSelectionStartAt: root.candidateSelectionStartAt as string,
      validationBoundaryOfficialDate: root.validationBoundaryOfficialDate as string,
      earliestCandidateScientificCutoffAt: root.earliestCandidateScientificCutoffAt as string,
      optionalScheduleSnapshotIdentity: root.optionalScheduleSnapshotIdentity as string | null,
    }) as MLBProspectiveHoldoutActivationSkeleton,
  };
}
