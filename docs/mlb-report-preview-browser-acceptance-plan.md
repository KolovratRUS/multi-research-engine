# MLB Report Preview Browser Acceptance Plan

## 1. Phase status

Documentation-only.

No `.ts`, `.tsx`, `.js`, `.json`, `.css`, YAML, package, config, fixture, golden, or script file is changed during this phase.
No source code or test is modified.
No browser automation is implemented.
No browser is launched.

Phase 6T does not verify visual appearance.
Phase 6T only documents how a later manual local procedure could verify it.

## 2. Locked baseline

Commit:
`1afb93bc72f6bc7f0575a91faf2c9e47ff49a8d5`

Routes:
- `/dashboard`
- `/mlb/report-preview`

Current focused test counts (locked baseline):
- dashboard navigation: 25
- renderer presentation: 25
- renderer: 37
- page integration: 30
- full Vitest suite: 1405 tests across 71 test files

## 3. Current browser-test infrastructure evidence

Inspected files:
- `package.json`
- `package-lock.json`
- `next.config.js`
- `tsconfig.json`
- `vitest.config.ts`
- `tests/e2e`
- `.github`

Direct project dependencies:
- No direct browser automation or end-to-end test-runner dependency is present.
- `package.json` dependencies: `next`, `react`, `react-dom`, `@prisma/client`, `zod`.
- `package.json` devDependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `tsx`, `typescript`, `tailwindcss`, `prisma`, ESLint, PostCSS, Autoprefixer.

Lockfile evidence:
- `package-lock.json:5865` contains a nested resolved entry for `@playwright/test` (`^1.41.2`) inside a resolved lockfile bundle.
- `package-lock.json:5874` contains the resolved `@playwright/test` package object.
- That entry is not a direct dependency of this repository.
- No repository-owned Playwright binary, command, configuration, or test exists.
- A lockfile mention alone is not sufficient to claim approved browser-test infrastructure.

Scripts:
- No `e2e`, `browser:test`, `test:browser`, `playwright`, `cypress`, `puppeteer`, `selenium`, or `webdriver` script exists in `package.json`.
- Existing test scripts use Vitest only (`test`, `test:watch`).

Configuration:
- `vitest.config.ts` configures jsdom-based unit testing only.
- `next.config.js`, `tsconfig.json`, and `tailwind.config.ts` contain no browser-test runner configuration.
- No `playwright.config.*`, `cypress.config.*`, `puppeteer.config.*`, or `webdriverio.conf.*` exists.

Directories:
- `tests/e2e` exists and contains `tests/e2e/phase0-flow.test.ts`. It does not contain Playwright, Cypress, Puppeteer, Selenium, WebdriverIO, or browser-test files.
- No `playwright`, `cypress`, `puppeteer`, `selenium`, `webdriver`, `browser`, or `integration` directories exist under project-owned test paths.

CI:
- `.github` does not exist.
- No GitHub Actions, CI workflow, or automation referencing a browser-test runner was found.

Evidence conclusion:
- No repository-owned browser automation package, configuration, command, directory, or CI exists.

## 4. Existing local-server evidence

Repository-owned startup command evidence:
- `package.json` defines `"dev": "next dev"`.
- README documents running `npm run dev` in the project setup/run section.
- `next.config.js` exists and is standard Next.js configuration.
- `tsconfig.json` defines `@/* -> ./src/*`.

Implicit local URL evidence from Next.js default behavior:
- `next dev` defaults to `http://localhost:3000` when the port is available.
- The repository does not hardcode or document an alternate local server port.

No repository-owned browser acceptance script, PID manager, or readiness probe exists.

## 5. Current jsdom coverage

Current focused suites and what they verify:

Dashboard navigation (`tests/prospective/mlb-report-preview-dashboard-navigation.test.tsx`, 25 tests):
- dashboard renders without throwing
- link to `/mlb/report-preview` exists with exact text and anchor semantics
- link appears in expected document position
- target page renders exactly one `<main>`, one renderer `<article>`, one `<h1>`
- Limitations heading is visible and last
- dashboard source contains no `'use client'`, hooks, router calls, browser APIs, click handlers
- link copy contains no prohibited language
- dashboard imports remain within allowlist

