import { describe, it, expect } from 'vitest';
import { scoreMLBCandidate } from '@/lib/research/mlb/scorers';

describe('MLB scorer', () => {
  it('returns deterministic mock scores with null modelProbability', () => {
    const candidate = {
      eventId: 'mlb-event-1',
      sport: 'mlb',
      league: 'MLB',
      marketType: 'H2H' as const,
      selection: 'New York Yankees',
      explanation: 'Mock research: Yankees home with strong pitching matchup.',
      supportingData: { mock: true },
      warnings: ['Development fixture — not validated'],
      projection: { mockProjection: true },
    };

    const result = scoreMLBCandidate(candidate);

    expect(result.researchStrengthScore).toBe(65);
    expect(result.confidence).toBe(60);
    expect(result.dataQuality).toBe(70);
    expect(result.volatility).toBe('MEDIUM');
    expect(result.modelProbability).toBeNull();
    expect(result.status).toBe('ACTIVE');
    expect(result.explanation).toContain('Mock research result');
    expect(result.explanation).toContain('uncalibrated');
  });
});
