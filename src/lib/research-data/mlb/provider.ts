import type {
  DataProvenance,
  MLBVenue,
  MLBScheduleGame,
  MLBScheduleResult,
  PitcherAssignment,
  PitcherResearchProfile,
  PitcherSeasonStatsResult,
  PitcherRecentFormResult,
  TeamBattingProfile,
  TeamBattingStatsResult,
  TeamPitchingStatsResult,
  BullpenProfile,
  GameWeather,
  MLBGameResearchSnapshot,
  MLBResearchDataProvider,
  SchedulePitcherContext,
} from '../types';
import { MLBStatsApiClient, resolveMLBConfig } from './stats-api-client';
import { ResearchDataError } from '../errors';
import {
  STADIUM_REGISTRY,
  resolveVenue,
  normalizeSchedule,
  normalizeProbablePitcher,
  calculateCompleteness,
  calculateDaysSinceLastStart,
  calculatePitcherCompleteness,
} from './normalization';
import type { ProbablePitchersResult } from '../types';

const FRESHNESS = {
  scheduleStaleMs: 15 * 60 * 1000,
  probablePitcherStaleMs: 30 * 60 * 1000,
  teamStatsStaleMs: 6 * 60 * 60 * 1000,
  recentGameStaleMs: 6 * 60 * 1000,
  weatherStaleMs: 90 * 60 * 1000,
};

export class MLBResearchDataAdapter implements MLBResearchDataProvider {
  private readonly client: MLBStatsApiClient;

  constructor(config?: { client?: MLBStatsApiClient }) {
    this.client = config?.client ?? new MLBStatsApiClient(resolveMLBConfig());
  }

  async fetchSchedule(date: string): Promise<MLBScheduleResult> {
    const raw = await this.client.fetchSchedule(date);
    const games: MLBScheduleGame[] = normalizeSchedule(raw);
    const prov: DataProvenance = {
      source: 'mlb-stats-api:schedule',
      fetchedAt: new Date(),
      isLive: true,
      warnings: [],
    };

    return {
      games,
      provenance: dateStale(prov.fetchedAt, FRESHNESS.scheduleStaleMs)
        ? { ...prov, warnings: [...prov.warnings, 'Schedule data is stale.'] }
        : prov,
    };
  }

  async fetchProbablePitchers(
    gamePk: number,
    schedulePitchers?: { home: PitcherAssignment | null; away: PitcherAssignment | null; homeTeamId?: number; awayTeamId?: number } | undefined,
  ): Promise<ProbablePitchersResult> {
    const warnings: string[] = [];
    let home: PitcherAssignment | null = schedulePitchers?.home ?? null;
    let away: PitcherAssignment | null = schedulePitchers?.away ?? null;
    let fallbackTeams: { home: { id: number }; away: { id: number } } | undefined;

    try {
      const data = await this.client.fetchProbablePitchers(gamePk);
      const payload = data as unknown as {
        gameData: {
          probablePitchers?: {
            away?: { id: number; fullName: string };
            home?: { id: number; fullName: string };
          };
          teams: {
            home: { id: number };
            away: { id: number };
          };
        };
      };
      fallbackTeams = payload.gameData.teams;
      const pit = payload.gameData.probablePitchers;
      if (pit?.home) {
        home = normalizeProbablePitcher(pit.home, fallbackTeams.home.id);
      }
      if (pit?.away) {
        away = normalizeProbablePitcher(pit.away, fallbackTeams.away.id);
      }
    } catch (err) {
      warnings.push(
        `Game feed unavailable for future game; using hydrated schedule probable pitchers.${err instanceof Error ? ` Underlying error: ${err.message}` : ''}`,
      );
    }

    if (home === null && !schedulePitchers?.home) {
      const teamId = schedulePitchers?.homeTeamId ?? fallbackTeams?.home?.id;
      if (teamId == null) {
        throw new Error(`Cannot create unavailable home pitcher assignment for game ${gamePk}: teamId is unknown.`);
      }
      home = {
        availability: 'UNAVAILABLE',
        teamId,
        status: 'UNAVAILABLE',
        fetchedAt: new Date(),
        warnings: ['Home probable pitcher absent from schedule and game feed.'],
      };
    }
    if (away === null && !schedulePitchers?.away) {
      const teamId = schedulePitchers?.awayTeamId ?? fallbackTeams?.away?.id;
      if (teamId == null) {
        throw new Error(`Cannot create unavailable away pitcher assignment for game ${gamePk}: teamId is unknown.`);
      }
      away = {
        availability: 'UNAVAILABLE',
        teamId,
        status: 'UNAVAILABLE',
        fetchedAt: new Date(),
        warnings: ['Away probable pitcher absent from schedule and game feed.'],
      };
    }

    if (
      home &&
      schedulePitchers?.home &&
      home.availability === 'AVAILABLE' &&
      schedulePitchers.home.availability === 'AVAILABLE'
    ) {
      home = {
        ...home,
        status: home.personId !== schedulePitchers.home.personId ? 'CHANGED' : home.status,
      };
    }
    if (
      away &&
      schedulePitchers?.away &&
      away.availability === 'AVAILABLE' &&
      schedulePitchers.away.availability === 'AVAILABLE'
    ) {
      away = {
        ...away,
        status: away.personId !== schedulePitchers.away.personId ? 'CHANGED' : away.status,
      };
    }

    const prov: DataProvenance = {
      source: 'mlb-stats-api:probablePitchers',
      fetchedAt: new Date(),
      isLive: true,
      warnings: [
        ...warnings,
        ...(home?.warnings ?? []),
        ...(away?.warnings ?? []),
      ].filter((value, index, array) => array.indexOf(value) === index),
    };

    return {
      gamePk,
      home,
      away,
      provenance: dateStale(prov.fetchedAt, FRESHNESS.probablePitcherStaleMs)
        ? { ...prov, warnings: [...prov.warnings, 'Probable pitcher data is stale.'] }
        : prov,
    };
  }

