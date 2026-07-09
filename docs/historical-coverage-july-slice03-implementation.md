# Historical Coverage July Slice Implementation — july-slice03

Documentation-only implementation note.
No live source used.
No real MLB API request made.
No web lookup used.
Generated artifacts not committed.
No model-quality or predictive-performance claim.

## Purpose

july-slice03 extends the deterministic July fixture surface beyond july-slice02 and verifies the inventory guard captures the change.
This is an operational/data-coverage documentation note. It does not make model-quality or predictive-performance claims.

## Plan/checklist references

- `docs/historical-coverage-next-fixture-slice-plan-02.md`
- `docs/historical-coverage-fixture-slice-comparison-checklist.md`

## Prior guarded baseline

- command: `npm run inventory:mlb-fixtures`
- startDate: 2024-06-01
- endDate: 2024-07-14
- totalGames: 25
- gamesByMonth: 2024_06 = 17, 2024_07 = 8
- June games: 17
- July games: 8
- July dates: 2024-07-01, 2024-07-03, 2024-07-05, 2024-07-07, 2024-07-08, 2024-07-10, 2024-07-12, 2024-07-14

## Implementation summary

- Added 4 deterministic July fixture games to `src/fixtures/backtesting/mlb/fixture-games.ts`.
- Added 4 matching outcomes to `src/fixtures/backtesting/mlb/fixture-games.ts`.
- Added 6 focused tests to `tests/backtesting/mlb-fixture.test.ts` verifying july-slice03 inventory, June count preservation, prior slice date stability, and fixture provider discovery without source=live.
- Updated the Phase 2R inventory guard expected baseline to the new post-slice fixture shape.
- No other fixture data was modified.

## July slice details

- slice label: july-slice03
- date range: 2024-07-15 through 2024-07-21
- games added: 4
- total fixture games after update: 29
- games by month after update: June 2024 = 17, July 2024 = 12
- June count remained at 17
- july-slice01 dates remained unchanged
- july-slice02 dates remained unchanged
- fixture provider discovery verified without source=live

## Provenance note

The added July slice is deterministic local fixture/test data.
No live/API/web data was used.
The slice is for coverage-shape and pipeline behavior testing.
It does not claim to be a full historical dataset.
It does not carry a predictive-quality claim.

## Inventory guard results

### Before change

- totalGames: 25
- June games: 17
- July games: 8
- endDate: 2024-07-14
- July dates: 2024-07-01, 2024-07-03, 2024-07-05, 2024-07-07, 2024-07-08, 2024-07-10, 2024-07-12, 2024-07-14

### After change

- totalGames: 29
- June games: 17
- July games: 12
- endDate: 2024-07-21
- July dates: 2024-07-01, 2024-07-03, 2024-07-05, 2024-07-07, 2024-07-08, 2024-07-10, 2024-07-12, 2024-07-14, 2024-07-15, 2024-07-17, 2024-07-19, 2024-07-21

Command used:

```bash
npm run inventory:mlb-fixtures
```

## Checklist usage

Phase 2V checklist was used to govern this implementation:

- pre-change inventory confirmed
- fixture-only local data
- no live/API/web usage
- artifacts not staged
- validation and safety searches completed before finalization

## Optional export/review diagnostic

- command:
  1. `npm run backtest:mlb -- --source fixture --start 2024-07-15 --end 2024-07-21 --research-construction both --export-json tmp/coverage/mlb_both_fixture_2024-07-15_2024-07-21_july-slice03_export.json`
  2. `npm run backtest:mlb -- --review-export-json tmp/coverage/mlb_both_fixture_2024-07-15_2024-07-21_july-slice03_export.json`
  3. `npm run backtest:mlb -- --output json --review-export-json tmp/coverage/mlb_both_fixture_2024-07-15_2024-07-21_july-slice03_export.json`
- artifact cleanup: `rm -f tmp/coverage/mlb_both_fixture_2024-07-15_2024-07-21_july-slice03_export.json`
- captured summary:
  - requested dates: 7
  - discovered games: 4
  - predictions: 4
  - abstentions: 4
  - known-ineligible games: 4
  - warnings: 8
  - comparisonIncluded: yes
  - included evidence: home-park, rest-travel, team-offense
  - excluded evidence: bullpen, injuries-lineup, offense-lineup, opponent-batting, starting-pitcher, weather-roof
  - warning summary: Game suspended, skipped before prediction, STARTING_PITCHERS_UNAVAILABLE, TEAM_ONLY_RESEARCH
  - review status: valid, threshold checks passed

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

Compare july-slice03 diagnostics before any further fixture expansion.

## Recommended next safe action

- Phase 2Y — document a july-slice02 versus july-slice03 fixture-only comparison using the Phase 2V checklist.
- Keep next expansion conservative.
- Prefer documentation and reviewability before any larger fixture scale-up.
- Continue avoiding live/API usage until explicitly authorized.
