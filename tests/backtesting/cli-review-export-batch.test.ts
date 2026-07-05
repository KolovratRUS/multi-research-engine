import { describe, expect, it } from 'vitest';
import { runMLBBacktestCLI } from '@/lib/backtesting/cli';
import {
  buildHistoricalResearchExportBatchAggregateSummary,
  type HistoricalResearchExportBatchReviewItem,
  type HistoricalResearchExportReviewJson,
  type HistoricalResearchExportReviewSummary,
  HISTORICAL_RESEARCH_EXPORT_REVIEW_VERSION,
} from '@/lib/backtesting/historical-research-export';
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

function buildReviewItem(
  summary: HistoricalResearchExportReviewSummary | null,
  valid = true,
): HistoricalResearchExportReviewJson {
  return {
    reviewVersion: HISTORICAL_RESEARCH_EXPORT_REVIEW_VERSION,
    valid,
    summary,
    issues: [],
  };
}

it('A: batch text with FULL + TEAM_ONLY includes aggregate counts', async () => {
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
  expect(stdout).toContain('Total Requested Dates: 6');
  expect(stdout).toContain('Total Predictions: 2');
  expect(stdout).toContain('Total Abstentions: 0');
  expect(stdout).toContain('Total Warnings: 2');
  expect(stdout).toContain('Construction Counts: FULL=1, TEAM_ONLY=1, BOTH=0');
  expect(stdout).toContain('Comparison Included Files: 0');
  expect(stdout).toContain('Included Evidence Domains: team-offense');
  expect(stdout).toContain('Excluded Evidence Domains: starting-pitcher');
  expect(stdout).toContain('Warning Summary: full-warn, team-warn');
  expect(stdout).toContain(`File 1: ${REVIEW_DIR}/full-export-v1.json`);
  expect(stdout).toContain(`File 2: ${REVIEW_DIR}/team-only-export-v1.json`);
});

it('B: batch JSON with FULL + TEAM_ONLY summary contains aggregate values', async () => {
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
  expect(payload.summary).toEqual({
    filesReviewed: 2,
    validFiles: 2,
    invalidFiles: 0,
    totalRequestedDates: 6,
    totalPredictions: 2,
    totalAbstentions: 0,
    totalWarnings: 2,
    constructionCounts: { FULL: 1, TEAM_ONLY: 1, BOTH: 0 },
    comparisonIncludedFiles: 0,
    evidenceDomainSummary: { included: ['team-offense'], excluded: ['starting-pitcher'] },
    warningSummary: ['full-warn', 'team-warn'],
  });
  expect(payload.reviews).toHaveLength(2);
  expect(payload.reviews[0].file).toBe(`${REVIEW_DIR}/full-export-v1.json`);
  expect(payload.reviews[1].file).toBe(`${REVIEW_DIR}/team-only-export-v1.json`);
});

