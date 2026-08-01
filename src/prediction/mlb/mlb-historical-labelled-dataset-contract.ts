import {
  assertNoOddsContamination,
} from '../firewall/odds-contamination-guard';
import {
  validateMLBCanonicalPregameSnapshot,
  type MLBCanonicalPregameSnapshot,
} from './mlb-pregame-snapshot-contract';

export const MLB_HISTORICAL_LABELLED_DATASET_CONTRACT_VERSION =
  'mlb-historical-labelled-dataset-v1' as const;

export type MLBHistoricalDatasetSplit =
  | 'TRAIN'
  | 'VALIDATION'
  | 'TEST';

export type MLBHistoricalSplitStrategy =
  'CHRONOLOGICAL_OFFICIAL_DATE_V1';

export type MLBHistoricalReconstructionMode =
  'POINT_IN_TIME_AS_OF_CUTOFF';

export type MLBHistoricalFinalLabelStatus =
  'OFFICIAL_FINAL';

export type MLBHistoricalSplitWindow = Readonly<{
  startDate: string;
  endDate: string;
}>;

export type MLBHistoricalSplitPolicy = Readonly<{
  strategy: MLBHistoricalSplitStrategy;
  embargoDays: number;
  train: MLBHistoricalSplitWindow;
  validation: MLBHistoricalSplitWindow;
  test: MLBHistoricalSplitWindow;
}>;

export type MLBHistoricalReconstructionMetadata = Readonly<{
  mode: MLBHistoricalReconstructionMode;
  cutoffAt: string;
  reconstructedAt: string;
}>;

export type MLBHistoricalFinalLabelSource = Readonly<{
  sourceName: string;
  sourceRecordId: string;
  fetchedAt: string;
}>;

export type MLBHistoricalFinalLabel = Readonly<{
  status: MLBHistoricalFinalLabelStatus;
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  homeRuns: number;
  awayRuns: number;
  winnerTeamId: string;
  finalizedAt: string;
  source: MLBHistoricalFinalLabelSource;
}>;

export type MLBHistoricalDatasetExample = Readonly<{
  exampleId: string;
  split: MLBHistoricalDatasetSplit;
  snapshot: MLBCanonicalPregameSnapshot;
  reconstruction: MLBHistoricalReconstructionMetadata;
  label: MLBHistoricalFinalLabel;
}>;

export type MLBHistoricalLabelledDataset = Readonly<{
  contractVersion: typeof MLB_HISTORICAL_LABELLED_DATASET_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  datasetId: string;
  createdAt: string;
  splitPolicy: MLBHistoricalSplitPolicy;
  examples: readonly MLBHistoricalDatasetExample[];
}>;

export type MLBHistoricalDatasetValidationIssue = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F]/;

function isStrictNonEmptyTrimmedString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    !CONTROL_CHARACTER_PATTERN.test(value)
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { value: unknown } {
  return !!descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value');
}

type OwnDataPropertyResult =
  | Readonly<{ kind: 'missing' }>
  | Readonly<{ kind: 'accessor' }>
  | Readonly<{ kind: 'data'; value: unknown }>;

type ExamplesArrayReadResult =
  | Readonly<{ kind: 'invalid' }>
  | Readonly<{ kind: 'valid'; items: readonly unknown[] }>;

