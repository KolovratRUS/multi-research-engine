# MLB Report Preview UI Adapter Implementation

## 1. Phase 6K status

Phase 6K implements the first framework-neutral adapter contract that consumes one validated `MLBReportPreviewUIPresentation` and produces deterministic semantic render instructions. This phase is local-only, deterministic, odds-blind, and framework-neutral. No browser UI, no framework dependencies, and no generated run artifacts were introduced.

## 2. Framework-neutral interpretation

The adapter consumes only `MLBReportPreviewUIPresentation` and returns plain TypeScript semantic nodes. It must not:

* import React, React DOM, Next.js, Vue, Svelte, or DOM/browser libraries;
* return JSX, TSX, HTML strings, DOM nodes, framework elements, or virtual DOM objects;
* call `Date.now`, `Math.random`, `fetch`, read/write files, or invoke any child process;
* mutate input or hold mutable references after output.

The adapter is a pure transformation layer suitable for later consumption by a Next.js-specific renderer without requiring framework code at this boundary.

## 3. Input boundary

The only allowed production input is `MLBReportPreviewUIPresentation`. The builder calls `assertMLBReportPreviewUIPresentation` at the entry boundary. Invalid input is rejected before adaptation. The adapter does not repair or reshape invalid input.

Runtime-invalid casts of the following lower-layer shapes are rejected:

* `MLBReportPreviewUIViewModel`;
* `MLBReportPreviewApiHandlerSuccess`;
* raw `reportPreview`;
* research-package-shaped objects;
* historical-fixture-shaped objects.

## 4. Adapter contract

### Root document

```ts
export interface MLBReportPreviewUIAdapterDocument {
  readonly name: typeof MLB_REPORT_PREVIEW_UI_ADAPTER_NAME;
  readonly version: typeof MLB_REPORT_PREVIEW_UI_ADAPTER_VERSION;
  readonly title: string;
  readonly nodes: readonly MLBReportPreviewUIAdapterNode[];
}
```

Stable initial version:

```text
mlb-report-preview-ui-adapter-v1
```

### Root-level node kinds

The root `nodes` array contains only seven root-level kinds in exact order:

```ts
export const MLB_REPORT_PREVIEW_UI_ADAPTER_ROOT_NODE_ORDER = [
  'header',
  'metadata',
  'section-list',
  'game-card-list',
  'game-detail-list',
  'warnings',
  'limitations',
] as const;
```

```ts
export type MLBReportPreviewUIAdapterNode =
  | MLBReportPreviewUIAdapterHeaderNode
  | MLBReportPreviewUIAdapterMetadataNode
  | MLBReportPreviewUIAdapterSectionListNode
  | MLBReportPreviewUIAdapterGameCardListNode
  | MLBReportPreviewUIAdapterGameDetailListNode
  | MLBReportPreviewUIAdapterWarningsNode
  | MLBReportPreviewUIAdapterLimitationsNode;
```

Child entry kinds are nested inside the dedicated list nodes and do not appear at root:

```ts
export interface MLBReportPreviewUIAdapterSectionNode {
  readonly kind: 'section';
  readonly heading: string;
  readonly body: readonly string[];
  readonly emptyState: string | null;
}

export interface MLBReportPreviewUIAdapterGameCardNode {
  readonly kind: 'game-card';
  // ... exact fields preserved from Phase 6I
}

export interface MLBReportPreviewUIAdapterGameDetailNode {
  readonly kind: 'game-detail';
  // ... exact fields preserved from Phase 6I
}

export interface MLBReportPreviewUIAdapterWarningNode {
  readonly kind: 'warning';
  readonly code: string;
  readonly message: string;
}
```

## 5. Adapter versioning

The adapter version string is separate from handler, contract, renderer, presentation, and previous adapter versions. The metadata node preserves all existing technical versions and adds the new adapter version exactly once.

## 6. Root node order

Exact deterministic root order:

1. header
2. metadata
3. section-list
4. game-card-list
5. game-detail-list
6. warnings
7. limitations

