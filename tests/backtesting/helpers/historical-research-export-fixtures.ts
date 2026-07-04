import type {
  BacktestPrediction,
  ResearchConstructionReport,
} from '@/lib/backtesting/types';
import type { HistoricalBacktestOrchestrationResult } from '@/lib/backtesting/orchestrator';
import type { BacktestMetrics } from '@/lib/backtesting/types';

const EMPTY_METRICS: BacktestMetrics = {
  predictionsMade: 0,
  gamesSkipped: 0,
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
};

export const FIXTURE_GENERATED_AT = new Date('2024-06-01T00:00:00Z');

export function buildFixturePrediction(
  overrides: Partial<BacktestPrediction> = {},
): BacktestPrediction {
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
    generatedAt: overrides.generatedAt ?? FIXTURE_GENERATED_AT,
    historicalCutoffTime: overrides.historicalCutoffTime ?? FIXTURE_GENERATED_AT,
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

export function buildFixtureOrchestrationResult(
  predictions: BacktestPrediction[] = [],
  abstentions: BacktestPrediction[] = [],
): HistoricalBacktestOrchestrationResult {
  const predictionsMade = predictions.filter((p) => !p.voided && !p.abstained).length;
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
        ...EMPTY_METRICS,
        predictionsMade,
        gamesSkipped: abstentions.length,
      },
    },
  };
}

export function buildFixtureComparison(): ResearchConstructionReport {
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
