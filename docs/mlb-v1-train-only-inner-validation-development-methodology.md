# MLB V1 Train-Only Inner-Validation Development Methodology

## 1. Locked baseline

Locked baseline: 28de7fcc051c33657ad15288caaa2770e06150d4
Commit: Document MLB second real fit postmortem
Branch: main

## 2. Purpose

This document freezes the TRAIN-only chronological inner-development methodology
that governs all further MLB V1 model development before another real candidate is
trained.

The first two real candidates have already consumed the current outer VALIDATION
result:

- Candidate V1: optimizer unstable, rejected before TEST.
- Candidate V2: converged, still failed the pre-TEST outer VALIDATION gate,
  rejected before TEST.

Accepted V2 postmortem conclusion:

NEXT_REMEDIATION_INVESTIGATION_CLASS = E
(MULTIPLE_OF_THE_ABOVE_REQUIRE_CONTROLLED_INNER_VALIDATION)

Accepted methodology conclusions:

TRAIN_ONLY_INNER_VALIDATION_RECOMMENDED = YES
FUTURE_HYPERPARAMETER_SELECTION_SHOULD_USE_OUTER_VALIDATION = NO
NEXT_REAL_FIT_AUTHORIZED = NO

This phase freezes a TRAIN-only chronological development protocol.
It does NOT train a model, evaluate candidate models, create V3, choose V3
hyperparameters, touch outer VALIDATION payloads, or touch TEST payloads.

## 3. Outer split identities/counts

Frozen matrix identity:

MATRIX_ID = mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360::mlb-real-pregame-winner-feature-manifest-v1
MATRIX_SHA256 = 5c730f9e286750c232a5e13e1be3553a40d463bb923f4f0e8dcbcd8ce8b5495e

Frozen outer splits:

total rows = 437
outer TRAIN = 301
outer VALIDATION = 67
outer TEST = 69

Outer TRAIN date range: 2026-04-01 through 2026-04-23
Outer VALIDATION date range: 2026-04-24 through 2026-04-28
Outer TEST date range: 2026-04-29 through 2026-05-03

These outer partitions remain immutable.

## 4. Reason inner development is now required

The existing outer VALIDATION split has now been observed for two real candidates.
Neither candidate passed the pre-TEST gate:

- V1: not converged, validation metrics worse than trivial baselines.
- V2: converged, validation metrics still not better than P50 or TRAIN-prior baselines.

Iterative tuning against the same outer VALIDATION would overfit the holdout
protocol. Future development must use TRAIN-only inner validation to select
candidate recipes before any single final outer VALIDATION gate.

## 5. Exact chronology field semantics

INNER_CHRONOLOGY_FIELD = vector.officialDate
INNER_CHRONOLOGY_SEMANTICS = official game calendar date (YYYY-MM-DD) from the
canonical schedule, identical to the field used for the frozen outer split
assignment.

DATE_BUCKET_TIMEZONE_OR_SEMANTICS = officialDate follows the frozen
CHRONOLOGICAL_OFFICIAL_DATE_V1 split-policy semantics. Dates are Gregorian
calendar dates in YYYY-MM-DD format. A calendar date may not be split between
inner train and inner validation.

## 6. TRAIN-only date inventory

Source: /tmp/mre-phase8v-d3-ca-r2/training-matrix-a.json
Filter: row.split === TRAIN only.
Chronology field: row.vector.officialDate.

TRAIN_DATE_COUNT = 23
TRAIN_TOTAL_ROWS = 301
TRAIN_HOME_WINS = 160
TRAIN_AWAY_WINS = 141

Required reconciliation:
date row counts sum = 301
home + away = 301

Exact TRAIN date inventory:

2026-04-01: rows=15, home=11, away=4
2026-04-02: rows=3,  home=1, away=2
2026-04-03: rows=14, home=8, away=6
2026-04-04: rows=15, home=7, away=8
2026-04-05: rows=16, home=7, away=9
2026-04-06: rows=13, home=6, away=7
2026-04-07: rows=15, home=9, away=6
2026-04-08: rows=15, home=8, away=7
2026-04-09: rows=6,  home=3, away=3
2026-04-10: rows=15, home=9, away=6
2026-04-11: rows=15, home=9, away=6
2026-04-12: rows=15, home=7, away=8
2026-04-13: rows=10, home=7, away=3
2026-04-14: rows=15, home=9, away=6
2026-04-15: rows=15, home=11, away=4
2026-04-16: rows=10, home=4, away=6
2026-04-17: rows=15, home=6, away=9
2026-04-18: rows=15, home=7, away=8
2026-04-19: rows=15, home=8, away=7
2026-04-20: rows=10, home=3, away=7
2026-04-21: rows=15, home=6, away=9
2026-04-22: rows=15, home=10, away=5
2026-04-23: rows=9,  home=4, away=5

