import { assertNoOddsContamination } from '../firewall/odds-contamination-guard';
import { createHash } from 'node:crypto';
import { validateMLBFeatureVector, type MLBFeatureVector } from './mlb-feature-vector-contract';
import {
  validateMLBTrainOnlyInnerRowCollection,
  type MLBOuterTrainRow,
  type MLBTrainOnlyInnerRowCollection,
  type MLBTrainOnlyInnerRowCollectionIssue,
  MLB_TRAIN_ONLY_INNER_ROW_COLLECTION_CONTRACT_VERSION,
} from './mlb-train-only-inner-development-evaluator';
import {
  MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN,
  validateMLBTrainOnlyInnerFoldPlan,
  type MLBTrainOnlyInnerFoldPlan,
} from './mlb-train-only-inner-fold-plan';
import {
  MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_ID,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_MANIFEST_ID,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_FEATURE_POLICY_ID,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_PREPROCESSING_POLICY_ID,
} from './mlb-inner-development-campaign-provenance';

export const MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_CONTRACT_VERSION =
  'mlb-inner-development-train-artifact-v1' as const;

export const MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID =
  `${MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_ID}::${MLB_INNER_DEVELOPMENT_CAMPAIGN_MANIFEST_ID}::train-only` as const;

export const MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID =
  MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_ID;

export const MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_MANIFEST_ID =
  MLB_INNER_DEVELOPMENT_CAMPAIGN_MANIFEST_ID;

export const MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_POLICY_ID =
  MLB_INNER_DEVELOPMENT_CAMPAIGN_FEATURE_POLICY_ID;

export const MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_PREPROCESSING_POLICY_ID =
  MLB_INNER_DEVELOPMENT_CAMPAIGN_PREPROCESSING_POLICY_ID;

export const MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SPLIT = 'TRAIN' as const;

export const MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT = 301 as const;

export const MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE =
  '2026-04-01' as const;

export const MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE =
  '2026-04-23' as const;

export const MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FOLD_PLAN_ID =
  MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN.contractVersion;

export type MLBInnerDevelopmentTrainArtifact = Readonly<{
  artifactContractVersion: typeof MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_CONTRACT_VERSION;
  artifactId: typeof MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID;
  sourceDatasetId: typeof MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID;
  featureManifestId: typeof MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_MANIFEST_ID;
  featurePolicyId: typeof MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_POLICY_ID;
  preprocessingPolicyId: typeof MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_PREPROCESSING_POLICY_ID;
  split: typeof MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SPLIT;
  rowCount: typeof MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT;
  firstOfficialDate: typeof MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE;
  lastOfficialDate: typeof MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE;
  foldPlanId: typeof MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FOLD_PLAN_ID;
  rowCollection: MLBTrainOnlyInnerRowCollection;
}>;

export type MLBInnerDevelopmentTrainArtifactIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_INTEGER'
    | 'INVALID_NUMBER'
    | 'INVALID_DATE'
    | 'INVALID_ARRAY'
    | 'SPLIT_VIOLATION'
    | 'COUNT_MISMATCH'
    | 'DATE_POLICY_VIOLATION'
    | 'ROW_COLLECTION_INVALID'
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

type OwnDataPropertyResult =
  | Readonly<{ kind: 'missing' }>
  | Readonly<{ kind: 'accessor' }>
  | Readonly<{ kind: 'data'; value: unknown }>;

