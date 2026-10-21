/* -------------------------------------------------------------------------- */
/*  MLB Shadow Preparation Identity Store (P5F-C4)                             */
/* -------------------------------------------------------------------------- */
/**
 * Write-once identity registry store for the MLB shadow monitoring namespace.
 *
 * Scientific role:
 *  - SCIENTIFIC_USE = NONE
 *  - OPERATIONAL_STORE_IS_HOLDOUT_EVIDENCE = NO
 *  - OPERATIONAL_STORE_CAN_INFLUENCE_MODEL_SELECTION = NO
 *  - OPERATIONAL_STORE_CAN_INFLUENCE_2027_HOLDOUT = NO
 *
 * Security properties enforced:
 *  - Input parameters are validated BEFORE any filesystem read.
 *  - Existing-record fast path never calls the ID generator.
 *  - Existing records are read with O_NOFOLLOW, pre/post-open
 *    identity checks (lstat dev/ino vs fstat dev/ino), strict fatal
 *    UTF-8 decoding, full contract validation, and canonical-byte
 *    verification.
 *  - SHA-256(UTF-8(preparationRequestId)) + '.json' is the sole
 *    filename component — raw IDs never reach a path.
 *  - Every ancestor from repoRoot down to the registry directory is
 *    lstat'd to detect symlinks; non-directory ancestors fail closed.
 *  - Temp file is created with O_CREAT | O_EXCL and 0600 mode ('wx').
 *  - Finalization uses fs.link (hard link), never rename or replace.
 *  - Never overwrites, deletes, replaces, or remaps an existing identity.
 *  - The final persisted artifact is read back and verified.
 *
 * Allowed imports only:
 *   node:fs/promises  node:fs            node:path  node:crypto
 *   ./mlb-shadow-preparation-identity-contract
 *   ./mlb-shadow-monitoring-namespace
 */

import * as fs from 'node:fs/promises';
import { constants as fsConstants, type BigIntStats } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

import {
  MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION,
  canonicalSerializeMLBShadowPreparationIdentityRecord,
  type MLBShadowPreparationIdentityIssue,
  type MLBShadowPreparationIdentityIssueCode,
  type MLBShadowPreparationIdentityRecord,
  type MLBShadowPreparationIdentityValidationResult,
  validateMLBShadowPreparationIdentityRecord,
  parseMLBShadowPreparationIdentityRecord,
} from './mlb-shadow-preparation-identity-contract';
import {
  MLB_SHADOW_MONITORING_NAMESPACE_ROOT,
  resolveShadowMonitoringNamespacePath,
  isWithinShadowMonitoringRoot,
} from './mlb-shadow-monitoring-namespace';

/* -------------------------------------------------------------------------- */
/*  Store version                                                            */
/* -------------------------------------------------------------------------- */

export const MLB_SHADOW_PREPARATION_IDENTITY_STORE_VERSION =
  'mlb-shadow-preparation-identity-store-v1' as const;

/* -------------------------------------------------------------------------- */
/*  Path constants                                                            */
/* -------------------------------------------------------------------------- */

const PREPARATION_IDENTITIES_RELATIVE = 'operational/preparation-identities';

const PREPARATION_IDENTITIES_NAMESPACE =
  MLB_SHADOW_MONITORING_NAMESPACE_ROOT + '/' + PREPARATION_IDENTITIES_RELATIVE;

const NAMESPACE_SEGMENTS: readonly string[] =
  PREPARATION_IDENTITIES_NAMESPACE.split('/');

const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

/* -------------------------------------------------------------------------- */
/*  Issue codes for existing-record read failures                             */
/* -------------------------------------------------------------------------- */

/**
 * Detailed outcomes when reading a potential existing identity record.
 * These are internal to the store — callers only see the resolved
 * status (RECORD_CONTRACT_INVALID, IDEMPOTENT_IDENTICAL_SUCCESS, etc.).
 */
type ExistingRecordOutcome =
  | { kind: 'missing' }
  | { kind: 'symlink_at_final' }
  | { kind: 'directory_at_final' }
  | { kind: 'non_regular_at_final' }
  | { kind: 'open_failed' }
  | { kind: 'dev_ino_mismatch' }
  | { kind: 'malformed_utf8' }
  | { kind: 'malformed_json' }
  | { kind: 'contract_invalid'; issues: readonly MLBShadowPreparationIdentityIssue[] }
  | { kind: 'noncanonical' }
  | {
      kind: 'mismatched';
      /** The gamePk stored in the existing record (differs from request). */
      existingGamePk: number;
      /** The shadowRecordId stored in the existing record. */
      existingShadowRecordId: string;
    }
  | {
      kind: 'identity_mismatch';
      /** preparationRequestId inside the existing record differs from the requested key. */
      existingPreparationRequestId: string;
    }
  | {
      kind: 'match';
      shadowRecordId: string;
      relativePath: string;
    };

