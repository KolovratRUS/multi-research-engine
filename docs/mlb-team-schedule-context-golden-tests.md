# MLB Team Schedule Context Golden Tests

Phase 5N — exact stdout golden regression coverage for explicit schedule-context mode.

Status:
- Phase 5N
- golden
- exact stdout lock
- no new research behavior
- no file output
- no live/API/web
- no network schedule ingestion

Golden file:
- tests/prospective/fixtures/manual-schedule/valid-mlb-team-schedule-context-local-cli-output-v1.json

Command:
node --require tsx/cjs scripts/mlb-team-recent-form-research.ts tests/prospective/fixtures/manual-schedule/valid-weekly-prospective-research-construction-file-artifact-v1.json --fixture-evidence-local --team-schedule-context-local

What is locked:
- Exact stdout bytes for schedule-context mode.
- Top-level `teamScheduleContextLocal: true`.
- `fixtureEvidenceLocal: true`.
- `gameCount: 2`.
- Each game has `researchFindings.teamScheduleContext`.
- `moduleVersion: mlb-team-schedule-context-v1`.
- `moduleName: TEAM_SCHEDULE_CONTEXT`.
- `scope: TEAM_ONLY`.
- Deterministic insufficient/partial labels, counts, and warnings for current manual fixtures.

Protected defaults:
- Phase 5B default stdout golden unchanged.
- Phase 5E evidence-enabled stdout golden unchanged.
- Phase 5H aggregate stdout golden unchanged.
- Phase 5K result-metrics stdout golden unchanged.
- Phase 5J result-metrics implementation behavior unchanged.
- Phase 5M schedule-context implementation behavior unchanged.

Forbidden outputs:
- No `modelProbability`.
- No `predictedWinner`.
- No `pick`.
- No raw `finalScore`.
- No raw `outcome`.
- No `completedGameState`.
- No `finalStatus`.
- No `actualStartingPitchers`.
- No pitcher-availability fields.
- No odds/market/price fields.
- No absolute paths.
- No stack traces.

Validation:
- Run `npx vitest run tests/prospective/mlb-team-recent-form-research.test.ts --reporter=verbose`.
- Run `npx vitest run` for full suite.
- Run `npm test`.
- Run `git diff --check`.
- Re-run schedule-context CLI command and confirm byte-for-byte match against the golden after validation updates.

Recommended Phase 5O:
- Plan/use synthetic schedule fixture with richer local schedule density cases.
- Planning-only unless explicitly scoped otherwise.
- No `modelProbability`.
- No raw outcomes.
- No pitcher evidence.
- No file output.
- No live/API/web.
- No network schedule ingestion.
- No historical fixture changes.
