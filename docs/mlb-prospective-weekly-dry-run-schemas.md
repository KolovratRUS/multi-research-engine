# MLB Prospective Weekly Dry-Run Schemas

Local-only schema/types implementation.
No live source used.
No real MLB API request made.
No web lookup used.
No real schedule ingestion.
No prospective run artifact generated.
No fixture data added or modified.
No model-quality or predictive-performance claim.
modelProbability remains null/absent/not available until calibrated.

## Purpose

This phase adds TypeScript types and validation helpers for future local prospective weekly dry-runs.
It is local-only and does not implement live mode, fetch real schedules, attach outcomes, or create prospective run artifacts.

## Plan reference

`docs/mlb-prospective-weekly-test-mode-plan.md`

## Implemented types

- `MLBProspectiveSourceMode`
  - `local-dry-run`
  - `manual-schedule`
  - `authorized-ingestion`

- `MLBProspectiveRunStatus`
  - `planned`
  - `snapshot-created`
  - `locked`
  - `outcomes-attached`
  - `evaluated`

- `MLBProspectiveConstructionMode`
  - `TEAM_ONLY`
  - `FULL`

- `MLBProspectiveOutcomeStatus`
  - `not-attached`
  - `final`
  - `postponed`
  - `cancelled`
  - `suspended`

- `MLBProspectiveValidationSeverity`
  - `info`
  - `warning`
  - `error`

- `MLBProspectiveValidationMessage`
  - severity
  - code
  - message

- `MLBProspectiveWeeklyRunManifest`
  - runId
  - sport: `MLB`
  - weekStart
  - weekEnd
  - generatedAt
  - sourceMode
  - status
  - warnings

- `MLBProspectiveGameSnapshot`
  - gameId
  - officialDate
  - scheduledStartTime
  - awayTeam
  - homeTeam
  - snapshotTimestamp
  - sourceProvenance
  - `finalScore?: never`
  - `completedGameState?: never`

- `MLBProspectiveScheduleSnapshot`
  - runId
  - createdAt
  - sourceMode
  - games
  - warnings

- `MLBPregameResearchSnapshot`
  - runId
  - gameId
  - createdAt
  - constructionMode
  - evidenceIncluded
  - evidenceExcluded
  - researchStrengthScore
  - confidence
  - matchConfidence
  - dataQuality
  - volatility
  - warnings
  - `modelProbability: null`

- `MLBLockedWeeklyOutput`
  - runId
  - lockedAt
  - lockReason
  - gamesIncluded
  - gamesSkippedOrAbstained
  - validationStatus
  - warnings

- `MLBOutcomeAttachment`
  - runId
  - gameId
  - attachedAt
  - outcomeStatus
  - completionProvenance
  - optional `finalScore` only for final outcomes

- `MLBWeeklyEvaluationReport`
  - runId
  - generatedAt
  - gamesProcessed
  - lockedOutputs
  - outcomesAttached
  - skipsOrAbstentions
  - warningSummary
  - calibrationStatus
  - modelProbabilityStatus

## Validation helpers

- `validateProspectiveScheduleSnapshot(snapshot)`: validates runId, createdAt, sourceMode, at least one game, and that no game contains finalScore/completedGameState; requires sourceProvenance for each game.
- `validatePregameResearchSnapshot(snapshot)`: validates creation fields and construction mode; requires modelProbability to be exactly null.
- `validateLockedWeeklyOutput(output)`: validates runId, lockedAt, lockReason, and validationStatus.
- `validateOutcomeAttachment(attachment)`: validates runId, gameId, attachedAt, outcomeStatus, completionProvenance, and finalScore rules (finalScore only allowed for final outcomes).

All validators accept `unknown` input and return deterministic `MLBProspectiveValidationMessage[]`.
They do not perform IO.

## Safety boundary

- Pre-game snapshots reject `finalScore` and `completedGameState`.
- Pre-game research requires `modelProbability` null.
- Outcome attachment is separate from locked pre-game output.
- `finalScore` is only valid for final outcomes.
- No live/API/web source.
- No fixture data changes.
- No generated run artifacts committed.
- Historical schedule probable safety and timestamp uncertainty rules are unchanged.

## Tests added

`tests/prospective/mlb-weekly-test-schemas.test.ts`
- valid local dry-run schedule snapshot passes validation
- schedule snapshot with `finalScore` returns an error
- schedule snapshot with `completedGameState` returns an error
- pregame research snapshot with `modelProbability` null passes validation
- pregame research snapshot with non-null `modelProbability` returns an error
- locked weekly output requires `lockedAt` and `lockReason`
- outcome attachment with `finalScore` and `final` status passes
- outcome attachment with `finalScore` and non-final status returns an error

## Recommended next safe phase

Phase 4C — add local prospective weekly dry-run fixture sample.
State:
- tiny deterministic local sample/golden only if needed
- no live/API/web
- no real schedule ingestion
- no fixture data changes unless explicitly adding a separate prospective fixture sample
- no generated run artifacts committed
