/* -------------------------------------------------------------------------- */
/*  Dormant preparation producer — MLB shadow prepared-execution-job V2        */
/*  Phase: 8V-D3-C-E4-B4-I3G-LIVE1-L5E2X-P5F-C3                              */
/*                                                                              */
/*  Architecture: INTEGRATED_PREPARE_AND_PERSIST                                */
/*  - Dormant: production importers = 0; NOT wired into handoff or dispatcher.  */
/*  - Enforces an exact 12-field raw-shape gate (non-scientific).             */
/*  - Sources Candidate-003 artifact as authorizedModelArtifact.              */
/*  - Constructs an explicit 13-field prepared job.                             */
/*  - Delegates exactly once to the sealed prepared store.                      */
/*  - Never inspects, clones, or mutates the store result.                      */
/* -------------------------------------------------------------------------- */

/* === Runtime imports (ONLY) =============================================== */

import {
  getMLBShadowCandidate003AuthorizedModelArtifact,
} from './mlb-shadow-candidate-003-authorized-model-artifact';
import {
  persistMLBShadowPreparedExecutionJobV2,
  type MLBShadowPreparedExecutionJobV2PersistenceResult,
} from './mlb-shadow-prepared-execution-job-v2-store';

/* === Type-only imports (ONLY) ============================================= */

import type { MLBShadowPreparedExecutionJobV2 } from './mlb-shadow-prepared-execution-job-v2-contract';

/* -------------------------------------------------------------------------- */
/*  Preparation version (fixed literal — as const, never reused)              */
/* -------------------------------------------------------------------------- */
export const MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_PREPARATION_VERSION =
  'mlb-shadow-prepared-execution-job-v2-preparation-v1' as const;

/* -------------------------------------------------------------------------- */
/*  Input type — the 12 fields the caller may supply.                        */
/*  authorizedModelArtifact is caller-forbidden and injected by the producer.  */
/* -------------------------------------------------------------------------- */
export type MLBShadowPreparedExecutionJobV2PreparationInput =
  Omit<MLBShadowPreparedExecutionJobV2, 'authorizedModelArtifact'>;

/* -------------------------------------------------------------------------- */
/*  Kind-tagged safe result contract (OPTION-B style: no outer `ok`).        */
/*                                                                              */
/*  - INPUT_REJECTED  → raw-shape gate failure (store never called)          */
/*  - STORE_RESULT    → store returned a finite result (ok true OR false)     */
/*  - PREPARATION_FAILURE → unexpected thrown exception                       */
/* -------------------------------------------------------------------------- */
export type MLBShadowPreparedExecutionJobV2PreparationResult =
  | Readonly<{
      preparationVersion:
        typeof MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_PREPARATION_VERSION;
      kind: 'INPUT_REJECTED';
      status: 'PREPARATION_INPUT_INVALID';
    }>
  | Readonly<{
      preparationVersion:
        typeof MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_PREPARATION_VERSION;
      kind: 'STORE_RESULT';
      result: MLBShadowPreparedExecutionJobV2PersistenceResult;
    }>
  | Readonly<{
      preparationVersion:
        typeof MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_PREPARATION_VERSION;
      kind: 'PREPARATION_FAILURE';
      status: 'PREPARATION_UNEXPECTED_FAILURE';
    }>;

/* -------------------------------------------------------------------------- */
/*  Exact 12-field raw-shape gate                                             */
/*                                                                              */
/*  The caller input must contain EXACTLY these 12 own string data properties. */
/*  No authorizedModelArtifact.  No repoRoot.  No unknown keys.  No symbols.  */
/*  No accessors (getters/setters).                                           */
/* -------------------------------------------------------------------------- */
const EXPECTED_INPUT_FIELD_NAMES = [
  'shadowRecordId',
  'gamePk',
  'predictionGeneratedAt',
  'featureManifest',
  'snapshot',
  'officialDate',
  'scheduledStartAt',
  'latencyMs',
  'featureManifestId',
  'featureManifestFingerprint',
  'timingReferenceContractVersion',
  'timingReferenceCutoffAt',
] as const;

/* -------------------------------------------------------------------------- */
/*  Frozen INPUT_REJECTED envelope factory                                    */
/* -------------------------------------------------------------------------- */
function createInputRejectedEnvelope(): MLBShadowPreparedExecutionJobV2PreparationResult {
  return Object.freeze({
    preparationVersion:
      MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_PREPARATION_VERSION,
    kind: 'INPUT_REJECTED' as const,
    status: 'PREPARATION_INPUT_INVALID' as const,
  });
}

