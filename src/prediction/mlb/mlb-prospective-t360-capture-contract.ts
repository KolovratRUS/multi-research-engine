import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
  MLB_PROSPECTIVE_HOLDOUT_SCI_CUTOFF_MINUTES,
} from './mlb-prospective-holdout-protocol-contract';
import {
  validateMLBCanonicalPregameSnapshot,
  type MLBCanonicalPregameSnapshot,
} from './mlb-pregame-snapshot-contract';
import {
  type MLBFeatureVector,
  type MLBFeatureExtractionIssue,
} from './mlb-feature-vector-contract';

/* -------------------------------------------------------------------------- */
/*  Contract versions                                                          */
/* -------------------------------------------------------------------------- */

export const MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION =
  'mlb-prospective-t360-capture-v1' as const;

export const MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1 =
  'mlb-v1-candidate-003-t360-capture-compatibility-v1' as const;

/* -------------------------------------------------------------------------- */
/*  Failure codes                                                              */
/* -------------------------------------------------------------------------- */

export const MLB_PROSPECTIVE_T360_CAPTURE_FAILURE_CODES = Object.freeze([
  'INVALID_CAPTURE_REQUEST',
  'CAPTURE_STARTED_AFTER_SCIENTIFIC_CUTOFF',
  'CAPTURE_BUILDER_FAILED',
  'INVALID_PREGAME_SNAPSHOT',
  'GAME_IDENTITY_MISMATCH',
  'ACTUAL_DATA_CUTOFF_AFTER_SCIENTIFIC_CUTOFF',
  'MODEL_SOURCE_TIMESTAMP_AFTER_SCIENTIFIC_CUTOFF',
  'MODEL_SOURCE_TIMESTAMP_UNPROVEN',
  'INVALID_FEATURE_VECTOR',
  'FEATURE_MANIFEST_MISMATCH',
  'STARTER_COMPATIBILITY_PROJECTION_FAILED',
] as const);

export type MLBProspectiveT360FailureCode =
  typeof MLB_PROSPECTIVE_T360_CAPTURE_FAILURE_CODES[number];

/* -------------------------------------------------------------------------- */
/*  T-360 capture request                                                      */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveT360ClockReader = () => string;

export type MLBProspectiveT360CaptureRequest = Readonly<{
  gameId: string;
  scheduledStartAt: string;
}>;

/* -------------------------------------------------------------------------- */
/*  T-360 capture result types                                                 */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveT360T360Validation = Readonly<{
  status: 'ACCEPTED';
  actualDataCutoffAtLteScientificCutoff: true;
  sourceTimestampsProvenLteScientificCutoff: true;
}>;

export type MLBProspectiveT360CaptureSuccess = Readonly<{
  ok: true;
  contractVersion: typeof MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION;
  compatibilityLayerId: typeof MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1;
  protocolId: typeof MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID;
  gameId: string;
  scheduledStartAt: string;
  scientificCutoffAt: string;
  actualDataCutoffAt: string;
  snapshot: MLBCanonicalPregameSnapshot;
  t360Validation: MLBProspectiveT360T360Validation;
}>;

export type MLBProspectiveT360CaptureFailure = Readonly<{
  ok: false;
  contractVersion: typeof MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION;
  compatibilityLayerId: typeof MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1;
  protocolId: typeof MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID;
  failureCode: MLBProspectiveT360FailureCode;
  message: string;
}>;

export type MLBProspectiveT360CaptureResult =
  | MLBProspectiveT360CaptureSuccess
  | MLBProspectiveT360CaptureFailure;

/* -------------------------------------------------------------------------- */
/*  Feature compatibility result types                                         */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveT360FeatureCompatibilitySuccess = Readonly<{
  ok: true;
  value: MLBFeatureVector;
}>;

export type MLBProspectiveT360FeatureCompatibilityFailure = Readonly<{
  ok: false;
  contractVersion: typeof MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION;
  compatibilityLayerId: typeof MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1;
  failureCode: MLBProspectiveT360FailureCode;
  issues: readonly MLBFeatureExtractionIssue[];
}>;