it('C: batch text with one invalid manifest excludes invalid from aggregates', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/invalid-export-v1.json`,
    ],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toContain('Files Reviewed: 2');
  expect(stdout).toContain('Valid Files: 1');
  expect(stdout).toContain('Invalid Files: 1');
  expect(stdout).toContain('Total Requested Dates: 3');
  expect(stdout).toContain('Total Predictions: 1');
  expect(stdout).toContain('Total Warnings: 1');
  expect(stdout).toContain('MANIFEST_PREDICTION_COUNT_MISMATCH');
  expect(stdout).toContain(`File 2: ${REVIEW_DIR}/invalid-export-v1.json`);
});

it('D: batch JSON with one invalid manifest excludes invalid from aggregates', async () => {
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
  expect(payload.summary).toEqual({
    filesReviewed: 2,
    validFiles: 1,
    invalidFiles: 1,
    totalRequestedDates: 3,
    totalPredictions: 1,
    totalAbstentions: 0,
    totalWarnings: 1,
    constructionCounts: { FULL: 1, TEAM_ONLY: 0, BOTH: 0 },
    comparisonIncludedFiles: 0,
    evidenceDomainSummary: { included: ['team-offense'], excluded: ['starting-pitcher'] },
    warningSummary: ['full-warn'],
  });
  expect(payload.reviews[1].review.summary).toBe(null);
  expect(payload.reviews[1].review.issues.some((issue: { code: string }) => issue.code === 'MANIFEST_PREDICTION_COUNT_MISMATCH')).toBe(true);
});

it('E: batch text with BOTH includes comparison and BOTH construction count', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [
      `${REVIEW_DIR}/both-export-v1.json`,
      `${REVIEW_DIR}/full-export-v1.json`,
    ],
  });
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Construction Counts: FULL=1, TEAM_ONLY=0, BOTH=1');
  expect(stdout).toContain('Comparison Included Files: 1');
});

it('F: batch JSON with FULL + TEAM_ONLY + BOTH includes BOTH aggregate values', async () => {
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
  expect(payload.summary).toEqual({
    filesReviewed: 3,
    validFiles: 3,
    invalidFiles: 0,
    totalRequestedDates: 9,
    totalPredictions: 4,
    totalAbstentions: 0,
    totalWarnings: 2,
    constructionCounts: { FULL: 1, TEAM_ONLY: 1, BOTH: 1 },
    comparisonIncludedFiles: 1,
    evidenceDomainSummary: { included: ['team-offense'], excluded: ['starting-pitcher'] },
    warningSummary: ['full-warn', 'team-warn'],
  });
});

it('G: batch missing file excludes missing file from aggregates', async () => {
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
  expect(payload.summary).toEqual({
    filesReviewed: 2,
    validFiles: 1,
    invalidFiles: 1,
    totalRequestedDates: 3,
    totalPredictions: 1,
    totalAbstentions: 0,
    totalWarnings: 1,
    constructionCounts: { FULL: 1, TEAM_ONLY: 0, BOTH: 0 },
    comparisonIncludedFiles: 0,
    evidenceDomainSummary: { included: ['team-offense'], excluded: ['starting-pitcher'] },
    warningSummary: ['full-warn'],
  });
  expect(payload.reviews[0].review.valid).toBe(false);
  expect(payload.reviews[0].review.summary).toBe(null);
});

it('H: batch invalid JSON excludes invalid JSON from aggregates', async () => {
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
  expect(payload.summary).toEqual({
    filesReviewed: 2,
    validFiles: 1,
    invalidFiles: 1,
    totalRequestedDates: 3,
    totalPredictions: 1,
    totalAbstentions: 0,
    totalWarnings: 1,
    constructionCounts: { FULL: 1, TEAM_ONLY: 0, BOTH: 0 },
    comparisonIncludedFiles: 0,
    evidenceDomainSummary: { included: ['team-offense'], excluded: ['starting-pitcher'] },
    warningSummary: ['full-warn'],
  });
});

it('I: aggregate helper dedupes evidence domains by first-seen order', () => {
  const items: readonly HistoricalResearchExportBatchReviewItem[] = [
    { file: 'a.json', review: buildReviewItem({ ...fakeSummary(), evidenceDomainSummary: { included: ['team-offense', 'starting-pitcher'], excluded: [] } }) },
    { file: 'b.json', review: buildReviewItem({ ...fakeSummary(), evidenceDomainSummary: { included: ['starting-pitcher'], excluded: ['team-offense'] } }) },
  ];

  const summary = buildHistoricalResearchExportBatchAggregateSummary(items);
  expect(summary.evidenceDomainSummary.included).toEqual(['team-offense', 'starting-pitcher']);
  expect(summary.evidenceDomainSummary.excluded).toEqual(['team-offense']);
});

it('J: aggregate helper dedupes warning summaries by first-seen order', () => {
  const items: readonly HistoricalResearchExportBatchReviewItem[] = [
    { file: 'a.json', review: buildReviewItem({ ...fakeSummary(), warningSummary: ['x', 'y'] }) },
    { file: 'b.json', review: buildReviewItem({ ...fakeSummary(), warningSummary: ['y', 'z'] }) },
  ];

  const summary = buildHistoricalResearchExportBatchAggregateSummary(items);
  expect(summary.warningSummary).toEqual(['x', 'y', 'z']);
});

it('K: aggregate helper excludes invalid items from totals', () => {
  const validSummary = fakeSummary();
  const validItems: readonly HistoricalResearchExportBatchReviewItem[] = [
    { file: 'a.json', review: buildReviewItem(validSummary) },
    { file: 'b.json', review: buildReviewItem(null, false) },
  ];

  const summary = buildHistoricalResearchExportBatchAggregateSummary(validItems);
  expect(summary.filesReviewed).toBe(2);
  expect(summary.validFiles).toBe(1);
  expect(summary.invalidFiles).toBe(1);
  expect(summary.totalPredictions).toBe(validSummary.resultCounts.predictions);
});

it('L: aggregate helper preserves construction counts in fixed order', () => {
  const items: readonly HistoricalResearchExportBatchReviewItem[] = [
    { file: 'a.json', review: buildReviewItem({ ...fakeSummary(), researchConstruction: 'BOTH' }) },
    { file: 'b.json', review: buildReviewItem({ ...fakeSummary(), researchConstruction: 'FULL' }) },
    { file: 'c.json', review: buildReviewItem({ ...fakeSummary(), researchConstruction: 'BOTH' }) },
  ];

  const summary = buildHistoricalResearchExportBatchAggregateSummary(items);
  expect(Object.keys(summary.constructionCounts)).toEqual(['FULL', 'TEAM_ONLY', 'BOTH']);
  expect(summary.constructionCounts).toEqual({ FULL: 1, TEAM_ONLY: 0, BOTH: 2 });
});

it('M: batch JSON preserves input order in reviews', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [
      `${REVIEW_DIR}/team-only-export-v1.json`,
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/both-export-v1.json`,
    ],
  });
  const { stdout } = await runReview(args);
  const payload = JSON.parse(stdout);
  expect(payload.reviews.map((item: { file: string }) => item.file)).toEqual([
    `${REVIEW_DIR}/team-only-export-v1.json`,
    `${REVIEW_DIR}/full-export-v1.json`,
    `${REVIEW_DIR}/both-export-v1.json`,
  ]);
});

