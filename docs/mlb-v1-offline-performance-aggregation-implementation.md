# MLB V1 Offline Performance Aggregation Implementation

## 1. Phase status

Phase 8S implementation is complete and verified.

## 2. Locked baseline

`2652684b1cfe46fcee892c55a67a6b2b24f069cf`

## 3. Purpose

Phase 8S deterministically aggregates validated Phase 8R MLB recommendation-bundle grading artifacts into three independent model-performance summaries. This is an offline aggregation contract that consumes caller-supplied upstream grading results and produces a self-contained performance publication.

## 4. Architecture position

The Phase 8S contract sits above the Phase 8R grading contract. It does not rebuild or modify upstream grading artifacts. It owns only aggregation semantics, deterministic identity derivation, and validation of the aggregate result.

## 5. Permanent odds-blind boundary

Phase 8S never accepts, derives, inspects, compares against, or outputs sportsbook odds, prices, lines, market consensus or movement, expected value, value or edge, payout, profit, monetary return, line shopping, closing-line value, Kelly calculations, monetary stakes, bankroll values, ROI, or yield.

Allowed: model-generated probability information may remain embedded inside already-validated Phase 8R source artifacts. Phase 8S does not use those probability values to calculate its performance summaries.

Forbidden: sportsbook odds/prices/lines and market-implied probabilities derived from betting markets, plus market/value/edge/monetary evaluation. Model-generated probability is distinct from market-implied probability.

Phase 8S does not generate new recommendations, predictions, probabilities, confidence values, or risk/staking guidance. It consumes validated Phase 8R grading results and computes only the locked non-monetary performance summaries and deterministic aggregate metadata.

## 6. Authorized four-file scope

1. `README.md`
2. `docs/mlb-v1-offline-performance-aggregation-implementation.md`
3. `src/prediction/mlb/mlb-offline-performance-aggregation-contract.ts`
4. `tests/prediction/mlb/mlb-offline-performance-aggregation-contract.test.ts`

## 7. Public API and imports

The production source exports exactly nine symbols in this order:

1. `MLB_OFFLINE_PERFORMANCE_AGGREGATION_CONTRACT_VERSION`
2. `MLBOfflinePerformanceAggregationInput`
3. `MLBOfflineSinglePickPerformance`
4. `MLBOfflineMultiPerformance`
5. `MLBOfflineMultiLegPerformance`
6. `MLBOfflinePerformanceAggregation`
7. `MLBOfflinePerformanceAggregationIssue`
8. `validateMLBOfflinePerformanceAggregation`
9. `buildMLBOfflinePerformanceAggregation`

It imports from exactly two sources in this order:

1. `../firewall/odds-contamination-guard`
2. `./mlb-offline-recommendation-bundle-grading-contract`

Both imported symbols from the firewall are used in exactly one call expression each within the production module.

## 8. Contract version and literals

Contract version: `mlb-offline-performance-aggregation-v1`

## 9. Caller-supplied grading artifacts

The builder accepts `unknown`. It validates:
- root symbol properties;
- builder-owned root field descriptor safety;
- prohibited odds-boundary keys via `isProhibitedOddsBoundaryKey`;
- explicit prohibited root concepts via `PHASE_8S_PROHIBITED_ROOT_FIELDS`;
- embedded Phase 8R source validation;
- duplicate gradingId detection;
- duplicate recommendationBundleId detection;
- unknown fields.

The builder canonicalizes validated gradings, derives summaries and gradingIds from the canonical source array, derives `aggregationId`, allocates/freeze Phase 8S-owned structures, and self-validates the generated root.

The builder does not receive caller-supplied `gradingCount`, `gradingIds`, performance summaries, or `aggregationId` to validate semantically.

The public validator independently checks:
- embedded Phase 8R source grading validity;
- canonical stored-order validation;
- gradingCount/gradingIds mapping;
- summary recomputation;
- aggregationId validation.

## 10. Canonical dates and timestamps

No `Date` API, `Temporal`, clock, or randomness is used. All identity derivation uses deterministic string encoding.

## 11. Builder input boundary

The builder accepts caller-owned plain-object aggregation inputs with field `gradings: unknown`. The caller supplies every grading reference; the module never derives grading artifacts from a historical dataset, live feed, or external source.

The builder returns no partial output. On any failure it returns `{ ok: false, issues }`.

## 12. Performance summary schema

Each performance summary is a plain object with exactly:
- `totalCount`
- `correctCount`
- `incorrectCount`
- `unresolvedCount`
- `resolvedCount`
- `accuracy`
- `resolutionRate`

## 13. Metric semantics

