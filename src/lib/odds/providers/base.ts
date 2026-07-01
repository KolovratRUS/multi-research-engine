import type { OddsProvider, OddsProviderConfig, CanonicalBookmakerValue } from '@/types/provider';
import type { NormalizedProviderEvent } from '@/types/event';
import type { NormalizedOdds } from '@/lib/odds/types';

export abstract class BaseOddsProvider implements OddsProvider {
  abstract name: string;

  constructor(protected config: OddsProviderConfig = {}) {}

  abstract getSupportedBookmakers(): CanonicalBookmakerValue[];
  abstract fetchUpcomingEvents(sport: string, date: string): Promise<NormalizedProviderEvent[]>;
  abstract fetchOdds(eventId: string, marketKeys?: string[]): Promise<NormalizedOdds[]>;
}
