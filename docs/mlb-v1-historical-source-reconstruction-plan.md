# MLB V1 Historical Source Reconstruction Plan

## 1. Purpose and scope

This plan locks the exact semantics, ownership boundary, and implementation sequence for truthful MLB historical source reconstruction and labelled-dataset production. It applies only to regular-season official-final MLB games and remains permanently odds-blind. No sportsbook data, market information, model coefficients, probabilities, or monetary metrics may enter this pipeline.

The plan produces exactly one repository artifact:

```text
docs/mlb-v1-historical-source-reconstruction-plan.md
```

No production code, tests, or existing documentation is modified during this phase.

## 2. Accepted repository baseline

The following states are accepted from Phase 8V-A/A2/A3 and locked for the remainder of the project:

```text
REAL LIVE CANONICAL SNAPSHOT = COMPLETE
HISTORICAL SCHEDULE / GAME UNIVERSE SOURCE CAPABILITY = COMPLETE
OFFICIAL FINAL OUTCOME / LABEL SOURCE CAPABILITY = COMPLETE
HISTORICAL PITCHER AGGREGATES = AS_OF_SAFE_PROVEN
HISTORICAL TEAM AGGREGATES = AS_OF_SAFE_PROVEN
HISTORICAL PROBABLE STARTER TRUTH = AVAILABLE ONLY WHEN PROSPECTIVELY CAPTURED
HISTORICAL CANONICAL SNAPSHOT BUILDER = MISSING
HISTORICAL LABELLED DATASET BUILDER = MISSING
REAL FEATURE MANIFEST = MISSING
REAL TRAINING MATRIX = MISSING
TRAINER IMPLEMENTATION = EXISTS AND IS TESTED
TRAINER EXECUTED ON REAL MLB MATRIX = NO
LEGITIMATE TRAINED ARTIFACT = NO
PRODUCTION MODEL RELEASE = NO
REAL MODEL-BACKED INFERENCE = NO
```

## 3. Permanent odds-blind boundary

Historical reconstruction and all downstream training/evaluation/release/inference remain permanently odds-blind. The following are forbidden from every layer of this pipeline:

```text
sportsbook odds
moneylines
run lines
totals
betting prices
market-implied probabilities
market consensus
market movement
market comparison
value/edge
sportsbook-derived EV
closing-line value
Kelly based on sportsbook prices
ROI/profit as a model-training or release metric
```

Allowed inputs and labels are limited to official baseball data and historical game outcomes.

## 4. Existing source capabilities

Current repository primitives provide the following source capabilities for historical reconstruction:

### 4.1 Historical schedule universe

The schedule loader can query arbitrary historical MLB schedule dates, enumerate `gamePk` values, classify game status, identify `officialDate`, teams, and venue context. Season/year selection currently derives from the supplied cutoff using `cutoff.getUTCFullYear()`, requesting the full calendar-year range `YYYY-01-01` through `YYYY-12-31`.

Capability classification: `COMPLETE`
Prediction-dataset integration: `MISSING`

### 4.2 Official final outcomes

The outcome loader can obtain official final outcomes and winners from the MLB game feed endpoint. For `FINAL` games it derives `winner`, `homeScore`, `awayScore`, and `completedAt` via the last-completed-play-end proxy.

Capability classification: `COMPLETE`
Historical labelled-dataset integration: `MISSING`

### 4.3 Pitcher aggregate stats

The pitcher appearance source independently gathers historical appearances and aggregates only appearances whose actual completion occurs before the supplied cutoff. The aggregator filters by `appearance.completedAt.getTime() < cutoff.getTime()`. Same-day games completed after cutoff are excluded. Later games in the same season are excluded by `officialDate` calendar-date filtering and by `completedAt` filtering.

Classification: `AS_OF_SAFE_PROVEN`

### 4.4 Team aggregate stats

The team game source gathers game-level outcomes and the team aggregator filters by `game.completedAt.getTime() < cutoff.getTime()`. Future games after cutoff are excluded by `officialDate` filtering and by `completedAt` filtering.

Classification: `AS_OF_SAFE_PROVEN`

### 4.5 Season limitation

The current `cutoff.getUTCFullYear()` season-range selection does NOT block the initial single regular-season dataset. It does limit generality around offseason, spring training, cross-calendar-season workflows, and broader postseason/generalized reconstruction. This is classified as:

```text
NON_BLOCKING_INITIAL_DATASET_LIMITATION
```

## 5. Capability vs integration matrix

### 5.1 Source capabilities

| Capability | Status |
|------------|--------|
| Historical schedule querying | `CAPABILITY_COMPLETE` |
| Historical gamePk enumeration | `CAPABILITY_COMPLETE` |
| Historical status classification | `CAPABILITY_COMPLETE` |
| Official final outcome acquisition | `CAPABILITY_COMPLETE` |
| Historical probable-pitcher observation acquisition | `CAPABILITY_COMPLETE` (prospective capture only) |
| Historical pitcher aggregate reconstruction | `CAPABILITY_COMPLETE` |
| Historical team aggregate reconstruction | `CAPABILITY_COMPLETE` |

