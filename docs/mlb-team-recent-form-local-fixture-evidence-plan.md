# MLB Team Recent Form Local Fixture Evidence Plan

## Status

Phase 5D implemented.
Local-only.
Explicit evidence-enabled mode.
Default Phase 5B stdout goldens unchanged.
No new research behavior.
No file output.
No generated prospective run artifact committed.
No live source used.
No real MLB API request made.
No web lookup used.
No network schedule ingestion.
No pitcher evidence.
No actual starters.
No `modelProbability`.
No prediction output.
No historical fixture data added or modified.

## Purpose

Phase 5C planned how to wire local fixture-derived evidence into the Phase 5A/5B MLB team recent form research module. It followed:

- Phase 5A, the local-only stdout research skeleton; and
- Phase 5B, the exact valid and representative invalid stdout goldens.

This phase defined the evidence source, provider boundary, deterministic lookback, safe-completion rule, leakage guards, planned output, data-quality labels, tests, and implementation sequence. It did not implement evidence wiring or change the existing module.
Phase 5D implemented that provider boundary in `src/prospective/mlb/team-recent-form-fixture-evidence.ts` and wired it behind the explicit `--fixture-evidence-local` CLI flag in `scripts/mlb-team-recent-form-research.ts`. The Phase 5A research module accepts optional `fixtureEvidenceByGameId` input and preserves its default no-flag behavior.

## Evidence source

The initial evidence source should be local historical fixture records only:

```text
src/fixtures/backtesting/mlb/fixture-games.ts
```

Phase 5D must use no live, API, web, or network schedule source. A raw manual schedule and a manual week lock artifact are not evidence sources. The exact Phase 4X/4Y construction artifact remains the sole target schedule-and-game input to the research module. Historical fixtures are optional evidence inputs only and must never replace or mutate that target input.

Existing historical fixture records must not be modified for Phase 5D and later phases unless a separate explicit fixture-expansion phase is planned and approved. The current fixture surface must be audited before implementation for the required safe-completion field. If a record does not expose that field, it is ineligible; evidence providers must not infer completion from its status or separate outcome record merely to create a positive evidence case.

## Evidence-provider boundary

Phase 5D implemented a pure provider in:

```text
src/prospective/mlb/team-recent-form-fixture-evidence.ts
```

The provider accepts:

- target game identity and `scheduledStartTime`;
- `awayTeam`;
- `homeTeam`;
- local historical fixture records; and
- lookback configuration.

It returns:

- an away evidence list;
- a home evidence list;
- warnings; and
- data-quality metadata.

The provider does not read files itself when avoidable. The caller and tests pass the fixture records explicitly. It makes no network calls, reads no current clock, uses no pitcher evidence, reads no Phase 1G-b observations, and uses no actual starters.

The provider is deterministic and pure: the same target, fixtures, and lookback configuration must return the same result without depending on source filenames, file metadata, environment state, or machine state.

## Lookback plan

The initial Phase 5D configuration should use a small deterministic lookback:

```text
lookbackWindowGames = 3
lookbackWindowDays = 30
```

For each target team separately, evidence inclusion should require all of the following:

- the team is the historical fixture's away or home team;
- the historical fixture is not the target game;
- its official date and scheduled time are before the target `scheduledStartTime`;
- its safe completion timestamp is strictly before the target `scheduledStartTime`;
- its safe completion timestamp is inside the configured day window; and
- safe completion provenance is present and valid.

Eligible records should be sorted newest-first by safe completion time, then scheduled time, then a stable source game identifier. Take at most `lookbackWindowGames` for each team.

If fewer than `lookbackWindowGames` are available, include what is safely available, lower `dataQuality` as appropriate, and add stable warnings. Insufficient evidence should not fail the whole module unless the target or provider input itself is invalid.

## Safe historical completion

Historical completion is safe only when derived from:

```text
liveData.plays.allPlays[last].about.endTime
```

The required provenance is:

```text
LAST_COMPLETED_PLAY_END
```

Phase 5D does not use `finalStatus` or another final-state label alone. It does not use schedule probable information to infer completion, and it does not retrospectively promote historical schedule probable information. Actual starters remain evaluation-only.

If the last completed play or its `about.endTime` is missing, invalid, not paired with the required provenance, or not strictly before the target start, exclude the fixture and add a warning. A separate historical outcome object does not repair missing completion provenance for this provider.

Strict schedule probable handling remains unchanged and continues to require `SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN`.

## Leakage guards

Evidence eligibility must be evaluated independently for every target game.

- Use only historical fixtures with safe evidence strictly before that target game's `scheduledStartTime`.
- Exclude the target game itself even if it appears in the local fixture collection.
- Exclude every future game relative to that target.
- Do not copy `finalScore` into prospective research output. Phase 5D should not output raw completed results.
- Do not copy `completedGameState`.
- Do not output `outcome`, `outcomeStatus`, `finalStatus`, `finalScore`, `actualStartingPitchers`, `modelProbability`, `closingOdds`, `impliedProbability`, `odds`, `market`, or `price`.
- Do not read pitcher fields when selecting or summarizing team evidence.
- Do not allow a later target game to make evidence available to an earlier target game.

