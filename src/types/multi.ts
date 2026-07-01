import type { Leg } from './leg';

export type MultiStatus = 'DRAFT' | 'ACTIVE' | 'SETTLED' | 'VOID';

export interface Multi {
  id: string;
  targetTier: number;
  targetBandMin: number;
  targetBandMax: number;

  combinedOdds: number;
  legs: Leg[];

  avgConfidence?: number;
  avgDataQuality?: number;
  riskClass?: string;

  primaryBookmaker: string;
  bookmakerTotals?: Record<string, number>;

  status: MultiStatus;
  generatedAt: Date;
  settledAt?: Date;
  profitLoss?: number;

  snapshot: Record<string, unknown>;
}