it('N: batch JSON contains no raw predictions', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/team-only-export-v1.json`,
    ],
  });
  const { stdout } = await runReview(args);
  const serialized = JSON.stringify(JSON.parse(stdout));
  expect(serialized).not.toContain('eventId');
  expect(serialized).not.toContain('homeTeam');
  expect(serialized).not.toContain('awayTeam');
});

it('O: batch JSON contains no raw abstentions', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/team-only-export-v1.json`,
    ],
  });
  const { stdout } = await runReview(args);
  const serialized = JSON.stringify(JSON.parse(stdout));
  expect(serialized).not.toContain('abstentionReason');
});

it('P: batch JSON contains no modelProbability', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/invalid-export-v1.json`,
    ],
  });
  const { stdout } = await runReview(args);
  expect(stdout).not.toContain('modelProbability');
});

it('Q: batch JSON contains no odds/probability/betting concepts', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/team-only-export-v1.json`,
    ],
  });
  const { stdout } = await runReview(args);
  expect(stdout).not.toContain('odds');
  expect(stdout).not.toContain('sportsbook');
  expect(stdout).not.toContain('implied probability');
  expect(stdout).not.toContain('expected value');
  expect(stdout).not.toContain('EV');
  expect(stdout).not.toContain('ROI');
  expect(stdout).not.toContain('edge');
});

it('R: batch mode does not call orchestrate', async () => {
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

it('S: batch mode does not construct live provider', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/team-only-export-v1.json`,
    ],
  });
  const exitCode = await runMLBBacktestCLI(args, undefined, {});
  expect(exitCode).toBe(0);
});

it('T: batch mode does not write files', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [
      `${REVIEW_DIR}/full-export-v1.json`,
      `${REVIEW_DIR}/team-only-export-v1.json`,
    ],
  });
  const result = await runReview(args);
  expect(result.stdout).toContain('Historical Research Export Batch Review');
});

it('U: batch rejects --export-json combination', async () => {
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

it('V: missing first review path exits 1 and still reviews second file', async () => {
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

it('W: other duplicate options are still rejected', async () => {
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

it('X: single-file behavior remains byte-identical for valid text', async () => {
  const args = buildCLIOptions({
    reviewExportJson: [`${REVIEW_DIR}/full-export-v1.json`],
  });
  const { stdout } = await runReview(args);
  expect(stdout).toBe(
    readFileSync(`${TEXT_FIXTURE_DIR}/full-review-v1.txt`, 'utf-8').replace(/\n$/, ''),
  );
});

it('Y: single-file behavior remains byte-identical for valid JSON', async () => {
  const args = buildCLIOptions({
    output: 'json',
    reviewExportJson: [`${REVIEW_DIR}/full-export-v1.json`],
  });
  const { stdout } = await runReview(args);
  expect(stdout).toBe(
    readFileSync(`${JSON_FIXTURE_DIR}/full-review-json-v1.json`, 'utf-8'),
  );
});

it('Z: batch continues after invalid first file and reviews second file', async () => {
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

it('AA: batch JSON continues after invalid first file and reviews second file', async () => {
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

it('AB: batch produces no stderr when some files are invalid', async () => {
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

it('AC: passing thresholds in text mode outputs Threshold Checks: passed', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--review-export-json',
    `${REVIEW_DIR}/team-only-export-v1.json`,
    '--min-valid-files=2',
    '--max-invalid-files=0',
    '--min-total-predictions=2',
  ];
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Threshold Checks: passed');
});

it('AD: passing thresholds in JSON mode adds thresholdsPassed true and empty thresholdIssues', async () => {
  const args = [
    '--output=json',
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--review-export-json',
    `${REVIEW_DIR}/team-only-export-v1.json`,
    '--min-valid-files=2',
    '--max-invalid-files=0',
    '--min-total-predictions=2',
  ];
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  const payload = JSON.parse(stdout);
  expect(payload.thresholdsPassed).toBe(true);
  expect(payload.thresholdIssues).toEqual([]);
});

it('AE: failing min valid files exits 1 with MIN_VALID_FILES_NOT_MET', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--min-valid-files=2',
  ];
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toContain('MIN_VALID_FILES_NOT_MET');
});

it('AF: failing max invalid files exits 1 with MAX_INVALID_FILES_EXCEEDED', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--review-export-json',
    `${REVIEW_DIR}/invalid-export-v1.json`,
    '--max-invalid-files=0',
  ];
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toContain('MAX_INVALID_FILES_EXCEEDED');
});

it('AG: failing min total predictions exits 1 with MIN_TOTAL_PREDICTIONS_NOT_MET', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/abstention-export-v1.json`,
    '--min-total-predictions=1',
  ];
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toContain('MIN_TOTAL_PREDICTIONS_NOT_MET');
});

