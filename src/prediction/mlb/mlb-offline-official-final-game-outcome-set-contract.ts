import {
  assertNoOddsContamination,
  isProhibitedOddsBoundaryKey,
} from '../firewall/odds-contamination-guard';

export const MLB_OFFLINE_OFFICIAL_FINAL_GAME_OUTCOME_SET_CONTRACT_VERSION =
  'mlb-offline-official-final-game-outcome-set-v1' as const;

export type MLBOfflineOfficialFinalGameOutcomeSetInput = Readonly<{
  outcomes: unknown;
}>;

export type MLBOfflineOfficialFinalGameOutcome = Readonly<{
  outcomeId: string;
  status: 'OFFICIAL_FINAL';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  gameId: string;
  officialDate: string;
  scheduledStartAt: string;
  homeTeamId: string;
  awayTeamId: string;
  homeRuns: number;
  awayRuns: number;
  winnerTeamId: string;
  finalizedAt: string;
  source: Readonly<{
    sourceName: string;
    sourceRecordId: string;
    fetchedAt: string;
  }>;
}>;

export type MLBOfflineOfficialFinalGameOutcomeSet = Readonly<{
  contractVersion:
    typeof MLB_OFFLINE_OFFICIAL_FINAL_GAME_OUTCOME_SET_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  outcomeSetId: string;
  outcomeCount: number;
  outcomeIds: readonly string[];
  outcomes:
    readonly MLBOfflineOfficialFinalGameOutcome[];
}>;

export type MLBOfflineOfficialFinalGameOutcomeSetIssue = Readonly<{
  code:
    | 'NOT_PLAIN_OBJECT'
    | 'UNKNOWN_FIELD'
    | 'INVALID_JSON_VALUE'
    | 'ODDS_CONTAMINATION'
    | 'PROHIBITED_CONCEPT'
    | 'MISSING_FIELD'
    | 'INVALID_LITERAL'
    | 'INVALID_STRING'
    | 'INVALID_DATE'
    | 'INVALID_TIMESTAMP'
    | 'INVALID_INTEGER'
    | 'INVALID_ARRAY'
    | 'TEAM_IDENTITY_MISMATCH'
    | 'FINAL_SCORE_MISMATCH'
    | 'INVALID_TIME_ORDER'
    | 'OUTCOME_ID_MISMATCH'
    | 'DUPLICATE_GAME'
    | 'DUPLICATE_OUTCOME_ID'
    | 'NON_CANONICAL_ORDER'
    | 'OUTCOME_COUNT_MISMATCH'
    | 'OUTCOME_IDS_MISMATCH'
    | 'OUTCOME_SET_ID_MISMATCH'
    | 'GENERATED_OUTCOME_SET_INVALID';
  path: string;
  message: string;
}>;

const ROOT_FIELDS = [
  'contractVersion',
  'sport',
  'target',
  'outcomeSetId',
  'outcomeCount',
  'outcomeIds',
  'outcomes',
] as const;

const BUILDER_FIELDS = ['outcomes'] as const;

const OUTCOME_FIELDS = [
  'outcomeId',
  'status',
  'target',
  'gameId',
  'officialDate',
  'scheduledStartAt',
  'homeTeamId',
  'awayTeamId',
  'homeRuns',
  'awayRuns',
  'winnerTeamId',
  'finalizedAt',
  'source',
] as const;

const SOURCE_FIELDS = ['sourceName', 'sourceRecordId', 'fetchedAt'] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype;
}

function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { value: unknown } {
  return !!descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value');
}

function ownDataProperty(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBOfflineOfficialFinalGameOutcomeSetIssue[],
): 'missing' | 'accessor' | { kind: 'data'; value: unknown } {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (!descriptor) {
    return 'missing';
  }
  if (!isDataDescriptor(descriptor)) {
    issues.push({
      code: 'INVALID_JSON_VALUE',
      path,
      message: `Accessor property: ${key}`,
    });
    return 'accessor';
  }
  return { kind: 'data', value: descriptor.value };
}

function pushUniqueIssue(
  issues: MLBOfflineOfficialFinalGameOutcomeSetIssue[],
  issue: MLBOfflineOfficialFinalGameOutcomeSetIssue,
): void {
  const exists = issues.some(
    (item) => item.path === issue.path && item.code === issue.code,
  );
  if (!exists) {
    issues.push(issue);
  }
}

function normalizeIssues(
  issues: readonly MLBOfflineOfficialFinalGameOutcomeSetIssue[],
): readonly MLBOfflineOfficialFinalGameOutcomeSetIssue[] {
  const seen = new Set<string>();
  const normalized: MLBOfflineOfficialFinalGameOutcomeSetIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.code}:${issue.path}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(issue);
  }
  return normalized;
}

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F]/;

function isNonEmptyTrimmedControlFreeString(
  value: unknown,
): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    !CONTROL_CHARACTER_PATTERN.test(value)
  );
}

function isLeapYear(year: number): boolean {
  if (year % 400 === 0) {
    return true;
  }
  if (year % 100 === 0) {
    return false;
  }
  return year % 4 === 0;
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) {
    return 29;
  }
  return MONTH_DAYS[month - 1];
}

function isValidGregorianDate(year: number, month: number, day: number): boolean {
  if (year === 0) {
    return false;
  }
  if (month < 1 || month > 12) {
    return false;
  }
  if (day < 1) {
    return false;
  }
  return day <= daysInMonth(year, month);
}

function validateCanonicalUtcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/);
  if (match === null) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  if (!isValidGregorianDate(year, month, day)) {
    return false;
  }
  if (hour < 0 || hour > 23) {
    return false;
  }
  if (minute < 0 || minute > 59) {
    return false;
  }
  if (second < 0 || second > 59) {
    return false;
  }

  return true;
}

function daysBeforeYear(year: number): number {
  return (
    365 * (year - 1) +
    Math.floor((year - 1) / 4) -
    Math.floor((year - 1) / 100) +
    Math.floor((year - 1) / 400)
  );
}

function dayOrdinal(year: number, month: number, day: number): number {
  const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && isLeapYear(year)) {
    monthDays[1] = 29;
  }
  let daysBeforeMonth = 0;
  for (let i = 0; i < month - 1; i++) {
    daysBeforeMonth += monthDays[i];
  }
  return daysBeforeYear(year) + daysBeforeMonth + (day - 1);
}

function timestampOrdinal(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
): number {
  const dayOrd = dayOrdinal(year, month, day);
  return (((dayOrd * 24 + hour) * 60 + minute) * 60 + second) * 1000 + millisecond;
}

function parseTimestampOrdinal(value: string): number | undefined {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/);
  if (!match) {
    return undefined;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millisecond = Number(match[7]);
  return timestampOrdinal(year, month, day, hour, minute, second, millisecond);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && isNonEmptyTrimmedControlFreeString(value);
}

const rootFieldPath = (field: string): string => `$.${field}`;

function collectOddsBoundaryIssues(
  root: Record<string, unknown>,
  issues: MLBOfflineOfficialFinalGameOutcomeSetIssue[],
): Set<string> {
  const prohibitedKeys = new Set<string>();
  for (const key of Object.getOwnPropertyNames(root)) {
    if (isProhibitedOddsBoundaryKey(key)) {
      pushUniqueIssue(issues, {
        code: 'ODDS_CONTAMINATION',
        path: rootFieldPath(key),
        message: 'Odds contamination detected',
      });
      prohibitedKeys.add(key);
    }
  }
  return prohibitedKeys;
}

const arrayIndexPath = (arrayPath: string, index: number): string =>
  `${arrayPath}[${index}]`;

const arrayPropertyPath = (arrayPath: string, key: string): string =>
  `${arrayPath}.${key}`;

const outcomePath = (index: number): string => `$.outcomes[${index}]`;

const outcomeFieldPath = (index: number, field: string): string =>
  `$.outcomes[${index}].${field}`;

