import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME,
  MLB_INNER_DEVELOPMENT_MAX_DISTINCT_RECIPES,
  MLBInnerDevelopmentCampaignLedger,
  MLBInnerDevelopmentCampaignLedgerIssue,
  MLBInnerDevelopmentCampaignLedgerResult,
  validateMLBInnerDevelopmentCampaignLedger,
} from './mlb-inner-development-campaign-ledger';

/* -------------------------------------------------------------------------- */
/*  Path resolution                                                            */
/* -------------------------------------------------------------------------- */

export type MLBInnerDevelopmentCampaignLedgerStorePaths = Readonly<{
  repositoryRoot: string;
  ledgerDirectory: string;
  ledgerPath: string;
  tempLedgerPath: string;
  lockPath: string;
}>;

export function resolveMLBInnerDevelopmentCampaignLedgerStorePaths(
  repositoryRoot: string,
): MLBInnerDevelopmentCampaignLedgerStorePaths {
  if (!repositoryRoot || typeof repositoryRoot !== 'string' || !path.isAbsolute(repositoryRoot)) {
    throw new TypeError('repositoryRoot must be an absolute non-empty string');
  }
  const root = path.resolve(repositoryRoot);
  const ledgerDirectory = path.join(root, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY);
  const ledgerPath = path.join(ledgerDirectory, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME);
  const tempLedgerPath = `${ledgerPath}.tmp`;
  const lockPath = path.join(ledgerDirectory, '.lock');
  return { repositoryRoot: root, ledgerDirectory, ledgerPath, tempLedgerPath, lockPath };
}

/* -------------------------------------------------------------------------- */
/*  Ledger read                                                               */
/* -------------------------------------------------------------------------- */

export type MLBInnerDevelopmentCampaignLedgerStoreReadIssue = Readonly<{
  code: 'LEDGER_MISSING' | 'LEDGER_IO_ERROR' | 'LEDGER_JSON_INVALID' | 'LEDGER_CONTRACT_INVALID';
  path: string;
  message: string;
}>;

export type MLBInnerDevelopmentCampaignLedgerStoreReadResult =
  | Readonly<{ ok: true; value: MLBInnerDevelopmentCampaignLedger }>
  | Readonly<{ ok: false; issues: readonly MLBInnerDevelopmentCampaignLedgerStoreReadIssue[] }>;

export async function readMLBInnerDevelopmentCampaignLedger(
  repositoryRoot: string,
): Promise<MLBInnerDevelopmentCampaignLedgerStoreReadResult> {
  const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(repositoryRoot);
  const issues: MLBInnerDevelopmentCampaignLedgerStoreReadIssue[] = [];

  let raw: string;
  try {
    raw = await fs.readFile(paths.ledgerPath, 'utf-8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      pushStoreReadIssue(issues, 'LEDGER_MISSING', paths.ledgerPath, 'Canonical ledger file is missing');
      return { ok: false, issues };
    }
    pushStoreReadIssue(issues, 'LEDGER_IO_ERROR', paths.ledgerPath, err.message ?? 'Unknown IO error');
    return { ok: false, issues };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    pushStoreReadIssue(issues, 'LEDGER_JSON_INVALID', paths.ledgerPath, 'Canonical ledger file contains invalid JSON');
    return { ok: false, issues };
  }

  const validation = validateMLBInnerDevelopmentCampaignLedger(parsed);
  if (!validation.ok) {
    const contractIssues = validation.issues.map(
      (issue): MLBInnerDevelopmentCampaignLedgerStoreReadIssue => ({
        code: 'LEDGER_CONTRACT_INVALID',
        path: issue.path,
        message: issue.message,
      }),
    );
    return { ok: false, issues: [...issues, ...contractIssues] };
  }

  return { ok: true, value: validation.value };
}

/* -------------------------------------------------------------------------- */
/*  Ledger write (atomic)                                                     */
/* -------------------------------------------------------------------------- */

export type MLBInnerDevelopmentCampaignLedgerStoreWriteIssue = Readonly<{
  code: 'WRITE_VALIDATION_FAILED' | 'WRITE_IO_ERROR' | 'WRITE_ATOMIC_RENAME_FAILED' | 'WRITE_TEMP_CLEANUP_FAILED';
  path: string;
  message: string;
}>;

export type MLBInnerDevelopmentCampaignLedgerStoreWriteResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; issues: readonly MLBInnerDevelopmentCampaignLedgerStoreWriteIssue[] }>;

export async function writeMLBInnerDevelopmentCampaignLedger(
  repositoryRoot: string,
  proposedLedger: unknown,
): Promise<MLBInnerDevelopmentCampaignLedgerStoreWriteResult> {
  const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(repositoryRoot);
  const issues: MLBInnerDevelopmentCampaignLedgerStoreWriteIssue[] = [];

  // 1. Validate proposed ledger through B1 before any filesystem work
  const validation = validateMLBInnerDevelopmentCampaignLedger(proposedLedger);
  if (!validation.ok) {
    pushStoreWriteIssue(issues, 'WRITE_VALIDATION_FAILED', paths.ledgerPath, 'Proposed ledger failed B1 validation');
    return { ok: false, issues };
  }

  // 1a. Refuse to replace an existing corrupt canonical ledger
  const existingRead = await readMLBInnerDevelopmentCampaignLedger(repositoryRoot);
  if (!existingRead.ok) {
    const existingIssue = existingRead.issues[0];
    if (existingIssue && existingIssue.code !== 'LEDGER_MISSING') {
      pushStoreWriteIssue(issues, 'WRITE_VALIDATION_FAILED', paths.ledgerPath, 'Existing canonical ledger is corrupt');
      return { ok: false, issues };
    }
  }

  // 2. Serialize validated ledger deterministically
  const serialized = JSON.stringify(validation.value, null, 2) + '\n';

  // 3. Ensure ledger directory exists
  try {
    await fs.mkdir(paths.ledgerDirectory, { recursive: true });
  } catch (error) {
    pushStoreWriteIssue(issues, 'WRITE_IO_ERROR', paths.ledgerDirectory, (error as Error).message);
    return { ok: false, issues };
  }

  // 4. Create sibling temporary file with exclusive creation
  let tempFd: Awaited<ReturnType<typeof fs.open>>;
  try {
    tempFd = await fs.open(paths.tempLedgerPath, 'wx');
  } catch (error) {
    pushStoreWriteIssue(issues, 'WRITE_IO_ERROR', paths.tempLedgerPath, (error as Error).message);
    return { ok: false, issues };
  }

  // 5. Write complete bytes, fsync temp, close
  try {
    await tempFd.writeFile(serialized);
    await tempFd.sync();
    await tempFd.close();
  } catch (error) {
    try { await tempFd.close(); } catch { /* ignore secondary close failure */ }
    try {
      await fs.rm(paths.tempLedgerPath, { force: true });
    } catch (cleanupError) {
      pushStoreWriteIssue(issues, 'WRITE_TEMP_CLEANUP_FAILED', paths.tempLedgerPath, (cleanupError as Error).message);
    }
    pushStoreWriteIssue(issues, 'WRITE_IO_ERROR', paths.tempLedgerPath, (error as Error).message);
    return { ok: false, issues };
  }

  // 6. Atomic rename over canonical ledger
  try {
    await fs.rename(paths.tempLedgerPath, paths.ledgerPath);
  } catch (error) {
    try {
      await fs.rm(paths.tempLedgerPath, { force: true });
    } catch (cleanupError) {
      pushStoreWriteIssue(issues, 'WRITE_TEMP_CLEANUP_FAILED', paths.tempLedgerPath, (cleanupError as Error).message);
    }
    pushStoreWriteIssue(issues, 'WRITE_ATOMIC_RENAME_FAILED', paths.ledgerPath, (error as Error).message);
    return { ok: false, issues };
  }

  // 7. fsync containing directory
  try {
    const dirFd = await fs.open(paths.ledgerDirectory, 'r');
    try {
      await dirFd.sync();
    } finally {
      await dirFd.close();
    }
  } catch (error) {
    pushStoreWriteIssue(issues, 'WRITE_IO_ERROR', paths.ledgerDirectory, (error as Error).message);
    return { ok: false, issues };
  }

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Exclusive single-writer lock                                               */
/* -------------------------------------------------------------------------- */

export type MLBInnerDevelopmentCampaignLockIssue = Readonly<{
  code: 'LOCK_ALREADY_EXISTS' | 'LOCK_IO_ERROR' | 'LOCK_STATE_CORRUPT';
  path: string;
  message: string;
}>;

export type MLBInnerDevelopmentCampaignLockResult =
  | Readonly<{ ok: true; ownershipToken: string }>
  | Readonly<{ ok: false; issues: readonly MLBInnerDevelopmentCampaignLockIssue[] }>;

export async function acquireMLBInnerDevelopmentCampaignLock(
  repositoryRoot: string,
): Promise<MLBInnerDevelopmentCampaignLockResult> {
  const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(repositoryRoot);
  const issues: MLBInnerDevelopmentCampaignLockIssue[] = [];

  // Ensure ledger directory exists so lock directory can be created inside it
  try {
    await fs.mkdir(paths.ledgerDirectory, { recursive: true });
  } catch (error) {
    pushLockIssue(issues, 'LOCK_IO_ERROR', paths.ledgerDirectory, (error as Error).message);
    return { ok: false, issues };
  }

  // Atomic mkdir of lock directory
  try {
    await fs.mkdir(paths.lockPath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'EEXIST') {
      pushLockIssue(issues, 'LOCK_ALREADY_EXISTS', paths.lockPath, 'Campaign lock is already held by another writer');
      return { ok: false, issues };
    }
    pushLockIssue(issues, 'LOCK_IO_ERROR', paths.lockPath, err.message ?? 'Unknown IO error during lock acquisition');
    return { ok: false, issues };
  }

  const ownershipToken = crypto.randomBytes(16).toString('hex');
  const tokenPath = path.join(paths.lockPath, '.token');

  try {
    await fs.writeFile(tokenPath, ownershipToken);
  } catch (error) {
    // Partial lock creation: try to clean up our own lock directory
    try {
      await fs.rmdir(paths.lockPath);
    } catch {
      pushLockIssue(issues, 'LOCK_STATE_CORRUPT', paths.lockPath, 'Lock directory created but token write failed; lock cleanup also failed');
      return { ok: false, issues };
    }
    pushLockIssue(issues, 'LOCK_IO_ERROR', tokenPath, (error as Error).message);
    return { ok: false, issues };
  }

  return { ok: true, ownershipToken };
}

export type MLBInnerDevelopmentCampaignLockReleaseIssue = Readonly<{
  code: 'LOCK_RELEASE_OWNERSHIP_MISMATCH' | 'LOCK_RELEASE_IO_ERROR';
  path: string;
  message: string;
}>;

export type MLBInnerDevelopmentCampaignLockReleaseResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; issues: readonly MLBInnerDevelopmentCampaignLockReleaseIssue[] }>;

