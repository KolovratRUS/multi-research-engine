import type { BacktestSnapshot, ExploratoryScoreConfig } from '../types';
import { EXPLORATORY_SCORE_VERSION } from './score-config';

export const TEAM_ONLY_SCORE_VERSION = 'MLB_TEAM_ONLY_V1';

export const TEAM_ONLY_SCORE_CONFIG: ExploratoryScoreConfig = {
  version: TEAM_ONLY_SCORE_VERSION,
  weights: {
    startingPitcher: 0,
    opponentBatting: 0.70,
    bullpen: 0,
    offenseLineup: 0,
    homePark: 0.20,
    injuriesLineup: 0,
    restTravel: 0.10,
    weatherRoof: 0,
  },
};

export function validateTeamOnlyScoreConfig(config: ExploratoryScoreConfig): void {
  if (config.version !== TEAM_ONLY_SCORE_VERSION) {
    throw new Error(`Unexpected team-only score version: ${config.version}`);
  }
  const weights = Object.values(config.weights);
  for (const weight of weights) {
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error(`Score config weights must be finite and non-negative: ${weight}`);
    }
  }
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total === 0) {
    throw new Error('Team-only score config must have at least one non-zero weight');
  }
}

export interface TeamOnlyScoreResult {
  readonly version: string;
  readonly predictedSide: 'HOME' | 'AWAY' | null;
  readonly researchStrengthScore: number;
  readonly confidence: number;
  readonly dataQuality: number;
  readonly volatility: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly componentScores: Record<string, number>;
  readonly warnings: string[];
  readonly abstained: boolean;
  readonly abstentionReason?: string;
  readonly availableWeight: number;
  readonly totalWeight: number;
  readonly availableGroups: string[];
  readonly requiredGroups: string[];
}

function makeTeamOnlyAbstention(
  snapshot: BacktestSnapshot,
  config: ExploratoryScoreConfig,
  availableWeight: number,
  totalWeight: number,
  availableGroups: string[],
  reason: string,
  warning: string,
): TeamOnlyScoreResult {
  return {
    version: config.version,
    predictedSide: null,
    researchStrengthScore: 0,
    confidence: 0,
    dataQuality: snapshot.dataQuality,
    volatility: 'HIGH',
    componentScores: {},
    warnings: [...snapshot.warnings, warning],
    abstained: true,
    abstentionReason: reason,
    availableWeight,
    totalWeight,
    availableGroups,
    requiredGroups: Object.keys(config.weights),
  };
}

function getWeight(
  weights: ExploratoryScoreConfig['weights'],
  group: string,
): number {
  if (group === 'startingPitcher') return weights.startingPitcher;
  if (group === 'opponentBatting') return weights.opponentBatting;
  if (group === 'bullpen') return weights.bullpen;
  if (group === 'offenseLineup') return weights.offenseLineup;
  if (group === 'homePark') return weights.homePark;
  if (group === 'injuriesLineup') return weights.injuriesLineup;
  if (group === 'restTravel') return weights.restTravel;
  if (group === 'weatherRoof') return weights.weatherRoof;
  return 0;
}

