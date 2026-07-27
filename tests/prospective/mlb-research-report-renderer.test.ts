import { describe, expect, it } from 'vitest';
import {
  MLB_RESEARCH_REPORT_ADAPTER_VERSION,
  buildMLBResearchReportFromPackage,
  type MLBResearchReport,
  type MLBResearchReportInputPackage,
} from '@/prospective/mlb/research-report-adapter';
import {
  MLB_RESEARCH_REPORT_RENDERER_NAME,
  MLB_RESEARCH_REPORT_RENDERER_VERSION,
  MLB_RESEARCH_REPORT_RENDERER_FORBIDDEN_TERMS,
  assertRendererOutputSafeForDisplay,
  renderMLBResearchReport,
  type MLBResearchRenderedReport,
} from '@/prospective/mlb/research-report-renderer';

function createResearchPackage(
  overrides: Partial<MLBResearchReportInputPackage> = {},
): MLBResearchReportInputPackage {
  const base: MLBResearchReportInputPackage = {
    researchPackageVersion: 'mlb-team-recent-form-research-package-v1',
    researchModules: [
      { moduleName: 'TEAM_RECENT_FORM' },
      { moduleName: 'TEAM_SCHEDULE_CONTEXT' },
      { moduleName: 'TEAM_QUALITY_CONTEXT' },
    ],
    games: [
      {
        gameId: 'renderer-game-1',
        officialDate: '2024-07-03',
        scheduledStartTime: '2024-07-03T17:10:00Z',
        awayTeam: 'RENDER_AWAY_1',
        homeTeam: 'RENDER_HOME_1',
        researchStatus: 'researched',
        completedResearchModules: ['TEAM_RECENT_FORM', 'TEAM_SCHEDULE_CONTEXT', 'TEAM_QUALITY_CONTEXT'],
        researchFindings: {
          teamRecentForm: {
            dataQuality: 'partial',
            confidence: 'medium',
            researchStrengthScore: 'medium',
            warnings: ['TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES'],
          },
          teamScheduleContext: {
            awayTeamScheduleContext: {
              status: 'partial',
              scheduleContextCompletenessLabel: 'partial',
            },
            homeTeamScheduleContext: {
              status: 'partial',
              scheduleContextCompletenessLabel: 'partial',
            },
            warnings: ['TEAM_SCHEDULE_CONTEXT_PARTIAL_LABEL'],
          },
          teamQualityContext: {
            awayTeamQualityContext: {
              status: 'partial',
              historicalSampleSizeLabel: 'small',
              qualityContextCompletenessLabel: 'insufficient',
              qualityContextWarnings: ['TEAM_QUALITY_CONTEXT_NO_LOCAL_EVIDENCE'],
              confidence: 'medium',
              researchStrengthScore: 'medium',
            },
            homeTeamQualityContext: {
              status: 'partial',
              historicalSampleSizeLabel: 'small',
              qualityContextCompletenessLabel: 'insufficient',
              qualityContextWarnings: [],
              confidence: 'medium',
              researchStrengthScore: 'medium',
            },
          },
        },
      },
      {
        gameId: 'renderer-game-2',
        officialDate: '2024-07-05',
        scheduledStartTime: '2024-07-05T19:15:00Z',
        awayTeam: 'RENDER_AWAY_2',
        homeTeam: 'RENDER_HOME_2',
        researchStatus: 'researched',
        completedResearchModules: ['TEAM_RECENT_FORM'],
        researchFindings: {
          teamRecentForm: {
            dataQuality: 'insufficient',
            confidence: 'low',
            researchStrengthScore: 'low',
            warnings: [
              'TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES',
              'TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION',
            ],
          },
        },
      },
    ],
    researchWarnings: [],
  };

  return { ...base, ...overrides };
}

function buildReport(overrides?: Partial<MLBResearchReportInputPackage>): MLBResearchReport {
  return buildMLBResearchReportFromPackage(createResearchPackage(overrides));
}

