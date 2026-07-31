# MLB V1 Prediction System Boundary Plan

## 1. Phase status

Phase 8A is documentation, planning, and audit only.
Goal: complete odds-blind MLB V1 prediction product boundary, contamination firewall, and Phase 8B planning.
Locked baseline commit: `003c81d576a867181aa8105239093dec466edc52` ("Plan Tennis research module boundary").
Current branch: `main`.
Repository state: no source, test, package, configuration, database, route, UI, or deployment changes in Phase 8A.

## 2. Locked baseline

- **Branch:** `main`
- **HEAD:** `003c81d576a867181aa8105239093dec466edc52`
- **origin/main:** `003c81d576a867181aa8105239093dec466edc52`
- **Observed blocker at baseline:** Next.js `/dashboard` route requires a working PostgreSQL `DATABASE_URL`; the local listener on port `5432` accepts connections, but Prisma initialization fails with `PrismaClientInitializationError: User 'user' was denied access on database 'multi_research_engine.public'`.
- **Required next action:** local environment correction or local database setup. No repository change resolves this blocker.

## 3. Product purpose

The Multi Research Engine is an **odds-blind sports prediction and multi-construction system**.

Intended outputs:

- model-generated win probabilities
- predicted winners
- recommended selections
- multi-bet construction
- confidence assessments
- uncertainty assessments
- staking guidance
- exposure controls
- timestamped recommendations
- post-event grading
- calibration reporting
- performance reporting

These outputs must be generated only from sport data and the engine's own research and forecasting.

MLB V1 is intended to include real sport-data ingestion, historical labelled datasets, leakage-safe forecasting, model-generated probabilities, predicted winners, multi construction, staking guidance, immutable recommendations, grading, performance reporting, UI, and production deployment.

## 4. Permanent odds-blind rule

The program must never ingest, query, store for decision-making, derive from, compare against, or be influenced by:

- sportsbook odds
- betting prices
- decimal odds
- fractional odds
- American odds
- implied probability derived from price
- bookmaker consensus
- market movement
- line movement
- price comparison
- price-derived value
- price-derived edge
- expected value based on price
- potential payout
- payout-driven selection
- Kelly calculations
- line shopping

Permanent rule:

> Predictions, selections, multis, and staking are core outputs.  \
> Sportsbook and market information must never influence them.

Model-generated probabilities are required and permitted.
Market-implied probabilities are permanently prohibited.

## 5. Current implementation status

Repository evidence was reviewed for each capability.
The matrix describes what exists versus what is missing.

