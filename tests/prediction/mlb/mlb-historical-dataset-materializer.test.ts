import { describe, it, expect, vi } from 'vitest';
import { materializeMLBHistoricalDataset } from '@/prediction/mlb/mlb-historical-dataset-materializer';
import type { MLBHistoricalMaterializationClock } from '@/prediction/mlb/mlb-historical-dataset-materializer';
import type {
  MLBHistoricalMaterializationSourceAdapter,
  MLBHistoricalProspectiveStarterResult,
} from '@/prediction/mlb/mlb-historical-materialization-source-adapter';
import type {
  CanonicalHistoricalScheduleGame,
  TeamHistoricalAggregate,
  PitcherHistoricalAggregate,
  MLBHistoricalAcquisitionProvenance,
  MLBHistoricalOutcomeWithProvenance,
  CanonicalHistoricalOutcome,
} from '@/lib/backtesting/mlb/live-history/types';
import type { PregamePitcherObservation } from '@/lib/backtesting/mlb/live-history/pregame-pitcher-observation-store';

const FROZEN_NOW = new Date('2026-04-02T00:00:00.000Z');

function createDate(iso: string): Date {
  return new Date(iso);
}

function cloneObservation(
  observation: PregamePitcherObservation,
  overrides: Partial<PregamePitcherObservation> = {},
): PregamePitcherObservation {
  return Object.assign({}, observation, overrides);
}

function createProvenance(endpoint: string, fetchedAt = createDate('2026-04-01T23:00:00.000Z')): MLBHistoricalAcquisitionProvenance {
  return {
    endpoint,
    fetchedAt,
    sourceTimestamp: createDate('2026-04-01T11:55:00.000Z'),
  };
}

function createScheduleGame(overrides: Partial<CanonicalHistoricalScheduleGame> = {}): CanonicalHistoricalScheduleGame {
  return {
    gamePk: 1,
    officialDate: '2026-04-01',
    scheduledStart: createDate('2026-04-01T18:00:00.000Z'),
    cutoffTime: createDate('2026-04-01T12:00:00.000Z'),
    status: 'FINAL',
    homeTeamId: 100,
    homeTeamName: 'Home Team',
    awayTeamId: 200,
    awayTeamName: 'Away Team',
    venueId: 1,
    venueName: 'Test Stadium',
    doubleheader: false,
    gameNumber: 1,
    scheduledInnings: 9,
    homeProbablePitcherId: null,
    awayProbablePitcherId: null,
    homeStarterSource: 'SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN',
    awayStarterSource: 'SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN',
    rescheduledFromGamePk: null,
    rawGameType: 'R',
    warnings: [],
    provenance: createProvenance('/api/v1/schedule'),
    ...overrides,
  };
}

function createTeamAggregate(teamId: number): TeamHistoricalAggregate {
  return {
    teamId,
    gamesPlayed: 10,
    wins: 6,
    losses: 4,
    winRate: 0.6,
    runsScored: 30,
    runsAllowed: 25,
    runDifferential: 5,
    runsScoredPerGame: 3,
    runsAllowedPerGame: 2.5,
    recent5Wins: 3,
    recent5Losses: 2,
    recent10Wins: 6,
    recent10Losses: 4,
    recent10RunsPerGame: 3.2,
    homeWins: 4,
    homeLosses: 1,
    awayWins: 2,
    awayLosses: 3,
    restDays: 1,
    gamesInPrevious3Days: 1,
    extraInningGames: 0,
    sampleSize: 10,
    warnings: [],
  };
}

function createPitcherAggregate(personId: number): PitcherHistoricalAggregate {
  return {
    personId,
    teamId: 100,
    appearances: 5,
    gamesStarted: 5,
    outsRecorded: 15,
    inningsPitchedDisplay: '5.0',
    earnedRuns: 2,
    hitsAllowed: 4,
    walks: 1,
    strikeouts: 30,
    homeRunsAllowed: 0,
    era: 3.6,
    whip: 1.0,
    kPer9: 9.0,
    bbPer9: 1.8,
    hPer9: 7.2,
    hrPer9: 0.0,
    previousStartDate: createDate('2026-03-25T00:00:00.000Z'),
    daysRest: 7,
    recent3Starts: [],
    recent5Starts: [],
    sampleSize: 5,
    warnings: [],
  };
}

const DEFAULT_PITCHER_AGGREGATES: Record<number, PitcherHistoricalAggregate> = {
  123: createPitcherAggregate(123),
  456: createPitcherAggregate(456),
};

function createOutcome(): CanonicalHistoricalOutcome {
  return {
    gamePk: 1,
    status: 'FINAL',
    homeScore: 3,
    awayScore: 2,
    winner: 'HOME',
    innings: 9,
    completedAt: createDate('2026-04-01T22:00:00.000Z'),
    completedAtSource: 'LAST_COMPLETED_PLAY_END',
    warnings: [],
  };
}

function createOutcomeWithProvenance(): MLBHistoricalOutcomeWithProvenance {
  return {
    outcome: createOutcome(),
    provenance: createProvenance('/api/v1.1/game/1/feed/live'),
  };
}

function createStarterResult(overrides: Partial<MLBHistoricalProspectiveStarterResult> = {}): MLBHistoricalProspectiveStarterResult {
  return {
    pitcherId: 123,
    source: 'SCHEDULE_PROBABLE_BEFORE_CUTOFF',
    observedAt: createDate('2026-04-01T12:00:00.000Z'),
    observation: {
      schemaVersion: 'phase1g-a-v1',
      sport: 'mlb',
      gamePk: 1,
      observedAt: createDate('2026-04-01T12:00:00.000Z'),
      scheduledStart: createDate('2026-04-01T18:00:00.000Z'),
      homeProbablePitcherId: 123,
      awayProbablePitcherId: 456,
      homeTeamId: 100,
      awayTeamId: 200,
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: {},
      sourceResponseHash: 'abc123',
      observationContext: 'PROSPECTIVE_LIVE',
      provenance: 'SCHEDULE_PROBABLE_OBSERVED_AT',
      warnings: [],
    },
    ...overrides,
  };
}

function createSourceAdapter(overrides: {
  scheduleGames?: CanonicalHistoricalScheduleGame[];
  teamAggregates?: Record<string, TeamHistoricalAggregate>;
  pitcherAggregates?: Record<number, PitcherHistoricalAggregate>;
  starterResults?: Record<string, MLBHistoricalProspectiveStarterResult>;
  outcome?: MLBHistoricalOutcomeWithProvenance;
} = {}): MLBHistoricalMaterializationSourceAdapter {
  const {
    scheduleGames = [createScheduleGame()],
    teamAggregates = { '100': createTeamAggregate(100), '200': createTeamAggregate(200) },
    pitcherAggregates = { ...DEFAULT_PITCHER_AGGREGATES },
    starterResults = {
      '1-home': createStarterResult({ pitcherId: 123 }),
      '1-away': createStarterResult({ pitcherId: 456 }),
    },
    outcome = createOutcomeWithProvenance(),
  } = overrides;

  return {
    async loadScheduleGamesForDateRange() {
      return scheduleGames;
    },
    async loadTeamStatsAsOf({ teamId }) {
      const aggregate = teamAggregates[String(teamId)];
      if (!aggregate) throw new Error(`Team ${teamId} missing`);
      return { aggregate, provenance: [createProvenance(`team-${teamId}`)] };
    },
    async resolveProspectiveStarter({ gamePk, side }) {
      const key = `${gamePk}-${side}`;
      const result = starterResults[key];
      if (!result) throw new Error(`Starter ${key} missing`);
      return result;
    },
    async loadPitcherStatsAsOf({ personId }) {
      const aggregate = pitcherAggregates[personId];
      if (!aggregate) throw new Error(`Pitcher ${personId} missing`);
      return { aggregate, provenance: [createProvenance(`pitcher-${personId}`)] };
    },
    async loadOfficialFinalOutcome({ gamePk }) {
      if (gamePk !== 1 && scheduleGames.length === 1) throw new Error(`Unexpected gamePk ${gamePk}`);
      return {
        outcome: { ...outcome.outcome, gamePk },
        provenance: outcome.provenance,
      };
    },
  };
}

function createClock(now = FROZEN_NOW): MLBHistoricalMaterializationClock {
  return { now: () => now };
}

function createAdvancingClock(start: Date): MLBHistoricalMaterializationClock {
  let tick = 0;
  return {
    now: () => {
      tick += 1;
      return new Date(start.getTime() + tick * 1000);
    },
  };
}

