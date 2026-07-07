# Historical Coverage July Slice Implementation — july-slice01

Documentation-only implementation note.
No live source used.
No real MLB API request made.
No web lookup used.
Generated artifacts not committed.
No model-quality or predictive-performance claim.

## Purpose

july-slice01 adds a small deterministic July fixture surface so fixture-only diagnostics can confirm July games are discoverable by the local fixture provider and downstream fixture-only coverage counts change accordingly.

## Plan reference

- docs/historical-coverage-targeted-fixture-update-plan.md

## Prior fixture-shape finding

- Phase 2N investigation confirmed the fixture dataset contained 17 total games, all in June 2024 (2024-06-01 through 2024-06-24), with 0 July games.
- large01 flat counts were expected from fixture coverage shape.

## Implementation summary

- Added 4 deterministic July fixture games to `src/fixtures/backtesting/mlb/fixture-games.ts`.
- Added 4 matching outcomes to `src/fixtures/backtesting/mlb/fixture-games.ts`.
- Added 3 focused tests to `tests/backtesting/mlb-fixture.test.ts` verifying July discoverability, June count preservation, and officialDate discovery.
- No other fixture data was modified.

## July slice details

- slice label: july-slice01
- date range: 2024-07-01 through 2024-07-07
- games added: 4
- total fixture games after update: 21
- games by month after update: June 2024 = 17, July 2024 = 4
- June count remained at 17
- fixture provider discovery verified without source=live

## Provenance note

The added July slice is deterministic local fixture/test data.
No live/API/web data was used.
The slice is for coverage-shape and pipeline behavior testing.
It does not claim to be a full historical dataset.
It does not carry a predictive-quality claim.

## Diagnostics

### Fixture inventory diagnostic

Command:
```bash
npx tsx -e "
const { buildMLBFixtures, getMLBFixtureDateRange } = require('./src/fixtures/backtesting/mlb/fixture-games.ts');
const fixture = buildMLBFixtures();
const { startDate, endDate } = getMLBFixtureDateRange(fixture);
const dates = fixture.games.map((g) => g.officialDate);
const byMonth = dates.reduce((acc, d) => { const m = d.slice(0, 7); acc[m] = (acc[m] || 0) + 1; return acc; }, {});
const julyDates = [...new Set(dates.filter((d) => d.startsWith('2024-07')))].sort();
console.log(JSON.stringify({ startDate, endDate, totalGames: fixture.games.length, byMonth, juneCount: dates.filter((d) => d.startsWith('2024-06')).length, julyCount: julyDates.length, julyDates }, null, 2));
"
```

Result:
- startDate: 2024-06-01
- endDate: 2024-07-07
- totalGames: 21
- byMonth: 2024-06 = 17, 2024-07 = 4
- julyCount: 4
- julyDates: 2024-07-01, 2024-07-03, 2024-07-05, 2024-07-07

### Optional export/review diagnostic

A tiny fixture-only export was run over 2024-07-01 through 2024-07-07 to prove July games affect downstream counts.

Export command:
```bash
npm run backtest:mlb -- --source fixture --start 2024-07-01 --end 2024-07-07 --research-construction both --export-json tmp/coverage/mlb_both_fixture_2024-07-01_2024-07-07_july-slice01_export.json
```

Review commands:
```bash
npm run backtest:mlb -- --review-export-json tmp/coverage/mlb_both_fixture_2024-07-01_2024-07-07_july-slice01_export.json
npm run backtest:mlb -- --output json --review-export-json tmp/coverage/mlb_both_fixture_2024-07-01_2024-07-07_july-slice01_export.json
```

Captured summary counts:
- requested dates: 7
- predictions: 4
- abstentions: 4
- warnings: 12
- comparison included: true
- included evidence domains: home-park, rest-travel, team-offense
- excluded evidence domains: bullpen, injuries-lineup, offense-lineup, opponent-batting, starting-pitcher, weather-roof

Artifact cleanup:
- Generated export file removed before final report. No committed generated artifacts.

## Safety checklist

- source remained fixture
- no source=live used or requested
- no real MLB API request made
- no web lookup used
- generated artifacts removed/not staged
- modelProbability absent/null/not available until calibrated
- TEAM_ONLY excludes pitcher evidence
- no schedule probable timestamp safety weakened
- no actual starters used prospectively
- no odds/market/betting language introduced

## Decision

Compare July slice diagnostics before any further fixture expansion.

## Recommended next safe action

- Documentation-only comparison of pre-update fixture shape vs july-slice01.
- Or a small july-slice01 run log/comparison if coverage comparison is planned next.
- Continue avoiding live/API usage until explicitly authorized.
