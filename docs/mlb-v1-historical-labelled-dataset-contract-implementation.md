# MLB V1 Historical Labelled Dataset Contract Implementation

## 1. Phase status

This document describes the Phase 8D implementation of the MLB historical labelled dataset contract.

## 2. Locked baseline

This implementation is built on the Phase 8C trailing-whitespace cleanup commit `06ad616049550730d9110b6df7dfe4d7bc6f080d`.

## 3. Purpose

The historical labelled dataset contract defines a validated, immutable schema for provider-neutral historical MLB examples that are safe for deterministic feature-vector construction.

## 4. Architecture position

The historical labelled dataset contract sits between the Phase 8C canonical pregame snapshot contract and the future Phase 8E feature-vector contract.

## 5. Permanent odds-blind boundary

No odds, market-implied probabilities, model outputs, predicted winners, selections, staking, grading, performance outcomes, or target-game results are permitted anywhere in this contract except the dedicated `label` object.

## 6. Authorized scope

This contract validates a single dataset object with an immutable split policy and an array of examples. It does not perform ingestion, persistence, feature extraction, training, inference, or UI rendering.

## 7. Contract version

The version constant is `mlb-historical-labelled-dataset-v1` and is exposed as the sole runtime non-validator export.

## 8. Root dataset contract

The root dataset must be a plain object with these exact data properties: `contractVersion`, `sport`, `target`, `datasetId`, `createdAt`, `splitPolicy`, and `examples`. No optional fields exist in V1.

## 9. Chronological split policy

The `splitPolicy` contains a fixed `strategy` literal `CHRONOLOGICAL_OFFICIAL_DATE_V1`, an `embargoDays` integer, and three split windows.

## 10. Split windows

Train, validation, and test windows each require `startDate` and `endDate` in `YYYY-MM-DD` format representing real Gregorian dates.

## 11. Embargo rules

The number of whole calendar dates strictly between adjacent windows must be at least `embargoDays`. Train must end before validation starts, and validation must end before test starts.

## 12. Historical example contract

Every example is an own plain object with `exampleId`, `split`, `snapshot`, `reconstruction`, and `label`. Every field is required and must be a data property; accessors are rejected.

## 13. Canonical pregame snapshot integration

Each example calls `validateMLBCanonicalPregameSnapshot` exactly once. On failure the dataset reports `SNAPSHOT_INVALID` at `$.examples[i].snapshot` and does not continue trusted cross-object checks with an invalid snapshot.

## 14. Point-in-time reconstruction metadata

Reconstruction metadata requires `mode` equal to `POINT_IN_TIME_AS_OF_CUTOFF`, `cutoffAt` byte-for-byte equal to `snapshot.dataCutoffAt`, and `reconstructedAt` satisfying `snapshot.capturedAt <= reconstructedAt`.

When the root `createdAt` timestamp is present and valid, `reconstructedAt` must also satisfy `reconstructedAt <= dataset.createdAt`. An invalid or missing `createdAt` does not become epoch zero; that upper-bound comparison is skipped and independent reconstruction validation still occurs.

## 15. Cutoff equality rule

The `cutoffAt` text must be byte-for-byte equal to `snapshot.dataCutoffAt`. Chronologically equivalent alternate text is reported as `RECONSTRUCTION_CUTOFF_MISMATCH`.

## 16. Official final label contract

The label requires `status` equal to `OFFICIAL_FINAL`, `target` equal to `OFFICIAL_FINAL_GAME_WINNER`, non-negative safe-integer `homeRuns` and `awayRuns`, a `winnerTeamId` matching one of the two teams, and `finalizedAt` after both `scheduledStartAt` and `dataCutoffAt`.

## 17. Label timing

`finalizedAt` must be a valid RFC-3339 timestamp with an explicit timezone. `label.source.fetchedAt` must satisfy `finalizedAt <= fetchedAt`.

When the root `createdAt` timestamp is present and valid, `fetchedAt` must also satisfy `fetchedAt <= dataset.createdAt`. An invalid or missing `createdAt` does not become epoch zero; that upper-bound comparison is skipped and independent label-source validation still occurs.

## 18. Winner and score consistency

