import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  MLB_MANUAL_SCHEDULE_SCHEMA_VERSION,
  MLBManualScheduleSourceMode,
  type MLBManualScheduleFile,
  validateMLBManualScheduleFile,
  buildScheduleSnapshotFromManualScheduleFile,
} from '@/prospective/mlb/manual-schedule-file';
import {
  validateProspectiveScheduleSnapshot,
} from '@/prospective/mlb/weekly-test-schemas';

function makeValidManualScheduleFile(): MLBManualScheduleFile {
  return {
    schemaVersion: MLB_MANUAL_SCHEDULE_SCHEMA_VERSION,
    sport: 'MLB',
    sourceMode: MLBManualScheduleSourceMode,
    runId: 'manual-week-1',
    weekStart: '2024-07-01',
    weekEnd: '2024-07-07',
    createdAt: '2024-07-01T00:00:00Z',
    sourceProvenance: 'user-supplied-static-schedule',
    games: [
      {
        gameId: 'manual-game-1',
        officialDate: '2024-07-01',
        scheduledStartTime: '2024-07-01T18:00:00Z',
        awayTeam: 'MANUAL_AWAY_1',
        homeTeam: 'MANUAL_HOME_1',
        sourceProvenance: 'user-supplied-static-schedule',
      },
      {
        gameId: 'manual-game-2',
        officialDate: '2024-07-03',
        scheduledStartTime: '2024-07-03T17:10:00Z',
        awayTeam: 'MANUAL_AWAY_2',
        homeTeam: 'MANUAL_HOME_2',
        sourceProvenance: 'user-supplied-static-schedule',
      },
    ],
  };
}

function makeInvalidManualScheduleFile(overrides: Record<string, unknown> = {}): unknown {
  return {
    ...makeValidManualScheduleFile(),
    ...overrides,
  };
}

