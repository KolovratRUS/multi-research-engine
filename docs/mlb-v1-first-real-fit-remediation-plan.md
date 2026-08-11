# MLB V1 First Real Fit Remediation Plan

## 1. Locked baseline

Locked baseline: 131a2b14b051b01cb80a3c0264216b603a85ad08
Commit: Freeze MLB real training evaluation protocol
Branch: main

## 2. First-fit artifact hashes

training-matrix-a.json: 5c730f9e286750c232a5e13e1be3553a40d463bb923f4f0e8dcbcd8ce8b5495e
fit-result.json: 5e99f2797e5fdf19e129a6f6fbbbdd9ad20a91b8c92d7a920c3c9c94115f2e58
trainer-configuration.json: c25cf6e451534d0fcc6ffaabe80237cb3c7ece98359698b80d1bb8dbde7114d0
evaluation-plan.json: 37226265253ab87c31c21f0b3e5ecbcd686e37b3b338133ac8288027dd22c41f
protocol: 7451b95088dd03674ebe10cf6e7fa751070682f99c8a8e0a08729db0bae192ee

### R2-R1-R1 linear-algebra closure note

The initial Phase R2 analysis produced an impossible rank=21 classification for this 29-column design matrix. Structural analysis proves rank <= 13. Trusted NumPy/LAPACK `np.linalg.svd` and `np.linalg.matrix_rank` classify the numerical rank as 13. NumPy QR on intercept + 12 varying channels provides the independent lower-bound cross-check. Therefore the final accepted rank is 13. All R2 singular values beyond the 13th, the reported condition number of 1,311,907,827.5, and the rank deficiency of 8 are superseded and must not be used as current truth.

## 3. First trainer configuration

configId: mlb-real-pregame-winner-first-fit-v1
contractVersion: mlb-model-training-configuration-v1
sport: MLB
target: OFFICIAL_FINAL_GAME_WINNER
targetEncoding: HOME_WIN_1_AWAY_WIN_0
algorithm: L2_LOGISTIC_REGRESSION_BINARY_V1
randomnessPolicy: NO_RANDOMNESS
featureValuePolicy: RAW_FINITE_FEATURE_VALUES
missingIndicatorPolicy: PRESERVE_WAS_MISSING_FLAGS
regularization.kind: L2
regularization.strength: 0.01
optimization.solver: DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1
optimization.learningRate: 0.1
optimization.maxIterations: 1000
optimization.tolerance: 0.0001

## 4. Exact first-fit result

converged: false
iterationsCompleted: 1000
initialTrainingObjective: 0.6931471805599467
finalTrainingObjective: 1.8064154994833674
saved final maxUpdate: 0.41025281695708626

VALIDATION:
logLoss: 2.208008731286957
brierScore: 0.47098992693001585
rocAuc: 0.5017825311942959

TEST: UNTOUCHED (69 rows, 0 scored)

## 5. Explicit candidate rejection before TEST

FIRST REAL CANDIDATE IS REJECTED BEFORE TEST.

The first fit did not converge (maxUpdate=0.410 >> tolerance=0.0001), final objective is materially worse than zero initialization, and validation metrics are worse than trivial odds-blind baselines. This candidate must not consume TEST rows.

## 6. Validation-only trivial baseline comparison

P50 validation logLoss (always predict 0.5): 0.6931471805599453
P50 validation Brier score: 0.25
TRAIN home-win prior: 0.53156146179402
TRAIN-prior validation logLoss: 0.6942000244439546
TRAIN-prior validation Brier: 0.2505250592766346

First fit validation logLoss (2.208008731286957) is WORSE than P50 baseline.
First fit validation Brier (0.47098992693001585) is WORSE than P50 baseline.

## 7. One-real-invocation proof

fitAndEvaluateMLBDeterministicLogisticRegression was invoked exactly once against training-matrix-a.json only. The invocation was marked by REAL_FIT_ATTEMPT_STARTED before execution and REAL_FIT_ATTEMPT_COMPLETED after exit 0. No retry loop exists. evaluateAndReleaseMLBDeterministicModel was never invoked.

## 8. Exact source optimizer mathematics

### Objective

J(theta) = (1/n) * sum_{i=1}^n [ -y_i * log(p_i) - (1-y_i) * log(1-p_i) ] + (lambda/2) * ||theta_nonIntercept||^2

where:
- p_i = sigmoid(score_i)
- score_i = intercept + sum_{f=1}^{14} (valueCoeff_f * x_{if}) + sum_{f=1}^{14} (missingCoeff_f * wasMissing_{if})
- lambda = 0.01
- n = 301 (TRAIN rows)

### Regularization terms

L2 objective term: (lambda/2) * sum_{f=1}^{14} (valueCoeff_f^2 + missingCoeff_f^2)
L2 gradient term: lambda * theta_nonIntercept (applied to all 28 non-intercept coefficients)