## 7. Exact four frozen inner folds

Fold 1:

INNER_TRAIN = 2026-04-01 through 2026-04-07
INNER_VALIDATION = 2026-04-08 through 2026-04-11

Fold 2:

INNER_TRAIN = 2026-04-01 through 2026-04-11
INNER_VALIDATION = 2026-04-12 through 2026-04-15

Fold 3:

INNER_TRAIN = 2026-04-01 through 2026-04-15
INNER_VALIDATION = 2026-04-16 through 2026-04-19

Fold 4:

INNER_TRAIN = 2026-04-01 through 2026-04-19
INNER_VALIDATION = 2026-04-20 through 2026-04-23

Required rules:
- expanding-window only
- never random split
- every inner-validation date occurs strictly after all inner-training dates
- a calendar date may not be split between inner train and inner validation
- no outer VALIDATION row enters any fold
- no TEST row enters any fold
- each inner-validation row appears in exactly one inner-validation fold
- rows from 2026-04-01 through 2026-04-07 form the initial seed period
- later TRAIN rows may first appear as inner validation, then become training data
  for subsequent folds

## 8. Exact row/target counts for every fold

Fold 1:

INNER_TRAIN_ROWS = 91
INNER_TRAIN_HOME_WINS = 49
INNER_TRAIN_AWAY_WINS = 42
INNER_VALIDATION_ROWS = 51
INNER_VALIDATION_HOME_WINS = 29
INNER_VALIDATION_AWAY_WINS = 22

Fold 2:

INNER_TRAIN_ROWS = 142
INNER_TRAIN_HOME_WINS = 78
INNER_TRAIN_AWAY_WINS = 64
INNER_VALIDATION_ROWS = 55
INNER_VALIDATION_HOME_WINS = 34
INNER_VALIDATION_AWAY_WINS = 21

Fold 3:

INNER_TRAIN_ROWS = 197
INNER_TRAIN_HOME_WINS = 112
INNER_TRAIN_AWAY_WINS = 85
INNER_VALIDATION_ROWS = 55
INNER_VALIDATION_HOME_WINS = 25
INNER_VALIDATION_AWAY_WINS = 30

Fold 4:

INNER_TRAIN_ROWS = 252
INNER_TRAIN_HOME_WINS = 137
INNER_TRAIN_AWAY_WINS = 115
INNER_VALIDATION_ROWS = 49
INNER_VALIDATION_HOME_WINS = 23
INNER_VALIDATION_AWAY_WINS = 26

Required viability checks:

ALL_FOLDS_CHRONOLOGICAL = YES
ALL_FOLDS_BOTH_CLASSES = YES
INNER_VALIDATION_DATE_OVERLAP = NONE

Every inner train count > 0: YES
Every inner validation count > 0: YES
Every inner train contains both target classes: YES
Every inner validation contains both target classes: YES

## 9. No-randomization rule

INNER_RANDOM_SPLITTING = NO

All inner folds are calendar-defined and deterministic.
No random seed, no shuffling, no stratified random split, no permutation-based
sampling is permitted for inner fold assignment.

## 10. Leakage/preprocessing rules

For fold k, all model-estimated quantities must be learned using INNER_TRAIN_k only.
This includes, if later authorized:

- coefficient fitting
- normalization means
- standard deviations
- medians
- imputations
- clipping thresholds
- feature-selection decisions
- constant-channel detection
- dimensionality reduction
- learned encodings
- class priors
- regularization-dependent fitted parameters
- any other statistic derived from examples

Then the frozen transformation/model is applied to INNER_VALIDATION_k.

No statistic may be learned jointly across all 301 TRAIN rows before fold
evaluation if that statistic would expose future inner-validation observations.

Global facts frozen independently of row values are allowed, for example:

- feature IDs
- feature ordering
- manifest identity
- algorithm family
- fold calendar boundaries

If a future candidate uses standardization:
means/stds must be computed independently within each fold's INNER_TRAIN subset.

If a future candidate drops zero-variance channels:
the decision must be made using each fold's INNER_TRAIN subset unless the removal
is structurally guaranteed by the immutable feature contract rather than observed
data.

No preprocessing implementation is authorized in this phase.

## 11. Fold-specific P50 and fold-train-prior references

For each inner fold, future evaluation must construct two reference predictors using
only that fold's permitted information.

Reference A: P50
probability = 0.5

Reference B: INNER_TRAIN_PRIOR
probability = homeWins(innerTrain) / rows(innerTrain)

That fold-specific prior is applied unchanged to that fold's inner-validation rows.

Log loss uses the same clipping convention as the committed outer pre-TEST gate:
[1e-15, 1 - 1e-15]

Brier uses raw probability squared error.

No fallback 0.5 substitution for invalid priors.

