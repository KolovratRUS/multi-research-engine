# Historical Coverage Run Log Template

A copyable template for recording future offline historical coverage runs.

This is a template only. Do not fill it with fake run results. Use placeholders and checkboxes. Do not include generated exports in this file. Do not imply calibration or `modelProbability` is available. Do not include odds or betting-market language.

## Run identity

- Run ID:
- Date created:
- Operator:
- Branch:
- Commit SHA:
- Dataset source:
- Source mode: fixture
- Sport: MLB
- Construction mode: FULL / TEAM_ONLY / BOTH
- Date window:
- Run type: smoke / small / medium / season-segment
- Purpose:

## Preflight checklist

- [ ] Working tree clean on `main` at the expected commit.
- [ ] No staged or untracked production changes.
- [ ] No live MLB API access required for this run.
- [ ] No scorer, runner, FULL pitcher, or TEAM_ONLY behavior is being changed.
- [ ] Historical export JSON format, review JSON/text output, thresholds, and presets remain unchanged.
- [ ] No generated exports or debug artifacts already exist in the scratch root.
- [ ] Scratch root directories exist or are safe to create.

## Planned commands

Record the exact planned invocations for this run.

```bash
npm run backtest:mlb -- \
  --source fixture \
  --research-construction <FULL|TEAM_ONLY|BOTH> \
  --start <YYYY-MM-DD> \
  --end <YYYY-MM-DD> \
  --export-json <export path>
```

## Export artifacts produced

| # | Export path | Construction mode | Date range | Requested dates | Predictions | Abstentions | Warnings | Comparison |
|---|-------------|-------------------|------------|-----------------|-------------|-------------|----------|------------|
| 1 | | | | | | | | |
| 2 | | | | | | | | |

## Review summary

- Review command:
- Files reviewed:
- Valid files:
- Invalid files:
- Files with warnings:
- Threshold preset used:
- Threshold check result:
- Evidence domains included:
- Evidence domains excluded:
- Warnings observed:

## Construction coverage observations

- FULL predictions:
- FULL abstentions:
- TEAM_ONLY predictions:
- TEAM_ONLY abstentions:
- BOTH predictions:
- BOTH abstentions:
- Leakage-safety observations:
- Evidence-domain coverage gaps:
- Comparison report observations:

## Warning and abstention notes

| Warning code | Count | Affected mode | Notes |
|--------------|-------|---------------|-------|
| | | | |

| Abstention reason | Count | Affected mode | Notes |
|-------------------|-------|---------------|-------|
| | | | |

## Leakage and data-quality checks

- [ ] No schedule probable pitcher IDs were treated as pre-cutoff knowledge unless provenance is `SCHEDULE_PROBABLE_BEFORE_CUTOFF`.
- [ ] No raw schedule pitcher IDs were used to mark pitchers as available without provenance.
- [ ] Evidence domains are correctly included/excluded per construction mode.
- [ ] Comparison reports are present only for BOTH mode.
- [ ] Warning and abstention counts match manifest metadata.
- [ ] No `modelProbability`, implied probability, or calibrated-win-probability fields are present.
- [ ] No odds, sportsbook, betting-market, EV, ROI, edge, or line-movement concepts are present.

## Decision

- [ ] Review outputs are deterministic and repeatable.
- [ ] Manifest metadata is stable across repeated runs.
- [ ] Threshold presets pass on all generated exports.
- [ ] No leakage, API, or scoring-path changes were introduced.
- [ ] Findings are documented clearly enough for a later calibration or dataset-expansion phase.

## Sign-off

- Promote: yes / no
- Promotion target path:
- Reviewer:
- Sign-off notes:
