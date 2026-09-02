import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import type { MLBScheduleGame, MLBScheduleResult } from '@/lib/research-data/types';

import {
  runMLBProspectiveHoldoutActivationPlanCLI,
  runProspectiveHoldoutActivationPlan,
  type MLBProspectiveHoldoutActivationPlanDependencies,
  type PlanCLIIO,
} from '../../../scripts/mlb-prospective-holdout-activation-plan';

import {
  planMLBProspectiveHoldoutActivation,
  type MLBProspectiveHoldoutActivationPlanInput,
  type MLBProspectiveHoldoutActivationPlanResult,
  type MLBProspectiveHoldoutActivationPlan,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-plan';
import {
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-contract';
import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
} from '@/prediction/mlb/mlb-prospective-holdout-protocol-contract';
import {
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
} from '@/prediction/mlb/mlb-inner-development-third-real-candidate-recipe';
import {
  MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
  MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
} from '@/prediction/mlb/mlb-prospective-t360-capture-contract';
import {
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
} from '@/prediction/mlb/mlb-prospective-pregame-evidence-artifact-contract';
import {
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
} from '@/prediction/mlb/mlb-prospective-holdout-game-identity-binding-contract';

/* -------------------------------------------------------------------------- */
/*  Mocks                                                                     */
/* -------------------------------------------------------------------------- */

const mockPlan = vi.fn(
  (input: MLBProspectiveHoldoutActivationPlanInput): MLBProspectiveHoldoutActivationPlanResult => {
    throw new Error('mockPlan not configured');
  },
);


beforeEach(() => {
  vi.clearAllMocks();
  mockPlan.mockClear();
  mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan() });
});

/* -------------------------------------------------------------------------- */
/*  Real L1 (for integration comparison)                                      */
/* -------------------------------------------------------------------------- */


/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const DEFAULT_NOW = '2026-09-01T00:00:00.000Z';
const DEFAULT_DATE = '2026-09-01';

