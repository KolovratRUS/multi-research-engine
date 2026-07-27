# MLB Weekly Prospective Research Construction Plan

## Status

Phase 4T planning record.
Phase 4U stdout-only implementation complete.
Phase 4V exact construction stdout golden tests complete.
Phase 4W construction file-output planning complete.
Phase 4X construction file-output implementation complete.
Phase 4Y exact construction file-output golden tests complete.
Phase 4Z first real MLB research-module handoff planning complete.
Local locked-artifact validation and deterministic construction implemented.
Explicit double-opt-in construction file-output mode implemented.
No generated prospective run artifact committed.
No live source used.
No real MLB API request made.
No web lookup used.
No network schedule ingestion.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
`modelProbability` remains null/absent/not available until calibrated.

## Purpose

Phase 4T planned how a locked manual week would feed weekly prospective research construction.
It follows:

- Phase 4N, the manual week lock workflow plan;
- Phase 4O, the stdout lock CLI;
- Phase 4P, the no-flag lock goldens;
- Phase 4Q, the lock file-output plan;
- Phase 4R, the lock file-output implementation; and
- Phase 4S, the lock file-output goldens.

Phase 4U implemented that handoff from the existing lock artifact to a deterministic stdout research skeleton. Phase 4U itself added no construction file output, generated no persistent artifacts, and did not change lock behavior. The Phase 4P no-flag goldens and Phase 4S file-output goldens remain unchanged.

Phase 4W planned a double-opt-in file-output mode in `docs/mlb-weekly-prospective-research-construction-file-output-plan.md`. Phase 4X implements it while preserving Phase 4U no-flag behavior. The Phase 4V construction stdout goldens and Phase 4P/4S lock goldens remain unchanged.

Phase 4Y adds static exact file artifact and file-mode stdout summary goldens in `docs/mlb-weekly-prospective-research-construction-file-output-golden-tests.md`. It does not change Phase 4X behavior. Generated `tmp` artifacts remain ignored, uncommitted, and cleaned.

Phase 4Z plans the next handoff in `docs/mlb-first-research-module-handoff-plan.md`. It proposes the MLB team recent form module as a `TEAM_ONLY`, no-pitcher research enrichment that consumes the exact Phase 4X/4Y construction package artifact. Phase 4Z adds no implementation or prediction output and leaves Phase 4X behavior plus the Phase 4V/4Y construction and Phase 4P/4S lock goldens unchanged.

## Input contract

Construction consumes one locked week artifact, not a raw manual schedule file. The artifact is the exact `lockedSnapshot` JSON written by the current explicit lock file mode.

Required top-level input fields:

- `lockVersion`
- `runId`
- `lockId`
- `sourceMode`
- `weekStart`
- `weekEnd`
- `lockedAt`
- `snapshot`
- `validationMessages`
- `warnings`

Input requirements:

- `lockVersion` must equal `"mlb-manual-week-lock-v1"`.
- `sourceMode` must equal `"manual-schedule"` in the first implementation.
- `validationMessages` must be empty before construction begins.
- `warnings` may contain entries. Construction preserves them as `constructionWarnings`.
- `snapshot` must pass `validateProspectiveScheduleSnapshot`.
- `snapshot.games` must be non-empty.
- The lock metadata must be preserved exactly rather than recomputed from the nested snapshot or file path.
- Construction must not depend on the input filename, file metadata, an absolute path, environment state, or a machine-specific value.

The locked artifact must not contain these fields anywhere:

- `finalScore`
- `completedGameState`
- `actualStartingPitchers`
- `outcome`
- `outcomeStatus`
- `finalStatus`
- odds, market, or external price fields
- absolute paths
- environment metadata

Phase 4U recursively rejects these fields before constructing any output. It does not attempt to sanitize an invalid artifact and continue.

## Implemented construction output contract

Phase 4U emits one weekly prospective research package with these fields:

- `constructionVersion`
- `lockVersion`
- `runId`
- `lockId`
- `sourceMode`
- `weekStart`
- `weekEnd`
- `constructedAt`
- `lockedAt`
- `inputSnapshot`
- `games`
- `constructionWarnings`
- `constructionMessages`

Contract rules:

- `inputSnapshot` should preserve the validated nested schedule snapshot without enrichment or mutation.
- `lockVersion`, `runId`, `lockId`, `sourceMode`, `weekStart`, `weekEnd`, and `lockedAt` should be copied exactly from the locked input.
- `constructedAt` is deterministic and equals `lockedAt`.
- Deterministic fixtures must not read the current clock.
- The output must preserve input game order.
- The output must contain exactly one game research stub for each input snapshot game.
- The package must not include final outcomes, completed-game state, actual starters, external price fields, or post-game statistics.
- `modelProbability` remains null/absent/not available until calibrated.

