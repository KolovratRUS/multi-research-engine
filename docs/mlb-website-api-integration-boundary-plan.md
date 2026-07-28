# MLB Website/API Integration Boundary Plan

## Phase 6A Status

- Phase 6A adds a documentation-only MLB website/API integration boundary plan.
- It adds no runtime code.
- It adds no website/API implementation.
- It adds no server/backend/frontend code.
- It adds no CLI behavior.
- It adds no CLI flag.
- It adds no stdout golden.
- It preserves Phase 5B default stdout golden.
- It preserves Phase 5E evidence-enabled stdout golden.
- It preserves Phase 5H aggregate stdout golden.
- It preserves Phase 5K result-metrics stdout golden.
- It preserves Phase 5N schedule-context stdout golden.
- It preserves Phase 5T team-quality stdout golden.
- It preserves Phase 5Z report-preview golden.
- It preserves Phase 5Y report-preview CLI behavior.
- It preserves Phase 5W adapter behavior.
- It preserves Phase 5X renderer behavior.
- It preserves Phase 5S team-quality CLI behavior.
- It preserves Phase 5R/5U team-quality behavior.
- It preserves Phase 4X construction file-output behavior.
- It preserves Phase 4Y construction file-output goldens.
- It preserves Phase 4V no-flag construction stdout goldens.
- It preserves lock CLI behavior.
- It preserves Phase 4P no-flag lock goldens.
- It preserves Phase 4S file-output lock goldens.
- No modelProbability.
- No picks/predictions/betting advice.
- No raw outcomes.
- No pitcher evidence.
- No actual starters.
- No live/API/web or network standings/roster/schedule ingestion.
- No historical fixture changes.
- No file output.
- No package.json or package-lock.json changes.
- Recommended next safe phase is Phase 6B typed local API contract/schema for reportPreview only, or next sport module planning if the user chooses.

## Purpose

Phase 6A defines a boundary between the existing safe local MLB research report stack and a future website/API layer. It documents what a future consumer may safely read, what it must never read, and what implementation phases may follow. It does not implement any website/API code.

This phase exists because the local research stack now produces a safe `reportPreview` shape from the Phase 5W adapter and Phase 5X renderer. That shape is the intended contract for future consumption.

## Existing Safe Contract

The existing safe surface for any future consumer is the explicit report-preview JSON shape:

- Produced by Phase 5W `MLBResearchReportAdapter`
- Rendered by Phase 5X `MLBResearchReportRenderer`
- Exposed via Phase 5Y/5Z explicit `--fixture-evidence-local --report-preview-local` CLI mode
- Serialized in existing goldens only when explicit mode is requested
- Default no-flag behavior remains unchanged

The safe contract is built from:

- `researchPackage` input (local/manual/synthetic)
- `adapterVersion` and `adapterName`
- `rendererVersion` and `rendererName`
- `slateSummary` or equivalent safe slate-level fields
- `gameCards` with safe display fields only
- `gameDetails` with safe module panels, warning codes, data quality explanation, evidence limitations, technical metadata
- `reportWarnings`
- `metadata` including `generatedAt`, `source`, `deterministic`

Input to that contract comes from:

- MLB weekly prospective research construction package (local/manual)
- MLB manual week lock package (local/manual)
- local historical fixture evidence (when explicitly requested)
- result aggregate metrics (when explicitly requested)
- schedule context (when explicitly requested)
- team quality context (when explicitly requested)

The contract avoids:

- raw ingestion evidence lists
- research package internals beyond the adapter/renderer boundary
- raw historical fixture records
- completed-game evidence fields like live play end times unless through explicit local evidence path only
- raw pitcher evidence
- actual starting pitchers
- raw finalScore or outcome fields

## Allowed Future API Surfaces

A later phase may introduce:

- local-only report preview endpoint or handler
- explicit request/response schema for `reportPreview`
- deterministic test fixture response for the endpoint/handler
- safe game card list
- safe game detail view
- module availability summary
- warning summary
- data quality summary
- technical metadata summary

The endpoint/handler must:

