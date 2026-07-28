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

Phase 5P is planning-only for richer synthetic local schedule-density fixture coverage. It adds `docs/mlb-team-schedule-context-synthetic-fixtures-coverage.md`, does not modify runtime behavior, tests, goldens, or fixtures, and preserves Phase 5B/5E/5H/5K/5N goldens with no modelProbability, no raw outcomes, no pitcher evidence, no file output, and no live/API/web.

Phase 5V is planning-only. It plans the future MLB research report/interface format. It adds no runtime behavior. It adds no CLI behavior. It adds no website/API implementation. It adds no file output. It adds no new tests/goldens. It preserves Phase 5B/5E/5H/5K/5N/5T goldens. It preserves Phase 5S CLI behavior. It preserves Phase 5R/5U team-quality behavior. No modelProbability. No picks/predictions/betting advice. No raw outcomes. No pitcher evidence. No actual starters. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5W.

Phase 5W adds local-only typed MLB research report-shape adapter skeleton and tests. It adds no runtime behavior. It adds no CLI behavior. It adds no website/API implementation. It adds no file output. It adds no new stdout golden. It preserves Phase 5B/5E/5H/5K/5N/5T goldens. It preserves Phase 5S CLI behavior. It preserves Phase 5R/5U team-quality behavior. No modelProbability. No picks/predictions/betting advice. No raw outcomes. No pitcher evidence. No actual starters. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5X.

Phase 5X adds local-only MLB human-readable report renderer and tests. It adds no CLI behavior. It adds no file output. It adds no website/API implementation. It adds no new stdout golden. It preserves Phase 5B/5E/5H/5K/5N/5T goldens. It preserves Phase 5S CLI behavior. It preserves Phase 5W adapter behavior unless explicitly documented. It preserves Phase 5R/5U team-quality behavior. No modelProbability. No picks/predictions/betting advice. No raw outcomes. No pitcher evidence. No actual starters. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes.
Phase 6A adds a documentation-only MLB website/API integration boundary plan.
It adds no runtime code.
It adds no website/API implementation.
It adds no server/backend/frontend code.
It adds no CLI behavior.
It adds no CLI flag.
It adds no stdout golden.
It preserves Phase 5B default stdout golden.
It preserves Phase 5E evidence-enabled stdout golden.
It preserves Phase 5H aggregate stdout golden.
It preserves Phase 5K result-metrics stdout golden.
It preserves Phase 5N schedule-context stdout golden.
It preserves Phase 5T team-quality stdout golden.
It preserves Phase 5Z report-preview golden.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
It preserves Phase 5S team-quality CLI behavior.
It preserves Phase 5R/5U team-quality behavior.
It preserves Phase 4X construction file-output behavior.
It preserves Phase 4Y construction file-output goldens.
It preserves Phase 4V no-flag construction stdout goldens.
It preserves lock CLI behavior.
It preserves Phase 4P no-flag lock goldens.
It preserves Phase 4S file-output lock goldens.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.
No file output.
No package.json or package-lock.json changes.
Recommended next safe phase is Phase 6B typed local API contract/schema for reportPreview only, or next sport module planning if the user chooses.

## Phase 5Y Status

- Phase 5Y adds optional explicit `--report-preview-local` JSON CLI mode.
- It requires `--fixture-evidence-local`.
- It adds `reportPreviewLocal: true` and `reportPreview` only in explicit mode.
- It adds no default behavior change.
- It adds no file output.
- It adds no website/API implementation.
- It adds no new stdout golden.
- It preserves Phase 5B/5E/5H/5K/5N/5T goldens.
- It preserves Phase 5S team-quality CLI behavior.
- It preserves Phase 5W adapter behavior.
- It preserves Phase 5X renderer behavior.
- It preserves Phase 5R/5U team-quality behavior.
- No modelProbability.
- No picks/predictions/betting advice.
- No raw outcomes.
- No pitcher evidence.
- No actual starters.
- No live/API/web or network standings/roster/schedule ingestion.
- No historical fixture changes.


Docs:
- docs/mlb-research-report-interface-plan.md
- docs/mlb-research-report-adapter-implementation.md
## Phase 5Z Status

Phase 5Z adds exact stdout golden regression coverage for explicit `--fixture-evidence-local --report-preview-local`.
It adds one new golden: `tests/prospective/fixtures/manual-schedule/valid-mlb-report-preview-local-cli-output-v1.json`.
It adds no default behavior change.
It adds no file output.
It adds no website/API implementation.
It preserves Phase 5B/5E/5H/5K/5N/5T goldens.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 5S team-quality CLI behavior.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
It preserves Phase 5R/5U team-quality behavior.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.

Phase 6A adds a documentation-only MLB website/API integration boundary plan.
It adds no runtime code.
It adds no website/API implementation.
It adds no server/backend/frontend code.
It adds no CLI behavior.
It adds no CLI flag.
It adds no stdout golden.
It preserves Phase 5B default stdout golden.
It preserves Phase 5E evidence-enabled stdout golden.
It preserves Phase 5H aggregate stdout golden.
It preserves Phase 5K result-metrics stdout golden.
It preserves Phase 5N schedule-context stdout golden.
It preserves Phase 5T team-quality stdout golden.
It preserves Phase 5Z report-preview golden.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
It preserves Phase 5S team-quality CLI behavior.
It preserves Phase 5R/5U team-quality behavior.
It preserves Phase 4X construction file-output behavior.
It preserves Phase 4Y construction file-output goldens.
It preserves Phase 4V no-flag construction stdout goldens.
It preserves lock CLI behavior.
It preserves Phase 4P no-flag lock goldens.
It preserves Phase 4S file-output lock goldens.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.
No file output.
No package.json or package-lock.json changes.
Recommended next safe phase is Phase 6B typed local API contract/schema for reportPreview only, or next sport module planning if the user chooses.

Phase 6B adds a typed local API contract/schema for MLB reportPreview only.
It adds no server/backend/frontend code.
It adds no website/API implementation.
It adds no network behavior.
It adds no CLI behavior.
It adds no file output.
It adds no new stdout golden.
It preserves Phase 5B/5E/5H/5K/5N/5T/5Z goldens.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
It preserves Phase 5S team-quality CLI behavior.
It preserves Phase 5R/5U team-quality behavior.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.
Recommended next safe phase is Phase 6C local in-process API adapter/handler using existing reportPreview contract, or next sport module planning if the user chooses.

Phase 6C adds a local in-process MLB reportPreview API adapter/handler.
It adds no real server/backend/frontend code.
It adds no HTTP routes.
It adds no website/API deployment.
It adds no network behavior.
It adds no CLI behavior.
It adds no file output.
It adds no new stdout golden.
It preserves Phase 5B/5E/5H/5K/5N/5T/5Z goldens.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 6B API contract behavior.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
It preserves Phase 5S team-quality CLI behavior.
It preserves Phase 5R/5U team-quality behavior.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.
Recommended next safe phase is Phase 6D optional local handler fixture/golden-free validation coverage, or next sport module planning if the user chooses.
