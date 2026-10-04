/* -------------------------------------------------------------------------- */
/*  Outer shadow-monitoring operational-persistence orchestrator (L5E2U)      */
/* -------------------------------------------------------------------------- */

/**
 * Architecture B — outer integration orchestrator.
 *
 * Composes the existing L5E2S prediction orchestrator and the existing L5E2T
 * operational store into a single persistence workflow:
 *
 *   L5E2S prediction computation + quarantine  →  safe operational record
 *                                              →  L5E2T operational persistence
 *
 * Firewall guarantees:
 *  - Calls L5E2S exactly once; never inspects the sensitive prediction payload.
 *  - If L5E2S succeeds, obtains ONLY the validated safe operational record.
 *  - Performs an identity invariant check on shadowRecordId / gamePk.
 *  - Calls L5E2T exactly once with the validated safe record.
 *  - Projects the L5E2T result into a fixed, safe integration contract.
 *  - The full L5E2T result is NEVER returned to the caller.
 *  - No raw issues, no relativePath, no storeVersion, no model fingerprint,
 *    no prediction payload fields are exposed.
 *  - Prediction-pipeline truth (pipelineStatus / failureCode) stays inside the
 *    operational record, separate from operational-persistence truth (the
 *    integration status).
 *  - No cross-store rollback: a prediction artifact is never deleted, rewritten,
 *    or unlinked by this layer.
 *  - No direct filesystem access (no node:fs / node:fs/promises import).
 *  - No import of prediction computation, prediction store, quarantine contract,
 *    or model fingerprint modules.
 */

import {
  orchestrateMLBShadowQuarantinePrediction,
  type MLBShadowQuarantineOrchestratorInput,
} from './mlb-shadow-monitoring-prediction-orchestrator';
import { persistMLBShadowMonitoringPredictionOperationalRecord } from './mlb-shadow-monitoring-operational-store';
import type { MLBShadowMonitoringOperationalRecord } from './mlb-shadow-monitoring-record-contract';

/* -------------------------------------------------------------------------- */
/*  Version constant                                                           */
/* -------------------------------------------------------------------------- */

export const MLB_SHADOW_MONITORING_PERSISTENCE_ORCHESTRATOR_VERSION =
  'mlb-shadow-monitoring-persistence-orchestrator-v1' as const;

/* -------------------------------------------------------------------------- */
/*  Fixed safe integration status strings                                      */
/* -------------------------------------------------------------------------- */

/**
 * The fixed status surface returned by the outer orchestrator. These strings
 * are the ONLY persistence outcomes the caller may observe — never the raw
 * L5E2T store status.
 */
export type MLBShadowMonitoringPersistenceIntegrationStatus =
  | 'OPERATIONAL_RECORD_INVALID'
  | 'OPERATIONAL_RECORD_IDENTITY_MISMATCH'
  | 'OPERATIONAL_PERSISTED'
  | 'OPERATIONAL_PERSISTED_WITH_CLEANUP_WARNING'
  | 'OPERATIONAL_IDEMPOTENT_IDENTICAL_SUCCESS'
  | 'OPERATIONAL_ALREADY_EXISTS_DIFFERENT'
  | 'OPERATIONAL_VERIFICATION_FAILED'
  | 'OPERATIONAL_PRE_FINALIZATION_FAILED';

/* -------------------------------------------------------------------------- */
/*  Public result contract                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Fixed safe result returned by the L5E2U outer orchestrator.
 *
 * Exposes ONLY the validated safe operational record plus a small, fixed
 * set of operational-persistence metadata fields.
 *
 * The full L5E2T persistence result is NEVER returned. In particular,
 * storeVersion, relativePath, shadowRecordId, stage, and any raw issues
 * or error messages are never exposed.
 */
export type MLBShadowMonitoringPredictionPersistenceIntegrationResult =
  Readonly<{
    ok: boolean;
    integrationVersion:
      typeof MLB_SHADOW_MONITORING_PERSISTENCE_ORCHESTRATOR_VERSION;
    status: MLBShadowMonitoringPersistenceIntegrationStatus;
    /**
     * The validated safe operational record (L5E2S output) OR null when
     * L5E2S itself could not produce a valid record.
     *
     * Retained even when L5E2T fails, so the caller can distinguish
     * prediction-pipeline state from operational-persistence state.
     */
    operationalRecord: MLBShadowMonitoringOperationalRecord | null;
    /**
     * True iff the L5E2T persistence function was invoked.
     */
    operationalPersistenceAttempted: boolean;
    /**
     * Truth-preserving projection of L5E2T artifactCreated.
     */
    operationalArtifactCreated: boolean;
    /**
     * Truth-preserving projection of L5E2T verificationOk.
     */
    operationalVerificationOk: boolean;
    /**
     * Truth-preserving projection of L5E2T tempCleanupFailed.
     */
    operationalTempCleanupFailed: boolean;
  }>;

/* -------------------------------------------------------------------------- */
/*  Outer orchestrator                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Composes the existing L5E2S prediction orchestrator and the existing L5E2T
 * operational store into the outer persistence workflow.
 *
 * Execution order:
 *  1. receive existing L5E2S input
 *  2. call existing L5E2S exactly once
 *  3. if L5E2S returns ok=false → OPERATIONAL_RECORD_INVALID (no L5E2T call)
 *  4. obtain only the validated safe operational record
 *  5. identity-invariant check on shadowRecordId / gamePk
 *  6. call existing L5E2T exactly once with repoRoot + safe record
 *  7. project L5E2T result into fixed safe integration status
 *  8. return safe operational record + operational-persistence metadata
 *  9. never call L5E2S or L5E2T a second time
 * 10. never rollback prediction quarantine
 *
 * @param input - Reuses the exact existing L5E2S input type. The caller
 *                cannot forge derived operational status.
 * @returns A fixed safe integration result.
 */
