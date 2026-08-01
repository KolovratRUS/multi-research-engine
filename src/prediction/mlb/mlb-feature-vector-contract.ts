import {
  assertNoOddsContamination,
} from '../firewall/odds-contamination-guard';
import {
  validateMLBCanonicalPregameSnapshot,
  type MLBCanonicalPregameSnapshot,
} from './mlb-pregame-snapshot-contract';

export const MLB_FEATURE_MANIFEST_CONTRACT_VERSION =
  'mlb-feature-manifest-v1' as const;

export const MLB_FEATURE_VECTOR_CONTRACT_VERSION =
  'mlb-feature-vector-v1' as const;

export type MLBFeatureValueKind = 'NUMBER' | 'BOOLEAN';

export type MLBFeatureMissingPolicy = 'REJECT' | 'USE_DEFAULT';

export type MLBFeaturePathSegment = string | number;

export type MLBFeatureDefinition = Readonly<{
  featureId: string;
  sectionId: string;
  payloadPath: readonly MLBFeaturePathSegment[];
  valueKind: MLBFeatureValueKind;
  missingPolicy: MLBFeatureMissingPolicy;
  defaultValue: number | null;
}>;

export type MLBFeatureManifest = Readonly<{
  contractVersion: typeof MLB_FEATURE_MANIFEST_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  manifestId: string;
  features: readonly MLBFeatureDefinition[];
}>;

export type MLBExtractedFeatureValue = Readonly<{
  featureId: string;
  value: number;
  wasMissing: boolean;
}>;

export type MLBFeatureVector = Readonly<{
  contractVersion: typeof MLB_FEATURE_VECTOR_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  manifestId: string;
  snapshotId: string;
  gameId: string;
  officialDate: string;
  dataCutoffAt: string;
  values: readonly MLBExtractedFeatureValue[];
}>;

export type MLBFeatureExtractionIssue = Readonly<{
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
    | 'INVALID_TIMESTAMP'
    | 'INVALID_ARRAY'
    | 'DUPLICATE_ID'
    | 'NON_CANONICAL_ORDER'
    | 'SNAPSHOT_INVALID'
    | 'FEATURE_SECTION_NOT_FOUND'
    | 'FEATURE_PATH_MISSING'
    | 'FEATURE_SOURCE_INVALID'
    | 'FEATURE_TYPE_MISMATCH'
    | 'INVALID_MISSING_POLICY'
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
  issues: MLBFeatureExtractionIssue[],
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
  issues: MLBFeatureExtractionIssue[],
  code: MLBFeatureExtractionIssue['code'],
  path: string,
  message: string,
): void {
  const exists = issues.some(
    (item) => item.path === path && item.code === code,
  );
  if (!exists) {
    issues.push({ code, path, message });
  }
}

function pushUniquePathCode(
  issues: MLBFeatureExtractionIssue[],
  next: MLBFeatureExtractionIssue,
): void {
  const exists = issues.some(
    (item) => item.path === next.path && item.code === next.code,
  );
  if (!exists) {
    issues.push(next);
  }
}

function sortIssues(
  issues: MLBFeatureExtractionIssue[],
): MLBFeatureExtractionIssue[] {
  const sorted = issues
    .slice()
    .sort((a, b) => {
      const pathDiff = a.path < b.path ? -1 : a.path === b.path ? 0 : 1;
      if (pathDiff !== 0) return pathDiff;
      const codeDiff = a.code < b.code ? -1 : a.code === b.code ? 0 : 1;
      return codeDiff;
    })
    .filter((item, index, array) =>
      index === 0 || item.path !== array[index - 1].path || item.code !== array[index - 1].code,
    );
  return sorted;
}

function addKnownFieldIssues(
  record: Record<string, unknown>,
  known: Set<string>,
  path: string,
  issues: MLBFeatureExtractionIssue[],
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
      'UNKNOWN_FIELD',
      `${path}[${String(symbol)}]`,
      `Unknown symbol property: ${symbol.description ?? symbol.toString()}`,
    );
  }
}