it('AH: failing max total abstentions exits 1 with MAX_TOTAL_ABSTENTIONS_EXCEEDED', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/abstention-export-v1.json`,
    '--max-total-abstentions=0',
  ];
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toContain('MAX_TOTAL_ABSTENTIONS_EXCEEDED');
});

it('AI: failing max total warnings exits 1 with MAX_TOTAL_WARNINGS_EXCEEDED', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--max-total-warnings=0',
  ];
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toContain('MAX_TOTAL_WARNINGS_EXCEEDED');
});

it('AJ: passing required construction FULL and TEAM_ONLY', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--review-export-json',
    `${REVIEW_DIR}/team-only-export-v1.json`,
    '--require-construction=FULL',
    '--require-construction=TEAM_ONLY',
  ];
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Threshold Checks: passed');
});

it('AK: failing required construction BOTH exits 1 with REQUIRED_CONSTRUCTION_MISSING', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--require-construction=BOTH',
  ];
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toContain('REQUIRED_CONSTRUCTION_MISSING');
});

it('AL: passing required evidence domain team-offense', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--require-evidence-domain=team-offense',
  ];
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Threshold Checks: passed');
});

it('AM: failing required evidence domain exits 1 with REQUIRED_EVIDENCE_DOMAIN_MISSING', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--require-evidence-domain=unavailable-domain',
  ];
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toContain('REQUIRED_EVIDENCE_DOMAIN_MISSING');
});

it('AN: forbidden warning absent passes', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/team-only-export-v1.json`,
    '--forbid-warning=full-warn',
  ];
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Threshold Checks: passed');
});

it('AO: forbidden warning present exits 1 with FORBIDDEN_WARNING_PRESENT', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--forbid-warning=full-warn',
  ];
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toContain('FORBIDDEN_WARNING_PRESENT');
});

it('AP: multiple threshold failures preserve deterministic order', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/invalid-export-v1.json`,
    '--min-valid-files=2',
    '--min-total-predictions=1',
  ];
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  const thresholdIndex = stdout.lastIndexOf('Threshold Issues:');
  expect(thresholdIndex).toBeGreaterThanOrEqual(0);
  const nextSectionIndex = stdout.indexOf('\nFile 1:', thresholdIndex);
  const thresholdBlock = nextSectionIndex >= 0
    ? stdout.slice(thresholdIndex + 'Threshold Issues:'.length, nextSectionIndex)
    : stdout.slice(thresholdIndex + 'Threshold Issues:'.length);
  const issueLines = thresholdBlock
    .split('\n')
    .filter((line: string) => line.startsWith('- '))
    .map((line: string) => line.split(':')[0].replace('- ', ''));

  expect(issueLines).toEqual(['MIN_VALID_FILES_NOT_MET', 'MIN_TOTAL_PREDICTIONS_NOT_MET']);
});

it('AQ: threshold flags without --review-export-json are rejected', async () => {
  const args = [
    '--min-valid-files=1',
  ];
  const { stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stderr).toBe('Threshold checks are only valid with --review-export-json.');
});

it('AR: negative numeric threshold value is rejected', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--min-valid-files=-1',
  ];
  const { stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stderr).toBe('Invalid --min-valid-files. Expected a non-negative integer.');
});

it('AS: decimal numeric threshold value is rejected', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--min-valid-files=1.5',
  ];
  const { stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stderr).toBe('Invalid --min-valid-files. Expected a non-negative integer.');
});

it('AT: non-numeric threshold value is rejected', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--min-valid-files=abc',
  ];
  const { stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stderr).toBe('Invalid --min-valid-files. Expected a non-negative integer.');
});

it('AU: empty threshold value is rejected', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--min-valid-files',
    '',
  ];
  const { stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stderr).toBe('Invalid --min-valid-files. Expected a non-negative integer.');
});

it('AV: repeated --require-construction is accepted', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--review-export-json',
    `${REVIEW_DIR}/team-only-export-v1.json`,
    '--require-construction=FULL',
    '--require-construction=TEAM_ONLY',
  ];
  const { stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  expect(stderr).toBe('');
});

it('AW: repeated --require-evidence-domain is accepted', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--require-evidence-domain=team-offense',
    '--require-evidence-domain=starting-pitcher',
  ];
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Threshold Checks: passed');
});

it('AX: repeated --forbid-warning is accepted', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/team-only-export-v1.json`,
    '--forbid-warning=full-warn',
    '--forbid-warning=missing-warn',
  ];
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Threshold Checks: passed');
});

