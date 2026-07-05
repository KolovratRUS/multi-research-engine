import { describe, expect, it } from 'vitest';
import { runMLBBacktestCLI, type MLBBacktestCLIDependencies } from '@/lib/backtesting/cli';
import { existsSync } from 'node:fs';

const REVIEW_DIR = 'tests/backtesting/fixtures/historical-research-export';
const PRESET_DIR = 'tests/backtesting/fixtures/historical-research-threshold-presets';
const OUTPUT_PATH = 'tests/backtesting/.tmp/cli-review-threshold-presets-output.json';

async function runReview(
  args: readonly string[],
  dependencies: MLBBacktestCLIDependencies | undefined = undefined,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  let stdout = '';
  let stderr = '';
  const exitCode = await runMLBBacktestCLI(
    args,
    {
      stdout: (message: string) => {
        stdout += `${message}\n`;
      },
      stderr: (message: string) => {
        stderr += `${message}\n`;
      },
    },
    dependencies,
  );

  return {
    stdout: stdout.replace(/\n$/, ''),
    stderr: stderr.replace(/\n$/, ''),
    exitCode,
  };
}

function buildCLIOptions({
  output,
  reviewExportJson,
  reviewThresholdsJson,
  directThresholds,
}: {
  output?: string;
  reviewExportJson?: readonly string[];
  reviewThresholdsJson?: string;
  directThresholds?: readonly string[];
} = {}): readonly string[] {
  const args: string[] = [];
  if (output) {
    args.push(`--output=${output}`);
  }
  if (reviewExportJson) {
    for (const path of reviewExportJson) {
      args.push(`--review-export-json=${path}`);
    }
  }
  if (reviewThresholdsJson) {
    args.push(`--review-thresholds-json=${reviewThresholdsJson}`);
  }
  if (directThresholds) {
    for (const flag of directThresholds) {
      args.push(flag);
    }
  }
  return args;
}

it('A: valid preset text mode passes and reports threshold checks passed', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/team-only-export-v1.json`,
    ],
    reviewThresholdsJson: `${PRESET_DIR}/passing-ci-thresholds-v1.json`,
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Threshold Checks: passed');
  expect(stdout).toContain('Historical Research Export Batch Review');
});

it('B: valid preset JSON mode passes with thresholdsPassed true and empty thresholdIssues', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/team-only-export-v1.json`,
    ],
    reviewThresholdsJson: `${PRESET_DIR}/passing-ci-thresholds-v1.json`,
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('"thresholdsPassed": true');
  expect(stdout).toContain('"thresholdIssues": []');
});

it('C: failing preset text mode exits 1 with deterministic threshold failure output', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/team-only-export-v1.json`,
    ],
    reviewThresholdsJson: `${PRESET_DIR}/failing-ci-thresholds-v1.json`,
  });
  const { stdout, stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toContain('Threshold Checks: failed');
  expect(stdout).toContain('MIN_VALID_FILES_NOT_MET');
  expect(stdout).toContain('MIN_TOTAL_PREDICTIONS_NOT_MET');
  expect(stdout).toContain('REQUIRED_CONSTRUCTION_MISSING');
  expect(stderr).toBe('');
});

it('D: failing preset JSON mode exits 1 with deterministic threshold failure output', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/team-only-export-v1.json`,
    ],
    reviewThresholdsJson: `${PRESET_DIR}/failing-ci-thresholds-v1.json`,
  });
  const { stdout, stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  const payload = JSON.parse(stdout);
  expect(payload.thresholdsPassed).toBe(false);
  expect(payload.thresholdIssues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: 'MIN_VALID_FILES_NOT_MET' }),
      expect.objectContaining({ code: 'MIN_TOTAL_PREDICTIONS_NOT_MET' }),
      expect.objectContaining({ code: 'REQUIRED_CONSTRUCTION_MISSING' }),
    ]),
  );
  expect(stderr).toBe('');
});

