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

Phase 5Q — plan additional TEAM_ONLY research modules or synthetic fixture
snapshots if useful.

Scope:
- local-only
- no live/API/web
- no real schedule ingestion
- no new stdout golden
- no modelProbability
- no raw outcomes
- no pitcher evidence
- no actual starters
- no file output
- no historical fixture changes