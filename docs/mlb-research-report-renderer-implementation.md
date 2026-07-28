# MLB Research Report Renderer Implementation

Phase: 5X
Status: local-only typed human-readable renderer and tests.

## Paths

- Module: `src/prospective/mlb/research-report-renderer.ts`
- Tests: `tests/prospective/mlb-research-report-renderer.test.ts`

## What this renderer does

- Accepts the existing Phase 5W `MLBResearchReport` object produced by the adapter.
- Produces a human-readable rendered report suitable for display.
- Renders sections, game cards, and game details in deterministic safe text.
- Provides constant labels for data quality, confidence, and research strength.
- Preserves warning codes in sorted order.
- Copies adapter metadata without adding new network/file/CLI behavior.
- Enforces a display-safety assertion for rendered output.

## What this renderer does not do

- Does not read files.
- Does not call CLI output.
- Does not call network or MLB APIs.
- Does not mutate the input report.
- Does not implement website/API implementations.
- Does not implement file output.
- Does not create new research findings.
- Does not infer picks, predictions, betting advice, bookmaker language, or probability claims.
- Does not expose raw outcomes, finalScore, completedGameState, finalStatus, actualStartingPitchers, or any calibrated probability.
- Does not introduce odds, sportsbook, betting, market, EV, ROI, edge, implied probability, or betting-value language in rendered text.

## Output shape summary

Top-level rendered fields:

- `rendererVersion`
- `rendererName`
- `adapterVersion`
- `title`
- `sections`
- `gameCards`
- `gameDetails`
- `safetyNotes`
- `metadata`

Sections include safe human-readable summaries:

- Slate Overview
- Module Availability
- Data Quality
- Warnings
- Game Details
- Interpretation Notes

Game card fields:

- heading: `"AWAY_TEAM at HOME_TEAM"`
- gameId
- officialDate
- scheduledStartTime
- moduleSummary
- dataQualitySummary
- confidenceSummary
- researchStrengthSummary
- warningSummary
- scheduleContextSummary
- teamQualityContextSummary

Game detail fields:

- heading
- availableResearchModules
- teamRecentFormSummary
- scheduleContextSummary
- teamQualityContextSummary
- warnings
- dataQualityExplanation
- evidenceLimitations
- technicalMetadataSummary

Metadata fields:

- adapterVersion
- rendererVersion
- generatedAt copied from adapter metadata (null by default)
- source copied from adapter metadata
- deterministic: true

## Label rules

- `researchStrengthScore` is rendered only as `"research strength label: <value>"`
- `confidence` is rendered only as `"confidence label: <value>"`
- `dataQuality` is rendered only as `"data quality label: <value>"`

## Safety boundaries

- No predictedWinner, winChance, powerRating, teamRank, standingsPosition fields.
- No odds, sportsbook, market, price, edge, ROI, impliedProbability fields.
- No modelProbability.
- No raw finalScore, completedGameState, or finalStatus.
- No actualStartingPitchers or pitcher fields.
- Missing optional modules render as `"not-requested"` or `"unavailable"`, never guessed.
- Warnings are preserved in deterministic sorted order.
- No new current-time calls; `generatedAt` is copied only from adapter metadata.

## Display safety assertion

`assertRendererOutputSafeForDisplay(rendered)` scans the JSON string for reserved field names in quoted form. This matches the existing adapter safety-check pattern and avoids matching descriptive words inside adapter-generated negative-safety strings.

## Validation

- 18 renderer-specific tests pass.
- Renderer module compiles to TypeScript cleanly (`tsc --noEmit` clean).
- No existing golden files changed.
- No CLI behavior changed.
- No website/API code added.
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
Recommended next safe phase is Phase 6C local in-process API adapter/handler using existing reportPreview contract, or next sport module planning if the user chooses.

Phase 6C adds a local in-process MLB reportPreview API adapter/handler.
It adds no real server/backend/frontend code.
It adds no HTTP routes.
It adds no website/API deployment.
It adds no network behavior.
It adds no CLI behavior.
It adds no file output.
It adds no new stdout golden.
It preserves Phase 5B/5E/5H/5K/5N/5T/5Z goldens.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 6B API contract behavior.
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
