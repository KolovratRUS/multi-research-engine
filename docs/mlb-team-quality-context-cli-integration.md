# MLB Team Quality Context CLI Integration

Status:
- Phase 5S
- CLI integration
- no new stdout golden
- no file output
- local-only
- no live source
- no web/API/network

- Phase 5U synthetic coverage additions documented in docs/mlb-team-quality-context-synthetic-coverage.md

## Purpose

Phase 5S integrates the Phase 5R `TEAM_QUALITY_CONTEXT` builder into the MLB team recent form research CLI.

This phase adds an explicit local-only mode flag:
- `--team-quality-context-local`

Explicit mode requires the existing flag:
- `--fixture-evidence-local`

This preserves all default behavior without any new default output fields.

## Flag and Error Behavior

| Command | Expected result |
|---------|-----------------|
| `<fixture>` | default research package with `teamRecentForm` only |
| `<fixture> --fixture-evidence-local` | evidence-enabled research package |
| `<fixture> --team-quality-context-local` (bare) | exits 1 with clean JSON error `TEAM_QUALITY_CONTEXT_REQUIRES_FIXTURE_EVIDENCE` |
| `<fixture> --fixture-evidence-local --team-quality-context-local` | explicit mode output |

When validation fails in any mode, CLI output:
- omits stack traces
- omits absolute paths
- omits the research `package` object
- includes an `ok: false` summary with `error` and `usage`

## Output Behavior

When explicit mode is enabled:
- `ok: true`
- `fixtureEvidenceLocal: true`
- `teamQualityContextLocal: true`
- `package.version` remains `mlb-team-recent-form-research-package-v1`
- `gameCount` remains the construction package game count
- each game keeps `researchFindings.teamRecentForm`
- each game adds `researchFindings.teamQualityContext` with:
  - `moduleVersion: mlb-team-quality-context-v1`
  - `moduleName: TEAM_QUALITY_CONTEXT`
  - `scope: TEAM_ONLY`
  - `awayTeamQualityContext`
  - `homeTeamQualityContext`

When explicit mode is disabled, `researchFindings.teamQualityContext` is absent and top-level `teamQualityContextLocal` is absent.

## Default Preservation

Phase 5S does not change:
- Phase 5B no-flag stdout golden
- Phase 5E evidence-enabled stdout golden
- Phase 5H aggregate stdout golden
- Phase 5K result-metrics stdout golden
- Phase 5N schedule-context stdout golden
- Phase 5B CLI parsing and exit behavior
- Phase 5E/5H/5K/5N research builder behavior
- Phase 5J result-metrics implementation
- Phase 5M schedule-context implementation

Existing CLI goldens must remain byte-for-byte unchanged in default and explicit prior modes.

## Mode Separation

- `--team-quality-context-local` does not automatically enable `--team-schedule-context-local`
- `--team-schedule-context-local` does not automatically enable `--team-quality-context-local`
- Both may be passed explicitly with `--fixture-evidence-local`; when both are enabled, both modules may appear in each game's `researchFindings`

## Safety Boundaries

- No live source is used.
- No real MLB API request is made.
- No web lookup is used.
- No real standings, roster, injury, or schedule network ingestion is performed.
- TypeScript remains strict: no `@ts-ignore`, `@ts-expect-error`, `NonNullable<>`, or unsafe casts in new code.
- No generated `tmp/`, `export/`, `review/`, or `prospective/` artifacts are committed.
- No historical fixture game data is modified.
- No new dependencies are added.
- `package.json` and `package-lock.json` are unchanged.
- No new stdout golden is added in this phase.
- No existing golden is modified.

Prohibited fields must not appear in team quality context output:
- `modelProbability`
- `predictedWinner`
- `pick`
- `winChance`
- `powerRating`
- `teamRank`
- `standingsPosition`
- `finalScore`
- `outcome`
- `completedGameState`
- `finalStatus`
- `actualStartingPitchers`
- pitcher-specific fields
- `odds`
- `sportsbook`
- `market`
- `price`