```text
resolvedCount = correctCount + incorrectCount

accuracy =
  resolvedCount === 0
    ? null
    : correctCount / resolvedCount

resolutionRate =
  totalCount === 0
    ? null
    : resolvedCount / totalCount
```

`UNRESOLVED` is excluded from the accuracy denominator. `UNRESOLVED` is included in `totalCount`. No rounding occurs in the contract layer. `UNRESOLVED` is not a loss.

## 14. Source validation

The builder preserves the exact validated Phase 8R grading references in `sourceGradings`. The public validator checks every embedded grading before aggregation semantics proceed.

## 15. Deterministic aggregate identity

`aggregationId` is derived only from:
- contract version
- canonical grading count
- each canonical gradingId in ascending order

using deterministic length-prefixed components plus:
```text
::offline-performance-aggregation-v1
```

It does NOT depend on:
- caller input order
- summary values
- clock
- randomness
- database state
- object references
- sportsbook data

Caller-order permutations of the same valid corpus produce the same aggregate identity because builder canonicalization happens before ID derivation.

## 16. Root artifact fields

The published root artifact contains exactly:
- `contractVersion`
- `sport`
- `target`
- `targetEncoding`
- `aggregationId`
- `gradingCount`
- `gradingIds`
- `singlePickPerformance`
- `multiPerformance`
- `multiLegPerformance`
- `sourceGradings`

The root and its arrays are newly allocated and frozen. The contained Phase 8R grading references are the exact original caller-owned objects.

## 17. Canonical ordering and uniqueness

Phase 8S canonicalizes validated source gradings by `gradingId` ascending using a deterministic non-locale comparator:

```ts
function compareGradingsById(
  a: MLBOfflineRecommendationBundleGrading,
  b: MLBOfflineRecommendationBundleGrading,
): number {
  return a.gradingId < b.gradingId
    ? -1
    : a.gradingId > b.gradingId
      ? 1
      : 0;
}
```

Equivalent implementation is acceptable.

Forbidden:
- `localeCompare`
- `Intl.Collator`
- environment-dependent locale ordering
- random order
- caller-order tie breaking

Duplicate grading IDs are rejected before canonical aggregation semantics proceed, so equal IDs are not a legitimate two-element corpus.

## 18. Root counts and ID mappings

- `gradingCount` must equal `sourceGradings.length`.
- `gradingIds` must be a dense array of the canonical grading IDs in ascending order.

Count and ID-array ownership are independently validated by the public validator.

## 19. Exact reference preservation

The builder allocates only the Phase 8S root object and its arrays. The contained `sourceGradings` elements are the exact validated caller-owned Phase 8R grading object references, not cloned, not mutated, not newly frozen by Phase 8S. Caller-owned input structures are not mutated.

## 20. Structural-clone validation

The public validator accepts structural clones of the aggregate root and all embedded gradings because it inspects plain-object shape and data descriptors. Reference identity is not required for validation. The builder, however, preserves exact original references in its published output.

## 21. Descriptor safety, issue ownership, and cascade suppression

All array and object inputs are validated for symbol properties, accessor properties, unknown fields, and sparsity before semantic content is read. Issues are deduplicated by `(code, path)` pair.

Cascade suppression rules:
- invalid Phase 8R source grading suppresses all aggregation semantics;
- duplicate gradingId or duplicate recommendationBundleId suppresses aggregationId derivation;
- noncanonical order suppresses deterministic set-ID comparison.

## 22. Empty aggregation publication

Empty aggregation is valid. An empty `gradings` array produces zero-count summaries with `null` accuracy and `null` resolutionRate. The empty corpus follows the same deterministic identity formula as any other corpus:

```text
encodeComponent("mlb-offline-performance-aggregation-v1")
+ encodeComponent("0")
+ "::offline-performance-aggregation-v1"
```

which evaluates exactly to:

```text
38:mlb-offline-performance-aggregation-v11:0::offline-performance-aggregation-v1
```

## 23. Odds contamination, tests, and non-goals

The shared firewall owns root odds contamination via `isProhibitedOddsBoundaryKey` and recursive `assertNoOddsContamination`. Other explicitly prohibited Phase 8S root concepts are classified as `PROHIBITED_CONCEPT` based on own property presence. Ordinary unknown root fields are classified as `UNKNOWN_FIELD`.

Phase 8S contains exactly twenty-two explicit tests. It does not grade individual recommendations, ingest outcomes, generate recommendations, construct multis, persist results, or use sportsbook information.

## 24. Recommended Phase 8T

Phase 8T — Implement deterministic offline historical performance aggregation and reporting for Phase 8S aggregates without routes, UI, persistence, or monetary evaluation.