const sourcePath = (index: number): string =>
  `$.outcomes[${index}].source`;

const sourceFieldPath = (index: number, field: string): string =>
  `$.outcomes[${index}].source.${field}`;

const encodeComponent = (value: string): string => `${value.length}:${value}`;

function deterministicOutcomeSetId(outcomeIds: readonly string[]): string {
  if (outcomeIds.length === 0) {
    return '0::offline-official-final-game-outcome-set-v1';
  }

  return (
    `${outcomeIds.length}:` +
    outcomeIds.map(encodeComponent).join('') +
    '::offline-official-final-game-outcome-set-v1'
  );
}

function compareOrdinal(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function pushPublicRootFieldIssues(
  root: Record<string, unknown>,
  issues: MLBOfflineOfficialFinalGameOutcomeSetIssue[],
): void {
  for (const symbol of Object.getOwnPropertySymbols(root)) {
    pushUniqueIssue(issues, {
      code: 'UNKNOWN_FIELD',
      path: `$[${String(symbol)}]`,
      message: 'Unknown symbol property',
    });
  }

  for (const key of Object.getOwnPropertyNames(root)) {
    if (ROOT_FIELDS.includes(key as (typeof ROOT_FIELDS)[number])) {
      const descriptor = Object.getOwnPropertyDescriptor(root, key);
      if (descriptor && !isDataDescriptor(descriptor)) {
        pushUniqueIssue(issues, {
          code: 'INVALID_JSON_VALUE',
          path: rootFieldPath(key),
          message: `Accessor property: ${key}`,
        });
      }
    }
  }

  const prohibitedKeys = collectOddsBoundaryIssues(root, issues);

  if (root.stake !== undefined) {
    pushUniqueIssue(issues, {
      code: 'PROHIBITED_CONCEPT',
      path: '$.stake',
      message: 'Prohibited field: stake',
    });
  }
  if (root.grade !== undefined) {
    pushUniqueIssue(issues, {
      code: 'PROHIBITED_CONCEPT',
      path: '$.grade',
      message: 'Prohibited field: grade',
    });
  }

  for (const key of Object.getOwnPropertyNames(root)) {
    if (!ROOT_FIELDS.includes(key as (typeof ROOT_FIELDS)[number]) && !prohibitedKeys.has(key) && key !== 'stake' && key !== 'grade') {
      pushUniqueIssue(issues, {
        code: 'UNKNOWN_FIELD',
        path: rootFieldPath(key),
        message: `Unknown field: ${key}`,
      });
    }
  }
}

function pushPublicRootValueIssues(
  root: Record<string, unknown>,
  issues: MLBOfflineOfficialFinalGameOutcomeSetIssue[],
): void {
  const contractVersionResult = ownDataProperty(root, 'contractVersion', '$.contractVersion', issues);
  if (contractVersionResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.contractVersion',
      message: 'contractVersion is required',
    });
  } else if (contractVersionResult !== 'accessor') {
    const value = (contractVersionResult as { kind: 'data'; value: unknown }).value;
    if (value !== MLB_OFFLINE_OFFICIAL_FINAL_GAME_OUTCOME_SET_CONTRACT_VERSION) {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.contractVersion',
        message: 'contractVersion must be mlb-offline-official-final-game-outcome-set-v1',
      });
    }
  }

  const sportResult = ownDataProperty(root, 'sport', '$.sport', issues);
  if (sportResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.sport',
      message: 'sport is required',
    });
  } else if (sportResult !== 'accessor') {
    const value = (sportResult as { kind: 'data'; value: unknown }).value;
    if (value !== 'MLB') {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.sport',
        message: 'sport must be MLB',
      });
    }
  }

  const targetResult = ownDataProperty(root, 'target', '$.target', issues);
  if (targetResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.target',
      message: 'target is required',
    });
  } else if (targetResult !== 'accessor') {
    const value = (targetResult as { kind: 'data'; value: unknown }).value;
    if (value !== 'OFFICIAL_FINAL_GAME_WINNER') {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.target',
        message: 'target must be OFFICIAL_FINAL_GAME_WINNER',
      });
    }
  }

  const outcomeSetIdResult = ownDataProperty(root, 'outcomeSetId', '$.outcomeSetId', issues);
  if (outcomeSetIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.outcomeSetId',
      message: 'outcomeSetId is required',
    });
  } else if (outcomeSetIdResult !== 'accessor') {
    const value = (outcomeSetIdResult as { kind: 'data'; value: unknown }).value;
    if (!isNonEmptyTrimmedControlFreeString(value)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: '$.outcomeSetId',
        message: 'outcomeSetId must be a nonempty trimmed control-free string',
      });
    }
  }

  const outcomeCountResult = ownDataProperty(root, 'outcomeCount', '$.outcomeCount', issues);
  if (outcomeCountResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.outcomeCount',
      message: 'outcomeCount is required',
    });
  } else if (outcomeCountResult !== 'accessor') {
    const value = (outcomeCountResult as { kind: 'data'; value: unknown }).value;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      pushUniqueIssue(issues, {
        code: 'INVALID_INTEGER',
        path: '$.outcomeCount',
        message: 'outcomeCount must be a non-negative safe integer',
      });
    }
  }
}

