/* -------------------------------------------------------------------------- */
/*  MLB Operational Prediction Collection — Fixture-Only Module (P5F-C7A-S1)   */
/* -------------------------------------------------------------------------- */
/*  Scientific-blindness lock:                                                */
/*    S1_SCIENTIFIC_ROLE              = NONE                                  */
/*    SCIENTIFIC_USE                  = NONE                                  */
/*    IS_PROSPECTIVE_HOLDOUT_EVIDENCE = false                                 */
/*    PUBLIC_OPERATIONAL_API_ALLOWED  = false                                 */
/*                                                                            */
/*  Fixture-only pipeline:                                                    */
/*    fixture input                                                            */
/*    -> canonical pregame snapshot                                          */
/*       (buildMLBRealDataPregameSnapshot — pure, no I/O)                      */
/*    -> C5 durable preparation (C4 identity + C3 persist)                     */
/*       (orchestrateMLBShadowPreparation)                                    */
/*    -> C6 eligibility check (read-only)                                    */
/*       (checkPreparedJobDispatchReadiness)                                  */
/*    -> quarantined V2 handoff (read + execute + persist)                   */
/*       (executeStoredMLBShadowPreparedExecutionJobV2)                      */
/*    -> prediction persistence result                                       */
/*                                                                            */
/*  Safety guarantees:                                                        */
/*    - Importing this module MUST NOT execute any prediction or network I/O. */
/*    - Direct CLI execution is ALWAYS rejected with                         */
/*      LIVE_COLLECTION_NOT_AUTHORIZED.                                       */
/*    - RESEARCH_DATA_MODE=live does NOT override the CLI restriction.        */
/*    - The function never instantiates a live MLB provider.                  */
/*    - Only explicitly injected synthetic fixture data is processed.        */
/*    - No real project runtime writes — all writes target the isolated       */
/*      repoRoot parameter.                                                  */
/*    - No retry. No exactly-once guarantees. No alternate scorer/store.     */
/*    - Preserves the C4 shadowRecordId throughout C5 -> C6 -> V2 handoff.    */
/* -------------------------------------------------------------------------- */

/* === Type-only imports (stripped at build — no runtime side effects) ======= */

import type {
  MLBRealDataPregameSnapshotBridgeInput,
  MLBRealDataPregameSnapshotBridgeIssue,
} from '@/prediction/mlb/mlb-real-data-pregame-snapshot-bridge';
import type { MLBCanonicalPregameSnapshot } from '@/prediction/mlb/mlb-pregame-snapshot-contract';
import type {
  MLBShadowPreparationRequestOrchestrationRequest,
  MLBShadowPreparationRequestOrchestrationResult,
} from '@/prediction/mlb/mlb-shadow-preparation-request-orchestrator';
import type { MLBShadowPreparedJobDispatchReadinessResult } from '@/prediction/mlb/mlb-shadow-prepared-job-dispatch-eligibility';
import type { MLBShadowPreparedExecutionJobV2HandoffResult } from '@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-handoff';
import type { MLBShadowExecutionAdapterV2Result } from '@/prediction/mlb/mlb-shadow-execution-adapter-v2';

/* === Runtime imports (sealed pipeline functions + sealed manifest) ======== */

import { buildMLBRealDataPregameSnapshot } from '@/prediction/mlb/mlb-real-data-pregame-snapshot-bridge';
import { orchestrateMLBShadowPreparation } from '@/prediction/mlb/mlb-shadow-preparation-request-orchestrator';
import { checkPreparedJobDispatchReadiness } from '@/prediction/mlb/mlb-shadow-prepared-job-dispatch-eligibility';
import { executeStoredMLBShadowPreparedExecutionJobV2 } from '@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-handoff';
import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';

/* === Node URL utility (for CLI guard only) ================================ */

import { pathToFileURL } from 'node:url';

/* === Node filesystem + path utilities (for temp-root validation only) ===== */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

