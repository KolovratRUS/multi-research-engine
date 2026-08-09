# 1. Phase status

Phase 8B implements the MLB V1 prediction-domain contract and the permanent odds-contamination firewall. Phase 8B is read-only on the real product boundary: it defines the first safe input shape for the prediction namespace, the draft pre-model envelope, and the recursive guard that prevents market-derived data from entering the prediction layer.

# 2. Locked baseline

Locked baseline: `0201fc98c7a5af88477ed3eb8f4a93b0b8dc1e6b`

Baseline commit message: `Plan complete odds-blind MLB V1`

Phase 8A boundary plan updates: `docs/mlb-v1-prediction-system-boundary-plan.md`

Phase 8A odds-contamination audit: `docs/mlb-v1-odds-contamination-audit.md`

# 3. Purpose

This document records the authoritative Phase 8B contract surface so that later phases can wrap real MLB sport-data snapshots and model outputs around the same immutable boundaries.

# 4. Permanent odds-blind boundary

The Multi Research Engine remains odds-blind. Future intended outputs include model-generated probabilities, predicted winners, recommended selections, multi-bet construction, staking guidance, timestamped recommendations, grading, calibration reporting, and performance reporting.

Those outputs must be produced only from sport data and the engine’s own models.

The MLB V1 prediction namespace must never ingest, import, query, accept, store for decision-making, derive from, compare against, or be influenced by sportsbook odds, betting prices, decimal odds, fractional odds, American odds, implied probabilities derived from price, bookmaker consensus, market movement, line movement, price-derived value, price-derived edge, expected monetary value, payout information, Kelly calculations, or line shopping.

# 5. Authorized scope

Phase 8B changes exactly six files:

```text
src/prediction/firewall/odds-contamination-guard.ts
src/prediction/mlb/mlb-prediction-contract.ts
tests/prediction/firewall/odds-contamination-guard.test.ts
tests/prediction/mlb/mlb-prediction-contract.test.ts
docs/mlb-v1-prediction-contract-implementation.md
README.md
```

Exact test counts: 10 tests in `tests/prediction/firewall/odds-contamination-guard.test.ts`, 10 tests in `tests/prediction/mlb/mlb-prediction-contract.test.ts`, 20 tests total.

# 6. Prediction input contract

The prediction input contract is defined by `validateMLBPredictionInputContract` in `src/prediction/mlb/mlb-prediction-contract.ts`.

Contract version: `mlb-prediction-input-v1`

Sport: `MLB`

Target: `OFFICIAL_FINAL_GAME_WINNER`

The target means official final winner, extra innings included, pregame only, one scheduled MLB game at a time.

Game identity fields: `gameId`, `scheduledStartAt`, `homeTeamId`, `awayTeamId`, `venueId` (string | null), `neutralSite` (boolean | null), `doubleheader` (null | { doubleheaderId, gameNumber: 1 | 2 }).

Snapshot fields: `snapshotId`, `capturedAt`, `dataCutoffAt`, `sourceUpdatedAt` (string | null), `dataCompleteness` (`COMPLETE` | `PARTIAL` | `INSUFFICIENT`).

Availability fields: `homeStartingPitcher`, `awayStartingPitcher` using `MLBAvailabilityState`.

Research payload: `researchPayload` accepts arbitrary JSON-compatible sport-research keys, but every nested value must pass the odds-contamination firewall.

# 7. Draft contract

The draft contract is defined by `validateMLBPredictionDraftContract`.

Draft contract version: `mlb-prediction-draft-v1`

Draft fields: `draftId`, `input` (validated input contract), `generatedAt`, `selectionStatus`, `noSelectionReason`.

Stop flag support: `MLBPredictionSelectionStatus` exposes `PENDING_MODEL`, `NO_SELECTION`, `MODEL_ERROR`.

`PENDING_MODEL` requires `noSelectionReason === null`.

`NO_SELECTION` and `MODEL_ERROR` require a non-empty trimmed reason.

# 8. Official-final-winner target

`OFFICIAL_FINAL_GAME_WINNER` is the only valid target literal.

The contract rejects:
- regulation-only targets
- totals
- run line
- innings
- live prediction targets
- sportsbook market targets

