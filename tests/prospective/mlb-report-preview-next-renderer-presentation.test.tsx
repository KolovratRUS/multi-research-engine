// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'path';

import MLBReportPreviewPage from '@/app/(app)/mlb/report-preview/page';
import { MLBReportPreviewRenderer } from '@/app/_components/mlb-report-preview/MLBReportPreviewRenderer';
import { buildMLBReportPreviewLocalPageDocument } from '@/prospective/mlb/report-preview-local-page-document';
import {
  assertMLBReportPreviewUIAdapterDocument,
  type MLBReportPreviewUIAdapterDocument,
} from '@/prospective/mlb/report-preview-ui-adapter';

const RENDERER_PATH = path.resolve(
  __dirname,
  '../../src/app/_components/mlb-report-preview/MLBReportPreviewRenderer.tsx',
);

const APPROVED_CLASS_TOKENS = new Set([
  'max-w-3xl',
  'mx-auto',
  'px-4',
  'py-8',
  'space-y-8',
  'space-y-4',
  'space-y-3',
  'space-y-2',
  'space-y-1',
  'text-sm',
  'text-lg',
  'text-2xl',
  'font-medium',
  'font-semibold',
  'text-gray-600',
  'rounded',
  'border',
  'border-gray-200',
  'bg-gray-50',
  'p-3',
  'list-disc',
  'pl-5',
]);

function buildDeterministicDocument(): MLBReportPreviewUIAdapterDocument {
  const document = buildMLBReportPreviewLocalPageDocument();
  assertMLBReportPreviewUIAdapterDocument(document);
  return document;
}

const EXPECTED_RENDERER_IMPORT_MODULES = [
  'react',
  '@/prospective/mlb/report-preview-ui-adapter',
  '@/prospective/mlb/report-preview-ui-adapter',
] as const;

