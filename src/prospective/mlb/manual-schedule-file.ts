import type { MLBProspectiveValidationMessage, MLBProspectiveScheduleSnapshot } from './weekly-test-schemas';

export const MLB_MANUAL_SCHEDULE_SCHEMA_VERSION = 'mlb-manual-schedule-v1';
export const MLBManualScheduleSourceMode = 'manual-schedule';

export interface MLBManualScheduleGame {
  readonly gameId: string;
  readonly officialDate: string;
  readonly scheduledStartTime: string;
  readonly awayTeam: string;
  readonly homeTeam: string;
  readonly sourceProvenance: string;
}

export interface MLBManualScheduleFile {
  readonly schemaVersion: 'mlb-manual-schedule-v1';
  readonly sport: 'MLB';
  readonly sourceMode: 'manual-schedule';
  readonly runId: string;
  readonly weekStart: string;
  readonly weekEnd: string;
  readonly createdAt: string;
  readonly sourceProvenance: string;
  readonly games: readonly MLBManualScheduleGame[];
}

const REQUIRED_GAME_FIELDS: readonly (keyof MLBManualScheduleGame)[] = [
  'gameId',
  'officialDate',
  'scheduledStartTime',
  'awayTeam',
  'homeTeam',
  'sourceProvenance',
];

const FORBIDDEN_PREGAME_FIELDS: readonly string[] = [
  'finalScore',
  'completedGameState',
  'finalStatus',
  'outcomeStatus',
  'actualStartingPitchers',
];

const FORBIDDEN_EXTERNAL_FIELDS: readonly string[] = [
  'closingOdds',
  'market',
  'price',
  'impliedProbability',
  'sportsbook',
];

function missingGameFieldMessage(field: string): MLBProspectiveValidationMessage {
  return {
    severity: 'error',
    code: 'MANUAL_SCHEDULE_GAME_FIELD_MISSING',
    message: `game requires ${field}`,
  };
}

