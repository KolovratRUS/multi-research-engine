# MLB V1 Real Feature Manifest + Training Matrix Plan

## 1. Purpose and current baseline

This document is the Phase 8V-D3-A planning artifact for the Multi Research Engine.

Current baseline: aa49c13259cf0bda801d6d4cea5ee9945826c6c1
("Implement MLB historical dataset materialization")

At this baseline the repository already owns a proven bounded real-data path:

real MLB acquisition
→ historical as-of reconstruction
→ canonical pregame snapshots
→ final outcome labels
→ validated historical labelled dataset

Real smoke proved:

date = 2026-04-01
examples = 15
cutoff = 360 minutes before scheduled start
cutoff delta = 21,600,000 ms for all examples
real dataset contract = PASS
temporal violations = 0
odds contamination = NONE
actual/final starter substitution = 0

The next missing production boundary is:

MLBHistoricalLabelledDataset
        ↓
CONCRETE REAL MLB V1 FEATURE MANIFEST INSTANCE
        ↓
REAL TRAINING MATRIX
        ↓
execute existing fitAndEvaluateMLBDeterministicLogisticRegression
on validated real matrix

This phase is AUDIT + PLAN ONLY.

This document does NOT implement feature extraction, matrix materialization, model fitting, hyperparameter search, calibration, model artifact generation, model release, live inference, predicted winners, multi construction, staking, API, UI, or deployment.

Sportsbook/market data remains permanently prohibited.

## 2. Locked upstream real-data boundary

The real-data boundary is bounded by these production contracts:

- `src/prediction/mlb/mlb-historical-dataset-materializer.ts`
- `src/prediction/mlb/mlb-historical-canonical-snapshot-adapter.ts`
- `src/prediction/mlb/mlb-pregame-snapshot-contract.ts`
- `src/prediction/mlb/mlb-historical-labelled-dataset-contract.ts`
- `src/prediction/mlb/mlb-historical-labelled-dataset-builder.ts`

The materializer produces `MLBHistoricalLabelledDataset`.
Each example contains:

```text
example
→ snapshot (MLBCanonicalPregameSnapshot)
→ reconstruction (POINT_IN_TIME_AS_OF_CUTOFF)
→ label (OFFICIAL_FINAL winner + scores + source)
```

No field outside `snapshot` is allowed to become a predictor feature.
No field from `label` or `reconstruction` is allowed to become a predictor feature.

## 3. Existing canonical snapshot audit

Source of truth: `src/prediction/mlb/mlb-pregame-snapshot-contract.ts`

`MLBCanonicalPregameSnapshot` exposes:

### 3.1 game context

Field path | Type | Classification
`$.game.gameId` | string identifier | PROVENANCE_ONLY
`$.game.scheduledStartAt` | RFC3339 timestamp | PROVENANCE_ONLY
`$.game.officialDate` | YYYY-MM-DD | PROVENANCE_ONLY
`$.game.season` | number | PREDICTOR_CANDIDATE
`$.game.gameType` | `REGULAR_SEASON` | `POSTSEASON` | `SPRING_TRAINING` | `ALL_STAR` | `OTHER` | PREDICTOR_CANDIDATE
`$.game.status` | `SCHEDULED` | `PRE_GAME` | `POSTPONED` | `CANCELLED` | `UNKNOWN` | PREDICTOR_CANDIDATE
`$.game.homeTeamId` | string identifier | PROVENANCE_ONLY
`$.game.awayTeamId` | string identifier | PROVENANCE_ONLY
`$.game.venueId` | string | null | PROVENANCE_ONLY
`$.game.neutralSite` | boolean | null | PREDICTOR_CANDIDATE
`$.game.doubleheader` | null | `{ doubleheaderId, gameNumber: 1 | 2 }` | PREDICTOR_CANDIDATE (only `gameNumber` is numeric)

### 3.2 home team context / away team context

Team identity fields are identifiers (`homeTeamId`, `awayTeamId`) — PROVENANCE_ONLY.
No numeric team feature is exposed at the `game` level.

### 3.3 starting pitchers

`$.startingPitchers.home` and `$.startingPitchers.away`

Field path | Type | Classification
`state` | `CONFIRMED` | `PROBABLE` | `UNCONFIRMED` | `UNAVAILABLE` | PREDICTOR_CANDIDATE
`pitcherId` | string | null | PROVENANCE_ONLY
`announcedAt` | string | null | PROVENANCE_ONLY
`sourceRefIds` | string[] | PROVENANCE_ONLY

The canonical snapshot does NOT serialize pitcher season aggregates (ERA, WHIP, K/9, days rest).
The adapter input accepts `pitcherAggregates`, but they are not written into the canonical snapshot sections payloads.
Therefore pitcher aggregate features are NOT available from the canonical snapshot alone in V1.

### 3.4 team historical aggregates

Available inside section payloads:

Section ID | Kind | Entity | Available payload fields
`section-home-batting` | `TEAM_SEASON_CONTEXT` | `HOME_TEAM` | `teamId`, `teamName`, `completeness`, `warnings`, `seasonStats.gamesPlayed`, `wins`, `losses`, `winRate`, `runsScored`, `runsAllowed`, `runDifferential`, `runsScoredPerGame`, `runsAllowedPerGame`
`section-away-batting` | `TEAM_SEASON_CONTEXT` | `AWAY_TEAM` | same
`section-home-bullpen` | `BULLPEN_CONTEXT` | `HOME_TEAM` | batting fields plus `recentWorkload.gamesInPrevious3Days`, `extraInningGames`, `confirmedRelieverAvailability` (null)
`section-away-bullpen` | `BULLPEN_CONTEXT` | `AWAY_TEAM` | same