it('E: preset missing file exits 1 with deterministic stderr and empty stdout', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [ `${REVIEW_DIR}/full-export-v1.json` ],
    reviewThresholdsJson: `${PRESET_DIR}/missing-preset.json`,
  });
  const { stdout, stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('Threshold preset file not found');
});

it('F: preset invalid JSON exits 1 with deterministic stderr and empty stdout', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [ `${REVIEW_DIR}/full-export-v1.json` ],
    reviewThresholdsJson: `${PRESET_DIR}/invalid-json-thresholds-v1.json`,
  });
  const { stdout, stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('Invalid JSON in threshold preset');
});

it('G: preset unsupported version exits 1 with deterministic issue code', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [ `${REVIEW_DIR}/full-export-v1.json` ],
    reviewThresholdsJson: `${PRESET_DIR}/invalid-version-thresholds-v1.json`,
  });
  const { stdout, stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('THRESHOLD_PRESET_VERSION_UNSUPPORTED');
});

it('H: preset missing version exits 1 with deterministic issue code', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [ `${REVIEW_DIR}/full-export-v1.json` ],
    reviewThresholdsJson: `${PRESET_DIR}/invalid-shape-thresholds-v1.json`,
  });
  const { stdout, stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('THRESHOLD_PRESET_VERSION_MISSING');
});

it('I: preset unknown field exits 1 with deterministic issue code', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [ `${REVIEW_DIR}/full-export-v1.json` ],
    reviewThresholdsJson: `${PRESET_DIR}/unknown-field-thresholds-v1.json`,
  });
  const { stdout, stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('THRESHOLD_PRESET_UNKNOWN_FIELD');
});

it('J: preset invalid numeric value exits 1 with deterministic issue code', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [ `${REVIEW_DIR}/full-export-v1.json` ],
    reviewThresholdsJson: `${PRESET_DIR}/invalid-integer-thresholds-v1.json`,
  });
  const { stdout, stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('THRESHOLD_PRESET_INVALID_INTEGER');
});

it('K: preset invalid construction exits 1 with deterministic issue code', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [ `${REVIEW_DIR}/full-export-v1.json` ],
    reviewThresholdsJson: `${PRESET_DIR}/invalid-construction-thresholds-v1.json`,
  });
  const { stdout, stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('THRESHOLD_PRESET_INVALID_CONSTRUCTION');
});

it('L: preset invalid string arrays exits 1 with deterministic issue code', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [ `${REVIEW_DIR}/full-export-v1.json` ],
    reviewThresholdsJson: `${PRESET_DIR}/invalid-string-array-thresholds-v1.json`,
  });
  const { stdout, stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('THRESHOLD_PRESET_INVALID_STRING_ARRAY');
});

it('M: --review-thresholds-json without --review-export-json is rejected', async () => {
  const args = buildCLIOptions({
    reviewThresholdsJson: `${PRESET_DIR}/passing-ci-thresholds-v1.json`,
  });
  const { stdout, stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('Threshold checks are only valid with --review-export-json.');
});

it('N: --review-thresholds-json cannot combine with direct threshold flags', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [ `${REVIEW_DIR}/full-export-v1.json` ],
    reviewThresholdsJson: `${PRESET_DIR}/passing-ci-thresholds-v1.json`,
    directThresholds: ['--min-valid-files=1'],
  });
  const { stdout, stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('Cannot combine --review-thresholds-json with direct threshold flags.');
});

it('O: duplicate --review-thresholds-json rejected', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--review-thresholds-json',
    `${PRESET_DIR}/passing-ci-thresholds-v1.json`,
    '--review-thresholds-json',
    `${PRESET_DIR}/passing-ci-thresholds-v1.json`,
  ];
  const { stdout, stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('Duplicate option: --review-thresholds-json');
});

