import type { SportModule } from '../interface';
import type { ResearchCandidate, MarketType, Volatility, CandidateStatus } from '@/types/candidate';
import type { CanonicalEvent } from '@/types/event';
import type {
  MLBResearchDataProvider,
  MLBGameResearchSnapshot,
  MLBScheduleGame,
  PitcherAssignment,
  MLBVenue,
  GameWeather,
  DataProvenance,
  PitcherResearchProfile,
  PitcherSeasonStatsResult,
  PitcherRecentFormResult,
  TeamBattingStatsResult,
  TeamPitchingStatsResult,
} from '@/lib/research-data/types';
import { createMLBResearchDataProvider, createWeatherProvider } from '@/lib/research-data/mode';
import {
  normalizeTeamBatting,
  normalizeBullpen,
  calculateCompleteness,
  calculateDaysSinceLastStart,
  calculatePitcherCompleteness,
} from '@/lib/research-data/mlb/normalization';

export class MLBModule implements SportModule {
  name = 'mlb';

  constructor(private readonly dataProvider: MLBResearchDataProvider = createMLBResearchDataProvider()) {}

  async fetchStatistics(events: CanonicalEvent[]): Promise<Record<string, unknown>> {
    const snapshots: Record<string, MLBGameResearchSnapshot> = {};
    const weatherProvider = createWeatherProvider();

    const date = events[0]?.startTimeUtc.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    let schedule;
    try {
      schedule = await this.dataProvider.fetchSchedule(date);
    } catch {
      schedule = {
        games: [],
        provenance: { source: 'mlb-module', fetchedAt: new Date(), isLive: false, warnings: ['Schedule fetch failed'] },
      };
    }

    const fallbackGame = schedule.games[0];

    for (const event of events) {
      const game = fallbackGame ?? schedule.games.find((g) => String(g.gamePk) === event.externalId);
      if (!game) continue;

      try {
        snapshots[event.id] = await this.buildSnapshot(game, new Date(event.startTimeUtc).getUTCFullYear(), weatherProvider);
      } catch {
        // ignore snapshot build failures and leave entry unset
      }
    }

    return snapshots as unknown as Record<string, unknown>;
  }

  async generateCandidates(
    events: CanonicalEvent[],
    _statistics: Record<string, unknown>,
  ): Promise<Partial<ResearchCandidate>[]> {
    // Deterministic candidate generation from event metadata.
    const candidates: Partial<ResearchCandidate>[] = [];

    for (const event of events) {
      const homeSelection = event.homeTeam;
      const awaySelection = event.awayTeam;

      candidates.push({
        eventId: event.id,
        sport: 'mlb',
        league: event.league,
        marketType: 'H2H' as MarketType,
        selection: homeSelection,
        line: undefined,
        explanation: `Mock research: ${homeSelection} home with strong pitching matchup.`,
        supportingData: { mock: true, note: 'No real projection in Phase 0' },
        warnings: ['Development fixture — not validated'],
        projection: { mockProjection: true },
      });

      candidates.push({
        eventId: event.id,
        sport: 'mlb',
        league: event.league,
        marketType: 'H2H' as MarketType,
        selection: awaySelection,
        line: undefined,
        explanation: `Mock research: ${awaySelection} away with favorable batting matchup.`,
        supportingData: { mock: true, note: 'No real projection in Phase 0' },
        warnings: ['Development fixture — not validated'],
        projection: { mockProjection: true },
      });
    }

    return candidates;
  }

