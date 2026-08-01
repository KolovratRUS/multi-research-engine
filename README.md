# Multi Research Engine

Private sports betting research and multi construction tool.

> **Disclaimer:** This application is a research aid only. It does not place bets, does not guarantee outcomes, and does not provide financial advice.

## Phase 1A Status

Phase 5R adds TEAM_QUALITY_CONTEXT builder skeleton and unit tests. No CLI integration yet. No new stdout golden. No default behavior change. Phase 5B/5E/5H/5K/5N goldens preserved. Phase 5J result-metrics behavior preserved. Phase 5M schedule-context behavior preserved. Phase 5P synthetic coverage preserved. No modelProbability. No raw outcomes. No pitcher evidence. No actual starters. No file output. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5S.

Phase 5S integrates explicit --team-quality-context-local CLI mode. It requires --fixture-evidence-local. It adds researchFindings.teamQualityContext only in explicit mode. No default behavior change. No new stdout golden. Phase 5B/5E/5H/5K/5N/5T goldens preserved. Phase 5J result-metrics behavior preserved. Phase 5M schedule-context behavior preserved. Phase 5R builder behavior preserved. No modelProbability. No raw outcomes. No pitcher evidence. No actual starters. No file output. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5U.

Phase 5U adds richer synthetic TEAM_QUALITY_CONTEXT unit/fixture coverage. It adds no new research behavior. It adds no stdout golden. It preserves Phase 5B/5E/5H/5K/5N/5T goldens. It preserves Phase 5S team-quality CLI behavior. It preserves Phase 5R builder behavior. No modelProbability. No raw outcomes. No pitcher evidence. No actual starters. No file output. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5V.

Phase 5V is planning-only. It plans the future MLB research report/interface format. It adds no runtime behavior. It adds no CLI behavior. It adds no website/API implementation. It adds no file output. It adds no new tests/goldens. It preserves Phase 5B/5E/5H/5K/5N/5T goldens. It preserves Phase 5S CLI behavior. It preserves Phase 5R/5U team-quality behavior. No modelProbability. No picks/predictions/betting advice. No raw outcomes. No pitcher evidence. No actual starters. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5W.

Phase 5W adds local-only typed MLB research report-shape adapter skeleton and tests. It adds no runtime behavior. It adds no CLI behavior. It adds no website/API implementation. It adds no file output. It adds no new stdout golden. It preserves Phase 5B/5E/5H/5K/5N/5T goldens. It preserves Phase 5S CLI behavior. It preserves Phase 5R/5U team-quality behavior. No modelProbability. No picks/predictions/betting advice. No raw outcomes. No pitcher evidence. No actual starters. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5X.

Phase 5X adds local-only MLB human-readable report renderer and tests. It adds no CLI behavior. It adds no file output. It adds no website/API implementation. It adds no new stdout golden. It preserves Phase 5B/5E/5H/5K/5N/5T goldens. It preserves Phase 5S CLI behavior. It preserves Phase 5W adapter behavior unless explicitly documented. It preserves Phase 5R/5U team-quality behavior. No modelProbability. No picks/predictions/betting advice. No raw outcomes. No pitcher evidence. No actual starters. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes.
Phase 6A adds a documentation-only MLB website/API integration boundary plan.
It adds no runtime code.
It adds no website/API implementation.
It adds no server/backend/frontend code.
It adds no CLI behavior.
It adds no CLI flag.
It adds no stdout golden.
It preserves Phase 5B default stdout golden.
It preserves Phase 5E evidence-enabled stdout golden.
It preserves Phase 5H aggregate stdout golden.
It preserves Phase 5K result-metrics stdout golden.
It preserves Phase 5N schedule-context stdout golden.
It preserves Phase 5T team-quality stdout golden.
It preserves Phase 5Z report-preview golden.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
It preserves Phase 5S team-quality CLI behavior.
It preserves Phase 5R/5U team-quality behavior.
It preserves Phase 4X construction file-output behavior.
It preserves Phase 4Y construction file-output goldens.
It preserves Phase 4V no-flag construction stdout goldens.
It preserves lock CLI behavior.
It preserves Phase 4P no-flag lock goldens.
It preserves Phase 4S file-output lock goldens.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.
No file output.
No package.json or package-lock.json changes.
Recommended next safe phase is Phase 6B typed local API contract/schema for reportPreview only, or next sport module planning if the user chooses.


## Phase 5Y Status

- Phase 5Y adds optional explicit `--report-preview-local` JSON CLI mode.
- It requires `--fixture-evidence-local`.
- It adds `reportPreviewLocal: true` and `reportPreview` only in explicit mode.
- It adds no default behavior change.
- It adds no file output.
- It adds no website/API implementation.
- It adds no new stdout golden.
- It preserves Phase 5B/5E/5H/5K/5N/5T goldens.
- It preserves Phase 5S team-quality CLI behavior.
- It preserves Phase 5W adapter behavior.
- It preserves Phase 5X renderer behavior.
- It preserves Phase 5R/5U team-quality behavior.
- No modelProbability.
- No picks/predictions/betting advice.
- No raw outcomes.
- No pitcher evidence.
- No actual starters.
- No live/API/web or network standings/roster/schedule ingestion.
- No historical fixture changes.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.