### 5.2 Prediction/model integration

| Integration | Status |
|-------------|--------|
| Canonical historical snapshot builder | `NOT_INTEGRATED` |
| Historical labelled dataset builder | `NOT_INTEGRATED` |
| Real feature manifest | `NOT_INTEGRATED` |
| Real training matrix from real rows | `NOT_INTEGRATED` |

The source-capability labels are independent from integration labels. A fully functioning source loader must not be downgraded merely because no prediction-owned builder consumes it.

## 6. Historical game eligibility

The first production reconstruction domain is deliberately bounded to eliminate ambiguity and leakage risk.

### 6.1 Eligible games

Only the following are eligible for historical reconstruction:

```text
gameType = regular season
official FINAL outcome required
non-tied final score required
distinct home and away team identities
scheduled start required
officialDate required
```

### 6.2 Excluded games

The following are excluded:

```text
cancelled
postponed without later distinct final game record
suspended/non-final
abandoned/no-contest
All-Star
spring training
postseason
games lacking authoritative final outcome
games with unresolved identity contradiction
```

### 6.3 Doubleheaders

Each `gamePk` is an independent game/example. Both games may be included when independently eligible. `gameNumber` remains source-authoritative. No sportsbook availability is used as an eligibility criterion.

## 7. Historical prediction-cutoff policy

No fixed lead-time policy (such as 24 hours before `scheduledStartAt`) exists anywhere in the repository. The plan must not silently adopt one.

### 7.1 Deterministic cutoff abstraction

Every reconstructed historical row must carry a deterministic `predictionCutoffAt` such that:

```text
predictionCutoffAt < scheduledStartAt
```

The `predictionCutoffAt` must be:

```text
explicit
versioned
deterministic
testable
independent of current wall clock
identical for equivalent reconstruction inputs
```

`Date.now()` must not be used to define historical prediction cutoff. The historical game's final state must not be used to choose the cutoff.

### 7.2 Chosen first policy

The initial implementation uses a **configurable lead-time parameter** (Policy A). The parameter is passed explicitly to the reconstruction layer, versioned in the plan, and documented in the dataset contract. A fixed lead time is not permanently assumed to be optimal for all future live prediction cadences; it is chosen solely as a bounded proof value.

## 8. Historical reconstruction-time vs pregame-time provenance

A historical game reconstructed today has at least two distinct time concepts that must never be conflated:

1. **Historical information availability / prediction cutoff** (`predictionCutoffAt`) — the moment before first pitch when predictors were allowed to know information.
2. **Present-day archival reconstruction/acquisition time** (`reconstructedAt`) — the actual wall-clock time when the reconstruction was performed today.

These concepts map to existing contract fields as follows:

| Field | Current meaning in live bridge | Suitability for historical reconstruction |
|-------|-------------------------------|------------------------------------------|
| `capturedAt` | max source `fetchedAt` (live acquisition time) | Must be explicitly set by the historical adapter to the predictor cutoff |
| `dataCutoffAt` | same as `capturedAt` in live bridge | Explicit predictor cutoff for historical snapshots |
| `sourceReferences.fetchedAt` | actual source fetch time | Truthfully records archival reconstruction time |
| `sourceReferences.sourceUpdatedAt` | source-side update time | Retain when available |
| `section.asOfAt` | information-as-of timestamp | Suitable for predictor-as-of semantics |
| `reconstructedAt` | not in pregame snapshot; exists in labelled-dataset metadata | Correct place for archival reconstruction timestamp |
| `label.finalizedAt` | `MLBHistoricalFinalLabel.finalizedAt` (required timestamp) | Must be bound to actual official-final time |
| `label.source.fetchedAt` | `MLBHistoricalFinalLabel.source.fetchedAt` (required timestamp) | Must record when the label was fetched during reconstruction |

### 8.1 Can the current canonical contract truthfully represent archival reconstruction?

```text
CURRENT_CANONICAL_CONTRACT_CAN_TRUTHFULLY_REPRESENT_ARCHIVAL_RECONSTRUCTION = YES
```

The existing `MLBCanonicalPregameSnapshot` contract does not need extension. A prediction-owned historical canonicalization adapter can construct a valid snapshot with explicitly injected pregame timestamps (`capturedAt` and `dataCutoffAt` set to the deterministic predictor cutoff) while the existing `MLBHistoricalReconstructionMetadata` separately owns the actual archival reconstruction time (`reconstructedAt`). The live bridge must not be called for historical reconstruction; the adapter constructs the snapshot directly.

### 8.2 Contract-change prerequisite

```text
CONTRACT_CHANGE_PREREQUISITE = NO
```

No snapshot contract extension is required. The existing `dataCutoffAt` field already serves as the predictor information cutoff when explicitly injected by the historical adapter. The existing `MLBHistoricalReconstructionMetadata` already owns `reconstructedAt`. The minimum implementation change is a new prediction-owned adapter, not a contract change.

