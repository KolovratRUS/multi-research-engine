# MLB v1 Offline Multi-Candidate Implementation

## 1. Phase status

Phase 8M implementation is complete and pending ChatGPT review, commit, and push.

## 2. Locked baseline

cbc1ea4a7da90dc5f757b545edc19bb8843dd4b6

## 3. Purpose

Phase 8M converts a validated Phase 8L single-pick recommendation set into deterministic offline MLB multi-candidate sets. It does not rerun inference. It does not rebuild Phase 8J, 8K, or 8L artifacts.

## 4. Architecture position

Phase 8M is downstream of Phase 8L. Its only production input is a validated `MLBOfflineSinglePickRecommendationSet` produced by Phase 8L. Phase 8M does not invoke the Phase 8J inference builder. Phase 8M does not invoke the Phase 8K prediction-slate builder. Phase 8M does not invoke the Phase 8L recommendation-set builder.

## 5. Permanent odds-blind boundary

Phase 8M must remain permanently odds-blind.

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
- model confidence;
- model uncertainty;
- multi-candidate sets;
- future confidence/risk staking;
- future grading and performance tracking.

## 6. Authorized scope

The final Phase 8M repository scope contains exactly these six files:

1. `README.md`

2. `docs/mlb-v1-offline-multi-candidate-implementation.md`

3. `src/prediction/firewall/odds-contamination-guard.ts`

4. `tests/prediction/firewall/odds-contamination-guard.test.ts`

5. `src/prediction/mlb/mlb-offline-multi-candidate-contract.ts`

6. `tests/prediction/mlb/mlb-offline-multi-candidate-contract.test.ts`

No other repository file is part of the Phase 8M change set.

## 7. Public API and imports

The production source exports exactly these nine declarations:
1. MLB_OFFLINE_MULTI_CANDIDATE_SET_CONTRACT_VERSION
2. MLB_OFFLINE_MULTI_CANDIDATE_POLICY
3. MLB_OFFLINE_MULTI_CANDIDATE_ORDER_POLICY
4. MLBOfflineMultiCandidateLeg
5. MLBOfflineMultiCandidate
6. MLBOfflineMultiCandidateSet
7. MLBOfflineMultiCandidateSetIssue
8. validateMLBOfflineMultiCandidateSet
9. buildMLBOfflineMultiCandidateSet

Its import sources are exactly:
1. ../firewall/odds-contamination-guard
2. ./mlb-offline-single-pick-recommendation-contract

`MLBOfflineMultiCandidateLeg` is an exact alias of the Phase 8L `MLBOfflineSinglePickRecommendation` type.

## 8. Contract versions and policies

The exact contract version is:
`mlb-offline-candidate-set-v1`

The exact candidate policy is:
`ALL_UNORDERED_2_AND_3_LEG_COMBINATIONS_V1`

The exact candidate order policy is:
`MINIMUM_CONFIDENCE_DESC_MEAN_CONFIDENCE_DESC_LEG_COUNT_ASC_CANDIDATE_ID_ASC_V1`

Required set literals:
- contractVersion: `mlb-offline-candidate-set-v1`
- sport: MLB
- target: OFFICIAL_FINAL_GAME_WINNER
- targetEncoding: HOME_WIN_1_AWAY_WIN_0
- algorithm: L2_LOGISTIC_REGRESSION_BINARY_V1
- decisionPolicy: HOME_AT_OR_ABOVE_0_5_V1
- sourceRecommendationPolicy: ALL_VALIDATED_PREDICTIONS_V1
- candidatePolicy: ALL_UNORDERED_2_AND_3_LEG_COMBINATIONS_V1
- orderPolicy: MINIMUM_CONFIDENCE_DESC_MEAN_CONFIDENCE_DESC_LEG_COUNT_ASC_CANDIDATE_ID_ASC_V1

## 9. Source recommendation-set boundary