Docs:
- docs/mlb-research-report-interface-plan.md
- docs/mlb-research-report-adapter-implementation.md
- docs/mlb-research-report-renderer-implementation.md
- docs/mlb-research-report-preview-cli-integration.md
- docs/mlb-research-report-preview-golden-tests.md

Phase 5T adds exact stdout golden regression coverage for --fixture-evidence-local --team-quality-context-local. It adds no new research behavior. It preserves Phase 5B/5E/5H/5K/5N goldens. It preserves Phase 5S team-quality CLI behavior. It preserves Phase 5R builder behavior. No modelProbability. No raw outcomes. No pitcher evidence. No actual starters. No file output. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5U.

Phase 5Q is planning-only. Phase 5Q plans the next safe MLB TEAM_ONLY module: team quality context. No implementation or behavior changed. No new tests/goldens. Phase 5B/5E/5H/5K/5N goldens preserved. Phase 5J result-metrics behavior preserved. Phase 5M schedule-context behavior preserved. Phase 5P synthetic coverage preserved. No modelProbability. No raw outcomes. No pitcher evidence. No actual starters. No file output. No live/API/web or network standings/roster/schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5R.

Phase 5P adds synthetic schedule-context unit/fixture coverage. It adds no new stdout golden. It preserves Phase 5B/5E/5H/5K/5N goldens. It preserves Phase 5J result-metrics behavior. It preserves Phase 5M schedule-context behavior. No modelProbability. No raw outcomes. No pitcher evidence. No actual starters. No file output. No live/API/web or network schedule ingestion. No historical fixture changes. Recommended next safe phase is Phase 5Q.

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

A release checklist for the offline review subsystem is documented in `docs/historical-export-review-release-checklist.md`.

The rollout plan for this subsystem is documented in `docs/historical-export-review-rollout.md`.

The larger coverage planning doc is `docs/historical-dataset-coverage-plan.md`.

Coverage-run logging and artifact naming templates are documented in `docs/historical-coverage-run-log-template.md` and `docs/historical-coverage-artifact-naming.md`.

