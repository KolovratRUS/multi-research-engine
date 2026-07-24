import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, join, win32 } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CONSTRUCTION_VERSION,
  constructMLBWeeklyProspectiveResearchPackage,
  type MLBManualWeekLockedSnapshot,
  validateMLBManualWeekLockedSnapshot,
} from '@/prospective/mlb/weekly-research-construction';

const projectRoot = join(__dirname, '..', '..');
const scriptPath = join(projectRoot, 'scripts', 'mlb-weekly-prospective-research-construct.ts');
const fixtureRoot = join(
  projectRoot,
  'tests',
  'prospective',
  'fixtures',
  'manual-schedule',
);
const fixturePath = join(
  fixtureRoot,
  'valid-manual-week-lock-file-artifact-v1.json',
);
const validGoldenPath = join(
  fixtureRoot,
  'valid-weekly-prospective-research-construction-cli-output-v1.json',
);
const invalidLockVersionGoldenPath = join(
  fixtureRoot,
  'invalid-weekly-prospective-research-construction-lock-version-output-v1.json',
);
const invalidForbiddenFieldGoldenPath = join(
  fixtureRoot,
  'invalid-weekly-prospective-research-construction-forbidden-field-output-v1.json',
);
const invalidEmptyGamesGoldenPath = join(
  fixtureRoot,
  'invalid-weekly-prospective-research-construction-empty-games-output-v1.json',
);
const goldenPaths = [
  validGoldenPath,
  invalidLockVersionGoldenPath,
  invalidForbiddenFieldGoldenPath,
  invalidEmptyGamesGoldenPath,
] as const;
const tempRoot = join(projectRoot, 'tmp', 'prospective-phase4u-weekly-research-construction');
const artifactFilename = [
  '2024-07-01',
  '2024-07-07',
  'manual-schedule-fixture-week-1',
  'weekly-research-construction-v1.json',
].join('__');

function readValidArtifact(): Record<string, unknown> {
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as Record<string, unknown>;
}

function readGolden(path: string): string {
  return readFileSync(path, 'utf8');
}