function ownDataProperty(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBInnerDevelopmentTrainArtifactIssue[],
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

function pushIssue(
  issues: MLBInnerDevelopmentTrainArtifactIssue[],
  code: MLBInnerDevelopmentTrainArtifactIssue['code'],
  path: string,
  message: string,
): void {
  const exists = issues.some((item) => item.path === path && item.code === code);
  if (!exists) {
    issues.push({ code, path, message } as MLBInnerDevelopmentTrainArtifactIssue);
  }
}

function sortIssues(
  issues: MLBInnerDevelopmentTrainArtifactIssue[],
): MLBInnerDevelopmentTrainArtifactIssue[] {
  return issues
    .slice()
    .sort((a, b) => {
      const pathDiff = a.path < b.path ? -1 : a.path === b.path ? 0 : 1;
      if (pathDiff !== 0) return pathDiff;
      const codeDiff = a.code < b.code ? -1 : a.code === b.code ? 0 : 1;
      return codeDiff;
    })
    .filter(
      (item, index, array) =>
        index === 0 || item.path !== array[index - 1].path || item.code !== array[index - 1].code,
    );
}

const KNOWN_ARTIFACT_FIELDS = new Set([
  'artifactContractVersion',
  'artifactId',
  'sourceDatasetId',
  'featureManifestId',
  'featurePolicyId',
  'preprocessingPolicyId',
  'split',
  'rowCount',
  'firstOfficialDate',
  'lastOfficialDate',
  'foldPlanId',
  'rowCollection',
]);

const TOP_LEVEL_ORDER = [
  'artifactContractVersion',
  'artifactId',
  'sourceDatasetId',
  'featureManifestId',
  'featurePolicyId',
  'preprocessingPolicyId',
  'split',
  'rowCount',
  'firstOfficialDate',
  'lastOfficialDate',
  'foldPlanId',
  'rowCollection',
] as const;

const ROW_ORDER = [
  'exampleId',
  'split',
  'vector',
  'targetValue',
] as const;

const VECTOR_ORDER = [
  'contractVersion',
  'sport',
  'target',
  'manifestId',
  'snapshotId',
  'gameId',
  'officialDate',
  'dataCutoffAt',
  'values',
] as const;

const VALUE_ORDER = [
  'featureId',
  'value',
  'wasMissing',
] as const;

function sortObjectByKeys(
  value: Record<string, unknown>,
  orderedKeys: readonly string[],
): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const key of orderedKeys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      sorted[key] = value[key];
    }
  }
  for (const key of Object.getOwnPropertyNames(value)) {
    if (!Object.prototype.hasOwnProperty.call(sorted, key)) {
      sorted[key] = value[key];
    }
  }
  return sorted;
}

function canonicalRow(
  row: MLBOuterTrainRow,
): Record<string, unknown> {
  const vector = row.vector;
  const values = vector.values.map((v) =>
    sortObjectByKeys(
      { featureId: v.featureId, value: v.value, wasMissing: v.wasMissing } as Record<string, unknown>,
      VALUE_ORDER,
    ),
  );
  const canonicalVector = sortObjectByKeys(
    {
      contractVersion: vector.contractVersion,
      sport: vector.sport,
      target: vector.target,
      manifestId: vector.manifestId,
      snapshotId: vector.snapshotId,
      gameId: vector.gameId,
      officialDate: vector.officialDate,
      dataCutoffAt: vector.dataCutoffAt,
      values,
    } as Record<string, unknown>,
    VECTOR_ORDER,
  );
  return sortObjectByKeys(
    {
      exampleId: row.exampleId,
      split: row.split,
      vector: canonicalVector,
      targetValue: row.targetValue,
    } as Record<string, unknown>,
    ROW_ORDER,
  );
}

function validateIdentifier(
  value: unknown,
  path: string,
  label: string,
  issues: MLBInnerDevelopmentTrainArtifactIssue[],
): string | undefined {
  if (!isStrictNonEmptyTrimmedString(value)) {
    pushIssue(
      issues,
      'INVALID_STRING',
      path,
      `${label} must be a valid identifier`,
    );
    return undefined;
  }
  return value;
}

function validatePositiveInteger(
  value: unknown,
  path: string,
  label: string,
  issues: MLBInnerDevelopmentTrainArtifactIssue[],
): number | undefined {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    pushIssue(
      issues,
      'INVALID_INTEGER',
      path,
      `${label} must be a positive safe integer`,
    );
    return undefined;
  }
  return value;
}

