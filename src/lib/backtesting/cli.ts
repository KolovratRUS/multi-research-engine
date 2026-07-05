import {
  buildMLBFixtures,
  createMLBFixtureProvider,
  getMLBFixtureDateRange,
  type MLBHistoricalFixture,
} from '@/fixtures/backtesting/mlb/fixture-games';
import { orchestrateHistoricalBacktest, HistoricalBacktestOrchestrationError } from '@/lib/backtesting/orchestrator';
import { createLiveMLBHistoricalProvider } from '@/lib/backtesting/mlb/live-history/provider-factory';
import type { LiveMLBHistoricalProviderFactoryOptions } from '@/lib/backtesting/mlb/live-history/provider-factory';
import type { LiveHistoricalProviderStats } from '@/lib/backtesting/mlb/live-history/provider';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type {
  BacktestMetrics,
  BacktestPrediction,
  HistoricalMLBGame,
  MLBHistoricalDataProvider,
} from '@/lib/backtesting/types';
import type {
  MLBHistoricalHttpClient,
  MLBHistoricalHttpClientStats,
  MLBHistoricalCache,
  CacheStats,
} from '@/lib/backtesting/mlb/live-history/types';
import type { RunnerContext } from '@/lib/backtesting/runner';
import type { ConstructionComparison, ModeMetrics, ResearchConstructionReport } from '@/lib/backtesting/types';
import { computeResearchConstructionReport } from '@/lib/backtesting/metrics';
import {
  buildHistoricalResearchExport,
  buildHistoricalResearchExportBatchReviewJson,
  buildHistoricalResearchExportReviewJson,
  buildHistoricalResearchExportReviewSummary,
  formatHistoricalResearchExportBatchReview,
  formatHistoricalResearchExportReview,
  formatHistoricalResearchExportValidationIssues,
  type HistoricalResearchExportBatchReviewItem,
  type HistoricalResearchExportReviewJson,
  type HistoricalResearchExportReviewSummary,
  type HistoricalResearchExportValidationResult,
  HISTORICAL_RESEARCH_EXPORT_REVIEW_VERSION,
  validateHistoricalResearchExportManifest,
} from '@/lib/backtesting/historical-research-export';

function getReadFileErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null) {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return 'Unknown error';
}

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface MLBBacktestCLIOptions {
  readonly source: 'fixture' | 'live';
  readonly startDate?: string;
  readonly endDate?: string;
  readonly date?: string;
  readonly output: 'text' | 'json';
  readonly help: boolean;
  readonly cacheRoot?: string;
  readonly cacheVersion?: string;
  readonly forceRefresh?: boolean;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly capturePregamePitchers?: boolean;
  readonly researchConstruction?: 'FULL' | 'TEAM_ONLY' | 'BOTH';
  readonly exportJson?: string;
  readonly reviewExportJsonPaths?: readonly string[];
}

export interface CLIBacktestCLIError {
  readonly code: string;
  readonly option?: string;
  readonly value?: string;
  readonly message: string;
}

export interface CLIIO {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
}

export interface LiveProviderFactoryResultForCLI {
  readonly provider: MLBHistoricalDataProvider;
  readonly getDiagnostics: () => LiveCLIDiagnostics;
}

export interface LiveCLIDiagnostics {
  readonly provider: LiveHistoricalProviderStats;
  readonly http: MLBHistoricalHttpClientStats;
  readonly cache: CacheStats;
  readonly pregamePitcherCapture?: {
    readonly enabled: boolean;
    readonly observationsConsidered: number;
    readonly observationsWritten: number;
    readonly exactDuplicatesSkipped: number;
    readonly retrospectiveWritesBlocked: number;
    readonly corruptRecords: number;
    readonly warnings: readonly string[];
  };
}

const KNOWN_OPTIONS = new Set([
  'source',
  'start',
  'end',
  'date',
  'output',
  'help',
  'h',
  'cache-root',
  'cache-version',
  'force-refresh',
  'timeout-ms',
  'max-retries',
  'capture-pregame-pitchers',
  'research-construction',
  'export-json',
  'review-export-json',
]);

/* ------------------------------------------------------------------ */
/*  Parser                                                            */
/* ------------------------------------------------------------------ */

