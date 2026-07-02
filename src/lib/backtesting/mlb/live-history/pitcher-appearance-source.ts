import type {
  CanonicalHistoricalScheduleGame,
  CanonicalHistoricalPitcherFeed,
  HistoricalPitcherAppearance,
  HistoricalCompletionTimeSource,
} from './types';
import type { HistoricalPitcherAppearanceSource } from './provider';
import { isOfficialDateAfterCutoff } from './historical-date';
import { mapWithConcurrency } from './concurrency';

export interface PitcherAppearanceSourceOptions {
  readonly scheduleLoader: {
    readonly loadForDateRange: (
      start: string,
      end: string,
    ) => Promise<CanonicalHistoricalScheduleGame[]>;
  };

  readonly gameFeedLoader: {
    readonly loadGameFeed: (
      gamePk: number,
    ) => Promise<CanonicalHistoricalPitcherFeed>;
  };
}

export class PitcherAppearanceSourceError extends Error {
  readonly operation: string;
  readonly context: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(params: {
    readonly operation: string;
    readonly context: Record<string, unknown>;
    readonly cause?: unknown;
    readonly message?: string;
  }) {
    super(params.message ?? `Pitcher appearance source failed: ${params.operation}`);
    this.operation = params.operation;
    this.context = params.context;
    this.cause = params.cause;
  }
}

export function createMLBHistoricalPitcherAppearanceSource(
  options: PitcherAppearanceSourceOptions,
): HistoricalPitcherAppearanceSource {
  const { scheduleLoader, gameFeedLoader } = options;

  return {
    async getPitcherAppearances(
      personId: number,
      season: number,
      cutoff: Date,
    ): Promise<readonly HistoricalPitcherAppearance[]> {
      validatePersonId(personId);
      validateSeason(season);

      const from = `${season}-01-01`;
      const to = `${season}-12-31`;

      let scheduleGames: CanonicalHistoricalScheduleGame[];
      try {
        scheduleGames = await scheduleLoader.loadForDateRange(from, to);
      } catch (error) {
        throw new PitcherAppearanceSourceError({
          operation: 'loadSchedule',
          context: { pitcherId: personId, season },
          cause: error,
        });
      }

      const finalGames = scheduleGames.filter((game) => game.status === 'FINAL');
      const deduped = new Map<number, CanonicalHistoricalScheduleGame>();
      for (const game of finalGames) {
        deduped.set(game.gamePk, game);
      }

      const scheduled: Array<{ readonly game: CanonicalHistoricalScheduleGame }> = [];
      for (const scheduleGame of deduped.values()) {
        if (isOfficialDateAfterCutoff(scheduleGame.officialDate, cutoff)) continue;
        scheduled.push({ game: scheduleGame });
      }

      const feedResults = await mapWithConcurrency(
        scheduled.map((_, idx) => idx),
        6,
        async (idx) => {
          const { game } = scheduled[idx];
          let feed: CanonicalHistoricalPitcherFeed;
          try {
            feed = await gameFeedLoader.loadGameFeed(game.gamePk);
          } catch (error) {
            throw new PitcherAppearanceSourceError({
              operation: 'loadGameFeed',
              context: { pitcherId: personId, season, gamePk: game.gamePk },
              cause: error,
            });
          }
          return feed;
        },
      );

      const appearances: HistoricalPitcherAppearance[] = [];
      for (let i = 0; i < scheduled.length; i++) {
        const scheduleGame = scheduled[i].game;
        const feed = feedResults[i];

        const player =
          feed.homePlayers.find((p) => p.personId === personId) ??
          feed.awayPlayers.find((p) => p.personId === personId);

        if (!player) continue;

        const homeMatch = feed.homePlayers.find((p) => p.personId === personId);
        const teamId = homeMatch !== undefined
          ? scheduleGame.homeTeamId
          : scheduleGame.awayTeamId;

        const pitching = player.pitchingStats;
        const gamesStarted = player.gamesStarted;
        if (gamesStarted !== 0 && gamesStarted !== 1) continue;

        if (
          pitching.earnedRuns === null
          || pitching.strikeouts === null
          || pitching.walks === null
          || pitching.hits === null
          || pitching.homeRuns === null
        ) {
          continue;
        }

        let inningsPitched: string;
        if (typeof pitching.outs === 'number') {
          inningsPitched = outsToInningsString(pitching.outs);
        } else {
          inningsPitched = '0.0';
        }

        appearances.push({
          gamePk: scheduleGame.gamePk,
          gameStart: scheduleGame.scheduledStart,
          completedAt: feed.completedAt,
          completedAtSource: feed.completedAtSource,
          status: scheduleGame.status as HistoricalPitcherAppearance['status'],
          personId,
          teamId,
          started: gamesStarted === 1,
          inningsPitched,
          earnedRuns: pitching.earnedRuns,
          strikeouts: pitching.strikeouts,
          walks: pitching.walks,
          hitsAllowed: pitching.hits,
          homeRunsAllowed: pitching.homeRuns,
          pitches: pitching.pitchesThrown ?? null,
        });
      }

      appearances.sort((a, b) => {
        const aTime = a.completedAt?.getTime() ?? Infinity;
        const bTime = b.completedAt?.getTime() ?? Infinity;
        if (aTime !== bTime) return aTime - bTime;
        const startDiff = a.gameStart.getTime() - b.gameStart.getTime();
        if (startDiff !== 0) return startDiff;
        return a.gamePk - b.gamePk;
      });

      return appearances;
    },
  };
}

function outsToInningsString(outs: number): string {
  const whole = Math.floor(outs / 3);
  const remainder = outs % 3;
  return remainder === 0 ? `${whole}.0` : `${whole}.${remainder}`;
}

function validatePersonId(personId: number): void {
  if (!Number.isFinite(personId) || !Number.isInteger(personId) || personId <= 0) {
    throw new PitcherAppearanceSourceError({
      operation: 'validatePersonId',
      context: { pitcherId: personId },
      message: `Invalid pitcherId: ${personId}`,
    });
  }
}

function validateSeason(season: number): void {
  if (!Number.isFinite(season) || !Number.isInteger(season) || season < 1 || season > 9999) {
    throw new PitcherAppearanceSourceError({
      operation: 'validateSeason',
      context: { season },
      message: `Invalid season: ${season}`,
    });
  }
}
