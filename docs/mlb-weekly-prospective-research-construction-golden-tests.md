# MLB Weekly Prospective Research Construction Golden Tests

## Status

Local-only.
Fixture-only.
Exact no-flag stdout package regression tests.
Phase 4X file-output behavior implemented separately without changing these goldens.
No generated prospective run artifact committed.
No live source used.
No real MLB API request made.
No web lookup used.
No network schedule ingestion.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
`modelProbability` remains null/absent/not available until calibrated or absent from constructed packages.

## Purpose

Phase 4V locks the exact no-flag stdout package shape for the Phase 4U construction command. It adds byte-for-byte regression coverage for one valid locked artifact and three representative invalid locked artifacts.

Phase 4X adds construction file-output behavior without modifying these fixtures. Phase 4Y adds separate exact file artifact and file-mode stdout summary goldens without modifying these Phase 4V fixtures.

## Golden fixtures

- `tests/prospective/fixtures/manual-schedule/valid-weekly-prospective-research-construction-cli-output-v1.json`
- `tests/prospective/fixtures/manual-schedule/invalid-weekly-prospective-research-construction-lock-version-output-v1.json`
- `tests/prospective/fixtures/manual-schedule/invalid-weekly-prospective-research-construction-forbidden-field-output-v1.json`
- `tests/prospective/fixtures/manual-schedule/invalid-weekly-prospective-research-construction-empty-games-output-v1.json`

## Protected earlier goldens

The Phase 4P no-flag lock goldens and Phase 4S file-output lock goldens remain unchanged.

## What is locked

- the valid stdout summary and complete construction package;
- copied lock metadata;
- `constructedAt` equal to `lockedAt`;
- one `pending-research` / `pregame` / `FULL` stub per locked game;
- `inputSnapshot` equal to the locked artifact snapshot;
- invalid stdout summaries for a wrong lock version, a deliberate forbidden field, and an empty game list;
- no package for invalid inputs;
- no absolute paths; and
- no `modelProbability`, outcome, actual-starter, external price, or post-game fields in the valid package.

The invalid tests create deterministic input files under the ignored `tmp/` tree and remove that tree after each test. Only the expected stdout fixtures are committed.

## Command covered

```bash
npm run prospective:mlb:construct-week -- tests/prospective/fixtures/manual-schedule/valid-manual-week-lock-file-artifact-v1.json
```

## Validation

- Phase 4Y preflight confirmed `/Users/samkassirov/multi-research-engine`, branch `main`, and `HEAD`, local `main`, and the locally recorded `origin/main` at `dbca2fa10318c53bae3fdcb812b500ff0b84b255`.
- The fixture inventory guard remains 29 games from 2024-06-01 through 2024-07-21: June 17 and July 12.
- The prospective dry-run, valid manual validator, snapshot, no-flag lock, no-flag construction, and construction file-mode behaviors pass.
- Phase 4P valid and invalid no-flag lock stdout remains byte-identical to its committed goldens.
- The Phase 4S artifact body and stable-directory file-mode stdout remain byte-identical to their committed goldens.
- The valid no-flag construction stdout remains deterministic and byte-identical to its Phase 4V golden.
- The three deterministic invalid construction cases exit 1, match their goldens byte-for-byte, contain their required validation codes, and contain no package or absolute input path.
- The focused Phase 4U/4V/4X/4Y construction suite passes: 58 tests.
- Historical export review behavior passes in all four modes through the local loader, and the focused rollout review suite passes: 154 tests.
- The prospective suite passes: 136 tests.
- The backtesting suite passes: 699 tests.
- Full Vitest and `npm test` pass: 892 tests across 57 files.
- TypeScript passes.
- Production build passes.
- Git diff check passes.
- During final validation, affected direct npm entry points that invoke the `tsx` launcher were blocked by managed-sandbox IPC `EPERM` before script execution. The equivalent entry points passed through the existing local `tsx/cjs` loader; package scripts remain unchanged.
- Generated construction and invalid-input temporary files and directories were removed after validation. No construction, lock, export, review, or other generated prospective artifact remains.
- No live source, MLB API request, web lookup, or network schedule ingestion was used.
- No historical fixture game record, package lock, dependency, protected construction/lock golden, or Phase 4U package-construction module changed.

## Recommended next safe phase

Phase 4W planned the file-output design in `docs/mlb-weekly-prospective-research-construction-file-output-plan.md`; Phase 4X implements it. Phase 4U no-flag behavior, these Phase 4V construction stdout goldens, and the Phase 4P/4S lock goldens remain unchanged.

Phase 4Y exact construction file-output golden tests are documented in `docs/mlb-weekly-prospective-research-construction-file-output-golden-tests.md`. Phase 4X behavior and all Phase 4V, Phase 4P, and Phase 4S goldens remain unchanged. Generated `tmp` artifacts are ignored, uncommitted, and cleaned.

Phase 4Z — plan first real research module handoff.

State:

- planning-only
- no implementation
- no live/API/web
- no network schedule ingestion
- no generated run artifacts committed
- no historical fixture data changes
- no `modelProbability` yet
- identify module inputs and outputs only
