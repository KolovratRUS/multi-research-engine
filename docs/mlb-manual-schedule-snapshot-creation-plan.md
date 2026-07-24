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
- Phase 4R implements that separate lock CLI file-output contract without changing snapshot CLI behavior.
- Phase 4S provides exact fixture-only file artifact and file-mode stdout summary regression coverage in `docs/mlb-manual-week-lock-file-output-golden-tests.md`.
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
- Phase 4R — implemented that separate file-output mode while preserving snapshot CLI behavior.
- Phase 4S — add golden and file-output regression tests for lock artifacts.
- Phase 4T — plan weekly prospective research construction from a locked manual week.

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

## Phase 4T locked-week construction handoff

Phase 4T is planning-only and defines how the exact validated lock artifact will feed future deterministic pre-game research skeleton construction. See `docs/mlb-weekly-prospective-research-construction-plan.md`. It does not implement construction or change Phase 4R/4S lock behavior or goldens.

## Phase 4U stdout-only construction

Phase 4U implemented the separate construction command from the exact locked `lockedSnapshot` artifact, not from this raw manual schedule input. Its no-flag form validates before emitting a deterministic stdout package with one pre-game `pending-research` `FULL` stub per locked game. Phase 4U itself added no file output or network ingestion and left the Phase 4P/4S lock goldens unchanged.

## Phase 4V construction stdout golden tests

Phase 4V added exact byte-for-byte no-flag construction stdout goldens for the valid package and representative invalid locked artifacts. At that phase, Phase 4U behavior and the Phase 4P/4S lock goldens remained unchanged and construction file output was not yet implemented.

## Phase 4W construction file-output plan

Phase 4W planned construction file output in `docs/mlb-weekly-prospective-research-construction-file-output-plan.md`. Phase 4X implements the double-opt-in mode without changing snapshot responsibilities. It writes the exact inner construction package, emits summary-only file-mode stdout, refuses overwrite, and leaves Phase 4U no-flag behavior plus the Phase 4V, Phase 4P, and Phase 4S goldens unchanged.

## Recommended next safe phase

Phase 4Y adds exact static construction file artifact and file-mode stdout summary goldens without changing Phase 4X file output, Phase 4V no-flag construction stdout goldens, or Phase 4P/4S lock goldens. Generated `tmp` artifacts remain ignored, uncommitted, and cleaned.

Phase 4Z — plan first real research module handoff.

State:

- planning-only
- no implementation
- no live/API/web
- no network schedule ingestion
- no generated run artifacts committed
- no historical fixture data changes
- no `modelProbability` yet
- identify module inputs and outputs only

The Phase 4L snapshot CLI remains stdout-only and conversion-only. Phase 4R behavior remains unchanged, Phase 4P no-flag goldens remain protected, and generated lock artifacts stay local and uncommitted. See `docs/mlb-manual-week-lock-file-output-golden-tests.md` for Phase 4S coverage.