When the aggregate is `null`, the section status is `UNAVAILABLE` and the payload is `{}`.

### 3.5 venue

`section-venue` (`VENUE_PARK_CONTEXT`)
Payload fields: `id`, `name`, `latitude`, `longitude`, `timezone` (null), `roofType` (null), `warnings` ([])

`timezone` and `roofType` are currently null in the adapter but are part of the section schema.

### 3.6 weather

`section-weather` (`WEATHER_CONTEXT`)
Status is always `UNAVAILABLE`; payload is always `{}`.
Exclude from V1 features.

### 3.7 source/provenance metadata

`$.sourceReferences` and `$.sections[].sourceRefIds` are PROVENANCE_ONLY.
`$.sections[].asOfAt` is PROVENANCE_ONLY.
`$.capturedAt` and `$.dataCutoffAt` are PROVENANCE_ONLY.

### 3.8 timestamps

`$.capturedAt`, `$.dataCutoffAt`, `$.game.scheduledStartAt` are PROVENANCE_ONLY.
They must never become numeric predictor features.

### 3.9 identifiers

`$.snapshotId`, `$.game.gameId`, `$.game.homeTeamId`, `$.awayTeamId`, pitcher `personId`, venue `id`, team `teamId` are PROVENANCE_ONLY.
They must not be hashed, embedded, or used as numeric inputs unless a proven encoding is required by an existing legitimate model design (none exists yet).

### 3.10 status/type metadata

`$.game.gameType` and `$.game.status` are finite categoricals and are PREDICTOR_CANDIDATE.
`$.startingPitchers.home.state` / `away.state` are finite categoricals and are PREDICTOR_CANDIDATE.

## 4. Historical dataset + label boundary

Source of truth: `src/prediction/mlb/mlb-historical-labelled-dataset-contract.ts`

Path:

dataset
→ examples[i]
→ split
→ snapshot (MLBCanonicalPregameSnapshot)
→ reconstruction (mode, cutoffAt, reconstructedAt)
→ label (status, target, homeRuns, awayRuns, winnerTeamId, finalizedAt, source)

Classification:

Field / group | Classification
`split` | TRAINING_CONTROL_METADATA
`exampleId` | TRAINING_CONTROL_METADATA
`snapshot` | PREDICTOR_SOURCE
`reconstruction.mode` | PROVENANCE_ONLY
`reconstruction.cutoffAt` | PROVENANCE_ONLY
`reconstruction.reconstructedAt` | PROVENANCE_ONLY
`label.status` | LABEL_ONLY
`label.target` | LABEL_ONLY
`label.homeRuns` | LABEL_ONLY
`label.awayRuns` | LABEL_ONLY
`label.winnerTeamId` | LABEL_ONLY
`label.finalizedAt` | LABEL_ONLY
`label.source` | LABEL_ONLY
`dataset.contractVersion` | PROVENANCE_ONLY
`dataset.sport` | PROVENANCE_ONLY
`dataset.target` | PROVENANCE_ONLY
`dataset.datasetId` | PROVENANCE_ONLY
`dataset.createdAt` | PROVENANCE_ONLY
`dataset.splitPolicy` | TRAINING_CONTROL_METADATA

The validator (`validateMLBHistoricalLabelledDataset`) already rejects outcome fields leaking into non-label objects via `TARGET_GAME_OUTCOME_FIELDS` checks.

The proposed feature extractor must receive ONLY the canonical snapshot.
It must NOT receive the label, reconstruction, or dataset metadata as feature inputs.

The matrix builder API should accept the whole labelled example internally, but the feature extractor must be called with `example.snapshot` only.
The label is consumed only by the matrix row target encoder.

## 5. Existing feature/training stack inventory

### 5.1 Synthetic feature extractor

Path: `src/lib/backtesting/mlb/feature-extractor.ts`

This extractor operates on synthetic backtesting types:

- `HistoricalMLBGame`
- `HistoricalPitcherProfile`
- `HistoricalTeamProfile`

It produces `MLBPregameFeatures` with:

- `startingPitcher.homeEra`, `awayEra`, `homeWhip`, `awayWhip`, `homeKPer9`, `awayKPer9`, `homeDaysRest`, `awayDaysRest`, `homeAvailable`, `awayAvailable`
- `offense.homeRunsPerGame`, `awayRunsPerGame`, `homeOps`, `awayOps`, `homeRecentWinRate`, `awayRecentWinRate`, `homeSeasonWinRate`, `awaySeasonWinRate`
- `context.homeAdvantage`, `venueKnown`, `weatherAvailable`
- `availability` flags

Classification: **SYNTHETIC_ONLY**

Reason: it uses `HistoricalPitcherProfile.seasonStats` and `daysSinceLastStart`, which are not present in the canonical snapshot sections payloads. It also uses `recentGames` win-rate computation that is not present in the canonical snapshot. This extractor cannot be reused for real V1 without a full rewrite against canonical snapshot sections.

### 5.2 Feature vector contract

Path: `src/prediction/mlb/mlb-feature-vector-contract.ts`

Defines:
- `MLBFeatureManifest`
- `MLBFeatureVector`
- `extractMLBLeakageSafeFeatureVector(manifest, snapshot)`
- manifest validation, canonical ordering, unique feature IDs
- `MLBExtractedFeatureValue` with `featureId`, `value`, `wasMissing`

Classification: **REUSE_UNCHANGED**

Reason: The contract and extraction function already provide the exact production feature extraction path for canonical snapshot sections payloads via manifest `payloadPath` traversal. A concrete real V1 manifest definition is required, but the contract itself does not need modification.

### 5.3 Training matrix contract

