import {
  assertNoOddsContamination,
} from '../firewall/odds-contamination-guard';

export const MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION =
  'mlb-canonical-pregame-snapshot-v1' as const;

export type MLBPregameGameType =
  | 'REGULAR_SEASON'
  | 'POSTSEASON'
  | 'SPRING_TRAINING'
  | 'ALL_STAR'
  | 'OTHER';

export type MLBPregameGameStatus =
  | 'SCHEDULED'
  | 'PRE_GAME'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'UNKNOWN';

export type MLBPregameDataCompleteness =
  | 'COMPLETE'
  | 'PARTIAL'
  | 'INSUFFICIENT';

export type MLBPregameSectionStatus =
  | 'AVAILABLE'
  | 'PARTIAL'
  | 'UNAVAILABLE'
  | 'UNCONFIRMED'
  | 'NOT_APPLICABLE';

export type MLBStartingPitcherSnapshotState =
  | 'CONFIRMED'
  | 'PROBABLE'
  | 'UNCONFIRMED'
  | 'UNAVAILABLE';

export type MLBPregameSourceCategory =
  | 'OFFICIAL'
  | 'SUPPLEMENTAL'
  | 'WEATHER'
  | 'INTERNAL_DERIVED';

export type MLBPregameSourceRole =
  | 'GAME_IDENTITY'
  | 'TEAM_PLAYER_IDENTITY'
  | 'STARTING_PITCHER'
  | 'LINEUP_ROSTER'
  | 'TEAM_STATS'
  | 'PITCHER_STATS'
  | 'ADVANCED_METRICS'
  | 'BULLPEN'
  | 'SCHEDULE_CONTEXT'
  | 'VENUE_PARK'
  | 'WEATHER';

export type MLBPregameSectionKind =
  | 'GAME_CONTEXT'
  | 'TEAM_RECENT_FORM'
  | 'TEAM_SEASON_CONTEXT'
  | 'TEAM_QUALITY'
  | 'STARTING_PITCHER_CONTEXT'
  | 'BULLPEN_CONTEXT'
  | 'LINEUP_CONTEXT'
  | 'ROSTER_AVAILABILITY'
  | 'SCHEDULE_REST_TRAVEL'
  | 'VENUE_PARK_CONTEXT'
  | 'WEATHER_CONTEXT';

export type MLBPregameEntityScope =
  | 'GAME'
  | 'HOME_TEAM'
  | 'AWAY_TEAM'
  | 'HOME_STARTER'
  | 'AWAY_STARTER'
  | 'VENUE';

export type MLBPregameSourceReference = Readonly<{
  sourceRefId: string;
  sourceName: string;
  sourceCategory: MLBPregameSourceCategory;
  roles: readonly MLBPregameSourceRole[];
  providerRecordId: string | null;
  fetchedAt: string;
  sourceUpdatedAt: string | null;
}>;

export type MLBPregameStartingPitcherSnapshot = Readonly<{
  state: MLBStartingPitcherSnapshotState;
  pitcherId: string | null;
  announcedAt: string | null;
  sourceRefIds: readonly string[];
}>;

export type MLBPregameSnapshotSection = Readonly<{
  sectionId: string;
  kind: MLBPregameSectionKind;
  entity: Readonly<{
    scope: MLBPregameEntityScope;
    entityId: string | null;
  }>;
  status: MLBPregameSectionStatus;
  asOfAt: string;
  sourceRefIds: readonly string[];
  payload: Readonly<Record<string, unknown>>;
}>;

export type MLBPregameSnapshotWarning = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

export type MLBCanonicalPregameSnapshot = Readonly<{
  contractVersion: 'mlb-canonical-pregame-snapshot-v1';
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  snapshotId: string;
  capturedAt: string;
  dataCutoffAt: string;
  game: Readonly<{
    gameId: string;
    scheduledStartAt: string;
    officialDate: string;
    season: number;
    gameType: MLBPregameGameType;
    status: MLBPregameGameStatus;
    homeTeamId: string;
    awayTeamId: string;
    venueId: string | null;
    neutralSite: boolean;
    doubleheader: null | Readonly<{
      doubleheaderId: string;
      gameNumber: 1 | 2;
    }>;
  }>;
  startingPitchers: Readonly<{
    home: MLBPregameStartingPitcherSnapshot;
    away: MLBPregameStartingPitcherSnapshot;
  }>;
  sourceReferences: readonly MLBPregameSourceReference[];
  sections: readonly MLBPregameSnapshotSection[];
  dataCompleteness: MLBPregameDataCompleteness;
  warnings: readonly MLBPregameSnapshotWarning[];
}>;

export type MLBPregameSnapshotValidationIssue = Readonly<{
  code:
    | 'NOT_PLAIN_OBJECT'
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'INVALID_LITERAL'
    | 'INVALID_STRING'
    | 'INVALID_BOOLEAN'
    | 'INVALID_INTEGER'
    | 'INVALID_DATE'
    | 'INVALID_TIMESTAMP'
    | 'INVALID_TIMESTAMP_ORDER'
    | 'DUPLICATE_ID'
    | 'DUPLICATE_TEAM'
    | 'INVALID_DOUBLEHEADER'
    | 'INVALID_SOURCE_REFERENCE'
    | 'INVALID_STARTING_PITCHER'
    | 'INVALID_SECTION'
    | 'INVALID_JSON_VALUE'
    | 'NON_CANONICAL_ORDER'
    | 'ODDS_CONTAMINATION'
    | 'PROVIDER_SPECIFIC_PAYLOAD_FIELD'
    | 'PREDICTION_OUTPUT_FIELD'
    | 'TARGET_GAME_OUTCOME_FIELD';
  path: string;
  message: string;
}>;

const VALID_GAME_TYPES = new Set<string>([
  'REGULAR_SEASON',
  'POSTSEASON',
  'SPRING_TRAINING',
  'ALL_STAR',
  'OTHER',
]);

const VALID_GAME_STATUSES = new Set<string>([
  'SCHEDULED',
  'PRE_GAME',
  'POSTPONED',
  'CANCELLED',
  'UNKNOWN',
]);

const VALID_DATA_COMPLETENESS = new Set<string>([
  'COMPLETE',
  'PARTIAL',
  'INSUFFICIENT',
]);

const VALID_SECTION_STATUSES = new Set<string>([
  'AVAILABLE',
  'PARTIAL',
  'UNAVAILABLE',
  'UNCONFIRMED',
  'NOT_APPLICABLE',
]);

const VALID_PITCHER_STATES = new Set<string>([
  'CONFIRMED',
  'PROBABLE',
  'UNCONFIRMED',
  'UNAVAILABLE',
]);

const VALID_SOURCE_CATEGORIES = new Set<string>([
  'OFFICIAL',
  'SUPPLEMENTAL',
  'WEATHER',
  'INTERNAL_DERIVED',
]);

const VALID_SOURCE_ROLES = new Set<string>([
  'GAME_IDENTITY',
  'TEAM_PLAYER_IDENTITY',
  'STARTING_PITCHER',
  'LINEUP_ROSTER',
  'TEAM_STATS',
  'PITCHER_STATS',
  'ADVANCED_METRICS',
  'BULLPEN',
  'SCHEDULE_CONTEXT',
  'VENUE_PARK',
  'WEATHER',
]);

const VALID_SECTION_KINDS = new Set<string>([
  'GAME_CONTEXT',
  'TEAM_RECENT_FORM',
  'TEAM_SEASON_CONTEXT',
  'TEAM_QUALITY',
  'STARTING_PITCHER_CONTEXT',
  'BULLPEN_CONTEXT',
  'LINEUP_CONTEXT',
  'ROSTER_AVAILABILITY',
  'SCHEDULE_REST_TRAVEL',
  'VENUE_PARK_CONTEXT',
  'WEATHER_CONTEXT',
]);

const VALID_ENTITY_SCOPES = new Set<string>([
  'GAME',
  'HOME_TEAM',
  'AWAY_TEAM',
  'HOME_STARTER',
  'AWAY_STARTER',
  'VENUE',
]);

const PROVIDER_SPECIFIC_KEYS = new Set<string>([
  'providerName',
  'providerRecordId',
  'rawResponse',
  'rawPayload',
  'requestUrl',
  'requestEndpoint',
  'apiKey',
  'accessToken',
  'refreshToken',
  'authorization',
  'authorizationHeader',
  'cookie',
  'clientSecret',
]);

const PREDICTION_OUTPUT_KEYS = new Set<string>([
  'modelProbability',
  'rawModelProbability',
  'calibratedProbability',
  'homeWinProbability',
  'awayWinProbability',
  'predictedWinnerId',
  'predictedWinner',
  'selectionStatus',
  'recommendation',
  'recommendedSelection',
  'multiId',
  'recommendedUnits',
  'stake',
  'staking',
  'gradingStatus',
  'actualWinnerId',
]);

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

const KNOWN_ROOT_FIELDS = new Set<string>([
  'contractVersion',
  'sport',
  'target',
  'snapshotId',
  'capturedAt',
  'dataCutoffAt',
  'game',
  'startingPitchers',
  'sourceReferences',
  'sections',
  'dataCompleteness',
  'warnings',
]);