function validateIdentifier(
  value: unknown,
  path: string,
  label: string,
): string | MLBFeatureExtractionIssue {
  if (!isStrictNonEmptyTrimmedString(value)) {
    return { code: 'INVALID_STRING', path, message: `${label} must be a valid identifier` };
  }
  return value;
}

function readDescriptorSafeArray(
  value: unknown,
  path: string,
  issues: MLBFeatureExtractionIssue[],
): unknown[] | null {
  if (!Array.isArray(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, 'Expected array');
    return null;
  }

  const ownNames = Object.getOwnPropertyNames(value);
  for (const key of ownNames) {
    if (key === 'length') {
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (/^\d+$/.test(key)) {
      const index = Number(key);
      if (
        !Number.isSafeInteger(index) ||
        index < 0 ||
        String(index) !== key
      ) {
        pushIssue(
          issues,
          'INVALID_JSON_VALUE',
          `${path}[${key}]`,
          'Array contains non-canonical numeric property',
        );
        return null;
      }
      if (!descriptor || !isDataDescriptor(descriptor)) {
        pushIssue(issues, 'INVALID_JSON_VALUE', `${path}[${key}]`, 'Array contains accessor property');
        return null;
      }
    } else {
      if (descriptor && !isDataDescriptor(descriptor)) {
        pushIssue(issues, 'INVALID_JSON_VALUE', `${path}.${key}`, 'Array contains accessor property');
        return null;
      } else if (descriptor) {
        pushIssue(issues, 'INVALID_JSON_VALUE', `${path}.${key}`, 'Array contains additional property');
        return null;
      }
    }
  }

  const ownSymbols = Object.getOwnPropertySymbols(value);
  for (const symbol of ownSymbols) {
    pushIssue(issues, 'INVALID_JSON_VALUE', `${path}[${String(symbol)}]`, 'Array contains symbol property');
    return null;
  }

  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  if (
    !lengthDescriptor ||
    !isDataDescriptor(lengthDescriptor) ||
    typeof lengthDescriptor.value !== 'number' ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    pushIssue(issues, 'INVALID_ARRAY', path, 'Array length must be a non-negative safe integer');
    return null;
  }

  const expectedLength = lengthDescriptor.value;
  const seenIndices = new Array<boolean>(expectedLength).fill(false);

  for (const key of ownNames) {
    if (key === 'length') continue;
    if (/^\d+$/.test(key)) {
      const index = Number(key);
      if (index >= expectedLength || String(index) !== key) {
        pushIssue(issues, 'INVALID_JSON_VALUE', `${path}[${key}]`, 'Array contains non-canonical numeric property');
        return null;
      }
      seenIndices[index] = true;
    }
  }

  for (let i = 0; i < expectedLength; i++) {
    if (!seenIndices[i]) {
      pushIssue(issues, 'INVALID_ARRAY', path, 'Array is sparse');
      return null;
    }
  }

  return Array.from(value);
}

function validatePayloadPath(
  value: unknown,
  path: string,
  issues: MLBFeatureExtractionIssue[],
): void {
  if (!Array.isArray(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, 'payloadPath must be an array');
    return;
  }

  const arrayResult = readDescriptorSafeArray(value, path, issues);
  if (arrayResult === null) {
    return;
  }

  if (arrayResult.length === 0) {
    pushIssue(issues, 'INVALID_ARRAY', path, 'payloadPath must contain at least one segment');
    return;
  }

  for (let i = 0; i < arrayResult.length; i++) {
    const segment = arrayResult[i];
    const segmentPath = `${path}[${i}]`;
    if (typeof segment === 'string') {
      if (!isStrictNonEmptyTrimmedString(segment)) {
        pushIssue(issues, 'INVALID_STRING', segmentPath, 'String path segment must be non-empty, trimmed, and control-free');
      }
    } else if (typeof segment === 'number') {
      if (
        !Number.isSafeInteger(segment) ||
        segment < 0 ||
        String(segment) !== String(Number(segment))
      ) {
        pushIssue(issues, 'INVALID_INTEGER', segmentPath, 'Numeric path segment must be a non-negative safe integer');
      }
    } else {
      pushIssue(issues, 'INVALID_JSON_VALUE', segmentPath, 'Path segment must be a string or number');
    }
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

// -0 is accepted: Number.isFinite(-0) === true and the repository's
// established finite-number checks preserve -0 exactly.
function isFiniteDefaultValue(value: unknown): value is number {
  return isFiniteNumber(value);
}

function validateFeatureDefinition(
  value: unknown,
  path: string,
  issues: MLBFeatureExtractionIssue[],
  validIds: string[],
): void {
  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, 'Feature must be a plain object');
    return;
  }

  const feature = value as Record<string, unknown>;
  const knownFields = new Set([
    'featureId',
    'sectionId',
    'payloadPath',
    'valueKind',
    'missingPolicy',
    'defaultValue',
  ]);
  addKnownFieldIssues(feature, knownFields, path, issues);

  const featureIdResult = ownDataProperty(feature, 'featureId', `${path}.featureId`, issues);
  if (featureIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.featureId`, 'featureId is required');
  } else if (featureIdResult.kind === 'data') {
    const id = validateIdentifier(featureIdResult.value, `${path}.featureId`, 'featureId');
    if (typeof id === 'string') {
      validIds.push(id);
    } else {
      issues.push(id);
    }
  }

  const sectionIdResult = ownDataProperty(feature, 'sectionId', `${path}.sectionId`, issues);
  if (sectionIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.sectionId`, 'sectionId is required');
  } else if (sectionIdResult.kind === 'data') {
    const id = validateIdentifier(sectionIdResult.value, `${path}.sectionId`, 'sectionId');
    if (typeof id === 'string') {
      // valid
    } else {
      issues.push(id);
    }
  }

  const payloadPathResult = ownDataProperty(feature, 'payloadPath', `${path}.payloadPath`, issues);
  if (payloadPathResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.payloadPath`, 'payloadPath is required');
  } else if (payloadPathResult.kind === 'data') {
    validatePayloadPath(payloadPathResult.value, `${path}.payloadPath`, issues);
  }

  const valueKindResult = ownDataProperty(feature, 'valueKind', `${path}.valueKind`, issues);
  if (valueKindResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.valueKind`, 'valueKind is required');
  } else if (valueKindResult.kind === 'data') {
    if (valueKindResult.value !== 'NUMBER' && valueKindResult.value !== 'BOOLEAN') {
      pushIssue(issues, 'INVALID_LITERAL', `${path}.valueKind`, 'valueKind must be NUMBER or BOOLEAN');
    }
  }

  const missingPolicyResult = ownDataProperty(feature, 'missingPolicy', `${path}.missingPolicy`, issues);
  if (missingPolicyResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.missingPolicy`, 'missingPolicy is required');
  } else if (missingPolicyResult.kind === 'data') {
    if (missingPolicyResult.value !== 'REJECT' && missingPolicyResult.value !== 'USE_DEFAULT') {
      pushIssue(issues, 'INVALID_LITERAL', `${path}.missingPolicy`, 'missingPolicy must be REJECT or USE_DEFAULT');
    }
  }

  const missingPolicy =
    missingPolicyResult.kind === 'data' && typeof missingPolicyResult.value === 'string'
      ? missingPolicyResult.value
      : null;

  const defaultValueResult = ownDataProperty(feature, 'defaultValue', `${path}.defaultValue`, issues);
  if (defaultValueResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.defaultValue`, 'defaultValue is required');
  } else if (defaultValueResult.kind === 'data') {
    if (missingPolicy === 'REJECT') {
      if (defaultValueResult.value !== null) {
        pushIssue(issues, 'INVALID_MISSING_POLICY', `${path}.defaultValue`, 'defaultValue must be null when missingPolicy is REJECT');
      }
    } else if (missingPolicy === 'USE_DEFAULT') {
      if (!isFiniteDefaultValue(defaultValueResult.value)) {
        pushIssue(issues, 'INVALID_NUMBER', `${path}.defaultValue`, 'defaultValue must be a finite number when missingPolicy is USE_DEFAULT');
      }
    }
  }
}