The first Phase 2C observer-note example is `docs/historical-coverage-run-log-smoke01.md`.
The expanded Phase 2E observer-note example is `docs/historical-coverage-run-log-small01.md`.
The Phase 2F observer-comparison document is `docs/historical-coverage-observer-comparison-smoke01-small01.md`.
The Phase 2G conservative comparison checklist is `docs/historical-coverage-comparison-checklist.md`.
The Phase 2H medium01 planning document is `docs/historical-coverage-run-plan-medium01.md`.
The Phase 2I completed medium01 run log is `docs/historical-coverage-run-log-medium01.md`.
The Phase 2J small01 to medium01 observer comparison is `docs/historical-coverage-observer-comparison-small01-medium01.md`.
The Phase 2K large01 planning document is `docs/historical-coverage-run-plan-large01.md`.
The Phase 2L completed large01 run log is `docs/historical-coverage-run-log-large01.md`.
The Phase 2M medium01 to large01 observer comparison is `docs/historical-coverage-observer-comparison-medium01-large01.md`.
The Phase 2N fixture-shape investigation note is `docs/historical-coverage-fixture-shape-investigation-large01.md`.
The Phase 2O targeted fixture update plan is `docs/historical-coverage-targeted-fixture-update-plan.md`.
The Phase 2P july-slice01 implementation note is `docs/historical-coverage-july-slice01-implementation.md`.
The Phase 2Q july-slice01 comparison note is `docs/historical-coverage-july-slice01-comparison.md`.
The Phase 2R fixture inventory guard is `docs/historical-coverage-fixture-inventory-guard.md`.
The Phase 2S next fixture slice plan is `docs/historical-coverage-next-fixture-slice-plan.md`.
The Phase 2T july-slice02 implementation note is `docs/historical-coverage-july-slice02-implementation.md`.
The Phase 2U july-slice01 vs july-slice02 comparison note is `docs/historical-coverage-july-slice01-slice02-comparison.md`.
The Phase 2V fixture-slice comparison checklist is `docs/historical-coverage-fixture-slice-comparison-checklist.md`.
The Phase 2W next fixture slice plan is `docs/historical-coverage-next-fixture-slice-plan-02.md`, planning july-slice03 using the fixture inventory guard and fixture-slice comparison checklist before implementation.
The Phase 2X july-slice03 implementation note is `docs/historical-coverage-july-slice03-implementation.md`.
The Phase 2Y july-slice02 vs july-slice03 comparison note is `docs/historical-coverage-july-slice02-slice03-comparison.md`.
The Phase 2Z July fixture-slice summary index is `docs/historical-coverage-july-fixture-slice-summary-index.md`.
The Phase 3A planning-only decision point is `docs/historical-coverage-phase3a-decision-point.md`.
The Phase 3B planning-only fixture inventory reporting polish plan is `docs/historical-coverage-fixture-inventory-reporting-polish-plan.md`.
The Phase 3C implementation note is `docs/historical-coverage-fixture-inventory-reporting-polish-implementation.md`.
The Phase 4A planning-only MLB prospective weekly test mode plan is `docs/mlb-prospective-weekly-test-mode-plan.md`.
The Phase 4B local-only MLB prospective weekly dry-run schemas documentation is `docs/mlb-prospective-weekly-dry-run-schemas.md`.
The Phase 4C local-only MLB prospective weekly dry-run sample documentation is `docs/mlb-prospective-weekly-local-dry-run-sample.md`.
The Phase 4D local-only MLB prospective weekly dry-run check command documentation is `docs/mlb-prospective-weekly-dry-run-check-command.md`.
The Phase 4E local-only MLB prospective weekly dry-run check golden-output test documentation is `docs/mlb-prospective-weekly-dry-run-check-golden-output.md`.
The Phase 4F planning-only manually supplied MLB schedule-file dry-run plan documentation is `docs/mlb-manual-schedule-file-dry-run-plan.md`.
The Phase 4G local-only MLB manual schedule file schema and validator documentation is `docs/mlb-manual-schedule-file-schemas.md`.
The Phase 4H local-only MLB manual schedule file fixture and golden validator test documentation is `docs/mlb-manual-schedule-file-fixtures.md`.
The Phase 4I local-only MLB manual schedule validator CLI documentation is `docs/mlb-manual-schedule-validator-cli.md`.
The Phase 4J local-only MLB manual schedule validator CLI golden-output test documentation is `docs/mlb-manual-schedule-validator-cli-golden-output.md`.
The Phase 4K planning-only MLB manual schedule snapshot creation documentation is `docs/mlb-manual-schedule-snapshot-creation-plan.md`.
The Phase 4L local-only, stdout-only MLB manual schedule snapshot creation CLI documentation is `docs/mlb-manual-schedule-snapshot-creation-cli.md`; it validates one local file before in-memory conversion and adds no file-output mode.
The Phase 4M local-only MLB manual schedule snapshot CLI golden-output documentation is `docs/mlb-manual-schedule-snapshot-cli-golden-output.md`; it locks exact stdout JSON for static valid and invalid fixtures without adding file output.
The Phase 4N planning-only MLB manual week lock workflow documentation is `docs/mlb-manual-week-lock-workflow-plan.md`; it defines a future local, stdout-only deterministic lock contract without implementing a command or file output.
The Phase 4O local-only, stdout-only MLB manual week lock CLI documentation is `docs/mlb-manual-week-lock-cli.md`; it validates one user-provided local schedule file, converts it in memory, and emits a deterministic valid-only lock wrapper without file output.
The Phase 4P local-only MLB manual week lock CLI golden-output documentation is `docs/mlb-manual-week-lock-cli-golden-output.md`; it locks exact stdout JSON for static valid and invalid fixtures without adding file output.
The Phase 4Q planning-only MLB manual week lock file-output documentation is `docs/mlb-manual-week-lock-file-output-plan.md`; it defines a future explicit, local-only artifact-writing contract without implementing file output or creating generated artifacts.
The Phase 4R local-only MLB manual week lock file-output implementation is documented in `docs/mlb-manual-week-lock-file-output-plan.md`; file writes require both `--write-file` and `--output-dir`, write the exact valid `lockedSnapshot`, and leave the Phase 4P no-flag stdout goldens unchanged.
The Phase 4S local-only golden and file-output regression coverage is documented in `docs/mlb-manual-week-lock-file-output-golden-tests.md`; it locks the exact valid artifact body and file-mode stdout summary while preserving the Phase 4R implementation and Phase 4P no-flag goldens.
The Phase 4T planning-only locked-week-to-prospective-construction handoff is documented in `docs/mlb-weekly-prospective-research-construction-plan.md`.
Phase 4U implements that handoff with `npm run prospective:mlb:construct-week -- <locked-week-artifact-json>`. The command consumes the exact `lockedSnapshot` artifact rather than a raw manual schedule, validates it locally, and emits a deterministic stdout package containing one pre-game `pending-research` `FULL` stub per locked game.
Phase 4V exact construction stdout golden tests are documented in `docs/mlb-weekly-prospective-research-construction-golden-tests.md`; they lock the valid package and representative invalid summaries byte-for-byte.
The Phase 4W construction file-output contract and Phase 4X implementation are documented in `docs/mlb-weekly-prospective-research-construction-file-output-plan.md`. File output requires both `--write-file` and `--output-dir`, writes the exact inner construction package with a deterministic filename, emits summary-only file-mode stdout, and refuses overwrite.
Phase 4Y exact construction file-output goldens are documented in `docs/mlb-weekly-prospective-research-construction-file-output-golden-tests.md`; they lock the static artifact body and stable file-mode stdout summary byte-for-byte without changing Phase 4X behavior.
Generated lock artifacts are local files and must not be committed.
Generated construction artifacts are also local, ignored files and must not be committed. Phase 4Y leaves Phase 4X file-output behavior, Phase 4U no-flag behavior, the Phase 4V construction stdout goldens, the Phase 4P no-flag lock goldens, and the Phase 4S file-output lock goldens unchanged. Generated `tmp` output is cleaned after tests and remains uncommitted.
Phase 4Z is the planning-only first real MLB research-module handoff in `docs/mlb-first-research-module-handoff-plan.md`. It proposes the team recent form module, consuming the exact Phase 4X/4Y construction package artifact and enriching pregame research without predicting. It adds no `modelProbability`, pitcher evidence, live/API/web access, network schedule ingestion, generated run artifact, or historical fixture change. The Phase 4V/4Y construction goldens and Phase 4P/4S lock goldens remain unchanged.
Phase 5A implements that local-only, stdout-only MLB team recent form research skeleton in `docs/mlb-team-recent-form-research-module.md`. It consumes the exact construction package artifact, preserves it as `inputConstructionPackage`, and enriches every constructed game with a deterministic `TEAM_ONLY` not-evaluated finding. It does not predict, output `modelProbability`, use pitcher evidence or actual starters, call live/API/web sources, ingest a network schedule, or write a research package file.
Phase 5B adds fixture-only exact valid and representative invalid stdout goldens for that Phase 5A command in `docs/mlb-team-recent-form-research-golden-tests.md`. Phase 5A behavior is unchanged. Phase 5B adds no research behavior, file output, `modelProbability`, pitcher evidence, live/API/web access, network schedule ingestion, or historical fixture change.
Phase 5C is the planning-only local fixture evidence and leakage-guard design in `docs/mlb-team-recent-form-local-fixture-evidence-plan.md`. It keeps the exact construction artifact as the target schedule/game input and limits optional evidence to local historical records from `src/fixtures/backtesting/mlb/fixture-games.ts`. Phase 5A behavior and Phase 5B stdout goldens remain unchanged. It adds no implementation, file output, `modelProbability`, pitcher evidence, actual starters, live/API/web access, network schedule ingestion, generated run artifact, or historical fixture change.
The recommended next safe phase is Phase 5F: plan aggregate-only team recent form summaries.
Phase 5D implemented the pure local fixture evidence provider in `docs/mlb-team-recent-form-fixture-evidence-provider.md`. It uses an explicit `--fixture-evidence-local` flag, preserves the default Phase 5B goldens, and retains the `TEAM_ONLY`, no-pitcher, no-file-output, no-prediction safety boundary.
Phase 5E completed: added docs/mlb-team-recent-form-fixture-evidence-golden-tests.md, added tests/prospective/fixtures/manual-schedule/valid-mlb-team-recent-form-research-fixture-evidence-local-cli-output-v1.json, and locked exact --fixture-evidence-local stdout goldens. Phase 5D provider behavior, default Phase 5B goldens, and Phase 4/5 protected goldens remain unchanged.
Phase 5F is planning-only aggregate summary planning in `docs/mlb-team-recent-form-aggregate-summary-plan.md`. It does not add implementation, file output, or any live/API/web access.
Phase 5G implemented aggregate-only coverage/completeness summaries in `docs/mlb-team-recent-form-aggregate-summary-implementation.md`. It adds an explicit `--fixture-evidence-local --aggregate-summaries-local` mode and preserves default Phase 5B and Phase 5E evidence-enabled goldens unchanged.
Phase 5H added exact aggregate-summary stdout golden regression coverage in `docs/mlb-team-recent-form-aggregate-summary-golden-tests.md`. It does not add research behavior, file output, `modelProbability`, pitcher evidence, live/API/web access, network schedule ingestion, or historical fixture changes.
Phase 5I completed planning for safe result-derived aggregate metrics in `docs/mlb-team-recent-form-result-aggregate-metrics-plan.md`. It does not add implementation, file output, research behavior, `modelProbability`, pitcher evidence, actual starters, live/API/web access, network schedule ingestion, or historical fixture changes.

