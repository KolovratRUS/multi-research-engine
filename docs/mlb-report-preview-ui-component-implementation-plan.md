# MLB Report Preview UI Component Implementation Plan

## 1. Phase status

Phase 6H is documentation-only.

Phase 6H defines the first framework-agnostic component implementation slice for consuming the validated `MLBReportPreviewUIViewModel`.

It adds:
- a narrow presentational component plan
- input contracts
- rendering rules
- test categories

It does not add:
- UI implementation
- framework files
- CSS
- JSX/TSX/HTML
- routes
- server code
- network calls
- CLI changes
- fixture changes
- golden changes
- package changes
- generated artifacts
- historical fixture changes

## 2. Existing validated input boundary

The only allowed component input is:

```ts
MLBReportPreviewUIViewModel
```

This value must already have passed:

- `validateMLBReportPreviewUIViewModel`
- or `assertMLBReportPreviewUIViewModel`

Components must not receive:
- `MLBReportPreviewApiHandlerResponse`
- `MLBReportPreviewApiHandlerSuccess`
- `apiResponse`
- raw `reportPreview`
- raw research package
- raw historical fixtures
- CLI stdout
- filesystem paths
- live responses
- network responses

Why: the view-model contract is the only boundary that hides lower-layer implementation details, strips prohibited fields, enforces safe labels, and guarantees deterministic local-only semantics. Any component that consumes raw handler or report-preview objects bypasses these guarantees and risks leaking prohibited concepts.

References:
- `docs/mlb-report-preview-ui-view-model-implementation.md`
- `docs/mlb-report-preview-ui-view-model-synthetic-coverage.md`
- `docs/mlb-report-preview-api-handler-validation-coverage.md`

## 3. First implementation slice

The first implementation slice is deliberately small. It covers only presentational rendering of a validated view model. No data fetching, no adaptation, no routing, and no framework dependency is introduced.

Conceptual components in the first slice:

- `ReportPreviewPage`
- `ReportPreviewHeader`
- `ReportPreviewMetadata`
- `ReportPreviewSectionList`
- `ReportPreviewGameCardList`
- `ReportPreviewGameCard`
- `ReportPreviewGameDetailList`
- `ReportPreviewGameDetail`
- `ReportPreviewWarnings`
- `ReportPreviewLimitations`

These names match the Phase 6E boundary plan. If any name diverges in a later implementation phase, reconcile back to these names rather than introducing a competing hierarchy.

First slice includes:
- `ReportPreviewPage`
- `ReportPreviewHeader`
- `ReportPreviewMetadata`
- `ReportPreviewSectionList`
- `ReportPreviewGameCardList`
- `ReportPreviewGameCard`
- `ReportPreviewGameDetailList`
- `ReportPreviewGameDetail`
- `ReportPreviewWarnings`
- `ReportPreviewLimitations`

Deferred to a later slice:
- framework adapter
- route/page wiring
- responsive layout
- accessibility refinements
- user interaction beyond expand/collapse
- printing/exporting
- theming

## 4. Component responsibility matrix

| Conceptual component | Allowed input subset | Responsibility | Conditional-rendering owner | Prohibited responsibilities | Expected test type |
|---|---|---|---|---|---|
| `ReportPreviewPage` | `MLBReportPreviewUIViewModel` | Assemble page-level sections, handle empty state at top level, delegate to child components | `ReportPreviewPage` | Data adaptation, validation repair, ranking, sorting, fetching | Unit |
| `ReportPreviewHeader` | `header` | Render title, subtitle, source label, generated-at label | `ReportPreviewHeader` | Modify title, invent subtitle, infer live timestamp | Unit |
| `ReportPreviewMetadata` | `metadata` | Render handler/contract/renderer/adapter versions and deterministic indicator | `ReportPreviewMetadata` | Use metadata as analytical evidence, infer freshness | Unit |
| `ReportPreviewSectionList` | `sections` | Render sections in validated order | `ReportPreviewSectionList` | Reorder, filter, render markdown/HTML | Unit |
| `ReportPreviewGameCardList` | `gameCards` | Render cards in validated order | `ReportPreviewGameCardList` | Reorder by score/strength, add badges for completion | Unit |
| `ReportPreviewGameCard` | one `MLBReportPreviewUIGameCard` | Render one game summary card | `ReportPreviewGameCard` | Mutate card data, call network, render raw outcomes | Unit |
| `ReportPreviewGameDetailList` | `gameDetails` | Render details aligned with cards by position | `ReportPreviewGameDetailList` | Auto-expand, sort, invent joins | Unit |
| `ReportPreviewGameDetail` | one `MLBReportPreviewUIGameDetail` | Render expanded detail for one game | `ReportPreviewGameDetail` | Recompute missing fields, render raw payload | Unit |
| `ReportPreviewWarnings` | `warnings` | Render warning list in validated order | `ReportPreviewWarnings` | Rewrite warnings as recommendations, infer severity | Unit |
| `ReportPreviewLimitations` | `safetyBanner.notes` | Render visible limitations area | `ReportPreviewLimitations` | Hide behind interaction, append promotional text | Unit |

