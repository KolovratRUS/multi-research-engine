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

## Recommended next safe phase

Phase 4K — plan manual schedule snapshot creation.
State:
- planning-only
- no live/API/web
- no real schedule network/API ingestion
- no generated run artifacts committed
- define conversion CLI/output behavior before implementation
- no historical fixture data changes
