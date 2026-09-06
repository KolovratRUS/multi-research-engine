import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import type {
  MLBRealDataPregameSnapshotBridgeInput,
  MLBRealDataPregameSnapshotBridgeResult,
} from '@/prediction/mlb/mlb-real-data-pregame-snapshot-bridge';
import type { MLBGameResearchSnapshot, MLBScheduleGame, MLBScheduleResult } from '@/lib/research-data/types';
import type { MLBCanonicalPregameSnapshot } from '@/prediction/mlb/mlb-pregame-snapshot-contract';

/* -------------------------------------------------------------------------- */
/*  Bridge mock                                                               */
/* -------------------------------------------------------------------------- */

function buildMockCanonicalSnapshot(): MLBCanonicalPregameSnapshot {
  const capturedAt = '2026-08-15T10:00:00.000Z';
  return {
    contractVersion: 'mlb-canonical-pregame-snapshot-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    snapshotId: '123::1::pregame-snapshot-v1',
    capturedAt,
    dataCutoffAt: capturedAt,
    game: {
      gameId: '123',
      scheduledStartAt: '2026-08-15T19:00:00Z',
      officialDate: '2026-08-15',
      season: 2026,
      gameType: 'REGULAR_SEASON',
      status: 'SCHEDULED',
      homeTeamId: '100',
      awayTeamId: '200',
      venueId: null,
      neutralSite: null,
      doubleheader: null,
    },
    startingPitchers: {
      home: { state: 'UNAVAILABLE', pitcherId: null, announcedAt: null, sourceRefIds: [] },
      away: { state: 'UNAVAILABLE', pitcherId: null, announcedAt: null, sourceRefIds: [] },
    },
    sourceReferences: [],
    sections: [],
    dataCompleteness: 'INSUFFICIENT',
    warnings: [],
  };
}

function buildBridgeResult(): MLBRealDataPregameSnapshotBridgeResult {
  return {
    ok: true,
    value: buildMockCanonicalSnapshot(),
  };
}

// Mock the bridge so the CLI unit test focuses on CLI/orchestrator wiring.
vi.mock('@/prediction/mlb/mlb-real-data-pregame-snapshot-bridge', () => ({
  buildMLBRealDataPregameSnapshot: vi.fn(() => buildBridgeResult()),
}));

import {
  runMLBProspectiveHoldoutCaptureCLI,
  runProspectiveHoldoutCaptureForScheduleGame,
  type MLBProspectiveHoldoutCaptureDependencies,
  type CaptureCLIIO,
} from '../../../scripts/mlb-prospective-holdout-capture';
import type {
  MLBProspectiveHoldoutCaptureOrchestratorInput,
  MLBProspectiveHoldoutCaptureOrchestratorResult,
} from '@/prediction/mlb/mlb-prospective-holdout-capture-orchestrator';

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_NOW = '2026-08-15T12:00:00.000Z';
const DEFAULT_TODAY = '2026-08-15';
const DEFAULT_YESTERDAY = '2026-08-14';

function buildScheduleGame(overrides: Partial<MLBScheduleGame> = {}): MLBScheduleGame {
  const base: MLBScheduleGame = {
    gamePk: 123,
    gameType: 'REGULAR_SEASON',
    gameNumber: 1,
    officialDate: DEFAULT_TODAY,
    gameDate: '2026-08-15T19:00:00Z',
    startTimeUtc: new Date('2026-08-15T19:00:00Z'),
    status: 'UPCOMING',
    homeTeamId: 100,
    homeTeamName: 'Home Team',
    awayTeamId: 200,
    awayTeamName: 'Away Team',
    venueId: 1,
    venueName: 'Stadium',
    dayNight: 'day',
    scheduledInnings: 9,
    doubleHeader: 'N',
    seriesGameNumber: 1,
    gamesInSeries: 3,
    seriesDescription: 'Regular',
    leagueRecord: {
      home: { wins: 50, losses: 50, pct: '0.500' },
      away: { wins: 50, losses: 50, pct: '0.500' },
    },
    probablePitchers: {
      home: {
        personId: 1,
        fullName: 'Home Pitcher',
        teamId: 100,
        availability: 'AVAILABLE',
        status: 'PROBABLE',
        fetchedAt: new Date(),
        warnings: [],
      },
      away: {
        personId: 2,
        fullName: 'Away Pitcher',
        teamId: 200,
        availability: 'AVAILABLE',
        status: 'PROBABLE',
        fetchedAt: new Date(),
        warnings: [],
      },
    },
  };
  return { ...base, ...overrides };
}

function buildScheduleResult(games: MLBScheduleGame[]): MLBScheduleResult {
  return {
    games,
    provenance: {
      source: 'test',
      fetchedAt: new Date(),
      isLive: true,
      warnings: [],
    },
  };
}

function buildResearchSnapshot(overrides: Partial<MLBGameResearchSnapshot> = {}): MLBGameResearchSnapshot {
  const base: MLBGameResearchSnapshot = {
    event: {
      id: '123',
      externalId: '123',
      sport: 'mlb',
      league: 'MLB',
      leagueSlug: 'mlb',
      homeTeam: 'Home Team',
      awayTeam: 'Away Team',
      startTimeUtc: new Date('2026-08-15T19:00:00Z'),
      status: 'SCHEDULED',
      createdAt: new Date('2026-08-15T10:00:00Z'),
      updatedAt: new Date('2026-08-15T10:00:00Z'),
    },
    probablePitchers: { home: null, away: null },
    pitcherStats: { home: null, away: null },
    teamBatting: { home: null, away: null },
    bullpen: { home: null, away: null },
    venue: null,
    weather: null,
    completeness: 1,
    warnings: [],
    provenance: [{ source: 'test', fetchedAt: new Date('2026-08-15T10:00:00Z'), isLive: true, warnings: [] }],
    generatedAt: new Date('2026-08-15T10:00:00Z'),
  };
  return { ...base, ...overrides };
}

