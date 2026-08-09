# MLB V1 Real Historical Dataset Materialization Plan

## 1. Purpose

This plan defines the exact implementation path for Phase 8V-D2-B: wire real MLB historical source data through the already-completed `buildMLBHistoricalCanonicalPregameSnapshot` and `buildMLBHistoricalLabelledDataset` contracts to produce a deterministic, inspectable, odds-blind historical labelled dataset. No recommendation, grading, aggregation, route, UI, persistence, odds, or monetary concept is introduced.

## 2. Locked baseline

Branch: `main`
Commit: `5255c87f3144f2988b47c8f76e5b9868eb582ec4`
Baseline commit message: `Implement MLB historical labelled dataset builder`

Phase 8V-D is CLOSED. Phase 8V-D2-A audit is CLOSED. This document is the sole authoritative plan for D2-B.

## 3. Completed prerequisite contracts

- `src/prediction/mlb/mlb-historical-canonical-snapshot-adapter.ts` — builds validated canonical pregame snapshots from caller-supplied raw facts.
- `src/prediction/mlb/mlb-historical-labelled-dataset-builder.ts` — builds validated labelled datasets from canonical snapshots plus official-final labels.
- `src/prediction/mlb/mlb-historical-labelled-dataset-contract.ts` — deterministic validation, ordering, duplicate detection, and identity hashing.
- `src/prediction/mlb/mlb-real-data-pregame-snapshot-bridge.ts` — existing prediction-owned bridge from research-data snapshot + schedule to canonical pregame snapshot.

## 4. Real historical source graph

Enumeration:
- `src/lib/backtesting/mlb/live-history/schedule-loader.ts` :: `createScheduleLoader().loadForDateRange(start, end)` → `CanonicalHistoricalScheduleGame[]`
- Uses `MLBStatsApiClient.fetchSchedule(date)` (`/schedule?sportId=1&date=...&hydrate=probablePitcher,venue`)

Outcome:
- `src/lib/backtesting/mlb/live-history/outcome-loader.ts` :: `createOutcomeLoader().loadOutcome(gamePk)` → `CanonicalHistoricalOutcome`
- Uses `MLBStatsApiClient.fetchFeedLive(gamePk)` (`/game/{gamePk}/feed/live`)
- Completion time derived via `extractLastCompletedPlayEnd(allPlays)`

Team as-of:
- `src/lib/backtesting/mlb/live-history/team-game-source.ts` :: `createMLBHistoricalTeamGameSource().getTeamGames(teamId, season, cutoff)` → `CompletedHistoricalTeamGame[]`
- Aggregated by `src/lib/backtesting/mlb/live-history/team-aggregator.ts` :: `aggregateTeamHistory(games, teamId, cutoff)`

Pitcher as-of:
- `src/lib/backtesting/mlb/live-history/pitcher-appearance-source.ts` :: `createMLBHistoricalPitcherAppearanceSource().getPitcherAppearances(personId, season, cutoff)` → `HistoricalPitcherAppearance[]`
- Aggregated by `src/lib/backtesting/mlb/live-history/pitcher-aggregator.ts` :: `aggregatePitcherHistory(appearances, personId, cutoff)`

Probable-starter observation:
- `src/lib/backtesting/mlb/live-history/pregame-pitcher-observation-store.ts` :: `createMLBPregamePitcherObservationStore()` — file-backed store for prospective `PROSPECTIVE_LIVE` observations only.
- `src/lib/backtesting/mlb/live-history/pregame-pitcher-observation-writer.ts` :: `createPregamePitcherObservationWriter()` — writes prospective observations with provenance.
- `src/lib/backtesting/mlb/live-history/pregame-pitcher-observation-capture.ts` — captures schedule probable pitchers during prospective live runs.

Cache:
- `src/lib/backtesting/mlb/live-history/cache.ts` :: `createMLBHistoricalCache(config)` — file-backed cache preserving `CacheProvenance` (`fetchedAt`, `sourceTimestamp`).

HTTP client:
- `src/lib/backtesting/mlb/live-history/client.ts`
  :: `createMLBHistoricalHttpClient()` — fetch with retry, timeout, provenance.

