# Historical Coverage Next Fixture Slice Plan — july-slice03

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

Plan the next deterministic fixture slice after july-slice02, using the fixture inventory guard and the Phase 2V fixture-slice comparison checklist before any implementation.
This is an operational/data-coverage planning document. It does not make model-quality or predictive-performance claims.

## Current guarded baseline

- command: `npm run inventory:mlb-fixtures`
- startDate: 2024-06-01
- endDate: 2024-07-14
- totalGames: 25
- gamesByMonth: 2024-06 = 17, 2024-07 = 8
- June games: 17
- July games: 8
- July dates: 2024-07-01, 2024-07-03, 2024-07-05, 2024-07-07, 2024-07-08, 2024-07-10, 2024-07-12, 2024-07-14

## Checklist reference

Use `docs/historical-coverage-fixture-slice-comparison-checklist.md` before, during, and after any comparison or implementation.
The checklist makes safety, artifact handling, and evidence-domain review explicit.
This plan does not replace that checklist.

## Proposed next fixture target

- target label: july-slice03
- proposed date range: 2024-07-15 through 2024-07-21
- target game count: small deterministic slice, preferably 3 to 5 games
- target purpose: extend July fixture surface beyond 2024-07-14 and verify inventory guard captures the change
- source: deterministic local fixture/test data only, manually curated from approved static material if explicitly approved in a future implementation phase
- no live/API/web data

## Why planning first

Future expansion should remain small and checklist-driven.
The inventory guard should make every fixture coverage change visible before implementation.
Fixture-diagnostic counts should not be interpreted as model-quality claims.
Broad historical dataset claims are not supported by this fixture-only work.
This plan does not authorize live/API usage.

## Required pre-implementation gates

Before any future fixture data change:

- git status clean
- inventory guard passes before change
- Phase 2V checklist reviewed
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

If approved, the likely Phase 2X files are:

- `src/fixtures/backtesting/mlb/fixture-games.ts`
- `tests/backtesting/mlb-fixture.test.ts`
- `docs/historical-coverage-july-slice03-implementation.md`
- `docs/historical-coverage-fixture-inventory-guard.md`
- `README.md`
- `docs/historical-dataset-coverage-plan.md`
- `package.json` should not change unless required

## Future inventory expectations

After adding july-slice03 in Phase 2X, explicit documentation should record:

- totalGames should increase by the number of added games
- June games should remain 17 unless intentionally changed
- July games should increase from 8 by the number of added games
- endDate should extend to the latest added July date
- July dates should include existing dates plus new july-slice03 dates

Do not invent final counts now beyond the planned target range/count.

## Future diagnostic plan

In Phase 2X, after adding the slice:

- run `npm run inventory:mlb-fixtures` before and after
- run focused fixture tests
- optionally run tiny fixture-only export/review for 2024-07-15 through 2024-07-21
- remove generated artifacts
- document discovered games/predictions/abstentions/warnings only as fixture-diagnostic counts, not model quality
- then run a documentation-only comparison phase using the Phase 2V checklist

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

Phase 2X — implement july-slice03 using the fixture-slice checklist.
State that Phase 2X should remain deterministic, local-only, fixture-only, and non-live.
