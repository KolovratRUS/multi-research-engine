/* -------------------------------------------------------------------------- */
/*  MLB Shadow Monitoring prepared-execution-job V2 store (C1B_QUARANTINE_WRITE) */
/* -------------------------------------------------------------------------- */
/**
 * Quarantined, deterministic, write-once persistence store for validated
 * prepared V2 execution jobs.
 *
 * Security properties enforced:
 *  - prepared job is structurally validated BEFORE any filesystem touch
 *  - SHA-256(shadowRecordId) is the sole filename component — raw IDs never
 *    reach a path, defeating slash / backslash / ".." traversal
 *  - every ancestor from repoRoot down to the prepared-jobs directory is
 *    lstat'd (not stat'd) to detect symlinks; non-directory ancestors fail closed
 *  - realpath containment is proven after directory creation and re-checked
 *    immediately before finalization
 *  - final artifact is write-once: an existing final file or directory fails
 *    closed with ALREADY_EXISTS; an identical final file returns
 *    IDEMPOTENT_IDENTICAL_SUCCESS
 *  - temp file is created with O_EXCL ('wx') and 0600 mode
 *  - finalization uses fs.link (hard link), never rename or replace
 *  - canonical serialization: JSON.stringify with NO whitespace, NO trailing
 *    newline, exact 13-field order per MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_FIELD_ORDER
 *  - no public prepared-job reader / loader / factory is exposed
 *
 * Allowed imports only:
 *  node:fs/promises  node:path  node:crypto
 *  ./mlb-shadow-prepared-execution-job-v2-contract
 *  ./mlb-shadow-monitoring-namespace
 */

import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

import {
  validateMLBShadowPreparedExecutionJobV2,
  type MLBShadowPreparedExecutionJobV2,
  type MLBShadowPreparedExecutionJobV2ValidationIssue,
} from './mlb-shadow-prepared-execution-job-v2-contract';
import {
  resolveShadowMonitoringNamespacePath,
  isWithinShadowMonitoringRoot,
  MLB_SHADOW_MONITORING_NAMESPACE_ROOT,
  type MLBShadowMonitoringNamespacePath,
} from './mlb-shadow-monitoring-namespace';

/* -------------------------------------------------------------------------- */
/*  Store version                                                             */
/* -------------------------------------------------------------------------- */

export const MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_STORE_VERSION =
  'mlb-shadow-prepared-execution-job-v2-store-v1' as const;

/* -------------------------------------------------------------------------- */
/*  Namespace (local; NOT added to the namespace module)                      */
/* -------------------------------------------------------------------------- */

const PREPARED_JOBS_RELATIVE = 'quarantine/prepared-jobs';
const PREPARED_JOBS_NAMESPACE =
  MLB_SHADOW_MONITORING_NAMESPACE_ROOT + '/' + PREPARED_JOBS_RELATIVE;

/* -------------------------------------------------------------------------- */
/*  Internal constants                                                          */
/* -------------------------------------------------------------------------- */

const NAMESPACE_SEGMENTS: readonly string[] = PREPARED_JOBS_NAMESPACE.split('/');
const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

/* -------------------------------------------------------------------------- */
/*  Result types                                                              */
/* -------------------------------------------------------------------------- */

export type MLBShadowPreparedExecutionJobV2FailureStatus =
  | 'VALIDATION_FAILED'
  | 'ALREADY_EXISTS'
  | 'SYMLINK_DETECTED'
  | 'NON_DIRECTORY_TARGET'
  | 'REPO_ROOT_INVALID'
  | 'WRITE_ERROR'
  | 'UNKNOWN_ERROR';

