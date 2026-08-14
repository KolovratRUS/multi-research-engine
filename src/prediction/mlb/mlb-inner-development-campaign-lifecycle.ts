import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  MLB_INNER_DEVELOPMENT_CYCLE_ID,
  MLB_INNER_DEVELOPMENT_RECIPE_BUDGET_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-train-only-inner-development-evaluator';
import {
  MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_RESET_PREVENTION_ANCHOR,
  MLB_INNER_DEVELOPMENT_MAX_DISTINCT_RECIPES,
  MLBInnerDevelopmentCampaignAnchor,
  MLBInnerDevelopmentCampaignLedger,
  validateMLBInnerDevelopmentCampaignAnchor,
  validateMLBInnerDevelopmentCampaignLedger,
} from '@/prediction/mlb/mlb-inner-development-campaign-ledger';
import {
  resolveMLBInnerDevelopmentCampaignLedgerStorePaths,
  readMLBInnerDevelopmentCampaignLedger,
  writeMLBInnerDevelopmentCampaignLedger,
  acquireMLBInnerDevelopmentCampaignLock,
  releaseMLBInnerDevelopmentCampaignLock,
} from '@/prediction/mlb/mlb-inner-development-campaign-ledger-store';

/* -------------------------------------------------------------------------- */
/*  Identity contract                                                          */
/* -------------------------------------------------------------------------- */

export const MLB_INNER_DEVELOPMENT_CAMPAIGN_IDENTITY_CONTRACT_VERSION =
  'mlb-inner-development-campaign-identity-v1' as const;

export function computeMLBInnerDevelopmentCampaignIdentity(
  genesisCreatedAt: string,
): string {
  const preimage = JSON.stringify([
    MLB_INNER_DEVELOPMENT_CAMPAIGN_IDENTITY_CONTRACT_VERSION,
    MLB_INNER_DEVELOPMENT_CYCLE_ID,
    MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY,
    MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME,
    MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
    genesisCreatedAt,
  ]);
  return crypto.createHash('sha256').update(preimage, 'utf-8').digest('hex');
}

/* -------------------------------------------------------------------------- */
/*  Lifecycle state model                                                     */
/* -------------------------------------------------------------------------- */

export type MLBInnerDevelopmentCampaignLifecycleState =
  | 'NOT_INITIALIZED'
  | 'READY'
  | 'FAIL_CLOSED_ANCHOR_WITHOUT_LEDGER'
  | 'FAIL_CLOSED_LEDGER_WITHOUT_ANCHOR'
  | 'FAIL_CLOSED_INVALID_ANCHOR'
  | 'FAIL_CLOSED_INVALID_LEDGER'
  | 'FAIL_CLOSED_CAMPAIGN_IDENTITY_MISMATCH'
  | 'FAIL_CLOSED_PARTIAL_GENESIS'
  | 'FAIL_CLOSED_LOCK_ACQUISITION_FAILED'
  | 'FAIL_CLOSED_LOCK_RELEASE_FAILED'
  | 'FAIL_CLOSED_ALREADY_INITIALIZED';

export type MLBInnerDevelopmentCampaignLifecycleIssue = Readonly<{
  code: MLBInnerDevelopmentCampaignLifecycleState;
  path: string;
  message: string;
}>;

/* -------------------------------------------------------------------------- */
/*  Genesis input/result                                                      */
/* -------------------------------------------------------------------------- */

export type MLBInnerDevelopmentCampaignGenesisInput = Readonly<{
  authorization: 'EXPLICIT_ONE_TIME_GENESIS';
  genesisTimestamp: string;
}>;

export type MLBInnerDevelopmentCampaignGenesisResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      state: MLBInnerDevelopmentCampaignLifecycleState;
      issues: readonly MLBInnerDevelopmentCampaignLifecycleIssue[];
    }>;

/* -------------------------------------------------------------------------- */
/*  Lock-held inspection result                                                */
/* -------------------------------------------------------------------------- */

export type MLBInnerDevelopmentCampaignInspectionResult =
  | Readonly<{
      ok: true;
      state: 'READY';
      anchor: MLBInnerDevelopmentCampaignAnchor;
      ledger: MLBInnerDevelopmentCampaignLedger;
    }>
  | Readonly<{
      ok: false;
      state: MLBInnerDevelopmentCampaignLifecycleState;
      issues: readonly MLBInnerDevelopmentCampaignLifecycleIssue[];
    }>;

