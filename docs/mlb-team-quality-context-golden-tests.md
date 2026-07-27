# MLB Team Quality Context Golden Tests

Status:
- Phase 5T
- exact stdout golden
- no new research behavior
- no CLI behavior change
- local-only
- no live source
- no web/API/network

## Purpose

Phase 5T locks exact stdout regression coverage for the explicit Phase 5S team-quality-context CLI mode.

This phase does not add runtime behavior. It only adds a new golden fixture and tests that pin the current deterministic output.

## Golden File

Path:
- `tests/prospective/fixtures/manual-schedule/valid-mlb-team-quality-context-local-cli-output-v1.json`

Exact command:
```
node --require tsx/cjs scripts/mlb-team-recent-form-research.ts \
  tests/prospective/fixtures/manual-schedule/valid-weekly-prospective-research-construction-file-artifact-v1.json \
  --fixture-evidence-local \
  --team-quality-context-local
```

## What Is Locked

- `ok: true`
- `fixtureEvidenceLocal: true`
- `teamQualityContextLocal: true`
- `researchPackageVersion: mlb-team-recent-form-research-package-v1`
- `gameCount: 2`
- every game has `researchFindings.teamRecentForm`
- every game has `researchFindings.teamQualityContext`
- `teamQualityContext.moduleVersion: mlb-team-quality-context-v1`
- `teamQualityContext.moduleName: TEAM_QUALITY_CONTEXT`
- `teamQualityContext.scope: TEAM_ONLY`
- `awayTeamQualityContext` and `homeTeamQualityContext` present
- deterministic insufficient/thin local evidence labels for current manual fixtures
- no `modelProbability`
- no `predictedWinner`
- no `pick`
- no `winChance`
- no `powerRating`
- no `teamRank`
- no `standingsPosition`
- no raw `finalScore`
- no raw `outcome`
- no `completedGameState`
- no `finalStatus`
- no `actualStartingPitchers`
- no pitcher fields
- no `odds`, `sportsbook`, `market`, `price`
- no absolute paths
- no stack traces

## Protected Defaults

Phase 5T does not change:
- Phase 5B no-flag stdout golden
- Phase 5E evidence-enabled stdout golden
- Phase 5H aggregate stdout golden
- Phase 5K result-metrics stdout golden
- Phase 5N schedule-context stdout golden
- Phase 5S team-quality CLI behavior
- Phase 5R builder behavior

Existing CLI goldens must remain byte-for-byte unchanged.

## Validation

Recommended checks:
- `npx vitest run tests/prospective/mlb-team-recent-form-research.test.ts --reporter=verbose`
- `npx vitest run tests/prospective/mlb-team-quality-context.test.ts --reporter=verbose`
- `npm run prospective:mlb:research-team-form -- <fixture> --fixture-evidence-local --team-quality-context-local` matches new golden
- `npm run inventory:mlb-fixtures` — unchanged 29 games

## Recommended Next Safe Phase

Phase 5U adds richer synthetic TEAM_QUALITY_CONTEXT unit/fixture coverage. It adds no new research behavior. It adds no stdout golden. It preserves Phase 5B/5E/5H/5K/5N/5T goldens. It preserves Phase 5S team-quality CLI behavior. It preserves Phase 5R builder behavior. No modelProbability. No raw outcomes. No pitcher evidence. No actual starters. No file output. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5V.

Docs:
- docs/mlb-team-quality-context-synthetic-coverage.md

Guidelines for Phase 5U:
- no default behavior change
- no `modelProbability`
- no raw outcomes
- no pitcher evidence
- no actual starters
- no file output
- no live/API/web
- no network standings/roster/schedule ingestion
- no historical fixture changes
- preserve Phase 5B/5E/5H/5K/5N/5T goldens