Phase 5J implemented safe result-derived aggregate metrics behind explicit local-only mode in `docs/mlb-team-recent-form-result-aggregate-metrics-implementation.md`. It requires `--fixture-evidence-local --aggregate-summaries-local --result-aggregate-metrics-local`, preserves default Phase 5B/5E/5H goldens, and keeps `modelProbability` and raw outcome fields absent.

Phase 5K added exact stdout golden regression coverage in `docs/mlb-team-recent-form-result-aggregate-metrics-golden-tests.md`. It locks the result-metrics mode output on the current local manual fixture and preserves all protected goldens unchanged.

Phase 5L completed planning-only for the next TEAM_ONLY schedule context module in `docs/mlb-team-context-rest-travel-schedule-density-plan.md`. It preserves all protected goldens and adds no runtime behavior.
Phase 5M implemented MLB TEAM_ONLY schedule context behind explicit local-only mode in `docs/mlb-team-schedule-context-implementation.md`. It adds an explicit `--fixture-evidence-local --team-schedule-context-local` mode, preserves default Phase 5B/5E/5H/5K goldens, and keeps `modelProbability` and raw outcome fields absent.
The recommended next safe phase is Phase 5N: add exact stdout golden regression coverage for the schedule context mode.

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

Phase 5O is planning-only for richer synthetic local schedule-density fixture coverage. It adds `docs/mlb-team-schedule-context-synthetic-fixtures-plan.md`, does not modify runtime behavior, tests, goldens, or fixtures, and preserves Phase 5B/5E/5H/5K/5N goldens with no modelProbability, no raw outcomes, no pitcher evidence, no file output, and no live/API/web.
## Phase 5Z Status