function readExamplesArray(
  value: unknown,
  issues: MLBHistoricalDatasetValidationIssue[],
): ExamplesArrayReadResult {
  if (!Array.isArray(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$.examples', 'examples must be an array');
    return { kind: 'invalid' };
  }

  const ownKeys = Reflect.ownKeys(value);
  const ownSymbols = ownKeys.filter((key): key is symbol => typeof key === 'symbol');
  const ownNames = ownKeys.filter((key): key is string => typeof key === 'string');
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  if (!lengthDescriptor || !isDataDescriptor(lengthDescriptor) || typeof lengthDescriptor.value !== 'number' || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) {
    pushIssue(issues, 'INVALID_JSON_VALUE', '$.examples', 'examples length must be a non-negative safe integer');
    return { kind: 'invalid' };
  }
  const expectedLength = lengthDescriptor.value;

  const items: unknown[] = new Array(expectedLength);
  const seenIndices = new Array<boolean>(expectedLength).fill(false);

  for (const key of ownNames) {
    if (key === 'length') {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, key);

    if (/^\d+$/.test(key)) {
      if (!/^(0|[1-9]\d*)$/.test(key)) {
        pushIssue(
          issues,
          'INVALID_JSON_VALUE',
          `$.examples[${key}]`,
          'examples contains a non-canonical numeric property',
        );

        return {
          kind: 'invalid',
        };
      }

      const index = Number(key);

      if (
        !Number.isSafeInteger(index) ||
        index < 0 ||
        index >= expectedLength ||
        String(index) !== key
      ) {
        pushIssue(
          issues,
          'INVALID_JSON_VALUE',
          `$.examples[${key}]`,
          'examples contains a non-canonical numeric property',
        );

        return {
          kind: 'invalid',
        };
      }

      if (!descriptor || !isDataDescriptor(descriptor)) {
        pushIssue(
          issues,
          'INVALID_JSON_VALUE',
          `$.examples[${key}]`,
          'examples contains an accessor property',
        );

        return {
          kind: 'invalid',
        };
      }

      items[index] = descriptor.value;
      seenIndices[index] = true;
      continue;
    }

    if (descriptor && !isDataDescriptor(descriptor)) {
      pushIssue(issues, 'INVALID_JSON_VALUE', `$.examples.${key}`, `examples contains accessor property: ${key}`);
      return { kind: 'invalid' };
    } else if (descriptor) {
      pushIssue(issues, 'UNKNOWN_FIELD', `$.examples.${key}`, `Unknown field: ${key}`);
      return { kind: 'invalid' };
    }
  }

  for (const symbol of ownSymbols) {
    pushIssue(issues, 'INVALID_JSON_VALUE', `$.examples[${String(symbol)}]`, 'examples contains a symbol property');
    return { kind: 'invalid' };
  }

  for (let index = 0; index < expectedLength; index++) {
    if (!seenIndices[index]) {
      pushIssue(issues, 'INVALID_JSON_VALUE', '$.examples', 'examples is a sparse array');
      return { kind: 'invalid' };
    }
  }

  return {
    kind: 'valid',
    items,
  };
}

function ownDataProperty(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBHistoricalDatasetValidationIssue[],
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
  issues: MLBHistoricalDatasetValidationIssue[],
  code: string,
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

function sortIssues(
  issues: MLBHistoricalDatasetValidationIssue[],
): MLBHistoricalDatasetValidationIssue[] {
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
  issues: MLBHistoricalDatasetValidationIssue[],
): void {
  const names = Object.getOwnPropertyNames(record);
  for (const key of names) {
    if (!known.has(key)) {
      pushIssue(issues, 'UNKNOWN_FIELD', `${path}.${key}`, `Unknown field: ${key}`);
    }
  }
  const symbols = Object.getOwnPropertySymbols(record);
  for (const symbol of symbols) {
    pushIssue(issues, 'UNKNOWN_FIELD', `${path}[${String(symbol)}]`, `Unknown symbol property: ${symbol.description ?? symbol.toString()}`);
  }
}

function validateIdentifier(
  value: unknown,
  path: string,
  label: string,
): string | MLBHistoricalDatasetValidationIssue {
  if (!isStrictNonEmptyTrimmedString(value)) {
    return { code: 'INVALID_STRING', path, message: `${label} must be a valid identifier` };
  }
  return value;
}

function timestampRegex(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    value === value.trim()
  );
}

function parseTimestampToMs(
  value: unknown,
  path: string,
  label: string,
): number | MLBHistoricalDatasetValidationIssue {
  if (typeof value !== 'string' || !timestampRegex(value)) {
    return { code: 'INVALID_TIMESTAMP', path, message: `${label} must be an RFC-3339 timestamp` };
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    return { code: 'INVALID_TIMESTAMP', path, message: `${label} must be a finite timestamp` };
  }
  return ms;
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

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a === b ? 0 : 1;
}

const TARGET_GAME_OUTCOME_FIELDS = new Set<string>([
  'finalScore',
  'homeScore',
  'awayScore',
  'winningTeamId',
  'losingTeamId',
  'winner',
  'loser',
  'completedGameState',
  'finalStatus',
  'result',
  'outcome',
  'gradedResult',
]);

function addOutcomeFieldIssues(
  obj: unknown,
  path: string,
  issues: MLBHistoricalDatasetValidationIssue[],
): void {
  if (!isPlainObject(obj)) {
    return;
  }
  const root = obj as Record<string, unknown>;
  for (const key of Object.getOwnPropertyNames(root)) {
    if (TARGET_GAME_OUTCOME_FIELDS.has(key)) {
      const descriptor = Object.getOwnPropertyDescriptor(root, key);
      if (descriptor && isDataDescriptor(descriptor)) {
        pushIssue(issues, 'INVALID_FINAL_LABEL', `${path}.${key}`, `Outcome field ${key} is only allowed inside label`);
      } else if (descriptor && !isDataDescriptor(descriptor)) {
        pushIssue(issues, 'INVALID_JSON_VALUE', `${path}.${key}`, `Outcome accessor ${key} is not allowed`);
      }
    }
  }
}

function validateSplitWindow(
  parent: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBHistoricalDatasetValidationIssue[],
): MLBHistoricalSplitWindow | undefined {
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
    pushIssue(issues, 'INVALID_SPLIT_POLICY', `${path}.startDate`, `${path}.startDate must be <= endDate`);
    return undefined;
  }
  addKnownFieldIssues(windowRoot, new Set(['startDate', 'endDate']), path, issues);
  addOutcomeFieldIssues(windowRoot, path, issues);
  return { startDate, endDate };
}

