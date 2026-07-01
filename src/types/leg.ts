export type LegResult = 'WIN' | 'LOSS' | 'VOID';

export interface Leg {
  id: string;
  multiId: string;
  researchCandidateId: string;
  pricedCandidateId: string;
  eventId: string;

  sport: string;
  league: string;
  eventName: string;
  startTimeUtc: Date;

  bookmaker: string;
  market: string;
  selection: string;
  line?: string;

  decimalOdds: number;
  confidence: number;
  dataQuality: number;
  researchStrengthScore: number;
  matchConfidence: number;

  explanation: string;
  warnings: string[];

  result?: LegResult;
  createdAt: Date;
}