Phase 5Z adds exact stdout golden regression coverage for explicit `--fixture-evidence-local --report-preview-local`.
It adds one new golden: `tests/prospective/fixtures/manual-schedule/valid-mlb-report-preview-local-cli-output-v1.json`.
It adds no default behavior change.
It adds no file output.
It adds no website/API implementation.
It preserves Phase 5B/5E/5H/5K/5N/5T goldens.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 5S team-quality CLI behavior.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
It preserves Phase 5R/5U team-quality behavior.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.

Phase 6A adds a documentation-only MLB website/API integration boundary plan.
It adds no runtime code.
It adds no website/API implementation.
It adds no server/backend/frontend code.
It adds no CLI behavior.
It adds no CLI flag.
It adds no stdout golden.
It preserves Phase 5B default stdout golden.
It preserves Phase 5E evidence-enabled stdout golden.
It preserves Phase 5H aggregate stdout golden.
It preserves Phase 5K result-metrics stdout golden.
It preserves Phase 5N schedule-context stdout golden.
It preserves Phase 5T team-quality stdout golden.
It preserves Phase 5Z report-preview golden.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
It preserves Phase 5S team-quality CLI behavior.
It preserves Phase 5R/5U team-quality behavior.
It preserves Phase 4X construction file-output behavior.
It preserves Phase 4Y construction file-output goldens.
It preserves Phase 4V no-flag construction stdout goldens.
It preserves lock CLI behavior.
It preserves Phase 4P no-flag lock goldens.
It preserves Phase 4S file-output lock goldens.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.
No file output.
No package.json or package-lock.json changes.
Recommended next safe phase is Phase 6B typed local API contract/schema for reportPreview only, or next sport module planning if the user chooses.

Phase 6B adds a typed local API contract/schema for MLB reportPreview only.
It adds no server/backend/frontend code.
It adds no website/API implementation.
It adds no network behavior.
It adds no CLI behavior.
It adds no file output.
It adds no new stdout golden.
It preserves Phase 5B/5E/5H/5K/5N/5T/5Z goldens.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
It preserves Phase 5S team-quality CLI behavior.
It preserves Phase 5R/5U team-quality behavior.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.
Recommended next safe phase is Phase 6D optional local handler fixture/golden-free validation coverage, or next sport module planning if the user chooses.

Phase 6D adds golden-free validation coverage for the local MLB reportPreview API handler.
It adds no server/backend/frontend code.
It adds no HTTP routes.
It adds no website/API deployment.
It adds no network behavior.
It adds no CLI behavior.
It adds no file output.
It adds no new stdout golden.
It adds no fixtures.
It adds no generated goldens.
It preserves Phase 5B/5E/5H/5K/5N/5T/5Z goldens.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 6C handler contract and hardens invalid-input handling only if needed.
It preserves Phase 6B API contract behavior unless explicitly documented.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.
Recommended next safe phase is Phase 6E website UI component boundary planning only, or next sport module planning if the user chooses.


## Recommended next safe phase

Phase 6F — add typed UI view-model contract for MLB reportPreview handler success output only.
Alternatively, next sport module planning if the user chooses.

Scope for Phase 6F:
- local-only typed view-model contract
- no server/network
- no UI implementation
- no components
- no CSS
- no app/pages/routes
- no frontend framework files
- no HTTP routes
- no website/API deployment
- no file output
- no CLI changes
- no stdout golden
- no golden changes
- no fixtures
- no modelProbability
- no picks/predictions/betting advice
- no raw outcomes
- no pitcher evidence
- no actual starters
- no historical fixture changes
- preserves Phase 5B/5E/5H/5K/5N/5T/5Z goldens
- preserves Phase 5Y report-preview CLI behavior
- preserves Phase 6E UI boundary plan
- preserves Phase 6D handler validation behavior
- preserves Phase 6C handler behavior
- preserves Phase 6B API contract behavior
- preserves Phase 5W adapter behavior
- preserves Phase 5X renderer behavior

Phase 6G adds synthetic, golden-free validation coverage for the Phase 6F MLB reportPreview UI view-model boundary.
It adds no server/backend/frontend code.
It adds no network behavior.
It adds no CLI behavior.
It adds no file output.
It adds no new stdout golden.
It adds no fixtures.
It adds no generated goldens.
It preserves Phase 5B/5E/5H/5K/5N/5T/5Z goldens.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 6F typed UI view-model contract.
It preserves Phase 6D handler validation behavior.
It preserves Phase 6C handler behavior.
It preserves Phase 6B API contract behavior.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.

