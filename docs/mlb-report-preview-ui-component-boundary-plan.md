# MLB Report Preview UI Component Boundary Plan

## Phase 6E status

Phase 6E adds documentation-only UI component boundary planning for consuming local MLB reportPreview handler output.
It adds no UI implementation.
It adds no React/Vue/Svelte/Next/etc.
It adds no frontend framework files.
It adds no CSS files.
It adds no app/pages/routes.
It does not implement a real website.
It does not implement a real API server.
It adds no HTTP routes.
It adds no backend infrastructure.
It adds no database code.
It adds no deployment files.
It adds no file output.
It adds no CLI flag.
It does not change CLI behavior.
It adds no stdout golden.
It does not modify existing goldens.
It does not add fixture/golden files.
It does not modify tests unless an existing docs-link/index test clearly requires it.

It preserves Phase 5B/5E/5H/5K/5N/5T/5Z goldens.
It preserves Phase 5Y report-preview CLI behavior.
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
Recommended next safe phase is Phase 6F typed UI view-model contract for handler success output only, or next sport module planning if the user chooses.

## Purpose

Phase 6E defines safe future UI component boundaries for consuming the typed local MLB reportPreview API handler output.
It documents allowed inputs, component scopes, display rules, forbidden surfaces, copy rules, failure handling, and future implementation gates.
No UI code is implemented.
No routes are added.
No network surface is created.

## Safe UI Input Boundary

A future UI may consume only:

- `MLBReportPreviewApiHandlerSuccess.apiResponse`
- or a narrowed view model derived from it.

A future UI must not consume:

- raw research packages
- raw historical fixtures
- CLI stdout directly
- network responses
- file reads
- file writes
- local-only handler failure internals for recommendation generation
- any computed probability, pick, or winner claim

## Proposed Component Boundaries

The following components are planning-only names and responsibilities.
No component files are created.
No framework is selected.

### ReportPreviewPageShell

- Purpose: root shell for the report preview experience.
- Allowed input: handler success status, theme/layout flags.
- Forbidden input: raw reportPreview internals, fixture evidence, research packages, constructor parameters.
- Display rules: show loading, limitation, or preview states only.
- Safety copy rules: "Research preview" on title/heading.
- No-go examples: must not compute or display derived score changes.

### ReportPreviewSummaryHeader

- Purpose: high-level title and safety statement.
- Allowed input: safe title, deterministic metadata string, explicit safety notes.
- Forbidden input: researchStrengthScore as strength ranking, confidence as win confidence, modelProbability, finalScore.
- Display rules: render title without modification; render safetyNotes as limitations.
- Safety copy rules: "Research preview" / "Local deterministic preview".
- No-go examples: must not say "Team A should win".

### ReportPreviewSafetyBanner

- Purpose: persistent limitation disclaimer.
- Allowed input: explicit safe safetyNotes from handler output.
- Forbidden input: computed summary text outside safetyNotes, injected best-bet marketing language.
- Display rules: show exact safe notes; ignore mutable injected text.
- Safety copy rules: display exact accepted safety note when present.
- No-go examples: must not append promotional text to the safety note.

### ReportPreviewSectionList

- Purpose: list of available report sections in deterministic order.
- Allowed input: section names, module availability booleans.
- Forbidden input: raw `researchPackage`, lock package fields, constructor metadata.
- Display rules: render each section as available/unavailable.
- Safety copy rules: "Module unavailable" or "Module not requested".
- No-go examples: must not expose hidden loader state as prediction.

### ReportPreviewGameCardList

- Purpose: safe game-level card list.
- Allowed input: team labels, scheduled times, data-quality labels, module list, warning codes.
- Forbidden input: finalScore, completedGameState, finalStatus, actualStartingPitchers, modelProbability, odds.
- Display rules: one card per game; no completion badge unless explicitly sourced as final via separate outcome attachment in a later phase.
- Safety copy rules: official date / scheduled start time only.
- No-go examples: must not rank cards by inferred strength.

### ReportPreviewGameCard

- Purpose: compact card for one game.
- Allowed input: gameId, officialDate, scheduledStartTime, awayTeam, homeTeam, dataQuality, confidence, volatility, module list, warnings.
- Forbidden input: finalScore, completedGameState, finalStatus, actualStartingPitchers, modelProbability, price, market, edge, ROI, pick, predictedWinner, winChance.
- Display rules: show team labels and scheduled time only; show data quality and confidence as descriptive labels.
- Safety copy rules: "Data quality" / "Research confidence" / "Research coverage".
- No-go examples: must not color cards as favorites/underdogs.

### ReportPreviewGameDetailPanel

- Purpose: expanded detail for one game.
- Allowed input: same as card plus safe module panels and warning detail.
- Forbidden input: finalScore, completedGameState, finalStatus, actualStartingPitchers, modelProbability, odds, sportsbook, market, edge, ROI.
- Display rules: expand only when user requests; never auto-expand with recommendation.
- Safety copy rules: limitations first; unavailable modules explicit.
- No-go examples: must not recompute missing fields from sibling games.

### ReportPreviewModuleAvailabilityList

- Purpose: summary of which research modules are present per game.
- Allowed input: completedResearchModules list, unavailable modules list.
- Forbidden input: raw internal module config, feature weights, calibration coefficients.
- Display rules: checkmarks for available, explicit text for unavailable/not requested.
- Safety copy rules: "Unavailable module" / "Not requested".
- No-go examples: must not imply missing modules change prediction.

