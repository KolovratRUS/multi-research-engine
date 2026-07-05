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

export interface HistoricalResearchExportReviewSummary {
  readonly exportId: string;
  readonly exportVersion: string;
  readonly generatedAt: string;
  readonly source: string;
  readonly researchConstruction: string;
  readonly dateRange: { readonly startDate: string; readonly endDate: string };
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

export interface HistoricalResearchExportValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly expected?: unknown;
  readonly actual?: unknown;
  readonly message: string;
}

export interface HistoricalResearchExportValidationResult {
  readonly valid: boolean;
  readonly issues: readonly HistoricalResearchExportValidationIssue[];
}

const FORBIDDEN_KEYS = new Set<string>([
  'modelProbability',
  'impliedProbability',
  'calibratedProbability',
  'odds',
  'sportsbook',
  'expected value',
  'EV',
  'ROI',
  'edge',
  'favorite',
  'underdog',
  'line movement',
  'public betting',
  'market movement',
  'betting value',
]);

function collectForbiddenKeys(value: unknown, path: string): readonly string[] {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const found = collectForbiddenKeys(value[i], `${path}[${i}]`);
      if (found.length > 0) {
        return found;
      }
    }
    return [];
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (FORBIDDEN_KEYS.has(key)) {
        const fullPath = path.length > 0 ? `${path}.${key}` : key;
        return [fullPath];
      }
      const currentPath = path.length > 0 ? `${path}.${key}` : key;
      const found = collectForbiddenKeys(record[key], currentPath);
      if (found.length > 0) {
        return found;
      }
    }
  }

  return [];
}

function toSource(value: unknown): 'fixture' | 'live' {
  return value === 'fixture' || value === 'live' ? value : 'fixture';
}

function toResearchConstruction(value: unknown): 'FULL' | 'TEAM_ONLY' | 'BOTH' {
  return value === 'FULL' || value === 'TEAM_ONLY' || value === 'BOTH'
    ? value
    : 'FULL';
}

