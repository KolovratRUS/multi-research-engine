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

export const HISTORICAL_RESEARCH_EXPORT_REVIEW_VERSION = 'historical-research-export-review-v1';

export interface HistoricalResearchExportReviewJson {
  readonly reviewVersion: typeof HISTORICAL_RESEARCH_EXPORT_REVIEW_VERSION;
  readonly valid: boolean;
  readonly summary: HistoricalResearchExportReviewSummary | null;
  readonly issues: readonly HistoricalResearchExportValidationIssue[];
}

export function buildHistoricalResearchExportReviewJson(
  summary: HistoricalResearchExportReviewSummary | null,
  issues: readonly HistoricalResearchExportValidationIssue[],
): HistoricalResearchExportReviewJson {
  return {
    reviewVersion: HISTORICAL_RESEARCH_EXPORT_REVIEW_VERSION,
    valid: summary !== null && issues.length === 0,
    summary,
    issues,
  };
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

export const HISTORICAL_RESEARCH_EXPORT_REVIEW_BATCH_VERSION = 'historical-research-export-review-batch-v1';

export interface HistoricalResearchExportBatchReviewItem {
  readonly file: string;
  readonly review: HistoricalResearchExportReviewJson;
}

export interface HistoricalResearchExportBatchReviewJson {
  readonly reviewVersion: typeof HISTORICAL_RESEARCH_EXPORT_REVIEW_BATCH_VERSION;
  readonly valid: boolean;
  readonly summary: HistoricalResearchExportBatchAggregateSummary;
  readonly reviews: readonly HistoricalResearchExportBatchReviewItem[];
  readonly thresholdsPassed?: boolean;
  readonly thresholdIssues?: readonly HistoricalResearchExportThresholdCheckIssue[];
}

export interface HistoricalResearchExportBatchAggregateSummary {
  readonly filesReviewed: number;
  readonly validFiles: number;
  readonly invalidFiles: number;
  readonly totalRequestedDates: number;
  readonly totalPredictions: number;
  readonly totalAbstentions: number;
  readonly totalWarnings: number;
  readonly constructionCounts: {
    readonly FULL: number;
    readonly TEAM_ONLY: number;
    readonly BOTH: number;
  };
  readonly comparisonIncludedFiles: number;
  readonly evidenceDomainSummary: {
    readonly included: readonly string[];
    readonly excluded: readonly string[];
  };
  readonly warningSummary: readonly string[];
}

export type HistoricalResearchExportThresholdCheckCode =
  | 'MIN_VALID_FILES_NOT_MET'
  | 'MAX_INVALID_FILES_EXCEEDED'
  | 'MIN_TOTAL_PREDICTIONS_NOT_MET'
  | 'MAX_TOTAL_ABSTENTIONS_EXCEEDED'
  | 'MAX_TOTAL_WARNINGS_EXCEEDED'
  | 'REQUIRED_CONSTRUCTION_MISSING'
  | 'REQUIRED_EVIDENCE_DOMAIN_MISSING'
  | 'FORBIDDEN_WARNING_PRESENT';

export interface HistoricalResearchExportThresholdCheckIssue {
  readonly code: HistoricalResearchExportThresholdCheckCode;
  readonly path: string;
  readonly message: string;
  readonly expected: number | string;
  readonly actual: number | string;
}

export interface HistoricalResearchExportReviewThresholds {
  readonly minValidFiles?: number;
  readonly maxInvalidFiles?: number;
  readonly minTotalPredictions?: number;
  readonly maxTotalAbstentions?: number;
  readonly maxTotalWarnings?: number;
  readonly requireConstructions?: readonly ('FULL' | 'TEAM_ONLY' | 'BOTH')[];
  readonly requireEvidenceDomains?: readonly string[];
  readonly forbidWarnings?: readonly string[];
}

export const HISTORICAL_RESEARCH_EXPORT_THRESHOLDS_VERSION = 'historical-research-export-thresholds-v1';

export interface HistoricalResearchExportThresholdPreset {
  readonly thresholdVersion: typeof HISTORICAL_RESEARCH_EXPORT_THRESHOLDS_VERSION;
  readonly minValidFiles?: number;
  readonly maxInvalidFiles?: number;
  readonly minTotalPredictions?: number;
  readonly maxTotalAbstentions?: number;
  readonly maxTotalWarnings?: number;
  readonly requireConstructions?: readonly ('FULL' | 'TEAM_ONLY' | 'BOTH')[];
  readonly requireEvidenceDomains?: readonly string[];
  readonly forbidWarnings?: readonly string[];
}

export type HistoricalResearchExportThresholdPresetCode =
  | 'THRESHOLD_PRESET_NOT_OBJECT'
  | 'THRESHOLD_PRESET_VERSION_MISSING'
  | 'THRESHOLD_PRESET_VERSION_UNSUPPORTED'
  | 'THRESHOLD_PRESET_UNKNOWN_FIELD'
  | 'THRESHOLD_PRESET_INVALID_INTEGER'
  | 'THRESHOLD_PRESET_INVALID_CONSTRUCTION'
  | 'THRESHOLD_PRESET_INVALID_STRING_ARRAY';

export interface HistoricalResearchExportThresholdPresetValidationIssue {
  readonly code: HistoricalResearchExportThresholdPresetCode;
  readonly path: string;
  readonly message: string;
  readonly expected?: string | number;
  readonly actual?: string | number;
}

export interface HistoricalResearchExportThresholdPresetValidationResult {
  readonly valid: boolean;
  readonly thresholds: HistoricalResearchExportReviewThresholds | null;
  readonly issues: readonly HistoricalResearchExportThresholdPresetValidationIssue[];
}

const PRESET_NUMERIC_KEYS = [
  'minValidFiles',
  'maxInvalidFiles',
  'minTotalPredictions',
  'maxTotalAbstentions',
  'maxTotalWarnings',
] as const;

const PRESET_KNOWN_FIELDS = new Set<string>([
  'thresholdVersion',
  'minValidFiles',
  'maxInvalidFiles',
  'minTotalPredictions',
  'maxTotalAbstentions',
  'maxTotalWarnings',
  'requireConstructions',
  'requireEvidenceDomains',
  'forbidWarnings',
]);

function pushPresetIssue(
  issues: HistoricalResearchExportThresholdPresetValidationIssue[],
  code: HistoricalResearchExportThresholdPresetCode,
  path: string,
  message: string,
  expected?: string | number,
  actual?: string | number,
): void {
  issues.push({ code, path, message, expected, actual });
}

export function validateHistoricalResearchExportThresholdPreset(
  value: unknown,
): HistoricalResearchExportThresholdPresetValidationResult {
  const issues: HistoricalResearchExportThresholdPresetValidationIssue[] = [];

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    pushPresetIssue(issues, 'THRESHOLD_PRESET_NOT_OBJECT', '', 'Preset must be a JSON object');
    return Object.freeze({ valid: false, thresholds: null, issues: Object.freeze([...issues]) });
  }

  const record = value as Record<string, unknown>;

  if (!('thresholdVersion' in record)) {
    pushPresetIssue(
      issues,
      'THRESHOLD_PRESET_VERSION_MISSING',
      'thresholdVersion',
      'Missing required field: thresholdVersion',
    );
  } else if (record.thresholdVersion !== HISTORICAL_RESEARCH_EXPORT_THRESHOLDS_VERSION) {
    pushPresetIssue(
      issues,
      'THRESHOLD_PRESET_VERSION_UNSUPPORTED',
      'thresholdVersion',
      'Unsupported threshold preset version',
      HISTORICAL_RESEARCH_EXPORT_THRESHOLDS_VERSION,
      typeof record.thresholdVersion === 'string' ? record.thresholdVersion : '',
    );
  }

  const unknownFields = Object.keys(record)
    .filter((key) => !PRESET_KNOWN_FIELDS.has(key))
    .sort();
  for (const field of unknownFields) {
    pushPresetIssue(
      issues,
      'THRESHOLD_PRESET_UNKNOWN_FIELD',
      field,
      `Unknown preset field: ${field}`,
    );
  }

  for (const key of PRESET_NUMERIC_KEYS) {
    if (!(key in record)) {
      continue;
    }
    const raw = record[key];
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) {
      pushPresetIssue(
        issues,
        'THRESHOLD_PRESET_INVALID_INTEGER',
        key,
        `Invalid integer preset field: ${key}`,
        'non-negative integer',
        typeof raw === 'number' ? raw : (raw as string | undefined),
      );
    }
  }

  if ('requireConstructions' in record) {
    const raw = record.requireConstructions;
    if (
      !Array.isArray(raw) ||
      raw.length > 0 && (
        !raw.every(
          (item) =>
            item === 'FULL' || item === 'TEAM_ONLY' || item === 'BOTH',
        )
      )
    ) {
      pushPresetIssue(
        issues,
        'THRESHOLD_PRESET_INVALID_CONSTRUCTION',
        'requireConstructions',
        'Invalid requireConstructions array value',
        'FULL, TEAM_ONLY, or BOTH',
        Array.isArray(raw) ? JSON.stringify(raw) : (raw as string | undefined),
      );
    }
  }

  if ('requireEvidenceDomains' in record) {
    const raw = record.requireEvidenceDomains;
    if (
      !Array.isArray(raw) ||
      raw.some((item) => typeof item !== 'string' || item.trim() === '')
    ) {
      pushPresetIssue(
        issues,
        'THRESHOLD_PRESET_INVALID_STRING_ARRAY',
        'requireEvidenceDomains',
        'Invalid requireEvidenceDomains array value',
        'non-empty strings',
        Array.isArray(raw) ? JSON.stringify(raw) : (raw as string | undefined),
      );
    }
  }

  if ('forbidWarnings' in record) {
    const raw = record.forbidWarnings;
    if (
      !Array.isArray(raw) ||
      raw.some((item) => typeof item !== 'string' || item.trim() === '')
    ) {
      pushPresetIssue(
        issues,
        'THRESHOLD_PRESET_INVALID_STRING_ARRAY',
        'forbidWarnings',
        'Invalid forbidWarnings array value',
        'non-empty strings',
        Array.isArray(raw) ? JSON.stringify(raw) : (raw as string | undefined),
      );
    }
  }

  if (issues.length > 0) {
    return Object.freeze({ valid: false, thresholds: null, issues: Object.freeze([...issues]) });
  }

  const thresholds: Record<string, unknown> = {};

  if (typeof record.minValidFiles === 'number' && Number.isInteger(record.minValidFiles) && record.minValidFiles >= 0) {
    thresholds.minValidFiles = record.minValidFiles;
  }
  if (typeof record.maxInvalidFiles === 'number' && Number.isInteger(record.maxInvalidFiles) && record.maxInvalidFiles >= 0) {
    thresholds.maxInvalidFiles = record.maxInvalidFiles;
  }
  if (typeof record.minTotalPredictions === 'number' && Number.isInteger(record.minTotalPredictions) && record.minTotalPredictions >= 0) {
    thresholds.minTotalPredictions = record.minTotalPredictions;
  }
  if (typeof record.maxTotalAbstentions === 'number' && Number.isInteger(record.maxTotalAbstentions) && record.maxTotalAbstentions >= 0) {
    thresholds.maxTotalAbstentions = record.maxTotalAbstentions;
  }
  if (typeof record.maxTotalWarnings === 'number' && Number.isInteger(record.maxTotalWarnings) && record.maxTotalWarnings >= 0) {
    thresholds.maxTotalWarnings = record.maxTotalWarnings;
  }
  if (Array.isArray(record.requireConstructions) && record.requireConstructions.length > 0) {
    thresholds.requireConstructions = Object.freeze([...record.requireConstructions] as readonly ('FULL' | 'TEAM_ONLY' | 'BOTH')[]);
  }
  if (Array.isArray(record.requireEvidenceDomains) && record.requireEvidenceDomains.length > 0) {
    thresholds.requireEvidenceDomains = Object.freeze([...record.requireEvidenceDomains]);
  }
  if (Array.isArray(record.forbidWarnings) && record.forbidWarnings.length > 0) {
    thresholds.forbidWarnings = Object.freeze([...record.forbidWarnings]);
  }

  return Object.freeze({ valid: true, thresholds: Object.freeze(thresholds) as HistoricalResearchExportReviewThresholds, issues: [] });
}

