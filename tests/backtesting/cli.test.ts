import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  parseMLBBacktestCLIArgs,
  runMLBBacktestCLI,
  type MLBBacktestCLIOptions,
  type CLIBacktestCLIError,
  type MLBBacktestCLIDependencies,
  type LiveCLIDiagnostics,
  type LiveProviderFactoryResultForCLI,
} from '@/lib/backtesting/cli';
import type { BacktestPrediction } from '@/lib/backtesting/types';

const mockStdout: string[] = [];
const mockStderr: string[] = [];

function createIO() {
  return {
    stdout: (message: string) => mockStdout.push(message),
    stderr: (message: string) => mockStderr.push(message),
  };
}

function resetIO() {
  mockStdout.length = 0;
  mockStderr.length = 0;
}

function orchestrateDefaultMockResult() {
  return {
    dateRange: { startDate: '2024-06-01', endDate: '2024-06-01' },
    requestedDates: ['2024-06-01'],
    scheduleRequests: 1,
    discoveredGames: 2,
    uniqueGames: 2,
    duplicateGamesRemoved: 0,
    firstGameStart: new Date('2024-06-01T16:20:00Z'),
    lastGameStart: new Date('2024-06-01T19:05:00Z'),
    games: [],
    runnerResult: {
      predictions: [],
      abstentions: [],
      metrics: {
        predictionsMade: 0,
        gamesSkipped: 0,
        voids: 0,
        accuracy: 0,
        homePickRate: 0,
        awayPickRate: 0,
        accuracyByConfidenceBucket: {},
        accuracyByDataQualityBucket: {},
        accuracyByVolatilityBucket: {},
        accuracyWithBothPitchersKnown: null,
        accuracyWithMissingPitcher: null,
        accuracyByMonth: {},
        naiveHomeBaseline: null,
        naiveRecentBaseline: null,
        naiveSeasonBaseline: null,
      },
    },
  };
}

function createLiveDiagnostics(
  overrides?: {
    provider?: Partial<LiveCLIDiagnostics['provider']>;
    http?: Partial<LiveCLIDiagnostics['http']>;
    cache?: Partial<LiveCLIDiagnostics['cache']>;
  },
): LiveCLIDiagnostics {
  return {
    provider: {
      scheduleRequests: 0,
      outcomeRequests: 0,
      teamSourceRequests: 0,
      pitcherSourceRequests: 0,
      teamAggregations: 0,
      pitcherAggregations: 0,
      ...overrides?.provider,
    },
    http: {
      logicalRequests: 0,
      fetchAttempts: 0,
      successfulResponses: 0,
      httpFailures: 0,
      transportFailures: 0,
      timeouts: 0,
      parseFailures: 0,
      schemaFailures: 0,
      retries: 0,
      byEndpoint: {},
      ...overrides?.http,
    },
    cache: {
      hits: 0,
      misses: 0,
      writes: 0,
      corruptions: 0,
      versionMismatches: 0,
      ...overrides?.cache,
    },
  };
}

type MockBacktestResult = ReturnType<typeof orchestrateDefaultMockResult>;

function buildMockPrediction(warnings: readonly string[] = []): BacktestPrediction {
  return {
    eventId: 'mock-event',
    gamePk: 1,
    eventDate: '2024-06-01',
    homeTeamId: 1,
    awayTeamId: 2,
    homeTeam: 'Home',
    awayTeam: 'Away',
    predictedSide: null,
    researchStrengthScore: 0,
    confidence: 0,
    dataQuality: 3,
    volatility: 'LOW',
    componentScores: {},
    warnings: [...warnings],
    modelVersion: 'test',
    featureVersion: 'test',
    generatedAt: new Date('2024-06-01T00:00:00Z'),
    historicalCutoffTime: new Date('2024-06-01T00:00:00Z'),
    actualWinner: null,
    correct: null,
    voided: false,
    abstained: false,
    homePitcherAvailable: false,
    awayPitcherAvailable: false,
  };
}

function orchestrateMockResultWithRunnerParts(
  predictions: { warnings: string[] }[] = [],
  abstentions: { warnings: string[] }[] = [],
) {
  const basePrediction = buildMockPrediction();
  const baseAbstention: BacktestPrediction = { ...basePrediction, abstained: true, abstentionReason: 'BOTH_PITCHERS_UNAVAILABLE' };

  return {
    dateRange: { startDate: '2024-06-01', endDate: '2024-06-01' },
    requestedDates: ['2024-06-01'],
    scheduleRequests: 1,
    discoveredGames: Math.max(predictions.length, abstentions.length, 2),
    uniqueGames: Math.max(predictions.length, abstentions.length, 2),
    duplicateGamesRemoved: 0,
    firstGameStart: new Date('2024-06-01T16:20:00Z'),
    lastGameStart: new Date('2024-06-01T19:05:00Z'),
    games: [],
    runnerResult: {
      predictions: predictions.map((item) => ({ ...basePrediction, warnings: [...item.warnings] })),
      abstentions: abstentions.map((item) => ({ ...baseAbstention, warnings: [...item.warnings] })),
      metrics: {
        predictionsMade: predictions.length,
        gamesSkipped: 0,
        voids: 0,
        accuracy: 0,
        homePickRate: 0,
        awayPickRate: 0,
        accuracyByConfidenceBucket: {},
        accuracyByDataQualityBucket: {},
        accuracyByVolatilityBucket: {},
        accuracyWithBothPitchersKnown: null,
        accuracyWithMissingPitcher: null,
        accuracyByMonth: {},
        naiveHomeBaseline: null,
        naiveRecentBaseline: null,
        naiveSeasonBaseline: null,
      },
    },
  };
}

