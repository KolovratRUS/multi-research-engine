# MLB Team Quality Context Plan

Phase 5Q — planning-only for the next MLB TEAM_ONLY research module.
No implementation. No runtime behavior. No new tests/goldens. No fixture changes.
No file output. No live/API/web. No network ingestion. No historical fixture changes.
No package changes.

## Status

Phase 5R adds TEAM_QUALITY_CONTEXT builder skeleton and unit tests. No CLI integration yet. No new stdout golden. No default behavior change. Phase 5B/5E/5H/5K/5N goldens preserved. Phase 5J result-metrics behavior preserved. Phase 5M schedule-context behavior preserved. Phase 5P synthetic coverage preserved. No modelProbability. No raw outcomes. No pitcher evidence. No actual starters. No file output. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5S.

Phase 5S integrates explicit --team-quality-context-local CLI mode. It requires --fixture-evidence-local. It adds researchFindings.teamQualityContext only in explicit mode. No default behavior change. No new stdout golden. Phase 5B/5E/5H/5K/5N goldens preserved. Phase 5J result-metrics behavior preserved. Phase 5M schedule-context behavior preserved. Phase 5R builder behavior preserved. No modelProbability. No raw outcomes. No pitcher evidence. No actual starters. No file output. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes.
Phase 5T adds exact stdout golden regression coverage for --fixture-evidence-local --team-quality-context-local. It adds no new research behavior. It preserves Phase 5B/5E/5H/5K/5N goldens. It preserves Phase 5S team-quality CLI behavior. It preserves Phase 5R builder behavior. No modelProbability. No raw outcomes. No pitcher evidence. No actual starters. No file output. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5U. Recommended next safe phase is Phase 5T.

- Phase: 5Q
- planning-only
- no implementation
- no runtime behavior
- no new tests/goldens
- no fixture data changes
- no file output
- no live/API/web
- no network standings/roster/schedule ingestion
- no historical fixture changes
- no package changes
- preserves Phase 5B/5E/5H/5K/5N goldens
- preserves Phase 5J result-metrics behavior
- preserves Phase 5M schedule-context behavior
- preserves Phase 5P synthetic coverage
- no modelProbability
- no pitcher evidence
- no actual starters
- no raw outcome/result fields exposed in prospective output
- TEAM_ONLY scope remains odds-blind and descriptive only

## Purpose

Plan a future TEAM_ONLY team quality context module that describes:
- team-level historical sample quality
- opponent-context availability
- strength-of-schedule style descriptors from local evidence only
- stability/volatility descriptors
- data-quality warnings
- confidence/data-quality metadata

This module is explicitly not a prediction module.
This module is explicitly not a modelProbability module.
This module is explicitly not a betting/value module.
This module is explicitly not a pitcher module.
This module does not use actual starters.
This module does not ingest current standings from web/API.

The module should help describe the quality and stability of each team context
using only safe local evidence already available through existing local/synthetic
fixture paths. It must remain descriptive and odds-blind.

## Candidate Future Module Name

- Module name: TEAM_QUALITY_CONTEXT
- Module version: mlb-team-quality-context-v1
- Scope: TEAM_ONLY
- Suggested explicit future CLI flag: --team-quality-context-local
- Suggested future output location: researchFindings.teamQualityContext

## Safe Local Input Sources

Possible local-only sources for future implementation:
- existing manual construction package teams/games
- local historical fixture evidence already allowed by fixture-evidence-local
- derived aggregate summaries from prior completed-game evidence when explicitly enabled
- synthetic fixtures for deterministic unit tests
- local fixture inventory metadata

Prohibited sources:
- no network/API/web data
- no sportsbook/odds/market data
- no pitcher/actual starter evidence
- no current standings, rosters, injuries, or schedules from web/API

## Proposed Output Shape

Future object shape, descriptive fields only:

Top level:
- moduleVersion
- moduleName
- scope
- awayTeamQualityContext
- homeTeamQualityContext

Each team context may include:
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
- scheduleAdjustedContextLabel only if safely supported by local evidence
- qualityContextWarnings
- dataQuality
- confidence
- researchStrengthScore

Avoided fields:
- modelProbability
- predictedWinner
- pick
- winChance
- powerRating if it implies calibrated predictive rating
- teamRank if sourced from current standings
- standingsPosition
- finalScore
- outcome
- completedGameState
- finalStatus
- actualStartingPitchers
- pitcher fields
- odds/market/price fields

## Strict Separation from Existing Concepts

- researchStrengthScore is a module confidence/completeness measure, not win probability.
- confidence is about data reliability, not result likelihood.
- dataQuality is source completeness/validity, not team ability by itself.
- volatility is descriptive instability, not betting edge.
- modelProbability remains absent until a future calibrated model phase.

## Deterministic Labels

Planned safe labels:
- historicalSampleSizeLabel: none / thin / moderate / broad
- opponentSampleSizeLabel: none / thin / moderate / broad
- qualityContextCompletenessLabel: insufficient / partial / complete
- volatilityContextLabel: unavailable / low / moderate / high
- scheduleAdjustedContextLabel: unavailable / limited / supported
- dataQuality: insufficient / partial / usable
- confidence: low / medium / high

## Warnings

Planned deterministic warning codes:
- TEAM_QUALITY_CONTEXT_NO_LOCAL_EVIDENCE
- TEAM_QUALITY_CONTEXT_INSUFFICIENT_OPPONENT_EVIDENCE
- TEAM_QUALITY_CONTEXT_RECENT_SAMPLE_THIN
- TEAM_QUALITY_CONTEXT_SCHEDULE_CONTEXT_UNAVAILABLE
- TEAM_QUALITY_CONTEXT_SYNTHETIC_FIXTURE_ONLY
- TEAM_QUALITY_CONTEXT_FORBIDDEN_FIELD_STRIPPED
- TEAM_QUALITY_CONTEXT_INVALID_TIMESTAMP

Warnings must be sorted/deduplicted deterministically.

## Future Tests

Planned future Phase 5R tests:
- no-evidence insufficient output
- thin sample output
- moderate/broad sample labels
- missing opponent evidence warning
- schedule context unavailable warning
- deterministic warning sort/dedupe
- forbidden fields absent
- no modelProbability
- no raw outcomes in prospective output
- no pitcher fields
- no network/API/web dependency
- no historical fixture changes
- old goldens preserved

## Future Implementation Sequence

Recommended sequence:
- Phase 5R: add unit-level team quality context builder skeleton and tests, local-only, no CLI flag yet
- Phase 5S: integrate explicit --team-quality-context-local mode behind local evidence, no default behavior change
- Phase 5T: add exact stdout golden for team quality context mode
- Phase 5U: add synthetic richer team quality fixture coverage
- Phase 5V: plan next TEAM_ONLY module or begin website/reporting format planning

## Safety and Leakage

The future module must not:
- use target-game result information
- expose raw scores/results/outcomes
- infer completion from unsafe status/final fields
- use odds, sportsbooks, market prices, or betting concepts
- use actual starters or pitcher evidence
- ingest current standings, rosters, injuries, or schedules from web/API
- output modelProbability

The module must remain descriptive and odds-blind.

## Recommended Next Safe Phase

Phase 5R — implement TEAM_QUALITY_CONTEXT builder skeleton and unit tests only.

Scope:
- local-only
- no CLI integration yet unless explicitly scoped
- no stdout golden
- no runtime default behavior change
- no modelProbability
- no raw outcomes
- no pitcher evidence
- no actual starters
- no file output
- no live/API/web
- no network standings/roster/schedule ingestion
- no historical fixture changes
- preserve Phase 5B/5E/5H/5K/5N goldens