# Historical Coverage Targeted Fixture Update Plan

Documentation-only plan.
No fixture data was added or modified.
No export was executed.
No live source used.
No real MLB API request made.
No generated artifacts committed.
No model-quality or predictive-performance claim.

## Purpose

Plan a safe, targeted fixture coverage update so fixture-only historical coverage can expand beyond the current June-only fixture surface.

## Trigger

Phase 2N found that large01 expanded requested dates from 30 to 61 while predictions, abstentions, and warnings stayed flat. Investigation showed this was expected because the fixture dataset contains 17 games, all in June 2024, with 0 July games.

## Current fixture surface

- fixture source file: `src/fixtures/backtesting/mlb/fixture-games.ts`
- fixture provider file: `src/lib/backtesting/mlb/historical-provider.ts`
- current fixture date range: 2024-06-01 through 2024-06-24
- total games in fixture: 17
- July games: 0
- `requestedDateCount` behavior: expands each calendar day in the requested date range, regardless of fixture contents
- predicted/abstained/warning counts: produced only by games the fixture provider discoveres for each requested date

Consequence: any requested window beyond 2024-06-24 can increase `requestedDateCount` without increasing fixture-discovered counts.

## Proposed next fixture target

Target label: `july-slice01`

- proposed date range: 2024-07-01 through 2024-07-07
- target games: small deterministic slice, not the full July month
- target effect: prove that fixture coverage changes can change discovered game counts and downstream predictions/abstentions/warnings
- source: manually curated fixture/test data only; never live/API fetched during execution

Rationale:

- 7 days is small enough to review carefully
- a small slice minimizes review surface while still testing July coverage behavior
- expanding the fixture dataset is preferred over widening the requested date range

## Fixture data addition principles

If a future implementation phase executes this plan, it must:

- add the smallest useful number of July fixture games
- keep fixture records deterministic and local
- include only fields needed by the fixture provider and backtesting runner
- do not use schedule probable retrospectively as prospective certainty
- keep actual starters evaluation-only
- avoid adding fields that imply unavailable evidence domains are available
- preserve TEAM_ONLY excluding pitcher evidence
- preserve evidence-domain safety language
- do not populate modelProbability
- avoid fixture bloat

## Data provenance plan

Future fixture additions must include explicit provenance notes. Each added fixture record should document:

- fixture slice label
- dates covered
- stable game identifiers
- source type
- fields included
- fields intentionally omitted
- safety notes
- reviewer/date

Provenance data must come from already known/static reference material only when explicitly approved. Do not call live/API during fixture addition. Do not use hidden or undocumented data sources.

Provenance note template:

```markdown
- fixture slice label:
- dates covered:
- game ids / stable identifiers:
- source type:
- fields included:
- fields intentionally omitted:
- safety notes:
- reviewer/date:
```

## Expected files to change in future implementation phase

Likely files:

- `src/fixtures/backtesting/mlb/fixture-games.ts` — add July games and related derived data
- `tests/backtesting/mlb-fixture.test.ts` — extend coverage to July fixtures
- `docs/historical-coverage-fixture-shape-investigation-large01.md` — update only if updating references is explicitly scoped
- new run log/comparison doc — only after execution phases

This planning phase changes docs only.

## Future implementation acceptance gates

Any future fixture data addition must pass all gates:

- git status clean before work
- fixture additions are deterministic and local
- no source=live
- no real MLB API request
- no generated artifacts committed
- fixture tests pass
- full validation pass
- fixture inventory confirms July games > 0
- existing June counts do not change unexpectedly unless explicitly intended
- TEAM_ONLY still excludes pitcher evidence
- modelProbability remains absent/null/not available
- no odds/market/betting language introduced

## Future diagnostic after fixture update

After a July slice is added, plan a fixture-only diagnostic:

- run a local fixture inventory command/test
- optionally execute a small fixture-only export over 2024-07-01 through 2024-07-07
- compare before/after counts
- record whether July fixture games now affect predictions/abstentions/warnings
- remove generated artifacts before final report

## Stop conditions

Halt planning or implementation if any of the following appear:

- live/API request attempted
- source=live appears in executable command
- fixture source is unclear or undocumented
- generated artifacts staged accidentally
- unexpected code/package/script changes
- fixture update changes unrelated June fixture behavior without explanation
- modelProbability populated
- TEAM_ONLY starts including pitcher evidence
- schedule probable timestamp safety weakened
- actual starters used prospectively
- forbidden odds/market/betting language appears

## Recommended next safe action

Advance to a documentation-only planning acceptance step, then to:

Phase 2P — implement targeted July fixture slice.

State that Phase 2P should add a small July fixture slice only if this plan is reviewed and accepted. State Phase 2P should remain local, deterministic, fixture-only, and non-live.

## Sign-off

- Reviewer: Sam / pending
- Review date:
- Approved for next coverage step: pending
