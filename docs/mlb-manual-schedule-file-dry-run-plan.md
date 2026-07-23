# MLB Manual Schedule-File Dry-Run Plan

Documentation-only plan.
No live source used.
No real MLB API request made.
No web lookup used.
No real schedule ingestion performed.
No parser implemented.
No CLI implemented.
No generated prospective run artifact committed.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
modelProbability remains null/absent/not available until calibrated.

## Purpose

This plan defines a future workflow where the user manually supplies a static MLB schedule file for local prospective dry-run testing.
The file is provided by the user, not fetched by the agent.
A future command will validate the file, create in-memory schedule snapshots, and eventually support locking outputs.
This remains local-only, odds-blind, and leakage-safe.
This is a planning step before any authorized source ingestion.

## Current foundation

- Phase 4B schemas exist: `src/prospective/mlb/weekly-test-schemas.ts`
- Phase 4C local sample exists: `src/prospective/mlb/local-dry-run-sample.ts`
- Phase 4D local check command exists: `npm run prospective:mlb:dry-run-check`
- Phase 4E golden output test exists: `tests/prospective/fixtures/mlb-dry-run-check-output-v1.json`
- Phase 4F plan exists: `docs/mlb-manual-schedule-file-dry-run-plan.md`
- Phase 4G schema/validator module exists: `src/prospective/mlb/manual-schedule-file.ts`
- Phase 4H static fixtures/golden validator outputs exist: `docs/mlb-manual-schedule-file-fixtures.md`
- Phase 4I local validator CLI exists: `docs/mlb-manual-schedule-validator-cli.md`
- Phase 4J exact CLI golden-output tests exist: `docs/mlb-manual-schedule-validator-cli-golden-output.md`
- Phase 4K snapshot creation plan exists: `docs/mlb-manual-schedule-snapshot-creation-plan.md`
- Phase 4L stdout-only snapshot creation CLI exists: `docs/mlb-manual-schedule-snapshot-creation-cli.md`
- Phase 4M exact snapshot CLI golden-output tests exist: `docs/mlb-manual-schedule-snapshot-cli-golden-output.md`
- Phase 4N planning-only manual week lock workflow exists: `docs/mlb-manual-week-lock-workflow-plan.md`
- Current local dry-run runId: `mlb-local-dry-run-2024-07-sample`
- Current historical fixture inventory remains 29 games (2024-06-01 through 2024-07-21, June 17, July 12)
- No live/API/web authorization exists

## Why manually supplied input comes before API ingestion

- Lower leakage risk: the source is explicit and inspectable.
- User controls the input.
- Parser validation can be built before source adapters.
- Easier to test failure modes.
- No network calls required.

## Proposed manual schedule file format

Recommended JSON file format for future implementation.

Top-level fields:
- `schemaVersion`: `"mlb-manual-schedule-v1"`
- `sport`: `"MLB"`
- `sourceMode`: `"manual-schedule"`
- `runId`
- `weekStart`
- `weekEnd`
- `createdAt`
- `sourceProvenance`
- `games`

Game fields:
- `gameId`
- `officialDate`
- `scheduledStartTime`
- `awayTeam`
- `homeTeam`
- `sourceProvenance`

Forbidden pre-game fields (must be rejected or warned on):
- `finalScore`
- `completedGameState`
- `finalStatus`
- `outcomeStatus`
- `actualStartingPitchers`
- closing odds or market fields or any external price fields

## Example manual schedule file

```json
{
  "schemaVersion": "mlb-manual-schedule-v1",
  "sport": "MLB",
  "sourceMode": "manual-schedule",
  "runId": "manual-schedule-2024-07-01-2024-07-07",
  "weekStart": "2024-07-01",
  "weekEnd": "2024-07-07",
  "createdAt": "2024-07-01T00:00:00Z",
  "sourceProvenance": "user-supplied-static-schedule",
  "games": [
    {
      "gameId": "manual-game-1",
      "officialDate": "2024-07-01",
      "scheduledStartTime": "2024-07-01T18:00:00Z",
      "awayTeam": "MANUAL_AWAY_1",
      "homeTeam": "MANUAL_HOME_1",
      "sourceProvenance": "user-supplied-static-schedule"
    },
    {
      "gameId": "manual-game-2",
      "officialDate": "2024-07-03",
      "scheduledStartTime": "2024-07-03T17:10:00Z",
      "awayTeam": "MANUAL_AWAY_2",
      "homeTeam": "MANUAL_HOME_2",
      "sourceProvenance": "user-supplied-static-schedule"
    }
  ]
}
```

This example is not real MLB schedule data.

## Planned validation rules

Future parser should reject or warn on:
- missing `schemaVersion`
- wrong `sport`
- `sourceMode` not `manual-schedule`
- missing `runId`
- missing `weekStart`/`weekEnd`
- missing `createdAt`/`sourceProvenance`
- missing or empty `games`
- duplicate `gameId`
- games outside `weekStart`/`weekEnd`
- missing `officialDate`, `scheduledStartTime`, `awayTeam`, `homeTeam`, or `sourceProvenance`
- presence of `finalScore`
- presence of `completedGameState`
- presence of `finalStatus`, `outcomeStatus`, or other outcome fields in the pre-game file
- presence of `actualStartingPitchers`
- presence of any forbidden external price/market fields
- non-deterministic or generated timestamps if unsuitable

