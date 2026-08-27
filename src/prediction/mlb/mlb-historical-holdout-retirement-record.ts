/* -------------------------------------------------------------------------- */
/*  Contract version + reason                                                   */
/* -------------------------------------------------------------------------- */

export const MLB_HISTORICAL_HOLDOUT_RETIREMENT_RECORD_CONTRACT_VERSION =
  'mlb-historical-holdout-retirement-record-v1' as const;

export const MLB_HISTORICAL_HOLDOUT_RETIREMENT_REASON =
  'HISTORICAL_PAYLOAD_UNAVAILABLE_AND_NOT_REPRODUCIBLE' as const;

/* -------------------------------------------------------------------------- */
/*  Retired historical dataset bindings                                         */
/* -------------------------------------------------------------------------- */

export const MLB_HISTORICAL_HOLDOUT_RETIRED_DATASET_ID =
  'mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360' as const;

export const MLB_HISTORICAL_HOLDOUT_RETIRED_DATASET_SHA256 =
  'e6730f3b9f8e5b0e32958e1997ff804f1b66cb9c323cc992a55a9d8882d742a7' as const;

export const MLB_HISTORICAL_HOLDOUT_VALIDATION_ROW_COUNT = 67 as const;

export const MLB_HISTORICAL_HOLDOUT_VALIDATION_DATE_START = '2026-04-24' as const;

export const MLB_HISTORICAL_HOLDOUT_VALIDATION_DATE_END = '2026-04-28' as const;

export const MLB_HISTORICAL_HOLDOUT_TEST_ROW_COUNT = 69 as const;

export const MLB_HISTORICAL_HOLDOUT_TEST_DATE_START = '2026-04-29' as const;

export const MLB_HISTORICAL_HOLDOUT_TEST_DATE_END = '2026-05-03' as const;

export const MLB_HISTORICAL_HOLDOUT_SUPERSEDED_BY =
  'mlb-v1-candidate-003-prospective-holdout-v1' as const;

/* -------------------------------------------------------------------------- */
/*  Frozen record                                                               */
/* -------------------------------------------------------------------------- */

export const MLB_HISTORICAL_HOLDOUT_RETIREMENT_RECORD = Object.freeze(
  {
    contractVersion: MLB_HISTORICAL_HOLDOUT_RETIREMENT_RECORD_CONTRACT_VERSION,
    retiredDatasetId: MLB_HISTORICAL_HOLDOUT_RETIRED_DATASET_ID,
    retiredDatasetSha256: MLB_HISTORICAL_HOLDOUT_RETIRED_DATASET_SHA256,
    reason: MLB_HISTORICAL_HOLDOUT_RETIREMENT_REASON,
    historicalValidation: Object.freeze({
      rowCount: MLB_HISTORICAL_HOLDOUT_VALIDATION_ROW_COUNT,
      dateStart: MLB_HISTORICAL_HOLDOUT_VALIDATION_DATE_START,
      dateEnd: MLB_HISTORICAL_HOLDOUT_VALIDATION_DATE_END,
    }),
    historicalTest: Object.freeze({
      rowCount: MLB_HISTORICAL_HOLDOUT_TEST_ROW_COUNT,
      dateStart: MLB_HISTORICAL_HOLDOUT_TEST_DATE_START,
      dateEnd: MLB_HISTORICAL_HOLDOUT_TEST_DATE_END,
    }),
    validationPayloadAvailable: false,
    validationConsumed: false,
    testPayloadAvailable: false,
    testAccessed: false,
    liveRematerializationExactEquivalenceProven: false,
    supersededForOperationalPromotionBy: MLB_HISTORICAL_HOLDOUT_SUPERSEDED_BY,
  } satisfies MLBHistoricalHoldoutRetirementRecord,
);

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export type MLBHistoricalHoldoutRetirementRecord = Readonly<{
  contractVersion: typeof MLB_HISTORICAL_HOLDOUT_RETIREMENT_RECORD_CONTRACT_VERSION;
  retiredDatasetId: typeof MLB_HISTORICAL_HOLDOUT_RETIRED_DATASET_ID;
  retiredDatasetSha256: typeof MLB_HISTORICAL_HOLDOUT_RETIRED_DATASET_SHA256;
  reason: typeof MLB_HISTORICAL_HOLDOUT_RETIREMENT_REASON;
  historicalValidation: Readonly<{
    rowCount: typeof MLB_HISTORICAL_HOLDOUT_VALIDATION_ROW_COUNT;
    dateStart: typeof MLB_HISTORICAL_HOLDOUT_VALIDATION_DATE_START;
    dateEnd: typeof MLB_HISTORICAL_HOLDOUT_VALIDATION_DATE_END;
  }>;
  historicalTest: Readonly<{
    rowCount: typeof MLB_HISTORICAL_HOLDOUT_TEST_ROW_COUNT;
    dateStart: typeof MLB_HISTORICAL_HOLDOUT_TEST_DATE_START;
    dateEnd: typeof MLB_HISTORICAL_HOLDOUT_TEST_DATE_END;
  }>;
  validationPayloadAvailable: false;
  validationConsumed: false;
  testPayloadAvailable: false;
  testAccessed: false;
  liveRematerializationExactEquivalenceProven: false;
  supersededForOperationalPromotionBy: typeof MLB_HISTORICAL_HOLDOUT_SUPERSEDED_BY;
}>;

export type MLBHistoricalHoldoutRetirementRecordIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_DATE'
    | 'INVALID_BOOLEAN'
    | 'INVALID_ARRAY'
    | 'DUPLICATE_ID'
    | 'NON_CANONICAL_ORDER'
    | 'IDENTITY_MISMATCH'
    | 'PROHIBITED_FIELD';
  path: string;
  message: string;
}>;

/* -------------------------------------------------------------------------- */
/*  Validator                                                                  */
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

function isPlainObjectStrict(value: unknown): value is Record<string, unknown> {
  if (!isPlainObject(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function ownDataProperty(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBHistoricalHoldoutRetirementRecordIssue[],
): { kind: 'data'; value: unknown } | { kind: 'missing' } | { kind: 'accessor' } {
  const descriptor = Object.getOwnPropertyDescriptor(root, key);
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
  issues: MLBHistoricalHoldoutRetirementRecordIssue[],
  code: MLBHistoricalHoldoutRetirementRecordIssue['code'],
  path: string,
  message: string,
): void {
  const exists = issues.some((item) => item.path === path && item.code === code);
  if (!exists) {
    issues.push({ code, path, message });
  }
}

function sortIssues(
  issues: MLBHistoricalHoldoutRetirementRecordIssue[],
): readonly MLBHistoricalHoldoutRetirementRecordIssue[] {
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

const KNOWN_FIELDS = new Set([
  'contractVersion',
  'retiredDatasetId',
  'retiredDatasetSha256',
  'reason',
  'historicalValidation',
  'historicalTest',
  'validationPayloadAvailable',
  'validationConsumed',
  'testPayloadAvailable',
  'testAccessed',
  'liveRematerializationExactEquivalenceProven',
  'supersededForOperationalPromotionBy',
]);

function validateRoot(
  root: Record<string, unknown>,
  issues: MLBHistoricalHoldoutRetirementRecordIssue[],
): void {
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
  for (const symbol of Object.getOwnPropertySymbols(root)) {
    pushIssue(issues, 'PROHIBITED_FIELD', `$[${String(symbol)}]`, `Symbol property: ${symbol.description ?? symbol.toString()}`);
  }
}

function validateContractVersion(root: Record<string, unknown>, issues: MLBHistoricalHoldoutRetirementRecordIssue[]): void {
  const result = ownDataProperty(root, 'contractVersion', '$.contractVersion', issues);
  if (result.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.contractVersion', 'contractVersion is required');
    return;
  }
  if (result.kind === 'accessor') return;
  if (result.value !== MLB_HISTORICAL_HOLDOUT_RETIREMENT_RECORD_CONTRACT_VERSION) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.contractVersion', 'contractVersion does not match frozen record');
  }
}

function validateRetiredDatasetId(root: Record<string, unknown>, issues: MLBHistoricalHoldoutRetirementRecordIssue[]): void {
  const result = ownDataProperty(root, 'retiredDatasetId', '$.retiredDatasetId', issues);
  if (result.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.retiredDatasetId', 'retiredDatasetId is required');
    return;
  }
  if (result.kind === 'accessor') return;
  if (!isStrictNonEmptyTrimmedString(result.value) || result.value !== MLB_HISTORICAL_HOLDOUT_RETIRED_DATASET_ID) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.retiredDatasetId', 'retiredDatasetId does not match frozen dataset');
  }
}

function validateRetiredDatasetSha256(root: Record<string, unknown>, issues: MLBHistoricalHoldoutRetirementRecordIssue[]): void {
  const result = ownDataProperty(root, 'retiredDatasetSha256', '$.retiredDatasetSha256', issues);
  if (result.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.retiredDatasetSha256', 'retiredDatasetSha256 is required');
    return;
  }
  if (result.kind === 'accessor') return;
  if (
    !isStrictNonEmptyTrimmedString(result.value) ||
    !/^[0-9a-f]{64}$/.test(result.value) ||
    result.value !== MLB_HISTORICAL_HOLDOUT_RETIRED_DATASET_SHA256
  ) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.retiredDatasetSha256', 'retiredDatasetSha256 does not match frozen dataset');
  }
}

function validateReason(root: Record<string, unknown>, issues: MLBHistoricalHoldoutRetirementRecordIssue[]): void {
  const result = ownDataProperty(root, 'reason', '$.reason', issues);
  if (result.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.reason', 'reason is required');
    return;
  }
  if (result.kind === 'accessor') return;
  if (!isStrictNonEmptyTrimmedString(result.value) || result.value !== MLB_HISTORICAL_HOLDOUT_RETIREMENT_REASON) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.reason', 'reason does not match frozen retirement reason');
  }
}