Exact fold-specific reference baselines:

Fold 1:

INNER_TRAIN_PRIOR = 49 / 91 = 0.5384615384615384
P50_LOG_LOSS = 0.6931471805599453
P50_BRIER = 0.25
TRAIN_PRIOR_LOG_LOSS = 0.6855355800964134
TRAIN_PRIOR_BRIER = 0.2462002552500291

Fold 2:

INNER_TRAIN_PRIOR = 78 / 142 = 0.5492957746478874
P50_LOG_LOSS = 0.6931471805599453
P50_BRIER = 0.25
TRAIN_PRIOR_LOG_LOSS = 0.6746516965467291
TRAIN_PRIOR_BRIER = 0.24077834484499827

Fold 3:

INNER_TRAIN_PRIOR = 112 / 197 = 0.5685279187817259
P50_LOG_LOSS = 0.6931471805599453
P50_BRIER = 0.25
TRAIN_PRIOR_LOG_LOSS = 0.7151671927909549
TRAIN_PRIOR_BRIER = 0.26092588645089376

Fold 4:

INNER_TRAIN_PRIOR = 137 / 252 = 0.5436507936507936
P50_LOG_LOSS = 0.6931471805599453
P50_BRIER = 0.25
TRAIN_PRIOR_LOG_LOSS = 0.702331197072824
TRAIN_PRIOR_BRIER = 0.25457788935680076

## 12. Weighted aggregate metric definitions

Across all four folds, aggregate candidate logLoss and Brier using validation-row
weighted means:

aggregateMetric =
sum(foldMetric * foldValidationRowCount)
/
sum(foldValidationRowCount)

Do the same weighted aggregation for fold-specific reference metrics.

Additionally report:

- worst fold candidate logLoss
- worst fold candidate Brier
- number of folds beating P50 on logLoss
- number of folds beating P50 on Brier
- number of folds beating fold-train prior on logLoss
- number of folds beating fold-train prior on Brier

These diagnostics may not be silently substituted for the frozen aggregate
selection rule below.

## 13. Strict INNER_ELIGIBLE rule

A future candidate recipe is:

INNER_ELIGIBLE

only if BOTH:

aggregate candidate logLoss
<
aggregate P50 logLoss

AND

aggregate candidate logLoss
<
aggregate fold-train-prior logLoss

AND BOTH:

aggregate candidate Brier
<
aggregate P50 Brier

AND

aggregate candidate Brier
<
aggregate fold-train-prior Brier

All comparisons are strict.
Ties reject.

ROC AUC cannot rescue a candidate that fails logLoss or Brier.

A candidate that does not satisfy all four strict aggregate conditions is:

INNER_REJECTED

This inner rule does NOT grant TEST access.
It does NOT itself grant outer VALIDATION access.
It only makes a recipe eligible to compete for selection inside TRAIN-only
development.

## 14. Deterministic ranking rule

If more than one future candidate becomes INNER_ELIGIBLE:

rank eligible candidates by:

1. lowest aggregate inner-validation logLoss

then if exactly tied:

2. lowest aggregate inner-validation Brier

then if exactly tied:

3. lower implementation/model complexity under a predeclared complexity ordering

then if still exactly tied:

4. lexicographically smallest immutable candidate ID

AUC is descriptive only and cannot change ranking.

The complexity ordering for actual candidate families must be frozen in the later
candidate-experiment-plan phase BEFORE those candidates are executed.

Do not invent that family ordering here.

## 15. 12-recipe development-cycle cap

MAX_DISTINCT_INNER_CANDIDATE_RECIPES_PER_DEVELOPMENT_CYCLE = 12

A recipe means one unique frozen combination of:

- preprocessing policy
- feature policy
- model family
- regularization configuration
- optimizer configuration
- any other model-affecting choice

Repeated deterministic execution of the exact same recipe for debugging does not
create a new recipe, but future execution prompts should still avoid unnecessary
reruns.

The 12-recipe budget must be frozen BEFORE executing the first inner-development
candidate.

Do not choose the 12 recipes in this phase.
Do not create candidate IDs in this phase.

If all 12 recipes fail: STOP.
Do not adaptively add recipe 13 based on observed inner results.
A new committed methodology/amendment or new data is required.

## 16. Current-corpus vs new-data experiment-family boundary

The postmortem identified several investigation classes.

The methodology may permit later separately planned candidate families involving:

A. preprocessing / numerical conditioning
B. structural handling of TRAIN-constant or redundant channels
C. regularization configuration
D. model complexity within the already-approved winner-prediction objective
E. feature coverage improvements that require legitimate additional pregame source
   reconstruction
F. larger / later temporal sample coverage

However, this phase does NOT choose:

- standardization YES/NO
- any scaling formula
- any channel to drop
- any L2 value
- any learning rate
- any interaction
- any new feature
- any candidate ID
- any V3 configuration

