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
The Phase 2N fixture-shape investigation note is `docs/historical-coverage-fixture-shape-investigation-large01.md`, documenting the large01 flat-count observation and confirming it is expected from current fixture coverage.
