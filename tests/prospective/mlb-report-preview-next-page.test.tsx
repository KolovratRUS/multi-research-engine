// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';

import MLBReportPreviewPage from '@/app/(app)/mlb/report-preview/page';
import { buildMLBReportPreviewLocalPageDocument } from '@/prospective/mlb/report-preview-local-page-document';
import {
  buildMLBResearchReportFromPackage,
  type MLBResearchReportInputPackage,
} from '@/prospective/mlb/research-report-adapter';
import { assertRendererOutputSafeForDisplay, renderMLBResearchReport } from '@/prospective/mlb/research-report-renderer';
import { handleMLBReportPreviewApiRequest, assertMLBReportPreviewApiHandlerSuccess } from '@/prospective/mlb/report-preview-api-handler';
import { buildMLBReportPreviewUIViewModelFromHandlerSuccess } from '@/prospective/mlb/report-preview-ui-view-model';
import { buildMLBReportPreviewUIPresentation } from '@/prospective/mlb/report-preview-ui-components';
import {
  buildMLBReportPreviewUIAdapterDocument,
  assertMLBReportPreviewUIAdapterDocument,
  validateMLBReportPreviewUIAdapterDocument,
  MLB_REPORT_PREVIEW_UI_ADAPTER_NAME,
  MLB_REPORT_PREVIEW_UI_ADAPTER_VERSION,
  MLB_REPORT_PREVIEW_UI_ADAPTER_ROOT_NODE_ORDER,
} from '@/prospective/mlb/report-preview-ui-adapter';

const PAGE_PATH = 'src/app/(app)/mlb/report-preview/page.tsx';
const HELPER_PATH = 'src/prospective/mlb/report-preview-local-page-document.ts';