function addUniqueIssue(
  issues: MLBPregameSnapshotValidationIssue[],
  next: MLBPregameSnapshotValidationIssue,
): void {
  const exists = issues.some(
    (item) => item.path === next.path && item.code === next.code,
  );
  if (!exists) {
    issues.push(next);
  }
}

function pushIssue(
  code: MLBPregameSnapshotValidationIssue['code'],
  path: string,
  message: string,
  issues: MLBPregameSnapshotValidationIssue[],
): void {
  addUniqueIssue(issues, { code, path, message });
}

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F]/;

function isStrictNonEmptyTrimmedString(
  value: unknown,
): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    !CONTROL_CHARACTER_PATTERN.test(value)
  );
}

function validateIdentifier(
  value: unknown,
  path: string,
  label: string,
): string | MLBPregameSnapshotValidationIssue {
  if (!isStrictNonEmptyTrimmedString(value)) {
    return { code: 'INVALID_STRING', path, message: `${label} must be a valid identifier` };
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function getDataProperty(value: unknown, key: string): unknown {
  if (!isPlainObject(value)) {
    return undefined;
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return isDataDescriptor(descriptor) ? descriptor.value : undefined;
}

function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & {
  value: unknown;
} {
  return !!descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value');
}

function readContractArray(
  value: unknown,
  path: string,
  issues: MLBPregameSnapshotValidationIssue[],
): unknown[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const ownNames = Object.getOwnPropertyNames(value);
  const ownSymbols = Object.getOwnPropertySymbols(value);
  const numericIndices: number[] = [];
  let maxIndex = -1;

  for (const key of ownNames) {
    if (key === 'length') {
      continue;
    }
    if (/^\d+$/.test(key)) {
      const index = Number(key);
      numericIndices.push(index);
      if (index > maxIndex) maxIndex = index;
    } else {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && !isDataDescriptor(descriptor)) {
        pushIssue('INVALID_JSON_VALUE', `${path}.${key}`, `Array contains accessor property: ${key}`, issues);
      } else {
        pushIssue('INVALID_JSON_VALUE', `${path}.${key}`, `Array contains additional property: ${key}`, issues);
      }
    }
  }

  for (const symbol of ownSymbols) {
    const descriptor = Object.getOwnPropertyDescriptor(value, symbol);
    if (descriptor && !isDataDescriptor(descriptor)) {
      pushIssue('INVALID_JSON_VALUE', `${path}[Symbol(${String(symbol.description ?? '')})]`, 'Array contains accessor property', issues);
    } else {
      pushIssue('INVALID_JSON_VALUE', `${path}[Symbol(${String(symbol.description ?? '')})]`, 'Array contains symbol property', issues);
    }
  }

  if (maxIndex < 0) {
    return [];
  }

  const result = new Array<unknown>(maxIndex + 1);
  for (const index of numericIndices) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor) continue;
    if (!isDataDescriptor(descriptor)) {
      pushIssue('INVALID_JSON_VALUE', `${path}[${index}]`, 'Array contains accessor property', issues);
    } else {
      result[index] = descriptor.value;
    }
  }

  return result;
}

type OwnDataPropertyResult =
  | Readonly<{ kind: 'missing' }>
  | Readonly<{ kind: 'accessor' }>
  | Readonly<{ kind: 'data'; value: unknown }>;

function ownDataProperty(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBPregameSnapshotValidationIssue[],
): OwnDataPropertyResult {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (!descriptor) {
    return { kind: 'missing' };
  }
  if (!isDataDescriptor(descriptor)) {
    pushIssue('INVALID_JSON_VALUE', path, `Snapshot contains an accessor property: ${key}`, issues);
    return { kind: 'accessor' };
  }
  return { kind: 'data', value: descriptor.value };
}

function validatePlainObject(value: unknown): Record<string, unknown> | null {
  if (isPlainObject(value)) {
    return value;
  }
  return null;
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
): number | MLBPregameSnapshotValidationIssue {
  if (typeof value !== 'string' || !timestampRegex(value)) {
    return { code: 'INVALID_TIMESTAMP', path, message: `${label} must be an RFC-3339 timestamp` };
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    return { code: 'INVALID_TIMESTAMP', path, message: `${label} must be a finite timestamp` };
  }
  return ms;
}

function timestampOrdered(
  earlier: number | MLBPregameSnapshotValidationIssue,
  later: number | MLBPregameSnapshotValidationIssue,
): boolean {
  return typeof earlier === 'number' && typeof later === 'number' && earlier <= later;
}

function isValidGregorianDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validateJsonLike(
  value: unknown,
  path: string,
  issues: MLBPregameSnapshotValidationIssue[],
  visited: WeakSet<object>,
): void {
  if (value === null) return;
  if (typeof value === 'string') return;
  if (typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      pushIssue('INVALID_JSON_VALUE', path, 'Payload contains a non-finite number', issues);
    }
    return;
  }
  if (Array.isArray(value)) {
    validateArrayJsonLike(value, path, issues, visited);
    return;
  }
  if (isPlainObject(value)) {
    validateObjectJsonLike(value, path, issues, visited);
    return;
  }
  pushIssue('INVALID_JSON_VALUE', path, 'Payload is not a JSON-like value', issues);
}

function validateArrayJsonLike(
  value: unknown[],
  path: string,
  issues: MLBPregameSnapshotValidationIssue[],
  visited: WeakSet<object>,
): void {
  if (visited.has(value)) {
    pushIssue('INVALID_JSON_VALUE', path, 'Payload contains a cyclic structure', issues);
    return;
  }
  visited.add(value);
  try {
    const keys = [
      ...Object.getOwnPropertyNames(value),
      ...Object.getOwnPropertySymbols(value),
    ];
    for (const rawKey of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, rawKey);
      if (!descriptor) continue;
      const strKey = String(rawKey);
      if (!isDataDescriptor(descriptor)) {
        pushIssue('INVALID_JSON_VALUE', `${path}[${strKey}]`, 'Payload contains an accessor property', issues);
        continue;
      }
      if (typeof rawKey === 'symbol') {
        pushIssue('INVALID_JSON_VALUE', `${path}[Symbol(${String(rawKey.description ?? '')})]`, 'Payload contains a symbol property', issues);
        continue;
      }
      validateJsonLike(descriptor.value, `${path}[${rawKey}]`, issues, visited);
    }
  } finally {
    visited.delete(value);
  }
}

function validateObjectJsonLike(
  value: Record<string, unknown>,
  path: string,
  issues: MLBPregameSnapshotValidationIssue[],
  visited: WeakSet<object>,
): void {
  if (visited.has(value)) {
    pushIssue('INVALID_JSON_VALUE', path, 'Payload contains a cyclic structure', issues);
    return;
  }
  visited.add(value);
  try {
    const keys = [
      ...Object.getOwnPropertyNames(value),
      ...Object.getOwnPropertySymbols(value),
    ];
    for (const rawKey of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, rawKey);
      if (!descriptor) continue;
      if (!isDataDescriptor(descriptor)) {
        const suffix = typeof rawKey === 'symbol' ? `[Symbol(${String(rawKey.description ?? '')})]` : `.${rawKey}`;
        pushIssue('INVALID_JSON_VALUE', `${path}${suffix}`, 'Payload contains an accessor property', issues);
        continue;
      }
      if (typeof rawKey === 'symbol') {
        pushIssue('INVALID_JSON_VALUE', `${path}[Symbol(${String(rawKey.description ?? '')})]`, 'Payload contains a symbol property', issues);
        continue;
      }
      validateJsonLike(descriptor.value, `${path}.${rawKey}`, issues, visited);
    }
  } finally {
    visited.delete(value);
  }
}

function validateProviderSpecificPayloadKeys(
  value: unknown,
  path: string,
  issues: MLBPregameSnapshotValidationIssue[],
  visited: WeakSet<object>,
): void {
  if (Array.isArray(value)) {
    if (visited.has(value)) return;
    visited.add(value);
    try {
      const keys = Object.getOwnPropertyNames(value);
      for (const rawKey of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(value, rawKey);
        if (!descriptor || !isDataDescriptor(descriptor)) continue;
        if (typeof rawKey === 'number' || /^\d+$/.test(String(rawKey))) {
          validateProviderSpecificPayloadKeys(descriptor.value, `${path}[${rawKey}]`, issues, visited);
        }
      }
    } finally {
      visited.delete(value);
    }
    return;
  }
  if (!isPlainObject(value)) return;
  if (visited.has(value)) return;
  visited.add(value);
  try {
    const keys = Object.getOwnPropertyNames(value);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !isDataDescriptor(descriptor)) continue;
      const valuePath = `${path}.${key}`;
      if (PROVIDER_SPECIFIC_KEYS.has(key)) {
        pushIssue('PROVIDER_SPECIFIC_PAYLOAD_FIELD', valuePath, `Payload contains provider-specific key: ${key}`, issues);
        continue;
      }
      if (PREDICTION_OUTPUT_KEYS.has(key)) {
        pushIssue('PREDICTION_OUTPUT_FIELD', valuePath, `Payload contains prediction-output key: ${key}`, issues);
        continue;
      }
      if (TARGET_GAME_OUTCOME_FIELDS.has(key) && path === '$.game') {
        pushIssue('TARGET_GAME_OUTCOME_FIELD', valuePath, `Game object contains prohibited outcome field: ${key}`, issues);
        continue;
      }
      validateProviderSpecificPayloadKeys(descriptor.value, valuePath, issues, visited);
    }
  } finally {
    visited.delete(value);
  }
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a === b ? 0 : 1;
}

