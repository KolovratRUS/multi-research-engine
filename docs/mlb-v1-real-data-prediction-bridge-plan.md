# MLB V1 Real-Data Prediction Bridge Plan

## 1. Phase status

This is a one-document architecture-planning phase for the first production break identified in the accepted Phase 8T-A roadmap audit:

```text
src/lib/research-data/mlb/
and
src/lib/research/mlb/
are not connected to:
src/prediction/mlb/
```

Phase 8U-A2 repairs two architecture defects in the Phase 8U-A plan. It does not edit production code, tests, README, or Prisma. It produces exactly one planning document: `docs/mlb-v1-real-data-prediction-bridge-plan.md`.

## 2. Parent baseline

Locked baseline: `a02bafec9d1b2e3b3c93ea80b0b70d695062b214` ("Implement MLB offline performance aggregation").
Branch: `main`.
Working tree: clean at baseline.

## 3. Evidence from Phase 8T-A

Accepted evidence:

- Capability A (real MLB source-data ingestion): PARTIALLY_IMPLEMENTED. `src/lib/research-data/mlb/stats-api-client.ts`, `provider.ts`, and `fixture-provider.ts` can fetch live MLB schedule, probable pitchers, season stats, game logs, team stats, venue, and weather. `src/lib/research/mlb/module.ts` orchestrates research snapshots.
- Capabilities B, F–M (prediction/recommendation/grading/performance contracts): IMPLEMENTED_AND_TESTED as offline deterministic contracts.
- Capability K (official-final-game outcome contract): IMPLEMENTED_AND_TESTED as an offline contract; live outcome ingestion remains MISSING.
- Capabilities N–Y (persistence, orchestration, API, UI, deployment): NOT_FOUND.
- First critical break: live research-data subsystem and prediction subsystem are architecturally isolated.

## 4. Purpose

Plan the deterministic, odds-blind bridge that transforms live MLB research data into validated prediction-side inputs and, ultimately, real Phase 8J pregame inference artifacts. Close the first production break without implementing downstream Phase 8K–8P recommendation orchestration, persistence, UI, or scheduling.

## 5. Permanent odds-blind boundary

The bridge may consume/use:

```text
real MLB schedules
game identity
teams
probable/confirmed pitchers
player/team baseball statistics
recent form
venue information
availability/completeness metadata
model inputs/features
model-generated probabilities
model-generated winner selections
```

The bridge must NEVER consume, derive from, or inspect:

```text
sportsbook odds
sportsbook prices
betting lines
market-implied probabilities
market consensus
market movement
market comparisons
value/edge
sportsbook-derived EV
closing-line value
```

Downstream phases may continue to produce predicted winners, model probabilities, recommendations, multis, and odds-independent risk/staking guidance. The odds-blind boundary does not disable those project outputs.

## 6. Existing live research-data architecture

### 6.1 Provider surface

`src/lib/research-data/mlb/provider.ts` exposes:

```text
fetchSchedule(date: string): Promise<MLBScheduleResult>
fetchProbablePitchers(gamePk: number, schedulePitchers?: SchedulePitcherContext): Promise<ProbablePitchersResult>
fetchPitcherSeasonStats(personId: number, season: number): Promise<PitcherSeasonStatsResult>
fetchPitcherRecentStarts(personId: number, season: number, limit: number): Promise<PitcherRecentFormResult>
fetchTeamBattingStats(teamId: number, season: number): Promise<TeamBattingStatsResult>
fetchTeamPitchingStats(teamId: number, season: number): Promise<TeamPitchingStatsResult>
fetchVenue(venueId: number): Promise<MLBVenue>
```

### 6.2 Snapshot shape

`src/lib/research/mlb/module.ts` assembles `MLBGameResearchSnapshot` containing:

```text
event.id / externalId / sport / league / leagueSlug
event.homeTeam / awayTeam / homeTeamSlug / awayTeamSlug
event.startTimeUtc (Date)
event.status (UPCOMING | LIVE | FINAL | POSTPONED | CANCELLED)
event.homeScore / awayScore
event.createdAt / updatedAt
probablePitchers.home / away (PitcherAssignment | null)
pitcherStats.home / away (PitcherResearchProfile | null)
teamBatting.home / away (TeamBattingProfile | null)
bullpen.home / away (BullpenProfile | null)
venue (MLBVenue | null)
weather (GameWeather | null)
completeness (number 0–100)
warnings (string[])
provenance (DataProvenance[])
generatedAt (Date)
```

### 6.3 Schedule game shape

`src/lib/research-data/types.ts` defines `MLBScheduleGame` containing:

```text
gamePk
officialDate
gameDate
startTimeUtc (Date)
status
homeTeamId (number)
homeTeamName
awayTeamId (number)
awayTeamName
venueId (number)
venueName
dayNight
scheduledInnings
doubleHeader (string)
seriesGameNumber
gamesInSeries
seriesDescription
leagueRecord
probablePitchers
```

### 6.4 Canonical input determination

There is NO existing repository-native type that packages both `MLBScheduleGame` and `MLBGameResearchSnapshot` together. `MLBModule.buildSnapshot(game: MLBScheduleGame, ...)` receives them separately and returns only `MLBGameResearchSnapshot`.

Therefore the narrowest self-contained deterministic bridge input is the explicit composition:

```ts
Readonly<{
  scheduleGame: MLBScheduleGame;
  researchSnapshot: MLBGameResearchSnapshot;
}>
```

This composition is required because:

- `officialDate` exists on `MLBScheduleGame` but NOT on `MLBGameResearchSnapshot.event`.
- `scheduledStartAt` can be derived from `MLBScheduleGame.startTimeUtc`.
- `gameId`, `homeTeamId`, `awayTeamId` exist on both types but the schedule game carries the authoritative canonical identifiers.
- `researchSnapshot` carries all research data, source metadata, completeness, warnings, and derived sections.

The bridge must not fetch schedule data internally. The caller (existing research provider/module) must supply the schedule game alongside the snapshot.

## 7. Existing prediction-side architecture

### 7.1 Entry contract

`src/prediction/mlb/mlb-prediction-contract.ts` defines `MLBPredictionInputContract`:

```text
contractVersion: 'mlb-prediction-input-v1'
sport: 'MLB'
target: 'OFFICIAL_FINAL_GAME_WINNER'
game: { gameId, scheduledStartAt, homeTeamId, awayTeamId, venueId, neutralSite, doubleheader }
snapshot: { snapshotId, capturedAt, dataCutoffAt, sourceUpdatedAt, dataCompleteness }
availability: { homeStartingPitcher, awayStartingPitcher }
researchPayload: Record<string, unknown>
```

### 7.2 Canonical snapshot contract

`src/prediction/mlb/mlb-pregame-snapshot-contract.ts` defines `MLBCanonicalPregameSnapshot`:

```text
contractVersion, sport, target
snapshotId, capturedAt, dataCutoffAt
game: { gameId, scheduledStartAt, officialDate, season, gameType, status, homeTeamId, awayTeamId, venueId, neutralSite, doubleheader }
startingPitchers: { home, away } (with state, pitcherId, announcedAt, sourceRefIds)
sourceReferences: readonly MLBPregameSourceReference[]
sections: readonly MLBPregameSnapshotSection[]
dataCompleteness
warnings
```

### 7.3 Boundary gap

`MLBPredictionInputContract` lacks:
- `officialDate` (required by Phase 8J inference)
- `season`
- structured `startingPitchers` detail (only coarse `availability` states)
- `sourceReferences`
- `sections`
- `warnings`

The prediction-side entry contract is a reduced view. The canonical snapshot is the only existing validated representation that safely carries all live-data fields.

## 8. Existing model/probability-generation architecture

### 8.1 Backtesting scorers

