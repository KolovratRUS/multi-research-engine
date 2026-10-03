/* -------------------------------------------------------------------------- */
/*  Functional tests for L5E2S orchestrator                                    */
/*  Synthetic / temp-root fixtures only — NO real MLB execution,              */
/*  NO production shadow runtime write.                                      */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  Mock factories — preserve real implementations as vi.fn wrappers          */
/*                                                                            */
/*  The fingerprint and inference modules are mocked so that:                  */
/*    - Negative tests use the REAL verifier (delegating through the mock)     */
/*      to prove fail-closed behavior against non-candidate-003 models.        */
/*    - Positive parity tests override ONLY the verifier mock to return true,  */
/*      then call the real inference through the inference mock wrapper.        */
/*    - Ordering test checks the inference mock was never called.              */
/*                                                                            */
/*  The store module is mocked with a vi.fn wrapper so that status-mapping    */
/*  tests (ALREADY_EXISTS, VERIFICATION_FAILED, unknown failures) can control   */
/*  the store's return value while real-persistence tests use the real impl.   */
/*                                                                            */
/*  node:fs/promises is mocked so readFile can be spied on for                */
/*  VERIFICATION_FAILED read-back failure tests.                               */
/*                                                                            */
/*  No production bypass is introduced — mocks exist ONLY in this test file. */
/* -------------------------------------------------------------------------- */

vi.mock(
  '@/prediction/mlb/mlb-shadow-model-fingerprint',
  async (importActual) => {
    const actual = await importActual<
      typeof import('@/prediction/mlb/mlb-shadow-model-fingerprint')
    >();
    return {
      ...actual,
      verifyMLBShadowCandidate003AuthoritativeModel: vi.fn(
        actual.verifyMLBShadowCandidate003AuthoritativeModel,
      ),
    };
  },
);

vi.mock(
  '@/prediction/mlb/mlb-offline-pregame-inference-contract',
  async (importActual) => {
    const actual = await importActual<
      typeof import('@/prediction/mlb/mlb-offline-pregame-inference-contract')
    >();
    return {
      ...actual,
      inferMLBOfflinePregameWinner: vi.fn(
        actual.inferMLBOfflinePregameWinner,
      ),
    };
  },
);

vi.mock(
  '@/prediction/mlb/mlb-shadow-monitoring-prediction-store',
  async (importActual) => {
    const actual = await importActual<
      typeof import('@/prediction/mlb/mlb-shadow-monitoring-prediction-store')
    >();
    return {
      ...actual,
      persistMLBShadowQuarantinedPrediction: vi.fn(
        actual.persistMLBShadowQuarantinedPrediction,
      ),
    };
  },
);

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: vi.fn(actual.readFile),
  };
});

/* -------------------------------------------------------------------------- */
/*  Imports                                                                   */
/* -------------------------------------------------------------------------- */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

// Mocked modules
import { verifyMLBShadowCandidate003AuthoritativeModel } from '@/prediction/mlb/mlb-shadow-model-fingerprint';
import {
  inferMLBOfflinePregameWinner,
  type MLBOfflinePregameInference,
  type MLBOfflinePregameInferenceIssue,
} from '@/prediction/mlb/mlb-offline-pregame-inference-contract';
import {
  persistMLBShadowQuarantinedPrediction,
  MLB_SHADOW_MONITORING_PREDICTION_STORE_VERSION,
  type MLBShadowPredictionPersistenceResult,
  type MLBShadowPredictionFailureStatus,
} from '@/prediction/mlb/mlb-shadow-monitoring-prediction-store';

// Module under test
import {
  orchestrateMLBShadowQuarantinePrediction,
  type MLBShadowQuarantineOrchestratorInput,
} from '@/prediction/mlb/mlb-shadow-monitoring-prediction-orchestrator';