  async scoreCandidate(
    candidate: Partial<ResearchCandidate>,
  ): Promise<ResearchCandidate> {
    const now = new Date();
    const hash = this.hashString(candidate.selection ?? '');
    const researchStrengthScore = 50 + (hash % 40);
    const confidence = 55 + (hash % 35);
    const dataQuality = 60 + (hash % 30);
    const volatilityIndex = hash % 3;
    const volatility: Volatility = volatilityIndex === 0 ? 'LOW' : volatilityIndex === 1 ? 'MEDIUM' : 'HIGH';

    return {
      id: `mock-${candidate.eventId ?? 'unknown'}-${candidate.selection ?? 'unknown'}`,
      eventId: candidate.eventId ?? 'unknown',
      sport: candidate.sport ?? 'mlb',
      league: candidate.league ?? 'MLB',
      marketType: (candidate.marketType as MarketType) ?? 'H2H',
      selection: candidate.selection ?? '',
      line: candidate.line,
      modelProbability: null,
      researchStrengthScore,
      confidence,
      dataQuality,
      volatility,
      correlationTags: [],
      explanation: candidate.explanation ?? 'Mock research result — uncalibrated.',
      supportingData: candidate.supportingData ?? {},
      warnings: candidate.warnings ?? ['Development fixture — not validated'],
      projection: candidate.projection ?? {},
      status: 'ACTIVE' as CandidateStatus,
      researchVersion: '0.1-mock',
      researchTimestamp: now,
      createdAt: now,
      updatedAt: now,
    };
  }

  private async buildSnapshot(
    game: MLBScheduleGame,
    season: number,
    weatherProvider: ReturnType<typeof createWeatherProvider>,
  ): Promise<MLBGameResearchSnapshot> {
    const warnings: string[] = [];
    const provenance: DataProvenance[] = [];

    const venue = await this.dataProvider.fetchVenue(game.venueId);
    provenance.push({ source: 'mlb-stats-api:venue', fetchedAt: new Date(), isLive: false, warnings: venue.warnings });

    const [homePitcherProfile, awayPitcherProfile] = await Promise.all([
      game.probablePitchers.home
        ? this.buildPitcherProfile(game.probablePitchers.home, season)
        : Promise.resolve(null),
      game.probablePitchers.away
        ? this.buildPitcherProfile(game.probablePitchers.away, season)
        : Promise.resolve(null),
    ]);

    const [homeBatting, awayBatting] = await Promise.all([
      this.dataProvider.fetchTeamBattingStats(game.homeTeamId, season).then((r) => normalizeTeamBatting(r)),
      this.dataProvider.fetchTeamBattingStats(game.awayTeamId, season).then((r) => normalizeTeamBatting(r)),
    ]);

    const [homeBullpen, awayBullpen] = await Promise.all([
      this.dataProvider.fetchTeamPitchingStats(game.homeTeamId, season).then((r) => normalizeBullpen(r)),
      this.dataProvider.fetchTeamPitchingStats(game.awayTeamId, season).then((r) => normalizeBullpen(r)),
    ]);

    let weather: GameWeather | null = null;
    if (
      venue.latitude != null &&
      venue.longitude != null &&
      venue.roofType === 'OPEN'
    ) {
      try {
        weather = await weatherProvider.fetchGameWeather(
          venue.latitude,
          venue.longitude,
          game.startTimeUtc,
          venue.timezone ?? 'UTC',
        );
      } catch (err) {
        warnings.push(`Weather fetch failed: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    } else if (
      venue.latitude == null ||
      venue.longitude == null ||
      venue.roofType === 'UNKNOWN'
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
        id: '',
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
  ): Promise<PitcherResearchProfile | null> {
    const warnings: string[] = [];
    let seasonStats: PitcherSeasonStatsResult['stats'] = null;
    let recentStarts: PitcherRecentFormResult['starts'] = [];
    const provenance: DataProvenance = {
      source: 'mlb-research-data:pitcher',
      fetchedAt: new Date(),
      isLive: false,
      warnings,
    };

    if (assignment.availability === 'UNAVAILABLE') {
      warnings.push('Pitcher unavailable for this game.');
      return null;
    }

    try {
      const [seasonResult, recentResult] = await Promise.all([
        this.dataProvider.fetchPitcherSeasonStats(assignment.personId, season),
        this.dataProvider.fetchPitcherRecentStarts(assignment.personId, season, 5),
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

  private hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash) + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
