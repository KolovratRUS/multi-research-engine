# MLB V1 Offline Performance Aggregation Plan

## Status

- Phase: 8S-A3
- Scope: planning-only
- Implementation: none
- Runtime behavior: unchanged
- Deterministic offline performance aggregation plan for validated Phase 8R recommendation-bundle grading artifacts
- No routes
- No UI
- No persistence
- No network access
- No clock access
- No randomness
- No monetary evaluation
- No odds ingestion
- No sportsbook data

## 1. Phase purpose

Phase 8S will introduce deterministic OFFLINE performance aggregation over validated Phase 8R recommendation-bundle grading artifacts.

Phase 8S exists to answer questions such as:

- How many recommendations were graded?
- How many were correct?
- How many were incorrect?
- How many remain unresolved?
- How many are resolved?
- What is the model's resolved accuracy?
- How have selected multis performed?
- How have individual multi legs performed?

This is MODEL PERFORMANCE measurement. It is NOT sportsbook/value/ROI analysis.

The permanent project boundary remains:

- NO betting odds
- NO sportsbook prices
- NO implied probabilities derived from markets
- NO market comparisons
- NO line shopping
- NO value/edge calculations
- NO expected monetary value
- NO ROI
- NO profit
- NO payout evaluation
- NO monetary staking calculations

## 2. Upstream dependency on Phase 8R

Phase 8S consumes caller-supplied validated Phase 8R grading artifacts. It does not rebuild grading. It does not consume Phase 8P bundles directly as its authoritative performance input. It does not consume Phase 8Q outcomes directly as its authoritative performance input. It aggregates the already-determined Phase 8R results.

## 3. Odds-blind boundary

Phase 8S is permanently odds-blind.

Allowed:

- source recommendation references/artifacts inherited from Phase 8P and embedded in Phase 8R gradings
- model-generated upstream prediction information where embedded upstream
- single-pick grading results
- leg grading results
- multi grading results
- CORRECT / INCORRECT / UNRESOLVED results
- grading eligibility values
- deterministic grading identities
- counts derived from grading results
- resolved counts derived from grading results
- accuracy rates derived solely from model grading
- resolution rates derived solely from grading coverage

Forbidden:

- sportsbook odds
- sportsbook prices
- betting lines
- implied probability derived from markets
- market consensus or movement
- value or edge evaluation
- expected monetary value
- ROI
- profit
- payout evaluation
- bankroll evaluation
- monetary stake calculation
- performance aggregation that implies monetary performance

Do not confuse model-generated probabilities with sportsbook implied probability.

## 4. Authorized one-file scope

The Phase 8S-A3 planning pass may create or modify only:

1. `docs/mlb-v1-offline-performance-aggregation-plan.md`

No implementation files. No test files. No README change. No package/tsconfig change.

## 5. Self-validating aggregate root

The aggregate root MUST embed `sourceGradings` with conceptual type:

```ts
readonly MLBOfflineRecommendationBundleGrading[]
```

The public validator must independently validate every embedded grading using `validateMLBOfflineRecommendationBundleGrading`.

The builder input remains conceptually:

```ts
Readonly<{
  gradings: unknown;
}>
```

The builder validates caller-supplied gradings, derives the aggregate, embeds the validated grading references, validates the generated root, and returns it.

Role correction:
- public validator success returns the exact proposed aggregate root reference
- builder returns its newly generated aggregate root

## 6. Source-reference and ownership semantics

Phase 8S builder behavior:

- `sourceGradings` array: newly allocated by Phase 8S, canonically ordered by `gradingId` ascending, frozen by Phase 8S
- `sourceGradings` elements: exact validated caller Phase 8R grading object references, not cloned, not mutated, not newly frozen by Phase 8S

Other Phase 8S-owned structures:
- `gradingIds` array
- `singlePickPerformance`
- `multiPerformance`
- `multiLegPerformance`
- root aggregate

must be newly allocated and frozen.

Public validator:
- accepts structurally equivalent clones
- does not require builder object identity
- returns exact proposed aggregate root reference on success

Embedding validated Phase 8R gradings makes the aggregate independently auditable and self-validating.

