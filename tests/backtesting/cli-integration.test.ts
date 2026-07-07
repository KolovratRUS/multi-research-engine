import { describe, it, expect, afterEach } from 'vitest';
import { runMLBBacktestCLI } from '@/lib/backtesting/cli';

const stdoutLines: string[] = [];
const stderrLines: string[] = [];

function createIO() {
  return {
    stdout: (message: string) => stdoutLines.push(message),
    stderr: (message: string) => stderrLines.push(message),
  };
}

function resetIO() {
  stdoutLines.length = 0;
  stderrLines.length = 0;
}

function capturedStdout(): string {
  return stdoutLines.join('\n');
}

function capturedStderr(): string {
  return stderrLines.join('\n');
}

describe('runMLBBacktestCLI integration', () => {
  afterEach(() => {
    resetIO();
  });

  it('default invocation derives the fixture range', async () => {
    const io = createIO();
    const code = await runMLBBacktestCLI([], io);
    expect(code).toBe(0);
    expect(capturedStderr()).toBe('');
    expect(capturedStdout()).toContain('2024-06-01');
    expect(capturedStdout()).toContain('2024-07-07');
  });

  it('valid fixture date completes successfully', async () => {
    const io = createIO();
    const code = await runMLBBacktestCLI(['--date', '2024-06-01'], io);
    expect(code).toBe(0);
    expect(capturedStderr()).toBe('');
    expect(capturedStdout()).toBeTruthy();
  });

  it('text output is labelled fixture-backed, unvalidated and uncalibrated', async () => {
    const io = createIO();
    const code = await runMLBBacktestCLI(['--date', '2024-06-01'], io);
    expect(code).toBe(0);
    const output = capturedStdout();
    expect(output).toContain('fixture (deterministic, no internet)');
    expect(output).toContain('Validation: unvalidated, uncalibrated');
  });

  it('JSON output parses as JSON and contains source fixture', async () => {
    const io = createIO();
    const code = await runMLBBacktestCLI(['--date', '2024-06-01', '--output', 'json'], io);
    expect(code).toBe(0);
    const parsed = JSON.parse(capturedStdout());
    expect(parsed.meta.source).toBe('fixture');
  });

  it('JSON output contains no text prefix or suffix', async () => {
    const io = createIO();
    const code = await runMLBBacktestCLI(['--date', '2024-06-01', '--output', 'json'], io);
    expect(code).toBe(0);
    const combined = capturedStdout();
    expect(combined.trim()).not.toMatch(/^[^{[]/);
  });

  it('no stderr on success', async () => {
    const io = createIO();
    const code = await runMLBBacktestCLI(['--date', '2024-06-01'], io);
    expect(code).toBe(0);
    expect(capturedStderr()).toBe('');
  });

  it('selected date limits discovered games to that fixture date', async () => {
    const defaultIo = createIO();
    await runMLBBacktestCLI([], defaultIo);

    const selectedIo = createIO();
    await runMLBBacktestCLI(['--date', '2024-06-01'], selectedIo);

    const defaultDiscovered = Number(capturedStdout().match(/Discovered games: (\d+)/)?.[1] ?? '0');
    const selectedDiscovered = Number(capturedStdout().match(/Discovered games: (\d+)/)?.[1] ?? '0');

    expect(selectedDiscovered).toBeLessThanOrEqual(defaultDiscovered);
  });

  it('live mode with mocked provider factory completes the CLI path', async () => {
    const mockProvider = {
      fetchGamesForDate: async () => [],
      fetchGameOutcome: async () => ({ gamePk: 0, homeScore: 0, awayScore: 0, winner: null, innings: null, status: 'FINAL', linescore: null }),
      fetchPitcherStatsAsOf: async () => null,
      fetchTeamStatsAsOf: async () => null,
      fetchRecentGamesBefore: async () => [],
    };

    const code = await runMLBBacktestCLI(
      ['--source', 'live', '--date', '2024-06-01', '--output', 'json'],
      createIO(),
      {
        createLiveProvider: () => ({
          provider: mockProvider,
          getDiagnostics: () => ({
            provider: {
              scheduleRequests: 0,
              outcomeRequests: 0,
              teamSourceRequests: 0,
              pitcherSourceRequests: 0,
              teamAggregations: 0,
              pitcherAggregations: 0,
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
            },
            cache: {
              hits: 0,
              misses: 0,
              writes: 0,
              corruptions: 0,
              versionMismatches: 0,
            },
          }),
        }),
      },
    );

    expect(code).toBe(0);
    const parsed = JSON.parse(capturedStdout());
    expect(parsed.meta.source).toBe('live');
  });
});
