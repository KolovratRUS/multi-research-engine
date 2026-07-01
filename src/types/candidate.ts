export type Volatility = 'LOW' | 'MEDIUM' | 'HIGH';
export type CandidateStatus = 'ACTIVE' | 'STALE' | 'EXCLUDED' | 'RESOLVED';
export type MarketType = 'H2H' | 'SPREADS' | 'TOTALS' | 'TEAM_TOTALS' | 'PLAYER_PROP' | 'ALTERNATE';

export interface ResearchCandidate {
  id: string;
  eventId: string;
  sport: string;
  league: string;
  marketType: MarketType;
  selection: string;
  line?: string;

  modelProbability: number | null;
  researchStrengthScore: number;
  confidence: number;
  dataQuality: number;
  volatility: Volatility;
  correlationTags: string[];

  explanation: string;
  supportingData: Record<string, unknown>;
  warnings: string[];
  projection: Record<string, unknown>;

  status: CandidateStatus;
  researchVersion: string;
  researchTimestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type PricedCandidate =
  | {
      marketAvailable: true;
      id: string;
      researchCandidateId: string;
      oddsSampleId: string;
      bookmaker: string;
      canonicalMarket: string;
      canonicalSelection: string;
      line?: string;
      decimalOdds: number;
      oddsTimestamp: Date;
      matchConfidence: number;
      matchingWarnings: string[];
      createdAt: Date;
    }
  | {
      marketAvailable: false;
      id: string;
      researchCandidateId: string;
      oddsSampleId?: undefined;
      bookmaker: string;
      canonicalMarket: string;
      canonicalSelection: string;
      line?: string;
      decimalOdds: null;
      oddsTimestamp: Date;
      matchConfidence: 0;
      matchingWarnings: string[];
      createdAt: Date;
    };
