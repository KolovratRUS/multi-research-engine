import { assertNoOddsContamination } from '../firewall/odds-contamination-guard';
import { validateMLBInnerDevelopmentTrainArtifact } from './mlb-inner-development-train-artifact';
import {
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
} from './mlb-inner-development-train-artifact-runtime-provenance';
import {
  MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID,
  MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256,
  MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID,
  MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID,
} from './mlb-outer-validation-promotion-contract';

import type { MLBInnerDevelopmentTrainArtifact } from './mlb-inner-development-train-artifact';

export const MLB_OUTER_VALIDATION_TRAIN_SOURCE_CONTRACT_VERSION =
  'mlb-outer-validation-train-source-v1' as const;

export type MLBOuterValidationTrainSource = Readonly<{
  contractVersion: typeof MLB_OUTER_VALIDATION_TRAIN_SOURCE_CONTRACT_VERSION;
  verifiedArtifact: MLBInnerDevelopmentTrainArtifact;
  verifiedArtifactSha256: typeof MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256;
  verifiedArtifactByteLength: typeof MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH;
  outerBinding: Readonly<{
    datasetId: typeof MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID;
    datasetSha256: typeof MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256;
    matrixId: typeof MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID;
    manifestId: typeof MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID;
    trainingRowCount: 301;
  }>;
}>;

export type MLBOuterValidationTrainSourceIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_INTEGER'
    | 'INVALID_NUMBER'
    | 'INVALID_ARRAY'
    | 'VERIFIED_ARTIFACT_INVALID'
    | 'ARTIFACT_HASH_MISMATCH'
    | 'ARTIFACT_BYTE_LENGTH_MISMATCH'
    | 'SOURCE_IDENTITY_MISMATCH'
    | 'OUTER_BINDING_INVALID'
    | 'ODDS_CONTAMINATION'
    | 'PROHIBITED_CONCEPT';
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
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBOuterValidationTrainSourceIssue[],
): OwnDataPropertyResult {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (!descriptor) {
    return { kind: 'missing' };
  }
  if (!isDataDescriptor(descriptor)) {
    pushIssue(issues, 'INVALID_JSON_VALUE', path, `${path} is an accessor property`);
    return { kind: 'accessor' };
  }
  return { kind: 'data', value: descriptor.value };
}

type OwnDataPropertyResult =
  | Readonly<{ kind: 'missing' }>
  | Readonly<{ kind: 'accessor' }>
  | Readonly<{ kind: 'data'; value: unknown }>;

function pushIssue(
  issues: MLBOuterValidationTrainSourceIssue[],
  code: MLBOuterValidationTrainSourceIssue['code'],
  path: string,
  message: string,
): void {
  const exists = issues.some((item) => item.path === path && item.code === code);
  if (!exists) {
    issues.push({ code, path, message } as MLBOuterValidationTrainSourceIssue);
  }
}

function sortIssues(
  issues: MLBOuterValidationTrainSourceIssue[],
): readonly MLBOuterValidationTrainSourceIssue[] {
  return issues
    .slice()
    .sort((a, b) => {
      const pathDiff = a.path < b.path ? -1 : a.path === b.path ? 0 : 1;
      if (pathDiff !== 0) return pathDiff;
      const codeDiff = a.code < b.code ? -1 : b.code < a.code ? 1 : 0;
      return codeDiff;
    })
    .filter(
      (item, index, array) =>
        index === 0 || item.path !== array[index - 1].path || item.code !== array[index - 1].code,
    );
}

const KNOWN_TOP_LEVEL_FIELDS = new Set([
  'contractVersion',
  'verifiedArtifact',
  'verifiedArtifactSha256',
  'verifiedArtifactByteLength',
  'outerBinding',
]);

const KNOWN_OUTER_BINDING_FIELDS = new Set([
  'datasetId',
  'datasetSha256',
  'matrixId',
  'manifestId',
  'trainingRowCount',
]);

const TOP_LEVEL_ORDER = [
  'contractVersion',
  'verifiedArtifact',
  'verifiedArtifactSha256',
  'verifiedArtifactByteLength',
  'outerBinding',
] as const;

const OUTER_BINDING_ORDER = [
  'datasetId',
  'datasetSha256',
  'matrixId',
  'manifestId',
  'trainingRowCount',
] as const;

function addKnownFieldIssues(
  record: Record<string, unknown>,
  known: Set<string>,
  path: string,
  issues: MLBOuterValidationTrainSourceIssue[],
): void {
  const names = Object.getOwnPropertyNames(record);
  for (const key of names) {
    if (!known.has(key)) {
      pushIssue(issues, 'UNKNOWN_FIELD', `${path}.${key}`, `Unknown field: ${key}`);
    }
  }
}

