# MLB Team Recent Form Research Golden Tests

## Status

Phase 5B.
Fixture-only.
Exact stdout golden tests.
No new research behavior.
No file output.
No generated prospective run artifact committed except static golden fixtures.
No live source used.
No real MLB API request made.
No web lookup used.
No network schedule ingestion.
No pitcher evidence.
No actual starters.
No `modelProbability`.
No prediction output.
No historical fixture data added or modified.
Default Phase 5B stdout goldens remain unchanged.
Evidence mode is explicit via `--fixture-evidence-local`.

## Purpose

Phase 5B locks the exact stdout behavior implemented by the Phase 5A MLB team recent form research skeleton. It follows:

- Phase 5A research skeleton implementation; and
- Phase 4Y construction file-output goldens.

This phase adds fixture-only regression coverage. It does not add or change research behavior.

## Golden fixtures

- `tests/prospective/fixtures/manual-schedule/valid-mlb-team-recent-form-research-cli-output-v1.json`
- `tests/prospective/fixtures/manual-schedule/invalid-mlb-team-recent-form-research-construction-version-output-v1.json`
- `tests/prospective/fixtures/manual-schedule/invalid-mlb-team-recent-form-research-forbidden-field-output-v1.json`
- `tests/prospective/fixtures/manual-schedule/invalid-mlb-team-recent-form-research-empty-games-output-v1.json`
- `tests/prospective/fixtures/manual-schedule/valid-mlb-team-recent-form-research-fixture-evidence-local-cli-output-v1.json`

## What is locked

- exact valid stdout summary and package;
- exact invalid stdout summaries for wrong `constructionVersion`, a recursively forbidden field, and empty games;
- deterministic `researchRunId`;
- deterministic `researchedAt`;
- embedded exact `inputConstructionPackage`;
- one completed `TEAM_RECENT_FORM` module entry;
- one `TEAM_ONLY` not-evaluated finding skeleton per game;
- absence of `modelProbability`;
- absence of target-game outcome, post-game, starter, and external price fields;
- no absolute paths; and
- no stack traces.

The invalid tests create deterministic mutated construction inputs only under ignored `tmp/` paths and remove them after each test. Invalid stdout includes validation counts, ordered messages, and a stable `error`, but no `package`.

## Protected earlier goldens

- Phase 4V no-flag construction stdout goldens are unchanged.
- Phase 4Y construction file-output goldens are unchanged.
- Phase 4P no-flag lock goldens are unchanged.
- Phase 4S file-output lock goldens are unchanged.

## Validation

- Preflight confirmed `/Users/samkassirov/multi-research-engine`, branch `main`, a clean starting worktree, and `HEAD`, local `main`, and the locally recorded `origin/main` at `da07462ac51a8e294cdf478b46357e5b86014670`.
- The fixture inventory guard passes with 29 games from 2024-06-01 through 2024-07-21: June 17 and July 12.
- The prospective dry-run guard passes with zero validation errors and warnings.
- The four new fixtures are exact pretty JSON with trailing newlines. The valid command is deterministic and matches its golden byte-for-byte; the three deterministic invalid mutations exit 1 and match their goldens byte-for-byte.
- The focused Phase 5A/5B suite passes 45 tests: all 37 Phase 5A tests remain, and Phase 5B adds 8 exact regression tests.
- The protected construction suite passes 58 tests. The Phase 4V no-flag stdout, Phase 4Y file artifact and summary, Phase 4P no-flag lock, and Phase 4S file-output lock goldens remain unchanged.
- The historical rollout-focused suite passes 154 tests. All four release-check modes pass through the local loader, including threshold checks.
- The prospective suite passes 182 tests, and the backtesting suite passes 699 tests.
- Full Vitest and `npm test` pass 938 tests across 58 files.
- TypeScript, production build, and Git diff check pass.
- Direct npm entry points that invoke the `tsx` launcher for the manual pipeline, research command, and historical review aliases are blocked by managed-sandbox IPC `EPERM` before script execution. Equivalent script behavior passes through `node --require tsx/cjs`.
- The generated Phase 4X construction artifact equals the Phase 4Y artifact golden and was removed. Test mutation files and empty `tmp` directories were also removed.
- Safety searches find restricted terminology only in negative safety text, existing project context, absence assertions, validator field-name references, and deliberate invalid-field tests. `modelProbability` is absent from the valid research package and appears in Phase 5B only as an absence statement or deliberate invalid fixture field. No executable `source=live` command was added.
- Protected-file checks confirm no change to Phase 5A behavior, Phase 4X construction behavior, historical fixture data, earlier lock/construction goldens, `package.json`, `package-lock.json`, or dependencies.
- No live source, MLB API request, web lookup, or network schedule ingestion was used.

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

