# MLB Report Preview UI View-Model Implementation

## Phase 6F status

Phase 6F adds a typed UI view-model contract for MLB reportPreview handler success output only.

This phase adds no UI implementation.
This phase adds no components.
This phase adds no CSS.
This phase adds no app/pages/routes.
This phase adds no server/backend/frontend code.
This phase adds no HTTP routes.
This phase adds no website/API deployment.
This phase adds no network behavior.
This phase adds no CLI behavior.
This phase adds no file output.
This phase adds no new stdout golden.
This phase adds no fixtures.

Phase 6F preserves Phase 5B/5E/5H/5K/5N/5T/5Z goldens.
Phase 6F preserves Phase 5Y report-preview CLI behavior.
Phase 6F preserves Phase 6E UI boundary plan.
Phase 6F preserves Phase 6D handler validation behavior.
Phase 6F preserves Phase 6C handler behavior.
Phase 6F preserves Phase 6B API contract behavior.
Phase 6F preserves Phase 5W adapter behavior.
Phase 6F preserves Phase 5X renderer behavior.

No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.

Recommended next safe phase is Phase 6G UI view-model synthetic coverage, or next sport module planning if the user chooses.

## Module/test paths

- Module: src/prospective/mlb/report-preview-ui-view-model.ts
- Test: tests/prospective/mlb-report-preview-ui-view-model.test.ts

## Input boundary

`buildMLBReportPreviewUIViewModelFromHandlerSuccess` accepts only `MLBReportPreviewApiHandlerSuccess`.

It rejects or fails validation for:
- handler failure objects
- missing required fields
- raw reportPreview objects
- raw research packages
- raw historical fixtures

It does not call CLI.
It does not read files.
It does not write files.
It does not call network.
It does not call current time.
It does not mutate input.

## Output shape

```ts
interface MLBReportPreviewUIViewModel {
  readonly viewModelVersion: string;
  readonly viewModelName: string;
  readonly title: string;
  readonly header: MLBReportPreviewUIHeader;
  readonly safetyBanner: MLBReportPreviewUISafetyBanner;
  readonly sections: readonly MLBReportPreviewUISection[];
  readonly gameCards: readonly MLBReportPreviewUIGameCard[];
  readonly gameDetails: readonly MLBReportPreviewUIGameDetail[];
  readonly moduleAvailability: MLBReportPreviewUIModuleAvailability;
  readonly warnings: readonly MLBReportPreviewUIWarning[];
  readonly metadata: MLBReportPreviewUIMetadata;
}
```

## Safe labels

Header:
- title: copied from safe reportPreview title
- subtitle: "Research preview"
- generatedAtLabel: "Local deterministic preview" when generatedAt is null; safe metadata string otherwise
- sourceLabel: "Local report preview"

Safety banner:
- heading: "Limitations"
- notes: copied from safe safetyNotes with required exact note included

Game card labels:
- dataQualityLabel: descriptive label only
- confidenceLabel: research confidence only
- researchStrengthLabel: research coverage/strength only

Game detail labels:
- dataQualityExplanation, evidenceLimitations, technicalMetadataSummary: descriptive only

## Validation rules

Rejects:
- handler failure objects
- missing required fields
- non-array sections/gameCards/gameDetails
- gameCards/gameDetails count mismatch
- prohibited keys:
  - modelProbability
  - predictedWinner
  - pick
  - winChance
  - powerRating
  - teamRank
  - standingsPosition
  - finalScore
  - outcome
  - completedGameState
  - finalStatus
  - actualStartingPitchers
  - odds
  - sportsbook
  - market
  - price
  - edge
  - ROI
  - impliedProbability
  - probability
  - winner
  - favorite
  - underdog
- unsafe phrases:
  - best bet
  - projected score
  - should win
  - likely winner
  - chance to win
  - win probability
  - market edge
  - sportsbook price
- raw research package shaped fields:
  - package
  - researchPackageVersion
  - researchRunId
  - sourceConstructionRunId
  - sourceConstructionLockId
  - inputConstructionPackage
  - inputSnapshot
  - evidence
  - constructionWarnings
  - constructionVersion
  - lockVersion
- source values other than local-report-preview
- deterministic false
- source=live string outside negative safety documentation

Validation result shape:
- `{ ok: true, errors: [] }`
- `{ ok: false, errors: [{ code, path, message }] }`

Assertion throws concise first error code only.

## Non-goals

- No components
- No UI/UX implementation
- No CSS
- No app/pages/routes
- No server/backend/frontend code
- No HTTP routes
- No website/API deployment
- No file output
- No CLI flag or stdout golden
- No fixtures or generated artifacts
- No network/API/web access
- No live schedule ingestion
- No historical fixture modifications
- No modelProbability as non-null value
- No picks, predictions, betting advice, probability claims, or winner recommendations

## Validation commands

Run:
- npm run inventory:mlb-fixtures
- npm run prospective:mlb:dry-run-check
- npx vitest run tests/prospective/mlb-report-preview-ui-view-model.test.ts --reporter=verbose
- npx vitest run tests/prospective/mlb-report-preview-ui-view-model-synthetic.test.ts --reporter=verbose
- npx vitest run tests/prospective/mlb-report-preview-api-handler.test.ts --reporter=verbose
- npx vitest run tests/prospective/mlb-report-preview-api-contract.test.ts --reporter=verbose
- npx vitest run tests/prospective --reporter=verbose
- npx vitest run tests/backtesting --reporter=verbose
- npx vitest run --reporter=verbose
- npx tsc --noEmit --incremental false --pretty false
- npm test
- npm run build
- git diff --check

## Phase 6G status

Phase 6G adds synthetic, golden-free validation coverage for the Phase 6F boundary.
It preserves the existing view-model contract and docs.
It adds one new test file: `tests/prospective/mlb-report-preview-ui-view-model-synthetic.test.ts`.
It adds one new doc file: `docs/mlb-report-preview-ui-view-model-synthetic-coverage.md`.
It does not add UI implementation, components, CSS, routes, server/network files, CLI flags, fixtures, stdout goldens, or package changes.
It does not modify historical fixtures or introduce live source support.