Concurrency:
- `src/lib/backtesting/mlb/live-history/concurrency.ts` :: `mapWithConcurrency(items, concurrency, mapper)` — bounded async concurrency.

## 5. Prediction ownership boundary

D2-B MUST NOT import:
- `src/lib/backtesting/mlb/live-history/provider-factory.ts`
- `src/lib/backtesting/mlb/live-history/provider.ts`
- Any backtest orchestration, CLI runner, or backtest module.

D2-B MAY compose these narrow primitives directly:
- `createScheduleLoader` — SAFE_SHARED_PRIMITIVE
- `createOutcomeLoader` — SAFE_SHARED_PRIMITIVE
- `createMLBHistoricalTeamGameSource` — SAFE_SHARED_PRIMITIVE
- `aggregateTeamHistory` — SAFE_SHARED_PRIMITIVE
- `createMLBHistoricalPitcherAppearanceSource` — SAFE_SHARED_PRIMITIVE
- `aggregatePitcherHistory` — SAFE_SHARED_PRIMITIVE
- `createMLBPregamePitcherObservationStore` — SAFE_SHARED_PRIMITIVE
- `createMLBHistoricalCache` — SAFE_SHARED_PRIMITIVE
- `createMLBHistoricalHttpClient` — SAFE_SHARED_PRIMITIVE
- `mapWithConcurrency` — SAFE_SHARED_PRIMITIVE
- `extractLastCompletedPlayEnd` — SAFE_SHARED_PRIMITIVE

No new MLB HTTP implementation is introduced. All network I/O flows through the existing client.

## 6. Game enumeration

Exact source: `src/lib/backtesting/mlb/live-history/schedule-loader.ts` :: `createScheduleLoader().loadForDateRange(startDate, endDate)`

Inputs:
- `startDate: string` — inclusive YYYY-MM-DD
- `endDate: string` — inclusive YYYY-MM-DD

Output: `Promise<CanonicalHistoricalScheduleGame[]>`

Fields available per game:
- `gamePk`
- `officialDate`
- `scheduledStart`
- `status`
- `homeTeamId`
- `homeTeamName`
- `awayTeamId`
- `awayTeamName`
- `venueId` / `venueName`
- `doubleHeader`
- `gameNumber`
- `scheduledInnings`
- `rescheduledFromGamePk`
- `homeProbablePitcherId` / `awayProbablePitcherId`
- `provenance` (`endpoint`, `fetchedAt`, `sourceTimestamp`)

Bounding:
- The schedule loader supports explicit `startDate`/`endDate`.
- `season` is derivable from `officialDate` or supplied by caller for aggregation; it is not required for enumeration.

## 7. Predictor cutoff interface

No existing cutoff-policy abstraction exists in the repository. D2-B introduces a small caller-owned deterministic interface:

```ts
type MLBHistoricalPredictorCutoffPolicy =
  (game: CanonicalHistoricalScheduleGame) => Date;
```

CLI exposure:
- `--cutoff-minutes-before-start <positive integer>`
- The materializer converts this to an absolute `Date` per game: `new Date(scheduledStart.getTime() - minutes * 60_000)`.
- The absolute cutoff is validated before use:
  - MUST be finite.
  - MUST be strictly before `scheduledStart`.
  - MUST satisfy canonical snapshot contract requirements (e.g., `dataCutoffAt < scheduledStartAt`).

No silent default. If the caller omits cutoff configuration, the materializer fails closed with a deterministic issue.

## 8. Team as-of reconstruction

Reuse `createMLBHistoricalTeamGameSource` + `aggregateTeamHistory`.

Call sequence:
1. `teamGameSource.getTeamGames(teamId, season, cutoff)`
2. Filter: team membership, status `FINAL|CANCELLED|POSTPONED|SUSPENDED`, dedupe by `gamePk`.
3. Filter: `officialDate < cutoff`.
4. Filter: `completedAt != null` and `completedAt < cutoff`.
5. Aggregate with `aggregateTeamHistory(games, teamId, cutoff)`.
6. As-of value in canonical snapshot = caller-owned cutoff ISO string.