## Phase 5F aggregate summary plan

Phase 5F adds planning-only aggregate summary design in `docs/mlb-team-recent-form-aggregate-summary-plan.md`. It does not add implementation, file output, research behavior, or any live/API/web access.

## Phase 5E validation

## Phase 5D validation

- The pure local fixture evidence provider passes 62 tests in `tests/prospective/mlb-team-recent-form-research.test.ts`.
- The protected construction suite passes 58 tests.
- Full Vitest and `npm test` pass 958 tests across 72 files.
- TypeScript, production build, Git diff check, and inventory/dry-run guards pass.
- Default valid stdout remains byte-for-byte equal to the Phase 5B valid golden.
- Default invalid stdout remains byte-for-byte equal to the Phase 5B invalid goldens.
- `--fixture-evidence-local` stdout is exact equal to the committed evidence-enabled golden: `tests/prospective/fixtures/manual-schedule/valid-mlb-team-recent-form-research-fixture-evidence-local-cli-output-v1.json`.
- `--fixture-evidence-local` emits deterministic output across repeated runs.
- `--fixture-evidence-local` keeps same package identity and construction artifact embedding.
- The CLI still rejects unknown arguments and multiple input paths alongside `--fixture-evidence-local`.
- npx vitest run tests/prospective/mlb-weekly-prospective-research-construction.test.ts -> 58 passed
- npx vitest run tests/prospective --reporter=verbose -> 199 passed
- npx vitest run tests/backtesting --reporter=verbose -> 699 passed
- npx vitest run --reporter=verbose -> 958 passed
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
## Phase 5C local fixture evidence plan

Phase 5C is planning-only and is documented in `docs/mlb-team-recent-form-local-fixture-evidence-plan.md`. It plans local historical fixture evidence from `src/fixtures/backtesting/mlb/fixture-games.ts`, a pure provider boundary, deterministic lookback, safe-completion filtering, and target/future-game leakage guards. `TEAM_ONLY` remains no-pitcher. Phase 5A behavior and every Phase 5B stdout golden remain unchanged, with no file output, `modelProbability`, actual starters, live/API/web access, network schedule ingestion, or historical fixture change.

## Phase 5C validation

- The focused research suite passes 45 tests, including all Phase 5B byte-for-byte valid and invalid stdout checks.
- Valid research stdout also matches its committed golden through the local `tsx/cjs` loader.
- Protected construction and lock coverage passes: Phase 4V, Phase 4Y, Phase 4P, and Phase 4S goldens remain exact.
- Historical rollout-focused coverage passes 154 tests, prospective passes 182, backtesting passes 699, and full Vitest plus `npm test` pass 938 tests across 58 files.
- TypeScript, production build, inventory, dry-run, and Git diff checks pass.
- Direct npm aliases using `tsx` encounter managed-sandbox IPC `EPERM` before script execution; equivalent local-loader behavior passes.
- Generated construction output, invalid-input mutations, and empty `tmp` directories were removed. No Phase 5A behavior, Phase 5B fixture, protected earlier golden, historical fixture, package file, dependency, live/API/web source, or network schedule ingestion changed.
