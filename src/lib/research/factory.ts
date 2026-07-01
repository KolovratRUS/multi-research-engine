import type { SportModule } from './interface';
import type { CanonicalEvent } from '@/types/event';
import type { ResearchCandidate } from '@/types/candidate';

type SportName = 'mlb' | 'nba' | 'soccer' | 'afl' | 'nrl' | 'tennis';

const modules: Record<SportName, SportModule | null> = {
  mlb: null, // implemented in Phase 0
  nba: null,
  soccer: null,
  afl: null,
  nrl: null,
  tennis: null,
};

export function registerModule(name: SportName, module: SportModule): void {
  modules[name] = module;
}

export async function runResearch(
  sport: SportName,
  events: CanonicalEvent[],
  statistics: Record<string, unknown>,
  researchVersion: string,
): Promise<ResearchCandidate[]> {
  const module = modules[sport];
  if (!module) {
    throw new Error(`Sport module not implemented: ${sport}`);
  }

  const context = { events, statistics, researchVersion };
  // Stage 1: blind research only. No odds exposure permitted.
  const rawCandidates = await module.generateCandidates(context.events, context.statistics);

  const scored = await Promise.all(
    rawCandidates.map((c) => module.scoreCandidate({ ...c, researchVersion })),
  );

  return scored;
}

export function getModule(name: SportName): SportModule | null {
  return modules[name] ?? null;
}
