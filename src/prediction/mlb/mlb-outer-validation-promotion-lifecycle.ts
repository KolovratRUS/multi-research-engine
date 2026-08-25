import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  MLB_OUTER_VALIDATION_PROMOTION_DIRECTORY,
  MLB_OUTER_VALIDATION_PROMOTION_FILENAME,
  MLB_OUTER_VALIDATION_PROMOTION_MAX_ATTEMPTS,
  MLB_OUTER_VALIDATION_PROMOTION_MAX_CANDIDATES,
  MLB_OUTER_VALIDATION_PROMOTION_ATTEMPT_NUMBER,
  MLB_OUTER_VALIDATION_PROMOTION_EVALUATION_ID,
  MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_RECIPE_ID,
  MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_FINGERPRINT,
  MLB_OUTER_VALIDATION_PROMOTION_INNER_CAMPAIGN_ID,
  MLB_OUTER_VALIDATION_PROMOTION_INNER_ATTEMPT_NUMBER,
  MLB_OUTER_VALIDATION_PROMOTION_INNER_TERMINAL_STATUS,
  MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID,
  MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256,
  MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID,
  MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID,
  MLB_OUTER_VALIDATION_PROMOTION_PREPROCESSING_POLICY_ID,
  MLB_OUTER_VALIDATION_PROMOTION_FEATURE_POLICY_ID,
  MLB_OUTER_VALIDATION_PROMOTION_MODEL_FAMILY_ID,
  MLB_OUTER_VALIDATION_PROMOTION_REGULARIZATION_CONFIG,
  MLB_OUTER_VALIDATION_PROMOTION_OPTIMIZER_CONFIG,
  MLB_OUTER_VALIDATION_PROMOTION_OTHER_MODEL_AFFECTING_CHOICES,
  MLB_OUTER_VALIDATION_PROMOTION_COMPLEXITY_RANK,
  MLB_OUTER_VALIDATION_PROMOTION_ROW_COUNT_METADATA,
  MLB_OUTER_VALIDATION_PROMOTION_DATE_METADATA,
  MLBOuterValidationPromotionLedger,
  MLBOuterValidationPromotionPrepared,
  MLBOuterValidationPromotionPreValidationFailed,
  MLBOuterValidationPromotionTrainModelReady,
  MLBOuterValidationPromotionRunningConsumed,
  MLBOuterValidationPromotionEligibleForTest,
  MLBOuterValidationPromotionRejectBeforeTest,
  validateMLBOuterValidationPromotionLedger,
} from './mlb-outer-validation-promotion-contract';
import {
  resolveMLBOuterValidationPromotionStorePaths,
  readMLBOuterValidationPromotionLedger,
  writeMLBOuterValidationPromotionLedger,
  acquireMLBOuterValidationPromotionLock,
  releaseMLBOuterValidationPromotionLock,
} from './mlb-outer-validation-promotion-store';

/* -------------------------------------------------------------------------- */
/*  Lifecycle state model                                                     */
/* -------------------------------------------------------------------------- */

export type MLBOuterValidationPromotionLifecycleState =
  | 'PREPARED'
  | 'PRE_VALIDATION_FAILED'
  | 'TRAIN_MODEL_READY'
  | 'RUNNING_CONSUMED'
  | 'ELIGIBLE_FOR_TEST'
  | 'REJECT_BEFORE_TEST'
  | 'GENESIS_FAILED'
  | 'TRANSITION_FAILED';

export type MLBOuterValidationPromotionLifecycleIssue = Readonly<{
  code: MLBOuterValidationPromotionLifecycleState;
  path: string;
  message: string;
}>;

/* -------------------------------------------------------------------------- */
/*  Inputs/result types                                                       */
/* -------------------------------------------------------------------------- */

export type MLBOuterValidationPromotionGenesisInput = Readonly<{
  authorization: 'EXPLICIT_ONE_TIME_GENESIS';
  genesisTimestamp: string;
}>;

export type MLBOuterValidationPromotionGenesisResult =
  | Readonly<{ ok: true; ledger: MLBOuterValidationPromotionPrepared }>
  | Readonly<{
      ok: false;
      state: MLBOuterValidationPromotionLifecycleState;
      issues: readonly MLBOuterValidationPromotionLifecycleIssue[];
    }>;

export type MLBOuterValidationPromotionTrainModelReadyResult =
  | Readonly<{ ok: true; ledger: MLBOuterValidationPromotionTrainModelReady }>
  | Readonly<{
      ok: false;
      state: MLBOuterValidationPromotionLifecycleState;
      issues: readonly MLBOuterValidationPromotionLifecycleIssue[];
    }>;