Path: `src/prediction/mlb/mlb-training-matrix-contract.ts`

Defines:
- `MLBTrainingMatrix`
- `MLBTrainingMatrixRow`
- `MLBTrainingTargetValue` (`0 | 1`)
- target encoding `HOME_WIN_1_AWAY_WIN_0`
- split counts, canonical ordering, issue codes

Classification: **REUSE_UNCHANGED**

Reason: The contract already expresses the exact desired matrix shape for real V1.

### 5.4 Model training plan contract

Path: `src/prediction/mlb/mlb-model-training-plan-contract.ts`

Defines:
- `MLBModelTrainingConfiguration`
- `MLBModelEvaluationPlan`
- algorithm `L2_LOGISTIC_REGRESSION_BINARY_V1`
- randomness policy `NO_RANDOMNESS`
- feature value policy `RAW_FINITE_FEATURE_VALUES`
- missing indicator policy `PRESERVE_WAS_MISSING_FLAGS`
- deterministic batch gradient descent optimizer
- protocol `TRAIN_FIT_VALIDATION_SELECT_TEST_FINAL_V1`

Classification: **REUSE_UNCHANGED**

Reason: The contract already locks the exact trainer configuration V1 needs. No modification required.

### 5.5 Logistic regression fit contract

Path: `src/prediction/mlb/mlb-logistic-regression-fit-contract.ts`

Defines:
- `MLBDeterministicLogisticRegressionModel`
- `MLBModelValidationEvaluation`
- `MLBModelFitValidationResult`
- `fitAndEvaluateMLBDeterministicLogisticRegression(configuration, evaluationPlan, trainingMatrix)` — actual deterministic L2 logistic regression implementation with batch gradient descent

Classification: **REUSE_UNCHANGED**

Reason: The existing exported function `fitAndEvaluateMLBDeterministicLogisticRegression` already implements deterministic L2 logistic regression fitting and validation evaluation. It is executed in tests. It has not yet been executed on a validated real MLB training matrix.

### 5.6 Model test/release contract

Path: `src/prediction/mlb/mlb-model-test-release-contract.ts`

Defines:
- `MLBModelTestEvaluation`
- `MLBModelReleaseRecord`
- `MLBModelTestReleaseResult`

Classification: **REUSE_UNCHANGED**

Reason: Defines the expected release artifact shape. No production release generator exists yet.

### 5.7 Offline pregame inference contract

Path: `src/prediction/mlb/mlb-offline-pregame-inference-contract.ts`

Defines:
- `MLBOfflinePregameInference`
- decision policy `HOME_AT_OR_ABOVE_0_5_V1`

Classification: **REUSE_UNCHANGED**

Reason: Defines the inference output contract. The production inference path must consume a released model artifact plus a live canonical snapshot.

### 5.8 Historical labelled dataset builder

Path: `src/prediction/mlb/mlb-historical-labelled-dataset-builder.ts`

Classification: **REUSE_UNCHANGED**

Reason: Already builds valid `MLBHistoricalLabelledDataset` from canonical snapshots + outcomes.

## 6. Trainer truth

PRODUCTION_LOGISTIC_REGRESSION_FITTER_FUNCTION = fitAndEvaluateMLBDeterministicLogisticRegression
(src/prediction/mlb/mlb-logistic-regression-fit-contract.ts line 1456)

PRODUCTION_FITTER_IMPLEMENTED = YES

PRODUCTION_FITTER_EXECUTED_IN_TESTS = YES

PRODUCTION_FITTER_EXECUTED_ON_REAL_MLB_MATRIX = NO

TRAINER IMPLEMENTATION = EXISTS

TRAINER REUSE = UNCHANGED

REAL TRAINER EXECUTION = NOT YET PERFORMED

The existing `fitAndEvaluateMLBDeterministicLogisticRegression` function:
- accepts `MLBModelTrainingConfiguration`, `MLBModelEvaluationPlan`, `MLBTrainingMatrix`
- performs deterministic batch gradient descent with L2 regularization
- uses `NO_RANDOMNESS`
- uses `RAW_FINITE_FEATURE_VALUES`
- preserves `wasMissing` flags as separate `missingIndicatorCoefficient` dimensions
- validates generated model, evaluation, and result against existing contracts
- calls `assertNoOddsContamination` on the final result

No "future trainer implementation" is needed. D3-C means executing the existing trainer on a validated real MLB matrix.

## 7. Production feature-manifest V1 design

### 7.1 Manifest version

```text
MLB_FEATURE_MANIFEST_CONTRACT_VERSION = mlb-feature-manifest-v1
```

Proposed manifest ID:

```text
mlb-real-pregame-winner-feature-manifest-v1
```

The manifest ID is human-readable, stable, and identifies the schema semantics. It does NOT incorporate a dataset date, smoke date, datasetId, matrixId, current timestamp, output path, or random UUID.

### 7.2 Feature representation

V1 uses:

```text
HOME + AWAY RAW ONLY
```

Differential features (`home - away`) are exact linear combinations of the raw home and away inputs. Under L2 logistic regression, including both raw and differential features creates exact linear redundancy and does not add new information. V1 intentionally omits differentials.

### 7.3 Feature ordering

Features are ordered by stable `featureId` strings.
The manifest validator (`validateMLBFeatureManifest`) already requires canonical ascending featureId order.

### 7.4 Exact proposed feature inventory

All features are derived from canonical snapshot `sections` payloads only.
No label, no reconstruction, no provenance timestamp, no identifier is used as a numeric feature.

