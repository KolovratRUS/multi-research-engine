# MLB First Research Module Handoff Plan

## Status

Phase 4Z planning-only.
No implementation.
No module source files.
No generated prospective run artifact committed.
No live source used.
No real MLB API request made.
No web lookup used.
No network schedule ingestion.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
`modelProbability` remains null/absent/not available until calibrated and is absent from constructed and researched packages.
No odds, market, or betting language is introduced except as a negative safety exclusion.

## Purpose

Phase 4Z defines the handoff from the constructed weekly prospective research package to the first real MLB research module. It follows:

- Phase 4U stdout construction;
- Phase 4V no-flag construction stdout goldens;
- Phase 4W construction file-output planning;
- Phase 4X construction file output; and
- Phase 4Y file-output goldens.

This phase documents the future input, enrichment output, safety boundary, validation behavior, command shape, and test plan. It does not implement a research module.

## Proposed first module

The proposed first module is the **MLB Team Recent Form Research Module**.

Its scope is:

- team-level only;
- no pitcher evidence;
- no actual starters;
- no odds, market, or betting inputs;
- no `modelProbability`;
- no prediction output; and
- pregame research enrichment only.

This is the recommended first module because it can work from the currently available constructed game stubs, does not require pitcher availability, keeps `TEAM_ONLY` semantics simple, can later be tested with local fixture-derived evidence, and can produce useful research features without claiming a calibrated probability.

## Handoff input

The sole schedule-and-game handoff input is the exact Phase 4X/4Y construction package artifact with:

```text
constructionVersion = "mlb-weekly-prospective-research-construction-v1"
```

Each constructed game supplies:

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

The module must not accept a raw manual schedule or a lock artifact directly. It must not depend on the construction artifact's source filename, an absolute path, file metadata, environment metadata, or machine state.

A future implementation may use an explicitly configured local fixture or local historical-data provider as evidence. That evidence source is not a replacement schedule handoff and must:

- be explicit and local-only;
- use no live, API, web, or network schedule source;
- exclude outcome leakage into target prospective games;
- exclude post-game fields from researched package output; and
- provide only evidence dated before the target game's `scheduledStartTime`.

## Output contract

The module should return a new enriched research package and must not mutate the construction artifact in place.

Proposed top-level fields:

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

Recommended initial values and rules:

- `researchPackageVersion`: `"mlb-team-recent-form-research-package-v1"`
- `researchRunId`: a deterministic, path-independent identity derived from the source construction `runId`
- `researchedAt`: equal to the deterministic source `constructedAt` in test mode
- `researchModules`: one completed `TEAM_RECENT_FORM` entry with module version `"mlb-team-recent-form-v1"` and scope `"TEAM_ONLY"`
- `researchWarnings`: `[]` initially
- `researchMessages`: `[]` initially

`researchedAt` must never read the current clock in test mode.

The recommended first implementation should preserve the exact input construction package in `inputConstructionPackage`. This makes the handoff transparent, proves that construction was not mutated, and supports exact local golden testing. A later planning phase may replace the embedded package with a stable content hash/reference only after defining canonical serialization, reference resolution, and validation rules.

`sourceConstructionRunId`, `sourceConstructionLockId`, `sourceConstructedAt`, and `sourceLockedAt` must copy the corresponding construction metadata exactly. The module must preserve input game order and produce exactly one researched game for each constructed game.

## Per-game output

Preserve these schedule and identity fields exactly:

- `gameId`
- `officialDate`
- `scheduledStartTime`
- `awayTeam`
- `homeTeam`
- `snapshotTimestamp`
- `sourceProvenance`

Preserve these construction fields exactly:

- `constructionStatus`
- `researchMode`
- `researchScope`
- `constructionMessages`
- `warnings`

Add:

- `researchStatus`: `"researched"`
- `completedResearchModules`: `["TEAM_RECENT_FORM"]`
- `researchFindings`
- `researchMessages`: `[]`
- `researchWarnings`: `[]`

