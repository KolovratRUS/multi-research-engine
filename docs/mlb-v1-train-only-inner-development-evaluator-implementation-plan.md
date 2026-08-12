# MLB V1 Train-Only Inner-Development Evaluator Implementation Plan

## 1. Locked baseline

Locked baseline: d245b894d2946b0062ccc2d99aa14f6d99770a14
Commit: Freeze MLB train-only inner validation methodology
Branch: main

## 2. Authoritative methodology reference

This implementation plan translates the frozen methodology in:

docs/mlb-v1-train-only-inner-validation-development-methodology.md

into a precise implementation boundary.

No methodology value in that document may be silently altered by this plan.

## 3. Current repository boundary audit

Read from source:

- docs/mlb-v1-train-only-inner-validation-development-methodology.md
- docs/mlb-v1-second-real-fit-postmortem.md
- docs/mlb-v1-pretest-candidate-gate-plan.md
- src/prediction/mlb/mlb-training-matrix-contract.ts
- src/prediction/mlb/mlb-model-training-plan-contract.ts
- src/prediction/mlb/mlb-logistic-regression-fit-contract.ts
- src/prediction/mlb/mlb-pretest-validation-reference-contract.ts
- src/prediction/mlb/mlb-pretest-candidate-gate-contract.ts
- src/prediction/mlb/mlb-model-test-release-contract.ts

REUSABLE_EXISTING_METRIC_PRIMITIVES =

calculateClippedLogLoss(probability, target) semantics from mlb-pretest-validation-reference-contract.ts
  - clipping: [1e-15, 1 - 1e-15]
  - identical semantics to stableLogLoss in mlb-model-test-release-contract.ts
  - NOTE: implementation is a private helper; semantics must be extracted/generalized, not directly imported

brierScore(probability, target) semantics from mlb-pretest-validation-reference-contract.ts
  - (probability - target) ** 2
  - NOTE: implementation is a private helper; semantics must be extracted/generalized, not directly imported

pairwise ROC AUC tie-correct semantics from mlb-model-test-release-contract.ts
  - positiveScore > negativeScore -> +1
  - positiveScore == negativeScore -> +0.5
  - positiveScore < negativeScore -> +0
  - NOTE: implementation is inline private logic; semantics must be extracted/generalized, not directly imported

finite probability validation pattern from validateMLBModelValidationEvaluation

REUSABLE_EXISTING_VALIDATORS =

validateMLBTrainingMatrix from mlb-training-matrix-contract.ts
  - validates full matrix contract, split counts, canonical row order, date-window membership, duplicate ids, schema

validateMLBPreTestValidationReferenceFacts from mlb-pretest-validation-reference-contract.ts
  - validates reference facts structure and finite baselines

validateMLBModelEvaluationPlan from mlb-model-training-plan-contract.ts
  - validates evaluation plan structure, identities, feature order

validateMLBModelFitValidationResult from mlb-logistic-regression-fit-contract.ts
  - validates fit result structure, model identities, finite coefficients/metrics

REUSABLE_EXISTING_SPLIT_PRIMITIVES =

MLBTrainingMatrixRow split literal: 'TRAIN' | 'VALIDATION' | 'TEST'
SPLIT_ORDERS canonical ordering in mlb-training-matrix-contract.ts
canonical row ordering: split -> officialDate -> gameId -> snapshotId -> exampleId
date-window validation in validateMLBTrainingMatrix

NEW_CONTRACTS_ACTUALLY_REQUIRED =

MLBTrainOnlyInnerRowCollection - validated TRAIN-only row collection type
MLBTrainOnlyInnerFoldPlan - immutable four-fold plan with frozen date windows and counts
MLBInnerDevelopmentReferenceFacts - fold-local P50 and fold-train-prior facts
MLBInnerFoldResult - per-fold candidate predictions, targets, metrics, reference metrics
MLBInnerAggregateResult - validation-row-weighted aggregate metrics and diagnostics
MLBInnerCandidateGateResult - INNER_ELIGIBLE / INNER_REJECTED with deterministic reasons
MLBInnerCandidateRank - ranked eligible candidate with complexity metadata

The outer pre-TEST contracts (MLBPreTestValidationReferenceFacts, MLBPreTestCandidateGateResult) are NOT altered or reused for inner development. A separate inner-development reference contract is cleaner because:
- inner references are fold-local, not global outer-validation-based
- inner reference inputs are innerTrainRows and innerValidationRows, not outer train/validation rows
- inner reference outputs must not carry outer validation rowCount semantics
- reusing the outer contract would create semantic confusion and risk accidental outer-validation leakage

## 4. Implementation goals/non-goals

Goals:
- Provide a safe TRAIN-only boundary for future inner-development candidate execution
- Encode the four frozen chronological inner folds as immutable constants
- Materialize inner folds deterministically from explicit TRAIN-only rows
- Compute fold-local reference baselines (P50 and fold-train-prior)
- Evaluate candidate fold metrics (logLoss, Brier, descriptive ROC AUC)
- Aggregate fold results using validation-row-weighted means
- Apply the frozen strict INNER_ELIGIBLE rule
- Rank eligible candidates deterministically
- Track the 12-recipe budget exactly
- Fail closed on every anomaly

Non-goals:
- Do not implement candidate fitting, scoring, or recipe creation
- Do not create V3 configurations
- Do not choose hyperparameters, preprocessing, or model families
- Do not consume outer VALIDATION or TEST payloads
- Do not modify production prediction semantics
- Do not alter existing outer pre-TEST gate contracts

## 5. TRAIN-only extraction boundary

Contract name: MLBTrainingMatrix (existing)
Extraction function: extractMLBOuterTrainRowsForInnerDevelopment(matrix: MLBTrainingMatrix)