function validateHistoricalWindow(
  root: Record<string, unknown>,
  key: string,
  path: string,
  expectedRowCount: number,
  expectedStart: string,
  expectedEnd: string,
  issues: MLBHistoricalHoldoutRetirementRecordIssue[],
): void {
  const result = ownDataProperty(root, key, path, issues);
  if (result.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', path, `${key} is required`);
    return;
  }
  if (result.kind === 'accessor') return;
  if (!isPlainObjectStrict(result.value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, `${key} must be a plain object`);
    return;
  }
  const window = result.value as Record<string, unknown>;
  validatePositiveInteger(window, 'rowCount', `${path}.rowCount`, expectedRowCount, issues);
  validateDateString(window, 'dateStart', `${path}.dateStart`, expectedStart, issues);
  validateDateString(window, 'dateEnd', `${path}.dateEnd`, expectedEnd, issues);
}

function validatePositiveInteger(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  expected: number,
  issues: MLBHistoricalHoldoutRetirementRecordIssue[],
): void {
  const result = ownDataProperty(obj, key, path, issues);
  if (result.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', path, `${key} is required`);
    return;
  }
  if (result.kind === 'accessor') return;
  if (typeof result.value !== 'number' || !Number.isSafeInteger(result.value) || result.value !== expected) {
    pushIssue(issues, 'IDENTITY_MISMATCH', path, `${key} must be ${expected}`);
  }
}

function validateDateString(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  expected: string,
  issues: MLBHistoricalHoldoutRetirementRecordIssue[],
): void {
  const result = ownDataProperty(obj, key, path, issues);
  if (result.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', path, `${key} is required`);
    return;
  }
  if (result.kind === 'accessor') return;
  if (!isStrictNonEmptyTrimmedString(result.value) || result.value !== expected) {
    pushIssue(issues, 'IDENTITY_MISMATCH', path, `${key} does not match frozen value`);
  }
}

function validateBooleanFalse(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBHistoricalHoldoutRetirementRecordIssue[],
): void {
  const result = ownDataProperty(root, key, path, issues);
  if (result.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', path, `${key} is required`);
    return;
  }
  if (result.kind === 'accessor') return;
  if (result.value !== false) {
    pushIssue(issues, 'INVALID_BOOLEAN', path, `${key} must be false`);
  }
}

