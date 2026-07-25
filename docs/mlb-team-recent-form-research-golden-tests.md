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

Phase 5C — plan local fixture evidence wiring for MLB team recent form.

State:

- planning-only;
- no implementation;
- define the local fixture evidence source and leakage guards;
- no live, API, or web access;
- no network schedule ingestion;
- no file output;
- no `modelProbability`;
- no pitcher evidence;
- no actual starters;
- no generated run artifacts committed; and
- no historical fixture data changes.
