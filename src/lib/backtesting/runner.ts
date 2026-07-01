import type { BacktestRunnerResult, HistoricalMLBGame, MLBHistoricalDataProvider, NaiveBaselineContext, BacktestPrediction } from './types';
import type { PitcherAssignment } from '@/lib/research-data/types';
import { buildHistoricalSnapshot } from './mlb/snapshot-builder';
import { computeExploratoryScore } from './mlb/exploratory-scorer';
import { assertNotFutureLeakage } from './leakage-guards';
import { computeBacktestMetrics } from './metrics';

export interface RunnerContext {
  provider: MLBHistoricalDataProvider;
  deterministicTime: Date;
  featureVersion: string;
  modelVersion: string;
  naiveBaselineContext: NaiveBaselineContext;
  onSnapshotBuilt?: (game: HistoricalMLBGame) => void;
  onPredictionCreated?: (prediction: Readonly<BacktestPrediction>) => void;
}

export async function runHistoricalBacktest(
  games: HistoricalMLBGame[],
  context: RunnerContext,
): Promise<BacktestRunnerResult> {
  const predictions: BacktestPrediction[] = [];
  const abstentions: BacktestPrediction[] = [];

  for (const game of games) {
    const cutoff = game.cutoff.cutoffTime;
    assertNotFutureLeakage(new Date(0), cutoff, 'game discovery');

    if (game.status !== 'FINAL') {
      const ineligible: BacktestPrediction = Object.freeze({
        eventId: game.cutoff.eventId,
        gamePk: game.gamePk,
        eventDate: game.officialDate,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        homeTeam: game.homeTeamName,
        awayTeam: game.awayTeamName,
        predictedSide: null,
        researchStrengthScore: 0,
        confidence: 0,
        dataQuality: 0,
        volatility: 'HIGH',
        componentScores: {},
        warnings: [`Game ${game.status.toLowerCase()}, skipped before prediction`],
        modelVersion: context.modelVersion,
        featureVersion: context.featureVersion,
        generatedAt: context.deterministicTime,
        historicalCutoffTime: cutoff,
        actualWinner: null,
        correct: null,
        voided: false,
        abstained: true,
        abstentionReason: 'GAME_NOT_ELIGIBLE',
        homePitcherAvailable: game.probablePitchers?.home?.availability === 'AVAILABLE',
        awayPitcherAvailable: game.probablePitchers?.away?.availability === 'AVAILABLE',
      });
      abstentions.push(ineligible);
      continue;
    }

    const pitcherAssignments = game.probablePitchers ?? { home: null, away: null };
    const homePitcherProfile = pitcherAssignments.home?.availability === 'AVAILABLE'
      ? await context.provider.fetchPitcherStatsAsOf(pitcherAssignments.home.personId, cutoff)
      : null;
    const awayPitcherProfile = pitcherAssignments.away?.availability === 'AVAILABLE'
      ? await context.provider.fetchPitcherStatsAsOf(pitcherAssignments.away.personId, cutoff)
      : null;

    const homeTeamProfile = await context.provider.fetchTeamStatsAsOf(game.homeTeamId, cutoff);
    const awayTeamProfile = await context.provider.fetchTeamStatsAsOf(game.awayTeamId, cutoff);

    const homeRecentGames = await context.provider.fetchRecentGamesBefore(game.homeTeamId, cutoff, 10);
    const awayRecentGames = await context.provider.fetchRecentGamesBefore(game.awayTeamId, cutoff, 10);

    const warnings: string[] = [];
    if (!pitcherAssignments.home) warnings.push('Missing home probable pitcher');
    if (!pitcherAssignments.away) warnings.push('Missing away probable pitcher');
    if (!homeTeamProfile) warnings.push('Missing home team profile');
    if (!awayTeamProfile) warnings.push('Missing away team profile');

    const pitcherProfiles = {
      home: pitcherAssignments.home?.availability === 'AVAILABLE' ? homePitcherProfile : null,
      away: pitcherAssignments.away?.availability === 'AVAILABLE' ? awayPitcherProfile : null,
    };
    const teamProfiles = { home: homeTeamProfile, away: awayTeamProfile };
    const recentGames = { home: homeRecentGames, away: awayRecentGames };

    context.onSnapshotBuilt?.(game);

    const snapshot = buildHistoricalSnapshot(
      game,
      cutoff,
      pitcherProfiles,
      teamProfiles,
      recentGames,
      context.deterministicTime,
      context.featureVersion,
      warnings,
      Math.min(100, Math.round((warnings.length === 0 ? 100 : 100 - warnings.length * 10))),
    );

    const scoreResult = computeExploratoryScore(snapshot);

    const prediction: BacktestPrediction = Object.freeze({
      eventId: game.cutoff.eventId,
      gamePk: game.gamePk,
      eventDate: game.officialDate,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      homeTeam: game.homeTeamName,
      awayTeam: game.awayTeamName,
      predictedSide: scoreResult.predictedSide,
      researchStrengthScore: scoreResult.researchStrengthScore,
      confidence: scoreResult.confidence,
      dataQuality: scoreResult.dataQuality,
      volatility: scoreResult.volatility,
      componentScores: scoreResult.componentScores,
      warnings: scoreResult.warnings,
      modelVersion: context.modelVersion,
      featureVersion: scoreResult.version,
      generatedAt: context.deterministicTime,
      historicalCutoffTime: cutoff,
      actualWinner: null,
      correct: null,
      voided: false,
      abstained: scoreResult.abstained,
      abstentionReason: scoreResult.abstentionReason,
      homePitcherAvailable: pitcherAssignments.home?.availability === 'AVAILABLE',
      awayPitcherAvailable: pitcherAssignments.away?.availability === 'AVAILABLE',
    });

    if (scoreResult.abstained) {
      abstentions.push(prediction);
      continue;
    }

    predictions.push(prediction);
    context.onPredictionCreated?.(prediction);
  }

  for (const prediction of predictions) {
    if (prediction.voided) {
      continue;
    }

    const outcome = await context.provider.fetchGameOutcome(prediction.gamePk);
    const normalized = {
      winner: outcome.winner ?? (outcome.homeScore == null || outcome.awayScore == null ? null : outcome.homeScore > outcome.awayScore ? 'HOME' : outcome.awayScore > outcome.homeScore ? 'AWAY' : null),
      voided: false,
    };

    const finalPrediction: BacktestPrediction = {
      ...prediction,
      actualWinner: normalized.winner,
      correct: normalized.winner !== null && prediction.predictedSide === normalized.winner
        ? true
        : normalized.winner !== null && prediction.predictedSide !== normalized.winner
          ? false
          : null,
    };

    const index = predictions.indexOf(prediction);
    if (index >= 0) {
      predictions[index] = finalPrediction;
    }
  }

  return {
    predictions,
    abstentions,
    metrics: computeBacktestMetrics(predictions, context.naiveBaselineContext),
  };
}