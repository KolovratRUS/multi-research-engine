import { promises as fs, type Dirent } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_DIRECTORY,
  validateMLBProspectiveHoldoutActivation,
  validateMLBProspectiveHoldoutActivationPersisted,
  type MLBProspectiveHoldoutActivation,
  type MLBProspectiveHoldoutActivationPersisted,
  type MLBProspectiveHoldoutActivationReceipt,
  type MLBProspectiveHoldoutActivationIssue,
  type MLBProspectiveHoldoutActivationValidationResult,
  type MLBProspectiveHoldoutActivationPersistedValidationResult,
  type MLBProspectiveHoldoutActivationPersistenceResult,
  type MLBProspectiveHoldoutActivationReadResult,
} from './mlb-prospective-holdout-activation-contract';

export {
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_DIRECTORY,
  type MLBProspectiveHoldoutActivation,
};

/* -------------------------------------------------------------------------- */
/*  Path resolution                                                           */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveHoldoutActivationStorePaths = Readonly<{
  repositoryRoot: string;
  activationDirectory: string;
  activationPath: string;
  tempActivationPath: string;
}>;

export function resolveMLBProspectiveHoldoutActivationStorePaths(
  repositoryRoot: string,
): MLBProspectiveHoldoutActivationStorePaths {
  if (!repositoryRoot || typeof repositoryRoot !== 'string' || !path.isAbsolute(repositoryRoot)) {
    throw new TypeError('repositoryRoot must be an absolute non-empty string');
  }
  const root = path.resolve(repositoryRoot);
  const activationDirectory = path.join(root, MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_DIRECTORY);
  const activationFilename = `${MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION}.json`;
  const activationPath = path.join(activationDirectory, activationFilename);
  const uniqueToken = crypto.randomUUID().replace(/-/g, '');
  const tempActivationPath = `${activationPath}.tmp-${uniqueToken}`;
  return { repositoryRoot: root, activationDirectory, activationPath, tempActivationPath };
}

/* -------------------------------------------------------------------------- */
/*  By-id path resolution (opt-in, path-safe via SHA-256)                       */
/* -------------------------------------------------------------------------- */

function activationIdToFilename(activationId: string): string {
  const hash = crypto.createHash('sha256').update(activationId, 'utf-8').digest('hex');
  return `${hash}.json`;
}

export function resolveMLBProspectiveHoldoutActivationByIdPaths(
  repositoryRoot: string,
  activationId: string,
): MLBProspectiveHoldoutActivationStorePaths {
  if (!activationId || typeof activationId !== 'string' || activationId !== activationId.trim()) {
    throw new TypeError('activationId must be a non-empty trimmed string');
  }
  if (!repositoryRoot || typeof repositoryRoot !== 'string' || !path.isAbsolute(repositoryRoot)) {
    throw new TypeError('repositoryRoot must be an absolute non-empty string');
  }
  const root = path.resolve(repositoryRoot);
  const activationDirectory = path.join(root, MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_DIRECTORY);
  const activationFilename = activationIdToFilename(activationId);
  const activationPath = path.join(activationDirectory, activationFilename);
  const uniqueToken = crypto.randomUUID().replace(/-/g, '');
  const tempActivationPath = `${activationPath}.tmp-${uniqueToken}`;
  return { repositoryRoot: root, activationDirectory, activationPath, tempActivationPath };
}

/* -------------------------------------------------------------------------- */
/*  Store read                                                                */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveHoldoutActivationStoreReadIssue = Readonly<{
  code:
    | 'ACTIVATION_MISSING'
    | 'ACTIVATION_IO_ERROR'
    | 'ACTIVATION_JSON_INVALID'
    | 'ACTIVATION_CONTRACT_INVALID'
    | 'ACTIVATION_IDENTITY_MISMATCH';
  path: string;
  message: string;
}>;

export type MLBProspectiveHoldoutActivationStoreReadResult =
  | Readonly<{ ok: true; value: MLBProspectiveHoldoutActivationPersisted; receipt: MLBProspectiveHoldoutActivationReceipt }>
  | Readonly<{ ok: false; issues: readonly MLBProspectiveHoldoutActivationStoreReadIssue[] }>;

