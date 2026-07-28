# MLB Research Report Interface Plan

## Status

- Phase 5V
- Phase 5W
- planning-only
- no runtime behavior
- no CLI behavior
- no website code
- no backend/API implementation
- no file output
- no new tests/goldens
- no fixture changes
- no package/dependency changes
- no live/API/web/network ingestion
- no modelProbability
- no picks/predictions/betting advice
- preserve Phase 5B/5E/5H/5K/5N/5T goldens
- preserve Phase 5S CLI behavior
- preserve Phase 5R/5U team-quality behavior
- no file output unless explicitly scoped later

This document plans how the existing MLB research package could eventually be presented to a user in a website/reporting interface. It does not implement that interface. It does not change any existing behavior, CLI flag, test, or golden.

## Purpose

Plan a future website/reporting layer that answers common pregame questions from the same typed JSON package already produced by local research commands:

- What games are on the slate?
- What research modules are available for each game?
- How complete is the data?
- Which modules are missing or insufficient?
- Which teams have stronger local evidence coverage?
- What schedule/rest/travel context exists?
- What team-quality context exists?
- What warnings should the user notice?
- What should not be interpreted as prediction/betting advice?

The goal is to preserve every safety boundary already enforced by the local research engine:
- odds-blind
- descriptive only
- data-quality-first
- no picks
- no betting advice
- no modelProbability until calibrated
- no raw outcomes in prospective output
- no pitcher evidence in TEAM_ONLY modules
- local/manual/synthetic-safe until explicitly scoped later

## Proposed User-Facing Report Sections

These are future planning sections only. They may become web routes, report pages, or printable summaries later.

### Slate Overview

- date range or game date
- away/home team list
- module availability summary
- warning summary
- data-quality summary
- schedule-adjusted context summary
- evidence coverage summary
- links to individual game detail pages

### Game Cards

A future game card should surface only safe summary fields and never imply a prediction, pick, or betting value.

Safe fields:
- gameId
- officialDate
- scheduledStartTime
- awayTeam
- homeTeam
- moduleAvailability
- topWarnings
- dataQualitySummary
- confidenceSummary
- researchStrengthSummary
- scheduleContextSummary
- teamQualityContextSummary
- lastUpdated or generatedAt only if local generation timestamp exists safely later

Prohibited fields:
- pick
- predictedWinner
- winChance
- modelProbability
- betting odds
- sportsbook prices
- implied probability
- finalScore
- actualStartingPitchers
- raw outcome fields

### Game Detail Page

Safe display groups:
- Match Header
- Available Research Modules
- Team Recent Form Panel
- Schedule Context Panel
- Team Quality Context Panel
- Warning Codes Panel
- Data Quality Explanation
- Evidence Limitations
- Technical Metadata Collapsible Section

### Research Modules Summary

Section for each module included in the research package:
- TEAM_RECENT_FORM
- TEAM_SCHEDULE_CONTEXT
- TEAM_QUALITY_CONTEXT

Each module summary should show:
- availability state: requested, disabled, unavailable, not-evaluated
- data quality label
- confidence label
- research strength summary
- evidence counts when available
- warnings emitted by that module
- conceptual notes for interpretability

### Team Recent Form

Safe fields only:
- localEvidenceGameCount
- opponentEvidenceGameCount
- recentOpponentEvidenceGameCount
- historicalSampleSizeLabel
- opponentSampleSizeLabel
- warnings array
- confidence
- dataQuality
- volatility
- researchStrengthScore
- matchConfidence if available

No raw game outcomes from the recent form module should be displayed as prediction signals.

### Team Schedule Context

Safe fields only:
- context label
- rest/travel-related descriptive flags
- warnings
- evidence/calculation availability note

No raw cumulative run totals, final outcome tags, or implied win-rate fields.

### Team Quality Context

Safe fields only:
- localEvidenceGameCount
- opponentEvidenceGameCount
- recentOpponentEvidenceGameCount
- historicalSampleSizeLabel
- opponentSampleSizeLabel
- scheduleAdjustedContextLabel only if supported safely
- warnings
- dataQuality
- confidence
- researchStrengthScore
- matchConfidence if available

No raw finalScore, raw outcome, completedGameState, finalStatus, actualStartingPitchers, or any calibrated probability.

### Data Quality & Warnings

Future interface rules:
- warn grouped by severity or module
- deterministic ordering
- human-readable explanation
- never hidden
- never converted into betting language
- warning codes mapped directly from module outputs

Example warning codes:
- TEAM_RECENT_FORM_NO_LOCAL_EVIDENCE
- TEAM_SCHEDULE_CONTEXT_INSUFFICIENT_CONTEXT
- TEAM_QUALITY_CONTEXT_NO_LOCAL_EVIDENCE
- TEAM_QUALITY_CONTEXT_RECENT_SAMPLE_THIN
- TEAM_QUALITY_CONTEXT_SCHEDULE_CONTEXT_UNAVAILABLE

### Evidence Coverage

Future interface should make clear:
- what evidence exists
- what evidence is missing
- what thresholds reduce confidence
- what is evaluation-only and not computed yet
- whether a module is enabled or disabled by local configuration

