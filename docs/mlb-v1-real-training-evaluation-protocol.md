# MLB V1 Real Training Evaluation Protocol

## 1. Purpose

This protocol qualifies the first bounded real MLB trainer execution from the committed doubleheader-repair baseline. It records the exact frozen corpus boundaries, artifact hashes, dataset structure, matrix parity, missingness, starter-coverage truth, doubleheader repair provenance, trainer source semantics, first trainer configuration, first evaluation plan, and first-execution rules. It does not qualify the model for production deployment.

## 2. Locked baseline

Locked baseline: 4b6382817577ef8a1fa1e91dd8a7e94608dfd7a5
Commit: Fix MLB historical doubleheader normalization
Branch: main

## 3. Permanent odds-blind boundary

Phase 8V-D3-C-A-R2 accepts no sportsbook odds, prices, moneylines, implied market probabilities, market consensus, market comparisons, value or edge calculations, CLV, Kelly inputs, monetary stakes, bankroll values, ROI, yield, or any monetary metric. Historical outcomes are used only as supervised target and evaluation truth.

## 4. Historical source pipeline

Raw schedule rows are loaded from the MLB historical schedule API for the frozen date range, normalized by the committed schedule-loader repair (raw N -> false, raw Y -> true, raw S -> true), and then passed through the historical materialization source adapter. The adapter enforces unique gamePk identity, selects single-FINAL records, and rejects ambiguous duplicate groups. The resulting canonical schedule population is then materialized into the historical labelled dataset and the real pregame winner training matrix.

## 5. Frozen chronology-selection rule

The date boundaries were selected chronologically from canonical schedule volume only, before target or performance inspection. They remain frozen and are not changed by target distribution, model performance, feature values, missingness, validation metrics, or test metrics.

## 6. Exact date range

Start date: 2026-04-01
Train end date: 2026-04-23
Validation end date: 2026-04-28
Test end date: 2026-05-03
Overall end date: 2026-05-03

## 7. TRAIN boundary

TRAIN rows are those whose officialDate is <= 2026-04-23 inclusive. The raw schedule population contains 304 records in this range. After canonicalization the dataset contains 301 TRAIN rows.

## 8. VALIDATION boundary

VALIDATION rows are those whose officialDate is between 2026-04-24 and 2026-04-28 inclusive. The raw schedule population contains 68 records in this range. After canonicalization the dataset contains 67 VALIDATION rows.

## 9. TEST boundary

TEST rows are those whose officialDate is between 2026-04-29 and 2026-05-03 inclusive. The raw schedule population contains 71 records in this range. After canonicalization the dataset contains 69 TEST rows.

## 10. 360-minute cutoff

The pregame snapshot cutoff is 360 minutes before scheduled start. Only snapshots captured at or before this cutoff are eligible for the dataset.

## 11. Raw schedule counts

RAW_TRAIN_RECORDS = 304
RAW_VALIDATION_RECORDS = 68
RAW_TEST_RECORDS = 71
RAW_TOTAL_RECORDS = 443
RAW_UNIQUE_GAMEPKS = 437
RAW_DUPLICATE_GAMEPK_GROUPS = 6
RAW_DUPLICATE_EXTRA_RECORDS = 6

The raw counts above reflect MLB API schedule rows BEFORE source-adapter duplicate normalization. They are NOT canonical game counts.

## 12. Canonical schedule counts

CANONICAL_TRAIN_GAMES = 301
CANONICAL_VALIDATION_GAMES = 67
CANONICAL_TEST_GAMES = 69
CANONICAL_TOTAL_GAMES = 437

These counts match the dataset split rows exactly.

## 13. Raw duplicate/canonicalization findings

The raw schedule population contains 6 duplicate gamePk groups: 823471, 823637, 824134, 824460, 824621, 824850. The schedule bucket date may differ between the postponed and rescheduled occurrences within a group, but officialDate is stable within each canonical identity group. Each group contains exactly one FINAL record and one non-FINAL record. The source-adapter canonicalization rule requires stable homeTeamId, awayTeamId, rawGameType, officialDate, and venueId within a duplicate group; any conflict throws a conflicting canonical identity error. The rule then selects the single FINAL record per group. All 6 groups are canonically resolvable.