async function readActivationFromPaths(
  paths: MLBProspectiveHoldoutActivationStorePaths,
): Promise<MLBProspectiveHoldoutActivationStoreReadResult> {
  const issues: MLBProspectiveHoldoutActivationStoreReadIssue[] = [];

  let raw: string;
  try {
    raw = await fs.readFile(paths.activationPath, 'utf-8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      pushStoreReadIssue(issues, 'ACTIVATION_MISSING', paths.activationPath, 'Activation artifact is missing');
      return { ok: false, issues };
    }
    pushStoreReadIssue(issues, 'ACTIVATION_IO_ERROR', paths.activationPath, err.message ?? 'Unknown IO error');
    return { ok: false, issues };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    pushStoreReadIssue(issues, 'ACTIVATION_JSON_INVALID', paths.activationPath, 'Activation artifact contains invalid JSON');
    return { ok: false, issues };
  }

  const validation = validateMLBProspectiveHoldoutActivationPersisted(parsed);
  if (!validation.ok) {
    const contractIssues: MLBProspectiveHoldoutActivationStoreReadIssue[] = validation.issues.map(
      (issue: MLBProspectiveHoldoutActivationIssue): MLBProspectiveHoldoutActivationStoreReadIssue => ({
        code: 'ACTIVATION_CONTRACT_INVALID',
        path: issue.path,
        message: issue.message,
      }),
    );
    return { ok: false, issues: [...issues, ...contractIssues] };
  }

  const readBuffer = Buffer.from(raw, 'utf-8');
  const readSha256 = crypto.createHash('sha256').update(readBuffer).digest('hex');
  const readByteLength = readBuffer.byteLength;
  const receipt: MLBProspectiveHoldoutActivationReceipt = Object.freeze({
    storeVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_VERSION,
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
    activationId: validation.value.activationId,
    relativePath: path.relative(paths.repositoryRoot, paths.activationPath),
    sha256: readSha256,
    byteLength: readByteLength,
    persistedAt: validation.value.persistedAt,
  });

  return { ok: true, value: validation.value, receipt };
}

export async function readMLBProspectiveHoldoutActivation(
  repositoryRoot: string,
): Promise<MLBProspectiveHoldoutActivationStoreReadResult> {
  let paths: MLBProspectiveHoldoutActivationStorePaths;
  try {
    paths = resolveMLBProspectiveHoldoutActivationStorePaths(repositoryRoot);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown path derivation error';
    const issues: MLBProspectiveHoldoutActivationStoreReadIssue[] = [];
    pushStoreReadIssue(issues, 'ACTIVATION_IO_ERROR', '$.activationPath', message);
    return { ok: false, issues };
  }

  return readActivationFromPaths(paths);
}

