# Historical Dataset Coverage Plan

This plan prepares larger offline historical coverage runs after the historical export/review subsystem is stable.

Planning only. Cached/local data only. No live MLB API calls. No calibration or `modelProbability` work yet.

## Purpose

This document describes how to expand historical coverage after the release checklist and rollout gates pass.
It is intended for planning and safe execution, not for immediate large-scale runs.

## Why larger coverage matters

Larger historical coverage is needed to understand:

- availability of required pregame data across seasons and date ranges
- FULL vs TEAM_ONLY coverage gaps
- abstention frequency and reasons
- warning patterns
- construction comparison behavior
- evidence domain coverage
- whether later calibration work has enough stable inputs

Do not use larger coverage to evaluate betting value or market outcomes.

## Scope of Phase 2A

Included:

- coverage planning
- safe runbook commands
- proposed date windows
- export and review workflow
- QA gates
- risk register

Not included:

- executing large runs
- new generated export artifacts
- live MLB API requests
- calibration or `modelProbability`
- model tuning
- dashboards
- other sports modules

## Proposed coverage windows

Use staged windows. Start small and expand only after prior gates pass.

### Smoke window

- 3 to 7 historical dates
- purpose: command and process validation
- expected output: small export files, review passes

### Small coverage window

- 2 to 4 weeks
- purpose: detect data availability and warning patterns
- expected output: batch review and threshold preset validation

### Medium coverage window

- 1 to 2 months
- purpose: compare FULL vs TEAM_ONLY coverage and abstentions
- expected output: BOTH exports and batch aggregate summaries

### Season segment

- first half or second half or full regular season
- only after prior gates pass
- purpose: prepare input stability for later calibration planning

Select dates from known cached data availability. Do not require live data.

## Construction modes to evaluate

- FULL
- TEAM_ONLY
- BOTH

FULL keeps pitcher requirements intact.
TEAM_ONLY excludes pitcher evidence and is leakage-safe.
BOTH is useful for paired comparison reports.
Actual starters remain evaluation-only.

Use the offline source supported by the CLI. The supported offline value is `fixture`. These commands are templates for offline/local coverage planning and should only be executed when the corresponding local fixture or cache data exists. Never use `--source live` for this phase.

Examples:

```bash
# Small FULL export
npm run backtest:mlb -- \
  --source fixture \
  --start 2024-06-01 \
  --end 2024-06-07 \
  --research-construction full \
  --export-json tmp/coverage/full-2024-06-01-2024-06-07.json

# Small TEAM_ONLY export
npm run backtest:mlb -- \
  --source fixture \
  --start 2024-06-01 \
  --end 2024-06-07 \
  --research-construction team-only \
  --export-json tmp/coverage/team-only-2024-06-01-2024-06-07.json

# Paired BOTH export
npm run backtest:mlb -- \
  --source fixture \
  --start 2024-06-01 \
  --end 2024-06-07 \
  --research-construction both \
  --export-json tmp/coverage/both-2024-06-01-2024-06-07.json
```

Do not run these commands during planning. They are templates only.

## Export and review workflow

1. Generate exports with `--export-json` using cached data only.
2. Review each export offline with `--review-export-json`.
3. For multiple exports, use repeated `--review-export-json` flags for batch review.
4. Use committed threshold preset files or explicit threshold flags for CI-style validation.
5. Inspect manifest metadata, result counts, evidence domain summary, and warning summary.

## Batch review of exported artifacts

Batch review preserves file order and prints an aggregate summary.

```bash
npm run backtest:mlb -- \
  --review-export-json tmp/coverage/full-2024-06-01-2024-06-07.json \
  --review-export-json tmp/coverage/team-only-2024-06-01-2024-06-07.json \
  --review-thresholds-json tests/backtesting/fixtures/historical-research-threshold-presets/passing-ci-thresholds-v1.json
```

## Initial threshold presets

Use existing committed presets as a starting point.