- accept only explicit local-mode input
- return only the safe `reportPreview` shape or UI-derived summaries from it
- never mutate the adapter/renderer behavior
- never read raw research package internals directly
- never read raw historical fixtures directly
- never expose completed-game evidence fields
- never call network/MLB APIs
- never expose live data by default
- never infer picks, predictions, betting advice, or probability claims

## Forbidden Future API Surfaces

The following must never be added to any future website/API surface:

- picks
- predictions
- winner recommendations
- modelProbability
- win chance
- betting odds
- sportsbook prices
- market references
- implied probability
- EV
- ROI
- edge
- line movement
- final scores
- raw outcomes
- completed game state
- final status
- actual starting pitchers
- pitcher evidence
- raw historical fixture records
- live data by default
- raw research package internals
- any data requiring `source=live` for default operation

## Data Flow

The future website/API boundary must consume only the safe contract:

```
construction fixture/input
      ↓
local research command
      ↓
research package
      ↓
[Phase 5W adapter]
      ↓
[Phase 5X renderer]
      ↓
[Phase 5Y/5Z explicit report-preview CLI]
      ↓
reportPreview shape
      ↓
[future website/API boundary]
```

The boundary must not bypass the adapter/renderer layer. It must not bypass the explicit local-mode boundary. It must not branch back into raw fixtures, raw research package internals, or network sources.

## Validation Gates for Future Implementation

Future phases that touch this boundary must pass:

- inventory guard unchanged for historical fixtures
- existing stdout goldens unchanged
- report-preview golden unchanged unless explicitly scoped
- full Vitest `tests/prospective` green
- full Vitest `tests/backtesting` green
- full Vitest suite green
- TypeScript `tsc --noEmit` clean
- `npm test` green
- `npm run build` clean or no runtime build required for planning-only phases
- `git diff --check` clean
- safety search clean for forbidden terminology
- no generated artifacts left in repo or untracked
- no package/dependency changes unless explicitly scoped
- no network/MLB API requests
- no web ingestion
- no historical fixture changes

## UI Safety Copy Rules

If a website surface is eventually implemented:

- display labels only: data quality label, confidence label, research strength label
- never display confidence as win confidence
- never display researchStrengthScore as probability or rank
- display missing modules as unavailable/not requested
- display warnings as limitations
- do not infer recommendations
- do not add marketing/betting wording
- do not portray the tool as predictive
- preserve the explicit disclaimer that research data aid only, not bets or financial advice

## Non-Goals

This boundary plan explicitly excludes:

- no live data
- no deployment
- no database
- no authentication
- no user accounts
- no pricing or subscriptions
- no sportsbook integration
- no charting/visualization library
- no model calibration
- no probabilities
- no cross-sport abstraction implementation in this planning phase
- no picks/predictions/betting advice of any kind
- no actual starting pitchers

## Future Phase Plan

Phase 6B — typed local API contract/schema for reportPreview only
- Add explicit typed request/response schema for the safe reportPreview shape.
- Add deterministic unit tests for the schema.
- Do not add a server, routes, network stack, or file output.
- Do not change existing CLI flags or goldens.

Phase 6C — local in-process API adapter/handler
- Add an in-process handler that consumes the existing safe reportPreview object and produces a typed API response.
- Keep it local-only.
- Do not add network endpoints or deployment.
- Preserve existing goldens.

Phase 6D — optional explicit CLI/API preview validation fixture
- Add an optional validation fixture/deterministic test response for the in-process handler.
- No default behavior change.
- No new CLI flag unless explicitly required and safely scoped.

Phase 6E — website UI component boundaries
- Plan frontend component boundaries.
- Define safe props and prohibited props.
- Do not implement frontend framework files or server routes.

Alternative next step: switch to next sport module planning if the user chooses.

## Recommended Next Safe Phase

Recommended next safe phase is Phase 6B typed local API contract/schema for reportPreview only, or next sport module planning if the user chooses.

Phase 6B scope teaser:
- local-only
- no website implementation
- no server/network code
- no file output
- no CLI flag
- no goldens changed
- no modelProbability
- no picks/predictions/betting advice
- no raw outcomes
- no pitcher evidence
- no actual starters
- no live/API/web
- preserve existing adapter, renderer, report-preview CLI, and all goldens
