import { describe, it, expect } from 'vitest';
import { buildMultis, calculateCombinedOdds, classifyRisk } from '@/lib/multi-builder/search';
import type { BuildableLegInput } from '@/lib/multi-builder/search';
import type { PricedCandidate } from '@/types/candidate';
import type { ResearchCandidate } from '@/types/candidate';
import type { CanonicalEvent } from '@/types/event';

function makeResearchCandidate(overrides: Partial<ResearchCandidate> = {}): ResearchCandidate {
  return {
    id: overrides.id ?? 'rc-1',
    eventId: overrides.eventId ?? 'event-1',
    sport: overrides.sport ?? 'mlb',
    league: overrides.league ?? 'MLB',
    marketType: overrides.marketType ?? 'H2H',
    selection: overrides.selection ?? 'Team A',
    line: overrides.line,
    modelProbability: null,
    researchStrengthScore: overrides.researchStrengthScore ?? 70,
    confidence: overrides.confidence ?? 70,
    dataQuality: overrides.dataQuality ?? 70,
    volatility: overrides.volatility ?? 'MEDIUM',
    correlationTags: overrides.correlationTags ?? [],
    explanation: overrides.explanation ?? 'Mock explanation',
    supportingData: {},
    warnings: overrides.warnings ?? [],
    projection: {},
    status: 'ACTIVE',
    researchVersion: '0.1-mock',
    researchTimestamp: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeEvent(overrides: Partial<CanonicalEvent> = {}): CanonicalEvent {
  return {
    id: overrides.id ?? 'event-1',
    externalId: overrides.externalId ?? 'event-1',
    sport: overrides.sport ?? 'mlb',
    league: overrides.league ?? 'MLB',
    leagueSlug: overrides.leagueSlug,
    homeTeam: overrides.homeTeam ?? 'Home Team',
    awayTeam: overrides.awayTeam ?? 'Away Team',
    homeTeamSlug: overrides.homeTeamSlug,
    awayTeamSlug: overrides.awayTeamSlug,
    startTimeUtc: overrides.startTimeUtc ?? new Date(),
    status: overrides.status ?? 'UPCOMING',
    homeScore: overrides.homeScore,
    awayScore: overrides.awayScore,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makePricedCandidate(overrides: Partial<PricedCandidate> = {}): PricedCandidate {
  const marketAvailable = overrides.marketAvailable ?? true;
  if (marketAvailable) {
    return {
      marketAvailable: true,
      id: overrides.id ?? 'pc-1',
      researchCandidateId: overrides.researchCandidateId ?? 'rc-1',
      oddsSampleId: overrides.oddsSampleId ?? 'odds-1',
      bookmaker: overrides.bookmaker ?? 'SPORTSBET',
      canonicalMarket: overrides.canonicalMarket ?? 'H2H',
      canonicalSelection: overrides.canonicalSelection ?? 'Team A',
      line: overrides.line,
      decimalOdds: overrides.decimalOdds ?? 1.5,
      oddsTimestamp: overrides.oddsTimestamp ?? new Date(),
      matchConfidence: overrides.matchConfidence ?? 70,
      matchingWarnings: overrides.matchingWarnings ?? [],
      createdAt: new Date(),
    };
  }

  return {
    marketAvailable: false,
    id: overrides.id ?? 'pc-unavailable',
    researchCandidateId: overrides.researchCandidateId ?? 'rc-1',
    bookmaker: overrides.bookmaker ?? 'SPORTSBET',
    canonicalMarket: overrides.canonicalMarket ?? 'H2H',
    canonicalSelection: overrides.canonicalSelection ?? 'Team A',
    line: overrides.line,
    decimalOdds: null,
    oddsTimestamp: overrides.oddsTimestamp ?? new Date(),
    matchConfidence: 0,
    matchingWarnings: overrides.matchingWarnings ?? ['Sportsbet does not offer this market'],
    createdAt: new Date(),
  };
}

function makeBuildableInput(overrides: Record<string, unknown> = {}): BuildableLegInput {
  return {
    research: makeResearchCandidate((overrides.research ?? {}) as Parameters<typeof makeResearchCandidate>[0]),
    priced: makePricedCandidate((overrides.priced ?? {}) as Parameters<typeof makePricedCandidate>[0]),
    event: makeEvent((overrides.event ?? {}) as Parameters<typeof makeEvent>[0]),
  };
}

describe('multi-builder', () => {
  const tiers = [
    { targetTier: 10, targetBandMin: 8.5, targetBandMax: 12, minLegs: 4, maxLegs: 8, minConfidence: 76 },
    { targetTier: 30, targetBandMin: 25, targetBandMax: 38, minLegs: 6, maxLegs: 10, minConfidence: 72 },
  ];

  const options = {
    tiers,
    primaryBookmaker: 'sportsbet',
    allowSameEvent: true,
  };

  it('returns multis for every requested tier', () => {
    const candidates = [
      makeBuildableInput({
        research: { id: 'rc-1', eventId: 'event-1', confidence: 80, dataQuality: 80, researchStrengthScore: 75, correlationTags: [] },
        priced: { id: 'pc-1', researchCandidateId: 'rc-1', oddsSampleId: 'odds-1', bookmaker: 'SPORTSBET', canonicalMarket: 'H2H', canonicalSelection: 'Team A', decimalOdds: 1.5, oddsTimestamp: new Date(), marketAvailable: true, matchConfidence: 70, matchingWarnings: [], createdAt: new Date() },
        event: { id: 'event-1', externalId: 'event-1', sport: 'mlb', league: 'MLB', homeTeam: 'A', awayTeam: 'B', startTimeUtc: new Date(), status: 'UPCOMING', createdAt: new Date(), updatedAt: new Date() },
      }),
      makeBuildableInput({
        research: { id: 'rc-2', eventId: 'event-2', confidence: 78, dataQuality: 82, researchStrengthScore: 73, correlationTags: [] },
        priced: { id: 'pc-2', researchCandidateId: 'rc-2', oddsSampleId: 'odds-2', bookmaker: 'SPORTSBET', canonicalMarket: 'H2H', canonicalSelection: 'Team C', decimalOdds: 1.6, oddsTimestamp: new Date(), marketAvailable: true, matchConfidence: 70, matchingWarnings: [], createdAt: new Date() },
        event: { id: 'event-2', externalId: 'event-2', sport: 'mlb', league: 'MLB', homeTeam: 'C', awayTeam: 'D', startTimeUtc: new Date(), status: 'UPCOMING', createdAt: new Date(), updatedAt: new Date() },
      }),
      makeBuildableInput({
        research: { id: 'rc-3', eventId: 'event-3', confidence: 77, dataQuality: 78, researchStrengthScore: 71, correlationTags: [] },
        priced: { id: 'pc-3', researchCandidateId: 'rc-3', oddsSampleId: 'odds-3', bookmaker: 'SPORTSBET', canonicalMarket: 'H2H', canonicalSelection: 'Team E', decimalOdds: 1.7, oddsTimestamp: new Date(), marketAvailable: true, matchConfidence: 70, matchingWarnings: [], createdAt: new Date() },
        event: { id: 'event-3', externalId: 'event-3', sport: 'mlb', league: 'MLB', homeTeam: 'E', awayTeam: 'F', startTimeUtc: new Date(), status: 'UPCOMING', createdAt: new Date(), updatedAt: new Date() },
      }),
      makeBuildableInput({
        research: { id: 'rc-4', eventId: 'event-4', confidence: 76, dataQuality: 79, researchStrengthScore: 70, correlationTags: [] },
        priced: { id: 'pc-4', researchCandidateId: 'rc-4', oddsSampleId: 'odds-4', bookmaker: 'SPORTSBET', canonicalMarket: 'H2H', canonicalSelection: 'Team G', decimalOdds: 1.8, oddsTimestamp: new Date(), marketAvailable: true, matchConfidence: 70, matchingWarnings: [], createdAt: new Date() },
        event: { id: 'event-4', externalId: 'event-4', sport: 'mlb', league: 'MLB', homeTeam: 'G', awayTeam: 'H', startTimeUtc: new Date(), status: 'UPCOMING', createdAt: new Date(), updatedAt: new Date() },
      }),
    ];

    const results = buildMultis(candidates, options);
    expect(results).toHaveLength(2);
  });

  it('does not substitute market-match confidence for research confidence when odds change', () => {
    const base = makeBuildableInput({
      research: { id: 'rc-1', eventId: 'event-1', confidence: 80, dataQuality: 80, researchStrengthScore: 75, correlationTags: [] },
      priced: { id: 'pc-1', researchCandidateId: 'rc-1', oddsSampleId: 'odds-1', bookmaker: 'SPORTSBET', canonicalMarket: 'H2H', canonicalSelection: 'Team A', decimalOdds: 1.5, oddsTimestamp: new Date(), marketAvailable: true, matchConfidence: 70, matchingWarnings: [], createdAt: new Date() },
      event: { id: 'event-1', externalId: 'event-1', sport: 'mlb', league: 'MLB', homeTeam: 'A', awayTeam: 'B', startTimeUtc: new Date(), status: 'UPCOMING', createdAt: new Date(), updatedAt: new Date() },
    });

    const changedOdds = makeBuildableInput({
      research: { id: 'rc-1', eventId: 'event-1', confidence: 80, dataQuality: 80, researchStrengthScore: 75, correlationTags: [] },
      priced: { id: 'pc-1', researchCandidateId: 'rc-1', oddsSampleId: 'odds-1', bookmaker: 'SPORTSBET', canonicalMarket: 'H2H', canonicalSelection: 'Team A', decimalOdds: 3.0, oddsTimestamp: new Date(), marketAvailable: true, matchConfidence: 70, matchingWarnings: [], createdAt: new Date() },
      event: { id: 'event-1', externalId: 'event-1', sport: 'mlb', league: 'MLB', homeTeam: 'A', awayTeam: 'B', startTimeUtc: new Date(), status: 'UPCOMING', createdAt: new Date(), updatedAt: new Date() },
    });

    const baseResults = buildMultis([base], options);
    const changedResults = buildMultis([changedOdds], options);

    for (const r of baseResults) {
      for (const leg of r.legs) {
        expect(leg.confidence).toBe(80);
        expect(leg.dataQuality).toBe(80);
        expect(leg.researchStrengthScore).toBe(75);
        expect(leg.matchConfidence).toBe(70);
      }
    }
  });

  it('flags insufficient selections when odds band is unreachable', () => {
    const candidates = [
      makeBuildableInput({
        research: { id: 'rc-1', eventId: 'event-1', confidence: 80, dataQuality: 80, researchStrengthScore: 75, correlationTags: [] },
        priced: { id: 'pc-1', researchCandidateId: 'rc-1', oddsSampleId: 'odds-1', bookmaker: 'SPORTSBET', canonicalMarket: 'H2H', canonicalSelection: 'Team A', decimalOdds: 1.1, oddsTimestamp: new Date(), marketAvailable: true, matchConfidence: 70, matchingWarnings: [], createdAt: new Date() },
        event: { id: 'event-1', externalId: 'event-1', sport: 'mlb', league: 'MLB', homeTeam: 'A', awayTeam: 'B', startTimeUtc: new Date(), status: 'UPCOMING', createdAt: new Date(), updatedAt: new Date() },
      }),
    ];

    const results = buildMultis(candidates, options);
    const t10 = results.find((r) => r.multi.targetTier === 10);
    expect(t10?.warning).toContain('Insufficient high-quality selections');
  });
});
