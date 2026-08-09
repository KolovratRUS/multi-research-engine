import { describe, expect, it } from 'vitest';
import {
  buildMLBRealDataPregameSnapshot,
  MLBRealDataPregameSnapshotBridgeInput,
} from '@/prediction/mlb/mlb-real-data-pregame-snapshot-bridge';
import {
  validateMLBCanonicalPregameSnapshot,
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';

function buildScheduleGame(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    gamePk: 12345,
    officialDate: '2026-07-15',
    gameDate: '2026-07-15',
    startTimeUtc: new Date('2026-07-15T12:00:00Z'),
    status: 'UPCOMING',
    homeTeamId: 110,
    homeTeamName: 'New York Yankees',
    awayTeamId: 111,
    awayTeamName: 'Boston Red Sox',
    venueId: 1,
    venueName: 'Yankee Stadium',
    dayNight: 'day',
    scheduledInnings: 9,
    doubleHeader: 'N',
    gameNumber: 1,
    seriesGameNumber: 1,
    gamesInSeries: 3,
    seriesDescription: 'Regular Season',
    gameType: 'R',
    leagueRecord: {
      home: { wins: 50, losses: 40, pct: '0.556' },
      away: { wins: 45, losses: 45, pct: '0.500' },
    },
    probablePitchers: {
      home: null,
      away: null,
    },
    ...overrides,
  } as Record<string, unknown>;
}

function buildDataProvenance(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    source: 'mlb-stats-api:schedule',
    fetchedAt: new Date('2026-07-15T09:30:00Z'),
    sourceTimestamp: new Date('2026-07-15T09:00:00Z'),
    isLive: false,
    warnings: [],
    ...overrides,
  } as Record<string, unknown>;
}

function buildEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'event-1',
    externalId: '12345',
    sport: 'mlb',
    league: 'MLB',
    leagueSlug: 'mlb',
    homeTeam: 'New York Yankees',
    awayTeam: 'Boston Red Sox',
    homeTeamSlug: 'nyy',
    awayTeamSlug: 'bos',
    startTimeUtc: new Date('2026-07-15T12:00:00Z'),
    status: 'UPCOMING',
    homeScore: undefined,
    awayScore: undefined,
    createdAt: new Date('2026-07-15T08:00:00Z'),
    updatedAt: new Date('2026-07-15T09:00:00Z'),
    ...overrides,
  } as Record<string, unknown>;
}

function buildResearchSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    event: buildEvent(),
    probablePitchers: {
      home: null,
      away: null,
    },
    pitcherStats: {
      home: null,
      away: null,
    },
    teamBatting: {
      home: null,
      away: null,
    },
    bullpen: {
      home: null,
      away: null,
    },
    venue: null,
    weather: null,
    completeness: 100,
    warnings: [],
    provenance: [buildDataProvenance()],
    generatedAt: new Date('2026-07-15T09:30:00Z'),
    ...overrides,
  } as Record<string, unknown>;
}

function buildBridgeInput(
  overrides: Record<string, unknown> = {},
): MLBRealDataPregameSnapshotBridgeInput {
  return {
    scheduleGame: buildScheduleGame() as any,
    researchSnapshot: buildResearchSnapshot() as any,
    ...overrides,
  };
}

