/* -------------------------------------------------------------------------- */
/*  Safe V2 shadow-prediction orchestration (additive P5E-C1 layer)            */
/* -------------------------------------------------------------------------- */
/**
 * Composes the minimum-safe V2 shadow-prediction pipeline:
 *
 *   internally:
 *     S1_QUARANTINE_COMPUTE  — V2 sensitive prediction computation
 *     S1_QUARANTINE_WRITE     — write-once prediction quarantine persistence (L5E2R)
 *
 *   public return:
 *     S1_OPERATIONAL_READ only (L5E2P)
 *
 * The V2 orchestrator replaces ONLY the V1 computation dependency with
 * computeMLBShadowQuarantinedPredictionV2. The prediction store
 * (persistMLBShadowQuarantinedPrediction) and the operational projection
 * (buildMLBShadowPredictionOperationalRecord) are reused unchanged.
 *
 * No operational record is persisted to disk — the projection is in-memory
 * only. This phase does NOT write the operational store.
 */

import {
  computeMLBShadowQuarantinedPredictionV2,
} from './mlb-shadow-monitoring-prediction-computation-v2';

import {
  persistMLBShadowQuarantinedPrediction,
  type MLBShadowPredictionPersistenceResult,
  type MLBShadowPredictionFailureStatus,
} from './mlb-shadow-monitoring-prediction-store';

import {
  buildMLBShadowPredictionOperationalRecord,
} from './mlb-shadow-monitoring-operational-projection';

import type { MLBShadowMonitoringOperationalRecordValidationResult } from './mlb-shadow-monitoring-record-contract';

import type { MLBShadowQuarantinedPredictionPayload } from './mlb-shadow-monitoring-quarantine-contract';

/* -------------------------------------------------------------------------- */
/*  V2 orchestrator input — caller cannot forge derived operational status     */
/* -------------------------------------------------------------------------- */
/**
 * Input for orchestrateMLBShadowQuarantinePredictionV2.
 *
 * V2 replaces the V1 model-result seam with `authorizedModelArtifact`.
 * The caller CANNOT supply:
 *   - pipelineStatus
 *   - failureCode
 *   - predictionPayloadGenerated
 *   - predictionPayloadSchemaValid
 *   - prediction payload fields (predictedWinner, predictedSide, ...)
 *   - model fingerprint / relative quarantine path
 *
 * These derived status fields are owned exclusively by the orchestrator.
 */
export type MLBShadowQuarantineOrchestratorV2Input = Readonly<{
  repoRoot: string;

  shadowRecordId: string;
  gamePk: number;
  predictionGeneratedAt: string;

  authorizedModelArtifact: unknown;
  featureManifest: unknown;
  snapshot: unknown;

  // Optional safe operational metadata (forwarded to L5E2P builder).
  officialDate?: string | null;
  scheduledStartAt?: string | null;
  latencyMs?: number | null;
  featureManifestId?: string | null;
  featureManifestFingerprint?: string | null;
  timingReferenceContractVersion?: string | null;
  timingReferenceCutoffAt?: string | null;
}>;

/* -------------------------------------------------------------------------- */
/*  Orchestrator-owned fixed operational status strings                        */
/* -------------------------------------------------------------------------- */

const COMPUTE_FAILURE_STATUS = 'PREDICTION_COMPUTE_FAILED';
const PERSISTED_STATUS = 'QUARANTINE_PERSISTED';
const ALREADY_EXISTS_STATUS = 'QUARANTINE_ALREADY_EXISTS_DUPLICATE';
const VERIFICATION_FAILED_STATUS = 'QUARANTINE_VERIFICATION_FAILED';
const WRITE_FAILED_STATUS = 'QUARANTINE_WRITE_FAILED';

/**
 * Finite allowlist of store failure status strings that the orchestrator
 * permits as a failureCode.  Any store status not in this set falls back
 * to the generic WRITE_FAILED_STATUS.
 *
 * Note: VALIDATION_FAILED is intentionally excluded — the orchestrator
 * always passes a validated payload to the store, so that status should
 * never occur; if it does, it is treated as an unexpected failure.
 */
const SAFE_STORE_FAILURE_CODES = new Set<MLBShadowPredictionFailureStatus>([
  'PAYLOAD_HASH_MISMATCH',
  'SYMLINK_DETECTED',
  'NON_DIRECTORY_TARGET',
  'REPO_ROOT_INVALID',
  'WRITE_ERROR',
  'UNKNOWN_ERROR',
]);

/* -------------------------------------------------------------------------- */
/*  V2 Orchestrator                                                            */
/* -------------------------------------------------------------------------- */
/**
 * Composes V2 sensitive prediction computation + write-once quarantine
 * persistence and projects the result into the existing safe operational
 * record envelope (L5E2P).
 *
 * Firewall guarantees (identical to V1):
 *  - Returns ONLY MLBShadowMonitoringOperationalRecordValidationResult.
 *  - Raw computation/store issues are never surfaced to the caller.
 *  - Store artifact path fields are never surfaced to the caller.
 *  - Sensitive prediction values never enter the public return.
 *  - Derived operational status fields are owned exclusively by this function.
 *  - No operational record is persisted to disk (in-memory only).
 *
 * V2-specific: passes the incoming input directly to
 * computeMLBShadowQuarantinedPredictionV2 (which performs full V2 job
 * validation internally). No release-result is referenced.
 *
 * @param input - Ordinary operational metadata + V2 authorized model artifact.
 * @returns A validation result containing the safe operational record.
 */
