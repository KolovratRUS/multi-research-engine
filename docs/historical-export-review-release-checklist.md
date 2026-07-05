# Historical Export Review Release Checklist

Use this checklist to verify the offline historical export/review subsystem before a release, CI promotion, or broader roadmap work.

## Purpose

The historical export review subsystem covers export generation, manifest metadata, review validation, batch aggregation, threshold flags, threshold presets, package aliases, and documentation.

This checklist captures the non-production validation gates that prove the subsystem is deterministic, offline, leakage-safe, and behaviorally stable.

## Release scope

- historical export JSON generation
- export manifests
- manifest validation
- golden export fixtures
- single-file review
- JSON review output
- batch review
- aggregate summaries
- threshold flags
- threshold preset files
- package aliases
- documentation

## Hard safety rules

- Do not run `source=live` for this release checklist.
- Do not make real MLB API requests.
- Review mode must read saved local export files only.
- No scorer or runner behavior should change during release validation.
- FULL and TEAM_ONLY behavior must remain separate.
- TEAM_ONLY must exclude pitcher evidence.
- Actual starters remain evaluation-only.
- `modelProbability` remains absent or `null` until calibrated.
- No odds, sportsbook, betting-market, EV, ROI, edge, implied probability, favorite/underdog, line movement, public betting, market movement, or betting value concepts are used.

## Git preflight

```bash
git status --short
git rev-parse HEAD
git ls-remote origin refs/heads/main
git diff --check
```

- working tree clean
- local HEAD equals remote main
- no lockfile changes
- no environment file changes
- no debug artifacts
- no unexpected production code changes

## Repo/state checklist

- [ ] Current HEAD matches the expected release base.
- [ ] Only intended Phase 1 files are modified or untracked.
- [ ] No debug files are present.
- [ ] No credentials or secrets are present.
- [ ] docs/, package.json, and README.md are the only touched top-level artifacts for this phase.

## Export fixture integrity

- [ ] `tests/backtesting/fixtures/historical-research-export/full-export-v1.json` parses successfully.
- [ ] `tests/backtesting/fixtures/historical-research-export/team-only-export-v1.json` parses successfully.
- [ ] `tests/backtesting/fixtures/historical-research-export/both-export-v1.json` parses successfully.
- [ ] `tests/backtesting/fixtures/historical-research-export/abstention-export-v1.json` parses successfully.
- [ ] No fixture contains `modelProbability`.
- [ ] No fixture contains betting/odds/market concepts.
- [ ] FULL fixture manifest `comparisonIncluded` is `false`.
- [ ] BOTH fixture manifest `comparisonIncluded` is `true`.
- [ ] TEAM_ONLY fixture manifest `evidenceDomainSummary` does not include pitcher domains.

## Review fixture integrity

- [ ] `tests/backtesting/fixtures/historical-research-review/full-review-v1.txt` matches current review text output.
- [ ] `tests/backtesting/fixtures/historical-research-review/team-only-review-v1.txt` matches current review text output.
- [ ] `tests/backtesting/fixtures/historical-research-review/both-review-v1.txt` matches current review text output.
- [ ] `tests/backtesting/fixtures/historical-research-review/abstention-review-v1.txt` matches current review text output.
- [ ] `tests/backtesting/fixtures/historical-research-review/full-review-v1.json` matches current review JSON output.
- [ ] `tests/backtesting/fixtures/historical-research-review/team-only-review-v1.json` matches current review JSON output.
- [ ] `tests/backtesting/fixtures/historical-research-review/both-review-v1.json` matches current review JSON output.
- [ ] `tests/backtesting/fixtures/historical-research-review/abstention-review-v1.json` matches current review JSON output.
- [ ] Invalid-manifest review stderr fixture remains stable if present.

## Single-file review behavior

- [ ] `npm run review:historical-export:full` exits 0.
- [ ] Single-file text output includes manifest validation, counts, construction, evidence domains, warnings, and issues.
- [ ] Single-file JSON output includes `manifest`, `valid`, and `issues` only; no raw predictions.
- [ ] Empty/missing/invalid export paths exit 1 with deterministic stderr.
- [ ] `--review-export-json` rejects `--source live`.
- [ ] `--review-export-json` rejects backtest options like `--date`, `--research-construction`.
- [ ] `--review-export-json` rejects `--export-json`.

## Batch review behavior

- [ ] `npm run review:historical-export:batch` exits 0.
- [ ] Batch text output prints aggregate summary and per-file review results.
- [ ] Batch JSON output aggregates `filesReviewed`, `validFiles`, `invalidFiles`, prediction/abstention/warning totals, construction counts, evidence domain summary, warning summary, and ordered reviews.
- [ ] Batch order preserves input order.
- [ ] Invalid files are excluded from aggregates and do not abort batch review.