export type MLBOuterValidationPromotionConsumeHoldoutResult =
  | Readonly<{ ok: true; ledger: MLBOuterValidationPromotionRunningConsumed }>
  | Readonly<{
      ok: false;
      state: MLBOuterValidationPromotionLifecycleState;
      issues: readonly MLBOuterValidationPromotionLifecycleIssue[];
    }>;

export type MLBOuterValidationPromotionEligibleForTestResult =
  | Readonly<{ ok: true; ledger: MLBOuterValidationPromotionEligibleForTest }>
  | Readonly<{
      ok: false;
      state: MLBOuterValidationPromotionLifecycleState;
      issues: readonly MLBOuterValidationPromotionLifecycleIssue[];
    }>;

export type MLBOuterValidationPromotionRejectBeforeTestResult =
  | Readonly<{ ok: true; ledger: MLBOuterValidationPromotionRejectBeforeTest }>
  | Readonly<{
      ok: false;
      state: MLBOuterValidationPromotionLifecycleState;
      issues: readonly MLBOuterValidationPromotionLifecycleIssue[];
    }>;

/* -------------------------------------------------------------------------- */
/*  Path resolution                                                           */
/* -------------------------------------------------------------------------- */

type MLBOuterValidationPromotionLifecyclePaths = Readonly<{
  repositoryRoot: string;
  ledgerDirectory: string;
  ledgerPath: string;
  tempLedgerPath: string;
  lockPath: string;
  anchorPath: string;
}>;

function resolveMLBOuterValidationPromotionLifecyclePaths(
  repositoryRoot: string,
): MLBOuterValidationPromotionLifecyclePaths {
  const storePaths = resolveMLBOuterValidationPromotionStorePaths(repositoryRoot);
  return {
    repositoryRoot: storePaths.repositoryRoot,
    ledgerDirectory: storePaths.ledgerDirectory,
    ledgerPath: storePaths.ledgerPath,
    tempLedgerPath: storePaths.tempLedgerPath,
    lockPath: storePaths.lockPath,
    anchorPath: path.join(storePaths.repositoryRoot, 'var/mlb-development/mlb-outer-validation-promotion-ledger/.reset-anchor'),
  };
}

/* -------------------------------------------------------------------------- */
/*  Reset prevention                                                          */
/* -------------------------------------------------------------------------- */

async function readOuterPromotionAnchor(
  paths: MLBOuterValidationPromotionLifecyclePaths,
): Promise<MLBOuterValidationPromotionLifecycleIssue[]> {
  const issues: MLBOuterValidationPromotionLifecycleIssue[] = [];
  try {
    await fs.access(paths.anchorPath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    pushLifecycleIssue(issues, 'GENESIS_FAILED', paths.anchorPath, `Outer-validation reset anchor missing: ${err.message ?? 'ENOENT'}`);
  }
  return issues;
}

async function writeOuterPromotionAnchor(
  paths: MLBOuterValidationPromotionLifecyclePaths,
): Promise<MLBOuterValidationPromotionLifecycleIssue[]> {
  const issues: MLBOuterValidationPromotionLifecycleIssue[] = [];
  try {
    const fd = await fs.open(paths.anchorPath, 'wx');
    await fd.writeFile('{"contractVersion":"mlb-outer-validation-promotion-anchor-v1"}', 'utf-8');
    await fd.sync();
    await fd.close();
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'EEXIST') {
      pushLifecycleIssue(issues, 'GENESIS_FAILED', paths.anchorPath, 'Reset anchor already exists');
    } else {
      pushLifecycleIssue(issues, 'GENESIS_FAILED', paths.anchorPath, `Failed to write reset anchor: ${err.message ?? 'Unknown IO error'}`);
    }
  }
  return issues;
}

/* -------------------------------------------------------------------------- */
/*  Genesis                                                                   */
/* -------------------------------------------------------------------------- */