function sortIssues(
  issues: MLBPregameSnapshotValidationIssue[],
): MLBPregameSnapshotValidationIssue[] {
  const sorted = issues
    .slice()
    .sort((a, b) => {
      const pathDiff = compareStrings(a.path, b.path);
      if (pathDiff !== 0) return pathDiff;
      return compareStrings(a.code, b.code);
    })
    .filter((item, index, array) => {
      if (index === 0) return true;
      const previous = array[index - 1];
      return item.path !== previous.path || item.code !== previous.code;
    });
  return sorted;
}

function validateOrder(
  items: readonly unknown[],
  keyOf: (item: unknown) => string | number,
  issueCode: MLBPregameSnapshotValidationIssue['code'],
  basePath: string,
  label: string,
  issues: MLBPregameSnapshotValidationIssue[],
): void {
  let previous: string | number | null = null;
  for (const item of items) {
    const current = keyOf(item);
    if (previous !== null && current < previous) {
      pushIssue(issueCode, basePath, `${label} must be in ascending order`, issues);
      break;
    }
    previous = current;
  }
}

function addKnownFieldIssues(
  record: Record<string, unknown>,
  known: Set<string>,
  path: string,
  issues: MLBPregameSnapshotValidationIssue[],
): void {
  const names = Object.getOwnPropertyNames(record);
  for (const key of names) {
    if (!known.has(key)) {
      pushIssue('UNKNOWN_FIELD', `${path}.${key}`, `Unknown field: ${key}`, issues);
    }
  }
  const symbols = Object.getOwnPropertySymbols(record);
  for (const symbol of symbols) {
    pushIssue('UNKNOWN_FIELD', `${path}[${String(symbol)}]`, `Unknown symbol property: ${symbol.description ?? symbol.toString()}`, issues);
  }
}

function validateSectionPayload(
  payload: unknown,
  path: string,
  issues: MLBPregameSnapshotValidationIssue[],
): void {
  const visited = new WeakSet<object>();
  validateJsonLike(payload, path, issues, visited);
  validateProviderSpecificPayloadKeys(payload, path, issues, visited);
}

function pushUniquePathCode(
  issues: MLBPregameSnapshotValidationIssue[],
  next: MLBPregameSnapshotValidationIssue,
): void {
  const exists = issues.some((item) => item.path === next.path && item.code === next.code);
  if (!exists) {
    issues.push(next);
  }
}

function validateGame(
  game: Record<string, unknown>,
  capturedAtMs: number | MLBPregameSnapshotValidationIssue,
  issues: MLBPregameSnapshotValidationIssue[],
): void {
  const gameIdResult = ownDataProperty(game, 'gameId', '$.game.gameId', issues);
  if (gameIdResult.kind === 'missing') {
    pushIssue('MISSING_FIELD', '$.game.gameId', 'gameId is required', issues);
  } else if (gameIdResult.kind === 'data') {
    const gameId = validateIdentifier(gameIdResult.value, '$.game.gameId', 'gameId');
    if (typeof gameId !== 'string') {
      pushIssue('INVALID_STRING', '$.game.gameId', 'gameId must be a valid identifier', issues);
    }
  }

  const scheduledStartAtResult = ownDataProperty(game, 'scheduledStartAt', '$.game.scheduledStartAt', issues);
  if (scheduledStartAtResult.kind === 'missing') {
    pushIssue('MISSING_FIELD', '$.game.scheduledStartAt', 'scheduledStartAt is required', issues);
  } else if (scheduledStartAtResult.kind === 'data') {
    const scheduledStartAtMs = parseTimestampToMs(scheduledStartAtResult.value, '$.game.scheduledStartAt', 'scheduledStartAt');
    if (typeof scheduledStartAtMs === 'object') {
      issues.push(scheduledStartAtMs);
    }

    if (
      typeof capturedAtMs === 'number' &&
      typeof scheduledStartAtMs === 'number' &&
      capturedAtMs >= scheduledStartAtMs
    ) {
      pushIssue('INVALID_TIMESTAMP_ORDER', '$.game', 'capturedAt must be < scheduledStartAt', issues);
    }
  }

  const officialDateResult = ownDataProperty(game, 'officialDate', '$.game.officialDate', issues);
  if (officialDateResult.kind === 'missing') {
    pushIssue('MISSING_FIELD', '$.game.officialDate', 'officialDate is required', issues);
  } else if (officialDateResult.kind === 'data') {
    const officialDate = validateIdentifier(officialDateResult.value, '$.game.officialDate', 'officialDate');
    if (typeof officialDate !== 'string') {
      pushIssue('INVALID_STRING', '$.game.officialDate', 'officialDate must be a valid identifier', issues);
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(officialDate)) {
      pushIssue('INVALID_DATE', '$.game.officialDate', 'officialDate must be YYYY-MM-DD', issues);
    } else if (!isValidGregorianDate(officialDate)) {
      pushIssue('INVALID_DATE', '$.game.officialDate', 'officialDate is not a valid calendar date', issues);
    }
  }

  const seasonResult = ownDataProperty(game, 'season', '$.game.season', issues);
  if (seasonResult.kind === 'missing') {
    pushIssue('MISSING_FIELD', '$.game.season', 'season is required', issues);
  } else if (seasonResult.kind === 'data') {
    const season = seasonResult.value;
    if (typeof season !== 'number' || !Number.isFinite(season) || season <= 0 || !Number.isInteger(season)) {
      pushIssue('INVALID_INTEGER', '$.game.season', 'season must be a positive integer', issues);
    }
  }

  const gameTypeResult = ownDataProperty(game, 'gameType', '$.game.gameType', issues);
  if (gameTypeResult.kind === 'missing') {
    pushIssue('MISSING_FIELD', '$.game.gameType', 'gameType is required', issues);
  } else if (gameTypeResult.kind === 'data') {
    const gameType = gameTypeResult.value;
    if (typeof gameType !== 'string' || !VALID_GAME_TYPES.has(gameType)) {
      pushIssue('INVALID_LITERAL', '$.game.gameType', 'gameType must be a valid pregame game type', issues);
    }
  }

  const statusResult = ownDataProperty(game, 'status', '$.game.status', issues);
  if (statusResult.kind === 'missing') {
    pushIssue('MISSING_FIELD', '$.game.status', 'status is required', issues);
  } else if (statusResult.kind === 'data') {
    const status = statusResult.value;
    if (typeof status !== 'string' || !VALID_GAME_STATUSES.has(status)) {
      pushIssue('INVALID_LITERAL', '$.game.status', 'status must be a pregame status', issues);
    }
  }

  const homeTeamIdResult = ownDataProperty(game, 'homeTeamId', '$.game.homeTeamId', issues);
  if (homeTeamIdResult.kind === 'missing') {
    pushIssue('MISSING_FIELD', '$.game.homeTeamId', 'homeTeamId is required', issues);
  } else if (homeTeamIdResult.kind === 'data') {
    const homeTeamId = validateIdentifier(homeTeamIdResult.value, '$.game.homeTeamId', 'homeTeamId');
    if (typeof homeTeamId !== 'string') {
      pushIssue('INVALID_STRING', '$.game.homeTeamId', 'homeTeamId must be a valid identifier', issues);
    }
  }

  const awayTeamIdResult = ownDataProperty(game, 'awayTeamId', '$.game.awayTeamId', issues);
  if (awayTeamIdResult.kind === 'missing') {
    pushIssue('MISSING_FIELD', '$.game.awayTeamId', 'awayTeamId is required', issues);
  } else if (awayTeamIdResult.kind === 'data') {
    const awayTeamId = validateIdentifier(awayTeamIdResult.value, '$.game.awayTeamId', 'awayTeamId');
    if (typeof awayTeamId !== 'string') {
      pushIssue('INVALID_STRING', '$.game.awayTeamId', 'awayTeamId must be a valid identifier', issues);
    }
  }

  if (
    homeTeamIdResult.kind === 'data' &&
    awayTeamIdResult.kind === 'data' &&
    typeof homeTeamIdResult.value === 'string' &&
    typeof awayTeamIdResult.value === 'string' &&
    homeTeamIdResult.value === awayTeamIdResult.value
  ) {
    pushIssue('DUPLICATE_TEAM', '$.game', 'homeTeamId and awayTeamId must differ', issues);
  }

  const venueIdResult = ownDataProperty(game, 'venueId', '$.game.venueId', issues);
  if (venueIdResult.kind === 'missing') {
    pushIssue('MISSING_FIELD', '$.game.venueId', 'venueId is required', issues);
  } else if (venueIdResult.kind === 'data') {
    const rawVenueId = venueIdResult.value;
    if (rawVenueId !== null && typeof rawVenueId !== 'string') {
      pushIssue('INVALID_STRING', '$.game.venueId', 'venueId must be null or a valid identifier', issues);
    } else if (typeof rawVenueId === 'string') {
      const trimmed = validateIdentifier(rawVenueId, '$.game.venueId', 'venueId');
      if (typeof trimmed !== 'string') {
        pushIssue('INVALID_STRING', '$.game.venueId', 'venueId must be a valid identifier', issues);
      }
    }
  }

  const neutralSiteResult = ownDataProperty(game, 'neutralSite', '$.game.neutralSite', issues);
  if (neutralSiteResult.kind === 'missing') {
    pushIssue('MISSING_FIELD', '$.game.neutralSite', 'neutralSite is required', issues);
  } else if (neutralSiteResult.kind === 'data') {
    if (typeof neutralSiteResult.value !== 'boolean') {
      pushIssue('INVALID_BOOLEAN', '$.game.neutralSite', 'neutralSite must be a boolean', issues);
    }
  }

  const doubleheaderResult = ownDataProperty(game, 'doubleheader', '$.game.doubleheader', issues);
  if (doubleheaderResult.kind === 'missing') {
    pushIssue('MISSING_FIELD', '$.game.doubleheader', 'doubleheader is required', issues);
  } else if (doubleheaderResult.kind === 'data') {
    const doubleheader = doubleheaderResult.value;
    if (doubleheader !== null) {
      const dRoot = validatePlainObject(doubleheader);
      if (dRoot === null) {
        pushIssue('NOT_PLAIN_OBJECT', '$.game.doubleheader', 'doubleheader must be null or a plain object', issues);
      } else {
        const dhIdResult = ownDataProperty(dRoot, 'doubleheaderId', '$.game.doubleheader.doubleheaderId', issues);
        if (dhIdResult.kind === 'missing') {
          pushIssue('MISSING_FIELD', '$.game.doubleheader.doubleheaderId', 'doubleheaderId is required', issues);
        } else if (dhIdResult.kind === 'data') {
          const dhId = validateIdentifier(dhIdResult.value, '$.game.doubleheader.doubleheaderId', 'doubleheaderId');
          if (typeof dhId !== 'string') {
            pushIssue('INVALID_STRING', '$.game.doubleheader.doubleheaderId', 'doubleheaderId must be a valid identifier', issues);
          }
        }

        const gameNumberResult = ownDataProperty(dRoot, 'gameNumber', '$.game.doubleheader.gameNumber', issues);
        if (gameNumberResult.kind === 'missing') {
          pushIssue('MISSING_FIELD', '$.game.doubleheader.gameNumber', 'gameNumber is required', issues);
        } else if (gameNumberResult.kind === 'data') {
          const gameNumber = gameNumberResult.value;
          if (gameNumber !== 1 && gameNumber !== 2) {
            pushIssue('INVALID_DOUBLEHEADER', '$.game.doubleheader.gameNumber', 'gameNumber must be 1 or 2', issues);
          }
        }
      }
    }
  }

  addKnownFieldIssues(
    game,
    new Set(['gameId', 'scheduledStartAt', 'officialDate', 'season', 'gameType', 'status', 'homeTeamId', 'awayTeamId', 'venueId', 'neutralSite', 'doubleheader']),
    '$.game',
    issues,
  );

  const gameOwnNames = Object.getOwnPropertyNames(game);
  for (const key of gameOwnNames) {
    if (TARGET_GAME_OUTCOME_FIELDS.has(key)) {
      pushIssue('TARGET_GAME_OUTCOME_FIELD', `$.game.${key}`, `Game object contains prohibited outcome field: ${key}`, issues);
    }
  }
}

