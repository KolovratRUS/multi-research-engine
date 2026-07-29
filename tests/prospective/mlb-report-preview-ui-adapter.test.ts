import { describe, expect, it, vi } from 'vitest';
import type {
  MLBReportPreviewUIPresentation,
} from '@/prospective/mlb/report-preview-ui-components';
import type {
  MLBReportPreviewApiHandlerSuccess,
} from '@/prospective/mlb/report-preview-api-handler';
import {
  MLB_REPORT_PREVIEW_UI_PRESENTATION_NAME,
  MLB_REPORT_PREVIEW_UI_PRESENTATION_VERSION,
  buildMLBReportPreviewUIPresentation,
  assertMLBReportPreviewUIPresentation,
  validateMLBReportPreviewUIPresentation,
} from '@/prospective/mlb/report-preview-ui-components';
import {
  MLB_REPORT_PREVIEW_API_CONTRACT_VERSION,
} from '@/prospective/mlb/report-preview-api-contract';
import type {
  MLBReportPreviewUIViewModel,
} from '@/prospective/mlb/report-preview-ui-view-model';
import {
  MLB_REPORT_PREVIEW_UI_VIEW_MODEL_VERSION,
  MLB_REPORT_PREVIEW_UI_VIEW_MODEL_NAME,
  buildMLBReportPreviewUIViewModelFromHandlerSuccess,
  assertMLBReportPreviewUIViewModel,
  validateMLBReportPreviewUIViewModel,
} from '@/prospective/mlb/report-preview-ui-view-model';
import {
  MLB_REPORT_PREVIEW_UI_ADAPTER_NAME,
  MLB_REPORT_PREVIEW_UI_ADAPTER_VERSION,
  MLB_REPORT_PREVIEW_UI_ADAPTER_ROOT_NODE_ORDER,
  type MLBReportPreviewUIAdapterDocument,
  type MLBReportPreviewUIAdapterNode,
  buildMLBReportPreviewUIAdapterDocument,
  validateMLBReportPreviewUIAdapterDocument,
  assertMLBReportPreviewUIAdapterDocument,
} from '@/prospective/mlb/report-preview-ui-adapter';
import { handleMLBReportPreviewApiRequest } from '@/prospective/mlb/report-preview-api-handler';
import { MLB_RESEARCH_REPORT_RENDERER_VERSION } from '@/prospective/mlb/research-report-renderer';

