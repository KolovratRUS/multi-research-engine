# MLB Manual Week Lock Workflow Plan

## Status

Phase 4N planning record.
Phase 4O stdout-only CLI implemented.
Phase 4R explicit file-output mode implemented.
No generated file-output artifact committed.
No generated prospective run artifact committed.
No live source used.
No real MLB API request made.
No web lookup used.
No network schedule ingestion.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
`modelProbability` remains null/absent/not available until calibrated.

## Purpose

Phase 4N planned the `lock-manual-week` workflow.
The workflow defines how a validated manual schedule snapshot becomes a locked weekly prospective test input.
This is the next design step after the Phase 4L stdout-only snapshot creation CLI and the Phase 4M snapshot CLI golden outputs.
Phase 4O implemented the local-only, stdout-only lock command.
Phase 4R implements the separately planned explicit file mode while preserving the Phase 4P no-flag stdout goldens.
Phase 4S adds exact fixture-only artifact and file-mode stdout summary regression coverage without changing Phase 4R behavior.
See `docs/mlb-manual-week-lock-cli.md`.

## Current foundation

- Phase 4G provides the manual schedule schema, validator, and converter helper.
- Phase 4H provides static manual schedule fixtures.
- Phase 4I provides the manual schedule validator CLI.
- Phase 4J provides exact validator CLI golden outputs.
- Phase 4K provides the snapshot creation plan.
- Phase 4L provides the stdout-only snapshot creation CLI.
- Phase 4M provides exact snapshot CLI golden outputs.
- Phase 4O provides the stdout-only manual week lock CLI and focused behavioral tests.
- Phase 4P provides exact manual week lock CLI golden outputs for valid and invalid local fixtures.
- Phase 4Q provides the separate planning-only file-output contract in `docs/mlb-manual-week-lock-file-output-plan.md`.
- Phase 4R implements that file-output contract with double-opt-in flags and focused behavioral tests.
- Phase 4S locks the exact valid artifact and file-mode stdout summary in `docs/mlb-manual-week-lock-file-output-golden-tests.md`.
- The historical fixture inventory remains 29 games: June 17 and July 12.

## Implemented command

Package command:

```text
prospective:mlb:lock-manual-week
```

Script path:

```text
scripts/mlb-manual-week-lock.ts
```

Both are implemented in Phase 4O. No-flag use remains stdout-only; Phase 4R adds optional file output only when both required flags are present.

## Implemented input

The first implementation accepts only one user-provided local manual schedule JSON path. This reuses the existing validation and conversion helpers and avoids introducing a second input contract before the basic locking behavior is stable.

The command must:

- accept exactly one local input path;
- validate the manual schedule before locking;
- reject invalid manual schedule files, including files with forbidden pre-game fields;
- convert valid input in memory;
- read no network, API, or web source;
- ingest no schedule from a network source; and
- have no dependency on historical fixtures.

Direct snapshot JSON input should remain a later extension. Its week-boundary and validation contract must be planned separately before implementation.

## Implemented output

The no-flag implementation emits the original stdout-only deterministic lock summary. Phase 4R preserves that exact output.

When both `--write-file` and `--output-dir <directory>` are present, the command also writes exactly one deterministic artifact after validation. The artifact body is the exact `lockedSnapshot`; it is not the outer CLI summary.

Fields, in stable order:

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
- `lockedSnapshot`, only when valid

Argument, read, and parse failures may also include stable `error` and `usage` fields, following the existing CLI conventions. Invalid input must never include `lockedSnapshot`.

## Determinism rules

The first implementation must not read the current clock to create timestamps.

- Use the manual schedule input `createdAt` as `snapshotTimestamp`.
- Use the same input `createdAt` as `lockedAt` in test mode.
- If a real current lock timestamp is needed later, require an explicit `--locked-at` argument so tests and reruns remain deterministic.
- Do not derive timestamps from file metadata, absolute paths, the machine clock, or machine-specific values.

## Lock identity

Use this deterministic identity:

```text
manual-week-lock:<runId>
```

For example, input `runId` `manual-schedule-fixture-week-1` produces:

```text
manual-week-lock:manual-schedule-fixture-week-1
```

The lock identity must not hash file paths, include absolute paths, or include machine-specific values.

## Implemented locked snapshot

`lockedSnapshot` should wrap the validated prospective schedule snapshot rather than duplicate or mutate its games.

Fields:

- `lockVersion`, value `"mlb-manual-week-lock-v1"`
- `runId`
- `lockId`
- `sourceMode`, fixed to `"manual-schedule"`
- `weekStart`
- `weekEnd`
- `lockedAt`
- `snapshot`
- `validationMessages`
- `warnings`, initially empty unless the future schema requires otherwise

The wrapper must preserve pre-game-only schedule data.
It must not add:

- final scores;
- completed game state;
- actual starters;
- outcomes; or
- final-status or outcome-status fields.

The nested snapshot should remain the output of the existing validated in-memory conversion and should pass snapshot validation where appropriate.

## Exit behavior

- Missing path exits 1.
- Multiple paths exit 1.
- Read or parse failure exits 1.
- Validation errors exit 1 and produce no `lockedSnapshot`.
- Valid input exits 0 and emits a deterministic lock summary with `lockedSnapshot`.
- The invalid forbidden-fields fixture remains an expected exit 1 case.

## Safety boundary