/* -------------------------------------------------------------------------- */
/*  Resume result                                                             */
/* -------------------------------------------------------------------------- */

export type MLBInnerDevelopmentCampaignResumeResult =
  | Readonly<{
      ok: true;
      state: 'READY';
      anchor: MLBInnerDevelopmentCampaignAnchor;
      ledger: MLBInnerDevelopmentCampaignLedger;
    }>
  | Readonly<{
      ok: false;
      state: MLBInnerDevelopmentCampaignLifecycleState;
      issues: readonly MLBInnerDevelopmentCampaignLifecycleIssue[];
    }>;

/* -------------------------------------------------------------------------- */
/*  Internal path resolution                                                  */
/* -------------------------------------------------------------------------- */

type MLBInnerDevelopmentCampaignLifecyclePaths = Readonly<{
  repositoryRoot: string;
  ledgerDirectory: string;
  ledgerPath: string;
  anchorPath: string;
  lockPath: string;
}>;

function resolveMLBInnerDevelopmentCampaignLifecyclePaths(
  repositoryRoot: string,
): MLBInnerDevelopmentCampaignLifecyclePaths {
  if (!repositoryRoot || typeof repositoryRoot !== 'string' || !path.isAbsolute(repositoryRoot)) {
    throw new TypeError('repositoryRoot must be an absolute non-empty string');
  }
  const root = path.resolve(repositoryRoot);
  const storePaths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(root);
  return {
    repositoryRoot: root,
    ledgerDirectory: storePaths.ledgerDirectory,
    ledgerPath: storePaths.ledgerPath,
    anchorPath: path.join(root, MLB_INNER_DEVELOPMENT_CAMPAIGN_RESET_PREVENTION_ANCHOR),
    lockPath: storePaths.lockPath,
  };
}

/* -------------------------------------------------------------------------- */
/*  Internal anchor read                                                      */
/* -------------------------------------------------------------------------- */

type MLBInnerDevelopmentCampaignAnchorReadIssue = Readonly<{
  code: 'ANCHOR_MISSING' | 'ANCHOR_IO_ERROR' | 'ANCHOR_JSON_INVALID' | 'ANCHOR_CONTRACT_INVALID';
  path: string;
  message: string;
}>;

type MLBInnerDevelopmentCampaignAnchorReadResult =
  | Readonly<{ ok: true; value: MLBInnerDevelopmentCampaignAnchor }>
  | Readonly<{ ok: false; issues: readonly MLBInnerDevelopmentCampaignAnchorReadIssue[] }>;

async function readMLBInnerDevelopmentCampaignAnchor(
  repositoryRoot: string,
): Promise<MLBInnerDevelopmentCampaignAnchorReadResult> {
  const paths = resolveMLBInnerDevelopmentCampaignLifecyclePaths(repositoryRoot);
  const issues: MLBInnerDevelopmentCampaignAnchorReadIssue[] = [];

  let raw: string;
  try {
    raw = await fs.readFile(paths.anchorPath, 'utf-8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      pushAnchorReadIssue(issues, 'ANCHOR_MISSING', paths.anchorPath, 'Canonical anchor file is missing');
      return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorReadIssue[] };
    }
    pushAnchorReadIssue(issues, 'ANCHOR_IO_ERROR', paths.anchorPath, err.message ?? 'Unknown IO error');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorReadIssue[] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    pushAnchorReadIssue(issues, 'ANCHOR_JSON_INVALID', paths.anchorPath, 'Canonical anchor file contains invalid JSON');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorReadIssue[] };
  }

  const validation = validateMLBInnerDevelopmentCampaignAnchor(parsed);
  if (!validation.ok) {
    const contractIssues = validation.issues.map(
      (issue): MLBInnerDevelopmentCampaignAnchorReadIssue => ({
        code: 'ANCHOR_CONTRACT_INVALID',
        path: issue.path,
        message: issue.message,
      }),
    );
    return { ok: false, issues: [...issues, ...contractIssues] as readonly MLBInnerDevelopmentCampaignAnchorReadIssue[] };
  }

  return { ok: true, value: validation.value };
}

