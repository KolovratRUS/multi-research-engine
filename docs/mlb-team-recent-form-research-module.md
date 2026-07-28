# MLB Team Recent Form Research Module

## Status

Phase 5R adds TEAM_QUALITY_CONTEXT builder skeleton and unit tests. No CLI integration yet. No new stdout golden. No default behavior change. Phase 5B/5E/5H/5K/5N goldens preserved. Phase 5J result-metrics behavior preserved. Phase 5M schedule-context behavior preserved. Phase 5P synthetic coverage preserved. No modelProbability. No raw outcomes. No pitcher evidence. No actual starters. No file output. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Phase 5S integrates explicit --team-quality-context-local CLI mode. It requires --fixture-evidence-local. It adds researchFindings.teamQualityContext only in explicit mode. No default behavior change. No new stdout golden. Phase 5B/5E/5H/5K/5N goldens preserved. Phase 5J result-metrics behavior preserved. Phase 5M schedule-context behavior preserved. Phase 5R builder behavior preserved. No modelProbability. No raw outcomes. No pitcher evidence. No actual starters. No file output. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5T.

Phase 5T adds exact stdout golden regression coverage for --fixture-evidence-local --team-quality-context-local. It adds no new research behavior. It preserves Phase 5B/5E/5H/5K/5N/5T goldens. It preserves Phase 5S team-quality CLI behavior. It preserves Phase 5R builder behavior. No modelProbability. No raw outcomes. No pitcher evidence. No actual starters. No file output. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5U.

Phase 5U adds richer synthetic TEAM_QUALITY_CONTEXT unit/fixture coverage. It adds no new research behavior. It adds no stdout golden. It preserves Phase 5B/5E/5H/5K/5N/5T goldens. It preserves Phase 5S team-quality CLI behavior. It preserves Phase 5R builder behavior. No modelProbability. No raw outcomes. No pitcher evidence. No actual starters. No file output. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5V.

Phase 5V is planning-only. It plans the future MLB research report/interface format. It adds no runtime behavior. It adds no CLI behavior. It adds no website/API implementation. It adds no file output. It adds no new tests/goldens. It preserves Phase 5B/5E/5H/5K/5N/5T goldens. It preserves Phase 5S CLI behavior. It preserves Phase 5R/5U team-quality behavior. No modelProbability. No picks/predictions/betting advice. No raw outcomes. No pitcher evidence. No actual starters. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5W.

Phase 5W adds local-only typed MLB research report-shape adapter skeleton and tests. It adds no runtime behavior. It adds no CLI behavior. It adds no website/API implementation. It adds no file output. It adds no new stdout golden. It preserves Phase 5B/5E/5H/5K/5N/5T goldens. It preserves Phase 5S CLI behavior. It preserves Phase 5R/5U team-quality behavior. No modelProbability. No picks/predictions/betting advice. No raw outcomes. No pitcher evidence. No actual starters. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5X.

Phase 5X adds local-only MLB human-readable report renderer and tests. It adds no CLI behavior. It adds no file output. It adds no website/API implementation. It adds no new stdout golden. It preserves Phase 5B/5E/5H/5K/5N/5T goldens. It preserves Phase 5S CLI behavior. It preserves Phase 5W adapter behavior unless explicitly documented. It preserves Phase 5R/5U team-quality behavior. No modelProbability. No picks/predictions/betting advice. No raw outcomes. No pitcher evidence. No actual starters. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes.
Phase 6A adds a documentation-only MLB website/API integration boundary plan.
It adds no runtime code.
It adds no website/API implementation.
It adds no server/backend/frontend code.
It adds no CLI behavior.
It adds no CLI flag.
It adds no stdout golden.
It preserves Phase 5B default stdout golden.
It preserves Phase 5E evidence-enabled stdout golden.
It preserves Phase 5H aggregate stdout golden.
It preserves Phase 5K result-metrics stdout golden.
It preserves Phase 5N schedule-context stdout golden.
It preserves Phase 5T team-quality stdout golden.
It preserves Phase 5Z report-preview golden.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
It preserves Phase 5S team-quality CLI behavior.
It preserves Phase 5R/5U team-quality behavior.
It preserves Phase 4X construction file-output behavior.
It preserves Phase 4Y construction file-output goldens.
It preserves Phase 4V no-flag construction stdout goldens.
It preserves lock CLI behavior.
It preserves Phase 4P no-flag lock goldens.
It preserves Phase 4S file-output lock goldens.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.
No file output.
No package.json or package-lock.json changes.
Recommended next safe phase is Phase 6B typed local API contract/schema for reportPreview only, or next sport module planning if the user chooses.

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
- docs/mlb-team-quality-context-synthetic-coverage.md
- docs/mlb-research-report-interface-plan.md