Calendar-year limitation: season is derived from `cutoff.getUTCFullYear()`. Full-year schedule is fetched internally by the team game source.

D2-B may reuse this path directly because it is a self-contained primitive with no backtest-orchestration dependency.

## 9. Pitcher as-of reconstruction

Reuse `createMLBHistoricalPitcherAppearanceSource` + `aggregatePitcherHistory`.

Call sequence:
1. `pitcherAppearanceSource.getPitcherAppearances(personId, season, cutoff)`
2. Aggregate with `aggregatePitcherHistory(appearances, personId, cutoff)`.
3. As-of value = caller-owned cutoff ISO string.

Requires truthful `personId`. Returns `null` for invalid IDs. D2-B MUST call this only when a truthful pre-cutoff probable-starter identity exists.

## 10. Probable-starter truth boundary

Permanent rule:
- DO NOT substitute actual/final starter for historical probable starter.
- DO NOT use postgame box score starter as predictor truth.
- DO NOT use schedule probable pitcher fetched after cutoff as proof of pre-cutoff knowledge.

D2-B logic:
1. Check prospective observation store for a `PROSPECTIVE_LIVE` observation for `gamePk`.
2. If found AND `observedAt <= predictor cutoff` → use `personId` as truthful starter identity.
3. Otherwise → canonical starter state = `UNAVAILABLE` / `UNKNOWN`.
4. Do NOT compute pitcher aggregate when starter identity is unknown.

A missing prospective starter MUST NOT automatically skip the game if the canonical snapshot contract accepts truthful `UNKNOWN` starter.

## 11. Historical status mapping

The canonical snapshot adapter already maps raw status via `resolvePregameStatus`:
- `UPCOMING` → `SCHEDULED`
- `POSTPONED` → `POSTPONED`
- `CANCELLED` → `CANCELLED`
- `LIVE` / `FINAL` / default → `UNKNOWN`

For predictor truth: an archival schedule row showing `FINAL` becomes `UNKNOWN` in the canonical pregame snapshot. `FINAL` is allowed only in the official-final label acquired after predictor reconstruction.

## 12. Game-type source

Raw MLB schedule `gameType` codes are preserved by the schedule loader as raw `gameType` in the parsed Zod schema and forwarded as `CanonicalHistoricalScheduleGame.rawGameType` without interpretation.

The schedule layer does NOT map the code into:
- `REGULAR_SEASON`
- `SPRING_TRAINING`
- `POSTSEASON`
- `ALL_STAR`
- `OTHER`

The historical canonical snapshot adapter remains the sole mapping authority and rejects unsupported codes rather than defaulting to `REGULAR_SEASON`.

D2-B uses the same mapping as the existing real-data bridge (`mapGameType` in `mlb-real-data-pregame-snapshot-bridge.ts`) and rejects unsupported codes rather than defaulting to `REGULAR_SEASON`.

## 13. Venue / neutral-site truth

- `venueId` / `venueName` are available from the schedule loader.
- `neutralSite` is NOT authoritatively available from the selected historical schedule abstraction.
- D2-B MUST set `neutralSite = null` when unavailable.
- NEVER derive `neutralSite = false` from absence.

This matches the existing real-data bridge behavior.

## 14. Archival source provenance

Canonical snapshot provenance fields:
- `dataCutoffAt` = historical predictor cutoff ISO string.
- `capturedAt` = historical predictor cutoff ISO string.
- `sourceReferences[*].fetchedAt` = actual preserved source acquisition provenance (network fetch time or cached provenance `fetchedAt`).
- `sourceReferences[*].sourceUpdatedAt` = truthful upstream timestamp only if semantically appropriate; otherwise `null`.
- `reconstructedAt` = actual orchestration reconstruction timestamp.
- `dataset.createdAt` = actual final dataset assembly timestamp.

For cache hits: preserve the cached payload's original provenance `fetchedAt` and `sourceTimestamp`. Do NOT backdate archival fetch timestamps to the predictor cutoff.

## 15. Official final label acquisition

Exact source: `createOutcomeLoader().loadOutcome(gamePk)` using `/game/{gamePk}/feed/live`.

