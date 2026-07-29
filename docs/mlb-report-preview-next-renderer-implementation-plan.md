# MLB Report Preview Next.js Renderer Implementation Plan

## 1. Phase status

Documentation only. No code, components, routes, pages, styles, tests, fixtures, or package changes are introduced in this phase.

Immediate future implementation scope:
- Production files added: exactly 1 TSX file.
- Test files added: exactly 1 TSX test file.
- Package changes: 0.
- Route/page changes: 0.
- CSS changes: 0.

## 2. Repository renderer evidence

Inspected files:

- `src/app/layout.tsx` — Next.js root layout using the `Inter` font from `next/font/google`; standard `<html>` + `<body className={...}>` + `{children}` structure.
- `src/app/(app)/dashboard/page.tsx` — App Router page using `async` server components with `className` Tailwind utilities.
- `src/app/globals.css` — Tailwind base/components/utilities directives; no custom component styles.
- `src/server/routes.ts` — Route handlers using `NextResponse.json`.
- `next.config.js` — `reactStrictMode: true`; no special build flags.
- `tailwind.config.ts` — content paths include `./src/app/**/*`; no plugin extensions.
- `tsconfig.json` — `strict: true`, `jsx: preserve`, `moduleResolution: bundler`, path alias `@/* -> ./src/*`.
- `package.json` — dependencies include `next ^14.2.18`, `react ^18.3.1`, `react-dom ^18.3.1`; devDependencies include `@testing-library/react ^16.3.0`, `@testing-library/jest-dom ^6.6.3`, `vitest ^2.1.8`.

Conventions observed:

- No `src/components` directory exists.
- Existing app code uses server components only; no `'use client'`, no hooks, no browser APIs, no fetching in pages.
- React elements are composed inline in pages, not extracted into component files.
- Tailwind utility classes are the established styling mechanism.
- Path alias `@/` resolves to `./src/`.

## 3. Existing safe pipeline

Current ordered boundary:

```text
handler
→ view model
→ presentation
→ adapter document
→ future Next.js renderer
→ later page/route integration
```

The first future implementation slice is the renderer. It must consume only an asserted adapter document.

## 4. Immediate implementation boundary

Implement only the renderer slice.

Renderer slice:

- accepts an asserted `MLBReportPreviewUIAdapterDocument`;
- returns React elements;
- renders semantic structure with text content only;
- performs no data loading, API calls, handler invocation, view-model construction, presentation construction, adapter construction, route creation, or page creation.

Pipeline integration slice:

- Future. Not planned in this phase.

Route/page slice:

- Future. Not planned in this phase.

## 5. Input contract

The root future renderer component accepts exactly one prop:

```ts
MLBReportPreviewUIAdapterDocument
```

Preferred entry behavior:

- receives an already asserted/narrowed adapter document;
- at the root renderer boundary, defensively calls `assertMLBReportPreviewUIAdapterDocument(document)`;
- on invalid input, throws immediately instead of repairing, fabricating, or falling back to lower-layer data.

The renderer must not accept:

- `MLBReportPreviewUIPresentation`;
- `MLBReportPreviewUIViewModel`;
- handler success;
- raw `reportPreview`;
- research packages;
- historical fixtures;
- CLI output;
- filesystem paths;
- network responses.

## 6. Assertion and failure strategy

Assert first, render second.

```text
assertMLBReportPreviewUIAdapterDocument(document)
→ throw if invalid
→ continue if valid
```

Failure handling:

- first slice throws on invalid input;
- page/route error boundaries remain a future integration concern;
- no fallback to lower-layer data;
- no debug JSON rendered into analytical content.

## 7. Server/client boundary

Preferred first slice:

- server component / ordinary React component with no `'use client'`;
- no hooks (`useState`, `useEffect`, `useMemo`, `useCallback`);
- no state;
- no effects;
- no context;
- no event handlers;
- no browser APIs.

Rationale:

- repository App Router pages are server components: `src/app/(app)/dashboard/page.tsx` is an `async` function page without `'use client'`;
- no existing client component evidence was found in `src/app`;
- the first renderer is pure rendering with no interaction requirements;
- no filesystem, network, storage, or time-dependent behavior is needed to render a provided adapter document.

## 8. Component boundary

### Root

- `MLBReportPreviewRenderer` — the only exported component. It accepts one prop: `MLBReportPreviewUIAdapterDocument`. It defensively calls `assertMLBReportPreviewUIAdapterDocument(document)` and throws on invalid input. It then renders the seven adapter nodes in exact order using private helper functions.

### Private helpers (same file)

These are not exported components. They are ordinary rendering helper functions inside the single production file:

- `renderHeader(node: MLBReportPreviewUIAdapterHeaderNode)` — renders header semantics.
- `renderMetadata(node: MLBReportPreviewUIAdapterMetadataNode)` — renders metadata semantics.
- `renderSectionList(node: MLBReportPreviewUIAdapterSectionListNode)` — sections or empty state.
- `renderGameCardList(node: MLBReportPreviewUIAdapterGameCardListNode)` — cards or empty state.
- `renderGameDetailList(node: MLBReportPreviewUIAdapterGameDetailListNode)` — details or empty state.
- `renderWarnings(node: MLBReportPreviewUIAdapterWarningsNode)` — warnings, or omit entirely when empty/null.
- `renderLimitations(node: MLBReportPreviewUIAdapterLimitationsNode)` — always-visible limitations.
- `renderEmptyState(message: string)` — neutral empty-state rendering reused by list helpers.

Responsibility summary:

- Root owns assertion and node-order sequencing.
- Each helper owns semantic element selection and plain-text escaping for its node type.
- Empty-state helper owns neutral list-empty rendering.
- No helper accepts handler, presentation, view-model, raw payload, filesystem, network, storage, analytics, or telemetry data.

Public export count: exactly 1 component. No separate child-component files.

## 9. Exact node order

Render nodes in the exact adapter order:

```text
header
metadata
section-list
game-card-list
game-detail-list
warnings
limitations
```

No sorting. No reordering. No conditional branch based on content. Limitations must remain last and visible.

## 10. Semantic element mapping

### Root renderer

Preferred root element: `<article>` on the assumption that one root wrapper is sufficient for a self-contained preview fragment; the later route integration can nest it.

### Header

```html
<header>
  <h1>...</h1>
  <p>...</p>
  <dl>
    <dt>...</dt>
    <dd>...</dd>
  </dl>
</header>
```

Exact fields: `title`, `subtitle`, `generatedAtLabel`, `sourceLabel`.

### Metadata

```html
<section aria-label="Technical metadata">
  <h2>...</h2>
  <dl>
    <dt>handlerVersion</dt>
    <dd>...</dd>
    ...
  </dl>
</section>
```

Only technical versions. Not promotional text.

### Sections

```html
<section>
  <h2>...</h2>
  <ul>
    <li>...</li>
  </ul>
  <!-- or -->
  <p>...</p>
</section>
```

If `body` has one line, render a single `<p>`. If multiple lines, render a `<ul>` with each line as an `<li>`. Do not interpret body text as Markdown or HTML.

### Card list

```html
<section>
  <h2>...</h2>
  <ul>
    <li id="game-card-...">
      <article>...</article>
    </li>
  </ul>
</section>
```

Empty state:

```html
<p>No game cards available.</p>
```

### Detail list

```html
<section>
  <h2>...</h2>
  <ul>
    <li id="game-detail-...">
      <article>...</article>
    </li>
  </ul>
</section>
```

Empty state:

```html
<p>No game details available.</p>
```

### Warnings

Conditional block only when `warnings.length > 0`:

```html
<section aria-label="Warnings">
  <h2>...</h2>
  <ul>
    <li>...</li>
  </ul>
</section>
```