Suggested initial preset concerns:

- minimum valid files
- maximum invalid files
- minimum total predictions
- maximum total abstentions
- maximum total warnings
- required constructions
- required evidence domains
- forbidden warnings

Tighten thresholds only after inspecting baseline data from small windows.

## Metrics to inspect

- manifest exportId stability
- requested date count vs generated date count
- predictions, abstentions, and warnings
- comparison inclusion in BOTH exports
- included and excluded evidence domains
- warning summary frequencies
- batch aggregate counts and construction counts

Do not derive betting-market or odds-based metrics.

## Risks and leakage traps

- accidental `source=live` during coverage runs
- using network-backed data without audit trail
- widening FULL path pitcher requirements
- weakening TEAM_ONLY leakage safety
- introducing calibration assumptions before inputs are stable
- changing export manifest contract without fixture updates
- treating warnings or abstentions as data quality failures without context
- running large date windows before small windows validate behavior

## Definitions and terminology

Use these safe terms. Do not use betting or market language.

- prediction: a research output produced from available evidence
- abstention: a research output withheld because required inputs or timestamps are missing
- warning: a non-fatal data-quality note attached to a prediction or abstention
- evidence domain: a grouped input category such as team offense or starting pitcher
- comparison report: an optional paired FULL versus TEAM_ONLY report in BOTH mode
- manifest: metadata block appended to each historical export JSON
- threshold preset: reusable offline JSON threshold configuration for batch review
- calibration: future probability validation work outside this phase

## What must be done before calibration

- complete coverage windows from smallest to largest
- keep export manifests stable and deterministic
- keep review output deterministic
- preserve leakage-safe TEAM_ONLY behavior
- keep FULL pitcher requirements unchanged
- confirm evidence domains and warnings are well-understood
- confirm abstention reasons are typed and stable
- confirm batch threshold presets are versioned
- document all findings in this plan before introducing any probability calibration

## Developer checklist

- [ ] review release checklist passes
- [ ] rollout document reviewed
- [ ] cached/source=fixture commands validated in smoke window
- [ ] exports written outside version control or in approved scratch paths
- [ ] review mode used for every generated export
- [ ] threshold presets reviewed
- [ ] manifest metadata inspected
- [ ] no live API requests made
- [ ] no scorer or runner behavior changed
- [ ] no odds, sportsbook, or betting concepts introduced

## Next roadmap gate

After this plan is validated, the next phases may include:

- actual cached historical coverage runs
- calibration planning
- probability modeling outside this subsystem
- expanded evidence domains

Do not proceed to those phases without explicit authorization and updated documentation.

## Coverage-run templates

Use `docs/historical-coverage-run-log-template.md` to record future coverage runs and `docs/historical-coverage-artifact-naming.md` to name artifacts consistently.

