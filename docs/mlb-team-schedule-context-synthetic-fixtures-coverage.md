# MLB Team Schedule Context Synthetic Fixtures Coverage

Phase 5P — tests/fixtures only.
No implementation. No runtime behavior changes unless explicitly fixed.
No new stdout golden. No modified goldens.
No file output. No live/API/web. No network schedule ingestion.
No historical fixture changes. No package changes.

## Status

Phase 5Q is planning-only. Phase 5Q plans the next safe MLB TEAM_ONLY module: team quality context. No implementation or behavior changed. No new tests/goldens. Phase 5B/5E/5H/5K/5N goldens preserved. Phase 5J result-metrics behavior preserved. Phase 5M schedule-context behavior preserved. Phase 5P synthetic coverage preserved. No modelProbability. No raw outcomes. No pitcher evidence. No actual starters. No file output. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5R.

Phase 5P adds synthetic schedule-context unit/fixture coverage to
`tests/prospective/mlb-team-recent-form-research.test.ts`.

These tests use inline synthetic schedule records with clearly fake team names
and deterministic ISO timestamps. They do not modify existing goldens, existing
fixture records, or runtime behavior.

## Coverage Summary

New tests cover:

- rich previous/next schedule context with exact dates/hours/days/window counts
- exact 3-day and 7-day window boundary exclusion behavior
- consecutive road games computed from the most recent past streak
- consecutive home games computed from the most recent past streak
- mixed home/away sequence label when the last 3 games alternate
- target game exclusion from previous/next counts and window counts
- partial context when no previous game exists
- partial context when no next game exists
- invalid-timestamp warning for empty `scheduledStartTime`
- forbidden fields absent from JSON-serialized schedule context output

## Synthetic Scenarios

Synthetic records use team names such as `AWAY_1`, `HOME_1`, `AWAY_2`, `HOME_2`,
`HOME_A`, `HOME_B`, `HOME_C`, `HOME_D`, `AWAY_A`, `AWAY_B`, `AWAY_C`,
`AWAY_D`, `AWAY_3`, `HOME_3`, `HOME_4`.

Deterministic timestamps used:

- target: `2024-07-10T19:00:00Z`
- previous game exactly at 3-day boundary: `2024-07-07T19:00:00Z`
- previous game exactly at 7-day boundary: `2024-07-03T19:00:00Z`
- future game exactly at 3-day boundary: `2024-07-13T19:00:00Z`
- future game exactly at 7-day boundary: `2024-07-17T19:00:00Z`

## Safety Boundary

- Synthetic records are not real MLB schedule data.
- Synthetic records are not live/API/web-derived.
- No scores/results/outcomes are included.
- No pitcher data is included.
- No odds/market/price fields are included.
- No calibrated probability is included.
- `modelProbability` remains absent from schedule context output.
- Historical fixture inventory is unchanged.
- The `buildTeamScheduleContext` implementation is unchanged.
- The `travelBurdenLabel` remains `insufficient` because no safe venue/timezone/
  coordinate data is provided for the synthetic records.
- Goldens for Phase 5B, 5E, 5H, 5K, and 5N are preserved unchanged.

## Validation Results

- `npm run inventory:mlb-fixtures` — 29 total games unchanged
- `npm run prospective:mlb:dry-run-check` — passed
- Phase 5B default golden — passed
- Phase 5E evidence golden — passed
- Phase 5H aggregate golden — passed
- Phase 5K result metrics golden — passed
- Phase 5N schedule context golden — passed
- `npx vitest run tests/prospective/mlb-team-recent-form-research.test.ts` — 124 passed
- `npx vitest run tests/prospective/mlb-weekly-prospective-research-construction.test.ts` — 58 passed
- `npx vitest run tests/prospective` — 261 passed
- `npx vitest run tests/backtesting` — 699 passed
- `npx vitest run` — 1017 passed
- `npx tsc --noEmit --incremental false --pretty false` — passed
- `npm test` — 1017 passed
- `npm run build` — passed
- `git diff --check` — passed

## Planned Next Safe Phase

Phase 5Q is planning-only. Phase 5Q plans the next safe MLB TEAM_ONLY module: team quality context. No implementation or behavior changed. No new tests/goldens. Phase 5B/5E/5H/5K/5N goldens preserved. Phase 5J result-metrics behavior preserved. Phase 5M schedule-context behavior preserved. Phase 5P synthetic coverage preserved. No modelProbability. No raw outcomes. No pitcher evidence. No actual starters. No file output. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5R.

Phase 5V is planning-only. It plans the future MLB research report/interface format. It adds no runtime behavior. It adds no CLI behavior. It adds no website/API implementation. It adds no file output. It adds no new tests/goldens. It preserves Phase 5B/5E/5H/5K/5N/5T goldens. It preserves Phase 5S CLI behavior. It preserves Phase 5R/5U team-quality behavior. No modelProbability. No picks/predictions/betting advice. No raw outcomes. No pitcher evidence. No actual starters. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5W.

Phase 5W adds local-only typed MLB research report-shape adapter skeleton and tests. It adds no runtime behavior. It adds no CLI behavior. It adds no website/API implementation. It adds no file output. It adds no new stdout golden. It preserves Phase 5B/5E/5H/5K/5N/5T goldens. It preserves Phase 5S CLI behavior. It preserves Phase 5R/5U team-quality behavior. No modelProbability. No picks/predictions/betting advice. No raw outcomes. No pitcher evidence. No actual starters. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5X.

Phase 5X adds local-only MLB human-readable report renderer and tests. It adds no CLI behavior. It adds no file output. It adds no website/API implementation. It adds no new stdout golden. It preserves Phase 5B/5E/5H/5K/5N/5T goldens. It preserves Phase 5S CLI behavior. It preserves Phase 5W adapter behavior unless explicitly documented. It preserves Phase 5R/5U team-quality behavior. No modelProbability. No picks/predictions/betting advice. No raw outcomes. No pitcher evidence. No actual starters. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes.
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


Docs:
- docs/mlb-research-report-interface-plan.md
- docs/mlb-research-report-adapter-implementation.md
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