function validateGregorianDate(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12) {
    return false;
  }
  const maxDay = new Date(year, month, 0).getDate();
  return day >= 1 && day <= maxDay;
}

function dateFrom(iso: string): Date {
  return new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))));
}

export type MLBInnerDevelopmentTrainArtifactOrValidationIssue =
  | MLBInnerDevelopmentTrainArtifactIssue
  | MLBTrainOnlyInnerRowCollectionIssue;

export type MLBInnerDevelopmentTrainArtifactValidationResult =
  | Readonly<{ ok: true; value: MLBInnerDevelopmentTrainArtifact }>
  | Readonly<{
      ok: false;
      issues: readonly MLBInnerDevelopmentTrainArtifactOrValidationIssue[];
    }>;

export function validateMLBInnerDevelopmentTrainArtifact(
  value: unknown,
):
  | Readonly<{ ok: true; value: MLBInnerDevelopmentTrainArtifact }>
  | Readonly<{
      ok: false;
      issues: readonly MLBInnerDevelopmentTrainArtifactOrValidationIssue[];
    }> {
  const issues: MLBInnerDevelopmentTrainArtifactIssue[] = [];

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
              `Artifact contains prohibited field at ${firewallPath}`,
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
              'Artifact contains an accessor property',
            );
          }
        }
      }
    }
  }

  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$', 'Expected plain object');
    return { ok: false, issues: sortIssues(issues) as readonly MLBInnerDevelopmentTrainArtifactOrValidationIssue[] };
  }

  const root = value as Record<string, unknown>;

  for (const key of Object.getOwnPropertyNames(root)) {
    if (!KNOWN_ARTIFACT_FIELDS.has(key)) {
      const descriptor = Object.getOwnPropertyDescriptor(root, key);
      if (descriptor && isDataDescriptor(descriptor)) {
        pushIssue(issues, 'UNKNOWN_FIELD', `$.${key}`, `Unknown field: ${key}`);
      } else if (descriptor) {
        pushIssue(issues, 'INVALID_JSON_VALUE', `$.${key}`, 'Artifact contains an accessor property');
      }
    }
  }

  const artifactContractVersionResult = ownDataProperty(
    root,
    'artifactContractVersion',
    '$.artifactContractVersion',
    issues,
  );
  if (artifactContractVersionResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.artifactContractVersion', 'artifactContractVersion is required');
  } else if (artifactContractVersionResult.kind === 'data') {
    if (artifactContractVersionResult.value !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_CONTRACT_VERSION) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.artifactContractVersion',
        `artifactContractVersion must be ${MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_CONTRACT_VERSION}`,
      );
    }
  }

  const artifactIdResult = ownDataProperty(root, 'artifactId', '$.artifactId', issues);
  if (artifactIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.artifactId', 'artifactId is required');
  } else if (artifactIdResult.kind === 'data') {
    const id = validateIdentifier(artifactIdResult.value, '$.artifactId', 'artifactId', issues);
    if (id !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.artifactId',
        `artifactId must be ${MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID}`,
      );
    }
  }

  const sourceDatasetIdResult = ownDataProperty(root, 'sourceDatasetId', '$.sourceDatasetId', issues);
  if (sourceDatasetIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.sourceDatasetId', 'sourceDatasetId is required');
  } else if (sourceDatasetIdResult.kind === 'data') {
    const id = validateIdentifier(sourceDatasetIdResult.value, '$.sourceDatasetId', 'sourceDatasetId', issues);
    if (id !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.sourceDatasetId',
        `sourceDatasetId must be ${MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID}`,
      );
    }
  }

  const featureManifestIdResult = ownDataProperty(root, 'featureManifestId', '$.featureManifestId', issues);
  if (featureManifestIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.featureManifestId', 'featureManifestId is required');
  } else if (featureManifestIdResult.kind === 'data') {
    const id = validateIdentifier(featureManifestIdResult.value, '$.featureManifestId', 'featureManifestId', issues);
    if (id !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_MANIFEST_ID) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.featureManifestId',
        `featureManifestId must be ${MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_MANIFEST_ID}`,
      );
    }
  }

  const featurePolicyIdResult = ownDataProperty(root, 'featurePolicyId', '$.featurePolicyId', issues);
  if (featurePolicyIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.featurePolicyId', 'featurePolicyId is required');
  } else if (featurePolicyIdResult.kind === 'data') {
    const id = validateIdentifier(featurePolicyIdResult.value, '$.featurePolicyId', 'featurePolicyId', issues);
    if (id !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_POLICY_ID) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.featurePolicyId',
        `featurePolicyId must be ${MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_POLICY_ID}`,
      );
    }
  }

  const preprocessingPolicyIdResult = ownDataProperty(
    root,
    'preprocessingPolicyId',
    '$.preprocessingPolicyId',
    issues,
  );
  if (preprocessingPolicyIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.preprocessingPolicyId', 'preprocessingPolicyId is required');
  } else if (preprocessingPolicyIdResult.kind === 'data') {
    const id = validateIdentifier(
      preprocessingPolicyIdResult.value,
      '$.preprocessingPolicyId',
      'preprocessingPolicyId',
      issues,
    );
    if (id !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_PREPROCESSING_POLICY_ID) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.preprocessingPolicyId',
        `preprocessingPolicyId must be ${MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_PREPROCESSING_POLICY_ID}`,
      );
    }
  }

  const splitResult = ownDataProperty(root, 'split', '$.split', issues);
  if (splitResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.split', 'split is required');
  } else if (splitResult.kind === 'data') {
    if (splitResult.value !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SPLIT) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.split',
        `split must be ${MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SPLIT}`,
      );
    }
  }

  const rowCountResult = ownDataProperty(root, 'rowCount', '$.rowCount', issues);
  if (rowCountResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.rowCount', 'rowCount is required');
  } else if (rowCountResult.kind === 'data') {
    const rowCount = validatePositiveInteger(rowCountResult.value, '$.rowCount', 'rowCount', issues);
    if (rowCount !== undefined && rowCount !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.rowCount',
        `rowCount must be ${MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT}`,
      );
    }
  }

  const firstOfficialDateResult = ownDataProperty(root, 'firstOfficialDate', '$.firstOfficialDate', issues);
  if (firstOfficialDateResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.firstOfficialDate', 'firstOfficialDate is required');
  } else if (firstOfficialDateResult.kind === 'data') {
    if (!isStrictNonEmptyTrimmedString(firstOfficialDateResult.value)) {
      pushIssue(issues, 'INVALID_DATE', '$.firstOfficialDate', 'firstOfficialDate must be a valid date string');
    } else if (firstOfficialDateResult.value !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.firstOfficialDate',
        `firstOfficialDate must be ${MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE}`,
      );
    }
  }

  const lastOfficialDateResult = ownDataProperty(root, 'lastOfficialDate', '$.lastOfficialDate', issues);
  if (lastOfficialDateResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.lastOfficialDate', 'lastOfficialDate is required');
  } else if (lastOfficialDateResult.kind === 'data') {
    if (!isStrictNonEmptyTrimmedString(lastOfficialDateResult.value)) {
      pushIssue(issues, 'INVALID_DATE', '$.lastOfficialDate', 'lastOfficialDate must be a valid date string');
    } else if (lastOfficialDateResult.value !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.lastOfficialDate',
        `lastOfficialDate must be ${MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE}`,
      );
    }
  }

  const foldPlanIdResult = ownDataProperty(root, 'foldPlanId', '$.foldPlanId', issues);
  if (foldPlanIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.foldPlanId', 'foldPlanId is required');
  } else if (foldPlanIdResult.kind === 'data') {
    const id = validateIdentifier(foldPlanIdResult.value, '$.foldPlanId', 'foldPlanId', issues);
    if (id !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FOLD_PLAN_ID) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.foldPlanId',
        `foldPlanId must be ${MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FOLD_PLAN_ID}`,
      );
    }
  }

  const rowCollectionResult = ownDataProperty(root, 'rowCollection', '$.rowCollection', issues);
  if (rowCollectionResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.rowCollection', 'rowCollection is required');
  }
  if (rowCollectionResult.kind === 'accessor') {
    return {
      ok: false,
      issues: sortIssues(issues) as readonly MLBInnerDevelopmentTrainArtifactOrValidationIssue[],
    };
  }

  let collectionResult: ReturnType<typeof validateMLBTrainOnlyInnerRowCollection>;
  let validRowCollection: MLBTrainOnlyInnerRowCollection | undefined;
  if (rowCollectionResult.kind === 'data') {
    collectionResult = validateMLBTrainOnlyInnerRowCollection(rowCollectionResult.value);
    if (!collectionResult.ok) {
      issues.push(
        ...collectionResult.issues.map((issue) => {
          const mappedPath = issue.path === '$' ? '$.rowCollection' : `$.rowCollection${issue.path}`;
          return {
            code: 'ROW_COLLECTION_INVALID' as MLBInnerDevelopmentTrainArtifactIssue['code'],
            path: mappedPath,
            message: `Row collection invalid: ${issue.code} - ${issue.message}`,
          } as MLBInnerDevelopmentTrainArtifactIssue;
        }),
      );
    } else {
      validRowCollection = collectionResult.value;
      if (validRowCollection.rowCount !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT) {
        pushIssue(
          issues,
          'COUNT_MISMATCH',
          '$.rowCollection.rowCount',
          `rowCollection rowCount must be ${MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT}`,
        );
      }
      for (const row of validRowCollection.rows) {
        const date = dateFrom(row.vector.officialDate);
        const start = dateFrom(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE);
        const end = dateFrom(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE);
        if (date < start || date > end) {
          pushIssue(
            issues,
            'DATE_POLICY_VIOLATION',
            '$.rowCollection.rows[].vector.officialDate',
            `Row officialDate ${row.vector.officialDate} is outside accepted TRAIN window`,
          );
        }
      }
    }
  }

  const foldPlanValidation = validateMLBTrainOnlyInnerFoldPlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
  if (!foldPlanValidation.ok) {
    pushIssue(
      issues,
      'INVALID_LITERAL',
      '$.foldPlanId',
      'Canonical fold plan is itself invalid',
    );
  }

  const finalIssues = sortIssues(issues);
  if (finalIssues.length > 0) {
    return {
      ok: false,
      issues: finalIssues as readonly MLBInnerDevelopmentTrainArtifactOrValidationIssue[],
    };
  }

  if (validRowCollection === undefined) {
    return {
      ok: false,
      issues: sortIssues(issues) as readonly MLBInnerDevelopmentTrainArtifactOrValidationIssue[],
    };
  }

  const frozenRowCollection = Object.freeze({
    ...validRowCollection,
    rows: Object.freeze(
      validRowCollection.rows.map((row: MLBOuterTrainRow) =>
        Object.freeze({
          ...row,
          vector: Object.freeze({
            ...row.vector,
            values: Object.freeze(
              row.vector.values.map((value) => Object.freeze({ ...value })),
            ),
          }),
        }),
      ),
    ),
  }) as MLBTrainOnlyInnerRowCollection;

  const artifact = Object.freeze({
    artifactContractVersion: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_CONTRACT_VERSION,
    artifactId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID,
    sourceDatasetId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID,
    featureManifestId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_MANIFEST_ID,
    featurePolicyId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_POLICY_ID,
    preprocessingPolicyId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_PREPROCESSING_POLICY_ID,
    split: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SPLIT,
    rowCount: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT,
    firstOfficialDate: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE,
    lastOfficialDate: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE,
    foldPlanId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FOLD_PLAN_ID,
    rowCollection: frozenRowCollection,
  }) as MLBInnerDevelopmentTrainArtifact;

  return { ok: true, value: artifact };
}

