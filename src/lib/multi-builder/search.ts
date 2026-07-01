import type { PricedCandidate } from '@/types/candidate';
import type { Leg } from '@/types/leg';
import type { Multi, MultiStatus } from '@/types/multi';
import { estimateJointProbability } from '@/lib/probability/joint';
import { detectCorrelations, isCorrelationStrong } from '@/lib/correlation/detect';
import type { CanonicalEvent } from '@/types/event';
import type { NormalizedOdds } from '@/lib/odds/types';
import type { ResearchCandidate } from '@/types/candidate';

function isAvailablePricedCandidate(
  candidate: PricedCandidate,
): candidate is Extract<PricedCandidate, { marketAvailable: true }> {
  return candidate.marketAvailable;
}

export interface TierConfig {
  targetTier: number;
  targetBandMin: number;
  targetBandMax: number;
  minLegs: number;
  maxLegs: number;
  minConfidence: number;
  minDataQuality?: number;
}

export interface MultiBuildOptions {
  tiers: TierConfig[];
  primaryBookmaker: string;
  allowSameEvent?: boolean;
}

export interface MultiBuildResult {
  multi: Multi;
  legs: Leg[];
  warning?: string;
}

export interface BuildableLegInput {
  research: ResearchCandidate & { eventId: string };
  priced: PricedCandidate;
  event: CanonicalEvent;
}

export function matchMarkets(
  researchCandidates: ResearchCandidate[],
  oddsSamples: NormalizedOdds[],
  primaryBookmaker: string,
): PricedCandidate[] {
  const map = new Map<string, NormalizedOdds[]>();
  for (const sample of oddsSamples) {
    const key = `${sample.eventId}-${sample.bookmaker}-${sample.marketKey}-${sample.selection}`;
    const list = map.get(key) ?? [];
    list.push(sample);
    map.set(key, list);
  }

  const results: PricedCandidate[] = [];

  for (const rc of researchCandidates) {
    const key = `${rc.eventId}-${primaryBookmaker}-${rc.marketType.toLowerCase()}-${rc.selection}`;
    const samples = map.get(key) ?? [];
    const available = samples.filter((s) => s.decimalOdds != null);

    if (available.length === 0) {
      results.push({
        id: `priced-${rc.id}-missing`,
        researchCandidateId: rc.id,
        bookmaker: primaryBookmaker,
        canonicalMarket: rc.marketType,
        canonicalSelection: rc.selection,
        line: rc.line,
        decimalOdds: null,
        oddsTimestamp: new Date(),
        marketAvailable: false,
        matchConfidence: 0,
        matchingWarnings: ['Sportsbet does not offer this market'],
        createdAt: new Date(),
      });
    } else {
      for (const sample of available) {
        results.push({
          id: `priced-${rc.id}-${results.length}`,
          researchCandidateId: rc.id,
          oddsSampleId: sample.id ?? `odds-${rc.id}-${results.length}`,
          bookmaker: primaryBookmaker,
          canonicalMarket: rc.marketType,
          canonicalSelection: rc.selection,
          line: rc.line,
          decimalOdds: sample.decimalOdds,
          oddsTimestamp: sample.timestamp,
          marketAvailable: true,
          matchConfidence: 85,
          matchingWarnings: [],
          createdAt: new Date(),
        });
      }
    }
  }

  return results;
}