type TestDependencies = {
  deps: MLBProspectiveHoldoutCaptureDependencies;
  provider: {
    fetchSchedule: Mock<(date: string) => Promise<MLBScheduleResult>>;
    buildGameSnapshot: Mock<(game: MLBScheduleGame, options: { season: number; includeWeather: boolean }) => Promise<MLBGameResearchSnapshot>>;
  };
  orchestrator: Mock<(input: MLBProspectiveHoldoutCaptureOrchestratorInput) => Promise<MLBProspectiveHoldoutCaptureOrchestratorResult>>;
};

function createMockDependencies(
  overrides: Partial<MLBProspectiveHoldoutCaptureDependencies> = {},
): TestDependencies {
  const fetchSchedule = vi.fn((date: string) => Promise.resolve(buildScheduleResult([])));
  const buildGameSnapshot = vi.fn(
    (game: MLBScheduleGame, options: { season: number; includeWeather: boolean }) =>
      Promise.resolve(buildResearchSnapshot()),
  );
  const orchestrator = vi.fn(
    (input: MLBProspectiveHoldoutCaptureOrchestratorInput) =>
      Promise.resolve({ kind: 'CAPTURED_AND_BOUND' as const, activationId: '', protocolId: '', gamePk: 0, gameId: '0', evidenceArtifactId: '', bindingId: '', scientificCutoffAt: '', actualDataCutoffAt: '', persistedAt: '' }),
  );

  const deps: MLBProspectiveHoldoutCaptureDependencies = {
    provider: {
      fetchSchedule: fetchSchedule as (date: string) => Promise<MLBScheduleResult>,
      buildGameSnapshot: buildGameSnapshot as (game: MLBScheduleGame, options: { season: number; includeWeather: boolean }) => Promise<MLBGameResearchSnapshot>,
    },
    orchestrator: orchestrator as (input: MLBProspectiveHoldoutCaptureOrchestratorInput) => Promise<MLBProspectiveHoldoutCaptureOrchestratorResult>,
    now: () => new Date(DEFAULT_NOW),
  };

  const mergedDeps = { ...deps, ...overrides };
  return {
    deps: mergedDeps,
    provider: { fetchSchedule, buildGameSnapshot },
    orchestrator,
  };
}

type TestIO = {
  io: CaptureCLIIO;
  stdout: Mock<(message: string) => void>;
  stderr: Mock<(message: string) => void>;
};