describe('MLBReportPreviewRendererPresentation', () => {
  // 1. page still renders exactly one main
  it('target page still renders exactly one main', () => {
    render(<MLBReportPreviewPage />);
    expect(document.querySelectorAll('main').length).toBe(1);
  });

  // 2. renderer still renders exactly one root article
  it('renderer still renders exactly one root article', () => {
    render(<MLBReportPreviewPage />);
    expect(document.querySelectorAll('main > article').length).toBe(1);
  });

  // 3. target page still renders exactly one h1
  it('target page still renders exactly one h1', () => {
    render(<MLBReportPreviewPage />);
    expect(document.querySelectorAll('h1').length).toBe(1);
  });

  // 4. adapter root-node order remains unchanged
  it('adapter root-node order remains unchanged', () => {
    const documentAdapter = buildDeterministicDocument();
    const kinds = documentAdapter.nodes.map((node) => node.kind);
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

  // 5. limitations remain visible
  it('limitations remain visible', () => {
    render(<MLBReportPreviewPage />);
    expect(screen.getByText('Limitations')).toBeDefined();
  });

  // 6. limitations remain the final renderer section
  it('limitations remain the final renderer section', () => {
    render(<MLBReportPreviewPage />);
    const sections = document.querySelectorAll('article > section, article > [aria-label="Warnings"]');
    const last = sections[sections.length - 1];
    expect(last?.tagName).toBe('SECTION');
    expect(last?.textContent).toContain('Limitations');
  });

  // 7. warnings remain visible when warning data is present
  it('warnings remain visible when warning data is present', () => {
    render(<MLBReportPreviewPage />);
    const warningsRegion = screen.getByRole('region', { name: 'Warnings' });
    expect(warningsRegion).toBeDefined();
    expect(warningsRegion.textContent).toContain('Local synthetic evidence only.');
  });

  // 8. rendered output contains no raw JSON block
  it('rendered output contains no raw JSON block', () => {
    render(<MLBReportPreviewPage />);
    const text = document.body.textContent || '';
    expect(text).not.toContain('"ok":false');
    expect(text).not.toContain('INVALID_REQUEST');
    expect(text).not.toContain('MISSING_REPORT_PREVIEW');
    expect(text).not.toMatch(/\{.*"name".*"version".*\}/);
  });

  // 9. rendered output contains no raw handler response
  it('rendered output contains no raw handler response', () => {
    render(<MLBReportPreviewPage />);
    expect(document.body.textContent).not.toContain('MLB report preview page construction failed');
  });

  // 10. renderer produces no model-derived links
  it('renderer produces no model-derived links', () => {
    render(<MLBReportPreviewPage />);
    expect(document.querySelectorAll('a').length).toBe(0);
  });

  // 11. renderer produces no event-handler attributes
  it('renderer produces no event-handler attributes', () => {
    const documentAdapter = buildDeterministicDocument();
    const { container } = render(<MLBReportPreviewRenderer document={documentAdapter} />);
    const eventAttrs = [
      'onClick',
      'onPress',
      'onChange',
      'onSubmit',
      'onFocus',
      'onBlur',
      'onMouseEnter',
      'onMouseLeave',
    ];
    for (const attr of eventAttrs) {
      expect(container.querySelector(`[${attr}]`)).toBeNull();
    }
  });

  // 12. representative adapter content remains visible
  it('representative adapter content remains visible', () => {
    render(<MLBReportPreviewPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('MLB Report Preview');
    expect(screen.getByText('Research preview')).toBeDefined();
    expect(screen.getByText('Technical metadata')).toBeDefined();
    expect(screen.getByText('Game cards')).toBeDefined();
    expect(screen.getByText('Game details')).toBeDefined();
    expect(screen.getAllByText('Local synthetic evidence only.').length).toBeGreaterThan(0);
  });

  // 13. dashboard link still targets /mlb/report-preview
  it('dashboard link still targets /mlb/report-preview', async () => {
    const source = await fs.promises.readFile('src/app/(app)/dashboard/page.tsx', 'utf8');
    expect(source).toContain('href="/mlb/report-preview"');
  });

  // 14. renderer does not mutate the adapter document
  it('renderer does not mutate the adapter document', () => {
    const documentAdapter = buildDeterministicDocument();
    const frozen = JSON.stringify(documentAdapter);
    render(<MLBReportPreviewRenderer document={documentAdapter} />);
    expect(JSON.stringify(documentAdapter)).toBe(frozen);
  });

  // 15. root renderer article contains approved width/spacing tokens
  it('root renderer article contains max-w-3xl mx-auto px-4 py-8 and space-y-8', () => {
    const documentAdapter = buildDeterministicDocument();
    const { container } = render(<MLBReportPreviewRenderer document={documentAdapter} />);
    const article = container.querySelector('article');
    expect(article).toBeDefined();
    const tokens = (article?.className ?? '').split(/\s+/).filter(Boolean);
    expect(tokens).toEqual(
      expect.arrayContaining(['max-w-3xl', 'mx-auto', 'px-4', 'py-8', 'space-y-8']),
    );
  });

  // 16. renderer header contains space-y-4
  it('renderer header contains space-y-4', () => {
    const documentAdapter = buildDeterministicDocument();
    const { container } = render(<MLBReportPreviewRenderer document={documentAdapter} />);
    const header = container.querySelector('header');
    expect(header).toBeDefined();
    const tokens = (header?.className ?? '').split(/\s+/).filter(Boolean);
    expect(tokens).toEqual(expect.arrayContaining(['space-y-4']));
  });

  // 17. renderer title contains text-2xl and font-semibold
  it('renderer title contains text-2xl and font-semibold', () => {
    const documentAdapter = buildDeterministicDocument();
    const { container } = render(<MLBReportPreviewRenderer document={documentAdapter} />);
    const title = container.querySelector('h1');
    expect(title).toBeDefined();
    expect(title).toHaveClass('text-2xl');
    expect(title).toHaveClass('font-semibold');
  });

  // 18. renderer section headings use text-lg and font-medium
  it('renderer section headings use text-lg and font-medium', () => {
    const documentAdapter = buildDeterministicDocument();
    const { container } = render(<MLBReportPreviewRenderer document={documentAdapter} />);
    const headings = Array.from(
      container.querySelectorAll('section > h2, section > h3'),
    );
    expect(headings.length).toBeGreaterThan(0);
    for (const heading of headings) {
      expect(heading).toHaveClass('text-lg');
      expect(heading).toHaveClass('font-medium');
    }
  });

  // 19. warnings section uses exactly the required neutral structural class tokens
  it('warnings section uses exactly the required neutral structural class tokens', () => {
    const documentAdapter = buildDeterministicDocument();
    const { container } = render(<MLBReportPreviewRenderer document={documentAdapter} />);
    const warningsSection = container.querySelector('section[aria-label="Warnings"]');
    expect(warningsSection).toBeDefined();
    const tokens = (warningsSection?.className ?? '').split(/\s+/).filter(Boolean);
    expect(tokens).toEqual(['rounded', 'border', 'border-gray-200', 'bg-gray-50', 'p-3']);
  });

  // 20. limitations section uses exactly the required neutral structural class tokens
  it('limitations section uses exactly the required neutral structural class tokens', () => {
    const documentAdapter = buildDeterministicDocument();
    const { container } = render(<MLBReportPreviewRenderer document={documentAdapter} />);
    const sections = container.querySelectorAll('section');
    const limitationsSection = Array.from(sections).find((section) =>
      (section.textContent ?? '').includes('Limitations'),
    );
    expect(limitationsSection).toBeDefined();
    const tokens = (limitationsSection?.className ?? '').split(/\s+/).filter(Boolean);
    expect(tokens).toEqual(['rounded', 'border', 'border-gray-200', 'bg-gray-50', 'p-3']);
  });

  // 21. approved ordinary lists use list-disc, pl-5, and space-y-1
  it('approved ordinary lists use list-disc pl-5 and space-y-1', () => {
    const documentAdapter = buildDeterministicDocument();
    const { container } = render(<MLBReportPreviewRenderer document={documentAdapter} />);
    const lists = container.querySelectorAll('ul');
    expect(lists.length).toBeGreaterThan(0);
    for (const list of Array.from(lists)) {
      const tokens = (list.className ?? '').split(/\s+/).filter(Boolean);
      expect(tokens).toEqual(expect.arrayContaining(['list-disc', 'pl-5', 'space-y-1']));
    }
  });

  // 22. renderer source contains no unsafe source patterns
  it('renderer source contains no inline styles CSS-module import new CSS import client directive hooks browser APIs or event handlers', async () => {
    const source = await fs.promises.readFile(RENDERER_PATH, 'utf8');
    expect(source).not.toMatch(/style=/);
    expect(source).not.toMatch(/CSS[- ]module/i);
    expect(source).not.toMatch(/className\s*=\s*\{/);
    expect(source).not.toMatch(/import ReactDOM/);
    expect(source).not.toContain("'use client'");
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain('useState');
    expect(source).not.toContain('useEffect');
    expect(source).not.toContain('useMemo');
    expect(source).not.toContain('useCallback');
    expect(source).not.toContain('useContext');
    expect(source).not.toContain('useReducer');
    expect(source).not.toContain('useRef');
    expect(source).not.toContain('useRouter');
    expect(source).not.toContain('usePathname');
    expect(source).not.toMatch(/window\./);
    expect(source).not.toMatch(/navigator/);
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('sessionStorage');
    expect(source).not.toContain('router.push');
    expect(source).not.toContain('onClick');
    expect(source).not.toContain('onChange');
    expect(source).not.toContain('onSubmit');
    expect(source).not.toContain('onFocus');
    expect(source).not.toContain('onBlur');
    expect(source).not.toContain('onMouseEnter');
    expect(source).not.toContain('onMouseLeave');
  });

  // 23. renderer source contains no semantic analytical colour mapping or prohibited visual wording
  it('renderer source contains no semantic analytical colour mapping or prohibited visual wording', async () => {
    const source = await fs.promises.readFile(RENDERER_PATH, 'utf8');
    expect(source).not.toMatch(/\b(?:red|amber|yellow|green|blue|purple|orange|emerald|rose|lime|cyan|indigo|teal)-/);
    expect(source).not.toMatch(/\bshadow\b/);
    expect(source).not.toContain('hover:');
    expect(source).not.toContain('focus:');
    expect(source).not.toContain('transition');
    expect(source).not.toContain('animate');
    expect(source).not.toContain('hidden');
    expect(source).not.toContain('truncate');
    expect(source).not.toContain('line-clamp');
    expect(source).not.toContain('sticky');
    expect(source).not.toContain('absolute');
    expect(source).not.toContain('sportsbook');
    expect(source).not.toContain('best bet');
    expect(source).not.toContain('value bet');
    expect(source).not.toContain('should win');
    expect(source).not.toContain('likely winner');
    expect(source).not.toContain('win probability');
    expect(source).not.toContain('implied probability');
    expect(source).not.toContain('market edge');
    expect(source).not.toContain('power ranking');
    expect(source).not.toContain('team ranking');
    expect(source).not.toContain('standings position');
    expect(source).not.toContain('final score');
    expect(source).not.toContain('actual starting pitcher');
    expect(source).not.toContain('pitcher evidence');
    expect(source).not.toMatch(/\b(?:weak|recommended|high win chance)\b/i);
  });

  // 24. renderer production imports remain exactly within the pre-Phase-6S allowlist with no new import
  it('renderer production imports remain exactly within the pre-Phase-6S allowlist with no new import', async () => {
    const source = await fs.promises.readFile(RENDERER_PATH, 'utf8');
    const currentModules = Array.from(
      source.matchAll(/from ['"]([^'"]+)['"]/g),
    ).map((m) => m[1] ?? '');
    expect(currentModules).toEqual(EXPECTED_RENDERER_IMPORT_MODULES);
  });

  // 25. every renderer className token belongs to the Phase 6S utility allowlist
  it('every renderer className token belongs to the Phase 6S utility allowlist', async () => {
    const source = await fs.promises.readFile(RENDERER_PATH, 'utf8');
    const classMatches = source.matchAll(/className="([^"]*)"/g);
    const tokens = new Set<string>();
    for (const match of classMatches) {
      const value = match[1] ?? '';
      for (const token of value.split(/\s+/).filter(Boolean)) {
        tokens.add(token);
      }
    }
    for (const token of tokens) {
      expect(APPROVED_CLASS_TOKENS.has(token)).toBe(true);
    }
  });
});
