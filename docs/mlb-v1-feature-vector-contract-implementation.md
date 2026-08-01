# MLB v1 feature vector contract implementation

## 1. Phase status

Phase 8E is implemented as a locked leakage-safe MLB feature-vector contract and deterministic feature-extraction boundary.

## 2. Locked baseline

Phase 8E builds on the locked Phase 8D baseline:

e1b7f023153c46ded28ee19914513faea93d1fba

Phase 8B odds-contamination firewall, Phase 8C canonical pregame snapshot contract, and Phase 8D historical labelled dataset contract remain unchanged.

## 3. Purpose

Phase 8E defines a provider-neutral, odds-blind, deterministic MLB feature-vector boundary.

The boundary validates a declarative numerical feature manifest, accepts one proposed Phase 8C canonical pregame snapshot, and extracts numerical or Boolean sport-data values only from canonical snapshot section payloads.

## 4. Architecture position

Phase 8E sits between the Phase 8C pregame snapshot and any future label-joining or training boundary.

It produces feature vectors only.

It does not consume or access Phase 8D labels, historical examples, official final scores, or winning-team identity.

## 5. Permanent odds-blind boundary

The permanent odds-blind firewall remains active.

Prohibited concepts are rejected at the manifest, vector, and generated-vector levels.

Allowed values are provider-neutral pregame sport data, finite numerical measurements, Boolean sport-data states encoded as 1 or 0, section identifiers, descriptor-safe payload paths, explicit missing-value handling, feature IDs, snapshot and game identity, snapshot official date and data cutoff, and validation issues.

## 6. Authorized scope

Only four files are authorized for Phase 8E:

- README.md
- docs/mlb-v1-feature-vector-contract-implementation.md
- src/prediction/mlb/mlb-feature-vector-contract.ts
- tests/prediction/mlb/mlb-feature-vector-contract.test.ts

## 7. Contract versions

The manifest contract version is:

mlb-feature-manifest-v1

The vector contract version is:

mlb-feature-vector-v1

Both are required exact literals.

## 8. Feature manifest root

The feature manifest root requires:

- contractVersion: mlb-feature-manifest-v1
- sport: MLB
- target: OFFICIAL_FINAL_GAME_WINNER
- manifestId: strict identifier
- features: descriptor-safe array with at least one feature

The complete proposed manifest passes the Phase 8B firewall.

Successful validation returns the exact original manifest reference.

## 9. Feature definition

Each feature definition requires:

- featureId: strict identifier
- sectionId: strict identifier matching one Phase 8C canonical snapshot section
- payloadPath: descriptor-safe array with at least one path segment
- valueKind: NUMBER or BOOLEAN
- missingPolicy: REJECT or USE_DEFAULT
- defaultValue: null when REJECT, finite number when USE_DEFAULT

No optional fields exist.

## 10. Payload path segments

Payload path segments are exactly string or number.

String segments are non-empty, already trimmed, control-free object-property names.

Numeric segments are non-negative safe-integer array indexes.

No dot-path, JSONPath, JavaScript expression, wildcard, recursive descent, or executable syntax is supported.

## 11. Value kinds

NUMBER preserves the finite source number exactly.

BOOLEAN encodes true as 1 and false as 0.

No string category encoding, scaling, normalization, centering, bucketing, imputation statistics, interaction terms, polynomial terms, or learned transformation is performed.

## 12. Missing-value policies

REJECT returns FEATURE_PATH_MISSING when the source is missing.

USE_DEFAULT appends an extracted feature value with wasMissing: true and the configured finite default.

Terminal null, string, object, array, number for a Boolean feature, and Boolean for a number feature are type mismatches, not missing values.

## 13. Feature vector root

The feature vector root requires:

- contractVersion: mlb-feature-vector-v1
- sport: MLB
- target: OFFICIAL_FINAL_GAME_WINNER
- manifestId: strict identifier
- snapshotId: strict identifier from the validated snapshot
- gameId: strict identifier from the validated snapshot game
- officialDate: real Gregorian YYYY-MM-DD
- dataCutoffAt: valid RFC3339 timestamp with explicit timezone
- values: descriptor-safe non-empty array of extracted feature values

The generated vector passes the Phase 8B firewall before extraction success is returned.

## 14. Extracted feature values

Each extracted feature value requires:

- featureId: strict identifier
- value: finite number
- wasMissing: Boolean

NUMBER features preserve the finite source number exactly.

BOOLEAN features encode true as 1 and false as 0.

Defaulted values have wasMissing: true.

Directly extracted values have wasMissing: false.

## 15. Phase 8C snapshot integration

The extractor receives the proposed snapshot as unknown.

It calls validateMLBCanonicalPregameSnapshot exactly once.

It does not inspect any snapshot property before validation succeeds.

It preserves the exact validated snapshot reference.

It never mutates the snapshot.

## 16. Structural label isolation

Phase 8E does not import Phase 8D.

The production source does not contain or access:

- .label
- splitPolicy
- reconstruction
- homeRuns
- awayRuns
- winnerTeamId
- finalizedAt
- OFFICIAL_FINAL
- historical dataset examples
- training labels
- official outcomes

The extractor signature accepts only a proposed feature manifest and a proposed canonical pregame snapshot.

## 17. Section selection

For each validated manifest definition, the extractor finds the snapshot section whose sectionId exactly equals definition.sectionId.

It does not use section array position as semantic identity.

It does not fall back to another section.

It does not infer a section by provider, source name, entity ID, kind, or payload shape.

When no matching section exists, the source is treated as missing and the definition's missing policy is applied.

## 18. Payload traversal

Traversal begins at the selected section's payload.

String segments require a plain object container and read the exact own property.

