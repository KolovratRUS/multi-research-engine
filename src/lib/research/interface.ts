import type {
  ResearchCandidate,
  MarketType,
  Volatility,
  CandidateStatus,
} from '@/types/candidate';
import type { CanonicalEvent } from '@/types/event';

export interface SportModule {
  name: string;
  fetchStatistics(events: CanonicalEvent[]): Promise<Record<string, unknown>>;
  generateCandidates(
    events: CanonicalEvent[],
    statistics: Record<string, unknown>,
  ): Promise<Partial<ResearchCandidate>[]>;
  scoreCandidate(candidate: Partial<ResearchCandidate>): Promise<ResearchCandidate>;
}

export interface ResearchContext {
  events: CanonicalEvent[];
  statistics: Record<string, unknown>;
  researchVersion: string;
}

export interface CandidateFilterOptions {
  minDataQuality?: number;
  minConfidence?: number;
  excludeStatuses?: CandidateStatus[];
}
