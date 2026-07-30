# MLB Report Preview Visual Presentation Plan

## 1. Phase status

Documentation-only.

No `.ts` or `.tsx` file is modified during this phase.
No test file is modified.
No CSS, Tailwind configuration, layout, route, page, component, package, fixture, golden, or script is modified.

## 2. Semantic ownership

Page:
src/app/(app)/mlb/report-preview/page.tsx
owns exactly one <main>

Renderer:
src/app/_components/mlb-report-preview/MLBReportPreviewRenderer.tsx
owns exactly one root <article>

The renderer does not render, own, or style the page <main>.
Any future style change targeting width containment or outer spacing must apply to the renderer root <article>, not the page <main>.

## 3. Current route and navigation evidence

- /dashboard includes one link to /mlb/report-preview.
- /mlb/report-preview is served by src/app/(app)/mlb/report-preview/page.tsx.
- The page renders <main> containing MLBReportPreviewRenderer.
- No client navigation is used; the route is server-rendered and static-generatable.

## 4. Current renderer evidence

File: src/app/_components/mlb-report-preview/MLBReportPreviewRenderer.tsx

Exact semantic structure:
- page <main>
- renderer root <article>
  - one <header>
    - one <h1>
    - one <p> subtitle
    - one <dl> metadata grid
  - one <section> technical metadata with its own <dl>
  - one <section> section-list with nested <section> children
  - one <section> for game cards with <h2>, <ul>, <li>, nested <article>
  - one <section> for game details with <h2>, <ul>, <li>, nested <article>
  - one <section aria-label="Warnings"> with <ul>, <li>, <strong>, message text
  - one <section> for limitations with <h2> and <ul>

Current class usage:
- renderer: no className
- page wrapper: no className

Current imports in renderer:
- only internal adapter/model utilities; no CSS, no external visual library

## 5. Current page evidence

File: src/app/(app)/mlb/report-preview/page.tsx
- synchronous server component
- no className on <main>
- passes deterministic adapterDocument to MLBReportPreviewRenderer
- no client directive, no hooks, no event handlers, no browser APIs

## 6. Existing application styling evidence

The wider application, especially the dashboard, already uses direct Tailwind utility strings in className.
Observed examples in dashboard: max-w-4xl, mx-auto, p-6, text-2xl, font-bold, mb-6, text-sm, text-gray-600, mb-8, text-lg, font-semibold, grid, grid-cols-2, gap-4, border, rounded, p-3, space-y-2.

The renderer and report-preview page are currently unstyled.

src/app/layout.tsx exists as a Next.js route layout file.

No shared visual-component library, card primitive, panel primitive, warning primitive, typography system, theme abstraction, or design-system layer was found.

Tailwind configuration: standard default theme, no custom colors or spacing scales.

Base styles in src/app/globals.css: only body font, background, and color. No component-level CSS.

## 7. Visual problem statement

Source inspection shows four concrete readability issues:

1. No width containment. The report preview spans the full viewport, producing very long lines on wide screens.
2. No outer spacing. The renderer content starts immediately at the page edge with no vertical rhythm.
3. No section spacing. Every <section> is rendered immediately adjacent to the previous section with no vertical rhythm.
4. Neutral boundaries are absent. Warnings and limitations are indistinguishable from surrounding content except for their heading text.

These issues are isolated to the renderer content. Report data, adapter structure, node order, section order, renderer content, warnings behavior, limitations placement, safety language, and server/client behavior are already correct.

## 8. Option evaluation

### Option A — Style the existing renderer directly

This adds a minimal set of Tailwind utility classes to the renderer only.

- Pros: renderer semantic structure is already correct; repository already uses Tailwind utilities directly; no reusable visual abstraction is justified because no shared system exists; renderer is the sole owner of its internal spacing needs.
- Cons: the file will need classes; tests must accommodate class presence without exact-string brittleness.

Verdict: supported by evidence. The primary readability problems are internal to the renderer.

### Option B — Style only the report-preview page wrapper

This would add classes only to src/app/(app)/mlb/report-preview/page.tsx.

- Pros: fewer source-file edits.
- Cons: renderer content would remain unstyled. Lists, definition grids, section spacing, and warning separation would still be absent.

Verdict: not preferred. The renderer lacks adequate internal visual treatment.

### Option C — Defer visual styling

This would leave the page unstyled until broader component work is done.

- Pros: no new styling risk.
- Cons: the issues are clear, localised, and solvable with existing Tailwind utilities.

Verdict: not supported. A narrow renderer-only slice is feasible.

## 9. Recommended option

Option A: style the existing renderer directly.

Evidence:
- renderer has zero className usage and zero styling
- page wrapper has zero className usage
- wider application already uses direct Tailwind utilities
- no reusable visual abstraction exists
- the identified problems are inside the renderer, not just the page wrapper