| Capability | Repository evidence | Current status | Usable today? | Missing work | Risk |
| --- | --- | --- | --- | --- | --- |
| Local synthetic MLB research inputs | `src/prospective/mlb/weekly-research-construction.ts`, `src/prospective/mlb/team-recent-form-fixture-evidence.ts`, `src/prospective/mlb/manual-schedule-file.ts`, `tests/prospective/fixtures/manual-schedule/` | Deterministic CLI produces synthetic MLB research and evidence | Yes (synthetic only) | None | Low |
| Recent-form research | `src/prospective/mlb/team-recent-form-research.ts` | Deterministic local research module | Yes (synthetic) | None | Low |
| Aggregate summaries | `src/prospective/mlb/team-recent-form-aggregate-summary.ts` | Deterministic CLI module | Yes | None | Low |
| Result aggregate metrics | deterministic research CLI options | Deterministic CLI module | Yes | None | Low |
| Schedule context | `src/prospective/mlb/team-schedule-context.ts` | Deterministic CLI module | Yes | None | Low |
| Team-quality context | `src/prospective/mlb/team-quality-context.ts` | Deterministic CLI module | Yes | None | Low |
| Research construction artifacts | `src/prospective/mlb/weekly-research-construction.ts` | Deterministic CLI pipeline | Yes (synthetic) | None | Low |
| Report adapter / renderer | `src/prospective/mlb/research-report-adapter.ts`, `source/prospective/mlb/research-report-renderer.ts` | Deterministic local HTML path | Yes | None | Low |
| Report-preview UI | `src/app/(app)/mlb/report-preview/page.tsx`, `src/app/_components/mlb-report-preview/MLBReportPreviewRenderer.tsx` | Next.js deterministic page | Yes | None | Low |
| Dashboard navigation | `src/app/(app)/dashboard/page.tsx` | Next.js server-rendered dashboard | Partial (requires PostgreSQL) | Database access | Medium |
| Historical labelled dataset construction | `src/lib/backtesting/mlb/snapshot-builder.ts`, `src/lib/backtesting/mlb/feature-extractor.ts` | Time-safe snapshot + feature extraction exists for backtesting | Yes (backtesting only) | None yet | Low |
| Real MLB data ingestion | `src/lib/research-data/mlb/provider.ts`, `src/lib/research-data/mlb/stats-api-client.ts`, `src/lib/research-data/mode.ts` | HTTP-to-canonical adapter exists; `RESEARCH_DATA_MODE=live|fixture` | Yes (fixture mode verified) | No MLB Stats API ingest complete | Low |
| Pregame snapshotting | `src/lib/backtesting/mlb/snapshot-builder.ts` | Deep-cloned pregame snapshot | Yes (backtesting) | None yet | Low |
| Feature timestamping | `BacktestSnapshot.generatedAt`, `HistoricalCutoff.cutoffTime` | Present in backtesting types | Yes | None yet | Low |
| Future-data-leakage prevention | `src/lib/backtesting/leakage-guards.ts`, `src/lib/backtesting/mlb/runner.ts`, `tests/backtesting/mlb-fixture.test.ts` | Guard checks and tests enforce pre-cutoff usage | Yes (backtesting) | None | Low |
| Model training | not present | No training code | No | Full pipeline | High |
| Model persistence | not present | No model artifact store | No | Package, artifact storage, model metadata | High |
| Model versioning | not present | No model versioning | No | Schema, metadata | High |
| Probability generation | `src/lib/backtesting/mlb/exploratory-scorer.ts` returns a deterministic side and weighted score | Exploratory backtest scorer only | No | Calibrated model probabilities | High |
| Probability calibration | not present | No calibration module | No | Fitting, evaluation, reliability bins | High |
| Winner selection | `runner.ts` sets `predictedSide` | Exploratory only | No | Lock, abstention, NO_SELECTION | High |
| Multi construction | `src/lib/multi-builder/search.ts`, `src/types/multi.ts`, `src/types/leg.ts` | Existing Stage 2 multi builder uses `decimalOdds` and `combinedOdds` | No (odds path excluded) | Rebuild without market price data | High |
| Staking guidance | not present | No staking engine | No | Fixed-unit tiers, caps | High |
| Prediction timestamping | not present | No prediction record | No | `predictionId`, `generatedAt`, `locksAt`, `lockedAt` | High |
| Immutable prediction storage | not present | No persistence contract | No | Prisma/dataset store, clear schema | High |
| Post-game result ingestion | `src/lib/backtesting/mlb/live-history/outcome-loader.ts` | HTTP historical outcome loader | Yes (historical backtesting) | None yet | Low |
| Grading | `src/lib/backtesting/metrics.ts`, `runner.ts` correct flag | Backtesting correctness flag only | Yes (backtesting) | None | Low |
| Performance reporting | `src/lib/backtesting/historical-research-export.ts` judgmental exports | Export exists for backtesting thresholds | Yes (backtesting) | None yet | Low |
| Production scheduling | not present | No scheduler | No | Cron, idempotent jobs | High |
| Production deployment | not present | No deployment config | No | Vercel/Node, secrets, rollback | High |
| Monitoring | not present | No monitoring | No | Health checks, logs | High |

### 5.1 Important constraints

- The existing `/dashboard` route (`src/app/(app)/dashboard/page.tsx:7`) imports `getDashboardStats` and `getRecentMultis` from `src/server/actions`.
- `src/server/actions.ts:12` executes `db.event.count()`, `db.researchCandidate.count()`, `db.refresh.findFirst(...)`, `db.multi.findMany({ include: { legs: true } })`, and `db.multi.update(...)`.
- `/mlb/report-preview` (`src/app/(app)/mlb/report-preview/page.tsx:5`) is independent: it only loads local prospective modules.
- The root layout (`src/app/layout.tsx:12`) does not access the database.
- There is no shared `(app)` layout that touches the database.
- Database access is **not inside middleware**. There is no `src/middleware.ts`.

## 6. MLB V1 scope

MLB V1 is a complete odds-blind MLB prediction product.
Phase 8B begins the implementation boundary.

The V1 target is the official final MLB game winner:

- one scheduled game at a time
- pregame only
- home-team and away-team model probabilities
- probabilities sum to `1` within strict deterministic validation tolerance
- one predicted winner or an explicit `NO_SELECTION` state
- extra innings are included as part of the final game

