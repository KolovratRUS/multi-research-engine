/* -------------------------------------------------------------------------- */
/*  L5E2U outer-persistence orchestrator test suite                            */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  Module mocks (factory wraps real — unit tests override, whole-call        */
/*  tests use the restored real implementation.)                             */
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
      inferMLBOfflinePregameWinner: vi.fn(actual.inferMLBOfflinePregameWinner),
    };
  },
);

vi.mock(
  '@/prediction/mlb/mlb-shadow-monitoring-prediction-orchestrator',
  async (importActual) => {
    const actual = await importActual<
      typeof import('@/prediction/mlb/mlb-shadow-monitoring-prediction-orchestrator')
    >();
    return {
      ...actual,
      orchestrateMLBShadowQuarantinePrediction: vi.fn(
        actual.orchestrateMLBShadowQuarantinePrediction,
      ),
    };
  },
);

vi.mock(
  '@/prediction/mlb/mlb-shadow-monitoring-operational-store',
  async (importActual) => {
    const actual = await importActual<
      typeof import('@/prediction/mlb/mlb-shadow-monitoring-operational-store')
    >();
    return {
      ...actual,
      persistMLBShadowMonitoringPredictionOperationalRecord: vi.fn(
        actual.persistMLBShadowMonitoringPredictionOperationalRecord,
      ),
    };
  },
);

/* -------------------------------------------------------------------------- */
/*  Imports                                                                   */
/* -------------------------------------------------------------------------- */

import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from 'vitest';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

/* -- Mocked modules (value imports get the mock wrapper) -- */
import { verifyMLBShadowCandidate003AuthoritativeModel } from '@/prediction/mlb/mlb-shadow-model-fingerprint';
import {
  inferMLBOfflinePregameWinner,
  type MLBOfflinePregameInference,
} from '@/prediction/mlb/mlb-offline-pregame-inference-contract';
import {
  orchestrateMLBShadowQuarantinePrediction,
  type MLBShadowQuarantineOrchestratorInput,
} from '@/prediction/mlb/mlb-shadow-monitoring-prediction-orchestrator';
import {
  persistMLBShadowMonitoringPredictionOperationalRecord,
  MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION,
  type MLBShadowOperationalPersistenceResult,
  type MLBShadowOperationalFailureStatus,
} from '@/prediction/mlb/mlb-shadow-monitoring-operational-store';

/* -- Module under test (L5E2U) -- */
import {
  orchestrateMLBShadowMonitoringPredictionPersistence,
  MLB_SHADOW_MONITORING_PERSISTENCE_ORCHESTRATOR_VERSION,
  type MLBShadowMonitoringPredictionPersistenceIntegrationResult,
} from '@/prediction/mlb/mlb-shadow-monitoring-persistence-orchestrator';

