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

## Recommended next safe phase

Phase 4Q — plan file-output mode for locked weekly artifacts.
State:
- planning-only
- no implementation
- no file-output artifacts yet
- no live/API/web
- no network schedule ingestion
- no generated run artifacts committed
- no historical fixture data changes