export async function readMLBProspectiveHoldoutActivationById(
  repositoryRoot: string,
  requestedActivationId: string,
): Promise<MLBProspectiveHoldoutActivationStoreReadResult> {
  let paths: MLBProspectiveHoldoutActivationStorePaths;
  try {
    paths = resolveMLBProspectiveHoldoutActivationByIdPaths(repositoryRoot, requestedActivationId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown path derivation error';
    const issues: MLBProspectiveHoldoutActivationStoreReadIssue[] = [];
    pushStoreReadIssue(issues, 'ACTIVATION_IO_ERROR', '$.activationPath', message);
    return { ok: false, issues };
  }

  const readResult = await readActivationFromPaths(paths);
  if (!readResult.ok) {
    return readResult;
  }

  if (readResult.value.activationId !== requestedActivationId) {
    const issues: MLBProspectiveHoldoutActivationStoreReadIssue[] = [];
    pushStoreReadIssue(
      issues,
      'ACTIVATION_IDENTITY_MISMATCH',
      paths.activationPath,
      `Persisted activationId '${readResult.value.activationId}' does not match requested '${requestedActivationId}'`,
    );
    return { ok: false, issues };
  }

  return readResult;
}

/* -------------------------------------------------------------------------- */
/*  Store inventory (read-only)                                               */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveHoldoutActivationInventoryEntry = Readonly<{
  activationId: string;
  activation: MLBProspectiveHoldoutActivationPersisted;
  receipt: MLBProspectiveHoldoutActivationReceipt;
  filePath: string;
  fileName: string;
}>;

export type MLBProspectiveHoldoutActivationStoreInventory = Readonly<{
  legacy: MLBProspectiveHoldoutActivationInventoryEntry | null;
  byId: readonly MLBProspectiveHoldoutActivationInventoryEntry[];
}>;

export type MLBProspectiveHoldoutActivationStoreInventoryIssue = Readonly<{
  code:
    | 'STORE_DIRECTORY_IO_ERROR'
    | 'STORE_UNEXPECTED_FILE'
    | 'STORE_MALFORMED_JSON'
    | 'STORE_CONTRACT_INVALID'
    | 'STORE_WRONG_HASH_FILENAME'
    | 'STORE_DUPLICATE_ACTIVATION_IDENTITY';
  path: string;
  message: string;
}>;

export type MLBProspectiveHoldoutActivationStoreInventoryResult =
  | { readonly ok: true; readonly inventory: MLBProspectiveHoldoutActivationStoreInventory }
  | { readonly ok: false; readonly issues: readonly MLBProspectiveHoldoutActivationStoreInventoryIssue[] };

const LEGACY_ACTIVATION_FILENAME =
  `${MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION}.json`;
const BY_ID_FILENAME_PATTERN = /^[a-f0-9]{64}\.json$/;
const STORE_TEMP_FILE_SUFFIX_PATTERN = /\.tmp-([a-f0-9]{32})$/;

function isStoreTempFileName(fileName: string): boolean {
  const match = STORE_TEMP_FILE_SUFFIX_PATTERN.exec(fileName);
  if (match === null || match.index === undefined) return false;
  const baseName = fileName.slice(0, match.index);
  return baseName === LEGACY_ACTIVATION_FILENAME || BY_ID_FILENAME_PATTERN.test(baseName);
}

function mapReadIssueToInventoryIssue(
  issue: MLBProspectiveHoldoutActivationStoreReadIssue,
  filePath: string,
): MLBProspectiveHoldoutActivationStoreInventoryIssue {
  let code: MLBProspectiveHoldoutActivationStoreInventoryIssue['code'];
  switch (issue.code) {
    case 'ACTIVATION_IO_ERROR':
      code = 'STORE_DIRECTORY_IO_ERROR';
      break;
    case 'ACTIVATION_JSON_INVALID':
      code = 'STORE_MALFORMED_JSON';
      break;
    case 'ACTIVATION_CONTRACT_INVALID':
      code = 'STORE_CONTRACT_INVALID';
      break;
    case 'ACTIVATION_MISSING':
    case 'ACTIVATION_IDENTITY_MISMATCH':
    default:
      code = 'STORE_UNEXPECTED_FILE';
      break;
  }
  return { code, path: filePath, message: issue.message };
}

export async function inspectMLBProspectiveHoldoutActivationStore(
  repositoryRoot: string,
): Promise<MLBProspectiveHoldoutActivationStoreInventoryResult> {
  let paths: MLBProspectiveHoldoutActivationStorePaths;
  try {
    paths = resolveMLBProspectiveHoldoutActivationStorePaths(repositoryRoot);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown path derivation error';
    return {
      ok: false,
      issues: [
        { code: 'STORE_DIRECTORY_IO_ERROR', path: repositoryRoot, message },
      ],
    };
  }

  let dirEntries: Dirent[];
  try {
    dirEntries = await fs.readdir(paths.activationDirectory, { withFileTypes: true });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return { ok: true, inventory: { legacy: null, byId: [] } };
    }
    return {
      ok: false,
      issues: [
        {
          code: 'STORE_DIRECTORY_IO_ERROR',
          path: paths.activationDirectory,
          message: err.message ?? 'Unknown IO error',
        },
      ],
    };
  }

  const issues: MLBProspectiveHoldoutActivationStoreInventoryIssue[] = [];
  let legacyEntry: MLBProspectiveHoldoutActivationInventoryEntry | null = null;
  const byIdEntries: MLBProspectiveHoldoutActivationInventoryEntry[] = [];
  const seenActivationIds = new Set<string>();

  for (const dirent of dirEntries) {
    const fileName = dirent.name;
    const filePath = path.join(paths.activationDirectory, fileName);

    if (!dirent.isFile()) {
      issues.push({
        code: 'STORE_UNEXPECTED_FILE',
        path: filePath,
        message: `Unexpected directory or non-regular file in activation directory: ${fileName}`,
      });
      continue;
    }

    if (isStoreTempFileName(fileName)) {
      continue;
    }

    const filePaths: MLBProspectiveHoldoutActivationStorePaths = {
      repositoryRoot: paths.repositoryRoot,
      activationDirectory: paths.activationDirectory,
      activationPath: filePath,
      tempActivationPath: '',
    };

    if (fileName === LEGACY_ACTIVATION_FILENAME) {
      const readResult = await readActivationFromPaths(filePaths);
      if (!readResult.ok) {
        for (const issue of readResult.issues) {
          issues.push(mapReadIssueToInventoryIssue(issue, filePath));
        }
        continue;
      }
      if (seenActivationIds.has(readResult.value.activationId)) {
        issues.push({
          code: 'STORE_DUPLICATE_ACTIVATION_IDENTITY',
          path: filePath,
          message: `Duplicate activation identity: ${readResult.value.activationId}`,
        });
        continue;
      }
      seenActivationIds.add(readResult.value.activationId);
      legacyEntry = {
        activationId: readResult.value.activationId,
        activation: readResult.value,
        receipt: readResult.receipt,
        filePath,
        fileName,
      };
      continue;
    }

    if (BY_ID_FILENAME_PATTERN.test(fileName)) {
      const readResult = await readActivationFromPaths(filePaths);
      if (!readResult.ok) {
        for (const issue of readResult.issues) {
          issues.push(mapReadIssueToInventoryIssue(issue, filePath));
        }
        continue;
      }
      const expectedFilename = activationIdToFilename(readResult.value.activationId);
      if (fileName !== expectedFilename) {
        issues.push({
          code: 'STORE_WRONG_HASH_FILENAME',
          path: filePath,
          message: `Filename ${fileName} does not match expected SHA-256 filename ${expectedFilename} for activationId ${readResult.value.activationId}`,
        });
        continue;
      }
      if (seenActivationIds.has(readResult.value.activationId)) {
        issues.push({
          code: 'STORE_DUPLICATE_ACTIVATION_IDENTITY',
          path: filePath,
          message: `Duplicate activation identity: ${readResult.value.activationId}`,
        });
        continue;
      }
      seenActivationIds.add(readResult.value.activationId);
      byIdEntries.push({
        activationId: readResult.value.activationId,
        activation: readResult.value,
        receipt: readResult.receipt,
        filePath,
        fileName,
      });
      continue;
    }

    issues.push({
      code: 'STORE_UNEXPECTED_FILE',
      path: filePath,
      message: `Unexpected file in activation directory: ${fileName}`,
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues: Object.freeze(issues) };
  }

  return {
    ok: true,
    inventory: {
      legacy: legacyEntry,
      byId: Object.freeze(byIdEntries),
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Store write (write-once)                                                  */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveHoldoutActivationStoreWriteIssue = Readonly<{
  code:
    | 'WRITE_VALIDATION_FAILED'
    | 'WRITE_IO_ERROR'
    | 'WRITE_ATOMIC_LINK_FAILED'
    | 'WRITE_TEMP_CLEANUP_FAILED'
    | 'ACTIVATION_ALREADY_EXISTS'
    | 'ACTIVATION_IDENTITY_MISMATCH';
  path: string;
  message: string;
}>;

export type MLBProspectiveHoldoutActivationStoreWriteResult =
  | Readonly<{ ok: true; receipt: MLBProspectiveHoldoutActivationReceipt }>
  | Readonly<{ ok: false; issues: readonly MLBProspectiveHoldoutActivationStoreWriteIssue[] }>;

async function persistValidatedActivationToPaths(
  paths: MLBProspectiveHoldoutActivationStorePaths,
  validatedActivation: MLBProspectiveHoldoutActivation,
  clock: () => string,
): Promise<MLBProspectiveHoldoutActivationStoreWriteResult> {
  const issues: MLBProspectiveHoldoutActivationStoreWriteIssue[] = [];

  // 1. Refuse to replace existing canonical activation via atomic link probe
  try {
    await fs.access(paths.activationPath);
    pushStoreWriteIssue(issues, 'ACTIVATION_ALREADY_EXISTS', paths.activationPath, 'Activation artifact already exists');
    return { ok: false, issues };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      pushStoreWriteIssue(issues, 'WRITE_IO_ERROR', paths.activationPath, `Failed to probe activation path: ${err.message}`);
      return { ok: false, issues };
    }
  }

  // 2. Persisted timestamp is owned by the store, not the caller
  const persistedAt = clock();

  // 3. Build persisted activation
  const persisted: MLBProspectiveHoldoutActivationPersisted = Object.freeze({
    ...validatedActivation,
    persistedAt,
  });

  // 4. Validate persisted activation through authoritative persisted validator
  const persistedValidation = validateMLBProspectiveHoldoutActivationPersisted(persisted);
  if (!persistedValidation.ok) {
    const mappedIssues: MLBProspectiveHoldoutActivationStoreWriteIssue[] = persistedValidation.issues.map(
      (issue): MLBProspectiveHoldoutActivationStoreWriteIssue => ({
        code: 'WRITE_VALIDATION_FAILED',
        path: issue.path,
        message: issue.message,
      }),
    );
    return { ok: false, issues: [...issues, ...mappedIssues] };
  }

  // 5. Deterministic canonical serialization (recursive string-key ordering)
  const serialized = canonicalSerialize(persisted);

  // 6. Ensure activation directory exists
  try {
    await fs.mkdir(paths.activationDirectory, { recursive: true });
  } catch (error) {
    pushStoreWriteIssue(issues, 'WRITE_IO_ERROR', paths.activationDirectory, (error as Error).message);
    return { ok: false, issues };
  }

  // 7. Create unique sibling temporary file with exclusive creation
  let tempFd: Awaited<ReturnType<typeof fs.open>>;
  try {
    tempFd = await fs.open(paths.tempActivationPath, 'wx');
  } catch (error) {
    pushStoreWriteIssue(issues, 'WRITE_IO_ERROR', paths.tempActivationPath, (error as Error).message);
    return { ok: false, issues };
  }

  // 8. Write complete bytes, fsync temp, close
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
      await fs.rm(paths.tempActivationPath, { force: true });
    } catch (cleanupError) {
      pushStoreWriteIssue(issues, 'WRITE_TEMP_CLEANUP_FAILED', paths.tempActivationPath, (cleanupError as Error).message);
    }
    pushStoreWriteIssue(issues, 'WRITE_IO_ERROR', paths.tempActivationPath, (error as Error).message);
    return { ok: false, issues };
  }

  // 9. Atomic link over canonical activation (fails if final already exists)
  try {
    await fs.link(paths.tempActivationPath, paths.activationPath);
  } catch (error) {
    try {
      await fs.rm(paths.tempActivationPath, { force: true });
    } catch (cleanupError) {
      pushStoreWriteIssue(issues, 'WRITE_TEMP_CLEANUP_FAILED', paths.tempActivationPath, (cleanupError as Error).message);
    }
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'EEXIST') {
      pushStoreWriteIssue(issues, 'ACTIVATION_ALREADY_EXISTS', paths.activationPath, 'Activation artifact already exists');
    } else {
      pushStoreWriteIssue(issues, 'WRITE_ATOMIC_LINK_FAILED', paths.activationPath, (error as Error).message);
    }
    return { ok: false, issues };
  }

  // 10. Remove temporary artifact
  try {
    await fs.rm(paths.tempActivationPath, { force: true });
  } catch (error) {
    pushStoreWriteIssue(issues, 'WRITE_TEMP_CLEANUP_FAILED', paths.tempActivationPath, (error as Error).message);
    return { ok: false, issues };
  }

  // 11. fsync containing directory
  try {
    const dirFd = await fs.open(paths.activationDirectory, 'r');
    try {
      await dirFd.sync();
    } finally {
      await dirFd.close();
    }
  } catch (error) {
    pushStoreWriteIssue(issues, 'WRITE_IO_ERROR', paths.activationDirectory, (error as Error).message);
    return { ok: false, issues };
  }

  // 12. Post-write read-back + hash/byte verification
  let readBuffer: Buffer;
  try {
    readBuffer = await fs.readFile(paths.activationPath);
  } catch (error) {
    pushStoreWriteIssue(issues, 'WRITE_IO_ERROR', paths.activationPath, `Post-write read failed: ${(error as Error).message}`);
    return { ok: false, issues };
  }

  const readSha256 = crypto.createHash('sha256').update(readBuffer).digest('hex');
  const readByteLength = readBuffer.byteLength;
  if (readSha256 !== expectedSha256 || readByteLength !== expectedByteLength) {
    try { await fs.rm(paths.activationPath, { force: true }); } catch { /* best effort cleanup */ }
    pushStoreWriteIssue(issues, 'WRITE_IO_ERROR', paths.activationPath, 'Post-write hash/byte verification failed');
    return { ok: false, issues };
  }

  // 13. Build receipt
  const receipt: MLBProspectiveHoldoutActivationReceipt = Object.freeze({
    storeVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_VERSION,
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
    activationId: persisted.activationId,
    relativePath: path.relative(paths.repositoryRoot, paths.activationPath),
    sha256: readSha256,
    byteLength: readByteLength,
    persistedAt: persisted.persistedAt,
  });

  return { ok: true, receipt };
}