Intercept is NOT regularized.
Value coefficients ARE regularized.
Missing indicator coefficients ARE regularized.

### Gradient

gradient_intercept = (1/n) * sum_{i=1}^n (p_i - y_i)
gradient_valueCoeff_f = (1/n) * sum_{i=1}^n (p_i - y_i) * x_{if} + lambda * valueCoeff_f
gradient_missingCoeff_f = (1/n) * sum_{i=1}^n (p_i - y_i) * wasMissing_{if} + lambda * missingCoeff_f

### Fixed-step update

theta := theta - learningRate * gradient(theta)

with learningRate = 0.1.

## 9. TRAIN design-matrix rank/conditioning facts

TRAIN rows: 301
Expanded non-intercept channels: 28
Design columns with intercept: 29
Parameter vector dimension: 29
Numerical rank: 13
Rank deficiency: 16
Largest singular value: 245.59365172166605
Smallest accepted nonzero singular value: 0.5349722444770331
Condition number (identifiable subspace): 459.0773713162415

Accepted nonzero singular values (descending, from NumPy/LAPACK):
245.59365172166605, 22.60396744043488, 20.147800958442343, 14.028100368554648, 11.64469413191494, 9.40086535618662, 9.069729624595693, 6.958608878965089, 5.577386559107139, 3.388022267077375, 0.9008244496380964, 0.8448986156742039, 0.5349722444770331

Zero variance columns:
intercept (constant 1)
value_awayStarterAvailable (constant 0)
value_homeStarterAvailable (constant 0)
value_scheduledInnings (constant 9)
missing_awayBullpenExtraInningGames (constant 0)
missing_awayBullpenGamesInPrevious3Days (constant 0)
missing_awayRunsAllowedPerGame (constant 0)
missing_awayRunsScoredPerGame (constant 0)
missing_awayStarterAvailable (constant 1)
missing_awayWinRate (constant 0)
missing_homeBullpenExtraInningGames (constant 0)
missing_homeBullpenGamesInPrevious3Days (constant 0)
missing_homeRunsAllowedPerGame (constant 0)
missing_homeRunsScoredPerGame (constant 0)
missing_homeStarterAvailable (constant 1)
missing_homeWinRate (constant 0)
missing_scheduledInnings (constant 0)

Exact constant columns:
intercept=1, value_awayStarterAvailable=0, value_homeStarterAvailable=0,
value_scheduledInnings=9, missing_awayStarterAvailable=1, missing_homeStarterAvailable=1

Collinear relationships present:
- scheduledInnings (constant 9) is collinear with intercept (constant 1)
- awayStarterAvailable (constant 0) is collinear with zero-vector subspace
- awayStarterAvailable_missing (constant 1) is collinear with intercept
- homeStarterAvailable (constant 0) is collinear with zero-vector subspace
- homeStarterAvailable_missing (constant 1) is collinear with intercept

Structural redundancy: YES

## 10. Exact global smoothness bound

For binary logistic mean loss, p(1-p) <= 1/4.

H_bound = (1 / (4 * 301)) * Z^T Z + R

where R is diagonal with:
- R[0] = 0 (intercept not regularized)
- R[j] = 0.01 for j = 1..28 (all non-intercept channels regularized)

L_GLOBAL_BOUND = 50.106496483096045
ONE_OVER_L = 0.019957491945926824
TWO_OVER_L = 0.03991498389185365
HALF_OVER_L = 0.009978745972963412

FROZEN_LEARNING_RATE = 0.1

FROZEN_LR_DIV_ONE_OVER_L = 5.010649648310
FROZEN_LR_DIV_TWO_OVER_L = 2.505324824155

## 11. Frozen LR relative to 1/L and 2/L

FROZEN_LR_WITHIN_STANDARD_1_OVER_L_DESCENT_BOUND = NO (0.1 > 0.019957491945926824)
FROZEN_LR_BELOW_TWO_OVER_L = NO (0.1 > 0.03991498389185365)

The frozen learning rate 0.1 exceeds both 1/L and 2/L by factors of approximately 5.01 and 2.51 respectively.

## 12. One-step objective diagnostic

Initial objective at theta_0 = 0: 0.6931471805599453
Objective after one frozen LR step (lr=0.1): 0.7203152033205393
Delta: +0.02716802276059397
First step decreases objective: NO

Objective after one 1/L step: 0.6911532673138675
Objective after one 0.5/L step: 0.691679450504202

Both 1/L and 0.5/L steps decrease the objective from zero initialization.

## 13. Corrected conservative root-cause classification