UNIQUE_FINAL_CANONICALIZABLE_GROUPS = 6
AMBIGUOUS_RAW_DUPLICATE_GROUPS = 0

Canonical split assignment for each duplicate group:
- 824621 -> TRAIN (2026-04-03)
- 824134 -> TRAIN (2026-04-04)
- 824460 -> TRAIN (2026-04-05)
- 823637 -> VALIDATION (2026-04-26)
- 823471 -> TEST (2026-04-30)
- 824850 -> TEST (2026-04-30)

## 14. Dataset contractVersion

mlb-historical-labelled-dataset-v1

## 15. Dataset ID

mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360

## 16. Dataset createdAt

2026-08-11T04:36:59.590Z

## 17. Dataset SHA-256

e6730f3b9f8e5b0e32958e1997ff804f1b66cb9c323cc992a55a9d8882d742a7

## 18. Exact split rows

TRAIN = 301
VALIDATION = 67
TEST = 69
TOTAL = 437

## 19. Exact split date ranges

TRAIN_ACTUAL_DATE_RANGE = 2026-04-01 to 2026-04-23
VALIDATION_ACTUAL_DATE_RANGE = 2026-04-24 to 2026-04-28
TEST_ACTUAL_DATE_RANGE = 2026-04-29 to 2026-05-03

## 20. Target distributions

TRAIN_HOME_WIN_1 = 160
TRAIN_AWAY_WIN_0 = 141
VALIDATION_HOME_WIN_1 = 34
VALIDATION_AWAY_WIN_0 = 33
TEST_HOME_WIN_1 = 36
TEST_AWAY_WIN_0 = 33

## 21. Matrix contractVersion

mlb-training-matrix-v1

## 22. Matrix ID

mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360::mlb-real-pregame-winner-feature-manifest-v1

## 23. Matrix dataset ID

mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360

## 24. Matrix SHA-256

5c730f9e286750c232a5e13e1be3553a40d463bb923f4f0e8dcbcd8ce8b5495e

## 25. Manifest ID

mlb-real-pregame-winner-feature-manifest-v1

## 26. Manifest fingerprint

8d5c2077c52359a429ddfed074ebbb7541df40fb5bfec9d468dd4ac76706e101

## 27. Exact 14 features

1. awayBullpenExtraInningGames
2. awayBullpenGamesInPrevious3Days
3. awayRunsAllowedPerGame
4. awayRunsScoredPerGame
5. awayStarterAvailable
6. awayWinRate
7. doubleHeaderGameNumber
8. homeBullpenExtraInningGames
9. homeBullpenGamesInPrevious3Days
10. homeRunsAllowedPerGame
11. homeRunsScoredPerGame
12. homeStarterAvailable
13. homeWinRate
14. scheduledInnings

## 28. Full vector parity

extractMLBRealPregameWinnerFeatureVectorV1 applied to every 437 dataset snapshot produces vectors that match the stored matrix row vectors in featureId, value, wasMissing, and ordering.

ROW_VECTOR_FULL_PARITY = 437 / 437
ROW_VECTOR_VALUE_MISMATCHES = 0
ROW_VECTOR_MISSINGNESS_MISMATCHES = 0
ROW_VECTOR_ORDER_MISMATCHES = 0

## 29. Feature missingness by split

TRAIN:
awayBullpenExtraInningGames: 301 observed / 0 missing
awayBullpenGamesInPrevious3Days: 301 observed / 0 missing
awayRunsAllowedPerGame: 301 observed / 0 missing
awayRunsScoredPerGame: 301 observed / 0 missing
awayStarterAvailable: 0 observed / 301 missing
awayWinRate: 301 observed / 0 missing
doubleHeaderGameNumber: 4 observed / 297 missing
homeBullpenExtraInningGames: 301 observed / 0 missing
homeBullpenGamesInPrevious3Days: 301 observed / 0 missing
homeRunsAllowedPerGame: 301 observed / 0 missing
homeRunsScoredPerGame: 301 observed / 0 missing
homeStarterAvailable: 0 observed / 301 missing
homeWinRate: 301 observed / 0 missing
scheduledInnings: 301 observed / 0 missing

