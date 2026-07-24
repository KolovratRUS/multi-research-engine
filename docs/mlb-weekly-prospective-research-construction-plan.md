# MLB Weekly Prospective Research Construction Plan

## Status

Phase 4T planning-only documentation.
No implementation.
No new command.
No generated prospective run artifact committed.
No live source used.
No real MLB API request made.
No web lookup used.
No network schedule ingestion.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
`modelProbability` remains null/absent/not available until calibrated.

## Purpose

Phase 4T plans how a locked manual week will feed future weekly prospective research construction.
It follows:

- Phase 4N, the manual week lock workflow plan;
- Phase 4O, the stdout lock CLI;
- Phase 4P, the no-flag lock goldens;
- Phase 4Q, the lock file-output plan;
- Phase 4R, the lock file-output implementation; and
- Phase 4S, the lock file-output goldens.

This phase defines the handoff from the existing lock artifact to a future deterministic research skeleton. It does not implement construction, add commands, generate artifacts, or change lock behavior. The Phase 4P no-flag goldens and Phase 4S file-output goldens remain unchanged.

## Input contract

Future construction should consume one locked week artifact, not a raw manual schedule file. The artifact is the exact `lockedSnapshot` JSON written by the current explicit lock file mode.

Required top-level input fields:

- `lockVersion`
- `runId`
- `lockId`
- `sourceMode`
- `weekStart`
- `weekEnd`
- `lockedAt`
- `snapshot`
- `validationMessages`
- `warnings`

Input requirements:

- `lockVersion` must equal `"mlb-manual-week-lock-v1"`.
- `sourceMode` must equal `"manual-schedule"` in the first implementation.
- `validationMessages` must be empty before construction begins.
- `warnings` may contain entries. Construction should preserve them and may surface them in the future package.
- `snapshot` must pass `validateProspectiveScheduleSnapshot`.
- `snapshot.games` must be non-empty.
- The lock metadata must be preserved exactly rather than recomputed from the nested snapshot or file path.
- Construction must not depend on the input filename, file metadata, an absolute path, environment state, or a machine-specific value.

The locked artifact must not contain these fields anywhere:

- `finalScore`
- `completedGameState`
- `actualStartingPitchers`
- `outcome`
- `outcomeStatus`
- `finalStatus`
- odds, market, or external price fields
- absolute paths
- environment metadata

The first implementation should recursively reject these fields before constructing any output. It should not attempt to sanitize an invalid artifact and continue.

## Construction output contract

Future output should be one weekly prospective research package with these proposed fields:

- `constructionVersion`
- `lockVersion`
- `runId`
- `lockId`
- `sourceMode`
- `weekStart`
- `weekEnd`
- `constructedAt`
- `lockedAt`
- `inputSnapshot`
- `games`
- `constructionWarnings`
- `constructionMessages`

Contract rules:

- `inputSnapshot` should preserve the validated nested schedule snapshot without enrichment or mutation.
- `lockVersion`, `runId`, `lockId`, `sourceMode`, `weekStart`, `weekEnd`, and `lockedAt` should be copied exactly from the locked input.
- `constructedAt` should be deterministic in test mode, preferably derived from `lockedAt` or supplied through an explicit CLI parameter in a later phase.
- Deterministic fixtures must not read the current clock.
- The output must preserve input game order.
- The output must contain exactly one game research stub for each input snapshot game.
- The package must not include final outcomes, completed-game state, actual starters, external price fields, or post-game statistics.
- `modelProbability` remains null/absent/not available until calibrated.

The initial construction package is a structural handoff. It does not evaluate input quality, make a prediction, or claim performance.

## Game construction plan

For each locked snapshot game, future construction should create one prospective game research stub.

Preserve these schedule fields exactly:

- `gameId`
- `officialDate`
- `scheduledStartTime`
- `awayTeam`
- `homeTeam`
- `snapshotTimestamp`
- `sourceProvenance`

Add only construction metadata needed for a deterministic skeleton:

- `constructionStatus`, initially a value such as `"pending-research"`
- `researchMode`, initially a value such as `"pregame"`
- `researchScope`, `"FULL"` or `"TEAM_ONLY"` only where appropriate
- a `dataQuality` placeholder only if the existing conceptual contract supports it
- `constructionMessages`, initially `[]`
- `warnings`, initially `[]` unless preserved input warnings apply

The skeleton must not attach:

- final score or outcome data;
- actual starters;
- closing odds;
- implied probability;
- betting or market metrics; or
- post-game statistics.

The construction step must not read Phase 1G-b pitcher observations for pitcher availability. `TEAM_ONLY` must exclude pitcher evidence. `FULL` and `TEAM_ONLY` must remain distinct construction scopes rather than aliases.

## Research construction phases

The first implementation should only build deterministic skeleton packages from valid locked artifacts.

It should:

- validate the complete locked input before mapping;
- copy locked metadata exactly;
- copy the nested schedule snapshot without mutation;
- create one pending pre-game research stub per locked game;
- preserve input game order;
- expose deterministic messages and warnings; and
- print the package to stdout.

It should not:

- evaluate research quality;
- populate sport-specific evidence;
- make predictions;
- claim model quality or predictive performance;
- attach results; or
- write package files.

Later phases may fill research modules step-by-step while retaining the same local, pre-game-only, leakage-safe boundary.

## Proposed future command

Future command only; do not implement in Phase 4T:

```bash
npm run prospective:mlb:construct-week -- <locked-week-artifact-json>
```

Optional future flags only; do not implement in Phase 4T:

```text
--mode FULL
--mode TEAM_ONLY
--output-dir <directory>
--write-file
```

The first implementation should be stdout-only. File output should be planned only after exact stdout construction goldens exist. Phase 4T does not add the command, flags, script, or package entry.

