import { describe, expect, it } from 'vitest';
import {
  MLB_RESEARCH_REPORT_ADAPTER_NAME,
  MLB_RESEARCH_REPORT_ADAPTER_VERSION,
  REPORT_ADAPTER_FORBIDDEN_FIELDS,
  assertReportSafeForDisplay,
  buildMLBResearchReportFromPackage,
  type MLBResearchReport,
  type MLBResearchReportInputPackage,
} from '@/prospective/mlb/research-report-adapter';

function createResearchPackage(
  overrides: Partial<MLBResearchReportInputPackage> = {},
): MLBResearchReportInputPackage {
  const base: MLBResearchReportInputPackage = {
    researchPackageVersion: 'mlb-team-recent-form-research-package-v1',
    researchModules: [{ moduleName: 'TEAM_RECENT_FORM' }],
    games: [
      {
        gameId: 'adapter-game-1',
        officialDate: '2024-07-03',
        scheduledStartTime: '2024-07-03T17:10:00Z',
        awayTeam: 'ADAPTER_AWAY_1',
        homeTeam: 'ADAPTER_HOME_1',
        researchStatus: 'researched',
        completedResearchModules: ['TEAM_RECENT_FORM'],
        researchFindings: {
          teamRecentForm: {
            dataQuality: 'partial',
            confidence: 'medium',
            researchStrengthScore: 'medium',
            warnings: ['TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES'],
          },
        },
      },
    ] as MLBResearchReportInputPackage['games'],
    researchWarnings: [],
  };

  return { ...base, ...overrides };
}