Feature ID | Section ID | payloadPath | valueKind | missingPolicy | defaultValue | Classification | Can default equal observed? | Current extractor support
`gameType` | `section-game-context` | `gameType` | NUMBER | USE_DEFAULT | 0 | DIRECT_SOURCE_FEATURE | yes (REGULAR_SEASON maps to 0) | DIRECTLY_SUPPORTED
`neutralSite` | `section-game-context` | `neutralSite` | NUMBER | USE_DEFAULT | 0 | DIRECT_SOURCE_FEATURE | yes (false/null map to 0) | DIRECTLY_SUPPORTED
`doubleHeaderGameNumber` | `section-game-context` | `doubleheader.gameNumber` | NUMBER | USE_DEFAULT | 0 | DIRECT_SOURCE_FEATURE | yes (non-doubleheader maps to 0) | DIRECTLY_SUPPORTED
`scheduledInnings` | `section-game-context` | `scheduledInnings` | NUMBER | USE_DEFAULT | 9 | DIRECT_SOURCE_FEATURE | yes (standard 9) | DIRECTLY_SUPPORTED
`homeWinRate` | `section-home-batting` | `seasonStats.winRate` | NUMBER | USE_DEFAULT | 0.5 | DIRECT_SOURCE_FEATURE | yes (0.5 is plausible observed value) | DIRECTLY_SUPPORTED
`awayWinRate` | `section-away-batting` | `seasonStats.winRate` | NUMBER | USE_DEFAULT | 0.5 | DIRECT_SOURCE_FEATURE | yes (0.5 is plausible observed value) | DIRECTLY_SUPPORTED
`homeRunsScoredPerGame` | `section-home-batting` | `seasonStats.runsScoredPerGame` | NUMBER | USE_DEFAULT | 0 | DIRECT_SOURCE_FEATURE | yes (0 is plausible observed value) | DIRECTLY_SUPPORTED
`awayRunsScoredPerGame` | `section-away-batting` | `seasonStats.runsScoredPerGame` | NUMBER | USE_DEFAULT | 0 | DIRECT_SOURCE_FEATURE | yes (0 is plausible observed value) | DIRECTLY_SUPPORTED
`homeRunsAllowedPerGame` | `section-home-batting` | `seasonStats.runsAllowedPerGame` | NUMBER | USE_DEFAULT | 0 | DIRECT_SOURCE_FEATURE | yes (0 is plausible observed value) | DIRECTLY_SUPPORTED
`awayRunsAllowedPerGame` | `section-away-batting` | `seasonStats.runsAllowedPerGame` | NUMBER | USE_DEFAULT | 0 | DIRECT_SOURCE_FEATURE | yes (0 is plausible observed value) | DIRECTLY_SUPPORTED
`homeStarterAvailable` | `section-home-starter` | `availability` | NUMBER | USE_DEFAULT | 0 | DIRECT_SOURCE_FEATURE | yes (unavailable maps to 0) | DIRECTLY_SUPPORTED
`awayStarterAvailable` | `section-away-starter` | `availability` | NUMBER | USE_DEFAULT | 0 | DIRECT_SOURCE_FEATURE | yes (unavailable maps to 0) | DIRECTLY_SUPPORTED
`homeBullpenGamesInPrevious3Days` | `section-home-bullpen` | `recentWorkload.gamesInPrevious3Days` | NUMBER | USE_DEFAULT | 0 | DIRECT_SOURCE_FEATURE | yes (0 is plausible observed value) | DIRECTLY_SUPPORTED
`awayBullpenGamesInPrevious3Days` | `section-away-bullpen` | `recentWorkload.gamesInPrevious3Days` | NUMBER | USE_DEFAULT | 0 | DIRECT_SOURCE_FEATURE | yes (0 is plausible observed value) | DIRECTLY_SUPPORTED
`homeBullpenExtraInningGames` | `section-home-bullpen` | `recentWorkload.extraInningGames` | NUMBER | USE_DEFAULT | 0 | DIRECT_SOURCE_FEATURE | yes (0 is plausible observed value) | DIRECTLY_SUPPORTED
`awayBullpenExtraInningGames` | `section-away-bullpen` | `recentWorkload.extraInningGames` | NUMBER | USE_DEFAULT | 0 | DIRECT_SOURCE_FEATURE | yes (0 is plausible observed value) | DIRECTLY_SUPPORTED

Note: Differential features (`winRateDiff`, `runsScoredPerGameDiff`, `runsAllowedPerGameDiff`, `starterAvailabilityDiff`) are NOT included in V1. They are exact linear combinations of the raw home and away inputs and add no new information under L2 logistic regression.

Note: `homeAdvantage` is NOT included in V1. It is a constant value of 1 for every row and is redundant with the model intercept.

Categorical encoding:

`gameType`:
REGULAR_SEASON -> 0
POSTSEASON -> 1
SPRING_TRAINING -> 2
ALL_STAR -> 3
OTHER -> 4

`neutralSite`:
true -> 1
false -> 0
null -> 0

`doubleHeaderGameNumber`:
null -> 0
1 -> 1
2 -> 2

No runtime-discovered category mapping.
No JavaScript object-order dependence.
Unknown category behavior is defined by the fixed mapping above; the manifest validator rejects invalid literals at validation time.

## 8. Missingness policy

### 8.1 Missing probable starter

When `$.startingPitchers.home.state` is `UNAVAILABLE`, the starter section payload is `{}`.
The feature extractor must emit `homeStarterAvailable = 0` with `wasMissing = true`.
When the state is `CONFIRMED`, `PROBABLE`, or `UNCONFIRMED`, the section payload contains `availability` (same as state).
The feature extractor must emit `homeStarterAvailable = 1` with `wasMissing = false`.

`pitcherId` and `announcedAt` are NOT features. They are provenance.

