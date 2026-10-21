/* -------------------------------------------------------------------------- */
/*  MLB Shadow Preparation Request Orchestrator (P5F-C5)                      */
/* -------------------------------------------------------------------------- */
/**
 * Dormant orchestration seam that binds a C4 identity resolution to a single
 * C3 preparation call.
 *
 * Scientific role:
 *  - SCIENTIFIC_USE = NONE
 *  - Does NOT train, forecast, stake, or dispatch.
 *  - Does NOT read sportsbook odds or market data.
 *
 * Ordering (Section 5):
 *  1. Resolve a durable shadowRecordId via C4 (identity BEFORE preparation).
 *  2. On C4 ok=true, assemble an EXACT 12-field C3 input explicitly — no
 *     object spread, no repoRoot, no preparationRequestId, no
 *     authorizedModelArtifact.
 *  3. Call C3 at most once with request.repoRoot.
 *  4. Discriminate on the C3 result kind / result.ok.
 *
 * Limitation (Section 8):
 *  C4 binds only (preparationRequestId, gamePk, shadowRecordId) — it does NOT
 *  store snapshot, manifest fingerprint, or predictionGeneratedAt.  Therefore
 *  C5 cannot prove payload immutability across retries when no prepared
 *  artifact yet exists.  C3's canonical byte comparison is the enforcement
 *  point AFTER prepared-job persistence exists.  The upstream caller remains
 *  responsible for providing the same frozen preparation payload for identical
 *  retries.
 */

/* === Runtime imports (ONLY) ================================================= */

import {
  resolveOrAllocateMLBShadowPreparationIdentity,
} from './mlb-shadow-preparation-identity-store';
import {
  prepareMLBShadowPreparedExecutionJobV2,
} from './mlb-shadow-prepared-execution-job-v2-preparation';

/* === Type-only imports (ONLY) =============================================== */

import type { MLBShadowPreparationIdentityResolutionResult } from './mlb-shadow-preparation-identity-store';
import type {
  MLBShadowPreparedExecutionJobV2PreparationInput,
  MLBShadowPreparedExecutionJobV2PreparationResult,
} from './mlb-shadow-prepared-execution-job-v2-preparation';

/* -------------------------------------------------------------------------- */
/*  Orchestration version (fixed literal — as const, never reused)            */
/* -------------------------------------------------------------------------- */
export const MLB_SHADOW_PREPARATION_REQUEST_ORCHESTRATION_VERSION =
  'mlb-shadow-preparation-request-orchestrator-v1' as const;

/* -------------------------------------------------------------------------- */
/*  Request type — caller-supplied frozen preparation payload plus the       */
/*  caller-supplied repoRoot and preparationRequestId.                       */
/*  shadowRecordId is NOT caller-supplied; it is resolved by C4.           */
/* -------------------------------------------------------------------------- */
export type MLBShadowPreparationRequestOrchestrationRequest =
  Omit<
    MLBShadowPreparedExecutionJobV2PreparationInput,
    'shadowRecordId'
  > & {
    readonly repoRoot: string;
    readonly preparationRequestId: string;
  };

/* -------------------------------------------------------------------------- */
/*  Result type — exactly three outcome categories.                           */
/*  Discriminated on `status`.                                              */
/*                                                                     */
/*  REGISTRY_FAILURE — C4 ok=false; C3 was never called.                 */
/*  PREPARATION_FAILURE — C4 ok=true but C3 rejected or persisted ok=false. */
/*  SUCCESS — C4 ok=true and C3 STORE_RESULT result.ok=true.             */
/* -------------------------------------------------------------------------- */
export type MLBShadowPreparationRequestOrchestrationResult =
  | Readonly<{
      status: 'REGISTRY_FAILURE';
      orchestrationVersion:
        typeof MLB_SHADOW_PREPARATION_REQUEST_ORCHESTRATION_VERSION;
      preparationRequestId: string;
      gamePk: number;
      registryResult: MLBShadowPreparationIdentityResolutionResult;
    }>
  | Readonly<{
      status: 'PREPARATION_FAILURE';
      orchestrationVersion:
        typeof MLB_SHADOW_PREPARATION_REQUEST_ORCHESTRATION_VERSION;
      preparationRequestId: string;
      gamePk: number;
      registryResult: MLBShadowPreparationIdentityResolutionResult;
      preparationResult: MLBShadowPreparedExecutionJobV2PreparationResult;
    }>
  | Readonly<{
      status: 'SUCCESS';
      orchestrationVersion:
        typeof MLB_SHADOW_PREPARATION_REQUEST_ORCHESTRATION_VERSION;
      preparationRequestId: string;
      gamePk: number;
      registryResult: MLBShadowPreparationIdentityResolutionResult;
      preparationResult: MLBShadowPreparedExecutionJobV2PreparationResult;
    }>;