`researchStatus` means that this named module completed for the game. It does not claim that every possible MLB research module completed, that a prediction exists, or that `FULL` research is complete. The preserved construction `researchScope` remains distinct from the module finding's `TEAM_ONLY` scope.

The researched game must contain no:

- `finalScore`;
- `completedGameState`;
- `actualStartingPitchers`;
- `outcome`;
- `outcomeStatus`;
- `finalStatus`;
- odds, market, betting, or external price fields; or
- `modelProbability`.

## Team recent form finding

The suggested `researchFindings` key is `teamRecentForm`.

Suggested fields:

- `moduleVersion`
- `scope`: `"TEAM_ONLY"`
- `awayTeam`
- `homeTeam`
- `lookbackWindowGames`
- `lookbackWindowDays`
- `awayRecentGamesFound`
- `homeRecentGamesFound`
- `awaySummary`
- `homeSummary`
- `dataQuality`
- `volatility`
- `confidence`
- `warnings`
- `evidence`

`researchStrengthScore`, `confidence`, `matchConfidence`, `dataQuality`, `volatility`, and `modelProbability` remain conceptually separate. This first finding does not need to introduce `researchStrengthScore` or `matchConfidence`. `confidence` is confidence in the module finding and evidence completeness; it is not match probability and is not `modelProbability`.

Initial evidence must be sourced from local fixtures. It must not contain odds, market, or betting information, actual-starter evidence, or pitcher-availability evidence. Safe evidence should identify local provenance and prior game IDs/dates only as needed to audit the finding.

## TEAM_ONLY boundary

The module finding is strictly `TEAM_ONLY`.

- `TEAM_ONLY` means no pitcher evidence.
- Phase 1G-b observations must remain unread and unused.
- Pitcher availability must not be inferred.
- Actual starters must not be used.
- Probable-pitcher fields must not be used unless a later planning phase explicitly permits schedule probable data while retaining strict warning rules.
- Team research must remain separate from any later pitcher module.

The construction package currently preserves its existing game `researchScope`. The team recent form module adds a `TEAM_ONLY` finding and must not reinterpret a preserved `FULL` construction scope as permission to use pitcher evidence.

## Leakage rules

- The prospective research package must not include completed-game results for target games.
- Historical fixture records may be used only as prior evidence when their dates and completion evidence are before the target game's `scheduledStartTime`.
- Do not copy `finalScore`, `completedGameState`, or `outcome` into prospective game output.
- Historical schedule probable information must not be retrospectively promoted.
- Actual starters remain evaluation-only.
- Historical completion remains based only on `liveData.plays.allPlays[last].about.endTime`.
- Historical completion provenance remains `LAST_COMPLETED_PLAY_END`.
- Strict schedule probable handling continues to require `SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN`.

Evidence selection must be evaluated separately for each target game so that a later game cannot make unavailable evidence appear available for an earlier target game.

## Future command plan

Do not implement these commands in Phase 4Z.

Proposed first command:

```bash
npm run prospective:mlb:research-team-form -- <construction-package-json>
```

A possible later explicit file mode is:

```bash
npm run prospective:mlb:research-team-form -- <construction-package-json> --write-file --output-dir <directory>
```

File-output planning should be a separate later phase. The first implementation should remain stdout-only unless an intervening plan explicitly changes that decision.

Recommended ignored output root for future researched packages:

```text
tmp/prospective/mlb/research-packages/
```

## Validation and errors

The future implementation should reject:

- a missing input path;
- multiple input paths;
- malformed JSON;
- an unsupported `constructionVersion`;
- a missing or invalid construction package;
- a construction package containing validation messages or errors;
- forbidden fields anywhere in the package;
- absolute paths or environment metadata;
- an empty game list;
- a non-`pregame` `researchMode`;
- a `researchScope` other than `FULL` or `TEAM_ONLY`; and
- generated output-directory arguments unless a later explicit file-output mode exists.

