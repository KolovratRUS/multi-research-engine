/* -------------------------------------------------------------------------- */
/*  MLB Shadow Monitoring operational store (L5E2T)                             */
/* -------------------------------------------------------------------------- */

/**
 * Write-once persistence store for the PREDICTION-stage operational snapshot.
 *
 * Scientific role:
 *  - SCIENTIFIC_USE = NONE
 *  - OPERATIONAL_STORE_IS_HOLDOUT_EVIDENCE = NO
 *  - OPERATIONAL_STORE_CAN_INFLUENCE_MODEL_SELECTION = NO
 *  - OPERATIONAL_STORE_CAN_INFLUENCE_2027_HOLDOUT = NO
 *
 * Security properties enforced:
 *  - record is structurally validated BEFORE any filesystem touch
 *  - raw validator issues are NEVER returned through the persistence result
 *  - only the validated .value is serialized — never the raw unknown input
 *  - stage gate: downstream RESULT/GRADING fields must be null
 *  - SHA-256(shadowRecordId) is the sole filename component — raw IDs never
 *    reach a path, defeating slash / backslash / ".." traversal
 *  - every ancestor from repoRoot down to the operational directory is
 *    lstat'd (not stat'd) to detect symlinks; non-directory ancestors fail
 *    closed
 *  - realpath containment is proven after directory creation and re-checked
 *    immediately before finalization
 *  - final artifact is write-once: an existing non-identical final file fails
 *    closed with ALREADY_EXISTS; an identical final file returns
 *    IDEMPOTENT_IDENTICAL_SUCCESS
 *  - temp file is created with O_EXCL ('wx') and 0600 mode
 *  - finalization uses fs.link (hard link), never rename or replace
 *  - no public operational reader is exposed
 *
 * Allowed imports only:
 *  node:fs/promises  node:path  node:crypto
 *  ./mlb-shadow-monitoring-record-contract
 *  ./mlb-shadow-monitoring-namespace
 */

import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

import {
  validateMLBShadowMonitoringOperationalRecord,
  type MLBShadowMonitoringOperationalRecord,
} from './mlb-shadow-monitoring-record-contract';
import {
  resolveShadowMonitoringOperationalPath,
  isWithinShadowMonitoringRoot,
  isWithinProtectedScientificPath,
  MLB_SHADOW_MONITORING_OPERATIONAL_NAMESPACE,
  type MLBShadowMonitoringNamespacePath,
} from './mlb-shadow-monitoring-namespace';

/* -------------------------------------------------------------------------- */
/*  Store version                                                              */
/* -------------------------------------------------------------------------- */

export const MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION =
  'mlb-shadow-monitoring-operational-store-v1' as const;

/* -------------------------------------------------------------------------- */
/*  Stage constants (internal — not caller-selectable)                         */
/* -------------------------------------------------------------------------- */

const MLB_SHADOW_MONITORING_OPERATIONAL_STAGE = 'PREDICTION' as const;

const FILENAME_SUFFIX = `__${MLB_SHADOW_MONITORING_OPERATIONAL_STAGE.toLowerCase()}.json`;

/* -------------------------------------------------------------------------- */
/*  Path constants                                                             */
/* -------------------------------------------------------------------------- */

const NAMESPACE_SEGMENTS: readonly string[] =
  MLB_SHADOW_MONITORING_OPERATIONAL_NAMESPACE.split('/');
const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

/* -------------------------------------------------------------------------- */
/*  Result types                                                               */
/* -------------------------------------------------------------------------- */

export type MLBShadowOperationalFailureStatus =
  | 'VALIDATION_FAILED'
  | 'INVALID_STAGE_STATE'
  | 'SHADOW_RECORD_ID_NULL'
  | 'SYMLINK_DETECTED'
  | 'NON_DIRECTORY_TARGET'
  | 'REPO_ROOT_INVALID'
  | 'ALREADY_EXISTS'
  | 'WRITE_ERROR'
  | 'UNKNOWN_ERROR';

export type MLBShadowOperationalPersistenceResult =
  | Readonly<{
      ok: true;
      storeVersion: typeof MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION;
      status:
        | 'PERSISTED'
        | 'PERSISTED_WITH_CLEANUP_WARNING'
        | 'IDEMPOTENT_IDENTICAL_SUCCESS';
      artifactCreated: boolean;
      verificationOk: true;
      tempCleanupFailed: boolean;
      shadowRecordId: string;
      stage: 'PREDICTION';
    }>
  | Readonly<{
      ok: false;
      storeVersion: typeof MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION;
      status: MLBShadowOperationalFailureStatus;
      artifactCreated: false;
      verificationOk: false;
      tempCleanupFailed: boolean;
      shadowRecordId: string | null;
      stage: 'PREDICTION';
    }>
  | Readonly<{
      ok: false;
      storeVersion: typeof MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION;
      status: 'VERIFICATION_FAILED';
      artifactCreated: true;
      verificationOk: false;
      tempCleanupFailed: boolean;
      shadowRecordId: string;
      stage: 'PREDICTION';
    }>;

