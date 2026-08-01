import {
  assertNoOddsContamination,
} from '../firewall/odds-contamination-guard';
import {
  validateMLBHistoricalLabelledDataset,
  type MLBHistoricalLabelledDataset,
  type MLBHistoricalDatasetExample,
  type MLBHistoricalSplitPolicy,
} from './mlb-historical-labelled-dataset-contract';
import {
  validateMLBFeatureManifest,
  validateMLBFeatureVector,
  extractMLBLeakageSafeFeatureVector,
  type MLBFeatureManifest,
  type MLBFeatureVector,
} from './mlb-feature-vector-contract';

export const MLB_TRAINING_MATRIX_CONTRACT_VERSION =
  'mlb-training-matrix-v1' as const;

export const MLB_TRAINING_TARGET_ENCODING =
  'HOME_WIN_1_AWAY_WIN_0' as const;

export type MLBTrainingTargetValue = 0 | 1;

export type MLBTrainingMatrixSplitCounts = Readonly<{
  train: number;
  validation: number;
  test: number;
}>;

export type MLBTrainingMatrixRow = Readonly<{
  exampleId: string;
  split: 'TRAIN' | 'VALIDATION' | 'TEST';
  vector: MLBFeatureVector;
  targetValue: MLBTrainingTargetValue;
}>;

export type MLBTrainingMatrix = Readonly<{
  contractVersion: typeof MLB_TRAINING_MATRIX_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  targetEncoding: typeof MLB_TRAINING_TARGET_ENCODING;
  matrixId: string;
  manifestId: string;
  datasetId: string;
  sourceDatasetCreatedAt: string;
  splitPolicy: MLBHistoricalSplitPolicy;
  splitCounts: MLBTrainingMatrixSplitCounts;
  rows: readonly MLBTrainingMatrixRow[];
}>;

export type MLBTrainingMatrixIssue = Readonly<{
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
    | 'MANIFEST_INVALID'
    | 'DATASET_INVALID'
    | 'FEATURE_EXTRACTION_FAILED'
    | 'FEATURE_SCHEMA_MISMATCH'
    | 'VECTOR_INVALID'
    | 'VECTOR_IDENTITY_MISMATCH'
    | 'SPLIT_POLICY_VIOLATION'
    | 'SPLIT_COUNT_MISMATCH'
    | 'TARGET_ENCODING_MISMATCH'
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
  issues: MLBTrainingMatrixIssue[],
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
  issues: MLBTrainingMatrixIssue[],
  code: MLBTrainingMatrixIssue['code'],
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
  issues: MLBTrainingMatrixIssue[],
  next: MLBTrainingMatrixIssue,
): void {
  const exists = issues.some(
    (item) => item.path === next.path && item.code === next.code,
  );
  if (!exists) {
    issues.push(next);
  }
}

function sortIssues(
  issues: MLBTrainingMatrixIssue[],
): MLBTrainingMatrixIssue[] {
  return issues
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
}

function addKnownFieldIssues(
  record: Record<string, unknown>,
  known: Set<string>,
  path: string,
  issues: MLBTrainingMatrixIssue[],
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
  if (month < 1 || month > 12 || day < 1) {
    return false;
  }
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maxDay = leap ? 29 : daysInMonth[month - 1];
  return day <= maxDay;
}

function dateFrom(iso: string): Date {
  return new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))));
}

function calendarDaysBetween(start: Date, end: Date): number {
  const a = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const b = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const diff = Math.floor((b.getTime() - a.getTime()) / 86400000) - 1;
  return Math.max(0, diff);
}

function validateRfc3339Timestamp(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value) &&
    value === value.trim()
  );
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a === b ? 0 : 1;
}

