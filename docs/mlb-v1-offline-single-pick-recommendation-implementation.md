# MLB v1 Offline Single-Pick Recommendation Implementation

## 1. Phase status

Phase 8L implementation is complete and pending ChatGPT review, commit, and push.

## 2. Locked baseline

731a22b1d16efed670676eb71e805091b251bd38

## 3. Purpose

Phase 8L converts already validated Phase 8K prediction-slate entries into deterministic, odds-independent single-pick recommendations. It does not rerun inference. It does not filter recommendations using sportsbook or market information.

## 4. Architecture position

Phase 8L is downstream of Phase 8K. Its only model input is a validated `MLBOfflinePredictionSlate` produced by Phase 8K. Phase 8L does not invoke the Phase 8J inference builder. Phase 8L does not invoke the Phase 8K prediction-slate builder.

## 5. Permanent odds-blind boundary

Phase 8L must remain permanently odds-blind.

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
- future multi construction;
- future confidence/risk staking;
- future grading and performance tracking.

## 6. Authorized scope

Exactly these four files are authorized:
1. README.md
2. docs/mlb-v1-offline-single-pick-recommendation-implementation.md
3. src/prediction/mlb/mlb-offline-single-pick-recommendation-contract.ts
4. tests/prediction/mlb/mlb-offline-single-pick-recommendation-contract.test.ts

No other repository file may change.

## 7. Public API and imports

The production source exports exactly these eight declarations:
1. MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_SET_CONTRACT_VERSION
2. MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_POLICY
3. MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_ORDER_POLICY
4. MLBOfflineSinglePickRecommendation
5. MLBOfflineSinglePickRecommendationSet
6. MLBOfflineSinglePickRecommendationSetIssue
7. validateMLBOfflineSinglePickRecommendationSet
8. buildMLBOfflineSinglePickRecommendationSet

Its import sources are exactly:
1. ../firewall/odds-contamination-guard
2. ./mlb-offline-prediction-slate-contract

## 8. Contract versions and policies

The exact contract version is:
mlb-offline-single-pick-recommendation-set-v1

The exact recommendation policy is:
ALL_VALIDATED_PREDICTIONS_V1

The exact order policy is:
MODEL_CONFIDENCE_DESC_GAME_ID_ASC_SNAPSHOT_ID_ASC_INFERENCE_ID_ASC_V1

Required set literals:
- contractVersion: mlb-offline-single-pick-recommendation-set-v1
- sport: MLB
- target: OFFICIAL_FINAL_GAME_WINNER
- targetEncoding: HOME_WIN_1_AWAY_WIN_0
- algorithm: L2_LOGISTIC_REGRESSION_BINARY_V1
- decisionPolicy: HOME_AT_OR_ABOVE_0_5_V1
- recommendationPolicy: ALL_VALIDATED_PREDICTIONS_V1
- orderPolicy: MODEL_CONFIDENCE_DESC_GAME_ID_ASC_SNAPSHOT_ID_ASC_INFERENCE_ID_ASC_V1

## 9. Source prediction-slate boundary

The builder accepts one `unknown` input representing a proposed Phase 8K prediction slate. The conceptual input path is `$.predictionSlate`. The exact first operation is `validateMLBOfflinePredictionSlate`. If the Phase 8K validator fails, the builder returns exactly one issue:
- code: SOURCE_SLATE_INVALID
- path: $.predictionSlate

It does not leak nested Phase 8K issues. It does not return partial recommendations.

## 10. Recommendation-set identity

recommendationSetId = slateId + "::offline-single-pick-recommendation-set-v1"

Deterministic identity does not use:
- Date.now
- new Date
- Math.random
- randomUUID
- filesystem timestamps
- process time
- environment variables.

## 11. Recommendation identity

recommendationId = inferenceId + "::offline-single-pick-recommendation-v1"

## 12. One-recommendation-per-prediction policy

Phase 8L emits exactly one single-pick recommendation for every prediction in a valid Phase 8K slate. It must not:
- omit a prediction;
- suppress a prediction;
- abstain;
- apply a minimum-confidence threshold;
- apply a maximum-uncertainty threshold;
- apply a daily recommendation limit;
- prefer a home or away side;
- use sportsbook or market information.

recommendationCount must exactly equal the source Phase 8K predictionCount.

## 13. Exact recommendation derivation

For each source Phase 8K prediction:
- recommendation.inferenceId = prediction.inferenceId
- recommendation.snapshotId = prediction.snapshotId
- recommendation.gameId = prediction.gameId
- recommendation.officialDate = prediction.officialDate
- recommendation.dataCutoffAt = prediction.dataCutoffAt
- recommendation.homeTeamId = prediction.homeTeamId
- recommendation.awayTeamId = prediction.awayTeamId
- recommendation.recommendedSide = prediction.predictedSide
- recommendation.recommendedTeamId = prediction.predictedTeamId
- recommendation.probabilities.homeWinProbability = prediction.probabilities.homeWinProbability
- recommendation.probabilities.awayWinProbability = prediction.probabilities.awayWinProbability

Do not recompute or alter the source probabilities. Do not clamp probabilities. Do not round probabilities. Do not calibrate probabilities. Do not convert probabilities to percentages.

## 14. Probability preservation

The builder preserves all exact source identifiers, teams, dates, cutoffs, sides, teams, and probabilities. It does not modify source probabilities.

## 15. Model confidence

For HOME: modelConfidence = homeWinProbability
For AWAY: modelConfidence = awayWinProbability

Model confidence is the probability of the recommended side.

## 16. Model uncertainty

For HOME: modelUncertainty = awayWinProbability
For AWAY: modelUncertainty = homeWinProbability

