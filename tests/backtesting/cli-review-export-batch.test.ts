import { describe, expect, it } from 'vitest';
import { runMLBBacktestCLI } from '@/lib/backtesting/cli';
import { readFileSync } from 'node:fs';

const TEXT_FIXTURE_DIR = 'tests/backtesting/fixtures/historical-research-export-review';
const JSON_FIXTURE_DIR = 'tests/backtesting/fixtures/historical-research-export-review-json';
const REVIEW_DIR = 'tests/backtesting/fixtures/historical-research-export';

async function runReview(
  args: readonly string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  let stdout = '';
  let stderr = '';
  const exitCode = await runMLBBacktestCLI(args, {
    stdout: (message: string) => {
      stdout += `${message}\n`;
    },
    stderr: (message: string) => {
      stderr += `${message}\n`;
    },
  });

  return {
    stdout: stdout.replace(/\n$/, ''),
    stderr: stderr.replace(/\n$/, ''),
    exitCode,
  };
}

function buildCLIOptions({
  output,
  reviewExportJson,
}: {
  output?: string;
  reviewExportJson?: readonly string[];
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
  return args;
}

it('A: batch text with FULL + TEAM_ONLY exits 0 with expected batch header', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/team-only-export-v1.json`,
    ],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Historical Research Export Batch Review');
  expect(stdout).toContain('Files Reviewed: 2');
  expect(stdout).toContain('Valid Files: 2');
  expect(stdout).toContain('Invalid Files: 0');
  expect(stdout).toContain(`File 1: ${REVIEW_DIR}/full-export-v1.json`);
  expect(stdout).toContain(`File 2: ${REVIEW_DIR}/team-only-export-v1.json`);
  expect(stdout).toContain('Export Version: historical-research-export-v1');
  expect(stdout).toContain('Research Construction: FULL');
  expect(stdout).toContain('Research Construction: TEAM_ONLY');
});

it('B: batch JSON with FULL + TEAM_ONLY exits 0 and matches expected batch version', async () => {
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
  expect(payload.reviewVersion).toBe('historical-research-export-review-batch-v1');
  expect(payload.valid).toBe(true);
  expect(payload.summary).toEqual({ filesReviewed: 2, validFiles: 2, invalidFiles: 0 });
  expect(payload.reviews).toHaveLength(2);
  expect(payload.reviews[0].file).toBe(`${REVIEW_DIR}/full-export-v1.json`);
  expect(payload.reviews[0].review.valid).toBe(true);
  expect(payload.reviews[0].review.summary.researchConstruction).toBe('FULL');
  expect(payload.reviews[1].file).toBe(`${REVIEW_DIR}/team-only-export-v1.json`);
  expect(payload.reviews[1].review.valid).toBe(true);
  expect(payload.reviews[1].review.summary.researchConstruction).toBe('TEAM_ONLY');
});

it('C: batch text with one invalid manifest exits 1 and reports invalid', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/invalid-export-v1.json`,
    ],
  });
  const { stdout, stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toContain('Historical Research Export Batch Review');
  expect(stdout).toContain('Files Reviewed: 2');
  expect(stdout).toContain('Valid Files: 1');
  expect(stdout).toContain('Invalid Files: 1');
  expect(stdout).toContain(`File 1: ${REVIEW_DIR}/full-export-v1.json`);
  expect(stdout).toContain(`File 2: ${REVIEW_DIR}/invalid-export-v1.json`);
  expect(stdout).toContain('MANIFEST_PREDICTION_COUNT_MISMATCH');
  expect(stderr).toBe('');
});

