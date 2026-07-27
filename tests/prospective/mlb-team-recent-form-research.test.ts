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
  EXPECTED_CONSTRUCTION_VERSION,
  RESEARCH_PACKAGE_VERSION,
  TEAM_RECENT_FORM_MODULE_NAME,
  TEAM_RECENT_FORM_MODULE_VERSION,
  buildMLBTeamRecentFormResearchPackage,
  type MLBTeamRecentFormConstructionPackage,
  validateMLBTeamRecentFormConstructionPackage,
} from '@/prospective/mlb/team-recent-form-research';
import {
  buildMLBTeamRecentFormFixtureEvidence,
  TEAM_FORM_EVIDENCE_DEFAULT_LOOKBACK_GAMES,
  TEAM_FORM_EVIDENCE_DEFAULT_LOOKBACK_DAYS,
  TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES,
  TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION,
  TEAM_FORM_EVIDENCE_TARGET_GAME_EXCLUDED,
  TEAM_FORM_EVIDENCE_FUTURE_GAME_EXCLUDED,
  TEAM_FORM_EVIDENCE_PITCHER_FIELDS_EXCLUDED,
  TEAM_FORM_EVIDENCE_FORBIDDEN_FIELD_EXCLUDED,
  type TeamRecentFormEvidenceRecord,
  type TeamRecentFormEvidenceTarget,
  type TeamRecentFormFixtureEvidenceLookback,
} from '@/prospective/mlb/team-recent-form-fixture-evidence';
import {
  buildMLBTeamRecentFormAggregateSummary,
  buildSafeResultItemsFromManualRecords,
  TEAM_FORM_RESEARCH_RESULT_AGGREGATE_METRICS_NOT_ENABLED,
  TEAM_FORM_RESEARCH_RESULT_AGGREGATE_METRICS_REQUIRES_AGGREGATE_SUMMARIES,
} from '@/prospective/mlb/team-recent-form-aggregate-summary';
import {
  type TeamScheduleContext,
  buildTeamScheduleContext,
} from '@/prospective/mlb/team-schedule-context';
import {
  type TeamQualityContext,
  buildTeamQualityContext,
  TEAM_QUALITY_CONTEXT_MODULE_NAME,
  TEAM_QUALITY_CONTEXT_MODULE_VERSION,
  TEAM_QUALITY_CONTEXT_SCOPE,
  TEAM_QUALITY_CONTEXT_REQUIRES_FIXTURE_EVIDENCE,
} from '@/prospective/mlb/team-quality-context';

const projectRoot = join(__dirname, '..', '..');
const scriptPath = join(projectRoot, 'scripts', 'mlb-team-recent-form-research.ts');
const fixturePath = join(
  projectRoot,
  'tests',
  'prospective',
  'fixtures',
  'manual-schedule',
  'valid-weekly-prospective-research-construction-file-artifact-v1.json',
);
const goldenFixtureDirectory = join(
  projectRoot,
  'tests',
  'prospective',
  'fixtures',
  'manual-schedule',
);
const validStdoutGoldenPath = join(
  goldenFixtureDirectory,
  'valid-mlb-team-recent-form-research-cli-output-v1.json',
);
const constructionVersionStdoutGoldenPath = join(
  goldenFixtureDirectory,
  'invalid-mlb-team-recent-form-research-construction-version-output-v1.json',
);
const forbiddenFieldStdoutGoldenPath = join(
  goldenFixtureDirectory,
  'invalid-mlb-team-recent-form-research-forbidden-field-output-v1.json',
);
const emptyGamesStdoutGoldenPath = join(
  goldenFixtureDirectory,
  'invalid-mlb-team-recent-form-research-empty-games-output-v1.json',
);
const fixtureEvidenceLocalStdoutGoldenPath = join(
  goldenFixtureDirectory,
  'valid-mlb-team-recent-form-research-fixture-evidence-local-cli-output-v1.json',
);
const aggregateSummariesLocalStdoutGoldenPath = join(
  goldenFixtureDirectory,
  'valid-mlb-team-recent-form-research-aggregate-summaries-local-cli-output-v1.json',
);
const resultAggregateMetricsLocalStdoutGoldenPath = join(
  goldenFixtureDirectory,
  'valid-mlb-team-recent-form-research-result-aggregate-metrics-local-cli-output-v1.json',
);
const teamScheduleContextLocalStdoutGoldenPath = join(
  goldenFixtureDirectory,
  'valid-mlb-team-schedule-context-local-cli-output-v1.json',
);
const tempRoot = join(
  projectRoot,
  'tmp',
  'prospective-phase5a-team-recent-form-research',
);

function readValidConstructionPackage(): Record<string, unknown> {
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as Record<string, unknown>;
}

function writeTemporaryPackage(
  filename: string,
  mutate: (input: Record<string, unknown>) => void,
): string {
  const input = readValidConstructionPackage();
  mutate(input);
  mkdirSync(tempRoot, { recursive: true });
  const path = join(tempRoot, filename);
  writeFileSync(path, `${JSON.stringify(input, null, 2)}\n`, 'utf8');
  return path;
}

function runResearch(args: string[]): string {
  return execFileSync(
    process.execPath,
    ['--require', 'tsx/cjs', scriptPath, ...args],
    {
      cwd: projectRoot,
      encoding: 'utf8',
    },
  );
}

