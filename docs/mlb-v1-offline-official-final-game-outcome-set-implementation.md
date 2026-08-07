# MLB V1 Offline Official Final-Game Outcome Set Implementation

## 1. Phase status

Phase 8Q is complete. The locked parent baseline is `eb56ad46271a77cca68a171765a58b2a1fc5bb66` ("Implement MLB offline recommendation bundle").

## 2. Locked baseline

- Baseline commit: `eb56ad46271a77cca68a171765a58b2a1fc5bb66`
- Phase 8Q builds exclusively on the four authorized files listed in section 6.
- No upstream historical-dataset schema or prediction route is modified.

## 3. Purpose

Phase 8Q validates caller-supplied official-final MLB game facts into a standalone deterministic publication contract (`MLBOfflineOfficialFinalGameOutcomeSet`) that is independent of the historical training dataset. It does not grade, recommend, predict, aggregate, persist, route, or display outcomes.

## 4. Architecture position

The Phase 8Q contract sits below the shared firewall layer (`../firewall/odds-contamination-guard`) and above any future packaging or grading phase. It owns only:
- input shape and descriptor safety;
- per-entry semantic validation;
- deterministic identity derivation;
- collection-level uniqueness, ordering, and mapping checks;
- publication of a frozen canonical artifact.

## 5. Permanent odds-blind boundary

Phase 8Q never accepts, derives, inspects, compares against, or outputs:
- sportsbook odds or prices;
- betting lines;
- implied probabilities;
- market consensus or movement;
- expected value;
- value or edge;
- payout;
- profit;
- monetary return;
- line shopping;
- closing-line value;
- Kelly calculations;
- monetary stakes;
- bankroll values;
- ROI;
- yield.

Phase 8Q contains no recommendation, prediction, probability, confidence, uncertainty, risk unit, grade, correctness result, performance aggregate, or monetary metric.

## 6. Authorized four-file scope

- `README.md`
- `docs/mlb-v1-offline-official-final-game-outcome-set-implementation.md`
- `src/prediction/mlb/mlb-offline-official-final-game-outcome-set-contract.ts`
- `tests/prediction/mlb/mlb-offline-official-final-game-outcome-set-contract.test.ts`

## 7. Public API and imports

The production module exports exactly seven symbols in order:

1. `MLB_OFFLINE_OFFICIAL_FINAL_GAME_OUTCOME_SET_CONTRACT_VERSION`
2. `MLBOfflineOfficialFinalGameOutcomeSetInput`
3. `MLBOfflineOfficialFinalGameOutcome`
4. `MLBOfflineOfficialFinalGameOutcomeSet`
5. `MLBOfflineOfficialFinalGameOutcomeSetIssue`
6. `validateMLBOfflineOfficialFinalGameOutcomeSet`
7. `buildMLBOfflineOfficialFinalGameOutcomeSet`

It contains exactly one import declaration:

```ts
import {
  assertNoOddsContamination,
  isProhibitedOddsBoundaryKey,
} from '../firewall/odds-contamination-guard';
```

Both imported symbols are used in exactly one call expression each within the production module.

## 8. Contract version and literals

The version literal is:

```ts
'mlb-offline-official-final-game-outcome-set-v1'
```

The `target` literal is `OFFICIAL_FINAL_GAME_WINNER`. The `sport` literal is `MLB`. The `status` literal is `OFFICIAL_FINAL`. The outcome identity suffix is `::offline-official-final-game-outcome-v1`. The outcome-set identity suffix is `::offline-official-final-game-outcome-set-v1`.

## 9. Caller-supplied official outcome facts

The builder and validator accept caller-owned plain-object outcomes. The caller supplies every canonical field; the module never derives game facts from a historical dataset, live feed, or external source. The only accepted provenance is the nested `source` object supplied by the caller.

## 10. Canonical dates and timestamps

- `officialDate` must be a valid canonical Gregorian date in `YYYY-MM-DD` format. Year zero is rejected.
- `scheduledStartAt`, `finalizedAt`, and `source.fetchedAt` must be canonical UTC timestamps in `YYYY-MM-DDTHH:mm:ss.sssZ` format.
- No `Date` API, `Temporal`, clock, or randomness is used.

## 11. Builder input boundary

The builder accepts `unknown`. It validates:
- root symbol properties;
- builder-owned root field descriptor safety;
- prohibited odds-boundary keys via `isProhibitedOddsBoundaryKey`;
- explicit `stake` and `grade` prohibition;
- `outcomes` array shape and descriptor safety;
- per-entry shape and primitive validation;
- deterministic outcome-ID comparison;
- collection semantics (duplicates, order, counts, mappings, set identity).

The builder returns no partial output. On any failure it returns `{ ok: false, issues }`.

## 12. Outcome-entry schema

Each outcome must be a plain object with exactly these data fields:

- `outcomeId`
- `status`
- `target`
- `gameId`
- `officialDate`
- `scheduledStartAt`
- `homeTeamId`
- `awayTeamId`
- `homeRuns`
- `awayRuns`
- `winnerTeamId`
- `finalizedAt`
- `source`

Symbol properties, accessor properties, and unknown string properties are rejected.

## 13. Official-final score and winner semantics

After timestamp grammar and chronology validation, the module checks:

1. `homeTeamId` and `awayTeamId` must differ.
2. `winnerTeamId` must identify either `homeTeamId` or `awayTeamId`.
3. `homeRuns` and `awayRuns` must not be tied.
4. When `homeRuns` exceed `awayRuns`, `winnerTeamId` must equal `homeTeamId`.
5. When `awayRuns` exceed `homeRuns`, `winnerTeamId` must equal `awayTeamId`.