The target does not include player props, futures, or any market category.

# 9. Timestamp rules

Timestamp fields must be parseable RFC 3339/ISO-style timestamps with an explicit timezone.

Enforced ordering:
- `snapshot.dataCutoffAt <= snapshot.capturedAt`
- `snapshot.capturedAt < game.scheduledStartAt`
- `snapshot.sourceUpdatedAt <= snapshot.dataCutoffAt` when `sourceUpdatedAt` is not null
- `draft.generatedAt >= input.snapshot.dataCutoffAt`
- `draft.generatedAt < input.game.scheduledStartAt`

The validators do not use the current clock and do not invent a maximum snapshot-age threshold.

# 10. Team and game identity

Validators enforce:
- `homeTeamId !== awayTeamId`
- `neutralSite` is an explicit boolean or null
- `venueId` is a string or null
- `doubleheader` is null or an exact two-field object
- `doubleheader.gameNumber` is exactly 1 or 2
- `doubleheader.doubleheaderId` is a non-empty identifier string

The contract does not model neutral-site status as a `homeAdvantage` boolean.

# 11. Starting-pitcher availability states

`MLBAvailabilityState` accepts:
- `AVAILABLE`
- `UNAVAILABLE`
- `UNCONFIRMED`
- `CHANGED_AFTER_SNAPSHOT`

Arbitrary strings are rejected.

# 12. Research payload boundary

`researchPayload` must be a plain object. Non-plain object instances, functions, symbols, and bigint values are rejected. Arrays, strings, finite numbers, booleans, and null may appear inside the research payload.

Rejected non-JSON-like values include `NaN`, `Infinity`, `-Infinity`, `Date`, `Map`, `Set`, `RegExp`, and custom class instances.

Accessor properties are not JSON-like and return `INVALID_RESEARCH_PAYLOAD_VALUE` without invoking their getters or setters. Arrays are also inspected via property descriptors: numeric accessor elements return `INVALID_RESEARCH_PAYLOAD_VALUE`, and every accessor descriptor is rejected without executing its getter or setter. Safe accessors are classified as `INVALID_RESEARCH_PAYLOAD_VALUE`, not as `ODDS_CONTAMINATION`; a payload with only accessors and no prohibited keys remains an uninspectable payload.

Cyclic structures are not JSON-like and return a stable validation issue rather than hang.

Symbol keys are rejected at every level inside `researchPayload`.

Array own string properties beyond numeric indices are validated for prohibited keys and non-enumerable properties.

Every nested value must pass the odds-contamination firewall.

# 13. Odds-contamination firewall

Firewall source: `src/prediction/firewall/odds-contamination-guard.ts`

Public API:
- `isProhibitedOddsKey(key: string): boolean`
- `assertNoOddsContamination(value: unknown): void`

`UninspectableAccessorPropertyError` is private to the firewall module. The MLB contract does not import the private error class; it classifies the error through the stable internal error name `UninspectableAccessorPropertyError` and the stable message prefix `UNINSPECTABLE_ACCESSOR_PROPERTY\n`. The firewall public API remains limited to one structured type and two functions.

Recursion safety:
- Uses an active-branch `WeakSet<object>` with `try/finally` cleanup to prevent infinite recursion while re-inspecting shared objects under independent alias paths.
- Adds a traversed object or array before descending and removes it after that branch finishes.
- Reports violations at every independent alias path rather than deduplicating by first encounter.

Input handling:
- Inspects plain objects by recursive key inspection.
- Inspects canonical numeric array properties via `Object.getOwnPropertyDescriptor` before reading values.
- Traverses the complete inspectable structure and aggregates two independent categories: odds violations and uninspectable accessor paths.
- Numeric accessors are never executed.
- Prohibited accessor keys are recorded as `PROHIBITED_ODDS_KEY` and never invoke their getters or setters.
- Non-prohibited accessors are recorded as `UNINSPECTABLE_ACCESSOR_PROPERTY` and never invoke their getters or setters.
- Newer sibling violations are never hidden behind an earlier accessor encounter.
- Inspects every additional own string property on arrays, including non-enumerable properties.
- Inspects actual symbol-valued properties on arrays deterministically.
- Uses property descriptors to avoid invoking accessor getters during validation.
- Never mutates input.
- Never silently removes or renames data.
- Never reads environment variables, files, database state, network state, current time, or random state.