### 8.2 Missing pitcher aggregate

The canonical snapshot does not serialize pitcher aggregates in V1.
No pitcher numeric aggregate feature is proposed for V1.
If pitcher aggregates are added to the canonical snapshot in a future phase, the same `USE_DEFAULT` + `wasMissing` policy applies.

### 8.3 Missing optional team/context field

Team aggregate sections may be `UNAVAILABLE` with payload `{}`.
Every team numeric feature uses `missingPolicy: USE_DEFAULT`.
Default values are explicit in the manifest and documented above.

### 8.4 Nullable categorical field

`neutralSite` may be `null`.
Default value is `0` (treated as not neutral).

### 8.5 Model-visible missingness semantics

`wasMissing` is stored in `MLBExtractedFeatureValue` alongside each numeric `value`.
The existing trainer `fitAndEvaluateMLBDeterministicLogisticRegression` already uses `wasMissing` as a separate numeric model dimension via `missingIndicatorCoefficient` arrays.

V1 architecture:

```text
MLBFeatureVector.values[i] = {
  featureId: string,
  value: number,           <- numeric model input
  wasMissing: boolean      -> mapped to 0/1 by trainer, used as separate missingIndicatorCoefficient input
}
```

For every feature whose `USE_DEFAULT` value can also occur as a legitimate observed value, the `wasMissing` flag is the only mechanism that distinguishes imputed zero from observed zero. The trainer already expands each `wasMissing` into its own coefficient.

Explicit model-visible missingness features: YES (one per numeric feature, via paired `wasMissing` flag).
Extractor extension required: NO (the existing extractor already sets `wasMissing` correctly).

### 8.6 No NaN / no Infinity / no hindsight / no magic

All defaults are explicit finite numbers.
No `NaN`, no `Infinity`, no silent substitution with actual/final starter data, no magic undocumented sentinel.

### 8.7 Imputation

No learned imputation is required for V1.
All missingness uses fixed deterministic defaults.
If future phases require learned preprocessing parameters:

- fit parameters on TRAIN split only
- persist parameters with the preprocessing artifact
- apply frozen parameters to validation/test/inference
- never inspect labels during preprocessing fit

## 9. Categorical encoding policy

Four categorical/boolean concepts are encoded in V1:

1. `gameType` (5 values)
2. `neutralSite` (3 states: true, false, null)
3. `doubleHeaderGameNumber` (3 states: null, 1, 2)

Encoding is deterministic numeric mapping owned by the manifest.
The manifest is versioned.
The manifest validator rejects invalid literals.

No `localeCompare`.
No runtime-discovered numbering.
No category mapping fitted from validation/test.

## 10. Numeric transform and scaling policy

V1 uses:

```text
no scaling
no standardization
no clipping
no log transforms
no normalization
```

Policy: `RAW_FINITE_FEATURE_VALUES`

Justification: the existing `MLBModelTrainingConfiguration` already locks `featureValuePolicy: RAW_FINITE_FEATURE_VALUES`.
The existing trainer contracts expect raw finite values.

Numeric range is bounded by baseball reality (e.g., winRate is 0-1, runs per game is 0-50, etc.).
No learned scaling is required.

## 11. Real training-matrix contract

Source of truth: `src/prediction/mlb/mlb-training-matrix-contract.ts`

The matrix converts `MLBHistoricalLabelledDataset` into `MLBTrainingMatrix`.

### 11.1 Matrix row

Field | Source
`exampleId` | `example.exampleId`
`split` | `example.split`
`vector` | `extractMLBLeakageSafeFeatureVector(manifest, example.snapshot)`
`targetValue` | derived from `example.label.winnerTeamId`

### 11.2 Matrix identity

```text
matrixId = <datasetId>::<manifestId>::<splitPolicy.strategy>::training-matrix-v1
```

Matrix identity is deterministic.
No `Math.random`, no `randomUUID`, no current timestamp, no output path.

### 11.3 Target encoding

```text
HOME winner  -> 1
AWAY winner  -> 0
```

This matches the existing locked `MLB_TRAINING_TARGET_ENCODING = HOME_WIN_1_AWAY_WIN_0`.

No score margin, total runs, sportsbook result, or other target is added to winner V1.

### 11.4 Target derivation

For each example:
- if `label.winnerTeamId === snapshot.game.homeTeamId` then `targetValue = 1`
- if `label.winnerTeamId === snapshot.game.awayTeamId` then `targetValue = 0`
- otherwise the dataset validator already rejects the example

### 11.5 Missingness in matrix rows

Each `MLBTrainingMatrixRow.vector` contains `MLBFeatureVector.values`, where each entry includes both `value` and `wasMissing`.
The existing trainer treats each `wasMissing` as a separate `missingIndicatorCoefficient` dimension.
The matrix builder does not need to expand missingness indicators; the extractor and trainer already preserve them.

## 12. Chronological split preservation

The dataset validator enforces:

```text
CHRONOLOGICAL_OFFICIAL_DATE_V1
```

with:

- TRAIN window
- VALIDATION window
- TEST window
- embargoDays between windows
- canonical example ordering: split -> officialDate -> gameId -> snapshotId -> exampleId

The matrix builder must preserve those assignments exactly.

It must NOT:

- reshuffle
- randomly resplit
- move examples between splits
- balance by looking at future outcomes
- fit preprocessing on validation/test

Row ordering within each split follows the dataset's canonical order.

If the existing trainer expects different split structures, the narrow adapter is a split-order remapper inside the matrix builder. No existing trainer implementation exists yet, so no adapter is required today.

## 13. Predictor/label leakage firewall

### 13.1 Matrix builder API design

