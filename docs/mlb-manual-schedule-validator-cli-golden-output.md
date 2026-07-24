# MLB Manual Schedule Validator CLI Golden Output

## Status

Local-only CLI golden-output tests.
Fixture-only.
No live source used.
No real MLB API request made.
No web lookup used.
No real schedule network/API ingestion.
No snapshot creation.
No lock-file creation.
No generated prospective run artifact committed.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
modelProbability remains null/absent/not available until calibrated.

## Purpose

Phase 4J locks the exact JSON output of the manual schedule validator CLI for the local valid and invalid manual schedule fixtures. The golden fixtures make changes to stable output fields and validation-message ordering explicit in regression tests.

## References

- `docs/mlb-manual-schedule-file-dry-run-plan.md`
- `docs/mlb-manual-schedule-file-schemas.md`
- `docs/mlb-manual-schedule-file-fixtures.md`
- `docs/mlb-manual-schedule-validator-cli.md`
- `docs/mlb-manual-schedule-snapshot-creation-cli.md`
- `docs/mlb-manual-schedule-snapshot-cli-golden-output.md`
- `docs/mlb-manual-week-lock-cli.md`
- `docs/mlb-manual-week-lock-file-output-plan.md`

## Golden output fixtures

- `tests/prospective/fixtures/manual-schedule/valid-manual-schedule-cli-output-v1.json`
- `tests/prospective/fixtures/manual-schedule/invalid-forbidden-fields-cli-output-v1.json`

## Commands covered

```bash
npm run prospective:mlb:validate-manual-schedule -- tests/prospective/fixtures/manual-schedule/valid-manual-schedule-v1.json
npm run prospective:mlb:validate-manual-schedule -- tests/prospective/fixtures/manual-schedule/invalid-forbidden-fields-v1.json
```

The valid command exits 0. The invalid command exits 1 by design and its JSON stdout is compared exactly with the invalid golden fixture.

## Locked output fields

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

## Safety boundary

- Golden outputs are local test fixtures only.
- The CLI validates only.
- No snapshot creation is implemented yet.
- The CLI does not write files.
- No live/API/web source is used.
- No real schedule network/API ingestion is performed.
- No historical fixture data is mutated.
- Forbidden pre-game fields are rejected by the validator.
- modelProbability remains null/absent/not available until calibrated.

## Validation

- Inventory guard passes with 29 total games (June 17, July 12).
- Prospective dry-run check passes with no validation errors or warnings.
- Valid manual schedule CLI output matches its golden fixture and exits 0.
- Invalid manual schedule CLI output matches its golden fixture and exits 1 as designed.
- Historical export rollout and release checks pass.
- Prospective, backtesting, and full Vitest suites pass.
- Full suite passes with 802 tests.
- TypeScript passes.
- Build passes.
- Git diff check passes.

## Phase responsibility boundary

- Phase 4J goldens lock validator CLI stdout only.
- Phase 4M goldens lock the separate snapshot CLI stdout.
- Phase 4N is the planning-only future lock workflow in `docs/mlb-manual-week-lock-workflow-plan.md`.
- Phase 4O implements the separate lock CLI documented in `docs/mlb-manual-week-lock-cli.md`.
- Phase 4P goldens lock the separate lock CLI stdout in `docs/mlb-manual-week-lock-cli-golden-output.md`.
- Phase 4Q plans future explicit file output for the lock CLI in `docs/mlb-manual-week-lock-file-output-plan.md`; it implements no file output.

The validator CLI remains validation-only, the snapshot CLI remains conversion-only, and the Phase 4O lock CLI owns deterministic wrapping. None adds file output.

## Recommended next safe phase

Phase 4R — implement file-output mode for the separate `lock-manual-week` CLI.

State:

- local-only
- explicit `--write-file` and `--output-dir` flags only
- validates first
- no file writes without explicit flags
- no live/API/web
- no network schedule ingestion
- no generated run artifacts committed
- no historical fixture data changes

Phase 4K adds the planning-only snapshot creation design in `docs/mlb-manual-schedule-snapshot-creation-plan.md`.
Phase 4L implements the separate stdout-only snapshot creation CLI documented in `docs/mlb-manual-schedule-snapshot-creation-cli.md`; the validator CLI and its Phase 4J goldens remain validation-only.
Phase 4M locks the separate snapshot CLI stdout in `docs/mlb-manual-schedule-snapshot-cli-golden-output.md`; those goldens include the snapshot only for valid input and do not change the Phase 4J validator CLI contract.
Phase 4N defines the future lock contract in `docs/mlb-manual-week-lock-workflow-plan.md` without implementing it.
Phase 4O implements that contract as the stdout-only CLI in `docs/mlb-manual-week-lock-cli.md`, without exact lock CLI goldens or file output.
Phase 4P locks that CLI stdout in `docs/mlb-manual-week-lock-cli-golden-output.md`, without changing validator or snapshot CLI responsibilities.
Phase 4Q plans only the later explicit lock artifact file-output mode in `docs/mlb-manual-week-lock-file-output-plan.md`, without changing any CLI or golden output.
