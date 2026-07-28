import { describe, expect, it, vi } from 'vitest';
import {
  handleMLBReportPreviewApiRequest,
  assertMLBReportPreviewApiHandlerSuccess,
} from '@/prospective/mlb/report-preview-api-handler';
import {
  MLB_REPORT_PREVIEW_UI_VIEW_MODEL_VERSION,
  MLB_REPORT_PREVIEW_UI_VIEW_MODEL_NAME,
  type MLBReportPreviewUIViewModel,
  buildMLBReportPreviewUIViewModelFromHandlerSuccess,
  validateMLBReportPreviewUIViewModel,
  assertMLBReportPreviewUIViewModel,
} from '@/prospective/mlb/report-preview-ui-view-model';
import {
  MLB_RESEARCH_REPORT_RENDERER_VERSION,
  MLB_RESEARCH_REPORT_RENDERER_NAME,
} from '@/prospective/mlb/research-report-renderer';

const BASE_REPORT_PREVIEW = {
  rendererVersion: MLB_RESEARCH_REPORT_RENDERER_VERSION,
  rendererName: MLB_RESEARCH_REPORT_RENDERER_NAME,
  adapterVersion: 'adapter-v1',
  title: 'Local manual/synthetic report preview',
  sections: [
    { heading: 'Summary', body: ['Synthetic summary'] },
  ],
  gameCards: [
    {
      heading: 'LOCAL_AWAY_1 at LOCAL_HOME_1',
      gameId: 'local-game-1',
      officialDate: '2024-07-02',
      scheduledStartTime: '2024-07-02T19:05:00Z',
      moduleSummary: 'Module summary',
      dataQualitySummary: 'data quality label: usable',
      confidenceSummary: 'Research confidence: high',
      researchStrengthSummary: 'Research coverage: medium',
      warningSummary: 'synthetic warning only',
      scheduleContextSummary: 'Schedule context',
      teamQualityContextSummary: 'Team quality context',
    },
  ],
  gameDetails: [
    {
      heading: 'LOCAL_AWAY_1 at LOCAL_HOME_1',
      availableResearchModules: 'modules',
      teamRecentFormSummary: 'recent form',
      scheduleContextSummary: 'schedule context',
      teamQualityContextSummary: 'team quality',
      warnings: 'warnings text',
      dataQualityExplanation: 'data quality explanation',
      evidenceLimitations: 'evidence limitations',
      technicalMetadataSummary: 'technical metadata',
    },
  ],
  safetyNotes: [
    'This report is derived only from local manual/synthetic evidence. No live schedule, odds, pitcher, or market data is included. Missing modules are shown as not-requested or unavailable.',
  ],
  metadata: {
    adapterVersion: 'adapter-v1',
    rendererVersion: MLB_RESEARCH_REPORT_RENDERER_VERSION,
    generatedAt: null,
    source: 'local-research-package',
    deterministic: true,
  },
};

function cloneReportPreview(overrides: Record<string, unknown> = {}) {
  return JSON.parse(JSON.stringify({ ...BASE_REPORT_PREVIEW, ...overrides }));
}

function buildHandlerSuccessForReportPreview(reportPreview: any) {
  const response = handleMLBReportPreviewApiRequest({ reportPreview } as any);
  assertMLBReportPreviewApiHandlerSuccess(response);
  return response;
}

function buildViewModelForReportPreview(reportPreview: any): MLBReportPreviewUIViewModel {
  const success = buildHandlerSuccessForReportPreview(reportPreview);
  return buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
}

function collectStrings(value: unknown): string[] {
  const out: string[] = [];
  if (typeof value === 'string') {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      out.push(...collectStrings(item));
    }
    return out;
  }
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      out.push(...collectStrings(child));
    }
  }
  return out;
}

function collectKeys(value: unknown): string[] {
  const out: string[] = [];
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      out.push(key);
      out.push(...collectKeys((value as Record<string, unknown>)[key]));
    }
  }
  return out;
}