## Aggregate summary behavior

- [ ] Aggregate helper dedupes evidence domains by first-seen order.
- [ ] Aggregate helper dedupes warning summaries by first-seen order.
- [ ] Aggregate helper excludes invalid items from totals.
- [ ] Aggregate helper preserves fixed construction count ordering.

## Threshold flag behavior

- [ ] Threshold flags are rejected without `--review-export-json`.
- [ ] Threshold flags cannot combine with `--review-thresholds-json`.
- [ ] `--min-valid-files` accepts non-negative integers and rejects invalid strings/negatives.
- [ ] `--max-invalid-files` accepts non-negative integers and rejects invalid strings/negatives.
- [ ] `--min-total-predictions` accepts non-negative integers and rejects invalid strings/negatives.
- [ ] `--max-total-abstentions` accepts non-negative integers and rejects invalid strings/negatives.
- [ ] `--max-total-warnings` accepts non-negative integers and rejects invalid strings/negatives.
- [ ] `--require-construction` accepts multiple values.
- [ ] `--require-evidence-domain` accepts multiple values.
- [ ] `--forbid-warning` accepts multiple values.
- [ ] Failing thresholds exit 1 with deterministic issue codes.
- [ ] Passing thresholds include `Threshold Checks: passed` in text and `thresholdsPassed: true` in JSON.
- [ ] No threshold behavior changes scorer, runner, export, or review output formats.

## Threshold preset behavior

- [ ] `tests/backtesting/fixtures/historical-research-threshold-presets/passing-ci-thresholds-v1.json` parses successfully.
- [ ] Preset mode is rejected without `--review-export-json`.
- [ ] Preset mode cannot combine with direct threshold flags.
- [ ] Preset validation rejects missing version, unsupported version, unknown fields, invalid integers, invalid construction arrays, and invalid string arrays.
- [ ] Valid failing presets exit 1 with deterministic threshold issues.
- [ ] Preset validation does not change threshold evaluation behavior.
- [ ] Preset file is offline JSON only.

## CI alias behavior

- [ ] `npm run review:historical-export:full` exits 0.
- [ ] `npm run review:historical-export:batch` exits 0.
- [ ] `npm run review:historical-export:ci` exits 0 and reports threshold checks passed.
- [ ] `npm run review:historical-export:ci:json` exits 0 and outputs valid JSON.
- [ ] `npm run review:historical-export:release-check` exits 0 and runs the four aliases sequentially.
- [ ] Package aliases use committed relative fixture paths only.
- [ ] Package aliases are offline review only and do not write files.

## Golden fixture behavior

- [ ] `--export-json` golden smoke tests still match committed export fixtures exactly.
- [ ] Review golden smoke tests still match committed review fixtures exactly.
- [ ] CLI golden smoke behavior is unchanged.

## TypeScript/build/test gate

- [ ] `npx tsc --noEmit --incremental false --pretty false` exits 0.
- [ ] `npm test` exits 0.
- [ ] `npm run build` exits 0.

## Safety search

Run over every changed file in this phase:

```bash
grep -nE \
"as any|as unknown as|@ts-ignore|@ts-expect-error|debugger|console\.log|console\.error|eslint-disable|\.only\(|\.skip\(|TODO|FIXME|!;" \
<changed files> || true
```

- [ ] zero unsafe matches

## Forbidden-concept search

Run over every changed file in this phase:

```bash
grep -nEi \
"odds|sportsbook|implied probability|expected value|EV|ROI|edge|favorite|underdog|line movement|public betting|market|betting value|modelProbability" \
<changed files> || true
```

Allowed matches only if they are explicit documentation stating a concept is not used, validation references, or preexisting safe README text outside this phase.

- [ ] zero forbidden-concept matches

## Leakage-safety requirements

- [ ] TEAM_ONLY path does not use pitcher groups.
- [ ] Schedule probable pitcher IDs do not bypass leakage guards without trusted pre-cutoff timestamps.
- [ ] `SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN` leads to abstention, not leakage.
- [ ] No feature weight or evidence domain path infers odds, market pricing, or betting value.

## Release notes/version readiness

- [ ] Release notes mention the offline review subsystem.
- [ ] README has a concise historical export review section and link to docs.
- [ ] docs/historical-export-review.md documents:
  - how to create exports
  - how to review single/batch exports
  - JSON output mode
  - threshold flags
  - threshold presets
  - package aliases
  - CI exit codes
  - offline safety
  - leakage-safety notes
- [ ] docs/historical-export-review-release-checklist.md is linked from either README.md or docs/historical-export-review.md.
- [ ] Committed fixtures are deterministic and do not include machine-specific paths.
- [ ] No future-phase artifacts are exposed as active functionality in docs.
