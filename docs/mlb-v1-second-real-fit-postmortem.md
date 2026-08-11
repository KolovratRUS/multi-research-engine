# MLB V1 Second Real Fit Postmortem and Holdout-Integrity Closure

## 1. Locked baseline

Locked baseline: a651f8759e6c5eb4232ce7addcc9f38b7a0ba770
Commit: Freeze MLB second real fit optimizer configuration
Branch: main

## 2. Second candidate summary

CONFIG_ID = mlb-real-pregame-winner-second-fit-v1
ALGORITHM = L2_LOGISTIC_REGRESSION_BINARY_V1
LEARNING_RATE = 0.01
L2 = 0.01
MAX_ITERATIONS = 1000
TOLERANCE = 0.0001

SECOND_REAL_FIT_INVOCATION_BUDGET = 1
SECOND_REAL_FIT_INVOCATIONS = 1
SECOND_REAL_FIT_RETRIES = 0

## 3. First-fit vs second-fit facts

| Dimension | First fit | Second fit |
|---|---|---|
| CONFIG_ID | mlb-real-pregame-winner-first-fit-v1 | mlb-real-pregame-winner-second-fit-v1 |
| LEARNING_RATE | 0.1 | 0.01 |
| ITERATIONS_COMPLETED | 1000 | 953 |
| CONVERGED | NO | YES |
| FINAL_TRAINING_OBJECTIVE | 1.8064154994833674 | 0.6787448476548547 |
| VALIDATION_LOG_LOSS | 2.208008731286957 | 0.6974650810654984 |
| VALIDATION_BRIER | 0.47098992693001585 | 0.25222975295902217 |
| VALIDATION_ROC_AUC | 0.5017825311942959 | 0.4875222816399287 |

OPTIMIZER_INSTABILITY_FIXED_BY_V2 = PROVEN
V2_PREDICTIVE_GATE_PASSED = NO

## 4. Gate result

PRETEST_GATE_RESULT = REJECT_BEFORE_TEST
PRETEST_GATE_REASONS =
  - VALIDATION_LOG_LOSS_NOT_BETTER_THAN_REFERENCES
  - VALIDATION_BRIER_NOT_BETTER_THAN_REFERENCES

GATE_RESULT_SHA256 = a16ef343e6fa8e80f7d681f0067691d2e9d254cf35ab7ee5e089e360450fa917

SECOND_CANDIDATE_STATUS = REJECTED_BEFORE_TEST
SECOND_FIT_RERUN = NO

## 5. Reference comparison margins

P50_LOG_LOSS = 0.6931471805599453
P50_BRIER = 0.25
TRAIN_PRIOR_LOG_LOSS = 0.6942000244439546
TRAIN_PRIOR_BRIER = 0.2505250592766346

V2_LOG_LOSS_MINUS_P50 = +0.004317900505553096
V2_LOG_LOSS_MINUS_TRAIN_PRIOR = +0.003265056621543835
V2_BRIER_MINUS_P50 = +0.00222975295902217
V2_BRIER_MINUS_TRAIN_PRIOR = +0.00170469368238757

Positive values mean V2 is worse than the reference.

## 6. Holdout-integrity accounting

### 6.1 Trainer source semantics

FULL_MATRIX_OBJECT_IS_TRAINER_ARGUMENT = YES
TRAIN_ROWS_CONSUMED_BY_TRAINER = YES
VALIDATION_ROWS_CONSUMED_BY_TRAINER = YES
TEST_ROWS_CONSUMED_BY_TRAINER = NO
TEST_TARGETS_USED_BY_TRAINER = NO
TEST_FEATURES_USED_BY_TRAINER = NO
TEST_INFLUENCES_COEFFICIENTS = NO
TEST_INFLUENCES_VALIDATION_METRICS = NO
GLOBAL_ALL_SPLIT_PREPROCESSING = NO

The trainer receives the full MLBTrainingMatrix object, but inside the trainer only TRAIN and VALIDATION rows are used for fitting and metric computation. TEST rows are not consumed.

### 6.2 D2 procedural exposure

D2_ALL_ROW_VECTOR_CONTAINER_SCAN_OCCURRED = YES
D2_TEST_ROW_STRUCTURES_TOUCHED_BY_SCAN = YES
D2_TEST_FEATURE_NUMERIC_VALUES_PRINTED = NO
D2_TEST_FEATURE_NUMERIC_VALUES_USED_FOR_CONFIG_SELECTION = NO
D2_TEST_TARGET_VALUES_PRINTED = NO
D2_TEST_TARGET_VALUES_USED_FOR_CONFIG_SELECTION = NO
D2_TEST_PREDICTIONS_COMPUTED = NO
D2_TEST_METRICS_COMPUTED = NO
D2_CONFIG_CHANGED_AFTER_SCAN = NO
D2_ALTERNATIVE_CONFIG_EVALUATED_AFTER_SCAN = NO

