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
} from '@/prospective/mlb/team-recent-form-aggregate-summary';

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
      'npm run prospective:mlb:research-team-form -- <construction-package-json> [--fixture-evidence-local] [--aggregate-summaries-local]',
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
