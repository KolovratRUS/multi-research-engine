# MLB Team Recent Form Aggregate Summary Plan

## Status

Phase 5G implemented.
Aggregate-only coverage/completeness summaries.
No implementation needed for this planning file; implementation is in `docs/mlb-team-recent-form-aggregate-summary-implementation.md`.
No new research behavior.
No file output.
No live/API/web.
No network schedule ingestion.
No modelProbability.
No pitcher evidence.
No actual starters.
No prediction output.
No historical fixture data changes.
Default Phase 5B stdout goldens unchanged.
Phase 5E evidence-enabled stdout golden unchanged.

## Purpose

Plan how a later Phase 5G can add aggregate-only team recent form summaries to the existing Phase 5D local fixture evidence provider and research output.

Phase 5F does not implement summaries.
Aggregate summaries are for descriptive research context only, not predictions.

## Inputs

Only safe evidence items already emitted by the Phase 5D provider:
- sourceGameId
- officialDate
- completedAt
- team
- teamRole
- opponent
- sourceProvenance

If later aggregate metrics need completed result facts, they must be derived inside a controlled local provider and emitted only as aggregates.
Raw completed fields must never appear in prospective output.

## Allowed aggregate-only summary concepts

Plan possible fields but do not implement:
- gamesConsidered
- completedGamesConsidered
- recencyWindowDays
- recencyWindowGames
- homeAwaySplitCounts
- opponentDiversityCount
- dataCompletenessLabel
- recencyCoverageLabel
- sourceCompletenessWarnings
- optional later aggregate-only result metrics:
  - winsCount
  - lossesCount
  - averageRunsFor
  - averageRunsAgainst
  - averageRunDifferential

Only if later implementation can compute them safely without outputting raw game result rows or raw scores.

## Forbidden summary outputs

- modelProbability
- predictedWinner
- pick
- confidence as match probability
- raw finalScore
- raw outcome
- completedGameState
- finalStatus
- actualStartingPitchers
- pitcher fields
- external price fields
- odds, market, betting-value concepts

## Safe completion and result gating

Completion remains based only on liveData.plays.allPlays[last].about.endTime with provenance LAST_COMPLETED_PLAY_END.
Any later aggregate result metrics must require safe completion.
Do not infer completion or result from finalStatus, status, or outcome alone.
If safe result derivation is not available, keep result metrics absent and provide only coverage/completeness aggregate labels.

## Proposed output shape for later Phase 5G

Example non-implemented shape:
- awaySummary:
  - status
  - reason
  - gamesConsidered
  - completedGamesConsidered
  - recencyWindowDays
  - recencyWindowGames
  - homeAwaySplitCounts
  - opponentDiversityCount
  - dataCompletenessLabel
  - recencyCoverageLabel
- homeSummary: same
- optional aggregateResults:
  - winsCount
  - lossesCount
  - averageRunsFor
  - averageRunsAgainst
  - averageRunDifferential

Make clear optional aggregateResults are deferred and must be added only after a separate implementation phase validates safe local result extraction.

## Data-quality and confidence

dataQuality remains complete, partial, insufficient, or not-evaluated.
confidence remains module evidence confidence, not match probability.
volatility should remain not-evaluated unless a safe aggregate-only rule is separately planned.
No calibrated probability.

## Testing plan for Phase 5G

- default Phase 5B golden remains byte-exact
- Phase 5E evidence-enabled golden remains byte-exact unless an explicit golden-refresh phase follows
- new aggregate mode or explicit flag if needed
- no raw finalScore, outcome, completedGameState, or finalStatus in output
- no modelProbability
- no pitcher evidence
- no actual starters
- no external price fields
- safe completion gating
- insufficient data behavior
- deterministic ordering and labels
- no generated artifacts

## Implementation sequencing recommendation

1. Phase 5G: implement aggregate-only coverage/completeness summaries first, no result metrics yet.
2. Phase 5H: add exact stdout goldens for aggregate-enabled mode.
3. Phase 5I: separately plan result-derived aggregate metrics only if safe local result extraction is confirmed.

## Validation

To be filled after final Phase 5F validation run.

Expected guard commands:

```bash
npm run inventory:mlb-fixtures
npm run prospective:mlb:dry-run-check
npm run prospective:mlb:research-team-form -- tests/prospective/fixtures/manual-schedule/valid-weekly-prospective-research-construction-file-artifact-v1.json
npm run prospective:mlb:research-team-form -- tests/prospective/fixtures/manual-schedule/valid-weekly-prospective-research-construction-file-artifact-v1.json --fixture-evidence-local
npx vitest run tests/prospective/mlb-team-recent-form-research.test.ts --reporter=verbose
npx vitest run tests/prospective/mlb-weekly-prospective-research-construction.test.ts --reporter=verbose
npx vitest run tests/prospective --reporter=verbose
npx vitest run tests/backtesting --reporter=verbose
npx vitest run --reporter=verbose
npx tsc --noEmit --incremental false --pretty false
npm test
npm run build
git diff --check
```

Leave this section as evidence-only text; do not add placeholder results.

## Recommended next safe phase

Phase 5G — implement aggregate-only coverage/completeness summaries.

State:
- local-only implementation;
- aggregate-only coverage/completeness first;
- no raw finalScore, outcome, completedGameState, or finalStatus output;
- no modelProbability;
- no pitcher evidence;
- no actual starters;
- no file output;
- no live/API/web;
- no network schedule ingestion;
- no historical fixture data changes;
- preserve Phase 5B default goldens;
- preserve Phase 5E evidence-enabled golden unless a new explicit aggregate mode is added.