/* -------------------------------------------------------------------------- */
/*  Failure statuses                                                          */
/* -------------------------------------------------------------------------- */

export type MLBShadowPreparationIdentityStoreFailureStatus =
  | 'VALIDATION_FAILED'
  | 'SYMLINK_DETECTED'
  | 'NON_DIRECTORY_TARGET'
  | 'REPO_ROOT_INVALID'
  | 'READ_ERROR'
  | 'MALFORMED_UTF8'
  | 'MALFORMED_RECORD'
  | 'RECORD_CONTRACT_INVALID'
  | 'NONCANONICAL_RECORD'
  | 'RECORD_IDENTITY_MISMATCH'
  | 'GAME_PK_MISMATCH'
  | 'WRITE_ERROR'
  | 'UNKNOWN_ERROR';

/* -------------------------------------------------------------------------- */
/*  Result types                                                              */
/* -------------------------------------------------------------------------- */

export type MLBShadowPreparationIdentityResolutionResult =
  | Readonly<{
      ok: true;
      status: 'PERSISTED' | 'PERSISTED_WITH_CLEANUP_WARNING';
      storeVersion: typeof MLB_SHADOW_PREPARATION_IDENTITY_STORE_VERSION;
      artifactCreated: true;
      tempCleanupFailed: boolean;
      preparationRequestId: string;
      gamePk: number;
      shadowRecordId: string;
      relativePath: string;
      issues: readonly [];
      verificationOk: true;
    }>
  | Readonly<{
      ok: true;
      status: 'IDEMPOTENT_IDENTICAL_SUCCESS';
      storeVersion: typeof MLB_SHADOW_PREPARATION_IDENTITY_STORE_VERSION;
      artifactCreated: false;
      tempCleanupFailed: boolean;
      verificationOk: true;
      preparationRequestId: string;
      gamePk: number;
      shadowRecordId: string;
      relativePath: string;
      issues: readonly [];
    }>
  | Readonly<{
      ok: false;
      status: MLBShadowPreparationIdentityStoreFailureStatus;
      storeVersion: typeof MLB_SHADOW_PREPARATION_IDENTITY_STORE_VERSION;
      artifactCreated: false;
      tempCleanupFailed: false;
      preparationRequestId: string | null;
      gamePk: number | null;
      shadowRecordId: string | null;
      relativePath: null;
      issues: readonly MLBShadowPreparationIdentityIssue[];
      verificationOk: null;
    }>
  | Readonly<{
      ok: false;
      status: 'VERIFICATION_FAILED';
      storeVersion: typeof MLB_SHADOW_PREPARATION_IDENTITY_STORE_VERSION;
      artifactCreated: true;
      tempCleanupFailed: boolean;
      preparationRequestId: string;
      gamePk: number;
      shadowRecordId: string;
      relativePath: string;
      issues: readonly MLBShadowPreparationIdentityIssue[];
      verificationOk: false;
    }>;

/* -------------------------------------------------------------------------- */
/*  Internal helpers                                                          */
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
 * Builds the ancestor chain from repoRoot down to the registry directory.
 *  [0] = repoRoot
 *  [1] = repoRoot/var
 *  [2] = repoRoot/var/mlb-development
 *  [3] = repoRoot/var/mlb-development/mlb-shadow-monitoring
 *  [4] = .../operational
 *  [5] = .../preparation-identities
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
 *  - any existing symlink      -> FAIL CLOSED
 *  - any existing non-directory -> FAIL CLOSED
 *  - repoRoot must exist       -> else REPO_ROOT_INVALID
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
 * Opaque-string validation for the request-level preparationRequestId
 * (mirrors the contract's internal helper, but lives in the store so
 * input is checked BEFORE any filesystem touch).
 */
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F]/;

function isValidPreparationRequestId(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  if (value.length === 0) {
    return false;
  }
  if (value !== value.trim()) {
    return false;
  }
  if (CONTROL_CHARACTER_PATTERN.test(value)) {
    return false;
  }
  return true;
}

function isValidGamePk(value: unknown): value is number {
  if (typeof value !== 'number') {
    return false;
  }
  if (!Number.isSafeInteger(value)) {
    return false;
  }
  return value > 0;
}

/**
 * Constructs a single safe diagnostic issue. Every field is a bounded
 * value or JSON-pointer-style property path — never a stack trace, secret,
 * arbitrary exception message, or absolute filesystem path.
 */
function makeSafeIssue(
  code: MLBShadowPreparationIdentityIssueCode,
  path: string,
  message: string,
): MLBShadowPreparationIdentityIssue {
  return { code, path, message };
}

/**
 * Default safe diagnostic issues for a store-level failure status.
 * Guarantees every failure status yields at least one bounded, meaningful
 * issue and never returns an empty array.
 */
