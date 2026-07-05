# Historical Export Review

This page documents the offline review workflow for saved historical research export files.

## Purpose

Historical exports are stable offline audit artifacts. They capture a research run's manifest, predictions, abstentions, warnings, evidence domains, and optional comparison report without calling MLB APIs.

Review mode only reads saved export JSON. It does not make network requests, does not construct live providers, and does not change research outputs.

## Creating a historical export

Use `--export-json` with an existing backtest run to write an export file.

```bash
# FULL research export, single date
npm run backtest:mlb -- --source cached --date 2024-06-01 --research-construction full --export-json tmp/full-export.json

# BOTH research export, date range
npm run backtest:mlb -- --source cached --start 2024-06-01 --end 2024-06-03 --research-construction both --export-json tmp/both-export.json
```

Treat exported files as stable audit artifacts. Do not edit them by hand.

## Reviewing one export offline

```bash
npm run backtest:mlb -- --review-export-json tmp/full-export.json
```

Output includes manifest validation, counts, construction mode, evidence domains, warnings, and any validation issues.

Text mode is default. Use `--output json` for machine-readable output.

## Reviewing multiple exports offline

```bash
npm run backtest:mlb -- --review-export-json tmp/full-export.json --review-export-json tmp/team-only-export.json
```

Batch review prints an aggregate summary and per-file results. Order is preserved from left to right.

## Directory threshold flags

```bash
npm run backtest:mlb -- \
  --review-export-json tmp/full-export.json \
  --review-export-json tmp/team-only-export.json \
  --min-valid-files 2 \
  --max-invalid-files 0 \
  --min-total-predictions 2 \
  --max-total-abstentions 0 \
  --max-total-warnings 5 \
  --require-construction BOTH \
  --require-evidence-domain team-offense \
  --forbid-warning PITCHER_EVIDENCE_EXCLUDED
```

Threshold flags are only valid in combination with `--review-export-json`.

## Threshold preset files

Preset files let teams reuse threshold sets in CI without repeating long CLI arguments.

```bash
npm run backtest:mlb -- \
  --review-export-json tmp/full-export.json \
  --review-export-json tmp/team-only-export.json \
  --review-thresholds-json tests/backtesting/fixtures/historical-research-threshold-presets/passing-ci-thresholds-v1.json
```

Preset shape:

```json
{
  "thresholdVersion": "historical-research-export-thresholds-v1",
  "minValidFiles": 2,
  "maxInvalidFiles": 0,
  "minTotalPredictions": 2,
  "maxTotalAbstentions": 0,
  "maxTotalWarnings": 2,
  "requireConstructions": ["FULL", "TEAM_ONLY"],
  "requireEvidenceDomains": ["team-offense"],
  "forbidWarnings": ["unexpected-warning"]
}
```

Rules:

- Presets are offline JSON only.
- Presets are valid only with `--review-export-json`.
- Presets cannot be combined with direct threshold flags.
- `thresholdVersion` must equal `historical-research-export-thresholds-v1`.
- Numeric thresholds are non-negative integers.
- Array thresholds are non-empty strings.

## Package aliases

| script | purpose |
|------|------|
| `npm run review:historical-export:full` | Review the committed golden FULL export fixture |
| `npm run review:historical-export:batch` | Review the committed golden FULL and TEAM_ONLY export fixtures |
| `npm run review:historical-export:ci` | Review FULL + TEAM_ONLY fixtures with the committed passing CI preset |
| `npm run review:historical-export:ci:json` | Same as CI mode, but emits JSON |

All package aliases are offline review commands against committed fixture paths. They do not write files and do not use `source=live`.

## CI behavior

Exit codes:

- `0` when all reviewed exports are valid and threshold checks pass.
- `1` when any export is invalid, unreadable, unparsable, or fails threshold checks.
- `1` when the preset file is missing, malformed, or contains an unsupported version.

JSON output includes `valid`, `thresholdsPassed`, and `thresholdIssues` when thresholds are active. Text output includes a `Threshold Checks:` section.

## Safety and leakage notes

- Review mode reads saved export files only.
- Review mode does not call MLB APIs.
- Review mode does not construct live providers.
- `modelProbability` remains absent or `null` until calibrated.
- TEAM_ONLY excludes pitcher evidence and uses team-only scoring.
- FULL and TEAM_ONLY are separate construction modes.
- Actual starters remain evaluation-only and do not introduce betting concepts.
- No odds, sportsbook, betting-market, EV, ROI, edge, implied probability, favorite/underdog, line movement, public betting, market movement, or betting value concepts are used in outputs.
