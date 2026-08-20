import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
} from './mlb-real-pregame-winner-feature-manifest-v1';

export const MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_ID =
  'mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360' as const;

export const MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_SHA256 =
  'e6730f3b9f8e5b0e32958e1997ff804f1b66cb9c323cc992a55a9d8882d742a7' as const;

export const MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_ROW_COUNT = 437 as const;

export const MLB_INNER_DEVELOPMENT_CAMPAIGN_OUTER_TRAIN_ROW_COUNT = 301 as const;

export const MLB_INNER_DEVELOPMENT_CAMPAIGN_FEATURE_POLICY_ID =
  'mlb-real-pregame-winner-feature-policy-v1' as const;

export const MLB_INNER_DEVELOPMENT_CAMPAIGN_MANIFEST_ID =
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId;

export const MLB_INNER_DEVELOPMENT_CAMPAIGN_PREPROCESSING_POLICY_ID =
  'raw-finite-feature-values-with-default-missing-v1' as const;

export const MLB_INNER_DEVELOPMENT_CAMPAIGN_MATRIX_ID = `${MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_ID}::${MLB_INNER_DEVELOPMENT_CAMPAIGN_MANIFEST_ID}`;

export const MLB_INNER_DEVELOPMENT_CAMPAIGN_MATRIX_SHA256 =
  '5c730f9e286750c232a5e13e1be3553a40d463bb923f4f0e8dcbcd8ce8b5495e' as const;

export const MLB_INNER_DEVELOPMENT_CAMPAIGN_FEATURE_IDS = Object.freeze(
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.map((feature) => feature.featureId),
);

export type MLBInnerDevelopmentCampaignProvenance = Readonly<{
  datasetId: string;
  datasetSha256: string;
  datasetRowCount: number;
  outerTrainRowCount: number;
  featurePolicyId: string;
  manifestId: string;
  preprocessingPolicyId: string;
  matrixId: string;
  matrixSha256: string;
}>;

export type MLBInnerDevelopmentProvenanceIssue = Readonly<{
  code:
    | 'NOT_PLAIN_OBJECT'
    | 'PROHIBITED_FIELD'
    | 'INVALID_JSON_VALUE'
    | 'MISSING_FIELD'
    | 'INVALID_STRING'
    | 'INVALID_HASH'
    | 'INVALID_INTEGER'
    | 'IDENTITY_MISMATCH';
  path: string;
  message: string;
}>;

const KNOWN_FIELDS = new Set([
  'datasetId',
  'datasetSha256',
  'datasetRowCount',
  'outerTrainRowCount',
  'featurePolicyId',
  'manifestId',
  'preprocessingPolicyId',
  'matrixId',
  'matrixSha256',
]);

