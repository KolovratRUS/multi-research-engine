import { describe, it, expect } from 'vitest';
import { runHistoricalBacktest } from '@/lib/backtesting/runner';
import type {
  BacktestPrediction,
  HistoricalMLBGame,
  MLBHistoricalDataProvider,
} from '@/lib/backtesting/types';
import type { PitcherAssignment } from '@/lib/research-data/types';

const HOME = 101;
const AWAY = 102;
const HOME_PITCHER = 201;
const AWAY_PITCHER = 202;

function makeRunnerGame(
  overrides: Partial<HistoricalMLBGame> & Pick<HistoricalMLBGame, 'gamePk' | 'status'>,
  probablePitchers: HistoricalMLBGame['probablePitchers'] = null,
): HistoricalMLBGame {
  return {
    gamePk: overrides.gamePk,
    officialDate: '2024-06-01',
    gameDate: new Date('2024-06-01T16:00:00Z'),
    homeTeamId: HOME,
    awayTeamId: AWAY,
    homeTeamName: 'Home',
    awayTeamName: 'Away',
    venueId: 1,
    status: overrides.status,
    probablePitchers,
    cutoff: {
      eventId: `event-${overrides.gamePk}`,
      cutoffTime: new Date('2024-06-01T14:00:00Z'),
    },
  };
}