export function validateHistoricalResearchExportManifest(
  exportObj: unknown,
): HistoricalResearchExportValidationResult {
  const issues: HistoricalResearchExportValidationIssue[] = [];

  const forbiddenPaths = collectForbiddenKeys(exportObj, '');
  if (forbiddenPaths.length > 0) {
    const firstPath = forbiddenPaths[0];
    issues.push({
      code: 'FORBIDDEN_FIELD_PRESENT',
      path: firstPath ?? '',
      actual: forbiddenPaths,
      message: firstPath ? `Forbidden field present at ${firstPath}` : 'Forbidden field present',
    });
  }

  if (
    typeof exportObj !== 'object' ||
    exportObj === null ||
    typeof (exportObj as Record<string, unknown>).manifest !== 'object' ||
    (exportObj as Record<string, unknown>).manifest === null
  ) {
    if (issues.length === 0) {
      issues.push({
        code: 'INVALID_EXPORT_OBJECT',
        path: '',
        message: 'Export object is not a valid object or is missing manifest',
      });
    }
    return {
      valid: false,
      issues: Object.freeze([...issues]),
    };
  }

  const record = exportObj as Record<string, unknown>;
  const manifest = record.manifest as Record<string, unknown>;
  const predictions = (Array.isArray(record.predictions) ? record.predictions : []) as readonly ExportedResearchResult[];
  const abstentions = (Array.isArray(record.abstentions) ? record.abstentions : []) as readonly ExportedResearchResult[];
  const totalWarnings = countWarnings(predictions, abstentions);
  const { included, excluded, warningSummary } = buildEvidenceDomainAndWarningSummary(predictions, abstentions);
  const comparisonIncluded = Boolean(record.comparison);

  const dateRange =
    typeof record.dateRange === 'object' && record.dateRange !== null
      ? (record.dateRange as { startDate: string; endDate: string })
      : { startDate: '', endDate: '' };

  const requestedDates = (Array.isArray(record.requestedDates) ? record.requestedDates : []) as readonly string[];

  if (manifest.exportVersion !== HISTORICAL_RESEARCH_EXPORT_VERSION) {
    issues.push({
      code: 'MANIFEST_EXPORT_VERSION_MISMATCH',
      path: 'manifest.exportVersion',
      expected: HISTORICAL_RESEARCH_EXPORT_VERSION,
      actual: manifest.exportVersion,
      message: 'exportVersion mismatch between manifest and export',
    });
  }

  if (manifest.generatedAt !== record.generatedAt) {
    issues.push({
      code: 'MANIFEST_GENERATED_AT_MISMATCH',
      path: 'manifest.generatedAt',
      expected: record.generatedAt,
      actual: manifest.generatedAt,
      message: 'generatedAt mismatch between manifest and export',
    });
  }

  if (manifest.source !== record.source) {
    issues.push({
      code: 'MANIFEST_SOURCE_MISMATCH',
      path: 'manifest.source',
      expected: record.source,
      actual: manifest.source,
      message: 'source mismatch between manifest and export',
    });
  }

  if (manifest.researchConstruction !== record.researchConstruction) {
    issues.push({
      code: 'MANIFEST_RESEARCH_CONSTRUCTION_MISMATCH',
      path: 'manifest.researchConstruction',
      expected: record.researchConstruction,
      actual: manifest.researchConstruction,
      message: 'researchConstruction mismatch between manifest and export',
    });
  }

  const manifestDateRange =
    typeof manifest.dateRange === 'object' && manifest.dateRange !== null
      ? (manifest.dateRange as { startDate: string; endDate: string })
      : { startDate: '', endDate: '' };

  if (manifestDateRange.startDate !== dateRange.startDate || manifestDateRange.endDate !== dateRange.endDate) {
    issues.push({
      code: 'MANIFEST_DATE_RANGE_MISMATCH',
      path: 'manifest.dateRange',
      expected: dateRange,
      actual: manifestDateRange,
      message: 'dateRange mismatch between manifest and export',
    });
  }

  if (manifest.requestedDateCount !== requestedDates.length) {
    issues.push({
      code: 'MANIFEST_REQUESTED_DATE_COUNT_MISMATCH',
      path: 'manifest.requestedDateCount',
      expected: requestedDates.length,
      actual: manifest.requestedDateCount,
      message: 'requestedDateCount mismatch between manifest and export',
    });
  }

  const manifestResultCounts =
    typeof manifest.resultCounts === 'object' && manifest.resultCounts !== null
      ? (manifest.resultCounts as { predictions: unknown; abstentions: unknown; warnings: unknown })
      : { predictions: '', abstentions: '', warnings: '' };

  if (manifestResultCounts.predictions !== predictions.length) {
    issues.push({
      code: 'MANIFEST_PREDICTION_COUNT_MISMATCH',
      path: 'manifest.resultCounts.predictions',
      expected: predictions.length,
      actual: manifestResultCounts.predictions,
      message: 'prediction count mismatch between manifest and export',
    });
  }

  if (manifestResultCounts.abstentions !== abstentions.length) {
    issues.push({
      code: 'MANIFEST_ABSTENTION_COUNT_MISMATCH',
      path: 'manifest.resultCounts.abstentions',
      expected: abstentions.length,
      actual: manifestResultCounts.abstentions,
      message: 'abstention count mismatch between manifest and export',
    });
  }

  if (manifestResultCounts.warnings !== totalWarnings) {
    issues.push({
      code: 'MANIFEST_WARNING_COUNT_MISMATCH',
      path: 'manifest.resultCounts.warnings',
      expected: totalWarnings,
      actual: manifestResultCounts.warnings,
      message: 'warning count mismatch between manifest and export',
    });
  }

  if (manifest.comparisonIncluded !== comparisonIncluded) {
    issues.push({
      code: 'MANIFEST_COMPARISON_INCLUDED_MISMATCH',
      path: 'manifest.comparisonIncluded',
      expected: comparisonIncluded,
      actual: manifest.comparisonIncluded,
      message: 'comparisonIncluded mismatch between manifest and export',
    });
  }

  const evidence = manifest.evidenceDomainSummary as Record<string, unknown> | undefined;
  const manifestIncluded = Array.isArray(evidence?.included)
    ? evidence.included as string[]
    : [];
  const manifestExcluded = Array.isArray(evidence?.excluded)
    ? evidence.excluded as string[]
    : [];

  if (manifestIncluded.length !== included.length || manifestIncluded.some((value: string, index: number) => value !== included[index])) {
    issues.push({
      code: 'MANIFEST_INCLUDED_DOMAINS_MISMATCH',
      path: 'manifest.evidenceDomainSummary.included',
      expected: included,
      actual: manifestIncluded as readonly string[],
      message: 'included evidence domains mismatch between manifest and export',
    });
  }

  if (manifestExcluded.length !== excluded.length || manifestExcluded.some((value: string, index: number) => value !== excluded[index])) {
    issues.push({
      code: 'MANIFEST_EXCLUDED_DOMAINS_MISMATCH',
      path: 'manifest.evidenceDomainSummary.excluded',
      expected: excluded,
      actual: manifestExcluded as readonly string[],
      message: 'excluded evidence domains mismatch between manifest and export',
    });
  }

  const manifestWarnings = Array.isArray(manifest.warningSummary) ? manifest.warningSummary : [];

  if (manifestWarnings.length !== warningSummary.length || manifestWarnings.some((value: string, index: number) => value !== warningSummary[index])) {
    issues.push({
      code: 'MANIFEST_WARNING_SUMMARY_MISMATCH',
      path: 'manifest.warningSummary',
      expected: warningSummary,
      actual: manifestWarnings as readonly string[],
      message: 'warning summary mismatch between manifest and export',
    });
  }

  const expectedExportId = buildExportId({
    exportVersion: HISTORICAL_RESEARCH_EXPORT_VERSION,
    source: toSource(record.source),
    researchConstruction: toResearchConstruction(record.researchConstruction),
    dateRange: { startDate: dateRange.startDate, endDate: dateRange.endDate },
    requestedDateCount: requestedDates.length,
    resultCounts: {
      predictions: predictions.length,
      abstentions: abstentions.length,
      warnings: totalWarnings,
    },
    comparisonIncluded,
    evidenceDomainSummary: { included, excluded },
    warningSummary,
  });

  if (manifest.exportId !== expectedExportId) {
    issues.push({
      code: 'MANIFEST_EXPORT_ID_MISMATCH',
      path: 'manifest.exportId',
      expected: expectedExportId,
      actual: manifest.exportId,
      message: 'exportId mismatch between manifest and deterministic derivation',
    });
  }

  return {
    valid: issues.length === 0,
    issues: Object.freeze([...issues]),
  };
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
): { readonly included: readonly string[]; readonly excluded: readonly string[]; readonly warningSummary: readonly string[] } {
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

function toStringArray(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

export function buildHistoricalResearchExportReviewSummary(
  exportObj: unknown,
): HistoricalResearchExportReviewSummary | null {
  if (typeof exportObj !== 'object' || exportObj === null) {
    return null;
  }

  const record = exportObj as Record<string, unknown>;
  const dateRange =
    typeof record.dateRange === 'object' && record.dateRange !== null
      ? (record.dateRange as { startDate: unknown; endDate: unknown })
      : { startDate: '', endDate: '' };
  const manifest =
    typeof (record.manifest as Record<string, unknown> | undefined)?.exportId === 'string'
      ? (record.manifest as Record<string, unknown> | undefined)
      : {};
  const evidence =
    typeof manifest?.evidenceDomainSummary === 'object' && manifest?.evidenceDomainSummary !== null
      ? (manifest.evidenceDomainSummary as Record<string, unknown>)
      : { included: [], excluded: [] };

  return {
    exportId: typeof manifest?.exportId === 'string' ? (manifest.exportId as string) : '',
    exportVersion: typeof record.exportVersion === 'string'
      ? record.exportVersion
      : typeof manifest?.exportVersion === 'string'
        ? (manifest.exportVersion as string)
        : '',
    generatedAt: typeof record.generatedAt === 'string'
      ? record.generatedAt
      : typeof manifest?.generatedAt === 'string'
        ? (manifest.generatedAt as string)
        : '',
    source: typeof record.source === 'string'
      ? record.source
      : typeof manifest?.source === 'string'
        ? (manifest.source as string)
        : '',
    researchConstruction: typeof record.researchConstruction === 'string'
      ? record.researchConstruction
      : typeof manifest?.researchConstruction === 'string'
        ? (manifest.researchConstruction as string)
        : '',
    dateRange: {
      startDate: typeof dateRange.startDate === 'string' ? dateRange.startDate : '',
      endDate: typeof dateRange.endDate === 'string' ? dateRange.endDate : '',
    },
    requestedDateCount: Array.isArray((record as { requestedDates?: unknown }).requestedDates)
      ? ((record as { requestedDates: unknown[] }).requestedDates as readonly string[]).length
      : 0,
    resultCounts: {
      predictions: Array.isArray((record as { predictions?: unknown }).predictions)
        ? ((record as { predictions: unknown[] }).predictions as readonly Record<string, unknown>[]).length
        : 0,
      abstentions: Array.isArray((record as { abstentions?: unknown }).abstentions)
        ? ((record as { abstentions: unknown[] }).abstentions as readonly Record<string, unknown>[]).length
        : 0,
      warnings:
        typeof manifest?.resultCounts === 'object' && manifest?.resultCounts !== null
          ? Number((manifest.resultCounts as { warnings: unknown }).warnings ?? 0)
          : 0,
    },
    comparisonIncluded:
      typeof (record as { comparison?: unknown }).comparison === 'object' &&
      (record as { comparison?: unknown }).comparison !== null,
    evidenceDomainSummary: {
      included: toStringArray(evidence?.included),
      excluded: toStringArray(evidence?.excluded),
    },
    warningSummary: toStringArray(manifest?.warningSummary),
  };
}

export function formatHistoricalResearchExportReview(
  summary: HistoricalResearchExportReviewSummary,
): string {
  const domains = (items: readonly string[]): string => (items.length > 0 ? items.join(', ') : 'none');

  return [
    'Historical Research Export Review',
    'Manifest Valid: yes',
    `Export ID: ${summary.exportId}`,
    `Export Version: ${summary.exportVersion}`,
    `Generated At: ${summary.generatedAt}`,
    `Source: ${summary.source}`,
    `Research Construction: ${summary.researchConstruction}`,
    `Date Range: ${summary.dateRange.startDate} to ${summary.dateRange.endDate}`,
    `Requested Dates: ${summary.requestedDateCount}`,
    `Predictions: ${summary.resultCounts.predictions}`,
    `Abstentions: ${summary.resultCounts.abstentions}`,
    `Warnings: ${summary.resultCounts.warnings}`,
    `Comparison Included: ${summary.comparisonIncluded ? 'yes' : 'no'}`,
    `Included Evidence Domains: ${domains(summary.evidenceDomainSummary.included)}`,
    `Excluded Evidence Domains: ${domains(summary.evidenceDomainSummary.excluded)}`,
    `Warning Summary: ${domains(summary.warningSummary)}`,
  ].join('\n');
}

export function formatHistoricalResearchExportValidationIssues(
  issues: readonly HistoricalResearchExportValidationIssue[],
): string {
  const lines = ['Historical Research Export Review Failed'];
  for (const issue of issues) {
    const expected = issue.expected !== undefined ? `, expected ${JSON.stringify(issue.expected)}` : '';
    const actual = issue.actual !== undefined ? `, actual ${JSON.stringify(issue.actual)}` : '';
    lines.push(`- ${issue.code}: ${issue.path} - ${issue.message}${expected}${actual}`);
  }
  return lines.join('\n');
}