Input:
- frozen MLBTrainingMatrix (must pass validateMLBTrainingMatrix)

Output:
- MLBTrainOnlyInnerRowCollection

Required validation:
- matrix contract valid
- sport === 'MLB'
- target === 'OFFICIAL_FINAL_GAME_WINNER'
- matrixId, manifestId, datasetId match frozen identities if required by committed protocol
- every emitted row has split === 'TRAIN'
- exactly 301 emitted rows for the frozen current corpus
- no emitted VALIDATION row
- no emitted TEST row
- no duplicate exampleId within emitted collection
- rows remain in canonical order

Type definition:

export type MLBTrainOnlyInnerRowCollection = Readonly<{
  contractVersion: 'mlb-train-only-inner-row-collection-v1';
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  targetEncoding: 'HOME_WIN_1_AWAY_WIN_0';
  matrixId: string;
  manifestId: string;
  datasetId: string;
  rowCount: number;
  homeWinCount: number;
  awayWinCount: number;
  rows: readonly MLBTrainingMatrixRow[];
}>;

Critical boundary:

MATRIX_VALIDATION_BOUNDARY = validateMLBTrainingMatrix traverses the full matrix
(including all rows) to verify structural invariants.

CANDIDATE_DEVELOPMENT_BOUNDARY = the MLBTrainOnlyInnerRowCollection output, which
contains TRAIN rows only and is the maximum data scope accepted by inner-development APIs.

Even if full-matrix validation inherently scans all rows, no downstream candidate API
receives non-TRAIN rows. The extraction function enforces this separation.

## 6. TRAIN-only API type strategy

TRAIN_ONLY_API_TYPE_STRATEGY =

Reuse existing MLBTrainingMatrixRow type plus a validated TRAIN-only wrapper/result type.

Justification:
- Repository convention uses plain-readonly objects and explicit validation functions rather than TypeScript branded types.
- MLBTrainingMatrixRow already carries the required split field and vector structure.
- Adding a dedicated wrapper type (MLBTrainOnlyInnerRowCollection) makes the TRAIN-only guarantee explicit at the API boundary without inventing TypeScript branding complexity.
- Callers receive the wrapper, not the raw matrix, so non-TRAIN rows cannot enter candidate-development code through type confusion.
- Runtime validation inside the extraction function ensures the wrapper actually contains only TRAIN rows.

Compile-time plus runtime defense:
- Type system: inner-development APIs accept MLBTrainOnlyInnerRowCollection, not MLBTrainingMatrix.
- Runtime: extraction function validates every row split and rejects non-TRAIN rows.

## 7. Immutable inner-fold plan contract

Contract name: mlb-train-only-inner-fold-plan-v1

Type definition:

export type MLBTrainOnlyInnerFoldPlan = Readonly<{
  contractVersion: 'mlb-train-only-inner-fold-plan-v1';
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  folds: readonly MLBFoldDefinition[];
}>;

export type MLBFoldDefinition = Readonly<{
  foldId: string;
  innerTrainStartDate: string;
  innerTrainEndDate: string;
  innerValidationStartDate: string;
  innerValidationEndDate: string;
  expectedTrainRowCount: number;
  expectedValidationRowCount: number;
  expectedTrainHomeWinCount: number;
  expectedTrainAwayWinCount: number;
  expectedValidationHomeWinCount: number;
  expectedValidationAwayWinCount: number;
}>;

Immutable frozen definitions for current corpus:

Fold 1:
  foldId: 'FOLD_1'
  innerTrainStartDate: '2026-04-01'
  innerTrainEndDate: '2026-04-07'
  innerValidationStartDate: '2026-04-08'
  innerValidationEndDate: '2026-04-11'
  expectedTrainRowCount: 91
  expectedValidationRowCount: 51
  expectedTrainHomeWinCount: 49
  expectedTrainAwayWinCount: 42
  expectedValidationHomeWinCount: 29
  expectedValidationAwayWinCount: 22

Fold 2:
  foldId: 'FOLD_2'
  innerTrainStartDate: '2026-04-01'
  innerTrainEndDate: '2026-04-11'
  innerValidationStartDate: '2026-04-12'
  innerValidationEndDate: '2026-04-15'
  expectedTrainRowCount: 142
  expectedValidationRowCount: 55
  expectedTrainHomeWinCount: 78
  expectedTrainAwayWinCount: 64
  expectedValidationHomeWinCount: 34
  expectedValidationAwayWinCount: 21

Fold 3:
  foldId: 'FOLD_3'
  innerTrainStartDate: '2026-04-01'
  innerTrainEndDate: '2026-04-15'
  innerValidationStartDate: '2026-04-16'
  innerValidationEndDate: '2026-04-19'
  expectedTrainRowCount: 197
  expectedValidationRowCount: 55
  expectedTrainHomeWinCount: 112
  expectedTrainAwayWinCount: 85
  expectedValidationHomeWinCount: 25
  expectedValidationAwayWinCount: 30

Fold 4:
  foldId: 'FOLD_4'
  innerTrainStartDate: '2026-04-01'
  innerTrainEndDate: '2026-04-19'
  innerValidationStartDate: '2026-04-20'
  innerValidationEndDate: '2026-04-23'
  expectedTrainRowCount: 252
  expectedValidationRowCount: 49
  expectedTrainHomeWinCount: 137
  expectedTrainAwayWinCount: 115
  expectedValidationHomeWinCount: 23
  expectedValidationAwayWinCount: 26

Validator: validateMLBTrainOnlyInnerFoldPlan

