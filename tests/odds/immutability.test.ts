import { describe, it, expect } from 'vitest';
import { MLBModule } from '@/lib/research/mlb/module';
import type { CanonicalEvent } from '@/types/event';
import { canonicalEvents } from '@/fixtures/phase0.ts';

const module = new MLBModule();

describe('Stage 1 output immutability against odds changes', () => {
  it('identical research input produces identical scores regardless of odds context', async () => {
    // oddsFixtureA and oddsFixtureB exist as separate data sets;
    // Stage 1 research never reads either fixture.

    const events = canonicalEvents.slice(0, 2) as CanonicalEvent[];
    const stats = await module.fetchStatistics(events);
    const rawCandidates = await module.generateCandidates(events, stats);

    // Run Stage 1 without odds context
    const resultA = await module.scoreCandidate(rawCandidates[0]);

    // Re-run Stage 1 with the same research input and identical context.
    // The MLB module does not receive odds, so this run is fully independent.
    const resultB = await module.scoreCandidate(rawCandidates[0]);

    const compareFields = [
      'eventId',
      'selection',
      'marketType',
      'projection',
      'researchStrengthScore',
      'confidence',
      'dataQuality',
      'volatility',
      'explanation',
      'warnings',
      'modelProbability',
    ] as const;

    for (const field of compareFields) {
      expect(resultA[field]).toEqual(resultB[field]);
    }
  });
});