function runResearchExpectingFailure(args: string[]): {
  readonly stdout: string;
  readonly summary: Record<string, unknown>;
} {
  let error: unknown;
  try {
    runResearch(args);
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

function expectValidationCode(summary: Record<string, unknown>, code: string): void {
  const validationMessages = summary.validationMessages as Array<{ code: string }>;
  expect(validationMessages.map((message) => message.code)).toContain(code);
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

function expectNoAbsolutePaths(input: unknown): void {
  if (typeof input === 'string') {
    expect(isAbsolute(input)).toBe(false);
    expect(win32.isAbsolute(input)).toBe(false);
    return;
  }
  if (Array.isArray(input)) {
    for (const value of input) {
      expectNoAbsolutePaths(value);
    }
    return;
  }
  if (typeof input !== 'object' || input === null) {
    return;
  }
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    expectNoAbsolutePaths(key);
    expectNoAbsolutePaths(value);
  }
}

describe('Phase 5A MLB team recent form research module', () => {
  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
    expect(existsSync(tempRoot)).toBe(false);
  });

  it('builds a deterministic package and emits deterministic pretty JSON with a trailing newline', () => {
    const input = readValidConstructionPackage() as unknown as MLBTeamRecentFormConstructionPackage;

    expect(validateMLBTeamRecentFormConstructionPackage(input)).toEqual([]);
    expect(buildMLBTeamRecentFormResearchPackage(input)).toEqual(
      buildMLBTeamRecentFormResearchPackage(input),
    );

    const first = runResearch([fixturePath]);
    const second = runResearch([fixturePath]);
    const summary = JSON.parse(first) as Record<string, unknown>;

    expect(first).toBe(second);
    expect(first).toBe(`${JSON.stringify(summary, null, 2)}\n`);
    expect(first.endsWith('\n')).toBe(true);
    expect(summary.ok).toBe(true);
    expect(summary.researchPackageVersion).toBe(RESEARCH_PACKAGE_VERSION);
    expect(summary.researchRunId).toBe(
      'team-recent-form:manual-schedule-fixture-week-1',
    );
    expect(summary.sourceConstructionRunId).toBe('manual-schedule-fixture-week-1');
    expect(summary.sourceConstructionLockId).toBe(
      'manual-week-lock:manual-schedule-fixture-week-1',
    );
    expect(summary.sourceMode).toBe('manual-schedule');
    expect(summary.weekStart).toBe('2024-07-01');
    expect(summary.weekEnd).toBe('2024-07-07');
    expect(summary.researchedAt).toBe('2024-07-01T00:00:00Z');
    expect(summary.sourceConstructedAt).toBe('2024-07-01T00:00:00Z');
    expect(summary.sourceLockedAt).toBe('2024-07-01T00:00:00Z');
    expect(summary.gameCount).toBe(2);
    expect(summary.validationMessageCount).toBe(0);
    expect(summary.validationErrorCount).toBe(0);
    expect(summary.validationWarningCount).toBe(0);
    expect(summary.validationMessages).toEqual([]);
  });

  it('uses the exact planned top-level research package contract', () => {
    const summary = JSON.parse(runResearch([fixturePath])) as {
      package: Record<string, unknown>;
    };

    expect(Object.keys(summary.package)).toEqual([
      'researchPackageVersion',
      'constructionVersion',
      'researchRunId',
      'sourceConstructionRunId',
      'sourceConstructionLockId',
      'sourceMode',
      'weekStart',
      'weekEnd',
      'researchedAt',
      'sourceConstructedAt',
      'sourceLockedAt',
      'inputConstructionPackage',
      'games',
      'researchModules',
      'researchWarnings',
      'researchMessages',
    ]);
    expect(summary.package.constructionVersion).toBe(EXPECTED_CONSTRUCTION_VERSION);
  });

  it('embeds the exact parsed construction artifact without mutating it', () => {
    const input = readValidConstructionPackage();
    const before = JSON.stringify(input);
    const researchPackage = buildMLBTeamRecentFormResearchPackage(
      input as unknown as MLBTeamRecentFormConstructionPackage,
    );

    expect(researchPackage.inputConstructionPackage).toEqual(input);
    expect(researchPackage.inputConstructionPackage).toBe(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('preserves game order and schedule/construction fields exactly', () => {
    const input = readValidConstructionPackage() as {
      games: Array<Record<string, unknown>>;
    };
    const summary = JSON.parse(runResearch([fixturePath])) as {
      package: {
        games: Array<Record<string, unknown>>;
      };
    };
    const preservedFields = [
      'gameId',
      'officialDate',
      'scheduledStartTime',
      'awayTeam',
      'homeTeam',
      'snapshotTimestamp',
      'sourceProvenance',
      'constructionStatus',
      'researchMode',
      'researchScope',
      'constructionMessages',
      'warnings',
    ] as const;

    expect(summary.package.games).toHaveLength(input.games.length);
    expect(summary.package.games.map((game) => game.gameId)).toEqual(
      input.games.map((game) => game.gameId),
    );
    for (let index = 0; index < input.games.length; index++) {
      for (const field of preservedFields) {
        expect(summary.package.games[index][field]).toEqual(input.games[index][field]);
      }
    }
  });

  it('adds one completed TEAM_ONLY recent-form finding skeleton per game', () => {
    const summary = JSON.parse(runResearch([fixturePath])) as {
      package: {
        games: Array<{
          awayTeam: string;
          homeTeam: string;
          researchStatus: string;
          completedResearchModules: string[];
          researchFindings: {
            teamRecentForm: Record<string, unknown>;
          };
          researchMessages: unknown[];
          researchWarnings: unknown[];
        }>;
      };
    };

    for (const game of summary.package.games) {
      expect(game.researchStatus).toBe('researched');
      expect(game.completedResearchModules).toEqual([TEAM_RECENT_FORM_MODULE_NAME]);
      expect(game.researchMessages).toEqual([]);
      expect(game.researchWarnings).toEqual([]);
      expect(game.researchFindings.teamRecentForm).toEqual({
        moduleVersion: TEAM_RECENT_FORM_MODULE_VERSION,
        scope: 'TEAM_ONLY',
        awayTeam: game.awayTeam,
        homeTeam: game.homeTeam,
        lookbackWindowGames: 0,
        lookbackWindowDays: 0,
        awayRecentGamesFound: 0,
        homeRecentGamesFound: 0,
        awaySummary: {
          status: 'not-evaluated',
          reason: 'fixture-evidence-not-wired',
        },
        homeSummary: {
          status: 'not-evaluated',
          reason: 'fixture-evidence-not-wired',
        },
        dataQuality: 'not-evaluated',
        volatility: 'not-evaluated',
        confidence: 'not-evaluated',
        warnings: [],
        evidence: [],
      });
    }
  });

  it('reports one completed TEAM_RECENT_FORM module', () => {
    const summary = JSON.parse(runResearch([fixturePath])) as {
      package: {
        researchModules: unknown[];
        researchWarnings: unknown[];
        researchMessages: unknown[];
      };
    };

    expect(summary.package.researchModules).toEqual([{
      moduleName: TEAM_RECENT_FORM_MODULE_NAME,
      moduleVersion: TEAM_RECENT_FORM_MODULE_VERSION,
      scope: 'TEAM_ONLY',
      status: 'completed',
      messages: [],
      warnings: [],
    }]);
    expect(summary.package.researchWarnings).toEqual([]);
    expect(summary.package.researchMessages).toEqual([]);
  });

  it('keeps uncalibrated, outcome, starter, and external fields out of valid output', () => {
    const summary = JSON.parse(runResearch([fixturePath])) as Record<string, unknown>;
    const keys = collectKeys(summary);

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

  it('contains no absolute paths in valid stdout', () => {
    const stdout = runResearch([fixturePath]);
    const summary = JSON.parse(stdout) as Record<string, unknown>;

    expect(stdout).not.toContain(projectRoot);
    expectNoAbsolutePaths(summary);
  });

  it('exits 1 for malformed JSON with no package or stack trace', () => {
    mkdirSync(tempRoot, { recursive: true });
    const malformedPath = join(tempRoot, 'malformed.json');
    writeFileSync(malformedPath, 'not-json', 'utf8');

    const { stdout, summary } = runResearchExpectingFailure([malformedPath]);

    expect(summary.ok).toBe(false);
    expect(summary.error).toBe('TEAM_FORM_RESEARCH_READ_OR_PARSE_FAILED');
    expectNoPackage(summary);
    expect(stdout).not.toContain(' at ');
    expect(stdout).not.toContain(projectRoot);
  });

  it('exits 1 for missing, multiple, and unknown arguments', () => {
    const missing = runResearchExpectingFailure([]).summary;
    const multiple = runResearchExpectingFailure([fixturePath, fixturePath]).summary;
    const unknown = runResearchExpectingFailure([fixturePath, '--unknown']).summary;

    expect(missing.error).toBe('TEAM_FORM_RESEARCH_PATH_REQUIRED');
    expect(multiple.error).toBe('TEAM_FORM_RESEARCH_SINGLE_PATH_ONLY');
    expect(unknown.error).toBe('TEAM_FORM_RESEARCH_UNKNOWN_ARGUMENT');
    expect(missing.usage).toBe(
      'npm run prospective:mlb:research-team-form -- <construction-package-json> [--fixture-evidence-local] [--aggregate-summaries-local] [--result-aggregate-metrics-local] [--team-schedule-context-local] [--team-quality-context-local]',
    );
    expect(multiple.usage).toBe(missing.usage);
    expect(unknown.usage).toBe(missing.usage);
    expectNoPackage(missing);
    expectNoPackage(multiple);
    expectNoPackage(unknown);
  });

  it('rejects a non-object input', () => {
    mkdirSync(tempRoot, { recursive: true });
    const inputPath = join(tempRoot, 'array.json');
    writeFileSync(inputPath, '[]\n', 'utf8');

    const { summary } = runResearchExpectingFailure([inputPath]);

    expectValidationCode(summary, 'TEAM_FORM_RESEARCH_INPUT_NOT_OBJECT');
    expectNoPackage(summary);
  });

  it('rejects the wrong construction version', () => {
    const inputPath = writeTemporaryPackage('wrong-version.json', (input) => {
      input.constructionVersion = 'wrong-construction-version';
    });

    const { summary } = runResearchExpectingFailure([inputPath]);

    expectValidationCode(summary, 'TEAM_FORM_RESEARCH_CONSTRUCTION_VERSION_INVALID');
    expectNoPackage(summary);
  });

  it('rejects an invalid required construction-package field', () => {
    const inputPath = writeTemporaryPackage('invalid-package.json', (input) => {
      input.inputSnapshot = 'not-an-object';
    });

    const { summary } = runResearchExpectingFailure([inputPath]);

    expectValidationCode(summary, 'TEAM_FORM_RESEARCH_CONSTRUCTION_PACKAGE_INVALID');
    expectNoPackage(summary);
  });

  it('rejects an empty game list', () => {
    const inputPath = writeTemporaryPackage('empty-games.json', (input) => {
      input.games = [];
    });

    const { summary } = runResearchExpectingFailure([inputPath]);

    expectValidationCode(summary, 'TEAM_FORM_RESEARCH_EMPTY_GAMES');
    expectNoPackage(summary);
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
    'modelProbability',
  ])('recursively rejects forbidden field %s', (field) => {
    const inputPath = writeTemporaryPackage(`forbidden-${field}.json`, (input) => {
      const games = input.games as Array<Record<string, unknown>>;
      games[0].nested = {
        [field]: 'deliberate-invalid-fixture-value',
      };
    });

    const { summary } = runResearchExpectingFailure([inputPath]);

    expectValidationCode(summary, 'TEAM_FORM_RESEARCH_FORBIDDEN_FIELD');
    expectNoPackage(summary);
  });

  it('recursively rejects absolute path strings without echoing them', () => {
    const inputPath = writeTemporaryPackage('absolute-path.json', (input) => {
      const games = input.games as Array<Record<string, unknown>>;
      games[0].unsafeReference = join(projectRoot, 'private-input.json');
    });

    const { stdout, summary } = runResearchExpectingFailure([inputPath]);

    expectValidationCode(summary, 'TEAM_FORM_RESEARCH_ABSOLUTE_PATH');
    expect(stdout).not.toContain(projectRoot);
    expectNoPackage(summary);
  });

  it('recursively rejects absolute path keys without echoing them', () => {
    const absoluteKey = join(projectRoot, 'private-key');
    const inputPath = writeTemporaryPackage('absolute-path-key.json', (input) => {
      input.inputSnapshot = {
        [absoluteKey]: 'deliberate-invalid-fixture-value',
      };
    });

    const { stdout, summary } = runResearchExpectingFailure([inputPath]);

    expectValidationCode(summary, 'TEAM_FORM_RESEARCH_ABSOLUTE_PATH');
    expect(stdout).not.toContain(projectRoot);
    expectNoPackage(summary);
  });

  it.each(['environment', 'env', 'process', 'cwd', 'hostname'])(
    'recursively rejects environment metadata field %s',
    (field) => {
      const inputPath = writeTemporaryPackage(`environment-${field}.json`, (input) => {
        input.inputSnapshot = {
          [field]: 'deliberate-invalid-fixture-value',
        };
      });

      const { summary } = runResearchExpectingFailure([inputPath]);

      expectValidationCode(summary, 'TEAM_FORM_RESEARCH_ENVIRONMENT_METADATA');
      expectNoPackage(summary);
    },
  );

  it('rejects a non-pregame research mode', () => {
    const inputPath = writeTemporaryPackage('unsupported-mode.json', (input) => {
      const games = input.games as Array<Record<string, unknown>>;
      games[0].researchMode = 'postgame';
    });

    const { summary } = runResearchExpectingFailure([inputPath]);

    expectValidationCode(summary, 'TEAM_FORM_RESEARCH_MODE_UNSUPPORTED');
    expectNoPackage(summary);
  });

  it('rejects an unsupported research scope', () => {
    const inputPath = writeTemporaryPackage('unsupported-scope.json', (input) => {
      const games = input.games as Array<Record<string, unknown>>;
      games[0].researchScope = 'PITCHER_ONLY';
    });

    const { summary } = runResearchExpectingFailure([inputPath]);

    expectValidationCode(summary, 'TEAM_FORM_RESEARCH_SCOPE_UNSUPPORTED');
    expectNoPackage(summary);
  });

  it('exposes the package script', () => {
    const packageJson = JSON.parse(readFileSync(
      join(projectRoot, 'package.json'),
      'utf8',
    )) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts['prospective:mlb:research-team-form']).toBe(
      'tsx scripts/mlb-team-recent-form-research.ts',
    );
  });

  it('creates no generated files', () => {
    mkdirSync(tempRoot, { recursive: true });
    const localInputPath = join(tempRoot, 'input.json');
    writeFileSync(localInputPath, readFileSync(fixturePath, 'utf8'), 'utf8');
    const before = readdirSync(tempRoot);

    runResearch([localInputPath]);

    expect(readdirSync(tempRoot)).toEqual(before);
  });
});

describe('Phase 5B MLB team recent form research stdout goldens', () => {
  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
    expect(existsSync(tempRoot)).toBe(false);
  });

  it('matches the exact valid stdout golden byte-for-byte across repeated runs', () => {
    const expected = readFileSync(validStdoutGoldenPath, 'utf8');
    const first = runResearch([fixturePath]);
    const second = runResearch([fixturePath]);

    expect(first).toBe(expected);
    expect(second).toBe(expected);
    expect(first).toBe(second);
    expect(expected.endsWith('\n')).toBe(true);
  });

  it('locks the exact embedded construction package and two TEAM_RECENT_FORM findings', () => {
    const constructionPackage = readValidConstructionPackage();
    const summary = JSON.parse(readFileSync(validStdoutGoldenPath, 'utf8')) as {
      package: {
        inputConstructionPackage: Record<string, unknown>;
        games: Array<{
          completedResearchModules: string[];
          researchFindings: {
            teamRecentForm: {
              moduleVersion: string;
              scope: string;
              awaySummary: { status: string };
              homeSummary: { status: string };
            };
          };
        }>;
      };
    };

    expect(summary.package.inputConstructionPackage).toEqual(constructionPackage);
    expect(summary.package.games).toHaveLength(2);
    for (const game of summary.package.games) {
      expect(game.completedResearchModules).toEqual([TEAM_RECENT_FORM_MODULE_NAME]);
      expect(game.researchFindings.teamRecentForm).toMatchObject({
        moduleVersion: TEAM_RECENT_FORM_MODULE_VERSION,
        scope: 'TEAM_ONLY',
        awaySummary: { status: 'not-evaluated' },
        homeSummary: { status: 'not-evaluated' },
      });
    }
  });

  it('keeps target outcome, starter, external price, and uncalibrated fields and absolute paths out of the valid golden', () => {
    const stdout = readFileSync(validStdoutGoldenPath, 'utf8');
    const summary = JSON.parse(stdout) as Record<string, unknown>;
    const keys = collectKeys(summary);

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
    expect(stdout).not.toContain(projectRoot);
    expectNoAbsolutePaths(summary);
  });

  it('matches the exact wrong-constructionVersion stdout golden byte-for-byte', () => {
    const inputPath = writeTemporaryPackage('golden-wrong-version.json', (input) => {
      input.constructionVersion = 'wrong-construction-version';
    });
    const { stdout, summary } = runResearchExpectingFailure([inputPath]);

    expect(stdout).toBe(readFileSync(constructionVersionStdoutGoldenPath, 'utf8'));
    expect(summary.error).toBe('TEAM_FORM_RESEARCH_CONSTRUCTION_VERSION_INVALID');
    expectNoPackage(summary);
  });

  it('matches the exact forbidden-field stdout golden byte-for-byte', () => {
    const inputPath = writeTemporaryPackage('golden-forbidden-field.json', (input) => {
      const games = input.games as Array<Record<string, unknown>>;
      games[0].nested = {
        modelProbability: 'deliberate-invalid-fixture-value',
      };
    });
    const { stdout, summary } = runResearchExpectingFailure([inputPath]);

    expect(stdout).toBe(readFileSync(forbiddenFieldStdoutGoldenPath, 'utf8'));
    expect(summary.error).toBe('TEAM_FORM_RESEARCH_FORBIDDEN_FIELD');
    expectNoPackage(summary);
  });

  it('matches the exact empty-games stdout golden byte-for-byte', () => {
    const inputPath = writeTemporaryPackage('golden-empty-games.json', (input) => {
      input.games = [];
    });
    const { stdout, summary } = runResearchExpectingFailure([inputPath]);

    expect(stdout).toBe(readFileSync(emptyGamesStdoutGoldenPath, 'utf8'));
    expect(summary.error).toBe('TEAM_FORM_RESEARCH_EMPTY_GAMES');
    expectNoPackage(summary);
  });

  it('keeps every invalid golden package-free, path-free, stack-free, pretty, and newline-terminated', () => {
    for (const goldenPath of [
      constructionVersionStdoutGoldenPath,
      forbiddenFieldStdoutGoldenPath,
      emptyGamesStdoutGoldenPath,
    ]) {
      const stdout = readFileSync(goldenPath, 'utf8');
      const summary = JSON.parse(stdout) as Record<string, unknown>;

      expect(summary.ok).toBe(false);
      expectNoPackage(summary);
      expect(stdout).toBe(`${JSON.stringify(summary, null, 2)}\n`);
      expect(stdout).not.toContain(projectRoot);
      expect(stdout).not.toContain(' at ');
      expectNoAbsolutePaths(summary);
    }
  });

  it('leaves only deterministic temporary input files before afterEach cleanup', () => {
    const cases = [
      writeTemporaryPackage('golden-cleanup-version.json', (input) => {
        input.constructionVersion = 'wrong-construction-version';
      }),
      writeTemporaryPackage('golden-cleanup-forbidden.json', (input) => {
        const games = input.games as Array<Record<string, unknown>>;
        games[0].nested = {
          modelProbability: 'deliberate-invalid-fixture-value',
        };
      }),
      writeTemporaryPackage('golden-cleanup-empty.json', (input) => {
        input.games = [];
      }),
    ];
    const before = readdirSync(tempRoot).sort();

    runResearch([fixturePath]);
    for (const inputPath of cases) {
      runResearchExpectingFailure([inputPath]);
    }

    expect(readdirSync(tempRoot).sort()).toEqual(before);
  });
});

describe('Phase 5D MLB team recent form fixture evidence provider', () => {
  const target: TeamRecentFormEvidenceTarget = {
    gameId: 'target-game-1',
    scheduledStartTime: '2024-07-05T19:15:00Z',
    awayTeam: 'AWAY_1',
    homeTeam: 'HOME_1',
  };

  const syntheticSafeRecord: TeamRecentFormEvidenceRecord = {
    gameId: 'synthetic-1',
    officialDate: '2024-07-04',
    scheduledStartTime: '2024-07-04T19:00:00Z',
    awayTeam: 'AWAY_1',
    homeTeam: 'HOME_1',
    liveData: {
      plays: {
        allPlays: [
          {
            about: {
              endTime: '2024-07-04T21:30:00Z',
            },
          },
        ],
      },
    },
    provenance: {
      lastCompletedPlayEnd: 'LAST_COMPLETED_PLAY_END',
    },
  };

  function buildEvidence(
    input: readonly TeamRecentFormEvidenceRecord[],
    lookback?: TeamRecentFormFixtureEvidenceLookback,
  ): ReturnType<typeof buildMLBTeamRecentFormFixtureEvidence> {
    return buildMLBTeamRecentFormFixtureEvidence(target, input, lookback);
  }

  it('returns deterministic insufficient evidence when fixtures lack safe completion', () => {
    const fixtures: TeamRecentFormEvidenceRecord[] = [
      {
        gameId: 'historical-1',
        officialDate: '2024-07-01',
        scheduledStartTime: '2024-07-01T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
    ];

    const result = buildEvidence(fixtures);

    expect(result.lookbackWindowGames).toBe(TEAM_FORM_EVIDENCE_DEFAULT_LOOKBACK_GAMES);
    expect(result.lookbackWindowDays).toBe(TEAM_FORM_EVIDENCE_DEFAULT_LOOKBACK_DAYS);
    expect(result.awayRecentGamesFound).toBe(0);
    expect(result.homeRecentGamesFound).toBe(0);
    expect(result.dataQuality).toBe('insufficient');
    expect(result.confidence).toBe('low');
    expect(result.volatility).toBe('not-evaluated');
    expect(result.warnings).toEqual(expect.arrayContaining([
      TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION,
      TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES,
    ]));
    expect(result.evidence).toEqual([]);
  });

  it('excludes the target game even when it appears in fixtures', () => {
    const fixtures: TeamRecentFormEvidenceRecord[] = [
      { ...syntheticSafeRecord, gameId: 'target-game-1' },
      syntheticSafeRecord,
    ];
    const result = buildEvidence(fixtures);

    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0].sourceGameId).toBe('synthetic-1');
    expect(result.warnings).toContain(TEAM_FORM_EVIDENCE_TARGET_GAME_EXCLUDED);
  });

  it('excludes future games relative to target scheduled start time', () => {
    const futureRecord: TeamRecentFormEvidenceRecord = {
      ...syntheticSafeRecord,
      gameId: 'future-safe',
      officialDate: '2024-07-06',
      scheduledStartTime: '2024-07-06T19:00:00Z',
      liveData: {
        plays: {
          allPlays: [
            {
              about: {
                endTime: '2024-07-06T20:00:00Z',
              },
            },
          ],
        },
      },
    };
    const result = buildEvidence([futureRecord, syntheticSafeRecord]);

    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0].sourceGameId).toBe('synthetic-1');
    expect(result.warnings).toContain(TEAM_FORM_EVIDENCE_FUTURE_GAME_EXCLUDED);
  });

  it('truncates to lookbackWindowGames and sorts newest-first', () => {
    const fixtures: TeamRecentFormEvidenceRecord[] = [
      { ...syntheticSafeRecord, gameId: 'older', officialDate: '2024-07-01', scheduledStartTime: '2024-07-01T19:00:00Z', liveData: { plays: { allPlays: [{ about: { endTime: '2024-07-01T18:00:00Z' } }] } } },
      syntheticSafeRecord,
      { ...syntheticSafeRecord, gameId: 'newer', officialDate: '2024-07-04', scheduledStartTime: '2024-07-04T19:00:00Z', liveData: { plays: { allPlays: [{ about: { endTime: '2024-07-04T22:00:00Z' } }] } } },
    ];
    const result = buildEvidence(fixtures, { lookbackWindowGames: 2 });

    expect(result.evidence).toHaveLength(2);
    expect(result.evidence.map((item) => item.sourceGameId)).toEqual(['newer', 'synthetic-1']);
  });

  it('respects the 30-day lookback window', () => {
    const oldRecord: TeamRecentFormEvidenceRecord = {
      ...syntheticSafeRecord,
      gameId: 'old-safe',
      officialDate: '2024-05-20',
      scheduledStartTime: '2024-05-20T19:00:00Z',
      liveData: {
        plays: {
          allPlays: [
            {
              about: {
                endTime: '2024-05-20T18:00:00Z',
              },
            },
          ],
        },
      },
    };
    const result = buildEvidence([oldRecord, syntheticSafeRecord], { lookbackWindowDays: 30 });

    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0].sourceGameId).toBe('synthetic-1');
  });

  it('does not include forbidden fields in evidence output', () => {
    const result = buildEvidence([syntheticSafeRecord], { lookbackWindowGames: 3 });

    expect(result).not.toHaveProperty('modelProbability');
    expect(result.evidence[0]).not.toHaveProperty('finalScore');
    expect(result.evidence[0]).not.toHaveProperty('completedGameState');
    expect(result.evidence[0]).not.toHaveProperty('actualStartingPitchers');
    expect(result.evidence[0]).not.toHaveProperty('outcome');
    expect(result.evidence[0]).not.toHaveProperty('closingOdds');
  });

  it('exposes safe-evidence-only fields on evidence items', () => {
    const result = buildEvidence([syntheticSafeRecord]);

    expect(result.evidence[0]).toMatchObject({
      sourceGameId: 'synthetic-1',
      officialDate: '2024-07-04',
      completedAt: '2024-07-04T21:30:00Z',
      team: 'AWAY_1',
      teamRole: 'AWAY',
      opponent: 'HOME_1',
      sourceProvenance: 'LAST_COMPLETED_PLAY_END',
    });
  });

  it('defaults to insufficient confidence when evidence is weak', () => {
    const result = buildEvidence([]);

    expect(result.dataQuality).toBe('insufficient');
    expect(result.confidence).toBe('low');
    expect(result.warnings).toEqual(
      expect.arrayContaining([TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES, TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION]),
    );
  });

  it('accepts --fixture-evidence-local and keeps deterministic output', () => {
    const first = runResearch([fixturePath, '--fixture-evidence-local']);
    const second = runResearch([fixturePath, '--fixture-evidence-local']);

    expect(first).toBe(second);
    expect(first).toContain('"fixtureEvidenceLocal": true');
  });

  it('keeps package identity and construction embedding under --fixture-evidence-local', () => {
    const summary = JSON.parse(
      runResearch([fixturePath, '--fixture-evidence-local']),
    ) as Record<string, unknown>;

    expect(summary.researchRunId).toBe('team-recent-form:manual-schedule-fixture-week-1');
    expect(summary.sourceConstructionRunId).toBe('manual-schedule-fixture-week-1');
    expect(summary.sourceMode).toBe('manual-schedule');
    expect(summary.weekStart).toBe('2024-07-01');
    expect(summary.weekEnd).toBe('2024-07-07');
    expect(summary.gameCount).toBe(2);
    expect(summary.validationErrorCount).toBe(0);
  });

  it('never outputs forbidden evidence or binary outcome fields under --fixture-evidence-local', () => {
    const stdout = runResearch([fixturePath, '--fixture-evidence-local']);
    const keys = collectKeys(JSON.parse(stdout));

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

  it('never outputs absolute paths under --fixture-evidence-local', () => {
    const stdout = runResearch([fixturePath, '--fixture-evidence-local']);
    const summary = JSON.parse(stdout) as Record<string, unknown>;

    expect(stdout).not.toContain(projectRoot);
    expectNoAbsolutePaths(summary);
  });

  it('still rejects unknown arguments alongside --fixture-evidence-local', () => {
    const { summary } = runResearchExpectingFailure([fixturePath, '--fixture-evidence-local', '--unknown']);

    expect(summary.error).toBe('TEAM_FORM_RESEARCH_UNKNOWN_ARGUMENT');
    expectNoPackage(summary);
  });

  it('still rejects multiple input paths alongside --fixture-evidence-local', () => {
    const { summary } = runResearchExpectingFailure([fixturePath, fixturePath, '--fixture-evidence-local']);

    expect(summary.error).toBe('TEAM_FORM_RESEARCH_SINGLE_PATH_ONLY');
    expectNoPackage(summary);
  });

  it('matches the exact evidence-enabled stdout golden byte-for-byte across repeated runs', () => {
    const expected = readFileSync(fixtureEvidenceLocalStdoutGoldenPath, 'utf8');
    const first = runResearch([fixturePath, '--fixture-evidence-local']);
    const second = runResearch([fixturePath, '--fixture-evidence-local']);

    expect(first).toBe(expected);
    expect(second).toBe(expected);
    expect(first).toBe(second);
    expect(expected.endsWith('\n')).toBe(true);
  });

  it('preserves package identity and exact construction embedding in evidence mode', () => {
    const constructionPackage = readValidConstructionPackage();
    const summary = JSON.parse(readFileSync(fixtureEvidenceLocalStdoutGoldenPath, 'utf8')) as {
      ok: boolean;
      fixtureEvidenceLocal: boolean;
      researchRunId: string;
      sourceConstructionRunId: string;
      sourceMode: string;
      weekStart: string;
      weekEnd: string;
      gameCount: number;
      validationErrorCount: number;
      validationWarningCount: number;
      package: {
        inputConstructionPackage: Record<string, unknown>;
        games: Array<{
          gameId: string;
          researchFindings: {
            teamRecentForm: {
              moduleVersion: string;
              scope: string;
              awaySummary: { status: string };
              homeSummary: { status: string };
              warnings: string[];
              evidence: unknown[];
              modelProbability?: unknown;
            };
          };
        }>;
      };
    };

    expect(summary.ok).toBe(true);
    expect(summary.fixtureEvidenceLocal).toBe(true);
    expect(summary.researchRunId).toBe('team-recent-form:manual-schedule-fixture-week-1');
    expect(summary.sourceConstructionRunId).toBe('manual-schedule-fixture-week-1');
    expect(summary.sourceMode).toBe('manual-schedule');
    expect(summary.weekStart).toBe('2024-07-01');
    expect(summary.weekEnd).toBe('2024-07-07');
    expect(summary.gameCount).toBe(2);
    expect(summary.validationErrorCount).toBe(0);
    expect(summary.validationWarningCount).toBe(0);
    expect(summary.package.inputConstructionPackage).toEqual(constructionPackage);
    expect(summary.package.games).toHaveLength(2);
    for (const game of summary.package.games) {
      expect(game.researchFindings.teamRecentForm.moduleVersion).toBe('mlb-team-recent-form-v1');
      expect(game.researchFindings.teamRecentForm.scope).toBe('TEAM_ONLY');
      expect(game.researchFindings.teamRecentForm.awaySummary.status).toBe('insufficient');
      expect(game.researchFindings.teamRecentForm.homeSummary.status).toBe('insufficient');
      expect(game.researchFindings.teamRecentForm.warnings).toEqual(
        expect.arrayContaining([
          'TEAM_FORM_EVIDENCE_FUTURE_GAME_EXCLUDED',
          'TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES',
          'TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION',
        ]),
      );
      expect(game.researchFindings.teamRecentForm.evidence).toEqual([]);
      expect(game.researchFindings.teamRecentForm).not.toHaveProperty('modelProbability');
    }
  });

  it('keeps forbidden and absolute-path fields out of the evidence-enabled golden', () => {
    const stdout = readFileSync(fixtureEvidenceLocalStdoutGoldenPath, 'utf8');
    const summary = JSON.parse(stdout) as Record<string, unknown>;

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
      expect(collectKeys(summary)).not.toContain(field);
    }
    expect(stdout).not.toContain(projectRoot);
    expectNoAbsolutePaths(summary);
  });
});

