# Historical Coverage July Slice Comparison — july-slice01

Documentation-only comparison.
No new fixture data added.
Fixture-only diagnostics.
No live source used.
No real MLB API request made.
No web lookup used.
Generated artifacts not committed.
No model-quality or predictive-performance claim.

## Purpose

Compare the pre-update fixture shape with the post-Phase 2P july-slice01 fixture surface to confirm the intended fixture-discovered count change.

## Source documents

- docs/historical-coverage-fixture-shape-investigation-large01.md
- docs/historical-coverage-targeted-fixture-update-plan.md
- docs/historical-coverage-july-slice01-implementation.md
- docs/historical-coverage-observer-comparison-medium01-large01.md
- docs/historical-dataset-coverage-plan.md

## Pre-update fixture shape

- total games: 17
- range: 2024-06-01 through 2024-06-24
- June games: 17
- July games: 0
- July dates: none
- large01 flat counts were expected because July dates had no fixture games

## Post-update fixture shape

- total games: 21
- range: 2024-06-01 through 2024-07-07
- June games: 17
- July games: 4
- July dates: 2024-07-01, 2024-07-03, 2024-07-05, 2024-07-07
- June count unchanged

## Comparison table

| metric | before july-slice01 | after july-slice01 | interpretation |
|---|---|---|---|
| total fixture games | 17 | 21 | fixture surface grew by 4 deterministic July records |
| June fixture games | 17 | 17 | existing June surface unchanged |
| July fixture games | 0 | 4 | new July discoverability added |
| fixture end date | 2024-06-24 | 2024-07-07 | end date extended into July |
| July discoverability | not discoverable | discoverable | fixture provider returns July games by officialDate |
| requestedDateCount behavior | calendar-day expansion only | same | not affected by fixture contents |
| downstream counts behavior | bounded by 17 games | bounded by 21 games | predictions/abstentions/warnings now can reflect July games |

## Fixture-only diagnostic

Command:

```bash
npx tsx -e "
const { buildMLBFixtures, getMLBFixtureDateRange } = require('./src/fixtures/backtesting/mlb/fixture-games.ts');
const fixture = buildMLBFixtures();
const { startDate, endDate } = getMLBFixtureDateRange(fixture);
const dates = fixture.games.map((g) => g.officialDate);
const byMonth = dates.reduce((acc, d) => {
  const m = d.slice(0, 7);
  acc[m] = (acc[m] || 0) + 1;
  return acc;
}, {});
const uniqueDates = [...new Set(dates)].sort();
const julyDates = uniqueDates.filter((d) => d.startsWith('2024-07'));
const juneDates = uniqueDates.filter((d) => d.startsWith('2024-06'));
console.log(JSON.stringify({
  startDate,
  endDate,
  totalGames: fixture.games.length,
  byMonth,
  uniqueDateCount: uniqueDates.length,
  juneDateCount: juneDates.length,
  julyDateCount: julyDates.length,
  julyDates
}, null, 2));
"
```

Result summary:

- startDate: 2024-06-01
- endDate: 2024-07-07
- totalGames: 21
- byMonth: 2024-06 = 17, 2024-07 = 4
- uniqueDateCount: 19
- juneDateCount: 15
- julyDateCount: 4
- julyDates: 2024-07-01, 2024-07-03, 2024-07-05, 2024-07-07

## July export/review diagnostic

Export command:

```bash
npm run backtest:mlb -- --source fixture --start 2024-07-01 --end 2024-07-07 --research-construction both --export-json tmp/coverage/mlb_both_fixture_2024-07-01_2024-07-07_july-slice01_phase2q_export.json
```

Review commands:

```bash
npm run backtest:mlb -- --review-export-json tmp/coverage/mlb_both_fixture_2024-07-01_2024-07-07_july-slice01_phase2q_export.json
npm run backtest:mlb -- --output json --review-export-json tmp/coverage/mlb_both_fixture_2024-07-01_2024-07-07_july-slice01_phase2q_export.json
```

Captured counts:

- requested/schedule dates: 7
- discovered games: 4
- predictions: 4
- abstentions: 4
- known-ineligible games: 2
- warnings: 12
- comparisonIncluded: true
- included evidence domains: home-park, rest-travel, team-offense
- excluded evidence domains: bullpen, injuries-lineup, offense-lineup, opponent-batting, starting-pitcher, weather-roof

Review result: valid, no issues.

Artifact cleanup:

- Generated export file removed before final report. No committed generated artifacts.

## Interpretation

- The fixture-discovered surface now extends into July.
- This confirms fixture coverage, not calendar range alone, controls downstream game-derived counts.
- This is not a model-quality claim.
- This does not authorize live/API use.
- Further expansion should proceed by small deterministic fixture slices or by adding a fixture inventory/check before larger expansion.

## Decision

Hold further fixture expansion until the july-slice01 comparison is committed, then add a fixture inventory command/test or plan the next small deterministic fixture slice.

Rationale:

- The comparison confirms the intended fixture-discovered count change without adding real-world data.
- A fixture inventory guard should be in place before more data expansion.

## Recommended next safe phase

Phase 2R — add fixture inventory CLI/test guard.
