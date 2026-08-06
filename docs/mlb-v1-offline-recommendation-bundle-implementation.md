# MLB v1 Offline Recommendation Bundle Implementation

## 1. Phase status

Phase 8P implementation is complete and pending ChatGPT review, commit, and push.

## 2. Locked baseline

`c74c96e246f0a87b19cd0d500ea9f22c19e72331`

## 3. Purpose

Phase 8P composes validated offline MLB recommendation artifacts into one deterministic, explicitly timestamped, self-contained recommendation bundle.

## 4. Architecture position

Phase 8P consumes the validated Phase 8L single-pick recommendation set, Phase 8N multi-recommendation set, and Phase 8O multi-risk-guidance set. It does not rebuild any upstream artifact.

## 5. Permanent odds-blind boundary

The entire Multi Research Engine remains permanently odds-blind. Phase 8P never accepts, derives, inspects as recommendation evidence, ranks by, compares against, or outputs sportsbook odds, prices, lines, implied probability, market consensus, movement, expected value, betting value, edge, payout, profit, return, line shopping, Kelly calculations, or odds-derived metrics.

## 6. Authorized four-file scope

1. `README.md`
2. `docs/mlb-v1-offline-recommendation-bundle-implementation.md`
3. `src/prediction/mlb/mlb-offline-recommendation-bundle-contract.ts`
4. `tests/prediction/mlb/mlb-offline-recommendation-bundle-contract.test.ts`

## 7. Public API and imports

The production source exports exactly seven symbols in this order:

1. `MLB_OFFLINE_RECOMMENDATION_BUNDLE_CONTRACT_VERSION`
2. `MLB_OFFLINE_RECOMMENDATION_BUNDLE_COMPOSITION_POLICY`
3. `MLBOfflineRecommendationBundleInput`
4. `MLBOfflineRecommendationBundle`
5. `MLBOfflineRecommendationBundleIssue`
6. `validateMLBOfflineRecommendationBundle`
7. `buildMLBOfflineRecommendationBundle`

It imports from exactly four sources in this order:

1. `../firewall/odds-contamination-guard`
2. `./mlb-offline-single-pick-recommendation-contract`
3. `./mlb-offline-multi-recommendation-contract`
4. `./mlb-offline-multi-risk-guidance-contract`

Phase 8M is never imported directly.

## 8. Contract version and composition policy

Contract version: `mlb-offline-recommendation-bundle-v1`
Composition policy: `ALL_VALIDATED_ARTIFACTS_V1`

## 9. Explicit caller-owned timestamp

The timestamp field is `recommendedAt`. It is supplied explicitly by the caller. The builder never reads the current clock.

## 10. Canonical timestamp grammar

Accepted format: `YYYY-MM-DDTHH:mm:ss.sssZ`
Impossible dates are rejected deterministically. No normalization is performed.

## 11. Root artifact fields

The root contains exactly thirteen fields in this order:

1. `contractVersion`
2. `sport`
3. `target`
4. `targetEncoding`
5. `compositionPolicy`
6. `recommendationBundleId`
7. `recommendedAt`
8. `singlePickRecommendationSetId`
9. `multiRecommendationSetId`
10. `riskGuidanceSetId`
11. `sourceSinglePickRecommendationSet`
12. `sourceMultiRecommendationSet`
13. `sourceMultiRiskGuidanceSet`

## 12. Builder input boundary

The builder input shape is:

```ts
{
  singlePickRecommendationSet: unknown;
  multiRecommendationSet: unknown;
  multiRiskGuidanceSet: unknown;
  recommendedAt: unknown;
}
```

## 13. Embedded Phase 8L source

The builder preserves the exact validated Phase 8L reference in `sourceSinglePickRecommendationSet`. The public validator checks the embedded Phase 8L before bundle semantics.

## 14. Embedded Phase 8N source

The builder preserves the exact validated Phase 8N reference in `sourceMultiRecommendationSet`. The public validator checks the embedded Phase 8N before bundle semantics.

## 15. Embedded Phase 8O source

The builder preserves the exact validated Phase 8O reference in `sourceMultiRiskGuidanceSet`. The public validator checks the embedded Phase 8O before bundle semantics.