export async function performMLBOuterValidationPromotionGenesis(
  repositoryRoot: string,
  input: MLBOuterValidationPromotionGenesisInput,
): Promise<MLBOuterValidationPromotionGenesisResult> {
  const paths = resolveMLBOuterValidationPromotionLifecyclePaths(repositoryRoot);
  const issues: MLBOuterValidationPromotionLifecycleIssue[] = [];

  if (input.authorization !== 'EXPLICIT_ONE_TIME_GENESIS') {
    pushLifecycleIssue(issues, 'GENESIS_FAILED', '$.authorization', 'authorization must be EXPLICIT_ONE_TIME_GENESIS');
    return { ok: false, state: 'GENESIS_FAILED', issues };
  }

  if (!input.genesisTimestamp || typeof input.genesisTimestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(input.genesisTimestamp)) {
    pushLifecycleIssue(issues, 'GENESIS_FAILED', '$.genesisTimestamp', 'genesisTimestamp must be ISO-8601');
    return { ok: false, state: 'GENESIS_FAILED', issues };
  }

  const lockResult = await acquireMLBOuterValidationPromotionLock(repositoryRoot);
  if (!lockResult.ok) {
    const mapped = lockResult.issues.map((issue): MLBOuterValidationPromotionLifecycleIssue => ({
      code: 'GENESIS_FAILED',
      path: issue.path,
      message: issue.message,
    }));
    return { ok: false, state: 'GENESIS_FAILED', issues: mapped };
  }

  const ownershipToken = lockResult.ownershipToken;

  try {
    const anchorRead = await readOuterPromotionAnchor(paths);
    if (anchorRead.length > 0) {
      const ledgerRead = await readMLBOuterValidationPromotionLedger(repositoryRoot);
      if (ledgerRead.ok) {
        pushLifecycleIssue(issues, 'GENESIS_FAILED', '$.ledger', 'Ledger exists but anchor is missing');
        return { ok: false, state: 'GENESIS_FAILED', issues };
      }
      if (ledgerRead.issues[0]?.code !== 'LEDGER_MISSING') {
        const mapped = ledgerRead.issues.map((issue): MLBOuterValidationPromotionLifecycleIssue => ({
          code: 'GENESIS_FAILED',
          path: issue.path,
          message: issue.message,
        }));
        return { ok: false, state: 'GENESIS_FAILED', issues: mapped };
      }
    } else {
      const ledgerRead = await readMLBOuterValidationPromotionLedger(repositoryRoot);
      if (ledgerRead.ok) {
        pushLifecycleIssue(issues, 'GENESIS_FAILED', '$.ledger', 'Outer-validation ledger already exists');
        return { ok: false, state: 'GENESIS_FAILED', issues };
      }
      if (ledgerRead.issues[0]?.code !== 'LEDGER_MISSING') {
        const mapped = ledgerRead.issues.map((issue): MLBOuterValidationPromotionLifecycleIssue => ({
          code: 'GENESIS_FAILED',
          path: issue.path,
          message: issue.message,
        }));
        return { ok: false, state: 'GENESIS_FAILED', issues: mapped };
      }
      pushLifecycleIssue(issues, 'GENESIS_FAILED', paths.anchorPath, 'Reset anchor already exists');
      return { ok: false, state: 'GENESIS_FAILED', issues };
    }

    const anchorWriteResult = await writeOuterPromotionAnchor(paths);
    if (anchorWriteResult.length > 0) {
      return { ok: false, state: 'GENESIS_FAILED', issues: anchorWriteResult };
    }

    const genesis: MLBOuterValidationPromotionPrepared = {
      contractVersion: 'mlb-outer-validation-promotion-ledger-v1',
      promotionEvaluationId: MLB_OUTER_VALIDATION_PROMOTION_EVALUATION_ID,
      attemptNumber: MLB_OUTER_VALIDATION_PROMOTION_ATTEMPT_NUMBER,
      maxAttempts: MLB_OUTER_VALIDATION_PROMOTION_MAX_ATTEMPTS,
      maxCandidates: MLB_OUTER_VALIDATION_PROMOTION_MAX_CANDIDATES,
      candidateRecipeId: MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_RECIPE_ID,
      candidateFingerprint: MLB_OUTER_VALIDATION_PROMOTION_CANDIDATE_FINGERPRINT,
      innerCampaignId: MLB_OUTER_VALIDATION_PROMOTION_INNER_CAMPAIGN_ID,
      innerAttemptNumber: MLB_OUTER_VALIDATION_PROMOTION_INNER_ATTEMPT_NUMBER,
      innerTerminalStatus: MLB_OUTER_VALIDATION_PROMOTION_INNER_TERMINAL_STATUS,
      pretestGatePolicyId: 'FROZEN_PRETEST_GATE_POLICY_V1',
      datasetId: MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID,
      datasetSha256: MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256,
      matrixId: MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID,
      manifestId: MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID,
      preprocessingPolicyId: MLB_OUTER_VALIDATION_PROMOTION_PREPROCESSING_POLICY_ID,
      featurePolicyId: MLB_OUTER_VALIDATION_PROMOTION_FEATURE_POLICY_ID,
      modelFamilyId: MLB_OUTER_VALIDATION_PROMOTION_MODEL_FAMILY_ID,
      regularizationConfig: MLB_OUTER_VALIDATION_PROMOTION_REGULARIZATION_CONFIG,
      optimizerConfig: MLB_OUTER_VALIDATION_PROMOTION_OPTIMIZER_CONFIG,
      otherModelAffectingChoices: MLB_OUTER_VALIDATION_PROMOTION_OTHER_MODEL_AFFECTING_CHOICES,
      complexityRank: MLB_OUTER_VALIDATION_PROMOTION_COMPLEXITY_RANK,
      rowCountMetadata: MLB_OUTER_VALIDATION_PROMOTION_ROW_COUNT_METADATA,
      dateMetadata: MLB_OUTER_VALIDATION_PROMOTION_DATE_METADATA,
      status: 'PREPARED',
      outerValidationConsumed: false,
      modelPersisted: false,
      trainModelReady: false,
      preHoldoutFailure: null,
      holdoutConsumedAt: null,
      validationMetrics: null,
      referenceFacts: null,
      gateResult: null,
      terminalStatus: null,
      testAuthorized: false,
      testExecuted: false,
    };

    const validation = validateMLBOuterValidationPromotionLedger(genesis);
    if (!validation.ok) {
      const mapped = validation.issues.map((issue): MLBOuterValidationPromotionLifecycleIssue => ({
        code: 'GENESIS_FAILED',
        path: issue.path,
        message: issue.message,
      }));
      return { ok: false, state: 'GENESIS_FAILED', issues: mapped };
    }

    const writeResult = await writeMLBOuterValidationPromotionLedger(repositoryRoot, validation.value);
    if (!writeResult.ok) {
      const mapped = writeResult.issues.map((issue): MLBOuterValidationPromotionLifecycleIssue => ({
        code: 'GENESIS_FAILED',
        path: issue.path,
        message: issue.message,
      }));
      return { ok: false, state: 'GENESIS_FAILED', issues: mapped };
    }

    return { ok: true, ledger: validation.value as MLBOuterValidationPromotionPrepared };
  } finally {
    await releaseMLBOuterValidationPromotionLock(repositoryRoot, ownershipToken);
  }
}

