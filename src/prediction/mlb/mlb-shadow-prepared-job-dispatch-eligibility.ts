/* -------------------------------------------------------------------------- */
/*  MLB Shadow prepared-job dispatch-eligibility gate (P5F-C6)                  */
/* -------------------------------------------------------------------------- */
/**
 * READ-ONLY point-in-time eligibility gate for a C3/C5 prepared execution-job
 * artifact.
 *
 * ELIGIBLE means ONLY: "The requested prepared-job artifact was found and
 * passed the reader's validation at the time of the check."
 *
 * It does NOT mean:
 *  - job has never been executed
 *  - job is approved for immediate dispatch
 *  - no concurrent dispatcher exists
 *  - dispatch is exactly-once
 *  - operational persistence will succeed
 *  - scientific writes are approved
 *  - snapshot is still current for live play
 *  - upstream C4 registry identity was checked
 *  - the caller has permission to execute
 *  - the result will remain valid indefinitely
 *
 * This is a read-only point-in-time check with a known TOCTOU (time-of-check /
 * time-of-use) gap between eligibility and the eventual dispatch. The result is
 * NOT an execution approval. A later dispatch may observe changed
 * filesystem state between eligibility and execution.
 *
 * PHASE SCOPE (P5F-C6): reader delegation only. This module performs NO writes,
 * NO model fitting, NO prediction computation, NO network I/O, NO clock reads,
 * and NO randomness. It delegates to the existing sealed reader exactly once.
 *
 * C6 has ZERO production importers. C6 is dormant until a future reviewed
 * execution phase elects to call it.
 *
 * C6 imports ONLY:
 *   - ./mlb-shadow-prepared-execution-job-v2-reader (runtime + type)
 *
 * C6 does NOT import: node:fs, node:crypto, handoff, adapter, store,
 * persistence orchestrator, prediction computation, snapshot acquisition,
 * external rate-feed modules, network stacks,
 * or model training.
 *
 * Scientific-blindness lock:
 *   S1_SCIENTIFIC_ROLE              = NONE
 *   SCIENTIFIC_USE                  = NONE
 *   IS_PROSPECTIVE_HOLDOUT_EVIDENCE = false
 *   PUBLIC_OPERATIONAL_API_ALLOWED  = false
 *   ELIGIBLE_FOR_FUTURE_VALIDATION  = false
 *   ELIGIBLE_FOR_FUTURE_TEST        = false
 */
import {
  readMLBShadowPreparedExecutionJobV2,
  type MLBShadowPreparedExecutionJobV2ReaderResult,
} from './mlb-shadow-prepared-execution-job-v2-reader';

/* -------------------------------------------------------------------------- */
/*  Eligibility version (fixed literal — never reused)                        */
/* -------------------------------------------------------------------------- */
export const MLB_SHADOW_PREPARED_JOB_DISPATCH_ELIGIBILITY_VERSION =
  'mlb-shadow-prepared-job-dispatch-eligibility-v1' as const;

/* -------------------------------------------------------------------------- */
/*  Reader result branches (derived from the existing reader's discriminant).  */
/*  The reader discriminates on `ok` (true | false). We use Extract to derive */
/*  the success and failure branches from the reader's own type — no copying */
/*  of the reader's diagnostic schema.                                       */
/* -------------------------------------------------------------------------- */
/**
 * The success (ok: true, status: 'READ_OK') branch of the reader result.
 * Used for the ELIGIBLE envelope's preserved readerResult.
 */
type ReaderOkResult = Extract<
  MLBShadowPreparedExecutionJobV2ReaderResult,
  { readonly ok: true }
>;

/**
 * The failure (ok: false) branch of the reader result. Preserves the exact
 * underlying failure status without remapping. Used for NOT_ELIGIBLE.
 */
type ReaderFailureResult = Extract<
  MLBShadowPreparedExecutionJobV2ReaderResult,
  { readonly ok: false }
>;

/* -------------------------------------------------------------------------- */
/*  Public eligibility result — kind-tagged discriminated union              */
/* -------------------------------------------------------------------------- */
/**
 * Read-only point-in-time readiness result.
 *
 * - kind: 'ELIGIBLE'     : the reader returned READ_OK.
 * - kind: 'NOT_ELIGIBLE' : the reader returned all failure statuses; the exact
 *   underlying reader status is preserved in readerResult.status.
 *
 * The original reader result is preserved in full (no remapping, no re-creation
 * of diagnostic fields). shadowRecordId is echoed for traceability only.
 *
 * NOTE: ELIGIBLE is NOT dispatch approval. See module-level doc comment
 * and the TOCTOU limitation above.
 */
export type MLBShadowPreparedJobDispatchReadinessResult =
  | Readonly<{
      eligibilityVersion:
        typeof MLB_SHADOW_PREPARED_JOB_DISPATCH_ELIGIBILITY_VERSION;
      kind: 'ELIGIBLE';
      shadowRecordId: string;
      readerResult: ReaderOkResult;
    }>
  | Readonly<{
      eligibilityVersion:
        typeof MLB_SHADOW_PREPARED_JOB_DISPATCH_ELIGIBILITY_VERSION;
      kind: 'NOT_ELIGIBLE';
      shadowRecordId: string;
      readerResult: ReaderFailureResult;
    }>;

/* -------------------------------------------------------------------------- */
/*  Single read-only eligibility check                                        */
/* -------------------------------------------------------------------------- */
/**
 * Checks whether a C3/C5 prepared execution-job artifact exists for the
 * requested shadowRecordId and passes the existing reader's validation.
 *
 * Calls readMLBShadowPreparedExecutionJobV2 EXACTLY ONCE. No retries.
 * No polling. No dispatch. No persistence. No filesystem mutation.
 *
 * @param repoRoot  Absolute repository root.
 * @param shadowRecordId  The shadow record identifier to check.
 * @returns A frozen, readonly, kind-tagged result.
 */
export async function checkPreparedJobDispatchReadiness(
  repoRoot: string,
  shadowRecordId: string,
): Promise<MLBShadowPreparedJobDispatchReadinessResult> {
  const readerResult = await readMLBShadowPreparedExecutionJobV2(
    repoRoot,
    shadowRecordId,
  );

  if (readerResult.ok) {
    return Object.freeze({
      eligibilityVersion:
        MLB_SHADOW_PREPARED_JOB_DISPATCH_ELIGIBILITY_VERSION,
      kind: 'ELIGIBLE',
      shadowRecordId,
      readerResult,
    });
  }

  return Object.freeze({
    eligibilityVersion:
      MLB_SHADOW_PREPARED_JOB_DISPATCH_ELIGIBILITY_VERSION,
    kind: 'NOT_ELIGIBLE',
    shadowRecordId,
    readerResult,
  });
}