describe('Phase 5G MLB team recent form aggregate summary', () => {
  it('rejects --aggregate-summaries-local without --fixture-evidence-local', () => {
    const { summary } = runResearchExpectingFailure([
      fixturePath,
      '--aggregate-summaries-local',
    ]);

    expect(summary).toEqual(
      expect.objectContaining({
        ok: false,
        error: 'TEAM_FORM_RESEARCH_AGGREGATE_SUMMARIES_NOT_ENABLED',
      }),
    );
    expectNoPackage(summary);
  });

  it('preserves default no-flag stdout exactly', () => {
    const expected = readFileSync(validStdoutGoldenPath, 'utf8');
    expect(runResearch([fixturePath])).toBe(expected);
  });

  it('preserves evidence-enabled stdout exactly', () => {
    const expected = readFileSync(fixtureEvidenceLocalStdoutGoldenPath, 'utf8');
    expect(runResearch([fixturePath, '--fixture-evidence-local'])).toBe(expected);
  });

  it('produces deterministic aggregate-mode stdout across repeated runs', () => {
    const first = runResearch([fixturePath, '--fixture-evidence-local', '--aggregate-summaries-local']);
    const second = runResearch([fixturePath, '--fixture-evidence-local', '--aggregate-summaries-local']);

    expect(first).toBe(second);
  });

  it('preserves exact construction embedding under aggregate mode', () => {
    const constructionPackage = readValidConstructionPackage();
    const stdout = runResearch([fixturePath, '--fixture-evidence-local', '--aggregate-summaries-local']);
    const summary = JSON.parse(stdout) as {
      ok: boolean;
      sourceConstructionRunId: string;
      sourceMode: string;
      weekStart: string;
      weekEnd: string;
      gameCount: number;
      package: {
        inputConstructionPackage: Record<string, unknown>;
        games: Array<{ gameId: string }>;
      };
    };

    expect(summary.ok).toBe(true);
    expect(summary.sourceConstructionRunId).toBe('manual-schedule-fixture-week-1');
    expect(summary.sourceMode).toBe('manual-schedule');
    expect(summary.weekStart).toBe('2024-07-01');
    expect(summary.weekEnd).toBe('2024-07-07');
    expect(summary.gameCount).toBe(2);
    expect(summary.package.inputConstructionPackage).toEqual(constructionPackage);
    expect(summary.package.games).toHaveLength(2);
    for (const game of summary.package.games) {
      expect(game.gameId).toBeDefined();
      expect(game.gameId).not.toContain(projectRoot);
    }
  });

  it('includes aggregate-only coverage/completeness fields in aggregate mode', () => {
    const stdout = runResearch([fixturePath, '--fixture-evidence-local', '--aggregate-summaries-local']);
    const summary = JSON.parse(stdout) as {
      ok: boolean;
      package: {
        games: Array<{
          researchFindings: {
            teamRecentForm: {
              awayAggregateSummary: Record<string, unknown>;
              homeAggregateSummary: Record<string, unknown>;
            };
          };
        }>;
      };
    };

    expect(summary.ok).toBe(true);
    for (const game of summary.package.games) {
      const finding = game.researchFindings.teamRecentForm;
      expect(finding.awayAggregateSummary).toMatchObject({
        status: 'insufficient',
        reason: 'insufficient-evidence',
        gamesConsidered: 0,
        completedGamesConsidered: 0,
        recencyWindowDays: 30,
        recencyWindowGames: 3,
        homeAwaySplitCounts: { home: 0, away: 0 },
        opponentDiversityCount: 0,
        dataCompletenessLabel: 'insufficient',
        recencyCoverageLabel: 'insufficient',
        sourceCompletenessWarnings: expect.arrayContaining([
          'TEAM_FORM_EVIDENCE_FUTURE_GAME_EXCLUDED',
          'TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES',
          'TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION',
        ]),
      });
      expect(finding.homeAggregateSummary).toMatchObject({
        status: 'insufficient',
        reason: 'insufficient-evidence',
        gamesConsidered: 0,
        completedGamesConsidered: 0,
        recencyWindowDays: 30,
        recencyWindowGames: 3,
        homeAwaySplitCounts: { home: 0, away: 0 },
        opponentDiversityCount: 0,
        dataCompletenessLabel: 'insufficient',
        recencyCoverageLabel: 'insufficient',
        sourceCompletenessWarnings: expect.arrayContaining([
          'TEAM_FORM_EVIDENCE_FUTURE_GAME_EXCLUDED',
          'TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES',
          'TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION',
        ]),
      });
    }
  });

  it('keeps aggregate mode free of result-derived and forbidden fields', () => {
    const stdout = runResearch([fixturePath, '--fixture-evidence-local', '--aggregate-summaries-local']);
    for (const field of [
      'winsCount',
      'lossesCount',
      'averageRunsFor',
      'averageRunsAgainst',
      'averageRunDifferential',
      'modelProbability',
      'predictedWinner',
      'pick',
      'finalScore',
      'outcome',
      'completedGameState',
      'finalStatus',
      'actualStartingPitchers',
      'closingOdds',
      'impliedProbability',
      'odds',
      'market',
      'price',
    ]) {
      expect(stdout).not.toContain(`"${field}"`);
    }
  });

  it('keeps aggregate mode free of absolute paths', () => {
    const stdout = runResearch([fixturePath, '--fixture-evidence-local', '--aggregate-summaries-local']);
    expect(stdout).not.toContain(projectRoot);
    expectNoAbsolutePaths(JSON.parse(stdout));
  });
});

