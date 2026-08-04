# MLB V1 Offline Prediction Slate Implementation

## 1. Phase status

Phase 8K implementation is complete and pending ChatGPT review, commit, and push.

## 2. Locked baseline

Locked baseline commit: 476cd515ac6c41b493f52f309526e3719f668c9c

## 3. Purpose

Phase 8K constructs deterministic offline daily MLB prediction slates from complete validated Phase 8J per-game inference outputs. It packages already-validated inferences into a homogeneous, canonically ordered slate without rerunning inference, reading snapshots, extracting features, or calculating probabilities.

## 4. Architecture position

Phase 8K sits immediately downstream of Phase 8J. It consumes only validated `MLBOfflinePregameInference` objects and produces a single `MLBOfflinePredictionSlate`. No downstream consumer is added in Phase 8K.

## 5. Permanent odds-blind boundary

The system must remain permanently odds-blind.

Prohibited inputs and concepts include:

- sportsbook odds;
- sportsbook prices;
- betting lines;
- implied probability derived from odds;
- market consensus;
- market movement;
- line shopping;
- value or edge calculations;
- expected payout;
- payout optimization;
- odds-derived confidence;
- odds-derived selection;
- sportsbook availability.

Allowed outputs remain model-derived and odds-independent:

- model probabilities;
- predicted winners;
- model confidence;
- uncertainty;
- future recommendation construction;
- future multi construction;
- future confidence/risk staking;
- grading and performance tracking.

## 6. Authorized scope

Exactly these four files are authorized:

1. README.md
2. docs/mlb-v1-offline-prediction-slate-implementation.md
3. src/prediction/mlb/mlb-offline-prediction-slate-contract.ts
4. tests/prediction/mlb/mlb-offline-prediction-slate-contract.test.ts

## 7. Public API and imports

The production source exports exactly these seven declarations, in this order:

1. `MLB_OFFLINE_PREDICTION_SLATE_CONTRACT_VERSION`
2. `MLB_OFFLINE_PREDICTION_SLATE_ORDER_POLICY`
3. `MLBOfflinePredictionSlateEntry`
4. `MLBOfflinePredictionSlate`
5. `MLBOfflinePredictionSlateIssue`
6. `validateMLBOfflinePredictionSlate`
7. `buildMLBOfflinePredictionSlate`

Its import sources are exactly these two, in this order:

1. `../firewall/odds-contamination-guard`
2. `./mlb-offline-pregame-inference-contract`

No private helper is exported. No enum is exported. No interface is exported.

## 8. Contract version

Constant:

```text
mlb-offline-prediction-slate-v1
```

## 9. Slate identity

The exact slate ID formula is:

```text
releaseId + "::" + officialDate + "::" + mlb-offline-prediction-slate-v1
```

Example:

```text
model-1::offline-release-candidate-v1::2026-08-01::mlb-offline-prediction-slate-v1
```

The builder must not use `Date.now`, `new Date`, `Math.random`, `randomUUID`, process time, filesystem timestamps, or environment variables.

## 10. Input array boundary

The builder accepts one `unknown` input representing an array of proposed Phase 8J inferences. It must reject non-array input, empty arrays, sparse arrays, array symbols, extra named array properties, and accessor array indices. Input array inspection is descriptor-safe. An index getter is never invoked.

## 11. Nested inference validation

Every prediction in the slate is validated through the locked Phase 8J validator `validateMLBOfflinePregameInference`. A nested invalid inference maps to exactly one `INFERENCE_INVALID` issue at the failing path. The builder stops at the first invalid inference and never inspects a later inference object.

## 12. Validation order

The exact builder order is:

1. validate the outer input array shape;
2. validate inference at index 0 through the locked Phase 8J validator;
3. stop immediately if index 0 is invalid;
4. validate subsequent inferences in ascending input-index order;
5. stop at the first invalid inference;
6. enforce reachable source-lineage homogeneity:
   releaseId, modelId, planId, matrixId, configId, manifestId;
7. enforce official-date homogeneity;
8. enforce duplicate inference IDs;
9. enforce duplicate game IDs;
10. copy and canonically sort the validated inference references;
11. construct the slate;
12. validate the generated slate;
13. apply the odds-contamination firewall to the generated slate;
14. return no partial slate on failure.

The public proposed-slate validator must:

- validate every nested inference first;
- enforce reachable lineage;
- enforce date;
- enforce duplicate inference IDs;
- enforce duplicate game IDs;
- enforce canonical order;
- enforce slate ID;
- enforce prediction count;
- enforce firewall.

## 13. Source-lineage homogeneity

