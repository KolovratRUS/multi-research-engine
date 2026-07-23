# MLB Manual Schedule Snapshot Creation Plan

## Status

Planning-only.
No live source used.
No real MLB API request made.
No web lookup used.
No real schedule network/API ingestion.
No snapshot creation implemented.
No snapshot files written.
No lock-file creation.
No generated prospective run artifact committed.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
modelProbability remains null/absent/not available until calibrated.

## Purpose

Phase 4K plans a future local command that converts a validated, user-provided manual schedule JSON file into an `MLBProspectiveScheduleSnapshot`.
This is the next step after the Phase 4I validator CLI and Phase 4J validator CLI golden-output tests.
This phase defines the intended command, mapping, output contract, validation behavior, tests, and safety boundary without implementing snapshot creation.

## Current foundation

- Phase 4G provides the manual schedule schema, validator, and converter helper.
- Phase 4H provides static fixtures and golden validator outputs.
- Phase 4I provides the validator CLI.
- Phase 4J provides exact validator CLI golden outputs.
- The current converter helper is `buildScheduleSnapshotFromManualScheduleFile`.
- The current CLI validates only and does not create snapshots.
- The historical fixture inventory remains 29 games (June 17, July 12).

## Proposed future command

Planned name only; do not implement in this phase:

```text
prospective:mlb:create-manual-snapshot
```

Planned script path only; do not implement in this phase:

```text
scripts/mlb-manual-schedule-create-snapshot.ts
```

## Planned input

- Accept exactly one user-provided local JSON file path.
- Require the input to pass `validateMLBManualScheduleFile` before conversion.
- Require manual schedule `schemaVersion` `"mlb-manual-schedule-v1"`.
- Use no network/API/web source.
- Perform no real source fetching.
- Have no historical fixture dependency.

## Planned output modes

Start with a stdout-only deterministic JSON summary containing:

- `ok`
- `runId`
- `sourceMode`
- `weekStart`
- `weekEnd`
- `snapshotTimestamp`
- `gameCount`
- `validationMessageCount`
- `validationErrorCount`
- `validationWarningCount`
- `validationMessages`
- `snapshot`, only when valid

The first implementation should not add file output. File-output mode should be considered only after stdout golden tests exist.
Generated prospective run artifacts must not be committed by default.

## Snapshot mapping

The future command should validate first, then use `buildScheduleSnapshotFromManualScheduleFile`.

Mapping from `MLBManualScheduleFile` to the command summary and `MLBProspectiveScheduleSnapshot`:

- `runId` comes from `input.runId`.
- `sourceMode` remains `"manual-schedule"`.
- Summary `weekStart` and `weekEnd` come from the input. The current snapshot schema does not duplicate these summary fields.
- Snapshot `createdAt` comes from `input.createdAt`.
- Summary `snapshotTimestamp` comes from `input.createdAt`.
- Each snapshot game's `snapshotTimestamp` comes from `input.createdAt`.
- Snapshot games come from `input.games`.
- Each game maps `gameId`, `officialDate`, `scheduledStartTime`, `awayTeam`, and `homeTeam`.
- Each game's `sourceProvenance` comes from `game.sourceProvenance`.
- Snapshot `warnings` are empty initially.
- Snapshot games contain no `finalScore`.
- Snapshot games contain no `completedGameState`.
- Snapshot games contain no `actualStartingPitchers`.
- Snapshot games contain no outcome or final-status fields.

## Validation and exit behavior

- Missing path exits 1.
- Multiple paths exit 1.
- Read or parse failure exits 1.
- Validation errors exit 1 and produce no snapshot.
- Valid input exits 0 and emits the snapshot summary.
- The invalid fixture remains an expected exit 1 case.
- Output must remain deterministic and suitable for exact golden testing.

## Safety boundary

- Snapshot creation from a manual file is local-only.
- The manual schedule file must be pre-game only.
- Outcome attachment remains separate and post-completion only.
- Actual starters remain evaluation-only.
- If starter-like schedule data is added later, schedule probable timestamp uncertainty must be preserved.
- modelProbability remains null/absent/not available until calibration exists.
- No live/API/web source is used.
- No network schedule ingestion is performed.
- No historical fixture data is mutated.
- No generated run artifacts are committed by default.

## Planned tests for future implementation

- Valid fixture creates deterministic snapshot stdout.
- Invalid fixture exits 1 and produces no snapshot.
- Missing and multiple path errors are reported.
- Malformed JSON returns a read/parse error.
- Snapshot excludes `finalScore` and `completedGameState`.
- Converted snapshot passes `validateProspectiveScheduleSnapshot`.
- Valid snapshot stdout matches an exact golden output.
- No output files are written.

## Implementation staging

- Phase 4L — add manual schedule snapshot creation CLI, stdout-only, with no file output.
- Phase 4M — add golden-output tests for the manual schedule snapshot CLI.
- Phase 4N — plan the `lock-manual-week` workflow.
- Phase 4O — implement `lock-manual-week` only after planning and goldens.

## Success criteria

- Existing validator CLI remains unchanged.
- Valid manual schedule JSON can be converted into a deterministic prospective schedule snapshot.
- No invalid or forbidden pre-game fields can reach a snapshot.
- No network/API/web calls are needed.
- No generated artifacts are committed.
- Historical fixture inventory remains unchanged.

## Recommended next safe phase

Phase 4L — add manual schedule snapshot creation CLI.

State:

- local-only
- stdout-only
- reads one user-provided local JSON path
- validates first
- creates an in-memory snapshot and then prints deterministic JSON
- no file output
- no live/API/web
- no network schedule ingestion
- no generated run artifacts committed
- no historical fixture data changes
