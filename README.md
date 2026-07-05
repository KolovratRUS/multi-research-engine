# Multi Research Engine

Private sports betting research and multi construction tool.

> **Disclaimer:** This application is a research aid only. It does not place bets, does not guarantee outcomes, and does not provide financial advice.

## Phase 1A Status

This repository is in **Phase 1A — baseball research-data pipeline**.

Current implementation:

- Live MLB schedule ingestion via the MLB Stats API.
- Probable-pitcher discovery and normalization.
- Season and recent-start pitcher research profiles.
- Team hitting and pitching profiles.
- Venue normalization with roof-type awareness.
- Open-Meteo weather integration for game-day context.
- Deterministic fixture providers for offline testing.
- Explicit `RESEARCH_DATA_MODE=fixture | live` boundary.
- Strict Stage 1 odds blindness: research code cannot read odds, bookmakers, or market pricing.
- `modelProbability` remains `null` — no validated predictive model.

## Phase 1B Status

This repository now includes **Phase 1B — MLB historical backtesting foundation**.

Backtesting freezes team and pitcher inputs **30 minutes before scheduled first pitch**. Completed games and starts are required to be strictly before cutoff. Outcomes remain inaccessible until the prediction is created.

Current MLB raw features:

- starting-pitcher ERA
- WHIP
- K/9
- days rest
- team runs per game
- OPS
- recent win rate
- historical season win rate where available
- home advantage
- known venue

Unsupported or incomplete:

- bullpen workload and quality
- confirmed lineups and injuries
- handedness splits where unavailable
- travel
- archived historical weather
- roof-state history

### Exploratory scoring

Current weights are hypotheses, not calibrated coefficients. The scorer applies only available groups, enforces a weighted feature coverage threshold, and renormalizes available weights to sum to 1. Missing values are never silently zeroed. `modelProbability` is not computed and no claim of predictive or betting profitability is made.

### Evaluation

- deterministic fixture backtesting
- chronological windows around the pregame cutoff
- known-ineligible game handling (cancelled/postponed/suspended before prediction)
- abstentions with typed reasons
- post-prediction voids
- naive home, recent-record and season-record baselines

### Separation

Stage 1 and backtesting contain no bookmaker odds, implied probability, EV, or ROI. Those concepts remain reserved for later, provider-backed stages only.

## Important warnings

- The MLB Stats API is **undocumented and unstable**. It may change without notice.
- Open-Meteo is used in development only. A production licensing review is required before shipping.
- No live odds are integrated in Phase 1A.
- No betting recommendations are generated.
- Research outputs are explicitly uncalibrated and unvalidated.

## Research-data mode

The application supports two modes for research data:

| Mode | Behaviour |
|------|-----------|
| `fixture` | Deterministic fixture data. No network calls. Recommended for tests and offline work. |
| `live` | Fetches from MLB Stats API and Open-Meteo. Requires internet. |

Set via environment:

```env
RESEARCH_DATA_MODE=fixture
```

## MLB Historical Backtest CLI

The backtesting runner accepts the following options:

```
--source fixture|live      Data source (default: fixture)
--date YYYY-MM-DD         Single game date
--start YYYY-MM-DD        Start of date range (requires --end)
--end YYYY-MM-DD          End of date range (requires --start)
--cache-root <path>       Live-mode HTTP cache root (default: .cache/mlb-history)
--cache-version <string>  Cache version key (default: v1)
--force-refresh           Bypass cache on live requests (default: false)
--timeout-ms <ms>         HTTP timeout in milliseconds
--max-retries <n>         Maximum HTTP retry attempts
--output text|json        Output format (default: text)
--help, -h                Show help
```

### Examples

```bash
# Fixture mode (default, no network)
npm run backtest:mlb

# Live mode — single date
npm run backtest:mlb -- --source live --date 2024-06-01

# Live mode — date range
npm run backtest:mlb -- --source live --start 2024-06-01 --end 2024-06-03

# Live mode — custom cache
npm run backtest:mlb -- --source live --date 2024-06-01 --cache-root /tmp/mlb-cache

# Live mode — force refresh
npm run backtest:mlb -- --source live --date 2024-06-01 --force-refresh
```

### Important warnings

- **Historical research only.** Live mode performs historical research using the MLB Stats API.
- **Unvalidated and uncalibrated.** Outputs are exploratory and must not be treated as betting recommendations.
- **No Stage 2 pricing.** No odds, bookmakers, or market pricing are involved in this milestone.
- **No bet placement.** This tool does not place bets or interact with any bookmaker.
- **Probable-pitcher provenance.** When a schedule probable pitcher is present but no trusted pre-cutoff assignment timestamp exists, the engine marks the starter provenance as `SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN` and abstains from predicting rather than guessing.
- **Real smoke.** Networked live smoke tests are disabled by default. Set `BACKTEST_LIVE_SMOKE=1` before running the live smoke script.