The first Phase 2C observer-note example is `docs/historical-coverage-run-log-smoke01.md`.
The expanded Phase 2E observer-note example is `docs/historical-coverage-run-log-small01.md`.
The Phase 2F observer-comparison document is `docs/historical-coverage-observer-comparison-smoke01-small01.md`.
Use the Phase 2G conservative comparison checklist `docs/historical-coverage-comparison-checklist.md` before promoting to larger fixture-only windows.
Use the Phase 2H medium01 planning document `docs/historical-coverage-run-plan-medium01.md` to prepare the next conservative fixture-only run as a planning step, not a completed run log.
The Phase 2I completed medium01 run log is `docs/historical-coverage-run-log-medium01.md`, recording observer-note results for the executed fixture-only coverage run.
The Phase 2J small01 to medium01 observer comparison is `docs/historical-coverage-observer-comparison-small01-medium01.md`, documenting conservative coverage comparisons between small01 and medium01 without creating new exports.
The Phase 2K large01 planning document is `docs/historical-coverage-run-plan-large01.md`, preparing the next conservative fixture-only coverage expansion plan.
The Phase 2L completed large01 run log is `docs/historical-coverage-run-log-large01.md`, recording observer-note results for the executed fixture-only coverage run.
The Phase 2M medium01 to large01 observer comparison is `docs/historical-coverage-observer-comparison-medium01-large01.md`, documenting fixture-only coverage comparisons between medium01 and large01 without creating new exports.
The Phase 2N fixture-shape investigation note is `docs/historical-coverage-fixture-shape-investigation-large01.md`, documenting the large01 flat-count observation and confirming it is expected from current fixture coverage shape.
The Phase 2P july-slice01 implementation note is `docs/historical-coverage-july-slice01-implementation.md`, documenting the small deterministic July fixture slice added to prove downstream fixture-discovered count changes.
The Phase 2Q july-slice01 comparison note is `docs/historical-coverage-july-slice01-comparison.md`, documenting the fixture-only comparison of pre-update fixture shape versus the july-slice01 surface.
The Phase 2O targeted fixture update plan is `docs/historical-coverage-targeted-fixture-update-plan.md`, documenting how to safely add a small July fixture slice in a future implementation phase.
The Phase 2R fixture inventory guard is `docs/historical-coverage-fixture-inventory-guard.md`, documenting the local fixture inventory guard used before further fixture expansion.
The Phase 2S next fixture slice plan is `docs/historical-coverage-next-fixture-slice-plan.md`, planning the next deterministic fixture slice using the inventory guard.
The Phase 2T july-slice02 implementation note is `docs/historical-coverage-july-slice02-implementation.md`, documenting the second small deterministic July fixture slice added for coverage-shape testing.
The Phase 2U july-slice01 vs july-slice02 comparison note is `docs/historical-coverage-july-slice01-slice02-comparison.md`, documenting a fixture-only comparison of the two July slices without creating new exports.
The Phase 2V fixture-slice comparison checklist is `docs/historical-coverage-fixture-slice-comparison-checklist.md`, documenting a reusable checklist and test-guard oriented process for comparing any future deterministic fixture slice before adding more fixture data.
The Phase 2W next fixture slice plan is `docs/historical-coverage-next-fixture-slice-plan-02.md`, planning july-slice03 using the fixture inventory guard and fixture-slice comparison checklist before implementation.
The Phase 2X july-slice03 implementation note is `docs/historical-coverage-july-slice03-implementation.md`, documenting the deterministic local July fixture slice added for coverage-shape testing.
The Phase 2Y july-slice02 vs july-slice03 comparison note is `docs/historical-coverage-july-slice02-slice03-comparison.md`, documenting a fixture-only comparison of the two July slices without creating new exports.
The Phase 2Z July fixture-slice summary index is `docs/historical-coverage-july-fixture-slice-summary-index.md`, documenting a deterministic, local-only, documentation-only summary of the three July fixture slices. It does not add fixture data.
The Phase 3A planning-only decision point is `docs/historical-coverage-phase3a-decision-point.md`, documenting the planning-only decision after Phase 2 fixture coverage. It does not add fixture data.
The Phase 3B planning-only fixture inventory reporting polish plan is `docs/historical-coverage-fixture-inventory-reporting-polish-plan.md`, documenting how to improve operator-facing fixture inventory output around the existing 29-game local fixture inventory before any implementation. It does not add fixture data.
The Phase 3C implementation note is `docs/historical-coverage-fixture-inventory-reporting-polish-implementation.md`, documenting the implemented fixture inventory reporting polish that preserves the 29-game fixture baseline and only improves reporting.
The Phase 4A planning-only MLB prospective weekly test mode plan is `docs/mlb-prospective-weekly-test-mode-plan.md`, documenting the bridge from local historical fixture testing toward future real MLB weekly testing. It does not implement live/prospective mode.
The Phase 4B local-only MLB prospective weekly dry-run schemas documentation is `docs/mlb-prospective-weekly-dry-run-schemas.md`, documenting the local-only TypeScript schema foundation for future prospective dry-runs. It does not add fixture data or implement live mode.
The Phase 4C local-only MLB prospective weekly dry-run sample documentation is `docs/mlb-prospective-weekly-local-dry-run-sample.md`, documenting a tiny deterministic local sample that exercises the Phase 4B schemas and validation helpers. It does not modify historical fixture data or implement live mode.
The Phase 4D local-only MLB prospective weekly dry-run check command documentation is `docs/mlb-prospective-weekly-dry-run-check-command.md`, documenting a local-only CLI command that validates the Phase 4C dry-run sample and prints a deterministic JSON summary. It does not implement live mode or modify historical fixture data.
The Phase 4E local-only MLB prospective weekly dry-run check golden-output test documentation is `docs/mlb-prospective-weekly-dry-run-check-golden-output.md`, documenting the golden-output regression guard for the dry-run check command output. It does not implement live mode or modify historical fixture data.
The Phase 4F planning-only manually supplied MLB schedule-file dry-run plan documentation is `docs/mlb-manual-schedule-file-dry-run-plan.md`, documenting the future user-supplied static schedule file workflow before any authorized ingestion. It does not implement live mode, schedule ingestion, or fixture data changes.
The Phase 4G local-only MLB manual schedule file schema and validator documentation is `docs/mlb-manual-schedule-file-schemas.md`, documenting the local-only types/validators for future manually supplied schedule JSON. It does not implement live mode or modify historical fixture data.
The Phase 4H local-only MLB manual schedule file fixture and golden validator test documentation is `docs/mlb-manual-schedule-file-fixtures.md`, documenting tiny static manual schedule fixtures and expected validator outputs. It adds only local test data and does not implement live mode, schedule ingestion, or historical fixture changes.
The Phase 4I local-only MLB manual schedule validator CLI documentation is `docs/mlb-manual-schedule-validator-cli.md`, documenting a user-provided local JSON validation CLI. It validates only and does not implement live mode, network/API schedule ingestion, snapshot creation, or historical fixture changes.
The Phase 4J local-only MLB manual schedule validator CLI golden-output documentation is `docs/mlb-manual-schedule-validator-cli-golden-output.md`. It locks only exact local CLI JSON output for static fixtures and does not implement live mode, network/API schedule ingestion, snapshot creation, or historical fixture changes.
The Phase 4K planning-only MLB manual schedule snapshot creation document is `docs/mlb-manual-schedule-snapshot-creation-plan.md`. It defines future local conversion command and output behavior only; it does not implement live mode, network schedule ingestion, snapshot creation, or historical fixture changes.
The Phase 4L local-only, stdout-only MLB manual schedule snapshot creation CLI is documented in `docs/mlb-manual-schedule-snapshot-creation-cli.md`. It validates one user-provided local file before in-memory conversion and does not implement live mode, network schedule ingestion, file-output artifacts, generated run artifacts, or historical fixture changes.
The Phase 4M local-only MLB manual schedule snapshot CLI golden outputs are documented in `docs/mlb-manual-schedule-snapshot-cli-golden-output.md`. They lock only snapshot CLI stdout for static fixtures and do not implement live mode, network schedule ingestion, file-output artifacts, generated run artifacts, or historical fixture changes.
The Phase 4N planning-only MLB manual week lock workflow is documented in `docs/mlb-manual-week-lock-workflow-plan.md`. It defines a future local deterministic lock contract only and does not implement live mode, network schedule ingestion, file-output artifacts, generated run artifacts, or historical fixture changes.
The Phase 4O local-only, stdout-only MLB manual week lock CLI is documented in `docs/mlb-manual-week-lock-cli.md`. It validates and converts one user-provided local manual schedule before deterministic wrapping and does not implement live mode, network schedule ingestion, file-output artifacts, generated run artifacts, or historical fixture changes.