Validates:
- exactly four folds
- fold IDs are FOLD_1, FOLD_2, FOLD_3, FOLD_4
- dates are YYYY-MM-DD
- train start <= train end
- validation start <= validation end
- expected counts are non-negative integers
- expanding window: each fold innerTrainEndDate >= previous fold innerTrainEndDate
- no random fields

## 8. Fold materialization contract

Function: buildMLBTrainOnlyInnerValidationFolds(
  trainRows: MLBTrainOnlyInnerRowCollection,
  foldPlan: MLBTrainOnlyInnerFoldPlan
)

Output: MLBTrainOnlyInnerValidationFolds

export type MLBTrainOnlyInnerValidationFolds = Readonly<{
  contractVersion: 'mlb-train-only-inner-validation-folds-v1';
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  matrixId: string;
  manifestId: string;
  datasetId: string;
  foldPlanId: string;
  folds: readonly MLBFoldMaterialization[];
}>;

export type MLBFoldMaterialization = Readonly<{
  foldId: string;
  innerTrainRows: readonly MLBTrainingMatrixRow[];
  innerValidationRows: readonly MLBTrainingMatrixRow[];
  trainRowCount: number;
  validationRowCount: number;
  trainHomeWinCount: number;
  trainAwayWinCount: number;
  validationHomeWinCount: number;
  validationAwayWinCount: number;
  innerTrainDateRange: { startDate: string; endDate: string };
  innerValidationDateRange: { startDate: string; endDate: string };
  dateRangeProof: string;
}>;

Required validation (fail closed, no silent repair):
- input trainRows are TRAIN-only (already guaranteed by wrapper, re-validated)
- no duplicate row identity within source collection
- exactly 301 source rows
- chronology field (vector.officialDate) valid on every row
- all expected dates represented according to frozen corpus
- all train rows precede all validation rows for each fold (officialDate)
- no date split across roles within a fold
- exact frozen row counts match
- exact frozen target counts match
- both classes present in train
- both classes present in validation
- inner-validation sets are mutually date-disjoint
- fold sequence is expanding-window

Date range proof format:
"inner train {start}..{end} ({count} rows), inner validation {start}..{end} ({count} rows), no date overlap"

## 9. Leakage-safe candidate execution boundary

The implementation plan defines a candidate-runner interface.

Conceptual function:

interface MLBInnerCandidateRecipe {
  candidateRecipeId: string;

  preprocessingPolicyId: string;
  featurePolicyId: string;
  modelFamilyId: string;

  regularizationConfig: unknown;
  optimizerConfig: unknown;
  otherModelAffectingChoices: unknown;

  complexityRank: number;
}

// candidateRecipeId is immutable audit/ranking identity.
// complexityRank is predeclared selection metadata.
// The six model-affecting fields above are the only fields that participate
// in recipe identity/fingerprint. candidateRecipeId, complexityRank, and all
// runtime/execution metadata are excluded from fingerprint computation.

interface MLBInnerValidationPredictionInput {
  exampleId: string;
  vector: MLBFeatureVector;
  // predictor inputs only; no validation target/label/winner/result
}

interface MLBInnerCandidateRunnerInput {
  foldId: string;
  innerTrainRows: readonly MLBTrainingMatrixRow[];
  innerValidationInputs: readonly MLBInnerValidationPredictionInput[];
  candidateRecipe: MLBInnerCandidateRecipe;
}

interface MLBInnerCandidatePredictionRecord {
  candidateRecipeId: string;
  foldId: string;
  exampleId: string;
  homeWinProbability: number;
}

Prediction records carry prediction/provenance identity plus probability only.
The actual game label is NOT part of candidate/prediction output. Authoritative
inner-validation labels exist only in the validated MLBFoldMaterialization.
Metric evaluation joins predictions to validation rows by `exampleId` and reads
targets from `fold.innerValidationRows[].targetValue`. This prevents the
prediction-producing side from owning an answer-key field.

The candidate runner receives:
- inner TRAIN rows with TRAIN labels, because fitting requires them
- a label-free projection of inner-validation prediction inputs

It must NOT receive:
- full matrix
- outer VALIDATION rows
- TEST rows
- inner-validation target labels
- outer VALIDATION targets
- TEST targets
- odds/market information

Every learned statistic (normalization means, feature selection, imputation, etc.) derives from innerTrainRows only.

The label-free validation input projection is deterministic and target-free:

  innerValidationInputs =
    fold.innerValidationRows.map(row => ({
      exampleId: row.exampleId,
      vector: row.vector,
    }))

The projection copies only prediction-safe fields. It does not retain the
original target-bearing row object, and `targetValue` is intentionally omitted.
Ordering remains deterministic. `exampleId` remains available for later metric
alignment.

The fold runner emits MLBInnerCandidatePredictionRecord[] for innerValidationInputs.

## 10. Fold reference contract

Separate contract from outer pre-TEST reference.

Contract name: mlb-inner-development-reference-facts-v1

Type:

export type MLBInnerDevelopmentReferenceFacts = Readonly<{
  contractVersion: 'mlb-inner-development-reference-facts-v1';
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  foldId: string;
  matrixId: string;
  manifestId: string;
  datasetId: string;
  innerTrainRowCount: number;
  innerValidationRowCount: number;
  innerTrainHomeWinCount: number;
  innerTrainAwayWinCount: number;
  innerTrainHomeWinPrior: number;
  p50: Readonly<{
    probability: number;
    logLoss: number;
    brierScore: number;
    rocAuc: number;
  }>;
  foldTrainPrior: Readonly<{
    probability: number;
    logLoss: number;
    brierScore: number;
    rocAuc: number;
  }>;
}>;

Builder: buildMLBInnerDevelopmentReferenceFacts(
  innerTrainRows: readonly MLBTrainingMatrixRow[],
  innerValidationRows: readonly MLBTrainingMatrixRow[]
)