## 7. Builder canonicalization semantics

Builder behavior:
1. validate all supplied Phase 8R gradings;
2. reject duplicate grading IDs;
3. reject duplicate recommendation-bundle IDs;
4. allocate a NEW array;
5. sort that new array by `gradingId` ascending with a non-locale comparator;
6. preserve the exact grading object references as elements;
7. derive `gradingIds` from that canonical source array;
8. derive summaries from that canonical source array;
9. derive `aggregationId` from canonical grading IDs;
10. allocate/freeze Phase 8S-owned structures;
11. self-validate the generated aggregate.

Never sort the caller's array in place. Never use `localeCompare`.

## 8. Canonical ordering

Phase 8S canonicalizes validated source gradings by `gradingId` ascending using a deterministic non-locale comparator:

```ts
function compareGradingIds(
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

## 9. Public validator canonical-order ownership

A2 defines canonical ordering for generated artifacts, but the public validator also needs an explicit rule.

The public validator must NOT normalize or silently reorder a proposed aggregate. It validates the artifact AS PROPOSED.

After all `sourceGradings` independently pass Phase 8R validation and duplicate checks:
1. independently compute the canonical gradingId-ascending sequence;
2. verify that the proposed `sourceGradings` are already stored in that canonical order;
3. verify that `gradingIds` exactly equal those canonical source grading IDs in the same order.

Therefore a proposed artifact such as:
```text
sourceGradings = [B, A]
gradingIds = [B.id, A.id]
```
where `A.gradingId < B.gradingId` must be rejected even though it contains the same set of gradings.

Builder: canonicalizes.
Validator: requires canonical representation.

The validator must not mutate/reorder the proposed root.

## 10. Duplicate accounting policy

Phase 8S rejects BOTH:

- duplicate `gradingId`
- duplicate `recommendationBundleId`

across the supplied source gradings.

Do NOT silently deduplicate. Do NOT choose a "latest" grading using time or caller order.

Caller must supply a corpus with at most one grading artifact per recommendation bundle.

Distinct recommendation bundles are distinct performance observations.

Structural reference identity does not define a new performance observation.

## 9. Input contract proposal

Proposed input type:

```ts
export type MLBOfflinePerformanceAggregationInput = Readonly<{
  gradings: unknown;
}>;
```

The builder accepts `unknown` at the root and validates:
- `gradings` is an own plain-object data property
- `gradings` is an array
- each element passes the public `validateMLBOfflineRecommendationBundleGrading` validator independently
- no source reconstruction or grading regeneration occurs

The builder never reads the current clock. The builder never fetches network state. The builder never queries persistence.

## 10. Aggregation units

Phase 8S keeps distinct performance summaries for three aggregation units:

1. `singlePickPerformance` — aggregates over `sourceGradings[*].singlePickGrades[*]`
2. `multiPerformance` — aggregates over `sourceGradings[*].multiGrades[*]`
3. `multiLegPerformance` — aggregates over `sourceGradings[*].multiGrades[*].legGrades[*]`

These units are not silently combined into one accuracy figure.

Exact summary field order for all three types:

1. `totalCount`
2. `correctCount`
3. `incorrectCount`
4. `unresolvedCount`
5. `resolvedCount`
6. `accuracy`
7. `resolutionRate`

## 11. Metric formulas

All metrics are derived deterministically from the embedded grading results.

```text
totalCount = correctCount + incorrectCount + unresolvedCount

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

`accuracy` must not use `0` to mean "no resolved observations." It must use `null`.

`resolutionRate` is included in V1. It is coverage/completeness, not accuracy.

No rounding is applied in the core contract. The exact JS number produced by deterministic division is stored.

For every non-empty valid summary:
- `0 <= accuracy <= 1` when non-null
- `0 <= resolutionRate <= 1` when non-null

Counts must be non-negative safe integers.

## 12. Unresolved semantics

UNRESOLVED is not a loss.

Invariant:
- CORRECT => resolved success
- INCORRECT => resolved failure
- UNRESOLVED => not included in resolved accuracy denominator

Therefore:
```text
resolvedCount = correctCount + incorrectCount
```
and not `totalCount`.

