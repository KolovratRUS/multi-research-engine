/* -------------------------------------------------------------------------- */
/*  Contract version + scientific policy                                      */
/* -------------------------------------------------------------------------- */

export const MLB_SHADOW_MONITORING_OPERATIONAL_RECORD_CONTRACT_VERSION =
  'mlb-shadow-monitoring-operational-record-v1' as const;

export const MLB_SHADOW_MONITORING_OPERATIONAL_MODE_S1_OPERATIONAL_BLIND =
  'S1_OPERATIONAL_BLIND' as const;

export const MLB_SHADOW_MONITORING_SCIENTIFIC_USE_NONE = 'NONE' as const;

/* -------------------------------------------------------------------------- */
/*  Frozen scientific policy                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Locked S1 operational-blind policy.
 *
 * These literals are the ONLY values permitted for the corresponding
 * fields on an operational record. They are frozen to prevent tampering
 * and exported for consumers that need to reference the policy.
 */
export const MLB_SHADOW_MONITORING_OPERATIONAL_POLICY = Object.freeze({
  mode: MLB_SHADOW_MONITORING_OPERATIONAL_MODE_S1_OPERATIONAL_BLIND,
  scientificUse: MLB_SHADOW_MONITORING_SCIENTIFIC_USE_NONE,
  isProspectiveHoldoutEvidence: false,
  eligibleForFutureValidation: false,
  eligibleForFutureTest: false,
});

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export type MLBShadowMonitoringOperationalRecord = Readonly<{
  contractVersion: typeof MLB_SHADOW_MONITORING_OPERATIONAL_RECORD_CONTRACT_VERSION;
  mode: typeof MLB_SHADOW_MONITORING_OPERATIONAL_MODE_S1_OPERATIONAL_BLIND;
  scientificUse: typeof MLB_SHADOW_MONITORING_SCIENTIFIC_USE_NONE;
  isProspectiveHoldoutEvidence: false;
  eligibleForFutureValidation: false;
  eligibleForFutureTest: false;
  shadowRecordId?: string | null;
  gamePk?: number | null;
  officialDate?: string | null;
  scheduledStartAt?: string | null;
  predictionGeneratedAt?: string | null;
  pipelineStatus?: string | null;
  failureCode?: string | null;
  latencyMs?: number | null;
  sourceCandidateRecipeId?: string | null;
  sourceCandidateFingerprint?: string | null;
  featureManifestId?: string | null;
  featureManifestFingerprint?: string | null;
  timingReferenceContractVersion?: string | null;
  timingReferenceCutoffAt?: string | null;
  predictionPayloadGenerated?: boolean | null;
  predictionPayloadSchemaValid?: boolean | null;
  resultFetchSucceeded?: boolean | null;
  resultJoinMatched?: boolean | null;
  resultPayloadSchemaValid?: boolean | null;
  gradingRecordProduced?: boolean | null;
  gradingSchemaValid?: boolean | null;
}>;

export type MLBShadowMonitoringOperationalRecordIssue = Readonly<{
  code:
    | 'NOT_PLAIN_OBJECT'
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'PROHIBITED_FIELD'
    | 'INVALID_LITERAL'
    | 'IDENTITY_MISMATCH'
    | 'INVALID_STRING'
    | 'INVALID_NUMBER'
    | 'INVALID_INTEGER'
    | 'INVALID_BOOLEAN'
    | 'INVALID_TIMESTAMP'
    | 'INVALID_DATE'
    | 'INVALID_HASH'
    | 'INVALID_JSON_VALUE';
  path: string;
  message: string;
}>;

export type MLBShadowMonitoringOperationalRecordValidationResult =
  | Readonly<{ ok: true; value: MLBShadowMonitoringOperationalRecord }>
  | Readonly<{ ok: false; issues: readonly MLBShadowMonitoringOperationalRecordIssue[] }>;

/* -------------------------------------------------------------------------- */
/*  Sensitive-field denylist (recursive)                                       */
/* -------------------------------------------------------------------------- */

