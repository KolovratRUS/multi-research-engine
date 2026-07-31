# MLB V1 Pregame Snapshot Contract Implementation

## 1. Phase status

Phase 8C. Authorized implementation and verification only. No live API requests, no credentials, no ingestion, no persistence.

## 2. Locked baseline

7502d12f917e1763e8b4ea5f96f44f7cbced8371

## 3. Purpose

Implement the provider-neutral canonical pregame snapshot contract for MLB V1. The snapshot represents one pregame MLB game and preserves stable game identity, cutoff timestamps, source provenance, starting-pitcher states, completeness, warnings, and provider-neutral sport-data sections.

## 4. Architecture position

The snapshot is an upstream data package consumed by the Phase 8B prediction layer. It is constructed outside `src/prediction` and validated by `validateMLBCanonicalPregameSnapshot`. The prediction layer never mutates the snapshot.

## 5. Permanent odds-blind boundary

The snapshot contains only sport data, provenance, availability, completeness, and neutral validation metadata. Prohibited: odds/betting data, market-implied probabilities, model outputs, predicted winners, selections, staking, grading, performance outcomes, and target game results.

## 6. Authorized scope

Authorized Phase 8C scope: `src/prediction/mlb/mlb-pregame-snapshot-contract.ts`, `tests/prediction/mlb/mlb-pregame-snapshot-contract.test.ts`, `docs/mlb-v1-pregame-snapshot-contract-implementation.md`, `docs/mlb-v1-sport-data-source-evaluation.md`, and `README.md`.

## 7. Contract version

Current contract version: `MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION`. The root field `$.contractVersion` must match this exact literal. Missing or mismatched versions are rejected.

## 8. Root snapshot contract

Required root fields: `contractVersion`, `sport`, `target`, `snapshotId`, `capturedAt`, `dataCutoffAt`, `game`, `startingPitchers`, `sourceReferences`, `sections`, `dataCompleteness`, `warnings`.

Missing required root fields emit `MISSING_FIELD`. Unknown root fields emit `UNKNOWN_FIELD`.

## 9. Game identity

Required game fields: `gameId`, `scheduledStartAt`, `officialDate`, `season`, `gameType`, `status`, `homeTeamId`, `awayTeamId`, `venueId`, `neutralSite`, `doubleheader`.

`gameId`, `homeTeamId`, and `awayTeamId` are string identifiers. `doubleheader` may be `null` or a plain object with `doubleheaderId` and `gameNumber`. `gameNumber` must be `1` or `2`.

## 10. Pregame-only status boundary

Permitted pregame statuses: `SCHEDULED`, `PRE_GAME`, `POSTPONED`, `CANCELLED`, `UNKNOWN`. In-progress or completed statuses are rejected.

## 11. Snapshot and cutoff timestamps

`dataCutoffAt <= capturedAt < scheduledStartAt`. All timestamps are validated as strict ISO 8601 without leading/trailing whitespace. Mixed timezone offsets are supported as long as numeric ordering holds.

## 12. Source references

`sourceReferences` is a non-empty array of resolved source references. Each reference requires `sourceRefId`, `sourceName`, `sourceCategory`, `roles`, `fetchedAt`, and `sourceUpdatedAt`. `providerRecordId` is required and may be `null` or a trimmed non-control string.

Source reference strings must be actual strings, non-empty, already trimmed, and contain no control characters.

## 13. Starting-pitcher states

Four states:

- `CONFIRMED`: `pitcherId` required, `announcedAt` required, `sourceRefIds` required non-empty, `announcedAt <= dataCutoffAt`.
- `PROBABLE`: `pitcherId` required, `announcedAt` required, `sourceRefIds` required non-empty, `announcedAt <= dataCutoffAt`.
- `UNCONFIRMED`: `pitcherId` must be `null`, `announcedAt` may be `null` or valid and `<= dataCutoffAt`, `sourceRefIds` required as a field and may be empty or populated.
- `UNAVAILABLE`: `pitcherId` must be `null`, `announcedAt` must be `null`, `sourceRefIds` required as a field and may be empty or populated.

Global rule: every non-null `announcedAt` must be `<= dataCutoffAt`.

## 14. Provider-neutral sections

`sections` is a non-empty array sorted by `sectionId`. Each section requires `sectionId`, `kind`, `entity`, `status`, `asOfAt`, `sourceRefIds`, and `payload`. `asOfAt` must be `<= dataCutoffAt`.

## 15. Entity scopes

Permitted scopes: `GAME`, `HOME_TEAM`, `AWAY_TEAM`, `HOME_STARTER`, `AWAY_STARTER`, `VENUE`, `WEATHER`, `LINEUP`, `BULLPEN`, `STATS`, `ADVANCED_METRICS`.

`GAME` entityId must be `null`. All other scopes require a string entityId.

## 16. JSON-like payload rules

