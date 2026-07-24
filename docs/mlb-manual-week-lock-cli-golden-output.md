# MLB Manual Week Lock CLI Golden Output

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

Phase 4P locks the exact stdout JSON for the valid and invalid manual week lock CLI cases. The tests compare parsed CLI stdout with committed local golden fixtures, preserve validator message order, and require `lockedSnapshot` only for valid input.

Phase 4Q adds only the future file-output mode plan in `docs/mlb-manual-week-lock-file-output-plan.md`. The current CLI and these exact stdout goldens remain unchanged.

## Golden output fixtures

- `tests/prospective/fixtures/manual-schedule/valid-manual-week-lock-cli-output-v1.json`
- `tests/prospective/fixtures/manual-schedule/invalid-forbidden-fields-week-lock-cli-output-v1.json`

## Commands covered

```bash
npm run prospective:mlb:lock-manual-week -- tests/prospective/fixtures/manual-schedule/valid-manual-schedule-v1.json
npm run prospective:mlb:lock-manual-week -- tests/prospective/fixtures/manual-schedule/invalid-forbidden-fields-v1.json
```

The valid command exits 0 and includes `lockedSnapshot`. The invalid command exits 1 by design and includes no `lockedSnapshot`.

## Locked output fields

- `ok`
- `runId`
- `lockId`
- `sourceMode`
- `weekStart`
- `weekEnd`
- `lockedAt`
- `snapshotTimestamp`
- `gameCount`
- `validationMessageCount`
- `validationErrorCount`
- `validationWarningCount`
- `validationMessages`
- `lockedSnapshot`, only for valid input

## Safety boundary

- Golden outputs are local test fixtures only.
- The CLI validates before conversion and locking.
- No file output is implemented.
- No generated artifacts are created.
- No live, API, or web source is used.
- No network schedule ingestion is performed.
- No historical fixture data is mutated.
- No outcome attachment is performed.
- Actual starters remain evaluation-only.
- `TEAM_ONLY` excludes pitcher evidence.
- Phase 1G-b observations remain unread and unused for pitcher availability.
- modelProbability remains null/absent/not available until calibrated.

## Validation

- Fixture inventory guard passes with 29 games from 2024-06-01 through 2024-07-21: June 17 and July 12.
- Prospective dry-run logic passes with zero validation errors and warnings.
- Valid validator, snapshot, and lock CLI logic exits 0 through the local loader.
- Valid lock stdout matches its golden fixture, includes the exact two-game `lockedSnapshot`, and its nested snapshot passes `validateProspectiveScheduleSnapshot`.
- Invalid forbidden-fields lock logic exits 1 by design, preserves all five validation messages in order, includes no `lockedSnapshot`, and matches its golden fixture.
- Focused lock CLI tests pass: 10 tests.
- Historical export review release behavior passes in all four modes through the local loader.
- Focused historical export rollout review tests pass: 154 tests.
- Prospective tests pass: 65 tests.
- Backtesting tests pass: 699 tests.
- Full Vitest and `npm test` pass: 821 tests across 56 files.
- TypeScript passes.
- Production build passes.
- Git diff check passes.
- In the managed validation sandbox, direct npm commands whose `tsx` launcher opens a local IPC listener are blocked with `EPERM` before script execution. The inventory, dry-run, validator, snapshot, lock, and historical review entry points pass through the existing local `tsx/cjs` loader pattern without an IPC listener; package scripts remain unchanged.

## Recommended next safe phase

Phase 4R — implement file-output mode for the `lock-manual-week` CLI.

State:

- local-only
- explicit `--write-file` and `--output-dir` flags only
- validates first
- writes exactly one deterministic locked artifact only when valid
- no file writes without explicit flags
- no live/API/web
- no network schedule ingestion
- no generated run artifacts committed
- no historical fixture data changes