function defaultFailureIssues(
  status: MLBShadowPreparationIdentityStoreFailureStatus,
): readonly MLBShadowPreparationIdentityIssue[] {
  switch (status) {
    case 'VALIDATION_FAILED':
      return [
        makeSafeIssue(
          'NOT_OBJECT',
          '$',
          'Input failed shadow preparation identity validation',
        ),
      ];
    case 'SYMLINK_DETECTED':
      return [
        makeSafeIssue(
          'NOT_OBJECT',
          '$',
          'Symlink detected in shadow namespace; rejected for safety',
        ),
      ];
    case 'NON_DIRECTORY_TARGET':
      return [
        makeSafeIssue(
          'NOT_OBJECT',
          '$',
          'Non-directory entry encountered in shadow namespace; rejected for safety',
        ),
      ];
    case 'REPO_ROOT_INVALID':
      return [
        makeSafeIssue(
          'NOT_OBJECT',
          '$',
          'Repository root is not a valid directory',
        ),
      ];
    case 'READ_ERROR':
      return [
        makeSafeIssue(
          'NOT_OBJECT',
          '$',
          'Could not read existing identity artifact',
        ),
      ];
    case 'MALFORMED_UTF8':
      return [
        makeSafeIssue(
          'MALFORMED_JSON',
          '$',
          'Identity artifact is not valid UTF-8',
        ),
      ];
    case 'MALFORMED_RECORD':
      return [
        makeSafeIssue(
          'MALFORMED_JSON',
          '$',
          'Identity artifact is not valid JSON',
        ),
      ];
    case 'RECORD_CONTRACT_INVALID':
      return [
        makeSafeIssue(
          'NOT_OBJECT',
          '$',
          'Existing identity artifact failed contract validation',
        ),
      ];
    case 'NONCANONICAL_RECORD':
      return [
        makeSafeIssue(
          'NOT_OBJECT',
          '$',
          'Identity artifact is not in canonical byte layout',
        ),
      ];
    case 'RECORD_IDENTITY_MISMATCH':
      return [
        makeSafeIssue(
          'PREPARATION_REQUEST_ID_INVALID',
          '$.preparationRequestId',
          'Identity artifact preparationRequestId does not match request',
        ),
      ];
    case 'GAME_PK_MISMATCH':
      return [
        makeSafeIssue(
          'GAME_PK_INVALID',
          '$.gamePk',
          'Identity artifact gamePk does not match request',
        ),
      ];
    case 'WRITE_ERROR':
      return [
        makeSafeIssue(
          'NOT_OBJECT',
          '$',
          'Failed to persist identity artifact',
        ),
      ];
    case 'UNKNOWN_ERROR':
      return [
        makeSafeIssue(
          'NOT_OBJECT',
          '$',
          'Unexpected error during identity resolution',
        ),
      ];
  }
}

/**
 * Builds safe diagnostic issues from an existing-record read outcome.
 * For contract_invalid, propagates the real contract validation issues;
 * for every other outcome, synthesizes a bounded safe issue.
 */
function issuesForExistingOutcome(
  outcome: ExistingRecordOutcome,
): readonly MLBShadowPreparationIdentityIssue[] {
  switch (outcome.kind) {
    case 'match':
      return [];
    case 'missing':
      return [
        makeSafeIssue(
          'NOT_OBJECT',
          '$',
          'Identity artifact is missing',
        ),
      ];
    case 'symlink_at_final':
    case 'directory_at_final':
    case 'non_regular_at_final':
      return [
        makeSafeIssue(
          'NOT_OBJECT',
          '$',
          'Identity artifact path is not a regular file; rejected for safety',
        ),
      ];
    case 'open_failed':
    case 'dev_ino_mismatch':
      return [
        makeSafeIssue(
          'NOT_OBJECT',
          '$',
          'Could not read identity artifact',
        ),
      ];
    case 'malformed_utf8':
      return [
        makeSafeIssue(
          'MALFORMED_JSON',
          '$',
          'Identity artifact is not valid UTF-8',
        ),
      ];
    case 'malformed_json':
      return [
        makeSafeIssue(
          'MALFORMED_JSON',
          '$',
          'Identity artifact is not valid JSON',
        ),
      ];
    case 'contract_invalid':
      return outcome.issues;
    case 'noncanonical':
      return [
        makeSafeIssue(
          'NOT_OBJECT',
          '$',
          'Identity artifact is not in canonical byte layout',
        ),
      ];
    case 'mismatched':
      return [
        makeSafeIssue(
          'GAME_PK_INVALID',
          '$.gamePk',
          'Identity artifact gamePk does not match request',
        ),
      ];
    case 'identity_mismatch':
      return [
        makeSafeIssue(
          'PREPARATION_REQUEST_ID_INVALID',
          '$.preparationRequestId',
          'Identity artifact preparationRequestId does not match request',
        ),
      ];
  }
}

