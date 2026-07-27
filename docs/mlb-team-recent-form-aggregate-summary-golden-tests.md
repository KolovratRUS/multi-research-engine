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

Phase 5H locks the exact stdout for the Phase 5G aggregate-summary mode. This is a regression fixture only. It uses the existing manual-schedule construction fixture, the local fixture evidence provider, and the explicit `--aggregate-summaries-local` mode to produce a deterministic aggregate-enabled stdout snapshot.

This phase does not add implementation, file output, or new research behavior.

## What is locked

- Exact aggregate-enabled stdout JSON with a trailing newline.
- `fixtureEvidenceLocal: true`
- `aggregateSummariesLocal: true`
- Deterministic insufficient/zero-count aggregate behavior from current local fixtures.
- Exact construction package embedding and package identity fields.
- `awayAggregateSummary` and `homeAggregateSummary` on each TEAM_RECENT_FORM finding.
- Absence of result-derived, forbidden, absolute-path, and stack-trace content.
- Current deterministic warning set:
  - `TEAM_FORM_EVIDENCE_FUTURE_GAME_EXCLUDED`
  - `TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES`
  - `TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION`

Do not force this exact warning set if implementation behavior changes deterministically. Capture the current implementation output as the golden.

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

- planning-only
- no implementation
- no raw finalScore/outcome output
- no modelProbability
- no pitcher evidence
- no actual starters
- no file output
- no live/API/web
- no network schedule ingestion
- no historical fixture data changes
