/* -------------------------------------------------------------------------- */
/*  Safe shadow-prediction orchestration (L5E2S)                              */
/* -------------------------------------------------------------------------- */

/**
 * Composes the minimum-safe shadow-prediction pipeline:
 *
 *   internally:
 *     S1_QUARANTINE_COMPUTE  — sensitive prediction computation (L5E2Q)
 *     S1_QUARANTINE_WRITE     — write-once prediction quarantine persistence (L5E2R)
 *
 *   public return:
 *     S1_OPERATIONAL_READ only (L5E2P)
 *
 * The orchestrator composes existing L5E2Q (computation) and L5E2R (store)
 * modules, then projects results into the existing safe operational record
 * envelope (L5E2P).  No sensitive payload data crosses the firewall into
 * the public return; only fixed, allowlisted operational status strings do.
 *
 * No operational record is persisted to disk — the projection is in-memory
 * only.
 */

import {
  computeMLBShadowQuarantinedPrediction,
  type MLBShadowQuarantinedPredictionInput,
} from './mlb-shadow-monitoring-prediction-computation';

import {
  persistMLBShadowQuarantinedPrediction,
  type MLBShadowPredictionPersistenceResult,
  type MLBShadowPredictionFailureStatus,
} from './mlb-shadow-monitoring-prediction-store';

import {
  buildMLBShadowPredictionOperationalRecord,
  type MLBShadowPredictionOperationalRecordInput,
} from './mlb-shadow-monitoring-operational-projection';

import type { MLBShadowMonitoringOperationalRecordValidationResult } from './mlb-shadow-monitoring-record-contract';

import type { MLBShadowQuarantinedPredictionPayload } from './mlb-shadow-monitoring-quarantine-contract';

/* -------------------------------------------------------------------------- */
/*  Orchestrator input — caller cannot forge derived operational status        */
/* -------------------------------------------------------------------------- */

/**
 * Input for orchestrateMLBShadowQuarantinePrediction.
 *
 * Contains ONLY ordinary operational metadata plus the opaque shadow inputs
 * needed by the composition.  The caller CANNOT supply:
 *   - pipelineStatus
 *   - failureCode
 *   - predictionPayloadGenerated
 *   - predictionPayloadSchemaValid
 *   - prediction payload fields (predictedWinner, predictedSide, ...)
 *   - model fingerprint / relative quarantine path
 *
 * These derived status fields are owned exclusively by the orchestrator.
 */
export type MLBShadowQuarantineOrchestratorInput = Readonly<{
  repoRoot: string;

  shadowRecordId: string;
  gamePk: number;
  predictionGeneratedAt: string;

  releasedModelResult: unknown;
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
/*  Orchestrator                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Composes L5E2Q (sensitive prediction computation) + L5E2R (write-once
 * quarantine persistence) and projects the result into the existing safe
 * operational record envelope (L5E2P).
 *
 * Firewall guarantees:
 *  - Returns ONLY MLBShadowMonitoringOperationalRecordValidationResult.
 *  - Raw computation/store issues are never surfaced to the caller.
 * - Store artifact path fields are never surfaced to the caller.
 *  - Sensitive prediction values never enter the public return.
 *  - Derived operational status fields are owned exclusively by this function.
 *  - No operational record is persisted to disk (in-memory only).
 *
 * @param input - Ordinary operational metadata + opaque shadow inputs.
 * @returns A validation result containing the safe operational record.
 */
export async function orchestrateMLBShadowQuarantinePrediction(
  input: MLBShadowQuarantineOrchestratorInput,
): Promise<MLBShadowMonitoringOperationalRecordValidationResult> {
  /* ------------------------------------------------------------------ */
  /*  Build the L5E2Q compute input from orchestrator input             */
  /* ------------------------------------------------------------------ */

  const computeInput: MLBShadowQuarantinedPredictionInput = {
    shadowRecordId: input.shadowRecordId,
    gamePk: input.gamePk,
    predictionGeneratedAt: input.predictionGeneratedAt,
    releasedModelResult: input.releasedModelResult,
    featureManifest: input.featureManifest,
    snapshot: input.snapshot,
  };

  /* ------------------------------------------------------------------ */
  /*  L5E2Q: sensitive prediction computation (S1_QUARANTINE_COMPUTE)   */
  /* ------------------------------------------------------------------ */

  const computeResult = computeMLBShadowQuarantinedPrediction(computeInput);

  if (!computeResult.ok) {
    /*
     * Compute failure: collapse all internal failure modes (input
     * validation, frozen-model verification, inference, quarantine
     * payload validation) into ONE safe operational code.
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
   * L5E2Q succeeded — the sensitive payload lives only in this local
   * variable long enough to pass directly into L5E2R, then goes out
   * of scope.  It is never copied into any public object.
   */
  const payload: MLBShadowQuarantinedPredictionPayload = computeResult.value;

  /* ------------------------------------------------------------------ */
  /*  L5E2R: write-once prediction quarantine persistence (S1_QUARANTINE_WRITE) */
  /* ------------------------------------------------------------------ */

  const storeResult: MLBShadowPredictionPersistenceResult =
    await persistMLBShadowQuarantinedPrediction(input.repoRoot, payload);

  /* ------------------------------------------------------------------ */
  /*  Map store status to fixed operational codes (sections 7-12)       */
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
  /*  L5E2S: safe operational projection (S1_OPERATIONAL_READ)            */
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
