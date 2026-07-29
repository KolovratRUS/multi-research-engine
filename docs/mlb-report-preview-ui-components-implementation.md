# MLB Report Preview UI Components Implementation

## 1. Phase 6I status

Implemented. Framework-agnostic presentation contract added.

## 2. Framework-neutral interpretation

The term component in Phase 6I means a typed presentation node, not a browser or framework component. This module contains only TypeScript interfaces, constants, pure validation helpers, and pure builders. It returns plain data objects and performs no I/O.

## 3. Input boundary

The primary builder accepts exactly one input:

- `MLBReportPreviewUIViewModel` (validated)

It calls `assertMLBReportPreviewUIViewModel` defensively at the root boundary. It does not accept raw handler responses, raw report-preview payloads, research packages, or historical fixtures.

## 4. Presentation tree

Root:
- `MLBReportPreviewUIPresentation`

Children:
- `MLBReportPreviewUIHeaderPresentation`
- `MLBReportPreviewUIMetadataPresentation`
- `MLBReportPreviewUISectionListPresentation`
- `MLBReportPreviewUISectionPresentation`
- `MLBReportPreviewUIGameCardListPresentation`
- `MLBReportPreviewUIGameCardPresentation`
- `MLBReportPreviewUIGameDetailListPresentation`
- `MLBReportPreviewUIGameDetailPresentation`
- `MLBReportPreviewUIWarningPresentation`
- `MLBReportPreviewUIWarningsPresentation`
- `MLBReportPreviewUILimitationsPresentation`

## 5. Root builder

- `buildMLBReportPreviewUIPresentation(viewModel: MLBReportPreviewUIViewModel)`

Behavior:
1. Defensive assertion via `assertMLBReportPreviewUIViewModel`.
2. Preserves input order.
3. Returns fresh plain data objects.
4. Preserves empty arrays for game cards, game details, and warnings with explicit `emptyState` fields.
5. Maps empty section bodies to the exact neutral empty state.
6. Does not mutate input.
7. No I/O, network, browser, clock, or randomness behavior.

## 6. Validation or assertion approach

Added narrow presentation-level validation:
- `validateMLBReportPreviewUIPresentation`
- `assertMLBReportPreviewUIPresentation`

The validator checks root name/version, required child nodes, exact Limitations heading, card/detail count alignment, empty-state field types, and prohibited lower-layer key names. It does not duplicate the Phase 6F view-model validator, nor does it scan presentation strings for restricted terms.

Existing `assertMLBReportPreviewUIViewModel` guarantees the validated input is safe. The builder requests only the allowed presentation subset.

## 7. Header and metadata contract

Header fields are copied verbatim from the validated input header:
- title
- subtitle
- generatedAtLabel
- sourceLabel

Metadata fields are copied verbatim from the validated input metadata and normalized to:
- deterministic: true
- source: `local-report-preview`

Versions remain technical metadata strings only.

## 8. Section contract

Each section maps to:
- heading (preserved)
- body (preserved order)
- emptyState (neutral text when body is empty, otherwise null)

Empty section body maps to the exact neutral empty-state constant.

## 9. Game-card contract

Each game card maps to:
- gameId
- heading
- officialDate
- scheduledStartTime
- moduleSummary
- dataQualityLabel
- confidenceLabel
- researchStrengthLabel
- warningSummary
- scheduleContextSummary
- teamQualityContextSummary

Input order preserved. No ranking, sorting, or scoring is introduced.

## 10. Game-detail alignment

Each game detail maps to:
- heading
- availableResearchModules
- teamRecentFormSummary
- scheduleContextSummary
- teamQualityContextSummary
- warnings
- dataQualityExplanation
- evidenceLimitations
- technicalMetadataSummary
- gameId (derived from same-index card)

No fallback matching by team name, heading text, score, date, or inferred identity is used.

## 11. Warning contract

Each warning maps to:
- code
- message

Empty warnings remain an empty array with `emptyState: null`. No severity is added. Warning order is preserved.

## 12. Limitations contract

Every root output contains:
- heading: `Limitations`
- notes (from validated input)

This node is always present and never optional or hidden.

## 13. Empty states

Explicit exported constants:

- `EMPTY_SECTION_BODY`
- `EMPTY_SECTIONS`
- `EMPTY_GAME_CARDS`
- `EMPTY_GAME_DETAILS`
- `EMPTY_WARNINGS`
- `EMPTY_LIMITATIONS_NOTES`

Empty-state copy does not imply retry, network failure, live arrival, loading, or betting content.

## 14. Determinism

Repeated construction from equivalent fresh input produces deeply equal output. No `Date.now`, no random IDs, no unstable ordering.

## 15. Output guarantees

The builder is pure: input is never mutated, and output does not share mutable collection references with input. Callers should treat the returned contract as readonly.

## 16. Side-effect isolation

No file reads/writes, no CLI execution, no network requests, no browser APIs, no storage behavior.

## 17. Safety protections

The builder consumes only the validated view model. It never exposes raw handler responses, report-preview payloads, historical fixtures, or research-package structures. It preserves safe labels, visible limitations, and conceptual separation between research strength, confidence, data quality, volatility, and model probability.

This Phase 6I presentation contract is the sole allowed future adapter input. A later framework adapter must consume `MLBReportPreviewUIPresentation` only; it must not consume the view model, handler response, raw report preview, research package, CLI stdout, filesystem paths, or live/network responses directly.

## 18. Tests

- `tests/prospective/mlb-report-preview-ui-components.test.ts`

Coverage includes valid construction, exact label preservation, limitations visibility, metadata semantics, section contract, game-card contract, game-detail alignment, warning contract, empty states, determinism, no wall-clock dependency, no randomness, no fetch, no filesystem/CLI, no raw lower-layer fields, no prohibited analytical keys, no unsafe phrases, rejection of invalid inputs, stable version constants, fresh reference proofs, and plain-data-output proofs.

## 19. Explicit non-goals

No browser UI, HTML/CSS/JSX/TSX, framework integration, routes, server code, network behavior, CLI flags, fixture changes, golden changes, or generated artifacts are added.

## 20. Future adapter boundary

Phase 6K consumes this presentation contract directly. A later framework adapter must consume `MLBReportPreviewUIPresentation` only; it must not consume the view model, handler response, raw report preview, research package, CLI stdout, filesystem paths, or live/network responses directly.