function pushOutcomeIdsArrayIssues(
  value: unknown,
  issues: MLBOfflineOfficialFinalGameOutcomeSetIssue[],
): { kind: 'invalid' } | { kind: 'valid'; items: readonly unknown[] } {
  if (!Array.isArray(value)) {
    pushUniqueIssue(issues, {
      code: 'INVALID_ARRAY',
      path: '$.outcomeIds',
      message: 'outcomeIds must be an array',
    });
    return { kind: 'invalid' };
  }

  const ownKeys = Object.getOwnPropertyNames(value);
  const ownSymbols = Object.getOwnPropertySymbols(value);
  for (const symbol of ownSymbols) {
    pushUniqueIssue(issues, {
      code: 'UNKNOWN_FIELD',
      path: `$.outcomeIds[${String(symbol)}]`,
      message: 'outcomeIds contains a symbol property',
    });
  }
  for (const key of ownKeys) {
    if (key === 'length') {
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (/^\d+$/.test(key)) {
      const index = Number(key);
      if (!Number.isSafeInteger(index) || index < 0 || String(index) !== key) {
        pushUniqueIssue(issues, {
          code: 'INVALID_JSON_VALUE',
          path: `$.outcomeIds[${key}]`,
          message: 'outcomeIds contains a non-canonical numeric property',
        });
        return { kind: 'invalid' };
      }
      if (!descriptor || !isDataDescriptor(descriptor)) {
        pushUniqueIssue(issues, {
          code: 'INVALID_JSON_VALUE',
          path: `$.outcomeIds[${key}]`,
          message: 'outcomeIds contains an accessor property',
        });
        return { kind: 'invalid' };
      }
    } else {
      if (!descriptor || !isDataDescriptor(descriptor)) {
        pushUniqueIssue(issues, {
          code: 'INVALID_JSON_VALUE',
          path: `$.outcomeIds.${key}`,
          message: 'outcomeIds contains an accessor property',
        });
        return { kind: 'invalid' };
      }
      pushUniqueIssue(issues, {
        code: 'UNKNOWN_FIELD',
        path: `$.outcomeIds.${key}`,
        message: `Unknown field: ${key}`,
      });
    }
  }

  const expectedLength = value.length;
  const seen = new Array<boolean>(expectedLength).fill(false);
  for (const key of ownKeys) {
    if (key === 'length') {
      continue;
    }
    if (/^\d+$/.test(key)) {
      const index = Number(key);
      if (index >= 0 && index < expectedLength) {
        seen[index] = true;
      }
    }
  }
  for (let index = 0; index < expectedLength; index++) {
    if (!seen[index]) {
      pushUniqueIssue(issues, {
        code: 'INVALID_ARRAY',
        path: '$.outcomeIds',
        message: 'outcomeIds is a sparse array',
      });
      return { kind: 'invalid' };
    }
  }

  return { kind: 'valid', items: value };
}

function pushOutcomesArrayIssues(
  value: unknown,
  issues: MLBOfflineOfficialFinalGameOutcomeSetIssue[],
): { kind: 'invalid' } | { kind: 'valid'; items: readonly unknown[] } {
  if (!Array.isArray(value)) {
    pushUniqueIssue(issues, {
      code: 'INVALID_ARRAY',
      path: '$.outcomes',
      message: 'outcomes must be an array',
    });
    return { kind: 'invalid' };
  }

  const ownKeys = Object.getOwnPropertyNames(value);
  const ownSymbols = Object.getOwnPropertySymbols(value);
  for (const symbol of ownSymbols) {
    pushUniqueIssue(issues, {
      code: 'UNKNOWN_FIELD',
      path: `$.outcomes[${String(symbol)}]`,
      message: 'outcomes contains a symbol property',
    });
  }
  for (const key of ownKeys) {
    if (key === 'length') {
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (/^\d+$/.test(key)) {
      const index = Number(key);
      if (!Number.isSafeInteger(index) || index < 0 || String(index) !== key) {
        pushUniqueIssue(issues, {
          code: 'INVALID_JSON_VALUE',
          path: `$.outcomes[${key}]`,
          message: 'outcomes contains a non-canonical numeric property',
        });
        return { kind: 'invalid' };
      }
      if (!descriptor || !isDataDescriptor(descriptor)) {
        pushUniqueIssue(issues, {
          code: 'INVALID_JSON_VALUE',
          path: `$.outcomes[${key}]`,
          message: 'outcomes contains an accessor property',
        });
        return { kind: 'invalid' };
      }
    } else {
      if (!descriptor || !isDataDescriptor(descriptor)) {
        pushUniqueIssue(issues, {
          code: 'INVALID_JSON_VALUE',
          path: `$.outcomes.${key}`,
          message: 'outcomes contains an accessor property',
        });
        return { kind: 'invalid' };
      }
      pushUniqueIssue(issues, {
        code: 'UNKNOWN_FIELD',
        path: `$.outcomes.${key}`,
        message: `Unknown field: ${key}`,
      });
    }
  }

  const expectedLength = value.length;
  const seen = new Array<boolean>(expectedLength).fill(false);
  for (const key of ownKeys) {
    if (key === 'length') {
      continue;
    }
    if (/^\d+$/.test(key)) {
      const index = Number(key);
      if (index >= 0 && index < expectedLength) {
        seen[index] = true;
      }
    }
  }
  for (let index = 0; index < expectedLength; index++) {
    if (!seen[index]) {
      pushUniqueIssue(issues, {
        code: 'INVALID_ARRAY',
        path: '$.outcomes',
        message: 'outcomes is a sparse array',
      });
      return { kind: 'invalid' };
    }
  }

  return { kind: 'valid', items: value };
}

function pushEntryShapeIssues(
  entry: unknown,
  index: number,
  issues: MLBOfflineOfficialFinalGameOutcomeSetIssue[],
): 'invalid' | 'valid' {
  if (!isPlainObject(entry)) {
    pushUniqueIssue(issues, {
      code: 'NOT_PLAIN_OBJECT',
      path: outcomePath(index),
      message: 'outcome must be a plain object',
    });
    return 'invalid';
  }

  const entryRoot = entry as Record<string, unknown>;
  for (const symbol of Object.getOwnPropertySymbols(entryRoot)) {
    pushUniqueIssue(issues, {
      code: 'UNKNOWN_FIELD',
      path: `${outcomePath(index)}[${String(symbol)}]`,
      message: 'Unknown symbol property',
    });
  }

  for (const field of OUTCOME_FIELDS) {
    const descriptor = Object.getOwnPropertyDescriptor(entryRoot, field);
    if (descriptor && !isDataDescriptor(descriptor)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_JSON_VALUE',
        path: outcomeFieldPath(index, field),
        message: `Accessor property: ${field}`,
      });
    }
  }

  for (const key of Object.getOwnPropertyNames(entryRoot)) {
    if (!OUTCOME_FIELDS.includes(key as (typeof OUTCOME_FIELDS)[number])) {
      pushUniqueIssue(issues, {
        code: 'UNKNOWN_FIELD',
        path: outcomeFieldPath(index, key),
        message: `Unknown field: ${key}`,
      });
    }
  }

  return 'valid';
}

type ValidatedEntry = Readonly<{
  valid: 'invalid' | 'valid';
  original: unknown;
  outcomeId: string | undefined;
  gameId: string | undefined;
  officialDate: string | undefined;
  scheduledStartAt: string | undefined;
  homeTeamId: string | undefined;
  awayTeamId: string | undefined;
  homeRuns: number | undefined;
  awayRuns: number | undefined;
  winnerTeamId: string | undefined;
  finalizedAt: string | undefined;
  sourceName: string | undefined;
  sourceRecordId: string | undefined;
  fetchedAt: string | undefined;
}>;

