# MLB Team Recent Form — Result Aggregate Metrics Implementation

## Status

Phase 5J added an explicit local-only result-metrics mode behind three cumulative
CLI flags. No default behavior changed.

## Explicit Mode

```bash
npm run prospective:mlb:research-team-form -- <construction-package-json> \
  --fixture-evidence-local \
  --aggregate-summaries-local \
  --result-aggregate-metrics-local
```

## Rejection Behavior

| Request | Response |
|---------|----------|
| `--result-aggregate-metrics-local` alone | `TEAM_FORM_RESEARCH_RESULT_AGGREGATE_METRICS_NOT_ENABLED` |
| `--fixture-evidence-local --result-aggregate-metrics-local` without `--aggregate-summaries-local` | `TEAM_FORM_RESEARCH_RESULT_AGGREGATE_METRICS_REQUIRES_AGGREGATE_SUMMARIES` |

Both cases exit with clean JSON stderr and do not mutate fixtures.

## Result Metrics Shape

```typescript
interface MLBTeamRecentFormResultAggregateMetrics {
  status: 'complete' | 'partial' | 'insufficient' | 'not-evaluated';
  reason: string;
  gamesWithResultMetrics: number;
  winsCount: number;
  lossesCount: number;
  drawsOrTiesCount: number;
  averageRunsFor: number | null;
  averageRunsAgainst: number | null;
  averageRunDifferential: number | null;
  runDifferentialTotal: number;
  gamesWithRunsForAvailable: number;
  gamesWithRunsAgainstAvailable: number;
  resultMetricCompletenessLabel: string;
  resultMetricWarnings: readonly string[];
}
```

## Safe Derivation Rules

- Only items produced by `buildSafeResultItemsFromManualRecords` are eligible.
- Provenance must be `LAST_COMPLETED_PLAY_END`.
- `completedAt` must be strictly before the target game `scheduledStartTime`.
- Target game and future games are excluded from the eligible result set.
- Raw `finalScore`/`outcome`/`completedGameState` is never returned in the
  public output. Only safe derived counts and averages are exposed.

## Forbidden Outputs

Result-metrics mode still excludes:
- `modelProbability`
- `predictedWinner`
- `pick`
- `finalScore`
- `outcome`
- `completedGameState`
- `finalStatus`
- `actualStartingPitchers`
- Any odds/market/EV/betting-style fields
- Absolute paths

## Current Local Fixture Behavior

The committed manual construction fixture (`valid-weekly-prospective-research-construction-file-artifact-v1.json`)
uses fake local teams. When evidence is built from the local historical fixture
inventory, no records match those fake teams. The result is deterministic
`insufficient` / `not-evaluated` metrics with zero counts and null averages.

## Validation

- `npx tsc --noEmit` passes.
- `npx vitest run tests/prospective/mlb-team-recent-form-research.test.ts` passes (94 tests).
- `npm run build` passes.
- `git diff --check` passes.
- Phase 5B default, Phase 5E evidence, and Phase 5H aggregate stdout goldens
  remain byte-for-byte identical.

## Recommended Phase 5K

Add an exact Phase 5K result-metrics stdout golden for
`--fixture-evidence-local --aggregate-summaries-local --result-aggregate-metrics-local`
lock the shape and byte length, and add a synthetic fixture with safe result
scores so unit tests can verify `winsCount`, `lossesCount`,
`averageRunsFor`, and `averageRunDifferential` end-to-end under the explicit flag.

## Phase 5K Exact Stdout Golden

Phase 5K locks the exact result-metrics stdout in `tests/prospective/fixtures/manual-schedule/valid-mlb-team-recent-form-research-result-aggregate-metrics-local-cli-output-v1.json`. The command is:

```bash
node --require tsx/cjs scripts/mlb-team-recent-form-research.ts \
  tests/prospective/fixtures/manual-schedule/valid-weekly-prospective-research-construction-file-artifact-v1.json \
  --fixture-evidence-local --aggregate-summaries-local --result-aggregate-metrics-local
```

The golden captures deterministic insufficient / not-evaluated metrics on the current local manual fixtures and preserves all existing Phase 5B/5E/5H goldens unchanged.
