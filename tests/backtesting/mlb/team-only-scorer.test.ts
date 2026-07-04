import { describe, it, expect } from 'vitest';
import { computeTeamOnlyScore, TEAM_ONLY_SCORE_VERSION } from '@/lib/backtesting/mlb/team-only-scorer';
import { buildHistoricalSnapshot } from '@/lib/backtesting/mlb/snapshot-builder';
import type { BacktestSnapshot, HistoricalMLBGame, HistoricalTeamGame, HistoricalTeamProfile } from '@/lib/backtesting/types';
import type { PitcherAssignment } from '@/lib/research-data/types';

function makeGame(overrides: Partial<HistoricalMLBGame> = {}): HistoricalMLBGame {
  return {
    gamePk: overrides.gamePk ?? 1001,
    officialDate: '2024-06-01',
    gameDate: new Date('2024-06-01T16:00:00Z'),
    homeTeamId: 101,
    awayTeamId: 102,
    homeTeamName: 'Home',
    awayTeamName: 'Away',
    venueId: 1,
    status: overrides.status ?? 'FINAL',
    probablePitchers: overrides.probablePitchers ?? null,
    cutoff: overrides.cutoff ?? { eventId: 'event-1001', cutoffTime: new Date('2024-06-01T14:00:00Z') },
  };
}

function makeTeamGames(side: 'HOME' | 'AWAY', wins: boolean[]): HistoricalTeamGame[] {
  return wins.map((win, idx) => ({
    gamePk: 9901 + idx,
    gameDate: new Date('2024-05-28T00:00:00Z'),
    opponent: 'Opp',
    opponentTeamId: side === 'HOME' ? 2 : 1,
    homeAway: side,
    runsScored: win ? 5 : 2,
    runsAllowed: win ? 2 : 5,
    win,
  }));
}

function makeTeamGamesRaw(
  side: 'HOME' | 'AWAY',
  wins: boolean[],
): { gamePk: number; gameDate: string; opponent: string; opponentTeamId: number; homeAway: 'HOME' | 'AWAY'; runsScored: number | null; runsAllowed: number | null; win: boolean | null }[] {
  return wins.map((win, idx) => ({
    gamePk: 9901 + idx,
    gameDate: '2024-05-28',
    opponent: 'Opp',
    opponentTeamId: side === 'HOME' ? 2 : 1,
    homeAway: side,
    runsScored: win ? 5 : 2,
    runsAllowed: win ? 2 : 5,
    win,
  }));
}

function makeTeamProfile(
  teamId: number,
  recentGames: { gamePk: number; gameDate: string; opponent: string; opponentTeamId: number; homeAway: 'HOME' | 'AWAY'; runsScored: number | null; runsAllowed: number | null; win: boolean | null }[] = makeTeamGamesRaw(teamId === 101 ? 'HOME' : 'AWAY', [true]),
): HistoricalTeamProfile {
  return {
    teamId,
    teamName: `Team ${teamId}`,
    seasonStats: {
      gamesPlayed: 50,
      runs: 200,
      hits: 400,
      homeRuns: 30,
      strikeOuts: 350,
      baseOnBalls: 140,
      battingAverage: '.250',
      obp: '.320',
      slg: '.400',
      ops: '.720',
    },
    recentGames,
    completeness: 1,
    warnings: [],
    provenance: {
      source: 'test',
      fetchedAt: new Date('2024-06-01T12:00:00Z'),
      sourceTimestamp: new Date('2024-05-31T12:00:00Z'),
      isLive: false,
      warnings: [],
    },
    asOf: new Date('2024-05-31T23:59:59Z'),
  };
}

function makeAvailablePitcherAssignment(
  personId: number,
  teamId: number,
): PitcherAssignment {
  return {
    availability: 'AVAILABLE' as const,
    personId,
    fullName: `Pitcher ${personId}`,
    teamId,
    status: 'CONFIRMED' as const,
    fetchedAt: new Date('2024-06-01T12:00:00Z'),
    warnings: [],
  };
}

function makeUnavailablePitcherAssignment(
  teamId: number,
): PitcherAssignment {
  return {
    availability: 'UNAVAILABLE' as const,
    teamId,
    status: 'UNAVAILABLE' as const,
    fetchedAt: new Date('2024-06-01T12:00:00Z'),
    warnings: [],
  };
}