function pushIssue(
  issues: MLBInnerDevelopmentProvenanceIssue[],
  code: MLBInnerDevelopmentProvenanceIssue['code'],
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function isDataDescriptor(descriptor: PropertyDescriptor): boolean {
  return 'value' in descriptor;
}

function ownDataProperty(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBInnerDevelopmentProvenanceIssue[],
): { kind: 'data'; value: unknown } | { kind: 'missing' } | { kind: 'accessor' } {
  const descriptor = Object.getOwnPropertyDescriptor(root, key);
  if (!descriptor) {
    return { kind: 'missing' };
  }
  if (!isDataDescriptor(descriptor)) {
    pushIssue(issues, 'INVALID_JSON_VALUE', path, 'Accessor property');
    return { kind: 'accessor' };
  }
  return { kind: 'data', value: descriptor.value };
}

function isStrictNonEmptyTrimmedString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isLowercaseSha256(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

function isSafePositiveInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

export function validateMLBInnerDevelopmentCampaignProvenance(
  value: unknown,
):
  | Readonly<{ ok: true; value: MLBInnerDevelopmentCampaignProvenance }>
  | Readonly<{ ok: false; issues: readonly MLBInnerDevelopmentProvenanceIssue[] }> {
  const issues: MLBInnerDevelopmentProvenanceIssue[] = [];

  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$', 'Expected plain object');
    return { ok: false, issues: sortIssues(issues) };
  }

  const root = value as Record<string, unknown>;

  for (const key of Object.getOwnPropertyNames(root)) {
    if (!KNOWN_FIELDS.has(key)) {
      const descriptor = Object.getOwnPropertyDescriptor(root, key);
      if (descriptor && isDataDescriptor(descriptor)) {
        pushIssue(issues, 'PROHIBITED_FIELD', `$.${key}`, `Unknown field: ${key}`);
      } else if (descriptor) {
        pushIssue(issues, 'INVALID_JSON_VALUE', `$.${key}`, 'Accessor property');
      }
    }
  }

  validateDatasetId(root, issues);
  validateDatasetSha256(root, issues);
  validateDatasetRowCount(root, issues);
  validateOuterTrainRowCount(root, issues);
  validateFeaturePolicyId(root, issues);
  validateManifestId(root, issues);
  validatePreprocessingPolicyId(root, issues);
  validateMatrixId(root, issues);
  validateMatrixSha256(root, issues);

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) };
  }

  return {
    ok: true,
    value: Object.freeze({
      datasetId: MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_ID,
      datasetSha256: MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_SHA256,
      datasetRowCount: MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_ROW_COUNT,
      outerTrainRowCount: MLB_INNER_DEVELOPMENT_CAMPAIGN_OUTER_TRAIN_ROW_COUNT,
      featurePolicyId: MLB_INNER_DEVELOPMENT_CAMPAIGN_FEATURE_POLICY_ID,
      manifestId: MLB_INNER_DEVELOPMENT_CAMPAIGN_MANIFEST_ID,
      preprocessingPolicyId: MLB_INNER_DEVELOPMENT_CAMPAIGN_PREPROCESSING_POLICY_ID,
      matrixId: MLB_INNER_DEVELOPMENT_CAMPAIGN_MATRIX_ID,
      matrixSha256: MLB_INNER_DEVELOPMENT_CAMPAIGN_MATRIX_SHA256,
    }),
  };
}

function validateDatasetId(
  root: Record<string, unknown>,
  issues: MLBInnerDevelopmentProvenanceIssue[],
): void {
  const result = ownDataProperty(root, 'datasetId', '$.datasetId', issues);
  if (result.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.datasetId', 'datasetId is required');
    return;
  }
  if (result.kind === 'accessor') {
    return;
  }
  if (
    !isStrictNonEmptyTrimmedString(result.value) ||
    result.value !== MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_ID
  ) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.datasetId', 'datasetId does not match frozen campaign provenance');
  }
}

function validateDatasetSha256(
  root: Record<string, unknown>,
  issues: MLBInnerDevelopmentProvenanceIssue[],
): void {
  const result = ownDataProperty(root, 'datasetSha256', '$.datasetSha256', issues);
  if (result.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.datasetSha256', 'datasetSha256 is required');
    return;
  }
  if (result.kind === 'accessor') {
    return;
  }
  if (
    !isStrictNonEmptyTrimmedString(result.value) ||
    !isLowercaseSha256(result.value) ||
    result.value !== MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_SHA256
  ) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.datasetSha256', 'datasetSha256 does not match frozen campaign provenance');
  }
}

function validateDatasetRowCount(
  root: Record<string, unknown>,
  issues: MLBInnerDevelopmentProvenanceIssue[],
): void {
  const result = ownDataProperty(root, 'datasetRowCount', '$.datasetRowCount', issues);
  if (result.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.datasetRowCount', 'datasetRowCount is required');
    return;
  }
  if (result.kind === 'accessor') {
    return;
  }
  if (
    !isSafePositiveInteger(result.value) ||
    result.value !== MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_ROW_COUNT
  ) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.datasetRowCount', 'datasetRowCount does not match frozen campaign provenance');
  }
}

function validateOuterTrainRowCount(
  root: Record<string, unknown>,
  issues: MLBInnerDevelopmentProvenanceIssue[],
): void {
  const result = ownDataProperty(root, 'outerTrainRowCount', '$.outerTrainRowCount', issues);
  if (result.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.outerTrainRowCount', 'outerTrainRowCount is required');
    return;
  }
  if (result.kind === 'accessor') {
    return;
  }
  if (
    !isSafePositiveInteger(result.value) ||
    result.value !== MLB_INNER_DEVELOPMENT_CAMPAIGN_OUTER_TRAIN_ROW_COUNT
  ) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.outerTrainRowCount', 'outerTrainRowCount does not match frozen campaign provenance');
  }
}