/**
 * Secure read of an existing identity artifact.
 *
 * Steps:
 *  1. lstat final path (pre-open identity, symlink detection).
 *  2. open with O_RDONLY | O_NOFOLLOW (symlink rejection at kernel level).
 *  3. fstat fd (post-open identity); compare dev + ino with lstat result.
 *  4. read all bytes from fd.
 *  5. strict fatal UTF-8 decode.
 *  6. JSON.parse.
 *  7. full contract validation.
 *  8. canonical byte verification (recanonicalize + compare to stored bytes).
 *  9. identity-field comparison (requested preparationRequestId must match
 *     the stored one — defense-in-depth since the filename is derived from
 *     preparationRequestId, and gamePk must match the request).
 *
 * If any step fails the existing file is treated as corrupt/invalid and
 * the outcome reflects the specific failure kind.
 */
async function readExistingIdentityRecord(
  finalPath: string,
  requestedPreparationRequestId: string,
  requestedGamePk: number,
): Promise<ExistingRecordOutcome> {
  /* -- 1. pre-open lstat (pre-open identity) ---------------------------- */
  let preOpenStat: BigIntStats;
  try {
    preOpenStat = await fs.lstat(finalPath, { bigint: true });
  } catch (error) {
    const code = extractErrorCode(error);
    if (code === 'ENOENT') {
      return { kind: 'missing' };
    }
    if (code === 'ELOOP' || code === 'EMLINK') {
      return { kind: 'symlink_at_final' };
    }
    return { kind: 'open_failed' };
  }

  if (preOpenStat.isSymbolicLink()) {
    return { kind: 'symlink_at_final' };
  }
  if (preOpenStat.isDirectory()) {
    return { kind: 'directory_at_final' };
  }
  if (!preOpenStat.isFile()) {
    return { kind: 'non_regular_at_final' };
  }

  /* -- 2. open with O_NOFOLLOW ------------------------------------------ */
  let handle: fs.FileHandle;
  try {
    handle = await fs.open(finalPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  } catch (error) {
    const code = extractErrorCode(error);
    if (code === 'ELOOP') {
      return { kind: 'symlink_at_final' };
    }
    return { kind: 'open_failed' };
  }

  try {
    /* -- 3. post-open fstat, compare dev/ino ---------------------------- */
    const fdStat = await handle.stat({ bigint: true });
    if (!fdStat.isFile()) {
      return { kind: 'non_regular_at_final' };
    }
    if (fdStat.dev !== preOpenStat.dev || fdStat.ino !== preOpenStat.ino) {
      return { kind: 'dev_ino_mismatch' };
    }

    /* -- 4. read raw bytes --------------------------------------------- */
    const rawBuffer = await handle.readFile();

    /* -- 5. strict fatal UTF-8 decode ---------------------------------- */
    const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });
    let decoded: string;
    try {
      decoded = decoder.decode(rawBuffer);
    } catch {
      return { kind: 'malformed_utf8' };
    }

    /* -- 6. JSON.parse (safe) ----------------------------------------- */
    let parsed: unknown;
    try {
      parsed = JSON.parse(decoded);
    } catch {
      return { kind: 'malformed_json' };
    }

    /* -- 7. full contract validation ---------------------------------- */
    const validation: MLBShadowPreparationIdentityValidationResult =
      validateMLBShadowPreparationIdentityRecord(parsed);
    if (!validation.ok) {
      return { kind: 'contract_invalid', issues: validation.issues };
    }
    const record = validation.value;

    /* -- 8. canonical byte verification -------------------------------- */
    const canonicalBytes = canonicalSerializeMLBShadowPreparationIdentityRecord(record);
    const canonicalBuffer = Buffer.from(canonicalBytes, 'utf-8');
    let rawBytes: Buffer;
    try {
      rawBytes = Buffer.from(rawBuffer);
    } catch {
      return { kind: 'noncanonical' };
    }
    if (!canonicalBuffer.equals(rawBytes)) {
      return { kind: 'noncanonical' };
    }

    /* -- 9. identity-field comparison ---------------------------------- */
    if (
      record.preparationRequestId !== requestedPreparationRequestId
    ) {
      return {
        kind: 'identity_mismatch',
        existingPreparationRequestId: record.preparationRequestId,
      };
    }
    if (record.gamePk !== requestedGamePk) {
      return {
        kind: 'mismatched',
        existingGamePk: record.gamePk,
        existingShadowRecordId: record.shadowRecordId,
      };
    }

    /* -- All checks passed — existing record is a valid identity match -- */
    const relativePath = path.join(PREPARATION_IDENTITIES_RELATIVE, computeArtifactFilename(requestedPreparationRequestId));

    return {
      kind: 'match',
      shadowRecordId: record.shadowRecordId,
      relativePath,
    };
  } finally {
    await handle.close().catch(() => undefined);
  }
}

