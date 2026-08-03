# MLB V1 Offline Pregame Inference Implementation

## 1. Phase status

Phase 8J implementation is complete and pending ChatGPT review, commit, and push.

## 2. Locked baseline

The locked baseline is commit 57ea1a7c55c1552f0eebad2ea85584889ac1aefc (Phase 8I — Implement MLB held-out test evaluation release contract).

## 3. Purpose

Phase 8J implements pure offline MLB pregame inference from a released model, a validated feature manifest, and a canonical pregame snapshot. It does not call a live API. It does not select or implement a provider adapter. It does not add credentials. It does not persist or register a model. It does not fit, refit, calibrate, or update a model. It does not read TRAIN, VALIDATION, or TEST rows. It does not use Phase 8H VALIDATION metrics. It does not use Phase 8I TEST metrics. It does not expose raw feature values or missing indicators. It does not expose a raw linear score. It does not add routes or UI. It does not generate recommendations, multis, or stakes.

## 4. Architecture position

The safe sequence is:

validated Phase 8I model TEST-release result
+
validated Phase 8E feature manifest
+
validated Phase 8C canonical pregame snapshot
→ Phase 8E leakage-safe feature extraction
→ frozen-model deterministic score calculation
→ stable sigmoid probability
→ complementary home/away probabilities
→ deterministic predicted winner
→ offline single-game inference contract
→ future Phase 8K prediction-slate construction

## 5. Permanent odds-blind boundary

The Multi Research Engine remains permanently odds-blind. Sportsbook odds, prices, moneyline, point spread, game total, over/under, props, implied probability derived from odds, market consensus, market movement, line shopping, value, edge, expected payout, Kelly calculations, bookmaker or sportsbook identifiers, recommendation, selection, multi, parlay, stake, grading, profit, return on investment, deployment, and endpoint are prohibited anywhere in a proposed inference, generated inference, identifier, nested object, probability object, predicted-winner object, message, or metadata field.

## 6. Authorized scope

Only these four files are authorized for Phase 8J scope:

- README.md
- docs/mlb-v1-offline-pregame-inference-implementation.md
- src/prediction/mlb/mlb-offline-pregame-inference-contract.ts
- tests/prediction/mlb/mlb-offline-pregame-inference-contract.test.ts

Temporary evidence may exist only under `/tmp/phase8j/`.

## 7. Public API and imports

The production source exports exactly these declarations, in this order:

- `MLB_OFFLINE_PREGAME_INFERENCE_CONTRACT_VERSION`
- `MLB_OFFLINE_PREGAME_DECISION_POLICY`
- `MLBOfflinePregamePredictedSide`
- `MLBOfflinePregameProbabilityPair`
- `MLBOfflinePregameInference`
- `MLBOfflinePregameInferenceIssue`
- `validateMLBOfflinePregameInference`
- `inferMLBOfflinePregameWinner`

The production source imports exactly these modules, in this order:

- `../firewall/odds-contamination-guard`
- `./mlb-pregame-snapshot-contract`
- `./mlb-feature-vector-contract`
- `./mlb-model-test-release-contract`
- `./mlb-logistic-regression-fit-contract`

No private helper is exported. No enum or interface is exported.

## 8. Contract version

The contract version is `mlb-offline-pregame-inference-v1`. The decision policy is `HOME_AT_OR_ABOVE_0_5_V1`. The required sport is `MLB`. The required target is `OFFICIAL_FINAL_GAME_WINNER`. The required target encoding is `HOME_WIN_1_AWAY_WIN_0`. The required algorithm is `L2_LOGISTIC_REGRESSION_BINARY_V1`.

## 9. Input validation boundaries

The builder validates inputs in this exact order:

1. Phase 8I model TEST-release result through `validateMLBModelTestReleaseResult`.
2. Nested Phase 8H fit-validation result through `validateMLBModelFitValidationResult`.
3. Nested Phase 8I TEST evaluation through `validateMLBModelTestEvaluation`.
4. Nested Phase 8I release record through `validateMLBModelReleaseRecord`.
5. Phase 8E feature manifest through `validateMLBFeatureManifest`.
6. Phase 8C canonical pregame snapshot through `validateMLBCanonicalPregameSnapshot`.