export type MLBShadowPreparedExecutionJobV2PersistenceResult =
  | Readonly<{
      ok: true;
      status: 'PERSISTED' | 'PERSISTED_WITH_CLEANUP_WARNING';
      storeVersion: string;
      artifactCreated: true;
      tempCleanupFailed: boolean;
      shadowRecordId: string;
      relativePath: string;
      verificationOk: true;
      issues: readonly MLBShadowPreparedExecutionJobV2ValidationIssue[];
    }>
  | Readonly<{
      ok: true;
      status: 'IDEMPOTENT_IDENTICAL_SUCCESS';
      storeVersion: string;
      artifactCreated: false;
      tempCleanupFailed: boolean;
      shadowRecordId: string;
      relativePath: string;
      verificationOk: true;
      issues: readonly MLBShadowPreparedExecutionJobV2ValidationIssue[];
    }>
  | Readonly<{
      ok: false;
      status: MLBShadowPreparedExecutionJobV2FailureStatus;
      storeVersion: string;
      artifactCreated: false;
      tempCleanupFailed: false;
      shadowRecordId: string | null;
      relativePath: null;
      verificationOk: null;
      issues: readonly MLBShadowPreparedExecutionJobV2ValidationIssue[];
    }>
  | Readonly<{
      ok: false;
      status: 'VERIFICATION_FAILED';
      storeVersion: string;
      artifactCreated: true;
      tempCleanupFailed: boolean;
      shadowRecordId: string;
      relativePath: string;
      verificationOk: false;
      issues: readonly MLBShadowPreparedExecutionJobV2ValidationIssue[];
    }>;

/* -------------------------------------------------------------------------- */
/*  Internal helpers                                                           */
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
 * Builds the ancestor chain from repoRoot down to the prepared-jobs directory.
 *  [0] = repoRoot
 *  [1] = repoRoot/var
 *  [2] = repoRoot/var/mlb-development
 *  [3] = repoRoot/var/mlb-development/mlb-shadow-monitoring
 *  [4] = .../quarantine
 *  [5] = .../quarantine/prepared-jobs
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
  | { ok: false; status: AncestorStatus; issue: MLBShadowPreparedExecutionJobV2ValidationIssue };

/**
 * Walks every existing ancestor using lstat.
 * - any existing symlink          -> FAIL CLOSED
 * - any existing non-directory    -> FAIL CLOSED
 * - repoRoot must exist           -> else REPO_ROOT_INVALID
 *
 * ancestors[0] must be repoRoot itself.
 */
async function auditAncestors(ancestors: readonly string[]): Promise<AncestorAudit> {
  for (let i = 0; i < ancestors.length; i++) {
    const ancestor = ancestors[i];
    if (ancestor === undefined) {
      return {
        ok: false,
        status: 'REPO_ROOT_INVALID',
        issue: makeGenericIssue('ancestor index out of range'),
      };
    }
    let kind: PathKind;
    try {
      kind = await classifyPath(ancestor);
    } catch {
      return {
        ok: false,
        status: 'REPO_ROOT_INVALID',
        issue: makeGenericIssue('filesystem error during ancestor audit'),
      };
    }
    if (kind === 'missing') {
      if (i === 0) {
        return {
          ok: false,
          status: 'REPO_ROOT_INVALID',
          issue: makeGenericIssue('repository root does not exist'),
        };
      }
      continue;
    }
    if (kind === 'symlink') {
      return {
        ok: false,
        status: 'SYMLINK_DETECTED',
        issue: makeGenericIssue('symlink detected in ancestor path'),
      };
    }
    if (kind !== 'directory') {
      return {
        ok: false,
        status: 'NON_DIRECTORY_TARGET',
        issue: makeGenericIssue('non-directory ancestor detected in quarantine path'),
      };
    }
  }
  return { ok: true };
}

/**
 * Builds the canonical 13-field JSON serialization of the validated prepared
 * job in exact MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_FIELD_ORDER.
 *
 * No whitespace, no trailing newline, UTF-8.
 */
