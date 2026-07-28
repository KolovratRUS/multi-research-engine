export const MLB_RESEARCH_REPORT_ADAPTER_VERSION = 'mlb-research-report-adapter-v1';
export const MLB_RESEARCH_REPORT_ADAPTER_NAME = 'MLB_RESEARCH_REPORT_ADAPTER';

export type DataQualityLabel = 'insufficient' | 'partial' | 'usable' | 'not-evaluated';
export type ConfidenceLabel = 'low' | 'medium' | 'high' | 'not-evaluated';
export type ResearchStrengthLabel = 'low' | 'medium' | 'high' | 'not-evaluated';
export type ModuleAvailabilityStatus = 'available' | 'not-requested' | 'unavailable';
export type SourceMode = 'local-research-package';

export interface MLBResearchReportInputTeamRecentForm {
  readonly dataQuality: string;
  readonly confidence: string;
  readonly researchStrengthScore?: string;
  readonly warnings: readonly string[];
}

export interface MLBResearchReportInputScheduleContextSide {
  readonly status: string;
  readonly scheduleContextCompletenessLabel: string;
}

export interface MLBResearchReportInputScheduleContext {
  readonly awayScheduleContext: MLBResearchReportInputScheduleContextSide;
  readonly homeScheduleContext: MLBResearchReportInputScheduleContextSide;
  readonly warnings?: readonly string[];
}

export interface MLBResearchReportInputQualitySideContext {
  readonly status: string;
  readonly historicalSampleSizeLabel: string;
  readonly qualityContextCompletenessLabel: string;
  readonly qualityContextWarnings: readonly string[];
  readonly confidence?: string;
  readonly researchStrengthScore?: string;
}

export interface MLBResearchReportInputQualityContext {
  readonly awayTeamQualityContext: MLBResearchReportInputQualitySideContext;
  readonly homeTeamQualityContext: MLBResearchReportInputQualitySideContext;
}

export interface MLBResearchReportInputGame {
  readonly gameId: string;
  readonly officialDate: string;
  readonly scheduledStartTime: string;
  readonly awayTeam: string;
  readonly homeTeam: string;
  readonly researchStatus: string;
  readonly completedResearchModules: readonly string[];
  readonly researchFindings: {
    readonly teamRecentForm?: MLBResearchReportInputTeamRecentForm;
    readonly teamScheduleContext?: MLBResearchReportInputScheduleContext;
    readonly teamQualityContext?: MLBResearchReportInputQualityContext;
  };
}

export interface MLBResearchReportInputPackage {
  readonly researchPackageVersion: string;
  readonly games: readonly MLBResearchReportInputGame[];
  readonly researchModules: readonly { readonly moduleName: string }[];
  readonly researchWarnings?: readonly unknown[];
}

export interface MLBResearchReportMetadata {
  readonly packageVersion: string;
  readonly adapterVersion: typeof MLB_RESEARCH_REPORT_ADAPTER_VERSION;
  readonly generatedAt: string | null;
  readonly source: SourceMode;
  readonly deterministic: true;
}

export interface MLBResearchReportWarningSummary {
  readonly code: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly message: string;
}

export interface MLBResearchReportModuleAvailability {
  readonly moduleName: string;
  readonly status: ModuleAvailabilityStatus;
  readonly availableDataQuality?: DataQualityLabel;
  readonly availableConfidence?: ConfidenceLabel;
  readonly availableResearchStrengthScore?: ResearchStrengthLabel;
}

export interface MLBResearchReportDataQualitySummary {
  readonly overall: DataQualityLabel | 'not-evaluated';
  readonly modules: Record<string, DataQualityLabel | 'not-evaluated'>;
}

export interface MLBResearchReportGameCard {
  readonly gameId: string;
  readonly officialDate: string;
  readonly scheduledStartTime: string;
  readonly awayTeam: string;
  readonly homeTeam: string;
  readonly moduleAvailability: readonly MLBResearchReportModuleAvailability[];
  readonly topWarnings: readonly string[];
  readonly dataQualitySummary: MLBResearchReportDataQualitySummary['overall'];
  readonly confidenceSummary: ConfidenceLabel;
  readonly researchStrengthSummary: ResearchStrengthLabel;
  readonly scheduleContextSummary: string | null;
  readonly teamQualityContextSummary: string | null;
}

