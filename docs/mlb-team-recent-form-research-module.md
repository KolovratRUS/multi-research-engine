# MLB Team Recent Form Research Module

## Status

Phase 5A implementation.
Phase 5B exact stdout golden regression coverage complete.
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

## Purpose

Phase 5A implements the first MLB research module as a deterministic contract skeleton. It validates one exact Phase 4X/4Y construction package, preserves that input package without mutation, and adds one completed `TEAM_RECENT_FORM` finding to every constructed game.

This phase establishes the handoff safely. It does not wire historical evidence, compute recent-form analytics, produce a prediction, or claim research quality.

## Command

```bash
npm run prospective:mlb:research-team-form -- <construction-package-json>
```

The command accepts exactly one local JSON path. Flags and additional paths are not supported. Valid output is deterministic pretty JSON on stdout with a trailing newline. The command never writes a research package file.

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
- It reads no pitcher evidence.
- Phase 1G-b observations remain unread and unused for pitcher availability.
- It does not use actual starters.
- It does not output `modelProbability`.
- It does not attach target-game outcomes or post-game fields.
- It does not accept or emit odds, market, or external price fields.
- It performs no live, API, web, or network ingestion.
- It reads no historical fixture module in this phase; the local evidence arrays remain empty.
- It does not change construction or lock behavior.
- It does not write research package files.

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

## Recommended next safe phase

Phase 5C — plan local fixture evidence wiring for the MLB team recent form research module.

State:

- planning-only;
- fixture-only;
- no implementation;
- define the local fixture evidence source and leakage guards;
- no file output;
- no live, API, or web access;
- no network schedule ingestion;
- no `modelProbability`;
- no pitcher evidence;
- no actual starters;
- no generated run artifacts committed; and
- no historical fixture data changes.
