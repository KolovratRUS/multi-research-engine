# MLB Manual Week Lock File Output Plan

## Status

Phase 4Q planning record.
Phase 4R implementation complete.
Explicit local file-output mode implemented.
No generated file-output artifact committed.
No generated prospective run artifact committed.
No live source used.
No real MLB API request made.
No web lookup used.
No network schedule ingestion.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
`modelProbability` remains null/absent/not available until calibrated.

## Purpose

Phase 4Q planned a file-output mode for locked weekly artifacts.
It follows:

- Phase 4N, which planned the manual week lock workflow in `docs/mlb-manual-week-lock-workflow-plan.md`;
- Phase 4O, which implemented the stdout-only lock CLI documented in `docs/mlb-manual-week-lock-cli.md`; and
- Phase 4P, which locked exact lock CLI stdout in `docs/mlb-manual-week-lock-cli-golden-output.md`.

Phase 4R implements that contract in `scripts/mlb-manual-week-lock.ts` and its focused tests. The no-flag command remains stdout-only and continues to match the Phase 4P valid and invalid goldens exactly.

## Current foundation

- Manual schedule schema and validation exist.
- Validator CLI behavior and exact stdout goldens exist.
- Snapshot creation CLI behavior and exact stdout goldens exist.
- Lock CLI behavior and exact stdout goldens exist.
- The lock CLI is local-only; no-flag use remains stdout-only.
- The current lock output is deterministic and includes `lockedSnapshot` only for valid input.
- Explicit file output requires both `--write-file` and `--output-dir`.
- A successful file-mode artifact contains the exact `lockedSnapshot`, not the outer summary.
- The historical fixture inventory remains 29 games from 2024-06-01 through 2024-07-21: June 17 and July 12.

## Implemented command extension

The existing command remains:

```bash
npm run prospective:mlb:lock-manual-week -- <path-to-json>
```

Phase 4R adds:

```text
--write-file
--output-dir <directory>
```

File output requires both `--write-file` and `--output-dir`. This double opt-in makes accidental writes impossible.

- Without either flag, the command must retain its exact stdout-only behavior.
- `--write-file` without `--output-dir` must exit 1 without writing.
- `--output-dir` without `--write-file` must exit 1 without writing. Phase 4Q chooses this rule to avoid ambiguous operator intent.
- File-mode-only stdout fields do not alter the existing no-flag golden output.

## Output location

The recommended root for generated local artifacts is:

```text
tmp/prospective/mlb/manual-week-locks/
```

The repository `.gitignore` ignores `tmp`, so this root is ignored. Generated artifacts must remain uncommitted. The command creates the selected directory only after validation passes.

A caller may provide a different local temporary output directory. The implementation resolves it safely, keeps the final artifact inside that requested directory, and rejects repository-tracked fixture directories under `tests/` and `src/fixtures/`.

## Deterministic filename

Use a deterministic, path-independent filename:

```text
<weekStart>__<weekEnd>__<runId>__manual-week-lock-v1.json
```

Example:

```text
2024-07-01__2024-07-07__manual-schedule-fixture-week-1__manual-week-lock-v1.json
```

The implementation validates the filename components and rejects empty values, path separators, backslashes, and traversal components rather than allowing `runId` to change the destination.

The filename must not:

- include absolute paths;
- hash input or output file paths;
- include current timestamps; or
- include machine-specific values.

## Artifact contents

The artifact must contain the exact `lockedSnapshot` object, not the outer CLI summary.

Required artifact fields:

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

The artifact must not include:

- CLI `usage` or `error` fields;
- absolute input paths;
- environment or machine metadata;
- `finalScore`;
- `completedGameState`;
- `actualStartingPitchers`;
- `outcome`;
- `outcomeStatus`; or
- `finalStatus`.

The nested `snapshot` must remain the existing validated in-memory snapshot. File serialization must not mutate, enrich, or reconstruct it.

## Implemented write safety

- Validate the manual schedule before conversion, locking, directory creation, temporary-file creation, or final-file creation.
- Write only after validation passes.
- Never write on validation errors.
- Never write on argument, read, or parse errors.
- Refuse to overwrite an existing final file by default.
- If overwrite support is planned later, require an explicit `--overwrite` flag and dedicated tests in a separate authorized phase.
- Reject unsafe traversal or ensure normalization proves the final path is a child of the requested output directory.
- Refuse writes to repository-tracked fixture directories.
- Perform one atomic no-overwrite write:
  1. write the complete JSON to a temporary filename in the same output directory;
  2. flush and `fsync` the temporary file;
  3. create the final path with a same-directory hard link that fails when the final path exists; and
  4. remove the temporary file.
- Clean up the temporary file and any newly linked final path after a failed write when practical.

File-mode stdout adds:

- `artifactWritten`: `true` only after the no-overwrite final link succeeds, otherwise `false`;
- `artifactPath`: relative path only when written;
- `artifactFilename`: only when the input is valid and the artifact is written; and
- `outputMode`: `"file"` in explicit file mode.

Without file-output flags, the current stdout contract remains unchanged and is conceptually `"stdout"` mode. No absolute path may appear in stdout.

## Git hygiene