export interface MLBResearchReportGameDetail {
  readonly gameId: string;
  readonly matchHeader: {
    readonly awayTeam: string;
    readonly homeTeam: string;
    readonly officialDate: string;
    readonly scheduledStartTime: string;
  };
  readonly availableResearchModules: readonly string[];
  readonly teamRecentFormPanel: {
    readonly awayDataQuality: DataQualityLabel | 'not-evaluated';
    readonly awayConfidence: ConfidenceLabel;
    readonly awayResearchStrengthScore: ResearchStrengthLabel;
    readonly homeDataQuality: DataQualityLabel | 'not-evaluated';
    readonly homeConfidence: ConfidenceLabel;
    readonly homeResearchStrengthScore: ResearchStrengthLabel;
    readonly warningCount: number;
  };
  readonly teamScheduleContextPanel: {
    readonly awayStatus: string | null;
    readonly awayContextLabel: string | null;
    readonly homeStatus: string | null;
    readonly homeContextLabel: string | null;
  } | null;
  readonly teamQualityContextPanel: {
    readonly awayStatus: string | null;
    readonly awaySampleLabel: string | null;
    readonly awayQualityLabel: string | null;
    readonly homeStatus: string | null;
    readonly homeSampleLabel: string | null;
    readonly homeQualityLabel: string | null;
  } | null;
  readonly warningCodesPanel: readonly string[];
  readonly dataQualityExplanation: string;
  readonly evidenceLimitations: string;
  readonly technicalMetadata: {
    readonly generatedAt: string | null;
    readonly deterministic: true;
    readonly source: SourceMode;
  };
}

export interface MLBResearchReportSlateSummary {
  readonly gameCount: number;
  readonly moduleAvailabilityCounts: {
    readonly available: number;
    readonly 'not-requested': number;
    readonly unavailable: number;
  };
  readonly dataQualityCounts: Record<string, number>;
  readonly warningCount: number;
  readonly topWarnings: readonly string[];
  readonly moduleNamesPresent: readonly string[];
}

export interface MLBResearchReport {
  readonly adapterVersion: typeof MLB_RESEARCH_REPORT_ADAPTER_VERSION;
  readonly adapterName: typeof MLB_RESEARCH_REPORT_ADAPTER_NAME;
  readonly generatedFromPackageVersion: string;
  readonly slateSummary: MLBResearchReportSlateSummary;
  readonly gameCards: readonly MLBResearchReportGameCard[];
  readonly gameDetails: readonly MLBResearchReportGameDetail[];
  readonly metadata: MLBResearchReportMetadata;
  readonly reportWarnings: readonly MLBResearchReportWarningSummary[];
}

function toDataQualityLabel(value: string): DataQualityLabel {
  if (value === 'usable' || value === 'partial' || value === 'insufficient') {
    return value;
  }
  return 'not-evaluated';
}

function toConfidenceLabel(value: string): ConfidenceLabel {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }
  return 'not-evaluated';
}

function toResearchStrengthLabel(value: string): ResearchStrengthLabel {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }
  return 'not-evaluated';
}