Phase 6H defines the first framework-agnostic component implementation slice for the validated MLB reportPreview UI view model.
It is documentation-only.
It defines the first component slice, input contracts, rendering rules, and test categories.
It consumes only the validated Phase 6F/6G view model.
It adds no component implementation, no framework, no CSS, no route, no server, no network, no CLI, no fixture, no golden, and no package changes.
Recommended next safe phase is the later component-contract implementation phase described in `docs/mlb-report-preview-ui-component-implementation-plan.md`.

Phase 6I implements the first framework-agnostic MLB reportPreview UI presentation contract.
It adds typed plain-data presentation interfaces, empty-state fields, and a single pure builder.
It consumes only the validated Phase 6F/6G view model.
It adds no browser UI, HTML, CSS, JSX, TSX, framework, route, server, network, CLI, fixture, golden, or package changes.
No live/API/web calls. No odds. No sportsbook. No betting language.
No modelProbability. No picks. No predictions. No raw outcomes. No pitcher evidence. No actual starters.
No historical fixture changes.
Recommended next safe phase is a future locally planned phase outside this contract implementation.

Phase 6J plans the post-presentation adapter boundary for the established Next.js application boundary.
It adds no browser UI, HTML, CSS, JSX, TSX, framework implementation, route, server, network, CLI, fixture, golden, or package changes.
It adds no second framework. It records how a future adapter may consume only `MLBReportPreviewUIPresentation`.
No live/API/web calls. No odds. No sportsbook. No betting language.
No modelProbability. No picks. No predictions. No raw outcomes. No pitcher evidence. No actual starters.
No historical fixture changes.
Recommended next safe phase is the later framework-adapter implementation phase described in `docs/mlb-report-preview-framework-adapter-boundary-plan.md` after explicit implementation approval.

Phase 6K adds the framework-neutral MLB report-preview UI adapter contract.
It consumes only `MLBReportPreviewUIPresentation` and produces deterministic semantic render instructions.
See `docs/mlb-report-preview-ui-adapter-implementation.md`.
It adds no browser UI, HTML, CSS, JSX, TSX, framework implementation, route, server, network, CLI, fixture, golden, or package changes.
No live/API/web calls. No odds. No sportsbook. No betting language.
No modelProbability. No picks. No predictions. No raw outcomes. No pitcher evidence. No actual starters.
No historical fixture changes.
Recommended next safe phase is a future locally planned phase outside this adapter contract implementation.

Phase 6L plans the first Next.js report-preview renderer slice.
It documents the narrow renderer-only implementation boundary that will consume exactly one validated `MLBReportPreviewUIAdapterDocument`.
See `docs/mlb-report-preview-next-renderer-implementation-plan.md`.
It adds no React components, JSX, TSX, routes, pages, layouts, CSS, server handlers, network behavior, fixtures, goldens, or package changes.
No live/API/web calls. No odds. No sportsbook. No betting language.
No modelProbability. No picks. No predictions. No raw outcomes. No pitcher evidence. No actual starters.
No historical fixture changes.
Recommended next safe phase is a future locally planned phase after explicit implementation approval.

Phase 6M implements the first Next.js report-preview renderer slice.
It adds one production TSX renderer and one test TSX file.
The renderer accepts `MLBReportPreviewUIAdapterDocument`, asserts at boundary, and renders semantic HTML:
`article > header, section, section, section, section, section, section` in exact adapter order.
No `'use client'`. No hooks. No browser APIs. No fetching. No CSS. No route/page changes.
Stable keys are scoped to the renderer. All adapter text is plain JSX text content.
Warnings preserve all records in order; empty warnings omit the block. Limitations are last and visible.
See `src/app/_components/mlb-report-preview/MLBReportPreviewRenderer.tsx`.
See `tests/prospective/mlb-report-preview-next-renderer.test.tsx`.
No live/API/web calls. No odds. No sportsbook. No betting language.
No modelProbability. No picks. No predictions. No raw outcomes. No pitcher evidence. No actual starters.
No historical fixture changes.

Phase 6N plans the first local Next.js MLB report-preview page-integration slice.
It defines one server-only App Router page, one local production-owned document helper, and one focused page-integration test.
See docs/mlb-report-preview-next-page-integration-plan.md.
It adds no source, test, page, route, layout, CSS, package, fixture, or golden changes in Phase 6N.
No live/API/web calls. No odds. No sportsbook. No betting language.
No modelProbability. No picks. No predictions. No raw outcomes. No pitcher evidence. No actual starters.
No historical fixture changes.