Semantic checks are cascaded: identical-team rejection suppresses winner-membership and score comparison; invalid winner membership suppresses score comparison; tied scores suppress winner/score comparison.

## 14. Source provenance

Each outcome carries a nested `source` plain object with exactly:

- `sourceName`
- `sourceRecordId`
- `fetchedAt`

The source is validated for shape, descriptor safety, and primitive constraints independently of the parent outcome. No source provenance is derived or inferred.

## 15. Source-fetch chronology

After finalization chronology validation, the module checks:

```ts
source.fetchedAt >= finalizedAt
```

The exact issue emitted on failure is:

```ts
{
  code: 'INVALID_TIME_ORDER',
  path: sourceFieldPath(index, 'fetchedAt'),
  message: `source.fetchedAt must not be earlier than finalizedAt for game ${gameId}`,
}
```

## 16. Content-derived outcome identity

The deterministic outcome identity binds:

- `status`
- `target`
- `gameId`
- `officialDate`
- `scheduledStartAt`
- `homeTeamId`
- `awayTeamId`
- `homeRuns`
- `awayRuns`
- `winnerTeamId`
- `finalizedAt`
- `source.sourceName`
- `source.sourceRecordId`
- `source.fetchedAt`

Each component is encoded as `<length>:<value>` and concatenated with the suffix `::offline-official-final-game-outcome-v1`.

A valid duplicate outcome ID cannot have a different `gameId` because every canonical field is bound. Two semantically identical valid entries therefore share the same deterministic outcome ID.

## 17. Root artifact fields

The published root artifact contains exactly:

- `contractVersion`
- `sport`
- `target`
- `outcomeSetId`
- `outcomeCount`
- `outcomeIds`
- `outcomes`

The root and its arrays are newly allocated. The root is frozen. The arrays are frozen. The contained outcome references are the exact original caller-owned objects.

## 18. Canonical ordering and uniqueness

Collection semantics require canonical ordering by:

1. `gameId` (ordinal);
2. `officialDate` (ordinal);
3. `outcomeId` (ordinal).

Duplicates are detected on `gameId` and on `outcomeId` across the verified valid entries. Order comparison is performed against the sorted valid entries; the original entry order is preserved for issue path reporting.

## 19. Root counts and ID mappings

- `outcomeCount` must equal the number of valid outcomes.
- `outcomeIds` must be a dense array of the canonical outcome IDs in the supplied order.
- `outcomeSetId` must match the deterministic identity derived from the canonical ordered outcome IDs.

## 20. Content-derived outcome-set identity

The deterministic outcome-set identity is computed from the canonical ordered outcome IDs using one shared private helper. The empty branch is explicit:

```ts
function deterministicOutcomeSetId(
  outcomeIds: readonly string[],
): string {
  if (outcomeIds.length === 0) {
    return (
      '0::offline-official-final-game-' +
      'outcome-set-v1'
    );
  }

  return (
    `${outcomeIds.length}:` +
    outcomeIds
      .map(encodeComponent)
      .join('') +
    '::offline-official-final-game-' +
    'outcome-set-v1'
  );
}
```

The helper is shared by both the validator and the builder. No `localeCompare`, JSON serialization, or `Date` API is used.

## 21. Empty outcome publication

An empty outcome publication is valid. Its deterministic identity is exactly `0::offline-official-final-game-outcome-set-v1`. The validator accepts this identity and the builder derives it through the same shared helper.

## 22. Exact reference preservation

The builder constructs the canonical output array from the exact original caller entries. It does not:

- freeze accepted entries;
- freeze nested source objects;
- spread or reconstruct accepted entries;
- clone accepted entries;
- mutate any caller-owned object.

The validated entry state retains the original object reference. After canonical sorting:

```ts
const canonicalOutcomes =
  sortedEntries.map(
    (entry) => entry.original,
  );
```

Only the new arrays and the root are newly allocated. Caller entries and sources remain untouched.

## 23. Structural-clone validation

The validator accepts structural clones because it inspects plain-object shape and data descriptors. Reference identity is not required for validation. The builder, however, preserves exact original references in its published output.

## 24. Descriptor safety, issue ownership, and cascade suppression

All array and object inputs are validated for symbol properties, accessor properties, unknown fields, and sparsity before semantic content is read. Issues are deduplicated by `(code, path)` pair. Issue paths always identify the first invalid occurrence.

Cascade suppression rules:
- noncanonical order suppresses deterministic set-ID comparison;
- invalid entry suppresses all collection semantics;
- duplicate detection suppresses no other semantic issue because duplicates are collected after valid-entry filtering;
- identical-team rejection suppresses winner-membership and score comparison;
- winner-outside-team suppression suppresses score/winner comparison;
- tied-score suppression suppresses winner/score comparison.

## 25. Odds contamination, tests, and non-goals

The module calls `assertNoOddsContamination` and `isProhibitedOddsBoundaryKey` exactly once each. It rejects `stake` and `grade` as `PROHIBITED_CONCEPT`. Unsupported non-firewall-owned root fields are classified as `UNKNOWN_FIELD`.

Phase 8Q contains exactly twenty explicit tests. It does not grade, aggregate, route, persist, display, contact external services, or measure performance.

## 26. Recommended Phase 8R

Phase 8R — Implement deterministic offline grading of timestamped MLB recommendation bundles against validated Phase 8Q official final-game outcome sets without routes, UI, persistence, or performance aggregation.
