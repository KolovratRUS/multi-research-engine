# MLB Team Recent Form Aggregate Summary Implementation

## Status

- Phase: 5G
- Aggregate-only coverage/completeness summaries implemented.
- Explicit aggregate mode: `--fixture-evidence-local --aggregate-summaries-local`.
- No result-derived metrics yet.
- No raw `finalScore`, `outcome`, `completedGameState`, or `finalStatus` output.
- No `modelProbability`.
- No pitcher evidence.
- No actual starters.
- No file output.
- No live/API/web.
- No network schedule ingestion.
- No historical fixture changes.
- Default Phase 5B stdout golden unchanged.
- Phase 5E evidence-enabled stdout golden unchanged.

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

## Safe Completion Gating

Aggregate counts are derived only from safe evidence items already emitted by the Phase 5D provider. Completion remains based only on `liveData.plays.allPlays[last].about.endTime` with provenance `LAST_COMPLETED_PLAY_END`.

## Forbidden Outputs

Aggregate mode must not expose:

- raw `finalScore`
- raw `outcome`
- `completedGameState`
- `finalStatus`
- `actualStartingPitchers`
- pitcher evidence
- `modelProbability`
- `predictedWinner`
- `pick`
- odds, market, price, or betting-value concepts
- external price fields
- absolute paths
- stack traces

## Validation

Phase 5H validation confirms exact aggregate stdout golden and preserves existing Phase 5B/5E goldens.

- inventory: 29 total games (June 17, July 12)
- default stdout golden byte-for-byte match
- evidence-enabled stdout golden byte-for-byte match
- aggregate stdout golden byte-for-byte match across repeated local loader runs
- focused research suite: 78 passed
- full Vitest: 971 passed
- TypeScript: passed
- build: passed
- git diff --check: passed

## Recommended next safe phase

Phase 5I completed planning for safe result-derived aggregate metrics in `docs/mlb-team-recent-form-result-aggregate-metrics-plan.md`. It does not add implementation, file output, research behavior, `modelProbability`, pitcher evidence, actual starters, live/API/web access, network schedule ingestion, or historical fixture changes.

The recommended next safe phase is Phase 5J: implement safe result-derived aggregate metrics behind explicit local-only mode.

- local-only implementation
- explicit result-metrics mode
- no raw finalScore/outcome/completedGameState/finalStatus output
- no modelProbability
- no pitcher evidence
- no actual starters
- no file output
- no live/API/web
- no network schedule ingestion
- no historical fixture data changes
- preserve Phase 5B default goldens
- preserve Phase 5E evidence-enabled golden
- preserve aggregate stdout golden added in Phase 5H unless a new explicit result-metrics mode is added