Deferred out of Phase 8A planning scope:

- run line
- totals
- player props
- inning predictions
- live predictions
- sportsbook market targets

## 7. Prediction target

**Official final game winner, including extra innings.**

Selection criteria:

- one scheduled MLB game at a time
- home-team and away-team win probabilities
- probabilities sum to `1` within strict deterministic validation tolerance
- one predicted winner, or `NO_SELECTION`

Outcome classification rules:

- **postponed:** no prediction issued while postponed; racing with post-fact issuance is deferred to result-ingestion evidence.
- **cancelled:** no prediction issued; `NO_SELECTION` with reason `GAME_CANCELLED`.
- **suspended:** remain pending until an official final or terminal status is available; exact expiration policy is decided in the result-ingestion phase using provider and league-status evidence; do not invent fixed expiration windows in Phase 8A.
- **doubleheaders:** identified by `gamePk`; each `gamePk` is a separate prediction target.
- **neutral-site games:** represented by venue metadata; home-team advantage logic uses a neutral-site flag, not by overloading a field named `homeAdvantage`.
- **missing or changed starting pitcher:** gracefully degraded via `homePitcherState` and `awayPitcherState`; the prediction contract represents: `available`, `unavailable`, `unconfirmed`, or `changed-after-snapshot`. The fallback model policy is evaluated empirically.
- **prediction lock:** predicts at scheduled start; once past lock, prediction cannot be regenerated except by an explicit audit revision.
- **immutability:** prediction becomes immutable when `lockedAt` is set and the record moves to `LOCKED`; corrections use a new audit record, not in-place mutation.

## 8. MLB V1 sport-data boundary

### 8.1 Required contract metadata

These inputs must be captured in every prediction snapshot:

- game identity
- scheduled start
- home team
- away team
- venue
- neutral-site indicator
- doubleheader identifier
- team recent form
- team quality
- season context
- game status
- data snapshot timestamp
- source timestamp
- data completeness
- model version
- feature version

### 8.2 Candidate model features

These inputs may improve accuracy, but their exact contractual requirement and fallback status must be decided after real-data source evaluation and temporal dataset evidence:

- starting pitcher identity, availability, and performance
- bullpen availability
- lineup availability and confirmed status
- injury or roster status
- weather
- park factors
- home or away splits
- schedule density
- rest
- travel

The starting-pitcher data is a high-priority candidate feature. No production requirement or abstention threshold is considered proven merely because an exploratory scorer currently uses one.

### 8.3 Deferred pending data-source evaluation

- opponent-adjusted form
- bullpen workload

### 8.4 Evidence discipline

Do not claim predictive importance has already been validated for any feature above.
Whether a feature becomes `required`, `candidate`, or `deferred` depends on:

- access to reliable pre-cutoff data
- evidence that its absence materially harms calibration or accuracy
- empirical evaluations on held-out temporal data

**No sportsbook odds, prices, implied probabilities, or market prices are permitted.**

## 9. Real-data ingestion architecture

The repository already provides a provider-neutral research data boundary (`src/lib/research-data/mode.ts:9`).
MLB V1 extends this pattern for prediction use.

### 9.1 Boundary design

- **Source adapters:** one adapter per provider behind provider-neutral interfaces.
- **Immutable raw payload retention:** primary MLB Stats API responses stored verbatim in `rawPayload` for reproducibility.
- **Canonical sport-data schema:** maps to canonical MLB pregame snapshot with fields from `src/lib/research-data/types.ts`.
- **Source timestamps:** captured as `sourceTimestamp` (event time from payload) and `retrievalTimestamp` (fetch time).
- **Pregame cutoff timestamps:** each prediction run records `dataCutoffAt`; no post-cutoff field may enter the snapshot.
- **Idempotent ingestion:** identical `gamePk` + `dataCutoffAt` yields same snapshot.
- **Duplicate handling:** last duplicate before cutoff wins.
- **Late corrections:** any field change after cutoff is ignored; logged as `LATE_CORRECTION_DISCARDED`.
- **Missing fields:** recorded in `dataCompleteness`; below threshold triggers abstention.
- **Provider outages:** retry with exponential backoff; if unavailable, abstain with `DATA_UNAVAILABLE`.
- **Retry behavior:** max 3 retries, 500ms base delay, retryable status codes `408, 429, 502, 503, 504` (pattern from `src/lib/research-data/mlb/stats-api-client.ts:58`).
- **Backfill behavior:** may be evaluated for stale data recovery in later phases; final policy is evidence-gated and versioned.
- **Schema versioning:** `featureVersion` included in every snapshot.
- **Data provenance:** `source`, `fetchedAt`, `sourceTimestamp`, `isLive`, `warnings`.
- **Licensing/configuration boundary:** no sportsbook or odds provider is considered; MLB Stats API remains the default acceptable source.