function validateFeaturesArray(
  value: unknown,
  issues: MLBFeatureExtractionIssue[],
): void {
  if (!Array.isArray(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$.features', 'features must be an array');
    return;
  }

  const arrayResult = readDescriptorSafeArray(value, '$.features', issues);
  if (arrayResult === null) {
    return;
  }

  if (arrayResult.length === 0) {
    pushIssue(issues, 'INVALID_ARRAY', '$.features', 'features must contain at least one feature');
    return;
  }

  const validIds: string[] = [];
  for (let i = 0; i < arrayResult.length; i++) {
    validateFeatureDefinition(arrayResult[i], `$.features[${i}]`, issues, validIds);
  }

  const seen = new Set<string>();
  for (const id of validIds) {
    if (seen.has(id)) {
      pushIssue(issues, 'DUPLICATE_ID', '$.features', `Duplicate featureId: ${id}`);
      break;
    }
    seen.add(id);
  }

  for (let i = 1; i < validIds.length; i++) {
    if (validIds[i - 1] >= validIds[i]) {
      pushIssue(issues, 'NON_CANONICAL_ORDER', '$.features', 'Features must be sorted by featureId');
      break;
    }
  }
}

export function validateMLBFeatureManifest(
  value: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBFeatureManifest;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBFeatureExtractionIssue[];
    }> {
  const issues: MLBFeatureExtractionIssue[] = [];

  if (!isPlainObject(value)) {
    return {
      ok: false,
      issues: [{ code: 'NOT_PLAIN_OBJECT', path: '$', message: 'Manifest must be a plain object' }],
    };
  }

  const root = value as Record<string, unknown>;

  addKnownFieldIssues(root, new Set(['contractVersion', 'sport', 'target', 'manifestId', 'features']), '$', issues);

  const contractVersionResult = ownDataProperty(root, 'contractVersion', '$.contractVersion', issues);
  if (contractVersionResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.contractVersion', 'contractVersion is required');
  } else if (contractVersionResult.kind === 'data') {
    if (contractVersionResult.value !== MLB_FEATURE_MANIFEST_CONTRACT_VERSION) {
      pushIssue(issues, 'INVALID_LITERAL', '$.contractVersion', `contractVersion must be ${MLB_FEATURE_MANIFEST_CONTRACT_VERSION}`);
    }
  }

  const sportResult = ownDataProperty(root, 'sport', '$.sport', issues);
  if (sportResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.sport', 'sport is required');
  } else if (sportResult.kind === 'data' && sportResult.value !== 'MLB') {
    pushIssue(issues, 'INVALID_LITERAL', '$.sport', 'sport must be MLB');
  }

  const targetResult = ownDataProperty(root, 'target', '$.target', issues);
  if (targetResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.target', 'target is required');
  } else if (targetResult.kind === 'data' && targetResult.value !== 'OFFICIAL_FINAL_GAME_WINNER') {
    pushIssue(issues, 'INVALID_LITERAL', '$.target', 'target must be OFFICIAL_FINAL_GAME_WINNER');
  }

  const manifestIdResult = ownDataProperty(root, 'manifestId', '$.manifestId', issues);
  if (manifestIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.manifestId', 'manifestId is required');
  } else if (manifestIdResult.kind === 'data') {
    const id = validateIdentifier(manifestIdResult.value, '$.manifestId', 'manifestId');
    if (typeof id !== 'string') {
      pushIssue(issues, 'INVALID_STRING', '$.manifestId', 'manifestId must be a valid identifier');
    }
  }

  const featuresResult = ownDataProperty(root, 'features', '$.features', issues);
  if (featuresResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.features', 'features is required');
  } else if (featuresResult.kind === 'data') {
    validateFeaturesArray(featuresResult.value, issues);
  }

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
                message: `Manifest contains prohibited field at ${firewallPath}`,
              },
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
                code: 'INVALID_JSON_VALUE',
                path: `$${accessorPath.replace(/^\./, '')}`,
                message: 'Manifest contains an accessor property',
              },
            );
          }
        }
      }
    }
  }

  const finalIssues = sortIssues(issues);
  if (finalIssues.length > 0) {
    return { ok: false, issues: finalIssues };
  }

  return { ok: true, value: root as unknown as MLBFeatureManifest };
}