Phase 5Q is planning-only. Phase 5Q plans the next safe MLB TEAM_ONLY module: team quality context. No implementation or behavior changed. No new tests/goldens. Phase 5B/5E/5H/5K/5N goldens preserved. Phase 5J result-metrics behavior preserved. Phase 5M schedule-context behavior preserved. Phase 5P synthetic coverage preserved. No modelProbability. No raw outcomes. No pitcher evidence. No actual starters. No file output. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5R.

Phase 5P adds synthetic schedule-context unit/fixture coverage. It adds no new stdout golden. It preserves Phase 5B/5E/5H/5K/5N goldens. It preserves Phase 5J result-metrics behavior. It preserves Phase 5M schedule-context behavior. No modelProbability. No raw outcomes. No pitcher evidence. No actual starters. No file output. No live/API/web or network schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5Q.

Phase 5A implementation.
Phase 5B exact stdout golden regression coverage complete.
Phase 5D local fixture evidence implementation complete.
Local-only.
Stdout-only.
Consumes the exact construction package artifact.
Fixture/local-data only skeleton.
No live source used.
No real MLB API request made.
No web lookup used.
No network schedule ingestion.
No file output yet.
No generated prospective run artifact committed.
No pitcher evidence.
No actual starters.
No `modelProbability`.
No prediction output.
No historical fixture data added or modified.
Default Phase 5B stdout goldens remain unchanged.
Evidence mode is explicit via `--fixture-evidence-local`.
Phase 5F is planning-only aggregate summary planning in `docs/mlb-team-recent-form-aggregate-summary-plan.md`. It does not add implementation, file output, or any live/API/web access.
Phase 5G implemented aggregate-only coverage/completeness summaries in `docs/mlb-team-recent-form-aggregate-summary-implementation.md`. It adds an explicit `--fixture-evidence-local --aggregate-summaries-local` mode and preserves default Phase 5B and Phase 5E evidence-enabled goldens unchanged.

## Purpose

Phase 5A implements the first MLB research module as a deterministic contract skeleton. It validates one exact Phase 4X/4Y construction package, preserves that input package without mutation, and adds one completed `TEAM_RECENT_FORM` finding to every constructed game.

This phase establishes the handoff safely. It does not wire historical evidence, compute recent-form analytics, produce a prediction, or claim research quality.

## Command

```bash
npm run prospective:mlb:research-team-form -- <construction-package-json>
```

The command accepts exactly one local JSON path by default. The optional `--fixture-evidence-local` flag enables fixture-derived team recent-form evidence from local historical fixtures. Valid default output is deterministic pretty JSON on stdout with a trailing newline. The command never writes a research package file.

## Input

The input is the exact construction package artifact with:

```text
constructionVersion = "mlb-weekly-prospective-research-construction-v1"
```

Required top-level construction fields are:

- `constructionVersion`
- `runId`
- `lockId`
- `sourceMode`
- `weekStart`
- `weekEnd`
- `constructedAt`
- `lockedAt`
- `inputSnapshot`
- non-empty `games`
- `constructionWarnings`
- `constructionMessages`

Every game must provide the existing schedule and construction fields, use `researchMode` `"pregame"`, and use `researchScope` `"FULL"` or `"TEAM_ONLY"`.

## Output

The valid stdout summary contains:

- `ok`
- research package identity and source construction identity
- week and deterministic timestamp fields
- game and validation counts
- `validationMessages`
- `package`

The research package contains:

- `researchPackageVersion`
- `constructionVersion`
- `researchRunId`
- `sourceConstructionRunId`
- `sourceConstructionLockId`
- `sourceMode`
- `weekStart`
- `weekEnd`
- `researchedAt`
- `sourceConstructedAt`
- `sourceLockedAt`
- `inputConstructionPackage`
- `games`
- `researchModules`
- `researchWarnings`
- `researchMessages`

`researchRunId` is `team-recent-form:<sourceConstructionRunId>`. `researchedAt` equals the source `constructedAt`; the implementation does not read the current clock. `inputConstructionPackage` is the exact parsed input object.

