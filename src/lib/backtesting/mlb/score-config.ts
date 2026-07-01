import type { ExploratoryScoreConfig } from '../types';

export const EXPLORATORY_SCORE_VERSION = 'exploratory-unvalidated-v1';

export const EXPLORATORY_SCORE_CONFIG: ExploratoryScoreConfig = {
  version: EXPLORATORY_SCORE_VERSION,
  weights: {
    startingPitcher: 0.28,
    opponentBatting: 0.20,
    bullpen: 0.14,
    offenseLineup: 0.13,
    homePark: 0.08,
    injuriesLineup: 0.07,
    restTravel: 0.05,
    weatherRoof: 0.05,
  },
};

export function validateExploratoryScoreConfig(config: ExploratoryScoreConfig): void {
  if (!config.version || config.version.trim().length === 0) {
    throw new Error('Score config version must be non-empty');
  }
  const weights = Object.values(config.weights);
  for (const weight of weights) {
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error(`Score config weights must be finite and non-negative: ${weight}`);
    }
  }
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (Math.abs(total - 1) > 0.0001) {
    throw new Error(`Score config weights must sum to 1, got ${total}`);
  }
}

export function renormalizeMissingGroups(
  features: Record<string, boolean>,
  config: ExploratoryScoreConfig,
): Record<string, number> {
  const weights: Record<string, number> = {};
  let total = 0;
  for (const [group, weight] of Object.entries(config.weights)) {
    if (features[group]) {
      weights[group] = weight;
      total += weight;
    }
  }
  if (total === 0) {
    return weights;
  }
  const inv = 1 / total;
  for (const group of Object.keys(weights)) {
    weights[group] = weights[group] * inv;
  }
  return weights;
}
