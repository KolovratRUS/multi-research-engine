export interface NormalizedOdds {
  id?: string;
  eventId: string;
  bookmaker: string;
  marketKey: string;
  selectionId: string;
  selection: string;
  line?: string;
  decimalOdds: number;
  timestamp: Date;
  raw?: unknown;
}

export interface OddsSample {
  id: string;
  eventId: string;
  bookmaker: string;
  marketKey: string;
  selectionId: string;
  selection: string;
  line?: string;
  decimalOdds: number;
  timestamp: Date;
  raw?: unknown;
  fetchedAt: Date;
}

export interface MarketMatch {
  oddsSampleId: string;
  bookmaker: string;
  canonicalMarket: string;
  canonicalSelection: string;
  line?: string;
  decimalOdds: number;
  oddsTimestamp: Date;
  marketAvailable: boolean;
  matchConfidence: number;
  matchingWarnings: string[];
}
