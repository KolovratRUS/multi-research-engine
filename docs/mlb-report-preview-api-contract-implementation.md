# MLB Report Preview API Contract Implementation

## Phase 6B status

Phase 6B adds a typed local API contract/schema for MLB `reportPreview` only.
It is documentation and type/validation helper code only.
No server/backend/frontend code is added.
No website/API implementation is added.
No network behavior is added.
No CLI behavior is added.
No file output is added.
No new stdout golden is added.

## Module/test paths

- Module: `src/prospective/mlb/report-preview-api-contract.ts`
- Tests: `tests/prospective/mlb-report-preview-api-contract.test.ts`
- Documentation: `docs/mlb-report-preview-api-contract-implementation.md`

## What the contract does

The contract defines the safe future API response shape for MLB `reportPreview`.
It exposes typed constants, types, validation helpers, and a small builder.
The builder accepts only the already-rendered `reportPreview` object.
It does not accept raw research packages, raw historical fixtures, CLI output, or network responses.

## What the contract does not do

It does not implement a server, route, endpoint, frontend handler, backend service, database, deployment, file output, or CLI flag change.
It does not ingest live data, web data, or network data.
It does not mutate its input.
It does not call current time.
It does not expose prohibited fields or betting language.

## Output shape summary

Top-level API response:

- `contractVersion`: `mlb-report-preview-api-contract-v1`
- `contractName`: `MLB_REPORT_PREVIEW_API_CONTRACT`
- `ok`: true for valid responses
- `reportPreview`: safe rendered report preview
- `safety`: safety envelope booleans
- `metadata`: response-level metadata

`reportPreview` safe fields:

- `rendererVersion`
- `rendererName`
- `adapterVersion`
- `title`
- `sections`
- `gameCards`
- `gameDetails`
- `safetyNotes`
- `metadata`

`reportPreview.metadata`:

- `contractVersion`
- `rendererVersion`
- `adapterVersion`
- `generatedAt`: string or null; null by default from golden
- `source`: `local-research-package`
- `deterministic`: true

`safety` envelope:

- `localOnly`: true
- `reportPreviewOnly`: true
- `rawResearchPackageAllowed`: false
- `rawHistoricalFixturesAllowed`: false
- `liveDataAllowed`: false
- `bettingDataAllowed`: false
- `rawOutcomesAllowed`: false
- `pitcherEvidenceAllowed`: false
- `actualStartersAllowed`: false
- `probabilityClaimsAllowed`: false

## Validation rules

- `ok` must be true for valid responses.
- `contractVersion` and `contractName` must match exported constants.
- `reportPreview` must exist.
- `reportPreview.metadata` must be deterministic and `local-research-package` sourced.
- `generatedAt` must be string or null.
- `sections`, `gameCards`, and `gameDetails` must be arrays.
- One or more sections required.
- `gameCards` length must equal `gameDetails` length.
- `reportPreview` must not include prohibited keys.
- `reportPreview` must not include unsafe recommendation wording.
- Validation result returns structured errors with `ok`, `errors`, each error having `code`, `path`, and `message`.
- Assertion helper throws a concise error that includes the first error code only.

## Safety boundary

- The API contract is local-only and schema/type helper only.
- It does not expose raw finalScore, raw outcome, completedGameState, finalStatus, actualStartingPitchers, or any calibrated probability.
- `modelProbability` remains null/absent/not available until calibrated.
- `researchStrengthScore`, `confidence`, `matchConfidence`, `dataQuality`, `volatility`, and `modelProbability` remain conceptually separate.
- The contract does not expose picks, predictions, betting advice, bookmaker language, or probability claims.
- Historical completion remains based only on `liveData.plays.allPlays[last].about.endTime` with provenance `LAST_COMPLETED_PLAY_END`.
- Actual starters remain evaluation-only.
- TEAM_ONLY excludes pitcher evidence.
- Future API contract must not expose prohibited fields as listed above.

## Validation commands

- npm run inventory:mlb-fixtures
- npm run prospective:mlb:dry-run-check
- npx vitest run tests/prospective/mlb-report-preview-api-contract.test.ts --reporter=verbose
- npx vitest run tests/prospective --reporter=verbose
- npx vitest run tests/backtesting --reporter=verbose
- npx vitest run --reporter=verbose
- npx tsc --noEmit --incremental false --pretty false
- npm test
- npm run build
- git diff --check

## Recommended next safe phase

Phase 6C — local in-process API adapter/handler using existing `reportPreview` contract.
Scope:
- local in-process adapter/handler only
- no server/network
- no file output
- no CLI flag
- no default behavior change
- no `modelProbability`
- no picks/predictions/betting advice
- no raw outcomes
- no pitcher evidence
- no actual starters
- no live/API/web
- preserve existing goldens

Alternatively, next sport module planning if the user chooses.