## Historical export review

Offline review commands for saved historical research exports are documented in `docs/historical-export-review.md`.

Quick aliases:

```bash
npm run review:historical-export:full
npm run review:historical-export:ci
npm run review:historical-export:ci:json
```

## Architecture

The application enforces a strict two-stage separation:

### Stage 1 — Blind Research

Evaluates games using:

- team and player form
- starting pitchers and matchups
- injuries and confirmed lineups
- bullpen availability
- rest, travel and scheduling
- weather and venue
- other sport-specific factors

**No bookmaker odds, implied probability, market movement, or betting-market data is used.**

Outputs `ResearchCandidate` records containing:

- projected selection and line
- model probability (`null` until a calibrated model exists)
- research strength score
- confidence and data quality
- volatility, explanation and warnings

### Stage 2 — Pricing & Packaging

After Stage 1 is complete:

- retrieves current bookmaker odds
- maps research candidates to available markets
- records decimal odds and timestamps
- flags stale or unavailable markets
- constructs multis from the strongest independently researched legs
- reaches approximate target odds bands as a packaging goal

Odds are used **only after** research quality is determined. They are the seventh-ranked consideration in multi construction.

## Project structure (Phase 1A)

```
src/
  app/                  — Next.js App Router pages
  lib/
    research/           — Stage 1 sport modules
      interface.ts
      factory.ts
      mlb/
        module.ts
    research-data/      — research data provider layer
      types.ts
      errors.ts
      cache.ts
      mode.ts
      mlb/
        stats-api-client.ts
        normalization.ts
        provider.ts
        fixture-provider.ts
      weather/
        open-meteo-client.ts
        provider.ts
        fixture-provider.ts
    odds/               — Stage 2 provider abstraction
      providers/
      normalization/
    multi-builder/      — combination search
    correlation/        — correlation rules
    probability/        — joint probability (independence-based estimate)
  server/               — API routes and Prisma client
  types/                — shared TypeScript types
  fixtures/
    research-data/      — deterministic fixture data
tests/
  fixtures/
    research-data/      — test-only API payload fixtures
  research-data/
    mlb/
    weather/
  research/
  odds/
  multi-builder/
  leakage.test.ts       — architecture enforcement
prisma/
  schema.prisma         — database schema
```

## Running Phase 1A

### Prerequisites

- Node.js 18+
- PostgreSQL (for database schema migration; not required to run unit tests)

### Install

```bash
npm install
```

### Database setup

```bash
npx prisma migrate dev
```

If PostgreSQL is unavailable, skip migration. Tests do not require a running database.

### Run tests

```bash
npm test
```

### Build

```bash
npm run build
```

## Freshness and determinism

All freshness calculations accept an injected reference time.

```ts
referenceTime?: Date
```

Tests pass a fixed reference date. Production code defaults to `new Date()` at orchestration boundaries.

## Probable-pitcher semantics

- Schedule-reported pitcher → `PROBABLE`
- Missing pitcher → `UNAVAILABLE`
- Changed pitcher vs prior snapshot → `CHANGED`
- `CONFIRMED` only when an explicit, reliable source supports confirmation

## Weather behaviour

- Fixed-roof domes bypass weather fetches.
- Retractable roofs retain a `Roof status unknown` warning.
- Open and unknown roofs fetch hourly forecast data.
- Missing required fields are surfaced as validation errors or warnings; missing values are not silently replaced with zero.

## Data quality and missing data

When required data is unavailable:

- `dataQuality` and `confidence` are reduced.
- Warnings are recorded in `ResearchCandidate.warnings`.
- No silently invented or backfilled statistics are used.

## Odds blindness proof

Stage 1 research modules and the `research-data` layer are verified to contain no imports of:

- odds providers
- `PricedCandidate`
- `OddsSample`
- bookmaker types
- decimal odds
- implied probability
- market movement

The leakage test in `tests/leakage.test.ts` enforces this boundary.

## Next steps

- Select and connect a licensed odds provider with confirmed Australian bookmaker coverage.
- Calibrate `modelProbability` from historical MLB results.
- Expand to NBA, Soccer, AFL, NRL and Tennis research modules.
- Implement beam-search combination construction.
- Add backtesting and calibration dashboards.
