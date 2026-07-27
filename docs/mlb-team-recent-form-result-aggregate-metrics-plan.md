# MLB Team Recent Form Result Aggregate Metrics Plan

## Status

- Phase: 5I
- Scope: planning-only
- Implementation: none
- Runtime behavior: unchanged
- Safe result-derived aggregate metrics plan
- No raw `finalScore`, `outcome`, `completedGameState`, or `finalStatus` output
- No `modelProbability`
- No pitcher evidence
- No actual starters
- No prediction output
- No file output
- No live/API/web
- No network schedule ingestion
- No historical fixture data changes
- Default Phase 5B stdout golden: unchanged
- Phase 5E evidence-enabled stdout golden: unchanged
- Phase 5H aggregate stdout golden: unchanged

## Purpose

Plan how a later Phase 5J can add safe result-derived aggregate metrics to team recent form summaries.

These metrics are descriptive research context only. They are not predictions, picks, calibrated probabilities, or betting signals. Phase 5I does not implement these metrics.

## Inputs

Only local historical fixture data already accepted by the Phase 5D safe evidence provider.

Any result-derived metrics must be computed only from fixtures with:

- safe completion based on `LAST_COMPLETED_PLAY_END`
- `completedAt` strictly before target `scheduledStartTime`
- target-game exclusion
- future-game exclusion

Raw completed result fields must be consumed only inside a controlled local provider boundary and emitted only as aggregates.

## Allowed planned metrics

Plan, but do not implement:

- `winsCount`
- `lossesCount`
- `drawsOrTiesCount` if relevant for a sport, but for MLB normally zero/not-applicable
- `averageRunsFor`
- `averageRunsAgainst`
- `averageRunDifferential`
- `runDifferentialTotal`
- `gamesWithRunsForAvailable`
- `gamesWithRunsAgainstAvailable`
- `resultMetricCompletenessLabel`
- `resultMetricWarnings`

## Forbidden outputs

- raw `finalScore`
- raw `outcome`
- `completedGameState`
- `finalStatus`
- `actualStartingPitchers`
- pitcher fields
- `modelProbability`
- `predictedWinner`
- `pick`
- confidence as match probability
- odds, market, price, or betting-value concepts
- external price fields
- any target-game result information

## Safe result derivation rules

- Do not infer game completion from `finalStatus`/`status`/`outcome` alone.
- Do not infer result from textual status.
- Do not expose the raw per-game score, raw winner, or raw outcome.
- If scores are unavailable or unsafe, omit result metrics and emit coverage/completeness labels only.
- Result metrics must be based only on already-eligible safe evidence games.
- A game can contribute result metrics only if both:
  - safe completion provenance is present; and
  - safe local result fields are present and validated.
- If a game is safely completed but score/result fields are missing, it can count for coverage/completeness but not result metrics.
- Never use target game data to compute target game metrics.

## Proposed output shape for later Phase 5J

Example non-implemented shape nested under aggregate summary:

```json
"resultAggregateMetrics": {
  "status": "string",
  "reason": "string",
  "gamesWithResultMetrics": 0,
  "winsCount": 0,
  "lossesCount": 0,
  "averageRunsFor": null,
  "averageRunsAgainst": null,
  "averageRunDifferential": null,
  "runDifferentialTotal": null,
  "resultMetricCompletenessLabel": "string",
  "resultMetricWarnings": []
}
```

Make clear:

- `resultAggregateMetrics` are optional/deferred
- raw game rows are not emitted
- raw scores are not emitted
- raw outcomes are not emitted
- no `modelProbability` or prediction fields are emitted

## Data-quality, confidence, and volatility

- `dataQuality` remains evidence/data quality only.
- `confidence` remains module evidence confidence, not match probability.
- `volatility` remains not-evaluated unless a separately planned aggregate-only volatility rule exists.
- Result metric completeness should be separate from module confidence.
- No calibrated probability.

## Testing plan for Phase 5J

- preserve Phase 5B default golden
- preserve Phase 5E evidence golden
- preserve Phase 5H aggregate golden unless a new explicit result-metrics mode is added
- new explicit mode/flag if needed, for example:
  `--fixture-evidence-local --aggregate-summaries-local --result-aggregate-metrics-local`
- reject result-metrics flag unless aggregate summaries and fixture evidence are enabled
- exact absence of raw `finalScore`/`outcome`/`completedGameState`/`finalStatus` in output
- exact absence of `modelProbability`/`predictedWinner`/`pick`
- exact absence of pitcher evidence and actual starters
- safe-completion gating
- target/future exclusion
- missing-score behavior
- deterministic aggregate counts and averages
- no generated artifacts

## Implementation sequencing recommendation

- Phase 5J: implement result-derived aggregate metrics behind explicit local-only result-metrics mode
- Phase 5K: exact stdout golden for result-metrics mode
- Phase 5L: planning-only transition toward additional team context modules, such as rest/travel/schedule-density

## Validation

Phase 5K added exact stdout golden coverage for the result-metrics mode in `tests/prospective/fixtures/manual-schedule/valid-mlb-team-recent-form-research-result-aggregate-metrics-local-cli-output-v1.json`. It preserves all protected goldens and adds no runtime behavior.

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

Phase 5J — implement safe result-derived aggregate metrics behind explicit local-only mode.

State:

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

## Phase 5J Completion

Phase 5J was implemented in `docs/mlb-team-recent-form-result-aggregate-metrics-implementation.md`. It adds `--result-aggregate-metrics-local` as an explicit opt-in behind `--fixture-evidence-local --aggregate-summaries-local --result-aggregate-metrics-local`. Default Phase 5B, Phase 5E, and Phase 5H goldens remain byte-for-byte identical.