export function validateMLBManualScheduleFile(input: unknown): MLBProspectiveValidationMessage[] {
  const messages: MLBProspectiveValidationMessage[] = [];

  if (typeof input !== 'object' || input === null) {
    messages.push({
      severity: 'error',
      code: 'MANUAL_SCHEDULE_NOT_OBJECT',
      message: 'manual schedule file must be an object',
    });
    return messages;
  }

  const record = input as Record<string, unknown>;

  if (record.schemaVersion !== MLB_MANUAL_SCHEDULE_SCHEMA_VERSION) {
    messages.push({
      severity: 'error',
      code: 'MANUAL_SCHEDULE_SCHEMA_VERSION_INVALID',
      message: `schemaVersion must be ${MLB_MANUAL_SCHEDULE_SCHEMA_VERSION}`,
    });
  }

  if (record.sport !== 'MLB') {
    messages.push({
      severity: 'error',
      code: 'MANUAL_SCHEDULE_SPORT_INVALID',
      message: 'sport must be MLB',
    });
  }

  if (record.sourceMode !== MLBManualScheduleSourceMode) {
    messages.push({
      severity: 'error',
      code: 'MANUAL_SCHEDULE_SOURCE_MODE_INVALID',
      message: `sourceMode must be ${MLBManualScheduleSourceMode}`,
    });
  }

  if (typeof record.runId !== 'string' || record.runId.trim() === '') {
    messages.push({
      severity: 'error',
      code: 'MANUAL_SCHEDULE_RUN_ID_MISSING',
      message: 'manual schedule file requires runId',
    });
  }

  if (typeof record.weekStart !== 'string' || record.weekStart.trim() === '') {
    messages.push({
      severity: 'error',
      code: 'MANUAL_SCHEDULE_WEEK_START_MISSING',
      message: 'manual schedule file requires weekStart',
    });
  }

  if (typeof record.weekEnd !== 'string' || record.weekEnd.trim() === '') {
    messages.push({
      severity: 'error',
      code: 'MANUAL_SCHEDULE_WEEK_END_MISSING',
      message: 'manual schedule file requires weekEnd',
    });
  }

  if (typeof record.createdAt !== 'string' || record.createdAt.trim() === '') {
    messages.push({
      severity: 'error',
      code: 'MANUAL_SCHEDULE_CREATED_AT_MISSING',
      message: 'manual schedule file requires createdAt',
    });
  }

  if (typeof record.sourceProvenance !== 'string' || record.sourceProvenance.trim() === '') {
    messages.push({
      severity: 'error',
      code: 'MANUAL_SCHEDULE_SOURCE_PROVENANCE_MISSING',
      message: 'manual schedule file requires sourceProvenance',
    });
  }

  const games = record.games;
  if (!Array.isArray(games) || games.length === 0) {
    messages.push({
      severity: 'error',
      code: 'MANUAL_SCHEDULE_GAMES_MISSING',
      message: 'manual schedule file requires non-empty games',
    });
    return messages;
  }

  const seenGameIds = new Set<string>();
  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    if (typeof game !== 'object' || game === null) {
      messages.push({
        severity: 'error',
        code: 'MANUAL_SCHEDULE_GAME_FIELD_MISSING',
        message: `game[${i}] must be an object`,
      });
      continue;
    }

    const gameRecord = game as Record<string, unknown>;

    for (const field of REQUIRED_GAME_FIELDS) {
      if (typeof gameRecord[field] !== 'string' || (gameRecord[field] as string).trim() === '') {
        messages.push(missingGameFieldMessage(field));
      }
    }

    const gameId = gameRecord.gameId as string | undefined;
    if (typeof gameId === 'string' && gameId.trim() !== '') {
      if (seenGameIds.has(gameId)) {
        messages.push({
          severity: 'error',
          code: 'MANUAL_SCHEDULE_DUPLICATE_GAME_ID',
          message: `duplicate gameId: ${gameId}`,
        });
      }
      seenGameIds.add(gameId);
    }

    const officialDate = gameRecord.officialDate as string | undefined;
    if (typeof record.weekStart === 'string' && typeof record.weekEnd === 'string' && typeof officialDate === 'string') {
      if (officialDate < record.weekStart || officialDate > record.weekEnd) {
        messages.push({
          severity: 'error',
          code: 'MANUAL_SCHEDULE_GAME_OUTSIDE_WEEK',
          message: `game[${i}] officialDate ${officialDate} is outside week range`,
        });
      }
    }

    for (const field of FORBIDDEN_PREGAME_FIELDS) {
      if (field in gameRecord) {
        messages.push({
          severity: 'error',
          code: 'MANUAL_SCHEDULE_FORBIDDEN_PREGAME_FIELD',
          message: `game[${i}] must not contain ${field}`,
        });
      }
    }

    for (const field of FORBIDDEN_EXTERNAL_FIELDS) {
      if (field in gameRecord) {
        messages.push({
          severity: 'error',
          code: 'MANUAL_SCHEDULE_FORBIDDEN_EXTERNAL_FIELD',
          message: `game[${i}] must not contain ${field}`,
        });
      }
    }
  }

  return messages;
}

export function buildScheduleSnapshotFromManualScheduleFile(input: MLBManualScheduleFile): MLBProspectiveScheduleSnapshot {
  const games = input.games.map((game) => ({
    gameId: game.gameId,
    officialDate: game.officialDate,
    scheduledStartTime: game.scheduledStartTime,
    awayTeam: game.awayTeam,
    homeTeam: game.homeTeam,
    snapshotTimestamp: input.createdAt,
    sourceProvenance: game.sourceProvenance,
  }));

  return {
    runId: input.runId,
    createdAt: input.createdAt,
    sourceMode: input.sourceMode,
    games,
    warnings: [],
  };
}