Stable future error-code examples:

- `TEAM_FORM_RESEARCH_INPUT_PATH_REQUIRED`
- `TEAM_FORM_RESEARCH_SINGLE_PATH_ONLY`
- `TEAM_FORM_RESEARCH_READ_OR_PARSE_FAILED`
- `TEAM_FORM_RESEARCH_CONSTRUCTION_VERSION_INVALID`
- `TEAM_FORM_RESEARCH_CONSTRUCTION_PACKAGE_INVALID`
- `TEAM_FORM_RESEARCH_FORBIDDEN_FIELD`
- `TEAM_FORM_RESEARCH_ABSOLUTE_PATH`
- `TEAM_FORM_RESEARCH_ENVIRONMENT_METADATA`
- `TEAM_FORM_RESEARCH_EMPTY_GAMES`
- `TEAM_FORM_RESEARCH_SCOPE_UNSUPPORTED`

Validation must finish before research enrichment begins. Invalid input must not produce a research package.

## Testing plan

The future implementation should prove that it:

- validates the construction package input;
- preserves `inputConstructionPackage` exactly;
- preserves game order;
- produces one researched game per constructed game;
- marks `completedResearchModules` with `TEAM_RECENT_FORM`;
- keeps the `TEAM_ONLY` no-pitcher boundary;
- keeps `modelProbability` absent;
- keeps outcome and post-game fields absent;
- rejects forbidden fields;
- rejects absolute paths and environment metadata;
- rejects malformed input;
- rejects an unsupported `constructionVersion`;
- rejects empty games;
- uses deterministic `researchedAt` in test mode;
- adds a stdout golden in a later implementation/golden phase;
- defers file-output planning and goldens;
- performs no live, API, or web access;
- performs no network schedule ingestion; and
- commits no generated artifacts.

## Success criteria

- The construction package remains the sole schedule-and-game handoff input.
- The first research module enriches research and does not predict.
- The `TEAM_ONLY` boundary is explicit.
- `modelProbability` is not introduced.
- No odds, market, or betting input or language is introduced except negative safety exclusions.
- No pitcher-availability logic is introduced.
- A future implementation can be tested locally with fixtures.

## Validation

- Preflight confirmed `/Users/samkassirov/multi-research-engine`, branch `main`, a clean starting worktree, and `HEAD`, local `main`, and the locally recorded `origin/main` at `ed84f9628c93125d999811fc5e7d8d03975c156b`.
- The fixture inventory guard passes with 29 games from 2024-06-01 through 2024-07-21: June 17 and July 12.
- The prospective dry-run guard passes with zero validation errors and warnings.
- Valid manual schedule validation, snapshot creation, no-flag lock, no-flag construction, and explicit construction file mode pass through the existing local `tsx/cjs` loader. Each pipeline stage preserves the expected two-game deterministic fixture data with zero validation messages.
- The generated Phase 4X construction artifact has the same SHA-1 as the exact Phase 4Y artifact golden. The no-flag construction stdout and file-mode summary also match their exact goldens.
- Pre-edit focused lock and construction regression coverage passes: 82 tests. This covers the Phase 4P no-flag lock goldens, Phase 4S file-output lock goldens, Phase 4V construction stdout goldens, and Phase 4Y construction file-output goldens.
- The focused construction suite passes: 58 tests.
- Historical export release behavior passes in all four modes through the local loader, including threshold checks. The focused rollout review suite passes: 154 tests.
- The prospective suite passes: 137 tests.
- The backtesting suite passes: 699 tests.
- Full Vitest and `npm test` pass: 893 tests across 57 files.
- TypeScript passes.
- Production build passes.
- Git diff check passes.
- Direct npm entry points for the manual validator, snapshot, lock, construction, and historical review commands were blocked by managed-sandbox `tsx` launcher IPC `EPERM` before script execution. Equivalent command behavior passed through the repository's existing `node --require tsx/cjs` loader pattern; package scripts remain unchanged. Inventory and dry-run npm entry points ran directly.
- Added-line safety searches find restricted terminology only in negative safety exclusions. Added `modelProbability` mentions state that it is absent, null, not available until calibrated, or not introduced. No executable `source=live` command was added.
- Protected-file checks confirm that Phase 4V/4Y construction goldens, Phase 4P/4S lock goldens, historical fixture data, `package.json`, and `package-lock.json` remain unchanged.
- Generated construction output and empty `tmp` directories were removed. No generated lock, construction, research, prospective, export, review, or temporary artifact remains.
- No live source, MLB API request, web lookup, or network schedule ingestion was used.
- No dependency, implementation file, historical fixture record, construction behavior, lock behavior, or protected golden changed.

