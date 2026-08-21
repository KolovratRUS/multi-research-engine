import {
  MLB_INNER_DEVELOPMENT_CYCLE_ID,
  MLB_INNER_DEVELOPMENT_RECIPE_BUDGET_CONTRACT_VERSION,
  MLBInnerCandidateRecipe,
  MLBInnerDevelopmentRecipeBudget,
  computeMLBInnerCandidateRecipeFingerprint,
  type MLBInnerFoldMetricResult,
  type MLBInnerAggregateResult,
  type MLBInnerCandidateGateResult,
} from '@/prediction/mlb/mlb-train-only-inner-development-evaluator';
import {
  type MLBInnerDevelopmentCandidateExecutionIssue,
  type MLBInnerDevelopmentCandidateExecutionResult,
} from '@/prediction/mlb/mlb-inner-development-candidate-execution';

export const MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION =
  'mlb-inner-development-campaign-ledger-v1' as const;

export const MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION =
  'mlb-inner-development-campaign-anchor-v1' as const;

export const MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY =
  'var/mlb-development/mlb-inner-development-campaign-ledger/' as const;

export const MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME =
  'mlb-v1-train-only-inner-development-cycle-v1-ledger.json' as const;

export const MLB_INNER_DEVELOPMENT_CAMPAIGN_RESET_PREVENTION_ANCHOR =
  'docs/mlb-v1-train-only-inner-development-campaign-marker.md' as const;

export const MLB_INNER_DEVELOPMENT_MAX_DISTINCT_RECIPES = 12 as const;

export const MLB_INNER_DEVELOPMENT_ATTEMPT_STATUS_VALUES = [
  'REGISTERED',
  'RUNNING',
  'COMPLETED_INNER_ELIGIBLE',
  'COMPLETED_INNER_REJECTED',
  'FAILED',
  'INTERRUPTED',
] as const;

export type MLBInnerDevelopmentAttemptStatus =
  (typeof MLB_INNER_DEVELOPMENT_ATTEMPT_STATUS_VALUES)[number];

export type MLBInnerDevelopmentCampaignAnchor = Readonly<{
  anchorContractVersion: typeof MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION;
  developmentCycleId: typeof MLB_INNER_DEVELOPMENT_CYCLE_ID;
  canonicalLedgerDirectory: string;
  canonicalLedgerFilename: string;
  ledgerContractVersion: typeof MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION;
  campaignIdentity: string;
}>;

export type MLBInnerDevelopmentRegisteredRecipeRecord = Readonly<{
  candidateRecipeId: string;
  registrationSequence: number;
  registrationTimestamp: string;
  recipeFingerprint: string;
  complexityRank: number;
  preprocessingPolicyId: string;
  featurePolicyId: string;
  modelFamilyId: string;
  regularizationConfig: unknown;
  optimizerConfig: unknown;
  otherModelAffectingChoices: unknown;
}>;

export type MLBInnerDevelopmentBaseAttempt = Readonly<{
  attemptNumber: number;
  candidateRecipeId: string;
  recipeFingerprint: string;
  complexityRank: number;
  developmentCycleId: string;
  attemptTimestamp: string;
  foldIds: readonly string[];
}>;

export type MLBInnerDevelopmentAttemptExecutionProvenance = Readonly<{
  verifiedArtifactSha256: string;
  verifiedArtifactByteLength: number;
  artifactId: string;
  foldPlanId: string;
}>;

export type MLBInnerDevelopmentAttemptTerminalSuccess = Readonly<{
  kind: 'SUCCESS';
  lowLevelFitCount: number;
  foldResults: readonly MLBInnerFoldMetricResult[];
  aggregate: MLBInnerAggregateResult;
  gate: MLBInnerCandidateGateResult;
}>;

export type MLBInnerDevelopmentAttemptTerminalFailure = Readonly<{
  kind: 'FAILURE';
  lowLevelFitCount: number;
  failedFoldId?: string;
  issues: readonly MLBInnerDevelopmentCandidateExecutionIssue[];
}>;

export type MLBInnerDevelopmentAttemptTerminalEvidence =
  | MLBInnerDevelopmentAttemptTerminalSuccess
  | MLBInnerDevelopmentAttemptTerminalFailure;

export type MLBInnerDevelopmentRegisteredAttempt = Readonly<{
  attemptNumber: number;
  candidateRecipeId: string;
  recipeFingerprint: string;
  complexityRank: number;
  developmentCycleId: string;
  status: 'REGISTERED';
  attemptTimestamp: string;
  foldIds: readonly string[];
}>;

export type MLBInnerDevelopmentRunningAttempt = Readonly<{
  attemptNumber: number;
  candidateRecipeId: string;
  recipeFingerprint: string;
  complexityRank: number;
  developmentCycleId: string;
  status: 'RUNNING';
  attemptTimestamp: string;
  foldIds: readonly string[];
  executionProvenance: MLBInnerDevelopmentAttemptExecutionProvenance;
}>;

export type MLBInnerDevelopmentCompletedEligibleAttempt = Readonly<{
  attemptNumber: number;
  candidateRecipeId: string;
  recipeFingerprint: string;
  complexityRank: number;
  developmentCycleId: string;
  status: 'COMPLETED_INNER_ELIGIBLE';
  attemptTimestamp: string;
  foldIds: readonly string[];
  executionProvenance: MLBInnerDevelopmentAttemptExecutionProvenance;
  terminalExecution: MLBInnerDevelopmentAttemptTerminalSuccess;
}>;

export type MLBInnerDevelopmentCompletedRejectedAttempt = Readonly<{
  attemptNumber: number;
  candidateRecipeId: string;
  recipeFingerprint: string;
  complexityRank: number;
  developmentCycleId: string;
  status: 'COMPLETED_INNER_REJECTED';
  attemptTimestamp: string;
  foldIds: readonly string[];
  executionProvenance: MLBInnerDevelopmentAttemptExecutionProvenance;
  terminalExecution: MLBInnerDevelopmentAttemptTerminalSuccess;
}>;

export type MLBInnerDevelopmentFailedAttempt = Readonly<{
  attemptNumber: number;
  candidateRecipeId: string;
  recipeFingerprint: string;
  complexityRank: number;
  developmentCycleId: string;
  status: 'FAILED';
  attemptTimestamp: string;
  foldIds: readonly string[];
  executionProvenance: MLBInnerDevelopmentAttemptExecutionProvenance;
  terminalExecution: MLBInnerDevelopmentAttemptTerminalFailure;
}>;

export type MLBInnerDevelopmentInterruptedAttempt = Readonly<{
  attemptNumber: number;
  candidateRecipeId: string;
  recipeFingerprint: string;
  complexityRank: number;
  developmentCycleId: string;
  status: 'INTERRUPTED';
  attemptTimestamp: string;
  foldIds: readonly string[];
}>;

export type MLBInnerDevelopmentAttemptRecord =
  | MLBInnerDevelopmentRegisteredAttempt
  | MLBInnerDevelopmentRunningAttempt
  | MLBInnerDevelopmentCompletedEligibleAttempt
  | MLBInnerDevelopmentCompletedRejectedAttempt
  | MLBInnerDevelopmentFailedAttempt
  | MLBInnerDevelopmentInterruptedAttempt;

export type MLBInnerDevelopmentCampaignLedger = Readonly<{
  ledgerContractVersion: typeof MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION;
  developmentCycleId: typeof MLB_INNER_DEVELOPMENT_CYCLE_ID;
  createdAt: string;
  updatedAt: string;
  budget: MLBInnerDevelopmentRecipeBudget;
  registeredRecipes: readonly MLBInnerDevelopmentRegisteredRecipeRecord[];
  attempts: readonly MLBInnerDevelopmentAttemptRecord[];
}>;

export type MLBInnerDevelopmentCampaignLedgerIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_INTEGER'
    | 'INVALID_NUMBER'
    | 'INVALID_ARRAY'
    | 'INVALID_TIMESTAMP'
    | 'TIMESTAMP_ORDER_VIOLATION'
    | 'DUPLICATE_REGISTRATION_SEQUENCE'
    | 'UNREGISTERED_RECIPE_REFERENCE'
    | 'FINGERPRINT_MISMATCH'
    | 'COMPLEXITY_RANK_MISMATCH'
    | 'CYCLE_MISMATCH'
    | 'ATTEMPT_COUNT_MISMATCH'
    | 'INVALID_STATUS'
    | 'MALFORMED_FOLD_IDS'
    | 'ACCESSOR_PROPERTY'
    | 'PROTOTYPE_POLLUTION'
    | 'BUDGET_RECIPE_ID_MISMATCH'
    | 'BUDGET_FINGERPRINT_MISMATCH'
    | 'BUDGET_COMPLEXITY_MISMATCH'
    | 'RECIPE_FINGERPRINT_RECOMPUTE_MISMATCH'
    | 'RECIPE_DESCRIPTOR_MUTATED'
    | 'DUPLICATE_REGISTERED_RECIPE_ID'
    | 'DUPLICATE_REGISTERED_FINGERPRINT'
    | 'RECIPE_COUNT_MISMATCH'
    | 'MISSING_EXECUTION_PROVENANCE'
    | 'UNEXPECTED_EXECUTION_PROVENANCE'
    | 'INVALID_EXECUTION_PROVENANCE'
    | 'MISSING_TERMINAL_EXECUTION'
    | 'UNEXPECTED_TERMINAL_EXECUTION'
    | 'INVALID_TERMINAL_EXECUTION'
    | 'GATE_STATUS_MISMATCH'
    | 'NONFINITE_METRIC'
    | 'INVALID_FOLD_SET'
    | 'MIXED_CANDIDATE_RECIPE_ID'
    | 'CLASS_COUNT_MISMATCH'
    | 'IDENTITY_MISMATCH';
  path: string;
  message: string;
}>;

export type MLBInnerDevelopmentCampaignLedgerResult =
  | Readonly<{ ok: true; value: MLBInnerDevelopmentCampaignLedger }>
  | Readonly<{ ok: false; issues: readonly MLBInnerDevelopmentCampaignLedgerIssue[] }>;

export type MLBInnerDevelopmentCampaignAnchorIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_TIMESTAMP'
    | 'TIMESTAMP_ORDER_VIOLATION'
    | 'ACCESSOR_PROPERTY'
    | 'PROTOTYPE_POLLUTION';
  path: string;
  message: string;
}>;

export type MLBInnerDevelopmentCampaignAnchorResult =
  | Readonly<{ ok: true; value: MLBInnerDevelopmentCampaignAnchor }>
  | Readonly<{ ok: false; issues: readonly MLBInnerDevelopmentCampaignAnchorIssue[] }>;

const LEDGER_KNOWN_FIELDS = new Set([
  'ledgerContractVersion',
  'developmentCycleId',
  'createdAt',
  'updatedAt',
  'budget',
  'registeredRecipes',
  'attempts',
]);

const BUDGET_KNOWN_FIELDS = new Set([
  'contractVersion',
  'cycleId',
  'maxDistinctRecipes',
  'seenRecipeIds',
  'seenRecipeFingerprints',
  'seenComplexityRanks',
  'evaluationCount',
]);

const RECIPE_RECORD_KNOWN_FIELDS = new Set([
  'candidateRecipeId',
  'registrationSequence',
  'registrationTimestamp',
  'recipeFingerprint',
  'complexityRank',
  'preprocessingPolicyId',
  'featurePolicyId',
  'modelFamilyId',
  'regularizationConfig',
  'optimizerConfig',
  'otherModelAffectingChoices',
]);

const ALL_ATTEMPT_KNOWN_FIELDS = new Set([
  'attemptNumber',
  'candidateRecipeId',
  'recipeFingerprint',
  'complexityRank',
  'developmentCycleId',
  'status',
  'attemptTimestamp',
  'foldIds',
  'executionProvenance',
  'terminalExecution',
]);

const REGISTERED_ATTEMPT_ALLOWED_FIELDS = new Set([
  'attemptNumber',
  'candidateRecipeId',
  'recipeFingerprint',
  'complexityRank',
  'developmentCycleId',
  'status',
  'attemptTimestamp',
  'foldIds',
]);

const RUNNING_ATTEMPT_ALLOWED_FIELDS = new Set([
  'attemptNumber',
  'candidateRecipeId',
  'recipeFingerprint',
  'complexityRank',
  'developmentCycleId',
  'status',
  'attemptTimestamp',
  'foldIds',
  'executionProvenance',
]);

const TERMINAL_ATTEMPT_ALLOWED_FIELDS = new Set([
  'attemptNumber',
  'candidateRecipeId',
  'recipeFingerprint',
  'complexityRank',
  'developmentCycleId',
  'status',
  'attemptTimestamp',
  'foldIds',
  'executionProvenance',
  'terminalExecution',
]);

const INTERRUPTED_ATTEMPT_ALLOWED_FIELDS = new Set([
  'attemptNumber',
  'candidateRecipeId',
  'recipeFingerprint',
  'complexityRank',
  'developmentCycleId',
  'status',
  'attemptTimestamp',
  'foldIds',
]);

const ANCHOR_KNOWN_FIELDS = new Set([
  'anchorContractVersion',
  'developmentCycleId',
  'canonicalLedgerDirectory',
  'canonicalLedgerFilename',
  'ledgerContractVersion',
  'campaignIdentity',
]);

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

type DataArrayElementReadResult =
  | { ok: true; value: unknown }
  | { ok: false };

function readDataArrayElement(
  array: unknown,
  index: number,
  basePath: string,
  issues: MLBInnerDevelopmentCampaignLedgerIssue[],
): DataArrayElementReadResult {
  if (!Array.isArray(array)) {
    pushIssue(issues, 'INVALID_ARRAY', basePath, 'expected array');
    return { ok: false };
  }
  const descriptor = Object.getOwnPropertyDescriptor(array, String(index));
  if (!descriptor) {
    pushIssue(issues, 'INVALID_ARRAY', `${basePath}[${index}]`, `missing array element at index ${index}`);
    return { ok: false };
  }
  if (!isDataDescriptor(descriptor)) {
    pushIssue(issues, 'ACCESSOR_PROPERTY', `${basePath}[${index}]`, 'array element must be a data property, not an accessor');
    return { ok: false };
  }
  return { ok: true, value: descriptor.value };
}

function rejectSymbolProperties(
  target: Record<string, unknown>,
  path: string,
  issues: MLBInnerDevelopmentCampaignLedgerIssue[],
): boolean {
  const symbols = Object.getOwnPropertySymbols(target);
  if (symbols.length > 0) {
    pushIssue(issues, 'UNKNOWN_FIELD', path, 'Symbol-keyed own properties are not allowed');
    return false;
  }
  return true;
}

function rejectAnchorSymbolProperties(
  target: Record<string, unknown>,
  path: string,
  issues: MLBInnerDevelopmentCampaignAnchorIssue[],
): boolean {
  const symbols = Object.getOwnPropertySymbols(target);
  if (symbols.length > 0) {
    pushAnchorIssue(issues, 'UNKNOWN_FIELD', path, 'Symbol-keyed own properties are not allowed');
    return false;
  }
  return true;
}

type OwnDataResult =
  | Readonly<{ kind: 'data'; value: unknown }>
  | Readonly<{ kind: 'accessor' }>
  | Readonly<{ kind: 'missing' }>;

