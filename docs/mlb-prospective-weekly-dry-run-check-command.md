# MLB Prospective Weekly Dry-Run Check Command

Local-only CLI/check command.
No live source used.
No real MLB API request made.
No web lookup used.
No real schedule ingestion.
No generated prospective run artifact committed.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
modelProbability remains null/absent/not available until calibrated.

## Purpose

Phase 4D adds a local CLI check command to validate the Phase 4C dry-run sample and print a deterministic JSON summary.
This command does not fetch data, ingest real schedules, create run artifacts, or modify files.
It validates the existing local dry-run sample in memory and reports the result.

## References

- `docs/mlb-prospective-weekly-test-mode-plan.md`
- `docs/mlb-prospective-weekly-dry-run-schemas.md`
- `docs/mlb-prospective-weekly-local-dry-run-sample.md`

## Command

```bash
npm run prospective:mlb:dry-run-check
```

## Output JSON fields

- `runId` — local dry-run run identifier.
- `sourceMode` — expected `local-dry-run`.
- `weekStart` / `weekEnd` — the deterministic sample week.
- `gameCount` — number of local sample games.
- `pregameResearchCount` — number of pregame research snapshots.
- `lockedOutputCount` — always `1` for the local sample.
- `outcomeAttachmentCount` — number of outcome attachments.
- `evaluationReportPresent` — whether the evaluation report exists.
- `scheduleValidationMessageCount` — validator message count for the schedule snapshot.
- `pregameValidationMessageCount` — validator message count for pregame research snapshots.
- `lockedValidationMessageCount` — validator message count for the locked weekly output.
- `outcomeValidationMessageCount` — validator message count for outcome attachments.
- `validationErrorCount` — total validator errors.
- `validationWarningCount` — total validator warnings.
- `passed` — `true` when `validationErrorCount` is `0`.
- `modelProbabilityStatus` — always `"null"`.
- `pregameSnapshotsContainFinalScore` — `false` because pre-game snapshots exclude final scores.
- `pregameSnapshotsContainCompletedGameState` — `false` because pre-game snapshots exclude completed game state.
- `historicalFixtureInventoryTouched` — `false` because the command does not modify fixture data.

## Exit behavior

- `validationErrorCount === 0`: exits `0`.
- `validationErrorCount > 0`: prints JSON summary and exits `1`.

## Safety boundary

- This command validates an in-memory local sample only.
- No live/API/web data is fetched.
- No real schedule ingestion is performed.
- No files are written.
- Pre-game snapshots exclude `finalScore` and `completedGameState`.
- `modelProbability` remains `null`.
- Historical fixture inventory is not changed.

## Validation

- CLI command exits successfully.
- Output JSON is valid and contains expected fields.
- `passed` is `true`.
- `validationErrorCount` is `0`.
- `historicalFixtureInventoryTouched` is `false`.

## Recommended next safe phase

Phase 4E — add golden output test for dry-run check command.
State:
- local-only
- no live/API/web
- no real schedule ingestion
- test asserts stable JSON output shape and values for future regressions
- golden fixture: `tests/prospective/fixtures/mlb-dry-run-check-output-v1.json`

See `docs/mlb-prospective-weekly-dry-run-check-golden-output.md` for the golden-output test.
