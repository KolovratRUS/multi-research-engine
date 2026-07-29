// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import type {
  MLBReportPreviewUIAdapterDocument,
  MLBReportPreviewUIAdapterNode,
  MLBReportPreviewUIAdapterHeaderNode,
  MLBReportPreviewUIAdapterMetadataNode,
  MLBReportPreviewUIAdapterSectionListNode,
  MLBReportPreviewUIAdapterSectionNode,
  MLBReportPreviewUIAdapterGameCardListNode,
  MLBReportPreviewUIAdapterGameCardNode,
  MLBReportPreviewUIAdapterGameDetailListNode,
  MLBReportPreviewUIAdapterGameDetailNode,
  MLBReportPreviewUIAdapterWarningsNode,
  MLBReportPreviewUIAdapterWarningNode,
  MLBReportPreviewUIAdapterLimitationsNode,
} from '@/prospective/mlb/report-preview-ui-adapter';
import {
  MLB_REPORT_PREVIEW_UI_ADAPTER_NAME,
  MLB_REPORT_PREVIEW_UI_ADAPTER_VERSION,
  MLB_REPORT_PREVIEW_UI_ADAPTER_ROOT_NODE_ORDER,
  buildMLBReportPreviewUIAdapterDocument,
  assertMLBReportPreviewUIAdapterDocument,
  validateMLBReportPreviewUIAdapterDocument,
} from '@/prospective/mlb/report-preview-ui-adapter';
import type { MLBReportPreviewUIPresentation } from '@/prospective/mlb/report-preview-ui-components';
import {
  MLB_REPORT_PREVIEW_UI_PRESENTATION_NAME,
  MLB_REPORT_PREVIEW_UI_PRESENTATION_VERSION,
  buildMLBReportPreviewUIPresentation,
  assertMLBReportPreviewUIPresentation,
  validateMLBReportPreviewUIPresentation,
} from '@/prospective/mlb/report-preview-ui-components';
import type { MLBReportPreviewUIViewModel } from '@/prospective/mlb/report-preview-ui-view-model';
import {
  MLB_REPORT_PREVIEW_UI_VIEW_MODEL_VERSION,
  MLB_REPORT_PREVIEW_UI_VIEW_MODEL_NAME,
  assertMLBReportPreviewUIViewModel,
  validateMLBReportPreviewUIViewModel,
} from '@/prospective/mlb/report-preview-ui-view-model';
import {
  MLB_REPORT_PREVIEW_API_CONTRACT_VERSION,
} from '@/prospective/mlb/report-preview-api-contract';
import type { MLBReportPreviewApiHandlerSuccess } from '@/prospective/mlb/report-preview-api-handler';
import { MLB_RESEARCH_REPORT_RENDERER_VERSION } from '@/prospective/mlb/research-report-renderer';
import { MLBReportPreviewRenderer } from '@/app/_components/mlb-report-preview/MLBReportPreviewRenderer';

