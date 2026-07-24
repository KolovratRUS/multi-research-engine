# MLB Manual Week Lock CLI

## Status

Local-only.
No-flag mode remains stdout-only.
Explicit file-output mode is available only with both required flags.
Reads one user-provided local manual schedule JSON path.
Validates before conversion and locking.
Converts in memory.
Wraps the snapshot in deterministic `lockedSnapshot`.
Writes no file unless both `--write-file` and `--output-dir` are present.
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
Phase 4R adds a double-opt-in local file mode. It validates first and writes the exact `lockedSnapshot` only after every validation and destination safety check passes.
Phase 4S adds exact fixture-only golden coverage for the valid file artifact and file-mode stdout summary without changing Phase 4R behavior or the Phase 4P no-flag goldens.

## Input

- Exactly one user-provided local manual schedule JSON path.
- The JSON must conform to schemaVersion `"mlb-manual-schedule-v1"`.
- Validation always happens before conversion and locking.
- Additional positional paths are rejected.
- No-flag form: `<path-to-json>`.
- File form: `<path-to-json> --write-file --output-dir <directory>`.
- The two file flags may appear in either order after the input path.

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
- `outputMode`, value `"file"`, only after entering valid explicit file mode
- `artifactWritten`, true only after a successful final write
- `artifactFilename`, only after a successful write
- `artifactPath`, relative or filename-only and never absolute
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

## File artifact

The deterministic filename is:

```text
<weekStart>__<weekEnd>__<runId>__manual-week-lock-v1.json
```

For the committed valid local fixture it is:

```text
2024-07-01__2024-07-07__manual-schedule-fixture-week-1__manual-week-lock-v1.json
```

The artifact body equals `summary.lockedSnapshot` exactly. It is pretty JSON with a trailing newline. It does not contain the outer CLI summary, absolute paths, current timestamps, or final/completion/starter/outcome fields. Generated artifacts are local files and must not be committed.

The command rejects unsafe filename components, destination escape, output beneath `tests/` or `src/fixtures/`, and an existing final file. It creates the output directory only after validation succeeds and uses a same-directory temporary file plus a no-overwrite final link.

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
- `--write-file` without `--output-dir` exits 1.
- `--output-dir` without `--write-file` exits 1.
- `--output-dir` without a value exits 1.
- Unknown flags exit 1.
- Read or parse failure exits 1 and includes no `lockedSnapshot`.
- Validation errors exit 1 and include no `lockedSnapshot`.
- Valid input exits 0 and includes `lockedSnapshot`.
- Valid file mode exits 0 only after exactly one final artifact is written.
- Unsafe output, existing output, or write failure exits 1 without reporting `artifactWritten: true`.

New Phase 4R argument/write error codes:

- `MANUAL_WEEK_LOCK_OUTPUT_DIR_REQUIRED`
- `MANUAL_WEEK_LOCK_WRITE_FILE_REQUIRED`
- `MANUAL_WEEK_LOCK_OUTPUT_DIR_VALUE_REQUIRED`
- `MANUAL_WEEK_LOCK_UNKNOWN_ARGUMENT`
- `MANUAL_WEEK_LOCK_OUTPUT_DIR_UNSAFE`
- `MANUAL_WEEK_LOCK_OUTPUT_PATH_EXISTS`
- `MANUAL_WEEK_LOCK_WRITE_FAILED`

## Safety boundary

- No live, API, or web source is used.
- No network schedule ingestion is performed.
- No file output occurs without the double opt-in.
- Generated file-mode artifacts remain local and uncommitted.
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
- File mode writes the deterministic artifact only after validation, reports a relative artifact path, and serializes the exact `lockedSnapshot`.
- Phase 4S exact file-mode stdout and artifact goldens match the deterministic valid fixture output.
- Focused Phase 4O/4P/4R/4S lock CLI tests pass: 24 tests, including exact unchanged valid and invalid no-flag stdout goldens.
- Historical export release behavior passes in all four modes through the local loader.
- Focused historical export rollout review tests pass: 154 tests.
- Prospective tests pass: 79 tests.
- Backtesting tests pass: 699 tests.
- Full Vitest and `npm test` pass: 835 tests across 56 files.
- TypeScript passes.
- Production build passes.
- Git diff check passes.
- Safety searches find no newly added restricted terminology, prohibited live-source execution, or calibration claim.
- The valid and invalid lock stdout objects match the Phase 4P golden fixtures exactly; the valid nested snapshot passes `validateProspectiveScheduleSnapshot`.
- The manual file-mode artifact and output directory were removed after verification; no generated lock artifact remains.
- In the managed validation sandbox, direct npm commands whose `tsx` launcher opens a local IPC listener are blocked with `EPERM` before script execution. The inventory, dry-run, validator, snapshot, no-flag lock, file-mode lock, and historical review entry points pass through the existing local `tsx/cjs` loader pattern without an IPC listener; package scripts remain unchanged.

## Phase 4P golden-output tests

Phase 4P locks the exact parsed stdout JSON for the valid exit 0 case and the invalid expected exit 1 case.
See `docs/mlb-manual-week-lock-cli-golden-output.md`.

Golden output fixtures:

- `tests/prospective/fixtures/manual-schedule/valid-manual-week-lock-cli-output-v1.json`
- `tests/prospective/fixtures/manual-schedule/invalid-forbidden-fields-week-lock-cli-output-v1.json`

## Phase 4Q/4R file-output contract

Phase 4Q planned the explicit file-output mode in `docs/mlb-manual-week-lock-file-output-plan.md`.
Phase 4R implements it while preserving the Phase 4P no-flag valid and invalid stdout goldens exactly.

## Phase 4S file-output golden tests

Phase 4S locks the exact valid artifact body and file-mode stdout summary in `docs/mlb-manual-week-lock-file-output-golden-tests.md`. Generated artifacts remain local and uncommitted, and the deterministic test directory is removed after every test.

## Phase 4T locked-week construction handoff

Phase 4T is planning-only and defines how the exact validated `lockedSnapshot` artifact will feed future deterministic pre-game research skeleton construction. See `docs/mlb-weekly-prospective-research-construction-plan.md`. It does not implement construction or change Phase 4R/4S lock behavior or goldens.

## Phase 4U stdout-only construction

Phase 4U adds the separate `prospective:mlb:construct-week` consumer for the exact file-mode `lockedSnapshot` artifact. It does not accept the raw manual schedule. It validates the artifact and emits a deterministic stdout package with one pre-game `pending-research` `FULL` stub per locked game. Construction has no file-output flags, and this lock CLI plus the Phase 4P/4S goldens remain unchanged.

## Phase 4V construction stdout golden tests

Phase 4V locks the valid construction package and representative invalid construction summaries byte-for-byte. It leaves the Phase 4U implementation and all Phase 4P/4S lock behavior and goldens unchanged. Construction still has no file output.

## Recommended next safe phase

Phase 4W — plan file-output mode for constructed weekly research packages.

State:

- planning-only
- no implementation
- no file output yet
- no live/API/web
- no network schedule ingestion
- no generated run artifacts committed
- no historical fixture data changes