/* -------------------------------------------------------------------------- */
/*  Deterministic timestamp inputs — all caller-supplied (no system clock)    */
/*                                                                            */
/*  predictionGeneratedAt:              ISO-8601 — when prediction was made   */
/*  timingReferenceContractVersion:     contract version for timing reference  */
/*  timingReferenceCutoffAt:            ISO-8601 — data cutoff boundary       */
/* -------------------------------------------------------------------------- */

export type MLBPredictionTimestampInputs = Readonly<{
  predictionGeneratedAt: string;
  timingReferenceContractVersion: string;
  timingReferenceCutoffAt: string;
}>;

/* -------------------------------------------------------------------------- */
/*  Validated result union — kind-tagged discriminated union                   */
/*                                                                            */
/*  Each failure branch carries the underlying sealed result from the         */
/*  failing stage, plus the preserved C4 shadowRecordId where available.      */
/* -------------------------------------------------------------------------- */

export type MLBOperationalPredictionCollectionResult =
  | Readonly<{
      kind: 'UNAUTHORIZED';
      reason: 'LIVE_COLLECTION_NOT_AUTHORIZED';
      detail: string;
    }>
  | Readonly<{
      kind: 'INVALID_TEMP_ROOT';
      stage: 'TEMP_ROOT_VALIDATION';
      reason: string;
    }>
  | Readonly<{
      kind: 'INVALID_INPUT';
      stage: 'INPUT';
      issues: readonly MLBRealDataPregameSnapshotBridgeIssue[];
    }>
  | Readonly<{
      kind: 'NON_PREGAME_GAME';
      stage: 'GAME_STATUS';
      scheduleStatus: string;
      eventStatus: string;
    }>
  | Readonly<{
      kind: 'TIMING_VIOLATION';
      stage: 'PREDICTION_AT_OR_AFTER_START';
      predictionGeneratedAt: string;
      scheduledStartAt: string;
    }>
  | Readonly<{
      kind: 'BRIDGE_REJECTED';
      stage: 'BRIDGE';
      issues: readonly MLBRealDataPregameSnapshotBridgeIssue[];
    }>
  | Readonly<{
      kind: 'C5_FAILURE';
      stage: 'PREPARATION';
      shadowRecordId: string | null;
      orchestrationResult: MLBShadowPreparationRequestOrchestrationResult;
    }>
  | Readonly<{
      kind: 'C6_FAILURE';
      stage: 'ELIGIBILITY';
      shadowRecordId: string;
      eligibilityResult: MLBShadowPreparedJobDispatchReadinessResult;
    }>
  | Readonly<{
      kind: 'HANDOFF_FAILURE';
      stage: 'HANDOFF';
      shadowRecordId: string;
      handoffResult: MLBShadowPreparedExecutionJobV2HandoffResult;
    }>
  | Readonly<{
      kind: 'SUCCESS';
      shadowRecordId: string;
      canonicalSnapshot: MLBCanonicalPregameSnapshot;
      orchestrationResult: MLBShadowPreparationRequestOrchestrationResult;
      eligibilityResult: MLBShadowPreparedJobDispatchReadinessResult;
      handoffResult: MLBShadowPreparedExecutionJobV2HandoffResult;
      persistenceResult: MLBShadowExecutionAdapterV2Result;
    }>;

/* -------------------------------------------------------------------------- */
/*  Non-pregame status sets (fail-closed)                                      */
/*                                                                            */
/*  Schedule-game status values that indicate the game is NOT pregame.        */
/*  'UPCOMING' is the only pregame schedule status.                            */
/*                                                                            */
/*  Research-snapshot event status values that indicate the game is NOT      */
/*  pregame — these overlap with the bridge's own rejection set.                */
/* -------------------------------------------------------------------------- */

const NON_PREGAME_SCHEDULE_STATUSES: ReadonlySet<string> = new Set<string>([
  'LIVE',
  'FINAL',
  'POSTPONED',
  'CANCELLED',
  'UNKNOWN',
]);

const NON_PREGAME_EVENT_STATUSES: ReadonlySet<string> = new Set<string>([
  'LIVE',
  'FINAL',
  'POSTPONED',
  'CANCELLED',
]);

