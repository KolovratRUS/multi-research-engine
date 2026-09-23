/* -------------------------------------------------------------------------- */
/*  Contract versions                                                          */
/* -------------------------------------------------------------------------- */

export const MLB_SHADOW_MONITORING_QUARANTINE_CONTRACT_VERSION =
  'mlb-shadow-monitoring-quarantine-v1' as const;

export const MLB_SHADOW_MONITORING_QUARANTINE_PREDICTION_CONTRACT_VERSION =
  'mlb-shadow-monitoring-quarantine-prediction-v1' as const;

export const MLB_SHADOW_MONITORING_QUARANTINE_OUTCOME_CONTRACT_VERSION =
  'mlb-shadow-monitoring-quarantine-outcome-v1' as const;

export const MLB_SHADOW_MONITORING_QUARANTINE_GRADING_CONTRACT_VERSION =
  'mlb-shadow-monitoring-quarantine-grading-v1' as const;

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

export type MLBShadowQuarantinedPredictionPayload = Readonly<{
  shadowRecordId: string;
  gamePk: number;
  predictedWinner: 'HOME' | 'AWAY';
  predictedSide: 'HOME' | 'AWAY';
  homeWinProbability: number;
  awayWinProbability: number;
  decisionPolicy: string;
  predictionGeneratedAt: string;
  payloadHash: string;
}>;

export type MLBShadowQuarantinedOutcomePayload = Readonly<{
  shadowRecordId: string;
  gamePk: number;
  officialWinner: 'HOME' | 'AWAY';
  winningTeamId: string;
  homeScore: number;
  awayScore: number;
  resultObservedAt: string;
  payloadHash: string;
}>;

export type MLBShadowQuarantinedGradingPayload = Readonly<{
  shadowRecordId: string;
  gamePk: number;
  candidateCorrectness: boolean;
  logLossContribution: number;
  brierContribution: number;
  gradedAt: string;
}>;

export type MLBShadowQuarantineValidationIssue = Readonly<{
  code:
    | 'NOT_PLAIN_OBJECT'
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'INVALID_STRING'
    | 'INVALID_INTEGER'
    | 'INVALID_NUMBER'
    | 'INVALID_BOOLEAN'
    | 'INVALID_LITERAL'
    | 'INVALID_TIMESTAMP'
    | 'INVALID_HASH'
    | 'INVALID_PROBABILITY'
    | 'INVALID_JSON_VALUE';
  path: string;
  message: string;
}>;

export type MLBShadowQuarantineValidationResult<T> =
  | Readonly<{
      ok: true;
      value: T;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBShadowQuarantineValidationIssue[];
    }>;

