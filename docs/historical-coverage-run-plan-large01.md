# Historical Coverage Run Plan — large01

Planning document only.
No export was executed in this phase.
No generated artifacts were created or retained.
This is an operational/data-coverage plan, not a model-quality or predictive-performance claim.

## Planned run summary

- run label: large01
- source: fixture
- date window: 2024-06-01 through 2024-07-31
- construction: BOTH
- baseline compared against: medium01 and the small01/medium01 observer comparison
- expected artifact policy: generated artifacts remain uncommitted by default
- expected review policy: review outputs must pass before the run is treated as reviewable

## Baseline references

- docs/historical-coverage-run-log-smoke01.md
- docs/historical-coverage-run-log-small01.md
- docs/historical-coverage-run-log-medium01.md
- docs/historical-coverage-observer-comparison-smoke01-small01.md
- docs/historical-coverage-observer-comparison-small01-medium01.md
- docs/historical-coverage-comparison-checklist.md
- docs/historical-coverage-artifact-naming.md
- docs/historical-dataset-coverage-plan.md

## Baseline comparison values

Smoke01 -> small01 -> medium01:

| Metric | smoke01 | small01 | medium01 |
|---|---|---|---|
| requested dates | 7 | 14 | 30 |
| predictions | 4 | 7 | 17 |
| abstentions | 6 | 13 | 17 |
| warnings | 16 | 31 | 61 |
| prediction rate | 0.57 | 0.50 | 0.57 |
| abstention rate | 0.86 | 0.93 | 0.57 |
| warning rate | 2.29 | 2.21 | 2.03 |
| comparisonIncluded | true | true | true |
| construction | BOTH | BOTH | BOTH |
| artifacts uncommitted | yes | yes | yes |

Included evidence remained stable:
- home-park
- rest-travel
- team-offense

Excluded evidence remained stable:
- bullpen
- injuries-lineup
- offense-lineup
- opponent-batting
- starting-pitcher
- weather-roof

## Why large01 is conservative

The next planned window grows from 30 requested dates to roughly two months but remains:
- fixture-only
- non-live
- non-API
- BOTH construction
- subject to Phase 2G checklist stop conditions
- limited to documentation/reviewability goals

The purpose is coverage reviewability, not model-quality or predictive-performance evaluation.

## Proposed command plan

The following commands are for the next execution phase only; do not run in this planning phase.

    npm run backtest:mlb -- --source fixture --start 2024-06-01 --end 2024-07-31 --research-construction both --export-json tmp/coverage/mlb_both_fixture_2024-06-01_2024-07-31_large01_export.json

    npm run backtest:mlb -- --review-export-json tmp/coverage/mlb_both_fixture_2024-06-01_2024-07-31_large01_export.json

    npm run backtest:mlb -- --output json --review-export-json tmp/coverage/mlb_both_fixture_2024-06-01_2024-07-31_large01_export.json

## Acceptance gates

- source remains fixture
- no source=live
- no real MLB API request
- construction recorded as BOTH
- comparisonIncluded present when expected
- review commands pass
- generated artifacts are not staged by default
- included/excluded evidence domains are recorded
- warning and abstention counts/rates are recorded
- new warning types are documented
- modelProbability remains absent/null/not available
- TEAM_ONLY continues to exclude pitcher evidence
- no odds/market/betting language introduced
- any major deviation from medium01 is documented before any further expansion

## Stop conditions

- dirty git status before work
- unexpected HEAD, branch, or remote mismatch
- live/API request attempted
- source=live appears in an executable command
- generated artifacts staged accidentally
- modelProbability unexpectedly populated
- schedule probable timestamp safety weakened
- actual starters used prospectively
- TEAM_ONLY includes pitcher evidence
- review validation fails
- new unexplained evidence domains appear
- new forbidden odds/market/betting language appears
- large01 materially changes evidence-domain inclusion/exclusion without explanation

## Large01 run log template

Execution date/time:
Operator:
Baseline HEAD:
Source:
Window:
Construction:
Export path:
Artifact policy:

Export metadata:

- export id:
- generatedAt:
- source:
- researchConstruction:
- requestedDateCount:
- predictions:
- abstentions:
- warnings:
- comparisonIncluded:

Rates:

- prediction rate:
- abstention rate:
- warning rate:

Evidence domains:

- evidence included:
- evidence excluded:

Warning summary:

- recurring:
- new relative to medium01:

Review validation:

- review text result:
- review JSON result:

Checklist result:

- reference:
- result:
- notes:

Decision:

- hold / repeat / compare / expand later

Rationale:
Notes:

## Recommended next phase

Execute large01 fixture-only only if this planning document is reviewed and accepted.
The next execution phase should still avoid live/API usage.