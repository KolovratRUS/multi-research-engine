import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_DIRECTORY,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_FAILURE_CODES,
  computeBindingId,
  validateMLBProspectiveHoldoutGameIdentityBindingPrepared,
  validateMLBProspectiveHoldoutGameIdentityBinding,
  pushBindingIssue,
  sortBindingIssues,
  canonicalSerializeGameIdentityBinding,
  type MLBProspectiveHoldoutGameIdentityBindingPrepared,
  type MLBProspectiveHoldoutGameIdentityBinding,
  type MLBProspectiveHoldoutGameIdentityBindingReceipt,
  type MLBProspectiveHoldoutGameIdentityBindingPersistenceResult,
  type MLBProspectiveHoldoutGameIdentityBindingReadResult,
  type MLBProspectiveHoldoutGameIdentityBindingIssue,
} from './mlb-prospective-holdout-game-identity-binding-contract';

/* -------------------------------------------------------------------------- */
/*  Exports                                                                   */
/* -------------------------------------------------------------------------- */

export {
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_DIRECTORY,
  type MLBProspectiveHoldoutGameIdentityBinding,
};

/* -------------------------------------------------------------------------- */
/*  Path resolution                                                           */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveHoldoutGameIdentityBindingStorePaths = Readonly<{
  repositoryRoot: string;
  bindingDirectory: string;
}>;

export type MLBProspectiveHoldoutGameIdentityBindingArtifactPaths = Readonly<{
  repositoryRoot: string;
  bindingDirectory: string;
  bindingPath: string;
  relativePath: string;
}>;

function validateBindingId(bindingId: string): string {
  if (typeof bindingId !== 'string' || bindingId !== bindingId.trim() || bindingId.length === 0) {
    throw new TypeError('bindingId must be a non-empty trimmed string');
  }
  if (bindingId.includes('..') || bindingId.includes('/') || bindingId.includes('\\') || bindingId.includes('\0')) {
    throw new TypeError('bindingId contains path-unsafe characters');
  }
  return bindingId;
}

export function deriveBindingRelativePath(bindingId: string): string {
  const safeId = validateBindingId(bindingId);
  const storageKey = crypto.createHash('sha256').update(safeId, 'utf8').digest('hex');
  return `${storageKey}.json`;
}

export function resolveMLBProspectiveHoldoutGameIdentityBindingStorePaths(
  repositoryRoot: string,
): MLBProspectiveHoldoutGameIdentityBindingStorePaths {
  if (
    !repositoryRoot ||
    typeof repositoryRoot !== 'string' ||
    !path.isAbsolute(repositoryRoot)
  ) {
    throw new TypeError('repositoryRoot must be an absolute non-empty string');
  }
  const root = path.resolve(repositoryRoot);
  const bindingDirectory = path.join(root, MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_DIRECTORY);
  return { repositoryRoot: root, bindingDirectory };
}

export function resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths(
  repositoryRoot: string,
  bindingId: string,
): MLBProspectiveHoldoutGameIdentityBindingArtifactPaths {
  const basePaths = resolveMLBProspectiveHoldoutGameIdentityBindingStorePaths(repositoryRoot);
  const relativePath = deriveBindingRelativePath(bindingId);
  const bindingPath = path.join(basePaths.bindingDirectory, relativePath);
  return {
    repositoryRoot: basePaths.repositoryRoot,
    bindingDirectory: basePaths.bindingDirectory,
    bindingPath,
    relativePath,
  };
}

/* -------------------------------------------------------------------------- */
/*  Store read                                                                */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveHoldoutGameIdentityBindingStoreReadIssue = Readonly<{
  code: 'BINDING_MISSING' | 'BINDING_IO_ERROR' | 'BINDING_JSON_INVALID' | 'BINDING_CONTRACT_INVALID' | 'BINDING_HASH_VERIFICATION_FAILED';
  path: string;
  message: string;
}>;

export type MLBProspectiveHoldoutGameIdentityBindingStoreReadResult =
  | Readonly<{
      ok: true;
      value: MLBProspectiveHoldoutGameIdentityBinding;
      receipt: MLBProspectiveHoldoutGameIdentityBindingReceipt;
    }>
  | Readonly<{ ok: false; issues: readonly MLBProspectiveHoldoutGameIdentityBindingStoreReadIssue[] }>;

