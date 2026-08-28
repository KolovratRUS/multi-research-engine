import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
} from './mlb-prospective-holdout-protocol-contract';
import {
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_DIRECTORY,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_FAILURE_CODES,
  type MLBProspectivePregameEvidencePrepared,
  type MLBProspectivePregameEvidence,
  type MLBProspectivePregameEvidenceReceipt,
  type MLBProspectivePregameEvidenceIssue,
  type MLBProspectivePregameEvidencePersistenceResult,
  type MLBProspectivePregameEvidenceReadResult,
  computeArtifactId,
  canonicalSerialize,
  validateMLBProspectivePregameEvidencePrepared,
  validateMLBProspectivePregameEvidence,
  isPlainObject,
  pushIssue,
  sortIssues,
  type MLBProspectivePregameEvidenceFailureCode,
} from './mlb-prospective-pregame-evidence-artifact-contract';

/* -------------------------------------------------------------------------- */
/*  Store paths                                                               */
/* -------------------------------------------------------------------------- */

export type MLBProspectivePregameEvidenceStorePaths = Readonly<{
  repositoryRoot: string;
  evidenceDirectory: string;
}>;

export function resolveMLBProspectivePregameEvidenceStorePaths(
  repositoryRoot: string,
): MLBProspectivePregameEvidenceStorePaths {
  if (
    !repositoryRoot ||
    typeof repositoryRoot !== 'string' ||
    !path.isAbsolute(repositoryRoot)
  ) {
    throw new TypeError('repositoryRoot must be an absolute non-empty string');
  }
  const root = path.resolve(repositoryRoot);
  const evidenceDirectory = path.join(root, MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_DIRECTORY);
  return { repositoryRoot: root, evidenceDirectory };
}

export function validateArtifactId(artifactId: string): string {
  if (typeof artifactId !== 'string' || artifactId !== artifactId.trim() || artifactId.length === 0) {
    throw new TypeError('artifactId must be a non-empty trimmed string');
  }
  if (artifactId.includes('..') || artifactId.includes('/') || artifactId.includes('\\') || artifactId.includes('\0')) {
    throw new TypeError('artifactId contains path-unsafe characters');
  }
  return artifactId;
}

export function deriveArtifactRelativePath(artifactId: string): string {
  const safeId = validateArtifactId(artifactId);
  const storageKey = crypto.createHash('sha256').update(safeId, 'utf8').digest('hex');
  return `${storageKey}.json`;
}

export type MLBProspectivePregameEvidenceArtifactPaths = Readonly<{
  repositoryRoot: string;
  evidenceDirectory: string;
  artifactPath: string;
}>;

export function resolveMLBProspectivePregameEvidenceArtifactPaths(
  repositoryRoot: string,
  artifactId: string,
): MLBProspectivePregameEvidenceArtifactPaths {
  const basePaths = resolveMLBProspectivePregameEvidenceStorePaths(repositoryRoot);
  const safeArtifactId = deriveArtifactRelativePath(artifactId);
  const artifactPath = path.join(basePaths.evidenceDirectory, safeArtifactId);
  return {
    repositoryRoot: basePaths.repositoryRoot,
    evidenceDirectory: basePaths.evidenceDirectory,
    artifactPath,
  };
}

export type MLBProspectivePregameEvidenceClockReader =
  import('./mlb-prospective-pregame-evidence-artifact-contract').MLBProspectivePregameEvidenceClockReader;

export function generateUniqueTempArtifactPath(artifactPath: string): string {
  const randomToken = crypto.randomUUID().replace(/-/g, '');
  return `${artifactPath}.tmp-${randomToken}`;
}

/* -------------------------------------------------------------------------- */
/*  Persistence (write-once, atomic)                                          */
/* -------------------------------------------------------------------------- */