## 5. Root component contract

`ReportPreviewPage` accepts one validated `MLBReportPreviewUIViewModel`.

It must not:
- perform fetching
- perform file reads
- perform CLI execution
- perform validation repair
- perform data adaptation
- sort based on team strength
- rank games or teams
- predict outcomes
- call current time
- mutate input

Validation approach: require validation before rendering. The consumer boundary passes only a validated view model. Components may assert contract version stability defensively, but they must not attempt to repair invalid values. If the view model is invalid, rendering stops and a neutral error state is shown. This keeps components simple and keeps validation logic centralized in the view-model layer.

## 6. Header and metadata rendering

Heading ownership:
- `ReportPreviewHeader` renders:
  - `title`
  - `subtitle`
  - `generatedAtLabel`
  - `sourceLabel`

Safe fixed labels:
- subtitle: `Research preview`
- sourceLabel: `Local report preview`
- generatedAtLabel: `Local deterministic preview` when `metadata.generatedAt` is `null`; safe metadata string otherwise

`ReportPreviewMetadata` renders:
- `handlerVersion`
- `contractVersion`
- `rendererVersion`
- `adapterVersion`
- deterministic/local indicator

Versions are technical metadata. They are not analytical evidence, confidence, or probability.

No live timestamp is invented. `generatedAt: null` remains represented as `Local deterministic preview`.

## 7. General report sections

Rendering rules:
- preserve source array order
- render `heading` as plain text
- render each `body` line as plain text
- empty `body` renders as a neutral empty state, not omitted
- no HTML interpretation
- no markdown rendering in the first implementation slice
- text is treated as plain text
- no unsafe recommendation embellishment

Empty-section behavior: show a neutral empty-state message. This is deterministic and avoids implying that hidden content will appear later.

## 8. Game-card rendering

Allowed card fields and semantics:
- `gameId`: internal stable alignment identifier, used for keys where appropriate
- `heading`: user-facing game heading
- `officialDate`: calendar date of the game
- `scheduledStartTime`: scheduled local time
- `moduleSummary`: condensed module availability text
- `dataQualityLabel`: data-quality label only
- `confidenceLabel`: research-confidence label only
- `researchStrengthLabel`: research-coverage/strength label only
- `warningSummary`: condensed warning summary
- `scheduleContextSummary`: schedule context text
- `teamQualityContextSummary`: team-quality context text

Semantic separation:
- `confidence` is not win confidence
- `researchStrengthScore` is not team strength
- `dataQuality` is not prediction quality
- cards preserve validated input order
- cards must not be reordered by any analytical score

No completion badge is rendered unless a later explicit outcome attachment phase provides a separate final-state contract.

## 9. Game-detail rendering

Alignment:
- `gameDetails` must have the same length as `gameCards`
- detail at index `i` corresponds to card at index `i`
- no fallback matching by team name, score, or inferred identity

Heading ownership:
- `ReportPreviewGameDetail` renders `heading` exactly

Module summaries:
- `availableResearchModules` rendered as plain text
- unavailable modules shown as unavailable/not requested

Warning text:
- rendered as plain text
- no severity inference unless explicitly present in the validated model

Technical metadata:
- `technicalMetadataSummary` rendered verbatim
- not used for freshness inference outside deterministic context

Schedule and team-quality context:
- rendered verbatim from validated summaries

Recent-form context:
- rendered verbatim from validated summaries

## 10. Warning rendering

Rules:
- render `code` and `message` as plain text
- preserve validated order
- empty warning list renders as neutral empty state
- no conversion into picks or recommendations
- no severity inference unless existing view model explicitly contains severity
- plain-text escaping expected

## 11. Limitations and safety rendering

A visible limitations area is required. Exact safe heading:

```
Limitations
```

Safety and limitation content must not be hidden behind optional interaction in the first implementation slice. It must be visible in normal document flow.

