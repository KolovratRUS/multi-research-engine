/* -------------------------------------------------------------------------- */
/*  MLB Shadow Monitoring prediction quarantine store (S1_QUARANTINE_WRITE)    */
/* -------------------------------------------------------------------------- */

/**
 * Quarantined persistence for validated blind shadow predictions.
 *
 * Security properties enforced:
 *  - payload is structurally validated before any filesystem touch
 *  - payloadHash is recomputed and compared BEFORE any filesystem mutation
 *  - SHA-256(shadowRecordId) is the sole filename component — raw IDs never
 *    reach a path, defeating slash / backslash / ".." traversal
 *  - every ancestor from repoRoot down to the predictions directory is lstat'd
 *    (not stat'd) to detect symlinks; non-directory ancestors fail closed
 *  - realpath containment is proven after directory creation and re-checked
 *    immediately before finalization
 *  - final artifact is write-once: an existing final file or directory fails
 *    closed; a link EEXIST fails closed with ALREADY_EXISTS
 *  - temp file is created with O_EXCL (wx) and 0600 mode
 *  - finalization uses fs.link (hard link), never rename or replace
 *  - no public prediction reader is exposed
 *
 * Allowed imports only:
 *  node:fs/promises  node:path  node:crypto
 *  ./mlb-shadow-monitoring-quarantine-contract
 *  ./mlb-shadow-monitoring-namespace
 */

import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

import {
  validateMLBShadowQuarantinedPredictionPayload,
  type MLBShadowQuarantinedPredictionPayload,
  type MLBShadowQuarantineValidationIssue,
} from './mlb-shadow-monitoring-quarantine-contract';
import {
  resolveShadowMonitoringQuarantinePredictionsPath,
  isWithinShadowMonitoringRoot,
  MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE,
  type MLBShadowMonitoringNamespacePath,
} from './mlb-shadow-monitoring-namespace';

/* -------------------------------------------------------------------------- */
/*  Store version                                                             */
/* -------------------------------------------------------------------------- */

export const MLB_SHADOW_MONITORING_PREDICTION_STORE_VERSION =
  'mlb-shadow-monitoring-prediction-store-v1' as const;

/* -------------------------------------------------------------------------- */
/*  Result types                                                              */
/* -------------------------------------------------------------------------- */

export type MLBShadowPredictionFailureStatus =
  | 'VALIDATION_FAILED'
  | 'PAYLOAD_HASH_MISMATCH'
  | 'ALREADY_EXISTS'
  | 'SYMLINK_DETECTED'
  | 'NON_DIRECTORY_TARGET'
  | 'REPO_ROOT_INVALID'
  | 'WRITE_ERROR'
  | 'UNKNOWN_ERROR';

export type MLBShadowPredictionPersistenceResult =
  | Readonly<{
      ok: true;
      status: 'PERSISTED' | 'PERSISTED_WITH_CLEANUP_WARNING';
      storeVersion: string;
      artifactCreated: true;
      tempCleanupFailed: boolean;
      shadowRecordId: string;
      gamePk: number;
      relativePath: string;
      verificationOk: true;
      issues: readonly MLBShadowQuarantineValidationIssue[];
    }>
  | Readonly<{
      ok: false;
      status: MLBShadowPredictionFailureStatus;
      storeVersion: string;
      artifactCreated: false;
      shadowRecordId: string | null;
      gamePk: number | null;
      relativePath: string | null;
      verificationOk: null;
      issues: readonly MLBShadowQuarantineValidationIssue[];
    }>
  | Readonly<{
      ok: false;
      status: 'VERIFICATION_FAILED';
      storeVersion: string;
      artifactCreated: true;
      tempCleanupFailed: boolean;
      shadowRecordId: string;
      gamePk: number;
      relativePath: string;
      verificationOk: false;
      issues: readonly MLBShadowQuarantineValidationIssue[];
    }>;

/* -------------------------------------------------------------------------- */
/*  Internal constants + helpers                                              */
/* -------------------------------------------------------------------------- */

const NAMESPACE_SEGMENTS: readonly string[] =
  MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE.split('/');

const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

/**
 * Extracts error.code from an unknown caught value.
 */
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

/**
 * Recomputes the canonical payload hash from the 8 non-hash fields.
 * Must match the algorithm in mlb-shadow-monitoring-prediction-computation.
 */
