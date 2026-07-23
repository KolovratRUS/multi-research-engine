# MLB Manual Schedule-File Schemas

Local-only schema/types and validators.
No live source used.
No real MLB API request made.
No web lookup used.
No real schedule ingestion performed.
No parser CLI implemented.
No generated prospective run artifact committed.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
modelProbability remains null/absent/not available until calibrated.

## Purpose

Phase 4G implements local TypeScript types and pure validators for future manually supplied MLB schedule JSON files.
This establishes the schema foundation before any file parser, CLI, or ingestion implementation.
This phase adds only `src/prospective/mlb/manual-schedule-file.ts` plus tests and documentation.

## Plan reference

- `docs/mlb-manual-schedule-file-dry-run-plan.md`
- `docs/mlb-prospective-weekly-test-mode-plan.md`

## Implemented module

- `src/prospective/mlb/manual-schedule-file.ts`

## Implemented types/helpers

- `MLB_MANUAL_SCHEDULE_SCHEMA_VERSION`
- `MLBManualScheduleSourceMode`
- `MLBManualScheduleFile`
- `MLBManualScheduleGame`
- `validateMLBManualScheduleFile`
- `buildScheduleSnapshotFromManualScheduleFile`

## Required top-level fields

- `schemaVersion`: `"mlb-manual-schedule-v1"`
- `sport`: `"MLB"`
- `sourceMode`: `"manual-schedule"`
- `runId`
- `weekStart`
- `weekEnd`
- `createdAt`
- `sourceProvenance`
- `games`

## Required game fields

- `gameId`
- `officialDate`
- `scheduledStartTime`
- `awayTeam`
- `homeTeam`
- `sourceProvenance`

## Forbidden pre-game fields

Presence of any of these fields on a schedule game returns a validation error:

- `finalScore`
- `completedGameState`
- `finalStatus`
- `outcomeStatus`
- `actualStartingPitchers`

## Forbidden external price/market-like fields

Presence of any of these field names returns a validation error:

- `closingOdds`
- `market`
- `price`
- `impliedProbability`
- `sportsbook`

## Converter behavior

- `buildScheduleSnapshotFromManualScheduleFile` converts a valid manual schedule file into an `MLBProspectiveScheduleSnapshot`.
- `sourceMode` is preserved from input.
- `snapshotTimestamp` is set to `createdAt`.
- `warnings` are empty.
- Output games do not include `finalScore` or `completedGameState`.

## Validation behavior

- `validateMLBManualScheduleFile` is pure and synchronous.
- It does not read files, fetch data, or mutate state.
- Duplicate `gameId` values return `MANUAL_SCHEDULE_DUPLICATE_GAME_ID`.
- Games with `officialDate` outside `weekStart`/`weekEnd` return `MANUAL_SCHEDULE_GAME_OUTSIDE_WEEK` when the values are simple `YYYY-MM-DD` strings.

## Safety boundary

- Validators are local and in-memory.
- No files are read by this module.
- No live/API/web data is fetched.
- No real schedule ingestion is performed.
- No generated run artifacts are created.
- Converted snapshots exclude `finalScore` and `completedGameState`.
- `modelProbability` remains null/absent/not available.
- Historical fixture inventory is unchanged.

## Validation

Leave this section empty until validation is run.

## Recommended next safe phase

Phase 4H — add manual schedule file fixture and validator golden tests.

State:
- local-only
- no live/API/web
- no real schedule ingestion
- add tiny static manual schedule fixture/golden only
- no generated artifacts committed

See `docs/mlb-manual-schedule-file-fixtures.md` for the committed static fixtures and golden validator outputs.