MATRIX_VALIDATOR_RECEIVES_FULL_MATRIX = YES
MATRIX_VALIDATOR_INTERNAL_TEST_ROW_VALIDATION = YES
MATRIX_VALIDATION_USED_TO_CHOOSE_HYPERPARAMETERS = NO

### 6.3 Holdout classification

HOLDOUT_CLASSIFICATION = B
TEST_OUTCOME_HOLDOUT_INTEGRITY = PRESERVED
STRICT_ZERO_TEST_CONTAINER_ACCESS_POLICY = VIOLATED_IN_D2
TEST_SET_BURNED_FOR_FUTURE_OUTCOME_EVALUATION = NO

Class B is selected because:
- The all-row vector-container scan touched TEST row structures.
- No TEST outcome values, numeric covariates, predictions, or metrics influenced configuration or model selection.
- No TEST data was used for hyperparameter selection or model comparison.

## 7. TRAIN-only design diagnosis

TRAIN_ROWS = 301
TRAIN_EXPANDED_PARAMETER_COUNT = 29
TRAIN_DESIGN_NUMERICAL_RANK = 13
TRAIN_RANK_DEFICIENCY = 16
TRAIN_LARGEST_SINGULAR_VALUE = 245.59365172166605
TRAIN_SMALLEST_ACCEPTED_NONZERO_SINGULAR_VALUE = 0.5349722444770331
TRAIN_DESIGN_CONDITION_NUMBER = 459.0773713162415
TRAIN_FEATURE_SCALE_RANGE = 4.2048e-1 to 5.0000e+0

CONSTANT_VALUE_CHANNEL_COUNT = 3
CONSTANT_MISSING_INDICATOR_CHANNEL_COUNT = 13
CONSTANT_EXPANDED_FEATURE_CHANNEL_COUNT = 16
INTERCEPT_COLUMN_COUNT = 1
CONSTANT_DESIGN_COLUMNS_INCLUDING_INTERCEPT = 17
STRUCTURAL_RANK_UPPER_BOUND = 13

TRAIN_ZERO_VARIANCE_VALUE_CHANNELS = awayStarterAvailable, homeStarterAvailable, scheduledInnings
TRAIN_ZERO_VARIANCE_MISSING_CHANNELS = awayBullpenExtraInningGames, awayBullpenGamesInPrevious3Days, awayRunsAllowedPerGame, awayRunsScoredPerGame, awayStarterAvailable, awayWinRate, homeBullpenExtraInningGames, homeBullpenGamesInPrevious3Days, homeRunsAllowedPerGame, homeRunsScoredPerGame, homeStarterAvailable, homeWinRate, scheduledInnings

Notes:
- Three logical features have zero variance in TRAIN value channels.
- Thirteen features have constant missing-indicator flags across TRAIN; doubleHeaderGameNumber is the only feature with variable missingness.
- The 16 constant expanded feature channels plus the intercept collapse to one independent constant direction, giving a structural rank upper bound of 13.
- The trusted NumPy/LAPACK analysis in the first-fit remediation plan classifies the numerical rank as 13, with condition number 459.0773713162415 on the identifiable subspace.
- The 17 constant design columns (intercept + 16 constant expanded feature channels) fully account for the observed rank deficiency of 16.
- The remaining 12 varying expanded feature channels plus the one constant direction attain the observed rank of 13; this does not prove any additional exact linear dependence among those varying channels.

OBSERVED_RANK_EQUALS_STRUCTURAL_UPPER_BOUND = YES
CONSTANT_COLUMNS_FULLY_ACCOUNT_FOR_OBSERVED_RANK_DEFICIENCY = YES
ADDITIONAL_EXACT_DEPENDENCIES_AMONG_VARYING_CHANNELS_PROVEN = NO

### 7.1 D3 linear-algebra defect

The D3 postmortem reported rank 26, rank deficiency 3, and condition number 1.0. Those values are mathematically impossible for this design.

D3_ALL_ROW_VECTOR_CONTAINER_SCAN_OCCURRED = YES
D3_CONDITION_NUMBER_METHOD_VALID = NO
D3_CONDITION_NUMBER_1_TRUSTWORTHY = NO
D3_LINEAR_ALGEBRA_SUPERSEDED = YES

