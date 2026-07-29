# MLB Report Preview Next.js Page Integration Plan

## 1. Phase status

Documentation-only. Phase 6N defines the exact future boundary for mounting the local Next.js MLB report-preview page. It does not modify source files, tests, pages, layouts, CSS, Tailwind configuration, routes, package files, fixtures, goldens, or CLI behavior.

No live source used.
No real MLB API request made.
No web lookup used.
No generated prospective run artifact committed.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
`modelProbability` remains null/absent/not available until calibrated.

## 2. Repository route evidence

Inspected files:
- `src/app/layout.tsx` — single root layout using Inter font. It renders `{children}` inside `<body>` with no authentication wrapper.
- `src/app/(app)/dashboard/page.tsx` — server component (`export const dynamic = 'force-dynamic'` and `export default async function DashboardPage()`).
- `src/app/globals.css` — global CSS only.
- `src/server/routes.ts` — one route handler returning JSON stats.
- `next.config.js` — standard Next.js configuration.
- `tailwind.config.ts` — scans `src/app`, `src/pages`, `src/components`.
- `tsconfig.json` — path alias `@/*` → `./src/*`.

Existing App Router pages:
- `src/app/(app)/dashboard/page.tsx`

Current report-preview components:
- `src/app/_components/mlb-report-preview/MLBReportPreviewRenderer.tsx`

No `'use client'` directives are present in `src/app`, `src/server`, or `src/prospective`.
No existing routes expose the report preview.

## 3. Existing safe pipeline

`src/prospective/mlb/report-preview-api-handler.ts`
- `handleMLBReportPreviewApiRequest(request)` → `MLBReportPreviewApiHandlerResponse`
- `assertMLBReportPreviewApiHandlerSuccess(response)`

`src/prospective/mlb/report-preview-ui-view-model.ts`
- `buildMLBReportPreviewUIViewModelFromHandlerSuccess(success)` → `MLBReportPreviewUIViewModel`

`src/prospective/mlb/report-preview-ui-components.ts`
- `buildMLBReportPreviewUIPresentation(viewModel)` → `MLBReportPreviewUIPresentation`

`src/prospective/mlb/report-preview-ui-adapter.ts`
- `buildMLBReportPreviewUIAdapterDocument(presentation)` → `MLBReportPreviewUIAdapterDocument`

`src/app/_components/mlb-report-preview/MLBReportPreviewRenderer.tsx`
- `MLBReportPreviewRenderer` accepts exactly one `MLBReportPreviewUIAdapterDocument`.
- Renders semantic HTML tree: `article > header`, `metadata`, `section-list`, `game-card-list`, `game-detail-list`, `warnings`, `limitations`.

## 4. Immediate integration boundary

One local App Router server-only page only.
No data fetching.
No user input beyond the URL path.
No live, API, web, or CLI boundaries in the page itself.
No odds, sportsbook, betting, market, EV, ROI, or edge language.

## 5. Route choice

Future page path:
`src/app/(app)/mlb/report-preview/page.tsx`

Resulting URL:
`/mlb/report-preview`

Rationale:
- Matches the existing `(app)` route group convention used by `/dashboard`.
- Isolates the preview in a new sibling route group rather than modifying or embedding inside `/dashboard`.
- Does not touch `src/app/(app)/dashboard/page.tsx`.
- Inherits the root layout and global CSS automatically.
- No existing navigation points to this route, so dashboard navigation modification is deferred.

## 6. Source-data decision

Chosen mode: Option A — local deterministic production-owned synthetic source.

Reason:
- `src/prospective/mlb/local-dry-run-sample.ts` is owned by the prospective weekly schemas module. Its return types (`MLBProspectiveWeeklyRunManifest`, `MLBProspectiveScheduleSnapshot`, etc.) do not align with the report-preview pipeline's required `MLBResearchRenderedReport` input. Reusing it directly would require a second adapter boundary and bypass the established report-preview handler.
- No existing production-owned local sample produces a ready-to-render `MLBResearchRenderedReport`.
- Option C (test fixture or golden reuse) is prohibited: the page must not read `tests/prospective/fixtures/manual-schedule/valid-mlb-report-preview-local-cli-output-v1.json` as application data, and must not import test fixtures directly.

The plan therefore provisions one narrow server-only helper:
`src/prospective/mlb/report-preview-local-page-document.ts`

This helper will construct a minimal deterministic `MLBResearchReportInputPackage`, run it through the existing production builders `buildMLBResearchReportFromPackage` and `renderMLBResearchReport`, then pass the rendered report into `handleMLBReportPreviewApiRequest`, and continue through the existing view-model, presentation, and adapter layers. The helper alone will own the local deterministic production-owned synthetic data and will not import fixtures, goldens, scripts, CLI modules, browser APIs, or live sources.

## 7. Local document construction