function validateSplitPolicy(
  policy: unknown,
  issues: MLBHistoricalDatasetValidationIssue[],
): MLBHistoricalSplitPolicy | undefined {
  if (!isPlainObject(policy)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$.splitPolicy', 'splitPolicy must be a plain object');
    return undefined;
  }
  const policyRoot = policy as Record<string, unknown>;
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
    if (typeof embargoDaysResult.value !== 'number' || !Number.isSafeInteger(embargoDaysResult.value) || embargoDaysResult.value < 0) {
      pushIssue(issues, 'INVALID_INTEGER', '$.splitPolicy.embargoDays', 'embargoDays must be a non-negative safe integer');
    } else {
      embargoDays = embargoDaysResult.value;
    }
  }
  const train = validateSplitWindow(policyRoot, 'train', '$.splitPolicy.train', issues);
  const validation = validateSplitWindow(policyRoot, 'validation', '$.splitPolicy.validation', issues);
  const test = validateSplitWindow(policyRoot, 'test', '$.splitPolicy.test', issues);
  if (train && validation && test && embargoDays !== undefined) {
    const trainEnd = dateFrom(train.endDate);
    const validationStart = dateFrom(validation.startDate);
    const validationEnd = dateFrom(validation.endDate);
    const testStart = dateFrom(test.startDate);
    if (trainEnd >= validationStart) {
      pushIssue(issues, 'SPLIT_WINDOW_OVERLAP', '$.splitPolicy', 'Train must end before validation starts');
    }
    if (validationEnd >= testStart) {
      pushIssue(issues, 'SPLIT_WINDOW_OVERLAP', '$.splitPolicy', 'Validation must end before test starts');
    }
    const embargo1 = calendarDaysBetween(trainEnd, validationStart);
    if (embargo1 < embargoDays) {
      pushIssue(issues, 'EMBARGO_VIOLATION', '$.splitPolicy', `Embargo between train and validation must be at least ${embargoDays} days`);
    }
    const embargo2 = calendarDaysBetween(validationEnd, testStart);
    if (embargo2 < embargoDays) {
      pushIssue(issues, 'EMBARGO_VIOLATION', '$.splitPolicy', `Embargo between validation and test must be at least ${embargoDays} days`);
    }
  }
  addKnownFieldIssues(policyRoot, new Set(['strategy', 'embargoDays', 'train', 'validation', 'test']), '$.splitPolicy', issues);
  addOutcomeFieldIssues(policyRoot, '$.splitPolicy', issues);
  if (!train || !validation || !test || strategyResult.kind === 'accessor' || embargoDaysResult.kind === 'accessor' || embargoDays === undefined) {
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

function validateReconstructionMetadata(
  path: string,
  reconstruction: unknown,
  snapshot: MLBCanonicalPregameSnapshot,
  datasetCreatedAtMs: number | undefined,
  issues: MLBHistoricalDatasetValidationIssue[],
): MLBHistoricalReconstructionMetadata | undefined {
  if (!isPlainObject(reconstruction)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, 'reconstruction must be a plain object');
    return undefined;
  }
  const reconRoot = reconstruction as Record<string, unknown>;
  const modeResult = ownDataProperty(reconRoot, 'mode', `${path}.mode`, issues);
  if (modeResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.mode`, 'mode is required');
  } else if (modeResult.kind === 'data') {
    if (modeResult.value !== 'POINT_IN_TIME_AS_OF_CUTOFF') {
      pushIssue(issues, 'INVALID_LITERAL', `${path}.mode`, 'mode must be POINT_IN_TIME_AS_OF_CUTOFF');
    }
  }
  const cutoffAtResult = ownDataProperty(reconRoot, 'cutoffAt', `${path}.cutoffAt`, issues);
  if (cutoffAtResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.cutoffAt`, 'cutoffAt is required');
  } else if (cutoffAtResult.kind === 'data') {
    if (typeof cutoffAtResult.value !== 'string' || cutoffAtResult.value !== snapshot.dataCutoffAt) {
      pushIssue(issues, 'RECONSTRUCTION_CUTOFF_MISMATCH', `${path}.cutoffAt`, 'cutoffAt must equal snapshot.dataCutoffAt');
    }
  }
  const reconstructedAtResult = ownDataProperty(reconRoot, 'reconstructedAt', `${path}.reconstructedAt`, issues);
  if (reconstructedAtResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.reconstructedAt`, 'reconstructedAt is required');
  } else if (reconstructedAtResult.kind === 'data') {
    const reconstructedAtMs = parseTimestampToMs(reconstructedAtResult.value, `${path}.reconstructedAt`, 'reconstructedAt');
    if (typeof reconstructedAtMs === 'object') {
      issues.push(reconstructedAtMs);
    } else {
      const capturedAtMs = parseTimestampToMs(snapshot.capturedAt, `${path}.snapshot.capturedAt`, 'capturedAt');
      if (typeof capturedAtMs === 'number' && !(reconstructedAtMs >= capturedAtMs)) {
        pushIssue(issues, 'INVALID_TIME_ORDER', path, 'reconstructedAt must be >= snapshot.capturedAt');
      }
      if (datasetCreatedAtMs !== undefined && !(reconstructedAtMs <= datasetCreatedAtMs)) {
        pushIssue(issues, 'INVALID_TIME_ORDER', `${path}.reconstructedAt`, 'reconstructedAt must be <= dataset.createdAt');
      }
    }
  }
  addKnownFieldIssues(reconRoot, new Set(['mode', 'cutoffAt', 'reconstructedAt']), path, issues);
  if (modeResult.kind !== 'data' || cutoffAtResult.kind !== 'data' || reconstructedAtResult.kind !== 'data') {
    return undefined;
  }
  const modeValue = modeResult.value as string;
  const cutoffAtValue = cutoffAtResult.value as string;
  const reconstructedAtValue = reconstructedAtResult.value as string;
  if (!modeValue || !cutoffAtValue || !reconstructedAtValue) {
    return undefined;
  }
  return {
    mode: modeValue as MLBHistoricalReconstructionMode,
    cutoffAt: cutoffAtValue,
    reconstructedAt: reconstructedAtValue,
  };
}

function validateFinalLabelSource(
  source: unknown,
  path: string,
  labelFinalizedAtMs: number,
  datasetCreatedAtMs: number | undefined,
  issues: MLBHistoricalDatasetValidationIssue[],
): MLBHistoricalFinalLabelSource | undefined {
  if (!isPlainObject(source)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, `${path} must be a plain object`);
    return undefined;
  }
  const sourceRoot = source as Record<string, unknown>;
  const sourceNameResult = ownDataProperty(sourceRoot, 'sourceName', `${path}.sourceName`, issues);
  if (sourceNameResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.sourceName`, 'sourceName is required');
  } else if (sourceNameResult.kind === 'data') {
    if (!isStrictNonEmptyTrimmedString(sourceNameResult.value)) {
      pushIssue(issues, 'INVALID_STRING', `${path}.sourceName`, 'sourceName must be a strict non-empty trimmed control-free string');
    }
  }
  const sourceRecordIdResult = ownDataProperty(sourceRoot, 'sourceRecordId', `${path}.sourceRecordId`, issues);
  if (sourceRecordIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.sourceRecordId`, 'sourceRecordId is required');
  } else if (sourceRecordIdResult.kind === 'data') {
    if (!isStrictNonEmptyTrimmedString(sourceRecordIdResult.value)) {
      pushIssue(issues, 'INVALID_STRING', `${path}.sourceRecordId`, 'sourceRecordId must be a strict non-empty trimmed control-free identifier');
    }
  }
  const fetchedAtResult = ownDataProperty(sourceRoot, 'fetchedAt', `${path}.fetchedAt`, issues);
  if (fetchedAtResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.fetchedAt`, 'fetchedAt is required');
  } else if (fetchedAtResult.kind === 'data') {
    const fetchedAtMs = parseTimestampToMs(fetchedAtResult.value, `${path}.fetchedAt`, 'fetchedAt');
    if (typeof fetchedAtMs === 'object') {
      issues.push(fetchedAtMs);
    } else {
      if (!(fetchedAtMs >= labelFinalizedAtMs)) {
        pushIssue(issues, 'INVALID_TIME_ORDER', `${path}.fetchedAt`, 'fetchedAt must be >= label.finalizedAt');
      }
      if (datasetCreatedAtMs !== undefined && !(fetchedAtMs <= datasetCreatedAtMs)) {
        pushIssue(issues, 'INVALID_TIME_ORDER', `${path}.fetchedAt`, 'fetchedAt must be <= dataset.createdAt');
      }
    }
  }
  addKnownFieldIssues(sourceRoot, new Set(['sourceName', 'sourceRecordId', 'fetchedAt']), path, issues);
  let sourceNameValue: string | undefined;
  let sourceRecordIdValue: string | undefined;
  let fetchedAtValue: string | undefined;
  if (sourceNameResult.kind === 'data') {
    sourceNameValue = sourceNameResult.value as string;
  }
  if (sourceRecordIdResult.kind === 'data') {
    sourceRecordIdValue = sourceRecordIdResult.value as string;
  }
  if (fetchedAtResult.kind === 'data') {
    fetchedAtValue = fetchedAtResult.value as string;
  }
  if (sourceNameValue && sourceRecordIdValue && fetchedAtValue) {
    return { sourceName: sourceNameValue, sourceRecordId: sourceRecordIdValue, fetchedAt: fetchedAtValue };
  }
  return undefined;
}

