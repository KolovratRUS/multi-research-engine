import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  resolveMLBOuterValidationPromotionStorePaths,
  readMLBOuterValidationPromotionLedger,
  writeMLBOuterValidationPromotionLedger,
  acquireMLBOuterValidationPromotionLock,
  releaseMLBOuterValidationPromotionLock,
} from '@/prediction/mlb/mlb-outer-validation-promotion-store';
import {
  MLB_OUTER_VALIDATION_PROMOTION_LEDGER_CONTRACT_VERSION,
  MLB_OUTER_VALIDATION_PROMOTION_EVALUATION_ID,
  MLB_OUTER_VALIDATION_PROMOTION_ATTEMPT_NUMBER,
  MLB_OUTER_VALIDATION_PROMOTION_MAX_ATTEMPTS,
  MLB_OUTER_VALIDATION_PROMOTION_MAX_CANDIDATES,
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
  type MLBOuterValidationPromotionPrepared,
  type MLBOuterValidationPromotionPreValidationFailed,
} from '@/prediction/mlb/mlb-outer-validation-promotion-contract';

const TEMP_ROOT_PREFIX = 'mlb-outer-validation-promotion-store-test-';

function buildValidPrepared(overrides: Partial<MLBOuterValidationPromotionPrepared> = {}): MLBOuterValidationPromotionPrepared {
  return {
    contractVersion: MLB_OUTER_VALIDATION_PROMOTION_LEDGER_CONTRACT_VERSION,
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
    ...overrides,
  };
}

function buildValidPreValidationFailed(overrides: Partial<MLBOuterValidationPromotionPreValidationFailed> = {}): MLBOuterValidationPromotionPreValidationFailed {
  return {
    contractVersion: MLB_OUTER_VALIDATION_PROMOTION_LEDGER_CONTRACT_VERSION,
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
    status: 'PRE_VALIDATION_FAILED',
    outerValidationConsumed: false,
    modelPersisted: false,
    trainModelReady: false,
    preHoldoutFailure: {
      failureKind: 'PRECONDITION_FAILURE',
      message: 'synthetic replacement test',
      occurredAt: '2026-04-01T00:00:00.000Z',
    },
    holdoutConsumedAt: null,
    validationMetrics: null,
    referenceFacts: null,
    gateResult: null,
    terminalStatus: null,
    testAuthorized: false,
    testExecuted: false,
    ...overrides,
  };
}

async function createTempRoot(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `${TEMP_ROOT_PREFIX}`));
  return dir;
}

describe('resolveMLBOuterValidationPromotionStorePaths', () => {
  it('resolves absolute paths under repository root', () => {
    const root = '/tmp/repo';
    const paths = resolveMLBOuterValidationPromotionStorePaths(root);
    expect(paths.repositoryRoot).toBe('/tmp/repo');
    expect(paths.ledgerDirectory).toBe('/tmp/repo/var/mlb-development/mlb-outer-validation-promotion-ledger/');
    expect(paths.ledgerPath).toBe('/tmp/repo/var/mlb-development/mlb-outer-validation-promotion-ledger/mlb-v1-outer-validation-promotion-ledger.json');
    expect(paths.tempLedgerPath).toBe('/tmp/repo/var/mlb-development/mlb-outer-validation-promotion-ledger/mlb-v1-outer-validation-promotion-ledger.json.tmp');
    expect(paths.lockPath).toBe('/tmp/repo/var/mlb-development/mlb-outer-validation-promotion-ledger/.lock');
  });

  it('rejects empty or non-string repositoryRoot', () => {
    expect(() => resolveMLBOuterValidationPromotionStorePaths('')).toThrow(TypeError);
    expect(() => resolveMLBOuterValidationPromotionStorePaths('relative/path')).toThrow(TypeError);
  });
});