function validateGregorianDate(value: unknown, _path?: string): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12 || day < 1) {
    return false;
  }
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maxDay = leap ? 29 : daysInMonth[month - 1];
  return day <= maxDay;
}

function validateRfc3339Timestamp(value: unknown, _path?: string): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value) &&
    value === value.trim()
  );
}

function validateExtractedFeatureValue(
  value: unknown,
  path: string,
  issues: MLBFeatureExtractionIssue[],
  validIds: string[],
): void {
  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, 'Feature value must be a plain object');
    return;
  }

  const item = value as Record<string, unknown>;
  const knownFields = new Set(['featureId', 'value', 'wasMissing']);
  addKnownFieldIssues(item, knownFields, path, issues);

  const featureIdResult = ownDataProperty(item, 'featureId', `${path}.featureId`, issues);
  if (featureIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.featureId`, 'featureId is required');
  } else if (featureIdResult.kind === 'data') {
    const id = validateIdentifier(featureIdResult.value, `${path}.featureId`, 'featureId');
    if (typeof id === 'string') {
      validIds.push(id);
    }
  }

  const valueResult = ownDataProperty(item, 'value', `${path}.value`, issues);
  if (valueResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.value`, 'value is required');
  } else if (valueResult.kind === 'data') {
    if (!isFiniteNumber(valueResult.value)) {
      pushIssue(issues, 'INVALID_NUMBER', `${path}.value`, 'value must be a finite number');
    }
  }

  const wasMissingResult = ownDataProperty(item, 'wasMissing', `${path}.wasMissing`, issues);
  if (wasMissingResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.wasMissing`, 'wasMissing is required');
  } else if (wasMissingResult.kind === 'data') {
    if (typeof wasMissingResult.value !== 'boolean') {
      pushIssue(issues, 'INVALID_LITERAL', `${path}.wasMissing`, 'wasMissing must be a boolean');
    }
  }
}

function validateValuesArray(
  value: unknown,
  path: string,
  issues: MLBFeatureExtractionIssue[],
): void {
  if (!Array.isArray(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, 'values must be an array');
    return;
  }

  const arrayResult = readDescriptorSafeArray(value, path, issues);
  if (arrayResult === null) {
    return;
  }

  if (arrayResult.length === 0) {
    pushIssue(issues, 'INVALID_ARRAY', path, 'values must not be empty');
    return;
  }

  const validIds: string[] = [];
  for (let i = 0; i < arrayResult.length; i++) {
    validateExtractedFeatureValue(arrayResult[i], `${path}[${i}]`, issues, validIds);
  }

  const seen = new Set<string>();
  for (const id of validIds) {
    if (seen.has(id)) {
      pushIssue(issues, 'DUPLICATE_ID', path, `Duplicate featureId: ${id}`);
      break;
    }
    seen.add(id);
  }

  for (let i = 1; i < validIds.length; i++) {
    if (validIds[i - 1] >= validIds[i]) {
      pushIssue(issues, 'NON_CANONICAL_ORDER', path, 'Values must be sorted by featureId');
      break;
    }
  }
}

export function validateMLBFeatureVector(
  value: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBFeatureVector;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBFeatureExtractionIssue[];
    }> {
  const issues: MLBFeatureExtractionIssue[] = [];

  if (!isPlainObject(value)) {
    return {
      ok: false,
      issues: [{ code: 'NOT_PLAIN_OBJECT', path: '$', message: 'Feature vector must be a plain object' }],
    };
  }

  const root = value as Record<string, unknown>;

  const knownRootFields = new Set([
    'contractVersion',
    'sport',
    'target',
    'manifestId',
    'snapshotId',
    'gameId',
    'officialDate',
    'dataCutoffAt',
    'values',
  ]);
  addKnownFieldIssues(root, knownRootFields, '$', issues);

  const contractVersionResult = ownDataProperty(root, 'contractVersion', '$.contractVersion', issues);
  if (contractVersionResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.contractVersion', 'contractVersion is required');
  } else if (contractVersionResult.kind === 'data') {
    if (contractVersionResult.value !== MLB_FEATURE_VECTOR_CONTRACT_VERSION) {
      pushIssue(issues, 'INVALID_LITERAL', '$.contractVersion', `contractVersion must be ${MLB_FEATURE_VECTOR_CONTRACT_VERSION}`);
    }
  }

  const sportResult = ownDataProperty(root, 'sport', '$.sport', issues);
  if (sportResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.sport', 'sport is required');
  } else if (sportResult.kind === 'data' && sportResult.value !== 'MLB') {
    pushIssue(issues, 'INVALID_LITERAL', '$.sport', 'sport must be MLB');
  }

  const targetResult = ownDataProperty(root, 'target', '$.target', issues);
  if (targetResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.target', 'target is required');
  } else if (targetResult.kind === 'data' && targetResult.value !== 'OFFICIAL_FINAL_GAME_WINNER') {
    pushIssue(issues, 'INVALID_LITERAL', '$.target', 'target must be OFFICIAL_FINAL_GAME_WINNER');
  }

  const manifestIdResult = ownDataProperty(root, 'manifestId', '$.manifestId', issues);
  if (manifestIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.manifestId', 'manifestId is required');
  } else if (manifestIdResult.kind === 'data') {
    const id = validateIdentifier(manifestIdResult.value, '$.manifestId', 'manifestId');
    if (typeof id !== 'string') {
      pushIssue(issues, 'INVALID_STRING', '$.manifestId', 'manifestId must be a valid identifier');
    }
  }

  const snapshotIdResult = ownDataProperty(root, 'snapshotId', '$.snapshotId', issues);
  if (snapshotIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.snapshotId', 'snapshotId is required');
  } else if (snapshotIdResult.kind === 'data') {
    const id = validateIdentifier(snapshotIdResult.value, '$.snapshotId', 'snapshotId');
    if (typeof id !== 'string') {
      pushIssue(issues, 'INVALID_STRING', '$.snapshotId', 'snapshotId must be a valid identifier');
    }
  }

  const gameIdResult = ownDataProperty(root, 'gameId', '$.gameId', issues);
  if (gameIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.gameId', 'gameId is required');
  } else if (gameIdResult.kind === 'data') {
    const id = validateIdentifier(gameIdResult.value, '$.gameId', 'gameId');
    if (typeof id !== 'string') {
      pushIssue(issues, 'INVALID_STRING', '$.gameId', 'gameId must be a valid identifier');
    }
  }

  const officialDateResult = ownDataProperty(root, 'officialDate', '$.officialDate', issues);
  if (officialDateResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.officialDate', 'officialDate is required');
  } else if (officialDateResult.kind === 'data') {
    if (!validateGregorianDate(officialDateResult.value)) {
      pushIssue(issues, 'INVALID_DATE', '$.officialDate', 'officialDate must be a real Gregorian YYYY-MM-DD');
    }
  }

  const dataCutoffAtResult = ownDataProperty(root, 'dataCutoffAt', '$.dataCutoffAt', issues);
  if (dataCutoffAtResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.dataCutoffAt', 'dataCutoffAt is required');
  } else if (dataCutoffAtResult.kind === 'data') {
    if (!validateRfc3339Timestamp(dataCutoffAtResult.value)) {
      pushIssue(issues, 'INVALID_TIMESTAMP', '$.dataCutoffAt', 'dataCutoffAt must be a valid RFC3339 timestamp with explicit timezone');
    }
  }

  const valuesResult = ownDataProperty(root, 'values', '$.values', issues);
  if (valuesResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.values', 'values is required');
  } else if (valuesResult.kind === 'data') {
    validateValuesArray(valuesResult.value, '$.values', issues);
  }

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
                message: `Feature vector contains prohibited field at ${firewallPath}`,
              },
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
                code: 'INVALID_JSON_VALUE',
                path: `$${accessorPath.replace(/^\./, '')}`,
                message: 'Feature vector contains an accessor property',
              },
            );
          }
        }
      }
    }
  }

  const finalIssues = sortIssues(issues);
  if (finalIssues.length > 0) {
    return { ok: false, issues: finalIssues };
  }

  return { ok: true, value: root as unknown as MLBFeatureVector };
}

type TraversalResult =
  | Readonly<{ kind: 'missing' }>
  | Readonly<{ kind: 'error'; issues: MLBFeatureExtractionIssue[] }>
  | Readonly<{ kind: 'value'; value: unknown }>;

function traversePayload(
  payload: unknown,
  path: readonly MLBFeaturePathSegment[],
  definitionPath: string,
  issues: MLBFeatureExtractionIssue[],
): TraversalResult {
  let current: unknown = payload;

  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    const segmentPath = `${definitionPath}[${i}]`;

    if (typeof segment === 'string') {
      if (!isPlainObject(current)) {
        issues.push({
          code: 'FEATURE_SOURCE_INVALID',
          path: segmentPath,
          message: 'Expected object for string path segment',
        });
        return { kind: 'error', issues: [] };
      }
      const descriptor = Object.getOwnPropertyDescriptor(
        current as Record<string, unknown>,
        segment,
      );
      if (!descriptor) {
        return { kind: 'missing' };
      }
      if (!isDataDescriptor(descriptor)) {
        issues.push({
          code: 'INVALID_JSON_VALUE',
          path: segmentPath,
          message: 'Accessor property',
        });
        return { kind: 'error', issues: [] };
      }
      current = descriptor.value;
    } else {
      if (!Array.isArray(current)) {
        issues.push({
          code: 'FEATURE_SOURCE_INVALID',
          path: segmentPath,
          message: 'Expected array for numeric path segment',
        });
        return { kind: 'error', issues: [] };
      }
      const descriptor = Object.getOwnPropertyDescriptor(current, String(segment));
      if (!descriptor) {
        return { kind: 'missing' };
      }
      if (!isDataDescriptor(descriptor)) {
        issues.push({
          code: 'INVALID_JSON_VALUE',
          path: segmentPath,
          message: 'Accessor property',
        });
        return { kind: 'error', issues: [] };
      }
      current = descriptor.value;
    }
  }

  return { kind: 'value', value: current };
}

export function extractMLBLeakageSafeFeatureVector(
  manifest: unknown,
  snapshot: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBFeatureVector;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBFeatureExtractionIssue[];
    }> {
  const manifestResult = validateMLBFeatureManifest(manifest);
  if (!manifestResult.ok) {
    return manifestResult;
  }

  const snapshotResult = validateMLBCanonicalPregameSnapshot(snapshot);
  if (!snapshotResult.ok) {
    const issues: MLBFeatureExtractionIssue[] = [
      {
        code: 'SNAPSHOT_INVALID',
        path: '$.snapshot',
        message: snapshotResult.issues[0]?.message ?? 'Snapshot is invalid',
      },
    ];
    return { ok: false, issues };
  }

  const validatedSnapshot = snapshotResult.value;
  const issues: MLBFeatureExtractionIssue[] = [];

  const sectionsBySectionId = new Map<string, MLBCanonicalPregameSnapshot['sections'][number]>();
  for (const section of validatedSnapshot.sections) {
    sectionsBySectionId.set(section.sectionId, section);
  }

  const values: MLBExtractedFeatureValue[] = [];

  for (let i = 0; i < manifestResult.value.features.length; i++) {
    const feature = manifestResult.value.features[i];
    const definitionPath = `$.features[${i}]`;

    const section = sectionsBySectionId.get(feature.sectionId);

    if (!section) {
      if (feature.missingPolicy === 'REJECT') {
        pushIssue(issues, 'FEATURE_PATH_MISSING', definitionPath, `Section ${feature.sectionId} not found`);
      } else {
        values.push({
          featureId: feature.featureId,
          value: feature.defaultValue as number,
          wasMissing: true,
        });
      }
      continue;
    }

    const traversal = traversePayload(section.payload, feature.payloadPath, `${definitionPath}.payloadPath`, issues);
    if (traversal.kind === 'error') {
      continue;
    }

    if (traversal.kind === 'missing') {
      if (feature.missingPolicy === 'REJECT') {
        pushIssue(issues, 'FEATURE_PATH_MISSING', definitionPath, 'Feature source path is missing');
      } else {
        values.push({
          featureId: feature.featureId,
          value: feature.defaultValue as number,
          wasMissing: true,
        });
      }
      continue;
    }

    const terminal = traversal.value;

    if (feature.valueKind === 'NUMBER') {
      if (!isFiniteNumber(terminal)) {
        issues.push({
          code: 'FEATURE_TYPE_MISMATCH',
          path: `${definitionPath}.payloadPath`,
          message: 'Expected NUMBER',
        });
        continue;
      }
      values.push({
        featureId: feature.featureId,
        value: terminal,
        wasMissing: false,
      });
    } else {
      if (typeof terminal !== 'boolean') {
        issues.push({
          code: 'FEATURE_TYPE_MISMATCH',
          path: `${definitionPath}.payloadPath`,
          message: 'Expected BOOLEAN',
        });
        continue;
      }
      values.push({
        featureId: feature.featureId,
        value: terminal ? 1 : 0,
        wasMissing: false,
      });
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) };
  }

  const vector: MLBFeatureVector = {
    contractVersion: MLB_FEATURE_VECTOR_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    manifestId: manifestResult.value.manifestId,
    snapshotId: validatedSnapshot.snapshotId,
    gameId: validatedSnapshot.game.gameId,
    officialDate: validatedSnapshot.game.officialDate,
    dataCutoffAt: validatedSnapshot.dataCutoffAt,
    values,
  };

  const vectorResult = validateMLBFeatureVector(vector);
  if (!vectorResult.ok) {
    return vectorResult;
  }

  try {
    assertNoOddsContamination(vector);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('ODDS_CONTAMINATION')) {
        const contaminationIssues: MLBFeatureExtractionIssue[] = [];
        for (const line of error.message.split('\n')) {
          if (line.startsWith('path=')) {
            const firewallPath = line.slice(5).split('; ')[0];
            pushUniquePathCode(
              contaminationIssues,
              {
                code: 'ODDS_CONTAMINATION',
                path: `$${firewallPath.replace(/^\./, '')}`,
                message: `Feature vector contains prohibited field at ${firewallPath}`,
              },
            );
          }
        }
        if (contaminationIssues.length > 0) {
          return { ok: false, issues: sortIssues(contaminationIssues) };
        }
      } else if (
        error.name === 'UninspectableAccessorPropertyError' &&
        error.message.startsWith('UNINSPECTABLE_ACCESSOR_PROPERTY\n')
      ) {
        const accessorIssues: MLBFeatureExtractionIssue[] = [];
        for (const line of error.message.split('\n')) {
          if (line.startsWith('path=')) {
            const accessorPath = line.slice(5);
            pushUniquePathCode(
              accessorIssues,
              {
                code: 'INVALID_JSON_VALUE',
                path: `$${accessorPath.replace(/^\./, '')}`,
                message: 'Feature vector contains an accessor property',
              },
            );
          }
        }
        if (accessorIssues.length > 0) {
          return { ok: false, issues: sortIssues(accessorIssues) };
        }
      }
    }
  }

  return { ok: true, value: vector };
}