Future production file:
src/app/_components/mlb-report-preview/MLBReportPreviewRenderer.tsx

Future focused test:
tests/prospective/mlb-report-preview-next-renderer-presentation.test.tsx

Future documentation files:
README.md
docs/mlb-report-preview-visual-presentation-plan.md
docs/mlb-report-preview-next-renderer-implementation-plan.md

Maximum future scope:
1 existing production TSX file
1 new focused test file
3 documentation files

No page modification is planned.

## 10. Visual treatment map

Target file: src/app/_components/mlb-report-preview/MLBReportPreviewRenderer.tsx

| Element | Planned treatment |
| --- | --- |
| renderer root <article> | max-w-3xl mx-auto px-4 py-8 space-y-8 |
| renderer <header> | space-y-4 |
| <h1> | text-2xl font-semibold |
| top-level <section> | space-y-3 |
| section headings | text-lg font-medium |
| definition lists | space-y-1 |
| ordinary lists | list-disc pl-5 space-y-1 |
| warnings <section> | rounded border border-gray-200 bg-gray-50 p-3 |
| limitations <section> | rounded border border-gray-200 bg-gray-50 p-3 |

Width containment and outer spacing are carried by the renderer root <article>.
No class is planned for the page <main>.

Spacing rationale:
- space-y-8 on the renderer root separates major regions.
- space-y-4 in header groups title, subtitle, and metadata.
- space-y-3 between sections provides scan-friendly rhythm.
- bg-gray-50 with border-gray-200 gives neutral container separation without semantic colouring.

No analytical values are assigned colour. All colour usage is gray-* or default foreground.

## 11. Approved utility boundary

Permitted categories:
- spacing: p-*, m*, space-y-*
- width/layout: max-w-*, mx-auto
- typography: text-xs, text-sm, text-base, text-lg, text-2xl, font-medium, font-semibold, text-gray-*
- borders/shape: border, border-gray-*, rounded
- background: bg-gray-*
- list style: list-disc, pl-5

Permitted elements not to be changed:
- HTML element types remain unchanged
- section order remains unchanged
- article nesting remains unchanged
- limitations remain the last section
- warnings remain visible when present

## 12. Prohibited styling boundary

No design system.
No CSS files.
No globals.css changes.
No Tailwind configuration changes.
No CSS modules, styled-components, CSS-in-JS, inline style objects, or theme tokens.
No new package dependencies.
No helper utility for class-string construction.
No model-derived classes.
No charts, graphs, gauges, progress bars, probability bars, score cards, team-comparison visuals, rankings, leaderboards, colour-coded confidence, colour-coded research strength, winner emphasis, home/away advantage styling, predictive badges, live indicators, animated elements, interactive controls, collapsible sections, tabs, filters, tooltips, modals, icons, images, logos, team colours, or custom fonts.

Do not imply good, bad, strong team, weak team, high win chance, low win chance, positive, negative, recommended, or actionable.

## 13. Semantic preservation

Exact required invariants:
- exactly one <main> on the page
- exactly one renderer <article>
- exactly one <h1>
- existing section order unchanged
- adapter root node order unchanged
- warnings behavior unchanged
- limitations visible and limitations last
- no raw JSON
- no raw handler response
- no model-generated links
- no model-generated styles
- no model-generated event handlers

The visual slice must NOT change HTML element types merely for styling convenience.

Tests that verify the page <main> are cross-route preservation checks; that element is not renderer-owned.

## 14. Analytical safety boundary

The visual plan preserves the separation of:
- researchStrengthScore
- confidence
- matchConfidence
- dataQuality
- volatility
- modelProbability

No visual translation into win confidence, team strength, bet quality, edge, ranking, probability, or recommendation.

No betting advice, picks, predictions, winners, likely winners, should-win language, best bets, value bets, win probability, odds, sportsbook data, market prices, implied probability, edge, ROI, favorite, underdog, power ranking, team ranking, standings position, final score, actual starting pitcher, pitcher evidence, live data, current schedule data.

No source may become live.
No visual label may describe the deterministic local preview as current MLB information.

## 15. Server/client boundary

All styling is static Tailwind utility classes.

No 'use client' directive.
No useState, useEffect, useMemo, useCallback, useContext, useReducer, useRef, useRouter, usePathname, router.push, window, document., navigator, localStorage, sessionStorage, onClick, event handlers, client fetch, or dynamic imports.

Page and dashboard synchronous/server behavior unchanged.

## 16. Responsive boundary

Basic safe behavior using existing Tailwind utilities:
- max-w-3xl with horizontal padding provides safe containment
- no breakpoint-specific information hiding
- no carousels or horizontal overflow patterns
- no mobile navigation
- no claim of comprehensive viewport testing

All content remains visible at all supported widths.

## 17. Accessibility boundary

