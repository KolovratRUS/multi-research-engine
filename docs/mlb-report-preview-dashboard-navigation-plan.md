# MLB Report Preview Dashboard Navigation Plan

## 1. Phase status

Documentation-only.

## 2. Current route evidence

Dashboard and report-preview route structure.

Source route: `/dashboard`
Target route: `/mlb/report-preview`

Repository evidence:
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/mlb/report-preview/page.tsx`
- `src/app/layout.tsx`

Both routes share:
- `src/app/(app)` route group
- `src/app/layout.tsx` root layout

No route-specific layout files exist.

## 3. Current dashboard structure

Server/client model, imports, data loading and layout.

- `src/app/(app)/dashboard/page.tsx` is a server component.
- It exports `dynamic = 'force-dynamic'`.
- It imports from `@/server/actions`.
- It calls `getDashboardStats()` and `getRecentMultis()`.
- It renders a single `<main>` with two `<section>` blocks and a footer `<p>`.
- No `'use client'`.
- No hooks.
- No client-only modules.

## 4. Existing navigation evidence

Current links, navigation components and conventions.

- No `<nav>` elements exist in `src/app` or `src/components`.
- No `next/link` imports exist in application source.
- No shared navigation component, sidebar, menu, or routing abstraction exists.
- The only navigation path is direct URL access.

## 5. Immediate navigation boundary

One dashboard link only.

Visible copy: `MLB Report Preview`
Optional supporting copy: `View the local deterministic MLB research preview.`

## 6. Option evaluation

Option A: Add one ordinary Next.js `Link` directly to `src/app/(app)/dashboard/page.tsx`
- Evidence: Dashboard is a server component. Next.js `Link` is server-compatible.
- The dashboard already imports React and renders semantic JSX.
- The page is small (76 lines) with no existing navigation or client logic.
- No prior `next/link` usage exists anywhere in `src/app`.
- Adding one import and one anchor element is the smallest possible slice.

Option B: Create one tiny server-compatible dashboard navigation component and render it from the dashboard.
- Evidence: Not justified by dashboard size or responsibilities.
- A component boundary is unnecessary for a single anchor element.

Option C: Defer dashboard navigation because the existing dashboard structure makes even one link unsafe or misleading.
- Evidence: The routes are independent and both server-compatible. The dashboard already imports from `@/server/actions`; adding one `Link` does not widen the import boundary. Safe.

Recommended option: **Option A**

## 7. Recommended implementation

Exact chosen option: Option A.

Future file-count decision:
- modify: `src/app/(app)/dashboard/page.tsx`
- add: `tests/prospective/mlb-report-preview-dashboard-navigation.test.tsx`
- doc: `README.md`
- doc: `docs/mlb-report-preview-dashboard-navigation-plan.md`
- update: `docs/mlb-report-preview-next-page-integration-plan.md`

No new component or route file.

## 8. Link copy

Visible text: `MLB Report Preview`

Optional supporting text: `View the local deterministic MLB research preview.`

Supporting text is planned only if placement requires it to prevent the route from being misleading.

## 9. Placement

Exact dashboard position: after the heading and before the "Research Status" section.

This is the smallest visible placement that does not disrupt existing dashboard content.

## 10. Server/client boundary

The dashboard remains a server component.

No `'use client'`.
No `useState`.
No `useEffect`.
No `useRouter`.
No `usePathname`.
No `router.push`.
No `window.location`.
No browser storage.
No client fetch.

Prefer an ordinary Next.js `Link`.

## 11. Styling boundary

Existing-class reuse: reuse simple existing text utility classes already present in the dashboard (`text-sm`, `text-gray-600`).

No new CSS files.
No global CSS changes.
No Tailwind configuration changes.
No design tokens.
No reusable button systems.
No card systems.
No navigation design system.
No animation.
No responsive navigation redesign.
No colour semantics.

## 12. Accessibility boundary

Semantic link behavior:
- meaningful visible text
- valid `href`
- no click-only div or button
- no `target="_blank"`
- no hidden link text
- no icon-only control
- no duplicated page heading
- no auto-focus
- no modal or disclosure

## 13. Import boundary

Exact allowed import: `Link from 'next/link'`

Prohibited imports:
- report-preview helper
- adapter document
- renderer
- router hooks
- route handler
- API contract
- CLI modules
- fixtures
- goldens
- scripts
- browser modules

The dashboard must link to the page, not construct or render the report preview itself.

## 14. File-boundary recommendation

Exact future implementation files:
- `src/app/(app)/dashboard/page.tsx`
- `tests/prospective/mlb-report-preview-dashboard-navigation.test.tsx`

No new component.

## 15. Future test plan

Exact test categories and count: 25 tests.

Runtime RTL tests (14):
1. dashboard renders a link to `/mlb/report-preview`
2. link text is exactly `MLB Report Preview`
3. exactly one report-preview link exists
4. link uses a real anchor through Next.js Link
5. link does not use `target="_blank"`
6. link has no click handler
7. target page still renders one `<main>`
8. target page still renders one renderer `<article>`
9. target page still has one `<h1>`
10. limitations remain visible
11. limitations remain last
12. dashboard's existing content remains present
13. deterministic page helper remains unchanged
14. link does not navigate using browser APIs

Narrow source/scope checks (11):
15. dashboard remains server-compatible
16. dashboard contains no `'use client'`
17. dashboard contains no hooks
18. dashboard contains no router navigation calls
19. dashboard contains no browser APIs
20. dashboard contains no new fetch caused by navigation slice
21. no report-preview page modification
22. no layout modification
23. no CSS modification
24. no package modification
25. no live-data or betting wording in link text

## 16. Validation requirements

Focused/full/build/golden/scope checks:

- `npm run inventory:mlb-fixtures`
- `npm run prospective:mlb:dry-run-check`
- `npx vitest run tests/prospective/mlb-report-preview-next-page.test.tsx --reporter=verbose`
- `npx vitest run tests/prospective/mlb-report-preview-next-renderer.test.tsx --reporter=verbose`
- `npx vitest run tests/prospective --reporter=verbose`
- `npx vitest run tests/backtesting --reporter=verbose`
- `npx vitest run --reporter=verbose`
- `npx tsc --noEmit --incremental false --pretty false`
- `npm test`
- `npm run build`
- `git diff --check`

All seven stdout golden comparisons must remain MATCH.

## 17. Deferred work

Global navigation, styling systems, mobile menu, back links and live data.

## 18. Explicit non-goals

No implementation in Phase 6P.
