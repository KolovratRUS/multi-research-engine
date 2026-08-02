# MLB v1 Held-Out Test Evaluation and Model Release Implementation

## 1. Phase status

Phase 8I implementation is complete and pending ChatGPT review, commit, and push.

## 2. Locked baseline

Phase 8I is built on baseline commit `6a5887afe098c8f8b6ca7e38d660bb9eef83e812` (Implement MLB deterministic logistic regression fit validation).

## 3. Purpose

Phase 8I implements a provider-neutral, odds-blind, pure deterministic held-out TEST evaluation and offline model-release-candidate boundary.

## 4. Architecture position

The safe sequence is:

validated Phase 8H fit-validation result
+
validated Phase 8G evaluation plan
+
validated Phase 8F training matrix
→ frozen-model TEST-only aggregate evaluation
→ offline model-release-candidate record
→ future Phase 8J pure offline pregame inference

## 5. Permanent odds-blind boundary

The Multi Research Engine remains completely odds-blind. No sportsbook odds, prices, moneylines, spreads, totals, props, implied probabilities, market consensus, market movement, line shopping, value, edge, expected payout, Kelly calculations, bookmaker identifiers, betting-market payloads, recommendations, selections, multis, stakes, or grading output appear anywhere in Phase 8I.

## 6. Authorized scope

Only these four files are authorized for Phase 8I:

- `README.md`
- `docs/mlb-v1-held-out-test-evaluation-model-release-implementation.md`
- `src/prediction/mlb/mlb-model-test-release-contract.ts`
- `tests/prediction/mlb/mlb-model-test-release-contract.test.ts`

## 7. Contract versions

- `mlb-model-test-evaluation-v1`
- `mlb-model-release-v1`
- `mlb-model-test-release-result-v1`

## 8. Input validation boundaries

Phase 8I validates the Phase 8H result through `validateMLBModelFitValidationResult`, the Phase 8G plan through `validateMLBModelEvaluationPlan`, and the Phase 8F matrix through `validateMLBTrainingMatrix`. No proposed root is accessed before its public validation succeeds.

## 9. Frozen model boundary

Phase 8I uses the exact frozen model parameters from Phase 8H. It does not initialize, update, calculate gradients, apply regularization, run an optimization loop, alter convergence metadata, alter the final training objective, refit, or calibrate probabilities.

## 10. Test evaluation contract

The `MLBModelTestEvaluation` is a readonly type with exact fields: `contractVersion`, `sport`, `target`, `targetEncoding`, `evaluationId`, `modelId`, `planId`, `matrixId`, `configId`, `split`, `rowCount`, `metrics`. It contains no rows, vectors, targets, labels, scores, winners, probabilities, predictions, thresholds, confusion matrices, or validation/train rows.

## 11. Test metric contract

The `MLBTestMetricValues` is a readonly type with exact fields: `logLoss`, `brierScore`, `rocAuc`. Each value must be a finite number in the expected range. No negative zero is permitted. No row-level metric, probability, prediction, or threshold array exists.

## 12. Release-candidate record

The `MLBModelReleaseRecord` is a readonly type with exact fields: `contractVersion`, `sport`, `target`, `targetEncoding`, `releaseId`, `modelId`, `planId`, `matrixId`, `configId`, `manifestId`, `datasetId`, `algorithm`, `validationEvaluationId`, `testEvaluationId`, `configurationLockStatus`, `testEvaluationPolicy`, `releaseStatus`. The release status is `OFFLINE_RELEASE_CANDIDATE_NOT_DEPLOYED`. The record contains no coefficients, intercept, rows, vectors, targets, labels, predictions, probabilities, deployment endpoint, database record, recommendation, multi, stake, or grading.

## 13. Combined test-release result

The `MLBModelTestReleaseResult` is a readonly type with exact fields: `contractVersion`, `sport`, `target`, `targetEncoding`, `resultId`, `fitValidation`, `test`, `release`. Cross-object consistency requires that root sport, target, and target encoding agree with all nested contracts; `test.modelId === fitValidation.model.modelId`; `test.planId === fitValidation.model.planId`; `test.matrixId === fitValidation.model.matrixId`; `test.configId === fitValidation.model.configId`; release identities agree with the frozen model; release validation-evaluation ID agrees with `fitValidation.validation.evaluationId`; release TEST-evaluation ID agrees with `test.evaluationId`; release algorithm agrees with the frozen model.

## 14. Held-out test policy

The Phase 8G plan must declare `protocol: TRAIN_FIT_VALIDATION_SELECT_TEST_FINAL_V1` and `testSetPolicy: HOLDOUT_UNTIL_CONFIGURATION_LOCKED`. TEST remains completely held out until the configuration is locked.

## 15. Train isolation