it('D: batch JSON with one invalid manifest exits 1 and reports invalid', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/invalid-export-v1.json`,
    ],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  const payload = JSON.parse(stdout);
  expect(payload.valid).toBe(false);
  expect(payload.summary).toEqual({ filesReviewed: 2, validFiles: 1, invalidFiles: 1 });
  expect(payload.reviews[0].review.valid).toBe(true);
  expect(payload.reviews[1].review.valid).toBe(false);
  expect(payload.reviews[1].review.summary).toBe(null);
  expect(payload.reviews[1].review.issues.some((issue: { code: string }) => issue.code === 'MANIFEST_PREDICTION_COUNT_MISMATCH')).toBe(true);
});

it('E: batch text continues after invalid first file and reviews second file', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [
      `${REVIEW_DIR}/invalid-export-v1.json`,
      `${REVIEW_DIR}/full-export-v1.json`,
    ],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toContain(`File 1: ${REVIEW_DIR}/invalid-export-v1.json`);
  expect(stdout).toContain(`File 2: ${REVIEW_DIR}/full-export-v1.json`);
  expect(stdout).toContain('MANIFEST_PREDICTION_COUNT_MISMATCH');
  expect(stdout).toContain('Export Version: historical-research-export-v1');
});

it('F: batch JSON continues after invalid first file and reviews second file', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [
      `${REVIEW_DIR}/invalid-export-v1.json`,
      `${REVIEW_DIR}/full-export-v1.json`,
    ],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  const payload = JSON.parse(stdout);
  expect(payload.reviews).toHaveLength(2);
  expect(payload.reviews[0].file).toBe(`${REVIEW_DIR}/invalid-export-v1.json`);
  expect(payload.reviews[0].review.valid).toBe(false);
  expect(payload.reviews[1].file).toBe(`${REVIEW_DIR}/full-export-v1.json`);
  expect(payload.reviews[1].review.valid).toBe(true);
});

it('G: batch missing file exits 1 and still reviews other valid files', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [
      'tests/backtesting/fixtures/historical-research-export-review/missing.json',
      `${REVIEW_DIR}/full-export-v1.json`,
    ],
  });
  const { stdout, stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toContain('Historical Research Export Batch Review');
  expect(stdout).toContain('File 1: tests/backtesting/fixtures/historical-research-export-review/missing.json');
  expect(stdout).toContain(`File 2: ${REVIEW_DIR}/full-export-v1.json`);
  expect(stdout).toContain('EXPORT_REVIEW_FILE_NOT_FOUND');
  expect(stderr).toBe('');
});

it('H: batch missing file JSON exits 1 and summarizes other valid files', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [
      'tests/backtesting/fixtures/historical-research-export-review/missing.json',
      `${REVIEW_DIR}/full-export-v1.json`,
    ],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  const payload = JSON.parse(stdout);
  expect(payload.valid).toBe(false);
  expect(payload.summary).toEqual({ filesReviewed: 2, validFiles: 1, invalidFiles: 1 });
  expect(payload.reviews[0].file).toBe('tests/backtesting/fixtures/historical-research-export-review/missing.json');
  expect(payload.reviews[0].review.valid).toBe(false);
  expect(payload.reviews[0].review.summary).toBe(null);
  expect(payload.reviews[0].review.issues.some((issue: { code: string }) => issue.code === 'EXPORT_REVIEW_FILE_NOT_FOUND')).toBe(true);
  expect(payload.reviews[1].review.valid).toBe(true);
});

it('I: batch invalid JSON exits 1 and still reviews other valid files', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [
      'tests/backtesting/fixtures/historical-research-export-review/bad.json',
      `${REVIEW_DIR}/full-export-v1.json`,
    ],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  const payload = JSON.parse(stdout);
  expect(payload.valid).toBe(false);
  expect(payload.summary).toEqual({ filesReviewed: 2, validFiles: 1, invalidFiles: 1 });
  expect(payload.reviews[0].review.valid).toBe(false);
  expect(payload.reviews[0].review.issues.some((issue: { code: string }) => issue.code === 'INVALID_JSON_IN_EXPORT_FILE')).toBe(true);
  expect(payload.reviews[1].review.valid).toBe(true);
});

it('J: batch preserves input order for valid files', async () => {
  const args = buildCLIOptions({
    output: 'text',
    reviewExportJson: [
      `${REVIEW_DIR}/team-only-export-v1.json`,
      `${REVIEW_DIR}/full-export-v1.json`,
    ],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  const firstIndex = stdout.indexOf(`File 1: ${REVIEW_DIR}/team-only-export-v1.json`);
  const secondIndex = stdout.indexOf(`File 2: ${REVIEW_DIR}/full-export-v1.json`);
  expect(firstIndex).toBeGreaterThanOrEqual(0);
  expect(secondIndex).toBeGreaterThanOrEqual(0);
  expect(firstIndex).toBeLessThan(secondIndex);
});

it('K: batch produces no stderr when some files are invalid', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/invalid-export-v1.json`,
    ],
  });
  const { stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stderr).toBe('');
});