function buildCanonicalBytes(
  preparedJob: MLBShadowPreparedExecutionJobV2,
): string {
  return JSON.stringify({
    shadowRecordId: preparedJob.shadowRecordId,
    gamePk: preparedJob.gamePk,
    predictionGeneratedAt: preparedJob.predictionGeneratedAt,
    authorizedModelArtifact: preparedJob.authorizedModelArtifact,
    featureManifest: preparedJob.featureManifest,
    snapshot: preparedJob.snapshot,
    officialDate: preparedJob.officialDate,
    scheduledStartAt: preparedJob.scheduledStartAt,
    latencyMs: preparedJob.latencyMs,
    featureManifestId: preparedJob.featureManifestId,
    featureManifestFingerprint: preparedJob.featureManifestFingerprint,
    timingReferenceContractVersion: preparedJob.timingReferenceContractVersion,
    timingReferenceCutoffAt: preparedJob.timingReferenceCutoffAt,
  });
}

/**
 * Compares an existing final artifact against expected canonical bytes.
 *
 * The existing file must:
 *  A. decode/parse as JSON
 *  B. pass validateMLBShadowPreparedExecutionJobV2
 *  C. recanonicalize to identical bytes (file is canonical)
 *  D. match the requested canonical bytes (idempotent)
 *
 * Internal-only — never exports artifact content or sensitive values.
 */
async function compareExistingFinalArtifact(
  finalPath: string,
  canonicalBytes: string,
): Promise<'identical' | 'different' | 'unreadable'> {
  let existingBytes: string;
  try {
    existingBytes = await fs.readFile(finalPath, 'utf-8');
  } catch {
    return 'unreadable';
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(existingBytes);
  } catch {
    return 'different';
  }

  const revalidation = validateMLBShadowPreparedExecutionJobV2(parsed);
  if (!revalidation.ok) {
    return 'different';
  }

  const recanonicalBytes = buildCanonicalBytes(revalidation.value);
  // Canonical existing bytes must equal actual final bytes (file must be canonical).
  if (recanonicalBytes !== existingBytes) {
    return 'different';
  }
  // Existing canonical bytes must equal requested canonical bytes.
  if (recanonicalBytes === canonicalBytes) {
    return 'identical';
  }
  return 'different';
}

function makeGenericIssue(message: string): MLBShadowPreparedExecutionJobV2ValidationIssue {
  return {
    code: 'PREPARED_JOB_INVALID',
    path: '$.store',
    message,
  };
}

function makeNotPersisted(
  status: MLBShadowPreparedExecutionJobV2FailureStatus,
  shadowRecordId: string | null,
  issues: MLBShadowPreparedExecutionJobV2ValidationIssue[],
): MLBShadowPreparedExecutionJobV2PersistenceResult {
  return {
    ok: false as const,
    status,
    storeVersion: MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_STORE_VERSION,
    artifactCreated: false as const,
    tempCleanupFailed: false,
    shadowRecordId,
    relativePath: null,
    verificationOk: null,
    issues: Object.freeze(issues),
  };
}

