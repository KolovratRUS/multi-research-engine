import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

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
/*  No production bypass is introduced — mocks exist ONLY in this test file.   */
/* -------------------------------------------------------------------------- */

vi.mock(
  '@/prediction/mlb/mlb-shadow-model-fingerprint',
  async (importActual) => {
    const actual = await importActual<typeof import('@/prediction/mlb/mlb-shadow-model-fingerprint')>();
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

/* -------------------------------------------------------------------------- */
/*  Imports                                                                   */
/* -------------------------------------------------------------------------- */

// Mocked modules — these are vi.fn wrappers
import { verifyMLBShadowCandidate003AuthoritativeModel } from '@/prediction/mlb/mlb-shadow-model-fingerprint';
import {
  inferMLBOfflinePregameWinner,
  type MLBOfflinePregameInference,
  type MLBOfflinePregameInferenceIssue,
} from '@/prediction/mlb/mlb-offline-pregame-inference-contract';

// Production module under test — NOT mocked
import {
  computeMLBShadowQuarantinedPrediction,
  type MLBShadowQuarantinedPredictionInput,
} from '@/prediction/mlb/mlb-shadow-monitoring-prediction-computation';

// Non-mocked validation modules for input verification
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

/* -------------------------------------------------------------------------- */
/*  Frozen test timestamps                                                    */
/* -------------------------------------------------------------------------- */

const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';

/* -------------------------------------------------------------------------- */
/*  Real implementations captured for mock restoration                      */
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

let realVerify: VerifyFn;
let realInfer: InferFn;

beforeAll(async () => {
  const fp = await vi.importActual<
    typeof import('@/prediction/mlb/mlb-shadow-model-fingerprint')
  >('@/prediction/mlb/mlb-shadow-model-fingerprint');
  realVerify = fp.verifyMLBShadowCandidate003AuthoritativeModel as VerifyFn;

  const inf = await vi.importActual<
    typeof import('@/prediction/mlb/mlb-offline-pregame-inference-contract')
  >('@/prediction/mlb/mlb-offline-pregame-inference-contract');
  realInfer = inf.inferMLBOfflinePregameWinner as unknown as InferFn;
});

beforeEach(() => {
  // Restore real implementations after any mockReturnValue override.
  vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReset();
  vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockImplementation(realVerify);
  vi.mocked(inferMLBOfflinePregameWinner).mockReset();
  vi.mocked(inferMLBOfflinePregameWinner).mockImplementation(realInfer);
});

/* -------------------------------------------------------------------------- */
/*  Test helpers — adapted from the inference-contract test file               */
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
    metrics: {
      logLoss: 0.693147,
      brierScore: 0.25,
      rocAuc: 0.5,
    },
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
    metrics: {
      logLoss: 0.693147,
      brierScore: 0.25,
      rocAuc: 0.5,
    },
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
        entity: {
          scope: 'GAME',
          entityId: null,
        },
        status: 'AVAILABLE',
        asOfAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
        payload: {
          home: { p_1: 1 },
          away: { p_2: 1 },
        },
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

function makeInput(
  releasedModelResult: unknown,
  overrides: Partial<MLBShadowQuarantinedPredictionInput> = {},
): MLBShadowQuarantinedPredictionInput {
  return {
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
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('mlb-shadow-monitoring-prediction-computation', () => {
  describe('A. Real verifier negative tests', () => {
    it('synthetic structurally valid model rejected by frozen-model gate', () => {
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      const input = makeInput(released);
      const result = computeMLBShadowQuarantinedPrediction(input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.length).toBeGreaterThan(0);
        const issue = result.issues[0];
        expect(issue.path).toBe('$.releasedModelResult.fitValidation.model');
      }
      // Inference must never be reached when fingerprint verification fails.
      expect(vi.mocked(inferMLBOfflinePregameWinner)).not.toHaveBeenCalled();
    });

    it('same metadata + coefficient changed rejected', () => {
      const released = buildValidReleaseResult({
        model: {
          coefficients: [
            { featureId: 'p_1', valueCoefficient: 0.001, missingIndicatorCoefficient: 0 },
            { featureId: 'p_2', valueCoefficient: 0, missingIndicatorCoefficient: 0 },
          ],
        },
      });
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      const input = makeInput(released);
      const result = computeMLBShadowQuarantinedPrediction(input);

      expect(result.ok).toBe(false);
      expect(vi.mocked(inferMLBOfflinePregameWinner)).not.toHaveBeenCalled();
    });

    it('same metadata + intercept changed rejected', () => {
      const released = buildValidReleaseResult({
        model: { intercept: 0.001 },
      });
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      const input = makeInput(released);
      const result = computeMLBShadowQuarantinedPrediction(input);

      expect(result.ok).toBe(false);
      expect(vi.mocked(inferMLBOfflinePregameWinner)).not.toHaveBeenCalled();
    });

    it('wrong modelId rejected', () => {
      const released = buildValidReleaseResult({
        model: { modelId: 'candidate-999' },
      });
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      const input = makeInput(released);
      const result = computeMLBShadowQuarantinedPrediction(input);

      expect(result.ok).toBe(false);
      expect(vi.mocked(inferMLBOfflinePregameWinner)).not.toHaveBeenCalled();
    });

    it('wrong matrixId rejected', () => {
      const released = buildValidReleaseResult({
        model: { matrixId: 'candidate-999' },
      });
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      const input = makeInput(released);
      const result = computeMLBShadowQuarantinedPrediction(input);

      expect(result.ok).toBe(false);
      expect(vi.mocked(inferMLBOfflinePregameWinner)).not.toHaveBeenCalled();
    });
  });

  describe('B. Ordering: fingerprint verification before inference acceptance', () => {
    it('ALTERED_MODEL_REJECTED_BEFORE_INFERENCE = YES', () => {
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      const input = makeInput(released);
      const result = computeMLBShadowQuarantinedPrediction(input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        // The failure MUST come from the fingerprint gate, not from inference.
        expect(result.issues[0].path).toBe(
          '$.releasedModelResult.fitValidation.model',
        );
        expect(result.issues[0].code).toBe('INVALID_JSON_VALUE');
        expect(result.issues[0].message).toContain('fingerprint');
      }
      // Inference spy confirms the rejection path never reaches inference.
      expect(vi.mocked(inferMLBOfflinePregameWinner)).not.toHaveBeenCalled();
    });
  });

  describe('C. Positive adapter/parity tests (verifier mock, real inference)', () => {
    it('parity: zero model => 0.5/0.5 HOME', () => {
      const released = buildValidReleaseResult();
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      const input = makeInput(released);

      // Mock: verifier accepts the synthetic model as candidate-003.
      // Only the verifier is overridden — inference remains the real implementation.
      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);

      const result = computeMLBShadowQuarantinedPrediction(input);
      expect(result.ok).toBe(true);
      expect(vi.mocked(inferMLBOfflinePregameWinner)).toHaveBeenCalledTimes(1);

      // Direct call to the real (mocked-wrapper) inference.
      const direct = inferMLBOfflinePregameWinner(released, manifest, snapshot);
      expect(direct.ok).toBe(true);

      if (result.ok && direct.ok) {
        // predictedWinner === predictedSide (HOME)
        expect(result.value.predictedWinner).toBe(direct.value.predictedSide);
        expect(result.value.predictedWinner).toBe('HOME');
        // predictedSide
        expect(result.value.predictedSide).toBe(direct.value.predictedSide);
        // home/away probabilities
        expect(result.value.homeWinProbability).toBeCloseTo(
          direct.value.probabilities.homeWinProbability,
          15,
        );
        expect(result.value.awayWinProbability).toBeCloseTo(
          direct.value.probabilities.awayWinProbability,
          15,
        );
        // decision policy
        expect(result.value.decisionPolicy).toBe(direct.value.decisionPolicy);
        // Shadow metadata preserved
        expect(result.value.shadowRecordId).toBe('synthetic-shadow-001');
        expect(result.value.gamePk).toBe(990000001);
        expect(result.value.predictionGeneratedAt).toBe('2026-07-15T18:40:00Z');
        // Payload hash is present and valid
        expect(result.value.payloadHash).toMatch(/^[0-9a-f]{64}$/);
      }
    });

    it('parity: score +1 => sigmoid(1) HOME', () => {
      const released = buildValidReleaseResult({
        model: {
          coefficients: [
            { featureId: 'p_1', valueCoefficient: 1, missingIndicatorCoefficient: 0 },
            { featureId: 'p_2', valueCoefficient: 0, missingIndicatorCoefficient: 0 },
          ],
        },
      });
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      const input = makeInput(released);

      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);

      const result = computeMLBShadowQuarantinedPrediction(input);
      expect(result.ok).toBe(true);
      expect(vi.mocked(inferMLBOfflinePregameWinner)).toHaveBeenCalledTimes(1);

      const direct = inferMLBOfflinePregameWinner(released, manifest, snapshot);
      expect(direct.ok).toBe(true);

      if (result.ok && direct.ok) {
        const expectedHome = 1 / (1 + Math.exp(-1));
        expect(result.value.predictedWinner).toBe(direct.value.predictedSide);
        expect(result.value.predictedSide).toBe('HOME');
        expect(result.value.homeWinProbability).toBeCloseTo(
          direct.value.probabilities.homeWinProbability,
          15,
        );
        expect(result.value.homeWinProbability).toBeCloseTo(expectedHome, 15);
        expect(result.value.awayWinProbability).toBeCloseTo(
          direct.value.probabilities.awayWinProbability,
          15,
        );
        expect(result.value.decisionPolicy).toBe(direct.value.decisionPolicy);
      }
    });

    it('parity: score -1 => sigmoid(-1) AWAY', () => {
      const released = buildValidReleaseResult({
        model: {
          coefficients: [
            { featureId: 'p_1', valueCoefficient: -1, missingIndicatorCoefficient: 0 },
            { featureId: 'p_2', valueCoefficient: 0, missingIndicatorCoefficient: 0 },
          ],
        },
      });
      const manifest = buildValidManifest();
      const snapshot = buildValidSnapshot();
      expectValidLockedInputs(released, manifest, snapshot);

      const input = makeInput(released);

      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReturnValueOnce(true);

      const result = computeMLBShadowQuarantinedPrediction(input);
      expect(result.ok).toBe(true);

      const direct = inferMLBOfflinePregameWinner(released, manifest, snapshot);
      expect(direct.ok).toBe(true);

      if (result.ok && direct.ok) {
        const expectedAway = Math.exp(-1) / (1 + Math.exp(-1));
        expect(result.value.predictedWinner).toBe(direct.value.predictedSide);
        expect(result.value.predictedSide).toBe('AWAY');
        expect(result.value.homeWinProbability).toBeCloseTo(
          direct.value.probabilities.homeWinProbability,
          15,
        );
        expect(result.value.homeWinProbability).toBeCloseTo(expectedAway, 15);
        expect(result.value.awayWinProbability).toBeCloseTo(
          direct.value.probabilities.awayWinProbability,
          15,
        );
        expect(result.value.decisionPolicy).toBe(direct.value.decisionPolicy);
      }
    });
  });
});