/* -- Non-mocked validation modules for fixture building -- */
import {
  validateMLBModelTestReleaseResult,
  validateMLBModelTestEvaluation,
  validateMLBModelReleaseRecord,
} from '@/prediction/mlb/mlb-model-test-release-contract';
import { validateMLBModelFitValidationResult } from '@/prediction/mlb/mlb-logistic-regression-fit-contract';
import { validateMLBFeatureManifest } from '@/prediction/mlb/mlb-feature-vector-contract';
import {
  validateMLBCanonicalPregameSnapshot,
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';
import { validateMLBShadowMonitoringOperationalRecord } from '@/prediction/mlb/mlb-shadow-monitoring-record-contract';
import type {
  MLBShadowMonitoringOperationalRecord,
  MLBShadowMonitoringOperationalRecordValidationResult,
} from '@/prediction/mlb/mlb-shadow-monitoring-record-contract';

/* -- Namespace + projection -- */
import {
  MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE,
  MLB_SHADOW_MONITORING_OPERATIONAL_NAMESPACE,
} from '@/prediction/mlb/mlb-shadow-monitoring-namespace';
import {
  buildMLBShadowPredictionOperationalRecord,
} from '@/prediction/mlb/mlb-shadow-monitoring-operational-projection';
import type { MLBShadowPredictionOperationalRecordInput } from '@/prediction/mlb/mlb-shadow-monitoring-operational-projection';

/* -------------------------------------------------------------------------- */
/*  Real implementation references (captured in beforeAll)                   */
/* -------------------------------------------------------------------------- */

type VerifyFn = typeof verifyMLBShadowCandidate003AuthoritativeModel;
type InferFn = typeof inferMLBOfflinePregameWinner;
type OrchestrateSFn = typeof orchestrateMLBShadowQuarantinePrediction;
type PersistTFn = typeof persistMLBShadowMonitoringPredictionOperationalRecord;

let realVerify: VerifyFn;
let realInfer: InferFn;
let realOrchestrateS: OrchestrateSFn;
let realPersistT: PersistTFn;

beforeAll(async () => {
  const fp = await vi.importActual<
    typeof import('@/prediction/mlb/mlb-shadow-model-fingerprint')
  >('@/prediction/mlb/mlb-shadow-model-fingerprint');
  realVerify = fp.verifyMLBShadowCandidate003AuthoritativeModel;

  const inf = await vi.importActual<
    typeof import('@/prediction/mlb/mlb-offline-pregame-inference-contract')
  >('@/prediction/mlb/mlb-offline-pregame-inference-contract');
  realInfer = inf.inferMLBOfflinePregameWinner;

  const orchS = await vi.importActual<
    typeof import('@/prediction/mlb/mlb-shadow-monitoring-prediction-orchestrator')
  >('@/prediction/mlb/mlb-shadow-monitoring-prediction-orchestrator');
  realOrchestrateS = orchS.orchestrateMLBShadowQuarantinePrediction;

  const storeT = await vi.importActual<
    typeof import('@/prediction/mlb/mlb-shadow-monitoring-operational-store')
  >('@/prediction/mlb/mlb-shadow-monitoring-operational-store');
  realPersistT = storeT.persistMLBShadowMonitoringPredictionOperationalRecord;
});

beforeEach(() => {
  vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReset();
  vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockImplementation(realVerify);

  vi.mocked(inferMLBOfflinePregameWinner).mockReset();
  vi.mocked(inferMLBOfflinePregameWinner).mockImplementation(realInfer);

  vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockReset();
  vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockImplementation(realOrchestrateS);

  vi.mocked(persistMLBShadowMonitoringPredictionOperationalRecord).mockReset();
  vi.mocked(persistMLBShadowMonitoringPredictionOperationalRecord).mockImplementation(realPersistT);
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
/*  Frozen test timestamps                                                    */
/* -------------------------------------------------------------------------- */

const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';
const FROZEN_PREDICTION_GENERATED_AT = '2026-07-15T18:40:00Z';
const SHADOW_RECORD_ID = 'synthetic-shadow-001';
const GAME_PK = 990000001;

/* -------------------------------------------------------------------------- */
/*  Fixture builders (adapted from L5E2S test file)                           */
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
      model: { ...baseModel, ...(overrides.model as Record<string, unknown> | undefined) },
      validation: { ...baseValidation, ...(overrides.validation as Record<string, unknown> | undefined) },
    },
    test: { ...baseTest, ...(overrides.test as Record<string, unknown> | undefined) },
    release: { ...baseRelease, ...(overrides.release as Record<string, unknown> | undefined) },
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
      },
      {
        featureId: 'p_2',
        sectionId: 'sec-1',
        payloadPath: ['away', 'p_2'],
        valueKind: 'NUMBER',
        missingPolicy: 'REJECT',
        defaultValue: null,
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
    },
    startingPitchers: {
      home: {
        state: 'PROBABLE',
        pitcherId: 'p-1',
        announcedAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
      },
      away: {
        state: 'PROBABLE',
        pitcherId: 'p-2',
        announcedAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-away'],
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
      },
    ],
    dataCompleteness: 'COMPLETE',
    warnings: [],
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
    shadowRecordId: SHADOW_RECORD_ID,
    gamePk: GAME_PK,
    predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
    releasedModelResult,
    featureManifest: buildValidManifest(),
    snapshot: buildValidSnapshot(),
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/*  L5E2T mock-result factories                                              */
/* -------------------------------------------------------------------------- */

function mockOPersist(
  shadowRecordId: string | null = SHADOW_RECORD_ID,
  tempCleanupFailed = false,
): MLBShadowOperationalPersistenceResult {
  return {
    ok: true,
    storeVersion: MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION,
    status: 'PERSISTED',
    artifactCreated: true,
    verificationOk: true,
    tempCleanupFailed,
    shadowRecordId: shadowRecordId ?? '',
    stage: 'PREDICTION',
  };
}

function mockOPersistWithCleanupWarning(
  shadowRecordId: string | null = SHADOW_RECORD_ID,
): MLBShadowOperationalPersistenceResult {
  return {
    ok: true,
    storeVersion: MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION,
    status: 'PERSISTED_WITH_CLEANUP_WARNING',
    artifactCreated: true,
    verificationOk: true,
    tempCleanupFailed: true,
    shadowRecordId: shadowRecordId ?? '',
    stage: 'PREDICTION',
  };
}

function mockOIdempotent(
  shadowRecordId: string | null = SHADOW_RECORD_ID,
  tempCleanupFailed = false,
): MLBShadowOperationalPersistenceResult {
  return {
    ok: true,
    storeVersion: MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION,
    status: 'IDEMPOTENT_IDENTICAL_SUCCESS',
    artifactCreated: false,
    verificationOk: true,
    tempCleanupFailed,
    shadowRecordId: shadowRecordId ?? '',
    stage: 'PREDICTION',
  };
}

function mockOAlreadyExists(
  shadowRecordId: string | null = SHADOW_RECORD_ID,
): MLBShadowOperationalPersistenceResult {
  return {
    ok: false,
    storeVersion: MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION,
    status: 'ALREADY_EXISTS',
    artifactCreated: false,
    verificationOk: false,
    tempCleanupFailed: false,
    shadowRecordId: shadowRecordId ?? null,
    stage: 'PREDICTION',
  };
}

function mockOVerificationFailed(
  shadowRecordId: string | null = SHADOW_RECORD_ID,
  tempCleanupFailed = false,
): MLBShadowOperationalPersistenceResult {
  return {
    ok: false,
    storeVersion: MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION,
    status: 'VERIFICATION_FAILED',
    artifactCreated: true,
    verificationOk: false,
    tempCleanupFailed,
    shadowRecordId: shadowRecordId ?? '',
    stage: 'PREDICTION',
  };
}

function mockOPreFinalizationFailure(
  status: MLBShadowOperationalFailureStatus,
  shadowRecordId: string | null = SHADOW_RECORD_ID,
): MLBShadowOperationalPersistenceResult {
  return {
    ok: false,
    storeVersion: MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION,
    status,
    artifactCreated: false,
    verificationOk: false,
    tempCleanupFailed: false,
    shadowRecordId,
    stage: 'PREDICTION',
  };
}

/* -------------------------------------------------------------------------- */
/*  L5E2S mock-result helpers                                                 */
/* -------------------------------------------------------------------------- */

function mockSInvalid(): MLBShadowMonitoringOperationalRecordValidationResult {
  return validateMLBShadowMonitoringOperationalRecord(null);
}

function mockSValid(
  record: MLBShadowMonitoringOperationalRecord,
): MLBShadowMonitoringOperationalRecordValidationResult {
  return { ok: true, value: record };
}

/* -------------------------------------------------------------------------- */
/*  Safe-record builder for unit tests                                        */
/* -------------------------------------------------------------------------- */

function buildValidSafeRecord(
  overrides: MLBShadowPredictionOperationalRecordInput = {},
): MLBShadowMonitoringOperationalRecord {
  const result = buildMLBShadowPredictionOperationalRecord({
    shadowRecordId: SHADOW_RECORD_ID,
    gamePk: GAME_PK,
    officialDate: '2026-07-15',
    scheduledStartAt: FROZEN_SCHEDULED_START,
    predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
    pipelineStatus: 'QUARANTINE_PERSISTED',
    failureCode: null,
    latencyMs: 5000,
    featureManifestId: 'manifest-1',
    featureManifestFingerprint: null,
    timingReferenceContractVersion: 'mlb-offline-pregame-inference-v1',
    timingReferenceCutoffAt: FROZEN_DATA_CUTOFF,
    predictionPayloadGenerated: true,
    predictionPayloadSchemaValid: true,
    ...overrides,
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Fixture: safe record validation failed');
  return result.value;
}

/* -------------------------------------------------------------------------- */
/*  Unit-test input builder (L5E2S is mocked, so opaque inputs are fine)       */
/* -------------------------------------------------------------------------- */

function buildUnitTestInput(
  overrides: Partial<MLBShadowQuarantineOrchestratorInput> = {},
): MLBShadowQuarantineOrchestratorInput {
  return {
    repoRoot: '/tmp/test-unit',
    shadowRecordId: SHADOW_RECORD_ID,
    gamePk: GAME_PK,
    predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
    releasedModelResult: {},
    featureManifest: {},
    snapshot: {},
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/*  Artifact-path helpers (for whole-call tests)                              */
/* -------------------------------------------------------------------------- */

function predictionHashFor(shadowRecordId: string): string {
  return createHash('sha256').update(shadowRecordId, 'utf-8').digest('hex');
}

function predictionArtifactPathFor(
  repoRoot: string,
  shadowRecordId: string,
): string {
  return join(
    repoRoot,
    MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE,
    predictionHashFor(shadowRecordId) + '.json',
  );
}

function operationalArtifactPathFor(
  repoRoot: string,
  shadowRecordId: string,
): string {
  return join(
    repoRoot,
    MLB_SHADOW_MONITORING_OPERATIONAL_NAMESPACE,
    predictionHashFor(shadowRecordId) + '__prediction.json',
  );
}

async function countFiles(dir: string): Promise<number> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isFile()).length;
}

/* -------------------------------------------------------------------------- */
/*  Forbidden public fields (for firewall tests)                             */
/* -------------------------------------------------------------------------- */

const FORBIDDEN_PUBLIC_FIELDS = [
  'predictedWinner',
  'predictedSide',
  'homeWinProbability',
  'awayWinProbability',
  'decisionPolicy',
  'payloadHash',
  'modelFingerprint',
  'fittedModelFingerprint',
  'relativePath',
  'issues',
  'error',
  'message',
  'outcome',
  'correct',
  'correctness',
  'grading',
  'performance',
] as const;

function extractAllKeys(obj: unknown, seen = new Set<unknown>()): string[] {
  if (typeof obj !== 'object' || obj === null) return [];
  if (seen.has(obj)) return [];
  seen.add(obj);
  if (Array.isArray(obj)) {
    return obj.flatMap((item) => extractAllKeys(item, seen));
  }
  return Object.keys(obj).flatMap((key) => [
    key,
    ...extractAllKeys((obj as Record<string, unknown>)[key], seen),
  ]);
}

/* ========================================================================== */
/*  UNIT TESTS — mocked L5E2S + mocked L5E2T                                  */
/* ========================================================================== */

describe('L5E2U — unit tests with mocked L5E2S + mocked L5E2T', () => {
  /* ------------------------------------------------------------------ */
  /*  Section 4: Fixed status-mapping                                     */
  /* ------------------------------------------------------------------ */

  describe('Section 4 — status mapping for every L5E2T result class', () => {
    type MappingCase = {
      label: string;
      storeResult: MLBShadowOperationalPersistenceResult;
      expectedStatus: string;
      expectedOk: boolean;
      expectedArtifactCreated: boolean;
      expectedVerificationOk: boolean;
      expectedTempCleanupFailed: boolean;
    };

    const safeRecord = buildValidSafeRecord();
    const releasedModelResult = buildValidReleaseResult();

    const cases: MappingCase[] = [
      {
        label: 'PERSISTED',
        storeResult: mockOPersist(),
        expectedStatus: 'OPERATIONAL_PERSISTED',
        expectedOk: true,
        expectedArtifactCreated: true,
        expectedVerificationOk: true,
        expectedTempCleanupFailed: false,
      },
      {
        label: 'PERSISTED_WITH_CLEANUP_WARNING',
        storeResult: mockOPersistWithCleanupWarning(),
        expectedStatus: 'OPERATIONAL_PERSISTED_WITH_CLEANUP_WARNING',
        expectedOk: true,
        expectedArtifactCreated: true,
        expectedVerificationOk: true,
        expectedTempCleanupFailed: true,
      },
      {
        label: 'IDEMPOTENT_IDENTICAL_SUCCESS',
        storeResult: mockOIdempotent(),
        expectedStatus: 'OPERATIONAL_IDEMPOTENT_IDENTICAL_SUCCESS',
        expectedOk: true,
        expectedArtifactCreated: false,
        expectedVerificationOk: true,
        expectedTempCleanupFailed: false,
      },
      {
        label: 'ALREADY_EXISTS',
        storeResult: mockOAlreadyExists(),
        expectedStatus: 'OPERATIONAL_ALREADY_EXISTS_DIFFERENT',
        expectedOk: false,
        expectedArtifactCreated: false,
        expectedVerificationOk: false,
        expectedTempCleanupFailed: false,
      },
      {
        label: 'VERIFICATION_FAILED (artifactCreated=true)',
        storeResult: mockOVerificationFailed(SHADOW_RECORD_ID, false),
        expectedStatus: 'OPERATIONAL_VERIFICATION_FAILED',
        expectedOk: false,
        expectedArtifactCreated: true,
        expectedVerificationOk: false,
        expectedTempCleanupFailed: false,
      },
    ];

    const preFinalizationStatuses: MLBShadowOperationalFailureStatus[] = [
      'VALIDATION_FAILED',
      'INVALID_STAGE_STATE',
      'SHADOW_RECORD_ID_NULL',
      'SYMLINK_DETECTED',
      'NON_DIRECTORY_TARGET',
      'REPO_ROOT_INVALID',
      'WRITE_ERROR',
      'UNKNOWN_ERROR',
    ];

    for (const status of preFinalizationStatuses) {
      cases.push({
        label: status,
        storeResult: mockOPreFinalizationFailure(status, SHADOW_RECORD_ID),
        expectedStatus: 'OPERATIONAL_PRE_FINALIZATION_FAILED',
        expectedOk: false,
        expectedArtifactCreated: false,
        expectedVerificationOk: false,
        expectedTempCleanupFailed: false,
      });
    }

    for (const c of cases) {
      it(`L5E2T "${c.label}" → integration "${c.expectedStatus}"`, async () => {
        const input = buildUnitTestInput();
        vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
          mockSValid(safeRecord),
        );
        vi.mocked(persistMLBShadowMonitoringPredictionOperationalRecord).mockResolvedValue(
          c.storeResult,
        );

        const result = await orchestrateMLBShadowMonitoringPredictionPersistence(input);

        expect(result.status).toBe(c.expectedStatus);
        expect(result.ok).toBe(c.expectedOk);
        expect(result.operationalArtifactCreated).toBe(c.expectedArtifactCreated);
        expect(result.operationalVerificationOk).toBe(c.expectedVerificationOk);
        expect(result.operationalTempCleanupFailed).toBe(c.expectedTempCleanupFailed);
        expect(result.operationalRecord).toBe(safeRecord);
        expect(result.operationalPersistenceAttempted).toBe(true);
      });
    }

    /* -- Unknown future / unrecognized status fails safely -- */
    it('unknown future L5E2T status → OPERATIONAL_PRE_FINALIZATION_FAILED (no raw leakage)', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
        mockSValid(safeRecord),
      );

      const futureResult = {
        ok: false,
        storeVersion: MLB_SHADOW_MONITORING_OPERATIONAL_STORE_VERSION,
        status: 'FUTURE_UNKNOWN_STATUS',
        artifactCreated: false,
        verificationOk: false,
        tempCleanupFailed: false,
        shadowRecordId: SHADOW_RECORD_ID,
        stage: 'PREDICTION' as const,
      } as unknown as MLBShadowOperationalPersistenceResult;

      vi.mocked(persistMLBShadowMonitoringPredictionOperationalRecord).mockResolvedValue(
        futureResult,
      );

      const result = await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      expect(result.status).toBe('OPERATIONAL_PRE_FINALIZATION_FAILED');
      expect(result.ok).toBe(false);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Section 5: L5E2S invalid → no L5E2T call                          */
  /* ------------------------------------------------------------------ */

  describe('Section 5 — L5E2S returns ok=false', () => {
    it('returns OPERATIONAL_RECORD_INVALID with all flags false', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
        mockSInvalid(),
      );
      vi.mocked(persistMLBShadowMonitoringPredictionOperationalRecord).mockResolvedValue(
        mockOPersist(),
      );

      const result = await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      expect(result.status).toBe('OPERATIONAL_RECORD_INVALID');
      expect(result.ok).toBe(false);
      expect(result.operationalRecord).toBeNull();
      expect(result.operationalPersistenceAttempted).toBe(false);
      expect(result.operationalArtifactCreated).toBe(false);
      expect(result.operationalVerificationOk).toBe(false);
      expect(result.operationalTempCleanupFailed).toBe(false);
    });

    it('L5E2T call count = 0 when L5E2S invalid', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
        mockSInvalid(),
      );

      await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      expect(persistMLBShadowMonitoringPredictionOperationalRecord).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Section 6: Identity mismatch                                        */
  /* ------------------------------------------------------------------ */

  describe('Section 6 — identity mismatch (shadowRecordId / gamePk)', () => {
    it('shadowRecordId mismatch → OPERATIONAL_RECORD_IDENTITY_MISMATCH', async () => {
      const input = buildUnitTestInput();
      const mismatchedRecord = buildValidSafeRecord({
        shadowRecordId: 'different-shadow-id',
        gamePk: GAME_PK,
        predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
        pipelineStatus: 'QUARANTINE_PERSISTED',
        failureCode: null,
        predictionPayloadGenerated: true,
        predictionPayloadSchemaValid: true,
      });
      vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
        mockSValid(mismatchedRecord),
      );
      vi.mocked(persistMLBShadowMonitoringPredictionOperationalRecord).mockResolvedValue(
        mockOPersist(),
      );

      const result = await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      expect(result.status).toBe('OPERATIONAL_RECORD_IDENTITY_MISMATCH');
      expect(result.ok).toBe(false);
      expect(result.operationalRecord).toBeNull();
      expect(result.operationalPersistenceAttempted).toBe(false);
    });

    it('gamePk mismatch → OPERATIONAL_RECORD_IDENTITY_MISMATCH', async () => {
      const input = buildUnitTestInput();
      const mismatchedRecord = buildValidSafeRecord({
        shadowRecordId: SHADOW_RECORD_ID,
        gamePk: 880000002,
        predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
        pipelineStatus: 'QUARANTINE_PERSISTED',
        failureCode: null,
        predictionPayloadGenerated: true,
        predictionPayloadSchemaValid: true,
      });
      vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
        mockSValid(mismatchedRecord),
      );

      const result = await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      expect(result.status).toBe('OPERATIONAL_RECORD_IDENTITY_MISMATCH');
      expect(result.ok).toBe(false);
      expect(result.operationalPersistenceAttempted).toBe(false);
    });

    it('L5E2T call count = 0 when identity mismatch', async () => {
      const input = buildUnitTestInput();
      const mismatchedRecord = buildValidSafeRecord({
        shadowRecordId: 'different-shadow-id',
        gamePk: GAME_PK,
        predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
        pipelineStatus: 'QUARANTINE_PERSISTED',
        failureCode: null,
        predictionPayloadGenerated: true,
        predictionPayloadSchemaValid: true,
      });
      vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
        mockSValid(mismatchedRecord),
      );

      await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      expect(persistMLBShadowMonitoringPredictionOperationalRecord).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Section 7: Call counts                                            */
  /* ------------------------------------------------------------------ */

  describe('Section 7 — call-count guarantees', () => {
    it('L5E2S called exactly once per invocation (eligible path)', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
        mockSValid(buildValidSafeRecord()),
      );
      vi.mocked(persistMLBShadowMonitoringPredictionOperationalRecord).mockResolvedValue(
        mockOPersist(),
      );

      await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      expect(orchestrateMLBShadowQuarantinePrediction).toHaveBeenCalledTimes(1);
    });

    it('L5E2T called exactly once when eligible', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
        mockSValid(buildValidSafeRecord()),
      );
      vi.mocked(persistMLBShadowMonitoringPredictionOperationalRecord).mockResolvedValue(
        mockOPersist(),
      );

      await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      expect(persistMLBShadowMonitoringPredictionOperationalRecord).toHaveBeenCalledTimes(1);
    });

    it('L5E2T called zero times when L5E2S invalid', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
        mockSInvalid(),
      );

      await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      expect(persistMLBShadowMonitoringPredictionOperationalRecord).toHaveBeenCalledTimes(0);
      expect(orchestrateMLBShadowQuarantinePrediction).toHaveBeenCalledTimes(1);
    });

    it('L5E2T called zero times when identity mismatch', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
        mockSValid(buildValidSafeRecord({ shadowRecordId: 'other' })),
      );

      await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      expect(persistMLBShadowMonitoringPredictionOperationalRecord).toHaveBeenCalledTimes(0);
      expect(orchestrateMLBShadowQuarantinePrediction).toHaveBeenCalledTimes(1);
    });

    it('no retry loop — L5E2S never called twice', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
        mockSValid(buildValidSafeRecord()),
      );
      vi.mocked(persistMLBShadowMonitoringPredictionOperationalRecord).mockResolvedValue(
        mockOPersist(),
      );

      await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      expect(orchestrateMLBShadowQuarantinePrediction).toHaveBeenCalledTimes(1);
      expect(persistMLBShadowMonitoringPredictionOperationalRecord).toHaveBeenCalledTimes(1);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Section 8: Safe-truth metadata projection                          */
  /* ------------------------------------------------------------------ */

  describe('Section 8 — safe-truth metadata projection', () => {
    it('VERIFICATION_FAILED with artifactCreated=true preserves artifactCreated=true', async () => {
      const input = buildUnitTestInput();
      const safeRecord = buildValidSafeRecord();
      vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
        mockSValid(safeRecord),
      );
      vi.mocked(persistMLBShadowMonitoringPredictionOperationalRecord).mockResolvedValue(
        mockOVerificationFailed(SHADOW_RECORD_ID, false),
      );

      const result = await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      expect(result.status).toBe('OPERATIONAL_VERIFICATION_FAILED');
      expect(result.ok).toBe(false);
      expect(result.operationalArtifactCreated).toBe(true);
      expect(result.operationalVerificationOk).toBe(false);
      expect(result.operationalTempCleanupFailed).toBe(false);
    });

    it('VERIFICATION_FAILED with tempCleanupFailed=true preserves tempCleanupFailed=true', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
        mockSValid(buildValidSafeRecord()),
      );
      vi.mocked(persistMLBShadowMonitoringPredictionOperationalRecord).mockResolvedValue(
        mockOVerificationFailed(SHADOW_RECORD_ID, true),
      );

      const result = await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      expect(result.operationalTempCleanupFailed).toBe(true);
    });

    it('PERSISTED preserves verificationOk=true', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
        mockSValid(buildValidSafeRecord()),
      );
      vi.mocked(persistMLBShadowMonitoringPredictionOperationalRecord).mockResolvedValue(
        mockOPersist(),
      );

      const result = await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      expect(result.operationalVerificationOk).toBe(true);
      expect(result.operationalArtifactCreated).toBe(true);
    });

    it('IDEMPOTENT_IDENTICAL_SUCCESS preserves artifactCreated=false', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
        mockSValid(buildValidSafeRecord()),
      );
      vi.mocked(persistMLBShadowMonitoringPredictionOperationalRecord).mockResolvedValue(
        mockOIdempotent(),
      );

      const result = await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      expect(result.operationalArtifactCreated).toBe(false);
      expect(result.operationalVerificationOk).toBe(true);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Section 9: Cleanup-warning remains successful                     */
  /* ------------------------------------------------------------------ */

  describe('Section 9 — cleanup warning stays successful', () => {
    it('PERSISTED_WITH_CLEANUP_WARNING is ok=true with tempCleanupFailed=true', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
        mockSValid(buildValidSafeRecord()),
      );
      vi.mocked(persistMLBShadowMonitoringPredictionOperationalRecord).mockResolvedValue(
        mockOPersistWithCleanupWarning(),
      );

      const result = await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      expect(result.ok).toBe(true);
      expect(result.status).toBe('OPERATIONAL_PERSISTED_WITH_CLEANUP_WARNING');
      expect(result.operationalTempCleanupFailed).toBe(true);
    });

    it('IDEMPOTENT_IDENTICAL_SUCCESS with tempCleanupFailed=true stays ok=true', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
        mockSValid(buildValidSafeRecord()),
      );
      vi.mocked(persistMLBShadowMonitoringPredictionOperationalRecord).mockResolvedValue(
        mockOIdempotent(SHADOW_RECORD_ID, true),
      );

      const result = await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      expect(result.ok).toBe(true);
      expect(result.status).toBe('OPERATIONAL_IDEMPOTENT_IDENTICAL_SUCCESS');
      expect(result.operationalTempCleanupFailed).toBe(true);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Section 10: Operational record retained on L5E2T failure          */
  /* ------------------------------------------------------------------ */

  describe('Section 10 — safe operational record retained on T-failure', () => {
    for (const { label, storeResult } of [
      { label: 'ALREADY_EXISTS', storeResult: mockOAlreadyExists() },
      { label: 'VERIFICATION_FAILED', storeResult: mockOVerificationFailed() },
      { label: 'WRITE_ERROR', storeResult: mockOPreFinalizationFailure('WRITE_ERROR') },
    ]) {
      it(`"${label}" retains validated safe record with ok=false`, async () => {
        const input = buildUnitTestInput();
        const safeRecord = buildValidSafeRecord();
        vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
          mockSValid(safeRecord),
        );
        vi.mocked(persistMLBShadowMonitoringPredictionOperationalRecord).mockResolvedValue(
          storeResult,
        );

        const result = await orchestrateMLBShadowMonitoringPredictionPersistence(input);

        expect(result.ok).toBe(false);
        expect(result.operationalRecord).toBe(safeRecord);
        expect(result.operationalPersistenceAttempted).toBe(true);

        /* Prediction-pipeline truth inside record is unchanged. */
        expect(result.operationalRecord?.pipelineStatus).toBe(safeRecord.pipelineStatus);
        expect(result.operationalRecord?.failureCode).toBe(safeRecord.failureCode);
      });
    }
  });

  /* ------------------------------------------------------------------ */
  /*  Section 11: Public firewall — no sensitive fields leaked          */
  /* ------------------------------------------------------------------ */

  describe('Section 11 — public firewall (no sensitive field leakage)', () => {
    it('serializing the outer result never exposes sensitive fields', async () => {
      const input = buildUnitTestInput();
      const safeRecord = buildValidSafeRecord();
      vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
        mockSValid(safeRecord),
      );
      vi.mocked(persistMLBShadowMonitoringPredictionOperationalRecord).mockResolvedValue(
        mockOPersist(),
      );

      const result = await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      const serialized = JSON.parse(JSON.stringify(result));
      const allKeys = extractAllKeys(serialized);
      const leaked = FORBIDDEN_PUBLIC_FIELDS.filter((f) => allKeys.includes(f));
      expect(leaked).toEqual([]);
    });

    it('operationalRecord still exposes safe pipeline fields', async () => {
      const input = buildUnitTestInput();
      const safeRecord = buildValidSafeRecord();
      vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
        mockSValid(safeRecord),
      );
      vi.mocked(persistMLBShadowMonitoringPredictionOperationalRecord).mockResolvedValue(
        mockOPersist(),
      );

      const result = await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      expect(result.operationalRecord).not.toBeNull();
      expect(result.operationalRecord!.pipelineStatus).toBe(safeRecord.pipelineStatus);
      expect(result.operationalRecord!.failureCode).toBe(safeRecord.failureCode);
    });

    it('L5E2S invalid path never exposes sensitive fields either', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
        mockSInvalid(),
      );

      const result = await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      const serialized = JSON.parse(JSON.stringify(result));
      const allKeys = extractAllKeys(serialized);
      const leaked = FORBIDDEN_PUBLIC_FIELDS.filter((f) => allKeys.includes(f));
      expect(leaked).toEqual([]);
    });

    it('identity-mismatch path never exposes sensitive fields', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePrediction).mockResolvedValue(
        mockSValid(
          buildValidSafeRecord({ shadowRecordId: 'different-shadow-id' }),
        ),
      );

      const result = await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      const serialized = JSON.parse(JSON.stringify(result));
      const allKeys = extractAllKeys(serialized);
      const leaked = FORBIDDEN_PUBLIC_FIELDS.filter((f) => allKeys.includes(f));
      expect(leaked).toEqual([]);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Section 12: Real synthetic whole-call — first call (L5E1U-C1)    */
  /* ------------------------------------------------------------------ */

  describe('Section 12 — real whole-call first invocation', () => {
    it('first call produces OPERATIONAL_PERSISTED with one artifact per store', async () => {
      const repoRoot = await trackedTempDir('l5e2u-whole-');
      const releasedModelResult = buildValidReleaseResult();
      expectValidLockedInputs(releasedModelResult, buildValidManifest(), buildValidSnapshot());

      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValue(true);

      const input = buildOrchestratorInput(releasedModelResult, repoRoot);
      const result =
        await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      expect(result.ok).toBe(true);
      expect(result.status).toBe('OPERATIONAL_PERSISTED');
      expect(result.operationalPersistenceAttempted).toBe(true);

      /* Exactly one prediction artifact. */
      const predDir = join(repoRoot, MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE);
      expect(await countFiles(predDir)).toBe(1);

      /* Exactly one operational artifact. */
      const opDir = join(repoRoot, MLB_SHADOW_MONITORING_OPERATIONAL_NAMESPACE);
      expect(await countFiles(opDir)).toBe(1);

      /* operationalRecord is retained and has the expected pipeline status. */
      expect(result.operationalRecord).not.toBeNull();
      expect(result.operationalRecord!.pipelineStatus).toBe('QUARANTINE_PERSISTED');
      expect(result.operationalRecord!.failureCode).toBeNull();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Section 13: Real synthetic — stable retry idempotency             */
  /* ------------------------------------------------------------------ */

  describe('Section 13 — stable retry idempotency', () => {
    it('same stable input → OPERATIONAL_IDEMPOTENT_IDENTICAL_SUCCESS (L5E2T)', async () => {
      const repoRoot = await trackedTempDir('l5e2u-idem-');
      const releasedModelResult = buildValidReleaseResult();

      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValue(true);

      const input = buildOrchestratorInput(releasedModelResult, repoRoot);

      /* First call — persists. */
      const first =
        await orchestrateMLBShadowMonitoringPredictionPersistence(input);
      expect(first.status).toBe('OPERATIONAL_PERSISTED');
      expect(first.ok).toBe(true);

      const firstRecord: unknown = first.operationalRecord;

      /* Capture artifact bytes before retry. */
      const predPath = predictionArtifactPathFor(repoRoot, SHADOW_RECORD_ID);
      const opPath = operationalArtifactPathFor(repoRoot, SHADOW_RECORD_ID);
      const predBytesBefore = await fs.readFile(predPath, 'utf-8');
      const opBytesBefore = await fs.readFile(opPath, 'utf-8');

      /* Second call — same stable input. */
      const second =
        await orchestrateMLBShadowMonitoringPredictionPersistence(input);
      expect(second.status).toBe('OPERATIONAL_IDEMPOTENT_IDENTICAL_SUCCESS');
      expect(second.ok).toBe(true);

      /* operationalRecord unchanged. */
      expect(second.operationalRecord).toStrictEqual(firstRecord);

      /* Artifacts unchanged. */
      const predBytesAfter = await fs.readFile(predPath, 'utf-8');
      const opBytesAfter = await fs.readFile(opPath, 'utf-8');
      expect(predBytesAfter).toBe(predBytesBefore);
      expect(opBytesAfter).toBe(opBytesBefore);

      /* Still one artifact in each store. */
      const predDir = join(repoRoot, MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE);
      const opDir = join(repoRoot, MLB_SHADOW_MONITORING_OPERATIONAL_NAMESPACE);
      expect(await countFiles(predDir)).toBe(1);
      expect(await countFiles(opDir)).toBe(1);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Section 14: Different payload, same ID                              */
  /* ------------------------------------------------------------------ */

  describe('Section 14 — different payload, same ID', () => {
    it('second call different predictionGeneratedAt → ALREADY_EXISTS (no overwrite)', async () => {
      const repoRoot = await trackedTempDir('l5e2u-diff-');
      const releasedModelResult = buildValidReleaseResult();

      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValue(true);

      const firstInput = buildOrchestratorInput(releasedModelResult, repoRoot);

      /* First call — persists. */
      const first =
        await orchestrateMLBShadowMonitoringPredictionPersistence(firstInput);
      expect(first.status).toBe('OPERATIONAL_PERSISTED');
      expect(first.ok).toBe(true);

      const predPath = predictionArtifactPathFor(repoRoot, SHADOW_RECORD_ID);
      const opPath = operationalArtifactPathFor(repoRoot, SHADOW_RECORD_ID);
      const predBytesBefore = await fs.readFile(predPath, 'utf-8');
      const opBytesBefore = await fs.readFile(opPath, 'utf-8');

      /* Second call — same ID, same gamePk, different predictionGeneratedAt. */
      const secondInput = buildOrchestratorInput(releasedModelResult, repoRoot, {
        predictionGeneratedAt: '2026-07-15T19:00:00Z',
      });

      const second =
        await orchestrateMLBShadowMonitoringPredictionPersistence(secondInput);

      expect(second.ok).toBe(false);
      expect(second.status).toBe('OPERATIONAL_ALREADY_EXISTS_DIFFERENT');

      /* L5E2S mapped the store ALREADY_EXISTS to the pipeline safe record. */
      expect(second.operationalRecord).not.toBeNull();
      expect(second.operationalRecord!.pipelineStatus).toBe(
        'QUARANTINE_ALREADY_EXISTS_DUPLICATE',
      );
      expect(second.operationalRecord!.failureCode).toBe('ALREADY_EXISTS');

      /* Original artifacts remain unchanged — no overwrite. */
      const predBytesAfter = await fs.readFile(predPath, 'utf-8');
      const opBytesAfter = await fs.readFile(opPath, 'utf-8');
      expect(predBytesAfter).toBe(predBytesBefore);
      expect(opBytesAfter).toBe(opBytesBefore);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Section 15: Partial-state — prediction persists, ops fails         */
  /* ------------------------------------------------------------------ */

  describe('Section 15 — partial-state failure (prediction OK, ops fails)', () => {
    it('operational dir is a file → L5E2T NON_DIRECTORY_TARGET fails closed', async () => {
      const repoRoot = await trackedTempDir('l5e2u-partial-');
      const releasedModelResult = buildValidReleaseResult();

      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValue(true);

      /* Pre-create the operational path as a FILE (not directory) to force
         L5E2T's ancestor audit to return NON_DIRECTORY_TARGET.
         L5E2R writes to the sibling quarantine/predictions path, so prediction
         persistence still succeeds. */
      const shadowRoot = join(repoRoot, 'var/mlb-development/mlb-shadow-monitoring');
      await fs.mkdir(shadowRoot, { recursive: true });
      await fs.writeFile(join(shadowRoot, 'operational'), 'blocked');

      const input = buildOrchestratorInput(releasedModelResult, repoRoot);
      const result =
        await orchestrateMLBShadowMonitoringPredictionPersistence(input);

      expect(result.ok).toBe(false);
      expect(result.status).toBe('OPERATIONAL_PRE_FINALIZATION_FAILED');
      expect(result.operationalPersistenceAttempted).toBe(true);

      /* Prediction artifact remains present — no rollback. */
      const predDir = join(repoRoot, MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE);
      expect(await countFiles(predDir)).toBe(1);

      /* No operational artifact was created. */
      const opDirPath = join(shadowRoot, 'operational');
      const stat = await fs.lstat(opDirPath);
      expect(stat.isFile()).toBe(true);
      /* The operational directory was never created — it is still a file. */
    });
  });
});
