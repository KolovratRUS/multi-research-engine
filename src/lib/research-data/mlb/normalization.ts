import type {
  DataProvenance,
  MLBVenue,
  MLBScheduleGame,
  MLBScheduleResult,
  PitcherAssignment,
  PitcherAssignmentStatus,
  PitcherResearchProfile,
  PitcherSeasonStatsResult,
  PitcherRecentFormResult,
  TeamBattingProfile,
  TeamBattingStatsResult,
  TeamPitchingStatsResult,
  BullpenProfile,
  RoofType,
  PitcherRecentStart,
} from '../types';
import { DEFAULT_FRESHNESS_CONFIG } from '../types';
import { ResearchDataError } from '../errors';
import type { MLBResearchDataProvider } from '../types';

export const STADIUM_REGISTRY: Record<number, MLBVenue> = {
  2: {
    id: 2,
    name: 'Oriole Park at Camden Yards',
    latitude: 39.2839,
    longitude: -76.6217,
    timezone: 'America/New_York',
    roofType: 'OPEN',
    warnings: [],
  },
  31: {
    id: 31,
    name: 'PNC Park',
    latitude: 40.4469,
    longitude: -80.0057,
    timezone: 'America/New_York',
    roofType: 'OPEN',
    warnings: [],
  },
  238: {
    id: 238,
    name: 'Coors Field',
    latitude: 39.7561,
    longitude: -104.9942,
    timezone: 'America/Denver',
    roofType: 'OPEN',
    warnings: [],
  },
  2394: {
    id: 2394,
    name: 'Comerica Park',
    latitude: 42.339,
    longitude: -83.0485,
    timezone: 'America/Detroit',
    roofType: 'OPEN',
    warnings: [],
  },
  2392: {
    id: 2392,
    name: 'Daikin Park',
    latitude: 29.7567,
    longitude: -95.3556,
    timezone: 'America/Chicago',
    roofType: 'RETRACTABLE',
    warnings: ['Roof status not programmatically verified; treat as retractable but not confirmed open/closed for analytics.'],
  },
  3309: {
    id: 3309,
    name: 'Globe Life Field',
    latitude: 32.7514,
    longitude: -97.0827,
    timezone: 'America/Chicago',
    roofType: 'DOME',
    warnings: [],
  },
};

export function resolveVenue(venueId: number, fallback?: MLBVenue): MLBVenue {
  const entry = STADIUM_REGISTRY[venueId];
  if (entry) return entry;
  if (fallback) return fallback;
  return {
    id: venueId,
    name: `Unknown Venue ${venueId}`,
    roofType: 'UNKNOWN',
    warnings: [`Venue ${venueId} not found in stadium registry.`],
  };
}

export function isStale(
  fetchedAt: Date,
  config: typeof DEFAULT_FRESHNESS_CONFIG,
  key: keyof typeof DEFAULT_FRESHNESS_CONFIG,
  referenceTime: Date = new Date(),
): boolean {
  return referenceTime.getTime() - fetchedAt.getTime() > config[key];
}

export function normalizeSchedule(raw: unknown): MLBScheduleGame[] {
  const data = raw as {
    totalItems: number;
    dates: Array<{
      date: string;
      games: Array<{
        gamePk: number;
        gameDate: string;
        officialDate: string;
        status: {
          abstractGameState: string;
          codedGameState: string;
          detailedState: string;
          startTimeTBD?: boolean;
        };
        teams: {
          away: {
            team: { id: number; name: string };
            probablePitcher?: { id: number; fullName: string };
            leagueRecord?: { wins: number; losses: number; pct: string };
          };
          home: {
            team: { id: number; name: string };
            probablePitcher?: { id: number; fullName: string };
            leagueRecord?: { wins: number; losses: number; pct: string };
          };
        };
        venue: { id: number; name: string };
        dayNight: string;
        scheduledInnings: number;
        doubleHeader: string;
        seriesGameNumber: number;
        gamesInSeries: number;
        seriesDescription: string;
      }>;
    }>;
  };

  const games: MLBScheduleGame[] = [];
  for (const dateEntry of data.dates) {
    for (const game of dateEntry.games) {
      const status = mapGameStatus(game.status.codedGameState);
      games.push({
        gamePk: game.gamePk,
        officialDate: game.officialDate,
        gameDate: game.gameDate,
        startTimeUtc: new Date(game.gameDate),
        status,
        homeTeamId: game.teams.home.team.id,
        homeTeamName: game.teams.home.team.name,
        awayTeamId: game.teams.away.team.id,
        awayTeamName: game.teams.away.team.name,
        venueId: game.venue.id,
        venueName: game.venue.name,
        dayNight: game.dayNight === 'day' || game.dayNight === 'night' ? game.dayNight : 'unknown',
        scheduledInnings: game.scheduledInnings,
        doubleHeader: game.doubleHeader,
        seriesGameNumber: game.seriesGameNumber,
        gamesInSeries: game.gamesInSeries,
        seriesDescription: game.seriesDescription,
        leagueRecord: {
          home: mapLeagueRecord(game.teams.home.leagueRecord),
          away: mapLeagueRecord(game.teams.away.leagueRecord),
        },
        probablePitchers: {
          home: normalizeProbablePitcher(
            game.teams.home.probablePitcher,
            game.teams.home.team.id,
          ),
          away: normalizeProbablePitcher(
            game.teams.away.probablePitcher,
            game.teams.away.team.id,
          ),
        },
      });
    }
  }

  return games;
}