export function parseMLBBacktestCLIArgs(
  argv: readonly string[],
): MLBBacktestCLIOptions | CLIBacktestCLIError {
  const state: Record<string, unknown> = {
    source: 'fixture',
    output: 'text',
    help: false,
  };

  const seen = new Set<string>();
  let idx = 0;

  while (idx < argv.length) {
    const rawArg = argv[idx];
    idx += 1;

    if (rawArg === '-h') {
      state.help = true;
      continue;
    }

    if (!rawArg.startsWith('--')) {
      return {
        code: 'UNKNOWN_ARGUMENT',
        option: rawArg,
        message: `Unknown argument: ${rawArg}`,
      };
    }

    const argBody = rawArg.slice(2);
    const equalIndex = argBody.indexOf('=');
    let key: string;
    let value: string | undefined;

    if (equalIndex >= 0) {
      key = argBody.slice(0, equalIndex);
      value = argBody.slice(equalIndex + 1);
    } else {
      key = argBody;
      value = undefined;
    }

    if (!KNOWN_OPTIONS.has(key)) {
      return {
        code: 'UNKNOWN_OPTION',
        option: key,
        message: `Unknown option: --${key}`,
      };
    }

    if (seen.has(key) && key !== 'review-export-json') {
      return {
        code: 'DUPLICATE_OPTION',
        option: key,
        message: `Duplicate option: --${key}`,
      };
    }

    if (key !== 'review-export-json') {
      seen.add(key);
    }

    if (key === 'help') {
      state.help = true;
      continue;
    }

    if (key === 'capture-pregame-pitchers') {
      state.capturePregamePitchers = true;
      continue;
    }

    if (value === undefined && key !== 'force-refresh' && key !== 'capture-pregame-pitchers') {
      if (idx >= argv.length) {
        return {
          code: 'MISSING_VALUE',
          option: key,
          message: `--${key} requires a value`,
        };
      }
      value = argv[idx];
      idx += 1;
    }

    if (key === 'source') {
      if (value !== 'fixture' && value !== 'live') {
        return {
          code: 'INVALID_SOURCE',
          option: key,
          value,
          message: `Invalid source: ${value}. Only 'fixture' and 'live' are supported.`,
        };
      }
      state.source = value;
      continue;
    }

    if (key === 'output') {
      if (value !== 'text' && value !== 'json') {
        return {
          code: 'INVALID_OUTPUT',
          option: key,
          value,
          message: `Invalid output: ${value}. Use 'text' or 'json'.`,
        };
      }
      state.output = value;
      continue;
    }

    if (key === 'date') {
      if (state.startDate || state.endDate) {
        return {
          code: 'CONFLICTING_OPTIONS',
          option: key,
          message: 'Cannot combine --date with --start or --end',
        };
      }
      state.date = value;
      continue;
    }

    if (key === 'start') {
      state.startDate = value;
      continue;
    }

    if (key === 'end') {
      state.endDate = value;
      continue;
    }

    if (key === 'cache-root') {
      if (!value || value.trim() === '') {
        return {
          code: 'INVALID_OPTION',
          option: key,
          value,
          message: 'Invalid --cache-root. Expected a non-empty path.',
        };
      }
      state.cacheRoot = value.trim();
      continue;
    }

    if (key === 'cache-version') {
      if (!value || value.trim() === '') {
        return {
          code: 'INVALID_OPTION',
          option: key,
          value,
          message: 'Invalid --cache-version. Expected a non-empty string.',
        };
      }
      state.cacheVersion = value.trim();
      continue;
    }

    if (key === 'force-refresh') {
      if (value === undefined) {
        if (idx < argv.length && argv[idx] !== undefined) {
          const next = argv[idx];
          if (next === 'true' || next === 'false') {
            value = next;
            idx += 1;
          } else if (next.startsWith('-')) {
            state.forceRefresh = true;
            continue;
          } else {
            return {
              code: 'INVALID_OPTION',
              option: key,
              value: next,
              message: 'Invalid --force-refresh. Expected true or false.',
            };
          }
        } else {
          state.forceRefresh = true;
          continue;
        }
      }
      if (value === 'true' || value === 'false') {
        state.forceRefresh = value === 'true';
        continue;
      }
      return {
        code: 'INVALID_OPTION',
        option: key,
        value,
        message: 'Invalid --force-refresh. Expected true or false.',
      };
    }

    if (key === 'timeout-ms') {
      const num = Number(value);
      if (!Number.isInteger(num) || num <= 0) {
        return {
          code: 'INVALID_OPTION',
          option: key,
          value,
          message: 'Invalid --timeout-ms. Expected a positive integer.',
        };
      }
      state.timeoutMs = num;
      continue;
    }

    if (key === 'max-retries') {
      const num = Number(value);
      if (!Number.isInteger(num) || num < 0) {
        return {
          code: 'INVALID_OPTION',
          option: key,
          value,
          message: 'Invalid --max-retries. Expected a non-negative integer.',
        };
      }
      state.maxRetries = num;
      continue;
    }

    if (key === 'research-construction') {
      if (value !== 'full' && value !== 'team-only' && value !== 'both') {
        return {
          code: 'INVALID_OPTION',
          option: key,
          value,
          message: "Invalid --research-construction. Expected 'full', 'team-only', or 'both'.",
        };
      }
      const mapped =
        value === 'full'
          ? 'FULL'
          : value === 'team-only'
            ? 'TEAM_ONLY'
            : 'BOTH';
      state.researchConstruction = mapped;
      continue;
    }

    if (key === 'export-json') {
      if (!value || value.trim() === '') {
        return {
          code: 'INVALID_OPTION',
          option: key,
          value,
          message: 'Invalid --export-json. Expected a non-empty path.',
        };
      }
      state.exportJson = value.trim();
      continue;
    }

    if (key === 'review-export-json') {
      if (!value || value.trim() === '') {
        return {
          code: 'INVALID_OPTION',
          option: key,
          value,
          message: 'Invalid --review-export-json. Expected a non-empty path.',
        };
      }
      state.reviewExportJsonPaths = [
        ...((state.reviewExportJsonPaths as string[]) ?? []),
        value.trim(),
      ];
      continue;
    }
  }

  if (state.date !== undefined && (state.startDate || state.endDate)) {
    return {
      code: 'CONFLICTING_OPTIONS',
      option: 'date',
      message: 'Cannot combine --date with --start or --end',
    };
  }

  if (state.startDate && !state.endDate) {
    return {
      code: 'MISSING_OPTION',
      option: 'end',
      message: '--start requires --end',
    };
  }

  if (state.endDate && !state.startDate) {
    return {
      code: 'MISSING_OPTION',
      option: 'start',
      message: '--end requires --start',
    };
  }

  return {
    source: state.source as 'fixture' | 'live',
    output: state.output as 'text' | 'json',
    help: state.help as boolean,
    exportJson: state.exportJson as string | undefined,
    ...(state.date !== undefined ? { date: state.date as string } : {}),
    ...(state.startDate !== undefined ? { startDate: state.startDate as string } : {}),
    ...(state.endDate !== undefined ? { endDate: state.endDate as string } : {}),
    ...(state.cacheRoot !== undefined ? { cacheRoot: state.cacheRoot as string } : {}),
    ...(state.cacheVersion !== undefined ? { cacheVersion: state.cacheVersion as string } : {}),
    ...(state.forceRefresh !== undefined ? { forceRefresh: state.forceRefresh as boolean } : {}),
    ...(state.timeoutMs !== undefined ? { timeoutMs: state.timeoutMs as number } : {}),
    ...(state.maxRetries !== undefined ? { maxRetries: state.maxRetries as number } : {}),
    ...(state.capturePregamePitchers !== undefined ? { capturePregamePitchers: state.capturePregamePitchers as boolean } : {}),
    ...(state.researchConstruction !== undefined ? { researchConstruction: state.researchConstruction as 'FULL' | 'TEAM_ONLY' | 'BOTH' } : {}),
    ...(state.exportJson !== undefined ? { exportJson: state.exportJson as string } : {}),
    ...(state.reviewExportJsonPaths !== undefined ? { reviewExportJsonPaths: Object.freeze([...(state.reviewExportJsonPaths as string[])]) as readonly string[] } : {}),
  } satisfies MLBBacktestCLIOptions;
}