`src/lib/backtesting/mlb/exploratory-scorer.ts` exports `computeExploratoryScore(snapshot, config)` which returns:

```text
predictedSide: 'HOME' | 'AWAY' | null
researchStrengthScore: number
confidence: number
dataQuality: number
volatility
componentScores
warnings
abstained / abstentionReason
```

`src/lib/backtesting/mlb/team-only-scorer.ts` exports `computeTeamOnlyScore(snapshot, config)` with the same shape.

### 8.2 Logistic regression fit contract

`src/prediction/mlb/mlb-logistic-regression-fit-contract.ts` validates model fit results and contains `stableSigmoid(score)` as a pure helper. It does not load or expose production coefficients.

### 8.3 Coefficient artifacts

No coefficient files (JSON, CSV, or TS with embedded vectors) exist under `src/`. The only model-artifact contracts are type-level validators for `MLBModelReleaseRecord`, `MLBModelTestReleaseResult`, etc. No loaded coefficient matrix, intercept vector, or config file is present.

### 8.4 Model lifecycle re-audit

1. Can the repository already FIT an actual logistic regression model, or does it only validate a caller-supplied fit artifact?
   - CONTRACT_EXISTS only. `validateMLBModelFitValidationResult` and `evaluateAndReleaseMLBDeterministicModel` validate caller-supplied artifacts. No fit runner or optimizer exists in the repo.

2. Can the repository already MATERIALIZE a production model release with coefficients?
   - CONTRACT_EXISTS only. `validateMLBModelReleaseRecord` validates a release record. No module writes or materializes a release artifact.

3. Is any tested/accepted fitted coefficient set currently committed?
   - NO. No coefficient files or committed fitted model artifacts exist.

4. Is there an existing training dataset / feature matrix that can legitimately produce the first MLB V1 model release?
   - CONTRACT_EXISTS only. `validateMLBTrainingMatrix` and `validateMLBHistoricalLabelledDataset` validate caller-supplied matrices/datasets. No committed training dataset or feature matrix exists in the repository.

5. What evaluation/holdout/release gates already exist?
   - CONTRACT_EXISTS only. `MLBModelTestReleaseResult`, `MLBModelReleaseRecord`, and `evaluateAndReleaseMLBDeterministicModel` define and validate gates: fit validation, evaluation plan, training matrix, consistency checks, TEST split variation. No implementation produces these artifacts.

6. Which module currently owns probability calibration, if any?
   - NONE. No module calibrates probabilities. `stableSigmoid` is a pure mathematical helper inside validation contracts. Backtesting scorers produce `researchStrengthScore` and `predictedSide`, not calibrated probabilities.

7. What is missing between historical training/backtesting data and a production Phase 8J probability engine?
   - A trained/released model artifact with legitimate coefficients, plus a deterministic scoring runtime that applies those coefficients to extracted feature vectors to produce `homeWinProbability` / `awayWinProbability`.

## 9. Boundary mapping matrix

