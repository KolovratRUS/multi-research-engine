# MLB v1 Offline Multi-Risk Guidance Implementation

## 1. Phase status

Phase 8O implementation is complete and pending ChatGPT review, commit, and push.

## 2. Locked baseline

4fd966484f99d905b0e41114da4ab5676d461619

## 3. Purpose

Phase 8O converts a validated Phase 8N multi-recommendation set into deterministic offline MLB multi-risk guidance entries. It does not rerun inference. It does not rebuild Phase 8J, 8K, 8L, 8M, or 8N artifacts.

## 4. Architecture position

Phase 8O is downstream of Phase 8N. Its only production input is a validated `MLBOfflineMultiRecommendationSet` produced by Phase 8N. Phase 8O does not invoke the Phase 8J inference builder. Phase 8O does not invoke the Phase 8K prediction-slate builder. Phase 8O does not invoke the Phase 8L recommendation-set builder. Phase 8O does not invoke the Phase 8M candidate-set builder.

## 5. Permanent odds-blind boundary

Phase 8O must remain permanently odds-blind.

Prohibited inputs and concepts include:
- sportsbook odds;
- sportsbook prices;
- betting lines;
- implied probability derived from odds;
- market consensus;
- market movement;
- line shopping;
- value or edge calculations;
- expected payout;
- payout optimization;
- odds-derived confidence;
- odds-derived selection;
- sportsbook availability.

Allowed model-derived outputs include:
- model probabilities;
- predicted winners;
- single-pick recommendations;
- multi-candidate sets;
- selected recommendations;
- confidence/risk staking guidance;
- abstract integer risk units;
- future grading and performance tracking.

## 6. Authorized four-file scope

Exactly these four files are authorized:
1. README.md
2. docs/mlb-v1-offline-multi-risk-guidance-implementation.md
3. src/prediction/mlb/mlb-offline-multi-risk-guidance-contract.ts
4. tests/prediction/mlb/mlb-offline-multi-risk-guidance-contract.test.ts

No other repository file may change.

## 7. Public API and imports

The production source exports exactly these seven declarations:
1. MLB_OFFLINE_MULTI_RISK_GUIDANCE_SET_CONTRACT_VERSION
2. MLB_OFFLINE_MULTI_RISK_GUIDANCE_POLICY
3. MLBOfflineRiskGuidanceEntry
4. MLBOfflineMultiRiskGuidanceSet
5. MLBOfflineMultiRiskGuidanceSetIssue
6. validateMLBOfflineMultiRiskGuidanceSet
7. buildMLBOfflineMultiRiskGuidanceSet

Its import sources are exactly:
1. ../firewall/odds-contamination-guard
2. ./mlb-offline-multi-recommendation-contract

The shared-firewall import contains exactly:
- assertNoOddsContamination
- isProhibitedOddsBoundaryKey

## 8. Contract version and risk policy

The exact contract version is:
`mlb-offline-multi-risk-guidance-set-v1`

The exact risk policy is:
`MODEL_CONFIDENCE_CONCENTRATION_RISK_UNITS_V1`

Required set literals:
- contractVersion: `mlb-offline-multi-risk-guidance-set-v1`
- sport: MLB
- target: OFFICIAL_FINAL_GAME_WINNER
- targetEncoding: HOME_WIN_1_AWAY_WIN_0
- algorithm: L2_LOGISTIC_REGRESSION_BINARY_V1
- decisionPolicy: HOME_AT_OR_ABOVE_0_5_V1
- policy: MODEL_CONFIDENCE_CONCENTRATION_RISK_UNITS_V1

## 9. Embedded Phase 8N source boundary

The builder accepts one `unknown` input representing a proposed Phase 8N multi-recommendation set. The conceptual input path is `$.multiRecommendationSet`. The exact first operation is `validateMLBOfflineMultiRecommendationSet`. If the Phase 8N validator fails, the builder returns exactly one issue:
- code: SOURCE_MULTI_RECOMMENDATION_SET_INVALID
- path: $.multiRecommendationSet

`sourceMultiRecommendationSet` embeds the complete validated Phase 8N multi-recommendation set.

It does not leak nested Phase 8N issues. It does not return partial guidance entries.

## 10. Root artifact fields

`MLBOfflineMultiRiskGuidanceSet` must contain exactly these fields in this order:
1. contractVersion
2. sport
3. target
4. targetEncoding
5. riskGuidanceSetId
6. multiRecommendationSetId
7. policy
8. algorithm
9. decisionPolicy
10. officialDate
11. sourceMultiRecommendationSet
12. guidanceEntryCount
13. guidanceEntryIds
14. guidanceEntries
15. portfolioTotalRiskUnits

## 11. Guidance-entry fields

