# Historical Coverage Artifact Naming

Purpose:

Establish a stable naming convention for coverage-run artifacts so they can be scanned, compared, reviewed, and archived without ambiguity.

This phase defines names only. It does not generate classes, scripts, or build artifacts.

## Artifact types

- export JSON: the committed or scratch historical research export file written by `--export-json`
- review text: offline manifest/review text output for one export
- review JSON: offline manifest/review JSON output for one export or batch
- batch manifest: aggregate batch review manifest output for repeated exports
- threshold preset: reusable offline threshold JSON used with `--review-thresholds-json`
- coverage log: run log filled from `docs/historical-coverage-run-log-template.md`
- notes: short markdown summary of findings and promotion readiness

## Naming convention

Use lowercase ASCII characters only.
Separate segments with underscores.
Do not use spaces, commas, vendor names, or machine-specific paths in artifact names.
Keep names informative but short enough for filesystems and shell scripting.

## Export JSON naming

Pattern:

mlb_<construction>_<source>_<start-date>_<end-date>_<run-id>_export.json

Segments:

- construction: full / team-only / both
- source: fixture
- start-date: YYYY-MM-DD
- end-date: YYYY-MM-DD
- run-id: stable short identifier such as smoke01 / small01 / medium01 / first-half01

Examples:

mlb_full_fixture_2024-06-01_2024-06-07_smoke01_export.json
mlb_team-only_fixture_2024-06-01_2024-06-07_smoke01_export.json
mlb_both_fixture_2024-06-01_2024-06-07_smoke01_export.json
mlb_full_fixture_2024-03-01_2024-06-30_medium01_export.json

## Review naming

Pattern:

mlb_<construction-or-batch>_<source>_<start-date>_<end-date>_<run-id>_review.txt

Pattern:

mlb_<construction-or-batch>_<source>_<start-date>_<end-date>_<run-id>_review.json

Segments:

- construction-or-batch: full / team-only / both / batch
- source: fixture
- start-date: YYYY-MM-DD
- end-date: YYYY-MM-DD
- run-id: stable short identifier such as smoke01 / small01 / medium01 / first-half01

Examples:

mlb_full_fixture_2024-06-01_2024-06-07_smoke01_review.txt
mlb_team-only_fixture_2024-06-01_2024-06-07_smoke01_review.txt
mlb_both_fixture_2024-06-01_2024-06-07_smoke01_review.txt
mlb_batch_fixture_2024-06-01_2024-06-07_smoke01_review.json

## Batch review naming

Pattern:

batch_review_<mode>_<run-type>_<descriptor>.json

Segments:

- mode: single or batch
- run-type: smoke / small / medium / season-segment
- descriptor: optional readable qualifier, for example full-vs-team-only

Examples:

batch_review_batch_small_full-vs-team-only.json

## Threshold preset naming

Pattern:

coverage_thresholds_<run-type>_<descriptor>.json

Examples:

coverage_thresholds_smoke_ci.json
coverage_thresholds_small_strict.json

Use committed threshold preset files only.
Threshold presets must not be inferred from run output.
Tighten presets only after inspecting deterministic run results.

## Coverage log naming

Pattern:

coverage_log_<run-id>_<date-created>.md

Segments:

- run-id: stable short identifier from the run log template
- date-created: YYYY-MM-DD

Example:

coverage_log_smoke01_2024-06-05.md

Do not name logs with machine-specific paths.

## Notes naming

Pattern:

notes_<coverage-log-stem>.md

Examples:

notes_coverage_log_smoke01_2024-06-05.md

## Directory layout recommendation

Keep all Phase 2 artifacts outside version control unless promotion is approved.

Recommended scratch roots:

- exports: tmp/coverage/
- reviews: tmp/coverage/review/
- batch manifests: tmp/coverage/batch/
- logs and notes: tmp/coverage/logs/

Examples:

tmp/coverage/mlb_full_fixture_2024-06-01_2024-06-07_smoke01_export.json
tmp/coverage/review/mlb_full_fixture_2024-06-01_2024-06-07_smoke01_review.txt
tmp/coverage/batch/mlb_batch_fixture_2024-06-01_2024-06-07_smoke01_review.json
tmp/coverage/logs/coverage_log_smoke01_2024-06-05.md
tmp/coverage/logs/notes_coverage_log_smoke01_2024-06-05.md

Do not add these paths to version control without explicit promotion authorization.

## Promoted artifact naming

If a coverage-run artifact is promoted into version control, add a promoted- prefix and move it under tests/backtesting/fixtures/ or docs/ with explicit review.

Patterns:

promoted_export_<sport>_<construction>_<window>.json
promoted_review_<sport>_<construction>_<start-date>_<end-date>_<run-id>_review.json
promoted_thresholds_<run-type>_<descriptor>.json

Promotion requires:

- manifest review passes
- deterministic re-run passes on clean working tree
- no leakage, API, or scorer/runner changes introduced
- explicit authorization

## Forbidden names and patterns

Do not use:

- absolute machine paths
- bookmaker, odds, betting, market, or EV language
- calibrated probability suffixes such as calibrated, prob, implied, or edge
- generated node_modules, .cache, .next, or build artifacts
- modelProbability or calibration claims in file names
- live, api, network, or web source terminology in export names

## Validation checklist

- [ ] Every artifact name follows the lowercase-underscore convention
- [ ] Export names include construction, source, date range, and run id
- [ ] Review names follow the `mlb_<construction-or-batch>_<source>_<start-date>_<end-date>_<run-id>_review.txt/json` pattern
- [ ] Batch names include mode, run type, and optional descriptor
- [ ] Threshold presets live in a scratch or approved fixtures directory only
- [ ] Logs and notes are stored under the same scratch root as exports
- [ ] No promoted artifact was added without explicit authorization
- [ ] No forbidden term appears in any artifact name