// Non-mocked validation modules for fixture validation
import {
  validateMLBModelTestReleaseResult,
  validateMLBModelTestEvaluation,
  validateMLBModelReleaseRecord,
} from '@/prediction/mlb/mlb-model-test-release-contract';
import {
  validateMLBModelFitValidationResult,
} from '@/prediction/mlb/mlb-logistic-regression-fit-contract';
import { validateMLBFeatureManifest } from '@/prediction/mlb/mlb-feature-vector-contract';
import {
  validateMLBCanonicalPregameSnapshot,
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';

// Namespace + record contract
import {
  MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE,
} from '@/prediction/mlb/mlb-shadow-monitoring-namespace';
import {
  MLB_SHADOW_MONITORING_SCIENTIFIC_USE_NONE,
  MLB_SHADOW_MONITORING_OPERATIONAL_MODE_S1_OPERATIONAL_BLIND,
} from '@/prediction/mlb/mlb-shadow-monitoring-record-contract';

/* -------------------------------------------------------------------------- */
/*  Frozen test timestamps                                                    */
/* -------------------------------------------------------------------------- */

const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';

/* -------------------------------------------------------------------------- */
/*  Real implementations captured for mock restoration                        */
/* -------------------------------------------------------------------------- */

type InferenceResult =
  | Readonly<{ ok: true; value: MLBOfflinePregameInference }>
  | Readonly<{ ok: false; issues: readonly MLBOfflinePregameInferenceIssue[] }>;

type InferFn = (
  releasedModelResult: unknown,
  featureManifest: unknown,
  snapshot: unknown,
) => InferenceResult;
type VerifyFn = (model: unknown) => boolean;
type PersistFn = typeof persistMLBShadowQuarantinedPrediction;
type ReadFileFn = typeof fs.readFile;

let realVerify: VerifyFn;
let realInfer: InferFn;
let realPersist: PersistFn;
let realReadFile: ReadFileFn;

beforeAll(async () => {
  const fp = await vi.importActual<
    typeof import('@/prediction/mlb/mlb-shadow-model-fingerprint')
  >('@/prediction/mlb/mlb-shadow-model-fingerprint');
  realVerify = fp.verifyMLBShadowCandidate003AuthoritativeModel as VerifyFn;

  const inf = await vi.importActual<
    typeof import('@/prediction/mlb/mlb-offline-pregame-inference-contract')
  >('@/prediction/mlb/mlb-offline-pregame-inference-contract');
  realInfer = inf.inferMLBOfflinePregameWinner as unknown as InferFn;

  const storeActual = await vi.importActual<
    typeof import('@/prediction/mlb/mlb-shadow-monitoring-prediction-store')
  >('@/prediction/mlb/mlb-shadow-monitoring-prediction-store');
  realPersist = storeActual.persistMLBShadowQuarantinedPrediction;

  const fsActual = await vi.importActual<
    typeof import('node:fs/promises')
  >('node:fs/promises');
  realReadFile = fsActual.readFile;
});

beforeEach(() => {
  // Restore real implementations after any mockReturnValue override.
  vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReset();
  vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockImplementation(realVerify);
  vi.mocked(inferMLBOfflinePregameWinner).mockReset();
  vi.mocked(inferMLBOfflinePregameWinner).mockImplementation(realInfer);
  vi.mocked(persistMLBShadowQuarantinedPrediction).mockReset();
  vi.mocked(persistMLBShadowQuarantinedPrediction).mockImplementation(realPersist);
  vi.mocked(fs.readFile).mockReset();
  vi.mocked(fs.readFile).mockImplementation(realReadFile);
});

/* -------------------------------------------------------------------------- */
/*  Temp directory helpers                                                    */
/* -------------------------------------------------------------------------- */

const cleanupDirs: string[] = [];

afterEach(async () => {
  while (cleanupDirs.length > 0) {
    const dir = cleanupDirs.pop()!;
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
});

async function trackedTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(join(tmpdir(), prefix));
  cleanupDirs.push(dir);
  return dir;
}

/* -------------------------------------------------------------------------- */
/*  Test-fixture builders — adapted from the computation test file            */
/* -------------------------------------------------------------------------- */

function buildValidReleaseResult(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const baseModel = {
    contractVersion: 'mlb-deterministic-logistic-regression-model-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    modelId: 'model-1',
    planId: 'plan-1',
    matrixId: 'matrix-1',
    configId: 'config-1',
    manifestId: 'manifest-1',
    datasetId: 'dataset-1',
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    intercept: 0,
    featureIds: ['p_1', 'p_2'],
    coefficients: [
      { featureId: 'p_1', valueCoefficient: 0, missingIndicatorCoefficient: 0 },
      { featureId: 'p_2', valueCoefficient: 0, missingIndicatorCoefficient: 0 },
    ],
    trainingRowCount: 2,
    iterationsCompleted: 1,
    converged: true,
    finalTrainingObjective: 0.693147,
  };

  const baseValidation = {
    contractVersion: 'mlb-model-validation-evaluation-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    evaluationId: 'model-1::validation-v1',
    modelId: 'model-1',
    planId: 'plan-1',
    matrixId: 'matrix-1',
    configId: 'config-1',
    split: 'VALIDATION',
    rowCount: 2,
    metrics: { logLoss: 0.693147, brierScore: 0.25, rocAuc: 0.5 },
  };

  const baseTest = {
    contractVersion: 'mlb-model-test-evaluation-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    evaluationId: 'model-1::test-v1',
    modelId: 'model-1',
    planId: 'plan-1',
    matrixId: 'matrix-1',
    configId: 'config-1',
    split: 'TEST',
    rowCount: 2,
    metrics: { logLoss: 0.693147, brierScore: 0.25, rocAuc: 0.5 },
  };

  const baseRelease = {
    contractVersion: 'mlb-model-release-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    releaseId: 'model-1::offline-release-candidate-v1',
    modelId: 'model-1',
    planId: 'plan-1',
    matrixId: 'matrix-1',
    configId: 'config-1',
    manifestId: 'manifest-1',
    datasetId: 'dataset-1',
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    validationEvaluationId: 'model-1::validation-v1',
    testEvaluationId: 'model-1::test-v1',
    configurationLockStatus: 'LOCKED_BEFORE_TEST_EVALUATION',
    testEvaluationPolicy: 'HELD_OUT_TEST_FINAL_EVALUATION_V1',
    releaseStatus: 'OFFLINE_RELEASE_CANDIDATE_NOT_DEPLOYED',
  };

  return {
    contractVersion: 'mlb-model-test-release-result-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    resultId: 'plan-1::test-release-v1',
    fitValidation: {
      contractVersion: 'mlb-model-fit-validation-result-v1',
      sport: 'MLB',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
      resultId: 'plan-1::fit-validation-v1',
      model: { ...baseModel, ...(overrides.model ?? {}) },
      validation: { ...baseValidation, ...(overrides.validation ?? {}) },
    },
    test: { ...baseTest, ...(overrides.test ?? {}) },
    release: { ...baseRelease, ...(overrides.release ?? {}) },
  } as Record<string, unknown>;
}

function buildValidManifest(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    contractVersion: 'mlb-feature-manifest-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    manifestId: 'manifest-1',
    features: [
      {
        featureId: 'p_1',
        sectionId: 'sec-1',
        payloadPath: ['home', 'p_1'],
        valueKind: 'NUMBER',
        missingPolicy: 'REJECT',
        defaultValue: null,
        ...((overrides.features as Record<string, unknown>[] | undefined)?.[0] ?? {}),
      },
      {
        featureId: 'p_2',
        sectionId: 'sec-1',
        payloadPath: ['away', 'p_2'],
        valueKind: 'NUMBER',
        missingPolicy: 'REJECT',
        defaultValue: null,
        ...((overrides.features as Record<string, unknown>[] | undefined)?.[1] ?? {}),
      },
    ],
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidSnapshot(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    contractVersion: MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    snapshotId: 'snapshot-1',
    capturedAt: FROZEN_CAPTURED_AT,
    dataCutoffAt: FROZEN_DATA_CUTOFF,
    game: {
      gameId: 'game-1',
      scheduledStartAt: FROZEN_SCHEDULED_START,
      officialDate: '2026-07-15',
      season: 2026,
      gameType: 'REGULAR_SEASON',
      status: 'SCHEDULED',
      homeTeamId: 'home-1',
      awayTeamId: 'away-1',
      venueId: 'venue-1',
      neutralSite: false,
      doubleheader: null,
      ...(overrides.game as Record<string, unknown> | undefined ?? {}),
    },
    startingPitchers: {
      home: {
        state: 'PROBABLE',
        pitcherId: 'p-1',
        announcedAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
        ...((overrides.startingPitchers as Record<string, Record<string, unknown>> | undefined)?.home ?? {}),
      },
      away: {
        state: 'PROBABLE',
        pitcherId: 'p-2',
        announcedAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-away'],
        ...((overrides.startingPitchers as Record<string, Record<string, unknown>> | undefined)?.away ?? {}),
      },
    },
    sourceReferences: [
      {
        sourceRefId: 'src-away',
        sourceName: 'MLB Stats API',
        sourceCategory: 'OFFICIAL',
        roles: ['STARTING_PITCHER'],
        providerRecordId: null,
        fetchedAt: FROZEN_CAPTURED_AT,
        sourceUpdatedAt: FROZEN_DATA_CUTOFF,
      },
      {
        sourceRefId: 'src-official',
        sourceName: 'MLB Stats API',
        sourceCategory: 'OFFICIAL',
        roles: ['GAME_IDENTITY'],
        providerRecordId: null,
        fetchedAt: FROZEN_CAPTURED_AT,
        sourceUpdatedAt: FROZEN_DATA_CUTOFF,
      },
    ],
    sections: [
      {
        sectionId: 'sec-1',
        kind: 'GAME_CONTEXT',
        entity: { scope: 'GAME', entityId: null },
        status: 'AVAILABLE',
        asOfAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
        payload: { home: { p_1: 1 }, away: { p_2: 1 } },
        ...((overrides.sections as Record<string, unknown>[] | undefined)?.[0] ?? {}),
      },
    ],
    dataCompleteness: 'COMPLETE',
    warnings: [],
    ...overrides,
  } as Record<string, unknown>;
}

function expectValidLockedInputs(
  releasedModelResult: unknown,
  featureManifest: unknown,
  snapshot: unknown,
): void {
  const releaseValidation = validateMLBModelTestReleaseResult(releasedModelResult);
  expect(releaseValidation.ok).toBe(true);
  if (releaseValidation.ok) {
    expect(
      validateMLBModelFitValidationResult(releaseValidation.value.fitValidation).ok,
    ).toBe(true);
    expect(validateMLBModelTestEvaluation(releaseValidation.value.test).ok).toBe(true);
    expect(validateMLBModelReleaseRecord(releaseValidation.value.release).ok).toBe(true);
  }
  expect(validateMLBFeatureManifest(featureManifest).ok).toBe(true);
  expect(validateMLBCanonicalPregameSnapshot(snapshot).ok).toBe(true);
}

function buildOrchestratorInput(
  releasedModelResult: unknown,
  repoRoot: string,
  overrides: Partial<MLBShadowQuarantineOrchestratorInput> = {},
): MLBShadowQuarantineOrchestratorInput {
  return {
    repoRoot,
    shadowRecordId: 'synthetic-shadow-001',
    gamePk: 990000001,
    predictionGeneratedAt: '2026-07-15T18:40:00Z',
    releasedModelResult,
    featureManifest: buildValidManifest(),
    snapshot: buildValidSnapshot(),
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/*  Mock store-result helpers                                                  */
/* -------------------------------------------------------------------------- */

function mockPersistedResult(
  shadowRecordId = 'synthetic-shadow-001',
): MLBShadowPredictionPersistenceResult {
  return {
    ok: true,
    status: 'PERSISTED',
    storeVersion: MLB_SHADOW_MONITORING_PREDICTION_STORE_VERSION,
    artifactCreated: true,
    tempCleanupFailed: false,
    shadowRecordId,
    gamePk: 990000001,
    relativePath: 'var/mlb-development/mlb-shadow-monitoring/quarantine/predictions/abc123.json',
    verificationOk: true,
    issues: [],
  };
}

function mockAlreadyExistsResult(
  shadowRecordId = 'synthetic-shadow-001',
): MLBShadowPredictionPersistenceResult {
  return {
    ok: false,
    status: 'ALREADY_EXISTS',
    storeVersion: MLB_SHADOW_MONITORING_PREDICTION_STORE_VERSION,
    artifactCreated: false,
    shadowRecordId: shadowRecordId,
    gamePk: 990000001,
    relativePath: null,
    verificationOk: null,
    issues: [],
  };
}

function mockVerificationFailedResult(
  shadowRecordId = 'synthetic-shadow-001',
): MLBShadowPredictionPersistenceResult {
  return {
    ok: false,
    status: 'VERIFICATION_FAILED',
    storeVersion: MLB_SHADOW_MONITORING_PREDICTION_STORE_VERSION,
    artifactCreated: true,
    tempCleanupFailed: false,
    shadowRecordId: shadowRecordId,
    gamePk: 990000001,
    relativePath: 'var/mlb-development/mlb-shadow-monitoring/quarantine/predictions/abc123.json',
    verificationOk: false,
    issues: [],
  };
}

function mockStoreFailureResult(
  status: Exclude<MLBShadowPredictionFailureStatus, 'ALREADY_EXISTS' | 'VERIFICATION_FAILED'>,
): MLBShadowPredictionPersistenceResult {
  return {
    ok: false,
    status,
    storeVersion: MLB_SHADOW_MONITORING_PREDICTION_STORE_VERSION,
    artifactCreated: false,
    shadowRecordId: null,
    gamePk: null,
    relativePath: null,
    verificationOk: null,
    issues: [],
  };
}

/* -------------------------------------------------------------------------- */
/*  Forbidden-field lists for security assertions                            */
/* -------------------------------------------------------------------------- */

const SENSITIVE_PREDICTION_FIELDS = [
  'predictedWinner',
  'predictedSide',
  'homeWinProbability',
  'awayWinProbability',
  'decisionPolicy',
  'payloadHash',
  'payload',
  'relativePath',
  'modelFingerprint',
  'modelSha256',
  'issues',
];

/* -------------------------------------------------------------------------- */
/*  Artifact path helper                                                       */
/* -------------------------------------------------------------------------- */

function artifactPathFor(repoRoot: string, shadowRecordId: string): string {
  const hash = createHash('sha256').update(shadowRecordId, 'utf-8').digest('hex');
  return join(repoRoot, MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE, hash + '.json');
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('mlb-shadow-monitoring-prediction-orchestrator (L5E2S)', () => {
  /* ========================================================================== */
  /*  A. Successful orchestration                                              */
  /* ========================================================================== */

  describe('A. successful orchestration', () => {
    /* 1. successful orchestration returns ok:true safe operational record */
    it('1. successful orchestration returns ok:true safe operational record', async () => {
      const repoRoot = await trackedTempDir('orch-test-1-');
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);

      const input = buildOrchestratorInput(released, repoRoot);
      const result = await orchestrateMLBShadowQuarantinePrediction(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.contractVersion).toBe(
          'mlb-shadow-monitoring-operational-record-v1',
        );
        expect(result.value.pipelineStatus).toBe('QUARANTINE_PERSISTED');
        expect(result.value.failureCode ?? null).toBeNull();
        expect(result.value.predictionPayloadGenerated).toBe(true);
        expect(result.value.predictionPayloadSchemaValid).toBe(true);
      }
    });

    /* 2. successful orchestration persists a prediction artifact under temp repoRoot */
    it('2. successful orchestration persists a prediction artifact under temp repoRoot', async () => {
      const repoRoot = await trackedTempDir('orch-test-2-');
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);

      const input = buildOrchestratorInput(released, repoRoot);
      const result = await orchestrateMLBShadowQuarantinePrediction(input);

      expect(result.ok).toBe(true);

      // Artifact must exist at the canonical temp path
      const artifactPath = artifactPathFor(repoRoot, 'synthetic-shadow-001');
      await expect(fs.access(artifactPath)).resolves.toBeUndefined();
    });

    /* 3. public return contains no predictedWinner */
    /* 4. public return contains no predictedSide */
    /* 5. public return contains no homeWinProbability */
    /* 6. public return contains no awayWinProbability */
    /* 7. public return contains no decisionPolicy */
    /* 8. public return contains no payloadHash */
    /* 9. public return contains no model fingerprint */
    /* 10. public return contains no quarantine payload */
    /* 11. public return contains no quarantine relativePath */
    /* 12. public return contains no raw computation issues */
    /* 13. public return contains no raw store issues */
    it('3-13. public return contains no sensitive prediction or persistence fields', async () => {
      const repoRoot = await trackedTempDir('orch-test-3-');
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);

      const input = buildOrchestratorInput(released, repoRoot);
      const result = await orchestrateMLBShadowQuarantinePrediction(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const recordKeys = Object.keys(result.value);

        // Field-level checks
        for (const field of SENSITIVE_PREDICTION_FIELDS) {
          expect(recordKeys).not.toContain(field);
        }
        expect(result.value).not.toHaveProperty('predictedWinner');
        expect(result.value).not.toHaveProperty('predictedSide');
        expect(result.value).not.toHaveProperty('homeWinProbability');
        expect(result.value).not.toHaveProperty('awayWinProbability');
        expect(result.value).not.toHaveProperty('decisionPolicy');
        expect(result.value).not.toHaveProperty('payloadHash');
        expect(result.value).not.toHaveProperty('predictedSide');
        expect(result.value).not.toHaveProperty('payload');
        expect(result.value).not.toHaveProperty('relativePath');
        expect(result.value).not.toHaveProperty('modelFingerprint');
        expect(result.value).not.toHaveProperty('modelSha256');

        // JSON-level checks — sensitive values must not appear anywhere
        const json = JSON.stringify(result.value);
        expect(json).not.toContain('HOME');
        expect(json).not.toContain('AWAY');
        expect(json).not.toContain('MAX_PROBABILITY');
        expect(json).not.toContain('predictedWinner');
        expect(json).not.toContain('predictedSide');
        expect(json).not.toContain('homeWinProbability');
        expect(json).not.toContain('awayWinProbability');
        expect(json).not.toContain('decisionPolicy');
        expect(json).not.toContain('payloadHash');
        expect(json).not.toContain('relativePath');

        // Issues must not be present on success
        expect(result.value).not.toHaveProperty('issues');
      }
    });
  });

  /* ========================================================================== */
  /*  B. Compute failure                                                      */
  /* ========================================================================== */

  describe('B. compute failure → no persistence', () => {
    /* 14. computation failure prevents persistence */
    it('14. computation failure prevents persistence', async () => {
      const repoRoot = await trackedTempDir('orch-test-14-');
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      // Verifier NOT overridden → real verifier rejects synthetic model.
      const input = buildOrchestratorInput(released, repoRoot);
      const result = await orchestrateMLBShadowQuarantinePrediction(input);

      expect(result.ok).toBe(true);
      expect(vi.mocked(persistMLBShadowQuarantinedPrediction)).not.toHaveBeenCalled();

      // No artifact on disk
      const artifactPath = artifactPathFor(repoRoot, 'synthetic-shadow-001');
      await expect(fs.access(artifactPath)).rejects.toThrow();
    });

    /* 15. computation failure maps to fixed generic PREDICTION_COMPUTE_FAILED */
    it('15. computation failure maps to PREDICTION_COMPUTE_FAILED', async () => {
      const repoRoot = await trackedTempDir('orch-test-15-');
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      const input = buildOrchestratorInput(released, repoRoot);
      const result = await orchestrateMLBShadowQuarantinePrediction(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.pipelineStatus).toBe('PREDICTION_COMPUTE_FAILED');
        expect(result.value.failureCode).toBe('PREDICTION_COMPUTE_FAILED');
        expect(result.value.predictionPayloadGenerated).toBe(false);
        expect(result.value.predictionPayloadSchemaValid).toBe(false);
      }
      expect(vi.mocked(persistMLBShadowQuarantinedPrediction)).not.toHaveBeenCalled();
    });
  });

  /* ========================================================================== */
  /*  C. Caller cannot forge derived operational status                       */
  /* ========================================================================== */

  describe('C. caller cannot forge derived operational status', () => {
    function buildForgedInput(
      repoRoot: string,
    ): MLBShadowQuarantineOrchestratorInput {
      // Construct an input with extra forged fields, then cast away the
      // type error (as unknown as) to simulate a malicious caller.
      const base = buildOrchestratorInput(buildValidReleaseResult(), repoRoot);
      const forged = {
        ...base,
        pipelineStatus: 'HACKED_STATUS',
        failureCode: 'HACKED_CODE',
        predictionPayloadGenerated: true,
        predictionPayloadSchemaValid: true,
      };
      return forged as unknown as MLBShadowQuarantineOrchestratorInput;
    }

    /* 16. caller cannot supply/forge predictionPayloadGenerated */
    it('16. caller cannot forge predictionPayloadGenerated', async () => {
      const repoRoot = await trackedTempDir('orch-test-16-');
      const input = buildForgedInput(repoRoot);

      // Verifier not overridden → compute fails.
      const result = await orchestrateMLBShadowQuarantinePrediction(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Compute failure → must be false, not the forged true.
        expect(result.value.predictionPayloadGenerated).toBe(false);
      }
    });

    /* 17. caller cannot supply/forge predictionPayloadSchemaValid */
    it('17. caller cannot forge predictionPayloadSchemaValid', async () => {
      const repoRoot = await trackedTempDir('orch-test-17-');
      const input = buildForgedInput(repoRoot);

      const result = await orchestrateMLBShadowQuarantinePrediction(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.predictionPayloadSchemaValid).toBe(false);
      }
    });

    /* 18. caller cannot supply/forge pipelineStatus */
    it('18. caller cannot forge pipelineStatus', async () => {
      const repoRoot = await trackedTempDir('orch-test-18-');
      const input = buildForgedInput(repoRoot);

      const result = await orchestrateMLBShadowQuarantinePrediction(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.pipelineStatus).toBe('PREDICTION_COMPUTE_FAILED');
      }
    });

    /* 19. caller cannot supply/forge failureCode */
    it('19. caller cannot forge failureCode', async () => {
      const repoRoot = await trackedTempDir('orch-test-19-');
      const input = buildForgedInput(repoRoot);

      const result = await orchestrateMLBShadowQuarantinePrediction(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.failureCode).toBe('PREDICTION_COMPUTE_FAILED');
      }
    });
  });

  /* ========================================================================== */
  /*  D. Store status mapping                                                  */
  /* ========================================================================== */

  describe('D. store status mapping', () => {
    /* 20. successful persistence maps to QUARANTINE_PERSISTED */
    it('20. successful persistence maps to QUARANTINE_PERSISTED', async () => {
      const repoRoot = await trackedTempDir('orch-test-20-');
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);

      const input = buildOrchestratorInput(released, repoRoot);
      const result = await orchestrateMLBShadowQuarantinePrediction(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.pipelineStatus).toBe('QUARANTINE_PERSISTED');
        expect(result.value.failureCode ?? null).toBeNull();
        expect(result.value.predictionPayloadGenerated).toBe(true);
        expect(result.value.predictionPayloadSchemaValid).toBe(true);
      }
    });

    /* 21. identical retry returns IDEMPOTENT_IDENTICAL_SUCCESS -> QUARANTINE_PERSISTED */
    it('21. identical retry maps to QUARANTINE_PERSISTED (idempotent no-op)', async () => {
      const repoRoot = await trackedTempDir('orch-test-21-');
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);

      const input = buildOrchestratorInput(released, repoRoot);

      // First call — persists successfully.
      const first = await orchestrateMLBShadowQuarantinePrediction(input);
      expect(first.ok).toBe(true);
      if (first.ok) {
        expect(first.value.pipelineStatus).toBe('QUARANTINE_PERSISTED');
      }

      // Second call — identical retry: store returns IDEMPOTENT_IDENTICAL_SUCCESS.
      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);
      const second = await orchestrateMLBShadowQuarantinePrediction(input);
      expect(second.ok).toBe(true);
      if (second.ok) {
        expect(second.value.pipelineStatus).toBe('QUARANTINE_PERSISTED');
        expect(second.value.failureCode ?? null).toBeNull();
        expect(second.value.predictionPayloadGenerated).toBe(true);
        expect(second.value.predictionPayloadSchemaValid).toBe(true);
      }
    });

    /* 22. duplicate execution does not overwrite original artifact */
    it('22. duplicate execution does not overwrite original artifact', async () => {
      const repoRoot = await trackedTempDir('orch-test-22-');
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);

      const input = buildOrchestratorInput(released, repoRoot);

      // First call — persists successfully.
      await orchestrateMLBShadowQuarantinePrediction(input);

      const artifactPath = artifactPathFor(repoRoot, 'synthetic-shadow-001');
      const originalBytes = await fs.readFile(artifactPath, 'utf-8');

      // Reset verifier mock for second call.
      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);

      // Second call — should get ALREADY_EXISTS, NOT overwrite.
      const second = await orchestrateMLBShadowQuarantinePrediction(input);
      expect(second.ok).toBe(true);

      const unchangedBytes = await fs.readFile(artifactPath, 'utf-8');
      expect(unchangedBytes).toBe(originalBytes);
    });

    /* 23. duplicate execution does not read/unblind existing artifact */
    it('23. duplicate execution does not read/unblind existing artifact', async () => {
      const repoRoot = await trackedTempDir('orch-test-23-');
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);

      const input = buildOrchestratorInput(released, repoRoot);

      // First call.
      const first = await orchestrateMLBShadowQuarantinePrediction(input);
      expect(first.ok).toBe(true);

      // Second call — reset verifier mock.
      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);
      const second = await orchestrateMLBShadowQuarantinePrediction(input);
      expect(second.ok).toBe(true);
      if (second.ok) {
        // Return must be operational record only — no prediction data.
        const json = JSON.stringify(second.value);
        expect(json).not.toContain('HOME');
        expect(json).not.toContain('AWAY');
        expect(json).not.toContain('MAX_PROBABILITY');
        expect(json).not.toContain('0.6');
        expect(json).not.toContain('0.4');
        expect(second.value).not.toHaveProperty('predictedWinner');
        expect(second.value).not.toHaveProperty('predictedSide');
        expect(second.value).not.toHaveProperty('homeWinProbability');
        expect(second.value).not.toHaveProperty('awayWinProbability');
      }
    });

    /* DIFFERENT-PAYLOAD SAME-ID returns QUARANTINE_ALREADY_EXISTS_DUPLICATE (safe record) */
    it('DIFFERENT-PAYLOAD SAME-ID returns QUARANTINE_ALREADY_EXISTS_DUPLICATE with safe record', async () => {
      const repoRoot = await trackedTempDir('orch-test-different-payload-');
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      // Same repoRoot, same shadowRecordId, same gamePk — first call persists.
      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);
      const input1 = buildOrchestratorInput(released, repoRoot);
      const first = await orchestrateMLBShadowQuarantinePrediction(input1);
      expect(first.ok).toBe(true);
      if (first.ok) {
        expect(first.value.pipelineStatus).toBe('QUARANTINE_PERSISTED');
      }

      // Same id + same gamePk, but a DIFFERENT predictionGeneratedAt. The
      // artifact path is keyed on shadowRecordId, so the second call targets
      // the same file; canonical bytes differ -> store fails closed with
      // ALREADY_EXISTS (no overwrite, no retry).
      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);
      const input2 = buildOrchestratorInput(released, repoRoot, {
        predictionGeneratedAt: '2026-07-15T19:00:00Z',
      });
      const second = await orchestrateMLBShadowQuarantinePrediction(input2);
      expect(second.ok).toBe(true);
      if (second.ok) {
        expect(second.value.pipelineStatus).toBe(
          'QUARANTINE_ALREADY_EXISTS_DUPLICATE',
        );
        expect(second.value.failureCode).toBe('ALREADY_EXISTS');
        expect(second.value.predictionPayloadGenerated).toBe(true);
        expect(second.value.predictionPayloadSchemaValid).toBe(true);

        // Safe public result must not leak any sensitive/persistence fields.
        const FORBIDDEN_FIELDS = [
          'predictedWinner',
          'predictedSide',
          'homeWinProbability',
          'awayWinProbability',
          'payloadHash',
          'relativePath',
        ];
        const recordKeys = Object.keys(second.value);
        for (const field of FORBIDDEN_FIELDS) {
          expect(recordKeys).not.toContain(field);
        }
        expect(second.value).not.toHaveProperty('predictedWinner');
        expect(second.value).not.toHaveProperty('predictedSide');
        expect(second.value).not.toHaveProperty('homeWinProbability');
        expect(second.value).not.toHaveProperty('awayWinProbability');
        expect(second.value).not.toHaveProperty('payloadHash');
        expect(second.value).not.toHaveProperty('relativePath');
        const json = JSON.stringify(second.value);
        expect(json).not.toContain('predictedWinner');
        expect(json).not.toContain('predictedSide');
        expect(json).not.toContain('homeWinProbability');
        expect(json).not.toContain('awayWinProbability');
        expect(json).not.toContain('payloadHash');
        expect(json).not.toContain('relativePath');
      }
    });

    /* STABLE-RETRY IDENTICAL-INPUT returns deep-equal operational records */
    it('STABLE-RETRY IDENTICAL-INPUT returns deep-equal operational records', async () => {
      const repoRoot = await trackedTempDir('orch-test-stable-retry-');
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      // Stable logical request / stable integration input — identical both calls.
      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);
      const input = buildOrchestratorInput(released, repoRoot);

      // First call — persists successfully (writes canonical artifact bytes).
      const first = await orchestrateMLBShadowQuarantinePrediction(input);
      expect(first.ok).toBe(true);

      // Second call — identical retry: store returns IDEMPOTENT_IDENTICAL_SUCCESS.
      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);
      const second = await orchestrateMLBShadowQuarantinePrediction(input);
      expect(second.ok).toBe(true);

      if (first.ok && second.ok) {
        expect(first.value.pipelineStatus).toBe('QUARANTINE_PERSISTED');
        expect(second.value.pipelineStatus).toBe('QUARANTINE_PERSISTED');
        expect(first.value.failureCode ?? null).toBeNull();
        expect(second.value.failureCode ?? null).toBeNull();

        // The safe operational read must be byte-for-byte identical across the
        // stable retry — no store-derived variance leaks into the public record.
        const STABLE_RETRY_OPERATIONAL_RECORDS_IDENTICAL =
          JSON.stringify(first.value) === JSON.stringify(second.value);
        expect(STABLE_RETRY_OPERATIONAL_RECORDS_IDENTICAL).toBe(true);
        expect(first.value).toEqual(second.value);
      }
    });

    /* 24. VERIFICATION_FAILED + artifactCreated:true maps to QUARANTINE_VERIFICATION_FAILED */
    it('24. VERIFICATION_FAILED + artifactCreated:true maps to QUARANTINE_VERIFICATION_FAILED', async () => {
      const repoRoot = await trackedTempDir('orch-test-24-');
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);

      // Mock readFile to return mismatched bytes → store read-back verification fails.
      vi.mocked(fs.readFile).mockResolvedValueOnce('mismatched-canonical-bytes');

      const input = buildOrchestratorInput(released, repoRoot);
      const result = await orchestrateMLBShadowQuarantinePrediction(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.pipelineStatus).toBe('QUARANTINE_VERIFICATION_FAILED');
        expect(result.value.failureCode).toBe('VERIFICATION_FAILED');
        expect(result.value.predictionPayloadGenerated).toBe(true);
        expect(result.value.predictionPayloadSchemaValid).toBe(true);
      }
    });

    /* 25. verification-failed artifact remains present */
    it('25. verification-failed artifact remains present', async () => {
      const repoRoot = await trackedTempDir('orch-test-25-');
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);
      vi.mocked(fs.readFile).mockResolvedValueOnce('mismatched-canonical-bytes');

      const input = buildOrchestratorInput(released, repoRoot);
      await orchestrateMLBShadowQuarantinePrediction(input);

      // The artifact MUST still exist on disk — not deleted.
      const artifactPath = artifactPathFor(repoRoot, 'synthetic-shadow-001');
      await expect(fs.access(artifactPath)).resolves.toBeUndefined();
    });

    /* 26. verification-failed artifact is not deleted/rewritten */
    it('26. verification-failed artifact is not deleted/rewritten', async () => {
      const repoRoot = await trackedTempDir('orch-test-26-');
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);
      // Mock readFile so store writes artifact but read-back verification fails.
      vi.mocked(fs.readFile).mockResolvedValueOnce('mismatched-canonical-bytes');

      const input = buildOrchestratorInput(released, repoRoot);
      const result = await orchestrateMLBShadowQuarantinePrediction(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.pipelineStatus).toBe('QUARANTINE_VERIFICATION_FAILED');
        expect(result.value.failureCode).toBe('VERIFICATION_FAILED');
      }

      // Store was called exactly once — no retry, no rewrite, no rollback.
      expect(
        vi.mocked(persistMLBShadowQuarantinedPrediction),
      ).toHaveBeenCalledTimes(1);

      // Artifact remains present on disk — not deleted.
      const artifactPath = artifactPathFor(repoRoot, 'synthetic-shadow-001');
      await expect(fs.access(artifactPath)).resolves.toBeUndefined();
    });

    /* 27. other allowlisted store failure maps to QUARANTINE_WRITE_FAILED */
    it('27. PAYLOAD_HASH_MISMATCH maps to QUARANTINE_WRITE_FAILED with allowlisted code', async () => {
      const repoRoot = await trackedTempDir('orch-test-27-');
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);

      // Mock store to return PAYLOAD_HASH_MISMATCH.
      vi.mocked(persistMLBShadowQuarantinedPrediction).mockReset();
      vi.mocked(persistMLBShadowQuarantinedPrediction).mockResolvedValueOnce(
        mockStoreFailureResult('PAYLOAD_HASH_MISMATCH'),
      );

      const input = buildOrchestratorInput(released, repoRoot);
      const result = await orchestrateMLBShadowQuarantinePrediction(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.pipelineStatus).toBe('QUARANTINE_WRITE_FAILED');
        expect(result.value.failureCode).toBe('PAYLOAD_HASH_MISMATCH');
        expect(result.value.predictionPayloadGenerated).toBe(true);
        expect(result.value.predictionPayloadSchemaValid).toBe(true);
      }
    });

    /* 28. unknown/unexpected store failure cannot pass arbitrary text into failureCode */
    it('28. unknown store failure cannot pass arbitrary text into failureCode', async () => {
      const repoRoot = await trackedTempDir('orch-test-28-');
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);

      // Mock store to return an unrecognized status (simulating a future store).
      const unexpectedResult = {
        ok: false,
        status: 'UNEXPECTED_FUTURE_STATUS',
        storeVersion: MLB_SHADOW_MONITORING_PREDICTION_STORE_VERSION,
        artifactCreated: false,
        shadowRecordId: null,
        gamePk: null,
        relativePath: null,
        verificationOk: null,
        issues: [],
      } as unknown as MLBShadowPredictionPersistenceResult;

      vi.mocked(persistMLBShadowQuarantinedPrediction).mockReset();
      vi.mocked(persistMLBShadowQuarantinedPrediction).mockResolvedValueOnce(unexpectedResult);

      const input = buildOrchestratorInput(released, repoRoot);
      const result = await orchestrateMLBShadowQuarantinePrediction(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.pipelineStatus).toBe('QUARANTINE_WRITE_FAILED');
        expect(result.value.failureCode).toBe('QUARANTINE_WRITE_FAILED');
        expect(result.value.failureCode).not.toBe('UNEXPECTED_FUTURE_STATUS');
      }
    });
  });

  /* ========================================================================== */
  /*  E. Locked scientific policy                                             */
  /* ========================================================================== */

  describe('E. locked scientific policy', () => {
    /* 29. locked scientific policy fields remain builder-owned */
    it('29. locked scientific policy fields remain builder-owned', async () => {
      const repoRoot = await trackedTempDir('orch-test-29-');
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);

      const input = buildOrchestratorInput(released, repoRoot);
      const result = await orchestrateMLBShadowQuarantinePrediction(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.contractVersion).toBe(
          'mlb-shadow-monitoring-operational-record-v1',
        );
        expect(result.value.mode).toBe(
          MLB_SHADOW_MONITORING_OPERATIONAL_MODE_S1_OPERATIONAL_BLIND,
        );
        expect(result.value.scientificUse).toBe(
          MLB_SHADOW_MONITORING_SCIENTIFIC_USE_NONE,
        );
        expect(result.value.isProspectiveHoldoutEvidence).toBe(false);
        expect(result.value.eligibleForFutureValidation).toBe(false);
        expect(result.value.eligibleForFutureTest).toBe(false);
      }
    });

    /* 30. sourceCandidateFingerprint remains recipe fingerprint only, never model coefficient fingerprint */
    it('30. sourceCandidateFingerprint remains recipe fingerprint only', async () => {
      const repoRoot = await trackedTempDir('orch-test-30-');
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);

      const input = buildOrchestratorInput(released, repoRoot);
      const result = await orchestrateMLBShadowQuarantinePrediction(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // The recipe fingerprint is a fixed constant, NOT the model's
        // coefficient hash.  It must be exactly the candidate-003 recipe id.
        expect(result.value.sourceCandidateRecipeId).toBe('mlb-v1-inner-candidate-003');
        expect(result.value.sourceCandidateFingerprint).toBe(
          'ce35df51cdf38ed9bf91aa2fb78871443f259c963d8c2700e8b6fe5d960a95bc',
        );
        // The recipe fingerprint is the ONLY sourceCandidateFingerprint
        // permitted — it must be the frozen recipe constant, not any model
        // coefficient hash from the released model result.
      }
    });
  });

  /* ========================================================================== */
  /*  F. Filesystem safety                                                    */
  /* ========================================================================== */

  describe('F. filesystem safety', () => {
    /* 31. temporary repoRoot only */
    it('31. temporary repoRoot only — no files outside temp root', async () => {
      const repoRoot = await trackedTempDir('orch-test-31-');
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);

      const input = buildOrchestratorInput(released, repoRoot);
      const result = await orchestrateMLBShadowQuarantinePrediction(input);

      expect(result.ok).toBe(true);

      // Artifact path must be within repoRoot.
      const artifactPath = artifactPathFor(repoRoot, 'synthetic-shadow-001');
      expect(artifactPath.startsWith(repoRoot)).toBe(true);

      // repoRoot top-level should only contain 'var'.
      const rootContents = await fs.readdir(repoRoot);
      expect(rootContents).toEqual(['var']);

      // Production var/ must NOT exist.
      const prodPath = join(
        process.cwd(),
        'var',
        'mlb-development',
        'mlb-shadow-monitoring',
      );
      await expect(fs.access(prodPath)).rejects.toThrow();
    });

    /* 32. production shadow runtime remains empty */
    it('32. production shadow runtime remains empty', async () => {
      const repoRoot = await trackedTempDir('orch-test-32-');
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);

      const input = buildOrchestratorInput(released, repoRoot);
      await orchestrateMLBShadowQuarantinePrediction(input);

      // Production namespace must not exist.
      const prodPath = join(
        process.cwd(),
        'var',
        'mlb-development',
        'mlb-shadow-monitoring',
      );
      await expect(fs.access(prodPath)).rejects.toThrow();
    });
  });
});