function validateStartingPitchers(
  starters: unknown,
  game: Record<string, unknown> | null,
  authorizedIds: Set<string>,
  dataCutoffAtMs: number | MLBPregameSnapshotValidationIssue,
  issues: MLBPregameSnapshotValidationIssue[],
): void {
  if (!isPlainObject(starters)) {
    pushIssue('NOT_PLAIN_OBJECT', '$.startingPitchers', 'startingPitchers must be a plain object', issues);
    return;
  }
  const startersRoot = starters as Record<string, unknown>;

  const homeResult = ownDataProperty(startersRoot, 'home', '$.startingPitchers.home', issues);
  if (homeResult.kind === 'missing') {
    pushIssue('MISSING_FIELD', '$.startingPitchers.home', 'home starter is required', issues);
  } else {
    validateStartingPitcher(homeResult.kind === 'data' ? homeResult.value : null, '$.startingPitchers.home', 'home', game, authorizedIds, dataCutoffAtMs, issues);
  }

  const awayResult = ownDataProperty(startersRoot, 'away', '$.startingPitchers.away', issues);
  if (awayResult.kind === 'missing') {
    pushIssue('MISSING_FIELD', '$.startingPitchers.away', 'away starter is required', issues);
  } else {
    validateStartingPitcher(awayResult.kind === 'data' ? awayResult.value : null, '$.startingPitchers.away', 'away', game, authorizedIds, dataCutoffAtMs, issues);
  }

  addKnownFieldIssues(startersRoot, new Set(['home', 'away']), '$.startingPitchers', issues);
}

