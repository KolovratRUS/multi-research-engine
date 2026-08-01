# MLB V1 Model Training Configuration and Evaluation Plan Implementation

## 1. Phase status

Phase 8G implementation is complete and pending ChatGPT review, commit, and push.

## 2. Locked baseline

This implementation builds on the Phase 8F baseline:

`bd59fdbb041faadf28b4b8d726458831cf4f1630`

Implement MLB leakage-safe training matrix contract

## 3. Purpose

Phase 8G implements the deterministic MLB model-training configuration and split-isolated evaluation-plan contract. It defines one explicit deterministic binary-classification training configuration, declares the future algorithm family without fitting it, defines finite and bounded optimization parameters without running optimization, and declares feature-value and missing-indicator treatment without transforming data. The Phase 8G builder accepts a validated Phase 8F training matrix, validates it through the locked Phase 8F validator, derives the feature-ID schema from the first validated row, copies source identities and split metadata exactly, constructs a metadata-only chronological evaluation plan, and validates the generated plan through the public plan validator and the Phase 8B odds-contamination firewall before returning success.

## 4. Architecture position

The safe sequence is:

validated Phase 8F training matrix -> validated deterministic training configuration -> metadata-only evaluation plan -> future Phase 8H fitting and split-isolated evaluation.

The Phase 8G builder may read only the metadata needed to construct the plan:

- matrix identity
- manifest identity
- dataset identity
- feature IDs
- split policy
- split counts
- total row count

The Phase 8G builder must not use or expose row target values, label objects, final scores, winner identity, label provenance, feature numerical values, missing-value flags, or prediction output. The plan must contain no training rows or model artifact.

## 5. Permanent odds-blind boundary

The Multi Research Engine remains completely odds-blind.

Prohibited anywhere in a Phase 8G proposed configuration, proposed plan, generated plan, identifier, metric declaration, or nested field:

- sportsbook odds or prices
- moneyline
- point spread
- game total or over/under
- props
- implied probabilities derived from odds
- market consensus
- market movement
- line shopping
- value or edge
- expected payout
- Kelly calculations
- bookmaker or sportsbook identifiers
- betting-market payloads
- predicted winners
- recommendation outputs
- selections
- multis
- stakes
- grading outputs

Allowed:

- a future binary probability-model algorithm declaration
- deterministic optimization configuration
- L2 regularization configuration
- feature-schema identifiers
- TRAIN, VALIDATION, and TEST metadata
- split windows and embargo metadata
- split counts
- evaluation metric names
- validation-selection policy
- final-test holdout policy
- deterministic validation issues

## 6. Authorized scope

Only these four repository files are authorized for Phase 8G:

- `README.md`
- `docs/mlb-v1-model-training-configuration-evaluation-plan-implementation.md`
- `src/prediction/mlb/mlb-model-training-plan-contract.ts`
- `tests/prediction/mlb/mlb-model-training-plan-contract.test.ts`

## 7. Contract versions

The training configuration contract version is exported as:

`mlb-model-training-configuration-v1`

The evaluation plan contract version is exported as:

`mlb-model-evaluation-plan-v1`

## 8. Training configuration root

The training configuration root is a readonly type alias with exact fields:

- `contractVersion`
- `sport`
- `target`
- `targetEncoding`
- `configId`
- `algorithm`
- `randomnessPolicy`
- `featureValuePolicy`
- `missingIndicatorPolicy`
- `regularization`
- `optimization`

`contractVersion` is exactly `mlb-model-training-configuration-v1`. `sport` is exactly `MLB`. `target` is exactly `OFFICIAL_FINAL_GAME_WINNER`. `targetEncoding` is exactly `HOME_WIN_1_AWAY_WIN_0`. `configId` is a strict identifier. No optional fields exist. No hyperparameter array or candidate list exists.

## 9. Algorithm declaration

The algorithm literal is exactly:

`L2_LOGISTIC_REGRESSION_BINARY_V1`

This phase declares the future algorithm family only. It does not implement logistic-regression fitting.

## 10. Determinism policy

The randomness policy literal is exactly:

`NO_RANDOMNESS`

No seed field exists because Phase 8G does not use randomness.

## 11. Feature-value policy