function pickLegs(inputs: BuildableLegInput[], options: MultiBuildOptions): Leg[] {
  const selected: Leg[] = [];
  const seenEvents = new Set<string>();

  const eligible = inputs.filter((item) => {
    if (!options.allowSameEvent && seenEvents.has(item.research.eventId)) return false;
    if (!isAvailablePricedCandidate(item.priced)) return false;
    if (item.priced.decimalOdds <= 1) return false;
    if (item.research.confidence < options.tiers[0].minConfidence) return false;
    if (options.tiers[0].minDataQuality && item.research.dataQuality < options.tiers[0].minDataQuality) return false;

    const corr = selected.some((leg) => {
      const found = detectCorrelations(
        { id: item.research.id, tags: item.research.correlationTags },
        { id: leg.researchCandidateId, tags: [] },
      );
      return found ? isCorrelationStrong(found.tag) : false;
    });
    if (corr) return false;

    return true;
  });

  const sorted = [...eligible].sort((a, b) => {
    if (b.research.researchStrengthScore !== a.research.researchStrengthScore) {
      return b.research.researchStrengthScore - a.research.researchStrengthScore;
    }
    return b.priced.matchConfidence - a.priced.matchConfidence;
  });

  for (const item of sorted) {
    if (selected.length >= 20) break;
    if (!isAvailablePricedCandidate(item.priced)) continue;
    selected.push({
      id: `leg-${selected.length + 1}`,
      multiId: '',
      researchCandidateId: item.research.id,
      pricedCandidateId: item.priced.id,
      eventId: item.event.id,
      sport: item.event.sport,
      league: item.event.league,
      eventName: `${item.event.homeTeam} vs ${item.event.awayTeam}`,
      startTimeUtc: item.event.startTimeUtc,
      bookmaker: item.priced.bookmaker,
      market: item.priced.canonicalMarket,
      selection: item.priced.canonicalSelection,
      line: item.priced.line,
      decimalOdds: item.priced.decimalOdds,
      confidence: item.research.confidence,
      dataQuality: item.research.dataQuality,
      researchStrengthScore: item.research.researchStrengthScore,
      matchConfidence: item.priced.matchConfidence,
      explanation: item.research.explanation,
      warnings: [...item.research.warnings, ...item.priced.matchingWarnings],
      createdAt: new Date(),
    });
    seenEvents.add(item.research.eventId);
  }

  return selected;
}

function comboSatisfiesBand(legs: Leg[], bandMin: number, bandMax: number): boolean {
  const combined = legs.reduce((acc, leg) => acc * leg.decimalOdds, 1);
  return combined >= bandMin && combined <= bandMax;
}

function searchCombination(
  inputs: BuildableLegInput[],
  options: MultiBuildOptions,
  tierIndex: number,
  start: number,
  current: Leg[],
  best: { legs: Leg[]; score: number } | null,
): { legs: Leg[]; score: number } | null {
  if (tierIndex >= options.tiers.length) {
    return best;
  }

  if (current.length >= options.tiers[tierIndex].maxLegs) {
    return searchCombination(inputs, options, tierIndex + 1, 0, current, best);
  }

  if (best && current.length >= options.tiers[tierIndex].minLegs && comboSatisfiesBand(current, options.tiers[tierIndex].targetBandMin, options.tiers[tierIndex].targetBandMax)) {
    return best;
  }

  for (let i = start; i < inputs.length; i++) {
    const item = inputs[i];
    if (item.research.confidence < options.tiers[tierIndex].minConfidence) continue;
    const minDataQuality = options.tiers[tierIndex].minDataQuality;
    if (minDataQuality !== undefined && item.research.dataQuality < minDataQuality) continue;
    if (!isAvailablePricedCandidate(item.priced)) continue;
    if (item.priced.decimalOdds <= 1) continue;

    const leg: Leg = {
      id: `leg-${current.length + 1}`,
      multiId: '',
      researchCandidateId: item.research.id,
      pricedCandidateId: item.priced.id,
      eventId: item.event.id,
      sport: item.event.sport,
      league: item.event.league,
      eventName: `${item.event.homeTeam} vs ${item.event.awayTeam}`,
      startTimeUtc: item.event.startTimeUtc,
      bookmaker: item.priced.bookmaker,
      market: item.priced.canonicalMarket,
      selection: item.priced.canonicalSelection,
      line: item.priced.line,
      decimalOdds: item.priced.decimalOdds,
      confidence: item.research.confidence,
      dataQuality: item.research.dataQuality,
      researchStrengthScore: item.research.researchStrengthScore,
      matchConfidence: item.priced.matchConfidence,
      explanation: item.research.explanation,
      warnings: [...item.research.warnings, ...item.priced.matchingWarnings],
      createdAt: new Date(),
    };

    const corr = current.some((existing) => {
      const found = detectCorrelations(
        { id: item.research.id, tags: item.research.correlationTags },
        { id: existing.researchCandidateId, tags: [] },
      );
      return found ? isCorrelationStrong(found.tag) : false;
    });

    if (corr) continue;

    if (current.some((l) => l.eventId === leg.eventId)) continue;

    const nextScore =
      current.length === 0
        ? item.research.researchStrengthScore
        : (current.reduce((a, l) => a + l.decimalOdds, 1) * leg.decimalOdds) /
          Math.max(options.tiers[tierIndex].targetBandMin, 1);

    if (best === null || nextScore > best.score) {
      const next = searchCombination(inputs, options, tierIndex, i + 1, [...current, leg], { legs: [...current, leg], score: nextScore });
      if (next !== null) {
        best = next;
      }
    }
  }

  return best;
}