The matrix builder should accept the whole labelled example (snapshot + label) because the dataset already owns both.
However, the feature extractor must receive ONLY `example.snapshot`.

Recommended internal seam:

```text
matrixBuilder(example)
  -> vector = extractMLBLeakageSafeFeatureVector(manifest, example.snapshot)
  -> target = encodeWinner(example.label)
  -> row = { exampleId, split, vector, target }
```

No label field touches the feature extractor.

### 13.2 Forbidden predictor inputs

The feature extractor must reject or structurally avoid:

`label.winner`
`label.homeRuns`
`label.awayRuns`
`label.innings` (not present in current label, but prohibited by contract)
`label.completedAt`
`label.finalizedAt`
`label.source`
`reconstruction.reconstructedAt`
`dataset.createdAt`
postgame/final status facts
actual starting pitchers learned after cutoff
future season aggregates
sportsbook/market information

The canonical snapshot validator already blocks `TARGET_GAME_OUTCOME_FIELDS` in snapshot `game`, sections, and examples.
The feature manifest `payloadPath` traversal is limited to section payloads; root-level outcome fields are inaccessible.

### 13.3 Post-cutoff truth audit

Canonical snapshot fields that could accidentally encode post-cutoff truth:

- `$.game.status` — validated to be pregame only (`SCHEDULED`, `PRE_GAME`, `POSTPONED`, `CANCELLED`, `UNKNOWN`). `FINAL` and `LIVE` are mapped to `UNKNOWN` by `resolvePregameStatus`.
- `$.startingPitchers.*.announcedAt` — validated to be `<= dataCutoffAt`.
- `$.sections[].asOfAt` — validated to be `<= dataCutoffAt`.
- `$.sourceReferences[].fetchedAt` — validated to be `<= dataCutoffAt` by the snapshot adapter.

No canonical snapshot field encodes post-cutoff final outcome truth.

## 14. Odds-blind firewall

The permanent odds-blind boundary is enforced at three points:

1. **Input dataset validation** — `validateMLBHistoricalLabelledDataset` calls `assertNoOddsContamination`.
2. **Feature extraction** — `extractMLBLeakageSafeFeatureVector` calls `assertNoOddsContamination` on both manifest and vector.
3. **Matrix construction** — future matrix builder must call `assertNoOddsContamination` on the constructed matrix.
4. **Model fitting** — `fitAndEvaluateMLBDeterministicLogisticRegression` calls `assertNoOddsContamination` on the generated result.

The existing `odds-contamination-guard` is reused consistently.
No second inconsistent odds detector is created.

Odds-contaminated inputs:
sportsbook odds, betting prices, moneylines, implied market probabilities, market consensus, market comparisons, value calculations, edge calculations against betting markets, CLV, sportsbook-derived Kelly inputs.

These must never enter or influence feature generation, training data, training, validation, model selection, forecasting, winner selection, multi construction, or staking.

## 15. Determinism and finite-number requirements

Requirements:

- every model feature is finite
- no NaN
- no Infinity
- stable feature count
- stable feature order
- stable feature names
- stable categorical mapping
- stable missingness behavior
- same input dataset + same manifest + same preprocessing parameters → identical feature vectors

The manifest contract already enforces stable feature order and unique IDs.
The feature vector contract already enforces finite `value` and canonical `values` array order.
The training matrix contract already enforces canonical row ordering.
The existing `fitAndEvaluateMLBDeterministicLogisticRegression` function enforces deterministic batch gradient descent with `NO_RANDOMNESS`.

Deterministic identity for the matrix is derived from:

```text
datasetId
manifestId
splitPolicy.strategy
contract versions
```

Wall-clock fields (`capturedAt`, `dataCutoffAt`, `reconstructedAt`) are metadata only and are excluded from matrix identity.

## 16. Manifest version/fingerprint strategy

Two levels:

1. **Human-readable manifest version** — `manifestId` string owned by the manifest.
   Value: `mlb-real-pregame-winner-feature-manifest-v1`
   This string identifies the feature schema semantics and must not incorporate a dataset date, smoke date, datasetId, matrixId, current timestamp, output path, or random UUID.

2. **Machine-verifiable feature fingerprint** — a deterministic SHA-256 hash of the explicitly canonical serialized manifest definition.

The canonical serialization must cover exactly these semantic fields:

```text
manifest contract version
manifestId
ordered feature array order
featureId
sectionId
payloadPath
valueKind
missingPolicy
defaultValue
```

The canonical serialization must explicitly exclude:

```text
datasetId
dataset dates
matrixId
training timestamp
runtime timestamp
filesystem path
human comments/descriptions if non-semantic
```

Canonical serialization rule:

```text
UTF-8 bytes of explicitly sorted deterministic JSON
```

Hash algorithm:

```text
SHA-256 via node:crypto createHash('sha256')
```

Existing repository utility:

```text
EXISTING_CANONICALIZATION_UTILITY = NONE
EXISTING_HASH_UTILITY = src/lib/backtesting/mlb/live-history/cache.ts buildHistoricalCacheKey uses crypto.createHash('sha256')
```

Future manifest fingerprint implementation must reuse `crypto.createHash('sha256')` from Node.js built-in `node:crypto` and apply it to explicitly canonical sorted JSON bytes.

A model artifact must eventually prove:

```text
training feature manifest === inference feature manifest
```

before scoring.

This is a future phase requirement (post-D3-B1/D3-B2).
It is not implemented in D3-A.

## 17. Training/inference feature parity

Required architectural goal:

```text
ONE canonical snapshot → feature vector implementation
```