### 8.3 Exact temporal validation matrix

Current validator rules from the committed source:

| Pair | Rule | Source |
|------|------|--------|
| `dataCutoffAt` < `capturedAt` | `A <= B` | `mlb-pregame-snapshot-contract.ts` |
| `capturedAt` < `scheduledStartAt` | `A < B` | `mlb-pregame-snapshot-contract.ts` |
| `sourceReferences[*].fetchedAt` vs other timestamps | no direct constraint | `mlb-pregame-snapshot-contract.ts` |
| `sourceReferences[*].sourceUpdatedAt` vs other timestamps | no direct constraint | `mlb-pregame-snapshot-contract.ts` |
| `sections[*].asOfAt` <= `dataCutoffAt` | `A <= B` | `mlb-pregame-snapshot-contract.ts` |
| `startingPitchers.*.announcedAt` <= `dataCutoffAt` | `A <= B` | `mlb-pregame-snapshot-contract.ts` |
| `reconstruction.cutoffAt` == `snapshot.dataCutoffAt` | `A == B` | `mlb-historical-labelled-dataset-contract.ts` |
| `reconstructedAt` >= `snapshot.capturedAt` | `A >= B` | `mlb-historical-labelled-dataset-contract.ts` |
| `reconstructedAt` <= `dataset.createdAt` | `A <= B` | `mlb-historical-labelled-dataset-contract.ts` |
| `label.finalizedAt` > `snapshot.game.scheduledStartAt` | `A > B` | `mlb-historical-labelled-dataset-contract.ts` |
| `label.finalizedAt` > `snapshot.dataCutoffAt` | `A > B` | `mlb-historical-labelled-dataset-contract.ts` |
| `label.source.fetchedAt` >= `label.finalizedAt` | `A >= B` | `mlb-historical-labelled-dataset-contract.ts` |
| `label.source.fetchedAt` <= `dataset.createdAt` | `A <= B` | `mlb-historical-labelled-dataset-contract.ts` |

### 8.4 Historical timestamp semantics

For the historical adapter:

- `dataCutoffAt` = explicit deterministic predictor cutoff (`predictionCutoffAt`), always `< scheduledStartAt`.
- `capturedAt` = explicit deterministic predictor cutoff (`predictionCutoffAt`), always `< scheduledStartAt` and `>= dataCutoffAt`.
- `sourceReferences[*].fetchedAt` = actual archival source acquisition time (today), never falsified to pregame time.
- `sourceReferences[*].sourceUpdatedAt` = source-side update time when available.
- `sections[*].asOfAt` = predictor information timestamp, must be `<= dataCutoffAt`.
- `reconstruction.cutoffAt` = explicit predictor cutoff, must equal `snapshot.dataCutoffAt`.
- `reconstruction.reconstructedAt` = actual archival reconstruction time (today), must be `>= snapshot.capturedAt` and `<= dataset.createdAt`.
- `label.finalizedAt` = actual official-final completion timestamp.
- `label.source.fetchedAt` = actual label acquisition time during reconstruction.

Invariants:

```text
predictor information cutoff < scheduledStartAt

section information used as predictors <= predictor cutoff

archival source fetch timestamps are NEVER falsified into pregame time

reconstruction time is NEVER pretended to be pregame

label finalization/fetch remains downstream of the game

live bridge semantics remain unchanged
```

### 8.5 Resolved `capturedAt` semantics

For live snapshots, `capturedAt` = max provenance `fetchedAt` (live acquisition time).
For historical snapshots, `capturedAt` = explicit deterministic predictor cutoff.
The historical adapter sets `capturedAt` directly; it is not derived from source fetch timestamps.
Historical validator rule: `capturedAt` must still satisfy the existing contract rule `capturedAt < scheduledStartAt`.
By setting `capturedAt = predictionCutoffAt` (which is `< scheduledStartAt`), the historical snapshot passes live-mode validation without falsifying acquisition time.

### 8.6 Resolved source-reference fetch semantics

`sourceReferences[*].fetchedAt` always records the actual acquisition time.
For live snapshots: actual live fetch time.
For historical snapshots: actual archival acquisition time (today).
No existing validator rule constrains `fetchedAt` relative to `capturedAt` or `dataCutoffAt`. The historical adapter must not backdate `fetchedAt` to satisfy any assumed historical constraint.

### 8.7 Future documentation manifest

Because 8V-C does not change the canonical snapshot contract:

- `docs/mlb-v1-pregame-snapshot-contract-implementation.md` = `NO_CHANGE_REQUIRED`. The contract type and validation rules remain identical.
- `docs/mlb-v1-real-data-prediction-bridge-plan.md` = `NO_CHANGE_REQUIRED`. The live bridge semantics are preserved.

The historical adapter behavior is documented in this plan and in the adapter's own implementation notes. No existing documentation requires modification.

