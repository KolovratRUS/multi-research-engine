# Historical Coverage Run Log — smoke01

Phase 2C/D observer note for a tiny offline fixture-based smoke coverage run.

This document records intended commands, expected artifact names, review expectations, and safety gates for an authorized smoke run. It does not prove model quality and does not commit generated export artifacts.

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
- [x] Output directory selected under ignored working path
- [x] Artifact naming follows docs/historical-coverage-artifact-naming.md
- [x] No generated export artifacts committed
- [x] No large historical run executed on baseline

## Planned commands

Export command, executed with authorization:

```bash
npm run backtest:mlb -- --source fixture --start 2024-06-01 --end 2024-06-07 --research-construction both --export-json tmp/coverage/mlb_both_fixture_2024-06-01_2024-06-07_smoke01_export.json
```

Offline review command, executed after export:

```bash
npm run backtest:mlb -- --review-export-json tmp/coverage/mlb_both_fixture_2024-06-01_2024-06-07_smoke01_export.json
```

JSON review command, executed after export:

```bash
npm run backtest:mlb -- --output json --review-export-json tmp/coverage/mlb_both_fixture_2024-06-01_2024-06-07_smoke01_export.json
```

## Expected artifact names

| Artifact path | Artifact type | Construction | Date window | Created in Phase 2D | Commit by default | Notes |
|---|---|---|---|---|---|---|
| tmp/coverage/mlb_both_fixture_2024-06-01_2024-06-07_smoke01_export.json | export JSON | BOTH | 2024-06-01 to 2024-06-07 | yes | no | generated for observation, cleaned up after review |
| tmp/coverage/reviews/mlb_both_fixture_2024-06-01_2024-06-07_smoke01_review.txt | review text | BOTH | 2024-06-01 to 2024-06-07 | yes | no | generated for observation, cleaned up after review |
| tmp/coverage/reviews/mlb_both_fixture_2024-06-01_2024-06-07_smoke01_review.json | review JSON | BOTH | 2024-06-01 to 2024-06-07 | yes | no | generated for observation, cleaned up after review |
| tmp/coverage/logs/mlb_coverage_fixture_2024-06-01_2024-06-07_smoke01_run-log.md | coverage log | BOTH | 2024-06-01 to 2024-06-07 | no | yes | this file |

## Review expectations

- Files reviewed: 1
- Valid files: 1
- Invalid files: 0
- Requested dates: 7
- Predictions: 4
- Abstentions: 6
- Warnings: 16
- Thresholds used: none for initial smoke unless later authorized
- Threshold check result: passed
- JSON review produced: yes

## Construction coverage observations

- FULL prediction count: 1
- TEAM_ONLY prediction count: 3
- BOTH comparison included: yes
- FULL abstention count: 4
- TEAM_ONLY abstention count: 2
- Paired comparison notes: both produced=1, both abstained=2, full-only produced=0, team-only-only produced=2, same-side=1, different-side=0
- Evidence domains included: home-park, rest-travel, team-offense
- Evidence domains excluded: bullpen, injuries-lineup, offense-lineup, opponent-batting, starting-pitcher, weather-roof
- Pitcher evidence excluded from TEAM_ONLY: expected by design

## Warning and abstention notes

| Code | Count | Construction | First observed artifact | Notes | Follow-up needed |
|---|---|---|---|---|---|
| Away starting pitcher unavailable | observed in review | FULL/TEAM_ONLY/BOTH | tmp coverage export | expected for TEAM_ONLY gap | none |
| Feature coverage below abstention threshold | observed in review | FULL/TEAM_ONLY/BOTH | tmp coverage export | abstention trigger | none |
| Game postponed/suspended | observed in review | FULL/TEAM_ONLY/BOTH | tmp coverage export | known-ineligible game | none |
| STARTING_PITCHERS_UNAVAILABLE | observed in review | FULL/TEAM_ONLY/BOTH | tmp coverage export | leakage-safe abstention | none |
| TEAM_ONLY_RESEARCH | observed in review | TEAM_ONLY | tmp coverage export | expected comparison label | none |

| Abstention reason | Count | Construction | First observed artifact | Notes | Follow-up needed |
|---|---|---|---|---|---|
| Missing pitcher/timestamp | multiple | FULL | tmp coverage export | expected leakage-safe path | none |
| Feature coverage insufficient | multiple | FULL | tmp coverage export | expected abstention behavior | none |

## Leakage and data-quality checks

- [x] TEAM_ONLY excludes pitcher evidence by design
- [x] Actual starters used only as evaluation data
- [x] Schedule probable timestamp uncertainty reviewed
- [x] Historical completion provenance reviewed
- [x] No modelProbability field introduced
- [x] No unsupported source mode used
- [x] No live/API calls used
- [ ] Generated export not committed by default

## Export result

- Result: executed-pass
- Export command exit code: 0
- Export file created: yes
- Export file size: 15228 bytes
- Manifest exportId: historical-research-export-v1:0c28adfd31da
- Export version: historical-research-export-v1
- Construction mode: BOTH
- Source mode: fixture
- Manifest date range: 2024-06-01 to 2024-06-07

## Review result

- Text review pass/fail: pass
- JSON review pass/fail: pass
- Files reviewed: 1
- Valid files: 1
- Invalid files: 0
- Requested dates: 7
- Predictions: 4
- Abstentions: 6
- Warnings: 16
- Thresholds passed: true

## Decision

- Result: executed-pass
- Promote artifacts to fixtures: no
- Follow-up phase: Phase 2D cleanup complete; next phase optional larger coverage after authorization
- Summary: Phase 2D executed the tiny fixture/offline smoke run, observed the export and review result, recorded metadata, and cleaned up generated tmp artifacts.
- Risks found: none from this smoke run, subject to future insulation
- Next action: authorize a larger fixture-only coverage window after reviewing baseline behavior, if desired

## Sign-off

- Reviewer: Sam / pending
- Review date:
- Approved for next coverage window: no, expansion authorization still required