| Prediction requirement | Bridge input source field | Transform needed? | Deterministic? | Missing? | Failure / availability behavior |
|---|---|---|---|---|---|
| gameId | `scheduleGame.gamePk` | Yes: number → string (`game-${id}`) | Yes | No | FAIL_CLOSED if missing |
| officialDate | `scheduleGame.officialDate` | Yes: copy exact string | Yes | No | FAIL_CLOSED if missing |
| scheduledStartAt | `scheduleGame.startTimeUtc` | Yes: Date → RFC3339 | Yes | No | FAIL_CLOSED if missing |
| homeTeamId | `scheduleGame.homeTeamId` | Yes: number → string | Yes | No | FAIL_CLOSED if missing |
| awayTeamId | `scheduleGame.awayTeamId` | Yes: number → string | Yes | No | FAIL_CLOSED if missing |
| snapshotId | Bridge-generated | Deterministic: `${gameId}::${dataCutoffAtMs}::pregame-snapshot-v1` | Yes | N/A | Auto-generated |
| capturedAt | `researchSnapshot.provenance[0].fetchedAt` | Yes: Date → RFC3339 | Yes | No | FAIL_CLOSED if no provenance |
| dataCutoffAt | Latest provider fetchedAt in snapshot provenance | Yes: Date → RFC3339 | Yes | No | EXPLICIT_UNAVAILABLE if no provenance |
| sourceUpdatedAt | `researchSnapshot.event.updatedAt` | Yes: Date → RFC3339 | Yes | No | NULL if absent |
| dataCompleteness | `researchSnapshot.completeness` (0–100) | Map: 100→COMPLETE, 1–99→PARTIAL, 0→INSUFFICIENT | Yes | No | EXPLICIT_UNAVAILABLE if completeness missing |
| homeStartingPitcher | `researchSnapshot.probablePitchers.home` | Map `PitcherAssignment` → `MLBAvailabilityState` | Yes | Yes | EXPLICIT_UNAVAILABLE_STATE if null |
| awayStartingPitcher | `researchSnapshot.probablePitchers.away` | Map `PitcherAssignment` → `MLBAvailabilityState` | Yes | Yes | EXPLICIT_UNAVAILABLE_STATE if null |
| venueId | `scheduleGame.venueId` | Yes: number → string | Yes | Yes | NULL if venue absent |
| neutralSite | Not in research/schedule types | Deterministic fallback: false | Yes | Yes | SAFE_FALLBACK_ALLOWED: false |
| doubleheader | `scheduleGame.doubleHeader` | Map string → canonical object | Yes | Yes | FAIL_CLOSED if ambiguous |
| season | `scheduleGame.gameDate` | Yes: Date → year number | Yes | No | FAIL_CLOSED if missing |
| gameType | Not in research/schedule types | SAFE_FALLBACK_ALLOWED: REGULAR_SEASON | Yes | Yes | SAFE_FALLBACK_ALLOWED |
| status | `researchSnapshot.event.status` | Map to `MLBPregameGameStatus` | Yes | No | FAIL_CLOSED if ineligible (FINAL/LIVE/CANCELLED/POSTPONED) |
| homeTeamName | `scheduleGame.homeTeamName` | Copy | Yes | No | FAIL_CLOSED if missing |
| awayTeamName | `scheduleGame.awayTeamName` | Copy | Yes | No | FAIL_CLOSED if missing |
| leagueRecord | Not in current bridge scope | EXPLICIT_UNAVAILABLE | N/A | Yes | OUT_OF_SCOPE_FOR_THIS_BRIDGE |
| seriesContext | Not in current bridge scope | EXPLICIT_UNAVAILABLE | N/A | Yes | OUT_OF_SCOPE_FOR_THIS_BRIDGE |
| sourceReferences | `researchSnapshot.provenance` | Map `DataProvenance[]` → `MLBPregameSourceReference[]` | Yes | No | FAIL_CLOSED if provenance missing |
| sections | Derived from `researchSnapshot` sub-profiles | Deterministic section construction | Yes | Parts | EXPLICIT_UNAVAILABLE for missing subsections |
| warnings | `researchSnapshot.warnings` | Copy | Yes | No | Empty if absent |
| researchPayload | `sections` + sub-profile payloads | Serialize JSON-safe canonical payload | Yes | Parts | EXPLICIT_UNAVAILABLE for missing subsections |
| homeWinProbability | NOT_DERIVED_BY_BRIDGE | N/A | N/A | N/A | OUT_OF_SCOPE_FOR_THIS_BRIDGE |
| awayWinProbability | NOT_DERIVED_BY_BRIDGE | N/A | N/A | N/A | OUT_OF_SCOPE_FOR_THIS_BRIDGE |
| predictedSide | NOT_DERIVED_BY_BRIDGE | N/A | N/A | N/A | OUT_OF_SCOPE_FOR_THIS_BRIDGE |
| predictedTeamId | NOT_DERIVED_BY_BRIDGE | N/A | N/A | N/A | OUT_OF_SCOPE_FOR_THIS_BRIDGE |