The existing `extractMLBLeakageSafeFeatureVector(manifest, snapshot)` already provides this seam.
Both historical training snapshots and live canonical pregame snapshots conform to `MLBCanonicalPregameSnapshot`.
Therefore the same manifest and extractor can be used for both training and inference.

Current inference path:
`src/prediction/mlb/mlb-offline-pregame-inference-contract.ts` already imports `extractMLBLeakageSafeFeatureVector` and uses it to validate extracted feature vector identity against the model.
The future inference integration seam is:

```text
live canonical snapshot
  -> extractMLBLeakageSafeFeatureVector(lockedManifest, snapshot)
  -> model scoring
  -> MLBOfflinePregameInference
```

No separate live feature extractor is needed.

## 18. Trainer reuse decision

TRAINER IMPLEMENTATION = EXISTS

TRAINER_REUSE = UNCHANGED

REAL_DATA_TO_EXISTING_TRAINING_MATRIX_ADAPTER_REQUIRED = YES

Supporting evidence:

- `src/prediction/mlb/mlb-logistic-regression-fit-contract.ts` exports `fitAndEvaluateMLBDeterministicLogisticRegression`
- The function already performs deterministic L2 logistic regression with batch gradient descent
- It already uses `NO_RANDOMNESS`, `RAW_FINITE_FEATURE_VALUES`, and `PRESERVE_WAS_MISSING_FLAGS`
- It validates generated artifacts against existing contracts
- Tests execute the function successfully
- It has not yet been executed on a validated real MLB training matrix

The synthetic backtesting feature extractor (`src/lib/backtesting/mlb/feature-extractor.ts`) is NOT the production trainer.
It is a heuristic feature constructor for synthetic backtesting types.

Minimum future code seam:
Add a production real-matrix adapter that:
- accepts `MLBHistoricalLabelledDataset`
- calls `extractMLBLeakageSafeFeatureVector(realManifest, example.snapshot)` for each example
- builds `MLBTrainingMatrix`
- calls existing `fitAndEvaluateMLBDeterministicLogisticRegression(configuration, plan, matrix)`
- validates every intermediate artifact against existing contracts

## 19. Missingness and trainer interaction

The manifest preserves `wasMissing` flags in `MLBExtractedFeatureValue`.
The training configuration locks `missingIndicatorPolicy: PRESERVE_WAS_MISSING_FLAGS`.
The existing trainer `fitAndEvaluateMLBDeterministicLogisticRegression` already expands each `wasMissing` into a separate `missingIndicatorCoefficient` model dimension.

V1 matrix rows carry both:

- the numeric feature value (default or observed)
- the `wasMissing` flag as model-visible numeric 0/1 dimension via the trainer

`wasMissing` is NOT a separate featureId in the manifest/vector.
It is metadata paired with each numeric value that the trainer already uses as an explicit model dimension.

This plan defers the exact indicator expansion convention to D3-B3/D3-C.
The locked policy is: missingness is never silently discarded.

## 20. Implementation sequence

### D3-B1: Concrete real MLB V1 manifest definition + fingerprint/compatibility support

Purpose: define the exact V1 feature set and produce a validated manifest artifact.

ADD files:
- `src/prediction/mlb/mlb-real-feature-manifest-v1.ts` (manifest definition)
- `tests/prediction/mlb/mlb-real-feature-manifest-v1.test.ts`

MODIFY files:
- none

Tests:
- manifest validator unit tests
- deterministic feature ordering tests
- missing-policy tests
- odds-contamination rejection tests
- fingerprint determinism tests

Network I/O: none
Filesystem I/O: none
DB I/O: none
Training execution: none
Artifact creation: manifest artifact only

Stop conditions:
- manifest validator passes on valid and invalid inputs
- feature count and order are deterministic
- fingerprint is deterministic
- all tests pass

### D3-B2: Canonical snapshot → feature-vector extractor verification

Purpose: verify `extractMLBLeakageSafeFeatureVector` works with the real V1 manifest against real and synthetic canonical snapshots.

ADD files:
- none (extractor already exists)

MODIFY files:
- none

Tests:
- real snapshot feature extraction smoke
- missing-section behavior
- invalid manifest rejection
- odds-contamination rejection

Network I/O: none
Filesystem I/O: none
DB I/O: none
Training execution: none
Artifact creation: feature vector artifacts only

Stop conditions:
- real V1 manifest produces valid feature vectors for all real smoke examples
- no label or reconstruction data is touched by the extractor

### D3-B3: Historical labelled dataset → real training-matrix builder

Purpose: build `MLBTrainingMatrix` from `MLBHistoricalLabelledDataset` and a real manifest.

ADD files:
- `src/prediction/mlb/mlb-real-training-matrix-builder.ts`
- `tests/prediction/mlb/mlb-real-training-matrix-builder.test.ts`

MODIFY files:
- none

Tests:
- matrix identity determinism
- split preservation
- target encoding correctness
- canonical row ordering
- duplicate/missing example rejection
- odds-contamination rejection

Network I/O: none
Filesystem I/O: none
DB I/O: none
Training execution: none
Artifact creation: matrix artifact only

Stop conditions:
- matrix builder passes on real smoke dataset
- matrix rows match dataset examples in canonical order
- target encoding is exactly HOME_WIN_1_AWAY_WIN_0

### D3-B4: Real bounded matrix materialization + contract smoke

Purpose: materialize a bounded real matrix artifact and validate it end-to-end.

ADD files:
- `scripts/materialize-mlb-real-training-matrix.ts`
- `tests/prediction/mlb/mlb-real-training-matrix-materialization.test.ts`

MODIFY files:
- none

Tests:
- bounded date-range smoke
- contract validation
- matrix identity stability
- repeatability (same input → same output)

