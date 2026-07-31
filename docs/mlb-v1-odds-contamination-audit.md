# MLB V1 Odds-Contamination Audit

## 1. Audit status

Status: complete.
Phase 8A inspection-only pass.
No source, test, fixture, golden, script, configuration, database, route, or UI changes.
Locked baseline: `003c81d576a867181aa8105239093dec466edc52` ("Plan Tennis research module boundary").

**Classification key used in this audit:**
- **Observed fact:** verified from repository code, types, or runtime imports.
- **Inference:** logical conclusion from observed facts, stated explicitly.
- **Future recommendation:** planning or firewall guidance for later phases.
- **Unknown:** not determinable from the current repository state.

This audit does not claim that safe endpoints remain safe forever, only that no active contamination was found at the locked baseline.

## 2. Locked baseline

- Branch: `main`
- HEAD: `003c81d576a867181aa8105239093dec466edc52`
- origin/main: `003c81d576a867181aa8105239093dec466edc52`

## 3. Audit methodology

- Searched the entire repository for market/odds terminology in source, tests, scripts, Prisma schema, and documentation.
- Classified each match as: `active runtime and reachable`, `active test-only`, `active script-only`, `schema/persistence only`, `documentation only`, `negative safety test`, `dormant or legacy`, or `unknown after inspection`.
- Classified MLB V1 relationship as: `safe and reusable`, `safe only after renaming or isolation`, `must remain outside the new prediction path`, `must be replaced`, `must be removed in a later dedicated phase`, or `requires further evidence`.
- Traced import chains and route handlers to determine reachability from `/dashboard`, `/mlb/report-preview`, MLB prospective commands, backtesting commands, and future MLB V1 entry points.

## 4. Search terms

Contamination search across source/test/script:
`OddsSample|PricedCandidate|sportsbook|bookmaker|odds|price|pricing|implied.?prob|market.?prob|market.?movement|line.?movement|expected.?value|value.?edge|edge|Kelly|payout|decimal.?odds|fractional.?odds|American.?odds`

Reachability search:
`PrismaClient|@prisma/client|prisma\.|OddsSample|PricedCandidate|ResearchCandidate|Multi|Leg`

Boundary search:
`ResearchCandidate|Multi|Leg|stake|staking|selection|recommendation|predictedWinner|modelProbability|confidence`

## 5. Repository occurrence inventory

Summary counts per file type (observed fact):

| File type | Odds-related matches |
| --- | --- |
| Prisma schema (`prisma/schema.prisma`) | `OddsSample`, `PricedCandidate`, `ResearchCandidate`, `Leg`, `Multi`, `Event.oddsSamples`, `decimalOdds`, `combinedOdds`, `bookmaker`, `CanonicalBookmaker` enum |
| Source (`src`) | `src/types/candidate.ts`, `src/types/leg.ts`, `src/types/multi.ts`, `src/lib/odds/*`, `src/lib/multi-builder/search.ts`, `src/lib/probability/joint.ts`, `src/lib/correlation/detect.ts`, `src/fixtures/phase0.ts`, `src/app/(app)/dashboard/page.tsx`, `src/prospective/mlb/weekly-research-construction.ts` (forbidden keys CSV entries), `src/lib/backtesting/historical-research-export.ts` (negative validation lists), `src/prospective/mlb/report-preview-api-contract.ts` (negative validation terms), `src/prospective/mlb/report-preview-ui-view-model.ts` (negative validation terms), `src/prospective/mlb/research-report-adapter.ts` (negative validation terms) |
| Tests (`tests`) | `tests/leakage.test.ts` (negative import boundary), `tests/e2e/phase0-flow.test.ts`, `tests/multi-builder/combination-search.test.ts`, `tests/odds/*`, `tests/backtesting/historical-research-export.test.ts` (negative safety), `tests/backtesting/live-cli-integration.test.ts`, `tests/backtesting/live-history/provider-factory.test.ts`, `tests/backtesting/live-history/provider-factory-integration.test.ts`, `tests/backtesting/cli-review-threshold-presets.test.ts`, `tests/backtesting/cli-review-export-batch.test.ts`, multiple prospective MLB report-preview tests (negative string validation) |
| Scripts (`scripts`) | No odds-content matches found; scripts are fixture-only |
| Documentation (`docs`) | Historical planning docs mention Phase 0 multi-construction and odds scaffolding intentionally |