function writeTemporaryArtifact(
  filename: string,
  mutate: (artifact: Record<string, unknown>) => void,
): string {
  const artifact = readValidArtifact();
  mutate(artifact);
  mkdirSync(tempRoot, { recursive: true });
  const path = join(tempRoot, filename);
  writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`);
  return path;
}

function runConstructWeek(args: string[]): string {
  return execFileSync(process.execPath, ['--require', 'tsx/cjs', scriptPath, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
}

function runConstructWeekExpectingFailure(args: string[]): {
  readonly stdout: string;
  readonly summary: Record<string, unknown>;
} {
  let error: unknown;
  try {
    runConstructWeek(args);
  } catch (caught) {
    error = caught;
  }

  expect(error).toBeTruthy();
  const stdout = error && typeof error === 'object' && 'stdout' in error
    ? (error as { stdout: string }).stdout
    : '{}';
  return {
    stdout,
    summary: JSON.parse(stdout) as Record<string, unknown>,
  };
}

function expectNoPackage(summary: Record<string, unknown>): void {
  expect('package' in summary).toBe(false);
}

function collectKeys(input: unknown, keys: string[] = []): string[] {
  if (Array.isArray(input)) {
    for (const value of input) {
      collectKeys(value, keys);
    }
    return keys;
  }
  if (typeof input !== 'object' || input === null) {
    return keys;
  }
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    keys.push(key);
    collectKeys(value, keys);
  }
  return keys;
}

function expectValidationCode(summary: Record<string, unknown>, code: string): void {
  const validationMessages = summary.validationMessages as Array<{ code: string }>;
  expect(validationMessages.map((message) => message.code)).toContain(code);
}

function expectNoAbsolutePathStrings(input: unknown): void {
  if (typeof input === 'string') {
    expect(isAbsolute(input)).toBe(false);
    expect(win32.isAbsolute(input)).toBe(false);
    return;
  }
  if (Array.isArray(input)) {
    for (const value of input) {
      expectNoAbsolutePathStrings(value);
    }
    return;
  }
  if (typeof input !== 'object' || input === null) {
    return;
  }
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    expectNoAbsolutePathStrings(key);
    expectNoAbsolutePathStrings(value);
  }
}

describe('Phase 4U/4V/4X MLB weekly prospective research construction', () => {
  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
    expect(existsSync(tempRoot)).toBe(false);
  });

  it('constructs one deterministic pending pre-game FULL stub per locked game', () => {
    const artifact = readValidArtifact() as unknown as MLBManualWeekLockedSnapshot;

    expect(validateMLBManualWeekLockedSnapshot(artifact)).toEqual([]);
    const first = constructMLBWeeklyProspectiveResearchPackage(artifact);
    const second = constructMLBWeeklyProspectiveResearchPackage(artifact);

    expect(first).toEqual(second);
    expect(first.constructionVersion).toBe(CONSTRUCTION_VERSION);
    expect(first.constructedAt).toBe(artifact.lockedAt);
    expect(first.lockVersion).toBe(artifact.lockVersion);
    expect(first.runId).toBe(artifact.runId);
    expect(first.lockId).toBe(artifact.lockId);
    expect(first.sourceMode).toBe(artifact.sourceMode);
    expect(first.weekStart).toBe(artifact.weekStart);
    expect(first.weekEnd).toBe(artifact.weekEnd);
    expect(first.lockedAt).toBe(artifact.lockedAt);
    expect(first.inputSnapshot).toEqual(artifact.snapshot);
    expect(first.games).toHaveLength(artifact.snapshot.games.length);
    expect(first.games.map((game) => game.gameId)).toEqual(
      artifact.snapshot.games.map((game) => game.gameId),
    );
    for (const game of first.games) {
      expect(game.constructionStatus).toBe('pending-research');
      expect(game.researchMode).toBe('pregame');
      expect(game.researchScope).toBe('FULL');
      expect(game.constructionMessages).toEqual([]);
      expect(game.warnings).toEqual([]);
    }
    expect(first.constructionMessages).toEqual([]);
    expect(first.constructionWarnings).toEqual([]);
  });

  it('emits the deterministic package through the stdout-only CLI', () => {
    const first = JSON.parse(runConstructWeek([fixturePath])) as Record<string, unknown>;
    const second = JSON.parse(runConstructWeek([fixturePath])) as Record<string, unknown>;

    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    expect(first.runId).toBe('manual-schedule-fixture-week-1');
    expect(first.lockId).toBe('manual-week-lock:manual-schedule-fixture-week-1');
    expect(first.sourceMode).toBe('manual-schedule');
    expect(first.weekStart).toBe('2024-07-01');
    expect(first.weekEnd).toBe('2024-07-07');
    expect(first.constructedAt).toBe('2024-07-01T00:00:00Z');
    expect(first.lockedAt).toBe('2024-07-01T00:00:00Z');
    expect(first.gameCount).toBe(2);
    expect(first.validationMessageCount).toBe(0);
    expect(first.validationErrorCount).toBe(0);
    expect(first.validationWarningCount).toBe(0);
    expect(first.validationMessages).toEqual([]);
    expect(first.package).toBeDefined();
  });

  it('matches the exact valid construction stdout golden byte-for-byte', () => {
    const stdout = runConstructWeek([fixturePath]);
    const goldenText = readGolden(validGoldenPath);
    const golden = JSON.parse(goldenText) as {
      package: {
        constructionVersion: string;
        constructedAt: string;
        lockedAt: string;
        inputSnapshot: unknown;
        games: Array<{
          constructionStatus: string;
          researchMode: string;
          researchScope: string;
        }>;
        constructionWarnings: unknown[];
        constructionMessages: unknown[];
      };
    };
    const artifact = readValidArtifact();

    expect(stdout).toBe(goldenText);
    expect(golden.package.constructionVersion).toBe(CONSTRUCTION_VERSION);
    expect(golden.package.constructedAt).toBe(golden.package.lockedAt);
    expect(golden.package.inputSnapshot).toEqual(artifact.snapshot);
    expect(golden.package.games).toHaveLength(2);
    for (const game of golden.package.games) {
      expect(game.constructionStatus).toBe('pending-research');
      expect(game.researchMode).toBe('pregame');
      expect(game.researchScope).toBe('FULL');
    }
    expect(golden.package.constructionWarnings).toEqual([]);
    expect(golden.package.constructionMessages).toEqual([]);
  });

  it('keeps result, completion, starter, external, and uncalibrated fields out of the package', () => {
    const summary = JSON.parse(runConstructWeek([fixturePath])) as Record<string, unknown>;
    const keys = collectKeys(summary.package);

    for (const field of [
      'modelProbability',
      'finalScore',
      'completedGameState',
      'actualStartingPitchers',
      'outcome',
      'outcomeStatus',
      'finalStatus',
      'closingOdds',
      'impliedProbability',
      'odds',
      'market',
      'price',
    ]) {
      expect(keys).not.toContain(field);
    }
  });

  it('exits 1 for malformed JSON and emits no package', () => {
    mkdirSync(tempRoot, { recursive: true });
    const malformedPath = join(tempRoot, 'malformed.json');
    writeFileSync(malformedPath, 'not-json');

    const { summary } = runConstructWeekExpectingFailure([malformedPath]);

    expect(summary.ok).toBe(false);
    expect(summary.error).toBe('WEEKLY_RESEARCH_CONSTRUCTION_READ_OR_PARSE_FAILED');
    expectNoPackage(summary);
  });

  it('exits 1 for missing, multiple, and unknown no-flag CLI arguments', () => {
    const missing = runConstructWeekExpectingFailure([]).summary;
    const multiple = runConstructWeekExpectingFailure([fixturePath, fixturePath]).summary;
    const unknown = runConstructWeekExpectingFailure([fixturePath, '--unknown']).summary;

    expect(missing.error).toBe('WEEKLY_RESEARCH_CONSTRUCTION_PATH_REQUIRED');
    expect(multiple.error).toBe('WEEKLY_RESEARCH_CONSTRUCTION_SINGLE_PATH_ONLY');
    expect(unknown.error).toBe('WEEKLY_RESEARCH_CONSTRUCTION_UNKNOWN_ARGUMENT');
    expectNoPackage(missing);
    expectNoPackage(multiple);
    expectNoPackage(unknown);
  });

  it('writes one deterministic exact package artifact in explicit file mode', () => {
    const outputDir = join(tempRoot, 'valid-file-mode');
    const noFlagSummary = JSON.parse(runConstructWeek([fixturePath])) as {
      package: Record<string, unknown>;
    };
    const stdout = runConstructWeek([
      fixturePath,
      '--write-file',
      '--output-dir',
      outputDir,
    ]);
    const summary = JSON.parse(stdout) as Record<string, unknown>;
    const artifactPath = join(outputDir, artifactFilename);
    const artifactText = readFileSync(artifactPath, 'utf8');
    const artifact = JSON.parse(artifactText) as Record<string, unknown>;

    expect(readdirSync(outputDir)).toEqual([artifactFilename]);
    expect(summary.ok).toBe(true);
    expect(summary.runId).toBe('manual-schedule-fixture-week-1');
    expect(summary.lockId).toBe('manual-week-lock:manual-schedule-fixture-week-1');
    expect(summary.sourceMode).toBe('manual-schedule');
    expect(summary.weekStart).toBe('2024-07-01');
    expect(summary.weekEnd).toBe('2024-07-07');
    expect(summary.constructedAt).toBe('2024-07-01T00:00:00Z');
    expect(summary.lockedAt).toBe('2024-07-01T00:00:00Z');
    expect(summary.gameCount).toBe(2);
    expect(summary.validationMessageCount).toBe(0);
    expect(summary.validationErrorCount).toBe(0);
    expect(summary.validationWarningCount).toBe(0);
    expect(summary.validationMessages).toEqual([]);
    expect(summary.outputMode).toBe('file');
    expect(summary.artifactWritten).toBe(true);
    expect(summary.artifactFilename).toBe(artifactFilename);
    expect(summary.artifactPath).toBe(
      `tmp/prospective-phase4u-weekly-research-construction/valid-file-mode/${artifactFilename}`,
    );
    expect('package' in summary).toBe(false);
    expect(artifact).toEqual(noFlagSummary.package);
    expect(artifactText).toBe(`${JSON.stringify(artifact, null, 2)}\n`);
    expect(artifactText.endsWith('\n')).toBe(true);
  });

  it('accepts file flags before the positional input path', () => {
    const outputDir = join(tempRoot, 'flags-first');
    const summary = JSON.parse(runConstructWeek([
      '--write-file',
      '--output-dir',
      outputDir,
      fixturePath,
    ])) as Record<string, unknown>;

    expect(summary.ok).toBe(true);
    expect(summary.outputMode).toBe('file');
    expect(summary.artifactWritten).toBe(true);
    expect(readdirSync(outputDir)).toEqual([artifactFilename]);
  });

  it('keeps outer summary fields out of the file artifact', () => {
    const outputDir = join(tempRoot, 'inner-package-only');
    const summary = JSON.parse(runConstructWeek([
      fixturePath,
      '--write-file',
      '--output-dir',
      outputDir,
    ])) as Record<string, unknown>;
    const artifact = JSON.parse(
      readFileSync(join(outputDir, artifactFilename), 'utf8'),
    ) as Record<string, unknown>;

    for (const field of [
      'ok',
      'validationMessageCount',
      'validationErrorCount',
      'validationWarningCount',
      'artifactWritten',
      'artifactPath',
      'artifactFilename',
      'usage',
      'error',
    ]) {
      expect(field in artifact).toBe(false);
    }
    expect('package' in summary).toBe(false);
  });

  it('keeps absolute paths out of file-mode stdout and artifact JSON', () => {
    const outputDir = join(tempRoot, 'path-free');
    const stdout = runConstructWeek([
      fixturePath,
      '--write-file',
      '--output-dir',
      outputDir,
    ]);
    const summary = JSON.parse(stdout) as Record<string, unknown>;
    const artifact = JSON.parse(
      readFileSync(join(outputDir, artifactFilename), 'utf8'),
    ) as Record<string, unknown>;

    expect(stdout).not.toContain(projectRoot);
    expectNoAbsolutePathStrings(summary);
    expectNoAbsolutePathStrings(artifact);
  });

  it('refuses overwrite and leaves the existing artifact unchanged', () => {
    const outputDir = join(tempRoot, 'no-overwrite');
    const args = [fixturePath, '--write-file', '--output-dir', outputDir];
    runConstructWeek(args);
    const artifactPath = join(outputDir, artifactFilename);
    const before = readFileSync(artifactPath, 'utf8');

    const { summary } = runConstructWeekExpectingFailure(args);

    expect(summary.ok).toBe(false);
    expect(summary.outputMode).toBe('file');
    expect(summary.artifactWritten).toBe(false);
    expect(summary.error).toBe('WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_PATH_EXISTS');
    expectNoPackage(summary);
    expect(readFileSync(artifactPath, 'utf8')).toBe(before);
    expect(readdirSync(outputDir)).toEqual([artifactFilename]);
  });

  it('requires --output-dir with --write-file and writes nothing', () => {
    const { summary } = runConstructWeekExpectingFailure([
      fixturePath,
      '--write-file',
    ]);

    expect(summary.error).toBe('WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_DIR_REQUIRED');
    expectNoPackage(summary);
    expect(existsSync(tempRoot)).toBe(false);
  });

  it('requires --write-file with --output-dir and writes nothing', () => {
    const outputDir = join(tempRoot, 'missing-write-file');
    const { summary } = runConstructWeekExpectingFailure([
      fixturePath,
      '--output-dir',
      outputDir,
    ]);

    expect(summary.error).toBe('WEEKLY_RESEARCH_CONSTRUCTION_WRITE_FILE_REQUIRED');
    expectNoPackage(summary);
    expect(existsSync(outputDir)).toBe(false);
  });

  it('requires a value after --output-dir and writes nothing', () => {
    const { summary } = runConstructWeekExpectingFailure([
      fixturePath,
      '--write-file',
      '--output-dir',
    ]);

    expect(summary.error).toBe('WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_DIR_VALUE_REQUIRED');
    expectNoPackage(summary);
    expect(existsSync(tempRoot)).toBe(false);
  });

  it('rejects an unknown file-mode flag and writes nothing', () => {
    const outputDir = join(tempRoot, 'unknown-flag');
    const { summary } = runConstructWeekExpectingFailure([
      fixturePath,
      '--write-file',
      '--output-dir',
      outputDir,
      '--unknown',
    ]);

    expect(summary.error).toBe('WEEKLY_RESEARCH_CONSTRUCTION_UNKNOWN_ARGUMENT');
    expectNoPackage(summary);
    expect(existsSync(outputDir)).toBe(false);
  });

  it('rejects multiple input paths with file flags and writes nothing', () => {
    const outputDir = join(tempRoot, 'multiple-inputs');
    const { summary } = runConstructWeekExpectingFailure([
      fixturePath,
      fixturePath,
      '--write-file',
      '--output-dir',
      outputDir,
    ]);

    expect(summary.error).toBe('WEEKLY_RESEARCH_CONSTRUCTION_SINGLE_PATH_ONLY');
    expectNoPackage(summary);
    expect(existsSync(outputDir)).toBe(false);
  });

  it('rejects a missing input path with file flags and writes nothing', () => {
    const outputDir = join(tempRoot, 'missing-input');
    const { summary } = runConstructWeekExpectingFailure([
      '--write-file',
      '--output-dir',
      outputDir,
    ]);

    expect(summary.error).toBe('WEEKLY_RESEARCH_CONSTRUCTION_PATH_REQUIRED');
    expectNoPackage(summary);
    expect(existsSync(outputDir)).toBe(false);
  });

  it('writes nothing for an invalid locked artifact in file mode', () => {
    const inputPath = writeTemporaryArtifact('file-mode-invalid.json', (artifact) => {
      artifact.lockVersion = 'wrong-lock-version';
    });
    const outputDir = join(tempRoot, 'invalid-output');
    const { summary } = runConstructWeekExpectingFailure([
      inputPath,
      '--write-file',
      '--output-dir',
      outputDir,
    ]);

    expectValidationCode(summary, 'WEEKLY_RESEARCH_LOCK_VERSION_INVALID');
    expectNoPackage(summary);
    expect(existsSync(outputDir)).toBe(false);
  });

  it('writes nothing for malformed JSON in file mode', () => {
    mkdirSync(tempRoot, { recursive: true });
    const malformedPath = join(tempRoot, 'file-mode-malformed.json');
    const outputDir = join(tempRoot, 'malformed-output');
    writeFileSync(malformedPath, 'not-json');

    const { summary } = runConstructWeekExpectingFailure([
      malformedPath,
      '--write-file',
      '--output-dir',
      outputDir,
    ]);

    expect(summary.error).toBe('WEEKLY_RESEARCH_CONSTRUCTION_READ_OR_PARSE_FAILED');
    expectNoPackage(summary);
    expect(existsSync(outputDir)).toBe(false);
  });

  it('rejects unsafe filename components before creating the output directory', () => {
    const inputPath = writeTemporaryArtifact('unsafe-run-id.json', (artifact) => {
      artifact.runId = '../unsafe-run-id';
      const snapshot = artifact.snapshot as Record<string, unknown>;
      snapshot.runId = '../unsafe-run-id';
    });
    const outputDir = join(tempRoot, 'unsafe-filename-output');
    const { summary } = runConstructWeekExpectingFailure([
      inputPath,
      '--write-file',
      '--output-dir',
      outputDir,
    ]);

    expect(summary.error).toBe('WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_DIR_UNSAFE');
    expect(summary.artifactWritten).toBe(false);
    expectNoPackage(summary);
    expect(existsSync(outputDir)).toBe(false);
  });

  it.each([
    'src',
    'scripts',
    'tests',
    'docs',
    'prisma',
  ])('refuses the repository %s directory as an output root', (directory) => {
    const outputDir = join(projectRoot, directory, 'phase4x-unsafe-output');
    const { summary } = runConstructWeekExpectingFailure([
      fixturePath,
      '--write-file',
      '--output-dir',
      outputDir,
    ]);

    expect(summary.error).toBe('WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_DIR_UNSAFE');
    expect(summary.artifactWritten).toBe(false);
    expectNoPackage(summary);
    expect(existsSync(outputDir)).toBe(false);
  });

  it('refuses a normalized output traversal into a protected directory', () => {
    const outputDir = join(tempRoot, '..', '..', 'tests', 'phase4x-unsafe-output');
    const { summary } = runConstructWeekExpectingFailure([
      fixturePath,
      '--write-file',
      '--output-dir',
      outputDir,
    ]);

    expect(summary.error).toBe('WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_DIR_UNSAFE');
    expect(summary.artifactWritten).toBe(false);
    expectNoPackage(summary);
    expect(existsSync(join(projectRoot, 'tests', 'phase4x-unsafe-output'))).toBe(false);
  });

  it('reports a stable write failure and leaves no temporary artifact', () => {
    mkdirSync(tempRoot, { recursive: true });
    const outputPath = join(tempRoot, 'output-is-a-file');
    writeFileSync(outputPath, 'not-a-directory');

    const { summary } = runConstructWeekExpectingFailure([
      fixturePath,
      '--write-file',
      '--output-dir',
      outputPath,
    ]);

    expect(summary.error).toBe('WEEKLY_RESEARCH_CONSTRUCTION_WRITE_FAILED');
    expect(summary.artifactWritten).toBe(false);
    expectNoPackage(summary);
    expect(readFileSync(outputPath, 'utf8')).toBe('not-a-directory');
    expect(readdirSync(tempRoot)).toEqual(['output-is-a-file']);
  });

  it('rejects the wrong lock version', () => {
    const path = writeTemporaryArtifact('wrong-lock-version.json', (artifact) => {
      artifact.lockVersion = 'wrong-lock-version';
    });
    const { summary } = runConstructWeekExpectingFailure([path]);

    expectValidationCode(summary, 'WEEKLY_RESEARCH_LOCK_VERSION_INVALID');
    expectNoPackage(summary);
  });

  it('matches the exact wrong-lockVersion stdout golden byte-for-byte', () => {
    const path = writeTemporaryArtifact('golden-wrong-lock-version.json', (artifact) => {
      artifact.lockVersion = 'wrong-lock-version';
    });
    const { stdout, summary } = runConstructWeekExpectingFailure([path]);
    const goldenText = readGolden(invalidLockVersionGoldenPath);
    const golden = JSON.parse(goldenText) as Record<string, unknown>;

    expect(stdout).toBe(goldenText);
    expect(summary).toEqual(golden);
    expectValidationCode(golden, 'WEEKLY_RESEARCH_LOCK_VERSION_INVALID');
    expectNoPackage(golden);
  });

  it('rejects non-manual source mode', () => {
    const path = writeTemporaryArtifact('wrong-source-mode.json', (artifact) => {
      artifact.sourceMode = 'authorized-ingestion';
    });
    const { summary } = runConstructWeekExpectingFailure([path]);

    expectValidationCode(summary, 'WEEKLY_RESEARCH_SOURCE_MODE_UNSUPPORTED');
    expectNoPackage(summary);
  });

  it('rejects non-empty locked validation messages', () => {
    const path = writeTemporaryArtifact('validation-messages.json', (artifact) => {
      artifact.validationMessages = [{
        severity: 'error',
        code: 'LOCK_INPUT_INVALID',
        message: 'locked input was not valid',
      }];
    });
    const { summary } = runConstructWeekExpectingFailure([path]);

    expectValidationCode(summary, 'WEEKLY_RESEARCH_VALIDATION_MESSAGES_PRESENT');
    expectNoPackage(summary);
  });

  it.each([
    ['a missing', undefined],
    ['an invalid', 'not-a-snapshot'],
  ])('rejects %s snapshot', (label, snapshot) => {
    const path = writeTemporaryArtifact(`snapshot-${label.replace(' ', '-')}.json`, (artifact) => {
      if (snapshot === undefined) {
        delete artifact.snapshot;
      } else {
        artifact.snapshot = snapshot;
      }
    });
    const { summary } = runConstructWeekExpectingFailure([path]);

    expectValidationCode(summary, 'WEEKLY_RESEARCH_SNAPSHOT_INVALID');
    expectNoPackage(summary);
  });

  it('rejects an empty locked game list', () => {
    const path = writeTemporaryArtifact('empty-games.json', (artifact) => {
      const snapshot = artifact.snapshot as Record<string, unknown>;
      snapshot.games = [];
    });
    const { summary } = runConstructWeekExpectingFailure([path]);

    expectValidationCode(summary, 'WEEKLY_RESEARCH_SNAPSHOT_EMPTY');
    expectNoPackage(summary);
  });

  it('matches the exact empty-games stdout golden byte-for-byte', () => {
    const path = writeTemporaryArtifact('golden-empty-games.json', (artifact) => {
      const snapshot = artifact.snapshot as Record<string, unknown>;
      snapshot.games = [];
    });
    const { stdout, summary } = runConstructWeekExpectingFailure([path]);
    const goldenText = readGolden(invalidEmptyGamesGoldenPath);
    const golden = JSON.parse(goldenText) as Record<string, unknown>;

    expect(stdout).toBe(goldenText);
    expect(summary).toEqual(golden);
    expectValidationCode(golden, 'WEEKLY_RESEARCH_SNAPSHOT_EMPTY');
    expectNoPackage(golden);
  });

  it('matches the exact forbidden-field stdout golden byte-for-byte', () => {
    const path = writeTemporaryArtifact('golden-forbidden-field.json', (artifact) => {
      artifact.finalScore = 'deliberate-invalid-fixture-value';
    });
    const { stdout, summary } = runConstructWeekExpectingFailure([path]);
    const goldenText = readGolden(invalidForbiddenFieldGoldenPath);
    const golden = JSON.parse(goldenText) as Record<string, unknown>;

    expect(stdout).toBe(goldenText);
    expect(summary).toEqual(golden);
    expectValidationCode(golden, 'WEEKLY_RESEARCH_FORBIDDEN_FIELD');
    expectNoPackage(golden);
  });

  it.each([
    'finalScore',
    'completedGameState',
    'actualStartingPitchers',
    'outcome',
    'outcomeStatus',
    'finalStatus',
    'closingOdds',
    'impliedProbability',
    'odds',
    'market',
    'price',
  ])('recursively rejects forbidden input field %s', (field) => {
    const path = writeTemporaryArtifact(`forbidden-${field}.json`, (artifact) => {
      const snapshot = artifact.snapshot as { games: Array<Record<string, unknown>> };
      snapshot.games[0][field] = 'deliberate-invalid-fixture-value';
    });
    const { summary } = runConstructWeekExpectingFailure([path]);

    expectValidationCode(summary, 'WEEKLY_RESEARCH_FORBIDDEN_FIELD');
    expectNoPackage(summary);
  });

  it('recursively rejects absolute paths without echoing them to stdout', () => {
    const path = writeTemporaryArtifact('absolute-path.json', (artifact) => {
      const snapshot = artifact.snapshot as { games: Array<Record<string, unknown>> };
      snapshot.games[0].unsafeReference = join(projectRoot, 'private-input.json');
    });
    const { stdout, summary } = runConstructWeekExpectingFailure([path]);

    expectValidationCode(summary, 'WEEKLY_RESEARCH_ABSOLUTE_PATH');
    expect(stdout).not.toContain(projectRoot);
    expectNoPackage(summary);
  });

  it('recursively rejects absolute path keys without echoing them to stdout', () => {
    const absoluteKey = join(projectRoot, 'private-key');
    const path = writeTemporaryArtifact('absolute-path-key.json', (artifact) => {
      const snapshot = artifact.snapshot as Record<string, unknown>;
      snapshot[absoluteKey] = 'deliberate-invalid-fixture-value';
    });
    const { stdout, summary } = runConstructWeekExpectingFailure([path]);

    expectValidationCode(summary, 'WEEKLY_RESEARCH_ABSOLUTE_PATH');
    expect(stdout).not.toContain(projectRoot);
    expectNoPackage(summary);
  });

  it.each(['environment', 'env', 'process', 'cwd', 'hostname'])(
    'recursively rejects environment metadata field %s',
    (field) => {
      const path = writeTemporaryArtifact(`environment-${field}.json`, (artifact) => {
        const snapshot = artifact.snapshot as Record<string, unknown>;
        snapshot[field] = 'deliberate-invalid-fixture-value';
      });
      const { summary } = runConstructWeekExpectingFailure([path]);

      expectValidationCode(summary, 'WEEKLY_RESEARCH_ENVIRONMENT_METADATA');
      expectNoPackage(summary);
    },
  );

  it('contains no absolute path in valid stdout', () => {
    const stdout = runConstructWeek([fixturePath]);
    const summary = JSON.parse(stdout) as Record<string, unknown>;

    expect(stdout).not.toContain(projectRoot);
    const strings = JSON.stringify(summary).match(/"[^"]*"/g) ?? [];
    for (const value of strings) {
      expect(isAbsolute(value.slice(1, -1))).toBe(false);
    }
  });

  it('keeps every construction stdout golden path-free and invalid goldens package-free', () => {
    for (const goldenPath of goldenPaths) {
      const goldenText = readGolden(goldenPath);
      const golden = JSON.parse(goldenText) as Record<string, unknown>;

      expect(goldenText).not.toContain(projectRoot);
      expectNoAbsolutePathStrings(golden);
      if (golden.ok === false) {
        expectNoPackage(golden);
      }
    }
  });

  it('creates no output file or directory', () => {
    mkdirSync(tempRoot, { recursive: true });
    const inputPath = join(tempRoot, 'input.json');
    writeFileSync(inputPath, readFileSync(fixturePath, 'utf8'));
    const before = readdirSync(tempRoot);

    runConstructWeek([inputPath]);

    expect(readdirSync(tempRoot)).toEqual(before);
    expect(existsSync(join(tempRoot, 'output'))).toBe(false);
  });
});