export async function readProspectiveHoldoutGameIdentityBinding(
  repositoryRoot: string,
  bindingId: string,
): Promise<MLBProspectiveHoldoutGameIdentityBindingStoreReadResult> {
  const issues: MLBProspectiveHoldoutGameIdentityBindingStoreReadIssue[] = [];
  let artifactPaths: MLBProspectiveHoldoutGameIdentityBindingArtifactPaths;
  try {
    artifactPaths = resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths(repositoryRoot, bindingId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown path derivation error';
    pushStoreReadIssue(issues, 'BINDING_IO_ERROR', '$.bindingId', message);
    return { ok: false, issues };
  }

  let raw: string;
  try {
    raw = await fs.readFile(artifactPaths.bindingPath, 'utf-8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      pushStoreReadIssue(issues, 'BINDING_MISSING', artifactPaths.bindingPath, 'Binding artifact is missing');
      return { ok: false, issues };
    }
    pushStoreReadIssue(issues, 'BINDING_IO_ERROR', artifactPaths.bindingPath, err.message ?? 'Unknown IO error');
    return { ok: false, issues };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    pushStoreReadIssue(issues, 'BINDING_JSON_INVALID', artifactPaths.bindingPath, 'Binding artifact contains invalid JSON');
    return { ok: false, issues };
  }

  const validation = validateMLBProspectiveHoldoutGameIdentityBinding(parsed);
  if (!validation.ok) {
    const contractIssues: MLBProspectiveHoldoutGameIdentityBindingStoreReadIssue[] = validation.issues.map(
      (issue): MLBProspectiveHoldoutGameIdentityBindingStoreReadIssue => ({
        code: 'BINDING_CONTRACT_INVALID',
        path: issue.path,
        message: issue.message,
      }),
    );
    return { ok: false, issues: [...issues, ...contractIssues] };
  }

  const readBuffer = Buffer.from(raw, 'utf-8');
  const readSha256 = crypto.createHash('sha256').update(readBuffer).digest('hex');
  const readByteLength = readBuffer.byteLength;
  const serialized = canonicalSerializeGameIdentityBinding(validation.value);
  const expectedBuffer = Buffer.from(serialized, 'utf-8');
  const expectedSha256 = crypto.createHash('sha256').update(expectedBuffer).digest('hex');
  const expectedByteLength = expectedBuffer.byteLength;
  if (readSha256 !== expectedSha256 || readByteLength !== expectedByteLength) {
    pushStoreReadIssue(issues, 'BINDING_HASH_VERIFICATION_FAILED', artifactPaths.bindingPath, 'Binding artifact hash/byte verification failed');
    return { ok: false, issues };
  }

  const receipt: MLBProspectiveHoldoutGameIdentityBindingReceipt = Object.freeze({
    storeVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
    bindingContractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
    bindingId,
    protocolId: validation.value.protocolId,
    activationId: validation.value.activationId,
    gamePk: validation.value.gamePk,
    gameId: validation.value.gameId,
    evidenceArtifactId: validation.value.evidenceArtifactId,
    evidenceSha256: validation.value.evidenceSha256,
    relativePath: artifactPaths.relativePath,
    sha256: readSha256,
    byteLength: readByteLength,
    persistedAt: validation.value.persistedAt,
  });

  return { ok: true, value: validation.value, receipt };
}

/* -------------------------------------------------------------------------- */
/*  Store write (write-once)                                                 */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveHoldoutGameIdentityBindingStoreWriteResult =
  | Readonly<{ ok: true; receipt: MLBProspectiveHoldoutGameIdentityBindingReceipt }>
  | Readonly<{ ok: false; issues: readonly MLBProspectiveHoldoutGameIdentityBindingIssue[] }>;

export async function persistProspectiveHoldoutGameIdentityBinding(
  repositoryRoot: string,
  prepared: unknown,
  clock: () => string = () => new Date().toISOString(),
): Promise<MLBProspectiveHoldoutGameIdentityBindingPersistenceResult> {
  const issues: MLBProspectiveHoldoutGameIdentityBindingIssue[] = [];
  let paths: MLBProspectiveHoldoutGameIdentityBindingStorePaths;
  try {
    paths = resolveMLBProspectiveHoldoutGameIdentityBindingStorePaths(repositoryRoot);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown path derivation error';
    pushBindingIssue(issues, 'WRITE_FAILED', '$.repositoryRoot', message);
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  // 1. Validate proposed binding
  const preparedValidation = validateMLBProspectiveHoldoutGameIdentityBindingPrepared(prepared);
  if (!preparedValidation.ok) {
    return { ok: false, issues: sortBindingIssues([...issues, ...preparedValidation.issues]) };
  }

  // 2. Derive bindingId and resolve final path
  const bindingId = computeBindingId({
    protocolId: preparedValidation.value.protocolId,
    activationId: preparedValidation.value.activationId,
    gamePk: preparedValidation.value.gamePk,
    evidenceArtifactId: preparedValidation.value.evidenceArtifactId,
    evidenceSha256: preparedValidation.value.evidenceSha256,
  });

  const artifactPaths = resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths(repositoryRoot, bindingId);
  const uniqueToken = crypto.randomUUID().replace(/-/g, '');
  const tempBindingPath = `${artifactPaths.bindingPath}.tmp-${uniqueToken}`;

  // 3. Refuse to replace existing binding via atomic link probe
  try {
    await fs.access(artifactPaths.bindingPath);
    pushBindingIssue(issues, 'BINDING_ALREADY_EXISTS', artifactPaths.bindingPath, 'Binding artifact already exists');
    return { ok: false, issues: sortBindingIssues(issues) };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      pushBindingIssue(issues, 'WRITE_FAILED', artifactPaths.bindingPath, `Failed to probe binding path: ${err.message}`);
      return { ok: false, issues: sortBindingIssues(issues) };
    }
  }

  // 4. Persisted timestamp is owned by the store, not the caller
  const persistedAt = clock();

  // 5. Validate persisted timestamp
  if (typeof persistedAt !== 'string' || persistedAt !== persistedAt.trim() || persistedAt.length === 0) {
    pushBindingIssue(issues, 'INVALID_PERSISTED_AT', '$.persistedAt', 'persistedAt must be a non-empty trimmed string');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(persistedAt)) {
    pushBindingIssue(issues, 'INVALID_PERSISTED_AT', '$.persistedAt', 'persistedAt is not a valid RFC3339 timestamp');
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  const persistedMs = Date.parse(persistedAt);
  if (!Number.isFinite(persistedMs)) {
    pushBindingIssue(issues, 'INVALID_PERSISTED_AT', '$.persistedAt', 'persistedAt is not a valid RFC3339 timestamp');
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  // 6. Timing checks
  const evidenceMs = Date.parse(preparedValidation.value.evidencePersistedAt);
  if (!Number.isFinite(evidenceMs) || persistedMs < evidenceMs) {
    pushBindingIssue(issues, 'BINDING_TIMING_VIOLATION', '$.persistedAt', `persistedAt ${persistedAt} must be >= evidencePersistedAt ${preparedValidation.value.evidencePersistedAt}`);
    return { ok: false, issues: sortBindingIssues(issues) };
  }
  const scheduledMs = Date.parse(preparedValidation.value.scheduledStartAt);
  if (!Number.isFinite(scheduledMs) || persistedMs >= scheduledMs) {
    pushBindingIssue(issues, 'BINDING_TIMING_VIOLATION', '$.persistedAt', `persistedAt ${persistedAt} must be < scheduledStartAt ${preparedValidation.value.scheduledStartAt}`);
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  // 7. Build persisted binding
  const persisted: MLBProspectiveHoldoutGameIdentityBinding = Object.freeze({
    ...preparedValidation.value,
    persistedAt,
  });

  // 8. Validate persisted binding through authoritative persisted validator
  const persistedValidation = validateMLBProspectiveHoldoutGameIdentityBinding(persisted);
  if (!persistedValidation.ok) {
    return { ok: false, issues: sortBindingIssues([...issues, ...persistedValidation.issues]) };
  }

  // 9. Deterministic canonical serialization (recursive string-key ordering)
  const serialized = canonicalSerializeGameIdentityBinding(persisted);

  // 10. Ensure binding directory exists
  try {
    await fs.mkdir(artifactPaths.bindingDirectory, { recursive: true });
  } catch (error) {
    pushBindingIssue(issues, 'WRITE_FAILED', artifactPaths.bindingDirectory, (error as Error).message);
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  // 11. Create unique sibling temporary file with exclusive creation
  let tempFd: Awaited<ReturnType<typeof fs.open>>;
  try {
    tempFd = await fs.open(tempBindingPath, 'wx');
  } catch (error) {
    pushBindingIssue(issues, 'WRITE_FAILED', tempBindingPath, (error as Error).message);
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  // 12. Write complete bytes, fsync temp, close
  const expectedBytes = Buffer.from(serialized, 'utf-8');
  const expectedSha256 = crypto.createHash('sha256').update(expectedBytes).digest('hex');
  const expectedByteLength = expectedBytes.byteLength;
  try {
    await tempFd.writeFile(expectedBytes);
    await tempFd.sync();
    await tempFd.close();
  } catch (error) {
    try { await tempFd.close(); } catch { /* ignore secondary close failure */ }
    try {
      await fs.rm(tempBindingPath, { force: true });
    } catch (cleanupError) {
      pushBindingIssue(issues, 'TEMPORARY_FILE_CLEANUP_FAILED', tempBindingPath, (cleanupError as Error).message);
    }
    pushBindingIssue(issues, 'WRITE_FAILED', tempBindingPath, (error as Error).message);
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  // 13. Atomic link over canonical binding (fails if final already exists)
  try {
    await fs.link(tempBindingPath, artifactPaths.bindingPath);
  } catch (error) {
    try {
      await fs.rm(tempBindingPath, { force: true });
    } catch (cleanupError) {
      pushBindingIssue(issues, 'TEMPORARY_FILE_CLEANUP_FAILED', tempBindingPath, (cleanupError as Error).message);
    }
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'EEXIST') {
      pushBindingIssue(issues, 'BINDING_ALREADY_EXISTS', artifactPaths.bindingPath, 'Binding artifact already exists');
    } else {
      pushBindingIssue(issues, 'WRITE_FAILED', artifactPaths.bindingPath, (error as Error).message);
    }
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  // 14. Remove temporary artifact
  try {
    await fs.rm(tempBindingPath, { force: true });
  } catch (error) {
    pushBindingIssue(issues, 'TEMPORARY_FILE_CLEANUP_FAILED', tempBindingPath, (error as Error).message);
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  // 15. fsync containing directory
  try {
    const dirFd = await fs.open(artifactPaths.bindingDirectory, 'r');
    try {
      await dirFd.sync();
    } finally {
      await dirFd.close();
    }
  } catch (error) {
    pushBindingIssue(issues, 'WRITE_FAILED', artifactPaths.bindingDirectory, (error as Error).message);
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  // 16. Post-write read-back + hash/byte verification
  let readBuffer: Buffer;
  try {
    readBuffer = await fs.readFile(artifactPaths.bindingPath);
  } catch (error) {
    pushBindingIssue(issues, 'WRITE_FAILED', artifactPaths.bindingPath, `Post-write read failed: ${(error as Error).message}`);
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  const readSha256 = crypto.createHash('sha256').update(readBuffer).digest('hex');
  const readByteLength = readBuffer.byteLength;
  if (readSha256 !== expectedSha256 || readByteLength !== expectedByteLength) {
    try { await fs.rm(artifactPaths.bindingPath, { force: true }); } catch { /* best effort cleanup */ }
    pushBindingIssue(issues, 'HASH_VERIFICATION_FAILED', artifactPaths.bindingPath, 'Post-write hash/byte verification failed');
    return { ok: false, issues: sortBindingIssues(issues) };
  }

  // 17. Build receipt
  const receipt: MLBProspectiveHoldoutGameIdentityBindingReceipt = Object.freeze({
    storeVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
    bindingContractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
    bindingId,
    protocolId: persisted.protocolId,
    activationId: persisted.activationId,
    gamePk: persisted.gamePk,
    gameId: persisted.gameId,
    evidenceArtifactId: persisted.evidenceArtifactId,
    evidenceSha256: persisted.evidenceSha256,
    relativePath: artifactPaths.relativePath,
    sha256: readSha256,
    byteLength: readByteLength,
    persistedAt: persisted.persistedAt,
  });

  return { ok: true, receipt };
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function pushStoreReadIssue(
  issues: MLBProspectiveHoldoutGameIdentityBindingStoreReadIssue[],
  code: MLBProspectiveHoldoutGameIdentityBindingStoreReadIssue['code'],
  filePath: string,
  message: string,
): void {
  issues.push({ code, path: filePath, message });
}
