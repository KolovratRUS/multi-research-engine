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

- Preflight confirmed `/Users/samkassirov/multi-research-engine`, branch `main`, and `HEAD`, local `main`, and the locally recorded `origin/main` at `dbca2fa10318c53bae3fdcb812b500ff0b84b255`.
- Fixture inventory and prospective dry-run guards passed: 29 historical fixture games, zero dry-run validation errors and warnings.
- Valid manual schedule validation, snapshot creation, lock creation, no-flag construction, and file-mode construction passed through the local `node --require tsx/cjs` loader. The direct `npm`/`tsx` launcher was blocked by managed-sandbox IPC `EPERM` before script execution.
- The focused construction suite passes: 58 tests, including byte-for-byte file artifact and file-mode summary goldens. The artifact equals the Phase 4V no-flag package and the summary has a stable relative `artifactPath`.
- Generated `tmp` output was removed after validation; no generated artifact remains.
- No live source, MLB API request, web lookup, network schedule ingestion, dependency change, or historical fixture change was made.

## Recommended next safe phase

Phase 4Z — plan first real research module handoff.

State:

- planning-only
- no implementation
- no live/API/web
- no network schedule ingestion
- no generated run artifacts committed
- no historical fixture data changes
- no `modelProbability` yet
- no odds/market/betting language except safety exclusions
- identify module inputs and outputs only