## Per-game enrichment

Each output game preserves these fields exactly:

- `gameId`
- `officialDate`
- `scheduledStartTime`
- `awayTeam`
- `homeTeam`
- `snapshotTimestamp`
- `sourceProvenance`
- `constructionStatus`
- `researchMode`
- `researchScope`
- `constructionMessages`
- `warnings`

Each output game adds:

- `researchStatus`: `"researched"`
- `completedResearchModules`: `["TEAM_RECENT_FORM"]`
- `researchFindings`
- `researchMessages`: `[]`
- `researchWarnings`: `[]`

The package-level `researchModules` array contains one completed `TEAM_RECENT_FORM` entry at version `"mlb-team-recent-form-v1"` with scope `"TEAM_ONLY"`.

## Team recent form skeleton

`researchFindings.teamRecentForm` contains:

- module version and `TEAM_ONLY` scope
- away and home team names
- zero lookback games and days
- zero recent games found for both teams
- away and home summaries with status `"not-evaluated"` and reason `"fixture-evidence-not-wired"`
- `dataQuality`, `volatility`, and `confidence` set to `"not-evaluated"`
- empty warnings and evidence

`researchStrengthScore`, `confidence`, `matchConfidence`, `dataQuality`, `volatility`, and `modelProbability` remain separate concepts. This skeleton introduces no research-strength or match-confidence field, and `modelProbability` is absent.

## Validation and errors

Core validation messages contain `code`, `level`, `path`, and `message`.

Stable core codes:

- `TEAM_FORM_RESEARCH_INPUT_NOT_OBJECT`
- `TEAM_FORM_RESEARCH_CONSTRUCTION_VERSION_INVALID`
- `TEAM_FORM_RESEARCH_CONSTRUCTION_PACKAGE_INVALID`
- `TEAM_FORM_RESEARCH_FORBIDDEN_FIELD`
- `TEAM_FORM_RESEARCH_ABSOLUTE_PATH`
- `TEAM_FORM_RESEARCH_ENVIRONMENT_METADATA`
- `TEAM_FORM_RESEARCH_EMPTY_GAMES`
- `TEAM_FORM_RESEARCH_MODE_UNSUPPORTED`
- `TEAM_FORM_RESEARCH_SCOPE_UNSUPPORTED`

Stable CLI codes:

- `TEAM_FORM_RESEARCH_PATH_REQUIRED`
- `TEAM_FORM_RESEARCH_SINGLE_PATH_ONLY`
- `TEAM_FORM_RESEARCH_UNKNOWN_ARGUMENT`
- `TEAM_FORM_RESEARCH_READ_OR_PARSE_FAILED`

Invalid input exits 1, emits a deterministic stdout error summary, includes no package, exposes no absolute path, and prints no stack trace.

## Safety boundaries

- The module finding is strictly `TEAM_ONLY`.
- It reads no pitcher evidence unless `--fixture-evidence-local` is explicitly enabled, and even then pitcher evidence remains excluded.
- Phase 1G-b observations remain unread and unused for pitcher availability.
- It does not use actual starters.
- It does not output `modelProbability`.
- It does not attach target-game outcomes or post-game fields.
- It does not accept or emit odds, market, or external price fields.
- It performs no live, API, web, or network ingestion unless `--fixture-evidence-local` is used, and in that mode it loads only local historical fixture records.
- It does not change construction or lock behavior.
- It does not write research package files.
- Default stdout goldens are exact and must remain unchanged when evidence mode is absent.

Historical completion semantics remain unchanged and outside this module:

- completion is based only on `liveData.plays.allPlays[last].about.endTime`;
- completion provenance remains `LAST_COMPLETED_PLAY_END`;
- strict schedule probable handling requires `SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN`;
- historical schedule probable information is not retrospectively promoted; and
- actual starters remain evaluation-only.

## Testing

Phase 5A tests cover:

- deterministic core and CLI output;
- exact top-level and per-game contract fields;
- exact embedded construction input;
- game-order and one-to-one enrichment preservation;
- the completed module and not-evaluated finding skeleton;
- absence of `modelProbability`, target outcomes, actual starters, and external fields;
- malformed JSON and CLI argument errors;
- construction version and package-shape validation;
- recursive forbidden-field, absolute-path, and environment-metadata rejection;
- mode and scope validation;
- the package script; and
- absence of generated output files.