## 6. Runtime reachability

### 6.1 `/dashboard`

- Route: `src/app/(app)/dashboard/page.tsx:7`
- Directly imports `getDashboardStats`, `getRecentMultis` from `src/server/actions.ts:3`
- `src/server/actions.ts:12` executes:
  - `db.event.count()`
  - `db.researchCandidate.count()`
  - `db.refresh.findFirst({ orderBy: { createdAt: 'desc' } })`
  - `db.multi.findMany({ include: { legs: true } })`
  - `db.multi.update(...)`
- **Observed fact:** Database access is active execution; if the PostgreSQL `DATABASE_URL` is invalid, the page returns 500 with `PrismaClientInitializationError`.
- **Observed fact:** The dashboard renders existing database-backed `Multi` and `Leg` records, including `combinedOdds` and `decimalOdds` fields from the schema.

### 6.2 `/mlb/report-preview`

- Route: `src/app/(app)/mlb/report-preview/page.tsx:5`
- Builds a local deterministic document via `src/prospective/mlb/report-preview-local-page-document.ts`.
- Renders via `src/app/_components/mlb-report-preview/MLBReportPreviewRenderer.tsx`.
- **Observed fact:** No database access.
- **Observed fact:** No odds imports.

### 6.3 Shared layout

- Root layout `src/app/layout.tsx:12` does not access the database.
- **Observed fact:** No shared `(app)` layout exists.
- **Observed fact:** No middleware exists.

### 6.4 Current MLB prospective commands

- `scripts/mlb-team-recent-form-research.ts`
- `scripts/mlb-weekly-prospective-research-construct.ts`
- `src/prospective/mlb/team-recent-form-research.ts`, `weekly-research-construction.ts`, etc.
- **Observed fact:** All use deterministic fixtures or local synthetic inputs.
- **Observed fact:** No database access.

### 6.5 Current MLB construction scripts

- Same as prospective commands.
- **Observed fact:** No database access.

### 6.6 Current MLB report adapter / renderer

- `src/prospective/mlb/research-report-adapter.ts`, `research-report-renderer.ts`
- **Observed fact:** Deterministic adapters; negative string validation present.

### 6.7 Current backtesting commands

- `src/lib/backtesting/cli.ts`
- `src/lib/backtesting/runner.ts`
- `src/lib/backtesting/orchestrator.ts`
- **Observed fact:** Use fixture or HTTP provider; no Prisma usage.

### 6.8 Future planned MLB V1 entry points

- **Unknown:** Not yet defined. Planning assumes new `src/prediction/*` namespaces.
- **Future recommendation:** Accidental import of legacy odds/multi files remains a risk and must be prevented by the Phase 8B import-boundary tests.

## 7. Prisma and persistence findings

Prisma schema `prisma/schema.prisma` contains:

- `OddsSample` model (`odds_samples` table)
- `PricedCandidate` model (`priced_candidates` table)
- `ResearchCandidate` model (`research_candidates` table)
- `Leg` model (`legs` table) with `decimalOdds`, `bookmaker`, `pricedCandidateId`
- `Multi` model (`multis` table) with `combinedOdds`, `primaryBookmaker`, `bookmakerTotals`, `profitLoss`
- `Event` model with `oddsSamples` relation
- `Refresh` model with `oddsFetched` counter

**Observed fact:** Database creation is isolated to `src/server/db.ts:12`.
**Observed fact:** This single point is referenced by `src/server/actions.ts:1`.

**Inference:** Schema presence alone does not mean execution by MLB V1 code.
**Inference:** The active dashboard path is the only confirmed runtime consumer of these tables at baseline.

## 8. Source findings

