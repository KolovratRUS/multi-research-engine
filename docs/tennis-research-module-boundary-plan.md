# Tennis Research Module Boundary Plan

## 1. Phase status

Phase 7A is planning-only.
This document defines the first safe Tennis implementation slice beside the existing MLB research modules.
No Tennis source code, tests, fixtures, goldens, scripts, commands, pages, routes, database models, Prisma changes, or UI components are added.

## 2. Locked baseline

f04fafbe879a7bd5b86ae0b24c10f54447adfd54
Record MLB report preview browser acceptance

## 3. Product-purpose layers

This plan distinguishes three layers:

A. First Tennis pre-match input contract
B. Future sport-data and training layers
C. Future downstream outputs

### A. First Tennis pre-match input contract

The first Tennis contract accepts only synthetic/local pre-match inputs.
It is not prediction-free for the entire product; it is pre-match-only for the first slice.

The first contract rejects post-match information and downstream outputs:
- winner, loser
- final score, set scores
- completed status, retirement result, walkover result
- match outcome, result, result status, final status
- predicted winner, model probability, recommendation
- multi membership, stake
- odds, prices, sportsbooks, markets, implied probability from price, market movement, price-derived value/edge, payout information

Result information must not appear under alternate, nested, or metadata-like names.
A future recursive prohibited-key and prohibited-text validator must enforce this boundary across nested objects and string values. Do not implement it before the Tennis domain contract exists.
Pre-match researchStatus values describe research state only; they must not encode results.

### B. Future sport-data and training layers

Later explicitly planned Tennis phases may use time-safe sport data when explicitly planned and protected against future-data leakage:
- historical results
- historical rankings
- surface history
- player form
- schedule and rest information
- other Tennis performance data

These layers must enforce strict timestamp cutoffs and prevent future-data leakage.
They are not prohibited from the product, but they are not part of the first Tennis contract.

### C. Future downstream outputs

Later Tennis forecasting layers are intended to produce odds-blind outputs:
- model-generated probabilities
- predicted winners
- recommended selections
- multi-bet construction
- staking guidance
- prediction timestamps
- post-match grading
- calibration and performance reporting

These outputs are not part of Phase 7B, but they are valid and intended future capabilities.
They must remain entirely odds-blind.

## 4. Repository evidence

Key inspected files:
- README.md — MLB-phase narrative, odds-blind boundary, deterministic fixture mode, Stage 1 research rules.
- prisma/schema.prisma — PostgreSQL models for odds, research candidates, pricing, multis, and legs. No research-only tables.
- package.json and tsconfig.json — MLB scripts; strict TS with Next bundler resolution.
- vitest.config.ts — Node environment, tests/**/*.test.ts(x).
- src/prospective/mlb/team-recent-form-research.ts — construction-package handoff, recursive forbidden-field validation, explicit mode flags, stable validation codes.
- src/prospective/mlb/weekly-research-construction.ts — locked-artifact construction, deterministic filename/relative path rules, no-flag / file-output separation.
- src/prospective/mlb/research-report-adapter.ts — typed safe-input contract, safety assertions, prohibited-field thinking.
- src/prospective/mlb/report-preview-ui-adapter.ts — deterministic adapter nodes with ADAPTER_FORBIDDEN_KEYS.
- src/app/(app)/dashboard/page.tsx — imports /server/actions directly and hits the database-backed dashboard.
- src/app/(app)/mlb/report-preview/page.tsx — imports /prospective/mlb/report-preview-local-page-document directly.
- src/app/layout.tsx — root layout only; no intermediate layout exists under the app-group route.
- No Tennis source/test/doc files exist today.

## 5. Permanent odds-contamination boundary

Permanently prohibited from entering or influencing any Tennis research, training, feature generation, forecasting, winner selection, multi construction, staking, grading, or presentation:
- sportsbook odds
- betting prices
- implied probabilities derived from odds
- market movement
- bookmaker consensus
- market comparison
- value calculations based on price
- edge calculations based on price
- payout information
- Kelly calculations
- line shopping

No Tennis source may import, query, reference, populate, or depend on odds-related Prisma models or market-derived records.

## 6. Existing odds-related persistence classification

The repository already defines odds-related Prisma models:
- OddsSample
- PricedCandidate

These are existing odds-related persistence concepts:
- not reusable by Tennis
- outside the Tennis research boundary
- outside the future odds-blind forecasting, selection, multi, and staking path
- requiring a dedicated isolation/audit decision before MLB V1 production work