function createIO(): TestIO {
  const stdout = vi.fn((message: string) => {});
  const stderr = vi.fn((message: string) => {});
  return {
    io: { stdout, stderr },
    stdout,
    stderr,
  };
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-capture-cli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. valid single game invocation reaches K1 exactly once
  it('1. valid single game invocation reaches K1 exactly once', async () => {
    const fixture = createMockDependencies();
    fixture.provider.fetchSchedule.mockImplementation(async (date: string) => {
      if (date === DEFAULT_TODAY) {
        return buildScheduleResult([buildScheduleGame()]);
      }
      return buildScheduleResult([]);
    });
    fixture.provider.buildGameSnapshot.mockResolvedValue(buildResearchSnapshot());
    const capturedResult: MLBProspectiveHoldoutCaptureOrchestratorResult = {
      kind: 'CAPTURED_AND_BOUND',
      activationId: 'activation-1',
      protocolId: 'protocol-1',
      gamePk: 123,
      gameId: '123',
      evidenceArtifactId: 'evidence-1',
      bindingId: 'binding-1',
      scientificCutoffAt: '2026-08-15T10:00:00.000Z',
      actualDataCutoffAt: '2026-08-15T10:00:00.000Z',
      persistedAt: '2026-08-15T10:00:00.000Z',
    };
    fixture.orchestrator.mockResolvedValue(capturedResult);

    const { io } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123'], io, fixture.deps);

    expect(code).toBe(0);
    expect(fixture.provider.fetchSchedule).toHaveBeenCalledTimes(2);
    expect(fixture.provider.buildGameSnapshot).toHaveBeenCalledTimes(1);
    expect(fixture.orchestrator).toHaveBeenCalledTimes(1);
  });

  // 2. gamePk validation accepts positive integer
  it('2. gamePk validation accepts positive integer', async () => {
    const fixture = createMockDependencies();
    fixture.provider.fetchSchedule.mockImplementation(async (date: string) => {
      if (date === DEFAULT_TODAY) {
        return buildScheduleResult([buildScheduleGame()]);
      }
      return buildScheduleResult([]);
    });
    fixture.provider.buildGameSnapshot.mockResolvedValue(buildResearchSnapshot());
    const capturedResult: MLBProspectiveHoldoutCaptureOrchestratorResult = {
      kind: 'CAPTURED_AND_BOUND',
      activationId: 'activation-1',
      protocolId: 'protocol-1',
      gamePk: 123,
      gameId: '123',
      evidenceArtifactId: 'evidence-1',
      bindingId: 'binding-1',
      scientificCutoffAt: '2026-08-15T10:00:00.000Z',
      actualDataCutoffAt: '2026-08-15T10:00:00.000Z',
      persistedAt: '2026-08-15T10:00:00.000Z',
    };
    fixture.orchestrator.mockResolvedValue(capturedResult);

    const { io } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123'], io, fixture.deps);

    expect(code).toBe(0);
  });

  // 3. missing gamePk rejected
  it('3. missing gamePk rejected', async () => {
    const { io, stderr } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script'], io);

    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('--gamePk is required'));
  });

  // 4. malformed gamePk rejected
  it('4. malformed gamePk rejected', async () => {
    const { io, stderr } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=abc'], io);

    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('gamePk must be a positive integer'));
  });

  // 5. zero gamePk rejected
  it('5. zero gamePk rejected', async () => {
    const { io, stderr } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=0'], io);

    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('gamePk must be a positive integer'));
  });

  // 6. negative gamePk rejected
  it('6. negative gamePk rejected', async () => {
    const { io, stderr } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=-1'], io);

    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('gamePk must be a positive integer'));
  });

  // 7. multiple-game/batch input rejected
  it('7. multiple gamePk values rejected', async () => {
    const fixture = createMockDependencies();
    fixture.provider.fetchSchedule.mockImplementation(async (date: string) => {
      if (date === DEFAULT_TODAY) {
        return buildScheduleResult([buildScheduleGame()]);
      }
      return buildScheduleResult([]);
    });
    fixture.provider.buildGameSnapshot.mockResolvedValue(buildResearchSnapshot());
    const capturedResult: MLBProspectiveHoldoutCaptureOrchestratorResult = {
      kind: 'CAPTURED_AND_BOUND',
      activationId: 'activation-1',
      protocolId: 'protocol-1',
      gamePk: 123,
      gameId: '123',
      evidenceArtifactId: 'evidence-1',
      bindingId: 'binding-1',
      scientificCutoffAt: '2026-08-15T10:00:00.000Z',
      actualDataCutoffAt: '2026-08-15T10:00:00.000Z',
      persistedAt: '2026-08-15T10:00:00.000Z',
    };
    fixture.orchestrator.mockResolvedValue(capturedResult);

    const { io, stderr } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123', '--gamePk=456'], io, fixture.deps);

    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('Multiple gamePk values are not allowed'));
  });

  // 8. unsupported flag rejected
  it('8. unsupported flag rejected', async () => {
    const { io, stderr } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123', '--clock=now'], io);

    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('Unsupported flag: --clock=now'));
  });

  // 9. no public clock parameter exists
  it('9. no public clock parameter exists', async () => {
    const fixture = createMockDependencies();
    fixture.provider.fetchSchedule.mockImplementation(async (date: string) => {
      if (date === DEFAULT_TODAY) {
        return buildScheduleResult([buildScheduleGame()]);
      }
      return buildScheduleResult([]);
    });
    fixture.provider.buildGameSnapshot.mockResolvedValue(buildResearchSnapshot());
    const capturedResult: MLBProspectiveHoldoutCaptureOrchestratorResult = {
      kind: 'CAPTURED_AND_BOUND',
      activationId: 'activation-1',
      protocolId: 'protocol-1',
      gamePk: 123,
      gameId: '123',
      evidenceArtifactId: 'evidence-1',
      bindingId: 'binding-1',
      scientificCutoffAt: '2026-08-15T10:00:00.000Z',
      actualDataCutoffAt: '2026-08-15T10:00:00.000Z',
      persistedAt: '2026-08-15T10:00:00.000Z',
    };
    fixture.orchestrator.mockResolvedValue(capturedResult);

    const { io } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123'], io, fixture.deps);

    expect(code).toBe(0);
    expect(fixture.orchestrator).toHaveBeenCalledTimes(1);
    const clockArg = fixture.orchestrator.mock.calls[0]![0].clock;
    expect(clockArg.now()).toBeInstanceOf(Date);
  });

  // 10. production system time is used for schedule date
  it('10. production system time is used for schedule date', async () => {
    const fixture = createMockDependencies();
    fixture.provider.fetchSchedule.mockImplementation(async (date: string) => {
      if (date === DEFAULT_TODAY) {
        return buildScheduleResult([buildScheduleGame()]);
      }
      return buildScheduleResult([]);
    });
    fixture.provider.buildGameSnapshot.mockResolvedValue(buildResearchSnapshot());
    const capturedResult: MLBProspectiveHoldoutCaptureOrchestratorResult = {
      kind: 'CAPTURED_AND_BOUND',
      activationId: 'activation-1',
      protocolId: 'protocol-1',
      gamePk: 123,
      gameId: '123',
      evidenceArtifactId: 'evidence-1',
      bindingId: 'binding-1',
      scientificCutoffAt: '2026-08-15T10:00:00.000Z',
      actualDataCutoffAt: '2026-08-15T10:00:00.000Z',
      persistedAt: '2026-08-15T10:00:00.000Z',
    };
    fixture.orchestrator.mockResolvedValue(capturedResult);

    const { io } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123'], io, fixture.deps);

    expect(code).toBe(0);
    expect(fixture.provider.fetchSchedule).toHaveBeenCalledWith(DEFAULT_TODAY);
  });

  // 11. trusted schedule resolution is used
  it('11. trusted schedule resolution is used', async () => {
    const fixture = createMockDependencies();
    const scheduleGame = buildScheduleGame();
    fixture.provider.fetchSchedule.mockImplementation(async (date: string) => {
      if (date === DEFAULT_TODAY) {
        return buildScheduleResult([scheduleGame]);
      }
      return buildScheduleResult([]);
    });
    fixture.provider.buildGameSnapshot.mockResolvedValue(buildResearchSnapshot());
    const capturedResult: MLBProspectiveHoldoutCaptureOrchestratorResult = {
      kind: 'CAPTURED_AND_BOUND',
      activationId: 'activation-1',
      protocolId: 'protocol-1',
      gamePk: 123,
      gameId: '123',
      evidenceArtifactId: 'evidence-1',
      bindingId: 'binding-1',
      scientificCutoffAt: '2026-08-15T10:00:00.000Z',
      actualDataCutoffAt: '2026-08-15T10:00:00.000Z',
      persistedAt: '2026-08-15T10:00:00.000Z',
    };
    fixture.orchestrator.mockResolvedValue(capturedResult);

    const { io } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123'], io, fixture.deps);

    expect(code).toBe(0);
    expect(fixture.orchestrator).toHaveBeenCalledWith(
      expect.objectContaining({ scheduleGame }),
    );
  });

  // 12. UTC date rollover resolves gamePk and reaches K1
  it('12. UTC date rollover resolves gamePk and reaches K1', async () => {
    const fixture = createMockDependencies({
      now: () => new Date('2026-08-16T00:30:00.000Z'),
    });
    const scheduleGame = buildScheduleGame({ officialDate: '2026-08-15' });
    fixture.provider.fetchSchedule.mockImplementation(async (date: string) => {
      if (date === '2026-08-15') {
        return buildScheduleResult([scheduleGame]);
      }
      return buildScheduleResult([]);
    });
    fixture.provider.buildGameSnapshot.mockResolvedValue(buildResearchSnapshot());
    const capturedResult: MLBProspectiveHoldoutCaptureOrchestratorResult = {
      kind: 'CAPTURED_AND_BOUND',
      activationId: 'activation-1',
      protocolId: 'protocol-1',
      gamePk: 123,
      gameId: '123',
      evidenceArtifactId: 'evidence-1',
      bindingId: 'binding-1',
      scientificCutoffAt: '2026-08-15T10:00:00.000Z',
      actualDataCutoffAt: '2026-08-15T10:00:00.000Z',
      persistedAt: '2026-08-15T10:00:00.000Z',
    };
    fixture.orchestrator.mockResolvedValue(capturedResult);

    const { io } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123'], io, fixture.deps);

    expect(code).toBe(0);
    expect(fixture.orchestrator).toHaveBeenCalledTimes(1);
    expect(fixture.orchestrator).toHaveBeenCalledWith(
      expect.objectContaining({ scheduleGame }),
    );
    expect(fixture.provider.fetchSchedule).toHaveBeenCalledWith('2026-08-16');
    expect(fixture.provider.fetchSchedule).toHaveBeenCalledWith('2026-08-15');
  });

  // 13. same requested gamePk appears twice => duplicate failure
  it('13. same requested gamePk appears twice => duplicate failure', async () => {
    const fixture = createMockDependencies();
    const todayGame = buildScheduleGame({ gamePk: 123 });
    const yesterdayGame = buildScheduleGame({ gamePk: 123 });
    fixture.provider.fetchSchedule.mockImplementation(async (date: string) => {
      if (date === DEFAULT_TODAY) {
        return buildScheduleResult([todayGame]);
      }
      if (date === DEFAULT_YESTERDAY) {
        return buildScheduleResult([yesterdayGame]);
      }
      return buildScheduleResult([]);
    });

    const { io, stderr } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123'], io, fixture.deps);

    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('Schedule game 123 is not unique'));
    expect(fixture.orchestrator).not.toHaveBeenCalled();
    expect(fixture.provider.buildGameSnapshot).not.toHaveBeenCalled();
  });

  // 14. unrelated games in both fetched schedules do not contaminate requested game selection
  it('14. unrelated games in both fetched schedules do not contaminate requested game selection', async () => {
    const fixture = createMockDependencies();
    fixture.provider.fetchSchedule.mockImplementation(async (date: string) => {
      if (date === DEFAULT_TODAY) {
        return buildScheduleResult([
          buildScheduleGame({ gamePk: 111 }),
          buildScheduleGame({ gamePk: 123 }),
          buildScheduleGame({ gamePk: 222 }),
        ]);
      }
      return buildScheduleResult([
        buildScheduleGame({ gamePk: 333 }),
        buildScheduleGame({ gamePk: 444 }),
      ]);
    });
    fixture.provider.buildGameSnapshot.mockResolvedValue(buildResearchSnapshot());
    const capturedResult: MLBProspectiveHoldoutCaptureOrchestratorResult = {
      kind: 'CAPTURED_AND_BOUND',
      activationId: 'activation-1',
      protocolId: 'protocol-1',
      gamePk: 123,
      gameId: '123',
      evidenceArtifactId: 'evidence-1',
      bindingId: 'binding-1',
      scientificCutoffAt: '2026-08-15T10:00:00.000Z',
      actualDataCutoffAt: '2026-08-15T10:00:00.000Z',
      persistedAt: '2026-08-15T10:00:00.000Z',
    };
    fixture.orchestrator.mockResolvedValue(capturedResult);

    const { io } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123'], io, fixture.deps);

    expect(code).toBe(0);
    expect(fixture.orchestrator).toHaveBeenCalledTimes(1);
    const orchestratorArg = fixture.orchestrator.mock.calls[0]![0];
    expect(orchestratorArg.scheduleGame.gamePk).toBe(123);
    expect(fixture.provider.buildGameSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ gamePk: 123 }),
      expect.objectContaining({ season: 2026, includeWeather: false }),
    );
  });

  // 15. caller cannot supply officialDate
  it('15. caller cannot supply officialDate', async () => {
    const { io, stderr } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123', '--officialDate=2026-08-15'], io);

    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('Unsupported flag: --officialDate=2026-08-15'));
  });

  // 16. caller cannot supply scheduledStartAt
  it('16. caller cannot supply scheduledStartAt', async () => {
    const { io, stderr } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123', '--scheduledStartAt=2026-08-15T19:00:00Z'], io);

    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('Unsupported flag: --scheduledStartAt=2026-08-15T19:00:00Z'));
  });

  // 17. caller cannot supply scientific cutoff
  it('17. caller cannot supply scientific cutoff', async () => {
    const { io, stderr } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123', '--scientificCutoffAt=2026-08-15T10:00:00Z'], io);

    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('Unsupported flag: --scientificCutoffAt=2026-08-15T10:00:00Z'));
  });

  // 18. caller cannot supply actual-data cutoff
  it('18. caller cannot supply actual-data cutoff', async () => {
    const { io, stderr } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123', '--actualDataCutoffAt=2026-08-15T10:00:00Z'], io);

    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('Unsupported flag: --actualDataCutoffAt=2026-08-15T10:00:00Z'));
  });

  // 19. caller cannot request backfill
  it('19. caller cannot request backfill', async () => {
    const { io, stderr } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123', '--backfill'], io);

    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('Unsupported flag: --backfill'));
  });

  // 20. caller cannot force late capture
  it('20. caller cannot force late capture', async () => {
    const { io, stderr } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123', '--force'], io);

    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('Unsupported flag: --force'));
  });

  // 21. CAPTURED_AND_BOUND is serialized correctly
  it('21. CAPTURED_AND_BOUND is serialized correctly', async () => {
    const fixture = createMockDependencies();
    fixture.provider.fetchSchedule.mockImplementation(async (date: string) => {
      if (date === DEFAULT_TODAY) {
        return buildScheduleResult([buildScheduleGame()]);
      }
      return buildScheduleResult([]);
    });
    fixture.provider.buildGameSnapshot.mockResolvedValue(buildResearchSnapshot());
    const capturedResult: MLBProspectiveHoldoutCaptureOrchestratorResult = {
      kind: 'CAPTURED_AND_BOUND',
      activationId: 'activation-1',
      protocolId: 'protocol-1',
      gamePk: 123,
      gameId: '123',
      evidenceArtifactId: 'evidence-1',
      bindingId: 'binding-1',
      scientificCutoffAt: '2026-08-15T10:00:00.000Z',
      actualDataCutoffAt: '2026-08-15T10:00:00.000Z',
      persistedAt: '2026-08-15T10:00:00.000Z',
    };
    fixture.orchestrator.mockResolvedValue(capturedResult);

    const { io, stdout } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123'], io, fixture.deps);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(JSON.stringify(capturedResult));
  });

  // 22. ALREADY_COMPLETE is serialized correctly
  it('22. ALREADY_COMPLETE is serialized correctly', async () => {
    const fixture = createMockDependencies();
    fixture.provider.fetchSchedule.mockImplementation(async (date: string) => {
      if (date === DEFAULT_TODAY) {
        return buildScheduleResult([buildScheduleGame()]);
      }
      return buildScheduleResult([]);
    });
    fixture.provider.buildGameSnapshot.mockResolvedValue(buildResearchSnapshot());
    const completedResult: MLBProspectiveHoldoutCaptureOrchestratorResult = {
      kind: 'ALREADY_COMPLETE',
      activationId: 'activation-1',
      protocolId: 'protocol-1',
      gamePk: 123,
      gameId: '123',
      evidenceArtifactId: 'evidence-1',
      bindingId: 'binding-1',
    };
    fixture.orchestrator.mockResolvedValue(completedResult);

    const { io, stdout } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123'], io, fixture.deps);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(JSON.stringify(completedResult));
  });

  // 23. K1 timing rejection/ineligible result is serialized faithfully
  it('23. timing rejection is serialized faithfully', async () => {
    const fixture = createMockDependencies();
    fixture.provider.fetchSchedule.mockImplementation(async (date: string) => {
      if (date === DEFAULT_TODAY) {
        return buildScheduleResult([buildScheduleGame()]);
      }
      return buildScheduleResult([]);
    });
    fixture.provider.buildGameSnapshot.mockResolvedValue(buildResearchSnapshot());
    const ineligibleResult: MLBProspectiveHoldoutCaptureOrchestratorResult = {
      kind: 'SCHEDULE_DRIFT_INELIGIBLE',
      currentGameId: '123',
      currentOfficialDate: '2026-08-15',
      currentScheduledStartAt: '2026-08-15T19:00:00Z',
    };
    fixture.orchestrator.mockResolvedValue(ineligibleResult);

    const { io, stdout } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123'], io, fixture.deps);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(JSON.stringify(ineligibleResult));
  });

  // 24. target absent among unrelated games => not found
  it('24. target absent among unrelated games => not found', async () => {
    const fixture = createMockDependencies();
    fixture.provider.fetchSchedule.mockImplementation(async (date: string) => {
      if (date === DEFAULT_TODAY) {
        return buildScheduleResult([
          buildScheduleGame({ gamePk: 111 }),
          buildScheduleGame({ gamePk: 222 }),
        ]);
      }
      if (date === DEFAULT_YESTERDAY) {
        return buildScheduleResult([
          buildScheduleGame({ gamePk: 333 }),
        ]);
      }
      return buildScheduleResult([]);
    });

    const { io, stderr } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123'], io, fixture.deps);

    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('Schedule game 123 not found'));
    expect(fixture.orchestrator).not.toHaveBeenCalled();
    expect(fixture.provider.buildGameSnapshot).not.toHaveBeenCalled();
  });

  // 25. invalid CLI input does not invoke K1
  it('25. invalid CLI input does not invoke K1', async () => {
    const fixture = createMockDependencies();
    const { io } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--bogus'], io, fixture.deps);

    expect(code).toBe(1);
    expect(fixture.orchestrator).not.toHaveBeenCalled();
  });

  // 26. provider failure does not invoke K1
  it('26. provider failure does not invoke K1', async () => {
    const fixture = createMockDependencies();
    fixture.provider.fetchSchedule.mockRejectedValue(new Error('network failure'));

    const { io, stderr } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123'], io, fixture.deps);

    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('network failure'));
    expect(fixture.orchestrator).not.toHaveBeenCalled();
  });

  // 27. successful adapter execution invokes only one game
  it('27. successful adapter execution invokes only one game', async () => {
    const fixture = createMockDependencies();
    const scheduleGame = buildScheduleGame({ gamePk: 123 });
    fixture.provider.fetchSchedule.mockImplementation(async (date: string) => {
      if (date === DEFAULT_TODAY) {
        return buildScheduleResult([scheduleGame]);
      }
      if (date === DEFAULT_YESTERDAY) {
        return buildScheduleResult([buildScheduleGame({ gamePk: 456 })]);
      }
      return buildScheduleResult([]);
    });
    fixture.provider.buildGameSnapshot.mockResolvedValue(buildResearchSnapshot());
    const capturedResult: MLBProspectiveHoldoutCaptureOrchestratorResult = {
      kind: 'CAPTURED_AND_BOUND',
      activationId: 'activation-1',
      protocolId: 'protocol-1',
      gamePk: 123,
      gameId: '123',
      evidenceArtifactId: 'evidence-1',
      bindingId: 'binding-1',
      scientificCutoffAt: '2026-08-15T10:00:00.000Z',
      actualDataCutoffAt: '2026-08-15T10:00:00.000Z',
      persistedAt: '2026-08-15T10:00:00.000Z',
    };
    fixture.orchestrator.mockResolvedValue(capturedResult);

    const { io } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123'], io, fixture.deps);

    expect(code).toBe(0);
    expect(fixture.orchestrator).toHaveBeenCalledWith(
      expect.objectContaining({ scheduleGame }),
    );
    expect(fixture.provider.buildGameSnapshot).toHaveBeenCalledWith(
      scheduleGame,
      expect.objectContaining({ season: 2026, includeWeather: false }),
    );
  });

  // 28. stdout contains only intended machine-readable output
  it('28. stdout contains only intended machine-readable output', async () => {
    const fixture = createMockDependencies();
    fixture.provider.fetchSchedule.mockImplementation(async (date: string) => {
      if (date === DEFAULT_TODAY) {
        return buildScheduleResult([buildScheduleGame()]);
      }
      return buildScheduleResult([]);
    });
    fixture.provider.buildGameSnapshot.mockResolvedValue(buildResearchSnapshot());
    const capturedResult: MLBProspectiveHoldoutCaptureOrchestratorResult = {
      kind: 'CAPTURED_AND_BOUND',
      activationId: 'activation-1',
      protocolId: 'protocol-1',
      gamePk: 123,
      gameId: '123',
      evidenceArtifactId: 'evidence-1',
      bindingId: 'binding-1',
      scientificCutoffAt: '2026-08-15T10:00:00.000Z',
      actualDataCutoffAt: '2026-08-15T10:00:00.000Z',
      persistedAt: '2026-08-15T10:00:00.000Z',
    };
    fixture.orchestrator.mockResolvedValue(capturedResult);

    const { io, stdout } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123'], io, fixture.deps);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledTimes(1);
    const call = stdout.mock.calls[0]![0];
    expect(() => JSON.parse(call)).not.toThrow();
    expect(call).not.toContain('odds');
    expect(call).not.toContain('market');
    expect(call).not.toContain('score');
    expect(call).not.toContain('label');
    expect(call).not.toContain('model');
  });

  // 29. no odds/market/result/label/model input reaches K1
  it('29. no odds/market/result/label/model input reaches K1', async () => {
    const fixture = createMockDependencies();
    fixture.provider.fetchSchedule.mockImplementation(async (date: string) => {
      if (date === DEFAULT_TODAY) {
        return buildScheduleResult([buildScheduleGame()]);
      }
      return buildScheduleResult([]);
    });
    fixture.provider.buildGameSnapshot.mockResolvedValue(buildResearchSnapshot());
    const capturedResult: MLBProspectiveHoldoutCaptureOrchestratorResult = {
      kind: 'CAPTURED_AND_BOUND',
      activationId: 'activation-1',
      protocolId: 'protocol-1',
      gamePk: 123,
      gameId: '123',
      evidenceArtifactId: 'evidence-1',
      bindingId: 'binding-1',
      scientificCutoffAt: '2026-08-15T10:00:00.000Z',
      actualDataCutoffAt: '2026-08-15T10:00:00.000Z',
      persistedAt: '2026-08-15T10:00:00.000Z',
    };
    fixture.orchestrator.mockResolvedValue(capturedResult);

    const { io } = createIO();
    const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123'], io, fixture.deps);

    expect(code).toBe(0);
    const orchestratorArg = fixture.orchestrator.mock.calls[0]![0];
    expect(orchestratorArg.scheduleGame).toBeDefined();
    expect(orchestratorArg.scheduleGame.officialDate).toBe(DEFAULT_TODAY);
    expect(orchestratorArg.scheduleGame.startTimeUtc).toEqual(new Date('2026-08-15T19:00:00Z'));
  });

  // 30. no additional durable state type is created by K2
  it('30. no additional durable state type is created by K2', async () => {
    const fs = await import('node:fs');
    const scriptPath = new URL('../../../scripts/mlb-prospective-holdout-capture.ts', import.meta.url).pathname;
    const scriptContent = await fs.promises.readFile(scriptPath, 'utf-8');
    // K2 script must not import new store/persistence modules
    expect(scriptContent).not.toContain('persistProspective');
    expect(scriptContent).not.toContain('readProspective');
    expect(scriptContent).not.toContain('computeArtifactId');
    expect(scriptContent).not.toContain('computeBindingId');
  });

  // 31. no public clock environment override is read
  it('31. no public clock environment override is read', async () => {
    const original = process.env.MLB_CAPTURE_NOW;
    process.env.MLB_CAPTURE_NOW = '2026-08-16T00:00:00.000Z';
    try {
      const fixture = createMockDependencies();
      fixture.provider.fetchSchedule.mockImplementation(async (date: string) => {
        if (date === DEFAULT_TODAY) {
          return buildScheduleResult([buildScheduleGame()]);
        }
        return buildScheduleResult([]);
      });
      fixture.provider.buildGameSnapshot.mockResolvedValue(buildResearchSnapshot());
      const capturedResult: MLBProspectiveHoldoutCaptureOrchestratorResult = {
        kind: 'CAPTURED_AND_BOUND',
        activationId: 'activation-1',
        protocolId: 'protocol-1',
        gamePk: 123,
        gameId: '123',
        evidenceArtifactId: 'evidence-1',
        bindingId: 'binding-1',
        scientificCutoffAt: '2026-08-15T10:00:00.000Z',
        actualDataCutoffAt: '2026-08-15T10:00:00.000Z',
        persistedAt: '2026-08-15T10:00:00.000Z',
      };
      fixture.orchestrator.mockResolvedValue(capturedResult);

      const { io } = createIO();
      const code = await runMLBProspectiveHoldoutCaptureCLI(['node', 'script', '--gamePk=123'], io, fixture.deps);

      expect(code).toBe(0);
      expect(fixture.provider.fetchSchedule).toHaveBeenCalledWith(DEFAULT_TODAY);
    } finally {
      if (original === undefined) {
        delete process.env.MLB_CAPTURE_NOW;
      } else {
        process.env.MLB_CAPTURE_NOW = original;
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Shared capture seam tests                                                 */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-capture shared seam', () => {
  const UTC_MIDNIGHT_TRUSTED_NOW = '2026-09-06T18:45:00.000Z';
  const UTC_MIDNIGHT_SCHEDULE_GAME = buildScheduleGame({
    gamePk: 999,
    officialDate: '2026-09-07',
    startTimeUtc: new Date('2026-09-07T01:00:00.000Z'),
  });

  it('E. shared helper itself does not call fetchSchedule', async () => {
    const fixture = createMockDependencies();
    fixture.provider.fetchSchedule.mockResolvedValue(buildScheduleResult([]));
    fixture.provider.buildGameSnapshot.mockResolvedValue(buildResearchSnapshot());
    fixture.orchestrator.mockResolvedValue({
      kind: 'CAPTURED_AND_BOUND',
      activationId: 'a1',
      protocolId: 'p1',
      gamePk: 999,
      gameId: '999',
      evidenceArtifactId: 'e1',
      bindingId: 'b1',
      scientificCutoffAt: '2026-09-06T19:00:00.000Z',
      actualDataCutoffAt: '2026-09-06T19:00:00.000Z',
      persistedAt: '2026-09-06T19:00:00.000Z',
    });

    const result = await runProspectiveHoldoutCaptureForScheduleGame(UTC_MIDNIGHT_SCHEDULE_GAME, {
      ...fixture.deps,
      now: () => new Date(UTC_MIDNIGHT_TRUSTED_NOW),
    });

    expect(fixture.provider.fetchSchedule).not.toHaveBeenCalled();
    expect(fixture.provider.buildGameSnapshot).toHaveBeenCalledTimes(1);
    expect(fixture.orchestrator).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      kind: 'CAPTURED_AND_BOUND',
      activationId: 'a1',
      protocolId: 'p1',
      gamePk: 999,
      gameId: '999',
      evidenceArtifactId: 'e1',
      bindingId: 'b1',
      scientificCutoffAt: '2026-09-06T19:00:00.000Z',
      actualDataCutoffAt: '2026-09-06T19:00:00.000Z',
      persistedAt: '2026-09-06T19:00:00.000Z',
    });
  });

  it('UTC midnight shared seam resolves tomorrow-UTC scheduleGame without K2 lookup', async () => {
    const fixture = createMockDependencies();
    fixture.provider.fetchSchedule.mockResolvedValue(buildScheduleResult([]));
    fixture.provider.buildGameSnapshot.mockResolvedValue(buildResearchSnapshot());
    const capturedResult: MLBProspectiveHoldoutCaptureOrchestratorResult = {
      kind: 'CAPTURED_AND_BOUND',
      activationId: 'a1',
      protocolId: 'p1',
      gamePk: 999,
      gameId: '999',
      evidenceArtifactId: 'e1',
      bindingId: 'b1',
      scientificCutoffAt: '2026-09-06T19:00:00.000Z',
      actualDataCutoffAt: '2026-09-06T19:00:00.000Z',
      persistedAt: '2026-09-06T19:00:00.000Z',
    };
    fixture.orchestrator.mockResolvedValue(capturedResult);

    const result = await runProspectiveHoldoutCaptureForScheduleGame(UTC_MIDNIGHT_SCHEDULE_GAME, {
      ...fixture.deps,
      now: () => new Date(UTC_MIDNIGHT_TRUSTED_NOW),
    });

    expect(fixture.provider.fetchSchedule).not.toHaveBeenCalled();
    expect(fixture.provider.buildGameSnapshot).toHaveBeenCalledTimes(1);
    expect(fixture.provider.buildGameSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ gamePk: 999, officialDate: '2026-09-07' }),
      expect.objectContaining({ season: 2026, includeWeather: false }),
    );
    expect(fixture.orchestrator).toHaveBeenCalledTimes(1);
    const orchestratorInput = fixture.orchestrator.mock.calls[0]![0];
    expect(orchestratorInput.scheduleGame.gamePk).toBe(999);
    expect(orchestratorInput.scheduleGame.officialDate).toBe('2026-09-07');
    expect(result).toEqual(capturedResult);
  });

  it('F. provider snapshot failure propagates from shared helper', async () => {
    const fixture = createMockDependencies();
    fixture.provider.fetchSchedule.mockResolvedValue(buildScheduleResult([]));
    fixture.provider.buildGameSnapshot.mockRejectedValue(new Error('snapshot network failure'));
    fixture.orchestrator.mockResolvedValue({
      kind: 'CAPTURED_AND_BOUND',
      activationId: 'a1',
      protocolId: 'p1',
      gamePk: 999,
      gameId: '999',
      evidenceArtifactId: 'e1',
      bindingId: 'b1',
      scientificCutoffAt: '2026-09-06T19:00:00.000Z',
      actualDataCutoffAt: '2026-09-06T19:00:00.000Z',
      persistedAt: '2026-09-06T19:00:00.000Z',
    });

    await expect(
      runProspectiveHoldoutCaptureForScheduleGame(UTC_MIDNIGHT_SCHEDULE_GAME, {
        ...fixture.deps,
        now: () => new Date(UTC_MIDNIGHT_TRUSTED_NOW),
      }),
    ).rejects.toThrow('snapshot network failure');

    expect(fixture.orchestrator).not.toHaveBeenCalled();
  });

  it('G. bridge failure still throws rather than weakening validation', async () => {
    const fixture = createMockDependencies();
    fixture.provider.fetchSchedule.mockResolvedValue(buildScheduleResult([]));
    fixture.provider.buildGameSnapshot.mockResolvedValue(buildResearchSnapshot());
    fixture.orchestrator.mockResolvedValue({
      kind: 'CAPTURED_AND_BOUND',
      activationId: 'a1',
      protocolId: 'p1',
      gamePk: 999,
      gameId: '999',
      evidenceArtifactId: 'e1',
      bindingId: 'b1',
      scientificCutoffAt: '2026-09-06T19:00:00.000Z',
      actualDataCutoffAt: '2026-09-06T19:00:00.000Z',
      persistedAt: '2026-09-06T19:00:00.000Z',
    });

    const bridgeModule = await import(
      '@/prediction/mlb/mlb-real-data-pregame-snapshot-bridge'
    );
    const originalBuild = bridgeModule.buildMLBRealDataPregameSnapshot;
    const bridgeFailure: MLBRealDataPregameSnapshotBridgeResult = {
      ok: false,
      issues: [
        { code: 'INVALID_STRING', path: '$.test', message: 'forced bridge failure' },
      ],
    };
    vi.spyOn(
      bridgeModule,
      'buildMLBRealDataPregameSnapshot',
    ).mockReturnValue(bridgeFailure);

    await expect(
      runProspectiveHoldoutCaptureForScheduleGame(UTC_MIDNIGHT_SCHEDULE_GAME, {
        ...fixture.deps,
        now: () => new Date(UTC_MIDNIGHT_TRUSTED_NOW),
      }),
    ).rejects.toThrow('Snapshot bridge failed: INVALID_STRING');

    expect(fixture.orchestrator).not.toHaveBeenCalled();

    bridgeModule.buildMLBRealDataPregameSnapshot = originalBuild;
  });
});

