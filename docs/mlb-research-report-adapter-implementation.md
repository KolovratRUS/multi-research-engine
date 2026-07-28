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

## Phase 5Y Status

- Phase 5Y adds optional explicit `--report-preview-local` JSON CLI mode.
- It requires `--fixture-evidence-local`.
- It adds `reportPreviewLocal: true` and `reportPreview` only in explicit mode.
- It adds no default behavior change.
- It adds no file output.
- It adds no website/API implementation.
- It adds no new stdout golden.
- It preserves Phase 5B/5E/5H/5K/5N/5T goldens.
- It preserves Phase 5S team-quality CLI behavior.
- It preserves Phase 5W adapter behavior.
- It preserves Phase 5X renderer behavior.
- It preserves Phase 5R/5U team-quality behavior.
- No modelProbability.
- No picks/predictions/betting advice.
- No raw outcomes.
- No pitcher evidence.
- No actual starters.
- No live/API/web or network standings/roster/schedule ingestion.
- No historical fixture changes.
- Recommended next safe phase is Phase 5Z.
