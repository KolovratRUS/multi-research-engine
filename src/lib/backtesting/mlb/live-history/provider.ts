import type {
  MLBHistoricalDataProvider,
  HistoricalMLBGame,
  MLBGameOutcome,
  HistoricalPitcherProfile,
  HistoricalTeamProfile,
  HistoricalTeamGame,
  HistoricalCutoff,
} from '../../types';
import type {
  CanonicalHistoricalScheduleGame,
  CanonicalHistoricalOutcome,
  CompletedHistoricalTeamGame,
  HistoricalPitcherAppearance,
  PitcherHistoricalAggregate,
  TeamHistoricalAggregate,
} from './types';
import { aggregateTeamHistory } from './team-aggregator';
import { aggregatePitcherHistory } from './pitcher-aggregator';

type EligibleRecentTeamGame =
  Omit<
    CompletedHistoricalTeamGame,
    'completedAt' | 'runsScored' | 'runsAllowed'
  > & {
    readonly completedAt: Date;
    readonly runsScored: number;
    readonly runsAllowed: number;
  };

function isEligibleRecentTeamGame(
  game: CompletedHistoricalTeamGame,
  teamId: number,
  cutoff: Date,
): game is EligibleRecentTeamGame {
  return (
    game.teamId === teamId &&
    game.status === 'FINAL' &&
    game.completedAt !== null &&
    game.completedAt.getTime() < cutoff.getTime() &&
    game.runsScored !== null &&
    game.runsAllowed !== null &&
    game.runsScored !== game.runsAllowed
  );
}

export interface HistoricalTeamGameSource {
  getTeamGames(
    teamId: number,
    season: number,
  ): Promise<readonly CompletedHistoricalTeamGame[]>;
}

export interface HistoricalPitcherAppearanceSource {
  getPitcherAppearances(
    personId: number,
    season: number,
  ): Promise<readonly HistoricalPitcherAppearance[]>;
}

export interface LiveHistoricalProviderDependencies {
  readonly scheduleLoader: {
    readonly loadForDateRange: (
      start: string,
      end: string,
    ) => Promise<CanonicalHistoricalScheduleGame[]>;
  };
  readonly outcomeLoader: {
    readonly loadOutcome: (gamePk: number) => Promise<CanonicalHistoricalOutcome>;
  };
  readonly teamGameSource: HistoricalTeamGameSource;
  readonly pitcherAppearanceSource: HistoricalPitcherAppearanceSource;
  readonly teamAggregator: typeof aggregateTeamHistory;
  readonly pitcherAggregator: typeof aggregatePitcherHistory;
  readonly now?: () => Date;
}

export interface LiveHistoricalProviderStats {
  readonly scheduleRequests: number;
  readonly outcomeRequests: number;
  readonly teamSourceRequests: number;
  readonly pitcherSourceRequests: number;
  readonly teamAggregations: number;
  readonly pitcherAggregations: number;
}

export class LiveMLBHistoricalProvider implements MLBHistoricalDataProvider {
  private readonly deps: LiveHistoricalProviderDependencies;

  private readonly providerStats: {
    scheduleRequests: number;
    outcomeRequests: number;
    teamSourceRequests: number;
    pitcherSourceRequests: number;
    teamAggregations: number;
    pitcherAggregations: number;
  };

  constructor(deps: LiveHistoricalProviderDependencies) {
    this.deps = deps;
    this.providerStats = {
      scheduleRequests: 0,
      outcomeRequests: 0,
      teamSourceRequests: 0,
      pitcherSourceRequests: 0,
      teamAggregations: 0,
      pitcherAggregations: 0,
    };
  }

  async fetchGamesForDate(date: string): Promise<HistoricalMLBGame[]> {
    this.providerStats.scheduleRequests += 1;
    try {
      const games = await this.deps.scheduleLoader.loadForDateRange(date, date);
      const mapped = games.map((game) => this.mapScheduleGame(game));
      mapped.sort((a, b) => {
        const startDiff = a.gameDate.getTime() - b.gameDate.getTime();
        if (startDiff !== 0) return startDiff;
        return a.gamePk - b.gamePk;
      });
      return mapped;
    } catch (error) {
      throw new LiveHistoricalProviderError({
        operation: 'fetchGamesForDate',
        context: { date },
        cause: error,
      });
    }
  }

  async fetchGameOutcome(gamePk: number): Promise<MLBGameOutcome> {
    this.providerStats.outcomeRequests += 1;
    try {
      const outcome = await this.deps.outcomeLoader.loadOutcome(gamePk);
      return this.mapOutcome(outcome);
    } catch (error) {
      throw new LiveHistoricalProviderError({
        operation: 'fetchGameOutcome',
        context: { gamePk },
        cause: error,
      });
    }
  }

