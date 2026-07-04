import type { BacktestPrediction, BacktestMetrics, NaiveBaselineContext, ModeMetrics, ConstructionComparison, ConstructionComparisonAgreement, ResearchConstructionReport } from './types';

export function computeBacktestMetrics(
  predictions: BacktestPrediction[],
  naiveContext?: NaiveBaselineContext,
): BacktestMetrics {
  const made = predictions.filter((p) => !p.abstained && !p.voided);
  const skipped = predictions.filter((p) => p.abstained).length;
  const voids = predictions.filter((p) => p.voided && !p.abstained).length;
  const correct = made.filter((p) => p.correct === true).length;
  const total = made.length;

  const accuracy = total === 0 ? 0 : correct / total;
  const homePickRate = total === 0 ? 0 : made.filter((p) => p.predictedSide === 'HOME').length / total;
  const awayPickRate = total === 0 ? 0 : made.filter((p) => p.predictedSide === 'AWAY').length / total;

  const bucket = (
    items: BacktestPrediction[],
    keyFn: (p: BacktestPrediction) => string,
  ): Record<string, { predictions: number; correct: number; accuracy: number }> => {
    const map = new Map<string, { predictions: number; correct: number }>();
    for (const item of items) {
      const key = keyFn(item);
      const current = map.get(key) ?? { predictions: 0, correct: 0 };
      current.predictions += 1;
      if (item.correct) current.correct += 1;
      map.set(key, current);
    }
    const result: Record<string, { predictions: number; correct: number; accuracy: number }> = {};
    for (const [key, value] of map) {
      result[key] = { ...value, accuracy: value.predictions === 0 ? 0 : value.correct / value.predictions };
    }
    return result;
  };

  const confidenceBucket = (p: BacktestPrediction) => {
    if (p.confidence >= 80) return '80-100';
    if (p.confidence >= 60) return '60-79';
    return '0-59';
  };
  const qualityBucket = (p: BacktestPrediction) => {
    if (p.dataQuality >= 80) return '80-100';
    if (p.dataQuality >= 60) return '60-79';
    return '0-59';
  };
  const volatilityBucket = (p: BacktestPrediction) => p.volatility;

  const monthKey = (p: BacktestPrediction) => p.eventDate.slice(0, 7);

  const accuracyByConfidenceBucket = bucket(made, confidenceBucket);
  const accuracyByDataQualityBucket = bucket(made, qualityBucket);
  const accuracyByVolatilityBucket = bucket(made, volatilityBucket);
  const accuracyByMonth = bucket(made, monthKey);

  const withBothPitchers = made.filter((p) => p.homePitcherAvailable && p.awayPitcherAvailable);
  const accuracyWithBothPitchersKnown =
    withBothPitchers.length === 0 ? null : withBothPitchers.filter((p) => p.correct).length / withBothPitchers.length;

  const withMissingPitcher = made.filter((p) => !p.homePitcherAvailable || !p.awayPitcherAvailable);
  const accuracyWithMissingPitcher =
    withMissingPitcher.length === 0 ? null : withMissingPitcher.filter((p) => p.correct).length / withMissingPitcher.length;

  let naiveHomeBaseline: number | null = null;
  let naiveRecentBaseline: number | null = null;
  let naiveSeasonBaseline: number | null = null;
  if (naiveContext) {
    const naiveHomePredictions = made.map((p) => ({
      ...p,
      predictedSide: 'HOME',
      correct: null as boolean | null,
    }));
    const homeCorrect = naiveHomePredictions.filter((p) => {
      const winner = p.actualWinner;
      return winner === 'HOME';
    }).length;
    naiveHomeBaseline = total === 0 ? null : homeCorrect / total;

    const naiveRecentPredictions = made.map((p) => ({
      ...p,
      predictedSide:
        (naiveContext.recentWinRates[p.homeTeamId] ?? 0) >= (naiveContext.recentWinRates[p.awayTeamId] ?? 0)
          ? 'HOME'
          : 'AWAY',
      correct: null as boolean | null,
    }));
    const recentCorrect = naiveRecentPredictions.filter((p) => {
      const winner = p.actualWinner;
      return (p.predictedSide === 'HOME' && winner === 'HOME') || (p.predictedSide === 'AWAY' && winner === 'AWAY');
    }).length;
    naiveRecentBaseline = total === 0 ? null : recentCorrect / total;

    const naiveSeasonPredictions = made.map((p) => ({
      ...p,
      predictedSide:
        (naiveContext.seasonWinRates[p.homeTeamId] ?? 0) >= (naiveContext.seasonWinRates[p.awayTeamId] ?? 0)
          ? 'HOME'
          : 'AWAY',
      correct: null as boolean | null,
    }));
    const seasonCorrect = naiveSeasonPredictions.filter((p) => {
      const winner = p.actualWinner;
      return (p.predictedSide === 'HOME' && winner === 'HOME') || (p.predictedSide === 'AWAY' && winner === 'AWAY');
    }).length;
    naiveSeasonBaseline = total === 0 ? null : seasonCorrect / total;
  }

  return {
    predictionsMade: made.length,
    gamesSkipped: skipped,
    voids,
    accuracy,
    homePickRate,
    awayPickRate,
    accuracyByConfidenceBucket: accuracyByConfidenceBucket,
    accuracyByDataQualityBucket: accuracyByDataQualityBucket,
    accuracyByVolatilityBucket: accuracyByVolatilityBucket,
    accuracyWithBothPitchersKnown,
    accuracyWithMissingPitcher,
    accuracyByMonth: accuracyByMonth,
    naiveHomeBaseline,
    naiveRecentBaseline,
    naiveSeasonBaseline,
  };
}