| File | Classification | MLB V1 decision |
| --- | --- | --- |
| `src/lib/odds/types.ts` | active source, odds domain | must remain outside the new prediction path |
| `src/lib/odds/normalization/odds.ts` | active source, odds ingestion normalization | must remain outside the new prediction path |
| `src/lib/odds/normalization/bookmakers.ts` | active source, odds ingestion normalization | must remain outside the new prediction path |
| `src/lib/odds/providers/base.ts` | active source, odds provider interface | must remain outside the new prediction path |
| `src/lib/odds/providers/mock-provider.ts` | active source, odds mock provider (test-dependent) | active test-only; keep for legacy tests; exclude from MLB V1 |
| `src/lib/multi-builder/search.ts` | active source, multi builder using `decimalOdds` and `combinedOdds` | must be replaced for MLB V1 multi construction |
| `src/lib/correlation/detect.ts` | active source, correlation tagging | safe only after renaming or isolation (reuse correlation logic without `decimalOdds`) |
| `src/lib/probability/joint.ts` | active source, joint probability estimation | must be replaced or isolated (currently does not use odds but sits in legacy path) |
| `src/lib/research/mlb/module.ts` | active source, mock MLB Stage 1 module | dorm or legacy; do not reuse for MLB V1 |
| `src/lib/research/mlb/scorers.ts` | active source, mock scorer | dorm or legacy; do not reuse for MLB V1 |
| `src/lib/research/factory.ts` | active source, sport module registry | safe after renaming or isolation |
| `src/lib/research/interface.ts` | active source, sport module interface | safe after renaming or isolation |
| `src/types/candidate.ts` | active source, defines `ResearchCandidate`, `PricedCandidate`, `MarketType` | must remain outside the new prediction path |
| `src/types/leg.ts` | active source, defines `Leg` with `decimalOdds` | must remain outside the new prediction path |
| `src/types/multi.ts` | active source, defines `Multi` with `combinedOdds`, `primaryBookmaker` | must remain outside the new prediction path |
| `src/types/provider.ts` | active source, odds interface definitions | must remain outside the new prediction path |
| `src/fixtures/phase0.ts` | active fixture, mock odds samples | active test-only / script-only; keep for Phase 0 tests only |
| `src/app/(app)/dashboard/page.tsx` | active route reachable | must remain outside the new prediction path unless separation is re-architected |
| `src/server/actions.ts` | active route action | must remain outside the new prediction path |

## 9. Test findings

| File | Classification | MLB V1 decision |
| --- | --- | --- |
| `tests/leakage.test.ts` | negative safety test | safe and reusable; this is the model for Phase 8B tests |
| `tests/e2e/phase0-flow.test.ts` | active test, imports mock odds and multi builder | active test-only; keep for Phase 0 only; exclude from MLB V1 suite |
| `tests/multi-builder/combination-search.test.ts` | active test, multi builder with `decimalOdds` | active test-only; keep for Stage 2; exclude from MLB V1 suite |
| `tests/odds/normalization.test.ts` | active test, odds normalization | active test-only; keep for legacy; exclude from MLB V1 suite |
| `tests/backtesting/mlb-fixture.test.ts` | active test, includes `Phase 1B MLB backtest: no odds imports` | safe and reusable; the negative boundary integrity test |
| `tests/backtesting/historical-research-export.test.ts` | negative safety test | safe and reusable |
| `tests/backtesting/live-cli-integration.test.ts` | negative safety test | safe and reusable |
| `tests/backtesting/provider-factory.test.ts` | negative safety test | safe and reusable |
| `tests/prospective/mlb-report-preview-*.test.ts` | negative string/field validation tests | safe and reusable |
| `tests/backtesting/*` (non-odds tests) | active test-only for backtesting | safe and reusable |

## 10. Script findings

- **Observed fact:** No scripts found that ingest odds or connect to a database.
- **Observed fact:** `scripts/mlb-team-recent-form-research.ts` is deterministic CLI using fixtures.
- **Observed fact:** `scripts/mlb-weekly-prospective-research-construct.ts` is deterministic CLI using fixtures.
- **Observed fact:** `scripts/backtest-mlb.ts` uses fixture or live-history HTTP provider only.

