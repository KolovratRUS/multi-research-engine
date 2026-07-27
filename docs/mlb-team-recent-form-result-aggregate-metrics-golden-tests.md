# MLB Team Recent Form — Result Aggregate Metrics Golden Tests

## Status

Phase 5K added exact stdout golden regression coverage for the explicit Phase 5J
result-aggregate-metrics mode.

## Golden File

- Path: `tests/prospective/fixtures/manual-schedule/valid-mlb-team-recent-form-research-result-aggregate-metrics-local-cli-output-v1.json`

## Command

```bash
node --require tsx/cjs scripts/mlb-team-recent-form-research.ts \
  tests/prospective/fixtures/manual-schedule/valid-weekly-prospective-research-construction-file-artifact-v1.json \
  --fixture-evidence-local --aggregate-summaries-local --result-aggregate-metrics-local
```

## What Is Locked

- Exact stdout JSON for the result-metrics mode on the current local manual fixture.
- Top-level flags: `ok: true`, `fixtureEvidenceLocal: true`, `aggregateSummariesLocal: true`, `resultAggregateMetricsLocal: true`.
- `package.gameCount: 2`.
- Each game contains a `TEAM_RECENT_FORM` finding.
- Each `awayAggregateSummary` and `homeAggregateSummary` contains deterministic
  insufficient `resultAggregateMetrics` with zero counts and null averages.
- Byte-for-byte repeated run equality.

## Protected Defaults

- Phase 5B default stdout golden unchanged.
- Phase 5E evidence-enabled stdout golden unchanged.
- Phase 5H aggregate stdout golden unchanged.

## Forbidden Outputs

The result-metrics golden contains no:
- `modelProbability`
- `predictedWinner`
- `pick`
- `finalScore`
- `outcome`
- `completedGameState`
- `finalStatus`
- `actualStartingPitchers`
- pitcher evidence fields
- odds, market, price, or EV-style fields
- absolute paths
- stack traces

## Validation

- `npx tsc --noEmit --incremental false --pretty false` passes.
- `npx vitest run tests/prospective/mlb-team-recent-form-research.test.ts` passes.
- `npm run build` passes.
- `git diff --check` passes.
- Inventory guard: 29 games, June 17, July 12.
- Historical fixtures unchanged.

## Recommended Phase 5L

Plan the next MLB team context module, likely rest/travel/schedule-density:
- planning-only
- no implementation
- no `modelProbability`
- no raw outcomes
- no pitcher evidence
- no file output
- no live/API/web access
- no network schedule ingestion
- no historical fixture changes

## Phase 5L team context planning

Phase 5L is planning-only and adds the next TEAM_ONLY schedule context module design in `docs/mlb-team-context-rest-travel-schedule-density-plan.md`. It does not implement runtime behavior, file output, `modelProbability`, pitcher evidence, actual starters, live/API/web access, network schedule ingestion, or historical fixture changes. Phase 5B/5E/5H/5K goldens and Phase 5J behavior remain unchanged.

## Phase 5M

Phase 5M implemented MLB TEAM_ONLY schedule context behind explicit local-only mode in `docs/mlb-team-schedule-context-implementation.md`. It adds an explicit `--fixture-evidence-local --team-schedule-context-local` mode, preserves default Phase 5B/5E/5H/5K goldens, and keeps `modelProbability` and raw outcome fields absent.

The recommended next safe phase is Phase 5N: add exact stdout golden regression coverage for the schedule context mode.
