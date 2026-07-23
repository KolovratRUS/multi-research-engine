import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateProspectiveScheduleSnapshot } from '@/prospective/mlb/weekly-test-schemas';

const projectRoot = join(__dirname, '..', '..');
const scriptPath = join(projectRoot, 'scripts', 'mlb-manual-schedule-create-snapshot.ts');
const tempRoot = join(projectRoot, 'tmp', 'prospective-phase4l-create-snapshot-cli');

function runCreateSnapshot(args: string[]): string {
  return execFileSync(process.execPath, ['--require', 'tsx/cjs', scriptPath, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
}

function runCreateSnapshotExpectingFailure(args: string[]): Record<string, unknown> {
  let error: unknown;
  try {
    runCreateSnapshot(args);
  } catch (caught) {
    error = caught;
  }

  expect(error).toBeTruthy();
  const stdout = error && typeof error === 'object' && 'stdout' in error
    ? (error as { stdout: string }).stdout
    : '{}';
  return JSON.parse(stdout) as Record<string, unknown>;
}

function expectNoSnapshot(summary: Record<string, unknown>): void {
  expect('snapshot' in summary).toBe(false);
}

describe('Phase 4L/4M MLB manual schedule snapshot creation CLI', () => {
  const validFixturePath = join(projectRoot, 'tests', 'prospective', 'fixtures', 'manual-schedule', 'valid-manual-schedule-v1.json');
  const invalidFixturePath = join(projectRoot, 'tests', 'prospective', 'fixtures', 'manual-schedule', 'invalid-forbidden-fields-v1.json');
  const validGoldenPath = join(projectRoot, 'tests', 'prospective', 'fixtures', 'manual-schedule', 'valid-manual-schedule-snapshot-cli-output-v1.json');
  const invalidGoldenPath = join(projectRoot, 'tests', 'prospective', 'fixtures', 'manual-schedule', 'invalid-forbidden-fields-snapshot-cli-output-v1.json');

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('exits 1 with MANUAL_SCHEDULE_SNAPSHOT_PATH_REQUIRED and no snapshot when no path is provided', () => {
    const summary = runCreateSnapshotExpectingFailure([]);

    expect(summary.ok).toBe(false);
    expect(summary.error).toBe('MANUAL_SCHEDULE_SNAPSHOT_PATH_REQUIRED');
    expect(summary.usage).toBe('npm run prospective:mlb:create-manual-snapshot -- <path-to-json>');
    expectNoSnapshot(summary);
  });

  it('exits 1 with MANUAL_SCHEDULE_SNAPSHOT_SINGLE_PATH_ONLY and no snapshot for multiple paths', () => {
    const summary = runCreateSnapshotExpectingFailure([validFixturePath, invalidFixturePath]);

    expect(summary.ok).toBe(false);
    expect(summary.error).toBe('MANUAL_SCHEDULE_SNAPSHOT_SINGLE_PATH_ONLY');
    expect(summary.usage).toBe('npm run prospective:mlb:create-manual-snapshot -- <path-to-json>');
    expectNoSnapshot(summary);
  });

  it('exits 1 with MANUAL_SCHEDULE_SNAPSHOT_READ_OR_PARSE_FAILED and no snapshot for malformed JSON', () => {
    mkdirSync(tempRoot, { recursive: true });
    const malformedPath = join(tempRoot, 'malformed.json');
    writeFileSync(malformedPath, 'not-json');

    const summary = runCreateSnapshotExpectingFailure([malformedPath]);

    expect(summary.ok).toBe(false);
    expect(summary.error).toBe('MANUAL_SCHEDULE_SNAPSHOT_READ_OR_PARSE_FAILED');
    expect(summary.validationMessages).toEqual([]);
    expectNoSnapshot(summary);
  });

  it('exits 1 with five validation errors and no snapshot for forbidden fields', () => {
    const summary = runCreateSnapshotExpectingFailure([invalidFixturePath]);

    expect(summary.ok).toBe(false);
    expect(summary.validationMessageCount).toBe(5);
    expect(summary.validationErrorCount).toBe(5);
    expect(summary.validationWarningCount).toBe(0);
    expect('error' in summary).toBe(false);
    expectNoSnapshot(summary);
  });

  it('exits 0 with a deterministic valid snapshot summary', () => {
    const first = JSON.parse(runCreateSnapshot([validFixturePath])) as Record<string, unknown>;
    const second = JSON.parse(runCreateSnapshot([validFixturePath])) as Record<string, unknown>;

    expect(first.ok).toBe(true);
    expect(first.runId).toBe('manual-schedule-fixture-week-1');
    expect(first.sourceMode).toBe('manual-schedule');
    expect(first.weekStart).toBe('2024-07-01');
    expect(first.weekEnd).toBe('2024-07-07');
    expect(first.snapshotTimestamp).toBe('2024-07-01T00:00:00Z');
    expect(first.gameCount).toBe(2);
    expect(first.validationMessageCount).toBe(0);
    expect(first.validationErrorCount).toBe(0);
    expect(first.validationWarningCount).toBe(0);
    expect(first.validationMessages).toEqual([]);
    expect(first).toEqual(second);
  });

  it('matches the exact golden JSON output for the valid fixture', () => {
    const summary = JSON.parse(runCreateSnapshot([validFixturePath])) as Record<string, unknown>;
    const golden = JSON.parse(readFileSync(validGoldenPath, 'utf8')) as Record<string, unknown>;

    expect(summary).toEqual(golden);
    expect(validateProspectiveScheduleSnapshot(golden.snapshot)).toEqual([]);
  });

  it('matches the exact golden JSON output and expected exit 1 for the invalid fixture', () => {
    const summary = runCreateSnapshotExpectingFailure([invalidFixturePath]);
    const golden = JSON.parse(readFileSync(invalidGoldenPath, 'utf8')) as Record<string, unknown>;

    expect(summary).toEqual(golden);
    expectNoSnapshot(golden);
  });

  it('uses input createdAt and includes exactly two safe games in a valid snapshot', () => {
    const summary = JSON.parse(runCreateSnapshot([validFixturePath])) as {
      snapshotTimestamp: string;
      snapshot: {
        createdAt: string;
        sourceMode: string;
        games: Array<Record<string, unknown>>;
      };
    };

    expect(summary.snapshotTimestamp).toBe('2024-07-01T00:00:00Z');
    expect(summary.snapshot.createdAt).toBe('2024-07-01T00:00:00Z');
    expect(summary.snapshot.sourceMode).toBe('manual-schedule');
    expect(summary.snapshot.games).toHaveLength(2);
    expect(validateProspectiveScheduleSnapshot(summary.snapshot)).toEqual([]);

    const forbiddenFields = [
      'finalScore',
      'completedGameState',
      'actualStartingPitchers',
      'outcome',
      'outcomeStatus',
      'finalStatus',
    ];
    for (const game of summary.snapshot.games) {
      expect(game.snapshotTimestamp).toBe('2024-07-01T00:00:00Z');
      for (const field of forbiddenFields) {
        expect(field in game).toBe(false);
      }
    }
  });

  it('does not create output files', () => {
    mkdirSync(tempRoot, { recursive: true });
    const inputPath = join(tempRoot, 'valid-file.json');
    writeFileSync(inputPath, readFileSync(validFixturePath, 'utf8'));
    const beforeFiles = readdirSync(tempRoot);

    runCreateSnapshot([inputPath]);

    expect(readdirSync(tempRoot)).toEqual(beforeFiles);
  });
});