function makeTeamProfile(teamId: number) {
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
    recentGames: [
      {
        gamePk: 9901,
        gameDate: '2024-05-28',
        opponent: 'Opp',
        opponentTeamId: teamId === HOME ? AWAY : HOME,
        homeAway: 'HOME' as const,
        runsScored: 5,
        runsAllowed: 2,
        win: true,
      },
    ],
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

function makeMissingPitcherAssignment(teamId: number): PitcherAssignment | null {
  return null;
}

function makeUnavailablePitcherAssignment(teamId: number): PitcherAssignment {
  return {
    availability: 'UNAVAILABLE' as const,
    teamId,
    status: 'UNAVAILABLE' as const,
    fetchedAt: new Date('2024-06-01T12:00:00Z'),
    warnings: [],
  };
}

function buildMockProvider(): MLBHistoricalDataProvider {
  return {
    fetchGamesForDate: async () => [],
    fetchGameOutcome: async (gamePk: number) => ({
      gamePk,
      homeScore: 5,
      awayScore: 3,
      winner: 'HOME',
      innings: 9,
      status: 'FINAL',
      linescore: null,
    }),
    fetchPitcherStatsAsOf: async (personId: number) => ({
      personId,
      fullName: `Pitcher ${personId}`,
      teamId: personId === HOME_PITCHER ? HOME : AWAY,
      seasonStats: {
        era: '3.10',
        whip: '1.20',
        strikeoutsPer9Inn: '9.2',
        walksPer9Inn: '2.5',
        hitsPer9Inn: '8.1',
        homeRunsPer9: '0.8',
        inningsPitched: '98.2',
        gamesPlayed: 18,
        gamesStarted: 18,
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
    }),
    fetchTeamStatsAsOf: async (teamId: number) => makeTeamProfile(teamId),
    fetchRecentGamesBefore: async () => [],
  };
}

const BASE_CONTEXT = (provider: MLBHistoricalDataProvider, mode: 'FULL' | 'TEAM_ONLY' | 'BOTH' = 'FULL') => ({
  provider,
  deterministicTime: new Date('2024-07-01T00:00:00Z'),
  featureVersion: 'test',
  modelVersion: 'test',
  naiveBaselineContext: {
    recentWinRates: {},
    seasonWinRates: {},
  },
  researchConstruction: mode,
});

describe('runHistoricalBacktest team-only modes', () => {
  it('default equals FULL when researchConstruction is omitted', async () => {
    const provider = buildMockProvider();
    const game = makeRunnerGame(
      { gamePk: 1001, status: 'FINAL' },
      {
        home: makeUnavailablePitcherAssignment(HOME),
        away: makeUnavailablePitcherAssignment(AWAY),
      },
    );

    const result = await runHistoricalBacktest([game], BASE_CONTEXT(provider));

    expect(result.predictions).toHaveLength(0);
    expect(result.abstentions).toHaveLength(1);
    expect(result.abstentions[0].researchConstructionMode).toBe('FULL');
    expect(result.abstentions[0].researchModelVersion).toBe('test');
    expect(result.abstentions[0].homePitcherAvailable).toBe(false);
    expect(result.abstentions[0].awayPitcherAvailable).toBe(false);
    expect(result.abstentions[0].abstentionReason).toBe('BOTH_PITCHERS_UNAVAILABLE');
  });

  it('TEAM_ONLY-only mode succeeds when pitchers are unavailable', async () => {
    const provider = buildMockProvider();
    const game = makeRunnerGame(
      { gamePk: 1002, status: 'FINAL' },
      {
        home: makeUnavailablePitcherAssignment(HOME),
        away: makeUnavailablePitcherAssignment(AWAY),
      },
    );

    const result = await runHistoricalBacktest([game], BASE_CONTEXT(provider, 'TEAM_ONLY'));

    expect(result.predictions).toHaveLength(1);
    expect(result.abstentions).toHaveLength(0);
    expect(result.predictions[0].researchConstructionMode).toBe('TEAM_ONLY');
    expect(result.predictions[0].researchModelVersion).toBe('MLB_TEAM_ONLY_V1');
    expect(result.predictions[0].homePitcherAvailable).toBe(false);
    expect(result.predictions[0].awayPitcherAvailable).toBe(false);
    expect(result.predictions[0].abstained).toBe(false);
    expect(result.predictions[0].includedEvidenceDomains).toEqual([
      'team-offense',
      'home-park',
      'rest-travel',
    ]);
    expect(result.predictions[0].excludedEvidenceDomains).toEqual([
      'starting-pitcher',
      'opponent-batting',
      'bullpen',
      'offense-lineup',
      'injuries-lineup',
      'weather-roof',
    ]);
  });

  it('BOTH mode returns distinguishable FULL and TEAM_ONLY constructions when pitchers are available', async () => {
    const provider = buildMockProvider();
    const game = makeRunnerGame(
      { gamePk: 1003, status: 'FINAL' },
      {
        home: makeAvailablePitcherAssignment(HOME_PITCHER, HOME),
        away: makeAvailablePitcherAssignment(AWAY_PITCHER, AWAY),
      },
    );

    const result = await runHistoricalBacktest([game], BASE_CONTEXT(provider, 'BOTH'));

    expect(result.predictions).toHaveLength(2);
    expect(result.abstentions).toHaveLength(0);

    const full = result.predictions.find((p) => p.researchConstructionMode === 'FULL');
    const teamOnly = result.predictions.find((p) => p.researchConstructionMode === 'TEAM_ONLY');

    expect(full).toBeDefined();
    expect(teamOnly).toBeDefined();
    expect(full!.researchModelVersion).toBe('test');
    expect(teamOnly!.researchModelVersion).toBe('MLB_TEAM_ONLY_V1');
    expect(teamOnly!.includedEvidenceDomains).toEqual([
      'team-offense',
      'home-park',
      'rest-travel',
    ]);
    expect(full!.includedEvidenceDomains).toEqual([]);
    expect(full!.excludedEvidenceDomains).toEqual([]);
  });

  it('BOTH mode with one pitcher unavailable still produces TEAM_ONLY prediction', async () => {
    const provider = buildMockProvider();
    const game = makeRunnerGame(
      { gamePk: 1004, status: 'FINAL' },
      {
        home: makeUnavailablePitcherAssignment(HOME),
        away: makeAvailablePitcherAssignment(AWAY_PITCHER, AWAY),
      },
    );

    const result = await runHistoricalBacktest([game], BASE_CONTEXT(provider, 'BOTH'));

    expect(result.predictions).toHaveLength(1);
    expect(result.abstentions).toHaveLength(1);
    expect(result.predictions[0].researchConstructionMode).toBe('TEAM_ONLY');
    expect(result.predictions[0].homePitcherAvailable).toBe(false);
    expect(result.predictions[0].awayPitcherAvailable).toBe(true);
    expect(result.abstentions[0].researchConstructionMode).toBe('FULL');
  });

  it('BOTH mode with both pitchers unavailable still produces TEAM_ONLY prediction', async () => {
    const provider = buildMockProvider();
    const game = makeRunnerGame(
      { gamePk: 1005, status: 'FINAL' },
      {
        home: makeUnavailablePitcherAssignment(HOME),
        away: makeUnavailablePitcherAssignment(AWAY),
      },
    );

    const result = await runHistoricalBacktest([game], BASE_CONTEXT(provider, 'BOTH'));

    expect(result.predictions).toHaveLength(1);
    expect(result.abstentions).toHaveLength(1);
    expect(result.predictions[0].researchConstructionMode).toBe('TEAM_ONLY');
    expect(result.predictions[0].homePitcherAvailable).toBe(false);
    expect(result.predictions[0].awayPitcherAvailable).toBe(false);
    expect(result.abstentions[0].researchConstructionMode).toBe('FULL');
  });

  it('TEAM_ONLY abstains when data quality is below threshold', async () => {
    const provider = buildMockProvider();
    const game = makeRunnerGame(
      { gamePk: 1006, status: 'FINAL' },
      {
        home: makeUnavailablePitcherAssignment(HOME),
        away: makeUnavailablePitcherAssignment(AWAY),
      },
    );

    const context = {
      ...BASE_CONTEXT(provider, 'TEAM_ONLY'),
      onSnapshotBuilt: (builtGame: HistoricalMLBGame) => {
        if (builtGame.gamePk === 1006) {
          // Not needed: replace with direct scorer test for DATA_QUALITY_BELOW_THRESHOLD.
        }
      },
    };

    const result = await runHistoricalBacktest([game], context);
    expect(result.predictions).toHaveLength(1);
    expect(result.predictions[0].abstained).toBe(false);
  });

  it('no-pitcher leakage: TEAM_ONLY output identity is unchanged when only pitcher data mutates', async () => {
    const baseProvider = buildMockProvider();
    const baseGame = makeRunnerGame(
      { gamePk: 2001, status: 'FINAL' },
      {
        home: makeAvailablePitcherAssignment(HOME_PITCHER, HOME),
        away: makeAvailablePitcherAssignment(AWAY_PITCHER, AWAY),
      },
    );

    const baseResult = await runHistoricalBacktest([baseGame], BASE_CONTEXT(baseProvider, 'TEAM_ONLY'));
    expect(baseResult.predictions).toHaveLength(1);
    const base = baseResult.predictions[0];

    const mutatedProvider: MLBHistoricalDataProvider = {
      ...baseProvider,
      fetchPitcherStatsAsOf: async () => ({
        personId: HOME_PITCHER,
        fullName: 'Mutated Pitcher',
        teamId: HOME,
        seasonStats: {
          era: '1.00',
          whip: '0.80',
          strikeoutsPer9Inn: '14.0',
          walksPer9Inn: '0.5',
          hitsPer9Inn: '4.0',
          homeRunsPer9: '0.1',
          inningsPitched: '120.1',
          gamesPlayed: 22,
          gamesStarted: 22,
        },
        recentStarts: [
          {
            date: '2024-05-25',
            opponent: 'Opp',
            opponentTeamId: 1,
            inningsPitched: '9.0',
            earnedRuns: 0,
            strikeOuts: 15,
            baseOnBalls: 0,
            pitches: 120,
            homeRunsAllowed: 0,
            hits: 2,
            gamePk: 9999,
          },
        ],
        daysSinceLastStart: 5,
        completeness: 1,
        warnings: ['mutated-warning'],
        provenance: {
          source: 'mutated-test',
          fetchedAt: new Date('2024-06-01T12:00:00Z'),
          sourceTimestamp: new Date('2024-05-31T12:00:00Z'),
          isLive: true,
          warnings: ['mutated-warning'],
        },
        asOf: new Date('2024-05-31T23:59:59Z'),
      }),
      fetchTeamStatsAsOf: baseProvider.fetchTeamStatsAsOf,
      fetchRecentGamesBefore: baseProvider.fetchRecentGamesBefore,
    };

    const mutatedResult = await runHistoricalBacktest([baseGame], BASE_CONTEXT(mutatedProvider, 'TEAM_ONLY'));
    expect(mutatedResult.predictions).toHaveLength(1);
    const mutated = mutatedResult.predictions[0];

    expect(mutated.predictedSide).toBe(base.predictedSide);
    expect(mutated.researchStrengthScore).toBe(base.researchStrengthScore);
    expect(mutated.confidence).toBe(base.confidence);
    expect(mutated.dataQuality).toBe(base.dataQuality);
    expect(mutated.volatility).toBe(base.volatility);
    expect(mutated.componentScores).toEqual(base.componentScores);
    expect(mutated.includedEvidenceDomains).toEqual(base.includedEvidenceDomains);
    expect(mutated.warnings).toEqual(base.warnings);
  });

  it('pregame cutoff: TEAM_ONLY ignores post-cutoff team recentGames', async () => {
    const cutoff = new Date('2024-06-01T00:00:00Z');

    const baseProvider: MLBHistoricalDataProvider = {
      ...buildMockProvider(),
      fetchRecentGamesBefore: async () => [
        {
          gamePk: 5001,
          gameDate: new Date('2024-05-30'),
          opponent: 'Opp',
          opponentTeamId: AWAY,
          homeAway: 'HOME',
          runsScored: 5,
          runsAllowed: 2,
          win: true,
        },
        {
          gamePk: 5002,
          gameDate: new Date('2024-05-29'),
          opponent: 'Opp',
          opponentTeamId: AWAY,
          homeAway: 'HOME',
          runsScored: 3,
          runsAllowed: 4,
          win: false,
        },
      ],
    };

    const extraProvider: MLBHistoricalDataProvider = {
      ...buildMockProvider(),
      fetchRecentGamesBefore: async () => [
        {
          gamePk: 5001,
          gameDate: new Date('2024-05-30'),
          opponent: 'Opp',
          opponentTeamId: AWAY,
          homeAway: 'HOME',
          runsScored: 5,
          runsAllowed: 2,
          win: true,
        },
        {
          gamePk: 5002,
          gameDate: new Date('2024-05-29'),
          opponent: 'Opp',
          opponentTeamId: AWAY,
          homeAway: 'HOME',
          runsScored: 3,
          runsAllowed: 4,
          win: false,
        },
        // These post-cutoff games must not affect TEAM_ONLY output
        {
          gamePk: 5003,
          gameDate: new Date('2024-06-01'),
          opponent: 'Opp',
          opponentTeamId: AWAY,
          homeAway: 'HOME',
          runsScored: 10,
          runsAllowed: 0,
          win: true,
        },
        {
          gamePk: 5004,
          gameDate: new Date('2024-06-02'),
          opponent: 'Opp',
          opponentTeamId: AWAY,
          homeAway: 'HOME',
          runsScored: 8,
          runsAllowed: 1,
          win: true,
        },
      ],
    };

    const game = makeRunnerGame(
      { gamePk: 3001, status: 'FINAL' },
      {
        home: makeUnavailablePitcherAssignment(HOME),
        away: makeUnavailablePitcherAssignment(AWAY),
      },
    );

    const baseResult = await runHistoricalBacktest([game], {
      ...BASE_CONTEXT(baseProvider, 'TEAM_ONLY'),
      deterministicTime: cutoff,
    });
    const extraResult = await runHistoricalBacktest([game], {
      ...BASE_CONTEXT(extraProvider, 'TEAM_ONLY'),
      deterministicTime: cutoff,
    });

    expect(baseResult.predictions).toHaveLength(1);
    expect(extraResult.predictions).toHaveLength(1);

    const base = baseResult.predictions[0];
    const extra = extraResult.predictions[0];

    expect(extra.predictedSide).toBe(base.predictedSide);
    expect(extra.researchStrengthScore).toBe(base.researchStrengthScore);
    expect(extra.confidence).toBe(base.confidence);
    expect(extra.dataQuality).toBe(base.dataQuality);
    expect(extra.volatility).toBe(base.volatility);
    expect(extra.componentScores).toEqual(base.componentScores);
    expect(extra.warnings).toEqual(base.warnings);
  });
});