export function computeTeamOnlyScore(
  snapshot: BacktestSnapshot,
  config: ExploratoryScoreConfig = TEAM_ONLY_SCORE_CONFIG,
): TeamOnlyScoreResult {
  validateTeamOnlyScoreConfig(config);

  const coverage = snapshot.features.availability as Record<string, boolean>;
  const requiredGroups = Object.keys(config.weights);
  const availableGroups = requiredGroups.filter((group) => coverage[group] !== false);

  const weightMap = config.weights;
  const totalWeight = requiredGroups.reduce((sum, group) => sum + getWeight(weightMap, group), 0);
  const availableWeight = availableGroups.reduce((sum, group) => sum + getWeight(weightMap, group), 0);
  const coverageRatio = totalWeight > 0 ? availableWeight / totalWeight : 0;

  if (snapshot.dataQuality < 30) {
    return makeTeamOnlyAbstention(
      snapshot,
      config,
      availableWeight,
      totalWeight,
      availableGroups,
      'DATA_QUALITY_BELOW_THRESHOLD',
      'Data quality below abstention threshold',
    );
  }

  if (availableGroups.length === 0) {
    return makeTeamOnlyAbstention(
      snapshot,
      config,
      availableWeight,
      totalWeight,
      availableGroups,
      'TEAM_ONLY_INSUFFICIENT_TEAM_EVIDENCE',
      'No team evidence available',
    );
  }

  const raw = computeTeamOnlyRawScores(snapshot.features);
  const renormalized = renormalizeTeamOnly(raw, availableGroups, totalWeight, weightMap);

  const strength = availableGroups.reduce((sum, group) => sum + (renormalized[group] ?? 0), 0);
  const predictedSide = strength >= 0 ? 'HOME' : 'AWAY';
  const researchStrengthScore = Math.min(100, Math.max(0, Math.abs(strength) * 100));
  const confidence = Math.round(Math.min(100, Math.max(0, snapshot.dataQuality * coverageRatio * (researchStrengthScore / 100) * 0.85)));
  const volatility = researchStrengthScore < 50 ? 'HIGH' : researchStrengthScore < 75 ? 'MEDIUM' : 'LOW';

  return {
    version: config.version,
    predictedSide,
    researchStrengthScore,
    confidence,
    dataQuality: snapshot.dataQuality,
    volatility,
    componentScores: renormalized,
    warnings: [...snapshot.warnings, 'TEAM_ONLY_RESEARCH', 'STARTING_PITCHERS_UNAVAILABLE'],
    abstained: false,
    availableWeight,
    totalWeight,
    availableGroups,
    requiredGroups,
  };
}

function computeTeamOnlyRawScores(features: unknown): Record<string, number> {
  const scores: Record<string, number> = {};

  const typed = features as {
    readonly offense?: {
      readonly homeRunsPerGame: number | null;
      readonly awayRunsPerGame: number | null;
      readonly homeOps: number | null;
      readonly awayOps: number | null;
      readonly homeRecentWinRate: number | null;
      readonly awayRecentWinRate: number | null;
      readonly homeSeasonWinRate: number | null;
      readonly awaySeasonWinRate: number | null;
    };
    readonly context?: {
      readonly homeAdvantage: boolean;
      readonly venueKnown: boolean;
    };
  };

  if (
    typed.offense &&
    typed.offense.homeOps != null &&
    typed.offense.awayOps != null
  ) {
    scores.opponentBatting = typed.offense.homeOps - typed.offense.awayOps;
  }

  if (typed.offense && typed.offense.homeRunsPerGame != null && typed.offense.awayRunsPerGame != null) {
    scores.offenseLineup = scores.offenseLineup ?? 0;
    scores.offenseLineup += (typed.offense.homeRunsPerGame - typed.offense.awayRunsPerGame) * 0.25;
  }

  scores.homePark = typed.context?.homeAdvantage ? 0.2 : -0.2;
  scores.restTravel = 0;

  return scores;
}

function renormalizeTeamOnly(
  raw: Record<string, number>,
  availableGroups: string[],
  totalWeight: number,
  weightMap: ExploratoryScoreConfig['weights'],
): Record<string, number> {
  const result: Record<string, number> = {};
  const availableTotal = availableGroups.reduce((sum, group) => sum + getWeight(weightMap, group), 0);

  if (availableTotal === 0) {
    for (const group of availableGroups) {
      result[group] = raw[group] ?? 0;
    }
    return result;
  }

  const inv = totalWeight / availableTotal;
  for (const group of availableGroups) {
    const weight = getWeight(weightMap, group);
    if (weight === 0) continue;
    result[group] = (raw[group] ?? 0) * weight * inv;
  }
  return result;
}