/**
 * Normalized (lowercase-stripped) sensitive field names that MUST be
 * rejected anywhere in the object tree — not only at the top level.
 * A nested sensitive payload must not bypass validation merely by being
 * placed under another object key.
 */
const SENSITIVE_FIELD_DENYLIST: ReadonlySet<string> = new Set<string>([
  'predictedwinner',
  'predictedside',
  'predictedteamid',
  'homewinprobability',
  'awaywinprobability',
  'decisionpolicy',
  'officialwinner',
  'winningteamid',
  'losingteamid',
  'winner',
  'loser',
  'finalscore',
  'homescore',
  'awayscore',
  'candidatecorrectness',
  'logloss',
  'loglosscontribution',
  'brier',
  'brierscore',
  'briercontribution',
  'accuracy',
  'calibration',
  'aggregate',
  'performance',
  'roi',
  'predictionpayloadhash',
  'resultpayloadhash',
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/* -------------------------------------------------------------------------- */
/*  Allowlist (top-level strict)                                              */
/* -------------------------------------------------------------------------- */

const KNOWN_FIELDS: ReadonlySet<string> = new Set<string>([
  'contractVersion',
  'mode',
  'scientificUse',
  'isProspectiveHoldoutEvidence',
  'eligibleForFutureValidation',
  'eligibleForFutureTest',
  'shadowRecordId',
  'gamePk',
  'officialDate',
  'scheduledStartAt',
  'predictionGeneratedAt',
  'pipelineStatus',
  'failureCode',
  'latencyMs',
  'sourceCandidateRecipeId',
  'sourceCandidateFingerprint',
  'featureManifestId',
  'featureManifestFingerprint',
  'timingReferenceContractVersion',
  'timingReferenceCutoffAt',
  'predictionPayloadGenerated',
  'predictionPayloadSchemaValid',
  'resultFetchSucceeded',
  'resultJoinMatched',
  'resultPayloadSchemaValid',
  'gradingRecordProduced',
  'gradingSchemaValid',
]);

/* -------------------------------------------------------------------------- */
/*  Structural helpers                                                        */
/* -------------------------------------------------------------------------- */

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F]/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { value: unknown } {
  return !!descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value');
}

function pushIssue(
  issues: MLBShadowMonitoringOperationalRecordIssue[],
  code: MLBShadowMonitoringOperationalRecordIssue['code'],
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
  issues: MLBShadowMonitoringOperationalRecordIssue[],
): readonly MLBShadowMonitoringOperationalRecordIssue[] {
  return Object.freeze(
    issues
      .slice()
      .sort(
        (a, b) =>
          (a.path < b.path ? -1 : a.path === b.path ? 0 : 1) ||
          (a.code < b.code ? -1 : a.code === b.code ? 0 : 1),
      )
      .filter(
        (item, index, array) =>
          index === 0 ||
          item.path !== array[index - 1].path ||
          item.code !== array[index - 1].code,
      ),
  );
}

/* -------------------------------------------------------------------------- */
/*  Value validators                                                           */
/* -------------------------------------------------------------------------- */

function isStrictNonEmptyTrimmedString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    !CONTROL_CHARACTER_PATTERN.test(value)
  );
}

const TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function isValidTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed !== value) return false;
  if (trimmed.length < 11) return false;
  if (!TIMESTAMP_RE.test(trimmed)) return false;
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed !== value) return false;
  if (!DATE_RE.test(trimmed)) return false;
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed);
}

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function isPositiveInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

/* -------------------------------------------------------------------------- */
/*  Recursive denylist scan                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Recursively walks the object tree and rejects any key whose normalized
 * form appears in the sensitive-field denylist. Also rejects symbol keys
 * and accessor properties at every level.
 *
 * This is defense-in-depth: the top-level strict allowlist already rejects
 * unknown fields, but a sensitive field nested inside a known field's value
 * would evade the allowlist. The recursive scan ensures that sensitive
 * payloads cannot bypass validation by being placed under another key.
 */
