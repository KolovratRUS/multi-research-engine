import { describe, it, expect, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  runMLBBacktestCLI,
  type MLBBacktestCLIDependencies,
} from '@/lib/backtesting/cli';
import type { BacktestPrediction } from '@/lib/backtesting/types';

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

function buildCLIPrediction(overrides: Partial<BacktestPrediction> = {}): BacktestPrediction {
  return {
    eventId: `event-${overrides.gamePk ?? 1}`,
    gamePk: overrides.gamePk ?? 1,
    eventDate: '2024-06-01',
    homeTeamId: 1,
    awayTeamId: 2,
    homeTeam: 'Home',
    awayTeam: 'Away',
    predictedSide: overrides.predictedSide ?? null,
    researchStrengthScore: overrides.researchStrengthScore ?? 50,
    confidence: overrides.confidence ?? 60,
    dataQuality: overrides.dataQuality ?? 70,
    volatility: overrides.volatility ?? 'LOW',
    componentScores: overrides.componentScores ?? {},
    warnings: overrides.warnings ?? [],
    modelVersion: 'full-v1',
    featureVersion: 'feature-v1',
    generatedAt: new Date('2024-06-01T00:00:00Z'),
    historicalCutoffTime: new Date('2024-06-01T00:00:00Z'),
    actualWinner: 'HOME',
    correct: null,
    voided: false,
    abstained: overrides.abstained ?? false,
    abstentionReason: overrides.abstentionReason,
    homePitcherAvailable: true,
    awayPitcherAvailable: true,
    researchConstructionMode: overrides.researchConstructionMode ?? 'FULL',
    researchModelVersion: overrides.researchModelVersion ?? 'full-v1',
    includedEvidenceDomains: overrides.includedEvidenceDomains ?? [],
    excludedEvidenceDomains: overrides.excludedEvidenceDomains ?? [],
  };
}

function buildCLIOrchestrationResult(
  predictions: BacktestPrediction[] = [],
  abstentions: BacktestPrediction[] = [],
) {
  return {
    dateRange: { startDate: '2024-06-01', endDate: '2024-06-03' },
    requestedDates: ['2024-06-01', '2024-06-02', '2024-06-03'],
    scheduleRequests: 3,
    discoveredGames: 2,
    uniqueGames: 2,
    duplicateGamesRemoved: 0,
    firstGameStart: new Date('2024-06-01T16:20:00Z'),
    lastGameStart: new Date('2024-06-03T19:05:00Z'),
    games: [],
    runnerResult: {
      predictions,
      abstentions,
      metrics: {
        predictionsMade: predictions.filter((p) => !p.voided && !p.abstained).length,
        gamesSkipped: abstentions.length,
        voids: 0,
        accuracy: 0,
        homePickRate: 0,
        awayPickRate: 0,
        accuracyByConfidenceBucket: {},
        accuracyByDataQualityBucket: {},
        accuracyByVolatilityBucket: {},
        accuracyWithBothPitchersKnown: null,
        accuracyWithMissingPitcher: null,
        accuracyByMonth: {},
        naiveHomeBaseline: null,
        naiveRecentBaseline: null,
        naiveSeasonBaseline: null,
      },
    },
  };
}

const deterministicNow = () => new Date('2024-06-01T00:00:00Z');

async function runExportScenario(args: string[], fixtureName: string) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-export-golden-'));
  const exportPath = path.join(tempDir, 'export.json');
  const cliArgs = args.map((arg) => (arg === '__EXPORT_PATH__' ? exportPath : arg));

  const fixture = JSON.parse(await fs.readFile(path.join(FIXTURE_DIR, fixtureName), 'utf-8')) as {
    predictions: Array<Partial<BacktestPrediction>>;
    abstentions: Array<Partial<BacktestPrediction>>;
    comparison?: unknown;
  };

  const predictions = fixture.predictions.map((p) => buildCLIPrediction(p));
  const abstentions = fixture.abstentions.map((p) => buildCLIPrediction(p));

  if (fixture.comparison) {
    const { computeResearchConstructionReport } = await import('@/lib/backtesting/metrics');
    (computeResearchConstructionReport as ReturnType<typeof vi.fn>).mockReturnValue(fixture.comparison);
  }

  try {
    resetIO();
    const mockOrchestrate = vi.fn().mockResolvedValue(
      buildCLIOrchestrationResult(predictions, abstentions),
    );
    const deps: MLBBacktestCLIDependencies = {
      orchestrate: mockOrchestrate,
      now: deterministicNow,
    };
    const io = createIO();
    const code = await runMLBBacktestCLI(cliArgs, io, deps);
    const content = await fs.readFile(exportPath, 'utf-8');
    const expected = await fs.readFile(path.join(FIXTURE_DIR, fixtureName), 'utf-8');
    expect(code).toBe(0);
    expect(content).toBe(expected);
    expect(JSON.parse(content)).toBeDefined();
    expect(JSON.parse(expected)).toBeDefined();
    expect(mockStdout.length).toBeGreaterThan(0);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

describe('cli export golden smoke', () => {
  vi.mock('@/lib/backtesting/metrics', () => ({
    computeResearchConstructionReport: vi.fn(),
  }));

  it('writes full-export-v1.json for FULL mode', async () => {
    await runExportScenario(
      ['--date', '2024-06-01', '--research-construction', 'full', '--export-json', '__EXPORT_PATH__'],
      'full-export-v1.json',
    );
  });

  it('writes team-only-export-v1.json for TEAM_ONLY mode', async () => {
    await runExportScenario(
      ['--date', '2024-06-01', '--research-construction', 'team-only', '--export-json', '__EXPORT_PATH__'],
      'team-only-export-v1.json',
    );
  });

  it('writes both-export-v1.json for BOTH mode', async () => {
    const { computeResearchConstructionReport } = await import('@/lib/backtesting/metrics');
    const fixture = JSON.parse(await fs.readFile(path.join(FIXTURE_DIR, 'both-export-v1.json'), 'utf-8'));
    (computeResearchConstructionReport as ReturnType<typeof vi.fn>).mockReturnValue(fixture.comparison);
    await runExportScenario(
      ['--date', '2024-06-01', '--research-construction', 'both', '--export-json', '__EXPORT_PATH__'],
      'both-export-v1.json',
    );
  });

  it('writes abstention-export-v1.json for abstention-heavy export', async () => {
    await runExportScenario(
      ['--date', '2024-06-01', '--research-construction', 'team-only', '--export-json', '__EXPORT_PATH__'],
      'abstention-export-v1.json',
    );
  });
});
