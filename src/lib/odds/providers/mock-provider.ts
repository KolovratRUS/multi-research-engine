import type { OddsProvider, OddsProviderConfig, CanonicalBookmakerValue } from '@/types/provider';
import type { NormalizedProviderEvent } from '@/types/event';
import type { NormalizedOdds } from '@/lib/odds/types';
import { BaseOddsProvider } from './base';
import { canonicalEvents, fixtureOddsSamples } from '@/fixtures/phase0.ts';

export class MockOddsProvider extends BaseOddsProvider {
  name = 'mock-odds-provider';

  constructor(config: OddsProviderConfig = {}) {
    super(config);
  }

  getSupportedBookmakers(): CanonicalBookmakerValue[] {
    return ['SPORTSBET', 'LADBROKES', 'UNIBET', 'OTHER'];
  }

  async fetchUpcomingEvents(_sport: string, _date: string): Promise<NormalizedProviderEvent[]> {
    // Phase 0: deterministic mock events from fixture loader
    return canonicalEvents.map((e) => ({
      externalId: e.externalId,
      sport: e.sport,
      league: e.league,
      leagueSlug: e.leagueSlug,
      homeTeam: e.homeTeam,
      awayTeam: e.awayTeam,
      homeTeamSlug: e.homeTeamSlug,
      awayTeamSlug: e.awayTeamSlug,
      startTimeUtc: e.startTimeUtc,
      status: e.status,
    }));
  }

  async fetchOdds(eventId: string, _marketKeys?: string[]): Promise<NormalizedOdds[]> {
    // Phase 0: deterministic mock odds from fixture loader
    return fixtureOddsSamples
      .filter((o) => o.eventId === eventId)
      .map((o) => ({
        id: o.id,
        eventId: o.eventId,
        bookmaker: o.bookmaker,
        marketKey: o.marketKey,
        selectionId: o.selectionId,
        selection: o.selection,
        line: o.line,
        decimalOdds: o.decimalOdds,
        timestamp: o.timestamp,
      }));
  }
}