function validateStartingPitcher(
  starter: unknown,
  path: string,
  side: 'home' | 'away',
  game: Record<string, unknown> | null,
  authorizedIds: Set<string>,
  dataCutoffAtMs: number | MLBPregameSnapshotValidationIssue,
  issues: MLBPregameSnapshotValidationIssue[],
): void {
  if (!isPlainObject(starter)) {
    pushIssue('NOT_PLAIN_OBJECT', path, `${side} starter must be a plain object`, issues);
    return;
  }
  const starterRoot = starter as Record<string, unknown>;

  const stateResult = ownDataProperty(starterRoot, 'state', `${path}.state`, issues);
  if (stateResult.kind === 'missing') {
    pushIssue('MISSING_FIELD', `${path}.state`, `${side} starter state is required`, issues);
    return;
  } else if (stateResult.kind === 'accessor') {
    return;
  }

  const state = stateResult.value;
  if (
    typeof state !== 'string' ||
    !VALID_PITCHER_STATES.has(state)
  ) {
    pushIssue('INVALID_LITERAL', `${path}.state`, `${side} starter state is invalid`, issues);
    return;
  }
  const pitcherState = state;

  if (pitcherState === 'CONFIRMED' || pitcherState === 'PROBABLE') {
    const pitcherIdResult = ownDataProperty(starterRoot, 'pitcherId', `${path}.pitcherId`, issues);
    if (pitcherIdResult.kind === 'missing') {
      pushIssue('MISSING_FIELD', `${path}.pitcherId`, `${side} pitcherId is required`, issues);
    } else if (pitcherIdResult.kind === 'data') {
      const pitcherId = validateIdentifier(pitcherIdResult.value, `${path}.pitcherId`, `${side} pitcherId`);
      if (typeof pitcherId !== 'string') {
        pushIssue('INVALID_STRING', `${path}.pitcherId`, `${side} pitcherId must be a valid identifier`, issues);
      }
    }

    const announcedAtResult = ownDataProperty(starterRoot, 'announcedAt', `${path}.announcedAt`, issues);
    if (announcedAtResult.kind === 'missing') {
      pushIssue('MISSING_FIELD', `${path}.announcedAt`, `${side} announcedAt is required`, issues);
    } else if (announcedAtResult.kind === 'data') {
      const announcedAtMs = parseTimestampToMs(announcedAtResult.value, `${path}.announcedAt`, `${side} announcedAt`);
      if (typeof announcedAtMs === 'object') issues.push(announcedAtMs);
    }

    const sourceRefIdsResult = ownDataProperty(starterRoot, 'sourceRefIds', `${path}.sourceRefIds`, issues);
    if (sourceRefIdsResult.kind === 'missing') {
      pushIssue('MISSING_FIELD', `${path}.sourceRefIds`, `${side} starter sourceRefIds are required`, issues);
    } else if (sourceRefIdsResult.kind === 'data') {
      validateStarterSourceRefs(sourceRefIdsResult.value, path, side, authorizedIds, issues, false);
    }
  } else if (pitcherState === 'UNCONFIRMED') {
    const pitcherIdResult = ownDataProperty(starterRoot, 'pitcherId', `${path}.pitcherId`, issues);
    if (pitcherIdResult.kind === 'missing') {
      pushIssue('MISSING_FIELD', `${path}.pitcherId`, `${side} pitcherId is required`, issues);
    } else if (pitcherIdResult.kind === 'data' && pitcherIdResult.value !== null) {
      pushIssue('INVALID_STARTING_PITCHER', `${path}.pitcherId`, 'UNCONFIRMED pitcherId must be null', issues);
    }

    const announcedAtResult = ownDataProperty(starterRoot, 'announcedAt', `${path}.announcedAt`, issues);
    if (announcedAtResult.kind === 'missing') {
      pushIssue('MISSING_FIELD', `${path}.announcedAt`, `${side} announcedAt is required`, issues);
    } else if (announcedAtResult.kind === 'data') {
      const announcedAtMs = parseTimestampToMs(announcedAtResult.value, `${path}.announcedAt`, `${side} announcedAt`);
      if (typeof announcedAtMs === 'object') {
        issues.push(announcedAtMs);
      } else if (typeof dataCutoffAtMs === 'number' && typeof announcedAtMs === 'number' && announcedAtMs > dataCutoffAtMs) {
        pushIssue('INVALID_TIMESTAMP_ORDER', `${path}.announcedAt`, 'UNCONFIRMED announcedAt must be <= dataCutoffAt', issues);
      }
    }

    const sourceRefIdsResult = ownDataProperty(starterRoot, 'sourceRefIds', `${path}.sourceRefIds`, issues);
    if (sourceRefIdsResult.kind === 'missing') {
      pushIssue('MISSING_FIELD', `${path}.sourceRefIds`, `${side} starter sourceRefIds are required`, issues);
    } else if (sourceRefIdsResult.kind === 'data') {
      validateStarterSourceRefs(sourceRefIdsResult.value, path, side, authorizedIds, issues, true);
    }
  } else if (pitcherState === 'UNAVAILABLE') {
    const pitcherIdResult = ownDataProperty(starterRoot, 'pitcherId', `${path}.pitcherId`, issues);
    if (pitcherIdResult.kind === 'missing') {
      pushIssue('MISSING_FIELD', `${path}.pitcherId`, `${side} pitcherId is required`, issues);
    } else if (pitcherIdResult.kind === 'data' && pitcherIdResult.value !== null) {
      pushIssue('INVALID_STARTING_PITCHER', `${path}.pitcherId`, 'UNAVAILABLE pitcherId must be null', issues);
    }

    const announcedAtResult = ownDataProperty(starterRoot, 'announcedAt', `${path}.announcedAt`, issues);
    if (announcedAtResult.kind === 'missing') {
      pushIssue('MISSING_FIELD', `${path}.announcedAt`, `${side} announcedAt is required`, issues);
    } else if (announcedAtResult.kind === 'data' && announcedAtResult.value !== null) {
      pushIssue('INVALID_STARTING_PITCHER', `${path}.announcedAt`, 'UNAVAILABLE announcedAt must be null', issues);
    }

    const sourceRefIdsResult = ownDataProperty(starterRoot, 'sourceRefIds', `${path}.sourceRefIds`, issues);
    if (sourceRefIdsResult.kind === 'missing') {
      pushIssue('MISSING_FIELD', `${path}.sourceRefIds`, `${side} starter sourceRefIds are required`, issues);
    } else if (sourceRefIdsResult.kind === 'data') {
      validateStarterSourceRefs(sourceRefIdsResult.value, path, side, authorizedIds, issues, true);
    }
  }

  if (typeof dataCutoffAtMs === 'number') {
    const globalAnnouncedAtResult = ownDataProperty(starterRoot, 'announcedAt', `${path}.announcedAt`, issues);
    if (globalAnnouncedAtResult.kind === 'data' && globalAnnouncedAtResult.value !== null) {
      const globalAnnouncedAtMs = parseTimestampToMs(globalAnnouncedAtResult.value, `${path}.announcedAt`, `${side} announcedAt`);
      if (typeof globalAnnouncedAtMs === 'number' && globalAnnouncedAtMs > dataCutoffAtMs) {
        pushIssue('INVALID_TIMESTAMP_ORDER', `${path}.announcedAt`, 'announcedAt must be <= dataCutoffAt', issues);
      }
    }
  }

  addKnownFieldIssues(starterRoot, new Set(['state', 'pitcherId', 'announcedAt', 'sourceRefIds']), path, issues);
}

function validateStarterSourceRefs(
  sourceRefIds: unknown,
  path: string,
  side: 'home' | 'away',
  authorizedIds: Set<string>,
  issues: MLBPregameSnapshotValidationIssue[],
  allowEmpty: boolean,
): void {
  const local = readContractArray(sourceRefIds, `${path}.sourceRefIds`, issues);
  if (local === null) {
    pushIssue('INVALID_SOURCE_REFERENCE', `${path}.sourceRefIds`, `${side} starter sourceRefIds must be an array`, issues);
    return;
  }
  if (!allowEmpty && local.length === 0) {
    pushIssue('INVALID_SOURCE_REFERENCE', `${path}.sourceRefIds`, `${side} starter must reference at least one source`, issues);
    return;
  }
  for (const id of local) {
    if (typeof id !== 'string') {
      pushIssue('INVALID_SOURCE_REFERENCE', `${path}.sourceRefIds`, `${side} starter sourceRefIds must be strings`, issues);
      return;
    }
    if (!authorizedIds.has(id)) {
      pushIssue('INVALID_SOURCE_REFERENCE', `${path}.sourceRefIds`, `Starter references unresolved sourceRefId: ${id}`, issues);
      return;
    }
  }
}

function validateSourceReferences(
  references: unknown,
  issues: MLBPregameSnapshotValidationIssue[],
): Set<string> {
  const local = readContractArray(references, '$.sourceReferences', issues);
  if (local === null) {
    pushIssue('NOT_PLAIN_OBJECT', '$.sourceReferences', 'sourceReferences must be an array', issues);
    return new Set<string>();
  }
  const ids: string[] = [];
  const authorizedIds = new Set<string>();
  for (let i = 0; i < local.length; i++) {
    const ref = local[i];
    if (!isPlainObject(ref)) {
      pushIssue('NOT_PLAIN_OBJECT', `$.sourceReferences[${i}]`, 'Each source reference must be a plain object', issues);
      continue;
    }
    const refRoot = ref as Record<string, unknown>;

    const sourceRefIdResult = ownDataProperty(refRoot, 'sourceRefId', `$.sourceReferences[${i}].sourceRefId`, issues);
    if (sourceRefIdResult.kind === 'accessor') {
      continue;
    }
    const sourceRefId = sourceRefIdResult.kind === 'data' ? sourceRefIdResult.value : undefined;
    if (sourceRefIdResult.kind === 'missing') {
      pushIssue('MISSING_FIELD', `$.sourceReferences[${i}].sourceRefId`, 'sourceRefId is required', issues);
    } else {
      const validatedSourceRefId = validateIdentifier(sourceRefId, `$.sourceReferences[${i}].sourceRefId`, 'sourceRefId');
      if (typeof validatedSourceRefId !== 'string') {
        pushIssue('INVALID_STRING', `$.sourceReferences[${i}].sourceRefId`, 'sourceRefId must be a valid identifier', issues);
      } else if (ids.includes(validatedSourceRefId)) {
        pushIssue('DUPLICATE_ID', `$.sourceReferences[${i}].sourceRefId`, `Duplicate sourceRefId: ${validatedSourceRefId}`, issues);
      } else {
        ids.push(validatedSourceRefId);
        authorizedIds.add(validatedSourceRefId);
      }
    }

    const sourceNameResult = ownDataProperty(refRoot, 'sourceName', `$.sourceReferences[${i}].sourceName`, issues);
    if (sourceNameResult.kind === 'missing') {
      pushIssue('MISSING_FIELD', `$.sourceReferences[${i}].sourceName`, 'sourceName is required', issues);
    } else if (sourceNameResult.kind === 'data') {
      const sourceName = sourceNameResult.value;
      if (!isStrictNonEmptyTrimmedString(sourceName)) {
        pushIssue('INVALID_STRING', `$.sourceReferences[${i}].sourceName`, 'sourceName must be a trimmed non-control string', issues);
      }
    }

    const sourceCategoryResult = ownDataProperty(refRoot, 'sourceCategory', `$.sourceReferences[${i}].sourceCategory`, issues);
    if (sourceCategoryResult.kind === 'data' && (typeof sourceCategoryResult.value !== 'string' || !VALID_SOURCE_CATEGORIES.has(sourceCategoryResult.value))) {
      pushIssue('INVALID_SOURCE_REFERENCE', `$.sourceReferences[${i}].sourceCategory`, 'sourceCategory is invalid', issues);
    }

    const rolesResult = ownDataProperty(refRoot, 'roles', `$.sourceReferences[${i}].roles`, issues);
    if (rolesResult.kind === 'data') {
      const roles = rolesResult.value;
      const localRoles = readContractArray(roles, `$.sourceReferences[${i}].roles`, issues);
      if (localRoles === null) {
        pushIssue('INVALID_SOURCE_REFERENCE', `$.sourceReferences[${i}].roles`, 'roles must be an array', issues);
      } else if (localRoles.length === 0) {
        pushIssue('INVALID_SOURCE_REFERENCE', `$.sourceReferences[${i}].roles`, 'roles must be a non-empty array', issues);
      } else {
        const normalized: string[] = [];
        for (const role of localRoles) {
          if (typeof role !== 'string') {
            pushIssue('INVALID_SOURCE_REFERENCE', `$.sourceReferences[${i}].roles`, 'roles must be strings', issues);
            break;
          }
          normalized.push(role);
        }
        if (normalized.length === localRoles.length) {
          const unique = new Set(normalized);
          if (unique.size !== normalized.length) {
            pushIssue('INVALID_SOURCE_REFERENCE', `$.sourceReferences[${i}].roles`, 'roles must be unique', issues);
          }
          for (const role of normalized) {
            if (!VALID_SOURCE_ROLES.has(role)) {
              pushIssue('INVALID_SOURCE_REFERENCE', `$.sourceReferences[${i}].roles`, `Invalid source role: ${role}`, issues);
              break;
            }
          }
          const sorted = normalized.slice().sort();
          if (
            normalized.length !== sorted.length ||
            normalized.some((value, index) => value !== sorted[index])
          ) {
            pushIssue('NON_CANONICAL_ORDER', `$.sourceReferences[${i}].roles`, 'roles must be sorted ascending', issues);
          }
        }
      }
    }

    const providerRecordIdResult = ownDataProperty(refRoot, 'providerRecordId', `$.sourceReferences[${i}].providerRecordId`, issues);
    if (providerRecordIdResult.kind === 'missing') {
      pushIssue('MISSING_FIELD', `$.sourceReferences[${i}].providerRecordId`, 'providerRecordId is required', issues);
    } else if (providerRecordIdResult.kind === 'data' && providerRecordIdResult.value !== null) {
      const providerRecordId = providerRecordIdResult.value;
      if (!isStrictNonEmptyTrimmedString(providerRecordId)) {
        pushIssue('INVALID_SOURCE_REFERENCE', `$.sourceReferences[${i}].providerRecordId`, 'providerRecordId must be null or a trimmed non-control string', issues);
      }
    }

    const fetchedAtResult = ownDataProperty(refRoot, 'fetchedAt', `$.sourceReferences[${i}].fetchedAt`, issues);
    if (fetchedAtResult.kind === 'data') {
      const fetchedAtMs = parseTimestampToMs(fetchedAtResult.value, `$.sourceReferences[${i}].fetchedAt`, 'fetchedAt');
      if (typeof fetchedAtMs === 'object') issues.push(fetchedAtMs);
    }

    const sourceUpdatedAtResult = ownDataProperty(refRoot, 'sourceUpdatedAt', `$.sourceReferences[${i}].sourceUpdatedAt`, issues);
    if (sourceUpdatedAtResult.kind === 'data' && sourceUpdatedAtResult.value !== null) {
      const sourceUpdatedAtMs = parseTimestampToMs(sourceUpdatedAtResult.value, `$.sourceReferences[${i}].sourceUpdatedAt`, 'sourceUpdatedAt');
      if (typeof sourceUpdatedAtMs === 'object') issues.push(sourceUpdatedAtMs);
    }

    addKnownFieldIssues(refRoot, new Set(['sourceRefId', 'sourceName', 'sourceCategory', 'roles', 'providerRecordId', 'fetchedAt', 'sourceUpdatedAt']), `$.sourceReferences[${i}]`, issues);
  }

  validateOrder(
    local,
    (item) => {
      if (!isPlainObject(item)) return '';
      const id = getDataProperty(item, 'sourceRefId');
      return typeof id === 'string' ? id : '';
    },
    'DUPLICATE_ID',
    '$.sourceReferences',
    'sourceReferences',
    issues,
  );

  return authorizedIds;
}