Semantic structure is preserved, so existing heading order and list semantics remain intact.
Colour is never the only way to distinguish content because spacing and typography carry the distinction.
No ARIA attributes added.
No focus management added.
No custom interactive controls added.
No WCAG compliance claimed.

## 18. Import boundary

Allowed imports in the future implementation file (src/app/_components/mlb-report-preview/MLBReportPreviewRenderer.tsx):
- existing internal adapter/model utilities
- no new visual-library imports

Prohibited imports:
- no React hooks
- no browser APIs
- no external visual component libraries

The page wrapper import boundary must remain empty of new imports.

## 19. File-boundary recommendation

Future implementation slice:
- src/app/_components/mlb-report-preview/MLBReportPreviewRenderer.tsx — existing renderer source
- tests/prospective/mlb-report-preview-next-renderer-presentation.test.tsx — new focused test file
- README.md — link addition
- docs/mlb-report-preview-visual-presentation-plan.md — this plan
- docs/mlb-report-preview-next-renderer-implementation-plan.md — narrow update

No new production component.
No modifications to both dashboard and report-preview during this slice.
No layout change.

## 20. Future test plan

Exact count: 25 tests.

Categories:
- runtime DOM preservation
- source-level class and safety checks
- repository-scope checks

Runtime DOM preservation:
1. page renders exactly one <main>
2. renderer renders exactly one <article>
3. page renders exactly one <h1>
4. adapter root node order remains unchanged
5. limitations remain visible
6. limitations remain last
7. warnings remain visible when present
8. no raw JSON is rendered
9. no raw handler response is rendered
10. no model-generated links appear
11. no event handlers appear
12. all adapter content remains visible
13. dashboard link still targets /mlb/report-preview
14. renderer does not mutate adapter document

Source-level class and safety checks:
15. selected production file contains only approved utility classes
16. no inline style
17. no CSS-module import
18. no new CSS-file import
19. no client directive
20. no hooks
21. no browser APIs
22. no colour semantics tied to analytical values
23. no prohibited analytical wording
24. production imports remain within the existing allowlist
25. no package, layout, fixture, golden, script, or dashboard modification outside the chosen slice

Tests are runtime DOM assertions plus source-level class/allowlist checks.
jsdom is used; actual visual appearance is not claimed verified.
Exact full class strings are not required; narrower allowed-class assertions are sufficient so that harmless class-order changes do not fail.

## 21. Validation requirements

Focused tests:
- dashboard navigation: 25
- page integration: 30
- renderer: 37

Full validation:
- npx vitest run tests/prospective --reporter=verbose
- npx vitest run tests/backtesting --reporter=verbose
- npx vitest run --reporter=verbose
- npx tsc --noEmit --incremental false --pretty false
- npm test
- npm run build
- git diff --check

Expected totals:
- prospective: 624
- backtesting: 699
- full: 1380

Build routes must include /dashboard and /mlb/report-preview.

Historical fixture inventory must remain:
- startDate 2024-06-01
- endDate 2024-07-21
- totalGames 29
- June 17
- July 12

Golden comparisons:
- report-preview stdout golden must match tests/prospective/fixtures/manual-schedule/valid-mlb-report-preview-local-cli-output-v1.json exactly.

## 22. Deferred work

Broader design system, visualizations, interactivity, live data ingestion, additional pages or routes, layout changes, page styling, and component abstraction are deferred. None of them are planned in this slice.

## 23. Explicit non-goals

Phase 6R does not implement any code changes. It does not add styling, tests, or documentation links. Phase 6R produces only this plan file and narrow documentation updates. Phase 6R must not style or modify the page <main>.

## 24. Phase 6S implementation status

- Option A implemented on `src/app/_components/mlb-report-preview/MLBReportPreviewRenderer.tsx`.
- Focused presentation test file: `tests/prospective/mlb-report-preview-next-renderer-presentation.test.tsx`.
- 25 focused tests.
- The page `<main>` remains unchanged.
- The renderer root `<article>` owns containment and outer spacing.
- Production change is class-only: static Tailwind utility classes added to existing JSX elements.
- Zero new production imports.
- Warnings and limitations use neutral containers.
- Limitations remain last.
- No page, dashboard, layout, CSS, Tailwind configuration, package, fixture, golden, or script changes.

## 25. Phase 6T browser acceptance plan

Phase 6T is documentation-only for the local browser-level visual acceptance boundary.
It does not implement browser automation, test code, or browser configuration.
Option B — Manual local browser acceptance procedure — is selected.
No browser was launched during Phase 6T.
No browser automation package, configuration, script, or test was added.
No source, test, package, configuration, CI, fixture, golden, or script file changed.
Phase 6T does not verify visual appearance.
It only defines a future manual local procedure.
See `docs/mlb-report-preview-browser-acceptance-plan.md`.
