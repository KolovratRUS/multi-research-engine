# MLB V1 Pre-TEST Candidate Gate Plan

## 1. Locked baseline

Locked baseline: 9886dc323a9c4759b3c2f5234b5db97d9218158c
Commit: Document MLB first real fit remediation
Branch: main

## 2. Reason this gate is required

Before any second real MLB model fit is authorized for TEST evaluation, a deterministic
prediction-owned pre-TEST candidate gate must freeze the eligibility policy.

The first real candidate was rejected BEFORE TEST because:
- The fit did not converge.
- Validation metrics were worse than trivial odds-blind baselines.

This phase freezes the exact structural and performance policy that must be applied to
any future candidate BEFORE it enters the TEST phase.

## 3. First-candidate rejection context

First candidate configuration: mlb-real-pregame-winner-first-fit-v1
First candidate status: REJECTED BEFORE TEST

Accepted first-fit facts:
- converged: false
- iterations: 1000
- validation logLoss: 2.208008731286957
- validation Brier: 0.47098992693001585
- validation ROC AUC: 0.5017825311942959

TEST rows: 69
TEST rows scored: 0
TEST probabilities inspected: NO
TEST model metrics inspected: NO
TEST release invoked: NO

The TEST split remains pristine.

## 4. TEST holdout status

TEST REMAINS UNTOUCHED.

No TEST predictions have been calculated.
No TEST probabilities have been inspected.
No TEST metrics have been computed.
No TEST evaluation function has been invoked.

## 5. Source architecture audit

Read from source:

src/prediction/mlb/mlb-logistic-regression-fit-contract.ts
src/prediction/mlb/mlb-model-training-plan-contract.ts
src/prediction/mlb/mlb-model-test-release-contract.ts
src/prediction/mlb/mlb-training-matrix-contract.ts

FIT_RESULT_CONTRACT = MLBModelFitValidationResult
FIT_RESULT_VALIDATOR = validateMLBModelFitValidationResult
EVALUATION_PLAN_CONTRACT = MLBModelEvaluationPlan
EVALUATION_PLAN_VALIDATOR = validateMLBModelEvaluationPlan
TRAINING_MATRIX_CONTRACT = MLBTrainingMatrix
TRAINING_MATRIX_VALIDATOR = validateMLBTrainingMatrix
CURRENT_TEST_RELEASE_FUNCTION = evaluateAndReleaseMLBDeterministicModel
CURRENT_RELEASE_FUNCTION_CONSUMES_TEST = YES (collectTestRows(matrix))
EXISTING_PRETEST_GATE = NONE

No pre-TEST candidate gate exists in the source today.
The only existing TEST boundary is evaluateAndReleaseMLBDeterministicModel, which
consumes TEST rows and produces test metrics. That function is NOT a pre-TEST gate.

## 6. Proposed production ownership/module names

PROPOSED_MODULE = src/prediction/mlb/mlb-pretest-candidate-gate-contract.ts
PROPOSED_PUBLIC_FUNCTION = evaluateMLBPretestCandidateGate

TEST_DATA_REQUIRED = NO
TEST_METRICS_REQUIRED = NO
RELEASE_SIDE_EFFECT = NONE
MODEL_TRAINING_SIDE_EFFECT = NONE

The gate is a pure deterministic classifier. It reads existing validated artifacts,
applies frozen structural and performance rules, and returns an eligibility decision.
It does not fit, score, release, or touch TEST data.

## 7. Gate input contracts

The gate accepts:

1. fitValidationResult: MLBModelFitValidationResult (validated)
   - Contains: model, validation metrics, identity fields
   - Validation metrics used by gate: logLoss, brierScore, rocAuc

2. evaluationPlan: MLBModelEvaluationPlan (validated)
   - Contains: planId, matrixId, configId, manifestId, datasetId, algorithm,
     featureIds, splitPolicy, splitCounts, totalRows, protocol, selectionMetric,
     reportedMetrics, testSetPolicy

3. validationReferenceFacts: MLBPreTestValidationReferenceFacts (see section 10)
   - Contains: P50 and TRAIN-prior baseline metrics computed from TRAIN/VALIDATION only
   - Must NOT contain TEST-derived fields

All three inputs are validated before gate evaluation begins.

## 8. Reference-facts contract

Contract name: MLBPreTestValidationReferenceFacts
Contract version: mlb-pretest-validation-reference-facts-v1

Proposed module: src/prediction/mlb/mlb-pretest-validation-reference-contract.ts
Proposed builder: buildMLBPreTestValidationReferenceFacts