function ownDataProperty(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBInnerDevelopmentCampaignLedgerIssue[],
  descriptorRequired = true,
): OwnDataResult {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (!descriptor) {
    return { kind: 'missing' };
  }
  if (!isDataDescriptor(descriptor)) {
    issues.push({
      code: 'ACCESSOR_PROPERTY',
      path,
      message: `${key} must be a data property, not an accessor`,
    });
    return { kind: 'accessor' };
  }
  return { kind: 'data', value: descriptor.value };
}

function pushIssue(
  issues: MLBInnerDevelopmentCampaignLedgerIssue[],
  code: MLBInnerDevelopmentCampaignLedgerIssue['code'],
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function validateTimestamp(value: unknown, path: string, issues: MLBInnerDevelopmentCampaignLedgerIssue[]): boolean {
  if (typeof value !== 'string') {
    pushIssue(issues, 'INVALID_STRING', path, 'timestamp must be a string');
    return false;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)) {
    pushIssue(issues, 'INVALID_TIMESTAMP', path, 'timestamp must be ISO-8601 UTC');
    return false;
  }
  return true;
}

function validateBudget(
  budget: unknown,
  path: string,
  issues: MLBInnerDevelopmentCampaignLedgerIssue[],
): boolean {
  if (!isPlainObject(budget)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, 'budget must be a plain object');
    return false;
  }

  if (!rejectSymbolProperties(budget as Record<string, unknown>, path, issues)) {
    return false;
  }

  for (const key of Object.getOwnPropertyNames(budget)) {
    if (!BUDGET_KNOWN_FIELDS.has(key)) {
      pushIssue(issues, 'UNKNOWN_FIELD', `${path}.${key}`, `Unknown field ${key}`);
      return false;
    }
  }

  if (issues.length > 0) {
    return false;
  }

  const contractVersion = ownDataProperty(budget as Record<string, unknown>, 'contractVersion', `${path}.contractVersion`, issues);
  if (contractVersion.kind === 'accessor') return false;
  if (contractVersion.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.contractVersion`, 'contractVersion is required');
    return false;
  }
  if (contractVersion.value !== MLB_INNER_DEVELOPMENT_RECIPE_BUDGET_CONTRACT_VERSION) {
    pushIssue(issues, 'INVALID_LITERAL', `${path}.contractVersion`, `contractVersion must be ${MLB_INNER_DEVELOPMENT_RECIPE_BUDGET_CONTRACT_VERSION}`);
    return false;
  }

  const cycleId = ownDataProperty(budget as Record<string, unknown>, 'cycleId', `${path}.cycleId`, issues);
  if (cycleId.kind === 'accessor') return false;
  if (cycleId.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.cycleId`, 'cycleId is required');
    return false;
  }
  if (cycleId.value !== MLB_INNER_DEVELOPMENT_CYCLE_ID) {
    pushIssue(issues, 'INVALID_LITERAL', `${path}.cycleId`, `cycleId must be ${MLB_INNER_DEVELOPMENT_CYCLE_ID}`);
    return false;
  }

  const maxDistinctRecipes = ownDataProperty(budget as Record<string, unknown>, 'maxDistinctRecipes', `${path}.maxDistinctRecipes`, issues);
  if (maxDistinctRecipes.kind === 'accessor') return false;
  if (maxDistinctRecipes.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.maxDistinctRecipes`, 'maxDistinctRecipes is required');
    return false;
  }
  if (typeof maxDistinctRecipes.value !== 'number' || maxDistinctRecipes.value !== MLB_INNER_DEVELOPMENT_MAX_DISTINCT_RECIPES) {
    pushIssue(issues, 'INVALID_NUMBER', `${path}.maxDistinctRecipes`, `maxDistinctRecipes must be ${MLB_INNER_DEVELOPMENT_MAX_DISTINCT_RECIPES}`);
    return false;
  }

  const seenRecipeIds = ownDataProperty(budget as Record<string, unknown>, 'seenRecipeIds', `${path}.seenRecipeIds`, issues);
  if (seenRecipeIds.kind === 'accessor') return false;
  if (seenRecipeIds.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.seenRecipeIds`, 'seenRecipeIds is required');
    return false;
  }
  if (!Array.isArray(seenRecipeIds.value)) {
    pushIssue(issues, 'INVALID_ARRAY', `${path}.seenRecipeIds`, 'seenRecipeIds must be an array');
    return false;
  }

  const seenRecipeFingerprints = ownDataProperty(budget as Record<string, unknown>, 'seenRecipeFingerprints', `${path}.seenRecipeFingerprints`, issues);
  if (seenRecipeFingerprints.kind === 'accessor') return false;
  if (seenRecipeFingerprints.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.seenRecipeFingerprints`, 'seenRecipeFingerprints is required');
    return false;
  }
  if (!Array.isArray(seenRecipeFingerprints.value)) {
    pushIssue(issues, 'INVALID_ARRAY', `${path}.seenRecipeFingerprints`, 'seenRecipeFingerprints must be an array');
    return false;
  }

  const seenComplexityRanks = ownDataProperty(budget as Record<string, unknown>, 'seenComplexityRanks', `${path}.seenComplexityRanks`, issues);
  if (seenComplexityRanks.kind === 'accessor') return false;
  if (seenComplexityRanks.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.seenComplexityRanks`, 'seenComplexityRanks is required');
    return false;
  }
  if (!Array.isArray(seenComplexityRanks.value)) {
    pushIssue(issues, 'INVALID_ARRAY', `${path}.seenComplexityRanks`, 'seenComplexityRanks must be an array');
    return false;
  }

  const idCount = (seenRecipeIds.value as unknown[]).length;
  const fpCount = (seenRecipeFingerprints.value as unknown[]).length;
  const rankCount = (seenComplexityRanks.value as unknown[]).length;

  if (idCount !== fpCount || idCount !== rankCount) {
    pushIssue(issues, 'INVALID_ARRAY', `${path}.seen*`, 'seen arrays must have identical length');
    return false;
  }
  if (idCount > MLB_INNER_DEVELOPMENT_MAX_DISTINCT_RECIPES) {
    pushIssue(issues, 'INVALID_NUMBER', `${path}.seenRecipeIds`, 'seen arrays length must not exceed 12');
    return false;
  }

  const idSet = new Set<string>();
  for (let i = 0; i < idCount; i++) {
    const rawIdResult = readDataArrayElement(seenRecipeIds.value, i, `${path}.seenRecipeIds`, issues);
    if (!rawIdResult.ok) return false;
    const rawId = rawIdResult.value;
    if (typeof rawId !== 'string') {
      pushIssue(issues, 'INVALID_STRING', `${path}.seenRecipeIds[${i}]`, `seenRecipeIds[${i}] must be a string`);
      return false;
    }
    if (rawId.trim() === '' || rawId !== rawId.trim()) {
      pushIssue(issues, 'INVALID_STRING', `${path}.seenRecipeIds[${i}]`, `seenRecipeIds[${i}] must be a non-empty trimmed string`);
      return false;
    }
    if (idSet.has(rawId)) {
      pushIssue(issues, 'INVALID_STRING', `${path}.seenRecipeIds[${i}]`, `Duplicate recipe ID ${rawId}`);
      return false;
    }
    idSet.add(rawId);
  }

  const fingerprintSet = new Set<string>();
  for (let i = 0; i < fpCount; i++) {
    const rawFingerprintResult = readDataArrayElement(seenRecipeFingerprints.value, i, `${path}.seenRecipeFingerprints`, issues);
    if (!rawFingerprintResult.ok) return false;
    const rawFingerprint = rawFingerprintResult.value;
    if (typeof rawFingerprint !== 'string') {
      pushIssue(issues, 'INVALID_STRING', `${path}.seenRecipeFingerprints[${i}]`, 'fingerprint must be a string');
      return false;
    }
    if (!/^[0-9a-f]{64}$/.test(rawFingerprint)) {
      pushIssue(issues, 'INVALID_STRING', `${path}.seenRecipeFingerprints[${i}]`, 'fingerprint must be lowercase 64-char hex');
      return false;
    }
    if (fingerprintSet.has(rawFingerprint)) {
      pushIssue(issues, 'INVALID_STRING', `${path}.seenRecipeFingerprints[${i}]`, `Duplicate fingerprint ${rawFingerprint}`);
      return false;
    }
    fingerprintSet.add(rawFingerprint);
  }

  for (let i = 0; i < rankCount; i++) {
    const rawRankResult = readDataArrayElement(seenComplexityRanks.value, i, `${path}.seenComplexityRanks`, issues);
    if (!rawRankResult.ok) return false;
    const rawRank = rawRankResult.value;
    if (typeof rawRank !== 'number' || !Number.isInteger(rawRank) || rawRank <= 0) {
      pushIssue(issues, 'INVALID_INTEGER', `${path}.seenComplexityRanks[${i}]`, 'complexityRank must be a positive integer');
      return false;
    }
  }

  const evaluationCount = ownDataProperty(budget as Record<string, unknown>, 'evaluationCount', `${path}.evaluationCount`, issues);
  if (evaluationCount.kind === 'accessor') return false;
  if (evaluationCount.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.evaluationCount`, 'evaluationCount is required');
    return false;
  }
  if (typeof evaluationCount.value !== 'number' || !Number.isInteger(evaluationCount.value) || evaluationCount.value < 0) {
    pushIssue(issues, 'INVALID_INTEGER', `${path}.evaluationCount`, 'evaluationCount must be a non-negative integer');
    return false;
  }
  if (evaluationCount.value < idCount) {
    pushIssue(issues, 'INVALID_NUMBER', `${path}.evaluationCount`, 'evaluationCount must be >= distinct recipe count');
    return false;
  }

  return true;
}

function validateRegisteredRecipe(
  recipe: unknown,
  index: number,
  issues: MLBInnerDevelopmentCampaignLedgerIssue[],
): MLBInnerDevelopmentRegisteredRecipeRecord | null {
  if (!isPlainObject(recipe)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', `$.registeredRecipes[${index}]`, 'registered recipe must be a plain object');
    return null;
  }

  if (!rejectSymbolProperties(recipe as Record<string, unknown>, `$.registeredRecipes[${index}]`, issues)) {
    return null;
  }

  for (const key of Object.getOwnPropertyNames(recipe)) {
    if (!RECIPE_RECORD_KNOWN_FIELDS.has(key)) {
      pushIssue(issues, 'UNKNOWN_FIELD', `$.registeredRecipes[${index}].${key}`, `Unknown field ${key}`);
      return null;
    }
  }

  const candidateRecipeId = ownDataProperty(recipe, 'candidateRecipeId', `$.registeredRecipes[${index}].candidateRecipeId`, issues);
  if (candidateRecipeId.kind === 'accessor') return null;
  if (candidateRecipeId.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.registeredRecipes[${index}].candidateRecipeId`, 'candidateRecipeId is required');
    return null;
  }
  if (typeof candidateRecipeId.value !== 'string' || candidateRecipeId.value.trim() === '' || candidateRecipeId.value !== candidateRecipeId.value.trim()) {
    pushIssue(issues, 'INVALID_STRING', `$.registeredRecipes[${index}].candidateRecipeId`, 'candidateRecipeId must be a non-empty trimmed string');
    return null;
  }

  const registrationSequence = ownDataProperty(recipe, 'registrationSequence', `$.registeredRecipes[${index}].registrationSequence`, issues);
  if (registrationSequence.kind === 'accessor') return null;
  if (registrationSequence.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.registeredRecipes[${index}].registrationSequence`, 'registrationSequence is required');
    return null;
  }
  if (typeof registrationSequence.value !== 'number' || !Number.isInteger(registrationSequence.value) || registrationSequence.value <= 0) {
    pushIssue(issues, 'INVALID_INTEGER', `$.registeredRecipes[${index}].registrationSequence`, 'registrationSequence must be a positive integer');
    return null;
  }

  const registrationTimestamp = ownDataProperty(recipe, 'registrationTimestamp', `$.registeredRecipes[${index}].registrationTimestamp`, issues);
  if (registrationTimestamp.kind === 'accessor') return null;
  if (registrationTimestamp.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.registeredRecipes[${index}].registrationTimestamp`, 'registrationTimestamp is required');
    return null;
  }
  if (!validateTimestamp(registrationTimestamp.value, `$.registeredRecipes[${index}].registrationTimestamp`, issues)) {
    return null;
  }

  const recipeFingerprint = ownDataProperty(recipe, 'recipeFingerprint', `$.registeredRecipes[${index}].recipeFingerprint`, issues);
  if (recipeFingerprint.kind === 'accessor') return null;
  if (recipeFingerprint.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.registeredRecipes[${index}].recipeFingerprint`, 'recipeFingerprint is required');
    return null;
  }
  if (typeof recipeFingerprint.value !== 'string' || !/^[0-9a-f]{64}$/.test(recipeFingerprint.value)) {
    pushIssue(issues, 'INVALID_STRING', `$.registeredRecipes[${index}].recipeFingerprint`, 'recipeFingerprint must be lowercase 64-char hex');
    return null;
  }

  const complexityRank = ownDataProperty(recipe, 'complexityRank', `$.registeredRecipes[${index}].complexityRank`, issues);
  if (complexityRank.kind === 'accessor') return null;
  if (complexityRank.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.registeredRecipes[${index}].complexityRank`, 'complexityRank is required');
    return null;
  }
  if (typeof complexityRank.value !== 'number' || !Number.isInteger(complexityRank.value) || complexityRank.value <= 0) {
    pushIssue(issues, 'INVALID_INTEGER', `$.registeredRecipes[${index}].complexityRank`, 'complexityRank must be a positive integer');
    return null;
  }

  const preprocessingPolicyId = ownDataProperty(recipe, 'preprocessingPolicyId', `$.registeredRecipes[${index}].preprocessingPolicyId`, issues);
  if (preprocessingPolicyId.kind === 'accessor') return null;
  if (preprocessingPolicyId.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.registeredRecipes[${index}].preprocessingPolicyId`, 'preprocessingPolicyId is required');
    return null;
  }
  if (typeof preprocessingPolicyId.value !== 'string' || preprocessingPolicyId.value.trim() === '' || preprocessingPolicyId.value !== preprocessingPolicyId.value.trim()) {
    pushIssue(issues, 'INVALID_STRING', `$.registeredRecipes[${index}].preprocessingPolicyId`, 'preprocessingPolicyId must be a non-empty trimmed string');
    return null;
  }

  const featurePolicyId = ownDataProperty(recipe, 'featurePolicyId', `$.registeredRecipes[${index}].featurePolicyId`, issues);
  if (featurePolicyId.kind === 'accessor') return null;
  if (featurePolicyId.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.registeredRecipes[${index}].featurePolicyId`, 'featurePolicyId is required');
    return null;
  }
  if (typeof featurePolicyId.value !== 'string' || featurePolicyId.value.trim() === '' || featurePolicyId.value !== featurePolicyId.value.trim()) {
    pushIssue(issues, 'INVALID_STRING', `$.registeredRecipes[${index}].featurePolicyId`, 'featurePolicyId must be a non-empty trimmed string');
    return null;
  }

  const modelFamilyId = ownDataProperty(recipe, 'modelFamilyId', `$.registeredRecipes[${index}].modelFamilyId`, issues);
  if (modelFamilyId.kind === 'accessor') return null;
  if (modelFamilyId.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.registeredRecipes[${index}].modelFamilyId`, 'modelFamilyId is required');
    return null;
  }
  if (typeof modelFamilyId.value !== 'string' || modelFamilyId.value.trim() === '' || modelFamilyId.value !== modelFamilyId.value.trim()) {
    pushIssue(issues, 'INVALID_STRING', `$.registeredRecipes[${index}].modelFamilyId`, 'modelFamilyId must be a non-empty trimmed string');
    return null;
  }

  const regularizationConfig = ownDataProperty(recipe, 'regularizationConfig', `$.registeredRecipes[${index}].regularizationConfig`, issues);
  if (regularizationConfig.kind === 'accessor') return null;
  if (regularizationConfig.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.registeredRecipes[${index}].regularizationConfig`, 'regularizationConfig is required');
    return null;
  }

  const optimizerConfig = ownDataProperty(recipe, 'optimizerConfig', `$.registeredRecipes[${index}].optimizerConfig`, issues);
  if (optimizerConfig.kind === 'accessor') return null;
  if (optimizerConfig.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.registeredRecipes[${index}].optimizerConfig`, 'optimizerConfig is required');
    return null;
  }

  const otherModelAffectingChoices = ownDataProperty(recipe, 'otherModelAffectingChoices', `$.registeredRecipes[${index}].otherModelAffectingChoices`, issues);
  if (otherModelAffectingChoices.kind === 'accessor') return null;
  if (otherModelAffectingChoices.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.registeredRecipes[${index}].otherModelAffectingChoices`, 'otherModelAffectingChoices is required');
    return null;
  }

  return {
    candidateRecipeId: candidateRecipeId.value as string,
    registrationSequence: registrationSequence.value as number,
    registrationTimestamp: registrationTimestamp.value as string,
    recipeFingerprint: recipeFingerprint.value as string,
    complexityRank: complexityRank.value as number,
    preprocessingPolicyId: preprocessingPolicyId.value as string,
    featurePolicyId: featurePolicyId.value as string,
    modelFamilyId: modelFamilyId.value as string,
    regularizationConfig: regularizationConfig.value,
    optimizerConfig: optimizerConfig.value,
    otherModelAffectingChoices: otherModelAffectingChoices.value,
  };
}