/* -------------------------------------------------------------------------- */
/*  Internal helpers                                                            */
/* -------------------------------------------------------------------------- */

function extractErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const record = error as Record<string, unknown>;
  const code = record.code;
  if (typeof code === 'string') {
    return code;
  }
  return undefined;
}

type PathKind = 'symlink' | 'directory' | 'file' | 'missing';

async function classifyPath(filePath: string): Promise<PathKind> {
  try {
    const stat = await fs.lstat(filePath);
    if (stat.isSymbolicLink()) {
      return 'symlink';
    }
    if (stat.isDirectory()) {
      return 'directory';
    }
    return 'file';
  } catch (error) {
    const code = extractErrorCode(error);
    if (code === 'ENOENT') {
      return 'missing';
    }
    throw error;
  }
}

/**
 * Builds the ancestor chain from repoRoot down to the operational directory.
 *  [0] = repoRoot
 *  [1] = repoRoot/var
 *  [2] = repoRoot/var/mlb-development
 *  [3] = repoRoot/var/mlb-development/mlb-shadow-monitoring
 *  [4] = repoRoot/var/mlb-development/mlb-shadow-monitoring/operational
 */
function buildAncestorChain(repoRoot: string): readonly string[] {
  const chain: string[] = [repoRoot];
  let current = repoRoot;
  for (const seg of NAMESPACE_SEGMENTS) {
    current = path.join(current, seg);
    chain.push(current);
  }
  return chain;
}

type AncestorStatus =
  | 'REPO_ROOT_INVALID'
  | 'SYMLINK_DETECTED'
  | 'NON_DIRECTORY_TARGET';

type AncestorAudit =
  | { ok: true }
  | { ok: false; status: AncestorStatus };

/**
 * Walks every existing ancestor using lstat.
 * - any existing symlink          -> FAIL CLOSED
 * - any existing non-directory    -> FAIL CLOSED
 * - repoRoot must exist           -> else REPO_ROOT_INVALID
 *
 * ancestors[0] must be repoRoot itself.
 */
async function auditAncestors(
  ancestors: readonly string[],
): Promise<AncestorAudit> {
  for (let i = 0; i < ancestors.length; i++) {
    const ancestor = ancestors[i];
    if (ancestor === undefined) {
      return { ok: false, status: 'REPO_ROOT_INVALID' };
    }
    let kind: PathKind;
    try {
      kind = await classifyPath(ancestor);
    } catch {
      return { ok: false, status: 'REPO_ROOT_INVALID' };
    }
    if (kind === 'missing') {
      if (i === 0) {
        return { ok: false, status: 'REPO_ROOT_INVALID' };
      }
      continue;
    }
    if (kind === 'symlink') {
      return { ok: false, status: 'SYMLINK_DETECTED' };
    }
    if (kind !== 'directory') {
      return { ok: false, status: 'NON_DIRECTORY_TARGET' };
    }
  }
  return { ok: true };
}

/**
 * Checks the prediction-stage gate: downstream RESULT and GRADING fields
 * must all be exactly `null`. Any non-null value indicates the record
 * represents a future lifecycle stage that the PREDICTION writer must not
 * accept.
 */
function passesPredictionStageGate(
  record: MLBShadowMonitoringOperationalRecord,
): boolean {
  return (
    record.resultFetchSucceeded === null &&
    record.resultJoinMatched === null &&
    record.resultPayloadSchemaValid === null &&
    record.gradingRecordProduced === null &&
    record.gradingSchemaValid === null
  );
}

/**
 * Builds the canonical 27-field JSON serialization of the validated
 * operational record in explicit deterministic key order.
 */