describe('MLBReportPreviewNextPage', () => {
  // 1. helper returns a valid adapter document
  it('helper returns a valid adapter document', () => {
    const document = buildMLBReportPreviewLocalPageDocument();
    expect(document).toBeDefined();
    expect(document.name).toBe(MLB_REPORT_PREVIEW_UI_ADAPTER_NAME);
    expect(document.version).toBe(MLB_REPORT_PREVIEW_UI_ADAPTER_VERSION);
    expect(Array.isArray(document.nodes)).toBe(true);
  });

  // 2. helper output passes assertMLBReportPreviewUIAdapterDocument
  it('helper output passes assertMLBReportPreviewUIAdapterDocument', () => {
    const document = buildMLBReportPreviewLocalPageDocument();
    expect(() => assertMLBReportPreviewUIAdapterDocument(document)).not.toThrow();
  });

  // 3. helper output is deterministic across repeated calls
  it('helper output is deterministic across repeated calls', () => {
    const first = JSON.stringify(buildMLBReportPreviewLocalPageDocument());
    const second = JSON.stringify(buildMLBReportPreviewLocalPageDocument());
    expect(first).toBe(second);
  });

  // 4. helper does not mutate its result during page render
  it('helper does not mutate its result during page render', () => {
    const document = buildMLBReportPreviewLocalPageDocument();
    const snapshot = JSON.stringify(document);
    render(<MLBReportPreviewPage />);
    expect(JSON.stringify(document)).toBe(snapshot);
  });

  // 5. page renders without throwing
  it('page renders without throwing', () => {
    expect(() => render(<MLBReportPreviewPage />)).not.toThrow();
  });

  // 6. exactly one <main>
  it('renders exactly one main', () => {
    render(<MLBReportPreviewPage />);
    expect(document.querySelectorAll('main').length).toBe(1);
  });

  // 7. exactly one renderer <article>
  it('renders exactly one renderer article directly inside main', () => {
    render(<MLBReportPreviewPage />);
    expect(document.querySelectorAll('main > article').length).toBe(1);
  });

  // 8. exactly one <h1>
  it('renders exactly one h1', () => {
    render(<MLBReportPreviewPage />);
    expect(document.querySelectorAll('h1').length).toBe(1);
  });

  // 9. exact adapter root order preserved
  it('preserves exact adapter root node order', () => {
    const document = buildMLBReportPreviewLocalPageDocument();
    const kinds = document.nodes.map((node) => node.kind);
    expect(kinds).toEqual([...MLB_REPORT_PREVIEW_UI_ADAPTER_ROOT_NODE_ORDER]);
  });

  // 10. limitations visible
  it('limitations are visible', () => {
    render(<MLBReportPreviewPage />);
    expect(screen.getByText('Limitations')).toBeDefined();
  });

  // 11. limitations last
  it('limitations are last', () => {
    const document = buildMLBReportPreviewLocalPageDocument();
    const lastNode = document.nodes[document.nodes.length - 1];
    expect(lastNode.kind).toBe('limitations');
  });

  // 12. warning behavior matches the deterministic local sample
  it('warning behavior matches the deterministic local sample', () => {
    const document = buildMLBReportPreviewLocalPageDocument();
    const warningsNode = document.nodes.find((node) => node.kind === 'warnings');
    expect(warningsNode).toBeDefined();
    if (warningsNode && 'warnings' in warningsNode) {
      const messages = warningsNode.warnings.map((w) => w.message);
      expect(messages).toContain('Local synthetic evidence only.');
    }
  });

  // 13. helper wraps pipeline failures in fixed safe message
  it('wraps pipeline failures with a fixed safe error', async () => {
    const moduleId = '@/prospective/mlb/research-report-adapter';
    const syntheticError = new Error('synthetic adapter failure');

    vi.resetModules();
    vi.doMock(moduleId, () => ({
      buildMLBResearchReportFromPackage: () => {
        throw syntheticError;
      },
    }));

    try {
      const module = await import(
        '@/prospective/mlb/report-preview-local-page-document'
      );

      let caught: unknown;

      try {
        module.buildMLBReportPreviewLocalPageDocument();
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toBe(
        'MLB report preview page construction failed',
      );
      expect((caught as Error).cause).toBe(syntheticError);
    } finally {
      vi.doUnmock(moduleId);
      vi.resetModules();
    }
  });

  // 14. page source contains no 'use client'
  it('page source contains no use client', () => {
    const source = readFileSync(PAGE_PATH, 'utf8');
    expect(source).not.toContain("'use client'");
    expect(source).not.toContain('"use client"');
  });

  // 15. page source contains no hooks
  it('page source contains no hooks', () => {
    const source = readFileSync(PAGE_PATH, 'utf8');
    expect(source).not.toContain('useState');
    expect(source).not.toContain('useEffect');
    expect(source).not.toContain('useMemo');
    expect(source).not.toContain('useCallback');
    expect(source).not.toContain('useContext');
    expect(source).not.toContain('useReducer');
    expect(source).not.toContain('useRef');
  });

  // 16. page source contains no async
  it('page source contains no async', () => {
    const source = readFileSync(PAGE_PATH, 'utf8');
    expect(source).not.toContain('async function');
    expect(source).not.toContain('async ');
  });

  // 17. page source contains no fetch
  it('page source contains no fetch', () => {
    const source = readFileSync(PAGE_PATH, 'utf8');
    expect(source).not.toContain('fetch(');
  });

  // 18. page source contains no browser APIs
  it('page source contains no browser APIs', () => {
    const source = readFileSync(PAGE_PATH, 'utf8');
    expect(source).not.toContain('window');
    expect(source).not.toContain('document.');
    expect(source).not.toContain('navigator');
    expect(source).not.toContain('location');
    expect(source).not.toContain('history');
  });

  // 19. page source contains no browser storage
  it('page source contains no browser storage', () => {
    const source = readFileSync(PAGE_PATH, 'utf8');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('sessionStorage');
  });

  // 20. helper source contains no fixture import
  it('helper source contains no fixture import', () => {
    const source = readFileSync(HELPER_PATH, 'utf8');
    expect(source).not.toContain('fixture');
  });

  // 21. helper source contains no golden import
  it('helper source contains no golden import', () => {
    const source = readFileSync(HELPER_PATH, 'utf8');
    expect(source).not.toContain('golden');
  });

  // 22. helper source contains no CLI or script import
  it('helper source contains no CLI or script import', () => {
    const source = readFileSync(HELPER_PATH, 'utf8');
    expect(source).not.toContain('CLI');
    expect(source).not.toContain('./scripts');
    expect(source).not.toContain('scripts/');
  });

  // 23. helper source contains no route-handler or API-route import
  it('helper source contains no route-handler or API-route import', () => {
    const source = readFileSync(HELPER_PATH, 'utf8');
    expect(source).not.toContain('route handler');
    expect(source).not.toContain('API route');
  });

  // 24. helper source contains no wall clock
  it('helper source contains no wall clock', () => {
    const source = readFileSync(HELPER_PATH, 'utf8');
    expect(source).not.toContain('Date.now');
    expect(source).not.toContain('new Date(');
  });

  // 25. helper source contains no randomness
  it('helper source contains no randomness', () => {
    const source = readFileSync(HELPER_PATH, 'utf8');
    expect(source).not.toContain('Math.random');
    expect(source).not.toContain('crypto.randomUUID');
  });

  // 26. helper source contains no environment access
  it('helper source contains no environment access', () => {
    const source = readFileSync(HELPER_PATH, 'utf8');
    expect(source).not.toContain('process.env');
  });

  // 27. no raw handler response or raw JSON is rendered
  it('renders no raw handler response or raw JSON', () => {
    render(<MLBReportPreviewPage />);
    const container = document.body.textContent || '';
    expect(container).not.toContain('INVALID_REQUEST');
    expect(container).not.toContain('MISSING_REPORT_PREVIEW');
    expect(container).not.toContain('"ok":false');
  });

  // 28. no model-derived links, styles, or event handlers
  it('renders no model-derived links, styles, or event handlers', () => {
    render(<MLBReportPreviewPage />);
    expect(document.querySelectorAll('a').length).toBe(0);
    expect(document.querySelectorAll('[style]').length).toBe(0);
    expect(document.querySelectorAll('[onClick]').length).toBe(0);
    expect(document.querySelectorAll('[onPress]').length).toBe(0);
  });

  // 29. no prohibited analytical language introduced
  it('introduces no prohibited analytical language', () => {
    render(<MLBReportPreviewPage />);
    const text = document.body.textContent || '';
    // Safety notes intentionally name excluded data types (odds, market, pitcher)
    // as negative constraints. Check remaining prohibited terms only.
    const prohibited = [
      'best bet',
      'value bet',
      'should win',
      'likely winner',
      'win probability',
      'implied probability',
      'power ranking',
      'team ranking',
      'standings position',
      'sportsbook',
      'favorite',
      'underdog',
      'modelProbability',
    ];
    for (const term of prohibited) {
      expect(text.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });

  // 30. page and helper production imports remain within their allowlists
  it('page and helper production imports remain within their allowlists', () => {
    const pageSource = readFileSync(PAGE_PATH, 'utf8');
    const helperSource = readFileSync(HELPER_PATH, 'utf8');

    const allowedPageModules = [
      '@/app/_components/mlb-report-preview/MLBReportPreviewRenderer',
      '@/prospective/mlb/report-preview-local-page-document',
      'react',
    ];
    const pageImports = pageSource.match(/^import .+ from .+;$/gm) || [];
    for (const imp of pageImports) {
      const match = imp.match(/from '(.+)'/);
      if (match) {
        expect(allowedPageModules).toContain(match[1]);
      }
    }

    const allowedHelperModules = [
      './research-report-adapter',
      './research-report-renderer',
      './report-preview-api-handler',
      './report-preview-ui-view-model',
      './report-preview-ui-components',
      './report-preview-ui-adapter',
    ];
    const helperImports = helperSource.match(/^import .+ from .+;$/gm) || [];
    for (const imp of helperImports) {
      const match = imp.match(/from '(.+)'/);
      if (match) {
        expect(allowedHelperModules).toContain(match[1]);
      }
    }
  });
});