const mockProvider = {
  fetchGamesForDate: vi.fn(),
  fetchGameOutcome: vi.fn(),
  fetchPitcherStatsAsOf: vi.fn(),
  fetchTeamStatsAsOf: vi.fn(),
  fetchRecentGamesBefore: vi.fn(),
};

describe('parseMLBBacktestCLIArgs', () => {
  it('defaults to fixture', () => {
    const result = parseMLBBacktestCLIArgs([]);
    if ('code' in result) {
      throw new Error(`Expected success, got: ${result.message}`);
    }
    expect(result.source).toBe('fixture');
    expect(result.output).toBe('text');
    expect(result.help).toBe(false);
  });

  it('defaults to text', () => {
    const result = parseMLBBacktestCLIArgs([]);
    if ('code' in result) {
      throw new Error(`Expected success, got: ${result.message}`);
    }
    expect(result.output).toBe('text');
  });

  it('accepts --date with space', () => {
    const result = parseMLBBacktestCLIArgs(['--date', '2024-06-01']);
    if ('code' in result) {
      throw new Error(`Expected success, got: ${result.message}`);
    }
    expect(result.date).toBe('2024-06-01');
  });

  it('accepts --date with equals', () => {
    const result = parseMLBBacktestCLIArgs(['--date=2024-06-01']);
    if ('code' in result) {
      throw new Error(`Expected success, got: ${result.message}`);
    }
    expect(result.date).toBe('2024-06-01');
  });

  it('accepts --start plus --end', () => {
    const result = parseMLBBacktestCLIArgs(['--start', '2024-06-01', '--end', '2024-06-03']);
    if ('code' in result) {
      throw new Error(`Expected success, got: ${result.message}`);
    }
    expect(result.startDate).toBe('2024-06-01');
    expect(result.endDate).toBe('2024-06-03');
  });

  it('accepts equals syntax for start and end', () => {
    const result = parseMLBBacktestCLIArgs(['--start=2024-06-01', '--end=2024-06-03']);
    if ('code' in result) {
      throw new Error(`Expected success, got: ${result.message}`);
    }
    expect(result.startDate).toBe('2024-06-01');
    expect(result.endDate).toBe('2024-06-03');
  });

  it('accepts --help and -h', () => {
    const helpOpt = parseMLBBacktestCLIArgs(['--help']);
    if ('code' in helpOpt) {
      throw new Error(helpOpt.message);
    }
    const hOpt = parseMLBBacktestCLIArgs(['-h']);
    if ('code' in hOpt) {
      throw new Error(hOpt.message);
    }
    expect(helpOpt.help).toBe(true);
    expect(hOpt.help).toBe(true);
  });

  it('rejects unknown option', () => {
    const result = parseMLBBacktestCLIArgs(['--bogus']);
    expect('code' in result).toBe(true);
    expect((result as CLIBacktestCLIError).code).toBe('UNKNOWN_OPTION');
  });

  it('rejects unknown positional argument', () => {
    const result = parseMLBBacktestCLIArgs(['hello']);
    expect('code' in result).toBe(true);
    expect((result as CLIBacktestCLIError).code).toBe('UNKNOWN_ARGUMENT');
  });

  it('rejects missing value', () => {
    const result = parseMLBBacktestCLIArgs(['--start']);
    expect('code' in result).toBe(true);
    expect((result as CLIBacktestCLIError).code).toBe('MISSING_VALUE');
    expect((result as CLIBacktestCLIError).option).toBe('start');
  });

  it('rejects duplicate option', () => {
    const result = parseMLBBacktestCLIArgs(['--date', '2024-06-01', '--date', '2024-06-02']);
    expect('code' in result).toBe(true);
    expect((result as CLIBacktestCLIError).code).toBe('DUPLICATE_OPTION');
  });

  it('rejects --date combined with --start or --end', () => {
    const startResult = parseMLBBacktestCLIArgs(['--date', '2024-06-01', '--start', '2024-06-01']) as CLIBacktestCLIError;
    expect(startResult.code).toBe('CONFLICTING_OPTIONS');
    const endResult = parseMLBBacktestCLIArgs(['--date', '2024-06-01', '--end', '2024-06-01']) as CLIBacktestCLIError;
    expect(endResult.code).toBe('CONFLICTING_OPTIONS');
  });

  it('rejects --start without --end', () => {
    const result = parseMLBBacktestCLIArgs(['--start', '2024-06-01']);
    expect('code' in result).toBe(true);
    expect((result as CLIBacktestCLIError).code).toBe('MISSING_OPTION');
    expect((result as CLIBacktestCLIError).option).toBe('end');
  });

  it('rejects --end without --start', () => {
    const result = parseMLBBacktestCLIArgs(['--end', '2024-06-01']);
    expect('code' in result).toBe(true);
    expect((result as CLIBacktestCLIError).code).toBe('MISSING_OPTION');
    expect((result as CLIBacktestCLIError).option).toBe('start');
  });

  it('rejects invalid source', () => {
    const result = parseMLBBacktestCLIArgs(['--source', 'bogus']);
    expect('code' in result).toBe(true);
    expect((result as CLIBacktestCLIError).code).toBe('INVALID_SOURCE');
  });

  it('rejects invalid output', () => {
    const result = parseMLBBacktestCLIArgs(['--output', 'bogus']);
    expect('code' in result).toBe(true);
    expect((result as CLIBacktestCLIError).code).toBe('INVALID_OUTPUT');
  });

  it('accepts --cache-root', () => {
    const result = parseMLBBacktestCLIArgs(['--cache-root', '/tmp/cache']);
    if ('code' in result) {
      throw new Error(`Expected success, got: ${result.message}`);
    }
    expect(result.cacheRoot).toBe('/tmp/cache');
  });

  it('accepts --cache-version', () => {
    const result = parseMLBBacktestCLIArgs(['--cache-version', 'v2']);
    if ('code' in result) {
      throw new Error(`Expected success, got: ${result.message}`);
    }
    expect(result.cacheVersion).toBe('v2');
  });

  it('accepts --force-refresh true', () => {
    const result = parseMLBBacktestCLIArgs(['--force-refresh', 'true']);
    if ('code' in result) {
      throw new Error(`Expected success, got: ${result.message}`);
    }
    expect(result.forceRefresh).toBe(true);
  });

  it('accepts --force-refresh false', () => {
    const result = parseMLBBacktestCLIArgs(['--force-refresh', 'false']);
    if ('code' in result) {
      throw new Error(`Expected success, got: ${result.message}`);
    }
    expect(result.forceRefresh).toBe(false);
  });

  it('accepts --timeout-ms', () => {
    const result = parseMLBBacktestCLIArgs(['--timeout-ms', '5000']);
    if ('code' in result) {
      throw new Error(`Expected success, got: ${result.message}`);
    }
    expect(result.timeoutMs).toBe(5000);
  });

  it('accepts --max-retries', () => {
    const result = parseMLBBacktestCLIArgs(['--max-retries', '3']);
    if ('code' in result) {
      throw new Error(`Expected success, got: ${result.message}`);
    }
    expect(result.maxRetries).toBe(3);
  });

  it('rejects blank --cache-root', () => {
    const result = parseMLBBacktestCLIArgs(['--cache-root', '']);
    expect('code' in result).toBe(true);
    expect((result as CLIBacktestCLIError).code).toBe('INVALID_OPTION');
    expect((result as CLIBacktestCLIError).message).toContain('Invalid --cache-root');
  });

  it('rejects blank --cache-version', () => {
    const result = parseMLBBacktestCLIArgs(['--cache-version', '']);
    expect('code' in result).toBe(true);
    expect((result as CLIBacktestCLIError).code).toBe('INVALID_OPTION');
    expect((result as CLIBacktestCLIError).message).toContain('Invalid --cache-version');
  });

  it('rejects invalid --force-refresh', () => {
    const result = parseMLBBacktestCLIArgs(['--force-refresh', 'yes']);
    expect('code' in result).toBe(true);
    expect((result as CLIBacktestCLIError).code).toBe('INVALID_OPTION');
  });

  it('rejects fractional --timeout-ms', () => {
    const result = parseMLBBacktestCLIArgs(['--timeout-ms', '1.5']);
    expect('code' in result).toBe(true);
    expect((result as CLIBacktestCLIError).code).toBe('INVALID_OPTION');
    expect((result as CLIBacktestCLIError).message).toContain('Invalid --timeout-ms');
  });

  it('rejects non-numeric --timeout-ms', () => {
    const result = parseMLBBacktestCLIArgs(['--timeout-ms', 'abc']);
    expect('code' in result).toBe(true);
    expect((result as CLIBacktestCLIError).code).toBe('INVALID_OPTION');
  });

  it('rejects zero --timeout-ms', () => {
    const result = parseMLBBacktestCLIArgs(['--timeout-ms', '0']);
    expect('code' in result).toBe(true);
    expect((result as CLIBacktestCLIError).code).toBe('INVALID_OPTION');
  });

  it('rejects negative --timeout-ms', () => {
    const result = parseMLBBacktestCLIArgs(['--timeout-ms', '-1']);
    expect('code' in result).toBe(true);
    expect((result as CLIBacktestCLIError).code).toBe('INVALID_OPTION');
  });

  it('rejects fractional --max-retries', () => {
    const result = parseMLBBacktestCLIArgs(['--max-retries', '1.5']);
    expect('code' in result).toBe(true);
    expect((result as CLIBacktestCLIError).code).toBe('INVALID_OPTION');
    expect((result as CLIBacktestCLIError).message).toContain('Invalid --max-retries');
  });

  it('rejects non-numeric --max-retries', () => {
    const result = parseMLBBacktestCLIArgs(['--max-retries', 'abc']);
    expect('code' in result).toBe(true);
    expect((result as CLIBacktestCLIError).code).toBe('INVALID_OPTION');
  });

  it('rejects negative --max-retries', () => {
    const result = parseMLBBacktestCLIArgs(['--max-retries', '-1']);
    expect('code' in result).toBe(true);
    expect((result as CLIBacktestCLIError).code).toBe('INVALID_OPTION');
  });
});