## Validation

Recommended checks:
- `npm run inventory:mlb-fixtures` — unchanged 29 games
- `npm run prospective:mlb:research-team-form -- <fixture>` — matches Phase 5B golden
- `npm run prospective:mlb:research-team-form -- <fixture> --fixture-evidence-local --team-quality-context-local` — explicit mode success
- `npm run prospective:mlb:research-team-form -- <fixture> --team-quality-context-local` — rejects with `TEAM_QUALITY_CONTEXT_REQUIRES_FIXTURE_EVIDENCE`
- `npx vitest run tests/prospective/mlb-team-recent-form-research.test.ts --reporter=verbose`
- `npx vitest run tests/prospective/mlb-team-quality-context.test.ts --reporter=verbose`

## Recommended Next Safe Phase

Phase 5T — add exact stdout golden for:
- `--fixture-evidence-local --team-quality-context-local`

Guidelines for Phase 5T:
- add new stdout golden only for explicit team-quality mode
- preserve Phase 5B/5E/5H/5K/5N goldens byte-for-byte
- no `modelProbability`
- no raw outcomes
- no pitcher evidence
- no actual starters
- no live/API/web
- no network standings/roster/schedule ingestion
- no default behavior change

Phase 5V — plan future MLB research report/interface format.

Scope:
- planning-only
- no runtime behavior
- no CLI behavior
- no website/API implementation
- no file output
- no new tests/goldens
- no modelProbability
- no picks/predictions/betting advice
- no raw outcomes
- no pitcher evidence
- no actual starters
- no live/API/web
- no network standings/roster/schedule ingestion
- no historical fixture changes
- preserve Phase 5B/5E/5H/5K/5N/5T goldens
- preserve Phase 5S CLI behavior
- preserve Phase 5R/5U team-quality behavior

Phase 5X adds local-only MLB human-readable report renderer and tests.

Scope:
- local-only
- no runtime behavior
- no CLI behavior
- no website/API implementation
- no file output
- no new stdout golden
- no package/dependency changes
- no modelProbability
- no picks/predictions/betting advice
- no raw outcomes
- no pitcher evidence
- no actual starters
- no live/API/web
- no network standings/roster/schedule ingestion
- no historical fixture changes
- preserve Phase 5B/5E/5H/5K/5N/5T goldens
- preserve Phase 5S CLI behavior
- preserve Phase 5R/5U team-quality behavior
- preserve Phase 5W adapter behavior

## Phase 5Y Status

- Phase 5Y adds optional explicit `--report-preview-local` JSON CLI mode.
- It requires `--fixture-evidence-local`.
- It adds `reportPreviewLocal: true` and `reportPreview` only in explicit mode.
- It adds no default behavior change.
- It adds no file output.
- It adds no website/API implementation.
- It adds no new stdout golden.
- It preserves Phase 5B/5E/5H/5K/5N/5T goldens.
- It preserves Phase 5S team-quality CLI behavior.
- It preserves Phase 5W adapter behavior.
- It preserves Phase 5X renderer behavior.
- It preserves Phase 5R/5U team-quality behavior.
- No modelProbability.
- No picks/predictions/betting advice.
- No raw outcomes.
- No pitcher evidence.
- No actual starters.
- No live/API/web or network standings/roster/schedule ingestion.
- No historical fixture changes.

Docs:
- docs/mlb-research-report-interface-plan.md
- docs/mlb-research-report-adapter-implementation.md

## Phase 5Z Status

Phase 5Z adds exact stdout golden regression coverage for explicit `--fixture-evidence-local --report-preview-local`.
It adds one new golden: `tests/prospective/fixtures/manual-schedule/valid-mlb-report-preview-local-cli-output-v1.json`.
It adds no default behavior change.
It adds no file output.
It adds no website/API implementation.
It preserves Phase 5B/5E/5H/5K/5N/5T goldens.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 5S team-quality CLI behavior.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
It preserves Phase 5R/5U team-quality behavior.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.
Recommended next safe phase is Phase 6A.
