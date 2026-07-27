# MLB Team Recent Form Aggregate Summary Implementation

## Status

Phase 5G implemented.
Aggregate-only coverage/completeness summaries.
Explicit aggregate mode: `--fixture-evidence-local --aggregate-summaries-local`.
No result-derived metrics.
No raw `finalScore`, `outcome`, `completedGameState`, or `finalStatus` output.
No `modelProbability`.
No pitcher evidence.
No actual starters.
No file output.
No live/API/web.
No network schedule ingestion.
No historical fixture changes.
Default Phase 5B stdout golden unchanged.
Phase 5E evidence-enabled stdout golden unchanged.

## Explicit Mode

The aggregate mode requires both flags:

```bash
npm run prospective:mlb:research-team-form -- tests/prospective/fixtures/manual-schedule/valid-weekly-prospective-research-construction-file-artifact-v1.json --fixture-evidence-local --aggregate-summaries-local
```

Bare `--aggregate-summaries-local` is rejected with `TEAM_FORM_RESEARCH_AGGREGATE_SUMMARIES_NOT_ENABLED`.

## Aggregate-Only Coverage/Completeness Summaries

When enabled, each finding adds:

- `awayAggregateSummary`
- `homeAggregateSummary`

Per-team summary fields:

- `status`
- `reason`
- `gamesConsidered`
- `completedGamesConsidered`
- `recencyWindowDays`
- `recencyWindowGames`
- `homeAwaySplitCounts`
- `opponentDiversityCount`
- `dataCompletenessLabel`
- `recencyCoverageLabel`
- `sourceCompletenessWarnings`

Current local fixtures lack safe completion evidence, so current output uses `insufficient` status and `insufficient-evidence` reason with zero counts.

## Forbidden Outputs

The implementation never outputs:

- `modelProbability`
- `predictedWinner`
- `pick`
- `finalScore`
- `outcome`
- `completedGameState`
- `finalStatus`
- `actualStartingPitchers`
- `winsCount`
- `lossesCount`
- `averageRunsFor`
- `averageRunsAgainst`
- `averageRunDifferential`
- `odds`, `market`, `price`
- absolute paths
- stack traces

## Safe Completion Gating

Aggregate counts are derived only from safe evidence items already emitted by the Phase 5D provider. Completion remains based only on `liveData.plays.allPlays[last].about.endTime` with provenance `LAST_COMPLETED_PLAY_END`.

## Validation Results From Phase 5G Final Validation

- npm run inventory:mlb-fixtures -> PASS (29 games, 2024-06-01 to 2024-07-21)
- npm run prospective:mlb:dry-run-check -> PASS
- npm run prospective:mlb:research-team-form -- valid fixture -> PASS (default Phase 5B golden exact)
- npm run prospective:mlb:research-team-form -- valid fixture --fixture-evidence-local -> PASS (Phase 5E evidence golden exact)
- npm run prospective:mlb:research-team-form -- valid fixture --fixture-evidence-local --aggregate-summaries-local -> PASS
- npx vitest run tests/prospective/mlb-team-recent-form-research.test.ts -> 74 tests passed
- npx vitest run tests/prospective/mlb-weekly-prospective-research-construction.test.ts -> 58 tests passed
- npx vitest run tests/prospective --reporter=verbose -> 211 tests passed
- npx vitest run tests/backtesting --reporter=verbose -> 699 tests passed
- npx vitest run --reporter=verbose -> 967 tests passed
- npm test -> 967 tests passed
- npx tsc --noEmit --incremental false --pretty false -> exit 0
- npm run build -> exit 0
- git diff --check -> exit 0

## Recommended Next Safe Phase

Phase 5H — exact stdout golden for aggregate-summary mode.

State:
- exact stdout golden only;
- no new research behavior;
- preserve Phase 5B default golden;
- preserve Phase 5E evidence-enabled golden;
- no file output;
- no modelProbability, pitcher evidence, actual starters, live/API/web, or network schedule ingestion;
- no historical fixture changes.