export type MLBProspectiveT360FeatureCompatibilityResult =
  | MLBProspectiveT360FeatureCompatibilitySuccess
  | MLBProspectiveT360FeatureCompatibilityFailure;

/* -------------------------------------------------------------------------- */
/*  Scientific cutoff computation                                              */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveT360ComputeCutoffResult =
  | Readonly<{ ok: true; scientificCutoffAt: string }>
  | Readonly<{
      ok: false;
      contractVersion: typeof MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION;
      compatibilityLayerId: typeof MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1;
      protocolId: typeof MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID;
      failureCode: 'INVALID_CAPTURE_REQUEST';
      message: string;
    }>;

export function computeScientificCutoffAt(
  scheduledStartAt: unknown,
): MLBProspectiveT360ComputeCutoffResult {
  if (typeof scheduledStartAt !== 'string' || scheduledStartAt !== scheduledStartAt.trim() || scheduledStartAt.length === 0) {
    return {
      ok: false,
      contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
      compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
      protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
      failureCode: 'INVALID_CAPTURE_REQUEST',
      message: 'scheduledStartAt must be a non-empty trimmed string',
    };
  }

  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      scheduledStartAt,
    )
  ) {
    return {
      ok: false,
      contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
      compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
      protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
      failureCode: 'INVALID_CAPTURE_REQUEST',
      message: 'scheduledStartAt is not a valid RFC3339 timestamp',
    };
  }

  const scheduledMs = Date.parse(scheduledStartAt);
  if (!Number.isFinite(scheduledMs)) {
    return {
      ok: false,
      contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
      compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
      protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
      failureCode: 'INVALID_CAPTURE_REQUEST',
      message: 'scheduledStartAt is not a valid RFC3339 timestamp',
    };
  }

  const cutoffMs = scheduledMs - MLB_PROSPECTIVE_HOLDOUT_SCI_CUTOFF_MINUTES * 60 * 1000;
  const cutoff = new Date(cutoffMs);
  return { ok: true, scientificCutoffAt: cutoff.toISOString() };
}

/* -------------------------------------------------------------------------- */
/*  Timestamp helpers                                                          */
/* -------------------------------------------------------------------------- */

function parseTimestampToMs(value: unknown): number {
  if (typeof value !== 'string') {
    return NaN;
  }
  const trimmed = value.trim();
  if (trimmed !== value || trimmed.length === 0) {
    return NaN;
  }
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      trimmed,
    )
  ) {
    return NaN;
  }
  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? ms : NaN;
}

/* -------------------------------------------------------------------------- */
/*  Source timestamp classification                                             */
/* -------------------------------------------------------------------------- */

// Model-information timestamps: these represent when data was fetched/updated/announced.
// They must be proven <= scientificCutoffAt.
const MODEL_INFORMATION_TIMESTAMP_PATHS: readonly string[] = Object.freeze([
  // sourceReferences: fetchedAt is always model-information
  '$.sourceReferences[].fetchedAt',
  // sourceReferences: sourceUpdatedAt is model-information when present
  '$.sourceReferences[].sourceUpdatedAt',
  // startingPitchers: announcedAt is model-information when present
  '$.startingPitchers.home.announcedAt',
  '$.startingPitchers.away.announcedAt',
  // sections: asOfAt represents the data's as-of time
  '$.sections[].asOfAt',
]);

// Non-model operational timestamps: capturedAt is when the snapshot was captured/persisted.
const NON_MODEL_OPERATIONAL_TIMESTAMPS = Object.freeze([
  '$.capturedAt',
]);

export {
  MODEL_INFORMATION_TIMESTAMP_PATHS,
  NON_MODEL_OPERATIONAL_TIMESTAMPS,
};

/* -------------------------------------------------------------------------- */
/*  T-360 capture adapter                                                      */
/* -------------------------------------------------------------------------- */