Phase 5B adds exact valid and representative invalid stdout golden fixtures without changing this Phase 5A behavior. See `docs/mlb-team-recent-form-research-golden-tests.md`.

## Validation

- Preflight confirmed `/Users/samkassirov/multi-research-engine`, branch `main`, a clean starting worktree, and `HEAD`, local `main`, and the locally recorded `origin/main` at `6cbd380e00ef327b4e938147dc39b509fc4dbddf`.
- The fixture inventory guard passes with 29 games from 2024-06-01 through 2024-07-21: June 17 and July 12.
- The prospective dry-run guard passes with zero validation errors and warnings.
- The valid manual schedule validator, snapshot, lock, no-flag construction, construction file mode, and team recent form research behaviors pass through the existing local `tsx/cjs` loader. The research output contains two games and zero validation messages.
- The generated Phase 4X construction artifact equals the exact Phase 4Y artifact golden. Protected lock and construction regression coverage passes: 82 tests.
- The new focused Phase 5A suite passes: 37 tests.
- The protected construction suite passes: 58 tests.
- Historical export review behavior passes in all four release modes through the local loader, including threshold checks. The focused rollout review suite passes: 154 tests.
- The prospective suite passes: 174 tests.
- The backtesting suite passes: 699 tests.
- Full Vitest and `npm test` pass: 930 tests across 58 files.
- TypeScript passes.
- Production build passes.
- Git diff check passes.
- Direct npm entry points that invoke the `tsx` launcher for the manual pipeline, new research command, and historical review aliases were blocked by managed-sandbox IPC `EPERM` before script execution. Equivalent script behavior passes through `node --require tsx/cjs`. Inventory and dry-run npm entry points run directly.
- Generated construction output and test temporary files were removed. No generated lock, construction, research, prospective, export, or review artifact remains.
- Safety searches find restricted terminology only in negative safety text, existing project context, validator field-name references, and deliberate invalid-field tests. `modelProbability` appears only as an absence/prohibition statement or deliberate validator test field. No executable `source=live` command was added.
- Protected hashes and Git checks confirm no change to historical fixture data, Phase 4V/4Y construction goldens, Phase 4P/4S lock goldens, Phase 4X behavior, `package-lock.json`, or dependencies.
- No live source, MLB API request, web lookup, or network schedule ingestion was used.

## Phase 5B validation

- Phase 5B adds four static exact stdout fixtures and 8 regression tests without changing this module implementation.
- The focused suite passes 45 tests, including all 37 existing Phase 5A tests.
- Construction passes 58 tests, historical rollout-focused coverage passes 154, prospective passes 182, backtesting passes 699, and full Vitest plus `npm test` pass 938 tests across 58 files.
- TypeScript, production build, and Git diff check pass.
- The valid stdout and three representative invalid stdout cases match their Phase 5B goldens byte-for-byte through the local `tsx/cjs` loader.
- Direct npm entry points using the `tsx` launcher encounter managed-sandbox IPC `EPERM` before script execution; equivalent local-loader behavior passes.
- Generated construction output, invalid-input mutations, and empty `tmp` directories were removed.
- No Phase 5A behavior, historical fixture, protected lock/construction golden, package file, dependency, live/API/web source, or network schedule ingestion changed.
Phase 5G implemented aggregate-only coverage/completeness summaries in `docs/mlb-team-recent-form-aggregate-summary-implementation.md`. It adds an explicit `--fixture-evidence-local --aggregate-summaries-local` mode and preserves default Phase 5B and Phase 5E evidence-enabled goldens unchanged.
Phase 5H adds exact aggregate-summary stdout golden regression coverage in `docs/mlb-team-recent-form-aggregate-summary-golden-tests.md`. It does not add research behavior, file output, `modelProbability`, pitcher evidence, live/API/web access, network schedule ingestion, or historical fixture changes.

## Recommended next safe phase
Phase 5I completed planning for safe result-derived aggregate metrics in `docs/mlb-team-recent-form-result-aggregate-metrics-plan.md`. It does not add implementation, file output, research behavior, `modelProbability`, pitcher evidence, actual starters, live/API/web access, network schedule ingestion, or historical fixture changes.

The recommended next safe phase is Phase 5J: implement safe result-derived aggregate metrics behind explicit local-only mode.

## Phase 5E validation

