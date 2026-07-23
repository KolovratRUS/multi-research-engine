import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readFileSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';

const projectRoot = join(__dirname, '..', '..');
const scriptPath = join(projectRoot, 'scripts', 'mlb-manual-schedule-validate.ts');
const tsxPath = join(projectRoot, 'node_modules', '.bin', 'tsx');

function runValidate(args: string[]): string {
  return execFileSync(process.execPath, [tsxPath, scriptPath, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
}

describe('Phase 4I/4J MLB manual schedule validator CLI', () => {
  const validFixturePath = join(projectRoot, 'tests', 'prospective', 'fixtures', 'manual-schedule', 'valid-manual-schedule-v1.json');
  const invalidFixturePath = join(projectRoot, 'tests', 'prospective', 'fixtures', 'manual-schedule', 'invalid-forbidden-fields-v1.json');
  const validGoldenPath = join(projectRoot, 'tests', 'prospective', 'fixtures', 'manual-schedule', 'valid-manual-schedule-cli-output-v1.json');
  const invalidGoldenPath = join(projectRoot, 'tests', 'prospective', 'fixtures', 'manual-schedule', 'invalid-forbidden-fields-cli-output-v1.json');

  it('exits 1 with MANUAL_SCHEDULE_PATH_REQUIRED when no path is provided', () => {
    let error: unknown;
    let stdout = '';
    try {
      stdout = execFileSync(process.execPath, [tsxPath, scriptPath], {
        cwd: projectRoot,
        encoding: 'utf8',
      });
    } catch (e) {
      error = e;
    }
    expect(error).toBeTruthy();
    const summary = JSON.parse(stdout || (error && typeof error === 'object' && 'stdout' in error ? (error as { stdout: string }).stdout : '{}'));
    expect(summary.ok).toBe(false);
    expect(summary.error).toBe('MANUAL_SCHEDULE_PATH_REQUIRED');
    expect(summary.validationMessages).toEqual([]);
  });

  it('exits 1 with MANUAL_SCHEDULE_SINGLE_PATH_ONLY when multiple paths are provided', () => {
    let error: unknown;
    let stdout = '';
    try {
      stdout = execFileSync(process.execPath, [tsxPath, scriptPath, validFixturePath, invalidFixturePath], {
        cwd: projectRoot,
        encoding: 'utf8',
      });
    } catch (e) {
      error = e;
    }
    expect(error).toBeTruthy();
    const summary = JSON.parse(stdout || (error && typeof error === 'object' && 'stdout' in error ? (error as { stdout: string }).stdout : '{}'));
    expect(summary.ok).toBe(false);
    expect(summary.error).toBe('MANUAL_SCHEDULE_SINGLE_PATH_ONLY');
    expect(summary.validationMessages).toEqual([]);
  });

  it('exits 0 for a valid fixture with selected deterministic fields', () => {
    const stdout = runValidate([validFixturePath]);
    const summary = JSON.parse(stdout) as Record<string, unknown>;
    expect(summary.ok).toBe(true);
    expect(summary.gameCount).toBe(2);
    expect(summary.validationMessageCount).toBe(0);
    expect(summary.validationErrorCount).toBe(0);
    expect(summary.validationWarningCount).toBe(0);
    expect(summary.runId).toBe('manual-schedule-fixture-week-1');
    expect(summary.sourceMode).toBe('manual-schedule');
    expect(summary.weekStart).toBe('2024-07-01');
    expect(summary.weekEnd).toBe('2024-07-07');
  });

  it('exits 1 for invalid forbidden-fields fixture and includes expected error codes', () => {
    let error: unknown;
    let stdout = '';
    try {
      stdout = runValidate([invalidFixturePath]);
    } catch (e) {
      error = e;
    }
    expect(error).toBeTruthy();
    const summary = JSON.parse(stdout || (error && typeof error === 'object' && 'stdout' in error ? (error as { stdout: string }).stdout : '{}'));
    expect(summary.ok).toBe(false);
    expect(summary.validationErrorCount).toBe(5);
    const codes = (summary.validationMessages as Array<{ code: string }>).map((m) => m.code);
    expect(codes).toContain('MANUAL_SCHEDULE_FORBIDDEN_PREGAME_FIELD');
    expect(codes).toContain('MANUAL_SCHEDULE_FORBIDDEN_EXTERNAL_FIELD');
  });

  it('matches the exact golden JSON output for the valid fixture', () => {
    const stdout = runValidate([validFixturePath]);
    const summary = JSON.parse(stdout) as unknown;
    const golden = JSON.parse(readFileSync(validGoldenPath, 'utf8')) as unknown;

    expect(summary).toEqual(golden);
  });

  it('matches the exact golden JSON output and expected exit 1 for the invalid fixture', () => {
    let error: unknown;
    try {
      runValidate([invalidFixturePath]);
    } catch (e) {
      error = e;
    }

    expect(error).toBeTruthy();
    const stdout = error && typeof error === 'object' && 'stdout' in error
      ? (error as { stdout: string }).stdout
      : '{}';
    const summary = JSON.parse(stdout) as unknown;
    const golden = JSON.parse(readFileSync(invalidGoldenPath, 'utf8')) as unknown;

    expect(summary).toEqual(golden);
  });

  it('exits 1 for malformed JSON with MANUAL_SCHEDULE_READ_OR_PARSE_FAILED', () => {
    const tempDir = join(projectRoot, 'tmp', 'prospective-phase4i');
    mkdirSync(tempDir, { recursive: true });
    const tempFile = join(tempDir, 'malformed.json');
    writeFileSync(tempFile, 'not-json');
    let error: unknown;
    let stdout = '';
    try {
      stdout = runValidate([tempFile]);
    } catch (e) {
      error = e;
    } finally {
      rmSync(tempDir, { recursive: true });
    }
    expect(error).toBeTruthy();
    const summary = JSON.parse(stdout || (error && typeof error === 'object' && 'stdout' in error ? (error as { stdout: string }).stdout : '{}'));
    expect(summary.ok).toBe(false);
    expect(summary.error).toBe('MANUAL_SCHEDULE_READ_OR_PARSE_FAILED');
    expect(summary.validationMessages).toEqual([]);
  });

  it('valid fixture output is deterministic enough to compare selected fields exactly', () => {
    const stdoutFirst = runValidate([validFixturePath]);
    const summaryFirst = JSON.parse(stdoutFirst) as Record<string, unknown>;
    const stdoutSecond = runValidate([validFixturePath]);
    const summarySecond = JSON.parse(stdoutSecond) as Record<string, unknown>;

    expect(summaryFirst.ok).toBe(summarySecond.ok);
    expect(summaryFirst.gameCount).toBe(summarySecond.gameCount);
    expect(summaryFirst.validationMessageCount).toBe(summarySecond.validationMessageCount);
    expect(summaryFirst.runId).toBe(summarySecond.runId);
    expect(summaryFirst.sourceMode).toBe(summarySecond.sourceMode);
    expect(summaryFirst.weekStart).toBe(summarySecond.weekStart);
    expect(summaryFirst.weekEnd).toBe(summarySecond.weekEnd);
    expect(summaryFirst.validationMessages).toEqual(summarySecond.validationMessages);
  });

  it('CLI does not create any output files in the fixture directory', () => {
    const tempDir = join(projectRoot, 'tmp', 'prospective-phase4i-validate-cli');
    mkdirSync(tempDir, { recursive: true });
    const tempFile = join(tempDir, 'valid-file.json');
    writeFileSync(tempFile, readFileSync(validFixturePath, 'utf8'));
    const beforeFiles = readdirSync(tempDir);
    runValidate([tempFile]);
    const afterFiles = readdirSync(tempDir);
    expect(afterFiles).toEqual(beforeFiles);
    rmSync(tempDir, { recursive: true });
  });
});
