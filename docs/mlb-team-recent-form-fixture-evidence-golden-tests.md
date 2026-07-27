# MLB Team Recent Form Fixture Evidence Golden Tests

## Status

Phase 5E.
Fixture-only.
Exact stdout golden.
No new research behavior.
Evidence mode explicit via `--fixture-evidence-local`.
Default Phase 5B stdout goldens unchanged.
No file output.
No live/API/web.
No network schedule ingestion.
No modelProbability.
No pitcher evidence.
No actual starters.
No prediction output.
No historical fixture data changes.

## Purpose

Phase 5E locks the exact `--fixture-evidence-local` stdout produced by the Phase 5D evidence-capable local MLB team recent form research CLI. It follows:

- Phase 5D, the explicit local fixture evidence provider and CLI wiring.
- Phase 5B, the default no-flag stdout golden regression surface.
- Phase 5A, the local-only stdout research skeleton.

This phase adds exact golden regression coverage for the evidence-enabled mode without adding research behavior, file output, or dependency changes.

## Golden fixture path

```text
tests/prospective/fixtures/manual-schedule/valid-mlb-team-recent-form-research-fixture-evidence-local-cli-output-v1.json
```

This file is a static exact stdout golden captured from:

```bash
npx tsx scripts/mlb-team-recent-form-research.ts tests/prospective/fixtures/manual-schedule/valid-weekly-prospective-research-construction-file-artifact-v1.json --fixture-evidence-local
```

## What is locked

- Exact evidence-enabled stdout pretty JSON with a trailing newline.
- `fixtureEvidenceLocal: true`.
- `researchPackageVersion: mlb-team-recent-form-research-package-v1`.
- `researchRunId: team-recent-form:manual-schedule-fixture-week-1`.
- `sourceConstructionRunId: manual-schedule-fixture-week-1`.
- `sourceConstructionLockId: manual-week-lock:manual-schedule-fixture-week-1`.
- `sourceMode: manual-schedule`.
- Week boundaries `2024-07-01` through `2024-07-07`.
- `gameCount: 2` with two deterministic local manual-schedule research games.
- Exact embedded `package.inputConstructionPackage` equal to `tests/prospective/fixtures/manual-schedule/valid-weekly-prospective-research-construction-file-artifact-v1.json`.
- Deterministic insufficient evidence behavior from current local historical fixture records:
  - `lookbackWindowGames: 3`
  - `lookbackWindowDays: 30`
  - `awayRecentGamesFound: 0`
  - `homeRecentGamesFound: 0`
  - `awaySummary.status: insufficient`
  - `homeSummary.status: insufficient`
  - `dataQuality: insufficient`
  - `confidence: low`
  - `volatility: not-evaluated`
  - warnings include deterministic current local-fixture expectations
  - `evidence: []`
- Absence of forbidden fields: `modelProbability`, `finalScore`, `completedGameState`, `actualStartingPitchers`, `outcome`, `outcomeStatus`, `finalStatus`, `closingOdds`, `impliedProbability`, `odds`, `market`, `price`.
- No absolute paths in stdout.
- No stack traces in stdout.
- No generated files emitted during normal runs.

## Protected defaults

- Default Phase 5B valid stdout golden remains byte-for-byte unchanged.
- Default Phase 5B invalid stdout goldens remain byte-for-byte unchanged.
- Phase 4 protected goldens remain unchanged.
- Historical fixture data remains unchanged.

## Validation

Leave this section as evidence-only text; do not add placeholder results.

## Phase 5E validation

- Phase 5E locks exact `--fixture-evidence-local` stdout golden in `tests/prospective/fixtures/manual-schedule/valid-mlb-team-recent-form-research-fixture-evidence-local-cli-output-v1.json`.
- Golden contains `fixtureEvidenceLocal: true`, deterministic insufficient evidence for current local fixtures, exact `inputConstructionPackage` embedding, no `modelProbability`, no `finalScore`, no `completedGameState`, no `actualStartingPitchers`, no absolute paths, and no stack traces.
- Phase 5D provider behavior unchanged.
- No new research behavior, file output, dependency, or fixture data change introduced.

## Phase 5F aggregate summary plan

Phase 5F adds planning-only aggregate summary design in `docs/mlb-team-recent-form-aggregate-summary-plan.md`. It does not add implementation, file output, research behavior, or any live/API/web access.

## Phase 5G aggregate summary implementation

Phase 5G implemented aggregate-only coverage/completeness summaries in `docs/mlb-team-recent-form-aggregate-summary-implementation.md`. It adds an explicit `--fixture-evidence-local --aggregate-summaries-local` mode without altering Phase 5D provider behavior, Phase 5B default goldens, or Phase 5E evidence-enabled goldens.

Phase 5H adds exact aggregate-summary stdout golden regression coverage in `docs/mlb-team-recent-form-aggregate-summary-golden-tests.md`. It does not change the Phase 5E evidence-enabled stdout golden, the Phase 5B default golden, the Phase 5D provider behavior, or any research implementation.

## Recommended next safe phase

Phase 5I — plan safe result-derived aggregate metrics.

State:
- planning-only;
- no implementation;
- no raw finalScore/outcome/completedGameState/finalStatus output;
- no modelProbability;
- no pitcher evidence;
- no actual starters;
- no file output;
- no live/API/web;
- no network schedule ingestion;
- no historical fixture data changes;
- preserve Phase 5B default goldens;
- preserve Phase 5E evidence-enabled golden;
- preserve aggregate stdout golden added in Phase 5H.