function validateFeaturePolicyId(
  root: Record<string, unknown>,
  issues: MLBInnerDevelopmentProvenanceIssue[],
): void {
  const result = ownDataProperty(root, 'featurePolicyId', '$.featurePolicyId', issues);
  if (result.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.featurePolicyId', 'featurePolicyId is required');
    return;
  }
  if (result.kind === 'accessor') {
    return;
  }
  if (
    !isStrictNonEmptyTrimmedString(result.value) ||
    result.value !== MLB_INNER_DEVELOPMENT_CAMPAIGN_FEATURE_POLICY_ID
  ) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.featurePolicyId', 'featurePolicyId does not match frozen campaign provenance');
  }
}

function validateManifestId(
  root: Record<string, unknown>,
  issues: MLBInnerDevelopmentProvenanceIssue[],
): void {
  const result = ownDataProperty(root, 'manifestId', '$.manifestId', issues);
  if (result.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.manifestId', 'manifestId is required');
    return;
  }
  if (result.kind === 'accessor') {
    return;
  }
  if (
    !isStrictNonEmptyTrimmedString(result.value) ||
    result.value !== MLB_INNER_DEVELOPMENT_CAMPAIGN_MANIFEST_ID
  ) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.manifestId', 'manifestId does not match frozen campaign provenance');
  }
}

function validatePreprocessingPolicyId(
  root: Record<string, unknown>,
  issues: MLBInnerDevelopmentProvenanceIssue[],
): void {
  const result = ownDataProperty(root, 'preprocessingPolicyId', '$.preprocessingPolicyId', issues);
  if (result.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.preprocessingPolicyId', 'preprocessingPolicyId is required');
    return;
  }
  if (result.kind === 'accessor') {
    return;
  }
  if (
    !isStrictNonEmptyTrimmedString(result.value) ||
    result.value !== MLB_INNER_DEVELOPMENT_CAMPAIGN_PREPROCESSING_POLICY_ID
  ) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.preprocessingPolicyId', 'preprocessingPolicyId does not match frozen campaign provenance');
  }
}

function validateMatrixId(
  root: Record<string, unknown>,
  issues: MLBInnerDevelopmentProvenanceIssue[],
): void {
  const result = ownDataProperty(root, 'matrixId', '$.matrixId', issues);
  if (result.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.matrixId', 'matrixId is required');
    return;
  }
  if (result.kind === 'accessor') {
    return;
  }
  if (
    !isStrictNonEmptyTrimmedString(result.value) ||
    result.value !== MLB_INNER_DEVELOPMENT_CAMPAIGN_MATRIX_ID
  ) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.matrixId', 'matrixId does not match frozen campaign provenance');
  }
}

function validateMatrixSha256(
  root: Record<string, unknown>,
  issues: MLBInnerDevelopmentProvenanceIssue[],
): void {
  const result = ownDataProperty(root, 'matrixSha256', '$.matrixSha256', issues);
  if (result.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.matrixSha256', 'matrixSha256 is required');
    return;
  }
  if (result.kind === 'accessor') {
    return;
  }
  if (
    !isStrictNonEmptyTrimmedString(result.value) ||
    !isLowercaseSha256(result.value) ||
    result.value !== MLB_INNER_DEVELOPMENT_CAMPAIGN_MATRIX_SHA256
  ) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.matrixSha256', 'matrixSha256 does not match frozen campaign provenance');
  }
}

function sortIssues(
  issues: MLBInnerDevelopmentProvenanceIssue[],
): readonly MLBInnerDevelopmentProvenanceIssue[] {
  return Object.freeze(
    issues.slice().sort((a, b) => {
      const pathDiff = a.path < b.path ? -1 : a.path === b.path ? 0 : 1;
      if (pathDiff !== 0) {
        return pathDiff;
      }
      const codeDiff = a.code < b.code ? -1 : a.code === b.code ? 0 : 1;
      return codeDiff;
    }),
  );
}
