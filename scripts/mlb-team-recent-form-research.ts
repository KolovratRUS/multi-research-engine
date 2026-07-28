import { readFileSync } from 'node:fs';
import { buildMLBFixtures } from '../src/fixtures/backtesting/mlb/fixture-games';
import type { HistoricalMLBGame } from '../src/lib/backtesting/types';
import {
  buildMLBResearchReportFromPackage,
  assertReportSafeForDisplay,
} from '../src/prospective/mlb/research-report-adapter';
import {
  renderMLBResearchReport,
  assertRendererOutputSafeForDisplay,
} from '../src/prospective/mlb/research-report-renderer';
import {
  TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES,
  TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION,
  TEAM_FORM_EVIDENCE_TARGET_GAME_EXCLUDED,
  TEAM_FORM_EVIDENCE_FUTURE_GAME_EXCLUDED,
  TEAM_FORM_EVIDENCE_PITCHER_FIELDS_EXCLUDED,
  TEAM_FORM_EVIDENCE_FORBIDDEN_FIELD_EXCLUDED,
  TEAM_FORM_EVIDENCE_INVALID_TARGET,
  type TeamRecentFormEvidenceRecord,
  type TeamRecentFormEvidenceTarget,
  buildMLBTeamRecentFormFixtureEvidence,
} from '../src/prospective/mlb/team-recent-form-fixture-evidence';
import {
  buildMLBTeamRecentFormResearchPackage,
  type MLBTeamRecentFormConstructionPackage,
  validateMLBTeamRecentFormConstructionPackage,
  validateResultAggregateMetricsModeFlags,
  TEAM_FORM_RESEARCH_RESULT_AGGREGATE_METRICS_NOT_ENABLED,
  TEAM_FORM_RESEARCH_RESULT_AGGREGATE_METRICS_REQUIRES_AGGREGATE_SUMMARIES,
  TEAM_FORM_RESEARCH_AGGREGATE_SUMMARIES_NOT_ENABLED,
} from '../src/prospective/mlb/team-recent-form-research';
import {
  buildTeamScheduleContext,
  TEAM_SCHEDULE_CONTEXT_NOT_ENABLED,
  TEAM_SCHEDULE_CONTEXT_REQUIRES_FIXTURE_EVIDENCE,
  validateScheduleContextModeFlags,
  type TeamScheduleContextRecord,
} from '../src/prospective/mlb/team-schedule-context';
import {
  type TeamQualityContextInputRecord,
  buildTeamQualityContext,
  validateTeamQualityContextModeFlags,
  TEAM_QUALITY_CONTEXT_REQUIRES_FIXTURE_EVIDENCE,
} from '../src/prospective/mlb/team-quality-context';

const USAGE = 'npm run prospective:mlb:research-team-form -- <construction-package-json> [--fixture-evidence-local] [--aggregate-summaries-local] [--result-aggregate-metrics-local] [--team-schedule-context-local] [--team-quality-context-local] [--report-preview-local]';

type ArgumentError =
  | 'TEAM_FORM_RESEARCH_PATH_REQUIRED'
  | 'TEAM_FORM_RESEARCH_SINGLE_PATH_ONLY'
  | 'TEAM_FORM_RESEARCH_UNKNOWN_ARGUMENT'
  | 'TEAM_FORM_RESEARCH_AGGREGATE_SUMMARIES_NOT_ENABLED'
  | 'TEAM_FORM_RESEARCH_RESULT_AGGREGATE_METRICS_NOT_ENABLED'
  | 'TEAM_FORM_RESEARCH_RESULT_AGGREGATE_METRICS_REQUIRES_AGGREGATE_SUMMARIES'
  | 'TEAM_SCHEDULE_CONTEXT_NOT_ENABLED'
  | 'TEAM_SCHEDULE_CONTEXT_REQUIRES_FIXTURE_EVIDENCE'
  | 'TEAM_QUALITY_CONTEXT_REQUIRES_FIXTURE_EVIDENCE'
  | 'REPORT_PREVIEW_REQUIRES_FIXTURE_EVIDENCE';

interface ParsedArguments {
  readonly path: string;
  readonly fixtureEvidenceLocal: boolean;
  readonly aggregateSummariesLocal: boolean;
  readonly resultAggregateMetricsLocal: boolean;
  readonly teamScheduleContextLocal: boolean;
  readonly teamQualityContextLocal: boolean;
  readonly reportPreviewLocal: boolean;
  readonly error: ArgumentError | null;
}