The initial construction package is a structural handoff. It does not evaluate input quality, make a prediction, or claim performance.

## Game construction

For each locked snapshot game, construction creates one prospective game research stub.

Preserve these schedule fields exactly:

- `gameId`
- `officialDate`
- `scheduledStartTime`
- `awayTeam`
- `homeTeam`
- `snapshotTimestamp`
- `sourceProvenance`

Add only construction metadata needed for a deterministic skeleton:

- `constructionStatus`: `"pending-research"`
- `researchMode`: `"pregame"`
- `researchScope`: `"FULL"`
- `constructionMessages`: `[]`
- `warnings`: `[]`

The skeleton must not attach:

- final score or outcome data;
- actual starters;
- closing odds;
- implied probability;
- betting or market metrics; or
- post-game statistics.

The construction step must not read Phase 1G-b pitcher observations for pitcher availability. `TEAM_ONLY` must exclude pitcher evidence. `FULL` and `TEAM_ONLY` must remain distinct construction scopes rather than aliases.

## Implemented scope

Phase 4U only builds deterministic skeleton packages from valid locked artifacts.

It:

- validate the complete locked input before mapping;
- copy locked metadata exactly;
- copy the nested schedule snapshot without mutation;
- create one pending pre-game research stub per locked game;
- preserve input game order;
- expose deterministic messages and warnings; and
- print the package to stdout.

It does not:

- evaluate research quality;
- populate sport-specific evidence;
- make predictions;
- claim model quality or predictive performance;
- attach results; or
- write package files.

Later phases may fill research modules step-by-step while retaining the same local, pre-game-only, leakage-safe boundary.

## Implemented command

```bash
npm run prospective:mlb:construct-week -- <locked-week-artifact-json>
```

The no-flag command accepts exactly one positional local JSON path. It reads and parses that file locally, validates the exact locked artifact, and prints the original deterministic summary with `package` only for valid input.

Phase 4X adds:

```bash
npm run prospective:mlb:construct-week -- <locked-week-artifact-json> --write-file --output-dir <directory>
```

The file flags are required together and may appear before or after the positional input. File mode validates completely before directory creation, writes the exact inner construction package as pretty JSON with a trailing newline, and emits a summary without `package`.

The recommended ignored output root is:

```text
tmp/prospective/mlb/weekly-research-packages/
```

The deterministic filename is:

```text
<weekStart>__<weekEnd>__<runId>__weekly-research-construction-v1.json
```

Overwrite is refused. Output directories beneath `src/`, `scripts/`, `tests/`, `docs/`, `prisma/`, or a repository-root `app/` are refused. The reported `artifactPath` is always relative.

Implementation files:

- `src/prospective/mlb/weekly-research-construction.ts`
- `scripts/mlb-weekly-prospective-research-construct.ts`
- `tests/prospective/mlb-weekly-prospective-research-construction.test.ts`

The stdout summary contains `ok`, available lock metadata, `constructedAt`, `lockedAt`, game and validation counts, stable validation messages, and `package` only when valid.

Stable CLI argument/read codes:

- `WEEKLY_RESEARCH_CONSTRUCTION_PATH_REQUIRED`
- `WEEKLY_RESEARCH_CONSTRUCTION_SINGLE_PATH_ONLY`
- `WEEKLY_RESEARCH_CONSTRUCTION_UNKNOWN_ARGUMENT`
- `WEEKLY_RESEARCH_CONSTRUCTION_READ_OR_PARSE_FAILED`

Phase 4X file-mode codes:

- `WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_DIR_REQUIRED`
- `WEEKLY_RESEARCH_CONSTRUCTION_WRITE_FILE_REQUIRED`
- `WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_DIR_VALUE_REQUIRED`
- `WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_DIR_UNSAFE`
- `WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_PATH_EXISTS`
- `WEEKLY_RESEARCH_CONSTRUCTION_WRITE_FAILED`

Stable locked-artifact validation codes:

- `WEEKLY_RESEARCH_LOCK_VERSION_INVALID`
- `WEEKLY_RESEARCH_SOURCE_MODE_UNSUPPORTED`
- `WEEKLY_RESEARCH_VALIDATION_MESSAGES_PRESENT`
- `WEEKLY_RESEARCH_SNAPSHOT_INVALID`
- `WEEKLY_RESEARCH_SNAPSHOT_EMPTY`
- `WEEKLY_RESEARCH_FORBIDDEN_FIELD`
- `WEEKLY_RESEARCH_ABSOLUTE_PATH`
- `WEEKLY_RESEARCH_ENVIRONMENT_METADATA`
- `WEEKLY_RESEARCH_INPUT_NOT_OBJECT`

## Implemented validation rules

The command rejects or enforces the following:

- reject a missing path;
- reject multiple paths;
- reject malformed JSON;
- reject an unsupported `lockVersion`;
- reject a non-manual `sourceMode` in the first implementation;
- reject non-empty `validationMessages`;
- reject a missing or invalid `snapshot`;
- reject a snapshot with no games;
- recursively reject final, outcome, starter, and external fields anywhere in the locked artifact;
- reject absolute path strings;
- reject environment metadata;
- validate the nested snapshot with `validateProspectiveScheduleSnapshot`;
- ensure one output game for every input snapshot game;
- preserve input game order;
- preserve lock metadata exactly;
- make no network, API, or web calls; and
- provide no live mode.

Validation must complete before any package is constructed. An invalid input should exit 1 and emit no construction package.

## Phase 4U tests

The focused construction suite proves:

- a valid locked artifact fixture produces a deterministic stdout package;
- invalid or malformed locked artifacts exit 1 with no package;
- a wrong `lockVersion` exits 1;
- non-empty `validationMessages` exit 1;
- final or outcome fields exit 1;
- `actualStartingPitchers` exits 1;
- external odds, market, or price fields exit 1;
- absolute path strings exit 1;
- empty games exit 1;
- output game count equals input game count;
- input game order is preserved;
- no current timestamps appear;
- no-flag behavior creates no file output;
- file output requires both explicit file flags;
- a valid file-mode artifact equals the exact no-flag `package`;
- file-mode stdout is summary-only and contains only a relative artifact path;
- overwrite, unsafe output roots, unsafe filename components, invalid inputs, and malformed inputs do not produce a construction artifact;
- no generated artifacts are committed;
- `TEAM_ONLY` construction excludes pitcher evidence when research evidence is introduced; and
- `FULL` and `TEAM_ONLY` remain distinct.

Phase 4V adds byte-for-byte stdout package regression fixtures for a static valid locked artifact and representative invalid locked artifacts. It does not change Phase 4U construction behavior or add file output. See `docs/mlb-weekly-prospective-research-construction-golden-tests.md`.

## Safety boundary

- Construction is local-only.
- Construction consumes locked artifacts only.
- Construction does not fetch schedules.
- Construction does not call MLB APIs.
- Construction does not browse the web.
- Construction does not attach outcomes.
- Construction does not evaluate results.
- Construction does not use actual starters.
- Construction does not use Phase 1G-b observations for pitcher availability.
- `TEAM_ONLY` excludes pitcher evidence.
- `researchStrengthScore`, `confidence`, `matchConfidence`, `dataQuality`, `volatility`, and `modelProbability` remain conceptually separate.
- `modelProbability` remains null/absent/not available until calibrated.
- Historical fixture data is not mutated.
- Generated artifacts are not committed by default.
- No `source=live` execution is permitted.

Historical behavior remains outside this construction step and unchanged:

- historical completion remains based only on `liveData.plays.allPlays[last].about.endTime`;
- historical completion provenance remains `LAST_COMPLETED_PLAY_END`;
- strict schedule probable handling continues to require `SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN`;
- historical schedule probable information must not be retrospectively promoted; and
- actual starters remain evaluation-only.

## Implementation staging

- Phase 4U — implemented stdout-only weekly prospective research construction from a locked manual week.
- Phase 4V — implemented exact construction stdout golden tests.
- Phase 4W — planned file-output mode for constructed weekly research packages without implementation.
- Phase 4X — implemented file-output mode for constructed weekly research packages.
- Phase 4Y — implemented exact construction file-output goldens.
- Phase 4Z — planned the first real sport-specific research module handoff from constructed packages.

## Success criteria

- The locked artifact is the only input to construction.
- One constructed research stub is produced per locked game.
- No outcomes, actual starters, market or price fields, or post-game fields enter construction.
- No network, API, or web access occurs.
- Historical fixture data remains unchanged.
- Stdout output is deterministic in test mode.
- `modelProbability` remains null/absent/not available until calibrated.
- `FULL` and `TEAM_ONLY` remain separated.
- The exact construction package is the sole schedule-and-game handoff input to the planned first research module.
- The planned team recent form module enriches pregame research without predicting and introduces no pitcher evidence or `modelProbability`.

## Validation

