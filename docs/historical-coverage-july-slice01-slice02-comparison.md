# Historical Coverage July Slice Comparison — july-slice01 vs july-slice02

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

Compare july-slice01 and july-slice02 to confirm the inventory guard and fixture-only diagnostics reflect the added deterministic July fixture surface.

## Current inventory baseline

- total games: 25
- June games: 17
- July games: 8
- fixture range: 2024-06-01 through 2024-07-14
- July dates: 2024-07-01, 2024-07-03, 2024-07-05, 2024-07-07, 2024-07-08, 2024-07-10, 2024-07-12, 2024-07-14

## Source documents

- docs/historical-coverage-july-slice01-implementation.md
- docs/historical-coverage-july-slice01-comparison.md
- docs/historical-coverage-next-fixture-slice-plan.md
- docs/historical-coverage-july-slice02-implementation.md
- docs/historical-coverage-fixture-inventory-guard.md
- docs/historical-dataset-coverage-plan.md

## Inventory interpretation

- july-slice02 intentionally extends the fixture end date from 2024-07-07 to 2024-07-14.
- total games increased from 21 to 25 after Phase 2T.
- July games increased from 4 to 8.
- June stayed unchanged at 17.
- inventory guard makes this visible before future expansion.

## Slice comparison table

| metric | july-slice01 | july-slice02 | interpretation |
|---|---|---|---|
| slice label | july-slice01 | july-slice02 | second deterministic July extension |
| date range | 2024-07-01 to 2024-07-07 | 2024-07-08 to 2024-07-14 | contiguous non-overlapping July windows |
| fixture games | 4 | 4 | equal small slices |
| dates | 2024-07-01, 2024-07-03, 2024-07-05, 2024-07-07 | 2024-07-08, 2024-07-10, 2024-07-12, 2024-07-14 | both windows fully covered within slice bounds |
| discovered games | 4 | 4 | fixture provider found all added games |
| predictions | 4 | 5 | fixture composition difference |
| abstentions | 4 | 3 | fixture composition difference |
| known-ineligible games | 2 | 2 | stable |
| warnings | 12 | 13 | stable with minor fixture-driven increase |
| review status | valid | valid | both exports passed review |

## july-slice01 diagnostic

Export command:

```bash
npm run backtest:mlb -- --source fixture --start 2024-07-01 --end 2024-07-07 --research-construction both --export-json tmp/coverage/mlb_both_fixture_2024-07-01_2024-07-07_july-slice01_phase2u_export.json
```

Review commands:

```bash
npm run backtest:mlb -- --review-export-json tmp/coverage/mlb_both_fixture_2024-07-01_2024-07-07_july-slice01_phase2u_export.json
npm run backtest:mlb -- --output json --review-export-json tmp/coverage/mlb_both_fixture_2024-07-01_2024-07-07_july-slice01_phase2u_export.json
```

Captured counts:

- requested/schedule dates: 7
- discovered games: 4
- predictions: 4
- abstentions: 4
- known-ineligible games: 2
- warnings: 12
- comparisonIncluded: true
- included evidence domains: home-park, rest-travel, team-offense
- excluded evidence domains: bullpen, injuries-lineup, offense-lineup, opponent-batting, starting-pitcher, weather-roof

Review result: valid, no issues.

## july-slice02 diagnostic

Export command:

```bash
npm run backtest:mlb -- --source fixture --start 2024-07-08 --end 2024-07-14 --research-construction both --export-json tmp/coverage/mlb_both_fixture_2024-07-08_2024-07-14_july-slice02_phase2u_export.json
```

Review commands:

```bash
npm run backtest:mlb -- --review-export-json tmp/coverage/mlb_both_fixture_2024-07-08_2024-07-14_july-slice02_phase2u_export.json
npm run backtest:mlb -- --output json --review-export-json tmp/coverage/mlb_both_fixture_2024-07-08_2024-07-14_july-slice02_phase2u_export.json
```

Captured counts:

- requested/schedule dates: 7
- discovered games: 4
- predictions: 5
- abstentions: 3
- known-ineligible games: 2
- warnings: 13
- comparisonIncluded: true
- included evidence domains: home-park, rest-travel, team-offense
- excluded evidence domains: bullpen, injuries-lineup, offense-lineup, opponent-batting, starting-pitcher, weather-roof

Review result: valid, no issues.

## Diagnostic interpretation

- both slices are local deterministic fixture surfaces.
- downstream counts are fixture-diagnostic counts only.
- differences between predictions/abstentions/warnings reflect fixture composition and current pipeline behavior, not model quality.
- this does not authorize live/API use.
- no broad historical dataset claim.

## Evidence domains

- included: home-park, rest-travel, team-offense
- excluded: bullpen, injuries-lineup, offense-lineup, opponent-batting, starting-pitcher, weather-roof

Both slices share the same included/excluded evidence domains.

## Artifact cleanup

Generated fixture-only export artifacts were removed and not committed.

## Decision

Hold further fixture expansion until this comparison is committed, then plan either:

- next deterministic fixture slice
- or a fixture-slice comparison checklist/test guard

## Recommended next safe phase

Phase 2V — add fixture-slice comparison checklist.
This should be documentation/test guard oriented before more fixture data expansion.
Do not recommend live/API usage.