export async function orchestrateMLBShadowQuarantinePredictionV2(
  input: MLBShadowQuarantineOrchestratorV2Input,
): Promise<MLBShadowMonitoringOperationalRecordValidationResult> {
  /* ------------------------------------------------------------------ */
  /*  S1_QUARANTINE_COMPUTE — V2 sensitive prediction computation        */
  /* ------------------------------------------------------------------ */

  const computeResult = computeMLBShadowQuarantinedPredictionV2(input);

  if (!computeResult.ok) {
    /*
     * Compute failure: collapse all internal failure modes (V2 job
     * validation, candidate-003 artifact verification, feature extraction,
     * quarantine payload validation) into ONE safe operational code.
     *
     * No persistence call occurs.
     */
    return buildMLBShadowPredictionOperationalRecord({
      shadowRecordId: input.shadowRecordId,
      gamePk: input.gamePk,
      predictionGeneratedAt: input.predictionGeneratedAt,
      officialDate: input.officialDate ?? null,
      scheduledStartAt: input.scheduledStartAt ?? null,
      latencyMs: input.latencyMs ?? null,
      featureManifestId: input.featureManifestId ?? null,
      featureManifestFingerprint: input.featureManifestFingerprint ?? null,
      timingReferenceContractVersion: input.timingReferenceContractVersion ?? null,
      timingReferenceCutoffAt: input.timingReferenceCutoffAt ?? null,
      pipelineStatus: COMPUTE_FAILURE_STATUS,
      failureCode: COMPUTE_FAILURE_STATUS,
      predictionPayloadGenerated: false,
      predictionPayloadSchemaValid: false,
    });
  }

  /*
   * V2 computation succeeded — the sensitive payload lives only in this
   * local variable long enough to pass directly into L5E2R, then goes out
   * of scope.  It is never copied into any public object.
   */
  const payload: MLBShadowQuarantinedPredictionPayload = computeResult.value;

  /* ------------------------------------------------------------------ */
  /*  S1_QUARANTINE_WRITE — write-once prediction quarantine persistence  */
  /* ------------------------------------------------------------------ */

  const storeResult: MLBShadowPredictionPersistenceResult =
    await persistMLBShadowQuarantinedPrediction(input.repoRoot, payload);

  /* ------------------------------------------------------------------ */
  /*  Map store status to fixed operational codes (identical to V1)      */
  /* ------------------------------------------------------------------ */

  let pipelineStatus: string;
  let failureCode: string | null;
  let predictionPayloadGenerated = true;
  let predictionPayloadSchemaValid = true;

  if (storeResult.ok) {
    /*
     * Store success — PERSISTED or PERSISTED_WITH_CLEANUP_WARNING.
     * failureCode is omitted (null) per the existing builder convention.
     */
    pipelineStatus = PERSISTED_STATUS;
    failureCode = null;
  } else if (storeResult.status === 'ALREADY_EXISTS') {
    /*
     * Safe duplicate status — do NOT retry, overwrite, read, or delete.
     */
    pipelineStatus = ALREADY_EXISTS_STATUS;
    failureCode = 'ALREADY_EXISTS';
  } else if (storeResult.status === 'VERIFICATION_FAILED') {
    /*
     * Artifact was created but post-write verification failed.
     * Do NOT rollback, delete, overwrite, or repair the artifact.
     */
    pipelineStatus = VERIFICATION_FAILED_STATUS;
    failureCode = 'VERIFICATION_FAILED';
  } else {
    /*
     * Other store failures — PAYLOAD_HASH_MISMATCH, SYMLINK_DETECTED,
     * NON_DIRECTORY_TARGET, REPO_ROOT_INVALID, VALIDATION_FAILED,
     * WRITE_ERROR, UNKNOWN_ERROR, or any future/unknown status.
     *
     * failureCode is the store's fixed status string ONLY if it
     * belongs to the explicit finite allowlist; otherwise the
     * generic WRITE_FAILED_STATUS is used.
     */
    pipelineStatus = WRITE_FAILED_STATUS;
    failureCode = SAFE_STORE_FAILURE_CODES.has(storeResult.status)
      ? storeResult.status
      : WRITE_FAILED_STATUS;
  }

  /* ------------------------------------------------------------------ */
  /*  S1_OPERATIONAL_READ — safe operational projection                  */
  /* ------------------------------------------------------------------ */

  return buildMLBShadowPredictionOperationalRecord({
    shadowRecordId: input.shadowRecordId,
    gamePk: input.gamePk,
    predictionGeneratedAt: input.predictionGeneratedAt,
    officialDate: input.officialDate ?? null,
    scheduledStartAt: input.scheduledStartAt ?? null,
    latencyMs: input.latencyMs ?? null,
    featureManifestId: input.featureManifestId ?? null,
    featureManifestFingerprint: input.featureManifestFingerprint ?? null,
    timingReferenceContractVersion: input.timingReferenceContractVersion ?? null,
    timingReferenceCutoffAt: input.timingReferenceCutoffAt ?? null,
    pipelineStatus,
    failureCode,
    predictionPayloadGenerated,
    predictionPayloadSchemaValid,
  });
}
