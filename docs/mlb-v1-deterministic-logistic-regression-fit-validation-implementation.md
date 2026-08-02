# MLB V1 Deterministic Logistic Regression Fit Validation Implementation

## 1. Phase status

Phase 8H implementation is complete and pending ChatGPT review, commit, and push.

## 2. Locked baseline

Locked baseline: `34118b37e67cc8a2b2d29f77d159ff23cdb5a90a`

Phase 8H builds on the exact source state committed in baseline 34118b37e67cc8a2b2d29f77d159ff23cdb5a90a.

## 3. Purpose

Phase 8H implements pure deterministic L2 logistic-regression fitting.

Configuration, evaluation plan, and training matrix are validated first.

TRAIN alone influences fitting.

VALIDATION alone influences aggregate evaluation.

TEST remains completely held out.

Initialization uses zero coefficients and zero intercept.

Fitting uses deterministic full-batch gradient descent.

Raw values and missing indicators use separate coefficients.

Aggregate validation metrics are LOG_LOSS, BRIER_SCORE, and ROC_AUC.

No row-level probabilities or predictions are returned.

No odds or market inputs are used.

The permanent odds-blind firewall remains active.

## 4. Architecture position

Phase 8H sits between Phase 8F (training-matrix contract) and Phase 8I.

It is the first phase that mutates deterministic internal parameters.

It does not add any live ingestion, persistence, inference route, recommendation, multi, staking, grading, route, or UI.

## 5. Permanent odds-blind boundary

Phase 8H does not import or use any odds, price, market, sportsbook, or Kelly concept.

The Phase 8B firewall remains active.

The Phase 8H source imports only:
- `../firewall/odds-contamination-guard`
- `./mlb-training-matrix-contract`
- `./mlb-model-training-plan-contract`

## 6. Authorized scope

Phase 8H adds exactly these files:
- `src/prediction/mlb/mlb-logistic-regression-fit-contract.ts`
- `tests/prediction/mlb/mlb-logistic-regression-fit-contract.test.ts`
- `docs/mlb-v1-deterministic-logistic-regression-fit-validation-implementation.md`
- `README.md`

Phase 8H performs no live ingestion, persistence, scheduled or production fitting, live inference, probability-serving routes, or UI rendering.

## 7. Contract versions

- Model contract version: `MLB_LOGISTIC_REGRESSION_MODEL_CONTRACT_VERSION`
- Validation evaluation contract version: `MLB_VALIDATION_EVALUATION_CONTRACT_VERSION`
- Fit validation result contract version: `MLB_FIT_VALIDATION_RESULT_CONTRACT_VERSION`

All three contracts are versioned constants exported from `mlb-logistic-regression-fit-contract.ts`.

## 8. Input validation boundaries

Phase 8H accepts three root inputs:
- `MLBModelTrainingConfiguration`
- `MLBModelEvaluationPlan`
- `MLBTrainingMatrix`

Each root is validated through its locked public validator before any access.

Invalid roots map to one appropriate Phase 8H boundary issue.

No Phase 8H fitting or evaluation logic runs before all three roots are valid.

## 9. Logistic regression model artifact

The fitted model artifact is:
- `MLBDeterministicLogisticRegressionModel`
- `contractVersion`: `mlb-deterministic-logistic-regression-model-v1`
- `sport`: `MLB`
- `target`: `OFFICIAL_FINAL_GAME_WINNER`
- `targetEncoding`: `HOME_WIN_1_AWAY_WIN_0`
- `modelId`: deterministic
- `algorithm`: `L2_LOGISTIC_REGRESSION_BINARY_V1`
- `featureIds`: ordered array
- `intercept`: number
- `coefficients`: array of `MLBModelCoefficient`
- `trainingRowCount`: integer
- `iterationsCompleted`: integer
- `converged`: boolean
- `finalTrainingObjective`: number

## 10. Feature coefficient schema

Each coefficient contains:
- `featureId`: string
- `valueCoefficient`: number
- `missingIndicatorCoefficient`: number

Raw values and missing indicators use separate coefficients.

There is exactly one coefficient pair per feature ID.

## 11. Deterministic initialization

All coefficients and the intercept initialize to `0`.

No random initialization is used.

No precomputed warm start is used.

## 12. Batch gradient descent

Phase 8H uses deterministic full-batch gradient descent.

All TRAIN rows contribute to the gradient in each iteration.

Updates are simultaneous.

