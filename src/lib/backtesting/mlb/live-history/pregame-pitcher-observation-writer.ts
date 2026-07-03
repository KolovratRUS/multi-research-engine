import type {
  PregamePitcherObservationContext,
  PregamePitcherObservationStore,
  PregamePitcherObservationWriter,
  AppendObservationResult,
  PregamePitcherObservationProvenance,
} from './pregame-pitcher-observation-store';
import { buildObservationResponseHash, isPlainRecord, canonicalize } from './pregame-pitcher-observation-store';

interface GameObservationInput {
  readonly gamePk: number;
  readonly scheduledStart: Date;
  readonly homeTeamId: number;
  readonly awayTeamId: number;
  readonly homeProbablePitcherId: number | null;
  readonly awayProbablePitcherId: number | null;
  readonly warnings: readonly string[];
}

export function createPregamePitcherObservationWriter(
  options: {
    readonly store: PregamePitcherObservationStore;
    readonly now?: () => Date;
  },
): PregamePitcherObservationWriter {
  const store = options.store;
  const now = options.now ?? (() => new Date());

  return {
    async recordProspectivePitcherObservations({
      games,
      context,
      sourceEndpoint,
      sourceRequestParameters,
    }: {
      readonly games: readonly GameObservationInput[];
      readonly context: PregamePitcherObservationContext;
      readonly sourceEndpoint: string;
      readonly sourceRequestParameters: unknown;
    }): Promise<AppendObservationResult> {
      if (context !== 'PROSPECTIVE_LIVE') {
        return {
          observationsConsidered: games.length,
          observationsWritten: 0,
          exactDuplicatesSkipped: 0,
          retrospectiveWritesBlocked: games.length,
          corruptRecords: 0,
          eligibleSelectionHits: 0,
          eligibleSelectionMisses: 0,
          warnings: [],
        };
      }

      const observedAt = now();

      if (
        !(observedAt instanceof Date) ||
        Number.isNaN(observedAt.getTime())
      ) {
        return {
          observationsConsidered: games.length,
          observationsWritten: 0,
          exactDuplicatesSkipped: 0,
          retrospectiveWritesBlocked: 0,
          corruptRecords: games.length,
          eligibleSelectionHits: 0,
          eligibleSelectionMisses: 0,
          warnings: [],
        };
      }

      const endpoint = sourceEndpoint ?? '/api/v1/schedule';
      const sanitized = sanitizeRequestParameters(sourceRequestParameters);
      let observationsWritten = 0;
      let exactDuplicatesSkipped = 0;
      let corruptRecords = 0;
      const warnings: string[] = [];

      for (const game of games) {
        if (
          !Number.isFinite(game.gamePk) ||
          game.gamePk <= 0 ||
          !(game.scheduledStart instanceof Date) ||
          Number.isNaN(game.scheduledStart.getTime()) ||
          !Number.isFinite(game.homeTeamId) ||
          !Number.isFinite(game.awayTeamId) ||
          (game.homeProbablePitcherId !== null &&
            (!Number.isFinite(game.homeProbablePitcherId) || game.homeProbablePitcherId <= 0)) ||
          (game.awayProbablePitcherId !== null &&
            (!Number.isFinite(game.awayProbablePitcherId) || game.awayProbablePitcherId <= 0))
        ) {
          corruptRecords += 1;
          continue;
        }

        const provenance: PregamePitcherObservationProvenance = 'SCHEDULE_PROBABLE_OBSERVED_AT';
        const sourceResponseHash = buildObservationResponseHash({
          gamePk: game.gamePk,
          scheduledStart: game.scheduledStart,
          homeTeamId: game.homeTeamId,
          awayTeamId: game.awayTeamId,
          homeProbablePitcherId: game.homeProbablePitcherId,
          awayProbablePitcherId: game.awayProbablePitcherId,
          sourceEndpoint: endpoint,
          sourceRequestParameters: sanitized,
          observationContext: context,
          provenance,
        });

        const appendResult = await store.append({
          schemaVersion: 'phase1g-a-v1',
          sport: 'mlb',
          gamePk: game.gamePk,
          observedAt: new Date(observedAt.getTime()),
          scheduledStart: game.scheduledStart,
          homeProbablePitcherId: game.homeProbablePitcherId,
          awayProbablePitcherId: game.awayProbablePitcherId,
          homeTeamId: game.homeTeamId,
          awayTeamId: game.awayTeamId,
          sourceEndpoint: endpoint,
          sourceRequestParameters: sanitized,
          sourceResponseHash,
          observationContext: context,
          provenance,
          warnings: [...game.warnings],
        });
        observationsWritten += appendResult.observationsWritten;
        exactDuplicatesSkipped += appendResult.exactDuplicatesSkipped;
        corruptRecords += appendResult.corruptRecords;
        warnings.push(...appendResult.warnings);
      }

      return {
        observationsConsidered: games.length,
        observationsWritten,
        exactDuplicatesSkipped,
        retrospectiveWritesBlocked: 0,
        corruptRecords,
        eligibleSelectionHits: 0,
        eligibleSelectionMisses: 0,
        warnings,
      };
    },
  };
}

function sanitizeRequestParameters(params: unknown): Record<string, unknown> {
  if (!isPlainRecord(params)) {
    throw new Error('sourceRequestParameters must be a plain object');
  }
  const sanitized: Record<string, unknown> = {};
  const sensitive = new Set([
    'authorization',
    'cookie',
    'credentials',
    'token',
    'api_key',
    'apikey',
    'secret',
  ]);
  for (const key of Object.keys(params)) {
    if (sensitive.has(key.toLowerCase())) continue;
    const value = params[key];
    if (
      value === undefined ||
      typeof value === 'function' ||
      typeof value === 'symbol' ||
      typeof value === 'bigint' ||
      (typeof value === 'number' && !Number.isFinite(value))
    ) {
      throw new Error('unsupported request parameter value');
    }
    sanitized[key] = canonicalize(value);
  }
  return sanitized;
}
