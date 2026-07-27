export const MLB_RESEARCH_REPORT_RENDERER_VERSION = 'mlb-research-report-renderer-v1';
export const MLB_RESEARCH_REPORT_RENDERER_NAME = 'MLB_RESEARCH_REPORT_RENDERER';

export type DataQualityLabel =
  | 'insufficient'
  | 'partial'
  | 'usable'
  | 'not-evaluated';
export type ConfidenceLabel = 'low' | 'medium' | 'high' | 'not-evaluated';
export type ResearchStrengthLabel = 'low' | 'medium' | 'high' | 'not-evaluated';
export type ModuleAvailabilityStatus = 'available' | 'not-requested' | 'unavailable';
export type SourceMode = 'local-research-package';

export interface MLBResearchRenderedReport {
  readonly rendererVersion: typeof MLB_RESEARCH_REPORT_RENDERER_VERSION;
  readonly rendererName: typeof MLB_RESEARCH_REPORT_RENDERER_NAME;
  readonly adapterVersion: string;
  readonly title: string;
  readonly sections: readonly MLBResearchRenderedSection[];
  readonly gameCards: readonly MLBResearchRenderedGameCard[];
  readonly gameDetails: readonly MLBResearchRenderedGameDetail[];
  readonly safetyNotes: readonly string[];
  readonly metadata: {
    readonly adapterVersion: string;
    readonly rendererVersion: typeof MLB_RESEARCH_REPORT_RENDERER_VERSION;
    readonly generatedAt: string | null;
    readonly source: SourceMode;
    readonly deterministic: true;
  };
}

export interface MLBResearchRenderedSection {
  readonly heading: string;
  readonly body: readonly string[];
}

export interface MLBResearchRenderedGameCard {
  readonly heading: string;
  readonly gameId: string;
  readonly officialDate: string;
  readonly scheduledStartTime: string;
  readonly moduleSummary: string;
  readonly dataQualitySummary: string;
  readonly confidenceSummary: string;
  readonly researchStrengthSummary: string;
  readonly warningSummary: string;
  readonly scheduleContextSummary: string;
  readonly teamQualityContextSummary: string;
}

export interface MLBResearchRenderedGameDetail {
  readonly heading: string;
  readonly availableResearchModules: string;
  readonly teamRecentFormSummary: string;
  readonly scheduleContextSummary: string;
  readonly teamQualityContextSummary: string;
  readonly warnings: string;
  readonly dataQualityExplanation: string;
  readonly evidenceLimitations: string;
  readonly technicalMetadataSummary: string;
}

export interface MLBResearchRendererOptions {
  readonly title?: string;
  readonly extraSafetyNotes?: readonly string[];
}

// Re-use adapter output types from the Phase 5W module to keep the renderer
// input typed and bounded. These are imported only for type safety; the
// renderer does not call adapter logic or file/network/CLI code.
import type {
  MLBResearchReport,
  MLBResearchReportGameCard,
  MLBResearchReportGameDetail,
} from './research-report-adapter';

export const MLB_RESEARCH_REPORT_RENDERER_FORBIDDEN_TERMS = new Set([
  'modelProbability',
  'predictedWinner',
  'pick',
  'winChance',
  'probability',
  'odds',
  'sportsbook',
  'market',
  'price',
  'edge',
  'roi',
  'impliedProbability',
  'finalScore',
  'outcome',
  'completedGameState',
  'finalStatus',
  'actualStartingPitchers',
  'pitcher',
  'powerRating',
  'teamRank',
  'standingsPosition',
  'favorite',
  'underdog',
  'best bet',
  'value',
  'projected score',
  'should win',
  'likely winner',
  'chance to win',
  'winner',
]);

export function assertRendererOutputSafeForDisplay(rendered: MLBResearchRenderedReport): void {
  const json = JSON.stringify(rendered);
  for (const field of MLB_RESEARCH_REPORT_RENDERER_FORBIDDEN_TERMS) {
    if (json.includes(`"${field}"`)) {
      throw new Error(`Rendered report contains forbidden field: ${field}`);
    }
  }
}

function labelizeDataQuality(value: string | undefined): string {
  return `data quality label: ${value ?? 'not-evaluated'}`;
}

function labelizeConfidence(value: string | undefined): string {
  return `confidence label: ${value ?? 'not-evaluated'}`;
}

function labelizeResearchStrength(value: string | undefined): string {
  return `research strength label: ${value ?? 'not-evaluated'}`;
}

function renderModuleAvailability(modules: readonly { readonly moduleName: string; readonly status: string }[]): string {
  return modules
    .map((entry) => `${entry.moduleName}: ${entry.status}`)
    .join('; ');
}

function renderDataQualityLabel(value: string | undefined): string {
  return labelizeDataQuality(value);
}

function renderContextSummary(value: string | null, fallback: string): string {
  if (value === null) return fallback;
  return value;
}

function renderDetailsPanel(value: string | null, fallback: string): string {
  if (value === null || value === undefined) return fallback;
  return value;
}

