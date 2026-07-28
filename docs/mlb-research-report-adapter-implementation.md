# MLB Research Report Adapter Implementation

Phase: 5W
Status: local-only typed adapter skeleton and tests.

## Paths

- Module: `src/prospective/mlb/research-report-adapter.ts`
- Tests: `tests/prospective/mlb-research-report-adapter.test.ts`

## What this adapter does

- Accepts an existing local research package object created in-process.
- Produces a typed report shape intended for safe display surfacing.
- Collects module availability, data quality, confidence-like labels, research strength labels, and deduped warnings.
- Preserves labels as evidence descriptors only.
- Does not create new research findings or infer winner/probability picks.

## What this adapter does not do

- Does not read files.
- Does not call CLI output.
- Does not call network or MLB APIs.
- Does not mutate the input package.
- Does not implement website/API filings.
- Does not implement file output.
- Does not expose raw outcomes, finalScore, completedGameState, finalStatus, actualStartingPitchers, modelProbability, or betting-related fields.
- Does not calculate odds, markets, EV, ROI, edges, implied probability, picks, or predictions.

## Output shape summary

Top-level report fields:

- `adapterVersion`
- `adapterName`
- `generatedFromPackageVersion`
- `slateSummary`
- `gameCards`
- `gameDetails`
- `metadata`
- `reportWarnings`

Slate summary fields:

- `gameCount`
- `moduleAvailabilityCounts`
- `dataQualityCounts`
- `warningCount`
- `topWarnings`
- `moduleNamesPresent`

Game card fields include safe display fields only:

- game identifiers
- module availability
- top warnings
- data quality label
- confidence label
- research strength label
- schedule/quality context summary labels

Game detail fields include safe module panels, warning codes, evidence limitations, and technical metadata.

Metadata includes package/adapter versions, deterministic flag, source mode, and generatedAt (null unless explicitly supplied as deterministic string).

## Safety boundaries

- No pick, predictedWinner, winChance, powerRating, teamRank, standingsPosition fields.
- No odds, sportsbook, market, price, edge, ROI, impliedProbability fields.
- No modelProbability.
- No raw finalScore or completedGameState.
- No actualStartingPitchers.
- Missing modules render as not-requested or unavailable, never guessed.
- `generatedAt` defaults to null; explicit value is accepted only if deterministic/test-supplied.

## Validation

- 13 adapter-specific tests pass.
- adapter module compiles to TypeScript cleanly (tsc --noEmit clean).
- No existing golden files changed.
- No CLI behavior changed.
- No package dependency changes.

## Recommended next safe phase

Phase 6F — add typed UI view-model contract for MLB reportPreview handler success output only.
Alternatively, next sport module planning if the user chooses.

Scope for Phase 6F:
- local-only typed view-model contract
- no server/network
- no UI implementation
- no components
- no CSS
- no app/pages/routes
- no frontend framework files
- no HTTP routes
- no website/API deployment
- no file output
- no CLI changes
- no stdout golden
- no golden changes
- no fixtures
- no modelProbability
- no picks/predictions/betting advice
- no raw outcomes
- no pitcher evidence
- no actual starters
- no historical fixture changes
- preserves Phase 5B/5E/5H/5K/5N/5T/5Z goldens
- preserves Phase 5Y report-preview CLI behavior
- preserves Phase 6E UI boundary plan
- preserves Phase 6D handler validation behavior
- preserves Phase 6C handler behavior
- preserves Phase 6B API contract behavior
- preserves Phase 5W adapter behavior
- preserves Phase 5X renderer behavior

## Phase 5Z Status

Phase 5Z adds exact stdout golden regression coverage for explicit `--fixture-evidence-local --report-preview-local`.
It adds one new golden: `tests/prospective/fixtures/manual-schedule/valid-mlb-report-preview-local-cli-output-v1.json`.
It adds no default behavior change.
It adds no file output.
It adds no website/API implementation.
It preserves Phase 5B/5E/5H/5K/5N/5T goldens.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 5S team-quality CLI behavior.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
It preserves Phase 5R/5U team-quality behavior.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.

Phase 6A adds a documentation-only MLB website/API integration boundary plan.
It adds no runtime code.
It adds no website/API implementation.
It adds no server/backend/frontend code.
It adds no CLI behavior.
It adds no CLI flag.
It adds no stdout golden.
It preserves Phase 5B default stdout golden.
It preserves Phase 5E evidence-enabled stdout golden.
It preserves Phase 5H aggregate stdout golden.
It preserves Phase 5K result-metrics stdout golden.
It preserves Phase 5N schedule-context stdout golden.
It preserves Phase 5T team-quality stdout golden.
It preserves Phase 5Z report-preview golden.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
It preserves Phase 5S team-quality CLI behavior.
It preserves Phase 5R/5U team-quality behavior.
It preserves Phase 4X construction file-output behavior.
It preserves Phase 4Y construction file-output goldens.
It preserves Phase 4V no-flag construction stdout goldens.
It preserves lock CLI behavior.
It preserves Phase 4P no-flag lock goldens.
It preserves Phase 4S file-output lock goldens.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.
No file output.
No package.json or package-lock.json changes.
Recommended next safe phase is Phase 6B typed local API contract/schema for reportPreview only, or next sport module planning if the user chooses.

Phase 6B adds a typed local API contract/schema for MLB reportPreview only.
It adds no server/backend/frontend code.
It adds no website/API implementation.
It adds no network behavior.
It adds no CLI behavior.
It adds no file output.
It adds no new stdout golden.
It preserves Phase 5B/5E/5H/5K/5N/5T/5Z goldens.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
It preserves Phase 5S team-quality CLI behavior.
It preserves Phase 5R/5U team-quality behavior.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.
Recommended next safe phase is Phase 6D optional local handler fixture/golden-free validation coverage, or next sport module planning if the user chooses.

Phase 6D adds golden-free validation coverage for the local MLB reportPreview API handler.
It adds no server/backend/frontend code.
It adds no HTTP routes.
It adds no website/API deployment.
It adds no network behavior.
It adds no CLI behavior.
It adds no file output.
It adds no new stdout golden.
It adds no fixtures.
It adds no generated goldens.
It preserves Phase 5B/5E/5H/5K/5N/5T/5Z goldens.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 6C handler contract and hardens invalid-input handling only if needed.
It preserves Phase 6B API contract behavior unless explicitly documented.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.
Recommended next safe phase is Phase 6E website UI component boundary planning only, or next sport module planning if the user chooses.