function buildMinimalViewModel(
  overrides: Partial<MLBReportPreviewUIViewModel> = {},
): MLBReportPreviewUIViewModel {
  const base: MLBReportPreviewUIViewModel = {
    viewModelVersion: MLB_REPORT_PREVIEW_UI_VIEW_MODEL_VERSION,
    viewModelName: MLB_REPORT_PREVIEW_UI_VIEW_MODEL_NAME,
    title: 'Adapter test report preview',
    header: {
      title: 'Adapter test report preview',
      subtitle: 'Research preview',
      generatedAtLabel: 'Local deterministic preview',
      sourceLabel: 'Local report preview',
    },
    safetyBanner: {
      heading: 'Limitations',
      notes: [
        'Adapter test limitations.',
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
  };

  const result = validateMLBReportPreviewUIViewModel(base);
  if (!result.ok) {
    throw new Error(`Minimal view model invalid: ${result.errors[0].code}`);
  }
  return base;
}

function buildAdapterDocument(
  presentation: MLBReportPreviewUIPresentation,
): MLBReportPreviewUIAdapterDocument {
  return buildMLBReportPreviewUIAdapterDocument(presentation);
}

function buildEmptyPresentation(): MLBReportPreviewUIPresentation {
  const viewModel = buildMinimalViewModel();
  const base = buildMLBReportPreviewUIPresentation(viewModel);
  return {
    ...base,
    sections: {
      ...base.sections,
      sections: [],
      emptyState: 'No sections available.',
    },
    gameCards: {
      ...base.gameCards,
      gameCards: [],
      emptyState: 'No game cards available.',
    },
    gameDetails: {
      ...base.gameDetails,
      gameDetails: [],
      emptyState: 'No game details available.',
    },
    warnings: {
      ...base.warnings,
      warnings: [],
      emptyState: null,
    },
  };
}

function buildPresentationWithData(): MLBReportPreviewUIPresentation {
  const viewModel = buildMinimalViewModel({
    sections: [
      { heading: 'Summary', body: ['Synthetic summary'] },
      { heading: 'Details', body: ['Detail A'] },
    ],
    gameCards: [
      {
        gameId: 'local-game-1',
        heading: 'Local Away 1 at Local Home 1',
        officialDate: '2024-07-01',
        scheduledStartTime: '2024-07-01T19:05:00.000Z',
        moduleSummary: 'Local module summary.',
        dataQualityLabel: 'Data quality: local synthetic.',
        confidenceLabel: 'Confidence: local synthetic.',
        researchStrengthLabel: 'Research strength: local synthetic.',
        warningSummary: 'No warnings.',
        scheduleContextSummary: 'Schedule context: local synthetic.',
        teamQualityContextSummary: 'Team quality context: local synthetic.',
      },
    ],
    gameDetails: [
      {
        heading: 'Local Away 1 at Local Home 1',
        availableResearchModules: 'Local modules.',
        teamRecentFormSummary: 'Local recent form.',
        scheduleContextSummary: 'Local schedule context.',
        teamQualityContextSummary: 'Local team quality.',
        warnings: 'No warnings.',
        dataQualityExplanation: 'Local data quality explanation.',
        evidenceLimitations: 'Local evidence limitations.',
        technicalMetadataSummary: 'Local technical metadata.',
      },
    ],
    warnings: [
      { code: 'LOCAL_WARNING', message: 'Local synthetic warning.' },
    ],
  });
  return buildMLBReportPreviewUIPresentation(viewModel);
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

describe('MLBReportPreviewUIAdapterDocument', () => {
  // 1. Stable constants
  it('exports exact adapter name and version', () => {
    expect(MLB_REPORT_PREVIEW_UI_ADAPTER_NAME).toBe('MLB_REPORT_PREVIEW_UI_ADAPTER');
    expect(MLB_REPORT_PREVIEW_UI_ADAPTER_VERSION).toBe(
      'mlb-report-preview-ui-adapter-v1',
    );
  });

  // 2. Export exact root order constant
  it('exports the exact seven-node root order constant', () => {
    expect(MLB_REPORT_PREVIEW_UI_ADAPTER_ROOT_NODE_ORDER).toEqual([
      'header',
      'metadata',
      'section-list',
      'game-card-list',
      'game-detail-list',
      'warnings',
      'limitations',
    ]);
  });

  // 3. Valid construction
  it('builds valid adapter document from validated presentation', () => {
    const presentation = buildPresentationWithData();
    const document = buildAdapterDocument(presentation);
    expect(document.name).toBe(MLB_REPORT_PREVIEW_UI_ADAPTER_NAME);
    expect(document.version).toBe(MLB_REPORT_PREVIEW_UI_ADAPTER_VERSION);
    expect(document.title).toBe(presentation.title);
    expect(validateMLBReportPreviewUIAdapterDocument(document).ok).toBe(true);
  });

  // 4. Defensive presentation assertion
  it('rejects invalid presentation input', () => {
    expect(() =>
      buildAdapterDocument({} as MLBReportPreviewUIPresentation),
    ).toThrow('MLB_REPORT_PREVIEW_UI_PRESENTATION validation failed');
  });

  // 5. Exact root node order
  it('produces exactly seven root nodes in exact root order', () => {
    const document = buildAdapterDocument(buildPresentationWithData());
    expect(document.nodes.length).toBe(
      MLB_REPORT_PREVIEW_UI_ADAPTER_ROOT_NODE_ORDER.length,
    );
    expect(document.nodes.map((node) => node.kind)).toEqual([
      'header',
      'metadata',
      'section-list',
      'game-card-list',
      'game-detail-list',
      'warnings',
      'limitations',
    ]);
  });

  // 6. Header text preservation
  it('preserves header text exactly', () => {
    const viewModel = buildMinimalViewModel({
      header: {
        title: 'Custom title',
        subtitle: 'Research preview',
        generatedAtLabel: 'Local deterministic preview',
        sourceLabel: 'Local report preview',
      },
    });
    const document = buildAdapterDocument(buildMLBReportPreviewUIPresentation(viewModel));
    const header = document.nodes.find((n) => n.kind === 'header');
    expect(header).toBeDefined();
    if (header?.kind !== 'header') {
      throw new Error('Expected header node');
    }
    expect(header.title).toBe('Custom title');
    expect(header.subtitle).toBe('Research preview');
    expect(header.generatedAtLabel).toBe('Local deterministic preview');
    expect(header.sourceLabel).toBe('Local report preview');
  });

  // 7. Metadata preservation
  it('preserves metadata versions and deterministic/local metadata', () => {
    const presentation = buildPresentationWithData();
    const document = buildAdapterDocument(presentation);
    const metadata = document.nodes.find((n) => n.kind === 'metadata');
    expect(metadata).toBeDefined();
    if (metadata?.kind !== 'metadata') {
      throw new Error('Expected metadata node');
    }
    expect(metadata.handlerVersion).toBe(presentation.metadata.handlerVersion);
    expect(metadata.contractVersion).toBe(presentation.metadata.contractVersion);
    expect(metadata.rendererVersion).toBe(presentation.metadata.rendererVersion);
    expect(metadata.adapterVersion).toBe(MLB_REPORT_PREVIEW_UI_ADAPTER_VERSION);
    expect(metadata.deterministic).toBe(true);
    expect(metadata.source).toBe('local-report-preview');
    expect(metadata.generatedAt).toBe(presentation.metadata.generatedAt);
  });

  // 8. Section-list preservation
  it('preserves section entries inside a dedicated section-list node', () => {
    const viewModel = buildMinimalViewModel({
      sections: [
        { heading: 'Alpha', body: ['A', 'B'] },
        { heading: 'Beta', body: [] },
      ],
    });
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    const document = buildAdapterDocument(presentation);
    const sectionListNode = document.nodes.find((n) => n.kind === 'section-list');
    expect(sectionListNode).toBeDefined();
    if (sectionListNode?.kind !== 'section-list') {
      throw new Error('Expected section-list node');
    }
    expect(sectionListNode.sections.length).toBe(2);
    expect(sectionListNode.emptyState).toBeNull();
    expect(sectionListNode.sections[0].kind).toBe('section');
    expect(sectionListNode.sections[0].heading).toBe('Alpha');
    expect(sectionListNode.sections[0].body).toEqual(['A', 'B']);
    expect(sectionListNode.sections[0].emptyState).toBeNull();
    expect(sectionListNode.sections[1].kind).toBe('section');
    expect(sectionListNode.sections[1].heading).toBe('Beta');
    expect(sectionListNode.sections[1].body).toEqual(['No content available for this section.']);
  });

  // 9. Empty section list remains empty
  it('preserves empty section list as empty sections array', () => {
    const document = buildAdapterDocument(buildEmptyPresentation());
    const sectionListNode = document.nodes.find((n) => n.kind === 'section-list');
    expect(sectionListNode).toBeDefined();
    if (sectionListNode?.kind !== 'section-list') {
      throw new Error('Expected section-list node');
    }
    expect(sectionListNode.sections.length).toBe(0);
    expect(sectionListNode.emptyState).toBe('No sections available.');
  });

  // 10. Game-card preservation
  it('preserves card order and safe labels', () => {
    const document = buildAdapterDocument(buildPresentationWithData());
    const list = document.nodes.find((n) => n.kind === 'game-card-list');
    expect(list).toBeDefined();
    if (list?.kind !== 'game-card-list') {
      throw new Error('Expected game-card-list');
    }
    expect(list.gameCards.length).toBe(1);
    const card = list.gameCards[0];
    expect(card.kind).toBe('game-card');
    expect(card.gameId).toBe('local-game-1');
    expect(card.heading).toBe('Local Away 1 at Local Home 1');
    expect(card.dataQualityLabel).toBe('Data quality: local synthetic.');
  });

  // 11. Game-detail preservation
  it('preserves detail order and corresponding gameId', () => {
    const document = buildAdapterDocument(buildPresentationWithData());
    const list = document.nodes.find((n) => n.kind === 'game-detail-list');
    expect(list).toBeDefined();
    if (list?.kind !== 'game-detail-list') {
      throw new Error('Expected game-detail-list');
    }
    expect(list.gameDetails.length).toBe(1);
    const detail = list.gameDetails[0];
    expect(detail.kind).toBe('game-detail');
    expect(detail.gameId).toBe('local-game-1');
    expect(detail.heading).toBe('Local Away 1 at Local Home 1');
    expect(detail.availableResearchModules).toBe('Local modules.');
  });

  // 12. Card/detail alignment
  it('preserves card/detail count alignment', () => {
    const viewModel = buildMinimalViewModel({
      gameCards: [
        {
          gameId: 'g1',
          heading: 'G1',
          officialDate: '2024-07-01',
          scheduledStartTime: '2024-07-01T19:05:00.000Z',
          moduleSummary: 'M1',
          dataQualityLabel: 'DQ1',
          confidenceLabel: 'C1',
          researchStrengthLabel: 'RS1',
          warningSummary: 'W1',
          scheduleContextSummary: 'SC1',
          teamQualityContextSummary: 'TQ1',
        },
        {
          gameId: 'g2',
          heading: 'G2',
          officialDate: '2024-07-02',
          scheduledStartTime: '2024-07-02T19:05:00.000Z',
          moduleSummary: 'M2',
          dataQualityLabel: 'DQ2',
          confidenceLabel: 'C2',
          researchStrengthLabel: 'RS2',
          warningSummary: 'W2',
          scheduleContextSummary: 'SC2',
          teamQualityContextSummary: 'TQ2',
        },
      ],
      gameDetails: [
        {
          heading: 'G1',
          availableResearchModules: 'AM1',
          teamRecentFormSummary: 'TRF1',
          scheduleContextSummary: 'SC1',
          teamQualityContextSummary: 'TQ1',
          warnings: 'No warnings.',
          dataQualityExplanation: 'DQE1',
          evidenceLimitations: 'EL1',
          technicalMetadataSummary: 'TM1',
        },
        {
          heading: 'G2',
          availableResearchModules: 'AM2',
          teamRecentFormSummary: 'TRF2',
          scheduleContextSummary: 'SC2',
          teamQualityContextSummary: 'TQ2',
          warnings: 'No warnings.',
          dataQualityExplanation: 'DQE2',
          evidenceLimitations: 'EL2',
          technicalMetadataSummary: 'TM2',
        },
      ],
    });
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    const document = buildAdapterDocument(presentation);
    const cardList = document.nodes.find((n) => n.kind === 'game-card-list');
    const detailList = document.nodes.find((n) => n.kind === 'game-detail-list');
    expect(cardList?.kind).toBe('game-card-list');
    expect(detailList?.kind).toBe('game-detail-list');
    if (cardList?.kind === 'game-card-list' && detailList?.kind === 'game-detail-list') {
      expect(cardList.gameCards.length).toBe(detailList.gameDetails.length);
      expect(cardList.gameCards.length).toBe(2);
    }
  });

  // 13. Warning preservation
  it('preserves warning order, code, message, and empty-state', () => {
    const document = buildAdapterDocument(buildPresentationWithData());
    const warningsNode = document.nodes.find((n) => n.kind === 'warnings');
    expect(warningsNode).toBeDefined();
    if (warningsNode?.kind !== 'warnings') {
      throw new Error('Expected warnings node');
    }
    expect(warningsNode.warnings.length).toBe(1);
    expect(warningsNode.warnings[0].code).toBe('LOCAL_WARNING');
    expect(warningsNode.warnings[0].message).toBe('Local synthetic warning.');
    expect(warningsNode.emptyState).toBeNull();

    const emptyPresentation = buildMLBReportPreviewUIPresentation(
      buildMinimalViewModel({ warnings: [] }),
    );
    const emptyDocument = buildAdapterDocument(emptyPresentation);
    const emptyWarnings = emptyDocument.nodes.find((n) => n.kind === 'warnings');
    expect(emptyWarnings?.kind).toBe('warnings');
    if (emptyWarnings?.kind === 'warnings') {
      expect(emptyWarnings.warnings.length).toBe(0);
      expect(emptyWarnings.emptyState).toBeNull();
    }
  });

  // 14. Limitations visibility
  it('preserves exact Limitations heading, notes, and final position', () => {
    const document = buildAdapterDocument(buildPresentationWithData());
    const limitations = document.nodes[document.nodes.length - 1];
    expect(limitations.kind).toBe('limitations');
    if (limitations.kind !== 'limitations') {
      throw new Error('Expected limitations node');
    }
    expect(limitations.heading).toBe('Limitations');
    expect(limitations.notes.length).toBeGreaterThan(0);
    expect(limitations.notes[0]).toBe('Adapter test limitations.');
  });

  // 15. Empty-state preservation for lists
  it('preserves empty arrays without fabricating records', () => {
    const document = buildAdapterDocument(buildEmptyPresentation());
    const sectionListNode = document.nodes.find((n) => n.kind === 'section-list');
    const cardList = document.nodes.find((n) => n.kind === 'game-card-list');
    const detailList = document.nodes.find((n) => n.kind === 'game-detail-list');
    const warningsNode = document.nodes.find((n) => n.kind === 'warnings');

    expect(sectionListNode?.kind).toBe('section-list');
    if (sectionListNode?.kind === 'section-list') {
      expect(sectionListNode.sections.length).toBe(0);
      expect(sectionListNode.emptyState).toBe('No sections available.');
    }

    expect(cardList?.kind).toBe('game-card-list');
    if (cardList?.kind === 'game-card-list') {
      expect(cardList.gameCards.length).toBe(0);
      expect(cardList.emptyState).toBe('No game cards available.');
    }

    expect(detailList?.kind).toBe('game-detail-list');
    if (detailList?.kind === 'game-detail-list') {
      expect(detailList.gameDetails.length).toBe(0);
      expect(detailList.emptyState).toBe('No game details available.');
    }

    expect(warningsNode?.kind).toBe('warnings');
    if (warningsNode?.kind === 'warnings') {
      expect(warningsNode.warnings.length).toBe(0);
      expect(warningsNode.emptyState).toBeNull();
    }
  });

  // 16. No fabricated empty-state strings inside child records
  it('contains no fabricated empty-state strings inside empty list child entries', () => {
    const document = buildAdapterDocument(buildEmptyPresentation());
    const text = JSON.stringify(document);
    const forbiddenFabricated = [
      'placeholder',
      '__SECTIONS_CONTAINER__',
      'No content available for this section.',
      'NO_WARNINGS',
    ];
    for (const token of forbiddenFabricated) {
      expect(text).not.toContain(token);
    }
    const sectionListNode = document.nodes.find((n) => n.kind === 'section-list');
    expect(sectionListNode?.kind).toBe('section-list');
    if (sectionListNode?.kind === 'section-list') {
      expect(sectionListNode.sections.length).toBe(0);
    }
  });

  // 17. Determinism
  it('produces deeply equal output on repeated adaptation', () => {
    const presentation = buildPresentationWithData();
    const first = buildAdapterDocument(presentation);
    const second = buildAdapterDocument(presentation);
    expect(first).toEqual(second);
  });

  // 18. Fresh references
  it('does not share mutable references with input presentation', () => {
    const presentation = buildPresentationWithData();
    const document = buildAdapterDocument(presentation);
    const header = document.nodes.find((n) => n.kind === 'header');
    if (header?.kind !== 'header') {
      throw new Error('Expected header');
    }
    expect(header).not.toBe(presentation.header);
    expect(header.title).toBe(presentation.header.title);
    expect(header.subtitle).toBe(presentation.header.subtitle);
  });

  // 19. Input not mutated
  it('does not mutate the input presentation', () => {
    const presentation = buildPresentationWithData();
    const snapshot = JSON.stringify(presentation);
    buildAdapterDocument(presentation);
    expect(JSON.stringify(presentation)).toBe(snapshot);
  });

  // 20. No wall clock
  it('does not call Date.now', () => {
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => 0);
    const presentation = buildPresentationWithData();
    buildAdapterDocument(presentation);
    spy.mockRestore();
    expect(spy).not.toHaveBeenCalled();
  });

  // 21. No randomness
  it('does not call Math.random', () => {
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => 0);
    const presentation = buildPresentationWithData();
    buildAdapterDocument(presentation);
    spy.mockRestore();
    expect(spy).not.toHaveBeenCalled();
  });

  // 22. No fetch
  it('does not call global fetch', () => {
    const original = globalThis.fetch;
    let fetchCalls = 0;
    Object.defineProperty(globalThis, 'fetch', {
      value: (..._args: unknown[]) => {
        fetchCalls++;
        return Promise.resolve(new Response()) as unknown as typeof fetch;
      },
      writable: true,
      configurable: true,
    });
    try {
      const presentation = buildPresentationWithData();
      buildAdapterDocument(presentation);
    } finally {
      Object.defineProperty(globalThis, 'fetch', {
        value: original,
        writable: true,
        configurable: true,
      });
    }
    expect(fetchCalls).toBe(0);
  });

  // 23. Genuine filesystem and child-process spy coverage
  it('does not read files or invoke child_process', () => {
    const fsSpy = vi.spyOn(require('node:fs'), 'readFileSync');
    const fsWriteSpy = vi.spyOn(require('node:fs'), 'writeFileSync');
    const fsAppendSpy = vi.spyOn(require('node:fs'), 'appendFileSync');
    const execSpy = vi.spyOn(require('node:child_process'), 'execSync').mockImplementation(() => Buffer.from(''));
    const spawnSpy = vi.spyOn(require('node:child_process'), 'spawnSync').mockImplementation(() => ({} as never));

    const presentation = buildPresentationWithData();
    buildAdapterDocument(presentation);

    fsSpy.mockRestore();
    fsWriteSpy.mockRestore();
    fsAppendSpy.mockRestore();
    execSpy.mockRestore();
    spawnSpy.mockRestore();

    expect(fsSpy).not.toHaveBeenCalled();
    expect(fsWriteSpy).not.toHaveBeenCalled();
    expect(fsAppendSpy).not.toHaveBeenCalled();
    expect(execSpy).not.toHaveBeenCalled();
    expect(spawnSpy).not.toHaveBeenCalled();
  });

  // 24. Environment-stable storage and analytics checks
  it('does not access localStorage, sessionStorage, analytics, or telemetry', () => {
    const storageMethods = ['localStorage', 'sessionStorage', 'analytics', 'telemetry'];
    const originalDescriptors: Record<string, PropertyDescriptor | undefined> = {};
    let accessed = 0;

    for (const name of storageMethods) {
      originalDescriptors[name] = Object.getOwnPropertyDescriptor(globalThis, name);
      Object.defineProperty(globalThis, name, {
        get: () => {
          accessed++;
          return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        },
        configurable: true,
      });
    }

    try {
      const presentation = buildPresentationWithData();
      buildAdapterDocument(presentation);
    } finally {
      for (const name of storageMethods) {
        const descriptor = originalDescriptors[name];
        if (descriptor) {
          Object.defineProperty(globalThis, name, descriptor);
        } else {
          delete (globalThis as Record<string, unknown>)[name];
        }
      }
    }

    expect(accessed).toBe(0);
  });

  // 25. No raw lower-layer keys
  it('contains no raw lower-layer keys', () => {
    const document = buildAdapterDocument(buildPresentationWithData());
    const keys = collectKeys(document);
    const forbidden = [
      'apiResponse',
      'reportPreview',
      'viewModel',
      'presentation',
      'payload',
      'raw',
      'handlerResponse',
      'researchPackage',
      'historicalFixtures',
      'sourceModel',
    ];
    for (const key of forbidden) {
      expect(keys).not.toContain(key);
    }
  });

  // 26. No prohibited analytical keys
  it('contains no prohibited analytical keys', () => {
    const document = buildAdapterDocument(buildPresentationWithData());
    const keys = collectKeys(document);
    const prohibited = [
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
    ];
    for (const key of prohibited) {
      expect(keys).not.toContain(key);
    }
  });

  // 27. No unsafe adapter-owned phrases
  it('introduces no unsafe adapter-owned phrases', () => {
    const document = buildAdapterDocument(buildPresentationWithData());
    const text = JSON.stringify(document).toLowerCase();
    for (const phrase of UNSAFE_PHRASES) {
      expect(text).not.toContain(phrase);
    }
  });

  // 28. Plain-data output with recursive shape checks
  it('returns only plain data objects with safe shapes', () => {
    const document = buildAdapterDocument(buildPresentationWithData());
    expect(() => JSON.parse(JSON.stringify(document))).not.toThrow();
    expect(isPlainDeep(document)).toBe(true);
    expect(containsFrameworkShape(document)).toBe(false);
  });

  // 29. Reject lower-layer inputs
  it('rejects runtime-invalid casts of lower-layer inputs', () => {
    // View model masquerading as presentation
    const viewModel = buildMinimalViewModel();
    const invalidPresentation = {
      ...viewModel,
      name: MLB_REPORT_PREVIEW_UI_PRESENTATION_NAME,
      version: MLB_REPORT_PREVIEW_UI_PRESENTATION_VERSION,
    } as unknown as MLBReportPreviewUIPresentation;
    expect(() =>
      buildAdapterDocument(invalidPresentation),
    ).toThrow();

    // Handler success masquerading as presentation
    const handlerSuccess = {
      ok: true,
      handlerVersion: 'mlb-report-preview-api-handler-v1',
      handlerName: 'MLB_REPORT_PREVIEW_API_HANDLER',
      requestId: null,
      apiResponse: { ok: true, reportPreview: {} },
      metadata: {
        handlerVersion: 'mlb-report-preview-api-handler-v1',
        contractVersion: MLB_REPORT_PREVIEW_API_CONTRACT_VERSION,
        rendererVersion: MLB_RESEARCH_REPORT_RENDERER_VERSION,
        adapterVersion: 'adapter-v1',
        generatedAt: null,
        source: 'local-report-preview',
        deterministic: true,
      },
    } as unknown as MLBReportPreviewUIPresentation;
    expect(() =>
      buildAdapterDocument(handlerSuccess),
    ).toThrow();

    // Raw report preview masquerading as presentation
    const rawReportPreview = {
      metadata: {},
      report: {},
      warnings: [],
    } as unknown as MLBReportPreviewUIPresentation;
    expect(() =>
      buildAdapterDocument(rawReportPreview),
    ).toThrow();
  });

  // 30. Validator rejects missing, extra, duplicated, and reordered root nodes
  it('rejects malformed adapter documents', () => {
    expect(
      validateMLBReportPreviewUIAdapterDocument({ name: MLB_REPORT_PREVIEW_UI_ADAPTER_NAME, version: MLB_REPORT_PREVIEW_UI_ADAPTER_VERSION, title: 'OK', nodes: [] }).ok,
    ).toBe(false);

    expect(
      validateMLBReportPreviewUIAdapterDocument({
        name: MLB_REPORT_PREVIEW_UI_ADAPTER_NAME,
        version: MLB_REPORT_PREVIEW_UI_ADAPTER_VERSION,
        title: 'OK',
        nodes: [
          { kind: 'unknown' },
        ],
      }).ok,
    ).toBe(false);

    expect(
      validateMLBReportPreviewUIAdapterDocument({
        name: MLB_REPORT_PREVIEW_UI_ADAPTER_NAME,
        version: MLB_REPORT_PREVIEW_UI_ADAPTER_VERSION,
        title: 'OK',
        nodes: [
          { kind: 'section', heading: 'S', body: [], emptyState: null },
        ],
      }).ok,
    ).toBe(false);

    expect(
      validateMLBReportPreviewUIAdapterDocument({
        name: MLB_REPORT_PREVIEW_UI_ADAPTER_NAME,
        version: MLB_REPORT_PREVIEW_UI_ADAPTER_VERSION,
        title: 'OK',
        nodes: [
          { kind: 'game-card-list', gameCards: 'not-array', emptyState: null },
        ],
      }).ok,
    ).toBe(false);
  });

  // 31. Validator rejects extra missing and duplicated root nodes
  it('rejects missing section-list, duplicated root kinds, and section at root', () => {
    const base = {
      name: MLB_REPORT_PREVIEW_UI_ADAPTER_NAME,
      version: MLB_REPORT_PREVIEW_UI_ADAPTER_VERSION,
      title: 'OK',
      nodes: [] as MLBReportPreviewUIAdapterNode[],
    };

    // missing section-list
    expect(
      validateMLBReportPreviewUIAdapterDocument({
        ...base,
        nodes: [
          { kind: 'header', title: 'T', subtitle: 'S', generatedAtLabel: 'G', sourceLabel: 'L' },
          { kind: 'metadata', handlerVersion: 'h1', contractVersion: 'c1', rendererVersion: 'r1', adapterVersion: MLB_REPORT_PREVIEW_UI_ADAPTER_VERSION, deterministic: true, source: 'local-report-preview', generatedAt: null },
          { kind: 'game-card-list', gameCards: [], emptyState: null },
          { kind: 'game-detail-list', gameDetails: [], emptyState: null },
          { kind: 'warnings', warnings: [], emptyState: null },
          { kind: 'limitations', heading: 'Limitations', notes: [] },
        ],
      }).ok,
    ).toBe(false);

    // duplicated header
    expect(
      validateMLBReportPreviewUIAdapterDocument({
        ...base,
        nodes: [
          { kind: 'header', title: 'T', subtitle: 'S', generatedAtLabel: 'G', sourceLabel: 'L' },
          { kind: 'header', title: 'T2', subtitle: 'S2', generatedAtLabel: 'G2', sourceLabel: 'L2' },
          { kind: 'section-list', sections: [], emptyState: null },
          { kind: 'game-card-list', gameCards: [], emptyState: null },
          { kind: 'game-detail-list', gameDetails: [], emptyState: null },
          { kind: 'warnings', warnings: [], emptyState: null },
          { kind: 'limitations', heading: 'Limitations', notes: [] },
        ],
      }).ok,
    ).toBe(false);

    // section (child kind) placed at root
    expect(
      validateMLBReportPreviewUIAdapterDocument({
        ...base,
        nodes: [
          { kind: 'header', title: 'T', subtitle: 'S', generatedAtLabel: 'G', sourceLabel: 'L' },
          { kind: 'metadata', handlerVersion: 'h1', contractVersion: 'c1', rendererVersion: 'r1', adapterVersion: MLB_REPORT_PREVIEW_UI_ADAPTER_VERSION, deterministic: true, source: 'local-report-preview', generatedAt: null },
          { kind: 'section', heading: 'S', body: [], emptyState: null },
          { kind: 'game-card-list', gameCards: [], emptyState: null },
          { kind: 'game-detail-list', gameDetails: [], emptyState: null },
          { kind: 'warnings', warnings: [], emptyState: null },
          { kind: 'limitations', heading: 'Limitations', notes: [] },
        ],
      }).ok,
    ).toBe(false);
  });
});

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

function isPlainDeep(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return typeof value !== 'bigint' && typeof value !== 'symbol' && typeof value !== 'function';
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isPlainDeep(item)) {
        return false;
      }
    }
    return true;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    return false;
  }
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const descriptor = Object.getOwnPropertyDescriptor(value as Record<string, unknown>, key);
    if (descriptor && typeof descriptor.value === 'function') {
      return false;
    }
    if (descriptor && descriptor.get) {
      return false;
    }
    if (key === 'dangerouslySetInnerHTML' || key === 'innerHTML') {
      return false;
    }
    if (key === 'type' && (value as Record<string, unknown>).props) {
      return false;
    }
    if (!isPlainDeep((value as Record<string, unknown>)[key])) {
      return false;
    }
  }
  return true;
}

function containsFrameworkShape(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.includes('type') && keys.includes('props')) {
    return true;
  }
  if (keys.includes('dangerouslySetInnerHTML') || keys.includes('innerHTML')) {
    return true;
  }
  return keys.some(
    (key) =>
      key === 'onClick' ||
      key === 'onPress' ||
      key === 'onMouseOver' ||
      key.startsWith('on'),
  );
}