### 8.8 Historical adapter output

`src/prediction/mlb/mlb-historical-canonical-snapshot-adapter.ts` must return:

```text
MLBCanonicalPregameSnapshot
```

The adapter constructs a valid canonical snapshot with explicitly injected pregame timestamps. It does not embed `reconstructedAt` or other reconstruction metadata inside the snapshot. Reconstruction timing remains owned by `MLBHistoricalReconstructionMetadata` in the labelled-dataset envelope.

The adapter must not call the live bridge. It must construct the snapshot directly from reusable primitives with explicit `dataCutoffAt` and `capturedAt` equal to the deterministic predictor cutoff.

### 8.9 Archival fetchedAt validation acceptance proof

The B3 temporal matrix correctly recorded:

```text
sourceReferences[*].fetchedAt vs other timestamps = no direct constraint
```

The re-audited canonical validator (`mlb-pregame-snapshot-contract.ts`) confirms:

```text
fetchedAt <= capturedAt = NO
```

The validator parses `fetchedAt` and `sourceUpdatedAt` but emits no ordering issue against `capturedAt` or `dataCutoffAt`. Therefore the following historical snapshot validates successfully against the committed standard validator without any profile parameter or contract extension:

```text
scheduledStartAt = 2024-06-15T20:00:00Z
dataCutoffAt      = 2024-06-15T16:00:00Z
capturedAt        = 2024-06-15T16:00:00Z
fetchedAt         = 2026-08-09T02:00:00Z
```

Rule evaluation:

```text
dataCutoffAt <= capturedAt -> 2024-06-15T16:00:00Z <= 2024-06-15T16:00:00Z -> PASS
capturedAt < scheduledStartAt -> 2024-06-15T16:00:00Z < 2024-06-15T20:00:00Z -> PASS
fetchedAt <= capturedAt -> NO RULE ENFORCED -> NO ISSUE
```

Backdating archival `fetchedAt` to 2024 is forbidden because it would falsify the actual acquisition timestamp. The existing validator does not require backdating.

### 8.10 Historical validation architecture

No validator/API change is required.

```text
HISTORICAL_VALIDATION_ARCHITECTURE = NONE_REQUIRED
```

The standard `validateMLBCanonicalPregameSnapshot` already accepts both:
- live snapshots with `fetchedAt` equal to live acquisition time
- historical snapshots with `fetchedAt` equal to archival acquisition time

The same structural rules apply to both modes:
- `dataCutoffAt <= capturedAt`
- `capturedAt < scheduledStartAt`
- `sections[*].asOfAt <= dataCutoffAt`
- `startingPitchers.*.announcedAt <= dataCutoffAt`

The only historical difference is the *truthful origin* of timestamp values, not a different validation path. The adapter sets `dataCutoffAt`/`capturedAt` to the deterministic predictor cutoff and `fetchedAt` to actual archival acquisition time.

### 8.11 Dataset validator integration

`src/prediction/mlb/mlb-historical-labelled-dataset-contract.ts` already calls:

```text
validateMLBCanonicalPregameSnapshot(snapshotResult.value)
```

No change is required. The existing validator accepts the truthful historical snapshot shape. The dataset contract does not need a separate historical snapshot validator.

### 8.12 Phase 8V-C test matrix

Permanent regression tests must prove:

#### Standard/live profile

```text
live fetchedAt <= capturedAt accepted
live fetchedAt > capturedAt rejected (if such a rule is ever added)
capturedAt >= scheduledStartAt rejected
sourceUpdatedAt > dataCutoffAt rejected (if such a rule is ever added)
section.asOfAt > dataCutoffAt rejected
announcedAt > dataCutoffAt rejected
```

#### Historical profile

```text
historical dataCutoffAt < scheduledStartAt accepted
historical capturedAt < scheduledStartAt accepted
historical archival fetchedAt > capturedAt accepted
historical archival fetchedAt after game accepted
historical sourceUpdatedAt > dataCutoffAt still rejected (if rule exists)
historical section.asOfAt > dataCutoffAt still rejected
historical announcedAt > dataCutoffAt still rejected
```

#### Dataset integration

```text
historical dataset accepts truthful:
  2024 snapshot cutoff/capture
  2026 archival fetchedAt
  2026 reconstructedAt

standard/live validator still accepts that same
snapshot (no profile flag needed)
```

#### Adapter

```text
actual archival fetchedAt preserved
no timestamp backdating
dataCutoffAt deterministic
capturedAt deterministic
reconstructedAt not embedded in snapshot
caller inputs unmodified
equivalent inputs -> equivalent logical snapshot
no network
no model/probability/recommendation logic
odds-blind
```

## 9. Probable-starter truth policy

Arbitrary old-game probable starter state cannot currently be reconstructed from an archival source. The existing observation store captures probable pitchers only for games whose probable starters were captured prospectively before the game (`PROSPECTIVE_LIVE` context).

### 9.1 Forbidden substitutions

The following are explicitly forbidden:

```text
using the actual/final starting pitcher as a substitute for "probable pitcher known at prediction cutoff"
inferring a probable starter from the final box score
inferring a probable starter from who eventually started
using post-cutoff announcement data
```

### 9.2 Truthful states

| State | Meaning |
|-------|---------|
| `PROSPECTIVELY_CAPTURED_PROBABLE_STARTER` | An observation store entry exists with `observedAt <= predictionCutoffAt` and eligible provenance |
| `ARCHIVALLY_RECONSTRUCTABLE_STARTER` | Not currently available for arbitrary historical games |
| `FINAL_ACTUAL_STARTER` | Forbidden as predictor input |
| `UNKNOWN_AT_CUTOFF` | Correct truthful state when no prospective capture exists |

Pitcher aggregate stats requiring a pitcher identity may only be populated if that identity was legitimately available by `predictionCutoffAt`.

## 10. Pitcher aggregate as-of policy

For pitcher aggregates, document the exact accepted rule:

```text
include only historical appearances completed before predictionCutoffAt
exclude target game
exclude same-day game completed after cutoff
exclude all later games
aggregate locally from game-level observations
do not consume final/full-season aggregate endpoint as a shortcut
```

The resulting aggregate may be described as:

```text
season-to-cutoff
```

not:

```text
full-season
```

This is pregame-safe.

Document the current calendar-year limitation separately.

## 11. Team aggregate as-of policy

For team aggregates:

```text
include only games completed before predictionCutoffAt
exclude target game
exclude same-day game completed after cutoff
exclude all later games
aggregate locally from game-level outcomes
```

The resulting aggregate may be described as:

```text
season-to-cutoff
```

not:

```text
full-season
```

This is pregame-safe.

Document the current calendar-year limitation separately.

## 12. Historical canonical snapshot composition

For each eligible historical game, the prediction-owned reconstruction layer must construct a canonical snapshot with the following fields:

### 12.1 Game identity

```text
gameId
officialDate
scheduledStartAt
homeTeamId
awayTeamId
homeTeamName
awayTeamName
venueId
venueName
neutralSite truth state
doubleheader identity / gameNumber
gameType = REGULAR_SEASON
pregame status representation (SCHEDULED or PRE_GAME)
```

### 12.2 Predictor data

```text
team aggregates as of cutoff (home and away)
pitcher identity if truthfully known
pitcher aggregates if truthfully derivable
availability states
data completeness
warnings
sections
source provenance
```

### 12.3 Provenance and timing

```text
dataCutoffAt — explicit deterministic predictor cutoff (predictionCutoffAt)
capturedAt — explicit deterministic predictor cutoff (predictionCutoffAt)
reconstructedAt — actual archival reconstruction time (in reconstruction metadata)
sourceReferences — each with actual fetchedAt and sourceUpdatedAt
```

### 12.4 Composition decision

The live `buildMLBRealDataPregameSnapshot` bridge must **not** be reused directly for historical reconstruction because it derives `capturedAt`/`dataCutoffAt` from live fetch timestamps.

Instead, the implementation must build a **prediction-owned historical canonicalization adapter** that:

- Reuses clean primitive interfaces from the live-history layer (schedule loader, outcome loader, pitcher appearance source, pitcher aggregator, team game source, team aggregator)
- Constructs `MLBCanonicalPregameSnapshot` with explicit `dataCutoffAt` and `capturedAt` set to the deterministic predictor cutoff
- Records archival reconstruction time in `MLBHistoricalReconstructionMetadata.reconstructedAt`, not in the canonical snapshot
- Validates the output against the existing `validateMLBCanonicalPregameSnapshot` contract

No snapshot contract extension is required. The existing `reconstruction.cutoffAt == snapshot.dataCutoffAt` rule already binds the predictor cutoff to the snapshot.

## 13. Final outcome label boundary

The label must be independent from predictors.

### 13.1 Label fields

```text
gameId binding — deterministic, identical to snapshot gameId
winnerTeamId
homeRuns
awayRuns
finalizedAt — official-final timestamp from authoritative outcome source
source — MLBHistoricalFinalLabelSource with fetchedAt recording when the label was acquired during reconstruction
```

### 13.2 Predictor prohibition

Predictors must never read:

```text
winner
final score
postgame statistics
outcome completion values
```

The label joins to the snapshot by deterministic game identity only.

### 13.3 Construction sequence

```text
historical source reconstruction
        ↓
canonical historical snapshots
        ↓
official labels
        ↓
MLBHistoricalLabelledDataset
        ↓
feature manifest
        ↓
training matrix
```

No feature selection is embedded into source ingestion.

## 14. MLBHistoricalLabelledDataset row construction

The existing `MLBHistoricalLabelledDataset` contract already defines:

```text
datasetId
examples[]
exampleId
snapshot (MLBCanonicalPregameSnapshot)
reconstruction (MLBHistoricalReconstructionMetadata with cutoffAt and reconstructedAt)
label (MLBHistoricalFinalLabel)
```

