import type {
  BacktestPrediction,
  ResearchConstructionReport,
} from './types';
import type { HistoricalBacktestOrchestrationResult } from './orchestrator';

export const HISTORICAL_RESEARCH_EXPORT_VERSION = 'historical-research-export-v1';

export interface ExportedResearchResult {
  readonly eventId: string;
  readonly gamePk: number;
  readonly eventDate: string;
  readonly homeTeamId: number;
  readonly awayTeamId: number;
  readonly homeTeam: string;
  readonly awayTeam: string;
  readonly predictedSide: 'HOME' | 'AWAY' | null;
  readonly researchStrengthScore: number;
  readonly confidence: number;
  readonly dataQuality: number;
  readonly volatility: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly componentScores: Record<string, number>;
  readonly warnings: readonly string[];
  readonly modelVersion: string;
  readonly featureVersion: string;
  readonly generatedAt: string;
  readonly historicalCutoffTime: string;
  readonly actualWinner: 'HOME' | 'AWAY' | 'TIE' | null;
  readonly correct: boolean | null;
  readonly voided: boolean;
  readonly abstained: boolean;
  readonly abstentionReason?: string;
  readonly homePitcherAvailable: boolean;
  readonly awayPitcherAvailable: boolean;
  readonly researchConstructionMode: 'FULL' | 'TEAM_ONLY';
  readonly researchModelVersion: string;
  readonly includedEvidenceDomains: readonly string[];
  readonly excludedEvidenceDomains: readonly string[];
}

export interface HistoricalResearchExport {
  readonly exportVersion: typeof HISTORICAL_RESEARCH_EXPORT_VERSION;
  readonly generatedAt: string;
  readonly source: 'fixture' | 'live';
  readonly dateRange: {
    readonly startDate: string;
    readonly endDate: string;
  };
  readonly requestedDates: readonly string[];
  readonly researchConstruction: 'FULL' | 'TEAM_ONLY' | 'BOTH';
  readonly runSummary: {
    readonly scheduleRequests: number;
    readonly discoveredGames: number;
    readonly uniqueGames: number;
    readonly duplicateGamesRemoved: number;
    readonly predictionsMade: number;
    readonly abstentions: number;
    readonly warningCount: number;
  };
  readonly comparison?: ResearchConstructionReport;
  readonly predictions: readonly ExportedResearchResult[];
  readonly abstentions: readonly ExportedResearchResult[];
}

function serializePrediction(prediction: BacktestPrediction): ExportedResearchResult {
  const result: ExportedResearchResult = {
    eventId: prediction.eventId,
    gamePk: prediction.gamePk,
    eventDate: prediction.eventDate,
    homeTeamId: prediction.homeTeamId,
    awayTeamId: prediction.awayTeamId,
    homeTeam: prediction.homeTeam,
    awayTeam: prediction.awayTeam,
    predictedSide: prediction.predictedSide,
    researchStrengthScore: prediction.researchStrengthScore,
    confidence: prediction.confidence,
    dataQuality: prediction.dataQuality,
    volatility: prediction.volatility,
    componentScores: Object.freeze({ ...prediction.componentScores }),
    warnings: Object.freeze([...prediction.warnings]),
    modelVersion: prediction.modelVersion,
    featureVersion: prediction.featureVersion,
    generatedAt: prediction.generatedAt.toISOString(),
    historicalCutoffTime: prediction.historicalCutoffTime.toISOString(),
    actualWinner: prediction.actualWinner,
    correct: prediction.correct,
    voided: prediction.voided,
    abstained: prediction.abstained,
    abstentionReason: prediction.abstentionReason,
    homePitcherAvailable: prediction.homePitcherAvailable,
    awayPitcherAvailable: prediction.awayPitcherAvailable,
    researchConstructionMode: prediction.researchConstructionMode,
    researchModelVersion: prediction.researchModelVersion,
    includedEvidenceDomains: Object.freeze([...prediction.includedEvidenceDomains]),
    excludedEvidenceDomains: Object.freeze([...prediction.excludedEvidenceDomains]),
  };
  return Object.freeze(result);
}

function countWarnings(
  predictions: readonly BacktestPrediction[],
  abstentions: readonly BacktestPrediction[],
): number {
  return (
    predictions.reduce((sum, item) => sum + item.warnings.length, 0) +
    abstentions.reduce((sum, item) => sum + item.warnings.length, 0)
  );
}

export function buildHistoricalResearchExport(params: {
  readonly orchestrationResult: HistoricalBacktestOrchestrationResult;
  readonly researchConstruction: 'FULL' | 'TEAM_ONLY' | 'BOTH';
  readonly source: 'fixture' | 'live';
  readonly generatedAt: Date;
  readonly comparison?: ResearchConstructionReport;
}): HistoricalResearchExport {
  const { orchestrationResult, researchConstruction, source, generatedAt, comparison } = params;
  const predictions = orchestrationResult.runnerResult.predictions;
  const abstentions = orchestrationResult.runnerResult.abstentions;
  const predictionsMade = predictions.filter((p: BacktestPrediction) => !p.voided && !p.abstained).length;
  const warningCount = countWarnings(predictions, abstentions);

  const exportObj: HistoricalResearchExport = {
    exportVersion: HISTORICAL_RESEARCH_EXPORT_VERSION,
    generatedAt: generatedAt.toISOString(),
    source,
    dateRange: Object.freeze({
      startDate: orchestrationResult.dateRange.startDate,
      endDate: orchestrationResult.dateRange.endDate,
    }),
    requestedDates: Object.freeze([...orchestrationResult.requestedDates]),
    researchConstruction,
    runSummary: Object.freeze({
      scheduleRequests: orchestrationResult.scheduleRequests,
      discoveredGames: orchestrationResult.discoveredGames,
      uniqueGames: orchestrationResult.uniqueGames,
      duplicateGamesRemoved: orchestrationResult.duplicateGamesRemoved,
      predictionsMade,
      abstentions: abstentions.length,
      warningCount,
    }),
    ...(researchConstruction === 'BOTH' && comparison ? { comparison } : {}),
    predictions: Object.freeze(predictions.map(serializePrediction)),
    abstentions: Object.freeze(abstentions.map(serializePrediction)),
  };

  return Object.freeze(exportObj);
}