function validateFinalLabel(
  label: unknown,
  path: string,
  snapshot: MLBCanonicalPregameSnapshot | undefined,
  datasetCreatedAtMs: number | undefined,
  issues: MLBHistoricalDatasetValidationIssue[],
): void {
  if (!isPlainObject(label)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, `${path} must be a plain object`);
    return;
  }
  const labelRoot = label as Record<string, unknown>;
  const statusResult = ownDataProperty(labelRoot, 'status', `${path}.status`, issues);
  if (statusResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.status`, 'status is required');
  } else if (statusResult.kind === 'data') {
    if (statusResult.value !== 'OFFICIAL_FINAL') {
      pushIssue(issues, 'INVALID_LITERAL', `${path}.status`, 'status must be OFFICIAL_FINAL');
    }
  }
  const targetResult = ownDataProperty(labelRoot, 'target', `${path}.target`, issues);
  if (targetResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.target`, 'target is required');
  } else if (targetResult.kind === 'data') {
    if (targetResult.value !== 'OFFICIAL_FINAL_GAME_WINNER') {
      pushIssue(issues, 'INVALID_LITERAL', `${path}.target`, 'target must be OFFICIAL_FINAL_GAME_WINNER');
    }
  }
  const homeRunsResult = ownDataProperty(labelRoot, 'homeRuns', `${path}.homeRuns`, issues);
  if (homeRunsResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.homeRuns`, 'homeRuns is required');
  } else if (homeRunsResult.kind === 'data') {
    if (typeof homeRunsResult.value !== 'number' || !Number.isSafeInteger(homeRunsResult.value) || homeRunsResult.value < 0) {
      pushIssue(issues, 'INVALID_INTEGER', `${path}.homeRuns`, 'homeRuns must be a non-negative safe integer');
    }
  }
  const awayRunsResult = ownDataProperty(labelRoot, 'awayRuns', `${path}.awayRuns`, issues);
  if (awayRunsResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.awayRuns`, 'awayRuns is required');
  } else if (awayRunsResult.kind === 'data') {
    if (typeof awayRunsResult.value !== 'number' || !Number.isSafeInteger(awayRunsResult.value) || awayRunsResult.value < 0) {
      pushIssue(issues, 'INVALID_INTEGER', `${path}.awayRuns`, 'awayRuns must be a non-negative safe integer');
    }
  }
  const winnerTeamIdResult = ownDataProperty(labelRoot, 'winnerTeamId', `${path}.winnerTeamId`, issues);
  if (winnerTeamIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.winnerTeamId`, 'winnerTeamId is required');
  } else if (winnerTeamIdResult.kind === 'data') {
    if (typeof winnerTeamIdResult.value !== 'string' || !isStrictNonEmptyTrimmedString(winnerTeamIdResult.value)) {
      pushIssue(issues, 'INVALID_STRING', `${path}.winnerTeamId`, 'winnerTeamId must be a valid identifier');
    }
  }
  const finalizedAtResult = ownDataProperty(labelRoot, 'finalizedAt', `${path}.finalizedAt`, issues);
  if (finalizedAtResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.finalizedAt`, 'finalizedAt is required');
  } else if (finalizedAtResult.kind === 'data') {
    const finalizedAtMs = parseTimestampToMs(finalizedAtResult.value, `${path}.finalizedAt`, 'finalizedAt');
    if (typeof finalizedAtMs === 'object') {
      issues.push(finalizedAtMs);
    }
  }
  const sourceResult = ownDataProperty(labelRoot, 'source', `${path}.source`, issues);
  if (sourceResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.source`, 'source is required');
  } else if (sourceResult.kind === 'data') {
    const labelFinalizedAtMs = finalizedAtResult.kind === 'data'
      ? parseTimestampToMs(finalizedAtResult.value, `${path}.finalizedAt`, 'finalizedAt')
      : NaN;
    validateFinalLabelSource(
      sourceResult.value,
      `${path}.source`,
      typeof labelFinalizedAtMs === 'number' ? labelFinalizedAtMs : NaN,
      datasetCreatedAtMs,
      issues,
    );
  }
  if (
    homeRunsResult.kind === 'data' &&
    awayRunsResult.kind === 'data' &&
    winnerTeamIdResult.kind === 'data' &&
    snapshot
  ) {
    const homeRuns = homeRunsResult.value as number;
    const awayRuns = awayRunsResult.value as number;
    const winnerTeamId = winnerTeamIdResult.value as string;
    if (homeRuns === awayRuns) {
      pushIssue(issues, 'INVALID_FINAL_LABEL', `${path}.homeRuns`, 'Final scores may not be tied');
    }
    if (homeRuns > awayRuns && winnerTeamId !== snapshot.game.homeTeamId) {
      pushIssue(issues, 'LABEL_TEAM_MISMATCH', `${path}.winnerTeamId`, 'winnerTeamId must equal the home team when homeRuns > awayRuns');
    }
    if (awayRuns > homeRuns && winnerTeamId !== snapshot.game.awayTeamId) {
      pushIssue(issues, 'LABEL_TEAM_MISMATCH', `${path}.winnerTeamId`, 'winnerTeamId must equal the away team when awayRuns > homeRuns');
    }
    if (winnerTeamId !== snapshot.game.homeTeamId && winnerTeamId !== snapshot.game.awayTeamId) {
      pushIssue(issues, 'LABEL_TEAM_MISMATCH', `${path}.winnerTeamId`, 'winnerTeamId must be one of the two team IDs');
    }
  }
  if (finalizedAtResult.kind === 'data' && snapshot) {
    const finalizedAtMs = parseTimestampToMs(finalizedAtResult.value, `${path}.finalizedAt`, 'finalizedAt');
    const scheduledStartAtMs = parseTimestampToMs(snapshot.game.scheduledStartAt, '$.snapshot.game.scheduledStartAt', 'scheduledStartAt');
    const dataCutoffAtMs = parseTimestampToMs(snapshot.dataCutoffAt, '$.snapshot.dataCutoffAt', 'dataCutoffAt');
    if (typeof finalizedAtMs === 'number' && typeof scheduledStartAtMs === 'number' && !(finalizedAtMs > scheduledStartAtMs)) {
      pushIssue(issues, 'INVALID_TIME_ORDER', `${path}.finalizedAt`, 'finalizedAt must be > scheduledStartAt');
    }
    if (typeof finalizedAtMs === 'number' && typeof dataCutoffAtMs === 'number' && !(finalizedAtMs > dataCutoffAtMs)) {
      pushIssue(issues, 'INVALID_TIME_ORDER', `${path}.finalizedAt`, 'finalizedAt must be > dataCutoffAt');
    }
  }
  addKnownFieldIssues(labelRoot, new Set(['status', 'target', 'homeRuns', 'awayRuns', 'winnerTeamId', 'finalizedAt', 'source']), path, issues);
  addOutcomeFieldIssues(labelRoot, path, issues);
}

interface ExampleValidationResult {
  readonly exampleId: string;
  readonly split: 'TRAIN' | 'VALIDATION' | 'TEST';
  readonly snapshot: MLBCanonicalPregameSnapshot;
}

const SPLIT_ORDERS: Record<MLBHistoricalDatasetSplit, number> = {
  TRAIN: 0,
  VALIDATION: 1,
  TEST: 2,
};

function compareRawExampleOrder(a: ExampleValidationResult, b: ExampleValidationResult): number {
  const splitDiff = SPLIT_ORDERS[a.split] - SPLIT_ORDERS[b.split];
  if (splitDiff !== 0) return splitDiff;
  const dateDiff = compareStrings(a.snapshot.game.officialDate, b.snapshot.game.officialDate);
  if (dateDiff !== 0) return dateDiff;
  const gameIdDiff = compareStrings(a.snapshot.game.gameId, b.snapshot.game.gameId);
  if (gameIdDiff !== 0) return gameIdDiff;
  const snapshotIdDiff = compareStrings(a.snapshot.snapshotId, b.snapshot.snapshotId);
  if (snapshotIdDiff !== 0) return snapshotIdDiff;
  return compareStrings(a.exampleId, b.exampleId);
}

function validateExampleItem(
  example: unknown,
  path: string,
  datasetCreatedAtMs: number | undefined,
  policy: MLBHistoricalSplitPolicy | undefined,
  issues: MLBHistoricalDatasetValidationIssue[],
  seenExampleIds: Set<string>,
  seenSnapshotIds: Set<string>,
  seenGameIds: Set<string>,
): ExampleValidationResult | undefined {
  if (!isPlainObject(example)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, `${path} must be a plain object`);
    return undefined;
  }
  const exampleRoot = example as Record<string, unknown>;
  const exampleIdResult = ownDataProperty(exampleRoot, 'exampleId', `${path}.exampleId`, issues);
  let exampleId: string | undefined;
  if (exampleIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.exampleId`, 'exampleId is required');
  } else if (exampleIdResult.kind === 'data') {
    if (!isStrictNonEmptyTrimmedString(exampleIdResult.value)) {
      pushIssue(issues, 'INVALID_STRING', `${path}.exampleId`, 'exampleId must be a valid identifier');
    } else {
      exampleId = exampleIdResult.value;
      if (seenExampleIds.has(exampleId)) {
        pushIssue(issues, 'DUPLICATE_ID', `${path}.exampleId`, `Duplicate exampleId: ${exampleId}`);
      } else {
        seenExampleIds.add(exampleId);
      }
    }
  }
  const splitResult = ownDataProperty(exampleRoot, 'split', `${path}.split`, issues);
  let split: MLBHistoricalDatasetSplit | undefined;
  if (splitResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.split`, 'split is required');
  } else if (splitResult.kind === 'data') {
    if (typeof splitResult.value !== 'string' || splitResult.value !== 'TRAIN' && splitResult.value !== 'VALIDATION' && splitResult.value !== 'TEST') {
      pushIssue(issues, 'INVALID_LITERAL', `${path}.split`, 'split must be TRAIN, VALIDATION, or TEST');
    } else {
      split = splitResult.value;
    }
  }
  const snapshotResult = ownDataProperty(exampleRoot, 'snapshot', `${path}.snapshot`, issues);
  let validatedSnapshot: MLBCanonicalPregameSnapshot | undefined;
  if (snapshotResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.snapshot`, 'snapshot is required');
  } else if (snapshotResult.kind === 'data') {
    const snapshotValidation = validateMLBCanonicalPregameSnapshot(snapshotResult.value);
    if (!snapshotValidation.ok) {
      const firstIssue = snapshotValidation.issues[0];
      pushIssue(issues, 'SNAPSHOT_INVALID', `${path}.snapshot`, `Snapshot invalid: ${firstIssue.code} at ${firstIssue.path}`);
    } else {
      validatedSnapshot = snapshotValidation.value;
      if (seenSnapshotIds.has(validatedSnapshot.snapshotId)) {
        pushIssue(issues, 'DUPLICATE_ID', `${path}.snapshot.snapshotId`, `Duplicate snapshotId: ${validatedSnapshot.snapshotId}`);
      } else {
        seenSnapshotIds.add(validatedSnapshot.snapshotId);
      }
      if (seenGameIds.has(validatedSnapshot.game.gameId)) {
        pushIssue(issues, 'DUPLICATE_GAME', `${path}.snapshot.game.gameId`, `Duplicate gameId: ${validatedSnapshot.game.gameId}`);
      } else {
        seenGameIds.add(validatedSnapshot.game.gameId);
      }
    }
  }
  const reconstructionResult = ownDataProperty(exampleRoot, 'reconstruction', `${path}.reconstruction`, issues);
  if (reconstructionResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.reconstruction`, 'reconstruction is required');
  } else if (reconstructionResult.kind === 'data') {
    if (validatedSnapshot) {
      validateReconstructionMetadata(`${path}.reconstruction`, reconstructionResult.value, validatedSnapshot, datasetCreatedAtMs, issues);
    } else {
      if (!isPlainObject(reconstructionResult.value)) {
        pushIssue(issues, 'NOT_PLAIN_OBJECT', `${path}.reconstruction`, 'reconstruction must be a plain object');
      } else {
        const reconRoot = reconstructionResult.value as Record<string, unknown>;
        const modeResult = ownDataProperty(reconRoot, 'mode', `${path}.reconstruction.mode`, issues);
        if (modeResult.kind === 'missing') pushIssue(issues, 'MISSING_FIELD', `${path}.reconstruction.mode`, 'mode is required');
        else if (modeResult.kind === 'data' && modeResult.value !== 'POINT_IN_TIME_AS_OF_CUTOFF') pushIssue(issues, 'INVALID_LITERAL', `${path}.reconstruction.mode`, 'mode must be POINT_IN_TIME_AS_OF_CUTOFF');
        const cutoffResult = ownDataProperty(reconRoot, 'cutoffAt', `${path}.reconstruction.cutoffAt`, issues);
        if (cutoffResult.kind === 'missing') pushIssue(issues, 'MISSING_FIELD', `${path}.reconstruction.cutoffAt`, 'cutoffAt is required');
        const reconAtResult = ownDataProperty(reconRoot, 'reconstructedAt', `${path}.reconstruction.reconstructedAt`, issues);
        if (reconAtResult.kind === 'missing') pushIssue(issues, 'MISSING_FIELD', `${path}.reconstruction.reconstructedAt`, 'reconstructedAt is required');
        addKnownFieldIssues(reconRoot, new Set(['mode', 'cutoffAt', 'reconstructedAt']), `${path}.reconstruction`, issues);
      }
    }
  }
  const labelResult = ownDataProperty(exampleRoot, 'label', `${path}.label`, issues);
  if (labelResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.label`, 'label is required');
  } else if (labelResult.kind === 'data') {
    validateFinalLabel(labelResult.value, `${path}.label`, validatedSnapshot, datasetCreatedAtMs, issues);
  }
  addKnownFieldIssues(exampleRoot, new Set(['exampleId', 'split', 'snapshot', 'reconstruction', 'label']), path, issues);
  addOutcomeFieldIssues(exampleRoot, path, issues);
  if (exampleId && split && validatedSnapshot) {
    return { exampleId, split, snapshot: validatedSnapshot };
  }
  return undefined;
}