The future builder must map reconstructed rows exactly to this contract.

### 14.1 Required row fields

```text
exampleId — deterministic per row
snapshot — canonical historical snapshot
reconstruction.mode = POINT_IN_TIME_AS_OF_CUTOFF
reconstruction.cutoffAt = predictionCutoffAt
reconstruction.reconstructedAt = archival reconstruction time
label.status = OFFICIAL_FINAL
label.target = OFFICIAL_FINAL_GAME_WINNER
label.finalizedAt = official final completion timestamp
label.source.fetchedAt = when the label was fetched during reconstruction
```

### 14.2 Deterministic ordering and deduplication

Rows must be ordered deterministically by `officialDate` then `gameId`. Duplicate `gameId` entries are excluded. Row exclusion reasons must be recorded in dataset warnings, not silently dropped.

## 15. Missing-data policy

Historical data does not need to be artificially complete.

### 15.1 Classification

| Classification | Meaning |
|----------------|---------|
| `REQUIRED_IDENTITY_DATA` | Missing causes row invalidity |
| `OPTIONAL_PREGAME_PREDICTOR_DATA` | Missing is valid; row may still be used |
| `UNAVAILABLE_BUT_VALID` | Missing factual state is truthful |
| `ROW_INVALID` | Missing required data makes the row unusable |

### 15.2 Required identity data

```text
game identity (gameId)
officialDate
scheduledStartAt
homeTeamId
awayTeamId
eligible final outcome
```

### 15.3 Potentially unavailable but valid

```text
probable pitcher
pitcher aggregate
venue subsection details
other optional research sections
```

A historical row must not be dropped solely because a future optional feature is missing unless the owning contract requires it. Values must not be fabricated. Unknown factual states must not be converted to false/zero unless an explicit later feature missing-policy does so at feature extraction time.

## 16. Provider ownership and reuse boundary

Carrying forward the A3 decision:

```text
HISTORICAL_PROVIDER_REUSE_DECISION = REUSE_SELECTED_PRIMITIVES_VIA_PREDICTION_ADAPTER
```

### 16.1 Reusable primitives

The following primitives are safe to reuse via prediction-owned adapter imports:

```text
schedule loader interfaces
outcome loader interfaces
pitcher appearance source
pitcher aggregator
team game source
team aggregator
historical date helpers
HTTP client primitives
cache interfaces
```

### 16.2 Non-reusable backtesting-coupled modules

The following must not become direct production dependencies:

```text
backtesting orchestrator
backtesting runner
fixture provider
backtesting-specific snapshot types
provider/factory behavior that exists only for backtest observation capture
pregame-pitcher-observation-store (prospective-live capture only)
```

### 16.3 Import-path decision

Existing reusable primitives remain under `src/lib/backtesting/mlb/live-history/`. For the initial implementation, temporary direct reuse via prediction-owned adapters is acceptable. The plan does not require immediate extraction to a shared layer. Extraction may be revisited in a later phase if coupling proves problematic.

## 17. Deterministic identity policy

Deterministic IDs must be derived from canonical source data and equivalent cutoff policy. Equivalent inputs must reconstruct equivalent identities.

### 17.1 Prohibited ID sources

```text
random UUID
Date.now-based IDs
locale-dependent IDs
filesystem-order-dependent IDs
```

### 17.2 Required identity bindings

| Artifact | Identity binding |
|----------|------------------|
| Historical reconstruction artifact | Deterministic hash or composition of dataset identity fields |
| Historical canonical snapshot | `snapshotId` derived from `gameId`, `dataCutoffAt`, and contract version |
| Label | Bound to snapshot `gameId` |
| Dataset | `datasetId` derived from `datasetId` composition formula |
| Example/row | `exampleId` derived from `gameId` and `split` |

Prefer existing deterministic identity helpers/contracts where already defined.

## 18. Initial real-data proof slice

The first implementation after this plan must prove real historical reconstruction, not train the final model.

### 18.1 Bounded proof window

One implementation proof window must be selected. It must be small enough for deterministic integration testing and bounded smoke work. The proof window must be explicitly labelled `IMPLEMENTATION_PROOF_WINDOW` and must not be declared the final model-training corpus.

### 18.2 Required proof-slice components

```text
real MLB schedule source
real MLB outcome source
real pre-cutoff aggregate reconstruction
real canonical historical snapshot(s)
real official labels
```

### 18.3 Test separation

```text
UNIT/CONTRACT TEST DATA — deterministic, offline, via recorded fixtures or injected source doubles
REAL NETWORK SMOKE DATA — separately bounded, not in permanent unit test suite
FULL DATASET MATERIALIZATION — future phase, not proof slice
FINAL MODEL TRAINING CORPUS — future phase, not proof slice
```

Permanent tests must remain deterministic and offline.

## 19. Implementation sequence

Implementation must proceed in narrow, bounded slices. No slice may skip prerequisites.

