import type { BacktestPrediction, BacktestMetrics, NaiveBaselineContext } from './types';

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
    accuracyWithBothPitchersKnown: accuracyWithBothPitchersKnown,
    accuracyWithMissingPitcher: accuracyWithMissingPitcher,
    accuracyByMonth: accuracyByMonth,
    naiveHomeBaseline,
    naiveRecentBaseline,
    naiveSeasonBaseline,
  };
}