No severity added.

### Limitations

Always rendered:

```html
<section>
  <h2>Limitations</h2>
  <ul>
    <li>...</li>
  </ul>
</section>
```

Do not hide behind accordion, disclosure, details, tab, modal, tooltip, or hover.

## 11. Header rendering

Render as plain text within semantic elements. Preserve exact heading, subtitle, generatedAtLabel, sourceLabel. Do not inject freshness labels, timestamps, or decorative copy.

## 12. Metadata rendering

Render as a `<dl>` with technical labels: handler version, contract version, renderer version, adapter version, deterministic flag, source, generatedAt. No analytical prose.

## 13. Section-list rendering

For non-empty `sections[]`:

- render each section inside `section-list`;
- preserve heading, body lines, and emptyState exactly.

For empty `sections[]`:

- render the `emptyState` string as plain text;
- do not fabricate a section component.

## 14. Card-list rendering

- preserve card order;
- use `gameId` as the stable React `key`;
- render safe labels only;
- do not synthesize records.

## 15. Detail-list rendering

- preserve detail order;
- use `gameId` as the stable React `key`;
- align card/detail count by position only;
- do not cross-match by inferred identity.

## 16. Warning rendering

- render in adapter order;
- emit `code` and `message` as text;
- omit entire warnings block when `warnings[]` is empty and `emptyState` is `null`;
- do not emit "No warnings.".

## 17. Limitations rendering

Always render last with exact heading text `Limitations`. No hidden state.

## 18. Plain-text escaping

- all adapter strings are rendered as React text content;
- no `dangerouslySetInnerHTML`;
- no `innerHTML`;
- no HTML parsing;
- no Markdown execution;
- no generated links from model text;
- no event handler injection;
- no raw JSON rendering;
- no debug object inspectors.

React escaping remains active. Do not render arbitrary tag names, `className`, `style`, `href`, `src`, or event handlers derived from adapter data.

## 19. Stable key strategy

- game card: `gameId`;
- game detail: `gameId`;
- warning: deterministic composite when duplicate codes are possible (`${code}-${index}`);
- section: deterministic composite when headings may repeat (`${heading}-${index}`);
- body line: deterministic composite (`${sectionIndex}-${lineIndex}`).

Only use index-backed composites when input order is deterministic and no stronger unique field exists. No UUIDs, random IDs, timestamps, or array-order-independent inferred IDs.

## 20. Accessibility boundary

Semantic requirements:

- one clear root heading;
- logical heading hierarchy;
- metadata uses understandable `<dt>`/`<dd>` labels;
- card and detail collections use list semantics;
- warnings identifiable by text, not color alone;
- limitations always visible;
- dates/times remain readable text;
- no interaction required to discover safety notes;
- no meaning conveyed solely through styling;
- empty states announced as normal visible text.

Do not claim WCAG compliance.

## 21. Styling boundary

Deferred visual design.

Constraints:

- semantic structure first;
- no dependency on color for meaning;
- no inline style derived from adapter data;
- no dynamic classes from model text;
- no CSS in the first implementation unless separately approved;
- existing project Tailwind setup (`tailwind.config.ts`) may be reused later in a dedicated style phase;
- no redesign of the dashboard.

## 22. File-boundary recommendation

Recommended future files for the first renderer implementation slice:

```text
src/app/_components/mlb-report-preview/MLBReportPreviewRenderer.tsx
tests/prospective/mlb-report-preview-next-renderer.test.tsx
```

A later route/page file is deferred without naming or creating it here.

Do not create a barrel. Do not create CSS files. Do not create separate child-component files in the first slice.

## 23. First-slice size

Immediate implementation:

- one production TSX renderer file: `src/app/_components/mlb-report-preview/MLBReportPreviewRenderer.tsx`
- one focused TSX test file: `tests/prospective/mlb-report-preview-next-renderer.test.tsx`
- no route;
- no page;
- no CSS file;
- no barrel;
- no separate child-component files.

