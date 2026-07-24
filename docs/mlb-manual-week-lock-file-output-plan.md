# MLB Manual Week Lock File Output Plan

## Status

Phase 4Q planning-only.
No implementation.
No file-output artifacts.
No generated prospective run artifact committed.
No live source used.
No real MLB API request made.
No web lookup used.
No network schedule ingestion.
No historical fixture data added or modified.
No model-quality or predictive-performance claim.
`modelProbability` remains null/absent/not available until calibrated.

## Purpose

Phase 4Q plans a future file-output mode for locked weekly artifacts.
It follows:

- Phase 4N, which planned the manual week lock workflow in `docs/mlb-manual-week-lock-workflow-plan.md`;
- Phase 4O, which implemented the stdout-only lock CLI documented in `docs/mlb-manual-week-lock-cli.md`; and
- Phase 4P, which locked exact lock CLI stdout in `docs/mlb-manual-week-lock-cli-golden-output.md`.

This phase does not implement file-output mode, create output directories, write artifacts, add command flags, or change command behavior.

## Current foundation

- Manual schedule schema and validation exist.
- Validator CLI behavior and exact stdout goldens exist.
- Snapshot creation CLI behavior and exact stdout goldens exist.
- Lock CLI behavior and exact stdout goldens exist.
- The current lock CLI is local-only and stdout-only.
- The current lock output is deterministic and includes `lockedSnapshot` only for valid input.
- The historical fixture inventory remains 29 games from 2024-06-01 through 2024-07-21: June 17 and July 12.

## Proposed future command extension

Existing command to extend later:

```bash
npm run prospective:mlb:lock-manual-week -- <path-to-json>
```

Proposed future flags only; do not implement them in Phase 4Q:

```text
--write-file
--output-dir <directory>
```

Future file output should require both `--write-file` and `--output-dir`. This double opt-in makes accidental writes impossible.

- Without either flag, the command must retain its exact stdout-only behavior.
- `--write-file` without `--output-dir` must exit 1 without writing.
- `--output-dir` without `--write-file` must exit 1 without writing. Phase 4Q chooses this rule to avoid ambiguous operator intent.
- File-mode-only stdout fields must not alter the existing no-flag golden output.

## Proposed output location

The recommended root for future generated local artifacts is:

```text
tmp/prospective/mlb/manual-week-locks/
```

The repository `.gitignore` currently ignores `tmp`, so this proposed root is already ignored. Generated artifacts must remain uncommitted. Phase 4Q does not create this directory or write any artifact.

A caller may later provide a different local temporary output directory for testing, but the implementation must resolve it safely, keep the final artifact inside that requested directory, and reject repository-tracked fixture directories.

## Proposed filename

Use a deterministic, path-independent filename:

```text
<weekStart>__<weekEnd>__<runId>__manual-week-lock-v1.json
```

Example:

```text
2024-07-01__2024-07-07__manual-schedule-fixture-week-1__manual-week-lock-v1.json
```

The future implementation must validate the filename components and reject path separators or traversal components rather than allowing `runId` to change the destination.

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

## Write safety

- Validate the manual schedule before conversion, locking, directory creation, temporary-file creation, or final-file creation.
- Write only after validation passes.
- Never write on validation errors.
- Never write on argument, read, or parse errors.
- Refuse to overwrite an existing final file by default.
- If overwrite support is planned later, require an explicit `--overwrite` flag and dedicated tests in a separate authorized phase.
- Reject unsafe traversal or ensure normalization proves the final path is a child of the requested output directory.
- Refuse writes to repository-tracked fixture directories.
- Perform one atomic write when practical:
  1. write the complete JSON to a temporary filename in the same output directory;
  2. flush and `fsync` if practical in the later implementation; and
  3. rename the temporary file to the final deterministic filename.
- Clean up a temporary file after a failed write when safe and practical.

For the first implementation, file-mode stdout should add:

- `artifactWritten`: `true` only after the final rename succeeds, otherwise `false`;
- `artifactPath`: relative path only when written;
- `artifactFilename`: only when the input is valid and the artifact is written; and
- `outputMode`: `"file"` in explicit file mode.

Without file-output flags, the current stdout contract remains unchanged and is conceptually `"stdout"` mode. No absolute path may appear in stdout.

## Git hygiene

- Generated lock artifacts must not be committed by default.
- The existing `.gitignore` entry for `tmp` covers `tmp/prospective/`.
- Future implementation tests must create output only inside temporary test directories.
- Tests must clean up their temporary directories.
- Future implementation must not add generated local artifacts or their containing output directories to version control.

## Testing plan for future implementation

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
- Explicit overwrite behavior remains unimplemented unless separately planned and authorized.
- Output directory traversal is rejected or normalized safely.
- No write occurs outside the requested output directory.
- No write occurs in repository-tracked fixture directories.
- JSON contains no absolute paths.
- JSON contains no current-clock timestamps.
- The generated artifact passes `lockedSnapshot` structure checks.
- The artifact contains no final, completion, starter, or outcome fields.
- Package tests clean up temporary directories.

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

- Phase 4R — implement file-output mode for the `lock-manual-week` CLI with explicit `--write-file` and `--output-dir` flags.
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
- Historical export release behavior passes in all four review modes through the local loader.
- Focused historical export rollout review tests pass: 154 tests.
- Prospective tests pass: 65 tests, including all 10 lock CLI tests.
- Backtesting tests pass: 699 tests.
- Full Vitest and `npm test` pass: 821 tests across 56 files.
- TypeScript passes.
- Production build passes.
- Git diff check passes.
- Safety searches confirm restricted terms occur only in negative safety statements in the changed documentation.
- `modelProbability` appears only as null/absent/not available until calibrated or in a statement preserving conceptual separation.
- The literal `source=live` appears only in this negative safety statement and never in an executable command.
- No generated output directory, lock artifact, snapshot artifact, export artifact, or review artifact was created or staged.
- No historical fixture, package manifest, package lock, dependency, command, schema, script, or test was changed.
- In the managed validation sandbox, direct npm commands whose `tsx` launcher opens a local IPC listener are blocked with `EPERM` before script execution. The dry-run, validator, snapshot, lock, and historical review entry points pass through the existing local `tsx/cjs` loader pattern without an IPC listener; package scripts remain unchanged.

## Recommended next safe phase

Phase 4R — implement file-output mode for the `lock-manual-week` CLI.

State:

- local-only
- explicit file-output flags only
- validates first
- writes exactly one deterministic locked artifact only when valid
- no file writes without explicit flags
- no live/API/web
- no network schedule ingestion
- no generated run artifacts committed
- no historical fixture data changes
