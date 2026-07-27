# MLB Team Schedule Context Synthetic Fixtures Plan

Phase 5O — planning-only for richer synthetic schedule-density fixture coverage.
No implementation. No runtime behavior. No tests/goldens/fixtures changed.

Status:
- Phase: 5O
- planning-only
- no implementation
- no runtime behavior changes
- no new tests/goldens
- no fixture data changes
- no file output
- no live/API/web
- no network schedule ingestion
- no historical fixture changes
- no package changes
- preserves Phase 5B/5E/5H/5K/5N goldens
- preserves Phase 5J result-metrics behavior
- preserves Phase 5M schedule-context behavior
- no modelProbability
- no pitcher evidence
- no actual starters
- no raw outcome/result fields

Purpose:
Plan richer synthetic local schedule scenarios for the MLB TEAM_ONLY schedule-context module.
Improve coverage of rest/compression, home/road sequences, previous/next game detection, and warning behavior.
Keep tests deterministic and local-only.
Avoid polluting real historical fixtures.

Recommended synthetic scenarios:
- previous game 24-48 hours before target
- previous game 72-96 hours before target
- no previous game
- no next game
- next game within 24-48 hours
- gamesInLast3Days boundary
- gamesInLast7Days boundary
- gamesInNext3Days boundary
- gamesInNext7Days boundary
- consecutiveRoadGames >= 3
- consecutiveHomeGames >= 3
- mixed home/away sequence
- target game excluded from counts
- same-day doubleheader-like schedule-position case (schedule-time only, non-result-based)
- duplicate warning dedupe/sort
- travelBurdenLabel remains insufficient/unknown when no safe venue/timezone/coordinate data is present
- invalid/missing scheduledStartTime in unit-only records if safer than JSON fixture changes

Exact timestamps proposal (deterministic target):
- target scheduledStartTime: 2024-07-10T19:00:00Z
- synthetic schedule records around it:
  - 2024-07-02T19:00:00Z
  - 2024-07-04T19:00:00Z
  - 2024-07-07T19:00:00Z
  - 2024-07-08T19:00:00Z
  - 2024-07-09T19:00:00Z
  - target 2024-07-10T19:00:00Z
  - 2024-07-11T19:00:00Z
  - 2024-07-12T19:00:00Z
  - 2024-07-14T19:00:00Z
  - 2024-07-17T19:00:00Z

Fixture strategy:
- future synthetic manual fixture file under tests/prospective/fixtures/manual-schedule/
- or a dedicated test fixture file in a later implementation phase
- clearly fake team names (not real MLB teams)
- no scores/results/outcomes
- no pitcher data
- no odds/market/price fields
- no live/API/web-derived fields
- never mixed into src/fixtures/backtesting/mlb/fixture-games.ts

Expected assertions for future implementation:
- previousGameScheduledAt / nextGameScheduledAt correctness
- hoursSincePreviousGame / hoursUntilNextGame determinism
- gamesInLast3Days / gamesInLast7Days / gamesInNext3Days / gamesInNext7Days boundary behavior
- consecutiveRoadGames / consecutiveHomeGames labels
- scheduleDensityLabel / restAdvantageLabel / homeAwaySequenceLabel
- travelBurdenLabel remains insufficient/unknown without safe venue/timezone/coordinate data
- scheduleContextWarnings determinism and dedupe/sort
- deterministic output equality across runs
- forbidden fields absent
- target game excluded from window counts

Recommended future sequencing:
- Phase 5P: add synthetic unit/fixture coverage for schedule-density cases, no runtime behavior change, no new stdout golden unless specifically scoped
- Phase 5Q: if needed, add exact synthetic schedule-context fixture golden or snapshot-style test, still local-only
- Phase 5R: plan next TEAM_ONLY module, perhaps opponent/team quality or bullpen workload planning, with no modelProbability

Safety and leakage:
- Future scheduled games are schedule context only, not outcomes
- Do not use target-game result information
- Do not infer completion from status/final fields
- Do not use scores/results/outcomes
- Do not add modelProbability
- Do not add pitcher evidence
- Do not add actual starters
- Do not use live/API/web/network data
- Do not modify historical fixture inventory
- Keep fake team names obvious
- travelBurdenLabel remains insufficient unless safe venue/timezone/coordinate data is present

Recommended next safe phase:
- Phase 5P: add synthetic schedule context unit/fixture coverage
  - tests/fixtures only
  - no runtime behavior changes unless a bug is discovered and explicitly fixed
  - no new stdout golden unless specifically scoped
  - no modelProbability
  - no raw outcomes
  - no pitcher evidence
  - no actual starters
  - no file output
  - no live/API/web
  - no network schedule ingestion
  - no historical fixture changes
  - preserve Phase 5B/5E/5H/5K/5N goldens
