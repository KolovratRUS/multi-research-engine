# MLB Weekly Prospective Research Construction File Output Plan

## Status

Phase 4W planning record.
Phase 4X implementation complete.
Phase 4Y exact file-output golden tests complete.
Explicit construction file-output mode implemented.
No generated prospective run artifact committed.
No live source used.
No real MLB API request made.
No web lookup used.
No network schedule ingestion.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
`modelProbability` remains null/absent/not available until calibrated or absent from constructed packages.

## Purpose

Phase 4W planned explicit file-output mode for the existing Phase 4U construction command.
It follows:

- Phase 4U, which implemented stdout-only construction from an exact locked week artifact; and
- Phase 4V, which added exact valid and invalid construction stdout goldens.

Phase 4X implements that plan without altering the existing no-flag stdout contract. The Phase 4V construction stdout goldens, Phase 4P no-flag lock goldens, and Phase 4S file-output lock goldens remain unchanged.

Phase 4Y adds exact static artifact and file-mode stdout summary goldens without changing this implementation. Generated `tmp` artifacts remain ignored, uncommitted, and cleaned.

## Implemented command

The existing command remains:

```bash
npm run prospective:mlb:construct-week -- <locked-week-artifact-json>
```

The explicit file-output mode is:

```bash
npm run prospective:mlb:construct-week -- <locked-week-artifact-json> --write-file --output-dir <directory>
```

Both `--write-file` and `--output-dir` are required together. File output is double opt-in. The flags may precede or follow the single positional input path.

Argument behavior:

- No-flag mode must remain byte-identical to the Phase 4V stdout goldens.
- `--write-file` without `--output-dir` exits 1 and writes nothing.
- `--output-dir` without `--write-file` exits 1 and writes nothing.
- `--output-dir` without a value exits 1 and writes nothing.
- Unknown flags exit 1 and write nothing.
- Multiple input paths exit 1 and write nothing.
- A missing input path exits 1 and writes nothing.

## Recommended ignored output root

```text
tmp/prospective/mlb/weekly-research-packages/
```

The existing `.gitignore` entry for `tmp` covers this root. Generated construction packages must remain ignored and uncommitted by default.

## Deterministic filename

Use:

```text
<weekStart>__<weekEnd>__<runId>__weekly-research-construction-v1.json
```

Example:

```text
2024-07-01__2024-07-07__manual-schedule-fixture-week-1__weekly-research-construction-v1.json
```

The filename must be based only on validated package metadata. It must not depend on the source filename, source path, current clock, file metadata, machine values, or environment.

## Artifact body

The file artifact is the exact inner construction package, not the outer CLI summary.

Required artifact fields:

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

The artifact must exclude:

- `ok`
- CLI validation counts
- outer-summary `validationMessages`
- `artifactWritten`
- `artifactPath`
- `artifactFilename`
- `usage`
- `error`
- absolute input paths
- environment metadata
- `finalScore`
- `completedGameState`
- `actualStartingPitchers`
- `outcome`
- `outcomeStatus`
- `finalStatus`
- `closingOdds`
- `impliedProbability`
- `odds`
- `market`
- `price`
- `modelProbability` unless it is calibrated and explicitly introduced in a separate phase

The artifact uses deterministic pretty-JSON serialization with a trailing newline. Serialization does not mutate, enrich, or reconstruct the validated package.

## File-mode stdout

In file-output mode, stdout remains a summary and does not duplicate the full package after that package is written.

Recommended stdout fields:

- `ok`: `true`
- `runId`
- `lockId`
- `sourceMode`
- `weekStart`
- `weekEnd`
- `constructedAt`
- `lockedAt`
- `gameCount`
- `validationMessageCount`
- `validationErrorCount`
- `validationWarningCount`
- `validationMessages`
- `outputMode`: `"file"`
- `artifactWritten`: `true`
- `artifactFilename`
- `artifactPath`