/* -------------------------------------------------------------------------- */
/*  Internal anchor write                                                     */
/* -------------------------------------------------------------------------- */

type MLBInnerDevelopmentCampaignAnchorWriteIssue = Readonly<{
  code: 'ANCHOR_WRITE_IO_ERROR' | 'ANCHOR_ALREADY_EXISTS';
  path: string;
  message: string;
}>;

type MLBInnerDevelopmentCampaignAnchorWriteResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; issues: readonly MLBInnerDevelopmentCampaignAnchorWriteIssue[] }>;

async function writeMLBInnerDevelopmentCampaignAnchor(
  repositoryRoot: string,
  anchor: MLBInnerDevelopmentCampaignAnchor,
): Promise<MLBInnerDevelopmentCampaignAnchorWriteResult> {
  const paths = resolveMLBInnerDevelopmentCampaignLifecyclePaths(repositoryRoot);
  const issues: MLBInnerDevelopmentCampaignAnchorWriteIssue[] = [];

  const anchorDir = path.join(paths.repositoryRoot, 'docs');
  try {
    await fs.mkdir(anchorDir, { recursive: true });
  } catch (error) {
    pushAnchorWriteIssue(issues, 'ANCHOR_WRITE_IO_ERROR', anchorDir, (error as Error).message);
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorWriteIssue[] };
  }

  let fd: Awaited<ReturnType<typeof fs.open>>;
  try {
    fd = await fs.open(paths.anchorPath, 'wx');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'EEXIST') {
      pushAnchorWriteIssue(issues, 'ANCHOR_ALREADY_EXISTS', paths.anchorPath, 'Anchor already exists');
      return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorWriteIssue[] };
    }
    pushAnchorWriteIssue(issues, 'ANCHOR_WRITE_IO_ERROR', paths.anchorPath, err.message ?? 'Unknown IO error');
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorWriteIssue[] };
  }

  const serialized = JSON.stringify(anchor, null, 2) + '\n';
  try {
    await fd.writeFile(serialized);
    await fd.sync();
    await fd.close();
  } catch (error) {
    try {
      await fd.close();
    } catch {
      // ignore secondary close failure
    }
    pushAnchorWriteIssue(issues, 'ANCHOR_WRITE_IO_ERROR', paths.anchorPath, (error as Error).message);
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorWriteIssue[] };
  }

  try {
    const dirFd = await fs.open(anchorDir, 'r');
    try {
      await dirFd.sync();
    } finally {
      await dirFd.close();
    }
  } catch (error) {
    pushAnchorWriteIssue(issues, 'ANCHOR_WRITE_IO_ERROR', anchorDir, (error as Error).message);
    return { ok: false, issues: issues as readonly MLBInnerDevelopmentCampaignAnchorWriteIssue[] };
  }

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Issue helpers                                                             */
/* -------------------------------------------------------------------------- */