- Phase 4Z preflight confirmed `/Users/samkassirov/multi-research-engine`, branch `main`, a clean starting worktree, and `HEAD`, local `main`, and the locally recorded `origin/main` at `ed84f9628c93125d999811fc5e7d8d03975c156b`.
- The fixture inventory guard passes with 29 games from 2024-06-01 through 2024-07-21: June 17 and July 12.
- The prospective dry-run check passes with zero validation errors and warnings.
- The valid manual validator, snapshot, no-flag lock, no-flag construction, and explicit construction file-mode behaviors pass. The constructed package contains two games and zero validation messages.
- The file-mode artifact has the deterministic planned filename, equals the exact no-flag `package`, is pretty JSON with a trailing newline, and has no absolute path. File-mode stdout is summary-only and reports a relative `artifactPath`.
- Pre-edit construction and lock regression validation passes: 82 tests. This covers the exact Phase 4V construction stdout goldens, Phase 4Y construction file-output goldens, Phase 4P no-flag lock goldens, and Phase 4S file-output lock goldens.
- The focused construction suite passes: 58 tests.
- Historical export release behavior passes in all four modes through the local loader, including passing threshold checks. The focused rollout review suite passes: 154 tests.
- The prospective suite passes: 137 tests.
- The backtesting suite passes: 699 tests.
- Full Vitest and `npm test` pass: 893 tests across 57 files.
- TypeScript passes.
- Production build passes.
- Git diff check passes.
- Direct npm entry points for the manual validator, snapshot, lock, construction, and historical review commands were blocked by managed-sandbox `tsx` launcher IPC `EPERM` before script execution. Equivalent behavior passed through the existing local `tsx/cjs` loader pattern; package scripts remain unchanged. Inventory and dry-run npm entry points ran directly.
- Added-line safety searches find restricted terminology only in negative safety exclusions. Added `modelProbability` mentions are absence/prohibition statements, and no executable `source=live` command was added.
- Protected hashes confirm that all Phase 4V construction stdout goldens, Phase 4P no-flag lock goldens, Phase 4S file-output lock goldens, historical fixture data, `package.json`, and `package-lock.json` remain unchanged.
- The Phase 4Y construction file artifact and summary goldens also remain unchanged, and the generated Phase 4X artifact hashes exactly to the Phase 4Y artifact golden.
- Test and manual cleanup succeeded. No generated lock, construction, research, prospective, export, review, cache, or temporary artifact remains.
- No live source, MLB API request, web lookup, or network schedule ingestion was used.
- No dependency, implementation file, historical fixture record, construction package semantic, or lock behavior changed.

## Phase 4W construction file-output plan

Phase 4W defined the explicit file mode, deterministic filename, exact inner-package artifact, summary-only file-mode stdout, validation-before-write ordering, no-overwrite default, safe output-directory rules, stable error codes, and regression plan. Phase 4X implements that contract.

The implementation record is `docs/mlb-weekly-prospective-research-construction-file-output-plan.md`. Phase 4U no-flag behavior remains unchanged, Phase 4V stdout goldens remain byte-identical, and Phase 4P/4S lock behavior and goldens remain unchanged.

## Phase 4Z first research module handoff plan

The Phase 4Z plan is `docs/mlb-first-research-module-handoff-plan.md`. The proposed MLB team recent form module consumes the exact Phase 4X/4Y construction package artifact and returns a new enriched pregame research package without mutating construction or producing a prediction. Its finding scope is `TEAM_ONLY`, so it uses no pitcher evidence or actual starters. It introduces no `modelProbability`, live/API/web access, or network schedule ingestion.

Phase 5F adds planning-only aggregate summary design in `docs/mlb-team-recent-form-aggregate-summary-plan.md`. It does not add implementation, file output, research behavior, or any live/API/web access.

Phase 5G implemented aggregate-only coverage/completeness summaries in `docs/mlb-team-recent-form-aggregate-summary-implementation.md`. It adds an explicit `--fixture-evidence-local --aggregate-summaries-local` mode and preserves default Phase 5B and Phase 5E evidence-enabled goldens unchanged.

## Recommended next safe phase

Phase 5H — exact stdout golden for aggregate-summary mode.

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

## Phase 5F aggregate summary plan

Phase 5F adds planning-only aggregate summary design in `docs/mlb-team-recent-form-aggregate-summary-plan.md`. It does not add implementation, file output, research behavior, or any live/API/web access.

## Phase 5A research handoff validation

- The exact Phase 4Y construction artifact validates as Phase 5A input and produces two deterministic researched games with zero validation messages.
- The generated Phase 4X artifact remains byte-identical to the Phase 4Y artifact golden.
- Protected lock/construction regression coverage passes 82 tests, and the focused construction suite passes 58 tests.
- The new Phase 5A research suite passes 37 tests; prospective passes 174; backtesting passes 699; and full Vitest plus `npm test` pass 930 tests across 58 files.
- TypeScript, production build, and Git diff check pass.
- No construction behavior, construction golden, lock behavior, lock golden, historical fixture, package lock, or dependency changed.
- Generated construction output was removed, and the research command created no file artifact.

## Phase 5C local fixture evidence plan

Phase 5C is planning-only and changes no construction behavior. It plans a pure local fixture evidence provider, deterministic lookback, safe-completion filtering, and per-target leakage guards for the Phase 5A/5B research module. `TEAM_ONLY` remains no-pitcher, the construction artifact remains the sole target schedule/game handoff, and the Phase 4V/4Y construction plus Phase 4P/4S lock goldens remain unchanged.