function buildCanonicalBytes(
  record: MLBShadowMonitoringOperationalRecord,
): string {
  return JSON.stringify({
    contractVersion: record.contractVersion,
    mode: record.mode,
    scientificUse: record.scientificUse,
    isProspectiveHoldoutEvidence: record.isProspectiveHoldoutEvidence,
    eligibleForFutureValidation: record.eligibleForFutureValidation,
    eligibleForFutureTest: record.eligibleForFutureTest,
    shadowRecordId: record.shadowRecordId,
    gamePk: record.gamePk,
    officialDate: record.officialDate,
    scheduledStartAt: record.scheduledStartAt,
    predictionGeneratedAt: record.predictionGeneratedAt,
    pipelineStatus: record.pipelineStatus,
    failureCode: record.failureCode,
    latencyMs: record.latencyMs,
    sourceCandidateRecipeId: record.sourceCandidateRecipeId,
    sourceCandidateFingerprint: record.sourceCandidateFingerprint,
    featureManifestId: record.featureManifestId,
    featureManifestFingerprint: record.featureManifestFingerprint,
    timingReferenceContractVersion: record.timingReferenceContractVersion,
    timingReferenceCutoffAt: record.timingReferenceCutoffAt,
    predictionPayloadGenerated: record.predictionPayloadGenerated,
    predictionPayloadSchemaValid: record.predictionPayloadSchemaValid,
    resultFetchSucceeded: record.resultFetchSucceeded,
    resultJoinMatched: record.resultJoinMatched,
    resultPayloadSchemaValid: record.resultPayloadSchemaValid,
    gradingRecordProduced: record.gradingRecordProduced,
    gradingSchemaValid: record.gradingSchemaValid,
  });
}

/**
 * Derives the storage-key filename from the validated shadowRecordId:
 * SHA-256(UTF-8 exact validated shadowRecordId) + '__prediction.json'.
 */
function buildArtifactFilename(shadowRecordId: string): string {
  return (
    createHash('sha256')
      .update(shadowRecordId, 'utf-8')
      .digest('hex') + FILENAME_SUFFIX
  );
}

/**
 * Reads the final artifact and compares its bytes against the expected
 * canonical bytes. Used both for the pre-existing-file check and the
 * EEXIST-after-link recovery path.
 */
async function compareFinalBytes(
  finalPath: string,
  expectedCanonicalBytes: string,
): Promise<'identical' | 'different' | 'unreadable'> {
  let existingBytes: string;
  try {
    existingBytes = await fs.readFile(finalPath, 'utf-8');
  } catch {
    return 'unreadable';
  }
  return existingBytes === expectedCanonicalBytes ? 'identical' : 'different';
}

/* -------------------------------------------------------------------------- */
/*  Result factories                                                           */
/* -------------------------------------------------------------------------- */