Numeric segments require an array container and read the exact own data property at the index.

An absent own property, out-of-range index, or sparse position is missing.

When traversal must continue but the current value is not the required object or array container, the extractor emits FEATURE_SOURCE_INVALID.

When the terminal value exists but does not match valueKind, the extractor emits FEATURE_TYPE_MISMATCH.

## 19. Numerical extraction

NUMBER features preserve finite source numbers exactly.

NaN, positive or negative Infinity, strings coerced to numbers, Boolean coercion, and silent defaulting are rejected.

## 20. Boolean encoding

BOOLEAN features encode true as 1 and false as 0.

No other encoding is supported.

## 21. Missing and default behavior

A source is missing when:

- the declared section ID does not exist
- an own object property is absent
- an array index is out of range
- an array index is sparse

REJECT returns FEATURE_PATH_MISSING.

USE_DEFAULT appends an extracted feature value with wasMissing: true and the configured finite default.

## 22. Descriptor safety

At every new Phase 8E proposed-contract level, the extractor supports ordinary plain objects and null-prototype plain objects.

It rejects arrays where objects are required, custom class instances, own symbol properties, unknown own string properties, non-enumerable unknown fields, getter-only accessors, setter-only accessors, getter-plus-setter accessors, sparse arrays, numeric accessor array properties, and unexpected string properties on arrays.

The extractor never invokes user-defined getters or setters.

It never mutates, trims, sorts, freezes, clones, or normalizes proposed manifest or vector values.

Array extraction uses own descriptors before normal iteration.

## 23. Exact field enforcement

Every field listed in the manifest, feature-definition, vector, and extracted-feature-value contracts is required as an own data property.

MISSING_FIELD is used for an absent required own property.

INVALID_JSON_VALUE is used for an accessor without invocation.

UNKNOWN_FIELD is used for an unknown field unless a more specific prohibited-field issue applies.

No optional Phase 8E V1 fields exist.

## 24. Odds-contamination integration

The Phase 8B firewall runs against:

- the complete proposed manifest
- the complete proposed feature vector in the vector validator
- the newly generated vector before extraction success is returned

assertNoOddsContamination receives the original proposed input.

Actual contamination is mapped to ODDS_CONTAMINATION.

An uninspectable accessor or firewall traversal error is mapped to INVALID_JSON_VALUE.

No private firewall error class is imported.

No firewall exception escapes.

No clone or sanitized substitute is passed.

## 25. Validation issue model

The validation issue model exports a readonly type with exact fields:

- code
- path
- message

Permitted codes include:

MISSING_FIELD, UNKNOWN_FIELD, NOT_PLAIN_OBJECT, INVALID_JSON_VALUE, INVALID_STRING, INVALID_LITERAL, INVALID_INTEGER, INVALID_NUMBER, INVALID_DATE, INVALID_TIMESTAMP, INVALID_ARRAY, DUPLICATE_ID, NON_CANONICAL_ORDER, SNAPSHOT_INVALID, FEATURE_SECTION_NOT_FOUND, FEATURE_PATH_MISSING, FEATURE_SOURCE_INVALID, FEATURE_TYPE_MISMATCH, INVALID_MISSING_POLICY, ODDS_CONTAMINATION, PROHIBITED_CONCEPT

Issues are deduplicated by exact path/code pairs, sorted by path using ordinal comparison, then sorted by code using ordinal comparison.

The implementation never throws for ordinary malformed input.

## 26. Canonical ordering

Feature definitions in the manifest must be sorted by featureId using ordinal comparison.

Extracted feature values in the vector must be sorted by featureId using ordinal comparison.

Malformed feature IDs do not enter duplicate or ordering comparisons.

## 27. Determinism and mutation safety

Repeated extraction from identical input references produces deeply equal output.

No output object identity guarantee across repeated calls is required.

The extractor does not freeze inputs or outputs.

No timestamp is generated from the current clock.

## 28. Exact test coverage

Exactly 20 explicit tests cover:

1. minimal valid manifest acceptance and reference preservation
2. manifest root field validation
3. feature-definition field and literal validation
4. strict identifier control-character validation
5. string and numeric payload-path segment validation
6. empty, sparse, accessor, symbol, and malformed path rejection
7. missing-policy and default-value pairing enforcement
8. duplicate feature ID and non-canonical ordering rejection
9. descriptor-safe manifest object validation
10. minimal feature vector acceptance and reference preservation
11. finite numerical extraction from a validated section payload
12. Boolean true/false encoding as 1 and 0
13. nested object and array payload path traversal
14. USE_DEFAULT with wasMissing: true for absent sections, properties, and indexes
15. REJECT missing-source rejection
16. invalid intermediate container versus terminal type mismatch distinction
17. Phase 8C integration exactly once and invalid snapshot rejection without pre-validation access
18. deterministic canonical output and non-mutation of manifest or snapshot
19. odds contamination, provider concepts, prediction outputs, and prohibited vector field rejection
20. issue ordering, exact exports/imports, no Phase 8D import, no label access, and static architecture boundary

No it.each, test.each, dynamic registration, skipped tests, any types, TypeScript suppression comments, debug output, or private-helper exports are used.

## 29. Validation results

Focused validation results:

- Phase 8E: 20 tests in 1 file passed
- TypeScript passed
- git diff --check produced no output

## 30. Deferred work

Phase 8E does not implement a real production feature set.

Phase 8E does not create a training matrix.

Phase 8E does not join vectors with labels.

Phase 8E does not add routes, UI, persistence, provider adapters, or live ingestion.

## 31. Recommended next phase

Phase 8F — Implement the leakage-safe MLB training-matrix contract that joins validated feature vectors to official labels while preserving chronological splits and embargo boundaries.