describe('Phase 5H MLB team recent form aggregate stdout golden', () => {
  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
    expect(existsSync(tempRoot)).toBe(false);
  });

  it('matches the exact aggregate stdout golden byte-for-byte across repeated runs', () => {
    const expected = readFileSync(aggregateSummariesLocalStdoutGoldenPath, 'utf8');
    const first = runResearch([fixturePath, '--fixture-evidence-local', '--aggregate-summaries-local']);
    const second = runResearch([fixturePath, '--fixture-evidence-local', '--aggregate-summaries-local']);

    expect(first).toBe(expected);
    expect(second).toBe(expected);
    expect(first).toBe(second);
    expect(expected.endsWith('\n')).toBe(true);
  });

  it('locks the expected aggregate metadata and exact construction embedding', () => {
    const constructionPackage = readValidConstructionPackage();
    const summary = JSON.parse(readFileSync(aggregateSummariesLocalStdoutGoldenPath, 'utf8')) as {
      ok: boolean;
      fixtureEvidenceLocal: boolean;
      aggregateSummariesLocal: boolean;
      researchPackageVersion: string;
      researchRunId: string;
      sourceConstructionRunId: string;
      sourceMode: string;
      weekStart: string;
      weekEnd: string;
      gameCount: number;
      validationErrorCount: number;
      validationWarningCount: number;
      package: {
        inputConstructionPackage: Record<string, unknown>;
        games: Array<{ gameId: string }>;
      };
    };

    expect(summary.ok).toBe(true);
    expect(summary.fixtureEvidenceLocal).toBe(true);
    expect(summary.aggregateSummariesLocal).toBe(true);
    expect(summary.researchPackageVersion).toBe('mlb-team-recent-form-research-package-v1');
    expect(summary.researchRunId).toBe('team-recent-form:manual-schedule-fixture-week-1');
    expect(summary.sourceConstructionRunId).toBe('manual-schedule-fixture-week-1');
    expect(summary.sourceMode).toBe('manual-schedule');
    expect(summary.weekStart).toBe('2024-07-01');
    expect(summary.weekEnd).toBe('2024-07-07');
    expect(summary.gameCount).toBe(2);
    expect(summary.validationErrorCount).toBe(0);
    expect(summary.validationWarningCount).toBe(0);
    expect(summary.package.inputConstructionPackage).toEqual(constructionPackage);
  });

  it('preserves two TEAM_RECENT_FORM findings with insufficient aggregate summaries in the golden', () => {
    const summary = JSON.parse(readFileSync(aggregateSummariesLocalStdoutGoldenPath, 'utf8')) as {
      package: {
        games: Array<{
          gameId: string;
          researchFindings: {
            teamRecentForm: {
              moduleVersion: string;
              scope: string;
              awaySummary: { status: string };
              homeSummary: { status: string };
              awayAggregateSummary: Record<string, unknown>;
              homeAggregateSummary: Record<string, unknown>;
            };
          };
        }>;
      };
    };

    expect(summary.package.games).toHaveLength(2);
    for (const game of summary.package.games) {
      expect(game.gameId).toBeDefined();
      expect(game.gameId).toMatch(/^manual-game-/);
      const finding = game.researchFindings.teamRecentForm;
      expect(finding.moduleVersion).toBe('mlb-team-recent-form-v1');
      expect(finding.scope).toBe('TEAM_ONLY');
      expect(finding.awaySummary.status).toBe('insufficient');
      expect(finding.homeSummary.status).toBe('insufficient');

      expect(finding.awayAggregateSummary).toMatchObject({
        status: 'insufficient',
        reason: 'insufficient-evidence',
        gamesConsidered: 0,
        completedGamesConsidered: 0,
        recencyWindowDays: 30,
        recencyWindowGames: 3,
        homeAwaySplitCounts: { home: 0, away: 0 },
        opponentDiversityCount: 0,
        dataCompletenessLabel: 'insufficient',
        recencyCoverageLabel: 'insufficient',
      });
      expect(finding.awayAggregateSummary.sourceCompletenessWarnings).toEqual(
        expect.arrayContaining([
          'TEAM_FORM_EVIDENCE_FUTURE_GAME_EXCLUDED',
          'TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES',
          'TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION',
        ]),
      );

      expect(finding.homeAggregateSummary).toMatchObject({
        status: 'insufficient',
        reason: 'insufficient-evidence',
        gamesConsidered: 0,
        completedGamesConsidered: 0,
        recencyWindowDays: 30,
        recencyWindowGames: 3,
        homeAwaySplitCounts: { home: 0, away: 0 },
        opponentDiversityCount: 0,
        dataCompletenessLabel: 'insufficient',
        recencyCoverageLabel: 'insufficient',
      });
      expect(finding.homeAggregateSummary.sourceCompletenessWarnings).toEqual(
        expect.arrayContaining([
          'TEAM_FORM_EVIDENCE_FUTURE_GAME_EXCLUDED',
          'TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES',
          'TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION',
        ]),
      );
    }
  });

  it('keeps forbidden result-derived fields and absolute paths out of the aggregate golden', () => {
    const stdout = readFileSync(aggregateSummariesLocalStdoutGoldenPath, 'utf8');
    const summary = JSON.parse(stdout) as Record<string, unknown>;

    for (const field of [
      'modelProbability',
      'predictedWinner',
      'pick',
      'finalScore',
      'outcome',
      'completedGameState',
      'finalStatus',
      'actualStartingPitchers',
      'winsCount',
      'lossesCount',
      'averageRunsFor',
      'averageRunsAgainst',
      'averageRunDifferential',
      'closingOdds',
      'impliedProbability',
      'odds',
      'market',
      'price',
    ]) {
      expect(collectKeys(summary)).not.toContain(field);
    }
    expect(stdout).not.toContain(projectRoot);
    expectNoAbsolutePaths(summary);
  });
});

describe('Phase 5G MLB aggregate summary provider unit tests', () => {
  const target: TeamRecentFormEvidenceTarget = {
    gameId: 'target-game-1',
    scheduledStartTime: '2024-07-05T19:15:00Z',
    awayTeam: 'AWAY_1',
    homeTeam: 'HOME_1',
  };

  const syntheticSafeRecord: TeamRecentFormEvidenceRecord = {
    gameId: 'synthetic-1',
    officialDate: '2024-07-04',
    scheduledStartTime: '2024-07-04T19:00:00Z',
    awayTeam: 'AWAY_1',
    homeTeam: 'HOME_1',
    liveData: {
      plays: {
        allPlays: [
          {
            about: {
              endTime: '2024-07-04T21:30:00Z',
            },
          },
        ],
      },
    },
    provenance: {
      lastCompletedPlayEnd: 'LAST_COMPLETED_PLAY_END',
    },
  };

  function buildEvidence(
    input: readonly TeamRecentFormEvidenceRecord[],
    lookback?: TeamRecentFormFixtureEvidenceLookback,
  ): ReturnType<typeof buildMLBTeamRecentFormFixtureEvidence> {
    return buildMLBTeamRecentFormFixtureEvidence(target, input, lookback);
  }

  it('computes gamesConsidered and completedGamesConsidered from safe evidence', () => {
    const mixed: TeamRecentFormEvidenceRecord[] = [
      syntheticSafeRecord,
      {
        ...syntheticSafeRecord,
        gameId: 'synthetic-2',
        officialDate: '2024-07-03',
        scheduledStartTime: '2024-07-03T18:30:00Z',
        liveData: { plays: { allPlays: [{ about: { endTime: '2024-07-03T21:00:00Z' } }] } },
        awayTeam: 'OTHER_1',
        homeTeam: 'HOME_1',
      },
    ];

    const result = buildEvidence(mixed, { lookbackWindowGames: 3, lookbackWindowDays: 30 });
    const aggregate = buildMLBTeamRecentFormAggregateSummary(result);

    expect(result.awayRecentGamesFound).toBe(1);
    expect(result.homeRecentGamesFound).toBe(1);
    expect(aggregate.awayAggregateSummary.gamesConsidered).toBe(1);
    expect(aggregate.awayAggregateSummary.completedGamesConsidered).toBe(1);
    expect(aggregate.homeAggregateSummary.gamesConsidered).toBe(1);
    expect(aggregate.homeAggregateSummary.completedGamesConsidered).toBe(1);
    expect(aggregate.awayAggregateSummary.opponentDiversityCount).toBe(1);
    expect(aggregate.homeAggregateSummary.opponentDiversityCount).toBe(1);
  });

  it('counts homeAwaySplitCounts by evidence item teamRole', () => {
    const mixed: TeamRecentFormEvidenceRecord[] = [
      syntheticSafeRecord,
      {
        ...syntheticSafeRecord,
        gameId: 'swapped-1',
        officialDate: '2024-07-02',
        scheduledStartTime: '2024-07-02T19:00:00Z',
        awayTeam: 'OTHER_1',
        homeTeam: 'HOME_1',
      },
    ];

    const result = buildEvidence(mixed, { lookbackWindowGames: 3, lookbackWindowDays: 30 });
    const aggregate = buildMLBTeamRecentFormAggregateSummary(result);

    expect(aggregate.awayAggregateSummary.homeAwaySplitCounts).toEqual({
      home: 1,
      away: 1,
    });
    expect(aggregate.homeAggregateSummary.homeAwaySplitCounts).toEqual({
      home: 1,
      away: 1,
    });
  });

  it('labels insufficient, partial, and complete deterministically', () => {
    const empty = buildEvidence([], { lookbackWindowGames: 3, lookbackWindowDays: 30 });
    const partial = buildEvidence([syntheticSafeRecord], { lookbackWindowGames: 3, lookbackWindowDays: 30 });
    const complete = buildEvidence(
      [
        syntheticSafeRecord,
        {
          ...syntheticSafeRecord,
          gameId: 'c-1',
          officialDate: '2024-07-02',
          scheduledStartTime: '2024-07-02T19:00:00Z',
        },
        {
          ...syntheticSafeRecord,
          gameId: 'c-2',
          officialDate: '2024-07-01',
          scheduledStartTime: '2024-07-01T19:00:00Z',
        },
      ],
      { lookbackWindowGames: 3, lookbackWindowDays: 30 },
    );

    const emptyAgg = buildMLBTeamRecentFormAggregateSummary(empty);
    const partialAgg = buildMLBTeamRecentFormAggregateSummary(partial);
    const completeAgg = buildMLBTeamRecentFormAggregateSummary(complete);

    expect(emptyAgg.awayAggregateSummary.dataCompletenessLabel).toBe('insufficient');
    expect(emptyAgg.awayAggregateSummary.recencyCoverageLabel).toBe('insufficient');
    expect(emptyAgg.awayAggregateSummary.status).toBe('insufficient');
    expect(emptyAgg.awayAggregateSummary.reason).toBe('insufficient-evidence');

    expect(partialAgg.awayAggregateSummary.dataCompletenessLabel).toBe('partial');
    expect(partialAgg.awayAggregateSummary.recencyCoverageLabel).toBe('partial');
    expect(partialAgg.awayAggregateSummary.status).toBe('partial');
    expect(partialAgg.awayAggregateSummary.reason).toBe('partial-evidence');

    expect(completeAgg.awayAggregateSummary.dataCompletenessLabel).toBe('complete');
    expect(completeAgg.awayAggregateSummary.recencyCoverageLabel).toBe('complete');
    expect(completeAgg.awayAggregateSummary.status).toBe('complete');
    expect(completeAgg.awayAggregateSummary.reason).toBe('complete-evidence');
  });

  it('dedupes and sorts sourceCompletenessWarnings deterministically', () => {
    const result = buildEvidence([syntheticSafeRecord], { lookbackWindowGames: 3, lookbackWindowDays: 30 });
    const aggregate = buildMLBTeamRecentFormAggregateSummary(result);

    const warnings = aggregate.awayAggregateSummary.sourceCompletenessWarnings;
    expect(warnings).toEqual([...new Set(warnings)].sort());
    if (warnings.length >= 2) {
      expect(warnings[0].localeCompare(warnings[warnings.length - 1])).toBeLessThanOrEqual(0);
    }
  });
});