FIXED_STEP_OPTIMIZATION_INSTABILITY = PROVEN
FROZEN_LR_EXCEEDS_1_OVER_L_BOUND = YES
FROZEN_LR_EXCEEDS_2_OVER_L_BOUND = YES
LEARNING_RATE_TOO_AGGRESSIVE = SUPPORTED
RAW_SCALE_CONTRIBUTES_TO_L_BOUND = SUPPORTED
RAW_SCALE_IS_SOLE_ROOT_CAUSE = UNRESOLVED
STRUCTURAL_REDUNDANCY_PRESENT = YES
STRUCTURAL_REDUNDANCY_CAUSED_FAILURE = UNRESOLVED
MAX_ITERATIONS_ONLY_LIMIT = UNRESOLVED
TOLERANCE_ONLY_LIMIT = UNRESOLVED
TRAINER_IMPLEMENTATION_DEFECT = NOT_SUPPORTED
DATA_OR_LABEL_CORRUPTION = NOT_SUPPORTED

RANK_METHODS_AGREE = YES
FROZEN_LR_WITHIN_1_OVER_L = NO
FROZEN_LR_BELOW_2_OVER_L = NO

## 14. What is proven versus unresolved

Proven:
- The frozen learning rate 0.1 exceeds the standard 1/L smoothness bound.
- A single gradient step with lr=0.1 from zero initialization increases the objective.
- The design matrix has rank deficiency (rank 13 of 29) due to constant columns and linear dependencies among varying columns.
- 17 of 29 expanded channels are constant in TRAIN.
- Validation metrics are worse than trivial baselines.

Unresolved:
- Whether raw feature scale alone is the sole root cause.
- Whether structural redundancy caused the failure.
- Whether maxIterations/tolerance alone would have allowed convergence with a smaller learning rate.

## 15. V2 remediation class

V2_REMEDIATION_CLASS = OPTIMIZATION_CONFIGURATION_ONLY

A safe learning rate can be derived from TRAIN-only mathematics: lr <= 1/L where L is the smoothness bound of the objective. The current evidence proves that the frozen learning rate 0.1 violates the standard descent guarantee (0.1 > 1/L = 0.019957491945926824), and a single gradient step with lr=0.1 increases the objective. Reducing the learning rate to a value below 1/L is mathematically justified by the TRAIN-only bound.

This does NOT mean:
- lower learning rate guarantees convergence
- lower learning rate guarantees useful validation performance
- feature scaling can never help
- redundant features can never matter

CAN_A_SAFE_LR_BE_DERIVED_FROM_TRAIN_ONLY_MATH = YES
IS_STANDARDIZATION_REQUIRED_BEFORE_ANOTHER_FIT = UNRESOLVED
IS_FEATURE_REMOVAL_REQUIRED_BEFORE_ANOTHER_FIT = UNRESOLVED
IS_TRAINER_CODE_CHANGE_REQUIRED_BEFORE_ANOTHER_FIT = NO

TRAIN_ONLY_SAFE_LR_REFERENCE = lr <= 0.019957491945926824 (1/L bound)

## 16. Safe-LR mathematical reference

From the TRAIN-only smoothness bound:
L_GLOBAL_BOUND = 50.106496483096045
1/L = 0.019957491945926824

Any learning rate above 1/L violates the standard descent guarantee for gradient descent on this objective. A conservative V2 learning rate should be <= 1/L. Round numbers are not acceptable without protocol amendment.

## 17. TEST still untouched

TEST rows in matrix: 69
TEST rows scored: 0
TEST probabilities inspected: NO
TEST model metrics inspected: NO
TEST release invoked: NO

TEST remains pristine.

## 18. Pre-TEST gate requirement/design

PRE_TEST_GATE_REQUIRED = YES

PROPOSED_GATE_OWNER = prediction-owned candidate gate (src/prediction/mlb/)

PROPOSED_INPUTS:
- fit result (validated contract, identity matches, all finite)
- frozen evaluation-plan identity
- validation comparison facts (validation metrics vs. principled baselines)

PROPOSED_OUTPUT:
- ELIGIBLE_FOR_TEST
- REJECT_BEFORE_TEST

TEST_DATA_REQUIRED_BY_GATE = NO

Baseline-relative validation gating is PROPOSED, not yet frozen. Candidate principled references include:
- P50 trivial baseline (always predict 0.5)
- TRAIN-derived class prior

The exact logical combination, margins, and tie policy must be frozen in a dedicated pre-TEST gate phase BEFORE any V2 candidate is evaluated for TEST eligibility. No TEST data is used to define the gate. No V2 fit is authorized yet.

PRE_TEST_GATE_POLICY_STATUS = PROPOSED_NOT_FROZEN

## 19. Versioning requirements for any future second candidate

Any future second candidate requires:
- A new configId (e.g., mlb-real-pregame-winner-second-fit-v1)
- A new evaluation plan ID
- A protocol amendment or new protocol decision
- Must not be based on TEST performance
- Must go through the pre-TEST candidate gate

## 20. Explicit statement

FIRST REAL CANDIDATE IS REJECTED BEFORE TEST.
TEST REMAINS UNTOUCHED.
NO SECOND REAL FIT HAS BEEN AUTHORIZED BY THIS DOCUMENT.

The failed model is NOT a production model.
No betting-market information is included.
No odds-based comparisons are made.