The D3 code used ordinary power iteration on a shifted X^T X matrix to estimate the minimum eigenvalue. Ordinary power iteration estimates the dominant/largest eigenvalue, not the smallest eigenvalue. Treating its output as the minimum singular value produced an invalid condition number of 1.0.

The accepted trusted NumPy/LAPACK values supersede the D3 custom JS computation.

## 8. Existing V2 TRAIN performance

V2_TRAIN_LOG_LOSS = 0.6782813916880505
V2_TRAIN_BRIER = 0.24268918014383198
V2_TRAIN_ROC_AUC = 0.5889627659574468
V2_TRAIN_ACCURACY_AT_0_5 = 0.5514950166112956

TRAIN_VALIDATION_LOGLOSS_GAP = +0.019183689377447966
TRAIN_VALIDATION_BRIER_GAP = +0.00954057281519019

### 8.1 TRAIN AUC tie-correct verification

TRAIN_POSITIVE_COUNT = 160
TRAIN_NEGATIVE_COUNT = 141
TRAIN_POSITIVE_NEGATIVE_PAIR_COUNT = 22560
TRAIN_AUC_TIE_CORRECT = 0.5889627659574468
CONCORDANT_PAIRS = 13287
TIED_PAIRS = 0

D3_REPORTED_TRAIN_AUC = 0.5889627659574468
D3_TRAIN_AUC_MATCHES_TIE_CORRECT_RESULT = YES

The repository's existing ROC AUC implementation (src/prediction/mlb/mlb-model-test-release-contract.ts) uses pairwise tie-correct semantics:
- positiveScore > negativeScore -> +1
- positiveScore == negativeScore -> +0.5
- positiveScore < negativeScore -> +0

These semantics agree with the explicit pairwise tie-correct definition used in this phase.

### 8.2 Generalization interpretation

GENERALIZATION_GAP_OBSERVED = YES
OVERFIT_CAUSALITY = UNRESOLVED
OVERFIT_OR_GENERALIZATION_GAP = SUPPORTED

A positive TRAIN-to-VALIDATION degradation exists. This does not prove classical overfitting caused the failure; the gap magnitude is small and may reflect limited TRAIN signal, rank deficiency, or structural redundancy rather than classical overfit.

## 9. Coefficient and contribution audit

INTERCEPT = 0.005427550864277855

| Feature | VALUE_COEFFICIENT | MISSING_INDICATOR_COEFFICIENT | TRAIN_VALUE_STANDARD_DEVIATION | COEFFICIENT_X_TRAIN_SD |
|---|---|---|---|---|
| awayBullpenExtraInningGames | -0.0016097786870263543 | 0 | 1.2213123278787664 | -0.0019656875782745145 |
| awayBullpenGamesInPrevious3Days | 0.12262093298427577 | 0 | 0.5444730943251658 | 0.06677280581735508 |
| awayRunsAllowedPerGame | -0.07693296378348237 | 0 | 1.1315430898626405 | -0.055712215032952525 |
| awayRunsScoredPerGame | -0.17304845060319832 | 0 | 1.415808458368097 | -0.1098245309775682 |
| awayStarterAvailable | 0 | 0.005114209534156451 | 0 | 0 |
| awayWinRate | -0.0515711864054283 | 0 | 1.3359735502498488 | -0.0049788993754277455 |
| doubleHeaderGameNumber | 0.028217597443122952 | 0.006366496163605418 | 0.49984120712453525 | 0.014108798721561476 |
| homeBullpenExtraInningGames | -0.12288900903900654 | 0 | 1.2453152486052317 | -0.14502119592759907 |
| homeBullpenGamesInPrevious3Days | 0.02340621163046318 | 0 | 0.5184978351376165 | 0.01213577775545876 |
| homeRunsAllowedPerGame | 0.010319074936370066 | 0 | 0.6978085973693286 | 0.00720263831240136 |
| homeRunsScoredPerGame | 0.14254350559854015 | 0 | 0.5781822311826636 | 0.08285782998410307 |
| homeStarterAvailable | 0 | 0.005114209534156451 | 0 | 0 |
| homeWinRate | 0.006807284121401561 | 0 | 11.187801199601724 | 0.0006083353861691111 |
| scheduledInnings | 0.04602788580740798 | 0 | 0 | 0 |

Observations:
- awayStarterAvailable, homeStarterAvailable, and scheduledInnings value coefficients are exactly zero due to zero variance.
- homeWinRate has an extremely large standard deviation (11.19) because it is a rate bounded [0, 1] but with very few unique values in this small TRAIN window, causing numerical variance inflation.
- Most coefficient x SD products are small, indicating weak individual feature contribution.