No proposed root is accessed before its public validator succeeds. A failed boundary maps to exactly one issue:

- `RELEASE_RESULT_INVALID` at path `$.releasedModelResult`
- `MANIFEST_INVALID` at path `$.featureManifest`
- `SNAPSHOT_INVALID` at path `$.snapshot`

Invalid nested release status maps to `RELEASE_STATUS_MISMATCH` at path `$.releasedModelResult.release.releaseStatus`.

## 10. Released-model boundary

After successful Phase 8I validation, only the following fields are used:

- `released.fitValidation.model.intercept`
- `released.fitValidation.model.featureIds`
- `released.fitValidation.model.coefficients`
- `released.fitValidation.model.modelId`
- `released.fitValidation.model.planId`
- `released.fitValidation.model.matrixId`
- `released.fitValidation.model.configId`
- `released.fitValidation.model.manifestId`
- `released.fitValidation.model.algorithm`
- `released.release.releaseId`
- `released.release.releaseStatus`

No validation or TEST metric is used. No training-row content is used.

## 11. Release-status requirement

The required release status is `OFFLINE_RELEASE_CANDIDATE_NOT_DEPLOYED`. A mismatch returns `RELEASE_STATUS_MISMATCH`. This status permits future offline integration only. It does not mean deployed, registered, persisted, production-approved, recommendation-approved, or staking-approved.

## 12. Feature-manifest boundary

The validated manifest provides the feature schema: feature IDs, section IDs, payload paths, value kinds, and missing policies. Cross-contract checks require exact agreement between the manifest and the released model: manifest IDs, sport, target, feature IDs, coefficient feature IDs, counts, and order match exactly.

## 13. Canonical snapshot boundary

The validated snapshot provides game identity, official date, data cutoff, home/away team IDs, starting pitchers, source references, and sections. Phase 8C owns team distinctness validation; invalid same-team snapshots map to `SNAPSHOT_INVALID`. Phase 8J does not emit TEAM_IDENTITY_MISMATCH.

## 14. Leakage-safe feature extraction

`extractMLBLeakageSafeFeatureVector` is called with the validated manifest and snapshot. Extraction failure maps to `FEATURE_EXTRACTION_FAILED` at path `$.featureVector`. Phase 8E validates successful extracted vectors internally. Phase 8J does not emit FEATURE_VECTOR_INVALID. The vector is not exposed in the successful output.

## 15. Feature-schema consistency

Exact equality is required among:

- manifest `features[].featureId`
- model `featureIds`
- model `coefficients[].featureId`
- extracted vector `values[].featureId`

Exact count, exact order, exact IDs, no duplicates. A mismatch returns `FEATURE_SCHEMA_MISMATCH`.

After successful nested validation, nested identity consistency is also verified:

- combined resultId must equal `model.planId + "::test-release-v1"`
- fitValidation resultId must equal `model.planId + "::fit-validation-v1"`
- validation evaluationId must equal `model.modelId + "::validation-v1"`
- test evaluationId must equal `model.modelId + "::test-v1"`
- release releaseId must equal `model.modelId + "::offline-release-candidate-v1"`
- test modelId, planId, matrixId, configId must equal the model IDs
- release modelId, planId, matrixId, configId, manifestId, datasetId, algorithm must equal the model fields
- release validationEvaluationId must equal validation evaluationId
- release testEvaluationId must equal test evaluationId

A mismatch returns `SOURCE_IDENTITY_MISMATCH`. No metric value is inspected.

## 16. Frozen-model parameters

The model is frozen. Parameters are read only. No fitting, refitting, calibration, tuning, or update occurs. The frozen intercept and coefficients are applied exactly.

## 17. Raw-value and missing-indicator treatment

For each feature in exact model order:

score += valueCoefficient * extractedFeature.value + missingIndicatorCoefficient * (extractedFeature.wasMissing ? 1 : 0)

Raw values and missing indicators use separate frozen coefficients.

## 18. Stable linear-score calculation

The internal linear score is initialized from the frozen intercept. For each feature in exact model order, the score is incremented using the raw-value and missing-indicator formula. No normalization, scaling, centering, clipping, bucketing, interaction, or threshold selection occurs.

## 19. Stable sigmoid

The home probability is computed with a numerically stable sigmoid:

- If score >= 0: `1 / (1 + Math.exp(-score))`
- If score < 0: `Math.exp(score) / (1 + Math.exp(score))`

No external math or inference library is used. No clamp is applied. Phase 8J does not clamp finite scores.

## 20. Probability-pair contract

`homeWinProbability` equals the stable sigmoid. `awayWinProbability` equals `1 - homeWinProbability` using exact JavaScript subtraction. Generated negative zero is normalized to ordinary zero. Both probabilities must be finite and within [0, 1]. The pair must satisfy the exact complement rule. No rounding, percentage conversion, or display formatting is applied.

## 21. Decision policy

The deterministic decision policy is `HOME_AT_OR_ABOVE_0_5_V1`. If `homeWinProbability >= 0.5`, the predicted side is `HOME` and the predicted team ID is the snapshot home team ID. Otherwise, the predicted side is `AWAY` and the predicted team ID is the snapshot away team ID. An exact 0.5 probability predicts `HOME`. No random tie breaking, alphabetical ordering, market data, confidence threshold, or abstention is used.

## 22. Predicted-team consistency

`predictedSide` must be exactly `HOME` or `AWAY`. `predictedTeamId` must equal `homeTeamId` when `predictedSide` is `HOME`, and `awayTeamId` when `predictedSide` is `AWAY`.

## 23. Source identity preservation

The inference ID is constructed as:

`releaseId + "::" + snapshotId + "::offline-pregame-inference-v1"`

Release, model, manifest, snapshot, game, team, date, and cutoff identities are preserved exactly. Nested model, fit-validation, validation-evaluation, test-evaluation, and release-record IDs must agree deterministically. Combined resultId, fitValidation resultId, validation evaluationId, test evaluationId, and release releaseId are derived from the model's planId and modelId. Any mismatch returns `SOURCE_IDENTITY_MISMATCH`.

## 24. Evaluation-metric isolation

No Phase 8H VALIDATION metric and no Phase 8I TEST metric is read after Phase 8I validation. Proxies confirm zero ordinary property reads of `logLoss`, `brierScore`, and `rocAuc` under both validation and test evaluations.

## 25. Numerical safety

At every calculation boundary, non-finite values are rejected:

- model intercept
- value coefficient
- missing-indicator coefficient
- extracted feature value
- value-coefficient product
- missing-indicator product
- incremental score
- final score
- exponential intermediate
- home probability
- away probability

A non-finite score returns `NUMERICAL_FAILURE`. No silent saturation occurs.

## 26. Descriptor safety

The validator uses `Object.getOwnPropertyDescriptor` to inspect properties. It never invokes user-defined getters or setters. Proposed inference objects and probability objects may be ordinary plain objects or null-prototype plain objects. Arrays, custom class instances, own symbol properties, unknown own string properties, non-enumerable unknown fields, and accessors are rejected.

## 27. Exact field enforcement

Required fields use exact literals and values. Prohibited fields are rejected with `UNKNOWN_FIELD` or `PROHIBITED_CONCEPT`. Missing required own properties use `MISSING_FIELD`. No optional Phase 8J V1 fields exist.

## 28. Odds-contamination integration

`assertNoOddsContamination` is run against the proposed inference before validation and against the generated inference after builder success. Contamination maps to `ODDS_CONTAMINATION`. Uninspectable accessor or firewall traversal failure maps to `INVALID_JSON_VALUE`. No private firewall error class is imported. No firewall exception escapes.

## 29. Exact test coverage

Exactly 20 explicit `it(...)` tests cover the boundary. No `it.each`, `test.each`, dynamic registration, skipped tests, `any`, TypeScript suppression comments, production-contract fixture casts, or filesystem writes are used. Tests use local fixture builders returning `Record<string, unknown>`.

## 30. Deferred work

Deferred work includes live API ingestion, provider adapters, credentials, scheduled ingestion, model persistence, model registration, production deployment, HTTP or application routes, probability-serving APIs, database work, recommendation generation, recommendation ranking, multis, staking, grading, performance tracking, UI, and batch prediction slates.

## 31. Recommended next phase

The next safe phase is Phase 8K — Implement deterministic offline MLB prediction-slate construction from validated per-game inference outputs without recommendations, multis, staking, routes, or UI.
