# Historical Coverage July Slice Comparison — july-slice02 vs july-slice03

Documentation-only comparison.
Fixture-only diagnostics.
No new fixture data added.
No fixture game records modified.
No live source used.
No real MLB API request made.
No web lookup used.
Generated artifacts not committed.
No model-quality or predictive-performance claim.

## Purpose

Compare july-slice02 and july-slice03 to confirm the inventory guard and fixture-only diagnostics reflect the third deterministic July fixture slice.

## Current inventory baseline

- command: `npm run inventory:mlb-fixtures`
- total games: 29
- June games: 17
- July games: 12
- fixture range: 2024-06-01 through 2024-07-21
- July dates: 2024-07-01, 2024-07-03, 2024-07-05, 2024-07-07, 2024-07-08, 2024-07-10, 2024-07-12, 2024-07-14, 2024-07-15, 2024-07-17, 2024-07-19, 2024-07-21

## Source documents

- docs/historical-coverage-fixture-slice-comparison-checklist.md
- docs/historical-coverage-july-slice02-implementation.md
- docs/historical-coverage-july-slice03-implementation.md
- docs/historical-coverage-fixture-inventory-guard.md
- docs/historical-dataset-coverage-plan.md

## Inventory interpretation

- july-slice03 extends the fixture end date from 2024-07-14 to 2024-07-21.
- total games increased from 25 to 29 after Phase 2X.
- July games increased from 8 to 12.
- June stayed unchanged at 17.
- inventory guard makes this visible before future expansion.

## Slice comparison table

| metric | july-slice02 | july-slice03 | interpretation |
|---|---|---|---|
| slice label | july-slice02 | july-slice03 | contiguous non-overlapping July windows |
| date range | 2024-07-08 to 2024-07-14 | 2024-07-15 to 2024-07-21 | contiguous July coverage |
| fixture games | 4 | 4 | equal small slices |
| dates | 2024-07-08, 2024-07-10, 2024-07-12, 2024-07-14 | 2024-07-15, 2024-07-17, 2024-07-19, 2024-07-21 | both within slice bounds |
| discovered games | 4 | 4 | provider found all added games |
| predictions | 5 | 4 | fixture composition difference |
| abstentions | 3 | 4 | fixture composition difference |
| known-ineligible games | 2 | 4 | fixture composition difference |
| warnings | 13 | 8 | fixture composition difference |
| review status | valid | valid | both exports passed review |
| included evidence | home-park, rest-travel, team-offense | home-park, rest-travel, team-offense | stable |
| excluded evidence | bullpen, injuries-lineup, offense-lineup, opponent-batting, starting-pitcher, weather-roof | bullpen, injuries-lineup, offense-lineup, opponent-batting, starting-pitcher, weather-roof | stable |

## july-slice02 diagnostic

Export command:

```bash
npm run backtest:mlb -- --source fixture --start 2024-07-08 --end 2024-07-14 --research-construction both --export-json tmp/coverage/mlb_both_fixture_2024-07-08_2024-07-14_july-slice02_phase2y_export.json
```

Review commands:

```bash
npm run backtest:mlb -- --review-export-json tmp/coverage/mlb_both_fixture_2024-07-08_2024-07-14_july-slice02_phase2y_export.json
npm run backtest:mlb -- --output json --review-export-json tmp/coverage/mlb_both_fixture_2024-07-08_2024-07-14_july-slice02_phase2y_export.json
```

Captured counts:

- requested dates: 7
- discovered games: 4
- predictions: 5
- abstentions: 3
- known-ineligible games: 2
- warnings: 13
- comparisonIncluded: yes
- included evidence: home-park, rest-travel, team-offense
- excluded evidence: bullpen, injuries-lineup, offense-lineup, opponent-batting, starting-pitcher, weather-roof
- warning summary: Both starting pitchers unavailable, Game suspended skipped before prediction, Missing away team profile, Missing home team profile, STARTING_PITCHERS_UNAVAILABLE, TEAM_ONLY_RESEARCH
- review status: valid, no issues

## july-slice03 diagnostic

Export command:

```bash
npm run backtest:mlb -- --source fixture --start 2024-07-15 --end 2024-07-21 --research-construction both --export-json tmp/coverage/mlb_both_fixture_2024-07-15_2024-07-21_july-slice03_phase2y_export.json
```

Review commands:

```bash
npm run backtest:mlb -- --review-export-json tmp/coverage/mlb_both_fixture_2024-07-15_2024-07-21_july-slice03_phase2y_export.json
npm run backtest:mlb -- --output json --review-export-json tmp/coverage/mlb_both_fixture_2024-07-15_2024-07-21_july-slice03_phase2y_export.json
```

Captured counts:

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
- review status: valid, no issues

## Comparison notes

- both windows are contiguous, non-overlapping July windows.
- both have 4 fixture games and 7 requested dates.
- july-slice03 has fewer warnings but more known-ineligible games than july-slice02, based on deterministic fixture composition.
- evidence included/excluded domains remained stable.
- counts are fixture-diagnostic counts, not model-quality or predictive-performance claims.

## Artifact cleanup

- temp exports removed.
- no generated artifacts staged.

## Safety checklist

- source remained fixture.
- no source=live.
- no real MLB API.
- no web lookup.
- no fixture records changed.
- generated artifacts removed / not staged.
- modelProbability absent / null / not available until calibrated.
- TEAM_ONLY excludes pitcher evidence.
- no schedule probable timestamp safety weakened.
- no actual starters used prospectively.
- no odds/market/betting language introduced.

## Decision

fixture-slice03 comparison is complete; plan before further fixture expansion.

## Recommended next safe action

- Phase 2Z — plan next deterministic fixture slice or add a comparison-summary index for July slices.
- Do not recommend live/API usage.