After Phase 8F matrix validation succeeds, Phase 8I may read `row.split` for every row. For TRAIN rows, Phase 8I must not ordinarily read `row.vector`, `row.targetValue`, `row.label`, `row.homeRuns`, `row.awayRuns`, or `row.winnerTeamId`.

## 16. Validation isolation

For VALIDATION rows, Phase 8I must not ordinarily read `row.vector`, `row.targetValue`, `row.label`, `row.homeRuns`, `row.awayRuns`, or `row.winnerTeamId`.

## 17. Test-only evaluation

Only TEST rows may influence TEST row count, TEST LOG_LOSS, TEST BRIER_SCORE, and TEST ROC_AUC. TRAIN and VALIDATION must not influence these metrics.

## 18. Feature-schema verification

The first validated TEST row's ordered `vector.values[].featureId` is used as the matrix schema observed by Phase 8I. It must exactly equal `evaluationPlan.featureIds`, `fitValidation.model.featureIds`, and `fitValidation.model.coefficients[].featureId` in count, order, and IDs.

## 19. Feature and missing-indicator treatment

For each feature in the exact model order, Phase 8I uses the raw finite feature value and the `wasMissing` flag encoded as `1` for true and `0` for false. Each model coefficient record contributes `valueCoefficient × raw value + missingIndicatorCoefficient × missing flag`. No scaling, centering, normalization, clipping, bucketing, interactions, or reordering is performed.

## 20. Stable sigmoid and log loss

Phase 8I uses a numerically stable sigmoid: for non-negative scores, `1 / (1 + exp(-score))`; for negative scores, `exp(score) / (1 + exp(score))`. Log loss clamps only the internal probability supplied to the logarithm to `[1e-15, 1 - 1e-15]`.

## 21. ROC AUC definition

TEST ROC_AUC is calculated using deterministic positive-negative pair comparison. For every TEST positive row and every TEST negative row, add `1` when positive probability is greater than negative probability, `0.5` when exactly equal, and `0` when lower. Divide by positive count × negative count.

## 22. Numerical safety

At every TEST calculation boundary, non-finite values are rejected: linear scores, sigmoid intermediates, probabilities, log-loss components, Brier components, metric accumulators, and final metrics. The result is `NUMERICAL_FAILURE`. No partial TEST evaluation or release result is returned.

## 23. Source identity preservation

Strict identifiers must be actual strings, non-empty, already trimmed, and contain no U+0000 through U+001F character. No silent trimming, case normalization, Unicode normalization, or locale-dependent comparison is performed.

## 24. Cross-contract consistency

Before TEST evaluation, Phase 8I verifies fit-validation result and evaluation plan agreement (model plan ID, matrix ID, config ID, manifest ID, dataset ID, algorithm, sport, target, target encoding), evaluation plan and training matrix agreement (matrix ID, manifest ID, dataset ID, sport, target, target encoding, split policy values, split counts, total rows), and holdout declarations (protocol and testSetPolicy).

## 25. Structural prediction minimization

At every new Phase 8I proposed-contract level, Phase 8I supports ordinary plain objects and null-prototype plain objects. It rejects arrays where objects are required, custom class instances, own symbol properties, unknown own string properties, non-enumerable unknown fields, getter-only accessors, setter-only accessors, and getter-plus-setter accessors.

## 26. Descriptor safety

Phase 8I never invokes user-defined getters or setters during proposed-contract validation. It never mutates, trims, sorts, freezes, or normalizes a proposed object.

## 27. Exact field enforcement

Phase 8I uses `MISSING_FIELD` for absent required own properties, `INVALID_JSON_VALUE` for accessors or structurally unsafe JSON-like values, `UNKNOWN_FIELD` for unknown fields unless a narrower prohibited concept applies, and `PROHIBITED_CONCEPT` for prohibited output concepts.

## 28. Odds-contamination integration

The Phase 8B firewall runs against the complete original proposed TEST evaluation, the complete original proposed release record, the complete original proposed combined TEST-release result, and the newly generated combined TEST-release result before builder success. Actual contamination maps to `ODDS_CONTAMINATION`. An uninspectable accessor/firewall traversal failure maps to `INVALID_JSON_VALUE`.

## 29. Exact test coverage

Exactly 20 explicit `it(...)` tests cover the Phase 8I boundary. There are no `it.each`, `test.each`, dynamic registration, skipped tests, `any`, TypeScript suppression comments, debug output, or private-helper exports.

## 30. Deferred work

Phase 8I does not implement live inference, inference routes, probability-serving APIs, predicted-winner APIs, provider adapters, live ingestion, scheduled evaluation, model persistence, production model registration, database work, recommendation generation, multis, staking, grading, UI, or deployment.

## 31. Recommended next phase

Phase 8J — Implement pure offline MLB pregame inference from a released model, validated feature manifest, and canonical pregame snapshot without routes, recommendations, multis, or staking.