### 19.1 Slice 1: Historical provenance contract prerequisite

| Attribute | Value |
|-----------|-------|
| Phase name | 8V-C |
| Goal | Construct truthful `MLBCanonicalPregameSnapshot` for historical games via a prediction-owned adapter that explicitly sets pregame timestamps, enabling truthful historical snapshots |
| Files to READ | `src/prediction/mlb/mlb-pregame-snapshot-contract.ts`, `src/prediction/mlb/mlb-real-data-pregame-snapshot-bridge.ts`, `src/prediction/mlb/mlb-historical-labelled-dataset-contract.ts` |
| Files to MODIFY | None |
| Files that must remain unchanged | `src/prediction/mlb/mlb-pregame-snapshot-contract.ts`, `src/prediction/mlb/mlb-real-data-pregame-snapshot-bridge.ts` |
| Files to CREATE | `src/prediction/mlb/mlb-historical-canonical-snapshot-adapter.ts` |
| Regression test updates | `tests/prediction/mlb/mlb-pregame-snapshot-contract.test.ts`, `tests/prediction/mlb/mlb-real-data-pregame-snapshot-bridge.test.ts` |
| Adapter tests | `tests/prediction/mlb/mlb-historical-canonical-snapshot-adapter.test.ts` |
| Network use permitted? | `no` |
| Artifact produced | Historical canonicalization adapter; existing snapshot contract reused unchanged |
| Stop conditions | Contract validates both live and historical snapshots; adapter produces truthful predictor cutoff and reconstruction timing without fabricating fetch times |
| Commit boundary | `yes` (after review) |
| Test matrix | See section 8.12 |

### 19.2 Slice 2: Historical labelled-dataset builder

| Attribute | Value |
|-----------|-------|
| Phase name | 8V-D |
| Goal | Construct `MLBHistoricalLabelledDataset` from eligible historical games using the adapter from 8V-C |
| Files to READ | All slice-1 artifacts plus `src/lib/backtesting/mlb/live-history/pitcher-appearance-source.ts`, `src/lib/backtesting/mlb/live-history/pitcher-aggregator.ts`, `src/lib/backtesting/mlb/live-history/team-game-source.ts`, `src/lib/backtesting/mlb/live-history/team-aggregator.ts` |
| Files to MODIFY | None (prediction-owned builder in new file) |
| Files to CREATE | `src/prediction/mlb/mlb-historical-labelled-dataset-builder.ts` |
| Tests | Deterministic builder tests with injected source doubles; bounded smoke test for one proof-window date |
| Network use permitted? | `yes` (bounded smoke only; permanent tests offline) |
| Artifact produced | `MLBHistoricalLabelledDataset` for proof window |
| Stop conditions | Dataset validates against existing contract; all rows have truthful provenance |
| Commit boundary | `yes` (after review) |

### 19.3 Slice 3: Feature manifest

| Attribute | Value |
|-----------|-------|
| Phase name | 8V-E |
| Goal | Define real feature manifest mapping canonical snapshot sections to model feature vector fields |
| Files to READ | Snapshot adapter, dataset contract, feature vector contract |
| Files to MODIFY | `src/prediction/mlb/mlb-feature-vector-contract.ts` (manifest schema) |
| Files to CREATE | `src/prediction/mlb/mlb-real-feature-manifest.ts` |
| Tests | Manifest contract tests |
| Network use permitted? | `no` |
| Artifact produced | Feature manifest schema and proof-window manifest |
| Commit boundary | `yes` (after review) |

### 19.4 Slice 4: Real training matrix

| Attribute | Value |
|-----------|-------|
| Phase name | 8V-F |
| Goal | Materialize training matrix from real labelled-dataset rows and real feature manifest |
| Files to READ | Dataset builder, feature manifest, trainer contract |
| Files to MODIFY | None (new matrix builder) |
| Files to CREATE | `src/prediction/mlb/mlb-real-training-matrix.ts` |
| Tests | Matrix contract tests with deterministic fixtures |
| Network use permitted? | `no` |
| Artifact produced | Real training matrix for proof window |
| Commit boundary | `yes` (after review) |

### 19.5 Slice 5: Real training/evaluation

| Attribute | Value |
|-----------|-------|
| Phase name | 8V-G |
| Goal | Execute trainer on real MLB training matrix; evaluate with proper scoring rules only |
| Files to READ | Trainer contract, training matrix, evaluation harness |
| Files to MODIFY | None (execute existing trainer) |
| Files to CREATE | `src/prediction/mlb/mlb-real-training-run.ts` |
| Tests | Evaluation contract tests; no live-network training in permanent suite |
| Network use permitted? | `no` (training uses pre-built matrix) |
| Artifact produced | Trained model coefficients, evaluation metrics (log loss, Brier score, accuracy) |
| Commit boundary | `yes` (after review) |

### 19.6 Slice 6: Artifact, release, and inference

