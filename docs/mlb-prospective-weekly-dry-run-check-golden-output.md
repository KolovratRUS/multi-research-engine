# MLB Prospective Weekly Dry-Run Check Golden Output

Local-only golden-output test.
No live source used.
No real MLB API request made.
No web lookup used.
No real schedule ingestion.
No generated prospective run artifact committed.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
modelProbability remains null/absent/not available until calibrated.

## Purpose

Phase 4E locks the deterministic JSON output from the local dry-run check command.
This is a golden-output regression guard for `npm run prospective:mlb:dry-run-check`.
It does not fetch data, ingest real schedules, create run artifacts, or modify files.

## References

- `docs/mlb-prospective-weekly-test-mode-plan.md`
- `docs/mlb-prospective-weekly-dry-run-schemas.md`
- `docs/mlb-prospective-weekly-local-dry-run-sample.md`
- `docs/mlb-prospective-weekly-dry-run-check-command.md`

## Golden fixture

`tests/prospective/fixtures/mlb-dry-run-check-output-v1.json`

Commit this fixture so the CLI output shape and values remain stable across refactors.

## Command covered

```bash
npm run prospective:mlb:dry-run-check
```

## Locked output fields

- `runId`
- `sourceMode`
- `weekStart`
- `weekEnd`
- `gameCount`
- `pregameResearchCount`
- `lockedOutputCount`
- `outcomeAttachmentCount`
- `evaluationReportPresent`
- `validationErrorCount`
- `validationWarningCount`
- `passed`
- `modelProbabilityStatus`
- `pregameSnapshotsContainFinalScore`
- `pregameSnapshotsContainCompletedGameState`
- `historicalFixtureInventoryTouched`

## Safety boundary

- golden output is a local test fixture only
- no live/API/web
- no real schedule ingestion
- no file artifacts written by the command
- pre-game snapshots exclude `finalScore` and `completedGameState`
- `modelProbability` remains `null`
- historical fixture inventory unchanged

## Validation

- CLI golden-output test passes with exact JSON match.
- Full test suite passes: `npm test` (776 tests passed).
- TypeScript passes: `npx tsc --noEmit --incremental false --pretty false`.
- Build passes: `npm run build`.
- Git diff check passes: `git diff --check`.

## Recommended next safe phase

Phase 4F — plan manually supplied MLB schedule-file dry-run.
State:
- planning-only
- no live/API/web
- no real schedule fetch
- user-supplied static input only in future implementation
- define file format and validation rules before implementation