function scanForSensitiveFields(
  issues: MLBShadowMonitoringOperationalRecordIssue[],
  visited: WeakSet<object>,
  value: unknown,
  path: string,
): void {
  if (typeof value !== 'object' || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    if (visited.has(value)) {
      return;
    }
    visited.add(value);
    try {
      for (let i = 0; i < value.length; i++) {
        scanForSensitiveFields(issues, visited, value[i], `${path}[${i}]`);
      }
    } finally {
      visited.delete(value);
    }
    return;
  }

  if (!isPlainObject(value)) {
    // Dates, Maps, Sets, class instances, etc. are not plain objects.
    // They are not scanned for keys, but their presence is validated by
    // field-level type checks downstream.
    return;
  }

  if (visited.has(value)) {
    return;
  }
  visited.add(value);
  try {
    const keys = Object.getOwnPropertyNames(value);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      const nextPath = `${path}.${key}`;
      if (!isDataDescriptor(descriptor)) {
        pushIssue(
          issues,
          'INVALID_JSON_VALUE',
          nextPath,
          `Accessor property rejected: ${key}`,
        );
        continue;
      }
      if (SENSITIVE_FIELD_DENYLIST.has(normalizeKey(key))) {
        pushIssue(
          issues,
          'PROHIBITED_FIELD',
          nextPath,
          `Prohibited sensitive field: ${key}`,
        );
      }
      scanForSensitiveFields(
        issues,
        visited,
        descriptor.value,
        nextPath,
      );
    }

    const symbols = Object.getOwnPropertySymbols(value);
    for (const symbol of symbols) {
      const symbolPath = `${path}[${String(symbol)}]`;
      pushIssue(
        issues,
        'PROHIBITED_FIELD',
        symbolPath,
        `Symbol property: ${symbol.description ?? symbol.toString()}`,
      );
    }
  } finally {
    visited.delete(value);
  }
}

/* -------------------------------------------------------------------------- */
/*  Top-level strict allowlist                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Enforces top-level strict field allowlisting. Fields whose normalized
 * form is in the denylist are skipped here (already reported by the
 * recursive scan as PROHIBITED_FIELD). All other unknown data-descriptor
 * keys are reported as UNKNOWN_FIELD.
 */
