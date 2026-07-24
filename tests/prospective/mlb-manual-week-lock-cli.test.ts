import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateProspectiveScheduleSnapshot } from '@/prospective/mlb/weekly-test-schemas';

const projectRoot = join(__dirname, '..', '..');
const scriptPath = join(projectRoot, 'scripts', 'mlb-manual-week-lock.ts');
const tempRoot = join(projectRoot, 'tmp', 'prospective-phase4r-lock-manual-week-cli');
const expectedArtifactFilename = '2024-07-01__2024-07-07__manual-schedule-fixture-week-1__manual-week-lock-v1.json';

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

function expectNoOutputDirectory(outputDir: string): void {
  expect(existsSync(outputDir)).toBe(false);
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

describe('Phase 4O/4P/4R MLB manual week lock CLI', () => {
  const validFixturePath = join(projectRoot, 'tests', 'prospective', 'fixtures', 'manual-schedule', 'valid-manual-schedule-v1.json');
  const invalidFixturePath = join(projectRoot, 'tests', 'prospective', 'fixtures', 'manual-schedule', 'invalid-forbidden-fields-v1.json');
  const validGoldenPath = join(projectRoot, 'tests', 'prospective', 'fixtures', 'manual-schedule', 'valid-manual-week-lock-cli-output-v1.json');
  const invalidGoldenPath = join(projectRoot, 'tests', 'prospective', 'fixtures', 'manual-schedule', 'invalid-forbidden-fields-week-lock-cli-output-v1.json');

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

  it('matches the exact golden JSON output for the valid fixture', () => {
    const summary = JSON.parse(runLockManualWeek([validFixturePath])) as Record<string, unknown>;
    const golden = JSON.parse(readFileSync(validGoldenPath, 'utf8')) as Record<string, unknown>;
    const lockedSnapshot = golden.lockedSnapshot as { snapshot: unknown };

    expect(summary).toEqual(golden);
    expect(validateProspectiveScheduleSnapshot(lockedSnapshot.snapshot)).toEqual([]);
  });

  it('matches the exact golden JSON output and expected exit 1 for the invalid fixture', () => {
    const summary = runLockManualWeekExpectingFailure([invalidFixturePath]);
    const golden = JSON.parse(readFileSync(invalidGoldenPath, 'utf8')) as Record<string, unknown>;

    expect(summary).toEqual(golden);
    expectNoLockedSnapshot(golden);
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

  it('requires --output-dir when --write-file is provided and writes no file', () => {
    const outputDir = join(tempRoot, 'missing-output-dir');
    const summary = runLockManualWeekExpectingFailure([validFixturePath, '--write-file']);

    expect(summary.ok).toBe(false);
    expect(summary.error).toBe('MANUAL_WEEK_LOCK_OUTPUT_DIR_REQUIRED');
    expectNoLockedSnapshot(summary);
    expectNoOutputDirectory(outputDir);
  });

  it('requires --write-file when --output-dir is provided and writes no file', () => {
    const outputDir = join(tempRoot, 'write-flag-required');
    const summary = runLockManualWeekExpectingFailure([validFixturePath, '--output-dir', outputDir]);

    expect(summary.ok).toBe(false);
    expect(summary.error).toBe('MANUAL_WEEK_LOCK_WRITE_FILE_REQUIRED');
    expectNoLockedSnapshot(summary);
    expectNoOutputDirectory(outputDir);
  });

  it('requires a directory value after --output-dir and writes no file', () => {
    const outputDir = join(tempRoot, 'value-required');
    const summary = runLockManualWeekExpectingFailure([validFixturePath, '--output-dir']);

    expect(summary.ok).toBe(false);
    expect(summary.error).toBe('MANUAL_WEEK_LOCK_OUTPUT_DIR_VALUE_REQUIRED');
    expectNoLockedSnapshot(summary);
    expectNoOutputDirectory(outputDir);
  });

  it('rejects an unknown flag and writes no file', () => {
    const outputDir = join(tempRoot, 'unknown-argument');
    const summary = runLockManualWeekExpectingFailure([validFixturePath, '--unknown']);

    expect(summary.ok).toBe(false);
    expect(summary.error).toBe('MANUAL_WEEK_LOCK_UNKNOWN_ARGUMENT');
    expectNoLockedSnapshot(summary);
    expectNoOutputDirectory(outputDir);
  });

  it('writes exactly one deterministic artifact with the exact lockedSnapshot', () => {
    const outputDir = join(tempRoot, 'valid-lock');
    const summary = JSON.parse(runLockManualWeek([
      validFixturePath,
      '--write-file',
      '--output-dir',
      outputDir,
    ])) as Record<string, unknown>;
    const files = readdirSync(outputDir);
    const artifactPath = join(outputDir, expectedArtifactFilename);
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8')) as Record<string, unknown>;

    expect(summary.ok).toBe(true);
    expect(summary.outputMode).toBe('file');
    expect(summary.artifactWritten).toBe(true);
    expect(summary.artifactFilename).toBe(expectedArtifactFilename);
    expect(summary.artifactPath).toBe(`tmp/prospective-phase4r-lock-manual-week-cli/valid-lock/${expectedArtifactFilename}`);
    expect(isAbsolute(summary.artifactPath as string)).toBe(false);
    expect(files).toEqual([expectedArtifactFilename]);
    expect(artifact).toEqual(summary.lockedSnapshot);
    expect(readFileSync(artifactPath, 'utf8').endsWith('\n')).toBe(true);
  });

  it('accepts --output-dir before --write-file', () => {
    const outputDir = join(tempRoot, 'reversed-flags');
    const summary = JSON.parse(runLockManualWeek([
      validFixturePath,
      '--output-dir',
      outputDir,
      '--write-file',
    ])) as Record<string, unknown>;

    expect(summary.ok).toBe(true);
    expect(summary.artifactWritten).toBe(true);
    expect(readdirSync(outputDir)).toEqual([expectedArtifactFilename]);
  });

  it('writes no artifact for invalid input with file flags', () => {
    const outputDir = join(tempRoot, 'invalid-input');
    const summary = runLockManualWeekExpectingFailure([
      invalidFixturePath,
      '--write-file',
      '--output-dir',
      outputDir,
    ]);

    expect(summary.ok).toBe(false);
    expect(summary.validationErrorCount).toBe(5);
    expectNoLockedSnapshot(summary);
    expectNoOutputDirectory(outputDir);
  });

  it('writes no artifact for malformed JSON with file flags', () => {
    mkdirSync(tempRoot, { recursive: true });
    const malformedPath = join(tempRoot, 'malformed-file-mode.json');
    const outputDir = join(tempRoot, 'malformed-output');
    writeFileSync(malformedPath, 'not-json');

    const summary = runLockManualWeekExpectingFailure([
      malformedPath,
      '--write-file',
      '--output-dir',
      outputDir,
    ]);

    expect(summary.ok).toBe(false);
    expect(summary.error).toBe('MANUAL_WEEK_LOCK_READ_OR_PARSE_FAILED');
    expectNoLockedSnapshot(summary);
    expectNoOutputDirectory(outputDir);
  });

  it('refuses overwrite and does not alter an existing artifact', () => {
    const outputDir = join(tempRoot, 'existing-artifact');
    const artifactPath = join(outputDir, expectedArtifactFilename);
    const existingContents = 'existing artifact must remain unchanged\n';
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(artifactPath, existingContents);

    const summary = runLockManualWeekExpectingFailure([
      validFixturePath,
      '--write-file',
      '--output-dir',
      outputDir,
    ]);

    expect(summary.ok).toBe(false);
    expect(summary.outputMode).toBe('file');
    expect(summary.artifactWritten).toBe(false);
    expect(summary.error).toBe('MANUAL_WEEK_LOCK_OUTPUT_PATH_EXISTS');
    expect(readFileSync(artifactPath, 'utf8')).toBe(existingContents);
    expect(readdirSync(outputDir)).toEqual([expectedArtifactFilename]);
  });

  it('rejects unsafe filename traversal before creating the output directory', () => {
    mkdirSync(tempRoot, { recursive: true });
    const unsafeInputPath = join(tempRoot, 'unsafe-run-id.json');
    const outputDir = join(tempRoot, 'unsafe-output');
    const input = JSON.parse(readFileSync(validFixturePath, 'utf8')) as Record<string, unknown>;
    input.runId = '../escape';
    writeFileSync(unsafeInputPath, `${JSON.stringify(input, null, 2)}\n`);

    const summary = runLockManualWeekExpectingFailure([
      unsafeInputPath,
      '--write-file',
      '--output-dir',
      outputDir,
    ]);

    expect(summary.ok).toBe(false);
    expect(summary.outputMode).toBe('file');
    expect(summary.artifactWritten).toBe(false);
    expect(summary.error).toBe('MANUAL_WEEK_LOCK_OUTPUT_DIR_UNSAFE');
    expectNoLockedSnapshot(summary);
    expectNoOutputDirectory(outputDir);
    expect(existsSync(join(tempRoot, 'escape__manual-week-lock-v1.json'))).toBe(false);
  });

  it('normalizes a traversing directory string and keeps the final path inside the resolved output directory', () => {
    const requestedOutputDir = join(tempRoot, 'unused-segment', '..', 'normalized-output');
    const resolvedOutputDir = resolve(requestedOutputDir);
    const summary = JSON.parse(runLockManualWeek([
      validFixturePath,
      '--write-file',
      '--output-dir',
      requestedOutputDir,
    ])) as Record<string, unknown>;
    const finalPath = join(resolvedOutputDir, expectedArtifactFilename);
    const relativeFinalPath = relative(resolvedOutputDir, finalPath);

    expect(summary.ok).toBe(true);
    expect(relativeFinalPath.startsWith('..')).toBe(false);
    expect(isAbsolute(relativeFinalPath)).toBe(false);
    expect(readdirSync(resolvedOutputDir)).toEqual([expectedArtifactFilename]);
  });

  it('refuses writes to a repository-tracked fixture directory', () => {
    const fixtureOutputDir = join(projectRoot, 'tests', 'prospective', 'fixtures', 'manual-schedule');
    const beforeFiles = [...readdirSync(fixtureOutputDir)].sort();
    const summary = runLockManualWeekExpectingFailure([
      validFixturePath,
      '--write-file',
      '--output-dir',
      fixtureOutputDir,
    ]);

    expect(summary.ok).toBe(false);
    expect(summary.outputMode).toBe('file');
    expect(summary.artifactWritten).toBe(false);
    expect(summary.error).toBe('MANUAL_WEEK_LOCK_OUTPUT_DIR_UNSAFE');
    expectNoLockedSnapshot(summary);
    expect([...readdirSync(fixtureOutputDir)].sort()).toEqual(beforeFiles);
  });

  it('keeps absolute paths and forbidden pre-game fields out of stdout and artifact JSON', () => {
    const outputDir = join(tempRoot, 'safe-json');
    const stdout = runLockManualWeek([
      validFixturePath,
      '--write-file',
      '--output-dir',
      outputDir,
    ]);
    const summary = JSON.parse(stdout) as { lockedSnapshot: Record<string, unknown> };
    const artifactText = readFileSync(join(outputDir, expectedArtifactFilename), 'utf8');
    const artifact = JSON.parse(artifactText) as Record<string, unknown>;
    const forbiddenFields = [
      'finalScore',
      'completedGameState',
      'actualStartingPitchers',
      'outcome',
      'outcomeStatus',
      'finalStatus',
    ];

    expect(stdout).not.toContain(projectRoot);
    expect(artifactText).not.toContain(projectRoot);
    expect(artifact).toEqual(summary.lockedSnapshot);
    expectForbiddenFieldsAbsent(artifact, forbiddenFields);
    expect(readdirSync(outputDir).some((filename) => filename.endsWith('.tmp'))).toBe(false);
  });
});