/* -------------------------------------------------------------------------- */
/*  Temporary root validation — fail-closed fixture isolation                 */
/*                                                                            */
/*  Enforces that repoRoot is a canonical, immediate child of the system      */
/*  temporary directory whose basename carries the fixture prefix.            */
/*  This is fixture-isolation enforcement, NOT production security            */
/*  authorization. Filesystem state may change after validation (TOCTOU):     */
/*  this guard does NOT claim protection against a racing adversary.         */
/*                                                                            */
/*    A. absolute path     B. existing directory    C. not a symlink (lstat)  */
/*    D. canonical realpath(repoRoot)  E. canonical realpath(os.tmpdir())     */
/*    F. immediate child of canonical tmpdir  G. basename starts with prefix  */
/*    H. rejects project repo  I. rejects external paths  J. non-exist/relative */
/*    K. canonical parent escapes tmpdir rejected  L. catch + fail closed     */
/* -------------------------------------------------------------------------- */

const FIXTURE_ROOT_PREFIX = 'mrs-mlb-c7a-fixture-';

type TempRootValidationResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: string }>;

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

async function validateTemporaryRepoRoot(
  repoRoot: string,
): Promise<TempRootValidationResult> {
  /* A. repoRoot must be absolute. (J: reject relative paths.) */
  if (!path.isAbsolute(repoRoot)) {
    return Object.freeze({
      ok: false as const,
      reason: 'repoRoot must be an absolute path',
    });
  }

  /* B/C/J. Existence, directory, and not-a-symlink checks. */
  /*      lstat does NOT follow symlinks, so a symlinked root is detected. */
  try {
    const stats = await fs.lstat(repoRoot);
    if (stats.isSymbolicLink()) {
      return Object.freeze({
        ok: false as const,
        reason: 'repoRoot must not be a symbolic link',
      });
    }
    if (!stats.isDirectory()) {
      return Object.freeze({
        ok: false as const,
        reason: 'repoRoot must be an existing directory',
      });
    }
  } catch (err) {
    return Object.freeze({
      ok: false as const,
      reason:
        'repoRoot does not exist or is inaccessible: ' + errorMessage(err),
    });
  }

  /* D. Canonical real path of repoRoot. */
  let canonicalRepoRoot: string;
  try {
    canonicalRepoRoot = await fs.realpath(repoRoot);
  } catch (err) {
    return Object.freeze({
      ok: false as const,
      reason: 'Failed to resolve canonical repoRoot: ' + errorMessage(err),
    });
  }

  /* E. Canonical real path of the system temporary directory. */
  let canonicalTmpDir: string;
  try {
    canonicalTmpDir = await fs.realpath(os.tmpdir());
  } catch (err) {
    return Object.freeze({
      ok: false as const,
      reason:
        'Failed to resolve canonical temp directory: ' + errorMessage(err),
    });
  }

  /* F/K. Canonical repoRoot must be an IMMEDIATE CHILD of canonical tmpdir. */
  /*      Compare dirname of the resolved path, not a naive string prefix.   */
  /*      Rejects paths whose canonical parent escapes the temp directory.  */
  /*      (H) project repo and (I) arbitrary external paths are rejected.    */
  const canonicalParent = path.dirname(canonicalRepoRoot);
  if (canonicalParent !== canonicalTmpDir) {
    return Object.freeze({
      ok: false as const,
      reason:
        'repoRoot canonical parent must be the temp directory; ' +
        'rejecting non-fixture paths including the project repo and ' +
        'external paths',
    });
  }

  /* G. Basename must start with the fixture prefix. */
  const repoRootBasename = path.basename(canonicalRepoRoot);
  if (!repoRootBasename.startsWith(FIXTURE_ROOT_PREFIX)) {
    return Object.freeze({
      ok: false as const,
      reason:
        'repoRoot basename must start with "' +
        FIXTURE_ROOT_PREFIX +
        '"',
    });
  }

  return Object.freeze({ ok: true as const });
}