function buildScheduleGame(overrides: Partial<MLBScheduleGame> = {}): MLBScheduleGame {
  const base: MLBScheduleGame = {
    gamePk: 1,
    gameType: 'R',
    gameNumber: 1,
    officialDate: DEFAULT_DATE,
    gameDate: '2026-09-01T19:00:00Z',
    startTimeUtc: new Date('2026-09-01T19:00:00Z'),
    status: 'UPCOMING',
    homeTeamId: 1,
    homeTeamName: 'Home Team',
    awayTeamId: 2,
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
    probablePitchers: { home: null, away: null },
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

function rawScheduleGame(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    gamePk: 1,
    gameType: 'R',
    gameNumber: 1,
    officialDate: '2026-09-01',
    gameDate: '2026-09-01T19:00:00Z',
    startTimeUtc: new Date('2026-09-01T19:00:00Z'),
    status: 'UPCOMING',
    homeTeamId: 1,
    homeTeamName: 'Home Team',
    awayTeamId: 2,
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
    probablePitchers: { home: null, away: null },
    ...overrides,
  };
}

function makeGamesForDate(count: number, date: string, gamePkStart = 1): MLBScheduleGame[] {
  const games: MLBScheduleGame[] = [];
  for (let i = 0; i < count; i++) {
    const hour = 12 + Math.floor(i / 10);
    const minute = (i % 10) * 6;
    if (hour >= 24) {
      throw new Error(`Cannot generate ${count} games within one date starting at hour 12`);
    }
    const startTimeUtc = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`);
    games.push(buildScheduleGame({ gamePk: gamePkStart + i, officialDate: date, startTimeUtc }));
  }
  return games;
}

function makeGamesForDateAtHour(count: number, date: string, hour: number, minute = 0, gamePkStart = 1): MLBScheduleGame[] {
  const games: MLBScheduleGame[] = [];
  for (let i = 0; i < count; i++) {
    const h = hour + Math.floor((minute + i) / 60);
    const m = (minute + i) % 60;
    if (h >= 24) {
      throw new Error(`Cannot generate ${count} games within one date starting at hour ${hour}:${minute}`);
    }
    const startTimeUtc = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
    games.push(buildScheduleGame({ gamePk: gamePkStart + i, officialDate: date, startTimeUtc }));
  }
  return games;
}

function createMockDependencies(
  overrides: Partial<MLBProspectiveHoldoutActivationPlanDependencies> = {},
): { deps: MLBProspectiveHoldoutActivationPlanDependencies; provider: Mock<(date: string) => Promise<unknown>>; now: Mock<() => Date>; plan: (input: MLBProspectiveHoldoutActivationPlanInput) => MLBProspectiveHoldoutActivationPlanResult } {
  const fetchSchedule = vi.fn((date: string) => Promise.resolve(buildScheduleResult([])));
  const now = vi.fn(() => new Date(DEFAULT_NOW));
  const plan = overrides.plan ?? mockPlan;
  const deps: MLBProspectiveHoldoutActivationPlanDependencies = {
    provider: overrides.provider ?? { fetchSchedule },
    now: overrides.now ?? now,
    plan,
  };
  return { deps, provider: fetchSchedule, now, plan };
}

function createIO(): { io: PlanCLIIO; stdout: Mock<(message: string) => void>; stderr: Mock<(message: string) => void> } {
  const stdout = vi.fn((message: string) => {});
  const stderr = vi.fn((message: string) => {});
  return {
    io: { stdout, stderr },
    stdout,
    stderr,
  };
}

function buildMockPlan(overrides: Partial<MLBProspectiveHoldoutActivationPlan> = {}): MLBProspectiveHoldoutActivationPlan {
  return {
    contractVersion: 'mlb-prospective-holdout-activation-plan-v1',
    boundarySelectionPolicyId: 'earliest-official-date-supporting-frozen-target-counts-v1',
    activationId: 'act-1',
    planningReferenceAt: DEFAULT_NOW,
    validationBoundaryOfficialDate: '2026-09-01',
    activationDeadlineAt: '2026-09-01T05:00:00.000Z',
    inputGameCount: 136,
    prospectivelyEligibleGameCount: 136,
    validationSideAvailableCount: 67,
    testSideAvailableCount: 69,
    validationTargetCount: 67,
    testTargetCount: 69,
    scheduleUniverseFingerprint: 'fp',
    activationPayload: {} as any,
    planFingerprint: 'pfp',
    firstValidationGamePk: 1,
    firstTestSideGamePk: 1000,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/*  Host tests                                                               */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-activation-plan host', () => {
  // 1. one activationId accepted
  it('1. one activationId accepted with sufficient eligible games', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(67, '2026-09-01'));
      }
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDate(69, '2026-09-02', 1000));
      }
      return buildScheduleResult([]);
    });
    mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan() });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.activationId).toBe('act-1');
    }
    expect(mockPlan).toHaveBeenCalledTimes(1);
    const l1Input = mockPlan.mock.calls[0]![0];
    expect(l1Input.activationId).toBe('act-1');
    expect(l1Input.scheduleGames).toHaveLength(136);
  });

  // 2. missing activationId rejected
  it('2. missing activationId rejected by CLI', async () => {
    const { io, stderr } = createIO();
    const code = await runMLBProspectiveHoldoutActivationPlanCLI(['node', 'script'], io);

    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('activationId is required'));
  });

  // 3. blank activationId rejected
  it('3. blank activationId rejected by CLI', async () => {
    const { io, stderr } = createIO();
    const code = await runMLBProspectiveHoldoutActivationPlanCLI(['node', 'script', '   '], io);

    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('activationId must be a non-empty trimmed string'));
  });

  // 4. extra positional args rejected
  it('4. extra positional args rejected by CLI', async () => {
    const { io, stderr } = createIO();
    const code = await runMLBProspectiveHoldoutActivationPlanCLI(['node', 'script', 'act-1', 'extra'], io);

    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('Only one positional argument'));
  });

  // 5. flags rejected
  it('5. unsupported flag rejected by CLI', async () => {
    const { io, stderr } = createIO();
    const code = await runMLBProspectiveHoldoutActivationPlanCLI(['node', 'script', '--gamePk=123'], io);

    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('Unsupported flag: --gamePk=123'));
  });

  // 6. no scientific override surface
  it('6. no scientific override surface accepted by CLI', async () => {
    const { io, stderr } = createIO();
    const code = await runMLBProspectiveHoldoutActivationPlanCLI(['node', 'script', '--scientificCutoffAt=2026-09-01T00:00:00Z'], io);

    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('Unsupported flag: --scientificCutoffAt'));
  });

  // 7. now called exactly once
  it('7. now is called exactly once', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(67, '2026-09-01'));
      }
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDate(69, '2026-09-02', 1000));
      }
      return buildScheduleResult([]);
    });
    mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan() });

    const code = await runMLBProspectiveHoldoutActivationPlanCLI(['node', 'script', 'act-1'], createIO().io, fixture.deps);

    expect(code).toBe(0);
    expect(fixture.now).toHaveBeenCalledTimes(1);
  });

  // 8. UTC start/year
  it('8. UTC date of now is scan start and year', async () => {
    const fixture = createMockDependencies({
      now: () => new Date('2026-08-15T00:30:00.000Z'),
    });
    const fetchSpy = fixture.provider;
    mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan() });
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-08-15') {
        return buildScheduleResult(makeGamesForDate(67, '2026-08-15'));
      }
      if (date === '2026-08-16') {
        return buildScheduleResult(makeGamesForDate(69, '2026-08-16', 1000));
      }
      return buildScheduleResult([]);
    });

    const code = await runMLBProspectiveHoldoutActivationPlanCLI(['node', 'script', 'act-1'], createIO().io, fixture.deps);

    expect(code).toBe(0);
    expect(fetchSpy).toHaveBeenCalledWith('2026-08-15');
    expect(fetchSpy).not.toHaveBeenCalledWith('2026-08-14');
  });

  // 9. just before T360 eligible
  it('9. just before T360 is eligible', async () => {
    const fixture = createMockDependencies({
      now: () => new Date('2026-09-02T12:59:59.999Z'),
    });
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDateAtHour(67, '2026-09-02', 20));
      }
      if (date === '2026-09-03') {
        return buildScheduleResult([
          ...makeGamesForDateAtHour(69, '2026-09-03', 20, 0, 1000),
          buildScheduleGame({ gamePk: 1069, officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T19:00:00.000Z') }),
        ]);
      }
      return buildScheduleResult([]);
    });
    mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan({ prospectivelyEligibleGameCount: 137 }) });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.prospectivelyEligibleGameCount).toBe(137);
    }
  });

  // 10. exactly T360 excluded
  it('10. exactly T360 is excluded', async () => {
    const fixture = createMockDependencies({
      now: () => new Date('2026-09-02T13:00:00.000Z'),
    });
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDateAtHour(67, '2026-09-02', 20));
      }
      if (date === '2026-09-03') {
        return buildScheduleResult([
          ...makeGamesForDateAtHour(69, '2026-09-03', 20, 0, 1000),
          buildScheduleGame({ gamePk: 1069, officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T19:00:00.000Z') }),
        ]);
      }
      return buildScheduleResult([]);
    });
    mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan({ prospectivelyEligibleGameCount: 136 }) });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.prospectivelyEligibleGameCount).toBe(136);
    }
  });

  // 11. after T360 excluded
  it('11. after T360 is excluded', async () => {
    const fixture = createMockDependencies({
      now: () => new Date('2026-09-02T13:00:00.001Z'),
    });
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDateAtHour(67, '2026-09-02', 20));
      }
      if (date === '2026-09-03') {
        return buildScheduleResult([
          ...makeGamesForDateAtHour(69, '2026-09-03', 20, 0, 1000),
          buildScheduleGame({ gamePk: 1069, officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T19:00:00.000Z') }),
        ]);
      }
      return buildScheduleResult([]);
    });
    mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan({ prospectivelyEligibleGameCount: 136 }) });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.prospectivelyEligibleGameCount).toBe(136);
    }
  });

  // 12. R included
  it('12. R gameType is eligible', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(67, '2026-09-01'));
      }
      if (date === '2026-09-02') {
        return buildScheduleResult([
          ...makeGamesForDate(69, '2026-09-02', 1000),
          buildScheduleGame({ gamePk: 1069, gameType: 'R', officialDate: '2026-09-02', startTimeUtc: new Date('2026-09-02T18:50:00.000Z') }),
        ]);
      }
      return buildScheduleResult([]);
    });
    mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan({ prospectivelyEligibleGameCount: 137 }) });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.prospectivelyEligibleGameCount).toBe(137);
      const l1Input = mockPlan.mock.calls[0]![0];
      expect(l1Input.scheduleGames).toHaveLength(137);
      expect(l1Input.scheduleGames.some((g) => g.gamePk === 1069)).toBe(true);
    }
  });

  // 13. S/A/P/F/D/L/W/I excluded
  it('13. non-R gameTypes are excluded', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult([
          ...makeGamesForDate(67, '2026-09-01'),
          buildScheduleGame({ gamePk: 1000, gameType: 'S' }),
          buildScheduleGame({ gamePk: 1001, gameType: 'A' }),
          buildScheduleGame({ gamePk: 1002, gameType: 'P' }),
          buildScheduleGame({ gamePk: 1003, gameType: 'F' }),
          buildScheduleGame({ gamePk: 1004, gameType: 'D' }),
          buildScheduleGame({ gamePk: 1005, gameType: 'L' }),
          buildScheduleGame({ gamePk: 1006, gameType: 'W' }),
          buildScheduleGame({ gamePk: 1007, gameType: 'I' }),
        ]);
      }
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDate(69, '2026-09-02', 2000));
      }
      return buildScheduleResult([]);
    });
    mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan() });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.prospectivelyEligibleGameCount).toBe(136);
      const l1Input = mockPlan.mock.calls[0]![0];
      expect(l1Input.scheduleGames).toHaveLength(136);
      expect(l1Input.scheduleGames.every((g) => g.gameType === 'R')).toBe(true);
    }
  });

  // 14. unknown raw type fails
  it('14. unknown raw gameType fails closed', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult([buildScheduleGame({ gamePk: 1, gameType: 'Z' })]);
      }
      return buildScheduleResult([]);
    });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues.some((i) => i.code === 'UNKNOWN_GAME_TYPE' && i.path === '$.scheduleGames[1].gameType')).toBe(true);
    }
    expect(mockPlan).not.toHaveBeenCalled();
  });

  // 15. UPCOMING included
  it('15. UPCOMING status is eligible', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(67, '2026-09-01'));
      }
      if (date === '2026-09-02') {
        return buildScheduleResult([
          ...makeGamesForDate(69, '2026-09-02', 1000),
          buildScheduleGame({ gamePk: 1069, status: 'UPCOMING', officialDate: '2026-09-02', startTimeUtc: new Date('2026-09-02T18:50:00.000Z') }),
        ]);
      }
      return buildScheduleResult([]);
    });
    mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan({ prospectivelyEligibleGameCount: 137 }) });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.prospectivelyEligibleGameCount).toBe(137);
      const l1Input = mockPlan.mock.calls[0]![0];
      expect(l1Input.scheduleGames).toHaveLength(137);
      expect(l1Input.scheduleGames.some((g) => g.gamePk === 1069)).toBe(true);
    }
  });

  // 16. LIVE/FINAL/POSTPONED/CANCELLED excluded
  it('16. non-UPCOMING statuses are excluded', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult([
          ...makeGamesForDate(67, '2026-09-01'),
          buildScheduleGame({ gamePk: 1000, status: 'LIVE' }),
          buildScheduleGame({ gamePk: 1001, status: 'FINAL' }),
          buildScheduleGame({ gamePk: 1002, status: 'POSTPONED' }),
          buildScheduleGame({ gamePk: 1003, status: 'CANCELLED' }),
        ]);
      }
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDate(69, '2026-09-02', 2000));
      }
      return buildScheduleResult([]);
    });
    mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan() });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.prospectivelyEligibleGameCount).toBe(136);
      const l1Input = mockPlan.mock.calls[0]![0];
      expect(l1Input.scheduleGames).toHaveLength(136);
      expect(l1Input.scheduleGames.every((g) => g.status === 'UPCOMING')).toBe(true);
    }
  });

  // 17. unknown runtime status fails
  it('17. unknown runtime status fails closed', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return {
          games: [rawScheduleGame({ status: 'UNKNOWN' })],
          provenance: { source: 'test', fetchedAt: new Date(), isLive: true, warnings: [] },
        };
      }
      return {
        games: [],
        provenance: { source: 'test', fetchedAt: new Date(), isLive: true, warnings: [] },
      };
    });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues.some((i) => i.code === 'UNKNOWN_STATUS' && i.path === '$.scheduleGames[1].status')).toBe(true);
    }
    expect(mockPlan).not.toHaveBeenCalled();
  });

  // 18. provider/A1 normalization failure aborts plan
  it('18. provider failure aborts plan', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockRejectedValue(new Error('network failure'));

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues.some((i) => i.code === 'PROVIDER_FAILURE' && i.path === '$.provider')).toBe(true);
    }
    expect(mockPlan).not.toHaveBeenCalled();
  });

  // 19. zero day continues
  it('19. zero-game day continues to next date', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult([]);
      }
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDate(67, '2026-09-02'));
      }
      if (date === '2026-09-03') {
        return buildScheduleResult(makeGamesForDate(69, '2026-09-03', 1000));
      }
      return buildScheduleResult([]);
    });
    mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan() });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(true);
  });

  // 20. multiple empty days continue
  it('20. multiple empty days continue', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-03') {
        return buildScheduleResult(makeGamesForDate(67, '2026-09-03'));
      }
      if (date === '2026-09-04') {
        return buildScheduleResult(makeGamesForDate(69, '2026-09-04', 1000));
      }
      return buildScheduleResult([]);
    });
    mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan() });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(true);
  });

  // 21. one primary provider call per date
  it('21. exactly one provider call per fetched date', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(67, '2026-09-01'));
      }
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDate(69, '2026-09-02', 1000));
      }
      return buildScheduleResult([]);
    });
    mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan() });

    await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(fixture.provider).toHaveBeenCalledTimes(2);
  });

  // 22. provider error aborts
  it('22. provider error aborts plan', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        throw new Error('network failure');
      }
      return buildScheduleResult([]);
    });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(false);
    expect(mockPlan).not.toHaveBeenCalled();
  });

  // 23. Dec31 finite cap
  it('23. never fetches beyond Dec 31', async () => {
    const fixture = createMockDependencies({
      now: () => new Date('2026-12-30T12:00:00.000Z'),
    });
    fixture.provider.mockReturnValue(Promise.resolve(buildScheduleResult([])) as Promise<MLBScheduleResult>);
    mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan() });

    await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(fixture.provider).not.toHaveBeenCalledWith('2027-01-01');
  });

  // 24. next year never fetched
  it('24. next year is never fetched', async () => {
    const fixture = createMockDependencies({
      now: () => new Date('2026-12-31T12:00:00.000Z'),
    });
    fixture.provider.mockReturnValue(Promise.resolve(buildScheduleResult([])) as Promise<MLBScheduleResult>);
    mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan() });

    await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(fixture.provider).not.toHaveBeenCalledWith('2027-01-01');
  });

  // 25. malformed gamePk
  it('25. malformed gamePk fails closed', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return {
          games: [
            rawScheduleGame({ gamePk: 1 }),
            rawScheduleGame({ gamePk: 'abc' }),
            rawScheduleGame({ gamePk: 0 }),
            rawScheduleGame({ gamePk: -1 }),
          ],
          provenance: { source: 'test', fetchedAt: new Date(), isLive: true, warnings: [] },
        };
      }
      return {
        games: [],
        provenance: { source: 'test', fetchedAt: new Date(), isLive: true, warnings: [] },
      };
    });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues.filter((i) => i.code === 'MALFORMED_SCHEDULE')).toHaveLength(3);
    }
    expect(mockPlan).not.toHaveBeenCalled();
  });

  // 26. malformed officialDate
  it('26. malformed officialDate fails closed', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return {
          games: [
            rawScheduleGame({ gamePk: 1, officialDate: 'not-a-date' }),
            rawScheduleGame({ gamePk: 2, officialDate: '2026/09/01' }),
          ],
          provenance: { source: 'test', fetchedAt: new Date(), isLive: true, warnings: [] },
        };
      }
      return {
        games: [],
        provenance: { source: 'test', fetchedAt: new Date(), isLive: true, warnings: [] },
      };
    });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues.filter((i) => i.code === 'MALFORMED_SCHEDULE')).toHaveLength(2);
    }
    expect(mockPlan).not.toHaveBeenCalled();
  });

  // 27. malformed startTimeUtc
  it('27. malformed startTimeUtc fails closed', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return {
          games: [
            rawScheduleGame({ gamePk: 1, startTimeUtc: new Date('invalid') }),
            rawScheduleGame({ gamePk: 2, startTimeUtc: '2026-09-01T19:00:00Z' }),
          ],
          provenance: { source: 'test', fetchedAt: new Date(), isLive: true, warnings: [] },
        };
      }
      return {
        games: [],
        provenance: { source: 'test', fetchedAt: new Date(), isLive: true, warnings: [] },
      };
    });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues.filter((i) => i.code === 'MALFORMED_SCHEDULE')).toHaveLength(2);
    }
    expect(mockPlan).not.toHaveBeenCalled();
  });

  // 28. out-of-year row
  it('28. out-of-year row fails closed', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult([
          buildScheduleGame({ gamePk: 1, officialDate: '2026-09-01', startTimeUtc: new Date('2026-09-01T19:00:00Z') }),
          buildScheduleGame({ gamePk: 2, officialDate: '2027-09-01', startTimeUtc: new Date('2026-09-01T19:00:00Z') }),
          ...makeGamesForDate(65, '2026-09-01', 3),
        ]);
      }
      return buildScheduleResult([]);
    });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues.some((i) => i.code === 'OUT_OF_SCOPE_SCHEDULE_DATE')).toBe(true);
    }
    expect(mockPlan).not.toHaveBeenCalled();
  });

  // 29. duplicate same response
  it('29. duplicate gamePk in same response fails closed', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult([
          buildScheduleGame({ gamePk: 1 }),
          buildScheduleGame({ gamePk: 1 }),
        ]);
      }
      return buildScheduleResult([]);
    });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues.some((i) => i.code === 'DUPLICATE_GAME_PK')).toBe(true);
    }
    expect(mockPlan).not.toHaveBeenCalled();
  });

  // 30. duplicate across responses
  it('30. duplicate gamePk across responses fails closed', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult([buildScheduleGame({ gamePk: 1 })]);
      }
      if (date === '2026-09-02') {
        return buildScheduleResult([buildScheduleGame({ gamePk: 1 })]);
      }
      return buildScheduleResult([]);
    });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues.some((i) => i.code === 'DUPLICATE_GAME_PK')).toBe(true);
    }
    expect(mockPlan).not.toHaveBeenCalled();
  });

  // 31. duplicate even for excluded type
  it('31. duplicate gamePk fails even when one is excluded type', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult([
          buildScheduleGame({ gamePk: 1, gameType: 'R', status: 'UPCOMING' }),
          buildScheduleGame({ gamePk: 1, gameType: 'S', status: 'UPCOMING' }),
        ]);
      }
      return buildScheduleResult([]);
    });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues.some((i) => i.code === 'DUPLICATE_GAME_PK')).toBe(true);
    }
    expect(mockPlan).not.toHaveBeenCalled();
  });

  // 32. earliest d67
  it('32. earliest officialDate with cumulative >= 67 is d67', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(67, '2026-09-01'));
      }
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDate(69, '2026-09-02', 1000));
      }
      return buildScheduleResult([]);
    });
    mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan() });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.validationBoundaryOfficialDate).toBe('2026-09-01');
    }
  });

  // 33. same-date overshoot
  it('33. same-date count overshoot does not split d67', async () => {
    const fixture = createMockDependencies({
      plan: planMLBProspectiveHoldoutActivation,
    });
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(75, '2026-09-01'));
      }
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDate(69, '2026-09-02', 1000));
      }
      return buildScheduleResult([]);
    });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.validationSideAvailableCount).toBe(75);
      expect(result.plan.validationTargetCount).toBe(67);
      expect(result.plan.testSideAvailableCount).toBe(69);
    }
  });

  // 34. test side strictly later
  it('34. test side must be strictly later than d67', async () => {
    const fixture = createMockDependencies({
      plan: planMLBProspectiveHoldoutActivation,
    });
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(67, '2026-09-01'));
      }
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDate(69, '2026-09-02', 1000));
      }
      return buildScheduleResult([]);
    });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.testSideAvailableCount).toBe(69);
    }
  });

  // 35. 68 does not stop
  it('35. 68 test side does not stop acquisition', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(67, '2026-09-01'));
      }
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDate(1, '2026-09-02', 1000));
      }
      if (date === '2026-09-03') {
        return buildScheduleResult(makeGamesForDate(68, '2026-09-03', 1001));
      }
      return buildScheduleResult([]);
    });
    mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan() });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.testSideAvailableCount).toBe(69);
    }
  });

  // 36. 69 stops
  it('36. acquisition stops when test side reaches 69', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(67, '2026-09-01'));
      }
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDate(1, '2026-09-02', 1000));
      }
      if (date === '2026-09-03') {
        return buildScheduleResult(makeGamesForDate(68, '2026-09-03', 1001));
      }
      return buildScheduleResult([]);
    });
    mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan() });

    await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    // Should not fetch beyond 2026-09-03 because d67+69 is met there
    expect(fixture.provider).not.toHaveBeenCalledWith('2026-09-04');
  });

  // 37. partial L1 success not stop authority
  it('37. host does not use partial L1 success as stop authority', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(67, '2026-09-01'));
      }
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDate(1, '2026-09-02', 1000));
      }
      if (date === '2026-09-03') {
        return buildScheduleResult(makeGamesForDate(68, '2026-09-03', 1001));
      }
      return buildScheduleResult([]);
    });
    mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan() });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    // Host should still call L1 with full 136 games, not use L1's partial result to stop
    expect(result.ok).toBe(true);
    expect(mockPlan).toHaveBeenCalledTimes(1);
    const l1Input = mockPlan.mock.calls[0]![0];
    expect(l1Input.scheduleGames).toHaveLength(136);
  });

  // 38. provider order does not change final plan
  it('38. provider order does not change final plan', async () => {
    const fixture1 = createMockDependencies();
    fixture1.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(67, '2026-09-01'));
      }
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDate(69, '2026-09-02', 1000));
      }
      return buildScheduleResult([]);
    });

    const fixture2 = createMockDependencies();
    fixture2.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        // Return games in different order
        const games = makeGamesForDate(67, '2026-09-01');
        return buildScheduleResult(games.reverse());
      }
      if (date === '2026-09-02') {
        const games = makeGamesForDate(69, '2026-09-02', 1000);
        return buildScheduleResult(games.reverse());
      }
      return buildScheduleResult([]);
    });

    mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan() });

    const result1 = await runProspectiveHoldoutActivationPlan('act-1', fixture1.deps);
    const result2 = await runProspectiveHoldoutActivationPlan('act-1', fixture2.deps);

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    if (result1.ok && result2.ok) {
      expect(result1.plan.planFingerprint).toBe(result2.plan.planFingerprint);
    }
  });

  // 39. final result equals direct L1 result for same universe
  it('39. final result equals direct L1 result for same universe', async () => {
    const fixture = createMockDependencies({
      plan: planMLBProspectiveHoldoutActivation,
    });
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(67, '2026-09-01'));
      }
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDate(69, '2026-09-02', 1000));
      }
      return buildScheduleResult([]);
    });

    const hostResult = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);
    const directResult = planMLBProspectiveHoldoutActivation({
      activationId: 'act-1',
      planningReferenceAt: DEFAULT_NOW,
      scheduleGames: [...makeGamesForDate(67, '2026-09-01'), ...makeGamesForDate(69, '2026-09-02', 1000)],
    });

    expect(hostResult.ok).toBe(true);
    expect(directResult.ok).toBe(true);
    if (hostResult.ok && directResult.ok) {
      expect(hostResult.plan).toEqual(directResult.plan);
    }
  });

  // 40. validation shortfall
  it('40. validation shortfall fails with AUTHORIZED_SEASON_EXHAUSTED_VALIDATION_SHORTFALL', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(66, '2026-09-01'));
      }
      return buildScheduleResult([]);
    });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues.some((i) => i.code === 'AUTHORIZED_SEASON_EXHAUSTED_VALIDATION_SHORTFALL')).toBe(true);
    }
    expect(mockPlan).not.toHaveBeenCalled();
  });

  // 41. test shortfall
  it('41. test shortfall fails with INSUFFICIENT_TEST_CANDIDATES', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(67, '2026-09-01'));
      }
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDate(68, '2026-09-02', 1000));
      }
      return buildScheduleResult([]);
    });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues.some((i) => i.code === 'AUTHORIZED_SEASON_EXHAUSTED_TEST_SHORTFALL')).toBe(true);
    }
    expect(mockPlan).not.toHaveBeenCalled();
  });

  // 42. postseason cannot rescue
  it('42. non-R gameTypes do not count toward d67+69', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult([
          ...makeGamesForDate(67, '2026-09-01'),
          buildScheduleGame({ gamePk: 9999, gameType: 'P', status: 'UPCOMING', officialDate: '2026-09-01', startTimeUtc: new Date('2026-09-01T20:00:00Z') }),
        ]);
      }
      return buildScheduleResult([]);
    });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues.some((i) => i.code === 'AUTHORIZED_SEASON_EXHAUSTED_TEST_SHORTFALL')).toBe(true);
    }
    expect(mockPlan).not.toHaveBeenCalled();
  });

  // 43. next year cannot rescue
  it('43. out-of-year games do not count toward d67+69', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(66, '2026-09-01'));
      }
      if (date === '2026-09-02') {
        return buildScheduleResult([
          ...makeGamesForDate(2, '2026-09-02', 1000),
          buildScheduleGame({ gamePk: 9999, startTimeUtc: new Date('2027-09-02T19:00:00Z') }),
        ]);
      }
      return buildScheduleResult([]);
    });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues.some((i) => i.code === 'AUTHORIZED_SEASON_EXHAUSTED_TEST_SHORTFALL')).toBe(true);
    }
    expect(mockPlan).not.toHaveBeenCalled();
  });

  // 44. no partial plan
  it('44. no partial plan is returned on acquisition failure', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(50, '2026-09-01'));
      }
      return buildScheduleResult([]);
    });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('AUTHORIZED_SEASON_EXHAUSTED_VALIDATION_SHORTFALL');
      expect(result.error.issues.some((i) => i.code === 'AUTHORIZED_SEASON_EXHAUSTED_VALIDATION_SHORTFALL')).toBe(true);
    }
  });

  // 45. raw plan returned unchanged
  it('45. raw L1 plan is returned unchanged to stdout', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(67, '2026-09-01'));
      }
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDate(69, '2026-09-02', 1000));
      }
      return buildScheduleResult([]);
    });
    const expectedPlan = buildMockPlan({ planFingerprint: 'test-fingerprint' });
    mockPlan.mockReturnValue({ ok: true, plan: expectedPlan });

    const { io, stdout } = createIO();
    const code = await runMLBProspectiveHoldoutActivationPlanCLI(['node', 'script', 'act-1'], io, fixture.deps);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(JSON.stringify(expectedPlan));
  });

  // 46. fingerprints unchanged
  it('46. L1 fingerprints are preserved unchanged', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(67, '2026-09-01'));
      }
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDate(69, '2026-09-02', 1000));
      }
      return buildScheduleResult([]);
    });
    const expectedPlan = buildMockPlan({
      scheduleUniverseFingerprint: 'schedule-fp',
      planFingerprint: 'plan-fp',
    });
    mockPlan.mockReturnValue({ ok: true, plan: expectedPlan });

    const result = await runProspectiveHoldoutActivationPlan('act-1', fixture.deps);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.scheduleUniverseFingerprint).toBe('schedule-fp');
      expect(result.plan.planFingerprint).toBe('plan-fp');
    }
  });

  // 47. no persistedAt
  it('47. plan does not contain persistedAt', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(67, '2026-09-01'));
      }
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDate(69, '2026-09-02', 1000));
      }
      return buildScheduleResult([]);
    });
    mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan() });

    const { io, stdout } = createIO();
    const code = await runMLBProspectiveHoldoutActivationPlanCLI(['node', 'script', 'act-1'], io, fixture.deps);

    expect(code).toBe(0);
    const planJson = stdout.mock.calls[0]![0];
    const planObj = JSON.parse(planJson);
    expect(planObj).not.toHaveProperty('persistedAt');
  });

  // 48. no activation/H/binding
  it('48. plan does not contain activation/H/binding fields', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(67, '2026-09-01'));
      }
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDate(69, '2026-09-02', 1000));
      }
      return buildScheduleResult([]);
    });
    const expectedPlan = buildMockPlan({
      activationPayload: {
        contractVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: 'act-1',
        candidateRecipeId: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
        candidateFingerprint: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
        featureManifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
        featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
        preprocessingPolicyId: 'raw-finite-feature-values-with-default-missing-v1',
        captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
        compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
        evidenceArtifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
        evidenceStoreVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
        validationBoundaryOfficialDate: '2026-09-01',
        validationTargetCount: 67,
        testTargetCount: 69,
        stableOrderPolicy: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY,
        validationSideDateRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE,
        testSideDateRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE,
        noSmallerN: true,
        resultIndependentSelection: true,
        testAuthorizationRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE,
        gameIdentityBindingContractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
        gameIdentityBindingStoreVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
      },
    });
    mockPlan.mockReturnValue({ ok: true, plan: expectedPlan });

    const { io, stdout } = createIO();
    const code = await runMLBProspectiveHoldoutActivationPlanCLI(['node', 'script', 'act-1'], io, fixture.deps);

    expect(code).toBe(0);
    const planJson = stdout.mock.calls[0]![0];
    const planObj = JSON.parse(planJson);
    expect(planObj).not.toHaveProperty('persistedAt');
    expect(planObj).not.toHaveProperty('binding');
    expect(planObj).not.toHaveProperty('H');
  });

  // 49. no model/results/labels/odds
  it('49. plan does not contain model/results/labels/odds fields', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(67, '2026-09-01'));
      }
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDate(69, '2026-09-02', 1000));
      }
      return buildScheduleResult([]);
    });
    mockPlan.mockReturnValue({ ok: true, plan: buildMockPlan() });

    const { io, stdout } = createIO();
    const code = await runMLBProspectiveHoldoutActivationPlanCLI(['node', 'script', 'act-1'], io, fixture.deps);

    expect(code).toBe(0);
    const planJson = stdout.mock.calls[0]![0];
    expect(planJson).not.toContain('model');
    expect(planJson).not.toContain('score');
    expect(planJson).not.toContain('label');
    expect(planJson).not.toContain('odds');
    expect(planJson).not.toContain('market');
  });

  // 50. direct import inert
  it('50. direct import does not run CLI operationally', async () => {
    const fs = await import('node:fs');
    const scriptPath = new URL('../../../scripts/mlb-prospective-holdout-activation-plan.ts', import.meta.url).pathname;
    const scriptContent = await fs.promises.readFile(scriptPath, 'utf-8');
    expect(scriptContent).toContain('isDirectExecution()');
    expect(scriptContent).toContain('process.argv');
    // Verify process.argv is only inside isDirectExecution block
    const lines = scriptContent.split('\n');
    let inDirectExecution = false;
    let argvOutsideGuard = false;
    for (const line of lines) {
      if (line.includes('isDirectExecution()')) {
        inDirectExecution = true;
      }
      if (inDirectExecution && line.trim() === '}') {
        inDirectExecution = false;
      }
      if (!inDirectExecution && line.includes('process.argv')) {
        argvOutsideGuard = true;
      }
    }
    expect(argvOutsideGuard).toBe(false);
  });

  // 51. CLI stdout/stderr contracts
  it('51. CLI stdout contains JSON plan on success, stderr empty', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult(makeGamesForDate(67, '2026-09-01'));
      }
      if (date === '2026-09-02') {
        return buildScheduleResult(makeGamesForDate(69, '2026-09-02', 1000));
      }
      return buildScheduleResult([]);
    });
    const expectedPlan = buildMockPlan();
    mockPlan.mockReturnValue({ ok: true, plan: expectedPlan });

    const { io, stdout, stderr } = createIO();
    const code = await runMLBProspectiveHoldoutActivationPlanCLI(['node', 'script', 'act-1'], io, fixture.deps);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledTimes(1);
    expect(stderr).not.toHaveBeenCalled();
    expect(() => JSON.parse(stdout.mock.calls[0]![0])).not.toThrow();
  });

  it('51b. CLI stderr contains JSON error on failure', async () => {
    const fixture = createMockDependencies();
    fixture.provider.mockImplementation(async (date: string) => {
      if (date === '2026-09-01') {
        return buildScheduleResult([buildScheduleGame({ gamePk: 1, gameType: 'Z' })]);
      }
      return buildScheduleResult([]);
    });

    const { io, stdout, stderr } = createIO();
    const code = await runMLBProspectiveHoldoutActivationPlanCLI(['node', 'script', 'act-1'], io, fixture.deps);

    expect(code).toBe(1);
    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledTimes(1);
    const error = JSON.parse(stderr.mock.calls[0]![0]);
    expect(error).toHaveProperty('kind');
    expect(Array.isArray(error.issues)).toBe(true);
    expect(error.issues.length).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  Static architecture tests                                                 */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-activation-plan-cli static architecture', () => {
  it('does not contain sportsbook/odds/market/score/result/label/model references', async () => {
    const fs = await import('node:fs');
    const scriptPath = new URL('../../../scripts/mlb-prospective-holdout-activation-plan.ts', import.meta.url).pathname;
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
    const scriptPath = new URL('../../../scripts/mlb-prospective-holdout-activation-plan.ts', import.meta.url).pathname;
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
    const scriptPath = new URL('../../../scripts/mlb-prospective-holdout-activation-plan.ts', import.meta.url).pathname;
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

  it('contains no hard-coded /Users/samkassirov', async () => {
    const fs = await import('node:fs');
    const scriptPath = new URL('../../../scripts/mlb-prospective-holdout-activation-plan.ts', import.meta.url).pathname;
    const scriptContent = await fs.promises.readFile(scriptPath, 'utf-8');
    expect(scriptContent).not.toContain('/Users/samkassirov');
  });
});
