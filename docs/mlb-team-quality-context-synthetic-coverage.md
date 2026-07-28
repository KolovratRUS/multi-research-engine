# MLB Team Quality Context Synthetic Coverage

Phase 5U adds richer synthetic TEAM_QUALITY_CONTEXT unit/fixture coverage.
It adds no new research behavior. It adds no stdout golden.
It preserves Phase 5B/5E/5H/5K/5N/5T goldens.
It preserves Phase 5S team-quality CLI behavior.
It preserves Phase 5R builder behavior unless explicitly documented.

## Status

- Phase 5U
- tests only
- docs only
- no default behavior change
- no stdout golden change
- no historical fixture change
- no package/dependency change
- local-only
- no live source
- no web/API/network

## Test file

- tests/prospective/mlb-team-quality-context.test.ts

## Covered synthetic scenarios

- exactly 0 records => historicalSampleSizeLabel none
- exactly 1 record => thin
- exactly 2 records => thin
- exactly 3 records => moderate
- exactly 5 records => moderate
- exactly 6 records => broad
- opponentSampleSizeLabel thresholds none/thin/moderate/broad
- recentOpponentEvidenceGameCount counts only records inside the deterministic recent window
- records for unrelated teams are ignored
- target game is excluded even if included in localRecords
- invalid timestamp records do not inflate counts and add TEAM_QUALITY_CONTEXT_INVALID_TIMESTAMP
- forbidden fields on input records add TEAM_QUALITY_CONTEXT_FORBIDDEN_FIELD_STRIPPED but do not serialize forbidden fields
- warnings remain sorted and deduped
- scheduleAdjustedContextLabel stays unavailable when no optional schedule context is supplied
- deterministic output remains deep-equal across repeated calls with equivalent inputs
- no output contains modelProbability, predictedWinner, pick, winChance, powerRating, teamRank, standingsPosition, finalScore, outcome, completedGameState, finalStatus, actualStartingPitchers, pitcher, odds, sportsbook, market, price

## Safety boundary

- sample is not real MLB schedule data
- sample is not live/API/web-derived
- no pitcher evidence
- no actual starters
- no raw outcomes/result fields
- no scores/results/outcomes
- no odds/market/price data
- no current standings/roster/injury fields
- no modelProbability in output
- no generated run artifacts
- no historical fixture data added or modified

## Validation

Leave validation results here after running:

- npm run inventory:mlb-fixtures
- npx vitest run tests/prospective/mlb-team-quality-context.test.ts --reporter=verbose
- npx vitest run tests/prospective/mlb-team-recent-form-research.test.ts --reporter=verbose
- npx vitest run tests/prospective --reporter=verbose
- npx vitest run tests/backtesting --reporter=verbose
- npx vitest run --reporter=verbose
- npx tsc --noEmit --incremental false --pretty false
- npm test
- npm run build
- git diff --check

## Recommended Phase 5V scope

Phase 5V — plan future MLB research report/interface format only.

Scope:
- planning-only
- no runtime behavior
- no CLI behavior
- no website/API implementation
- no file output
- no new tests/goldens
- no modelProbability
- no picks/predictions/betting advice
- no raw outcomes
- no pitcher evidence
- no actual starters
- no live/API/web
- no network standings/roster/schedule ingestion
- no historical fixture changes
- preserve Phase 5B/5E/5H/5K/5N/5T goldens
- preserve Phase 5S CLI behavior
- preserve Phase 5R/5U team-quality behavior

## Recommended Phase 5W scope

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
- preserve Phase 5S CLI behavior
- preserve Phase 5R/5U team-quality behavior
- preserve Phase 5W adapter behavior

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
- Recommended next safe phase is Phase 5Z.

Docs:
- docs/mlb-research-report-interface-plan.md
- docs/mlb-research-report-adapter-implementation.md