function validateSections(
  sections: unknown,
  authorizedIds: Set<string>,
  game: unknown,
  starters: unknown,
  dataCutoffAtMs: number | MLBPregameSnapshotValidationIssue,
  issues: MLBPregameSnapshotValidationIssue[],
): void {
  const local = readContractArray(sections, '$.sections', issues);
  if (local === null) {
    pushIssue('NOT_PLAIN_OBJECT', '$.sections', 'sections must be an array', issues);
    return;
  }

  const gameRoot = isPlainObject(game) ? (game as Record<string, unknown>) : null;
  const startersRoot = isPlainObject(starters) ? (starters as Record<string, unknown>) : null;

  const seenIds = new Set<string>();
  for (let i = 0; i < local.length; i++) {
    const section = local[i];
    if (!isPlainObject(section)) {
      pushIssue('NOT_PLAIN_OBJECT', `$.sections[${i}]`, 'Each section must be a plain object', issues);
      continue;
    }
    const sectionRoot = section as Record<string, unknown>;

    const sectionIdResult = ownDataProperty(sectionRoot, 'sectionId', `$.sections[${i}].sectionId`, issues);
    if (sectionIdResult.kind === 'accessor') {
      continue;
    }
    const sectionId = sectionIdResult.kind === 'data' ? sectionIdResult.value : undefined;
    if (sectionIdResult.kind === 'missing') {
      pushIssue('MISSING_FIELD', `$.sections[${i}].sectionId`, 'sectionId is required', issues);
    } else {
      const validatedSectionId = validateIdentifier(sectionId, `$.sections[${i}].sectionId`, 'sectionId');
      if (typeof validatedSectionId !== 'string') {
        pushIssue('INVALID_STRING', `$.sections[${i}].sectionId`, 'sectionId must be a valid identifier', issues);
      } else if (seenIds.has(validatedSectionId)) {
        pushIssue('DUPLICATE_ID', `$.sections[${i}].sectionId`, `Duplicate section ID: ${validatedSectionId}`, issues);
      } else {
        seenIds.add(validatedSectionId);
      }
    }

    const kindResult = ownDataProperty(sectionRoot, 'kind', `$.sections[${i}].kind`, issues);
    if (kindResult.kind === 'data' && (typeof kindResult.value !== 'string' || !VALID_SECTION_KINDS.has(kindResult.value))) {
      pushIssue('INVALID_SECTION', `$.sections[${i}].kind`, 'section.kind is invalid', issues);
    }

    const entityResult = ownDataProperty(sectionRoot, 'entity', `$.sections[${i}].entity`, issues);
    if (entityResult.kind === 'missing') {
      pushIssue('MISSING_FIELD', `$.sections[${i}].entity`, 'section.entity is required', issues);
    } else if (entityResult.kind === 'data') {
      const entity = entityResult.value;
      if (!isPlainObject(entity)) {
        pushIssue('INVALID_SECTION', `$.sections[${i}].entity`, 'section.entity must be a plain object', issues);
      } else {
        const entityRoot = entity as Record<string, unknown>;
        const entityScopeResult = ownDataProperty(entityRoot, 'scope', `$.sections[${i}].entity.scope`, issues);
        if (entityScopeResult.kind === 'data') {
          const entityScope = entityScopeResult.value;
          if (typeof entityScope !== 'string' || !VALID_ENTITY_SCOPES.has(entityScope)) {
            pushIssue('INVALID_SECTION', `$.sections[${i}].entity.scope`, 'entity.scope is invalid', issues);
          } else {
            const entityIdResult = ownDataProperty(entityRoot, 'entityId', `$.sections[${i}].entity.entityId`, issues);
            if (entityIdResult.kind === 'missing') {
              if (entityScope === 'GAME') {
                pushIssue('MISSING_FIELD', `$.sections[${i}].entity.entityId`, 'GAME entityId must be null', issues);
              } else {
                pushIssue('MISSING_FIELD', `$.sections[${i}].entity.entityId`, 'entityId is required', issues);
              }
            } else if (entityIdResult.kind === 'data') {
              const rawEntityId = entityIdResult.value;
              if (entityScope === 'GAME') {
                if (rawEntityId !== null) {
                  pushIssue('INVALID_SECTION', `$.sections[${i}].entity.entityId`, 'GAME entityId must be null', issues);
                }
              } else {
                if (rawEntityId !== null && typeof rawEntityId !== 'string') {
                  pushIssue('INVALID_SECTION', `$.sections[${i}].entity.entityId`, 'entityId must be a valid identifier', issues);
                } else if (typeof rawEntityId === 'string') {
                  const trimmedEntityId = validateIdentifier(rawEntityId, `$.sections[${i}].entity.entityId`, 'entityId');
                  if (typeof trimmedEntityId !== 'string') {
                    pushIssue('INVALID_STRING', `$.sections[${i}].entity.entityId`, 'entityId must be a valid identifier', issues);
                  } else {
                    enforceEntityConsistency(entityScope as MLBPregameEntityScope, trimmedEntityId, `$.sections[${i}].entity`, gameRoot, startersRoot, issues);
                  }
                }
              }
            }
          }
        }
      }
    }

    const statusResult = ownDataProperty(sectionRoot, 'status', `$.sections[${i}].status`, issues);
    if (statusResult.kind === 'data' && (typeof statusResult.value !== 'string' || !VALID_SECTION_STATUSES.has(statusResult.value))) {
      pushIssue('INVALID_SECTION', `$.sections[${i}].status`, 'section.status is invalid', issues);
    }

    const asOfAtResult = ownDataProperty(sectionRoot, 'asOfAt', `$.sections[${i}].asOfAt`, issues);
    if (asOfAtResult.kind === 'missing') {
      pushIssue('MISSING_FIELD', `$.sections[${i}].asOfAt`, 'section.asOfAt is required', issues);
    } else if (asOfAtResult.kind === 'data') {
      const asOfAtMs = parseTimestampToMs(asOfAtResult.value, `$.sections[${i}].asOfAt`, 'asOfAt');
      if (typeof asOfAtMs === 'object') {
        issues.push(asOfAtMs);
      } else if (typeof dataCutoffAtMs === 'number' && typeof asOfAtMs === 'number' && asOfAtMs > dataCutoffAtMs) {
        pushIssue('INVALID_TIMESTAMP_ORDER', `$.sections[${i}].asOfAt`, 'section.asOfAt must be <= dataCutoffAt', issues);
      }
    }

    const sectionRefIdsResult = ownDataProperty(sectionRoot, 'sourceRefIds', `$.sections[${i}].sourceRefIds`, issues);
    if (sectionRefIdsResult.kind === 'missing') {
      pushIssue('MISSING_FIELD', `$.sections[${i}].sourceRefIds`, 'section.sourceRefIds are required', issues);
    } else if (sectionRefIdsResult.kind === 'data') {
      const localRefs = readContractArray(sectionRefIdsResult.value, `$.sections[${i}].sourceRefIds`, issues);
      if (localRefs === null || localRefs.length === 0) {
        pushIssue('INVALID_SECTION', `$.sections[${i}].sourceRefIds`, 'section.sourceRefIds must be a non-empty array', issues);
      } else {
        const refIdSet = new Set<string>();
        for (const refId of localRefs) {
          if (typeof refId !== 'string') {
            pushIssue('INVALID_SECTION', `$.sections[${i}].sourceRefIds`, 'section sourceRefIds must be strings', issues);
            break;
          }
          if (refIdSet.has(refId)) {
            pushIssue('NON_CANONICAL_ORDER', `$.sections[${i}].sourceRefIds`, 'section sourceRefIds must be unique', issues);
            break;
          }
          refIdSet.add(refId);
        }
        for (const refId of refIdSet) {
          if (!authorizedIds.has(refId)) {
            pushIssue('INVALID_SOURCE_REFERENCE', `$.sections[${i}].sourceRefIds`, `Section references unresolved sourceRefId: ${refId}`, issues);
            break;
          }
        }
        const sortedRefs = localRefs.slice().sort();
        if (
          localRefs.length !== sortedRefs.length ||
          localRefs.some((value, index) => value !== sortedRefs[index])
        ) {
          pushIssue('NON_CANONICAL_ORDER', `$.sections[${i}].sourceRefIds`, 'section sourceRefIds must be sorted ascending', issues);
        }
      }
    }

    const payloadResult = ownDataProperty(sectionRoot, 'payload', `$.sections[${i}].payload`, issues);
    if (payloadResult.kind === 'missing') {
      pushIssue('MISSING_FIELD', `$.sections[${i}].payload`, 'section.payload is required', issues);
    } else if (payloadResult.kind === 'data') {
      validateSectionPayload(payloadResult.value, `$.sections[${i}].payload`, issues);
    }

    addKnownFieldIssues(sectionRoot, new Set(['sectionId', 'kind', 'entity', 'status', 'asOfAt', 'sourceRefIds', 'payload']), `$.sections[${i}]`, issues);
  }

  validateOrder(
    local,
    (item) => {
      if (!isPlainObject(item)) return '';
      const id = getDataProperty(item, 'sectionId');
      return typeof id === 'string' ? id : '';
    },
    'DUPLICATE_ID',
    '$.sections',
    'sections',
    issues,
  );
}
function enforceEntityConsistency(
  scope: MLBPregameEntityScope,
  entityId: string,
  path: string,
  game: Record<string, unknown> | null,
  starters: Record<string, unknown> | null,
  issues: MLBPregameSnapshotValidationIssue[],
): void {
  if (scope === 'HOME_TEAM') {
    const homeTeamId = getDataProperty(game, 'homeTeamId');
    if (typeof homeTeamId === 'string' && homeTeamId !== entityId) {
      pushIssue('INVALID_SECTION', path, 'HOME_TEAM entityId must match game.homeTeamId', issues);
    }
  }
  if (scope === 'AWAY_TEAM') {
    const awayTeamId = getDataProperty(game, 'awayTeamId');
    if (typeof awayTeamId === 'string' && awayTeamId !== entityId) {
      pushIssue('INVALID_SECTION', path, 'AWAY_TEAM entityId must match game.awayTeamId', issues);
    }
  }
  if (scope === 'HOME_STARTER' || scope === 'AWAY_STARTER') {
    const side = scope === 'HOME_STARTER' ? 'home' : 'away';
    const sideRoot = getDataProperty(starters, side);
    if (isPlainObject(sideRoot)) {
      const pitcherId = getDataProperty(sideRoot, 'pitcherId');
      if (typeof pitcherId === 'string' && pitcherId !== entityId) {
        pushIssue('INVALID_SECTION', path, `${side} starter entityId must match startingPitchers.${side}.pitcherId`, issues);
      }
    }
  }
  if (scope === 'VENUE') {
    const venueId = getDataProperty(game, 'venueId');
    if (typeof venueId === 'string' && venueId !== entityId) {
      pushIssue('INVALID_SECTION', path, 'VENUE entityId must match game.venueId when venueId is present', issues);
    }
  }
}