No row may say "source missing but bridge fetches it later." A pure mapper cannot do that.

## 10. Canonical bridge output

CANONICAL BRIDGE OUTPUT: `MLBCanonicalPregameSnapshot`

Why this is the narrowest reusable boundary:
- It is the only existing validated representation that safely carries all live-data fields (`officialDate`, `season`, `gameType`, `status`, `startingPitchers`, `sourceReferences`, `sections`, `warnings`) without loss or mutation.
- `MLBPredictionInputContract` lacks `officialDate` and structured source/section metadata required by Phase 8J inference and feature extraction.
- Using the snapshot as the boundary avoids coupling research-data internals directly to recommendation code. The snapshot is a canonical, validated, provider-agnostic form.

Ownership:
- Research normalization / bridge module owns creation from the explicit input composition.
- A small prediction-side adapter module consumes the snapshot to derive `MLBPredictionInputContract` and feature vectors.

Downstream consumer:
- Prediction-scoring module consumes snapshot sections.
- Inference publisher consumes snapshot fields (`officialDate`, `gameId`, `homeTeamId`, `awayTeamId`, `snapshotId`, `dataCutoffAt`) plus computed probabilities.

## 11. Responsibility separation

### Responsibility A — live data acquisition

Existing:

```text
MLB Stats API/provider/module
```

May perform network I/O. Owns fetching schedule, probable pitchers, stats, venue, weather. Produces `MLBScheduleGame` + `MLBGameResearchSnapshot`.

### Responsibility B — deterministic research → canonical snapshot bridge

New Phase 8U-B bridge:

```text
Readonly<{ scheduleGame: MLBScheduleGame; researchSnapshot: MLBGameResearchSnapshot; }>
→ MLBCanonicalPregameSnapshot
```

Ownership: research-data bridge module.
Failure boundary: Returns validation issues if provider data is malformed, missing required identity, or contains post-start contamination.

The mapper itself must perform:

```text
NO network I/O
NO clock reads
NO randomness
NO database access
NO filesystem reads
NO sportsbook/market access
```

Network I/O belongs UPSTREAM in the existing research provider/module. The bridge must not fetch schedule data internally to compensate for missing input fields.

### Responsibility C — production model scoring

Separate capability:

```text
validated canonical snapshot/features
+ legitimate released model artifact
→ homeWinProbability / awayWinProbability
→ predictedSide / predictedTeamId
```

This does NOT exist yet. No trained/released coefficient artifact is present. The re-audit proved:
- CONTRACT_EXISTS for model training plan, training matrix, feature manifest, feature vector, fit validation, test evaluation, release record.
- IMPLEMENTATION_EXISTS for validation only.
- TRAINED_ARTIFACT_EXISTS: NO.
- PRODUCTION_RELEASE_EXISTS: NO.

### Responsibility D — Phase 8J publication

Existing deterministic contract boundary:

```text
legitimate model output + identity
→ validated MLBOfflinePregameInference
```

Ownership: inference publisher module.
Failure boundary: Calls `validateMLBOfflinePregameInference` and returns issues. Does not mutate caller-owned snapshot or scoring result.

## 12. Incomplete-data policy

