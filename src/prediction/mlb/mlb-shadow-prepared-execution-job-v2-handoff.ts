/* -------------------------------------------------------------------------- */
/*  MLB shadow prepared-execution-job V2 handoff (P5F-C2B-R1)                  */
/* -------------------------------------------------------------------------- */
/*  Classification: QUARANTINED_INTERNAL_EXECUTION                            */
/*                                                                            */
/*  This module is the SINGLE internal handoff that binds together the         */
/*  sealed prepared-reader and the sealed V2 execution adapter:                */
/*                                                                            */
/*    repoRoot, shadowRecordId                                                */
/*      -> readMLBShadowPreparedExecutionJobV2 (reader)                        */
/*      -> explicit 14-field V2 execution job (no object spread)              */
/*      -> executeMLBShadowExecutionJobV2 (adapter, OPTION-B result)            */
/*      -> MLBShadowPreparedExecutionJobV2HandoffResult (kind-tagged)          */
/*                                                                            */
/*  S1 operational read: PROHIBITED (quarantined internal execution only).    */
/*  Public operational API: PROHIBITED.                                       */
/*  Direct user API: PROHIBITED.                                              */
/*  Scientific transformation: NO.                                            */
/*  Runtime-only injection: repoRoot (caller-supplied).                       */
/*                                                                            */
/*  Imports are limited to:                                                    */
/*    - ./mlb-shadow-prepared-execution-job-v2-reader                          */
/*    - ./mlb-shadow-execution-adapter-v2                                      */
/*                                                                            */
/*  No prepared-contract, no prepared-store, no V2 execution-job-contract,    */
/*  no persistence-orchestrator, no namespace, no Node core modules,          */
/*  no clock, no randomness, no filesystem I/O, no retry, no logging.         */
/* -------------------------------------------------------------------------- */

import {
  readMLBShadowPreparedExecutionJobV2,
  type MLBShadowPreparedExecutionJobV2ReaderResult,
} from './mlb-shadow-prepared-execution-job-v2-reader';
import {
  MLB_SHADOW_EXECUTION_ADAPTER_V2_VERSION,
  executeMLBShadowExecutionJobV2,
  type MLBShadowExecutionAdapterV2Result,
} from './mlb-shadow-execution-adapter-v2';

/* -------------------------------------------------------------------------- */
/*  Handoff version (fixed literal — never reused)                           */
/* -------------------------------------------------------------------------- */
export const MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_HANDOFF_VERSION =
  'mlb-shadow-prepared-execution-job-v2-handoff-v1' as const;

/* -------------------------------------------------------------------------- */
/*  Sealed reader-failure result (Extract narrows to the ok:false branch).    */
/* -------------------------------------------------------------------------- */
type ReaderFailureResult = Extract<
  MLBShadowPreparedExecutionJobV2ReaderResult,
  { readonly ok: false }
>;

/* -------------------------------------------------------------------------- */
/*  Public handoff result — OPTION-B kind-tagged union (no outer `ok`).        */
/* -------------------------------------------------------------------------- */
export type MLBShadowPreparedExecutionJobV2HandoffResult =
  | Readonly<{
      handoffVersion: typeof MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_HANDOFF_VERSION;
      kind: 'READER_FAILURE';
      readerVersion: ReaderFailureResult['readerVersion'];
      status: ReaderFailureResult['status'];
    }>
  | Readonly<{
      handoffVersion: typeof MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_HANDOFF_VERSION;
      kind: 'ADAPTER_RESULT';
      adapterVersion: typeof MLB_SHADOW_EXECUTION_ADAPTER_V2_VERSION;
      result: MLBShadowExecutionAdapterV2Result;
    }>
  | Readonly<{
      handoffVersion: typeof MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_HANDOFF_VERSION;
      kind: 'HANDOFF_FAILURE';
      status: 'HANDOFF_UNEXPECTED_FAILURE';
    }>;

/* -------------------------------------------------------------------------- */
/*  Single internal prepared-job execution handoff.                            */
/*                                                                            */
/*  Calls readMLBShadowPreparedExecutionJobV2 exactly once and                  */
/*  executeMLBShadowExecutionJobV2 exactly once on reader success.              */
/*  No retry, no retry loop, no recursion, no clock, no randomness.            */
/*                                                                            */
/*  On reader failure: returns READER_FAILURE (adapter is NOT called).         */
/*  On reader success: constructs an explicit 14-field V2 job and              */
/*                       delegates to the adapter; wraps the full                */
/*                       MLBShadowExecutionAdapterV2Result by reference as       */
/*                       ADAPTER_RESULT (OPTION-B semantics).                   */
/*  On any thrown exception: returns HANDOFF_FAILURE.                           */
/* -------------------------------------------------------------------------- */
export async function executeStoredMLBShadowPreparedExecutionJobV2(
  repoRoot: string,
  shadowRecordId: string,
): Promise<MLBShadowPreparedExecutionJobV2HandoffResult> {
  try {
    const readerResult = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      shadowRecordId,
    );

    if (!readerResult.ok) {
      return Object.freeze({
        handoffVersion:
          MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_HANDOFF_VERSION,
        kind: 'READER_FAILURE',
        readerVersion: readerResult.readerVersion,
        status: readerResult.status,
      });
    }

    const prepared = readerResult.value;

    const job = {
      repoRoot: repoRoot,
      shadowRecordId: prepared.shadowRecordId,
      gamePk: prepared.gamePk,
      predictionGeneratedAt: prepared.predictionGeneratedAt,
      authorizedModelArtifact: prepared.authorizedModelArtifact,
      featureManifest: prepared.featureManifest,
      snapshot: prepared.snapshot,
      officialDate: prepared.officialDate,
      scheduledStartAt: prepared.scheduledStartAt,
      latencyMs: prepared.latencyMs,
      featureManifestId: prepared.featureManifestId,
      featureManifestFingerprint: prepared.featureManifestFingerprint,
      timingReferenceContractVersion: prepared.timingReferenceContractVersion,
      timingReferenceCutoffAt: prepared.timingReferenceCutoffAt,
    };

    const adapterResult = await executeMLBShadowExecutionJobV2(job);

    return Object.freeze({
      handoffVersion:
        MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_HANDOFF_VERSION,
      kind: 'ADAPTER_RESULT',
      adapterVersion: MLB_SHADOW_EXECUTION_ADAPTER_V2_VERSION,
      result: adapterResult,
    });
  } catch {
    return Object.freeze({
      handoffVersion:
        MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_HANDOFF_VERSION,
      kind: 'HANDOFF_FAILURE',
      status: 'HANDOFF_UNEXPECTED_FAILURE',
    });
  }
}
