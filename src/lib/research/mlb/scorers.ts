import type { ResearchCandidate, MarketType, Volatility, CandidateStatus } from '@/types/candidate';
import type { ScoreWeights } from '@/types/score';

const DEFAULT_WEIGHTS: ScoreWeights = {
  startingPitcher: 0.28,
  opponentBatting: 0.20,
  bullpen: 0.14,
  offensiveForm: 0.13,
  homeAway: 0.08,
  injuries: 0.07,
  restTravel: 0.05,
  weather: 0.05,
};

export function scoreMLBCandidate(
  candidate: Partial<ResearchCandidate>,
  _weights: Partial<ScoreWeights> = {},
): Omit<ResearchCandidate, 'id' | 'createdAt' | 'updatedAt'> {
  const weights = { ...DEFAULT_WEIGHTS, ..._weights };

  // Phase 0: deterministic mock scoring
  // Real implementation will use MLBStats + projections

  const researchStrengthScore = 65;
  const confidence = 60;
  const dataQuality = 70;
  const volatility: Volatility = 'MEDIUM';
  const status: CandidateStatus = 'ACTIVE';

  return {
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
    correlationTags: candidate.correlationTags ?? [],
    explanation: candidate.explanation
      ? `${candidate.explanation} (Mock research result — uncalibrated.)`
      : 'Mock research result — uncalibrated.',
    supportingData: candidate.supportingData ?? { mock: true },
    warnings: candidate.warnings ?? ['Development fixture — not validated'],
    projection: candidate.projection ?? {},
    status,
    researchVersion: '0.1-mock',
    researchTimestamp: new Date(),
  };
}