function pushEntryPrimitiveIssues(
  entry: Record<string, unknown>,
  index: number,
  issues: MLBOfflineOfficialFinalGameOutcomeSetIssue[],
): {
  status: 'valid' | 'invalid';
  outcomeId: string | undefined;
  gameId: string | undefined;
  officialDate: string | undefined;
  scheduledStartAt: string | undefined;
  homeTeamId: string | undefined;
  awayTeamId: string | undefined;
  homeRuns: number | undefined;
  awayRuns: number | undefined;
  winnerTeamId: string | undefined;
  finalizedAt: string | undefined;
  sourceName: string | undefined;
  sourceRecordId: string | undefined;
  fetchedAt: string | undefined;
} {
  let status: 'valid' | 'invalid' = 'valid';
  let outcomeId: string | undefined;
  let gameId: string | undefined;
  let officialDate: string | undefined;
  let scheduledStartAt: string | undefined;
  let homeTeamId: string | undefined;
  let awayTeamId: string | undefined;
  let homeRuns: number | undefined;
  let awayRuns: number | undefined;
  let winnerTeamId: string | undefined;
  let finalizedAt: string | undefined;
  let sourceName: string | undefined;
  let sourceRecordId: string | undefined;
  let fetchedAt: string | undefined;

  const statusResult = ownDataProperty(entry, 'status', outcomeFieldPath(index, 'status'), issues);
  if (statusResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: outcomeFieldPath(index, 'status'),
      message: 'status is required',
    });
    status = 'invalid';
  } else if (statusResult !== 'accessor') {
    const value = (statusResult as { kind: 'data'; value: unknown }).value;
    if (value !== 'OFFICIAL_FINAL') {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: outcomeFieldPath(index, 'status'),
        message: 'status must be OFFICIAL_FINAL',
      });
      status = 'invalid';
    }
  }

  const targetResult = ownDataProperty(entry, 'target', outcomeFieldPath(index, 'target'), issues);
  if (targetResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: outcomeFieldPath(index, 'target'),
      message: 'target is required',
    });
    status = 'invalid';
  } else if (targetResult !== 'accessor') {
    const value = (targetResult as { kind: 'data'; value: unknown }).value;
    if (value !== 'OFFICIAL_FINAL_GAME_WINNER') {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: outcomeFieldPath(index, 'target'),
        message: 'target must be OFFICIAL_FINAL_GAME_WINNER',
      });
      status = 'invalid';
    }
  }

  const outcomeIdResult = ownDataProperty(entry, 'outcomeId', outcomeFieldPath(index, 'outcomeId'), issues);
  if (outcomeIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: outcomeFieldPath(index, 'outcomeId'),
      message: 'outcomeId is required',
    });
    status = 'invalid';
  } else if (outcomeIdResult !== 'accessor') {
    const value = (outcomeIdResult as { kind: 'data'; value: unknown }).value;
    if (!isNonEmptyTrimmedControlFreeString(value)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: outcomeFieldPath(index, 'outcomeId'),
        message: 'outcomeId must be a nonempty trimmed control-free string',
      });
      status = 'invalid';
    } else {
      outcomeId = value;
    }
  }

  const gameIdResult = ownDataProperty(entry, 'gameId', outcomeFieldPath(index, 'gameId'), issues);
  if (gameIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: outcomeFieldPath(index, 'gameId'),
      message: 'gameId is required',
    });
    status = 'invalid';
  } else if (gameIdResult !== 'accessor') {
    const value = (gameIdResult as { kind: 'data'; value: unknown }).value;
    if (!isIdentifier(value)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: outcomeFieldPath(index, 'gameId'),
        message: 'gameId must be a valid identifier',
      });
      status = 'invalid';
    } else {
      gameId = value;
    }
  }

  const officialDateResult = ownDataProperty(entry, 'officialDate', outcomeFieldPath(index, 'officialDate'), issues);
  if (officialDateResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: outcomeFieldPath(index, 'officialDate'),
      message: 'officialDate is required',
    });
    status = 'invalid';
  } else if (officialDateResult !== 'accessor') {
    const value = (officialDateResult as { kind: 'data'; value: unknown }).value;
    if (typeof value !== 'string') {
      pushUniqueIssue(issues, {
        code: 'INVALID_DATE',
        path: outcomeFieldPath(index, 'officialDate'),
        message: 'officialDate is not a valid Gregorian date',
      });
      status = 'invalid';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_DATE',
        path: outcomeFieldPath(index, 'officialDate'),
        message: 'officialDate is not a valid Gregorian date',
      });
      status = 'invalid';
    } else {
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match || !isValidGregorianDate(Number(match[1]), Number(match[2]), Number(match[3]))) {
        pushUniqueIssue(issues, {
          code: 'INVALID_DATE',
          path: outcomeFieldPath(index, 'officialDate'),
          message: 'officialDate is not a valid Gregorian date',
        });
        status = 'invalid';
      } else {
        officialDate = value;
      }
    }
  }

  const scheduledStartAtResult = ownDataProperty(entry, 'scheduledStartAt', outcomeFieldPath(index, 'scheduledStartAt'), issues);
  if (scheduledStartAtResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: outcomeFieldPath(index, 'scheduledStartAt'),
      message: 'scheduledStartAt is required',
    });
    status = 'invalid';
  } else if (scheduledStartAtResult !== 'accessor') {
    const value = (scheduledStartAtResult as { kind: 'data'; value: unknown }).value;
    if (typeof value !== 'string') {
      pushUniqueIssue(issues, {
        code: 'INVALID_TIMESTAMP',
        path: outcomeFieldPath(index, 'scheduledStartAt'),
        message: 'scheduledStartAt must be a canonical UTC timestamp in YYYY-MM-DDTHH:mm:ss.sssZ format',
      });
      status = 'invalid';
    } else if (!validateCanonicalUtcTimestamp(value)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_TIMESTAMP',
        path: outcomeFieldPath(index, 'scheduledStartAt'),
        message: 'scheduledStartAt must be a canonical UTC timestamp in YYYY-MM-DDTHH:mm:ss.sssZ format',
      });
      status = 'invalid';
    } else {
      scheduledStartAt = value;
    }
  }

  const homeTeamIdResult = ownDataProperty(entry, 'homeTeamId', outcomeFieldPath(index, 'homeTeamId'), issues);
  if (homeTeamIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: outcomeFieldPath(index, 'homeTeamId'),
      message: 'homeTeamId is required',
    });
    status = 'invalid';
  } else if (homeTeamIdResult !== 'accessor') {
    const value = (homeTeamIdResult as { kind: 'data'; value: unknown }).value;
    if (!isIdentifier(value)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: outcomeFieldPath(index, 'homeTeamId'),
        message: 'homeTeamId must be a valid identifier',
      });
      status = 'invalid';
    } else {
      homeTeamId = value;
    }
  }

  const awayTeamIdResult = ownDataProperty(entry, 'awayTeamId', outcomeFieldPath(index, 'awayTeamId'), issues);
  if (awayTeamIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: outcomeFieldPath(index, 'awayTeamId'),
      message: 'awayTeamId is required',
    });
    status = 'invalid';
  } else if (awayTeamIdResult !== 'accessor') {
    const value = (awayTeamIdResult as { kind: 'data'; value: unknown }).value;
    if (!isIdentifier(value)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: outcomeFieldPath(index, 'awayTeamId'),
        message: 'awayTeamId must be a valid identifier',
      });
      status = 'invalid';
    } else {
      awayTeamId = value;
    }
  }

  const homeRunsResult = ownDataProperty(entry, 'homeRuns', outcomeFieldPath(index, 'homeRuns'), issues);
  if (homeRunsResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: outcomeFieldPath(index, 'homeRuns'),
      message: 'homeRuns is required',
    });
    status = 'invalid';
  } else if (homeRunsResult !== 'accessor') {
    const value = (homeRunsResult as { kind: 'data'; value: unknown }).value;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      pushUniqueIssue(issues, {
        code: 'INVALID_INTEGER',
        path: outcomeFieldPath(index, 'homeRuns'),
        message: 'homeRuns must be a nonnegative safe integer',
      });
      status = 'invalid';
    } else {
      homeRuns = value;
    }
  }

  const awayRunsResult = ownDataProperty(entry, 'awayRuns', outcomeFieldPath(index, 'awayRuns'), issues);
  if (awayRunsResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: outcomeFieldPath(index, 'awayRuns'),
      message: 'awayRuns is required',
    });
    status = 'invalid';
  } else if (awayRunsResult !== 'accessor') {
    const value = (awayRunsResult as { kind: 'data'; value: unknown }).value;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      pushUniqueIssue(issues, {
        code: 'INVALID_INTEGER',
        path: outcomeFieldPath(index, 'awayRuns'),
        message: 'awayRuns must be a nonnegative safe integer',
      });
      status = 'invalid';
    } else {
      awayRuns = value;
    }
  }

  const winnerTeamIdResult = ownDataProperty(entry, 'winnerTeamId', outcomeFieldPath(index, 'winnerTeamId'), issues);
  if (winnerTeamIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: outcomeFieldPath(index, 'winnerTeamId'),
      message: 'winnerTeamId is required',
    });
    status = 'invalid';
  } else if (winnerTeamIdResult !== 'accessor') {
    const value = (winnerTeamIdResult as { kind: 'data'; value: unknown }).value;
    if (!isIdentifier(value)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: outcomeFieldPath(index, 'winnerTeamId'),
        message: 'winnerTeamId must be a valid identifier',
      });
      status = 'invalid';
    } else {
      winnerTeamId = value;
    }
  }

  const finalizedAtResult = ownDataProperty(entry, 'finalizedAt', outcomeFieldPath(index, 'finalizedAt'), issues);
  if (finalizedAtResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: outcomeFieldPath(index, 'finalizedAt'),
      message: 'finalizedAt is required',
    });
    status = 'invalid';
  } else if (finalizedAtResult !== 'accessor') {
    const value = (finalizedAtResult as { kind: 'data'; value: unknown }).value;
    if (typeof value !== 'string') {
      pushUniqueIssue(issues, {
        code: 'INVALID_TIMESTAMP',
        path: outcomeFieldPath(index, 'finalizedAt'),
        message: 'finalizedAt must be a canonical UTC timestamp in YYYY-MM-DDTHH:mm:ss.sssZ format',
      });
      status = 'invalid';
    } else if (!validateCanonicalUtcTimestamp(value)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_TIMESTAMP',
        path: outcomeFieldPath(index, 'finalizedAt'),
        message: 'finalizedAt must be a canonical UTC timestamp in YYYY-MM-DDTHH:mm:ss.sssZ format',
      });
      status = 'invalid';
    } else {
      finalizedAt = value;
    }
  }

  const sourceResult = ownDataProperty(entry, 'source', outcomeFieldPath(index, 'source'), issues);
  if (sourceResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: outcomeFieldPath(index, 'source'),
      message: 'source is required',
    });
    status = 'invalid';
  } else if (sourceResult !== 'accessor') {
    const value = (sourceResult as { kind: 'data'; value: unknown }).value;
    if (!isPlainObject(value)) {
      pushUniqueIssue(issues, {
        code: 'NOT_PLAIN_OBJECT',
        path: sourcePath(index),
        message: 'source must be a plain object',
      });
      status = 'invalid';
    } else {
      const sourceIssues: MLBOfflineOfficialFinalGameOutcomeSetIssue[] = [];
      pushSourceShapeIssues(value as Record<string, unknown>, index, sourceIssues);
      const sourcePrimitive = pushSourcePrimitiveIssues(value as Record<string, unknown>, index, sourceIssues);
      for (const sourceIssue of sourceIssues) {
        pushUniqueIssue(issues, sourceIssue);
      }
      if (sourceIssues.length > 0) {
        status = 'invalid';
      } else {
        sourceName = sourcePrimitive.sourceName;
        sourceRecordId = sourcePrimitive.sourceRecordId;
        fetchedAt = sourcePrimitive.fetchedAt;
      }
    }
  }

  // Chronology validation before team/score semantics
  if (
    status === 'valid' &&
    scheduledStartAt !== undefined &&
    finalizedAt !== undefined &&
    fetchedAt !== undefined
  ) {
    const scheduledOrdinal = parseTimestampOrdinal(scheduledStartAt);
    const finalizedOrdinal = parseTimestampOrdinal(finalizedAt);
    const fetchedOrdinal = parseTimestampOrdinal(fetchedAt);
    if (
      scheduledOrdinal !== undefined &&
      finalizedOrdinal !== undefined &&
      !(finalizedOrdinal > scheduledOrdinal)
    ) {
      pushUniqueIssue(issues, {
        code: 'INVALID_TIME_ORDER',
        path: outcomeFieldPath(index, 'finalizedAt'),
        message: `finalizedAt must be later than scheduledStartAt for game ${gameId}`,
      });
      status = 'invalid';
    }
    if (
      scheduledOrdinal !== undefined &&
      finalizedOrdinal !== undefined &&
      fetchedOrdinal !== undefined &&
      !(fetchedOrdinal >= finalizedOrdinal)
    ) {
      pushUniqueIssue(issues, {
        code: 'INVALID_TIME_ORDER',
        path: sourceFieldPath(index, 'fetchedAt'),
        message: `source.fetchedAt must not be earlier than finalizedAt for game ${gameId}`,
      });
      status = 'invalid';
    }
  }

  if (
    status === 'valid' &&
    homeTeamId !== undefined &&
    awayTeamId !== undefined &&
    homeTeamId === awayTeamId
  ) {
    pushUniqueIssue(issues, {
      code: 'TEAM_IDENTITY_MISMATCH',
      path: outcomeFieldPath(index, 'awayTeamId'),
      message: `homeTeamId and awayTeamId must differ for game ${gameId}`,
    });
    status = 'invalid';
  }

  if (
    status === 'valid' &&
    winnerTeamId !== undefined &&
    homeTeamId !== undefined &&
    awayTeamId !== undefined &&
    winnerTeamId !== homeTeamId &&
    winnerTeamId !== awayTeamId
  ) {
    pushUniqueIssue(issues, {
      code: 'TEAM_IDENTITY_MISMATCH',
      path: outcomeFieldPath(index, 'winnerTeamId'),
      message: `winnerTeamId must identify a competing team for game ${gameId}`,
    });
    status = 'invalid';
  }

  if (
    status === 'valid' &&
    homeRuns !== undefined &&
    awayRuns !== undefined &&
    homeTeamId !== undefined &&
    awayTeamId !== undefined &&
    winnerTeamId !== undefined
  ) {
    if (homeRuns === awayRuns) {
      pushUniqueIssue(issues, {
        code: 'FINAL_SCORE_MISMATCH',
        path: outcomeFieldPath(index, 'awayRuns'),
        message: `Official-final scores must not be tied for game ${gameId}`,
      });
      status = 'invalid';
    } else if (
      (homeRuns > awayRuns && winnerTeamId !== homeTeamId) ||
      (awayRuns > homeRuns && winnerTeamId !== awayTeamId)
    ) {
      if (homeRuns > awayRuns) {
        pushUniqueIssue(issues, {
          code: 'FINAL_SCORE_MISMATCH',
          path: outcomeFieldPath(index, 'winnerTeamId'),
          message: `winnerTeamId must equal homeTeamId when homeRuns exceed awayRuns for game ${gameId}`,
        });
      } else {
        pushUniqueIssue(issues, {
          code: 'FINAL_SCORE_MISMATCH',
          path: outcomeFieldPath(index, 'winnerTeamId'),
          message: `winnerTeamId must equal awayTeamId when awayRuns exceed homeRuns for game ${gameId}`,
        });
      }
      status = 'invalid';
    }
  }

  return {
    status,
    outcomeId,
    gameId,
    officialDate,
    scheduledStartAt,
    homeTeamId,
    awayTeamId,
    homeRuns,
    awayRuns,
    winnerTeamId,
    finalizedAt,
    sourceName,
    sourceRecordId,
    fetchedAt,
  };
}

