# MLB Prospective Weekly Test Mode Plan

Documentation-only plan.
No live source used.
No real MLB API request made.
No web lookup used.
No new fixture data added.
No fixture game records modified.
No code implemented.
No generated artifacts committed.
No model-quality or predictive-performance claim.
No modelProbability until calibrated.

## Purpose

This plan defines how to move from local historical fixture testing toward future real MLB weekly testing without leakage, odds, or hindsight.
It is documentation-only and does not implement live mode or fetch real schedules.

## Current foundation

- local MLB fixture inventory: 29 games
- fixture range: 2024-06-01 through 2024-07-21
- fixture inventory reporting fields: monthSummaries, dateSummaries, localSliceSummaries
- export/review tooling exists
- threshold/release/rollout validation exists
- TEAM_ONLY and FULL comparison concepts exist
- modelProbability remains absent/null/not available until calibrated
- actual starters remain evaluation-only
- no live/API authorization exists yet

## Prospective weekly test objective

Later, we want to run the engine on upcoming MLB games before they start.
The output must be timestamped and locked before first pitch.
After games complete, outcomes can be attached.
Weekly reports can compare pre-game research outputs against final results.
This must remain odds-blind and leakage-safe.

## Core artifacts

1. Weekly run manifest
   - runId
   - sport
   - weekStart
   - weekEnd
   - generatedAt
   - source mode
   - run status
   - safety warnings

2. Prospective schedule snapshot
   - gameId or stable local identifier
   - officialDate
   - scheduled start time
   - teams
   - snapshot timestamp
   - source provenance
   - no final scores
   - no completed game state

3. Pre-game research snapshot
   - game identifier
   - createdAt
   - research construction mode
   - evidence included/excluded
   - researchStrengthScore
   - confidence/matchConfidence if already part of current architecture
   - dataQuality
   - volatility
   - warnings
   - modelProbability absent/null/not available

4. Locked weekly output
   - immutable-ish pre-game record
   - lock timestamp
   - lock reason
   - games included
   - games skipped/abstained
   - validation status

5. Outcome attachment
   - attached only after final completion
   - result timestamp
   - final status
   - final score/result where appropriate
   - completion provenance
   - must use existing historical completion safety principles

6. Weekly evaluation report
   - number of games processed
   - number of locked outputs
   - abstentions/skips
   - warning summary
   - result attachment status
   - no modelProbability until calibrated
   - no predictive-quality claim until enough samples and calibration process exists

## Data-source stages

Stage 0 — local prospective dry-run
- use deterministic local test fixtures only
- no live/API/web
- goal: validate artifact shape and locking flow

Stage 1 — manually supplied real schedule file
- user provides a static schedule file or manually copied schedule data
- no agent web/API fetch
- goal: test real-week workflow with explicit user-provided input

Stage 2 — authorized schedule ingestion
- only after explicit user authorization
- source adapter must be documented
- source provenance must be recorded
- no final result fields in pre-game snapshot

Stage 3 — outcome attachment
- attach results only after game completion
- completion provenance required
- no retrospective promotion of schedule probable info

Stage 4 — weekly evaluation
- report outcomes against locked pre-game outputs
- no calibration claims until enough samples exist

## Leakage prevention rules

- pre-game snapshots must not include final scores/results
- pre-game snapshots must not include completed game state
- outcome fields remain absent until after lock and completion
- actual starters remain evaluation-only
- schedule probable info must preserve timestamp uncertainty
- no historical schedule probable retrospective promotion
- generatedAt/createdAt/lockedAt must be explicit
- source provenance required for each snapshot
- no odds/market data
- no modelProbability until calibrated

## Directory and file conventions

Future local paths, but do not create generated run files now:
- data/prospective/mlb/<runId>/manifest.json
- data/prospective/mlb/<runId>/schedule-snapshot.json
- data/prospective/mlb/<runId>/pregame-research.json
- data/prospective/mlb/<runId>/locked-output.json
- data/prospective/mlb/<runId>/outcomes.json
- data/prospective/mlb/<runId>/weekly-evaluation.json