Required:
- prior = innerTrainHomeWins / innerTrainRowCount
- prior derived from innerTrainRows labels only
- validation targets used only to score frozen prior and P50
- no outer VALIDATION data
- no TEST data

P50:
- probability = 0.5
- logLoss = clipped mean cross-entropy at p=0.5 against innerValidation targets
- brierScore = mean (0.5 - target)^2
- rocAuc = 0.5 (deterministic baseline; descriptive only)

Fold-train-prior:
- probability = prior
- logLoss = clipped mean cross-entropy at prior against innerValidation targets
- brierScore = mean (prior - target)^2
- rocAuc = computed via pairwise tie-correct semantics against innerValidation targets

The outer mlb-pretest-validation-reference-contract.ts is NOT altered.

## 10a. Recipe identity/fingerprint contract

Fingerprint contract version:

MLB_INNER_CANDIDATE_RECIPE_FINGERPRINT_CONTRACT_VERSION =
  'mlb-inner-candidate-recipe-fingerprint-v1'

Conceptual fingerprint payload:

{
  fingerprintContractVersion: 'mlb-inner-candidate-recipe-fingerprint-v1',
  preprocessingPolicyId,
  featurePolicyId,
  modelFamilyId,
  regularizationConfig,
  optimizerConfig,
  otherModelAffectingChoices
}

Model-affecting fields (fingerprint payload):

- preprocessingPolicyId
- featurePolicyId
- modelFamilyId
- regularizationConfig
- optimizerConfig
- otherModelAffectingChoices

Excluded from fingerprint:

- candidateRecipeId
- complexityRank
- developmentCycleId
- timestamps
- process ID
- hostname
- runner identity
- environment identity
- execution count
- any other execution/audit-only metadata

Canonicalization rules:

1. accepted values are JSON-safe only:
   - null
   - boolean
   - string
   - finite number
   - array
   - plain object

2. reject:
   - undefined
   - NaN
   - Infinity
   - -Infinity
   - bigint
   - symbol
   - function
   - non-plain objects
   - accessors/getters/setters
   - cyclic structures

3. object keys are recursively sorted lexicographically before serialization.

4. array order is preserved.

5. object insertion order is irrelevant.

6. finite numbers use JSON numeric serialization.

7. negative zero normalizes to JSON number 0.

8. strings are serialized by JSON escaping rules.

9. canonical serialized bytes are UTF-8.

Fingerprint algorithm:

SHA-256 over the UTF-8 bytes of the canonical serialized fingerprint payload.

Output:

lowercase 64-character hexadecimal SHA-256.

Future function name:

computeMLBInnerCandidateRecipeFingerprint(
  recipe: MLBInnerCandidateRecipe
)

candidateRecipeId and complexityRank must not participate in fingerprint
computation.

Anti-evasion rules:

same recipe renamed to a new candidateRecipeId is still the same fingerprint ->
  rejected as IDENTITY_ALIAS_CONFLICT; no new budget slot, no new ranked candidate

silent parameter change under same candidateRecipeId produces different fingerprint ->
  rejected as IDENTITY_MUTATION_CONFLICT; no new budget slot, no new ranked candidate

A genuinely changed recipe must receive a NEW candidateRecipeId and will then have a
NEW fingerprint and consume a new distinct slot.

Recipe identity within one development cycle:

one candidateRecipeId maps to exactly one fingerprint

one fingerprint maps to exactly one canonical candidateRecipeId

## 11. Fold metric evaluator

Pure function: evaluateMLBInnerFoldMetrics(
  foldId: string,
  innerValidationRows: readonly MLBTrainingMatrixRow[],
  predictions: readonly MLBInnerCandidatePredictionRecord[],
  reference: MLBInnerDevelopmentReferenceFacts
)

Output:

export type MLBInnerFoldMetricResult = Readonly<{
  contractVersion: 'mlb-inner-fold-metric-result-v1';
  foldId: string;
  candidateRecipeId: string;
  rowCount: number;
  targetHomeWinCount: number;
  targetAwayWinCount: number;
  candidateLogLoss: number;
  candidateBrierScore: number;
  candidateRocAuc: number;
  p50LogLoss: number;
  p50BrierScore: number;
  p50RocAuc: number;
  foldTrainPriorLogLoss: number;
  foldTrainPriorBrierScore: number;
  foldTrainPriorRocAuc: number;
  foldTrainPriorProbability: number;
}>;

Required validation:
- predictions count == innerValidationRows count
- exampleId alignment verified
- probabilities finite and in [0, 1]
- targets valid (0 or 1)
- metric values finite

Semantics:
- logLoss clipping: [1e-15, 1 - 1e-15]
- Brier: mean((p - y)^2)
- ROC AUC: pairwise tie-correct (reuse existing repository semantics)
- invalid probabilities: fail closed (return error, do not silently clip NaN/Infinity to validity)

## 12. Aggregate evaluator

Pure function: evaluateMLBTrainOnlyInnerCandidate(
  foldResults: readonly MLBInnerFoldMetricResult[]
)

Output:

export type MLBInnerAggregateResult = Readonly<{
  contractVersion: 'mlb-inner-aggregate-result-v1';
  candidateRecipeId: string;
  foldCount: number;
  aggregateCandidateLogLoss: number;
  aggregateCandidateBrierScore: number;
  aggregateCandidateRocAuc: number;
  aggregateP50LogLoss: number;
  aggregateP50BrierScore: number;
  aggregateP50RocAuc: number;
  aggregateFoldTrainPriorLogLoss: number;
  aggregateFoldTrainPriorBrierScore: number;
  aggregateFoldTrainPriorRocAuc: number;
  worstFoldCandidateLogLoss: number;
  worstFoldCandidateBrierScore: number;
  foldsBeatingP50OnLogLoss: number;
  foldsBeatingP50OnBrier: number;
  foldsBeatingTrainPriorOnLogLoss: number;
  foldsBeatingTrainPriorOnBrier: number;
  foldBreakdown: readonly MLBInnerFoldMetricResult[];
}>;