- Generated lock artifacts must not be committed by default.
- The existing `.gitignore` entry for `tmp` covers `tmp/prospective/`.
- Phase 4R tests create output only inside temporary test directories.
- Tests must clean up their temporary directories.
- Phase 4R adds no generated local artifact or output directory to version control.

## Phase 4R behavioral tests

- No flags preserves the exact existing stdout-only behavior and Phase 4P goldens.
- `--write-file` without `--output-dir` exits 1 and writes nothing.
- `--output-dir` without `--write-file` exits 1 and writes nothing.
- Valid input with both flags writes exactly one file.
- Invalid input with both flags writes no file.
- Malformed input with both flags writes no file.
- The artifact filename is deterministic.
- The artifact contents equal `lockedSnapshot` exactly.
- File-mode stdout includes only a relative artifact path.
- Existing artifact refuses overwrite.
- Explicit overwrite behavior remains unimplemented.
- Output directory traversal is rejected or normalized safely.
- No write occurs outside the requested output directory.
- No write occurs in repository-tracked fixture directories.
- JSON contains no absolute paths.
- JSON contains no current-clock timestamps.
- The generated artifact passes `lockedSnapshot` structure checks.
- The artifact contains no final, completion, starter, or outcome fields.
- Package tests clean up temporary directories.
- Both supported flag orders are covered.
- Argument errors include stable codes for missing paired flags, a missing directory value, and unknown arguments.

## Safety boundary

- File-output mode is local-only.
- It writes only validated pre-game lock artifacts.
- It does not attach outcomes.
- It does not evaluate results.
- It does not use actual starters.
- Phase 1G-b observations remain unread and unused for pitcher availability.
- `TEAM_ONLY` excludes pitcher evidence.
- `researchStrengthScore`, `confidence`, `matchConfidence`, `dataQuality`, `volatility`, and `modelProbability` remain conceptually separate.
- `modelProbability` remains null/absent/not available until calibrated.
- No live, API, or web source is used.
- No network schedule ingestion is performed.
- No historical fixture data is read, added, or modified by file-output mode.
- No generated run artifacts are committed by default.
- Historical completion remains based only on `liveData.plays.allPlays[last].about.endTime` with provenance `LAST_COMPLETED_PLAY_END`.
- Strict schedule probable handling continues to require `SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN`.
- Historical schedule probable information must not be retrospectively promoted.
- Actual starters remain evaluation-only.

## Implementation staging

- Phase 4R — implemented file-output mode for the `lock-manual-week` CLI with explicit `--write-file` and `--output-dir` flags.
- Phase 4S — add golden and file-output tests for lock artifacts.
- Phase 4T — plan weekly prospective research construction from a locked manual week.
- Phase 4U — implement weekly prospective research construction from a locked manual week.

## Success criteria

- Existing stdout-only lock CLI behavior remains unchanged unless both file-output flags are provided.
- File writes require explicit flags.
- Valid input writes exactly one deterministic artifact.
- Invalid input writes no artifact.
- No absolute paths appear in JSON output.
- No schedule data comes from a network, API, or web source.
- No final, completion, starter, or outcome fields enter locked artifacts.
- Generated artifacts are never committed by default.
- Historical fixture inventory remains unchanged.

## Validation

- Fixture inventory guard passes with 29 games from 2024-06-01 through 2024-07-21: June 17 and July 12.
- Prospective dry-run logic passes with zero validation errors and warnings.
- Valid manual schedule validator logic exits 0 with two games and no validation messages.
- Valid manual schedule snapshot logic exits 0 and includes the exact two-game `snapshot`.
- Valid manual week lock logic exits 0 and includes the deterministic two-game `lockedSnapshot`.
- Explicit file mode writes the deterministic artifact, reports only a relative path, and the parsed artifact equals `summary.lockedSnapshot` exactly.
- The manual validation artifact and output directory were removed immediately after verification.
- Historical export release behavior passes in all four review modes through the local loader.
- Focused historical export rollout review tests pass: 154 tests.
- Focused lock CLI tests pass: 23 tests, including the unchanged Phase 4P goldens and Phase 4R file behavior.
- Prospective tests pass: 78 tests.
- Backtesting tests pass: 699 tests.
- Full Vitest and `npm test` pass: 834 tests across 56 files.
- TypeScript passes.
- Production build passes.
- Git diff check passes.
- Safety searches find no newly added restricted terminology.
- No prohibited live-source execution or calibration claim was introduced.
- No generated output directory, lock artifact, snapshot artifact, export artifact, or review artifact remains.
- No historical fixture, package manifest, package lock, dependency, or schema changed.
- In the managed validation sandbox, direct npm commands whose `tsx` launcher opens a local IPC listener are blocked with `EPERM` before script execution. The dry-run, validator, snapshot, lock, file-mode lock, and historical review entry points pass through the existing local `tsx/cjs` loader pattern without an IPC listener; package scripts remain unchanged.

## Recommended next safe phase

Phase 4S — add golden and file-output regression tests for lock artifacts.

State:

- local-only
- fixture-only
- verifies exact file-output artifact contents and stdout summaries
- no live/API/web
- no network schedule ingestion
- no generated run artifacts committed
- no historical fixture data changes