## Recommended next safe phase

Phase 5D — implement the local fixture evidence provider for the implemented MLB team recent form research module.

State:

- local-only;
- fixture-only;
- implementation;
- local historical fixtures are optional evidence only;
- the construction artifact remains the target schedule-and-game input;
- preserve Phase 5B default stdout goldens unless evidence mode is explicit;
- no live, API, or web access;
- no network schedule ingestion;
- no file output;
- no `modelProbability`;
- no odds, market, or betting language except negative safety exclusions;
- no pitcher evidence;
- no generated run artifacts committed;
- no actual starters; and
- no historical fixture data changes.

## Phase 5A implementation

Phase 5A implements the local-only, stdout-only MLB team recent form skeleton described by this handoff. The command consumes the exact Phase 4X/4Y construction artifact, preserves it as `inputConstructionPackage`, and adds one deterministic `TEAM_ONLY` not-evaluated `TEAM_RECENT_FORM` finding per game. It enriches research and does not predict. It introduces no file output, `modelProbability`, pitcher evidence, actual starters, live/API/web access, or network schedule ingestion. See `docs/mlb-team-recent-form-research-module.md`.

## Phase 5A validation

- The fixture inventory remains 29 games: June 17 and July 12.
- The new focused research suite passes 37 tests; protected construction passes 58; historical rollout review passes 154; prospective passes 174; and backtesting passes 699.
- Full Vitest and `npm test` pass 930 tests across 58 files.
- TypeScript, production build, and Git diff check pass.
- The local loader verifies the manual pipeline and new research CLI because affected direct npm/`tsx` launchers encounter managed-sandbox IPC `EPERM` before script execution.
- No generated artifact, historical fixture change, protected golden change, package-lock change, dependency addition, live/API/web request, or network schedule ingestion occurred.

## Phase 5B stdout goldens

Phase 5B adds exact valid stdout and representative wrong-construction-version, forbidden-field, and empty-games stdout goldens for the Phase 5A command. Phase 5A behavior remains unchanged. The goldens add no research behavior, file output, `modelProbability`, pitcher evidence, actual starters, live/API/web access, network schedule ingestion, generated research artifact, or historical fixture change. See `docs/mlb-team-recent-form-research-golden-tests.md`.

## Phase 5B validation

- The focused research suite passes 45 tests: 37 preserved Phase 5A tests and 8 Phase 5B exact stdout tests.
- The protected construction suite passes 58 tests, historical rollout-focused coverage passes 154, prospective passes 182, backtesting passes 699, and full Vitest plus `npm test` pass 938 tests across 58 files.
- TypeScript, production build, and Git diff check pass.
- The valid research stdout and three representative invalid stdout cases match the new fixtures byte-for-byte through the local `tsx/cjs` loader.
- Direct npm entry points using the `tsx` launcher encounter managed-sandbox IPC `EPERM` before script execution; equivalent local-loader behavior passes.
- Protected hashes and Git checks confirm no Phase 5A implementation change, historical fixture change, earlier golden change, package-file change, or dependency addition.
- Generated construction output and invalid-input temporary files were removed. No live source, MLB API request, web lookup, or network schedule ingestion was used.