- Manual week locking is local-only.
- It freezes a pre-game schedule snapshot for later prospective research construction.
- It does not attach outcomes.
- It does not evaluate results.
- It does not use actual starters.
- Phase 1G-b observations remain unread and unused for pitcher availability.
- `TEAM_ONLY` excludes pitcher evidence.
- `researchStrengthScore`, `confidence`, `matchConfidence`, `dataQuality`, `volatility`, and `modelProbability` remain separate concepts.
- `modelProbability` remains null/absent/not available until calibrated.
- No live, API, or web source is used.
- No network schedule ingestion is performed.
- No historical fixture data is read, added, or modified by the command.
- No generated run artifacts are committed by default.
- Historical completion remains based only on `liveData.plays.allPlays[last].about.endTime` with provenance `LAST_COMPLETED_PLAY_END`.
- Strict schedule probable handling continues to require `SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN`.
- Historical schedule probable information must not be retrospectively promoted.
- Actual starters remain evaluation-only.

## Phase 4O tests

- A valid manual schedule fixture creates a deterministic lock summary.
- The invalid fixture exits 1 and produces no `lockedSnapshot`.
- Missing and multiple path cases return stable errors.
- Malformed JSON returns a stable read/parse error.
- `lockId` is deterministic and path-independent.
- `lockedAt` is deterministic from input `createdAt` or a future explicit argument.
- `lockedSnapshot` contains the expected two-game snapshot.
- `lockedSnapshot` excludes `finalScore`, `completedGameState`, `actualStartingPitchers`, `outcome`, `finalStatus`, and `outcomeStatus`.
- The nested snapshot passes snapshot validation where appropriate.
- No output files are written.

Exact valid and invalid lock stdout golden outputs are implemented in Phase 4P and documented in `docs/mlb-manual-week-lock-cli-golden-output.md`.

## Phase 4Q file-output plan

Phase 4Q separately planned how explicit file-output mode writes the exact valid `lockedSnapshot`.
See `docs/mlb-manual-week-lock-file-output-plan.md`.
Phase 4R implements the plan. The Phase 4N lock workflow remains the validation, conversion, determinism, and wrapper contract, and the Phase 4P no-flag goldens remain unchanged.

## Implementation staging

- Phase 4O — add the `lock-manual-week` CLI, stdout-only, with no file output.
- Phase 4P — add golden-output tests for the `lock-manual-week` CLI.
- Phase 4Q — plan file-output mode for locked weekly artifacts.
- Phase 4R — implemented explicit double-opt-in file-output mode after planning and goldens.
- Phase 4S — add golden and file-output tests for lock artifacts.
- Phase 4T — plan weekly prospective research construction from a locked manual week.
- Phase 4U — implemented weekly prospective research construction from a locked manual week.

## Success criteria

- The lock workflow remains fully local.
- Valid input creates a deterministic `lockedSnapshot` in memory and stdout.
- Invalid input never produces `lockedSnapshot`.
- No schedule data comes from a network, API, or web source.
- No final or outcome fields enter pre-game locked snapshots.
- No generated artifacts are committed by default.
- Historical fixture inventory remains unchanged.

## Validation

- Fixture inventory guard passes with 29 games from 2024-06-01 through 2024-07-21: June 17 and July 12.
- Prospective dry-run logic passes with zero validation errors and warnings.
- Valid manual schedule validator logic exits 0 with two games and no validation messages.
- Valid manual schedule snapshot logic exits 0 with the exact two-game in-memory snapshot.
- Valid manual week lock logic exits 0 with deterministic lock fields and the expected two-game `lockedSnapshot`.
- Invalid forbidden-fields lock logic exits 1 by design with five validation errors and no `lockedSnapshot`.
- Focused Phase 4O/4P lock CLI tests pass: 10 tests, including exact valid and invalid stdout goldens.
- Historical export release behavior passes in all four modes through the local loader.
- Focused historical export rollout review tests pass: 154 tests.
- Prospective tests pass: 65 tests.
- Backtesting tests pass: 699 tests.
- Full Vitest and `npm test` pass: 821 tests across 56 files.
- TypeScript passes.
- Production build passes.
- Git diff check passes.
- The valid and invalid lock stdout objects match the Phase 4P golden fixtures exactly; the valid nested snapshot passes `validateProspectiveScheduleSnapshot`.
- In the managed validation sandbox, direct npm commands whose `tsx` launcher opens a local IPC listener are blocked with `EPERM` before script execution. The inventory, dry-run, validator, snapshot, lock, and historical review entry points pass through the existing local `tsx/cjs` loader pattern without an IPC listener; package scripts remain unchanged.

## Phase 4T locked-week construction handoff

Phase 4T is planning-only and defines how the exact validated `lockedSnapshot` artifact will feed future deterministic pre-game research skeleton construction. See `docs/mlb-weekly-prospective-research-construction-plan.md`. It does not implement construction or change Phase 4R/4S lock behavior or goldens.

## Phase 4U stdout-only construction

Phase 4U implements the handoff through `npm run prospective:mlb:construct-week -- <locked-week-artifact-json>`. The input is the exact locked `lockedSnapshot` artifact, not a raw manual schedule. The command validates before emitting a deterministic stdout package with one pre-game `pending-research` `FULL` stub per locked game. It adds no file output or network ingestion, and the Phase 4P no-flag and Phase 4S file-output lock goldens remain unchanged.

## Recommended next safe phase

Phase 4V — add exact construction stdout golden tests.

State:

- local-only
- fixture-only
- exact stdout package regression tests
- no file output
- no live/API/web
- no network schedule ingestion
- no generated run artifacts committed
- no historical fixture data changes