## Planned future artifacts

Future implementation may create in-memory objects first:
- `MLBProspectiveScheduleSnapshot`
- `MLBProspectiveGameSnapshot`
- `MLBPregameResearchSnapshot` later only after research construction exists
- `MLBLockedWeeklyOutput` later
- `MLBOutcomeAttachment` later, separate from pre-game schedule file

## Proposed future CLI commands

Planned names only; do not implement:
- `prospective:mlb:validate-manual-schedule`
- `prospective:mlb:create-manual-snapshot`
- `prospective:mlb:lock-manual-week`

Behavior:
- `validate-manual-schedule` reads the user-provided JSON and validates only.
- `create-manual-snapshot` converts valid input into in-memory or explicitly chosen output later.
- `lock-manual-week` locks pre-game outputs after validation, in a future phase.

## Safety and leakage boundaries

- Manual schedule file is pre-game only.
- No final scores, results, or completed state.
- Actual starters remain evaluation-only.
- Schedule probable timestamp uncertainty must be preserved if any starter-like data is ever added later.
- Outcome attachment remains separate and post-completion only.
- `modelProbability` remains null/absent/not available until calibration exists.
- No live/API/web calls.
- No historical fixture mutation.
- No generated run artifacts committed by default.

The Phase 4G local-only MLB manual schedule file schema and validator implementation is `src/prospective/mlb/manual-schedule-file.ts`.
The Phase 4H static fixtures and golden validator outputs are documented in `docs/mlb-manual-schedule-file-fixtures.md`.
The Phase 4J exact manual schedule validator CLI golden outputs are documented in `docs/mlb-manual-schedule-validator-cli-golden-output.md`.
The Phase 4K planning-only manual schedule snapshot creation design is documented in `docs/mlb-manual-schedule-snapshot-creation-plan.md`.
The Phase 4L local-only, stdout-only manual schedule snapshot creation CLI is documented in `docs/mlb-manual-schedule-snapshot-creation-cli.md`. It does not implement live mode, network schedule ingestion, file output, or historical fixture changes.
The Phase 4M exact manual schedule snapshot CLI golden outputs are documented in `docs/mlb-manual-schedule-snapshot-cli-golden-output.md`. They lock local static-fixture stdout only and do not add file output or generated run artifacts.
The Phase 4N planning-only manual week lock workflow is documented in `docs/mlb-manual-week-lock-workflow-plan.md`. It defines the future local deterministic lock contract without implementing the command, file output, or generated run artifacts.
See `docs/mlb-manual-schedule-file-schemas.md`.

## Implementation staging

Stage 1 — add manual schedule schema/types and validators.
Stage 2 — add tiny manual schedule fixture/golden.
Stage 3 — add `validate-manual-schedule` CLI.
Stage 4 — convert valid manual schedule to prospective schedule snapshot.
Stage 5 — lock manually supplied week output.
Stage 6 — separate outcome attachment after completion.

## Success criteria

- User can provide static schedule JSON.
- Validation catches forbidden pre-game fields.
- Valid manual schedule creates deterministic snapshot summary.
- No network/API/web needed.
- Historical fixture inventory remains unchanged.
- Dry-run command and golden output remain stable.
- Fixture-based golden tests pass.

## Current readiness assessment

- Local prospective dry-run foundation is now solid.
- Manually supplied schedule-file workflow is not implemented yet.
- This plan improves architecture clarity only.
- After implementation of Stage 1–3, MLB real-week dry-run readiness could move toward 55–60%.
- Real API/live readiness remains lower until explicit authorized ingestion is designed.

## Recommended next safe phase

Phase 4O — add the `lock-manual-week` CLI.
State:
- local-only
- stdout-only
- reads one user-provided local manual schedule JSON path
- validates first and converts in memory
- wraps the snapshot in a deterministic locked snapshot
- no file output
- no live/API/web
- no network schedule ingestion
- no generated run artifacts committed
- no historical fixture data changes

See `docs/mlb-manual-schedule-validator-cli.md` for the validator CLI documentation.
See `docs/mlb-manual-schedule-validator-cli-golden-output.md` for the Phase 4J golden-output documentation.
See `docs/mlb-manual-schedule-snapshot-creation-plan.md` for the Phase 4K snapshot creation plan.
See `docs/mlb-manual-schedule-snapshot-creation-cli.md` for the Phase 4L stdout-only snapshot creation CLI.
See `docs/mlb-manual-schedule-snapshot-cli-golden-output.md` for the Phase 4M exact snapshot CLI stdout fixtures and tests.
See `docs/mlb-manual-week-lock-workflow-plan.md` for the Phase 4N planning-only lock workflow.