Section payloads are validated as JSON-like values through descriptor-safe traversal. The contract rejects `NaN`, `Infinity`, `-Infinity`, `BigInt`, `Map`, `Set`, `Date`, class instances, cyclic references, accessor properties (never invoking getters or setters), symbol properties, and arrays with numeric accessor properties (getter-only, setter-only, and getter-plus-setter descriptors are all rejected without execution).

Safe data values are accepted recursively.

## 17. Provider-specific payload exclusion

Prohibited normalized provider-specific payload keys:

`providerName`, `providerRecordId`, `rawResponse`, `rawPayload`, `requestUrl`, `requestEndpoint`, `apiKey`, `accessToken`, `refreshToken`, `authorization`, `authorizationHeader`, `cookie`, `clientSecret`

Safe descriptive strings (`sourceGameId`, `sourceTeamId`, `sourcePlayerId`) are not rejected.

## 18. Prediction-output exclusion

The contract rejects prediction/output payload keys: `modelProbability`, `predictedWinner`, `stake`, `gradedResult`, `profit`, `roi`, `edge`, `confidence`, `recommendation`, `pick`, `selection`, `multi`, `parlay`.

## 19. Target-game outcome exclusion

The root object and the exact game object reject prohibited outcome fields:

`finalScore`, `homeScore`, `awayScore`, `winningTeamId`, `losingTeamId`, `winner`, `loser`, `completedGameState`, `finalStatus`, `result`, `outcome`, `gradedResult`

Safe historical sport data inside section payloads is not broadly rejected.

## 20. Odds-contamination integration

The contract delegates to the Phase 8B firewall (`assertNoOddsContamination`). Odds contamination is reported as `ODDS_CONTAMINATION`. Uninspectable accessor properties reported by the firewall are converted to `INVALID_JSON_VALUE` without importing private firewall symbols.

## 21. Canonical ordering

Arrays are canonical-ordered:

- `sourceReferences`: sorted by `sourceRefId`
- starting-pitcher `sourceRefIds`: sorted ascending
- `section.sourceRefIds`: sorted ascending
- `sections`: sorted by `sectionId`
- `warnings`: sorted by `path`, then `code`, then `message`

Ordering violations emit `NON_CANONICAL_ORDER`. Duplicate identifiers emit `DUPLICATE_ID`.

## 22. Warning contract

Each warning requires `code`, `path`, and `message`. `code` and `message` must be trimmed non-control strings. `path` must begin with `$`.

Only fully valid warnings participate in canonical warning ordering. Malformed warnings receive field-level validation issues without an additional warning-order issue.

Warnings are not required to have unique path/code pairs. Duplicate path/code pairs with different messages are valid and must remain sorted by `path`, then `code`, then `message`.

## 23. Validation issue model

Issues contain `code`, `path`, `message`, and optional `expected`/`actual`. Issues are deduplicated by exact path/code pairs. They are sorted by path using ordinal comparison, then by code using ordinal comparison. No exceptions are thrown for malformed input.

## 24. Determinism and mutation safety

The validator never mutates the input. It returns the original snapshot on success. Validation results are deterministic for identical inputs.

## 25. Import boundary

`mlb-pregame-snapshot-contract.ts` imports only:

```text
../firewall/odds-contamination-guard
```

No other internal path is imported.

## 26. Exact test coverage

Exactly 18 focused tests cover:

- minimal valid canonical snapshot
- contract literals and unknown fields
- game identity
- doubleheader identity
- target-game outcome fields
- timestamp structure and numeric ordering
- source references and resolution
- source timestamp rules
- starting-pitcher states
- incomplete starter data and partial completeness
- section entity consistency
- duplicate IDs, unresolved sources, unsorted arrays
- JSON-like payload safety and accessor rejection
- odds contamination
- provider-specific and prediction-output exclusions
- warning shape, order, and deterministic issue ordering
- static architecture boundary

## 27. Validation results

Phase 8C focused validation passed 18 tests. Phase 8B regression passed 20 tests. Full Vitest passed 1443 tests. TypeScript passed. Build passed.

## 28. Source-evaluation relationship

`docs/mlb-v1-sport-data-source-evaluation.md` evaluates current MLB sport-data sources and classifies their roles, licensing, and point-in-time availability. It does not authorize production ingestion or hard-code a provider.

## 29. Deferred work

- Provider adapter construction.
- Source credential storage.
- Scheduled ingestion workers.
- Local snapshot caching and retrieval.
- Historical dataset construction.
- Point-in-time reconstruction verification.
- Weather provider selection and terms review.
- Production intake and monitoring.

## 30. Limitations

Phase 8C does not call a live API. Phase 8C does not choose a provider inside runtime code. Phase 8C does not add credentials. Phase 8C does not create a historical dataset. Phase 8C does not generate model features. Phase 8C does not train a model. Phase 8C does not generate probabilities. Phase 8C does not predict a winner. Phase 8C does not persist snapshots. Phase 8C does not schedule ingestion. Phase 8C does not add routes or UI.

## 31. Recommended next phase

Phase 8D — Implement the historical labelled dataset contract, point-in-time reconstruction boundary, and leakage protections.