function makePreFinalizationFailure(
  status: MLBShadowOperationalFailureStatus,
  shadowRecordId: string | null,
): MLBShadowOperationalPersistenceResult {
  return {
    ok: false as const,
    storeVersion: MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION,
    status,
    artifactCreated: false as const,
    verificationOk: false,
    tempCleanupFailed: false,
    shadowRecordId,
    stage: MLB_SHADOW_MONITORING_OPERATIONAL_STAGE,
  };
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Persists a validated PREDICTION-stage operational record to the filesystem
 * under <repoRoot>/var/mlb-development/mlb-shadow-monitoring/operational/
 *
 * The filename is SHA-256(shadowRecordId) + '__prediction.json'. No
 * prediction values, probabilities, decisionPolicy, payloadHash, model
 * fingerprint, outcome, or grading data appear in the path.
 *
 * Fails closed on every error condition. Never overwrites an existing
 * non-identical artifact.
 *
 * @param repoRoot  Absolute repository root (e.g. process.cwd()). Must exist.
 * @param record    Unknown — will be structurally validated before any FS action.
 * @returns Non-sensitive persistence result.
 */
export async function persistMLBShadowMonitoringPredictionOperationalRecord(
  repoRoot: string,
  record: unknown,
): Promise<MLBShadowOperationalPersistenceResult> {
  /* -- Step 1: structural validation (fail-closed, zero FS mutation) ------- */
  const validation =
    validateMLBShadowMonitoringOperationalRecord(record);
  if (!validation.ok) {
    return makePreFinalizationFailure('VALIDATION_FAILED', null);
  }
  const validated: MLBShadowMonitoringOperationalRecord = validation.value;

  /* -- Step 2: PREDICTION-stage gate (fail-closed, zero FS mutation) -------- */
  if (!passesPredictionStageGate(validated)) {
    return makePreFinalizationFailure('INVALID_STAGE_STATE', null);
  }

  /* -- Step 3: require non-null shadowRecordId ----------------------------- */
  if (validated.shadowRecordId == null) {
    return makePreFinalizationFailure('SHADOW_RECORD_ID_NULL', null);
  }
  const shadowRecordId = validated.shadowRecordId;

  /* -- Step 4: resolve namespace path -------------------------------------- */
  let namespacePath: MLBShadowMonitoringNamespacePath;
  try {
    namespacePath = resolveShadowMonitoringOperationalPath(repoRoot);
  } catch {
    return makePreFinalizationFailure('REPO_ROOT_INVALID', null);
  }

  const resolvedRepoRoot = namespacePath.repositoryRoot;
  const operationalDir = namespacePath.resolved;
  const ancestors = buildAncestorChain(resolvedRepoRoot);
  const artifactFilename = buildArtifactFilename(shadowRecordId);
  const finalPath = path.join(operationalDir, artifactFilename);
  const canonicalBytes = buildCanonicalBytes(validated);

  /* -- Step 5: ancestor symlink defense (first pass — before creating) ---- */
  const firstAudit = await auditAncestors(ancestors);
  if (!firstAudit.ok) {
    return makePreFinalizationFailure(firstAudit.status, shadowRecordId);
  }

  /* -- Step 6: create missing directories (restrictive mode 0700) -------- */
  for (const ancestor of ancestors) {
    try {
      await fs.mkdir(ancestor, { mode: DIR_MODE });
    } catch (error) {
      const code = extractErrorCode(error);
      if (code !== 'EEXIST') {
        return makePreFinalizationFailure('WRITE_ERROR', shadowRecordId);
      }
    }
  }

  /* -- Step 6b: repeat ancestor lstat after creation ---------------------- */
  const secondAudit = await auditAncestors(ancestors);
  if (!secondAudit.ok) {
    return makePreFinalizationFailure(secondAudit.status, shadowRecordId);
  }

  /* -- Step 7: realpath containment (defense-in-depth) ---------------------- */
  let realRepoRoot: string;
  let realOperationalDir: string;
  try {
    realRepoRoot = await fs.realpath(resolvedRepoRoot);
    realOperationalDir = await fs.realpath(operationalDir);
  } catch {
    return makePreFinalizationFailure('WRITE_ERROR', shadowRecordId);
  }

  const expectedOperationalDir = path.resolve(
    realRepoRoot,
    MLB_SHADOW_MONITORING_OPERATIONAL_NAMESPACE,
  );
  if (realOperationalDir !== expectedOperationalDir) {
    return makePreFinalizationFailure('SYMLINK_DETECTED', shadowRecordId);
  }
  if (!isWithinShadowMonitoringRoot(realOperationalDir, realRepoRoot)) {
    return makePreFinalizationFailure('SYMLINK_DETECTED', shadowRecordId);
  }
  if (isWithinProtectedScientificPath(realOperationalDir, realRepoRoot)) {
    return makePreFinalizationFailure('SYMLINK_DETECTED', shadowRecordId);
  }

  /* -- Step 8: check existing final target (write-once policy) ----------- */
  const finalKind = await classifyPath(finalPath);
  if (finalKind === 'symlink') {
    return makePreFinalizationFailure('SYMLINK_DETECTED', shadowRecordId);
  }
  if (finalKind === 'directory') {
    return makePreFinalizationFailure('NON_DIRECTORY_TARGET', shadowRecordId);
  }
  if (finalKind === 'file') {
    const comparison = await compareFinalBytes(
      finalPath,
      canonicalBytes,
    );
    if (comparison === 'identical') {
      return {
        ok: true as const,
        storeVersion: MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION,
        status: 'IDEMPOTENT_IDENTICAL_SUCCESS' as const,
        artifactCreated: false,
        verificationOk: true,
        tempCleanupFailed: false,
        shadowRecordId,
        stage: MLB_SHADOW_MONITORING_OPERATIONAL_STAGE,
      };
    }
    // Different bytes or unreadable — fail closed.
    return makePreFinalizationFailure('ALREADY_EXISTS', shadowRecordId);
  }

  /* -- Step 8b: repeat ancestor safety check immediately before finalization */
  const preFinalizeAudit = await auditAncestors(ancestors);
  if (!preFinalizeAudit.ok) {
    return makePreFinalizationFailure(preFinalizeAudit.status, shadowRecordId);
  }

  /* -- Step 9: atomic temp write (O_EXCL via 'wx', restrictive mode 0600) - */
  const tempName =
    artifactFilename + '.tmp-' + randomUUID();
  const tempPath = path.join(operationalDir, tempName);

  try {
    const tempHandle = await fs.open(tempPath, 'wx', FILE_MODE);
    try {
      await tempHandle.writeFile(canonicalBytes, 'utf-8');
      await tempHandle.sync();
    } finally {
      await tempHandle.close();
    }
  } catch {
    // Clean up temp file on error
    try {
      await fs.unlink(tempPath);
    } catch {
      /* best-effort */
    }
    return makePreFinalizationFailure('WRITE_ERROR', shadowRecordId);
  }

  /* -- Step 10: finalize with hard link (never rename/replace) ----------- */
  let artifactCreated = false;
  let linkError: unknown = null;
  try {
    await fs.link(tempPath, finalPath);
    artifactCreated = true;
  } catch (error) {
    linkError = error;
  }

  /* -- Step 11: best-effort temp cleanup ---------------------------------- */
  let tempCleanupFailed = false;
  try {
    await fs.unlink(tempPath);
  } catch {
    tempCleanupFailed = true;
  }

  if (!artifactCreated) {
    const code = extractErrorCode(linkError);
    if (code === 'EEXIST') {
      // Concurrent writer: compare final bytes against our canonical bytes.
      const comparison = await compareFinalBytes(
        finalPath,
        canonicalBytes,
      );
      if (comparison === 'identical') {
        return {
          ok: true as const,
          storeVersion: MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION,
          status: 'IDEMPOTENT_IDENTICAL_SUCCESS' as const,
          artifactCreated: false,
          verificationOk: true,
          tempCleanupFailed,
          shadowRecordId,
          stage: MLB_SHADOW_MONITORING_OPERATIONAL_STAGE,
        };
      }
      return makePreFinalizationFailure('ALREADY_EXISTS', shadowRecordId);
    }
    return makePreFinalizationFailure('WRITE_ERROR', shadowRecordId);
  }

  /* -- Step 12: fsync containing directory (best-effort) ----------------- */
  try {
    const dirHandle = await fs.open(operationalDir, 'r');
    try {
      await dirHandle.sync();
    } finally {
      await dirHandle.close();
    }
  } catch {
    /* best-effort directory fsync — does not roll back the linked artifact */
  }

  /* -- Step 13: internal read-back verification --------------------------- */
  let readBack: string;
  try {
    readBack = await fs.readFile(finalPath, 'utf-8');
  } catch {
    return {
      ok: false as const,
      storeVersion: MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION,
      status: 'VERIFICATION_FAILED' as const,
      artifactCreated: true as const,
      verificationOk: false,
      tempCleanupFailed,
      shadowRecordId,
      stage: MLB_SHADOW_MONITORING_OPERATIONAL_STAGE,
    };
  }

  if (readBack !== canonicalBytes) {
    return {
      ok: false as const,
      storeVersion: MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION,
      status: 'VERIFICATION_FAILED' as const,
      artifactCreated: true as const,
      verificationOk: false,
      tempCleanupFailed,
      shadowRecordId,
      stage: MLB_SHADOW_MONITORING_OPERATIONAL_STAGE,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readBack);
  } catch {
    return {
      ok: false as const,
      storeVersion: MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION,
      status: 'VERIFICATION_FAILED' as const,
      artifactCreated: true as const,
      verificationOk: false,
      tempCleanupFailed,
      shadowRecordId,
      stage: MLB_SHADOW_MONITORING_OPERATIONAL_STAGE,
    };
  }

  const revalidation =
    validateMLBShadowMonitoringOperationalRecord(parsed);
  if (!revalidation.ok) {
    return {
      ok: false as const,
      storeVersion: MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION,
      status: 'VERIFICATION_FAILED' as const,
      artifactCreated: true as const,
      verificationOk: false,
      tempCleanupFailed,
      shadowRecordId,
      stage: MLB_SHADOW_MONITORING_OPERATIONAL_STAGE,
    };
  }

  // Re-canonicalize the validated parsed value and confirm it equals the
  // expected canonical bytes.
  const recanonicalBytes = buildCanonicalBytes(revalidation.value);
  if (recanonicalBytes !== canonicalBytes) {
    return {
      ok: false as const,
      storeVersion: MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION,
      status: 'VERIFICATION_FAILED' as const,
      artifactCreated: true as const,
      verificationOk: false,
      tempCleanupFailed,
      shadowRecordId,
      stage: MLB_SHADOW_MONITORING_OPERATIONAL_STAGE,
    };
  }

  /* -- Success ----------------------------------------------------------- */
  return {
    ok: true as const,
    storeVersion: MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION,
    status: tempCleanupFailed
      ? 'PERSISTED_WITH_CLEANUP_WARNING'
      : 'PERSISTED',
    artifactCreated: true,
    verificationOk: true,
    tempCleanupFailed,
    shadowRecordId,
    stage: MLB_SHADOW_MONITORING_OPERATIONAL_STAGE,
  };
}