| Scenario | Policy | Rationale |
|---|---|---|
| probable pitcher missing | EXPLICIT_UNAVAILABLE_STATE | `homeStartingPitcher` / `awayStartingPitcher` set to `UNAVAILABLE`. Bridge does not fabricate pitcher identity. |
| pitcher announced after initial fetch | SAFE_FALLBACK_ALLOWED if re-fetch occurs before `dataCutoffAt`; otherwise EXPLICIT_UNAVAILABLE_STATE | Re-fetch is a deterministic provider call, not randomness. If post-cutoff, the announcement is too late for pregame prediction. |
| team stats unavailable | EXPLICIT_UNAVAILABLE_STATE | Team stats section marked `UNAVAILABLE`. Scoring module handles missing groups via abstention or renormalization. |
| game postponed / cancelled | FAIL_CLOSED | Bridge rejects non-eligible game statuses. No prediction is produced. |
| doubleheader identity | FAIL_CLOSED if ambiguous | Bridge requires explicit `doubleHeader` string and derives canonical `doubleheaderId` + `gameNumber`. If ambiguous, validation fails. |
| scheduled start changes | EXPLICIT_UNAVAILABLE if change occurs after `dataCutoffAt`; otherwise rebuild snapshot upstream | Post-cutoff start change is post-start contamination. Pre-cutoff change triggers deterministic upstream rebuild. |
| missing venue data | EXPLICIT_UNAVAILABLE_STATE | Venue section marked `UNAVAILABLE`. `venueId` set to null. `neutralSite` falls back to false. |
| partial research provider failure | EXPLICIT_UNAVAILABLE for failed subsection | Affected section marked `UNAVAILABLE`. `dataCompleteness` set to `PARTIAL` or `INSUFFICIENT`. |
| stale snapshot | FAIL_CLOSED if older than staleness threshold; EXPLICIT_UNAVAILABLE if within threshold but subsection stale | Staleness is measured from `provenance[0].fetchedAt` to `dataCutoffAt`. |
| data cutoff at/after game start | FAIL_CLOSED | Bridge enforces `dataCutoffAt < scheduledStartAt` strictly. Equality is contamination. |

## 13. Pregame temporal safety

Exact temporal relationship:

```text
provider fetchedAt
  ≤ dataCutoffAt
  < scheduledStartAt
  ≤ inference generatedAt
```

Rules:
1. `dataCutoffAt` is derived from the latest provider `fetchedAt` included in the snapshot.
2. `dataCutoffAt` must be strictly earlier than `scheduledStartAt`. Equality is treated as post-start contamination.
3. `capturedAt` equals `dataCutoffAt` (bridge does not introduce a separate capture time).
4. `inference generatedAt` is set by the inference publisher using a deterministic time source (caller-supplied or bridge-determined from `dataCutoffAt`).
5. Any provider record with `fetchedAt > dataCutoffAt` is excluded from the canonical snapshot.

Derivation from existing contracts:
- `MLBPredictionInputContract` already enforces `dataCutoffAt <= capturedAt`.
- `MLBCanonicalPregameSnapshot` adds the stricter pregame rule: `dataCutoffAt < scheduledStartAt`.
- Phase 8J inference adds `generatedAt` downstream.

## 14. Identity/reference ownership

Deterministic identifiers preserved across the bridge:

| Identifier | Source | Ownership |
|---|---|---|
| gameId | `scheduleGame.gamePk` (number → string) | Bridge creates deterministic string ID. |
| officialDate | `scheduleGame.officialDate` | Bridge preserves exact Gregorian date string. |
| homeTeamId / awayTeamId | `scheduleGame.homeTeamId` / `awayTeamId` | Bridge creates deterministic string IDs. |
| snapshotId | Bridge-generated | Deterministic: `${gameId}::${dataCutoffAtMs}::pregame-snapshot-v1`. |
| sourceRefId | Provider provenance | Preserved exactly from `DataProvenance.source` or generated deterministically. |
| sectionId | Bridge-generated | Deterministic from `kind` + `entity.scope`. |
| inferenceId | Inference publisher | Deterministic: `${releaseId}::${snapshotId}::offline-pregame-inference-v1`. |
| releaseId / modelId / planId / matrixId / configId / manifestId | Locked model release record | Owned by release artifact; bridge/publisher pass through unchanged. |

The bridge must not invent unstable identity from clock, randomness, object references, or locale-sensitive ordering.

## 15. Determinism requirements

