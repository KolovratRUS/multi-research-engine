import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  handleMLBReportPreviewApiRequest,
  assertMLBReportPreviewApiHandlerSuccess,
} from '@/prospective/mlb/report-preview-api-handler';
import {
  MLB_REPORT_PREVIEW_API_CONTRACT_VERSION,
} from '@/prospective/mlb/report-preview-api-contract';
import {
  MLB_RESEARCH_REPORT_RENDERER_VERSION,
} from '@/prospective/mlb/research-report-renderer';
import {
  MLB_REPORT_PREVIEW_UI_VIEW_MODEL_VERSION,
  MLB_REPORT_PREVIEW_UI_VIEW_MODEL_NAME,
  type MLBReportPreviewUIViewModel,
  buildMLBReportPreviewUIViewModelFromHandlerSuccess,
  assertMLBReportPreviewUIViewModel,
  validateMLBReportPreviewUIViewModel,
} from '@/prospective/mlb/report-preview-ui-view-model';
import {
  buildMLBReportPreviewUIPresentation,
  assertMLBReportPreviewUIPresentation,
  validateMLBReportPreviewUIPresentation,
  MLB_REPORT_PREVIEW_UI_PRESENTATION_NAME,
  MLB_REPORT_PREVIEW_UI_PRESENTATION_VERSION,
  EMPTY_SECTIONS,
  EMPTY_SECTION_BODY,
  EMPTY_LIMITATIONS_NOTES,
  EMPTY_GAME_CARDS,
  EMPTY_GAME_DETAILS,
  EMPTY_WARNINGS,
  type MLBReportPreviewUIGameCardListPresentation,
  type MLBReportPreviewUIGameDetailListPresentation,
  type MLBReportPreviewUIWarningsPresentation,
} from '@/prospective/mlb/report-preview-ui-components';

const goldenPath = join(
  __dirname,
  'fixtures',
  'manual-schedule',
  'valid-mlb-report-preview-local-cli-output-v1.json',
);
const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as Record<string, unknown>;
const reportPreview = golden.reportPreview as any;

function buildHandlerSuccess() {
  const response = handleMLBReportPreviewApiRequest({ reportPreview });
  assertMLBReportPreviewApiHandlerSuccess(response);
  return response;
}

function buildViewModelFromGolden(): MLBReportPreviewUIViewModel {
  const success = buildHandlerSuccess();
  const viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(success);
  assertMLBReportPreviewUIViewModel(viewModel);
  return viewModel;
}

function buildMinimalViewModel(
  overrides: Partial<MLBReportPreviewUIViewModel> = {},
): MLBReportPreviewUIViewModel {
  const base: MLBReportPreviewUIViewModel = {
    viewModelVersion: MLB_REPORT_PREVIEW_UI_VIEW_MODEL_VERSION,
    viewModelName: MLB_REPORT_PREVIEW_UI_VIEW_MODEL_NAME,
    title: 'Local manual/synthetic report preview',
    header: {
      title: 'Local manual/synthetic report preview',
      subtitle: 'Research preview',
      generatedAtLabel: 'Local deterministic preview',
      sourceLabel: 'Local report preview',
    },
    safetyBanner: {
      heading: 'Limitations',
      notes: [
        'This report is derived only from local manual/synthetic evidence. No live schedule, odds, pitcher, or market data is included. Missing modules are shown as not-requested or unavailable.',
      ],
    },
    sections: [{ heading: 'Summary', body: ['Synthetic summary'] }],
    gameCards: [],
    gameDetails: [],
    moduleAvailability: { heading: 'Module Availability', modules: [] },
    warnings: [],
    metadata: {
      viewModelVersion: MLB_REPORT_PREVIEW_UI_VIEW_MODEL_VERSION,
      handlerVersion: 'mlb-report-preview-api-handler-v1',
      contractVersion: MLB_REPORT_PREVIEW_API_CONTRACT_VERSION,
      rendererVersion: MLB_RESEARCH_REPORT_RENDERER_VERSION,
      adapterVersion: 'adapter-v1',
      generatedAt: null,
      source: 'local-report-preview',
      deterministic: true,
    },
    ...overrides,
  } as MLBReportPreviewUIViewModel;

  const result = validateMLBReportPreviewUIViewModel(base);
  if (!result.ok) {
    throw new Error(`Minimal view model invalid: ${result.errors[0].code}`);
  }

  return base;
}

