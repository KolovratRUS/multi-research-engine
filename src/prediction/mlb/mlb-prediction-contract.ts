import {
  assertNoOddsContamination,
  type OddsContaminationViolation,
} from '../firewall/odds-contamination-guard';

export const MLB_PREDICTION_INPUT_CONTRACT_VERSION =
  'mlb-prediction-input-v1' as const;

export const MLB_PREDICTION_DRAFT_CONTRACT_VERSION =
  'mlb-prediction-draft-v1' as const;

export type MLBPredictionSelectionStatus =
  | 'PENDING_MODEL'
  | 'NO_SELECTION'
  | 'MODEL_ERROR';

export type MLBAvailabilityState =
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'UNCONFIRMED'
  | 'CHANGED_AFTER_SNAPSHOT';

export type MLBDataCompleteness =
  | 'COMPLETE'
  | 'PARTIAL'
  | 'INSUFFICIENT';

export type MLBPredictionInputContract = Readonly<{
  contractVersion: 'mlb-prediction-input-v1';
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  game: Readonly<{
    gameId: string;
    scheduledStartAt: string;
    homeTeamId: string;
    awayTeamId: string;
    venueId: string | null;
    neutralSite: boolean;
    doubleheader: null | Readonly<{
      doubleheaderId: string;
      gameNumber: 1 | 2;
    }>;
  }>;
  snapshot: Readonly<{
    snapshotId: string;
    capturedAt: string;
    dataCutoffAt: string;
    sourceUpdatedAt: string | null;
    dataCompleteness: MLBDataCompleteness;
  }>;
  availability: Readonly<{
    homeStartingPitcher: MLBAvailabilityState;
    awayStartingPitcher: MLBAvailabilityState;
  }>;
  researchPayload: Readonly<Record<string, unknown>>;
}>;

export type MLBPredictionDraftContract = Readonly<{
  contractVersion: 'mlb-prediction-draft-v1';
  draftId: string;
  input: MLBPredictionInputContract;
  generatedAt: string;
  selectionStatus: MLBPredictionSelectionStatus;
  noSelectionReason: string | null;
}>;

export type MLBPredictionContractValidationIssue = Readonly<{
  code:
    | 'NOT_PLAIN_OBJECT'
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'INVALID_LITERAL'
    | 'INVALID_STRING'
    | 'INVALID_BOOLEAN'
    | 'INVALID_INTEGER'
    | 'INVALID_TIMESTAMP'
    | 'INVALID_TIMESTAMP_ORDER'
    | 'DUPLICATE_TEAM'
    | 'INVALID_DOUBLEHEADER'
    | 'INVALID_SELECTION_STATUS'
    | 'INVALID_NO_SELECTION_REASON'
    | 'ODDS_CONTAMINATION'
    | 'INVALID_RESEARCH_PAYLOAD_VALUE';
  path: string;
  message: string;
}>;

function issue(
  code: MLBPredictionContractValidationIssue['code'],
  path: string,
  message: string,
): MLBPredictionContractValidationIssue {
  return { code, path, message };
}

function isPlainObject(input: unknown): input is Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
}

function validateString(
  value: unknown,
  path: string,
  fieldName: string,
): string | MLBPredictionContractValidationIssue {
  if (typeof value !== 'string') {
    return issue('INVALID_STRING', path, `${fieldName} must be a string`);
  }
  if (value.length === 0) {
    return issue('INVALID_STRING', path, `${fieldName} must not be empty`);
  }
  if (value.trim() !== value) {
    return issue('INVALID_STRING', path, `${fieldName} must not be padded`);
  }
  if (/[\u0000-\u0008\u000a-\u001f]/.test(value)) {
    return issue('INVALID_STRING', path, `${fieldName} must not contain control characters`);
  }
  return value;
}