export function buildMultis(
  inputs: BuildableLegInput[],
  options: MultiBuildOptions,
): MultiBuildResult[] {
  const results: MultiBuildResult[] = [];
  const now = new Date();

  for (const tier of options.tiers) {
    let tierInputs = inputs.filter((item) => item.research.confidence >= tier.minConfidence);
    const minDataQuality = tier.minDataQuality;
    if (minDataQuality !== undefined) {
      tierInputs = tierInputs.filter((item) => item.research.dataQuality >= minDataQuality);
    }

    const searchOptions = { ...options, tiers: [tier] };
    const found = searchCombination(tierInputs, searchOptions, 0, 0, [], null);
    const legs = found?.legs ?? [];

    const combinedOdds = legs.reduce((acc, leg) => acc * leg.decimalOdds, 1);
    const avgConfidence = legs.length
      ? Number((legs.reduce((a, l) => a + l.confidence, 0) / legs.length).toFixed(2))
      : 0;
    const avgDataQuality = legs.length
      ? Number((legs.reduce((a, l) => a + l.dataQuality, 0) / legs.length).toFixed(2))
      : 0;

    let warning: string | undefined;
    if (legs.length === 0) {
      warning = 'No eligible selections available for this tier.';
    } else if (!comboSatisfiesBand(legs, tier.targetBandMin, tier.targetBandMax)) {
      warning = 'Insufficient high-quality selections to generate this tier today.';
    }

    const snapshot = {
      legs: legs.map((l) => ({
        researchCandidateId: l.researchCandidateId,
        pricedCandidateId: l.pricedCandidateId,
        eventId: l.eventId,
        decimalOdds: l.decimalOdds,
        bookmaker: l.bookmaker,
      })),
      generatedAt: now.toISOString(),
      primaryBookmaker: options.primaryBookmaker,
      tier,
    };

    const multi: Multi = {
      id: `multi-${tier.targetTier}-${now.getTime()}`,
      targetTier: tier.targetTier,
      targetBandMin: tier.targetBandMin,
      targetBandMax: tier.targetBandMax,
      combinedOdds,
      legs,
      avgConfidence,
      avgDataQuality,
      riskClass: classifyRisk(combinedOdds, legs.length),
      primaryBookmaker: options.primaryBookmaker,
      bookmakerTotals: {
        [options.primaryBookmaker]: Number(combinedOdds.toFixed(2)),
      },
      status: 'DRAFT',
      generatedAt: now,
      snapshot,
    };

    results.push({ multi, legs, warning });
  }

  return results;
}

export function calculateCombinedOdds(legs: Leg[]): number {
  return legs.reduce((acc, leg) => acc * leg.decimalOdds, 1);
}

export function classifyRisk(combinedOdds: number, legCount: number): string {
  if (legCount <= 4) return 'low';
  if (legCount <= 8) return 'medium';
  return 'high';
}
