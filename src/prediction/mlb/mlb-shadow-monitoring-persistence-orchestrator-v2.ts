/* -------------------------------------------------------------------------- */
/*  Inner shadow-monitoring operational-persistence orchestrator (V2 / P5E-C2) */
/* -------------------------------------------------------------------------- */

/**
 * Architecture B — inner integration orchestrator (V2).
 *
 * Composes the V2 shadow-prediction orchestrator (L5E2S-v2) and the
 * existing L5E2T operational store into a single persistence workflow:
 *
 *   V2 prediction computation + quarantine  →  safe operational record
 *                                              →  L5E2T operational persistence
 *
 * Write order (must NOT be reordered):
 *  1. computeMLBShadowQuarantinedPredictionV2
 *  2. persistMLBShadowQuarantinedPrediction
 *  3. buildMLBShadowPredictionOperationalRecord
 *  4. identity-invariant check            ← added by this layer
 *  5. persistMLBShadowMonitoringPredictionOperationalRecord
 *
 * Firewall guarantees:
 *  - Delegates prediction work to orchestrateMLBShadowQuarantinePredictionV2.
 *  - If prediction orchestration returns ok=false, the operational store is
 *    never called; the raw validation issues are NOT exposed to the caller.
 *  - If prediction orchestration succeeds, obtains ONLY the validated safe
 *    operational record.
 *  - Performs an identity-invariant check: the safe record's shadowRecordId
 *    and gamePk must match the input's. If not, the store is never called.
 *  - Calls the existing L5E2T store exactly once with repoRoot + safe record.
 *  - Projects the store result into the fixed safe integration status
 *    vocabulary (mirrors V1 EXACTLY). No raw store status, relativePath,
 *    storeVersion, or issues are ever exposed.
 *  - The full L5E2T result is NEVER returned to the caller.
 *  - No cross-store rollback: a prediction artifact is never deleted,
 *    rewritten, or unlinked by this layer.
 *  - No direct filesystem access (no node:fs / node:fs/promises import).
 *  - No import of prediction computation, prediction store, V2 computation,
 *    V2 execution-job contract, release-result contract, or model fingerprint.
 */

import {
  orchestrateMLBShadowQuarantinePredictionV2,
  type MLBShadowQuarantineOrchestratorV2Input,
} from './mlb-shadow-monitoring-prediction-orchestrator-v2';
import { persistMLBShadowMonitoringPredictionOperationalRecord } from './mlb-shadow-monitoring-operational-store';
import type { MLBShadowMonitoringOperationalRecord } from './mlb-shadow-monitoring-record-contract';

/* -------------------------------------------------------------------------- */
/*  V2 integration version (fixed literal — never reuse V1 version)          */
/* -------------------------------------------------------------------------- */

export const MLB_SHADOW_MONITORING_PERSISTENCE_INTEGRATION_V2_VERSION =
  'mlb-shadow-monitoring-persistence-integration-v2' as const;

/* -------------------------------------------------------------------------- */
/*  Fixed safe integration status strings (mirror V1 EXACTLY)                  */
/* -------------------------------------------------------------------------- */

/**
 * The fixed status surface returned by the V2 persistence orchestrator.
 * These strings are the ONLY persistence outcomes the caller may observe —
 * never the raw L5E2T store status.
 */
export type MLBShadowMonitoringPredictionPersistenceIntegrationV2Status =
  | 'OPERATIONAL_RECORD_INVALID'
  | 'OPERATIONAL_RECORD_IDENTITY_MISMATCH'
  | 'OPERATIONAL_PERSISTED'
  | 'OPERATIONAL_PERSISTED_WITH_CLEANUP_WARNING'
  | 'OPERATIONAL_IDEMPOTENT_IDENTICAL_SUCCESS'
  | 'OPERATIONAL_ALREADY_EXISTS_DIFFERENT'
  | 'OPERATIONAL_VERIFICATION_FAILED'
  | 'OPERATIONAL_PRE_FINALIZATION_FAILED';

/* -------------------------------------------------------------------------- */
/*  Public result contract (safe surface only)                                 */
/* -------------------------------------------------------------------------- */

