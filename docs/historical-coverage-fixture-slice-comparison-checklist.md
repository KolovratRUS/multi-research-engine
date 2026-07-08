# Historical Coverage Fixture Slice Comparison Checklist

Documentation/checklist guard.
No new fixture data added.
No fixture game records modified.
No export executed.
No live source used.
No real MLB API request made.
No web lookup used.
No generated artifacts committed.
No model-quality or predictive-performance claim.

## Purpose

Standardize how future deterministic fixture slices are reviewed and compared before adding more fixture data.
Use this checklist for every fixture-slice comparison phase.
It does not add fixture data itself.

## Current inventory baseline

- command: `npm run inventory:mlb-fixtures`
- total games: 25
- fixture range: 2024-06-01 through 2024-07-14
- June games: 17
- July games: 8
- July dates: 2024-07-01, 2024-07-03, 2024-07-05, 2024-07-07, 2024-07-08, 2024-07-10, 2024-07-12, 2024-07-14

## Required comparison inputs

For every future fixture slice comparison, record:

- slice label
- date range
- number of fixture games
- exact fixture dates
- pre-change inventory output
- post-change inventory output
- discovered games
- predictions
- abstentions
- known-ineligible games
- warnings
- comparisonIncluded
- included evidence domains
- excluded evidence domains
- artifact cleanup confirmation
- validation command results
- safety search results

## Checklist before running a comparison

- [ ] git status clean
- [ ] inventory guard matches expected baseline
- [ ] no fixture data changes during comparison-only phase
- [ ] source remains fixture
- [ ] no source=live requested or authorized
- [ ] no real MLB API request
- [ ] no web lookup
- [ ] no package/dependency changes
- [ ] no generated artifacts staged

## Checklist while running fixture-only diagnostics

- [ ] use source fixture only
- [ ] use small date windows matching slice boundaries
- [ ] use research-construction both unless explicitly comparing construction modes
- [ ] capture concise counts only
- [ ] do not interpret counts as model quality
- [ ] remove generated artifacts before final report

## Checklist for documentation

- [ ] document source documents
- [ ] document inventory baseline
- [ ] document slice table
- [ ] document diagnostic counts
- [ ] document evidence included/excluded
- [ ] document artifact cleanup
- [ ] state no model-quality claim
- [ ] state no live/API authorization

## Checklist after comparison

- [ ] rerun inventory guard
- [ ] run full validation
- [ ] run safety searches
- [ ] confirm no fixture records changed
- [ ] confirm no generated artifacts remain
- [ ] commit only docs/checklist/test changes after manual review

## Standard comparison table template

| slice label | date range | fixture games | dates | discovered games | predictions | abstentions | known-ineligible games | warnings | review status |
|---|---|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |

## Safety boundaries

- source=live is not allowed
- real MLB API requests are not allowed
- web lookup is not allowed
- modelProbability remains absent/null/not available until calibrated
- TEAM_ONLY excludes pitcher evidence
- actual starters remain evaluation-only
- schedule probable timestamp safety remains unchanged
- historical schedule probable must not be retrospectively promoted
- no model-quality or predictive-performance claim
- no live/API authorization

## Existing test guard

The current fixture inventory baseline is already guarded in `tests/backtesting/mlb-fixture.test.ts`.
Add future slice assertions there.
Do not duplicate coverage.

## Recommended next safe phase

Phase 2W — plan next deterministic fixture slice with this checklist.
Keep it planning-only unless explicitly asked to implement.