Fields:
- contractVersion: mlb-pretest-validation-reference-facts-v1
- sport: MLB
- target: OFFICIAL_FINAL_GAME_WINNER
- targetEncoding: HOME_WIN_1_AWAY_WIN_0
- matrixId: string
- datasetId: string
- evaluationPlanId: string
- trainRowCount: number
- validationRowCount: number
- trainHomeWinCount: number
- trainAwayWinCount: number
- trainHomeWinPrior: number (derived from TRAIN labels only)

Reference baselines:
- p50: { probability: 0.5, validationLogLoss: number, validationBrierScore: number }
- trainPrior: { probability: number, validationLogLoss: number, validationBrierScore: number }

Invariants:
- trainRowCount: integer > 0
- validationRowCount: integer > 0
- trainHomeWinCount: integer in [0, trainRowCount]
- trainAwayWinCount: integer in [0, trainRowCount]
- trainHomeWinCount + trainAwayWinCount = trainRowCount
- trainHomeWinPrior: finite, in [0, 1], exactly trainHomeWinCount / trainRowCount
- p_train = 0 is valid
- p_train = 1 is valid

Constraints:
- TEST rows are never included in reference-facts computation.
- The builder must receive explicit TRAIN and VALIDATION row lists and the evaluation plan.
- No TEST-derived field may appear in the output.
- The builder must fail closed on invalid inputs.

## 9. Validation-reference formulas

P50 baseline:
- probability = 0.5 (constant home-win prediction)
- validationLogLoss = mean of cross-entropy loss against VALIDATION labels at p=0.5
- validationBrierScore = mean of (0.5 - target)^2 against VALIDATION labels

TRAIN-prior baseline:
- probability = TRAIN_HOME_WIN_COUNT / TRAIN_ROW_COUNT
- Derived from TRAIN labels only. Never from VALIDATION or TEST.
- validationLogLoss = mean of cross-entropy loss against VALIDATION labels at p_train
- validationBrierScore = mean of (p_train - target)^2 against VALIDATION labels

Log-loss clipping:
- probability is clipped to [1e-15, 1 - 1e-15] before log computation
- This matches the source clipping in calculateLogLoss (src/prediction/mlb/mlb-logistic-regression-fit-contract.ts line 1109-1112)

## 10. Exact performance eligibility rule

A structurally valid, converged candidate is ELIGIBLE_FOR_TEST only if ALL of the
following hold:

1. candidate.validation.logLoss < min(P50 validation logLoss, TRAIN-prior validation logLoss)
2. candidate.validation.brierScore < min(P50 validation Brier, TRAIN-prior validation Brier)

Strict inequality is intentional. Tie = REJECT_BEFORE_TEST.

No additional epsilon or post-result margin may be introduced.

ROC AUC must:
- be finite
- remain reported in the result
- NOT be a pass/fail threshold in gate V1

The committed evaluation protocol identifies LOG_LOSS as the selection metric.
Brier provides an additional probability-quality/calibration safeguard.
ROC AUC remains diagnostic to avoid introducing another threshold on the small
validation split.

## 11. Structural fail-closed rules

The gate evaluates in this exact order:

1. validate fitValidationResult contract (validateMLBModelFitValidationResult)
   - If invalid: REJECT_BEFORE_TEST, reason INVALID_FIT_RESULT

2. validate evaluationPlan contract (validateMLBModelEvaluationPlan)
   - If invalid: REJECT_BEFORE_TEST, reason INVALID_EVALUATION_PLAN

3. validate validationReferenceFacts contract
   - If invalid: REJECT_BEFORE_TEST, reason INVALID_REFERENCE_FACTS

4. verify identity agreement:
   - planId matches
   - matrixId matches
   - configId matches
   - manifestId matches
   - datasetId matches
   - algorithm matches
   - featureIds order/IDs match
   - If any mismatch: REJECT_BEFORE_TEST, reason IDENTITY_MISMATCH

5. verify row counts:
   - validationRowCount in fit result equals evaluationPlan.splitCounts.validation
   - reference.validationRowCount equals evaluationPlan.splitCounts.validation
   - reference.trainRowCount equals evaluationPlan.splitCounts.train
   - If any mismatch: REJECT_BEFORE_TEST, reason ROW_COUNT_MISMATCH

6. verify convergence:
   - model.converged === true
   - If false: REJECT_BEFORE_TEST, reason NOT_CONVERGED

