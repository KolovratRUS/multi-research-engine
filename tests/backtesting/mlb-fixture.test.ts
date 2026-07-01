import { describe, it, expect } from 'vitest';
import { buildHistoricalSnapshot } from '@/lib/backtesting/mlb/snapshot-builder';
import { computeExploratoryScore } from '@/lib/backtesting/mlb/exploratory-scorer';
import { runHistoricalBacktest } from '@/lib/backtesting/runner';
import type { BacktestSnapshot, BacktestPrediction, HistoricalMLBGame } from '@/lib/backtesting/types';
import { buildMLBFixtures } from '@/fixtures/backtesting/mlb/fixture-games';
import { assertAvailableByCutoff, assertCompletedBeforeCutoff, assertNotFutureLeakage } from '@/lib/backtesting/leakage-guards';

describe('Phase 1B MLB backtest: fixture cutoff', () => {
  it('has cutoffTime strictly before gameDate', () => {
    const { games } = buildMLBFixtures();
    const cutoffMs = 30 * 60 * 1000;
    for (const game of games) {
      expect(game.cutoff.cutoffTime.getTime()).toBeLessThan(game.gameDate.getTime());
      expect(game.cutoff.cutoffTime.getTime()).toBe(game.gameDate.getTime() - cutoffMs);
    }
  });

  it('has no starting pitcher timestamps after cutoff', () => {
    const fixture = buildMLBFixtures();
    const missingProfileIds = new Set(fixture.intentionallyMissingPitcherProfileIds);
    for (const game of fixture.games) {
      const cutoff = game.cutoff.cutoffTime;
      for (const key of ['home', 'away'] as const) {
        const assignment = game.probablePitchers?.[key];
        if (!assignment || assignment.availability !== 'AVAILABLE') continue;
        const profile = fixture.pitcherProfiles[assignment.personId];
        if (missingProfileIds.has(assignment.personId)) {
          expect(profile).toBeNull();
          continue;
        }
        expect(profile).not.toBeNull();
        const guardedProfile = profile;
        if (!guardedProfile) {
          throw new Error('profile unexpectedly null after not.toBeNull()');
        }
        expect(guardedProfile.asOf.getTime()).toBeLessThanOrEqual(cutoff.getTime());
        for (const start of guardedProfile.recentStarts) {
          expect(new Date(start.date).getTime()).toBeLessThan(cutoff.getTime());
        }
      }
    }
  });

  it('has recent games strictly before cutoff', () => {
    const fixture = buildMLBFixtures();
    for (const game of fixture.games) {
      const cutoff = game.cutoff.cutoffTime;
      for (const teamId of [game.homeTeamId, game.awayTeamId]) {
        const gamesList = fixture.recentTeamGames[teamId] ?? [];
        for (const g of gamesList) {
          expect(new Date(g.gameDate).getTime()).toBeLessThan(cutoff.getTime());
        }
      }
    }
  });
});

describe('Phase 1B MLB backtest: fixture integrity', () => {
  it('enforces outcome consistency for all fixtures', () => {
    const fixture = buildMLBFixtures();
    const outcomeMap = new Map(fixture.outcomes.map((o) => [o.gamePk, o]));

    for (const game of fixture.games) {
      const outcome = outcomeMap.get(game.gamePk);

      if (game.status === 'FINAL') {
        expect(outcome).toBeTruthy();
        expect(outcome?.winner === 'HOME' || outcome?.winner === 'AWAY').toBe(true);
        if (outcome?.winner === 'HOME') {
          expect(outcome?.homeScore).toBeGreaterThan(outcome?.awayScore ?? 0);
        } else if (outcome?.winner === 'AWAY') {
          expect(outcome?.awayScore).toBeGreaterThan(outcome?.homeScore ?? 0);
        }
        expect(outcome?.homeScore).not.toBeNull();
        expect(outcome?.awayScore).not.toBeNull();
      }

      if (['POSTPONED', 'CANCELLED', 'SUSPENDED'].includes(game.status)) {
        expect(outcome?.winner).toBeNull();
      }

      if (outcome) {
        expect(outcome.status).toBe(game.status);
      }
    }
  });

  it('contains no tied final games', () => {
    const fixture = buildMLBFixtures();
    for (const outcome of fixture.outcomes) {
      if (outcome.status === 'FINAL') {
        expect(outcome.winner === 'HOME' || outcome.winner === 'AWAY').toBe(true);
      }
    }
  });
});