const ALLOWED_FLAGS = new Set([
  '--fixture-evidence-local',
  '--aggregate-summaries-local',
  '--result-aggregate-metrics-local',
  '--team-schedule-context-local',
  '--team-quality-context-local',
  '--report-preview-local',
]);

function parseArguments(argv: string[]): ParsedArguments {
  const args = argv.slice(2);
  const positionalPaths: string[] = [];
  let fixtureEvidenceLocal = false;
  let aggregateSummariesLocal = false;
  let resultAggregateMetricsLocal = false;
  let teamScheduleContextLocal = false;
  let teamQualityContextLocal = false;
  let reportPreviewLocal = false;

  for (const argument of args) {
    if (argument.startsWith('-')) {
      if (ALLOWED_FLAGS.has(argument)) {
        if (argument === '--fixture-evidence-local') {
          fixtureEvidenceLocal = true;
        }
        if (argument === '--aggregate-summaries-local') {
          aggregateSummariesLocal = true;
        }
        if (argument === '--result-aggregate-metrics-local') {
          resultAggregateMetricsLocal = true;
        }
        if (argument === '--team-schedule-context-local') {
          teamScheduleContextLocal = true;
        }
        if (argument === '--team-quality-context-local') {
          teamQualityContextLocal = true;
        }
        if (argument === '--report-preview-local') {
          reportPreviewLocal = true;
        }
        continue;
      }
      return {
        path: '',
        fixtureEvidenceLocal: false,
        aggregateSummariesLocal: false,
        resultAggregateMetricsLocal: false,
        teamScheduleContextLocal: false,
        teamQualityContextLocal: false,
        reportPreviewLocal: false,
        error: 'TEAM_FORM_RESEARCH_UNKNOWN_ARGUMENT',
      };
    }
    positionalPaths.push(argument);
  }

  if (positionalPaths.length === 0) {
    return {
      path: '',
      fixtureEvidenceLocal: false,
      aggregateSummariesLocal: false,
      resultAggregateMetricsLocal: false,
      teamScheduleContextLocal: false,
      teamQualityContextLocal: false,
      reportPreviewLocal: false,
      error: 'TEAM_FORM_RESEARCH_PATH_REQUIRED',
    };
  }
  if (positionalPaths.length > 1) {
    return {
      path: '',
      fixtureEvidenceLocal,
      aggregateSummariesLocal,
      resultAggregateMetricsLocal,
      teamScheduleContextLocal,
      teamQualityContextLocal,
      reportPreviewLocal,
      error: 'TEAM_FORM_RESEARCH_SINGLE_PATH_ONLY',
    };
  }

  const resultModeError = validateResultAggregateMetricsModeFlags({
    fixtureEvidenceLocal,
    aggregateSummariesLocal,
    resultAggregateMetricsLocal,
  });
  if (resultModeError === TEAM_FORM_RESEARCH_RESULT_AGGREGATE_METRICS_NOT_ENABLED) {
    return {
      path: '',
      fixtureEvidenceLocal: false,
      aggregateSummariesLocal: false,
      resultAggregateMetricsLocal: false,
      teamScheduleContextLocal: false,
      teamQualityContextLocal: false,
      reportPreviewLocal: false,
      error: 'TEAM_FORM_RESEARCH_RESULT_AGGREGATE_METRICS_NOT_ENABLED',
    };
  }
  if (resultModeError === TEAM_FORM_RESEARCH_RESULT_AGGREGATE_METRICS_REQUIRES_AGGREGATE_SUMMARIES) {
    return {
      path: '',
      fixtureEvidenceLocal: false,
      aggregateSummariesLocal: false,
      resultAggregateMetricsLocal: false,
      teamScheduleContextLocal: false,
      teamQualityContextLocal: false,
      reportPreviewLocal: false,
      error: 'TEAM_FORM_RESEARCH_RESULT_AGGREGATE_METRICS_REQUIRES_AGGREGATE_SUMMARIES',
    };
  }

  if (aggregateSummariesLocal && !fixtureEvidenceLocal) {
    return {
      path: '',
      fixtureEvidenceLocal: false,
      aggregateSummariesLocal: false,
      resultAggregateMetricsLocal: false,
      teamScheduleContextLocal: false,
      teamQualityContextLocal: false,
      reportPreviewLocal: false,
      error: TEAM_FORM_RESEARCH_AGGREGATE_SUMMARIES_NOT_ENABLED,
    };
  }

  const scheduleContextModeError = validateScheduleContextModeFlags({
    fixtureEvidenceLocal,
    teamScheduleContextLocal,
  });
  if (scheduleContextModeError === TEAM_SCHEDULE_CONTEXT_REQUIRES_FIXTURE_EVIDENCE) {
    return {
      path: '',
      fixtureEvidenceLocal: false,
      aggregateSummariesLocal: false,
      resultAggregateMetricsLocal: false,
      teamScheduleContextLocal: false,
      teamQualityContextLocal: false,
      reportPreviewLocal: false,
      error: 'TEAM_SCHEDULE_CONTEXT_REQUIRES_FIXTURE_EVIDENCE',
    };
  }

  const qualityContextModeError = validateTeamQualityContextModeFlags({
    fixtureEvidenceLocal,
    teamQualityContextLocal,
  });
  if (qualityContextModeError === TEAM_QUALITY_CONTEXT_REQUIRES_FIXTURE_EVIDENCE) {
    return {
      path: '',
      fixtureEvidenceLocal: false,
      aggregateSummariesLocal: false,
      resultAggregateMetricsLocal: false,
      teamScheduleContextLocal: false,
      teamQualityContextLocal: false,
      reportPreviewLocal: false,
      error: 'TEAM_QUALITY_CONTEXT_REQUIRES_FIXTURE_EVIDENCE',
    };
  }

  if (reportPreviewLocal && !fixtureEvidenceLocal) {
    return {
      path: '',
      fixtureEvidenceLocal: false,
      aggregateSummariesLocal: false,
      resultAggregateMetricsLocal: false,
      teamScheduleContextLocal: false,
      teamQualityContextLocal: false,
      reportPreviewLocal: false,
      error: 'REPORT_PREVIEW_REQUIRES_FIXTURE_EVIDENCE',
    };
  }

  return {
    path: positionalPaths[0],
    fixtureEvidenceLocal,
    aggregateSummariesLocal,
    resultAggregateMetricsLocal,
    teamScheduleContextLocal,
    teamQualityContextLocal,
    reportPreviewLocal,
    error: null,
  };
}

