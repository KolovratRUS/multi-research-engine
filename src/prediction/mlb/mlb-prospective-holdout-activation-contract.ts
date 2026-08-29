import {
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
} from './mlb-inner-development-third-real-candidate-recipe';
import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
} from './mlb-prospective-holdout-protocol-contract';
import {
  MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
  MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
} from './mlb-prospective-t360-capture-contract';
import {
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
} from './mlb-prospective-pregame-evidence-artifact-contract';
import {
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
} from './mlb-prospective-holdout-game-identity-binding-contract';

/* -------------------------------------------------------------------------- */
/*  Contract versions                                                         */
/* -------------------------------------------------------------------------- */

export const MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION =
  'mlb-prospective-holdout-activation-v1' as const;

export const MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_VERSION =
  'mlb-prospective-holdout-activation-store-v1' as const;

export const MLB_PROSPECTIVE_HOLDOUT_COHORT_REGISTRATION_VERSION =
  'mlb-prospective-holdout-cohort-registration-v1' as const;

export const MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_DIRECTORY =
  'var/mlb-development/mlb-prospective-holdout-activations' as const;

/* -------------------------------------------------------------------------- */
/*  Frozen policy literals                                                     */
/* -------------------------------------------------------------------------- */

export const MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY =
  'scheduledStartAt_ASC_gamePk_ASC' as const;

export const MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE =
  'OFFICIAL_DATE_LTE_BOUNDARY' as const;

export const MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE =
  'OFFICIAL_DATE_GT_BOUNDARY' as const;

export const MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE =
  'NO_TEST_AUTHORIZATION' as const;

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveHoldoutActivation = Readonly<{
  contractVersion: typeof MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION;
  protocolId: typeof MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID;
  activationId: string;
  candidateRecipeId: typeof MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID;
  candidateFingerprint: typeof MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT;
  featureManifestId: 'mlb-real-pregame-winner-feature-manifest-v1';
  featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1';
  preprocessingPolicyId: 'raw-finite-feature-values-with-default-missing-v1';
  captureContractVersion: typeof MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION;
  compatibilityLayerId: typeof MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1;
  evidenceArtifactContractVersion: typeof MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION;
  evidenceStoreVersion: typeof MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION;
  validationBoundaryOfficialDate: string;
  validationTargetCount: 67;
  testTargetCount: 69;
  stableOrderPolicy: typeof MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY;
  validationSideDateRule: typeof MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE;
  testSideDateRule: typeof MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE;
  noSmallerN: true;
  resultIndependentSelection: true;
  testAuthorizationRule: typeof MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE;
  gameIdentityBindingContractVersion: typeof MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION;
  gameIdentityBindingStoreVersion: typeof MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION;
}>;

export type MLBProspectiveHoldoutActivationPersisted = Readonly<
  MLBProspectiveHoldoutActivation & { persistedAt: string }
>;

export type MLBProspectiveHoldoutActivationReceipt = Readonly<{
  storeVersion: typeof MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_VERSION;
  contractVersion: typeof MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION;
  activationId: string;
  relativePath: string;
  sha256: string;
  byteLength: number;
  persistedAt: string;
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
    | 'IDENTITY_MISMATCH'
    | 'PROHIBITED_FIELD'
    | 'ACTIVATION_CONTRACT_INVALID';
  path: string;
  message: string;
}>;

export type MLBProspectiveHoldoutActivationValidationResult =
  | Readonly<{ ok: true; value: MLBProspectiveHoldoutActivation }>
  | Readonly<{ ok: false; issues: readonly MLBProspectiveHoldoutActivationIssue[] }>;

export type MLBProspectiveHoldoutActivationPersistedValidationResult =
  | Readonly<{ ok: true; value: MLBProspectiveHoldoutActivationPersisted }>
  | Readonly<{ ok: false; issues: readonly MLBProspectiveHoldoutActivationIssue[] }>;

