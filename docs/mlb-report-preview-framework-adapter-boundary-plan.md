# MLB Report Preview Framework Adapter Boundary Plan

## 1. Phase status

Phase 6J is documentation-only.
It inspects the repository for an established application/browser framework and plans a future
framework adapter boundary for consuming only `MLBReportPreviewUIPresentation`.

Phase 6J adds no:
- browser UI;
- framework components;
- HTML;
- CSS;
- JSX;
- TSX;
- routes;
- pages;
- server handlers;
- API routes;
- client fetching;
- network calls;
- browser storage;
- framework dependencies;
- CLI behavior;
- fixtures;
- goldens;
- historical fixtures;
- package changes;
- generated artifacts.

## 2. Repository framework inspection

| path | evidence | active/inactive | implication |
| --- | --- | --- | --- |
| `package.json` | `next`, `react`, `react-dom` in `dependencies`; `eslint-config-next`, `tailwindcss`, `@types/react`, `@types/react-dom` in `devDependencies` | active | Next.js + React are production dependencies and drive build/dev scripts. |
| `next.config.js` | Standard Next.js config with `reactStrictMode: true` | active | Confirms Next.js application boundary. |
| `src/app/layout.tsx` | Next.js App Router root layout importing `next/font/google`, default export with `children: React.ReactNode`, `<html lang="en">` root | active | Established application entry boundary; must not be duplicated by a second framework. |
| `src/app/(app)/dashboard/page.tsx` | Next.js App Router page with `'use client'` boundary, async server component, `className` styling, `getDashboardStats`, `getRecentMultis` | active | Active page boundary under the existing Next.js app. |
| `src/app/globals.css` | Global stylesheet imported by the root layout | active | Active global style boundary. |
| `.next/` | Next.js build output directory present on disk | active | Repo is used for Next.js builds during project development. |
| `tsconfig.json` | `"jsx": "preserve"`, includes `next-env.d.ts`, `**/*.tsx`, `.next/types/**/*.ts` | active | TypeScript and Next.js types are first-class configuration. |
| `tailwind.config.ts` | Content paths include `src/pages/**/*.{js,ts,jsx,tsx,mdx}` and `src/app/**/*.{js,ts,jsx,tsx,mdx}` | active | Tailwind CSS is wired to the Next.js app surface areas. |
| `src/server/routes.ts` | `NextResponse` from `next/server` used for server-side HTTP responses | active | Active Next.js server route boundary. |
| `src/lib/backtesting/windows.ts` | `window` variable names used for plain dateRange objects | inactive | Not browser runtime; no browser framework dependency. |
| `package.json` `scripts` | `dev`, `build`, `start` mapped to `next dev`, `next build`, `next start` | active | Standard Next.js lifecycle scripts. |

### Outcome

Outcome A applies: the repository already contains a clear, active, established application framework
(Next.js 14 App Router) and application entry boundary.

Rule: add no second framework. The future adapter must integrate with the existing Next.js app boundary only.

## 3. Existing safe pipeline

Future-safe flow:

```
MLBReportPreviewApiHandlerSuccess
→ MLBReportPreviewUIViewModel
→ MLBReportPreviewUIPresentation
→ future framework adapter
→ future visual rendering
```

Clarifications:
- The Phase 6I presentation contract is the final analytical-to-presentation boundary.
- A future framework adapter begins only after `buildMLBReportPreviewUIPresentation` has produced a
  validated presentation object.
- The adapter must not re-enter analytical code or revisit raw handler/view-model data.

## 4. Adapter input contract

Allowed input only:

```
MLBReportPreviewUIPresentation
```

The adapter must not receive:
- raw handler response;
- handler success object;
- `apiResponse`;
- raw `reportPreview`;
- raw view model unless explicitly at the presentation-builder boundary;
- research package;
- historical fixtures;
- CLI stdout;
- filesystem paths;
- live responses;
- network responses.

### Assertion boundary

Preferred approach:
- assertion at the adapter entry boundary using `assertMLBReportPreviewUIPresentation` or equivalent;
- no repair;
- no validation bypass;
- neutral failure handling is defined outside analytical rendering.

Rationale: keeps the adapter honest; the presentation contract is already validated upstream, so the
adapter only needs to defensively confirm the contract it received before mapping to visual nodes.

## 5. Adapter output boundary

Conceptual framework-neutral terminology:
- adapter view nodes;
- semantic render instructions;
- framework-specific element tree in a later implementation;
- no HTML-string generation in the first adapter slice.

Thinnest possible adapter:
- accepts a validated presentation;
- produces ordered semantic nodes;
- preserves exact text;
- preserves visible limitations;
- does not invent structure or embellish labels.

## 6. Responsibility separation