/**
 * Derives the storage-key filename from the preparation request ID:
 * SHA-256(UTF-8 exact preparationRequestId) + '.json'.
 */
function computeArtifactFilename(preparationRequestId: string): string {
  return (
    createHash('sha256')
      .update(preparationRequestId, 'utf-8')
      .digest('hex') + '.json'
  );
}

/**
 * Builds a canonical 4-field JSON record from the given identity components.
 */
function buildIdentityRecord(
  preparationRequestId: string,
  gamePk: number,
  shadowRecordId: string,
): MLBShadowPreparationIdentityRecord {
  return {
    contractVersion: MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION,
    preparationRequestId,
    gamePk,
    shadowRecordId,
  };
}

/* -------------------------------------------------------------------------- */
/*  Result factories                                                          */
/* -------------------------------------------------------------------------- */

function makePreFinalizationFailure(
  status: MLBShadowPreparationIdentityStoreFailureStatus,
  preparationRequestId: string | null,
  gamePk: number | null,
  shadowRecordId: string | null,
  issues?: readonly MLBShadowPreparationIdentityIssue[],
): MLBShadowPreparationIdentityResolutionResult {
  return {
    ok: false,
    storeVersion: MLB_SHADOW_PREPARATION_IDENTITY_STORE_VERSION,
    status,
    artifactCreated: false,
    tempCleanupFailed: false,
    preparationRequestId,
    gamePk,
    shadowRecordId,
    relativePath: null,
    issues: issues ?? defaultFailureIssues(status),
    verificationOk: null,
  };
}

function makeFailureFromExistingOutcome(
  outcome: Exclude<ExistingRecordOutcome, { kind: 'missing' } | { kind: 'match' }>,
  preparationRequestId: string,
  gamePk: number,
): MLBShadowPreparationIdentityResolutionResult {
  const issues = issuesForExistingOutcome(outcome);
  switch (outcome.kind) {
    case 'symlink_at_final':
      return makePreFinalizationFailure('SYMLINK_DETECTED', preparationRequestId, gamePk, null, issues);
    case 'directory_at_final':
    case 'non_regular_at_final':
      return makePreFinalizationFailure('NON_DIRECTORY_TARGET', preparationRequestId, gamePk, null, issues);
    case 'open_failed':
    case 'dev_ino_mismatch':
      return makePreFinalizationFailure('READ_ERROR', preparationRequestId, gamePk, null, issues);
    case 'malformed_utf8':
      return makePreFinalizationFailure('MALFORMED_UTF8', preparationRequestId, gamePk, null, issues);
    case 'malformed_json':
      return makePreFinalizationFailure('MALFORMED_RECORD', preparationRequestId, gamePk, null, issues);
    case 'contract_invalid':
      return makePreFinalizationFailure('RECORD_CONTRACT_INVALID', preparationRequestId, gamePk, null, issues);
    case 'noncanonical':
      return makePreFinalizationFailure('NONCANONICAL_RECORD', preparationRequestId, gamePk, null, issues);
    case 'identity_mismatch':
      return makePreFinalizationFailure('RECORD_IDENTITY_MISMATCH', preparationRequestId, gamePk, null, issues);
    case 'mismatched':
      return makePreFinalizationFailure('GAME_PK_MISMATCH', preparationRequestId, gamePk, null, issues);
    default:
      return makePreFinalizationFailure('UNKNOWN_ERROR', preparationRequestId, gamePk, null, issues);
  }
}

