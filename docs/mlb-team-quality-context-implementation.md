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