7. confirm valid reference facts / reference invariants:
   - P50 logLoss, P50 Brier, TRAIN-prior logLoss, TRAIN-prior Brier are finite
   - trainHomeWinPrior finite and in [0, 1]
   - p_train = 0 is valid
   - p_train = 1 is valid
   - If any invalid: REJECT_BEFORE_TEST, reason INVALID_REFERENCE_FACTS

8. compare validation logLoss:
   - candidate logLoss < min(P50 logLoss, TRAIN-prior logLoss)
   - If false: REJECT_BEFORE_TEST, reason VALIDATION_LOG_LOSS_NOT_BETTER_THAN_REFERENCES

9. compare validation Brier:
   - candidate Brier < min(P50 Brier, TRAIN-prior Brier)
   - If false: REJECT_BEFORE_TEST, reason VALIDATION_BRIER_NOT_BETTER_THAN_REFERENCES

10. classify ELIGIBLE_FOR_TEST

Invalid outer contracts fail closed before unsafe deep field access.
Identity mismatch stops performance comparison because candidate and reference
artifacts are not proven to describe the same model/evaluation identity.
Row-count mismatch stops performance comparison because the compared validation
populations are not proven compatible.
Once outer contracts, identity, and row counts are valid, convergence and both
performance failures are all safely determinable and are accumulated together.
The output includes all safely determinable rejection reasons.

## 12. Exact reason codes

Structural:
- INVALID_FIT_RESULT
- INVALID_EVALUATION_PLAN
- INVALID_REFERENCE_FACTS
- IDENTITY_MISMATCH
- ROW_COUNT_MISMATCH
- NOT_CONVERGED

Performance:
- VALIDATION_LOG_LOSS_NOT_BETTER_THAN_REFERENCES
- VALIDATION_BRIER_NOT_BETTER_THAN_REFERENCES

Success:
- ELIGIBLE_FOR_TEST

Failure (pre-TEST):
- REJECT_BEFORE_TEST

## 13. Edge-case behavior

| Condition | Gate behavior |
|-----------|---------------|
| TRAIN row count = 0 | Reference facts contract fails validation -> REJECT_BEFORE_TEST |
| VALIDATION row count = 0 | Reference facts contract fails validation -> REJECT_BEFORE_TEST |
| invalid target values in TRAIN/VALIDATION | Reference facts builder rejects -> REJECT_BEFORE_TEST |
| non-finite model intercept/coefficients/objective | fit contract invalid -> REJECT_BEFORE_TEST, INVALID_FIT_RESULT |
| non-finite candidate validation metric | fit contract invalid -> REJECT_BEFORE_TEST, INVALID_FIT_RESULT |
| non-finite reference baseline metric or probability | REJECT_BEFORE_TEST, INVALID_REFERENCE_FACTS |
| TRAIN class prior = 0 | Log-loss is finite (clipped). Gate proceeds. If candidate fails performance rule, rejects with performance reason. |
| TRAIN class prior = 1 | Same as prior = 0. |
| identity mismatch | REJECT_BEFORE_TEST, IDENTITY_MISMATCH |
| row-count mismatch | REJECT_BEFORE_TEST, ROW_COUNT_MISMATCH |
| exact tie on logLoss | REJECT_BEFORE_TEST, VALIDATION_LOG_LOSS_NOT_BETTER_THAN_REFERENCES |
| exact tie on Brier | REJECT_BEFORE_TEST, VALIDATION_BRIER_NOT_BETTER_THAN_REFERENCES |

Do not silently substitute 0.5 for invalid data.
Invalid facts must produce REJECT_BEFORE_TEST or fail contract validation before gate evaluation.

## 14. First-candidate counterfactual proof

Using saved first-fit facts only (no model execution):

fit contract: valid (validateMLBModelFitValidationResult passed on saved result)
identity: valid (planId, matrixId, configId, manifestId, datasetId, algorithm, featureIds match frozen plan)
finite values: yes
converged: false

Structural classification:
PRIMARY_REASON = NOT_CONVERGED
FIRST_CANDIDATE_GATE_RESULT = REJECT_BEFORE_TEST

Secondary performance evidence (already frozen):
validation logLoss = 2.208008731286957 > min(P50 logLoss=0.6931471805599453, TRAIN-prior logLoss=0.6942000244439546)
validation Brier = 0.47098992693001585 > min(P50 Brier=0.25, TRAIN-prior Brier=0.2505250592766346)

PERFORMANCE_REASONS = VALIDATION_LOG_LOSS_NOT_BETTER_THAN_REFERENCES, VALIDATION_BRIER_NOT_BETTER_THAN_REFERENCES

TEST_USED = NO

This is a sanity check of the already-frozen policy, not policy tuning.