Option A — one renderer source file with private helper functions

Rationale:
- no `src/components` directory exists in the repository;
- existing React elements are composed inline in pages, not extracted;
- the first renderer is pure and interaction-free, so extraction is not justified by reuse;
- a single file keeps review scope bounded and avoids introducing a broad top-level component architecture before any implementation or reuse demand exists.

The immediate implementation must not exceed what is needed to render all seven root nodes safely. One file with private helpers is sufficient.

Explicit first-slice limits:

- Production files added: exactly 1 TSX file.
- Test files added: exactly 1 TSX test file.
- Package changes: 0.
- Route/page changes: 0.
- CSS changes: 0.

A later implementation must stop and report if it cannot meet these limits without broadening scope.

## 24. Future test plan

Minimum test categories (37):

1. renders a valid adapter document
2. defensively rejects malformed adapter document
3. accepts only adapter-document input
4. exact root order
5. exact header text
6. technical metadata labels
7. section-list semantics
8. empty section list
9. section-body text escaping
10. single-body-line rendering vs multi-line list rendering
11. card order and keys
12. detail order and keys
13. card/detail alignment remains visible
14. warning order
15. warnings omitted for `[] + null`
16. limitations always visible
17. limitations final in document flow
18. no hidden/collapsed limitations state
19. empty card list
20. empty detail list
21. no fabricated records
22. no `dangerouslySetInnerHTML`
23. no `innerHTML`
24. model text escaped
25. no dynamic element type from input
26. no model-derived `className`, `style`, `href`, or event handler
27. no hooks
28. no `'use client'`
29. no browser storage
30. no fetch
31. no wall clock
32. no randomness
33. no mutation
34. deterministic repeated render structure
35. no lower-layer data access
36. no unsafe renderer-owned phrases
37. accessibility-oriented heading/list semantics

Test tooling:

- `vitest` (existing);
- `@testing-library/react` and `@testing-library/jest-dom` (already in devDependencies and `tests/setup.ts`);
- render with `@testing-library/react` using plain container assertions and `getByRole`/`getByLabelText` queries for semantic checks.

Planned test file: `tests/prospective/mlb-report-preview-next-renderer.test.tsx`.

Important boundary: the first renderer implementation is an ordinary synchronous render-only React component. It will not contain `'use client'`, hooks, state, effects, browser APIs, event handlers, or fetching. Tests may render it under the existing Vitest environment using React Testing Library. These tests verify React element output and absence of prohibited behavior; they do not prove true Next.js server-component execution semantics, which are guaranteed by the absence of client-specific code.

## 25. Validation requirements

After the actual future implementation, run:

- `npm run inventory:mlb-fixtures`
- `npm run prospective:mlb:dry-run-check`
- focused adapter/preview test suites
- `npx vitest run tests/prospective --reporter=verbose`
- `npx vitest run tests/backtesting --reporter=verbose`
- `npx vitest run --reporter=verbose`
- `npx tsc --noEmit --incremental false --pretty false`
- `npm test`
- `npm run build`
- `git diff --check`
- the established seven stdout golden comparisons

Code forbid/safety searches remain required.

## 26. Deferred work

- Route/page integration;
- pipeline integration or data fetching;
- browser fetching or client fetching;
- API route creation;
- layout or global component changes;
- final CSS, Tailwind class design, or visual redesign;
- deployment configuration.

## 27. Explicit non-goals

Phase 6L does not implement:

- React components;
- Next.js components;
- JSX;
- TSX;
- routes;
- pages;
- layouts;
- CSS;
- Tailwind classes;
- server handlers;
- API routes;
- browser fetching;
- client fetching;
- network calls;
- browser storage;
- analytics;
- telemetry;
- fixtures;
- goldens;
- historical fixture changes;
- package dependencies;

nor does it commit to final visual design.
