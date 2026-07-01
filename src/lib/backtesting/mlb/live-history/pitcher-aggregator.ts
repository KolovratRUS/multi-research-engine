import type { HistoricalPitcherAppearance, PitcherHistoricalAggregate } from './types';

type EligibleAppearance = HistoricalPitcherAppearance & {
  readonly completedAt: Date;
};

export function parseBaseballInnings(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Empty innings value');
  }
  const parts = trimmed.split('.');
  if (parts.length > 2) {
    throw new Error(`Malformed innings: ${value}`);
  }
  const whole = Number.parseInt(parts[0] ?? '', 10);
  if (Number.isNaN(whole) || whole < 0) {
    throw new Error(`Malformed innings: ${value}`);
  }
  if (parts.length === 1) {
    return whole * 3;
  }
  const decimal = Number.parseInt(parts[1] ?? '', 10);
  if (Number.isNaN(decimal) || decimal < 0 || decimal > 2) {
    throw new Error(`Malformed innings: ${value}`);
  }
  return whole * 3 + decimal;
}

export function formatOutsAsInnings(outs: number): string {
  const whole = Math.floor(outs / 3);
  const remainder = outs % 3;
  return remainder === 0 ? `${whole}.0` : `${whole}.${remainder}`;
}

export function aggregatePitcherHistory(
  appearances: readonly HistoricalPitcherAppearance[],
  personId: number,
  cutoff: Date,
): PitcherHistoricalAggregate {
  const eligible: EligibleAppearance[] = [];
  const warnings: string[] = [];

  for (const appearance of appearances) {
    if (appearance.personId !== personId) continue;
    if (appearance.status !== 'FINAL') continue;
    if (!appearance.completedAt || appearance.completedAt >= cutoff) continue;
    if (!appearance.inningsPitched) {
      warnings.push(`missing_innings_${appearance.gamePk}`);
      continue;
    }
    try {
      parseBaseballInnings(appearance.inningsPitched);
      eligible.push(appearance as EligibleAppearance);
    } catch {
      warnings.push(`invalid_innings_${appearance.gamePk}`);
    }
  }

  const sorted = [...eligible].sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());
  const gamesStarted = sorted.filter((game) => game.started).length;
  const outsRecorded = sorted.reduce((sum, game) => sum + parseBaseballInnings(game.inningsPitched), 0);
  const inningsPitchedDisplay = formatOutsAsInnings(outsRecorded);
  const earnedRuns = sorted.reduce((sum, game) => sum + game.earnedRuns, 0);
  const hitsAllowed = sorted.reduce((sum, game) => sum + game.hitsAllowed, 0);
  const walks = sorted.reduce((sum, game) => sum + game.walks, 0);
  const strikeouts = sorted.reduce((sum, game) => sum + game.strikeouts, 0);
  const homeRunsAllowed = sorted.reduce((sum, game) => sum + game.homeRunsAllowed, 0);

  const inningsPitched = outsRecorded / 3;
  const era = outsRecorded > 0 ? (earnedRuns / inningsPitched) * 9 : null;
  const whip = outsRecorded > 0 ? (walks + hitsAllowed) / inningsPitched : null;
  const kPer9 = outsRecorded > 0 ? (strikeouts / inningsPitched) * 9 : null;
  const bbPer9 = outsRecorded > 0 ? (walks / inningsPitched) * 9 : null;
  const hPer9 = outsRecorded > 0 ? (hitsAllowed / inningsPitched) * 9 : null;
  const hrPer9 = outsRecorded > 0 ? (homeRunsAllowed / inningsPitched) * 9 : null;

  const starts = sorted.filter((game) => game.started);
  const recent3Starts = starts.slice(-3);
  const recent5Starts = starts.slice(-5);

  let previousStartDate: Date | null = null;
  let daysRest: number | null = null;
  if (starts.length > 0) {
    const previousStart = starts[starts.length - 1];
    previousStartDate = previousStart.gameStart;
    daysRest = Math.floor((cutoff.getTime() - previousStart.gameStart.getTime()) / (1000 * 60 * 60 * 24));
  }

  let teamId: number | null = null;
  const mostRecent = sorted.at(-1);
  if (mostRecent) {
    teamId = mostRecent.teamId;
  }

  return {
    personId,
    teamId,
    appearances: sorted.length,
    gamesStarted,
    outsRecorded,
    inningsPitchedDisplay,
    earnedRuns,
    hitsAllowed,
    walks,
    strikeouts,
    homeRunsAllowed,
    era,
    whip,
    kPer9,
    bbPer9,
    hPer9,
    hrPer9,
    previousStartDate,
    daysRest,
    recent3Starts,
    recent5Starts,
    sampleSize: eligible.length,
    warnings,
  };
}