## 10. Historical labelled dataset construction

### 10.1 Time-safe pipeline

- **pregame feature snapshot:** cloned via `buildHistoricalSnapshot` pattern (`src/lib/backtesting/mlb/snapshot-builder.ts:16`); frozen after construction.
- **feature-availability timestamp:** `fetchedAt` per feature group.
- **prediction cutoff:** explicit cutoff date per game.
- **actual final result:** immutable `MLBGameOutcome` from provider.
- **label availability timestamp:** `resultTimestamp`.
- **season:** from `game.officialDate`.
- **game identity:** `gamePk`.
- **model-training eligibility:** metadata flag; excluded if cutoff too late, status not `FINAL`, duplicate, or features missing.
- **data completeness:** numeric completeness flag.
- **exclusion reason:** explicit enum when ineligible.

### 10.2 Leakage protections

- no post-cutoff feature updates
- no completed-game fields in pregame inputs
- no future rankings or aggregates before the game
- no season-ending summaries before cutoff
- no future schedule knowledge beyond available public schedule
- no revised injury or lineup information after prediction lock
- no label-derived features
- no random train/test split across time
- rolling temporal splits only

### 10.3 Splits

- **training window:** prior full seasons.
- **validation window:** holdout season.
- **test window:** most recent completed season.
- **season holdout:** enforced blocker; current season must not appear in training when used for evaluation.
- **backfill rules:** exact backfill windows are deferred to temporal evidence review; final policy must be versioned and auditable.
- **reproducible dataset version:** `datasetVersion` string + `datasetFingerprint` hash.
- **dataset fingerprint:** SHA-256 of concatenated canonical game IDs + feature version + cutoff date range.

## 11. Leakage prevention

Rules:

- All MLB V1 prediction code must import from `src/prediction/*` namespaces only.
- No MLB V1 source may import from `src/lib/odds/*`, `src/lib/multi-builder/*`, `src/lib/candidate/*`, `src/types/candidate.ts`, `src/types/leg.ts`, `src/types/multi.ts`, `src/fixtures/phase0.ts`, or `prisma/schema.prisma`.
- No MLB V1 source may accept odds, markets, implied probabilities, or payout in inputs.
- No MLB V1 source may execute `prisma.*` queries.
- Prediction snapshots must be `deepFreeze`d after construction.
- Any prohibited field present in a snapshot, record, or payload must raise a validation error and be treated as an unsafe input.

## 12. Forecasting strategy

Baseline-first approach.

Candidates:

- **Naive home-team baseline:** always predicts home side; `researchStrengthScore = 0`, `confidence = 0`, `abstained = true`.
- **Team-strength statistical baseline:** uses OPS and allowed runs differential; `src/prospective/mlb/team-recent-form-research.ts` provides a closed-form deterministic comparator.
- **Regularized logistic model:** recommended first trained model.
- **Tree-based boosting model:** challenger if logistic is insufficient.
- **Ensemble:** deferred until one production model is validated.

Selection criteria:

- out-of-sample log loss
- Brier score
- accuracy
- calibration error
- reliability
- stability across seasons
- performance under missing-data fallbacks
- reproducibility
- inference simplicity

**Recommended first production model:** regularized logistic model.
Reason: simple, calibrated, reproducible, lowest contamination surface.

Model versioning: arithmetic version string, e.g. `logistic-v1`.
Reproducible training: fixed random seed, deterministic feature snapshot, dataset fingerprint required.

## 13. Probability calibration

Future calibration concepts:

- raw model probability: logistic output before calibration.
- calibrated probability: produced by a method selected from held-out temporal data.
- Training-only calibration fitting: calibrator fit on validation set only; frozen at model publish.
- Held-out calibration testing: separate test-season calibration curves.
- Probability bounds and sum-to-one tolerance are named versioned configuration values established after temporal holdout evaluation.
- Rounding rules: 3 decimal places for display; 8 decimal places in internal metadata.
- Display precision: 3 decimal places.
- Internal precision: number.

