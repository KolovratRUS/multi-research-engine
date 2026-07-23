# MLB Manual Week Lock CLI

## Status

Local-only.
Stdout-only.
Reads one user-provided local manual schedule JSON path.
Validates before conversion and locking.
Converts in memory.
Wraps the snapshot in deterministic `lockedSnapshot`.
No file output.
No live source used.
No real MLB API request made.
No web lookup used.
No network schedule ingestion.
No generated prospective run artifact committed.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
`modelProbability` remains null/absent/not available until calibrated.

## Command

```bash
npm run prospective:mlb:lock-manual-week -- tests/prospective/fixtures/manual-schedule/valid-manual-schedule-v1.json
```

## Purpose

Phase 4O converts a validated manual schedule JSON into a prospective schedule snapshot and then wraps it in a deterministic weekly lock object for later prospective research construction.
The command validates the parsed input with `validateMLBManualScheduleFile` before conversion, uses `buildScheduleSnapshotFromManualScheduleFile` in memory, and prints the summary and valid-only lock to stdout.

## Input

- Exactly one user-provided local manual schedule JSON path.
- The JSON must conform to schemaVersion `"mlb-manual-schedule-v1"`.
- Validation always happens before conversion and locking.
- Additional positional paths are rejected.

## Output

The deterministic JSON summary contains:

- `ok`
- `runId`, when available
- `lockId`, when `runId` is available
- `sourceMode`, when available
- `weekStart`, when available
- `weekEnd`, when available
- `lockedAt`, when `createdAt` is available
- `snapshotTimestamp`, when `createdAt` is available
- `gameCount`
- `validationMessageCount`
- `validationErrorCount`
- `validationWarningCount`
- `validationMessages`
- `lockedSnapshot`, only when valid

Argument, read, and parse failures also include `error`.
Missing-path and multiple-path failures also include `usage`.
Validation messages preserve validator order.

## `lockedSnapshot`

The valid-only wrapper contains:

- `lockVersion`
- `runId`
- `lockId`
- `sourceMode`
- `weekStart`
- `weekEnd`
- `lockedAt`
- `snapshot`
- `validationMessages`
- `warnings`

The wrapper preserves the existing prospective schedule snapshot instead of duplicating or mutating its games.
Its `lockVersion` is `"mlb-manual-week-lock-v1"`, its `sourceMode` is `"manual-schedule"`, and its initial `warnings` array is empty.

## Determinism

- `lockId = manual-week-lock:<runId>`
- `lockedAt = input.createdAt`
- `snapshotTimestamp = input.createdAt`
- No current timestamp is read.
- No file metadata is read.
- No path hashing is used.
- No absolute path is included in output.

## Exit behavior

- Missing path exits 1 and includes no `lockedSnapshot`.
- Multiple paths exit 1 and includes no `lockedSnapshot`.
- Read or parse failure exits 1 and includes no `lockedSnapshot`.
- Validation errors exit 1 and include no `lockedSnapshot`.
- Valid input exits 0 and includes `lockedSnapshot`.

## Safety boundary

- No live, API, or web source is used.
- No network schedule ingestion is performed.
- No file output or generated artifacts are created.
- No historical fixture data is read, added, or modified by the command.
- No outcome attachment is performed.
- Actual starters remain evaluation-only.
- `TEAM_ONLY` excludes pitcher evidence.
- Phase 1G-b observations remain unread and unused for pitcher availability.
- `researchStrengthScore`, `confidence`, `matchConfidence`, `dataQuality`, `volatility`, and `modelProbability` remain separate concepts.
- `modelProbability` remains null/absent/not available until calibrated.

## Validation

- Fixture inventory guard passes with 29 games from 2024-06-01 through 2024-07-21: June 17 and July 12.
- Prospective dry-run logic passes with zero validation errors and warnings.
- Valid manual schedule validator and snapshot logic each exit 0 with two games and no validation messages.
- Valid manual week lock logic exits 0 with deterministic `lockId`, `lockedAt`, `snapshotTimestamp`, and a two-game `lockedSnapshot`.
- Invalid forbidden-fields lock logic exits 1 by design with five validation errors and no `lockedSnapshot`.
- Focused Phase 4O lock CLI tests pass: 8 tests.
- Historical export release behavior passes in all four modes through the local loader.
- Focused historical export rollout review tests pass: 154 tests.
- Prospective tests pass: 63 tests.
- Backtesting tests pass: 699 tests.
- Full Vitest and `npm test` pass: 819 tests across 56 files.
- TypeScript passes.
- Production build passes.
- Git diff check passes.
- In the managed validation sandbox, direct npm commands whose `tsx` launcher opens a local IPC listener are intermittently blocked with `EPERM` before script execution. The validator, snapshot, lock, and historical review entry points pass through the existing local `tsx/cjs` loader pattern without an IPC listener; the requested package command remains the `tsx` command.

## Recommended next safe phase

Phase 4P — add golden output tests for the `lock-manual-week` CLI.

State:

- local-only
- fixture-only
- locks exact stdout JSON for valid and invalid lock CLI cases
- no file output
- no live/API/web
- no network schedule ingestion
- no generated run artifacts committed
- no historical fixture data changes