Page integration (`tests/prospective/mlb-report-preview-next-page.test.tsx`, 30 tests):
- local helper returns valid adapter document and is deterministic
- page renders without throwing
- exactly one `<main>`, one renderer `<article>`, one `<h1>`
- exact adapter root node order preserved
- limitations visible and last
- warnings match deterministic sample
- pipeline failure wrapped in safe fixed error
- page source contains no `'use client'`, hooks, async, fetch, browser APIs, storage
- helper source contains no fixture, golden, CLI, route-handler, wall-clock, randomness, or environment access
- no raw JSON or raw handler response rendered
- no prohibited analytical language
- production imports remain within allowlists

Renderer (`tests/prospective/mlb-report-preview-next-renderer.test.tsx`, 37 tests):
- renders valid adapter document
- rejects malformed input
- rejects invalid lower-layer shapes
- exact root node order
- exact header text
- technical metadata labels and null generated-at copy
- section body escaping and list rendering
- card/detail order, keys, field preservation
- warnings order, empty omission
- limitations visible and last
- no hidden limitations
- no mutation of adapter document

Renderer presentation (`tests/prospective/mlb-report-preview-next-renderer-presentation.test.tsx`, 25 tests):
- page/renderer semantic structure preserved
- adapter root node order preserved
- limitations visible and last
- warnings remain visible when present
- no raw JSON or handler response
- no model links or event handler attributes
- renderer source contains no inline style, client directive, hooks, browser APIs, color semantics, prohibited wording
- renderer production imports remain within pre-Phase-6S allowlist
- all renderer `className` tokens belong to Phase 6S utility allowlist

These suites verify structure, semantics, source-level class boundaries, and analytical safety boundaries under jsdom. They do not prove rendered visual appearance in a real browser.

## 6. Browser-level coverage gap

What jsdom and build validation do not prove:
- actual rendered visual appearance in Chromium/Firefox/Safari
- real layout with Next.js server rendering hydration
- viewport-specific overflow, clipping, or readability
- font metrics, text wrapping, or line height behavior
- native form controls or browser scroll behavior
- operating-system font rendering differences
- network-request boundaries in a live server context

The current suite is sufficient for structural and semantic preservation, but not for presentation-in-browser acceptance.

## 7. Option A evaluation

Option A — Existing automated browser infrastructure.

Required criteria:
1. a browser automation test runner is already a direct project dependency — False. No direct dependency found.
2. repository-owned configuration exists — False. No Playwright/Cypress/Puppeteer/Selenium/WebdriverIO config found.
3. a repository-owned test command exists — False. No `e2e`, `browser:test`, or similar script found.
4. at least one existing repository browser or end-to-end test demonstrates the convention — False. No browser or E2E tests exist.
5. no package, lockfile, framework configuration, or CI expansion would be required for one narrow smoke test — False. Any browser runner would require new packages and configuration.

Notwithstanding a transitive `@playwright/test` mention in `package-lock.json`, Option A is not satisfied. Do not infer infrastructure from a transitive dependency alone.

Verdict: Option A is not available.

## 8. Option B evaluation

Option B — Manual local browser acceptance procedure.

Conditions:
- no approved automated browser infrastructure exists — True.
- introducing a runner would require packages or configuration — True.
- a manual local acceptance checklist is sufficient for the current narrow visual slice — True.

This option plans a local-only, deterministic, read-only manual procedure. It does not add packages, scripts, fixtures, goldens, routes, source files, or test files.

Permitted future content:
- exact server-start command
- exact local URLs
- desktop and small-screen viewport dimensions
- visible and semantic checks
- overflow checks
- navigation check
- shutdown procedure
- simple textual acceptance record

The procedure remains deterministic and local. No screenshots are required unless existing repository policy later supports them; no image-diff baselines are required.

Verdict: Option B is supported.

## 9. Option C evaluation

Option C — Defer browser acceptance work.

Conditions for deferral:
- even a manual procedure cannot be made deterministic or safe — False.
- the route cannot be exercised locally without unsupported infrastructure — False. The page is a standard Next.js App Router page.
- the existing visual slice is not mature enough for browser acceptance — Not a blocker. The jsdom slice is mature; gap is real browser rendering only.
- another prerequisite must be planned first — False.

Not choosing deferral simply to avoid a decision.

Verdict: Option C is not required.

## 10. Recommended option

Recommended option: Option B — Manual local browser acceptance procedure.

Evidence:
- repository contains zero direct browser automation packages
- repository contains zero browser-test configuration
- repository contains zero browser-test scripts
- repository contains zero browser or E2E test framework files in project-owned paths
- `.github` does not exist
- `tests/e2e` exists but contains no Playwright, Cypress, Puppeteer, Selenium, WebdriverIO, or browser-test files
- the slice under test is a deterministic local Next.js page served by existing `npm run dev`
- a manual procedure can remain local-only, deterministic, and read-only without adding dependencies or changing source, tests, packages, or configuration.