## Validation rules for future implementation

The future command should:

- reject a missing path;
- reject multiple paths;
- reject malformed JSON;
- reject an unsupported `lockVersion`;
- reject a non-manual `sourceMode` in the first implementation;
- reject non-empty `validationMessages`;
- reject a missing or invalid `snapshot`;
- reject a snapshot with no games;
- recursively reject final, outcome, starter, and external fields anywhere in the locked artifact;
- reject absolute path strings;
- reject environment metadata;
- validate the nested snapshot with `validateProspectiveScheduleSnapshot`;
- ensure one output game for every input snapshot game;
- preserve input game order;
- preserve lock metadata exactly;
- make no network, API, or web calls; and
- provide no live mode.

Validation must complete before any package is constructed. An invalid input should exit 1 and emit no construction package.

## Testing plan

Future implementation coverage should prove:

- a valid locked artifact fixture produces a deterministic stdout package;
- invalid or malformed locked artifacts exit 1 with no package;
- a wrong `lockVersion` exits 1;
- non-empty `validationMessages` exit 1;
- final or outcome fields exit 1;
- `actualStartingPitchers` exits 1;
- external odds, market, or price fields exit 1;
- absolute path strings exit 1;
- empty games exit 1;
- output game count equals input game count;
- input game order is preserved;
- no current timestamps appear;
- the first implementation has no file output;
- no generated artifacts are committed;
- `TEAM_ONLY` construction excludes pitcher evidence when research evidence is introduced; and
- `FULL` and `TEAM_ONLY` remain distinct.

The first golden phase should compare exact parsed stdout for one static valid locked artifact and representative invalid locked artifacts. File-output behavior should not be added to that phase.

## Safety boundary

- Construction is local-only.
- Construction consumes locked artifacts only.
- Construction does not fetch schedules.
- Construction does not call MLB APIs.
- Construction does not browse the web.
- Construction does not attach outcomes.
- Construction does not evaluate results.
- Construction does not use actual starters.
- Construction does not use Phase 1G-b observations for pitcher availability.
- `TEAM_ONLY` excludes pitcher evidence.
- `researchStrengthScore`, `confidence`, `matchConfidence`, `dataQuality`, `volatility`, and `modelProbability` remain conceptually separate.
- `modelProbability` remains null/absent/not available until calibrated.
- Historical fixture data is not mutated.
- Generated artifacts are not committed by default.
- No `source=live` execution is permitted.

Historical behavior remains outside this construction step and unchanged:

- historical completion remains based only on `liveData.plays.allPlays[last].about.endTime`;
- historical completion provenance remains `LAST_COMPLETED_PLAY_END`;
- strict schedule probable handling continues to require `SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN`;
- historical schedule probable information must not be retrospectively promoted; and
- actual starters remain evaluation-only.

## Implementation staging

- Phase 4U — implement stdout-only weekly prospective research construction from a locked manual week.
- Phase 4V — add exact construction stdout golden tests.
- Phase 4W — plan file-output mode for constructed weekly research packages.
- Phase 4X — implement file-output mode for constructed weekly research packages.
- Phase 4Y — add construction file-output goldens.
- Phase 4Z — plan the first real sport-specific research module handoff from constructed packages.

## Success criteria

- The locked artifact is the only input to construction.
- One constructed research stub is produced per locked game.
- No outcomes, actual starters, market or price fields, or post-game fields enter construction.
- No network, API, or web access occurs.
- Historical fixture data remains unchanged.
- Stdout output is deterministic in test mode.
- `modelProbability` remains null/absent/not available until calibrated.
- `FULL` and `TEAM_ONLY` remain separated.

## Validation

- Preflight confirmed the repository at `/Users/samkassirov/multi-research-engine`, on clean `main`, with `HEAD`, local `main`, and the locally recorded `origin/main` all at `97f5ebd187b65ea987882db99a242ef0fb12b198`.
- The fixture inventory guard passes with 29 games from 2024-06-01 through 2024-07-21: June 17 and July 12.
- The prospective dry-run check passes with zero validation errors or warnings.
- The valid manual schedule validator, snapshot, no-flag lock, and file-mode lock behaviors pass through the existing local `tsx/cjs` loader.
- The Phase 4P valid and invalid no-flag stdout outputs remain exact matches for their committed goldens.
- The Phase 4S artifact body and stable-directory file-mode stdout remain exact matches for their committed goldens.
- The manual file-mode lock artifact and output directory were removed after validation.
- Historical export review behavior passes in all four release-check modes through the local loader.
- The focused historical rollout review suite passes: 154 tests.
- The focused lock CLI suite passes: 24 tests.
- The prospective suite passes: 79 tests.
- The backtesting suite passes: 699 tests.
- Full Vitest and `npm test` pass: 835 tests across 56 files.
- TypeScript passes.
- Production build passes.
- Git diff check passes.
- In the managed validation sandbox, direct npm commands whose `tsx` launcher attempted to open a local IPC listener were blocked with `EPERM` before script execution. The affected dry-run, validator, snapshot, no-flag lock, file-mode lock, and historical review entry points passed through the existing local `tsx/cjs` loader pattern; package scripts remain unchanged.
- No live source, MLB API request, web lookup, or network schedule ingestion was used.
- No historical fixture game record, package manifest, package lock, dependency, implementation, test, or golden fixture changed.

## Recommended next safe phase

Phase 4U — implement stdout-only weekly prospective research construction from a locked manual week.

State:

- local-only
- stdout-only
- consumes locked artifact JSON
- validates first
- outputs a deterministic weekly prospective research skeleton
- no file output
- no live, API, or web source
- no network schedule ingestion
- no generated run artifacts committed
- no historical fixture data changes
