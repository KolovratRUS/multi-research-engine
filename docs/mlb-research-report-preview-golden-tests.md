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