function validateAttemptRecord(
  attempt: unknown,
  index: number,
  issues: MLBInnerDevelopmentCampaignLedgerIssue[],
  expectedCycleId: string,
): MLBInnerDevelopmentAttemptRecord | null {
  if (!isPlainObject(attempt)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', `$.attempts[${index}]`, 'attempt must be a plain object');
    return null;
  }

  if (!rejectSymbolProperties(attempt as Record<string, unknown>, `$.attempts[${index}]`, issues)) {
    return null;
  }

  for (const key of Object.getOwnPropertyNames(attempt)) {
    if (!ALL_ATTEMPT_KNOWN_FIELDS.has(key)) {
      pushIssue(issues, 'UNKNOWN_FIELD', `$.attempts[${index}].${key}`, `Unknown field ${key}`);
      return null;
    }
  }

  const attemptNumber = ownDataProperty(attempt, 'attemptNumber', `$.attempts[${index}].attemptNumber`, issues);
  if (attemptNumber.kind === 'accessor') return null;
  if (attemptNumber.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].attemptNumber`, 'attemptNumber is required');
    return null;
  }
  if (typeof attemptNumber.value !== 'number' || !Number.isInteger(attemptNumber.value) || attemptNumber.value <= 0) {
    pushIssue(issues, 'INVALID_INTEGER', `$.attempts[${index}].attemptNumber`, 'attemptNumber must be a positive integer');
    return null;
  }

  const candidateRecipeId = ownDataProperty(attempt, 'candidateRecipeId', `$.attempts[${index}].candidateRecipeId`, issues);
  if (candidateRecipeId.kind === 'accessor') return null;
  if (candidateRecipeId.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].candidateRecipeId`, 'candidateRecipeId is required');
    return null;
  }
  if (typeof candidateRecipeId.value !== 'string' || candidateRecipeId.value.trim() === '' || candidateRecipeId.value !== candidateRecipeId.value.trim()) {
    pushIssue(issues, 'INVALID_STRING', `$.attempts[${index}].candidateRecipeId`, 'candidateRecipeId must be a non-empty trimmed string');
    return null;
  }

  const recipeFingerprint = ownDataProperty(attempt, 'recipeFingerprint', `$.attempts[${index}].recipeFingerprint`, issues);
  if (recipeFingerprint.kind === 'accessor') return null;
  if (recipeFingerprint.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].recipeFingerprint`, 'recipeFingerprint is required');
    return null;
  }
  if (typeof recipeFingerprint.value !== 'string' || !/^[0-9a-f]{64}$/.test(recipeFingerprint.value)) {
    pushIssue(issues, 'INVALID_STRING', `$.attempts[${index}].recipeFingerprint`, 'recipeFingerprint must be lowercase 64-char hex');
    return null;
  }

  const complexityRank = ownDataProperty(attempt, 'complexityRank', `$.attempts[${index}].complexityRank`, issues);
  if (complexityRank.kind === 'accessor') return null;
  if (complexityRank.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].complexityRank`, 'complexityRank is required');
    return null;
  }
  if (typeof complexityRank.value !== 'number' || !Number.isInteger(complexityRank.value) || complexityRank.value <= 0) {
    pushIssue(issues, 'INVALID_INTEGER', `$.attempts[${index}].complexityRank`, 'complexityRank must be a positive integer');
    return null;
  }

  const developmentCycleId = ownDataProperty(attempt, 'developmentCycleId', `$.attempts[${index}].developmentCycleId`, issues);
  if (developmentCycleId.kind === 'accessor') return null;
  if (developmentCycleId.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].developmentCycleId`, 'developmentCycleId is required');
    return null;
  }
  if (developmentCycleId.value !== expectedCycleId) {
    pushIssue(issues, 'CYCLE_MISMATCH', `$.attempts[${index}].developmentCycleId`, 'developmentCycleId must match ledger cycleId');
    return null;
  }

  const status = ownDataProperty(attempt, 'status', `$.attempts[${index}].status`, issues);
  if (status.kind === 'accessor') return null;
  if (status.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].status`, 'status is required');
    return null;
  }
  if (typeof status.value !== 'string' || !MLB_INNER_DEVELOPMENT_ATTEMPT_STATUS_VALUES.includes(status.value as MLBInnerDevelopmentAttemptStatus)) {
    pushIssue(issues, 'INVALID_STATUS', `$.attempts[${index}].status`, 'status must be a valid attempt status');
    return null;
  }

  const attemptTimestamp = ownDataProperty(attempt, 'attemptTimestamp', `$.attempts[${index}].attemptTimestamp`, issues);
  if (attemptTimestamp.kind === 'accessor') return null;
  if (attemptTimestamp.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].attemptTimestamp`, 'attemptTimestamp is required');
    return null;
  }
  if (!validateTimestamp(attemptTimestamp.value, `$.attempts[${index}].attemptTimestamp`, issues)) {
    return null;
  }

  const foldIds = ownDataProperty(attempt, 'foldIds', `$.attempts[${index}].foldIds`, issues);
  if (foldIds.kind === 'accessor') return null;
  if (foldIds.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].foldIds`, 'foldIds is required');
    return null;
  }
  if (!Array.isArray(foldIds.value)) {
    pushIssue(issues, 'INVALID_ARRAY', `$.attempts[${index}].foldIds`, 'foldIds must be an array');
    return null;
  }
  const normalizedFoldIds: string[] = [];
  for (let i = 0; i < (foldIds.value as unknown[]).length; i++) {
    const rawResult = readDataArrayElement(foldIds.value, i, `$.attempts[${index}].foldIds`, issues);
    if (!rawResult.ok) return null;
    const raw = rawResult.value;
    if (typeof raw !== 'string') {
      pushIssue(issues, 'INVALID_STRING', `$.attempts[${index}].foldIds[${i}]`, 'foldId must be a string');
      return null;
    }
    if (raw.trim() === '' || raw !== raw.trim()) {
      pushIssue(issues, 'INVALID_STRING', `$.attempts[${index}].foldIds[${i}]`, 'foldId must be a non-empty trimmed string');
      return null;
    }
    normalizedFoldIds.push(raw);
  }

  const allowedFields = new Set<string>();
  switch (status.value) {
    case 'REGISTERED':
      REGISTERED_ATTEMPT_ALLOWED_FIELDS.forEach(allowedFields.add, allowedFields);
      break;
    case 'RUNNING':
      RUNNING_ATTEMPT_ALLOWED_FIELDS.forEach(allowedFields.add, allowedFields);
      break;
    case 'COMPLETED_INNER_ELIGIBLE':
    case 'COMPLETED_INNER_REJECTED':
    case 'FAILED':
      TERMINAL_ATTEMPT_ALLOWED_FIELDS.forEach(allowedFields.add, allowedFields);
      break;
    case 'INTERRUPTED':
      INTERRUPTED_ATTEMPT_ALLOWED_FIELDS.forEach(allowedFields.add, allowedFields);
      break;
    default:
      break;
  }

  for (const key of Object.getOwnPropertyNames(attempt)) {
    if (!allowedFields.has(key)) {
      const disallowedKey = key;
      if (
        disallowedKey === 'executionProvenance' ||
        disallowedKey === 'terminalExecution'
        ) {
        if (status.value === 'REGISTERED' || status.value === 'INTERRUPTED') {
          pushIssue(issues, 'UNEXPECTED_EXECUTION_PROVENANCE', `$.attempts[${index}].${disallowedKey}`, `${disallowedKey} is not allowed for status ${status.value}`);
        } else if (status.value === 'RUNNING') {
          pushIssue(issues, 'UNEXPECTED_TERMINAL_EXECUTION', `$.attempts[${index}].${disallowedKey}`, `${disallowedKey} is not allowed for status ${status.value}`);
        } else {
          pushIssue(issues, 'UNKNOWN_FIELD', `$.attempts[${index}].${disallowedKey}`, `Unknown field ${disallowedKey}`);
        }
      } else {
        pushIssue(issues, 'UNKNOWN_FIELD', `$.attempts[${index}].${key}`, `Unknown field ${key}`);
      }
      return null;
    }
  }

  const attemptRecordBase = {
    attemptNumber: attemptNumber.value as number,
    candidateRecipeId: candidateRecipeId.value as string,
    recipeFingerprint: recipeFingerprint.value as string,
    complexityRank: complexityRank.value as number,
    developmentCycleId: developmentCycleId.value as string,
    status: status.value as MLBInnerDevelopmentAttemptStatus,
    attemptTimestamp: attemptTimestamp.value as string,
    foldIds: normalizedFoldIds,
  };

  if (status.value === 'REGISTERED' || status.value === 'INTERRUPTED') {
    return attemptRecordBase as MLBInnerDevelopmentAttemptRecord;
  }

  if (status.value === 'RUNNING') {
    const provenance = ownDataProperty(attempt, 'executionProvenance', `$.attempts[${index}].executionProvenance`, issues);
    if (provenance.kind === 'accessor') return null;
    if (provenance.kind === 'missing') {
      pushIssue(issues, 'MISSING_EXECUTION_PROVENANCE', `$.attempts[${index}].executionProvenance`, 'executionProvenance is required for RUNNING');
      return null;
    }
    if (!isPlainObject(provenance.value)) {
      pushIssue(issues, 'INVALID_EXECUTION_PROVENANCE', `$.attempts[${index}].executionProvenance`, 'executionProvenance must be a plain object');
      return null;
    }
    if (!rejectSymbolProperties(provenance.value as Record<string, unknown>, `$.attempts[${index}].executionProvenance`, issues)) {
      return null;
    }
    for (const key of Object.getOwnPropertyNames(provenance.value)) {
      if (!PROVENANCE_KNOWN_FIELDS.has(key)) {
        pushIssue(issues, 'UNKNOWN_FIELD', `$.attempts[${index}].executionProvenance.${key}`, `Unknown field ${key}`);
        return null;
      }
    }

    const verifiedArtifactSha256 = ownDataProperty(provenance.value, 'verifiedArtifactSha256', `$.attempts[${index}].executionProvenance.verifiedArtifactSha256`, issues);
    if (verifiedArtifactSha256.kind === 'accessor') return null;
    if (verifiedArtifactSha256.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].executionProvenance.verifiedArtifactSha256`, 'verifiedArtifactSha256 is required');
      return null;
    }
    if (typeof verifiedArtifactSha256.value !== 'string' || !/^[0-9a-f]{64}$/.test(verifiedArtifactSha256.value)) {
      pushIssue(issues, 'INVALID_EXECUTION_PROVENANCE', `$.attempts[${index}].executionProvenance.verifiedArtifactSha256`, 'verifiedArtifactSha256 must be lowercase 64-char hex');
      return null;
    }

    const verifiedArtifactByteLength = ownDataProperty(provenance.value, 'verifiedArtifactByteLength', `$.attempts[${index}].executionProvenance.verifiedArtifactByteLength`, issues);
    if (verifiedArtifactByteLength.kind === 'accessor') return null;
    if (verifiedArtifactByteLength.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].executionProvenance.verifiedArtifactByteLength`, 'verifiedArtifactByteLength is required');
      return null;
    }
    if (typeof verifiedArtifactByteLength.value !== 'number' || !Number.isInteger(verifiedArtifactByteLength.value) || verifiedArtifactByteLength.value <= 0) {
      pushIssue(issues, 'INVALID_EXECUTION_PROVENANCE', `$.attempts[${index}].executionProvenance.verifiedArtifactByteLength`, 'verifiedArtifactByteLength must be a positive integer');
      return null;
    }

    const artifactId = ownDataProperty(provenance.value, 'artifactId', `$.attempts[${index}].executionProvenance.artifactId`, issues);
    if (artifactId.kind === 'accessor') return null;
    if (artifactId.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].executionProvenance.artifactId`, 'artifactId is required');
      return null;
    }
    if (typeof artifactId.value !== 'string' || artifactId.value.trim() === '' || artifactId.value !== artifactId.value.trim()) {
      pushIssue(issues, 'INVALID_EXECUTION_PROVENANCE', `$.attempts[${index}].executionProvenance.artifactId`, 'artifactId must be a non-empty trimmed string');
      return null;
    }

    const foldPlanId = ownDataProperty(provenance.value, 'foldPlanId', `$.attempts[${index}].executionProvenance.foldPlanId`, issues);
    if (foldPlanId.kind === 'accessor') return null;
    if (foldPlanId.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].executionProvenance.foldPlanId`, 'foldPlanId is required');
      return null;
    }
    if (typeof foldPlanId.value !== 'string' || foldPlanId.value.trim() === '' || foldPlanId.value !== foldPlanId.value.trim()) {
      pushIssue(issues, 'INVALID_EXECUTION_PROVENANCE', `$.attempts[${index}].executionProvenance.foldPlanId`, 'foldPlanId must be a non-empty trimmed string');
      return null;
    }

    return {
      ...attemptRecordBase,
      status: 'RUNNING' as const,
      executionProvenance: {
        verifiedArtifactSha256: verifiedArtifactSha256.value as string,
        verifiedArtifactByteLength: verifiedArtifactByteLength.value as number,
        artifactId: artifactId.value as string,
        foldPlanId: foldPlanId.value as string,
      },
    };
  }

  const provenance = ownDataProperty(attempt, 'executionProvenance', `$.attempts[${index}].executionProvenance`, issues);
  if (provenance.kind === 'accessor') return null;
  if (provenance.kind === 'missing') {
    pushIssue(issues, 'MISSING_EXECUTION_PROVENANCE', `$.attempts[${index}].executionProvenance`, 'executionProvenance is required for terminal attempts');
    return null;
  }
  if (!isPlainObject(provenance.value)) {
    pushIssue(issues, 'INVALID_EXECUTION_PROVENANCE', `$.attempts[${index}].executionProvenance`, 'executionProvenance must be a plain object');
    return null;
  }
  if (!rejectSymbolProperties(provenance.value as Record<string, unknown>, `$.attempts[${index}].executionProvenance`, issues)) {
    return null;
  }
  for (const key of Object.getOwnPropertyNames(provenance.value)) {
    if (!PROVENANCE_KNOWN_FIELDS.has(key)) {
      pushIssue(issues, 'UNKNOWN_FIELD', `$.attempts[${index}].executionProvenance.${key}`, `Unknown field ${key}`);
      return null;
    }
  }

  const tVerifiedArtifactSha256 = ownDataProperty(provenance.value, 'verifiedArtifactSha256', `$.attempts[${index}].executionProvenance.verifiedArtifactSha256`, issues);
  if (tVerifiedArtifactSha256.kind === 'accessor') return null;
  if (tVerifiedArtifactSha256.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].executionProvenance.verifiedArtifactSha256`, 'verifiedArtifactSha256 is required');
    return null;
  }
  if (typeof tVerifiedArtifactSha256.value !== 'string' || !/^[0-9a-f]{64}$/.test(tVerifiedArtifactSha256.value)) {
    pushIssue(issues, 'INVALID_EXECUTION_PROVENANCE', `$.attempts[${index}].executionProvenance.verifiedArtifactSha256`, 'verifiedArtifactSha256 must be lowercase 64-char hex');
    return null;
  }

  const tVerifiedArtifactByteLength = ownDataProperty(provenance.value, 'verifiedArtifactByteLength', `$.attempts[${index}].executionProvenance.verifiedArtifactByteLength`, issues);
  if (tVerifiedArtifactByteLength.kind === 'accessor') return null;
  if (tVerifiedArtifactByteLength.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].executionProvenance.verifiedArtifactByteLength`, 'verifiedArtifactByteLength is required');
    return null;
  }
  if (typeof tVerifiedArtifactByteLength.value !== 'number' || !Number.isInteger(tVerifiedArtifactByteLength.value) || tVerifiedArtifactByteLength.value <= 0) {
    pushIssue(issues, 'INVALID_EXECUTION_PROVENANCE', `$.attempts[${index}].executionProvenance.verifiedArtifactByteLength`, 'verifiedArtifactByteLength must be a positive integer');
    return null;
  }

  const tArtifactId = ownDataProperty(provenance.value, 'artifactId', `$.attempts[${index}].executionProvenance.artifactId`, issues);
  if (tArtifactId.kind === 'accessor') return null;
  if (tArtifactId.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].executionProvenance.artifactId`, 'artifactId is required');
    return null;
  }
  if (typeof tArtifactId.value !== 'string' || tArtifactId.value.trim() === '' || tArtifactId.value !== tArtifactId.value.trim()) {
    pushIssue(issues, 'INVALID_EXECUTION_PROVENANCE', `$.attempts[${index}].executionProvenance.artifactId`, 'artifactId must be a non-empty trimmed string');
    return null;
  }

  const tFoldPlanId = ownDataProperty(provenance.value, 'foldPlanId', `$.attempts[${index}].executionProvenance.foldPlanId`, issues);
  if (tFoldPlanId.kind === 'accessor') return null;
  if (tFoldPlanId.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].executionProvenance.foldPlanId`, 'foldPlanId is required');
    return null;
  }
  if (typeof tFoldPlanId.value !== 'string' || tFoldPlanId.value.trim() === '' || tFoldPlanId.value !== tFoldPlanId.value.trim()) {
    pushIssue(issues, 'INVALID_EXECUTION_PROVENANCE', `$.attempts[${index}].executionProvenance.foldPlanId`, 'foldPlanId must be a non-empty trimmed string');
    return null;
  }

  const normalizedProvenance: MLBInnerDevelopmentAttemptExecutionProvenance = {
    verifiedArtifactSha256: tVerifiedArtifactSha256.value as string,
    verifiedArtifactByteLength: tVerifiedArtifactByteLength.value as number,
    artifactId: tArtifactId.value as string,
    foldPlanId: tFoldPlanId.value as string,
  };

  const terminal = ownDataProperty(attempt, 'terminalExecution', `$.attempts[${index}].terminalExecution`, issues);
  if (terminal.kind === 'accessor') return null;
  if (terminal.kind === 'missing') {
    pushIssue(issues, 'MISSING_TERMINAL_EXECUTION', `$.attempts[${index}].terminalExecution`, 'terminalExecution is required for terminal attempts');
    return null;
  }
  if (!isPlainObject(terminal.value)) {
    pushIssue(issues, 'INVALID_TERMINAL_EXECUTION', `$.attempts[${index}].terminalExecution`, 'terminalExecution must be a plain object');
    return null;
  }
  if (!rejectSymbolProperties(terminal.value as Record<string, unknown>, `$.attempts[${index}].terminalExecution`, issues)) {
    return null;
  }
  for (const key of Object.getOwnPropertyNames(terminal.value)) {
    if (!TERMINAL_KNOWN_FIELDS.has(key)) {
      pushIssue(issues, 'UNKNOWN_FIELD', `$.attempts[${index}].terminalExecution.${key}`, `Unknown field ${key}`);
      return null;
    }
  }

  const terminalKind = ownDataProperty(terminal.value, 'kind', `$.attempts[${index}].terminalExecution.kind`, issues);
  if (terminalKind.kind === 'accessor') return null;
  if (terminalKind.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.kind`, 'kind is required');
    return null;
  }
  const terminalKindValue = terminalKind.value as 'SUCCESS' | 'FAILURE';

  if (status.value === 'COMPLETED_INNER_ELIGIBLE' || status.value === 'COMPLETED_INNER_REJECTED') {
    if (terminalKindValue !== 'SUCCESS') {
      pushIssue(issues, 'INVALID_TERMINAL_EXECUTION', `$.attempts[${index}].terminalExecution.kind`, 'kind must be SUCCESS for eligible/rejected');
      return null;
    }
  }

  if (status.value === 'FAILED') {
    if (terminalKindValue !== 'FAILURE') {
      pushIssue(issues, 'INVALID_TERMINAL_EXECUTION', `$.attempts[${index}].terminalExecution.kind`, 'kind must be FAILURE for failed');
      return null;
    }
  }

  const lowLevelFitCount = ownDataProperty(terminal.value, 'lowLevelFitCount', `$.attempts[${index}].terminalExecution.lowLevelFitCount`, issues);
  if (lowLevelFitCount.kind === 'accessor') return null;
  if (lowLevelFitCount.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.lowLevelFitCount`, 'lowLevelFitCount is required');
    return null;
  }
  if (typeof lowLevelFitCount.value !== 'number' || !Number.isInteger(lowLevelFitCount.value) || lowLevelFitCount.value < 0) {
    pushIssue(issues, 'INVALID_NUMBER', `$.attempts[${index}].terminalExecution.lowLevelFitCount`, 'lowLevelFitCount must be a non-negative integer');
    return null;
  }

  if (terminalKindValue === 'SUCCESS') {
    const foldResults = ownDataProperty(terminal.value, 'foldResults', `$.attempts[${index}].terminalExecution.foldResults`, issues);
    if (foldResults.kind === 'accessor') return null;
    if (foldResults.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.foldResults`, 'foldResults is required for SUCCESS');
      return null;
    }
    if (!Array.isArray(foldResults.value)) {
      pushIssue(issues, 'INVALID_ARRAY', `$.attempts[${index}].terminalExecution.foldResults`, 'foldResults must be an array');
      return null;
    }

    const aggregate = ownDataProperty(terminal.value, 'aggregate', `$.attempts[${index}].terminalExecution.aggregate`, issues);
    if (aggregate.kind === 'accessor') return null;
    if (aggregate.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.aggregate`, 'aggregate is required for SUCCESS');
      return null;
    }
    if (!isPlainObject(aggregate.value)) {
      pushIssue(issues, 'INVALID_TERMINAL_EXECUTION', `$.attempts[${index}].terminalExecution.aggregate`, 'aggregate must be a plain object');
      return null;
    }
    if (!rejectSymbolProperties(aggregate.value as Record<string, unknown>, `$.attempts[${index}].terminalExecution.aggregate`, issues)) {
      return null;
    }
    for (const key of Object.getOwnPropertyNames(aggregate.value)) {
      if (!AGGREGATE_KNOWN_FIELDS.has(key)) {
        pushIssue(issues, 'UNKNOWN_FIELD', `$.attempts[${index}].terminalExecution.aggregate.${key}`, `Unknown field ${key}`);
        return null;
      }
    }

    const aggregateContractVersion = ownDataProperty(aggregate.value, 'contractVersion', `$.attempts[${index}].terminalExecution.aggregate.contractVersion`, issues);
    if (aggregateContractVersion.kind === 'accessor') return null;
    if (aggregateContractVersion.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.aggregate.contractVersion`, 'contractVersion is required');
      return null;
    }
    if (aggregateContractVersion.value !== 'mlb-inner-aggregate-result-v1') {
      pushIssue(issues, 'INVALID_LITERAL', `$.attempts[${index}].terminalExecution.aggregate.contractVersion`, `contractVersion must be mlb-inner-aggregate-result-v1`);
      return null;
    }

    const aggregateCandidateRecipeId = ownDataProperty(aggregate.value, 'candidateRecipeId', `$.attempts[${index}].terminalExecution.aggregate.candidateRecipeId`, issues);
    if (aggregateCandidateRecipeId.kind === 'accessor') return null;
    if (aggregateCandidateRecipeId.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.aggregate.candidateRecipeId`, 'candidateRecipeId is required');
      return null;
    }
    if (typeof aggregateCandidateRecipeId.value !== 'string' || aggregateCandidateRecipeId.value.trim() === '' || aggregateCandidateRecipeId.value !== aggregateCandidateRecipeId.value.trim()) {
      pushIssue(issues, 'INVALID_STRING', `$.attempts[${index}].terminalExecution.aggregate.candidateRecipeId`, 'candidateRecipeId must be a non-empty trimmed string');
      return null;
    }
    if (aggregateCandidateRecipeId.value !== attemptRecordBase.candidateRecipeId) {
      pushIssue(issues, 'IDENTITY_MISMATCH', `$.attempts[${index}].terminalExecution.aggregate.candidateRecipeId`, 'aggregate candidateRecipeId must match attempt candidateRecipeId');
      return null;
    }

    const foldCount = ownDataProperty(aggregate.value, 'foldCount', `$.attempts[${index}].terminalExecution.aggregate.foldCount`, issues);
    if (foldCount.kind === 'accessor') return null;
    if (foldCount.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.aggregate.foldCount`, 'foldCount is required');
      return null;
    }
    if (typeof foldCount.value !== 'number' || !Number.isInteger(foldCount.value) || foldCount.value <= 0) {
      pushIssue(issues, 'INVALID_INTEGER', `$.attempts[${index}].terminalExecution.aggregate.foldCount`, 'foldCount must be a positive integer');
      return null;
    }
    if (foldCount.value !== (foldResults.value as unknown[]).length) {
      pushIssue(issues, 'INVALID_FOLD_SET', `$.attempts[${index}].terminalExecution.aggregate.foldCount`, 'aggregate foldCount must equal terminalExecution.foldResults.length');
      return null;
    }
    if (!attemptRecordBase.foldIds || foldCount.value !== attemptRecordBase.foldIds.length) {
      pushIssue(issues, 'INVALID_FOLD_SET', `$.attempts[${index}].terminalExecution.aggregate.foldCount`, 'aggregate foldCount must equal attempt.foldIds.length');
      return null;
    }

    const aggregateValidationRowCount = ownDataProperty(aggregate.value, 'aggregateValidationRowCount', `$.attempts[${index}].terminalExecution.aggregate.aggregateValidationRowCount`, issues);
    if (aggregateValidationRowCount.kind === 'accessor') return null;
    if (aggregateValidationRowCount.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.aggregate.aggregateValidationRowCount`, 'aggregateValidationRowCount is required');
      return null;
    }
    if (typeof aggregateValidationRowCount.value !== 'number' || !Number.isInteger(aggregateValidationRowCount.value) || aggregateValidationRowCount.value <= 0) {
      pushIssue(issues, 'INVALID_INTEGER', `$.attempts[${index}].terminalExecution.aggregate.aggregateValidationRowCount`, 'aggregateValidationRowCount must be a positive integer');
      return null;
    }

    const aggregateCandidateLogLoss = ownDataProperty(aggregate.value, 'aggregateCandidateLogLoss', `$.attempts[${index}].terminalExecution.aggregate.aggregateCandidateLogLoss`, issues);
    if (aggregateCandidateLogLoss.kind === 'accessor') return null;
    if (aggregateCandidateLogLoss.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.aggregate.aggregateCandidateLogLoss`, 'aggregateCandidateLogLoss is required');
      return null;
    }
    if (typeof aggregateCandidateLogLoss.value !== 'number' || !Number.isFinite(aggregateCandidateLogLoss.value)) {
      pushIssue(issues, 'NONFINITE_METRIC', `$.attempts[${index}].terminalExecution.aggregate.aggregateCandidateLogLoss`, 'aggregateCandidateLogLoss must be a finite number');
      return null;
    }

    const aggregateCandidateBrierScore = ownDataProperty(aggregate.value, 'aggregateCandidateBrierScore', `$.attempts[${index}].terminalExecution.aggregate.aggregateCandidateBrierScore`, issues);
    if (aggregateCandidateBrierScore.kind === 'accessor') return null;
    if (aggregateCandidateBrierScore.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.aggregate.aggregateCandidateBrierScore`, 'aggregateCandidateBrierScore is required');
      return null;
    }
    if (typeof aggregateCandidateBrierScore.value !== 'number' || !Number.isFinite(aggregateCandidateBrierScore.value)) {
      pushIssue(issues, 'NONFINITE_METRIC', `$.attempts[${index}].terminalExecution.aggregate.aggregateCandidateBrierScore`, 'aggregateCandidateBrierScore must be a finite number');
      return null;
    }

    const aggregateCandidateRocAuc = ownDataProperty(aggregate.value, 'aggregateCandidateRocAuc', `$.attempts[${index}].terminalExecution.aggregate.aggregateCandidateRocAuc`, issues);
    if (aggregateCandidateRocAuc.kind === 'accessor') return null;
    if (aggregateCandidateRocAuc.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.aggregate.aggregateCandidateRocAuc`, 'aggregateCandidateRocAuc is required');
      return null;
    }
    if (typeof aggregateCandidateRocAuc.value !== 'number' || !Number.isFinite(aggregateCandidateRocAuc.value)) {
      pushIssue(issues, 'NONFINITE_METRIC', `$.attempts[${index}].terminalExecution.aggregate.aggregateCandidateRocAuc`, 'aggregateCandidateRocAuc must be a finite number');
      return null;
    }

    const aggregateP50LogLoss = ownDataProperty(aggregate.value, 'aggregateP50LogLoss', `$.attempts[${index}].terminalExecution.aggregate.aggregateP50LogLoss`, issues);
    if (aggregateP50LogLoss.kind === 'accessor') return null;
    if (aggregateP50LogLoss.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.aggregate.aggregateP50LogLoss`, 'aggregateP50LogLoss is required');
      return null;
    }
    if (typeof aggregateP50LogLoss.value !== 'number' || !Number.isFinite(aggregateP50LogLoss.value)) {
      pushIssue(issues, 'NONFINITE_METRIC', `$.attempts[${index}].terminalExecution.aggregate.aggregateP50LogLoss`, 'aggregateP50LogLoss must be a finite number');
      return null;
    }

    const aggregateP50BrierScore = ownDataProperty(aggregate.value, 'aggregateP50BrierScore', `$.attempts[${index}].terminalExecution.aggregate.aggregateP50BrierScore`, issues);
    if (aggregateP50BrierScore.kind === 'accessor') return null;
    if (aggregateP50BrierScore.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.aggregate.aggregateP50BrierScore`, 'aggregateP50BrierScore is required');
      return null;
    }
    if (typeof aggregateP50BrierScore.value !== 'number' || !Number.isFinite(aggregateP50BrierScore.value)) {
      pushIssue(issues, 'NONFINITE_METRIC', `$.attempts[${index}].terminalExecution.aggregate.aggregateP50BrierScore`, 'aggregateP50BrierScore must be a finite number');
      return null;
    }

    const aggregateP50RocAuc = ownDataProperty(aggregate.value, 'aggregateP50RocAuc', `$.attempts[${index}].terminalExecution.aggregate.aggregateP50RocAuc`, issues);
    if (aggregateP50RocAuc.kind === 'accessor') return null;
    if (aggregateP50RocAuc.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.aggregate.aggregateP50RocAuc`, 'aggregateP50RocAuc is required');
      return null;
    }
    if (typeof aggregateP50RocAuc.value !== 'number' || !Number.isFinite(aggregateP50RocAuc.value)) {
      pushIssue(issues, 'NONFINITE_METRIC', `$.attempts[${index}].terminalExecution.aggregate.aggregateP50RocAuc`, 'aggregateP50RocAuc must be a finite number');
      return null;
    }

    const aggregateFoldTrainPriorLogLoss = ownDataProperty(aggregate.value, 'aggregateFoldTrainPriorLogLoss', `$.attempts[${index}].terminalExecution.aggregate.aggregateFoldTrainPriorLogLoss`, issues);
    if (aggregateFoldTrainPriorLogLoss.kind === 'accessor') return null;
    if (aggregateFoldTrainPriorLogLoss.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.aggregate.aggregateFoldTrainPriorLogLoss`, 'aggregateFoldTrainPriorLogLoss is required');
      return null;
    }
    if (typeof aggregateFoldTrainPriorLogLoss.value !== 'number' || !Number.isFinite(aggregateFoldTrainPriorLogLoss.value)) {
      pushIssue(issues, 'NONFINITE_METRIC', `$.attempts[${index}].terminalExecution.aggregate.aggregateFoldTrainPriorLogLoss`, 'aggregateFoldTrainPriorLogLoss must be a finite number');
      return null;
    }

    const aggregateFoldTrainPriorBrierScore = ownDataProperty(aggregate.value, 'aggregateFoldTrainPriorBrierScore', `$.attempts[${index}].terminalExecution.aggregate.aggregateFoldTrainPriorBrierScore`, issues);
    if (aggregateFoldTrainPriorBrierScore.kind === 'accessor') return null;
    if (aggregateFoldTrainPriorBrierScore.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.aggregate.aggregateFoldTrainPriorBrierScore`, 'aggregateFoldTrainPriorBrierScore is required');
      return null;
    }
    if (typeof aggregateFoldTrainPriorBrierScore.value !== 'number' || !Number.isFinite(aggregateFoldTrainPriorBrierScore.value)) {
      pushIssue(issues, 'NONFINITE_METRIC', `$.attempts[${index}].terminalExecution.aggregate.aggregateFoldTrainPriorBrierScore`, 'aggregateFoldTrainPriorBrierScore must be a finite number');
      return null;
    }

    const aggregateFoldTrainPriorRocAuc = ownDataProperty(aggregate.value, 'aggregateFoldTrainPriorRocAuc', `$.attempts[${index}].terminalExecution.aggregate.aggregateFoldTrainPriorRocAuc`, issues);
    if (aggregateFoldTrainPriorRocAuc.kind === 'accessor') return null;
    if (aggregateFoldTrainPriorRocAuc.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.aggregate.aggregateFoldTrainPriorRocAuc`, 'aggregateFoldTrainPriorRocAuc is required');
      return null;
    }
    if (typeof aggregateFoldTrainPriorRocAuc.value !== 'number' || !Number.isFinite(aggregateFoldTrainPriorRocAuc.value)) {
      pushIssue(issues, 'NONFINITE_METRIC', `$.attempts[${index}].terminalExecution.aggregate.aggregateFoldTrainPriorRocAuc`, 'aggregateFoldTrainPriorRocAuc must be a finite number');
      return null;
    }

    const worstFoldCandidateLogLoss = ownDataProperty(aggregate.value, 'worstFoldCandidateLogLoss', `$.attempts[${index}].terminalExecution.aggregate.worstFoldCandidateLogLoss`, issues);
    if (worstFoldCandidateLogLoss.kind === 'accessor') return null;
    if (worstFoldCandidateLogLoss.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.aggregate.worstFoldCandidateLogLoss`, 'worstFoldCandidateLogLoss is required');
      return null;
    }
    if (typeof worstFoldCandidateLogLoss.value !== 'number' || !Number.isFinite(worstFoldCandidateLogLoss.value)) {
      pushIssue(issues, 'NONFINITE_METRIC', `$.attempts[${index}].terminalExecution.aggregate.worstFoldCandidateLogLoss`, 'worstFoldCandidateLogLoss must be a finite number');
      return null;
    }

    const worstFoldCandidateBrierScore = ownDataProperty(aggregate.value, 'worstFoldCandidateBrierScore', `$.attempts[${index}].terminalExecution.aggregate.worstFoldCandidateBrierScore`, issues);
    if (worstFoldCandidateBrierScore.kind === 'accessor') return null;
    if (worstFoldCandidateBrierScore.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.aggregate.worstFoldCandidateBrierScore`, 'worstFoldCandidateBrierScore is required');
      return null;
    }
    if (typeof worstFoldCandidateBrierScore.value !== 'number' || !Number.isFinite(worstFoldCandidateBrierScore.value)) {
      pushIssue(issues, 'NONFINITE_METRIC', `$.attempts[${index}].terminalExecution.aggregate.worstFoldCandidateBrierScore`, 'worstFoldCandidateBrierScore must be a finite number');
      return null;
    }

    const validateBeatingCount = (value: unknown, field: string, path: string) => {
      const result = ownDataProperty(value as Record<string, unknown>, field, path, issues);
      if (result.kind === 'accessor') return null as never;
      if (result.kind === 'missing') {
        pushIssue(issues, 'MISSING_FIELD', path, `${field} is required`);
        return null as never;
      }
      if (typeof result.value !== 'number' || !Number.isInteger(result.value) || result.value < 0) {
        pushIssue(issues, 'INVALID_INTEGER', path, `${field} must be a non-negative integer`);
        return null as never;
      }
      if (result.value > (foldCount.value as number)) {
        pushIssue(issues, 'INVALID_INTEGER', path, `${field} must not exceed foldCount`);
        return null as never;
      }
      return result.value as number;
    };

    const foldsBeatingP50OnLogLoss = validateBeatingCount(aggregate.value, 'foldsBeatingP50OnLogLoss', `$.attempts[${index}].terminalExecution.aggregate.foldsBeatingP50OnLogLoss`);
    if (foldsBeatingP50OnLogLoss === null as never) return null;

    const foldsBeatingP50OnBrier = validateBeatingCount(aggregate.value, 'foldsBeatingP50OnBrier', `$.attempts[${index}].terminalExecution.aggregate.foldsBeatingP50OnBrier`);
    if (foldsBeatingP50OnBrier === null as never) return null;

    const foldsBeatingFoldTrainPriorOnLogLoss = validateBeatingCount(aggregate.value, 'foldsBeatingFoldTrainPriorOnLogLoss', `$.attempts[${index}].terminalExecution.aggregate.foldsBeatingFoldTrainPriorOnLogLoss`);
    if (foldsBeatingFoldTrainPriorOnLogLoss === null as never) return null;

    const foldsBeatingFoldTrainPriorOnBrier = validateBeatingCount(aggregate.value, 'foldsBeatingFoldTrainPriorOnBrier', `$.attempts[${index}].terminalExecution.aggregate.foldsBeatingFoldTrainPriorOnBrier`);
    if (foldsBeatingFoldTrainPriorOnBrier === null as never) return null;

    const gate = ownDataProperty(terminal.value, 'gate', `$.attempts[${index}].terminalExecution.gate`, issues);
    if (gate.kind === 'accessor') return null;
    if (gate.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.gate`, 'gate is required for SUCCESS');
      return null;
    }
    if (!isPlainObject(gate.value)) {
      pushIssue(issues, 'INVALID_TERMINAL_EXECUTION', `$.attempts[${index}].terminalExecution.gate`, 'gate must be a plain object');
      return null;
    }
    if (!rejectSymbolProperties(gate.value as Record<string, unknown>, `$.attempts[${index}].terminalExecution.gate`, issues)) {
      return null;
    }
    for (const key of Object.getOwnPropertyNames(gate.value)) {
      if (!GATE_KNOWN_FIELDS.has(key)) {
        pushIssue(issues, 'UNKNOWN_FIELD', `$.attempts[${index}].terminalExecution.gate.${key}`, `Unknown field ${key}`);
        return null;
      }
    }

    const eligibility = ownDataProperty(gate.value, 'eligibility', `$.attempts[${index}].terminalExecution.gate.eligibility`, issues);
    if (eligibility.kind === 'accessor') return null;
    if (eligibility.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.gate.eligibility`, 'eligibility is required');
      return null;
    }
    if (eligibility.value !== 'INNER_ELIGIBLE' && eligibility.value !== 'INNER_REJECTED') {
      pushIssue(issues, 'INVALID_TERMINAL_EXECUTION', `$.attempts[${index}].terminalExecution.gate.eligibility`, 'eligibility must be INNER_ELIGIBLE or INNER_REJECTED');
      return null;
    }
    if (status.value === 'COMPLETED_INNER_ELIGIBLE' && eligibility.value !== 'INNER_ELIGIBLE') {
      pushIssue(issues, 'GATE_STATUS_MISMATCH', `$.attempts[${index}].terminalExecution.gate.eligibility`, 'eligible status requires INNER_ELIGIBLE gate');
      return null;
    }
    if (status.value === 'COMPLETED_INNER_REJECTED' && eligibility.value !== 'INNER_REJECTED') {
      pushIssue(issues, 'GATE_STATUS_MISMATCH', `$.attempts[${index}].terminalExecution.gate.eligibility`, 'rejected status requires INNER_REJECTED gate');
      return null;
    }

    const reasons = ownDataProperty(gate.value, 'reasons', `$.attempts[${index}].terminalExecution.gate.reasons`, issues);
    if (reasons.kind === 'accessor') return null;
    if (reasons.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.gate.reasons`, 'reasons is required');
      return null;
    }
    if (!Array.isArray(reasons.value)) {
      pushIssue(issues, 'INVALID_ARRAY', `$.attempts[${index}].terminalExecution.gate.reasons`, 'reasons must be an array');
      return null;
    }

    const terminalExecutionRaw = {
      kind: 'SUCCESS',
      lowLevelFitCount: lowLevelFitCount.value as number,
      foldResults: (foldResults.value as unknown[]).map((foldResult, foldIndex) => {
        const readResult = readDataArrayElement(foldResults.value, foldIndex, `$.attempts[${index}].terminalExecution.foldResults`, issues);
        if (!readResult.ok) return null as never;
        const rawFold = readResult.value;
        if (!isPlainObject(rawFold)) {
          pushIssue(issues, 'INVALID_TERMINAL_EXECUTION', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}]`, 'fold result must be a plain object');
          return null as never;
        }
        if (!rejectSymbolProperties(rawFold as Record<string, unknown>, `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}]`, issues)) {
          return null as never;
        }
        for (const foldKey of Object.getOwnPropertyNames(rawFold)) {
          if (!FOLD_RESULT_KNOWN_FIELDS.has(foldKey)) {
            pushIssue(issues, 'UNKNOWN_FIELD', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].${foldKey}`, `Unknown field ${foldKey}`);
            return null as never;
          }
        }

        const contractVersion = ownDataProperty(rawFold, 'contractVersion', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].contractVersion`, issues);
        if (contractVersion.kind === 'accessor') return null as never;
        if (contractVersion.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].contractVersion`, 'contractVersion is required');
          return null as never;
        }
        if (contractVersion.value !== 'mlb-inner-fold-metric-result-v1') {
          pushIssue(issues, 'INVALID_LITERAL', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].contractVersion`, `contractVersion must be mlb-inner-fold-metric-result-v1`);
          return null as never;
        }

        const foldId = ownDataProperty(rawFold, 'foldId', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].foldId`, issues);
        if (foldId.kind === 'accessor') return null as never;
        if (foldId.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].foldId`, 'foldId is required');
          return null as never;
        }
        if (typeof foldId.value !== 'string' || foldId.value.trim() === '' || foldId.value !== foldId.value.trim()) {
          pushIssue(issues, 'INVALID_STRING', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].foldId`, 'foldId must be a non-empty trimmed string');
          return null as never;
        }

        const candidateRecipeId = ownDataProperty(rawFold, 'candidateRecipeId', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].candidateRecipeId`, issues);
        if (candidateRecipeId.kind === 'accessor') return null as never;
        if (candidateRecipeId.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].candidateRecipeId`, 'candidateRecipeId is required');
          return null as never;
        }
        if (typeof candidateRecipeId.value !== 'string' || candidateRecipeId.value.trim() === '' || candidateRecipeId.value !== candidateRecipeId.value.trim()) {
          pushIssue(issues, 'INVALID_STRING', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].candidateRecipeId`, 'candidateRecipeId must be a non-empty trimmed string');
          return null as never;
        }
        if (candidateRecipeId.value !== attemptRecordBase.candidateRecipeId) {
          pushIssue(issues, 'MIXED_CANDIDATE_RECIPE_ID', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].candidateRecipeId`, 'fold candidateRecipeId must match attempt candidateRecipeId');
          return null as never;
        }

        const rowCount = ownDataProperty(rawFold, 'rowCount', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].rowCount`, issues);
        if (rowCount.kind === 'accessor') return null as never;
        if (rowCount.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].rowCount`, 'rowCount is required');
          return null as never;
        }
        if (typeof rowCount.value !== 'number' || !Number.isInteger(rowCount.value) || rowCount.value <= 0) {
          pushIssue(issues, 'INVALID_INTEGER', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].rowCount`, 'rowCount must be a positive integer');
          return null as never;
        }

        const targetHomeWinCount = ownDataProperty(rawFold, 'targetHomeWinCount', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].targetHomeWinCount`, issues);
        if (targetHomeWinCount.kind === 'accessor') return null as never;
        if (targetHomeWinCount.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].targetHomeWinCount`, 'targetHomeWinCount is required');
          return null as never;
        }
        if (typeof targetHomeWinCount.value !== 'number' || !Number.isInteger(targetHomeWinCount.value) || targetHomeWinCount.value < 0) {
          pushIssue(issues, 'INVALID_INTEGER', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].targetHomeWinCount`, 'targetHomeWinCount must be a non-negative integer');
          return null as never;
        }

        const targetAwayWinCount = ownDataProperty(rawFold, 'targetAwayWinCount', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].targetAwayWinCount`, issues);
        if (targetAwayWinCount.kind === 'accessor') return null as never;
        if (targetAwayWinCount.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].targetAwayWinCount`, 'targetAwayWinCount is required');
          return null as never;
        }
        if (typeof targetAwayWinCount.value !== 'number' || !Number.isInteger(targetAwayWinCount.value) || targetAwayWinCount.value < 0) {
          pushIssue(issues, 'INVALID_INTEGER', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].targetAwayWinCount`, 'targetAwayWinCount must be a non-negative integer');
          return null as never;
        }
        if (targetHomeWinCount.value + targetAwayWinCount.value !== rowCount.value) {
          pushIssue(issues, 'CLASS_COUNT_MISMATCH', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}]`, 'targetHomeWinCount + targetAwayWinCount must equal rowCount');
          return null as never;
        }

        const candidateLogLoss = ownDataProperty(rawFold, 'candidateLogLoss', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].candidateLogLoss`, issues);
        if (candidateLogLoss.kind === 'accessor') return null as never;
        if (candidateLogLoss.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].candidateLogLoss`, 'candidateLogLoss is required');
          return null as never;
        }
        if (typeof candidateLogLoss.value !== 'number' || !Number.isFinite(candidateLogLoss.value)) {
          pushIssue(issues, 'NONFINITE_METRIC', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].candidateLogLoss`, 'candidateLogLoss must be a finite number');
          return null as never;
        }

        const candidateBrierScore = ownDataProperty(rawFold, 'candidateBrierScore', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].candidateBrierScore`, issues);
        if (candidateBrierScore.kind === 'accessor') return null as never;
        if (candidateBrierScore.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].candidateBrierScore`, 'candidateBrierScore is required');
          return null as never;
        }
        if (typeof candidateBrierScore.value !== 'number' || !Number.isFinite(candidateBrierScore.value)) {
          pushIssue(issues, 'NONFINITE_METRIC', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].candidateBrierScore`, 'candidateBrierScore must be a finite number');
          return null as never;
        }

        const candidateRocAuc = ownDataProperty(rawFold, 'candidateRocAuc', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].candidateRocAuc`, issues);
        if (candidateRocAuc.kind === 'accessor') return null as never;
        if (candidateRocAuc.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].candidateRocAuc`, 'candidateRocAuc is required');
          return null as never;
        }
        if (typeof candidateRocAuc.value !== 'number' || !Number.isFinite(candidateRocAuc.value)) {
          pushIssue(issues, 'NONFINITE_METRIC', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].candidateRocAuc`, 'candidateRocAuc must be a finite number');
          return null as never;
        }

        const p50LogLoss = ownDataProperty(rawFold, 'p50LogLoss', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].p50LogLoss`, issues);
        if (p50LogLoss.kind === 'accessor') return null as never;
        if (p50LogLoss.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].p50LogLoss`, 'p50LogLoss is required');
          return null as never;
        }
        if (typeof p50LogLoss.value !== 'number' || !Number.isFinite(p50LogLoss.value)) {
          pushIssue(issues, 'NONFINITE_METRIC', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].p50LogLoss`, 'p50LogLoss must be a finite number');
          return null as never;
        }

        const p50BrierScore = ownDataProperty(rawFold, 'p50BrierScore', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].p50BrierScore`, issues);
        if (p50BrierScore.kind === 'accessor') return null as never;
        if (p50BrierScore.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].p50BrierScore`, 'p50BrierScore is required');
          return null as never;
        }
        if (typeof p50BrierScore.value !== 'number' || !Number.isFinite(p50BrierScore.value)) {
          pushIssue(issues, 'NONFINITE_METRIC', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].p50BrierScore`, 'p50BrierScore must be a finite number');
          return null as never;
        }

        const p50RocAuc = ownDataProperty(rawFold, 'p50RocAuc', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].p50RocAuc`, issues);
        if (p50RocAuc.kind === 'accessor') return null as never;
        if (p50RocAuc.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].p50RocAuc`, 'p50RocAuc is required');
          return null as never;
        }
        if (typeof p50RocAuc.value !== 'number' || !Number.isFinite(p50RocAuc.value)) {
          pushIssue(issues, 'NONFINITE_METRIC', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].p50RocAuc`, 'p50RocAuc must be a finite number');
          return null as never;
        }

        const foldTrainPriorLogLoss = ownDataProperty(rawFold, 'foldTrainPriorLogLoss', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].foldTrainPriorLogLoss`, issues);
        if (foldTrainPriorLogLoss.kind === 'accessor') return null as never;
        if (foldTrainPriorLogLoss.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].foldTrainPriorLogLoss`, 'foldTrainPriorLogLoss is required');
          return null as never;
        }
        if (typeof foldTrainPriorLogLoss.value !== 'number' || !Number.isFinite(foldTrainPriorLogLoss.value)) {
          pushIssue(issues, 'NONFINITE_METRIC', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].foldTrainPriorLogLoss`, 'foldTrainPriorLogLoss must be a finite number');
          return null as never;
        }

        const foldTrainPriorBrierScore = ownDataProperty(rawFold, 'foldTrainPriorBrierScore', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].foldTrainPriorBrierScore`, issues);
        if (foldTrainPriorBrierScore.kind === 'accessor') return null as never;
        if (foldTrainPriorBrierScore.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].foldTrainPriorBrierScore`, 'foldTrainPriorBrierScore is required');
          return null as never;
        }
        if (typeof foldTrainPriorBrierScore.value !== 'number' || !Number.isFinite(foldTrainPriorBrierScore.value)) {
          pushIssue(issues, 'NONFINITE_METRIC', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].foldTrainPriorBrierScore`, 'foldTrainPriorBrierScore must be a finite number');
          return null as never;
        }

        const foldTrainPriorRocAuc = ownDataProperty(rawFold, 'foldTrainPriorRocAuc', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].foldTrainPriorRocAuc`, issues);
        if (foldTrainPriorRocAuc.kind === 'accessor') return null as never;
        if (foldTrainPriorRocAuc.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].foldTrainPriorRocAuc`, 'foldTrainPriorRocAuc is required');
          return null as never;
        }
        if (typeof foldTrainPriorRocAuc.value !== 'number' || !Number.isFinite(foldTrainPriorRocAuc.value)) {
          pushIssue(issues, 'NONFINITE_METRIC', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].foldTrainPriorRocAuc`, 'foldTrainPriorRocAuc must be a finite number');
          return null as never;
        }

        const foldTrainPriorProbability = ownDataProperty(rawFold, 'foldTrainPriorProbability', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].foldTrainPriorProbability`, issues);
        if (foldTrainPriorProbability.kind === 'accessor') return null as never;
        if (foldTrainPriorProbability.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].foldTrainPriorProbability`, 'foldTrainPriorProbability is required');
          return null as never;
        }
        if (typeof foldTrainPriorProbability.value !== 'number' || !Number.isFinite(foldTrainPriorProbability.value)) {
          pushIssue(issues, 'NONFINITE_METRIC', `$.attempts[${index}].terminalExecution.foldResults[${foldIndex}].foldTrainPriorProbability`, 'foldTrainPriorProbability must be a finite number');
          return null as never;
        }

        return {
          contractVersion: contractVersion.value as 'mlb-inner-fold-metric-result-v1',
          foldId: foldId.value as string,
          candidateRecipeId: candidateRecipeId.value as string,
          rowCount: rowCount.value as number,
          targetHomeWinCount: targetHomeWinCount.value as number,
          targetAwayWinCount: targetAwayWinCount.value as number,
          candidateLogLoss: candidateLogLoss.value as number,
          candidateBrierScore: candidateBrierScore.value as number,
          candidateRocAuc: candidateRocAuc.value as number,
          p50LogLoss: p50LogLoss.value as number,
          p50BrierScore: p50BrierScore.value as number,
          p50RocAuc: p50RocAuc.value as number,
          foldTrainPriorLogLoss: foldTrainPriorLogLoss.value as number,
          foldTrainPriorBrierScore: foldTrainPriorBrierScore.value as number,
          foldTrainPriorRocAuc: foldTrainPriorRocAuc.value as number,
          foldTrainPriorProbability: foldTrainPriorProbability.value as number,
        };
      }),
      aggregate: aggregate.value as MLBInnerAggregateResult,
      gate: gate.value as MLBInnerCandidateGateResult,
    };

    const normalizedFoldResults = terminalExecutionRaw.foldResults as unknown[];
    if (normalizedFoldResults.some((fold) => fold === null)) {
      return null as never;
    }
    const typedFoldResults = normalizedFoldResults as MLBInnerFoldMetricResult[];
    if (!attemptRecordBase.foldIds || typedFoldResults.length !== attemptRecordBase.foldIds.length) {
      pushIssue(issues, 'INVALID_FOLD_SET', `$.attempts[${index}].terminalExecution.foldResults`, 'foldResults length must equal attempt.foldIds.length');
      return null as never;
    }
    for (let i = 0; i < typedFoldResults.length; i++) {
      if (typedFoldResults[i].foldId !== attemptRecordBase.foldIds[i]) {
        pushIssue(issues, 'INVALID_FOLD_SET', `$.attempts[${index}].terminalExecution.foldResults[${i}]`, `foldResults[${i}].foldId must equal attempt.foldIds[${i}]`);
        return null as never;
      }
    }

    const terminalExecution = {
      ...terminalExecutionRaw,
      foldResults: typedFoldResults,
    } as MLBInnerDevelopmentAttemptTerminalSuccess;

    return {
      ...attemptRecordBase,
      status: status.value as 'COMPLETED_INNER_ELIGIBLE' | 'COMPLETED_INNER_REJECTED',
      executionProvenance: normalizedProvenance,
      terminalExecution,
    };
  } else {
    const failedFoldId = ownDataProperty(terminal.value, 'failedFoldId', `$.attempts[${index}].terminalExecution.failedFoldId`, issues);
  if (failedFoldId.kind !== 'missing' && failedFoldId.kind !== 'data') {
    return null;
  }
  if (failedFoldId.kind === 'data') {
    if (typeof failedFoldId.value !== 'string' || failedFoldId.value.trim() === '' || failedFoldId.value !== failedFoldId.value.trim()) {
      pushIssue(issues, 'INVALID_STRING', `$.attempts[${index}].terminalExecution.failedFoldId`, 'failedFoldId must be a non-empty trimmed string when present');
      return null;
    }
  }

  const terminalIssues = ownDataProperty(terminal.value, 'issues', `$.attempts[${index}].terminalExecution.issues`, issues);
  if (terminalIssues.kind === 'accessor') return null;
  if (terminalIssues.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.issues`, 'issues is required');
    return null;
  }
  if (!Array.isArray(terminalIssues.value)) {
    pushIssue(issues, 'INVALID_ARRAY', `$.attempts[${index}].terminalExecution.issues`, 'issues must be an array');
    return null;
  }
  const normalizedTerminalIssues: MLBInnerDevelopmentCandidateExecutionIssue[] = [];
  for (let i = 0; i < (terminalIssues.value as unknown[]).length; i++) {
    const issueResult = readDataArrayElement(terminalIssues.value, i, `$.attempts[${index}].terminalExecution.issues`, issues);
    if (!issueResult.ok) return null;
    const rawIssue = issueResult.value;
    if (!isPlainObject(rawIssue)) {
      pushIssue(issues, 'INVALID_TERMINAL_EXECUTION', `$.attempts[${index}].terminalExecution.issues[${i}]`, 'issue must be a plain object');
      return null;
    }
    if (!rejectSymbolProperties(rawIssue as Record<string, unknown>, `$.attempts[${index}].terminalExecution.issues[${i}]`, issues)) {
      return null;
    }
    for (const issueKey of Object.getOwnPropertyNames(rawIssue)) {
      if (!TERMINAL_ISSUE_KNOWN_FIELDS.has(issueKey)) {
        pushIssue(issues, 'UNKNOWN_FIELD', `$.attempts[${index}].terminalExecution.issues[${i}].${issueKey}`, `Unknown field ${issueKey}`);
        return null;
      }
    }

    const issueCode = ownDataProperty(rawIssue, 'code', `$.attempts[${index}].terminalExecution.issues[${i}].code`, issues);
    if (issueCode.kind === 'accessor') return null;
    if (issueCode.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.issues[${i}].code`, 'code is required');
      return null;
    }
    if (typeof issueCode.value !== 'string' || issueCode.value.trim() === '' || issueCode.value !== issueCode.value.trim()) {
      pushIssue(issues, 'INVALID_STRING', `$.attempts[${index}].terminalExecution.issues[${i}].code`, 'code must be a non-empty trimmed string');
      return null;
    }

    const issuePath = ownDataProperty(rawIssue, 'path', `$.attempts[${index}].terminalExecution.issues[${i}].path`, issues);
    if (issuePath.kind === 'accessor') return null;
    if (issuePath.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.issues[${i}].path`, 'path is required');
      return null;
    }
    if (typeof issuePath.value !== 'string' || issuePath.value.trim() === '' || issuePath.value !== issuePath.value.trim()) {
      pushIssue(issues, 'INVALID_STRING', `$.attempts[${index}].terminalExecution.issues[${i}].path`, 'path must be a non-empty trimmed string');
      return null;
    }

    const issueMessage = ownDataProperty(rawIssue, 'message', `$.attempts[${index}].terminalExecution.issues[${i}].message`, issues);
    if (issueMessage.kind === 'accessor') return null;
    if (issueMessage.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].terminalExecution.issues[${i}].message`, 'message is required');
      return null;
    }
    if (typeof issueMessage.value !== 'string' || issueMessage.value.trim() === '' || issueMessage.value !== issueMessage.value.trim()) {
      pushIssue(issues, 'INVALID_STRING', `$.attempts[${index}].terminalExecution.issues[${i}].message`, 'message must be a non-empty trimmed string');
      return null;
    }

    normalizedTerminalIssues.push({
      code: issueCode.value as MLBInnerDevelopmentCandidateExecutionIssue['code'],
      path: issuePath.value as string,
      message: issueMessage.value as string,
    });
  }

  return {
    ...attemptRecordBase,
    status: 'FAILED' as const,
    executionProvenance: normalizedProvenance,
    terminalExecution: {
      kind: 'FAILURE',
      lowLevelFitCount: lowLevelFitCount.value as number,
      failedFoldId: failedFoldId.kind === 'data' ? (failedFoldId.value as string) : undefined,
      issues: normalizedTerminalIssues,
    },
  };
}
}

function validateMLBInnerDevelopmentCampaignLedger(
  value: unknown,
): MLBInnerDevelopmentCampaignLedgerResult {
  const issues: MLBInnerDevelopmentCampaignLedgerIssue[] = [];

  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$', 'ledger must be a plain object');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }

  if (!rejectSymbolProperties(value as Record<string, unknown>, '$', issues)) {
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }

  for (const key of Object.getOwnPropertyNames(value)) {
    if (!LEDGER_KNOWN_FIELDS.has(key)) {
      pushIssue(issues, 'UNKNOWN_FIELD', `$.${key}`, `Unknown field ${key}`);
    }
  }
  if (issues.length > 0) {
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }

  const ledgerContractVersion = ownDataProperty(value, 'ledgerContractVersion', '$.ledgerContractVersion', issues);
  if (ledgerContractVersion.kind === 'accessor') {
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }
  if (ledgerContractVersion.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.ledgerContractVersion', 'ledgerContractVersion is required');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }
  if (ledgerContractVersion.value !== MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION) {
    pushIssue(issues, 'INVALID_LITERAL', '$.ledgerContractVersion', `ledgerContractVersion must be ${MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION}`);
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }

  const developmentCycleId = ownDataProperty(value, 'developmentCycleId', '$.developmentCycleId', issues);
  if (developmentCycleId.kind === 'accessor') {
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }
  if (developmentCycleId.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.developmentCycleId', 'developmentCycleId is required');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }
  if (developmentCycleId.value !== MLB_INNER_DEVELOPMENT_CYCLE_ID) {
    pushIssue(issues, 'INVALID_LITERAL', '$.developmentCycleId', `developmentCycleId must be ${MLB_INNER_DEVELOPMENT_CYCLE_ID}`);
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }

  const createdAt = ownDataProperty(value, 'createdAt', '$.createdAt', issues);
  if (createdAt.kind === 'accessor') {
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }
  if (createdAt.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.createdAt', 'createdAt is required');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }
  if (!validateTimestamp(createdAt.value, '$.createdAt', issues)) {
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }

  const updatedAt = ownDataProperty(value, 'updatedAt', '$.updatedAt', issues);
  if (updatedAt.kind === 'accessor') {
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }
  if (updatedAt.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.updatedAt', 'updatedAt is required');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }
  if (!validateTimestamp(updatedAt.value, '$.updatedAt', issues)) {
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }
  if ((createdAt.value as string) > (updatedAt.value as string)) {
    pushIssue(issues, 'TIMESTAMP_ORDER_VIOLATION', '$.updatedAt', 'updatedAt must not be before createdAt');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }

  const budget = ownDataProperty(value, 'budget', '$.budget', issues);
  if (budget.kind === 'accessor') {
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }
  if (budget.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.budget', 'budget is required');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }
  if (!validateBudget(budget.value, '$.budget', issues)) {
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }

  const registeredRecipes = ownDataProperty(value, 'registeredRecipes', '$.registeredRecipes', issues);
  if (registeredRecipes.kind === 'accessor') {
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }
  if (registeredRecipes.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.registeredRecipes', 'registeredRecipes is required');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }
  if (!Array.isArray(registeredRecipes.value)) {
    pushIssue(issues, 'INVALID_ARRAY', '$.registeredRecipes', 'registeredRecipes must be an array');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }

  const validatedRecipes: MLBInnerDevelopmentRegisteredRecipeRecord[] = [];
  const recipeIdSet = new Set<string>();
  const fingerprintSet = new Set<string>();
  const sequenceSet = new Set<number>();

  for (let i = 0; i < registeredRecipes.value.length; i++) {
    const recipeResult = readDataArrayElement(registeredRecipes.value, i, '$.registeredRecipes', issues);
    if (!recipeResult.ok) {
      return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
    }
    const validated = validateRegisteredRecipe(recipeResult.value, i, issues);
    if (!validated) {
      return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
    }

    if (recipeIdSet.has(validated.candidateRecipeId)) {
      pushIssue(issues, 'DUPLICATE_REGISTERED_RECIPE_ID', `$.registeredRecipes[${i}].candidateRecipeId`, `Duplicate registered recipe ID ${validated.candidateRecipeId}`);
      return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
    }
    recipeIdSet.add(validated.candidateRecipeId);

    if (fingerprintSet.has(validated.recipeFingerprint)) {
      pushIssue(issues, 'DUPLICATE_REGISTERED_FINGERPRINT', `$.registeredRecipes[${i}].recipeFingerprint`, `Duplicate registered fingerprint ${validated.recipeFingerprint}`);
      return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
    }
    fingerprintSet.add(validated.recipeFingerprint);

    if (sequenceSet.has(validated.registrationSequence)) {
      pushIssue(issues, 'DUPLICATE_REGISTRATION_SEQUENCE', `$.registeredRecipes[${i}].registrationSequence`, `Duplicate registrationSequence ${validated.registrationSequence}`);
      return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
    }
    sequenceSet.add(validated.registrationSequence);

    validatedRecipes.push(validated);
  }

  const budgetIds = (budget.value as MLBInnerDevelopmentRecipeBudget).seenRecipeIds;
  const budgetFingerprints = (budget.value as MLBInnerDevelopmentRecipeBudget).seenRecipeFingerprints;
  const budgetComplexityRanks = (budget.value as MLBInnerDevelopmentRecipeBudget).seenComplexityRanks;

  if (validatedRecipes.length !== budgetIds.length) {
    pushIssue(issues, 'RECIPE_COUNT_MISMATCH', '$.registeredRecipes', 'registeredRecipes length must match budget.seenRecipeIds length');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }

  for (let i = 0; i < validatedRecipes.length; i++) {
    const recipe = validatedRecipes[i];
    if (recipe.candidateRecipeId !== budgetIds[i]) {
      pushIssue(issues, 'BUDGET_RECIPE_ID_MISMATCH', `$.registeredRecipes[${i}]`, `registeredRecipes[${i}].candidateRecipeId does not match budget.seenRecipeIds[${i}]`);
      return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
    }
    if (recipe.recipeFingerprint !== budgetFingerprints[i]) {
      pushIssue(issues, 'BUDGET_FINGERPRINT_MISMATCH', `$.registeredRecipes[${i}]`, `registeredRecipes[${i}].recipeFingerprint does not match budget.seenRecipeFingerprints[${i}]`);
      return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
    }
    if (recipe.complexityRank !== budgetComplexityRanks[i]) {
      pushIssue(issues, 'BUDGET_COMPLEXITY_MISMATCH', `$.registeredRecipes[${i}]`, `registeredRecipes[${i}].complexityRank does not match budget.seenComplexityRanks[${i}]`);
      return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
    }

    const recipeDescriptor: MLBInnerCandidateRecipe = {
      candidateRecipeId: recipe.candidateRecipeId,
      preprocessingPolicyId: recipe.preprocessingPolicyId,
      featurePolicyId: recipe.featurePolicyId,
      modelFamilyId: recipe.modelFamilyId,
      regularizationConfig: recipe.regularizationConfig,
      optimizerConfig: recipe.optimizerConfig,
      otherModelAffectingChoices: recipe.otherModelAffectingChoices,
      complexityRank: recipe.complexityRank,
    };

    const fingerprintResult = computeMLBInnerCandidateRecipeFingerprint(recipeDescriptor);
    if (!fingerprintResult.ok) {
      pushIssue(issues, 'RECIPE_FINGERPRINT_RECOMPUTE_MISMATCH', `$.registeredRecipes[${i}]`, `Fingerprint recomputation failed for ${recipe.candidateRecipeId}`);
      return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
    }
    if (fingerprintResult.fingerprint !== recipe.recipeFingerprint) {
      pushIssue(issues, 'RECIPE_FINGERPRINT_RECOMPUTE_MISMATCH', `$.registeredRecipes[${i}]`, `Recomputed fingerprint does not match stored fingerprint for ${recipe.candidateRecipeId}`);
      return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
    }
  }

  const attempts = ownDataProperty(value, 'attempts', '$.attempts', issues);
  if (attempts.kind === 'accessor') {
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }
  if (attempts.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.attempts', 'attempts is required');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }
  if (!Array.isArray(attempts.value)) {
    pushIssue(issues, 'INVALID_ARRAY', '$.attempts', 'attempts must be an array');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }

  const validatedAttempts: MLBInnerDevelopmentAttemptRecord[] = [];
  const recipeIndexById = new Map<string, number>();
  for (let i = 0; i < validatedRecipes.length; i++) {
    recipeIndexById.set(validatedRecipes[i].candidateRecipeId, i);
  }

  const attemptNumbersByRecipe = new Map<string, Set<number>>();

  for (let i = 0; i < attempts.value.length; i++) {
    const attemptResult = readDataArrayElement(attempts.value, i, '$.attempts', issues);
    if (!attemptResult.ok) {
      return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
    }
    const validated = validateAttemptRecord(attemptResult.value, i, issues, MLB_INNER_DEVELOPMENT_CYCLE_ID);
    if (!validated) {
      return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
    }

    const recipeIndex = recipeIndexById.get(validated.candidateRecipeId);
    if (recipeIndex === undefined) {
      pushIssue(issues, 'UNREGISTERED_RECIPE_REFERENCE', `$.attempts[${i}].candidateRecipeId`, `attempt references unregistered candidateRecipeId ${validated.candidateRecipeId}`);
      return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
    }

    const registeredRecipe = validatedRecipes[recipeIndex];
    if (validated.recipeFingerprint !== registeredRecipe.recipeFingerprint) {
      pushIssue(issues, 'FINGERPRINT_MISMATCH', `$.attempts[${i}].recipeFingerprint`, `attempt fingerprint does not match registered recipe fingerprint`);
      return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
    }
    if (validated.complexityRank !== registeredRecipe.complexityRank) {
      pushIssue(issues, 'COMPLEXITY_RANK_MISMATCH', `$.attempts[${i}].complexityRank`, `attempt complexityRank does not match registered recipe complexityRank`);
      return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
    }

    const existingAttemptNumbers = attemptNumbersByRecipe.get(validated.candidateRecipeId);
    if (existingAttemptNumbers) {
      if (existingAttemptNumbers.has(validated.attemptNumber)) {
        pushIssue(issues, 'INVALID_INTEGER', `$.attempts[${i}].attemptNumber`, `Duplicate attemptNumber ${validated.attemptNumber} for candidateRecipeId ${validated.candidateRecipeId}`);
        return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
      }
      existingAttemptNumbers.add(validated.attemptNumber);
    } else {
      if (validated.attemptNumber !== 1) {
        pushIssue(issues, 'INVALID_INTEGER', `$.attempts[${i}].attemptNumber`, `First attemptNumber for candidateRecipeId ${validated.candidateRecipeId} must be 1`);
        return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
      }
      attemptNumbersByRecipe.set(validated.candidateRecipeId, new Set([validated.attemptNumber]));
    }

    validatedAttempts.push(validated);
  }

  if (validatedAttempts.length !== (budget.value as MLBInnerDevelopmentRecipeBudget).evaluationCount) {
    pushIssue(issues, 'ATTEMPT_COUNT_MISMATCH', '$.attempts', 'attempts length must equal budget.evaluationCount');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }

  return {
    ok: true,
    value: {
      ledgerContractVersion: ledgerContractVersion.value as typeof MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
      developmentCycleId: developmentCycleId.value as typeof MLB_INNER_DEVELOPMENT_CYCLE_ID,
      createdAt: createdAt.value as string,
      updatedAt: updatedAt.value as string,
      budget: budget.value as MLBInnerDevelopmentRecipeBudget,
      registeredRecipes: validatedRecipes,
      attempts: validatedAttempts,
    },
  };
}

function validateMLBInnerDevelopmentCampaignAnchor(
  value: unknown,
): MLBInnerDevelopmentCampaignAnchorResult {
  const issues: MLBInnerDevelopmentCampaignAnchorIssue[] = [];

  if (!isPlainObject(value)) {
    pushAnchorIssue(issues, 'NOT_PLAIN_OBJECT', '$', 'anchor must be a plain object');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorIssue[] };
  }

  if (!rejectAnchorSymbolProperties(value as Record<string, unknown>, '$', issues)) {
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorIssue[] };
  }

  for (const key of Object.getOwnPropertyNames(value)) {
    if (!ANCHOR_KNOWN_FIELDS.has(key)) {
      pushAnchorIssue(issues, 'UNKNOWN_FIELD', `$.${key}`, `Unknown field ${key}`);
    }
  }
  if (issues.length > 0) {
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorIssue[] };
  }

  const anchorContractVersion = ownDataProperty(value, 'anchorContractVersion', '$.anchorContractVersion', issues);
  if (anchorContractVersion.kind === 'accessor') {
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorIssue[] };
  }
  if (anchorContractVersion.kind === 'missing') {
    pushAnchorIssue(issues, 'MISSING_FIELD', '$.anchorContractVersion', 'anchorContractVersion is required');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorIssue[] };
  }
  if (anchorContractVersion.value !== MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION) {
    pushAnchorIssue(issues, 'INVALID_LITERAL', '$.anchorContractVersion', `anchorContractVersion must be ${MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION}`);
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorIssue[] };
  }

  const developmentCycleId = ownDataProperty(value, 'developmentCycleId', '$.developmentCycleId', issues);
  if (developmentCycleId.kind === 'accessor') {
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorIssue[] };
  }
  if (developmentCycleId.kind === 'missing') {
    pushAnchorIssue(issues, 'MISSING_FIELD', '$.developmentCycleId', 'developmentCycleId is required');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorIssue[] };
  }
  if (developmentCycleId.value !== MLB_INNER_DEVELOPMENT_CYCLE_ID) {
    pushAnchorIssue(issues, 'INVALID_LITERAL', '$.developmentCycleId', `developmentCycleId must be ${MLB_INNER_DEVELOPMENT_CYCLE_ID}`);
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorIssue[] };
  }

  const canonicalLedgerDirectory = ownDataProperty(value, 'canonicalLedgerDirectory', '$.canonicalLedgerDirectory', issues);
  if (canonicalLedgerDirectory.kind === 'accessor') {
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorIssue[] };
  }
  if (canonicalLedgerDirectory.kind === 'missing') {
    pushAnchorIssue(issues, 'MISSING_FIELD', '$.canonicalLedgerDirectory', 'canonicalLedgerDirectory is required');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorIssue[] };
  }
  if (typeof canonicalLedgerDirectory.value !== 'string' || canonicalLedgerDirectory.value.trim() === '' || canonicalLedgerDirectory.value !== canonicalLedgerDirectory.value.trim()) {
    pushAnchorIssue(issues, 'INVALID_STRING', '$.canonicalLedgerDirectory', 'canonicalLedgerDirectory must be a non-empty trimmed string');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorIssue[] };
  }

  const canonicalLedgerFilename = ownDataProperty(value, 'canonicalLedgerFilename', '$.canonicalLedgerFilename', issues);
  if (canonicalLedgerFilename.kind === 'accessor') {
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorIssue[] };
  }
  if (canonicalLedgerFilename.kind === 'missing') {
    pushAnchorIssue(issues, 'MISSING_FIELD', '$.canonicalLedgerFilename', 'canonicalLedgerFilename is required');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorIssue[] };
  }
  if (typeof canonicalLedgerFilename.value !== 'string' || canonicalLedgerFilename.value.trim() === '' || canonicalLedgerFilename.value !== canonicalLedgerFilename.value.trim()) {
    pushAnchorIssue(issues, 'INVALID_STRING', '$.canonicalLedgerFilename', 'canonicalLedgerFilename must be a non-empty trimmed string');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorIssue[] };
  }

  const ledgerContractVersion = ownDataProperty(value, 'ledgerContractVersion', '$.ledgerContractVersion', issues);
  if (ledgerContractVersion.kind === 'accessor') {
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorIssue[] };
  }
  if (ledgerContractVersion.kind === 'missing') {
    pushAnchorIssue(issues, 'MISSING_FIELD', '$.ledgerContractVersion', 'ledgerContractVersion is required');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorIssue[] };
  }
  if (ledgerContractVersion.value !== MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION) {
    pushAnchorIssue(issues, 'INVALID_LITERAL', '$.ledgerContractVersion', `ledgerContractVersion must be ${MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION}`);
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorIssue[] };
  }

  const campaignIdentity = ownDataProperty(value, 'campaignIdentity', '$.campaignIdentity', issues);
  if (campaignIdentity.kind === 'accessor') {
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorIssue[] };
  }
  if (campaignIdentity.kind === 'missing') {
    pushAnchorIssue(issues, 'MISSING_FIELD', '$.campaignIdentity', 'campaignIdentity is required');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorIssue[] };
  }
  if (typeof campaignIdentity.value !== 'string' || campaignIdentity.value.trim() === '' || campaignIdentity.value !== campaignIdentity.value.trim()) {
    pushAnchorIssue(issues, 'INVALID_STRING', '$.campaignIdentity', 'campaignIdentity must be a non-empty trimmed string');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorIssue[] };
  }

  return {
    ok: true,
    value: {
      anchorContractVersion: anchorContractVersion.value as typeof MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION,
      developmentCycleId: developmentCycleId.value as typeof MLB_INNER_DEVELOPMENT_CYCLE_ID,
      canonicalLedgerDirectory: canonicalLedgerDirectory.value as string,
      canonicalLedgerFilename: canonicalLedgerFilename.value as string,
      ledgerContractVersion: ledgerContractVersion.value as typeof MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
      campaignIdentity: campaignIdentity.value as string,
    },
  };
}

function pushAnchorIssue(
  issues: MLBInnerDevelopmentCampaignAnchorIssue[],
  code: MLBInnerDevelopmentCampaignAnchorIssue['code'],
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

const PROVENANCE_KNOWN_FIELDS = new Set([
  'verifiedArtifactSha256',
  'verifiedArtifactByteLength',
  'artifactId',
  'foldPlanId',
]);

const TERMINAL_KNOWN_FIELDS = new Set([
  'kind',
  'lowLevelFitCount',
  'foldResults',
  'aggregate',
  'gate',
  'failedFoldId',
  'issues',
]);

const FOLD_RESULT_KNOWN_FIELDS = new Set([
  'contractVersion',
  'foldId',
  'candidateRecipeId',
  'rowCount',
  'targetHomeWinCount',
  'targetAwayWinCount',
  'candidateLogLoss',
  'candidateBrierScore',
  'candidateRocAuc',
  'p50LogLoss',
  'p50BrierScore',
  'p50RocAuc',
  'foldTrainPriorLogLoss',
  'foldTrainPriorBrierScore',
  'foldTrainPriorRocAuc',
  'foldTrainPriorProbability',
]);

const AGGREGATE_KNOWN_FIELDS = new Set([
  'contractVersion',
  'candidateRecipeId',
  'foldCount',
  'aggregateValidationRowCount',
  'aggregateCandidateLogLoss',
  'aggregateCandidateBrierScore',
  'aggregateCandidateRocAuc',
  'aggregateP50LogLoss',
  'aggregateP50BrierScore',
  'aggregateP50RocAuc',
  'aggregateFoldTrainPriorLogLoss',
  'aggregateFoldTrainPriorBrierScore',
  'aggregateFoldTrainPriorRocAuc',
  'worstFoldCandidateLogLoss',
  'worstFoldCandidateBrierScore',
  'foldsBeatingP50OnLogLoss',
  'foldsBeatingP50OnBrier',
  'foldsBeatingFoldTrainPriorOnLogLoss',
  'foldsBeatingFoldTrainPriorOnBrier',
]);

const GATE_KNOWN_FIELDS = new Set([
  'eligibility',
  'reasons',
]);

const TERMINAL_ISSUE_KNOWN_FIELDS = new Set([
  'code',
  'path',
  'message',
]);

function validateExecutionProvenance(
  provenance: unknown,
  index: number,
  issues: MLBInnerDevelopmentCampaignLedgerIssue[],
): MLBInnerDevelopmentAttemptExecutionProvenance | null {
  if (!isPlainObject(provenance)) {
    pushIssue(issues, 'INVALID_EXECUTION_PROVENANCE', `$.attempts[${index}].executionProvenance`, 'executionProvenance must be a plain object');
    return null;
  }
  if (!rejectSymbolProperties(provenance as Record<string, unknown>, `$.attempts[${index}].executionProvenance`, issues)) {
    return null;
  }
  for (const key of Object.getOwnPropertyNames(provenance)) {
    if (!PROVENANCE_KNOWN_FIELDS.has(key)) {
      pushIssue(issues, 'UNKNOWN_FIELD', `$.attempts[${index}].executionProvenance.${key}`, `Unknown field ${key}`);
      return null;
    }
  }

  const verifiedArtifactSha256 = ownDataProperty(provenance, 'verifiedArtifactSha256', `$.attempts[${index}].executionProvenance.verifiedArtifactSha256`, issues);
  if (verifiedArtifactSha256.kind === 'accessor') return null;
  if (verifiedArtifactSha256.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].executionProvenance.verifiedArtifactSha256`, 'verifiedArtifactSha256 is required');
    return null;
  }
  if (typeof verifiedArtifactSha256.value !== 'string' || !/^[0-9a-f]{64}$/.test(verifiedArtifactSha256.value)) {
    pushIssue(issues, 'INVALID_EXECUTION_PROVENANCE', `$.attempts[${index}].executionProvenance.verifiedArtifactSha256`, 'verifiedArtifactSha256 must be lowercase 64-char hex');
    return null;
  }

  const verifiedArtifactByteLength = ownDataProperty(provenance, 'verifiedArtifactByteLength', `$.attempts[${index}].executionProvenance.verifiedArtifactByteLength`, issues);
  if (verifiedArtifactByteLength.kind === 'accessor') return null;
  if (verifiedArtifactByteLength.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].executionProvenance.verifiedArtifactByteLength`, 'verifiedArtifactByteLength is required');
    return null;
  }
  if (typeof verifiedArtifactByteLength.value !== 'number' || !Number.isInteger(verifiedArtifactByteLength.value) || verifiedArtifactByteLength.value <= 0) {
    pushIssue(issues, 'INVALID_EXECUTION_PROVENANCE', `$.attempts[${index}].executionProvenance.verifiedArtifactByteLength`, 'verifiedArtifactByteLength must be a positive integer');
    return null;
  }

  const artifactId = ownDataProperty(provenance, 'artifactId', `$.attempts[${index}].executionProvenance.artifactId`, issues);
  if (artifactId.kind === 'accessor') return null;
  if (artifactId.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].executionProvenance.artifactId`, 'artifactId is required');
    return null;
  }
  if (typeof artifactId.value !== 'string' || artifactId.value.trim() === '' || artifactId.value !== artifactId.value.trim()) {
    pushIssue(issues, 'INVALID_EXECUTION_PROVENANCE', `$.attempts[${index}].executionProvenance.artifactId`, 'artifactId must be a non-empty trimmed string');
    return null;
  }

  const foldPlanId = ownDataProperty(provenance, 'foldPlanId', `$.attempts[${index}].executionProvenance.foldPlanId`, issues);
  if (foldPlanId.kind === 'accessor') return null;
  if (foldPlanId.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `$.attempts[${index}].executionProvenance.foldPlanId`, 'foldPlanId is required');
    return null;
  }
  if (typeof foldPlanId.value !== 'string' || foldPlanId.value.trim() === '' || foldPlanId.value !== foldPlanId.value.trim()) {
    pushIssue(issues, 'INVALID_EXECUTION_PROVENANCE', `$.attempts[${index}].executionProvenance.foldPlanId`, 'foldPlanId must be a non-empty trimmed string');
    return null;
  }

  return {
    verifiedArtifactSha256: verifiedArtifactSha256.value as string,
    verifiedArtifactByteLength: verifiedArtifactByteLength.value as number,
    artifactId: artifactId.value as string,
    foldPlanId: foldPlanId.value as string,
  };
}

