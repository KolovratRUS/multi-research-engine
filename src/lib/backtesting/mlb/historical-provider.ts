import type {
  MLBHistoricalDataProvider,
  HistoricalMLBGame,
  MLBGameOutcome,
  HistoricalPitcherProfile,
  HistoricalTeamProfile,
  HistoricalTeamGame,
} from '../types';
import { assertNotFutureLeakage, assertHistoricalOnly } from '../leakage-guards';
import type { PitcherAssignment } from '@/lib/research-data/types';
import { buildMLBFixtures } from '@/fixtures/backtesting/mlb/fixture-games';

export class FixtureHistoricalProvider implements MLBHistoricalDataProvider {
  private readonly fixtures: readonly HistoricalMLBGame[];
  private readonly outcomeMap: Map<number, MLBGameOutcome>;
  private readonly pitcherProfiles: Record<number, HistoricalPitcherProfile | null>;
  private readonly teamProfiles: Record<number, HistoricalTeamProfile | null>;
  private readonly recentTeamGames: Record<number, readonly HistoricalTeamGame[]>;

  constructor() {
    const fixture = buildMLBFixtures();
    this.fixtures = fixture.games;
    this.outcomeMap = new Map(fixture.outcomes.map((o) => [o.gamePk, o]));
    this.pitcherProfiles = fixture.pitcherProfiles;
    this.teamProfiles = fixture.teamProfiles;
    this.recentTeamGames = fixture.recentTeamGames;
  }

  async fetchGamesForDate(date: string): Promise<HistoricalMLBGame[]> {
    assertHistoricalOnly('fixture');
    return this.fixtures.filter((g) => g.officialDate === date);
  }

  async fetchGameOutcome(gamePk: number): Promise<MLBGameOutcome> {
    assertHistoricalOnly('fixture');
    const outcome = this.outcomeMap.get(gamePk);
    if (!outcome) {
      throw new Error(`No fixture outcome for gamePk ${gamePk}`);
    }
    return outcome;
  }

  async fetchPitcherStatsAsOf(
    personId: number,
    cutoff: Date,
  ): Promise<HistoricalPitcherProfile | null> {
    assertHistoricalOnly('fixture');
    // Cutoff validation is intentionally strict for fixture data.
    if (!Number.isFinite(cutoff.getTime())) {
      throw new Error(`Invalid cutoff for pitcher profile: ${cutoff}`);
    }
    const profile = this.pitcherProfiles[personId];
    if (!profile) return null;
    if (profile.asOf.getTime() >= cutoff.getTime()) {
      return null;
    }
    return profile;
  }

  async fetchTeamStatsAsOf(teamId: number, cutoff: Date): Promise<HistoricalTeamProfile | null> {
    assertHistoricalOnly('fixture');
    if (!Number.isFinite(cutoff.getTime())) {
      throw new Error(`Invalid cutoff for team profile: ${cutoff}`);
    }
    const profile = this.teamProfiles[teamId];
    if (!profile) return null;
    if (profile.asOf.getTime() >= cutoff.getTime()) {
      return null;
    }
    return profile;
  }

  async fetchRecentGamesBefore(
    teamId: number,
    cutoff: Date,
    limit: number,
  ): Promise<HistoricalTeamGame[]> {
    assertHistoricalOnly('fixture');
    if (!Number.isFinite(cutoff.getTime())) {
      throw new Error(`Invalid cutoff for recent games: ${cutoff}`);
    }
    const games = this.recentTeamGames[teamId] ?? [];
    return games.filter((g) => new Date(g.gameDate).getTime() < cutoff.getTime()).slice(0, limit);
  }
}

export function prepareFixtureOutcomes(
  games: HistoricalMLBGame[],
  outcomes: MLBGameOutcome[],
): Map<number, MLBGameOutcome> {
  const map = new Map<number, MLBGameOutcome>();
  for (const outcome of outcomes) {
    map.set(outcome.gamePk, outcome);
  }
  return map;
}

export function attachFixtureOutcomes(
  games: HistoricalMLBGame[],
  outcomes: Map<number, MLBGameOutcome>,
): HistoricalMLBGame[] {
  return games.map((game) => {
    const outcome = outcomes.get(game.gamePk);
    if (outcome && game.status !== 'FINAL') {
      return {
        ...game,
        status: 'FINAL',
      };
    }
    return game;
  });
}
