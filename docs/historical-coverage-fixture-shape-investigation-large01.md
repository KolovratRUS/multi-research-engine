# Historical Coverage Fixture Shape Investigation — large01

Documentation-only fixture-shape investigation.
No live source used.
No real MLB API request made.
No model-quality or predictive-performance claim.
No generated artifacts committed.

## Trigger

Phase 2M found that large01 expanded requested dates from 30 to 61 while predictions, abstentions, and warnings stayed flat at 17, 17, and 61.

## Source documents

- docs/historical-coverage-run-log-medium01.md
- docs/historical-coverage-run-log-large01.md
- docs/historical-coverage-observer-comparison-medium01-large01.md
- docs/historical-coverage-comparison-checklist.md
- docs/historical-dataset-coverage-plan.md

## Investigation scope

- fixture-only
- local repo inspection
- no source=live
- no real API
- no new historical export
- modelProbability remains absent, null, or not available until calibrated

## Findings

### Fixture data location

The single fixture data source for MLB backtesting is:

`src/fixtures/backtesting/mlb/fixture-games.ts`

This file exports `buildMLBFixtures()`, which the fixture provider (`src/lib/backtesting/mlb/historical-provider.ts`) uses to supply all fixture data. `buildMLBFixtures()` is referenced only from the CLI, the fixture provider, and tests. There is no other MLB fixture dataset.

### Fixture date coverage

A local diagnostic confirmed the fixture contains exactly **17 games**, all in **June 2024**:

- inclusive date range: 2024-06-01 through 2024-06-24
- games by month: `2024-06`: 17
- games by date: 2024-06-01, 2024-06-02, 2024-06-03, 2024-06-05, 2024-06-08, 2024-06-09, 2024-06-10, 2024-06-12, 2024-06-14, 2024-06-15, 2024-06-16, 2024-06-18, 2024-06-20, 2024-06-22, 2024-06-24
- July dates: **0 games**

This means the fixture dataset has no coverage beyond 2024-06-24.

### How requestedDateCount is counted

`requestedDateCount` is derived from the requested start/end date range by expanding every calendar day between them. It does not require that fixture data exists for each date. See `orchestrator.ts` (`validateDateRange`/`expandToUtcDates`).

- medium01 (2024-06-01 through 2024-06-30): 30 calendar days
- large01 (2024-06-01 through 2024-07-31): 61 calendar days

### How predictions/abstentions/warnings are counted

`predictions`, `abstentions`, and `warnings` are produced only by games actually discovered from the fixture provider. The provider filters by `officialDate === date`; dates without fixture games contribute no games, and therefore contribute no predictions, abstentions, or warnings. See `historical-provider.ts` (`fetchGamesForDate`).

### Why July adds requested dates but not predictions/abstentions/warnings

Any July requested date falls outside the fixture's 2024-06-01 through 2024-06-24 window, so the fixture provider returns zero games for all July dates. Adding 31 extra requested dates therefore only increases `requestedDateCount`; it cannot increase discovered games or downstream counts when the fixture dataset is unchanged.

### Are large01 flat counts expected or suspicious?

**Expected.** Given the current fixture coverage, large01's flat counts against medium01 are the expected outcome:
- the requested window grew, but the discoverable game pool did not
- predictions/abstentions/warnings are bounded by the fixture game set, not by calendar span

This is not suspicious behavior in the orchestration logic. It is fixture coverage shape.

## Evidence

Commands run:

```bash
npx tsx -e "
const { buildMLBFixtures, getMLBFixtureDateRange } = require('./src/fixtures/backtesting/mlb/fixture-games.ts');
const fixture = buildMLBFixtures();
const { startDate, endDate } = getMLBFixtureDateRange(fixture);
const byMonth = fixture.games.reduce((acc, g) => { const m = g.officialDate.slice(0,7); acc[m]=(acc[m]||0)+1; return acc; }, {});
console.log(JSON.stringify({ startDate, endDate, totalGames: fixture.games.length, byMonth, uniqueDates: [...new Set(fixture.games.map(g=>g.officialDate))].sort() }));
"
```

Output summary:

```json
{
  "startDate": "2024-06-01",
  "endDate": "2024-06-24",
  "totalGames": 17,
  "byMonth": { "2024-06": 17 },
  "uniqueDates": ["2024-06-01", "2024-06-02", "2024-06-03", "2024-06-05", "2024-06-08", "2024-06-09", "2024-06-10", "2024-06-12", "2024-06-14", "2024-06-15", "2024-06-16", "2024-06-18", "2024-06-20", "2024-06-22", "2024-06-24"]
}
```

Files inspected:

- `src/fixtures/backtesting/mlb/fixture-games.ts` — single fixture source
- `src/lib/backtesting/mlb/historical-provider.ts` — filters fixture games by `officialDate`
- `src/lib/backtesting/orchestrator.ts` — expands requested dates but does not synthesize games
- `src/lib/backtesting/runner.ts` — counts predictions/abstentions/warnings only from discovered games

## Interpretation

The flat large01 counts are best explained as fixture coverage limits in the current repo fixture, not as a regression or improvement in research behavior.

- Requested dates are calendar-day counts.
- Game-level counts reflect fixture contents.
- The fixture dataset stops at 2024-06-24.
- Until the fixture is extended, larger date windows that include July 2024 will not discover additional games.

Do not use this finding to claim model quality, predictive performance, calibration readiness, or live/API authorization.

## Decision

Hold expansion and plan a targeted fixture coverage update if broader fixture-only coverage is desired.

Rationale:

- The fixture dataset, not the orchestration logic, limits large01 coverage.
- The next safe step is to extend fixture data coverage (for example, adding July fixture games) before rerunning coverage checks.
- Do not switch to live source or real API requests to fill the gap.
- Do not use this as authorization for calibration or predictive-performance work.

## Recommended next safe action

Plan a documentation-only or fixture-only update phase to add July 2024 fixture data to `src/fixtures/backtesting/mlb/fixture-games.ts`, if wider fixture coverage is required.

If extending fixtures is out of scope, document the current fixture cap explicitly in the coverage plan so future operators do not expect larger calendar windows to yield more fixture-only results.

## Sign-off

- Reviewer: Sam / pending
- Review date:
- Approved for next coverage step: pending