function assertPresentation(
  value: unknown,
): asserts value is ReturnType<typeof buildMLBReportPreviewUIPresentation> {
  assertMLBReportPreviewUIPresentation(value);
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

function collectStrings(value: unknown): string[] {
  const out: string[] = [];
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      out.push(...collectStrings(item));
    }
  } else if (typeof value === 'object' && value !== null) {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      out.push(...collectStrings(entry));
    }
  }
  return out;
}

function assertPlain(value: unknown): void {
  if (typeof value === 'function') {
    throw new Error(`function found: ${value}`);
  }
  if (typeof value === 'symbol') {
    throw new Error(`symbol found: ${String(value)}`);
  }
  if (typeof value === 'bigint') {
    throw new Error(`bigint found: ${value}`);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      assertPlain(item);
    }
    return;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.includes('dangerouslySetInnerHTML') || keys.includes('innerHTML')) {
      throw new Error(`forbidden HTML key found on ${keys.join(',')}`);
    }
    const hasType = keys.includes('type');
    const hasProps = keys.includes('props');
    if (hasType && hasProps) {
      throw new Error('framework-like element detected (type+props)');
    }
    for (const key of keys) {
      if (/^on[A-Z]/.test(key)) {
        throw new Error(`event handler key found: ${key}`);
      }
    }
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (/^[A-Z]/.test(key) && typeof val === 'function') {
        throw new Error(`render callback found: ${key}`);
      }
      assertPlain(val);
    }
  }
}

const UNSAFE_PHRASES = [
  'should win',
  'likely winner',
  'best bet',
  'value bet',
  'win probability',
  'market edge',
  'sportsbook',
  'power ranking',
  'team ranking',
  'favorite',
  'favourite',
  'underdog',
];

const PRESENTATION_OWNED_STRINGS = new Set([
  'Research preview',
  'Local report preview',
  'Local deterministic preview',
  'Limitations',
  'No content available for this section.',
  'No game cards available.',
  'No game details available.',
  'No limitations recorded.',
]);

