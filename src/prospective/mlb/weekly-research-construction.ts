import { isAbsolute, win32 } from 'node:path';
import {
  type MLBProspectiveGameSnapshot,
  type MLBProspectiveScheduleSnapshot,
  type MLBProspectiveValidationMessage,
  validateProspectiveScheduleSnapshot,
} from './weekly-test-schemas';

export const CONSTRUCTION_VERSION = 'mlb-weekly-prospective-research-construction-v1';
export const LOCK_VERSION = 'mlb-manual-week-lock-v1';

export interface MLBManualWeekLockedSnapshot {
  readonly lockVersion: 'mlb-manual-week-lock-v1';
  readonly runId: string;
  readonly lockId: string;
  readonly sourceMode: 'manual-schedule';
  readonly weekStart: string;
  readonly weekEnd: string;
  readonly lockedAt: string;
  readonly snapshot: MLBProspectiveScheduleSnapshot;
  readonly validationMessages: readonly MLBProspectiveValidationMessage[];
  readonly warnings: readonly string[];
}

export interface MLBWeeklyProspectiveResearchGame {
  readonly gameId: string;
  readonly officialDate: string;
  readonly scheduledStartTime: string;
  readonly awayTeam: string;
  readonly homeTeam: string;
  readonly snapshotTimestamp: string;
  readonly sourceProvenance: string;
  readonly constructionStatus: 'pending-research';
  readonly researchMode: 'pregame';
  readonly researchScope: 'FULL';
  readonly constructionMessages: readonly MLBProspectiveValidationMessage[];
  readonly warnings: readonly string[];
}

export interface MLBWeeklyProspectiveResearchPackage {
  readonly constructionVersion: 'mlb-weekly-prospective-research-construction-v1';
  readonly lockVersion: 'mlb-manual-week-lock-v1';
  readonly runId: string;
  readonly lockId: string;
  readonly sourceMode: 'manual-schedule';
  readonly weekStart: string;
  readonly weekEnd: string;
  readonly constructedAt: string;
  readonly lockedAt: string;
  readonly inputSnapshot: MLBProspectiveScheduleSnapshot;
  readonly games: readonly MLBWeeklyProspectiveResearchGame[];
  readonly constructionWarnings: readonly string[];
  readonly constructionMessages: readonly MLBProspectiveValidationMessage[];
}

const FORBIDDEN_FIELDS = new Set([
  'finalScore',
  'completedGameState',
  'actualStartingPitchers',
  'outcome',
  'outcomeStatus',
  'finalStatus',
  'closingOdds',
  'impliedProbability',
  'odds',
  'market',
  'price',
]);

const ENVIRONMENT_METADATA_FIELDS = new Set([
  'environment',
  'env',
  'process',
  'cwd',
  'hostname',
]);