function validateWarnings(
  warnings: unknown,
  issues: MLBPregameSnapshotValidationIssue[],
): void {
  const local = readContractArray(warnings, '$.warnings', issues);
  if (local === null) {
    pushIssue('NOT_PLAIN_OBJECT', '$.warnings', 'warnings must be an array', issues);
    return;
  }
  const warningEntries: {
    code: string;
    path: string;
    message: string;
  }[] = [];
  for (let i = 0; i < local.length; i++) {
    const warning = local[i];
    if (!isPlainObject(warning)) {
      pushIssue('NOT_PLAIN_OBJECT', `$.warnings[${i}]`, 'Each warning must be a plain object', issues);
      continue;
    }
    const warningRoot = warning as Record<string, unknown>;

    const warningCodeResult = ownDataProperty(warningRoot, 'code', `$.warnings[${i}].code`, issues);
    if (warningCodeResult.kind === 'accessor') {
      continue;
    }
    const warningCode = warningCodeResult.kind === 'data' ? warningCodeResult.value : undefined;
    const warningCodeValid = typeof warningCode === 'string' && isStrictNonEmptyTrimmedString(warningCode);
    if (warningCodeResult.kind === 'missing') {
      pushIssue('MISSING_FIELD', `$.warnings[${i}].code`, 'warning.code is required', issues);
    } else if (!warningCodeValid) {
      pushIssue('INVALID_STRING', `$.warnings[${i}].code`, 'warning.code must be a non-empty trimmed non-control string', issues);
    }

    const warningPathResult = ownDataProperty(warningRoot, 'path', `$.warnings[${i}].path`, issues);
    if (warningPathResult.kind === 'accessor') {
      continue;
    }
    const warningPath = warningPathResult.kind === 'data' ? warningPathResult.value : undefined;
    const warningPathValid = typeof warningPath === 'string' && warningPath.startsWith('$') && isStrictNonEmptyTrimmedString(warningPath);
    if (warningPathResult.kind === 'missing') {
      pushIssue('MISSING_FIELD', `$.warnings[${i}].path`, 'warning.path is required', issues);
    } else if (!warningPathValid) {
      pushIssue('INVALID_STRING', `$.warnings[${i}].path`, 'warning.path must be a non-empty trimmed non-control string beginning with $', issues);
    }

    const warningMessageResult = ownDataProperty(warningRoot, 'message', `$.warnings[${i}].message`, issues);
    if (warningMessageResult.kind === 'accessor') {
      continue;
    }
    const warningMessage = warningMessageResult.kind === 'data' ? warningMessageResult.value : undefined;
    const warningMessageValid = typeof warningMessage === 'string' && isStrictNonEmptyTrimmedString(warningMessage);
    if (warningMessageResult.kind === 'missing') {
      pushIssue('MISSING_FIELD', `$.warnings[${i}].message`, 'warning.message is required', issues);
    } else if (!warningMessageValid) {
      pushIssue('INVALID_STRING', `$.warnings[${i}].message`, 'warning.message must be a non-empty trimmed non-control string', issues);
    }

    addKnownFieldIssues(warningRoot, new Set(['code', 'path', 'message']), `$.warnings[${i}]`, issues);

    if (warningCodeValid && warningPathValid && warningMessageValid) {
      warningEntries.push({ code: warningCode, path: warningPath, message: warningMessage });
    }
  }

  if (warningEntries.length > 1) {
    for (let i = 1; i < warningEntries.length; i++) {
      const previous = warningEntries[i - 1];
      const current = warningEntries[i];
      const pathDiff = compareStrings(previous.path, current.path);
      const codeDiff = compareStrings(previous.code, current.code);
      const messageDiff = compareStrings(previous.message, current.message);
      if (pathDiff > 0 || (pathDiff === 0 && codeDiff > 0) || (pathDiff === 0 && codeDiff === 0 && messageDiff > 0)) {
        pushIssue('NON_CANONICAL_ORDER', '$.warnings', 'warnings must be sorted by path, code, and message', issues);
        break;
      }
    }
  }
}