describe('Phase 1B MLB backtest: leakage guards', () => {
  it('allows timestamp equal to cutoff', () => {
    expect(() => assertAvailableByCutoff(new Date('2024-06-01T10:00:00Z'), new Date('2024-06-01T10:00:00Z'))).not.toThrow();
  });

  it('rejects timestamp after cutoff', () => {
    expect(() => assertAvailableByCutoff(new Date('2024-06-01T10:01:00Z'), new Date('2024-06-01T10:00:00Z'))).toThrow();
  });

  it('rejects completed event at cutoff', () => {
    expect(() => assertCompletedBeforeCutoff(new Date('2024-06-01T10:00:00Z'), new Date('2024-06-01T10:00:00Z'))).toThrow();
  });

  it('rejects invalid dates', () => {
    expect(() => assertAvailableByCutoff(new Date(NaN), new Date('2024-06-01T10:00:00Z'))).toThrow();
    expect(() => assertCompletedBeforeCutoff(new Date('2024-06-01T10:00:00Z'), new Date(NaN))).toThrow();
  });
});

describe('Phase 1B MLB backtest: feature extraction', () => {
  it('computes nullable numeric parsing correctly', () => {
    const fixture = buildMLBFixtures();
    const game = fixture.games[0];
    const homeTeam = fixture.teamProfiles[game.homeTeamId];
    const awayTeam = fixture.teamProfiles[game.awayTeamId];

    const snapshot: BacktestSnapshot = {
      game,
      cutoff: game.cutoff.cutoffTime,
      pitcherProfiles: {
        home: game.probablePitchers?.home?.availability === 'AVAILABLE'
          ? {
              personId: 2001,
              fullName: 'Test',
              teamId: 100101,
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
              recentStarts: [],
              daysSinceLastStart: 7,
              completeness: 1,
              warnings: [],
              provenance: {
                source: 'test',
                fetchedAt: new Date(),
                sourceTimestamp: new Date(),
                isLive: false,
                warnings: [],
              },
              asOf: new Date(),
            }
          : null,
        away: game.probablePitchers?.away?.availability === 'AVAILABLE'
          ? {
              personId: 2002,
              fullName: 'Test',
              teamId: 100102,
              seasonStats: {
                era: '4.50',
                whip: '1.40',
                strikeoutsPer9Inn: '7.8',
                walksPer9Inn: '3.1',
                hitsPer9Inn: '9.2',
                homeRunsPer9: '1.1',
                inningsPitched: '85.1',
                gamesPlayed: 17,
                gamesStarted: 17,
              },
              recentStarts: [],
              daysSinceLastStart: 8,
              completeness: 1,
              warnings: [],
              provenance: {
                source: 'test',
                fetchedAt: new Date(),
                sourceTimestamp: new Date(),
                isLive: false,
                warnings: [],
              },
              asOf: new Date(),
            }
          : null,
      },
      teamProfiles: { home: homeTeam ?? null, away: awayTeam ?? null },
      recentGames: { home: [], away: [] },
      features: {
        startingPitcher: {
          homeEra: 3.1,
          awayEra: 4.5,
          homeWhip: 1.2,
          awayWhip: 1.4,
          homeKPer9: 9.2,
          awayKPer9: 7.8,
          homeDaysRest: 7,
          awayDaysRest: 8,
          homeAvailable: true,
          awayAvailable: true,
        },
        offense: {
          homeRunsPerGame: typeof homeTeam?.seasonStats?.runs === 'number' && homeTeam?.seasonStats?.gamesPlayed ? homeTeam.seasonStats.runs / homeTeam.seasonStats.gamesPlayed : null,
          awayRunsPerGame: typeof awayTeam?.seasonStats?.runs === 'number' && awayTeam?.seasonStats?.gamesPlayed ? awayTeam.seasonStats.runs / awayTeam.seasonStats.gamesPlayed : null,
          homeOps: typeof homeTeam?.seasonStats?.ops === 'string' ? parseFloat(homeTeam.seasonStats.ops) : null,
          awayOps: typeof awayTeam?.seasonStats?.ops === 'string' ? parseFloat(awayTeam.seasonStats.ops) : null,
          homeRecentWinRate: 1 / 2,
          awayRecentWinRate: 1 / 1,
          homeSeasonWinRate: 0.55,
          awaySeasonWinRate: 0.45,
        },
        context: {
          homeAdvantage: true,
          venueKnown: game.venueId > 0,
          weatherAvailable: false,
        },
        availability: {
          startingPitcher: game.probablePitchers?.home?.availability === 'AVAILABLE' && game.probablePitchers?.away?.availability === 'AVAILABLE',
          opponentBatting: true,
          bullpen: false,
          offenseLineup: true,
          homePark: true,
          injuriesLineup: false,
          restTravel: false,
          weatherRoof: false,
        },
      },
      warnings: [],
      dataQuality: 100,
      featureVersion: 'test',
      generatedAt: new Date(),
    };

    const result = computeExploratoryScore(snapshot);
    expect(result.abstained).toBe(false);
    if (!result.abstained) {
      expect(result.availableGroups).toContain('startingPitcher');
      expect(result.availableGroups).toContain('homePark');
    }
  });
});