Node order is fixed and content-agnostic. Multiple section entries belong inside the single `section-list` node in presentation order.

## 7. Header mapping

Preserves exactly:

* `title`;
* `subtitle`;
* `generatedAtLabel`;
* `sourceLabel`.

No injected timestamps, freshness labels, or freshness decorators are added.

## 8. Metadata mapping

Preserves exactly:

* `handlerVersion`;
* `contractVersion`;
* `rendererVersion`;
* `generatedAt`;
* `source`;
* `deterministic`.

Adds `adapterVersion` set to `MLB_REPORT_PREVIEW_UI_ADAPTER_VERSION` without rewriting existing fields.

## 9. Section-list mapping

For each non-empty section preserves:

* `heading`;
* `body` lines in original order;
* `emptyState`.

If the section list is empty, the `section-list` node emits:

* `sections: []`
* `emptyState` copied from the presentation `sections.emptyState`

No synthetic section record is created when the section list is empty.

## 10. Game-card mapping

Preserves exactly:

* `gameId`;
* `heading`;
* `officialDate`;
* `scheduledStartTime`;
* `moduleSummary`;
* `dataQualityLabel`;
* `confidenceLabel`;
* `researchStrengthLabel`;
* `warningSummary`;
* `scheduleContextSummary`;
* `teamQualityContextSummary`.

Card order is preserved. No sorting or ranking is performed.

## 11. Game-detail mapping

Preserves exactly:

* `gameId` (same-index alignment with game cards);
* `heading`;
* `availableResearchModules`;
* `teamRecentFormSummary`;
* `scheduleContextSummary`;
* `teamQualityContextSummary`;
* `warnings`;
* `dataQualityExplanation`;
* `evidenceLimitations`;
* `technicalMetadataSummary`.

Detail order is preserved. No fallback matching is introduced.

## 12. Warning mapping

Preserves warning order, `code`, and `message`. No severity is added. Empty warnings remain `[]` and empty warning state remains `null`. The node is always present in root order.

## 13. Limitations mapping

Limitations node is always present. It preserves exact heading `Limitations` and notes in order. No hidden or collapsed state is introduced.

## 14. Empty-state preservation

* Empty section lists emit `section-list` with `sections: []` and `emptyState` copied from the presentation.
* Empty card lists produce empty `gameCards` arrays with `emptyState: 'No game cards available.'`.
* Empty detail lists produce empty `gameDetails` arrays with `emptyState: 'No game details available.'`.
* Empty warning arrays remain `[]` and `emptyState` remains `null`.
* No fabricated records are added to any otherwise empty list.

## 15. Validation approach

A single narrow validator is exported:

* `validateMLBReportPreviewUIAdapterDocument` — returns `{ ok: boolean, errors: AdapterValidationError[] }`.
* `assertMLBReportPreviewUIAdapterDocument` — throws on invalid input.

The validator checks:

* exact adapter name and version;
* non-empty title;
* exactly seven root nodes;
* exact root kinds and order in `MLB_REPORT_PREVIEW_UI_ADAPTER_ROOT_NODE_ORDER`;
* no duplicated root kinds;
* required node shapes for each root node;
* `section-list` shape and child section entry shape;
* card list shape and card entry shape;
* detail list shape and detail entry shape;
* warnings shape, array-of-warning shape, and no severity field;
* limitations heading exactly `Limitations`, notes array of strings;
* exact `Limitations` heading;
* empty-state types;
* absence of `type` plus `props`, `dangerouslySetInnerHTML`, `innerHTML`, event-handler keys, framework CSS/HTML keys;
* absence of prohibited raw lower-layer keys;
* absence of prohibited analytical keys;
* absence of unsafe string phrases;
* plain-data types only (no functions, symbols, DOM nodes, event handlers, HTML injection fields).

The adapter validator does not duplicate the complete Phase 6I presentation validator and does not accept raw presentation input as adapter output.

## 16. Determinism