  async fetchPitcherSeasonStats(
    personId: number,
    season: number,
  ): Promise<PitcherSeasonStatsResult> {
    return this.client.fetchPitcherSeasonStats(personId, season);
  }

  async fetchPitcherRecentStarts(
    personId: number,
    season: number,
    limit: number,
  ): Promise<PitcherRecentFormResult> {
    return this.client.fetchPitcherRecentStarts(personId, season, limit);
  }

  async fetchTeamBattingStats(
    teamId: number,
    season: number,
  ): Promise<TeamBattingStatsResult> {
    return this.client.fetchTeamBattingStats(teamId, season);
  }

  async fetchTeamPitchingStats(
    teamId: number,
    season: number,
  ): Promise<TeamPitchingStatsResult> {
    return this.client.fetchTeamPitchingStats(teamId, season);
  }

  async fetchVenue(venueId: number): Promise<MLBVenue> {
    const apiVenue = await this.client.fetchVenue(venueId);
    return resolveVenue(venueId, apiVenue);
  }

  async buildGameSnapshot(
    game: MLBScheduleGame,
    options: {
      season: number;
      includeWeather: boolean;
      weatherProvider?: {
        fetchGameWeather: (
          latitude: number,
          longitude: number,
          firstPitchUtc: Date,
          timezone: string,
        ) => Promise<GameWeather>;
      };
    },
  ): Promise<MLBGameResearchSnapshot> {
    const warnings: string[] = [];
    const provenance: DataProvenance[] = [];

    const venue = await this.fetchVenue(game.venueId);
    provenance.push({
      source: 'mlb-stats-api:venue',
      fetchedAt: new Date(),
      isLive: true,
      warnings: venue.warnings,
    });

    const [homePitcherProfile, awayPitcherProfile] = await Promise.all([
      game.probablePitchers.home
        ? this.buildPitcherProfile(game.probablePitchers.home, options.season, game)
        : Promise.resolve(null),
      game.probablePitchers.away
        ? this.buildPitcherProfile(game.probablePitchers.away, options.season, game)
        : Promise.resolve(null),
    ]);

    const [homeBatting, awayBatting] = await Promise.all([
      this.fetchTeamBattingStats(game.homeTeamId, options.season).then(
        (r) => normalizeTeamBatting(r),
      ),
      this.fetchTeamBattingStats(game.awayTeamId, options.season).then(
        (r) => normalizeTeamBatting(r),
      ),
    ]);

    const [homeBullpen, awayBullpen] = await Promise.all([
      this.fetchTeamPitchingStats(game.homeTeamId, options.season).then(
        (r) => normalizeBullpen(r),
      ),
      this.fetchTeamPitchingStats(game.awayTeamId, options.season).then(
        (r) => normalizeBullpen(r),
      ),
    ]);

    let weather: GameWeather | null = null;
    if (
      options.includeWeather &&
      venue.latitude != null &&
      venue.longitude != null &&
      venue.roofType === 'OPEN'
    ) {
      try {
        if (options.weatherProvider) {
          weather = await options.weatherProvider.fetchGameWeather(
            venue.latitude,
            venue.longitude,
            game.startTimeUtc,
            venue.timezone ?? 'UTC',
          );
        }
      } catch (err) {
        warnings.push(
          `Weather fetch failed: ${err instanceof Error ? err.message : 'unknown error'}`,
        );
      }
    } else if (
      options.includeWeather &&
      (venue.latitude == null ||
        venue.longitude == null ||
        venue.roofType === 'UNKNOWN')
    ) {
      warnings.push('Weather unavailable: missing coordinates or unknown roof type.');
    }

    if (game.probablePitchers.home === null) {
      warnings.push('Home probable pitcher missing or unconfirmed.');
    }
    if (game.probablePitchers.away === null) {
      warnings.push('Away probable pitcher missing or unconfirmed.');
    }
    if (!homePitcherProfile) {
      warnings.push('Home pitcher statistics unavailable.');
    }
    if (!awayPitcherProfile) {
      warnings.push('Away pitcher statistics unavailable.');
    }
    if (!homeBatting) {
      warnings.push('Home team batting statistics unavailable.');
    }
    if (!awayBatting) {
      warnings.push('Away team batting statistics unavailable.');
    }

    const completeness = calculateCompleteness({
      schedule: true,
      homeProbable: game.probablePitchers.home !== null,
      awayProbable: game.probablePitchers.away !== null,
      homePitcherStats: homePitcherProfile?.seasonStats !== null,
      awayPitcherStats: awayPitcherProfile?.seasonStats !== null,
      homeBatting: homeBatting?.seasonStats !== null,
      awayBatting: awayBatting?.seasonStats !== null,
      homeBullpenQuality: true,
      awayBullpenQuality: true,
      homeBullpenWorkload: false,
      awayBullpenWorkload: false,
      venue: true,
      weather: weather !== null,
    });

    return {
      event: {
        id: '', // caller must attach stable internal identity
        externalId: String(game.gamePk),
        sport: 'mlb',
        league: 'MLB',
        leagueSlug: 'mlb',
        homeTeam: game.homeTeamName,
        awayTeam: game.awayTeamName,
        startTimeUtc: game.startTimeUtc,
        status: game.status,
        homeScore: undefined,
        awayScore: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      probablePitchers: {
        home: game.probablePitchers.home ?? null,
        away: game.probablePitchers.away ?? null,
      },
      pitcherStats: {
        home: homePitcherProfile ?? null,
        away: awayPitcherProfile ?? null,
      },
      teamBatting: {
        home: homeBatting ?? null,
        away: awayBatting ?? null,
      },
      bullpen: {
        home: homeBullpen ?? null,
        away: awayBullpen ?? null,
      },
      venue,
      weather,
      completeness,
      warnings,
      provenance,
      generatedAt: new Date(),
    };
  }

  private async buildPitcherProfile(
    assignment: PitcherAssignment,
    season: number,
    game: MLBScheduleGame,
  ): Promise<PitcherResearchProfile | null> {
    const warnings: string[] = [];
    let seasonStats: PitcherSeasonStatsResult['stats'] = null;
    let recentStarts: PitcherRecentFormResult['starts'] = [];
    const provenance: DataProvenance = {
      source: 'mlb-research-data:pitcher',
      fetchedAt: new Date(),
      isLive: true,
      warnings,
    };

    if (assignment.availability === 'UNAVAILABLE') {
      warnings.push(`Pitcher unavailable for this game.`);
      return null;
    }

    try {
      const [seasonResult, recentResult] = await Promise.all([
        this.client.fetchPitcherSeasonStats(assignment.personId, season),
        this.client.fetchPitcherRecentStarts(assignment.personId, season, 5),
      ]);
      seasonStats = seasonResult.stats;
      recentStarts = recentResult.starts;
      provenance.fetchedAt = new Date();
    } catch (err) {
      warnings.push(
        `Failed to load pitcher data for ${assignment.fullName}: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      return {
        personId: assignment.personId,
        fullName: assignment.fullName,
        teamId: assignment.teamId,
        seasonStats: null,
        recentStarts: [],
        daysSinceLastStart: null,
        completeness: 0,
        warnings,
        provenance,
      };
    }

    const daysSinceLastStart = calculateDaysSinceLastStart(recentStarts);

    return {
      personId: assignment.personId,
      fullName: assignment.fullName,
      teamId: assignment.teamId,
      seasonStats,
      recentStarts,
      daysSinceLastStart,
      completeness: calculatePitcherCompleteness(seasonStats, recentStarts),
      warnings,
      provenance,
    };
  }
}

function dateStale(fetchedAt: Date, thresholdMs: number): boolean {
  return Date.now() - fetchedAt.getTime() > thresholdMs;
}

function normalizeTeamBatting(
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

function normalizeBullpen(
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
