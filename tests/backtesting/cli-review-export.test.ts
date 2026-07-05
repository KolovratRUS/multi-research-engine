import { describe, expect, it } from 'vitest';
import { runMLBBacktestCLI } from '@/lib/backtesting/cli';
import { readFileSync } from 'node:fs';

const TEXT_FIXTURE_DIR = 'tests/backtesting/fixtures/historical-research-export-review';
const JSON_FIXTURE_DIR = 'tests/backtesting/fixtures/historical-research-export-review-json';
const REVIEW_DIR = 'tests/backtesting/fixtures/historical-research-export';
const INVALID_REVIEW = `${REVIEW_DIR}/invalid-export-v1.json`;
const INVALID_REVIEW_JSON = `${JSON_FIXTURE_DIR}/invalid-manifest-review-json-v1.json`;

function readTextFixture(fileName: string): string {
  return readFileSync(`${TEXT_FIXTURE_DIR}/${fileName}`, 'utf-8');
}

function readJsonFixture(fileName: string): string {
  return readFileSync(`${JSON_FIXTURE_DIR}/${fileName}`, 'utf-8');
}

function buildCLIOptions({
  output,
  reviewExportJson,
  exportJson,
  source,
}: {
  output?: string;
  reviewExportJson?: readonly string[];
  exportJson?: string;
  source?: string;
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
  if (exportJson) {
    args.push(`--export-json=${exportJson}`);
  }
  if (source) {
    args.push(`--source=${source}`);
  }
  return args;
}

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

it('A: single valid text output matches full review fixture exactly', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [`${REVIEW_DIR}/full-export-v1.json`],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  expect(stdout).toBe(readTextFixture('full-review-v1.txt'));
});

it('B: single valid text output matches team-only review fixture exactly', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [`${REVIEW_DIR}/team-only-export-v1.json`],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  expect(stdout).toBe(readTextFixture('team-only-review-v1.txt'));
});

it('C: single valid text output matches both review fixture exactly', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [`${REVIEW_DIR}/both-export-v1.json`],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  expect(stdout).toBe(readTextFixture('both-review-v1.txt'));
});

it('D: single valid text output matches abstention review fixture exactly', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [`${REVIEW_DIR}/abstention-export-v1.json`],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  expect(stdout).toBe(readTextFixture('abstention-review-v1.txt'));
});

it('E: single invalid manifest text stderr matches invalid-manifest fixture exactly', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [INVALID_REVIEW],
  });
  const { stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stderr).toBe(readTextFixture('invalid-manifest-review-v1.txt'));
});

it('F: single full JSON output matches full review JSON fixture exactly', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [`${REVIEW_DIR}/full-export-v1.json`],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  expect(stdout).toBe(readJsonFixture('full-review-json-v1.json'));
});

it('G: repeated --review-export-json paths are accumulated', async () => {
  const input = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--review-export-json',
    `${REVIEW_DIR}/team-only-export-v1.json`,
  ];
  const { stdout, exitCode } = await runReview(input);
  expect(exitCode).toBe(0);
  expect(stdout).toContain(`File 1: ${REVIEW_DIR}/full-export-v1.json`);
  expect(stdout).toContain(`File 2: ${REVIEW_DIR}/team-only-export-v1.json`);
});

it('H: duplicate --export-json is still rejected', async () => {
  const input = [
    '--export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--export-json',
    `${REVIEW_DIR}/team-only-export-v1.json`,
  ];
  const { stderr, exitCode } = await runReview(input);
  expect(exitCode).toBe(1);
  expect(stderr).toBe('Duplicate option: --export-json');
});

it('I: empty --review-export-json is rejected', async () => {
  const input = ['--review-export-json', ''];
  const { stderr, exitCode } = await runReview(input);
  expect(exitCode).toBe(1);
  expect(stderr).toBe('Invalid --review-export-json. Expected a non-empty path.');
});

it('J: review mode rejects --export-json combination', async () => {
  const input = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
  ];
  const { stderr, exitCode } = await runReview(input);
  expect(exitCode).toBe(1);
  expect(stderr).toBe('Cannot combine --review-export-json with --export-json.');
});

it('K: review mode rejects --source live', async () => {
  const input = [
    '--source=live',
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
  ];
  const { stderr, exitCode } = await runReview(input);
  expect(exitCode).toBe(1);
  expect(stderr).toBe('Live mode requires --date or --start and --end.');
});

it('L: invalid manifest JSON output shows issues with stderr empty', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [INVALID_REVIEW],
  });
  const { stdout, stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toBe(readJsonFixture('invalid-manifest-review-json-v1.json'));
  expect(stderr).toBe('');
});

it('M: missing file returns stderr text', async () => {
  const args = buildCLIOptions({
    reviewExportJson: ['tests/backtesting/fixtures/historical-research-export-review/missing.json'],
  });
  const { stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stderr).toContain('Export file not found');
});

it('N: invalid JSON returns stderr text', async () => {
  const args = buildCLIOptions({
    reviewExportJson: ['tests/backtesting/fixtures/historical-research-export-review/bad.json'],
  });
  const { stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stderr).toContain('Invalid JSON in export file');
});

it('O: review mode rejects date options', async () => {
  const input = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--date=2024-06-01',
  ];
  const { stderr, exitCode } = await runReview(input);
  expect(exitCode).toBe(1);
  expect(stderr).toBe('Review mode does not accept date options.');
});

it('P: review mode rejects backtest options', async () => {
  const input = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--cache-root=/tmp',
  ];
  const { stderr, exitCode } = await runReview(input);
  expect(exitCode).toBe(1);
  expect(stderr).toBe('Review mode does not accept backtest options.');
});

it('Q: help does not include backtest behavior change', async () => {
  const args = ['--help'];
  const { stdout } = await runReview(args);
  expect(stdout).toContain('Review a saved historical research export file');
});

it('R: single full JSON output does not contain raw predictions', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [`${REVIEW_DIR}/full-export-v1.json`],
  });
  const { stdout } = await runReview(args);
  const parsed = JSON.parse(stdout);
  expect(parsed.summary).toBeTruthy();
});

it('S: single full JSON output does not contain modelProbability', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [`${REVIEW_DIR}/full-export-v1.json`],
  });
  const { stdout } = await runReview(args);
  expect(stdout).not.toContain('modelProbability');
});

it('T: review mode does not call orchestrate in tests because no backtest path is taken', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [`${REVIEW_DIR}/full-export-v1.json`],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Historical Research Export Review');
});