function pushSourceShapeIssues(
  source: Record<string, unknown>,
  index: number,
  issues: MLBOfflineOfficialFinalGameOutcomeSetIssue[],
): void {
  for (const symbol of Object.getOwnPropertySymbols(source)) {
    pushUniqueIssue(issues, {
      code: 'UNKNOWN_FIELD',
      path: `${sourcePath(index)}[${String(symbol)}]`,
      message: 'Unknown symbol property',
    });
  }

  for (const field of SOURCE_FIELDS) {
    const descriptor = Object.getOwnPropertyDescriptor(source, field);
    if (descriptor && !isDataDescriptor(descriptor)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_JSON_VALUE',
        path: sourceFieldPath(index, field),
        message: `Accessor property: ${field}`,
      });
    }
  }

  for (const key of Object.getOwnPropertyNames(source)) {
    if (!SOURCE_FIELDS.includes(key as (typeof SOURCE_FIELDS)[number])) {
      pushUniqueIssue(issues, {
        code: 'UNKNOWN_FIELD',
        path: sourceFieldPath(index, key),
        message: `Unknown field: ${key}`,
      });
    }
  }
}

function pushSourcePrimitiveIssues(
  source: Record<string, unknown>,
  index: number,
  issues: MLBOfflineOfficialFinalGameOutcomeSetIssue[],
): {
  sourceName: string | undefined;
  sourceRecordId: string | undefined;
  fetchedAt: string | undefined;
} {
  let sourceName: string | undefined;
  let sourceRecordId: string | undefined;
  let fetchedAt: string | undefined;

  const sourceNameResult = ownDataProperty(source, 'sourceName', sourceFieldPath(index, 'sourceName'), issues);
  if (sourceNameResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: sourceFieldPath(index, 'sourceName'),
      message: 'sourceName is required',
    });
  } else if (sourceNameResult !== 'accessor') {
    const value = (sourceNameResult as { kind: 'data'; value: unknown }).value;
    if (!isNonEmptyTrimmedControlFreeString(value)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: sourceFieldPath(index, 'sourceName'),
        message: 'sourceName must be a nonempty trimmed control-free string',
      });
    } else {
      sourceName = value;
    }
  }

  const sourceRecordIdResult = ownDataProperty(source, 'sourceRecordId', sourceFieldPath(index, 'sourceRecordId'), issues);
  if (sourceRecordIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: sourceFieldPath(index, 'sourceRecordId'),
      message: 'sourceRecordId is required',
    });
  } else if (sourceRecordIdResult !== 'accessor') {
    const value = (sourceRecordIdResult as { kind: 'data'; value: unknown }).value;
    if (!isIdentifier(value)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: sourceFieldPath(index, 'sourceRecordId'),
        message: 'sourceRecordId must be a valid identifier',
      });
    } else {
      sourceRecordId = value;
    }
  }

  const fetchedAtResult = ownDataProperty(source, 'fetchedAt', sourceFieldPath(index, 'fetchedAt'), issues);
  if (fetchedAtResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: sourceFieldPath(index, 'fetchedAt'),
      message: 'fetchedAt is required',
    });
  } else if (fetchedAtResult !== 'accessor') {
    const value = (fetchedAtResult as { kind: 'data'; value: unknown }).value;
    if (typeof value !== 'string') {
      pushUniqueIssue(issues, {
        code: 'INVALID_TIMESTAMP',
        path: sourceFieldPath(index, 'fetchedAt'),
        message: 'fetchedAt must be a canonical UTC timestamp in YYYY-MM-DDTHH:mm:ss.sssZ format',
      });
    } else if (!validateCanonicalUtcTimestamp(value)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_TIMESTAMP',
        path: sourceFieldPath(index, 'fetchedAt'),
        message: 'fetchedAt must be a canonical UTC timestamp in YYYY-MM-DDTHH:mm:ss.sssZ format',
      });
    } else {
      fetchedAt = value;
    }
  }

  return { sourceName, sourceRecordId, fetchedAt };
}