### ReportPreviewWarningList

- Purpose: show limitations and evidence caveats.
- Allowed input: warning codes and safe warning text from handler/renderer output.
- Forbidden input: computed recommendation text, marketing copy, best-bet language.
- Display rules: preserve order; preserve exact wording where provided.
- Safety copy rules: "Limitations" heading; no advisory copy.
- No-go examples: must not rewrite warnings as suggestions.

### ReportPreviewDataQualityBadge

- Purpose: display data quality level.
- Allowed input: dataQuality string from safe research findings.
- Forbidden input: confidence as proxy, volatility as rank, researchStrengthScore as quality.
- Display rules: show exact available label.
- Safety copy rules: "Data quality" prefix.
- No-go examples: must not color green/red to imply win likelihood.

### ReportPreviewConfidenceLabel

- Purpose: display research confidence.
- Allowed input: confidence string.
- Forbidden input: researchStrengthScore, modelProbability, winChance, rank values.
- Display rules: show exact label.
- Safety copy rules: "Research confidence" only; never "Win confidence".
- No-go examples: must not display as success probability.

### ReportPreviewResearchStrengthLabel

- Purpose: display research coverage/strength.
- Allowed input: researchStrengthScore.
- Forbidden input: numeric rank, probability, team strength label.
- Display rules: show descriptive coverage/strength label only.
- Safety copy rules: "Research coverage" / "Research strength".
- No-go examples: must not display as team power rating.

### ReportPreviewTechnicalMetadataPanel

- Purpose: debug/audit metadata for deterministic local preview.
- Allowed input: handler metadata fields: handlerVersion, contractVersion, rendererVersion, adapterVersion, source, deterministic, generatedAt.
- Forbidden input: raw research constructor fields, raw fixture evidence, local file paths.
- Display rules: show only if user expands; `null` generatedAt implies deterministic local/golden-free preview without timestamp.
- Safety copy rules: "Local deterministic preview" for null generatedAt.
- No-go examples: must not use metadata to infer freshness outside deterministic context.

## UI Display Rules

- Display only safe labels and explanations.
- Display `dataQuality` as data-quality label only.
- Display `confidence` as research confidence / data confidence only, never win confidence.
- Display `researchStrengthScore` as research coverage/strength only, never team strength/ranking/probability.
- Display unavailable modules as unavailable/not requested.
- Display warnings as limitations, not recommendations.
- Display `safetyNotes` as limitations/safety notes.
- Display `generatedAt` as metadata only if present; `null` means deterministic local/golden-free preview.
- Never derive missing fields from context.
- Never fill in missing schedule, team, standings, injuries, odds, or pitcher details.

## Forbidden UI Surfaces

The following must never be rendered:

- picks
- predictions
- winner calls
- best bets
- value bets
- betting advice
- win chance
- probabilities
- odds
- sportsbook
- market
- price
- edge
- ROI
- implied probability
- favorite/underdog
- power ranking
- team ranking
- standings position
- final score
- raw outcome
- completed game state
- final status
- actual starting pitchers
- pitcher evidence
- raw historical fixture records
- source=live by default
- modelProbability
- raw finalScore / outcome fields

## Safe Copy Examples

- "Research preview"
- "Data quality"
- "Research confidence"
- "Research coverage"
- "Limitations"
- "Unavailable module"
- "Local deterministic preview"
- "No live schedule, odds, pitcher, or market data is included."

## Unsafe Copy Examples

The following must never appear in UI copy:

- "Team A should win"
- "Best bet"
- "Likely winner"
- "Value"
- "Projected score"
- "Win probability"
- "Market edge"
- "Sportsbook price"
- "Implied probability"
- "EV" / "ROI"
- "Favorite" / "Underdog"

## Failure Handling Rules

- Handler failure responses must render an error/limitation view, not recommendations.
- Missing reportPreview must show a structured limitation message.
- Prohibited field/value errors must not leak internal keys to users.
- INVALID_SOURCE and INVALID_REQUEST must show generic limitation copy.
- Never compute or infer missing content from failure state.
- Never suggest switching to a live source from within UI error state.

## Future Implementation Gates

Future implementation must pass:

- inventory guard unchanged for historical fixtures
- existing stdout goldens unchanged
- report-preview golden unchanged unless explicitly scoped
- full Vitest `tests/prospective` green
- full Vitest `tests/backtesting` green
- full Vitest suite green
- TypeScript `tsc --noEmit` clean
- `npm test` green
- `npm run build` clean
- `git diff --check` clean
- safety search clean for forbidden terminology
- no generated artifacts left in repo or untracked
- no package/dependency changes unless explicitly scoped
- no network/MLB API requests
- no web ingestion
- no historical fixture changes

Implementation must:
- consume only `MLBReportPreviewApiHandlerSuccess.apiResponse` or narrowed view model
- include UI boundary tests before component implementation
- include safety search in CI or pre-merge gate
- not display prohibited fields even if accidentally present
- not introduce package dependencies unless explicitly scoped
- preserve all goldens
- use explicit local-only mode for any future data fetching boundary

Phase 6G adds synthetic, golden-free validation coverage for the Phase 6F boundary.
It does not modify the builder or validator contract unless a real gap is discovered.
It adds no UI implementation, no CSS, no routes, no server, no network, no CLI flag, no stdout golden change, no fixture change, and no package change.

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
- no real website/API server implementation
- no HTTP routes
- no frontend framework files
- no CSS files
- no app routes



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