/**
 * Fixed safe result returned by the V2 persistence orchestrator.
 *
 * Exposes ONLY the validated safe operational record plus a small, fixed
 * set of operational-persistence metadata fields.
 *
 * The full L5E2T persistence result is NEVER returned. In particular,
 * storeVersion, relativePath, shadowRecordId, stage, and any raw issues
 * or error messages are never exposed.
 */
export type MLBShadowMonitoringPredictionPersistenceIntegrationV2Result =
  Readonly<{
    ok: boolean;
    integrationVersion:
      typeof MLB_SHADOW_MONITORING_PERSISTENCE_INTEGRATION_V2_VERSION;
    status: MLBShadowMonitoringPredictionPersistenceIntegrationV2Status;
    /**
     * The validated safe operational record (L5E2S-v2 output) OR null when
     * L5E2S-v2 itself could not produce a valid record.
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
/*  V2 persistence orchestrator                                                */
/* -------------------------------------------------------------------------- */

/**
 * Composes the V2 shadow-prediction orchestrator and the existing L5E2T
 * operational store into the inner persistence workflow.
 *
 * Execution order:
 *  1. receive V2 prediction-orchestrator-compatible input
 *  2. call orchestrateMLBShadowQuarantinePredictionV2 exactly once
 *  3. if L5E2S-v2 returns ok=false → OPERATIONAL_RECORD_INVALID (no L5E2T call)
 *  4. obtain only the validated safe operational record
 *  5. identity-invariant check on shadowRecordId / gamePk
 *  6. call existing L5E2T exactly once with repoRoot + safe record
 *  7. project L5E2T result into fixed safe integration status
 *  8. return safe operational record + operational-persistence metadata
 *  9. never call L5E2S-v2 or L5E2T a second time
 * 10. never rollback prediction quarantine
 *
 * @param input - Reuses the exact V2 prediction-orchestrator input type.
 *                The caller cannot forge derived operational status.
 * @returns A fixed safe integration result.
 */
export async function orchestrateMLBShadowMonitoringPredictionPersistenceV2(
  input: MLBShadowQuarantineOrchestratorV2Input,
): Promise<MLBShadowMonitoringPredictionPersistenceIntegrationV2Result> {
  /* ------------------------------------------------------------------ */
  /*  Step 2: call V2 prediction orchestrator exactly once.              */
  /* ------------------------------------------------------------------ */
  const predictionResult =
    await orchestrateMLBShadowQuarantinePredictionV2(input);

  /* ------------------------------------------------------------------ */
  /*  Step 3: if L5E2S-v2 returns ok=false → no L5E2T, no issue         */
  /*  forwarding.                                                        */
  /* ------------------------------------------------------------------ */
  if (!predictionResult.ok) {
    return {
      ok: false,
      integrationVersion:
        MLB_SHADOW_MONITORING_PERSISTENCE_INTEGRATION_V2_VERSION,
      status: 'OPERATIONAL_RECORD_INVALID',
      operationalRecord: null,
      operationalPersistenceAttempted: false,
      operationalArtifactCreated: false,
      operationalVerificationOk: false,
      operationalTempCleanupFailed: false,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Step 4: obtain only the validated safe operational record.        */
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
        MLB_SHADOW_MONITORING_PERSISTENCE_INTEGRATION_V2_VERSION,
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
  let integrationStatus: MLBShadowMonitoringPredictionPersistenceIntegrationV2Status =
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
  /*  Step 8: return safe operational record + persistence metadata.  */
  /*  No rollback, no cross-store transaction.                        */
  /* ------------------------------------------------------------------ */
  return {
    ok,
    integrationVersion:
      MLB_SHADOW_MONITORING_PERSISTENCE_INTEGRATION_V2_VERSION,
    status: integrationStatus,
    operationalRecord: validatedRecord,
    operationalPersistenceAttempted: true,
    operationalArtifactCreated: Boolean(storeResult.artifactCreated),
    operationalVerificationOk: Boolean(storeResult.verificationOk),
    operationalTempCleanupFailed: Boolean(storeResult.tempCleanupFailed),
  };
}