describe('Phase 1B MLB backtest: scoring', () => {
  it('applies configured weights via renormalization', () => {
    const fixture = buildMLBFixtures();
    const game = fixture.games[0];
    const snapshot: BacktestSnapshot = {
      game,
      cutoff: game.cutoff.cutoffTime,
      pitcherProfiles: {
        home: fixture.pitcherProfiles[2001],
        away: fixture.pitcherProfiles[2002],
      },
      teamProfiles: {
        home: fixture.teamProfiles[100101],
        away: fixture.teamProfiles[100102],
      },
      recentGames: { home: [], away: [] },
      features: {
        startingPitcher: {
          homeEra: 3.1,
          awayEra: 4.5,
          homeWhip: 1.2,
          awayWhip: 1.4,
          homeKPer9: 9.2,
          awayKPer9: 7.8,
          homeDaysRest: 7,
          awayDaysRest: 8,
          homeAvailable: true,
          awayAvailable: true,
        },
        offense: {
          homeRunsPerGame: 3.88,
          awayRunsPerGame: 3.43,
          homeOps: 0.73,
          awayOps: 0.68,
          homeRecentWinRate: 0.5,
          awayRecentWinRate: 0.25,
          homeSeasonWinRate: 0.55,
          awaySeasonWinRate: 0.45,
        },
        context: {
          homeAdvantage: true,
          venueKnown: game.venueId > 0,
          weatherAvailable: false,
        },
        availability: {
          startingPitcher: true,
          opponentBatting: true,
          bullpen: false,
          offenseLineup: true,
          homePark: true,
          injuriesLineup: false,
          restTravel: false,
          weatherRoof: false,
        },
      },
      warnings: [],
      dataQuality: 100,
      featureVersion: 'test',
      generatedAt: new Date(),
    };

    const result = computeExploratoryScore(snapshot);
    expect(result.abstained).toBe(false);
    expect(result.abstentionReason).toBeUndefined();
    expect(Object.keys(result.componentScores).length).toBeGreaterThan(0);

    const weightMap: Record<string, number> = {
      startingPitcher: 0.28,
      opponentBatting: 0.20,
      bullpen: 0.14,
      offenseLineup: 0.13,
      homePark: 0.08,
      injuriesLineup: 0.07,
      restTravel: 0.05,
      weatherRoof: 0.05,
    };
    const availableWeightSum = result.availableGroups.reduce((sum, g) => sum + (weightMap[g] ?? 0), 0);
    expect(availableWeightSum).toBeCloseTo(0.69, 1);
    expect(result.totalWeight).toBeCloseTo(1.0, 1);
  });

  it('abstains when weighted coverage is below threshold', () => {
    const fixture = buildMLBFixtures();
    const game = fixture.games[0];
    const snapshot: BacktestSnapshot = {
      game,
      cutoff: game.cutoff.cutoffTime,
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
          homeAdvantage: true,
          venueKnown: game.venueId > 0,
          weatherAvailable: false,
        },
        availability: {
          startingPitcher: false,
          opponentBatting: false,
          bullpen: false,
          offenseLineup: false,
          homePark: true,
          injuriesLineup: false,
          restTravel: false,
          weatherRoof: false,
        },
      },
      warnings: [],
      dataQuality: 50,
      featureVersion: 'test',
      generatedAt: new Date(),
    };

    const result = computeExploratoryScore(snapshot);
    expect(result.abstained).toBe(true);
    expect(result.abstentionReason).toBe('BOTH_PITCHERS_UNAVAILABLE');
  });

  it('abstains with one pitcher when coverage remains below threshold', () => {
    const fixture = buildMLBFixtures();
    const game = fixture.games[0];
    const snapshot: BacktestSnapshot = {
      game,
      cutoff: game.cutoff.cutoffTime,
      pitcherProfiles: {
        home: fixture.pitcherProfiles[2001],
        away: null,
      },
      teamProfiles: {
        home: fixture.teamProfiles[100101],
        away: null,
      },
      recentGames: { home: [], away: [] },
      features: {
        startingPitcher: {
          homeEra: 3.1,
          awayEra: null,
          homeWhip: 1.2,
          awayWhip: null,
          homeKPer9: 9.2,
          awayKPer9: null,
          homeDaysRest: 7,
          awayDaysRest: null,
          homeAvailable: true,
          awayAvailable: false,
        },
        offense: {
          homeRunsPerGame: 3.88,
          awayRunsPerGame: null,
          homeOps: 0.73,
          awayOps: null,
          homeRecentWinRate: 0.5,
          awayRecentWinRate: null,
          homeSeasonWinRate: 0.55,
          awaySeasonWinRate: null,
        },
        context: {
          homeAdvantage: true,
          venueKnown: game.venueId > 0,
          weatherAvailable: false,
        },
        availability: {
          startingPitcher: false,
          opponentBatting: false,
          bullpen: false,
          offenseLineup: false,
          homePark: true,
          injuriesLineup: false,
          restTravel: false,
          weatherRoof: false,
        },
      },
      warnings: [],
      dataQuality: 70,
      featureVersion: 'test',
      generatedAt: new Date(),
    };

    const result = computeExploratoryScore(snapshot);
    expect(result.abstained).toBe(true);
    expect(result.abstentionReason).toBe('AWAY_PITCHER_UNAVAILABLE');
  });

  it('excludes unsupported groups from weighted score', () => {
    const fixture = buildMLBFixtures();
    const game = fixture.games[0];
    const snapshot: BacktestSnapshot = {
      game,
      cutoff: game.cutoff.cutoffTime,
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
          homeAdvantage: true,
          venueKnown: game.venueId > 0,
          weatherAvailable: false,
        },
        availability: {
          startingPitcher: false,
          opponentBatting: false,
          bullpen: false,
          offenseLineup: false,
          homePark: true,
          injuriesLineup: false,
          restTravel: false,
          weatherRoof: false,
        },
      },
      warnings: [],
      dataQuality: 100,
      featureVersion: 'test',
      generatedAt: new Date(),
    };

    const result = computeExploratoryScore(snapshot);
    expect(result.abstained).toBe(true);
    expect(result.abstentionReason).toBe('BOTH_PITCHERS_UNAVAILABLE');
  });
});