function validateExamplesArray(
  items: readonly unknown[],
  issues: MLBHistoricalDatasetValidationIssue[],
  datasetCreatedAtMs: number | undefined,
  policy: MLBHistoricalSplitPolicy | undefined,
): void {
  const seenExampleIds = new Set<string>();
  const seenSnapshotIds = new Set<string>();
  const seenGameIds = new Set<string>();
  let previousOrder: ExampleValidationResult | null = null;
  for (let i = 0; i < items.length; i++) {
    const itemPath = `$.examples[${i}]`;
    const exampleResult = validateExampleItem(items[i], itemPath, datasetCreatedAtMs, policy, issues, seenExampleIds, seenSnapshotIds, seenGameIds);
    if (exampleResult) {
      if (policy) {
        const window = exampleResult.split === 'TRAIN'
          ? policy.train
          : exampleResult.split === 'VALIDATION'
            ? policy.validation
            : policy.test;
        const start = dateFrom(window.startDate);
        const end = dateFrom(window.endDate);
        const gameDate = dateFrom(exampleResult.snapshot.game.officialDate);
        if (gameDate < start || gameDate > end) {
          pushIssue(issues, 'EXAMPLE_OUTSIDE_SPLIT', `${itemPath}.split`, `Example officialDate ${exampleResult.snapshot.game.officialDate} is outside ${exampleResult.split} window`);
        }
        if (previousOrder !== null) {
          if (compareRawExampleOrder(previousOrder, exampleResult) > 0) {
            pushIssue(issues, 'NON_CANONICAL_ORDER', '$.examples', 'Examples must be in canonical order');
            break;
          }
        }
        previousOrder = exampleResult;
      }
    }
  }
}

