# Historical Coverage Run Plan — medium01

Planning document only. No export was executed in this phase. No generated export or review artifacts were created.

## Purpose

Prepare a conservative fixture-only coverage expansion from small01 to medium01.

This is an operational and data-coverage plan. It does not prove model quality, evaluate predictive performance, or authorize larger historical windows. It is intended to keep the next coverage run planned, reproducible, and leakage-safe.

## Planned run summary

- run label: medium01
- source: fixture
- date window: 2024-06-01 through 2024-06-30
- construction: BOTH
- baseline compared against: small01 and the smoke01/small01 observer comparison
- expected artifact policy: generated artifacts remain uncommitted by default
- expected review policy: review outputs must pass before the run is treated as reviewable

## Baseline references

- docs/historical-coverage-run-log-smoke01.md
- docs/historical-coverage-run-log-small01.md
- docs/historical-coverage-observer-comparison-smoke01-small01.md
- docs/historical-coverage-comparison-checklist.md
- docs/historical-coverage-artifact-naming.md
- docs/historical-dataset-coverage-plan.md

## Baseline comparison values

Use smoke01 vs small01 as the baseline example:

- requested dates: 7 -> 14
- predictions: 4 -> 7
- abstentions: 6 -> 13
- warnings: 16 -> 31
- prediction rate: 0.57 -> 0.50
- abstention rate: 0.86 -> 0.93
- warning rate: 2.29 -> 2.21
- included evidence remained stable: home-park, rest-travel, team-offense
- excluded evidence remained stable: bullpen, injuries-lineup, offense-lineup, opponent-batting, starting-pitcher, weather-roof
- comparisonIncluded remained true
- BOTH construction remained stable
- generated artifacts remained uncommitted

## Why medium01 is conservative

The next planned window grows from 14 requested dates to 30 requested dates but remains:

- fixture-only
- non-live
- non-API
- BOTH construction
- subject to the Phase 2G checklist stop conditions
- limited to documentation and reviewability goals

This expansion is intended to observe coverage behavior at approximately one month, not to evaluate model quality or predictive performance.

## Proposed command plan

The following commands are for the next execution phase only. Do not run them in this planning phase.

Export command:

    npm run backtest:mlb -- --source fixture --start 2024-06-01 --end 2024-06-30 --research-construction both --export-json tmp/coverage/mlb_both_fixture_2024-06-01_2024-06-30_medium01_export.json

Text review command:

    npm run backtest:mlb -- --review-export-json tmp/coverage/mlb_both_fixture_2024-06-01_2024-06-30_medium01_export.json

JSON review command:

    npm run backtest:mlb -- --output json --review-export-json tmp/coverage/mlb_both_fixture_2024-06-01_2024-06-30_medium01_export.json

Placeholder review paths:

    tmp/coverage/reviews/mlb_both_fixture_2024-06-01_2024-06-30_medium01_review.txt
    tmp/coverage/reviews/mlb_both_fixture_2024-06-01_2024-06-30_medium01_review.json

These artifacts should remain uncommitted unless explicitly authorized.

## Acceptance gates

Do not treat medium01 as reviewable until all gates are satisfied:

- source remains fixture
- no source=live
- no real MLB API request
- construction recorded as BOTH
- comparisonIncluded present when expected
- review commands pass
- generated artifacts are not staged by default
- included and excluded evidence domains are recorded
- warning and abstention counts and rates are recorded
- new warning types are documented
- modelProbability remains absent, null, or not available until calibration is separately authorized
- TEAM_ONLY continues to exclude pitcher evidence
- no odds, market, betting, or implied-probability language is introduced

## Stop conditions

Halt and rerun preflight if any of the following appear:

- dirty git status before starting the new run
- unexpected HEAD, branch, or remote mismatch
- live or API request attempted
- source=live appears in an executable command
- generated artifacts staged accidentally
- modelProbability unexpectedly populated
- schedule probable timestamp safety weakened
- actual starters used prospectively
- TEAM_ONLY accidentally includes pitcher evidence
- review validation fails
- new unexplained evidence domains appear
- new forbidden odds, market, betting, or implied-probability language appears

## medium01 run log template

Fill this section during the next execution phase.

- execution date:
- operator:
- baseline HEAD:
- source:
- window:
- construction:
- export path:
- exportId:
- generatedAt:
- requestedDateCount:
- predictions:
- abstentions:
- warnings:
- prediction rate:
- abstention rate:
- warning rate:
- comparisonIncluded:
- evidence included:
- evidence excluded:
- warning summary:
- review text result:
- review JSON result:
- artifact handling:
- checklist result:
- decision: hold / repeat / compare / expand later
- notes:

## Recommended next phase

Execute medium01 fixture-only only if this planning document is reviewed and accepted.

The next safe phase should:
- complete the planning review above
- keep source=fixture
- keep reviewability and documentation as primary goals
- avoid live or API usage unless explicitly authorized