function average(
  items: BacktestPrediction[],
  valueFn: (p: BacktestPrediction) => number,
): number | null {
  if (items.length === 0) return null;
  return items.reduce((sum, p) => sum + valueFn(p), 0) / items.length;
}

export function computeModeMetrics(
  predictions: readonly BacktestPrediction[],
  abstentions: readonly BacktestPrediction[],
  mode: 'FULL' | 'TEAM_ONLY',
  naiveContext?: NaiveBaselineContext,
): ModeMetrics;
export function computeModeMetrics(
  predictions: readonly BacktestPrediction[],
  abstentions: readonly BacktestPrediction[],
  mode: 'FULL' | 'TEAM_ONLY',
  naiveContext?: NaiveBaselineContext,
): ModeMetrics {
  const modePredictions = predictions.filter((p) => p.researchConstructionMode === mode);
  const modeAbstentions = abstentions.filter((p) => p.researchConstructionMode === mode);
  const metrics = computeBacktestMetrics(modePredictions, naiveContext);

  return {
    predictionsMade: metrics.predictionsMade,
    abstentions: modeAbstentions.length,
    voids: metrics.voids,
    accuracy: metrics.predictionsMade > 0 ? metrics.accuracy : null,
    homePickRate: metrics.predictionsMade > 0 ? metrics.homePickRate : null,
    awayPickRate: metrics.predictionsMade > 0 ? metrics.awayPickRate : null,
    averageDataQuality: average(modePredictions, (p) => p.dataQuality),
    averageConfidence: average(modePredictions, (p) => p.confidence),
    accuracyWithBothPitchersKnown: metrics.accuracyWithBothPitchersKnown,
    accuracyWithMissingPitcher: metrics.accuracyWithMissingPitcher,
  };
}

export function computeConstructionComparison(
  predictions: readonly BacktestPrediction[],
  abstentions: readonly BacktestPrediction[],
  naiveContext?: NaiveBaselineContext,
): ConstructionComparison {
  const full = computeModeMetrics(predictions, abstentions, 'FULL', naiveContext);
  const teamOnly = computeModeMetrics(predictions, abstentions, 'TEAM_ONLY', naiveContext);

  const byGamePk = new Map<number, { full?: 'HOME' | 'AWAY' | null; teamOnly?: 'HOME' | 'AWAY' | null }>();
  for (const p of predictions) {
    if (p.abstained) continue;
    const entry = byGamePk.get(p.gamePk) ?? {};
    if (p.researchConstructionMode === 'FULL') {
      entry.full = p.predictedSide;
    } else if (p.researchConstructionMode === 'TEAM_ONLY') {
      entry.teamOnly = p.predictedSide;
    }
    byGamePk.set(p.gamePk, entry);
  }

  let overlappingGamePks = 0;
  let agreements = 0;
  for (const entry of byGamePk.values()) {
    if (entry.full !== undefined && entry.teamOnly !== undefined && entry.full !== null && entry.teamOnly !== null) {
      overlappingGamePks += 1;
      if (entry.full === entry.teamOnly) {
        agreements += 1;
      }
    }
  }

  return {
    full,
    teamOnly,
    agreement: {
      overlappingGamePks,
      agreements,
      agreementRate: overlappingGamePks > 0 ? agreements / overlappingGamePks : null,
    },
  };
}