export type MLBProspectiveHoldoutActivationPersistenceResult =
  | Readonly<{ ok: true; receipt: MLBProspectiveHoldoutActivationReceipt }>
  | Readonly<{ ok: false; issues: readonly MLBProspectiveHoldoutActivationIssue[] }>;

export type MLBProspectiveHoldoutActivationReadResult =
  | Readonly<{ ok: true; value: MLBProspectiveHoldoutActivationPersisted; receipt: MLBProspectiveHoldoutActivationReceipt }>
  | Readonly<{ ok: false; issues: readonly MLBProspectiveHoldoutActivationIssue[] }>;

/* -------------------------------------------------------------------------- */
/*  Validation helpers                                                        */
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

function ownDataProperty(
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

function validateActivationRoot(
  root: Record<string, unknown>,
  issues: MLBProspectiveHoldoutActivationIssue[],
): void {
  for (const key of Object.getOwnPropertyNames(root)) {
    if (!KNOWN_ACTIVATION_FIELDS.has(key)) {
      const descriptor = Object.getOwnPropertyDescriptor(root, key);
      if (descriptor && isDataDescriptor(descriptor)) {
        pushActivationIssue(issues, 'PROHIBITED_FIELD', `$.${key}`, `Unknown field: ${key}`);
      } else if (descriptor) {
        pushActivationIssue(issues, 'INVALID_JSON_VALUE', `$.${key}`, 'Accessor property');
      }
    }
  }
  for (const symbol of Object.getOwnPropertySymbols(root)) {
    pushActivationIssue(issues, 'PROHIBITED_FIELD', `$[${String(symbol)}]`, `Symbol property: ${symbol.description ?? symbol.toString()}`);
  }
}

function validateContractVersion(root: Record<string, unknown>, issues: MLBProspectiveHoldoutActivationIssue[]): void {
  const result = ownDataProperty(root, 'contractVersion', '$.contractVersion', issues);
  if (result.kind === 'missing') {
    pushActivationIssue(issues, 'MISSING_FIELD', '$.contractVersion', 'contractVersion is required');
    return;
  }
  if (result.kind === 'accessor') return;
  if (result.value !== MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION) {
    pushActivationIssue(issues, 'IDENTITY_MISMATCH', '$.contractVersion', 'contractVersion does not match frozen activation');
  }
}

function validateProtocolId(root: Record<string, unknown>, issues: MLBProspectiveHoldoutActivationIssue[]): void {
  const result = ownDataProperty(root, 'protocolId', '$.protocolId', issues);
  if (result.kind === 'missing') {
    pushActivationIssue(issues, 'MISSING_FIELD', '$.protocolId', 'protocolId is required');
    return;
  }
  if (result.kind === 'accessor') return;
  if (!isStrictNonEmptyTrimmedString(result.value) || result.value !== MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID) {
    pushActivationIssue(issues, 'IDENTITY_MISMATCH', '$.protocolId', 'protocolId does not match frozen protocol');
  }
}

function validateActivationId(root: Record<string, unknown>, issues: MLBProspectiveHoldoutActivationIssue[]): void {
  const result = ownDataProperty(root, 'activationId', '$.activationId', issues);
  if (result.kind === 'missing') {
    pushActivationIssue(issues, 'MISSING_FIELD', '$.activationId', 'activationId is required');
    return;
  }
  if (result.kind === 'accessor') return;
  if (!isStrictNonEmptyTrimmedString(result.value)) {
    pushActivationIssue(issues, 'INVALID_STRING', '$.activationId', 'activationId must be a non-empty trimmed string');
  }
}

function validateCandidateRecipeId(root: Record<string, unknown>, issues: MLBProspectiveHoldoutActivationIssue[]): void {
  const result = ownDataProperty(root, 'candidateRecipeId', '$.candidateRecipeId', issues);
  if (result.kind === 'missing') {
    pushActivationIssue(issues, 'MISSING_FIELD', '$.candidateRecipeId', 'candidateRecipeId is required');
    return;
  }
  if (result.kind === 'accessor') return;
  if (!isStrictNonEmptyTrimmedString(result.value) || result.value !== MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID) {
    pushActivationIssue(issues, 'IDENTITY_MISMATCH', '$.candidateRecipeId', 'candidateRecipeId does not match frozen candidate');
  }
}

function validateCandidateFingerprint(root: Record<string, unknown>, issues: MLBProspectiveHoldoutActivationIssue[]): void {
  const result = ownDataProperty(root, 'candidateFingerprint', '$.candidateFingerprint', issues);
  if (result.kind === 'missing') {
    pushActivationIssue(issues, 'MISSING_FIELD', '$.candidateFingerprint', 'candidateFingerprint is required');
    return;
  }
  if (result.kind === 'accessor') return;
  if (!isStrictNonEmptyTrimmedString(result.value) || result.value !== MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT) {
    pushActivationIssue(issues, 'IDENTITY_MISMATCH', '$.candidateFingerprint', 'candidateFingerprint does not match frozen candidate');
  }
}

function validateStringLiteral(
  root: Record<string, unknown>,
  key: string,
  path: string,
  expected: string,
  issues: MLBProspectiveHoldoutActivationIssue[],
): void {
  const result = ownDataProperty(root, key, path, issues);
  if (result.kind === 'missing') {
    pushActivationIssue(issues, 'MISSING_FIELD', path, `${key} is required`);
    return;
  }
  if (result.kind === 'accessor') return;
  if (!isStrictNonEmptyTrimmedString(result.value) || result.value !== expected) {
    pushActivationIssue(issues, 'IDENTITY_MISMATCH', path, `${key} does not match frozen value`);
  }
}

function validateDate(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBProspectiveHoldoutActivationIssue[],
): void {
  const result = ownDataProperty(root, key, path, issues);
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

function validatePositiveInteger(
  root: Record<string, unknown>,
  key: string,
  path: string,
  expected: number,
  issues: MLBProspectiveHoldoutActivationIssue[],
): void {
  const result = ownDataProperty(root, key, path, issues);
  if (result.kind === 'missing') {
    pushActivationIssue(issues, 'MISSING_FIELD', path, `${key} is required`);
    return;
  }
  if (result.kind === 'accessor') return;
  if (typeof result.value !== 'number' || !Number.isSafeInteger(result.value) || result.value !== expected) {
    pushActivationIssue(issues, 'IDENTITY_MISMATCH', path, `${key} must be ${expected}`);
  }
}

function validateBooleanFlag(
  root: Record<string, unknown>,
  key: string,
  path: string,
  expected: boolean,
  issues: MLBProspectiveHoldoutActivationIssue[],
): void {
  const result = ownDataProperty(root, key, path, issues);
  if (result.kind === 'missing') {
    pushActivationIssue(issues, 'MISSING_FIELD', path, `${key} is required`);
    return;
  }
  if (result.kind === 'accessor') return;
  if (result.value !== expected) {
    pushActivationIssue(issues, 'INVALID_JSON_VALUE', path, `${key} must be ${expected}`);
  }
}

/* -------------------------------------------------------------------------- */
/*  Known fields                                                              */
/* -------------------------------------------------------------------------- */

const KNOWN_ACTIVATION_FIELDS = new Set([
  'contractVersion',
  'protocolId',
  'activationId',
  'candidateRecipeId',
  'candidateFingerprint',
  'featureManifestId',
  'featurePolicyId',
  'preprocessingPolicyId',
  'captureContractVersion',
  'compatibilityLayerId',
  'evidenceArtifactContractVersion',
  'evidenceStoreVersion',
  'validationBoundaryOfficialDate',
  'validationTargetCount',
  'testTargetCount',
  'stableOrderPolicy',
  'validationSideDateRule',
  'testSideDateRule',
  'noSmallerN',
  'resultIndependentSelection',
  'testAuthorizationRule',
  'gameIdentityBindingContractVersion',
  'gameIdentityBindingStoreVersion',
]);

/* -------------------------------------------------------------------------- */
/*  Public validator                                                         */
/* -------------------------------------------------------------------------- */

export function validateMLBProspectiveHoldoutActivation(
  value: unknown,
): MLBProspectiveHoldoutActivationValidationResult {
  const issues: MLBProspectiveHoldoutActivationIssue[] = [];

  if (!isPlainObject(value)) {
    pushActivationIssue(issues, 'NOT_PLAIN_OBJECT', '$', 'Expected plain object');
    return { ok: false, issues: sortActivationIssues(issues) };
  }

  const root = value as Record<string, unknown>;

  validateActivationRoot(root, issues);
  validateContractVersion(root, issues);
  validateProtocolId(root, issues);
  validateActivationId(root, issues);
  validateCandidateRecipeId(root, issues);
  validateCandidateFingerprint(root, issues);
  validateStringLiteral(root, 'featureManifestId', '$.featureManifestId', 'mlb-real-pregame-winner-feature-manifest-v1', issues);
  validateStringLiteral(root, 'featurePolicyId', '$.featurePolicyId', 'mlb-real-pregame-winner-feature-policy-v1', issues);
  validateStringLiteral(root, 'preprocessingPolicyId', '$.preprocessingPolicyId', 'raw-finite-feature-values-with-default-missing-v1', issues);
  validateStringLiteral(root, 'captureContractVersion', '$.captureContractVersion', MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION, issues);
  validateStringLiteral(root, 'compatibilityLayerId', '$.compatibilityLayerId', MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1, issues);
  validateStringLiteral(root, 'evidenceArtifactContractVersion', '$.evidenceArtifactContractVersion', MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION, issues);
  validateStringLiteral(root, 'evidenceStoreVersion', '$.evidenceStoreVersion', MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION, issues);
  validateDate(root, 'validationBoundaryOfficialDate', '$.validationBoundaryOfficialDate', issues);
  validatePositiveInteger(root, 'validationTargetCount', '$.validationTargetCount', 67, issues);
  validatePositiveInteger(root, 'testTargetCount', '$.testTargetCount', 69, issues);
  validateStringLiteral(root, 'stableOrderPolicy', '$.stableOrderPolicy', MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY, issues);
  validateStringLiteral(root, 'validationSideDateRule', '$.validationSideDateRule', MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE, issues);
  validateStringLiteral(root, 'testSideDateRule', '$.testSideDateRule', MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE, issues);
  validateBooleanFlag(root, 'noSmallerN', '$.noSmallerN', true, issues);
  validateBooleanFlag(root, 'resultIndependentSelection', '$.resultIndependentSelection', true, issues);
  validateStringLiteral(root, 'testAuthorizationRule', '$.testAuthorizationRule', MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE, issues);
  validateStringLiteral(root, 'gameIdentityBindingContractVersion', '$.gameIdentityBindingContractVersion', MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION, issues);
  validateStringLiteral(root, 'gameIdentityBindingStoreVersion', '$.gameIdentityBindingStoreVersion', MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION, issues);

  if (issues.length > 0) {
    return { ok: false, issues: sortActivationIssues(issues) };
  }

  return {
    ok: true,
    value: Object.freeze({
      contractVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
      protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
      activationId: root.activationId as string,
      candidateRecipeId: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
      candidateFingerprint: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
      featureManifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
      featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
      preprocessingPolicyId: 'raw-finite-feature-values-with-default-missing-v1',
      captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
      compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
      evidenceArtifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
      evidenceStoreVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
      validationBoundaryOfficialDate: root.validationBoundaryOfficialDate as string,
      validationTargetCount: 67,
      testTargetCount: 69,
      stableOrderPolicy: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY,
      validationSideDateRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE,
      testSideDateRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE,
      noSmallerN: true,
      resultIndependentSelection: true,
      testAuthorizationRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE,
      gameIdentityBindingContractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
      gameIdentityBindingStoreVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
    }) as MLBProspectiveHoldoutActivation,
  };
}

function validateMLBProspectiveHoldoutActivationPersisted(
  value: unknown,
): MLBProspectiveHoldoutActivationPersistedValidationResult {
  const issues: MLBProspectiveHoldoutActivationIssue[] = [];

  if (!isPlainObject(value)) {
    pushActivationIssue(issues, 'NOT_PLAIN_OBJECT', '$', 'Persisted activation must be a plain object');
    return { ok: false, issues: sortActivationIssues(issues) };
  }

  const root = value as Record<string, unknown>;

  const persistedAtResult = ownDataProperty(root, 'persistedAt', '$.persistedAt', issues);
  if (persistedAtResult.kind === 'missing') {
    pushActivationIssue(issues, 'MISSING_FIELD', '$.persistedAt', 'persistedAt is required');
  } else if (persistedAtResult.kind === 'data') {
    validateRFC3339TimestampPersisted(persistedAtResult.value, '$.persistedAt', 'persistedAt', issues);
  }

  for (const key of Object.getOwnPropertyNames(root)) {
    if (key === 'persistedAt') continue;
    if (!KNOWN_ACTIVATION_FIELDS.has(key)) {
      const desc = Object.getOwnPropertyDescriptor(root, key);
      if (desc && isDataDescriptor(desc)) {
        pushActivationIssue(issues, 'PROHIBITED_FIELD', `$.${key}`, `Unknown field: ${key}`);
      } else if (desc) {
        pushActivationIssue(issues, 'INVALID_JSON_VALUE', `$.${key}`, 'Accessor property');
      }
    }
  }
  for (const symbol of Object.getOwnPropertySymbols(root)) {
    pushActivationIssue(issues, 'PROHIBITED_FIELD', `$[${String(symbol)}]`, `Symbol property: ${symbol.description ?? symbol.toString()}`);
  }

  const activationRoot: Record<string, unknown> = {};
  for (const key of Object.getOwnPropertyNames(root)) {
    if (key === 'persistedAt') continue;
    const desc = Object.getOwnPropertyDescriptor(root, key);
    if (desc && Object.prototype.hasOwnProperty.call(desc, 'value')) {
      activationRoot[key] = desc.value;
    }
  }

  const activationValidation = validateMLBProspectiveHoldoutActivation(activationRoot);
  if (!activationValidation.ok) {
    const mappedIssues: MLBProspectiveHoldoutActivationIssue[] = activationValidation.issues.map(
      (issue): MLBProspectiveHoldoutActivationIssue => ({
        ...issue,
        code: 'ACTIVATION_CONTRACT_INVALID',
      }),
    );
    return { ok: false, issues: sortActivationIssues([...issues, ...mappedIssues]) };
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortActivationIssues(issues) };
  }

  const persistedAt =
    persistedAtResult.kind === 'data' ? String(persistedAtResult.value) : '';
  const persisted: MLBProspectiveHoldoutActivationPersisted = Object.freeze({
    ...activationValidation.value,
    persistedAt,
  });

  return { ok: true, value: persisted };
}

function validateRFC3339TimestampPersisted(
  value: unknown,
  path: string,
  label: string,
  issues: MLBProspectiveHoldoutActivationIssue[],
): void {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    pushActivationIssue(issues, 'INVALID_TIMESTAMP', path, `${label} must be an RFC-3339 timestamp`);
  } else {
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) {
      pushActivationIssue(issues, 'INVALID_TIMESTAMP', path, `${label} must be a finite timestamp`);
    }
  }
}

export { isPlainObject, validateMLBProspectiveHoldoutActivationPersisted };