`unresolvedCount` must remain visible so incomplete grading coverage cannot be hidden.

## 13. Exact proposed contract shape

### Constants

```ts
export const MLB_OFFLINE_PERFORMANCE_AGGREGATION_CONTRACT_VERSION =
  'mlb-offline-performance-aggregation-v1' as const;
```

### Input type

```ts
export type MLBOfflinePerformanceAggregationInput = Readonly<{
  gradings: unknown;
}>;
```

### Performance summary types

```ts
export type MLBOfflineSinglePickPerformance = Readonly<{
  totalCount: number;
  correctCount: number;
  incorrectCount: number;
  unresolvedCount: number;
  resolvedCount: number;
  accuracy: number | null;
  resolutionRate: number | null;
}>;

export type MLBOfflineMultiPerformance = Readonly<{
  totalCount: number;
  correctCount: number;
  incorrectCount: number;
  unresolvedCount: number;
  resolvedCount: number;
  accuracy: number | null;
  resolutionRate: number | null;
}>;

export type MLBOfflineMultiLegPerformance = Readonly<{
  totalCount: number;
  correctCount: number;
  incorrectCount: number;
  unresolvedCount: number;
  resolvedCount: number;
  accuracy: number | null;
  resolutionRate: number | null;
}>;
```

### Root aggregate type

```ts
export type MLBOfflinePerformanceAggregation = Readonly<{
  contractVersion: typeof MLB_OFFLINE_PERFORMANCE_AGGREGATION_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  targetEncoding: 'HOME_WIN_1_AWAY_WIN_0';
  aggregationId: string;
  gradingCount: number;
  gradingIds: readonly string[];
  singlePickPerformance: MLBOfflineSinglePickPerformance;
  multiPerformance: MLBOfflineMultiPerformance;
  multiLegPerformance: MLBOfflineMultiLegPerformance;
  sourceGradings: readonly MLBOfflineRecommendationBundleGrading[];
}>;
```

### Issue type

```ts
export type MLBOfflinePerformanceAggregationIssue = Readonly<{
  code:
    | 'NOT_PLAIN_OBJECT'
    | 'UNKNOWN_FIELD'
    | 'INVALID_JSON_VALUE'
    | 'ODDS_CONTAMINATION'
    | 'PROHIBITED_CONCEPT'
    | 'MISSING_FIELD'
    | 'INVALID_LITERAL'
    | 'INVALID_STRING'
    | 'INVALID_INTEGER'
    | 'INVALID_NUMBER'
    | 'INVALID_ARRAY'
    | 'SOURCE_GRADING_INVALID'
    | 'DUPLICATE_GRADING_ID'
    | 'DUPLICATE_RECOMMENDATION_BUNDLE_ID'
    | 'SOURCE_GRADING_ORDER_MISMATCH'
    | 'GRADING_COUNT_MISMATCH'
    | 'GRADING_IDS_MISMATCH'
    | 'SINGLE_PICK_PERFORMANCE_MISMATCH'
    | 'MULTI_PERFORMANCE_MISMATCH'
    | 'MULTI_LEG_PERFORMANCE_MISMATCH'
    | 'AGGREGATION_ID_MISMATCH'
    | 'GENERATED_AGGREGATION_INVALID';
  path: string;
  message: string;
}>;
```

### Validator and builder

```ts
export function validateMLBOfflinePerformanceAggregation(
  value: unknown,
): Readonly<{ ok: true; value: MLBOfflinePerformanceAggregation }> |
   Readonly<{ ok: false; issues: readonly MLBOfflinePerformanceAggregationIssue[] }>;

export function buildMLBOfflinePerformanceAggregation(
  input: MLBOfflinePerformanceAggregationInput,
): Readonly<{ ok: true; value: MLBOfflinePerformanceAggregation }> |
   Readonly<{ ok: false; issues: readonly MLBOfflinePerformanceAggregationIssue[] }>;
```

### Root fields in order

1. `contractVersion`
2. `sport`
3. `target`
4. `targetEncoding`
5. `aggregationId`
6. `gradingCount`
7. `gradingIds`
8. `singlePickPerformance`
9. `multiPerformance`
10. `multiLegPerformance`
11. `sourceGradings`