Evaluation concepts:

- reliability bins
- Brier score
- log loss
- expected calibration error
- accuracy by confidence band
- performance by season
- performance by data-completeness tier

No calibration method, sample threshold, or probability limit is finalized in Phase 8A.

## 14. Winner selection

Selection uses versioned configuration concepts:

- `selectionProbabilityThreshold`
- `selectionMarginThreshold`
- `maximumSnapshotAge`

Abstention / `NO_SELECTION` states:

- `NO_SELECTION` — model did not meet configured threshold.
- `INSUFFICIENT_DATA` — data completeness below configured threshold.
- `MODEL_UNAVAILABLE` — no trained model.
- `STALE_DATA` — feature snapshot older than `maximumSnapshotAge`.

Prediction lock: `locksAt` = scheduled start; once past lock, prediction cannot be regenerated except by an explicit audit revision.

Changed-input handling before lock: if a new pregame snapshot modifies completeness below threshold, prior draft is discarded and record is marked `NO_SELECTION`.

Prohibited reasons: never choose a predicted winner because of price, payout, odds, market popularity, or bookmaker movement.

## 15. Multi-construction plan

MLB V1 constructs multis from independent game predictions only.

Scope:

- eligible selections: `predictedWinnerId` records with `confidenceTier >= MEDIUM`.
- minimum model confidence: `selectionProbabilityThreshold`.
- maximum leg count: `3` legs for V1.
- same-game prohibition: enforced by `allowedGames` uniqueness dedupe.
- duplicate-game prohibition: same as above.
- duplicate-team exposure: maximum `1` leg per team across a multi.
- time-overlap handling: overlapping games are allowed; correlation is reduced by exposure cap.
- correlation handling: correlation flags only from same-day, same-team, or same-pitcher tags.
- data-completeness requirements: completeness >= configured threshold.
- model-version consistency: all legs must share the same `modelVersion`.
- prediction-lock requirements: all legs must have `lockedAt` set.
- maximum multis per slate: `maximumMultisPerSlate`.

Deterministic tie-breaking:

- multi quality tier
- aggregate internal confidence
- aggregate uncertainty
- data-completeness tier
- correlation penalty
- earliest lock time
- stable ordered prediction IDs as the final tie-breaker

The contract must guarantee:

> same input records + same configuration version = identical multis

`NO_MULTI` state: when fewer than 2 eligible predictions exist.
Internal multi quality score: based on average `confidenceTier`, completeness, exposure cap, correlation penalty — never `combinedOdds` or `decimalOdds`.

## 16. Staking-guidance plan

Planning recommendation: hybrid fixed-unit guidance with hard exposure caps.

Unit tiers, bankroll-fraction caps, and related thresholds are versioned configuration.
Final numerical values are established only after calibrated out-of-sample evaluation.

Basis:

- model confidence
- calibrated historical reliability
- uncertainty
- data completeness
- number of multi legs
- selection correlation
- daily exposure
- team exposure
- model version
- recent validated model stability
- versioned bankroll-percentage and fixed-unit caps

Prohibited inputs:

- odds
- potential payout
- expected monetary value
- Kelly Criterion
- bookmaker limits
- price movement

Staking rules:

- Multis receive stricter limits than single selections.
- Daily, team, and correlated exposure caps are enforced.
- `NO_STAKE` when the model is uncalibrated or when fewer than the configured `minimumGradedPredictionsForStaking` have been evaluated.
- Uncalibrated or insufficiently evaluated models produce `NO_STAKE`.
- Staking never uses odds, payout, market data, expected monetary value, or Kelly calculations.

Exact unit and bankroll values are deferred to the dedicated staking phase.

## 17. Prediction records

Minimum fields:

```text
predictionId
gameId
sport
modelVersion
datasetVersion
featureSnapshotId
generatedAt
dataCutoffAt
locksAt
lockedAt
homeTeamId
awayTeamId
homeWinProbability
awayWinProbability
predictedWinnerId
selectionStatus
confidenceTier
uncertaintyTier
dataCompleteness
inputFingerprint
predictionFingerprint
```

Immutable fields after lock: `predictedWinnerId`, `homeWinProbability`, `awayWinProbability`, `selectionStatus`.
Corrections after lock: create an audit revision record with `correctionType` and `correctedAt`.

No sportsbook or price information is stored.

## 18. Multi and staking records

