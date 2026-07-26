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

To be filled after final Phase 5E validation run.

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

Phase 5F — plan aggregate-only team recent form summaries.

State:

- planning-only;
- no implementation;
- aggregate-only;
- no raw finalScore/outcome output;
- no modelProbability;
- no pitcher evidence;
- no actual starters;
- no file output;
- no live/API/web;
- no network schedule ingestion;
- no historical fixture data changes.