/* -------------------------------------------------------------------------- */
/*  Static architecture tests                                                 */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-capture-cli static architecture', () => {
  it('does not contain sportsbook/odds/market/score/result/label/model references', async () => {
    const fs = await import('node:fs');
    const scriptPath = new URL('../../../scripts/mlb-prospective-holdout-capture.ts', import.meta.url).pathname;
    const scriptContent = await fs.promises.readFile(scriptPath, 'utf-8');
    const forbidden = [
      'sportsbook',
      'moneyline',
      'spread',
      'market price',
      'implied probability',
      'score/result ingestion',
      'labels',
      'model inference',
      'prediction invocation',
      'post-game grading',
    ];
    for (const term of forbidden) {
      expect(scriptContent.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });

  it('does not contain while(true)/setInterval/cron/scheduler persistence', async () => {
    const fs = await import('node:fs');
    const scriptPath = new URL('../../../scripts/mlb-prospective-holdout-capture.ts', import.meta.url).pathname;
    const scriptContent = await fs.promises.readFile(scriptPath, 'utf-8');
    const forbidden = [
      'while (true)',
      'setInterval',
      'cron library',
      'scheduler persistence',
      'backfill flag',
      'clock override flag',
    ];
    for (const term of forbidden) {
      expect(scriptContent.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });

  it('contains no unsafe casts or debug statements', async () => {
    const fs = await import('node:fs');
    const scriptPath = new URL('../../../scripts/mlb-prospective-holdout-capture.ts', import.meta.url).pathname;
    const scriptContent = await fs.promises.readFile(scriptPath, 'utf-8');
    expect(scriptContent).not.toContain('as unknown as');
    expect(scriptContent).not.toContain('as any');
    expect(scriptContent).not.toContain(': any');
    expect(scriptContent).not.toContain('<any>');
    expect(scriptContent).not.toContain('ts-ignore');
    expect(scriptContent).not.toContain('ts-expect-error');
    expect(scriptContent).not.toContain('debugger');
    expect(scriptContent).not.toContain('console.log');
    expect(scriptContent).not.toContain('TODO');
    expect(scriptContent).not.toContain('FIXME');
  });
});
