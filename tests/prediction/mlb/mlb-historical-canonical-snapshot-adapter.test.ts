import { describe, expect, it } from 'vitest';
import {
  buildMLBHistoricalCanonicalPregameSnapshot,
  MLBHistoricalCanonicalSnapshotAdapterInput,
  MLBHistoricalCanonicalSnapshotAdapterResult,
  MLBHistoricalCanonicalSnapshotProvenance,
  MLBHistoricalCanonicalSnapshotProbablePitcher,
} from '@/prediction/mlb/mlb-historical-canonical-snapshot-adapter';
import {
  validateMLBCanonicalPregameSnapshot,
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';
import type {
  CanonicalHistoricalScheduleGame,
  TeamHistoricalAggregate,
  PitcherHistoricalAggregate,
  HistoricalPitcherAppearance,
} from '@/lib/backtesting/mlb/live-history/types';

function buildScheduleGame(
  overrides: Partial<CanonicalHistoricalScheduleGame> = {},
): CanonicalHistoricalScheduleGame {
  return {
    gamePk: 12345,
    officialDate: '2026-07-15',
    scheduledStart: new Date('2026-07-15T12:00:00Z'),
    cutoffTime: new Date('2026-07-15T06:00:00Z'),
    status: 'UPCOMING',
    homeTeamId: 110,
    homeTeamName: 'New York Yankees',
    awayTeamId: 111,
    awayTeamName: 'Boston Red Sox',
    venueId: 1,
    venueName: 'Yankee Stadium',
    doubleheader: false,
    gameNumber: 1,
    scheduledInnings: 9,
    homeProbablePitcherId: 1001,
    awayProbablePitcherId: 1002,
    homeStarterSource: 'SCHEDULE_PROBABLE_BEFORE_CUTOFF',
    awayStarterSource: 'SCHEDULE_PROBABLE_BEFORE_CUTOFF',
    rescheduledFromGamePk: null,
    warnings: [],
    provenance: {
      endpoint: '/api/v1/schedule',
      fetchedAt: new Date('2026-07-15T06:00:00Z'),
      sourceTimestamp: null,
    },
    ...overrides,
  };
}

function buildProvenance(
  overrides: Partial<MLBHistoricalCanonicalSnapshotProvenance> = {},
): MLBHistoricalCanonicalSnapshotProvenance {
  return {
    sourceRefId: 'src-schedule',
    sourceName: 'mlb-stats-api:schedule',
    sourceCategory: 'OFFICIAL',
    roles: ['GAME_IDENTITY', 'SCHEDULE_CONTEXT', 'TEAM_PLAYER_IDENTITY'],
    fetchedAt: new Date('2026-07-15T06:00:00Z'),
    sourceUpdatedAt: null,
    ...overrides,
  };
}

function buildProbablePitcher(
  overrides: Partial<MLBHistoricalCanonicalSnapshotProbablePitcher> = {},
): MLBHistoricalCanonicalSnapshotProbablePitcher {
  return {
    personId: 1001,
    observedAt: new Date('2026-07-15T05:00:00Z'),
    sourceRefId: 'src-schedule',
    ...overrides,
  };
}

function buildTeamAggregate(
  overrides: Partial<TeamHistoricalAggregate> = {},
): TeamHistoricalAggregate {
  return {
    teamId: 110,
    gamesPlayed: 80,
    wins: 45,
    losses: 35,
    winRate: 0.562,
    runsScored: 320,
    runsAllowed: 280,
    runDifferential: 40,
    runsScoredPerGame: 4.0,
    runsAllowedPerGame: 3.5,
    recent5Wins: 3,
    recent5Losses: 2,
    recent10Wins: 6,
    recent10Losses: 4,
    recent10RunsPerGame: 4.2,
    homeWins: 25,
    homeLosses: 15,
    awayWins: 20,
    awayLosses: 20,
    restDays: 1,
    gamesInPrevious3Days: 1,
    extraInningGames: 5,
    sampleSize: 80,
    warnings: [],
    ...overrides,
  };
}

function buildPitcherAggregate(
  overrides: Partial<PitcherHistoricalAggregate> = {},
): PitcherHistoricalAggregate {
  const appearance: HistoricalPitcherAppearance = {
    gamePk: 12344,
    gameStart: new Date('2026-07-10T18:00:00Z'),
    completedAt: new Date('2026-07-10T21:00:00Z'),
    completedAtSource: 'LAST_COMPLETED_PLAY_END',
    status: 'FINAL',
    personId: 1001,
    teamId: 110,
    started: true,
    inningsPitched: '6.0',
    earnedRuns: 2,
    strikeouts: 7,
    walks: 1,
    hitsAllowed: 5,
    homeRunsAllowed: 0,
    pitches: 95,
  };

  return {
    personId: 1001,
    teamId: 110,
    appearances: 20,
    gamesStarted: 20,
    outsRecorded: 540,
    inningsPitchedDisplay: '180.0',
    earnedRuns: 45,
    hitsAllowed: 140,
    walks: 30,
    strikeouts: 160,
    homeRunsAllowed: 12,
    era: 2.25,
    whip: 1.22,
    kPer9: 8.0,
    bbPer9: 1.5,
    hPer9: 7.0,
    hrPer9: 0.6,
    previousStartDate: new Date('2026-07-10T18:00:00Z'),
    daysRest: 5,
    recent3Starts: [appearance],
    recent5Starts: [appearance],
    sampleSize: 20,
    warnings: [],
    ...overrides,
  };
}

function buildAdapterInput(
  overrides: Partial<MLBHistoricalCanonicalSnapshotAdapterInput> = {},
): MLBHistoricalCanonicalSnapshotAdapterInput {
  return {
    scheduleGame: buildScheduleGame(),
    rawGameType: 'R',
    cutoff: new Date('2026-07-15T06:00:00Z'),
    teamAggregates: {
      homeBatting: buildTeamAggregate(),
      awayBatting: buildTeamAggregate({ teamId: 111 }),
      homeBullpen: buildTeamAggregate(),
      awayBullpen: buildTeamAggregate({ teamId: 111 }),
    },
    pitcherAggregates: {
      home: buildPitcherAggregate(),
      away: buildPitcherAggregate({ personId: 1002, teamId: 111 }),
    },
    venue: {
      id: 1,
      name: 'Yankee Stadium',
      latitude: 40.8296,
      longitude: -73.9262,
    },
    probablePitchers: {
      home: buildProbablePitcher({ personId: 1001 }),
      away: buildProbablePitcher({ personId: 1002 }),
    },
    provenance: [buildProvenance()],
    ...overrides,
  };
}

describe('mlb-historical-canonical-snapshot-adapter', () => {
  it('valid historical inputs produce a valid MLBCanonicalPregameSnapshot', () => {
    const input = buildAdapterInput();
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const independent = validateMLBCanonicalPregameSnapshot(result.value);
      expect(independent.ok).toBe(true);
    }
  });

  it('dataCutoffAt equals the explicit historical predictor cutoff', () => {
    const cutoff = new Date('2026-07-15T06:00:00Z');
    const input = buildAdapterInput({ cutoff });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.dataCutoffAt).toBe('2026-07-15T06:00:00.000Z');
    }
  });

  it('capturedAt equals the explicit historical predictor cutoff', () => {
    const cutoff = new Date('2026-07-15T06:00:00Z');
    const input = buildAdapterInput({ cutoff });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.capturedAt).toBe('2026-07-15T06:00:00.000Z');
    }
  });

  it('cutoff strictly before scheduled start is accepted', () => {
    const input = buildAdapterInput({
      cutoff: new Date('2026-07-15T06:00:00Z'),
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
  });

  it('cutoff equal to scheduled start is rejected', () => {
    const input = buildAdapterInput({
      cutoff: new Date('2026-07-15T12:00:00Z'),
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const failure = result.issues.find((issue) => issue.code === 'INVALID_TIMESTAMP_ORDER');
      expect(failure).toBeDefined();
    }
  });

  it('cutoff after scheduled start is rejected', () => {
    const input = buildAdapterInput({
      cutoff: new Date('2026-07-15T18:00:00Z'),
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const failure = result.issues.find((issue) => issue.code === 'INVALID_TIMESTAMP_ORDER');
      expect(failure).toBeDefined();
    }
  });

  it('archival fetchedAt after the historical game is preserved, not backdated', () => {
    const fetchedAt = new Date('2026-07-16T00:00:00Z');
    const provenance = buildProvenance({ fetchedAt });
    const input = buildAdapterInput({ provenance: [provenance] });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sourceReferences[0].fetchedAt).toBe('2026-07-16T00:00:00.000Z');
    }
  });

  it('archival fetchedAt after capturedAt remains valid under current canonical contract', () => {
    const fetchedAt = new Date('2026-07-16T00:00:00Z');
    const provenance = buildProvenance({ fetchedAt });
    const input = buildAdapterInput({ provenance: [provenance] });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
  });

  it('post-cutoff section.asOfAt rejected', () => {
    const snapshot = {
      contractVersion: MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
      sport: 'MLB',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      snapshotId: '12345::1000::pregame-snapshot-v1',
      capturedAt: '2026-07-15T06:00:00.000Z',
      dataCutoffAt: '2026-07-15T06:00:00.000Z',
      game: {
        gameId: '12345',
        scheduledStartAt: '2026-07-15T12:00:00.000Z',
        officialDate: '2026-07-15',
        season: 2026,
        gameType: 'REGULAR_SEASON',
        status: 'SCHEDULED',
        homeTeamId: '110',
        awayTeamId: '111',
        venueId: '1',
        neutralSite: null,
        doubleheader: null,
      },
      startingPitchers: {
        home: { state: 'UNAVAILABLE', pitcherId: null, announcedAt: null, sourceRefIds: [] },
        away: { state: 'UNAVAILABLE', pitcherId: null, announcedAt: null, sourceRefIds: [] },
      },
      sourceReferences: [
        {
          sourceRefId: 'src-1',
          sourceName: 'test',
          sourceCategory: 'SCHEDULE',
          roles: ['SCHEDULE'],
          providerRecordId: null,
          fetchedAt: '2026-07-15T06:00:00.000Z',
          sourceUpdatedAt: null,
        },
      ],
      sections: [
        {
          sectionId: 'section-game-context',
          kind: 'GAME_CONTEXT',
          entity: { scope: 'GAME', entityId: null },
          status: 'AVAILABLE',
          asOfAt: '2026-07-15T18:00:00.000Z',
          sourceRefIds: ['src-1'],
          payload: {},
        },
      ],
      dataCompleteness: 'PARTIAL',
      warnings: [],
    };

    const validation = validateMLBCanonicalPregameSnapshot(snapshot);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      const failure = validation.issues.find((issue) => issue.code === 'INVALID_TIMESTAMP_ORDER');
      expect(failure).toBeDefined();
    }
  });

  it('post-cutoff probable-starter observation is not used', () => {
    const input = buildAdapterInput({
      probablePitchers: {
        home: buildProbablePitcher({
          personId: 1001,
          observedAt: new Date('2026-07-15T18:00:00Z'),
        }),
        away: buildProbablePitcher({
          personId: 1002,
          observedAt: new Date('2026-07-15T18:00:00Z'),
        }),
      },
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.startingPitchers.home.state).toBe('UNAVAILABLE');
      expect(result.value.startingPitchers.away.state).toBe('UNAVAILABLE');
    }
  });

  it('absent prospective probable starter maps to UNAVAILABLE', () => {
    const input = buildAdapterInput({
      scheduleGame: buildScheduleGame({
        homeProbablePitcherId: null,
        awayProbablePitcherId: null,
        homeStarterSource: 'UNAVAILABLE',
        awayStarterSource: 'UNAVAILABLE',
      }),
      probablePitchers: {
        home: null,
        away: null,
      },
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.startingPitchers.home.state).toBe('UNAVAILABLE');
      expect(result.value.startingPitchers.away.state).toBe('UNAVAILABLE');
    }
  });

  it('prospectively captured starter before cutoff is preserved exactly', () => {
    const observedAt = new Date('2026-07-15T05:00:00Z');
    const input = buildAdapterInput({
      probablePitchers: {
        home: buildProbablePitcher({
          personId: 1001,
          observedAt,
          sourceRefId: 'src-prospective',
        }),
        away: buildProbablePitcher({
          personId: 1002,
          observedAt,
          sourceRefId: 'src-prospective',
        }),
      },
      provenance: [buildProvenance({ sourceRefId: 'src-prospective' })],
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.startingPitchers.home.state).toBe('PROBABLE');
      expect(result.value.startingPitchers.home.pitcherId).toBe('1001');
      expect(result.value.startingPitchers.home.announcedAt).toBe('2026-07-15T05:00:00.000Z');
      expect(result.value.startingPitchers.home.sourceRefIds).toEqual(['src-prospective']);
      expect(result.value.startingPitchers.away.state).toBe('PROBABLE');
      expect(result.value.startingPitchers.away.pitcherId).toBe('1002');
    }
  });

  it('actual final starter data is not required by adapter input', () => {
    const input = buildAdapterInput({
      probablePitchers: {
        home: null,
        away: null,
      },
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.startingPitchers.home.state).toBe('UNAVAILABLE');
      expect(result.value.startingPitchers.away.state).toBe('UNAVAILABLE');
    }
  });

  it('pitcher aggregates are unavailable when no truthful probable starter exists', () => {
    const input = buildAdapterInput({
      scheduleGame: buildScheduleGame({
        homeProbablePitcherId: null,
        awayProbablePitcherId: null,
        homeStarterSource: 'UNAVAILABLE',
        awayStarterSource: 'UNAVAILABLE',
      }),
      probablePitchers: {
        home: null,
        away: null,
      },
      pitcherAggregates: {
        home: buildPitcherAggregate(),
        away: buildPitcherAggregate({ personId: 1002 }),
      },
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.startingPitchers.home.state).toBe('UNAVAILABLE');
      expect(result.value.startingPitchers.away.state).toBe('UNAVAILABLE');
    }
  });

  it('eligible pitcher aggregate is mapped only for the matching truthful pitcher', () => {
    const input = buildAdapterInput({
      pitcherAggregates: {
        home: buildPitcherAggregate({ personId: 9999 }),
        away: buildPitcherAggregate({ personId: 1002 }),
      },
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const homeStarterSection = result.value.sections.find(
        (section) => section.sectionId === 'section-home-starter',
      );
      const awayStarterSection = result.value.sections.find(
        (section) => section.sectionId === 'section-away-starter',
      );
      expect(homeStarterSection?.status).toBe('AVAILABLE');
      expect(awayStarterSection?.status).toBe('AVAILABLE');
    }
  });

  it('team aggregates preserve pre-cutoff asOf semantics', () => {
    const input = buildAdapterInput();
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const battingSection = result.value.sections.find(
        (section) => section.sectionId === 'section-home-batting',
      );
      expect(battingSection?.asOfAt).toBe('2026-07-15T06:00:00.000Z');
    }
  });

  it('missing optional team/pitcher data produces truthful incomplete/unavailable state', () => {
    const input = buildAdapterInput({
      teamAggregates: {
        homeBatting: null,
        awayBatting: null,
        homeBullpen: null,
        awayBullpen: null,
      },
      pitcherAggregates: {
        home: null,
        away: null,
      },
      venue: null,
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const unavailableSections = result.value.sections.filter(
        (section) => section.status === 'UNAVAILABLE',
      );
      expect(unavailableSections.length).toBeGreaterThan(0);
    }
  });

  it('neutralSite null is preserved as unknown, not converted to false', () => {
    const input = buildAdapterInput({
      scheduleGame: buildScheduleGame({ venueId: null }),
      venue: null,
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.neutralSite).toBeNull();
      expect(result.value.game.venueId).toBeNull();
    }
  });

  it('game identity values are preserved exactly', () => {
    const scheduleGame = buildScheduleGame({
      gamePk: 99999,
      officialDate: '2024-06-15',
      homeTeamId: 200,
      awayTeamId: 201,
      venueId: 50,
      scheduledStart: new Date('2024-06-15T18:30:00Z'),
    });
    const input = buildAdapterInput({
      scheduleGame,
      cutoff: new Date('2024-06-15T12:00:00Z'),
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.gameId).toBe('99999');
      expect(result.value.game.officialDate).toBe('2024-06-15');
      expect(result.value.game.homeTeamId).toBe('200');
      expect(result.value.game.awayTeamId).toBe('201');
      expect(result.value.game.venueId).toBe('50');
      expect(result.value.game.scheduledStartAt).toBe('2024-06-15T18:30:00.000Z');
    }
  });

  it('doubleheader identity uses authoritative existing historical fields and fails closed when insufficient', () => {
    const input = buildAdapterInput({
      scheduleGame: buildScheduleGame({
        doubleheader: true,
        gameNumber: 2,
      }),
      cutoff: new Date('2026-07-15T06:00:00Z'),
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.doubleheader).toEqual({
        doubleheaderId: '10:2026-07-153:1103:111',
        gameNumber: 2,
      });
    }
  });

  it('doubleheader with invalid gameNumber fails closed', () => {
    const input = buildAdapterInput({
      scheduleGame: buildScheduleGame({
        doubleheader: true,
        gameNumber: 3,
      }),
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        {
          code: 'INVALID_LITERAL',
          path: '$.scheduleGame.gameNumber',
          message: 'Unsupported doubleheader gameNumber',
        },
      ]);
    }
  });

  it('no final scores or winner are present in output', () => {
    const input = buildAdapterInput();
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toHaveProperty('homeScore');
      expect(result.value).not.toHaveProperty('awayScore');
      expect(result.value).not.toHaveProperty('winnerTeamId');
    }
  });

  it('UPCOMING status maps to SCHEDULED', () => {
    const input = buildAdapterInput({
      scheduleGame: buildScheduleGame({ status: 'UPCOMING' }),
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.status).toBe('SCHEDULED');
    }
  });

  it('POSTPONED status is preserved', () => {
    const input = buildAdapterInput({
      scheduleGame: buildScheduleGame({ status: 'POSTPONED' }),
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.status).toBe('POSTPONED');
    }
  });

  it('CANCELLED status is preserved', () => {
    const input = buildAdapterInput({
      scheduleGame: buildScheduleGame({ status: 'CANCELLED' }),
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.status).toBe('CANCELLED');
    }
  });

  it('FINAL archival status maps to UNKNOWN because pregame status cannot be reconstructed', () => {
    const input = buildAdapterInput({
      scheduleGame: buildScheduleGame({ status: 'FINAL' }),
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.status).toBe('UNKNOWN');
    }
  });

  it('LIVE archival status maps to UNKNOWN because pregame status cannot be reconstructed', () => {
    const input = buildAdapterInput({
      scheduleGame: buildScheduleGame({ status: 'LIVE' }),
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.status).toBe('UNKNOWN');
    }
  });

  it('source archival fetchedAt is preserved exactly', () => {
    const fetchedAt = new Date('2026-08-01T14:30:00Z');
    const provenance = buildProvenance({ fetchedAt });
    const input = buildAdapterInput({ provenance: [provenance] });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sourceReferences[0].fetchedAt).toBe('2026-08-01T14:30:00.000Z');
    }
  });

  it('unprovable post-cutoff sourceUpdatedAt fails closed', () => {
    const sourceUpdatedAt = new Date('2026-07-16T00:00:00Z');
    const provenance = buildProvenance({ sourceUpdatedAt });
    const input = buildAdapterInput({ provenance: [provenance] });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const failure = result.issues.find((issue) => issue.code === 'INVALID_TIMESTAMP_ORDER');
      expect(failure).toBeDefined();
      expect(failure?.path).toBe('$.provenance[0].sourceUpdatedAt');
    }
  });

  it('source reference ordering is deterministic', () => {
    const provenance = [
      buildProvenance({ sourceRefId: 'src-schedule' }),
      buildProvenance({ sourceRefId: 'src-b' }),
      buildProvenance({ sourceRefId: 'src-a' }),
    ];
    const input = buildAdapterInput({ provenance });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sourceReferences[0].sourceRefId).toBe('src-a');
      expect(result.value.sourceReferences[1].sourceRefId).toBe('src-b');
      expect(result.value.sourceReferences[2].sourceRefId).toBe('src-schedule');
    }
  });

  it('section ordering is deterministic', () => {
    const input = buildAdapterInput();
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const sectionIds = result.value.sections.map((section) => section.sectionId);
      expect(sectionIds).toEqual([
        'section-away-batting',
        'section-away-bullpen',
        'section-away-starter',
        'section-game-context',
        'section-home-batting',
        'section-home-bullpen',
        'section-home-starter',
        'section-venue',
        'section-weather',
      ]);
    }
  });

  it('warning ordering is deterministic', () => {
    const scheduleGame = buildScheduleGame({
      warnings: ['z-warning', 'a-warning', 'm-warning'],
    });
    const input = buildAdapterInput({ scheduleGame });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.warnings[0].message).toBe('a-warning');
      expect(result.value.warnings[1].message).toBe('m-warning');
      expect(result.value.warnings[2].message).toBe('z-warning');
    }
  });

  it('caller-owned inputs are unchanged', () => {
    const input = buildAdapterInput();
    const scheduleGameBefore = JSON.stringify(input.scheduleGame);
    const provenanceBefore = JSON.stringify(input.provenance);
    const venueBefore = JSON.stringify(input.venue);

    buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(JSON.stringify(input.scheduleGame)).toBe(scheduleGameBefore);
    expect(JSON.stringify(input.provenance)).toBe(provenanceBefore);
    expect(JSON.stringify(input.venue)).toBe(venueBefore);
  });

  it('equivalent inputs produce deeply equivalent outputs', () => {
    const inputA = buildAdapterInput();
    const inputB = buildAdapterInput();
    const resultA = buildMLBHistoricalCanonicalPregameSnapshot(inputA);
    const resultB = buildMLBHistoricalCanonicalPregameSnapshot(inputB);

    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
    if (resultA.ok && resultB.ok) {
      expect(resultB.value).toEqual(resultA.value);
    }
  });

  it('output validates through validateMLBCanonicalPregameSnapshot', () => {
    const input = buildAdapterInput();
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const validation = validateMLBCanonicalPregameSnapshot(result.value);
      expect(validation.ok).toBe(true);
    }
  });

  it('reconstructedAt does not appear in canonical snapshot output', () => {
    const input = buildAdapterInput();
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toHaveProperty('reconstructedAt');
    }
  });

  it('snapshot identity uses cutoff, not fetchedAt', () => {
    const fetchedAtA = new Date('2026-07-16T00:00:00Z');
    const fetchedAtB = new Date('2026-07-17T00:00:00Z');
    const inputA = buildAdapterInput({
      provenance: [buildProvenance({ fetchedAt: fetchedAtA })],
    });
    const inputB = buildAdapterInput({
      provenance: [buildProvenance({ fetchedAt: fetchedAtB })],
    });
    const resultA = buildMLBHistoricalCanonicalPregameSnapshot(inputA);
    const resultB = buildMLBHistoricalCanonicalPregameSnapshot(inputB);

    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
    if (resultA.ok && resultB.ok) {
      expect(resultA.value.snapshotId).toBe(resultB.value.snapshotId);
    }
  });

  it('snapshot identity changes when cutoff changes', () => {
    const inputA = buildAdapterInput({
      cutoff: new Date('2026-07-15T06:00:00Z'),
    });
    const inputB = buildAdapterInput({
      cutoff: new Date('2026-07-15T08:00:00Z'),
    });
    const resultA = buildMLBHistoricalCanonicalPregameSnapshot(inputA);
    const resultB = buildMLBHistoricalCanonicalPregameSnapshot(inputB);

    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
    if (resultA.ok && resultB.ok) {
      expect(resultA.value.snapshotId).not.toBe(resultB.value.snapshotId);
    }
  });

  it('allows null venueId without fabricating neutralSite', () => {
    const input = buildAdapterInput({
      scheduleGame: buildScheduleGame({ venueId: null, venueName: null }),
      venue: null,
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.venueId).toBeNull();
      expect(result.value.game.neutralSite).toBeNull();
    }
  });

  it('preserves exact officialDate serialization', () => {
    const input = buildAdapterInput({
      scheduleGame: buildScheduleGame({ officialDate: '2024-09-15' }),
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.officialDate).toBe('2024-09-15');
    }
  });

  it('derives season from scheduledStart UTC year', () => {
    const input = buildAdapterInput({
      scheduleGame: buildScheduleGame({
        scheduledStart: new Date('2024-03-15T12:00:00Z'),
      }),
      cutoff: new Date('2024-03-15T06:00:00Z'),
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.season).toBe(2024);
    }
  });

  it('empty warnings remain empty and ordered', () => {
    const input = buildAdapterInput({
      scheduleGame: buildScheduleGame({ warnings: [] }),
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.warnings).toEqual([]);
    }
  });

  it('duplicate provenance sourceRefId is rejected', () => {
    const provenance = [
      buildProvenance({ sourceRefId: 'src-same' }),
      buildProvenance({ sourceRefId: 'src-same' }),
    ];
    const input = buildAdapterInput({
      provenance,
      probablePitchers: {
        home: buildProbablePitcher({ sourceRefId: 'src-same' }),
        away: buildProbablePitcher({ sourceRefId: 'src-same' }),
      },
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const failure = result.issues.find((issue) => issue.code === 'DUPLICATE_ID');
      expect(failure).toBeDefined();
    }
  });

  it('dataCompleteness reflects missing optional data', () => {
    const input = buildAdapterInput({
      teamAggregates: {
        homeBatting: null,
        awayBatting: null,
        homeBullpen: null,
        awayBullpen: null,
      },
      venue: null,
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.dataCompleteness).toBe('PARTIAL');
    }
  });

  it('output contract version is exact', () => {
    const input = buildAdapterInput();
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contractVersion).toBe(MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION);
    }
  });

  it('sport and target are exact', () => {
    const input = buildAdapterInput();
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sport).toBe('MLB');
      expect(result.value.target).toBe('OFFICIAL_FINAL_GAME_WINNER');
    }
  });

  it('home and away team names are preserved in game context', () => {
    const input = buildAdapterInput({
      scheduleGame: buildScheduleGame({
        homeTeamName: 'Home Team',
        awayTeamName: 'Away Team',
      }),
    });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const contextSection = result.value.sections.find(
        (section) => section.sectionId === 'section-game-context',
      );
      expect(contextSection?.payload).toMatchObject({
        homeTeamName: 'Home Team',
        awayTeamName: 'Away Team',
      });
    }
  });

  it('section sourceRefIds are sorted ascending', () => {
    const provenance = [
      buildProvenance({ sourceRefId: 'src-schedule' }),
      buildProvenance({ sourceRefId: 'src-c' }),
      buildProvenance({ sourceRefId: 'src-a' }),
      buildProvenance({ sourceRefId: 'src-b' }),
    ];
    const input = buildAdapterInput({ provenance });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const contextSection = result.value.sections.find(
        (section) => section.sectionId === 'section-game-context',
      );
      expect(contextSection?.sourceRefIds).toEqual(['src-a', 'src-b', 'src-c', 'src-schedule']);
    }
  });

  it('supported rawGameType R maps to REGULAR_SEASON', () => {
    const input = buildAdapterInput({ rawGameType: 'R' });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.gameType).toBe('REGULAR_SEASON');
    }
  });

  it('supported rawGameType S maps to SPRING_TRAINING', () => {
    const input = buildAdapterInput({ rawGameType: 'S' });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.gameType).toBe('SPRING_TRAINING');
    }
  });

  it('supported rawGameType A maps to ALL_STAR', () => {
    const input = buildAdapterInput({ rawGameType: 'A' });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.gameType).toBe('ALL_STAR');
    }
  });

  it('supported rawGameType P maps to POSTSEASON', () => {
    const input = buildAdapterInput({ rawGameType: 'P' });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.gameType).toBe('POSTSEASON');
    }
  });

  it('supported rawGameType F maps to POSTSEASON', () => {
    const input = buildAdapterInput({ rawGameType: 'F' });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.gameType).toBe('POSTSEASON');
    }
  });

  it('supported rawGameType D maps to POSTSEASON', () => {
    const input = buildAdapterInput({ rawGameType: 'D' });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.gameType).toBe('POSTSEASON');
    }
  });

  it('supported rawGameType L maps to POSTSEASON', () => {
    const input = buildAdapterInput({ rawGameType: 'L' });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.gameType).toBe('POSTSEASON');
    }
  });

  it('supported rawGameType W maps to POSTSEASON', () => {
    const input = buildAdapterInput({ rawGameType: 'W' });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.gameType).toBe('POSTSEASON');
    }
  });

  it('supported rawGameType I maps to OTHER', () => {
    const input = buildAdapterInput({ rawGameType: 'I' });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.gameType).toBe('OTHER');
    }
  });

  it('unsupported rawGameType X fails closed', () => {
    const input = buildAdapterInput({ rawGameType: 'X' });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        {
          code: 'INVALID_LITERAL',
          path: '$.rawGameType',
          message: 'Unsupported rawGameType: X',
        },
      ]);
    }
  });

  it('empty rawGameType fails closed', () => {
    const input = buildAdapterInput({ rawGameType: '' });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        {
          code: 'INVALID_LITERAL',
          path: '$.rawGameType',
          message: 'Unsupported rawGameType: ',
        },
      ]);
    }
  });

  it('arbitrary unknown rawGameType fails closed', () => {
    const input = buildAdapterInput({ rawGameType: 'unknown' });
    const result = buildMLBHistoricalCanonicalPregameSnapshot(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        {
          code: 'INVALID_LITERAL',
          path: '$.rawGameType',
          message: 'Unsupported rawGameType: unknown',
        },
      ]);
    }
  });
});