export type MLBInnerDevelopmentAttemptTransitionResult =
  | Readonly<{ ok: true; value: MLBInnerDevelopmentCampaignLedger }>
  | Readonly<{ ok: false; issues: readonly MLBInnerDevelopmentCampaignLedgerIssue[] }>;

export function transformMLBInnerDevelopmentAttemptToRunning(
  ledger: MLBInnerDevelopmentCampaignLedger,
  candidateRecipeId: string,
  attemptNumber: number,
  executionProvenance: MLBInnerDevelopmentAttemptExecutionProvenance,
): MLBInnerDevelopmentAttemptTransitionResult {
  const issues: MLBInnerDevelopmentCampaignLedgerIssue[] = [];

  const recipeIndex = ledger.registeredRecipes.findIndex(
    recipe => recipe.candidateRecipeId === candidateRecipeId,
  );
  if (recipeIndex === -1) {
    pushIssue(issues, 'UNREGISTERED_RECIPE_REFERENCE', '$.candidateRecipeId', `Unknown candidateRecipeId ${candidateRecipeId}`);
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }

  const attemptIndex = ledger.attempts.findIndex(
    attempt =>
      attempt.candidateRecipeId === candidateRecipeId && attempt.attemptNumber === attemptNumber,
  );
  if (attemptIndex === -1) {
    pushIssue(issues, 'MISSING_FIELD', '$.attempts', `Attempt ${attemptNumber} for ${candidateRecipeId} not found`);
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }

  const target = ledger.attempts[attemptIndex];
  if (target.status !== 'REGISTERED') {
    pushIssue(issues, 'INVALID_STATUS', `$.attempts[${attemptIndex}].status`, `Attempt must be REGISTERED, got ${target.status}`);
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }

  const provenanceValidation = validateExecutionProvenance(executionProvenance, attemptIndex, issues);
  if (!provenanceValidation) {
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }

  const updatedAttempt: MLBInnerDevelopmentRunningAttempt = {
    ...target,
    status: 'RUNNING',
    executionProvenance: provenanceValidation,
  };

  const updatedLedger: MLBInnerDevelopmentCampaignLedger = {
    ...ledger,
    attempts: ledger.attempts.map((attempt, idx) => (idx === attemptIndex ? updatedAttempt : attempt)),
  };

  const validation = validateMLBInnerDevelopmentCampaignLedger(updatedLedger);
  if (!validation.ok) {
    return { ok: false, issues: validation.issues };
  }

  return { ok: true, value: validation.value };
}

