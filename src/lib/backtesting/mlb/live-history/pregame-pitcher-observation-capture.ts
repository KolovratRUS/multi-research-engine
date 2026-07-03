import type {
  PregamePitcherObservationWriter,
  AppendObservationResult,
} from './pregame-pitcher-observation-store';
import type { CanonicalHistoricalScheduleGame } from './types';

export interface PregamePitcherCaptureResult {
  readonly enabled: true;
  readonly observationsConsidered: number;
  readonly observationsWritten: number;
  readonly exactDuplicatesSkipped: number;
  readonly retrospectiveWritesBlocked: number;
  readonly corruptRecords: number;
  readonly warnings: readonly string[];
}

export async function capturePregamePitcherObservations(params: {
  readonly writer: PregamePitcherObservationWriter;
  readonly games: readonly CanonicalHistoricalScheduleGame[];
  readonly sourceEndpoint: string;
  readonly sourceRequestParameters: Record<string, unknown>;
}): Promise<PregamePitcherCaptureResult> {
  const observations = params.games.map((game) => ({
    gamePk: game.gamePk,
    scheduledStart: game.scheduledStart,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    homeProbablePitcherId: game.homeProbablePitcherId,
    awayProbablePitcherId: game.awayProbablePitcherId,
    warnings: [...game.warnings],
  }));

  const writerResult =
    observations.length > 0
      ? await params.writer.recordProspectivePitcherObservations({
          games: observations,
          context: 'PROSPECTIVE_LIVE',
          sourceEndpoint: params.sourceEndpoint,
          sourceRequestParameters: params.sourceRequestParameters,
        })
      : {
          observationsConsidered: 0,
          observationsWritten: 0,
          exactDuplicatesSkipped: 0,
          retrospectiveWritesBlocked: 0,
          corruptRecords: 0,
          eligibleSelectionHits: 0,
          eligibleSelectionMisses: 0,
          warnings: [] as readonly string[],
        };

  const warnings: string[] = [];
  for (const game of params.games) {
    warnings.push(...game.warnings);
  }
  for (const warning of writerResult.warnings) {
    warnings.push(warning);
  }

  return {
    enabled: true,
    observationsConsidered: writerResult.observationsConsidered,
    observationsWritten: writerResult.observationsWritten,
    exactDuplicatesSkipped: writerResult.exactDuplicatesSkipped,
    retrospectiveWritesBlocked: writerResult.retrospectiveWritesBlocked,
    corruptRecords: writerResult.corruptRecords,
    warnings,
  };
}
