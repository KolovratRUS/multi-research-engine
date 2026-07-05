# Historical Export Review Rollout

Use this document to roll out the offline historical export/review subsystem after the release checklist passes.

## Purpose

This document describes the rollout procedure for the Phase 1I–1V historical export and review subsystem. It is the final release-verification wrapper before expanding to larger historical datasets or later calibration work.

## Release status

Treat this subsystem as stable only after all of the following gates pass:

- `npm run review:historical-export:release-check` exits 0.
- Targeted review and export test files pass.
- Full backtesting suite passes.
- Full project suite passes.
- `npx tsc --noEmit --incremental false --pretty false` exits 0.
- `npm test` exits 0.
- `npm run build` exits 0.
- `git diff --check` exits 0.
- Safety search returns zero unsafe matches across changed files.
- Forbidden-concept search returns no betting/odds/probability concepts.
- No `source=live` path was used for verification.
- No real MLB API requests were made during verification.

## Included in this rollout

- historical export JSON artifacts
- manifest metadata and manifest validation
- deterministic golden export fixtures
- single-file offline review
- text review output
- JSON review output
- batch review
- aggregate batch summaries
- threshold flags
- threshold preset JSON files
- package aliases
- release checklist documentation
- rollout documentation

## Explicitly not included

- live MLB API runs in CI or local rollout verification
- larger historical dataset execution
- calibrated `modelProbability`
- model tuning
- production dashboard/reporting UI
- additional sports modules
- odds or betting-market layers
- anything outside offline deterministic verification

Do not frame this subsystem as betting advice. It is an offline audit and packaging helper for historical research exports.

## CI rollout command set

Run these commands in order when promoting the subsystem:

```bash
npm run review:historical-export:release-check
npx vitest run tests/backtesting/cli-review-threshold-presets.test.ts --reporter=verbose
npx vitest run tests/backtesting/cli-review-export-batch.test.ts --reporter=verbose
npx vitest run tests/backtesting/cli-review-export.test.ts --reporter=verbose
npx vitest run tests/backtesting/historical-research-export.test.ts --reporter=verbose
npx vitest run tests/backtesting/historical-research-export-validation.test.ts --reporter=verbose
npx vitest run tests/backtesting/cli-export-golden.test.ts --reporter=verbose
npx vitest run tests/backtesting --reporter=verbose
npx vitest run --reporter=verbose
npx tsc --noEmit --incremental false --pretty false
npm test
npm run build
git diff --check
```

## Local developer verification

Developers should run:

```bash
npm run review:historical-export:release-check
npx vitest run tests/backtesting/historical-research-export.test.ts tests/backtesting/historical-research-export-validation.test.ts tests/backtesting/cli-review-export.test.ts tests/backtesting/cli-export-golden.test.ts
git diff --check
```

If any command exits non-zero, stop and re-run the release checklist before proceeding.

## Stable outputs

The following outputs must remain byte-identical or structurally stable across this rollout:

- committed export golden fixtures
- committed review text fixtures
- committed review JSON fixtures
- committed threshold preset fixtures
- CLI text review output when no thresholds are active
- CLI JSON review output structure
- batch JSON aggregate summary structure
- manifest metadata shape and validation rules

Changes that break golden fixture exact-match tests are not backward-compatible and must be treated as breaking changes.

## Intentionally unchanged behavior

- scorer behavior
- runner behavior
- FULL path pitcher requirements
- TEAM_ONLY scorer behavior
- historical export JSON format
- review JSON/text output format
- threshold evaluation behavior
- threshold preset validation behavior
- `modelProbability` behavior
- leakage guards

Do not change these behaviors during rollout preparation.

## Rollout plan

1. Confirm release checklist passes.
2. Confirm CI command set passes on a clean working tree.
3. Review staged and committed files for unintended production changes.
4. Verify no `source=live` or real MLB API requests were used.
5. Merge this release as stable.
6. After rollout, treat the offline review subsystem as frozen until authorization for calibration, larger datasets, or new modules.

## After rollout

- Future work should preserve deterministic golden fixtures.
- New exports should reuse the manifest contract.
- Threshold behavior remains additive and offline.
- Any Phase 2 calibration or odds concepts must live outside this subsystem.
- Do not re-open this subsystem for scorer/runner changes without explicit authorization.