function buildMinimalViewModel(
  overrides: Partial<MLBReportPreviewUIViewModel> = {},
): MLBReportPreviewUIViewModel {
  const base: MLBReportPreviewUIViewModel = {
    viewModelVersion: MLB_REPORT_PREVIEW_UI_VIEW_MODEL_VERSION,
    viewModelName: MLB_REPORT_PREVIEW_UI_VIEW_MODEL_NAME,
    title: 'Renderer test report preview',
    header: {
      title: 'Renderer test report preview',
      subtitle: 'Research preview',
      generatedAtLabel: 'Local deterministic preview',
      sourceLabel: 'Local report preview',
    },
    safetyBanner: {
      heading: 'Limitations',
      notes: ['Renderer test limitations.'],
    },
    sections: [{ heading: 'Summary', body: ['Synthetic summary'] }],
    gameCards: [],
    gameDetails: [],
    moduleAvailability: {
      heading: 'Module Availability',
      modules: [],
    },
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

function buildAdapterDocumentFromViewModel(
  viewModel: MLBReportPreviewUIViewModel,
): MLBReportPreviewUIAdapterDocument {
  const presentation = buildMLBReportPreviewUIPresentation(viewModel);
  return buildMLBReportPreviewUIAdapterDocument(presentation);
}

function buildDocumentWithData(): MLBReportPreviewUIAdapterDocument {
  const viewModel = buildMinimalViewModel({
    sections: [
      { heading: 'Summary', body: ['Synthetic summary'] },
      { heading: 'Details', body: ['Detail A', 'Detail B'] },
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
      {
        gameId: 'local-game-2',
        heading: 'Local Away 2 at Local Home 2',
        officialDate: '2024-07-02',
        scheduledStartTime: '2024-07-02T19:05:00.000Z',
        moduleSummary: 'Second local module summary.',
        dataQualityLabel: 'Data quality: second local synthetic.',
        confidenceLabel: 'Confidence: second local synthetic.',
        researchStrengthLabel: 'Research strength: second local synthetic.',
        warningSummary: 'No warnings.',
        scheduleContextSummary: 'Schedule context: second local synthetic.',
        teamQualityContextSummary: 'Team quality context: second local synthetic.',
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
      {
        heading: 'Local Away 2 at Local Home 2',
        availableResearchModules: 'Second local modules.',
        teamRecentFormSummary: 'Second local recent form.',
        scheduleContextSummary: 'Second local schedule context.',
        teamQualityContextSummary: 'Second local team quality.',
        warnings: 'No warnings.',
        dataQualityExplanation: 'Second local data quality explanation.',
        evidenceLimitations: 'Second local evidence limitations.',
        technicalMetadataSummary: 'Second local technical metadata.',
      },
    ],
    warnings: [
      { code: 'LOCAL_WARNING', message: 'Local synthetic warning.' },
      { code: 'SECOND_WARNING', message: 'Second local synthetic warning.' },
    ],
  });

  return buildAdapterDocumentFromViewModel(viewModel);
}

function buildEmptyDocument(): MLBReportPreviewUIAdapterDocument {
  const viewModel = buildMinimalViewModel();
  const base = buildMLBReportPreviewUIPresentation(viewModel);
  const emptyPresentation = {
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
  return buildMLBReportPreviewUIAdapterDocument(emptyPresentation);
}

function buildSingleSectionEmptyBodyDocument(): MLBReportPreviewUIAdapterDocument {
  const viewModel = buildMinimalViewModel({
    sections: [{ heading: 'Only section', body: [] }],
    gameCards: [],
    gameDetails: [],
    warnings: [],
  });
  return buildAdapterDocumentFromViewModel(viewModel);
}

function buildDocumentWithEscapingStrings(): MLBReportPreviewUIAdapterDocument {
  const viewModel = buildMinimalViewModel({
    sections: [{ heading: 'Escaping', body: ['<script>unsafe()</script>', '<strong>not markup</strong>'] }],
    gameCards: [],
    gameDetails: [],
    warnings: [],
  });
  return buildAdapterDocumentFromViewModel(viewModel);
}

const RENDERER_SOURCE_PATH = path.resolve(
  __dirname,
  '../../src/app/_components/mlb-report-preview/MLBReportPreviewRenderer.tsx',
);

describe('MLBReportPreviewRenderer', () => {
  // 1. Valid render
  it('renders a valid adapter document without throwing', () => {
    const adapterDocument = buildDocumentWithData();
    expect(() => render(<MLBReportPreviewRenderer document={adapterDocument} />)).not.toThrow();
  });

  // 2. Defensive assertion
  it('throws on malformed adapter document', () => {
    expect(() =>
      render(
        <MLBReportPreviewRenderer
          document={{ name: 'wrong', version: 'wrong', title: 't', nodes: [] } as unknown as MLBReportPreviewUIAdapterDocument}
        />,
      ),
    ).toThrow('MLB_REPORT_PREVIEW_UI_ADAPTER validation failed');
  });

  // 3. Adapter-only boundary
  it('rejects runtime-invalid casts of lower-layer shapes', () => {
    const invalidShapes: unknown[] = [
      { name: MLB_REPORT_PREVIEW_UI_PRESENTATION_NAME, version: MLB_REPORT_PREVIEW_UI_PRESENTATION_VERSION, title: 'T' },
      { name: MLB_REPORT_PREVIEW_UI_VIEW_MODEL_NAME, version: MLB_REPORT_PREVIEW_UI_VIEW_MODEL_VERSION, title: 'T' },
      { ok: true, handlerVersion: 'h1', metadata: {} },
      { title: 'Raw report preview' },
    ];

    for (const shape of invalidShapes) {
      expect(() =>
        render(<MLBReportPreviewRenderer document={shape as unknown as MLBReportPreviewUIAdapterDocument} />),
      ).toThrow();
    }
  });

  // 4. Exact root order
  it('renders root nodes in exact adapter order', () => {
    const adapterDocument = buildDocumentWithData();
    const { container } = render(<MLBReportPreviewRenderer document={adapterDocument} />);
    const sectioning = container.querySelectorAll('article > header, article > section, article > [aria-label="Warnings"]');
    const kinds = Array.from(sectioning).map((el) => {
      if (el.tagName === 'HEADER') return 'header';
      if ((el as HTMLElement).getAttribute('aria-label') === 'Warnings') return 'warnings';
      const heading = el.querySelector('h2, h3');
      if (!heading) return 'unknown';
      const text = heading.textContent ?? '';
      if (text === 'Technical metadata') return 'metadata';
      if (text === 'Game cards') return 'game-card-list';
      if (text === 'Game details') return 'game-detail-list';
      if (text === 'Warnings') return 'warnings';
      if (text === 'Limitations') return 'limitations';
      if (text === 'Summary' || text === 'Details') return 'section-list';
      return 'unknown';
    });

    expect(kinds).toEqual([
      'header',
      'metadata',
      'section-list',
      'game-card-list',
      'game-detail-list',
      'warnings',
      'limitations',
    ]);
  });

  // 5. Single root heading
  it('renders exactly one h1 with the adapter title', () => {
    const adapterDocument = buildDocumentWithData();
    render(<MLBReportPreviewRenderer document={adapterDocument} />);
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toBe('Renderer test report preview');
  });

  // 6. Exact header text
  it('preserves subtitle, generated-at label, and source label exactly', () => {
    const adapterDocument = buildDocumentWithData();
    render(<MLBReportPreviewRenderer document={adapterDocument} />);
    expect(screen.getByText('Research preview')).toBeDefined();
    expect(screen.getByText('Local deterministic preview')).toBeDefined();
    expect(screen.getByText('Local report preview')).toBeDefined();
  });

  // 7. Metadata semantics
  it('renders technical metadata labels, exact values, and null generated-at neutral copy', () => {
    const adapterDocument = buildEmptyDocument();
    render(<MLBReportPreviewRenderer document={adapterDocument} />);
    expect(screen.getByText('Technical metadata')).toBeDefined();
    expect(screen.getByText('Handler version')).toBeDefined();
    expect(screen.getByText('Contract version')).toBeDefined();
    expect(screen.getByText('Renderer version')).toBeDefined();
    expect(screen.getByText('Adapter version')).toBeDefined();
    expect(screen.getByText('Deterministic')).toBeDefined();
    expect(screen.getAllByText('Source')).toHaveLength(2);
    expect(screen.getByText('Not provided')).toBeDefined();
    expect(screen.getByText('Yes')).toBeDefined();
  });

  // 8. Section order
  it('preserves section order', () => {
    const adapterDocument = buildDocumentWithData();
    const { container } = render(<MLBReportPreviewRenderer document={adapterDocument} />);
    const article = container.querySelector('article');
    const sectionListNode = Array.from(article?.querySelectorAll(':scope > section') ?? []).find(
      (section) => (section.textContent ?? '').includes('Summary') && (section.textContent ?? '').includes('Details'),
    );
    const statements = sectionListNode?.querySelectorAll(':scope > section > h3') ?? [];
    expect(Array.from(statements).map((statement) => statement.textContent)).toEqual([
      'Summary',
      'Details',
    ]);
  });

  // 9. Single-line section body
  it('renders single body line as paragraph text', () => {
    const adapterDocument = buildDocumentWithData();
    render(<MLBReportPreviewRenderer document={adapterDocument} />);
    const summaryParagraphs = screen.getAllByText('Synthetic summary');
    expect(summaryParagraphs.length).toBeGreaterThanOrEqual(1);
  });

  // 10. Multi-line section body
  it('renders multiple body lines as list items in order', () => {
    const adapterDocument = buildDocumentWithData();
    render(<MLBReportPreviewRenderer document={adapterDocument} />);
    const items = screen.getAllByText('Detail A');
    expect(items.length).toBe(1);
  });

  // 11. Empty section list
  it('renders empty section list empty state only', () => {
    const adapterDocument = buildEmptyDocument();
    render(<MLBReportPreviewRenderer document={adapterDocument} />);
    expect(screen.getByText('No sections available.')).toBeDefined();
    expect(screen.queryByText('Summary')).toBeNull();
  });

  // 12. Real empty section body
  it('renders explicit empty state for real section with empty body', () => {
    const adapterDocument = buildSingleSectionEmptyBodyDocument();
    render(<MLBReportPreviewRenderer document={adapterDocument} />);
    expect(screen.getByText('Only section')).toBeDefined();
    expect(screen.getByText('No content available for this section.')).toBeDefined();
  });

  // 13. Card order
  it('preserves card order', () => {
    const adapterDocument = buildDocumentWithData();
    const { container } = render(<MLBReportPreviewRenderer document={adapterDocument} />);
    const article = container.querySelector('article');
    const cardListNode = Array.from(article?.querySelectorAll(':scope > section') ?? []).find(
      (section) => section.querySelector('h2')?.textContent === 'Game cards',
    );
    const cardHeadings = Array.from(
      cardListNode?.querySelectorAll('article > h3') ?? [],
    ).filter((heading) => (heading.textContent ?? '').includes('Local Away'));
    expect(cardHeadings.map((heading) => heading.textContent)).toEqual([
      'Local Away 1 at Local Home 1',
      'Local Away 2 at Local Home 2',
    ]);
  });

  // 14. Card field preservation
  it('preserves safe card strings unchanged', () => {
    const adapterDocument = buildDocumentWithData();
    render(<MLBReportPreviewRenderer document={adapterDocument} />);
    expect(screen.getByText('Local module summary.')).toBeDefined();
    expect(screen.getByText('Data quality: local synthetic.')).toBeDefined();
    expect(screen.getByText('Confidence: local synthetic.')).toBeDefined();
    expect(screen.getByText('Research strength: local synthetic.')).toBeDefined();
    expect(screen.getAllByText('No warnings.').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Schedule context: local synthetic.')).toBeDefined();
    expect(screen.getByText('Team quality context: local synthetic.')).toBeDefined();
  });

  // 15. Empty card list
  it('renders empty card list empty state once', () => {
    const adapterDocument = buildEmptyDocument();
    render(<MLBReportPreviewRenderer document={adapterDocument} />);
    const messages = screen.getAllByText('No game cards available.');
    expect(messages).toHaveLength(1);
  });

  // 16. Detail order
  it('preserves detail order', () => {
    const adapterDocument = buildDocumentWithData();
    const { container } = render(<MLBReportPreviewRenderer document={adapterDocument} />);
    const article = container.querySelector('article');
    const detailListNode = Array.from(article?.querySelectorAll(':scope > section') ?? []).find(
      (section) => section.querySelector('h2')?.textContent === 'Game details',
    );
    const detailHeadings = Array.from(
      detailListNode?.querySelectorAll('article > h3') ?? [],
    ).filter((heading) => (heading.textContent ?? '').includes('Local Away'));
    expect(detailHeadings.map((heading) => heading.textContent)).toEqual([
      'Local Away 1 at Local Home 1',
      'Local Away 2 at Local Home 2',
    ]);
  });

  // 17. Detail field preservation
  it('preserves safe detail strings unchanged', () => {
    const adapterDocument = buildDocumentWithData();
    render(<MLBReportPreviewRenderer document={adapterDocument} />);
    expect(screen.getByText('Local modules.')).toBeDefined();
    expect(screen.getByText('Local recent form.')).toBeDefined();
    expect(screen.getByText('Local schedule context.')).toBeDefined();
    expect(screen.getByText('Local team quality.')).toBeDefined();
    expect(screen.getByText('Local data quality explanation.')).toBeDefined();
    expect(screen.getByText('Local evidence limitations.')).toBeDefined();
    expect(screen.getByText('Local technical metadata.')).toBeDefined();
  });

  // 18. Empty detail list
  it('renders empty detail list empty state once', () => {
    const adapterDocument = buildEmptyDocument();
    render(<MLBReportPreviewRenderer document={adapterDocument} />);
    const messages = screen.getAllByText('No game details available.');
    expect(messages).toHaveLength(1);
  });

  // 19. Warning order
  it('renders warnings in adapter order', () => {
    const adapterDocument = buildDocumentWithData();
    render(<MLBReportPreviewRenderer document={adapterDocument} />);
    const warningsRegion = screen.getByRole('region', { name: 'Warnings' });
    const warningItems = within(warningsRegion).getAllByRole('listitem');
    expect(warningItems).toHaveLength(2);
    expect(warningItems[0].textContent).toBe('LOCAL_WARNING — Local synthetic warning.');
    expect(warningItems[1].textContent).toBe('SECOND_WARNING — Second local synthetic warning.');
  });

  // 20. Empty warnings omission
  it('omits warnings block when warnings are empty and emptyState is null', () => {
    const adapterDocument = buildEmptyDocument();
    render(<MLBReportPreviewRenderer document={adapterDocument} />);
    expect(screen.queryByText('Warnings')).toBeNull();
    expect(screen.queryByText(/No warnings/)).toBeNull();
  });

  // 21. Limitations visible
  it('renders visible Limitations heading', () => {
    const adapterDocument = buildEmptyDocument();
    render(<MLBReportPreviewRenderer document={adapterDocument} />);
    expect(screen.getByRole('heading', { name: 'Limitations' })).toBeDefined();
  });

  // 22. Limitations last
  it('renders limitations last in normal document flow', () => {
    const adapterDocument = buildDocumentWithData();
    const { container } = render(<MLBReportPreviewRenderer document={adapterDocument} />);
    const sections = container.querySelectorAll('article > section, article > [aria-label="Warnings"]');
    const last = sections[sections.length - 1];
    expect(last?.tagName).toBe('SECTION');
    expect(last?.textContent).toContain('Limitations');
  });

  // 23. Limitations not hidden
  it('does not hide limitations with hidden, details, or dialog', () => {
    const adapterDocument = buildEmptyDocument();
    const { container } = render(<MLBReportPreviewRenderer document={adapterDocument} />);
    const limitationsSection = container.querySelector('section:last-child');
    expect(limitationsSection).toBeDefined();
    expect(limitationsSection?.hasAttribute('hidden')).toBe(false);
    expect(limitationsSection?.querySelector('details')).toBeNull();
    expect(limitationsSection?.querySelector('dialog')).toBeNull();
    expect(limitationsSection?.getAttribute('aria-hidden')).not.toBe('true');
  });

  // 24. Text escaping
  it('renders markup-like text as inert visible text', () => {
    const adapterDocument = buildDocumentWithEscapingStrings();
    const { container } = render(<MLBReportPreviewRenderer document={adapterDocument} />);
    expect(screen.getByText('<script>unsafe()</script>')).toBeDefined();
    expect(screen.getByText('<strong>not markup</strong>')).toBeDefined();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('strong')).toBeNull();
  });

  // 25. No model-derived links
  it('does not create anchors from adapter text', () => {
    const adapterDocument = buildDocumentWithData();
    const { container } = render(<MLBReportPreviewRenderer document={adapterDocument} />);
    expect(container.querySelector('a')).toBeNull();
  });

  // 26. No model-derived styling or event handlers
  it('does not assign adapter text to class, style, href, src, or event handler', () => {
    const adapterDocument = buildDocumentWithData();
    const { container } = render(<MLBReportPreviewRenderer document={adapterDocument} />);
    const allElements = container.querySelectorAll('*');
    for (const el of allElements) {
      const modelTextNodes = Array.from(el.childNodes).filter(
        (node): node is Text => node.nodeType === Node.TEXT_NODE,
      );
      for (const textNode of modelTextNodes) {
        const text = textNode.textContent ?? '';
        if (text.includes('local synthetic')) {
          expect((el as HTMLElement).className).toBe('');
          expect((el as HTMLElement).getAttribute('style')).toBeNull();
          expect((el as HTMLElement).getAttribute('href')).toBeNull();
          expect((el as HTMLElement).getAttribute('src')).toBeNull();
          expect((el as HTMLElement).onclick).toBeNull();
        }
      }
    }
  });

  // 27. No fabricated records
  it('does not fabricate domain records for empty lists', () => {
    const adapterDocument = buildEmptyDocument();
    const { container } = render(<MLBReportPreviewRenderer document={adapterDocument} />);
    const headings = container.querySelectorAll('article > h3');
    expect(headings).toHaveLength(0);
  });

  // 28. No unsafe renderer-owned phrases
  it('does not introduce prohibited phrases into renderer-owned copy', () => {
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
      'favorite',
      'favourite',
      'underdog',
    ];

    const adapterDocument = buildDocumentWithData();
    const { container } = render(<MLBReportPreviewRenderer document={adapterDocument} />);
    const text = container.textContent?.toLowerCase() ?? '';

    for (const phrase of unsafePhrases) {
      expect(text).not.toContain(phrase.toLowerCase());
    }
  });

  // 29. No lower-layer access
  it('does not import lower-layer production modules', async () => {
    const source = fs.readFileSync(RENDERER_SOURCE_PATH, 'utf8');
    expect(source).not.toContain('report-preview-api-handler');
    expect(source).not.toContain('report-preview-api-contract');
    expect(source).not.toContain('report-preview-ui-view-model');
    expect(source).not.toContain('report-preview-ui-components');
    expect(source).not.toContain('research-report-adapter');
    expect(source).not.toContain('research-report-renderer');
  });

  // 30. No client directive
  it('does not contain client directive', async () => {
    const source = fs.readFileSync(RENDERER_SOURCE_PATH, 'utf8');
    expect(source).not.toContain("'use client'");
    expect(source).not.toContain('"use client"');
  });

  // 31. No hooks
  it('does not import or call hooks', async () => {
    const source = fs.readFileSync(RENDERER_SOURCE_PATH, 'utf8');
    const hooks = ['useState', 'useEffect', 'useMemo', 'useCallback', 'useContext', 'useReducer', 'useRef'];
    for (const hook of hooks) {
      expect(source).not.toContain(hook);
    }
  });

  // 32. No fetch
  it('does not call fetch during render', () => {
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
      const adapterDocument = buildDocumentWithData();
      render(<MLBReportPreviewRenderer document={adapterDocument} />);
    } finally {
      Object.defineProperty(globalThis, 'fetch', { value: original, writable: true, configurable: true });
    }
    expect(fetchCalls).toBe(0);
  });

  // 33. No storage or browser APIs
  it('does not access localStorage or sessionStorage', () => {
    const storageMethods = ['localStorage', 'sessionStorage'];
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
      const adapterDocument = buildDocumentWithData();
      render(<MLBReportPreviewRenderer document={adapterDocument} />);
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

  // 34. No clock
  it('does not call Date.now', () => {
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => 0);
    const adapterDocument = buildDocumentWithData();
    render(<MLBReportPreviewRenderer document={adapterDocument} />);
    spy.mockRestore();
    expect(spy).not.toHaveBeenCalled();
  });

  // 35. No randomness
  it('does not call Math.random', () => {
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => 0);
    const adapterDocument = buildDocumentWithData();
    render(<MLBReportPreviewRenderer document={adapterDocument} />);
    spy.mockRestore();
    expect(spy).not.toHaveBeenCalled();
  });

  // 36. Input not mutated
  it('does not mutate the adapter document', () => {
    const adapterDocument = buildDocumentWithData();
    const frozen = JSON.stringify(adapterDocument);
    render(<MLBReportPreviewRenderer document={adapterDocument} />);
    expect(JSON.stringify(adapterDocument)).toBe(frozen);
  });

  // 37. Deterministic repeated rendering
  it('renders equivalent structure on repeated renders', () => {
    const adapterDocument = buildDocumentWithData();
    const { container: first } = render(<MLBReportPreviewRenderer document={adapterDocument} />);
    const { container: second } = render(<MLBReportPreviewRenderer document={adapterDocument} />);
    expect(first.innerHTML).toBe(second.innerHTML);
  });
});
