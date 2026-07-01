import type { BacktestSnapshot, ExploratoryScoreConfig, MLBPregameFeatures } from '../types';
import { EXPLORATORY_SCORE_CONFIG, validateExploratoryScoreConfig } from './score-config';

export interface ExploratoryScoreResult {
  version: string;
  predictedSide: 'HOME' | 'AWAY' | null;
  researchStrengthScore: number;
  confidence: number;
  dataQuality: number;
  volatility: 'LOW' | 'MEDIUM' | 'HIGH';
  componentScores: Record<string, number>;
  warnings: string[];
  abstained: boolean;
  abstentionReason?: string;
  availableWeight: number;
  totalWeight: number;
  availableGroups: string[];
  requiredGroups: string[];
}

function makeAbstention(
  snapshot: BacktestSnapshot,
  config: ExploratoryScoreConfig,
  availableWeight: number,
  totalWeight: number,
  availableGroups: string[],
  requiredGroups: Array<keyof ExploratoryScoreConfig['weights']>,
  reason: string,
  warning: string,
): ExploratoryScoreResult {
  const deduplicated = deduplicateWarnings([...snapshot.warnings, warning]);
  return {
    version: config.version,
    predictedSide: null,
    researchStrengthScore: 0,
    confidence: 0,
    dataQuality: snapshot.dataQuality,
    volatility: 'HIGH',
    componentScores: {},
    warnings: deduplicated,
    abstained: true,
    abstentionReason: reason,
    availableWeight,
    totalWeight,
    availableGroups,
    requiredGroups,
  };
}

function deduplicateWarnings(warnings: readonly string[]): string[] {
  return [...new Set(warnings)];
}

export function computeExploratoryScore(
  snapshot: BacktestSnapshot,
  config: ExploratoryScoreConfig = EXPLORATORY_SCORE_CONFIG,
): ExploratoryScoreResult {
  validateExploratoryScoreConfig(config);

  const coverage = snapshot.features.availability as Record<keyof ExploratoryScoreConfig['weights'], boolean>;
  const requiredGroups = Object.keys(config.weights) as Array<keyof ExploratoryScoreConfig['weights']>;
  const availableGroups = requiredGroups.filter((group) => coverage[group] !== false);

  const totalWeight = requiredGroups.reduce((sum, group) => sum + config.weights[group], 0);
  const availableWeight = availableGroups.reduce((sum, group) => sum + config.weights[group], 0);
  const coverageRatio = totalWeight > 0 ? availableWeight / totalWeight : 0;

  if (snapshot.dataQuality < 30) {
    return makeAbstention(
      snapshot,
      config,
      availableWeight,
      totalWeight,
      availableGroups,
      requiredGroups,
      'DATA_QUALITY_BELOW_THRESHOLD',
      'Data quality below abstention threshold',
    );
  }

  if (!snapshot.features.startingPitcher.homeAvailable && !snapshot.features.startingPitcher.awayAvailable) {
    return makeAbstention(
      snapshot,
      config,
      availableWeight,
      totalWeight,
      availableGroups,
      requiredGroups,
      'BOTH_PITCHERS_UNAVAILABLE',
      'Both starting pitchers unavailable',
    );
  }

  if (!snapshot.features.startingPitcher.homeAvailable) {
    return makeAbstention(
      snapshot,
      config,
      availableWeight,
      totalWeight,
      availableGroups,
      requiredGroups,
      'HOME_PITCHER_UNAVAILABLE',
      'Home starting pitcher unavailable',
    );
  }

  if (!snapshot.features.startingPitcher.awayAvailable) {
    return makeAbstention(
      snapshot,
      config,
      availableWeight,
      totalWeight,
      availableGroups,
      requiredGroups,
      'AWAY_PITCHER_UNAVAILABLE',
      'Away starting pitcher unavailable',
    );
  }

  if (availableGroups.length === 0) {
    return makeAbstention(
      snapshot,
      config,
      availableWeight,
      totalWeight,
      availableGroups,
      requiredGroups,
      'INSUFFICIENT_FEATURE_COVERAGE',
      'No feature coverage available',
    );
  }

  const COVERAGE_THRESHOLD = 0.45;
  if (coverageRatio < COVERAGE_THRESHOLD) {
    return makeAbstention(
      snapshot,
      config,
      availableWeight,
      totalWeight,
      availableGroups,
      requiredGroups,
      'INSUFFICIENT_FEATURE_COVERAGE',
      `Feature coverage ${coverageRatio.toFixed(2)} below abstention threshold ${COVERAGE_THRESHOLD}`,
    );
  }

  const rawScores = computeRawScores(snapshot.features);
  const renormalized = renormalize(rawScores, availableGroups, totalWeight, config);

  const strength = availableGroups.reduce((sum, group) => sum + (renormalized[group] ?? 0), 0);
  const predictedSide = strength >= 0 ? 'HOME' : 'AWAY';
  const researchStrengthScore = Math.min(100, Math.max(0, Math.abs(strength) * 100));
  const confidence = Math.round(Math.min(100, Math.max(0, snapshot.dataQuality * coverageRatio * (researchStrengthScore / 100))));
  const volatility = researchStrengthScore < 40 ? 'HIGH' : researchStrengthScore < 70 ? 'MEDIUM' : 'LOW';

  return {
    version: config.version,
    predictedSide,
    researchStrengthScore,
    confidence,
    dataQuality: snapshot.dataQuality,
    volatility,
    componentScores: renormalized,
    warnings: [...snapshot.warnings],
    abstained: false,
    availableWeight,
    totalWeight,
    availableGroups,
    requiredGroups,
  };
}