function error(code: string, message: string): MLBProspectiveValidationMessage {
  return { severity: 'error', code, message };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function isNonEmptyString(input: unknown): input is string {
  return typeof input === 'string' && input.trim() !== '';
}

function isStringArray(input: unknown): input is string[] {
  return Array.isArray(input) && input.every((value) => typeof value === 'string');
}

function isAbsolutePathString(input: string): boolean {
  return isAbsolute(input) || win32.isAbsolute(input);
}

function pathForProperty(parentPath: string, property: string): string {
  return parentPath === '' ? property : `${parentPath}.${property}`;
}

function scanUnsafeInput(
  input: unknown,
  messages: MLBProspectiveValidationMessage[],
  inputPath = '',
): void {
  if (typeof input === 'string') {
    if (isAbsolutePathString(input)) {
      messages.push(error(
        'WEEKLY_RESEARCH_ABSOLUTE_PATH',
        `locked artifact must not contain an absolute path at ${inputPath || 'input'}`,
      ));
    }
    return;
  }

  if (Array.isArray(input)) {
    for (let index = 0; index < input.length; index++) {
      scanUnsafeInput(input[index], messages, `${inputPath}[${index}]`);
    }
    return;
  }

  if (!isRecord(input)) {
    return;
  }

  for (const [property, value] of Object.entries(input)) {
    const propertyIsAbsolutePath = isAbsolutePathString(property);
    const propertyPath = pathForProperty(
      inputPath,
      propertyIsAbsolutePath ? '[absolute-path-key]' : property,
    );
    if (propertyIsAbsolutePath) {
      messages.push(error(
        'WEEKLY_RESEARCH_ABSOLUTE_PATH',
        `locked artifact must not contain an absolute path key at ${inputPath || 'input'}`,
      ));
    }
    if (FORBIDDEN_FIELDS.has(property)) {
      messages.push(error(
        'WEEKLY_RESEARCH_FORBIDDEN_FIELD',
        `locked artifact must not contain ${property} at ${propertyPath}`,
      ));
    }
    if (ENVIRONMENT_METADATA_FIELDS.has(property)) {
      messages.push(error(
        'WEEKLY_RESEARCH_ENVIRONMENT_METADATA',
        `locked artifact must not contain environment metadata at ${propertyPath}`,
      ));
    }
    scanUnsafeInput(value, messages, propertyPath);
  }
}

function validateLockedMetadata(
  record: Record<string, unknown>,
  messages: MLBProspectiveValidationMessage[],
): void {
  for (const field of ['runId', 'lockId', 'weekStart', 'weekEnd', 'lockedAt'] as const) {
    if (!isNonEmptyString(record[field])) {
      messages.push(error(
        'WEEKLY_RESEARCH_SNAPSHOT_INVALID',
        `locked artifact requires ${field}`,
      ));
    }
  }

  if (!isStringArray(record.warnings)) {
    messages.push(error(
      'WEEKLY_RESEARCH_SNAPSHOT_INVALID',
      'locked artifact warnings must be an array of strings',
    ));
  }
}

function validateSnapshotStructure(
  snapshot: unknown,
  lockedRecord: Record<string, unknown>,
  messages: MLBProspectiveValidationMessage[],
): void {
  if (!isRecord(snapshot)) {
    messages.push(error(
      'WEEKLY_RESEARCH_SNAPSHOT_INVALID',
      'locked artifact requires a valid snapshot object',
    ));
    return;
  }

  const nestedMessages = validateProspectiveScheduleSnapshot(snapshot);
  for (const nestedMessage of nestedMessages) {
    messages.push(error(
      'WEEKLY_RESEARCH_SNAPSHOT_INVALID',
      `snapshot validation failed: ${nestedMessage.code}: ${nestedMessage.message}`,
    ));
  }

  if (snapshot.sourceMode !== 'manual-schedule') {
    messages.push(error(
      'WEEKLY_RESEARCH_SNAPSHOT_INVALID',
      'snapshot sourceMode must be manual-schedule',
    ));
  }
  if (
    isNonEmptyString(lockedRecord.runId)
    && snapshot.runId !== lockedRecord.runId
  ) {
    messages.push(error(
      'WEEKLY_RESEARCH_SNAPSHOT_INVALID',
      'snapshot runId must match locked artifact runId',
    ));
  }
  if (!isStringArray(snapshot.warnings)) {
    messages.push(error(
      'WEEKLY_RESEARCH_SNAPSHOT_INVALID',
      'snapshot warnings must be an array of strings',
    ));
  }

  if (!Array.isArray(snapshot.games)) {
    return;
  }
  if (snapshot.games.length === 0) {
    messages.push(error(
      'WEEKLY_RESEARCH_SNAPSHOT_EMPTY',
      'snapshot games must not be empty',
    ));
    return;
  }

  const requiredGameFields: readonly (keyof MLBProspectiveGameSnapshot)[] = [
    'gameId',
    'officialDate',
    'scheduledStartTime',
    'awayTeam',
    'homeTeam',
    'snapshotTimestamp',
    'sourceProvenance',
  ];
  for (let index = 0; index < snapshot.games.length; index++) {
    const game = snapshot.games[index];
    if (!isRecord(game)) {
      continue;
    }
    for (const field of requiredGameFields) {
      if (!isNonEmptyString(game[field])) {
        messages.push(error(
          'WEEKLY_RESEARCH_SNAPSHOT_INVALID',
          `snapshot game[${index}] requires ${field}`,
        ));
      }
    }
  }
}

export function validateMLBManualWeekLockedSnapshot(
  input: unknown,
): MLBProspectiveValidationMessage[] {
  const messages: MLBProspectiveValidationMessage[] = [];

  if (!isRecord(input)) {
    return [error(
      'WEEKLY_RESEARCH_INPUT_NOT_OBJECT',
      'locked week artifact must be an object',
    )];
  }

  scanUnsafeInput(input, messages);

  if (input.lockVersion !== LOCK_VERSION) {
    messages.push(error(
      'WEEKLY_RESEARCH_LOCK_VERSION_INVALID',
      `lockVersion must be ${LOCK_VERSION}`,
    ));
  }
  if (input.sourceMode !== 'manual-schedule') {
    messages.push(error(
      'WEEKLY_RESEARCH_SOURCE_MODE_UNSUPPORTED',
      'sourceMode must be manual-schedule',
    ));
  }
  if (!Array.isArray(input.validationMessages) || input.validationMessages.length !== 0) {
    messages.push(error(
      'WEEKLY_RESEARCH_VALIDATION_MESSAGES_PRESENT',
      'locked artifact validationMessages must be an empty array',
    ));
  }

  validateLockedMetadata(input, messages);
  validateSnapshotStructure(input.snapshot, input, messages);

  return messages;
}

export function constructMLBWeeklyProspectiveResearchPackage(
  input: MLBManualWeekLockedSnapshot,
): MLBWeeklyProspectiveResearchPackage {
  const games = input.snapshot.games.map<MLBWeeklyProspectiveResearchGame>((game) => ({
    gameId: game.gameId,
    officialDate: game.officialDate,
    scheduledStartTime: game.scheduledStartTime,
    awayTeam: game.awayTeam,
    homeTeam: game.homeTeam,
    snapshotTimestamp: game.snapshotTimestamp,
    sourceProvenance: game.sourceProvenance,
    constructionStatus: 'pending-research',
    researchMode: 'pregame',
    researchScope: 'FULL',
    constructionMessages: [],
    warnings: [],
  }));

  return {
    constructionVersion: CONSTRUCTION_VERSION,
    lockVersion: input.lockVersion,
    runId: input.runId,
    lockId: input.lockId,
    sourceMode: input.sourceMode,
    weekStart: input.weekStart,
    weekEnd: input.weekEnd,
    constructedAt: input.lockedAt,
    lockedAt: input.lockedAt,
    inputSnapshot: input.snapshot,
    games,
    constructionWarnings: [...input.warnings],
    constructionMessages: [],
  };
}