function readDescriptorSafeArray(
  value: unknown,
  path: string,
  issues: MLBTrainingMatrixIssue[],
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

const PROHIBITED_ROW_FIELDS = new Set([
  'label',
  'homeRuns',
  'awayRuns',
  'winnerTeamId',
  'finalizedAt',
  'source',
  'prediction',
  'probability',
  'recommendation',
  'stake',
  'grading',
]);

const SPLIT_ORDERS: Record<MLBTrainingMatrixRow['split'], number> = {
  TRAIN: 0,
  VALIDATION: 1,
  TEST: 2,
};

type MatrixSplitWindow = Readonly<{
  startDate: string;
  endDate: string;
}>;

type MatrixSplitPolicy = Readonly<{
  strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1';
  embargoDays: number;
  train: MatrixSplitWindow;
  validation: MatrixSplitWindow;
  test: MatrixSplitWindow;
}>;

function validateMatrixSplitWindow(
  parent: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBTrainingMatrixIssue[],
): { startDate: string; endDate: string } | undefined {
  const result = ownDataProperty(parent, key, path, issues);
  if (result.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', path, `${key} is required`);
    return undefined;
  }
  if (result.kind === 'accessor') {
    return undefined;
  }
  const window = result.value;
  if (!isPlainObject(window)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, `${path} must be a plain object`);
    return undefined;
  }
  const windowRoot = window as Record<string, unknown>;
  const startDateResult = ownDataProperty(windowRoot, 'startDate', `${path}.startDate`, issues);
  if (startDateResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.startDate`, 'startDate is required');
    return undefined;
  }
  const endDateResult = ownDataProperty(windowRoot, 'endDate', `${path}.endDate`, issues);
  if (endDateResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.endDate`, 'endDate is required');
    return undefined;
  }
  if (startDateResult.kind === 'accessor' || endDateResult.kind === 'accessor') {
    return undefined;
  }
  const startDate = startDateResult.value as string;
  const endDate = endDateResult.value as string;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    pushIssue(issues, 'INVALID_DATE', path, `${path} must use YYYY-MM-DD`);
    return undefined;
  }
  const startDateObj = dateFrom(startDate);
  const endDateObj = dateFrom(endDate);
  if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
    pushIssue(issues, 'INVALID_DATE', path, `${path} must be a valid Gregorian date`);
    return undefined;
  }
  if (startDateObj > endDateObj) {
    pushIssue(issues, 'SPLIT_POLICY_VIOLATION', `${path}.startDate`, `${path}.startDate must be <= endDate`);
    return undefined;
  }
  addKnownFieldIssues(windowRoot, new Set(['startDate', 'endDate']), path, issues);
  return { startDate, endDate };
}

function validateMatrixSplitPolicy(
  value: unknown,
  issues: MLBTrainingMatrixIssue[],
): MatrixSplitPolicy | undefined {
  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$.splitPolicy', 'splitPolicy must be a plain object');
    return undefined;
  }
  const policyRoot = value as Record<string, unknown>;

  addKnownFieldIssues(
    policyRoot,
    new Set(['strategy', 'embargoDays', 'train', 'validation', 'test']),
    '$.splitPolicy',
    issues,
  );

  const strategyResult = ownDataProperty(policyRoot, 'strategy', '$.splitPolicy.strategy', issues);
  if (strategyResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.splitPolicy.strategy', 'strategy is required');
  } else if (strategyResult.kind === 'data') {
    if (strategyResult.value !== 'CHRONOLOGICAL_OFFICIAL_DATE_V1') {
      pushIssue(issues, 'INVALID_LITERAL', '$.splitPolicy.strategy', 'strategy must be CHRONOLOGICAL_OFFICIAL_DATE_V1');
    }
  }

  const embargoDaysResult = ownDataProperty(policyRoot, 'embargoDays', '$.splitPolicy.embargoDays', issues);
  let embargoDays: number | undefined;
  if (embargoDaysResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.splitPolicy.embargoDays', 'embargoDays is required');
  } else if (embargoDaysResult.kind === 'data') {
    if (
      typeof embargoDaysResult.value !== 'number' ||
      !Number.isSafeInteger(embargoDaysResult.value) ||
      embargoDaysResult.value < 0
    ) {
      pushIssue(issues, 'INVALID_INTEGER', '$.splitPolicy.embargoDays', 'embargoDays must be a non-negative safe integer');
    } else {
      embargoDays = embargoDaysResult.value;
    }
  }

  const train = validateMatrixSplitWindow(policyRoot, 'train', '$.splitPolicy.train', issues);
  const validation = validateMatrixSplitWindow(policyRoot, 'validation', '$.splitPolicy.validation', issues);
  const test = validateMatrixSplitWindow(policyRoot, 'test', '$.splitPolicy.test', issues);

  if (train && validation && test && embargoDays !== undefined) {
    const trainEnd = dateFrom(train.endDate);
    const validationStart = dateFrom(validation.startDate);
    const validationEnd = dateFrom(validation.endDate);
    const testStart = dateFrom(test.startDate);

    if (trainEnd >= validationStart) {
      pushIssue(issues, 'SPLIT_POLICY_VIOLATION', '$.splitPolicy', 'Train must end before validation starts');
    }
    if (validationEnd >= testStart) {
      pushIssue(issues, 'SPLIT_POLICY_VIOLATION', '$.splitPolicy', 'Validation must end before test starts');
    }

    const embargo1 = calendarDaysBetween(trainEnd, validationStart);
    if (embargo1 < embargoDays) {
      pushIssue(issues, 'SPLIT_POLICY_VIOLATION', '$.splitPolicy', `Embargo between train and validation must be at least ${embargoDays} days`);
    }

    const embargo2 = calendarDaysBetween(validationEnd, testStart);
    if (embargo2 < embargoDays) {
      pushIssue(issues, 'SPLIT_POLICY_VIOLATION', '$.splitPolicy', `Embargo between validation and test must be at least ${embargoDays} days`);
    }
  }

  if (
    !train ||
    !validation ||
    !test ||
    strategyResult.kind === 'accessor' ||
    embargoDaysResult.kind === 'accessor' ||
    embargoDays === undefined
  ) {
    return undefined;
  }

  return {
    strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1',
    embargoDays,
    train,
    validation,
    test,
  };
}

