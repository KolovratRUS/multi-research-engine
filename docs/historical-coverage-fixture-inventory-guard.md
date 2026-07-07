# Historical Coverage Fixture Inventory Guard

Documentation-only guard note.
No new fixture data added.
No live source used.
No real MLB API request made.
No web lookup used.
No generated artifacts committed.
No model-quality or predictive-performance claim.

## Status

Local fixture inventory guard added.
The guard makes fixture coverage shape explicit before any further fixture expansion.

## Current guarded fixture baseline

- total fixture games: 21
- fixture range: 2024-06-01 through 2024-07-07
- June games: 17
- July games: 4
- July dates: 2024-07-01, 2024-07-03, 2024-07-05, 2024-07-07

## Guard implementation

- Added `scripts/mlb-fixture-inventory.ts`
- Added `inventory:mlb-fixtures` script in `package.json`
- Added assertions in `tests/backtesting/mlb-fixture.test.ts`
- The guard imports only local MLB fixtures
- It makes no network, API, or web calls
- It outputs deterministic JSON with inventory fields

## How to run

```bash
npm run inventory:mlb-fixtures
npx vitest run tests/backtesting/mlb-fixture.test.ts --reporter=verbose
```

Example output:

```json
{
  "startDate": "2024-06-01",
  "endDate": "2024-07-07",
  "totalGames": 21,
  "gamesByMonth": {
    "2024-06": 17,
    "2024-07": 4
  },
  "uniqueDateCount": 19,
  "juneGameCount": 17,
  "julyGameCount": 4,
  "julyDates": [
    "2024-07-01",
    "2024-07-03",
    "2024-07-05",
    "2024-07-07"
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

Phase 2S — plan next deterministic fixture slice using the inventory guard.
Keep it planning-first unless the user explicitly asks to implement.