- Phase 5E locks exact `--fixture-evidence-local` stdout golden in `tests/prospective/fixtures/manual-schedule/valid-mlb-team-recent-form-research-fixture-evidence-local-cli-output-v1.json`.
- Golden contains `fixtureEvidenceLocal: true`, deterministic insufficient evidence for current local fixtures, exact `inputConstructionPackage` embedding, no `modelProbability`, no `finalScore`, no `completedGameState`, no `actualStartingPitchers`, no absolute paths, and no stack traces.
- Phase 5D provider behavior unchanged.
- No new research behavior, file output, dependency, or fixture data change introduced.

## Phase 5D validation

- The pure local fixture evidence provider passes 62 tests in `tests/prospective/mlb-team-recent-form-research.test.ts`.
- The protected construction suite passes 58 tests.
- Full Vitest and `npm test` pass 971 tests across 58 files.
- TypeScript, production build, and Git diff check pass.
- Default valid stdout remains byte-for-byte equal to the Phase 5B valid golden.
- Default invalid stdout remains byte-for-byte equal to the Phase 5B invalid goldens.
- `--fixture-evidence-local` stdout is exact equal to the committed evidence-enabled golden: `tests/prospective/fixtures/manual-schedule/valid-mlb-team-recent-form-research-fixture-evidence-local-cli-output-v1.json`.
- `--fixture-evidence-local` emits deterministic output across repeated runs.
- `--fixture-evidence-local` keeps same package identity and construction artifact embedding.
- The CLI still rejects unknown arguments and multiple input paths alongside `--fixture-evidence-local`.
- npm run inventory:mlb-fixtures -> PASS (29 games, 2024-06-01 to 2024-07-21)
- npm run prospective:mlb:dry-run-check -> PASS
- npx vitest run tests/prospective/mlb-weekly-prospective-research-construction.test.ts -> 58 passed
- npx vitest run tests/prospective --reporter=verbose -> 215 passed
- npx vitest run tests/backtesting --reporter=verbose -> 699 passed
- npx vitest run --reporter=verbose -> 971 passed
- npx tsc --noEmit --incremental false --pretty false -> exit 0
- npm test -> 971 passed
- npm run build -> exit 0
- git diff --check -> exit 0
- No generated tmp/export/review/prospective artifact remains.
- No historical fixture data changed.
- No dependency, package-lock, or package change was made.
- No live/API/web/network schedule ingestion occurred.

## Phase 5H validation

- Phase 5H locks exact `--fixture-evidence-local --aggregate-summaries-local` stdout golden in `tests/prospective/fixtures/manual-schedule/valid-mlb-team-recent-form-research-aggregate-summaries-local-cli-output-v1.json`.
- Golden contains `fixtureEvidenceLocal: true`, `aggregateSummariesLocal: true`, exact `inputConstructionPackage` embedding, deterministic insufficient/zero-count `awayAggregateSummary`/`homeAggregateSummary` objects, no `modelProbability`, no result-derived fields, no absolute paths, and no stack traces.
- Phase 5G aggregate implementation behavior unchanged.
- Default Phase 5B stdout golden unchanged.
- Phase 5E evidence-enabled stdout golden unchanged.
- research tests: 78 passed (4 new aggregate golden tests).
- Full Vitest and `npm test`: 971 passed.
- TypeScript, production build, and Git diff check pass.
- No generated tmp/export/review/prospective artifact remains.
- No historical fixture data changed.
- No dependency, package-lock, or package change was made.
- No live/API/web/network schedule ingestion occurred.

Phase 5C is planning-only and is documented in `docs/mlb-team-recent-form-local-fixture-evidence-plan.md`. It defines a future pure provider, deterministic three-game/30-day lookback, safe completion based only on the last completed play end with `LAST_COMPLETED_PLAY_END` provenance, per-target leakage guards, safe evidence identifiers, and non-probability data-quality labels. The construction artifact remains the target schedule/game input; historical fixtures are optional local evidence only.

Phase 5C changes no Phase 5A behavior or Phase 5B golden, adds no file output, and introduces no pitcher evidence, actual starters, `modelProbability`, prediction output, live/API/web access, network schedule ingestion, or historical fixture data change.

## Phase 5C validation

