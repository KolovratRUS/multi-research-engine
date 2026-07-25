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
      'npm run prospective:mlb:research-team-form -- <construction-package-json>',
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
