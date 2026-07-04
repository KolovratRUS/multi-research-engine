import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  buildHistoricalResearchExport,
  HISTORICAL_RESEARCH_EXPORT_VERSION,
  type HistoricalResearchExport,
  type ExportedResearchResult,
} from '@/lib/backtesting/historical-research-export';
import type {
  BacktestPrediction,
  ResearchConstructionReport,
} from '@/lib/backtesting/types';
import type { HistoricalBacktestOrchestrationResult } from '@/lib/backtesting/orchestrator';

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'historical-research-export');

function buildMockPrediction(overrides: Partial<BacktestPrediction> = {}): BacktestPrediction {
  return {
    eventId: `event-${overrides.gamePk ?? 1}`,
    gamePk: overrides.gamePk ?? 1,
    eventDate: '2024-06-01',
    homeTeamId: overrides.homeTeamId ?? 1,
    awayTeamId: overrides.awayTeamId ?? 2,
    homeTeam: 'Home',
    awayTeam: 'Away',
    predictedSide: overrides.predictedSide ?? null,
    researchStrengthScore: overrides.researchStrengthScore ?? 50,
    confidence: overrides.confidence ?? 60,
    dataQuality: overrides.dataQuality ?? 70,
    volatility: overrides.volatility ?? 'LOW',
    componentScores: overrides.componentScores ?? {},
    warnings: overrides.warnings ?? [],
    modelVersion: overrides.modelVersion ?? 'full-v1',
    featureVersion: overrides.featureVersion ?? 'feature-v1',
    generatedAt: new Date('2024-06-01T00:00:00Z'),
    historicalCutoffTime: new Date('2024-06-01T00:00:00Z'),
    actualWinner: overrides.actualWinner ?? 'HOME',
    correct: overrides.correct ?? null,
    voided: overrides.voided ?? false,
    abstained: overrides.abstained ?? false,
    abstentionReason: overrides.abstentionReason,
    homePitcherAvailable: overrides.homePitcherAvailable ?? true,
    awayPitcherAvailable: overrides.awayPitcherAvailable ?? true,
    researchConstructionMode: overrides.researchConstructionMode ?? 'FULL',
    researchModelVersion: overrides.researchModelVersion ?? 'full-v1',
    includedEvidenceDomains: overrides.includedEvidenceDomains ?? [],
    excludedEvidenceDomains: overrides.excludedEvidenceDomains ?? [],
  };
}