## Phase 5C local fixture evidence plan

Phase 5C is the planning-only continuation in `docs/mlb-team-recent-form-local-fixture-evidence-plan.md`. It defines local historical fixture records from `src/fixtures/backtesting/mlb/fixture-games.ts` as optional evidence, keeps the construction artifact as the sole target schedule/game input, and plans a pure provider with deterministic lookback plus strict target/future exclusion. Safe completion remains based only on the last completed play end with `LAST_COMPLETED_PLAY_END` provenance.

It changes no Phase 5A behavior or Phase 5B golden, adds no file output, and introduces no pitcher evidence, actual starters, `modelProbability`, prediction output, live/API/web access, network schedule ingestion, or historical fixture data change. The recommended implementation phase is Phase 5D.

## Phase 5C validation

- Preflight confirmed the requested repository, clean baseline, `main`, and `HEAD`, local `main`, and the local `origin/main` ref at `6b70c2dcdecf53803aa13dbf92b5646d80e1e94c`.
- Inventory remains 29 games from 2024-06-01 through 2024-07-21: June 17 and July 12. The prospective dry-run passes with zero errors and warnings.
- The local loader verifies the complete manual pipeline and research output against their valid exact goldens. The generated Phase 4X artifact equals the Phase 4Y golden and was removed.
- Research passes 45 tests, construction passes 58, historical rollout-focused coverage passes 154, prospective passes 182, and backtesting passes 699.
- Full Vitest and `npm test` pass 938 tests across 58 files. TypeScript, production build, and Git diff check pass.
- Direct npm aliases that invoke `tsx` are blocked by managed-sandbox IPC `EPERM` before script execution. Equivalent pipeline and four historical release modes pass through `node --require tsx/cjs`, including threshold checks.
- Safety searches and protected-file checks confirm a docs-only change: no Phase 5A behavior, Phase 5B golden, construction/lock behavior or golden, historical fixture, package file, dependency, live/API/web source, or network schedule ingestion changed.
- Generated output and empty `tmp` directories were removed; no generated lock, construction, research, prospective, export, review, or temporary artifact remains.

## Phase 5D local fixture evidence implementation

Phase 5D implemented the planned local fixture evidence provider in `src/prospective/mlb/team-recent-form-fixture-evidence.ts` and wired it behind an explicit `--fixture-evidence-local` CLI flag in `scripts/mlb-team-recent-form-research.ts`. The Phase 5A research module accepts optional `fixtureEvidenceByGameId` input and preserves its default no-flag behavior, keeping Phase 5B stdout goldens unchanged.

## Phase 5D validation

- The pure local fixture evidence provider passes 59 tests in `tests/prospective/mlb-team-recent-form-research.test.ts`.
- The protected construction suite passes 58 tests.
- Full Vitest and `npm test` pass 952 tests across 58 files.
- TypeScript, production build, and Git diff check pass.
- Default valid stdout remains byte-for-byte equal to the Phase 5B valid golden.
- Default invalid stdout remains byte-for-byte equal to the Phase 5B invalid goldens.
- `--fixture-evidence-local` is accepted and emits deterministic output across repeated runs.
- The CLI still rejects unknown arguments and multiple input paths alongside `--fixture-evidence-local`.
- npm run inventory:mlb-fixtures -> PASS (29 games, 2024-06-01 to 2024-07-21)
- npm run prospective:mlb:dry-run-check -> PASS
- npx vitest run tests/prospective/mlb-weekly-prospective-research-construction.test.ts -> 58 passed
- npx vitest run --reporter=verbose -> 952 passed
- npx tsc --noEmit --incremental false --pretty false -> exit 0
- npm test -> 952 passed
- npm run build -> exit 0
- git diff --check -> exit 0
- No generated tmp/export/review/prospective artifact remains.
- No historical fixture data changed.
- No dependency, package-lock, or package change was made.
- No live/API/web/network schedule ingestion occurred.
