import type { HistoricalMLBGame, HistoricalPitcherProfile, HistoricalTeamProfile, MLBPregameFeatures } from '../types';

export function extractMLBPregameFeatures(
  game: HistoricalMLBGame,
  homePitcher: HistoricalPitcherProfile | null,
  awayPitcher: HistoricalPitcherProfile | null,
  homeTeam: HistoricalTeamProfile | null,
  awayTeam: HistoricalTeamProfile | null,
): MLBPregameFeatures {
  const safeNum = (value?: string | number | null): number | null => {
    if (value == null) return null;
    const parsed = typeof value === 'string' ? Number.parseFloat(value) : value;
    return Number.isFinite(parsed) ? parsed : null;
  };

  const pitcherFeature = (
    profile: HistoricalPitcherProfile | null,
    scheduleAvailable: boolean,
  ): {
    era: number | null;
    whip: number | null;
    kPer9: number | null;
    daysSinceLastStart: number | null;
    available: boolean;
  } => {
    if (!scheduleAvailable) {
      return { era: null, whip: null, kPer9: null, daysSinceLastStart: null, available: false };
    }
    if (!profile || !profile.seasonStats) {
      return { era: null, whip: null, kPer9: null, daysSinceLastStart: null, available: true };
    }
    const seasonStats = profile.seasonStats;
    return {
      era: safeNum(seasonStats.era),
      whip: safeNum(seasonStats.whip),
      kPer9: safeNum(seasonStats.strikeoutsPer9Inn),
      daysSinceLastStart: profile.daysSinceLastStart,
      available: true,
    };
  };

  const homeAssignment = game.probablePitchers?.home;
  const awayAssignment = game.probablePitchers?.away;
  const homePitcherFeatures = pitcherFeature(homePitcher, homeAssignment?.availability === 'AVAILABLE');
  const awayPitcherFeatures = pitcherFeature(awayPitcher, awayAssignment?.availability === 'AVAILABLE');

  const offenseFeature = (profile: HistoricalTeamProfile | null) => {
    if (!profile || !profile.seasonStats) {
      return { runsPerGame: null, ops: null, recentWinRate: null, seasonWinRate: null };
    }
    const seasonStats = profile.seasonStats;
    const runs = safeNum(seasonStats.runs);
    const runsPerGame = seasonStats.gamesPlayed > 0 && runs !== null ? runs / seasonStats.gamesPlayed : null;
    const recentWinRate = profile.recentGames.length > 0
      ? profile.recentGames.filter((g) => g.win === true).length / profile.recentGames.length
      : null;
    return { runsPerGame, ops: safeNum(seasonStats.ops), recentWinRate, seasonWinRate: null };
  };

  const homeOffense = offenseFeature(homeTeam);
  const awayOffense = offenseFeature(awayTeam);

  return {
    startingPitcher: {
      homeEra: homePitcherFeatures.era,
      awayEra: awayPitcherFeatures.era,
      homeWhip: homePitcherFeatures.whip,
      awayWhip: awayPitcherFeatures.whip,
      homeKPer9: homePitcherFeatures.kPer9,
      awayKPer9: awayPitcherFeatures.kPer9,
      homeDaysRest: homePitcherFeatures.daysSinceLastStart,
      awayDaysRest: awayPitcherFeatures.daysSinceLastStart,
      homeAvailable: homePitcherFeatures.available,
      awayAvailable: awayPitcherFeatures.available,
    },
    offense: {
      homeRunsPerGame: homeOffense.runsPerGame,
      awayRunsPerGame: awayOffense.runsPerGame,
      homeOps: homeOffense.ops,
      awayOps: awayOffense.ops,
      homeRecentWinRate: homeOffense.recentWinRate,
      awayRecentWinRate: awayOffense.recentWinRate,
      homeSeasonWinRate: homeOffense.seasonWinRate,
      awaySeasonWinRate: awayOffense.seasonWinRate,
    },
    context: {
      homeAdvantage: true,
      venueKnown: game.venueId > 0,
      weatherAvailable: false,
    },
    availability: {
      startingPitcher: homePitcherFeatures.available && awayPitcherFeatures.available,
      opponentBatting: homeOffense.ops !== null && awayOffense.ops !== null,
      bullpen: false,
      offenseLineup: homeTeam != null && awayTeam != null,
      homePark: true,
      injuriesLineup: false,
      restTravel: false,
      weatherRoof: false,
    },
  };
}