/* ------------------------------------------------------------------ */
/*  Help                                                              */
/* ------------------------------------------------------------------ */

function printHelp(stdout: (message: string) => void): void {
  const lines: readonly string[] = [
    'MLB Historical Backtest — CLI',
    '',
    'Usage: npm run backtest:mlb [options]',
    '',
    'Options:',
    '  --source fixture          Run using built-in fixture data (default)',
    '  --source live             Run using live historical MLB Stats API',
    '  --date YYYY-MM-DD         Run for a single date',
    '  --start YYYY-MM-DD        Start of date range (requires --end)',
    '  --end YYYY-MM-DD          End of date range (requires --start)',
    '  --cache-root <path>       Path for live-mode HTTP cache (default: .cache/mlb-history)',
    '  --cache-version <string>  Cache version key (default: v1)',
    '  --force-refresh [true|false] Bypass cache on live requests (default: false)',
    '  --timeout-ms <ms>         HTTP timeout in milliseconds',
    '  --max-retries <n>         Maximum HTTP retry attempts',
    '  --capture-pregame-pitchers  Record MLB probable-pitcher observations (live only)',
    '  --research-construction <mode>  full (default), team-only, or both',
    '  --export-json <path>      Write stable historical research export to file',
    '  --review-export-json <path>  Review a saved historical research export file',
    '  --output text             Human-readable output (default)',
    '  --output json             Machine-readable JSON output',
    '  --help, -h                Show this help',
    '',
    'Live mode requires --date or --start and --end.',
    '',
    'Live mode performs historical research only. Output is unvalidated, uncalibrated, and research-only. No betting action is performed.',
    '',
    'Examples:',
    '  npm run backtest:mlb',
    '  npm run backtest:mlb -- --date 2024-06-01',
    '  npm run backtest:mlb -- --start 2024-06-01 --end 2024-06-03',
    '  npm run backtest:mlb -- --date 2024-06-01 --output json',
    '  npm run backtest:mlb -- --source live --date 2024-06-01 --cache-root /tmp/mlb-cache',
  ];

  for (const line of lines) {
    stdout(line);
  }
}

/* ------------------------------------------------------------------ */
/*  Serialization                                                     */
/* ------------------------------------------------------------------ */

interface SerializedGameForJSON {
  readonly gamePk: number;
  readonly officialDate: string;
  readonly gameDate: string;
  readonly homeTeamId: number;
  readonly awayTeamId: number;
  readonly homeTeamName: string;
  readonly awayTeamName: string;
  readonly venueId: number;
  readonly status: string;
  readonly probablePitchers: { readonly home: unknown; readonly away: unknown } | null;
  readonly cutoff: { readonly eventId: string; readonly cutoffTime: string };
}

interface SerializedPredictionForJSON {
  readonly eventId: string;
  readonly gamePk: number;
  readonly eventDate: string;
  readonly homeTeamId: number;
  readonly awayTeamId: number;
  readonly homeTeam: string;
  readonly awayTeam: string;
  readonly predictedSide: string | null;
  readonly researchStrengthScore: number;
  readonly confidence: number;
  readonly dataQuality: number;
  readonly volatility: string;
  readonly componentScores: Record<string, number>;
  readonly warnings: readonly string[];
  readonly modelVersion: string;
  readonly featureVersion: string;
  readonly generatedAt: string;
  readonly historicalCutoffTime: string;
  readonly actualWinner: string | null;
  readonly correct: boolean | null;
  readonly voided: boolean;
  readonly abstained: boolean;
  readonly abstentionReason?: string;
  readonly homePitcherAvailable: boolean;
  readonly awayPitcherAvailable: boolean;
  readonly researchConstructionMode: string;
  readonly researchModelVersion: string;
  readonly includedEvidenceDomains: readonly string[];
  readonly excludedEvidenceDomains: readonly string[];
}