export async function writeMLBProspectiveHoldoutActivation(
  repositoryRoot: string,
  proposedActivation: unknown,
  clock: () => string = () => new Date().toISOString(),
): Promise<MLBProspectiveHoldoutActivationStoreWriteResult> {
  const issues: MLBProspectiveHoldoutActivationStoreWriteIssue[] = [];
  let paths: MLBProspectiveHoldoutActivationStorePaths;
  try {
    paths = resolveMLBProspectiveHoldoutActivationStorePaths(repositoryRoot);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown path derivation error';
    pushStoreWriteIssue(issues, 'WRITE_IO_ERROR', '$.activationPath', message);
    return { ok: false, issues };
  }

  // 1. Validate proposed activation
  const validation = validateMLBProspectiveHoldoutActivation(proposedActivation);
  if (!validation.ok) {
    pushStoreWriteIssue(issues, 'WRITE_VALIDATION_FAILED', paths.activationPath, 'Proposed activation failed validation');
    return { ok: false, issues };
  }

  return persistValidatedActivationToPaths(paths, validation.value, clock);
}

export async function writeMLBProspectiveHoldoutActivationById(
  repositoryRoot: string,
  requestedActivationId: string,
  proposedActivation: unknown,
  clock: () => string = () => new Date().toISOString(),
): Promise<MLBProspectiveHoldoutActivationStoreWriteResult> {
  const issues: MLBProspectiveHoldoutActivationStoreWriteIssue[] = [];
  let paths: MLBProspectiveHoldoutActivationStorePaths;
  try {
    paths = resolveMLBProspectiveHoldoutActivationByIdPaths(repositoryRoot, requestedActivationId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown path derivation error';
    pushStoreWriteIssue(issues, 'WRITE_IO_ERROR', '$.activationIdPath', message);
    return { ok: false, issues };
  }

  // 1. Validate proposed activation
  const validation = validateMLBProspectiveHoldoutActivation(proposedActivation);
  if (!validation.ok) {
    pushStoreWriteIssue(issues, 'WRITE_VALIDATION_FAILED', paths.activationPath, 'Proposed activation failed validation');
    return { ok: false, issues };
  }

  // 2. Identity match: requested activationId must equal payload activationId
  if (validation.value.activationId !== requestedActivationId) {
    pushStoreWriteIssue(
      issues,
      'ACTIVATION_IDENTITY_MISMATCH',
      paths.activationPath,
      `Requested activationId '${requestedActivationId}' does not match payload activationId '${validation.value.activationId}'`,
    );
    return { ok: false, issues };
  }

  return persistValidatedActivationToPaths(paths, validation.value, clock);
}

/* -------------------------------------------------------------------------- */
/*  Canonical serialization (mirrors H evidence store)                        */
/* -------------------------------------------------------------------------- */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function sortObjectKeys(value: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.getOwnPropertyNames(value).sort();
  const sorted: Record<string, unknown> = {};
  for (const key of keys) {
    sorted[key] = sortValue(value[key]);
  }
  return sorted;
}

function sortValue(value: unknown): unknown {
  if (isPlainObject(value)) {
    return sortObjectKeys(value);
  }
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  return value;
}

function canonicalSerialize(artifact: MLBProspectiveHoldoutActivationPersisted): string {
  if (isPlainObject(artifact)) {
    return JSON.stringify(sortObjectKeys(artifact));
  }
  throw new TypeError('canonicalSerialize requires a plain object');
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function pushStoreReadIssue(
  issues: MLBProspectiveHoldoutActivationStoreReadIssue[],
  code: MLBProspectiveHoldoutActivationStoreReadIssue['code'],
  filePath: string,
  message: string,
): void {
  issues.push({ code, path: filePath, message });
}

function pushStoreWriteIssue(
  issues: MLBProspectiveHoldoutActivationStoreWriteIssue[],
  code: MLBProspectiveHoldoutActivationStoreWriteIssue['code'],
  filePath: string,
  message: string,
): void {
  issues.push({ code, path: filePath, message });
}
