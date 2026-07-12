# Historical Coverage Fixture Inventory Reporting Polish Plan

Documentation-only plan.
No new fixture data added.
No fixture game records modified.
No code changes implemented.
No export executed.
No live source used.
No real MLB API request made.
No web lookup used.
No generated artifacts committed.
No model-quality or predictive-performance claim.

## Purpose

Phase 3B plans how to improve operator-facing fixture inventory output around the existing 29-game local fixture inventory before any implementation.

## Current baseline

- command: npm run inventory:mlb-fixtures
- total games: 29
- fixture range: 2024-06-01 through 2024-07-21
- June games: 17
- July games: 12
- July dates:
  2024-07-01, 2024-07-03, 2024-07-05, 2024-07-07, 2024-07-08, 2024-07-10, 2024-07-12, 2024-07-14, 2024-07-15, 2024-07-17, 2024-07-19, 2024-07-21

## Current reporting shape

Current script: scripts/mlb-fixture-inventory.ts

Output: single JSON object written to stdout.

Fields:
- startDate: string from getMLBFixtureDateRange
- endDate: string from getMLBFixtureDateRange
- totalGames: number, fixture.games.length
- gamesByMonth: Record<string, number>, counts keyed by YYYY-MM extracted from officialDate
- uniqueDateCount: number, count of unique officialDate values sorted ascending
- juneGameCount: number, count of officialDate values starting with 2024-06
- julyGameCount: number, count of julyDates
- julyDates: string[], unique July officialDate values sorted ascending

The inventory guard doc already shows example JSON output. No dedicated script test currently exists; tests/backtesting/mlb-fixture.test.ts guards fixture data shape and integrity rather than inventory output.

## Reporting polish objectives

- make month/date coverage easier to inspect
- make July slice coverage easier to read
- preserve machine-readable inventory output if it already exists
- keep existing tests stable unless intentionally updating expected output
- keep operator-facing wording focused on fixture coverage, not model quality
- avoid package/dependency changes
- avoid live/API/web usage

## Proposed reporting improvements

Possible future implementation items:
1. Add a clearer text summary section for humans.
2. Add explicit month summary table or lines.
3. Add explicit date coverage summary grouped by month.
4. Add optional slice-style grouping for known local July windows if this can be inferred safely from dates or documented as local convention.
5. Preserve existing JSON/object output if current tests depend on it.
6. Add or update tests around output shape.
7. Update docs showing how to read inventory output.

## Guardrails for implementation

- no new fixture records
- no fixture record modification
- no source=live
- no real MLB API request
- no web lookup
- no modelProbability
- no model-quality claim
- no dependency churn
- no generated artifacts staged
- current safety semantics unchanged

## Candidate future implementation scope

For a future Phase 3C, likely files:
- scripts/mlb-fixture-inventory.ts
- tests/backtesting/mlb-fixture.test.ts or a dedicated inventory script test if one exists or is warranted
- docs/historical-coverage-fixture-inventory-guard.md
- docs/historical-coverage-fixture-inventory-reporting-polish-implementation.md
- README.md
- docs/historical-dataset-coverage-plan.md
- package.json should not change unless absolutely required

## Acceptance criteria for future Phase 3C

- inventory command still passes
- output remains deterministic
- output still includes existing baseline fields
- month/date summaries are clear
- tests cover the reporting shape
- no fixture data changed
- validation passes
- safety searches pass
- no generated artifacts remain
- docs clearly say fixture counts are coverage/fixture-shape, not model quality

## Stop conditions

Halt if any of the following appear:
- reporting change requires source=live
- reporting change requires real MLB API or web lookup
- output wording suggests predictive quality
- modelProbability is populated or mixed with other metrics
- fixture data changes during reporting polish
- package/dependency churn appears
- generated artifacts remain staged
- TEAM_ONLY or schedule probable safety is touched unnecessarily

## Recommended implementation sequence

1. Inspect existing script and tests.
2. Add minimal deterministic reporting change.
3. Add/update focused tests.
4. Update inventory guard docs.
5. Run full validation.
6. Commit only after manual review.

## Recommended next safe phase

Phase 3C — implement fixture inventory reporting polish.
State that Phase 3C should be a small code/test/docs implementation with no fixture data changes.
