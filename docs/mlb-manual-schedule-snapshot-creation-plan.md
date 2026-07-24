# MLB Manual Schedule Snapshot Creation Plan

## Status

Phase 4K planning record.
Phase 4L stdout-only CLI implemented.
No live source used.
No real MLB API request made.
No web lookup used.
No real schedule network/API ingestion.
No snapshot files written.
No lock-file creation.
No generated prospective run artifact committed.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
modelProbability remains null/absent/not available until calibrated.

## Purpose

Phase 4K planned a local command that converts a validated, user-provided manual schedule JSON file into an `MLBProspectiveScheduleSnapshot`.
This followed the Phase 4I validator CLI and Phase 4J validator CLI golden-output tests.
Phase 4L implements that command as a local-only, stdout-only conversion with no file output.
See `docs/mlb-manual-schedule-snapshot-creation-cli.md`.

## Current foundation

- Phase 4G provides the manual schedule schema, validator, and converter helper.
- Phase 4H provides static fixtures and golden validator outputs.
- Phase 4I provides the validator CLI.
- Phase 4J provides exact validator CLI golden outputs.
- Phase 4L provides the stdout-only manual schedule snapshot creation CLI.
- Phase 4M provides exact snapshot CLI golden outputs for the valid and invalid local fixtures.
- Phase 4O provides the separate stdout-only manual week lock CLI documented in `docs/mlb-manual-week-lock-cli.md`.
- Phase 4P provides exact stdout golden outputs for that separate lock CLI, documented in `docs/mlb-manual-week-lock-cli-golden-output.md`.
- Phase 4Q provides the planning-only file-output contract for the separate lock CLI in `docs/mlb-manual-week-lock-file-output-plan.md`.
- The current converter helper is `buildScheduleSnapshotFromManualScheduleFile`.
- The validator CLI remains validation-only; the separate snapshot CLI validates before in-memory conversion.
- The historical fixture inventory remains 29 games (June 17, July 12).

## Implemented command

```bash
npm run prospective:mlb:create-manual-snapshot -- <path-to-json>
```

Implemented script path:

```text
scripts/mlb-manual-schedule-create-snapshot.ts
```

## CLI input

- Accept exactly one user-provided local JSON file path.
- Require the input to pass `validateMLBManualScheduleFile` before conversion.
- Require manual schedule `schemaVersion` `"mlb-manual-schedule-v1"`.
- Use no network/API/web source.
- Perform no real source fetching.
- Have no historical fixture dependency.

## CLI output

The command prints a stdout-only deterministic JSON summary containing:

- `ok`
- `runId`
- `sourceMode`
- `weekStart`
- `weekEnd`
- `snapshotTimestamp`
- `gameCount`
- `validationMessageCount`
- `validationErrorCount`
- `validationWarningCount`
- `validationMessages`
- `snapshot`, only when valid

Phase 4L does not add file output or create generated prospective run artifacts.

## Snapshot mapping

The command validates first, then uses `buildScheduleSnapshotFromManualScheduleFile`.

Mapping from `MLBManualScheduleFile` to the command summary and `MLBProspectiveScheduleSnapshot`:

- `runId` comes from `input.runId`.
- `sourceMode` remains `"manual-schedule"`.
- Summary `weekStart` and `weekEnd` come from the input. The current snapshot schema does not duplicate these summary fields.
- Snapshot `createdAt` comes from `input.createdAt`.
- Summary `snapshotTimestamp` comes from `input.createdAt`.
- Each snapshot game's `snapshotTimestamp` comes from `input.createdAt`.
- Snapshot games come from `input.games`.
- Each game maps `gameId`, `officialDate`, `scheduledStartTime`, `awayTeam`, and `homeTeam`.
- Each game's `sourceProvenance` comes from `game.sourceProvenance`.
- Snapshot `warnings` are empty initially.
- Snapshot games contain no `finalScore`.
- Snapshot games contain no `completedGameState`.
- Snapshot games contain no `actualStartingPitchers`.
- Snapshot games contain no outcome or final-status fields.

## Validation and exit behavior

- Missing path exits 1.
- Multiple paths exit 1.
- Read or parse failure exits 1.
- Validation errors exit 1 and produce no snapshot.
- Valid input exits 0 and emits the snapshot summary.
- The invalid fixture remains an expected exit 1 case.
- Output must remain deterministic and suitable for exact golden testing.

## Safety boundary

- Snapshot creation from a manual file is local-only.
- The manual schedule file must be pre-game only.
- Outcome attachment remains separate and post-completion only.
- Actual starters remain evaluation-only.
- If starter-like schedule data is added later, schedule probable timestamp uncertainty must be preserved.
- modelProbability remains null/absent/not available until calibration exists.
- No live/API/web source is used.
- No network schedule ingestion is performed.
- No historical fixture data is mutated.
- No generated run artifacts are committed by default.

## Phase 4L tests

- Valid fixture creates deterministic snapshot stdout.
- Invalid fixture exits 1 and produces no snapshot.
- Missing and multiple path errors are reported.
- Malformed JSON returns a read/parse error.
- Snapshot excludes `finalScore` and `completedGameState`.
- Converted snapshot passes `validateProspectiveScheduleSnapshot`.
- No output files are written.

Phase 4M exact stdout golden-output tests are documented in `docs/mlb-manual-schedule-snapshot-cli-golden-output.md`.
They lock the valid exit 0 response with a snapshot and the invalid expected exit 1 response without a snapshot.

## Phase 4N manual week lock workflow plan

Phase 4N defined the deterministic wrapper and stdout contract for locking a validated manual schedule snapshot.
See `docs/mlb-manual-week-lock-workflow-plan.md`.
It is planning-only and does not add a command, file output, or generated run artifacts.

## Phase 4O manual week lock CLI

Phase 4O implements the planned deterministic wrapper as a separate local-only, stdout-only command.
See `docs/mlb-manual-week-lock-cli.md`.
The Phase 4L snapshot CLI remains conversion-only; Phase 4O validates, converts in memory, and wraps the valid snapshot without adding file output.

## Implementation staging

- Phase 4L — add manual schedule snapshot creation CLI, stdout-only, with no file output.
- Phase 4M — add golden-output tests for the manual schedule snapshot CLI.
- Phase 4N — plan the `lock-manual-week` workflow.
- Phase 4O — implement `lock-manual-week`, stdout-only, after the Phase 4N plan.
- Phase 4P — add exact lock CLI golden-output tests.
- Phase 4Q — plan explicit file-output mode for locked weekly artifacts.
- Phase 4R — implement that separate file-output mode.

## Success criteria

- Existing validator CLI remains unchanged.
- Valid manual schedule JSON can be converted into a deterministic prospective schedule snapshot.
- No invalid or forbidden pre-game fields can reach a snapshot.
- No network/API/web calls are needed.
- No generated artifacts are committed.
- Historical fixture inventory remains unchanged.

## Phase 4L validation

- Focused snapshot CLI tests pass: 7 tests.
- Prospective tests pass: 53 tests.
- Backtesting tests pass: 699 tests.
- Full Vitest and `npm test` pass: 809 tests across 55 files.
- TypeScript and production build pass.
- Inventory guard remains 29 total games (June 17, July 12).
- The valid fixture produces two games with zero validation messages.
- The invalid fixture exits 1 with five validation errors and no snapshot.
- See `docs/mlb-manual-schedule-snapshot-creation-cli.md` for the command-level validation note.

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

The Phase 4L snapshot CLI remains stdout-only and conversion-only. See `docs/mlb-manual-week-lock-file-output-plan.md` for the separate Phase 4Q lock artifact plan.