Phase 6O implements the first local Next.js MLB report-preview page integration.
It adds exactly 3 files:
- `src/app/(app)/mlb/report-preview/page.tsx` — server-only App Router page.
- `src/prospective/mlb/report-preview-local-page-document.ts` — deterministic production-owned local synthetic document builder.
- `tests/prospective/mlb-report-preview-next-page.test.tsx` — 30 focused tests.
The page renders the existing `MLBReportPreviewRenderer` with a local synthetic `MLBReportPreviewUIAdapterDocument`.
No route handler, API route, CSS, layout, navigation, fixture, golden, or package changes.
No live/API/web calls. No odds. No sportsbook. No betting language.
No modelProbability. No picks. No predictions. No raw outcomes. No pitcher evidence. No actual starters.
No historical fixture changes.
See docs/mlb-report-preview-next-renderer-implementation-plan.md for implementation boundary details.

Phase 6P adds a documentation-only plan for adding one narrow local-only dashboard navigation link to `/mlb/report-preview`.
It adds no source code, no tests, no pages, no routes, no layouts, no CSS, no packages, no fixtures, and no golden changes.
Future implementation would modify only `src/app/(app)/dashboard/page.tsx` and add `tests/prospective/mlb-report-preview-dashboard-navigation.test.tsx`.
No live/API/web calls. No odds. No sportsbook. No betting language.
No modelProbability. No picks. No predictions. No raw outcomes. No pitcher evidence. No actual starters.
No historical fixture changes.
See docs/mlb-report-preview-dashboard-navigation-plan.md.

Phase 6Q implements the planned narrow local-only dashboard navigation link to `/mlb/report-preview`.
It modifies only `src/app/(app)/dashboard/page.tsx` and adds `tests/prospective/mlb-report-preview-dashboard-navigation.test.tsx` with 25 focused tests.
No component, layout, route, CSS, package, fixture, or golden changes.
No live/API/web calls. No odds. No sportsbook. No betting language.
No modelProbability. No picks. No predictions. No raw outcomes. No pitcher evidence. No actual starters.
No historical fixture changes.
See docs/mlb-report-preview-dashboard-navigation-plan.md.

Phase 6R adds a documentation-only plan for the first narrow visual-presentation boundary on the local `/mlb/report-preview` renderer.
It modifies no `.ts`/`.tsx` files, tests, CSS, packages, fixtures, goldens, or scripts.
No live/API/web calls. No odds. No sportsbook. No betting language.
No modelProbability. No picks. No predictions. No raw outcomes. No pitcher evidence. No actual starters.
No historical fixture changes.
See docs/mlb-report-preview-visual-presentation-plan.md.

Phase 6S implements the first narrow visual-presentation boundary on the local `/mlb/report-preview` renderer.
It touches only `src/app/_components/mlb-report-preview/MLBReportPreviewRenderer.tsx` and adds `tests/prospective/mlb-report-preview-next-renderer-presentation.test.tsx` with 25 focused presentation tests.
The page `<main>` remains unchanged.
The renderer root `<article>` owns containment and outer spacing.
Production change is class-only: static Tailwind utility classes added to existing JSX elements.
Zero new production imports.
No element, text, order, logic, data, type, or adapter change.
Warnings and limitations use neutral containers.
Limitations remain last.
No page, dashboard, layout, CSS, package, fixture, golden, or script changes.
No modelProbability. No picks/predictions/betting advice. No raw outcomes. No pitcher evidence. No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.
See docs/mlb-report-preview-visual-presentation-plan.md.

Phase 6T adds a documentation-only manual local browser-acceptance plan for the MLB report-preview UI.
Option B is selected because no repository-owned automated browser-test infrastructure is available.
No browser was launched and no source, test, package, configuration, CI, fixture, golden, or script file changed.
Phase 6T does not verify visual appearance; it only defines a future local manual procedure.
See docs/mlb-report-preview-browser-acceptance-plan.md.

Phase 6U manual browser acceptance — completed 2026-07-30.
Owner-assisted Google Chrome acceptance in Chrome DevTools Responsive mode.
Baseline: 819178297040d18fd913805878a382ab4aca3856.
Command: npm run dev -- --hostname 127.0.0.1 --port 3000
Desktop viewport 1440 × 900 — dashboard PASS; report-preview PASS; no horizontal overflow; limitations final.
Small viewport 390 × 844 — dashboard PASS; report-preview PASS; no horizontal overflow; limitations final.
No red application-console errors observed.
Isolated temporary PostgreSQL on port 5433.
Temporary database removed afterward.
Existing port 5432 untouched.
No screenshots committed.
No live, API, web, or external-network data used.
No source, test, package, Prisma schema, migration, configuration, CI, fixture, golden, or script changes.
See docs/mlb-report-preview-browser-acceptance-plan.md and docs/mlb-report-preview-visual-presentation-plan.md.

