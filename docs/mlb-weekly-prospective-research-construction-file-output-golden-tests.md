# MLB Weekly Prospective Research Construction File Output Golden Tests

## Status

Local-only.
Fixture-only.
Exact file artifact golden.
Exact file-mode stdout summary golden.
No new file-output behavior.
No generated prospective run artifact committed except static golden fixtures.
No live source used.
No real MLB API request made.
No web lookup used.
No network schedule ingestion.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
`modelProbability` remains null/absent/not available until calibrated or absent from constructed packages.

## Purpose

Phase 4Y locks the exact construction file-output behavior implemented in Phase 4X. It follows the Phase 4X implementation and the Phase 4V no-flag stdout goldens. It adds regression fixtures and tests only; it does not add or change file-output behavior.

## Golden fixtures

- `tests/prospective/fixtures/manual-schedule/valid-weekly-prospective-research-construction-file-artifact-v1.json`
- `tests/prospective/fixtures/manual-schedule/valid-weekly-prospective-research-construction-file-summary-v1.json`

## Protected earlier goldens

- Phase 4V no-flag construction stdout goldens are unchanged.
- Phase 4P no-flag lock goldens are unchanged.
- Phase 4S file-output lock goldens are unchanged.

## What is locked

- the exact file artifact body;
- the exact file-mode stdout summary;
- the deterministic filename;
- the relative `artifactPath`;
- the artifact equals the Phase 4V no-flag `package`;
- file-mode stdout excludes `package`;
- the artifact excludes outer summary fields;
- stdout and the artifact contain no absolute paths; and
- the artifact contains no `modelProbability`, outcome, actual-starter, or external fields.

Generated command output remains ignored and uncommitted. The stable output directory is removed after the exact test and after manual validation.

## Command covered

```bash
npm run prospective:mlb:construct-week -- tests/prospective/fixtures/manual-schedule/valid-manual-week-lock-file-artifact-v1.json --write-file --output-dir tmp/prospective/mlb/weekly-research-packages
```

## Validation

- Phase 4Z preflight confirmed `/Users/samkassirov/multi-research-engine`, branch `main`, a clean starting worktree, and `HEAD`, local `main`, and the locally recorded `origin/main` at `ed84f9628c93125d999811fc5e7d8d03975c156b`.
- Fixture inventory and prospective dry-run guards passed: 29 historical fixture games, zero dry-run validation errors and warnings.
- Valid manual schedule validation, snapshot creation, lock creation, no-flag construction, and file-mode construction passed through the local `node --require tsx/cjs` loader. The direct `npm`/`tsx` launcher was blocked by managed-sandbox IPC `EPERM` before script execution.
- Pre-edit focused lock and construction regression coverage passes: 82 tests, including unchanged Phase 4P, Phase 4S, Phase 4V, and Phase 4Y exact goldens.
- The focused construction suite passes: 58 tests, including byte-for-byte file artifact and file-mode summary goldens. The artifact equals the Phase 4V no-flag package, has the same SHA-1 as this Phase 4Y artifact golden, and the summary has a stable relative `artifactPath`.
- The historical rollout review suite passes: 154 tests. Prospective passes 137 tests, backtesting passes 699 tests, and full Vitest plus `npm test` pass 893 tests across 57 files.
- TypeScript, production build, and Git diff check pass.
- Generated `tmp` output and empty directories were removed after validation; no generated lock, construction, research, prospective, export, review, or temporary artifact remains.
- Added-line safety searches contain only negative safety exclusions and `modelProbability` absence/prohibition statements. No executable `source=live` command was added.
- No live source, MLB API request, web lookup, network schedule ingestion, dependency change, implementation change, historical fixture change, protected golden change, or package-file change was made.

## Phase 4Z first research module handoff plan

Phase 4Z is planning-only and is documented in `docs/mlb-first-research-module-handoff-plan.md`. It proposes team recent form research from the exact Phase 4X/4Y construction package artifact. The module enriches pregame research and does not predict. No `modelProbability`, pitcher evidence, live/API/web access, or network schedule ingestion is introduced. These Phase 4Y goldens, Phase 4X behavior, the Phase 4V construction goldens, and Phase 4P/4S lock goldens remain unchanged.

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

## Phase 5E validation

- Phase 5E locks exact `--fixture-evidence-local` stdout golden in `tests/prospective/fixtures/manual-schedule/valid-mlb-team-recent-form-research-fixture-evidence-local-cli-output-v1.json`.
- Golden contains `fixtureEvidenceLocal: true`, deterministic insufficient evidence for current local fixtures, exact `inputConstructionPackage` embedding, no `modelProbability`, no `finalScore`, no `completedGameState`, no `actualStartingPitchers`, no absolute paths, and no stack traces.
- Phase 5D provider behavior unchanged.
- No new research behavior, file output, dependency, or fixture data change introduced.

Phase 5D implemented the local fixture evidence provider in `docs/mlb-team-recent-form-fixture-evidence-provider.md`. It adds no real schedule ingestion, no live source, no network access, no historical fixture changes, and no `modelProbability` prediction output.