Required validation:
- exactly four folds
- expected fold IDs FOLD_1..FOLD_4
- no duplicate fold ID
- no missing fold
- row counts match frozen plan
- metric values finite
- reference facts valid
- candidate identity consistent across all folds

Aggregation:
weightedLogLoss = sum(foldLogLoss * foldValidationRowCount) / sum(foldValidationRowCount)
weightedBrier = same structure
weightedRocAuc = same structure (descriptive only)
weighted references by same validation-row weights

Diagnostics:
- worst fold candidate logLoss = max across folds
- worst fold candidate Brier = max across folds
- fold beat counts as specified

Do not average AUC into selection rule.

## 13. INNER_ELIGIBLE gate

Pure function: evaluateMLBTrainOnlyInnerCandidateGate(
  foldResults: readonly MLBInnerFoldMetricResult[]
)

Internally aggregates canonical four fold metric results via
`evaluateMLBTrainOnlyInnerCandidate(foldResults)`. Eligibility is derived from
the internally generated aggregate; externally supplied aggregate candidate
metrics are not authoritative.

Output:

export type MLBInnerCandidateGateResult = Readonly<{
  eligibility: 'INNER_ELIGIBLE' | 'INNER_REJECTED';
  reasons: readonly string[];
}>;

Eligibility rule (all strict, ties reject):

candidate aggregate logLoss < aggregate P50 logLoss
AND
candidate aggregate logLoss < aggregate fold-train-prior logLoss
AND
candidate aggregate Brier < aggregate P50 Brier
AND
candidate aggregate Brier < aggregate fold-train-prior Brier

Deterministic rejection reasons (ordered):

INVALID_FOLD_RESULT
IDENTITY_MISMATCH
FOLD_SET_MISMATCH
ROW_COUNT_MISMATCH
AGGREGATE_LOG_LOSS_NOT_BETTER_THAN_REFERENCES
AGGREGATE_BRIER_NOT_BETTER_THAN_REFERENCES

Reason ordering: structural reasons first, then performance reasons, in the order listed above.

AUC cannot rescue rejection.

## 14. Eligible-candidate ranking

Safe rankable candidate input:

interface MLBInnerRankableCandidateInput {
  recipe: MLBInnerCandidateRecipe;
  foldResults: readonly MLBInnerFoldMetricResult[];
}

Pure function: rankInnerEligibleCandidates(
  budget: MLBInnerDevelopmentRecipeBudget,
  candidates: readonly MLBInnerRankableCandidateInput[]
)

The ranking function must NOT accept:
- MLBInnerAggregateResult supplied by caller
- caller-supplied eligibility
- caller-supplied aggregate log loss
- caller-supplied aggregate Brier
- caller-supplied aggregate AUC
- caller-supplied complexity value separate from the registered recipe

Output:

export type MLBInnerCandidateRank = Readonly<{
  rank: number;
  candidateRecipeId: string;
  recipeFingerprint: string;
  aggregateLogLoss: number;
  aggregateBrierScore: number;
  complexityRank: number;
}>;

Frozen ranking order:
1. lowest aggregate inner-validation logLoss
2. then exact tie: lowest aggregate inner-validation Brier
3. then exact tie: lower predeclared implementation/model complexity
4. then exact tie: lexicographically smallest immutable candidate ID

AUC remains descriptive only and does not affect ranking.

Input array order never affects ranking.

For each candidate:
1. validate recipe;
2. compute canonical fingerprint;
3. prove exact recipe identity + complexityRank is registered in budget;
4. prove foldResults candidateRecipeId matches recipe candidateRecipeId;
5. call evaluateMLBTrainOnlyInnerCandidate(foldResults) for canonical aggregate metrics;
6. call evaluateMLBTrainOnlyInnerCandidateGate(foldResults) for strict eligibility;
7. invalid inputs fail closed;
8. valid INNER_REJECTED candidates are excluded from the eligible ranking pool;
9. valid INNER_ELIGIBLE candidates enter ranking.

Caller-supplied aggregate metrics are NOT authoritative.
Caller-supplied eligibility is NOT authoritative.

Rejected candidates:
- are valid development results;
- remain consumed in the 12-recipe budget;
- are excluded from the eligible ranking output;
- cannot win;
- do not cause the whole candidate collection to be invalid merely because they were
  rejected by the model-performance gate.

Invalid contract candidates fail the ranking call closed.

If zero eligible candidates exist: return a valid empty ranked collection.
Do NOT fabricate a winner.

Complexity metadata requirement:
The later candidate-experiment plan must provide an immutable complexity rank for every recipe before execution.
If complexity metadata is absent where needed for a tie: fail closed or report unresolved tie.

Do not use AUC for ranking.

## 15. 12-recipe budget accounting

Development cycle identity:

MLB_INNER_DEVELOPMENT_CYCLE_ID =
  'mlb-v1-train-only-inner-development-cycle-v1'

This cycle is bound to the current frozen TRAIN-only development methodology,
including the current outer TRAIN window, the current four-fold chronology,
the current feature-policy/manifest generation, the current strict E3-D
eligibility methodology, and the current 12-recipe development cap.

The cycle may be reset ONLY by an explicit future committed methodology change that:
1. declares the old cycle closed;
2. explains why a new development cycle is justified;
3. defines a NEW cycleId.