## 14. Exact proposed issue codes

1. `NOT_PLAIN_OBJECT`
2. `UNKNOWN_FIELD`
3. `INVALID_JSON_VALUE`
4. `ODDS_CONTAMINATION`
5. `PROHIBITED_CONCEPT`
6. `MISSING_FIELD`
7. `INVALID_LITERAL`
8. `INVALID_STRING`
9. `INVALID_INTEGER`
10. `INVALID_NUMBER`
11. `INVALID_ARRAY`
12. `SOURCE_GRADING_INVALID`
13. `DUPLICATE_GRADING_ID`
14. `DUPLICATE_RECOMMENDATION_BUNDLE_ID`
15. `SOURCE_GRADING_ORDER_MISMATCH`
16. `GRADING_COUNT_MISMATCH`
17. `GRADING_IDS_MISMATCH`
18. `SINGLE_PICK_PERFORMANCE_MISMATCH`
19. `MULTI_PERFORMANCE_MISMATCH`
20. `MULTI_LEG_PERFORMANCE_MISMATCH`
21. `AGGREGATION_ID_MISMATCH`
22. `GENERATED_AGGREGATION_INVALID`

Exact count: 22

Issue ownership:
- `SOURCE_GRADING_INVALID`: one collapsed Phase 8S issue for an invalid embedded Phase 8R grading; do not leak the complete upstream issue cascade
- `GRADING_COUNT_MISMATCH`: owns mismatch between `gradingCount` and `sourceGradings.length`
- `GRADING_IDS_MISMATCH`: owns mismatch between stored canonical `gradingIds` and `sourceGradings[].gradingId`
- `SOURCE_GRADING_ORDER_MISMATCH`: proposed `sourceGradings` are not stored in canonical gradingId-ascending order
- Performance mismatch codes: own semantically valid-but-wrong summary contents
- `AGGREGATION_ID_MISMATCH`: owns deterministic root identity mismatch
- `GENERATED_AGGREGATION_INVALID`: builder-generated aggregate fails public self-validation

## 15. Validation architecture

Primitive validation rules:
- Counts: `number`, `Number.isSafeInteger`, `>= 0`
- Rate fields: `null` OR finite number in `[0, 1]`

A malformed primitive/type/domain uses `INVALID_INTEGER` or `INVALID_NUMBER` as appropriate.

A structurally valid primitive whose value does not equal the deterministic recomputation uses the relevant `*_PERFORMANCE_MISMATCH` issue.

This keeps primitive validity distinct from semantic mismatch.

Cascade dependencies:
- invalid root/sourceGradings => suppress source-derived semantic checks
- invalid Phase 8R source grading => suppress duplicate/canonicalization/summary derivation/ID checks dependent on valid sources
- duplicate gradingId or duplicate recommendationBundleId => aggregate is invalid; suppress generated aggregation derivation
- invalid gradingCount/gradingIds structure => suppress checks that depend on those malformed proposed fields
- summary mismatch DOES NOT automatically suppress aggregationId validation, because aggregationId does not bind summary fields
- aggregationId check requires only valid canonical source grading IDs and a structurally valid proposed aggregationId

Independent malformed fields may yield independent issues.

## 16. Phase-specific prohibited concepts

Do NOT copy Phase 8R's prohibited-root set wholesale into Phase 8S.

Phase 8R rejected the concept `performance` because performance aggregation was outside Phase 8R scope. Phase 8S explicitly owns performance aggregation.

Valid fields such as `singlePickPerformance`, `multiPerformance`, `multiLegPerformance`, `accuracy`, `resolutionRate` must be allowed.

Phase 8S `PROHIBITED_CONCEPT` classification must be phase-specific and explicit. It must reject monetary or out-of-scope concepts such as explicit root keys representing:

- `bankroll`
- `stake`
- `payout`
- `profit`
- `roi`
- `expectedValue`
- `kelly`
- `closingLineValue`
- `sportsbookPerformance`
- `oddsBucket`

while the shared odds guard retains ownership of actual betting/market contamination.