function pushUniquePathCode(
  issues: MLBHistoricalDatasetValidationIssue[],
  next: MLBHistoricalDatasetValidationIssue,
): void {
  const exists = issues.some(
    (item) => item.path === next.path && item.code === next.code,
  );
  if (!exists) {
    issues.push(next);
  }
}

export function validateMLBHistoricalLabelledDataset(
  value: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBHistoricalLabelledDataset;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBHistoricalDatasetValidationIssue[];
    }> {
  const issues: MLBHistoricalDatasetValidationIssue[] = [];
  if (!isPlainObject(value)) {
    return { ok: false, issues: [{ code: 'NOT_PLAIN_OBJECT', path: '$', message: 'Dataset must be a plain object' }] };
  }
  const root = value as Record<string, unknown>;
  const contractVersionResult = ownDataProperty(root, 'contractVersion', '$.contractVersion', issues);
  if (contractVersionResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.contractVersion', 'contractVersion is required');
  } else if (contractVersionResult.kind === 'data') {
    if (contractVersionResult.value !== MLB_HISTORICAL_LABELLED_DATASET_CONTRACT_VERSION) {
      pushIssue(issues, 'INVALID_LITERAL', '$.contractVersion', `contractVersion must be ${MLB_HISTORICAL_LABELLED_DATASET_CONTRACT_VERSION}`);
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
  const datasetIdResult = ownDataProperty(root, 'datasetId', '$.datasetId', issues);
  if (datasetIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.datasetId', 'datasetId is required');
  } else if (datasetIdResult.kind === 'data') {
    const datasetId = validateIdentifier(datasetIdResult.value, '$.datasetId', 'datasetId');
    if (typeof datasetId !== 'string') {
      pushIssue(issues, 'INVALID_STRING', '$.datasetId', 'datasetId must be a valid identifier');
    }
  }
  const createdAtResult = ownDataProperty(root, 'createdAt', '$.createdAt', issues);
  let createdAtMs: number | undefined;
  if (createdAtResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.createdAt', 'createdAt is required');
  } else if (createdAtResult.kind === 'data') {
    const parsed = parseTimestampToMs(createdAtResult.value, '$.createdAt', 'createdAt');
    if (typeof parsed === 'object') {
      issues.push(parsed);
    } else {
      createdAtMs = parsed;
    }
  }
  const splitPolicyResult = ownDataProperty(root, 'splitPolicy', '$.splitPolicy', issues);
  let splitPolicy: MLBHistoricalSplitPolicy | undefined;
  if (splitPolicyResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.splitPolicy', 'splitPolicy is required');
  } else if (splitPolicyResult.kind === 'data') {
    splitPolicy = validateSplitPolicy(splitPolicyResult.value, issues);
  }
  const examplesResult = ownDataProperty(root, 'examples', '$.examples', issues);
  if (examplesResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.examples', 'examples is required');
  } else if (examplesResult.kind === 'data') {
    const arrayResult = readExamplesArray(examplesResult.value, issues);
    if (arrayResult.kind === 'valid') {
      if (arrayResult.items.length === 0) {
        pushIssue(issues, 'INVALID_SPLIT_POLICY', '$.examples', 'Dataset must contain at least one example');
      }
      validateExamplesArray(arrayResult.items, issues, createdAtMs, splitPolicy);
    }
  }
  addKnownFieldIssues(root, new Set(['contractVersion', 'sport', 'target', 'datasetId', 'createdAt', 'splitPolicy', 'examples']), '$', issues);
  for (const symbol of Object.getOwnPropertySymbols(root)) {
    pushIssue(issues, 'UNKNOWN_FIELD', `$[${String(symbol)}]`, `Unknown symbol property: ${symbol.description ?? symbol.toString()}`);
  }
  addOutcomeFieldIssues(root, '$', issues);

  try {
    assertNoOddsContamination(value);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('ODDS_CONTAMINATION')) {
        for (const line of error.message.split('\n')) {
          if (line.startsWith('path=')) {
            const firewallPath = line.slice(5).split('; ')[0];
            pushUniquePathCode(issues, {
              code: 'ODDS_CONTAMINATION',
              path: `$${firewallPath.replace(/^\./, '')}`,
              message: `Dataset contains prohibited field at ${firewallPath}`,
            });
          }
        }
      } else if (
        error.name === 'UninspectableAccessorPropertyError' &&
        error.message.startsWith('UNINSPECTABLE_ACCESSOR_PROPERTY\n')
      ) {
        for (const line of error.message.split('\n')) {
          if (line.startsWith('path=')) {
            const accessorPath = line.slice(5);
            pushUniquePathCode(issues, {
              code: 'INVALID_JSON_VALUE',
              path: `$${accessorPath.replace(/^\./, '')}`,
              message: 'Dataset contains an accessor property',
            });
          }
        }
      }
    }
  }
  const finalIssues = sortIssues(issues);
  if (finalIssues.length > 0) {
    return { ok: false, issues: finalIssues };
  }
  return { ok: true, value: root as unknown as MLBHistoricalLabelledDataset };
}