export function transformMLBInnerDevelopmentAttemptToTerminal(
  ledger: MLBInnerDevelopmentCampaignLedger,
  candidateRecipeId: string,
  attemptNumber: number,
  executionResult: MLBInnerDevelopmentCandidateExecutionResult,
): MLBInnerDevelopmentAttemptTransitionResult {
  const issues: MLBInnerDevelopmentCampaignLedgerIssue[] = [];

  const recipeIndex = ledger.registeredRecipes.findIndex(
    recipe => recipe.candidateRecipeId === candidateRecipeId,
  );
  if (recipeIndex === -1) {
    pushIssue(issues, 'UNREGISTERED_RECIPE_REFERENCE', '$.candidateRecipeId', `Unknown candidateRecipeId ${candidateRecipeId}`);
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }

  const attemptIndex = ledger.attempts.findIndex(
    attempt =>
      attempt.candidateRecipeId === candidateRecipeId && attempt.attemptNumber === attemptNumber,
  );
  if (attemptIndex === -1) {
    pushIssue(issues, 'MISSING_FIELD', '$.attempts', `Attempt ${attemptNumber} for ${candidateRecipeId} not found`);
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }

  const target = ledger.attempts[attemptIndex];
  if (target.status !== 'RUNNING') {
    pushIssue(issues, 'INVALID_STATUS', `$.attempts[${attemptIndex}].status`, `Attempt must be RUNNING, got ${target.status}`);
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }

  if (target.status !== 'RUNNING' || !('executionProvenance' in target)) {
    pushIssue(issues, 'MISSING_EXECUTION_PROVENANCE', `$.attempts[${attemptIndex}].executionProvenance`, 'RUNNING attempt missing executionProvenance');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignLedgerIssue[] };
  }

  if (executionResult.ok) {
    const eligibility = executionResult.value.gate.eligibility;
    const terminalStatus = eligibility === 'INNER_ELIGIBLE'
      ? 'COMPLETED_INNER_ELIGIBLE'
      : 'COMPLETED_INNER_REJECTED';

    const terminalExecution: MLBInnerDevelopmentAttemptTerminalSuccess = {
      kind: 'SUCCESS',
      lowLevelFitCount: executionResult.value.lowLevelFitCount,
      foldResults: executionResult.value.foldResults,
      aggregate: executionResult.value.aggregate,
      gate: executionResult.value.gate,
    };

    const updatedAttempt = {
      ...target,
      status: terminalStatus,
      terminalExecution,
    } as MLBInnerDevelopmentCompletedEligibleAttempt | MLBInnerDevelopmentCompletedRejectedAttempt;

    const updatedLedger: MLBInnerDevelopmentCampaignLedger = {
      ...ledger,
      attempts: ledger.attempts.map((attempt, idx) => (idx === attemptIndex ? updatedAttempt : attempt)),
    };

    const validation = validateMLBInnerDevelopmentCampaignLedger(updatedLedger);
    if (!validation.ok) {
      return { ok: false, issues: validation.issues };
    }

    return { ok: true, value: validation.value };
  }

  const terminalExecution: MLBInnerDevelopmentAttemptTerminalFailure = {
    kind: 'FAILURE',
    lowLevelFitCount: executionResult.lowLevelFitCount,
    failedFoldId: executionResult.failedFoldId,
    issues: executionResult.issues,
  };

  const updatedAttempt: MLBInnerDevelopmentFailedAttempt = {
    ...target,
    status: 'FAILED',
    terminalExecution,
  };

  const updatedLedger: MLBInnerDevelopmentCampaignLedger = {
    ...ledger,
    attempts: ledger.attempts.map((attempt, idx) => (idx === attemptIndex ? updatedAttempt : attempt)),
  };

  const validation = validateMLBInnerDevelopmentCampaignLedger(updatedLedger);
  if (!validation.ok) {
    return { ok: false, issues: validation.issues };
  }

  return { ok: true, value: validation.value };
}

export {
  validateMLBInnerDevelopmentCampaignLedger,
  validateMLBInnerDevelopmentCampaignAnchor,
};
