# MLB Team Quality Context Implementation

Status:
- Phase 5R
- builder skeleton implementation
- unit tests only
- no CLI integration yet
- no stdout golden
- no file output
- no live/API/web
- no network ingestion
- no historical fixture changes
- no package changes
- no modelProbability
- no pitcher evidence
- no actual starters
- no raw outcomes
- protected Phase 5B/5E/5H/5K/5N/5T goldens unchanged

Builder:
- src/prospective/mlb/team-quality-context.ts

Test file:
- tests/prospective/mlb-team-quality-context.test.ts

Output shape:
- moduleVersion
- moduleName
- scope TEAM_ONLY
- awayTeamQualityContext
- homeTeamQualityContext

Each side context includes:
- status
- reason
- teamName
- localEvidenceGameCount
- opponentEvidenceGameCount
- recentOpponentEvidenceGameCount
- historicalSampleSizeLabel
- opponentSampleSizeLabel
- qualityContextCompletenessLabel
- volatilityContextLabel
- scheduleAdjustedContextLabel
- qualityContextWarnings
- dataQuality
- confidence
- researchStrengthScore

Deterministic labels:
- historicalSampleSizeLabel: none / thin / moderate / broad
- opponentSampleSizeLabel: none / thin / moderate / broad
- qualityContextCompletenessLabel: insufficient / partial / complete
- volatilityContextLabel: unavailable / low / moderate / high
- scheduleAdjustedContextLabel: unavailable / limited / supported
- dataQuality: insufficient / partial / usable
- confidence: low / medium / high
- researchStrengthScore: low / medium / high

Warnings:
- TEAM_QUALITY_CONTEXT_NO_LOCAL_EVIDENCE
- TEAM_QUALITY_CONTEXT_INSUFFICIENT_OPPONENT_EVIDENCE
- TEAM_QUALITY_CONTEXT_RECENT_SAMPLE_THIN
- TEAM_QUALITY_CONTEXT_SCHEDULE_CONTEXT_UNAVAILABLE
- TEAM_QUALITY_CONTEXT_SYNTHETIC_FIXTURE_ONLY
- TEAM_QUALITY_CONTEXT_FORBIDDEN_FIELD_STRIPPED
- TEAM_QUALITY_CONTEXT_INVALID_TIMESTAMP

Warnings are sorted/deduped deterministically.

Safety boundaries:
- The module is TEAM_ONLY and descriptive only.
- It does not output modelProbability, predictedWinner, pick, winChance, powerRating, teamRank, standingsPosition, finalScore, outcome, completedGameState, finalStatus, actualStartingPitchers, pitcher, odds, sportsbook, market, or price.
- It does not ingest current standings, rosters, injuries, schedules, or odds from web/API/network.
- It does not write research package files.
- It does not change default Phase 5B/5E/5H/5K behavior.
- It does not modify Phase 5J result-metrics behavior.
- It does not modify Phase 5M schedule-context behavior.

Current local fixture behavior:
- With no local records the builder returns deterministic insufficient outcomes for both teams.
- With synthetic local records it returns deterministic thin/moderate/broad labels.
- prohibited fields are absent from JSON output.

Recommended Phase 5S:
- integrate explicit --team-quality-context-local CLI mode behind local evidence, no default behavior change
- no stdout golden until later Phase 5T
- no modelProbability
- no raw outcomes
- no pitcher evidence
- no actual starters
- no file output
- no live/API/web
- no network standings/roster/schedule ingestion
- preserve Phase 5B/5E/5H/5K/5N goldens

Recommended Phase 5V:
- plan future MLB research report/interface format only
- no CLI/runtime behavior changes
- no new tests/goldens
- no modelProbability
- no picks/predictions/betting advice
- no raw outcomes
- no pitcher evidence
- no actual starters
- no file output
- no live/API/web
- no network standings/roster/schedule ingestion
- no historical fixture changes
- preserve Phase 5B/5E/5H/5K/5N/5T goldens
- preserve Phase 5S team-quality CLI behavior
- preserve Phase 5R builder behavior

Recommended Phase 5X scope

Phase 5X adds local-only MLB human-readable report renderer and tests.

Scope:
- local-only
- no runtime behavior
- no CLI behavior
- no website/API implementation
- no file output
- no new stdout golden
- no package/dependency changes
- no modelProbability
- no picks/predictions/betting advice
- no raw outcomes
- no pitcher evidence
- no actual starters
- no live/API/web
- no network standings/roster/schedule ingestion
- no historical fixture changes
- preserve Phase 5B/5E/5H/5K/5N/5T goldens
- preserve Phase 5S team-quality CLI behavior
- preserve Phase 5R builder behavior
- preserve Phase 5W adapter behavior

Recommended Phase 5Y scope

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
Recommended next safe phase is Phase 6D optional local handler fixture/golden-free validation coverage, or next sport module planning if the user chooses.

Phase 6D adds golden-free validation coverage for the local MLB reportPreview API handler.
It adds no server/backend/frontend code.
It adds no HTTP routes.
It adds no website/API deployment.
It adds no network behavior.
It adds no CLI behavior.
It adds no file output.
It adds no new stdout golden.
It adds no fixtures.
It adds no generated goldens.
It preserves Phase 5B/5E/5H/5K/5N/5T/5Z goldens.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 6C handler contract and hardens invalid-input handling only if needed.
It preserves Phase 6B API contract behavior unless explicitly documented.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.
Recommended next safe phase is Phase 6E website UI component boundary planning only, or next sport module planning if the user chooses.