function buildTeamOnlySnapshot(
  overrides: {
    dataQuality?: number;
    warnings?: string[];
    homeAvailable?: boolean;
    awayAvailable?: boolean;
    homeRecentWins?: boolean[];
    awayRecentWins?: boolean[];
  } = {},
): BacktestSnapshot {
  const {
    dataQuality = 70,
    warnings = [],
    homeAvailable = true,
    awayAvailable = true,
    homeRecentWins = [true],
    awayRecentWins = [false],
  } = overrides;

  const home = homeAvailable
    ? makeAvailablePitcherAssignment(201, 101)
    : makeUnavailablePitcherAssignment(101);
  const away = awayAvailable
    ? makeAvailablePitcherAssignment(202, 102)
    : makeUnavailablePitcherAssignment(102);

  const game = makeGame({
    probablePitchers: { home, away },
  });

  const homeTeam = makeTeamProfile(101, makeTeamGamesRaw('HOME', homeRecentWins));
  const awayTeam = makeTeamProfile(102, makeTeamGamesRaw('AWAY', awayRecentWins));

  return buildHistoricalSnapshot(
    game,
    game.cutoff.cutoffTime,
    { home: null, away: null },
    { home: homeTeam, away: awayTeam },
    { home: makeTeamGames('HOME', homeRecentWins), away: makeTeamGames('AWAY', awayRecentWins) },
    new Date('2024-06-01T00:00:00Z'),
    'test',
    warnings,
    dataQuality,
  );
}