- The fixture inventory remains 29 games: June 17 and July 12 across 27 unique dates.
- The valid local manual pipeline and research output remain exact through the local `tsx/cjs` loader, and the generated construction artifact remains byte-identical to the Phase 4Y golden.
- The focused Phase 5A/5B suite passes 45 tests; construction passes 58; historical rollout-focused coverage passes 154; prospective passes 182; and backtesting passes 699.
- Full Vitest and `npm test` pass 938 tests across 58 files. TypeScript, production build, and Git diff check pass.
- Direct npm aliases using the `tsx` launcher encounter managed-sandbox IPC `EPERM` before script execution; equivalent local-loader behavior passes.
- Generated construction output, invalid-input mutations, and empty `tmp` directories were removed. No Phase 5A source, Phase 5B golden, earlier construction/lock behavior or golden, historical fixture, package file, or dependency changed.
- Safety searches confirm Phase 5C additions use restricted terminology only for negative exclusions, keep `modelProbability` absent, and add no executable `source=live` command.

## Phase 5D local fixture evidence implementation

Phase 5D implemented the planned local fixture evidence provider in `src/prospective/mlb/team-recent-form-fixture-evidence.ts` and wired it behind an explicit `--fixture-evidence-local` CLI flag in `scripts/mlb-team-recent-form-research.ts`. The Phase 5A research module accepts optional `fixtureEvidenceByGameId` input and preserves its default no-flag behavior, keeping Phase 5B stdout goldens unchanged.

## Phase 5D validation

- The pure local fixture evidence provider passes 62 tests in `tests/prospective/mlb-team-recent-form-research.test.ts`.
- The protected construction suite passes 58 tests.
- Full Vitest and `npm test` pass 958 tests across 72 files.
- TypeScript, production build, and Git diff check pass.
- Default valid stdout remains byte-for-byte equal to the Phase 5B valid golden.
- Default invalid stdout remains byte-for-byte equal to the Phase 5B invalid goldens.
- `--fixture-evidence-local` stdout is exact equal to the committed evidence-enabled golden: `tests/prospective/fixtures/manual-schedule/valid-mlb-team-recent-form-research-fixture-evidence-local-cli-output-v1.json`.
- `--fixture-evidence-local` emits deterministic output across repeated runs.
- `--fixture-evidence-local` keeps same package identity and construction artifact embedding.
- The CLI still rejects unknown arguments and multiple input paths alongside `--fixture-evidence-local`.
- npm run inventory:mlb-fixtures -> PASS (29 games, 2024-06-01 to 2024-07-21)
- npm run prospective:mlb:dry-run-check -> PASS
- npm run prospective:mlb:research-team-form -- valid fixture -> PASS (default mode unchanged)
- npx vitest run tests/prospective/mlb-weekly-prospective-research-construction.test.ts -> 58 passed
- npx vitest run tests/prospective --reporter=verbose -> 199 passed
- npx vitest run tests/backtesting --reporter=verbose -> 699 passed
- npx vitest run --reporter=verbose -> 958 passed
- npx tsc --noEmit --incremental false --pretty false -> exit 0
- npm test -> 958 passed
- npm run build -> exit 0
- git diff --check -> exit 0
- No generated tmp/export/review/prospective artifact remains.
- No historical fixture data changed.
- No dependency, package-lock, or package change was made.
- No live/API/web/network schedule ingestion occurred.

## Phase 5E validation

- Phase 5E locks exact `--fixture-evidence-local` stdout golden in `tests/prospective/fixtures/manual-schedule/valid-mlb-team-recent-form-research-fixture-evidence-local-cli-output-v1.json`.
- Golden contains `fixtureEvidenceLocal: true`, deterministic insufficient evidence for current local fixtures, exact `inputConstructionPackage` embedding, no `modelProbability`, no `finalScore`, no `completedGameState`, no `actualStartingPitchers`, no absolute paths, and no stack traces.
- Phase 5D provider behavior unchanged.
- No new research behavior, file output, dependency, or fixture data change introduced.

## Phase 5C validation

- The fixture inventory remains 29 games: June 17 and July 12 across 27 unique dates.
- The valid local manual pipeline and research output remain exact through the local `tsx/cjs` loader, and the generated construction artifact remains byte-identical to the Phase 4Y golden.
- The focused Phase 5A/5B suite passes 45 tests; construction passes 58; historical rollout-focused coverage passes 154; prospective passes 182; and backtesting passes 699.
- Full Vitest and `npm test` pass 938 tests across 58 files. TypeScript, production build, and Git diff check pass.
- Direct npm aliases using the `tsx` launcher encounter managed-sandbox IPC `EPERM` before script execution; equivalent local-loader behavior passes, including all four historical review modes and threshold checks.
- Generated output and empty `tmp` directories were removed. No Phase 5A source, Phase 5B golden, earlier construction/lock behavior or golden, historical fixture, package file, or dependency changed.
- Safety searches confirm Phase 5C additions use restricted terminology only for negative exclusions, keep `modelProbability` absent, and add no executable `source=live` command. No live/API/web request or network schedule ingestion occurred.