it('P: direct Phase 1S threshold flags still work', async () => {
  const args = [
    `--review-export-json=${REVIEW_DIR}/full-export-v1.json`,
    `--review-export-json=${REVIEW_DIR}/team-only-export-v1.json`,
    '--min-valid-files=2',
    '--max-invalid-files=0',
    '--min-total-predictions=2',
  ];
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Threshold Checks: passed');
});

it('Q: no-threshold single-file text output remains byte-identical tone', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [ `${REVIEW_DIR}/full-export-v1.json` ],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Historical Research Export Review');
  expect(stdout).toContain('Generated At:');
  expect(stdout).toContain('Export ID:');
});

it('R: no-threshold single-file JSON output remains byte-identical tone', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [ `${REVIEW_DIR}/full-export-v1.json` ],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  const payload = JSON.parse(stdout);
  expect(payload.reviewVersion).toBe('historical-research-export-review-v1');
  expect(payload.valid).toBe(true);
});

it('S: no-threshold batch JSON output remains Phase 1R-compatible and does not contain threshold fields', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/team-only-export-v1.json`,
    ],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  const payload = JSON.parse(stdout);
  expect(payload).not.toHaveProperty('thresholdsPassed');
  expect(payload).not.toHaveProperty('thresholdIssues');
});

it('T: preset threshold mode does not call orchestrate', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/team-only-export-v1.json`,
    ],
    reviewThresholdsJson: `${PRESET_DIR}/passing-ci-thresholds-v1.json`,
  });
  const { exitCode } = await runReview(args, {
    orchestrate: (() => {
      throw new Error('orchestrate must not be called in review mode');
    }) as MLBBacktestCLIDependencies['orchestrate'],
  });
  expect(exitCode).toBe(0);
});

it('U: preset threshold mode does not construct live provider', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/team-only-export-v1.json`,
    ],
    reviewThresholdsJson: `${PRESET_DIR}/passing-ci-thresholds-v1.json`,
  });
  const { exitCode } = await runReview(args, {
    createLiveProvider: (() => {
      throw new Error('createLiveProvider must not be called in review mode');
    }) as MLBBacktestCLIDependencies['createLiveProvider'],
  });
  expect(exitCode).toBe(0);
});

it('V: preset threshold mode does not write files', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [ `${REVIEW_DIR}/full-export-v1.json` ],
    reviewThresholdsJson: `${PRESET_DIR}/passing-ci-thresholds-v1.json`,
  });
  await runReview(args);
  expect(existsSync(OUTPUT_PATH)).toBe(false);
});

it('W: output contains no modelProbability', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/team-only-export-v1.json`,
    ],
    reviewThresholdsJson: `${PRESET_DIR}/passing-ci-thresholds-v1.json`,
  });
  const { stdout } = await runReview(args);
  expect(stdout).not.toContain('modelProbability');
});

it('X: output contains no odds/probability/betting concepts', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/team-only-export-v1.json`,
    ],
    reviewThresholdsJson: `${PRESET_DIR}/passing-ci-thresholds-v1.json`,
  });
  const { stdout } = await runReview(args);
  const lower = stdout.toLowerCase();
  expect(lower).not.toContain('odds');
  expect(lower).not.toContain('sportsbook');
  expect(lower).not.toContain('implied probability');
  expect(lower).not.toContain('expected value');
  expect(lower).not.toContain('roi');
  expect(lower).not.toContain('edge');
  expect(lower).not.toContain('favorite');
  expect(lower).not.toContain('underdog');
  expect(lower).not.toContain('line movement');
  expect(lower).not.toContain('public betting');
  expect(lower).not.toContain('betting value');
  expect(lower).not.toContain('calibrated probability');
});

it('Y: existing CLI parser duplicate behavior remains intact', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--review-export-json',
    `${REVIEW_DIR}/team-only-export-v1.json`,
    '--min-valid-files=2',
    '--max-invalid-files=0',
  ];
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Threshold Checks: passed');
});
