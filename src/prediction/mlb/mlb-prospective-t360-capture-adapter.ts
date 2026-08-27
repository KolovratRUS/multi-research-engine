import {
  MLB_PROSPECTIVE_HOLDOUT_SCI_CUTOFF_MINUTES,
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
} from './mlb-prospective-holdout-protocol-contract';
import {
  MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
  MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
  runProspectiveT360Capture,
  type MLBProspectiveT360CaptureRequest,
  type MLBProspectiveT360ClockReader,
  type MLBProspectiveT360CaptureResult,
} from './mlb-prospective-t360-capture-contract';
import type { MLBCanonicalPregameSnapshot } from './mlb-pregame-snapshot-contract';

export type MLBProspectiveT360CaptureAdapterInput = Readonly<{
  gameId: string;
  scheduledStartAt: string;
  builder: (request: MLBProspectiveT360CaptureRequest) => MLBCanonicalPregameSnapshot;
  clock: MLBProspectiveT360ClockReader;
}>;

/**
 * Adapter that enforces T-360 scientific cutoff before invoking an injected
 * prospective capture builder.
 *
 * This adapter:
 * 1. Computes scientificCutoffAt = scheduledStartAt - 360 minutes.
 * 2. Rejects capture attempts started after the scientific cutoff.
 * 3. Invokes the injected builder exactly once if pre-cutoff.
 * 4. Validates the returned snapshot using authoritative snapshot validation.
 * 5. Enforces that actual dataCutoffAt <= scientificCutoffAt.
 * 6. Enforces that all model-information source timestamps <= scientificCutoffAt.
 * 7. Leaves raw snapshot evidence untouched.
 * 8. Returns a strongly typed evidence object on success.
 *
 * No live-network capability. No protocol redefinition.
 */
export function buildProspectiveT360CaptureAdapter(
  input: MLBProspectiveT360CaptureAdapterInput,
): MLBProspectiveT360CaptureResult {
  const request: MLBProspectiveT360CaptureRequest = {
    gameId: input.gameId,
    scheduledStartAt: input.scheduledStartAt,
  };

  return runProspectiveT360Capture(request, input.builder, input.clock);
}
