# MLB Manual Week Lock File Output Golden Tests

## Status

Local-only.
Fixture-only.
Exact file-output artifact regression tests.
Exact file-mode stdout summary regression tests.
No live source used.
No real MLB API request made.
No web lookup used.
No network schedule ingestion.
No generated prospective run artifact committed.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
modelProbability remains null/absent/not available until calibrated.

## Purpose

Phase 4S locks the exact local file-output artifact body and file-mode stdout summary for the valid manual week lock case. Phase 4R implementation behavior remains unchanged, and the earlier Phase 4P no-flag stdout contract stays protected.

## Golden fixtures

- `tests/prospective/fixtures/manual-schedule/valid-manual-week-lock-file-artifact-v1.json`
- `tests/prospective/fixtures/manual-schedule/valid-manual-week-lock-file-summary-v1.json`

## Protected earlier goldens

The Phase 4P no-flag stdout goldens remain unchanged:

- `tests/prospective/fixtures/manual-schedule/valid-manual-week-lock-cli-output-v1.json`
- `tests/prospective/fixtures/manual-schedule/invalid-forbidden-fields-week-lock-cli-output-v1.json`

## What is locked

- The artifact body equals `lockedSnapshot` exactly.
- The file-mode stdout summary contains `outputMode`, `artifactWritten`, `artifactFilename`, and `artifactPath`.
- `artifactPath` is relative and non-absolute.
- The artifact contains no outer CLI summary fields.
- The artifact contains no final, completion, starter, or outcome fields.
- The nested two-game snapshot passes `validateProspectiveScheduleSnapshot`.
- A successful write leaves no temporary `.tmp` file.
- Generated file artifacts remain local and uncommitted.

## Command covered

```bash
npm run prospective:mlb:lock-manual-week -- tests/prospective/fixtures/manual-schedule/valid-manual-schedule-v1.json --write-file --output-dir tmp/prospective-phase4r-lock-manual-week-cli/valid-lock
```

The regression test invokes the same script through the existing local `tsx/cjs` loader so it does not depend on a launcher IPC listener. The stable output directory is removed after every test.

## Validation

- Fixture inventory guard passes with 29 games from 2024-06-01 through 2024-07-21: June 17 and July 12.
- Prospective dry-run logic passes with zero validation errors and warnings.
- Valid manual schedule validator, snapshot, no-flag lock, and file-mode lock behavior pass through the local loader.
- The manually generated file-mode artifact matches `valid-manual-week-lock-file-artifact-v1.json` exactly and was removed with its output directory after verification.
- The Phase 4P no-flag valid and invalid stdout objects still match their unchanged goldens exactly.
- Focused lock CLI tests pass: 24 tests, including all Phase 4R behavioral tests and the Phase 4S exact file-mode summary/artifact test.
- Historical export review behavior passes in all four release-check modes through the local loader.
- Focused historical export rollout review tests pass: 154 tests.
- Prospective tests pass: 79 tests.
- Backtesting tests pass: 699 tests.
- Full Vitest and `npm test` pass: 835 tests across 56 files.
- TypeScript passes.
- Production build passes.
- Git diff check passes.
- Safety searches pass, and no generated lock, prospective, export, or review artifact remains.
- In the managed validation sandbox, direct npm commands whose `tsx` launcher opens a local IPC listener are blocked with `EPERM` before script execution. The affected dry-run, validator, snapshot, lock, file-mode lock, and historical review entry points pass through the existing local `tsx/cjs` loader pattern; package scripts remain unchanged.

## Phase 4T locked-week construction handoff

Phase 4T is planning-only and defines how the exact validated lock artifact will feed future deterministic pre-game research skeleton construction. See `docs/mlb-weekly-prospective-research-construction-plan.md`. It does not implement construction or change Phase 4R behavior, the Phase 4P no-flag goldens, or the Phase 4S file-output goldens.

## Phase 4U stdout-only construction

Phase 4U uses this exact valid lock artifact fixture as its local construction input. It validates the `lockedSnapshot` and emits a deterministic stdout package with one pre-game `pending-research` `FULL` stub per locked game. It adds no construction file output and does not change the Phase 4P no-flag or Phase 4S file-output lock goldens.

## Phase 4V construction stdout golden tests

Phase 4V adds separate exact construction stdout fixtures for the valid package and representative invalid locked artifacts. It does not alter these Phase 4S goldens, the Phase 4P no-flag goldens, or Phase 4U construction behavior. Construction still has no file output.

## Phase 4W construction file-output plan

Phase 4W is planning-only and is documented in `docs/mlb-weekly-prospective-research-construction-file-output-plan.md`. It plans a separate future construction file mode without implementing it. Phase 4U remains unchanged, the Phase 4V construction stdout goldens remain unchanged, and these Phase 4S file-output lock goldens plus the Phase 4P no-flag lock goldens remain unchanged.

## Recommended next safe phase

Phase 4X — implement file-output mode for constructed weekly research packages.

State:

- local-only
- implementation
- double opt-in `--write-file` + `--output-dir`
- no-flag stdout goldens unchanged
- writes the exact construction package artifact only
- validates before writing
- refuses overwrite
- no live/API/web
- no network schedule ingestion
- no generated run artifacts committed
- no historical fixture data changes
