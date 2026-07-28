# MLB Report Preview UI View-Model Synthetic Coverage

## Phase status

Phase 6G is tests-and-documentation only.
It adds synthetic, golden-free validation coverage for the existing Phase 6F MLB reportPreview UI view-model boundary.
It adds no UI implementation, no CSS, no routes, no server, no network, no CLI change, no fixture change, no golden change, no package change, and no live source.

## Existing boundary under test

Phase 6F provides:

- `src/prospective/mlb/report-preview-ui-view-model.ts`
- `tests/prospective/mlb-report-preview-ui-view-model.test.ts`
- `docs/mlb-report-preview-ui-view-model-implementation.md`

Phase 6G targets the existing public API:

- `MLBReportPreviewUIViewModel`
- `validateMLBReportPreviewUIViewModel`
- `buildMLBReportPreviewUIViewModelFromHandlerSuccess`
- `assertMLBReportPreviewUIViewModel`

No second test-only contract is introduced.

## Methodology

Synthetic coverage uses fresh nested factories for each test.
No snapshot testing is the primary safety proof.
No stdout golden is created or modified.
No file read/write is relied upon except reading the existing Phase 6F source/test/doc surface.

## Accepted handler success boundary

The view-model adapter accepts only `MLBReportPreviewApiHandlerSuccess` values returned by the local handler.
The builder rejects direct `reportPreview` objects, raw research-package shapes, and raw historical-fixture shapes.

## Rejected raw lower-layer inputs

Coverage proves rejection for:

- raw `reportPreview` passed directly to `buildMLBReportPreviewUIViewModelFromHandlerSuccess`
- handler failure responses that include `ok: false`
- objects shaped like raw research packages
- objects shaped like raw historical fixtures

## Metadata validation

Valid view-model metadata must include:

- `handlerVersion`
- `contractVersion`
- `rendererVersion`
- `adapterVersion`
- `generatedAt`

Each must be a non-empty string, except `generatedAt`, which may also be `null`.
Missing or malformed metadata fields are rejected.
`source` must be `local-report-preview`.
`deterministic` must be `true`.

## Safe label semantics

Valid output must use these exact safe values:

- header subtitle: `Research preview`
- header source label: `Local report preview`
- `generatedAt: null` maps to `Local deterministic preview`
- safety banner heading: `Limitations`

`confidenceLabel` must use research-confidence or data-confidence wording only.
It must not use win, winner, probability, betting, odds, edge, favourite, favorite, or underdog language.

`researchStrengthLabel` must describe research coverage or research strength only.
It must not describe probability, ranking, team superiority, or selection confidence.

`dataQualityLabel` must describe data quality only.

## Recursive unsafe-key protection

Recursive key collection on valid output must not encounter prohibited complete key names including:

- raw handler shells: `apiResponse`, `reportPreview`, `contractName`, `ok`, `error`
- unsafe result fields: `odds`, `sportsbook`, `market`, `price`, `edge`, `roi`, `impliedProbability`, `winProbability`, `winner`, `pick`, `bestBet`, `powerRanking`, `teamRanking`, `standingsPosition`
- raw outcome fields: `finalScore`, `rawOutcome`, `actualStartingPitcher`, `pitcherEvidence`, `historicalFixtures`

## Recursive unsafe-text protection

Recursive string collection on valid output must not contain case-insensitive unsafe phrases including:

- should win
- likely winner
- best bet
- value bet
- win probability
- market edge
- sportsbook
- power ranking
- team ranking
- favourite
- favorite
- underdog

Recursive testing checks deeply nested section bodies, card `warningSummary` strings, and detail `warnings` strings.

## Card/detail alignment

Rejected alignment cases:

- `gameCards.length !== gameDetails.length` → `GAME_CARD_DETAIL_COUNT_MISMATCH`

Duplicate `gameId` values are accepted because uniqueness is not enforced by the current contract.

## Malformed arrays and entries

Rejected runtime-invalid collections:

- `sections` as non-array → `INVALID_SECTIONS`
- `gameCards` as non-array → `INVALID_GAME_CARDS`
- `gameDetails` as non-array → `INVALID_GAME_DETAILS`
- `warnings` as non-array → `INVALID_WARNINGS`

Rejected malformed entries:

- section missing `heading` → `MISSING_SECTION_HEADING`
- section `body` not an array → `INVALID_SECTION_BODY`
- game card missing or empty `gameId` → `MISSING_GAME_CARD_GAME_ID`
- game card `officialDate` not a string → `INVALID_GAME_CARD_OFFICIAL_DATE`
- game card `scheduledStartTime` not a string → `INVALID_GAME_CARD_SCHEDULED_START`
- game detail missing or empty `heading` → `MISSING_GAME_DETAIL_HEADING`
- warning missing or empty `code` → `MISSING_WARNING_CODE`
- warning missing or empty `message` → `MISSING_WARNING_MESSAGE`

## Determinism

Repeated builds from identical input produce deeply equal view models.
Repeated validations produce deeply equal validation results.
No internal state is accumulated across calls.
The builder and validator do not call `Date.now()` or otherwise depend on wall-clock time.

## Side-effect isolation

Tests with safe spies confirm that the builder and validator do not initiate:

- file reads
- file writes
- child processes
- CLI execution
- network requests
- `fetch`

## Input immutability

Input objects are serialized before and after builder/validator execution and must remain deeply equal.
Tests use fresh JSON-cloned objects per case.

## Production hardening

A real validation gap was discovered during synthetic coverage:

- `validateMLBReportPreviewUIViewModel` did not require metadata fields (`handlerVersion`, `contractVersion`, `rendererVersion`, `adapterVersion`, `generatedAt`) and did not recursively validate sections, cards, details, and warnings.

Production hardening limited to:

- added required metadata field checks in `src/prospective/mlb/report-preview-ui-view-model.ts`
- added recursive entry validation for `sections`, `gameCards`, `gameDetails`, and `warnings`

The builder behavior and valid Phase 6F output remain unchanged.
Updated error codes added:

- `MISSING_METADATA_HANDLER_VERSION`
- `MISSING_METADATA_CONTRACT_VERSION`
- `MISSING_METADATA_RENDERER_VERSION`
- `MISSING_METADATA_ADAPTER_VERSION`
- `MISSING_METADATA_GENERATED_AT`
- `INVALID_SECTION_ENTRY`
- `MISSING_SECTION_HEADING`
- `INVALID_SECTION_BODY`
- `INVALID_GAME_CARD_ENTRY`
- `MISSING_GAME_CARD_GAME_ID`
- `INVALID_GAME_CARD_OFFICIAL_DATE`
- `INVALID_GAME_CARD_SCHEDULED_START`
- `INVALID_GAME_DETAIL_ENTRY`
- `MISSING_GAME_DETAIL_HEADING`
- `INVALID_WARNING_ENTRY`
- `MISSING_WARNING_CODE`
- `MISSING_WARNING_MESSAGE`

`checkUnsafeStrings` was also expanded to include `power ranking`, `team ranking`, `favorite`, `favourite`, `underdog`, and `roi`.

## Non-goals

This phase does not:

- implement UI components
- implement CSS
- add routes
- add servers
- make network calls
- change CLI behavior
- change fixtures
- change goldens
- change packages
- add live source support
- add betting advice or predictions

Validation results are recorded after successful test runs in the final Phase 6G report.