describe('writeMLBOuterValidationPromotionLedger / readMLBOuterValidationPromotionLedger', () => {
  it('writes and reads a valid PREPARED ledger', async () => {
    const root = await createTempRoot();
    try {
      const ledger = buildValidPrepared({ status: 'PREPARED' });
      const writeResult = await writeMLBOuterValidationPromotionLedger(root, ledger);
      expect(writeResult.ok).toBe(true);

      const readResult = await readMLBOuterValidationPromotionLedger(root);
      expect(readResult.ok).toBe(true);
      if (readResult.ok) {
        expect(readResult.value.status).toBe('PREPARED');
        expect(readResult.value.outerValidationConsumed).toBe(false);
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('atomically replaces canonical content with a different valid PRE_VALIDATION_FAILED record', async () => {
    const root = await createTempRoot();
    try {
      const first = buildValidPrepared({ status: 'PREPARED' });
      const firstWrite = await writeMLBOuterValidationPromotionLedger(root, first);
      expect(firstWrite.ok).toBe(true);

      const second = buildValidPreValidationFailed();
      const secondWrite = await writeMLBOuterValidationPromotionLedger(root, second);
      expect(secondWrite.ok).toBe(true);

      const readResult = await readMLBOuterValidationPromotionLedger(root);
      expect(readResult.ok).toBe(true);
      if (readResult.ok) {
        expect(readResult.value.status).toBe('PRE_VALIDATION_FAILED');
        expect(readResult.value.preHoldoutFailure?.failureKind).toBe('PRECONDITION_FAILURE');
        expect(readResult.value.preHoldoutFailure?.message).toBe('synthetic replacement test');
        expect(readResult.value.outerValidationConsumed).toBe(false);
        expect(readResult.value.modelPersisted).toBe(false);
        expect(readResult.value.trainModelReady).toBe(false);
      }

      const ledgerPath = path.join(root, 'var/mlb-development/mlb-outer-validation-promotion-ledger/mlb-v1-outer-validation-promotion-ledger.json');
      const raw = await fs.readFile(ledgerPath, 'utf-8');
      const canonical = JSON.parse(raw) as Record<string, unknown>;
      expect(canonical.status).toBe('PRE_VALIDATION_FAILED');
      expect(canonical.preHoldoutFailure).toEqual({
        failureKind: 'PRECONDITION_FAILURE',
        message: 'synthetic replacement test',
        occurredAt: '2026-04-01T00:00:00.000Z',
      });
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('does not touch real repository runtime paths', async () => {
    const root = await createTempRoot();
    try {
      const ledger = buildValidPrepared({ status: 'PREPARED' });
      const writeResult = await writeMLBOuterValidationPromotionLedger(root, ledger);
      expect(writeResult.ok).toBe(true);

      const realPath = path.join(process.cwd(), 'var/mlb-development/mlb-outer-validation-promotion-ledger/mlb-v1-outer-validation-promotion-ledger.json');
      const exists = await fs.access(realPath).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

describe('acquireMLBOuterValidationPromotionLock / releaseMLBOuterValidationPromotionLock', () => {
  it('acquires exclusive lock and returns ownership token', async () => {
    const root = await createTempRoot();
    try {
      const acquire = await acquireMLBOuterValidationPromotionLock(root);
      expect(acquire.ok).toBe(true);
      if (acquire.ok) {
        expect(acquire.ownershipToken).toMatch(/^[0-9a-f]{32}$/);
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('releases lock and allows reread', async () => {
    const root = await createTempRoot();
    try {
      const acquire = await acquireMLBOuterValidationPromotionLock(root);
      expect(acquire.ok).toBe(true);
      if (!acquire.ok) return;

      const release = await releaseMLBOuterValidationPromotionLock(root, acquire.ownershipToken);
      expect(release.ok).toBe(true);

      const reread = await acquireMLBOuterValidationPromotionLock(root);
      expect(reread.ok).toBe(true);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('prevents lock contention', async () => {
    const root = await createTempRoot();
    try {
      const first = await acquireMLBOuterValidationPromotionLock(root);
      expect(first.ok).toBe(true);
      if (!first.ok) return;

      const second = await acquireMLBOuterValidationPromotionLock(root);
      expect(second.ok).toBe(false);

      const release = await releaseMLBOuterValidationPromotionLock(root, first.ownershipToken);
      expect(release.ok).toBe(true);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('rejects invalid ownership token', async () => {
    const root = await createTempRoot();
    try {
      const release = await releaseMLBOuterValidationPromotionLock(root, 'invalid-token');
      expect(release.ok).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