describe('Phase 5J MLB result aggregate metrics mode', () => {
  it('rejects bare --result-aggregate-metrics-local with clean JSON error', () => {
    const { stdout, summary } = runResearchExpectingFailure([
      fixturePath,
      '--result-aggregate-metrics-local',
    ]);

    expect(summary.ok).toBe(false);
    expect(summary.error).toBe(TEAM_FORM_RESEARCH_RESULT_AGGREGATE_METRICS_NOT_ENABLED);
    expect('package' in summary).toBe(false);
    expect(stdout).not.toContain(projectRoot);
  });

  it('rejects --fixture-evidence-local --result-aggregate-metrics-local without --aggregate-summaries-local', () => {
    const { stdout, summary } = runResearchExpectingFailure([
      fixturePath,
      '--fixture-evidence-local',
      '--result-aggregate-metrics-local',
    ]);

    expect(summary.ok).toBe(false);
    expect(summary.error).toBe(TEAM_FORM_RESEARCH_RESULT_AGGREGATE_METRICS_REQUIRES_AGGREGATE_SUMMARIES);
    expect('package' in summary).toBe(false);
    expect(stdout).not.toContain(projectRoot);
  });

  it('preserves exact default stdout golden without resultAggregateMetricsLocal', () => {
    const expected = readFileSync(validStdoutGoldenPath, 'utf8');
    expect(runResearch([fixturePath])).toBe(expected);
  });

  it('preserves exact evidence-enabled stdout golden without resultAggregateMetricsLocal', () => {
    const expected = readFileSync(fixtureEvidenceLocalStdoutGoldenPath, 'utf8');
    expect(runResearch([fixturePath, '--fixture-evidence-local'])).toBe(expected);
  });

  it('preserves exact aggregate stdout golden without resultAggregateMetricsLocal', () => {
    const expected = readFileSync(aggregateSummariesLocalStdoutGoldenPath, 'utf8');
    expect(runResearch([fixturePath, '--fixture-evidence-local', '--aggregate-summaries-local'])).toBe(expected);
  });

  it('includes resultAggregateMetricsLocal flag in full result-metrics mode', () => {
    const stdout = runResearch([
      fixturePath,
      '--fixture-evidence-local',
      '--aggregate-summaries-local',
      '--result-aggregate-metrics-local',
    ]);
    const summary = JSON.parse(stdout) as Record<string, unknown>;

    expect(summary.ok).toBe(true);
    expect(summary.fixtureEvidenceLocal).toBe(true);
    expect(summary.aggregateSummariesLocal).toBe(true);
    expect(summary.resultAggregateMetricsLocal).toBe(true);
  });

  it('preserves exact result-aggregate-metrics stdout golden', () => {
    const expected = readFileSync(resultAggregateMetricsLocalStdoutGoldenPath, 'utf8');
    expect(runResearch([
      fixturePath,
      '--fixture-evidence-local',
      '--aggregate-summaries-local',
      '--result-aggregate-metrics-local',
    ])).toBe(expected);
  });

  it('result-metrics golden contains expected shape and deterministic insufficient metrics', () => {
    const stdout = readFileSync(resultAggregateMetricsLocalStdoutGoldenPath, 'utf8');
    const summary = JSON.parse(stdout) as Record<string, unknown>;

    expect(summary.ok).toBe(true);
    expect(summary.fixtureEvidenceLocal).toBe(true);
    expect(summary.aggregateSummariesLocal).toBe(true);
    expect(summary.resultAggregateMetricsLocal).toBe(true);
    expect(summary.gameCount).toBe(2);

    const games = (summary.package as Record<string, unknown>).games as Array<Record<string, unknown>>;
    for (const game of games) {
      const finding = (game.researchFindings as Record<string, unknown>).teamRecentForm as Record<string, unknown>;
      expect(finding.moduleVersion).toBe('mlb-team-recent-form-v1');
      expect(finding.scope).toBe('TEAM_ONLY');

      for (const side of [finding.awayAggregateSummary, finding.homeAggregateSummary]) {
        const metrics = (side as Record<string, unknown>).resultAggregateMetrics as Record<string, unknown>;
        expect(metrics.status).toBe('insufficient');
        expect(metrics.reason).toBe('insufficient-result-evidence');
        expect(metrics.gamesWithResultMetrics).toBe(0);
        expect(metrics.winsCount).toBe(0);
        expect(metrics.lossesCount).toBe(0);
        expect(metrics.drawsOrTiesCount).toBe(0);
        expect(metrics.averageRunsFor).toBeNull();
        expect(metrics.averageRunsAgainst).toBeNull();
        expect(metrics.averageRunDifferential).toBeNull();
        expect(metrics.runDifferentialTotal).toBe(0);
        expect(metrics.gamesWithRunsForAvailable).toBe(0);
        expect(metrics.gamesWithRunsAgainstAvailable).toBe(0);
        expect(metrics.resultMetricCompletenessLabel).toBe('insufficient');
      }
    }
  });

  it('produces deterministic result-metrics mode output across repeated runs', () => {
    const first = runResearch([
      fixturePath,
      '--fixture-evidence-local',
      '--aggregate-summaries-local',
      '--result-aggregate-metrics-local',
    ]);
    const second = runResearch([
      fixturePath,
      '--fixture-evidence-local',
      '--aggregate-summaries-local',
      '--result-aggregate-metrics-local',
    ]);

    expect(first).toBe(second);
  });

  it('keeps result-metrics mode free of forbidden fields and absolute paths', () => {
    const stdout = runResearch([
      fixturePath,
      '--fixture-evidence-local',
      '--aggregate-summaries-local',
      '--result-aggregate-metrics-local',
    ]);

    for (const field of [
      'modelProbability',
      'predictedWinner',
      'pick',
      'finalScore',
      'outcome',
      'completedGameState',
      'finalStatus',
      'actualStartingPitchers',
      'closingOdds',
      'impliedProbability',
      'odds',
      'market',
      'price',
    ]) {
      expect(stdout).not.toContain(`\"${field}\"`);
    }
    expect(stdout).not.toContain(projectRoot);
    expectNoAbsolutePaths(JSON.parse(stdout));
  });

  it('returns deterministic insufficient resultAggregateMetrics on current manual fixtures', () => {
    const stdout = runResearch([
      fixturePath,
      '--fixture-evidence-local',
      '--aggregate-summaries-local',
      '--result-aggregate-metrics-local',
    ]);
    const summary = JSON.parse(stdout) as {
      package: {
        games: Array<{
          researchFindings: {
            teamRecentForm: {
              awayAggregateSummary: Record<string, unknown>;
              homeAggregateSummary: Record<string, unknown>;
            };
          };
        }>;
      };
    };

    for (const game of summary.package.games) {
      const finding = game.researchFindings.teamRecentForm;
      for (const side of [finding.awayAggregateSummary, finding.homeAggregateSummary]) {
        const metrics = side.resultAggregateMetrics as {
          status: string;
          reason: string;
          gamesWithResultMetrics: number;
          winsCount: number;
          lossesCount: number;
          drawsOrTiesCount: number;
          averageRunsFor: number | null;
          averageRunsAgainst: number | null;
          averageRunDifferential: number | null;
          runDifferentialTotal: number;
          gamesWithRunsForAvailable: number;
          gamesWithRunsAgainstAvailable: number;
          resultMetricCompletenessLabel: string;
          resultMetricWarnings: readonly string[];
        };
        expect(metrics.status).toBe('insufficient');
        expect(metrics.reason).toBe('insufficient-result-evidence');
        expect(metrics.gamesWithResultMetrics).toBe(0);
        expect(metrics.winsCount).toBe(0);
        expect(metrics.lossesCount).toBe(0);
        expect(metrics.drawsOrTiesCount).toBe(0);
        expect(metrics.averageRunsFor).toBeNull();
        expect(metrics.averageRunsAgainst).toBeNull();
        expect(metrics.averageRunDifferential).toBeNull();
        expect(metrics.runDifferentialTotal).toBe(0);
        expect(metrics.gamesWithRunsForAvailable).toBe(0);
        expect(metrics.gamesWithRunsAgainstAvailable).toBe(0);
        expect(metrics.resultMetricCompletenessLabel).toBe('insufficient');
        expect(metrics.resultMetricWarnings).toEqual(
          expect.arrayContaining(['TEAM_FORM_EVIDENCE_FUTURE_GAME_EXCLUDED', 'TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES', 'TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION', TEAM_FORM_RESEARCH_RESULT_AGGREGATE_METRICS_NOT_ENABLED]),
        );
      }
    }
  });
});

describe('buildSafeResultItemsFromManualRecords unit tests', () => {
  const target = {
    gameId: 'target-game-1',
    scheduledStartTime: '2024-07-05T19:15:00Z',
    awayTeam: 'AWAY_1',
    homeTeam: 'HOME_1',
  };

  function buildItems(
    records: Array<{
      readonly gameId: string;
      readonly scheduledStartTime: string;
      readonly awayTeam: string;
      readonly homeTeam: string;
      readonly liveData?: Readonly<{
        readonly plays?: Readonly<{
          readonly allPlays?: ReadonlyArray<Readonly<{
            readonly about?: Readonly<{
              readonly endTime?: string;
            }>;
          }>>;
        }>;
      }>;
      readonly provenance?: Readonly<{
        readonly lastCompletedPlayEnd?: string;
      }>;
      readonly safeResultData?: Readonly<{
        readonly awayScore?: number;
        readonly homeScore?: number;
      }> | null;
    }>,
  ) {
    return buildSafeResultItemsFromManualRecords({
      records,
      target,
      lookbackWindowDays: 30,
      lookbackWindowGames: 4,
    });
  }

  it('computes wins/losses/ties and averages from team perspective', () => {
    const items = buildItems([
      {
        gameId: 'win-1',
        scheduledStartTime: '2024-07-04T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
        liveData: { plays: { allPlays: [{ about: { endTime: '2024-07-04T21:30:00Z' } }] } },
        provenance: { lastCompletedPlayEnd: 'LAST_COMPLETED_PLAY_END' },
        safeResultData: { awayScore: 3, homeScore: 5 },
      },
      {
        gameId: 'loss-1',
        scheduledStartTime: '2024-07-03T18:30:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
        liveData: { plays: { allPlays: [{ about: { endTime: '2024-07-03T21:00:00Z' } }] } },
        provenance: { lastCompletedPlayEnd: 'LAST_COMPLETED_PLAY_END' },
        safeResultData: { awayScore: 4, homeScore: 2 },
      },
      {
        gameId: 'tie-1',
        scheduledStartTime: '2024-07-02T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
        liveData: { plays: { allPlays: [{ about: { endTime: '2024-07-02T21:00:00Z' } }] } },
        provenance: { lastCompletedPlayEnd: 'LAST_COMPLETED_PLAY_END' },
        safeResultData: { awayScore: 3, homeScore: 3 },
      },
      {
        gameId: 'other-1',
        scheduledStartTime: '2024-07-01T18:30:00Z',
        awayTeam: 'OTHER_1',
        homeTeam: 'HOME_1',
        liveData: { plays: { allPlays: [{ about: { endTime: '2024-07-01T21:00:00Z' } }] } },
        provenance: { lastCompletedPlayEnd: 'LAST_COMPLETED_PLAY_END' },
        safeResultData: { awayScore: 1, homeScore: 4 },
      },
    ]);

    expect(items).toHaveLength(4);
    expect(items.map((item) => item.sourceGameId)).toEqual([
      'win-1',
      'loss-1',
      'tie-1',
      'other-1',
    ]);
    expect(items[0]).toMatchObject({
      team: 'AWAY_1',
      teamRole: 'AWAY',
      opponent: 'HOME_1',
      runsFor: 3,
      runsAgainst: 5,
      runDifferential: -2,
    });
    expect(items[1]).toMatchObject({
      team: 'AWAY_1',
      teamRole: 'AWAY',
      opponent: 'HOME_1',
      runsFor: 4,
      runsAgainst: 2,
      runDifferential: 2,
    });
    expect(items[2]).toMatchObject({
      team: 'AWAY_1',
      teamRole: 'AWAY',
      opponent: 'HOME_1',
      runsFor: 3,
      runsAgainst: 3,
      runDifferential: 0,
    });
    expect(items[3]).toMatchObject({
      team: 'HOME_1',
      teamRole: 'HOME',
      opponent: 'OTHER_1',
      runsFor: 4,
      runsAgainst: 1,
      runDifferential: 3,
    });
  });

  it('excludes games with missing safe result scores', () => {
    const items = buildItems([
      {
        gameId: 'missing-score',
        scheduledStartTime: '2024-07-04T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
        liveData: { plays: { allPlays: [{ about: { endTime: '2024-07-04T21:30:00Z' } }] } },
        provenance: { lastCompletedPlayEnd: 'LAST_COMPLETED_PLAY_END' },
        safeResultData: { awayScore: 3 },
      },
    ]);

    expect(items).toHaveLength(0);
  });

  it('excludes unsafe completion provenance', () => {
    const items = buildItems([
      {
        gameId: 'unsafe-provenance',
        scheduledStartTime: '2024-07-04T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
        liveData: { plays: { allPlays: [{ about: { endTime: '2024-07-04T21:30:00Z' } }] } },
        provenance: { lastCompletedPlayEnd: 'SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN' },
        safeResultData: { awayScore: 3, homeScore: 5 },
      },
    ]);

    expect(items).toHaveLength(0);
  });

  it('excludes completedAt after or equal target scheduledStartTime', () => {
    const items = buildItems([
      {
        gameId: 'late-completed',
        scheduledStartTime: '2024-07-04T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
        liveData: { plays: { allPlays: [{ about: { endTime: '2024-07-05T19:15:00Z' } }] } },
        provenance: { lastCompletedPlayEnd: 'LAST_COMPLETED_PLAY_END' },
        safeResultData: { awayScore: 3, homeScore: 5 },
      },
      {
        gameId: 'equal-completed',
        scheduledStartTime: '2024-07-04T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
        liveData: { plays: { allPlays: [{ about: { endTime: '2024-07-05T19:15:00Z' } }] } },
        provenance: { lastCompletedPlayEnd: 'LAST_COMPLETED_PLAY_END' },
        safeResultData: { awayScore: 2, homeScore: 1 },
      },
    ]);

    expect(items).toHaveLength(0);
  });

  it('excludes the target game', () => {
    const items = buildItems([
      {
        gameId: target.gameId,
        scheduledStartTime: '2024-07-04T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
        liveData: { plays: { allPlays: [{ about: { endTime: '2024-07-04T21:30:00Z' } }] } },
        provenance: { lastCompletedPlayEnd: 'LAST_COMPLETED_PLAY_END' },
        safeResultData: { awayScore: 3, homeScore: 5 },
      },
    ]);

    expect(items).toHaveLength(0);
  });

  it('limits results to lookbackWindowGames and sorts deterministically', () => {
    const items = buildItems([
      {
        gameId: 'oldest',
        scheduledStartTime: '2024-07-03T18:30:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
        liveData: { plays: { allPlays: [{ about: { endTime: '2024-07-03T21:00:00Z' } }] } },
        provenance: { lastCompletedPlayEnd: 'LAST_COMPLETED_PLAY_END' },
        safeResultData: { awayScore: 1, homeScore: 2 },
      },
      {
        gameId: 'newest',
        scheduledStartTime: '2024-07-03T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
        liveData: { plays: { allPlays: [{ about: { endTime: '2024-07-03T22:00:00Z' } }] } },
        provenance: { lastCompletedPlayEnd: 'LAST_COMPLETED_PLAY_END' },
        safeResultData: { awayScore: 4, homeScore: 5 },
      },
    ]);

    expect(items).toHaveLength(2);
    expect(items[0].sourceGameId).toBe('newest');
    expect(items[1].sourceGameId).toBe('oldest');
  });

  it('does not expose raw score/outcome fields in returned aggregate', () => {
    const items = buildItems([
      {
        gameId: 'raw-check',
        scheduledStartTime: '2024-07-04T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
        liveData: { plays: { allPlays: [{ about: { endTime: '2024-07-04T21:30:00Z' } }] } },
        provenance: { lastCompletedPlayEnd: 'LAST_COMPLETED_PLAY_END' },
        safeResultData: { awayScore: 3, homeScore: 5 },
      },
    ]);

    const aggregates = items.map((item) => ({
      team: item.team,
      rawScoreSummary: item.runsFor,
      rawOutcome: item.runDifferential,
    }));

    expect(aggregates).toEqual([
      {
        team: 'AWAY_1',
        rawScoreSummary: 3,
        rawOutcome: -2,
      },
    ]);
  });
});