/* -------------------------------------------------------------------------- */
/*  Transition helpers                                                        */
/* -------------------------------------------------------------------------- */

function assertSourceStatus(
  source: MLBOuterValidationPromotionLedger,
  expected: MLBOuterValidationPromotionLedger['status'],
): void {
  if (source.status !== expected) {
    throw new Error(`Expected source status ${expected}, got ${source.status}`);
  }
}

function pushLifecycleIssue(
  issues: MLBOuterValidationPromotionLifecycleIssue[],
  code: MLBOuterValidationPromotionLifecycleIssue['code'],
  path: string,
  message: string,
): void {
  const exists = issues.some((item) => item.path === path && item.code === code);
  if (!exists) {
    issues.push({ code, path, message });
  }
}

/* -------------------------------------------------------------------------- */
/*  Status+output-generic durable mutation helper                             */
/* -------------------------------------------------------------------------- */

type MLBOuterValidationPromotionStatus = MLBOuterValidationPromotionLedger['status'];

type MLBOuterValidationPromotionLedgerForStatus<
  TStatus extends MLBOuterValidationPromotionStatus,
> = Extract<MLBOuterValidationPromotionLedger, { status: TStatus }>;

type MLBOuterValidationPromotionMutationFailure = Readonly<{
  ok: false;
  state: MLBOuterValidationPromotionLifecycleState;
  issues: readonly MLBOuterValidationPromotionLifecycleIssue[];
}>;

async function mutateLedger<
  TStatus extends MLBOuterValidationPromotionStatus,
  TNext extends MLBOuterValidationPromotionLedger,
>(
  repositoryRoot: string,
  expectedStatus: TStatus,
  mutator: (
    current: MLBOuterValidationPromotionLedgerForStatus<TStatus>,
  ) => TNext,
): Promise<
  | { ok: true; ledger: TNext }
  | MLBOuterValidationPromotionMutationFailure