it('AY: other duplicate options are still rejected', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--cache-root=/tmp',
    '--cache-root=/tmp2',
  ];
  const { stderr, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stderr).toBe('Duplicate option: --cache-root');
});

it('AZ: single-file text output without thresholds remains byte-identical', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
  ];
  const { stdout } = await runReview(args);
  expect(stdout).toBe(
    readFileSync(`${TEXT_FIXTURE_DIR}/full-review-v1.txt`, 'utf-8').replace(/\n$/, ''),
  );
});

it('BA: single-file JSON output without thresholds remains byte-identical', async () => {
  const args = [
    '--output=json',
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
  ];
  const { stdout } = await runReview(args);
  expect(stdout).toBe(readFileSync(`${JSON_FIXTURE_DIR}/full-review-json-v1.json`, 'utf-8'));
});

it('BB: review invalidity plus threshold failures exits 1 and reports both', async () => {
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/invalid-export-v1.json`,
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--min-valid-files=2',
  ];
  const { stdout, exitCode } = await runReview(args);
  expect(exitCode).toBe(1);
  expect(stdout).toContain('MANIFEST_PREDICTION_COUNT_MISMATCH');
  expect(stdout).toContain('MIN_VALID_FILES_NOT_MET');
});

it('BC: threshold checks do not call orchestrate', async () => {
  const deps: Parameters<typeof runMLBBacktestCLI>[2] = {
    orchestrate: async () => {
      throw new Error('orchestrate should not be called in review mode');
    },
  };
  const args = [
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--min-valid-files=1',
  ];
  const exitCode = await runMLBBacktestCLI(args, undefined, deps);
  expect(exitCode).toBe(0);
});

it('BD: output contains no modelProbability with thresholds', async () => {
  const args = [
    '--output=json',
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--review-export-json',
    `${REVIEW_DIR}/team-only-export-v1.json`,
    '--min-total-predictions=2',
  ];
  const { stdout } = await runReview(args);
  expect(stdout).not.toContain('modelProbability');
});

it('BE: output contains no odds/probability/betting concepts with thresholds', async () => {
  const args = [
    '--output=json',
    '--review-export-json',
    `${REVIEW_DIR}/full-export-v1.json`,
    '--review-export-json',
    `${REVIEW_DIR}/team-only-export-v1.json`,
    '--max-total-warnings=10',
  ];
  const { stdout } = await runReview(args);
  expect(stdout).not.toContain('odds');
  expect(stdout).not.toContain('sportsbook');
  expect(stdout).not.toContain('implied probability');
  expect(stdout).not.toContain('expected value');
  expect(stdout).not.toContain('EV');
  expect(stdout).not.toContain('ROI');
  expect(stdout).not.toContain('edge');
});

function fakeSummary(): HistoricalResearchExportReviewSummary {
  return {
    exportId: 'test-export-id',
    exportVersion: 'historical-research-export-v1',
    generatedAt: '2024-06-01T00:00:00.000Z',
    source: 'fixture',
    researchConstruction: 'FULL',
    dateRange: { startDate: '2024-06-01', endDate: '2024-06-03' },
    requestedDateCount: 3,
    resultCounts: { predictions: 1, abstentions: 0, warnings: 1 },
    comparisonIncluded: false,
    evidenceDomainSummary: { included: [], excluded: [] },
    warningSummary: [],
  };
}