Scores may not be tied. When `homeRuns > awayRuns`, `winnerTeamId` must equal the snapshot home team. When `awayRuns > homeRuns`, `winnerTeamId` must equal the snapshot away team.

## 19. Label source provenance

Label source fields are `sourceName`, `sourceRecordId`, and `fetchedAt`. All must be strict non-empty trimmed control-free strings and timestamps. No provider response envelope, endpoint, credential, token, or secret is allowed.

## 20. Leakage protections

Official target-game outcomes are permitted only inside `$.examples[i].label`. Outcome fields such as `finalScore`, `homeScore`, `awayScore`, `winningTeamId`, `losingTeamId`, `winner`, `loser`, and similar are rejected at every other level.

## 21. Duplicate game prevention

Only validated IDs enter the duplicate sets. Duplicate `exampleId` produces `DUPLICATE_ID`, duplicate `snapshotId` produces `DUPLICATE_ID`, and duplicate `gameId` produces `DUPLICATE_GAME`.

## 22. Canonical example ordering

Examples are ordered by split ordinal, then snapshot `officialDate`, then `gameId`, then `snapshotId`, then `exampleId`. Only fully validated ordering keys participate. Malformed examples never produce `NON_CANONICAL_ORDER`.

## 23. Descriptor safety

All object and array traversal is descriptor-safe. Accessor properties are never invoked. Symbol properties are rejected without invoking accessors. `readExamplesArray()` captures one own-key snapshot via `Reflect.ownKeys(value)` and inspects numeric descriptors exactly once within that reader. Phase 8D and Phase 8B remain independent descriptor-safe validation boundaries.

## 24. Exact field enforcement

Every required field is inspected as an own data property. Missing properties produce `MISSING_FIELD`. Accessor properties produce `INVALID_JSON_VALUE`. Unknown string properties produce `UNKNOWN_FIELD`.

## 25. Odds-contamination integration

The Phase 8B firewall receives the complete original proposed dataset. Phase 8D's local safe examples array is used only for Phase 8D example validation and does not replace or normalize the proposed firewall input. `readExamplesArray()` captures one own-key snapshot; numeric descriptors are single-pass within that reader. Phase 8D and Phase 8B remain independent descriptor-safe validation boundaries. Valid official final labels are not treated as odds contamination. Prohibited keys and values are reported with `ODDS_CONTAMINATION`.

## 26. Validation issue model

Issues use exact codes: `NOT_PLAIN_OBJECT`, `MISSING_FIELD`, `UNKNOWN_FIELD`, `INVALID_LITERAL`, `INVALID_STRING`, `INVALID_INTEGER`, `INVALID_DATE`, `INVALID_TIMESTAMP`, `INVALID_TIMESTAMP_ORDER`, `DUPLICATE_ID`, `DUPLICATE_GAME`, `INVALID_SPLIT_POLICY`, `SPLIT_WINDOW_OVERLAP`, `EMBARGO_VIOLATION`, `INVALID_JSON_VALUE`, `INVALID_FINAL_LABEL`, `LABEL_TEAM_MISMATCH`, `INVALID_TIME_ORDER`, `RECONSTRUCTION_CUTOFF_MISMATCH`, `EXAMPLE_OUTSIDE_SPLIT`, `NON_CANONICAL_ORDER`, `SNAPSHOT_INVALID`, `ODDS_CONTAMINATION`.

## 27. Determinism and mutation safety

The returned issue list is deduplicated by path/code pair, sorted by path ordinal then code ordinal, and never throws for malformed input. The original dataset reference is returned unchanged on success.

## 28. Exact test coverage

The contract is covered by 20 explicit tests in `tests/prediction/mlb/mlb-historical-labelled-dataset-contract.test.ts`. The tests use descriptor-safe fixtures and assert on the static public architecture boundary.

## 29. Validation results

All 20 Phase 8D tests pass. The 18 Phase 8C snapshot tests and 20 Phase 8B firewall tests continue to pass. TypeScript compilation is clean.

## 30. Deferred work

Future work includes deterministic feature-vector extraction, probabilistic split strategies, partial-dataset handling, and additional label types.

## 31. Recommended next phase

Phase 8E — Implement the leakage-safe MLB feature-vector contract and deterministic feature-extraction boundary.