export function runProspectiveT360Capture(
  request: MLBProspectiveT360CaptureRequest,
  builder: (req: MLBProspectiveT360CaptureRequest) => MLBCanonicalPregameSnapshot,
  clock: MLBProspectiveT360ClockReader,
): MLBProspectiveT360CaptureResult {
  // 1. Validate request fields
  if (typeof request.gameId !== 'string' || request.gameId !== request.gameId.trim() || request.gameId.length === 0) {
    return {
      ok: false,
      contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
      compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
      protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
      failureCode: 'INVALID_CAPTURE_REQUEST',
      message: 'gameId must be a non-empty trimmed string',
    };
  }

  const cutoffResult = computeScientificCutoffAt(request.scheduledStartAt);
  if (!cutoffResult.ok) {
    return {
      ok: false,
      contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
      compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
      protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
      failureCode: cutoffResult.failureCode,
      message: cutoffResult.message,
    };
  }

  const scientificCutoffAt = cutoffResult.scientificCutoffAt;
  const scientificCutoffMs = Date.parse(scientificCutoffAt);
  if (!Number.isFinite(scientificCutoffMs)) {
    return {
      ok: false,
      contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
      compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
      protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
      failureCode: 'INVALID_CAPTURE_REQUEST',
      message: 'Computed scientificCutoffAt is not a valid timestamp',
    };
  }

  // 2. Pre-build cutoff guard
  const capturedAt = clock();
  const capturedMs = Date.parse(capturedAt);
  if (!Number.isFinite(capturedMs)) {
    return {
      ok: false,
      contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
      compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
      protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
      failureCode: 'INVALID_CAPTURE_REQUEST',
      message: 'Clock returned an invalid timestamp',
    };
  }

  if (capturedMs > scientificCutoffMs) {
    return {
      ok: false,
      contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
      compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
      protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
      failureCode: 'CAPTURE_STARTED_AFTER_SCIENTIFIC_CUTOFF',
      message: `Capture started after scientific cutoff: ${capturedAt} > ${scientificCutoffAt}`,
    };
  }

  // 3. Invoke builder exactly once
  let snapshot: MLBCanonicalPregameSnapshot;
  try {
    snapshot = builder(request);
  } catch (error) {
    return {
      ok: false,
      contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
      compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
      protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
      failureCode: 'CAPTURE_BUILDER_FAILED',
      message: error instanceof Error ? error.message : 'Builder threw an unknown error',
    };
  }

  if (!snapshot || typeof snapshot !== 'object') {
    return {
      ok: false,
      contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
      compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
      protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
      failureCode: 'CAPTURE_BUILDER_FAILED',
      message: 'Builder returned a non-object snapshot',
    };
  }

  // 4. Validate snapshot using authoritative validator
  const snapshotValidation = validateMLBCanonicalPregameSnapshot(snapshot);
  if (!snapshotValidation.ok) {
    return {
      ok: false,
      contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
      compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
      protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
      failureCode: 'INVALID_PREGAME_SNAPSHOT',
      message: `Snapshot validation failed: ${snapshotValidation.issues.map(i => i.message).join('; ')}`,
    };
  }

  const validatedSnapshot = snapshotValidation.value;

  // 5. Game identity match
  if (validatedSnapshot.game.gameId !== request.gameId) {
    return {
      ok: false,
      contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
      compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
      protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
      failureCode: 'GAME_IDENTITY_MISMATCH',
      message: `Snapshot gameId ${validatedSnapshot.game.gameId} does not match request gameId ${request.gameId}`,
    };
  }

  // 6. Scheduled start consistency
  if (validatedSnapshot.game.scheduledStartAt !== request.scheduledStartAt) {
    return {
      ok: false,
      contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
      compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
      protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
      failureCode: 'GAME_IDENTITY_MISMATCH',
      message: `Snapshot scheduledStartAt ${validatedSnapshot.game.scheduledStartAt} does not match request ${request.scheduledStartAt}`,
    };
  }

  // 7. Actual data cutoff <= scientific cutoff
  const actualDataCutoffMs = parseTimestampToMs(validatedSnapshot.dataCutoffAt);
  if (!Number.isFinite(actualDataCutoffMs)) {
    return {
      ok: false,
      contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
      compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
      protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
      failureCode: 'ACTUAL_DATA_CUTOFF_AFTER_SCIENTIFIC_CUTOFF',
      message: 'Snapshot dataCutoffAt is not a valid timestamp',
    };
  }

  if (actualDataCutoffMs > scientificCutoffMs) {
    return {
      ok: false,
      contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
      compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
      protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
      failureCode: 'ACTUAL_DATA_CUTOFF_AFTER_SCIENTIFIC_CUTOFF',
      message: `Snapshot dataCutoffAt ${validatedSnapshot.dataCutoffAt} is after scientific cutoff ${scientificCutoffAt}`,
    };
  }

  // 8. Source-level timestamp enforcement
  for (const sourceRef of validatedSnapshot.sourceReferences) {
    const fetchedMs = parseTimestampToMs(sourceRef.fetchedAt);
    if (!Number.isFinite(fetchedMs) || fetchedMs > scientificCutoffMs) {
      return {
        ok: false,
        contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
        compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        failureCode: 'MODEL_SOURCE_TIMESTAMP_AFTER_SCIENTIFIC_CUTOFF',
        message: `Source reference fetchedAt ${sourceRef.fetchedAt} is after or unprovable before scientific cutoff ${scientificCutoffAt}`,
      };
    }

    const updatedAt = sourceRef.sourceUpdatedAt;
    if (updatedAt !== null) {
      const updatedMs = parseTimestampToMs(updatedAt);
      if (!Number.isFinite(updatedMs) || updatedMs > scientificCutoffMs) {
        return {
          ok: false,
          contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
          compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
          protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
          failureCode: 'MODEL_SOURCE_TIMESTAMP_AFTER_SCIENTIFIC_CUTOFF',
          message: `Source reference sourceUpdatedAt ${updatedAt} is after or unprovable before scientific cutoff ${scientificCutoffAt}`,
        };
      }
    }
  }

  // Starting pitcher announcedAt
  const homeAnnounced = validatedSnapshot.startingPitchers.home.announcedAt;
  if (homeAnnounced !== null) {
    const homeMs = parseTimestampToMs(homeAnnounced);
    if (!Number.isFinite(homeMs) || homeMs > scientificCutoffMs) {
      return {
        ok: false,
        contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
        compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        failureCode: 'MODEL_SOURCE_TIMESTAMP_AFTER_SCIENTIFIC_CUTOFF',
        message: `Home starting pitcher announcedAt ${homeAnnounced} is after or unprovable before scientific cutoff ${scientificCutoffAt}`,
      };
    }
  }

  const awayAnnounced = validatedSnapshot.startingPitchers.away.announcedAt;
  if (awayAnnounced !== null) {
    const awayMs = parseTimestampToMs(awayAnnounced);
    if (!Number.isFinite(awayMs) || awayMs > scientificCutoffMs) {
      return {
        ok: false,
        contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
        compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        failureCode: 'MODEL_SOURCE_TIMESTAMP_AFTER_SCIENTIFIC_CUTOFF',
        message: `Away starting pitcher announcedAt ${awayAnnounced} is after or unprovable before scientific cutoff ${scientificCutoffAt}`,
      };
    }
  }

  // Section asOfAt
  for (const section of validatedSnapshot.sections) {
    const asOfMs = parseTimestampToMs(section.asOfAt);
    if (!Number.isFinite(asOfMs) || asOfMs > scientificCutoffMs) {
      return {
        ok: false,
        contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
        compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        failureCode: 'MODEL_SOURCE_TIMESTAMP_AFTER_SCIENTIFIC_CUTOFF',
        message: `Section ${section.sectionId} asOfAt ${section.asOfAt} is after or unprovable before scientific cutoff ${scientificCutoffAt}`,
      };
    }
  }

  // 9. Return success
  return {
    ok: true,
    contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
    compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    gameId: validatedSnapshot.game.gameId,
    scheduledStartAt: validatedSnapshot.game.scheduledStartAt,
    scientificCutoffAt,
    actualDataCutoffAt: validatedSnapshot.dataCutoffAt,
    snapshot: validatedSnapshot,
    t360Validation: {
      status: 'ACCEPTED',
      actualDataCutoffAtLteScientificCutoff: true,
      sourceTimestampsProvenLteScientificCutoff: true,
    },
  };
}