`artifactPath` must be relative, never absolute. `artifactFilename` must be deterministic. Stdout must contain no stack trace, absolute input path, absolute output path, machine metadata, or environment metadata.

No-flag stdout remains a separate protected contract: it continues to include the complete valid `package` and must remain byte-identical to the Phase 4V goldens.

## Write ordering and safety

- Parse arguments before reading or writing.
- Read and parse the single local input before any write.
- Validate the entire locked input before package construction.
- Validate the complete constructed package and deterministic filename components before creating directories or files.
- Never write on argument, read, parse, input-validation, or construction-validation errors.
- Create the output directory only after validation passes.
- Refuse overwrite by default.
- Defer explicit overwrite support; it should not be implemented initially.
- Derive the artifact path only from validated package metadata.
- Reject unsafe path traversal.
- Reject empty or unsafe filename components, including separators, backslashes, and traversal components.
- Prove the final resolved artifact path stays within the resolved requested output directory.
- Refuse tracked source, test, and fixture directories as output targets.
- Use a same-directory temporary file plus an atomic no-overwrite rename or link where practical.
- Flush the complete temporary file before finalization where practical.
- Clean up temporary files and any incomplete final file on failure where practical.
- Report `artifactWritten: true` only after the final write succeeds.
- Keep generated artifacts ignored and uncommitted.

No write should occur in or beneath tracked areas such as `src/`, `tests/`, or committed fixture directories.

## Implemented error codes

- `WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_DIR_REQUIRED`
- `WEEKLY_RESEARCH_CONSTRUCTION_WRITE_FILE_REQUIRED`
- `WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_DIR_VALUE_REQUIRED`
- `WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_DIR_UNSAFE`
- `WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_PATH_EXISTS`
- `WEEKLY_RESEARCH_CONSTRUCTION_WRITE_FAILED`

The existing `WEEKLY_RESEARCH_CONSTRUCTION_UNKNOWN_ARGUMENT`, missing-path, single-path, read/parse, and locked-artifact validation codes remain applicable. Error output must remain deterministic and contain no stack trace or absolute path.

## Phase 4X behavioral coverage

- No-flag valid stdout remains byte-identical to the Phase 4V valid golden.
- No-flag invalid stdout remains byte-identical to all Phase 4V invalid goldens.
- Valid file mode writes one exact package artifact.
- Parsed artifact JSON equals the stdout `package` from no-flag mode.
- The artifact excludes every outer summary field.
- File-mode stdout contains file metadata but does not contain `package`.
- File-mode stdout reports `outputMode: "file"`.
- File-mode stdout reports a relative `artifactPath`.
- The deterministic filename matches the planned convention.
- Existing output is refused and remains unmodified.
- Missing paired flags write nothing.
- A missing `--output-dir` value writes nothing.
- Unknown flags write nothing.
- Multiple or missing input paths write nothing.
- An invalid lock artifact writes nothing.
- Malformed JSON writes nothing.
- An unsafe output directory writes nothing.
- Source, test, and fixture output directories are refused.
- No generated artifact or temporary file remains after tests.
- No final, outcome, actual-starter, or external field appears in the artifact.
- `modelProbability` remains absent unless separately calibrated and introduced in a later phase.
- Phase 4P no-flag lock goldens remain unchanged.
- Phase 4S file-output lock goldens remain unchanged.

## Safety boundary

- File-output mode remains local-only.
- It consumes the exact validated lock artifact only.
- It writes only the deterministic construction package.
- It does not fetch or ingest schedules.
- It makes no live, API, web, or network request.
- It does not attach outcomes or completed-game state.
- It does not use actual starters.
- Phase 1G-b observations remain unread and unused for pitcher availability.
- `TEAM_ONLY` excludes pitcher evidence.
- `researchStrengthScore`, `confidence`, `matchConfidence`, `dataQuality`, `volatility`, and `modelProbability` remain conceptually separate.
- `modelProbability` remains null/absent/not available until calibrated or absent from constructed packages.
- No historical fixture data is read, added, or modified by this planned mode.
- Generated artifacts are never committed by default.
- No `source=live` execution is permitted.

