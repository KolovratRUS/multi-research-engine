# Historical Coverage Run Log — smoke01

Phase 2C observer note for a future tiny offline fixture-based smoke coverage run.

This document records intended commands, expected artifact names, review expectations, and safety gates for a later authorized smoke run. It does not prove model quality and does not create generated export artifacts.

## Purpose

Record a safe offline smoke-run plan using the Phase 2B run-log template and artifact naming convention.
- Run ID: smoke01
- Date created: 2026-07-05
- Operator: Sam
- Branch: main
- Commit SHA: 858663fa421712bd259e659c651bfb7d8381ba48
- Dataset source: local fixture/offline data
- Source mode: fixture
- Sport: MLB
- Construction mode: BOTH
- Date window: 2024-06-01 to 2024-06-07
- Run type: smoke
- Purpose: validate the Phase 2 coverage logging and artifact naming workflow before larger historical coverage windows

## Preflight checklist

- [x] Working tree clean before planning
- [x] Local HEAD recorded
- [x] Remote HEAD recorded
- [x] git diff --check passed
- [x] No source=live command planned
- [x] No real MLB API request planned
- [ ] Output directory selected under ignored working path
- [x] Artifact naming follows docs/historical-coverage-artifact-naming.md
- [ ] No generated export artifacts created in Phase 2C
- [ ] No large historical run executed in Phase 2C

## Planned commands

Export command, planned only:

```bash
npm run backtest:mlb -- --source fixture --start 2024-06-01 --end 2024-06-07 --research-construction both --export-json tmp/coverage/mlb_both_fixture_2024-06-01_2024-06-07_smoke01_export.json
```

Offline review command, planned only:

```bash
npm run backtest:mlb -- --review-export-json tmp/coverage/mlb_both_fixture_2024-06-01_2024-06-07_smoke01_export.json
```

JSON review command, planned only:

```bash
npm run backtest:mlb -- --output json --review-export-json tmp/coverage/mlb_both_fixture_2024-06-01_2024-06-07_smoke01_export.json
```

Do not run these commands in Phase 2C unless explicitly authorized. This document records the future smoke-run plan only.

## Expected artifact names

| Artifact path | Artifact type | Construction | Date window | Created in Phase 2C | Commit by default | Notes |
|---|---|---|---|---|---|---|
| tmp/coverage/mlb_both_fixture_2024-06-01_2024-06-07_smoke01_export.json | export JSON | BOTH | 2024-06-01 to 2024-06-07 | no | no | planned export artifact |
| tmp/coverage/reviews/mlb_both_fixture_2024-06-01_2024-06-07_smoke01_review.txt | review text | BOTH | 2024-06-01 to 2024-06-07 | no | no | planned review artifact |
| tmp/coverage/reviews/mlb_both_fixture_2024-06-01_2024-06-07_smoke01_review.json | review JSON | BOTH | 2024-06-01 to 2024-06-07 | no | no | planned review artifact |
| tmp/coverage/logs/mlb_coverage_fixture_2024-06-01_2024-06-07_smoke01_run-log.md | coverage log | BOTH | 2024-06-01 to 2024-06-07 | no | no | planned log artifact |

## Review expectations

- Files reviewed: planned
- Valid files: planned
- Invalid files: planned
- Requested dates: planned
- Predictions: planned
- Abstentions: planned
- Warnings: planned
- Thresholds used: none for initial smoke unless later authorized
- Threshold check result: planned
- JSON review produced: planned

## Construction coverage observations

- FULL prediction count: not executed
- TEAM_ONLY prediction count: not executed
- BOTH comparison included: planned
- FULL abstention count: not executed
- TEAM_ONLY abstention count: not executed
- Paired comparison notes: planned after execution
- Evidence domains included: planned after execution
- Evidence domains excluded: planned after execution
- Pitcher evidence excluded from TEAM_ONLY: expected by design, not revalidated by this run log

## Warning and abstention notes

| Code | Count | Construction | First observed artifact | Notes | Follow-up needed |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

| Abstention reason | Count | Construction | First observed artifact | Notes | Follow-up needed |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

## Leakage and data-quality checks

- [x] TEAM_ONLY excludes pitcher evidence by design
- [ ] Actual starters used only as evaluation data
- [ ] Schedule probable timestamp uncertainty reviewed
- [ ] Historical completion provenance reviewed
- [x] No modelProbability field introduced
- [x] No unsupported source mode used
- [x] No live/API calls planned
- [x] No generated export committed by default

## Decision

- Result: planning-only / ready-for-authorized-smoke-run
- Promote artifacts to fixtures: no
- Follow-up phase: authorized smoke execution after explicit approval
- Summary: Phase 2C records a safe fixture/offline smoke-run plan and artifact names but does not execute the coverage export.
- Risks found: none from docs-only planning, unless inspection finds issues
- Next action: request explicit authorization before executing the smoke export command

## Sign-off

- Reviewer: Sam / pending
- Review date:
- Approved for next coverage window: no, execution authorization still required