describe('Phase 1B MLB backtest: runner', () => {
  it('records prediction-created event before outcome-requested', async () => {
    const fixture = buildMLBFixtures();
    const game = fixture.games[0];

    // Re-run with event log
    let outcomeRequested = false;
    const events: string[] = [];
    const result = await runHistoricalBacktest(
      [game],
      {
        provider: {
          fetchGamesForDate: async () => [],
          fetchGameOutcome: async () => {
            outcomeRequested = true;
            events.push('outcome-requested');
            return { gamePk: game.gamePk, homeScore: 5, awayScore: 3, winner: 'HOME', innings: 9, status: 'FINAL', linescore: null };
          },
          fetchPitcherStatsAsOf: async (personId: number) => fixture.pitcherProfiles[personId] ?? null,
          fetchTeamStatsAsOf: async (teamId: number) => fixture.teamProfiles[teamId] ?? null,
          fetchRecentGamesBefore: async () => [],
        },
        deterministicTime: new Date(),
        featureVersion: 'test',
        modelVersion: 'test',
        naiveBaselineContext: {
          recentWinRates: fixture.recentWinRates,
          seasonWinRates: fixture.seasonWinRates,
        },
        onSnapshotBuilt: () => {
          events.push('snapshot-built');
        },
        onPredictionCreated: () => {
          events.push('prediction-created');
        },
      },
    );

    expect(events).toEqual(['snapshot-built', 'prediction-created', 'outcome-requested']);
    expect(outcomeRequested).toBe(true);
    expect(result.predictions.length).toBe(1);
  });

  it('does not request outcome for abstentions', async () => {
    const fixture = buildMLBFixtures();
    const game = fixture.games[13]; // game 1014 has both pitchers unavailable
    let outcomeRequested = false;

    const result = await runHistoricalBacktest(
      [game],
      {
        provider: {
          fetchGamesForDate: async () => [],
          fetchGameOutcome: async () => {
            outcomeRequested = true;
            return { gamePk: game.gamePk, homeScore: 2, awayScore: 5, winner: 'AWAY', innings: 9, status: 'FINAL', linescore: null };
          },
          fetchPitcherStatsAsOf: async () => null,
          fetchTeamStatsAsOf: async () => null,
          fetchRecentGamesBefore: async () => [],
        },
        deterministicTime: new Date(),
        featureVersion: 'test',
        modelVersion: 'test',
        naiveBaselineContext: {
          recentWinRates: fixture.recentWinRates,
          seasonWinRates: fixture.seasonWinRates,
        },
      },
    );

    expect(outcomeRequested).toBe(false);
    expect(result.abstentions.length).toBe(1);
    expect(result.abstentions[0].abstentionReason).toBe('BOTH_PITCHERS_UNAVAILABLE');
  });

  it('does not request outcome for known ineligible games', async () => {
    const fixture = buildMLBFixtures();
    const game = fixture.games[2]; // game 1003 is SUSPENDED
    let outcomeRequested = false;

    const result = await runHistoricalBacktest(
      [game],
      {
        provider: {
          fetchGamesForDate: async () => [],
          fetchGameOutcome: async () => {
            outcomeRequested = true;
            return { gamePk: game.gamePk, homeScore: null, awayScore: null, winner: null, innings: null, status: 'SUSPENDED', linescore: null };
          },
          fetchPitcherStatsAsOf: async () => null,
          fetchTeamStatsAsOf: async () => null,
          fetchRecentGamesBefore: async () => [],
        },
        deterministicTime: new Date(),
        featureVersion: 'test',
        modelVersion: 'test',
        naiveBaselineContext: {
          recentWinRates: fixture.recentWinRates,
          seasonWinRates: fixture.seasonWinRates,
        },
      },
    );

    expect(outcomeRequested).toBe(false);
    expect(result.predictions.length).toBe(0);
    expect(result.abstentions.length).toBe(1);
    expect(result.abstentions[0].abstentionReason).toBe('GAME_NOT_ELIGIBLE');
    expect(result.abstentions[0].voided).toBe(false);
  });

  it('creates new final result object after outcome', async () => {
    const fixture = buildMLBFixtures();
    const game = fixture.games[0];
    const capturedBeforeOutcome: BacktestPrediction[] = [];

    const result = await runHistoricalBacktest(
      [game],
      {
        provider: {
          fetchGamesForDate: async () => [],
          fetchGameOutcome: async () => ({ gamePk: game.gamePk, homeScore: 5, awayScore: 3, winner: 'HOME', innings: 9, status: 'FINAL', linescore: null }),
          fetchPitcherStatsAsOf: async (personId: number) => fixture.pitcherProfiles[personId] ?? null,
          fetchTeamStatsAsOf: async (teamId: number) => fixture.teamProfiles[teamId] ?? null,
          fetchRecentGamesBefore: async () => [],
        },
        deterministicTime: new Date(),
        featureVersion: 'test',
        modelVersion: 'test',
        naiveBaselineContext: {
          recentWinRates: fixture.recentWinRates,
          seasonWinRates: fixture.seasonWinRates,
        },
        onPredictionCreated: (pred) => {
          capturedBeforeOutcome.push(pred);
        },
      },
    );

    expect(capturedBeforeOutcome.length).toBe(1);
    expect(capturedBeforeOutcome[0].actualWinner).toBeNull();
    expect(result.predictions.length).toBe(1);
    expect(result.predictions[0].actualWinner).toBe('HOME');
  });

  it('uses real fixture team IDs and rates for baselines', async () => {
    const fixture = buildMLBFixtures();
    const result = await runHistoricalBacktest(
      fixture.games as HistoricalMLBGame[],
      {
        provider: {
          fetchGamesForDate: async () => [],
          fetchGameOutcome: async (gamePk: number) => {
            const outcome = fixture.outcomes.find((o) => o.gamePk === gamePk);
            if (!outcome) throw new Error(`Missing outcome for ${gamePk}`);
            return outcome;
          },
          fetchPitcherStatsAsOf: async (personId: number) => fixture.pitcherProfiles[personId] ?? null,
          fetchTeamStatsAsOf: async (teamId: number) => fixture.teamProfiles[teamId] ?? null,
          fetchRecentGamesBefore: async () => [],
        },
        deterministicTime: new Date(),
        featureVersion: 'test',
        modelVersion: 'test',
        naiveBaselineContext: {
          recentWinRates: fixture.recentWinRates,
          seasonWinRates: fixture.seasonWinRates,
        },
      },
    );

    expect(result.metrics.naiveSeasonBaseline).toBeDefined();
    expect(typeof result.metrics.naiveSeasonBaseline).toBe('number');
    const baseline = result.metrics.naiveSeasonBaseline;
    if (baseline === null || baseline === undefined) {
      throw new Error('naiveSeasonBaseline must be a number');
    }
    expect(baseline).toBeGreaterThanOrEqual(0);
    expect(baseline).toBeLessThanOrEqual(1);
  });
});

