import { describe, it, expect, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  runMLBBacktestCLI,
  type MLBBacktestCLIDependencies,
} from '@/lib/backtesting/cli';

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'historical-research-export');

const mockStdout: string[] = [];
const mockStderr: string[] = [];

function createIO() {
  return {
    stdout: (message: string) => mockStdout.push(message),
    stderr: (message: string) => mockStderr.push(message),
  };
}

function resetIO() {
  mockStdout.length = 0;
  mockStderr.length = 0;
}

async function runReview(args: string[], deps: MLBBacktestCLIDependencies = {}) {
  resetIO();
  const io = createIO();
  const code = await runMLBBacktestCLI(args, io, deps);
  return { code, stdout: mockStdout.join('\n'), stderr: mockStderr.join('\n') };
}

describe('cli review export', () => {
  it('A: reviews full-export-v1.json and exits 0 with deterministic summary', async () => {
    const exportPath = path.join(FIXTURE_DIR, 'full-export-v1.json');
    const { code, stdout, stderr } = await runReview(['--review-export-json', exportPath]);
    expect(code).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toBe([
      'Historical Research Export Review',
      'Manifest Valid: yes',
      'Export ID: historical-research-export-v1:d4cf35f0817d',
      'Export Version: historical-research-export-v1',
      'Generated At: 2024-06-01T00:00:00.000Z',
      'Source: fixture',
      'Research Construction: FULL',
      'Date Range: 2024-06-01 to 2024-06-03',
      'Requested Dates: 3',
      'Predictions: 1',
      'Abstentions: 0',
      'Warnings: 1',
      'Comparison Included: no',
      'Included Evidence Domains: team-offense',
      'Excluded Evidence Domains: starting-pitcher',
      'Warning Summary: full-warn',
    ].join('\n'));
  });

  it('B: reviews team-only-export-v1.json and exits 0 with deterministic summary', async () => {
    const exportPath = path.join(FIXTURE_DIR, 'team-only-export-v1.json');
    const { code, stdout, stderr } = await runReview(['--review-export-json', exportPath]);
    expect(code).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toBe([
      'Historical Research Export Review',
      'Manifest Valid: yes',
      'Export ID: historical-research-export-v1:ea7ce4da7e2f',
      'Export Version: historical-research-export-v1',
      'Generated At: 2024-06-01T00:00:00.000Z',
      'Source: fixture',
      'Research Construction: TEAM_ONLY',
      'Date Range: 2024-06-01 to 2024-06-03',
      'Requested Dates: 3',
      'Predictions: 1',
      'Abstentions: 0',
      'Warnings: 1',
      'Comparison Included: no',
      'Included Evidence Domains: none',
      'Excluded Evidence Domains: none',
      'Warning Summary: team-warn',
    ].join('\n'));
  });

  it('C: reviews both-export-v1.json and prints comparison included yes', async () => {
    const exportPath = path.join(FIXTURE_DIR, 'both-export-v1.json');
    const { code, stdout, stderr } = await runReview(['--review-export-json', exportPath]);
    expect(code).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toContain('Comparison Included: yes');
    expect(stdout).toContain('Manifest Valid: yes');
    expect(stdout).toContain('Export ID: historical-research-export-v1:8479ad9ac604');
  });

  it('D: reviews abstention-export-v1.json and prints abstention/warning counts', async () => {
    const exportPath = path.join(FIXTURE_DIR, 'abstention-export-v1.json');
    const { code, stdout, stderr } = await runReview(['--review-export-json', exportPath]);
    expect(code).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toContain('Predictions: 0');
    expect(stdout).toContain('Abstentions: 1');
    expect(stdout).toContain('Warnings: 2');
    expect(stdout).toContain('Warning Summary: abs-warn-1, abs-warn-2');
  });

  it('E: review mode validates manifest and prints Manifest Valid: yes', async () => {
    const exportPath = path.join(FIXTURE_DIR, 'full-export-v1.json');
    const { code, stdout } = await runReview(['--review-export-json', exportPath]);
    expect(code).toBe(0);
    expect(stdout).toContain('Manifest Valid: yes');
  });

  it('F: review mode does not call orchestrate', async () => {
    const exportPath = path.join(FIXTURE_DIR, 'full-export-v1.json');
    const mockOrchestrate = vi.fn();
    const { code } = await runReview(['--review-export-json', exportPath], {
      orchestrate: mockOrchestrate,
    });
    expect(code).toBe(0);
    expect(mockOrchestrate).not.toHaveBeenCalled();
  });

  it('G: duplicate --review-export-json rejected', async () => {
    const exportPath = path.join(FIXTURE_DIR, 'full-export-v1.json');
    const { code, stderr } = await runReview([
      '--review-export-json',
      exportPath,
      '--review-export-json',
      exportPath,
    ]);
    expect(code).toBe(1);
    expect(stderr).toBe('Duplicate option: --review-export-json');
  });

  it('H: missing --review-export-json value rejected', async () => {
    const { code, stderr } = await runReview(['--review-export-json']);
    expect(code).toBe(1);
    expect(stderr).toContain('--review-export-json requires a value');
  });

  it('I: empty --review-export-json path rejected', async () => {
    const { code, stderr } = await runReview(['--review-export-json', '']);
    expect(code).toBe(1);
    expect(stderr).toContain('Invalid --review-export-json. Expected a non-empty path.');
  });

  it('J: missing file exits non-zero with clear error', async () => {
    const { code, stderr } = await runReview(['--review-export-json', '/tmp/missing-phase1n-export.json']);
    expect(code).toBe(1);
    expect(stderr).toContain('Export file not found');
  });

  it('K: invalid JSON exits non-zero with clear error', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-review-bad-json-'));
    const badPath = path.join(tempDir, 'bad.json');
    await fs.writeFile(badPath, 'not-json', 'utf-8');
    try {
      const { code, stderr } = await runReview(['--review-export-json', badPath]);
      expect(code).toBe(1);
      expect(stderr).toContain('Invalid JSON in export file');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('L: manifest validation failure exits non-zero and prints issue code/path/message', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-review-bad-manifest-'));
    const badPath = path.join(tempDir, 'bad-manifest.json');
    await fs.writeFile(
      badPath,
      JSON.stringify({
        exportVersion: 'historical-research-export-v1',
        manifest: {
          exportId: 'bad',
          exportVersion: 'historical-research-export-v1',
          generatedAt: '2024-06-01T00:00:00.000Z',
          source: 'fixture',
          researchConstruction: 'FULL',
          dateRange: { startDate: '2024-06-01', endDate: '2024-06-03' },
          requestedDateCount: 3,
          resultCounts: { predictions: 999, abstentions: 0, warnings: 0 },
          comparisonIncluded: false,
          evidenceDomainSummary: { included: [], excluded: [] },
          warningSummary: [],
        },
        generatedAt: '2024-06-01T00:00:00.000Z',
        source: 'fixture',
        dateRange: { startDate: '2024-06-01', endDate: '2024-06-03' },
        requestedDates: ['2024-06-01', '2024-06-02', '2024-06-03'],
        researchConstruction: 'FULL',
        predictions: [],
        abstentions: [],
      }),
      'utf-8',
    );
    try {
      const { code, stderr } = await runReview(['--review-export-json', badPath]);
      expect(code).toBe(1);
      expect(stderr).toContain('MANIFEST_PREDICTION_COUNT_MISMATCH');
      expect(stderr).toContain('manifest.resultCounts.predictions');
      expect(stderr).toContain('prediction count mismatch between manifest and export');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('M: review combined with --export-json rejected', async () => {
    const exportPath = path.join(FIXTURE_DIR, 'full-export-v1.json');
    const { code, stderr } = await runReview([
      '--review-export-json',
      exportPath,
      '--export-json',
      '/tmp/export.json',
    ]);
    expect(code).toBe(1);
    expect(stderr).toBe('Cannot combine --review-export-json with --export-json.');
  });

  it('N: review mode does not create parent directories or write files', async () => {
    const missingDir = path.join(os.tmpdir(), 'mlb-review-missing-parent-phase1n', 'nested');
    const reviewPath = path.join(missingDir, 'export.json');
    const { code } = await runReview(['--review-export-json', reviewPath]);
    expect(code).toBe(1);
    expect(fs.stat(missingDir).then(() => true, () => false)).resolves.toBe(false);
  });

  it('O: review mode does not require --date', async () => {
    const exportPath = path.join(FIXTURE_DIR, 'full-export-v1.json');
    const { code } = await runReview(['--review-export-json', exportPath]);
    expect(code).toBe(0);
  });

  it('P: review mode does not run source=live or construct live provider', async () => {
    const createLiveProvider = vi.fn();
    const exportPath = path.join(FIXTURE_DIR, 'full-export-v1.json');
    const { code } = await runReview(['--review-export-json', exportPath], {
      createLiveProvider,
    });
    expect(code).toBe(0);
    expect(createLiveProvider).not.toHaveBeenCalled();
  });

  it('Q: stdout formatting is stable', async () => {
    const exportPath = path.join(FIXTURE_DIR, 'full-export-v1.json');
    const { code, stdout } = await runReview(['--review-export-json', exportPath]);
    expect(code).toBe(0);
    const lines = stdout.split('\n');
    expect(lines[0]).toBe('Historical Research Export Review');
    expect(lines[1]).toBe('Manifest Valid: yes');
    expect(lines[2]).toMatch(/^Export ID: /);
    expect(lines[lines.length - 1]).toMatch(/^Warning Summary: /);
  });

  it('R: stderr formatting is stable on errors', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-review-error-format-'));
    const badPath = path.join(tempDir, 'bad.json');
    await fs.writeFile(
      badPath,
      JSON.stringify({
        exportVersion: 'historical-research-export-v1',
        manifest: {
          exportId: 'bad',
          exportVersion: 'historical-research-export-v1',
          generatedAt: '2024-06-01T00:00:00.000Z',
          source: 'fixture',
          researchConstruction: 'FULL',
          dateRange: { startDate: '2024-06-01', endDate: '2024-06-03' },
          requestedDateCount: 3,
          resultCounts: { predictions: 1, abstentions: 0, warnings: 0 },
          comparisonIncluded: false,
          evidenceDomainSummary: { included: [], excluded: [] },
          warningSummary: [],
        },
        generatedAt: '2024-06-01T00:00:00.000Z',
        source: 'fixture',
        dateRange: { startDate: '2024-06-01', endDate: '2024-06-03' },
        requestedDates: ['2024-06-01', '2024-06-02', '2024-06-03'],
        researchConstruction: 'FULL',
        predictions: [],
        abstentions: [],
      }),
      'utf-8',
    );
    try {
      const { code, stderr } = await runReview(['--review-export-json', badPath]);
      expect(code).toBe(1);
      const lines = stderr.split('\n');
      expect(lines[0]).toBe('Historical Research Export Review Failed');
      expect(lines.some((line) => line.startsWith('- MANIFEST_'))).toBe(true);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('S: forbidden concepts absent from review output', async () => {
    const exportPath = path.join(FIXTURE_DIR, 'full-export-v1.json');
    const { code, stdout, stderr } = await runReview(['--review-export-json', exportPath]);
    expect(code).toBe(0);
    const combined = `${stdout}\n${stderr}`;
    expect(combined).not.toMatch(/\bodds\b|\bsportsbook\b|\bimplied probability\b|\bexpected value\b|\bEV\b|\bROI\b|\bedge\b|\bfavorite\b|\budnerdog\b|\bline movement\b|\bpublic betting\b|\bmarket movement\b|\bbetting value\b/i);
  });

  it('T: modelProbability absent from review output', async () => {
    const exportPath = path.join(FIXTURE_DIR, 'full-export-v1.json');
    const { code, stdout, stderr } = await runReview(['--review-export-json', exportPath]);
    expect(code).toBe(0);
    const combined = `${stdout}\n${stderr}`;
    expect(combined).not.toMatch(/modelProbability/i);
  });
});