Treatment:
- evidence limitations: shown verbatim
- local-only source: shown verbatim
- deterministic behavior: shown verbatim
- missing modules: shown verbatim
- absent live inputs: shown verbatim
- no odds or betting information: shown verbatim or represented as absence only

## 12. Empty-state behavior

Deterministic neutral behavior for:

| Scenario | Behavior |
|---|---|
| no sections | neutral empty-state message |
| no game cards | neutral empty-state message |
| no game details | neutral empty-state message |
| no warnings | omit warning list area, do not invent warning text |
| missing optional summaries | render empty string or neutral placeholder, do not invent content |
| `generatedAt` null | render `Local deterministic preview` |

Do not introduce dynamic retries, remote loading, network errors, or phrases implying that live data will arrive later.

## 13. Rendering safety rules

Rules:
- plain-text output only
- escape text before rendering
- no `dangerouslySetInnerHTML`
- no direct HTML injection
- no markdown rendering in the first slice
- no links generated from model text
- no event handlers derived from model text
- no raw JSON debug display
- no object inspection UI
- no hidden lower-layer payloads
- no browser storage for model state
- no analytics or telemetry

## 14. Determinism and immutability

Future implementation tests must prove:
- repeated render-model construction is deep-equal
- input is not mutated
- component order follows input order
- no `Date.now` or current-time dependency
- no random identifiers
- no unstable generated keys
- `gameId` or another validated stable field is used for keys where appropriate
- no file, CLI, or network behavior

## 15. Future test plan

Exact future test categories:

- root component accepts valid view model
- invalid raw handler input rejected at boundary
- exact safe header labels
- `generatedAt` null display
- section rendering
- card rendering
- detail rendering
- warnings rendered
- visible `Limitations` section
- empty states
- input order preservation
- no prohibited keys rendered
- no unsafe phrases introduced by component copy
- no raw JSON output
- no current-time calls
- no fetch
- no filesystem
- no child process
- no input mutation
- deterministic repeated output

No browser end-to-end test is required in the first implementation slice unless a browser framework already exists in the repository.

## 16. File-boundary recommendation

Recommended future file locations under `src/prospective/mlb/`:

- presentational contracts and helpers:
  - `src/prospective/mlb/report-preview-ui-components.ts`
- framework adapter boundary (if/when a framework is chosen):
  - separate adapter file outside the first slice

Do not create these files in Phase 6H. These are recommendations only.

Distinguish:
- pure presentation-contract code: framework-agnostic TypeScript
- future framework adapter: bridges framework-specific rendering to the contracts
- future page or route integration: outside `src/prospective/mlb/` in the existing application boundary

## 17. Deferred work

Explicitly defer:
- actual browser UI
- framework choice
- React/Vue/Svelte
- routes
- CSS
- visual design
- responsive design
- accessibility implementation details beyond semantic planning
- loading states for network requests
- live data
- authentication
- persistence
- analytics
- telemetry
- user interaction beyond required expand/collapse planning
- filtering
- sorting
- searching
- exporting
- printing
- screenshots
- deployment

## 18. Acceptance criteria for the later implementation phase

A future component-contract implementation phase must satisfy before commit:

- consumes validated view model only
- no raw handler shape
- no raw `reportPreview`
- no network/file/CLI behavior
- no framework dependencies introduced in first slice
- no package changes
- deterministic
- pure builder / fresh output
- safe labels unchanged
- visible limitations
- no prohibited concepts
- focused tests
- prospective suite green
- backtesting suite green
- full Vitest green
- TypeScript `tsc --noEmit` clean
- `npm test` green
- `npm run build` clean
- seven stdout golden comparisons unchanged
- `git diff --check` clean
- safety searches clean for forbidden terminology

The future adapter boundary is recorded in `docs/mlb-report-preview-framework-adapter-boundary-plan.md`.

## 19. Explicit non-goals

Phase 6H adds no:
- implementation code
- component code
- HTML
- CSS
- JSX/TSX
- framework
- route
- server
- network behavior
- CLI behavior
- fixture
- golden
- historical fixture
- package change
- generated artifact
- betting advice
- prediction
- live source

## 20. Adapter implementation status

Phase 6K implements the framework-neutral adapter boundary planned in `docs/mlb-report-preview-framework-adapter-boundary-plan.md`. It consumes only `MLBReportPreviewUIPresentation` and returns deterministic semantic node documents without framework dependencies.
