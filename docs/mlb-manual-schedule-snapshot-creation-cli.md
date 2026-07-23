# MLB Manual Schedule Snapshot Creation CLI

## Status

Local-only.
Stdout-only.
Reads one user-provided local JSON path.
Validates before conversion.
Creates an in-memory snapshot and prints deterministic JSON.
No file output.
No live source used.
No real MLB API request made.
No web lookup used.
No network schedule ingestion.
No generated prospective run artifact committed.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
modelProbability remains null/absent/not available until calibrated.

## Command

```bash
npm run prospective:mlb:create-manual-snapshot -- tests/prospective/fixtures/manual-schedule/valid-manual-schedule-v1.json
```

## Purpose

Phase 4L converts a validated manual schedule JSON file into a deterministic MLB prospective schedule snapshot for local dry-run preparation.
The command validates the parsed input with `validateMLBManualScheduleFile` before it converts anything, then uses `buildScheduleSnapshotFromManualScheduleFile` in memory.
The snapshot is printed to stdout and is not written to a file.

## Input

- Exactly one user-provided local JSON path.
- The JSON must conform to schemaVersion `"mlb-manual-schedule-v1"`.
- Validation always happens before conversion.
- Additional positional paths are rejected.

## Output

The deterministic JSON summary contains:

- `ok`
- `runId`, when available
- `sourceMode`, when available
- `weekStart`, when available
- `weekEnd`, when available
- `snapshotTimestamp`, when available
- `gameCount`
- `validationMessageCount`
- `validationErrorCount`
- `validationWarningCount`
- `validationMessages`
- `snapshot`, only when valid

Argument, read, and parse failures also include `error`.
Missing-path and multiple-path failures also include `usage`.
Validation messages preserve validator order.
The snapshot and summary `snapshotTimestamp` use input `createdAt`; the command does not create a current timestamp.

## Exit behavior

- Missing path exits 1 and includes no snapshot.
- Multiple paths exit 1 and include no snapshot.
- Read or parse failure exits 1 and includes no snapshot.
- Validation errors exit 1 and include no snapshot.
- Valid input exits 0 and includes the in-memory snapshot.

## Safety boundary

- No live/API/web source is used.
- No network schedule ingestion is performed.
- No file output or generated artifacts are created.
- No historical fixture data is read, added, or modified by the command.
- No result or outcome attachment is performed.
- Actual starters remain evaluation-only.
- Pregame snapshots exclude final score, completed game state, actual starter, outcome, and final-status fields.
- modelProbability remains null/absent/not available until calibrated.

## Validation

- Fixture inventory guard passes with 29 games from 2024-06-01 through 2024-07-21 (June 17, July 12).
- Prospective dry-run check passes with no validation errors or warnings.
- Phase 4L focused CLI tests pass: 7 tests.
- Prospective suite passes: 53 tests.
- Backtesting suite passes: 699 tests.
- Full Vitest and `npm test` pass: 809 tests across 55 files.
- TypeScript passes.
- Production build passes.
- Historical export review behavior passes in all four release-check modes.
- Git diff check passes.
- The valid local fixture produces a two-game snapshot with `sourceMode` `"manual-schedule"` and `snapshotTimestamp` `"2024-07-01T00:00:00Z"`.
- The invalid forbidden-fields fixture exits 1 with five validation errors and no snapshot.
- In the managed validation sandbox, npm commands whose `tsx` launcher opened a local IPC listener were blocked with `EPERM` before script execution. The same validator, snapshot, and historical review entry points passed through the local `tsx/cjs` loader without an IPC listener; the required package script remains the planned `tsx` command.

## Recommended next safe phase

Phase 4M — add golden output tests for the manual schedule snapshot CLI.

State:

- local-only
- fixture-only
- locks exact stdout JSON for valid and invalid snapshot CLI cases
- no file output
- no live/API/web
- no network schedule ingestion
- no generated run artifacts committed
- no historical fixture data changes