function validateIdentifier(
  value: unknown,
  path: string,
  label: string,
  issues: MLBOuterValidationTrainSourceIssue[],
): string | undefined {
  if (!isStrictNonEmptyTrimmedString(value)) {
    pushIssue(issues, 'INVALID_STRING', path, `${label} must be a valid identifier`);
    return undefined;
  }
  return value;
}

function validatePositiveInteger(
  value: unknown,
  path: string,
  label: string,
  issues: MLBOuterValidationTrainSourceIssue[],
): number | undefined {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    pushIssue(issues, 'INVALID_INTEGER', path, `${label} must be a positive safe integer`);
    return undefined;
  }
  return value;
}

function validateOuterBinding(
  value: unknown,
  path: string,
  issues: MLBOuterValidationTrainSourceIssue[],
): MLBOuterValidationTrainSource['outerBinding'] | undefined {
  if (!isPlainObject(value)) {
    pushIssue(issues, 'OUTER_BINDING_INVALID', path, 'outerBinding must be a plain object');
    return undefined;
  }

  const root = value as Record<string, unknown>;
  addKnownFieldIssues(root, KNOWN_OUTER_BINDING_FIELDS, path, issues);

  const datasetIdResult = ownDataProperty(root, 'datasetId', `${path}.datasetId`, issues);
  if (datasetIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.datasetId`, 'datasetId is required');
  } else if (datasetIdResult.kind === 'data') {
    const id = validateIdentifier(datasetIdResult.value, `${path}.datasetId`, 'datasetId', issues);
    if (id !== MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        `${path}.datasetId`,
        `datasetId must be ${MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID}`,
      );
    }
  }

  const datasetSha256Result = ownDataProperty(root, 'datasetSha256', `${path}.datasetSha256`, issues);
  if (datasetSha256Result.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.datasetSha256`, 'datasetSha256 is required');
  } else if (datasetSha256Result.kind === 'data') {
    const id = validateIdentifier(datasetSha256Result.value, `${path}.datasetSha256`, 'datasetSha256', issues);
    if (id !== MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        `${path}.datasetSha256`,
        `datasetSha256 must be ${MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256}`,
      );
    }
  }

  const matrixIdResult = ownDataProperty(root, 'matrixId', `${path}.matrixId`, issues);
  if (matrixIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.matrixId`, 'matrixId is required');
  } else if (matrixIdResult.kind === 'data') {
    const id = validateIdentifier(matrixIdResult.value, `${path}.matrixId`, 'matrixId', issues);
    if (id !== MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        `${path}.matrixId`,
        `matrixId must be ${MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID}`,
      );
    }
  }

  const manifestIdResult = ownDataProperty(root, 'manifestId', `${path}.manifestId`, issues);
  if (manifestIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.manifestId`, 'manifestId is required');
  } else if (manifestIdResult.kind === 'data') {
    const id = validateIdentifier(manifestIdResult.value, `${path}.manifestId`, 'manifestId', issues);
    if (id !== MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        `${path}.manifestId`,
        `manifestId must be ${MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID}`,
      );
    }
  }

  const trainingRowCountResult = ownDataProperty(root, 'trainingRowCount', `${path}.trainingRowCount`, issues);
  if (trainingRowCountResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.trainingRowCount`, 'trainingRowCount is required');
  } else if (trainingRowCountResult.kind === 'data') {
    const rowCount = validatePositiveInteger(trainingRowCountResult.value, `${path}.trainingRowCount`, 'trainingRowCount', issues);
    if (rowCount !== undefined && rowCount !== 301) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        `${path}.trainingRowCount`,
        'trainingRowCount must be 301',
      );
    }
  }

  return undefined;
}

export function validateMLBOuterValidationTrainSource(
  value: unknown,
):
  | Readonly<{ ok: true; value: MLBOuterValidationTrainSource }>
  | Readonly<{
      ok: false;
      issues: readonly MLBOuterValidationTrainSourceIssue[];
    }> {
  const issues: MLBOuterValidationTrainSourceIssue[] = [];

  try {
    assertNoOddsContamination(value);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('ODDS_CONTAMINATION')) {
        for (const line of error.message.split('\n')) {
          if (line.startsWith('path=')) {
            const firewallPath = line.slice(5).split('; ')[0];
            pushIssue(
              issues,
              'ODDS_CONTAMINATION',
              `$${firewallPath.replace(/^\./, '')}`,
              `Source contains prohibited field at ${firewallPath}`,
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
            pushIssue(
              issues,
              'INVALID_JSON_VALUE',
              `$${accessorPath.replace(/^\./, '')}`,
              'Source contains an accessor property',
            );
          }
        }
      }
    }
  }

  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$', 'Expected plain object');
    return { ok: false, issues: sortIssues(issues) };
  }

  const root = value as Record<string, unknown>;
  const names = Object.getOwnPropertyNames(root);
  const symbols = Object.getOwnPropertySymbols(root);
  const keys = [...names, ...symbols];
  for (const key of keys) {
    const knownKey = typeof key === 'string' ? key : String(key);
    if (!KNOWN_TOP_LEVEL_FIELDS.has(knownKey)) {
      const descriptor = Object.getOwnPropertyDescriptor(root, key);
      if (descriptor && isDataDescriptor(descriptor)) {
        pushIssue(issues, 'UNKNOWN_FIELD', `$.${String(key)}`, `Unknown field: ${String(key)}`);
      } else if (descriptor) {
        pushIssue(issues, 'INVALID_JSON_VALUE', `$.${String(key)}`, 'Source contains an accessor property');
      }
    }
  }

  const contractVersionResult = ownDataProperty(root, 'contractVersion', '$.contractVersion', issues);
  if (contractVersionResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.contractVersion', 'contractVersion is required');
  } else if (contractVersionResult.kind === 'data') {
    if (contractVersionResult.value !== MLB_OUTER_VALIDATION_TRAIN_SOURCE_CONTRACT_VERSION) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.contractVersion',
        `contractVersion must be ${MLB_OUTER_VALIDATION_TRAIN_SOURCE_CONTRACT_VERSION}`,
      );
    }
  }

  const verifiedArtifactResult = ownDataProperty(root, 'verifiedArtifact', '$.verifiedArtifact', issues);
  if (verifiedArtifactResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.verifiedArtifact', 'verifiedArtifact is required');
  } else if (verifiedArtifactResult.kind === 'accessor') {
    // already reported
  } else {
    const artifactValidation = validateMLBInnerDevelopmentTrainArtifact(verifiedArtifactResult.value);
    if (!artifactValidation.ok) {
      issues.push(
        ...artifactValidation.issues.map((issue) => ({
          code: 'VERIFIED_ARTIFACT_INVALID' as MLBOuterValidationTrainSourceIssue['code'],
          path: issue.path === '$' ? '$.verifiedArtifact' : `$.verifiedArtifact${issue.path}`,
          message: `Artifact invalid: ${issue.code} - ${issue.message}`,
        })),
      );
    }
  }

  const verifiedShaResult = ownDataProperty(root, 'verifiedArtifactSha256', '$.verifiedArtifactSha256', issues);
  if (verifiedShaResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.verifiedArtifactSha256', 'verifiedArtifactSha256 is required');
  } else if (verifiedShaResult.kind === 'data') {
    const sha = validateIdentifier(verifiedShaResult.value, '$.verifiedArtifactSha256', 'verifiedArtifactSha256', issues);
    if (sha !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256) {
      pushIssue(
        issues,
        'ARTIFACT_HASH_MISMATCH',
        '$.verifiedArtifactSha256',
        `verifiedArtifactSha256 must be ${MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256}`,
      );
    }
  }

  const verifiedBytesResult = ownDataProperty(root, 'verifiedArtifactByteLength', '$.verifiedArtifactByteLength', issues);
  if (verifiedBytesResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.verifiedArtifactByteLength', 'verifiedArtifactByteLength is required');
  } else if (verifiedBytesResult.kind === 'data') {
    const bytes = validatePositiveInteger(verifiedBytesResult.value, '$.verifiedArtifactByteLength', 'verifiedArtifactByteLength', issues);
    if (bytes !== undefined && bytes !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH) {
      pushIssue(
        issues,
        'ARTIFACT_BYTE_LENGTH_MISMATCH',
        '$.verifiedArtifactByteLength',
        `verifiedArtifactByteLength must be ${MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH}`,
      );
    }
  }

  const outerBindingResult = ownDataProperty(root, 'outerBinding', '$.outerBinding', issues);
  if (outerBindingResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.outerBinding', 'outerBinding is required');
  } else if (outerBindingResult.kind === 'accessor') {
    // already reported
  } else {
    validateOuterBinding(outerBindingResult.value, '$.outerBinding', issues);
  }

  const finalIssues = sortIssues(issues);
  if (finalIssues.length > 0) {
    return { ok: false, issues: finalIssues };
  }

  const frozenOuterBinding = Object.freeze({
    datasetId: MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID,
    datasetSha256: MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256,
    matrixId: MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID,
    manifestId: MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID,
    trainingRowCount: 301,
  }) as MLBOuterValidationTrainSource['outerBinding'];

  const frozenSource = Object.freeze({
    contractVersion: MLB_OUTER_VALIDATION_TRAIN_SOURCE_CONTRACT_VERSION,
    verifiedArtifact: root.verifiedArtifact as MLBInnerDevelopmentTrainArtifact,
    verifiedArtifactSha256: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
    verifiedArtifactByteLength: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH,
    outerBinding: frozenOuterBinding,
  }) as MLBOuterValidationTrainSource;

  return { ok: true, value: frozenSource };
}