function computeRawScores(features: MLBPregameFeatures): Record<string, number> {
  const scores: Record<string, number> = {};

  if (features.startingPitcher.homeAvailable && features.startingPitcher.awayAvailable) {
    const homeEra = features.startingPitcher.homeEra ?? 4.5;
    const awayEra = features.startingPitcher.awayEra ?? 4.5;
    const homeWhip = features.startingPitcher.homeWhip ?? 1.3;
    const awayWhip = features.startingPitcher.awayWhip ?? 1.3;
    const homeK = features.startingPitcher.homeKPer9 ?? 7.0;
    const awayK = features.startingPitcher.awayKPer9 ?? 7.0;

    const eraDiff = awayEra - homeEra;
    const whipDiff = awayWhip - homeWhip;
    const kDiff = homeK - awayK;
    scores.startingPitcher = eraDiff * 10 + whipDiff * 5 + kDiff * 2;
  } else {
    scores.startingPitcher = 0;
  }

  if (features.offense.homeOps != null && features.offense.awayOps != null) {
    scores.opponentBatting = features.offense.homeOps - features.offense.awayOps;
  }

  if (features.startingPitcher.homeAvailable && features.startingPitcher.awayAvailable) {
    scores.bullpen = 0;
  }

  scores.homePark = features.context.homeAdvantage ? 0.2 : -0.2;
  scores.restTravel = 0;
  scores.weatherRoof = features.context.weatherAvailable ? 0.1 : 0;
  scores.injuriesLineup = 0;

  return scores;
}

function renormalize(
  raw: Record<string, number>,
  availableGroups: Array<keyof ExploratoryScoreConfig['weights']>,
  totalWeight: number,
  config: ExploratoryScoreConfig,
): Record<string, number> {
  const result: Record<string, number> = {};
  const availableTotal = availableGroups.reduce((sum, group) => sum + (config.weights[group] ?? 0), 0);

  if (availableTotal === 0) {
    for (const group of availableGroups) {
      result[group] = raw[group] ?? 0;
    }
    return result;
  }

  const inv = totalWeight / availableTotal;
  for (const group of availableGroups) {
    const weight = config.weights[group] ?? 0;
    result[group] = (raw[group] ?? 0) * weight * inv;
  }
  return result;
}