Historical behavior remains outside this construction step and unchanged:

- historical completion remains based only on `liveData.plays.allPlays[last].about.endTime`;
- historical completion provenance remains `LAST_COMPLETED_PLAY_END`;
- strict schedule probable handling continues to require `SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN`;
- historical schedule probable information must not be retrospectively promoted; and
- actual starters remain evaluation-only.

## Success criteria

- Phase 4U no-flag stdout behavior remains unchanged.
- Phase 4V stdout goldens remain unchanged.
- File mode writes only the exact construction package.
- File-output behavior is double opt-in.
- Invalid input never writes.
- The output path is deterministic, relative in stdout, and ignored.
- The full package is not duplicated in file-mode stdout.
- Existing output is not overwritten.
- Generated artifacts are never committed by default.
- Phase 4P no-flag and Phase 4S file-output lock goldens remain unchanged.

## Validation

- Preflight confirmed `/Users/samkassirov/multi-research-engine`, branch `main`, and `HEAD`, local `main`, and the locally recorded `origin/main` at `dbca2fa10318c53bae3fdcb812b500ff0b84b255`.
- The fixture inventory guard passes with 29 games from 2024-06-01 through 2024-07-21: June 17 and July 12.
- The prospective dry-run check passes with zero validation errors and warnings.
- The valid manual validator, snapshot, no-flag lock, no-flag construction, and explicit construction file-mode behaviors pass. The constructed package contains two games and zero validation messages.
- The file-mode artifact has the deterministic planned filename, equals the exact no-flag `package`, is pretty JSON with a trailing newline, and has no absolute path. File-mode stdout is summary-only and reports a relative `artifactPath`.
- Pre-edit construction and lock regression validation passes: 60 tests. This covers the exact Phase 4V valid and invalid construction stdout goldens, Phase 4P no-flag lock goldens, and Phase 4S file-output lock goldens.
- The focused Phase 4U/4V/4X/4Y construction suite passes: 58 tests.
- Historical export release behavior passes in all four modes through the local loader, including passing threshold checks. The focused rollout review suite passes: 154 tests.
- The prospective suite passes: 136 tests.
- The backtesting suite passes: 699 tests.
- Full Vitest and `npm test` pass: 892 tests across 57 files.
- TypeScript passes.
- Production build passes.
- Git diff check passes.
- Direct npm entry points for the validator, construction file mode, and historical rollout were blocked by managed-sandbox `tsx` launcher IPC `EPERM` before script execution. Equivalent validator, snapshot, lock, construction, and historical release behavior passed through the existing local `tsx/cjs` loader pattern; package scripts remain unchanged.
- Added-line safety searches find no newly introduced restricted terminology. Added `modelProbability` and `source=live` mentions are limited to this validation record’s absence/prohibition statement; full changed-file hits remain pre-existing negative safety language, deliberate invalid field names, absence assertions, or existing project context.
- Protected hashes confirm that all Phase 4V construction stdout goldens, Phase 4P no-flag lock goldens, Phase 4S file-output lock goldens, historical fixture data, `package.json`, and `package-lock.json` remain unchanged.
- Test and manual cleanup succeeded. No generated lock, construction, prospective, export, review, cache, or temporary artifact remains.
- No live source, MLB API request, web lookup, or network schedule ingestion was used.
- No dependency, historical fixture record, construction package semantic, or lock behavior changed.

## Recommended next safe phase

Phase 4Z — plan first real research module handoff.

State:

- planning-only
- no implementation
- no live/API/web
- no network schedule ingestion
- no generated run artifacts committed
- no historical fixture data changes
- no `modelProbability` yet
- no odds/market/betting language except safety exclusions
- identify module inputs and outputs only
