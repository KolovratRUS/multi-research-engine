/* -------------------------------------------------------------------------- */
/*  MLB Shadow Monitoring prepared-execution-job V2 reader (P5F-C2A-R1)        */
/* -------------------------------------------------------------------------- */
/**
 * READ-ONLY loader for a quarantined, validated V2 prepared execution job.
 *
 * Phase scope (P5F-C2A-R1): reader-only. This module performs NO write, NO
 * model fitting, NO prediction computation, NO network I/O, NO clock reads,
 * and NO randomness. It loads an already-sealed artifact solely to surface
 * its validated contents.
 *
 * Integrity / defense:
 *  - The shadowRecordId is validated (non-empty, trimmed, no control chars
 *    U+0000-U+001F) BEFORE any filesystem access.
 *  - The repoRoot is routed through the sealed namespace resolver
 *    (resolveShadowMonitoringNamespacePath), which is pure and lexically
 *    enforces containment within the shadow-monitoring root.
 *  - The artifact filename is SHA-256(shadowRecordId) + '.json'; the raw
 *    shadowRecordId never enters a filesystem path.
 *  - Every ancestor directory is lstat'd (never followed); a symlink or a
 *    non-directory ancestor fails closed.
 *  - realpath containment (defense-in-depth) is applied before opening.
 *  - The final artifact is opened with O_RDONLY | O_NOFOLLOW and required to
 *    be a regular file; pre-open lstat dev/ino are compared to post-open
 *    fstat dev/ino (identity guard).
 *  - Raw bytes are read exclusively from the open FileHandle.
 *  - Strict fatal UTF-8 decode; JSON.parse; validateMLBShadowPreparedExecutionJobV2.
 *  - DIRECT content identity: validation.value.shadowRecordId === shadowRecordId.
 *    The SHA-256 is used ONLY for filename derivation, never for content identity.
 *  - Canonical byte equality via Buffer.equals (rejects pretty-printing,
 *    whitespace, trailing newline, and reordered top-level keys).
 *
 * Scientific-blindness lock (this reader is QUARANTINED_INTERNAL; it is NOT a
 * scientific consumer of holdout evidence and never reads protected data):
 *   READER_CLASSIFICATION          = QUARANTINED_INTERNAL
 *   S1_SCIENTIFIC_ROLE              = NONE
 *   S1_OPERATIONAL_READ_ALLOWED     = false
 *   SCIENTIFIC_USE                  = NONE
 *   IS_PROSPECTIVE_HOLDOUT_EVIDENCE = false
 *   PUBLIC_OPERATIONAL_API_ALLOWED  = false
 *   ELIGIBLE_FOR_FUTURE_VALIDATION  = false
 *   ELIGIBLE_FOR_FUTURE_TEST        = false
 */
import { createHash } from 'node:crypto';
import { open, lstat, realpath } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  validateMLBShadowPreparedExecutionJobV2,
  type MLBShadowPreparedExecutionJobV2,
} from './mlb-shadow-prepared-execution-job-v2-contract';
import {
  resolveShadowMonitoringNamespacePath,
  MLB_SHADOW_MONITORING_NAMESPACE_ROOT,
  type MLBShadowMonitoringNamespacePath,
} from './mlb-shadow-monitoring-namespace';

/* -------------------------------------------------------------------------- */
/*  Reader version + sealed status set                                        */
/* -------------------------------------------------------------------------- */

export const MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_READER_VERSION =
  'mlb-shadow-prepared-execution-job-v2-reader-v1' as const;

/**
 * A reader failure status. READ_OK is intentionally excluded so that a failure
 * result can never carry the success status.
 */
export type MLBShadowPreparedExecutionJobV2ReaderFailureStatus =
  | 'NOT_FOUND'
  | 'REPO_ROOT_INVALID'
  | 'SHADOW_RECORD_ID_INVALID'
  | 'SYMLINK_DETECTED'
  | 'NON_DIRECTORY_TARGET'
  | 'READ_ERROR'
  | 'MALFORMED_UTF8'
  | 'MALFORMED_JSON'
  | 'PREPARED_CONTRACT_VALIDATION_FAILED'
  | 'NONCANONICAL_BYTES'
  | 'SHADOW_RECORD_ID_MISMATCH'
  | 'UNKNOWN_FAILURE';

export type MLBShadowPreparedExecutionJobV2ReaderStatus =
  | 'READ_OK'
  | MLBShadowPreparedExecutionJobV2ReaderFailureStatus;

export type MLBShadowPreparedExecutionJobV2ReaderResult =
  | Readonly<{
      ok: true;
      readerVersion: typeof MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_READER_VERSION;
      status: 'READ_OK';
      value: MLBShadowPreparedExecutionJobV2;
    }>
  | Readonly<{
      ok: false;
      readerVersion: typeof MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_READER_VERSION;
      status: MLBShadowPreparedExecutionJobV2ReaderFailureStatus;
    }>;