The multi and staking record schemas are deferred.
Final field shapes, tier definitions, and required metadata are planned concepts only.
No MLB V1 Phase 8A boundary defines completed multi or staking record contracts.

Required record concepts:

- multi recommendation
- multi legs
- staking recommendation
- exposure summary

No record may include odds or payout.

## 19. Post-game result ingestion and grading

Result ingestion uses canonical MLB outcome status and winner semantics.

- **official final status:** `FINAL`, `POSTPONED`, `CANCELLED`, `SUSPENDED`.
- **winner / loser:** from canonical outcome.
- **extra innings:** included in final status.
- **final score:** recorded when available.
- **result source / result timestamp / grading timestamp:** audit fields.
- **Grading behavior:**
  - `correct` / `incorrect` when `FINAL` and prediction locked.
  - `void` when the prediction predates a post-fact cancellation or terminal status.
  - `ungraded` when no outcome yet.
  - `pending` when awaiting official source.
  - `data dispute` when conflicting sources.
  - **result correction:** create auditable grading revision, never mutate original grade.
- **No result data enters pregame feature snapshots.**

Suspension timeout and result availability expiration are deferred to the result-ingestion phase using provider and league-status evidence.

## 20. Performance and calibration reporting

Approved metrics:

- total locked predictions
- graded predictions
- pending predictions
- accuracy
- log loss
- Brier score
- calibration error
- accuracy by confidence tier
- accuracy by probability band
- performance by model version
- performance by season
- performance by month
- performance by data-completeness tier
- abstention rate
- multi leg hit rate
- complete multi hit rate
- staking-unit exposure
- staking-unit outcome tracking

Prohibited metrics:

- ROI
- profit / loss based on bookmaker payout
- yield
- closing-line value
- expected value

Unit outcome tracking records whether the recommended selection or multi succeeded, but never invented monetary returns without odds.

## 21. Production UI scope

Exact V1 routes:

| Route | Purpose |
| --- | --- |
| `/dashboard` | existing dashboard; prediction summary to be evolved |
| `/mlb/predictions` | upcoming locked and unlocked predictions |
| `/mlb/predictions/[predictionId]` | single prediction detail |
| `/mlb/multis` | active and historical multi recommendations |
| `/mlb/performance` | accuracy, calibration, performance tables |
| `/mlb/methodology` | odds-blind methodology statement |

Required UI concepts:

- upcoming locked and unlocked predictions
- predicted winner
- model probability
- confidence
- uncertainty
- data completeness
- prediction timestamp
- cutoff timestamp
- model version
- selection status
- `NO_MULTI` / `NO_STAKE` reasons
- grading status
- actual result
- historical accuracy
- calibration
- odds-blind methodology statement

No UI may show or request sportsbook odds.

## 22. Deployment and operations

- **Environment separation:** `development`, `staging`, `production`.
- **Database selection:** PostgreSQL with isolated schema for MLB V1 prediction records.
- **Migration strategy:** automated Prisma migration in staging only; promotion-tagged in production.
- **Secret handling:** secrets via environment; stored only in production secret manager, never in repository.
- **Scheduled operation:** `prediction lock scheduler`, `result ingestion scheduler`, `grading scheduler`.
- **Retry behavior:** same retry/backoff as ingestion.
- **Idempotency:** prediction and grading jobs use deterministic idempotency keys.
- **Logging:** redact all fields that contain model probability or game result; no raw provider payloads beyond retention window.
- **Health checks:** `/api/health` checking database connection, provider reachability, prediction lock freshness.
- **Monitoring:** latency, abstention rate, daily prediction count, grading lag.
- **Model artifact storage:** versioned artifact registry; immutable once promoted.
- **Dataset artifact storage:** versioned artifact bucket keyed by `datasetVersion`.
- **Rollback:** protected production branch, immutable release tags, manual promotion, last-known-good rollback to previous tag.

## 23. Release gates

States:

```text
NOT READY
SHADOW READY
EVALUATION READY
MLB V1 RELEASE READY
```

Gate checklist:

- [ ] odds-contamination audit complete
- [ ] no odds-related imports in prediction namespaces
- [ ] historical dataset reproducible
- [ ] leakage tests pass
- [ ] temporal holdout evaluation complete
- [ ] model beats naive baseline on log loss, Brier, accuracy
- [ ] calibration evaluated
- [ ] predictions immutable after lock
- [ ] real-data ingestion stable
- [ ] grading works
- [ ] performance reporting works
- [ ] multi construction deterministic
- [ ] staking controls enforced
- [ ] UI acceptance complete
- [ ] production scheduling tested
- [ ] rollback tested
- [ ] documentation complete