export async function persistProspectivePregameEvidence(
  repositoryRoot: string,
  prepared: MLBProspectivePregameEvidencePrepared,
  clock: MLBProspectivePregameEvidenceClockReader,
): Promise<MLBProspectivePregameEvidencePersistenceResult> {
  const issues: MLBProspectivePregameEvidenceIssue[] = [];

  // 1. Validate prepared evidence through contract
  const validation = validateMLBProspectivePregameEvidencePrepared(prepared);
  if (!validation.ok) {
    return { ok: false, issues: validation.issues };
  }
  const validatedPrepared = validation.value;

  // 2. Read injected clock
  const persistedAt = clock();
  if (typeof persistedAt !== 'string' || persistedAt !== persistedAt.trim() || persistedAt.length === 0) {
    pushIssue(issues, 'INVALID_PERSISTENCE_TIMESTAMP', '$.persistedAt', 'persistedAt must be a non-empty trimmed string');
    return { ok: false, issues: sortIssues(issues) };
  }
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(persistedAt)
  ) {
    pushIssue(issues, 'INVALID_PERSISTENCE_TIMESTAMP', '$.persistedAt', 'persistedAt is not a valid RFC3339 timestamp');
    return { ok: false, issues: sortIssues(issues) };
  }
  const persistedMs = Date.parse(persistedAt);
  if (!Number.isFinite(persistedMs)) {
    pushIssue(issues, 'INVALID_PERSISTENCE_TIMESTAMP', '$.persistedAt', 'persistedAt is not a valid RFC3339 timestamp');
    return { ok: false, issues: sortIssues(issues) };
  }

  // 3. Time-bound checks
  const capturedMs = Date.parse(validatedPrepared.rawSnapshot.capturedAt);
  if (!Number.isFinite(capturedMs) || persistedMs < capturedMs) {
    pushIssue(issues, 'PERSISTENCE_BEFORE_CAPTURE', '$.persistedAt', `persistedAt ${persistedAt} must be >= capturedAt ${validatedPrepared.rawSnapshot.capturedAt}`);
    return { ok: false, issues: sortIssues(issues) };
  }

  const scheduledMs = Date.parse(validatedPrepared.scheduledStartAt);
  if (!Number.isFinite(scheduledMs) || persistedMs >= scheduledMs) {
    pushIssue(issues, 'PERSISTENCE_AFTER_SCHEDULED_START', '$.persistedAt', `persistedAt ${persistedAt} must be < scheduledStartAt ${validatedPrepared.scheduledStartAt}`);
    return { ok: false, issues: sortIssues(issues) };
  }

  // 4. Derive paths
  let paths: MLBProspectivePregameEvidenceArtifactPaths;
  try {
    const artifactId = computeArtifactId(validatedPrepared);
    paths = resolveMLBProspectivePregameEvidenceArtifactPaths(repositoryRoot, artifactId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown path derivation error';
    pushIssue(issues, 'PATH_DERIVATION_FAILED', '$.artifactId', message);
    return { ok: false, issues: sortIssues(issues) };
  }

  const tempArtifactPath = generateUniqueTempArtifactPath(paths.artifactPath);

  // 5. Check for existing artifact (write-once)
  try {
    await fs.access(paths.artifactPath);
    pushIssue(issues, 'ARTIFACT_ALREADY_EXISTS', paths.artifactPath, 'Artifact already exists and write-once semantics forbid overwrite');
    return { ok: false, issues: sortIssues(issues) };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      pushIssue(issues, 'WRITE_FAILED', paths.artifactPath, `Failed to probe artifact path: ${err.message}`);
      return { ok: false, issues: sortIssues(issues) };
    }
  }

  // 6. Build persisted artifact (store owns persistedAt)
  const artifact: MLBProspectivePregameEvidence = Object.freeze({
    ...validatedPrepared,
    persistedAt,
  });

  // 7. Validate persisted artifact through contract
  const persistedValidation = validateMLBProspectivePregameEvidence(artifact);
  if (!persistedValidation.ok) {
    const persistedIssues: MLBProspectivePregameEvidenceIssue[] = persistedValidation.issues.map(
      (issue): MLBProspectivePregameEvidenceIssue => ({
        ...issue,
        code: 'ARTIFACT_VALIDATION_FAILED',
      }),
    );
    return { ok: false, issues: sortIssues([...issues, ...persistedIssues]) };
  }

  // 8. Deterministic canonical bytes + hash
  const serialized = canonicalSerialize(persistedValidation.value);
  const expectedBytes = Buffer.from(serialized, 'utf8');
  const expectedSha256 = crypto.createHash('sha256').update(expectedBytes).digest('hex');
  const expectedByteLength = expectedBytes.byteLength;

  // 9. Ensure directory exists
  try {
    await fs.mkdir(paths.evidenceDirectory, { recursive: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown IO error';
    pushIssue(issues, 'WRITE_FAILED', paths.evidenceDirectory, message);
    return { ok: false, issues: sortIssues(issues) };
  }

  // 10. Create unique temporary file with exclusive creation
  let tempFd: Awaited<ReturnType<typeof fs.open>>;
  try {
    tempFd = await fs.open(tempArtifactPath, 'wx');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown IO error';
    pushIssue(issues, 'WRITE_FAILED', tempArtifactPath, message);
    return { ok: false, issues: sortIssues(issues) };
  }

  // 11. Write complete bytes, fsync temp, close
  try {
    await tempFd.writeFile(expectedBytes);
    await tempFd.sync();
    await tempFd.close();
  } catch (error) {
    try { await tempFd.close(); } catch { /* ignore secondary close failure */ }
    try {
      await fs.rm(tempArtifactPath, { force: true });
    } catch (cleanupError) {
      const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup error';
      pushIssue(issues, 'TEMPORARY_FILE_CLEANUP_FAILED', tempArtifactPath, cleanupMessage);
    }
    const message = error instanceof Error ? error.message : 'Unknown IO error';
    pushIssue(issues, 'WRITE_FAILED', tempArtifactPath, message);
    return { ok: false, issues: sortIssues(issues) };
  }

  // 12. Atomic link over canonical artifact (fails if final already exists)
  try {
    await fs.link(tempArtifactPath, paths.artifactPath);
  } catch (error) {
    try {
      await fs.rm(tempArtifactPath, { force: true });
    } catch (cleanupError) {
      const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup error';
      pushIssue(issues, 'TEMPORARY_FILE_CLEANUP_FAILED', tempArtifactPath, cleanupMessage);
    }
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'EEXIST') {
      pushIssue(issues, 'ARTIFACT_ALREADY_EXISTS', paths.artifactPath, 'Artifact already exists and write-once semantics forbid overwrite');
    } else {
      const message = error instanceof Error ? error.message : 'Unknown IO error';
      pushIssue(issues, 'WRITE_FAILED', paths.artifactPath, message);
    }
    return { ok: false, issues: sortIssues(issues) };
  }

  // 13. Remove temporary artifact
  try {
    await fs.rm(tempArtifactPath, { force: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown IO error';
    pushIssue(issues, 'TEMPORARY_FILE_CLEANUP_FAILED', tempArtifactPath, message);
    return { ok: false, issues: sortIssues(issues) };
  }

  // 14. fsync containing directory
  try {
    const dirFd = await fs.open(paths.evidenceDirectory, 'r');
    try {
      await dirFd.sync();
    } finally {
      await dirFd.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown IO error';
    pushIssue(issues, 'WRITE_FAILED', paths.evidenceDirectory, message);
    return { ok: false, issues: sortIssues(issues) };
  }

  // 15. Post-write read-back + hash/byte verification
  let readBuffer: Buffer;
  try {
    readBuffer = await fs.readFile(paths.artifactPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown IO error';
    pushIssue(issues, 'HASH_VERIFICATION_FAILED', paths.artifactPath, `Post-write read failed: ${message}`);
    return { ok: false, issues: sortIssues(issues) };
  }

  const readSha256 = crypto.createHash('sha256').update(readBuffer).digest('hex');
  const readByteLength = readBuffer.byteLength;

  if (readSha256 !== expectedSha256 || readByteLength !== expectedByteLength) {
    pushIssue(issues, 'HASH_VERIFICATION_FAILED', paths.artifactPath, `Post-write hash/byte mismatch: expected ${expectedSha256}/${expectedByteLength}, got ${readSha256}/${readByteLength}`);
    return { ok: false, issues: sortIssues(issues) };
  }

  // 16. Parse and revalidate persisted artifact
  let parsed: unknown;
  try {
    parsed = JSON.parse(readBuffer.toString('utf-8'));
  } catch {
    pushIssue(issues, 'HASH_VERIFICATION_FAILED', paths.artifactPath, 'Persisted artifact contains invalid JSON');
    return { ok: false, issues: sortIssues(issues) };
  }

  const revalidation = validateMLBProspectivePregameEvidence(parsed);
  if (!revalidation.ok) {
    pushIssue(issues, 'HASH_VERIFICATION_FAILED', paths.artifactPath, `Post-write revalidation failed: ${revalidation.issues.map(i => i.message).join('; ')}`);
    return { ok: false, issues: sortIssues(issues) };
  }

  // 17. Build receipt
  const artifactId = computeArtifactId(validatedPrepared);
  const relativePath = deriveArtifactRelativePath(artifactId);

  const receipt: MLBProspectivePregameEvidenceReceipt = Object.freeze({
    storeVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
    artifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
    artifactId,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: validatedPrepared.activationId,
    gameId: validatedPrepared.gameId,
    snapshotId: validatedPrepared.snapshotId,
    relativePath,
    sha256: readSha256,
    byteLength: readByteLength,
    persistedAt,
  });

  return { ok: true, receipt };
}

/* -------------------------------------------------------------------------- */
/*  Read-back API (read-only)                                                 */
/* -------------------------------------------------------------------------- */

export async function readProspectivePregameEvidence(
  repositoryRoot: string,
  artifactId: string,
): Promise<MLBProspectivePregameEvidenceReadResult> {
  const issues: MLBProspectivePregameEvidenceIssue[] = [];

  let paths: MLBProspectivePregameEvidenceArtifactPaths;
  try {
    paths = resolveMLBProspectivePregameEvidenceArtifactPaths(repositoryRoot, artifactId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown path derivation error';
    pushIssue(issues, 'PATH_DERIVATION_FAILED', '$.artifactId', message);
    return { ok: false, issues: sortIssues(issues) };
  }

  let readBuffer: Buffer;
  try {
    readBuffer = await fs.readFile(paths.artifactPath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      pushIssue(issues, 'ARTIFACT_VALIDATION_FAILED', paths.artifactPath, 'Artifact file is missing');
      return { ok: false, issues: sortIssues(issues) };
    }
    const message = error instanceof Error ? error.message : 'Unknown IO error';
    pushIssue(issues, 'ARTIFACT_VALIDATION_FAILED', paths.artifactPath, message);
    return { ok: false, issues: sortIssues(issues) };
  }

  const readSha256 = crypto.createHash('sha256').update(readBuffer).digest('hex');
  const readByteLength = readBuffer.byteLength;

  let parsed: unknown;
  try {
    parsed = JSON.parse(readBuffer.toString('utf-8'));
  } catch {
    pushIssue(issues, 'ARTIFACT_VALIDATION_FAILED', paths.artifactPath, 'Artifact contains invalid JSON');
    return { ok: false, issues: sortIssues(issues) };
  }

  const validation = validateMLBProspectivePregameEvidence(parsed);
  if (!validation.ok) {
    const validationIssues: MLBProspectivePregameEvidenceIssue[] = validation.issues.map(
      (issue): MLBProspectivePregameEvidenceIssue => ({
        ...issue,
        code: 'ARTIFACT_VALIDATION_FAILED',
      }),
    );
    return { ok: false, issues: sortIssues([...issues, ...validationIssues]) };
  }

  const persistedArtifact = validation.value;
  const relativePath = deriveArtifactRelativePath(artifactId);

  const receipt: MLBProspectivePregameEvidenceReceipt = Object.freeze({
    storeVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
    artifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
    artifactId,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: persistedArtifact.activationId,
    gameId: persistedArtifact.gameId,
    snapshotId: persistedArtifact.snapshotId,
    relativePath,
    sha256: readSha256,
    byteLength: readByteLength,
    persistedAt: persistedArtifact.persistedAt,
  });

  return {
    ok: true,
    value: Object.freeze(persistedArtifact),
    receipt,
  };
}