function pushLifecycleIssue(
  issues: MLBInnerDevelopmentCampaignLifecycleIssue[],
  code: MLBInnerDevelopmentCampaignLifecycleState,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function pushAnchorReadIssue(
  issues: MLBInnerDevelopmentCampaignAnchorReadIssue[],
  code: MLBInnerDevelopmentCampaignAnchorReadIssue['code'],
  filePath: string,
  message: string,
): void {
  issues.push({ code, path: filePath, message });
}

function pushAnchorWriteIssue(
  issues: MLBInnerDevelopmentCampaignAnchorWriteIssue[],
  code: MLBInnerDevelopmentCampaignAnchorWriteIssue['code'],
  filePath: string,
  message: string,
): void {
  issues.push({ code, path: filePath, message });
}

/* -------------------------------------------------------------------------- */
/*  Explicit genesis                                                          */
/* -------------------------------------------------------------------------- */

export async function initializeMLBInnerDevelopmentCampaign(
  repositoryRoot: string,
  input: MLBInnerDevelopmentCampaignGenesisInput,
): Promise<MLBInnerDevelopmentCampaignGenesisResult> {
  const issues: MLBInnerDevelopmentCampaignLifecycleIssue[] = [];
  const paths = resolveMLBInnerDevelopmentCampaignLifecyclePaths(repositoryRoot);

  if (input.authorization !== 'EXPLICIT_ONE_TIME_GENESIS') {
    pushLifecycleIssue(issues, 'FAIL_CLOSED_INVALID_ANCHOR', '', 'Invalid genesis authorization');
    return { ok: false, state: 'FAIL_CLOSED_INVALID_ANCHOR', issues: issues as readonly MLBInnerDevelopmentCampaignLifecycleIssue[] };
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(input.genesisTimestamp)) {
    pushLifecycleIssue(issues, 'FAIL_CLOSED_INVALID_LEDGER', '', 'Invalid genesis timestamp');
    return { ok: false, state: 'FAIL_CLOSED_INVALID_LEDGER', issues: issues as readonly MLBInnerDevelopmentCampaignLifecycleIssue[] };
  }

  const genesisLedger: MLBInnerDevelopmentCampaignLedger = {
    ledgerContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
    developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
    createdAt: input.genesisTimestamp,
    updatedAt: input.genesisTimestamp,
    budget: {
      contractVersion: MLB_INNER_DEVELOPMENT_RECIPE_BUDGET_CONTRACT_VERSION,
      cycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
      maxDistinctRecipes: MLB_INNER_DEVELOPMENT_MAX_DISTINCT_RECIPES,
      seenRecipeIds: [],
      seenRecipeFingerprints: [],
      seenComplexityRanks: [],
      evaluationCount: 0,
    },
    registeredRecipes: [],
    attempts: [],
  };

  const ledgerValidation = validateMLBInnerDevelopmentCampaignLedger(genesisLedger);
  if (!ledgerValidation.ok) {
    pushLifecycleIssue(issues, 'FAIL_CLOSED_INVALID_LEDGER', paths.ledgerPath, 'Genesis ledger failed validation');
    return { ok: false, state: 'FAIL_CLOSED_INVALID_LEDGER', issues: issues as readonly MLBInnerDevelopmentCampaignLifecycleIssue[] };
  }

  const campaignIdentity = computeMLBInnerDevelopmentCampaignIdentity(input.genesisTimestamp);

  const anchor: MLBInnerDevelopmentCampaignAnchor = {
    anchorContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION,
    developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
    canonicalLedgerDirectory: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY,
    canonicalLedgerFilename: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME,
    ledgerContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
    campaignIdentity,
  };

  const anchorValidation = validateMLBInnerDevelopmentCampaignAnchor(anchor);
  if (!anchorValidation.ok) {
    pushLifecycleIssue(issues, 'FAIL_CLOSED_INVALID_ANCHOR', paths.anchorPath, 'Genesis anchor failed validation');
    return { ok: false, state: 'FAIL_CLOSED_INVALID_ANCHOR', issues: issues as readonly MLBInnerDevelopmentCampaignLifecycleIssue[] };
  }

  const lockResult = await acquireMLBInnerDevelopmentCampaignLock(repositoryRoot);
  if (!lockResult.ok) {
    pushLifecycleIssue(
      issues,
      'FAIL_CLOSED_LOCK_ACQUISITION_FAILED',
      paths.lockPath,
      lockResult.issues.map(i => i.message).join('; '),
    );
    return { ok: false, state: 'FAIL_CLOSED_LOCK_ACQUISITION_FAILED', issues: issues as readonly MLBInnerDevelopmentCampaignLifecycleIssue[] };
  }

  let result: MLBInnerDevelopmentCampaignGenesisResult = { ok: true };
  let lockReleased = false;

  try {
    const anchorRead = await readMLBInnerDevelopmentCampaignAnchor(repositoryRoot);
    const ledgerRead = await readMLBInnerDevelopmentCampaignLedger(repositoryRoot);

    if (anchorRead.ok && ledgerRead.ok) {
      result = {
        ok: false,
        state: 'FAIL_CLOSED_ALREADY_INITIALIZED',
        issues: [
          {
            code: 'FAIL_CLOSED_ALREADY_INITIALIZED',
            path: paths.anchorPath,
            message: 'Both anchor and ledger already exist',
          },
        ] as readonly MLBInnerDevelopmentCampaignLifecycleIssue[],
      };
      return result;
    }

    if (anchorRead.ok) {
      if (!ledgerRead.ok) {
        if (ledgerRead.issues[0]?.code === 'LEDGER_MISSING') {
          result = {
            ok: false,
            state: 'FAIL_CLOSED_ANCHOR_WITHOUT_LEDGER',
            issues: [
              {
                code: 'FAIL_CLOSED_ANCHOR_WITHOUT_LEDGER',
                path: paths.anchorPath,
                message: 'Anchor exists but ledger is missing',
              },
            ] as readonly MLBInnerDevelopmentCampaignLifecycleIssue[],
          };
        } else {
          result = {
            ok: false,
            state: 'FAIL_CLOSED_INVALID_LEDGER',
            issues: [
              {
                code: 'FAIL_CLOSED_INVALID_LEDGER',
                path: paths.ledgerPath,
                message: ledgerRead.issues.map(i => i.message).join('; '),
              },
            ] as readonly MLBInnerDevelopmentCampaignLifecycleIssue[],
          };
        }
      }
      return result;
    }

    if (anchorRead.issues[0]?.code !== 'ANCHOR_MISSING') {
      result = {
        ok: false,
        state: 'FAIL_CLOSED_INVALID_ANCHOR',
        issues: [
          {
            code: 'FAIL_CLOSED_INVALID_ANCHOR',
            path: paths.anchorPath,
            message: anchorRead.issues.map(i => i.message).join('; '),
          },
        ] as readonly MLBInnerDevelopmentCampaignLifecycleIssue[],
      };
      return result;
    }

    if (ledgerRead.ok) {
      result = {
        ok: false,
        state: 'FAIL_CLOSED_LEDGER_WITHOUT_ANCHOR',
        issues: [
          {
            code: 'FAIL_CLOSED_LEDGER_WITHOUT_ANCHOR',
            path: paths.ledgerPath,
            message: 'Ledger exists but anchor is missing',
          },
        ] as readonly MLBInnerDevelopmentCampaignLifecycleIssue[],
      };
      return result;
    }

    if (ledgerRead.issues[0]?.code !== 'LEDGER_MISSING') {
      result = {
        ok: false,
        state: 'FAIL_CLOSED_INVALID_LEDGER',
        issues: [
          {
            code: 'FAIL_CLOSED_INVALID_LEDGER',
            path: paths.ledgerPath,
            message: ledgerRead.issues.map(i => i.message).join('; '),
          },
        ] as readonly MLBInnerDevelopmentCampaignLifecycleIssue[],
      };
      return result;
    }

    const anchorWriteResult = await writeMLBInnerDevelopmentCampaignAnchor(repositoryRoot, anchor);
    if (!anchorWriteResult.ok) {
      result = {
        ok: false,
        state: 'FAIL_CLOSED_INVALID_ANCHOR',
        issues: [
          {
            code: 'FAIL_CLOSED_INVALID_ANCHOR',
            path: paths.anchorPath,
            message: anchorWriteResult.issues.map(i => i.message).join('; '),
          },
        ] as readonly MLBInnerDevelopmentCampaignLifecycleIssue[],
      };
      return result;
    }

    const ledgerWriteResult = await writeMLBInnerDevelopmentCampaignLedger(repositoryRoot, genesisLedger);
    if (!ledgerWriteResult.ok) {
      result = {
        ok: false,
        state: 'FAIL_CLOSED_PARTIAL_GENESIS',
        issues: [
          {
            code: 'FAIL_CLOSED_PARTIAL_GENESIS',
            path: paths.ledgerPath,
            message: 'Anchor created but ledger write failed',
          },
        ] as readonly MLBInnerDevelopmentCampaignLifecycleIssue[],
      };
      return result;
    }

    result = { ok: true };
  } finally {
    if (!lockReleased) {
      const releaseResult = await releaseMLBInnerDevelopmentCampaignLock(repositoryRoot, lockResult.ownershipToken);
      if (!releaseResult.ok) {
        const lockIssue: MLBInnerDevelopmentCampaignLifecycleIssue = {
          code: 'FAIL_CLOSED_LOCK_RELEASE_FAILED',
          path: paths.lockPath,
          message: releaseResult.issues.map(i => i.message).join('; '),
        };
        if (result.ok) {
          result = {
            ok: false,
            state: 'FAIL_CLOSED_LOCK_RELEASE_FAILED',
            issues: [lockIssue],
          };
        } else {
          const existing = result as MLBInnerDevelopmentCampaignGenesisResult & { ok: false };
          result = {
            ok: false,
            state: existing.state,
            issues: [...existing.issues, lockIssue],
          };
        }
      }
      lockReleased = true;
    }
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/*  Lock-held lifecycle inspection                                             */
/* -------------------------------------------------------------------------- */

/**
 * Read-only lifecycle inspection intended to be called while the caller already
 * owns the canonical B2-A campaign lock.
 *
 * This function performs the same anchor/ledger read, state classification, and
 * campaign-identity reconciliation used by resume, but it does NOT acquire or
 * release the campaign lock and does NOT mutate the filesystem.
 *
 * Future B3 registration orchestration should use this seam under its own
 * acquired lock rather than reimplementing anchor/ledger read or state
 * classification.
 */
export async function inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(
  repositoryRoot: string,
): Promise<MLBInnerDevelopmentCampaignInspectionResult> {
  const issues: MLBInnerDevelopmentCampaignLifecycleIssue[] = [];
  const paths = resolveMLBInnerDevelopmentCampaignLifecyclePaths(repositoryRoot);

  let state: MLBInnerDevelopmentCampaignLifecycleState | 'READY' = 'READY';
  let anchorValue: MLBInnerDevelopmentCampaignAnchor | undefined;
  let ledgerValue: MLBInnerDevelopmentCampaignLedger | undefined;

  const buildInspectionResult = (): MLBInnerDevelopmentCampaignInspectionResult => {
    if (state === 'READY') {
      return {
        ok: true,
        state: 'READY',
        anchor: anchorValue as MLBInnerDevelopmentCampaignAnchor,
        ledger: ledgerValue as MLBInnerDevelopmentCampaignLedger,
      };
    }
    return { ok: false, state: state as MLBInnerDevelopmentCampaignLifecycleState, issues: issues as readonly MLBInnerDevelopmentCampaignLifecycleIssue[] };
  };

  try {
    const anchorRead = await readMLBInnerDevelopmentCampaignAnchor(repositoryRoot);
    const ledgerRead = await readMLBInnerDevelopmentCampaignLedger(repositoryRoot);

    if (anchorRead.ok && ledgerRead.ok) {
      const anchor = anchorRead.value;
      const ledger = ledgerRead.value;

      const expectedIdentity = computeMLBInnerDevelopmentCampaignIdentity(ledger.createdAt);
      if (anchor.campaignIdentity !== expectedIdentity) {
        state = 'FAIL_CLOSED_CAMPAIGN_IDENTITY_MISMATCH';
        issues.push({
          code: 'FAIL_CLOSED_CAMPAIGN_IDENTITY_MISMATCH',
          path: paths.anchorPath,
          message: 'Campaign identity mismatch',
        });
        return buildInspectionResult();
      }

      anchorValue = anchor;
      ledgerValue = ledger;
      return buildInspectionResult();
    }

    if (anchorRead.ok) {
      if (!ledgerRead.ok) {
        if (ledgerRead.issues[0]?.code === 'LEDGER_MISSING') {
          state = 'FAIL_CLOSED_ANCHOR_WITHOUT_LEDGER';
          issues.push({
            code: 'FAIL_CLOSED_ANCHOR_WITHOUT_LEDGER',
            path: paths.anchorPath,
            message: 'Anchor exists but ledger is missing',
          });
        } else {
          state = 'FAIL_CLOSED_INVALID_LEDGER';
          issues.push({
            code: 'FAIL_CLOSED_INVALID_LEDGER',
            path: paths.ledgerPath,
            message: ledgerRead.issues.map(i => i.message).join('; '),
          });
        }
      }
      return buildInspectionResult();
    }

    if (ledgerRead.ok) {
      if (anchorRead.issues[0]?.code === 'ANCHOR_MISSING') {
        state = 'FAIL_CLOSED_LEDGER_WITHOUT_ANCHOR';
        issues.push({
          code: 'FAIL_CLOSED_LEDGER_WITHOUT_ANCHOR',
          path: paths.ledgerPath,
          message: 'Ledger exists but anchor is missing',
        });
      } else {
        state = 'FAIL_CLOSED_INVALID_ANCHOR';
        issues.push({
          code: 'FAIL_CLOSED_INVALID_ANCHOR',
          path: paths.anchorPath,
          message: anchorRead.issues.map(i => i.message).join('; '),
        });
      }
      return buildInspectionResult();
    }

    if (anchorRead.issues[0]?.code !== 'ANCHOR_MISSING') {
      state = 'FAIL_CLOSED_INVALID_ANCHOR';
      issues.push({
        code: 'FAIL_CLOSED_INVALID_ANCHOR',
        path: paths.anchorPath,
        message: anchorRead.issues.map(i => i.message).join('; '),
      });
      return buildInspectionResult();
    }

    if (ledgerRead.issues[0]?.code !== 'LEDGER_MISSING') {
      state = 'FAIL_CLOSED_INVALID_LEDGER';
      issues.push({
        code: 'FAIL_CLOSED_INVALID_LEDGER',
        path: paths.ledgerPath,
        message: ledgerRead.issues.map(i => i.message).join('; '),
      });
      return buildInspectionResult();
    }

    state = 'NOT_INITIALIZED';
    return buildInspectionResult();
  } finally {
    // No lock acquisition or release. No filesystem mutation.
  }
}

/* -------------------------------------------------------------------------- */
/*  Resume / state inspection                                                 */
/* -------------------------------------------------------------------------- */

export async function resumeMLBInnerDevelopmentCampaign(
  repositoryRoot: string,
): Promise<MLBInnerDevelopmentCampaignResumeResult> {
  const issues: MLBInnerDevelopmentCampaignLifecycleIssue[] = [];
  const paths = resolveMLBInnerDevelopmentCampaignLifecyclePaths(repositoryRoot);

  const lockResult = await acquireMLBInnerDevelopmentCampaignLock(repositoryRoot);
  if (!lockResult.ok) {
    pushLifecycleIssue(
      issues,
      'FAIL_CLOSED_LOCK_ACQUISITION_FAILED',
      paths.lockPath,
      lockResult.issues.map(i => i.message).join('; '),
    );
    return { ok: false, state: 'FAIL_CLOSED_LOCK_ACQUISITION_FAILED', issues: issues as readonly MLBInnerDevelopmentCampaignLifecycleIssue[] };
  }

  let lockReleased = false;
  let inspectionResult = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(repositoryRoot);
  let state: MLBInnerDevelopmentCampaignLifecycleState | 'READY' = inspectionResult.ok ? 'READY' : inspectionResult.state;
  let anchorValue: MLBInnerDevelopmentCampaignAnchor | undefined = inspectionResult.ok ? inspectionResult.anchor : undefined;
  let ledgerValue: MLBInnerDevelopmentCampaignLedger | undefined = inspectionResult.ok ? inspectionResult.ledger : undefined;

  if (!inspectionResult.ok) {
    issues.push(...inspectionResult.issues);
  }

  const buildResumeResult = (): MLBInnerDevelopmentCampaignResumeResult => {
    if (state === 'READY') {
      return {
        ok: true,
        state: 'READY',
        anchor: anchorValue as MLBInnerDevelopmentCampaignAnchor,
        ledger: ledgerValue as MLBInnerDevelopmentCampaignLedger,
      };
    }
    return { ok: false, state: state as MLBInnerDevelopmentCampaignLifecycleState, issues: issues as readonly MLBInnerDevelopmentCampaignLifecycleIssue[] };
  };

  try {
    return buildResumeResult();
  } finally {
    if (!lockReleased) {
      const releaseResult = await releaseMLBInnerDevelopmentCampaignLock(repositoryRoot, lockResult.ownershipToken);
      if (!releaseResult.ok) {
        issues.push({
          code: 'FAIL_CLOSED_LOCK_RELEASE_FAILED',
          path: paths.lockPath,
          message: releaseResult.issues.map(i => i.message).join('; '),
        });
        if (state === 'READY') {
          state = 'FAIL_CLOSED_LOCK_RELEASE_FAILED';
        }
      }
      lockReleased = true;
    }
  }
}