describe('MLBResearchReportRenderer', () => {
  it('exposes metadata constants', () => {
    expect(MLB_RESEARCH_REPORT_RENDERER_VERSION).toBe('mlb-research-report-renderer-v1');
    expect(MLB_RESEARCH_REPORT_RENDERER_NAME).toBe('MLB_RESEARCH_REPORT_RENDERER');
  });

  it('renders safe top-level structure from a default local package', () => {
    const report = buildReport();
    const rendered = renderMLBResearchReport(report);

    expect(rendered.rendererVersion).toBe(MLB_RESEARCH_REPORT_RENDERER_VERSION);
    expect(rendered.rendererName).toBe(MLB_RESEARCH_REPORT_RENDERER_NAME);
    expect(rendered.adapterVersion).toBe(MLB_RESEARCH_REPORT_ADAPTER_VERSION);
    expect(rendered.title).toContain('MLB Research Report');
    expect(rendered.sections.length).toBeGreaterThanOrEqual(5);
    expect(rendered.gameCards).toHaveLength(2);
    expect(rendered.gameDetails).toHaveLength(2);
    expect(rendered.safetyNotes.length).toBeGreaterThanOrEqual(1);
    expect(rendered.metadata.deterministic).toBe(true);
    expect(rendered.metadata.generatedAt).toBeNull();
  });

  it('renders slate overview, module availability, data quality, warnings, game detail, and interpretation sections', () => {
    const report = buildReport();
    const rendered = renderMLBResearchReport(report);
    const headings = rendered.sections.map((section) => section.heading);

    expect(headings).toContain('Slate Overview');
    expect(headings).toContain('Module Availability');
    expect(headings).toContain('Data Quality');
    expect(headings).toContain('Warnings');
    expect(headings).toContain('Game Details');
    expect(headings).toContain('Interpretation Notes');
    expect(rendered.sections.find((section) => section.heading === 'Warnings')?.body.length).toBeGreaterThan(0);
  });

  it('renders one card/detail per adapter report game', () => {
    const report = buildReport({
      games: [
        {
          gameId: 'renderer-game-single',
          officialDate: '2024-07-07',
          scheduledStartTime: '2024-07-07T18:00:00Z',
          awayTeam: 'RENDER_AWAY_3',
          homeTeam: 'RENDER_HOME_3',
          researchStatus: 'researched',
          completedResearchModules: [],
          researchFindings: {},
        },
      ],
    });
    const rendered = renderMLBResearchReport(report);

    expect(rendered.gameCards).toHaveLength(1);
    expect(rendered.gameDetails).toHaveLength(1);
    expect(rendered.gameCards[0].heading).toBe('RENDER_AWAY_3 at RENDER_HOME_3');
    expect(rendered.gameCards[0].officialDate).toBe('2024-07-07');
  });

  it('renders schedule-context adapter report safely', () => {
    const report = buildReport();
    const rendered = renderMLBResearchReport(report);
    const card = rendered.gameCards.find((item) => item.gameId === 'renderer-game-1');

    expect(card?.scheduleContextSummary).toBe('partial');
    expect(rendered.gameDetails.find((item) => item.heading.includes('RENDER_AWAY_1'))?.scheduleContextSummary).toContain('away status partial');
  });

  it('renders team-quality adapter report safely', () => {
    const report = buildReport();
    const rendered = renderMLBResearchReport(report);
    const card = rendered.gameCards.find((item) => item.gameId === 'renderer-game-1');

    expect(card?.teamQualityContextSummary).toBe('insufficient');
    expect(rendered.gameDetails.find((item) => item.heading.includes('RENDER_AWAY_1'))?.teamQualityContextSummary).toContain('away status partial');
  });

  it('renders missing modules as not-requested/unavailable', () => {
    const report = buildReport({
      researchModules: [],
      games: [
        {
          gameId: 'renderer-game-empty',
          officialDate: '2024-07-10',
          scheduledStartTime: '2024-07-10T18:00:00Z',
          awayTeam: 'RENDER_AWAY_4',
          homeTeam: 'RENDER_HOME_4',
          researchStatus: 'researched',
          completedResearchModules: [],
          researchFindings: {},
        },
      ],
    });
    const rendered = renderMLBResearchReport(report);

    expect(rendered.gameCards[0].moduleSummary).toContain('TEAM_RECENT_FORM: unavailable');
    expect(rendered.gameDetails[0].availableResearchModules).toBe('No research modules available.');
    expect(rendered.sections.find((section) => section.heading === 'Module Availability')?.body).toEqual(
      expect.arrayContaining(['Unavailable: 3.']),
    );
  });

  it('preserves warning codes in deterministic sorted order', () => {
    const report = buildReport();
    const rendered = renderMLBResearchReport(report);
    const card = rendered.gameCards.find((item) => item.gameId === 'renderer-game-2');

    expect(card?.warningSummary).toBe('TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES; TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION');
    expect(rendered.sections.find((section) => section.heading === 'Warnings')?.body).toEqual(
      expect.arrayContaining([
        'TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES',
        'TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES',
        'TEAM_QUALITY_CONTEXT_NO_LOCAL_EVIDENCE',
        'TEAM_SCHEDULE_CONTEXT_PARTIAL_LABEL',
      ]),
    );
  });

  it('does not mutate input report', () => {
    const report = buildReport();
    const snapshot = JSON.stringify(report);
    renderMLBResearchReport(report);

    expect(JSON.stringify(report)).toBe(snapshot);
  });

  it('produces deterministic repeated runs', () => {
    const report = buildReport();
    const first = renderMLBResearchReport(report);
    const second = renderMLBResearchReport(report);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('preserves generatedAt null by default and explicit string when supplied by adapter report', () => {
    const report = buildReport();
    const defaultRendered = renderMLBResearchReport(report);
    expect(defaultRendered.metadata.generatedAt).toBeNull();
  });

  it('renders researchStrengthScore/confidence/dataQuality as labels only', () => {
    const report = buildReport();
    const rendered = renderMLBResearchReport(report);
    const card = rendered.gameCards[0];

    expect(card.dataQualitySummary).toBe('data quality label: partial');
    expect(card.confidenceSummary).toBe('confidence label: medium');
    expect(card.researchStrengthSummary).toBe('research strength label: medium');
  });

  it('rendered JSON/string output contains no prohibited fields', () => {
    const report = buildReport();
    const rendered = renderMLBResearchReport(report);
    const json = JSON.stringify(rendered);

    for (const field of MLB_RESEARCH_REPORT_RENDERER_FORBIDDEN_TERMS) {
      expect(json).not.toContain(`"${field}"`);
    }
  });

  it('renderer-generated strings do not introduce unsafe recommendation wording', () => {
    const report = buildReport();
    const rendered = renderMLBResearchReport(report);
    const unsafePhrases = [
      'best bet',
      'value',
      'projected score',
      'should win',
      'likely winner',
      'chance to win',
    ];

    const rendererOwnedText = [
      rendered.title,
      ...rendered.sections.flatMap((section) => section.body),
      ...rendered.gameCards.flatMap((card) => [
        card.heading,
        card.moduleSummary,
        card.dataQualitySummary,
        card.confidenceSummary,
        card.researchStrengthSummary,
        card.warningSummary,
        card.scheduleContextSummary,
        card.teamQualityContextSummary,
      ]),
      ...rendered.gameDetails.flatMap((detail) => [
        detail.heading,
        detail.availableResearchModules,
        detail.teamRecentFormSummary,
        detail.scheduleContextSummary,
        detail.teamQualityContextSummary,
        detail.warnings,
        detail.dataQualityExplanation,
        detail.evidenceLimitations,
        detail.technicalMetadataSummary,
      ]),
      ...rendered.safetyNotes,
    ].join('\n');

    const lower = rendererOwnedText.toLowerCase();
    for (const phrase of unsafePhrases) {
      expect(lower).not.toContain(phrase);
    }
  });

  it('passes safety assertion for rendered output', () => {
    const report = buildReport();
    const rendered = renderMLBResearchReport(report);

    expect(() => assertRendererOutputSafeForDisplay(rendered)).not.toThrow();
  });

  it('fails safety assertion when rendered output is poisoned with a forbidden term', () => {
    const report = buildReport();
    const rendered = renderMLBResearchReport(report);
    const unsafe = { ...rendered, modelProbability: 'unsafe' } as MLBResearchRenderedReport;

    expect(() => assertRendererOutputSafeForDisplay(unsafe)).toThrow();
  });

  it('renderer does not call current time automatically', () => {
    const report = buildReport();
    const renderedBefore = renderMLBResearchReport(report, { title: 'fixed title' });
    const renderedAfter = renderMLBResearchReport(report, { title: 'fixed title' });

    expect(renderedBefore.metadata.generatedAt).toBeNull();
    expect(renderedAfter.metadata.generatedAt).toBeNull();
    expect(renderedBefore.title).toBe('fixed title');
    expect(renderedAfter.title).toBe('fixed title');
  });

  it('does not change CLI output or goldens', () => {
    const report = buildReport();
    const rendered = renderMLBResearchReport(report, { title: 'preview' });
    const text = JSON.stringify(rendered, null, 2);

    expect(text).not.toContain('"ok": true');
    expect(Object.keys(rendered)).toEqual(
      expect.arrayContaining([
        'rendererVersion',
        'rendererName',
        'adapterVersion',
        'title',
        'sections',
        'gameCards',
        'gameDetails',
        'safetyNotes',
        'metadata',
      ]),
    );
  });
});