The builder accepts one `unknown` input representing a proposed Phase 8L recommendation set. The conceptual input path is `$.recommendationSet`. The exact first operation is `validateMLBOfflineSinglePickRecommendationSet`. If the Phase 8L validator fails, the builder returns exactly one issue:
- code: SOURCE_RECOMMENDATION_SET_INVALID
- path: $.recommendationSet

It does not leak nested Phase 8L issues. It does not return partial candidates.

## 10. Candidate-set identity

candidateSetId = recommendationSetId + "::offline-candidate-set-v1"

Deterministic identity does not use:
- hash;
- randomness;
- UUID;
- current timestamp;
- locale comparison.

## 11. Source recommendation ID universe

The candidate-set builder accepts every valid Phase 8L recommendation. No recommendation is filtered, suppressed, or abstained. recommendationCount must exactly equal recommendations.length.

## 12. Candidate identity

1. Sort candidate recommendation IDs using ascending JavaScript code-unit comparison.
2. Encode each ID as: `${stringLength}:${recommendationId}`
3. Join encoded IDs using: `|`
4. Construct: recommendationSetId + "::" + legCount + "::" + encodedRecommendationIds + "::offline-candidate-v1"

`candidateId` is deterministically derived from the candidate leg recommendation-ID combination.

Repeated valid candidate combination therefore repeats candidate identity.

Phase 8M reports that collision as `DUPLICATE_CANDIDATE_ID`.

Phase 8M does not emit `DUPLICATE_CANDIDATE_COMBINATION`.

Phase 8M does not emit `DUPLICATE_LEG_INFERENCE_ID`.

## 13. Exhaustive candidate policy

Two-leg count: n × (n - 1) ÷ 2

Three-leg count: n × (n - 1) × (n - 2) ÷ 6

Total examples:
- n=1 → 0
- n=2 → 1
- n=3 → 4
- n=4 → 10
- n=5 → 20

## 14. One-source empty behavior

One valid source recommendation produces a valid empty candidate array.

## 15. Two-leg combinations

For every pair of distinct valid source recommendations, Phase 8M constructs exactly one unordered two-leg candidate.

## 16. Three-leg combinations

For every triple of distinct valid source recommendations, Phase 8M constructs exactly one unordered three-leg candidate.

## 17. Candidate completeness formula

candidateCount = C(n,2) + C(n,3)

where C(n,k) is the binomial coefficient and n is sourceRecommendationCount.

## 18. Exact recommendation-reference preservation

Phase 8M preserves exact Phase 8L recommendation object references inside newly allocated candidate-leg arrays. It does not copy, clone, or reconstruct recommendation objects.

## 19. Candidate-leg ordering

Candidate legs are ordered by:
1. gameId ascending using deterministic JavaScript code-unit comparison
2. when game IDs are equal, snapshotId ascending
3. when game and snapshot IDs are equal, inferenceId ascending

## 20. Minimum confidence

minimumLegConfidence is the exact minimum selected-side confidence across all legs in the candidate.

Validated Phase 8L selected-side confidence is at least `0.5`.

## 21. Mean confidence

meanLegConfidence is the arithmetic mean of selected-side confidence across all legs in the candidate.

mean confidence is not a calibrated joint probability.

## 22. Maximum uncertainty

maximumLegUncertainty is the exact maximum leg uncertainty across all legs in the candidate.

## 23. Candidate ordering

Candidates are ordered by:
1. minimumLegConfidence descending
2. when minimum confidence is equal, meanLegConfidence descending
3. when mean confidence is equal, legCount ascending
4. when leg count is equal, candidateId ascending using deterministic JavaScript code-unit comparison

## 24. Duplicate protections

Duplicate source recommendation ID:
DUPLICATE_SOURCE_RECOMMENDATION_ID

Duplicate candidate identity:
DUPLICATE_CANDIDATE_ID