Evidence should reference only the minimum safe audit fields:

- `sourceGameId`;
- `officialDate`;
- `completedAt`;
- `team`;
- `teamRole`;
- `opponent`; and
- `sourceProvenance`.

If win/loss or run-differential style summaries are desired later, plan them in a separate aggregate-only phase. They must not expose raw results or imply a calibrated probability.

## Initial evidence output shape

Phase 5D can keep the existing `teamRecentForm` skeleton fields and populate:

- `lookbackWindowGames`;
- `lookbackWindowDays`;
- `awayRecentGamesFound`;
- `homeRecentGamesFound`;
- `awaySummary`;
- `homeSummary`;
- `dataQuality`;
- `volatility`;
- `confidence`;
- `warnings`; and
- `evidence`.

A suggested evidence item is:

```text
sourceGameId
officialDate
completedAt
team
teamRole
opponent
sourceProvenance
```

Do not include raw `finalScore`, an outcome field, actual starters, pitcher fields, external price fields, or `modelProbability`.

Suggested warning codes:

- `TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES`
- `TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION`
- `TEAM_FORM_EVIDENCE_TARGET_GAME_EXCLUDED`
- `TEAM_FORM_EVIDENCE_FUTURE_GAME_EXCLUDED`
- `TEAM_FORM_EVIDENCE_PITCHER_FIELDS_EXCLUDED`
- `TEAM_FORM_EVIDENCE_FORBIDDEN_FIELD_EXCLUDED`

Warnings should identify the target game and affected team where possible without embedding unsafe fields. Exclusion warnings should be deterministic and deduplicated.

## Data-quality plan

Use non-probability labels only.

`dataQuality`:

- `"complete"`
- `"partial"`
- `"insufficient"`
- `"not-evaluated"`

`volatility`:

- `"low"`
- `"medium"`
- `"high"`
- `"not-evaluated"`

`confidence`, meaning confidence in module evidence completeness only:

- `"high"`
- `"medium"`
- `"low"`
- `"not-evaluated"`

Confidence must not mean match probability. `researchStrengthScore`, `confidence`, `matchConfidence`, `dataQuality`, `volatility`, and `modelProbability` remain conceptually separate. Phase 5D must not introduce `modelProbability`.

The provider should document deterministic label rules before using labels other than `"not-evaluated"`. A missing safe-completion surface should produce `"insufficient"`, not invented evidence.

## Testing plan for Phase 5D

Phase 5D should add focused local-only tests.

- Use existing fixture records only unless a separate fixture-expansion phase is approved.
- Validate target-game exclusion.
- Validate future-game exclusion separately for each target.
- Validate safe-completion filtering based only on `LAST_COMPLETED_PLAY_END`.
- Validate that a final-state label or separate outcome without safe completion is insufficient.
- Validate deterministic newest-first ordering and game-count truncation.
- Validate the 30-day window boundary.
- Validate partial and insufficient data warnings.
- Validate that no raw `finalScore` or outcome field appears in output.
- Validate that no pitcher field, actual starter, `modelProbability`, or external price field appears in output.
- Validate deterministic warning ordering and deduplication.
- Validate that the provider reads no current clock and makes no network call.
- Validate that no generated artifacts remain.

The Phase 5B exact stdout goldens should remain unchanged when evidence is disabled by default. If evidence becomes enabled in a new explicit mode, refresh or add goldens only in a later explicit golden phase. If the current fixture surface cannot produce a safely completed positive evidence case, Phase 5D should preserve the exclusion behavior and defer new historical records to a separate fixture-expansion phase.

## Implementation sequencing recommendation

### Phase 5D

Phase 5D implemented the pure local fixture evidence provider behind an explicit `--fixture-evidence-local` CLI flag. It preserves existing default Phase 5B goldens unless evidence is explicitly enabled. It keeps research stdout-only. It adds no file output. It changes no historical fixture records.

### Phase 5E

Exact stdout golden for the evidence-enabled local fixture mode in `docs/mlb-team-recent-form-fixture-evidence-golden-tests.md`.

### Phase 5H

Locks exact aggregate-summary stdout regression goldens in `docs/mlb-team-recent-form-aggregate-summary-golden-tests.md`. It does not change the Phase 5D provider behavior, Phase 5B default goldens, Phase 5E evidence-enabled goldens, or implementation files.

### Phase 5I

- Plan safe result-derived aggregate metrics if a separate later phase confirms local-only safe derivation.
- Keep Phase 5H golden unchanged.

## Success criteria

- Phase 5D can add local fixture evidence without target or future leakage.
- `TEAM_ONLY` remains no-pitcher.
- The construction artifact remains the sole target schedule-and-game input.
- Historical fixtures remain optional evidence only.
- No `modelProbability` or prediction output is introduced.
- No live, API, web, or network schedule source is used.
- Phase 5B default stdout goldens remain protected unless an explicit later phase changes them.
- Historical fixture data remains unchanged unless a separate explicit expansion phase is approved.