function makeIdempotentSuccess(
  shadowRecordId: string,
  relativePath: string,
  tempCleanupFailed: boolean,
): MLBShadowPreparedExecutionJobV2PersistenceResult {
  return {
    ok: true as const,
    status: 'IDEMPOTENT_IDENTICAL_SUCCESS' as const,
    storeVersion: MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_STORE_VERSION,
    artifactCreated: false as const,
    tempCleanupFailed,
    shadowRecordId,
    relativePath,
    verificationOk: true as const,
    issues: Object.freeze([]),
  };
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Persists a validated, quarantined prepared V2 execution job to the filesystem
 * under <repoRoot>/var/mlb-development/mlb-shadow-monitoring/quarantine/prepared-jobs/
 *
 * The filename is SHA-256(shadowRecordId) + ".json". No scientific payload
 * values, model coefficients, or filesystem paths appear in the file name.
 *
 * Fails closed on every error condition. Never overwrites an existing
 * non-identical artifact. Byte-identical retry returns IDEMPOTENT_IDENTICAL_SUCCESS.
 *
 * @param repoRoot  Absolute repository root (e.g. process.cwd()). Must exist.
 * @param preparedJob  Unknown — will be structurally validated before any FS action.
 * @returns Non-sensitive persistence result.
 */
export async function persistMLBShadowPreparedExecutionJobV2(
  repoRoot: string,
  preparedJob: unknown,
): Promise<MLBShadowPreparedExecutionJobV2PersistenceResult> {
  /* -- Step 1: structural validation (fail-closed, zero FS mutation) ------- */
  const validation = validateMLBShadowPreparedExecutionJobV2(preparedJob);
  if (!validation.ok) {
    return makeNotPersisted('VALIDATION_FAILED', null, [...validation.issues]);
  }
  const validated: MLBShadowPreparedExecutionJobV2 = validation.value;

  /* -- Step 2: resolve namespace path -------------------------------------- */
  let namespacePath: MLBShadowMonitoringNamespacePath;
  try {
    namespacePath = resolveShadowMonitoringNamespacePath(
      repoRoot,
      PREPARED_JOBS_RELATIVE,
    );
  } catch {
    return makeNotPersisted(
      'REPO_ROOT_INVALID',
      validated.shadowRecordId,
      [makeGenericIssue('repository root is invalid or path resolution failed')],
    );
  }

  const preparedJobsDir = namespacePath.resolved;
  const resolvedRepoRoot = namespacePath.repositoryRoot;
  const artifactFilename =
    createHash('sha256')
      .update(validated.shadowRecordId, 'utf-8')
      .digest('hex') + '.json';
  const finalPath = path.join(preparedJobsDir, artifactFilename);
  const relativePath = path.join(PREPARED_JOBS_RELATIVE, artifactFilename);

  /* -- Step 3: canonicalize validated 13-field value ----------------------- */
  const canonicalBytes = buildCanonicalBytes(validated);

  /* -- Step 4: ancestor symlink defense (first pass — before creating) ---- */
  const ancestors = buildAncestorChain(resolvedRepoRoot);
  const firstAudit = await auditAncestors(ancestors);
  if (!firstAudit.ok) {
    return makeNotPersisted(
      firstAudit.status,
      validated.shadowRecordId,
      [firstAudit.issue],
    );
  }

  /* -- Step 5: create missing directories (restrictive mode 0700) -------- */
  for (const ancestor of ancestors) {
    try {
      await fs.mkdir(ancestor, { mode: DIR_MODE });
    } catch (error) {
      const code = extractErrorCode(error);
      if (code !== 'EEXIST') {
        return makeNotPersisted(
          'WRITE_ERROR',
          validated.shadowRecordId,
          [makeGenericIssue('failed to create quarantine directory')],
        );
      }
    }
  }

  /* -- Step 5b: repeat ancestor lstat after creation --------------------- */
  const secondAudit = await auditAncestors(ancestors);
  if (!secondAudit.ok) {
    return makeNotPersisted(
      secondAudit.status,
      validated.shadowRecordId,
      [secondAudit.issue],
    );
  }

  /* -- Step 6: realpath containment (defense-in-depth) -------------------- */
  let realRepoRoot: string;
  let realPreparedJobsDir: string;
  try {
    realRepoRoot = await fs.realpath(resolvedRepoRoot);
    realPreparedJobsDir = await fs.realpath(preparedJobsDir);
  } catch {
    return makeNotPersisted(
      'WRITE_ERROR',
      validated.shadowRecordId,
      [makeGenericIssue('realpath resolution failed for quarantine path')],
    );
  }

  const expectedPreparedJobsDir = path.resolve(
    realRepoRoot,
    PREPARED_JOBS_NAMESPACE,
  );
  if (realPreparedJobsDir !== expectedPreparedJobsDir) {
    return makeNotPersisted(
      'SYMLINK_DETECTED',
      validated.shadowRecordId,
      [makeGenericIssue('realpath of prepared-jobs directory diverged from expected descendant')],
    );
  }
  if (!isWithinShadowMonitoringRoot(realPreparedJobsDir, realRepoRoot)) {
    return makeNotPersisted(
      'SYMLINK_DETECTED',
      validated.shadowRecordId,
      [makeGenericIssue('realpath of prepared-jobs directory escaped the shadow namespace')],
    );
  }

  /* -- Step 7: classify existing final target (write-once policy) -------- */
  const finalKind = await classifyPath(finalPath);
  if (finalKind === 'symlink') {
    return makeNotPersisted(
      'SYMLINK_DETECTED',
      validated.shadowRecordId,
      [makeGenericIssue('symlink detected at final artifact target')],
    );
  }
  if (finalKind === 'directory') {
    return makeNotPersisted(
      'NON_DIRECTORY_TARGET',
      validated.shadowRecordId,
      [makeGenericIssue('directory exists at final artifact target')],
    );
  }
  if (finalKind === 'file') {
    /*
     * Compare existing final artifact bytes against expected canonical bytes.
     *   identical   -> IDEMPOTENT_IDENTICAL_SUCCESS (no temp file created)
     *   different   -> ALREADY_EXISTS (fail closed, no overwrite)
     *   unreadable  -> ALREADY_EXISTS (fail closed, no overwrite)
     */
    const comparison = await compareExistingFinalArtifact(
      finalPath,
      canonicalBytes,
    );
    if (comparison === 'identical') {
      return makeIdempotentSuccess(
        validated.shadowRecordId,
        relativePath,
        false,
      );
    }
    return makeNotPersisted(
      'ALREADY_EXISTS',
      validated.shadowRecordId,
      [makeGenericIssue('artifact already exists at target path')],
    );
  }

  /* -- Step 7b: repeat ancestor safety check immediately before finalization */
  const preFinalizeAudit = await auditAncestors(ancestors);
  if (!preFinalizeAudit.ok) {
    return makeNotPersisted(
      preFinalizeAudit.status,
      validated.shadowRecordId,
      [preFinalizeAudit.issue],
    );
  }

  /* -- Step 8: atomic temp write (O_EXCL via 'wx', restrictive mode 0600) - */
  const tempName = artifactFilename + '.tmp-' + randomUUID();
  const tempPath = path.join(preparedJobsDir, tempName);

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
    return makeNotPersisted(
      'WRITE_ERROR',
      validated.shadowRecordId,
      [makeGenericIssue('failed to write temporary artifact')],
    );
  }

  /* -- Step 9: finalize with hard link (never rename/replace) ----------- */
  let artifactCreated = false;
  let linkError: unknown = null;
  try {
    await fs.link(tempPath, finalPath);
    artifactCreated = true;
  } catch (error) {
    linkError = error;
  }

  /* -- Step 10: best-effort temp cleanup ---------------------------------- */
  let tempCleanupFailed = false;
  try {
    await fs.unlink(tempPath);
  } catch {
    tempCleanupFailed = true;
  }

  if (!artifactCreated) {
    const code = extractErrorCode(linkError);
    if (code === 'EEXIST') {
      /*
       * Race: another concurrent writer won the hard-link race.
       * Classify the final target and perform identity comparison.
       */
      const existingKind = await classifyPath(finalPath);
      if (existingKind === 'symlink') {
        return makeNotPersisted(
          'SYMLINK_DETECTED',
          validated.shadowRecordId,
          [makeGenericIssue('symlink detected at final artifact target')],
        );
      }
      if (existingKind === 'directory') {
        return makeNotPersisted(
          'NON_DIRECTORY_TARGET',
          validated.shadowRecordId,
          [makeGenericIssue('directory exists at final artifact target')],
        );
      }
      if (existingKind === 'file') {
        const comparison = await compareExistingFinalArtifact(
          finalPath,
          canonicalBytes,
        );
        if (comparison === 'identical') {
          // Concurrent winner wrote identical bytes — idempotent success
          return makeIdempotentSuccess(
            validated.shadowRecordId,
            relativePath,
            tempCleanupFailed,
          );
        }
        return makeNotPersisted(
          'ALREADY_EXISTS',
          validated.shadowRecordId,
          [makeGenericIssue('artifact already exists at target path')],
        );
      }
      // Target disappeared before classification — fail closed.
      return makeNotPersisted(
        'ALREADY_EXISTS',
        validated.shadowRecordId,
        [makeGenericIssue('artifact already exists at target path')],
      );
    }
    return makeNotPersisted(
      'WRITE_ERROR',
      validated.shadowRecordId,
      [makeGenericIssue('failed to finalize artifact via hard link')],
    );
  }

  /* -- Step 11: fsync containing directory (best-effort) ----------------- */
  try {
    const dirHandle = await fs.open(preparedJobsDir, 'r');
    try {
      await dirHandle.sync();
    } finally {
      await dirHandle.close();
    }
  } catch {
    /* best-effort directory fsync — does not roll back the linked artifact */
  }

  /* -- Step 12: internal read-back verification --------------------------- */
  let readBack: string;
  try {
    readBack = await fs.readFile(finalPath, 'utf-8');
  } catch {
    return {
      ok: false as const,
      status: 'VERIFICATION_FAILED' as const,
      storeVersion: MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_STORE_VERSION,
      artifactCreated: true as const,
      tempCleanupFailed,
      shadowRecordId: validated.shadowRecordId,
      relativePath,
      verificationOk: false as const,
      issues: Object.freeze([
        makeGenericIssue('failed to read-back artifact for verification'),
      ]),
    };
  }

  if (readBack !== canonicalBytes) {
    return {
      ok: false as const,
      status: 'VERIFICATION_FAILED' as const,
      storeVersion: MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_STORE_VERSION,
      artifactCreated: true as const,
      tempCleanupFailed,
      shadowRecordId: validated.shadowRecordId,
      relativePath,
      verificationOk: false as const,
      issues: Object.freeze([
        makeGenericIssue('read-back bytes do not match expected canonical bytes'),
      ]),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readBack);
  } catch {
    return {
      ok: false as const,
      status: 'VERIFICATION_FAILED' as const,
      storeVersion: MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_STORE_VERSION,
      artifactCreated: true as const,
      tempCleanupFailed,
      shadowRecordId: validated.shadowRecordId,
      relativePath,
      verificationOk: false as const,
      issues: Object.freeze([
        makeGenericIssue('read-back artifact is not valid JSON'),
      ]),
    };
  }

  const revalidation = validateMLBShadowPreparedExecutionJobV2(parsed);
  if (!revalidation.ok) {
    return {
      ok: false as const,
      status: 'VERIFICATION_FAILED' as const,
      storeVersion: MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_STORE_VERSION,
      artifactCreated: true as const,
      tempCleanupFailed,
      shadowRecordId: validated.shadowRecordId,
      relativePath,
      verificationOk: false as const,
      issues: Object.freeze([
        makeGenericIssue('read-back artifact failed prepared-job validation'),
      ]),
    };
  }

  const recanonicalBytes = buildCanonicalBytes(revalidation.value);
  if (recanonicalBytes !== readBack) {
    return {
      ok: false as const,
      status: 'VERIFICATION_FAILED' as const,
      storeVersion: MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_STORE_VERSION,
      artifactCreated: true as const,
      tempCleanupFailed,
      shadowRecordId: validated.shadowRecordId,
      relativePath,
      verificationOk: false as const,
      issues: Object.freeze([
        makeGenericIssue('recanonicalized read-back artifact does not match persisted bytes'),
      ]),
    };
  }

  /* -- Success ----------------------------------------------------------- */
  return {
    ok: true as const,
    status: tempCleanupFailed
      ? 'PERSISTED_WITH_CLEANUP_WARNING'
      : 'PERSISTED',
    storeVersion: MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_STORE_VERSION,
    artifactCreated: true as const,
    tempCleanupFailed,
    shadowRecordId: validated.shadowRecordId,
    relativePath,
    verificationOk: true as const,
    issues: Object.freeze([]),
  };
}
