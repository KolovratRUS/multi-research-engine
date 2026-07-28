# MLB Research Report Preview Golden Tests

Phase 5Z status
---------------

Phase 5Z adds exact stdout golden regression coverage for the explicit
`--fixture-evidence-local --report-preview-local` command.
It preserves all existing research behavior, CLI modes, and goldens.

Exact command covered
---------------------

    npx tsx scripts/mlb-team-recent-form-research.ts \
      tests/prospective/fixtures/manual-schedule/valid-weekly-prospective-research-construction-file-artifact-v1.json \
      --fixture-evidence-local --report-preview-local

Golden path
-----------

    tests/prospective/fixtures/manual-schedule/valid-mlb-report-preview-local-cli-output-v1.json

What the golden protects
------------------------

- `ok: true`
- `fixtureEvidenceLocal: true`
- `reportPreviewLocal: true`
- `reportPreview.rendererVersion: mlb-research-report-renderer-v1`
- `reportPreview.rendererName: MLB_RESEARCH_REPORT_RENDERER`
- `reportPreview.adapterVersion: mlb-research-report-adapter-v1`
- `reportPreview.metadata.generatedAt: null`
- `reportPreview.metadata.source: local-research-package`
- `reportPreview.metadata.deterministic: true`
- No picks, predictions, betting advice, bookmaker language, or probability claims.
- No raw `finalScore`/`outcome`, `completedGameState`, `finalStatus`, or `actualStartingPitchers`.
- `modelProbability` is absent.
- Only local fixture data is used; no network request is made.

What it does not change
-----------------------

- Phase 5B default stdout golden remains unchanged.
- Phase 5E evidence-enabled stdout golden remains unchanged.
- Phase 5H aggregate stdout golden remains unchanged.
- Phase 5K result-metrics stdout golden remains unchanged.
- Phase 5N schedule-context stdout golden remains unchanged.
- Phase 5T team-quality stdout golden remains unchanged.
- No default behavior change.
- No file output from the research command.
- No website/API implementation.
- No new runtime behavior or flags.

Safety boundaries
-----------------

- Local-only command.
- No `source=live` usage.
- No real MLB API requests.
- No web ingestion.
- No real standings, roster, injury, schedule, odds, prices, or sportsbook data.
- No historical fixture game data added or modified.
- No dependencies added.
- No `package.json` or `package-lock.json` changes.
- `modelProbability` remains null/absent.
- Report-preview output does not infer picks or betting value.

Validation
----------

Tests added in `tests/prospective/mlb-team-recent-form-research.test.ts`:

1. Explicit report-preview output matches the new golden byte-for-byte.
2. Repeated explicit report-preview output is deterministic.
3. New golden contains the expected top-level fields and metadata.
4. New golden does not contain prohibited fields:
   `modelProbability`, `predictedWinner`, `pick`, `winChance`,
   `powerRating`, `teamRank`, `standingsPosition`, `finalScore`,
   `outcome`, `completedGameState`, `finalStatus`, `actualStartingPitchers`,
   `pitcher`, `odds`, `sportsbook`, `market`, `price`, `edge`, `ROI`,
   `impliedProbability`, `probability`, `winner`, `favorite`, `underdog`,
   `best bet`, `value`, `projected score`, `should win`, `likely winner`,
   `chance to win`.

Recommended next safe phase
---------------------------

Phase 6A — plan website/API integration boundary or begin next sport module planning.

Constraints for Phase 6A:

- No default behavior change.
- No file output unless explicitly scoped.
- No website/API implementation unless explicitly scoped.
- No modelProbability.
- No picks/predictions/betting advice.
- No raw outcomes.
- No pitcher evidence.
- No actual starters.
- No live/API/web.
- Preserve existing goldens.


Phase 6A adds a documentation-only MLB website/API integration boundary plan.
It adds no runtime code.
It adds no website/API implementation.
It adds no server/backend/frontend code.
It adds no CLI behavior.
It adds no CLI flag.
It adds no stdout golden.
It preserves Phase 5B default stdout golden.
It preserves Phase 5E evidence-enabled stdout golden.
It preserves Phase 5H aggregate stdout golden.
It preserves Phase 5K result-metrics stdout golden.
It preserves Phase 5N schedule-context stdout golden.
It preserves Phase 5T team-quality stdout golden.
It preserves Phase 5Z report-preview golden.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
It preserves Phase 5S team-quality CLI behavior.
It preserves Phase 5R/5U team-quality behavior.
It preserves Phase 4X construction file-output behavior.
It preserves Phase 4Y construction file-output goldens.
It preserves Phase 4V no-flag construction stdout goldens.
It preserves lock CLI behavior.
It preserves Phase 4P no-flag lock goldens.
It preserves Phase 4S file-output lock goldens.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.
No file output.
No package.json or package-lock.json changes.
Recommended next safe phase is Phase 6B typed local API contract/schema for reportPreview only, or next sport module planning if the user chooses.

Phase 6B adds a typed local API contract/schema for MLB reportPreview only.
It adds no server/backend/frontend code.
It adds no website/API implementation.
It adds no network behavior.
It adds no CLI behavior.
It adds no file output.
It adds no new stdout golden.
It preserves Phase 5B/5E/5H/5K/5N/5T/5Z goldens.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
It preserves Phase 5S team-quality CLI behavior.
It preserves Phase 5R/5U team-quality behavior.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.
Recommended next safe phase is Phase 6C local in-process API adapter/handler using existing reportPreview contract, or next sport module planning if the user chooses.

Phase 6C adds a local in-process MLB reportPreview API adapter/handler.
It adds no real server/backend/frontend code.
It adds no HTTP routes.
It adds no website/API deployment.
It adds no network behavior.
It adds no CLI behavior.
It adds no file output.
It adds no new stdout golden.
It preserves Phase 5B/5E/5H/5K/5N/5T/5Z goldens.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 6B API contract behavior.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.
It preserves Phase 5S team-quality CLI behavior.
It preserves Phase 5R/5U team-quality behavior.
No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.
Recommended next safe phase is Phase 6D optional local handler fixture/golden-free validation coverage, or next sport module planning if the user chooses.
