# Historical Coverage Run Log — small01

Phase 2E observer-note document for a fixture-only expanded small coverage run.

This document records execution metadata and review observations. It does not prove model quality and does not commit generated export artifacts.

## Purpose

Record a safe offline expanded fixture-only small coverage run.
- Run ID: small01
- Date created: 2026-07-05
- Operator: Sam
- Branch: main
- Commit SHA: 8e602fadcc8476a693d4fa8fcad339c0e6032aa4
- Dataset source: local fixture/offline data
- Source mode: fixture
- Sport: MLB
- Construction mode: BOTH
- Date window: 2024-06-01 to 2024-06-14
- Run type: small
- Purpose: expand fixture-only coverage observation beyond smoke01 before larger historical coverage windows

## Preflight checklist

- [x] Working tree clean before execution
- [x] Local HEAD recorded
- [x] Remote HEAD recorded
- [x] git diff --check passed
- [x] No source=live command planned
- [x] No real MLB API request planned
- [x] Output directory selected under ignored working path
- [x] Artifact naming follows docs/historical-coverage-artifact-naming.md
- [x] No generated export artifacts committed
- [x] No large historical run executed

## Commands

Export command, executed with authorization:

```bash
npm run backtest:mlb -- --source fixture --start 2024-06-01 --end 2024-06-14 --research-construction both --export-json tmp/coverage/mlb_both_fixture_2024-06-01_2024-06-14_small01_export.json
```

Offline review command, executed after export:

```bash
npm run backtest:mlb -- --review-export-json tmp/coverage/mlb_both_fixture_2024-06-01_2024-06-14_small01_export.json
```

JSON review command, executed after export:

```bash
npm run backtest:mlb -- --output json --review-export-json tmp/coverage/mlb_both_fixture_2024-06-01_2024-06-14_small01_export.json
```

## Expected artifact names

| Artifact path | Artifact type | Construction | Date window | Created in Phase 2E | Commit by default | Notes |
|---|---|---|---|---|---|---|
| tmp/coverage/mlb_both_fixture_2024-06-01_2024-06-14_small01_export.json | export JSON | BOTH | 2024-06-01 to 2024-06-14 | yes | no | generated for observation, cleaned up after review |
| tmp/coverage/reviews/mlb_both_fixture_2024-06-01_2024-06-14_small01_review.txt | review text | BOTH | 2024-06-01 to 2024-06-14 | yes | no | generated for observation, cleaned up after review |
| tmp/coverage/reviews/mlb_both_fixture_2024-06-01_2024-06-14_small01_review.json | review JSON | BOTH | 2024-06-01 to 2024-06-14 | yes | no | generated for observation, cleaned up after review |
| tmp/coverage/logs/mlb_coverage_fixture_2024-06-01_2024-06-14_small01_run-log.md | coverage log | BOTH | 2024-06-01 to 2024-06-14 | no | yes | this file |

## Export result

- Result: executed-pass
- Export command exit code: 0
- Export file created: yes
- Export file size: 27831 bytes
- Export version: historical-research-export-v1
- Manifest exportId: historical-research-export-v1:2b89e26b8f09
- Source: fixture
- Research construction: BOTH
- Manifest date range: 2024-06-01 to 2024-06-14
- Requested dates: 14
- Predictions: 7
- Abstentions: 13
- Warnings: 31
- Comparison included: true
- Evidence domains included: home-park, rest-travel, team-offense
- Evidence domains excluded: bullpen, injuries-lineup, offense-lineup, opponent-batting, starting-pitcher, weather-roof
- Warning summary: Away starting pitcher unavailable, Feature coverage 0.36 below abstention threshold 0.45, Game cancelled/suspended/postponed types, Home starting pitcher unavailable, Missing team/pitcher profile types, STARTING_PITCHERS_UNAVAILABLE, TEAM_ONLY_RESEARCH

## Review result

- Text review result: pass
- JSON review result: pass
- Text review exit code: 0
- JSON review exit code: 0
- Text review file size: 1119 bytes
- JSON review file size: 1592 bytes
- Review JSON parsed: yes
- Review version: historical-research-export-review-v1
- Valid: true
- Files reviewed: 1
- Valid files: 1
- Invalid files: 0
- Requested dates: 14
- Predictions: 7
- Abstentions: 13
- Warnings: 31
- Thresholds passed: none applied
- Evidence domains included: home-park, rest-travel, team-offense
- Evidence domains excluded: bullpen, injuries-lineup, offense-lineup, opponent-batting, starting-pitcher, weather-roof
- Warning summary: Away starting pitcher unavailable, Feature coverage 0.36 below abstention threshold 0.45, Game cancelled/suspended/postponed types, Home starting pitcher unavailable, Missing team/pitcher profile types, STARTING_PITCHERS_UNAVAILABLE, TEAM_ONLY_RESEARCH

## Construction coverage observations

- FULL prediction count: 2
- TEAM_ONLY prediction count: 5
- BOTH comparison included: yes
- FULL abstention count: 8
- TEAM_ONLY abstention count: 5
- Paired comparison notes: both produced=2, both abstained=5, full-only produced=0, team-only-only produced=3, same-side=2, different-side=0
- Evidence domains included: home-park, rest-travel, team-offense
- Evidence domains excluded: bullpen, injuries-lineup, offense-lineup, opponent-batting, starting-pitcher, weather-roof
- Pitcher evidence excluded from TEAM_ONLY: expected by design, not directly altered in Phase 2E

## Warning and abstention notes

| Code | Count | Construction | First observed artifact | Notes | Follow-up needed |
|---|---|---|---|---|---|
| Away starting pitcher unavailable | summary-only | FULL/TEAM_ONLY/BOTH | tmp coverage export | expected for TEAM_ONLY gap | none |
| Feature coverage below abstention threshold | summary-only | FULL/TEAM_ONLY/BOTH | tmp coverage export | abstention trigger | none |
| Game cancelled/suspended/postponed | summary-only | FULL/TEAM_ONLY/BOTH | tmp coverage export | known-ineligible game | none |
| Home starting pitcher unavailable | summary-only | FULL/TEAM_ONLY/BOTH | tmp coverage export | expected for TEAM_ONLY gap | none |
| Missing away/home team profile | summary-only | FULL/TEAM_ONLY/BOTH | tmp coverage export | missing data path | none |
| Missing home probable pitcher | summary-only | FULL/TEAM_ONLY/BOTH | tmp coverage export | missing data path | none |
| STARTING_PITCHERS_UNAVAILABLE | summary-only | FULL/TEAM_ONLY/BOTH | tmp coverage export | leakage-safe abstention | none |
| TEAM_ONLY_RESEARCH | summary-only | TEAM_ONLY | tmp coverage export | expected comparison label | none |

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
- [x] No generated export committed by default

## Decision

- Result: executed-pass
- Promote artifacts to fixtures: no
- Follow-up phase: Phase 2E cleanup complete; next phase optional larger coverage after authorization
- Summary: Phase 2E executed the expanded fixture/offline small coverage run, observed the export and review result, recorded metadata, and cleaned up generated tmp artifacts.
- Risks found: none from this small run, subject to future insulation
- Next action: authorize a larger fixture-only coverage window after reviewing baseline behavior, if desired

## Sign-off

- Reviewer: Sam / pending
- Review date:
- Approved for next coverage window: no, expansion authorization still required