describe('mlb-real-data-pregame-snapshot-bridge', () => {
  it('accepts a valid schedule + research pair and produces a valid canonical snapshot', () => {
    const input = buildBridgeInput();
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contractVersion).toBe(MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION);
      expect(result.value.game.status).toBe('SCHEDULED');
      expect(result.value.game.neutralSite).toBeNull();
      expect(result.value.game.gameType).toBe('REGULAR_SEASON');
      expect(result.value.game.doubleheader).toBeNull();
      expect(result.value.dataCompleteness).toBe('COMPLETE');
      expect(result.value.warnings).toEqual([]);
      expect(result.value.sourceReferences).toHaveLength(1);
      expect(result.value.sections.some((s) => s.kind === 'GAME_CONTEXT')).toBe(true);

      const independent = validateMLBCanonicalPregameSnapshot(result.value);
      expect(independent.ok).toBe(true);
    }
  });

  it('preserves exact officialDate from scheduleGame', () => {
    const input = buildBridgeInput({
      scheduleGame: buildScheduleGame({ officialDate: '2026-08-01' }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.officialDate).toBe('2026-08-01');
    }
  });

  it('preserves exact gameId derived from scheduleGame.gamePk', () => {
    const input = buildBridgeInput({
      scheduleGame: buildScheduleGame({ gamePk: 99999 }),
      researchSnapshot: buildResearchSnapshot({
        event: buildEvent({ externalId: '99999' }),
      }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.gameId).toBe('99999');
    }
  });

  it('preserves exact homeTeamId from scheduleGame', () => {
    const input = buildBridgeInput({
      scheduleGame: buildScheduleGame({ homeTeamId: 200 }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.homeTeamId).toBe('200');
    }
  });

  it('preserves exact awayTeamId from scheduleGame', () => {
    const input = buildBridgeInput({
      scheduleGame: buildScheduleGame({ awayTeamId: 201 }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.awayTeamId).toBe('201');
    }
  });

  it('preserves exact scheduledStartAt serialization from scheduleGame', () => {
    const start = new Date('2026-08-02T18:30:00Z');
    const input = buildBridgeInput({
      scheduleGame: buildScheduleGame({ startTimeUtc: start }),
      researchSnapshot: buildResearchSnapshot({
        event: buildEvent({ startTimeUtc: start }),
      }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.scheduledStartAt).toBe('2026-08-02T18:30:00.000Z');
    }
  });

  it('derives dataCutoffAt from latest provenance fetchedAt', () => {
    const input = buildBridgeInput({
      researchSnapshot: buildResearchSnapshot({
        provenance: [
          buildDataProvenance({ source: 'mlb-stats-api:schedule', fetchedAt: new Date('2026-07-15T09:00:00Z'), sourceTimestamp: new Date('2026-07-15T09:00:00Z') }),
          buildDataProvenance({ source: 'mlb-stats-api:venue', fetchedAt: new Date('2026-07-15T09:45:00Z'), sourceTimestamp: new Date('2026-07-15T09:45:00Z') }),
        ],
      }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.dataCutoffAt).toBe('2026-07-15T09:45:00.000Z');
      expect(result.value.capturedAt).toBe(result.value.dataCutoffAt);
      expect(result.value.sourceReferences).toHaveLength(2);
      expect(result.value.sourceReferences[0].fetchedAt).toBe('2026-07-15T09:00:00.000Z');
      expect(result.value.sourceReferences[1].fetchedAt).toBe('2026-07-15T09:45:00.000Z');
      expect(result.value.sourceReferences[0].sourceUpdatedAt).toBe('2026-07-15T09:00:00.000Z');
      expect(result.value.sourceReferences[1].sourceUpdatedAt).toBe('2026-07-15T09:45:00.000Z');
    }
  });

  it('rejects dataCutoffAt equal to scheduledStartAt', () => {
    const start = new Date('2026-07-15T12:00:00Z');
    const input = buildBridgeInput({
      researchSnapshot: buildResearchSnapshot({
        event: buildEvent({ startTimeUtc: start }),
        provenance: [
          buildDataProvenance({ fetchedAt: start }),
        ],
      }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((issue) => issue.code === 'INVALID_TIMESTAMP_ORDER');
      expect(issue).toBeDefined();
    }
  });

  it('rejects post-start contamination', () => {
    const start = new Date('2026-07-15T12:00:00Z');
    const afterStart = new Date('2026-07-15T12:01:00Z');
    const input = buildBridgeInput({
      researchSnapshot: buildResearchSnapshot({
        event: buildEvent({ startTimeUtc: start }),
        provenance: [
          buildDataProvenance({ fetchedAt: afterStart }),
        ],
      }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((issue) => issue.code === 'INVALID_TIMESTAMP_ORDER');
      expect(issue).toBeDefined();
    }
  });

  it('rejects schedule/research game identity mismatch', () => {
    const input = buildBridgeInput({
      researchSnapshot: buildResearchSnapshot({
        event: buildEvent({ externalId: '99999' }),
      }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((issue) => issue.code === 'INVALID_STRING' && issue.path === '$.researchSnapshot.event.externalId');
      expect(issue).toBeDefined();
    }
  });

  it('rejects home team name mismatch', () => {
    const input = buildBridgeInput({
      researchSnapshot: buildResearchSnapshot({
        event: buildEvent({ homeTeam: 'Boston Red Sox' }),
      }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((issue) => issue.code === 'INVALID_STRING' && issue.path === '$.researchSnapshot.event.homeTeam');
      expect(issue).toBeDefined();
    }
  });

  it('rejects away team name mismatch', () => {
    const input = buildBridgeInput({
      researchSnapshot: buildResearchSnapshot({
        event: buildEvent({ awayTeam: 'New York Yankees' }),
      }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((issue) => issue.code === 'INVALID_STRING' && issue.path === '$.researchSnapshot.event.awayTeam');
      expect(issue).toBeDefined();
    }
  });

  it('rejects scheduled start mismatch', () => {
    const start = new Date('2026-07-15T12:00:00Z');
    const otherStart = new Date('2026-07-15T18:00:00Z');
    const input = buildBridgeInput({
      scheduleGame: buildScheduleGame({ startTimeUtc: start }),
      researchSnapshot: buildResearchSnapshot({
        event: buildEvent({ startTimeUtc: otherStart }),
      }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((issue) => issue.code === 'INVALID_TIMESTAMP_ORDER');
      expect(issue).toBeDefined();
    }
  });

  it('rejects LIVE status', () => {
    const input = buildBridgeInput({
      researchSnapshot: buildResearchSnapshot({
        event: buildEvent({ status: 'LIVE' }),
      }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((issue) => issue.code === 'INVALID_LITERAL');
      expect(issue).toBeDefined();
    }
  });

  it('rejects FINAL status', () => {
    const input = buildBridgeInput({
      researchSnapshot: buildResearchSnapshot({
        event: buildEvent({ status: 'FINAL' }),
      }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((issue) => issue.code === 'INVALID_LITERAL');
      expect(issue).toBeDefined();
    }
  });

  it('rejects POSTPONED status', () => {
    const input = buildBridgeInput({
      researchSnapshot: buildResearchSnapshot({
        event: buildEvent({ status: 'POSTPONED' }),
      }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((issue) => issue.code === 'INVALID_LITERAL');
      expect(issue).toBeDefined();
    }
  });

  it('rejects CANCELLED status', () => {
    const input = buildBridgeInput({
      researchSnapshot: buildResearchSnapshot({
        event: buildEvent({ status: 'CANCELLED' }),
      }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((issue) => issue.code === 'INVALID_LITERAL');
      expect(issue).toBeDefined();
    }
  });

  it('maps missing probable pitcher to UNAVAILABLE state', () => {
    const input = buildBridgeInput({
      researchSnapshot: buildResearchSnapshot({
        probablePitchers: {
          home: null,
          away: null,
        },
      }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.startingPitchers.home.state).toBe('UNAVAILABLE');
      expect(result.value.startingPitchers.away.state).toBe('UNAVAILABLE');
      expect(result.value.startingPitchers.home.pitcherId).toBeNull();
      expect(result.value.startingPitchers.away.pitcherId).toBeNull();
      expect(result.value.startingPitchers.home.announcedAt).toBeNull();
      expect(result.value.startingPitchers.away.announcedAt).toBeNull();
    }
  });

  it('maps available probable pitcher to canonical snapshot', () => {
    const homePitcher = {
      availability: 'AVAILABLE' as const,
      personId: 1001,
      fullName: 'Gerrit Cole',
      teamId: 110,
      status: 'CONFIRMED' as const,
      fetchedAt: new Date('2026-07-15T09:00:00Z'),
      warnings: [],
    };
    const input = buildBridgeInput({
      researchSnapshot: buildResearchSnapshot({
        probablePitchers: {
          home: homePitcher,
          away: null,
        },
      }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.startingPitchers.home.state).toBe('CONFIRMED');
      expect(result.value.startingPitchers.home.pitcherId).toBe('1001');
      expect(result.value.startingPitchers.away.state).toBe('UNAVAILABLE');
    }
  });

  it('uses gameNumber rather than seriesGameNumber for canonical doubleheader game number', () => {
    const input1 = buildBridgeInput({
      scheduleGame: buildScheduleGame({
        doubleHeader: 'Y',
        gameNumber: 1,
        seriesGameNumber: 7,
      }),
    });
    const result1 = buildMLBRealDataPregameSnapshot(input1);
    expect(result1.ok).toBe(true);
    if (result1.ok) {
      expect(result1.value.game.doubleheader).toEqual({
        doubleheaderId: '10:2026-07-153:1103:111',
        gameNumber: 1,
      });
    }

    const input2 = buildBridgeInput({
      scheduleGame: buildScheduleGame({
        doubleHeader: 'Y',
        gameNumber: 2,
        seriesGameNumber: 8,
      }),
    });
    const result2 = buildMLBRealDataPregameSnapshot(input2);
    expect(result2.ok).toBe(true);
    if (result2.ok) {
      expect(result2.value.game.doubleheader).toEqual({
        doubleheaderId: '10:2026-07-153:1103:111',
        gameNumber: 2,
      });
    }

    const input3 = buildBridgeInput({
      scheduleGame: buildScheduleGame({
        doubleHeader: 'N',
        gameNumber: 1,
        seriesGameNumber: 7,
      }),
    });
    const result3 = buildMLBRealDataPregameSnapshot(input3);
    expect(result3.ok).toBe(true);
    if (result3.ok) {
      expect(result3.value.game.doubleheader).toBeNull();
    }

    const input4 = buildBridgeInput({
      scheduleGame: buildScheduleGame({
        doubleHeader: 'Y',
        gameNumber: 1,
        seriesGameNumber: 2,
      }),
    });
    const result4 = buildMLBRealDataPregameSnapshot(input4);
    expect(result4.ok).toBe(true);
    if (result4.ok) {
      expect(result4.value.game.doubleheader?.gameNumber).toBe(1);
    }
  });

  it('derives doubleheaderId from officialDate and team identifiers', () => {
    const baseProvenance = buildDataProvenance();
    const baseInput = buildBridgeInput({
      scheduleGame: buildScheduleGame({
        gamePk: 1001,
        officialDate: '2026-07-15',
        homeTeamId: 110,
        awayTeamId: 111,
        doubleHeader: 'Y',
        gameNumber: 1,
      }),
      researchSnapshot: buildResearchSnapshot({
        event: buildEvent({ externalId: '1001' }),
        provenance: [baseProvenance],
      }),
    });
    const result1 = buildMLBRealDataPregameSnapshot(baseInput);
    expect(result1.ok).toBe(true);
    if (result1.ok) {
      expect(result1.value.game.doubleheader?.doubleheaderId).toBe('10:2026-07-153:1103:111');
    }

    const secondInput = buildBridgeInput({
      scheduleGame: buildScheduleGame({
        gamePk: 1002,
        officialDate: '2026-07-15',
        homeTeamId: 110,
        awayTeamId: 111,
        doubleHeader: 'Y',
        gameNumber: 2,
      }),
      researchSnapshot: buildResearchSnapshot({
        event: buildEvent({ externalId: '1002' }),
        provenance: [buildDataProvenance({ source: 'mlb-stats-api:schedule', fetchedAt: new Date('2026-07-15T09:30:00Z'), sourceTimestamp: new Date('2026-07-15T09:00:00Z') })],
      }),
    });
    const result2 = buildMLBRealDataPregameSnapshot(secondInput);
    expect(result2.ok).toBe(true);
    if (result2.ok) {
      expect(result2.value.game.doubleheader?.doubleheaderId).toBe('10:2026-07-153:1103:111');
      expect(result2.value.game.doubleheader?.gameNumber).toBe(2);
    }
  });

  it('supports doubleHeader S with valid gameNumber 1 and 2', () => {
    const input1 = buildBridgeInput({
      scheduleGame: buildScheduleGame({
        doubleHeader: 'S',
        gameNumber: 1,
        seriesGameNumber: 1,
      }),
    });
    const result1 = buildMLBRealDataPregameSnapshot(input1);
    expect(result1.ok).toBe(true);
    if (result1.ok) {
      expect(result1.value.game.doubleheader?.gameNumber).toBe(1);
    }

    const input2 = buildBridgeInput({
      scheduleGame: buildScheduleGame({
        doubleHeader: 'S',
        gameNumber: 2,
        seriesGameNumber: 2,
      }),
    });
    const result2 = buildMLBRealDataPregameSnapshot(input2);
    expect(result2.ok).toBe(true);
    if (result2.ok) {
      expect(result2.value.game.doubleheader?.gameNumber).toBe(2);
    }
  });

  it('rejects unsupported doubleheader gameNumber', () => {
    const input = buildBridgeInput({
      scheduleGame: buildScheduleGame({
        doubleHeader: 'Y',
        gameNumber: 3,
        seriesGameNumber: 3,
      }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((issue) => issue.code === 'INVALID_LITERAL');
      expect(issue).toBeDefined();
    }
  });

  it('rejects unsupported doubleHeader indicator', () => {
    const input = buildBridgeInput({
      scheduleGame: buildScheduleGame({
        doubleHeader: 'X',
        gameNumber: 1,
        seriesGameNumber: 1,
      }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((issue) => issue.code === 'INVALID_LITERAL');
      expect(issue).toBeDefined();
    }
  });

  it('maps all supported gameType codes and rejects unknown codes', () => {
    const cases: Array<{ raw: string; expected: string }> = [
      { raw: 'R', expected: 'REGULAR_SEASON' },
      { raw: 'S', expected: 'SPRING_TRAINING' },
      { raw: 'A', expected: 'ALL_STAR' },
      { raw: 'P', expected: 'POSTSEASON' },
      { raw: 'F', expected: 'POSTSEASON' },
      { raw: 'D', expected: 'POSTSEASON' },
      { raw: 'L', expected: 'POSTSEASON' },
      { raw: 'W', expected: 'POSTSEASON' },
      { raw: 'I', expected: 'OTHER' },
    ];

    for (const testCase of cases) {
      const input = buildBridgeInput({
        scheduleGame: buildScheduleGame({ gameType: testCase.raw }),
      });
      const result = buildMLBRealDataPregameSnapshot(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.game.gameType).toBe(testCase.expected);
      }
    }

    const unknownInput = buildBridgeInput({
      scheduleGame: buildScheduleGame({ gameType: 'Z' }),
    });
    const unknownResult = buildMLBRealDataPregameSnapshot(unknownInput);
    expect(unknownResult.ok).toBe(false);
    if (!unknownResult.ok) {
      const issue = unknownResult.issues.find((issue) => issue.code === 'INVALID_LITERAL');
      expect(issue).toBeDefined();
    }
  });

  it('proves bridge output neutralSite is null and not false', () => {
    const input = buildBridgeInput();
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.game.neutralSite).toBeNull();
      expect(result.value.game.neutralSite).not.toBe(false);
    }
  });

  it('proves sourceTimestamp cannot mask post-start acquisition', () => {
    const start = new Date('2026-07-15T12:00:00Z');
    const input = buildBridgeInput({
      researchSnapshot: buildResearchSnapshot({
        event: buildEvent({ startTimeUtc: start }),
        provenance: [
          buildDataProvenance({
            fetchedAt: new Date('2026-07-15T12:05:00Z'),
            sourceTimestamp: new Date('2026-07-15T11:50:00Z'),
          }),
        ],
      }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((issue) => issue.code === 'INVALID_TIMESTAMP_ORDER');
      expect(issue).toBeDefined();
    }
  });

  it('derives per-source provenance without using event.updatedAt', () => {
    const input = buildBridgeInput({
      researchSnapshot: buildResearchSnapshot({
        provenance: [
          buildDataProvenance({
            source: 'mlb-stats-api:schedule',
            fetchedAt: new Date('2026-07-15T09:00:00Z'),
            sourceTimestamp: new Date('2026-07-15T09:00:00Z'),
          }),
          buildDataProvenance({
            source: 'mlb-stats-api:venue',
            fetchedAt: new Date('2026-07-15T09:45:00Z'),
            sourceTimestamp: new Date('2026-07-15T09:45:00Z'),
          }),
        ],
      }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sourceReferences).toHaveLength(2);
      expect(result.value.sourceReferences[0].fetchedAt).toBe('2026-07-15T09:00:00.000Z');
      expect(result.value.sourceReferences[1].fetchedAt).toBe('2026-07-15T09:45:00.000Z');
      expect(result.value.sourceReferences[0].sourceUpdatedAt).toBe('2026-07-15T09:00:00.000Z');
      expect(result.value.sourceReferences[1].sourceUpdatedAt).toBe('2026-07-15T09:45:00.000Z');
    }
  });

  it('maps missing sourceTimestamp to null sourceUpdatedAt', () => {
    const input = buildBridgeInput({
      researchSnapshot: buildResearchSnapshot({
        provenance: [
          buildDataProvenance({
            source: 'mlb-stats-api:schedule',
            fetchedAt: new Date('2026-07-15T09:00:00Z'),
            sourceTimestamp: undefined,
          }),
        ],
      }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sourceReferences[0].sourceUpdatedAt).toBeNull();
    }
  });

  it('maps partial and insufficient completeness', () => {
    const partialInput = buildBridgeInput({
      researchSnapshot: buildResearchSnapshot({ completeness: 50 }),
    });
    const partialResult = buildMLBRealDataPregameSnapshot(partialInput);
    expect(partialResult.ok).toBe(true);
    if (partialResult.ok) {
      expect(partialResult.value.dataCompleteness).toBe('PARTIAL');
    }

    const insufficientInput = buildBridgeInput({
      researchSnapshot: buildResearchSnapshot({ completeness: 0 }),
    });
    const insufficientResult = buildMLBRealDataPregameSnapshot(insufficientInput);
    expect(insufficientResult.ok).toBe(true);
    if (insufficientResult.ok) {
      expect(insufficientResult.value.dataCompleteness).toBe('INSUFFICIENT');
    }
  });

  it('rejects empty provenance', () => {
    const input = buildBridgeInput({
      researchSnapshot: buildResearchSnapshot({
        provenance: [],
      }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((issue) => issue.code === 'MISSING_FIELD');
      expect(issue).toBeDefined();
    }
  });

  it('proves missing venue produces UNAVAILABLE section with null neutralSite', () => {
    const input = buildBridgeInput({
      researchSnapshot: buildResearchSnapshot({
        venue: null,
      }),
    });
    const result = buildMLBRealDataPregameSnapshot(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const venueSection = result.value.sections.find((s) => s.sectionId === 'section-venue');
      expect(venueSection).toBeDefined();
      expect(venueSection?.status).toBe('UNAVAILABLE');
      expect(result.value.game.neutralSite).toBeNull();
    }
  });

  it('does not mutate caller-owned scheduleGame or researchSnapshot', () => {
    const scheduleGame = buildScheduleGame() as Record<string, unknown>;
    const researchSnapshot = buildResearchSnapshot() as Record<string, unknown>;
    const input = buildBridgeInput({
      scheduleGame,
      researchSnapshot,
    });

    const scheduleGameClone = structuredClone(scheduleGame);
    const researchSnapshotClone = structuredClone(researchSnapshot);

    const result = buildMLBRealDataPregameSnapshot(input);
    expect(result.ok).toBe(true);

    expect(scheduleGame).toEqual(scheduleGameClone);
    expect(researchSnapshot).toEqual(researchSnapshotClone);
  });

  it('produces deeply equivalent output for equivalent inputs', () => {
    const input1 = buildBridgeInput();
    const input2 = buildBridgeInput();
    const result1 = buildMLBRealDataPregameSnapshot(input1);
    const result2 = buildMLBRealDataPregameSnapshot(input2);

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    if (result1.ok && result2.ok) {
      expect(result2.value).toEqual(result1.value);
    }
  });
});