Note:
Generated run artifacts should remain ignored or uncommitted unless explicitly promoted as tiny fixtures/goldens.

## Proposed types/schemas for future implementation

Planned TypeScript concepts:
- MLBProspectiveWeeklyRunManifest
- MLBProspectiveScheduleSnapshot
- MLBProspectiveGameSnapshot
- MLBPregameResearchSnapshot
- MLBLockedWeeklyOutput
- MLBOutcomeAttachment
- MLBWeeklyEvaluationReport

Keep this conceptual; do not implement types in this phase.

## CLI/command plan

Future command names without adding package scripts now:
- prospective:mlb:plan-week
- prospective:mlb:create-snapshot
- prospective:mlb:lock-week
- prospective:mlb:attach-outcomes
- prospective:mlb:evaluate-week

Each command at a high level:
- prospective:mlb:plan-week: define intended week and safety checks without producing research
- prospective:mlb:create-snapshot: build schedule snapshot and pre-game research snapshots
- prospective:mlb:lock-week: freeze pre-game outputs before first scheduled start
- prospective:mlb:attach-outcomes: attach final completion/result data after games finish
- prospective:mlb:evaluate-week: produce weekly evaluation summary from locked outputs and outcomes

Names can change during implementation.

## Validation plan

Future implementation should test:
- snapshot shape
- no final outcome fields before lock
- lock timestamps exist
- outcome attachment refuses pre-lock mutation
- evaluation uses locked pre-game outputs
- modelProbability remains absent/null
- no source=live unless explicitly authorized in a future phase
- no fixture data changes during prospective dry-run planning

## Success criteria for first real-week test

- schedule snapshot created before games start
- pre-game outputs locked before games start
- no final scores/results present before lock
- outcomes attached after completion
- weekly report generated
- all warnings and abstentions surfaced
- no odds/market data used
- no modelProbability claims
- all artifacts have timestamps and provenance

## Current readiness assessment

- local historical fixture foundation: strong early foundation
- prospective weekly testing: not implemented yet
- estimated MLB real-week testing readiness after Phase 3C: about 40-45%
- completing Phase 4A only improves architecture clarity, not functional readiness
- implementing Stage 0/1 later could move readiness toward 50-60%

## Phase 4T locked-week construction handoff

Phase 4T is planning-only and is documented in `docs/mlb-weekly-prospective-research-construction-plan.md`. It plans the future handoff from the exact validated locked week artifact to deterministic pre-game research skeleton construction. It does not implement construction or change Phase 4R/4S lock behavior or goldens.

## Phase 4U stdout-only construction

Phase 4U implemented the handoff as `npm run prospective:mlb:construct-week -- <locked-week-artifact-json>`. Its input is the exact locked `lockedSnapshot` artifact, not a raw manual schedule. The local-only no-flag command validates before constructing a deterministic stdout package with one pre-game `pending-research` `FULL` stub per locked game. Phase 4U itself added no file output or network ingestion and left the Phase 4P no-flag and Phase 4S file-output lock goldens unchanged.

## Phase 4V construction stdout golden tests

Phase 4V added byte-for-byte no-flag stdout goldens for the valid construction package and representative invalid locked artifacts. At that phase, Phase 4U behavior and the Phase 4P/4S lock goldens remained unchanged and construction file output was not yet implemented.

## Phase 4W construction file-output plan

Phase 4W planned construction file output in `docs/mlb-weekly-prospective-research-construction-file-output-plan.md`.

## Phase 4X construction file-output implementation

Phase 4X implements double-opt-in construction file output with `--write-file` plus `--output-dir`. It writes the exact inner construction package using a deterministic filename, prints a summary without `package`, reports only a relative artifact path, and refuses overwrite. Generated artifacts remain local, ignored, and uncommitted. Phase 4U no-flag behavior, the Phase 4V construction stdout goldens, and the Phase 4P/4S lock goldens remain unchanged.

