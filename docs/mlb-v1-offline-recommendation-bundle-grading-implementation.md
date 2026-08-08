# MLB V1 Offline Recommendation Bundle Grading Implementation

## 1. Phase status

Phase 8R implementation is complete and pending ChatGPT review, commit, and push.

## 2. Locked baseline

`a7c99160681ebc1f51b57d6eea702dd16e462ab8`

## 3. Purpose

Phase 8R deterministically grades timestamped Phase 8P MLB recommendation bundles against validated Phase 8Q official-final-game outcome sets. This is an offline grading contract that consumes caller-supplied upstream artifacts and produces a self-contained grading result.

## 4. Architecture position

The Phase 8R contract sits above the Phase 8P bundle and Phase 8Q outcome-set contracts. It does not rebuild or modify either upstream artifact. It owns only grading semantics, deterministic identity derivation, and validation of the grading result.

## 5. Permanent odds-blind boundary

Phase 8R never accepts, derives, inspects, compares against, or outputs sportsbook odds, prices, lines, implied probability, market consensus or movement, expected value, value or edge, payout, profit, monetary return, line shopping, closing-line value, Kelly calculations, monetary stakes, bankroll values, ROI, or yield.

Phase 8R contains no recommendation, prediction, probability, confidence, uncertainty, risk unit, grade, correctness result, performance aggregate, or monetary metric beyond the locked grading contract.

## 6. Authorized four-file scope

1. `README.md`
2. `docs/mlb-v1-offline-recommendation-bundle-grading-implementation.md`
3. `src/prediction/mlb/mlb-offline-recommendation-bundle-grading-contract.ts`
4. `tests/prediction/mlb/mlb-offline-recommendation-bundle-grading-contract.test.ts`

## 7. Public API and imports

The production source exports exactly nine symbols in this order:

1. `MLB_OFFLINE_RECOMMENDATION_BUNDLE_GRADING_CONTRACT_VERSION`
2. `MLBOfflineRecommendationBundleGradingInput`
3. `MLBOfflineSinglePickGrade`
4. `MLBOfflineMultiLegGrade`
5. `MLBOfflineMultiGrade`
6. `MLBOfflineRecommendationBundleGrading`
7. `MLBOfflineRecommendationBundleGradingIssue`
8. `validateMLBOfflineRecommendationBundleGrading`
9. `buildMLBOfflineRecommendationBundleGrading`

It imports from exactly three sources in this order:

1. `../firewall/odds-contamination-guard`
2. `./mlb-offline-recommendation-bundle-contract`
3. `./mlb-offline-official-final-game-outcome-set-contract`

Both imported symbols from the firewall are used in exactly one call expression each within the production module.

## 8. Contract version and literals

Contract version: `mlb-offline-recommendation-bundle-grading-v1`

## 9. Caller-supplied upstream artifacts

The builder and validator accept caller-owned plain-object grading inputs that embed validated Phase 8P and Phase 8Q artifacts. The caller supplies every upstream artifact reference; the module never derives upstream artifacts from a historical dataset, live feed, or external source.

## 10. Canonical dates and timestamps

- `recommendedAt` and `dataCutoffAt` must be canonical UTC timestamps in `YYYY-MM-DDTHH:mm:ss.sssZ` format.
- No `Date` API, `Temporal`, clock, or randomness is used.

## 11. Builder input boundary

The builder accepts `unknown`. It validates:
- root symbol properties;
- builder-owned root field descriptor safety;
- prohibited odds-boundary keys via `isProhibitedOddsBoundaryKey`;
- explicit prohibited root concepts via `PROHIBITED_ROOT_FIELDS`;
- embedded Phase 8P source validation;
- embedded Phase 8Q source validation;
- single-pick mapping, result, and identity checks;
- leg and multi mapping, result, and identity checks;
- root grading identity;
- unknown fields.

The builder returns no partial output. On any failure it returns `{ ok: false, issues }`.

## 12. Grade-entry schema

Single-pick grades are plain objects with exactly:
- `singlePickId`
- `singlePickRecommendationSetId`
- `recommendedTeamId`
- `outcomeId`
- `result`
- `eligibility`

Multi grades contain ordered leg grades and a result derived from leg outcomes.

## 13. Single-pick grading semantics

For matched official outcomes:
- `recommendedTeamId === winnerTeamId` => `CORRECT`
- `recommendedTeamId !== winnerTeamId` => `INCORRECT`

For missing official outcomes:
- `result = UNRESOLVED`
- `eligibility = UNVERIFIED_MISSING_OUTCOME`
- `outcomeId = null`
- `winnerTeamId = null`

No start-time eligibility assertion is made when no official outcome exists.

## 14. Upstream source validation