Exact future helper imports:
- `buildMLBResearchReportFromPackage` from `./research-report-adapter`
- `renderMLBResearchReport` from `./research-report-renderer`
- `handleMLBReportPreviewApiRequest` from `./report-preview-api-handler`
- `assertMLBReportPreviewApiHandlerSuccess` from `./report-preview-api-handler`
- `buildMLBReportPreviewUIViewModelFromHandlerSuccess` from `./report-preview-ui-view-model`
- `buildMLBReportPreviewUIPresentation` from `./report-preview-ui-components`
- `buildMLBReportPreviewUIAdapterDocument` from `./report-preview-ui-adapter`

Planned local input shape:
- Two deterministic local sample games.
- Local-away / local-home team identifiers.
- `TEAM_ONLY` evidence (no pitcher fields, no live schedule data).
- Pre-game snapshots exclude `finalScore` and `completedGameState`.
- `modelProbability` remains null throughout.
- All timestamps are deterministic ISO strings.

Planned construction sequence:
1. Build minimal `MLBResearchReportInputPackage`.
2. `buildMLBResearchReportFromPackage(package, { generatedAt })`.
3. `assertRendererOutputSafeForDisplay(report)` to enforce safety before rendering.
4. `renderMLBResearchReport(report, { title: 'MLB Report Preview' })`.
5. `handleMLBReportPreviewApiRequest({ reportPreview: renderedReport, source: 'local-report-preview' })`.
6. `assertMLBReportPreviewApiHandlerSuccess(response)`.
7. `buildMLBReportPreviewUIViewModelFromHandlerSuccess(response)`.
8. `buildMLBReportPreviewUIPresentation(viewModel)`.
9. `buildMLBReportPreviewUIAdapterDocument(presentation)`.

The helper must not reconstruct adapter fields manually.
The helper must not skip any validation boundary.

## 8. Page input and renderer handoff

Future page imports:
- `MLBReportPreviewRenderer` from `@/app/_components/mlb-report-preview/MLBReportPreviewRenderer`
- `buildMLBReportPreviewLocalPageDocument` from `@/prospective/mlb/report-preview-local-page-document`

Page render boundary:
```tsx
export default function MLBReportPreviewPage() {
  const document = buildMLBReportPreviewLocalPageDocument();
  return <main><MLBReportPreviewRenderer document={document} /></main>;
}
```

The renderer receives exactly one `MLBReportPreviewUIAdapterDocument`.
The page must not spread adapter nodes into page JSX.
The page must not duplicate header, metadata, section, card, detail, warning, or limitation markup.
The page must not reorder, remove, or remap root nodes.

## 9. Server/client boundary

The page must:
- have no `'use client'`;
- use no React hooks;
- use no browser APIs;
- use no event handlers;
- use no client state;
- use no client-side storage;
- use no client fetch/polling/hydration-dependent behavior;
- use no `window`, `document`, `localStorage`, `sessionStorage`, `navigator`, `location`, `history`, `fetch`, `axios`, `WebSocket`, `EventSource`, `setTimeout`, or `setInterval`.

Because the local page-document helper is deterministic and synchronous, the page must also be a synchronous server component (no `async`).

## 10. File-boundary recommendation

Exact future implementation slice (3 files):
1. `src/app/(app)/mlb/report-preview/page.tsx`
2. `src/prospective/mlb/report-preview-local-page-document.ts`
3. `tests/prospective/mlb-report-preview-next-page.test.tsx`

Deferred or forbidden files in this phase:
- No loading, error, or layout files.
- No CSS files or Tailwind classes.
- No route handlers or API routes.
- No barrel exports.
- No additional component files.
- No CLI script changes.

If later investigation proves the document can be safely constructed inline in the page without a helper, the slice becomes 2 files. The plan prefers the 3-file shape because it preserves testing of the local document boundary independently of App Router semantics.

## 11. Page semantic structure

```text
<main>
  <article>
    <header>...</header>
    ... exact adapter nodes in order ...
    <section>warnings</section> (or omitted in empty state)
    <section>limitations</section>
  </article>
</main>
```

The renderer owns the single `<article>` and the only `<h1>`.
The page adds only `<main>`.
No duplicate visible heading elements.
No hidden safety notes.

## 12. Failure behavior

Preferred first slice:
- Local construction failure → throw → allow Next.js server error boundary.

The page must not render:
- raw error objects;
- stack traces;
- raw handler responses;
- raw JSON;
- partial fallback analysis;
- lower-layer data;
- retry buttons.

If the handler returns a typed failure, the helper must convert it or throw a fixed safe error before rendering reaches the page. The exact future error boundary is a fixed throw with a short message such as `MLB report preview page construction failed`, which Next.js converts to a 500. No custom error page is planned in this slice.

## 13. Navigation boundary

No navigation in the first page-integration slice beyond direct URL access (`/mlb/report-preview`).
Dashboard modification and any shared menu or header link additions are deferred.
The path is reachable only by direct local URL until a later design phase adds stable navigation.

## 14. Styling boundary

No CSS or Tailwind classes in the first page integration.
The page may use only a bare semantic wrapper (`<main>`) if required.
The renderer already owns semantic markup.
No visual confidence or research-strength coloring is introduced.
No `className`, `style`, or inline style attribute is planned in the page.