function computePredictionPayloadHash(
  payload: MLBShadowQuarantinedPredictionPayload,
): string {
  const canonical = JSON.stringify({
    shadowRecordId: payload.shadowRecordId,
    gamePk: payload.gamePk,
    predictedWinner: payload.predictedWinner,
    predictedSide: payload.predictedSide,
    homeWinProbability: payload.homeWinProbability,
    awayWinProbability: payload.awayWinProbability,
    decisionPolicy: payload.decisionPolicy,
    predictionGeneratedAt: payload.predictionGeneratedAt,
  });
  return createHash('sha256').update(canonical, 'utf-8').digest('hex');
}

/**
 * Builds the ancestor chain from repoRoot down to the predictions directory.
 *  [0] = repoRoot
 *  [1] = repoRoot/var
 *  [2] = repoRoot/var/mlb-development
 *  [3] = .../mlb-shadow-monitoring
 *  [4] = .../quarantine
 *  [5] = .../quarantine/predictions
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

type PathKind = 'symlink' | 'directory' | 'file' | 'missing';

/**
 * Lightweight lstat wrapper returning a path-kind discriminant.
 * Avoids importing the Stats type from node:fs.
 */
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

function makeGenericIssue(message: string): MLBShadowQuarantineValidationIssue {
  return {
    code: 'INVALID_JSON_VALUE' as const,
    path: '$.store',
    message,
  };
}

function makeNotPersisted(
  status: MLBShadowPredictionFailureStatus,
  shadowRecordId: string | null,
  gamePk: number | null,
  issues: MLBShadowQuarantineValidationIssue[],
): MLBShadowPredictionPersistenceResult {
  return {
    ok: false as const,
    status,
    storeVersion: MLB_SHADOW_MONITORING_PREDICTION_STORE_VERSION,
    artifactCreated: false as const,
    shadowRecordId,
    gamePk,
    relativePath: null,
    verificationOk: null,
    issues: Object.freeze(issues),
  };
}

/* -------------------------------------------------------------------------- */
/*  Ancestor safety walk                                                       */
/* -------------------------------------------------------------------------- */

type AncestorStatus =
  | 'REPO_ROOT_INVALID'
  | 'SYMLINK_DETECTED'
  | 'NON_DIRECTORY_TARGET';

type AncestorAudit =
  | { ok: true }
  | { ok: false; status: AncestorStatus; issues: MLBShadowQuarantineValidationIssue[] };

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
        issues: [makeGenericIssue('ancestor index out of range')],
      };
    }
    let kind: PathKind;
    try {
      kind = await classifyPath(ancestor);
    } catch {
      return {
        ok: false,
        status: 'REPO_ROOT_INVALID',
        issues: [makeGenericIssue('filesystem error during ancestor audit')],
      };
    }
    if (kind === 'missing') {
      if (i === 0) {
        return {
          ok: false,
          status: 'REPO_ROOT_INVALID',
          issues: [makeGenericIssue('repository root does not exist')],
        };
      }
      continue;
    }
    if (kind === 'symlink') {
      return {
        ok: false,
        status: 'SYMLINK_DETECTED',
        issues: [makeGenericIssue('symlink detected in ancestor path')],
      };
    }
    if (kind !== 'directory') {
      return {
        ok: false,
        status: 'NON_DIRECTORY_TARGET',
        issues: [makeGenericIssue('non-directory ancestor detected in quarantine path')],
      };
    }
  }
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Persists a validated, quarantined shadow prediction to the filesystem
 * under <repoRoot>/var/mlb-development/mlb-shadow-monitoring/quarantine/predictions/
 *
 * The filename is SHA-256(shadowRecordId) + ".json". No prediction values,
 * probabilities, decisionPolicy, payloadHash, or model fingerprint appear in
 * the path.
 *
 * Fails closed on every error condition. Never overwrites an existing artifact.
 *
 * @param repoRoot  Absolute repository root (e.g. process.cwd()). Must exist.
 * @param payload   Unknown — will be structurally validated before any FS action.
 * @returns Non-sensitive persistence result.
 */