## Validation

- Preflight confirmed `/Users/samkassirov/multi-research-engine`, branch `main`, a clean starting worktree, and `HEAD`, local `main`, and the locally recorded `origin/main` at `6b70c2dcdecf53803aa13dbf92b5646d80e1e94c`.
- The fixture inventory guard passes with 29 games from 2024-06-01 through 2024-07-21: June 17 and July 12 across 27 unique dates.
- The prospective dry-run guard passes with zero validation errors and warnings.
- Valid manual schedule validation, snapshot creation, no-flag lock, no-flag construction, explicit construction file mode, and team recent form research pass through the existing local `tsx/cjs` loader. Their valid stdout remains byte-identical to the committed goldens.
- The generated Phase 4X construction artifact is byte-identical to the Phase 4Y artifact golden; both have checksum `4117505029` and size 2,267 bytes.
- Pre-edit protected research, construction, and lock coverage passes 127 tests. This includes Phase 5B valid and invalid research stdout, Phase 4V no-flag construction stdout, Phase 4Y construction file artifact and summary, Phase 4P no-flag lock, and Phase 4S lock file-output goldens.
- The focused research suite passes 45 tests, the focused construction suite passes 58, and the historical rollout-focused suite passes 154.
- The prospective suite passes 182 tests and the backtesting suite passes 699.
- Full Vitest and `npm test` pass 938 tests across 58 files.
- TypeScript, production build, and Git diff check pass.
- Direct npm entry points that invoke the `tsx` launcher are blocked by managed-sandbox IPC `EPERM` before script execution. The validator plus historical release/rollout aliases reproduced the restriction; equivalent manual-pipeline, research, and four historical review modes pass through `node --require tsx/cjs`, including threshold checks.
- Generated construction output, test mutation files, and empty `tmp` directories were removed. No generated lock, construction, research, prospective, export, review, or temporary artifact remains.
- Added-line safety searches find restricted terminology only in negative safety exclusions. `modelProbability` appears only in absence or prohibition statements, and no executable `source=live` command was added.
- Protected-file checks confirm no change to Phase 5A behavior, Phase 5B research goldens, Phase 4X construction behavior, Phase 4Y file-output goldens, Phase 4V no-flag construction goldens, Phase 4P no-flag lock goldens, Phase 4S file-output lock goldens, historical fixture data, `package.json`, or `package-lock.json`.
- No dependency was added. No live source, MLB API request, web lookup, or network schedule ingestion was used.

## Recommended next safe phase

Phase 5F — plan aggregate-only team recent form summaries.

State:

- planning-only;
- no implementation;
- aggregate-only;
- no raw finalScore/outcome output;
- no modelProbability;
- no pitcher evidence;
- no actual starters;
- no file output;
- no live/API/web;
- no network schedule ingestion;
- no historical fixture data changes.

## Phase 5F aggregate summary plan

Phase 5F adds planning-only aggregate summary design in `docs/mlb-team-recent-form-aggregate-summary-plan.md`. It does not add implementation, file output, research behavior, or any live/API/web access.

## Phase 5E validation

- Phase 5E locks exact `--fixture-evidence-local` stdout golden in `tests/prospective/fixtures/manual-schedule/valid-mlb-team-recent-form-research-fixture-evidence-local-cli-output-v1.json`.
- Golden contains `fixtureEvidenceLocal: true`, deterministic insufficient evidence for current local fixtures, exact `inputConstructionPackage` embedding, no `modelProbability`, no `finalScore`, no `completedGameState`, no `actualStartingPitchers`, no absolute paths, and no stack traces.
- Phase 5D provider behavior unchanged.
- No new research behavior, file output, dependency, or fixture data change introduced.

## Phase 5D validation

- The pure local fixture evidence provider passes 59 tests in `tests/prospective/mlb-team-recent-form-research.test.ts`.
- Default valid stdout remains byte-for-byte equal to the Phase 5B valid golden.
- Default invalid stdout remains byte-for-byte equal to the Phase 5B invalid goldens.
- `--fixture-evidence-local` is accepted and emits deterministic output across repeated runs.
- The CLI still rejects unknown arguments and multiple input paths alongside `--fixture-evidence-local`.
- npm run inventory:mlb-fixtures -> PASS (29 games, 2024-06-01 to 2024-07-21)
- npm run prospective:mlb:dry-run-check -> PASS
- npx vitest run --reporter=verbose -> 952 passed
- npx tsc --noEmit --incremental false --pretty false -> exit 0
- npm test -> 952 passed
- npm run build -> exit 0
- git diff --check -> exit 0
- No generated tmp/export/review/prospective artifact remains.
- No historical fixture data changed.
- No dependency, package-lock, or package change was made.
- No live/API/web/network schedule ingestion occurred.
