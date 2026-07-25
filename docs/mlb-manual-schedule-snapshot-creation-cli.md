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
- Phase 4M focused snapshot CLI tests pass: 9 tests.
- Phase 4M prospective tests pass: 55 tests.
- Phase 4M full Vitest and `npm test` pass: 811 tests across 55 files.

## Phase 4M golden-output tests

Phase 4M locks the exact parsed stdout JSON for the valid exit 0 case and the invalid expected exit 1 case.
See `docs/mlb-manual-schedule-snapshot-cli-golden-output.md`.

Golden output fixtures:

- `tests/prospective/fixtures/manual-schedule/valid-manual-schedule-snapshot-cli-output-v1.json`
- `tests/prospective/fixtures/manual-schedule/invalid-forbidden-fields-snapshot-cli-output-v1.json`

## Phase 4N manual week lock workflow plan

Phase 4N planned the separate workflow that validates, converts, and wraps a manual schedule snapshot in a deterministic locked snapshot.
See `docs/mlb-manual-week-lock-workflow-plan.md`.
The Phase 4L snapshot CLI remains stdout-only snapshot conversion and does not lock or write files.

## Phase 4O manual week lock CLI

Phase 4O implements the separate lock CLI documented in `docs/mlb-manual-week-lock-cli.md`.
The snapshot CLI remains responsible only for validation and in-memory snapshot conversion; the lock CLI owns the deterministic wrapper, and neither command writes files.

## Phase 4P manual week lock CLI golden outputs

Phase 4P adds exact stdout regression fixtures for the separate lock CLI.
See `docs/mlb-manual-week-lock-cli-golden-output.md`.
The snapshot CLI remains conversion-only and its Phase 4M goldens remain separate.

## Phase 4Q manual week lock file-output plan

Phase 4Q planned future file output only for the separate lock CLI.
See `docs/mlb-manual-week-lock-file-output-plan.md`.
Phase 4R implements that separate lock file mode. The snapshot CLI remains stdout-only and conversion-only, with no snapshot file output or behavior change.

## Phase 4S lock file-output goldens

Phase 4S adds exact fixture-only regression coverage for the valid lock artifact and file-mode stdout summary. Phase 4R implementation behavior remains unchanged, the Phase 4P no-flag goldens remain protected, and generated lock artifacts remain local and uncommitted. See `docs/mlb-manual-week-lock-file-output-golden-tests.md`.

## Phase 4T locked-week construction handoff

Phase 4T is planning-only and defines how the exact validated lock artifact will feed future deterministic pre-game research skeleton construction. See `docs/mlb-weekly-prospective-research-construction-plan.md`. It does not implement construction or change Phase 4R/4S lock behavior or goldens.

## Phase 4U stdout-only construction

Phase 4U added the separate `prospective:mlb:construct-week` command. Its no-flag form accepts the exact locked `lockedSnapshot` artifact rather than this CLI's raw manual schedule input, validates it, and emits a deterministic stdout package with one pre-game `pending-research` `FULL` stub per game. Phase 4U itself added no file output or network ingestion and left Phase 4P/4S lock goldens unchanged.

## Phase 4V construction stdout golden tests

Phase 4V adds byte-for-byte stdout goldens for the valid construction package and representative invalid locked artifacts. The Phase 4U implementation and Phase 4P/4S lock goldens remain unchanged. Construction still has no file output.

## Phase 4W construction file-output plan

Phase 4W planned construction file output in `docs/mlb-weekly-prospective-research-construction-file-output-plan.md`. Phase 4X implements the double-opt-in mode without changing this stdout-only snapshot CLI. It writes the exact inner construction package, emits summary-only file-mode stdout, refuses overwrite, and leaves Phase 4U no-flag behavior plus the Phase 4V, Phase 4P, and Phase 4S goldens unchanged.

## Phase 4Z first research module handoff plan

Phase 4Z is planning-only and is documented in `docs/mlb-first-research-module-handoff-plan.md`. It proposes the MLB team recent form module from the exact Phase 4X/4Y construction package artifact, not from this raw schedule or snapshot directly. It enriches pregame research without predicting and adds no `modelProbability`, pitcher evidence, live/API/web access, or network schedule ingestion. Phase 4V/4Y construction and Phase 4P/4S lock goldens remain unchanged.

## Recommended next safe phase

Phase 5A — implement a local-only, stdout-only MLB team recent form research module skeleton from the exact construction artifact, using fixture/local evidence only, with no file output, pitcher evidence, actual starters, `modelProbability`, generated committed artifact, live/API/web access, or network schedule ingestion.