describe('MLBReportPreviewUIViewModel synthetic coverage', () => {
  it('raw handler structures are not exposed in valid output', () => {
    const viewModel = buildViewModelForReportPreview(cloneReportPreview());
    const serialized = JSON.stringify(viewModel);
    expect(serialized).not.toContain('apiResponse');
    expect(serialized).not.toContain('reportPreview');
    expect(serialized).not.toContain('contractName');
    expect(serialized).not.toContain('"ok"');
    expect(serialized).not.toContain('"error"');
  });

  it('lower-layer error codes are not copied into recommendation text', () => {
    const success = buildHandlerSuccessForReportPreview(cloneReportPreview());
    const viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    const strings = collectStrings(viewModel);
    for (const forbidden of ['MISSING_REPORT_PREVIEW', 'PROHIBITED_FIELD', 'HANDLER_FAILURE']) {
      expect(strings.some((s) => s.includes(forbidden))).toBe(false);
    }
  });

  it('exact safe label semantics', () => {
    const reportPreview = cloneReportPreview({
      gameCards: [
        {
          heading: 'LOCAL_AWAY_1 at LOCAL_HOME_1',
          gameId: 'local-game-1',
          officialDate: '2024-07-02',
          scheduledStartTime: '2024-07-02T19:05:00Z',
          moduleSummary: 'Module summary',
          dataQualitySummary: 'data quality label: usable',
          confidenceSummary: 'Research confidence: high',
          researchStrengthSummary: 'Research coverage: medium',
          warningSummary: 'synthetic warning only',
          scheduleContextSummary: 'Schedule context',
          teamQualityContextSummary: 'Team quality context',
        },
      ],
    });
    const viewModel = buildViewModelForReportPreview(reportPreview);
    expect(viewModel.header.subtitle).toBe('Research preview');
    expect(viewModel.header.sourceLabel).toBe('Local report preview');
    expect(viewModel.header.generatedAtLabel).toBe('Local deterministic preview');
    expect(viewModel.safetyBanner.heading).toBe('Limitations');
    expect(viewModel.gameCards[0].dataQualityLabel).toMatch(/data quality/);
    expect(viewModel.gameCards[0].confidenceLabel).toMatch(/research confidence|data confidence/i);
    expect(viewModel.gameCards[0].confidenceLabel).not.toMatch(/win|winner|probability|betting|odds|edge|favourite|favorite|underdog/i);
    expect(viewModel.gameCards[0].researchStrengthLabel).toMatch(/research coverage|research strength/i);
    expect(viewModel.gameCards[0].researchStrengthLabel).not.toMatch(/probability|rank|team superiority|winner|pick confidence/i);
    expect(viewModel.gameCards[0].dataQualityLabel).toMatch(/data quality/i);
  });

  const metadataRequiredPaths = [
    ['metadata.handlerVersion', 'MISSING_METADATA_HANDLER_VERSION'],
    ['metadata.contractVersion', 'MISSING_METADATA_CONTRACT_VERSION'],
    ['metadata.rendererVersion', 'MISSING_METADATA_RENDERER_VERSION'],
    ['metadata.adapterVersion', 'MISSING_METADATA_ADAPTER_VERSION'],
    ['metadata.generatedAt', 'MISSING_METADATA_GENERATED_AT'],
  ];

  for (const [path, errorCode] of metadataRequiredPaths) {
    it(`rejects missing required metadata ${path}`, () => {
      const success = buildHandlerSuccessForReportPreview(cloneReportPreview());
      let viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
      const metadata = { ...viewModel.metadata };
      delete (metadata as any)[path.replace('metadata.', '')];
      viewModel = { ...viewModel, metadata } as MLBReportPreviewUIViewModel;
      const result = validateMLBReportPreviewUIViewModel(viewModel);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === errorCode)).toBe(true);
      }
    });
  }

  it('rejects source live', () => {
    const success = buildHandlerSuccessForReportPreview(cloneReportPreview());
    let viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    viewModel = {
      ...viewModel,
      metadata: { ...viewModel.metadata, source: 'live' as any },
    } as MLBReportPreviewUIViewModel;
    const result = validateMLBReportPreviewUIViewModel(viewModel);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_SOURCE')).toBe(true);
    }
  });

  it('rejects deterministic false', () => {
    const success = buildHandlerSuccessForReportPreview(cloneReportPreview());
    let viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    viewModel = {
      ...viewModel,
      metadata: { ...viewModel.metadata, deterministic: false as any },
    } as MLBReportPreviewUIViewModel;
    const result = validateMLBReportPreviewUIViewModel(viewModel);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_DETERMINISTIC')).toBe(true);
    }
  });

  const unsafeLabelCases = [
    { title: 'Win probability: 65%', match: /win probability/i },
    { title: 'Team power ranking #1', match: /power ranking/i },
    { title: 'Best bet quality', match: /best bet/i },
  ];

  for (const badCase of unsafeLabelCases) {
    it(`rejects unsafe label: ${badCase.title}`, () => {
      const success = buildHandlerSuccessForReportPreview(cloneReportPreview());
      let viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
      viewModel = { ...viewModel, title: badCase.title } as MLBReportPreviewUIViewModel;
      const result = validateMLBReportPreviewUIViewModel(viewModel);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === 'PROHIBITED_VALUE_TEXT')).toBe(true);
      }
    });
  }

  it('rejects unsafe nested text in sections', () => {
    const viewModel = buildViewModelForReportPreview(cloneReportPreview());
    const sections = [
      { ...(viewModel.sections[0] as any), body: ['Team A should win.'] },
    ];
    const result = validateMLBReportPreviewUIViewModel({
      ...viewModel,
      sections,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'PROHIBITED_VALUE_TEXT')).toBe(true);
    }
  });

  it('rejects unsafe nested text in game cards warningSummary', () => {
    const viewModel = buildViewModelForReportPreview(cloneReportPreview());
    const gameCards = [
      { ...(viewModel.gameCards[0] as any), warningSummary: 'Likely winner limitation' },
    ];
    const result = validateMLBReportPreviewUIViewModel({
      ...viewModel,
      gameCards,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'PROHIBITED_VALUE_TEXT')).toBe(true);
    }
  });

  it('rejects unsafe nested text in game detail warnings', () => {
    const viewModel = buildViewModelForReportPreview(cloneReportPreview());
    const gameDetails = [
      { ...(viewModel.gameDetails[0] as any), warnings: 'Market edge material should win' },
    ];
    const result = validateMLBReportPreviewUIViewModel({
      ...viewModel,
      gameDetails,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'PROHIBITED_VALUE_TEXT')).toBe(true);
    }
  });

  it('rejects extra/missing game detail count mismatch', () => {
    const viewModel = buildViewModelForReportPreview(cloneReportPreview());
    const result = validateMLBReportPreviewUIViewModel({
      ...viewModel,
      gameDetails: [viewModel.gameDetails[0], viewModel.gameDetails[0]],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'GAME_CARD_DETAIL_COUNT_MISMATCH')).toBe(true);
    }
  });

  it('accepts duplicate gameId because uniqueness is not enforced', () => {
    const viewModel = buildViewModelForReportPreview(cloneReportPreview());
    const result = validateMLBReportPreviewUIViewModel({
      ...viewModel,
      gameCards: [
        viewModel.gameCards[0],
        { ...viewModel.gameCards[0], gameId: 'local-game-1' },
      ],
      gameDetails: [
        viewModel.gameDetails[0],
        { ...viewModel.gameDetails[0], heading: 'Second detail' },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.errors).toEqual([]);
    }
  });

  it('rejects non-array sections', () => {
    const viewModel = buildViewModelForReportPreview(cloneReportPreview());
    const result = validateMLBReportPreviewUIViewModel({
      ...viewModel,
      sections: {} as any,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_SECTIONS')).toBe(true);
    }
  });

  it('rejects non-array gameCards', () => {
    const viewModel = buildViewModelForReportPreview(cloneReportPreview());
    const result = validateMLBReportPreviewUIViewModel({
      ...viewModel,
      gameCards: {} as any,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_GAME_CARDS')).toBe(true);
    }
  });

  it('rejects non-array gameDetails', () => {
    const viewModel = buildViewModelForReportPreview(cloneReportPreview());
    const result = validateMLBReportPreviewUIViewModel({
      ...viewModel,
      gameDetails: {} as any,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_GAME_DETAILS')).toBe(true);
    }
  });

  it('rejects non-array warnings', () => {
    const viewModel = buildViewModelForReportPreview(cloneReportPreview());
    const result = validateMLBReportPreviewUIViewModel({
      ...viewModel,
      warnings: {} as any,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_WARNINGS')).toBe(true);
    }
  });

  it('rejects section missing heading', () => {
    const viewModel = buildViewModelForReportPreview(cloneReportPreview());
    const sections = [
      { ...(viewModel.sections[0] as any), heading: '' },
    ];
    const result = validateMLBReportPreviewUIViewModel({
      ...viewModel,
      sections,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'MISSING_SECTION_HEADING')).toBe(true);
    }
  });

  it('rejects section body that is not a string array', () => {
    const viewModel = buildViewModelForReportPreview(cloneReportPreview());
    const sections = [
      { ...(viewModel.sections[0] as any), body: 'bad' },
    ];
    const result = validateMLBReportPreviewUIViewModel({
      ...viewModel,
      sections,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_SECTION_BODY')).toBe(true);
    }
  });

  it('rejects game card missing gameId', () => {
    const viewModel = buildViewModelForReportPreview(cloneReportPreview());
    const gameCards = [
      { ...(viewModel.gameCards[0] as any), gameId: '' },
    ];
    const result = validateMLBReportPreviewUIViewModel({
      ...viewModel,
      gameCards,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'MISSING_GAME_CARD_GAME_ID')).toBe(true);
    }
  });

  it('rejects game card with non-string officialDate', () => {
    const viewModel = buildViewModelForReportPreview(cloneReportPreview());
    const gameCards = [
      { ...(viewModel.gameCards[0] as any), officialDate: 2024 as any },
    ];
    const result = validateMLBReportPreviewUIViewModel({
      ...viewModel,
      gameCards,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_GAME_CARD_OFFICIAL_DATE')).toBe(true);
    }
  });

  it('rejects game card with non-string scheduledStartTime', () => {
    const viewModel = buildViewModelForReportPreview(cloneReportPreview());
    const gameCards = [
      { ...(viewModel.gameCards[0] as any), scheduledStartTime: null as any },
    ];
    const result = validateMLBReportPreviewUIViewModel({
      ...viewModel,
      gameCards,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'INVALID_GAME_CARD_SCHEDULED_START')).toBe(true);
    }
  });

  it('rejects game detail missing heading', () => {
    const viewModel = buildViewModelForReportPreview(cloneReportPreview());
    const gameDetails = [
      { ...(viewModel.gameDetails[0] as any), heading: '' },
    ];
    const result = validateMLBReportPreviewUIViewModel({
      ...viewModel,
      gameDetails,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'MISSING_GAME_DETAIL_HEADING')).toBe(true);
    }
  });

  it('rejects warning missing code', () => {
    const viewModel = buildViewModelForReportPreview(cloneReportPreview());
    const warnings = [
      { ...(viewModel.warnings[0] as any), code: '' },
    ];
    const result = validateMLBReportPreviewUIViewModel({
      ...viewModel,
      warnings,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'MISSING_WARNING_CODE')).toBe(true);
    }
  });

  it('rejects warning missing message', () => {
    const viewModel = buildViewModelForReportPreview(cloneReportPreview());
    const warnings = [
      { ...(viewModel.warnings[0] as any), message: '' },
    ];
    const result = validateMLBReportPreviewUIViewModel({
      ...viewModel,
      warnings,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'MISSING_WARNING_MESSAGE')).toBe(true);
    }
  });

  it('is deterministic across repeated calls', () => {
    const reportPreview = cloneReportPreview();
    const first = buildViewModelForReportPreview(reportPreview);
    const second = buildViewModelForReportPreview(reportPreview);
    const third = buildViewModelForReportPreview(reportPreview);
    expect(first).toEqual(second);
    expect(second).toEqual(third);
  });

  it('does not mutate input or call current time', () => {
    const reportPreview = cloneReportPreview();
    const snapshot = JSON.stringify(reportPreview);
    const success = buildHandlerSuccessForReportPreview(reportPreview);
    expect(success.metadata.generatedAt).toBeNull();
    const viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
    const result = validateMLBReportPreviewUIViewModel(viewModel);
    expect(result.ok).toBe(true);
    expect(JSON.stringify(reportPreview)).toBe(snapshot);
  });

  it('contains no prohibited key names', () => {
    const viewModel = buildViewModelForReportPreview(cloneReportPreview());
    const keys = collectKeys(viewModel);
    const forbiddenKeys = new Set([
      'apiResponse',
      'reportPreview',
      'contractName',
      'odds',
      'sportsbook',
      'market',
      'price',
      'edge',
      'roi',
      'impliedProbability',
      'winProbability',
      'winner',
      'pick',
      'bestBet',
      'powerRanking',
      'teamRanking',
      'standingsPosition',
      'finalScore',
      'rawOutcome',
      'actualStartingPitcher',
      'pitcherEvidence',
      'historicalFixtures',
    ]);
    for (const key of keys) {
      expect(forbiddenKeys.has(key)).toBe(false);
    }
  });

  it('allows safe words that contain roi as a substring', () => {
    const viewModel = buildViewModelForReportPreview(cloneReportPreview());
    const sections = [
      { ...(viewModel.sections[0] as any), body: ['heroine'] },
    ];
    const result = validateMLBReportPreviewUIViewModel({
      ...viewModel,
      sections,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.errors).toEqual([]);
    }
  });

  it('contains no unsafe advice phrases', () => {
    const viewModel = buildViewModelForReportPreview(cloneReportPreview());
    const strings = collectStrings(viewModel);
    const unsafePhrases = [
      'should win',
      'likely winner',
      'best bet',
      'value bet',
      'win probability',
      'market edge',
      'sportsbook',
      'power ranking',
      'team ranking',
      'favourite',
      'favorite',
      'underdog',
    ];
    for (const phrase of unsafePhrases) {
      expect(
        strings.some((s) => s.toLowerCase().includes(phrase)),
      ).toBe(false);
    }
  });

  it('rejects direct raw reportPreview', () => {
    const reportPreview = cloneReportPreview();
    expect(() =>
      buildMLBReportPreviewUIViewModelFromHandlerSuccess(reportPreview as any),
    ).toThrow('MLB_REPORT_PREVIEW_UI_VIEW_MODEL requires successful handler response.');
  });

  it('rejects raw research-package shaped input', () => {
    const bad: any = {
      rendererVersion: 'v1',
      packages: [{ type: 'research' }],
    };
    expect(() => buildMLBReportPreviewUIViewModelFromHandlerSuccess(bad)).toThrow();
  });

  it('rejects raw historical-fixture shaped input', () => {
    const bad: any = {
      records: [{ gameId: 'x', game: {} }],
    };
    expect(() => buildMLBReportPreviewUIViewModelFromHandlerSuccess(bad)).toThrow();
  });

  if (typeof globalThis.fetch === 'function') {
    it('does not call global fetch during build or validation', () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      try {
        const success = buildHandlerSuccessForReportPreview(cloneReportPreview());
        const viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
        const result = validateMLBReportPreviewUIViewModel(viewModel);
        expect(result.ok).toBe(true);
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        fetchSpy.mockRestore();
      }
    });
  }
});