Output used:
- `winner` (`HOME` | `AWAY`)
- `homeScore`
- `awayScore`
- `completedAt` (from last completed play end)
- `completedAtSource` = `LAST_COMPLETED_PLAY_END`

Permanent rule: official final outcome acquisition joins AFTER canonical predictor snapshot reconstruction. It must never influence predictor cutoff, starter identity, team aggregates, pitcher aggregates, snapshot completeness, or snapshot warnings.

## 16. Label provenance

Label source fields:
- `sourceName` = caller-chosen deterministic identifier (e.g., `mlb-stats-api:feedLive`).
- `sourceRecordId` = `gamePk` or equivalent stable record identifier.
- `fetchedAt` = actual official-outcome acquisition provenance (network fetch time or cache provenance `fetchedAt`).

Label chronology:
- `label.fetchedAt >= label.finalizedAt`
- `label.fetchedAt <= dataset.createdAt`

Do NOT use `game.completedAt`, `historical cutoff`, or `scheduledStartAt` as label fetch time.

## 17. Clock / reconstruction-time ownership

No hidden wall-clock access in deterministic adapters or builders.

D2-B network/materialization orchestration may observe current time through one explicit injected dependency:

```ts
type MLBHistoricalMaterializationClock = Readonly<{
  now(): Date;
}>;
```

The clock owns:
- `reconstructedAt`
- `dataset.createdAt`
- any orchestration-run timestamps

The clock does NOT own:
- historical predictor cutoff
- official final `completedAt`
- source `fetchedAt` already provided by source provenance

Default implementation for real smoke: `() => new Date()`.

## 18. Cache and reproducibility

- Cache: `createMLBHistoricalCache({ root, version })` — file-backed, keyed by endpoint + params.
- Provenance preserved: `CacheEnvelope.provenance.fetchedAt` and `sourceTimestamp`.
- A cache hit returns the cached payload with its original provenance. D2-B must treat a cache read as the original acquisition time, not as a fresh fetch timestamp.
- First real run can be repeated without unnecessary refetching when cache is warm.

## 19. Initial real smoke scope

FIRST SMOKE WINDOW SIZE = one calendar date

FIRST SMOKE DATE = operator-supplied explicit completed regular-season date at execution time; not production-hardcoded

Configuration fields:
- `--start-date YYYY-MM-DD` (single date for smoke; later may accept ranges)
- `--end-date YYYY-MM-DD` (optional; required for multi-date runs)

Selection rule for smoke:
- Caller supplies date.
- Materializer enumerates schedule for that date.
- Eligible games: supported `gameType`, predictor cutoff < `scheduledStartAt`, pregame snapshot canonicalizable.
- No cherry-picking based on known outcomes.

## 20. Artifact format

Format: JSON

Schema: one `MLBHistoricalLabelledDataset` root object.

Filename convention:
- Caller-supplied via `--output`.
- Suggested convention for manual smoke: `mlb-historical-labelled-dataset-{YYYY-MM-DD}-v1.json`.

Serialization:
- Deterministic `JSON.stringify(dataset, null, 2)` after successful validation.

Atomic write behavior:
- Serialize validated dataset to a temporary sibling file in the same directory.
- `fs.renameSync(tempPath, finalPath)` for atomic replacement.
- Overwrite behavior: caller-supplied path is overwritten atomically if it exists.

Contract version ownership:
- `contractVersion` field inside the dataset is owned by the builder and validated by the contract.

## 21. Generated-data Git policy

REAL MATERIALIZED DATASET COMMITTED TO GIT = NO

Mechanism:
- D2-B writes to an explicit caller-supplied output path.
- No permanent repository-local generated-data directory is introduced.
- Therefore `.gitignore` does NOT require modification.
- Operator remains responsible for ignoring the chosen output path if desired.

## 22. Executable CLI

Preferred invocation:

```text
npx tsx scripts/materialize-mlb-historical-dataset.ts \
  --start-date YYYY-MM-DD \
  --end-date YYYY-MM-DD \
  --cutoff-minutes-before-start N \
  --output /absolute/or/resolved/path.json
```

Required arguments:
- `--start-date`
- `--end-date`
- `--cutoff-minutes-before-start`
- `--output`