export function validateMLBHistoricalHoldoutRetirementRecord(
  value: unknown,
):
  | Readonly<{ ok: true; value: MLBHistoricalHoldoutRetirementRecord }>
  | Readonly<{ ok: false; issues: readonly MLBHistoricalHoldoutRetirementRecordIssue[] }> {
  const issues: MLBHistoricalHoldoutRetirementRecordIssue[] = [];

  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$', 'Expected plain object');
    return { ok: false, issues: sortIssues(issues) };
  }

  const root = value as Record<string, unknown>;

  validateRoot(root, issues);
  validateContractVersion(root, issues);
  validateRetiredDatasetId(root, issues);
  validateRetiredDatasetSha256(root, issues);
  validateReason(root, issues);
  validateHistoricalWindow(
    root,
    'historicalValidation',
    '$.historicalValidation',
    MLB_HISTORICAL_HOLDOUT_VALIDATION_ROW_COUNT,
    MLB_HISTORICAL_HOLDOUT_VALIDATION_DATE_START,
    MLB_HISTORICAL_HOLDOUT_VALIDATION_DATE_END,
    issues,
  );
  validateHistoricalWindow(
    root,
    'historicalTest',
    '$.historicalTest',
    MLB_HISTORICAL_HOLDOUT_TEST_ROW_COUNT,
    MLB_HISTORICAL_HOLDOUT_TEST_DATE_START,
    MLB_HISTORICAL_HOLDOUT_TEST_DATE_END,
    issues,
  );
  validateBooleanFalse(root, 'validationPayloadAvailable', '$.validationPayloadAvailable', issues);
  validateBooleanFalse(root, 'validationConsumed', '$.validationConsumed', issues);
  validateBooleanFalse(root, 'testPayloadAvailable', '$.testPayloadAvailable', issues);
  validateBooleanFalse(root, 'testAccessed', '$.testAccessed', issues);
  validateBooleanFalse(root, 'liveRematerializationExactEquivalenceProven', '$.liveRematerializationExactEquivalenceProven', issues);

  const supersededResult = ownDataProperty(root, 'supersededForOperationalPromotionBy', '$.supersededForOperationalPromotionBy', issues);
  if (supersededResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.supersededForOperationalPromotionBy', 'supersededForOperationalPromotionBy is required');
  } else if (supersededResult.kind === 'data') {
    if (!isStrictNonEmptyTrimmedString(supersededResult.value) || supersededResult.value !== MLB_HISTORICAL_HOLDOUT_SUPERSEDED_BY) {
      pushIssue(issues, 'IDENTITY_MISMATCH', '$.supersededForOperationalPromotionBy', 'supersededForOperationalPromotionBy does not match frozen protocol');
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) };
  }

  return {
    ok: true,
    value: Object.freeze({
      contractVersion: MLB_HISTORICAL_HOLDOUT_RETIREMENT_RECORD_CONTRACT_VERSION,
      retiredDatasetId: MLB_HISTORICAL_HOLDOUT_RETIRED_DATASET_ID,
      retiredDatasetSha256: MLB_HISTORICAL_HOLDOUT_RETIRED_DATASET_SHA256,
      reason: MLB_HISTORICAL_HOLDOUT_RETIREMENT_REASON,
      historicalValidation: Object.freeze({
        rowCount: MLB_HISTORICAL_HOLDOUT_VALIDATION_ROW_COUNT,
        dateStart: MLB_HISTORICAL_HOLDOUT_VALIDATION_DATE_START,
        dateEnd: MLB_HISTORICAL_HOLDOUT_VALIDATION_DATE_END,
      }),
      historicalTest: Object.freeze({
        rowCount: MLB_HISTORICAL_HOLDOUT_TEST_ROW_COUNT,
        dateStart: MLB_HISTORICAL_HOLDOUT_TEST_DATE_START,
        dateEnd: MLB_HISTORICAL_HOLDOUT_TEST_DATE_END,
      }),
      validationPayloadAvailable: false,
      validationConsumed: false,
      testPayloadAvailable: false,
      testAccessed: false,
      liveRematerializationExactEquivalenceProven: false,
      supersededForOperationalPromotionBy: MLB_HISTORICAL_HOLDOUT_SUPERSEDED_BY,
    }) as MLBHistoricalHoldoutRetirementRecord,
  };
}