> {
  const lockResult = await acquireMLBOuterValidationPromotionLock(repositoryRoot);
  if (!lockResult.ok) {
    const mapped = lockResult.issues.map((issue): MLBOuterValidationPromotionLifecycleIssue => ({
      code: 'TRANSITION_FAILED',
      path: issue.path,
      message: issue.message,
    }));
    return { ok: false, state: 'TRANSITION_FAILED', issues: mapped };
  }

  const ownershipToken = lockResult.ownershipToken;

  try {
    const reread = await readMLBOuterValidationPromotionLedger(repositoryRoot);
    if (!reread.ok) {
      const mapped = reread.issues.map((issue): MLBOuterValidationPromotionLifecycleIssue => ({
        code: 'TRANSITION_FAILED',
        path: issue.path,
        message: issue.message,
      }));
      return { ok: false, state: 'TRANSITION_FAILED', issues: mapped };
    }

    if (reread.value.status !== expectedStatus) {
      return {
        ok: false,
        state: 'TRANSITION_FAILED',
        issues: [
          {
            code: 'TRANSITION_FAILED',
            path: '$.status',
            message: `Expected source status ${expectedStatus}, got ${reread.value.status}`,
          },
        ],
      };
    }

    const current = reread.value as MLBOuterValidationPromotionLedgerForStatus<TStatus>;
    const proposed = mutator(current);

    const validation = validateMLBOuterValidationPromotionLedger(proposed);
    if (!validation.ok) {
      const mapped = validation.issues.map((issue): MLBOuterValidationPromotionLifecycleIssue => ({
        code: 'TRANSITION_FAILED',
        path: issue.path,
        message: issue.message,
      }));
      return { ok: false, state: 'TRANSITION_FAILED', issues: mapped };
    }

    const writeResult = await writeMLBOuterValidationPromotionLedger(repositoryRoot, validation.value);
    if (!writeResult.ok) {
      const mapped = writeResult.issues.map((issue): MLBOuterValidationPromotionLifecycleIssue => ({
        code: 'TRANSITION_FAILED',
        path: issue.path,
        message: issue.message,
      }));
      return { ok: false, state: 'TRANSITION_FAILED', issues: mapped };
    }

    return { ok: true, ledger: validation.value as TNext };
  } finally {
    await releaseMLBOuterValidationPromotionLock(repositoryRoot, ownershipToken);
  }
}

/* -------------------------------------------------------------------------- */
/*  Transition: PREPARED -> TRAIN_MODEL_READY                                  */
/* -------------------------------------------------------------------------- */

export async function transitionMLBOuterValidationPromotionToTrainModelReady(
  repositoryRoot: string,
  fittedModel: MLBOuterValidationPromotionTrainModelReady['fittedModel'],
): Promise<MLBOuterValidationPromotionTrainModelReadyResult> {
  const result = await mutateLedger(
    repositoryRoot,
    'PREPARED',
    (prepared): MLBOuterValidationPromotionTrainModelReady => ({
      ...prepared,
      status: 'TRAIN_MODEL_READY',
      modelPersisted: true,
      trainModelReady: true,
      fittedModel,
      trainingRowCount: 301,
      converged: true,
    }),
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, ledger: result.ledger };
}

/* -------------------------------------------------------------------------- */
/*  Transition: PREPARED -> PRE_VALIDATION_FAILED                             */
/* -------------------------------------------------------------------------- */

export async function transitionMLBOuterValidationPromotionToPreValidationFailed(
  repositoryRoot: string,
  failureKind: MLBOuterValidationPromotionPreValidationFailed['preHoldoutFailure']['failureKind'],
  message: string,
): Promise<
  | { ok: true; ledger: MLBOuterValidationPromotionPreValidationFailed }
  | MLBOuterValidationPromotionMutationFailure
> {
  const occurredAt = new Date().toISOString();
  const preHoldoutFailure = Object.freeze({
    failureKind,
    message,
    occurredAt,
  });

  const result = await mutateLedger(
    repositoryRoot,
    'PREPARED',
    (prepared): MLBOuterValidationPromotionPreValidationFailed => ({
      ...prepared,
      status: 'PRE_VALIDATION_FAILED',
      modelPersisted: false,
      trainModelReady: false,
      preHoldoutFailure,
    }),
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, ledger: result.ledger };
}

/* -------------------------------------------------------------------------- */
/*  Transition: TRAIN_MODEL_READY -> RUNNING_CONSUMED                          */
/* -------------------------------------------------------------------------- */