## 15. Accessibility boundary

- One route-level `<main>`.
- Renderer’s single `<article>`.
- Renderer’s single `<h1>`.
- No duplicate page `<h1>`.
- No hidden limitations.
- No interaction required.
- No duplicated warnings region.
- No auto-focus, modal, or disclosure.

The page must not interfere with renderer semantics.
Do not claim WCAG compliance.

## 16. Import boundary

Future page imports (allowlist):
- React if required by the renderer runtime.
- `MLBReportPreviewRenderer` from `@/app/_components/mlb-report-preview/MLBReportPreviewRenderer`
- `buildMLBReportPreviewLocalPageDocument` from `@/prospective/mlb/report-preview-local-page-document`

Future helper imports (allowlist):
- Approved production pipeline layers listed in section 7 only.

Prohibited future imports:
- CLI modules.
- `scripts/`.
- `tests/`.
- fixtures or goldens.
- browser modules.
- route handlers (`src/server/routes.ts`).
- live data sources or environment-based fetchers.

## 17. Future test plan

Planned future test categories (`tests/prospective/mlb-report-preview-next-page.test.tsx`):

1. Page renders exactly one `MLBReportPreviewRenderer`.
2. Local document helper returns a valid adapter document.
3. Page uses only adapter-document handoff.
4. Page contains exactly one `<main>`.
5. Rendered preview contains exactly one `<article>`.
6. Exactly one `<h1>` exists.
7. Root adapter node order is preserved through the page.
8. Limitations are visible.
9. Limitations are last.
10. Warnings are omitted when empty.
11. No duplicated renderer markup in page source.
12. No `'use client'` in page source.
13. No hooks in page source.
14. No `fetch` in page source.
15. No browser APIs in page source.
16. No storage in page source.
17. No clock or randomness in page source.
18. No fixture import.
19. No golden import.
20. No CLI import or execution.
21. No route-handler import.
22. No API route import.
23. Page does not mutate the adapter document.
24. Deterministic repeated page rendering produces identical markup.
25. Local construction failure throws safely.
26. No raw handler response rendered.
27. No raw JSON rendered.
28. No model-derived links, styles, events, or casino/betting language.
29. No prohibited analytical language introduced.
30. Future focused tests remain scoped to the new page and helper only.

Tooling:
- Vitest + React Testing Library + jest-dom under jsdom.
- Existing inline `// @vitest-environment jsdom` directive used in report-preview test files.

Notes:
- Direct App Router page behaviors such as exact URL routing, forced-dynamic behavior, or layout inheritance are not verified under jsdom.
- The local document helper should be tested independently as a pure synchronous function.
- The page should be tested as a rendered server component using RTL queries.
- Do not deploy or run a running server for verification.

## 18. Validation requirements

Focused validation:
- `npx vitest run tests/prospective/mlb-report-preview-next-renderer.test.tsx --reporter=verbose`
- `npx vitest run tests/prospective/mlb-report-preview-ui-adapter.test.ts --reporter=verbose`
- `npx vitest run tests/prospective/mlb-report-preview-ui-components.test.ts --reporter=verbose`
- `npx vitest run tests/prospective/mlb-report-preview-ui-view-model.test.ts --reporter=verbose`
- `npx vitest run tests/prospective/mlb-report-preview-ui-view-model-synthetic.test.ts --reporter=verbose`
- `npx vitest run tests/prospective/mlb-report-preview-api-handler.test.ts --reporter=verbose`
- `npx vitest run tests/prospective/mlb-report-preview-api-contract.test.ts --reporter=verbose`
- `npx vitest run tests/prospective --reporter=verbose`
- `npx vitest run tests/backtesting --reporter=verbose`
- `npx vitest run --reporter=verbose`

Build and type checks:
- `npx tsc --noEmit --incremental false --pretty false`
- `npm test`
- `npm run build`
- `git diff --check`

Safety searches:
- Full-text search for forbidden terms in changed files.
- Confirm `modelProbability` appears only in safety/prohibition text or as null in schema/sample/tests.
- Confirm no `source=live` executable command is present.

Golden comparisons (preserved unchanged):
- Phase 5B, 5E, 5H, 5K, 5N, 5T, 5Z all matched prior to this plan.

Inventory guards:
- `npm run inventory:mlb-fixtures`
- `npm run prospective:mlb:dry-run-check`

## 19. Deferred work

- Dashboard navigation link.
- Layout modifications.
- Interactive controls, search, or filters.
- Responsive styling beyond existing Tailwind globals.
- Live, API, web, or fixture-derived real schedule data ingestion.
- Model probability calibration or prediction claims.
- Final scores, actual starters, or pitcher evidence in page data.
- Custom error page.
- Authentication or authorization boundaries.
- Deployment configuration.

## 20. Explicit non-goals

Phase 6N does not create page files, helper files, or tests.
Phase 6N does not modify production TypeScript/TSX, layout, route handler, style, configuration, package, or fixture files.
Phase 6N does not perform any implementation.
Phase 6N does not speculate about Phase 6O.
