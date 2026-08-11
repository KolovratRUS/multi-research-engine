# MLB V1 Second Real Fit Optimizer Configuration

## 1. Locked baseline

Locked baseline: 8d55acde93ed9b8fd698b4aa096ae6525da677f8
Commit: Implement MLB pre-TEST candidate gate
Branch: main

## 2. Candidate purpose

This document freezes exactly one second-real-candidate optimizer configuration
before any second real fit occurs.

The first real candidate was rejected before TEST.

Accepted diagnosis:
- FIXED_STEP_OPTIMIZATION_INSTABILITY = PROVEN
- LEARNING_RATE_TOO_AGGRESSIVE = SUPPORTED

The next remediation is OPTIMIZATION_CONFIGURATION_ONLY.

No feature changes.
No scaling changes.
No dataset changes.
No labels changes.
No manifest changes.
No TRAIN/VALIDATION/TEST split changes.

## 3. First-fit configuration identity

FIRST_FIT_CONFIG_ID = mlb-real-pregame-winner-first-fit-v1

TRAINER_CONFIG_TYPE_SOURCE = MLBModelTrainingConfiguration
  (defined in src/prediction/mlb/mlb-model-training-plan-contract.ts)

FIRST_FIT_CONFIG:
  contractVersion: mlb-model-training-configuration-v1
  sport: MLB
  target: OFFICIAL_FINAL_GAME_WINNER
  targetEncoding: HOME_WIN_1_AWAY_WIN_0
  configId: mlb-real-pregame-winner-first-fit-v1
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

## 4. Second-fit configuration

SECOND_FIT_CONFIG_ID = mlb-real-pregame-winner-second-fit-v1

SECOND_FIT_CONFIG:
  contractVersion: mlb-model-training-configuration-v1
  sport: MLB
  target: OFFICIAL_FINAL_GAME_WINNER
  targetEncoding: HOME_WIN_1_AWAY_WIN_0
  configId: mlb-real-pregame-winner-second-fit-v1
  algorithm: L2_LOGISTIC_REGRESSION_BINARY_V1
  randomnessPolicy: NO_RANDOMNESS
  featureValuePolicy: RAW_FINITE_FEATURE_VALUES
  missingIndicatorPolicy: PRESERVE_WAS_MISSING_FLAGS
  regularization.kind: L2
  regularization.strength: 0.01
  optimization.solver: DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1
  optimization.learningRate: 0.01
  optimization.maxIterations: 1000
  optimization.tolerance: 0.0001

## 5. Change surface

ONLY_CHANGED_HYPERPARAMETER = learningRate

LEARNING_RATE_CHANGE = 0.1 -> 0.01
L2_CHANGE = NONE
MAX_ITERATIONS_CHANGE = NONE
TOLERANCE_CHANGE = NONE
FEATURE_CHANGE = NONE
DATA_CHANGE = NONE

## 6. Mathematical justification

TRAIN-only stability references (from committed remediation evidence):

L = 50.106496483096045
1/L = 0.019957491945926824
0.5/L = 0.009978745972963412
2/L = 0.03991498389185365

0.01 < 1/L
0.01 approximately matches the conservative 0.5/L reference.

This is a TRAIN-only mathematical optimization choice.
It is NOT selected from validation performance.

Do not describe 0.01 as empirically optimal.
It is a conservative deterministic remediation candidate.

## 7. Frozen data/model identities

The second fit must use the exact existing frozen:

- historical dataset
- training matrix
- feature manifest
- feature ordering
- split policy
- evaluation protocol
- target definition
- algorithm family

Exact identities from authoritative repo documentation:

DATASET_ID = mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360
MATRIX_ID = mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360::mlb-real-pregame-winner-feature-manifest-v1
MANIFEST_ID = mlb-real-pregame-winner-feature-manifest-v1
TRAINING_MATRIX_SHA256 = 5c730f9e286750c232a5e13e1be3553a40d463bb923f4f0e8dcbcd8ce8b5495e
SPLIT_POLICY = CHRONOLOGICAL_OFFICIAL_DATE_V1
PROTOCOL = TRAIN_FIT_VALIDATION_SELECT_TEST_FINAL_V1
TARGET = OFFICIAL_FINAL_GAME_WINNER
TARGET_ENCODING = HOME_WIN_1_AWAY_WIN_0
ALGORITHM = L2_LOGISTIC_REGRESSION_BINARY_V1

Do not rematerialize them.

## 8. Fit budget

SECOND_REAL_FIT_INVOCATION_BUDGET = 1

No automatic retry.
No adaptive learning-rate adjustment after seeing validation.
No third candidate automatically created.

## 9. Pre-TEST gate

After the second fit:

1. evaluate TRAIN/VALIDATION result through:
   evaluateMLBPretestCandidateGate

2. if:
   REJECT_BEFORE_TEST

   then STOP.

   TEST remains untouched.

3. only if:
   ELIGIBLE_FOR_TEST

   may a later, separately authorized phase touch TEST.

This document does NOT authorize TEST.

## 10. Failure behavior

If the second fit:

- does not converge
- produces invalid/nonfinite output
- fails validation references
- fails contract validation

STOP.

Do not retry.

Return to diagnosis.

## 11. Odds-blind statement

No sportsbook/market information influences training,
configuration selection, prediction, qualification, or later recommendation logic.