it('L: batch does not write files', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/team-only-export-v1.json`,
    ],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  expect(stdout).not.toContain('Export JSON');
});

it('M: batch JSON summary counts are correct for valid-only batch', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/team-only-export-v1.json`,
      `${REVIEW_DIR}/both-export-v1.json`,
    ],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  const payload = JSON.parse(stdout);
  expect(payload.valid).toBe(true);
  expect(payload.summary).toEqual({ filesReviewed: 3, validFiles: 3, invalidFiles: 0 });
});

it('N: batch JSON summary counts are correct for invalid batch', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [
      `${REVIEW_DIR}/invalid-export-v1.json`,
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/team-only-export-v1.json`,
    ],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  const payload = JSON.parse(stdout);
  expect(payload.valid).toBe(false);
  expect(payload.summary).toEqual({ filesReviewed: 3, validFiles: 2, invalidFiles: 1 });
});

it('O: batch JSON contains no raw predictions', async () => {
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
  const serialized = JSON.stringify(payload);
  expect(serialized).not.toContain('"eventId"');
  expect(serialized).not.toContain('"homeTeam"');
  expect(serialized).not.toContain('"awayTeam"');
});

it('P: batch JSON contains no raw abstentions', async () => {
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
  const serialized = JSON.stringify(payload);
  expect(serialized).not.toContain('"abstentionReason"');
});

it('Q: batch JSON contains no modelProbability', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/invalid-export-v1.json`,
    ],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).not.toContain('modelProbability');
});

it('R: batch JSON contains no odds/probability/betting concepts', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/team-only-export-v1.json`,
    ],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  expect(stdout).not.toContain('odds');
  expect(stdout).not.toContain('sportsbook');
  expect(stdout).not.toContain('implied probability');
  expect(stdout).not.toContain('expected value');
  expect(stdout).not.toContain('EV');
  expect(stdout).not.toContain('ROI');
  expect(stdout).not.toContain('edge');
});

it('S: batch mode does not call orchestrate', async () => {
  const deps: Parameters<typeof runMLBBacktestCLI>[2] = {
    orchestrate: async () => {
      throw new Error('orchestrate should not be called in review mode');
    },
  };
  const args = buildCLIOptions({
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/team-only-export-v1.json`,
    ],
  });
  const exitCode = await runMLBBacktestCLI(args, undefined, deps);
  expect(exitCode).toBe(0);
});

it('T: batch mode does not construct live provider', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/team-only-export-v1.json`,
    ],
  });
  const exitCode = await runMLBBacktestCLI(args, undefined, {});
  expect(exitCode).toBe(0);
});

it('U: batch mode does not write files', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/team-only-export-v1.json`,
    ],
  });
  const result = await runReview(args);
  expect(result.stdout).toContain('Historical Research Export Batch Review');
});

it('V: batch rejects --export-json combination', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--review-export-json',
    `${REVIEW_DIR}/team-only-export-v1.json`,
    '--export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
  ];
  const { stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stderr).toBe('Cannot combine --review-export-json with --export-json.');
});

it('W: missing first review path exits 1 and still reviews second file', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [
      'tests/backtesting/fixtures/historical-research-export-review/missing.json',
      `${REVIEW_DIR}/full-export-v1.json`,
    ],
  });
  const { stdout, stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toContain('EXPORT_REVIEW_FILE_NOT_FOUND');
  expect(stdout).toContain(`File 2: ${REVIEW_DIR}/full-export-v1.json`);
  expect(stderr).toBe('');
});

it('X: other duplicate options are still rejected', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--review-export-json',
    `${REVIEW_DIR}/team-only-export-v1.json`,
    '--cache-root=/tmp',
    '--cache-root=/tmp2',
  ];
  const { stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stderr).toBe('Duplicate option: --cache-root');
});

it('Y: single-file behavior remains byte-identical for valid text', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [`${REVIEW_DIR}/full-export-v1.json`],
  });
  const { stdout } = await runReview(args);
  expect(stdout).toBe(
    readFileSync(`${TEXT_FIXTURE_DIR}/full-review-v1.txt`, 'utf-8').replace(/\n$/, ''),
  );
});

it('Z: single-file behavior remains byte-identical for valid JSON', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [`${REVIEW_DIR}/full-export-v1.json`],
  });
  const { stdout } = await runReview(args);
  expect(stdout).toBe(
    readFileSync(`${JSON_FIXTURE_DIR}/full-review-json-v1.json`, 'utf-8'),
  );
});