describe('computeTeamOnlyScore', () => {
  it('produces deterministic scores and uses team-only version', () => {
    const snapshot = buildTeamOnlySnapshot();
    const result = computeTeamOnlyScore(snapshot);

    expect(result.version).toBe(TEAM_ONLY_SCORE_VERSION);
    expect(result.abstained).toBe(false);
    expect(result.warnings).toContain('TEAM_ONLY_RESEARCH');
  });

  it('excludes zero-weight pitcher groups and batter-only groups from componentScores', () => {
    const snapshot = buildTeamOnlySnapshot();
    const result = computeTeamOnlyScore(snapshot);

    expect(result.componentScores).not.toHaveProperty('startingPitcher');
    expect(result.componentScores).not.toHaveProperty('bullpen');
    expect(result.componentScores).not.toHaveProperty('injuriesLineup');
    expect(result.componentScores).not.toHaveProperty('weatherRoof');
    expect(result.componentScores).not.toHaveProperty('offenseLineup');
  });

  it('is invariant to pitcher-related profile changes', () => {
    const snapshotA = buildTeamOnlySnapshot();
    const baseResult = computeTeamOnlyScore(snapshotA);

    const pitcherProfile = {
      personId: 201,
      fullName: 'Pitcher 201',
      teamId: 101,
      seasonStats: {
        era: '2.50',
        whip: '1.10',
        strikeoutsPer9Inn: '10.1',
        walksPer9Inn: '1.8',
        hitsPer9Inn: '7.0',
        homeRunsPer9: '0.5',
        inningsPitched: '110.2',
        gamesPlayed: 20,
        gamesStarted: 20,
      },
      recentStarts: [
        {
          date: '2024-05-25',
          opponent: 'Opp',
          opponentTeamId: 1,
          inningsPitched: '6.0',
          earnedRuns: 1,
          strikeOuts: 8,
          baseOnBalls: 2,
          pitches: 98,
          homeRunsAllowed: 0,
          hits: 4,
          gamePk: 5001,
        },
      ],
      daysSinceLastStart: 7,
      completeness: 1,
      warnings: [],
      provenance: {
        source: 'test',
        fetchedAt: new Date('2024-06-01T12:00:00Z'),
        sourceTimestamp: new Date('2024-05-31T12:00:00Z'),
        isLive: false,
        warnings: [],
      },
      asOf: new Date('2024-05-31T23:59:59Z'),
    };

    const game = makeGame({
      probablePitchers: {
        home: makeAvailablePitcherAssignment(201, 101),
        away: makeAvailablePitcherAssignment(202, 102),
      },
    });

    const snapshotB = buildHistoricalSnapshot(
      game,
      game.cutoff.cutoffTime,
      { home: pitcherProfile, away: pitcherProfile },
      { home: makeTeamProfile(101), away: makeTeamProfile(102) },
      { home: [], away: [] },
      new Date('2024-06-01T00:00:00Z'),
      'test',
      [],
      70,
    );

    const resultB = computeTeamOnlyScore(snapshotB);

    expect(resultB.predictedSide).toBe(baseResult.predictedSide);
    expect(resultB.researchStrengthScore).toBe(baseResult.researchStrengthScore);
    expect(resultB.confidence).toBe(baseResult.confidence);
    expect(resultB.dataQuality).toBe(baseResult.dataQuality);
    expect(resultB.volatility).toBe(baseResult.volatility);
    expect(resultB.componentScores).toEqual(baseResult.componentScores);
    expect(resultB.warnings).toEqual(baseResult.warnings);
  });

  it('includes TEAM_ONLY_RESEARCH and STARTING_PITCHERS_UNAVAILABLE warnings when not abstained', () => {
    const snapshot = buildTeamOnlySnapshot();
    const result = computeTeamOnlyScore(snapshot);

    expect(result.abstained).toBe(false);
    expect(result.warnings).toContain('TEAM_ONLY_RESEARCH');
    expect(result.warnings).toContain('STARTING_PITCHERS_UNAVAILABLE');
  });

  it('caps confidence below full ceiling', () => {
    const snapshot = buildTeamOnlySnapshot();
    const result = computeTeamOnlyScore(snapshot);

    expect(result.confidence).toBeLessThan(100);
  });

  it('abstains with TEAM_ONLY_INSUFFICIENT_TEAM_EVIDENCE when no evidence is available', () => {
    const snapshot: BacktestSnapshot = {
      game: makeGame({
        probablePitchers: {
          home: makeUnavailablePitcherAssignment(101),
          away: makeUnavailablePitcherAssignment(102),
        },
      }),
      cutoff: new Date('2024-06-01T14:00:00Z'),
      pitcherProfiles: { home: null, away: null },
      teamProfiles: { home: null, away: null },
      recentGames: { home: [], away: [] },
      features: {
        startingPitcher: {
          homeEra: null,
          awayEra: null,
          homeWhip: null,
          awayWhip: null,
          homeKPer9: null,
          awayKPer9: null,
          homeDaysRest: null,
          awayDaysRest: null,
          homeAvailable: false,
          awayAvailable: false,
        },
        offense: {
          homeRunsPerGame: null,
          awayRunsPerGame: null,
          homeOps: null,
          awayOps: null,
          homeRecentWinRate: null,
          awayRecentWinRate: null,
          homeSeasonWinRate: null,
          awaySeasonWinRate: null,
        },
        context: {
          homeAdvantage: false,
          venueKnown: false,
          weatherAvailable: false,
        },
        availability: {
          startingPitcher: false,
          opponentBatting: false,
          bullpen: false,
          offenseLineup: false,
          homePark: false,
          injuriesLineup: false,
          restTravel: false,
          weatherRoof: false,
        },
      },
      warnings: [],
      dataQuality: 70,
      featureVersion: 'test',
      generatedAt: new Date('2024-06-01T00:00:00Z'),
    };

    const result = computeTeamOnlyScore(snapshot);

    expect(result.abstained).toBe(true);
    expect(result.abstentionReason).toBe('TEAM_ONLY_INSUFFICIENT_TEAM_EVIDENCE');
  });

  it('abstains with DATA_QUALITY_BELOW_THRESHOLD when data quality is low', () => {
    const snapshot = buildTeamOnlySnapshot({ dataQuality: 20 });
    const result = computeTeamOnlyScore(snapshot);

    expect(result.abstained).toBe(true);
    expect(result.abstentionReason).toBe('DATA_QUALITY_BELOW_THRESHOLD');
  });

  it('ignores post-cutoff team recentGames', () => {
    const preSnapshot = buildTeamOnlySnapshot();
    const postSnapshot = buildTeamOnlySnapshot({
      homeRecentWins: [true, true],
      awayRecentWins: [false, true],
    });

    const preResult = computeTeamOnlyScore(preSnapshot);
    const postResult = computeTeamOnlyScore(postSnapshot);

    expect(postResult.predictedSide).toBe(preResult.predictedSide);
    expect(postResult.researchStrengthScore).toBe(preResult.researchStrengthScore);
    expect(postResult.confidence).toBe(preResult.confidence);
    expect(postResult.dataQuality).toBe(preResult.dataQuality);
    expect(postResult.volatility).toBe(preResult.volatility);
    expect(postResult.componentScores).toEqual(preResult.componentScores);
    expect(postResult.warnings).toEqual(preResult.warnings);
  });
});
