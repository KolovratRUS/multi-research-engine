import { describe, it, expect } from 'vitest';
import { MLBModule } from '@/lib/research/mlb/module';
import { MockOddsProvider } from '@/lib/odds/providers/mock-provider';
import { matchMarkets, buildMultis } from '@/lib/multi-builder/search';
import type { CanonicalEvent } from '@/types/event';
import type { ResearchCandidate } from '@/types/candidate';
import { canonicalEvents, fixtureOddsSamples } from '@/fixtures/phase0.ts';

const module = new MLBModule();
const provider = new MockOddsProvider();

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

describe('Phase 0 end-to-end flow', () => {
  it('executes full Stage 1 → Stage 2 → multi pipeline', async () => {
    // 1. Load canonical mock events
    const events = canonicalEvents as CanonicalEvent[];

    // 2. Run blind Stage 1 research
    const statistics = await module.fetchStatistics(events);
    const rawCandidates = await module.generateCandidates(events, statistics);
    const researchCandidates: ResearchCandidate[] = [];
    for (const raw of rawCandidates) {
      const scored = await module.scoreCandidate(raw);
      researchCandidates.push(scored);
    }

    // 3. Snapshot Stage 1 output
    const stage1Snapshot = deepClone(researchCandidates);

    // 4. Load mock odds through MockOddsProvider
    const allOddsSamples = [];
    for (const event of events) {
      const odds = await provider.fetchOdds(event.id);
      allOddsSamples.push(...odds);
    }

    // 5. Match markets into PricedCandidates
    const pricedCandidates = matchMarkets(researchCandidates, allOddsSamples, 'SPORTSBET');

    // 10. Verify at least one unavailable Sportsbet market is excluded and reported
    const unavailableMarkets = pricedCandidates.filter((p) => !p.marketAvailable);
    expect(unavailableMarkets.length).toBeGreaterThanOrEqual(1);
    expect(unavailableMarkets.some((p) => p.matchingWarnings.includes('Sportsbet does not offer this market'))).toBe(true);

    // 6. Join Event + ResearchCandidate + PricedCandidate
    const eventMap = new Map(events.map((e) => [e.id, e]));
    const researchMap = new Map(researchCandidates.map((r) => [r.id, r]));
    const pricedMap = new Map(pricedCandidates.map((p) => [p.id, p]));

    const buildableInputs = pricedCandidates
      .filter((p) => p.marketAvailable)
      .map((p) => {
        const research = researchMap.get(p.researchCandidateId)!;
        const event = eventMap.get(research.eventId)!;
        return { research, priced: p, event };
      });

    // 7. Build at least one multi
    const options = {
      tiers: [
        { targetTier: 10, targetBandMin: 8.5, targetBandMax: 12, minLegs: 4, maxLegs: 8, minConfidence: 76 },
      ],
      primaryBookmaker: 'SPORTSBET',
      allowSameEvent: false,
    };

    const results = buildMultis(buildableInputs, options);
    expect(results.length).toBeGreaterThanOrEqual(1);

    const multiResult = results[0];
    if (multiResult.legs.length > 0) {
      // 9. Verify combined odds equal product of selected leg odds
      const expectedCombinedOdds = multiResult.legs.reduce((acc, leg) => acc * leg.decimalOdds, 1);
      expect(multiResult.multi.combinedOdds).toBeCloseTo(expectedCombinedOdds, 4);

      // 11. Verify no multi contains two legs from the same event
      const eventIds = multiResult.legs.map((l) => l.eventId);
      expect(new Set(eventIds).size).toBe(eventIds.length);

      // 12. Verify legs retain source scores
      for (const leg of multiResult.legs) {
        const research = researchMap.get(leg.researchCandidateId);
        expect(research).toBeDefined();
        expect(leg.confidence).toBe(research!.confidence);
        expect(leg.dataQuality).toBe(research!.dataQuality);
        expect(leg.researchStrengthScore).toBe(research!.researchStrengthScore);
        expect(leg.matchConfidence).toBeGreaterThanOrEqual(0);
      }
    }

    // 8. Verify all references are correct
    for (const leg of multiResult.legs) {
      const research = researchMap.get(leg.researchCandidateId);
      const priced = pricedMap.get(leg.pricedCandidateId);
      const event = eventMap.get(leg.eventId);

      expect(research).toBeDefined();
      expect(priced).toBeDefined();
      expect(event).toBeDefined();
      expect(leg.eventId).toBe(event!.id);
      expect(leg.researchCandidateId).toBe(research!.id);
      expect(leg.pricedCandidateId).toBe(priced!.id);
    }

    // 13. Verify Stage 1 snapshot remains unchanged after pricing and multi construction
    for (let i = 0; i < stage1Snapshot.length; i++) {
      const original = stage1Snapshot[i];
      const current = researchCandidates[i];
      expect(current.eventId).toBe(original.eventId);
      expect(current.selection).toBe(original.selection);
      expect(current.marketType).toBe(original.marketType);
      expect(current.projection).toEqual(original.projection);
      expect(current.researchStrengthScore).toBe(original.researchStrengthScore);
      expect(current.confidence).toBe(original.confidence);
      expect(current.dataQuality).toBe(original.dataQuality);
      expect(current.volatility).toBe(original.volatility);
      expect(current.explanation).toBe(original.explanation);
      expect(current.warnings).toEqual(original.warnings);
      expect(current.modelProbability).toBe(original.modelProbability);
    }
  });
});