Optional arguments:
- `--concurrency` (default: `1`; must be positive integer)
- `--cache-root` (default: `.cache/mlb-historical` under repo root, or similar)
- `--clock` (test-only injection; omitted in production CLI)

No Next.js route. No UI endpoint. No hidden invocation.

## 23. Failure / skip taxonomy

Counters emitted in deterministic materialization summary:

```text
enumeratedGames
eligibleGames
materializedExamples
```

Skip counters:
- `NON_FINAL` — game status not in allowed final-like set.
- `UNSUPPORTED_GAME_TYPE` — raw `gameType` fails closed.
- `CANONICALIZATION_REJECTED` — predictor snapshot failed validation.
- `LABEL_REJECTED` — official final label failed validation.

Source/infrastructure failure counters:
- `SCHEDULE_SOURCE_FAILURE`
- `PREGAME_SOURCE_FAILURE`
- `TEAM_AS_OF_FAILURE`
- `PITCHER_AS_OF_FAILURE`
- `FINAL_OUTCOME_SOURCE_FAILURE`
- `ARTIFACT_WRITE_FAILURE`

Warning/counter (not skip):
- `MISSING_PROSPECTIVE_STARTER` — truthful UNKNOWN starter is acceptable; game continues with `UNAVAILABLE` starter state.

## 24. Concurrency

INITIAL CONCURRENCY = 1

Rationale:
- maximize reproducibility
- minimize rate-limit/debug surface
- prove correctness before optimization

Architecture accepts caller-configurable bounded concurrency for later use. No uncontrolled whole-season `Promise.all`.

## 25. End-to-end sequence

1. Parse and validate materialization request.
2. Enumerate historical games for explicit date range.
3. Classify game type/status; reject unsupported/non-final.
4. Compute explicit caller-configured predictor cutoff per game.
5. Acquire predictor-side historical source facts:
   - schedule context
   - venue
   - prospective starter if pre-cutoff observation exists
   - team aggregates strictly as-of cutoff
   - pitcher aggregates only where truthful starter identity exists
6. Build canonical historical pregame snapshot via `buildMLBHistoricalCanonicalPregameSnapshot`.
7. ONLY AFTER predictor snapshot exists, acquire official final outcome via `createOutcomeLoader().loadOutcome(gamePk)`.
8. Build reconstruction metadata (`mode`, `cutoffAt`, `reconstructedAt`) and label source provenance (`fetchedAt`).
9. Accumulate builder entries.
10. Construct full dataset via `buildMLBHistoricalLabelledDataset`.
11. Run final dataset contract validation.
12. Serialize to JSON.
13. Atomic write to caller-supplied output path.
14. Emit deterministic materialization summary with exact counters.

Explicit prohibition: steps 7–14 must not influence steps 1–6.

## 26. Permanent test strategy

D2-B tests must cover at minimum:

- request validation (missing/invalid dates, cutoff, output)
- exact game enumeration pass-through
- `gameId` truth (`String(gamePk)`)
- supported/unsupported `gameType`
- historical `FINAL` → predictor `UNKNOWN` status
- cutoff before scheduled start
- team aggregates called with exact cutoff
- prospective starter `<= cutoff` accepted
- prospective starter `> cutoff` rejected/ignored
- no starter → truthful `UNKNOWN`
- no actual-final-starter substitution
- pitcher aggregate only with truthful starter ID
- `neutralSite` unknown → `null`
- archival source `fetchedAt` preserved (cache + network)
- cache provenance preserved
- official outcome requested only after predictor snapshot construction
- final outcome cannot alter predictor snapshot
- official scores/winner mapped to label
- label `fetchedAt` preserved
- `reconstructedAt` from injected clock
- `dataset.createdAt` from injected clock
- deterministic ordering
- deterministic summary counters
- source failure classification
- single-date sequential real smoke
- artifact content validates against `MLBHistoricalLabelledDataset`
- atomic output behavior
- odds contamination guard/boundary

## 27. Exact D2-B change surface

D2_B_CAN_BE_IMPLEMENTED_WITH_NEW_FILES_ONLY = NO