The immediate MLB V1 boundary phase must audit all odds-related schema, source, tests, routes, and documentation to ensure they cannot influence the new MLB forecasting path.
Do not delete or refactor them during Phase 7A.

## 7. Roadmap

After Phase 7A is reviewed, committed, and pushed:
1. Tennis implementation is paused.
2. Phase 7B remains the planned next Tennis implementation phase when Tennis resumes.
3. The immediate next project work is the complete odds-blind MLB V1:
   - MLB V1 prediction-system boundary;
   - odds-contamination audit and isolation;
   - historical labelled dataset construction;
   - leakage prevention;
   - forecasting model;
   - model probabilities;
   - predicted winners;
   - multi construction;
   - staking guidance;
   - real MLB data ingestion;
   - immutable prediction tracking;
   - post-game grading;
   - performance and calibration reporting;
   - usable Next.js product;
   - production deployment.
4. Tennis resumes from Phase 7B after MLB V1 is operating and generating real testable predictions.

## 8. Reuse classification

| Current repository concept | Current path | Reuse classification | Reason | Phase 7B action | Risk if reused incorrectly |
|---|---|---|---|---|---|
| Deterministic validators | src/prospective/mlb/team-recent-form-research.ts and sibling schemas | Structurally reusable without modification | Validation message shape, recursive forbidden-field checks, and top-level/per-field rules are generic. MLB interfaces must not be imported into Tennis. | Copy validator shape in new Tennis file. | Shared interface imports create coupling and migration risk. |
| Artifact versioning | Construction and module version literals in MLB files | Structurally reusable without modification | Versioned packages are a strong local pattern. | Use Tennis-specific versions. | Shared version strings couple sport lifetimes. |
| Manual/local input boundaries | Manual schedule files, --fixture-evidence-local flags | Structurally reusable without modification | Explicit local-only input boundary is the safety model. | Mirror as synthetic-local input boundary. | Reusing paths or flags would be misleading. |
| Research package construction | src/prospective/mlb/weekly-research-construction.ts | MLB-specific and not reusable for first slice | Consumes MLB lock artifacts and produces MLB packages. | Defer. | Extraction is riskier than adding Tennis-only source. |
| Report adapters | src/prospective/mlb/research-report-adapter.ts, report-preview-ui-adapter.ts | Structurally reusable without modification | Typed safe-data contract, adapter nodes, forbidden-keys set, and display label choices are reusable patterns. MLB types must not be imported into Tennis. | Replicate adapter pattern with Tennis types later. | Reusing MLB adapter input types introduces sport-specific leakage. |
| Renderers | src/prospective/mlb/research-report-renderer.ts | Structurally reusable without modification | Renderer boundaries between input, sections, and safety assertions are reusable. | Mirror in Tennis; do not import MLB renderer. | MLB labels and module names would bleed into Tennis output. |
| UI view models | src/prospective/mlb/report-preview-ui-view-model.ts | Structurally reusable without modification | View-model shape and safe-label mapping are reusable. | Replicate with Tennis names. | Reusing MLB view model embeds prohibited Tennis-named research contexts. |
| Next.js routes | src/app/(app)/mlb/report-preview/page.tsx and src/app/(app)/dashboard/page.tsx | MLB-specific and not reused | /mlb/report-preview is beside /dashboard; dashboard imports /server/actions directly and touches Prisma. | Add Tennis routes only in later phase after first contracts are stable. | Coupling Tennis routes to MLB imports or dashboard state breaks the independence boundary. |
| MLB team recent-form logic | src/prospective/mlb/team-recent-form-research.ts, aggregate/schedule/quality siblings | MLB-specific and not reusable | Baseball-specific lookback, completion semantics, pitcher-leakage rules, and context. | No Tennis import. | Unintended MLB concepts and prohibited raw outcomes would enter Tennis. |
| MLB schedule context | src/prospective/mlb/team-schedule-context.ts | MLB-specific and not reusable | Schedule-density and rest/travel semantics are sport-specific. | No Tennis import. | Not applicable to minimal Tennis slice. |
| MLB team-quality context | src/prospective/mlb/team-quality-context.ts | MLB-specific and not reusable | Opponent comparison logic is baseball-specific. | No Tennis import. | Defense/modifier context must be redesigned for Tennis. |
| Fixture inventories | tests/prospective/fixtures/manual-schedule/ | Structurally reusable without modification | The directory organization and byte-for-byte golden philosophy are reusable. | Create tests/prospective/fixtures/tennis/ for Tennis. | Reusing MLB fixtures would normalize MLB field names. |
| Stdout golden strategy | Committed JSON fixtures under tests/prospective/fixtures/manual-schedule/ | Structurally reusable without modification | Static deterministic golden files are the local regression model. | Apply same exact-cmp strategy to Tennis CLI outputs when CLI is added. | Premature CLI goldenning is out of Phase 7B scope. |
| Prohibited-field validation | Recursive forbidden-field, absolute-path, environment-metadata rejection | Structurally reusable without modification | Rejection shape is sport-neutral; field sets are sport-specific. | Maintain Tennis-specific prohibited-field sets. | Missing Tennis-specific forbidden keys allows leakage. |
| Prohibited-text validation | Safety wording checks | Structurally reusable without modification | Negative wording policy is generic. | Include Tennis safety wording review in every future implementation phase. | Omission leaves room for odds-contamination drift. |
| Database / Prisma layer | prisma/schema.prisma, src/server/actions.ts | Not reused in first Tennis slice | Tennis slice remains local-only deterministic research first. | No Prisma changes in Phase 7B. | Introducing DB reads requires persistence decisions outside this slice. |