describe('Phase 5M MLB team schedule context mode', () => {
  const fixturePathForSchedule = join(
    projectRoot,
    'tests',
    'prospective',
    'fixtures',
    'manual-schedule',
    'valid-weekly-prospective-research-construction-file-artifact-v1.json',
  );

  it('rejects bare --team-schedule-context-local with clean JSON error', () => {
    const { stdout, summary } = runResearchExpectingFailure([
      fixturePathForSchedule,
      '--team-schedule-context-local',
    ]);

    expect(summary).toEqual(
      expect.objectContaining({
        ok: false,
        error: 'TEAM_SCHEDULE_CONTEXT_REQUIRES_FIXTURE_EVIDENCE',
      }),
    );
    expect(stdout).not.toContain(projectRoot);
  });

  it('includes teamScheduleContextLocal only when explicitly enabled', () => {
    const first = runResearch([
      fixturePathForSchedule,
      '--fixture-evidence-local',
      '--team-schedule-context-local',
    ]);
    const second = runResearch([
      fixturePathForSchedule,
      '--fixture-evidence-local',
      '--team-schedule-context-local',
    ]);

    expect(first).toBe(second);
    const summary = JSON.parse(first) as Record<string, unknown>;
    expect(summary.ok).toBe(true);
    expect(summary.teamScheduleContextLocal).toBe(true);
  });

  it('keeps default, evidence, aggregate, and result-metrics goldens unchanged', () => {
    const expectedDefault = readFileSync(validStdoutGoldenPath, 'utf8');
    expect(runResearch([fixturePathForSchedule])).toBe(expectedDefault);

    const expectedEvidence = readFileSync(
      fixtureEvidenceLocalStdoutGoldenPath,
      'utf8',
    );
    expect(
      runResearch([fixturePathForSchedule, '--fixture-evidence-local']),
    ).toBe(expectedEvidence);

    const expectedAggregate = readFileSync(
      aggregateSummariesLocalStdoutGoldenPath,
      'utf8',
    );
    expect(
      runResearch([
        fixturePathForSchedule,
        '--fixture-evidence-local',
        '--aggregate-summaries-local',
      ]),
    ).toBe(expectedAggregate);

    const expectedResultMetrics = readFileSync(
      resultAggregateMetricsLocalStdoutGoldenPath,
      'utf8',
    );
    expect(
      runResearch([
        fixturePathForSchedule,
        '--fixture-evidence-local',
        '--aggregate-summaries-local',
        '--result-aggregate-metrics-local',
      ]),
    ).toBe(expectedResultMetrics);
  });

  it('does not expose forbidden fields in schedule context mode', () => {
    const stdout = runResearch([
      fixturePathForSchedule,
      '--fixture-evidence-local',
      '--team-schedule-context-local',
    ]);

    for (const field of [
      'modelProbability',
      'predictedWinner',
      'pick',
      'finalScore',
      'outcome',
      'completedGameState',
      'finalStatus',
      'actualStartingPitchers',
      'closingOdds',
      'impliedProbability',
      'odds',
      'market',
      'price',
    ]) {
      expect(stdout).not.toContain(`"${field}"`);
    }
    expect(stdout).not.toContain(projectRoot);
    expectNoAbsolutePaths(JSON.parse(stdout));
  });

  it('keeps schedule context limited to TEAM_ONLY scope descriptive fields', () => {
    const stdout = runResearch([
      fixturePathForSchedule,
      '--fixture-evidence-local',
      '--team-schedule-context-local',
    ]);
    const summary = JSON.parse(stdout) as {
      package: {
        games: Array<{
          researchFindings: {
            teamRecentForm: Record<string, unknown>;
            teamScheduleContext: TeamScheduleContext;
          };
        }>;
      };
    };

    expect(summary.package.games).toHaveLength(2);
    for (const game of summary.package.games) {
      expect(game.researchFindings.teamRecentForm.moduleVersion).toBe(
        TEAM_RECENT_FORM_MODULE_VERSION,
      );
      expect(game.researchFindings.teamScheduleContext.moduleVersion).toBe(
        'mlb-team-schedule-context-v1',
      );
      expect(game.researchFindings.teamScheduleContext.scope).toBe('TEAM_ONLY');
      expect(game.researchFindings.teamScheduleContext.moduleName).toBe(
        'TEAM_SCHEDULE_CONTEXT',
      );
      expect(game.researchFindings.teamScheduleContext.awayScheduleContext).toMatchObject({
        status: 'insufficient',
        reason: 'insufficient-schedule-evidence',
        gamesInLast3Days: 0,
        gamesInLast7Days: 0,
        gamesInNext3Days: 0,
        gamesInNext7Days: 0,
        consecutiveRoadGames: 0,
        consecutiveHomeGames: 0,
        scheduleContextWarnings: expect.arrayContaining([
          'TEAM_SCHEDULE_CONTEXT_NO_RECORDS',
        ]),
      });
      expect(game.researchFindings.teamScheduleContext.awayScheduleContext.previousGameScheduledAt).toBeNull();
      expect(game.researchFindings.teamScheduleContext.awayScheduleContext.nextGameScheduledAt).toBeNull();
    }
  });

  it('matches exact Phase 5N schedule-context stdout golden', () => {
    const expected = readFileSync(teamScheduleContextLocalStdoutGoldenPath, 'utf8');
    expect(
      runResearch([
        fixturePathForSchedule,
        '--fixture-evidence-local',
        '--team-schedule-context-local',
      ]),
    ).toBe(expected);
  });

  it('parses Phase 5N schedule-context golden with required top-level fields', () => {
    const expected = readFileSync(teamScheduleContextLocalStdoutGoldenPath, 'utf8');
    const summary = JSON.parse(expected) as Record<string, unknown>;

    expect(summary.ok).toBe(true);
    expect(summary.fixtureEvidenceLocal).toBe(true);
    expect(summary.teamScheduleContextLocal).toBe(true);
    expect(summary.gameCount).toBe(2);

    const games = (summary.package as { games: unknown[] }).games;
    expect(games).toHaveLength(2);
    for (const game of games) {
      expect(game).toHaveProperty('researchFindings.teamRecentForm');
      expect(game).toHaveProperty('researchFindings.teamScheduleContext');
    }
  });

  it('Phase 5N golden schedule context exposes only TEAM_ONLY scope fields', () => {
    const expected = readFileSync(teamScheduleContextLocalStdoutGoldenPath, 'utf8');
    const summary = JSON.parse(expected) as {
      package: {
        games: Array<{
          researchFindings: {
            teamScheduleContext: {
              moduleVersion: string;
              moduleName: string;
              scope: string;
              awayScheduleContext: {
                status: string;
                reason: string;
                scheduleContextWarnings: string[];
              };
              homeScheduleContext: {
                status: string;
                reason: string;
                scheduleContextWarnings: string[];
              };
            };
          };
        }>;
      };
    };

    for (const game of summary.package.games) {
      const context = game.researchFindings.teamScheduleContext;
      expect(context.moduleVersion).toBe('mlb-team-schedule-context-v1');
      expect(context.moduleName).toBe('TEAM_SCHEDULE_CONTEXT');
      expect(context.scope).toBe('TEAM_ONLY');
      expect(context.awayScheduleContext.status).toBe('insufficient');
      expect(context.awayScheduleContext.reason).toBe('insufficient-schedule-evidence');
      expect(context.awayScheduleContext.scheduleContextWarnings).toEqual(
        expect.arrayContaining(['TEAM_SCHEDULE_CONTEXT_NO_RECORDS']),
      );
      expect(context.homeScheduleContext.status).toBe('insufficient');
      expect(context.homeScheduleContext.reason).toBe('insufficient-schedule-evidence');
      expect(context.homeScheduleContext.scheduleContextWarnings).toEqual(
        expect.arrayContaining(['TEAM_SCHEDULE_CONTEXT_NO_RECORDS']),
      );
    }
  });

  it('Phase 5N golden does not contain forbidden fields', () => {
    const expected = readFileSync(teamScheduleContextLocalStdoutGoldenPath, 'utf8');
    for (const field of [
      'modelProbability',
      'predictedWinner',
      'pick',
      'finalScore',
      'outcome',
      'completedGameState',
      'finalStatus',
      'actualStartingPitchers',
      'closingOdds',
      'impliedProbability',
      'odds',
      'market',
      'price',
    ]) {
      expect(expected).not.toContain(`"${field}"`);
    }
    expectNoAbsolutePaths(JSON.parse(expected));
    expect(expected).not.toContain(projectRoot);
  });

  it('repeated schedule-context mode matches new golden byte-for-byte', () => {
    const expected = readFileSync(teamScheduleContextLocalStdoutGoldenPath, 'utf8');
    const first = runResearch([
      fixturePathForSchedule,
      '--fixture-evidence-local',
      '--team-schedule-context-local',
    ]);
    expect(first).toBe(expected);
  });
});