function validateFirewall(
  value: unknown,
  issues: MLBOfflineOfficialFinalGameOutcomeSetIssue[],
): void {
  try {
    assertNoOddsContamination(value);
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }
    if (error.message.startsWith('ODDS_CONTAMINATION')) {
      const lines = error.message.split('\n');
      const parsedPaths: string[] = [];
      for (const line of lines) {
        if (line.startsWith('path=')) {
          const pathValue = line.slice(5).split(';')[0].trim();
          if (pathValue.length > 0) {
            parsedPaths.push(pathValue);
          }
        }
      }
      if (parsedPaths.length === 0) {
        throw error;
      }
      for (const reportedPath of parsedPaths) {
        pushUniqueIssue(issues, {
          code: 'ODDS_CONTAMINATION',
          path: reportedPath,
          message: 'Odds contamination detected',
        });
      }
      return;
    }
    if (
      error.name === 'UninspectableAccessorPropertyError' &&
      error.message.startsWith('UNINSPECTABLE_ACCESSOR_PROPERTY\n')
    ) {
      const body = error.message.slice('UNINSPECTABLE_ACCESSOR_PROPERTY\n'.length);
      const parsedPaths: string[] = [];
      for (const line of body.split('\n')) {
        if (line.startsWith('path=')) {
          const pathValue = line.slice(5).trim();
          if (pathValue.length > 0) {
            parsedPaths.push(pathValue);
          }
        }
      }
      if (parsedPaths.length === 0) {
        throw error;
      }
      for (const reportedPath of parsedPaths) {
        pushUniqueIssue(issues, {
          code: 'INVALID_JSON_VALUE',
          path: reportedPath,
          message: 'Unexpected accessor or unsafe value during firewall scan',
        });
      }
      return;
    }
    throw error;
  }
}

type PublicOutcomeEntry = {
  valid: 'invalid' | 'valid';
  original: unknown;
  outcomeId: string | undefined;
  gameId: string | undefined;
  officialDate: string | undefined;
  scheduledStartAt: string | undefined;
  homeTeamId: string | undefined;
  awayTeamId: string | undefined;
  homeRuns: number | undefined;
  awayRuns: number | undefined;
  winnerTeamId: string | undefined;
  finalizedAt: string | undefined;
  sourceName: string | undefined;
  sourceRecordId: string | undefined;
  fetchedAt: string | undefined;
};

function validatePublicOutcomes(
  outcomes: readonly unknown[],
  issues: MLBOfflineOfficialFinalGameOutcomeSetIssue[],
): {
  entries: readonly PublicOutcomeEntry[];
} {
  const entries: PublicOutcomeEntry[] = [];

  for (let i = 0; i < outcomes.length; i++) {
    const entry = outcomes[i];
    const shape = pushEntryShapeIssues(entry, i, issues);
    if (shape === 'invalid') {
      entries.push({
        valid: 'invalid',
        original: entry,
        outcomeId: undefined,
        gameId: undefined,
        officialDate: undefined,
        scheduledStartAt: undefined,
        homeTeamId: undefined,
        awayTeamId: undefined,
        homeRuns: undefined,
        awayRuns: undefined,
        winnerTeamId: undefined,
        finalizedAt: undefined,
        sourceName: undefined,
        sourceRecordId: undefined,
        fetchedAt: undefined,
      });
      continue;
    }

    const entryRoot = entry as Record<string, unknown>;
    const primitiveState = pushEntryPrimitiveIssues(entryRoot, i, issues);
    if (primitiveState.status === 'invalid') {
      entries.push({
        valid: 'invalid',
        original: entry,
        outcomeId: primitiveState.outcomeId,
        gameId: primitiveState.gameId,
        officialDate: primitiveState.officialDate,
        scheduledStartAt: primitiveState.scheduledStartAt,
        homeTeamId: primitiveState.homeTeamId,
        awayTeamId: primitiveState.awayTeamId,
        homeRuns: primitiveState.homeRuns,
        awayRuns: primitiveState.awayRuns,
        winnerTeamId: primitiveState.winnerTeamId,
        finalizedAt: primitiveState.finalizedAt,
        sourceName: primitiveState.sourceName,
        sourceRecordId: primitiveState.sourceRecordId,
        fetchedAt: primitiveState.fetchedAt,
      });
      continue;
    }

    const {
      gameId,
      officialDate,
      scheduledStartAt,
      homeTeamId,
      awayTeamId,
      homeRuns,
      awayRuns,
      winnerTeamId,
      finalizedAt,
      sourceName,
      sourceRecordId,
      fetchedAt,
    } = primitiveState;

    const deterministicOutcomeId =
      encodeComponent('OFFICIAL_FINAL') +
      encodeComponent('OFFICIAL_FINAL_GAME_WINNER') +
      encodeComponent(gameId as string) +
      encodeComponent(officialDate as string) +
      encodeComponent(scheduledStartAt as string) +
      encodeComponent(homeTeamId as string) +
      encodeComponent(awayTeamId as string) +
      encodeComponent(String(homeRuns as number)) +
      encodeComponent(String(awayRuns as number)) +
      encodeComponent(winnerTeamId as string) +
      encodeComponent(finalizedAt as string) +
      encodeComponent(sourceName as string) +
      encodeComponent(sourceRecordId as string) +
      encodeComponent(fetchedAt as string) +
      '::offline-official-final-game-outcome-v1';

    if (primitiveState.outcomeId !== deterministicOutcomeId) {
      pushUniqueIssue(issues, {
        code: 'OUTCOME_ID_MISMATCH',
        path: outcomeFieldPath(i, 'outcomeId'),
        message: 'outcomeId does not match deterministic identity',
      });
      entries.push({
        valid: 'invalid',
        original: entry,
        outcomeId: primitiveState.outcomeId,
        gameId: primitiveState.gameId,
        officialDate: primitiveState.officialDate,
        scheduledStartAt: primitiveState.scheduledStartAt,
        homeTeamId: primitiveState.homeTeamId,
        awayTeamId: primitiveState.awayTeamId,
        homeRuns: primitiveState.homeRuns,
        awayRuns: primitiveState.awayRuns,
        winnerTeamId: primitiveState.winnerTeamId,
        finalizedAt: primitiveState.finalizedAt,
        sourceName: primitiveState.sourceName,
        sourceRecordId: primitiveState.sourceRecordId,
        fetchedAt: primitiveState.fetchedAt,
      });
      continue;
    }

    entries.push({
      valid: 'valid',
      original: entry,
      outcomeId: primitiveState.outcomeId,
      gameId: primitiveState.gameId,
      officialDate: primitiveState.officialDate,
      scheduledStartAt: primitiveState.scheduledStartAt,
      homeTeamId: primitiveState.homeTeamId,
      awayTeamId: primitiveState.awayTeamId,
      homeRuns: primitiveState.homeRuns,
      awayRuns: primitiveState.awayRuns,
      winnerTeamId: primitiveState.winnerTeamId,
      finalizedAt: primitiveState.finalizedAt,
      sourceName: primitiveState.sourceName,
      sourceRecordId: primitiveState.sourceRecordId,
      fetchedAt: primitiveState.fetchedAt,
    });
  }

  return { entries };
}