  async fetchPitcherStatsAsOf(
    personId: number,
    cutoff: Date,
  ): Promise<HistoricalPitcherProfile | null> {
    if (!Number.isFinite(personId) || personId <= 0) {
      return null;
    }

    try {
      const season = cutoff.getUTCFullYear();
      this.providerStats.pitcherSourceRequests += 1;
      const appearances =
        await this.deps.pitcherAppearanceSource.getPitcherAppearances(
          personId,
          season,
        );
      this.providerStats.pitcherAggregations += 1;
      const aggregate = this.deps.pitcherAggregator(appearances, personId, cutoff);
      return this.mapPitcherAggregate(aggregate, cutoff);
    } catch (error) {
      throw new LiveHistoricalProviderError({
        operation: 'fetchPitcherStatsAsOf',
        context: { personId, cutoff: cutoff.toISOString() },
        cause: error,
      });
    }
  }

  async fetchTeamStatsAsOf(teamId: number, cutoff: Date): Promise<HistoricalTeamProfile | null> {
    try {
      const season = cutoff.getUTCFullYear();
      this.providerStats.teamSourceRequests += 1;
      const games = await this.deps.teamGameSource.getTeamGames(teamId, season);
      this.providerStats.teamAggregations += 1;
      const aggregate = this.deps.teamAggregator(games, teamId, cutoff);
      return this.mapTeamAggregate(aggregate, cutoff);
    } catch (error) {
      throw new LiveHistoricalProviderError({
        operation: 'fetchTeamStatsAsOf',
        context: { teamId, cutoff: cutoff.toISOString() },
        cause: error,
      });
    }
  }

  async fetchRecentGamesBefore(
    teamId: number,
    cutoff: Date,
    limit: number,
  ): Promise<HistoricalTeamGame[]> {
    try {
      const season = cutoff.getUTCFullYear();
      const games = await this.deps.teamGameSource.getTeamGames(teamId, season);
      this.providerStats.teamSourceRequests += 1;

      const eligible = games.filter((game) =>
        isEligibleRecentTeamGame(game, teamId, cutoff),
      );

      const sorted = [...eligible]
        .sort((a, b) => {
          const aTime = a.completedAt.getTime();
          const bTime = b.completedAt.getTime();
          if (aTime !== bTime) return bTime - aTime;
          return b.gamePk - a.gamePk;
        });

      const limited = sorted.slice(0, limit);
      return limited.map((game) => ({
        gamePk: game.gamePk,
        gameDate: game.gameStart,
        opponent: '',
        opponentTeamId: game.opponentTeamId,
        homeAway: game.isHome ? 'HOME' : 'AWAY',
        runsScored: game.runsScored,
        runsAllowed: game.runsAllowed,
        win: game.runsScored > game.runsAllowed,
      }));
    } catch (error) {
      throw new LiveHistoricalProviderError({
        operation: 'fetchRecentGamesBefore',
        context: { teamId, cutoff: cutoff.toISOString(), limit },
        cause: error,
      });
    }
  }

  stats(): LiveHistoricalProviderStats {
    return { ...this.providerStats };
  }

  clearStats(): void {
    this.providerStats.scheduleRequests = 0;
    this.providerStats.outcomeRequests = 0;
    this.providerStats.teamSourceRequests = 0;
    this.providerStats.pitcherSourceRequests = 0;
    this.providerStats.teamAggregations = 0;
    this.providerStats.pitcherAggregations = 0;
  }

  private mapScheduleGame(game: CanonicalHistoricalScheduleGame): HistoricalMLBGame {
    const probablePitchers = this.mapProbablePitchers(game);
    const status = game.status;

    return {
      gamePk: game.gamePk,
      officialDate: game.officialDate,
      gameDate: game.scheduledStart,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      homeTeamName: game.homeTeamName,
      awayTeamName: game.awayTeamName,
      venueId: game.venueId ?? 0,
      status,
      probablePitchers,
      cutoff: {
        eventId: String(game.gamePk),
        cutoffTime: game.cutoffTime,
      },
    };
  }