The feature-value policy literal is exactly:

`RAW_FINITE_FEATURE_VALUES`

No scaling, centering, normalization, clipping, bucketing, or learned transformation occurs in Phase 8G.

## 12. Missing-indicator policy

The missing-indicator policy literal is exactly:

`PRESERVE_WAS_MISSING_FLAGS`

This declares that future fitting must preserve the existing Phase 8E missing indicators. Phase 8G does not construct additional features.

## 13. L2 regularization

Regularization is a readonly type alias with exact fields:

- `kind`
- `strength`

`kind` is exactly `L2`. `strength` must be an actual finite number strictly greater than zero. No coercion, NaN, Infinity, negative zero, or optional value is accepted. Phase 8G records this future fitting parameter only and does not apply regularization.

## 14. Optimization declaration

Optimization is a readonly type alias with exact fields:

- `solver`
- `learningRate`
- `maxIterations`
- `tolerance`

`solver` is exactly:

`DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1`

`learningRate` must be an actual finite number strictly greater than zero and at most 1. No negative zero is accepted. `maxIterations` must be a positive safe integer no greater than 1,000,000. `tolerance` must be an actual finite number strictly greater than zero and less than 1. No negative zero is accepted. Phase 8G must not execute the solver, initialize coefficients, calculate gradients, calculate loss, loop through iterations, or emit convergence results.

## 15. Evaluation plan root

The evaluation plan root is a readonly type alias with exact fields:

- `contractVersion`
- `sport`
- `target`
- `targetEncoding`
- `planId`
- `matrixId`
- `configId`
- `manifestId`
- `datasetId`
- `algorithm`
- `featureIds`
- `splitPolicy`
- `splitCounts`
- `totalRows`
- `protocol`
- `selectionMetric`
- `reportedMetrics`
- `testSetPolicy`

`contractVersion` is exactly `mlb-model-evaluation-plan-v1`. No optional fields exist.

## 16. Source identities

`matrixId`, `manifestId`, and `datasetId` must be strict identifiers. `configId` must be a strict identifier. `planId` must equal:

`matrixId + "::" + configId`

No clock, UUID, randomness, hashing, or environment data is used.

## 17. Feature schema

`featureIds` is a descriptor-safe non-empty array of strict identifiers. Duplicate valid IDs are rejected. The array must be in canonical ordinal order. Malformed IDs are excluded from duplicate and ordering comparisons. No sparse positions, accessor positions, own symbols, numeric accessor array properties, or unexpected string properties are accepted. The builder copies the feature IDs from the first validated matrix row vector values only. No numerical feature value or missing flag is copied.

## 18. Chronological evaluation protocol

The protocol literal is exactly:

`TRAIN_FIT_VALIDATION_SELECT_TEST_FINAL_V1`

This means future fitting uses TRAIN only, future configuration assessment uses VALIDATION only, TEST remains untouched during fitting and selection, and TEST is used only for one final evaluation after the configuration is locked.

## 19. Split policy preservation

The plan preserves the Phase 8F split policy exactly. The split policy strategy is:

`CHRONOLOGICAL_OFFICIAL_DATE_V1`

Each window contains exactly:

- `startDate`
- `endDate`

Real Gregorian dates are validated. `startDate <= endDate` is enforced for every window. TRAIN ends before VALIDATION begins. VALIDATION ends before TEST begins. Embargo days are a non-negative safe integer. The TRAIN-to-VALIDATION gap satisfies the embargo. The VALIDATION-to-TEST gap satisfies the embargo. Deterministic Gregorian-day arithmetic is used.

## 20. Embargo preservation

Embargo days are copied exactly from the validated Phase 8F matrix split policy. The builder must not invent new embargo values. The generated plan must satisfy the same embargo boundaries as the source matrix.

## 21. Split counts and total rows

Split counts are a newly constructed plain-data copy with exactly:

- `train`
- `validation`
- `test`

Every count must be a positive safe integer in Phase 8G. A configuration or evaluation plan is not valid unless every split is non-empty. `totalRows` is a positive safe integer and exactly equals `train + validation + test`.

## 22. Validation selection policy

The selection metric is exactly:

`LOG_LOSS`