Creating a fresh empty budget with the SAME cycleId after development has started
is methodologically prohibited.

Type:

export type MLBInnerDevelopmentRecipeBudget = Readonly<{
  contractVersion: 'mlb-inner-development-recipe-budget-v1';
  cycleId: typeof MLB_INNER_DEVELOPMENT_CYCLE_ID;
  maxDistinctRecipes: 12;
  seenRecipeIds: readonly string[];
  seenRecipeFingerprints: readonly string[];
  seenComplexityRanks: readonly number[];
  evaluationCount: number;
}>;

The three seen... arrays are parallel arrays. At index i:
  seenRecipeIds[i]
  seenRecipeFingerprints[i]
  seenComplexityRanks[i]
describe one registered distinct recipe.

Required invariants:
- all three arrays same length
- all recipe IDs unique
- all fingerprints unique
- each complexity rank is a positive integer
- array length <= 12
- distinct recipes consumed = seenRecipeFingerprints.length
- remaining = 12 - seenRecipeFingerprints.length
- evaluationCount >= distinct recipes consumed

Function: recordInnerCandidateRecipeExecution(
  budget: MLBInnerDevelopmentRecipeBudget,
  candidateRecipe: MLBInnerCandidateRecipe
)

Pre-registration sequence:

validated recipe descriptor
→ compute canonical fingerprint
→ validate identity against current budget
→ check slot availability
→ register recipe
→ distinct slot is now permanently consumed for this cycle
→ only then may fold execution begin

Recipe identity requirements:

candidateRecipeId is immutable.

complexityRank is predeclared before any fold evaluation for that recipe and
must remain identical for every exact re-execution of that registered recipe.
Changing complexityRank after registration fails closed as COMPLEXITY_RANK_MISMATCH
and consumes no new distinct slot.

Recipe fingerprint covers exactly the model-affecting fields:
  - preprocessingPolicyId
  - featurePolicyId
  - modelFamilyId
  - regularizationConfig
  - optimizerConfig
  - otherModelAffectingChoices

It EXCLUDES:
  - candidateRecipeId
  - complexityRank
  - developmentCycleId
  - timestamps
  - process ID
  - hostname
  - runner identity
  - environment identity
  - execution count
  - any other execution/audit-only metadata

Anti-evasion rules:

same recipe renamed to a new candidateRecipeId is still the same fingerprint ->
  rejected as IDENTITY_ALIAS_CONFLICT; no new budget slot, no new ranked candidate

silent parameter change under same candidateRecipeId produces different fingerprint ->
  rejected as IDENTITY_MUTATION_CONFLICT; no new budget slot, no new ranked candidate

recipe 13 after seeing 12 distinct identities: rejected before registration;
  no state mutation, no evaluationCount increment

One distinct recipe executed across four folds consumes exactly one recipe slot.

Runtime metadata (timestamp, process ID, hostname) does NOT participate in fingerprint.

Slot-consumption timing:

A new distinct recipe consumes its ONE slot when it is successfully REGISTERED for
execution, immediately BEFORE any inner-fold prediction/evaluation for that recipe
is allowed to begin.

Consequences:

MALFORMED recipe rejected before registration = 0 slots consumed

identity alias/mutation conflict = 0 slots consumed

attempted 13th distinct recipe = rejected before registration; 0 additional slots consumed

successfully registered new recipe = 1 slot consumed immediately

if execution later crashes or remains incomplete = slot REMAINS consumed

if completed recipe is INNER_REJECTED = slot REMAINS consumed

if completed recipe is INNER_ELIGIBLE = slot REMAINS consumed

Exact deterministic re-execution semantics:

An exact deterministic re-execution is:
  same cycleId
  same candidateRecipeId
  same canonical fingerprint
  same complexityRank

It is allowed for debugging/reproducibility.

It does NOT consume another distinct-recipe slot.

evaluationCount DOES increment by 1 for each accepted execution registration,
including exact re-executions.

Summary:

first registration:
  distinct count +1
  evaluationCount +1

exact re-execution:
  distinct count unchanged
  evaluationCount +1

identity alias conflict:
  no state change

identity mutation conflict:
  no state change

complexity mismatch:
  no state change

13th distinct recipe:
  no state change

malformed recipe:
  no state change

## 16. Failure behavior

The implementation must fail closed for:
- malformed TRAIN-only source
- non-TRAIN row entering inner layer
- unexpected fold count (not exactly 4)
- unexpected fold ID
- unexpected date
- unexpected row count
- duplicate row identity
- class-degenerate fold (missing class in train or validation)
- invalid target
- invalid probability
- nonfinite metric
- identity mismatch
- duplicate candidate result
- >12 distinct recipe identities
- missing complexity order when tie requires it

No fallback random splitting.
No automatic fold repair.
No automatic candidate retry.
No outer VALIDATION fallback.
No TEST fallback.

## 17. Provenance contract

Every complete inner-candidate result must include:

- methodologyId: 'mlb-v1-train-only-inner-validation-development-methodology-v1'
- matrixId
- datasetId
- manifestId
- innerFoldPlanId
- candidateRecipeId
- candidateRecipeFingerprint
- algorithmIdentity
- preprocessingPolicyIdentity (if any)
- featurePolicyIdentity
- optimizerConfigIdentity (if any)
- foldResultIdentities: readonly string[]
- aggregateEvaluatorVersion: 'mlb-inner-aggregate-evaluator-v1'
- executionTimestamp?: string (optional; not part of candidate identity)

MODEL-AFFECTING provenance = fields that determine the candidate's predictions.
EXECUTION/AUDIT provenance = timestamp, environment, runner identity.

Candidate identity must not depend on runtime timestamp.

## 18. Exact implementation slices

SLICE_COUNT = 5