# 14. Prohibited keys and string values

Normalized prohibited keys include, but are not limited to:
`odds`, `decimalOdds`, `fractionalOdds`, `americanOdds`, `combinedOdds`, `marketOdds`, `sportsbook`, `bookmaker`, `primaryBookmaker`, `bettingPrice`, `price`, `pricing`, `payout`, `potentialPayout`, `impliedProbability`, `marketImpliedProbability`, `marketProbability`, `marketMovement`, `lineMovement`, `expectedValue`, `valueEdge`, `edge`, `kelly`, `kellyFraction`, `roi`, `yield`, `profit`, `profitLoss`, `oddsSampleId`, `pricedCandidateId`, `marketAvailable`.

Key normalization:
- lowercased
- spaces removed
- hyphens removed
- underscores removed
- other non-alphanumeric separators removed

Prohibited string values include exact normalized concepts such as `sportsbook`, `bookmaker`, `decimal odds`, `fractional odds`, `American odds`, `market odds`, `betting price`, `market-implied probability`, `market movement`, `line movement`, `expected value`, `Kelly`, `payout`, and `potential payout`.

The guard rejects prohibited keys and string values, but does not reject an arbitrary sentence that merely discusses the project’s odds-blind prohibition.

# 15. Safe model-probability distinction

The firewall explicitly accepts safe model-generated probability field names at the namespace level.

Safe model concepts include:
`modelProbability`, `rawModelProbability`, `calibratedProbability`, `homeWinProbability`, `awayWinProbability`, `modelConfidence`, `uncertainty`.

Market-implied probability field names remain permanently prohibited.

The Phase 8B draft schema does not yet include probability or winner fields. Safe probability names remain permitted at the firewall level for future phases.

# 16. Selection-status rules

`PENDING_MODEL` requires `noSelectionReason === null`.

`NO_SELECTION` and `MODEL_ERROR` require a non-empty trimmed reason string.

The contract does not define a winner or a confidence threshold in Phase 8B.

# 17. Validation issue model

Issues use the stable `MLBPredictionContractValidationIssue` shape:

```ts
export type MLBPredictionContractValidationIssue = Readonly<{
  code:
    | 'NOT_PLAIN_OBJECT'
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'INVALID_LITERAL'
    | 'INVALID_STRING'
    | 'INVALID_BOOLEAN'
    | 'INVALID_INTEGER'
    | 'INVALID_TIMESTAMP'
    | 'INVALID_TIMESTAMP_ORDER'
    | 'DUPLICATE_TEAM'
    | 'INVALID_DOUBLEHEADER'
    | 'INVALID_SELECTION_STATUS'
    | 'INVALID_NO_SELECTION_REASON'
    | 'ODDS_CONTAMINATION'
    | 'INVALID_RESEARCH_PAYLOAD_VALUE';
  path: string;
  message: string;
}>;
```

Additional stable codes may be added only when the existing list cannot express a real contract violation.

# 18. Determinism

Both validators return immutable read-only results. Violation issues are deterministically ordered by path, then by code. Firewall violations are reported with exact deterministic object paths. The validators do not depend on clock time, random values, external files, or network state.

# 19. Import boundary

`src/prediction/firewall/odds-contamination-guard.ts` does not import legacy prediction or database dependencies.

`src/prediction/mlb/mlb-prediction-contract.ts` imports only from `../firewall/odds-contamination-guard`.

The test verifies exact static module sources by parsing actual `import` and `export ... from` declarations via filesystem access.

# 20. Test coverage

`tests/prediction/firewall/odds-contamination-guard.test.ts`:
1. Rejects prohibited keys at root and nested levels with deterministic paths
2. Normalizes case/separator variants consistently
3. Rejects prohibited data inside arrays and deeply nested objects without mutation
4. Rejects sportsbook, bookmaker and primary-bookmaker variants
5. Rejects price, pricing, betting price, payout and potential payout fields
6. Rejects implied probability and market-implied probability but accepts model probability names
7. Rejects expected value, value edge and edge fields
8. Rejects Kelly and Kelly-fraction variants
9. Accepts safe model-generated probability fields
10. Accepts safe sport-data fields and asserts static import boundary via filesystem inspection

