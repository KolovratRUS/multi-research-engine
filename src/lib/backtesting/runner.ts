import type { BacktestRunnerResult, HistoricalMLBGame, MLBHistoricalDataProvider, NaiveBaselineContext, BacktestPrediction } from './types';
import type { PitcherAssignment } from '@/lib/research-data/types';
import { buildHistoricalSnapshot } from './mlb/snapshot-builder';
import { computeExploratoryScore } from './mlb/exploratory-scorer';
import { computeTeamOnlyScore, TEAM_ONLY_SCORE_VERSION } from './mlb/team-only-scorer';
import { assertNotFutureLeakage } from './leakage-guards';
import { computeBacktestMetrics } from './metrics';

export interface RunnerContext {
  provider: MLBHistoricalDataProvider;
  deterministicTime: Date;
  featureVersion: string;
  modelVersion: string;
  naiveBaselineContext: NaiveBaselineContext;
  researchConstruction?: 'FULL' | 'TEAM_ONLY' | 'BOTH';
  onSnapshotBuilt?: (game: HistoricalMLBGame) => void;
  onPredictionCreated?: (prediction: Readonly<BacktestPrediction>) => void;
}

function buildScorePrediction(
  game: HistoricalMLBGame,
  cutoff: Date,
  scoreResult: {
    readonly predictedSide: 'HOME' | 'AWAY' | null;
    readonly researchStrengthScore: number;
    readonly confidence: number;
    readonly dataQuality: number;
    readonly volatility: 'LOW' | 'MEDIUM' | 'HIGH';
    readonly componentScores: Record<string, number>;
    readonly warnings: string[];
    readonly abstained: boolean;
    readonly abstentionReason?: string;
    readonly version: string;
  },
  context: RunnerContext,
  researchConstructionMode: 'FULL' | 'TEAM_ONLY',
  pitcherAssignments: { readonly home: PitcherAssignment | null; readonly away: PitcherAssignment | null },
): BacktestPrediction {
  const modelVersion =
    researchConstructionMode === 'TEAM_ONLY'
      ? TEAM_ONLY_SCORE_VERSION
      : context.modelVersion;

  const evidenceDomains =
    researchConstructionMode === 'TEAM_ONLY'
      ? {
          includedEvidenceDomains: ['team-offense', 'home-park', 'rest-travel'] as readonly string[],
          excludedEvidenceDomains: [
            'starting-pitcher',
            'opponent-batting',
            'bullpen',
            'offense-lineup',
            'injuries-lineup',
            'weather-roof',
          ] as readonly string[],
        }
      : {
          includedEvidenceDomains: [] as readonly string[],
          excludedEvidenceDomains: [] as readonly string[],
        };

  return Object.freeze({
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
    modelVersion,
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
    researchConstructionMode,
    researchModelVersion: modelVersion,
    ...evidenceDomains,
  });
}

export async function runHistoricalBacktest(
  games: HistoricalMLBGame[],
  context: RunnerContext,
): Promise<BacktestRunnerResult> {
  const predictions: BacktestPrediction[] = [];
  const abstentions: BacktestPrediction[] = [];

  const activeModes: Array<'FULL' | 'TEAM_ONLY'> = (() => {
    const mode = context.researchConstruction ?? 'FULL';
    if (mode === 'BOTH') return ['FULL', 'TEAM_ONLY'];
    return [mode];
  })();

  for (const game of games) {
    const cutoff = game.cutoff.cutoffTime;
    assertNotFutureLeakage(new Date(0), cutoff, 'game discovery');

    if (game.status !== 'FINAL') {
      for (const mode of activeModes) {
        const ineligible = buildScorePrediction(
          game,
          cutoff,
          {
            predictedSide: null,
            researchStrengthScore: 0,
            confidence: 0,
            dataQuality: 0,
            volatility: 'HIGH',
            componentScores: {},
            warnings: [`Game ${game.status.toLowerCase()}, skipped before prediction`],
            abstained: true,
            abstentionReason: 'GAME_NOT_ELIGIBLE',
            version: context.featureVersion,
          },
          context,
          mode,
          { home: null, away: null },
        );
        abstentions.push(ineligible);
      }
      continue;
    }

    const pitcherAssignments = game.probablePitchers ?? { home: null, away: null };
    const requiresPitchers = activeModes.some((m) => m === 'FULL');
    const homePitcherProfile = requiresPitchers && pitcherAssignments.home?.availability === 'AVAILABLE'
      ? await context.provider.fetchPitcherStatsAsOf(pitcherAssignments.home.personId, cutoff)
      : null;
    const awayPitcherProfile = requiresPitchers && pitcherAssignments.away?.availability === 'AVAILABLE'
      ? await context.provider.fetchPitcherStatsAsOf(pitcherAssignments.away.personId, cutoff)
      : null;

    const homeTeamProfile = await context.provider.fetchTeamStatsAsOf(game.homeTeamId, cutoff);
    const awayTeamProfile = await context.provider.fetchTeamStatsAsOf(game.awayTeamId, cutoff);

    const homeRecentGames = await context.provider.fetchRecentGamesBefore(game.homeTeamId, cutoff, 10);
    const awayRecentGames = await context.provider.fetchRecentGamesBefore(game.awayTeamId, cutoff, 10);

    const warnings: string[] = [];
    if (requiresPitchers) {
      if (!pitcherAssignments.home) warnings.push('Missing home probable pitcher');
      if (!pitcherAssignments.away) warnings.push('Missing away probable pitcher');
    }
    if (!homeTeamProfile) warnings.push('Missing home team profile');
    if (!awayTeamProfile) warnings.push('Missing away team profile');

    const pitcherProfiles = {
      home: requiresPitchers && pitcherAssignments.home?.availability === 'AVAILABLE' ? homePitcherProfile : null,
      away: requiresPitchers && pitcherAssignments.away?.availability === 'AVAILABLE' ? awayPitcherProfile : null,
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

    for (const mode of activeModes) {
      const scoreResult =
        mode === 'TEAM_ONLY'
          ? computeTeamOnlyScore(snapshot)
          : computeExploratoryScore(snapshot);

      const prediction = buildScorePrediction(
        game,
        cutoff,
        {
          predictedSide: scoreResult.predictedSide,
          researchStrengthScore: scoreResult.researchStrengthScore,
          confidence: scoreResult.confidence,
          dataQuality: scoreResult.dataQuality,
          volatility: scoreResult.volatility,
          componentScores: scoreResult.componentScores,
          warnings: scoreResult.warnings,
          abstained: scoreResult.abstained,
          abstentionReason: scoreResult.abstentionReason,
          version: scoreResult.version,
        },
        context,
        mode,
        pitcherAssignments,
      );

      if (prediction.abstained) {
        abstentions.push(prediction);
      } else {
        predictions.push(prediction);
        context.onPredictionCreated?.(prediction);
      }
    }
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