MODIFY:
- src/lib/backtesting/mlb/live-history/types.ts
- src/lib/backtesting/mlb/live-history/schemas.ts
- src/lib/backtesting/mlb/live-history/cache.ts
- src/lib/backtesting/mlb/live-history/schedule-loader.ts
- src/lib/backtesting/mlb/live-history/outcome-loader.ts
- src/lib/backtesting/mlb/live-history/pitcher-feed-loader.ts
- src/lib/backtesting/mlb/live-history/team-game-source.ts
- src/lib/backtesting/mlb/live-history/pitcher-appearance-source.ts
- tests/backtesting/live-history/cache.test.ts
- tests/backtesting/live-history/outcome-loader.test.ts
- tests/backtesting/live-history/pitcher-feed-loader.test.ts
- tests/backtesting/live-history/team-game-source.test.ts
- tests/backtesting/live-history/pitcher-appearance-source.test.ts
- tests/backtesting/live-history/schedule-loader.test.ts
- src/prediction/mlb/mlb-historical-materialization-source-adapter.ts
- tests/prediction/mlb/mlb-historical-materialization-source-adapter.test.ts

No package.json modification required because `npx tsx scripts/materialize-mlb-historical-dataset.ts` is a valid invocation without a registered npm script.

No `.gitignore` modification required because D2-B uses an explicit caller-supplied output path and does not introduce a permanent generated-data directory.

## 28. Exact D2-B implementation manifest

IMMEDIATE NEXT IMPLEMENTATION PHASE = 8V-D2-B

PURPOSE =
Wire real MLB historical source data into the completed canonical snapshot and labelled-dataset builder contracts to produce a deterministic, inspectable, odds-blind historical labelled dataset.

READ =
src/prediction/mlb/mlb-historical-canonical-snapshot-adapter.ts
src/prediction/mlb/mlb-historical-labelled-dataset-builder.ts
src/prediction/mlb/mlb-historical-labelled-dataset-contract.ts
src/prediction/mlb/mlb-real-data-pregame-snapshot-bridge.ts
src/lib/backtesting/mlb/live-history/schedule-loader.ts
src/lib/backtesting/mlb/live-history/outcome-loader.ts
src/lib/backtesting/mlb/live-history/team-game-source.ts
src/lib/backtesting/mlb/live-history/team-aggregator.ts
src/lib/backtesting/mlb/live-history/pitcher-appearance-source.ts
src/lib/backtesting/mlb/live-history/pitcher-aggregator.ts
src/lib/backtesting/mlb/live-history/pregame-pitcher-observation-store.ts
src/lib/backtesting/mlb/live-history/pregame-pitcher-observation-writer.ts
src/lib/backtesting/mlb/live-history/pregame-pitcher-observation-capture.ts
src/lib/backtesting/mlb/live-history/cache.ts
src/lib/backtesting/mlb/live-history/client.ts
src/lib/backtesting/mlb/live-history/concurrency.ts
src/lib/backtesting/mlb/live-history/completion-extractor.ts
src/lib/backtesting/mlb/live-history/types.ts
src/prediction/firewall/odds-contamination-guard.ts

CREATE =
src/prediction/mlb/mlb-historical-materialization-source-adapter.ts
src/prediction/mlb/mlb-historical-dataset-materializer.ts
scripts/materialize-mlb-historical-dataset.ts
tests/prediction/mlb/mlb-historical-materialization-source-adapter.test.ts
tests/prediction/mlb/mlb-historical-dataset-materializer.test.ts

MODIFY =
src/lib/backtesting/mlb/live-history/types.ts
src/lib/backtesting/mlb/live-history/schemas.ts
src/lib/backtesting/mlb/live-history/cache.ts
src/lib/backtesting/mlb/live-history/schedule-loader.ts
src/lib/backtesting/mlb/live-history/outcome-loader.ts
src/lib/backtesting/mlb/live-history/pitcher-feed-loader.ts
src/lib/backtesting/mlb/live-history/team-game-source.ts
src/lib/backtesting/mlb/live-history/pitcher-appearance-source.ts
tests/backtesting/live-history/cache.test.ts
tests/backtesting/live-history/outcome-loader.test.ts
tests/backtesting/live-history/pitcher-feed-loader.test.ts
tests/backtesting/live-history/team-game-source.test.ts
tests/backtesting/live-history/pitcher-appearance-source.test.ts
tests/backtesting/live-history/schedule-loader.test.ts
src/prediction/mlb/mlb-historical-materialization-source-adapter.ts
tests/prediction/mlb/mlb-historical-materialization-source-adapter.test.ts