VALIDATION:
awayBullpenExtraInningGames: 67 observed / 0 missing
awayBullpenGamesInPrevious3Days: 67 observed / 0 missing
awayRunsAllowedPerGame: 67 observed / 0 missing
awayRunsScoredPerGame: 67 observed / 0 missing
awayStarterAvailable: 0 observed / 67 missing
awayWinRate: 67 observed / 0 missing
doubleHeaderGameNumber: 2 observed / 65 missing
homeBullpenExtraInningGames: 67 observed / 0 missing
homeBullpenGamesInPrevious3Days: 67 observed / 0 missing
homeRunsAllowedPerGame: 67 observed / 0 missing
homeRunsScoredPerGame: 67 observed / 0 missing
homeStarterAvailable: 0 observed / 67 missing
homeWinRate: 67 observed / 0 missing
scheduledInnings: 67 observed / 0 missing

TEST:
awayBullpenExtraInningGames: 69 observed / 0 missing
awayBullpenGamesInPrevious3Days: 69 observed / 0 missing
awayRunsAllowedPerGame: 69 observed / 0 missing
awayRunsScoredPerGame: 69 observed / 0 missing
awayStarterAvailable: 0 observed / 69 missing
awayWinRate: 69 observed / 0 missing
doubleHeaderGameNumber: 4 observed / 65 missing
homeBullpenExtraInningGames: 69 observed / 0 missing
homeBullpenGamesInPrevious3Days: 69 observed / 0 missing
homeRunsAllowedPerGame: 69 observed / 0 missing
homeRunsScoredPerGame: 69 observed / 0 missing
homeStarterAvailable: 0 observed / 69 missing
homeWinRate: 69 observed / 0 missing
scheduledInnings: 69 observed / 0 missing

## 30. TRAIN constant logical features

awayStarterAvailable is constant across all 301 TRAIN rows (value 0).
homeStarterAvailable is constant across all 301 TRAIN rows (value 0).
scheduledInnings is constant across all 301 TRAIN rows (value 9).
No other logical feature is constant.

TRAIN_CONSTANT_LOGICAL_FEATURES = awayStarterAvailable, homeStarterAvailable, scheduledInnings

## 31. TRAIN constant and variable missing indicators

Most features have a constant missing-indicator value across all TRAIN rows. doubleHeaderGameNumber is the only feature with both observed and missing rows in TRAIN, so its missing-indicator flag varies.

TRAIN_CONSTANT_MISSING_INDICATORS = awayBullpenExtraInningGames, awayBullpenGamesInPrevious3Days, awayRunsAllowedPerGame, awayRunsScoredPerGame, awayStarterAvailable, awayWinRate, homeBullpenExtraInningGames, homeBullpenGamesInPrevious3Days, homeRunsAllowedPerGame, homeRunsScoredPerGame, homeStarterAvailable, homeWinRate, scheduledInnings
TRAIN_VARIABLE_MISSING_INDICATORS = doubleHeaderGameNumber

## 32. Starter-coverage truth

The canonical pregame snapshot schema defines startingPitchers.home and startingPitchers.away, each with state, pitcherId, announcedAt, and sourceRefIds. In the qualified real historical corpus every starter record has state = UNAVAILABLE, pitcherId = null, announcedAt = null, and sourceRefIds = [].

The feature-vector manifest maps starter sections through payloadPath ['availability'] with missingPolicy USE_DEFAULT and defaultValue 0. When the section payload is empty or missing, the extractor emits value 0 with wasMissing = true.

Therefore UNAVAILABLE snapshot state maps to model-visible feature value 0 with wasMissing true. This is not an observed probable starter with value zero.