/* -------------------------------------------------------------------------- */
/*  Main preparation entry point                                              */
/*                                                                              */
/*  Treats `input` as UNTRUSTED despite its TypeScript type:                    */
/*  - inspects ONLY shape via Object.getOwnPropertyDescriptor                 */
/*  - NEVER reads input field values directly                              */
/*  - NEVER invokes getters                                                   */
/*  - NEVER uses spread or assignment-merge                              */
/* -------------------------------------------------------------------------- */
export async function prepareMLBShadowPreparedExecutionJobV2(
  repoRoot: string,
  input: MLBShadowPreparedExecutionJobV2PreparationInput,
): Promise<MLBShadowPreparedExecutionJobV2PreparationResult> {
  try {
    /* ---- NON-SCIENTIFIC RAW-SHAPE GATE (Section 10) ----------------------- */

    // A. reject non-object / null / array
    if (
      typeof input !== 'object' ||
      input === null ||
      Array.isArray(input)
    ) {
      return createInputRejectedEnvelope();
    }

    // B. inspect own string names
    const ownNames = Object.getOwnPropertyNames(input);
    if (ownNames.length !== EXPECTED_INPUT_FIELD_NAMES.length) {
      return createInputRejectedEnvelope();
    }

    // C. every own name must be one of the 12 expected (exact set)
    const expectedNames = new Set<string>(EXPECTED_INPUT_FIELD_NAMES);
    for (const name of ownNames) {
      if (!expectedNames.has(name)) {
        return createInputRejectedEnvelope();
      }
    }

    // D. reject symbol-keyed properties
    const ownSymbols = Object.getOwnPropertySymbols(input);
    if (ownSymbols.length !== 0) {
      return createInputRejectedEnvelope();
    }

    // E. every expected field must be an own DATA descriptor (not accessor)
    //    Captured descriptor .value values are the ONLY bridge to the caller
    //    object — never read input field values directly.
    const captured: Record<string, PropertyDescriptor> = {};
    for (const key of EXPECTED_INPUT_FIELD_NAMES) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (!descriptor) {
        return createInputRejectedEnvelope();
      }
      // Reject accessors without invoking them
      if ('get' in descriptor || 'set' in descriptor) {
        return createInputRejectedEnvelope();
      }
      captured[key] = descriptor;
    }

    /* ---- CANDIDATE ARTIFACT (Section 11) ---------------------------------- */
    /* Caller never supplies authorizedModelArtifact. The frozen internal        */
    /* Candidate-003 artifact is the sole source. Invoked exactly once.         */
    const authorizedModelArtifact =
      getMLBShadowCandidate003AuthorizedModelArtifact();

    /* ---- EXPLICIT 13-FIELD PREPARED JOB (Section 12) ---------------------- */
    /* Constructed field-by-field from captured descriptor values.            */
    /* NO spread.  NO assignment-merge.  NO derived/generated fields.            */
    const preparedJob: MLBShadowPreparedExecutionJobV2 = {
      shadowRecordId: captured['shadowRecordId'].value,
      gamePk: captured['gamePk'].value,
      predictionGeneratedAt: captured['predictionGeneratedAt'].value,
      authorizedModelArtifact,
      featureManifest: captured['featureManifest'].value,
      snapshot: captured['snapshot'].value,
      officialDate: captured['officialDate'].value,
      scheduledStartAt: captured['scheduledStartAt'].value,
      latencyMs: captured['latencyMs'].value,
      featureManifestId: captured['featureManifestId'].value,
      featureManifestFingerprint:
        captured['featureManifestFingerprint'].value,
      timingReferenceContractVersion:
        captured['timingReferenceContractVersion'].value,
      timingReferenceCutoffAt: captured['timingReferenceCutoffAt'].value,
    };

    /* ---- STORE DELEGATION (Section 13) ------------------------------------ */
    /* Called EXACTLY once after accepted input. The finite store result is    */
    /* returned by reference — never cloned, frozen, inspected, or remapped.   */
    const storeResult = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      preparedJob,
    );

    return Object.freeze({
      preparationVersion:
        MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_PREPARATION_VERSION,
      kind: 'STORE_RESULT' as const,
      result: storeResult,
    });
  } catch {
    /* ---- UNEXPECTED THROW PATH (Section 14) -------------------------------- */
    /* Any actual thrown exception (e.g. a Proxy trap that throws, a getter    */
    /* that throws on descriptor retrieval, a store that throws) returns a     */
    /* frozen PREPARATION_FAILURE envelope.  No raw error properties exposed.  */
    return Object.freeze({
      preparationVersion:
        MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_PREPARATION_VERSION,
      kind: 'PREPARATION_FAILURE' as const,
      status: 'PREPARATION_UNEXPECTED_FAILURE' as const,
    });
  }
}