`tests/prediction/mlb/mlb-prediction-contract.test.ts`:
1. Accepts one safe pregame MLB game and preserves exact supplied values
2. Accepts a valid PENDING_MODEL draft with no winner/probability/multi/stake fields
3. Accepts only OFFICIAL_FINAL_GAME_WINNER and rejects regulation-only, totals, run-line, and live targets
4. Accepts valid timestamp ordering and rejects cutoff/capture/start violations and missing timezone
5. Rejects identical team IDs and empty identifiers
6. Accepts true/false/null neutralSite and rejects missing, non-boolean, and unknown homeAdvantage
7. Accepts null and valid game 1/2 doubleheaders and rejects unsupported numbers, missing IDs, and unknown fields
8. Accepts all four availability states and rejects arbitrary state strings
9. Validates PENDING_MODEL, NO_SELECTION, and MODEL_ERROR with matching noSelectionReason rules
10. Rejects null, arrays, class instances, unknown fields, and prohibited odds fields in researchPayload

# 21. Validation results

Phase 8B focused validation:
- `tests/prediction/mlb/mlb-prediction-contract.test.ts`: 10 passed
- `tests/prediction/firewall/odds-contamination-guard.test.ts`: 10 passed
- `tests/leakage.test.ts`: 1 passed

Phase 8B regression validation (with existing project totals):
- prediction: 20 tests in 2 files
- prospective: 649 tests in 22 files
- backtesting: 699 tests in 35 files
- full Vitest: 1425 tests in 73 files
- npm test: 1425 tests in 73 files

Phase 8B golden validation:
- CLI output is validated byte-for-byte against committed golden fixtures using the exact Phase 8B-C seven-case harness.

# 22. Deferred work

The following remain for later phases and are explicitly NOT part of Phase 8B:
- probability field construction in the draft schema
- winner prediction
- multi-bet construction
- staking guidance
- database persistence
- routes or UI for predictions
- real MLB sport-data source binding
- provider-neutral canonical pregame snapshot contract
- grading and calibration reporting

# 23. Limitations

The Phase 8B draft schema is pre-model. It captures only the structural boundary, not live forecasting. The input contract is deterministic and does not validate current market context, since that context is permanently prohibited.

# 24. Recommended next safe phase

Recommended next phase:

```text
Phase 8C — Evaluate real MLB sport-data sources and implement the canonical provider-neutral pregame snapshot contract.
```

# 25. Phase 8B boundaries and exclusions

Phase 8B does not train a model.

Phase 8B does not generate real probabilities.

Phase 8B does not predict a winner.

Phase 8B does not construct multis.

Phase 8B does not recommend stakes.

Phase 8B does not persist data.

Phase 8B does not add routes or UI.

# 26. Permanent product invariant

The Multi Research Engine is an odds-blind sports prediction system.

Future intended outputs include model-generated probabilities, predicted winners, recommended selections, multi-bet construction, staking guidance, timestamped recommendations, grading, calibration reporting, and performance reporting.

Those outputs must be produced only from sport data and the engine’s own models.

The new MLB V1 prediction namespace must never ingest, import, query, accept, store for decision-making, derive from, compare against, or be influenced by sportsbook odds, betting prices, decimal odds, fractional odds, American odds, implied probabilities derived from price, bookmaker consensus, market movement, line movement, price-derived value, price-derived edge, expected monetary value, payout information, Kelly calculations, or line shopping.

Model-generated probability fields are safe.

Market-implied probability fields are prohibited.

The permanent distinction is:

```text
homeWinProbability: allowed future model output
marketImpliedProbability: prohibited market input
```

# 27. Existing schema decision

Option A — Isolate and leave dormant for MLB V1.

The existing Prisma schema contains `OddsSample` and `PricedCandidate` tables. These are permanently isolated from the MLB V1 prediction namespace. The odds-contamination firewall prevents migration or live access to odds-derived persistence paths. Phase 8B does not modify `prisma/schema.prisma`.