/* -------------------------------------------------------------------------- */
/*  Sealed namespace / filename derivation (mirrors the v2 store exactly)      */
/* -------------------------------------------------------------------------- */

/** Relative namespace for prepared-job artifacts (matches the sealed store). */
const PREPARED_JOBS_RELATIVE = 'quarantine/prepared-jobs' as const;

/** Lexical, non-filesystem namespace root path (mirrors the sealed store). */
const PREPARED_JOBS_NAMESPACE =
  MLB_SHADOW_MONITORING_NAMESPACE_ROOT + '/' + PREPARED_JOBS_RELATIVE;

/** Ordered namespace segments used to audit every ancestor directory. */
const NAMESPACE_SEGMENTS: readonly string[] =
  PREPARED_JOBS_NAMESPACE.split('/');

/* -------------------------------------------------------------------------- */
/*  Local helpers                                                             */
/* -------------------------------------------------------------------------- */

/** Reads the numeric `.code` from a Node ErrnoException, if present. */
function extractErrorCode(error: unknown): string | undefined {
  if (error === null || typeof error !== 'object') {
    return undefined;
  }
  const record = error as Record<string, unknown>;
  const code = record.code;
  if (typeof code === 'string') {
    return code;
  }
  return undefined;
}

/**
 * Validates a shadowRecordId with NO filesystem access:
 * non-empty, trimmed, and containing no U+0000-U+001F control characters.
 */
function isValidShadowRecordId(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  if (value.length === 0) {
    return false;
  }
  if (value !== value.trim()) {
    return false;
  }
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) <= 0x1f) {
      return false;
    }
  }
  return true;
}

/** SHA-256 hex digest of the shadowRecordId (UTF-8), identical to the store. */
function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex');
}

/** Ordered ancestor chain from repoRoot down to the prepared-jobs directory. */
function buildAncestorChain(repoRoot: string): readonly string[] {
  const chain: string[] = [repoRoot];
  let current = repoRoot;
  for (const segment of NAMESPACE_SEGMENTS) {
    current = join(current, segment);
    chain.push(current);
  }
  return chain;
}

/** Discriminated classification of a path via a non-following lstat. */
type PathClassification =
  | { kind: 'directory' }
  | { kind: 'symlink' }
  | { kind: 'missing' }
  | { kind: 'read-error' }
  | { kind: 'file'; dev: bigint; ino: bigint };

/**
 * lstat a single path (bigint stats) and classify it WITHOUT following links.
 * The returned dev/ino are used for the pre-open / post-open identity guard.
 */
async function classifyLstat(pathname: string): Promise<PathClassification> {
  const attempt = await lstat(pathname, { bigint: true }).then(
    (stat) => ({ ok: true as const, stat }),
    (error) => ({ ok: false as const, error }),
  );
  if (!attempt.ok) {
    return extractErrorCode(attempt.error) === 'ENOENT'
      ? { kind: 'missing' }
      : { kind: 'read-error' };
  }
  const stat = attempt.stat;
  if (stat.isSymbolicLink()) {
    return { kind: 'symlink' };
  }
  if (stat.isDirectory()) {
    return { kind: 'directory' };
  }
  if (stat.isFile()) {
    return { kind: 'file', dev: stat.dev, ino: stat.ino };
  }
  return { kind: 'read-error' };
}

/**
 * Audit the ancestor directory chain. Every ancestor must exist as a real
 * (non-symlink) directory. Returns a failure status on the first problem,
 * or null when the entire chain is a clean directory sequence.
 */
async function auditAncestorChain(
  ancestors: readonly string[],
): Promise<MLBShadowPreparedExecutionJobV2ReaderFailureStatus | null> {
  for (const ancestor of ancestors) {
    const classified = await classifyLstat(ancestor);
    switch (classified.kind) {
      case 'missing':
        return 'NOT_FOUND';
      case 'symlink':
        return 'SYMLINK_DETECTED';
      case 'directory':
        break;
      case 'file':
        return 'NON_DIRECTORY_TARGET';
      case 'read-error':
        return 'READ_ERROR';
      default:
        return 'READ_ERROR';
    }
  }
  return null;
}

/** Builds a failure result with no sensitive fields (3-field surface only). */
function failReader(
  status: MLBShadowPreparedExecutionJobV2ReaderFailureStatus,
): MLBShadowPreparedExecutionJobV2ReaderResult {
  return {
    ok: false,
    readerVersion: MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_READER_VERSION,
    status,
  };
}

/* -------------------------------------------------------------------------- */
/*  Public reader entry point                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Reads and validates the sealed prepared-execution-job V2 artifact for the
 * requested shadowRecordId. The caller supplies neither an artifact path nor a
 * filename; the path is derived solely from repoRoot + SHA-256(shadowRecordId).
 *
 * Returns a discriminated result. On failure the result contains ONLY
 * { ok, readerVersion, status } — never paths, bytes, payloads, model data,
 * or errors.
 */