/* -------------------------------------------------------------------------- */
/*  Structural helpers                                                         */
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
  issues: MLBShadowQuarantineValidationIssue[],
  code: MLBShadowQuarantineValidationIssue['code'],
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
  issues: MLBShadowQuarantineValidationIssue[],
): readonly MLBShadowQuarantineValidationIssue[] {
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

function ownDataProperty(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBShadowQuarantineValidationIssue[],
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

const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

function isValidHash(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed !== value) return false;
  return SHA256_HEX_RE.test(trimmed);
}

function isPositiveInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isProbability(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

/* -------------------------------------------------------------------------- */
/*  Prediction payload fields + validator                                     */
/* -------------------------------------------------------------------------- */

const PREDICTION_FIELDS = [
  'shadowRecordId',
  'gamePk',
  'predictedWinner',
  'predictedSide',
  'homeWinProbability',
  'awayWinProbability',
  'decisionPolicy',
  'predictionGeneratedAt',
  'payloadHash',
] as const;

const PREDICTION_KNOWN = new Set<string>(PREDICTION_FIELDS);

const VALID_WINNER_SIDE = new Set<'HOME' | 'AWAY'>(['HOME', 'AWAY']);

function validatePredictionPayloadStrict(
  root: Record<string, unknown>,
  issues: MLBShadowQuarantineValidationIssue[],
): MLBShadowQuarantinedPredictionPayload | null {
  // Reject unknown top-level fields
  for (const key of Object.getOwnPropertyNames(root)) {
    const descriptor = Object.getOwnPropertyDescriptor(root, key);
    if (!isDataDescriptor(descriptor)) {
      pushIssue(
        issues,
        'INVALID_JSON_VALUE',
        `$.${key}`,
        `${key} is an accessor property`,
      );
      continue;
    }
    if (!PREDICTION_KNOWN.has(key)) {
      pushIssue(
        issues,
        'UNKNOWN_FIELD',
        `$.${key}`,
        `Unknown field: ${key}`,
      );
    }
  }

  // Reject symbol keys
  for (const symbol of Object.getOwnPropertySymbols(root)) {
    pushIssue(
      issues,
      'UNKNOWN_FIELD',
      `$[${String(symbol)}]`,
      `Symbol property: ${symbol.description ?? symbol.toString()}`,
    );
  }

  // Validate required fields
  const sidResult = ownDataProperty(root, 'shadowRecordId', '$.shadowRecordId', issues);
  if (sidResult.kind !== 'data' || !isStrictNonEmptyTrimmedString(sidResult.value)) {
    if (sidResult.kind === 'data') {
      pushIssue(issues, 'INVALID_STRING', '$.shadowRecordId', 'shadowRecordId must be a non-empty trimmed string');
    }
  }

  const gamePkResult = ownDataProperty(root, 'gamePk', '$.gamePk', issues);
  if (gamePkResult.kind !== 'data' || !isPositiveInteger(gamePkResult.value)) {
    if (gamePkResult.kind === 'data') {
      pushIssue(issues, 'INVALID_INTEGER', '$.gamePk', 'gamePk must be a positive integer');
    }
  }

  const winnerResult = ownDataProperty(root, 'predictedWinner', '$.predictedWinner', issues);
  if (winnerResult.kind === 'data') {
    if (!VALID_WINNER_SIDE.has(winnerResult.value as 'HOME' | 'AWAY')) {
      pushIssue(issues, 'INVALID_LITERAL', '$.predictedWinner', 'predictedWinner must be HOME or AWAY');
    }
  }

  const sideResult = ownDataProperty(root, 'predictedSide', '$.predictedSide', issues);
  if (sideResult.kind === 'data') {
    if (!VALID_WINNER_SIDE.has(sideResult.value as 'HOME' | 'AWAY')) {
      pushIssue(issues, 'INVALID_LITERAL', '$.predictedSide', 'predictedSide must be HOME or AWAY');
    }
  }

  const homeProbResult = ownDataProperty(root, 'homeWinProbability', '$.homeWinProbability', issues);
  if (homeProbResult.kind === 'data' && !isProbability(homeProbResult.value)) {
    pushIssue(issues, 'INVALID_PROBABILITY', '$.homeWinProbability', 'homeWinProbability must be in [0, 1]');
  }

  const awayProbResult = ownDataProperty(root, 'awayWinProbability', '$.awayWinProbability', issues);
  if (awayProbResult.kind === 'data' && !isProbability(awayProbResult.value)) {
    pushIssue(issues, 'INVALID_PROBABILITY', '$.awayWinProbability', 'awayWinProbability must be in [0, 1]');
  }

  const decisionResult = ownDataProperty(root, 'decisionPolicy', '$.decisionPolicy', issues);
  if (decisionResult.kind === 'data' && !isStrictNonEmptyTrimmedString(decisionResult.value)) {
    pushIssue(issues, 'INVALID_STRING', '$.decisionPolicy', 'decisionPolicy must be a non-empty trimmed string');
  }

  const genAtResult = ownDataProperty(root, 'predictionGeneratedAt', '$.predictionGeneratedAt', issues);
  if (genAtResult.kind === 'data' && !isValidTimestamp(genAtResult.value)) {
    pushIssue(issues, 'INVALID_TIMESTAMP', '$.predictionGeneratedAt', 'predictionGeneratedAt must be a valid RFC 3339 timestamp');
  }

  const hashResult = ownDataProperty(root, 'payloadHash', '$.payloadHash', issues);
  if (hashResult.kind === 'data' && !isValidHash(hashResult.value)) {
    pushIssue(issues, 'INVALID_HASH', '$.payloadHash', 'payloadHash must be a 64-character lowercase hex string');
  }

  if (
    sidResult.kind !== 'data' ||
    gamePkResult.kind !== 'data' ||
    winnerResult.kind !== 'data' ||
    sideResult.kind !== 'data' ||
    homeProbResult.kind !== 'data' ||
    awayProbResult.kind !== 'data' ||
    decisionResult.kind !== 'data' ||
    genAtResult.kind !== 'data' ||
    hashResult.kind !== 'data'
  ) {
    return null;
  }

  if (issues.length > 0) {
    return null;
  }

  return {
    shadowRecordId: sidResult.value as string,
    gamePk: gamePkResult.value as number,
    predictedWinner: winnerResult.value as 'HOME' | 'AWAY',
    predictedSide: sideResult.value as 'HOME' | 'AWAY',
    homeWinProbability: homeProbResult.value as number,
    awayWinProbability: awayProbResult.value as number,
    decisionPolicy: decisionResult.value as string,
    predictionGeneratedAt: genAtResult.value as string,
    payloadHash: hashResult.value as string,
  };
}

/* -------------------------------------------------------------------------- */
/*  Outcome payload fields + validator                                        */
/* -------------------------------------------------------------------------- */

const OUTCOME_FIELDS = [
  'shadowRecordId',
  'gamePk',
  'officialWinner',
  'winningTeamId',
  'homeScore',
  'awayScore',
  'resultObservedAt',
  'payloadHash',
] as const;

const OUTCOME_KNOWN = new Set<string>(OUTCOME_FIELDS);

function validateOutcomePayloadStrict(
  root: Record<string, unknown>,
  issues: MLBShadowQuarantineValidationIssue[],
): MLBShadowQuarantinedOutcomePayload | null {
  for (const key of Object.getOwnPropertyNames(root)) {
    const descriptor = Object.getOwnPropertyDescriptor(root, key);
    if (!isDataDescriptor(descriptor)) {
      pushIssue(
        issues,
        'INVALID_JSON_VALUE',
        `$.${key}`,
        `${key} is an accessor property`,
      );
      continue;
    }
    if (!OUTCOME_KNOWN.has(key)) {
      pushIssue(
        issues,
        'UNKNOWN_FIELD',
        `$.${key}`,
        `Unknown field: ${key}`,
      );
    }
  }

  for (const symbol of Object.getOwnPropertySymbols(root)) {
    pushIssue(
      issues,
      'UNKNOWN_FIELD',
      `$[${String(symbol)}]`,
      `Symbol property: ${symbol.description ?? symbol.toString()}`,
    );
  }

  const sidResult = ownDataProperty(root, 'shadowRecordId', '$.shadowRecordId', issues);
  if (sidResult.kind !== 'data' || !isStrictNonEmptyTrimmedString(sidResult.value)) {
    if (sidResult.kind === 'data') {
      pushIssue(issues, 'INVALID_STRING', '$.shadowRecordId', 'shadowRecordId must be a non-empty trimmed string');
    }
  }

  const gamePkResult = ownDataProperty(root, 'gamePk', '$.gamePk', issues);
  if (gamePkResult.kind !== 'data' || !isPositiveInteger(gamePkResult.value)) {
    if (gamePkResult.kind === 'data') {
      pushIssue(issues, 'INVALID_INTEGER', '$.gamePk', 'gamePk must be a positive integer');
    }
  }

  const winnerResult = ownDataProperty(root, 'officialWinner', '$.officialWinner', issues);
  if (winnerResult.kind === 'data') {
    if (!VALID_WINNER_SIDE.has(winnerResult.value as 'HOME' | 'AWAY')) {
      pushIssue(issues, 'INVALID_LITERAL', '$.officialWinner', 'officialWinner must be HOME or AWAY');
    }
  }

  const winnerTeamResult = ownDataProperty(root, 'winningTeamId', '$.winningTeamId', issues);
  if (winnerTeamResult.kind === 'data' && !isStrictNonEmptyTrimmedString(winnerTeamResult.value)) {
    pushIssue(issues, 'INVALID_STRING', '$.winningTeamId', 'winningTeamId must be a non-empty trimmed string');
  }

  const homeScoreResult = ownDataProperty(root, 'homeScore', '$.homeScore', issues);
  if (homeScoreResult.kind !== 'data' || !isNonNegativeInteger(homeScoreResult.value)) {
    if (homeScoreResult.kind === 'data') {
      pushIssue(issues, 'INVALID_INTEGER', '$.homeScore', 'homeScore must be a non-negative integer');
    }
  }

  const awayScoreResult = ownDataProperty(root, 'awayScore', '$.awayScore', issues);
  if (awayScoreResult.kind !== 'data' || !isNonNegativeInteger(awayScoreResult.value)) {
    if (awayScoreResult.kind === 'data') {
      pushIssue(issues, 'INVALID_INTEGER', '$.awayScore', 'awayScore must be a non-negative integer');
    }
  }

  const observedResult = ownDataProperty(root, 'resultObservedAt', '$.resultObservedAt', issues);
  if (observedResult.kind === 'data' && !isValidTimestamp(observedResult.value)) {
    pushIssue(issues, 'INVALID_TIMESTAMP', '$.resultObservedAt', 'resultObservedAt must be a valid RFC 3339 timestamp');
  }

  const hashResult = ownDataProperty(root, 'payloadHash', '$.payloadHash', issues);
  if (hashResult.kind === 'data' && !isValidHash(hashResult.value)) {
    pushIssue(issues, 'INVALID_HASH', '$.payloadHash', 'payloadHash must be a 64-character lowercase hex string');
  }

  if (
    sidResult.kind !== 'data' ||
    gamePkResult.kind !== 'data' ||
    winnerResult.kind !== 'data' ||
    winnerTeamResult.kind !== 'data' ||
    homeScoreResult.kind !== 'data' ||
    awayScoreResult.kind !== 'data' ||
    observedResult.kind !== 'data' ||
    hashResult.kind !== 'data'
  ) {
    return null;
  }

  if (issues.length > 0) {
    return null;
  }

  return {
    shadowRecordId: sidResult.value as string,
    gamePk: gamePkResult.value as number,
    officialWinner: winnerResult.value as 'HOME' | 'AWAY',
    winningTeamId: winnerTeamResult.value as string,
    homeScore: homeScoreResult.value as number,
    awayScore: awayScoreResult.value as number,
    resultObservedAt: observedResult.value as string,
    payloadHash: hashResult.value as string,
  };
}

/* -------------------------------------------------------------------------- */
/*  Grading payload fields + validator                                       */
/* -------------------------------------------------------------------------- */

const GRADING_FIELDS = [
  'shadowRecordId',
  'gamePk',
  'candidateCorrectness',
  'logLossContribution',
  'brierContribution',
  'gradedAt',
] as const;

const GRADING_KNOWN = new Set<string>(GRADING_FIELDS);

function validateGradingPayloadStrict(
  root: Record<string, unknown>,
  issues: MLBShadowQuarantineValidationIssue[],
): MLBShadowQuarantinedGradingPayload | null {
  for (const key of Object.getOwnPropertyNames(root)) {
    const descriptor = Object.getOwnPropertyDescriptor(root, key);
    if (!isDataDescriptor(descriptor)) {
      pushIssue(
        issues,
        'INVALID_JSON_VALUE',
        `$.${key}`,
        `${key} is an accessor property`,
      );
      continue;
    }
    if (!GRADING_KNOWN.has(key)) {
      pushIssue(
        issues,
        'UNKNOWN_FIELD',
        `$.${key}`,
        `Unknown field: ${key}`,
      );
    }
  }

  for (const symbol of Object.getOwnPropertySymbols(root)) {
    pushIssue(
      issues,
      'UNKNOWN_FIELD',
      `$[${String(symbol)}]`,
      `Symbol property: ${symbol.description ?? symbol.toString()}`,
    );
  }

  const sidResult = ownDataProperty(root, 'shadowRecordId', '$.shadowRecordId', issues);
  if (sidResult.kind !== 'data' || !isStrictNonEmptyTrimmedString(sidResult.value)) {
    if (sidResult.kind === 'data') {
      pushIssue(issues, 'INVALID_STRING', '$.shadowRecordId', 'shadowRecordId must be a non-empty trimmed string');
    }
  }

  const gamePkResult = ownDataProperty(root, 'gamePk', '$.gamePk', issues);
  if (gamePkResult.kind !== 'data' || !isPositiveInteger(gamePkResult.value)) {
    if (gamePkResult.kind === 'data') {
      pushIssue(issues, 'INVALID_INTEGER', '$.gamePk', 'gamePk must be a positive integer');
    }
  }

  const correctResult = ownDataProperty(root, 'candidateCorrectness', '$.candidateCorrectness', issues);
  if (correctResult.kind !== 'data' || typeof correctResult.value !== 'boolean') {
    if (correctResult.kind === 'data') {
      pushIssue(issues, 'INVALID_BOOLEAN', '$.candidateCorrectness', 'candidateCorrectness must be a boolean');
    }
  }

  const logLossResult = ownDataProperty(root, 'logLossContribution', '$.logLossContribution', issues);
  if (logLossResult.kind === 'data' && !isFiniteNumber(logLossResult.value)) {
    pushIssue(issues, 'INVALID_NUMBER', '$.logLossContribution', 'logLossContribution must be a finite number');
  }

  const brierResult = ownDataProperty(root, 'brierContribution', '$.brierContribution', issues);
  if (brierResult.kind === 'data' && !isFiniteNumber(brierResult.value)) {
    pushIssue(issues, 'INVALID_NUMBER', '$.brierContribution', 'brierContribution must be a finite number');
  }

  const gradedAtResult = ownDataProperty(root, 'gradedAt', '$.gradedAt', issues);
  if (gradedAtResult.kind === 'data' && !isValidTimestamp(gradedAtResult.value)) {
    pushIssue(issues, 'INVALID_TIMESTAMP', '$.gradedAt', 'gradedAt must be a valid RFC 3339 timestamp');
  }

  if (
    sidResult.kind !== 'data' ||
    gamePkResult.kind !== 'data' ||
    correctResult.kind !== 'data' ||
    logLossResult.kind !== 'data' ||
    brierResult.kind !== 'data' ||
    gradedAtResult.kind !== 'data'
  ) {
    return null;
  }

  if (issues.length > 0) {
    return null;
  }

  return {
    shadowRecordId: sidResult.value as string,
    gamePk: gamePkResult.value as number,
    candidateCorrectness: correctResult.value as boolean,
    logLossContribution: logLossResult.value as number,
    brierContribution: brierResult.value as number,
    gradedAt: gradedAtResult.value as string,
  };
}

/* -------------------------------------------------------------------------- */
/*  Public validators                                                          */
/* -------------------------------------------------------------------------- */

export function validateMLBShadowQuarantinedPredictionPayload(
  value: unknown,
): MLBShadowQuarantineValidationResult<MLBShadowQuarantinedPredictionPayload> {
  const issues: MLBShadowQuarantineValidationIssue[] = [];

  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$', 'Expected a plain object');
    return { ok: false, issues: sortIssues(issues) };
  }

  const root = value as Record<string, unknown>;
  const validated = validatePredictionPayloadStrict(root, issues);

  if (issues.length > 0 || validated === null) {
    return { ok: false, issues: sortIssues(issues) };
  }

  return { ok: true, value: validated };
}

export function validateMLBShadowQuarantinedOutcomePayload(
  value: unknown,
): MLBShadowQuarantineValidationResult<MLBShadowQuarantinedOutcomePayload> {
  const issues: MLBShadowQuarantineValidationIssue[] = [];

  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$', 'Expected a plain object');
    return { ok: false, issues: sortIssues(issues) };
  }

  const root = value as Record<string, unknown>;
  const validated = validateOutcomePayloadStrict(root, issues);

  if (issues.length > 0 || validated === null) {
    return { ok: false, issues: sortIssues(issues) };
  }

  return { ok: true, value: validated };
}

export function validateMLBShadowQuarantinedGradingPayload(
  value: unknown,
): MLBShadowQuarantineValidationResult<MLBShadowQuarantinedGradingPayload> {
  const issues: MLBShadowQuarantineValidationIssue[] = [];

  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$', 'Expected a plain object');
    return { ok: false, issues: sortIssues(issues) };
  }

  const root = value as Record<string, unknown>;
  const validated = validateGradingPayloadStrict(root, issues);

  if (issues.length > 0 || validated === null) {
    return { ok: false, issues: sortIssues(issues) };
  }

  return { ok: true, value: validated };
}