const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function parseTimestamp(value: unknown, path: string, fieldName: string): string | MLBPredictionContractValidationIssue {
  if (typeof value !== 'string') {
    return issue('INVALID_TIMESTAMP', path, `${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed !== value) {
    return issue('INVALID_TIMESTAMP', path, `${fieldName} must not be padded`);
  }
  if (trimmed.length < 11) {
    return issue('INVALID_TIMESTAMP', path, `${fieldName} must be an RFC 3339/ISO-style timestamp`);
  }
  if (!TIMESTAMP_RE.test(trimmed)) {
    return issue('INVALID_TIMESTAMP', path, `${fieldName} must include an explicit timezone`);
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) {
    return issue('INVALID_TIMESTAMP', path, `${fieldName} must be a parseable timestamp`);
  }
  return trimmed;
}

function parseTimestampToMs(value: unknown, path: string, fieldName: string): number | MLBPredictionContractValidationIssue {
  const stringResult = parseTimestamp(value, path, fieldName);
  if (typeof stringResult === 'object') {
    return stringResult;
  }
  return Number(Date.parse(stringResult));
}

const INPUT_FIELDS = [
  'contractVersion',
  'sport',
  'target',
  'game',
  'snapshot',
  'availability',
  'researchPayload',
] as const;

const SNAPSHOT_FIELDS = [
  'snapshotId',
  'capturedAt',
  'dataCutoffAt',
  'sourceUpdatedAt',
  'dataCompleteness',
] as const;

const AVAILABILITY_FIELDS = [
  'homeStartingPitcher',
  'awayStartingPitcher',
] as const;

const VALID_COMPLETENESS = new Set<MLBDataCompleteness>([
  'COMPLETE',
  'PARTIAL',
  'INSUFFICIENT',
]);

const VALID_SELECTION_STATUS = new Set<MLBPredictionSelectionStatus>([
  'PENDING_MODEL',
  'NO_SELECTION',
  'MODEL_ERROR',
]);

const VALID_AVAILABILITY = new Set<MLBAvailabilityState>([
  'AVAILABLE',
  'UNAVAILABLE',
  'UNCONFIRMED',
  'CHANGED_AFTER_SNAPSHOT',
]);

const DRAFT_FIELDS = [
  'contractVersion',
  'draftId',
  'input',
  'generatedAt',
  'selectionStatus',
  'noSelectionReason',
] as const;

function pushUnknownFields(
  issues: MLBPredictionContractValidationIssue[],
  value: Record<string, unknown>,
  path: string,
  allowed: Set<string>,
  label: string,
): void {
  const strings = Object.getOwnPropertyNames(value);
  for (const key of strings) {
    if (!allowed.has(key)) {
      issues.push(issue('UNKNOWN_FIELD', `${path}.${key}`, `Unknown ${label} ${key}`));
    }
  }
  const symbols = Object.getOwnPropertySymbols(value);
  for (const symbol of symbols) {
    issues.push(
      issue(
        'UNKNOWN_FIELD',
        `${path}[${String(symbol)}]`,
        `Unknown ${label} ${String(symbol)}`,
      ),
    );
  }
}

function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor {
  return descriptor !== undefined && Object.prototype.hasOwnProperty.call(descriptor, 'value');
}

function validateJSONLikeValue(
  value: unknown,
  path: string,
): MLBPredictionContractValidationIssue | null {
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    return issue('INVALID_RESEARCH_PAYLOAD_VALUE', path, 'researchPayload values must be JSON-compatible');
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return issue('INVALID_RESEARCH_PAYLOAD_VALUE', path, 'researchPayload values must be JSON-compatible');
  }
  if (typeof value === 'object' && value !== null) {
    if (!isPlainObject(value) && !Array.isArray(value)) {
      return issue('INVALID_RESEARCH_PAYLOAD_VALUE', path, 'researchPayload values must be JSON-compatible');
    }
  }
  return null;
}

function validateJSONLikePayload(
  value: unknown,
  path: string,
  visited: WeakSet<object>,
  collectIssue: (issue: MLBPredictionContractValidationIssue) => void,
): MLBPredictionContractValidationIssue | null {
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    return issue('INVALID_RESEARCH_PAYLOAD_VALUE', path, 'researchPayload values must be JSON-compatible');
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return issue('INVALID_RESEARCH_PAYLOAD_VALUE', path, 'researchPayload values must be JSON-compatible');
  }
  if (typeof value === 'object' && value !== null) {
    if (!isPlainObject(value) && !Array.isArray(value)) {
      return issue('INVALID_RESEARCH_PAYLOAD_VALUE', path, 'researchPayload values must be JSON-compatible');
    }
    if (visited.has(value)) {
      return issue('INVALID_RESEARCH_PAYLOAD_VALUE', path, 'researchPayload values must be JSON-compatible');
    }
    visited.add(value);
    try {
      if (isPlainObject(value)) {
        const symbols = Object.getOwnPropertySymbols(value);
        for (const symbol of symbols) {
          collectIssue(
            issue(
              'UNKNOWN_FIELD',
              `${path}[${String(symbol)}]`,
              `Unknown research payload symbol ${String(symbol)}`,
            ),
          );
        }
        const keys = Object.getOwnPropertyNames(value);
        for (const key of keys) {
          const descriptor = Object.getOwnPropertyDescriptor(value, key);
          if (isDataDescriptor(descriptor)) {
            const childIssue = validateJSONLikePayload(descriptor.value, `${path}.${key}`, visited, collectIssue);
            if (childIssue !== null) {
              return childIssue;
            }
          } else if (descriptor) {
            return issue('INVALID_RESEARCH_PAYLOAD_VALUE', `${path}.${key}`, 'researchPayload values must be JSON-compatible');
          }
        }
      } else if (Array.isArray(value)) {
        const symbols = Object.getOwnPropertySymbols(value);
        for (const symbol of symbols) {
          collectIssue(
            issue(
              'UNKNOWN_FIELD',
              `${path}[${String(symbol)}]`,
              `Unknown research payload symbol ${String(symbol)}`,
            ),
          );
        }
        const keys = Object.getOwnPropertyNames(value);
        for (const key of keys) {
          if (key === 'length') {
            continue;
          }
          const descriptor = Object.getOwnPropertyDescriptor(value, key);
          if (/^\d+$/.test(key)) {
            if (isDataDescriptor(descriptor)) {
              const childIssue = validateJSONLikePayload(
                descriptor.value,
                `${path}[${key}]`,
                visited,
                collectIssue,
              );
              if (childIssue !== null) {
                return childIssue;
              }
            } else if (descriptor) {
              return issue('INVALID_RESEARCH_PAYLOAD_VALUE', `${path}[${key}]`, 'researchPayload values must be JSON-compatible');
            }
          } else {
            if (isDataDescriptor(descriptor)) {
              const childIssue = validateJSONLikePayload(
                descriptor.value,
                `${path}.${key}`,
                visited,
                collectIssue,
              );
              if (childIssue !== null) {
                return childIssue;
              }
            } else if (descriptor) {
              return issue('INVALID_RESEARCH_PAYLOAD_VALUE', `${path}.${key}`, 'researchPayload values must be JSON-compatible');
            }
          }
        }
      }
    } finally {
      visited.delete(value);
    }
  }
  return null;
}

export function validateMLBPredictionInputContract(
  value: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBPredictionInputContract;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBPredictionContractValidationIssue[];
    }> {
  const issues: MLBPredictionContractValidationIssue[] = [];

  if (!isPlainObject(value)) {
    return { ok: false, issues: [issue('NOT_PLAIN_OBJECT', '$', 'Input must be a plain object')] };
  }

  const input = value as Record<string, unknown>;

  pushUnknownFields(issues, input, '$', new Set(INPUT_FIELDS), 'input field');

  if (input.contractVersion !== MLB_PREDICTION_INPUT_CONTRACT_VERSION) {
    issues.push(
      issue(
        'INVALID_LITERAL',
        '$.contractVersion',
        `contractVersion must be ${MLB_PREDICTION_INPUT_CONTRACT_VERSION}`,
      ),
    );
  }

  if (input.sport !== 'MLB') {
    issues.push(issue('INVALID_LITERAL', '$.sport', 'sport must be MLB'));
  }

  if (input.target !== 'OFFICIAL_FINAL_GAME_WINNER') {
    issues.push(
      issue(
        'INVALID_LITERAL',
        '$.target',
        `target must be OFFICIAL_FINAL_GAME_WINNER`,
      ),
    );
  }

  if (!isPlainObject(input.game)) {
    issues.push(issue('NOT_PLAIN_OBJECT', '$.game', 'game must be a plain object'));
  } else {
    const game = input.game as Record<string, unknown>;

    pushUnknownFields(issues, game, '$.game', new Set(['gameId', 'scheduledStartAt', 'homeTeamId', 'awayTeamId', 'venueId', 'neutralSite', 'doubleheader']), 'game field');

    const gameId = validateString(game.gameId, '$.game.gameId', 'gameId');
    if (typeof gameId === 'object') {
      issues.push(gameId);
    }

    const scheduledStartAtMs = parseTimestampToMs(game.scheduledStartAt, '$.game.scheduledStartAt', 'scheduledStartAt');
    if (typeof scheduledStartAtMs === 'object') {
      issues.push(scheduledStartAtMs as MLBPredictionContractValidationIssue);
    }

    const homeTeamId = validateString(game.homeTeamId, '$.game.homeTeamId', 'homeTeamId');
    if (typeof homeTeamId === 'object') {
      issues.push(homeTeamId);
    }

    const awayTeamId = validateString(game.awayTeamId, '$.game.awayTeamId', 'awayTeamId');
    if (typeof awayTeamId === 'object') {
      issues.push(awayTeamId);
    }

    if (typeof game.venueId !== 'string' && game.venueId !== null) {
      issues.push(issue('INVALID_STRING', '$.game.venueId', 'venueId must be a string or null'));
    } else if (typeof game.venueId === 'string') {
      const venueValidation = validateString(game.venueId, '$.game.venueId', 'venueId');
      if (typeof venueValidation === 'object') {
        issues.push(venueValidation);
      }
    }

    if (typeof game.neutralSite !== 'boolean') {
      issues.push(issue('INVALID_BOOLEAN', '$.game.neutralSite', 'neutralSite must be a boolean'));
    }

    if (game.doubleheader !== null && !isPlainObject(game.doubleheader)) {
      issues.push(issue('INVALID_DOUBLEHEADER', '$.game.doubleheader', 'doubleheader must be null or an object'));
    } else if (isPlainObject(game.doubleheader)) {
      const doubleheader = game.doubleheader as Record<string, unknown>;
      pushUnknownFields(issues, doubleheader, '$.game.doubleheader', new Set(['doubleheaderId', 'gameNumber']), 'doubleheader field');

      const doubleheaderId = validateString(doubleheader.doubleheaderId, '$.game.doubleheader.doubleheaderId', 'doubleheaderId');
      if (typeof doubleheaderId === 'object') {
        issues.push(doubleheaderId);
      }

      if (
        typeof doubleheader.gameNumber !== 'number' ||
        ![1, 2].includes(doubleheader.gameNumber)
      ) {
        issues.push(issue('INVALID_DOUBLEHEADER', '$.game.doubleheader.gameNumber', 'doubleheader.gameNumber must be 1 or 2'));
      }
    }

    if (
      typeof homeTeamId === 'string' &&
      typeof awayTeamId === 'string' &&
      homeTeamId === awayTeamId
    ) {
      issues.push(issue('DUPLICATE_TEAM', '$.game', 'homeTeamId and awayTeamId must differ'));
    }
  }

  if (!isPlainObject(input.snapshot)) {
    issues.push(issue('NOT_PLAIN_OBJECT', '$.snapshot', 'snapshot must be a plain object'));
  } else {
    const snapshot = input.snapshot as Record<string, unknown>;

    pushUnknownFields(issues, snapshot, '$.snapshot', new Set(SNAPSHOT_FIELDS), 'snapshot field');

    const snapshotId = validateString(snapshot.snapshotId, '$.snapshot.snapshotId', 'snapshotId');
    if (typeof snapshotId === 'object') {
      issues.push(snapshotId);
    }

    const capturedAtMs = parseTimestampToMs(snapshot.capturedAt, '$.snapshot.capturedAt', 'capturedAt');
    if (typeof capturedAtMs === 'object') {
      issues.push(capturedAtMs as MLBPredictionContractValidationIssue);
    }

    const dataCutoffAtMs = parseTimestampToMs(snapshot.dataCutoffAt, '$.snapshot.dataCutoffAt', 'dataCutoffAt');
    if (typeof dataCutoffAtMs === 'object') {
      issues.push(dataCutoffAtMs as MLBPredictionContractValidationIssue);
    }

    if (
      typeof dataCutoffAtMs === 'number' &&
      typeof capturedAtMs === 'number' &&
      dataCutoffAtMs > capturedAtMs
    ) {
      issues.push(
        issue(
          'INVALID_TIMESTAMP_ORDER',
          '$.snapshot',
          'dataCutoffAt must be <= capturedAt',
        ),
      );
    }

    const game = isPlainObject(input.game)
      ? (input.game as Record<string, unknown>)
      : null;

    if (
      typeof capturedAtMs === 'number' &&
      game !== null &&
      typeof game.scheduledStartAt === 'string'
    ) {
      const scheduledStartAtMs = parseTimestampToMs(game.scheduledStartAt, '$.game.scheduledStartAt', 'scheduledStartAt');
      if (
        typeof scheduledStartAtMs === 'number' &&
        capturedAtMs >= scheduledStartAtMs
      ) {
        issues.push(
          issue(
            'INVALID_TIMESTAMP_ORDER',
            '$.snapshot',
            'capturedAt must be < scheduledStartAt',
          ),
        );
      }
    }

    if (snapshot.sourceUpdatedAt !== null) {
      const sourceUpdatedAtMs = parseTimestampToMs(snapshot.sourceUpdatedAt, '$.snapshot.sourceUpdatedAt', 'sourceUpdatedAt');
      if (typeof sourceUpdatedAtMs === 'object') {
        issues.push(sourceUpdatedAtMs as MLBPredictionContractValidationIssue);
      } else if (
        typeof sourceUpdatedAtMs === 'number' &&
        typeof dataCutoffAtMs === 'number' &&
        sourceUpdatedAtMs > dataCutoffAtMs
      ) {
        issues.push(
          issue(
            'INVALID_TIMESTAMP_ORDER',
            '$.snapshot',
            'sourceUpdatedAt must be <= dataCutoffAt',
          ),
        );
      }
    }

    if (!VALID_COMPLETENESS.has(snapshot.dataCompleteness as MLBDataCompleteness)) {
      issues.push(
        issue(
          'INVALID_LITERAL',
          '$.snapshot.dataCompleteness',
          'dataCompleteness must be COMPLETE, PARTIAL, or INSUFFICIENT',
        ),
      );
    }
  }

  if (!isPlainObject(input.availability)) {
    issues.push(issue('NOT_PLAIN_OBJECT', '$.availability', 'availability must be a plain object'));
  } else {
    const availability = input.availability as Record<string, unknown>;

    pushUnknownFields(issues, availability, '$.availability', new Set(AVAILABILITY_FIELDS), 'availability field');

    for (const field of AVAILABILITY_FIELDS) {
      const value = availability[field];
      if (!VALID_AVAILABILITY.has(value as MLBAvailabilityState)) {
        issues.push(
          issue(
            'INVALID_LITERAL',
            `$.availability.${field}`,
            `${field} must be AVAILABLE, UNAVAILABLE, UNCONFIRMED, or CHANGED_AFTER_SNAPSHOT`,
          ),
        );
      }
    }
  }

  if (!isPlainObject(input.researchPayload)) {
    issues.push(issue('NOT_PLAIN_OBJECT', '$.researchPayload', 'researchPayload must be a plain object'));
  } else {
    const researchPayload = input.researchPayload as Record<string, unknown>;

    const symbols = Object.getOwnPropertySymbols(researchPayload);
    for (const symbol of symbols) {
      issues.push(
        issue(
          'UNKNOWN_FIELD',
          `$.researchPayload[${String(symbol)}]`,
          `Unknown research payload symbol ${String(symbol)}`,
        ),
      );
    }

    const visited = new WeakSet<object>();
    for (const key of Object.getOwnPropertyNames(researchPayload)) {
      const descriptor = Object.getOwnPropertyDescriptor(researchPayload, key);
      if (isDataDescriptor(descriptor)) {
        const value = descriptor.value;
        const shallow = validateJSONLikeValue(value, `$.researchPayload.${key}`);
        if (shallow !== null) {
          issues.push(shallow);
        }
        const deep = validateJSONLikePayload(value, `$.researchPayload.${key}`, visited, (issue) => issues.push(issue));
        if (deep !== null) {
          issues.push(deep);
        }
      } else if (descriptor) {
        issues.push(
          issue(
            'INVALID_RESEARCH_PAYLOAD_VALUE',
            `$.researchPayload.${key}`,
            'researchPayload values must be JSON-compatible',
          ),
        );
      }
    }

    try {
      assertNoOddsContamination(input.researchPayload);
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.name === 'UninspectableAccessorPropertyError' &&
          error.message.startsWith('UNINSPECTABLE_ACCESSOR_PROPERTY\n')
        ) {
          const lines = error.message
            .split('\n')
            .filter((line) => line.startsWith('path='));
          for (const line of lines) {
            const accessorPath = line.slice(5);
            issues.push(
              issue(
                'INVALID_RESEARCH_PAYLOAD_VALUE',
                `$.researchPayload${accessorPath.slice(1)}`,
                'researchPayload values must be JSON-compatible',
              ),
            );
          }
        } else if (error.message.startsWith('ODDS_CONTAMINATION')) {
          const lines = error.message
            .split('\n')
            .filter((line) => line.startsWith('path='));
          for (const line of lines) {
            const firewallPath = line.slice(5).split('; ')[0];
            issues.push(
              issue(
                'ODDS_CONTAMINATION',
                `$.researchPayload${firewallPath.slice(1)}`,
                `researchPayload contains prohibited field at ${firewallPath}`,
              ),
            );
          }
        }
      }
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, value: input as MLBPredictionInputContract };
}

export function validateMLBPredictionDraftContract(
  value: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBPredictionDraftContract;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBPredictionContractValidationIssue[];
    }> {
  const issues: MLBPredictionContractValidationIssue[] = [];

  if (!isPlainObject(value)) {
    return { ok: false, issues: [issue('NOT_PLAIN_OBJECT', '$', 'Draft must be a plain object')] };
  }

  const draft = value as Record<string, unknown>;

  pushUnknownFields(issues, draft, '$', new Set(DRAFT_FIELDS), 'draft field');

  if (draft.contractVersion !== MLB_PREDICTION_DRAFT_CONTRACT_VERSION) {
    issues.push(
      issue(
        'INVALID_LITERAL',
        '$.contractVersion',
        `contractVersion must be ${MLB_PREDICTION_DRAFT_CONTRACT_VERSION}`,
      ),
    );
  }

  const draftId = validateString(draft.draftId, '$.draftId', 'draftId');
  if (typeof draftId === 'object') {
    issues.push(draftId);
  }

  const inputResult = validateMLBPredictionInputContract(draft.input);
  if (!inputResult.ok) {
    for (const inputIssue of inputResult.issues) {
      issues.push({ ...inputIssue, path: `$.input${inputIssue.path.slice(1)}` });
    }
  }

  const generatedAtMs = parseTimestampToMs(draft.generatedAt, '$.generatedAt', 'generatedAt');
  if (typeof generatedAtMs === 'object') {
    issues.push(generatedAtMs as MLBPredictionContractValidationIssue);
  }

  if (
    typeof generatedAtMs === 'number' &&
    inputResult.ok
  ) {
    const cutoffMs = Number(Date.parse(inputResult.value.snapshot.dataCutoffAt));
    const startMs = Number(Date.parse(inputResult.value.game.scheduledStartAt));

    if (generatedAtMs < cutoffMs) {
      issues.push(
        issue(
          'INVALID_TIMESTAMP_ORDER',
          '$.generatedAt',
          'generatedAt must be >= dataCutoffAt',
        ),
      );
    }

    if (generatedAtMs >= startMs) {
      issues.push(
        issue(
          'INVALID_TIMESTAMP_ORDER',
          '$.generatedAt',
          'generatedAt must be < scheduledStartAt',
        ),
      );
    }
  }

  if (!VALID_SELECTION_STATUS.has(draft.selectionStatus as MLBPredictionSelectionStatus)) {
    issues.push(
      issue(
        'INVALID_SELECTION_STATUS',
        '$.selectionStatus',
        'selectionStatus must be PENDING_MODEL, NO_SELECTION, or MODEL_ERROR',
      ),
    );
  }

  if (draft.selectionStatus === 'PENDING_MODEL') {
    if (draft.noSelectionReason !== null) {
      issues.push(
        issue(
          'INVALID_NO_SELECTION_REASON',
          '$.noSelectionReason',
          'noSelectionReason must be null when selectionStatus is PENDING_MODEL',
        ),
      );
    }
  } else if (draft.noSelectionReason === null || draft.noSelectionReason === undefined) {
    issues.push(
      issue(
        'INVALID_NO_SELECTION_REASON',
        '$.noSelectionReason',
        'noSelectionReason must be provided when selectionStatus is not PENDING_MODEL',
      ),
    );
  } else {
    const reason = validateString(draft.noSelectionReason, '$.noSelectionReason', 'noSelectionReason');
    if (typeof reason === 'object') {
      issues.push(reason);
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, value: draft as MLBPredictionDraftContract };
}