export function validateMLBTrainingMatrix(
  value: unknown,
):
  | Readonly<{ ok: true; value: MLBTrainingMatrix }>
  | Readonly<{ ok: false; issues: readonly MLBTrainingMatrixIssue[] }> {
  const issues: MLBTrainingMatrixIssue[] = [];

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
                message: `Matrix contains prohibited field at ${firewallPath}`,
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
                message: 'Matrix contains an accessor property',
              },
            );
          }
        }
      }
    }
  }

  if (!isPlainObject(value)) {
    return { ok: false, issues: sortIssues(issues) };
  }

  const root = value as Record<string, unknown>;

  const knownRootFields = new Set([
    'contractVersion',
    'sport',
    'target',
    'targetEncoding',
    'matrixId',
    'manifestId',
    'datasetId',
    'sourceDatasetCreatedAt',
    'splitPolicy',
    'splitCounts',
    'rows',
  ]);
  addKnownFieldIssues(root, knownRootFields, '$', issues);

  const contractVersionResult = ownDataProperty(root, 'contractVersion', '$.contractVersion', issues);
  if (contractVersionResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.contractVersion', 'contractVersion is required');
  } else if (contractVersionResult.kind === 'data') {
    if (contractVersionResult.value !== MLB_TRAINING_MATRIX_CONTRACT_VERSION) {
      pushIssue(issues, 'INVALID_LITERAL', '$.contractVersion', `contractVersion must be ${MLB_TRAINING_MATRIX_CONTRACT_VERSION}`);
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

  const targetEncodingResult = ownDataProperty(root, 'targetEncoding', '$.targetEncoding', issues);
  if (targetEncodingResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.targetEncoding', 'targetEncoding is required');
  } else if (targetEncodingResult.kind === 'data') {
    if (targetEncodingResult.value !== MLB_TRAINING_TARGET_ENCODING) {
      pushIssue(issues, 'INVALID_LITERAL', '$.targetEncoding', `targetEncoding must be ${MLB_TRAINING_TARGET_ENCODING}`);
    }
  }

  const manifestIdResult = ownDataProperty(root, 'manifestId', '$.manifestId', issues);
  let manifestIdValue = '';
  if (manifestIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.manifestId', 'manifestId is required');
  } else if (manifestIdResult.kind === 'data') {
    const id = manifestIdResult.value;
    if (!isStrictNonEmptyTrimmedString(id)) {
      pushIssue(issues, 'INVALID_STRING', '$.manifestId', 'manifestId must be a valid identifier');
    } else {
      manifestIdValue = id;
    }
  }

  const datasetIdResult = ownDataProperty(root, 'datasetId', '$.datasetId', issues);
  let datasetIdValue = '';
  if (datasetIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.datasetId', 'datasetId is required');
  } else if (datasetIdResult.kind === 'data') {
    const id = datasetIdResult.value;
    if (!isStrictNonEmptyTrimmedString(id)) {
      pushIssue(issues, 'INVALID_STRING', '$.datasetId', 'datasetId must be a valid identifier');
    } else {
      datasetIdValue = id;
    }
  }

  const matrixIdResult = ownDataProperty(root, 'matrixId', '$.matrixId', issues);
  if (matrixIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.matrixId', 'matrixId is required');
  } else if (matrixIdResult.kind === 'data') {
    const matrixId = matrixIdResult.value;
    if (!isStrictNonEmptyTrimmedString(matrixId)) {
      pushIssue(issues, 'INVALID_STRING', '$.matrixId', 'matrixId must be a valid identifier');
    } else if (manifestIdValue && datasetIdValue && matrixId !== `${datasetIdValue}::${manifestIdValue}`) {
      pushIssue(issues, 'INVALID_LITERAL', '$.matrixId', `matrixId must equal ${datasetIdValue}::${manifestIdValue}`);
    }
  }

  const createdAtResult = ownDataProperty(root, 'sourceDatasetCreatedAt', '$.sourceDatasetCreatedAt', issues);
  if (createdAtResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.sourceDatasetCreatedAt', 'sourceDatasetCreatedAt is required');
  } else if (createdAtResult.kind === 'data') {
    if (!validateRfc3339Timestamp(createdAtResult.value)) {
      pushIssue(issues, 'INVALID_TIMESTAMP', '$.sourceDatasetCreatedAt', 'sourceDatasetCreatedAt must be a valid RFC3339 timestamp with explicit timezone');
    }
  }

  const splitPolicyResult = ownDataProperty(root, 'splitPolicy', '$.splitPolicy', issues);
  let validatedSplitPolicy: ReturnType<typeof validateMatrixSplitPolicy> | undefined;
  if (splitPolicyResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.splitPolicy', 'splitPolicy is required');
  } else if (splitPolicyResult.kind === 'accessor') {
    // already reported
  } else {
    validatedSplitPolicy = validateMatrixSplitPolicy(splitPolicyResult.value, issues);
  }

  const splitCountsResult = ownDataProperty(root, 'splitCounts', '$.splitCounts', issues);
  let validatedSplitCounts: MLBTrainingMatrixSplitCounts | undefined;
  if (splitCountsResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.splitCounts', 'splitCounts is required');
  } else if (splitCountsResult.kind === 'accessor') {
    // already reported
  } else {
    const countsRoot = splitCountsResult.value as Record<string, unknown>;
    addKnownFieldIssues(countsRoot, new Set(['train', 'validation', 'test']), '$.splitCounts', issues);

    const trainCountResult = ownDataProperty(countsRoot, 'train', '$.splitCounts.train', issues);
    let trainCount: number | undefined;
    if (trainCountResult.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', '$.splitCounts.train', 'train is required');
    } else if (trainCountResult.kind === 'data') {
      if (typeof trainCountResult.value !== 'number' || !Number.isSafeInteger(trainCountResult.value) || trainCountResult.value < 0) {
        pushIssue(issues, 'INVALID_INTEGER', '$.splitCounts.train', 'train must be a non-negative safe integer');
      } else {
        trainCount = trainCountResult.value;
      }
    }

    const validationCountResult = ownDataProperty(countsRoot, 'validation', '$.splitCounts.validation', issues);
    let validationCount: number | undefined;
    if (validationCountResult.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', '$.splitCounts.validation', 'validation is required');
    } else if (validationCountResult.kind === 'data') {
      if (typeof validationCountResult.value !== 'number' || !Number.isSafeInteger(validationCountResult.value) || validationCountResult.value < 0) {
        pushIssue(issues, 'INVALID_INTEGER', '$.splitCounts.validation', 'validation must be a non-negative safe integer');
      } else {
        validationCount = validationCountResult.value;
      }
    }

    const testCountResult = ownDataProperty(countsRoot, 'test', '$.splitCounts.test', issues);
    let testCount: number | undefined;
    if (testCountResult.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', '$.splitCounts.test', 'test is required');
    } else if (testCountResult.kind === 'data') {
      if (typeof testCountResult.value !== 'number' || !Number.isSafeInteger(testCountResult.value) || testCountResult.value < 0) {
        pushIssue(issues, 'INVALID_INTEGER', '$.splitCounts.test', 'test must be a non-negative safe integer');
      } else {
        testCount = testCountResult.value;
      }
    }

    if (trainCount !== undefined && validationCount !== undefined && testCount !== undefined) {
      validatedSplitCounts = { train: trainCount, validation: validationCount, test: testCount };
    }
  }

  const rowsResult = ownDataProperty(root, 'rows', '$.rows', issues);
  let rows: unknown[] = [];
  if (rowsResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.rows', 'rows is required');
  } else if (rowsResult.kind === 'accessor') {
    // already reported
  } else {
    const arrayResult = readDescriptorSafeArray(rowsResult.value, '$.rows', issues);
    if (arrayResult === null) {
      // issues already pushed
    } else {
      rows = arrayResult;
      if (rows.length === 0) {
        pushIssue(issues, 'INVALID_ARRAY', '$.rows', 'rows must not be empty');
      }
    }
  }

  const seenExampleIds = new Set<string>();
  const seenSnapshotIds = new Set<string>();
  const seenGameIds = new Set<string>();
  let schema: readonly string[] | undefined;
  let actualTrain = 0;
  let actualValidation = 0;
  let actualTest = 0;
  let previousRow: MLBTrainingMatrixRow | undefined;

  for (let i = 0; i < rows.length; i++) {
    const rowPath = `$.rows[${i}]`;
    const row = rows[i];

    if (!isPlainObject(row)) {
      pushIssue(issues, 'NOT_PLAIN_OBJECT', rowPath, 'Row must be a plain object');
      continue;
    }

    const rowRoot = row as Record<string, unknown>;
    addKnownFieldIssues(rowRoot, new Set(['exampleId', 'split', 'vector', 'targetValue']), rowPath, issues);

    for (const key of Object.getOwnPropertyNames(rowRoot)) {
      if (PROHIBITED_ROW_FIELDS.has(key)) {
        const descriptor = Object.getOwnPropertyDescriptor(rowRoot, key);
        if (descriptor && isDataDescriptor(descriptor)) {
          pushIssue(issues, 'PROHIBITED_CONCEPT', `${rowPath}.${key}`, `Prohibited field: ${key}`);
        } else if (descriptor) {
          pushIssue(issues, 'INVALID_JSON_VALUE', `${rowPath}.${key}`, `Prohibited accessor: ${key}`);
        }
      }
    }

    const exampleIdResult = ownDataProperty(rowRoot, 'exampleId', `${rowPath}.exampleId`, issues);
    let exampleId: string | undefined;
    if (exampleIdResult.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `${rowPath}.exampleId`, 'exampleId is required');
    } else if (exampleIdResult.kind === 'data') {
      if (!isStrictNonEmptyTrimmedString(exampleIdResult.value)) {
        pushIssue(issues, 'INVALID_STRING', `${rowPath}.exampleId`, 'exampleId must be a valid identifier');
      } else {
        exampleId = exampleIdResult.value;
        if (seenExampleIds.has(exampleId)) {
          pushIssue(issues, 'DUPLICATE_ID', `${rowPath}.exampleId`, `Duplicate exampleId: ${exampleId}`);
        } else {
          seenExampleIds.add(exampleId);
        }
      }
    }

    const splitResult = ownDataProperty(rowRoot, 'split', `${rowPath}.split`, issues);
    let split: 'TRAIN' | 'VALIDATION' | 'TEST' | undefined;
    if (splitResult.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `${rowPath}.split`, 'split is required');
    } else if (splitResult.kind === 'data') {
      if (splitResult.value !== 'TRAIN' && splitResult.value !== 'VALIDATION' && splitResult.value !== 'TEST') {
        pushIssue(issues, 'INVALID_LITERAL', `${rowPath}.split`, 'split must be TRAIN, VALIDATION, or TEST');
      } else {
        split = splitResult.value;
        if (split === 'TRAIN') actualTrain++;
        else if (split === 'VALIDATION') actualValidation++;
        else actualTest++;
      }
    }

    const vectorRawResult = ownDataProperty(rowRoot, 'vector', `${rowPath}.vector`, issues);
    let validatedVector: MLBFeatureVector | undefined;
    if (vectorRawResult.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `${rowPath}.vector`, 'vector is required');
    } else if (vectorRawResult.kind === 'accessor') {
      // already reported
    } else {
      const vectorValidateResult = validateMLBFeatureVector(vectorRawResult.value);
      if (!vectorValidateResult.ok) {
        pushIssue(issues, 'VECTOR_INVALID', `${rowPath}.vector`, `Vector invalid: ${vectorValidateResult.issues[0]?.code ?? 'unknown'} at ${vectorValidateResult.issues[0]?.path ?? '$'}`);
      } else {
        validatedVector = vectorValidateResult.value;
        if (manifestIdValue && validatedVector.manifestId !== manifestIdValue) {
          pushIssue(issues, 'VECTOR_IDENTITY_MISMATCH', `${rowPath}.vector.manifestId`, `Vector manifestId mismatch`);
        }
      }
    }

    const targetValueResult = ownDataProperty(rowRoot, 'targetValue', `${rowPath}.targetValue`, issues);
    if (targetValueResult.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `${rowPath}.targetValue`, 'targetValue is required');
    } else if (targetValueResult.kind === 'data') {
      if (targetValueResult.value !== 0 && targetValueResult.value !== 1) {
        pushIssue(issues, 'TARGET_ENCODING_MISMATCH', `${rowPath}.targetValue`, 'targetValue must be 0 or 1');
      }
    }

    if (validatedVector) {
      const featureIds = validatedVector.values.map((v) => v.featureId);
      if (schema === undefined) {
        schema = featureIds;
      } else {
        if (featureIds.length !== schema.length) {
          pushIssue(issues, 'FEATURE_SCHEMA_MISMATCH', `${rowPath}.vector.values`, 'Feature count mismatch');
        } else {
          for (let j = 0; j < schema.length; j++) {
            if (featureIds[j] !== schema[j]) {
              pushIssue(issues, 'FEATURE_SCHEMA_MISMATCH', `${rowPath}.vector.values[${j}]`, `Feature ID mismatch at index ${j}`);
              break;
            }
          }
        }
      }

      if (seenSnapshotIds.has(validatedVector.snapshotId)) {
        pushIssue(issues, 'DUPLICATE_ID', `${rowPath}.vector.snapshotId`, `Duplicate snapshotId: ${validatedVector.snapshotId}`);
      } else {
        seenSnapshotIds.add(validatedVector.snapshotId);
      }

      if (seenGameIds.has(validatedVector.gameId)) {
        pushIssue(issues, 'DUPLICATE_ID', `${rowPath}.vector.gameId`, `Duplicate gameId: ${validatedVector.gameId}`);
      } else {
        seenGameIds.add(validatedVector.gameId);
      }
    }

    const currentValidRow: MLBTrainingMatrixRow | undefined =
      validatedVector && exampleId && split
        ? {
            exampleId,
            split,
            vector: validatedVector,
            targetValue: 0,
          }
        : undefined;

    if (currentValidRow && previousRow) {
      const splitDiff = SPLIT_ORDERS[currentValidRow.split] - SPLIT_ORDERS[previousRow.split];
      if (splitDiff < 0) {
        pushIssue(issues, 'NON_CANONICAL_ORDER', '$.rows', 'Rows are not in canonical order');
      } else if (splitDiff === 0) {
        const dateDiff = compareStrings(currentValidRow.vector.officialDate, previousRow.vector.officialDate);
        if (dateDiff < 0) {
          pushIssue(issues, 'NON_CANONICAL_ORDER', '$.rows', 'Rows are not in canonical order');
        } else if (dateDiff === 0) {
          const gameIdDiff = compareStrings(currentValidRow.vector.gameId, previousRow.vector.gameId);
          if (gameIdDiff < 0) {
            pushIssue(issues, 'NON_CANONICAL_ORDER', '$.rows', 'Rows are not in canonical order');
          } else if (gameIdDiff === 0) {
            const snapshotIdDiff = compareStrings(currentValidRow.vector.snapshotId, previousRow.vector.snapshotId);
            if (snapshotIdDiff < 0) {
              pushIssue(issues, 'NON_CANONICAL_ORDER', '$.rows', 'Rows are not in canonical order');
            } else if (snapshotIdDiff === 0) {
              const exampleIdDiff = compareStrings(currentValidRow.exampleId, previousRow.exampleId);
              if (exampleIdDiff < 0) {
                pushIssue(issues, 'NON_CANONICAL_ORDER', '$.rows', 'Rows are not in canonical order');
              }
            }
          }
        }
      }
    }

    if (currentValidRow) {
      previousRow = currentValidRow;
    }
  }

  if (validatedSplitPolicy) {
    const trainEnd = dateFrom(validatedSplitPolicy.train.endDate);
    const validationStart = dateFrom(validatedSplitPolicy.validation.startDate);
    const validationEnd = dateFrom(validatedSplitPolicy.validation.endDate);
    const testStart = dateFrom(validatedSplitPolicy.test.startDate);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!isPlainObject(row)) continue;
      const rowRoot = row as Record<string, unknown>;
      const vectorRawResult = ownDataProperty(rowRoot, 'vector', `$.rows[${i}].vector`, issues);
      if (vectorRawResult.kind !== 'data') continue;
      const vectorValidateResult = validateMLBFeatureVector(vectorRawResult.value);
      if (!vectorValidateResult.ok) continue;
      const vector = vectorValidateResult.value;
      const splitResult = ownDataProperty(rowRoot, 'split', `$.rows[${i}].split`, issues);
      if (splitResult.kind !== 'data') continue;
      const split = splitResult.value as string;

      const gameDate = dateFrom(vector.officialDate);
      let window: { startDate: string; endDate: string } | undefined;
      if (split === 'TRAIN') window = validatedSplitPolicy.train;
      else if (split === 'VALIDATION') window = validatedSplitPolicy.validation;
      else if (split === 'TEST') window = validatedSplitPolicy.test;

      if (window) {
        const start = dateFrom(window.startDate);
        const end = dateFrom(window.endDate);
        if (gameDate < start || gameDate > end) {
          pushIssue(issues, 'SPLIT_POLICY_VIOLATION', `$.rows[${i}]`, `Row officialDate ${vector.officialDate} is outside ${split} window`);
        }
      }

      if (split === 'TRAIN') {
        if (gameDate > trainEnd && gameDate < validationStart) {
          pushIssue(issues, 'SPLIT_POLICY_VIOLATION', `$.rows[${i}]`, `Row officialDate ${vector.officialDate} is inside embargo gap between train and validation`);
        }
      } else if (split === 'VALIDATION') {
        if (gameDate > validationEnd && gameDate < testStart) {
          pushIssue(issues, 'SPLIT_POLICY_VIOLATION', `$.rows[${i}]`, `Row officialDate ${vector.officialDate} is inside embargo gap between validation and test`);
        }
      }
    }
  }

  if (validatedSplitCounts) {
    if (actualTrain !== validatedSplitCounts.train) {
      pushIssue(issues, 'SPLIT_COUNT_MISMATCH', '$.splitCounts.train', `Expected ${validatedSplitCounts.train} TRAIN rows, found ${actualTrain}`);
    }
    if (actualValidation !== validatedSplitCounts.validation) {
      pushIssue(issues, 'SPLIT_COUNT_MISMATCH', '$.splitCounts.validation', `Expected ${validatedSplitCounts.validation} VALIDATION rows, found ${actualValidation}`);
    }
    if (actualTest !== validatedSplitCounts.test) {
      pushIssue(issues, 'SPLIT_COUNT_MISMATCH', '$.splitCounts.test', `Expected ${validatedSplitCounts.test} TEST rows, found ${actualTest}`);
    }
    const totalRows = rows.length;
    if (actualTrain + actualValidation + actualTest !== totalRows) {
      pushIssue(issues, 'SPLIT_COUNT_MISMATCH', '$.splitCounts', `Split counts do not sum to row count ${totalRows}`);
    }
  }

  const finalIssues = sortIssues(issues);
  if (finalIssues.length > 0) {
    return { ok: false, issues: finalIssues };
  }

  return { ok: true, value: value as MLBTrainingMatrix };
}