| layer | input | responsibility | prohibited responsibilities | validation owner | render owner |
| --- | --- | --- | --- | --- | --- |
| API handler | route/request | Parse request, call domain logic, wrap success/error | Analytical interpretation, sorting, ranking, pattern invention | handler + API contract | not applicable |
| UI view-model builder | handler success | Choose safe labels, omit prohibited fields, preserve order | Adapter behavior, visual framing, framework binding | view-model assertion | not applicable |
| UI presentation builder | validated view model | Produce plain-data presentation tree with empty-state fields | React/Next integration, HTML, mutation, I/O | presentation assertion | not applicable |
| Future framework adapter | validated presentation | Map presentation to adapter view nodes / semantic render instructions | Analytical transformation, fallback to raw data, framework selection if absent | adapter assertion | future visual renderer |
| Future page/route integration | adapter view nodes | Mount adapter output into existing Next.js app boundary | Presentation repair, data fetching, sorting, prediction copy | integration test | framework rendering |

## 7. Root adapter contract

The conceptual root adapter must:
- accept one valid presentation;
- preserve child order;
- preserve exact text;
- preserve visible limitations;
- perform no fetching;
- perform no file reads;
- perform no CLI execution;
- perform no current-time lookup;
- perform no random-ID generation;
- perform no analytical transformation;
- perform no sorting;
- perform no ranking;
- perform no mutation;
- produce no raw debug payload on failure.

## 8. Presentation-node mapping

| presentation node | input subset | semantic rendering responsibility | omit when empty | order behavior | stable key recommendation | prohibited embellishments |
| --- | --- | --- | --- | --- | --- | --- |
| header | title, subtitle, generatedAtLabel, sourceLabel | Render as document/metadata header | never | preserved from input | title + sourceLabel | No timestamp invention |
| metadata | deterministic, source, presentationName, presentationVersion | Render as technical metadata only | never | preserved from input | presentationName | No framework-element decoration |
| sections | heading, body array, emptyState | Render section heading and body lines; display emptyState text separately when body is empty | no synthetic section | preserved from input | heading | No analytical summary injection |
| game-card list | gameCards array, emptyState | Render list container | if empty, render emptyState instead of synthetic card | preserved from input | gameId value | No fabricated card |
| game card | currentTimeLabel, opponentLabel, locationLabel, scheduledStartTimeLabel, researchStrengthScoreLabel, confidenceLabel, dataQualityLabel, supplementaryLines, warnings | Render safe labels | no synthetic card | preserved from input | gameId | No final score, no state, no pitcher evidence |
| game-detail list | gameDetails array, emptyState | Render list container | if empty, render emptyState instead of synthetic detail | preserved from input | gameId value | No fabricated detail |
| game detail | gameId, heading, officialDateLabel, scheduledStartTimeLabel, researchStrengthScoreLabel, confidenceLabel, dataQualityLabel, supplementaryLines, warnings | Render safe labels | no synthetic detail | preserved from input | gameId | No final score, no state, no pitcher evidence |
| warnings | warnings array, emptyState | Render notice list | if empty and emptyState is null, render no warning-list block | preserved from input | warning code | No fabricated warning |
| limitations | heading + body | Render exact `Limitations` heading and body | never omit | preserved from input | heading | No collapse, tabs, modal, suppression allowed |

## 9. Empty-state mapping

Exact behavior:
- `sections.body: []` → render section heading and body-empty state text; do not fabricate body lines.
- `sections.emptyState` → display as separate empty-state copy associated with the section.
- `gameCards: []` + non-null `emptyState` → render empty-state copy; do not fabricate a game card.
- `gameDetails: []` + non-null `emptyState` → render empty-state copy; do not fabricate a game detail.
- `warnings: []` + `emptyState: null` → render no warning-list block at all.
- `warnings: []` + non-null `emptyState` → render warning-area empty state copy only if explicitly added in a later implementation; current Phase 6I presentation uses `emptyState: null` for warnings.

Rules:
- empty arrays remain empty arrays;
- empty-state text is displayed separately;
- no synthetic card/detail/warning records;
- no loading or retry copy;
- no live-data promise;
- warnings with `emptyState: null` produce no warning-list block.

## 10. Limitations visibility

Requirements:
- exact heading `Limitations`;
- normal document flow;
- always visible;
- not hidden by collapse, tabs, modal, tooltip, hover, or optional interaction;
- no framework adapter may suppress the limitations node;
- the adapter must treat `Limitations` as a required visible section.

## 11. Plain-text and escaping contract

Future adapter behavior:
- all model text rendered as text;
- no HTML interpretation;
- no markdown execution;
- no `dangerouslySetInnerHTML`;
- no direct `innerHTML`;
- no generated links from model text;
- no event handlers from model text;
- no raw JSON debug view;
- no object-inspection UI.

The adapter must treat all presentation text as user-visible safe strings produced by the validated
presentation builder.

## 12. Framework evidence outcome

Selected outcome: **Outcome A** — Next.js App Router is the established framework.