export async function orchestrateMLBShadowMonitoringPredictionPersistence(
  input: MLBShadowQuarantineOrchestratorInput,
): Promise<MLBShadowMonitoringPredictionPersistenceIntegrationResult> {
  /* ------------------------------------------------------------------ */
  /*  Step 2: call existing L5E2S exactly once.                        */
  /* ------------------------------------------------------------------ */
  const predictionResult =
    await orchestrateMLBShadowQuarantinePrediction(input);

  /* ------------------------------------------------------------------ */
  /*  Step 3: if L5E2S returns ok=false → no L5E2T, no issue forwarding. */
  /* ------------------------------------------------------------------ */
  if (!predictionResult.ok) {
    return {
      ok: false,
      integrationVersion:
        MLB_SHADOW_MONITORING_PERSISTENCE_ORCHESTRATOR_VERSION,
      status: 'OPERATIONAL_RECORD_INVALID',
      operationalRecord: null,
      operationalPersistenceAttempted: false,
      operationalArtifactCreated: false,
      operationalVerificationOk: false,
      operationalTempCleanupFailed: false,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Step 4: obtain only the validated safe operational record.       */
  /* ------------------------------------------------------------------ */
  const validatedRecord: MLBShadowMonitoringOperationalRecord =
    predictionResult.value;

  /* ------------------------------------------------------------------ */
  /*  Step 5: identity invariant — shadowRecordId / gamePk must match   */
  /*  the source-level authoritative input values directly.             */
  /* ------------------------------------------------------------------ */
  if (
    validatedRecord.shadowRecordId !== input.shadowRecordId ||
    validatedRecord.gamePk !== input.gamePk
  ) {
    return {
      ok: false,
      integrationVersion:
        MLB_SHADOW_MONITORING_PERSISTENCE_ORCHESTRATOR_VERSION,
      status: 'OPERATIONAL_RECORD_IDENTITY_MISMATCH',
      operationalRecord: null,
      operationalPersistenceAttempted: false,
      operationalArtifactCreated: false,
      operationalVerificationOk: false,
      operationalTempCleanupFailed: false,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Step 6: call existing L5E2T exactly once with repoRoot + record. */
  /* ------------------------------------------------------------------ */
  const storeResult =
    await persistMLBShadowMonitoringPredictionOperationalRecord(
      input.repoRoot,
      validatedRecord,
    );

  /* ------------------------------------------------------------------ */
  /*  Step 7: project L5E2T result into fixed safe integration status. */
  /* ------------------------------------------------------------------ */
  let ok = false;
  let integrationStatus: MLBShadowMonitoringPersistenceIntegrationStatus =
    'OPERATIONAL_PRE_FINALIZATION_FAILED';

  if (storeResult.ok) {
    ok = true;
    switch (storeResult.status) {
      case 'PERSISTED':
        integrationStatus = 'OPERATIONAL_PERSISTED';
        break;
      case 'PERSISTED_WITH_CLEANUP_WARNING':
        integrationStatus = 'OPERATIONAL_PERSISTED_WITH_CLEANUP_WARNING';
        break;
      case 'IDEMPOTENT_IDENTICAL_SUCCESS':
        integrationStatus = 'OPERATIONAL_IDEMPOTENT_IDENTICAL_SUCCESS';
        break;
      default:
        /*
         * Unknown future success status — fail closed. The store reported
         * ok=true with a status this layer does not recognize; rather than
         * surfacing a raw status string, collapse to a generic failure.
         */
        ok = false;
        integrationStatus = 'OPERATIONAL_PRE_FINALIZATION_FAILED';
        break;
    }
  } else {
    ok = false;
    switch (storeResult.status) {
      case 'ALREADY_EXISTS':
        integrationStatus = 'OPERATIONAL_ALREADY_EXISTS_DIFFERENT';
        break;
      case 'VERIFICATION_FAILED':
        integrationStatus = 'OPERATIONAL_VERIFICATION_FAILED';
        break;
      default:
        /*
         * Every other failure status — VALIDATION_FAILED,
         * INVALID_STAGE_STATE, SHADOW_RECORD_ID_NULL, SYMLINK_DETECTED,
         * NON_DIRECTORY_TARGET, REPO_ROOT_INVALID, WRITE_ERROR,
         * UNKNOWN_ERROR, or any future/unknown status — maps to the
         * generic pre-finalization failure. The original status is NOT
         * exposed to the caller.
         */
        integrationStatus = 'OPERATIONAL_PRE_FINALIZATION_FAILED';
        break;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Step 8: return safe operational record + persistence metadata.   */
  /*  No rollback, no cross-store transaction.                          */
  /* ------------------------------------------------------------------ */
  return {
    ok,
    integrationVersion:
      MLB_SHADOW_MONITORING_PERSISTENCE_ORCHESTRATOR_VERSION,
    status: integrationStatus,
    operationalRecord: validatedRecord,
    operationalPersistenceAttempted: true,
    operationalArtifactCreated: storeResult.artifactCreated,
    operationalVerificationOk: storeResult.verificationOk,
    operationalTempCleanupFailed: storeResult.tempCleanupFailed,
  };
}