export function buildMLBLeakageSafeTrainingMatrix(
  manifest: unknown,
  historicalDataset: unknown,
):
  | Readonly<{ ok: true; value: MLBTrainingMatrix }>
  | Readonly<{ ok: false; issues: readonly MLBTrainingMatrixIssue[] }> {
  const manifestResult = validateMLBFeatureManifest(manifest);
  if (!manifestResult.ok) {
    return {
      ok: false,
      issues: [
        {
          code: 'MANIFEST_INVALID',
          path: '$.manifest',
          message: `Manifest invalid: ${manifestResult.issues[0]?.code ?? 'unknown'} at ${manifestResult.issues[0]?.path ?? '$'}`,
        },
      ],
    };
  }

  const datasetResult = validateMLBHistoricalLabelledDataset(historicalDataset);
  if (!datasetResult.ok) {
    return {
      ok: false,
      issues: [
        {
          code: 'DATASET_INVALID',
          path: '$.historicalDataset',
          message: `Historical dataset invalid: ${datasetResult.issues[0]?.code ?? 'unknown'} at ${datasetResult.issues[0]?.path ?? '$'}`,
        },
      ],
    };
  }

  const validatedManifest = manifestResult.value;
  const validatedDataset = datasetResult.value;

  const rows: MLBTrainingMatrixRow[] = [];
  const issues: MLBTrainingMatrixIssue[] = [];

  for (let i = 0; i < validatedDataset.examples.length; i++) {
    const example = validatedDataset.examples[i];
    const extractionResult = extractMLBLeakageSafeFeatureVector(validatedManifest, example.snapshot);
    if (!extractionResult.ok) {
      pushIssue(
        issues,
        'FEATURE_EXTRACTION_FAILED',
        `$.historicalDataset.examples[${i}].snapshot`,
        `Example ${example.exampleId} extraction failed: ${extractionResult.issues[0]?.code ?? 'unknown'} at ${extractionResult.issues[0]?.path ?? '$'}`,
      );
      continue;
    }

    const vector = extractionResult.value;
    const label = example.label;
    const winnerTeamId = label.winnerTeamId;
    const homeTeamId = example.snapshot.game.homeTeamId;
    const awayTeamId = example.snapshot.game.awayTeamId;

    let targetValue: MLBTrainingTargetValue;
    if (winnerTeamId === homeTeamId) {
      targetValue = 1;
    } else {
      targetValue = 0;
    }

    rows.push({
      exampleId: example.exampleId,
      split: example.split,
      vector,
      targetValue,
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) };
  }

  const trainCount = rows.filter((r) => r.split === 'TRAIN').length;
  const validationCount = rows.filter((r) => r.split === 'VALIDATION').length;
  const testCount = rows.filter((r) => r.split === 'TEST').length;

  const splitPolicy: MLBHistoricalSplitPolicy = {
    strategy: validatedDataset.splitPolicy.strategy,
    embargoDays: validatedDataset.splitPolicy.embargoDays,
    train: { ...validatedDataset.splitPolicy.train },
    validation: { ...validatedDataset.splitPolicy.validation },
    test: { ...validatedDataset.splitPolicy.test },
  };

  const matrix: MLBTrainingMatrix = {
    contractVersion: MLB_TRAINING_MATRIX_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: MLB_TRAINING_TARGET_ENCODING,
    matrixId: `${validatedDataset.datasetId}::${validatedManifest.manifestId}`,
    manifestId: validatedManifest.manifestId,
    datasetId: validatedDataset.datasetId,
    sourceDatasetCreatedAt: validatedDataset.createdAt,
    splitPolicy,
    splitCounts: {
      train: trainCount,
      validation: validationCount,
      test: testCount,
    },
    rows,
  };

  const validationResult = validateMLBTrainingMatrix(matrix);
  if (!validationResult.ok) {
    return validationResult;
  }

  try {
    assertNoOddsContamination(matrix);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('ODDS_CONTAMINATION')) {
        const contaminationIssues: MLBTrainingMatrixIssue[] = [];
        for (const line of error.message.split('\n')) {
          if (line.startsWith('path=')) {
            const firewallPath = line.slice(5).split('; ')[0];
            pushIssue(
              contaminationIssues,
              'ODDS_CONTAMINATION',
              `$${firewallPath.replace(/^\./, '')}`,
              `Generated matrix contains prohibited field at ${firewallPath}`,
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
        const accessorIssues: MLBTrainingMatrixIssue[] = [];
        for (const line of error.message.split('\n')) {
          if (line.startsWith('path=')) {
            const accessorPath = line.slice(5);
            pushIssue(
              accessorIssues,
              'INVALID_JSON_VALUE',
              `$${accessorPath.replace(/^\./, '')}`,
              'Generated matrix contains an accessor property',
            );
          }
        }
        if (accessorIssues.length > 0) {
          return { ok: false, issues: sortIssues(accessorIssues) };
        }
      }
    }
  }

  return { ok: true, value: validationResult.value };
}