Duplicate recommendation identity within a candidate:
`DUPLICATE_LEG_RECOMMENDATION_ID`

Distinct recommendation identities sharing a game:
`DUPLICATE_LEG_GAME_ID`

Repeated valid combination collapses to repeated candidate identity.

`DUPLICATE_CANDIDATE_COMBINATION` is not emitted.

`DUPLICATE_LEG_INFERENCE_ID` is not emitted.

`DUPLICATE_LEG_SNAPSHOT_ID` is not emitted.

Dependent candidate identity, summary, count, order, or completeness issues are suppressed when their only cause is an already-owned duplicate-leg defect.

## 25. Count contracts

sourceRecommendationCount must be:
- a finite safe integer
- non-negative
- not negative zero
- exactly equal to sourceRecommendationIds.length
- exactly equal to recommendations.length

candidateCount must be exactly equal to candidates.length.

## 26. Exact field enforcement

`MLBOfflineMultiCandidateLeg` is an exact alias of the Phase 8L `MLBOfflineSinglePickRecommendation` type.

`MLBOfflineMultiCandidate` must contain exactly these fields in this order:
1. candidateId
2. legCount
3. minimumLegConfidence
4. meanLegConfidence
5. maximumLegUncertainty
6. legs

`MLBOfflineMultiCandidateSet` must contain exactly these fields in this order:
1. contractVersion
2. sport
3. target
4. targetEncoding
5. candidateSetId
6. recommendationSetId
7. slateId
8. releaseId
9. modelId
10. planId
11. matrixId
12. configId
13. manifestId
14. algorithm
15. decisionPolicy
16. officialDate
17. sourceRecommendationPolicy
18. candidatePolicy
19. orderPolicy
20. sourceRecommendationCount
21. sourceRecommendationIds
22. candidateCount
23. candidates

## 27. Descriptor safety

Never access a proposed property before confirming it is an own data property. Use own-property descriptors. Do not invoke root getters, root setters, recommendation-set getters, recommendation getters, probabilities getters, candidate getters, leg getters, or array-index getters. A proposed Proxy may expose reflective traps. Return a deterministic issue rather than leaking an unexpected exception where safe handling is possible.

## 28. Determinism and no mutation

For the same valid source recommendation set, repeated builder calls must produce deeply equal multi-candidate sets. Determinism must not depend on current time, environment, process state, filesystem state, locale, random values, or input mutation.

The builder must not mutate the source recommendation-set root, the source recommendations array, a source recommendation, a source probabilities object, any source identifier, any source probability, or any source date or timestamp. Each candidate must be a newly constructed object. Each candidate leg must be the exact original Phase 8L recommendation reference.

## 29. Odds-contamination integration

The recursive shared firewall retains the exact locked baseline global inventory. `isProhibitedOddsKey` owns globally unambiguous recursive concepts. `isProhibitedOddsBoundaryKey` is a shared context-aware key classifier. Its boundary-only exact normalized keys are `line`, `market`, and `value`.

Phase 8M invokes the boundary helper only on descriptor-safe root own-property names. Phase 8M contains no local duplicate odds vocabulary. `assertNoOddsContamination` continues recursive detection using only the locked global inventory.

Ordinary nested domain data such as `values[].value` remains valid when it contains no betting concept.

Phase 8M root ownership remains:
- sportsbook/odds/price/line/market/edge/value: `ODDS_CONTAMINATION`
- stake/grade: `PROHIBITED_CONCEPT`

## 30. Non-goals and deferred work

Phase 8M does not:
- select final multi recommendations;
- calculate stakes;
- grade outcomes;
- persist output;
- add routes;
- add UI;
- use sportsbook prices;
- use implied probability;
- use market comparison;
- use value or edge;
- calculate payout or joint probability.

## 31. Recommended next phase

Phase 8N — Implement deterministic offline MLB multi recommendation selection from validated multi-candidate sets without staking, routes, or UI.