## Phase 4Z first research module handoff plan

Phase 4Z is planning-only and is documented in `docs/mlb-first-research-module-handoff-plan.md`. It proposes the MLB team recent form module, consuming the exact Phase 4X/4Y construction package artifact and enriching pregame research without predicting. It introduces no `modelProbability`, pitcher evidence, live/API/web access, network schedule ingestion, or historical fixture change. The Phase 4V/4Y construction goldens and Phase 4P/4S lock goldens remain unchanged.

## Recommended next safe phase

Phase 5I completed planning for safe result-derived aggregate metrics in `docs/mlb-team-recent-form-result-aggregate-metrics-plan.md`. It does not add implementation, file output, research behavior, `modelProbability`, pitcher evidence, actual starters, live/API/web access, network schedule ingestion, or historical fixture changes.

The recommended next safe phase is Phase 5J: implement safe result-derived aggregate metrics behind explicit local-only mode.

## Phase 5E validation

- Phase 5E locks exact `--fixture-evidence-local` stdout golden in `tests/prospective/fixtures/manual-schedule/valid-mlb-team-recent-form-research-fixture-evidence-local-cli-output-v1.json`.
- Golden contains `fixtureEvidenceLocal: true`, deterministic insufficient evidence for current local fixtures, exact `inputConstructionPackage` embedding, no `modelProbability`, no `finalScore`, no `completedGameState`, no `actualStartingPitchers`, no absolute paths, and no stack traces.
- Phase 5D provider behavior unchanged.
- No new research behavior, file output, dependency, or fixture data change introduced.

Phase 5D implemented the local fixture evidence provider in `docs/mlb-team-recent-form-fixture-evidence-provider.md`. It adds no real schedule ingestion, no live source, no network access, no historical fixture changes, and no `modelProbability` prediction output.

## Phase 5C local fixture evidence plan

Phase 5C is planning-only. It defined a future pure local evidence provider, deterministic three-game/30-day lookback, safe completion derived only from the last completed play end with `LAST_COMPLETED_PLAY_END` provenance, and per-target exclusion of the target game and future games. It changes no Phase 5A behavior or Phase 5B golden.

## Phase 5K result-aggregate-metrics golden

Phase 5K added exact stdout golden regression coverage for the explicit result-metrics mode in `tests/prospective/fixtures/manual-schedule/valid-mlb-team-recent-form-research-result-aggregate-metrics-local-cli-output-v1.json`. It preserves Phase 5B/5E/5H goldens and adds no live/API/web access, network schedule ingestion, or historical fixture changes.

## Phase 5L team context planning

Phase 5L is planning-only and adds the next TEAM_ONLY schedule context module design in `docs/mlb-team-context-rest-travel-schedule-density-plan.md`. It does not implement runtime behavior, file output, `modelProbability`, pitcher evidence, actual starters, live/API/web access, network schedule ingestion, or historical fixture changes. Phase 5B/5E/5H/5K goldens and Phase 5J behavior remain unchanged.

## Phase 5M

Phase 5M implemented MLB TEAM_ONLY schedule context behind explicit local-only mode in `docs/mlb-team-schedule-context-implementation.md`. It adds an explicit `--fixture-evidence-local --team-schedule-context-local` mode, preserves default Phase 5B/5E/5H/5K goldens, and keeps `modelProbability` and raw outcome fields absent.

The recommended next safe phase is Phase 5N: add exact stdout golden regression coverage for the schedule context mode.

Phase 5O is planning-only for richer synthetic local schedule-density fixture coverage. It adds `docs/mlb-team-schedule-context-synthetic-fixtures-plan.md`, does not modify runtime behavior, tests, goldens, or fixtures, and preserves Phase 5B/5E/5H/5K/5N goldens with no modelProbability, no raw outcomes, no pitcher evidence, no file output, and no live/API/web.