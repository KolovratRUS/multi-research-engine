# Historical Coverage July Slice Implementation — july-slice02

Documentation-only implementation note.
No live source used.
No real MLB API request made.
No web lookup used.
Generated artifacts not committed.
No model-quality or predictive-performance claim.

## Purpose

july-slice02 extends the deterministic July fixture surface beyond july-slice01 and verifies the inventory guard captures the change.
This is an operational/data-coverage documentation note. It does not make model-quality or predictive-performance claims.

## Plan reference

- docs/historical-coverage-next-fixture-slice-plan.md

## Prior guarded baseline

- command: npm run inventory:mlb-fixtures
- startDate: 2024-06-01
- endDate: 2024-07-07
- totalGames: 21
- gamesByMonth: 2024-06 = 17, 2024-07 = 4
- uniqueDateCount: 19
- June games: 17
- July games: 4
- July dates: 2024-07-01, 2024-07-03, 2024-07-05, 2024-07-07

## Implementation summary

- Added 4 deterministic July fixture games to `src/fixtures/backtesting/mlb/fixture-games.ts`.
- Added 4 matching outcomes to `src/fixtures/backtesting/mlb/fixture-games.ts`.
- Added 5 focused tests to `tests/backtesting/mlb-fixture.test.ts` verifying July discoverability, June count preservation, july-slice01 date stability, and july-slice02 date window coverage.
- Updated the Phase 2R inventory guard expected baseline to the new post-slice fixture shape.
- No other fixture data was modified.

## July slice details

- slice label: july-slice02
- date range: 2024-07-08 through 2024-07-14
- games added: 4
- total fixture games after update: 25
- games by month after update: June 2024 = 17, July 2024 = 8
- June count remained at 17
- july-slice01 dates remained unchanged
- fixture provider discovery verified without source=live

## Provenance note

The added July slice is deterministic local fixture/test data.
No live/API/web data was used.
The slice is for coverage-shape and pipeline behavior testing.
It does not claim to be a full historical dataset.
It does not carry a predictive-quality claim.

## Inventory guard results

### Before change

- totalGames: 21
- June games: 17
- July games: 4
- endDate: 2024-07-07
- July dates: 2024-07-01, 2024-07-03, 2024-07-05, 2024-07-07

### After change

- totalGames: 25
- June games: 17
- July games: 8
- endDate: 2024-07-14
- July dates: 2024-07-01, 2024-07-03, 2024-07-05, 2024-07-07, 2024-07-08, 2024-07-10, 2024-07-12, 2024-07-14

Command used:

```bash
npm run inventory:mlb-fixtures
```

## Optional export/review diagnostic

A tiny fixture-only export was run over 2024-07-08 through 2024-07-14 to prove july-slice02 games affect downstream counts.

Export command:

```bash
npm run backtest:mlb -- --source fixture --start 2024-07-08 --end 2024-07-14 --research-construction both --export-json tmp/coverage/mlb_both_fixture_2024-07-08_2024-07-14_july-slice02_export.json
```

Review commands:

```bash
npm run backtest:mlb -- --review-export-json tmp/coverage/mlb_both_fixture_2024-07-08_2024-07-14_july-slice02_export.json
npm run backtest:mlb -- --output json --review-export-json tmp/coverage/mlb_both_fixture_2024-07-08_2024-07-14_july-slice02_export.json
```

Captured summary counts:

- requested dates: 7
- discovered games: 4
- predictions: 5
- abstentions: 3
- known-ineligible games: 2
- warnings: 13
- comparison included: true
- included evidence domains: home-park, rest-travel, team-offense
- excluded evidence domains: bullpen, injuries-lineup, offense-lineup, opponent-batting, starting-pitcher, weather-roof

Review result: valid, no issues.

Artifact cleanup:

- Generated export file removed before final report. No committed generated artifacts.

## Safety checklist

- source remained fixture
- no source=live used or requested
- no real MLB API request made
- no web lookup used
- generated artifacts removed/not staged
- modelProbability absent/null/not available until calibrated
- TEAM_ONLY excludes pitcher evidence
- no schedule probable timestamp safety weakened
- no actual starters used prospectively
- no odds/market/betting language introduced

## Decision

Compare july-slice02 diagnostics before any further fixture expansion.

## Recommended next safe action

- Phase 2U — document a july-slice01 versus july-slice02 fixture-only comparison.
- Keep next expansion conservative.
- Prefer documentation and reviewability before any larger fixture scale-up.
- Continue avoiding live/API usage until explicitly authorized.