## 16. Cross-artifact lineage policy

The builder verifies exact lineage relationships between the three embedded sources without recomputing upstream results.

Probability comparison is field-based: `homeWinProbability` and `awayWinProbability`. Probability object references are not compared. Phase 8L-to-Phase 8M lineage remains explicit. Phase 8N-to-embedded-Phase 8N equivalence remains structural. The builder does not recompute Phase 8O guidance. The public validator never compares probability object references.

## 17. Deterministic bundle identity

Formula:
`${singlePickRecommendationSetId}::${multiRecommendationSetId}::${riskGuidanceSetId}::${recommendedAt}::offline-recommendation-bundle-v1`

## 18. Exact reference preservation

The builder allocates only the Phase 8P root object. All three embedded source references are preserved exactly. The builder returns the exact reference to each validated upstream artifact.

## 19. Structural-clone validation

The public validator accepts structural clones of the bundle and all embedded sources.

## 20. Descriptor safety and deterministic issues

The validator accepts `unknown`. It handles symbols, accessors, classes, proxies, unknown fields, and sparse arrays without invoking getters on invalid inputs. Issues are appended in discovery order.

## 21. Odds-contamination and prohibited concepts

The shared firewall owns root odds contamination via `isProhibitedOddsBoundaryKey` and recursive `assertNoOddsContamination`. Root `stake` and `grade` are `PROHIBITED_CONCEPT`. Unsupported non-firewall-owned root fields are `UNKNOWN_FIELD`.

Issue paths include `$.singlePickRecommendationSet`, `$.multiRecommendationSet`, `$.sourceSinglePickRecommendationSet`, and `$.sourceMultiRecommendationSet`.

## 22. Test inventory

Phase 8P contains exactly twenty explicit tests:

1. accepts a minimal valid recommendation bundle and returns the exact original reference
2. validates exact thirteen-field root shape, literals, composition policy, canonical timestamp, source mappings, and deterministic bundle identity
3. validates the embedded Phase 8L single-pick recommendation set before bundle semantics
4. validates the embedded Phase 8N multi-recommendation set before bundle semantics
5. validates the embedded Phase 8O multi-risk-guidance set before bundle semantics
6. validates descriptor-safe public roots, builder inputs, embedded sources, symbols, classes, and accessors without invoking getters
7. maps an invalid Phase 8L builder source to one SOURCE_SINGLE_PICK_RECOMMENDATION_SET_INVALID issue without partial output or pre-validation access
8. maps an invalid Phase 8N builder source to one SOURCE_MULTI_RECOMMENDATION_SET_INVALID issue without partial output or pre-validation access
9. maps an invalid Phase 8O builder source to one SOURCE_MULTI_RISK_GUIDANCE_SET_INVALID issue without partial output or pre-validation access
10. validates exact canonical UTC recommendedAt format and rejects noncanonical alternatives
11. rejects impossible Gregorian timestamps, invalid clock values, and leap seconds
12. derives deterministic bundle identity from all three canonical source identities and recommendedAt
13. validates fixed literals and root source-identity mappings with separate exact ownership
14. validates Phase 8L recommendation lineage against embedded Phase 8M source metadata, IDs, probabilities, and legs
15. validates explicit Phase 8N equivalence with the Phase 8O embedded source without recomputing guidance
16. builds deterministic bundles for empty, one-selected, and two-selected recommendation universes
17. preserves exact upstream references, allocates only the Phase 8P root, repeats deterministically, and performs no mutation
18. accepts structural clones for the bundle and all three embedded sources
19. rejects odds contamination and prohibited concepts while classifying unsupported fields as unknown and allowing embedded risk-unit vocabulary
20. verifies deterministic issue ordering, exact exports and imports, no upstream rebuilding, no money, no routes, no UI, no persistence, no grading, no current time, no randomness, and no network access

## 23. Non-goals and deferred work

Phase 8P does not run inference, rebuild upstream artifacts, grade results, aggregate performance, execute recommendations, or use sportsbook information.

## 24. Recommended Phase 8Q

Phase 8Q — Implement deterministic offline grading of timestamped MLB recommendation bundles against validated official final-game outcomes without routes, UI, persistence, or performance aggregation.
