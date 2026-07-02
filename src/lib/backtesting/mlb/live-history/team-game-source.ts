import type {
  CanonicalHistoricalGameStatus,
  CanonicalHistoricalScheduleGame,
  CanonicalHistoricalOutcome,
  CompletedHistoricalTeamGame,
  HistoricalCompletionTimeSource,
} from './types';
import type { HistoricalTeamGameSource } from './provider';
import { aggregateTeamHistory } from './team-aggregator';
import { isOfficialDateAfterCutoff } from './historical-date';

export interface TeamGameSourceOptions {
  readonly scheduleLoader: {
    readonly loadForDateRange: (start: string, end: string) => Promise<CanonicalHistoricalScheduleGame[]>;
  };
  readonly outcomeLoader: {
    readonly loadOutcome: (gamePk: number) => Promise<CanonicalHistoricalOutcome>;
  };
}

export class TeamGameSourceError extends Error {
  readonly operation: string;
  readonly context: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(params: {
    readonly operation: string;
    readonly context: Record<string, unknown>;
    readonly cause?: unknown;
    readonly message?: string;
  }) {
    super(params.message ?? `Team game source failed: ${params.operation}`);
    this.operation = params.operation;
    this.context = params.context;
    this.cause = params.cause;
  }
}

export function createMLBHistoricalTeamGameSource(
  options: TeamGameSourceOptions,
): HistoricalTeamGameSource {
  const { scheduleLoader, outcomeLoader } = options;

  return {
    async getTeamGames(
      teamId: number,
      season: number,
      cutoff: Date,
    ): Promise<readonly CompletedHistoricalTeamGame[]> {
      validateTeamId(teamId);
      validateSeason(season);

      const from = `${season}-01-01`;
      const to = `${season}-12-31`;

      let scheduleGames: CanonicalHistoricalScheduleGame[];
      try {
        scheduleGames = await scheduleLoader.loadForDateRange(from, to);
      } catch (error) {
        throw new TeamGameSourceError({
          operation: 'getTeamGames',
          context: { teamId, season },
          cause: error,
        });
      }

      const relevant = scheduleGames.filter(
        (game) => game.homeTeamId === teamId || game.awayTeamId === teamId,
      );

      const allowedStatuses = new Set<CanonicalHistoricalGameStatus>(['FINAL', 'CANCELLED', 'POSTPONED', 'SUSPENDED']);
      const eligible = relevant.filter((game) => allowedStatuses.has(game.status));

      const deduped = new Map<number, CanonicalHistoricalScheduleGame>();
      for (const game of eligible) {
        deduped.set(game.gamePk, game);
      }

      const normalized: CompletedHistoricalTeamGame[] = [];
      for (const game of deduped.values()) {
        if (isOfficialDateAfterCutoff(game.officialDate, cutoff)) {
          continue;
        }

        const isHome = game.homeTeamId === teamId;
        const opponentTeamId = isHome ? game.awayTeamId : game.homeTeamId;
        let runsScored: number | null = null;
        let runsAllowed: number | null = null;
        let innings: number | null = null;
        let completedAt: Date | null = null;
        let completedAtSource: HistoricalCompletionTimeSource | null = null;

        if (game.status === 'FINAL') {
          let outcome: CanonicalHistoricalOutcome;
          try {
            outcome = await outcomeLoader.loadOutcome(game.gamePk);
          } catch (error) {
            throw new TeamGameSourceError({
              operation: 'getTeamGames',
              context: { teamId, season, gamePk: game.gamePk },
              cause: error,
            });
          }

          innings = outcome.innings;
          completedAt = outcome.completedAt;
          completedAtSource = outcome.completedAtSource;
          const homeScore = outcome.homeScore;
          const awayScore = outcome.awayScore;

          if (homeScore !== null && awayScore !== null) {
            if (isHome) {
              runsScored = homeScore;
              runsAllowed = awayScore;
            } else {
              runsScored = awayScore;
              runsAllowed = homeScore;
            }
          }
        }

        normalized.push({
          gamePk: game.gamePk,
          gameStart: game.scheduledStart,
          completedAt,
          completedAtSource,
          status: game.status as CompletedHistoricalTeamGame['status'],
          teamId,
          opponentTeamId,
          isHome,
          runsScored,
          runsAllowed,
          innings,
        });
      }

      normalized.sort((a, b) => {
        const startDiff = a.gameStart.getTime() - b.gameStart.getTime();
        if (startDiff !== 0) return startDiff;
        return a.gamePk - b.gamePk;
      });

      return normalized;
    },
  };
}

function validateTeamId(teamId: number): void {
  if (!Number.isFinite(teamId) || !Number.isInteger(teamId) || teamId <= 0) {
    throw new TeamGameSourceError({
      operation: 'validateTeamId',
      context: { teamId },
      message: `Invalid teamId: ${teamId}`,
    });
  }
}

function validateSeason(season: number): void {
  if (!Number.isFinite(season) || !Number.isInteger(season) || season < 1 || season > 9999) {
    throw new TeamGameSourceError({
      operation: 'validateSeason',
      context: { season },
      message: `Invalid season: ${season}`,
    });
  }
}
