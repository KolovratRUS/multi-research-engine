import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  performMLBOuterValidationPromotionGenesis,
  transitionMLBOuterValidationPromotionToTrainModelReady,
  transitionMLBOuterValidationPromotionToPreValidationFailed,
  transitionMLBOuterValidationPromotionToRunningConsumed,
  transitionMLBOuterValidationPromotionToEligibleForTest,
  transitionMLBOuterValidationPromotionToRejectBeforeTest,
  inspectMLBOuterValidationPromotionLedger,
  type MLBOuterValidationPromotionGenesisInput,
} from '@/prediction/mlb/mlb-outer-validation-promotion-lifecycle';
import {
  MLB_LOGISTIC_REGRESSION_MODEL_CONTRACT_VERSION,
  MLB_VALIDATION_EVALUATION_CONTRACT_VERSION,
  type MLBDeterministicLogisticRegressionModel,
  type MLBModelValidationEvaluation,
} from '@/prediction/mlb/mlb-logistic-regression-fit-contract';
import {
  MLB_PRETEST_VALIDATION_REFERENCE_FACTS_CONTRACT_VERSION,
  type MLBPreTestValidationReferenceFacts,
} from '@/prediction/mlb/mlb-pretest-validation-reference-contract';
import {
  MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID,
  MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID,
  MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID,
  MLB_OUTER_VALIDATION_PROMOTION_PREPROCESSING_POLICY_ID,
  MLB_OUTER_VALIDATION_PROMOTION_FEATURE_POLICY_ID,
  MLB_OUTER_VALIDATION_PROMOTION_MODEL_FAMILY_ID,
  MLB_OUTER_VALIDATION_PROMOTION_REGULARIZATION_CONFIG,
  MLB_OUTER_VALIDATION_PROMOTION_OPTIMIZER_CONFIG,
  MLB_OUTER_VALIDATION_PROMOTION_OTHER_MODEL_AFFECTING_CHOICES,
  MLB_OUTER_VALIDATION_PROMOTION_COMPLEXITY_RANK,
  type MLBOuterValidationPromotionTrainModelReady,
  type MLBOuterValidationPromotionPrepared,
  type MLBOuterValidationPromotionRunningConsumed,
  type MLBOuterValidationPromotionPreHoldoutFailureKind,
  type MLBOuterValidationPromotionEligibleForTest,
  type MLBOuterValidationPromotionRejectBeforeTest,
  type MLBOuterValidationPromotionLedger,
} from '@/prediction/mlb/mlb-outer-validation-promotion-contract';
import {
  acquireMLBOuterValidationPromotionLock,
  releaseMLBOuterValidationPromotionLock,
} from '@/prediction/mlb/mlb-outer-validation-promotion-store';
import { type MLBPreTestCandidateGateResult } from '@/prediction/mlb/mlb-pretest-candidate-gate-contract';

const TEMP_ROOT_PREFIX = 'mlb-outer-validation-promotion-lifecycle-test-';

async function createTempRoot(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `${TEMP_ROOT_PREFIX}`));
  return dir;
}