Phase 7A is documentation-only.
It plans the first Tennis sport-specific research module.
The first Tennis contract is local, deterministic, synthetic, singles-only, and pre-match only.
Phase 7A adds no Tennis runtime source, tests, fixtures, goldens, commands, routes, UI, API, database, live ingestion, predictions, selections, multis, staking, or result processing.
The absence of those features is a Phase 7A scope statement, not a permanent product prohibition.
Future Tennis modules may use time-safe sport data such as rankings and historical results when explicitly planned and protected against future-data leakage.
Future Tennis outputs are intended to include odds-blind model probabilities, predicted winners, multi construction, and staking guidance.
Sportsbook odds, betting prices, implied market probabilities, market movement, price-based value/edge, and payout information are permanently prohibited from influencing the engine.
Locked MLB behavior and goldens remain unchanged.
Phase 7B remains the planned next Tennis implementation slice when Tennis resumes.
Tennis implementation is paused after Phase 7A while the project prioritizes completion of the full odds-blind MLB V1.
See docs/tennis-research-module-boundary-plan.md.

Phase 8A is documentation and audit only.
It plans the complete odds-blind MLB V1 prediction product.
MLB V1 is intended to include real sport-data ingestion, historical labelled datasets, leakage-safe forecasting, model-generated probabilities, predicted winners, multi construction, staking guidance, immutable recommendations, grading, performance reporting, UI, and production deployment.
Sportsbook odds, betting prices, market-implied probabilities, market movement, price-derived value or edge, payout information, and Kelly staking are permanently prohibited.
Model-generated probabilities are permitted and required.
Phase 8A adds no MLB V1 runtime implementation.
Tennis remains safely planned and paused after Phase 7A.
The next implementation phase is Phase 8B: the MLB prediction-domain contract and odds-contamination firewall.
See docs/mlb-v1-prediction-system-boundary-plan.md and docs/mlb-v1-odds-contamination-audit.md.

Phase 8B implements the MLB V1 prediction-domain contract and permanent odds-contamination firewall.
The input contract represents one pregame MLB game targeting the official final winner, including extra innings.
The contract includes stable game identity, timestamps, neutral-site and doubleheader metadata, data completeness, starting-pitcher availability states, and a recursively guarded research payload.
The firewall rejects sportsbook, odds, price, payout, market-implied probability, market-movement, price-derived value/edge, and Kelly concepts.
Model-generated probability field names remain permitted for future forecasting phases.
Phase 8B does not train a model, generate probabilities, select winners, build multis, recommend stakes, persist data, add routes, or deploy.
Exactly 20 Phase 8B tests cover the contract and firewall.
The next safe phase is Phase 8C: real MLB sport-data source evaluation and the provider-neutral canonical pregame snapshot contract.
See docs/mlb-v1-sport-data-source-evaluation.md and docs/mlb-v1-pregame-snapshot-contract-implementation.md.

Phase 8C evaluates current MLB sport-data source roles and implements the provider-neutral canonical pregame snapshot contract.

The canonical snapshot represents one pregame MLB game and preserves stable game identity, cutoff timestamps, source provenance, starting-pitcher states, completeness, warnings, and provider-neutral sport-data sections.

The snapshot rejects sportsbook and market-derived data through the permanent Phase 8B firewall.

It also rejects provider response envelopes, credentials, model outputs, predictions, recommendations, multis, stakes, grading data, and target-game outcomes.

Phase 8C performs no live API request, adds no provider adapter, stores no credentials, persists no snapshot, and schedules no ingestion.

The source evaluation distinguishes verified facts, repository observations, inference, recommendation, and unknowns.

Exactly 18 Phase 8C tests cover the canonical snapshot contract.

The next safe phase is Phase 8D: provider-neutral historical labelled dataset construction and leakage protections.

Phase 8D implements the historical labelled dataset contract with exact reconstruction cutoff equality, chronological train/validation/test splits, embargo windows, duplicate-game prevention, and permanent odds-blind boundaries.

Each example validates one Phase 8C canonical pregame snapshot. Official final outcomes are permitted only inside `label`. Outcome fields are rejected at the dataset root, split policy, example root, reconstruction, label source, and snapshot levels.

Phase 8D performs no live ingestion, adds no provider adapter, stores no credentials, persists no dataset, and performs no feature extraction, training, inference, routing, or UI rendering.

Exactly 20 Phase 8D tests cover the dataset contract.
See docs/mlb-v1-historical-labelled-dataset-contract-implementation.md.

The next safe phase is Phase 8E: the leakage-safe MLB feature-vector contract and deterministic feature-extraction boundary.

Phase 8E implements a declarative provider-neutral feature manifest.
Feature extraction accepts only a validated Phase 8C pregame snapshot.
The extractor cannot access Phase 8D labels or historical examples.
Numerical values are preserved exactly.
Boolean values are encoded as 1 or 0.
Missing values use explicit REJECT or USE_DEFAULT policies.
Feature ordering is deterministic and manifest-defined.
Generated vectors contain only snapshot/game identity, cutoff metadata, feature IDs, finite values, and missing flags.
The permanent odds-blind firewall remains active.
Phase 8E performs no live ingestion, persistence, label joining, training, inference, probability generation, routes, or UI.
Exactly 20 Phase 8E tests cover the boundary.
The next safe phase is Phase 8F.
See docs/mlb-v1-feature-vector-contract-implementation.md.
