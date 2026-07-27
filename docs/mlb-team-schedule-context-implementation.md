# MLB Team Schedule Context Implementation

Status:
- Phase 5M
- implementation
- explicit local-only mode
- no exact stdout golden yet
- no file output
- no live/API/web
- no network schedule ingestion
- no historical fixture changes
- no package changes
- no modelProbability
- no pitcher evidence
- no actual starters
- no raw outcomes
- protected Phase 5B/5E/5H/5K goldens unchanged

Explicit mode:
--fixture-evidence-local --team-schedule-context-local

Rejection behavior:
--team-schedule-context-local alone returns TEAM_SCHEDULE_CONTEXT_REQUIRES_FIXTURE_EVIDENCE.

Output shape:
- Each game's research findings now include teamScheduleContext when --team-schedule-context-local is enabled.
- The schedule context object describes safe schedule-position data only (previous/next game timing, counts, labels).
- It does not include raw final scores, outcomes, completedGameState, finalStatus, actualStartingPitchers, modelProbability, or betting-like fields.

Safe derivation rules:
- Inputs limited to local construction package games and local fixture evidence records.
- Schedule data is derived from scheduledStartTime and team roles only.
- Past vs future classification is relative to the target game's scheduledStartTime and represents schedule position, not completed results.
- The target game is excluded from prior/next counts.
- Missing/invalid timestamps produce deterministic warnings and null/zero metrics.
- Travel fields are set to unknown/insufficient unless safe venue/timezone data is present.
- No live MLB API/network schedule ingestion is performed.

Forbidden outputs:
- live/API/web-derived data
- modelProbability
- pitcher fields/actual starters
- raw outcomes/final scores/completed state
- odds/market/price fields
- environment metadata
- absolute paths in output

Current local fixture behavior:
- Current manual fixtures produce deterministic insufficient/partial schedule context because no local schedule sequence evidence is provided beyond the construction package itself.
- This is expected and tests verify deterministic insufficient output.

Testing summary:
- Updated tests/prospective/mlb-team-recent-form-research.test.ts.
- Adds CLI guard tests for --team-schedule-context-local.
- Adds golden preservation tests for default/evidence/aggregate/result-metrics modes.
- Adds forbidden-field test for schedule context mode.
- Adds TEAM_ONLY shape test.
- Adds unit tests for buildTeamScheduleContext with synthetic local schedule records.
- Existing Phase 5B/5E/5H/5K goldens are unchanged.

Recommended Phase 5N:
- add exact stdout golden for schedule context mode
- no new research behavior
- preserve Phase 5B/5E/5H/5K goldens

Phase 5O is planning-only for richer synthetic local schedule-density fixture coverage. It adds `docs/mlb-team-schedule-context-synthetic-fixtures-plan.md`, does not modify runtime behavior, tests, goldens, or fixtures, and preserves Phase 5B/5E/5H/5K/5N goldens with no modelProbability, no raw outcomes, no pitcher evidence, no file output, and no live/API/web.