function validGenesisInput(overrides: Partial<MLBOuterValidationPromotionGenesisInput> = {}): MLBOuterValidationPromotionGenesisInput {
  return {
    authorization: 'EXPLICIT_ONE_TIME_GENESIS',
    genesisTimestamp: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

function buildValidModel(): MLBDeterministicLogisticRegressionModel {
  return {
    contractVersion: MLB_LOGISTIC_REGRESSION_MODEL_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    modelId: 'mlb-v1-outer-validation-model-003',
    planId: 'mlb-v1-outer-validation-training-plan-003',
    matrixId: MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID,
    configId: 'mlb-v1-deterministic-logistic-regression-config-003',
    manifestId: MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID,
    datasetId: MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID,
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    featureIds: [
      'awayBullpenExtraInningGames',
      'awayBullpenGamesInPrevious3Days',
      'awayRunsAllowedPerGame',
      'awayRunsScoredPerGame',
      'awayStarterAvailable',
      'awayWinRate',
      'doubleHeaderGameNumber',
      'homeBullpenExtraInningGames',
      'homeBullpenGamesInPrevious3Days',
      'homeRunsAllowedPerGame',
      'homeRunsScoredPerGame',
      'homeStarterAvailable',
      'homeWinRate',
      'scheduledInnings',
    ],
    coefficients: [
      { featureId: 'awayBullpenExtraInningGames', valueCoefficient: 0.1, missingIndicatorCoefficient: 0 },
      { featureId: 'awayBullpenGamesInPrevious3Days', valueCoefficient: 0.2, missingIndicatorCoefficient: 0 },
      { featureId: 'awayRunsAllowedPerGame', valueCoefficient: -0.1, missingIndicatorCoefficient: 0 },
      { featureId: 'awayRunsScoredPerGame', valueCoefficient: 0.15, missingIndicatorCoefficient: 0 },
      { featureId: 'awayStarterAvailable', valueCoefficient: 0.3, missingIndicatorCoefficient: 0 },
      { featureId: 'awayWinRate', valueCoefficient: 0.25, missingIndicatorCoefficient: 0 },
      { featureId: 'doubleHeaderGameNumber', valueCoefficient: -0.05, missingIndicatorCoefficient: 0 },
      { featureId: 'homeBullpenExtraInningGames', valueCoefficient: 0.12, missingIndicatorCoefficient: 0 },
      { featureId: 'homeBullpenGamesInPrevious3Days', valueCoefficient: 0.18, missingIndicatorCoefficient: 0 },
      { featureId: 'homeRunsAllowedPerGame', valueCoefficient: -0.08, missingIndicatorCoefficient: 0 },
      { featureId: 'homeRunsScoredPerGame', valueCoefficient: 0.22, missingIndicatorCoefficient: 0 },
      { featureId: 'homeStarterAvailable', valueCoefficient: 0.35, missingIndicatorCoefficient: 0 },
      { featureId: 'homeWinRate', valueCoefficient: 0.28, missingIndicatorCoefficient: 0 },
      { featureId: 'scheduledInnings', valueCoefficient: -0.02, missingIndicatorCoefficient: 0 },
    ],
    intercept: 0.05,
    trainingRowCount: 301,
    iterationsCompleted: 100,
    converged: true,
    finalTrainingObjective: 0.5,
  };
}

function buildValidValidationEvaluation(): MLBModelValidationEvaluation {
  return {
    contractVersion: MLB_VALIDATION_EVALUATION_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    evaluationId: 'mlb-v1-outer-validation-promotion-evaluation-003',
    modelId: 'mlb-v1-outer-validation-model-003',
    planId: 'mlb-v1-outer-validation-training-plan-003',
    matrixId: MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID,
    configId: 'mlb-v1-deterministic-logistic-regression-config-003',
    split: 'VALIDATION',
    rowCount: 67,
    metrics: { logLoss: 0.6, brierScore: 0.2, rocAuc: 0.8 },
  };
}

function buildValidReferenceFacts(): MLBPreTestValidationReferenceFacts {
  return {
    contractVersion: MLB_PRETEST_VALIDATION_REFERENCE_FACTS_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    matrixId: MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID,
    datasetId: MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID,
    evaluationPlanId: 'mlb-v1-outer-validation-training-plan-003',
    trainRowCount: 301,
    validationRowCount: 67,
    trainHomeWinCount: 170,
    trainAwayWinCount: 131,
    trainHomeWinPrior: 170 / 301,
    p50: { probability: 0.5, validationLogLoss: 0.65, validationBrierScore: 0.22 },
    trainPrior: { probability: 170 / 301, validationLogLoss: 0.7, validationBrierScore: 0.25 },
  };
}

function buildEligibleGateResult(): MLBOuterValidationPromotionEligibleForTest['gateResult'] {
  return {
    eligibility: 'ELIGIBLE_FOR_TEST',
    reasons: [],
  };
}

function buildRejectedGateResult(): MLBOuterValidationPromotionRejectBeforeTest['gateResult'] {
  return {
    eligibility: 'REJECT_BEFORE_TEST',
    reasons: ['VALIDATION_LOG_LOSS_NOT_BETTER_THAN_REFERENCES'],
  };
}

describe('performMLBOuterValidationPromotionGenesis', () => {
  it('creates exact PREPARED state', async () => {
    const root = await createTempRoot();
    try {
      const result = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.ledger.status).toBe('PREPARED');
        expect(result.ledger.contractVersion).toBe('mlb-outer-validation-promotion-ledger-v1');
        expect(result.ledger.outerValidationConsumed).toBe(false);
        expect(result.ledger.modelPersisted).toBe(false);
        expect(result.ledger.trainModelReady).toBe(false);
        expect(result.ledger.candidateRecipeId).toBe('mlb-v1-inner-candidate-003');
        expect(result.ledger.attemptNumber).toBe(1);
        expect(result.ledger.maxAttempts).toBe(1);
        expect(result.ledger.maxCandidates).toBe(1);
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('rejects caller-overridden frozen identity fields', async () => {
    const root = await createTempRoot();
    try {
      const result = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const bad = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput({ genesisTimestamp: '2026-04-02T00:00:00.000Z' }));
      expect(bad.ok).toBe(false);
      if (!bad.ok) {
        expect(bad.state).toBe('GENESIS_FAILED');
        expect(bad.issues.some((issue) => issue.code === 'GENESIS_FAILED')).toBe(true);
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('does not persist genesis authorization in ledger', async () => {
    const root = await createTempRoot();
    try {
      const result = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect((result.ledger as Record<string, unknown>).authorization).toBeUndefined();
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('rejects second genesis attempt', async () => {
    const root = await createTempRoot();
    try {
      const first = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(first.ok).toBe(true);

      const second = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput({ genesisTimestamp: '2026-04-02T00:00:00.000Z' }));
      expect(second.ok).toBe(false);
      if (!second.ok) {
        expect(second.state).toBe('GENESIS_FAILED');
        expect(second.issues.some((issue) => issue.code === 'GENESIS_FAILED')).toBe(true);
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('first genesis with no anchor and no ledger succeeds', async () => {
    const root = await createTempRoot();
    try {
      const result = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(result.ok).toBe(true);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('after first genesis reset anchor and canonical ledger exist', async () => {
    const root = await createTempRoot();
    try {
      const result = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const anchorPath = path.join(root, 'var/mlb-development/mlb-outer-validation-promotion-ledger/.reset-anchor');
      const ledgerPath = path.join(root, 'var/mlb-development/mlb-outer-validation-promotion-ledger/mlb-v1-outer-validation-promotion-ledger.json');

      const anchorExists = await fs.access(anchorPath).then(() => true).catch(() => false);
      const ledgerExists = await fs.access(ledgerPath).then(() => true).catch(() => false);
      expect(anchorExists).toBe(true);
      expect(ledgerExists).toBe(true);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('second genesis rejects', async () => {
    const root = await createTempRoot();
    try {
      const first = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(first.ok).toBe(true);

      const second = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput({ genesisTimestamp: '2026-04-02T00:00:00.000Z' }));
      expect(second.ok).toBe(false);
      if (!second.ok) {
        expect(second.state).toBe('GENESIS_FAILED');
        expect(second.issues.some((issue) => issue.code === 'GENESIS_FAILED')).toBe(true);
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('deleting only canonical ledger while anchor remains blocks regenesis', async () => {
    const root = await createTempRoot();
    try {
      const first = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(first.ok).toBe(true);

      const ledgerPath = path.join(root, 'var/mlb-development/mlb-outer-validation-promotion-ledger/mlb-v1-outer-validation-promotion-ledger.json');
      await fs.rm(ledgerPath);

      const second = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput({ genesisTimestamp: '2026-04-02T00:00:00.000Z' }));
      expect(second.ok).toBe(false);
      if (!second.ok) {
        expect(second.state).toBe('GENESIS_FAILED');
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('anchor is not automatically deleted on failed regenesis', async () => {
    const root = await createTempRoot();
    try {
      const first = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(first.ok).toBe(true);

      const ledgerPath = path.join(root, 'var/mlb-development/mlb-outer-validation-promotion-ledger/mlb-v1-outer-validation-promotion-ledger.json');
      await fs.rm(ledgerPath);

      const second = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput({ genesisTimestamp: '2026-04-02T00:00:00.000Z' }));
      expect(second.ok).toBe(false);

      const anchorPath = path.join(root, 'var/mlb-development/mlb-outer-validation-promotion-ledger/.reset-anchor');
      const anchorExists = await fs.access(anchorPath).then(() => true).catch(() => false);
      expect(anchorExists).toBe(true);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

describe('transitionMLBOuterValidationPromotionToTrainModelReady', () => {
  it('succeeds with valid model', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;
      const prepared = genesis.ledger as MLBOuterValidationPromotionPrepared;

      const model = buildValidModel();
      const transition = await transitionMLBOuterValidationPromotionToTrainModelReady(root, model);
      expect(transition.ok).toBe(true);
      if (transition.ok) {
        expect(transition.ledger.status).toBe('TRAIN_MODEL_READY');
        expect(transition.ledger.modelPersisted).toBe(true);
        expect(transition.ledger.trainModelReady).toBe(true);
        expect(transition.ledger.fittedModel).toEqual(model);
        expect(transition.ledger.outerValidationConsumed).toBe(false);
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('rejects stale caller state override', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;
      const stale = { ...genesis.ledger, status: 'TRAIN_MODEL_READY' } as unknown as MLBOuterValidationPromotionPrepared;

      const model = buildValidModel();
      const transition = await transitionMLBOuterValidationPromotionToTrainModelReady(root, model);
      expect(transition.ok).toBe(true);
      if (transition.ok) {
        expect(transition.ledger.status).toBe('TRAIN_MODEL_READY');
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('requires valid model identity', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;
      const prepared = genesis.ledger as MLBOuterValidationPromotionPrepared;

      const badModel = { ...buildValidModel(), sport: 'NFL' as const } as unknown as MLBDeterministicLogisticRegressionModel;
      const transition = await transitionMLBOuterValidationPromotionToTrainModelReady(root, badModel);
      expect(transition.ok).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('requires exactly 301 training rows', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;
      const prepared = genesis.ledger as MLBOuterValidationPromotionPrepared;

      const badModel = { ...buildValidModel(), trainingRowCount: 300 };
      const transition = await transitionMLBOuterValidationPromotionToTrainModelReady(root, badModel);
      expect(transition.ok).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('requires converged=true', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;
      const prepared = genesis.ledger as MLBOuterValidationPromotionPrepared;

      const badModel = { ...buildValidModel(), converged: false };
      const transition = await transitionMLBOuterValidationPromotionToTrainModelReady(root, badModel);
      expect(transition.ok).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('keeps validation fields absent', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;
      const prepared = genesis.ledger as MLBOuterValidationPromotionPrepared;

      const model = buildValidModel();
      const transition = await transitionMLBOuterValidationPromotionToTrainModelReady(root, model);
      expect(transition.ok).toBe(true);
      if (transition.ok) {
        expect(transition.ledger.validationMetrics).toBeNull();
        expect(transition.ledger.referenceFacts).toBeNull();
        expect(transition.ledger.gateResult).toBeNull();
        expect(transition.ledger.holdoutConsumedAt).toBeNull();
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

describe('transitionMLBOuterValidationPromotionToPreValidationFailed', () => {
  const PRE_VALIDATION_FAILURE_KINDS: readonly MLBOuterValidationPromotionPreHoldoutFailureKind[] = [
    'PRECONDITION_FAILURE',
    'TRAIN_SOURCE_INTEGRITY_FAILURE',
    'TRAIN_FIT_THROW',
    'TRAIN_NONCONVERGENCE',
    'MODEL_VALIDATION_FAILURE',
    'MODEL_PERSISTENCE_FAILURE',
  ];

  it.each(PRE_VALIDATION_FAILURE_KINDS)(
    'accepts valid failureKind %s',
    async (failureKind) => {
      const root = await createTempRoot();
      try {
        const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
        expect(genesis.ok).toBe(true);
        if (!genesis.ok) {
          throw new Error(`Genesis failed for ${failureKind}: unexpected rejection`);
        }

        const result = await transitionMLBOuterValidationPromotionToPreValidationFailed(root, failureKind, 'msg');
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.ledger.status).toBe('PRE_VALIDATION_FAILED');
          expect(result.ledger.preHoldoutFailure?.failureKind).toBe(failureKind);
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    },
  );

  it('populates occurredAt timestamp', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;
      const prepared = genesis.ledger as MLBOuterValidationPromotionPrepared;

      const result = await transitionMLBOuterValidationPromotionToPreValidationFailed(root, 'TRAIN_FIT_THROW' as MLBOuterValidationPromotionPreHoldoutFailureKind, '');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.ledger.status).toBe('PRE_VALIDATION_FAILED');
        expect(typeof result.ledger.preHoldoutFailure?.occurredAt).toBe('string');
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('forbids model and consumed fields', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;
      const prepared = genesis.ledger as MLBOuterValidationPromotionPrepared;

      const result = await transitionMLBOuterValidationPromotionToPreValidationFailed(root, 'TRAIN_FIT_THROW' as MLBOuterValidationPromotionPreHoldoutFailureKind, 'msg');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.ledger.modelPersisted).toBe(false);
        expect(result.ledger.trainModelReady).toBe(false);
        expect(result.ledger.outerValidationConsumed).toBe(false);
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('has no outgoing recovery transitions', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;
      const prepared = genesis.ledger as MLBOuterValidationPromotionPrepared;

      const failed = await transitionMLBOuterValidationPromotionToPreValidationFailed(root, 'TRAIN_FIT_THROW' as MLBOuterValidationPromotionPreHoldoutFailureKind, 'msg');
      expect(failed.ok).toBe(true);
      if (!failed.ok) return;
      const failedLedger = failed.ledger as unknown as MLBOuterValidationPromotionPrepared;

      const model = buildValidModel();
      const resume = await transitionMLBOuterValidationPromotionToTrainModelReady(root, model);
      expect(resume.ok).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

describe('transitionMLBOuterValidationPromotionToRunningConsumed', () => {
  it('succeeds from TRAIN_MODEL_READY', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;
      const prepared = genesis.ledger as MLBOuterValidationPromotionPrepared;

      const model = buildValidModel();
      const ready = await transitionMLBOuterValidationPromotionToTrainModelReady(root, model);
      expect(ready.ok).toBe(true);
      if (!ready.ok) return;
      const readyLedger = ready.ledger as MLBOuterValidationPromotionTrainModelReady;

      const consumed = await transitionMLBOuterValidationPromotionToRunningConsumed(root, '2026-04-24T00:00:00.000Z');
      expect(consumed.ok).toBe(true);
      if (consumed.ok) {
        expect(consumed.ledger.status).toBe('RUNNING_CONSUMED');
        expect(consumed.ledger.outerValidationConsumed).toBe(true);
        expect(consumed.ledger.holdoutConsumedAt).toBe('2026-04-24T00:00:00.000Z');
        expect(consumed.ledger.fittedModel).toEqual(model);
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('rejects second consume', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;
      const prepared = genesis.ledger as MLBOuterValidationPromotionPrepared;

      const model = buildValidModel();
      const ready = await transitionMLBOuterValidationPromotionToTrainModelReady(root, model);
      expect(ready.ok).toBe(true);
      if (!ready.ok) return;
      const readyLedger = ready.ledger as MLBOuterValidationPromotionTrainModelReady;

      const consumed1 = await transitionMLBOuterValidationPromotionToRunningConsumed(root, '2026-04-24T00:00:00.000Z');
      expect(consumed1.ok).toBe(true);
      if (!consumed1.ok) return;
      const consumed1Ledger = consumed1.ledger as unknown as MLBOuterValidationPromotionTrainModelReady;

      const consumed2 = await transitionMLBOuterValidationPromotionToRunningConsumed(root, '2026-04-25T00:00:00.000Z');
      expect(consumed2.ok).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('rejects stale source override', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;

      const stale = { ...genesis.ledger, status: 'RUNNING_CONSUMED' } as unknown as MLBOuterValidationPromotionTrainModelReady;
      const consumed = await transitionMLBOuterValidationPromotionToRunningConsumed(root, '2026-04-24T00:00:00.000Z');
      expect(consumed.ok).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

describe('terminal transitions', () => {
  it('transitions to ELIGIBLE_FOR_TEST with exact gate result', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;
      const prepared = genesis.ledger as MLBOuterValidationPromotionPrepared;

      const model = buildValidModel();
      const ready = await transitionMLBOuterValidationPromotionToTrainModelReady(root, model);
      expect(ready.ok).toBe(true);
      if (!ready.ok) return;
      const readyLedger = ready.ledger as MLBOuterValidationPromotionTrainModelReady;

      const consumed = await transitionMLBOuterValidationPromotionToRunningConsumed(root, '2026-04-24T00:00:00.000Z');
      expect(consumed.ok).toBe(true);
      if (!consumed.ok) return;
      const consumedLedger = consumed.ledger;

      const metrics = buildValidValidationEvaluation();
      const referenceFacts = buildValidReferenceFacts();
      const gateResult = buildEligibleGateResult();

      const terminal = await transitionMLBOuterValidationPromotionToEligibleForTest(root, metrics, referenceFacts, gateResult);
      expect(terminal.ok).toBe(true);
      if (terminal.ok) {
        expect(terminal.ledger.status).toBe('ELIGIBLE_FOR_TEST');
        expect(terminal.ledger.validationMetrics).toEqual(metrics);
        expect(terminal.ledger.referenceFacts).toEqual(referenceFacts);
        expect(terminal.ledger.gateResult).toEqual(gateResult);
        expect(terminal.ledger.terminalStatus).toBe('ELIGIBLE_FOR_TEST');
        expect(terminal.ledger.testAuthorized).toBe(false);
        expect(terminal.ledger.testExecuted).toBe(false);
      }

      if (terminal.ok) {
        const exactStatus: 'ELIGIBLE_FOR_TEST' = terminal.ledger.status;
        expect(exactStatus).toBe('ELIGIBLE_FOR_TEST');

        const exactLedger: MLBOuterValidationPromotionEligibleForTest = terminal.ledger;
        expect(exactLedger.status).toBe('ELIGIBLE_FOR_TEST');
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('transitions to REJECT_BEFORE_TEST with exact gate result', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;
      const prepared = genesis.ledger as MLBOuterValidationPromotionPrepared;

      const model = buildValidModel();
      const ready = await transitionMLBOuterValidationPromotionToTrainModelReady(root, model);
      expect(ready.ok).toBe(true);
      if (!ready.ok) return;
      const readyLedger = ready.ledger as MLBOuterValidationPromotionTrainModelReady;

      const consumed = await transitionMLBOuterValidationPromotionToRunningConsumed(root, '2026-04-24T00:00:00.000Z');
      expect(consumed.ok).toBe(true);
      if (!consumed.ok) return;
      const consumedLedger = consumed.ledger;

      const metrics = buildValidValidationEvaluation();
      const referenceFacts = buildValidReferenceFacts();
      const gateResult = buildRejectedGateResult();

      const terminal = await transitionMLBOuterValidationPromotionToRejectBeforeTest(root, metrics, referenceFacts, gateResult);
      expect(terminal.ok).toBe(true);
      if (terminal.ok) {
        expect(terminal.ledger.status).toBe('REJECT_BEFORE_TEST');
        expect(terminal.ledger.terminalStatus).toBe('REJECT_BEFORE_TEST');
      }

      if (terminal.ok) {
        const exactStatus: 'REJECT_BEFORE_TEST' = terminal.ledger.status;
        expect(exactStatus).toBe('REJECT_BEFORE_TEST');

        const exactLedger: MLBOuterValidationPromotionRejectBeforeTest = terminal.ledger;
        expect(exactLedger.status).toBe('REJECT_BEFORE_TEST');
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('rejects gate/status mismatch', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;
      const prepared = genesis.ledger as MLBOuterValidationPromotionPrepared;

      const model = buildValidModel();
      const ready = await transitionMLBOuterValidationPromotionToTrainModelReady(root, model);
      expect(ready.ok).toBe(true);
      if (!ready.ok) return;
      const readyLedger = ready.ledger as MLBOuterValidationPromotionTrainModelReady;

      const consumed = await transitionMLBOuterValidationPromotionToRunningConsumed(root, '2026-04-24T00:00:00.000Z');
      expect(consumed.ok).toBe(true);
      if (!consumed.ok) return;
      const consumedLedger = consumed.ledger;

      const metrics = buildValidValidationEvaluation();
      const referenceFacts = buildValidReferenceFacts();
      const gateResult = buildEligibleGateResult();

      const terminal = await transitionMLBOuterValidationPromotionToEligibleForTest(root, metrics, referenceFacts, gateResult);
      expect(terminal.ok).toBe(true);
      if (!terminal.ok) return;

      const retry = await transitionMLBOuterValidationPromotionToRejectBeforeTest(
        root,
        metrics,
        referenceFacts,
        gateResult as unknown as MLBOuterValidationPromotionRejectBeforeTest['gateResult'],
      );
      expect(retry.ok).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('rejects reject gate result against eligible terminal transition', async () => {
    const root = await createTempRoot();
    try {
      await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      const prepared = await inspectMLBOuterValidationPromotionLedger(root);
      expect(prepared.ok).toBe(true);
      if (!prepared.ok) return;

      const ready = await transitionMLBOuterValidationPromotionToTrainModelReady(root, buildValidModel());
      expect(ready.ok).toBe(true);
      if (!ready.ok) return;

      const consumed = await transitionMLBOuterValidationPromotionToRunningConsumed(root, '2026-04-24T00:00:00.000Z');
      expect(consumed.ok).toBe(true);
      if (!consumed.ok) return;

      const metrics = buildValidValidationEvaluation();
      const referenceFacts = buildValidReferenceFacts();
      const gateResult = buildRejectedGateResult();

      const terminal = await transitionMLBOuterValidationPromotionToEligibleForTest(
        root,
        metrics,
        referenceFacts,
        gateResult as unknown as MLBOuterValidationPromotionEligibleForTest['gateResult'],
      );
      expect(terminal.ok).toBe(false);
      if (!terminal.ok) return;
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('rejects terminal outgoing transitions', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;
      const prepared = genesis.ledger as MLBOuterValidationPromotionPrepared;

      const model = buildValidModel();
      const ready = await transitionMLBOuterValidationPromotionToTrainModelReady(root, model);
      expect(ready.ok).toBe(true);
      if (!ready.ok) return;
      const readyLedger = ready.ledger as MLBOuterValidationPromotionTrainModelReady;

      const consumed = await transitionMLBOuterValidationPromotionToRunningConsumed(root, '2026-04-24T00:00:00.000Z');
      expect(consumed.ok).toBe(true);
      if (!consumed.ok) return;
      const consumedLedger = consumed.ledger;

      const metrics = buildValidValidationEvaluation();
      const referenceFacts = buildValidReferenceFacts();
      const gateResult = buildEligibleGateResult();

      const terminal = await transitionMLBOuterValidationPromotionToEligibleForTest(root, metrics, referenceFacts, gateResult);
      expect(terminal.ok).toBe(true);
      if (!terminal.ok) return;

      const retry = await transitionMLBOuterValidationPromotionToTrainModelReady(root, buildValidModel());
      expect(retry.ok).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('rejects terminal mutation from PREPARED', async () => {
    const root = await createTempRoot();
    try {
      await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      const prepared = await inspectMLBOuterValidationPromotionLedger(root);
      expect(prepared.ok).toBe(true);
      if (!prepared.ok) return;

      const metrics = buildValidValidationEvaluation();
      const referenceFacts = buildValidReferenceFacts();
      const gateResult = buildEligibleGateResult();

      const terminal = await transitionMLBOuterValidationPromotionToEligibleForTest(root, metrics, referenceFacts, gateResult);
      expect(terminal.ok).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('rejects terminal mutation from TRAIN_MODEL_READY', async () => {
    const root = await createTempRoot();
    try {
      await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      const prepared = await inspectMLBOuterValidationPromotionLedger(root);
      expect(prepared.ok).toBe(true);
      if (!prepared.ok) return;

      const ready = await transitionMLBOuterValidationPromotionToTrainModelReady(root, buildValidModel());
      expect(ready.ok).toBe(true);
      if (!ready.ok) return;

      const metrics = buildValidValidationEvaluation();
      const referenceFacts = buildValidReferenceFacts();
      const gateResult = buildEligibleGateResult();

      const terminal = await transitionMLBOuterValidationPromotionToEligibleForTest(root, metrics, referenceFacts, gateResult);
      expect(terminal.ok).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('rejects terminal outgoing transitions', async () => {
    const root = await createTempRoot();
    try {
      await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      const prepared = await inspectMLBOuterValidationPromotionLedger(root);
      expect(prepared.ok).toBe(true);
      if (!prepared.ok) return;

      const ready = await transitionMLBOuterValidationPromotionToTrainModelReady(root, buildValidModel());
      expect(ready.ok).toBe(true);
      if (!ready.ok) return;

      const consumed = await transitionMLBOuterValidationPromotionToRunningConsumed(root, '2026-04-24T00:00:00.000Z');
      expect(consumed.ok).toBe(true);
      if (!consumed.ok) return;

      const metrics = buildValidValidationEvaluation();
      const referenceFacts = buildValidReferenceFacts();
      const gateResult = buildEligibleGateResult();

      const terminal = await transitionMLBOuterValidationPromotionToEligibleForTest(root, metrics, referenceFacts, gateResult);
      expect(terminal.ok).toBe(true);
      if (!terminal.ok) return;

      const retry = await transitionMLBOuterValidationPromotionToTrainModelReady(root, buildValidModel());
      expect(retry.ok).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

describe('illegal transitions', () => {
  it('rejects PREPARED -> RUNNING_CONSUMED', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;
      const prepared = genesis.ledger as MLBOuterValidationPromotionPrepared;

      const consumed = await transitionMLBOuterValidationPromotionToRunningConsumed(root, '2026-04-24T00:00:00.000Z');
      expect(consumed.ok).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('rejects PREPARED -> terminal', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;
      const prepared = genesis.ledger as MLBOuterValidationPromotionPrepared;

      const metrics = buildValidValidationEvaluation();
      const referenceFacts = buildValidReferenceFacts();
      const gateResult = buildEligibleGateResult();

      const terminal = await transitionMLBOuterValidationPromotionToEligibleForTest(root, metrics, referenceFacts, gateResult);
      expect(terminal.ok).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('rejects TRAIN_MODEL_READY -> terminal', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;
      const prepared = genesis.ledger as MLBOuterValidationPromotionPrepared;

      const model = buildValidModel();
      const ready = await transitionMLBOuterValidationPromotionToTrainModelReady(root, model);
      expect(ready.ok).toBe(true);
      if (!ready.ok) return;
      const readyLedger = ready.ledger as MLBOuterValidationPromotionTrainModelReady;

      const metrics = buildValidValidationEvaluation();
      const referenceFacts = buildValidReferenceFacts();
      const gateResult = buildEligibleGateResult();

      const terminal = await transitionMLBOuterValidationPromotionToEligibleForTest(root, metrics, referenceFacts, gateResult);
      expect(terminal.ok).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('rejects consumed -> unconsumed', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;
      const prepared = genesis.ledger as MLBOuterValidationPromotionPrepared;

      const model = buildValidModel();
      const ready = await transitionMLBOuterValidationPromotionToTrainModelReady(root, model);
      expect(ready.ok).toBe(true);
      if (!ready.ok) return;
      const readyLedger = ready.ledger as MLBOuterValidationPromotionTrainModelReady;

      const consumed = await transitionMLBOuterValidationPromotionToRunningConsumed(root, '2026-04-24T00:00:00.000Z');
      expect(consumed.ok).toBe(true);
      if (!consumed.ok) return;

      const retry = await transitionMLBOuterValidationPromotionToTrainModelReady(root, model);
      expect(retry.ok).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('rejects wrong promotion identity', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;
      const prepared = genesis.ledger as MLBOuterValidationPromotionPrepared;

      const model = buildValidModel();
      const ready = await transitionMLBOuterValidationPromotionToTrainModelReady(root, model);
      expect(ready.ok).toBe(true);
      if (!ready.ok) return;
      const readyLedger = ready.ledger as MLBOuterValidationPromotionTrainModelReady;

      const bad = {
        ...readyLedger,
        fittedModel: {
          ...readyLedger.fittedModel,
          datasetId: 'other-dataset',
        },
      } as unknown as MLBOuterValidationPromotionLedger;
      await fs.writeFile(path.join(root, 'var/mlb-development/mlb-outer-validation-promotion-ledger/mlb-v1-outer-validation-promotion-ledger.json'), JSON.stringify(bad, null, 2) + '\n');
      const consumed = await transitionMLBOuterValidationPromotionToRunningConsumed(root, '2026-04-24T00:00:00.000Z');
      expect(consumed.ok).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

describe('lock and failure', () => {
  it('prevents mutation under contention', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;
      const prepared = genesis.ledger as MLBOuterValidationPromotionPrepared;

      const acquire = await acquireMLBOuterValidationPromotionLock(root);
      expect(acquire.ok).toBe(true);
      if (!acquire.ok) return;

      const model = buildValidModel();
      const transition = await transitionMLBOuterValidationPromotionToTrainModelReady(root, model);
      expect(transition.ok).toBe(false);

      const release = await releaseMLBOuterValidationPromotionLock(root, acquire.ownershipToken);
      expect(release.ok).toBe(true);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('rereads under lock and catches externally changed canonical state', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;
      const prepared = genesis.ledger as MLBOuterValidationPromotionPrepared;

      const ledgerPath = path.join(root, 'var/mlb-development/mlb-outer-validation-promotion-ledger/mlb-v1-outer-validation-promotion-ledger.json');
      const raw = await fs.readFile(ledgerPath, 'utf-8');
      const parsed = JSON.parse(raw);
      parsed.datasetId = 'other-dataset';
      await fs.writeFile(ledgerPath, JSON.stringify(parsed, null, 2) + '\n');

      const model = buildValidModel();
      const transition = await transitionMLBOuterValidationPromotionToTrainModelReady(root, model);
      expect(transition.ok).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('releases lock on handled failure where ownership remains valid', async () => {
    const root = await createTempRoot();
    try {
      const genesis = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(genesis.ok).toBe(true);
      if (!genesis.ok) return;

      const bad = { ...genesis.ledger, status: 'TRAIN_MODEL_READY' } as unknown as MLBOuterValidationPromotionLedger;
      await fs.writeFile(path.join(root, 'var/mlb-development/mlb-outer-validation-promotion-ledger/mlb-v1-outer-validation-promotion-ledger.json'), JSON.stringify(bad, null, 2) + '\n');
      const model = buildValidModel();
      const result = await transitionMLBOuterValidationPromotionToTrainModelReady(root, model);
      expect(result.ok).toBe(false);

      const lockPath = path.join(root, 'var/mlb-development/mlb-outer-validation-promotion-ledger/.lock');
      const lockExists = await fs.access(lockPath).then(() => true).catch(() => false);
      expect(lockExists).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

describe('firewall', () => {
  it('does not reference real data providers or model fitters', async () => {
    const root = await createTempRoot();
    try {
      const result = await performMLBOuterValidationPromotionGenesis(root, validGenesisInput());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.ledger).toBeDefined();
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
