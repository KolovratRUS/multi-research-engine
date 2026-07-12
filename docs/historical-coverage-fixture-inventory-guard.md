# Historical Coverage Fixture Inventory Guard

Documentation-only guard note.
No new fixture data added after this baseline update unless explicitly scoped.
No live source used.
No real MLB API request made.
No web lookup used.
No generated artifacts committed.
No model-quality or predictive-performance claim.

## Status

Local fixture inventory guard added.
The guard makes fixture coverage shape explicit before any further fixture expansion.
Phase 2X intentionally updated the guarded baseline after july-slice03.

## Current guarded fixture baseline

- total fixture games: 29
- fixture range: 2024-06-01 through 2024-07-21
- June games: 17
- July games: 12
- July dates: 2024-07-01, 2024-07-03, 2024-07-05, 2024-07-07, 2024-07-08, 2024-07-10, 2024-07-12, 2024-07-14, 2024-07-15, 2024-07-17, 2024-07-19, 2024-07-21

## Guard implementation

- Added `scripts/mlb-fixture-inventory.ts`
- Added `inventory:mlb-fixtures` script in `package.json`
- Added assertions in `tests/backtesting/mlb-fixture.test.ts`
- The guard imports only local MLB fixtures
- It makes no network, API, or web calls
- It outputs deterministic JSON with inventory fields
- Phase 3C preserved the baseline fields and added reporting summary fields:
  - `monthSummaries`
  - `dateSummaries`
  - `localSliceSummaries`

## How to run

```bash
npm run inventory:mlb-fixtures
npx vitest run tests/backtesting/mlb-fixture.test.ts --reporter=verbose
```

Example output:

```json
{
  "startDate": "2024-06-01",
  "endDate": "2024-07-21",
  "totalGames": 29,
  "gamesByMonth": {
    "2024-06": 17,
    "2024-07": 12
  },
  "uniqueDateCount": 27,
  "juneGameCount": 17,
  "julyGameCount": 12,
  "julyDates": [
    "2024-07-01",
    "2024-07-03",
    "2024-07-05",
    "2024-07-07",
    "2024-07-08",
    "2024-07-10",
    "2024-07-12",
    "2024-07-14",
    "2024-07-15",
    "2024-07-17",
    "2024-07-19",
    "2024-07-21"
  ]
}
```

## Safety boundaries

- does not use source=live
- does not call real MLB API
- does not browse web
- does not create exports
- does not populate modelProbability
- does not affect TEAM_ONLY pitcher exclusion
- does not make model-quality claims
- does not authorize live/API use

## Acceptance gates before future fixture expansion

- inventory guard passes before expansion
- inventory guard updated intentionally after expansion
- docs updated with new fixture shape
- June baseline changes only if explicitly documented
- generated artifacts removed
- full validation passes
- safety searches pass

## Recommended next safe phase

Phase 2Y — compare july-slice02 and july-slice03 fixture coverage, documentation-only using the Phase 2V checklist.
Keep it planning-first unless the user explicitly asks to implement.