SLICE_1 (E3-A): TRAIN-only/fold-plan contract
- Files to create:
  - src/prediction/mlb/mlb-train-only-inner-fold-plan.ts
  - tests/prediction/mlb/mlb-train-only-inner-fold-plan.test.ts
- Responsibility: immutable fold plan types, frozen fold definitions, validator
- Dependencies: none (pure types and date validation)
- Non-goals: no row materialization, no metrics, no candidate execution

SLICE_2 (E3-B): fold materialization + invariants
- Files to create:
  - src/prediction/mlb/mlb-train-only-inner-development-evaluator.ts (extraction + fold builder sections)
  - tests/prediction/mlb/mlb-train-only-inner-development-evaluator.test.ts (fold tests)
- Responsibility: extractMLBOuterTrainRowsForInnerDevelopment, buildMLBTrainOnlyInnerValidationFolds, all invariant checks
- Dependencies: E3-A
- Non-goals: no candidate predictions, no metric aggregation

SLICE_3 (E3-C): inner reference + fold metric evaluator
- Files to create:
  - src/prediction/mlb/mlb-train-only-inner-development-evaluator.ts (reference + metric sections)
  - tests/prediction/mlb/mlb-train-only-inner-development-evaluator.test.ts (reference + metric tests)
- Responsibility: buildMLBInnerDevelopmentReferenceFacts, evaluateMLBInnerFoldMetrics
- Dependencies: E3-B
- Non-goals: no aggregation, no gate, no ranking

SLICE_4 (E3-D): aggregate inner eligibility contract
- Files to create:
  - src/prediction/mlb/mlb-train-only-inner-development-evaluator.ts (aggregate + gate sections)
  - tests/prediction/mlb/mlb-train-only-inner-development-evaluator.test.ts (aggregate + gate tests)
- Responsibility: evaluateMLBTrainOnlyInnerCandidate, evaluateMLBTrainOnlyInnerCandidateGate
- Dependencies: E3-C
- Non-goals: no ranking, no budget

SLICE_5 (E3-E): eligible-candidate ranking + 12-recipe budget/provenance
- Files to create:
  - src/prediction/mlb/mlb-train-only-inner-development-evaluator.ts (ranking + budget sections)
  - tests/prediction/mlb/mlb-train-only-inner-development-evaluator.test.ts (ranking + budget tests)
- Responsibility: rankInnerEligibleCandidates, MLBInnerDevelopmentRecipeBudget, provenance fields
- Dependencies: E3-D
- Non-goals: no model fitting, no candidate recipe creation

## 19. Exact proposed file scope per slice

FILES_TO_CREATE =

src/prediction/mlb/mlb-train-only-inner-fold-plan.ts
src/prediction/mlb/mlb-train-only-inner-development-evaluator.ts
tests/prediction/mlb/mlb-train-only-inner-fold-plan.test.ts
tests/prediction/mlb/mlb-train-only-inner-development-evaluator.test.ts

FILES_TO_MODIFY =

NONE

No existing production source file is modified.
No existing test file is modified.

## 20. Comprehensive test plan

TRAIN boundary:
- 301 rows accepted
- VALIDATION row rejected
- TEST row rejected
- duplicate TRAIN row rejected
- malformed chronology rejected
- non-MLB sport rejected
- wrong matrixId/manifestId/datasetId rejected

Fold construction:
- exact four folds
- exact row counts (91/51, 142/55, 197/55, 252/49)
- exact target counts (home/away per fold)
- exact date boundaries
- expanding windows verified
- no same-date leakage (train end < validation start)
- no non-TRAIN rows in output
- both classes required in train and validation
- duplicate exampleId rejected
- non-canonical row order rejected
- wrong source population rejected

Reference builder:
- P50 logLoss exact
- P50 Brier exact
- fold-train-prior probability exact
- fold-train-prior logLoss exact
- fold-train-prior Brier exact
- only train rows determine prior
- invalid source fails
- non-finite prior fails
- zero train rows fails
- empty validation rows fails

Metrics:
- logLoss exact with clipping [1e-15, 1-1e-15]
- Brier exact mean((p-y)^2)
- AUC tie-correct exact
- invalid probability (NaN, Infinity, <0, >1) fails
- nonfinite metric fails
- target validation (0/1 only)
- prediction count mismatch fails

Aggregate:
- correct row-weighted mean (not unweighted fold mean)
- exact four-fold requirement
- reference aggregation weighted same way
- worst-fold diagnostics correct
- beat-count diagnostics correct
- missing fold rejected
- duplicate fold rejected
- identity mismatch across folds rejected

Gate:
- strict better-than both references on logLoss -> eligible
- strict better-than both references on Brier -> eligible
- tie on logLoss -> rejected
- tie on Brier -> rejected
- logLoss failure only -> rejected with logLoss reason
- Brier failure only -> rejected with Brier reason
- both failure -> rejected with both reasons
- AUC cannot rescue rejection

Ranking:
- logLoss first
- Brier second
- complexity third
- candidate ID fourth
- AUC ignored
- exact tie on all four -> deterministic by candidate ID
- missing complexity metadata on tie -> fail closed

Budget:
- 12 unique recipes accepted
- recipe 13 rejected
- four folds for one recipe count as one recipe
- changed model-affecting field changes fingerprint
- runtime metadata does not change recipe identity

Safety:
- outer VALIDATION rows cannot enter candidate-development API
- TEST rows cannot enter candidate-development API
- odds/market fields absent from all new contracts

## 21. Regression boundaries