TRAIN_home_AVAILABLE = 0
TRAIN_home_UNAVAILABLE = 301
TRAIN_home_UNKNOWN = 0
TRAIN_away_AVAILABLE = 0
TRAIN_away_UNAVAILABLE = 301
TRAIN_away_UNKNOWN = 0
VALIDATION_home_AVAILABLE = 0
VALIDATION_home_UNAVAILABLE = 67
VALIDATION_home_UNKNOWN = 0
VALIDATION_away_AVAILABLE = 0
VALIDATION_away_UNAVAILABLE = 67
VALIDATION_away_UNKNOWN = 0
TEST_home_AVAILABLE = 0
TEST_home_UNAVAILABLE = 69
TEST_home_UNKNOWN = 0
TEST_away_AVAILABLE = 0
TEST_away_UNAVAILABLE = 69
TEST_away_UNKNOWN = 0
probablePitcherId non-null = 0
announcedAt non-null = 0
source/provenance present = 0

ACTUAL_FINAL_STARTER_SUBSTITUTIONS = 0

## 33. Historical-to-live starter coverage shift

The canonical snapshot schema supports CONFIRMED, PROBABLE, UNCONFIRMED, and UNAVAILABLE states. Historical snapshots in this corpus are entirely UNAVAILABLE. Live snapshots MAY contain CONFIRMED or PROBABLE starters. Therefore:

LIVE_STARTER_MAY_BE_OBSERVED = YES
HISTORICAL_TO_LIVE_STARTER_COVERAGE_SHIFT = YES

## 34. Doubleheader normalization repair provenance

The committed baseline contains the repair in src/lib/backtesting/mlb/live-history/schedule-loader.ts line 108. The repair maps raw doubleHeader 'S' to normalized true, alongside 'Y' -> true and 'N' -> false.

N -> false
Y -> true
S -> true

## 35. Doubleheader coverage after repair

RAW_DOUBLEHEADER_N = 433
RAW_DOUBLEHEADER_Y = 6
RAW_DOUBLEHEADER_S = 4
RAW_DOUBLEHEADER_OTHER = 0

In the matrix feature doubleHeaderGameNumber:
TOTAL_DH_OBSERVED = 10
TOTAL_DH_MISSING = 427
DH_VALUES = 1, 2

## 36. Known restored S games

The four known restored S-doubleheader games and their matrix values:

824132: split TEST, value 1, wasMissing false
824134: split TRAIN, value 2, wasMissing false
823471: split TEST, value 2, wasMissing false
823472: split VALIDATION, value 1, wasMissing false

POST_REPAIR_CONTEXT_LOSSES = 0

## 37. Finite-value audit

TOTAL_MODEL_VISIBLE_LOGICAL_VALUES = 6118
NONFINITE_LOGICAL_VALUES = 0
INVALID_MISSING_INDICATOR_VALUES = 0

## 38. Matrix determinism

Two independent materializations of training-matrix-a.json and training-matrix-b.json from the same qualified dataset produce byte-identical files.

MATRIX_A_SHA256 = 5c730f9e286750c232a5e13e1be3553a40d463bb923f4f0e8dcbcd8ce8b5495e
MATRIX_B_SHA256 = 5c730f9e286750c232a5e13e1be3553a40d463bb923f4f0e8dcbcd8ce8b5495e
BYTE_IDENTICAL = YES

## 39. First real trainer configuration

FIRST REAL TRAINER CONFIGURATION IS PREDECLARED BEFORE ANY REAL MODEL FIT.

The numerical values are the frozen V1 baseline configuration, not a claim of optimized or best-performing hyperparameters. No validation/test performance was used to select them.

CONFIG_ID = mlb-real-pregame-winner-first-fit-v1
CONTRACT_VERSION = mlb-model-training-configuration-v1
SPORT = MLB
TARGET = OFFICIAL_FINAL_GAME_WINNER
TARGET_ENCODING = HOME_WIN_1_AWAY_WIN_0
ALGORITHM = L2_LOGISTIC_REGRESSION_BINARY_V1
RANDOMNESS_POLICY = NO_RANDOMNESS
FEATURE_VALUE_POLICY = RAW_FINITE_FEATURE_VALUES
MISSING_INDICATOR_POLICY = PRESERVE_WAS_MISSING_FLAGS
REGULARIZATION_KIND = L2
REGULARIZATION_STRENGTH = 0.01
OPTIMIZATION_SOLVER = DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1
LEARNING_RATE = 0.1
MAX_ITERATIONS = 1000
TOLERANCE = 0.0001