const THRESHOLD_PATH_LOOKUP: Record<keyof HistoricalResearchExportReviewThresholds, string> = {
  minValidFiles: 'summary.validFiles',
  maxInvalidFiles: 'summary.invalidFiles',
  minTotalPredictions: 'summary.totalPredictions',
  maxTotalAbstentions: 'summary.totalAbstentions',
  maxTotalWarnings: 'summary.totalWarnings',
  requireConstructions: 'summary.constructionCounts',
  requireEvidenceDomains: 'summary.evidenceDomainSummary.included',
  forbidWarnings: 'summary.warningSummary',
};

export function evaluateHistoricalResearchExportBatchThresholds(
  summary: HistoricalResearchExportBatchAggregateSummary,
  thresholds: HistoricalResearchExportReviewThresholds,
): readonly HistoricalResearchExportThresholdCheckIssue[] {
  const issues: HistoricalResearchExportThresholdCheckIssue[] = [];
  const push = (
    code: HistoricalResearchExportThresholdCheckCode,
    path: string,
    expected: number | string,
    actual: number | string,
    message: string,
  ) => {
    issues.push({ code, path, message, expected, actual });
  };

  if (thresholds.minValidFiles !== undefined) {
    if (summary.validFiles < thresholds.minValidFiles) {
      push(
        'MIN_VALID_FILES_NOT_MET',
        THRESHOLD_PATH_LOOKUP.minValidFiles,
        `>= ${thresholds.minValidFiles}`,
        summary.validFiles,
        'valid files count is below minimum',
      );
    }
  }

  if (thresholds.maxInvalidFiles !== undefined) {
    if (summary.invalidFiles > thresholds.maxInvalidFiles) {
      push(
        'MAX_INVALID_FILES_EXCEEDED',
        THRESHOLD_PATH_LOOKUP.maxInvalidFiles,
        `<= ${thresholds.maxInvalidFiles}`,
        summary.invalidFiles,
        'invalid files count exceeds maximum',
      );
    }
  }

  if (thresholds.minTotalPredictions !== undefined) {
    if (summary.totalPredictions < thresholds.minTotalPredictions) {
      push(
        'MIN_TOTAL_PREDICTIONS_NOT_MET',
        THRESHOLD_PATH_LOOKUP.minTotalPredictions,
        `>= ${thresholds.minTotalPredictions}`,
        summary.totalPredictions,
        'total predictions count is below minimum',
      );
    }
  }

  if (thresholds.maxTotalAbstentions !== undefined) {
    if (summary.totalAbstentions > thresholds.maxTotalAbstentions) {
      push(
        'MAX_TOTAL_ABSTENTIONS_EXCEEDED',
        THRESHOLD_PATH_LOOKUP.maxTotalAbstentions,
        `<= ${thresholds.maxTotalAbstentions}`,
        summary.totalAbstentions,
        'total abstentions count exceeds maximum',
      );
    }
  }

  if (thresholds.maxTotalWarnings !== undefined) {
    if (summary.totalWarnings > thresholds.maxTotalWarnings) {
      push(
        'MAX_TOTAL_WARNINGS_EXCEEDED',
        THRESHOLD_PATH_LOOKUP.maxTotalWarnings,
        `<= ${thresholds.maxTotalWarnings}`,
        summary.totalWarnings,
        'total warnings count exceeds maximum',
      );
    }
  }

  if (thresholds.requireConstructions !== undefined) {
    for (const construction of thresholds.requireConstructions) {
      if (summary.constructionCounts[construction] <= 0) {
        push(
          'REQUIRED_CONSTRUCTION_MISSING',
          THRESHOLD_PATH_LOOKUP.requireConstructions,
          `> 0 ${construction}`,
          summary.constructionCounts[construction],
          `required construction ${construction} is missing`,
        );
      }
    }
  }

  if (thresholds.requireEvidenceDomains !== undefined) {
    for (const domain of thresholds.requireEvidenceDomains) {
      const included = summary.evidenceDomainSummary.included.includes(domain);
      const excluded = summary.evidenceDomainSummary.excluded.includes(domain);
      if (!included && !excluded) {
        push(
          'REQUIRED_EVIDENCE_DOMAIN_MISSING',
          THRESHOLD_PATH_LOOKUP.requireEvidenceDomains,
          `include ${domain}`,
          'absent',
          `required evidence domain ${domain} is missing`,
        );
      }
    }
  }

  if (thresholds.forbidWarnings !== undefined) {
    for (const warning of thresholds.forbidWarnings) {
      if (summary.warningSummary.includes(warning)) {
        push(
          'FORBIDDEN_WARNING_PRESENT',
          THRESHOLD_PATH_LOOKUP.forbidWarnings,
          `exclude ${warning}`,
          warning,
          `forbidden warning ${warning} is present`,
        );
      }
    }
  }

  return Object.freeze([...issues]);
}