No profitability gate is invented.

## 24. Shared versus MLB-specific boundary

| Subsystem | MLB-specific? | Future shared candidate? | Reason | Do not generalize yet? |
| --- | --- | --- | --- | --- |
| Raw source adapters | Yes | No | Odds-blind contract suffices for MLB V1; others need independent evaluation | Yes |
| Canonical game snapshot | Yes | No | Baseball-specific fields, doubleheaders, pitcher availability | Yes |
| Feature engineering | Yes | No | MLB-specific weights, pitcher features | Yes |
| Historical labels | Yes | No | Sport-specific result semantics, extra innings | Yes |
| Dataset versioning | Yes | No | MLB-specific schema and feature set | Yes |
| Model training interface | Yes | No | First logistic baseline only | Yes |
| Model artifact metadata | Yes | No | MLB model versioning | Yes |
| Prediction records | Yes | Yes | Shared after MLB V1 proves contract | No |
| Prediction locking | Yes | Yes | Shared after MLB V1 | No |
| Multi records | Yes | Yes | Shared only after MLB V1 contract | No |
| Staking records | Yes | Yes | Shared only after MLB V1 contract | No |
| Grading | Yes | Yes | Shared after MLB V1 | No |
| Performance metrics | Yes | Yes | Shared after MLB V1 | No |
| Scheduler | Yes | Yes | Shared after MLB V1 | No |
| UI shell | Yes | Yes | Shared after MLB V1 | No |
| Monitoring | Yes | Yes | Shared after MLB V1 | No |

Generalization only after three successful sport verticals use identical interface.

## 25. Complete MLB V1 phase sequence

| Phase | Purpose |
| --- | --- |
| **Phase 8B** | MLB V1 prediction-domain contract and odds-contamination firewall |
| **Phase 8C** | Real-data source evaluation and canonical snapshot contract |
| **Phase 8D** | Historical labelled dataset and leakage protections |
| **Phase 8E** | Baseline forecasting model |
| **Phase 8F** | Model evaluation and calibration |
| **Phase 8G** | Immutable prediction records and locking |
| **Phase 8H** | Real-data scheduled inference |
| **Phase 8I** | Result ingestion and grading |
| **Phase 8J** | Performance reporting |
| **Phase 8K** | Multi-construction engine |
| **Phase 8L** | Staking-guidance engine |
| **Phase 8M** | MLB prediction UI |
| **Phase 8N** | Shadow deployment |
| **Phase 8O** | Evaluation hardening |
| **Phase 8P** | MLB V1 production release |

Each phase has an explicit gate review before the next begins.

## 26. Exact Phase 8B implementation boundary

### Purpose

Implement the MLB V1 prediction-domain contract and odds-contamination firewall.

### Exact source file paths

- `src/prediction/mlb/mlb-prediction-contract.ts`
- `src/prediction/firewall/odds-contamination-guard.ts`

### Exact test file paths

- `tests/prediction/mlb/mlb-prediction-contract.test.ts`
- `tests/prediction/firewall/odds-contamination-guard.test.ts`

### Exact documentation paths

- `docs/mlb-v1-prediction-contract-implementation.md`
- `README.md`

### Whether README changes

Yes. Phase 8B adds a Phase 8B status block to `README.md`.

### Exact public types

- `MLBPredictionInputContract`
- `MLBPredictionDraftContract`
- `MLBPredictionSelectionStatus`
- `MLBPredictionContractValidationIssue`
- `OddsContaminationViolation`

### Exact public functions

- `validateMLBPredictionInputContract(value: unknown)`
- `validateMLBPredictionDraftContract(value: unknown)`
- `assertNoOddsContamination(value: unknown)`
- `isProhibitedOddsKey(key: string)`

### Forbidden import/query boundaries

MLB V1 prediction sources must not import:

- `src/lib/odds/*`
- `src/lib/multi-builder/*`
- `src/lib/research/mlb/module.ts`
- `src/lib/research/mlb/scorers.ts`
- `src/fixtures/phase0.ts`
- `src/types/candidate.ts`
- `src/types/leg.ts`
- `src/types/multi.ts`
- `prisma/schema.prisma`
- `@prisma/client`
- `src/server/actions.ts`
- `src/server/db.ts`

### Recursive prohibited-key behavior