/* -------------------------------------------------------------------------- */
/*  Orchestration entry point                                                 */
/* -------------------------------------------------------------------------- */
/**
 * Orchestrates a shadow preparation request: resolves an identity via C4,
 * then delegates to C3 with the exact 12-field input.
 *
 * C5 does NOT execute or dispatch anything.  It makes at most one C4 call
 * and, on C4 success, at most one C3 call per invocation.  No retry loop.
 */
export async function orchestrateMLBShadowPreparation(
  request: MLBShadowPreparationRequestOrchestrationRequest,
  generateShadowRecordId: () => string,
): Promise<MLBShadowPreparationRequestOrchestrationResult> {
  /* --------------------------------------------------------------- *
   * Step B — Resolve durable identity via C4 (BEFORE preparation).   *
   * --------------------------------------------------------------- */
  const registryResult = await resolveOrAllocateMLBShadowPreparationIdentity(
    request.repoRoot,
    request.preparationRequestId,
    request.gamePk,
    generateShadowRecordId,
  );

  /* --------------------------------------------------------------- *
   * Step C — If C4 failed (ok=false), short-circuit.                *
   * Do NOT call C3.  Do NOT generate a replacement identity.        *
   * Do NOT roll back registry state.                                 *
   * --------------------------------------------------------------- */
  if (!registryResult.ok) {
    return Object.freeze({
      status: 'REGISTRY_FAILURE' as const,
      orchestrationVersion:
        MLB_SHADOW_PREPARATION_REQUEST_ORCHESTRATION_VERSION,
      preparationRequestId: request.preparationRequestId,
      gamePk: request.gamePk,
      registryResult,
    });
  }

  /* --------------------------------------------------------------- *
   * C4 ok=true: adopt the registry-returned shadowRecordId.        *
   * Never use a discarded provisional ID.                           *
   * --------------------------------------------------------------- */
  const shadowRecordId = registryResult.shadowRecordId;

  /* --------------------------------------------------------------- *
   * Step D — Build the EXACT C3 input (12 fields).                 *
   * Explicit field-by-field construction — NO object spread,       *
   * NO repoRoot, NO preparationRequestId, NO authorizedModelArtifact. *
   * Optional fields canonicalize undefined → null to satisfy the   *
   * frozen C3 raw-shape validator (which expects null, not         *
   * undefined).                                                    *
   * --------------------------------------------------------------- */
  const preparedInput: MLBShadowPreparedExecutionJobV2PreparationInput = {
    shadowRecordId,
    gamePk: request.gamePk,
    predictionGeneratedAt: request.predictionGeneratedAt,
    featureManifest: request.featureManifest,
    snapshot: request.snapshot,
    officialDate: request.officialDate ?? null,
    scheduledStartAt: request.scheduledStartAt ?? null,
    latencyMs: request.latencyMs ?? null,
    featureManifestId: request.featureManifestId ?? null,
    featureManifestFingerprint: request.featureManifestFingerprint ?? null,
    timingReferenceContractVersion:
      request.timingReferenceContractVersion ?? null,
    timingReferenceCutoffAt: request.timingReferenceCutoffAt ?? null,
  };

  /* --------------------------------------------------------------- *
   * Step E — Delegate to C3 (at most one call).                     *
   * --------------------------------------------------------------- */
  const preparationResult = await prepareMLBShadowPreparedExecutionJobV2(
    request.repoRoot,
    preparedInput,
  );

  /* --------------------------------------------------------------- *
   * Step F — Inspect the actual C3 result discriminant.             *
   * SUCCESS requires kind === 'STORE_RESULT' AND result.ok=true.   *
   * --------------------------------------------------------------- */
  if (
    preparationResult.kind === 'STORE_RESULT' &&
    preparationResult.result.ok
  ) {
    return Object.freeze({
      status: 'SUCCESS' as const,
      orchestrationVersion:
        MLB_SHADOW_PREPARATION_REQUEST_ORCHESTRATION_VERSION,
      preparationRequestId: request.preparationRequestId,
      gamePk: request.gamePk,
      registryResult,
      preparationResult,
    });
  }

  /* --------------------------------------------------------------- *
   * Any C3 failure: INPUT_REJECTED, PREPARATION_FAILURE, or         *
   * STORE_RESULT with result.ok=false → PREPARATION_FAILURE.        *
   * Preserve the C4 identity (do NOT delete, overwrite, or remap).  *
   * --------------------------------------------------------------- */
  return Object.freeze({
    status: 'PREPARATION_FAILURE' as const,
    orchestrationVersion:
      MLB_SHADOW_PREPARATION_REQUEST_ORCHESTRATION_VERSION,
    preparationRequestId: request.preparationRequestId,
    gamePk: request.gamePk,
    registryResult,
    preparationResult,
  });
}
