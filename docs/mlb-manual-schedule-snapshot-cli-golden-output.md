# MLB Manual Schedule Snapshot CLI Golden Output

## Status

Local-only.
Fixture-only.
Exact stdout JSON regression tests.
No file output.
No live source used.
No real MLB API request made.
No web lookup used.
No network schedule ingestion.
No generated prospective run artifact committed.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
modelProbability remains null/absent/not available until calibrated.

## Purpose

Phase 4M locks the exact stdout JSON for the valid and invalid manual schedule snapshot CLI cases. The tests compare parsed CLI stdout with committed local golden fixtures, including validator message order and the valid-only snapshot field.

## Golden output fixtures

- `tests/prospective/fixtures/manual-schedule/valid-manual-schedule-snapshot-cli-output-v1.json`
- `tests/prospective/fixtures/manual-schedule/invalid-forbidden-fields-snapshot-cli-output-v1.json`

## Commands covered

```bash
npm run prospective:mlb:create-manual-snapshot -- tests/prospective/fixtures/manual-schedule/valid-manual-schedule-v1.json
npm run prospective:mlb:create-manual-snapshot -- tests/prospective/fixtures/manual-schedule/invalid-forbidden-fields-v1.json
```

The valid command exits 0 and includes a snapshot. The invalid command exits 1 by design and includes no snapshot.

## Locked output fields

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
- `snapshot`, only for valid input

## Safety boundary

- Golden outputs are local test fixtures only.
- The CLI validates before conversion.
- No file output is implemented.
- No generated artifacts are created.
- No live/API/web source is used.
- No network schedule ingestion is performed.
- No historical fixture data is mutated.
- No outcome attachment is performed.
- Actual starters remain evaluation-only.
- modelProbability remains null/absent/not available until calibrated.

## Validation

- Fixture inventory guard passes with 29 games from 2024-06-01 through 2024-07-21 (June 17, July 12).
- Prospective dry-run check passes with no validation errors or warnings.
- Valid manual schedule validator logic exits 0 through the local loader.
- Valid snapshot CLI logic exits 0, includes the exact two-game snapshot, and matches its golden fixture.
- Invalid snapshot CLI logic exits 1 by design, preserves all five validation messages in order, includes no snapshot, and matches its golden fixture.
- Focused snapshot CLI tests pass: 9 tests.
- Historical export review release behavior passes in all four modes, and the focused rollout review suite passes: 154 tests.
- Prospective tests pass: 55 tests.
- Backtesting tests pass: 699 tests.
- Full Vitest and `npm test` pass: 811 tests across 55 files.
- TypeScript passes.
- Production build passes.
- Git diff check passes.
- In the managed validation sandbox, direct npm commands whose `tsx` launcher opens a local IPC listener are blocked with `EPERM` before script execution. The validator, snapshot, and historical review entry points pass through the existing local `tsx/cjs` loader pattern without an IPC listener; package scripts remain unchanged.

## Phase 4N manual week lock workflow plan

Phase 4N adds the planning-only lock workflow in `docs/mlb-manual-week-lock-workflow-plan.md`.
It defined the deterministic lock summary and locked snapshot wrapper before implementation, without changing snapshot CLI behavior or adding file output.

## Phase 4O manual week lock CLI

Phase 4O implements the separate local-only, stdout-only lock CLI documented in `docs/mlb-manual-week-lock-cli.md`.
The lock CLI validates and converts one manual schedule input before wrapping the snapshot; it does not change the Phase 4M snapshot CLI golden-output contract or add file output.

## Phase 4P manual week lock CLI golden outputs

Phase 4P locks exact stdout for the separate lock CLI in `docs/mlb-manual-week-lock-cli-golden-output.md`.
Phase 4M remains responsible only for snapshot CLI stdout; Phase 4P remains responsible only for lock CLI stdout.

## Phase 4Q manual week lock file-output plan

Phase 4Q planned file output only for the separate lock CLI in `docs/mlb-manual-week-lock-file-output-plan.md`.
Phase 4R implements that lock file mode. It does not change snapshot creation responsibilities, snapshot CLI output, or the Phase 4M goldens.

## Phase 4S lock file-output goldens

Phase 4S locks the exact valid file artifact and file-mode stdout summary in `docs/mlb-manual-week-lock-file-output-golden-tests.md`. Phase 4R behavior and the Phase 4P no-flag lock goldens remain unchanged; generated artifacts stay local and uncommitted.

## Phase 4T locked-week construction handoff

Phase 4T is planning-only and defines how the exact validated lock artifact will feed future deterministic pre-game research skeleton construction. See `docs/mlb-weekly-prospective-research-construction-plan.md`. It does not implement construction or change Phase 4R/4S lock behavior or goldens.

## Phase 4U stdout-only construction

Phase 4U implemented the separate locked-artifact construction command. The no-flag command validates the exact `lockedSnapshot`, not a raw manual schedule, and emits a deterministic stdout package with one pre-game `pending-research` `FULL` stub per locked game. Phase 4U itself added no file output or network ingestion and left the Phase 4P and Phase 4S lock goldens unchanged.

## Phase 4V construction stdout golden tests

Phase 4V added separate byte-for-byte no-flag construction stdout goldens for the valid package and representative invalid locked artifacts. At that phase, it did not change Phase 4U or the Phase 4P/4S lock goldens, and construction file output was not yet implemented.

## Phase 4W construction file-output plan

Phase 4W planned construction file output in `docs/mlb-weekly-prospective-research-construction-file-output-plan.md`. Phase 4X implements the double-opt-in mode without changing these snapshot goldens. It writes the exact inner construction package, emits summary-only file-mode stdout, refuses overwrite, and leaves Phase 4U no-flag behavior plus the Phase 4V, Phase 4P, and Phase 4S goldens unchanged.

## Recommended next safe phase

Phase 4Y adds exact static construction file artifact and file-mode stdout summary goldens without changing Phase 4X file output, Phase 4V no-flag construction stdout goldens, or Phase 4P/4S lock goldens. Generated `tmp` artifacts remain ignored, uncommitted, and cleaned.

Phase 4Z — plan first real research module handoff.

State:

- planning-only
- no implementation
- no live/API/web
- no network schedule ingestion
- no generated run artifacts committed
- no historical fixture data changes
- no `modelProbability` yet
- identify module inputs and outputs only
