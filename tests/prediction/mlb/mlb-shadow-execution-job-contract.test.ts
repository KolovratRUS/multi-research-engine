import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

/* -------------------------------------------------------------------------- */
/*  Mock: candidate-003 authoritativeness verifier                            */
/* -------------------------------------------------------------------------- */
/*  Mirrors the sanctioned pattern from                                            */
/*  mlb-shadow-monitoring-prediction-computation.test.ts:                          */
/*    - The module is mocked so the verifier is a vi.fn wrapping the real impl.  */
/*    - By DEFAULT the mock accepts the candidate-003 model (returns true),       */
/*      so tests that are NOT about the model gate can isolate their field.       */
/*    - Test #14 (non-authoritative model) explicitly restores the REAL verifier  */
/*      to prove fail-closed behavior against a synthetic model.                  */
/*    - No production bypass: the mock exists ONLY in this test file.             */
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

/* -------------------------------------------------------------------------- */
/*  Imports                                                                   */
/* -------------------------------------------------------------------------- */
// Mocked verifier (vi.fn wrapper around the real implementation).
import { verifyMLBShadowCandidate003AuthoritativeModel } from '@/prediction/mlb/mlb-shadow-model-fingerprint';

// Production module under test — NOT mocked.
import {
  validateMLBShadowExecutionJob,
  MLB_SHADOW_EXECUTION_JOB_CONTRACT_VERSION,
  type MLBShadowExecutionJobV1,
  type MLBShadowExecutionJobValidationResult,
} from '@/prediction/mlb/mlb-shadow-execution-job-contract';

// Real frozen manifest + fingerprint (used as the only accepted manifest).
import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
  computeMLBFeatureManifestFingerprint,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';

// Reusable existing validators (fixture-validation assertions only).
import { validateMLBModelTestReleaseResult } from '@/prediction/mlb/mlb-model-test-release-contract';
import { validateMLBFeatureManifest } from '@/prediction/mlb/mlb-feature-vector-contract';
import {
  validateMLBCanonicalPregameSnapshot,
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';

/* -------------------------------------------------------------------------- */
/*  Real verifier captured for the fail-closed test (#14)                     */
/* -------------------------------------------------------------------------- */
type VerifyFn = (model: unknown) => boolean;
let realVerify: VerifyFn;

beforeAll(async () => {
  const fp = await vi.importActual<
    typeof import('@/prediction/mlb/mlb-shadow-model-fingerprint')
  >('@/prediction/mlb/mlb-shadow-model-fingerprint');
  realVerify = fp.verifyMLBShadowCandidate003AuthoritativeModel as VerifyFn;
});

beforeEach(() => {
  // Default: accept the candidate-003 model so non-model tests isolate their field.
  vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockReset();
  vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockImplementation(
    () => true,
  );
});

/* -------------------------------------------------------------------------- */
/*  Frozen test timestamps                                                     */
/* -------------------------------------------------------------------------- */
const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';

const FROZEN_PREDICTION_GENERATED_AT = '2026-07-15T18:40:00Z';
const FROZEN_OFFICIAL_DATE = '2026-07-15';

/* -------------------------------------------------------------------------- */
/*  Fixture builders — adapted from the prediction-computation test file.      */
/* -------------------------------------------------------------------------- */

/**
 * Structurally valid MLBModelTestReleaseResult. The embedded model is
 * SYNTHETIC — it passes validateMLBModelTestReleaseResult but is NOT the
 * frozen candidate-003 model.
 */
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

/** Structurally valid manifest that is NOT the frozen real-pregame manifest. */
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

/** Structurally valid canonical pregame snapshot (carries gameId, not gamePk). */
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
      officialDate: FROZEN_OFFICIAL_DATE,
      season: 2026,
      gameType: 'REGULAR_SEASON',
      status: 'SCHEDULED',
      homeTeamId: 'home-1',
      awayTeamId: 'away-1',
      venueId: 'venue-1',
      neutralSite: false,
      doubleheader: null,
      ...((overrides.game as Record<string, unknown> | undefined) ?? {}),
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

/**
 * A fully valid S1 shadow execution job. Uses the FROZEN real-pregame manifest
 * (the only manifest identity the contract accepts) and a structurally valid
 * synthetic release result + valid snapshot. The candidate-003 verifier is
 * accepted by default (see beforeEach).
 */
function buildValidJob(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    repoRoot: '/Users/samkassirov/multi-research-engine',
    shadowRecordId: 'shadow-001',
    gamePk: 990000001,
    predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
    releasedModelResult: buildValidReleaseResult(),
    featureManifest: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    snapshot: buildValidSnapshot(),
    ...overrides,
  };
}