export async function releaseMLBInnerDevelopmentCampaignLock(
  repositoryRoot: string,
  ownershipToken: string,
): Promise<MLBInnerDevelopmentCampaignLockReleaseResult> {
  const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(repositoryRoot);
  const issues: MLBInnerDevelopmentCampaignLockReleaseIssue[] = [];

  const tokenPath = path.join(paths.lockPath, '.token');
  let storedToken: string;

  try {
    storedToken = await fs.readFile(tokenPath, 'utf-8');
  } catch (error) {
    pushLockReleaseIssue(issues, 'LOCK_RELEASE_IO_ERROR', tokenPath, (error as Error).message);
    return { ok: false, issues };
  }

  if (storedToken !== ownershipToken) {
    pushLockReleaseIssue(issues, 'LOCK_RELEASE_OWNERSHIP_MISMATCH', paths.lockPath, 'Provided ownership token does not match stored token');
    return { ok: false, issues };
  }

  try {
    await fs.rm(paths.lockPath, { recursive: true });
  } catch (error) {
    pushLockReleaseIssue(issues, 'LOCK_RELEASE_IO_ERROR', paths.lockPath, (error as Error).message);
    return { ok: false, issues };
  }

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Internal issue helpers                                                     */
/* -------------------------------------------------------------------------- */

function pushStoreReadIssue(
  issues: MLBInnerDevelopmentCampaignLedgerStoreReadIssue[],
  code: MLBInnerDevelopmentCampaignLedgerStoreReadIssue['code'],
  filePath: string,
  message: string,
): void {
  issues.push({ code, path: filePath, message });
}

function pushStoreWriteIssue(
  issues: MLBInnerDevelopmentCampaignLedgerStoreWriteIssue[],
  code: MLBInnerDevelopmentCampaignLedgerStoreWriteIssue['code'],
  filePath: string,
  message: string,
): void {
  issues.push({ code, path: filePath, message });
}

function pushLockIssue(
  issues: MLBInnerDevelopmentCampaignLockIssue[],
  code: MLBInnerDevelopmentCampaignLockIssue['code'],
  filePath: string,
  message: string,
): void {
  issues.push({ code, path: filePath, message });
}

function pushLockReleaseIssue(
  issues: MLBInnerDevelopmentCampaignLockReleaseIssue[],
  code: MLBInnerDevelopmentCampaignLockReleaseIssue['code'],
  filePath: string,
  message: string,
): void {
  issues.push({ code, path: filePath, message });
}