export function buildMLBInnerDevelopmentTrainArtifact(
  rows: MLBTrainOnlyInnerRowCollection,
): MLBInnerDevelopmentTrainArtifact {
  const result = validateMLBInnerDevelopmentTrainArtifact({
    artifactContractVersion: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_CONTRACT_VERSION,
    artifactId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID,
    sourceDatasetId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID,
    featureManifestId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_MANIFEST_ID,
    featurePolicyId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_POLICY_ID,
    preprocessingPolicyId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_PREPROCESSING_POLICY_ID,
    split: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SPLIT,
    rowCount: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT,
    firstOfficialDate: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE,
    lastOfficialDate: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE,
    foldPlanId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FOLD_PLAN_ID,
    rowCollection: rows,
  });

  if (!result.ok) {
    throw new Error(`Invalid train-only artifact: ${result.issues.map((i) => `${i.code}: ${i.message}`).join(', ')}`);
  }

  return result.value;
}

function canonicalProjection(artifact: MLBInnerDevelopmentTrainArtifact): Record<string, unknown> {
  const rowCollection = artifact.rowCollection;
  const canonicalRows = rowCollection.rows.map(canonicalRow);

  return sortObjectByKeys(
    {
      artifactContractVersion: artifact.artifactContractVersion,
      artifactId: artifact.artifactId,
      sourceDatasetId: artifact.sourceDatasetId,
      featureManifestId: artifact.featureManifestId,
      featurePolicyId: artifact.featurePolicyId,
      preprocessingPolicyId: artifact.preprocessingPolicyId,
      split: artifact.split,
      rowCount: artifact.rowCount,
      firstOfficialDate: artifact.firstOfficialDate,
      lastOfficialDate: artifact.lastOfficialDate,
      foldPlanId: artifact.foldPlanId,
      rowCollection: sortObjectByKeys(
        {
          contractVersion: rowCollection.contractVersion,
          sport: rowCollection.sport,
          target: rowCollection.target,
          targetEncoding: rowCollection.targetEncoding,
          matrixId: rowCollection.matrixId,
          manifestId: rowCollection.manifestId,
          datasetId: rowCollection.datasetId,
          rowCount: rowCollection.rowCount,
          homeWinCount: rowCollection.homeWinCount,
          awayWinCount: rowCollection.awayWinCount,
          rows: canonicalRows,
        } as Record<string, unknown>,
        [
          'contractVersion',
          'sport',
          'target',
          'targetEncoding',
          'matrixId',
          'manifestId',
          'datasetId',
          'rowCount',
          'homeWinCount',
          'awayWinCount',
          'rows',
        ],
      ),
    } as Record<string, unknown>,
    TOP_LEVEL_ORDER,
  );
}

export function serializeMLBInnerDevelopmentTrainArtifact(
  artifact: MLBInnerDevelopmentTrainArtifact,
): string {
  const projection = canonicalProjection(artifact);
  return JSON.stringify(projection, null, 2) + '\n';
}

export function computeMLBInnerDevelopmentTrainArtifactSHA256(
  bytes: Uint8Array,
): string {
  const hash = createHash('sha256');
  hash.update(bytes);
  return hash.digest('hex');
}

export function hashMLBInnerDevelopmentTrainArtifact(
  artifact: MLBInnerDevelopmentTrainArtifact,
): string {
  const serialized = serializeMLBInnerDevelopmentTrainArtifact(artifact);
  const bytes = new TextEncoder().encode(serialized);
  return computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
}