interface JSONSerializedResult {
  readonly meta: {
    readonly source: 'fixture' | 'live';
    readonly dateRange: { readonly startDate: string; readonly endDate: string };
    readonly validation: 'unvalidated';
    readonly calibration: 'uncalibrated';
  };
  readonly orchestration: {
    readonly requestedDates: readonly string[];
    readonly scheduleRequests: number;
    readonly discoveredGames: number;
    readonly uniqueGames: number;
    readonly duplicateGamesRemoved: number;
    readonly firstGameStart: string | null;
    readonly lastGameStart: string | null;
    readonly games: readonly SerializedGameForJSON[];
  };
  readonly runner: {
    readonly predictionsMade: number;
    readonly abstentions: number;
    readonly voids: number;
    readonly accuracy: number | null;
    readonly naiveHomeBaseline: number | null;
    readonly naiveRecentBaseline: number | null;
    readonly naiveSeasonBaseline: number | null;
    readonly accuracyWithBothPitchersKnown: number | null;
    readonly accuracyWithMissingPitcher: number | null;
    readonly averageDataQuality: number | null;
    readonly warningCount: number;
    readonly researchConstruction: {
      readonly fullResearchAttempts: number;
      readonly fullResearchProduced: number;
      readonly fullResearchAbstained: number;
      readonly teamOnlyResearchAttempts: number;
      readonly teamOnlyResearchProduced: number;
      readonly teamOnlyResearchAbstained: number;
      readonly comparison?: ResearchConstructionReport;
    };
  };
  readonly predictions: readonly SerializedPredictionForJSON[];
  readonly abstentions: readonly SerializedPredictionForJSON[];
}

function serializeGameForJSON(
  game: {
    readonly gamePk: number;
    readonly officialDate: string;
    readonly gameDate: Date;
    readonly homeTeamId: number;
    readonly awayTeamId: number;
    readonly homeTeamName: string;
    readonly awayTeamName: string;
    readonly venueId: number;
    readonly status: string;
    readonly probablePitchers: { readonly home: unknown; readonly away: unknown } | null;
    readonly cutoff: { readonly eventId: string; readonly cutoffTime: Date };
  },
): SerializedGameForJSON {
  return {
    gamePk: game.gamePk,
    officialDate: game.officialDate,
    gameDate: game.gameDate.toISOString(),
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    homeTeamName: game.homeTeamName,
    awayTeamName: game.awayTeamName,
    venueId: game.venueId,
    status: game.status,
    probablePitchers: game.probablePitchers,
    cutoff: {
      eventId: game.cutoff.eventId,
      cutoffTime: game.cutoff.cutoffTime.toISOString(),
    },
  };
}

function serializePredictionForJSON(
  prediction: {
    readonly eventId: string;
    readonly gamePk: number;
    readonly eventDate: string;
    readonly homeTeamId: number;
    readonly awayTeamId: number;
    readonly homeTeam: string;
    readonly awayTeam: string;
    readonly predictedSide: string | null;
    readonly researchStrengthScore: number;
    readonly confidence: number;
    readonly dataQuality: number;
    readonly volatility: string;
    readonly componentScores: Record<string, number>;
    readonly warnings: readonly string[];
    readonly modelVersion: string;
    readonly featureVersion: string;
    readonly generatedAt: Date;
    readonly historicalCutoffTime: Date;
    readonly actualWinner: string | null;
    readonly correct: boolean | null;
    readonly voided: boolean;
    readonly abstained: boolean;
    readonly abstentionReason?: string;
    readonly homePitcherAvailable: boolean;
    readonly awayPitcherAvailable: boolean;
    readonly researchConstructionMode: string;
    readonly researchModelVersion: string;
    readonly includedEvidenceDomains: readonly string[];
    readonly excludedEvidenceDomains: readonly string[];
  },
): SerializedPredictionForJSON {
  return {
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
    componentScores: prediction.componentScores,
    warnings: prediction.warnings,
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
    includedEvidenceDomains: prediction.includedEvidenceDomains,
    excludedEvidenceDomains: prediction.excludedEvidenceDomains,
  };
}

interface SerializableResultInput {
  readonly runnerResult: Readonly<{
    readonly predictions: readonly BacktestPrediction[];
    readonly abstentions: readonly BacktestPrediction[];
    readonly metrics: BacktestMetrics;
  }>;
  readonly dateRange: { readonly startDate: string; readonly endDate: string };
  readonly requestedDates: readonly string[];
  readonly scheduleRequests: number;
  readonly discoveredGames: number;
  readonly uniqueGames: number;
  readonly duplicateGamesRemoved: number;
  readonly firstGameStart: Date | null;
  readonly lastGameStart: Date | null;
  readonly games: readonly HistoricalMLBGame[];
}

function formatNullable(value: number | null, digits = 1): string {
  return value !== null ? value.toFixed(digits) : 'n/a';
}

