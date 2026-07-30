// @vitest-environment jsdom
import React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';

const DASHBOARD_PATH = 'src/app/(app)/dashboard/page.tsx';
const PAGE_PATH = 'src/app/(app)/mlb/report-preview/page.tsx';

vi.mock('@/server/actions', () => ({
  __esModule: true,
  getDashboardStats: vi.fn().mockResolvedValue({
    databaseAvailable: true,
    eventCount: 42,
    candidateCount: 7,
    lastRefreshAt: new Date('2024-07-01T00:00:00.000Z'),
    lastRefreshProvider: 'fixture',
  }),
  getRecentMultis: vi.fn().mockResolvedValue([
    {
      id: 'local-1',
      targetTier: 1,
      status: 'ANALYSED',
      combinedOdds: 3.4,
      legs: [{}, {}],
    },
    {
      id: 'local-2',
      targetTier: 2,
      status: 'PENDING',
      combinedOdds: 5.1,
      legs: [{}],
    },
  ]),
}));

import DashboardPage from '@/app/(app)/dashboard/page';
import MLBReportPreviewPage from '@/app/(app)/mlb/report-preview/page';

async function renderDashboard() {
  const element = await DashboardPage();
  return render(element);
}

describe('MLBReportPreviewDashboardNavigation', () => {
  beforeAll(() => {
    vi.stubGlobal('React', React);
  });

  afterAll(() => {
    vi.doUnmock('@/server/actions');
    vi.unstubAllGlobals();
  });

  // 1. dashboard renders without throwing with deterministic mocked action data
  it('renders without throwing with deterministic mocked action data', async () => {
    await renderDashboard();
  });

  // 2. dashboard renders a link to /mlb/report-preview
  it('renders a link to /mlb/report-preview', async () => {
    await renderDashboard();
    expect(screen.getByRole('link', { name: 'MLB Report Preview' })).toBeDefined();
  });

  // 3. link text is exactly MLB Report Preview
  it('link text is exactly MLB Report Preview', async () => {
    await renderDashboard();
    expect(screen.getByText('MLB Report Preview')).toBeDefined();
  });

  // 4. exactly one report-preview link exists
  it('renders exactly one report-preview link', async () => {
    await renderDashboard();
    const links = screen.getAllByRole('link', { name: 'MLB Report Preview' });
    expect(links).toHaveLength(1);
  });

  // 5. rendered link is a real anchor
  it('renders a real anchor', async () => {
    await renderDashboard();
    const link = screen.getByRole('link', { name: 'MLB Report Preview' });
    expect(link.tagName).toBe('A');
  });

  // 6. anchor href resolves to /mlb/report-preview
  it('anchor href resolves to /mlb/report-preview', async () => {
    await renderDashboard();
    const link = screen.getByRole('link', { name: 'MLB Report Preview' });
    expect(link.getAttribute('href')).toBe('/mlb/report-preview');
  });

  // 7. link has no target="_blank"
  it('link has no target="_blank"', async () => {
    await renderDashboard();
    const link = screen.getByRole('link', { name: 'MLB Report Preview' });
    expect(link.hasAttribute('target')).toBe(false);
  });

  // 8. link has no click handler
  it('link has no click handler', async () => {
    await renderDashboard();
    const link = screen.getByRole('link', { name: 'MLB Report Preview' });
    expect(link.hasAttribute('onClick')).toBe(false);
  });

  // 9. link appears after the dashboard heading
  it('link appears after the dashboard heading', async () => {
    await renderDashboard();
    const heading = screen.getByRole('heading', { level: 1 });
    const link = screen.getByRole('link', { name: 'MLB Report Preview' });
    expect(heading.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  // 10. link appears before the Research Status section
  it('link appears before the Research Status section', async () => {
    await renderDashboard();
    const link = screen.getByRole('link', { name: 'MLB Report Preview' });
    const section = screen.getByRole('heading', { name: 'Research Status' });
    expect(link.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  // 11. dashboard heading remains present
  it('dashboard heading remains present', async () => {
    await renderDashboard();
    expect(
      screen.getByRole('heading', { name: 'Multi Research Engine — Dashboard' }),
    ).toBeDefined();
  });

  // 12. Research Status content remains present
  it('Research Status content remains present', async () => {
    await renderDashboard();
    expect(screen.getByText('Research Status')).toBeDefined();
    expect(screen.getByText('Database')).toBeDefined();
  });

  // 13. recent multis content remains present
  it('recent multis content remains present', async () => {
    await renderDashboard();
    expect(screen.getByText('Recent Multis')).toBeDefined();
    expect(screen.getByText('1 researched multi')).toBeDefined();
  });

  // 14. dashboard footer content remains present
  it('dashboard footer content remains present', async () => {
    await renderDashboard();
    expect(
      screen.getByText(
        'Phase 0 demonstration — mock fixtures only. Not validated against historical outcomes.',
      ),
    ).toBeDefined();
  });

  // 15. target report-preview page still renders one <main>
  it('target report-preview page still renders one main', () => {
    render(<MLBReportPreviewPage />);
    expect(document.querySelectorAll('main').length).toBe(1);
  });

  // 16. target report-preview page still renders one renderer article
  it('target report-preview page still renders one renderer article', () => {
    render(<MLBReportPreviewPage />);
    expect(document.querySelectorAll('main > article').length).toBe(1);
  });

  // 17. target report-preview page still renders exactly one h1
  it('target report-preview page still renders exactly one h1', () => {
    render(<MLBReportPreviewPage />);
    expect(document.querySelectorAll('h1').length).toBe(1);
  });

  // 18. target report-preview limitations remain visible
  it('target report-preview limitations remain visible', () => {
    render(<MLBReportPreviewPage />);
    expect(screen.getByText('Limitations')).toBeDefined();
  });

  // 19. target report-preview limitations remain last
  it('target report-preview limitations remain last', () => {
    render(<MLBReportPreviewPage />);
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings[headings.length - 1].textContent).toBe('Limitations');
  });

  // 20. dashboard source imports Link from next/link
  it('dashboard source imports Link from next/link', () => {
    const source = fs.readFileSync(DASHBOARD_PATH, 'utf8');
    expect(source).toContain("import Link from 'next/link';");
  });

  // 21. dashboard source contains no 'use client'
  it('dashboard source contains no use client', () => {
    const source = fs.readFileSync(DASHBOARD_PATH, 'utf8');
    expect(source).not.toContain("'use client'");
    expect(source).not.toContain('"use client"');
  });

  // 22. dashboard source contains no hooks or router navigation calls
  it('dashboard source contains no hooks or router navigation calls', () => {
    const source = fs.readFileSync(DASHBOARD_PATH, 'utf8');
    expect(source).not.toContain('useState');
    expect(source).not.toContain('useEffect');
    expect(source).not.toContain('useRouter');
    expect(source).not.toContain('usePathname');
    expect(source).not.toContain('router.push');
  });

  // 23. dashboard source contains no browser APIs or click navigation
  it('dashboard source contains no browser APIs or click navigation', () => {
    const source = fs.readFileSync(DASHBOARD_PATH, 'utf8');
    expect(source).not.toContain('window.');
    expect(source).not.toContain('document.');
    expect(source).not.toContain('navigator');
    expect(source).not.toContain('location');
    expect(source).not.toContain('history');
    expect(source).not.toContain('onClick');
  });

  // 24. link copy contains no live-data, betting, prediction, winner, probability, ranking, score, or pitcher language
  it('link copy contains no prohibited language', async () => {
    await renderDashboard();
    const link = screen.getByRole('link', { name: 'MLB Report Preview' });
    const text = link.textContent?.toLowerCase() ?? '';
    const prohibited = [
      'odds',
      'sportsbook',
      'betting',
      'market',
      'edge',
      'roi',
      'favorite',
      'underdog',
      'live',
      'winner',
      'predict',
      'probability',
      'ranking',
      'standings',
      'score',
      'pitcher',
      'starter',
    ];
    for (const term of prohibited) {
      expect(text).not.toContain(term);
    }
  });

  // 25. production imports remain within the dashboard's existing allowlist plus next/link and react, and no report-preview implementation module is imported
  it('production imports remain within the allowlist', () => {
    const source = fs.readFileSync(DASHBOARD_PATH, 'utf8');
    const imports = source.match(/^import .+ from .+;$/gm) || [];
    const froms = imports
      .map((imp) => imp.match(/from '(.+)'/)?.[1] ?? '')
      .filter((mod) => mod);

    for (const mod of froms) {
      const expected = ['next/link', '@/server/actions'];
      if (!expected.includes(mod)) {
        throw new Error(`Unexpected dashboard import: ${mod}`);
      }
    }

    const prohibitedModules = [
      'report-preview-local-page-document',
      'MLBReportPreviewRenderer',
      'report-preview-api-handler',
      'report-preview-ui-adapter',
      'useRouter',
      'usePathname',
    ];
    for (const mod of prohibitedModules) {
      expect(source).not.toContain(mod);
    }
  });
});