`MLBOfflineRiskGuidanceEntry` must contain exactly these fields in this order:
1. guidanceEntryId
2. candidateId
3. selectedRecommendationId
4. legCount
5. minimumLegConfidence
6. meanLegConfidence
7. modelConfidence
8. modelUncertainty
9. baseRiskUnits
10. sharedRecommendationIds
11. overlapAdjustmentUnits
12. portfolioCapAdjustmentUnits
13. recommendedRiskUnits

## 12. Minimum-confidence bands

Minimum-confidence bands are derived by exact direct comparison against the validated Phase 8M `minimumLegConfidence` value. No epsilon, rounding, or normalization is applied.

| minimumLegConfidence | baseRiskUnits |
|----------------------|---------------|
| [0.5, 0.59)          | 1             |
| [0.6, 0.69)          | 2             |
| [0.7, 0.79)          | 3             |
| [0.8, 0.89)          | 4             |
| [0.9, 1.0]           | 5             |

## 13. Mean-confidence bonus

When `meanLegConfidence >= 0.8`, exactly one bonus unit is added to the minimum-confidence band. The maximum mean-confidence bonus is one unit.

## 14. Leg-count penalty

When `legCount == 3`, exactly one unit is subtracted. The penalty is applied after the mean-confidence bonus. Maximum uncertainty is never double-counted.

## 15. Base risk units

```
baseRiskUnits = band(minimumLegConfidence) + meanBonus(meanLegConfidence) - legPenalty(legCount)
```

`band(0.75)` for a two-leg candidate is `3`.
`band(0.90)` for a two-leg candidate is `5`.
`band(0.75)` for a three-leg candidate is `2` after the one-unit penalty.

## 16. Maximum-uncertainty redundancy

Maximum uncertainty is never subtracted twice. The three-leg penalty subtracts one unit from the base. No additional uncertainty-based reduction is applied.

## 17. Incremental overlap ownership

`sharedRecommendationIds` are derived incrementally in JavaScript code-unit order. For each source candidate, the shared recommendation IDs are the IDs of earlier selected recommendations in source order that share a `gameId` with the current candidate. The count of shared recommendation IDs equals the number of overlapping games with earlier selected recommendations.

`overlapAdjustmentUnits` equals the count of shared recommendation IDs for that entry. The adjustment is applied only to later source entries.

## 18. Portfolio-cap adjustment

`portfolioTotalRiskUnits` is the sum of `recommendedRiskUnits` across all guidance entries. The portfolio cap is `6`. When the total exceeds `6`, Phase 8O reduces higher-index-first entries until the total is within the cap. The reduction is applied to `recommendedRiskUnits` and `portfolioCapAdjustmentUnits` records the amount reduced for that entry. A root `portfolioTotalRiskUnits` value above `6` produces a `PORTFOLIO_CAP_VIOLATION` issue at `$.portfolioTotalRiskUnits`.

## 19. Recommended-risk-unit calculation

```
preCapUnits = baseRiskUnits + overlapAdjustmentUnits
portfolioCapAdjustmentUnits = max(0, totalBeforeCap - 6) when index is selected for reduction, else 0
recommendedRiskUnits = preCapUnits - portfolioCapAdjustmentUnits
```

## 20. Empty and cardinality behavior

A valid source with zero selected recommendations produces a valid empty risk-guidance set:
- guidanceEntryCount = 0
- guidanceEntryIds = []
- guidanceEntries = []
- portfolioTotalRiskUnits = 0

When the proposed guidance entries do not cover the exact selected-recommendation universe, Phase 8O produces a `GUIDANCE_COMPLETENESS_MISMATCH` issue at `$.guidanceEntries`.

## 21. Zero-unit behavior

Zero-unit identities and references are preserved exactly. A zero `baseRiskUnits`, `overlapAdjustmentUnits`, or `recommendedRiskUnits` does not suppress the entry. The guidance entry remains present when structurally valid.

## 22. Identity formulas

`riskGuidanceSetId = multiRecommendationSetId + "::offline-multi-risk-guidance-set-v1"`

`guidanceEntryId = riskGuidanceSetId + "::" + candidateId + "::offline-risk-guidance-entry-v1"`

Deterministic identity does not use:
- hash;
- randomness;
- UUID;
- current timestamp;
- locale comparison.

## 23. Exact reference preservation

Phase 8O preserves the exact Phase 8N source root reference. It preserves exact Phase 8N selected recommendation references inside newly allocated guidance-entry objects. It does not copy, clone, or reconstruct selected recommendation objects. The exact reference boundary means no deep clone of upstream data is performed.

## 24. Structural-clone validation

Public validation accepts structural clone inputs. The validator does not require the exact same object reference. It compares field values, counts, and identities. The builder returns no partial output.

## 25. Descriptor safety and deterministic issues

Never access a proposed property before confirming it is an own data property. Use own-property descriptors. Do not invoke root getters, root setters, source set getters, selected-recommendation getters, candidate getters, leg getters, or entry getters. A proposed Proxy may expose reflective traps. Return a deterministic issue rather than leaking an unexpected exception where safe handling is possible.