describe('buildTeamScheduleContext unit tests', () => {
  it('returns deterministic insufficient context when no schedule records exist', () => {
    const context = buildTeamScheduleContext(
      {
        gameId: 'target-1',
        officialDate: '2024-07-05',
        scheduledStartTime: '2024-07-05T19:15:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      [],
    );

    expect(context.moduleVersion).toBe('mlb-team-schedule-context-v1');
    expect(context.moduleName).toBe('TEAM_SCHEDULE_CONTEXT');
    expect(context.scope).toBe('TEAM_ONLY');
    expect(context.awayScheduleContext).toMatchObject({
      status: 'insufficient',
      reason: 'insufficient-schedule-evidence',
      previousGameScheduledAt: null,
      nextGameScheduledAt: null,
      daysSincePreviousGame: null,
      hoursSincePreviousGame: null,
      daysUntilNextGame: null,
      hoursUntilNextGame: null,
      gamesInLast3Days: 0,
      gamesInLast7Days: 0,
      gamesInNext3Days: 0,
      gamesInNext7Days: 0,
      consecutiveRoadGames: 0,
      consecutiveHomeGames: 0,
      scheduleContextWarnings: ['TEAM_SCHEDULE_CONTEXT_NO_RECORDS'],
    });
    expect(context.homeScheduleContext).toMatchObject({
      status: 'insufficient',
      reason: 'insufficient-schedule-evidence',
      previousGameScheduledAt: null,
      nextGameScheduledAt: null,
      daysSincePreviousGame: null,
      hoursSincePreviousGame: null,
      daysUntilNextGame: null,
      hoursUntilNextGame: null,
      gamesInLast3Days: 0,
      gamesInLast7Days: 0,
      gamesInNext3Days: 0,
      gamesInNext7Days: 0,
      consecutiveRoadGames: 0,
      consecutiveHomeGames: 0,
      scheduleContextWarnings: ['TEAM_SCHEDULE_CONTEXT_NO_RECORDS'],
    });
  });

  it('detects previous and next games with deterministic fatal/duration metrics', () => {
    const records = [
      {
        gameId: 'prev',
        officialDate: '2024-07-02',
        scheduledStartTime: '2024-07-02T18:30:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      {
        gameId: 'next',
        officialDate: '2024-07-08',
        scheduledStartTime: '2024-07-08T18:30:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
    ];

    const context = buildTeamScheduleContext(
      {
        gameId: 'target',
        officialDate: '2024-07-05',
        scheduledStartTime: '2024-07-05T19:15:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      records,
    );

    expect(context.awayScheduleContext.status).toBe('complete');
    expect(context.awayScheduleContext.reason).toBe('complete-schedule-evidence');
    expect(context.awayScheduleContext.previousGameScheduledAt).toBe('2024-07-02T18:30:00.000Z');
    expect(context.awayScheduleContext.nextGameScheduledAt).toBe('2024-07-08T18:30:00.000Z');
    expect(context.awayScheduleContext.daysSincePreviousGame).toBe(3);
    expect(context.awayScheduleContext.hoursSincePreviousGame).toBeGreaterThanOrEqual(70);
    expect(context.awayScheduleContext.daysUntilNextGame).toBe(3);
    expect(context.awayScheduleContext.hoursUntilNextGame).toBeGreaterThanOrEqual(70);
  });

  it('counts games within 3 and 7 day windows and excludes back-to-back overlap', () => {
    const records = [
      {
        gameId: 'prev',
        officialDate: '2024-07-04',
        scheduledStartTime: '2024-07-04T18:30:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      {
        gameId: 'prev-2',
        officialDate: '2024-07-01',
        scheduledStartTime: '2024-07-01T18:30:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      {
        gameId: 'next',
        officialDate: '2024-07-07',
        scheduledStartTime: '2024-07-07T18:30:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
    ];

    const context = buildTeamScheduleContext(
      {
        gameId: 'target',
        officialDate: '2024-07-05',
        scheduledStartTime: '2024-07-05T19:15:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      records,
      7,
      7,
    );

    expect(context.awayScheduleContext.gamesInLast3Days).toBe(1);
    expect(context.awayScheduleContext.gamesInLast7Days).toBe(2);
    expect(context.awayScheduleContext.gamesInNext3Days).toBe(1);
    expect(context.awayScheduleContext.gamesInNext7Days).toBe(1);
  });

  it('returns invalid-timestamp result for malformed target time', () => {
    const context = buildTeamScheduleContext(
      {
        gameId: 'target',
        officialDate: '2024-07-05',
        scheduledStartTime: 'not-a-timestamp',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      [
        {
          gameId: 'prev',
          officialDate: '2024-07-02',
          scheduledStartTime: '2024-07-02T18:30:00Z',
          awayTeam: 'AWAY_1',
          homeTeam: 'HOME_1',
        },
      ],
    );

    expect(context.awayScheduleContext.status).toBe('not-evaluated');
    expect(context.awayScheduleContext.reason).toBe('invalid-timestamp');
    expect(context.awayScheduleContext.scheduleContextWarnings).toEqual([
      'TEAM_SCHEDULE_CONTEXT_INVALID_TIMESTAMP',
    ]);
    expect(context.awayScheduleContext.gamesInLast3Days).toBe(0);
    expect(context.awayScheduleContext.gamesInNext3Days).toBe(0);
  });

  it('excludes the target game from window counts', () => {
    const records = [
      {
        gameId: 'target',
        officialDate: '2024-07-05',
        scheduledStartTime: '2024-07-05T19:15:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      {
        gameId: 'prev',
        officialDate: '2024-07-02',
        scheduledStartTime: '2024-07-02T18:30:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
    ];

    const context = buildTeamScheduleContext(
      {
        gameId: 'target',
        officialDate: '2024-07-05',
        scheduledStartTime: '2024-07-05T19:15:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      records,
    );

    expect(context.awayScheduleContext.gamesInLast7Days).toBe(1);
    expect(context.awayScheduleContext.previousGameScheduledAt).toBe('2024-07-02T18:30:00.000Z');
  });

  it('dedupes and sorts scheduleContextWarnings deterministically', () => {
    const records = [
      {
        gameId: 'a',
        officialDate: '2024-07-03',
        scheduledStartTime: '2024-07-03T18:30:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
    ];

    const context = buildTeamScheduleContext(
      {
        gameId: 'target',
        officialDate: '2024-07-05',
        scheduledStartTime: '2024-07-05T19:15:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      records,
    );

    const warnings = context.awayScheduleContext.scheduleContextWarnings;
    expect(warnings).toEqual([...new Set(warnings)].sort());
  });

  it('never exposes raw outcome fields in schedule context output', () => {
    const context = buildTeamScheduleContext(
      {
        gameId: 'target',
        officialDate: '2024-07-05',
        scheduledStartTime: '2024-07-05T19:15:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      [],
    );

    const json = JSON.stringify(context);
    for (const field of [
      'finalScore',
      'completedGameState',
      'finalStatus',
      'actualStartingPitchers',
      'predictedWinner',
      'pick',
      'modelProbability',
    ]) {
      expect(json).not.toContain(`"${field}"`);
    }
  });

  it('returns rich previous/next schedule context with exact dates hours days and window counts', () => {
    const records = [
      {
        gameId: 'prev-2',
        officialDate: '2024-07-02',
        scheduledStartTime: '2024-07-02T18:30:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      {
        gameId: 'prev-1',
        officialDate: '2024-07-04',
        scheduledStartTime: '2024-07-04T18:30:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_2',
      },
      {
        gameId: 'prev-home',
        officialDate: '2024-07-07',
        scheduledStartTime: '2024-07-07T18:30:00Z',
        awayTeam: 'HOME_1',
        homeTeam: 'AWAY_1',
      },
      {
        gameId: 'prev-mixed',
        officialDate: '2024-07-08',
        scheduledStartTime: '2024-07-08T18:30:00Z',
        awayTeam: 'AWAY_2',
        homeTeam: 'AWAY_1',
      },
      {
        gameId: 'prev-0',
        officialDate: '2024-07-09',
        scheduledStartTime: '2024-07-09T18:30:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_3',
      },
      {
        gameId: 'next-1',
        officialDate: '2024-07-14',
        scheduledStartTime: '2024-07-14T18:30:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_4',
      },
      {
        gameId: 'next-extra',
        officialDate: '2024-07-12',
        scheduledStartTime: '2024-07-12T18:30:00Z',
        awayTeam: 'AWAY_3',
        homeTeam: 'AWAY_1',
      },
      {
        gameId: 'next-2',
        officialDate: '2024-07-17',
        scheduledStartTime: '2024-07-17T18:30:00Z',
        awayTeam: 'AWAY_2',
        homeTeam: 'HOME_3',
      },
    ];

    const context = buildTeamScheduleContext(
      {
        gameId: 'target-rich',
        officialDate: '2024-07-10',
        scheduledStartTime: '2024-07-10T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      records,
    );

    expect(context.awayScheduleContext.status).toBe('complete');
    expect(context.awayScheduleContext.reason).toBe('complete-schedule-evidence');
    expect(context.awayScheduleContext.previousGameScheduledAt).toBe('2024-07-09T18:30:00.000Z');
    expect(context.awayScheduleContext.nextGameScheduledAt).toBe('2024-07-12T18:30:00.000Z');
    expect(context.awayScheduleContext.daysSincePreviousGame).toBe(1);
    expect(context.awayScheduleContext.hoursSincePreviousGame).toBe(25);
    expect(context.awayScheduleContext.daysUntilNextGame).toBe(2);
    expect(context.awayScheduleContext.hoursUntilNextGame).toBe(48);
    expect(context.awayScheduleContext.gamesInLast3Days).toBe(1);
    expect(context.awayScheduleContext.gamesInLast7Days).toBe(4);
    expect(context.awayScheduleContext.gamesInNext3Days).toBe(1);
    expect(context.awayScheduleContext.gamesInNext7Days).toBe(2);
    expect(context.awayScheduleContext.consecutiveRoadGames).toBe(1);
    expect(context.awayScheduleContext.consecutiveHomeGames).toBe(0);
    expect(context.awayScheduleContext.homeAwaySequenceLabel).toBe('mixed');
    expect(context.awayScheduleContext.scheduleDensityLabel).toBe('elevated-density');
    expect(context.awayScheduleContext.restAdvantageLabel).toBe('minimal-rest');
    expect(context.awayScheduleContext.travelBurdenLabel).toBe('insufficient');
    expect(context.awayScheduleContext.scheduleContextCompletenessLabel).toBe('complete');

    expect(context.homeScheduleContext.status).toBe('partial');
    expect(context.homeScheduleContext.reason).toBe('partial-schedule-evidence');
    expect(context.homeScheduleContext.previousGameScheduledAt).toBe('2024-07-07T18:30:00.000Z');
    expect(context.homeScheduleContext.nextGameScheduledAt).toBeNull();
    expect(context.homeScheduleContext.daysSincePreviousGame).toBe(3);
    expect(context.homeScheduleContext.hoursSincePreviousGame).toBe(73);
    expect(context.homeScheduleContext.daysUntilNextGame).toBeNull();
    expect(context.homeScheduleContext.hoursUntilNextGame).toBeNull();
    expect(context.homeScheduleContext.gamesInLast3Days).toBe(0);
    expect(context.homeScheduleContext.gamesInLast7Days).toBe(1);
    expect(context.homeScheduleContext.gamesInNext3Days).toBe(0);
    expect(context.homeScheduleContext.gamesInNext7Days).toBe(0);
    expect(context.homeScheduleContext.consecutiveRoadGames).toBe(1);
    expect(context.homeScheduleContext.consecutiveHomeGames).toBe(0);
    expect(context.homeScheduleContext.homeAwaySequenceLabel).toBe('mixed');
    expect(context.homeScheduleContext.scheduleDensityLabel).toBe('low-density');
    expect(context.homeScheduleContext.restAdvantageLabel).toBe('standard-rest');
    expect(context.homeScheduleContext.travelBurdenLabel).toBe('insufficient');
    expect(context.homeScheduleContext.scheduleContextCompletenessLabel).toBe('partial');
  });

  it('excludes games exactly at the 3-day window boundary from counts', () => {
    const records = [
      {
        gameId: 'boundary-3d-past',
        officialDate: '2024-07-07',
        scheduledStartTime: '2024-07-07T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      {
        gameId: 'boundary-3d-future',
        officialDate: '2024-07-13',
        scheduledStartTime: '2024-07-13T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
    ];

    const context = buildTeamScheduleContext(
      {
        gameId: 'target-boundary',
        officialDate: '2024-07-10',
        scheduledStartTime: '2024-07-10T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      records,
    );

    expect(context.awayScheduleContext.previousGameScheduledAt).toBe('2024-07-07T19:00:00.000Z');
    expect(context.awayScheduleContext.nextGameScheduledAt).toBe('2024-07-13T19:00:00.000Z');
    expect(context.awayScheduleContext.daysSincePreviousGame).toBe(3);
    expect(context.awayScheduleContext.hoursSincePreviousGame).toBe(72);
    expect(context.awayScheduleContext.daysUntilNextGame).toBe(3);
    expect(context.awayScheduleContext.hoursUntilNextGame).toBe(72);
    expect(context.awayScheduleContext.gamesInLast3Days).toBe(0);
    expect(context.awayScheduleContext.gamesInNext3Days).toBe(0);
    expect(context.awayScheduleContext.gamesInLast7Days).toBe(1);
    expect(context.awayScheduleContext.gamesInNext7Days).toBe(1);
  });

  it('excludes games exactly at the 7-day window boundary from counts', () => {
    const records = [
      {
        gameId: 'boundary-7d-past',
        officialDate: '2024-07-03',
        scheduledStartTime: '2024-07-03T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      {
        gameId: 'boundary-7d-future',
        officialDate: '2024-07-17',
        scheduledStartTime: '2024-07-17T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
    ];

    const context = buildTeamScheduleContext(
      {
        gameId: 'target-boundary',
        officialDate: '2024-07-10',
        scheduledStartTime: '2024-07-10T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      records,
    );

    expect(context.awayScheduleContext.previousGameScheduledAt).toBe('2024-07-03T19:00:00.000Z');
    expect(context.awayScheduleContext.nextGameScheduledAt).toBe('2024-07-17T19:00:00.000Z');
    expect(context.awayScheduleContext.daysSincePreviousGame).toBe(7);
    expect(context.awayScheduleContext.hoursSincePreviousGame).toBe(168);
    expect(context.awayScheduleContext.daysUntilNextGame).toBe(7);
    expect(context.awayScheduleContext.hoursUntilNextGame).toBe(168);
    expect(context.awayScheduleContext.gamesInLast3Days).toBe(0);
    expect(context.awayScheduleContext.gamesInNext3Days).toBe(0);
    expect(context.awayScheduleContext.gamesInLast7Days).toBe(0);
    expect(context.awayScheduleContext.gamesInNext7Days).toBe(0);
  });

  it('computes consecutive road games from the most recent past streak', () => {
    const records = [
      {
        gameId: 'road-1',
        officialDate: '2024-07-01',
        scheduledStartTime: '2024-07-01T18:30:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_A',
      },
      {
        gameId: 'road-2',
        officialDate: '2024-07-02',
        scheduledStartTime: '2024-07-02T18:30:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_B',
      },
      {
        gameId: 'road-3',
        officialDate: '2024-07-03',
        scheduledStartTime: '2024-07-03T18:30:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_C',
      },
      {
        gameId: 'road-4',
        officialDate: '2024-07-04',
        scheduledStartTime: '2024-07-04T18:30:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_D',
      },
    ];

    const context = buildTeamScheduleContext(
      {
        gameId: 'target-streak',
        officialDate: '2024-07-06',
        scheduledStartTime: '2024-07-06T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      records,
    );

    expect(context.awayScheduleContext.consecutiveRoadGames).toBe(4);
    expect(context.awayScheduleContext.consecutiveHomeGames).toBe(0);
    expect(context.awayScheduleContext.homeAwaySequenceLabel).toBe('away-streak');
    expect(context.awayScheduleContext.gamesInLast7Days).toBe(4);
    expect(context.awayScheduleContext.scheduleDensityLabel).toBe('elevated-density');
  });

  it('computes consecutive home games from the most recent past streak', () => {
    const records = [
      {
        gameId: 'home-1',
        officialDate: '2024-07-01',
        scheduledStartTime: '2024-07-01T18:30:00Z',
        awayTeam: 'AWAY_A',
        homeTeam: 'HOME_1',
      },
      {
        gameId: 'home-2',
        officialDate: '2024-07-02',
        scheduledStartTime: '2024-07-02T18:30:00Z',
        awayTeam: 'AWAY_B',
        homeTeam: 'HOME_1',
      },
      {
        gameId: 'home-3',
        officialDate: '2024-07-03',
        scheduledStartTime: '2024-07-03T18:30:00Z',
        awayTeam: 'AWAY_C',
        homeTeam: 'HOME_1',
      },
      {
        gameId: 'home-4',
        officialDate: '2024-07-04',
        scheduledStartTime: '2024-07-04T18:30:00Z',
        awayTeam: 'AWAY_D',
        homeTeam: 'HOME_1',
      },
    ];

    const context = buildTeamScheduleContext(
      {
        gameId: 'target-home-streak',
        officialDate: '2024-07-06',
        scheduledStartTime: '2024-07-06T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      records,
    );

    expect(context.homeScheduleContext.consecutiveHomeGames).toBe(4);
    expect(context.homeScheduleContext.consecutiveRoadGames).toBe(0);
    expect(context.homeScheduleContext.homeAwaySequenceLabel).toBe('home-streak');
    expect(context.homeScheduleContext.gamesInLast7Days).toBe(4);
    expect(context.homeScheduleContext.scheduleDensityLabel).toBe('elevated-density');
  });

  it('returns mixed home/away sequence label when last 3 games alternate', () => {
    const records = [
      {
        gameId: 'mix-1',
        officialDate: '2024-07-01',
        scheduledStartTime: '2024-07-01T18:30:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_A',
      },
      {
        gameId: 'mix-2',
        officialDate: '2024-07-02',
        scheduledStartTime: '2024-07-02T18:30:00Z',
        awayTeam: 'HOME_A',
        homeTeam: 'AWAY_1',
      },
      {
        gameId: 'mix-3',
        officialDate: '2024-07-03',
        scheduledStartTime: '2024-07-03T18:30:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_A',
      },
    ];

    const context = buildTeamScheduleContext(
      {
        gameId: 'target-mixed',
        officialDate: '2024-07-05',
        scheduledStartTime: '2024-07-05T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      records,
    );

    expect(context.awayScheduleContext.homeAwaySequenceLabel).toBe('mixed');
    expect(context.awayScheduleContext.consecutiveRoadGames).toBe(1);
    expect(context.awayScheduleContext.consecutiveHomeGames).toBe(0);
    expect(context.awayScheduleContext.gamesInLast7Days).toBe(3);
    expect(context.awayScheduleContext.scheduleDensityLabel).toBe('moderate-density');
  });

  it('does not list the target game as previous or next', () => {
    const context = buildTeamScheduleContext(
      {
        gameId: 'target-exclude',
        officialDate: '2024-07-10',
        scheduledStartTime: '2024-07-10T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      [
        {
          gameId: 'target-exclude',
          officialDate: '2024-07-10',
          scheduledStartTime: '2024-07-10T19:00:00Z',
          awayTeam: 'AWAY_1',
          homeTeam: 'HOME_1',
        },
      ],
    );

    expect(context.awayScheduleContext.previousGameScheduledAt).toBeNull();
    expect(context.awayScheduleContext.nextGameScheduledAt).toBeNull();
    expect(context.awayScheduleContext.gamesInLast7Days).toBe(0);
    expect(context.awayScheduleContext.gamesInNext7Days).toBe(0);
  });

  it('returns partial context when no previous game exists', () => {
    const context = buildTeamScheduleContext(
      {
        gameId: 'target-only-next',
        officialDate: '2024-07-10',
        scheduledStartTime: '2024-07-10T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      [
        {
          gameId: 'only-next',
          officialDate: '2024-07-14',
          scheduledStartTime: '2024-07-14T18:30:00Z',
          awayTeam: 'AWAY_1',
          homeTeam: 'HOME_1',
        },
      ],
    );

    expect(context.awayScheduleContext.status).toBe('partial');
    expect(context.awayScheduleContext.reason).toBe('partial-schedule-evidence');
    expect(context.awayScheduleContext.previousGameScheduledAt).toBeNull();
    expect(context.awayScheduleContext.nextGameScheduledAt).toBe('2024-07-14T18:30:00.000Z');
    expect(context.awayScheduleContext.daysUntilNextGame).toBe(4);
    expect(context.awayScheduleContext.hoursUntilNextGame).toBe(96);
    expect(context.awayScheduleContext.scheduleContextCompletenessLabel).toBe('partial');
  });

  it('returns partial context when no next game exists', () => {
    const context = buildTeamScheduleContext(
      {
        gameId: 'target-only-prev',
        officialDate: '2024-07-10',
        scheduledStartTime: '2024-07-10T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      [
        {
          gameId: 'only-prev',
          officialDate: '2024-07-02',
          scheduledStartTime: '2024-07-02T18:30:00Z',
          awayTeam: 'AWAY_1',
          homeTeam: 'HOME_1',
        },
      ],
    );

    expect(context.awayScheduleContext.status).toBe('partial');
    expect(context.awayScheduleContext.reason).toBe('partial-schedule-evidence');
    expect(context.awayScheduleContext.previousGameScheduledAt).toBe('2024-07-02T18:30:00.000Z');
    expect(context.awayScheduleContext.nextGameScheduledAt).toBeNull();
    expect(context.awayScheduleContext.daysSincePreviousGame).toBe(8);
    expect(context.awayScheduleContext.hoursSincePreviousGame).toBe(193);
    expect(context.awayScheduleContext.scheduleContextCompletenessLabel).toBe('partial');
  });

  it('emits invalid-timestamp warning for empty scheduledStartTime', () => {
    const context = buildTeamScheduleContext(
      {
        gameId: 'target-empty',
        officialDate: '2024-07-05',
        scheduledStartTime: '',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      [],
    );

    expect(context.awayScheduleContext.status).toBe('not-evaluated');
    expect(context.awayScheduleContext.reason).toBe('invalid-timestamp');
    expect(context.awayScheduleContext.scheduleContextWarnings).toEqual([
      'TEAM_SCHEDULE_CONTEXT_INVALID_TIMESTAMP',
    ]);
  });

  it('does not serialize forbidden fields when output is stringified', () => {
    const context = buildTeamScheduleContext(
      {
        gameId: 'target-stringify',
        officialDate: '2024-07-05',
        scheduledStartTime: '2024-07-05T19:00:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      [
        {
          gameId: 'prev',
          officialDate: '2024-07-02',
          scheduledStartTime: '2024-07-02T18:30:00Z',
          awayTeam: 'AWAY_1',
          homeTeam: 'HOME_1',
        },
      ],
    );

    const json = JSON.stringify(context);
    for (const field of [
      'finalScore',
      'completedGameState',
      'finalStatus',
      'actualStartingPitchers',
      'predictedWinner',
      'pick',
      'modelProbability',
      'outcome',
      'closingOdds',
      'impliedProbability',
      'odds',
      'market',
      'price',
    ]) {
      expect(json).not.toContain(`"${field}"`);
    }
  });
});

describe('Phase 5S MLB team quality context CLI mode', () => {
  const fixturePathForQuality = join(
    projectRoot,
    'tests',
    'prospective',
    'fixtures',
    'manual-schedule',
    'valid-weekly-prospective-research-construction-file-artifact-v1.json',
  );

  it('rejects bare --team-quality-context-local with clean JSON error', () => {
    const { stdout, summary } = runResearchExpectingFailure([
      fixturePathForQuality,
      '--team-quality-context-local',
    ]);

    expect(summary).toEqual(
      expect.objectContaining({
        ok: false,
        error: TEAM_QUALITY_CONTEXT_REQUIRES_FIXTURE_EVIDENCE,
      }),
    );
    expect(stdout).not.toContain(projectRoot);
  });

  it('includes teamQualityContextLocal only when explicitly enabled', () => {
    const first = runResearch([
      fixturePathForQuality,
      '--fixture-evidence-local',
      '--team-quality-context-local',
    ]);
    const second = runResearch([
      fixturePathForQuality,
      '--fixture-evidence-local',
      '--team-quality-context-local',
    ]);

    expect(first).toBe(second);
    const summary = JSON.parse(first) as Record<string, unknown>;
    expect(summary.ok).toBe(true);
    expect(summary.teamQualityContextLocal).toBe(true);
  });

  it('keeps default, evidence, aggregate, result-metrics, and schedule-context goldens unchanged', () => {
    const expectedDefault = readFileSync(validStdoutGoldenPath, 'utf8');
    expect(runResearch([fixturePathForQuality])).toBe(expectedDefault);

    const expectedEvidence = readFileSync(
      fixtureEvidenceLocalStdoutGoldenPath,
      'utf8',
    );
    expect(
      runResearch([fixturePathForQuality, '--fixture-evidence-local']),
    ).toBe(expectedEvidence);

    const expectedAggregate = readFileSync(
      aggregateSummariesLocalStdoutGoldenPath,
      'utf8',
    );
    expect(
      runResearch([
        fixturePathForQuality,
        '--fixture-evidence-local',
        '--aggregate-summaries-local',
      ]),
    ).toBe(expectedAggregate);

    const expectedResultMetrics = readFileSync(
      resultAggregateMetricsLocalStdoutGoldenPath,
      'utf8',
    );
    expect(
      runResearch([
        fixturePathForQuality,
        '--fixture-evidence-local',
        '--aggregate-summaries-local',
        '--result-aggregate-metrics-local',
      ]),
    ).toBe(expectedResultMetrics);

    const expectedSchedule = readFileSync(
      teamScheduleContextLocalStdoutGoldenPath,
      'utf8',
    );
    expect(
      runResearch([
        fixturePathForQuality,
        '--fixture-evidence-local',
        '--team-schedule-context-local',
      ]),
    ).toBe(expectedSchedule);
  });

  it('each game includes researchFindings.teamQualityContext only in explicit mode', () => {
    const defaultStdout = runResearch([fixturePathForQuality]);
    const explicitStdout = runResearch([
      fixturePathForQuality,
      '--fixture-evidence-local',
      '--team-quality-context-local',
    ]);

    const defaultSummary = JSON.parse(defaultStdout) as {
      package: { games: Array<{ researchFindings: Record<string, unknown> }> };
    };
    const explicitSummary = JSON.parse(explicitStdout) as {
      package: { games: Array<{ researchFindings: Record<string, unknown> }> };
    };

    for (const game of defaultSummary.package.games) {
      expect(game.researchFindings).not.toHaveProperty('teamQualityContext');
    }

    for (const game of explicitSummary.package.games) {
      expect(game.researchFindings).toHaveProperty('teamQualityContext');
    }
  });

  it('team quality context exposes only TEAM_ONLY scope fields', () => {
    const stdout = runResearch([
      fixturePathForQuality,
      '--fixture-evidence-local',
      '--team-quality-context-local',
    ]);
    const summary = JSON.parse(stdout) as {
      package: {
        games: Array<{
          researchFindings: {
            teamQualityContext: {
              moduleVersion: string;
              moduleName: string;
              scope: string;
              awayTeamQualityContext: Record<string, unknown>;
              homeTeamQualityContext: Record<string, unknown>;
            };
          };
        }>;
      };
    };

    expect(summary.package.games).toHaveLength(2);
    for (const game of summary.package.games) {
      expect(game.researchFindings.teamQualityContext.moduleVersion).toBe(
        TEAM_QUALITY_CONTEXT_MODULE_VERSION,
      );
      expect(game.researchFindings.teamQualityContext.moduleName).toBe(
        TEAM_QUALITY_CONTEXT_MODULE_NAME,
      );
      expect(game.researchFindings.teamQualityContext.scope).toBe(
        TEAM_QUALITY_CONTEXT_SCOPE,
      );
      expect(game.researchFindings.teamQualityContext.awayTeamQualityContext).toBeDefined();
      expect(game.researchFindings.teamQualityContext.homeTeamQualityContext).toBeDefined();
    }
  });

  it('does not expose forbidden fields in team quality context mode', () => {
    const stdout = runResearch([
      fixturePathForQuality,
      '--fixture-evidence-local',
      '--team-quality-context-local',
    ]);

    for (const field of [
      'modelProbability',
      'predictedWinner',
      'pick',
      'finalScore',
      'outcome',
      'completedGameState',
      'finalStatus',
      'actualStartingPitchers',
      'closingOdds',
      'impliedProbability',
      'odds',
      'market',
      'price',
      'winChance',
      'powerRating',
      'teamRank',
      'standingsPosition',
    ]) {
      expect(stdout).not.toContain(`"${field}"`);
    }
    expect(stdout).not.toContain(projectRoot);
    expectNoAbsolutePaths(JSON.parse(stdout));
  });

  it('team-quality explicit mode output is deterministic across repeated runs', () => {
    const first = runResearch([
      fixturePathForQuality,
      '--fixture-evidence-local',
      '--team-quality-context-local',
    ]);
    const second = runResearch([
      fixturePathForQuality,
      '--fixture-evidence-local',
      '--team-quality-context-local',
    ]);

    expect(first).toBe(second);
    expect(JSON.parse(first)).toEqual(JSON.parse(second));
  });
});

describe('buildTeamQualityContext unit tests', () => {
  it('returns deterministic insufficient context when no local records exist', () => {
    const context = buildTeamQualityContext(
      {
        gameId: 'target-1',
        officialDate: '2024-07-05',
        scheduledStartTime: '2024-07-05T19:15:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      [],
    );

    expect(context.moduleVersion).toBe(TEAM_QUALITY_CONTEXT_MODULE_VERSION);
    expect(context.moduleName).toBe(TEAM_QUALITY_CONTEXT_MODULE_NAME);
    expect(context.scope).toBe(TEAM_QUALITY_CONTEXT_SCOPE);
    expect(context.awayTeamQualityContext).toMatchObject({
      status: 'insufficient',
      reason: 'insufficient-local-evidence',
      historicalSampleSizeLabel: 'none',
      qualityContextWarnings: expect.arrayContaining([
        'TEAM_QUALITY_CONTEXT_NO_LOCAL_EVIDENCE',
      ]),
    });
    expect(context.homeTeamQualityContext).toMatchObject({
      status: 'insufficient',
      reason: 'insufficient-local-evidence',
    });
  });

  it('does not list the target game in local records', () => {
    const context = buildTeamQualityContext(
      {
        gameId: 'target-1',
        officialDate: '2024-07-05',
        scheduledStartTime: '2024-07-05T19:15:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      [
        {
          gameId: 'target-1',
          officialDate: '2024-07-05',
          scheduledStartTime: '2024-07-05T19:15:00Z',
          awayTeam: 'AWAY_1',
          homeTeam: 'HOME_1',
        },
      ],
    );

    expect(context.awayTeamQualityContext.status).toBe('insufficient');
    expect(context.homeTeamQualityContext.status).toBe('insufficient');
  });

  it('does not serialize forbidden fields when output is stringified', () => {
    const context = buildTeamQualityContext(
      {
        gameId: 'target-1',
        officialDate: '2024-07-05',
        scheduledStartTime: '2024-07-05T19:15:00Z',
        awayTeam: 'AWAY_1',
        homeTeam: 'HOME_1',
      },
      [
        {
          gameId: 'prev-1',
          officialDate: '2024-07-04',
          scheduledStartTime: '2024-07-04T19:00:00Z',
          awayTeam: 'AWAY_1',
          homeTeam: 'HOME_1',
        },
      ],
    );

    const json = JSON.stringify(context);
    for (const field of [
      'modelProbability',
      'predictedWinner',
      'pick',
      'finalScore',
      'outcome',
      'completedGameState',
      'finalStatus',
      'actualStartingPitchers',
      'closingOdds',
      'impliedProbability',
      'odds',
      'market',
      'price',
      'winChance',
      'powerRating',
      'teamRank',
      'standingsPosition',
    ]) {
      expect(json).not.toContain(`"${field}"`);
    }
  });
});