export function normalizeProbablePitcher(
  raw: { id: number; fullName: string } | undefined,
  teamId: number,
  status: 'CONFIRMED' | 'PROBABLE' | 'CHANGED' = 'PROBABLE',
): PitcherAssignment | null {
  if (!raw) return null;
  return {
    availability: 'AVAILABLE',
    personId: raw.id,
    fullName: raw.fullName,
    teamId,
    status,
    fetchedAt: new Date(),
    warnings: [],
  };
}

export function normalizeTeamBatting(
  result: TeamBattingStatsResult,
): TeamBattingProfile {
  const warnings: string[] = [];
  if (result.stats == null) {
    warnings.push('Team batting statistics unavailable.');
  }
  return {
    teamId: result.teamId,
    teamName: '',
    seasonStats: result.stats,
    completeness: result.stats ? 1 : 0,
    warnings,
    provenance: result.provenance,
  };
}

export function normalizeBullpen(
  result: TeamPitchingStatsResult,
): BullpenProfile {
  const warnings: string[] = [];
  if (result.stats == null) {
    warnings.push('Team pitching statistics unavailable.');
  } else {
    warnings.push('Bullpen availability data incomplete; recent workload not calculated in Phase 1A.');
  }
  return {
    teamId: result.teamId,
    teamName: '',
    seasonStats: result.stats,
    recentWorkload: null,
    confirmedRelieverAvailability: 'UNKNOWN',
    completeness: result.stats ? 1 : 0,
    warnings,
    provenance: result.provenance,
  };
}

export function calculateCompleteness(parts: {
  schedule: boolean;
  homeProbable: boolean;
  awayProbable: boolean;
  homePitcherStats: boolean;
  awayPitcherStats: boolean;
  homeBatting: boolean;
  awayBatting: boolean;
  homeBullpenQuality: boolean;
  awayBullpenQuality: boolean;
  homeBullpenWorkload: boolean;
  awayBullpenWorkload: boolean;
  venue: boolean;
  weather: boolean;
  referenceTime?: Date;
}): number {
  const values = Object.values(parts);
  const filled = values.filter(Boolean).length;
  return Number((filled / values.length).toFixed(2));
}

export function calculateDaysSinceLastStart(
  starts: PitcherRecentStart[],
  referenceTime: Date = new Date(),
): number | null {
  if (starts.length === 0) return null;
  const mostRecent = starts[0].date;
  const start = new Date(mostRecent);
  const diffMs = referenceTime.getTime() - start.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function calculatePitcherCompleteness(
  seasonStats: PitcherSeasonStatsResult['stats'],
  recentStarts: PitcherRecentStart[],
): number {
  let score = 0;
  let total = 0;

  if (seasonStats != null) score += 1;
  total += 1;

  if (recentStarts.length >= 3) score += 1;
  total += 1;

  return total === 0 ? 0 : Number((score / total).toFixed(2));
}

export function comparePitcherAssignments(
  a: PitcherAssignment | null,
  b: PitcherAssignment | null,
): 'SAME' | 'CHANGED' | 'ADDED' | 'REMOVED' {
  if (a === null && b === null) return 'SAME';
  if (a === null) return 'ADDED';
  if (b === null) return 'REMOVED';
  const aId = extractPitcherId(a);
  const bId = extractPitcherId(b);
  if (aId !== bId) return 'CHANGED';
  return 'SAME';
}

function extractPitcherId(assignment: PitcherAssignment): number | null {
  return assignment.availability === 'AVAILABLE' ? assignment.personId : null;
}

function mapGameStatus(coded: string): MLBScheduleGame['status'] {
  switch (coded) {
    case 'P':
    case 'S':
    case 'D':
      return 'UPCOMING';
    case 'L':
    case 'I':
      return 'LIVE';
    case 'F':
    case 'O':
      return 'FINAL';
    case 'C':
      return 'CANCELLED';
    default:
      return 'UPCOMING';
  }
}

function mapLeagueRecord(raw?: { wins: number; losses: number; pct: string }) {
  if (!raw) return { wins: 0, losses: 0, pct: '.000' };
  return { wins: raw.wins, losses: raw.losses, pct: raw.pct };
}