Do NOT use a broad substring rule that could reject valid words such as `performance`, `accuracy`, or `probability`. Model-generated probability is not sportsbook implied probability.

## 17. Empty aggregate semantics

`gradings = []` is valid.

Exact root semantics:

```ts
{
  gradingCount: 0,
  gradingIds: [],
  sourceGradings: [],
  singlePickPerformance: {
    totalCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    unresolvedCount: 0,
    resolvedCount: 0,
    accuracy: null,
    resolutionRate: null,
  },
  multiPerformance: {
    totalCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    unresolvedCount: 0,
    resolvedCount: 0,
    accuracy: null,
    resolutionRate: null,
  },
  multiLegPerformance: {
    totalCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    unresolvedCount: 0,
    resolvedCount: 0,
    accuracy: null,
    resolutionRate: null,
  },
}
```

Empty aggregation ID derives from the contract version plus canonical zero grading IDs.

## 18. Deterministic aggregate identity

Identity must use the CANONICAL grading ID order (gradingId ascending).

Use length-prefixed components consistent with existing deterministic contracts.

Bind:
- contract version
- `gradingIds.length`
- each gradingId in canonical order

Then suffix:
```text
::offline-performance-aggregation-v1
```

Do NOT bind:
- caller input order
- summary counts
- accuracy
- resolutionRate
- object reference identity
- clock
- randomness
- database state

because summaries are deterministic derivatives of the bound validated grading IDs.

`aggregationId` is derived from the canonical representation, not from proposed caller order.

Builder input `[B, A]` and `[A, B]` produce the same canonical artifact/ID.

A manually proposed unsorted artifact is invalid under `SOURCE_GRADING_ORDER_MISMATCH` even if its `aggregationId` happens to equal the ID derived from the same set.

Permuting the same grading collection does not change `aggregationId`.

Delimiter collision is prevented by the length-prefixed component design.

## 19. Import architecture

The future production contract requires only the minimum necessary imports:

```text
../firewall/odds-contamination-guard
./mlb-offline-recommendation-bundle-grading-contract
```

The Phase 8S contract must NOT independently import Phase 8P or Phase 8Q contracts for authoritative aggregation logic.

From Phase 8R it needs at minimum:
- `type MLBOfflineRecommendationBundleGrading`
- `validateMLBOfflineRecommendationBundleGrading`

and firewall helpers consistent with adjacent contracts.

## 20. Exact proposed exports

Nine exports in exact order:

1. `MLB_OFFLINE_PERFORMANCE_AGGREGATION_CONTRACT_VERSION` (constant)
2. `MLBOfflinePerformanceAggregationInput` (type)
3. `MLBOfflineSinglePickPerformance` (type)
4. `MLBOfflineMultiPerformance` (type)
5. `MLBOfflineMultiLegPerformance` (type)
6. `MLBOfflinePerformanceAggregation` (type)
7. `MLBOfflinePerformanceAggregationIssue` (type)
8. `validateMLBOfflinePerformanceAggregation` (function)
9. `buildMLBOfflinePerformanceAggregation` (function)

Composition:
- 1 constant
- 6 types
- 2 functions

## 21. Proposed permanent test inventory

Proposed bounded inventory: 22 explicit tests.

Exact proposed titles in exact order:

1. accepts an empty self-validating performance aggregation with zero counts and null rates
2. aggregates one valid grading into exact single-pick, multi, and multi-leg summaries
3. aggregates mixed grading results into three independent performance summaries
4. excludes UNRESOLVED results from the resolved accuracy denominator
5. computes resolutionRate independently from resolved accuracy
6. treats zero resolved observations as null accuracy rather than zero
7. canonicalizes builder input by gradingId, makes caller-order permutations identity-equivalent, and rejects noncanonical stored source order
8. rejects duplicate gradingId values without silent deduplication
9. rejects duplicate recommendationBundleId values across distinct grading snapshots
10. collapses an invalid Phase 8R source grading to one exact SOURCE_GRADING_INVALID issue
11. validates exact builder-input root fields and gradings array ownership
12. validates exact aggregate root fields, grading count, grading IDs, source-grading mappings, and targetEncoding
13. validates exact single-pick performance counts, accuracy, and resolution rate
14. validates exact multi performance counts, accuracy, and resolution rate
15. validates exact multi-leg performance counts, accuracy, and resolution rate
16. validates primitive integer and nullable rate domains without accepting NaN or Infinity
17. validates deterministic length-prefixed aggregate identity and delimiter-collision resistance
18. preserves exact caller grading element references while allocating and freezing only Phase 8S-owned structures
19. accepts structural clones and returns the exact proposed aggregate root reference on validator success
20. rejects unknown fields while allowing the explicit Phase 8S performance schema
21. rejects odds contamination and prohibited monetary concepts without rejecting model-performance metrics
22. verifies exact exports, imports, issue order, cascade dependencies, and no routes, UI, persistence, network, clock, randomness, recommendation generation, or monetary evaluation

## 23. Implementation slicing plan

Proposed bounded slices:

### 8S-B — contract skeleton / types / constants

- Add version constant, input type, summary types, root type, issue type, validator/builder signatures
- Add `encodeComponent` helper (reuse pattern from Phase 8R)
- Add `deterministicAggregationId` helper
- No validation logic yet

### 8S-C — deterministic core

- Add Phase 8R source validation helper
- Add duplicate detection
- Add canonical comparator/order helper
- Add metric derivation helper
- Add length-prefixed aggregation identity helper
- No public validator or builder semantics yet

### 8S-D — public validator

- Implement public validator
- Implement root/schema validation
- Implement embedded source grading validation
- Implement duplicate ownership
- Implement canonical stored-order validation
- Implement gradingCount/gradingIds mapping
- Implement summary recomputation/mismatch ownership
- Implement aggregation ID validation
- Implement cascade suppression
- Return exact proposed-root reference on success

### 8S-E — builder

- Implement public builder
- Implement input descriptor safety
- Implement grading iteration and metric aggregation
- Implement deterministic identity binding
- Implement `Object.freeze` on owned structures only
- Implement builder self-validation collapse (`GENERATED_AGGREGATION_INVALID`)
- Add structural-clone acceptance tests

### 8S-F — complete permanent 22-test implementation closure

- Implement all 22 explicit tests
- Verify exact titles and order
- Verify no prohibited patterns (`Math.random`, `Date.now`, `randomUUID`, `localeCompare`, network calls, console)
- Verify exact exports/imports

### 8S-G — documentation + broad regression closure

- Create `docs/mlb-v1-offline-performance-aggregation-implementation.md`
- Update `README.md` Phase 8S block
- Run Phase 8S dedicated tests, TypeScript, MLB regression, full project tests
- Verify four-file scope, baseline, and temporary evidence cleanup

## 24. Risks and open questions

1. **Metric precision**: Floating-point division may produce non-terminating binary expansions. The plan stores the exact JS number. If downstream consumers need fixed precision, that is a display/transport concern, not a contract concern.

2. **Empty aggregate auditability**: An empty aggregate is valid, but some consumers may want to distinguish "no data" from "all unresolved." The plan uses identical zero-count summaries for both cases. If differentiation is needed later, add an explicit status field.

3. **Performance terminology drift**: The word "performance" is used in the backtesting metrics module for historical backtest accuracy. Phase 8S performance aggregation is a separate offline deterministic contract. The plan does not merge these domains.

4. **Duplicate recommendationBundleId across time**: Two distinct Phase 8R gradings for the same recommendation bundle against different outcome-set snapshots could share a `recommendationBundleId`. The plan rejects this as duplicate accounting. If future use cases require longitudinal tracking, that must be an explicit bounded slice with separate semantics.

5. **Canonical ordering stability**: `gradingId` ascending is stable and deterministic. If future Phase 8S slices need secondary ordering for identical gradingIds, that must be explicit. Currently duplicate `gradingId` is rejected, so this is not an issue.

## 25. Recommended next implementation slice

Phase 8S-B — contract skeleton / types / constants.

This slice establishes the public API surface, identity helpers, and immutable type contracts without changing runtime behavior. It is the smallest safe first step.