### Safety Notes / Interpretation Notes

Future interface must include interpretation guidance:
- researchStrengthScore is module/evidence strength, not probability
- confidence is reliability/completeness confidence, not win confidence
- dataQuality is input/output completeness and validity
- volatility is descriptive instability/context, not betting volatility
- modelProbability remains absent/null until calibrated
- no module should imply a winner, pick, price, edge, ROI, or betting value

### Validation Metadata

Future interface should expose:
- package version
- input construction package identity or artifact reference
- run timestamp if local generation exists safely later
- research mode
- research scope
- enabled local evidence flags
- validation messages from validators
- warnings count

### Export/Share

Defer implementation. If added later:
- explicit user action
- local-only by default
- exact schema version in exported artifact
- no live ingestion
- no generated run artifacts committed by default

## Interpretation Rules

Document these rules explicitly for future UI copy and QA review:

- researchStrengthScore is module/evidence strength, not probability
- confidence is reliability/completeness confidence, not win confidence
- dataQuality is input/output completeness and validity
- volatility is descriptive instability/context, not betting volatility
- modelProbability remains absent/null until calibrated
- no module should imply a winner, pick, price, edge, ROI, or betting value
- warning codes are descriptive and safety-oriented, not predictive
- evidence counts are descriptive completeness metrics, not confidence guarantees

## Warning Display

Plan:

- group warnings by module
- sort deterministically within each group
- do not collapse, hide, or sanitize warnings to avoid misinterpretation
- provide human-readable labels alongside exact warning codes
- map warning codes directly from module outputs once implemented in report adapter
- if a future module adds new codes, the interface should render unknown codes as-is and flag them for review

## Data Quality Display

Planned labels:
- insufficient
- partial
- usable
- low/medium/high confidence
- low/medium/high researchStrengthScore
- module unavailable
- module disabled
- module not requested
- local evidence unavailable

These labels come from module output and validator state, not from external sources.

## Future Website Architecture

High-level future design only. No implementation planned yet.

- research engine remains separate from UI
- CLI/package output becomes API response later
- backend validates uploaded/local construction package before rendering
- frontend renders reports from typed JSON
- run history/storage only later
- no live ingestion until explicitly scoped and safety-gated
- no odds/prediction integration until calibrated and explicitly scoped

Planned boundaries:
- backend validates package shape but does not add normalized scores or probabilities
- frontend never computes probabilities from safe fields
- storage layer does not merge safe local evidence with live external feeds without explicit safety gating
- report adapter does not expose raw finalScore, raw outcome, completedGameState, finalStatus, actualStartingPitchers, or any calibrated probability

## Future Implementation Sequence

Recommended future phases:

### Phase 5W: typed report-shape adapter skeleton and tests

- add typed adapter interfaces only
- unit tests for safe fields, warning preservation, prohibited-field absence
- no CLI output change
- no file output
- no website code
- preserve all existing goldens and behavior

- completed: local-only typed adapter, copy-only label fields, safety assertion, warning dedupe/sort

### Phase 5X: local-only report rendering helper/unit tests

- add deterministic human-readable renderer
- verify module availability mapping
- verify warning sort/dedupe mapping
- verify safe fields only
- verify label-only rendering of researchStrengthScore/confidence/dataQuality
- verify generatedAt handled without current-time calls
- verify no raw outcomes, no pitcher evidence, no actual starters
- no CLI flag
- no file output committed by default
- preserve existing behavior

- completed: local-only typed renderer, sections, game cards, game details, deterministic output

### Phase 5Y: optional explicit CLI report-preview JSON mode

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

### Phase 5Z: exact golden for report-preview mode

- deterministic stdout golden for report-preview mode only
- no default change
- no file output
- preserve Phase 5B/5E/5H/5K/5N/5T goldens

### Later: website/API planning

- only after report adapter tests and golden are stable
- separate from research engine implementation
- no live ingestion until explicitly scoped

Alternative safe sequencing is acceptable if it removes assumptions earlier.

## Safety Boundaries

Repeated for implementers:

- no modelProbability
- no picks/predictions/win chance
- no betting/odds/sportsbook/market/price
- no raw outcomes/final scores
- no pitcher evidence/actual starters
- no live/API/web
- no network standings/roster/schedule/injury ingestion
- no file output until explicitly scoped
- no default behavior changes
- no generated run artifacts committed
- no assumptions about backend authentication, routing, persistence, caching, or third-party integrations

## Acceptance Criteria for Future Report Adapter

Future tests should verify:

- safe fields only
- module availability is correct
- warnings are preserved and sorted
- no prohibited fields leak
- default CLI unchanged
- all existing goldens preserved
- deterministic output
- missing module data handled safely
- no modelProbability
- no raw outcomes/final scores
- no pitcher evidence
- no actual starters
- no live/API/web request

## Artifacts

This phase creates only:
- docs/mlb-research-report-interface-plan.md

No runtime artifacts. No CLI changes. No tests. No goldens. No fixture changes. No package changes.

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
Recommended next safe phase is Phase 6A.