D2_B_CAN_BE_IMPLEMENTED_WITH_NEW_FILES_ONLY =
NO

NETWORK USE =
YES — real MLB historical source acquisition via existing MLBStatsApiClient

FILESYSTEM WRITE =
YES — caller-supplied output path for materialized JSON dataset

DATABASE USE =
NO

REAL DATA WINDOW =
caller-configurable;
initial smoke window = one explicit completed regular-season calendar date

PREDICTOR CUTOFF =
caller-owned deterministic policy;
CLI exposes `--cutoff-minutes-before-start` as caller configuration;
no permanent fixed 24-hour rule;
absolute cutoff validated before use

PROBABLE STARTER POLICY =
prospective captured observation timestamp <= cutoff only;
otherwise truthful UNKNOWN;
never actual/final starter substitution

TEAM AS_OF =
direct prediction-owned composition of
createMLBHistoricalTeamGameSource().getTeamGames(teamId, season, cutoff)
+
aggregateTeamHistory(games, teamId, cutoff);
must preserve the previously proven fetchTeamStatsAsOf semantics;
provider.ts/provider-factory.ts are not imported

PITCHER AS_OF =
direct prediction-owned composition of
createMLBHistoricalPitcherAppearanceSource().getPitcherAppearances(personId, season, cutoff)
+
aggregatePitcherHistory(appearances, personId, cutoff);
requires a truthfully known pre-cutoff pitcher identity;
provider.ts/provider-factory.ts are not imported

FINAL OUTCOME =
official label only after canonical predictor snapshot exists

ARCHIVAL PROVENANCE =
dataCutoffAt = predictor cutoff;
capturedAt = predictor cutoff;
sourceReferences[*].fetchedAt = actual preserved acquisition provenance;
sourceUpdatedAt = truthful upstream timestamp if known;
reconstructedAt = injected clock;
dataset.createdAt = injected clock

CLOCK =
injected MLBHistoricalMaterializationClock { now(): Date }

OUTPUT FORMAT =
JSON

OUTPUT PATH =
caller-supplied explicit path via `--output`

GENERATED DATA GIT POLICY =
NOT COMMITTED

EXECUTION ENTRYPOINT =
npx tsx scripts/materialize-mlb-historical-dataset.ts --start-date YYYY-MM-DD --end-date YYYY-MM-DD --cutoff-minutes-before-start N --output /path/to/dataset.json

INITIAL CONCURRENCY =
1

TEST FILES =
tests/prediction/mlb/mlb-historical-materialization-source-adapter.test.ts
tests/prediction/mlb/mlb-historical-dataset-materializer.test.ts

REAL SMOKE REQUIRED =
YES

COMMIT BOUNDARY =
yes after ChatGPT review only if unit/regression gates and bounded real smoke pass

## 29. Readiness after D2-A

AFTER PHASE 8V-D2-A:

HISTORICAL CANONICAL SNAPSHOT ADAPTER =
COMPLETE

HISTORICAL LABELLED DATASET BUILDER =
COMPLETE

REAL HISTORICAL MATERIALIZATION PATH =
PLANNED

REAL NETWORK DATASET ORCHESTRATION =
NOT YET IMPLEMENTED

REAL MATERIALIZED HISTORICAL DATASET =
NOT YET CREATED

REAL FEATURE MANIFEST =
MISSING

REAL TRAINING MATRIX =
MISSING

TRAINER IMPLEMENTATION =
EXISTS_AND_TESTED_SYNTHETIC_ONLY

TRAINER EXECUTED ON REAL MLB DATA =
NO

LEGITIMATE TRAINED MLB ARTIFACT =
NO

PRODUCTION MODEL RELEASE =
NO

REAL MODEL-BACKED INFERENCE =
NO