Issues are sorted by path then code using deterministic JavaScript code-unit comparison.

## 26. Odds-contamination and prohibited concepts

Phase 8O uses the shared firewall. The root boundary helper `isProhibitedOddsBoundaryKey` owns descriptor-safe root own-property names. Recursive `assertNoOddsContamination` owns globally unambiguous contamination.

Root odds contamination collapses to:
- code: ODDS_CONTAMINATION
- path: $
- message: Odds contamination detected

Root `stake` and `grade` remain Phase 8O-owned:
- code: PROHIBITED_CONCEPT
- path: $.stake
- message: Prohibited concept detected

Root `grade` remains Phase 8O-owned:
- code: PROHIBITED_CONCEPT
- path: $.grade
- message: Prohibited concept detected

Unsupported non-firewall-owned root fields remain:
- code: UNKNOWN_FIELD
- path: exact root path
- message: Unknown field: <key>

Dependent guidance semantics are not evaluated when an extra root field already owns the proposal failure.

The actual shared-firewall ownership matrix for root keys:

| Key               | Ownership                                 |
|-------------------|-------------------------------------------|
| `sportsbook`      | ODDS_CONTAMINATION at $                   |
| `odds`            | ODDS_CONTAMINATION at $                   |
| `price`           | ODDS_CONTAMINATION at $                   |
| `line`            | ODDS_CONTAMINATION at $                   |
| `market`          | ODDS_CONTAMINATION at $                   |
| `edge`            | ODDS_CONTAMINATION at $                   |
| `value`           | ODDS_CONTAMINATION at $                   |
| `payout`          | ODDS_CONTAMINATION at $                   |
| `profit`          | ODDS_CONTAMINATION at $                   |
| `stake`           | PROHIBITED_CONCEPT at $.stake             |
| `grade`           | PROHIBITED_CONCEPT at $.grade             |
| `bankroll`        | UNKNOWN_FIELD at $.bankroll               |
| `currency`        | UNKNOWN_FIELD at $.currency               |
| `monetaryStake`   | UNKNOWN_FIELD at $.monetaryStake          |
| `return`          | UNKNOWN_FIELD at $.return                 |
| `route`           | UNKNOWN_FIELD at $.route                  |
| `ui`              | UNKNOWN_FIELD at $.ui                     |
| `persistence`     | UNKNOWN_FIELD at $.persistence            |

## 27. Test inventory

Exactly 20 explicit `it(...)` tests cover the boundary:
1. accepts a minimal valid risk-guidance set and returns the exact original reference
2. validates exact root fields, literals, source lineage, policy, counts, and deterministic risk-guidance-set identity
3. validates the embedded Phase 8N multi-recommendation set before guidance semantics
4. validates the exact seven-field guidance-entry shape and selected-candidate membership
5. validates descriptor-safe roots, arrays, embedded sources, guidance entries, symbols, classes, and accessors without invoking getters
6. maps an invalid Phase 8N builder source to one SOURCE_MULTI_RECOMMENDATION_SET_INVALID issue without partial output or pre-validation access
7. builds a valid empty risk-guidance set when the source has no selected recommendations
8. builds exactly one guidance entry for one selected recommendation
9. builds exactly two guidance entries in source order for two selected recommendations
10. applies exact minimum-confidence bands and mean-confidence bonuses at every boundary
11. applies the exact three-leg penalty without double-counting maximum uncertainty
12. derives exact incremental shared recommendation IDs in JavaScript code-unit order
13. applies exact overlap adjustment only to later source entries
14. applies the exact portfolio cap and higher-index-first reduction
15. derives deterministic entry IDs, root identity, and guidance-ID-array mapping
16. rejects duplicate guidance identities, count mismatches, order mismatches, and set-ID mismatches with exact ownership
17. proves exact one-entry-per-selected-recommendation completeness
18. accepts structural clones and preserves exact builder references without mutation
19. rejects odds contamination and prohibited concepts while classifying unsupported fields as unknown and allowing risk-unit vocabulary
20. verifies exact exports and imports, no upstream rebuilding, no money, no routes, no UI, no persistence, no current time, no randomness, and no network access

No `it.each`, `test.each`, dynamic test registration, skipped tests, `any` type, TypeScript suppression comments, production-contract fixture casts, debug output, or filesystem writes are used.

## 28. Non-goals and deferred work

Phase 8O does not:
- select final multi recommendations;
- calculate stakes;
- grade outcomes;
- persist output;
- register guidance;
- add routes;
- add UI;
- use sportsbook prices;
- use implied probability;
- use market comparison;
- use value or edge;
- calculate payout or joint probability.

## 29. Recommended Phase 8P

Phase 8P — Implement deterministic timestamped MLB recommendation bundle composition from validated single-pick, multi-recommendation, and risk-guidance artifacts without routes, UI, grading, or persistence.