These values MUST NOT be changed during C-B based on TRAIN behavior, VALIDATION metrics, TEST metrics, target distribution, coefficient values, probability outputs, model accuracy, convergence speed observed on the real corpus, or any betting or market information.

## 40. Configuration semantics

algorithm = deterministic binary logistic regression
randomness = none
feature values = raw finite logical values
missingness = explicit missing indicator coefficient per feature
regularization = L2
optimizer = deterministic batch gradient descent

TRAIN = only split used for coefficient fitting
VALIDATION = metrics from fitted coefficients
TEST = not consumed by fitAndEvaluateMLBDeterministicLogisticRegression

## 41. First-execution failure policy

FIRST_REAL_FIT_ATTEMPTS = 1
AUTOMATIC_HYPERPARAMETER_RETRIES = 0
HYPERPARAMETER_SEARCH = NONE

If the fit:
- throws
- fails validation
- produces non-finite coefficients
- produces an invalid model
- violates deterministic contract invariants
- cannot complete under the exact frozen configuration

then: STOP FOR CHATGPT REVIEW

Do NOT alter hyperparameters automatically.
A future configuration change, if ever justified, must be a new explicitly versioned protocol decision and may not be based on TEST performance.

## 42. First real evaluation plan

EVALUATION_PLAN_ID = mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360::mlb-real-pregame-winner-feature-manifest-v1::mlb-real-pregame-winner-first-fit-v1
CONTRACT_VERSION = mlb-model-evaluation-plan-v1
SPORT = MLB
TARGET = OFFICIAL_FINAL_GAME_WINNER
TARGET_ENCODING = HOME_WIN_1_AWAY_WIN_0
MATRIX_ID = mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360::mlb-real-pregame-winner-feature-manifest-v1
CONFIG_ID = mlb-real-pregame-winner-first-fit-v1
MANIFEST_ID = mlb-real-pregame-winner-feature-manifest-v1
DATASET_ID = mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360
ALGORITHM = L2_LOGISTIC_REGRESSION_BINARY_V1
FEATURE_IDS = awayBullpenExtraInningGames, awayBullpenGamesInPrevious3Days, awayRunsAllowedPerGame, awayRunsScoredPerGame, awayStarterAvailable, awayWinRate, doubleHeaderGameNumber, homeBullpenExtraInningGames, homeBullpenGamesInPrevious3Days, homeRunsAllowedPerGame, homeRunsScoredPerGame, homeStarterAvailable, homeWinRate, scheduledInnings
SPLIT_STRATEGY = CHRONOLOGICAL_OFFICIAL_DATE_V1
EMBARGO_DAYS = 0
TRAIN_RANGE = 2026-04-01 to 2026-04-23
VALIDATION_RANGE = 2026-04-24 to 2026-04-28
TEST_RANGE = 2026-04-29 to 2026-05-03
SPLIT_COUNTS = train 301, validation 67, test 69
TOTAL_ROWS = 437
PROTOCOL = TRAIN_FIT_VALIDATION_SELECT_TEST_FINAL_V1
SELECTION_METRIC = LOG_LOSS
REPORTED_METRICS = LOG_LOSS, BRIER_SCORE, ROC_AUC
TEST_SET_POLICY = HOLDOUT_UNTIL_CONFIGURATION_LOCKED

TRAIN controls coefficient fitting.
VALIDATION is available to the trainer's validation evaluation.
TEST is held untouched during the first fit phase.

The existence of evaluateAndReleaseMLBDeterministicModel does NOT authorize C-B to inspect TEST.

## 43. Trainer source truth

TRAINER_FUNCTION = fitAndEvaluateMLBDeterministicLogisticRegression
FEATURE_INPUT_MODE = RAW_FINITE_FEATURE_VALUES
FEATURE_STANDARDIZATION = NO
TRAIN_ROWS_ROLE = fitting
VALIDATION_ROWS_ROLE = trainer validation metrics
TEST_ROWS_ROLE = not consumed by current fit function
MISSING_INDICATOR_EXPANSION = yes (wasMissing ? 1 : 0 per feature)
REGULARIZATION = L2
RANDOMNESS = none

