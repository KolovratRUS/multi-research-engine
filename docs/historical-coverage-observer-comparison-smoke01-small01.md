# Historical Coverage Observer Comparison — smoke01 vs small01

Phase 2F documentation-only comparison between two completed fixture-only observer notes.

This document compares the smoke01 and small01 runs. It does not prove model quality, does not recalibrate probabilities, does not introduce modelProbability, and does not create or commit generated export artifacts.

## Purpose

Compare two fixture-only observer notes after successful smoke01 and small01 runs.
- Source documents: smoke01 and small01 run logs
- Comparison type: documentation-only
- Result: comparison-complete
- Promote generated artifacts to fixtures: no
- Next action: choose the next fixture-only coverage step before any larger historical window
- Recommended next phase: Phase 2G — add a conservative fixture-only coverage comparison checklist

## Source documents

- docs/historical-coverage-run-log-smoke01.md
- docs/historical-coverage-run-log-small01.md

## Run comparison summary

| Metric | smoke01 | small01 | Change | Notes |
|---|---|---|---|---|
| Run type | smoke | small | +1 scale level | both are offline fixture-only observation runs |
| Date window | 2024-06-01 to 2024-06-07 | 2024-06-01 to 2024-06-14 | window doubled | same start, 7 additional days added |
| Requested dates | 7 | 14 | +7 | exact increase from smoke to small window |
| Predictions | 4 | 7 | +3 | counts increased with window size |
| Abstentions | 6 | 13 | +7 | counts increased with window size |
| Warnings | 16 | 31 | +15 | counts increased with window size |
| Comparison included | yes | true | none | BOTH construction kept for both runs |
| Export result | executed-pass | executed-pass | none | both exports succeeded |
| Review result | pass | pass | none | both text and JSON reviews passed |
| Threshold result | passed | none applied | none | smoke used threshold pass; small01 did not apply explicit thresholds |
| Generated artifacts committed | no | no | none | neither run committed generated exports or reviews |
| Prediction rate | 0.57 | 0.50 | -0.07 | predictions / requested dates |
| Abstention rate | 0.86 | 0.93 | +0.07 | abstentions / requested dates |
| Warning rate | 2.29 | 2.21 | -0.08 | warnings / requested dates |

## Evidence domain comparison

| Evidence domain | smoke01 status | small01 status | Observation |
|---|---|---|---|
| home-park | included | included | stable inclusion |
| rest-travel | included | included | stable inclusion |
| team-offense | included | included | stable inclusion |
| bullpen | excluded | excluded | stable exclusion |
| injuries-lineup | excluded | excluded | stable exclusion |
| offense-lineup | excluded | excluded | stable exclusion |
| opponent-batting | excluded | excluded | stable inclusion |
| starting-pitcher | excluded | excluded | stable exclusion |
| weather-roof | excluded | excluded | stable exclusion |

## Warning comparison

| Warning | smoke01 | small01 | Observation |
|---|---|---|---|
| Away starting pitcher unavailable | present | present | stable |
| Feature coverage below abstention threshold | present | present | stable; small01 adds specific 0.36 below 0.45 note |
| Game postponed/suspended | present | present | stable; small01 includes cancelled and suspended variants |
| Home starting pitcher unavailable | absent | present | new in small01 |
| Missing team/pitcher profile types | absent | present | broader data-quality note in small01 |
| STARTING_PITCHERS_UNAVAILABLE | present | present | stable leakage-safe abstention warning |
| TEAM_ONLY_RESEARCH | present | present | stable comparison-label warning |

## Coverage interpretation

- The expanded fixture-only window increased requested dates from 7 to 14.
- Predictions increased from 4 to 7.
- Abstentions increased from 6 to 13.
- Warnings increased from 16 to 31.
- Evidence domain inclusion/exclusion remained stable across both runs.
- Comparison mode remained included for both runs.
- Review validity stayed stable and passed for both runs.
- Generated artifacts remained uncommitted and were cleaned up after both runs.

Do not claim predictive quality.
Do not claim real-world model performance.
Do not mention betting/odds concepts.

## Leakage and safety interpretation

- [x] TEAM_ONLY pitcher evidence exclusion remained expected by design
- [x] No source=live command was used in either run
- [x] No real MLB API request was used in either run
- [x] Actual starters remain evaluation-only, not a prospective TEAM_ONLY input
- [x] No modelProbability field was introduced
- [x] No generated export/review artifacts were committed
- [x] No production TypeScript changed
- [x] No scorer or runner behavior changed

## Decision

- Result: comparison-complete
- Promote generated artifacts to fixtures: no
- Next action: choose the next fixture-only coverage step before any larger historical window
- Recommended next phase: Phase 2G — add a conservative fixture-only coverage comparison checklist
- Risks found: warning counts increased with window size, which is expected because more games expose more missing pitcher/profile data; feature coverage below threshold warnings remain present; starting pitcher availability warnings remain present. No concerns beyond expected fixture limitations.
- Summary: smoke01 and small01 show stable evidence domains, stable BOTH comparison behavior, and expected increases in abstentions and warnings with a larger fixture-only window. Predictions roughly doubled, abstentions roughly doubled, warnings roughly doubled. Review validity and cleanup behavior remain consistent. No production or behavior changes were introduced.

## Sign-off

- Reviewer: Sam / pending
- Review date:
- Approved for larger historical coverage window: no, not yet
