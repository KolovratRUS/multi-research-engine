import type { BacktestSnapshot, HistoricalMLBGame, HistoricalPitcherProfile, HistoricalTeamProfile, HistoricalTeamGame } from '../types';
import { extractMLBPregameFeatures } from './feature-extractor';
import { deepFreeze, deepClone } from '../deep-freeze';

export function buildHistoricalSnapshot(
  game: HistoricalMLBGame,
  cutoff: Date,
  pitcherProfiles: { home: HistoricalPitcherProfile | null; away: HistoricalPitcherProfile | null },
  teamProfiles: { home: HistoricalTeamProfile | null; away: HistoricalTeamProfile | null },
  recentGames: { home: readonly HistoricalTeamGame[]; away: readonly HistoricalTeamGame[] },
  deterministicTime: Date,
  featureVersion: string,
  warnings: string[],
  dataQuality: number,
): BacktestSnapshot {
  const snapshot: BacktestSnapshot = {
    game: deepClone(game) as HistoricalMLBGame,
    cutoff: new Date(cutoff.getTime()),
    pitcherProfiles: {
      home: deepClone(pitcherProfiles.home) as HistoricalPitcherProfile | null,
      away: deepClone(pitcherProfiles.away) as HistoricalPitcherProfile | null,
    },
    teamProfiles: {
      home: deepClone(teamProfiles.home) as HistoricalTeamProfile | null,
      away: deepClone(teamProfiles.away) as HistoricalTeamProfile | null,
    },
    recentGames: {
      home: deepClone(recentGames.home) as readonly HistoricalTeamGame[],
      away: deepClone(recentGames.away) as readonly HistoricalTeamGame[],
    },
    features: extractMLBPregameFeatures(
      game,
      pitcherProfiles.home,
      pitcherProfiles.away,
      teamProfiles.home,
      teamProfiles.away,
    ),
    warnings: [...warnings],
    dataQuality,
    featureVersion,
    generatedAt: new Date(deterministicTime.getTime()),
  };
  return deepFreeze(snapshot);
}