  private mapProbablePitchers(
    game: CanonicalHistoricalScheduleGame,
  ): HistoricalMLBGame['probablePitchers'] {
    const home =
      game.homeProbablePitcherId !== null &&
      game.homeStarterSource === 'SCHEDULE_PROBABLE_BEFORE_CUTOFF'
        ? {
            availability: 'AVAILABLE' as const,
            personId: game.homeProbablePitcherId,
            teamId: game.homeTeamId,
            status: 'PROBABLE' as const,
            fetchedAt: game.provenance.fetchedAt,
            warnings: [...game.warnings],
          }
        : null;

    const away =
      game.awayProbablePitcherId !== null &&
      game.awayStarterSource === 'SCHEDULE_PROBABLE_BEFORE_CUTOFF'
        ? {
            availability: 'AVAILABLE' as const,
            personId: game.awayProbablePitcherId,
            teamId: game.awayTeamId,
            status: 'PROBABLE' as const,
            fetchedAt: game.provenance.fetchedAt,
            warnings: [...game.warnings],
          }
        : null;

    if (home === null && away === null) {
      return null;
    }

    return { home, away };
  }

  private mapOutcome(outcome: CanonicalHistoricalOutcome): MLBGameOutcome {
    return {
      gamePk: outcome.gamePk,
      homeScore: outcome.homeScore,
      awayScore: outcome.awayScore,
      winner: outcome.winner,
      innings: outcome.innings,
      status: outcome.status,
      linescore: null,
    };
  }

  private mapTeamAggregate(
    aggregate: ReturnType<typeof aggregateTeamHistory>,
    cutoff: Date,
  ): HistoricalTeamProfile {
    const seasonStats = aggregate.gamesPlayed > 0
      ? {
          gamesPlayed: aggregate.gamesPlayed,
          runs: aggregate.runsScored,
          hits: 0,
          homeRuns: 0,
          strikeOuts: 0,
          baseOnBalls: 0,
          battingAverage: '',
          obp: '',
          slg: '',
          ops: '',
        }
      : null;

    const now = this.deps.now ?? (() => new Date());

    return {
      teamId: aggregate.teamId,
      teamName: null,
      seasonStats,
      recentGames: [],
      completeness: aggregate.sampleSize > 0 ? 1 : 0,
      warnings: [...aggregate.warnings],
      provenance: {
        source: 'live-history-team-aggregator',
        fetchedAt: now(),
        sourceTimestamp: cutoff,
        isLive: false,
        warnings: [...aggregate.warnings],
      },
      asOf: cutoff,
    };
  }

  private mapPitcherAggregate(
    aggregate: ReturnType<typeof aggregatePitcherHistory>,
    cutoff: Date,
  ): HistoricalPitcherProfile {
    const seasonStats = aggregate.appearances > 0
      ? {
          era: aggregate.era != null ? String(aggregate.era) : '',
          whip: aggregate.whip != null ? String(aggregate.whip) : '',
          strikeoutsPer9Inn: aggregate.kPer9 != null ? String(aggregate.kPer9) : '',
          walksPer9Inn: aggregate.bbPer9 != null ? String(aggregate.bbPer9) : '',
          hitsPer9Inn: aggregate.hPer9 != null ? String(aggregate.hPer9) : '',
          homeRunsPer9: aggregate.hrPer9 != null ? String(aggregate.hrPer9) : '',
          inningsPitched: aggregate.inningsPitchedDisplay,
          gamesPlayed: aggregate.appearances,
          gamesStarted: aggregate.gamesStarted,
        }
      : null;

    const recentStarts = aggregate.recent5Starts.map((start) => ({
      date: start.gameStart.toISOString(),
      opponent: '',
      opponentTeamId: 0,
      inningsPitched: start.inningsPitched,
      earnedRuns: start.earnedRuns,
      strikeOuts: start.strikeouts,
      baseOnBalls: start.walks,
      pitches: start.pitches ?? undefined,
      homeRunsAllowed: start.homeRunsAllowed,
      hits: start.hitsAllowed,
      gamePk: start.gamePk,
    }));

    const now = this.deps.now ?? (() => new Date());

    return {
      personId: aggregate.personId,
      fullName: null,
      teamId: aggregate.teamId,
      seasonStats,
      recentStarts,
      daysSinceLastStart: aggregate.daysRest,
      completeness: aggregate.sampleSize > 0 ? 1 : 0,
      warnings: [...aggregate.warnings],
      provenance: {
        source: 'live-history-pitcher-aggregator',
        fetchedAt: now(),
        sourceTimestamp: cutoff,
        isLive: false,
        warnings: [...aggregate.warnings],
      },
      asOf: cutoff,
    };
  }
}

export class LiveHistoricalProviderError extends Error {
  readonly operation: string;
  readonly context: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(params: {
    readonly operation: string;
    readonly context: Record<string, unknown>;
    readonly cause?: unknown;
    readonly message?: string;
  }) {
    super(params.message ?? `LiveMLBHistoricalProvider failed: ${params.operation}`);
    this.operation = params.operation;
    this.context = params.context;
    this.cause = params.cause;
  }
}