describe('Phase 4G MLB prospective weekly: manual schedule file schema and validators', () => {
  it('passes validation for a valid manual schedule file', () => {
    expect(validateMLBManualScheduleFile(makeValidManualScheduleFile())).toEqual([]);
  });

  it('converts valid manual schedule to prospective schedule snapshot', () => {
    const snapshot = buildScheduleSnapshotFromManualScheduleFile(makeValidManualScheduleFile());
    expect(snapshot.runId).toBe('manual-week-1');
    expect(snapshot.createdAt).toBe('2024-07-01T00:00:00Z');
    expect(snapshot.sourceMode).toBe('manual-schedule');
    expect(snapshot.games).toHaveLength(2);
    expect(snapshot.warnings).toEqual([]);
  });

  it('converted snapshot passes prospective schedule validation and contains no finalScore/completedGameState', () => {
    const snapshot = buildScheduleSnapshotFromManualScheduleFile(makeValidManualScheduleFile());
    expect(validateProspectiveScheduleSnapshot(snapshot)).toEqual([]);
    for (const game of snapshot.games) {
      expect('finalScore' in (game as object)).toBe(false);
      expect('completedGameState' in (game as object)).toBe(false);
    }
  });

  it('returns error for invalid schemaVersion', () => {
    const messages = validateMLBManualScheduleFile(
      makeInvalidManualScheduleFile({ schemaVersion: 'wrong' }),
    );
    expect(messages.some((m) => m.code === 'MANUAL_SCHEDULE_SCHEMA_VERSION_INVALID')).toBe(true);
  });

  it('returns error for wrong sport', () => {
    const messages = validateMLBManualScheduleFile(
      makeInvalidManualScheduleFile({ sport: 'NBA' }),
    );
    expect(messages.some((m) => m.code === 'MANUAL_SCHEDULE_SPORT_INVALID')).toBe(true);
  });

  it('returns error for wrong sourceMode', () => {
    const messages = validateMLBManualScheduleFile(
      makeInvalidManualScheduleFile({ sourceMode: 'local-dry-run' }),
    );
    expect(messages.some((m) => m.code === 'MANUAL_SCHEDULE_SOURCE_MODE_INVALID')).toBe(true);
  });

  it('returns error for empty games', () => {
    const messages = validateMLBManualScheduleFile(
      makeInvalidManualScheduleFile({ games: [] }),
    );
    expect(messages.some((m) => m.code === 'MANUAL_SCHEDULE_GAMES_MISSING')).toBe(true);
  });

  it('returns error for duplicate gameId', () => {
    const valid = makeValidManualScheduleFile();
    const file = {
      ...valid,
      games: [
        valid.games[0],
        { ...valid.games[0], scheduledStartTime: '2024-07-03T18:00:00Z' },
      ],
    };
    const messages = validateMLBManualScheduleFile(file);
    expect(messages.some((m) => m.code === 'MANUAL_SCHEDULE_DUPLICATE_GAME_ID')).toBe(true);
  });

  it('returns error for missing required game field', () => {
    const valid = makeValidManualScheduleFile();
    const file = {
      ...valid,
      games: [{ ...valid.games[0], awayTeam: '' }],
    };
    const messages = validateMLBManualScheduleFile(file);
    expect(messages.some((m) => m.code === 'MANUAL_SCHEDULE_GAME_FIELD_MISSING')).toBe(true);
  });

  it('returns error for game outside week range', () => {
    const valid = makeValidManualScheduleFile();
    const file = {
      ...valid,
      games: [{ ...valid.games[0], officialDate: '2024-07-08' }],
    };
    const messages = validateMLBManualScheduleFile(file);
    expect(messages.some((m) => m.code === 'MANUAL_SCHEDULE_GAME_OUTSIDE_WEEK')).toBe(true);
  });

  it('returns forbidden pre-game field error for finalScore', () => {
    const valid = makeValidManualScheduleFile();
    const file = {
      ...valid,
      games: [{ ...valid.games[0], finalScore: { awayScore: 1, homeScore: 2 } }],
    };
    const messages = validateMLBManualScheduleFile(file);
    expect(messages.some((m) => m.code === 'MANUAL_SCHEDULE_FORBIDDEN_PREGAME_FIELD')).toBe(true);
  });

  it('returns forbidden pre-game field error for completedGameState', () => {
    const valid = makeValidManualScheduleFile();
    const file = {
      ...valid,
      games: [{ ...valid.games[0], completedGameState: {} }],
    };
    const messages = validateMLBManualScheduleFile(file);
    expect(messages.some((m) => m.code === 'MANUAL_SCHEDULE_FORBIDDEN_PREGAME_FIELD')).toBe(true);
  });

  it('returns forbidden pre-game field error for actualStartingPitchers', () => {
    const valid = makeValidManualScheduleFile();
    const file = {
      ...valid,
      games: [{ ...valid.games[0], actualStartingPitchers: [] }],
    };
    const messages = validateMLBManualScheduleFile(file);
    expect(messages.some((m) => m.code === 'MANUAL_SCHEDULE_FORBIDDEN_PREGAME_FIELD')).toBe(true);
  });

  it('returns forbidden external field error for closingOdds', () => {
    const valid = makeValidManualScheduleFile();
    const file = {
      ...valid,
      games: [{ ...valid.games[0], closingOdds: 1.5 }],
    };
    const messages = validateMLBManualScheduleFile(file);
    expect(messages.some((m) => m.code === 'MANUAL_SCHEDULE_FORBIDDEN_EXTERNAL_FIELD')).toBe(true);
  });

  it('returns forbidden external field error for impliedProbability', () => {
    const valid = makeValidManualScheduleFile();
    const file = {
      ...valid,
      games: [{ ...valid.games[0], impliedProbability: 0.5 }],
    };
    const messages = validateMLBManualScheduleFile(file);
    expect(messages.some((m) => m.code === 'MANUAL_SCHEDULE_FORBIDDEN_EXTERNAL_FIELD')).toBe(true);
  });

  it('validates fixtures/golden files deterministically', () => {
    const validFixturePath = join(__dirname, 'fixtures', 'manual-schedule', 'valid-manual-schedule-v1.json');
    const validGoldenPath = join(__dirname, 'fixtures', 'manual-schedule', 'valid-manual-schedule-validation-v1.json');
    const validFixture = JSON.parse(readFileSync(validFixturePath, 'utf8')) as unknown;
    const validGolden = JSON.parse(readFileSync(validGoldenPath, 'utf8')) as readonly { severity: string; code: string; message: string }[];

    const validMessages = validateMLBManualScheduleFile(validFixture);
    expect(validMessages).toEqual(validGolden);

    const validTyped = validFixture as MLBManualScheduleFile;
    const snapshot = buildScheduleSnapshotFromManualScheduleFile(validTyped);
    expect(validateProspectiveScheduleSnapshot(snapshot)).toEqual([]);
    for (const game of snapshot.games) {
      expect('finalScore' in (game as object)).toBe(false);
      expect('completedGameState' in (game as object)).toBe(false);
    }
  });

  it('validates invalid fixture/golden output with forbidden fields', () => {
    const invalidFixturePath = join(__dirname, 'fixtures', 'manual-schedule', 'invalid-forbidden-fields-v1.json');
    const invalidGoldenPath = join(__dirname, 'fixtures', 'manual-schedule', 'invalid-forbidden-fields-validation-v1.json');
    const invalidFixture = JSON.parse(readFileSync(invalidFixturePath, 'utf8')) as unknown;
    const invalidGolden = JSON.parse(readFileSync(invalidGoldenPath, 'utf8')) as readonly { severity: string; code: string; message: string }[];

    const messages = validateMLBManualScheduleFile(invalidFixture);
    expect(messages).toEqual(invalidGolden);
    expect(messages.some((m) => m.code === 'MANUAL_SCHEDULE_FORBIDDEN_PREGAME_FIELD')).toBe(true);
    expect(messages.some((m) => m.code === 'MANUAL_SCHEDULE_FORBIDDEN_EXTERNAL_FIELD')).toBe(true);
  });
});
