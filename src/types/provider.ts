import type { NormalizedProviderEvent } from '@/types/event';
import type { NormalizedOdds } from '@/lib/odds/types';

export type CanonicalBookmakerValue =
  | 'SPORTSBET'
  | 'POINTSBET'
  | 'UNIBET'
  | 'LADBROKES'
  | 'BETR'
  | 'PALMERBET'
  | 'BETFAIR'
  | 'OTHER';

export interface OddsProvider {
  name: string;
  getSupportedBookmakers(): CanonicalBookmakerValue[];
  fetchUpcomingEvents(sport: string, date: string): Promise<NormalizedProviderEvent[]>;
  fetchOdds(eventId: string, marketKeys?: string[]): Promise<NormalizedOdds[]>;
}

export interface OddsProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}