The fit function consumes only TRAIN and VALIDATION rows. TEST rows remain untouched by the current trainer boundary.

## 44. Validation role

VALIDATION rows are used by fitAndEvaluateMLBDeterministicLogisticRegression to compute validationProbabilities, validationTargets, and validation metrics (logLoss, brierScore, rocAuc). These metrics are emitted in the MLBModelValidationEvaluation record.

## 45. TEST role

TEST rows are not consumed by fitAndEvaluateMLBDeterministicLogisticRegression. They are reserved for a future frozen-model test evaluation boundary.

## 46. Test-evaluation architecture

EXISTING_TEST_RELEASE_FUNCTION = evaluateAndReleaseMLBDeterministicModel
STANDALONE_FROZEN_MODEL_TEST_SCORER = NO
TEST_RELEASE_FUNCTION_ACCEPTS_EXISTING_FIT_RESULT = YES
TEST_RELEASE_FUNCTION_REFITS_MODEL = NO
TEST_RELEASE_FUNCTION_COMPUTES_TEST_METRICS = YES
CAN_EXISTING_PUBLIC_BOUNDARY_EVALUATE_TEST_WITHOUT_REFIT = YES
TEST_EVALUATION_COUPLED_TO_RELEASE_DECISION = YES

C-B must NOT inspect TEST merely because this function exists.
TEST remains untouched during the first TRAIN + VALIDATION fit phase unless a later explicitly authorized phase invokes the test/release boundary.

## 47. First-execution rules

THIS PROTOCOL QUALIFIES THE FIRST BOUNDED REAL MLB TRAINER EXECUTION.

IT DOES NOT QUALIFY THE MODEL FOR PRODUCTION DEPLOYMENT.

NO REAL MODEL HAS YET BEEN FIT UNDER THIS PROTOCOL.

FIRST_REAL_FIT_ATTEMPTS = 1
HYPERPARAMETER_SEARCH = NONE
AUTOMATIC_HYPERPARAMETER_RETRIES = 0

- The first real fit is a single predeclared execution.
- No hyperparameter search.
- No model selection search.
- No feature changes after observing validation or test metrics under this protocol.
- No corpus-window changes after target inspection.
- No retry intended to improve TEST metrics.
- TEST may not influence coefficient fitting, feature selection, hyperparameters, threshold selection, or retry decisions.
- Because the current trainer does not consume TEST, the first real fit uses TRAIN for fitting and VALIDATION for the trainer's validation metrics.
- TEST remains untouched until a frozen-model test evaluation boundary is implemented.

## 48. No performance-based corpus selection

The date boundaries were not selected based on target distribution, model performance, feature values, missingness, validation metrics, or test metrics.

## 49. No actual/final starter substitution

Historical snapshots contain no actual or final starter substitution. The startingPitchers records are all UNAVAILABLE with null pitcherId and empty sourceRefIds. The trainer and matrix do not fabricate or impute starter availability.

## 50. Known limitations

- Historical starter coverage is absent (all UNAVAILABLE). The model cannot learn from historical starter signals.
- The doubleHeaderGameNumber feature is missing for 427 of 437 rows because the frozen window contains only 10 doubleheader games.
- The scheduledInnings logical feature is constant (9) across TRAIN, so it carries no discriminative signal in training.
- awayStarterAvailable and homeStarterAvailable are constant (0, missing) across TRAIN, so the missing-indicator expansion adds no within-split variation for those features.
- doubleHeaderGameNumber missing-indicator flag varies in TRAIN (4 observed, 297 missing).
- TEST rows are not evaluated by the current trainer boundary.

## 51. Exact next phase

Next phase after commit and push of this protocol: Phase 8V-D3-C-B

Phase 8V-D3-C-B is the first bounded real MLB deterministic logistic-regression execution under the frozen protocol.