export async function persistMLBShadowQuarantinedPrediction(
  repoRoot: string,
  payload: unknown,
): Promise<MLBShadowPredictionPersistenceResult> {
  /* -- Step 1: structural validation (fail-closed, zero FS mutation) ------- */
  const validation = validateMLBShadowQuarantinedPredictionPayload(payload);
  if (!validation.ok) {
    return makeNotPersisted('VALIDATION_FAILED', null, null, [...validation.issues]);
  }
  const validated: MLBShadowQuarantinedPredictionPayload = validation.value;

  /* -- Step 2: recompute payloadHash BEFORE any FS mutation (fail-closed) -- */
  const recomputedHash = computePredictionPayloadHash(validated);
  if (recomputedHash !== validated.payloadHash) {
    return makeNotPersisted(
      'PAYLOAD_HASH_MISMATCH',
      validated.shadowRecordId,
      validated.gamePk,
      [
        {
          code: 'INVALID_HASH' as const,
          path: '$.payloadHash',
          message: 'payloadHash does not match recomputed value',
        },
      ],
    );
  }

  /* -- Step 3: resolve namespace path -------------------------------------- */
  let namespacePath: MLBShadowMonitoringNamespacePath;
  try {
    namespacePath = resolveShadowMonitoringQuarantinePredictionsPath(repoRoot);
  } catch {
    return makeNotPersisted(
      'REPO_ROOT_INVALID',
      validated.shadowRecordId,
      validated.gamePk,
      [makeGenericIssue('repository root is invalid or path resolution failed')],
    );
  }

  const predictionsDir = namespacePath.resolved;
  const resolvedRepoRoot = namespacePath.repositoryRoot;
  const artifactFilename =
    createHash('sha256').update(validated.shadowRecordId, 'utf-8').digest('hex') +
    '.json';
  const finalPath = path.join(predictionsDir, artifactFilename);
  const relativePath = path.join(
    MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE,
    artifactFilename,
  );

  /* -- Step 4: ancestor symlink defense (first pass — before creating) ---- */
  const ancestors = buildAncestorChain(resolvedRepoRoot);
  const firstAudit = await auditAncestors(ancestors);
  if (!firstAudit.ok) {
    return makeNotPersisted(
      firstAudit.status,
      validated.shadowRecordId,
      validated.gamePk,
      firstAudit.issues,
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
          validated.gamePk,
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
      validated.gamePk,
      secondAudit.issues,
    );
  }

  /* -- Step 6: realpath containment (defense-in-depth) -------------------- */
  let realRepoRoot: string;
  let realPredictionsDir: string;
  try {
    realRepoRoot = await fs.realpath(resolvedRepoRoot);
    realPredictionsDir = await fs.realpath(predictionsDir);
  } catch {
    return makeNotPersisted(
      'WRITE_ERROR',
      validated.shadowRecordId,
      validated.gamePk,
      [makeGenericIssue('realpath resolution failed for quarantine path')],
    );
  }

  const expectedPredictionsDir = path.resolve(
    realRepoRoot,
    MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE,
  );
  if (realPredictionsDir !== expectedPredictionsDir) {
    return makeNotPersisted(
      'SYMLINK_DETECTED',
      validated.shadowRecordId,
      validated.gamePk,
      [
        makeGenericIssue(
          'realpath of predictions directory diverged from expected descendant',
        ),
      ],
    );
  }
  if (!isWithinShadowMonitoringRoot(realPredictionsDir, realRepoRoot)) {
    return makeNotPersisted(
      'SYMLINK_DETECTED',
      validated.shadowRecordId,
      validated.gamePk,
      [
        makeGenericIssue(
          'realpath of predictions directory escaped the shadow namespace',
        ),
      ],
    );
  }

  /* -- Step 7: check existing final target (write-once policy) ----------- */
  const finalKind = await classifyPath(finalPath);
  if (finalKind === 'symlink') {
    return makeNotPersisted(
      'SYMLINK_DETECTED',
      validated.shadowRecordId,
      validated.gamePk,
      [makeGenericIssue('symlink detected at final artifact target')],
    );
  }
  if (finalKind === 'directory') {
    return makeNotPersisted(
      'NON_DIRECTORY_TARGET',
      validated.shadowRecordId,
      validated.gamePk,
      [makeGenericIssue('directory exists at final artifact target')],
    );
  }
  if (finalKind === 'file') {
    return makeNotPersisted(
      'ALREADY_EXISTS',
      validated.shadowRecordId,
      validated.gamePk,
      [makeGenericIssue('artifact already exists at target path')],
    );
  }

  /* -- Step 7b: repeat ancestor safety check immediately before finalization */
  const preFinalizeAudit = await auditAncestors(ancestors);
  if (!preFinalizeAudit.ok) {
    return makeNotPersisted(
      preFinalizeAudit.status,
      validated.shadowRecordId,
      validated.gamePk,
      preFinalizeAudit.issues,
    );
  }

  /* -- Step 8: canonical persisted bytes (exact 9-field order via JSON) --- */
  const canonicalBytes = JSON.stringify({
    shadowRecordId: validated.shadowRecordId,
    gamePk: validated.gamePk,
    predictedWinner: validated.predictedWinner,
    predictedSide: validated.predictedSide,
    homeWinProbability: validated.homeWinProbability,
    awayWinProbability: validated.awayWinProbability,
    decisionPolicy: validated.decisionPolicy,
    predictionGeneratedAt: validated.predictionGeneratedAt,
    payloadHash: validated.payloadHash,
  });

  /* -- Step 9: atomic temp write (O_EXCL via 'wx', restrictive mode 0600) - */
  const tempName = artifactFilename + '.tmp-' + randomUUID();
  const tempPath = path.join(predictionsDir, tempName);

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
      validated.gamePk,
      [makeGenericIssue('failed to write temporary artifact')],
    );
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

  // Clean up temp regardless of link outcome
  let tempCleanupFailed = false;
  try {
    await fs.unlink(tempPath);
  } catch {
    tempCleanupFailed = true;
  }

  if (!artifactCreated) {
    const code = extractErrorCode(linkError);
    if (code === 'EEXIST') {
      return makeNotPersisted(
        'ALREADY_EXISTS',
        validated.shadowRecordId,
        validated.gamePk,
        [makeGenericIssue('artifact already exists at target path')],
      );
    }
    return makeNotPersisted(
      'WRITE_ERROR',
      validated.shadowRecordId,
      validated.gamePk,
      [makeGenericIssue('failed to finalize artifact via hard link')],
    );
  }

  /* -- Step 11: fsync containing directory (best-effort) ----------------- */
  try {
    const dirHandle = await fs.open(predictionsDir, 'r');
    try {
      await dirHandle.sync();
    } finally {
      await dirHandle.close();
    }
  } catch {
    /* best-effort directory fsync */
  }

  /* -- Step 12: best-effort temp cleanup (already attempted above) ------- */
  // tempCleanupFailed is set above; carry it through to the result.

  /* -- Step 13: internal read-back verification --------------------------- */
  let readBack: string;
  try {
    readBack = await fs.readFile(finalPath, 'utf-8');
  } catch {
    return {
      ok: false as const,
      status: 'VERIFICATION_FAILED' as const,
      storeVersion: MLB_SHADOW_MONITORING_PREDICTION_STORE_VERSION,
      artifactCreated: true as const,
      tempCleanupFailed,
      shadowRecordId: validated.shadowRecordId,
      gamePk: validated.gamePk,
      relativePath,
      verificationOk: false as const,
      issues: [
        makeGenericIssue('failed to read-back artifact for verification'),
      ],
    };
  }

  if (readBack !== canonicalBytes) {
    return {
      ok: false as const,
      status: 'VERIFICATION_FAILED' as const,
      storeVersion: MLB_SHADOW_MONITORING_PREDICTION_STORE_VERSION,
      artifactCreated: true as const,
      tempCleanupFailed,
      shadowRecordId: validated.shadowRecordId,
      gamePk: validated.gamePk,
      relativePath,
      verificationOk: false as const,
      issues: [
        makeGenericIssue('read-back bytes do not match expected canonical bytes'),
      ],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readBack);
  } catch {
    return {
      ok: false as const,
      status: 'VERIFICATION_FAILED' as const,
      storeVersion: MLB_SHADOW_MONITORING_PREDICTION_STORE_VERSION,
      artifactCreated: true as const,
      tempCleanupFailed,
      shadowRecordId: validated.shadowRecordId,
      gamePk: validated.gamePk,
      relativePath,
      verificationOk: false as const,
      issues: [
        makeGenericIssue('read-back artifact is not valid JSON'),
      ],
    };
  }

  const revalidation = validateMLBShadowQuarantinedPredictionPayload(parsed);
  if (!revalidation.ok || revalidation.value.payloadHash !== recomputedHash) {
    return {
      ok: false as const,
      status: 'VERIFICATION_FAILED' as const,
      storeVersion: MLB_SHADOW_MONITORING_PREDICTION_STORE_VERSION,
      artifactCreated: true as const,
      tempCleanupFailed,
      shadowRecordId: validated.shadowRecordId,
      gamePk: validated.gamePk,
      relativePath,
      verificationOk: false as const,
      issues: [
        makeGenericIssue('read-back payload failed validation'),
      ],
    };
  }

  /* -- Success ----------------------------------------------------------- */
  return {
    ok: true as const,
    status: tempCleanupFailed ? 'PERSISTED_WITH_CLEANUP_WARNING' : 'PERSISTED',
    storeVersion: MLB_SHADOW_MONITORING_PREDICTION_STORE_VERSION,
    artifactCreated: true as const,
    tempCleanupFailed,
    shadowRecordId: validated.shadowRecordId,
    gamePk: validated.gamePk,
    relativePath,
    verificationOk: true as const,
    issues: Object.freeze([]),
  };
}