The adapter builder performs no current-time lookup and no randomness. A unique lookup of the exact identical validated presentation always yields a deeply equal adapter document. Stable sorted warnings and limitations order are preserved, but no ranking or analytics transformation is introduced.

## 17. Fresh-reference guarantees

The builder returns fresh plain data. Nested objects and arrays are not shared with the input presentation. The input presentation is never mutated.

## 18. Side-effect isolation

The builder performs no file access, CLI execution, network calls, browser storage access, analytics, or telemetry. Proved by genuine spies:

* `Date.now` not invoked;
* `Math.random` not invoked;
* global `fetch` not invoked;
* `node:fs.readFileSync` not invoked (genuine spy);
* `node:fs.writeFileSync` not invoked (genuine spy);
* `node:fs.appendFileSync` not invoked (genuine spy);
* `node:child_process.execSync` not invoked (genuine spy);
* `node:child_process.spawnSync` not invoked (genuine spy);
* no `localStorage`, `sessionStorage`, `analytics`, or `telemetry` getters accessed (environment-stable property-descriptor stubs).

## 19. Safety protections

The adapter:

* never exposes `apiResponse`, `reportPreview`, `viewModel`, `presentation`, `payload`, `raw`, `handlerResponse`, `researchPackage`, `historicalFixtures`, or `sourceModel`;
* never introduces prohibited analytical keys such as `odds`, `sportsbook`, `market`, `price`, `edge`, `roi`, `impliedProbability`, `winProbability`, `winner`, `pick`, `bestBet`, `powerRanking`, `teamRanking`, `standingsPosition`, `finalScore`, `rawOutcome`, `actualStartingPitcher`, `pitcherEvidence`, or `modelProbability`;
* never introduces phrases such as "should win", "likely winner", "best bet", "value bet", "win probability", "market edge", "sportsbook", "power ranking", "team ranking", "favorite", "favourite", or "underdog";
* preserves exact text; no analytical transformation is performed.

## 20. Tests

Coveres 31 test groups mapped to exact test names in `tests/prospective/mlb-report-preview-ui-adapter.test.ts`:

1. Stable constants
2. Export exact root order constant
3. Valid construction
4. Defensive presentation assertion
5. Exact root node order
6. Header text preservation
7. Metadata preservation
8. Section-list preservation
9. Empty section list remains empty
10. Game-card preservation
11. Game-detail preservation
12. Card/detail alignment
13. Warning preservation
14. Limitations visibility
15. Empty-state preservation for lists
16. No fabricated empty-state strings inside child records
17. Determinism
18. Fresh references
19. Input not mutated
20. No wall clock
21. No randomness
22. No fetch
23. Genuine filesystem and child-process spy coverage
24. Environment-stable storage and analytics checks
25. No raw lower-layer keys
26. No prohibited analytical keys
27. No unsafe adapter-owned phrases
28. Plain-data output with recursive shape checks
29. Reject lower-layer inputs
30. Validator rejects malformed adapter documents
31. Validator rejects missing section-list, duplicated root kinds, and section at root

## 21. Explicit non-goals

Phase 6K explicitly does not implement:

* Next.js components or routes;
* React components or JSX;
* HTML strings, CSS, or visual rendering;
* browser entry points, client fetching, or network behavior;
* CLI flags or artifact generation;
* live or schedule ingestion;
* betting, odds, market, or predictive-value language;
* framework-specific props, event handlers, or styling;
* Phase 6I source or tests changes (no defect was discovered).

## 22. Future renderer boundary

The immediate next boundary is a narrow next renderer implementation slice that will consume exactly one validated `MLBReportPreviewUIAdapterDocument` and render semantic React elements using the repository's Next.js App Router. That slice is planned in `docs/mlb-report-preview-next-renderer-implementation-plan.md`.

## 23. Whether Phase 6I source hardening was required

No. Phase 6I source hardening was not required for Phase 6K. The Phase 6I presentation, view-model, and contracts remain unchanged. Phase 6K adds a new adapter module and its isolated validator.
