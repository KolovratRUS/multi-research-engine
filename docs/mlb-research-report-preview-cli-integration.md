# MLB Research Report Preview CLI Integration

## Phase 5Y Status

Phase 5Y adds an optional explicit `--report-preview-local` JSON CLI mode to the MLB research command.

## Exact Flag

`--report-preview-local`

## Requirements

- `--report-preview-local` is allowed only when `--fixture-evidence-local` is present.
- Bare `--report-preview-local` without `--fixture-evidence-local` returns a clean JSON error:
  - `ok: false`
  - `error: REPORT_PREVIEW_REQUIRES_FIXTURE_EVIDENCE`
- The mode runs after the normal local research package is built.
- It builds a report adapter object from the research package.
- It renders the report using the renderer.
- It adds the rendered report to the existing JSON output under the key `reportPreview`.
- It adds top-level `reportPreviewLocal: true`.
- It does not replace the existing package output.
- It does not add `generatedAt` unless an existing deterministic source already provides it; by default generatedAt remains null.
- It does not call current time.
- It does not read/write files.
- It does not call network.

## What It Adds

In explicit report-preview mode, top-level output additionally includes:
- `reportPreviewLocal: true`
- `reportPreview` object with:
  - `rendererVersion`
  - `rendererName`
  - `adapterVersion`
  - `title`
  - `sections`
  - `gameCards`
  - `gameDetails`
  - `safetyNotes`
  - `metadata`

`reportPreview.metadata.generatedAt` is `null` by default.
`reportPreview.metadata.deterministic` is `true`.
`reportPreview.metadata.source` is `local-research-package`.

## What It Does Not Change

- Default no-flag Phase 5A/5B behavior remains unchanged.
- Phase 5B default stdout golden remains unchanged.
- Phase 5E evidence-enabled stdout golden remains unchanged.
- Phase 5H aggregate stdout golden remains unchanged.
- Phase 5K result-metrics stdout golden remains unchanged.
- Phase 5N schedule-context stdout golden remains unchanged.
- Phase 5T team-quality stdout golden remains unchanged.
- Phase 5S team-quality CLI behavior remains unchanged.
- Phase 5W adapter behavior remains unchanged.
- Phase 5X renderer behavior remains unchanged.
- Phase 5R/5U team-quality builder/test behavior remains unchanged.
- No file output is added.
- No website/API implementation is added.
- No new stdout golden is added.
- No dependencies are added.

## Safety Boundaries

- Report-preview output must not include picks, predictions, betting advice, bookmaker language, or probability claims.
- modelProbability remains null/absent/not available until calibrated.
- Keep researchStrengthScore, confidence, matchConfidence, dataQuality, volatility, and modelProbability conceptually separate.
- Historical completion remains based only on liveData.plays.allPlays[last].about.endTime with provenance LAST_COMPLETED_PLAY_END.
- Actual starters remain evaluation-only.
- TEAM_ONLY excludes pitcher evidence.
- Report-preview output must not expose raw finalScore, raw outcome, completedGameState, finalStatus, actualStartingPitchers, or any calibrated probability.

Prohibited output fields:
- pick
- predictedWinner
- winChance
- powerRating
- teamRank
- standingsPosition
- finalScore
- actualStartingPitchers
- completedGameState
- finalStatus
- modelProbability
- odds
- sportsbook
- market
- price
- edge
- ROI
- impliedProbability
- probability
- winner
- favorite
- underdog
- best bet
- value
- projected score
- should win
- likely winner
- chance to win

## Validation

### Inventory guard
- startDate: 2024-06-01
- endDate: 2024-07-21
- totalGames: 29
- 2024-06: 17
- 2024-07: 12
- historicalFixtureInventoryTouched: false

### Targeted tests
- tests/prospective/mlb-team-recent-form-research.test.ts: 148 passed
- tests/prospective/mlb-research-report-renderer.test.ts: 18 passed
- tests/prospective/mlb-research-report-adapter.test.ts: 13 passed
- tests/prospective/mlb-team-quality-context.test.ts: 21 passed
- tests/prospective/mlb-weekly-prospective-research-construction.test.ts: 58 passed
- tests/prospective: 337 passed
- tests/backtesting: 699 passed
- full suite: 1093 passed
- TypeScript clean
- build clean

### Golden comparison
Default Phase 5B: unchanged.
Evidence Phase 5E: unchanged.
Aggregate Phase 5H: unchanged.
Result-metrics Phase 5K: unchanged.
Schedule-context Phase 5N: unchanged.
Team-quality Phase 5T: unchanged.

### Report-preview commands
Bare `--report-preview-local`:
- ok: false
- error: REPORT_PREVIEW_REQUIRES_FIXTURE_EVIDENCE
- no absolute paths
- no stack traces

Explicit `--fixture-evidence-local --report-preview-local`:
- ok: true
- fixtureEvidenceLocal: true
- reportPreviewLocal: true
- reportPreview.rendererVersion: mlb-research-report-renderer-v1
- reportPreview.rendererName: MLB_RESEARCH_REPORT_RENDERER
- reportPreview.adapterVersion: mlb-research-report-adapter-v1
- reportPreview.metadata.generatedAt: null
- reportPreview.metadata.source: local-research-package
- reportPreview.metadata.deterministic: true
- gameCards and gameDetails counts match package game count
- no prohibited fields as JSON keys

Combined with schedule context: succeeds safely.
Combined with team quality context: succeeds safely.
Repeated explicit runs: byte-for-byte identical/deterministic.

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


## Recommended Next Safe Phase

Phase 6A — plan website/API integration boundary or begin next sport module planning.

Scope:
- No default behavior change.
- No file output unless explicitly scoped.
- No website/API implementation unless explicitly scoped.
- No modelProbability.
- No picks/predictions/betting advice.
- No raw outcomes.
- No pitcher evidence.
- No actual starters.
- No live/API/web.
- Preserve existing goldens.

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