function makeIdempotentSuccess(
  outcome: Extract<ExistingRecordOutcome, { kind: 'match' }>,
  preparationRequestId: string,
  gamePk: number,
): MLBShadowPreparationIdentityResolutionResult {
  return {
    ok: true,
    status: 'IDEMPOTENT_IDENTICAL_SUCCESS',
    storeVersion: MLB_SHADOW_PREPARATION_IDENTITY_STORE_VERSION,
    artifactCreated: false,
    tempCleanupFailed: false,
    verificationOk: true,
    preparationRequestId,
    gamePk,
    shadowRecordId: outcome.shadowRecordId,
    relativePath: outcome.relativePath,
    issues: [],
  };
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Resolves or allocates a shadow preparation identity binding.
 *
 * Algorithm:
 *  1. Validate preparationRequestId and gamePk (fail-closed, zero FS).
 *  2. Resolve the registry directory within the shadow namespace.
 *  3. Audit every ancestor with lstat (symlink / non-directory defense).
 *  4. Check for an existing artifact at SHA-256(preparationRequestId).json.
 *     - If it exists and is a valid, canonical, identity-matching record,
 *       return IDEMPOTENT_IDENTICAL_SUCCESS — the ID generator is NEVER
 *       called on this fast path.
 *     - If it exists but is corrupt, invalid, noncanonical, or has a
 *       different gamePk/ preparationRequestId, return the specific
 *       failure status (READ_ERROR, MALFORMED_UTF8, MALFORMED_RECORD,
 *       RECORD_CONTRACT_INVALID, NONCANONICAL_RECORD,
 *       RECORD_IDENTITY_MISMATCH, or GAME_PK_MISMATCH).
 *       (write-once: never overwrite).
 *  5. If no existing record: CALL the ID generator to obtain a provisional
 *     shadowRecordId. Build the canonical record, validate it, and write
 *     its canonical bytes to an O_EXCL temp file.
 *  6. Hard-link the temp file to the final path.
 *     - If the link succeeds, verify the read-back artifact against the
 *       expected canonical bytes.
 *     - If the link fails with EEXIST (concurrent winner), fall back to
 *       reading the existing record. If it identity-matches the request,
 *       return IDEMPOTENT_IDENTICAL_SUCCESS — the loser adopts the winner's
 *       shadowRecordId and discards its own provisional ID.
 *  7. Clean up the temp file.
 *
 * @param repoRoot Absolute repository root (e.g. process.cwd()). Must exist.
 * @param preparationRequestId Opaque, non-empty, trimmed preparation request ID.
 * @param gamePk Positive safe integer game primary key.
 * @param generateShadowRecordId Caller-supplied deterministic or random ID
 *   generator. Called ONLY when no existing record is found.
 * @returns Non-sensitive resolution result.
 */
export async function resolveOrAllocateMLBShadowPreparationIdentity(
  repoRoot: string,
  preparationRequestId: string,
  gamePk: number,
  generateShadowRecordId: () => string,
): Promise<MLBShadowPreparationIdentityResolutionResult> {
  /* -- Step 1: input validation (fail-closed, zero FS) ------------------ */
  if (!isValidPreparationRequestId(preparationRequestId)) {
    return makePreFinalizationFailure(
      'VALIDATION_FAILED',
      null,
      null,
      null,
      [
        makeSafeIssue(
          'PREPARATION_REQUEST_ID_INVALID',
          '$.preparationRequestId',
          'preparationRequestId must be a non-empty trimmed string without control characters',
        ),
      ],
    );
  }
  if (!isValidGamePk(gamePk)) {
    return makePreFinalizationFailure(
      'VALIDATION_FAILED',
      preparationRequestId,
      null,
      null,
      [
        makeSafeIssue(
          'GAME_PK_INVALID',
          '$.gamePk',
          'gamePk must be a positive safe integer',
        ),
      ],
    );
  }

  /* -- Step 2: resolve namespace path ---------------------------------- */
  let namespacePath: ReturnType<typeof resolveShadowMonitoringNamespacePath>;
  try {
    namespacePath = resolveShadowMonitoringNamespacePath(
      repoRoot,
      PREPARATION_IDENTITIES_RELATIVE,
    );
  } catch {
    return makePreFinalizationFailure(
      'REPO_ROOT_INVALID',
      preparationRequestId,
      gamePk,
      null,
    );
  }

  const registryDir = namespacePath.resolved;
  const artifactFilename = computeArtifactFilename(preparationRequestId);
  let finalPath = path.join(registryDir, artifactFilename);
  const relativePath = path.join(PREPARATION_IDENTITIES_RELATIVE, artifactFilename);
  const ancestors = buildAncestorChain(namespacePath.repositoryRoot);

  /* -- Step 3: audit ancestors ----------------------------------------- */
  const ancestorAudit = await auditAncestors(ancestors);
  if (!ancestorAudit.ok) {
    const status: MLBShadowPreparationIdentityStoreFailureStatus =
      ancestorAudit.status === 'SYMLINK_DETECTED'
        ? 'SYMLINK_DETECTED'
        : ancestorAudit.status === 'NON_DIRECTORY_TARGET'
          ? 'NON_DIRECTORY_TARGET'
          : 'REPO_ROOT_INVALID';
    return makePreFinalizationFailure(
      status,
      preparationRequestId,
      gamePk,
      null,
    );
  }

  /* -- Ensure the registry directory and ancestors exist ---------------- */
  try {
    await fs.mkdir(registryDir, { recursive: true, mode: DIR_MODE });
  } catch {
    return makePreFinalizationFailure(
      'UNKNOWN_ERROR',
      preparationRequestId,
      gamePk,
      null,
    );
  }

  /* -- Re-check realpath containment (TOCTOU defense) ------------------- */
  /*
   * On macOS, /var is a symlink to /private/var. A temporary repo root
   * created under /var/folders/... must not be rejected merely because
   * fs.realpath canonicalizes /var to /private/var. We resolve the
   * repositoryRoot canonically BEFORE computing the shadow root so that
   * both sides of the containment comparison are canonical. This does
   * NOT weaken symlink rejection: namespace-level symlinks are still
   * caught by the ancestor audit above, and isWithinShadowMonitoringRoot
   * uses component-aware path.relative containment, not naive string
   * prefix matching.
   */
  let canonicalRepoRoot: string;
  try {
    canonicalRepoRoot = await fs.realpath(namespacePath.repositoryRoot);
  } catch {
    return makePreFinalizationFailure(
      'REPO_ROOT_INVALID',
      preparationRequestId,
      gamePk,
      null,
    );
  }
  let realpathDir: string;
  try {
    realpathDir = await fs.realpath(registryDir);
  } catch {
    return makePreFinalizationFailure(
      'READ_ERROR',
      preparationRequestId,
      gamePk,
      null,
    );
  }
  if (!isWithinShadowMonitoringRoot(realpathDir, canonicalRepoRoot)) {
    return makePreFinalizationFailure(
      'SYMLINK_DETECTED',
      preparationRequestId,
      gamePk,
      null,
    );
  }

  /* Recompute finalPath using the realpath-resolved directory to ensure
     the final artifact lands inside the verified shadow root. */
  finalPath = path.join(realpathDir, artifactFilename);

  /* -- Step 4: check for existing record -------------------------------- */
  const existingOutcome = await readExistingIdentityRecord(
    finalPath,
    preparationRequestId,
    gamePk,
  );

  if (existingOutcome.kind === 'missing') {
    /* -- Proceed to allocation ------------------------------------------ */
  } else if (existingOutcome.kind === 'match') {
    return makeIdempotentSuccess(existingOutcome, preparationRequestId, gamePk);
  } else {
    return makeFailureFromExistingOutcome(
      existingOutcome,
      preparationRequestId,
      gamePk,
    );
  }

  /* -- Step 5: generate provisional shadowRecordId --------------------- */
  let shadowRecordId: string;
  try {
    shadowRecordId = generateShadowRecordId();
  } catch {
    return makePreFinalizationFailure(
      'UNKNOWN_ERROR',
      preparationRequestId,
      gamePk,
      null,
    );
  }

  /* -- Build and validate the proposed record -------------------------- */
  const proposedRecord = buildIdentityRecord(
    preparationRequestId,
    gamePk,
    shadowRecordId,
  );
  const recordValidation =
    validateMLBShadowPreparationIdentityRecord(proposedRecord);
  if (!recordValidation.ok) {
    return makePreFinalizationFailure(
      'VALIDATION_FAILED',
      preparationRequestId,
      gamePk,
      shadowRecordId,
      recordValidation.issues,
    );
  }
  const validatedRecord = recordValidation.value;

  /* -- Step 5 (cont.): canonical serialization -------------------------- */
  const canonicalBytes =
    canonicalSerializeMLBShadowPreparationIdentityRecord(validatedRecord);

  /* -- Step 5 (cont.): create O_EXCL temp file -------------------------- */
  const tempFilename = `${randomUUID()}.tmp`;
  const tempPath = path.join(registryDir, tempFilename);

  let handle: fs.FileHandle;
  try {
    handle = await fs.open(tempPath, 'wx', FILE_MODE);
  } catch (error) {
    const code = extractErrorCode(error);
    if (code === 'EEXIST') {
      /* Extremely unlikely with randomUUID, but fail safely. */
      return makePreFinalizationFailure(
        'WRITE_ERROR',
        preparationRequestId,
        gamePk,
        shadowRecordId,
      );
    }
    return makePreFinalizationFailure(
      'WRITE_ERROR',
      preparationRequestId,
      gamePk,
      shadowRecordId,
    );
  }

  let tempCleanupFailed = false;

  try {
    /* Write canonical bytes to the temp file. */
    try {
      await handle.writeFile(canonicalBytes, 'utf-8');
    } catch {
      tempCleanupFailed = true;
      try {
        await handle.close();
      } catch {}
      try {
        await fs.unlink(tempPath);
      } catch {}
      return makePreFinalizationFailure(
        'WRITE_ERROR',
        preparationRequestId,
        gamePk,
        shadowRecordId,
      );
    }

    await handle.close();

    /* -- Step 6: hard-link to final path -------------------------------- */
    try {
      await fs.link(tempPath, finalPath);
    } catch (error) {
      const code = extractErrorCode(error);
      if (code === 'EEXIST') {
        /*
         * Concurrent race: another caller won the hard-link race.
         * Fall back to reading the existing (winner's) record.
         * The loser discards its own provisional shadowRecordId.
         */
        const raceOutcome = await readExistingIdentityRecord(
          finalPath,
          preparationRequestId,
          gamePk,
        );

        if (raceOutcome.kind === 'match') {
          /* Winner's shadowRecordId is adopted — provisional ID discarded. */
          tempCleanupFailed = await cleanupTempFile(tempPath);
          return {
            ok: true,
            status: 'IDEMPOTENT_IDENTICAL_SUCCESS',
            storeVersion: MLB_SHADOW_PREPARATION_IDENTITY_STORE_VERSION,
            artifactCreated: false,
            tempCleanupFailed,
            verificationOk: true,
            preparationRequestId,
            gamePk,
            shadowRecordId: raceOutcome.shadowRecordId,
            relativePath: raceOutcome.relativePath,
            issues: [],
          };
        }

        /* Existing record is corrupt, mismatched, or unreadable — can't adopt. */
        tempCleanupFailed = await cleanupTempFile(tempPath);
        if (raceOutcome.kind === 'missing') {
          return makePreFinalizationFailure(
            'READ_ERROR',
            preparationRequestId,
            gamePk,
            null,
          );
        }
        return makeFailureFromExistingOutcome(
          raceOutcome,
          preparationRequestId,
          gamePk,
        );
      }

      /* Non-EEXIST link error. */
      tempCleanupFailed = true;
      try {
        await fs.unlink(tempPath).catch(() => undefined);
      } catch {}
      return makePreFinalizationFailure(
        'WRITE_ERROR',
        preparationRequestId,
        gamePk,
        shadowRecordId,
      );
    }

    /* -- Step 7: temp cleanup ------------------------------------------- */
    tempCleanupFailed = await cleanupTempFile(tempPath);

    /* -- Step 8: post-finalization verification (read-back) ------------- */
    const verifyOutcome = await readExistingIdentityRecord(
      finalPath,
      preparationRequestId,
      gamePk,
    );

    if (verifyOutcome.kind !== 'match') {
      /*
       * VERIFICATION_FAILED: the file exists (artifactCreated = true)
       * but does not verify as a valid, canonical, identity-matching
       * record. No rollback — the artifact is left in place.
       */
      return {
        ok: false,
        status: 'VERIFICATION_FAILED',
        storeVersion: MLB_SHADOW_PREPARATION_IDENTITY_STORE_VERSION,
        artifactCreated: true,
        tempCleanupFailed,
        preparationRequestId,
        gamePk,
        shadowRecordId,
        relativePath,
        issues: issuesForExistingOutcome(verifyOutcome),
        verificationOk: false,
      };
    }

    /*
     * Defense-in-depth: readExistingIdentityRecord's 'match' outcome only
     * compares preparationRequestId and gamePk. If the read-back file was
     * swapped after the link to carry a different shadowRecordId, detect
     * that divergence here and fail verification with a meaningful issue
     * rather than silently returning issues=[].
     */
    if (verifyOutcome.shadowRecordId !== shadowRecordId) {
      return {
        ok: false,
        status: 'VERIFICATION_FAILED',
        storeVersion: MLB_SHADOW_PREPARATION_IDENTITY_STORE_VERSION,
        artifactCreated: true,
        tempCleanupFailed,
        preparationRequestId,
        gamePk,
        shadowRecordId,
        relativePath,
        issues: [
          makeSafeIssue(
            'SHADOW_RECORD_ID_INVALID',
            '$.shadowRecordId',
            'Read-back shadowRecordId does not match expected identity',
          ),
        ],
        verificationOk: false,
      };
    }

    /* -- Success -------------------------------------------------------- */
    if (tempCleanupFailed) {
      return {
        ok: true,
        status: 'PERSISTED_WITH_CLEANUP_WARNING',
        storeVersion: MLB_SHADOW_PREPARATION_IDENTITY_STORE_VERSION,
        artifactCreated: true,
        tempCleanupFailed,
        preparationRequestId,
        gamePk,
        shadowRecordId,
        relativePath,
        issues: [],
        verificationOk: true,
      };
    }

    return {
      ok: true,
      status: 'PERSISTED',
      storeVersion: MLB_SHADOW_PREPARATION_IDENTITY_STORE_VERSION,
      artifactCreated: true,
      tempCleanupFailed,
      preparationRequestId,
      gamePk,
      shadowRecordId,
      relativePath,
      issues: [],
      verificationOk: true,
    };
  } catch (error) {
    /* Unexpected error after temp file creation. */
    const status: MLBShadowPreparationIdentityStoreFailureStatus =
      'UNKNOWN_ERROR';

    /* Best-effort temp cleanup. */
    await fs.unlink(tempPath).catch(() => undefined);

    return makePreFinalizationFailure(
      status,
      preparationRequestId,
      gamePk,
      shadowRecordId,
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  Temp file cleanup helper                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Attempts to remove the temp file. Returns true if cleanup failed.
 */
async function cleanupTempFile(tempPath: string): Promise<boolean> {
  try {
    await fs.unlink(tempPath);
    return false;
  } catch {
    return true;
  }
}