export function buildMLBResearchReportFromPackage(
  researchPackage: MLBResearchReportInputPackage,
  options?: { readonly generatedAt?: string | null },
): MLBResearchReport {
  if (options?.generatedAt !== undefined && options.generatedAt !== null && typeof options.generatedAt !== 'string') {
    throw new TypeError('generatedAt must be a string or null');
  }

  const packageVersion = researchPackage.researchPackageVersion;
  const generatedAt = options?.generatedAt ?? null;
  const moduleNamesPresent = Array.from(
    new Set(
      researchPackage.researchModules
        .map((module) => module.moduleName)
        .filter((name): name is string => Boolean(name)),
    ),
  );

  const moduleAvailabilityCounts = { available: 0, 'not-requested': 0, unavailable: 0 };
  const dataQualityCounts: Record<string, number> = {};
  const warningSet = new Set<string>();
  const gameCards: MLBResearchReportGameCard[] = [];
  const gameDetails: MLBResearchReportGameDetail[] = [];

  for (const game of researchPackage.games) {
    const availableModules: MLBResearchReportModuleAvailability[] = [];
    const availableModuleNames: string[] = [];

    const teamRecentForm = game.researchFindings.teamRecentForm;
    if (teamRecentForm) {
      availableModules.push({
        moduleName: 'TEAM_RECENT_FORM',
        status: 'available',
        availableDataQuality: toDataQualityLabel(teamRecentForm.dataQuality),
        availableConfidence: toConfidenceLabel(teamRecentForm.confidence),
        availableResearchStrengthScore: toResearchStrengthLabel(teamRecentForm.researchStrengthScore ?? 'not-evaluated'),
      });
      availableModuleNames.push('TEAM_RECENT_FORM');
    } else if (moduleNamesPresent.includes('TEAM_RECENT_FORM')) {
      availableModules.push({ moduleName: 'TEAM_RECENT_FORM', status: 'not-requested' });
    } else {
      availableModules.push({ moduleName: 'TEAM_RECENT_FORM', status: 'unavailable' });
    }

    const teamScheduleContext = game.researchFindings.teamScheduleContext;
    if (teamScheduleContext) {
      availableModules.push({
        moduleName: 'TEAM_SCHEDULE_CONTEXT',
        status: 'available',
        availableDataQuality: toDataQualityLabel(teamScheduleContext.awayScheduleContext.status),
        availableConfidence: 'medium',
        availableResearchStrengthScore: 'not-evaluated',
      });
      availableModuleNames.push('TEAM_SCHEDULE_CONTEXT');
    } else if (moduleNamesPresent.includes('TEAM_SCHEDULE_CONTEXT')) {
      availableModules.push({ moduleName: 'TEAM_SCHEDULE_CONTEXT', status: 'not-requested' });
    } else {
      availableModules.push({ moduleName: 'TEAM_SCHEDULE_CONTEXT', status: 'unavailable' });
    }

    const teamQualityContext = game.researchFindings.teamQualityContext;
    if (teamQualityContext) {
      availableModules.push({
        moduleName: 'TEAM_QUALITY_CONTEXT',
        status: 'available',
        availableDataQuality: toDataQualityLabel(teamQualityContext.awayTeamQualityContext.status),
        availableConfidence: toConfidenceLabel(teamQualityContext.awayTeamQualityContext.confidence ?? 'not-evaluated'),
        availableResearchStrengthScore: toResearchStrengthLabel(teamQualityContext.awayTeamQualityContext.researchStrengthScore ?? 'not-evaluated'),
      });
      availableModuleNames.push('TEAM_QUALITY_CONTEXT');
    } else if (moduleNamesPresent.includes('TEAM_QUALITY_CONTEXT')) {
      availableModules.push({ moduleName: 'TEAM_QUALITY_CONTEXT', status: 'not-requested' });
    } else {
      availableModules.push({ moduleName: 'TEAM_QUALITY_CONTEXT', status: 'unavailable' });
    }

    const cardWarnings: string[] = [];
    if (teamRecentForm) {
      for (const warning of teamRecentForm.warnings) {
        cardWarnings.push(warning);
        warningSet.add(warning);
      }
    }
    if (teamScheduleContext) {
      for (const warning of teamScheduleContext.warnings ?? []) {
        if (typeof warning === 'string') {
          cardWarnings.push(warning);
          warningSet.add(warning);
        }
      }
    }
    if (teamQualityContext) {
      for (const side of [teamQualityContext.awayTeamQualityContext, teamQualityContext.homeTeamQualityContext]) {
        for (const warning of side.qualityContextWarnings) {
          cardWarnings.push(warning);
          warningSet.add(warning);
        }
      }
    }

    const uniqueCardWarnings = Array.from(new Set(cardWarnings)).sort();

    const slateDataQualities: string[] = [];
    if (teamRecentForm) slateDataQualities.push(teamRecentForm.dataQuality);
    if (teamScheduleContext) slateDataQualities.push(teamScheduleContext.awayScheduleContext.status);
    if (teamQualityContext) slateDataQualities.push(teamQualityContext.awayTeamQualityContext.status);

    const aggregatedDataQuality: DataQualityLabel | 'not-evaluated' = slateDataQualities.includes('insufficient')
      ? 'insufficient'
      : slateDataQualities.includes('partial')
        ? 'partial'
        : slateDataQualities.includes('usable')
          ? 'usable'
          : 'not-evaluated';

    const confidences: string[] = [];
    if (teamRecentForm) confidences.push(teamRecentForm.confidence);
    if (teamQualityContext) confidences.push(teamQualityContext.awayTeamQualityContext.confidence ?? 'not-evaluated');
    const aggregatedConfidence = toConfidenceLabel(confidences.includes('low') ? 'low' : confidences.includes('medium') ? 'medium' : confidences.includes('high') ? 'high' : 'not-evaluated');

    const strengths: string[] = [];
    if (teamRecentForm?.researchStrengthScore) strengths.push(teamRecentForm.researchStrengthScore);
    if (teamQualityContext?.awayTeamQualityContext.researchStrengthScore) strengths.push(teamQualityContext.awayTeamQualityContext.researchStrengthScore);
    const aggregatedStrength = toResearchStrengthLabel(strengths.includes('high') ? 'high' : strengths.includes('medium') ? 'medium' : strengths.includes('low') ? 'low' : 'not-evaluated');

    let scheduleContextSummary: string | null = null;
    if (teamScheduleContext) {
      const labels = [
        teamScheduleContext.awayScheduleContext.scheduleContextCompletenessLabel,
        teamScheduleContext.homeScheduleContext.scheduleContextCompletenessLabel,
      ];
      if (labels.every((label) => label === 'complete')) scheduleContextSummary = 'complete';
      else if (labels.some((label) => label === 'complete' || label === 'partial')) scheduleContextSummary = 'partial';
      else scheduleContextSummary = 'insufficient';
    }

    let teamQualityContextSummary: string | null = null;
    if (teamQualityContext) {
      const labels = [
        teamQualityContext.awayTeamQualityContext.qualityContextCompletenessLabel,
        teamQualityContext.homeTeamQualityContext.qualityContextCompletenessLabel,
      ];
      if (labels.every((label) => label === 'complete')) teamQualityContextSummary = 'complete';
      else if (labels.some((label) => label === 'complete' || label === 'partial')) teamQualityContextSummary = 'partial';
      else teamQualityContextSummary = 'insufficient';
    }

    gameCards.push({
      gameId: game.gameId,
      officialDate: game.officialDate,
      scheduledStartTime: game.scheduledStartTime,
      awayTeam: game.awayTeam,
      homeTeam: game.homeTeam,
      moduleAvailability: availableModules,
      topWarnings: uniqueCardWarnings.slice(0, 3),
      dataQualitySummary: aggregatedDataQuality,
      confidenceSummary: aggregatedConfidence,
      researchStrengthSummary: aggregatedStrength,
      scheduleContextSummary,
      teamQualityContextSummary,
    });

    gameDetails.push({
      gameId: game.gameId,
      matchHeader: {
        awayTeam: game.awayTeam,
        homeTeam: game.homeTeam,
        officialDate: game.officialDate,
        scheduledStartTime: game.scheduledStartTime,
      },
      availableResearchModules: availableModuleNames,
      teamRecentFormPanel: {
        awayDataQuality: teamRecentForm ? toDataQualityLabel(teamRecentForm.dataQuality) : 'not-evaluated',
        awayConfidence: teamRecentForm ? toConfidenceLabel(teamRecentForm.confidence) : 'not-evaluated',
        awayResearchStrengthScore: teamRecentForm ? toResearchStrengthLabel(teamRecentForm.researchStrengthScore ?? 'not-evaluated') : 'not-evaluated',
        homeDataQuality: teamRecentForm ? toDataQualityLabel(teamRecentForm.dataQuality) : 'not-evaluated',
        homeConfidence: teamRecentForm ? toConfidenceLabel(teamRecentForm.confidence) : 'not-evaluated',
        homeResearchStrengthScore: teamRecentForm ? toResearchStrengthLabel(teamRecentForm.researchStrengthScore ?? 'not-evaluated') : 'not-evaluated',
        warningCount: teamRecentForm?.warnings.length ?? 0,
      },
      teamScheduleContextPanel: teamScheduleContext
        ? {
            awayStatus: teamScheduleContext.awayScheduleContext.status,
            awayContextLabel: teamScheduleContext.awayScheduleContext.scheduleContextCompletenessLabel,
            homeStatus: teamScheduleContext.homeScheduleContext.status,
            homeContextLabel: teamScheduleContext.homeScheduleContext.scheduleContextCompletenessLabel,
          }
        : null,
      teamQualityContextPanel: teamQualityContext
        ? {
            awayStatus: teamQualityContext.awayTeamQualityContext.status,
            awaySampleLabel: teamQualityContext.awayTeamQualityContext.historicalSampleSizeLabel,
            awayQualityLabel: teamQualityContext.awayTeamQualityContext.qualityContextCompletenessLabel,
            homeStatus: teamQualityContext.homeTeamQualityContext.status,
            homeSampleLabel: teamQualityContext.homeTeamQualityContext.historicalSampleSizeLabel,
            homeQualityLabel: teamQualityContext.homeTeamQualityContext.qualityContextCompletenessLabel,
          }
        : null,
      warningCodesPanel: uniqueCardWarnings,
      dataQualityExplanation: aggregatedDataQuality === 'insufficient'
        ? 'Current local evidence is insufficient for confident display.'
        : aggregatedDataQuality === 'partial'
          ? 'Partial local evidence exists; treat summaries with caution.'
          : aggregatedDataQuality === 'usable'
            ? 'Local evidence coverage is usable for display.'
            : 'No local evidence evaluated yet.',
      evidenceLimitations: 'This report is derived only from local manual/synthetic evidence. No live schedule, odds, pitcher, or market data is included. Missing modules are shown as not-requested or unavailable.',
      technicalMetadata: {
        generatedAt,
        deterministic: true,
        source: 'local-research-package',
      },
    });

    for (const entry of availableModules) {
      if (entry.status === 'available') {
        moduleAvailabilityCounts.available += 1;
      } else if (entry.status === 'not-requested') {
        moduleAvailabilityCounts['not-requested'] += 1;
      } else {
        moduleAvailabilityCounts.unavailable += 1;
      }

      const qualityKey = entry.availableDataQuality ?? 'not-evaluated';
      dataQualityCounts[qualityKey] = (dataQualityCounts[qualityKey] ?? 0) + 1;
    }
  }

  const slateSummary: MLBResearchReportSlateSummary = {
    gameCount: researchPackage.games.length,
    moduleAvailabilityCounts: moduleAvailabilityCounts as MLBResearchReportSlateSummary['moduleAvailabilityCounts'],
    dataQualityCounts,
    warningCount: warningSet.size,
    topWarnings: Array.from(warningSet).sort().slice(0, 5),
    moduleNamesPresent,
  };

  const reportWarnings: MLBResearchReportWarningSummary[] = [];

  if (moduleNamesPresent.length === 0) {
    reportWarnings.push({
      code: 'MLB_RESEARCH_REPORT_NO_MODULES',
      severity: 'warning',
      message: 'No research modules are present in this package.',
    });
  }

  if (researchPackage.games.length === 0) {
    reportWarnings.push({
      code: 'MLB_RESEARCH_REPORT_EMPTY_SLATE',
      severity: 'warning',
      message: 'The research package contains no games.',
    });
  }

  return {
    adapterVersion: MLB_RESEARCH_REPORT_ADAPTER_VERSION,
    adapterName: MLB_RESEARCH_REPORT_ADAPTER_NAME,
    generatedFromPackageVersion: packageVersion,
    slateSummary,
    gameCards,
    gameDetails,
    metadata: {
      packageVersion,
      adapterVersion: MLB_RESEARCH_REPORT_ADAPTER_VERSION,
      generatedAt,
      source: 'local-research-package',
      deterministic: true,
    },
    reportWarnings,
  };
}

export const REPORT_ADAPTER_FORBIDDEN_FIELDS = new Set([
  'modelProbability',
  'predictedWinner',
  'pick',
  'winChance',
  'powerRating',
  'teamRank',
  'standingsPosition',
  'finalScore',
  'outcome',
  'completedGameState',
  'finalStatus',
  'actualStartingPitchers',
  'pitcher',
  'odds',
  'sportsbook',
  'market',
  'price',
  'edge',
  'roi',
  'impliedProbability',
]);

export function assertReportSafeForDisplay(report: MLBResearchReport): void {
  const json = JSON.stringify(report);
  for (const field of REPORT_ADAPTER_FORBIDDEN_FIELDS) {
    if (json.includes(`"${field}"`)) {
      throw new Error(`Report contains forbidden field: ${field}`);
    }
  }
}