export function computeResearchConstructionReport(
  predictions: readonly BacktestPrediction[],
  abstentions: readonly BacktestPrediction[],
  options?: {
    generatedAtSource?: string;
    totalGames?: number;
  },
): ResearchConstructionReport {
  const all = [...predictions, ...abstentions];
  const generatedAtSource = options?.generatedAtSource ?? 'unknown';
  const totalGames = options?.totalGames ?? new Set(all.map((p) => p.gamePk)).size;

  const counts = new Map<string, number>();
  for (const p of all) {
    const key = `${p.gamePk}:${p.researchConstructionMode}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const duplicates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key)
    .sort();
  if (duplicates.length > 0) {
    throw new Error(`Duplicate research constructions detected: ${duplicates.join(', ')}`);
  }

  const full = {
    attempts: 0,
    produced: 0,
    abstained: 0,
    scoreSum: 0,
    confidenceSum: 0,
    dataQualitySum: 0,
    warnings: 0,
    volatility: { LOW: 0, MEDIUM: 0, HIGH: 0 } as Record<'LOW' | 'MEDIUM' | 'HIGH', number>,
  };

  const teamOnly = {
    attempts: 0,
    produced: 0,
    abstained: 0,
    scoreSum: 0,
    confidenceSum: 0,
    dataQualitySum: 0,
    warnings: 0,
    volatility: { LOW: 0, MEDIUM: 0, HIGH: 0 } as Record<'LOW' | 'MEDIUM' | 'HIGH', number>,
  };

  const fullProducedMap = new Map<number, BacktestPrediction>();
  const teamOnlyProducedMap = new Map<number, BacktestPrediction>();
  const fullAbstainedSet = new Set<number>();
  const teamOnlyAbstainedSet = new Set<number>();

  for (const p of all) {
    const mode = p.researchConstructionMode;
    const bucket = mode === 'FULL' ? full : teamOnly;
    bucket.attempts++;
    if (p.abstained) {
      bucket.abstained++;
      if (mode === 'FULL') {
        fullAbstainedSet.add(p.gamePk);
      } else {
        teamOnlyAbstainedSet.add(p.gamePk);
      }
    } else {
      bucket.produced++;
      bucket.scoreSum += p.researchStrengthScore;
      bucket.confidenceSum += p.confidence;
      bucket.dataQualitySum += p.dataQuality;
      bucket.volatility[p.volatility] = (bucket.volatility[p.volatility] ?? 0) + 1;
      if (mode === 'FULL') {
        fullProducedMap.set(p.gamePk, p);
      } else {
        teamOnlyProducedMap.set(p.gamePk, p);
      }
    }
    bucket.warnings += p.warnings.length;
  }

  let bothProduced = 0;
  let fullOnlyProduced = 0;
  let teamOnlyOnlyProduced = 0;
  let bothAbstained = 0;
  let sameSide = 0;
  let differentSide = 0;

  const allGamePks = new Set([
    ...fullProducedMap.keys(),
    ...teamOnlyProducedMap.keys(),
    ...fullAbstainedSet,
    ...teamOnlyAbstainedSet,
  ]);

  for (const gamePk of allGamePks) {
    const fullProduced = fullProducedMap.get(gamePk);
    const teamOnlyProduced = teamOnlyProducedMap.get(gamePk);
    const fullAbstained = fullAbstainedSet.has(gamePk);
    const teamOnlyAbstained = teamOnlyAbstainedSet.has(gamePk);

    if (fullProduced && teamOnlyProduced) {
      bothProduced++;
      if (fullProduced.predictedSide !== null && teamOnlyProduced.predictedSide !== null) {
        if (fullProduced.predictedSide === teamOnlyProduced.predictedSide) {
          sameSide++;
        } else {
          differentSide++;
        }
      }
    } else if (fullProduced && !fullAbstained && !teamOnlyProduced && !teamOnlyAbstained) {
      fullOnlyProduced++;
    } else if (fullProduced && teamOnlyAbstained && !teamOnlyProduced) {
      fullOnlyProduced++;
    } else if (teamOnlyProduced && !fullProduced && !fullAbstained && !teamOnlyAbstained) {
      teamOnlyOnlyProduced++;
    } else if (teamOnlyProduced && fullAbstained && !fullProduced) {
      teamOnlyOnlyProduced++;
    } else if (fullAbstained && teamOnlyAbstained) {
      bothAbstained++;
    }
  }

  const avg = (produced: number, sum: number) => (produced > 0 ? sum / produced : null);

  return {
    totalGames,
    generatedAtSource,
    full: { attempts: full.attempts, produced: full.produced, abstained: full.abstained },
    teamOnly: { attempts: teamOnly.attempts, produced: teamOnly.produced, abstained: teamOnly.abstained },
    paired: {
      bothProduced,
      fullOnlyProduced,
      teamOnlyOnlyProduced,
      bothAbstained,
      sameSide,
      differentSide,
    },
    scoreComparison: {
      full: {
        averageResearchStrengthScore: avg(full.produced, full.scoreSum),
        averageConfidence: avg(full.produced, full.confidenceSum),
        averageDataQuality: avg(full.produced, full.dataQualitySum),
      },
      teamOnly: {
        averageResearchStrengthScore: avg(teamOnly.produced, teamOnly.scoreSum),
        averageConfidence: avg(teamOnly.produced, teamOnly.confidenceSum),
        averageDataQuality: avg(teamOnly.produced, teamOnly.dataQualitySum),
      },
    },
    volatilityCounts: {
      full: { ...full.volatility } as { LOW: number; MEDIUM: number; HIGH: number },
      teamOnly: { ...teamOnly.volatility } as { LOW: number; MEDIUM: number; HIGH: number },
    },
    warningCounts: {
      total: full.warnings + teamOnly.warnings,
      full: full.warnings,
      teamOnly: teamOnly.warnings,
    },
  };
}