function validatePublicCollectionSemantics(
  root: Record<string, unknown>,
  entries: readonly PublicOutcomeEntry[],
  issues: MLBOfflineOfficialFinalGameOutcomeSetIssue[],
): void {
  const hasInvalidEntry = entries.some((entry) => entry.valid === 'invalid');
  if (hasInvalidEntry) {
    return;
  }

  const validEntries = entries.filter((entry): entry is PublicOutcomeEntry & { valid: 'valid' } => entry.valid === 'valid');
  const outcomeCountResult = ownDataProperty(root, 'outcomeCount', '$.outcomeCount', issues);
  const outcomeCount =
    outcomeCountResult !== 'missing' && outcomeCountResult !== 'accessor'
      ? (outcomeCountResult as { kind: 'data'; value: unknown }).value
      : undefined;
  if (
    outcomeCount !== undefined &&
    typeof outcomeCount === 'number' &&
    Number.isSafeInteger(outcomeCount) &&
    outcomeCount >= 0
  ) {
    if (outcomeCount !== validEntries.length) {
      pushUniqueIssue(issues, {
        code: 'OUTCOME_COUNT_MISMATCH',
        path: '$.outcomeCount',
        message: 'outcomeCount must equal outcomes.length',
      });
    }
  }

  const outcomeIdsValue = root.outcomeIds;
  if (Array.isArray(outcomeIdsValue)) {
    if (outcomeIdsValue.length === validEntries.length) {
      for (let i = 0; i < outcomeIdsValue.length; i++) {
        const entry = validEntries[i];
        const idValue = outcomeIdsValue[i];
        if (
          entry.outcomeId === undefined ||
          typeof idValue !== 'string' ||
          entry.outcomeId !== idValue
        ) {
          pushUniqueIssue(issues, {
            code: 'OUTCOME_IDS_MISMATCH',
            path: '$.outcomeIds',
            message: 'outcomeIds must match canonical outcome identities',
          });
          break;
        }
      }
    } else {
      pushUniqueIssue(issues, {
        code: 'OUTCOME_IDS_MISMATCH',
        path: '$.outcomeIds',
        message: 'outcomeIds must match canonical outcome identities',
      });
    }
  }

  const seenGameIds = new Set<string>();
  const seenOutcomeIds = new Set<string>();
  for (const entry of validEntries) {
    if (entry.gameId) {
      if (seenGameIds.has(entry.gameId)) {
        pushUniqueIssue(issues, {
          code: 'DUPLICATE_GAME',
          path: outcomeFieldPath(entries.indexOf(entry), 'gameId'),
          message: `Duplicate gameId: ${entry.gameId}`,
        });
      } else {
        seenGameIds.add(entry.gameId);
      }
    }
    if (entry.outcomeId) {
      if (seenOutcomeIds.has(entry.outcomeId)) {
        pushUniqueIssue(issues, {
          code: 'DUPLICATE_OUTCOME_ID',
          path: outcomeFieldPath(entries.indexOf(entry), 'outcomeId'),
          message: `Duplicate outcomeId: ${entry.outcomeId}`,
        });
      } else {
        seenOutcomeIds.add(entry.outcomeId);
      }
    }
  }

  const sortedEntries = validEntries.slice().sort((left, right) => {
    const gameDiff = compareOrdinal(left.gameId ?? '', right.gameId ?? '');
    if (gameDiff !== 0) {
      return gameDiff;
    }
    const dateDiff = compareOrdinal(left.officialDate ?? '', right.officialDate ?? '');
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return compareOrdinal(left.outcomeId ?? '', right.outcomeId ?? '');
  });

  let noncanonical = false;
  for (let i = 0; i < sortedEntries.length; i++) {
    const current = entries[i];
    const expected = sortedEntries[i];
    if (
      (current.gameId ?? '') !== (expected.gameId ?? '') ||
      (current.officialDate ?? '') !== (expected.officialDate ?? '') ||
      (current.outcomeId ?? '') !== (expected.outcomeId ?? '')
    ) {
      pushUniqueIssue(issues, {
        code: 'NON_CANONICAL_ORDER',
        path: '$.outcomes',
        message: 'outcomes must be in canonical order',
      });
      noncanonical = true;
      break;
    }
  }

  if (!noncanonical) {
    const outcomeSetIdResult = ownDataProperty(root, 'outcomeSetId', '$.outcomeSetId', issues);
    if (outcomeSetIdResult !== 'missing' && outcomeSetIdResult !== 'accessor') {
      const outcomeSetIdValue = (outcomeSetIdResult as { kind: 'data'; value: unknown }).value;
      if (isNonEmptyTrimmedControlFreeString(outcomeSetIdValue)) {
        const canonicalOutcomeIds = sortedEntries
          .map((entry) => entry.outcomeId ?? '')
          .filter((id) => id.length > 0);
        const expectedOutcomeSetId = deterministicOutcomeSetId(canonicalOutcomeIds);
        if (outcomeSetIdValue !== expectedOutcomeSetId) {
          pushUniqueIssue(issues, {
            code: 'OUTCOME_SET_ID_MISMATCH',
            path: '$.outcomeSetId',
            message: 'outcomeSetId does not match deterministic set identity',
          });
        }
      }
    }
  }
}

export function validateMLBOfflineOfficialFinalGameOutcomeSet(
  proposed: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBOfflineOfficialFinalGameOutcomeSet;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBOfflineOfficialFinalGameOutcomeSetIssue[];
    }> {
  const issues: MLBOfflineOfficialFinalGameOutcomeSetIssue[] = [];

  if (!isPlainObject(proposed)) {
    issues.push({
      code: 'NOT_PLAIN_OBJECT',
      path: '$',
      message: 'Official final-game outcome set must be a plain object',
    });
    return { ok: false, issues: normalizeIssues(issues) };
  }

  const root = proposed as Record<string, unknown>;
  pushPublicRootFieldIssues(root, issues);
  if (issues.some((issue) => issue.path === '$' && issue.code === 'ODDS_CONTAMINATION')) {
    return { ok: false, issues: normalizeIssues(issues) };
  }

  validateFirewall(proposed, issues);
  if (issues.some((issue) => issue.code === 'ODDS_CONTAMINATION' || issue.code === 'INVALID_JSON_VALUE')) {
    return { ok: false, issues: normalizeIssues(issues) };
  }

  pushPublicRootValueIssues(root, issues);
  if (issues.some((issue) => ['MISSING_FIELD', 'INVALID_LITERAL', 'INVALID_STRING', 'INVALID_INTEGER'].includes(issue.code))) {
    const missingRequired = ROOT_FIELDS.some((field) => {
      const descriptor = Object.getOwnPropertyDescriptor(root, field);
      return !descriptor || !isDataDescriptor(descriptor);
    });
    if (missingRequired) {
      return { ok: false, issues: normalizeIssues(issues) };
    }
  }

  const outcomeIdsResult = pushOutcomeIdsArrayIssues(root.outcomeIds, issues);
  if (outcomeIdsResult.kind === 'invalid') {
    return { ok: false, issues: normalizeIssues(issues) };
  }

  let outcomesValue: unknown;
  try {
    outcomesValue = root.outcomes;
  } catch (error) {
    if (error instanceof TypeError) {
      pushUniqueIssue(issues, {
        code: 'INVALID_JSON_VALUE',
        path: '$.outcomes',
        message: 'outcomes contains an accessor property',
      });
      return { ok: false, issues: normalizeIssues(issues) };
    }
    throw error;
  }

  const outcomesResult = pushOutcomesArrayIssues(outcomesValue, issues);
  if (outcomesResult.kind === 'invalid') {
    return { ok: false, issues: normalizeIssues(issues) };
  }

  const { entries } = validatePublicOutcomes(outcomesResult.items, issues);
  validatePublicCollectionSemantics(root, entries, issues);

  if (issues.length === 0) {
    return {
      ok: true,
      value: proposed as MLBOfflineOfficialFinalGameOutcomeSet,
    };
  }

  return { ok: false, issues: normalizeIssues(issues) };
}