Every prediction in one slate must have exactly the same `releaseId`, `modelId`, `planId`, `matrixId`, `configId`, and `manifestId`. A mismatch maps to `SOURCE_IDENTITY_MISMATCH`.

Reachable source-lineage issues use exact second-entry field paths:
- builder: `$.inferences[1].releaseId`, `$.inferences[1].modelId`, `$.inferences[1].planId`, `$.inferences[1].matrixId`, `$.inferences[1].configId`, `$.inferences[1].manifestId`
- proposed-slate validator: `$.predictions[1].releaseId`, `$.predictions[1].modelId`, `$.predictions[1].planId`, `$.predictions[1].matrixId`, `$.predictions[1].configId`, `$.predictions[1].manifestId`

`algorithm`, `decisionPolicy`, `sport`, `target`, and `targetEncoding` are fixed Phase 8J literals. A corrupted fixed literal fails the nested Phase 8J validator and maps to `INFERENCE_INVALID`. Phase 8K does not claim a separately reachable mismatch branch for those fixed literals.

Ownership:
- Phase 8J deterministically derives each `inferenceId` from `releaseId` and `snapshotId`.
- Every entry in one Phase 8K slate shares the same `releaseId`.
- Therefore, a repeated `snapshotId` necessarily repeats `inferenceId`.
- Repeated snapshot identity is rejected transitively as `DUPLICATE_INFERENCE_ID`.
- Phase 8K does not emit `DUPLICATE_SNAPSHOT_ID`.
- Phase 8J owns the fixed `algorithm`, `decisionPolicy`, `sport`, `target`, and `targetEncoding` literals.
- Corruption of a fixed Phase 8J literal maps to `INFERENCE_INVALID`.
- Phase 8K owns reachable homogeneity for `releaseId`, `modelId`, `planId`, `matrixId`, `configId`, and `manifestId`.
- Duplicate game IDs are rejected separately.
- Doubleheaders remain representable through distinct game IDs.
- Per-game `dataCutoffAt` values are preserved and may differ.

## 14. Official-date homogeneity

Every prediction in one slate must have the same `officialDate`. A mismatch maps to `OFFICIAL_DATE_MISMATCH`.

## 15. Per-game cutoff preservation

Per-game `dataCutoffAt` values are preserved exactly and need not be equal. No slate-level cutoff is synthesized.

## 16. Canonical ordering

Canonical prediction order is:

1. `gameId` ascending by deterministic JavaScript code-unit comparison;
2. when game IDs are equal, `snapshotId` ascending;
3. when both are equal, `inferenceId` ascending.

Explicit `<` and `>` comparisons are used. `localeCompare`, `Intl.Collator`, platform locale, filesystem order, and input order are never used as canonical order. The public slate validator rejects a proposed slate whose `predictions` array is not already in canonical order with `ORDER_MISMATCH`.

## 17. Duplicate inference protection

One slate must not contain duplicate `inferenceId` values. A duplicate maps to `DUPLICATE_INFERENCE_ID` and reports the second conflicting occurrence.

## 18. Duplicate snapshot protection

Within one valid Phase 8K slate, every inference shares the same `releaseId`. Because Phase 8J deterministically derives `inferenceId` from `releaseId` and `snapshotId`, a repeated `snapshotId` necessarily repeats `inferenceId`. Repeated snapshot identity is therefore rejected transitively as `DUPLICATE_INFERENCE_ID`. Phase 8K does not emit `DUPLICATE_SNAPSHOT_ID`.

## 19. Duplicate game protection

One slate must not contain duplicate `gameId` values. A duplicate maps to `DUPLICATE_GAME_ID` and reports the second conflicting occurrence. Doubleheaders remain representable through distinct game IDs.

## 20. Prediction-count contract

`predictionCount` must be a finite safe integer, non-negative, not negative zero, and exactly equal to `predictions.length`. A valid slate must contain at least one prediction. `EMPTY_SLATE` rejects zero predictions. `PREDICTION_COUNT_MISMATCH` rejects count/length divergence. Malformed numbers use the standard invalid-number behavior.

## 21. Exact field enforcement

`MLBOfflinePredictionSlate` contains exactly these fields in this order:

1. `contractVersion`
2. `sport`
3. `target`
4. `targetEncoding`
5. `slateId`
6. `releaseId`
7. `modelId`
8. `planId`
9. `matrixId`
10. `configId`
11. `manifestId`
12. `officialDate`
13. `orderPolicy`
14. `predictionCount`
15. `predictions`

Required literals:

- `sport`: `MLB`
- `target`: `OFFICIAL_FINAL_GAME_WINNER`
- `targetEncoding`: `HOME_WIN_1_AWAY_WIN_0`
- `contractVersion`: `mlb-offline-prediction-slate-v1`
- `orderPolicy`: `GAME_ID_ASC_SNAPSHOT_ID_ASC_INFERENCE_ID_ASC_V1`

## 22. Descriptor safety

Never access a proposed root or proposed predictions-array property before confirming it is an own data property. Own-property descriptors are used. Root getters, root setters, predictions getters, array-index getters, and nested inference getters are never invoked. A proposed accessor returns an invalid issue without executing its function body. The nested Phase 8J validator owns descriptor-safe validation of each inference. `JSON.stringify` is not used as validation.

## 23. Determinism

For the same set of valid inference objects, every input permutation produces deeply equal slate output. No deterministic output depends on input order after canonical sorting.

## 24. No mutation and reference preservation

The builder creates a new slate root and a new predictions array. It preserves the exact validated Phase 8J inference object references. No Phase 8J inference is cloned, normalized, rewritten, or mutated. The input array is not mutated. Each inference's probabilities, predicted side, predicted team, cutoff, identity, and timestamp strings are unchanged.

## 25. Odds-contamination integration

The existing locked firewall is used. Its prohibited-term inventory is not copied or reimplemented. The firewall is applied to both proposed slate validation and generated slate validation. Recognized odds contamination maps to `ODDS_CONTAMINATION`. Prohibited downstream concepts such as recommendations, multis, stakes, or grading map to `PROHIBITED_CONCEPT`. The public slate remains model-derived and odds-independent.

## 26. Prohibited concepts

Phase 8K must not:

- call live inference;
- rerun Phase 8J inference;
- read a snapshot;
- extract features;
- read a model coefficient;
- calculate a probability;
- change a probability;
- rank by sportsbook value;
- rank by edge;
- rank by expected payout;
- generate recommendations;
- construct multis;
- calculate stakes;
- grade predictions;
- persist a slate;
- register a slate;
- add an API;
- add a route;
- add UI;
- use Prisma;
- use network calls;
- use environment variables;
- use current time;
- use randomness.

## 27. Exact test coverage

Exactly 20 Phase 8K tests cover the boundary:

1. accepts a minimal valid prediction slate and returns the exact original reference
2. validates exact slate fields, literals, lineage, count, order policy, date, and deterministic slate ID
3. validates every nested Phase 8J inference and maps an invalid prediction to its exact index path
4. stops at the first invalid inference without touching a later inference object
5. validates descriptor-safe slate roots, prediction arrays, symbols, classes, and accessors without invoking getters
6. rejects non-array, empty, sparse, accessor-bearing, symbol-bearing, and extra-property builder inputs deterministically
7. builds a valid one-game slate from one validated Phase 8J inference
8. builds a canonically ordered multi-game slate from permuted valid inference inputs
9. produces deeply deterministic output across input permutations without mutating any input
10. rejects reachable release, model, plan, matrix, config, and manifest lineage mismatches and maps fixed-literal corruption to INFERENCE_INVALID
11. rejects mixed official dates while preserving distinct per-game data cutoffs
12. rejects duplicate inference IDs at the second conflicting entry
13. proves duplicate snapshot identity collapses to the locked duplicate inference identity
14. rejects duplicate game IDs at the second conflicting entry
15. validates canonical proposed-slate order and rejects non-canonical prediction order
16. preserves exact prediction object references and all per-game Phase 8J lineage
17. rejects odds contamination, market concepts, recommendations, multis, stakes, grading, and prohibited fields
18. proves successful output contains no raw features, missing flags, coefficients, scores, metrics, labels, rows, odds, recommendations, multis, stakes, or grades
19. verifies deterministic issue ordering, deduplication, exact fields, count mismatch, slate-ID mismatch, and negative-zero rejection
20. verifies exact exports and imports, no live inference, no fitting, no persistence, no routes, no UI, and the static architecture boundary

## 28. Deferred work

Future phases may consume prediction slates to construct recommendations, multis, stakes, grading, or UI. None of that is implemented in Phase 8K.

## 29. Non-goals

Phase 8K does not:

- persist or register slates;
- add API routes;
- add user interface;
- generate betting recommendations;
- construct multis or parlays;
- calculate stakes;
- grade predictions;
- read live data.

## 30. Phase limitations

Phase 8K is scoped to deterministic offline MLB prediction-slate construction. It is not a general-purpose prediction packaging system. It does not support multiple sports, multiple targets, or multi-day slate merging in this version.

## 31. Recommended next phase

Phase 8L — Implement deterministic offline MLB single-pick recommendation construction from validated prediction slates without multis, staking, routes, or UI.
