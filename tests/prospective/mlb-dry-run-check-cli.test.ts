import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

const projectRoot = join(__dirname, '..', '..');
const scriptPath = join(projectRoot, 'scripts', 'mlb-prospective-dry-run-check.ts');
const goldenPath = join(__dirname, 'fixtures', 'mlb-dry-run-check-output-v1.json');
const goldenOutput = readFileSync(goldenPath, 'utf8').trim();

function runCheck(): string {
  return execFileSync(process.execPath, ['--require', 'tsx/cjs', scriptPath], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
}

describe('Phase 4D MLB prospective weekly: dry-run check CLI', () => {
  it('CLI command exits successfully', () => {
    expect(() => runCheck()).not.toThrow();
  });

  it('stdout is valid JSON with expected summary fields', () => {
    const stdout = runCheck();
    const summary = JSON.parse(stdout) as Record<string, unknown>;

    expect(summary.runId).toBe('mlb-local-dry-run-2024-07-sample');
    expect(summary.gameCount).toBe(3);
    expect(summary.pregameResearchCount).toBe(3);
    expect(summary.outcomeAttachmentCount).toBe(3);
    expect(summary.passed).toBe(true);
    expect(summary.validationErrorCount).toBe(0);
    expect(summary.modelProbabilityStatus).toBe('null');
    expect(summary.pregameSnapshotsContainFinalScore).toBe(false);
    expect(summary.pregameSnapshotsContainCompletedGameState).toBe(false);
    expect(summary.historicalFixtureInventoryTouched).toBe(false);
  });

  it('stdout matches the golden dry-run check JSON exactly', () => {
    expect(runCheck().trim()).toBe(goldenOutput.trim());
  });
});
