# MLB Prospective Weekly Local Dry-Run Sample

Local-only deterministic sample.
No live source used.
No real MLB API request made.
No web lookup used.
No real schedule ingestion.
No generated prospective run artifact committed.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
modelProbability remains null/absent/not available until calibrated.

## Purpose

Phase 4C adds a tiny deterministic local sample to exercise the Phase 4B schemas and validation helpers before any real schedule ingestion.
This file documents what the sample covers, the safety boundary it respects, and how to verify it.
This phase is local-only and does not implement live mode, fetch real schedules, attach outcomes from real games, or create prospective run artifacts.

## Plan and schema references

- `docs/mlb-prospective-weekly-test-mode-plan.md`
- `docs/mlb-prospective-weekly-dry-run-schemas.md`

## Sample summary

- runId: `mlb-local-dry-run-2024-07-sample`
- sourceMode: `local-dry-run`
- weekStart: `2024-07-01`
- weekEnd: `2024-07-07`
- local sample games: 3
- artifact builders added:
  - `buildMLBLocalDryRunManifest`
  - `buildMLBLocalDryRunScheduleSnapshot`
  - `buildMLBLocalDryRunPregameResearchSnapshots`
  - `buildMLBLocalDryRunLockedWeeklyOutput`
  - `buildMLBLocalDryRunOutcomeAttachments`
  - `buildMLBLocalDryRunEvaluationReport`
- validation helpers used:
  - `validateProspectiveScheduleSnapshot`
  - `validatePregameResearchSnapshot`
  - `validateLockedWeeklyOutput`
  - `validateOutcomeAttachment`

## Safety boundary

- This sample is not real MLB schedule data.
- This sample is not live/API/web-derived.
- Pre-game snapshots exclude `finalScore` and `completedGameState`.
- Outcomes are attached separately from pre-game snapshots.
- `modelProbability` remains `null`.
- Mock local team identifiers are used (e.g. `LOCAL_AWAY_1`, `LOCAL_HOME_1`).
- No historical fixture inventory changed: total games remain 29 (2024-06-01 through 2024-07-21, June 17, July 12).

## Suggested verification commands

Run from the repository root:

```bash
npx vitest run tests/prospective/mlb-local-dry-run-sample.test.ts --reporter=verbose
```

## Validation

- Prospective test file passes: tests/prospective/mlb-local-dry-run-sample.test.ts passes (7 tests).
- Full test suite passes: `npm test` (773 tests passed).
- TypeScript passes: `npx tsc --noEmit --incremental false --pretty false`.
- Build passes: `npm run build`.
- Git diff check passes: `git diff --check`.

## Recommended next safe phase

Phase 4D — add local prospective weekly dry-run CLI/check command.
State:
- local-only
- no live/API/web
- no real schedule ingestion
- no generated run artifacts committed
- command should validate the sample and print a deterministic JSON summary