describe('runMLBBacktestCLI', () => {
  afterEach(() => {
    resetIO();
  });

  it('help exits 0 without running orchestrator', async () => {
    const deps: MLBBacktestCLIDependencies = {
      orchestrate: vi.fn(),
      buildFixture: vi.fn(),
      createLiveProvider: vi.fn(),
    };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--help'], io, deps);
    expect(code).toBe(0);
    expect(deps.orchestrate).not.toHaveBeenCalled();
    expect(deps.buildFixture).not.toHaveBeenCalled();
    expect(deps.createLiveProvider).not.toHaveBeenCalled();
    expect(mockStdout.length).toBeGreaterThan(0);
    expect(mockStderr.length).toBe(0);
  });

  it('invalid source exits 1 with no construction', async () => {
    const deps: MLBBacktestCLIDependencies = {
      orchestrate: vi.fn(),
      buildFixture: vi.fn(),
      createLiveProvider: vi.fn(),
    };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--source', 'bogus'], io, deps);
    expect(code).toBe(1);
    expect(deps.buildFixture).not.toHaveBeenCalled();
    expect(deps.createLiveProvider).not.toHaveBeenCalled();
    expect(deps.orchestrate).not.toHaveBeenCalled();
    expect(mockStderr.length).toBeGreaterThan(0);
  });

  it('live source exits 1 without running orchestrator or constructing provider', async () => {
    const deps: MLBBacktestCLIDependencies = {
      orchestrate: vi.fn(),
      createLiveProvider: vi.fn(),
    };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--source', 'live'], io, deps);
    expect(code).toBe(1);
    expect(deps.createLiveProvider).not.toHaveBeenCalled();
    expect(deps.orchestrate).not.toHaveBeenCalled();
    expect(mockStderr.length).toBeGreaterThan(0);
  });

  it('invalid args exit 1 with stderr and no stdout', async () => {
    const deps: MLBBacktestCLIDependencies = {
      orchestrate: vi.fn(),
      buildFixture: vi.fn(),
      createLiveProvider: vi.fn(),
    };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--bogus'], io, deps);
    expect(code).toBe(1);
    expect(mockStderr.length).toBeGreaterThan(0);
    expect(mockStdout.length).toBe(0);
  });

  it('fixture mode invokes orchestrator once with selected dates', async () => {
    const mockOrchestrate = vi.fn().mockResolvedValue(orchestrateDefaultMockResult());
    const deps: MLBBacktestCLIDependencies = {
      orchestrate: mockOrchestrate,
    };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--date', '2024-06-01'], io, deps);
    expect(code).toBe(0);
    expect(mockOrchestrate).toHaveBeenCalledTimes(1);
    expect(mockOrchestrate).toHaveBeenCalledWith(
      { startDate: '2024-06-01', endDate: '2024-06-01' },
      expect.objectContaining({ provider: expect.any(Object) }),
    );
  });

  it('passes --start and --end as the date range', async () => {
    const mockOrchestrate = vi.fn().mockResolvedValue(orchestrateDefaultMockResult());
    const deps: MLBBacktestCLIDependencies = {
      orchestrate: mockOrchestrate,
    };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--start', '2024-06-01', '--end', '2024-06-03'], io, deps);
    expect(code).toBe(0);
    expect(mockOrchestrate).toHaveBeenCalledWith(
      { startDate: '2024-06-01', endDate: '2024-06-03' },
      expect.any(Object),
    );
  });

  it('uses fixture-derived range when no date options are supplied', async () => {
    const mockOrchestrate = vi.fn().mockResolvedValue(orchestrateDefaultMockResult());
    const deps: MLBBacktestCLIDependencies = {
      orchestrate: mockOrchestrate,
    };
    const io = createIO();
    const code = await runMLBBacktestCLI([], io, deps);
    expect(code).toBe(0);
    expect(mockOrchestrate).toHaveBeenCalledTimes(1);
    expect(mockOrchestrate).toHaveBeenCalledWith(
      { startDate: '2024-06-01', endDate: '2024-06-24' },
      expect.any(Object),
    );
  });

  it('orchestration failure returns non-zero', async () => {
    const mockOrchestrate = vi.fn().mockRejectedValue(
      new Error('Orchestration failed: Invalid date'),
    );
    const deps: MLBBacktestCLIDependencies = {
      orchestrate: mockOrchestrate,
    };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--date', '2024-02-30'], io, deps);
    expect(code).toBe(1);
    expect(mockStderr.length).toBeGreaterThan(0);
  });

  it('text output goes to stdout and contains fixture metadata', async () => {
    const mockOrchestrate = vi.fn().mockResolvedValue(orchestrateDefaultMockResult());
    const deps: MLBBacktestCLIDependencies = {
      orchestrate: mockOrchestrate,
    };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--date', '2024-06-01', '--output', 'text'], io, deps);
    expect(code).toBe(0);
    expect(mockStdout.length).toBeGreaterThan(0);
    const output = mockStdout.join('\n');
    expect(output).toContain('MLB Historical Backtest — Fixture Mode');
    expect(output).toContain('2024-06-01');
    expect(output).toContain('Schedule requests: 1');
    expect(output).toContain('Discovered games: 2');
    expect(output).not.toMatch(/Provider calls:|HTTP:|HTTP outcomes:|Cache:/);
  });

  it('JSON output is valid and contains no non-JSON prefix or suffix', async () => {
    const mockOrchestrate = vi.fn().mockResolvedValue(orchestrateDefaultMockResult());
    const deps: MLBBacktestCLIDependencies = {
      orchestrate: mockOrchestrate,
    };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--date', '2024-06-01', '--output', 'json'], io, deps);
    expect(code).toBe(0);
    expect(mockStdout.length).toBe(1);
    const parsed = JSON.parse(mockStdout[0]);
    expect(parsed).toEqual(
      expect.objectContaining({
        meta: expect.objectContaining({ source: 'fixture', validation: 'unvalidated', calibration: 'uncalibrated' }),
        orchestration: expect.objectContaining({ scheduleRequests: 1, discoveredGames: 2 }),
      }),
    );
    expect(parsed.provider).toBeUndefined();
    expect(parsed.http).toBeUndefined();
    expect(parsed.cache).toBeUndefined();
  });

  it('success produces no stderr output', async () => {
    const mockOrchestrate = vi.fn().mockResolvedValue(orchestrateDefaultMockResult());
    const deps: MLBBacktestCLIDependencies = {
      orchestrate: mockOrchestrate,
    };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--date', '2024-06-01'], io, deps);
    expect(code).toBe(0);
    expect(mockStderr.length).toBe(0);
    expect(mockStdout.length).toBeGreaterThan(0);
  });

  it('live source with date invokes live provider exactly once and orchestrator once', async () => {
    const mockProvider = {
      fetchGamesForDate: vi.fn(),
      fetchGameOutcome: vi.fn(),
      fetchPitcherStatsAsOf: vi.fn(),
      fetchTeamStatsAsOf: vi.fn(),
      fetchRecentGamesBefore: vi.fn(),
    };

    const createLiveProvider = vi.fn().mockReturnValue({
      provider: mockProvider,
      getDiagnostics: () => createLiveDiagnostics(),
    });

    const mockOrchestrate = vi.fn().mockResolvedValue(orchestrateDefaultMockResult());
    const deps: MLBBacktestCLIDependencies = {
      orchestrate: mockOrchestrate,
      createLiveProvider,
    };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--source', 'live', '--date', '2024-06-01'], io, deps);
    expect(code).toBe(0);
    expect(createLiveProvider).toHaveBeenCalledTimes(1);
    expect(mockOrchestrate).toHaveBeenCalledTimes(1);
    expect(mockOrchestrate).toHaveBeenCalledWith(
      { startDate: '2024-06-01', endDate: '2024-06-01' },
      expect.objectContaining({ provider: mockProvider }),
    );
  });

  it('live source with start and end invokes orchestrator once', async () => {
    const mockProvider = {
      fetchGamesForDate: vi.fn(),
      fetchGameOutcome: vi.fn(),
      fetchPitcherStatsAsOf: vi.fn(),
      fetchTeamStatsAsOf: vi.fn(),
      fetchRecentGamesBefore: vi.fn(),
    };

    const createLiveProvider = vi.fn().mockReturnValue({
      provider: mockProvider,
      getDiagnostics: () => createLiveDiagnostics(),
    });

    const mockOrchestrate = vi.fn().mockResolvedValue(orchestrateDefaultMockResult());
    const deps: MLBBacktestCLIDependencies = {
      orchestrate: mockOrchestrate,
      createLiveProvider,
    };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--source', 'live', '--start', '2024-06-01', '--end', '2024-06-03'], io, deps);
    expect(code).toBe(0);
    expect(mockOrchestrate).toHaveBeenCalledWith(
      { startDate: '2024-06-01', endDate: '2024-06-03' },
      expect.any(Object),
    );
  });

  it('live mode text output contains live metadata', async () => {
    const mockProvider = {
      fetchGamesForDate: vi.fn(),
      fetchGameOutcome: vi.fn(),
      fetchPitcherStatsAsOf: vi.fn(),
      fetchTeamStatsAsOf: vi.fn(),
      fetchRecentGamesBefore: vi.fn(),
    };

    const createLiveProvider = vi.fn().mockReturnValue({
      provider: mockProvider,
      getDiagnostics: () => createLiveDiagnostics(),
    });

    const mockOrchestrate = vi.fn().mockResolvedValue(orchestrateDefaultMockResult());
    const deps: MLBBacktestCLIDependencies = {
      orchestrate: mockOrchestrate,
      createLiveProvider,
    };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--source', 'live', '--date', '2024-06-01', '--output', 'text'], io, deps);
    expect(code).toBe(0);
    const output = mockStdout.join('\n');
    expect(output).toContain('Live Historical Mode');
    expect(output).toContain('Source: live (historical MLB Stats API)');
    expect(output).toContain('Provider calls:');
    expect(output).toContain('HTTP:');
    expect(output).toContain('HTTP outcomes:');
    expect(output).toContain('Cache:');
  });

  it('live mode JSON output contains source live', async () => {
    const mockProvider = {
      fetchGamesForDate: vi.fn(),
      fetchGameOutcome: vi.fn(),
      fetchPitcherStatsAsOf: vi.fn(),
      fetchTeamStatsAsOf: vi.fn(),
      fetchRecentGamesBefore: vi.fn(),
    };

    const createLiveProvider = vi.fn().mockReturnValue({
      provider: mockProvider,
      getDiagnostics: () =>
        createLiveDiagnostics({
          provider: {
            scheduleRequests: 3,
            outcomeRequests: 1,
            teamSourceRequests: 2,
            pitcherSourceRequests: 2,
            teamAggregations: 1,
            pitcherAggregations: 1,
          },
          http: {
            logicalRequests: 4,
            fetchAttempts: 4,
            successfulResponses: 4,
            httpFailures: 0,
            transportFailures: 0,
            timeouts: 0,
            parseFailures: 0,
            schemaFailures: 0,
            retries: 0,
            byEndpoint: {
              '/api/v1/schedule': {
                logicalRequests: 1,
                fetchAttempts: 1,
                successfulResponses: 1,
                httpFailures: 0,
                transportFailures: 0,
                timeouts: 0,
                parseFailures: 0,
                schemaFailures: 0,
                retries: 0,
              },
              '/api/v1.1/game/{gamePk}/feed/live': {
                logicalRequests: 3,
                fetchAttempts: 3,
                successfulResponses: 3,
                httpFailures: 0,
                transportFailures: 0,
                timeouts: 0,
                parseFailures: 0,
                schemaFailures: 0,
                retries: 0,
              },
            },
          },
          cache: {
            hits: 0,
            misses: 4,
            writes: 4,
            corruptions: 0,
            versionMismatches: 0,
          },
        }),
    });

    const mockOrchestrate = vi.fn().mockResolvedValue(orchestrateDefaultMockResult());
    const deps: MLBBacktestCLIDependencies = {
      orchestrate: mockOrchestrate,
      createLiveProvider,
    };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--source', 'live', '--date', '2024-06-01', '--output', 'json'], io, deps);
    expect(code).toBe(0);
    expect(mockStdout.length).toBe(1);
    const parsed = JSON.parse(mockStdout[0]);
    expect(parsed.meta.source).toBe('live');
    expect(parsed.provider).toEqual({
      scheduleRequests: 3,
      outcomeRequests: 1,
      teamSourceRequests: 2,
      pitcherSourceRequests: 2,
      teamAggregations: 1,
      pitcherAggregations: 1,
    });
    expect(parsed.http).toEqual({
      logicalRequests: 4,
      fetchAttempts: 4,
      successfulResponses: 4,
      httpFailures: 0,
      transportFailures: 0,
      timeouts: 0,
      parseFailures: 0,
      schemaFailures: 0,
      retries: 0,
      byEndpoint: {
        '/api/v1/schedule': {
          logicalRequests: 1,
          fetchAttempts: 1,
          successfulResponses: 1,
          httpFailures: 0,
          transportFailures: 0,
          timeouts: 0,
          parseFailures: 0,
          schemaFailures: 0,
          retries: 0,
        },
        '/api/v1.1/game/{gamePk}/feed/live': {
          logicalRequests: 3,
          fetchAttempts: 3,
          successfulResponses: 3,
          httpFailures: 0,
          transportFailures: 0,
          timeouts: 0,
          parseFailures: 0,
          schemaFailures: 0,
          retries: 0,
        },
      },
    });
    expect(parsed.cache).toEqual({
      hits: 0,
      misses: 4,
      writes: 4,
      corruptions: 0,
      versionMismatches: 0,
    });
  });

  it('fixture mode never calls createLiveProvider', async () => {
    const mockCreateLiveProvider = vi.fn().mockReturnValue({ provider: mockProvider });
    const deps: MLBBacktestCLIDependencies = {
      createLiveProvider: mockCreateLiveProvider,
    };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--date', '2024-06-01'], io, deps);
    expect(code).toBe(0);
    expect(mockCreateLiveProvider).not.toHaveBeenCalled();
  });

  it('live mode never calls buildFixture', async () => {
    const mockBuildFixture = vi.fn().mockReturnValue({
      recentWinRates: {},
      seasonWinRates: {},
      pitcherProfiles: {},
      teamProfiles: {},
      recentTeamGames: {},
      intentionallyMissingPitcherProfileIds: [],
    });
    const createLiveProvider = vi.fn().mockReturnValue({
      provider: mockProvider,
      getDiagnostics: () => createLiveDiagnostics(),
    });
    const mockOrchestrate = vi.fn().mockResolvedValue(orchestrateDefaultMockResult());
    const deps: MLBBacktestCLIDependencies = {
      buildFixture: mockBuildFixture,
      createLiveProvider,
      orchestrate: mockOrchestrate,
    };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--source', 'live', '--date', '2024-06-01'], io, deps);
    expect(code).toBe(0);
    expect(mockBuildFixture).not.toHaveBeenCalled();
  });

  it('live without date/range rejects before live provider construction', async () => {
    const createLiveProvider = vi.fn().mockReturnValue({
      provider: mockProvider,
      getDiagnostics: () => createLiveDiagnostics(),
    });
    const mockOrchestrate = vi.fn().mockResolvedValue(orchestrateDefaultMockResult());
    const deps: MLBBacktestCLIDependencies = {
      orchestrate: mockOrchestrate,
      createLiveProvider,
    };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--source', 'live'], io, deps);
    expect(code).toBe(1);
    expect(createLiveProvider).not.toHaveBeenCalled();
    expect(mockOrchestrate).not.toHaveBeenCalled();
    expect(mockStderr.length).toBeGreaterThan(0);
  });

  it('invalid inputs construct nothing', async () => {
    const createLiveProvider = vi.fn().mockReturnValue({
      provider: mockProvider,
      getDiagnostics: () => createLiveDiagnostics(),
    });
    const deps: MLBBacktestCLIDependencies = {
      createLiveProvider,
    };
    const io = createIO();

    const cases: string[][] = [
      ['--source', 'live'],
      ['--source', 'live', '--cache-root', ''],
      ['--source', 'live', '--date', '2024-06-01', '--cache-version', ''],
      ['--source', 'live', '--date', '2024-06-01', '--timeout-ms', '0'],
      ['--source', 'live', '--date', '2024-06-01', '--timeout-ms', '1.5'],
      ['--source', 'live', '--date', '2024-06-01', '--timeout-ms', '-1'],
      ['--source', 'live', '--date', '2024-06-01', '--max-retries', '-1'],
      ['--source', 'live', '--date', '2024-06-01', '--max-retries', '1.5'],
      ['--source', 'live', '--date', '2024-06-01', '--force-refresh', 'maybe'],
    ];

    for (const args of cases) {
      mockStdout.length = 0;
      mockStderr.length = 0;
      const code = await runMLBBacktestCLI(args, io, deps);
      expect(code).toBe(1);
      if (createLiveProvider.mock.calls.length > 0) {
        // reset call history between iterations to keep assertion clean
        createLiveProvider.mockClear();
      }
      expect(createLiveProvider).not.toHaveBeenCalled();
    }
  });

  it('one live provider reused across entire run', async () => {
    const mockProvider = {
      fetchGamesForDate: vi.fn(),
      fetchGameOutcome: vi.fn(),
      fetchPitcherStatsAsOf: vi.fn(),
      fetchTeamStatsAsOf: vi.fn(),
      fetchRecentGamesBefore: vi.fn(),
    };

    const createLiveProvider = vi.fn().mockReturnValue({
      provider: mockProvider,
      getDiagnostics: () => createLiveDiagnostics(),
    });

    const mockOrchestrate = vi.fn().mockResolvedValue(orchestrateDefaultMockResult());
    const deps: MLBBacktestCLIDependencies = {
      orchestrate: mockOrchestrate,
      createLiveProvider,
    };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--source', 'live', '--date', '2024-06-01'], io, deps);
    expect(code).toBe(0);
    expect(createLiveProvider).toHaveBeenCalledTimes(1);
    expect(mockOrchestrate).toHaveBeenCalledTimes(1);
    const contextArg = mockOrchestrate.mock.calls[0][1];
    expect(contextArg.provider).toBe(mockProvider);
  });

  it('production factory options exactly match expected values', async () => {
    const mockProvider = {
      fetchGamesForDate: vi.fn(),
      fetchGameOutcome: vi.fn(),
      fetchPitcherStatsAsOf: vi.fn(),
      fetchTeamStatsAsOf: vi.fn(),
      fetchRecentGamesBefore: vi.fn(),
    };

    const createLiveProvider = vi.fn().mockReturnValue({
      provider: mockProvider,
      getDiagnostics: () => createLiveDiagnostics(),
    });

    const mockOrchestrate = vi.fn().mockResolvedValue(orchestrateDefaultMockResult());
    const deps: MLBBacktestCLIDependencies = {
      orchestrate: mockOrchestrate,
      createLiveProvider,
    };
    const io = createIO();
    const code = await runMLBBacktestCLI(
      [
        '--source', 'live', '--date', '2024-06-01',
        '--cache-root', '/custom-cache',
        '--cache-version', 'semver',
        '--force-refresh',
        '--timeout-ms', '5000',
        '--max-retries', '3',
      ], io, deps);
    expect(code).toBe(0);
    expect(createLiveProvider).toHaveBeenCalledWith({
      cacheRoot: '/custom-cache',
      cacheVersion: 'semver',
      forceRefresh: true,
      timeoutMs: 5000,
      maxRetries: 3,
    });
  });

  it('injected now is passed only when provided', async () => {
    const mockProvider = {
      fetchGamesForDate: vi.fn(),
      fetchGameOutcome: vi.fn(),
      fetchPitcherStatsAsOf: vi.fn(),
      fetchTeamStatsAsOf: vi.fn(),
      fetchRecentGamesBefore: vi.fn(),
    };

    const createLiveProvider = vi.fn().mockReturnValue({
      provider: mockProvider,
      getDiagnostics: () => createLiveDiagnostics(),
    });

    const mockOrchestrate = vi.fn().mockResolvedValue(orchestrateDefaultMockResult());
    const deps: MLBBacktestCLIDependencies = {
      orchestrate: mockOrchestrate,
      createLiveProvider,
      now: () => new Date('2024-01-25T00:00:00Z'),
    };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--source', 'live', '--date', '2024-06-01'], io, deps);
    expect(code).toBe(0);
    expect(createLiveProvider).toHaveBeenCalledTimes(1);
    const calledWith = createLiveProvider.mock.calls[0][0];
    expect(calledWith.now).toBeInstanceOf(Function);
    expect(calledWith.now()).toEqual(new Date('2024-01-25T00:00:00Z'));
  });

  it('omits now when dependency not injected', async () => {
    const mockProvider = {
      fetchGamesForDate: vi.fn(),
      fetchGameOutcome: vi.fn(),
      fetchPitcherStatsAsOf: vi.fn(),
      fetchTeamStatsAsOf: vi.fn(),
      fetchRecentGamesBefore: vi.fn(),
    };

    const createLiveProvider = vi.fn().mockReturnValue({
      provider: mockProvider,
      getDiagnostics: () => createLiveDiagnostics(),
    });

    const mockOrchestrate = vi.fn().mockResolvedValue(orchestrateDefaultMockResult());
    const deps: MLBBacktestCLIDependencies = {
      orchestrate: mockOrchestrate,
      createLiveProvider,
    };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--source', 'live', '--date', '2024-06-01'], io, deps);
    expect(code).toBe(0);
    const calledWith = createLiveProvider.mock.calls[0][0];
    expect(calledWith.now).toBeUndefined();
  });

  it('warningCount counts occurrences from predictions and abstentions in JSON output', async () => {
    const mockOrchestrate = vi.fn().mockResolvedValue(
      orchestrateMockResultWithRunnerParts(
        [{ warnings: ['p-warn-1'] }, { warnings: ['p-warn-1', 'p-warn-2'] }],
        [{ warnings: ['a-warn'] }],
      ),
    );

    const deps: MLBBacktestCLIDependencies = { orchestrate: mockOrchestrate };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--date', '2024-06-01', '--output', 'json'], io, deps);
    expect(code).toBe(0);
    const parsed = JSON.parse(mockStdout[0]);
    expect(parsed.runner.warningCount).toBe(4);
  });

  it('warningCount treats duplicate warning strings across abstentions as separate occurrences', async () => {
    const mockOrchestrate = vi.fn().mockResolvedValue(
      orchestrateMockResultWithRunnerParts([], [
        { warnings: ['same-warning'] },
        { warnings: ['same-warning'] },
        { warnings: [] },
      ]),
    );

    const deps: MLBBacktestCLIDependencies = { orchestrate: mockOrchestrate };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--date', '2024-06-01', '--output', 'text'], io, deps);
    expect(code).toBe(0);
    const output = mockStdout.join('\n');
    expect(output).toContain('Warning count: 2');
  });

  it('warningCount is zero when no warnings exist', async () => {
    const mockOrchestrate = vi.fn().mockResolvedValue(
      orchestrateMockResultWithRunnerParts(
        [{ warnings: [] }],
        [{ warnings: [] }],
      ),
    );

    const deps: MLBBacktestCLIDependencies = { orchestrate: mockOrchestrate };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--date', '2024-06-01', '--output', 'json'], io, deps);
    expect(code).toBe(0);
    const parsed = JSON.parse(mockStdout[0]);
    expect(parsed.runner.warningCount).toBe(0);
  });

  it('warningCount falls back to abstention-only warnings when predictions are empty', async () => {
    const mockOrchestrate = vi.fn().mockResolvedValue(
      orchestrateMockResultWithRunnerParts([], [
        { warnings: ['abstention-warning'] },
      ]),
    );

    const deps: MLBBacktestCLIDependencies = { orchestrate: mockOrchestrate };
    const io = createIO();
    const code = await runMLBBacktestCLI(['--date', '2024-06-01', '--output', 'json'], io, deps);
    expect(code).toBe(0);
    const parsed = JSON.parse(mockStdout[0]);
    expect(parsed.predictions).toHaveLength(0);
    expect(parsed.abstentions).toHaveLength(1);
    expect(parsed.runner.warningCount).toBe(1);
  });
});
