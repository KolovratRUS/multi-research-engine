import { describe, it, expect } from 'vitest';
import { computeResearchConstructionReport } from '@/lib/backtesting/metrics';
import type { BacktestPrediction } from '@/lib/backtesting/types';

function buildPrediction(overrides: Partial<BacktestPrediction> = {}): BacktestPrediction {
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
    modelVersion: 'test',
    featureVersion: 'test',
    generatedAt: new Date('2024-06-01T00:00:00Z'),
    historicalCutoffTime: new Date('2024-06-01T00:00:00Z'),
    actualWinner: overrides.actualWinner ?? 'HOME',
    correct: overrides.correct ?? null,
    voided: overrides.voided ?? false,
    abstained: overrides.abstained ?? false,
    homePitcherAvailable: overrides.homePitcherAvailable ?? true,
    awayPitcherAvailable: overrides.awayPitcherAvailable ?? true,
    researchConstructionMode: overrides.researchConstructionMode ?? 'FULL',
    researchModelVersion: overrides.researchModelVersion ?? 'test',
    includedEvidenceDomains: overrides.includedEvidenceDomains ?? [],
    excludedEvidenceDomains: overrides.excludedEvidenceDomains ?? [],
  };
}

describe('computeResearchConstructionReport', () => {
  it('A: both produced increments bothProduced and sameSide', () => {
    const predictions = [
      buildPrediction({ gamePk: 1, researchConstructionMode: 'FULL', predictedSide: 'HOME', confidence: 80, researchStrengthScore: 60, dataQuality: 70, volatility: 'LOW' }),
      buildPrediction({ gamePk: 1, researchConstructionMode: 'TEAM_ONLY', predictedSide: 'HOME', confidence: 70, researchStrengthScore: 55, dataQuality: 60, volatility: 'MEDIUM' }),
    ];

    const result = computeResearchConstructionReport(predictions, []);

    expect(result.paired.bothProduced).toBe(1);
    expect(result.paired.sameSide).toBe(1);
    expect(result.paired.differentSide).toBe(0);
    expect(result.scoreComparison.full.averageConfidence).toBeCloseTo(80);
    expect(result.scoreComparison.teamOnly.averageConfidence).toBeCloseTo(70);
  });

  it('A: differentSide increments correctly', () => {
    const predictions = [
      buildPrediction({ gamePk: 1, researchConstructionMode: 'FULL', predictedSide: 'HOME' }),
      buildPrediction({ gamePk: 1, researchConstructionMode: 'TEAM_ONLY', predictedSide: 'AWAY' }),
    ];

    const result = computeResearchConstructionReport(predictions, []);

    expect(result.paired.sameSide).toBe(0);
    expect(result.paired.differentSide).toBe(1);
  });

  it('B: FULL abstains, TEAM_ONLY produces -> teamOnlyOnlyProduced', () => {
    const predictions = [
      buildPrediction({ gamePk: 1, researchConstructionMode: 'TEAM_ONLY', predictedSide: 'HOME' }),
    ];
    const abstentions = [
      buildPrediction({ gamePk: 1, researchConstructionMode: 'FULL', abstained: true }),
    ];

    const result = computeResearchConstructionReport(predictions, abstentions);

    expect(result.paired.teamOnlyOnlyProduced).toBe(1);
    expect(result.paired.fullOnlyProduced).toBe(0);
    expect(result.paired.bothProduced).toBe(0);
    expect(result.paired.bothAbstained).toBe(0);
  });

  it('C: FULL produces, TEAM_ONLY abstains -> fullOnlyProduced', () => {
    const predictions = [
      buildPrediction({ gamePk: 1, researchConstructionMode: 'FULL', predictedSide: 'HOME' }),
    ];
    const abstentions = [
      buildPrediction({ gamePk: 1, researchConstructionMode: 'TEAM_ONLY', abstained: true }),
    ];

    const result = computeResearchConstructionReport(predictions, abstentions);

    expect(result.paired.fullOnlyProduced).toBe(1);
    expect(result.paired.teamOnlyOnlyProduced).toBe(0);
    expect(result.paired.bothProduced).toBe(0);
    expect(result.paired.bothAbstained).toBe(0);
  });

  it('D: both abstain -> bothAbstained', () => {
    const abstentions = [
      buildPrediction({ gamePk: 1, researchConstructionMode: 'FULL', abstained: true }),
      buildPrediction({ gamePk: 1, researchConstructionMode: 'TEAM_ONLY', abstained: true }),
    ];

    const result = computeResearchConstructionReport([], abstentions);

    expect(result.paired.bothAbstained).toBe(1);
    expect(result.paired.bothProduced).toBe(0);
    expect(result.paired.fullOnlyProduced).toBe(0);
    expect(result.paired.teamOnlyOnlyProduced).toBe(0);
  });

  it('E: only FULL present -> handled deterministically', () => {
    const predictions = [
      buildPrediction({ gamePk: 1, researchConstructionMode: 'FULL', predictedSide: 'HOME' }),
    ];

    const result = computeResearchConstructionReport(predictions, []);

    expect(result.paired.fullOnlyProduced).toBe(1);
    expect(result.paired.teamOnlyOnlyProduced).toBe(0);
    expect(result.paired.bothProduced).toBe(0);
    expect(result.totalGames).toBe(1);
  });

  it('F: only TEAM_ONLY present -> handled deterministically', () => {
    const predictions = [
      buildPrediction({ gamePk: 1, researchConstructionMode: 'TEAM_ONLY', predictedSide: 'AWAY' }),
    ];

    const result = computeResearchConstructionReport(predictions, []);

    expect(result.paired.teamOnlyOnlyProduced).toBe(1);
    expect(result.paired.fullOnlyProduced).toBe(0);
    expect(result.paired.bothProduced).toBe(0);
    expect(result.totalGames).toBe(1);
  });

  it('G: duplicate game/construction pair throws clear error', () => {
    const predictions = [
      buildPrediction({ gamePk: 1, researchConstructionMode: 'FULL', predictedSide: 'HOME' }),
      buildPrediction({ gamePk: 1, researchConstructionMode: 'FULL', predictedSide: 'AWAY' }),
    ];

    expect(() => computeResearchConstructionReport(predictions, [])).toThrow(
      'Duplicate research constructions detected: 1:FULL',
    );
  });

  it('G: duplicate abstained pair throws clear error', () => {
    const abstentions = [
      buildPrediction({ gamePk: 2, researchConstructionMode: 'TEAM_ONLY', abstained: true }),
      buildPrediction({ gamePk: 2, researchConstructionMode: 'TEAM_ONLY', abstained: true }),
    ];

    expect(() => computeResearchConstructionReport([], abstentions)).toThrow(
      'Duplicate research constructions detected: 2:TEAM_ONLY',
    );
  });

  it('H: warning counts include TEAM_ONLY_RESEARCH and PITCHER_EVIDENCE_EXCLUDED', () => {
    const predictions = [
      buildPrediction({
        gamePk: 1,
        researchConstructionMode: 'TEAM_ONLY',
        predictedSide: 'HOME',
        warnings: ['TEAM_ONLY_RESEARCH', 'PITCHER_EVIDENCE_EXCLUDED'],
      }),
    ];
    const abstentions = [
      buildPrediction({
        gamePk: 1,
        researchConstructionMode: 'FULL',
        abstained: true,
        warnings: ['STARTING_PITCHERS_UNAVAILABLE'],
      }),
    ];

    const result = computeResearchConstructionReport(predictions, abstentions);

    expect(result.warningCounts.total).toBe(3);
    expect(result.warningCounts.full).toBe(1);
    expect(result.warningCounts.teamOnly).toBe(2);
  });

  it('H: warning counts sum abstentions', () => {
    const abstentions = [
      buildPrediction({ gamePk: 1, researchConstructionMode: 'FULL', abstained: true, warnings: ['STARTING_PITCHERS_UNAVAILABLE', 'STARTING_PITCHERS_UNAVAILABLE'] }),
    ];

    const result = computeResearchConstructionReport([], abstentions);

    expect(result.warningCounts.total).toBe(2);
    expect(result.warningCounts.full).toBe(2);
  });

  it('I: volatility counts FULL LOW/MEDIUM/HIGH', () => {
    const predictions = [
      buildPrediction({ gamePk: 1, researchConstructionMode: 'FULL', volatility: 'LOW' }),
      buildPrediction({ gamePk: 2, researchConstructionMode: 'FULL', volatility: 'MEDIUM' }),
      buildPrediction({ gamePk: 3, researchConstructionMode: 'FULL', volatility: 'HIGH' }),
    ];

    const result = computeResearchConstructionReport(predictions, []);

    expect(result.volatilityCounts.full.LOW).toBe(1);
    expect(result.volatilityCounts.full.MEDIUM).toBe(1);
    expect(result.volatilityCounts.full.HIGH).toBe(1);
    expect(result.volatilityCounts.teamOnly.LOW).toBe(0);
  });

  it('I: volatility counts TEAM_ONLY separately', () => {
    const predictions = [
      buildPrediction({ gamePk: 1, researchConstructionMode: 'TEAM_ONLY', volatility: 'MEDIUM' }),
      buildPrediction({ gamePk: 2, researchConstructionMode: 'TEAM_ONLY', volatility: 'MEDIUM' }),
    ];

    const result = computeResearchConstructionReport(predictions, []);

    expect(result.volatilityCounts.teamOnly.MEDIUM).toBe(2);
    expect(result.volatilityCounts.full.MEDIUM).toBe(0);
  });

  it('throws for prediction and abstention duplicate on same gamePk+mode', () => {
    const predictions = [
      buildPrediction({ gamePk: 1, researchConstructionMode: 'FULL', predictedSide: 'HOME' }),
    ];
    const abstentions = [
      buildPrediction({ gamePk: 1, researchConstructionMode: 'FULL', abstained: true }),
    ];

    expect(() => computeResearchConstructionReport(predictions, abstentions)).toThrow(
      'Duplicate research constructions detected: 1:FULL',
    );
  });
});