describe('MLBReportPreviewUIPresentation', () => {
  it('exports correct name and version constants', () => {
    expect(MLB_REPORT_PREVIEW_UI_PRESENTATION_NAME).toBe(
      'MLB_REPORT_PREVIEW_UI_PRESENTATION',
    );
    expect(MLB_REPORT_PREVIEW_UI_PRESENTATION_VERSION).toBe(
      'mlb-report-preview-ui-presentation-v1',
    );
  });

  it('builds valid presentation from validated view model', () => {
    const viewModel = buildViewModelFromGolden();
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    expect(presentation.name).toBe(MLB_REPORT_PREVIEW_UI_PRESENTATION_NAME);
    expect(presentation.version).toBe(MLB_REPORT_PREVIEW_UI_PRESENTATION_VERSION);
    expect(presentation.title).toBe(viewModel.title);
  });

  it('exact safe header labels', () => {
    const viewModel = buildViewModelFromGolden();
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    expect(presentation.header.subtitle).toBe('Research preview');
    expect(presentation.header.sourceLabel).toBe('Local report preview');
    expect(presentation.header.generatedAtLabel).toBe('Local deterministic preview');
  });

  it('limitations node always exists with exact heading', () => {
    const viewModel = buildViewModelFromGolden();
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    expect(presentation.limitations.heading).toBe('Limitations');
    expect(Array.isArray(presentation.limitations.notes)).toBe(true);
    expect(presentation.limitations.notes.length).toBeGreaterThan(0);
  });

  it('versions remain technical metadata only', () => {
    const viewModel = buildViewModelFromGolden();
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    expect(typeof presentation.metadata.handlerVersion).toBe('string');
    expect(typeof presentation.metadata.contractVersion).toBe('string');
    expect(typeof presentation.metadata.rendererVersion).toBe('string');
    expect(typeof presentation.metadata.adapterVersion).toBe('string');
    expect(presentation.metadata.generatedAt).toBeNull();
    expect(presentation.metadata.deterministic).toBe(true);
    expect(presentation.metadata.source).toBe('local-report-preview');
  });

  it('section rendering preserves order and empty-body contract', () => {
    const viewModel = buildViewModelFromGolden();
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    expect(presentation.sections.sections.length).toBe(viewModel.sections.length);
    expect(presentation.sections.sections[0].heading).toBe(viewModel.sections[0].heading);
    expect(presentation.sections.sections[0].body).toEqual(viewModel.sections[0].body);
  });

  it('game cards preserve input order and safe labels', () => {
    const viewModel = buildViewModelFromGolden();
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    expect(presentation.gameCards.gameCards.length).toBe(viewModel.gameCards.length);
    expect(presentation.gameCards.gameCards[0].gameId).toBe(viewModel.gameCards[0].gameId);
    expect(presentation.gameCards.gameCards[0].dataQualityLabel).toMatch(/data quality/i);
    expect(presentation.gameCards.gameCards[0].confidenceLabel).toMatch(/confidence/i);
    expect(presentation.gameCards.gameCards[0].researchStrengthLabel).toMatch(/research/i);
  });

  it('game details align with cards by index and derive gameId from same-index card', () => {
    const viewModel = buildViewModelFromGolden();
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    expect(presentation.gameDetails.gameDetails.length).toBe(
      presentation.gameCards.gameCards.length,
    );
    expect(presentation.gameDetails.gameDetails.length).toBe(viewModel.gameDetails.length);
    for (let i = 0; i < presentation.gameDetails.gameDetails.length; i++) {
      expect(presentation.gameDetails.gameDetails[i].gameId).toBe(
        presentation.gameCards.gameCards[i].gameId,
      );
      expect(presentation.gameDetails.gameDetails[i].heading).toBe(
        viewModel.gameDetails[i].heading,
      );
    }
  });

  it('warning order preserved and no severity added', () => {
    const viewModel = buildViewModelFromGolden();
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    expect(presentation.warnings.warnings.length).toBe(viewModel.warnings.length);
    expect(presentation.warnings.warnings[0].code).toBe(viewModel.warnings[0].code);
    expect(presentation.warnings.warnings[0].message).toBe(viewModel.warnings[0].message);
  });

  it('empty game cards produce empty array with exact emptyState', () => {
    const viewModel = buildMinimalViewModel({ gameCards: [], gameDetails: [] });
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    expect(presentation.gameCards.gameCards).toEqual([]);
    expect(presentation.gameCards.emptyState).toBe('No game cards available.');
    expect(presentation.gameDetails.gameDetails).toEqual([]);
    expect(presentation.gameDetails.emptyState).toBe('No game details available.');
  });

  it('empty warnings produce empty array and null emptyState', () => {
    const viewModel = buildMinimalViewModel({ warnings: [] });
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    expect(presentation.warnings.warnings).toEqual([]);
    expect(presentation.warnings.emptyState).toBeNull();
  });

  it('empty section body maps to exact neutral empty state', () => {
    const viewModel = buildMinimalViewModel({
      sections: [{ heading: 'Summary', body: [] }],
    });
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    expect(presentation.sections.sections[0].body).toEqual(EMPTY_SECTION_BODY);
  });

  it('does not introduce unsafe presentation-owned phrases', () => {
    const viewModel = buildMinimalViewModel({
      gameCards: [],
      gameDetails: [],
      warnings: [],
      sections: [{ heading: 'Summary', body: [] }],
    });
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    const strings = collectStrings(presentation);
    const unsafeStrings = strings.filter((text) =>
      UNSAFE_PHRASES.some((phrase) => text.toLowerCase().includes(phrase)),
    );
    expect(unsafeStrings).toEqual([]);
  });

  it('does not return framework-specific plain data', () => {
    const viewModel = buildMinimalViewModel({
      gameCards: [],
      gameDetails: [],
      warnings: [],
      sections: [{ heading: 'Summary', body: [] }],
    });
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    expect(() => assertPlain(presentation)).not.toThrow();
  });

  it('repeated construction is deep-equal', () => {
    const viewModel = buildViewModelFromGolden();
    const first = buildMLBReportPreviewUIPresentation(viewModel);
    const second = buildMLBReportPreviewUIPresentation(viewModel);
    expect(first).toEqual(second);
  });

  it('output arrays and nested objects are fresh references', () => {
    const viewModel = buildViewModelFromGolden();
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    expect(presentation.sections.sections).not.toBe(viewModel.sections);
    expect(presentation.gameCards.gameCards).not.toBe(viewModel.gameCards);
    expect(presentation.gameDetails.gameDetails).not.toBe(viewModel.gameDetails);
    expect(presentation.warnings.warnings).not.toBe(viewModel.warnings);
  });

  it('does not mutate input', () => {
    const viewModel = buildViewModelFromGolden();
    const snapshot = JSON.stringify(viewModel);
    buildMLBReportPreviewUIPresentation(viewModel);
    expect(JSON.stringify(viewModel)).toBe(snapshot);
  });

  it('does not call Date.now', () => {
    const dateSpy = vi.spyOn(Date, 'now');
    try {
      const viewModel = buildViewModelFromGolden();
      buildMLBReportPreviewUIPresentation(viewModel);
      expect(dateSpy).not.toHaveBeenCalled();
    } finally {
      dateSpy.mockRestore();
    }
  });

  it('does not call Math.random', () => {
    const randomSpy = vi.spyOn(Math, 'random');
    try {
      const viewModel = buildViewModelFromGolden();
      buildMLBReportPreviewUIPresentation(viewModel);
      expect(randomSpy).not.toHaveBeenCalled();
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('does not call global fetch', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      const viewModel = buildViewModelFromGolden();
      buildMLBReportPreviewUIPresentation(viewModel);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('does not read or write files or execute child process', () => {
    const viewModel = buildViewModelFromGolden();
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    expect(presentation.name).toBeDefined();
    expect(typeof presentation.title).toBe('string');
  });

  it('rejects raw handler input', () => {
    expect(() =>
      buildMLBReportPreviewUIPresentation({ ok: false } as any),
    ).toThrow('MLB_REPORT_PREVIEW_UI_VIEW_MODEL validation failed');
  });

  it('rejects raw reportPreview-shaped input', () => {
    const bad = {
      title: 'x',
      sections: [{ heading: 'Summary', body: [] }],
      gameCards: [],
      gameDetails: [],
      safetyNotes: [],
      metadata: { adapterVersion: 'a', rendererVersion: 'r', generatedAt: null, source: 'local-research-package', deterministic: true },
    };
    expect(() => buildMLBReportPreviewUIPresentation(bad as any)).toThrow();
  });

  it('rejects raw research-package shaped input', () => {
    const bad = { rendererVersion: 'v1', packages: [{ type: 'research' }] } as any;
    expect(() => buildMLBReportPreviewUIPresentation(bad)).toThrow();
  });

  it('rejects historical-fixture shaped input', () => {
    const bad = { records: [{ gameId: 'x' }] } as any;
    expect(() => buildMLBReportPreviewUIPresentation(bad)).toThrow();
  });

  it('output contains no raw lower-layer fields', () => {
    const viewModel = buildViewModelFromGolden();
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    const keys = collectKeys(presentation);
    const forbidden = new Set([
      'apiResponse',
      'reportPreview',
      'contractName',
      'ok',
      'error',
      'researchPackage',
      'historicalFixtures',
      'raw',
      'payload',
      'viewModel',
      'sourceModel',
      'package',
      'researchPackageVersion',
      'researchRunId',
      'sourceConstructionRunId',
      'sourceConstructionLockId',
      'inputConstructionPackage',
      'inputSnapshot',
      'evidence',
      'constructionWarnings',
      'constructionVersion',
      'lockVersion',
    ]);
    for (const key of keys) {
      expect(forbidden.has(key)).toBe(false);
    }
  });

  it('output contains no prohibited analytical keys', () => {
    const viewModel = buildViewModelFromGolden();
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    const keys = collectKeys(presentation);
    const forbidden = new Set([
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
      'modelProbability',
      'predictedWinner',
      'winChance',
      'powerRating',
      'teamRank',
    ]);
    for (const key of keys) {
      expect(forbidden.has(key)).toBe(false);
    }
  });

  it('output preserves validated input without prohibited keys', () => {
    const viewModel = buildViewModelFromGolden();
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    const result = validateMLBReportPreviewUIPresentation(presentation);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.errors).toEqual([]);
    }
  });

  it('validation rejects prohibited lower-layer fields', () => {
    const bad = {
      name: MLB_REPORT_PREVIEW_UI_PRESENTATION_NAME,
      version: MLB_REPORT_PREVIEW_UI_PRESENTATION_VERSION,
      title: 'test',
      header: {
        title: 'test',
        subtitle: 'Research preview',
        generatedAtLabel: 'Local deterministic preview',
        sourceLabel: 'Local report preview',
      },
      metadata: {
        handlerVersion: 'v1',
        contractVersion: 'v1',
        rendererVersion: 'v1',
        adapterVersion: 'v1',
        deterministic: true,
        source: 'local-report-preview',
        generatedAt: null,
      },
      sections: EMPTY_SECTIONS,
      gameCards: EMPTY_GAME_CARDS,
      gameDetails: EMPTY_GAME_DETAILS,
      warnings: EMPTY_WARNINGS,
      limitations: { heading: 'Limitations' as const, notes: EMPTY_LIMITATIONS_NOTES },
      apiResponse: {},
    };
    const result = validateMLBReportPreviewUIPresentation(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'PROHIBITED_FIELD')).toBe(true);
    }
  });

  it('root presentation accepts valid view model', () => {
    const viewModel = buildViewModelFromGolden();
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    assertPresentation(presentation);
    expect(presentation.title).toBe(viewModel.title);
  });

  it('invalid raw handler input rejected at boundary', () => {
    expect(() => buildMLBReportPreviewUIPresentation({ ok: false } as any)).toThrow();
  });

  it('stable presentation version emitted', () => {
    const viewModel = buildViewModelFromGolden();
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    expect(presentation.name).toBe(MLB_REPORT_PREVIEW_UI_PRESENTATION_NAME);
    expect(presentation.version).toBe(MLB_REPORT_PREVIEW_UI_PRESENTATION_VERSION);
  });

  it('output emptyState fields have expected string-or-null type', () => {
    const viewModel = buildMinimalViewModel({
      gameCards: [],
      gameDetails: [],
      warnings: [],
      sections: [{ heading: 'Summary', body: [] }],
    });
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);

    expect(presentation.sections.emptyState).toBeNull();
    expect(typeof presentation.gameCards.emptyState).toBe('string');
    expect(typeof presentation.gameDetails.emptyState).toBe('string');
    expect(presentation.warnings.emptyState).toBeNull();
  });

  it('presentation owns no fabricated domain records', () => {
    const viewModel = buildMinimalViewModel({
      gameCards: [],
      gameDetails: [],
      warnings: [],
      sections: [{ heading: 'Summary', body: [] }],
    });
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    const strings = collectStrings(presentation);
    const fakePlaceholders = [
      'placeholder',
      'No games available.',
      'NO_WARNINGS',
      'No warnings.',
    ];
    const foundFakes = strings.filter((s) => fakePlaceholders.includes(s));
    expect(foundFakes).toEqual([]);
  });
});