## 11. Route and navigation acceptance map

Steps:
1. Start local server with `npm run dev`.
2. Open browser to `http://127.0.0.1:3000/dashboard`.
3. Verify "MLB Report Preview" link is visible.
4. Click the link.
5. Verify browser navigates to `http://127.0.0.1:3000/mlb/report-preview`.
6. Verify `/mlb/report-preview` renders the report preview.
7. Shut down the local server.

Determinism boundary:
- The same local deterministic adapter document is used on every load.
- No wall-clock-dependent or network-dependent content is generated by the page.
- No browser cache or cookie state is required.

## 12. Viewport boundary

Permitted viewports:
- Desktop: 1440 × 900
- Small screen: 390 × 844

Purpose:
- basic overflow and readability inspection only

Boundaries:
- no breakpoint-specific information hiding
- no mobile-specific analytical behavior
- no content hidden or changed by viewport
- no claim of comprehensive responsive coverage

## 13. Required acceptance checks

Exact objective checks for `/mlb/report-preview`:

1. Route loads successfully without browser console errors.
2. Dashboard link is visible on `/dashboard` and navigates to `/mlb/report-preview`.
3. One page `<main>` is present.
4. One renderer `<article>` is present.
5. One `<h1>` is present.
6. Warnings section is visible when present.
7. Limitations section is visible and is the last section.
8. Headings remain visibly separated by spacing.
9. Neutral warning/limitation containers render.
10. Content is not horizontally overflowing at 1440 × 900.
11. Content is not horizontally overflowing at 390 × 844.
12. Main content remains readable at both viewports.
13. All adapter content remains present; no content is clipped out of view.

Exact objective checks for `/dashboard`:
14. "MLB Report Preview" link is visible.
15. Link href is `/mlb/report-preview`.
16. Link opens in the same tab (`target` not set to `_blank`).

Prohibited checks:
- no subjective grading
- no pixel-perfect screenshot comparison
- no color-based analytical interpretation
- no WCAG compliance claim
- no comprehensive responsive coverage
- no live API call validation
- no schedule ingestion validation
- no predictive output validation

## 14. Process lifecycle

Local server handling must remain local and scoped.

1. Start:
   - `npm run dev`
2. Readiness:
   - wait for Next.js compile-ready log line or successful `http://127.0.0.1:3000` response
3. Port:
   - fixed port 3000
4. Port collision:
   - stop and report collision; do not select a random port
   - manual remediation required before acceptance
5. Navigation:
   - use direct URL or same-tab anchor click only
6. Shutdown:
   - send `SIGINT` to the specific `next dev` process started for this acceptance run
   - do not use `killall node`, `pkill node`, or broad process termination
7. Orphan avoidance:
   - fix the PID or process group at startup
   - shutdown must target that specific process only
8. Temporary paths:
   - `/tmp/phase6t-browser-acceptance` may be used for textual evidence files
   - no other system-wide configuration or global state
9. Cleanup:
   - remove `/tmp/phase6t-browser-acceptance` after each run
   - leave no running `next dev` processes

## 15. Local-only and network boundary

The future manual acceptance must remain:
- local-only
- deterministic
- read-only
- odds-blind
- non-predictive
- non-interactive beyond route navigation

Permitted outbound network:
- local `127.0.0.1:3000` request for readiness and page rendering only
- no external URL navigation
- no MLB Stats API calls
- no weather or standings ingestion
- no sportsbook or odds data
- no external stylesheet or script fetch beyond Next.js dev-server behavior

Page behavior boundary:
- `/mlb/report-preview` continues using the deterministic local document
- no live data, schedule ingestion, roster ingestion, or standings ingestion
- no authentication, form submission, or data write

## 16. Evidence-recording boundary

Planned textual acceptance record fields:
- date
- baseline commit
- server command
- route
- viewport
- check name
- PASS/FAIL
- short observation
- cleanup status

Permitted local file storage:
- `/tmp/phase6t-browser-acceptance/*.txt` or `.md` only
- text/plain or markdown only

Do not store:
- cookies
- tokens
- credentials
- personal information
- browser profiles
- HAR files
- live network responses
- external page content
- committed binary screenshots

Storage lifecycle:
- temporary textual checklist is created under `/tmp`
- its results are copied into the Hermes final report
- temporary files are then deleted
- no browser profile, cookie, HAR, credential, or live response is retained

