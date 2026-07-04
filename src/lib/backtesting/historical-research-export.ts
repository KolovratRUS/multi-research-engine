import type {
  BacktestPrediction,
  ResearchConstructionReport,
} from './types';
import type { HistoricalBacktestOrchestrationResult } from './orchestrator';
import crypto from 'node:crypto';

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

export interface HistoricalResearchExportManifest {
  readonly exportId: string;
  readonly exportVersion: typeof HISTORICAL_RESEARCH_EXPORT_VERSION;
  readonly generatedAt: string;
  readonly source: 'fixture' | 'live';
  readonly researchConstruction: 'FULL' | 'TEAM_ONLY' | 'BOTH';
  readonly dateRange: {
    readonly startDate: string;
    readonly endDate: string;
  };
  readonly requestedDateCount: number;
  readonly resultCounts: {
    readonly predictions: number;
    readonly abstentions: number;
    readonly warnings: number;
  };
  readonly comparisonIncluded: boolean;
  readonly evidenceDomainSummary: {
    readonly included: readonly string[];
    readonly excluded: readonly string[];
  };
  readonly warningSummary: readonly string[];
}

export interface HistoricalResearchExport {
  readonly exportVersion: typeof HISTORICAL_RESEARCH_EXPORT_VERSION;
  readonly manifest: HistoricalResearchExportManifest;
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
  predictions: readonly ExportedResearchResult[],
  abstentions: readonly ExportedResearchResult[],
): number {
  return (
    predictions.reduce((sum, item) => sum + item.warnings.length, 0) +
    abstentions.reduce((sum, item) => sum + item.warnings.length, 0)
  );
}

function buildEvidenceDomainAndWarningSummary(
  predictions: readonly ExportedResearchResult[],
  abstentions: readonly ExportedResearchResult[],
): { included: readonly string[]; excluded: readonly string[]; warningSummary: readonly string[] } {
  const included = new Set<string>();
  const excluded = new Set<string>();
  const warningSummary = new Set<string>();

  for (const item of [...predictions, ...abstentions]) {
    for (const domain of item.includedEvidenceDomains) {
      included.add(domain);
    }
    for (const domain of item.excludedEvidenceDomains) {
      excluded.add(domain);
    }
    for (const warning of item.warnings) {
      warningSummary.add(warning);
    }
  }

  return {
    included: Object.freeze([...included].sort()),
    excluded: Object.freeze([...excluded].sort()),
    warningSummary: Object.freeze([...warningSummary].sort()),
  };
}

function buildExportId(seed: {
  readonly exportVersion: typeof HISTORICAL_RESEARCH_EXPORT_VERSION;
  readonly source: 'fixture' | 'live';
  readonly researchConstruction: 'FULL' | 'TEAM_ONLY' | 'BOTH';
  readonly dateRange: { readonly startDate: string; readonly endDate: string };
  readonly requestedDateCount: number;
  readonly resultCounts: { readonly predictions: number; readonly abstentions: number; readonly warnings: number };
  readonly comparisonIncluded: boolean;
  readonly evidenceDomainSummary: { readonly included: readonly string[]; readonly excluded: readonly string[] };
  readonly warningSummary: readonly string[];
}): string {
  const seedString = [
    seed.exportVersion,
    seed.source,
    seed.researchConstruction,
    `${seed.dateRange.startDate}..${seed.dateRange.endDate}`,
    `${seed.requestedDateCount}d`,
    `${seed.resultCounts.predictions}p`,
    `${seed.resultCounts.abstentions}a`,
    `${seed.resultCounts.warnings}w`,
    seed.comparisonIncluded ? 'cmp' : 'nocmp',
    [...seed.evidenceDomainSummary.included].sort().join('|'),
    [...seed.evidenceDomainSummary.excluded].sort().join('|'),
    [...seed.warningSummary].sort().join('|'),
  ].join(':');

  const hash = crypto
    .createHash('sha256')
    .update(seedString, 'utf8')
    .digest('hex')
    .slice(0, 12);
  return `historical-research-export-v1:${hash}`;
}

export function buildHistoricalResearchExport(params: {
  readonly orchestrationResult: HistoricalBacktestOrchestrationResult;
  readonly researchConstruction: 'FULL' | 'TEAM_ONLY' | 'BOTH';
  readonly source: 'fixture' | 'live';
  readonly generatedAt: Date;
  readonly comparison?: ResearchConstructionReport;
}): HistoricalResearchExport {
  const { orchestrationResult, researchConstruction, source, generatedAt, comparison } = params;
  const rawPredictions = orchestrationResult.runnerResult.predictions;
  const rawAbstentions = orchestrationResult.runnerResult.abstentions;
  const predictionsMade = rawPredictions.filter((p: BacktestPrediction) => !p.voided && !p.abstained).length;

  const predictions = Object.freeze(rawPredictions.map(serializePrediction));
  const abstentions = Object.freeze(rawAbstentions.map(serializePrediction));

  const totalWarnings = countWarnings(predictions, abstentions);
  const { included, excluded, warningSummary } = buildEvidenceDomainAndWarningSummary(predictions, abstentions);
  const comparisonIncluded = Boolean(researchConstruction === 'BOTH' && comparison);

  const manifest: HistoricalResearchExportManifest = {
    exportId: buildExportId({
      exportVersion: HISTORICAL_RESEARCH_EXPORT_VERSION,
      source,
      researchConstruction,
      dateRange: {
        startDate: orchestrationResult.dateRange.startDate,
        endDate: orchestrationResult.dateRange.endDate,
      },
      requestedDateCount: orchestrationResult.requestedDates.length,
      resultCounts: {
        predictions: predictions.length,
        abstentions: abstentions.length,
        warnings: totalWarnings,
      },
      comparisonIncluded,
      evidenceDomainSummary: { included, excluded },
      warningSummary,
    }),
    exportVersion: HISTORICAL_RESEARCH_EXPORT_VERSION,
    generatedAt: generatedAt.toISOString(),
    source,
    researchConstruction,
    dateRange: {
      startDate: orchestrationResult.dateRange.startDate,
      endDate: orchestrationResult.dateRange.endDate,
    },
    requestedDateCount: orchestrationResult.requestedDates.length,
    resultCounts: {
      predictions: predictions.length,
      abstentions: abstentions.length,
      warnings: totalWarnings,
    },
    comparisonIncluded,
    evidenceDomainSummary: {
      included,
      excluded,
    },
    warningSummary,
  };

  const exportObj: HistoricalResearchExport = {
    exportVersion: HISTORICAL_RESEARCH_EXPORT_VERSION,
    manifest,
    generatedAt: generatedAt.toISOString(),
    source,
    dateRange: {
      startDate: orchestrationResult.dateRange.startDate,
      endDate: orchestrationResult.dateRange.endDate,
    },
    requestedDates: Object.freeze([...orchestrationResult.requestedDates]),
    researchConstruction,
    runSummary: Object.freeze({
      scheduleRequests: orchestrationResult.scheduleRequests,
      discoveredGames: orchestrationResult.discoveredGames,
      uniqueGames: orchestrationResult.uniqueGames,
      duplicateGamesRemoved: orchestrationResult.duplicateGamesRemoved,
      predictionsMade,
      abstentions: abstentions.length,
      warningCount: totalWarnings,
    }),
    ...(comparisonIncluded ? { comparison } : {}),
    predictions,
    abstentions,
  };

  return Object.freeze(exportObj);
}