export function buildHistoricalResearchExportBatchAggregateSummary(
  items: readonly HistoricalResearchExportBatchReviewItem[],
): HistoricalResearchExportBatchAggregateSummary {
  const validItems = items.filter((item) => item.review.valid);
  const summaries = validItems
    .map((item) => item.review.summary)
    .filter((summary): summary is HistoricalResearchExportReviewSummary => summary !== null);

  const includedDomains: string[] = [];
  const excludedDomains: string[] = [];
  const warnings: string[] = [];

  let totalRequestedDates = 0;
  let totalPredictions = 0;
  let totalAbstentions = 0;
  let totalWarnings = 0;
  const constructionCounts = { FULL: 0, TEAM_ONLY: 0, BOTH: 0 };
  let comparisonIncludedFiles = 0;

  for (const summary of summaries) {
    totalRequestedDates += summary.requestedDateCount;
    totalPredictions += summary.resultCounts.predictions;
    totalAbstentions += summary.resultCounts.abstentions;
    totalWarnings += summary.resultCounts.warnings;

    const construction = summary.researchConstruction as 'FULL' | 'TEAM_ONLY' | 'BOTH';
    if (construction === 'FULL' || construction === 'TEAM_ONLY' || construction === 'BOTH') {
      constructionCounts[construction] += 1;
    }

    if (summary.comparisonIncluded) {
      comparisonIncludedFiles += 1;
    }

    for (const domain of summary.evidenceDomainSummary.included) {
      if (!includedDomains.includes(domain)) {
        includedDomains.push(domain);
      }
    }

    for (const domain of summary.evidenceDomainSummary.excluded) {
      if (!excludedDomains.includes(domain)) {
        excludedDomains.push(domain);
      }
    }

    for (const warning of summary.warningSummary) {
      if (!warnings.includes(warning)) {
        warnings.push(warning);
      }
    }
  }

  return Object.freeze({
    filesReviewed: items.length,
    validFiles: validItems.length,
    invalidFiles: items.length - validItems.length,
    totalRequestedDates,
    totalPredictions,
    totalAbstentions,
    totalWarnings,
    constructionCounts: Object.freeze({ ...constructionCounts }),
    comparisonIncludedFiles,
    evidenceDomainSummary: Object.freeze({
      included: Object.freeze([...includedDomains]),
      excluded: Object.freeze([...excludedDomains]),
    }),
    warningSummary: Object.freeze([...warnings]),
  });
}

