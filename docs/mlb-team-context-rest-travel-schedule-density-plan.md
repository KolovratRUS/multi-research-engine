# MLB Team Context — Rest/Travel/Schedule-Density Plan

## Status

Phase 5P adds synthetic schedule-context unit/fixture coverage. It adds no new stdout golden. It preserves Phase 5B/5E/5H/5K/5N goldens. It preserves Phase 5J result-metrics behavior. It preserves Phase 5M schedule-context behavior. No modelProbability. No raw outcomes. No pitcher evidence. No actual starters. No file output. No live/API/web or network schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5Q.

- Phase: 5L
- planning-only
- no implementation
- no runtime behavior
- no new tests/goldens
- no file output
- no live/API/web
- no network schedule ingestion
- no historical fixture changes
- no package changes
- preserves Phase 5B/5E/5H/5K goldens
- preserves Phase 5J behavior
- no modelProbability
- no pitcher evidence
- no actual starters
- no raw outcome/result fields

## Purpose

Add safe descriptive MLB team context around scheduling load and travel-like burden.
This context should make the future research package more useful before prediction/calibration.
It is separate from result-derived metrics and pitcher context.

## Proposed Module Name and Scope

- Proposed module name: MLB_TEAM_SCHEDULE_CONTEXT or TEAM_SCHEDULE_CONTEXT
- Scope: TEAM_ONLY
- Inputs: local construction package target games plus local historical/nearby schedule fixtures where safe
- Output: descriptive context only

## Safe Inputs for a Later Implementation

Allowed:
- target game scheduledStartTime
- target officialDate
- target awayTeam/homeTeam
- local locked schedule games
- local historical fixture scheduledStartTime/officialDate
- local team role HOME/AWAY
- local venue/city/time-zone fields only if already safely present and validated later
- safe completion provenance only if using completed past games for previous schedule position

Forbidden:
- live/API/web schedule ingestion
- raw results/outcomes/final scores
- modelProbability
- pitcher fields/actual starters
- odds/market/price fields
- user machine paths/environment metadata

## Planned Metrics/Concepts

Allowed planned fields:
- previousGameScheduledAt
- nextGameScheduledAt
- daysSincePreviousGame
- hoursSincePreviousGame
- daysUntilNextGame
- hoursUntilNextGame
- gamesInLast3Days
- gamesInLast7Days
- gamesInNext3Days
- gamesInNext7Days
- consecutiveRoadGames
- consecutiveHomeGames
- homeAwaySequenceLabel
- scheduleDensityLabel
- restAdvantageLabel
- travelBurdenLabel
- scheduleContextCompletenessLabel
- scheduleContextWarnings

Careful with:
- travelDistanceMiles/km only if venue coordinates or verified city/venue data are safely available later
- timezoneShiftHours only if time zones are safely available later
- seriesGameNumber only if same-opponent consecutive sequence can be derived locally and safely

## Forbidden Outputs

- modelProbability
- predictedWinner
- pick
- confidence as win probability
- odds/market/price/EV/ROI/betting value
- raw finalScore
- raw outcome
- completedGameState
- finalStatus
- actualStartingPitchers
- pitcher fields
- injury/lineup/live status fields unless separately planned and safely sourced later
- target-game result information

## Leakage and Safety Rules

- Do not use target-game results
- Do not use future games as if completed
- Future scheduled games may be used only as schedule context, not as outcomes
- Past completed games may be used for schedule sequence only if timestamp-safe
- Do not infer completion from finalStatus/status/outcome
- Do not mix schedule-density labels with model confidence
- Schedule context should affect only descriptive research until calibrated later
- Labels must be data-quality/context labels, not predictions

## Proposed Output Shape

Example only, not implementation:

teamScheduleContext:
  status
  reason
  recencyWindowDays
  futureWindowDays
  previousGameScheduledAt
  nextGameScheduledAt
  hoursSincePreviousGame
  hoursUntilNextGame
  gamesInLast7Days
  gamesInNext7Days
  consecutiveRoadGames
  consecutiveHomeGames
  homeAwaySequenceLabel
  scheduleDensityLabel
  restAdvantageLabel
  travelBurdenLabel
  scheduleContextCompletenessLabel
  scheduleContextWarnings

Fields should be null/omitted when unsafe or unavailable.

## Testing Plan for Future Phase 5M

- Implement behind explicit local-only flag, maybe:
  --fixture-evidence-local --team-schedule-context-local
  or
  --schedule-context-local
- Reject invalid flag combinations cleanly
- Preserve Phase 5B/5E/5H/5K goldens
- Add focused tests for:
  - no default behavior change
  - no golden changes unless explicit mode
  - past/future schedule separation
  - target game exclusion from prior schedule context
  - no raw outcomes
  - deterministic labels/warnings
  - missing venue/timezone behavior
  - no generated artifacts
- Later Phase 5N can add exact stdout golden if implementation is successful

## Sequencing Recommendation

- Phase 5M: implement schedule context module behind explicit local-only mode
- Phase 5N: add exact stdout golden for schedule context mode
- Phase 5O: plan/use synthetic schedule fixture with richer local schedule density cases
- Phase 5P: consider team/opponent quality planning or bullpen workload planning, still no modelProbability

## Recommended Next Safe Phase

- Phase 5M: implement MLB team schedule context behind explicit local-only mode
- State:
  - implementation
  - explicit local-only flag
  - no modelProbability
  - no raw outcomes
  - no pitcher evidence
  - no actual starters
  - no file output
  - no live/API/web
  - no network schedule ingestion
  - no historical fixture changes
  - preserve Phase 5B/5E/5H/5K goldens