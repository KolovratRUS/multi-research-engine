# MLB V1 Training Matrix Contract Implementation

## 1. Phase status

Phase 8F implementation is complete and pending ChatGPT review, commit, and push.

## 2. Locked baseline

This implementation builds on the Phase 8E baseline:

`0a3276792d39a38bfa66e81dbad8e4dc876ae36b`

Implement MLB leakage-safe feature vector contract

## 3. Purpose

Phase 8F implements the leakage-safe MLB training-matrix contract and deterministic feature-label join boundary.

## 4. Architecture position

Phase 8F sits between the Phase 8E feature-vector contract and any future model-training configuration. It accepts a validated Phase 8E feature manifest and a validated Phase 8D historical labelled dataset, extracts each feature vector only from the Phase 8C pregame snapshot, and joins the official final target only after extraction succeeds.

## 5. Permanent odds-blind boundary

The Multi Research Engine remains completely odds-blind.

Prohibited anywhere in a Phase 8F proposed matrix, row, identifier, metadata field, target encoding, or construction input:

- sportsbook odds or prices
- moneyline
- point spread
- game total or over/under
- props
- implied probabilities derived from odds
- market consensus
- market movement
- line shopping
- value or edge
- expected payout
- Kelly calculations
- bookmaker or sportsbook identifiers
- betting-market payloads
- prediction probabilities
- predicted winners
- model scores
- recommendations
- selections
- multis
- stakes
- grading outputs

Allowed:

- validated Phase 8E feature vectors
- official home-win or away-win target encoding
- Phase 8D dataset and example identities
- Phase 8D chronological split assignments
- Phase 8D split windows and embargo metadata
- finite numerical feature values
- missing-value flags
- deterministic split counts
- deterministic validation issues

## 6. Authorized scope

Only these four repository files are authorized for Phase 8F:

- `README.md`
- `docs/mlb-v1-training-matrix-contract-implementation.md`
- `src/prediction/mlb/mlb-training-matrix-contract.ts`
- `tests/prediction/mlb/mlb-training-matrix-contract.test.ts`

## 7. Contract version

The contract version is exported as:

`mlb-training-matrix-v1`

## 8. Target encoding

The target encoding is exported as:

`HOME_WIN_1_AWAY_WIN_0`

Home wins encode as `1`. Away wins encode as `0`.

## 9. Training matrix root

The training matrix root contains exactly these fields:

- `contractVersion`
- `sport`
- `target`
- `targetEncoding`
- `matrixId`
- `manifestId`
- `datasetId`
- `sourceDatasetCreatedAt`
- `splitPolicy`
- `splitCounts`
- `rows`

## 10. Source identities

`matrixId` is constructed deterministically as:

`datasetId + "::" + manifestId`

`manifestId` must equal the validated Phase 8E manifest ID.

`datasetId` must equal the validated Phase 8D dataset ID.

`sourceDatasetCreatedAt` must exactly equal the validated Phase 8D dataset `createdAt` string and must validate as strict RFC3339 with an explicit timezone.

## 11. Split policy integration

The matrix contract preserves the locked Phase 8D split policy:

`CHRONOLOGICAL_OFFICIAL_DATE_V1`

The validator enforces real Gregorian dates, `startDate <= endDate` for every window, TRAIN ends before VALIDATION begins, VALIDATION ends before TEST begins, non-negative safe integer embargo days, and embargo gap satisfaction between consecutive windows.

## 12. Split windows

Each split window contains exactly:

- `startDate`
- `endDate`

Dates use `YYYY-MM-DD` format and are validated as real Gregorian dates using deterministic UTC date arithmetic.

## 13. Embargo preservation

The configured embargo days are non-negative safe integers.

The gap between TRAIN end and VALIDATION start satisfies the embargo.

The gap between VALIDATION end and TEST start satisfies the embargo.

## 14. Split counts

Split counts are a readonly type alias with exact fields:

- `train`
- `validation`
- `test`

Each field is a non-negative safe integer.

The sum exactly equals the row count.

Each field exactly equals the number of rows assigned to its split.

## 15. Training matrix rows

Each row contains exactly:

- `exampleId`
- `split`
- `vector`
- `targetValue`

## 16. Phase 8E feature-vector integration

Every row vector is validated through `validateMLBFeatureVector`.

`vector.manifestId` must equal the matrix `manifestId`.

Feature IDs and order must match the matrix-wide feature schema exactly.