## Phase 5J Result Aggregate Metrics

Phase 5J adds an explicit `--result-aggregate-metrics-local` flag that requires `--fixture-evidence-local --aggregate-summaries-local`. It computes safe result-derived metrics (winsCount, lossesCount, averageRunsFor, etc.) only from `buildSafeResultItemsFromManualRecords` with `LAST_COMPLETED_PLAY_END` provenance, excludes raw outcome fields, and keeps `modelProbability` absent. Default Phase 5B/5E/5H behavior is unchanged.

## Phase 5K Result Aggregate Metrics Golden

Phase 5K added exact stdout golden regression coverage in `docs/mlb-team-recent-form-result-aggregate-metrics-golden-tests.md`. It locks the result-metrics mode output on the current local manual fixture, preserves Phase 5B/5E/5H goldens, and adds no live/API/web access, network schedule ingestion, or historical fixture changes.

## Phase 5L Team Context Planning

Phase 5L is planning-only and adds the next TEAM_ONLY schedule context module design in `docs/mlb-team-context-rest-travel-schedule-density-plan.md`. It does not implement runtime behavior, file output, `modelProbability`, pitcher evidence, actual starters, live/API/web access, network schedule ingestion, or historical fixture changes. Phase 5B/5E/5H/5K goldens and Phase 5J behavior remain unchanged.

## Phase 5M

Phase 5M implemented MLB TEAM_ONLY schedule context behind explicit local-only mode in `docs/mlb-team-schedule-context-implementation.md`. It adds an explicit `--fixture-evidence-local --team-schedule-context-local` mode, preserves default Phase 5B/5E/5H/5K goldens, and keeps `modelProbability` and raw outcome fields absent.

The recommended next safe phase is Phase 5N: add exact stdout golden regression coverage for the schedule context mode.

Phase 5O is planning-only for richer synthetic local schedule-density fixture coverage. It adds `docs/mlb-team-schedule-context-synthetic-fixtures-plan.md`, does not modify runtime behavior, tests, goldens, or fixtures, and preserves Phase 5B/5E/5H/5K/5N goldens with no modelProbability, no raw outcomes, no pitcher evidence, no file output, and no live/API/web.
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

Phase 6A adds a documentation-only MLB website/API integration boundary plan.
It adds no runtime code.
It adds no website/API implementation.
It adds no server/backend/frontend code.
It adds no CLI behavior.
It adds no CLI flag.
It adds no stdout golden.
It preserves Phase 5B default stdout golden.
It preserves Phase 5E evidence-enabled stdout golden.
It preserves Phase 5H aggregate stdout golden.
It preserves Phase 5K result-metrics stdout golden.
It preserves Phase 5N schedule-context stdout golden.
It preserves Phase 5T team-quality stdout golden.
It preserves Phase 5Z report-preview golden.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
It preserves Phase 5S team-quality CLI behavior.
It preserves Phase 5R/5U team-quality behavior.
It preserves Phase 4X construction file-output behavior.
It preserves Phase 4Y construction file-output goldens.
It preserves Phase 4V no-flag construction stdout goldens.
It preserves lock CLI behavior.
It preserves Phase 4P no-flag lock goldens.
It preserves Phase 4S file-output lock goldens.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.
No file output.
No package.json or package-lock.json changes.
Recommended next safe phase is Phase 6B typed local API contract/schema for reportPreview only, or next sport module planning if the user chooses.

Phase 6B adds a typed local API contract/schema for MLB reportPreview only.
It adds no server/backend/frontend code.
It adds no website/API implementation.
It adds no network behavior.
It adds no CLI behavior.
It adds no file output.
It adds no new stdout golden.
It preserves Phase 5B/5E/5H/5K/5N/5T/5Z goldens.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
It preserves Phase 5S team-quality CLI behavior.
It preserves Phase 5R/5U team-quality behavior.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.
Recommended next safe phase is Phase 6C local in-process API adapter/handler using existing reportPreview contract, or next sport module planning if the user chooses.
