import type { CompletedHistoricalTeamGame, TeamHistoricalAggregate } from './types';

type EligibleTeamGame = Omit<CompletedHistoricalTeamGame, 'completedAt' | 'runsScored' | 'runsAllowed'> & {
  readonly completedAt: Date;
  readonly runsScored: number;
  readonly runsAllowed: number;
};

export function aggregateTeamHistory(
  games: readonly CompletedHistoricalTeamGame[],
  teamId: number,
  cutoff: Date,
): TeamHistoricalAggregate {
  const eligible: EligibleTeamGame[] = [];
  const warnings: string[] = [];

  for (const game of games) {
    if (game.teamId !== teamId) continue;
    if (game.status !== 'FINAL') continue;
    if (!game.completedAt) {
      warnings.push(`missing_completed_at_${game.gamePk}`);
      continue;
    }
    if (game.completedAt >= cutoff) continue;
    if (game.runsScored === null || game.runsAllowed === null) {
      warnings.push(`missing_scores_${game.gamePk}`);
      continue;
    }
    if (game.runsScored === game.runsAllowed) {
      warnings.push(`tied_score_excluded_${game.gamePk}`);
      continue;
    }
    eligible.push(game as EligibleTeamGame);
  }

  const sorted = [...eligible].sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());
  const gamesPlayed = sorted.length;
  const wins = sorted.filter((game) => game.runsScored > game.runsAllowed).length;
  const losses = gamesPlayed - wins;
  const runsScored = sorted.reduce((sum, game) => sum + game.runsScored, 0);
  const runsAllowed = sorted.reduce((sum, game) => sum + game.runsAllowed, 0);
  const runDifferential = runsScored - runsAllowed;
  const homeWins = sorted.filter((game) => game.isHome && game.runsScored > game.runsAllowed).length;
  const homeLosses = sorted.filter((game) => game.isHome && game.runsScored < game.runsAllowed).length;
  const awayWins = sorted.filter((game) => !game.isHome && game.runsScored > game.runsAllowed).length;
  const awayLosses = sorted.filter((game) => !game.isHome && game.runsScored < game.runsAllowed).length;

  const recent5 = sorted.slice(-5);
  const recent10 = sorted.slice(-10);
  const recent5Wins = recent5.filter((game) => game.runsScored > game.runsAllowed).length;
  const recent5Losses = recent5.length - recent5Wins;
  const recent10Wins = recent10.filter((game) => game.runsScored > game.runsAllowed).length;
  const recent10Losses = recent10.length - recent10Wins;
  const recent10RunsPerGame = recent10.length > 0 ? recent10.reduce((sum, game) => sum + game.runsScored, 0) / recent10.length : null;

  let restDays: number | null = null;
  if (sorted.length > 0) {
    const latest = sorted[sorted.length - 1];
    restDays = Math.floor((cutoff.getTime() - latest.completedAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  const previousThreeDaysMs = 3 * 24 * 60 * 60 * 1000;
  const gamesInPrevious3Days = sorted.filter((game) => {
    const elapsedMs = cutoff.getTime() - game.completedAt.getTime();
    return elapsedMs >= 0 && elapsedMs < previousThreeDaysMs;
  }).length;

  const extraInningGames = sorted.filter((game) => game.innings !== null && game.innings > 9).length;

  return {
    teamId,
    gamesPlayed,
    wins,
    losses,
    winRate: gamesPlayed > 0 ? wins / gamesPlayed : null,
    runsScored,
    runsAllowed,
    runDifferential,
    runsScoredPerGame: gamesPlayed > 0 ? runsScored / gamesPlayed : null,
    runsAllowedPerGame: gamesPlayed > 0 ? runsAllowed / gamesPlayed : null,
    recent5Wins,
    recent5Losses,
    recent10Wins,
    recent10Losses,
    recent10RunsPerGame,
    homeWins,
    homeLosses,
    awayWins,
    awayLosses,
    restDays,
    gamesInPrevious3Days,
    extraInningGames,
    sampleSize: gamesPlayed,
    warnings,
  };
}
