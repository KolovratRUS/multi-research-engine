# MLB Report Preview API Handler Implementation

## Phase 6C status

Phase 6C adds a local in-process MLB reportPreview API adapter/handler.
It accepts only an already-rendered `reportPreview` object and returns a typed Phase 6B API contract response.
It adds no real server.
It adds no HTTP routes.
It adds no Express/Fastify/Next/frontend framework files.
It adds no database code.
It adds no deployment files.
It adds no file output.
It adds no new stdout golden.
It adds no CLI flag.
It changes no CLI behavior.

## Module/test paths

- Handler module: `src/prospective/mlb/report-preview-api-handler.ts`
- Tests: `tests/prospective/mlb-report-preview-api-handler.test.ts`
- Documentation: `docs/mlb-report-preview-api-handler-implementation.md`

## What the handler does

The handler is a small pure TypeScript function that consumes the Phase 5X rendered `reportPreview` and produces the Phase 6B API contract response.
It validates the input against the same prohibited fields, restricted terms, and required metadata rules as the contract validator.
On success, it returns a structured success response containing the contract API response and handler metadata.
On validation failure, it returns a structured failure response with a concise error code, message, and optional path.
It never throws for normal validation failures; it returns `ok: false`.
It never accepts raw research packages, raw historical fixtures, CLI output, network responses, files, or current-time injections.
It never mutates its input.
It is deterministic.

## What the handler does not do

It does not implement a server, route, endpoint, frontend handler, backend service, database, deployment, file output, or CLI flag change.
It does not ingest live data, web data, or network data.
It does not call current time.
It does not expose prohibited fields or betting language.
It does not add picks, predictions, betting advice, bookmaker language, or probability claims.

## Request/response shape summary

### Request

- `reportPreview`: rendered Phase 5X reportPreview object (required)
- `requestId`: string | null | undefined (optional, copied to null if non-string)
- `source`: `'local-report-preview'` only; defaults to `'local-report-preview'`
- `strict`: boolean; reserved for future use. Currently enforced as always strict.

### Success response

- `ok: true`
- `handlerVersion`: `mlb-report-preview-api-handler-v1`
- `handlerName`: `MLB_REPORT_PREVIEW_API_HANDLER`
- `requestId`: string | null
- `apiResponse`: Phase 6B `MLBReportPreviewApiResponse`
- `metadata`:
  - `handlerVersion`
  - `contractVersion`
  - `rendererVersion`
  - `adapterVersion`
  - `generatedAt`: null or input value from golden
  - `source`: `local-report-preview`
  - `deterministic`: true

### Failure response

- `ok: false`
- `handlerVersion`: `mlb-report-preview-api-handler-v1`
- `handlerName`: `MLB_REPORT_PREVIEW_API_HANDLER`
- `requestId`: string | null
- `error`:
  - `code`
  - `message`
  - `path?`
- `metadata`:
  - `handlerVersion`
  - `contractVersion`
  - `generatedAt`: null
  - `source`: `local-report-preview`
  - `deterministic`: true

## Success/failure behavior

- If `reportPreview` is missing, returns `ok: false` with `MISSING_REPORT_PREVIEW`.
- If `reportPreview` contains prohibited fields or restricted text, returns `ok: false` with `PROHIBITED_FIELD` or `PROHIBITED_VALUE_TEXT`.
- If the built `apiResponse` fails contract validation, returns `ok: false` with the first contract validation error code.
- If all checks pass, returns `ok: true` with the typed Phase 6B response.

## Validation dependency on Phase 6B contract

The handler reuses the Phase 6B contract builder and validator.
It also pre-scans the raw rendered `reportPreview` for prohibited keys and bad strings before building the API response, ensuring input-level safety before mapping.

## Safety boundary

- The handler is local-only and in-process only.
- It does not expose raw finalScore, raw outcome, completedGameState, finalStatus, actualStartingPitchers, or any calibrated probability.
- `modelProbability` remains null/absent/not available until calibrated.
- `researchStrengthScore`, `confidence`, `matchConfidence`, `dataQuality`, `volatility`, and `modelProbability` remain conceptually separate.
- The handler does not expose picks, predictions, betting advice, bookmaker language, or probability claims.
- Historical completion remains based only on `liveData.plays.allPlays[last].about.endTime` with provenance `LAST_COMPLETED_PLAY_END`.
- Actual starters remain evaluation-only.
- TEAM_ONLY excludes pitcher evidence.
- The handler must not expose prohibited fields as listed above.

## Validation commands

- npm run inventory:mlb-fixtures
- npm run prospective:mlb:dry-run-check
- npx vitest run tests/prospective/mlb-report-preview-api-handler.test.ts --reporter=verbose
- npx vitest run tests/prospective/mlb-report-preview-api-contract.test.ts --reporter=verbose
- npx vitest run tests/prospective/mlb-team-recent-form-research.test.ts --reporter=verbose
- npx vitest run tests/prospective --reporter=verbose
- npx vitest run tests/backtesting --reporter=verbose
- npx vitest run --reporter=verbose
- npx tsc --noEmit --incremental false --pretty false
- npm test
- npm run build
- git diff --check

## Phase 6D coverage

Phase 6D adds golden-free validation coverage for the handler.
It adds no server/backend/frontend code.
It adds no HTTP routes.
It adds no website/API deployment.
It adds no network behavior.
It adds no CLI behavior.
It adds no file output.
It adds no new stdout golden.
It adds no fixtures.
It adds no generated goldens.
It preserves Phase 5B/5E/5H/5K/5N/5T/5Z and 5Z goldens.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 6C handler contract and hardens invalid-input handling only if needed.
It preserves Phase 6B API contract behavior unless explicitly documented.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.

Handler hardenings added by Phase 6D:
- Non-object request guard: returns ok false with INVALID_REQUEST instead of throwing.
- Invalid source guard: rejects any source other than `local-report-preview` with INVALID_SOURCE.

## Validation commands

- npm run inventory:mlb-fixtures
- npm run prospective:mlb:dry-run-check
- npx vitest run tests/prospective/mlb-report-preview-api-handler.test.ts --reporter=verbose
- npx vitest run tests/prospective/mlb-report-preview-api-contract.test.ts --reporter=verbose
- npx vitest run tests/prospective --reporter=verbose
- npx vitest run tests/backtesting --reporter=verbose
- npx vitest run --reporter=verbose
- npx tsc --noEmit --incremental false --pretty false
- npm test
- npm run build
- git diff --check

## Recommended next safe phase

Phase 6E — plan website UI component boundaries for consuming handler output only, no implementation.
Alternatively, next sport module planning if the user chooses.

Scope for Phase 6E:
- local-only planning
- no server/network
- no frontend implementation artifacts
- no real schedule ingestion
- no golden changes
- no CLI changes
- no file output
- no modelProbability
- no picks/predictions/betting advice
- no raw outcomes
- no pitcher evidence
- no actual starters