export async function readMLBShadowPreparedExecutionJobV2(
  repoRoot: string,
  shadowRecordId: string,
): Promise<MLBShadowPreparedExecutionJobV2ReaderResult> {
  try {
    // 1. Validate the shadowRecordId BEFORE any filesystem access.
    if (!isValidShadowRecordId(shadowRecordId)) {
      return failReader('SHADOW_RECORD_ID_INVALID');
    }

    // 2. Validate repoRoot and resolve the prepared-jobs namespace (pure).
    let namespacePath: MLBShadowMonitoringNamespacePath;
    try {
      namespacePath = resolveShadowMonitoringNamespacePath(
        repoRoot,
        PREPARED_JOBS_RELATIVE,
      );
    } catch {
      return failReader('REPO_ROOT_INVALID');
    }

    const resolvedRepoRoot = namespacePath.repositoryRoot;
    const preparedJobsDir = namespacePath.resolved;

    // 3. Filename = SHA-256(shadowRecordId) + '.json'; raw ID never in path.
    const artifactFilename = sha256Hex(shadowRecordId) + '.json';
    const finalPath = join(preparedJobsDir, artifactFilename);

    // 4. Ancestor symlink / type defense (lstat, no following).
    const ancestorFailure = await auditAncestorChain(
      buildAncestorChain(resolvedRepoRoot),
    );
    if (ancestorFailure !== null) {
      return failReader(ancestorFailure);
    }

    // 5. realpath containment (defense-in-depth TOCTOU guard).
    let realRepoRoot: string;
    let realPreparedJobsDir: string;
    try {
      realRepoRoot = await realpath(resolvedRepoRoot);
      realPreparedJobsDir = await realpath(preparedJobsDir);
    } catch {
      return failReader('READ_ERROR');
    }
    if (realPreparedJobsDir !== resolve(realRepoRoot, PREPARED_JOBS_NAMESPACE)) {
      return failReader('READ_ERROR');
    }

    // 6. Classify the final artifact (detects missing / symlink / directory).
    const finalClassified = await classifyLstat(finalPath);
    if (finalClassified.kind === 'missing') {
      return failReader('NOT_FOUND');
    }
    if (finalClassified.kind === 'symlink') {
      return failReader('SYMLINK_DETECTED');
    }
    if (finalClassified.kind === 'directory') {
      return failReader('NON_DIRECTORY_TARGET');
    }
    if (finalClassified.kind === 'read-error') {
      return failReader('READ_ERROR');
    }
    const preDevice = finalClassified.dev;
    const preInode = finalClassified.ino;

    // 7. Open the final artifact read-only, never following links.
    let handle: Awaited<ReturnType<typeof open>>;
    try {
      handle = await open(finalPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    } catch (error) {
      const code = extractErrorCode(error);
      if (code === 'ELOOP') {
        return failReader('SYMLINK_DETECTED');
      }
      if (code === 'ENOENT') {
        return failReader('NOT_FOUND');
      }
      return failReader('READ_ERROR');
    }

    try {
      // 8. fstat the open handle: require a regular file and a stable identity.
      const fdStat = await handle.stat({ bigint: true });
      if (!fdStat.isFile()) {
        return failReader('READ_ERROR');
      }
      if (fdStat.dev !== preDevice || fdStat.ino !== preInode) {
        return failReader('READ_ERROR');
      }

      // 9. Raw bytes originate EXCLUSIVELY from the open FileHandle.
      const rawBuffer = await handle.readFile();

      // 10. Strict fatal UTF-8 decode.
      let decoded: string;
      try {
        decoded = new TextDecoder('utf-8', { fatal: true }).decode(rawBuffer);
      } catch {
        return failReader('MALFORMED_UTF8');
      }

      // 11. JSON parse.
      let parsed: unknown;
      try {
        parsed = JSON.parse(decoded);
      } catch {
        return failReader('MALFORMED_JSON');
      }

      // 12. Contract validation.
      const validation = validateMLBShadowPreparedExecutionJobV2(parsed);
      if (!validation.ok) {
        return failReader('PREPARED_CONTRACT_VALIDATION_FAILED');
      }

      // 13. DIRECT content identity (NOT hash-only). The SHA-256 derived only
      //     the filename; the artifact's own shadowRecordId must match exactly.
      if (validation.value.shadowRecordId !== shadowRecordId) {
        return failReader('SHADOW_RECORD_ID_MISMATCH');
      }

      // 14. Canonical byte equality: any byte difference (pretty-print,
      //     whitespace, trailing newline, reordered keys) is rejected.
      const canonicalString = JSON.stringify(validation.value);
      const canonicalBuffer = Buffer.from(canonicalString, 'utf8');
      if (!canonicalBuffer.equals(rawBuffer)) {
        return failReader('NONCANONICAL_BYTES');
      }

      return {
        ok: true,
        readerVersion: MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_READER_VERSION,
        status: 'READ_OK',
        value: validation.value,
      };
    } finally {
      await handle.close().catch(() => undefined);
    }
  } catch {
    // Truly unexpected failure: fail safe with the generic catch-all status.
    return failReader('UNKNOWN_FAILURE');
  }
}