export function buildHistoricalResearchExportBatchReviewJson(
  items: readonly HistoricalResearchExportBatchReviewItem[],
  thresholds?: HistoricalResearchExportReviewThresholds,
): HistoricalResearchExportBatchReviewJson {
  const valid = items.every((item) => item.review.valid);
  const aggregate = buildHistoricalResearchExportBatchAggregateSummary(items);
  const thresholdIssues = thresholds
    ? evaluateHistoricalResearchExportBatchThresholds(aggregate, thresholds)
    : undefined;
  const thresholdsPassed = thresholdIssues === undefined ? undefined : thresholdIssues.length === 0;

  return {
    reviewVersion: HISTORICAL_RESEARCH_EXPORT_REVIEW_BATCH_VERSION,
    valid,
    summary: aggregate,
    reviews: Object.freeze([...items]),
    ...(thresholdsPassed !== undefined ? { thresholdsPassed } : {}),
    ...(thresholdIssues !== undefined ? { thresholdIssues } : {}),
  };
}

export function formatHistoricalResearchExportBatchReview(
  items: readonly HistoricalResearchExportBatchReviewItem[],
  thresholdIssues?: readonly HistoricalResearchExportThresholdCheckIssue[],
): string {
  const aggregate = buildHistoricalResearchExportBatchAggregateSummary(items);
  const aggregateLines = [
    `Total Requested Dates: ${aggregate.totalRequestedDates}`,
    `Total Predictions: ${aggregate.totalPredictions}`,
    `Total Abstentions: ${aggregate.totalAbstentions}`,
    `Total Warnings: ${aggregate.totalWarnings}`,
    `Construction Counts: FULL=${aggregate.constructionCounts.FULL}, TEAM_ONLY=${aggregate.constructionCounts.TEAM_ONLY}, BOTH=${aggregate.constructionCounts.BOTH}`,
    `Comparison Included Files: ${aggregate.comparisonIncludedFiles}`,
    `Included Evidence Domains: ${aggregate.evidenceDomainSummary.included.length > 0 ? aggregate.evidenceDomainSummary.included.join(', ') : 'none'}`,
    `Excluded Evidence Domains: ${aggregate.evidenceDomainSummary.excluded.length > 0 ? aggregate.evidenceDomainSummary.excluded.join(', ') : 'none'}`,
    `Warning Summary: ${aggregate.warningSummary.length > 0 ? aggregate.warningSummary.join(', ') : 'none'}`,
  ];

  const lines: string[] = [
    'Historical Research Export Batch Review',
    `Files Reviewed: ${aggregate.filesReviewed}`,
    `Valid Files: ${aggregate.validFiles}`,
    `Invalid Files: ${aggregate.invalidFiles}`,
    ...aggregateLines,
  ];

  if (thresholdIssues !== undefined) {
    if (thresholdIssues.length === 0) {
      lines.push('Threshold Checks: passed');
    } else {
      lines.push('Threshold Checks: failed');
      lines.push('Threshold Issues:');
      for (const issue of thresholdIssues) {
        const expected = issue.expected !== undefined ? `, expected ${JSON.stringify(issue.expected)}` : '';
        const actual = issue.actual !== undefined ? `, actual ${JSON.stringify(issue.actual)}` : '';
        lines.push(`- ${issue.code}: ${issue.path} - ${issue.message}${expected}${actual}`);
      }
    }
  }

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    lines.push('');
    lines.push(`File ${i + 1}: ${item.file}`);
    if (item.review.valid) {
      lines.push(formatHistoricalResearchExportReview(item.review.summary as HistoricalResearchExportReviewSummary));
    } else {
      lines.push(formatHistoricalResearchExportValidationIssues(item.review.issues));
    }
  }

  return lines.join('\n');
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