export function buildMLBOfflineOfficialFinalGameOutcomeSet(
  input: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBOfflineOfficialFinalGameOutcomeSet;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBOfflineOfficialFinalGameOutcomeSetIssue[];
    }> {
  const inputIssues: MLBOfflineOfficialFinalGameOutcomeSetIssue[] = [];

  if (!isPlainObject(input)) {
    pushUniqueIssue(inputIssues, {
      code: 'NOT_PLAIN_OBJECT',
      path: '$',
      message: 'Builder input must be a plain object',
    });
    return { ok: false, issues: normalizeIssues(inputIssues) };
  }

  const inputRoot = input as Record<string, unknown>;

  for (const symbol of Object.getOwnPropertySymbols(inputRoot)) {
    pushUniqueIssue(inputIssues, {
      code: 'UNKNOWN_FIELD',
      path: `$[${String(symbol)}]`,
      message: 'Unknown symbol property',
    });
  }

  for (const key of Object.getOwnPropertyNames(inputRoot)) {
    if (BUILDER_FIELDS.includes(key as (typeof BUILDER_FIELDS)[number])) {
      const descriptor = Object.getOwnPropertyDescriptor(inputRoot, key);
      if (descriptor && !isDataDescriptor(descriptor)) {
        pushUniqueIssue(inputIssues, {
          code: 'INVALID_JSON_VALUE',
          path: rootFieldPath(key),
          message: `Accessor property: ${key}`,
        });
      }
    }
  }

  const prohibitedKeys = collectOddsBoundaryIssues(inputRoot, inputIssues);

  if (inputRoot.stake !== undefined) {
    pushUniqueIssue(inputIssues, {
      code: 'PROHIBITED_CONCEPT',
      path: '$.stake',
      message: 'Prohibited field: stake',
    });
  }
  if (inputRoot.grade !== undefined) {
    pushUniqueIssue(inputIssues, {
      code: 'PROHIBITED_CONCEPT',
      path: '$.grade',
      message: 'Prohibited field: grade',
    });
  }

  if (inputRoot.stake !== undefined || inputRoot.grade !== undefined) {
    return { ok: false, issues: normalizeIssues(inputIssues) };
  }

  const outcomesResult = ownDataProperty(inputRoot, 'outcomes', '$.outcomes', inputIssues);
  if (outcomesResult === 'missing') {
    pushUniqueIssue(inputIssues, {
      code: 'MISSING_FIELD',
      path: '$.outcomes',
      message: 'outcomes is required',
    });
    return { ok: false, issues: normalizeIssues(inputIssues) };
  }
  if (outcomesResult === 'accessor') {
    return { ok: false, issues: normalizeIssues(inputIssues) };
  }
  const outcomesValue = (outcomesResult as { kind: 'data'; value: unknown }).value;

  if (!Array.isArray(outcomesValue)) {
    pushUniqueIssue(inputIssues, {
      code: 'INVALID_ARRAY',
      path: '$.outcomes',
      message: 'outcomes must be an array',
    });
    return { ok: false, issues: normalizeIssues(inputIssues) };
  }

  const builderArrayIssues: MLBOfflineOfficialFinalGameOutcomeSetIssue[] = [];
  const arrayResult = pushOutcomesArrayIssues(outcomesValue, builderArrayIssues);
  for (const issue of builderArrayIssues) {
    pushUniqueIssue(inputIssues, issue);
  }
  if (arrayResult.kind === 'invalid') {
    return { ok: false, issues: normalizeIssues(inputIssues) };
  }

  for (const key of Object.getOwnPropertyNames(inputRoot)) {
    if (key !== 'outcomes' && !prohibitedKeys.has(key)) {
      pushUniqueIssue(inputIssues, {
        code: 'UNKNOWN_FIELD',
        path: rootFieldPath(key),
        message: `Unknown field: ${key}`,
      });
    }
  }

  const { entries } = validatePublicOutcomes(arrayResult.items, inputIssues);
  if (inputIssues.some((issue) => issue.code === 'OUTCOME_ID_MISMATCH')) {
    return { ok: false, issues: normalizeIssues(inputIssues) };
  }

  const validEntries = entries.filter((entry): entry is PublicOutcomeEntry & { valid: 'valid' } => entry.valid === 'valid');
  if (validEntries.length !== entries.length) {
    return { ok: false, issues: normalizeIssues(inputIssues) };
  }

  const sortedEntries = validEntries.slice().sort((left, right) => {
    const gameDiff = compareOrdinal(left.gameId ?? '', right.gameId ?? '');
    if (gameDiff !== 0) {
      return gameDiff;
    }
    const dateDiff = compareOrdinal(left.officialDate ?? '', right.officialDate ?? '');
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return compareOrdinal(left.outcomeId ?? '', right.outcomeId ?? '');
  });

  const seenGameIds = new Set<string>();
  const seenOutcomeIds = new Set<string>();
  for (const entry of sortedEntries) {
    if (seenGameIds.has(entry.gameId ?? '')) {
      pushUniqueIssue(inputIssues, {
        code: 'DUPLICATE_GAME',
        path: outcomeFieldPath(entries.indexOf(entry), 'gameId'),
        message: `Duplicate gameId: ${entry.gameId}`,
      });
    } else {
      seenGameIds.add(entry.gameId ?? '');
    }
    if (seenOutcomeIds.has(entry.outcomeId ?? '')) {
      pushUniqueIssue(inputIssues, {
        code: 'DUPLICATE_OUTCOME_ID',
        path: outcomeFieldPath(entries.indexOf(entry), 'outcomeId'),
        message: `Duplicate outcomeId: ${entry.outcomeId}`,
      });
    } else {
      seenOutcomeIds.add(entry.outcomeId ?? '');
    }
  }

  if (inputIssues.length > 0) {
    return { ok: false, issues: normalizeIssues(inputIssues) };
  }

  const canonicalOutcomes = sortedEntries.map(
    (entry) => entry.original as Record<string, unknown>,
  );

  const outcomeIds = sortedEntries.map((entry) => entry.outcomeId as string);
  const outcomeSetId = deterministicOutcomeSetId(outcomeIds);

  const root = Object.freeze({
    contractVersion: MLB_OFFLINE_OFFICIAL_FINAL_GAME_OUTCOME_SET_CONTRACT_VERSION,
    sport: 'MLB' as const,
    target: 'OFFICIAL_FINAL_GAME_WINNER' as const,
    outcomeSetId,
    outcomeCount: canonicalOutcomes.length,
    outcomeIds: Object.freeze(outcomeIds) as readonly string[],
    outcomes: Object.freeze(canonicalOutcomes) as readonly MLBOfflineOfficialFinalGameOutcome[],
  });

  const validation = validateMLBOfflineOfficialFinalGameOutcomeSet(root);
  if (!validation.ok) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'GENERATED_OUTCOME_SET_INVALID',
          path: '$',
          message: 'Generated official final-game outcome set failed validation',
        },
      ]),
    };
  }

  return { ok: true, value: root };
}