Future implementation must preserve existing:
- pre-TEST gate (mlb-pretest-candidate-gate-contract.ts)
- first/second fit artifacts/contracts (mlb-logistic-regression-fit-contract.ts, mlb-model-training-plan-contract.ts)
- outer training/evaluation protocol
- historical matrix contracts (mlb-training-matrix-contract.ts)
- reporting/grading/performance aggregation

No existing production prediction semantics may change merely to add inner development tooling.

The inner evaluator is DEVELOPMENT INFRASTRUCTURE.
It must not affect live/production prediction output until a later explicitly approved candidate is trained, validated, tested, and released.

## 22. Outer VALIDATION isolation

OUTER_VALIDATION_USED_BY_INNER_EVALUATOR = NO

The eventual evaluator must not expose methods such as:
- evaluateOnOuterValidation
- releaseCandidate
- any method accepting outer VALIDATION rows

Remaining current outer VALIDATION attempts using current split: 1
must NOT be consumed by any E3 implementation test.
Use synthetic fixtures for generic tests.
If current-corpus integration fixtures are used: TRAIN rows only.

## 23. TEST isolation

TEST_USED_BY_INNER_EVALUATOR = NO

The eventual evaluator must not expose methods such as:
- evaluateOnTest
- scoreTestRows
- releaseCandidate

TEST access remains exclusively owned by evaluateAndReleaseMLBDeterministicModel in a later authorized phase.

## 24. Odds-blind boundary

No sportsbook odds, prices, moneylines, implied market probabilities, market consensus, market comparisons, value or edge calculations, CLV, Kelly inputs, monetary stakes, bankroll values, ROI, yield, or any monetary metric is permitted in inner-development inputs, outputs, or provenance fields.

All new contracts inherit the existing assertNoOddsContamination firewall pattern.

## 25. Explicit freeze fields

NEXT_REAL_FIT_AUTHORIZED = NO
V3_CONFIGURATION_CREATED = NO
INNER_CANDIDATE_EXECUTION_AUTHORIZED = NO
OUTER_VALIDATION_AUTHORIZED = NO
TEST_AUTHORIZED = NO

## 26. Amendment scope (from prior phase findings)

AMENDMENT_REQUIRED_FOR_NONFINITE_OWNERSHIP = YES
AMENDMENT_REQUIRED_FOR_ALGORITHM_IDENTITY = NO
AMENDMENT_REQUIRED_FOR_FEATURE_ORDER_IDENTITY = NO
AMENDMENT_REQUIRED_FOR_OTHER_IDENTITY_FIELDS = planId, matrixId, configId, manifestId, datasetId, evaluationPlanId (inner), featureIds

The inner evaluator's identity fields are separate from outer pre-TEST gate identity fields.
The inner gate must verify fold-local identity consistency (fold ID, candidate recipe ID, matrix/manifest/dataset identity).
Algorithm identity is L2_LOGISTIC_REGRESSION_BINARY_V1 only (same as outer), so algorithm mismatch remains structurally unreachable within the authorized domain.

## 27. Safety accounting (planned)

REAL_TRAINER_INVOCATIONS_THIS_PHASE = 0
TOTAL_REAL_TRAINER_INVOCATIONS = 2
NEW_REAL_MODELS = 0
INNER_CANDIDATE_EVALUATIONS = 0
V3_CONFIGURATIONS_CREATED = 0
OUTER_VALIDATION_PAYLOAD_ROWS_INSPECTED = 0
TEST_PAYLOAD_ROWS_INSPECTED = 0
NETWORK_DATA_FETCHES = 0
DATA_REMATERIALIZATIONS = 0
PRODUCTION_SOURCE_FILES_CHANGED = 0
TEST_SOURCE_FILES_CHANGED = 0
ODDS_MARKET_INPUTS = NONE

## 28. Planning consistency audit

Search terms verified in this document:

TRAIN - present (TRAIN-only boundary, innerTrainRows)
VALIDATION - present (innerValidationRows, outer VALIDATION isolation)
TEST - present (TEST isolation)
inner - present (inner folds, inner development)
fold - present (fold plan, fold materialization, fold metrics)
candidate - present (candidate runner, candidate recipe, candidate prediction)
recipe - present (recipe budget, recipe identity, recipe fingerprint)
12 - present (MAX_DISTINCT_INNER_CANDIDATE_RECIPES = 12)
logLoss - present (aggregate logLoss, reference logLoss)
Brier - present (aggregate Brier, reference Brier)
AUC - present (descriptive only, tie-correct semantics)
prior - present (fold-train-prior)
P50 - present (P50 reference)
rank - present (candidate ranking)
complexity - present (complexity rank)
fingerprint - present (recipe fingerprint)
provenance - present (provenance contract)
fit - present (future fitting boundary, not executed)
trainer - present (trainer prohibited)
V3 - present (V3 prohibited)
outer - present (outer VALIDATION, outer TEST)
odds - present (odds-blind boundary)
sportsbook - present (prohibited)
moneyline - present (prohibited)
implied - present (prohibited)
market - present (prohibited)
edge - present (prohibited)
value - present (prohibited)
CLV - present (prohibited)

Required:

IMPLEMENTATION_EXECUTED = NO
PRODUCTION_CODE_CHANGED = NO
TEST_CODE_CHANGED = NO
NEW_MODEL_FITS = 0
V3_CONFIGURATION_CREATED = NO
INNER_CANDIDATE_EXECUTION_AUTHORIZED = NO
OUTER_VALIDATION_AUTHORIZED = NO
TEST_AUTHORIZED = NO
MAX_DISTINCT_INNER_CANDIDATE_RECIPES = 12
INNER_FOLD_COUNT = 4
OUTER_VALIDATION_USED_BY_INNER_EVALUATOR = NO
TEST_USED_BY_INNER_EVALUATOR = NO
ODDS_MARKET_INPUTS = NONE
