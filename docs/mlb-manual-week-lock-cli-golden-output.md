# MLB Manual Week Lock CLI Golden Output

## Status

Local-only.
Fixture-only.
Exact stdout JSON regression tests.
The protected no-flag cases remain stdout-only.
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

Phase 4Q planned file-output mode in `docs/mlb-manual-week-lock-file-output-plan.md`. Phase 4R implements that mode only when both explicit file flags are present. These no-flag exact stdout goldens remain unchanged.
Phase 4S adds separate exact file-output artifact and file-mode stdout summary goldens in `docs/mlb-manual-week-lock-file-output-golden-tests.md`. The Phase 4P no-flag fixtures remain byte-for-byte unchanged.

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
- These no-flag golden cases write no files.
- Phase 4R file-mode fields and generated artifacts are outside these two exact stdout fixtures.
- No live, API, or web source is used.
- No network schedule ingestion is performed.
- No historical fixture data is mutated.
- No outcome attachment is performed.
- Actual starters remain evaluation-only.
- `TEAM_ONLY` excludes pitcher evidence.
- Phase 1G-b observations remain unread and unused for pitcher availability.
- modelProbability remains null/absent/not available until calibrated.
- File-mode-only summary fields never appear in these no-flag golden outputs.
- Generated lock artifacts are local files and must not be committed.

## Validation

- Fixture inventory guard passes with 29 games from 2024-06-01 through 2024-07-21: June 17 and July 12.
- Prospective dry-run logic passes with zero validation errors and warnings.
- Valid validator, snapshot, and lock CLI logic exits 0 through the local loader.
- Valid lock stdout matches its golden fixture, includes the exact two-game `lockedSnapshot`, and its nested snapshot passes `validateProspectiveScheduleSnapshot`.
- Invalid forbidden-fields lock logic exits 1 by design, preserves all five validation messages in order, includes no `lockedSnapshot`, and matches its golden fixture.
- Focused lock CLI tests pass: 24 tests, including both unchanged Phase 4P goldens, Phase 4R file-mode behavior, and the Phase 4S exact file-mode summary/artifact regression.
- Historical export review release behavior passes in all four modes through the local loader.
- Focused historical export rollout review tests pass: 154 tests.
- Prospective tests pass: 79 tests.
- Backtesting tests pass: 699 tests.
- Full Vitest and `npm test` pass: 835 tests across 56 files.
- TypeScript passes.
- Production build passes.
- Git diff check passes.
- The manual file-mode verification artifact and output directory were removed; the no-flag commands created no artifacts.
- In the managed validation sandbox, direct npm commands whose `tsx` launcher opens a local IPC listener are blocked with `EPERM` before script execution. The inventory, dry-run, validator, snapshot, lock, and historical review entry points pass through the existing local `tsx/cjs` loader pattern without an IPC listener; package scripts remain unchanged.

## Phase 4T locked-week construction handoff

Phase 4T is planning-only and defines how the exact validated lock artifact will feed future deterministic pre-game research skeleton construction. See `docs/mlb-weekly-prospective-research-construction-plan.md`. It does not implement construction or change Phase 4R behavior, the Phase 4P no-flag goldens, or the Phase 4S file-output goldens.

## Recommended next safe phase

Phase 4U — implement stdout-only weekly prospective research construction from a locked manual week.

State:

- local-only
- consumes and validates one locked artifact JSON
- deterministic stdout research skeleton only
- no file output
- no live/API/web
- no network schedule ingestion
- no generated run artifacts committed
- no historical fixture data changes