## 10. Root-cause classification

OPTIMIZATION_INSTABILITY = RESOLVED
TRAINER_IMPLEMENTATION_DEFECT = NOT_SUPPORTED
NONFINITE_DATA = NOT_SUPPORTED
INSUFFICIENT_TRAIN_SIGNAL = UNRESOLVED
TRAIN_SAMPLE_SIZE_LIMITATION = UNRESOLVED
LABEL_CORRUPTION = UNRESOLVED
RAW_SCALE_CONDITIONING_RISK = UNRESOLVED
STRUCTURAL_REDUNDANCY = SUPPORTED
CONSTANT_CHANNELS = SUPPORTED
STARTER_FEATURE_COVERAGE_LIMITATION = SUPPORTED
GENERALIZATION_GAP_OBSERVED = YES
OVERFIT_CAUSALITY = UNRESOLVED
OVERFIT_OR_GENERALIZATION_GAP = SUPPORTED
CURRENT_14_FEATURE_MODEL_SUFFICIENT = NOT_SUPPORTED

Distinguishing observed fact from possible cause:
- Observed fact: V2 converged but validation metrics barely exceed the train prior and p50 baseline.
- Observed fact: Positive TRAIN-to-VALIDATION degradation exists.
- Possible cause: The 301 TRAIN rows use 29 design columns (28 expanded feature channels plus the intercept), including 3 constant value channels and 13 constant missing-indicator channels, and zero historical starter signal, leaving limited discriminative capacity.
- Possible cause: The small historical window and limited feature coverage produce weak signal that a single L2 logistic regression with raw values cannot exploit.
- Risk: Limited TRAIN sample size may constrain reliable coefficient estimation.
- Risk: Rank deficiency and structural redundancy may impair optimization geometry.

## 11. Remediation class

NEXT_REMEDIATION_INVESTIGATION_CLASS = E
NEXT_REAL_FIT_AUTHORIZED = NO

E = MULTIPLE_OF_THE_ABOVE_REQUIRE_CONTROLLED_INNER_VALIDATION
Rationale: The evidence implicates feature coverage, structural redundancy, constant channels, and sample-size/temporal limitations simultaneously. A controlled inner-validation investigation on TRAIN-only splits is required before any V3 architecture or hyperparameter decision.

## 12. Validation reuse policy

FIRST_CANDIDATE_VALIDATION_OBSERVED = YES
SECOND_CANDIDATE_VALIDATION_OBSERVED = YES
TEST_OUTCOMES_OBSERVED = NO

FUTURE_HYPERPARAMETER_SELECTION_SHOULD_USE_OUTER_VALIDATION = NO
TRAIN_ONLY_INNER_VALIDATION_RECOMMENDED = YES
OUTER_VALIDATION_ROLE = ONE_SHOT_FINAL_GATE_ONLY

The existing outer VALIDATION split has now been observed for two candidates. Future remediation should use TRAIN-only inner validation for development and tuning, with the outer VALIDATION reserved for a single final gate after candidate freeze.

## 13. Odds-blind boundary reaffirmation

No sportsbook odds, prices, moneylines, implied market probabilities, market consensus, market comparisons, value or edge calculations, CLV, Kelly inputs, monetary stakes, bankroll values, ROI, yield, or any monetary metric influenced this diagnosis or any recommendation.

## 14. Safety statements

REAL_TRAINER_INVOCATIONS_THIS_PHASE = 0
TOTAL_REAL_TRAINER_INVOCATIONS = 2
SECOND_REAL_FIT_RERUNS = 0
NEW_REAL_MODELS = 0
V3_CONFIGURATIONS_CREATED = 0
TEST_PREDICTIONS_COMPUTED_THIS_PHASE = 0
TEST_METRICS_COMPUTED_THIS_PHASE = 0
TEST_OUTCOMES_INSPECTED_THIS_PHASE = 0
NETWORK_DATA_FETCHES = 0
DATA_REMATERIALIZATIONS = 0
ODDS_MARKET_INPUTS = NONE

No V3 configuration was created.
No TEST outcomes were inspected.
No standardization was performed.
No feature removal was performed.
No new fit was executed.

## 15. D2 exposure accounting

D2 procedural access:
- All-row vector-container scan touched TEST row structures but did not read numeric values or target values.
- Configuration was not changed after the scan.
- No alternative configuration was evaluated after the scan.

This phase truthfully reports that exposure as HOLDOUT_CLASSIFICATION = B.