Lower validation LOG_LOSS is preferred. No hyperparameter array or candidate list exists.

## 23. Final test holdout policy

The test-set policy is exactly:

`HOLDOUT_UNTIL_CONFIGURATION_LOCKED`

TEST remains untouched until the configuration is locked.

## 24. Evaluation metrics

The canonical reported metric order is exactly:

1. `LOG_LOSS`
2. `BRIER_SCORE`
3. `ROC_AUC`

The reported metrics array must contain exactly these three items in this order. No missing, duplicate, extra, or reordered metric is accepted. No output field for a calculated metric value exists. No metric is calculated in Phase 8G.

## 25. Structural target isolation

The evaluation plan must not contain:

- rows
- vectors
- values
- wasMissing
- targetValue
- label
- homeRuns
- awayRuns
- winnerTeamId
- finalizedAt
- source
- prediction
- probability
- coefficient
- coefficients
- intercept
- modelArtifact
- metricResults
- recommendation
- stake
- grading

The plan contains metadata only. The builder must not read `row.targetValue` after Phase 8F validation. The builder must not read labels, scores, winners, or outcome provenance. The only row-level content it may inspect after Phase 8F validation is the feature-ID schema from the first validated row vector values.

## 26. Descriptor safety

At every new Phase 8G proposed-contract level, the validator supports ordinary plain objects and null-prototype plain objects. Rejected structures include arrays where objects are required, custom class instances, own symbol properties, unknown own string properties, non-enumerable unknown fields, getter-only accessors, setter-only accessors, getter-plus-setter accessors, sparse arrays, numeric accessor array properties, and unexpected string properties on arrays. The validator never invokes user-defined getters or setters. Never mutate, trim, sort, freeze, clone, or normalize proposed configuration or plan values. Array extraction must inspect own descriptors before normal iteration. Shared acyclic references may be re-inspected. Active-branch cycles must be rejected deterministically without recursion overflow where recursive inspection applies.

## 27. Exact field enforcement

`MISSING_FIELD` is used for an absent required own property. `INVALID_JSON_VALUE` is used for an accessor without invocation or structurally unsafe JSON-like data. `UNKNOWN_FIELD` is used for an unknown field unless a narrower prohibited-field issue applies. `PROHIBITED_CONCEPT` is used for prohibited output or outcome fields. Plan fields such as `rows`, `vectors`, `values`, `wasMissing`, `targetValue`, `label`, `homeRuns`, `awayRuns`, `winnerTeamId`, `finalizedAt`, `source`, `prediction`, `probability`, `coefficient`, `coefficients`, `intercept`, `modelArtifact`, `metricResults`, `recommendation`, `stake`, and `grading` are explicitly rejected. No optional Phase 8G V1 fields exist.

## 28. Odds-contamination integration

The Phase 8B firewall runs against the complete original proposed training configuration, the complete original proposed evaluation plan, and the newly generated evaluation plan before builder success. Actual contamination maps to `ODDS_CONTAMINATION`. An uninspectable accessor or firewall traversal failure maps to `INVALID_JSON_VALUE`. A clone, sanitized substitute, partial projection, or replacement object is never passed to the firewall.

## 29. Exact test coverage

Exactly 20 explicit `it(...)` tests cover the Phase 8G boundary.

## 30. Deferred work

Phase 8G does not call a live API.

Phase 8G does not select or implement a provider adapter.

Phase 8G does not add credentials.

Phase 8G does not persist a configuration or evaluation plan.

Phase 8G does not construct a real production model artifact.

Phase 8G does not fit a model.

Phase 8G does not initialize or update coefficients.

Phase 8G does not execute gradient descent.

Phase 8G does not search hyperparameters.

Phase 8G does not calibrate probabilities.

Phase 8G does not run inference.

Phase 8G does not generate probabilities.

Phase 8G does not predict a winner.

Phase 8G does not calculate evaluation metrics.

Phase 8G does not generate recommendations, multis, or stakes.

Phase 8G does not add grading.

Phase 8G does not add routes or UI.

## 31. Recommended next phase

Phase 8H — Implement the pure deterministic MLB logistic-regression fitting and split-isolated evaluation engine without inference routes, recommendations, multis, or staking.