export function renderMLBResearchReport(
  report: MLBResearchReport,
  options?: MLBResearchRendererOptions,
): MLBResearchRenderedReport {
  const adapterVersion = report.adapterVersion;
  const title = options?.title ??
    `MLB Research Report — ${report.metadata.packageVersion}`;

  const sections: MLBResearchRenderedSection[] = [
    {
      heading: 'Slate Overview',
      body: [
        `${report.slateSummary.gameCount} game(s) on the slate.`,
        report.slateSummary.moduleNamesPresent.length > 0
          ? `Modules present: ${report.slateSummary.moduleNamesPresent.join(', ')}.`
          : 'No research modules are present for this slate.',
      ],
    },
    {
      heading: 'Module Availability',
      body: [
        `Available: ${report.slateSummary.moduleAvailabilityCounts.available}.`,
        `Not requested: ${report.slateSummary.moduleAvailabilityCounts['not-requested']}.`,
        `Unavailable: ${report.slateSummary.moduleAvailabilityCounts.unavailable}.`,
      ],
    },
    {
      heading: 'Data Quality',
      body: [
        `Warning count: ${report.slateSummary.warningCount}.`,
        Object.entries(report.slateSummary.dataQualityCounts)
          .map(([key, value]) => `Data quality (${key}): ${value}`)
          .join('; '),
      ],
    },
    {
      heading: 'Warnings',
      body:
        report.slateSummary.topWarnings.length > 0
          ? report.slateSummary.topWarnings
          : ['No warnings.'],
    },
    {
      heading: 'Game Details',
      body: report.gameDetails.map((detail) => detail.matchHeader.awayTeam + ' at ' + detail.matchHeader.homeTeam),
    },
    {
      heading: 'Interpretation Notes',
      body: [
        'Report rendering is local-only and descriptive.',
        'No betting advice or recommendation language is included.',
        'Research labels are only descriptive evidence descriptors.',
        'Missing modules are shown as not-requested or unavailable.',
      ],
    },
  ];

  const safetyNotes = [
    'Local-only display; no live data included.',
    'No betting advice or recommendation language is rendered.',
    'Research labels are only descriptive evidence descriptors.',
    ...(options?.extraSafetyNotes ?? []),
  ];

  const gameCards = report.gameCards.map((card: MLBResearchReportGameCard) => ({
    heading: `${card.awayTeam} at ${card.homeTeam}`,
    gameId: card.gameId,
    officialDate: card.officialDate,
    scheduledStartTime: card.scheduledStartTime,
    moduleSummary: renderModuleAvailability(card.moduleAvailability),
    dataQualitySummary: labelizeDataQuality(card.dataQualitySummary),
    confidenceSummary: labelizeConfidence(card.confidenceSummary),
    researchStrengthSummary: labelizeResearchStrength(card.researchStrengthSummary),
    warningSummary: card.topWarnings.length > 0 ? card.topWarnings.join('; ') : 'No warnings.',
    scheduleContextSummary: renderContextSummary(card.scheduleContextSummary, 'Schedule context unavailable.'),
    teamQualityContextSummary: renderContextSummary(card.teamQualityContextSummary, 'Team quality context insufficient.'),
  }));

  const gameDetails = report.gameDetails.map((detail: MLBResearchReportGameDetail) => ({
    heading: `${detail.matchHeader.awayTeam} at ${detail.matchHeader.homeTeam} — ${detail.matchHeader.officialDate}`,
    availableResearchModules: detail.availableResearchModules.length > 0
      ? `Available modules: ${detail.availableResearchModules.join(', ')}.`
      : 'No research modules available.',
    teamRecentFormSummary:
      detail.teamRecentFormPanel.warningCount > 0
        ? `Team recent form: ${labelizeDataQuality(detail.teamRecentFormPanel.awayDataQuality)}, ${labelizeConfidence(detail.teamRecentFormPanel.awayConfidence)}, ${labelizeResearchStrength(detail.teamRecentFormPanel.awayResearchStrengthScore)}, warnings present.`
        : `Team recent form: ${labelizeDataQuality(detail.teamRecentFormPanel.awayDataQuality)}, ${labelizeConfidence(detail.teamRecentFormPanel.awayConfidence)}, ${labelizeResearchStrength(detail.teamRecentFormPanel.awayResearchStrengthScore)}, no warnings.`,
    scheduleContextSummary: detail.teamScheduleContextPanel
      ? `Schedule context: away status ${detail.teamScheduleContextPanel.awayStatus ?? 'not evaluated'}, home status ${detail.teamScheduleContextPanel.homeStatus ?? 'not evaluated'}.`
      : 'Schedule context unavailable.',
    teamQualityContextSummary: detail.teamQualityContextPanel
      ? `Team quality context: away status ${detail.teamQualityContextPanel.awayStatus ?? 'not evaluated'}, home status ${detail.teamQualityContextPanel.homeStatus ?? 'not evaluated'}.`
      : 'Team quality context insufficient.',
    warnings: detail.warningCodesPanel.length > 0 ? detail.warningCodesPanel.join('; ') : 'No warnings.',
    dataQualityExplanation: detail.dataQualityExplanation,
    evidenceLimitations: detail.evidenceLimitations,
    technicalMetadataSummary: `Deterministic: ${detail.technicalMetadata.deterministic}. Source: ${detail.technicalMetadata.source}. Generated at: ${detail.technicalMetadata.generatedAt ?? 'null'}.`,
  }));

  const rendered: MLBResearchRenderedReport = {
    rendererVersion: MLB_RESEARCH_REPORT_RENDERER_VERSION,
    rendererName: MLB_RESEARCH_REPORT_RENDERER_NAME,
    adapterVersion,
    title,
    sections,
    gameCards,
    gameDetails,
    safetyNotes,
    metadata: {
      adapterVersion,
      rendererVersion: MLB_RESEARCH_REPORT_RENDERER_VERSION,
      generatedAt: report.metadata.generatedAt,
      source: report.metadata.source,
      deterministic: true,
    },
  };

  return rendered;
}