- `assertNoOddsContamination` recursively scans stringified objects for keys matching:
  - `decimalOdds`, `combinedOdds`, `bookmaker`, `marketAvailable`, `primaryBookmaker`, `bookmakerTotals`, `profitLoss`, `oddsSampleId`, `pricedCandidateId`, `impliedProbability`, `sportsbook`, `edge`, `roi`, `expectedValue`, `Kelly`, `payout`
- Any match throws an `OddsContaminationViolation` error.

### Synthetic test strategy

- generative synthetic data using deterministic builders (no randomness).
- negative tests inject prohibited fields and verify rejection.
- namespace boundary tests verify prediction path accepts only `src/prediction/*` paths.

### Exact intended test count

`20` intended tests across exactly `2` test files.

| File | Tests |
| --- | --- |
| `tests/prediction/mlb/mlb-prediction-contract.test.ts` | 10 |
| `tests/prediction/firewall/odds-contamination-guard.test.ts` | 10 |

`tests/prediction/mlb/mlb-prediction-contract.test.ts` categories:

- minimal valid input contract
- draft contract shape and stability
- official-final-winner metadata validation
- pregame timestamp requirements
- home/away team identity separation
- neutral-site representation
- doubleheader stable game identity
- explicit availability states
- selection-status validation
- malformed or unknown-field rejection

`tests/prediction/firewall/odds-contamination-guard.test.ts` categories:

- recursive prohibited-key rejection
- case-normalized prohibited keys
- nested arrays and objects
- sportsbook fields
- price and payout fields
- market-implied probability
- price-derived value or edge
- Kelly fields
- safe model-generated probability fields
- safe sport-data fields

### Exact validation commands

```bash
npx vitest run tests/prediction --reporter=verbose
npm run inventory:mlb-fixtures
npm run prospective:mlb:dry-run-check
npx vitest run tests/leakage.test.ts --reporter=verbose
npx vitest run tests/prospective/mlb-report-preview-* --reporter=verbose
npx vitest run tests/backtesting --reporter=verbose
npx tsc --noEmit --incremental false --pretty false
npm test
npm run build
git diff --check
```

### Authorized files

- `src/prediction/mlb/mlb-prediction-contract.ts`
- `src/prediction/firewall/odds-contamination-guard.ts`
- `tests/prediction/mlb/mlb-prediction-contract.test.ts`
- `tests/prediction/firewall/odds-contamination-guard.test.ts`
- `README.md`
- `docs/mlb-v1-prediction-contract-implementation.md`

### Prohibited files

- No modification of `prisma/schema.prisma`.
- No modification of `.env` or environment files.
- No modification of existing MLB prospective, backtesting, dashboard, report-preview, server, or legacy Odds files.
- No modification of `src/lib/odds/*`, `src/lib/multi-builder/*`, `src/types/candidate.ts`, `src/types/leg.ts`, `src/types/multi.ts`, `src/fixtures/phase0.ts`.

### Phase 8B exclusions

Phase 8B does not implement:

- trained model output
- historical datasets
- real provider ingestion
- database persistence
- Prisma imports
- prediction locking persistence
- winner recommendations
- multi records
- multi construction
- stake records
- staking guidance
- routes
- UI
- deployment

## 27. Existing schema decision

**Option A — Isolate and leave dormant for MLB V1.**

This is the only current Phase 8A decision.

Reasoning:

- The existing `/dashboard` route (`src/app/(app)/dashboard/page.tsx:7`) actively reaches legacy database-backed `Multi` and `Leg` records through `src/server/actions.ts:12`.
- Removing `OddsSample`, `PricedCandidate`, `Event.oddsSamples`, `Refresh.oddsFetched`, or related legacy schema entries now widens risk to the existing Stage 2 dashboard.
- New MLB V1 namespaces must be isolated instead.
- No new MLB V1 source may import or query odds-related persistence.
- Later removal is a separate evidence-gated decision after legacy dependencies are replaced or retired.

`/mlb/report-preview` is local, deterministic, and not observed to reach legacy odds or database code.

## 28. Deferred work

- Real MLB Stats API ingestion end-to-end production deployment
- Model training artifact pipeline and registry
- MLB V1 probability calibration method selection and parameterization
- Multi-construction deterministic engine with finalized limits
- Staking engine and exposure control parameters
- MLB prediction UI and acceptance testing
- Scheduled prediction locks and result grading
- Production monitoring and alerting
- Tennis and other sport generalization