- All string transformations use fixed, locale-independent mappings.
- Timestamp formatting uses strict RFC3339 with `Z` or `±HH:MM`.
- Date formatting uses canonical `YYYY-MM-DD`.
- Sorting of arrays (e.g., `sourceReferences`, `sections`) uses deterministic comparator based on stable IDs, never `localeCompare`.
- No `JSON.stringify` is used for identity or ordering.
- No `Date` API beyond `Date.parse`, `Date.getTime()`, `Date.toISOString`, and explicit UTC construction.
- No `Temporal` API.
- No `Math.random`, `crypto.randomUUID`, or equivalent.
- No network calls inside deterministic mapper/scorer unit tests.

## 16. Real-data smoke targets

### Phase 8U-B smoke

Must prove ONLY:

```text
1. select a real MLB game/date
2. obtain real research/schedule context through existing provider/module
3. pass already-fetched context into the deterministic bridge
4. produce a valid canonical pregame snapshot
5. preserve exact real game/team/time/source identity
```

It must NOT print a fake probability or winner.

### Phase 8U-D smoke

Only after model productionization exists:

```text
1. real pregame MLB data
2. canonical pregame snapshot
3. legitimate released model
4. deterministic scoring
5. model-generated home/away probabilities
6. predicted side/team
7. valid Phase 8J inference
```

## 17. Permanent test architecture

### 17.1 Pure deterministic unit fixtures

Tests that must never depend on live internet:

- valid live-like provider payload → canonical prediction input mapping
- game/team identity preservation (number → string ID stability)
- officialDate/start-time preservation
- deterministic repeatability (same input → same output)
- missing probable pitcher behavior
- partial-data behavior
- post-start contamination rejection
- no mutation of provider-owned objects
- odds contamination rejection/absence
- model probability domain ([0, 1], complement invariant)
- probabilities sum/invariant per existing Phase 8J contract
- predictedSide / predictedTeamId consistency
- structural clone validation where relevant
- abstention semantics for insufficient coverage

### 17.2 Optional/manual live Stats API smoke

- Separate test file marked with explicit skip/flag.
- Only run when network and API credentials are available.
- Not part of CI.

### 17.3 Test ownership

- Bridge unit tests: `tests/prediction/mlb/mlb-research-data-bridge.test.ts`
- Scoring module unit tests: `tests/prediction/mlb/mlb-prediction-scoring-module.test.ts`
- Inference integration tests: `tests/prediction/mlb/mlb-offline-pregame-inference-real-data.test.ts` (live smoke, skipped in CI)

## 18. Implementation slicing

### Phase 8U-B: real-data canonical snapshot bridge

Purpose:
- Turn already-fetched real MLB research/schedule context into a validated `MLBCanonicalPregameSnapshot`.

Bound:
- Does NOT perform model scoring.
- Does NOT compute probabilities.
- Does NOT produce `MLBOfflinePregameInference`.
- Does NOT implement 8K→8P recommendation orchestration.
- Does NOT persist.

### Phase 8U-C: model-productionization planning/audit

Purpose:
- Determine from repository evidence how to build the first legitimate MLB V1 production model artifact, including the actual training dataset source, feature matrix construction, fit execution, evaluation/holdout gates, release provenance, and deterministic scoring runtime.

Bound:
- Does NOT materialize arbitrary coefficients.
- Does NOT invent placeholder weights.
- Does NOT produce inference artifacts.
- Does NOT promise a specific model artifact until its own planning/audit phase proves the required training pipeline exists.

### Phase 8U-D: real Phase 8J inference integration

Purpose:
- Assemble `MLBOfflinePregameInference` from canonical pregame snapshot + legitimate production model scorer/release.
- Validate inference via existing `validateMLBOfflinePregameInference`.
- Provide manual real-data smoke.

Bound:
- Does NOT implement 8K→8P orchestration.
- Does NOT persist or schedule.

Downstream Phase 8K→8P remains later.

## 19. Strict non-goals

Explicitly excluded from Phase 8U:

- Phase 8K→8P full recommendation orchestration (single-pick, multi, multi-recommendation, risk guidance, timestamped bundle)
- recommendation persistence
- outcome ingestion automation
- outcome persistence
- grading automation
- performance persistence
- scheduler / cron
- API routes
- UI wiring
- deployment
- new model training
- sportsbook odds/prices/lines
- market-implied probabilities
- value/edge/market EV calculations

## 20. Downstream handoff

After Phase 8U-D, the first real `MLBOfflinePregameInference` can be produced from live MLB data. The next dependency is:

```text
real inference
→ Phase 8K prediction slate
→ Phase 8L single-pick recommendation
→ Phase 8M multi candidate
→ Phase 8N multi recommendation
→ Phase 8O risk guidance
→ Phase 8P timestamped bundle
```

Tentative future phase name: Phase 8V — Real recommendation orchestration and publication.

This phase consumes Phase 8U-D outputs and implements the bounded composition of Phase 8K–8P contracts into timestamped recommendation bundles.

## 21. Acceptance gates

The Phase 8U-A2 plan is not ready unless it answers concretely:

- What exact object(s) enter 8U-B? `Readonly<{ scheduleGame: MLBScheduleGame; researchSnapshot: MLBGameResearchSnapshot; }>`.
- Can every canonical snapshot field be derived solely from them? Yes, per Section 9 mapping matrix.
- Does 8U-B perform any network I/O? Expected: NO.
- Does 8U-B perform model scoring? Expected: NO.
- Is a trained/released coefficient artifact currently available? NO. Evidence: no committed coefficient files, no training dataset, no fit runner, no production release.
- If NO, what exact model-productionization dependency precedes real probability generation? After Phase 8U-B closes the real-data snapshot bridge, the next dependency is a dedicated model-productionization planning/audit phase. That phase must determine, from repository evidence, how to build the first legitimate MLB V1 production model artifact, including the actual training dataset source, feature matrix construction, fit execution, evaluation/holdout gates, release provenance, and deterministic scoring runtime. No real probability or predicted winner may be produced until that model-productionization work is implemented and verified.
- Can backtesting scorers currently generate calibrated Phase 8J probabilities? NO. Evidence: `computeExploratoryScore` and `computeTeamOnlyScore` output `researchStrengthScore` and `predictedSide`, not calibrated probabilities.
- What qualifies a model release as legitimate? It must be produced through the project's accepted model/training/evaluation architecture (`MLBModelTrainingConfiguration`, `MLBTrainingMatrix`, `MLBModelFitValidationResult`, `MLBModelTestEvaluation`, `MLBModelReleaseRecord`) and validated by `evaluateAndReleaseMLBDeterministicModel`.
- When may the program first claim it produced a real model probability? Only after a legitimate model release is materialized through the project's training/evaluation architecture and applied deterministically by the scoring runtime.
- When may the program first claim it produced a real predicted winner? Only after a legitimate model release exists and Phase 8U-D produces a valid `MLBOfflinePregameInference` from it.
- What is the 8U-B smoke? Prove canonical snapshot construction from live data with exact identity preservation.
- What is the later 8U-D inference smoke? Prove valid `MLBOfflinePregameInference` from real snapshot + legitimate model.
- What remains for 8K→8P? Downstream recommendation orchestration, persistence, grading automation, performance aggregation, UI, and scheduling.

No unresolved placeholders remain.

## 22. External events

Phase 8T-A:
- `readonly-audit/SKILL.md` patched ×1

Phase 8U-A:
- `deterministic-contract-design/SKILL.md` patched ×1
- `mlb-bridge-architecture` skill created ×1

Phase 8U-A2:
- mlb-bridge-architecture/SKILL.md patched ×1

Phase 8U-A3:
- gated-phased-development/SKILL.md patched ×1
- mlb-bridge-architecture/SKILL.md patched ×1

Phase 8U-A4:
- No external skill/self-improvement/configuration events occurred during this final truth-repair phase.