## 11. Route and UI findings

- `/dashboard`: active runtime, database-backed, reaches legacy `Multi`/`Leg` records with `decimalOdds` and `combinedOdds` via server actions.
- `/mlb/report-preview`: active runtime, does not reach legacy odds code or the database.
- **Future entry points do not yet exist and therefore cannot be called proven safe.** Any new MLB V1 route must be verified against the Phase 8B firewall.

## 12. Documentation findings

- `docs/mlb-report-preview-browser-acceptance-plan.md`, `docs/mlb-report-preview-visual-presentation-plan.md`, and related historical docs record deterministic review procedures, not active execution.
- `README.md` mentions database setup (`npx prisma migrate dev`) but does not require a database for unit tests.
- `docs/tennis-research-module-boundary-plan.md` explicitly lists the permanent odds-prohibition boundary for Tennis.

## 13. Proven safe paths

1. `src/prospective/mlb/*` — deterministic local research modules, report adapters, view models, handlers, API contracts, and renderers. No database. No odds imports.
2. `src/lib/backtesting/mlb/*` — snapshot builder, feature extractor, scorers, runner, orchestrator. No database. No odds imports.
3. `src/lib/research-data/mlb/*` — research data adapter and fixture provider. No database.
4. `tests/backtesting/mlb-fixture.test.ts` contains an explicit docker-style import boundary check: backtesting must not import odds types.
5. `tests/leakage.test.ts` ensures `src/lib/research` does not import from `src/lib/odds`.
6. `src/lib/backtesting/historical-research-export.ts` and numerous backtesting CLI tests enforce negative safety field validation.

## 14. Proven unsafe or excluded paths

1. **Legacy odds pipeline:**
   - `src/lib/odds/*`
   - `src/lib/multi-builder/search.ts`
   - `src/types/candidate.ts`
   - `src/types/leg.ts`
   - `src/types/multi.ts`
   - `src/fixtures/phase0.ts`
   These paths are proven to rely on market prices (`decimalOdds`, `combinedOdds`, `bookmaker`, `primaryBookmaker`). They must not be imported by MLB V1.

2. **Database-backed dashboard:**
   - `src/server/actions.ts` + `src/server/db.ts` + Prisma models `Event`, `Refresh`, `ResearchCandidate`, `Leg`, `Multi` provide the existing Stage 2 legacy record state. These are active runtime paths for `/dashboard`.
   - **Future recommendation:** While not "unsafe" per se (they do not currently import odds types), they should remain outside the MLB V1 prediction namespace until a dedicated cleanup phase.
   - **Future recommendation:** A later dedicated cleanup phase can remove them only after MLB V1 is proven and no existing production workflow depends on them.

3. **Schema presence is not the same as execution.**
   - `OddsSample`, `PricedCandidate`, `Leg`, `Multi`, `Event.oddsSamples`, and `Refresh.oddsFetched` are present in the schema.
   - No new MLB V1 source may query them.

## 15. Unknowns

- The exact final design of MLB V1 prediction model artifact store is not chosen yet.
- The selected final real-data provider(s) for production ingestion is not chosen yet.
- The final MLB V1 dataset fingerprint hash algorithm is not chosen yet.
- The exact V1 staking threshold values are deferred to calibration evidence.
- Future MLB V1 routes are undefined and therefore not verified safe beyond the Phase 8B contract.

## 16. Isolation recommendation

**Option A — Isolate and leave dormant for MLB V1.**

This is the only current Phase 8A decision.

**Observed fact:** Existing `Leg`, `Multi`, `Event`, `Refresh`, and `ResearchCandidate` tables are actively used by `/dashboard` (`src/app/(app)/dashboard/page.tsx:7` imports server actions that query them at `src/server/actions.ts:12`).
**Future recommendation:** Removing them would widen risk to the existing Stage 2 dashboard.
**Future recommendation:** Strict import and query boundaries can prevent MLB V1 contamination.
**Future recommendation:** A later dedicated cleanup phase can remove them only after MLB V1 is proven and no existing production workflow depends on them.