## 17. Phase 8D historical dataset integration

The builder accepts one Phase 8D historical labelled dataset.

The dataset is validated through `validateMLBHistoricalLabelledDataset` before any content is accessed.

Examples are iterated in canonical order.

## 18. Feature-first label-second boundary

The critical Phase 8F boundary is:

validated Phase 8C snapshot -> Phase 8E feature extraction -> validated feature vector -> official final target join

The prohibited boundary is:

historical example or label -> feature extractor

The Phase 8E extractor receives exactly the validated manifest and `example.snapshot`.

The Phase 8E extractor never receives the complete Phase 8D dataset, a Phase 8D historical example, a label, a split, final scores, winner identity, reconstruction metadata, or provenance metadata.

Official final labels are read by Phase 8F only after feature extraction for that row has succeeded.

## 19. Official final target derivation

Target `1` derives only from the official winner matching the snapshot home team.

Target `0` derives only from the official winner matching the snapshot away team.

No score comparison is used.

## 20. Structural label minimization

Matrix rows contain only:

- `exampleId`
- `split`
- `vector`
- `targetValue`

Rows exclude:

- `homeRuns`
- `awayRuns`
- `winnerTeamId`
- `finalizedAt`
- label source
- label source record ID
- label fetched timestamp

## 21. Feature schema consistency

The first valid row establishes the matrix feature schema as the exact ordered list of `vector.values[].featureId`.

Every later valid row must have the same feature count, the same feature IDs, and the same order.

## 22. Duplicate prevention

Duplicate valid `exampleId`, `vector.snapshotId`, and `vector.gameId` are rejected.

Malformed identifiers are excluded from duplicate comparisons.

A game may appear only once in the V1 matrix.

## 23. Canonical row ordering

Rows are ordered by:

1. split rank: TRAIN, VALIDATION, TEST
2. `vector.officialDate`
3. `vector.gameId`
4. `vector.snapshotId`
5. `exampleId`

Ordinal string comparison is used.

## 24. Descriptor safety

At every new Phase 8F proposed-contract level, the validator supports ordinary plain objects and null-prototype plain objects.

Rejected structures include:

- arrays where objects are required
- custom class instances
- own symbol properties
- unknown own string properties
- non-enumerable unknown fields
- getter-only accessors
- setter-only accessors
- getter-plus-setter accessors
- sparse arrays
- numeric accessor array properties
- unexpected string properties on arrays

The validator never invokes user-defined getters or setters.

## 25. Exact field enforcement

`MISSING_FIELD` is used for an absent required own property.

`INVALID_JSON_VALUE` is used for an accessor without invocation or structurally unsafe proposed JSON-like data.

`UNKNOWN_FIELD` is used for an unknown field unless a narrower prohibited-field issue applies.

Prohibited matrix or row fields such as `label`, `homeRuns`, `awayRuns`, `winnerTeamId`, `finalizedAt`, `source`, `prediction`, `probability`, `recommendation`, `stake`, and `grading` are rejected with `PROHIBITED_CONCEPT`.

## 26. Odds-contamination integration

The Phase 8B firewall runs against:

- the complete original proposed training matrix in the matrix validator
- the newly generated training matrix before construction success is returned

Actual contamination maps to `ODDS_CONTAMINATION`.

An uninspectable accessor or firewall traversal failure maps to `INVALID_JSON_VALUE`.

## 27. Validation issue model

Issues are deduplicated by exact path/code pair, sorted by path using ordinal comparison, then by code using ordinal comparison. No message-based ordering is used. No `localeCompare` is used. Ordinary malformed input never throws.

## 28. Determinism and mutation safety

No filesystem, network, database, environment, clock, random, or UUID operation is performed.

The manifest, dataset, examples, snapshots, labels, and feature vectors are never mutated.

## 29. Exact test coverage

Exactly 20 explicit `it(...)` tests cover the Phase 8F boundary.

## 30. Deferred work

Phase 8F does not implement:

- model training or fitting
- hyperparameter search
- calibration
- inference
- probability generation
- winner prediction
- recommendations
- multis
- staking
- grading
- persistence
- database work
- provider adapters
- live ingestion
- scheduling
- routes
- UI
- deployment
- real production dataset construction

## 31. Recommended next phase

Phase 8G — Implement the deterministic MLB model-training configuration and evaluation-plan contract without fitting a model or generating predictions.