function buildMockOrchestrationResult(
  predictions: BacktestPrediction[] = [],
  abstentions: BacktestPrediction[] = [],
): HistoricalBacktestOrchestrationResult {
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
        predictionsMade: predictions.filter(p => !p.voided && !p.abstained).length,
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

function buildMockComparison(): ResearchConstructionReport {
  return {
    totalGames: 2,
    generatedAtSource: '2024-06-01T00:00:00.000Z',
    full: { attempts: 2, produced: 1, abstained: 1 },
    teamOnly: { attempts: 2, produced: 1, abstained: 1 },
    paired: {
      bothProduced: 1,
      fullOnlyProduced: 0,
      teamOnlyOnlyProduced: 0,
      bothAbstained: 1,
      sameSide: 1,
      differentSide: 0,
    },
    scoreComparison: {
      full: { averageResearchStrengthScore: 55, averageConfidence: 65, averageDataQuality: 75 },
      teamOnly: { averageResearchStrengthScore: 45, averageConfidence: 55, averageDataQuality: 65 },
    },
    volatilityCounts: {
      full: { LOW: 1, MEDIUM: 0, HIGH: 0 },
      teamOnly: { LOW: 1, MEDIUM: 0, HIGH: 0 },
    },
    warningCounts: { total: 1, full: 0, teamOnly: 1 },
  };
}

describe('buildHistoricalResearchExport', () => {
  it('A: exportVersion is stable', () => {
    const result = buildHistoricalResearchExport({
      orchestrationResult: buildMockOrchestrationResult(),
      researchConstruction: 'FULL',
      source: 'fixture',
      generatedAt: new Date('2024-06-01T00:00:00Z'),
    });
    expect(result.exportVersion).toBe(HISTORICAL_RESEARCH_EXPORT_VERSION);
  });

  it('B: generatedAt uses caller-provided timestamp', () => {
    const timestamp = new Date('2024-05-15T12:30:00Z');
    const result = buildHistoricalResearchExport({
      orchestrationResult: buildMockOrchestrationResult(),
      researchConstruction: 'FULL',
      source: 'fixture',
      generatedAt: timestamp,
    });
    expect(result.generatedAt).toBe('2024-05-15T12:30:00.000Z');
  });

  it('C: predictions and abstentions serialize expected fields', () => {
    const predictions = [
      buildMockPrediction({
        gamePk: 1,
        warnings: ['p-warn'],
        includedEvidenceDomains: ['team-offense'],
        excludedEvidenceDomains: ['starting-pitcher'],
      }),
    ];
    const abstentions = [
      buildMockPrediction({ gamePk: 2, abstained: true, warnings: ['a-warn'] }),
    ];
    const result = buildHistoricalResearchExport({
      orchestrationResult: buildMockOrchestrationResult(predictions, abstentions),
      researchConstruction: 'FULL',
      source: 'fixture',
      generatedAt: new Date('2024-06-01T00:00:00Z'),
    });
    expect(result.predictions).toHaveLength(1);
    expect(result.abstentions).toHaveLength(1);
    const p = result.predictions[0] as ExportedResearchResult;
    expect(p.eventId).toBe('event-1');
    expect(p.gamePk).toBe(1);
    expect(p.eventDate).toBe('2024-06-01');
    expect(p.generatedAt).toBe('2024-06-01T00:00:00.000Z');
    expect(p.historicalCutoffTime).toBe('2024-06-01T00:00:00.000Z');
    expect(p.includedEvidenceDomains).toEqual(['team-offense']);
    expect(p.excludedEvidenceDomains).toEqual(['starting-pitcher']);
    expect(p.warnings).toEqual(['p-warn']);
    const a = result.abstentions[0] as ExportedResearchResult;
    expect(a.abstained).toBe(true);
    expect(a.warnings).toEqual(['a-warn']);
  });

  it('D: BOTH mode includes comparison report', () => {
    const comparison = buildMockComparison();
    const result = buildHistoricalResearchExport({
      orchestrationResult: buildMockOrchestrationResult(),
      researchConstruction: 'BOTH',
      source: 'fixture',
      generatedAt: new Date('2024-06-01T00:00:00Z'),
      comparison,
    });
    expect(result.comparison).toBe(comparison);
  });

  it('E: FULL-only mode omits comparison', () => {
    const result = buildHistoricalResearchExport({
      orchestrationResult: buildMockOrchestrationResult(),
      researchConstruction: 'FULL',
      source: 'fixture',
      generatedAt: new Date('2024-06-01T00:00:00Z'),
      comparison: buildMockComparison(),
    });
    expect(result.comparison).toBeUndefined();
  });

  it('F: TEAM_ONLY-only mode omits comparison', () => {
    const result = buildHistoricalResearchExport({
      orchestrationResult: buildMockOrchestrationResult(),
      researchConstruction: 'TEAM_ONLY',
      source: 'fixture',
      generatedAt: new Date('2024-06-01T00:00:00Z'),
      comparison: buildMockComparison(),
    });
    expect(result.comparison).toBeUndefined();
  });

  it('G: warnings and evidence domains are preserved', () => {
    const predictions = [
      buildMockPrediction({
        gamePk: 1,
        warnings: ['w1'],
        includedEvidenceDomains: ['domain-a'],
        excludedEvidenceDomains: ['domain-b'],
      }),
    ];
    const abs = [
      buildMockPrediction({ gamePk: 2, abstained: true, warnings: ['w2', 'w3'] }),
    ];
    const result = buildHistoricalResearchExport({
      orchestrationResult: buildMockOrchestrationResult(predictions, abs),
      researchConstruction: 'TEAM_ONLY',
      source: 'fixture',
      generatedAt: new Date('2024-06-01T00:00:00Z'),
    });
    expect(result.predictions[0] as ExportedResearchResult).toMatchObject({
      warnings: ['w1'],
      includedEvidenceDomains: ['domain-a'],
      excludedEvidenceDomains: ['domain-b'],
    });
    expect(result.abstentions[0] as ExportedResearchResult).toMatchObject({
      warnings: ['w2', 'w3'],
    });
  });

  it('H: no forbidden odds/probability fields appear in exported object', () => {
    const result = buildHistoricalResearchExport({
      orchestrationResult: buildMockOrchestrationResult(),
      researchConstruction: 'FULL',
      source: 'fixture',
      generatedAt: new Date('2024-06-01T00:00:00Z'),
    });
    const keys = Object.keys(result);
    const forbidden = ['modelProbability', 'impliedProbability', 'calibratedProbability'];
    for (const field of forbidden) {
      expect(result).not.toHaveProperty(field);
    }
    const exportedKeys = JSON.stringify(result);
    expect(exportedKeys).not.toMatch(/modelProbability|impliedProbability|calibratedProbability/);
  });

  it('I: object is JSON.stringify-safe', () => {
    const result = buildHistoricalResearchExport({
      orchestrationResult: buildMockOrchestrationResult(),
      researchConstruction: 'FULL',
      source: 'fixture',
      generatedAt: new Date('2024-06-01T00:00:00Z'),
    });
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    expect(parsed.exportVersion).toBe(HISTORICAL_RESEARCH_EXPORT_VERSION);
    expect(parsed.predictions).toEqual([]);
    expect(parsed.abstentions).toEqual([]);
  });
});

describe('historical research export golden files', () => {
  const generatedAt = new Date('2024-06-01T00:00:00Z');

  function buildPrediction(overrides: Partial<BacktestPrediction> = {}): BacktestPrediction {
    return buildMockPrediction(overrides);
  }

  function buildOrchestrationResult(
    predictions: BacktestPrediction[] = [],
    abstentions: BacktestPrediction[] = [],
  ): HistoricalBacktestOrchestrationResult {
    return buildMockOrchestrationResult(predictions, abstentions);
  }

  function buildComparison(): ResearchConstructionReport {
    return buildMockComparison();
  }

  it('matches full-export-v1.json golden file', async () => {
    const result = buildHistoricalResearchExport({
      orchestrationResult: buildOrchestrationResult([
        buildPrediction({
          gamePk: 1,
          warnings: ['full-warn'],
          includedEvidenceDomains: ['team-offense'],
          excludedEvidenceDomains: ['starting-pitcher'],
        }),
      ]),
      researchConstruction: 'FULL',
      source: 'fixture',
      generatedAt,
    });
    const expected = await fs.readFile(path.join(FIXTURE_DIR, 'full-export-v1.json'), 'utf-8');
    expect(JSON.stringify(result, null, 2) + '\n').toBe(expected);
    expect(JSON.parse(expected)).toBeDefined();
  });

  it('matches team-only-export-v1.json golden file', async () => {
    const result = buildHistoricalResearchExport({
      orchestrationResult: buildOrchestrationResult([
        buildPrediction({
          gamePk: 2,
          researchConstructionMode: 'TEAM_ONLY',
          researchModelVersion: 'team-only-v1',
          predictedSide: 'AWAY',
          warnings: ['team-warn'],
        }),
      ]),
      researchConstruction: 'TEAM_ONLY',
      source: 'fixture',
      generatedAt,
    });
    const expected = await fs.readFile(path.join(FIXTURE_DIR, 'team-only-export-v1.json'), 'utf-8');
    expect(JSON.stringify(result, null, 2) + '\n').toBe(expected);
    expect(JSON.parse(expected)).toBeDefined();
  });

  it('matches both-export-v1.json golden file', async () => {
    const result = buildHistoricalResearchExport({
      orchestrationResult: buildOrchestrationResult([
        buildPrediction({ gamePk: 1 }),
        buildPrediction({ gamePk: 2, researchConstructionMode: 'TEAM_ONLY', researchModelVersion: 'team-only-v1' }),
      ]),
      researchConstruction: 'BOTH',
      source: 'fixture',
      generatedAt,
      comparison: buildComparison(),
    });
    const expected = await fs.readFile(path.join(FIXTURE_DIR, 'both-export-v1.json'), 'utf-8');
    expect(JSON.stringify(result, null, 2) + '\n').toBe(expected);
    expect((result as HistoricalResearchExport).comparison).toBeDefined();
    expect((result as HistoricalResearchExport).comparison).toEqual(buildComparison());
    expect(JSON.parse(expected)).toBeDefined();
  });

  it('matches abstention-export-v1.json golden file', async () => {
    const result = buildHistoricalResearchExport({
      orchestrationResult: buildOrchestrationResult([], [
        buildPrediction({
          gamePk: 3,
          abstained: true,
          abstentionReason: 'QUALITY_BELOW_THRESHOLD',
          warnings: ['abs-warn-1', 'abs-warn-2'],
          researchConstructionMode: 'TEAM_ONLY',
          researchModelVersion: 'team-only-v1',
        }),
      ]),
      researchConstruction: 'TEAM_ONLY',
      source: 'fixture',
      generatedAt,
    });
    const expected = await fs.readFile(path.join(FIXTURE_DIR, 'abstention-export-v1.json'), 'utf-8');
    expect(JSON.stringify(result, null, 2) + '\n').toBe(expected);
    expect(JSON.parse(expected)).toBeDefined();
  });

  it('does not allow forbidden odds/probability concepts in golden text', async () => {
    for (const name of ['full-export-v1.json', 'team-only-export-v1.json', 'both-export-v1.json', 'abstention-export-v1.json']) {
      const content = await fs.readFile(path.join(FIXTURE_DIR, name), 'utf-8');
      expect(content).not.toMatch(/modelProbability|impliedProbability|calibratedProbability|odds|sportsbook|expected value|EV:|ROI|edge|favorite|underdog|line movement|public betting|market movement|betting value/i);
    }
  });

  it('does not introduce modelProbability field in generated export', () => {
    const result = buildHistoricalResearchExport({
      orchestrationResult: buildOrchestrationResult(),
      researchConstruction: 'FULL',
      source: 'fixture',
      generatedAt,
    });
    const keys = Object.keys(result);
    for (const forbidden of ['modelProbability', 'impliedProbability', 'calibratedProbability']) {
      expect(keys).not.toContain(forbidden);
    }
    expect(JSON.stringify(result)).not.toMatch(/modelProbability|impliedProbability|calibratedProbability/);
  });
});