function formatNullablePercent(value: number | null): string {
  return value !== null ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

function countWarnings(
  predictions: readonly { readonly warnings: readonly string[] }[],
  abstentions: readonly { readonly warnings: readonly string[] }[],
): number {
  return (
    predictions.reduce((sum, item) => sum + item.warnings.length, 0) +
    abstentions.reduce((sum, item) => sum + item.warnings.length, 0)
  );
}

function buildResearchConstructionDiagnostics(
  result: Readonly<{ readonly predictions: readonly BacktestPrediction[]; readonly abstentions: readonly BacktestPrediction[] }>,
): {
  readonly fullResearchAttempts: number;
  readonly fullResearchProduced: number;
  readonly fullResearchAbstained: number;
  readonly teamOnlyResearchAttempts: number;
  readonly teamOnlyResearchProduced: number;
  readonly teamOnlyResearchAbstained: number;
  readonly comparison?: ResearchConstructionReport;
} {
  const fullPredictions = result.predictions.filter((p) => p.researchConstructionMode === 'FULL' && !p.abstained);
  const teamOnlyPredictions = result.predictions.filter((p) => p.researchConstructionMode === 'TEAM_ONLY' && !p.abstained);
  const fullAbstentions = result.abstentions.filter((p) => p.researchConstructionMode === 'FULL');
  const teamOnlyAbstentions = result.abstentions.filter((p) => p.researchConstructionMode === 'TEAM_ONLY');

  return {
    fullResearchAttempts:
      result.predictions.filter((p) => p.researchConstructionMode === 'FULL').length +
      result.abstentions.filter((p) => p.researchConstructionMode === 'FULL').length,
    fullResearchProduced: fullPredictions.length,
    fullResearchAbstained: fullAbstentions.length,
    teamOnlyResearchAttempts:
      result.predictions.filter((p) => p.researchConstructionMode === 'TEAM_ONLY').length +
      result.abstentions.filter((p) => p.researchConstructionMode === 'TEAM_ONLY').length,
    teamOnlyResearchProduced: teamOnlyPredictions.length,
    teamOnlyResearchAbstained: teamOnlyAbstentions.length,
    comparison: computeResearchConstructionReport(result.predictions, result.abstentions),
  };
}

function serializeJSONResult(
  result: SerializableResultInput,
  source: 'fixture' | 'live',
  diagnostics?: LiveCLIDiagnostics,
  researchConstruction?: 'FULL' | 'TEAM_ONLY' | 'BOTH',
): JSONSerializedResult {
  const predictions = result.runnerResult.predictions;
  const abstentions = result.runnerResult.abstentions;
  const metrics = result.runnerResult.metrics;
  const predictionsMade = predictions.filter((p: { readonly voided: boolean; readonly abstained: boolean }) => !p.voided && !p.abstained).length;
  const avgDataQuality =
    predictions.length > 0
      ? predictions.reduce((sum: number, p: { readonly dataQuality: number }) => sum + p.dataQuality, 0) / predictions.length
      : null;
  const warningCount = countWarnings(predictions, abstentions);

  const researchDiagnostics = buildResearchConstructionDiagnostics(result.runnerResult);
  return {
    meta: {
      source,
      dateRange: { startDate: result.dateRange.startDate, endDate: result.dateRange.endDate },
      validation: 'unvalidated',
      calibration: 'uncalibrated',
    },
    orchestration: {
      requestedDates: result.requestedDates,
      scheduleRequests: result.scheduleRequests,
      discoveredGames: result.discoveredGames,
      uniqueGames: result.uniqueGames,
      duplicateGamesRemoved: result.duplicateGamesRemoved,
      firstGameStart: result.firstGameStart?.toISOString() ?? null,
      lastGameStart: result.lastGameStart?.toISOString() ?? null,
      games: result.games.map(serializeGameForJSON),
    },
    runner: {
      predictionsMade,
      abstentions: abstentions.length,
      voids: predictions.filter((p: { readonly voided: boolean }) => p.voided).length,
      accuracy: metrics.accuracy,
      naiveHomeBaseline: metrics.naiveHomeBaseline,
      naiveRecentBaseline: metrics.naiveRecentBaseline,
      naiveSeasonBaseline: metrics.naiveSeasonBaseline,
      accuracyWithBothPitchersKnown: metrics.accuracyWithBothPitchersKnown,
      accuracyWithMissingPitcher: metrics.accuracyWithMissingPitcher,
      averageDataQuality: avgDataQuality,
      warningCount,
      researchConstruction: (() => {
        const { comparison, ...rest } = researchDiagnostics;
        return researchConstruction === 'BOTH' && comparison ? { ...rest, comparison } : { ...rest };
      })(),
    },
    ...(source === 'live' && diagnostics ? { provider: diagnostics.provider } : {}),
    ...(source === 'live' && diagnostics ? { http: diagnostics.http } : {}),
    ...(source === 'live' && diagnostics ? { cache: diagnostics.cache } : {}),
    predictions: predictions.map(serializePredictionForJSON),
    abstentions: abstentions.map(serializePredictionForJSON),
  };
}

/* ------------------------------------------------------------------ */
/*  Text output                                                       */
/* ------------------------------------------------------------------ */

function printTextResult(
  result: SerializableResultInput,
  source: 'fixture' | 'live',
  diagnostics?: LiveCLIDiagnostics,
  researchConstruction?: 'FULL' | 'TEAM_ONLY' | 'BOTH',
): string {
  const predictions = result.runnerResult.predictions;
  const abstentions = result.runnerResult.abstentions;
  const metrics = result.runnerResult.metrics;
  const predictionsMade = predictions.filter((p: { readonly voided: boolean; readonly abstained: boolean }) => !p.voided && !p.abstained).length;
  const knownIneligible = abstentions.filter((p: { readonly abstentionReason?: string }) => p.abstentionReason === 'GAME_NOT_ELIGIBLE').length;
  const postPredictionVoids = predictions.filter((p: { readonly voided: boolean }) => p.voided).length;
  const avgDataQuality =
    predictions.length > 0
      ? predictions.reduce((sum: number, p: { readonly dataQuality: number }) => sum + p.dataQuality, 0) / predictions.length
      : 0;
  const warningCount = countWarnings(predictions, abstentions);

  const header =
    source === 'live'
      ? 'MLB Historical Backtest — Live Historical Mode (Phase 1C, exploratory / unvalidated / uncalibrated / research-only)'
      : 'MLB Historical Backtest — Fixture Mode (Phase 1C, exploratory / unvalidated / uncalibrated / research-only)';
  const sourceLabel =
    source === 'live'
      ? 'Source: live (historical MLB Stats API)'
      : 'Source: fixture (deterministic, no internet)';

  const lines: string[] = [
    header,
    `Date range: ${result.dateRange.startDate} to ${result.dateRange.endDate}`,
    `Score version: exploratory-unvalidated-v1`,
    sourceLabel,
    'Validation: unvalidated, uncalibrated, research-only',
    '',
    'Orchestration',
    `  Schedule requests: ${result.scheduleRequests}`,
    `  Discovered games: ${result.discoveredGames}`,
    `  Unique games: ${result.uniqueGames}`,
    `  Duplicate games removed: ${result.duplicateGamesRemoved}`,
    `  First game: ${result.firstGameStart?.toISOString() ?? 'n/a'}`,
    `  Last game: ${result.lastGameStart?.toISOString() ?? 'n/a'}`,
    '',
    'Runner',
    `  Predictions made: ${predictionsMade}`,
    `  Abstentions: ${abstentions.length}`,
    `  Known-ineligible games: ${knownIneligible}`,
    `  Post-prediction voids: ${postPredictionVoids}`,
    `  Accuracy: ${metrics.accuracy.toFixed(3)}`,
    `  Always-home baseline: ${metrics.naiveHomeBaseline?.toFixed(3) ?? 'n/a'}`,
    `  Recent-record baseline: ${metrics.naiveRecentBaseline?.toFixed(3) ?? 'n/a'}`,
    `  Season-record baseline: ${metrics.naiveSeasonBaseline?.toFixed(3) ?? 'n/a'}`,
    `  Both-pitchers-known accuracy: ${metrics.accuracyWithBothPitchersKnown?.toFixed(3) ?? 'n/a'}`,
    `  Missing-pitcher accuracy: ${metrics.accuracyWithMissingPitcher?.toFixed(3) ?? 'n/a'}`,
    '',
    'Quality',
    `  Average data quality: ${avgDataQuality.toFixed(1)}`,
    `  Warning count: ${warningCount}`,
    '',
    'Research Construction',
    `  Mode: ${result.requestedDates.length > 0 ? (researchConstruction ?? 'full') : 'n/a'}`,
  ];

  const researchDiagnostics = buildResearchConstructionDiagnostics(result.runnerResult);
  if (researchDiagnostics.fullResearchAttempts > 0 || researchDiagnostics.teamOnlyResearchAttempts > 0) {
    lines.push(
      `  Full attempts: ${researchDiagnostics.fullResearchAttempts}, produced: ${researchDiagnostics.fullResearchProduced}, abstained: ${researchDiagnostics.fullResearchAbstained}`,
    );
    lines.push(
      `  Team-only attempts: ${researchDiagnostics.teamOnlyResearchAttempts}, produced: ${researchDiagnostics.teamOnlyResearchProduced}, abstained: ${researchDiagnostics.teamOnlyResearchAbstained}`,
    );
  }

  if (researchConstruction === 'BOTH' && researchDiagnostics.comparison) {
    const comp = researchDiagnostics.comparison;
    lines.push('');
    lines.push('Research Construction Comparison');
    lines.push(
      `  Paired: both produced=${comp.paired.bothProduced}, both abstained=${comp.paired.bothAbstained}, full-only produced=${comp.paired.fullOnlyProduced}, team-only-only produced=${comp.paired.teamOnlyOnlyProduced}, same-side=${comp.paired.sameSide}, different-side=${comp.paired.differentSide}`,
    );
    lines.push(
      `  VOLATILITY FULL: LOW=${comp.volatilityCounts.full.LOW}, MEDIUM=${comp.volatilityCounts.full.MEDIUM}, HIGH=${comp.volatilityCounts.full.HIGH}, TEAM_ONLY: LOW=${comp.volatilityCounts.teamOnly.LOW}, MEDIUM=${comp.volatilityCounts.teamOnly.MEDIUM}, HIGH=${comp.volatilityCounts.teamOnly.HIGH}`,
    );
    lines.push(
      `  WARNINGS: total=${comp.warningCounts.total}, full=${comp.warningCounts.full}, team-only=${comp.warningCounts.teamOnly}`,
    );
    lines.push(
      `  SCORES: full avg strength=${formatNullable(comp.scoreComparison.full.averageResearchStrengthScore)}, confidence=${formatNullable(comp.scoreComparison.full.averageConfidence)}, dataQuality=${formatNullable(comp.scoreComparison.full.averageDataQuality)}`,
    );
    lines.push(
      `         team-only avg strength=${formatNullable(comp.scoreComparison.teamOnly.averageResearchStrengthScore)}, confidence=${formatNullable(comp.scoreComparison.teamOnly.averageConfidence)}, dataQuality=${formatNullable(comp.scoreComparison.teamOnly.averageDataQuality)}`,
    );
  }

  if (source === 'live' && diagnostics) {
    lines.push(
      '',
      `Provider calls: ${diagnostics.provider.scheduleRequests} schedule, ${diagnostics.provider.teamSourceRequests} team source, ${diagnostics.provider.pitcherSourceRequests} pitcher source, ${diagnostics.provider.outcomeRequests} outcome`,
    );
    lines.push(
      `HTTP: ${diagnostics.http.logicalRequests} logical requests, ${diagnostics.http.fetchAttempts} fetch attempts, ${diagnostics.http.retries} retries`,
    );
    lines.push(
      `HTTP outcomes: ${diagnostics.http.successfulResponses} successful, ${diagnostics.http.httpFailures} HTTP failures, ${diagnostics.http.transportFailures} transport failures, ${diagnostics.http.timeouts} timeouts, ${diagnostics.http.parseFailures} parse failures, ${diagnostics.http.schemaFailures} schema failures`,
    );
    lines.push(
      `Cache: ${diagnostics.cache.hits} hits, ${diagnostics.cache.misses} misses, ${diagnostics.cache.writes} writes, ${diagnostics.cache.corruptions} corruptions, ${diagnostics.cache.versionMismatches} version mismatches`,
    );
  }

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/*  Runner                                                            */
/* ------------------------------------------------------------------ */

export function createLiveProviderForCLI(
  options: LiveMLBHistoricalProviderFactoryOptions,
): LiveProviderFactoryResultForCLI {
  const result = createLiveMLBHistoricalProvider(options);

  return {
    provider: result.provider,
    getDiagnostics: () => {
      const providerStats = result.provider.stats();

      return {
        provider: providerStats,
        http: result.client.getStats(),
        cache: result.cache.stats(),
        ...(providerStats.pregamePitcherCapture
          ? {
              pregamePitcherCapture:
                providerStats.pregamePitcherCapture,
            }
          : {}),
      };
    },
  };
}

export interface MLBBacktestCLIDependencies {
  readonly orchestrate?: typeof orchestrateHistoricalBacktest;
  readonly buildFixture?: typeof buildMLBFixtures;
  readonly now?: () => Date;
  readonly liveFetchImpl?: typeof fetch;
  readonly createLiveProvider?: (
    options: LiveMLBHistoricalProviderFactoryOptions,
  ) => LiveProviderFactoryResultForCLI;
}

export async function runMLBBacktestCLI(
  argv: readonly string[],
  io?: CLIIO,
  dependencies: MLBBacktestCLIDependencies = {},
): Promise<number> {
  const stdout = io?.stdout ?? ((message: string) => process.stdout.write(`${message}\n`));
  const stderr = io?.stderr ?? ((message: string) => process.stderr.write(`${message}\n`));

  const orchestrate = dependencies.orchestrate ?? orchestrateHistoricalBacktest;
  const buildFixture = dependencies.buildFixture ?? buildMLBFixtures;
  const createLiveProvider =
    dependencies.createLiveProvider ?? createLiveProviderForCLI;
  const injectNow = dependencies.now;

  const parsed = parseMLBBacktestCLIArgs(argv);
  if ('code' in parsed) {
    stderr(parsed.message);
    return 1;
  }

  if (parsed.help) {
    printHelp(stdout);
    return 0;
  }

  if (parsed.source === 'live' && !parsed.date && !(parsed.startDate && parsed.endDate)) {
    stderr('Live mode requires --date or --start and --end.');
    return 1;
  }
  if (parsed.capturePregamePitchers && parsed.source !== 'live') {
    stderr('--capture-pregame-pitchers requires --source live.');
    return 1;
  }

  if (parsed.reviewExportJsonPaths?.length) {
    if (parsed.exportJson) {
      stderr('Cannot combine --review-export-json with --export-json.');
      return 1;
    }
    if (parsed.source === 'live') {
      stderr('Review mode does not support --source live.');
      return 1;
    }
    if (parsed.date || parsed.startDate || parsed.endDate) {
      stderr('Review mode does not accept date options.');
      return 1;
    }
    if (
      parsed.cacheRoot ||
      parsed.cacheVersion ||
      parsed.forceRefresh ||
      parsed.timeoutMs ||
      parsed.maxRetries ||
      parsed.capturePregamePitchers ||
      parsed.researchConstruction
    ) {
      stderr('Review mode does not accept backtest options.');
      return 1;
    }

    const paths = parsed.reviewExportJsonPaths;
    const singleFile = paths.length === 1;
    let anyInvalid = false;
    const items: HistoricalResearchExportBatchReviewItem[] = [];

    for (const rawPath of paths) {
      let validation: HistoricalResearchExportValidationResult;
      let parsedFile: unknown;
      let summary: HistoricalResearchExportReviewSummary | null = null;

      try {
        const content = await fs.readFile(rawPath, 'utf-8');
        parsedFile = JSON.parse(content);
        validation = validateHistoricalResearchExportManifest(parsedFile);
      } catch (error) {
        const caught = error as unknown;
        let issueCode = 'EXPORT_REVIEW_UNKNOWN_ERROR';
        let issueMessage = 'Unknown error during review';

        if (caught instanceof SyntaxError) {
          issueCode = 'INVALID_JSON_IN_EXPORT_FILE';
          issueMessage = `Invalid JSON in export file: ${caught.message}`;
        } else if (typeof caught === 'object' && caught !== null && typeof (caught as { code?: unknown }).code === 'string') {
          const code = (caught as { code: string }).code;
          if (code === 'ENOENT') {
            issueCode = 'EXPORT_REVIEW_FILE_NOT_FOUND';
            issueMessage = `Export file not found: ${rawPath}`;
          } else {
            issueMessage = `Failed to read export file: ${getReadFileErrorMessage(caught)}`;
          }
        } else if (caught instanceof Error) {
          issueMessage = `Historical Research Export Review Failed: ${caught.message}`;
        }

        validation = {
          valid: false,
          issues: [
            {
              code: issueCode,
              path: 'file',
              message: issueMessage,
            },
          ],
        };
      }

      if (validation.valid) {
        summary = buildHistoricalResearchExportReviewSummary(parsedFile) ?? null;
      }

      const review: HistoricalResearchExportReviewJson = {
        reviewVersion: HISTORICAL_RESEARCH_EXPORT_REVIEW_VERSION,
        valid: summary !== null && validation.issues.length === 0,
        summary: summary ?? null,
        issues: Object.freeze([...validation.issues]),
      };

      items.push({ file: rawPath, review });

      if (!review.valid) {
        anyInvalid = true;
      }
    }

    if (singleFile) {
      const only = items[0];
      if (only.review.valid) {
        if (parsed.output === 'json') {
          const payload = buildHistoricalResearchExportReviewJson(
            only.review.summary as HistoricalResearchExportReviewSummary,
            only.review.issues,
          );
          stdout(`${JSON.stringify(payload, null, 2)}\n`);
          return 0;
        }

        stdout(formatHistoricalResearchExportReview(only.review.summary as HistoricalResearchExportReviewSummary));
        return 0;
      }

      if (parsed.output === 'json') {
        const payload = buildHistoricalResearchExportReviewJson(only.review.summary, only.review.issues);
        stdout(`${JSON.stringify(payload, null, 2)}\n`);
        return 1;
      }

      stderr(formatHistoricalResearchExportValidationIssues(only.review.issues));
      return 1;
    }

    if (parsed.output === 'json') {
      const payload = buildHistoricalResearchExportBatchReviewJson(items);
      stdout(`${JSON.stringify(payload, null, 2)}\n`);
      return anyInvalid ? 1 : 0;
    }

    stdout(formatHistoricalResearchExportBatchReview(items));
    stderr('');
    return anyInvalid ? 1 : 0;
  }

  let provider: MLBHistoricalDataProvider;
  let fixture: MLBHistoricalFixture | undefined;
  let startDate = '';
  let endDate = '';
  let liveResult: LiveProviderFactoryResultForCLI | undefined;

  if (parsed.source === 'fixture') {
    fixture = buildFixture();
    provider = createMLBFixtureProvider(fixture);

    if (parsed.date) {
      startDate = parsed.date;
      endDate = parsed.date;
    } else if (parsed.startDate && parsed.endDate) {
      startDate = parsed.startDate;
      endDate = parsed.endDate;
    } else {
      const range = getMLBFixtureDateRange(fixture);
      startDate = range.startDate;
      endDate = range.endDate;
    }
  } else {
    const cacheRoot = parsed.cacheRoot ?? path.resolve(process.cwd(), '.cache/mlb-history');
    const cacheVersion = parsed.cacheVersion ?? 'v1';

    const providerFactoryOptions: LiveMLBHistoricalProviderFactoryOptions = {
      cacheRoot,
      cacheVersion,
      ...(parsed.forceRefresh !== undefined ? { forceRefresh: parsed.forceRefresh } : {}),
      ...(parsed.timeoutMs !== undefined ? { timeoutMs: parsed.timeoutMs } : {}),
      ...(parsed.maxRetries !== undefined ? { maxRetries: parsed.maxRetries } : {}),
      ...(injectNow ? { now: injectNow } : {}),
      ...(dependencies.liveFetchImpl ? { fetchImpl: dependencies.liveFetchImpl } : {}),
      ...(parsed.capturePregamePitchers === true ? { capturePregamePitchers: true } : {}),
    };

    liveResult = createLiveProvider(providerFactoryOptions);
    provider = liveResult.provider;

    if (parsed.date) {
      startDate = parsed.date;
      endDate = parsed.date;
    } else if (parsed.startDate && parsed.endDate) {
      startDate = parsed.startDate;
      endDate = parsed.endDate;
    }
  }

  const context: RunnerContext = {
    provider,
    deterministicTime: injectNow?.() ?? new Date(),
    featureVersion: 'exploratory-unvalidated-v1',
    modelVersion: 'exploratory-unvalidated-v1',
    researchConstruction: parsed.researchConstruction,
    naiveBaselineContext: {
      recentWinRates: parsed.source === 'live' ? {} : fixture!.recentWinRates,
      seasonWinRates: parsed.source === 'live' ? {} : fixture!.seasonWinRates,
    },
  };

  try {
    const result = await orchestrate(
      { startDate, endDate },
      context,
    );

    let diagnostics: LiveCLIDiagnostics | undefined;
    if (liveResult) {
      diagnostics = liveResult.getDiagnostics();
    }

    const exportComparison =
      parsed.researchConstruction === 'BOTH'
        ? computeResearchConstructionReport(
            result.runnerResult.predictions,
            result.runnerResult.abstentions,
          )
        : undefined;

    const exportPayload = buildHistoricalResearchExport({
      orchestrationResult: result,
      researchConstruction: parsed.researchConstruction ?? 'FULL',
      source: parsed.source,
      generatedAt: injectNow?.() ?? new Date(),
      comparison: exportComparison,
    });

    if (parsed.exportJson) {
      const resolvedPath = path.resolve(parsed.exportJson);
      const exportDir = path.dirname(resolvedPath);
      const exportDirStat = await fs.stat(exportDir);
      if (!exportDirStat.isDirectory()) {
        throw new Error(`Export parent path is not a directory: ${exportDir}`);
      }
      await fs.writeFile(resolvedPath, `${JSON.stringify(exportPayload, null, 2)}\n`, 'utf-8');
    }

    if (parsed.output === 'json') {
      stdout(JSON.stringify(serializeJSONResult(result, parsed.source, diagnostics, parsed.researchConstruction), null, 2));
    } else {
      stdout(printTextResult(result, parsed.source, diagnostics, parsed.researchConstruction));
    }

    return 0;
  } catch (error) {
    if (error instanceof HistoricalBacktestOrchestrationError) {
      stderr(`Orchestration failed: ${error.message}`);
    } else if (error instanceof Error) {
      stderr(`Backtest failed: ${error.message}`);
    } else {
      stderr(`Backtest failed: ${String(error)}`);
    }
    return 1;
  }
}