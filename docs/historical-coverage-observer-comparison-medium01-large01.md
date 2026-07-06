# Historical Coverage Observer Comparison — medium01 to large01

Documentation-only comparison.
No export was executed in this phase.
No generated artifacts were created or retained.
This is an operational/data-coverage comparison, not a model-quality or predictive-performance claim.

## Source documents

- docs/historical-coverage-run-log-medium01.md
- docs/historical-coverage-run-log-large01.md
- docs/historical-coverage-observer-comparison-small01-medium01.md
- docs/historical-coverage-comparison-checklist.md
- docs/historical-coverage-run-plan-large01.md
- docs/historical-dataset-coverage-plan.md

## Scope

- source: fixture only
- construction: BOTH
- windows:
  - medium01: 2024-06-01 through 2024-06-30
  - large01: 2024-06-01 through 2024-07-31
- no live source
- no real API
- artifacts uncommitted
- modelProbability remains absent, null, or not available until calibrated

## Baseline metrics

| Metric | smoke01 | small01 | medium01 | large01 |
|---|---|---|---|---|
| requested dates | 7 | 14 | 30 | 61 |
| predictions | 4 | 7 | 17 | 17 |
| abstentions | 6 | 13 | 17 | 17 |
| warnings | 16 | 31 | 61 | 61 |
| prediction rate | 0.57 | 0.50 | 0.57 | 0.28 |
| abstention rate | 0.86 | 0.93 | 0.57 | 0.28 |
| warning rate | 2.29 | 2.21 | 2.03 | 1.00 |
| comparisonIncluded | true | true | true | true |
| construction | BOTH | BOTH | BOTH | BOTH |
| artifacts uncommitted | yes | yes | yes | yes |

## Delta summary

Compare medium01 -> large01:

- requested dates: +31
- predictions: +0
- abstentions: +0
- warnings: +0
- prediction rate: -0.29
- abstention rate: -0.29
- warning rate: -1.03

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
- Both starting pitchers unavailable
- Feature coverage below abstention threshold
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

The large01 run log repeated the same warning surface as medium01.

Treat these as coverage/data-quality observations, not predictive-performance findings.

## Important observation

The large01 window increased requested dates from 30 to 61, but predictions, abstentions, and warnings stayed flat at 17, 17, and 61 respectively.

Frame this conservatively:

- It may indicate fixture coverage limits in the added July range.
- It may indicate fixture data shape or available game coverage in the fixture dataset.
- It should be investigated before expanding further.
- It does not mean the model improved or degraded.
- It does not authorize live/API usage.

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
- no stop conditions were triggered in large01 according to its run log
- the flat counts despite a larger requested window should be treated as a follow-up investigation item, not a stop condition unless future review shows it is caused by a defect

## Interpretation

Large01 expanded the fixture-only window to 61 requested dates while preserving the same evidence-domain surface and BOTH comparison structure.

Raw counts stayed flat compared with medium01.
Rates decreased because the denominator increased while counts stayed flat.

Do not claim that this means the research model is better.
Do not recommend live/API usage.
Do not recommend model calibration yet unless framed as future separate work after more fixture review.

## Decision

Result: hold expansion and investigate fixture coverage shape before next scale-up.

Rationale:

- large01 is stable enough to document and compare
- flat counts across a larger requested window should be understood before another expansion
- next safe step should be a documentation-only fixture coverage-shape investigation or a carefully scoped fixture-only diagnostic
- do not move to live/API
- do not use generated artifacts as committed source material by default

## Recommended next safe action

Document a fixture-only investigation of why large01 counts stayed flat against medium01. Inspect fixture date coverage and run-selection behavior using existing fixture data only.

The next phase should remain planning-only or fixture-only diagnostic only; no live/API usage.

## Sign-off

- Reviewer: Sam / pending
- Review date:
- Approved for next coverage step: pending