describe('Phase 1B MLB backtest: snapshots', () => {
  it('isolates source mutations from snapshot', () => {
    const fixture = buildMLBFixtures();
    const game = fixture.games[0];
    const homeTeam = fixture.teamProfiles[game.homeTeamId];
    const homePitcher = fixture.pitcherProfiles[2001];

    const warnings: string[] = [];
    const snapshot = buildHistoricalSnapshot(
      game,
      game.cutoff.cutoffTime,
      { home: homePitcher, away: fixture.pitcherProfiles[2002] },
      { home: homeTeam, away: fixture.teamProfiles[game.awayTeamId] },
      { home: [], away: [] },
      new Date(),
      'test',
      warnings,
      100,
    );

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.features)).toBe(true);
    expect(Object.isFrozen(snapshot.warnings)).toBe(true);
    expect(Object.isFrozen(snapshot.recentGames)).toBe(true);
    expect(Object.isFrozen(snapshot.recentGames.home)).toBe(true);
    expect(Object.isFrozen(snapshot.recentGames.away)).toBe(true);
    expect(snapshot.game).not.toBe(game);
    expect(snapshot.cutoff).not.toBe(game.cutoff.cutoffTime);
    expect(snapshot.cutoff.getTime()).toBe(game.cutoff.cutoffTime.getTime());
    expect(snapshot.teamProfiles.home).not.toBe(homeTeam);
    expect(snapshot.pitcherProfiles.home).not.toBe(homePitcher);
  });
});

