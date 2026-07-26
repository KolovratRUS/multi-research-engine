# MLB Prospective Weekly Team Recent Form Fixture Evidence Provider

- Phase 5E completed: exact --fixture-evidence-local stdout golden locked. Phase 5D provider behavior, default Phase 5B goldens, and Phase 4/5 protected goldens remain unchanged.
- Phase 5F is planning-only aggregate summary planning in `docs/mlb-team-recent-form-aggregate-summary-plan.md`. It does not add implementation, file output, or any live/API/web access.

## Command

Default command remains unchanged:
- npm run prospective:mlb:research-team-form -- tests/prospective/fixtures/manual-schedule/valid-weekly-prospective-research-construction-file-artifact-v1.json

Evidence-enabled command:
- npm run prospective:mlb:research-team-form -- tests/prospective/fixtures/manual-schedule/valid-weekly-prospective-research-construction-file-artifact-v1.json --fixture-evidence-local

## Provider Contract

Source: src/prospective/mlb/team-recent-form-fixture-evidence.ts

Exports:
- TEAM_FORM_EVIDENCE_DEFAULT_LOOKBACK_GAMES = 3
- TEAM_FORM_EVIDENCE_DEFAULT_LOOKBACK_DAYS = 30
- buildMLBTeamRecentFormFixtureEvidence(target, historicalFixtures, lookback?)
- Types: TeamRecentFormEvidenceTarget, TeamRecentFormEvidenceRecord, TeamRecentFormEvidenceItem, TeamRecentFormFixtureEvidenceResult, TeamRecentFormFixtureEvidenceLookback

Inputs:
- target game: gameId, scheduledStartTime, awayTeam, homeTeam
- historicalFixtures: readonly TeamRecentFormEvidenceRecord[]
- lookback window: games and days

Outputs:
- lookbackWindowGames
- lookbackWindowDays
- awayRecentGamesFound
- homeRecentGamesFound
- awaySummary / homeSummary with status and reason
- dataQuality: complete / partial / insufficient
- volatility: not-evaluated
- confidence: high / medium / low
- warnings: readonly string[]
- evidence: readonly TeamRecentFormEvidenceItem[]

Evidence item fields:
- sourceGameId
- officialDate
- completedAt
- team
- teamRole
- opponent
- sourceProvenance

## Safe Completion Rule

Only consider a historical fixture completed when there is a safe completion timestamp derived from liveData.plays.allPlays[last].about.endTime and provenance LAST_COMPLETED_PLAY_END. Do not use finalStatus/status/outcome as a substitute. If current fixture shape lacks this surface, exclude those records and emit TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION warnings. Do not mutate fixture records.

## Leakage Guards

- Exclude the target game itself.
- Exclude any fixture whose safe completion timestamp is not strictly before target scheduledStartTime.
- Exclude future games.
- Exclude records outside lookbackWindowDays.
- Sort eligible evidence newest-first by completedAt, then officialDate/scheduled time, then sourceGameId.
- Truncate to lookbackWindowGames per team.
- Warnings are deterministic, stable, and do not include absolute paths.

## Data-quality Rules

- complete if team has lookbackWindowGames evidence items
- partial if at least one but fewer than lookbackWindowGames
- insufficient if zero
- confidence: high for complete, medium for partial, low for insufficient
- volatility: not-evaluated in Phase 5D

## Testing Summary

Tests added in tests/prospective/mlb-team-recent-form-research.test.ts:
- Provider returns deterministic insufficient evidence when fixtures lack safe completion.
- Provider excludes target game.
- Provider excludes future games.
- Provider truncates to lookbackWindowGames and sorts newest-first.
- Provider respects 30-day window.
- Provider never emits forbidden fields (modelProbability, finalScore, completedGameState, actualStartingPitchers, outcome, outcomeStatus, finalStatus, closingOdds, impliedProbability, odds, market, price).
- Provider exposes safe-evidence-only fields on evidence items.
- Default valid stdout remains byte-for-byte equal to Phase 5B valid golden.
- Default invalid stdout remains byte-for-byte equal to Phase 5B invalid goldens.
- `--fixture-evidence-local` is accepted and emits deterministic output across repeated runs.
- `--fixture-evidence-local` stdout is exact equal to the committed evidence-enabled golden.
- `--fixture-evidence-local` keeps same package identity and construction artifact embedding.
- `--fixture-evidence-local` never outputs forbidden fields or absolute paths.
- `--fixture-evidence-local` still rejects unknown arguments and multiple paths.

## Validation

Validation results after Phase 5E implementation:
- npm run inventory:mlb-fixtures -> PASS (29 games, 2024-06-01 to 2024-07-21)
- npm run prospective:mlb:dry-run-check -> PASS
- npm run prospective:mlb:research-team-form -- valid fixture -> PASS (default mode unchanged)
- npm run prospective:mlb:research-team-form -- valid fixture --fixture-evidence-local -> PASS (evidenced golden exact)
- npx vitest run tests/prospective/mlb-team-recent-form-research.test.ts -> 62 tests passed
- npx vitest run tests/prospective/mlb-weekly-prospective-research-construction.test.ts -> 58 tests passed
- npx vitest run tests/prospective --reporter=verbose -> 199 tests passed
- npx vitest run tests/backtesting --reporter=verbose -> 699 tests passed
- npx vitest run --reporter=verbose -> 958 tests passed
- npx tsc --noEmit --incremental false --pretty false -> exit 0
- npm test -> 958 tests passed
- npm run build -> exit 0
- git diff --check -> exit 0

## Recommended Next Safe Phase

Phase 5F — plan aggregate-only team recent form summaries

State:
- planning-only
- no implementation
- aggregate-only
- no raw finalScore/outcome output
- no modelProbability
- no pitcher evidence
- no actual starters
- no file output
- no live/API/web
- no network schedule ingestion
- no historical fixture data changes