Network I/O: none (uses cached/existing labelled dataset)
Filesystem I/O: matrix JSON output
DB I/O: none
Training execution: none
Artifact creation: bounded real matrix JSON

Stop conditions:
- smoke produces valid matrix
- hashes are stable across reruns
- all focused tests pass

### D3-C: Execute existing trainer on real matrix / produce first legitimate candidate artifact

Purpose: execute the existing deterministic L2 logistic regression on the real matrix and produce a validated model artifact.

ADD files:
- none (trainer already exists)

MODIFY files:
- none

Tests:
- trainer produces valid `MLBDeterministicLogisticRegressionModel` from real matrix
- validation evaluation is deterministic
- train/validation metrics are produced
- model identity is deterministic

Network I/O: none
Filesystem I/O: model artifact JSON
DB I/O: none
Training execution: YES — deterministic batch gradient descent on TRAIN split only
Artifact creation: model artifact + validation evaluation

Stop conditions:
- trained artifact validates against `MLBDeterministicLogisticRegressionModel`
- validation metrics are finite and deterministic
- no randomness or network I/O is used

## 21. Explicit non-goals

D3-A does NOT implement:

- real feature extraction (only plans it)
- real matrix materialization (only plans it)
- model fitting (D3-C executes existing trainer; implementation already exists)
- hyperparameter search
- calibration
- model artifact generation
- model release
- live inference
- predicted winners
- multi construction
- staking
- API
- UI
- deployment

D3-A does NOT modify:
- recommendations
- multi construction
- staking
- existing inference contracts
- existing UI
- existing API

Sportsbook/market data remains permanently prohibited.

## 22. Readiness classification

FEATURE MANIFEST CONTRACT = EXISTS

CONCRETE REAL MLB V1 FEATURE MANIFEST INSTANCE = MISSING

EXISTING_FEATURE_MANIFEST_CONTRACT_REUSE = UNCHANGED

PARALLEL_FEATURE_MANIFEST_CONTRACT = NO

PARALLEL_FEATURE_VECTOR_EXTRACTOR = NO

PARALLEL_TRAINING_MATRIX_CONTRACT = NO

PROPOSED_FEATURE_COUNT_BEFORE_CORRECTION = 21

FINAL_V1_MODEL_FEATURE_COUNT = 16

DIRECT_SOURCE_FEATURES = 16

DERIVED_NON_MISSINGNESS_FEATURES = 0

MODEL_VISIBLE_MISSINGNESS_FEATURES = 16 (paired `wasMissing` flags, one per feature)

TEAM_STAT_REPRESENTATION = HOME + AWAY RAW ONLY

INTENTIONAL_LINEAR_REDUNDANCY = NO

HOME_ADVANTAGE_DERIVATION = constant 1 for every row

CONSTANT_HOME_ADVANTAGE_FEATURE = REMOVED

wasMissing STORED AS METADATA = YES (paired in MLBExtractedFeatureValue)

wasMissing CURRENTLY ENTERS NUMERIC MODEL VECTOR = YES (via trainer missingIndicatorCoefficient expansion)

FINAL_MISSINGNESS_ARCHITECTURE = DEFAULT IMPUTATION + EXPLICIT MODEL-VISIBLE MISSINGNESS FLAGS. Each feature carries a paired `wasMissing` flag that the existing trainer expands into a separate `missingIndicatorCoefficient` dimension. No separate featureId is needed.

EXPLICIT_MODEL_VISIBLE_MISSINGNESS_FEATURES = YES

EXTRACTOR_EXTENSION_REQUIRED = NO

EXISTING_CANONICALIZATION_UTILITY = NONE (no existing canonical JSON serialization utility)

EXISTING_HASH_UTILITY = src/lib/backtesting/mlb/live-history/cache.ts buildHistoricalCacheKey uses crypto.createHash('sha256') from node:crypto

MANIFEST_FINGERPRINT_ALGORITHM = SHA-256

MANIFEST_FINGERPRINT_CANONICALIZATION = UTF-8 bytes of explicitly sorted deterministic JSON

FINAL_PROPOSED_MANIFEST_ID = mlb-real-pregame-winner-feature-manifest-v1

MANIFEST_ID_DATASET_DATE_COUPLING = NONE

LOGISTIC_REGRESSION_TRAINER_ITSELF_REQUIRES_CODE_CHANGE = NO

TRAINER_REUSE = UNCHANGED

REAL_DATA_TO_EXISTING_TRAINING_MATRIX_ADAPTER_REQUIRED = YES

SHARED_TRAINING_INFERENCE_EXTRACTOR = extractMLBLeakageSafeFeatureVector in src/prediction/mlb/mlb-feature-vector-contract.ts

LABEL/OUTCOME FIELDS AS FEATURES = NONE

ACTUAL/FINAL STARTER FALLBACK = NONE

ODDS/MARKET FEATURES = NONE

FINITE NUMERIC CONTRACT = YES

CHRONOLOGICAL_OFFICIAL_DATE_V1 = PRESERVED

PARALLEL TRAINING/LIVE FEATURE IMPLEMENTATIONS = NO

NEXT_IMPLEMENTATION_PHASE = D3-B1

PLANNED_SLICES =
D3-B1: Concrete real MLB V1 manifest definition + fingerprint/compatibility support + tests
D3-B2: Canonical snapshot -> real feature vector closure using existing extractor
D3-B3: Real historical labelled dataset -> existing MLBTrainingMatrix adapter/builder closure
D3-B4: Bounded real matrix materialization + contract/determinism smoke
D3-C: Execute existing fitAndEvaluateMLBDeterministicLogisticRegression on validated real training matrix and produce first legitimate candidate model result/artifact boundary