Concrete evidence:
- `next.config.js` at repo root;
- `src/app/layout.tsx` root layout;
- `src/app/(app)/dashboard/page.tsx` active page;
- `src/app/globals.css`;
- `.next/` build directory;
- `package.json` production dependencies `next`, `react`, `react-dom`;
- `tailwind.config.ts` configured for `src/app` and `src/pages`;
- `tsconfig.json` configured for Next.js and JSX.

Future adapter location guidance:
- the future adapter should be introduced under `src/prospective/mlb/report-preview-next-adapter.ts` or an analogous narrow path inside the existing `src/prospective/mlb/` module;
- page/route integration should be added inside `src/app/` as a new segment under the existing Next.js App Router boundary;
- a second framework must not be introduced.

## 13. File-boundary recommendation

Recommended future file locations without creating them:

| conceptual boundary | recommended repo location | rationale |
| --- | --- | --- |
| framework-neutral adapter contract | `src/prospective/mlb/report-preview-adapter.ts` | Keeps adapter contract close to existing Phase 6I presentation builder. |
| Next.js-specific adapter implementation | `src/prospective/mlb/report-preview-next-adapter.ts` | Separates framework specifics from the neutral contract. |
| page/route integration | `src/app/(app)/dashboard/report-preview/...` or a new sibling route under `src/app/` | Uses existing Next.js App Router boundary. |
| styles | `src/app/globals.css` or a scoped CSS module adjacent to the new route | Keeps styles within the established app style boundary. |

Do not create these files in Phase 6J.

## 14. Failure handling

Future safe behavior:
- invalid presentation input → reject at adapter assertion; do not render.
- missing root node → reject at adapter assertion; do not render.
- malformed adapter invocation → reject early; do not fall back to raw handler data.
- framework rendering failure → show preserved plain-text limitations/error copy only; no debug payload; no retry against live data.

Prohibited failure behavior:
- no fallback to raw handler data;
- no debug payload exposure;
- no retry against live data;
- no silent validation repair;
- no betting or prediction copy;
- no analytical reinterpretation.

## 15. Determinism and immutability

Future adapter tests must prove:
- repeated adaptation is deeply equal;
- input presentation is not mutated;
- order is preserved;
- no `Date.now`;
- no `Math.random`;
- no unstable IDs;
- no network;
- no filesystem;
- no child process;
- no browser storage;
- no analytics or telemetry.

The Phase 6I builder is already pure and returns fresh plain objects. The adapter must preserve that guarantee.

## 16. Accessibility planning boundary

Plan semantic responsibilities that do not require framework selection:
- logical heading order;
- list semantics;
- readable metadata labels;
- warnings identifiable as notices;
- limitations heading visible;
- scheduled date/time text understandable;
- no meaning conveyed solely by colour.

No accessibility code is implemented in this phase.

## 17. Future test plan

Exact future tests to implement in a later phase:
- accepts valid presentation;
- rejects view model directly;
- rejects handler response;
- rejects raw report preview;
- exact text preservation;
- limitations visible;
- order preservation;
- empty-state behavior;
- no fabricated records;
- no unsafe adapter-owned phrases;
- no raw fields;
- no HTML injection;
- no framework-element data in framework-neutral adapter output;
- no current time;
- no randomness;
- no fetch;
- no filesystem;
- no child process;
- no mutation;
- deterministic repeated output.

If Outcome A permits a framework-specific test later, clearly separate it from the first adapter-contract test slice.

## 18. Acceptance criteria for a later implementation phase

Include:
- consumes `MLBReportPreviewUIPresentation` only;
- defensively asserts presentation;
- no raw view model or handler input;
- no analytical transformation;
- no framework addition unless already established (Next.js only);
- no package changes unless separately approved;
- no network/file/CLI behavior;
- exact safe text;
- visible limitations;
- empty arrays preserved;
- no fabricated records;
- deterministic;
- input not mutated;
- focused tests;
- prospective suite;
- backtesting suite;
- full Vitest;
- TypeScript;
- `npm test`;
- build;
- seven stdout golden comparisons;
- `git diff --check`;
- safety searches.

## 19. Deferred work

Explicitly defer:
- actual adapter implementation;
- browser UI;
- component implementation;
- routes/pages beyond the existing Next.js boundary;
- CSS;
- visual design;
- responsive design;
- client fetching;
- live data;
- authentication;
- persistence;
- browser storage;
- analytics;
- telemetry;
- filtering;
- sorting;
- searching;
- exporting;
- printing;
- deployment.

## 20. Explicit non-goals

Phase 6J adds no:
- source code;
- tests;
- framework;
- JSX/TSX;
- HTML;
- CSS;
- routes;
- page integration;
- server;
- network;
- CLI;
- fixture;
- golden;
- historical fixture;
- package change;
- generated artifact;
- prediction;
- betting advice;
- live source.