## 9. Tennis starting scope

Default to Option A — Tennis-specific contract first.

Justification:
- Reusable behavior is encoded in MLB-named files under src/prospective/mlb/ and docs/mlb-*.
- Extracting a shared primitive would rename/wrap existing MLB types and tests; this widens risk.
- The first Tennis slice is a single domain contract file; it is smaller than any shared primitive.
- Exact compatibility tests can later protect the MLB boundary when shared extraction is evaluated.

First Tennis scope:
- singles only
- one match at a time
- pre-match research only
- synthetic/local inputs only
- no doubles
- no team competitions
- no live data ingestion
- no result fields in pre-match contract
- no rankings ingestion in first contract
- no predictions in first contract
- no winner selection in first contract
- no web UI
- no API routes
- no database persistence
- no file-output commands
- no CLI integration
- no odds or market data

Why singles only is the safest first boundary:
- Singles maps cleanly to one participant per side and one canonical match object.
- Doubles and team competitions introduce membership, partnership, and multi-entity state that expand the contract without need.
- Pre-match synthetic input avoids outcome data and completion semantics entirely.
- Local-only deterministic boundaries preserve the repository's existing safety posture.

## 10. Tennis domain concepts

Exact first-contract fields:

| Field | Classification | Notes |
|---|---|---|
| matchId | required | Synthetic stable local identifier for tests and future local inputs. |
| competitionId | required | Synthetic stable identifier. No live external tie. |
| competitionName | deferred | Display label is omitted first; prefer deterministic IDs until synthetic-display-name rules are locked. |
| round | optional | Safe descriptive string only when explicitly synthetic. |
| surface | required | Enum: HARD, CLAY, GRASS, CARPET, UNKNOWN. |
| indoorOutdoor | required | Enum: INDOOR, OUTDOOR, UNKNOWN. |
| bestOfSets | required | Enum: THREE, FIVE, UNKNOWN. |
| scheduledStart | required | ISO timestamp string synthetic input only. |
| playerA | required | Deterministic synthetic participant ID. |
| playerB | required | Deterministic synthetic participant ID. |
| playerADisplayName | deferred | Synthetic display name is omitted first. |
| playerBDisplayName | deferred | Synthetic display name is omitted first. |
| sourceMode | required | Literal synthetic-local. |
| researchStatus | required | Contract-level status only. |

Recommended enums:

surface: HARD, CLAY, GRASS, CARPET, UNKNOWN
indoorOutdoor: INDOOR, OUTDOOR, UNKNOWN
bestOfSets: THREE, FIVE, UNKNOWN

Competition and player display names are deferred.
Phase 7B keeps identifiers only; display names would need a synthetic-only guard before inclusion.

## 11. First contract field matrix

| Field | Required in first contract | Optional in first contract | Deferred | Prohibited |
|---|---|---|---|---|
| matchId | yes | | | |
| competitionId | yes | | | |
| competitionName | | | yes | |
| round | | yes | | |
| surface | yes | | | |
| indoorOutdoor | yes | | | |
| bestOfSets | yes | | | |
| scheduledStart | yes | | | |
| playerA | yes | | | |
| playerB | yes | | | |
| playerADisplayName | | | yes | |
| playerBDisplayName | | | yes | |
| sourceMode | yes | | | |
| researchStatus | yes | | | |

## 12. Pre-match/result separation

Hard separation rules:

- The first Tennis contract accepts only synthetic pre-match input; it contains no result fields.
- Prohibited field names at any nesting level:
  - winner, loser
  - finalScore, setScores
  - completedStatus, retirementResult, walkoverResult
  - matchOutcome, result, resultStatus, finalStatus
  - predictedWinner, winChance, scorePrediction, outcomePrediction
  - confidenceRanking, recommendedSide, recommendedPlayer
- Result information must not appear under alternate, nested, or metadata-like names.
- Pre-match researchStatus values describe research state only; they must not encode results.

## 13. Validation boundary

Planned first Tennis validation behavior:
- reject missing required top-level fields with stable Tennis-prefixed validation codes;
- reject unsupported sourceMode values;
- reject unsupported enum values;
- reject prohibited result keys recursively;
- reject absolute path strings;
- reject environment metadata/secret patterns;
- reject duplicate matchId values within one input set;
- preserve deterministic validation messages;
- emit no stack traces in invalid-input paths;
- perform no network calls, no filesystem output, no DB access, no current-clock reads.

Target test categories in Phase 7B:
- valid contract passes
- missing required fields
- invalid enum values
- unsupported source mode
- recursive prohibited result keys
- absolute path rejection
- environment metadata rejection
- duplicate matchId rejection
- deterministic message stability

## 14. Phase 7B implementation boundary

Phase 7B exact shape:
- one Tennis domain-contract source file
- one focused validator test file
- one implementation documentation file
- one README update
- no CLI integration
- no research calculations
- no report generation
- no UI
- no database
- no file output
- no external fixtures
- no predictions in first contract
- no rankings ingestion in first contract

Phase 7B status:
- Phase 7B is the next Tennis implementation phase.
- Phase 7B is not the immediate next overall project phase.
- After Phase 7A is committed and pushed, Tennis is intentionally paused.
- The immediate next project work is an MLB V1 prediction-system boundary and odds-contamination audit.
- Tennis resumes from Phase 7B after MLB V1 is operating in real-data evaluation.

## 15. Phase 7B exact file scope

Exact proposed paths:

src/prospective/tennis/tennis-match-contract.ts
src/prospective/tennis/tennis-match-contract.test.ts
docs/tennis-match-contract-implementation.md
README.md

README changes:
- append narrow Tennis Phase 7B status block preserving all existing MLB phase text.

Prohibited paths in Phase 7B:
- no src/prospective/mlb/* changes
- no src/prospective/tennis/* beyond the exact files above
- no scripts/* changes
- no tests/prospective/* changes beyond the exact test file above
- no docs/mlb-* changes
- no prisma/** changes
- no src/app/** changes
- no src/server/** changes

## 16. Phase 7B test plan

Focused test file: src/prospective/tennis/tennis-match-contract.test.ts

Test categories:
- valid synthetic Tennis match passes validation
- missing required fields fail with stable codes
- invalid enum values fail
- unsupported source mode fails
- duplicate matchId fails
- recursive prohibited result keys fail
- absolute path strings fail
- environment metadata patterns fail
- deterministic message stability over repeated invocations
- empty object fails
- should be exactly 12 focused tests in Phase 7B

## 17. Shared architecture decision

Chosen option: Option A — Tennis-specific contract first.

Evidence from repository:
- Reusable validator, adapter, renderer, and view-model shapes exist only inside MLB-named files under src/prospective/mlb/.
- The MLB package interfaces are already stable and protected by exact goldens and 71-test-file coverage; extracting shared primitives now would require renaming/wrapping types or splitting interfaces.
- The first Tennis slice is one contract file; this is smaller than any shared primitive extraction.
- Future shared extraction can occur after Tennis contract and tests show stable names.

## 18. Validation requirements

Phase 7A documentation validation requirements:
- git diff --check
- focused tests/prospective/mlb-report-preview-next-renderer-presentation.test.tsx, tests/prospective/mlb-report-preview-next-renderer.test.tsx, tests/prospective/mlb-report-preview-next-page.test.tsx, tests/prospective/mlb-report-preview-dashboard-navigation.test.tsx
- full prospective and backtesting test suites remain at 649/699/1405
- TypeScript, build, and golden comparisons are unchanged and remain green
- Phase 7A adds only:
  - README.md
  - docs/tennis-research-module-boundary-plan.md
- No source, test, fixture, golden, script, package, configuration, CI, Prisma, database, route, or UI changes.

## 19. Recommended next safe phase

Phase 7B is paused.
The immediate next project work is MLB V1.
Tennis resumes from Phase 7B after MLB V1 is operating and generating real testable predictions.
