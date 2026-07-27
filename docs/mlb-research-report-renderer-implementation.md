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

Phase 5Y — add optional explicit CLI report-preview JSON mode using adapter + renderer.

Phase 5Y rules:

- local-only
- no default behavior change
- no file output yet
- no website/API implementation
- no modelProbability
- no picks/predictions/betting advice
- no raw outcomes
- no pitcher evidence
- no actual starters
- no live/API/web
- preserve existing goldens
