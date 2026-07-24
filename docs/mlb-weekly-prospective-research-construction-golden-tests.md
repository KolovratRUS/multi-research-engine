# MLB Weekly Prospective Research Construction Golden Tests

## Status

Local-only.
Fixture-only.
Exact stdout package regression tests.
No file output.
No generated prospective run artifact committed.
No live source used.
No real MLB API request made.
No web lookup used.
No network schedule ingestion.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
`modelProbability` remains null/absent/not available until calibrated or absent from constructed packages.

## Purpose

Phase 4V locks the exact stdout package shape for the Phase 4U construction command. It adds byte-for-byte regression coverage for one valid locked artifact and three representative invalid locked artifacts without changing construction behavior or adding file output.

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

- Preflight confirmed `/Users/samkassirov/multi-research-engine`, clean `main`, and `HEAD`, local `main`, and the locally recorded `origin/main` at `285c4a253c75ecb8a12e3dec2bb967e433efdb84`.
- The fixture inventory guard remains 29 games from 2024-06-01 through 2024-07-21: June 17 and July 12.
- The prospective dry-run, valid manual validator, snapshot, no-flag lock, explicit file-mode lock, and construction behaviors pass through the existing local `tsx/cjs` loader.
- Phase 4P valid and invalid no-flag lock stdout remains byte-identical to its committed goldens.
- The Phase 4S artifact body and stable-directory file-mode stdout remain byte-identical to their committed goldens.
- The valid construction stdout is deterministic across repeated runs and byte-identical to the new valid golden.
- The three deterministic invalid construction cases exit 1, match their goldens byte-for-byte, contain their required validation codes, and contain no package or absolute input path.
- The focused Phase 4V construction suite passes: 36 tests.
- Historical export review behavior passes in all four modes through the local loader, and the focused rollout review suite passes: 154 tests.
- The prospective suite passes: 115 tests.
- The backtesting suite passes: 699 tests.
- Full Vitest and `npm test` pass: 871 tests across 57 files.
- TypeScript passes.
- Production build passes.
- Git diff check passes.
- During final validation, direct npm entry points that invoke the `tsx` launcher were blocked by managed-sandbox IPC `EPERM` before script execution. The equivalent entry points passed through the existing local `tsx/cjs` loader; package scripts remain unchanged.
- Generated manual lock and invalid-input temp files and directories were removed after validation. No construction file, export, review, or other generated prospective artifact remains.
- No live source, MLB API request, web lookup, or network schedule ingestion was used.
- No historical fixture game record, package lock, dependency, protected lock golden, or Phase 4U implementation file changed.

## Recommended next safe phase

Phase 4W is the planning-only future file-output design in `docs/mlb-weekly-prospective-research-construction-file-output-plan.md`. It does not implement construction file output. Phase 4U remains unchanged, these Phase 4V construction stdout goldens remain unchanged, and the Phase 4P no-flag and Phase 4S file-output lock goldens remain unchanged.

Phase 4X — implement file-output mode for constructed weekly research packages.

State:

- local-only
- implementation
- double opt-in `--write-file` + `--output-dir`
- no-flag stdout goldens unchanged
- writes the exact construction package artifact only
- validates before writing
- refuses overwrite
- no live/API/web
- no network schedule ingestion
- no generated run artifacts committed
- no historical fixture data changes