The builder preserves the exact validated Phase 8P reference in `sourceRecommendationBundle` and the exact validated Phase 8Q reference in `sourceOutcomeSet`. The public validator checks both embedded sources before grading semantics.

## 15. Timestamp chronology

Strict prestart eligibility requires:
- `dataCutoffAt < scheduledStartAt`
- `recommendedAt < scheduledStartAt`

Equality is invalid. At/after start for a matched outcome produces `INVALID_TIMESTAMP_ELIGIBILITY`.

## 16. Deterministic grading IDs

Single-pick grade IDs bind:
- `singlePickId`
- `singlePickRecommendationSetId`
- `recommendedTeamId`
- `outcomeId`
- `result`
- `eligibility`

Leg grade IDs bind leg-order position and candidate identity. Multi grade IDs bind multi identity and leg grade IDs. Root grading ID binds:
- `recommendationBundleId`
- `outcomeSetId`
- `singlePickGradeIds` in stored order
- `multiGradeIds` in stored order

Each component is encoded as `<length>:<value>` and concatenated with the appropriate suffix. Null sentinels use explicit length-prefixed null encoding. No `localeCompare`, JSON serialization, or `Date` API is used.

## 17. Root artifact fields

The published root artifact contains exactly:
- `contractVersion`
- `sport`
- `target`
- `gradingId`
- `recommendationBundleId`
- `outcomeSetId`
- `recommendedAt`
- `dataCutoffAt`
- `singlePickGrades`
- `multiGrades`
- `sourceRecommendationBundle`
- `sourceOutcomeSet`

The root and its arrays are newly allocated and frozen. The contained upstream source references are the exact original caller-owned objects.

## 18. Canonical ordering and uniqueness

Phase 8R preserves validated Phase 8P ordering:
- single grades: single recommendation source order
- multi grades: selected multi source order
- leg grades: source/candidate leg order

No independent sorting. No `localeCompare`.

## 19. Root counts and ID mappings

- `singlePickGradeCount` must equal `singlePickGrades.length` against the deterministic source recommendation count.
- `multiGradeCount` must equal `multiGrades.length`.
- `singlePickGradeIds` must be a dense array of the canonical single-pick grade IDs in stored order.
- `multiGradeIds` must be a dense array of the canonical multi grade IDs in stored order.

Count and ID-array ownership are independently validated.

## 20. Root grading identity

The deterministic root grading identity is computed from the stored grade ID arrays, the bundle ID, the outcome-set ID, `recommendedAt`, and `dataCutoffAt`. The builder derives it through the same deterministic length-prefixed scheme used for embedded grade identities.

## 21. Missing outcome semantics

When an official outcome is missing for a matched prediction, the single-pick grade resolves to `UNRESOLVED` with `eligibility = UNVERIFIED_MISSING_OUTCOME` and null outcome/winner fields. No start-time eligibility assertion is made in the absence of an official outcome.

## 22. Exact reference preservation

The builder allocates only the Phase 8R root object and its grade arrays. Both embedded upstream source references are preserved exactly. The builder returns the exact reference to each validated upstream artifact. Caller-owned upstream structures are not mutated or newly frozen by Phase 8R.

## 23. Structural-clone validation

The public validator accepts structural clones of the grading root and all embedded sources because it inspects plain-object shape and data descriptors. Reference identity is not required for validation. The builder, however, preserves exact original references in its published output.

## 24. Descriptor safety, issue ownership, and cascade suppression

All array and object inputs are validated for symbol properties, accessor properties, unknown fields, and sparsity before semantic content is read. Issues are deduplicated by `(code, path)` pair. Issue paths always identify the first invalid occurrence.

Cascade suppression rules:
- invalid upstream source suppresses all grading semantics;
- invalid timestamp eligibility suppresses single-pick result;
- identical-team rejection suppresses winner-membership and score comparison;
- winner-outside-team suppression suppresses score/winner comparison;
- tied-score suppression suppresses winner/score comparison;
- noncanonical order suppresses deterministic set-ID comparison.

## 25. Odds contamination, tests, and non-goals

The shared firewall owns root odds contamination via `isProhibitedOddsBoundaryKey` and recursive `assertNoOddsContamination`. Other explicitly prohibited Phase 8R root concepts are classified as `PROHIBITED_CONCEPT` based on own property presence. Ordinary unknown root fields are classified as `UNKNOWN_FIELD`.

Phase 8R contains exactly twenty explicit tests. It does not aggregate performance, compute historical rollups, execute recommendations, or use sportsbook information.

## 26. Recommended Phase 8S

Phase 8S — Implement deterministic offline performance reporting and aggregation for graded MLB recommendation bundles without routes, UI, persistence, or monetary evaluation.
