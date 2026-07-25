# MLB Manual Schedule Validator CLI

Local-only validator CLI.
Reads only a user-provided local JSON path.
No live source used.
No real MLB API request made.
No web lookup used.
No real schedule ingestion from network/API.
No snapshot creation.
No lock-file creation.
No generated prospective run artifact committed.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
modelProbability remains null/absent/not available until calibrated.

## Purpose

Phase 4I adds a local CLI wrapper around `validateMLBManualScheduleFile`.
This CLI validates a user-provided manual schedule JSON file and prints a deterministic JSON summary.
It does not create snapshots, write files, fetch data, or ingest real schedules.

## Command

```bash
npm run prospective:mlb:validate-manual-schedule -- <path-to-json>
```

Only a single local JSON path is accepted.
Do not use network/API/web sources.

## Examples

Use only local test fixture examples:

```bash
npm run prospective:mlb:validate-manual-schedule -- tests/prospective/fixtures/manual-schedule/valid-manual-schedule-v1.json
npm run prospective:mlb:validate-manual-schedule -- tests/prospective/fixtures/manual-schedule/invalid-forbidden-fields-v1.json
```

## Output fields

- `ok`
- `schemaVersion`
- `sport`
- `sourceMode`
- `runId`
- `weekStart`
- `weekEnd`
- `gameCount`
- `validationMessageCount`
- `validationErrorCount`
- `validationWarningCount`
- `validationMessages`

## Exit behavior

- valid/no validation errors exits 0
- invalid validation errors exits 1
- missing path exits 1
- multiple paths exits 1
- unreadable or malformed JSON exits 1

## Safety boundary

- validates only
- no snapshot creation yet
- no file output
- no live/API/web
- no real schedule network/API ingestion
- no historical fixture mutation
- forbidden pre-game fields rejected by validator
- modelProbability remains null/absent/not available

## Validation

- Phase 4J exact golden-output tests pass for both local fixtures.
- Valid fixture exits 0; invalid forbidden-fields fixture exits 1 as designed.
- Prospective, backtesting, and full Vitest suites pass.
- Full suite passes with 802 tests.
- TypeScript, build, inventory guard, historical export rollout/release checks, and Git diff check pass.

## Phase 4J golden-output tests

Phase 4J locks the exact JSON stdout for the valid and invalid local fixtures.
See `docs/mlb-manual-schedule-validator-cli-golden-output.md`.

Golden output fixtures:

- `tests/prospective/fixtures/manual-schedule/valid-manual-schedule-cli-output-v1.json`
- `tests/prospective/fixtures/manual-schedule/invalid-forbidden-fields-cli-output-v1.json`

## Phase 4K snapshot creation plan

Phase 4K planned the local manual schedule snapshot creation command.
See `docs/mlb-manual-schedule-snapshot-creation-plan.md`.
The current validator CLI remains validation-only and does not create snapshots or write files.

## Phase 4L snapshot creation CLI

The separate Phase 4L CLI validates first and then converts valid input into an in-memory snapshot printed to stdout.
See `docs/mlb-manual-schedule-snapshot-creation-cli.md`.
This does not change the validator CLI: it remains validation-only.

## Phase 4M snapshot CLI golden outputs

Phase 4M locks exact stdout for the separate snapshot creation CLI.
See `docs/mlb-manual-schedule-snapshot-cli-golden-output.md`.
The validator CLI and its Phase 4J golden outputs remain validation-only and separate from snapshot conversion.

## Phase 4N manual week lock workflow plan

Phase 4N plans a future separate lock workflow after validation and in-memory snapshot conversion.
See `docs/mlb-manual-week-lock-workflow-plan.md`.
The validator CLI remains validation-only, the snapshot CLI remains conversion-only, and Phase 4N does not implement locking or file output.

## Phase 4O manual week lock CLI

Phase 4O implements the separate lock CLI documented in `docs/mlb-manual-week-lock-cli.md`.
The validator CLI remains validation-only, the snapshot CLI remains conversion-only, and the lock CLI validates again before conversion and deterministic wrapping.
None of these commands writes files.

## Phase 4P manual week lock CLI golden outputs

Phase 4P locks exact stdout for the separate lock CLI.
See `docs/mlb-manual-week-lock-cli-golden-output.md`.
The validator CLI, snapshot CLI, and lock CLI retain separate responsibilities.

## Phase 4Q manual week lock file-output plan

Phase 4Q planned file output only for the separate lock CLI.
See `docs/mlb-manual-week-lock-file-output-plan.md`.
Phase 4R implements that separate lock CLI file mode. The validator CLI remains validation-only, the snapshot CLI remains conversion-only, and neither command gains file-output responsibility.

## Phase 4S lock file-output goldens

Phase 4S adds fixture-only exact artifact and file-mode stdout summary regression coverage in `docs/mlb-manual-week-lock-file-output-golden-tests.md`. Phase 4R behavior is unchanged, the Phase 4P no-flag goldens remain protected, and generated file artifacts stay local and uncommitted.

## Phase 4T locked-week construction handoff

Phase 4T is planning-only and defines how the exact validated lock artifact will feed future deterministic pre-game research skeleton construction. See `docs/mlb-weekly-prospective-research-construction-plan.md`. It does not implement construction or change Phase 4R/4S lock behavior or goldens.

## Phase 4U stdout-only construction

Phase 4U added a separate local command that consumes the exact locked `lockedSnapshot` artifact, not the raw manual schedule accepted here. The no-flag command validates the artifact and emits a deterministic stdout package with one pre-game `pending-research` `FULL` stub per game. Phase 4U itself added no file output or network ingestion and did not change this validator or the Phase 4P/4S lock goldens.

## Phase 4V construction stdout golden tests

Phase 4V adds byte-for-byte construction stdout goldens for the valid package and representative invalid locked artifacts. The Phase 4U implementation, this validator, and the Phase 4P/4S lock goldens remain unchanged. Construction still has no file output.

## Phase 4W construction file-output plan

Phase 4W planned construction file output in `docs/mlb-weekly-prospective-research-construction-file-output-plan.md`. Phase 4X implements the double-opt-in mode without changing this validation-only CLI. It writes the exact inner construction package, emits summary-only file-mode stdout, refuses overwrite, and leaves Phase 4U no-flag behavior plus the Phase 4V, Phase 4P, and Phase 4S goldens unchanged.

## Phase 4Z first research module handoff plan

Phase 4Z is planning-only and is documented in `docs/mlb-first-research-module-handoff-plan.md`. It proposes the MLB team recent form module from the exact Phase 4X/4Y construction package artifact, not from the raw manual schedule validated here. It enriches pregame research without predicting and adds no `modelProbability`, pitcher evidence, live/API/web access, or network schedule ingestion. Phase 4V/4Y construction and Phase 4P/4S lock goldens remain unchanged.

## Recommended next safe phase

Phase 5B — add fixture-only exact stdout golden tests for the implemented Phase 5A team recent form research module. Phase 5A consumes the exact downstream construction artifact and enriches it with a deterministic `TEAM_ONLY` skeleton without predicting. It adds no file output, `modelProbability`, pitcher evidence, actual starters, live/API/web access, network schedule ingestion, or historical fixture change; Phase 5B adds no new research behavior.