The learning rate is configured and applied exactly once per iteration.

The tolerance is configured and applied to the maximum absolute parameter update.

The maximum iterations is configured and enforced exactly.

## 13. L2 regularization

L2 regularization strength is configured and applied to both raw-value coefficients and missing-indicator coefficients.

The intercept is not regularized.

The regularization term is added to the log-loss objective exactly once per iteration.

## 14. Stable sigmoid and objective

Sigmoid is computed with a stable branch.

Only the logarithm input is clamped to `[1e-15, 1 - 1e-15]`.

The training objective is average log loss plus L2 penalty on final parameters.

## 15. Training split isolation

TRAIN rows alone influence fitted parameters.

VALIDATION rows are never used to update coefficients.

TEST rows are never read during fitting.

## 16. Validation split evaluation

VALIDATION rows alone influence aggregate evaluation.

Aggregate metrics are LOG_LOSS, BRIER_SCORE, and ROC_AUC.

No row-level probabilities or predictions are returned.

No row-level output is produced.

ROC AUC is deterministic positive-negative pair with `0.5` for ties.

## 17. Test split holdout

TEST rows are read only to verify split policy consistency.

TEST `vector` is not read.

TEST `targetValue` is not read.

No TEST metric or evaluation is created.

## 18. Feature and missing-indicator treatment

Raw feature values use `valueCoefficient`.

Missing flags use `missingIndicatorCoefficient`.

The `wasMissing` flag is a boolean encoded as 1 (true) or 0 (false).

The `wasMissing` flag does not influence `valueCoefficient`.

## 19. Source identity preservation

All generated IDs are deterministic.

Generated IDs depend only on validated input IDs and version constants.

No proposed input is mutated.

No proposed input is normalized.

## 20. Cross-contract consistency

The following mismatches are detected exactly:
- `SOURCE_IDENTITY_MISMATCH`
- `FEATURE_SCHEMA_MISMATCH`
- `SPLIT_POLICY_MISMATCH`
- `SPLIT_COUNT_MISMATCH`

No partial result is produced on mismatch.

## 21. Validation metrics

Aggregate validation metrics are:
- `LOG_LOSS`
- `BRIER_SCORE`
- `ROC_AUC`

All three metrics are computed exactly once from VALIDATION rows.

## 22. ROC AUC definition

ROC AUC is computed by deterministic positive-negative pair comparison.

Ties receive exactly `0.5`.

No probabilistic tie-breaking is used.

## 23. Numerical safety

All intermediate numerical values are finite before assertion.

Non-finite values trigger `NUMERICAL_FAILURE`.

No partial model, partial validation evaluation, or partial result is produced on numerical failure.

## 24. Structural prediction minimization

No model ID, evaluation ID, result ID, probabilities array, predictions array, row-level outputs, or inference route is produced.

No odds or market inputs are used.

## 25. Descriptor safety

Descriptor getters, symbols, and accessors are not invoked during validation.

Proposed fixtures must not be typed or cast as trusted production contracts.

Proposed fixture builders return `Record<string, unknown>` or equivalent loose types.

## 26. Exact field enforcement

Field names and structure are enforced exactly.

No extra fields are permitted on any artifact.

Unknown fields map to `INVALID_FIELD` or `UNKNOWN_FIELD`.

## 27. Odds-contamination integration

The generated model, validation evaluation, and combined result are passed through the Phase 8B firewall.

Odds-contamination fields are rejected at the result boundary.

## 28. Determinism and mutation safety

No proposed input is mutated.

Generated negative zero is normalized to ordinary zero.

The same inputs produce identical outputs across repeated runs.

## 29. Exact test coverage

Exactly 20 Phase 8H tests cover the boundary.

Tests cover:
- exact reference preservation for all three validators;
- exact one-iteration `0.05` coefficient regression;
- separate raw-value and missing-indicator coefficients;
- validation-independence of fitted parameters;
- known validation metrics (`Math.log(2)`, `0.25`, `0.5`);
- class-variation rejection;
- genuine numerical-execution failure;
- TEST post-validation read isolation;
- static architecture assertions.

## 30. Deferred work

Future phases may extend fitting beyond L2 logistic regression.

Future phases may add hyperparameter search, calibration, or alternative solvers.

None of those are in Phase 8H scope.

## 31. Recommended next phase

Phase 8I is next.

See `docs/mlb-v1-deterministic-logistic-regression-fit-validation-implementation.md`.