Distinguish two classes in the document:

CURRENT_CORPUS_EXPERIMENTS = A, B, C, D
REQUIRES_NEW_DATA_OR_RECONSTRUCTION = E, F

For example, historical probable-starter signal cannot be meaningfully tested on the
current frozen corpus if that channel is unavailable throughout TRAIN.

Do not pretend current-corpus inner validation can evaluate information that does
not exist in the frozen corpus.

## 17. Outer VALIDATION reuse policy

The current outer VALIDATION split has already been observed for:

- first real candidate
- second real candidate

It must no longer be used for iterative tuning.

Frozen policy:

OUTER_VALIDATION_USED_FOR_HYPERPARAMETER_SELECTION = NO
OUTER_VALIDATION_USED_FOR_FEATURE_SELECTION = NO
OUTER_VALIDATION_USED_FOR_PREPROCESSING_SELECTION = NO
OUTER_VALIDATION_USED_FOR_MODEL_FAMILY_SELECTION = NO

## 18. One remaining current-outer-VALIDATION attempt

After TRAIN-only inner development is complete:

1. select exactly ONE candidate according to the frozen inner methodology;
2. freeze its complete recipe/configuration in Git;
3. only in a later separately authorized phase run that ONE frozen candidate against
   the existing outer VALIDATION gate;
4. do not modify the candidate after seeing that result.

Frozen:

REMAINING_OUTER_VALIDATION_ATTEMPTS_WITH_CURRENT_SPLIT = 1

If that future frozen candidate fails outer VALIDATION:

CURRENT_OUTER_VALIDATION_SPLIT_REUSE_EXHAUSTED = YES

Then:

- do not tune another candidate against the same outer VALIDATION
- do not grant TEST
- obtain newly accumulated temporal data / construct a new future development and
  holdout protocol under a separately reviewed phase

If that future frozen candidate passes:
it becomes ELIGIBLE_FOR_SEPARATELY_AUTHORIZED_TEST
but TEST is still not automatically touched.

## 19. TEST policy

TEST remains:

2026-04-29 through 2026-05-03
69 rows

Known procedural/schema exposure from D2 remains documented as:

HOLDOUT_CLASSIFICATION = B
TEST_OUTCOME_HOLDOUT_INTEGRITY = PRESERVED
STRICT_ZERO_TEST_CONTAINER_ACCESS_POLICY = VIOLATED_IN_D2
TEST_SET_BURNED_FOR_FUTURE_OUTCOME_EVALUATION = NO

For all future phases before explicit TEST authorization:

- do not inspect TEST outcomes
- do not inspect TEST target values
- do not inspect TEST feature payloads
- do not calculate TEST probabilities
- do not calculate TEST metrics
- do not use TEST for preprocessing or candidate selection

Where technically possible, future development tooling should accept explicit
TRAIN-only row collections rather than whole-matrix objects, reducing accidental
TEST-container exposure.

This phase does not implement that tooling.

## 20. Odds-blind statement

No sportsbook odds, prices, moneylines, implied market probabilities, market
consensus, market comparisons, value or edge calculations, CLV, Kelly inputs,
monetary stakes, bankroll values, ROI, yield, or any monetary metric influenced
this methodology or any recommendation.

## 21. Explicit statement: NEXT_REAL_FIT_AUTHORIZED

NEXT_REAL_FIT_AUTHORIZED = NO

## 22. Explicit statement: V3_CONFIGURATION_CREATED

V3_CONFIGURATION_CREATED = NO

## 23. Explicit statement: INNER_DEVELOPMENT_EXECUTED

INNER_DEVELOPMENT_EXECUTED = NO

## 24. Methodology consistency audit

Required consistency audit results:

INNER_FOLD_COUNT = 4
INNER_RANDOM_SPLITTING = NO
OUTER_VALIDATION_ROWS_USED_IN_INNER_DEVELOPMENT = 0
TEST_ROWS_USED_IN_INNER_DEVELOPMENT = 0
INNER_REFERENCE_P50 = YES
INNER_REFERENCE_FOLD_TRAIN_PRIOR = YES
INNER_PRIMARY_METRICS = LOG_LOSS_AND_BRIER
AUC_SELECTION_ROLE = DESCRIPTIVE_ONLY
MAX_DISTINCT_INNER_CANDIDATE_RECIPES = 12
V3_CONFIGURATION_CREATED = NO
INNER_DEVELOPMENT_EXECUTED = NO
NEXT_REAL_FIT_AUTHORIZED = NO
REMAINING_OUTER_VALIDATION_ATTEMPTS_WITH_CURRENT_SPLIT = 1
TEST_AUTHORIZED = NO
ODDS_MARKET_INPUTS = NONE

Review every match.