## 15. Future implementation scope

Proposed production files:
- src/prediction/mlb/mlb-pretest-validation-reference-contract.ts
  - Types, validator, and builder for MLBPreTestValidationReferenceFacts
- src/prediction/mlb/mlb-pretest-candidate-gate-contract.ts
  - evaluateMLBPretestCandidateGate and supporting types

Proposed test files:
- tests/prediction/mlb/mlb-pretest-validation-reference-contract.test.ts
- tests/prediction/mlb/mlb-pretest-candidate-gate-contract.test.ts

Required future implementation properties:
- deterministic
- no network I/O
- no filesystem I/O
- no database
- no model fitting
- no TEST scoring
- no release
- no recommendation
- no betting-market data
- no mutable global state

## 16. Future test matrix

Tests to cover in future implementation:
- valid converged candidate beating both references on logLoss + Brier -> eligible
- non-converged candidate -> reject
- invalid fit contract -> reject/fail validation
- identity mismatch -> reject
- validation row-count mismatch -> reject
- non-finite fit model or validation metric -> fit contract invalid -> INVALID_FIT_RESULT
- logLoss beats references but Brier does not -> reject
- Brier beats references but logLoss does not -> reject
- exact tie on logLoss -> reject
- exact tie on Brier -> reject
- ROC AUC below/above 0.5 does not itself determine eligibility if finite
- TRAIN prior baseline correctly derived from TRAIN labels only
- p_train = 0 edge case
- p_train = 1 edge case
- no TEST-derived data appears in reference-facts contract
- TEST rows do not affect reference-facts output
- deterministic repeated evaluation gives identical output
- first rejected real candidate would be rejected without TEST

## 17. Explicit no-TEST/no-release boundary

THE PRE-TEST GATE REQUIRES NO TEST METRICS.

THE PRE-TEST GATE DOES NOT RELEASE A MODEL.

THE PRE-TEST GATE DOES NOT SCORE TEST ROWS.

THE PRE-TEST GATE DOES NOT CALCULATE TEST PROBABILITIES.

THE PRE-TEST GATE DOES NOT INSPECT TEST LABELS.

The gate only classifies a candidate as eligible or ineligible to enter a future,
explicitly authorized TEST phase. TEST access is exclusively owned by
evaluateAndReleaseMLBDeterministicModel in a later authorized phase.

## 18. V2 remains unauthorized

NO V2 FIT IS AUTHORIZED BY THIS PLAN.

V2_REMEDIATION_CLASS = OPTIMIZATION_CONFIGURATION_ONLY (from remediation plan)
IS_STANDARDIZATION_REQUIRED_BEFORE_ANOTHER_FIT = UNRESOLVED
IS_FEATURE_REMOVAL_REQUIRED_BEFORE_ANOTHER_FIT = UNRESOLVED
V2_FIT_AUTHORIZED = NO

The gate policy is frozen before V2 exists. It must not be tuned to make any
specific candidate pass. The first candidate was rejected before TEST; that result
must not influence the chosen numeric thresholds.

## 19. Frozen policy identifier

FROZEN_PRETEST_GATE_POLICY_V1

This policy is baseline-relative and frozen before any V2 configuration or fit.

## 20. Amendment provenance

ORIGINAL_POLICY_ID = FROZEN_PRETEST_GATE_POLICY_V1
AMENDMENT_KIND = REACHABILITY_TRUTHFULNESS_CORRECTION
SUBSTANTIVE_PERFORMANCE_POLICY_CHANGED = NO
TEST_POLICY_CHANGED = NO
CONVERGENCE_POLICY_CHANGED = NO
REFERENCE_BASELINE_POLICY_CHANGED = NO
ODDS_BLIND_POLICY_CHANGED = NO

Reason: authoritative validators made two specialized nonfinite reasons and some
identity mismatch variants structurally unreachable.

Identity reachability (current authoritative contracts):
- planId / matrixId / configId mismatch between valid artifacts = REACHABLE_COUPLED
- manifestId / datasetId / different featureIds mismatch between valid artifacts = REACHABLE_ISOLATED
- algorithm mismatch between valid artifacts = STRUCTURALLY_UNREACHABLE
  (both artifact contracts constrain algorithm to L2_LOGISTIC_REGRESSION_BINARY_V1)
- pure same-IDs different-order featureIds mismatch between valid artifacts = STRUCTURALLY_UNREACHABLE
  (evaluation-plan validator rejects noncanonical feature order before the gate)

All listed reachable mismatch cases produce IDENTITY_MISMATCH.
