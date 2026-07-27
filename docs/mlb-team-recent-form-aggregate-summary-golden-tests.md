# MLB Team Recent Form Aggregate Summary Golden Tests

## Status

- Phase: 5H
- Scope: fixture-only exact stdout golden
- Golden fixture: `tests/prospective/fixtures/manual-schedule/valid-mlb-team-recent-form-research-aggregate-summaries-local-cli-output-v1.json`
- Default Phase 5B stdout golden: unchanged
- Phase 5E evidence-enabled stdout golden: unchanged
- Phase 5G aggregate implementation: unchanged
- File output: none
- Live/API/web/network schedule ingestion: none
- Historical fixture data: unchanged
- `modelProbability`: not present; remains null/absent/not available until calibrated
- Pitcher evidence: none
- Actual starters: none
- Prediction output: none

## Purpose

Locks exact aggregate-summary stdout regression coverage for `--fixture-evidence-local --aggregate-summaries-local`. It does not change the Phase 5E evidence-enabled stdout golden, the Phase 5B default golden, the Phase 5D provider behavior, or any research implementation.

## Golden fixture path

`tests/prospective/fixtures/manual-schedule/valid-mlb-team-recent-form-research-aggregate-summaries-local-cli-output-v1.json`

## What is locked

- Exact aggregate-enabled stdout JSON with a trailing newline.
- `fixtureEvidenceLocal: true`
- `aggregateSummariesLocal: true`
- Deterministic insufficient/zero-count aggregate behavior from current local fixtures.
- Exact construction package embedding and package identity fields.
- `awayAggregateSummary` and `homeAggregateSummary` on each TEAM_RECENT_FORM finding.
- Absence of result-derived, forbidden, absolute-path, and stack-trace content.

## Protected defaults

- Default Phase 5B stdout golden unchanged.
- Phase 5E evidence-enabled stdout golden unchanged.
- Phase 4 protected goldens unchanged.
- Historical fixture data and protected manual schedule construction fixtures unchanged.

## Safety boundary

- The golden fixture is deterministic static JSON only.
- It is not a generated prospective run artifact.
- It is not live MLB data.
- No real MLB API request or web lookup was used.
- Historical fixture inventory and files are unchanged.
- No dependencies or package files were changed.

## Validation

- inventory: 29 total games (June 17, July 12)
- default stdout golden byte-for-byte match
- evidence-enabled stdout golden byte-for-byte match
- aggregate stdout golden byte-for-byte match across repeated local loader runs
- focused research suite: 78 passed
- full Vitest: 971 passed
- TypeScript: passed
- build: passed
- git diff --check: passed

## Recommended next safe phase

Phase 5I — plan safe result-derived aggregate metrics.

State:
- planning-only;
- no implementation;
- no raw finalScore/outcome/completedGameState/finalStatus output;
- no modelProbability;
- no pitcher evidence;
- no actual starters;
- no file output;
- no live/API/web;
- no network schedule ingestion;
- no historical fixture data changes;
- preserve Phase 5B default goldens;
- preserve Phase 5E evidence-enabled golden;
- preserve aggregate stdout golden added in Phase 5H.
