import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateProspectiveScheduleSnapshot } from '@/prospective/mlb/weekly-test-schemas';

const projectRoot = join(__dirname, '..', '..');
const scriptPath = join(projectRoot, 'scripts', 'mlb-manual-week-lock.ts');
const tempRoot = join(projectRoot, 'tmp', 'prospective-phase4o-lock-manual-week-cli');

function runLockManualWeek(args: string[]): string {
  return execFileSync(process.execPath, ['--require', 'tsx/cjs', scriptPath, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
}

function runLockManualWeekExpectingFailure(args: string[]): Record<string, unknown> {
  let error: unknown;
  try {
    runLockManualWeek(args);
  } catch (caught) {
    error = caught;
  }

  expect(error).toBeTruthy();
  const stdout = error && typeof error === 'object' && 'stdout' in error
    ? (error as { stdout: string }).stdout
    : '{}';
  return JSON.parse(stdout) as Record<string, unknown>;
}

function expectNoLockedSnapshot(summary: Record<string, unknown>): void {
  expect('lockedSnapshot' in summary).toBe(false);
}

function expectForbiddenFieldsAbsent(input: unknown, forbiddenFields: readonly string[]): void {
  if (Array.isArray(input)) {
    for (const value of input) {
      expectForbiddenFieldsAbsent(value, forbiddenFields);
    }
    return;
  }
  if (typeof input !== 'object' || input === null) {
    return;
  }

  const record = input as Record<string, unknown>;
  for (const field of forbiddenFields) {
    expect(field in record).toBe(false);
  }
  for (const value of Object.values(record)) {
    expectForbiddenFieldsAbsent(value, forbiddenFields);
  }
}

describe('Phase 4O MLB manual week lock CLI', () => {
  const validFixturePath = join(projectRoot, 'tests', 'prospective', 'fixtures', 'manual-schedule', 'valid-manual-schedule-v1.json');
  const invalidFixturePath = join(projectRoot, 'tests', 'prospective', 'fixtures', 'manual-schedule', 'invalid-forbidden-fields-v1.json');

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('exits 1 with MANUAL_WEEK_LOCK_PATH_REQUIRED and no lockedSnapshot when no path is provided', () => {
    const summary = runLockManualWeekExpectingFailure([]);

    expect(summary.ok).toBe(false);
    expect(summary.error).toBe('MANUAL_WEEK_LOCK_PATH_REQUIRED');
    expect(summary.usage).toBe('npm run prospective:mlb:lock-manual-week -- <path-to-json>');
    expectNoLockedSnapshot(summary);
  });

  it('exits 1 with MANUAL_WEEK_LOCK_SINGLE_PATH_ONLY and no lockedSnapshot for multiple paths', () => {
    const summary = runLockManualWeekExpectingFailure([validFixturePath, invalidFixturePath]);

    expect(summary.ok).toBe(false);
    expect(summary.error).toBe('MANUAL_WEEK_LOCK_SINGLE_PATH_ONLY');
    expect(summary.usage).toBe('npm run prospective:mlb:lock-manual-week -- <path-to-json>');
    expectNoLockedSnapshot(summary);
  });

  it('exits 1 with MANUAL_WEEK_LOCK_READ_OR_PARSE_FAILED and no lockedSnapshot for malformed JSON', () => {
    mkdirSync(tempRoot, { recursive: true });
    const malformedPath = join(tempRoot, 'malformed.json');
    writeFileSync(malformedPath, 'not-json');

    const summary = runLockManualWeekExpectingFailure([malformedPath]);

    expect(summary.ok).toBe(false);
    expect(summary.error).toBe('MANUAL_WEEK_LOCK_READ_OR_PARSE_FAILED');
    expect(summary.validationMessages).toEqual([]);
    expectNoLockedSnapshot(summary);
  });

  it('exits 1 with five validation errors and no lockedSnapshot for forbidden fields', () => {
    const summary = runLockManualWeekExpectingFailure([invalidFixturePath]);

    expect(summary.ok).toBe(false);
    expect(summary.validationMessageCount).toBe(5);
    expect(summary.validationErrorCount).toBe(5);
    expect(summary.validationWarningCount).toBe(0);
    expect('error' in summary).toBe(false);
    expectNoLockedSnapshot(summary);
  });

  it('exits 0 with a deterministic lockedSnapshot for the valid fixture', () => {
    const first = JSON.parse(runLockManualWeek([validFixturePath])) as Record<string, unknown>;
    const second = JSON.parse(runLockManualWeek([validFixturePath])) as Record<string, unknown>;

    expect(first.ok).toBe(true);
    expect(first.runId).toBe('manual-schedule-fixture-week-1');
    expect(first.lockId).toBe('manual-week-lock:manual-schedule-fixture-week-1');
    expect(first.sourceMode).toBe('manual-schedule');
    expect(first.weekStart).toBe('2024-07-01');
    expect(first.weekEnd).toBe('2024-07-07');
    expect(first.lockedAt).toBe('2024-07-01T00:00:00Z');
    expect(first.snapshotTimestamp).toBe('2024-07-01T00:00:00Z');
    expect(first.gameCount).toBe(2);
    expect(first.validationMessageCount).toBe(0);
    expect(first.validationErrorCount).toBe(0);
    expect(first.validationWarningCount).toBe(0);
    expect(first.validationMessages).toEqual([]);
    expect(first).toEqual(second);
  });

  it('wraps a valid two-game prospective schedule snapshot with the planned lock fields', () => {
    const summary = JSON.parse(runLockManualWeek([validFixturePath])) as {
      lockedSnapshot: {
        lockVersion: string;
        runId: string;
        lockId: string;
        sourceMode: string;
        weekStart: string;
        weekEnd: string;
        lockedAt: string;
        snapshot: {
          sourceMode: string;
          games: Array<Record<string, unknown>>;
        };
        validationMessages: unknown[];
        warnings: unknown[];
      };
    };

    expect(summary.lockedSnapshot.lockVersion).toBe('mlb-manual-week-lock-v1');
    expect(summary.lockedSnapshot.runId).toBe('manual-schedule-fixture-week-1');
    expect(summary.lockedSnapshot.lockId).toBe('manual-week-lock:manual-schedule-fixture-week-1');
    expect(summary.lockedSnapshot.sourceMode).toBe('manual-schedule');
    expect(summary.lockedSnapshot.weekStart).toBe('2024-07-01');
    expect(summary.lockedSnapshot.weekEnd).toBe('2024-07-07');
    expect(summary.lockedSnapshot.lockedAt).toBe('2024-07-01T00:00:00Z');
    expect(summary.lockedSnapshot.snapshot.sourceMode).toBe('manual-schedule');
    expect(summary.lockedSnapshot.snapshot.games).toHaveLength(2);
    expect(summary.lockedSnapshot.validationMessages).toEqual([]);
    expect(summary.lockedSnapshot.warnings).toEqual([]);
    expect(validateProspectiveScheduleSnapshot(summary.lockedSnapshot.snapshot)).toEqual([]);
  });

  it('excludes result, completion, starter, and outcome fields from the lock and nested snapshot', () => {
    const summary = JSON.parse(runLockManualWeek([validFixturePath])) as {
      lockedSnapshot: Record<string, unknown>;
    };
    const forbiddenFields = [
      'finalScore',
      'completedGameState',
      'actualStartingPitchers',
      'outcome',
      'outcomeStatus',
      'finalStatus',
    ];

    expectForbiddenFieldsAbsent(summary.lockedSnapshot, forbiddenFields);
  });

  it('does not create output files', () => {
    mkdirSync(tempRoot, { recursive: true });
    const inputPath = join(tempRoot, 'valid-file.json');
    writeFileSync(inputPath, readFileSync(validFixturePath, 'utf8'));
    const beforeFiles = readdirSync(tempRoot);

    runLockManualWeek([inputPath]);

    expect(readdirSync(tempRoot)).toEqual(beforeFiles);
  });
});
