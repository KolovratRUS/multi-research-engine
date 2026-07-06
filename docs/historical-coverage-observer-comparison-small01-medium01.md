# Historical Coverage Observer Comparison — small01 to medium01

Documentation-only comparison.
No export was executed in this phase.
No generated artifacts were created or retained.
This is an operational/data-coverage comparison, not a model-quality or predictive-performance claim.

## Source documents

- docs/historical-coverage-run-log-small01.md
- docs/historical-coverage-run-log-medium01.md
- docs/historical-coverage-observer-comparison-smoke01-small01.md
- docs/historical-coverage-comparison-checklist.md
- docs/historical-coverage-run-plan-medium01.md
- docs/historical-dataset-coverage-plan.md

## Scope

- source: fixture only
- construction: BOTH
- windows:
  - small01: 2024-06-01 through 2024-06-14
  - medium01: 2024-06-01 through 2024-06-30
- no live source
- no real API
- artifacts uncommitted
- modelProbability remains absent, null, or not available until calibrated

## Baseline metrics

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

## Delta summary

Compare small01 -> medium01:

- requested dates: +16
- predictions: +10
- abstentions: +4
- warnings: +30
- prediction rate: +0.07
- abstention rate: -0.36
- warning rate: -0.18

Note: these rate changes are descriptive coverage observations only, not quality claims.

## Evidence-domain comparison

Evidence included remained stable:

- home-park
- rest-travel
- team-offense

Evidence excluded remained stable:

- bullpen
- injuries-lineup
- offense-lineup
- opponent-batting
- starting-pitcher
- weather-roof

This stability means the fixture-only coverage surface stayed consistent across the expansion, not that the research model improved.

## Warning comparison

Recurring warning types:

- Away starting pitcher unavailable
- Feature coverage below abstention threshold
- Game postponed/skipped style warnings
- Home starting pitcher unavailable
- STARTING_PITCHERS_UNAVAILABLE
- TEAM_ONLY_RESEARCH

Medium01 warning types that were new or more explicit relative to earlier runs:

- Both starting pitchers unavailable
- Game cancelled, skipped before prediction
- Game suspended, skipped before prediction
- Missing away probable pitcher
- Missing away team profile
- Missing home probable pitcher
- Missing home team profile

Treat these as coverage/data-quality observations, not predictive-performance findings.

## Checklist assessment

Reference: docs/historical-coverage-comparison-checklist.md

- source remained fixture
- no source=live
- no real API
- construction remained BOTH
- comparisonIncluded remained true
- evidence included/excluded domains were recorded
- warning and abstention rates were recorded
- generated artifacts were not committed
- modelProbability remained absent/null/not available
- TEAM_ONLY continued to exclude pitcher evidence
- no stop conditions were triggered in medium01 according to its run log

## Interpretation

Medium01 expanded the fixture-only window to 30 requested dates while preserving the same evidence-domain surface and BOTH comparison structure.
Warning volume increased with the larger window, while warning rate decreased from 2.21 to 2.03.
Abstention rate decreased from 0.93 to 0.57.

Do not claim that this means the research model is better.
Do not recommend live/API usage.
Do not recommend model calibration yet unless framed as future separate work after more fixture review.

## Decision

Result: compare before expand

- medium01 is stable enough to document and compare
- next safe step should be another documentation/checklist review or a carefully planned next fixture-only expansion
- do not move to live/API
- do not use generated artifacts as committed source material by default

## Recommended next safe action

- create a documentation-only plan for the next fixture-only expansion, possibly large01, only after reviewing the small01 -> medium01 comparison
- consider a possible next window of 2024-06-01 through 2024-07-31 or another conservative fixture-only range, but do not execute it in this phase
- keep the next phase planning-only unless explicitly authorized to execute a fixture-only export