Because Phase 8J probabilities are exact complements, modelUncertainty must also equal 1 - modelConfidence.

## 17. Exact 0.5 behavior

An exact 0.5/0.5 prediction remains:
- recommendedSide: HOME
- recommendedTeamId: homeTeamId
- modelConfidence: 0.5
- modelUncertainty: 0.5

Exact 0.5 remains HOME under the locked Phase 8J decision policy.

## 18. Canonical ordering

Recommendations must be ordered by:
1. modelConfidence descending
2. when confidence is equal, gameId ascending using deterministic JavaScript code-unit comparison
3. when game IDs are equal, snapshotId ascending
4. when game and snapshot IDs are equal, inferenceId ascending

Do not use localeCompare, Intl.Collator, platform locale, or input order as a confidence tie-breaker.

The builder must return canonical order regardless of valid source-array order.
The public validator must reject a proposed recommendation set whose recommendations are not already in canonical order.
Use ORDER_MISMATCH for noncanonical order.

## 19. Duplicate recommendation protection

One recommendation set must not contain duplicate:
- recommendationId
- gameId

Use exact issue codes:
- DUPLICATE_RECOMMENDATION_ID
- DUPLICATE_GAME_ID

Report the second conflicting occurrence.

`recommendationId` is deterministically derived from `inferenceId`.
`inferenceId + "::offline-single-pick-recommendation-v1"`.

Repeated inference identity therefore repeats recommendation identity.

Phase 8L reports that collision as `DUPLICATE_RECOMMENDATION_ID`.

Phase 8L does not emit `DUPLICATE_INFERENCE_ID`.

Test 14 proves duplicate inference identity collapses to the locked duplicate recommendation identity.

## 20. Duplicate inference and game protection

The locked Phase 8J inference identity already derives from releaseId and snapshotId. Phase 8L does not reject repeated team IDs. Doubleheaders remain representable through distinct game IDs.

## 21. Recommendation-count contract

recommendationCount must be:
- a finite safe integer
- non-negative
- not negative zero
- exactly equal to recommendations.length

A valid set must contain at least one recommendation.
Use EMPTY_RECOMMENDATION_SET for zero recommendations.
Use RECOMMENDATION_COUNT_MISMATCH when the count does not equal array length.

The builder must also require recommendationCount = source predictionCount.

## 22. Exact field enforcement

`MLBOfflineSinglePickRecommendation` must contain exactly these fields in this order:
1. recommendationId
2. inferenceId
3. snapshotId
4. gameId
5. officialDate
6. dataCutoffAt
7. homeTeamId
8. awayTeamId
9. recommendedSide
10. recommendedTeamId
11. probabilities
12. modelConfidence
13. modelUncertainty

The `probabilities` object must contain exactly these fields in this order:
1. homeWinProbability
2. awayWinProbability

`MLBOfflineSinglePickRecommendationSet` must contain exactly these fields in this order:
1. contractVersion
2. sport
3. target
4. targetEncoding
5. recommendationSetId
6. slateId
7. releaseId
8. modelId
9. planId
10. matrixId
11. configId
12. manifestId
13. algorithm
14. decisionPolicy
15. officialDate
16. recommendationPolicy
17. orderPolicy
18. recommendationCount
19. recommendations

## 23. Descriptor safety

Never access a proposed property before confirming it is an own data property. Use own-property descriptors. Do not invoke root getters, root setters, recommendations-array getters, recommendation getters, probabilities getters, or array-index getters. A proposed Proxy may expose reflective traps. Return a deterministic issue rather than leaking an unexpected exception where safe handling is possible.

## 24. Determinism

For the same valid source slate, repeated builder calls must produce deeply equal recommendation sets. Determinism must not depend on current time, environment, process state, filesystem state, locale, random values, or input mutation.

## 25. No mutation

The builder must not mutate the source prediction-slate root, the source predictions array, a source prediction, a source probabilities object, any source identifier, any source probability, or any source date or timestamp. Each recommendation must be a newly constructed object. Each recommendation probabilities object must be a newly constructed object containing the exact copied probability values.

## 26. Odds-contamination integration

Use the existing locked firewall. Do not copy or reimplement its prohibited-term inventory. Apply the firewall to proposed recommendation-set validation and generated recommendation-set validation. Map recognized sportsbook, odds, market, edge, or value contamination to ODDS_CONTAMINATION. Map prohibited downstream concepts such as multis, stakes, or grading to PROHIBITED_CONCEPT. The successful recommendation set must remain model-derived and odds-independent.

## 27. Prohibited downstream concepts

Phase 8L must not:
- construct multis;
- calculate stakes;
- grade recommendations;
- persist recommendations;
- register recommendations;
- add an API;
- add a route;
- add UI.

## 28. Exact test coverage

Exactly 20 explicit `it(...)` tests cover the boundary. No `it.each`, `test.each`, dynamic test registration, skipped tests, `any` type, TypeScript suppression comments, production-contract fixture casts, debug output, or filesystem writes are used.

## 29. Deferred work

Future phases may add:
- multi-candidate construction
- confidence/risk staking
- grading and performance tracking
- routes and UI

## 30. Non-goals and limitations

Phase 8L does not:
- call a live API
- invoke the Phase 8J inference builder
- invoke the Phase 8K prediction-slate builder
- read a pregame snapshot
- extract a feature vector
- read model coefficients or intercepts
- fit or calibrate a model
- modify source probabilities
- query odds or compare prices
- calculate edge or value
- suppress recommendations based on confidence
- persist or register recommendations

## 31. Recommended next phase

Phase 8M — Implement deterministic offline MLB multi-candidate construction from validated single-pick recommendation sets without staking, routes, or UI.
