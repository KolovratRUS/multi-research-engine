import type {
  MLBResearchDataProvider,
  MLBScheduleResult,
  ProbablePitchersResult,
  PitcherSeasonStatsResult,
  PitcherRecentFormResult,
  TeamBattingStatsResult,
  TeamPitchingStatsResult,
  MLBVenue,
  DataProvenance,
  PitcherAssignment,
} from '../types';
import {
  ScheduleResponseSchema,
  FeedLiveResponseSchema,
  PersonStatsResponseSchema,
  PersonGameLogResponseSchema,
  TeamStatsResponseSchema,
  VenueResponseSchema,
} from './stats-api-client';
import {
  normalizeSchedule,
  normalizeProbablePitcher,
  normalizeTeamBatting,
  normalizeBullpen,
  resolveVenue,
  calculateDaysSinceLastStart,
  calculatePitcherCompleteness,
} from './normalization';
import { ResearchDataError, ResearchDataValidationError } from '../errors';
import {
  MLB_FIXTURE_SCHEDULE,
  MLB_FIXTURE_FEED,
  MLB_FIXTURE_PITCHER_SEASON,
  MLB_FIXTURE_PITCHER_GAME_LOG,
  MLB_FIXTURE_TEAM_HITTING,
  MLB_FIXTURE_TEAM_PITCHING,
  MLB_FIXTURE_VENUE,
} from '@/fixtures/research-data/mlb/fixtures';

function validate<T>(
  schema: { parse: (input: unknown) => T },
  raw: unknown,
  fallbackMessage: string,
): T {
  try {
    return schema.parse(raw);
  } catch (err) {
    if (err instanceof Error) {
      throw new ResearchDataValidationError({
        message: `${fallbackMessage}: ${err.message}`,
        source: 'mlb-fixture',
      });
    }
    throw new ResearchDataValidationError({
      message: `${fallbackMessage}: unknown validation error`,
      source: 'mlb-fixture',
    });
  }
}

export class MLBFixtureProvider implements MLBResearchDataProvider {
  async fetchSchedule(_date: string): Promise<MLBScheduleResult> {
    const parsed = validate(
      ScheduleResponseSchema,
      MLB_FIXTURE_SCHEDULE,
      'Invalid schedule fixture',
    );
    const games = normalizeSchedule(parsed);
    return {
      games,
      provenance: {
        source: 'mlb-fixture:schedule',
        fetchedAt: new Date(),
        isLive: false,
        warnings: [],
      },
    };
  }

  async fetchProbablePitchers(
    gamePk: number,
    _schedulePitchers?: { home: PitcherAssignment | null; away: PitcherAssignment | null } | undefined,
  ): Promise<ProbablePitchersResult> {
    const parsed = validate(
      FeedLiveResponseSchema,
      MLB_FIXTURE_FEED,
      'Invalid game feed fixture',
    );
    const gameData = parsed.gameData;
    const pit = gameData.probablePitchers;
    const teams = gameData.teams;

    const home: PitcherAssignment | null = pit?.home
      ? normalizeProbablePitcher(pit.home, teams.home.id)
      : null;

    const away: PitcherAssignment | null = pit?.away
      ? normalizeProbablePitcher(pit.away, teams.away.id)
      : null;

    return {
      gamePk,
      home,
      away,
      provenance: {
        source: 'mlb-fixture:probablePitchers',
        fetchedAt: new Date(),
        isLive: false,
        warnings: [],
      },
    };
  }

  async fetchPitcherSeasonStats(
    personId: number,
    season: number,
  ): Promise<PitcherSeasonStatsResult> {
    const parsed = validate(
      PersonStatsResponseSchema,
      MLB_FIXTURE_PITCHER_SEASON,
      'Invalid pitcher season fixture',
    );
    const rawStats = parsed.stats[0]?.splits[0]?.stat;
    const stats = rawStats as unknown as PitcherSeasonStatsResult['stats'] | null;
    return {
      personId,
      season,
      stats,
      provenance: {
        source: 'mlb-fixture:peopleSeasonStats',
        fetchedAt: new Date(),
        isLive: false,
        warnings: [],
      },
    };
  }

  async fetchPitcherRecentStarts(
    personId: number,
    season: number,
    limit: number,
  ): Promise<PitcherRecentFormResult> {
    const parsed = validate(
      PersonGameLogResponseSchema,
      MLB_FIXTURE_PITCHER_GAME_LOG,
      'Invalid pitcher game log fixture',
    );
    const starts = parsed.stats[0]?.splits
      .slice(0, limit)
      .map((split) => ({
        date: split.date ?? '',
        opponent: split.opponent?.name ?? 'Unknown',
        opponentTeamId: split.opponent?.id ?? 0,
        inningsPitched: String(split.stat.inningsPitched),
        earnedRuns: split.stat.earnedRuns as number,
        strikeOuts: split.stat.strikeOuts as number,
        baseOnBalls: split.stat.baseOnBalls as number,
        pitches: split.stat.numberOfPitches as number | undefined,
        homeRunsAllowed: split.stat.homeRuns as number,
        hits: split.stat.hits as number,
        gamePk: split.game?.gamePk,
      })) ?? [];

    return {
      personId,
      season,
      starts,
      provenance: {
        source: 'mlb-fixture:peopleGameLog',
        fetchedAt: new Date(),
        isLive: false,
        warnings: [],
      },
    };
  }

  async fetchTeamBattingStats(
    teamId: number,
    season: number,
  ): Promise<TeamBattingStatsResult> {
    const parsed = validate(
      TeamStatsResponseSchema,
      MLB_FIXTURE_TEAM_HITTING,
      'Invalid team hitting fixture',
    );
    const rawStats = parsed.stats[0]?.splits[0]?.stat;
    const stats = rawStats as unknown as TeamBattingStatsResult['stats'] | null;
    return {
      teamId,
      season,
      stats,
      provenance: {
        source: 'mlb-fixture:teamBattingStats',
        fetchedAt: new Date(),
        isLive: false,
        warnings: [],
      },
    };
  }

  async fetchTeamPitchingStats(
    teamId: number,
    season: number,
  ): Promise<TeamPitchingStatsResult> {
    const parsed = validate(
      TeamStatsResponseSchema,
      MLB_FIXTURE_TEAM_PITCHING,
      'Invalid team pitching fixture',
    );
    const rawStats = parsed.stats[0]?.splits[0]?.stat;
    const stats = rawStats as unknown as TeamPitchingStatsResult['stats'] | null;
    return {
      teamId,
      season,
      stats,
      provenance: {
        source: 'mlb-fixture:teamPitchingStats',
        fetchedAt: new Date(),
        isLive: false,
        warnings: [],
      },
    };
  }

  async fetchVenue(venueId: number): Promise<MLBVenue> {
    const parsed = validate(
      VenueResponseSchema,
      MLB_FIXTURE_VENUE,
      'Invalid venue fixture',
    );
    const rawVenue = parsed.venues[0];
    if (!rawVenue) {
      throw new ResearchDataError({
        message: `Fixture venue not found: ${venueId}`,
        source: 'mlb-fixture',
      });
    }
    return resolveVenue(venueId, {
      id: rawVenue.id,
      name: rawVenue.name,
      timezone: rawVenue.timeZone?.id,
      roofType: 'OPEN',
      warnings: [],
    });
  }
}