function writeSummary(summary: Readonly<Record<string, unknown>>): void {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

function emptyValidationSummary(): Record<string, unknown> {
  return {
    validationMessageCount: 0,
    validationErrorCount: 0,
    validationWarningCount: 0,
    validationMessages: [],
  };
}

function normalizedFixtureRecord(game: {
  readonly gamePk: number;
  readonly officialDate: string;
  readonly gameDate: Date;
  readonly awayTeamName: string;
  readonly homeTeamName: string;
}): TeamRecentFormEvidenceRecord {
  return {
    gameId: String(game.gamePk),
    officialDate: game.officialDate,
    scheduledStartTime: game.gameDate.toISOString(),
    awayTeam: game.awayTeamName,
    homeTeam: game.homeTeamName,
    liveData: { plays: { allPlays: [] } },
    provenance: {},
  };
}

function buildLocalFixtureEvidence(
  input: MLBTeamRecentFormConstructionPackage,
): Record<string, { readonly target: TeamRecentFormEvidenceTarget; readonly fixtures: readonly TeamRecentFormEvidenceRecord[] }> {
  const normalized = buildMLBFixtures().games.map((game: HistoricalMLBGame) => normalizedFixtureRecord(game));
  return Object.fromEntries(
    input.games.map((game) => [
      game.gameId,
      {
        target: {
          gameId: game.gameId,
          scheduledStartTime: game.scheduledStartTime,
          awayTeam: game.awayTeam,
          homeTeam: game.homeTeam,
        },
        fixtures: normalized,
      },
    ]),
  );
}

const parsedArguments = parseArguments(process.argv);

if (parsedArguments.error) {
  writeSummary({
    ok: false,
    ...emptyValidationSummary(),
    error: parsedArguments.error,
    usage: USAGE,
  });
  process.exit(1);
}

let input: unknown;
try {
  input = JSON.parse(readFileSync(parsedArguments.path, 'utf8')) as unknown;
} catch {
  writeSummary({
    ok: false,
    ...emptyValidationSummary(),
    error: 'TEAM_FORM_RESEARCH_READ_OR_PARSE_FAILED',
  });
  process.exit(1);
}

const validationMessages = validateMLBTeamRecentFormConstructionPackage(input);
const validationErrorCount = validationMessages.filter(
  (message) => message.level === 'error',
).length;
const validationWarningCount = validationMessages.filter(
  (message) => message.level === 'warning',
).length;

if (validationErrorCount > 0) {
  writeSummary({
    ok: false,
    validationMessageCount: validationMessages.length,
    validationErrorCount,
    validationWarningCount,
    validationMessages,
    error: validationMessages.find((message) => message.level === 'error')?.code
      ?? 'TEAM_FORM_RESEARCH_CONSTRUCTION_PACKAGE_INVALID',
  });
  process.exit(1);
}

const typedInput = input as MLBTeamRecentFormConstructionPackage;
const fixtureEvidenceByGameId = parsedArguments.fixtureEvidenceLocal
  ? Object.fromEntries(
      Object.entries(buildLocalFixtureEvidence(typedInput)).map(
        ([gameId, { target, fixtures }]) => [
          gameId,
          buildMLBTeamRecentFormFixtureEvidence(target, fixtures),
        ],
      ),
    )
  : {};

const scheduleRecords: readonly TeamScheduleContextRecord[] = typedInput.games.map((game) => ({
  gameId: game.gameId,
  officialDate: game.officialDate,
  scheduledStartTime: game.scheduledStartTime,
  awayTeam: game.awayTeam,
  homeTeam: game.homeTeam,
}));

const scheduleContextByGameId = parsedArguments.teamScheduleContextLocal
  ? Object.fromEntries(
      typedInput.games.map((game) => [
        game.gameId,
        buildTeamScheduleContext(
          {
            gameId: game.gameId,
            officialDate: game.officialDate,
            scheduledStartTime: game.scheduledStartTime,
            awayTeam: game.awayTeam,
            homeTeam: game.homeTeam,
          },
          scheduleRecords,
        ),
      ]),
    )
  : {};

const qualityContextInputRecords: readonly TeamQualityContextInputRecord[] =
  typedInput.games.map((game) => ({
    gameId: game.gameId,
    officialDate: game.officialDate,
    scheduledStartTime: game.scheduledStartTime,
    awayTeam: game.awayTeam,
    homeTeam: game.homeTeam,
  }));

const teamQualityContextByGameId = parsedArguments.teamQualityContextLocal
  ? Object.fromEntries(
      typedInput.games.map((game) => [
        game.gameId,
        buildTeamQualityContext(
          {
            gameId: game.gameId,
            officialDate: game.officialDate,
            scheduledStartTime: game.scheduledStartTime,
            awayTeam: game.awayTeam,
            homeTeam: game.homeTeam,
          },
          qualityContextInputRecords,
          null,
        ),
      ]),
    )
  : {};

const researchPackage = buildMLBTeamRecentFormResearchPackage(
  typedInput,
  fixtureEvidenceByGameId,
  parsedArguments.aggregateSummariesLocal,
  parsedArguments.resultAggregateMetricsLocal,
  scheduleContextByGameId,
  teamQualityContextByGameId,
);

const reportPreview = parsedArguments.reportPreviewLocal
  ? (() => {
      const report = buildMLBResearchReportFromPackage(researchPackage, {
        generatedAt: null,
      });
      assertReportSafeForDisplay(report);
      const rendered = renderMLBResearchReport(report);
      assertRendererOutputSafeForDisplay(rendered);
      return rendered;
    })()
  : null;

const summary: Record<string, unknown> = {
  ok: true,
  researchPackageVersion: researchPackage.researchPackageVersion,
  researchRunId: researchPackage.researchRunId,
  sourceConstructionRunId: researchPackage.sourceConstructionRunId,
  sourceConstructionLockId: researchPackage.sourceConstructionLockId,
  sourceMode: researchPackage.sourceMode,
  weekStart: researchPackage.weekStart,
  weekEnd: researchPackage.weekEnd,
  researchedAt: researchPackage.researchedAt,
  sourceConstructedAt: researchPackage.sourceConstructedAt,
  sourceLockedAt: researchPackage.sourceLockedAt,
  gameCount: researchPackage.games.length,
  validationMessageCount: validationMessages.length,
  validationErrorCount,
  validationWarningCount,
  validationMessages,
  package: researchPackage,
};

if (parsedArguments.fixtureEvidenceLocal) {
  summary.fixtureEvidenceLocal = true;
}

if (parsedArguments.aggregateSummariesLocal) {
  summary.aggregateSummariesLocal = true;
}

if (parsedArguments.resultAggregateMetricsLocal) {
  summary.resultAggregateMetricsLocal = true;
}

if (parsedArguments.teamScheduleContextLocal) {
  summary.teamScheduleContextLocal = true;
}

if (parsedArguments.teamQualityContextLocal) {
  summary.teamQualityContextLocal = true;
}

if (parsedArguments.reportPreviewLocal) {
  summary.reportPreviewLocal = true;
}

if (reportPreview) {
  summary.reportPreview = reportPreview as unknown as Record<string, unknown>;
}

writeSummary(summary);
