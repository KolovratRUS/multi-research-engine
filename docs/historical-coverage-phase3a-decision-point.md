# Historical Coverage Phase 3A Decision Point

Documentation-only planning decision.
No new fixture data added.
No fixture game records modified.
No export executed.
No live source used.
No real MLB API request made.
No web lookup used.
No generated artifacts committed.
No model-quality or predictive-performance claim.

## Purpose

Phase 3A reviews the completed Phase 2 fixture coverage work and chooses the next safe branch before any more implementation.

## Current baseline

- command: npm run inventory:mlb-fixtures
- total games: 29
- fixture range: 2024-06-01 through 2024-07-21
- June games: 17
- July games: 12
- July dates:
  2024-07-01, 2024-07-03, 2024-07-05, 2024-07-07, 2024-07-08, 2024-07-10, 2024-07-12, 2024-07-14, 2024-07-15, 2024-07-17, 2024-07-19, 2024-07-21

## Phase 2 completed assets

Coverage plans and checklists:
- docs/historical-dataset-coverage-plan.md
- docs/historical-coverage-fixture-slice-comparison-checklist.md
- docs/historical-coverage-fixture-inventory-guard.md
- docs/historical-coverage-next-fixture-slice-plan.md
- docs/historical-coverage-next-fixture-slice-plan-02.md
- docs/historical-export-review-release-checklist.md
- docs/historical-export-review-rollout.md

July fixture slice implementations:
- docs/historical-coverage-july-slice01-implementation.md
- docs/historical-coverage-july-slice02-implementation.md
- docs/historical-coverage-july-slice03-implementation.md

July fixture slice comparisons:
- docs/historical-coverage-july-slice01-comparison.md
- docs/historical-coverage-july-slice01-slice02-comparison.md
- docs/historical-coverage-july-slice02-slice03-comparison.md

July summary index:
- docs/historical-coverage-july-fixture-slice-summary-index.md

Export/review CLI docs and threshold docs referenced from README and coverage plan.

## Current capabilities

- local fixture inventory is explicit and guarded
- fixture provider discovers deterministic June/July fixture dates
- historical export/review tooling validates generated exports
- batch/aggregate/threshold review paths exist
- July fixture-slice comparison process is documented
- validation remains green on the current local fixture inventory

## Current limitations

- fixture-only, not a full historical dataset
- no live/API usage authorized
- no model calibration
- no modelProbability
- no broad sport coverage yet
- TEAM_ONLY excludes pitcher evidence
- actual starters remain evaluation-only
- weather/lineup/injury/pitcher enrichment remains excluded/unavailable in current fixture diagnostics
- no claim of predictive quality

## Decision options

| Option | Next phase | Benefit | Risk | Recommendation |
|---|---|---|---|---|
| A — Continue fixture expansion | Phase 3B — plan july-slice04 | more deterministic local coverage surface | can become repetitive before reporting is useful | safe but not highest leverage unless more coverage surface is specifically needed |
| B — Add broader historical coverage docs index | Phase 3B — add historical coverage master index | improves navigation across many Phase 1/2 docs | documentation-only, no product functionality | useful because docs are now numerous |
| C — Polish reporting around existing 29-game fixture inventory | Phase 3B — plan fixture inventory reporting polish | turns current fixture work into clearer operator-facing output | requires careful separation from model-quality claims | highest leverage next branch |
| D — Start next sport architecture planning | Phase 3B — plan next sport module architecture | moves toward multi-sport roadmap | may distract before MLB historical foundation is easier to read | defer until reporting/docs index are stronger |

## Recommended decision

Choose Option C as the recommended next branch:
Phase 3B — plan fixture inventory reporting polish.

Why:
- current fixture inventory is stable enough to report clearly
- reporting polish helps future expansion be easier to inspect
- it does not require live/API/web usage
- it keeps model-quality claims out of scope
- it prepares for future larger fixture inventories

## Proposed Phase 3B scope

Planning-only first.

Possible future reporting polish ideas:
- clearer inventory table output
- explicit month/date/slice summary
- optional JSON summary fields if already consistent with current CLI style
- docs showing how to read inventory output
- guardrail language that counts are fixture coverage, not model quality

Hard boundaries for Phase 3B:
- no new fixture records
- no live/API/web usage
- no modelProbability
- no calibration claim

## Stop conditions for Phase 3B

Halt if any of the following appear:
- it requires source=live
- it requires real MLB API or web lookup
- it weakens safety language
- it mixes modelProbability with confidence/research strength/data quality
- it treats fixture counts as predictive quality
- it introduces package/dependency churn without need
- it modifies fixture data during planning
- generated artifacts remain staged

## Safety boundaries

- source=live is not allowed
- real MLB API requests are not allowed
- web lookup is not allowed
- modelProbability remains absent/null/not available until calibrated
- TEAM_ONLY excludes pitcher evidence
- actual starters remain evaluation-only
- schedule probable timestamp safety remains unchanged
- no model-quality or predictive-performance claim
- no live/API authorization

## Recommended next safe phase

Phase 3B — plan fixture inventory reporting polish.
State that Phase 3B should be planning-only.