function validateUnknownTopLevelFields(
  root: Record<string, unknown>,
  issues: MLBShadowMonitoringOperationalRecordIssue[],
): void {
  for (const key of Object.getOwnPropertyNames(root)) {
    if (KNOWN_FIELDS.has(key)) {
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(root, key);
    if (!isDataDescriptor(descriptor)) {
      continue; // accessor — already handled by recursive scan
    }
    if (SENSITIVE_FIELD_DENYLIST.has(normalizeKey(key))) {
      continue; // already reported as PROHIBITED_FIELD
    }
    pushIssue(
      issues,
      'UNKNOWN_FIELD',
      `$.${key}`,
      `Unknown field: ${key}`,
    );
  }

  for (const symbol of Object.getOwnPropertySymbols(root)) {
    const descriptor = Object.getOwnPropertyDescriptor(root, symbol);
    if (descriptor && isDataDescriptor(descriptor)) {
      continue; // already handled by recursive scan
    }
    if (descriptor) {
      pushIssue(
        issues,
        'INVALID_JSON_VALUE',
        `$[${String(symbol)}]`,
        `Symbol property at root: ${symbol.description ?? symbol.toString()}`,
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Field validators                                                           */
/* -------------------------------------------------------------------------- */

function ownDataProperty(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBShadowMonitoringOperationalRecordIssue[],
): { kind: 'data'; value: unknown } | { kind: 'missing' } | { kind: 'accessor' } {
  const descriptor = Object.getOwnPropertyDescriptor(root, key);
  if (!descriptor) {
    pushIssue(issues, 'MISSING_FIELD', path, `${key} is required`);
    return { kind: 'missing' };
  }
  if (!isDataDescriptor(descriptor)) {
    pushIssue(
      issues,
      'INVALID_JSON_VALUE',
      path,
      `${key} is an accessor property`,
    );
    return { kind: 'accessor' };
  }
  return { kind: 'data', value: descriptor.value };
}

function validateContractVersion(
  root: Record<string, unknown>,
  issues: MLBShadowMonitoringOperationalRecordIssue[],
): void {
  const result = ownDataProperty(
    root,
    'contractVersion',
    '$.contractVersion',
    issues,
  );
  if (result.kind === 'missing' || result.kind === 'accessor') return;
  if (
    !isStrictNonEmptyTrimmedString(result.value) ||
    result.value !== MLB_SHADOW_MONITORING_OPERATIONAL_RECORD_CONTRACT_VERSION
  ) {
    pushIssue(
      issues,
      'IDENTITY_MISMATCH',
      '$.contractVersion',
      `contractVersion must be exactly ${MLB_SHADOW_MONITORING_OPERATIONAL_RECORD_CONTRACT_VERSION}`,
    );
  }
}

function validateMode(
  root: Record<string, unknown>,
  issues: MLBShadowMonitoringOperationalRecordIssue[],
): void {
  const result = ownDataProperty(root, 'mode', '$.mode', issues);
  if (result.kind === 'missing' || result.kind === 'accessor') return;
  if (
    !isStrictNonEmptyTrimmedString(result.value) ||
    result.value !== MLB_SHADOW_MONITORING_OPERATIONAL_MODE_S1_OPERATIONAL_BLIND
  ) {
    pushIssue(
      issues,
      'IDENTITY_MISMATCH',
      '$.mode',
      `mode must be exactly ${MLB_SHADOW_MONITORING_OPERATIONAL_MODE_S1_OPERATIONAL_BLIND}`,
    );
  }
}

function validateScientificUse(
  root: Record<string, unknown>,
  issues: MLBShadowMonitoringOperationalRecordIssue[],
): void {
  const result = ownDataProperty(
    root,
    'scientificUse',
    '$.scientificUse',
    issues,
  );
  if (result.kind === 'missing' || result.kind === 'accessor') return;
  if (
    !isStrictNonEmptyTrimmedString(result.value) ||
    result.value !== MLB_SHADOW_MONITORING_SCIENTIFIC_USE_NONE
  ) {
    pushIssue(
      issues,
      'IDENTITY_MISMATCH',
      '$.scientificUse',
      `scientificUse must be exactly ${MLB_SHADOW_MONITORING_SCIENTIFIC_USE_NONE}`,
    );
  }
}

function validateBooleanFalse(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBShadowMonitoringOperationalRecordIssue[],
  label: string,
): void {
  const result = ownDataProperty(root, key, path, issues);
  if (result.kind === 'missing' || result.kind === 'accessor') return;
  if (typeof result.value !== 'boolean') {
    pushIssue(
      issues,
      'INVALID_BOOLEAN',
      path,
      `${label} must be a boolean`,
    );
    return;
  }
  if (result.value !== false) {
    pushIssue(
      issues,
      'IDENTITY_MISMATCH',
      path,
      `${label} must be exactly false`,
    );
  }
}

function validateOptionalString(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBShadowMonitoringOperationalRecordIssue[],
  label: string,
): void {
  const result = ownDataProperty(root, key, path, issues);
  if (result.kind === 'missing' || result.kind === 'accessor') return;
  if (result.value === null) return;
  if (!isStrictNonEmptyTrimmedString(result.value)) {
    pushIssue(
      issues,
      'INVALID_STRING',
      path,
      `${label} must be a non-empty trimmed string or null`,
    );
  }
}

function validateOptionalTimestamp(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBShadowMonitoringOperationalRecordIssue[],
  label: string,
): void {
  const result = ownDataProperty(root, key, path, issues);
  if (result.kind === 'missing' || result.kind === 'accessor') return;
  if (result.value === null) return;
  if (!isValidTimestamp(result.value)) {
    pushIssue(
      issues,
      'INVALID_TIMESTAMP',
      path,
      `${label} must be a valid RFC 3339 timestamp or null`,
    );
  }
}

function validateOptionalDate(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBShadowMonitoringOperationalRecordIssue[],
  label: string,
): void {
  const result = ownDataProperty(root, key, path, issues);
  if (result.kind === 'missing' || result.kind === 'accessor') return;
  if (result.value === null) return;
  if (!isValidDate(result.value)) {
    pushIssue(
      issues,
      'INVALID_DATE',
      path,
      `${label} must be a YYYY-MM-DD date or null`,
    );
  }
}

function validateOptionalPositiveInteger(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBShadowMonitoringOperationalRecordIssue[],
  label: string,
): void {
  const result = ownDataProperty(root, key, path, issues);
  if (result.kind === 'missing' || result.kind === 'accessor') return;
  if (result.value === null) return;
  if (!isPositiveInteger(result.value)) {
    pushIssue(
      issues,
      'INVALID_INTEGER',
      path,
      `${label} must be a positive integer or null`,
    );
  }
}

function validateOptionalNonNegativeInteger(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBShadowMonitoringOperationalRecordIssue[],
  label: string,
): void {
  const result = ownDataProperty(root, key, path, issues);
  if (result.kind === 'missing' || result.kind === 'accessor') return;
  if (result.value === null) return;
  if (!isNonNegativeInteger(result.value)) {
    pushIssue(
      issues,
      'INVALID_INTEGER',
      path,
      `${label} must be a non-negative integer or null`,
    );
  }
}

function validateOptionalBoolean(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBShadowMonitoringOperationalRecordIssue[],
  label: string,
): void {
  const result = ownDataProperty(root, key, path, issues);
  if (result.kind === 'missing' || result.kind === 'accessor') return;
  if (result.value === null) return;
  if (typeof result.value !== 'boolean') {
    pushIssue(
      issues,
      'INVALID_BOOLEAN',
      path,
      `${label} must be a boolean or null`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  Main validator                                                             */
/* -------------------------------------------------------------------------- */

export function validateMLBShadowMonitoringOperationalRecord(
  value: unknown,
): MLBShadowMonitoringOperationalRecordValidationResult {
  const issues: MLBShadowMonitoringOperationalRecordIssue[] = [];
  const visited = new WeakSet<object>();

  if (!isPlainObject(value)) {
    pushIssue(
      issues,
      'NOT_PLAIN_OBJECT',
      '$',
      'Expected a plain object',
    );
    return { ok: false, issues: sortIssues(issues) };
  }

  const root = value as Record<string, unknown>;

  // 1. Recursive denylist scan (catches sensitive fields at any depth)
  scanForSensitiveFields(issues, visited, root, '$');

  // 2. Top-level strict allowlist
  validateUnknownTopLevelFields(root, issues);

  // 3. Required locked fields
  validateContractVersion(root, issues);
  validateMode(root, issues);
  validateScientificUse(root, issues);
  validateBooleanFalse(
    root,
    'isProspectiveHoldoutEvidence',
    '$.isProspectiveHoldoutEvidence',
    issues,
    'isProspectiveHoldoutEvidence',
  );
  validateBooleanFalse(
    root,
    'eligibleForFutureValidation',
    '$.eligibleForFutureValidation',
    issues,
    'eligibleForFutureValidation',
  );
  validateBooleanFalse(
    root,
    'eligibleForFutureTest',
    '$.eligibleForFutureTest',
    issues,
    'eligibleForFutureTest',
  );

  // 4. Optional metadata fields (validated only if present)
  validateOptionalString(root, 'shadowRecordId', '$.shadowRecordId', issues, 'shadowRecordId');
  validateOptionalPositiveInteger(root, 'gamePk', '$.gamePk', issues, 'gamePk');
  validateOptionalDate(root, 'officialDate', '$.officialDate', issues, 'officialDate');
  validateOptionalTimestamp(root, 'scheduledStartAt', '$.scheduledStartAt', issues, 'scheduledStartAt');
  validateOptionalTimestamp(root, 'predictionGeneratedAt', '$.predictionGeneratedAt', issues, 'predictionGeneratedAt');
  validateOptionalString(root, 'pipelineStatus', '$.pipelineStatus', issues, 'pipelineStatus');
  validateOptionalString(root, 'failureCode', '$.failureCode', issues, 'failureCode');
  validateOptionalNonNegativeInteger(root, 'latencyMs', '$.latencyMs', issues, 'latencyMs');
  validateOptionalString(root, 'sourceCandidateRecipeId', '$.sourceCandidateRecipeId', issues, 'sourceCandidateRecipeId');
  validateOptionalString(root, 'sourceCandidateFingerprint', '$.sourceCandidateFingerprint', issues, 'sourceCandidateFingerprint');
  validateOptionalString(root, 'featureManifestId', '$.featureManifestId', issues, 'featureManifestId');
  validateOptionalString(root, 'featureManifestFingerprint', '$.featureManifestFingerprint', issues, 'featureManifestFingerprint');
  validateOptionalString(root, 'timingReferenceContractVersion', '$.timingReferenceContractVersion', issues, 'timingReferenceContractVersion');
  validateOptionalTimestamp(root, 'timingReferenceCutoffAt', '$.timingReferenceCutoffAt', issues, 'timingReferenceCutoffAt');
  validateOptionalBoolean(root, 'predictionPayloadGenerated', '$.predictionPayloadGenerated', issues, 'predictionPayloadGenerated');
  validateOptionalBoolean(root, 'predictionPayloadSchemaValid', '$.predictionPayloadSchemaValid', issues, 'predictionPayloadSchemaValid');
  validateOptionalBoolean(root, 'resultFetchSucceeded', '$.resultFetchSucceeded', issues, 'resultFetchSucceeded');
  validateOptionalBoolean(root, 'resultJoinMatched', '$.resultJoinMatched', issues, 'resultJoinMatched');
  validateOptionalBoolean(root, 'resultPayloadSchemaValid', '$.resultPayloadSchemaValid', issues, 'resultPayloadSchemaValid');
  validateOptionalBoolean(root, 'gradingRecordProduced', '$.gradingRecordProduced', issues, 'gradingRecordProduced');
  validateOptionalBoolean(root, 'gradingSchemaValid', '$.gradingSchemaValid', issues, 'gradingSchemaValid');

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) };
  }

  return {
    ok: true,
    value: Object.freeze({
      contractVersion: MLB_SHADOW_MONITORING_OPERATIONAL_RECORD_CONTRACT_VERSION,
      mode: MLB_SHADOW_MONITORING_OPERATIONAL_MODE_S1_OPERATIONAL_BLIND,
      scientificUse: MLB_SHADOW_MONITORING_SCIENTIFIC_USE_NONE,
      isProspectiveHoldoutEvidence: false,
      eligibleForFutureValidation: false,
      eligibleForFutureTest: false,
      shadowRecordId: root.shadowRecordId ?? null,
      gamePk: root.gamePk ?? null,
      officialDate: root.officialDate ?? null,
      scheduledStartAt: root.scheduledStartAt ?? null,
      predictionGeneratedAt: root.predictionGeneratedAt ?? null,
      pipelineStatus: root.pipelineStatus ?? null,
      failureCode: root.failureCode ?? null,
      latencyMs: root.latencyMs ?? null,
      sourceCandidateRecipeId: root.sourceCandidateRecipeId ?? null,
      sourceCandidateFingerprint: root.sourceCandidateFingerprint ?? null,
      featureManifestId: root.featureManifestId ?? null,
      featureManifestFingerprint: root.featureManifestFingerprint ?? null,
      timingReferenceContractVersion: root.timingReferenceContractVersion ?? null,
      timingReferenceCutoffAt: root.timingReferenceCutoffAt ?? null,
      predictionPayloadGenerated: root.predictionPayloadGenerated ?? null,
      predictionPayloadSchemaValid: root.predictionPayloadSchemaValid ?? null,
      resultFetchSucceeded: root.resultFetchSucceeded ?? null,
      resultJoinMatched: root.resultJoinMatched ?? null,
      resultPayloadSchemaValid: root.resultPayloadSchemaValid ?? null,
      gradingRecordProduced: root.gradingRecordProduced ?? null,
      gradingSchemaValid: root.gradingSchemaValid ?? null,
    }) as MLBShadowMonitoringOperationalRecord,
  };
}