const VALID_SPLIT_POLICY = {
  strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1' as const,
  embargoDays: 0,
  train: { startDate: '2026-04-01', endDate: '2026-04-30' },
  validation: { startDate: '2026-05-01', endDate: '2026-05-31' },
  test: { startDate: '2026-06-01', endDate: '2026-06-30' },
};

describe('materializeMLBHistoricalDataset', () => {
  it('validates input before source calls', async () => {
    const source = createSourceAdapter();
    const clock = createClock();

    await expect(
      materializeMLBHistoricalDataset({
        startDate: 'invalid',
        endDate: '2026-04-02',
        cutoffMinutesBeforeStart: 360,
        sourceAdapter: source,
        clock,
        datasetId: 'ds-1',
        splitPolicy: VALID_SPLIT_POLICY,
      }),
    ).rejects.toThrow('Invalid startDate: YYYY-MM-DD required');
  });

  it('rejects invalid end date', async () => {
    const source = createSourceAdapter();
    const clock = createClock();

    await expect(
      materializeMLBHistoricalDataset({
        startDate: '2026-04-01',
        endDate: 'not-a-date',
        cutoffMinutesBeforeStart: 360,
        sourceAdapter: source,
        clock,
        datasetId: 'ds-1',
        splitPolicy: VALID_SPLIT_POLICY,
      }),
    ).rejects.toThrow('Invalid endDate: YYYY-MM-DD required');
  });

  it('rejects when start > end', async () => {
    const source = createSourceAdapter();
    const clock = createClock();

    await expect(
      materializeMLBHistoricalDataset({
        startDate: '2026-04-02',
        endDate: '2026-04-01',
        cutoffMinutesBeforeStart: 360,
        sourceAdapter: source,
        clock,
        datasetId: 'ds-1',
        splitPolicy: VALID_SPLIT_POLICY,
      }),
    ).rejects.toThrow('startDate must be <= endDate');
  });

  it('rejects non-positive cutoff', async () => {
    const source = createSourceAdapter();
    const clock = createClock();

    await expect(
      materializeMLBHistoricalDataset({
        startDate: '2026-04-01',
        endDate: '2026-04-01',
        cutoffMinutesBeforeStart: 0,
        sourceAdapter: source,
        clock,
        datasetId: 'ds-1',
        splitPolicy: VALID_SPLIT_POLICY,
      }),
    ).rejects.toThrow('cutoffMinutesBeforeStart must be a positive integer');
  });

  it('rejects negative cutoff', async () => {
    const source = createSourceAdapter();
    const clock = createClock();

    await expect(
      materializeMLBHistoricalDataset({
        startDate: '2026-04-01',
        endDate: '2026-04-01',
        cutoffMinutesBeforeStart: -1,
        sourceAdapter: source,
        clock,
        datasetId: 'ds-1',
        splitPolicy: VALID_SPLIT_POLICY,
      }),
    ).rejects.toThrow('cutoffMinutesBeforeStart must be a positive integer');
  });

  it('rejects NaN cutoff', async () => {
    const source = createSourceAdapter();
    const clock = createClock();

    await expect(
      materializeMLBHistoricalDataset({
        startDate: '2026-04-01',
        endDate: '2026-04-01',
        cutoffMinutesBeforeStart: Number.NaN,
        sourceAdapter: source,
        clock,
        datasetId: 'ds-1',
        splitPolicy: VALID_SPLIT_POLICY,
      }),
    ).rejects.toThrow('cutoffMinutesBeforeStart must be a positive integer');
  });

  it('rejects invalid materialization clock', async () => {
    const source = createSourceAdapter();
    const badClock = { now: () => new Date('invalid') };

    await expect(
      materializeMLBHistoricalDataset({
        startDate: '2026-04-01',
        endDate: '2026-04-01',
        cutoffMinutesBeforeStart: 360,
        sourceAdapter: source,
        clock: badClock,
        datasetId: 'ds-1',
        splitPolicy: VALID_SPLIT_POLICY,
      }),
    ).rejects.toThrow('Invalid materialization clock');
  });

  it('forwards exact date range to source', async () => {
    const games = [createScheduleGame(), createScheduleGame({ gamePk: 2 })];
    const source = createSourceAdapter({
      scheduleGames: games,
      starterResults: {
        '1-home': createStarterResult({ pitcherId: 123 }),
        '1-away': createStarterResult({ pitcherId: 456 }),
        '2-home': createStarterResult({ pitcherId: 789 }),
        '2-away': createStarterResult({ pitcherId: 101 }),
      },
      pitcherAggregates: {
        ...DEFAULT_PITCHER_AGGREGATES,
        789: createPitcherAggregate(789),
        101: createPitcherAggregate(101),
      },
    });
    const clock = createClock();

    await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-02',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-range',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(games).toHaveLength(2);
  });

  it('orders games deterministically by start then gamePk', async () => {
    const scheduleGames = [
      createScheduleGame({ gamePk: 2, scheduledStart: createDate('2026-04-01T19:00:00.000Z') }),
      createScheduleGame({ gamePk: 1, scheduledStart: createDate('2026-04-01T18:00:00.000Z') }),
    ];
    const source = createSourceAdapter({
      scheduleGames,
      starterResults: {
        '1-home': createStarterResult({ pitcherId: 123 }),
        '1-away': createStarterResult({ pitcherId: 456 }),
        '2-home': createStarterResult({ pitcherId: 789 }),
        '2-away': createStarterResult({ pitcherId: 101 }),
      },
      pitcherAggregates: {
        ...DEFAULT_PITCHER_AGGREGATES,
        789: createPitcherAggregate(789),
        101: createPitcherAggregate(101),
      },
    });
    const clock = createClock();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-order',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(result.dataset.examples[0].snapshot.game.gameId).toBe('1');
    expect(result.dataset.examples[1].snapshot.game.gameId).toBe('2');
  });

  it('preserves exact gamePk', async () => {
    const source = createSourceAdapter();
    const clock = createClock();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-pk',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(result.dataset.examples[0].snapshot.game.gameId).toBe('1');
    expect(result.dataset.examples[0].label.source.sourceRecordId).toBe('1');
  });

  it('does not mutate input schedule array', async () => {
    const scheduleGame = createScheduleGame();
    const scheduleSnapshot = JSON.stringify(scheduleGame);
    const source = createSourceAdapter({ scheduleGames: [scheduleGame] });
    const clock = createClock();

    await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-mut',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(JSON.stringify(scheduleGame)).toBe(scheduleSnapshot);
  });

  it('reverse schedule order yields deeply equal dataset', async () => {
    const gameA = createScheduleGame({
      gamePk: 1,
      scheduledStart: createDate('2026-04-01T18:00:00.000Z'),
    });
    const gameB = createScheduleGame({
      gamePk: 2,
      scheduledStart: createDate('2026-04-01T19:00:00.000Z'),
    });
    const sourceA = createSourceAdapter({
      scheduleGames: [gameA, gameB],
      starterResults: {
        '1-home': createStarterResult({ pitcherId: 123 }),
        '1-away': createStarterResult({ pitcherId: 456 }),
        '2-home': createStarterResult({ pitcherId: 789 }),
        '2-away': createStarterResult({ pitcherId: 101 }),
      },
      pitcherAggregates: {
        ...DEFAULT_PITCHER_AGGREGATES,
        789: createPitcherAggregate(789),
        101: createPitcherAggregate(101),
      },
    });
    const sourceB = createSourceAdapter({
      scheduleGames: [gameB, gameA],
      starterResults: {
        '1-home': createStarterResult({ pitcherId: 123 }),
        '1-away': createStarterResult({ pitcherId: 456 }),
        '2-home': createStarterResult({ pitcherId: 789 }),
        '2-away': createStarterResult({ pitcherId: 101 }),
      },
      pitcherAggregates: {
        ...DEFAULT_PITCHER_AGGREGATES,
        789: createPitcherAggregate(789),
        101: createPitcherAggregate(101),
      },
    });
    const clockA = createFixedClock('2026-04-02T00:00:00.000Z');
    const clockB = createFixedClock('2026-04-02T00:00:00.000Z');

    const resultA = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: sourceA,
      clock: clockA,
      datasetId: 'ds-det',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    const resultB = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: sourceB,
      clock: clockB,
      datasetId: 'ds-det',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(resultA.dataset).toEqual(resultB.dataset);
  });

  it('forwards R rawGameType unchanged', async () => {
    const source = createSourceAdapter();
    const clock = createClock();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-r',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(result.dataset.examples[0].snapshot.game.gameType).toBe('REGULAR_SEASON');
  });

  it('forwards P rawGameType unchanged', async () => {
    const source = createSourceAdapter({
      scheduleGames: [createScheduleGame({ rawGameType: 'P' })],
    });
    const clock = createClock();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-p',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(result.dataset.examples[0].snapshot.game.gameType).toBe('POSTSEASON');
  });

  it('fails whole run on null rawGameType', async () => {
    const source = createSourceAdapter({
      scheduleGames: [createScheduleGame({ rawGameType: null })],
    });
    const clock = createClock();

    await expect(
      materializeMLBHistoricalDataset({
        startDate: '2026-04-01',
        endDate: '2026-04-01',
        cutoffMinutesBeforeStart: 360,
        sourceAdapter: source,
        clock,
        datasetId: 'ds-null',
        splitPolicy: VALID_SPLIT_POLICY,
      }),
    ).rejects.toThrow('Missing rawGameType');
  });

  it('fails whole run on undefined rawGameType', async () => {
    const source = createSourceAdapter({
      scheduleGames: [
        {
          gamePk: 1,
          officialDate: '2026-04-01',
          scheduledStart: createDate('2026-04-01T18:00:00.000Z'),
          cutoffTime: createDate('2026-04-01T12:00:00.000Z'),
          status: 'FINAL',
          homeTeamId: 100,
          homeTeamName: 'Home Team',
          awayTeamId: 200,
          awayTeamName: 'Away Team',
          venueId: 1,
          venueName: 'Test Stadium',
          doubleheader: false,
          gameNumber: 1,
          scheduledInnings: 9,
          homeProbablePitcherId: null,
          awayProbablePitcherId: null,
          homeStarterSource: 'SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN',
          awayStarterSource: 'SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN',
          rescheduledFromGamePk: null,
          warnings: [],
          provenance: createProvenance('/api/v1/schedule'),
        } as CanonicalHistoricalScheduleGame,
      ],
    });
    const clock = createClock();

    await expect(
      materializeMLBHistoricalDataset({
        startDate: '2026-04-01',
        endDate: '2026-04-01',
        cutoffMinutesBeforeStart: 360,
        sourceAdapter: source,
        clock,
        datasetId: 'ds-undef',
        splitPolicy: VALID_SPLIT_POLICY,
      }),
    ).rejects.toThrow('Missing rawGameType');
  });

  it('fails whole run on empty rawGameType', async () => {
    const source = createSourceAdapter({
      scheduleGames: [createScheduleGame({ rawGameType: '' })],
    });
    const clock = createClock();

    await expect(
      materializeMLBHistoricalDataset({
        startDate: '2026-04-01',
        endDate: '2026-04-01',
        cutoffMinutesBeforeStart: 360,
        sourceAdapter: source,
        clock,
        datasetId: 'ds-empty',
        splitPolicy: VALID_SPLIT_POLICY,
      }),
    ).rejects.toThrow('Missing rawGameType');
  });

  it('fails before outcome acquisition on missing rawGameType', async () => {
    const outcomeSpy = vi.fn();
    const source = createSourceAdapter({
      scheduleGames: [createScheduleGame({ rawGameType: null })],
    });
    const clock = createClock();

    await expect(
      materializeMLBHistoricalDataset({
        startDate: '2026-04-01',
        endDate: '2026-04-01',
        cutoffMinutesBeforeStart: 360,
        sourceAdapter: {
          ...source,
          loadOfficialFinalOutcome: outcomeSpy,
        },
        clock,
        datasetId: 'ds-no-outcome',
        splitPolicy: VALID_SPLIT_POLICY,
      }),
    ).rejects.toThrow('Missing rawGameType');

    expect(outcomeSpy).not.toHaveBeenCalled();
  });

  it('fails through canonical adapter on unsupported non-empty code', async () => {
    const outcomeSpy = vi.fn();
    const source = createSourceAdapter({
      scheduleGames: [createScheduleGame({ rawGameType: 'X' })],
    });
    const clock = createClock();

    await expect(
      materializeMLBHistoricalDataset({
        startDate: '2026-04-01',
        endDate: '2026-04-01',
        cutoffMinutesBeforeStart: 360,
        sourceAdapter: {
          ...source,
          loadOfficialFinalOutcome: outcomeSpy,
        },
        clock,
        datasetId: 'ds-unsupported',
        splitPolicy: VALID_SPLIT_POLICY,
      }),
    ).rejects.toThrow('Snapshot invalid');

    expect(outcomeSpy).not.toHaveBeenCalled();
  });

  it('does not default missing rawGameType to R', async () => {
    const source = createSourceAdapter({
      scheduleGames: [createScheduleGame({ rawGameType: undefined } as Partial<CanonicalHistoricalScheduleGame>)],
    });
    const clock = createClock();

    await expect(
      materializeMLBHistoricalDataset({
        startDate: '2026-04-01',
        endDate: '2026-04-01',
        cutoffMinutesBeforeStart: 360,
        sourceAdapter: source,
        clock,
        datasetId: 'ds-nodefault',
        splitPolicy: VALID_SPLIT_POLICY,
      }),
    ).rejects.toThrow('Missing rawGameType');
  });

  it('calls team stats with exact home teamId and cutoff', async () => {
    const homeSpy = vi.fn();
    const awaySpy = vi.fn();
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [createScheduleGame()];
      },
      async loadTeamStatsAsOf({ teamId, cutoff, season }) {
        if (teamId === 100) {
          homeSpy({ teamId, cutoff, season });
          expect(cutoff).toEqual(createDate('2026-04-01T12:00:00.000Z'));
          expect(season).toBe(2026);
        }
        if (teamId === 200) {
          awaySpy({ teamId, cutoff, season });
          expect(cutoff).toEqual(createDate('2026-04-01T12:00:00.000Z'));
          expect(season).toBe(2026);
        }
        const aggregate = teamId === 100 ? createTeamAggregate(100) : createTeamAggregate(200);
        return { aggregate, provenance: [createProvenance(`team-${teamId}`)] };
      },
      async resolveProspectiveStarter() {
        return createStarterResult({ pitcherId: null, source: 'UNAVAILABLE', observedAt: null });
      },
      async loadPitcherStatsAsOf() {
        throw new Error('unexpected pitcher call');
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-team',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(homeSpy).toHaveBeenCalledWith({ teamId: 100, cutoff: createDate('2026-04-01T12:00:00.000Z'), season: 2026 });
    expect(awaySpy).toHaveBeenCalledWith({ teamId: 200, cutoff: createDate('2026-04-01T12:00:00.000Z'), season: 2026 });
  });

  it('calls team stats with exact away teamId and cutoff', async () => {
    const homeSpy = vi.fn();
    const awaySpy = vi.fn();
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [createScheduleGame()];
      },
      async loadTeamStatsAsOf({ teamId, cutoff, season }) {
        if (teamId === 100) {
          homeSpy({ teamId, cutoff, season });
          expect(cutoff).toEqual(createDate('2026-04-01T12:00:00.000Z'));
          expect(season).toBe(2026);
        }
        if (teamId === 200) {
          awaySpy({ teamId, cutoff, season });
          expect(cutoff).toEqual(createDate('2026-04-01T12:00:00.000Z'));
          expect(season).toBe(2026);
        }
        const aggregate = teamId === 100 ? createTeamAggregate(100) : createTeamAggregate(200);
        return { aggregate, provenance: [createProvenance(`team-${teamId}`)] };
      },
      async resolveProspectiveStarter() {
        return createStarterResult({ pitcherId: null, source: 'UNAVAILABLE', observedAt: null });
      },
      async loadPitcherStatsAsOf() {
        throw new Error('unexpected pitcher call');
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-team-away',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(homeSpy).toHaveBeenCalledWith({ teamId: 100, cutoff: createDate('2026-04-01T12:00:00.000Z'), season: 2026 });
    expect(awaySpy).toHaveBeenCalledWith({ teamId: 200, cutoff: createDate('2026-04-01T12:00:00.000Z'), season: 2026 });
  });

  it('forwards team provenance', async () => {
    const teamProvenance = [createProvenance('team-custom')];
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [createScheduleGame()];
      },
      async loadTeamStatsAsOf({ teamId }) {
        const aggregate = teamId === 100 ? createTeamAggregate(100) : createTeamAggregate(200);
        return { aggregate, provenance: teamProvenance };
      },
      async resolveProspectiveStarter() {
        return createStarterResult({ pitcherId: null, source: 'UNAVAILABLE', observedAt: null });
      },
      async loadPitcherStatsAsOf() {
        throw new Error('unexpected pitcher call');
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-prov',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    const sourceRefIds = result.dataset.examples[0].snapshot.sourceReferences.map((r) => r.sourceRefId);
    expect(sourceRefIds.some((id) => id.includes('team-custom'))).toBe(true);
  });

  it('does not call pitcher history when starter unavailable', async () => {
    const pitcherSpy = vi.fn();
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [createScheduleGame()];
      },
      async loadTeamStatsAsOf({ teamId }) {
        const aggregate = teamId === 100 ? createTeamAggregate(100) : createTeamAggregate(200);
        return { aggregate, provenance: [createProvenance(`team-${teamId}`)] };
      },
      async resolveProspectiveStarter() {
        return createStarterResult({ pitcherId: null, source: 'UNAVAILABLE', observedAt: null });
      },
      async loadPitcherStatsAsOf(...args) {
        pitcherSpy(...args);
        return { aggregate: createPitcherAggregate(args[0].personId), provenance: [createProvenance(`pitcher-${args[0].personId}`)] };
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-nopit',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(pitcherSpy).not.toHaveBeenCalled();
  });

  it('calls pitcher history when home starter before cutoff', async () => {
    const pitcherSpy = vi.fn();
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [createScheduleGame()];
      },
      async loadTeamStatsAsOf({ teamId }) {
        const aggregate = teamId === 100 ? createTeamAggregate(100) : createTeamAggregate(200);
        return { aggregate, provenance: [createProvenance(`team-${teamId}`)] };
      },
      async resolveProspectiveStarter() {
        return createStarterResult({ pitcherId: 123 });
      },
      async loadPitcherStatsAsOf(...args) {
        pitcherSpy(...args);
        return { aggregate: createPitcherAggregate(args[0].personId), provenance: [createProvenance(`pitcher-${args[0].personId}`)] };
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-home-pit',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(pitcherSpy).toHaveBeenCalledWith({
      personId: 123,
      cutoff: createDate('2026-04-01T12:00:00.000Z'),
      season: 2026,
    });
  });

  it('calls pitcher history when away starter before cutoff', async () => {
    const pitcherSpy = vi.fn();
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [createScheduleGame()];
      },
      async loadTeamStatsAsOf({ teamId }) {
        const aggregate = teamId === 100 ? createTeamAggregate(100) : createTeamAggregate(200);
        return { aggregate, provenance: [createProvenance(`team-${teamId}`)] };
      },
      async resolveProspectiveStarter() {
        return createStarterResult({ pitcherId: 456 });
      },
      async loadPitcherStatsAsOf(...args) {
        pitcherSpy(...args);
        return { aggregate: createPitcherAggregate(args[0].personId), provenance: [createProvenance(`pitcher-${args[0].personId}`)] };
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-away-pit',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(pitcherSpy).toHaveBeenCalledWith({
      personId: 456,
      cutoff: createDate('2026-04-01T12:00:00.000Z'),
      season: 2026,
    });
  });

  it('treats exactly cutoff as eligible', async () => {
    const source = createSourceAdapter({
      starterResults: {
        '1-home': createStarterResult({ pitcherId: 123, observedAt: createDate('2026-04-01T12:00:00.000Z') }),
        '1-away': createStarterResult({ pitcherId: null, source: 'UNAVAILABLE', observedAt: null }),
      },
    });
    const clock = createClock();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-cutoff-eligible',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(result.summary.materializedExamples).toBe(1);
  });

  it('does not call pitcher history when starter after cutoff', async () => {
    const pitcherSpy = vi.fn();
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [createScheduleGame()];
      },
      async loadTeamStatsAsOf({ teamId }) {
        const aggregate = teamId === 100 ? createTeamAggregate(100) : createTeamAggregate(200);
        return { aggregate, provenance: [createProvenance(`team-${teamId}`)] };
      },
      async resolveProspectiveStarter() {
        return createStarterResult({ pitcherId: 123, observedAt: createDate('2026-04-01T13:00:00.000Z') });
      },
      async loadPitcherStatsAsOf(...args) {
        pitcherSpy(...args);
        return { aggregate: createPitcherAggregate(args[0].personId), provenance: [createProvenance(`pitcher-${args[0].personId}`)] };
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-after-cutoff',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(pitcherSpy).not.toHaveBeenCalled();
  });

  it('schedule probable ID cannot unlock pitcher history', async () => {
    const pitcherSpy = vi.fn();
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [
          createScheduleGame({
            homeProbablePitcherId: 123,
            homeStarterSource: 'SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN',
            awayProbablePitcherId: 456,
            awayStarterSource: 'SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN',
          }),
        ];
      },
      async loadTeamStatsAsOf({ teamId }) {
        const aggregate = teamId === 100 ? createTeamAggregate(100) : createTeamAggregate(200);
        return { aggregate, provenance: [createProvenance(`team-${teamId}`)] };
      },
      async resolveProspectiveStarter() {
        return createStarterResult({ pitcherId: null, source: 'UNAVAILABLE', observedAt: null });
      },
      async loadPitcherStatsAsOf(...args) {
        pitcherSpy(...args);
        return { aggregate: createPitcherAggregate(args[0].personId), provenance: [createProvenance(`pitcher-${args[0].personId}`)] };
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };

    const clock = createClock();
    await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-probable',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(pitcherSpy).not.toHaveBeenCalled();
  });

  it('does not call pitcher history when starter observation is null', async () => {
    const pitcherSpy = vi.fn();
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [createScheduleGame()];
      },
      async loadTeamStatsAsOf() {
        return { aggregate: createTeamAggregate(100), provenance: [] };
      },
      async resolveProspectiveStarter() {
        return createStarterResult({ pitcherId: 123, observation: null });
      },
      async loadPitcherStatsAsOf(...args) {
        pitcherSpy(...args);
        return { aggregate: createPitcherAggregate(args[0].personId), provenance: [] };
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-null-obs',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(pitcherSpy).not.toHaveBeenCalled();
  });

  it('does not call pitcher history when starter top-level observedAt is null', async () => {
    const pitcherSpy = vi.fn();
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [createScheduleGame()];
      },
      async loadTeamStatsAsOf() {
        return { aggregate: createTeamAggregate(100), provenance: [] };
      },
      async resolveProspectiveStarter() {
        return createStarterResult({ pitcherId: 123, observedAt: null as unknown as Date });
      },
      async loadPitcherStatsAsOf(...args) {
        pitcherSpy(...args);
        return { aggregate: createPitcherAggregate(args[0].personId), provenance: [] };
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-null-top-obs',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(pitcherSpy).not.toHaveBeenCalled();
  });

  it('does not call pitcher history when starter observedAt is invalid', async () => {
    const pitcherSpy = vi.fn();
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [createScheduleGame()];
      },
      async loadTeamStatsAsOf() {
        return { aggregate: createTeamAggregate(100), provenance: [] };
      },
      async resolveProspectiveStarter() {
        return createStarterResult({ pitcherId: 123, observedAt: new Date(NaN) });
      },
      async loadPitcherStatsAsOf(...args) {
        pitcherSpy(...args);
        return { aggregate: createPitcherAggregate(args[0].personId), provenance: [] };
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-invalid-obs',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(pitcherSpy).not.toHaveBeenCalled();
  });

  it('derives starter source reference from truthful observation', async () => {
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [
          createScheduleGame({
            homeProbablePitcherId: 123,
            homeStarterSource: 'SCHEDULE_PROBABLE_BEFORE_CUTOFF',
            awayProbablePitcherId: 456,
            awayStarterSource: 'SCHEDULE_PROBABLE_BEFORE_CUTOFF',
          }),
        ];
      },
      async loadTeamStatsAsOf() {
        return { aggregate: createTeamAggregate(100), provenance: [] };
      },
      async resolveProspectiveStarter() {
        return createStarterResult({ pitcherId: 123 });
      },
      async loadPitcherStatsAsOf() {
        return { aggregate: createPitcherAggregate(123), provenance: [] };
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-src-ref',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    const snapshot = result.dataset.examples[0].snapshot;
    const sourceRefIds = snapshot.sourceReferences.map((r) => r.sourceRefId);
    const starterSourceRefId = '/api/v1/schedule:2026-04-01T12:00:00.000Z';
    expect(sourceRefIds).toContain(starterSourceRefId);
    expect(snapshot.startingPitchers.home.sourceRefIds).toEqual([starterSourceRefId]);
  });

  it('treats mismatched observation gamePk as unavailable', async () => {
    const pitcherSpy = vi.fn();
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [createScheduleGame({ gamePk: 1 })];
      },
      async loadTeamStatsAsOf() {
        return { aggregate: createTeamAggregate(100), provenance: [] };
      },
      async resolveProspectiveStarter() {
        return createStarterResult({ pitcherId: 123, observation: Object.assign({}, createStarterResult().observation, { gamePk: 2 }) as PregamePitcherObservation });
      },
      async loadPitcherStatsAsOf(...args) {
        pitcherSpy(...args);
        return { aggregate: createPitcherAggregate(args[0].personId), provenance: [] };
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-wrong-game',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(pitcherSpy).not.toHaveBeenCalled();
  });

  it('treats mismatched HOME pitcher identity as unavailable', async () => {
    const pitcherSpy = vi.fn();
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [createScheduleGame()];
      },
      async loadTeamStatsAsOf() {
        return { aggregate: createTeamAggregate(100), provenance: [] };
      },
      async resolveProspectiveStarter() {
        return createStarterResult({ pitcherId: 123, observation: Object.assign({}, createStarterResult().observation, { homeProbablePitcherId: 999 }) as PregamePitcherObservation });
      },
      async loadPitcherStatsAsOf(...args) {
        pitcherSpy(...args);
        return { aggregate: createPitcherAggregate(args[0].personId), provenance: [] };
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-wrong-home-pitcher',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(pitcherSpy).not.toHaveBeenCalled();
  });

  it('rejects opposite-side pitcher identity substitution for HOME', async () => {
    const pitcherSpy = vi.fn();
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [createScheduleGame()];
      },
      async loadTeamStatsAsOf() {
        return { aggregate: createTeamAggregate(100), provenance: [] };
      },
      async resolveProspectiveStarter({ side }) {
        if (side === 'home') {
          return createStarterResult({
            pitcherId: 123,
            observation: cloneObservation(createStarterResult().observation!, {
              homeProbablePitcherId: 999,
              awayProbablePitcherId: 123,
            }),
          });
        }

        return createStarterResult({ pitcherId: null, source: 'UNAVAILABLE', observedAt: null, observation: null });
      },
      async loadPitcherStatsAsOf(...args) {
        pitcherSpy(...args);
        return { aggregate: createPitcherAggregate(args[0].personId), provenance: [] };
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-opposite-home',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(pitcherSpy).not.toHaveBeenCalled();
  });

  it('treats mismatched AWAY pitcher identity as unavailable', async () => {
    const pitcherSpy = vi.fn();
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [createScheduleGame()];
      },
      async loadTeamStatsAsOf() {
        return { aggregate: createTeamAggregate(100), provenance: [] };
      },
      async resolveProspectiveStarter() {
        return createStarterResult({ pitcherId: 456, observation: Object.assign({}, createStarterResult().observation, { awayProbablePitcherId: 999 }) as PregamePitcherObservation });
      },
      async loadPitcherStatsAsOf(...args) {
        pitcherSpy(...args);
        return { aggregate: createPitcherAggregate(args[0].personId), provenance: [] };
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-wrong-away-pitcher',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(pitcherSpy).not.toHaveBeenCalled();
  });

  it('treats mismatched home team identity as unavailable', async () => {
    const pitcherSpy = vi.fn();
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [createScheduleGame()];
      },
      async loadTeamStatsAsOf() {
        return { aggregate: createTeamAggregate(100), provenance: [] };
      },
      async resolveProspectiveStarter() {
        return createStarterResult({ pitcherId: 123, observation: Object.assign({}, createStarterResult().observation, { homeTeamId: 999 }) as PregamePitcherObservation });
      },
      async loadPitcherStatsAsOf(...args) {
        pitcherSpy(...args);
        return { aggregate: createPitcherAggregate(args[0].personId), provenance: [] };
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-wrong-home-team',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(pitcherSpy).not.toHaveBeenCalled();
  });

  it('treats mismatched away team identity as unavailable', async () => {
    const pitcherSpy = vi.fn();
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [createScheduleGame()];
      },
      async loadTeamStatsAsOf() {
        return { aggregate: createTeamAggregate(100), provenance: [] };
      },
      async resolveProspectiveStarter() {
        return createStarterResult({ pitcherId: 123, observation: Object.assign({}, createStarterResult().observation, { awayTeamId: 999 }) as PregamePitcherObservation });
      },
      async loadPitcherStatsAsOf(...args) {
        pitcherSpy(...args);
        return { aggregate: createPitcherAggregate(args[0].personId), provenance: [] };
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-wrong-away-team',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(pitcherSpy).not.toHaveBeenCalled();
  });

  it('treats mismatched scheduledStart as unavailable', async () => {
    const pitcherSpy = vi.fn();
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [createScheduleGame()];
      },
      async loadTeamStatsAsOf() {
        return { aggregate: createTeamAggregate(100), provenance: [] };
      },
      async resolveProspectiveStarter() {
        return createStarterResult({ pitcherId: 123, observation: Object.assign({}, createStarterResult().observation, { scheduledStart: createDate('2026-04-01T19:00:00.000Z') }) as PregamePitcherObservation });
      },
      async loadPitcherStatsAsOf(...args) {
        pitcherSpy(...args);
        return { aggregate: createPitcherAggregate(args[0].personId), provenance: [] };
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-wrong-scheduled-start',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(pitcherSpy).not.toHaveBeenCalled();
  });

  it('preserves eligible HOME starter with matching observation identity', async () => {
    const pitcherSpy = vi.fn();
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [
          createScheduleGame({
            homeProbablePitcherId: 123,
            homeStarterSource: 'SCHEDULE_PROBABLE_BEFORE_CUTOFF',
          }),
        ];
      },
      async loadTeamStatsAsOf() {
        return { aggregate: createTeamAggregate(100), provenance: [] };
      },
      async resolveProspectiveStarter() {
        return createStarterResult({ pitcherId: 123 });
      },
      async loadPitcherStatsAsOf(...args) {
        pitcherSpy(...args);
        return { aggregate: createPitcherAggregate(args[0].personId), provenance: [] };
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-home-identity',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(pitcherSpy).toHaveBeenCalledTimes(1);
    expect(pitcherSpy).toHaveBeenCalledWith(expect.objectContaining({ personId: 123, cutoff: expect.any(Date) }));
    expect(result.dataset.examples[0].snapshot.startingPitchers.home.pitcherId).toBe('123');
  });

  it('preserves eligible AWAY starter with matching observation identity', async () => {
    const pitcherSpy = vi.fn();
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [
          createScheduleGame({
            awayProbablePitcherId: 456,
            awayStarterSource: 'SCHEDULE_PROBABLE_BEFORE_CUTOFF',
          }),
        ];
      },
      async loadTeamStatsAsOf() {
        return { aggregate: createTeamAggregate(200), provenance: [] };
      },
      async resolveProspectiveStarter() {
        return createStarterResult({ pitcherId: 456 });
      },
      async loadPitcherStatsAsOf(...args) {
        pitcherSpy(...args);
        return { aggregate: createPitcherAggregate(args[0].personId), provenance: [] };
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-away-identity',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(pitcherSpy).toHaveBeenCalledTimes(1);
    expect(pitcherSpy).toHaveBeenCalledWith(expect.objectContaining({ personId: 456, cutoff: expect.any(Date) }));
    expect(result.dataset.examples[0].snapshot.startingPitchers.away.pitcherId).toBe('456');
  });

  it('applies 360-minute cutoff policy exactly', async () => {
    const source = createSourceAdapter({
      scheduleGames: [
        createScheduleGame({
          gamePk: 1,
          scheduledStart: createDate('2026-04-01T18:00:00.000Z'),
        }),
      ],
    });
    const clock = createClock();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-cutoff-360',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    const snapshot = result.dataset.examples[0].snapshot;
    expect(snapshot.dataCutoffAt).toBe('2026-04-01T12:00:00.000Z');
    expect(snapshot.capturedAt).toBe('2026-04-01T12:00:00.000Z');
  });

  it('applies 90-minute cutoff policy exactly', async () => {
    const source = createSourceAdapter({
      scheduleGames: [
        createScheduleGame({
          gamePk: 1,
          scheduledStart: createDate('2026-04-01T18:00:00.000Z'),
        }),
      ],
    });
    const clock = createClock();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 90,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-cutoff-90',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    const snapshot = result.dataset.examples[0].snapshot;
    expect(snapshot.dataCutoffAt).toBe('2026-04-01T16:30:00.000Z');
    expect(snapshot.capturedAt).toBe('2026-04-01T16:30:00.000Z');
  });

  it('produces identical cutoff for identical scheduledStart and minutes', async () => {
    const source = createSourceAdapter({
      scheduleGames: [
        createScheduleGame({
          gamePk: 1,
          scheduledStart: createDate('2026-04-01T18:00:00.000Z'),
        }),
        createScheduleGame({
          gamePk: 2,
          scheduledStart: createDate('2026-04-01T18:00:00.000Z'),
        }),
      ],
      starterResults: {
        '1-home': createStarterResult({ pitcherId: 123 }),
        '1-away': createStarterResult({ pitcherId: 456 }),
        '2-home': createStarterResult({ pitcherId: 789 }),
        '2-away': createStarterResult({ pitcherId: 101 }),
      },
      pitcherAggregates: {
        123: createPitcherAggregate(123),
        456: createPitcherAggregate(456),
        789: createPitcherAggregate(789),
        101: createPitcherAggregate(101),
      },
    });
    const clock = createClock();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 180,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-cutoff-tie',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    const [first, second] = result.dataset.examples;
    expect(first.snapshot.dataCutoffAt).toBe('2026-04-01T15:00:00.000Z');
    expect(second.snapshot.dataCutoffAt).toBe('2026-04-01T15:00:00.000Z');
    expect(first.snapshot.dataCutoffAt).toBe(second.snapshot.dataCutoffAt);
  });

  it('does not use actual/final starter path', async () => {
    const source = createSourceAdapter({
      starterResults: {
        '1-home': createStarterResult({ pitcherId: null, source: 'UNAVAILABLE', observedAt: null }),
        '1-away': createStarterResult({ pitcherId: null, source: 'UNAVAILABLE', observedAt: null }),
      },
    });
    const clock = createClock();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-no-actual',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(result.summary.materializedExamples).toBe(1);
    expect(result.dataset.examples[0].snapshot.startingPitchers.home.state).toBe('UNAVAILABLE');
    expect(result.dataset.examples[0].snapshot.startingPitchers.away.state).toBe('UNAVAILABLE');
  });

  it('builds snapshot before outcome acquisition', async () => {
    const order: string[] = [];
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        order.push('schedule');
        return [createScheduleGame()];
      },
      async loadTeamStatsAsOf() {
        order.push('team');
        return { aggregate: createTeamAggregate(100), provenance: [createProvenance('team-100')] };
      },
      async resolveProspectiveStarter() {
        order.push('starter');
        return createStarterResult({ pitcherId: null, source: 'UNAVAILABLE', observedAt: null });
      },
      async loadPitcherStatsAsOf() {
        order.push('pitcher');
        return { aggregate: createPitcherAggregate(123), provenance: [createProvenance('pitcher-123')] };
      },
      async loadOfficialFinalOutcome() {
        order.push('outcome');
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-order-check',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    const outcomeIdx = order.indexOf('outcome');
    expect(order.indexOf('schedule')).toBeLessThan(outcomeIdx);
    expect(order.indexOf('team')).toBeLessThan(outcomeIdx);
    expect(order.indexOf('starter')).toBeLessThan(outcomeIdx);
    expect(order.indexOf('pitcher')).toBeLessThan(outcomeIdx);
  });

  it('snapshot failure prevents outcome calls', async () => {
    const outcomeSpy = vi.fn();
    const source = createSourceAdapter({
      scheduleGames: [createScheduleGame({ rawGameType: 'X' })],
    });
    const clock = createClock();

    await expect(
      materializeMLBHistoricalDataset({
        startDate: '2026-04-01',
        endDate: '2026-04-01',
        cutoffMinutesBeforeStart: 360,
        sourceAdapter: {
          ...source,
          loadOfficialFinalOutcome: outcomeSpy,
        },
        clock,
        datasetId: 'ds-snap-fail',
        splitPolicy: VALID_SPLIT_POLICY,
      }),
    ).rejects.toThrow('Snapshot invalid');

    expect(outcomeSpy).not.toHaveBeenCalled();
  });

  it('uses exact outcome gamePk in label source', async () => {
    const source = createSourceAdapter();
    const clock = createClock();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-pk-outcome',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(result.dataset.examples[0].label.source.sourceRecordId).toBe('1');
  });

  it('uses outcome provenance only for label', async () => {
    const distinctFetchedAt = createDate('2026-04-01T22:30:00.000Z');
    const source = createSourceAdapter({
      outcome: {
        outcome: createOutcome(),
        provenance: createProvenance('/api/v1.1/game/1/feed/live', distinctFetchedAt),
      },
    });
    const clock = createClock();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-label-prov',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(result.dataset.examples[0].label.source.sourceName).toBe('mlb-stats-api:feedLive');
    expect(result.dataset.examples[0].label.source.fetchedAt).toBe('2026-04-01T22:30:00.000Z');
    expect(result.dataset.examples[0].label.source.fetchedAt).not.toBe('2026-04-01T12:00:00.000Z');
  });

  it('reconstructedAt comes from injected clock after acquisitions', async () => {
    const clock = createAdvancingClock(createDate('2026-04-02T00:00:00.000Z'));
    const source = createSourceAdapter();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-recon',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(result.dataset.examples[0].reconstruction.reconstructedAt).toBe('2026-04-02T00:00:01.000Z');
  });

  it('dataset.createdAt from later injected clock call after all entries', async () => {
    const clock = createAdvancingClock(createDate('2026-04-02T00:00:00.000Z'));
    const source = createSourceAdapter();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-created',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(result.dataset.createdAt).toBe('2026-04-02T00:00:02.000Z');
  });

  it('createdAt >= all reconstructedAt', async () => {
    const clock = createAdvancingClock(createDate('2026-04-02T00:00:00.000Z'));
    const source = createSourceAdapter();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-created-order',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    const createdMs = Date.parse(result.dataset.createdAt);
    const reconMs = Date.parse(result.dataset.examples[0].reconstruction.reconstructedAt);
    expect(createdMs).toBeGreaterThanOrEqual(reconMs);
  });

  it('caller cannot supply createdAt', async () => {
    const source = createSourceAdapter();
    const clock = createAdvancingClock(createDate('2026-04-02T00:00:00.000Z'));

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-nocreated',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(result.dataset.createdAt).toBe('2026-04-02T00:00:02.000Z');
  });

  it('assigns TRAIN for date in train window', async () => {
    const source = createSourceAdapter();
    const clock = createClock();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-train',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(result.dataset.examples[0].split).toBe('TRAIN');
  });

  it('assigns VALIDATION for date in validation window', async () => {
    const source = createSourceAdapter({
      scheduleGames: [createScheduleGame({ officialDate: '2026-05-15' })],
    });
    const clock = createClock();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-05-15',
      endDate: '2026-05-15',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-valid',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(result.dataset.examples[0].split).toBe('VALIDATION');
  });

  it('assigns TEST for date in test window', async () => {
    const source = createSourceAdapter({
      scheduleGames: [createScheduleGame({ officialDate: '2026-06-15' })],
    });
    const clock = createClock();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-06-15',
      endDate: '2026-06-15',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-test',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(result.dataset.examples[0].split).toBe('TEST');
  });

  it('assigns explicit multi-day split boundaries', async () => {
    const explicitPolicy = {
      strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1' as const,
      embargoDays: 0,
      train: { startDate: '2026-04-01', endDate: '2026-04-20' },
      validation: { startDate: '2026-04-21', endDate: '2026-04-24' },
      test: { startDate: '2026-04-25', endDate: '2026-04-28' },
    };

    const source = createSourceAdapter({
      scheduleGames: [
        createScheduleGame({ officialDate: '2026-04-01', gamePk: 101 }),
        createScheduleGame({ officialDate: '2026-04-20', gamePk: 102 }),
        createScheduleGame({ officialDate: '2026-04-21', gamePk: 103 }),
        createScheduleGame({ officialDate: '2026-04-24', gamePk: 104 }),
        createScheduleGame({ officialDate: '2026-04-25', gamePk: 105 }),
        createScheduleGame({ officialDate: '2026-04-28', gamePk: 106 }),
        createScheduleGame({ officialDate: '2026-04-02', gamePk: 107 }),
      ],
      starterResults: {
        '101-home': createStarterResult({ pitcherId: 123 }),
        '101-away': createStarterResult({ pitcherId: 456 }),
        '102-home': createStarterResult({ pitcherId: 123 }),
        '102-away': createStarterResult({ pitcherId: 456 }),
        '103-home': createStarterResult({ pitcherId: 123 }),
        '103-away': createStarterResult({ pitcherId: 456 }),
        '104-home': createStarterResult({ pitcherId: 123 }),
        '104-away': createStarterResult({ pitcherId: 456 }),
        '105-home': createStarterResult({ pitcherId: 123 }),
        '105-away': createStarterResult({ pitcherId: 456 }),
        '106-home': createStarterResult({ pitcherId: 123 }),
        '106-away': createStarterResult({ pitcherId: 456 }),
        '107-home': createStarterResult({ pitcherId: 123 }),
        '107-away': createStarterResult({ pitcherId: 456 }),
      },
    });
    const clock = createClock();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-28',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-explicit',
      splitPolicy: explicitPolicy,
    });

    const splits = Object.fromEntries(
      result.dataset.examples.map((example) => [
        example.snapshot.game.gameId,
        example.split,
      ]),
    );

    expect(splits['101']).toBe('TRAIN');
    expect(splits['102']).toBe('TRAIN');
    expect(splits['103']).toBe('VALIDATION');
    expect(splits['104']).toBe('VALIDATION');
    expect(splits['105']).toBe('TEST');
    expect(splits['106']).toBe('TEST');
    expect(splits['107']).toBe('TRAIN');
  });

  it('covers every date in explicit multi-day range', async () => {
    const explicitPolicy = {
      strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1' as const,
      embargoDays: 0,
      train: { startDate: '2026-04-01', endDate: '2026-04-20' },
      validation: { startDate: '2026-04-21', endDate: '2026-04-24' },
      test: { startDate: '2026-04-25', endDate: '2026-04-28' },
    };

    const scheduleGames: CanonicalHistoricalScheduleGame[] = [];
    const outcomes = new Map<number, MLBHistoricalOutcomeWithProvenance>();
    const starterResults: Record<string, MLBHistoricalProspectiveStarterResult> = {};
    for (let day = 1; day <= 28; day++) {
      const date = `2026-04-${String(day).padStart(2, '0')}`;
      const scheduledStart = createDate(`${date}T18:00:00.000Z`);
      const gamePk = 1000 + day;
      scheduleGames.push(
        createScheduleGame({
          officialDate: date,
          gamePk,
          scheduledStart,
          cutoffTime: createDate(`${date}T12:00:00.000Z`),
        }),
      );
      outcomes.set(gamePk, {
        outcome: {
          gamePk,
          status: 'FINAL',
          homeScore: 3,
          awayScore: 2,
          winner: 'HOME',
          innings: 9,
          completedAt: createDate(`${date}T22:00:00.000Z`),
          completedAtSource: 'LAST_COMPLETED_PLAY_END',
          warnings: [],
        },
        provenance: createProvenance('/api/v1.1/game/1/feed/live', createDate(`${date}T23:00:00.000Z`)),
      });
      starterResults[`${gamePk}-home`] = createStarterResult({
        pitcherId: 123,
        observedAt: createDate(`${date}T12:00:00.000Z`),
        observation: {
          schemaVersion: 'phase1g-a-v1',
          sport: 'mlb',
          gamePk,
          observedAt: createDate(`${date}T12:00:00.000Z`),
          scheduledStart,
          homeProbablePitcherId: 123,
          awayProbablePitcherId: 456,
          homeTeamId: 100,
          awayTeamId: 200,
          sourceEndpoint: '/api/v1/schedule',
          sourceRequestParameters: {},
          sourceResponseHash: 'abc123',
          observationContext: 'PROSPECTIVE_LIVE',
          provenance: 'SCHEDULE_PROBABLE_OBSERVED_AT',
          warnings: [],
        },
      });
      starterResults[`${gamePk}-away`] = createStarterResult({
        pitcherId: 456,
        observedAt: createDate(`${date}T12:00:00.000Z`),
        observation: {
          schemaVersion: 'phase1g-a-v1',
          sport: 'mlb',
          gamePk,
          observedAt: createDate(`${date}T12:00:00.000Z`),
          scheduledStart,
          homeProbablePitcherId: 123,
          awayProbablePitcherId: 456,
          homeTeamId: 100,
          awayTeamId: 200,
          sourceEndpoint: '/api/v1/schedule',
          sourceRequestParameters: {},
          sourceResponseHash: 'abc123',
          observationContext: 'PROSPECTIVE_LIVE',
          provenance: 'SCHEDULE_PROBABLE_OBSERVED_AT',
          warnings: [],
        },
      });
    }

    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return scheduleGames;
      },
      async loadTeamStatsAsOf({ teamId }) {
        const aggregate = createTeamAggregate(Number(teamId));
        return { aggregate, provenance: [createProvenance(`team-${teamId}`)] };
      },
      async resolveProspectiveStarter({ gamePk, side }) {
        const key = `${gamePk}-${side}`;
        const result = starterResults[key];
        if (!result) throw new Error(`Starter ${key} missing`);
        return result;
      },
      async loadPitcherStatsAsOf({ personId }) {
        const aggregate = createPitcherAggregate(personId);
        return { aggregate, provenance: [createProvenance(`pitcher-${personId}`)] };
      },
      async loadOfficialFinalOutcome({ gamePk }) {
        const outcome = outcomes.get(gamePk);
        if (!outcome) throw new Error(`Outcome ${gamePk} missing`);
        return outcome;
      },
    };

    const lateClock = createClock(createDate('2026-04-29T00:00:00.000Z'));

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-28',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock: lateClock,
      datasetId: 'ds-full-range',
      splitPolicy: explicitPolicy,
    });

    expect(result.dataset.examples).toHaveLength(28);

    const splitCounts = { TRAIN: 0, VALIDATION: 0, TEST: 0 };
    for (const example of result.dataset.examples) {
      splitCounts[example.split]++;
    }

    expect(splitCounts.TRAIN).toBe(20);
    expect(splitCounts.VALIDATION).toBe(4);
    expect(splitCounts.TEST).toBe(4);
  });

  it('fails closed on date outside policy', async () => {
    const source = createSourceAdapter({
      scheduleGames: [createScheduleGame({ officialDate: '2026-07-15' })],
    });
    const clock = createClock();

    await expect(
      materializeMLBHistoricalDataset({
        startDate: '2026-07-15',
        endDate: '2026-07-15',
        cutoffMinutesBeforeStart: 360,
        sourceAdapter: source,
        clock,
        datasetId: 'ds-out',
        splitPolicy: VALID_SPLIT_POLICY,
      }),
    ).rejects.toThrow('outside split windows');
  });

  it('team reconstruction error fails whole run', async () => {
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [createScheduleGame()];
      },
      async loadTeamStatsAsOf() {
        throw new Error('team fail');
      },
      async resolveProspectiveStarter() {
        throw new Error('team fail');
      },
      async loadPitcherStatsAsOf() {
        throw new Error('team fail');
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    await expect(
      materializeMLBHistoricalDataset({
        startDate: '2026-04-01',
        endDate: '2026-04-01',
        cutoffMinutesBeforeStart: 360,
        sourceAdapter: source,
        clock,
        datasetId: 'ds-team-fail',
        splitPolicy: VALID_SPLIT_POLICY,
      }),
    ).rejects.toThrow('Team reconstruction failed');
  });

  it('pitcher reconstruction error fails whole run', async () => {
    const source: MLBHistoricalMaterializationSourceAdapter = {
      async loadScheduleGamesForDateRange() {
        return [createScheduleGame()];
      },
      async loadTeamStatsAsOf({ teamId }) {
        const aggregate = teamId === 100 ? createTeamAggregate(100) : createTeamAggregate(200);
        return { aggregate, provenance: [createProvenance(`team-${teamId}`)] };
      },
      async resolveProspectiveStarter() {
        return createStarterResult({ pitcherId: 123 });
      },
      async loadPitcherStatsAsOf() {
        throw new Error('pitcher fail');
      },
      async loadOfficialFinalOutcome() {
        return createOutcomeWithProvenance();
      },
    };
    const clock = createClock();

    await expect(
      materializeMLBHistoricalDataset({
        startDate: '2026-04-01',
        endDate: '2026-04-01',
        cutoffMinutesBeforeStart: 360,
        sourceAdapter: source,
        clock,
        datasetId: 'ds-pit-fail',
        splitPolicy: VALID_SPLIT_POLICY,
      }),
    ).rejects.toThrow('Pitcher reconstruction failed');
  });

  it('does not mutate request', async () => {
    const source = createSourceAdapter();
    const clock = createClock();
    const input = {
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-req',
      splitPolicy: VALID_SPLIT_POLICY,
    };

    const inputSnapshot = JSON.stringify(input);

    await materializeMLBHistoricalDataset(input);

    expect(JSON.stringify(input)).toBe(inputSnapshot);
  });

  it('does not mutate source schedule objects', async () => {
    const scheduleGame = createScheduleGame();
    const scheduleSnapshot = JSON.stringify(scheduleGame);
    const source = createSourceAdapter({ scheduleGames: [scheduleGame] });
    const clock = createClock();

    await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-sched',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(JSON.stringify(scheduleGame)).toBe(scheduleSnapshot);
  });

  it('does not mutate aggregate inputs', async () => {
    const homeAggregate = createTeamAggregate(100);
    const awayAggregate = createTeamAggregate(200);
    const homeSnapshot = JSON.stringify(homeAggregate);
    const awaySnapshot = JSON.stringify(awayAggregate);

    const source = createSourceAdapter({
      teamAggregates: {
        '100': homeAggregate,
        '200': awayAggregate,
      },
    });
    const clock = createClock();

    await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-agg',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(JSON.stringify(homeAggregate)).toBe(homeSnapshot);
    expect(JSON.stringify(awayAggregate)).toBe(awaySnapshot);
  });

  it('rejects odds contamination in snapshot', async () => {
    const contaminatedSchedule = {
      ...createScheduleGame(),
      odds: { price: 100 },
    };
    const source = createSourceAdapter({
      scheduleGames: [contaminatedSchedule],
    });
    const clock = createClock();

    await expect(
      materializeMLBHistoricalDataset({
        startDate: '2026-04-01',
        endDate: '2026-04-01',
        cutoffMinutesBeforeStart: 360,
        sourceAdapter: source,
        clock,
        datasetId: 'ds-odds',
        splitPolicy: VALID_SPLIT_POLICY,
      }),
    ).rejects.toThrow('ODDS_CONTAMINATION');
  });

  it('materializes valid request', async () => {
    const source = createSourceAdapter();
    const clock = createClock();

    const result = await materializeMLBHistoricalDataset({
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      cutoffMinutesBeforeStart: 360,
      sourceAdapter: source,
      clock,
      datasetId: 'ds-ok',
      splitPolicy: VALID_SPLIT_POLICY,
    });

    expect(result.dataset.examples).toHaveLength(1);
    expect(result.summary.materializedExamples).toBe(1);
  });

  it('throws on snapshot failure', async () => {
    const source = createSourceAdapter({
      scheduleGames: [createScheduleGame({ rawGameType: 'X' })],
    });
    const clock = createClock();

    await expect(
      materializeMLBHistoricalDataset({
        startDate: '2026-04-01',
        endDate: '2026-04-01',
        cutoffMinutesBeforeStart: 360,
        sourceAdapter: source,
        clock,
        datasetId: 'ds-snap-err',
        splitPolicy: VALID_SPLIT_POLICY,
      }),
    ).rejects.toThrow('Snapshot invalid for game 1: INVALID_LITERAL');
  });

  it('imports CLI module without executing main', async () => {
    const module = await import('../../../scripts/materialize-mlb-historical-dataset');
    const parsed = module.parseMLBHistoricalMaterializationCliArgs([
      'node',
      'scripts/materialize-mlb-historical-dataset.ts',
      '--start-date',
      '2026-04-01',
      '--end-date',
      '2026-04-01',
      '--cutoff-minutes-before-start',
      '360',
      '--output',
      '/tmp/test.json',
    ]);

    expect(parsed.startDate).toBe('2026-04-01');
    expect(parsed.endDate).toBe('2026-04-01');
    expect(parsed.cutoffMinutesBeforeStart).toBe(360);
    expect(parsed.output).toBe('/tmp/test.json');
    expect(parsed.explicitMode).toBe(false);
    expect(parsed.trainEndDate).toBe('2026-04-01');
    expect(parsed.validationEndDate).toBe('2026-04-01');
  });

  it('parses explicit multi-day split flags', async () => {
    const module = await import('../../../scripts/materialize-mlb-historical-dataset');
    const parsed = module.parseMLBHistoricalMaterializationCliArgs([
      'node',
      'scripts/materialize-mlb-historical-dataset.ts',
      '--start-date',
      '2026-04-01',
      '--end-date',
      '2026-04-28',
      '--train-end-date',
      '2026-04-20',
      '--validation-end-date',
      '2026-04-24',
      '--cutoff-minutes-before-start',
      '360',
      '--output',
      '/tmp/test.json',
    ]);

    expect(parsed.startDate).toBe('2026-04-01');
    expect(parsed.endDate).toBe('2026-04-28');
    expect(parsed.trainEndDate).toBe('2026-04-20');
    expect(parsed.validationEndDate).toBe('2026-04-24');
    expect(parsed.explicitMode).toBe(true);
  });

  it('rejects partial explicit split flags', async () => {
    const module = await import('../../../scripts/materialize-mlb-historical-dataset');

    expect(() =>
      module.parseMLBHistoricalMaterializationCliArgs([
        'node',
        'scripts/materialize-mlb-historical-dataset.ts',
        '--start-date',
        '2026-04-01',
        '--end-date',
        '2026-04-28',
        '--train-end-date',
        '2026-04-20',
        '--cutoff-minutes-before-start',
        '360',
        '--output',
        '/tmp/test.json',
      ]),
    ).toThrow('Both --train-end-date and --validation-end-date must be supplied together');

    expect(() =>
      module.parseMLBHistoricalMaterializationCliArgs([
        'node',
        'scripts/materialize-mlb-historical-dataset.ts',
        '--start-date',
        '2026-04-01',
        '--end-date',
        '2026-04-28',
        '--validation-end-date',
        '2026-04-24',
        '--cutoff-minutes-before-start',
        '360',
        '--output',
        '/tmp/test.json',
      ]),
    ).toThrow('Both --train-end-date and --validation-end-date must be supplied together');
  });

  it('rejects invalid explicit split ordering', async () => {
    const module = await import('../../../scripts/materialize-mlb-historical-dataset');

    expect(() =>
      module.parseMLBHistoricalMaterializationCliArgs([
        'node',
        'scripts/materialize-mlb-historical-dataset.ts',
        '--start-date',
        '2026-04-01',
        '--end-date',
        '2026-04-28',
        '--train-end-date',
        '2026-03-31',
        '--validation-end-date',
        '2026-04-24',
        '--cutoff-minutes-before-start',
        '360',
        '--output',
        '/tmp/test.json',
      ]),
    ).toThrow('--train-end-date must be >= --start-date');

    expect(() =>
      module.parseMLBHistoricalMaterializationCliArgs([
        'node',
        'scripts/materialize-mlb-historical-dataset.ts',
        '--start-date',
        '2026-04-01',
        '--end-date',
        '2026-04-28',
        '--train-end-date',
        '2026-04-24',
        '--validation-end-date',
        '2026-04-24',
        '--cutoff-minutes-before-start',
        '360',
        '--output',
        '/tmp/test.json',
      ]),
    ).toThrow('--train-end-date must be < --validation-end-date');

    expect(() =>
      module.parseMLBHistoricalMaterializationCliArgs([
        'node',
        'scripts/materialize-mlb-historical-dataset.ts',
        '--start-date',
        '2026-04-01',
        '--end-date',
        '2026-04-28',
        '--train-end-date',
        '2026-04-24',
        '--validation-end-date',
        '2026-04-28',
        '--cutoff-minutes-before-start',
        '360',
        '--output',
        '/tmp/test.json',
      ]),
    ).toThrow('--validation-end-date must be < --end-date');
  });
});

function createFixedClock(iso: string): MLBHistoricalMaterializationClock {
  const fixed = new Date(iso);
  return { now: () => fixed };
}