## 17. Semantic and analytical safety

The future browser acceptance must not interpret or score analytical fields.

Preserve separation of:
- `researchStrengthScore`
- `confidence`
- `matchConfidence`
- `dataQuality`
- `volatility`
- `modelProbability`

No visual acceptance may claim:
- model quality
- predictive performance
- betting value
- win probability
- implied probability
- team strength
- recommendation strength

The procedure must treat the page as a deterministic preview document only.

## 18. Accessibility boundary

The future manual acceptance may inspect semantic structure only:
- one `<main>` exists
- one renderer `<article>` exists
- headings remain in logical order
- warnings are visible as text, not color alone
- limitations are visible and not hidden

Do not plan to claim:
- WCAG compliance
- full keyboard traversal
- screen-reader verification
- focus management
- contrast ratios

## 19. Future file boundary

If Phase 6T is approved and later implemented, the maximum future file set is documentation-only:

- `README.md`
- `docs/mlb-report-preview-browser-acceptance-plan.md`
- `docs/mlb-report-preview-visual-presentation-plan.md`

Maximum future scope:
- 3 documentation files
- 0 source files
- 0 test files
- 0 package changes
- 0 configuration changes
- 0 fixture changes
- 0 golden changes
- 0 CSS changes
- 0 route changes

No implementation is planned in this phase.

## 20. Future validation

If a later phase implements Option B, required validation is:

Focused tests:
- `npx vitest run tests/prospective/mlb-report-preview-next-renderer-presentation.test.tsx --reporter=verbose`
- `npx vitest run tests/prospective/mlb-report-preview-next-renderer.test.tsx --reporter=verbose`
- `npx vitest run tests/prospective/mlb-report-preview-next-page.test.tsx --reporter=verbose`
- `npx vitest run tests/prospective/mlb-report-preview-dashboard-navigation.test.tsx --reporter=verbose`

Full validation:
- `npx vitest run tests/prospective --reporter=verbose`
- `npx vitest run tests/backtesting --reporter=verbose`
- `npx vitest run --reporter=verbose`
- `npx tsc --noEmit --incremental false --pretty false`
- `npm test`
- `npm run build`
- `git diff --check`

Expected totals:
- prospective: 649
- backtesting: 699
- full: 1405
- npm test: 1405
- test files: 71

Build routes must include `/dashboard` and `/mlb/report-preview`.

Inventory guards must remain unchanged:
- `npm run inventory:mlb-fixtures`
- `npm run prospective:mlb:dry-run-check`

Golden comparisons (preserved unchanged from earlier phases):
- 5B
- 5E
- 5H
- 5K
- 5N
- 5T
- 5Z

## 21. Deferred work

Explicitly deferred from browser acceptance planning:
- broader E2E coverage
- screenshot baseline capture
- visual regression diffing
- cross-browser matrix
- accessibility auditing
- live API coverage
- schedule ingestion validation
- predictive output validation

These remain out of scope until explicitly planned in a later phase with approved infrastructure.

## 22. Explicit non-goals

Phase 6T does not:
- implement browser automation
- launch or modify a browser
- add Playwright, Cypress, Puppeteer, Selenium, WebdriverIO, or another package
- change source code or tests
- change package files, configuration, scripts, fixtures, goldens, CSS, routes, pages, components, layouts, middleware, or CI
- claim a real browser was opened
- claim a viewport check was performed
- claim overflow was tested
- claim browser infrastructure exists unless repository evidence proves it
- claim browser infrastructure is absent without inspecting packages, configuration, scripts, tests, and CI

## 23. Phase 6U manual acceptance result

- Date: 2026-07-30.
- Command: npm run dev -- --hostname 127.0.0.1 --port 3000
- Isolated temporary PostgreSQL: `/tmp/phase6u-browser-acceptance`, port 5433.
- Existing port 5432 service: untouched.
- Next.js server shutdown: completed after acceptance.
- Temporary file cleanup: completed.
- Owner-assisted Google Chrome acceptance.
- Chrome DevTools Responsive mode.
- Desktop viewport 1440 × 900 — dashboard PASS; report preview PASS.
- Small-screen viewport 390 × 844 — dashboard PASS; report preview PASS.
- No red application-console errors at either viewport.
- No horizontal overflow observed at either viewport.
- Limitations remained final at both viewports.
- No source, test, package, Prisma schema, migration, configuration, CI, fixture, golden, or script changes.
- No external-network data was used.