/* -------------------------------------------------------------------------- */
/*  Fixture-only operational prediction collection                            */
/*                                                                            */
/*  Orchestrates four sealed repository stages in sequence:                   */
/*    C4-br:  buildMLBRealDataPregameSnapshot  (pure — no I/O)                */
/*    C5:     orchestrateMLBShadowPreparation  (C4 identity + C3 persist)      */
/*    C6:     checkPreparedJobDispatchReadiness (read-only)                   */
/*    V2:     executeStoredMLBShadowPreparedExecutionJobV2 (quarantine + exec) */
/*                                                                            */
/*  All filesystem writes are confined to the caller-supplied isolated       */
/*  repoRoot. No retry. No exactly-once guarantees. No alternate              */
/*  scorer/store/registry/model/manifest/sportsbook.                        */
/* -------------------------------------------------------------------------- */

export async function fixtureMLBOperationalPredictionCollection(
  repoRoot: string,
  fixtureInput: MLBRealDataPregameSnapshotBridgeInput,
  preparationRequestId: string,
  timestamps: MLBPredictionTimestampInputs,
  generateShadowRecordId: () => string,
  fixtureExecutionPermission: boolean,
): Promise<MLBOperationalPredictionCollectionResult> {
  /* ------------------------------------------------------------------ *
   * Stage 0 — Fixture-execution permission gate                        *
   * Fail closed: if permission is not explicitly granted, do NOT      *
   * proceed.                                                              */
  /* ------------------------------------------------------------------ */
  if (!fixtureExecutionPermission) {
    return Object.freeze({
      kind: 'UNAUTHORIZED' as const,
      reason: 'LIVE_COLLECTION_NOT_AUTHORIZED' as const,
      detail:
        'Explicit fixture-execution permission is required. This module ' +
        'processes only explicitly injected synthetic fixture data and ' +
        'must not initiate operational collection.',
    });
  }

  /* ------------------------------------------------------------------ *
   * Stage 0.5 — Temporary root validation (fail-closed)                *
   * Validate repoRoot before any C5/C4/C3 persistence operation.      *
   * fixtureExecutionPermission=true must NOT bypass root validation.  *
   * Fixture-isolation enforcement, not production authorization.    *
   * ------------------------------------------------------------------ */
  const tempRootResult = await validateTemporaryRepoRoot(repoRoot);
  if (!tempRootResult.ok) {
    return Object.freeze({
      kind: 'INVALID_TEMP_ROOT' as const,
      stage: 'TEMP_ROOT_VALIDATION' as const,
      reason: tempRootResult.reason,
    });
  }

  /* ------------------------------------------------------------------ *
   * Stage 1 — Basic input structural validation                         *
   * Fail closed: reject input that is not a non-null object with        *
   * the expected top-level shape before any downstream stage.            */
  /* ------------------------------------------------------------------ */
  if (fixtureInput === null || typeof fixtureInput !== 'object') {
    const inputIssues: MLBRealDataPregameSnapshotBridgeIssue[] = [
      {
        code: 'NOT_PLAIN_OBJECT',
        path: '$',
        message:
          'fixtureInput must be a non-null object containing scheduleGame ' +
          'and researchSnapshot',
      },
    ];
    return Object.freeze({
      kind: 'INVALID_INPUT' as const,
      stage: 'INPUT' as const,
      issues: Object.freeze(inputIssues),
    });
  }

  /* ------------------------------------------------------------------ *
   * Stage 2 — Non-pregame game check (fail closed)                      *
   * A game that has started, finished, or has unknown status is NOT     *
   * pregame. Short-circuit before C5 (which writes to disk).            */
  /* ------------------------------------------------------------------ */
  const scheduleStatus = fixtureInput.scheduleGame.status;
  const eventStatus = fixtureInput.researchSnapshot.event.status;
  if (
    NON_PREGAME_SCHEDULE_STATUSES.has(scheduleStatus) ||
    NON_PREGAME_EVENT_STATUSES.has(eventStatus)
  ) {
    return Object.freeze({
      kind: 'NON_PREGAME_GAME' as const,
      stage: 'GAME_STATUS' as const,
      scheduleStatus,
      eventStatus,
    });
  }

  /* ------------------------------------------------------------------ *
   * Stage 3 — Prediction timing check (fail closed, anti-leakage)       *
   * predictionGeneratedAt must be STRICTLY before scheduledStartAt.    *
   * At or after start = potential future-knowledge leakage.             */
  /* ------------------------------------------------------------------ */
  const predictionGeneratedAtMs = new Date(
    timestamps.predictionGeneratedAt,
  ).getTime();
  const scheduledStartAtMs = fixtureInput.scheduleGame.startTimeUtc.getTime();

  if (
    Number.isNaN(predictionGeneratedAtMs) ||
    Number.isNaN(scheduledStartAtMs)
  ) {
    const inputIssues: MLBRealDataPregameSnapshotBridgeIssue[] = [
      {
        code: 'INVALID_TIMESTAMP',
        path: '$.predictionGeneratedAt',
        message:
          'predictionGeneratedAt and scheduleGame.startTimeUtc must be ' +
          'valid timestamps',
      },
    ];
    return Object.freeze({
      kind: 'INVALID_INPUT' as const,
      stage: 'INPUT' as const,
      issues: Object.freeze(inputIssues),
    });
  }

  if (predictionGeneratedAtMs >= scheduledStartAtMs) {
    return Object.freeze({
      kind: 'TIMING_VIOLATION' as const,
      stage: 'PREDICTION_AT_OR_AFTER_START' as const,
      predictionGeneratedAt: timestamps.predictionGeneratedAt,
      scheduledStartAt: fixtureInput.scheduleGame.startTimeUtc.toISOString(),
    });
  }

  /* ------------------------------------------------------------------ *
   * Stage 4 — Canonical pregame snapshot (C4 bridge, pure)              *
   * buildMLBRealDataPregameSnapshot is a pure function — no I/O,       *
   * no network, no filesystem.                                          */
  /* ------------------------------------------------------------------ */
  const bridgeResult = buildMLBRealDataPregameSnapshot(fixtureInput);

  if (!bridgeResult.ok) {
    return Object.freeze({
      kind: 'BRIDGE_REJECTED' as const,
      stage: 'BRIDGE' as const,
      issues: bridgeResult.issues,
    });
  }

  const canonicalSnapshot: MLBCanonicalPregameSnapshot = bridgeResult.value;

  /* ------------------------------------------------------------------ *
   * Stage 5 — C5 durable preparation (C4 identity + C3 persist)         *
   * Orchestrates identity resolution followed by preparation.           *
   * Writes are confined to the isolated repoRoot.                        */
  /* ------------------------------------------------------------------ */
  const dataCutoffMs = new Date(timestamps.timingReferenceCutoffAt).getTime();
  const latencyMs = predictionGeneratedAtMs - dataCutoffMs;

  const orchestrationRequest: MLBShadowPreparationRequestOrchestrationRequest =
    {
      gamePk: fixtureInput.scheduleGame.gamePk,
      predictionGeneratedAt: timestamps.predictionGeneratedAt,
      featureManifest: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
      snapshot: canonicalSnapshot,
      officialDate: fixtureInput.scheduleGame.officialDate,
      scheduledStartAt: canonicalSnapshot.game.scheduledStartAt,
      latencyMs,
      featureManifestId: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
      featureManifestFingerprint:
        MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
      timingReferenceContractVersion: timestamps.timingReferenceContractVersion,
      timingReferenceCutoffAt: timestamps.timingReferenceCutoffAt,
      repoRoot,
      preparationRequestId,
    };

  const orchestrationResult = await orchestrateMLBShadowPreparation(
    orchestrationRequest,
    generateShadowRecordId,
  );

  if (orchestrationResult.status !== 'SUCCESS') {
    /* --------------------------------------------------------------
     * C5 failed — C4 may or may not have produced a shadowRecordId.
     * REGISTRY_FAILURE:  C4 identity resolution failed.
     *                    shadowRecordId is null in registryResult.
     * PREPARATION_FAILURE: C4 succeeded but C3 preparation failed.
     *                    shadowRecordId is present in registryResult.
     * -------------------------------------------------------------- */
    const c4ShadowRecordId = orchestrationResult.registryResult.shadowRecordId;
    return Object.freeze({
      kind: 'C5_FAILURE' as const,
      stage: 'PREPARATION' as const,
      shadowRecordId: c4ShadowRecordId,
      orchestrationResult,
    });
  }

  /* ------------------------------------------------------------------ */
  /*  C5 succeeded — extract and preserve the C4 shadowRecordId.          */
  /* ------------------------------------------------------------------ */
  if (!orchestrationResult.registryResult.ok) {
    /* INVARIANT: status === 'SUCCESS' implies registryResult.ok.      */
    /* Fail closed if the invariant is violated.                        */
    return Object.freeze({
      kind: 'C5_FAILURE' as const,
      stage: 'PREPARATION' as const,
      shadowRecordId: null,
      orchestrationResult,
    });
  }
  const preservedShadowRecordId = orchestrationResult.registryResult.shadowRecordId;

  /* ------------------------------------------------------------------ *
   * Stage 6 — C6 eligibility check (read-only)                          *
   * Read-only point-in-time check. No writes, no dispatch, no mutation. */
  /* ------------------------------------------------------------------ */
  const eligibilityResult = await checkPreparedJobDispatchReadiness(
    repoRoot,
    preservedShadowRecordId,
  );

  if (eligibilityResult.kind !== 'ELIGIBLE') {
    return Object.freeze({
      kind: 'C6_FAILURE' as const,
      stage: 'ELIGIBILITY' as const,
      shadowRecordId: preservedShadowRecordId,
      eligibilityResult,
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Stage 7 — Quarantined V2 handoff                                     */
  /*  Reads the prepared-job artifact and executes via the V2 adapter.   */
  /*  Writes are confined to the isolated repoRoot.                       */
  /* ------------------------------------------------------------------ */
  const handoffResult = await executeStoredMLBShadowPreparedExecutionJobV2(
    repoRoot,
    preservedShadowRecordId,
  );

  if (handoffResult.kind !== 'ADAPTER_RESULT') {
    return Object.freeze({
      kind: 'HANDOFF_FAILURE' as const,
      stage: 'HANDOFF' as const,
      shadowRecordId: preservedShadowRecordId,
      handoffResult,
    });
  }

  /* ------------------------------------------------------------------ *
   * Stage 8 — Prediction persistence result                            *
   * The adapter result IS the prediction persistence result.           */
  /* ------------------------------------------------------------------ */
  return Object.freeze({
    kind: 'SUCCESS' as const,
    shadowRecordId: preservedShadowRecordId,
    canonicalSnapshot,
    orchestrationResult,
    eligibilityResult,
    handoffResult,
    persistenceResult: handoffResult.result,
  });
}

/* -------------------------------------------------------------------------- */
/*  CLI guard — direct execution is ALWAYS prohibited                         */
/*                                                                            */
/*  This module is fixture-only. Direct CLI execution would imply             */
/*  operational collection intent, which is NOT authorized here.              */
/*  RESEARCH_DATA_MODE=live does NOT override this restriction.               */
/* -------------------------------------------------------------------------- */

function isDirectExecution(
  moduleUrl: string,
  argvEntry: string | undefined,
): boolean {
  return argvEntry !== undefined && moduleUrl === pathToFileURL(argvEntry).href;
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  console.error(
    'LIVE_COLLECTION_NOT_AUTHORIZED: Direct CLI execution of the ' +
      'fixture-only prediction collector is prohibited. This module ' +
      'processes only explicitly injected synthetic fixture data and ' +
      'must not be invoked as an operational collection entry point. ' +
      'Setting RESEARCH_DATA_MODE=live does not override this restriction.',
  );
  process.exit(1);
}