| Attribute | Value |
|-----------|-------|
| Phase name | 8V-H |
| Goal | Release trained artifact; wire model-backed inference into live orchestration |
| Files to READ | Inference contract, bridge, prediction contract |
| Files to MODIFY | Inference layer, live orchestration |
| Files to CREATE | Release manifest, inference integration tests |
| Tests | End-to-end deterministic inference tests |
| Network use permitted? | `no` |
| Artifact produced | Released model, inference-ready prediction path |
| Commit boundary | `yes` (after review) |

## 20. Exact immediate next implementation manifest

The immediate implementation phase after 8V-B is **8V-C**.

| Attribute | Value |
|-----------|-------|
| IMMEDIATE NEXT IMPLEMENTATION PHASE | 8V-C |
| PURPOSE | Build a prediction-owned historical canonicalization adapter that explicitly sets pregame timestamps in `MLBCanonicalPregameSnapshot`, keeping `reconstructedAt` in reconstruction metadata; no canonical validator change required |
| READ | `src/prediction/mlb/mlb-pregame-snapshot-contract.ts`, `src/prediction/mlb/mlb-real-data-pregame-snapshot-bridge.ts`, `src/prediction/mlb/mlb-historical-labelled-dataset-contract.ts`, `docs/mlb-v1-pregame-snapshot-contract-implementation.md`, `docs/mlb-v1-real-data-prediction-bridge-plan.md` |
| MODIFY | None |
| CREATE | `src/prediction/mlb/mlb-historical-canonical-snapshot-adapter.ts`, `tests/prediction/mlb/mlb-historical-canonical-snapshot-adapter.test.ts` |
| REGRESSION_TEST_ONLY | `tests/prediction/mlb/mlb-pregame-snapshot-contract.test.ts`, `tests/prediction/mlb/mlb-real-data-pregame-snapshot-bridge.test.ts` |
| MUST_REMAIN_UNCHANGED | `src/prediction/mlb/mlb-pregame-snapshot-contract.ts`, `src/prediction/mlb/mlb-real-data-pregame-snapshot-bridge.ts`, `src/prediction/mlb/mlb-historical-labelled-dataset-contract.ts`, `tests/prediction/mlb/mlb-historical-labelled-dataset-contract.test.ts` |
| NETWORK USE | `no` |
| EXPECTED ARTIFACT | Prediction-owned historical canonicalization adapter that produces `MLBCanonicalPregameSnapshot` with truthful predictor cutoff and separate reconstruction metadata |
| COMMIT BOUNDARY | `yes` (after ChatGPT review) |
| HISTORICAL VALIDATION ARCHITECTURE | NONE_REQUIRED |
| TEST MATRIX | See section 8.12 |

## 21. Blocker table

| Capability | Current state | Next required action | Blocking real labelled dataset? | Blocking model training? |
|------------|---------------|----------------------|---------------------------------|--------------------------|
| Historical schedule enumeration | `COMPLETE` | Integration via adapter | No | No |
| Official final outcomes | `COMPLETE` | Integration via adapter | No | No |
| Probable starter history | `COMPLETE` (prospective only) | Truthful policy enforcement in adapter | Yes (for games without prospective capture) | Yes (if pitcher features required) |
| Pitcher as-of aggregates | `AS_OF_SAFE_PROVEN` | Wrap in prediction-owned adapter | No | No |
| Team as-of aggregates | `AS_OF_SAFE_PROVEN` | Wrap in prediction-owned adapter | No | No |
| Historical temporal/provenance representation | `MISSING` | Truthful representation in prediction-owned historical adapter; no canonical contract change required | Yes | Yes |
| Historical canonical snapshot builder | `MISSING` | Build in 8V-C | Yes | Yes |
| Historical labelled dataset builder | `MISSING` | Build in 8V-D | Yes | Yes |
| Real feature manifest | `MISSING` | Build in 8V-E | No | Yes |
| Training matrix | `MISSING` | Build in 8V-F | No | Yes |
| Trainer | `IMPLEMENTED_AND_TESTED_SYNTHETIC_ONLY` | Execute on real matrix in 8V-G | No | Yes |
| Artifact | `MISSING` | Produce in 8V-G/H | No | Yes |
| Release | `MISSING` | Produce in 8V-H | No | Yes |
| Inference | `MISSING` | Produce in 8V-H | No | Yes |

## 22. Explicit non-goals

This plan and its immediate implementation slices explicitly exclude:

```text
no model training
no feature selection
no model coefficients
no probabilities
no predicted winners
no 8K→8P orchestration
no sportsbook/market information
no live snapshot bridge modification beyond what is strictly required for provenance
no backtesting runner coupling
no retroactive probable-starter fabrication from final box scores
```

## 23. External event history

Phase 8V-B external events:

- `design-only-phase-pass/SKILL.md` patched ×1

This occurred outside `/Users/samkassirov/multi-research-engine` and does not alter repository Git scope.

Phase 8V-B2 external events:

- None

Phase 8V-B3 external events:

- None

Phase 8V-B4 external events:

- None