export function validateMLBCanonicalPregameSnapshot(
  value: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBCanonicalPregameSnapshot;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBPregameSnapshotValidationIssue[];
    }> {
  const issues: MLBPregameSnapshotValidationIssue[] = [];

  if (!isPlainObject(value)) {
    return { ok: false, issues: [{ code: 'NOT_PLAIN_OBJECT', path: '$', message: 'Snapshot must be a plain object' }] };
  }
  const root = value as Record<string, unknown>;

  const contractVersionResult = ownDataProperty(root, 'contractVersion', '$.contractVersion', issues);
  if (contractVersionResult.kind === 'missing') {
    pushIssue('MISSING_FIELD', '$.contractVersion', 'contractVersion is required', issues);
  } else if (contractVersionResult.kind === 'data') {
    const contractVersion = validateIdentifier(contractVersionResult.value, '$.contractVersion', 'contractVersion');
    if (typeof contractVersion !== 'string') {
      pushIssue('INVALID_LITERAL', '$.contractVersion', `contractVersion must be ${MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION}`, issues);
    } else if (contractVersion !== MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION) {
      pushIssue('INVALID_LITERAL', '$.contractVersion', `contractVersion must be ${MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION}`, issues);
    }
  }

  const sportResult = ownDataProperty(root, 'sport', '$.sport', issues);
  if (sportResult.kind === 'missing') {
    pushIssue('MISSING_FIELD', '$.sport', 'sport is required', issues);
  } else if (sportResult.kind === 'data' && sportResult.value !== 'MLB') {
    pushIssue('INVALID_LITERAL', '$.sport', 'sport must be MLB', issues);
  }

  const targetResult = ownDataProperty(root, 'target', '$.target', issues);
  if (targetResult.kind === 'missing') {
    pushIssue('MISSING_FIELD', '$.target', 'target is required', issues);
  } else if (targetResult.kind === 'data' && targetResult.value !== 'OFFICIAL_FINAL_GAME_WINNER') {
    pushIssue('INVALID_LITERAL', '$.target', 'target must be OFFICIAL_FINAL_GAME_WINNER', issues);
  }

  const snapshotIdResult = ownDataProperty(root, 'snapshotId', '$.snapshotId', issues);
  if (snapshotIdResult.kind === 'missing') {
    pushIssue('MISSING_FIELD', '$.snapshotId', 'snapshotId is required', issues);
  } else if (snapshotIdResult.kind === 'data') {
    const snapshotId = validateIdentifier(snapshotIdResult.value, '$.snapshotId', 'snapshotId');
    if (typeof snapshotId !== 'string') {
      pushIssue('INVALID_STRING', '$.snapshotId', 'snapshotId must be a valid identifier', issues);
    }
  }

  const capturedAtResult = ownDataProperty(root, 'capturedAt', '$.capturedAt', issues);
  if (capturedAtResult.kind === 'missing') {
    pushIssue('MISSING_FIELD', '$.capturedAt', 'capturedAt is required', issues);
  } else if (capturedAtResult.kind === 'data') {
    const capturedAtMs = parseTimestampToMs(capturedAtResult.value, '$.capturedAt', 'capturedAt');
    if (typeof capturedAtMs === 'object') {
      issues.push(capturedAtMs);
    }

    const dataCutoffAtResult = ownDataProperty(root, 'dataCutoffAt', '$.dataCutoffAt', issues);
    if (dataCutoffAtResult.kind === 'missing') {
      pushIssue('MISSING_FIELD', '$.dataCutoffAt', 'dataCutoffAt is required', issues);
    } else if (dataCutoffAtResult.kind === 'data') {
      const dataCutoffAtMs = parseTimestampToMs(dataCutoffAtResult.value, '$.dataCutoffAt', 'dataCutoffAt');
      if (typeof dataCutoffAtMs === 'object') {
        issues.push(dataCutoffAtMs);
      }

      if (!timestampOrdered(dataCutoffAtMs, capturedAtMs)) {
        pushIssue('INVALID_TIMESTAMP_ORDER', '$.snapshot', 'dataCutoffAt must be <= capturedAt', issues);
      }

      let gameObject: Record<string, unknown> | null = null;
      const gameResult = ownDataProperty(root, 'game', '$.game', issues);
      if (gameResult.kind === 'missing') {
        pushIssue('MISSING_FIELD', '$.game', 'game is required', issues);
      } else if (gameResult.kind === 'data') {
        const parsedGame = validatePlainObject(gameResult.value);
        if (parsedGame === null) {
          pushIssue('NOT_PLAIN_OBJECT', '$.game', 'game must be a plain object', issues);
        } else {
          gameObject = parsedGame;
          validateGame(gameObject, capturedAtMs, issues);
        }
      }

      let sourceReferencesValue: unknown = null;
      const sourceReferencesResult = ownDataProperty(root, 'sourceReferences', '$.sourceReferences', issues);
      if (sourceReferencesResult.kind === 'missing') {
        pushIssue('MISSING_FIELD', '$.sourceReferences', 'sourceReferences is required', issues);
      } else if (sourceReferencesResult.kind === 'data') {
        sourceReferencesValue = sourceReferencesResult.value;
      }
      const authorizedIds = validateSourceReferences(sourceReferencesValue, issues);

      let startingPitchersValue: unknown = null;
      const startingPitchersResult = ownDataProperty(root, 'startingPitchers', '$.startingPitchers', issues);
      if (startingPitchersResult.kind === 'missing') {
        pushIssue('MISSING_FIELD', '$.startingPitchers', 'startingPitchers is required', issues);
      } else if (startingPitchersResult.kind === 'data') {
        startingPitchersValue = startingPitchersResult.value;
        validateStartingPitchers(startingPitchersValue, gameObject, authorizedIds, dataCutoffAtMs, issues);
      }

      const sectionsResult = ownDataProperty(root, 'sections', '$.sections', issues);
      if (sectionsResult.kind === 'missing') {
        pushIssue('MISSING_FIELD', '$.sections', 'sections is required', issues);
      } else if (sectionsResult.kind === 'data') {
        validateSections(sectionsResult.value, authorizedIds, gameObject, startingPitchersValue, dataCutoffAtMs, issues);
      }

      const dataCompletenessResult = ownDataProperty(root, 'dataCompleteness', '$.dataCompleteness', issues);
      if (dataCompletenessResult.kind === 'missing') {
        pushIssue('MISSING_FIELD', '$.dataCompleteness', 'dataCompleteness is required', issues);
      } else if (dataCompletenessResult.kind === 'data') {
        if (typeof dataCompletenessResult.value !== 'string') {
          pushIssue('INVALID_LITERAL', '$.dataCompleteness', 'dataCompleteness must be COMPLETE, PARTIAL, or INSUFFICIENT', issues);
        } else if (!VALID_DATA_COMPLETENESS.has(dataCompletenessResult.value)) {
          pushIssue('INVALID_LITERAL', '$.dataCompleteness', 'dataCompleteness must be COMPLETE, PARTIAL, or INSUFFICIENT', issues);
        }
      }

      const warningsResult = ownDataProperty(root, 'warnings', '$.warnings', issues);
      if (warningsResult.kind === 'missing') {
        pushIssue('MISSING_FIELD', '$.warnings', 'warnings is required', issues);
      } else if (warningsResult.kind === 'data') {
        validateWarnings(warningsResult.value, issues);
      }
    }
  }

  {
    const rootOwnNames = Object.getOwnPropertyNames(root);
    for (const key of rootOwnNames) {
      if (TARGET_GAME_OUTCOME_FIELDS.has(key)) {
        const valueResult = ownDataProperty(root, key, `$.${key}`, issues);
        if (valueResult.kind === 'data') {
          pushIssue('TARGET_GAME_OUTCOME_FIELD', `$.${key}`, `Snapshot contains prohibited outcome field: ${key}`, issues);
        }
      }
    }
  }

  addKnownFieldIssues(root, KNOWN_ROOT_FIELDS, '$', issues);
  for (const symbol of Object.getOwnPropertySymbols(root)) {
    pushIssue('UNKNOWN_FIELD', `$[${String(symbol)}]`, `Unknown symbol property: ${symbol.description ?? symbol.toString()}`, issues);
  }

  try {
    assertNoOddsContamination(value);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('ODDS_CONTAMINATION')) {
        for (const line of error.message.split('\n')) {
          if (line.startsWith('path=')) {
            const fireWallPath = line.slice(5).split('; ')[0];
            pushUniquePathCode(
              issues,
              { code: 'ODDS_CONTAMINATION' as const, path: `$${fireWallPath.replace(/^\\./, '')}`, message: `Snapshot contains prohibited field at ${fireWallPath}` },
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
              { code: 'INVALID_JSON_VALUE' as const, path: `$${accessorPath.replace(/^\\./, '')}`, message: 'Snapshot contains an accessor property' },
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

  return { ok: true, value: root as unknown as MLBCanonicalPregameSnapshot };
}
