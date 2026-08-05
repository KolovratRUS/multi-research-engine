# MLB offline multi-recommendation implementation

## 1. Phase status

Phase 8N implementation is complete and pending ChatGPT review, commit, and push.

## 2. Locked baseline

81159ebf53c58b5e19ad6dc593eef3aae81e3679

## 3. Purpose

Phase 8N produces deterministic offline MLB multi recommendations from a validated embedded Phase 8M candidate set without staking, routes, UI, live inference, or odds concepts.

## 4. Architecture position

Phase 8N is downstream of Phase 8M. Its only production input is a validated Phase 8M multi-candidate set. Phase 8N does not rerun Phase 8L or Phase 8M builders.

## 5. Permanent odds-blind boundary

Phase 8N never uses or accepts as selection inputs: sportsbook odds, prices, betting lines, implied probability, market consensus, market movement, expected value, betting value, edge, payout, parlay payout, line shopping, Kelly calculations, odds-derived ranking, odds-derived thresholds, or odds-derived staking.

## 6. Authorized four-file scope

1. `README.md`
2. `docs/mlb-v1-offline-multi-recommendation-implementation.md`
3. `src/prediction/mlb/mlb-offline-multi-recommendation-contract.ts`
4. `tests/prediction/mlb/mlb-offline-multi-recommendation-contract.test.ts`

No shared-firewall change is necessary. No Phase 8L or Phase 8M file is modified.

## 7. Public API and imports

Production imports in order:

1. `../firewall/odds-contamination-guard`
2. `./mlb-offline-multi-candidate-contract`

Public exports in order:

1. `MLB_OFFLINE_MULTI_RECOMMENDATION_SET_CONTRACT_VERSION`
2. `MLB_OFFLINE_MULTI_RECOMMENDATION_SELECTION_POLICY`
3. `MLBOfflineSelectedRecommendation`
4. `MLBOfflineMultiRecommendationSet`
5. `MLBOfflineMultiRecommendationSetIssue`
6. `validateMLBOfflineMultiRecommendationSet`
7. `buildMLBOfflineMultiRecommendationSet`

No order-policy export is added.

## 8. Contract version and selection policy

Contract version:
`mlb-offline-multi-recommendation-set-v1`

Selection policy:
`BEST_CANDIDATE_PER_LEG_COUNT_V1`

## 9. Embedded Phase 8M source boundary

`sourceCandidateSet` is a complete Phase 8M `MLBOfflineMultiCandidateSet`. It is independently validated through `validateMLBOfflineMultiCandidateSet`. The Phase 8N validator never accesses selected recommendation semantics before source validation succeeds.

## 10. Root artifact fields

Exact 11 fields in order:

1. `contractVersion`
2. `sport`
3. `target`
4. `targetEncoding`
5. `multiRecommendationSetId`
6. `candidateSetId`
7. `selectionPolicy`
8. `sourceCandidateSet`
9. `selectedRecommendationCount`
10. `selectedRecommendationIds`
11. `selectedRecommendations`

## 11. Selected recommendation alias

`MLBOfflineSelectedRecommendation` is an exact type alias of `MLBOfflineMultiCandidate`. No wrapper, selection rank, confidence tier, timestamp, stake, payout, or overlap metadata is added.

## 12. Selection algorithm

After source candidate-set validation:

1. scan `sourceCandidateSet.candidates` once in canonical source order;
2. capture the first candidate whose `legCount` is `2`;
3. capture the first candidate whose `legCount` is `3`;
4. retain each captured candidate's original source index;
5. emit the captured candidates in ascending original source index;
6. allocate a new selected recommendation array containing the exact captured source candidate references;
7. allocate a new selected recommendation ID array containing their exact `candidateId` values.

No re-sort, reconstruction, confidence recomputation, joint probability, threshold, abstention, or overlap suppression occurs.

## 13. Builder-reachable empty behavior

A valid Phase 8M source with zero two-leg and zero three-leg candidates produces:

- `selectedRecommendationCount`: `0`
- `selectedRecommendationIds`: `[]`
- `selectedRecommendations`: `[]`

This is valid. It is not an error.

## 14. Validator-only zero-source behavior

The Phase 8M validator accepts a standalone source with zero source recommendation IDs and zero candidates when it independently passes Phase 8M validation. This may be used for direct Phase 8N validator testing but is not reachable through the Phase 8M builder because Phase 8L rejects empty recommendation sets.

## 15. Two-leg selection

The first source candidate with `legCount === 2` is selected when present. Its `candidateId` becomes the selected recommendation identity.

## 16. Three-leg selection

The first source candidate with `legCount === 3` is selected when present. Its `candidateId` becomes the selected recommendation identity.

## 17. Selected identity reuse

Selected recommendation identity is exactly `candidate.candidateId`. No second selected-recommendation identity is created.

## 18. Multi-recommendation-set identity

Multi-recommendation-set identity is exactly:

candidateSetId + `::offline-multi-recommendation-set-v1`

No hash, escaping, replacement, randomness, UUID, current timestamp, or locale comparison is used.

## 19. Source-relative selected ordering

Selection does not re-sort. The selected array preserves the relative order of the matching source candidates.

## 20. Mathematical two-leg dominance

For sorted source selected-side confidences `p1 >= p2 >= p3`:

Best two-leg summary:
- minimum: `p2`
- mean: `(p1 + p2) / 2`

Best three-leg summary:
- minimum: `p3`
- mean: `(p1 + p2 + p3) / 3`

Because `p2 >= p3`, the two-leg candidate cannot rank below the three-leg candidate on minimum confidence. When `p2 = p3`, the two-leg mean is at least the three-leg mean because `p1 >= p2`. When both summaries tie, `p1 = p2 = p3` and Phase 8M's `legCount` ascending tie-break places the two-leg candidate first.

Therefore the selected best two-leg candidate precedes the selected best three-leg candidate under the Phase 8M comparator. No Phase 8N order-policy constant is needed.

## 21. Exact reference preservation

The builder preserves exact references to:

- the validated Phase 8M source candidate set;
- the selected Phase 8M candidates;
- the selected candidate leg arrays;
- the Phase 8L recommendations inside those legs.

It allocates only a new root object, a new selected recommendation ID array, and a new selected recommendation array. It performs no mutation.

## 22. Structural source-candidate equivalence

Public validation accepts structural equivalents. For each selected recommendation, validation locates the matching source candidate by `candidateId`, validates the exact six candidate fields, compares scalar fields exactly, compares leg-array length and order exactly, compares every Phase 8L recommendation field descriptor-safely, rejects unknown fields, symbols, accessors, sparse arrays, and non-plain objects, and avoids rerunning inference or rebuilding candidates.

## 23. Duplicate and overlap ownership

`DUPLICATE_SELECTED_RECOMMENDATION_ID` is emitted at the second repeated selected identity. No duplicate-combination issue is emitted. Valid overlap between distinct selected recommendations (same recommendation, game, team, or side) is valid and deferred to Phase 8O.

## 24. Counts and ID mapping

Selected recommendation count must equal the selected ID array length and the selected recommendation array length. Each selected recommendation's `candidateId` must equal the corresponding selected ID.

## 25. Selection completeness

The expected selected universe is derived from `sourceCandidateSet.candidates` in canonical source order. It must contain exactly the first two-leg candidate (when present) and the first three-leg candidate (when present). Completeness is validated only after selected entries are individually valid and source-resolved.

## 26. Descriptor safety and deterministic issues

The validator is descriptor-safe for root, `sourceCandidateSet`, selected ID array, selected recommendation array, selected recommendation objects, leg arrays, recommendation objects, probability objects, array custom properties, symbols, and accessors. Issues are normalized by stable path/index/code rules without `localeCompare`.

Precedence:

1. descriptor-safe root shape;
2. root accessor/symbol safety;
3. root boundary odds contamination;
4. exact known downstream concepts: stake, grade;
5. exact root field enforcement;
6. embedded source validation;
7. source identity;
8. selected recommendation structure and source membership;
9. selected ID mapping;
10. duplicate selected identity;
11. selected order;
12. set identity;
13. count;
14. completeness;
15. recursive globally unambiguous odds contamination where still applicable.

Noncanonical selected-recommendation order emits `ORDER_MISMATCH`, while a missing or extra policy-required selected recommendation emits `SELECTED_RECOMMENDATION_COMPLETENESS_MISMATCH`.

## 27. Odds-contamination integration

Root ownership:

- sportsbook → `ODDS_CONTAMINATION` at `$`
- odds → `ODDS_CONTAMINATION` at `$`
- price → `ODDS_CONTAMINATION` at `$`
- line → `ODDS_CONTAMINATION` at `$`
- market → `ODDS_CONTAMINATION` at `$`
- edge → `ODDS_CONTAMINATION` at `$`
- value → `ODDS_CONTAMINATION` at `$`
- stake → `PROHIBITED_CONCEPT` at `$.stake`
- grade → `PROHIBITED_CONCEPT` at `$.grade`

Generic route, UI, persistence, or unrelated keys remain `UNKNOWN_FIELD` unless an exact downstream-concept set is deliberately justified. No local odds vocabulary is created.

Phase 8N uses `isProhibitedOddsBoundaryKey` for descriptor-safe root own-property names and `assertNoOddsContamination` for recursively unambiguous odds contamination.

## 28. Non-goals and deferred work

Phase 8N does not:

- calculate joint probability;
- calculate payout or parlay payout;
- calculate stake or use Kelly calculations;
- grade outcomes;
- persist output;
- add routes or UI;
- perform live inference or network access;
- use current-time behavior;
- use randomness.

## 29. Recommended Phase 8O

Phase 8O — Implement deterministic confidence/risk staking guidance from validated multi recommendations without routes or UI.
