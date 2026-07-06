# Historical Coverage Run Log — large01

Completed fixture-only observer-note run. Generated artifacts were not committed.

## Run summary

- run label: large01
- source: fixture
- date window: 2024-06-01 through 2024-07-31
- construction: BOTH
- baseline HEAD: 8883bb80911f2cac1731ba0ed82ebb06628de6e9
- execution date/time: 2026-07-06T06:08:24.022Z
- export path: tmp/coverage/mlb_both_fixture_2024-06-01_2024-07-31_large01_export.json
- review commands used:
  - npm run backtest:mlb -- --review-export-json tmp/coverage/mlb_both_fixture_2024-06-01_2024-07-31_large01_export.json
  - npm run backtest:mlb -- --output json --review-export-json tmp/coverage/mlb_both_fixture_2024-06-01_2024-07-31_large01_export.json

## Export metadata

- exportId: historical-research-export-v1:11a3d4a7a2b3
- exportVersion: historical-research-export-v1
- generatedAt: 2026-07-06T06:08:24.022Z
- source: fixture
- researchConstruction: BOTH
- requestedDateCount: 61
- predictions: 17
- abstentions: 17
- warnings: 61
- comparisonIncluded: true

## Rates

- prediction rate: 0.28
- abstention rate: 0.28
- warning rate: 1.00
Rates are calculated as count / requestedDateCount.

## Evidence domains

- evidence included: home-park, rest-travel, team-offense
- evidence excluded: bullpen, injuries-lineup, offense-lineup, opponent-batting, starting-pitcher, weather-roof

## Warning summary

- Away starting pitcher unavailable
- Both starting pitchers unavailable
- Feature coverage 0.36 below abstention threshold 0.45
- Game cancelled, skipped before prediction
- Game postponed, skipped before prediction
- Game suspended, skipped before prediction
- Home starting pitcher unavailable
- Missing away probable pitcher
- Missing away team profile
- Missing home probable pitcher
- Missing home team profile
- STARTING_PITCHERS_UNAVAILABLE
- TEAM_ONLY_RESEARCH

Recurring relative to smoke01/small01/medium01:
- Away/Home starting pitcher unavailable
- Feature coverage below abstention threshold
- Game postponed/suspended/cancelled style warnings
- STARTING_PITCHERS_UNAVAILABLE
- TEAM_ONLY_RESEARCH

New or more explicit in large01:
- Both starting pitchers unavailable
- Missing away/home probable pitcher
- Missing away/home team profile

Feature-coverage warnings remain present and are treated conservatively.

## Comparison against baselines

| Metric | smoke01 | small01 | medium01 | large01 |
|---|---|---|---|---|
| requested dates | 7 | 14 | 30 | 61 |
| predictions | 4 | 7 | 17 | 17 |
| abstentions | 6 | 13 | 17 | 17 |
| warnings | 16 | 31 | 61 | 61 |
| prediction rate | 0.57 | 0.50 | 0.57 | 0.28 |
| abstention rate | 0.86 | 0.93 | 0.57 | 0.28 |
| warning rate | 2.29 | 2.21 | 2.03 | 1.00 |
| evidence included | stable | stable | stable | stable |
| evidence excluded | stable | stable | stable | stable |
| comparisonIncluded | true | true | true | true |
| construction | BOTH | BOTH | BOTH | BOTH |
| artifacts uncommitted | yes | yes | yes | yes |

## Checklist result

Reference: docs/historical-coverage-comparison-checklist.md

Result: passed

- source remained fixture.
- no source=live.
- no real MLB API request.
- construction recorded as BOTH.
- comparisonIncluded present when expected.
- review commands passed: text review passed, JSON review passed, no issues.
- generated artifacts were not staged.
- evidence domains recorded and stable.
- warning and abstention counts and rates recorded.
- new warning types documented.
- modelProbability remained absent/null/not available.
- TEAM_ONLY continued to exclude pitcher evidence.
- no odds, market, betting, or implied-probability language introduced.

No stop conditions were triggered.

## Artifact handling

Generated export and review outputs were used for local review only.
Generated review outputs were not committed and no review files were retained on disk.
The export file was removed before final report.
Default handling: remove generated tmp artifacts before final report.

## Decision

Result: compare

Rationale: large01 preserved stable included and excluded evidence domains, preserved BOTH construction with comparisonIncluded=true, and produced deterministic review passes. Prediction count remained stable while requested dates grew, which is a descriptive coverage observation only. Abstention and warning counts remained stable while warning and abstention rates decreased with the larger window. No safety stop conditions were triggered.
large01 is suitable for documentation-only comparison against medium01 before any further expansion.

Do not recommend live or API usage.

## Recommended next safe action

Document a medium01 vs large01 observer comparison in a committed doc, or repeat large01 if clearer warning-pattern review is needed.
Do not jump to larger windows or live/API usage without explicit authorization.

## Sign-off

- Reviewer: Sam / pending
- Review date:
- Approved for next coverage step: pending