export async function transitionMLBOuterValidationPromotionToRunningConsumed(
  repositoryRoot: string,
  holdoutConsumedAt: string,
): Promise<MLBOuterValidationPromotionConsumeHoldoutResult> {
  if (!holdoutConsumedAt || typeof holdoutConsumedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(holdoutConsumedAt)) {
    return { ok: false, state: 'TRANSITION_FAILED', issues: [{ code: 'TRANSITION_FAILED', path: '$.holdoutConsumedAt', message: 'holdoutConsumedAt must be ISO-8601' }] };
  }

  const result = await mutateLedger(
    repositoryRoot,
    'TRAIN_MODEL_READY',
    (ready): MLBOuterValidationPromotionRunningConsumed => ({
      ...ready,
      status: 'RUNNING_CONSUMED',
      outerValidationConsumed: true,
      holdoutConsumedAt,
    }),
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, ledger: result.ledger };
}

/* -------------------------------------------------------------------------- */
/*  Transition: RUNNING_CONSUMED -> ELIGIBLE_FOR_TEST / REJECT_BEFORE_TEST      */
/* -------------------------------------------------------------------------- */

export async function transitionMLBOuterValidationPromotionToEligibleForTest(
  repositoryRoot: string,
  validationMetrics: MLBOuterValidationPromotionEligibleForTest['validationMetrics'],
  referenceFacts: MLBOuterValidationPromotionEligibleForTest['referenceFacts'],
  gateResult: MLBOuterValidationPromotionEligibleForTest['gateResult'],
): Promise<MLBOuterValidationPromotionEligibleForTestResult> {
  const result = await mutateLedger(
    repositoryRoot,
    'RUNNING_CONSUMED',
    (running): MLBOuterValidationPromotionEligibleForTest => ({
      ...running,
      status: 'ELIGIBLE_FOR_TEST',
      validationMetrics,
      referenceFacts,
      gateResult,
      terminalStatus: 'ELIGIBLE_FOR_TEST',
    }),
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, ledger: result.ledger };
}

export async function transitionMLBOuterValidationPromotionToRejectBeforeTest(
  repositoryRoot: string,
  validationMetrics: MLBOuterValidationPromotionRejectBeforeTest['validationMetrics'],
  referenceFacts: MLBOuterValidationPromotionRejectBeforeTest['referenceFacts'],
  gateResult: MLBOuterValidationPromotionRejectBeforeTest['gateResult'],
): Promise<MLBOuterValidationPromotionRejectBeforeTestResult> {
  const result = await mutateLedger(
    repositoryRoot,
    'RUNNING_CONSUMED',
    (running): MLBOuterValidationPromotionRejectBeforeTest => ({
      ...running,
      status: 'REJECT_BEFORE_TEST',
      validationMetrics,
      referenceFacts,
      gateResult,
      terminalStatus: 'REJECT_BEFORE_TEST',
    }),
  );

  if (!result.ok) {
    return result;
  }

  return { ok: true, ledger: result.ledger };
}

/* -------------------------------------------------------------------------- */
/*  Inspection helpers                                                        */
/* -------------------------------------------------------------------------- */

export type MLBOuterValidationPromotionInspectionResult =
  | Readonly<{
      ok: true;
      state: MLBOuterValidationPromotionLifecycleState;
      ledger: MLBOuterValidationPromotionLedger;
    }>
  | Readonly<{
      ok: false;
      state: MLBOuterValidationPromotionLifecycleState;
      issues: readonly MLBOuterValidationPromotionLifecycleIssue[];
    }>;

export async function inspectMLBOuterValidationPromotionLedger(
  repositoryRoot: string,
): Promise<MLBOuterValidationPromotionInspectionResult> {
  const paths = resolveMLBOuterValidationPromotionLifecyclePaths(repositoryRoot);
  const issues: MLBOuterValidationPromotionLifecycleIssue[] = [];

  const anchorIssues = await readOuterPromotionAnchor(paths);
  if (anchorIssues.length > 0) {
    return { ok: false, state: 'GENESIS_FAILED', issues: anchorIssues };
  }

  const readResult = await readMLBOuterValidationPromotionLedger(repositoryRoot);
  if (!readResult.ok) {
    const mapped = readResult.issues.map((issue): MLBOuterValidationPromotionLifecycleIssue => ({
      code: 'TRANSITION_FAILED',
      path: issue.path,
      message: issue.message,
    }));
    return { ok: false, state: 'TRANSITION_FAILED', issues: mapped };
  }

  const ledger = readResult.value;
  return { ok: true, state: ledger.status, ledger };
}