const FROZEN_MANIFEST_FINGERPRINT =
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT;

const AUTHORIZED_JOB_KEYS: readonly string[] = [
  'repoRoot',
  'shadowRecordId',
  'gamePk',
  'predictionGeneratedAt',
  'releasedModelResult',
  'featureManifest',
  'snapshot',
  'officialDate',
  'scheduledStartAt',
  'latencyMs',
  'featureManifestId',
  'featureManifestFingerprint',
  'timingReferenceContractVersion',
  'timingReferenceCutoffAt',
];

/* -------------------------------------------------------------------------- */
/*  Tests                                                                       */
/* -------------------------------------------------------------------------- */
describe('mlb-shadow-execution-job-contract', () => {
  describe('A. Positive cases', () => {
    it('1. valid complete job passes (all optional fields present)', () => {
      const job = buildValidJob({
        officialDate: FROZEN_OFFICIAL_DATE,
        scheduledStartAt: FROZEN_SCHEDULED_START,
        latencyMs: 1234,
        featureManifestId: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
        featureManifestFingerprint: FROZEN_MANIFEST_FINGERPRINT,
        timingReferenceContractVersion: 'mlb-offline-pregame-inference-contract-v1',
        timingReferenceCutoffAt: FROZEN_DATA_CUTOFF,
      });

      const result = validateMLBShadowExecutionJob(job);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.featureManifestId).toBe(
          MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
        );
        expect(result.value.featureManifestFingerprint).toBe(FROZEN_MANIFEST_FINGERPRINT);
        expect(result.value.latencyMs).toBe(1234);
      }
    });

    it('2. valid job with all optional fields omitted passes', () => {
      const result = validateMLBShadowExecutionJob(buildValidJob());
      expect(result.ok).toBe(true);
    });
  });

  describe('B. Non-object / structural rejection', () => {
    it('3. non-object input fails', () => {
      const result = validateMLBShadowExecutionJob(42);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.code === 'NOT_PLAIN_OBJECT')).toBe(true);
      }
    });

    it('4. null fails', () => {
      const result = validateMLBShadowExecutionJob(null);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.code === 'NOT_PLAIN_OBJECT')).toBe(true);
      }
    });

    it('5. array fails', () => {
      const result = validateMLBShadowExecutionJob([1, 2, 3]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.code === 'NOT_PLAIN_OBJECT')).toBe(true);
      }
    });
  });

  describe('C. Required scalar fields', () => {
    it('6. missing repoRoot fails', () => {
      const { repoRoot, ...without } = buildValidJob();
      void repoRoot;
      const result = validateMLBShadowExecutionJob(without);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.find((i) => i.path === '$.repoRoot')?.code).toBe('MISSING_FIELD');
      }
    });

    it('7. invalid/empty repoRoot fails', () => {
      expect(validateMLBShadowExecutionJob(buildValidJob({ repoRoot: '' })).ok).toBe(false);
      expect(validateMLBShadowExecutionJob(buildValidJob({ repoRoot: '   ' })).ok).toBe(false);
      expect(validateMLBShadowExecutionJob(buildValidJob({ repoRoot: 123 })).ok).toBe(false);
      expect(validateMLBShadowExecutionJob(buildValidJob({ repoRoot: '/tmp/\u0000bad' })).ok).toBe(false);
    });

    it('8. missing shadowRecordId fails', () => {
      const { shadowRecordId, ...without } = buildValidJob();
      void shadowRecordId;
      const result = validateMLBShadowExecutionJob(without);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.find((i) => i.path === '$.shadowRecordId')?.code).toBe('MISSING_FIELD');
      }
    });

    it('9. empty shadowRecordId fails', () => {
      expect(validateMLBShadowExecutionJob(buildValidJob({ shadowRecordId: '' })).ok).toBe(false);
      expect(validateMLBShadowExecutionJob(buildValidJob({ shadowRecordId: '   ' })).ok).toBe(false);
      expect(validateMLBShadowExecutionJob(buildValidJob({ shadowRecordId: 9 })).ok).toBe(false);
    });

    it('10. invalid gamePk fails', () => {
      expect(validateMLBShadowExecutionJob(buildValidJob({ gamePk: '990000001' })).ok).toBe(false);
      expect(validateMLBShadowExecutionJob(buildValidJob({ gamePk: 0 })).ok).toBe(false);
      expect(validateMLBShadowExecutionJob(buildValidJob({ gamePk: -1 })).ok).toBe(false);
      expect(validateMLBShadowExecutionJob(buildValidJob({ gamePk: 1.5 })).ok).toBe(false);
      expect(validateMLBShadowExecutionJob(buildValidJob({ gamePk: NaN })).ok).toBe(false);
      expect(validateMLBShadowExecutionJob(buildValidJob({ gamePk: Infinity })).ok).toBe(false);
    });

    it('11. invalid predictionGeneratedAt fails', () => {
      expect(validateMLBShadowExecutionJob(buildValidJob({ predictionGeneratedAt: 'not-a-timestamp' })).ok).toBe(false);
      expect(validateMLBShadowExecutionJob(buildValidJob({ predictionGeneratedAt: '2026-13-40T99:99:99Z' })).ok).toBe(false);
      expect(validateMLBShadowExecutionJob(buildValidJob({ predictionGeneratedAt: 12345 })).ok).toBe(false);
      // exactly the supplied value (not normalized / not generated)
      expect(validateMLBShadowExecutionJob(buildValidJob({ predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT })).ok).toBe(true);
    });
  });

  describe('D. Model validation (candidate-003 gate)', () => {
    it('12. valid releasedModelResult required (structural ok + authoritative model)', () => {
      expect(validateMLBModelTestReleaseResult(buildValidReleaseResult()).ok).toBe(true);
      const result = validateMLBShadowExecutionJob(buildValidJob());
      expect(result.ok).toBe(true);
    });

    it('13. structurally invalid releasedModelResult fails', () => {
      const result = validateMLBShadowExecutionJob(
        buildValidJob({ releasedModelResult: { notARelease: true } }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.find((i) => i.path === '$.releasedModelResult')?.code).toBe('RELEASE_RESULT_INVALID');
      }
    });

    it('14. non-authoritative Candidate-003 model fails (REAL verifier)', () => {
      // Override the default-accept mock with the REAL verifier for this test.
      vi.mocked(verifyMLBShadowCandidate003AuthoritativeModel).mockImplementation(realVerify);
      const result = validateMLBShadowExecutionJob(buildValidJob());
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.find((i) => i.path === '$.releasedModelResult.fitValidation.model')?.code,
        ).toBe('MODEL_NOT_AUTHORITATIVE');
      }
    });
  });

  describe('E. Feature manifest validation', () => {
    it('15. valid featureManifest required', () => {
      expect(validateMLBFeatureManifest(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1).ok).toBe(true);
      const result = validateMLBShadowExecutionJob(buildValidJob());
      expect(result.ok).toBe(true);
    });

    it('16. invalid featureManifest fails', () => {
      const result = validateMLBShadowExecutionJob(
        buildValidJob({ featureManifest: { notAManifest: true } }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.find((i) => i.path === '$.featureManifest')?.code).toBe('MANIFEST_INVALID');
      }
    });

    it('17. wrong frozen manifest identity/fingerprint fails', () => {
      // Structurally valid but NOT the frozen real-pregame manifest.
      const result = validateMLBShadowExecutionJob(
        buildValidJob({ featureManifest: buildValidManifest() }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.find((i) => i.path === '$.featureManifest')?.code).toBe('MANIFEST_FINGERPRINT_MISMATCH');
      }
    });

    it('17b. frozen manifest fingerprint equals the accepted constant', () => {
      const fp = computeMLBFeatureManifestFingerprint(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1);
      expect(fp.ok).toBe(true);
      if (fp.ok) {
        expect(fp.fingerprint).toBe(FROZEN_MANIFEST_FINGERPRINT);
      }
    });
  });

  describe('F. Snapshot validation', () => {
    it('18. valid canonical snapshot required', () => {
      expect(validateMLBCanonicalPregameSnapshot(buildValidSnapshot()).ok).toBe(true);
      const result = validateMLBShadowExecutionJob(buildValidJob());
      expect(result.ok).toBe(true);
    });

    it('19. invalid snapshot fails', () => {
      const result = validateMLBShadowExecutionJob(
        buildValidJob({ snapshot: { notASnapshot: true } }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.find((i) => i.path === '$.snapshot')?.code).toBe('SNAPSHOT_INVALID');
      }
    });
  });

  describe('G. Snapshot/game identity (source truth -> NO check)', () => {
    it('20. canonical snapshot exposes no authoritative gamePk (no identity gate)', () => {
      // The canonical pregame snapshot carries gameId: string, NOT gamePk: number.
      // Per source truth there is no authoritative gamePk to compare against, so
      // the contract does not (and cannot) perform a snapshot/game identity check.
      const snap = buildValidSnapshot();
      expect(snap.game).toHaveProperty('gameId');
      expect(snap.game).not.toHaveProperty('gamePk');
      // A valid job (snapshot carries gameId) is accepted.
      const result = validateMLBShadowExecutionJob(buildValidJob());
      expect(result.ok).toBe(true);
    });
  });

  describe('H. Optional metadata / latency', () => {
    it('21. negative latencyMs fails', () => {
      const result = validateMLBShadowExecutionJob(buildValidJob({ latencyMs: -1 }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.find((i) => i.path === '$.latencyMs')?.code).toBe('INVALID_INTEGER');
      }
    });

    it('22. non-finite latencyMs fails', () => {
      expect(validateMLBShadowExecutionJob(buildValidJob({ latencyMs: NaN })).ok).toBe(false);
      expect(validateMLBShadowExecutionJob(buildValidJob({ latencyMs: Infinity })).ok).toBe(false);
      expect(validateMLBShadowExecutionJob(buildValidJob({ latencyMs: -Infinity })).ok).toBe(false);
    });

    it('23. invalid optional timestamp/date fields fail', () => {
      expect(validateMLBShadowExecutionJob(buildValidJob({ officialDate: 'not-a-date' })).ok).toBe(false);
      expect(validateMLBShadowExecutionJob(buildValidJob({ officialDate: '2026-13-40' })).ok).toBe(false);
      expect(validateMLBShadowExecutionJob(buildValidJob({ scheduledStartAt: 'not-a-timestamp' })).ok).toBe(false);
      expect(validateMLBShadowExecutionJob(buildValidJob({ timingReferenceCutoffAt: 'bad' })).ok).toBe(false);
    });

    it('24. invalid optional manifest metadata fails under existing semantics', () => {
      expect(validateMLBShadowExecutionJob(buildValidJob({ featureManifestId: 123 })).ok).toBe(false);
      expect(validateMLBShadowExecutionJob(buildValidJob({ featureManifestFingerprint: 'not-a-hash' })).ok).toBe(false);
      expect(validateMLBShadowExecutionJob(buildValidJob({ timingReferenceContractVersion: 7 })).ok).toBe(false);
    });
  });

  describe('I. Top-level unknown / sportsbook fields', () => {
    it('25. unknown top-level field fails', () => {
      const result = validateMLBShadowExecutionJob(buildValidJob({ unexpected: true }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.find((i) => i.path === '$.unexpected')?.code).toBe('UNKNOWN_FIELD');
      }
    });

    it('26. unknown `odds` field fails', () => {
      const result = validateMLBShadowExecutionJob(buildValidJob({ odds: 1.9 }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.find((i) => i.path === '$.odds')?.code).toBe('UNKNOWN_FIELD');
      }
    });

    it('27. unknown `sportsbook` field fails', () => {
      const result = validateMLBShadowExecutionJob(buildValidJob({ sportsbook: 'draftkings' }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.find((i) => i.path === '$.sportsbook')?.code).toBe('UNKNOWN_FIELD');
      }
    });

    it('27b. other prohibited operational concepts rejected at top level', () => {
      for (const key of [
        'result', 'outcome', 'correct', 'correctness', 'grading',
        'performance', 'predictedWinner', 'homeWinProbability', 'payloadHash',
        'decisionPolicy',
      ]) {
        const result = validateMLBShadowExecutionJob(buildValidJob({ [key]: 'x' }));
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.issues.some((i) => i.path === `$.${key}` && i.code === 'UNKNOWN_FIELD')).toBe(true);
        }
      }
    });
  });

  describe('J. Nested odds do not bypass the firewall', () => {
    it('odds key inside releasedModelResult is rejected by downstream firewall', () => {
      const contaminated = buildValidReleaseResult();
      (contaminated as Record<string, unknown>).odds = 1.9;
      const result = validateMLBShadowExecutionJob(
        buildValidJob({ releasedModelResult: contaminated }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.code === 'ODDS_CONTAMINATION')).toBe(true);
      }
    });

    it('odds key inside featureManifest is rejected by downstream firewall', () => {
      const contaminated: Record<string, unknown> = { ...buildValidManifest(), odds: 1.9 };
      const result = validateMLBShadowExecutionJob(
        buildValidJob({ featureManifest: contaminated }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.code === 'ODDS_CONTAMINATION')).toBe(true);
      }
    });

    it('odds key inside snapshot is rejected by downstream firewall', () => {
      const contaminated: Record<string, unknown> = { ...buildValidSnapshot(), odds: 1.9 };
      const result = validateMLBShadowExecutionJob(
        buildValidJob({ snapshot: contaminated }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.code === 'ODDS_CONTAMINATION')).toBe(true);
      }
    });
  });

  describe('K. Immutability and no generation', () => {
    it('28. validator does not mutate input', () => {
      const input = buildValidJob();
      const before = JSON.stringify(input);
      validateMLBShadowExecutionJob(input);
      const after = JSON.stringify(input);
      expect(before).toBe(after);
    });

    it('29. returned validated value contains only authorized job keys', () => {
      const result = validateMLBShadowExecutionJob(buildValidJob());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Object.keys(result.value).sort()).toEqual([...AUTHORIZED_JOB_KEYS].sort());
      }
    });

    it('30. no runtime-generated value is introduced', () => {
      const result = validateMLBShadowExecutionJob(buildValidJob());
      expect(result.ok).toBe(true);
      if (result.ok) {
        // predictionGeneratedAt is the exact supplied frozen value, not a
        // generated current timestamp.
        expect(result.value.predictionGeneratedAt).toBe(FROZEN_PREDICTION_GENERATED_AT);
        const nowMs = Date.now();
        const suppliedMs = Date.parse(result.value.predictionGeneratedAt);
        expect(Math.abs(nowMs - suppliedMs)).toBeGreaterThan(86_400_000);
      }
    });

    it('31. supplied predictionGeneratedAt is preserved exactly', () => {
      const ts = '2026-08-01T07:05:03Z';
      const result = validateMLBShadowExecutionJob(buildValidJob({ predictionGeneratedAt: ts }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.predictionGeneratedAt).toBe(ts);
      }
    });

    it('32. supplied shadowRecordId is preserved exactly', () => {
      const id = 'shadow-retry-42';
      const result = validateMLBShadowExecutionJob(buildValidJob({ shadowRecordId: id }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.shadowRecordId).toBe(id);
      }
    });

    it('33. supplied latencyMs is preserved exactly', () => {
      const result = validateMLBShadowExecutionJob(buildValidJob({ latencyMs: 5678 }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.latencyMs).toBe(5678);
      }
    });

    it('34. omitted optional fields remain null (canonical semantics)', () => {
      const result = validateMLBShadowExecutionJob(buildValidJob());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.officialDate).toBeNull();
        expect(result.value.scheduledStartAt).toBeNull();
        expect(result.value.latencyMs).toBeNull();
        expect(result.value.featureManifestId).toBeNull();
        expect(result.value.featureManifestFingerprint).toBeNull();
        expect(result.value.timingReferenceContractVersion).toBeNull();
        expect(result.value.timingReferenceCutoffAt).toBeNull();
      }
    });

    it('35. safe fixed issue objects contain no sensitive values', () => {
      const contaminated = buildValidReleaseResult();
      (contaminated as Record<string, unknown>).odds = 1.9;
      const result = validateMLBShadowExecutionJob(
        buildValidJob({
          releasedModelResult: contaminated,
          featureManifest: buildValidManifest(),
        }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        for (const issue of result.issues) {
          expect(Object.keys(issue).sort()).toEqual(['code', 'message', 'path']);
          const blob = JSON.stringify(issue);
          for (const forbidden of [
            'homeWinProbability',
            'awayWinProbability',
            'predictedWinner',
            'predictedSide',
            'coefficients',
            'valueCoefficient',
            'missingIndicatorCoefficient',
            'probability',
            'brierScore',
          ]) {
            expect(blob).not.toContain(forbidden);
          }
        }
      }
    });
  });

  describe('L. Retry stability (contract preserves differences; no normalization)', () => {
    it('same valid job validated twice yields identical content', () => {
      const a = validateMLBShadowExecutionJob(buildValidJob());
      const b = validateMLBShadowExecutionJob(buildValidJob());
      expect(a.ok && b.ok).toBe(true);
      if (a.ok && b.ok) {
        expect(a.value).toEqual(b.value);
      }
    });

    it('varying repoRoot yields a distinct job (distinct execution attempt)', () => {
      const a = validateMLBShadowExecutionJob(buildValidJob());
      const b = validateMLBShadowExecutionJob(buildValidJob({ repoRoot: '/other/repo/root' }));
      expect(a.ok && b.ok).toBe(true);
      if (a.ok && b.ok) {
        expect(a.value.repoRoot).not.toBe(b.value.repoRoot);
        expect(a.value).not.toEqual(b.value);
      }
    });

    it('varying shadowRecordId yields a distinct job (distinct execution attempt)', () => {
      const a = validateMLBShadowExecutionJob(buildValidJob());
      const b = validateMLBShadowExecutionJob(buildValidJob({ shadowRecordId: 'shadow-retry-99' }));
      expect(a.ok && b.ok).toBe(true);
      if (a.ok && b.ok) {
        expect(a.value.shadowRecordId).not.toBe(b.value.shadowRecordId);
        expect(a.value).not.toEqual(b.value);
      }
    });

    it('varying predictionGeneratedAt yields a distinct job (distinct record)', () => {
      const a = validateMLBShadowExecutionJob(buildValidJob());
      const b = validateMLBShadowExecutionJob(buildValidJob({ predictionGeneratedAt: '2026-08-01T00:00:00Z' }));
      expect(a.ok && b.ok).toBe(true);
      if (a.ok && b.ok) {
        expect(a.value.predictionGeneratedAt).not.toBe(b.value.predictionGeneratedAt);
        expect(a.value).not.toEqual(b.value);
      }
    });

    it('varying latencyMs yields a distinct job (distinct metric state)', () => {
      const a = validateMLBShadowExecutionJob(buildValidJob({ latencyMs: 100 }));
      const b = validateMLBShadowExecutionJob(buildValidJob({ latencyMs: 200 }));
      expect(a.ok && b.ok).toBe(true);
      if (a.ok && b.ok) {
        expect(a.value.latencyMs).not.toBe(b.value.latencyMs);
        expect(a.value).not.toEqual(b.value);
      }
    });
  });

  describe('M. Contract version + result shape', () => {
    it('version constant is the exact frozen string', () => {
      expect(MLB_SHADOW_EXECUTION_JOB_CONTRACT_VERSION).toBe('mlb-shadow-execution-job-v1');
    });

    it('result is a discriminated union on ok', () => {
      const ok = validateMLBShadowExecutionJob(buildValidJob());
      expect(ok.ok).toBe(true);
      if (ok.ok) {
        const job: MLBShadowExecutionJobV1 = ok.value;
        void job;
        const _result: MLBShadowExecutionJobValidationResult = ok;
        void _result;
      }
    });
  });
});
