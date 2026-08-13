import {
  MLB_INNER_DEVELOPMENT_CYCLE_ID,
  MLB_INNER_DEVELOPMENT_RECIPE_BUDGET_CONTRACT_VERSION,
  MLBInnerCandidateRecipe,
  MLBInnerDevelopmentRecipeBudget,
  computeMLBInnerCandidateRecipeFingerprint,
} from '@/prediction/mlb/mlb-train-only-inner-development-evaluator';

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

export type MLBInnerDevelopmentAttemptRecord = Readonly<{
  attemptNumber: number;
  candidateRecipeId: string;
  recipeFingerprint: string;
  complexityRank: number;
  developmentCycleId: string;
  status: MLBInnerDevelopmentAttemptStatus;
  attemptTimestamp: string;
  foldIds: readonly string[];
}>;

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
    | 'RECIPE_COUNT_MISMATCH';
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

const ATTEMPT_RECORD_KNOWN_FIELDS = new Set([
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
    if (!ATTEMPT_RECORD_KNOWN_FIELDS.has(key)) {
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

  return {
    attemptNumber: attemptNumber.value as number,
    candidateRecipeId: candidateRecipeId.value as string,
    recipeFingerprint: recipeFingerprint.value as string,
    complexityRank: complexityRank.value as number,
    developmentCycleId: developmentCycleId.value as string,
    status: status.value as MLBInnerDevelopmentAttemptStatus,
    attemptTimestamp: attemptTimestamp.value as string,
    foldIds: normalizedFoldIds,
  };
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

export {
  validateMLBInnerDevelopmentCampaignLedger,
  validateMLBInnerDevelopmentCampaignAnchor,
};