**Implementation:**

- New MLB V1 namespace `src/prediction/*` with prohibited-import enforcement.
- No new MLB V1 source may import `OddsSample`, `PricedCandidate`, `Leg`, `Multi`, `ResearchCandidate`, or odds-related types.
- No new MLB V1 source may query odds-related tables.

**Clarification:** `/mlb/report-preview` was inspected and found to be local, deterministic, and free of database or odds imports. It is therefore **not** treated as active contamination evidence.

## 17. Required Phase 8B firewall

The Phase 8B plan can only outline a boundary contract; it cannot prove absence of contamination until it exists.

Controls to implement:

1. **Separate source namespaces:** MLB V1 prediction code lives exclusively in `src/prediction/*`.
2. **Separate persistence contracts:** New prediction, multi, and staking records use types defined in `src/prediction/types/*`. No reuse of `src/types/candidate.ts`, `src/types/leg.ts`, `src/types/multi.ts`.
3. **Prohibited imports:** Phase 8B introduces `assertMLBPredictionNamespace` to reject imports from forbidden paths.
4. **Recursive prohibited-key validation:** `assertNoOddsContamination` recursively scans objects for prohibited keys.
5. **Prohibited-text validation:** `MLB_REPORT_PREVIEW_API_CONTRACT_FORBIDDEN_KEYS` and `FORBIDDEN_KEYS` patterns serve as precedence.
6. **Dependency-direction rules:** Petitions from `src/prediction/*` to `src/lib/research-data/*` and `src/lib/backtesting/*` only.
7. **Test-enforced import boundaries:** Mirror the existing `tests/leakage.test.ts` and `tests/backtesting/mlb-fixture.test.ts` patterns for `src/prediction/*`.
8. **Runtime assertions:** Every public entry point validating prediction records calls `assertNoOddsContamination` first.
9. **Dataset-schema assertions:** Pregame snapshots must not contain `finalStatus`, `completedGameState`, `actualStartingPitchers`, or score fields.
10. **Prediction-record assertions:** Prediction records must not contain `decimalOdds`, `impliedProbability`, `sportsbook`, `combinedOdds`, `edge`, `roi`, `expectedValue`.
11. **CI architecture checks:** Add an import-boundary Vitest that runs in CI.
12. **No shared DTOs with odds-related models.**
13. **No shared database queries with price-derived records.**

## 18. Later cleanup decisions

**Future recommendation:** Phase 8P or later: remove dormant odds-related schema models (`OddsSample`, `PricedCandidate`) after confirming no existing production workflows depend on them.
**Future recommendation:** Phase 8P or later: remove `src/lib/odds/*`, `src/lib/multi-builder/*`, and `src/types/candidate.ts` (odds domain portion) if they are fully retired.
**Observed fact:** This audit does not recommend removal during Phase 8A–8N because `/dashboard` actively reaches the affected tables.

## 19. Acceptance criteria

MLB V1 odds-contamination audit is accepted when:

- All active MLB V1 imports resolved to `src/prediction/*`, `src/lib/research-data/*`, `src/lib/backtesting/*`, `src/lib/research/*`, or standard library.
- No MLB V1 source imports `src/lib/odds/*`, `src/lib/multi-builder/*`, `src/fixtures/phase0.ts`, `src/types/candidate.ts`, `src/types/leg.ts`, `src/types/multi.ts`, `prisma/schema.prisma`, or `@prisma/client`.
- No MLB V1 test imports forbidden paths.
- `tests/leakage.test.ts` and backtesting import boundary tests extend successfully to `src/prediction/*`.
- Recursive prohibited-key validator catches injected prohibited fields.
- `/mlb/report-preview` continues to render without database access.
- Review confirms legacy odds code is dormant from MLB V1 entry points.
- Later removal decisions remain evidence-gated and are not assumed to complete in Phase 8A.
