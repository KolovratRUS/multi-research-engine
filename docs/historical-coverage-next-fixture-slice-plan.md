# Historical Coverage Next Fixture Slice Plan

Documentation-only plan.
No new fixture data added.
No fixture game records modified.
No export executed.
No live source used.
No real MLB API request made.
No web lookup used.
No generated artifacts committed.
No model-quality or predictive-performance claim.

## Purpose

Plan the next deterministic fixture slice after july-slice01, using the inventory guard to prevent silent fixture coverage changes.

This is an operational/data-coverage planning document. It does not make model-quality or predictive-performance claims.

## Current guarded baseline

- command: npm run inventory:mlb-fixtures
- startDate: 2024-06-01
- endDate: 2024-07-07
- totalGames: 21
- gamesByMonth: 2024-06 = 17, 2024-07 = 4
- uniqueDateCount: 19
- June games: 17
- July games: 4
- July dates: 2024-07-01, 2024-07-03, 2024-07-05, 2024-07-07

## Why another planning step

Large date-window expansion alone does not create discovered game coverage. Fixture-discovered counts are controlled by fixture game records, not by calendar span alone. Future expansion should be small, deterministic, reviewed, and guarded by inventory output. This is not a model-quality claim.

## Proposed next fixture target

Target label: july-slice02
Proposed date range: 2024-07-08 through 2024-07-14
Target game count: small deterministic slice, preferably 3 to 5 games
Target purpose: extend July fixture surface beyond 2024-07-07 and verify inventory guard captures the change
Source: deterministic local fixture/test data only, manually curated from approved static material if explicitly approved in a future implementation phase
No live/API/web data

## Required pre-implementation gates

Before any future fixture data change:

- git status clean
- inventory guard passes before change
- current baseline recorded before change
- future fixture data provenance approved before adding data
- no source=live
- no real MLB API request
- no web lookup
- no generated artifacts staged
- no fixture records added without provenance notes
- modelProbability remains absent/null/not available
- TEAM_ONLY continues excluding pitcher evidence
- actual starters remain evaluation-only
- schedule probable timestamp safety remains unchanged

## Future implementation scope

If approved, the likely Phase 2T files are:

- src/fixtures/backtesting/mlb/fixture-games.ts
- tests/backtesting/mlb-fixture.test.ts
- docs/historical-coverage-july-slice02-implementation.md
- README.md
- docs/historical-dataset-coverage-plan.md
- possibly docs/historical-coverage-fixture-inventory-guard.md if expected inventory output changes intentionally
- package.json should not change unless required

## Future inventory expectations

After adding july-slice02 in Phase 2T, explicit documentation should record:

- totalGames should increase by the number of added games
- June games should remain 17 unless intentionally changed
- July games should increase from 4 by the number of added games
- endDate should extend to the latest added July date
- July dates should include existing july-slice01 dates plus new july-slice02 dates

Do not invent final counts now beyond the planned target range/count.

## Future diagnostic plan

In Phase 2T, after adding the slice:

- run npm run inventory:mlb-fixtures before and after
- run focused fixture tests
- optionally run tiny fixture-only export/review for 2024-07-08 through 2024-07-14
- remove generated artifacts
- document discovered games/predictions/abstentions/warnings only as fixture-diagnostic counts, not model quality

## Stop conditions

Halt planning or implementation if any of the following appear:

- fixture data requires live/API/web lookup
- source=live appears in executable command
- provenance is unclear
- fixture inventory does not match expected baseline before implementation
- package-lock or dependency changes appear
- generated artifacts remain
- TEAM_ONLY includes pitcher evidence
- modelProbability is populated
- schedule probable timestamp safety weakens
- actual starters used prospectively
- forbidden odds/market/betting language appears

## Recommended next safe phase

Phase 2T — implement july-slice02 only after this plan is committed.

State that Phase 2T should remain deterministic, local-only, fixture-only, and non-live. No live/API/web/data additions. No odds/market/betting language. No modelProbability population.