describe('Phase 1B MLB backtest: no odds imports', () => {
  it('backtesting layer must not import Stage 2 odds or candidate pricing types', async () => {
    const { readdirSync, statSync, readFileSync } = await import('fs');
    const { join } = await import('path');

    const BACKTESTING_DIR = join(process.cwd(), 'src/lib/backtesting');
    const TESTS_DIR = join(process.cwd(), 'tests/backtesting');

    const FORBIDDEN_MODULE_PREFIXES = [
      '../../odds',
      '../odds',
      '@/lib/odds',
      '@/lib/candidate',
      '@/lib/multi-builder',
    ];

    const FORBIDDEN_SYMBOLS = [
      'PricedCandidate',
      'OddsSample',
      'CanonicalBookmaker',
      'CanonicalBookmakerValue',
      'OddsProvider',
      'NormalizedOdds',
      'MarketMatch',
      'MultiBuildOptions',
      'MultiBuildResult',
      'TierConfig',
      'LegResult',
      'MultiStatus',
      'decimalOdds',
      'impliedProbability',
      'expectedValue',
      'ROI',
    ];

    function walk(dir: string, files: string[] = []): string[] {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full, files);
        } else if (full.endsWith('.ts') && !full.endsWith('.d.ts')) {
          files.push(full);
        }
      }
      return files;
    }

    interface ImportRecord {
      symbols: string[];
      source: string;
    }

    function extractImports(content: string): ImportRecord[] {
      const imports: ImportRecord[] = [];
      const regex = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['\"]([^'\"]+)['\"];?/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        imports.push({
          symbols: match[1].split(',').map((s) => s.trim()),
          source: match[2],
        });
      }
      return imports;
    }

    const files = [...walk(BACKTESTING_DIR), ...walk(TESTS_DIR)];
    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const imports = extractImports(content);

      for (const imp of imports) {
        for (const prefix of FORBIDDEN_MODULE_PREFIXES) {
          if (imp.source.startsWith(prefix)) {
            violations.push(`${file} imports from forbidden module ${imp.source}`);
          }
        }
        for (const sym of FORBIDDEN_SYMBOLS) {
          if (imp.symbols.includes(sym)) {
            violations.push(`${file} imports forbidden symbol ${sym}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

describe('Phase 1C MLB backtest: pitcher abstention semantics', () => {
  const makeSnapshot = (overrides: {
    homeAvailable?: boolean;
    awayAvailable?: boolean;
    dataQuality?: number;
    warnings?: string[];
  } = {}): BacktestSnapshot => {
    const fixture = buildMLBFixtures();
    const game = fixture.games[0];
    return {
      game,
      cutoff: game.cutoff.cutoffTime,
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
          homeAvailable: overrides.homeAvailable ?? false,
          awayAvailable: overrides.awayAvailable ?? false,
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
          homeAdvantage: true,
          venueKnown: game.venueId > 0,
          weatherAvailable: false,
        },
        availability: {
          startingPitcher: (overrides.homeAvailable ?? false) && (overrides.awayAvailable ?? false),
          opponentBatting: false,
          bullpen: false,
          offenseLineup: false,
          homePark: true,
          injuriesLineup: false,
          restTravel: false,
          weatherRoof: false,
        },
      },
      warnings: overrides.warnings ?? [],
      dataQuality: overrides.dataQuality ?? 100,
      featureVersion: 'test',
      generatedAt: new Date(),
    };
  };

  it('predicts when both pitchers are available and coverage is sufficient', () => {
    const snapshot: BacktestSnapshot = {
      ...makeSnapshot({ homeAvailable: true, awayAvailable: true }),
      features: {
        ...makeSnapshot({ homeAvailable: true, awayAvailable: true }).features,
        availability: {
          startingPitcher: true,
          opponentBatting: true,
          bullpen: false,
          offenseLineup: true,
          homePark: true,
          injuriesLineup: false,
          restTravel: false,
          weatherRoof: false,
        },
      },
      pitcherProfiles: {
        home: {
          personId: 2001,
          fullName: 'Home',
          teamId: 100101,
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
          recentStarts: [],
          daysSinceLastStart: 7,
          completeness: 1,
          warnings: [],
          provenance: { source: 'test', fetchedAt: new Date(), sourceTimestamp: new Date(), isLive: false, warnings: [] },
          asOf: new Date(),
        },
        away: {
          personId: 2002,
          fullName: 'Away',
          teamId: 100102,
          seasonStats: {
            era: '4.50',
            whip: '1.40',
            strikeoutsPer9Inn: '7.8',
            walksPer9Inn: '3.1',
            hitsPer9Inn: '9.2',
            homeRunsPer9: '1.1',
            inningsPitched: '85.1',
            gamesPlayed: 17,
            gamesStarted: 17,
          },
          recentStarts: [],
          daysSinceLastStart: 8,
          completeness: 1,
          warnings: [],
          provenance: { source: 'test', fetchedAt: new Date(), sourceTimestamp: new Date(), isLive: false, warnings: [] },
          asOf: new Date(),
        },
      },
      teamProfiles: {
        home: {
          teamId: 100101,
          teamName: 'Home',
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
          recentGames: [],
          completeness: 1,
          warnings: [],
          provenance: { source: 'test', fetchedAt: new Date(), sourceTimestamp: new Date(), isLive: false, warnings: [] },
          asOf: new Date(),
        },
        away: {
          teamId: 100102,
          teamName: 'Away',
          seasonStats: {
            gamesPlayed: 50,
            runs: 185,
            hits: 390,
            homeRuns: 28,
            strikeOuts: 420,
            baseOnBalls: 145,
            battingAverage: '.240',
            obp: '.300',
            slg: '.380',
            ops: '.680',
          },
          recentGames: [],
          completeness: 1,
          warnings: [],
          provenance: { source: 'test', fetchedAt: new Date(), sourceTimestamp: new Date(), isLive: false, warnings: [] },
          asOf: new Date(),
        },
      },
    };

    const result = computeExploratoryScore(snapshot);
    expect(result.abstained).toBe(false);
    expect(result.predictedSide).not.toBeNull();
    expect(['HOME', 'AWAY']).toContain(result.predictedSide);
  });

  it('abstains with HOME_PITCHER_UNAVAILABLE and predictedSide null when only home pitcher is unavailable', () => {
    const snapshot = makeSnapshot({ homeAvailable: false, awayAvailable: true, dataQuality: 70 });
    const result = computeExploratoryScore(snapshot);
    expect(result.abstained).toBe(true);
    expect(result.abstentionReason).toBe('HOME_PITCHER_UNAVAILABLE');
    expect(result.predictedSide).toBeNull();
    expect(result.warnings).toContain('Home starting pitcher unavailable');
    expect(result.warnings).not.toContain('Both starting pitchers unavailable');
  });

  it('abstains with AWAY_PITCHER_UNAVAILABLE and predictedSide null when only away pitcher is unavailable', () => {
    const snapshot = makeSnapshot({ homeAvailable: true, awayAvailable: false, dataQuality: 70 });
    const result = computeExploratoryScore(snapshot);
    expect(result.abstained).toBe(true);
    expect(result.abstentionReason).toBe('AWAY_PITCHER_UNAVAILABLE');
    expect(result.predictedSide).toBeNull();
    expect(result.warnings).toContain('Away starting pitcher unavailable');
    expect(result.warnings).not.toContain('Both starting pitchers unavailable');
  });

  it('abstains with BOTH_PITCHERS_UNAVAILABLE and predictedSide null when both pitchers are unavailable', () => {
    const snapshot = makeSnapshot({ homeAvailable: false, awayAvailable: false, dataQuality: 50 });
    const result = computeExploratoryScore(snapshot);
    expect(result.abstained).toBe(true);
    expect(result.abstentionReason).toBe('BOTH_PITCHERS_UNAVAILABLE');
    expect(result.predictedSide).toBeNull();
    expect(result.warnings).toContain('Both starting pitchers unavailable');
  });

  it('preserves unrelated warnings and deduplicates pitcher warnings', () => {
    const snapshot = makeSnapshot({
      homeAvailable: false,
      awayAvailable: false,
      dataQuality: 50,
      warnings: ['Missing away team profile', 'Missing home team profile'],
    });
    const result = computeExploratoryScore(snapshot);
    expect(result.warnings).toContain('Missing away team profile');
    expect(result.warnings).toContain('Missing home team profile');
    expect(result.warnings).toContain('Both starting pitchers unavailable');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'Missing away team profile',
        'Missing home team profile',
        'Both starting pitchers unavailable',
      ]),
    );
  });

  it('removes duplicate warnings while preserving first-occurrence order', () => {
    const snapshot = makeSnapshot({
      homeAvailable: true,
      awayAvailable: false,
      dataQuality: 70,
      warnings: ['Away starting pitcher unavailable'],
    });
    const result = computeExploratoryScore(snapshot);
    expect(result.warnings).toEqual(['Away starting pitcher unavailable']);
  });

  it('preserves order when duplicate warning would be appended', () => {
    const snapshot = makeSnapshot({
      homeAvailable: true,
      awayAvailable: false,
      dataQuality: 70,
      warnings: ['Missing away team profile', 'Away starting pitcher unavailable'],
    });
    const result = computeExploratoryScore(snapshot);
    expect(result.warnings).toEqual([
      'Missing away team profile',
      'Away starting pitcher unavailable',
    ]);
  });

  it('retains distinct warnings without mutation', () => {
    const warnings = ['Missing away team profile', 'Away starting pitcher unavailable'];
    const snapshot = makeSnapshot({
      homeAvailable: true,
      awayAvailable: false,
      dataQuality: 70,
      warnings,
    });
    const result = computeExploratoryScore(snapshot);
    expect(result.warnings).toEqual(warnings);
    expect(warnings).toEqual(['Missing away team profile', 'Away starting pitcher unavailable']);
  });

  it('regresses fixture gamePk 1002 to non-contradictory abstention semantics', async () => {
    const fixture = buildMLBFixtures();
    const game = fixture.games.find((g) => g.gamePk === 1002);
    expect(game).toBeDefined();
    if (!game) return;

    const result = await runHistoricalBacktest([game], {
      provider: {
        fetchGamesForDate: async () => [],
        fetchGameOutcome: async () => ({ gamePk: game.gamePk, homeScore: 2, awayScore: 4, winner: 'AWAY', innings: 9, status: 'FINAL', linescore: null }),
        fetchPitcherStatsAsOf: async (personId: number) => fixture.pitcherProfiles[personId] ?? null,
        fetchTeamStatsAsOf: async (teamId: number) => fixture.teamProfiles[teamId] ?? null,
        fetchRecentGamesBefore: async () => [],
      },
      deterministicTime: new Date('2024-07-01T00:00:00Z'),
      featureVersion: 'fixture-regression',
      modelVersion: 'fixture-regression',
      naiveBaselineContext: {
        recentWinRates: fixture.recentWinRates,
        seasonWinRates: fixture.seasonWinRates,
      },
    });

    const prediction = result.predictions.find((p) => p.gamePk === 1002);
    const abstention = result.abstentions.find((p) => p.gamePk === 1002);
    expect(prediction).toBeUndefined();
    expect(abstention).toBeDefined();
    if (!abstention) return;

    expect(abstention.abstained).toBe(true);
    expect(abstention.homePitcherAvailable).toBe(true);
    expect(abstention.awayPitcherAvailable).toBe(false);
    expect(abstention.predictedSide).toBeNull();
    expect(abstention.abstentionReason).not.toBe('BOTH_PITCHERS_UNAVAILABLE');
    expect(abstention.warnings).not.toContain('Both starting pitchers unavailable');
    expect(abstention.warnings).toContain('Missing away team profile');
  });
});
