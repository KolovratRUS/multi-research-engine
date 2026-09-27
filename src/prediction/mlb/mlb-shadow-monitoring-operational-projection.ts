/* -------------------------------------------------------------------------- */
/*  Operational projection for shadow monitoring (L5E2Q)                      */
/* -------------------------------------------------------------------------- */

/**
 * Builds an S1 operational-blind monitoring record from ordinary
 * operational metadata only.
 *
 * Properties:
 *  - Returns MLBShadowMonitoringOperationalRecord via the existing L5E2P
 *    record contract validator.
 *  - Input contains ONLY ordinary operational metadata — no sensitive
 *    prediction values, no digests, no outcome/grading data.
 *  - Does NOT import the quarantine contract.
 *  - Performs ZERO persistence.
 */

import {
  MLB_SHADOW_MONITORING_OPERATIONAL_RECORD_CONTRACT_VERSION,
  MLB_SHADOW_MONITORING_OPERATIONAL_MODE_S1_OPERATIONAL_BLIND,
  MLB_SHADOW_MONITORING_SCIENTIFIC_USE_NONE,
  validateMLBShadowMonitoringOperationalRecord,
  type MLBShadowMonitoringOperationalRecordValidationResult,
} from '@/prediction/mlb/mlb-shadow-monitoring-record-contract';

/* -------------------------------------------------------------------------- */
/*  Input type — ordinary operational metadata only                         */
/* -------------------------------------------------------------------------- */

/**
 * Input for buildMLBShadowPredictionOperationalRecord.
 *
 * Contains ONLY ordinary operational metadata.
 * Does NOT accept any sensitive prediction values (predictedWinner,
 * predictedSide, probabilities, decisionPolicy), digests (payloadHash),
 * or outcome/grading data (officialWinner, scores, correctness, etc.).
 *
 * Builder-owned candidate provenance (sourceCandidateRecipeId,
 * sourceCandidateFingerprint) is frozen internally — the caller cannot
 * substitute another candidate.
 */
export type MLBShadowPredictionOperationalRecordInput = Readonly<{
  shadowRecordId?: string | null;
  gamePk?: number | null;
  officialDate?: string | null;
  scheduledStartAt?: string | null;
  predictionGeneratedAt?: string | null;
  pipelineStatus?: string | null;
  failureCode?: string | null;
  latencyMs?: number | null;
  featureManifestId?: string | null;
  featureManifestFingerprint?: string | null;
  timingReferenceContractVersion?: string | null;
  timingReferenceCutoffAt?: string | null;
  predictionPayloadGenerated?: boolean | null;
  predictionPayloadSchemaValid?: boolean | null;
}>;

/* -------------------------------------------------------------------------- */
/*  Frozen builder-owned candidate provenance                                 */
/* -------------------------------------------------------------------------- */

/**
 * The builder owns the candidate provenance — the caller cannot inject
 * a different candidate through the input type. These constants are the
 * only source of truth for sourceCandidateRecipeId and
 * sourceCandidateFingerprint in the operational projection.
 */
const MLB_SHADOW_CANDIDATE003_RECIPE_ID = 'mlb-v1-inner-candidate-003';
const MLB_SHADOW_CANDIDATE003_RECIPE_FINGERPRINT =
  'ce35df51cdf38ed9bf91aa2fb78871443f259c963d8c2700e8b6fe5d960a95bc';

/* -------------------------------------------------------------------------- */
/*  Operational record builder                                                */
/* -------------------------------------------------------------------------- */

/**
 * Builds a frozen S1_OPERATIONAL_BLIND operational record from ordinary
 * operational metadata.
 *
 * The locked scientific policy fields (contractVersion, mode,
 * scientificUse, isProspectiveHoldoutEvidence, eligibleForFutureValidation,
 * eligibleForFutureTest) are set by this function and validated by the
 * existing record contract validator. The caller cannot influence them.
 *
 * @param input - Ordinary operational metadata only.
 * @returns A validation result containing the frozen operational record.
 */
export function buildMLBShadowPredictionOperationalRecord(
  input: MLBShadowPredictionOperationalRecordInput,
): MLBShadowMonitoringOperationalRecordValidationResult {
  const record = {
    // Locked scientific policy fields — set, never overridden by caller.
    contractVersion:
      MLB_SHADOW_MONITORING_OPERATIONAL_RECORD_CONTRACT_VERSION,
    mode: MLB_SHADOW_MONITORING_OPERATIONAL_MODE_S1_OPERATIONAL_BLIND,
    scientificUse: MLB_SHADOW_MONITORING_SCIENTIFIC_USE_NONE,
    isProspectiveHoldoutEvidence: false,
    eligibleForFutureValidation: false,
    eligibleForFutureTest: false,

    // Ordinary operational metadata — forwarded from caller.
    shadowRecordId: input.shadowRecordId ?? null,
    gamePk: input.gamePk ?? null,
    officialDate: input.officialDate ?? null,
    scheduledStartAt: input.scheduledStartAt ?? null,
    predictionGeneratedAt: input.predictionGeneratedAt ?? null,
    pipelineStatus: input.pipelineStatus ?? null,
    failureCode: input.failureCode ?? null,
    latencyMs: input.latencyMs ?? null,
    sourceCandidateRecipeId: MLB_SHADOW_CANDIDATE003_RECIPE_ID,
    sourceCandidateFingerprint: MLB_SHADOW_CANDIDATE003_RECIPE_FINGERPRINT,
    featureManifestId: input.featureManifestId ?? null,
    featureManifestFingerprint: input.featureManifestFingerprint ?? null,
    timingReferenceContractVersion: input.timingReferenceContractVersion ?? null,
    timingReferenceCutoffAt: input.timingReferenceCutoffAt ?? null,
    predictionPayloadGenerated: input.predictionPayloadGenerated ?? null,
    predictionPayloadSchemaValid: input.predictionPayloadSchemaValid ?? null,

    // Downstream processing flags — null in S1_OPERATIONAL_BLIND because
    // result fetching, joining, and grading have not been performed.
    resultFetchSucceeded: null,
    resultJoinMatched: null,
    resultPayloadSchemaValid: null,
    gradingRecordProduced: null,
    gradingSchemaValid: null,
  };

  return validateMLBShadowMonitoringOperationalRecord(record);
}