describe('MLBResearchReportAdapter', () => {
  it('exposes metadata constants', () => {
    expect(MLB_RESEARCH_REPORT_ADAPTER_VERSION).toBe('mlb-research-report-adapter-v1');
    expect(MLB_RESEARCH_REPORT_ADAPTER_NAME).toBe('MLB_RESEARCH_REPORT_ADAPTER');
  });

  it('creates a safe slate/card/detail shape from a default local package', () => {
    const researchPackage = createResearchPackage();
    const report = buildMLBResearchReportFromPackage(researchPackage);

    expect(report.adapterVersion).toBe(MLB_RESEARCH_REPORT_ADAPTER_VERSION);
    expect(report.adapterName).toBe(MLB_RESEARCH_REPORT_ADAPTER_NAME);
    expect(report.generatedFromPackageVersion).toBe('mlb-team-recent-form-research-package-v1');
    expect(report.metadata.packageVersion).toBe('mlb-team-recent-form-research-package-v1');
    expect(report.metadata.source).toBe('local-research-package');
    expect(report.metadata.deterministic).toBe(true);
    expect(report.metadata.generatedAt).toBeNull();
    expect(report.slateSummary.gameCount).toBe(1);
    expect(report.gameCards).toHaveLength(1);
    expect(report.gameDetails).toHaveLength(1);

    const card = report.gameCards[0];
    expect(card.gameId).toBe('adapter-game-1');
    expect(card.moduleAvailability).toHaveLength(3);
    expect(card.topWarnings).toEqual(['TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES']);
    expect(card.scheduleContextSummary).toBeNull();
    expect(card.teamQualityContextSummary).toBeNull();

    const detail = report.gameDetails[0];
    expect(detail.availableResearchModules).toEqual(['TEAM_RECENT_FORM']);
    expect(detail.teamScheduleContextPanel).toBeNull();
    expect(detail.teamQualityContextPanel).toBeNull();
    expect(detail.warningCodesPanel).toEqual(['TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES']);
    expect(detail.technicalMetadata.generatedAt).toBeNull();
    expect(detail.technicalMetadata.deterministic).toBe(true);
  });

  it('marks TEAM_SCHEDULE_CONTEXT as available when present in package', () => {
    const researchPackage = createResearchPackage({
      researchModules: [
        { moduleName: 'TEAM_RECENT_FORM' },
        { moduleName: 'TEAM_SCHEDULE_CONTEXT' },
      ],
      games: [
        {
          gameId: 'adapter-game-1',
          officialDate: '2024-07-03',
          scheduledStartTime: '2024-07-03T17:10:00Z',
          awayTeam: 'ADAPTER_AWAY_1',
          homeTeam: 'ADAPTER_HOME_1',
          researchStatus: 'researched',
          completedResearchModules: ['TEAM_RECENT_FORM', 'TEAM_SCHEDULE_CONTEXT'],
          researchFindings: {
            teamRecentForm: {
              dataQuality: 'insufficient',
              confidence: 'low',
              warnings: [],
            },
            teamScheduleContext: {
              awayScheduleContext: { status: 'complete', scheduleContextCompletenessLabel: 'complete' },
              homeScheduleContext: { status: 'complete', scheduleContextCompletenessLabel: 'complete' },
            },
          },
        },
      ],
    });

    const report = buildMLBResearchReportFromPackage(researchPackage);
    const gameCard = report.gameCards[0];
    const scheduleModule = gameCard.moduleAvailability.find((entry) => entry.moduleName === 'TEAM_SCHEDULE_CONTEXT');
    expect(scheduleModule?.status).toBe('available');
    expect(gameCard.scheduleContextSummary).toBe('complete');
    expect(report.gameDetails[0].teamScheduleContextPanel).not.toBeNull();
  });

  it('marks TEAM_QUALITY_CONTEXT as available when present in package', () => {
    const researchPackage = createResearchPackage({
      researchModules: [
        { moduleName: 'TEAM_RECENT_FORM' },
        { moduleName: 'TEAM_QUALITY_CONTEXT' },
      ],
      games: [
        {
          gameId: 'adapter-game-1',
          officialDate: '2024-07-03',
          scheduledStartTime: '2024-07-03T17:10:00Z',
          awayTeam: 'ADAPTER_AWAY_1',
          homeTeam: 'ADAPTER_HOME_1',
          researchStatus: 'researched',
          completedResearchModules: ['TEAM_RECENT_FORM', 'TEAM_QUALITY_CONTEXT'],
          researchFindings: {
            teamRecentForm: {
              dataQuality: 'partial',
              confidence: 'low',
              warnings: [],
            },
            teamQualityContext: {
              awayTeamQualityContext: {
                status: 'partial',
                historicalSampleSizeLabel: 'thin',
                qualityContextCompletenessLabel: 'partial',
                qualityContextWarnings: ['TEAM_QUALITY_CONTEXT_RECENT_SAMPLE_THIN'],
                confidence: 'medium',
                researchStrengthScore: 'medium',
              },
              homeTeamQualityContext: {
                status: 'partial',
                historicalSampleSizeLabel: 'thin',
                qualityContextCompletenessLabel: 'partial',
                qualityContextWarnings: ['TEAM_QUALITY_CONTEXT_RECENT_SAMPLE_THIN'],
                confidence: 'medium',
                researchStrengthScore: 'medium',
              },
            },
          },
        },
      ],
    });

    const report = buildMLBResearchReportFromPackage(researchPackage);
    const gameCard = report.gameCards[0];
    const qualityModule = gameCard.moduleAvailability.find((entry) => entry.moduleName === 'TEAM_QUALITY_CONTEXT');
    expect(qualityModule?.status).toBe('available');
    expect(gameCard.teamQualityContextSummary).toBe('partial');
    expect(report.gameDetails[0].teamQualityContextPanel).not.toBeNull();
  });

  it('shows missing research modules as not-requested or unavailable', () => {
    const researchPackage = createResearchPackage({
      researchModules: [
        { moduleName: 'TEAM_RECENT_FORM' },
        { moduleName: 'TEAM_SCHEDULE_CONTEXT' },
        { moduleName: 'TEAM_QUALITY_CONTEXT' },
      ],
      games: [
        {
          gameId: 'adapter-game-1',
          officialDate: '2024-07-03',
          scheduledStartTime: '2024-07-03T17:10:00Z',
          awayTeam: 'ADAPTER_AWAY_1',
          homeTeam: 'ADAPTER_HOME_1',
          researchStatus: 'researched',
          completedResearchModules: ['TEAM_RECENT_FORM'],
          researchFindings: {
            teamRecentForm: {
              dataQuality: 'insufficient',
              confidence: 'low',
              warnings: [],
            },
          },
        },
      ],
    });

    const report = buildMLBResearchReportFromPackage(researchPackage);
    const gameCard = report.gameCards[0];
    const scheduleModule = gameCard.moduleAvailability.find((entry) => entry.moduleName === 'TEAM_SCHEDULE_CONTEXT');
    const qualityModule = gameCard.moduleAvailability.find((entry) => entry.moduleName === 'TEAM_QUALITY_CONTEXT');
    expect(scheduleModule?.status).toBe('not-requested');
    expect(qualityModule?.status).toBe('not-requested');
  });

  it('dedupes and sorts warnings across modules', () => {
    const researchPackage = createResearchPackage({
      researchModules: [
        { moduleName: 'TEAM_RECENT_FORM' },
        { moduleName: 'TEAM_QUALITY_CONTEXT' },
      ],
      games: [
        {
          gameId: 'adapter-game-1',
          officialDate: '2024-07-03',
          scheduledStartTime: '2024-07-03T17:10:00Z',
          awayTeam: 'ADAPTER_AWAY_1',
          homeTeam: 'ADAPTER_HOME_1',
          researchStatus: 'researched',
          completedResearchModules: ['TEAM_RECENT_FORM', 'TEAM_QUALITY_CONTEXT'],
          researchFindings: {
            teamRecentForm: {
              dataQuality: 'insufficient',
              confidence: 'low',
              warnings: ['TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES', 'TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION'],
            },
            teamQualityContext: {
              awayTeamQualityContext: {
                status: 'insufficient',
                historicalSampleSizeLabel: 'none',
                qualityContextCompletenessLabel: 'insufficient',
                qualityContextWarnings: ['TEAM_QUALITY_CONTEXT_NO_LOCAL_EVIDENCE', 'TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION'],
              },
              homeTeamQualityContext: {
                status: 'insufficient',
                historicalSampleSizeLabel: 'none',
                qualityContextCompletenessLabel: 'insufficient',
                qualityContextWarnings: [],
              },
            },
          },
        },
      ],
    });

    const report = buildMLBResearchReportFromPackage(researchPackage);
    expect(report.slateSummary.warningCount).toBe(3);
    expect(report.slateSummary.topWarnings).toEqual([
      'TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES',
      'TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION',
      'TEAM_QUALITY_CONTEXT_NO_LOCAL_EVIDENCE',
    ]);
    expect(report.gameCards[0].topWarnings).toEqual([
      'TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES',
      'TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION',
      'TEAM_QUALITY_CONTEXT_NO_LOCAL_EVIDENCE',
    ]);
  });

  it('does not mutate the input package', () => {
    const researchPackage = createResearchPackage();
    const before = JSON.stringify(researchPackage);
    buildMLBResearchReportFromPackage(researchPackage);
    const after = JSON.stringify(researchPackage);
    expect(after).toBe(before);
  });

  it('produces deep-equal output on repeated runs', () => {
    const researchPackage = createResearchPackage();
    const first = buildMLBResearchReportFromPackage(researchPackage);
    const second = buildMLBResearchReportFromPackage(researchPackage);
    expect(second).toEqual(first);
  });

  it('accepts null generatedAt by default and deterministic generatedAt only when supplied', () => {
    const researchPackage = createResearchPackage();
    const defaultReport = buildMLBResearchReportFromPackage(researchPackage);
    expect(defaultReport.metadata.generatedAt).toBeNull();

    const explicitReport = buildMLBResearchReportFromPackage(researchPackage, { generatedAt: '2024-07-05T00:00:00Z' });
    expect(explicitReport.metadata.generatedAt).toBe('2024-07-05T00:00:00Z');
  });

  it('rejects invalid generatedAt values', () => {
    const researchPackage = createResearchPackage();
    expect(() => buildMLBResearchReportFromPackage(researchPackage, { generatedAt: 1 as unknown as string })).toThrow(TypeError);
  });

  it('preserves researchStrengthScore, confidence, and dataQuality as labels only', () => {
    const researchPackage = createResearchPackage({
      researchModules: [
        { moduleName: 'TEAM_RECENT_FORM' },
        { moduleName: 'TEAM_QUALITY_CONTEXT' },
      ],
      games: [
        {
          gameId: 'adapter-game-1',
          officialDate: '2024-07-03',
          scheduledStartTime: '2024-07-03T17:10:00Z',
          awayTeam: 'ADAPTER_AWAY_1',
          homeTeam: 'ADAPTER_HOME_1',
          researchStatus: 'researched',
          completedResearchModules: ['TEAM_RECENT_FORM', 'TEAM_QUALITY_CONTEXT'],
          researchFindings: {
            teamRecentForm: {
              dataQuality: 'partial',
              confidence: 'medium',
              researchStrengthScore: 'medium',
              warnings: [],
            },
            teamQualityContext: {
              awayTeamQualityContext: {
                status: 'partial',
                historicalSampleSizeLabel: 'moderate',
                qualityContextCompletenessLabel: 'partial',
                qualityContextWarnings: [],
                confidence: 'medium',
                researchStrengthScore: 'medium',
              },
              homeTeamQualityContext: {
                status: 'partial',
                historicalSampleSizeLabel: 'moderate',
                qualityContextCompletenessLabel: 'partial',
                qualityContextWarnings: [],
                confidence: 'medium',
                researchStrengthScore: 'medium',
              },
            },
          },
        },
      ],
    });

    const report = buildMLBResearchReportFromPackage(researchPackage);
    expect(report.gameCards[0].dataQualitySummary).toBe('partial');
    expect(report.gameCards[0].confidenceSummary).toBe('medium');
    expect(report.gameCards[0].researchStrengthSummary).toBe('medium');
    expect(report.gameDetails[0].teamRecentFormPanel.awayDataQuality).toBe('partial');
    expect(report.gameDetails[0].teamRecentFormPanel.awayConfidence).toBe('medium');
    expect(report.gameDetails[0].teamRecentFormPanel.awayResearchStrengthScore).toBe('medium');
  });

  it('assertReportSafeForDisplay throws when a forbidden field is present', () => {
    const report = buildMLBResearchReportFromPackage(createResearchPackage());
    assertReportSafeForDisplay(report);

    const poisoned = JSON.parse(JSON.stringify(report));
    poisoned.gameCards[0].modelProbability = 'unsafe';
    expect(() => assertReportSafeForDisplay(poisoned)).toThrow('Report contains forbidden field: modelProbability');
  });

  it('bans every adapter-level prohibited field from output', () => {
    for (const field of REPORT_ADAPTER_FORBIDDEN_FIELDS) {
      const report = buildMLBResearchReportFromPackage(createResearchPackage());
      const json = JSON.stringify(report);
      expect(json).not.toContain(`"${field}"`);
    }
  });
});
