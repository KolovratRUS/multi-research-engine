/* -------------------------------------------------------------------------- */
/*  Functional tests for V2 L5E2S orchestrator (additive P5E-C1)               */
/*  Synthetic / temp-root fixtures only — NO real MLB execution,              */
/*  NO production shadow runtime write.                                      */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  Mock factories                                                            */
/*                                                                            */
/*  The V2 orchestrator delegates to:                                          */
/*    - computeMLBShadowQuarantinedPredictionV2 (pure, NOT mocked)            */
/*    - persistMLBShadowQuarantinedPrediction  (wrapped for spy control)      */
/*    - buildMLBShadowPredictionOperationalRecord (pure, NOT mocked)            */
/*                                                                            */
/*  The store module is mocked with a vi.fn wrapper so that status-mapping    */
/*  tests (ALREADY_EXISTS, VERIFICATION_FAILED, unknown failures) can control */
/*  the store's return value while real-persistence tests use the real impl.   */
/*                                                                            */
/*  node:fs/promises is mocked so readFile can be spied on for                */
/*  VERIFICATION_FAILED read-back failure tests.                               */
/*                                                                            */
/*  No production bypass is introduced — mocks exist ONLY in this test file.  */
/* -------------------------------------------------------------------------- */

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

// Mocked store module
import {
  persistMLBShadowQuarantinedPrediction,
  MLB_SHADOW_MONITORING_PREDICTION_STORE_VERSION,
  type MLBShadowPredictionPersistenceResult,
  type MLBShadowPredictionFailureStatus,
} from '@/prediction/mlb/mlb-shadow-monitoring-prediction-store';

// Module under test
import {
  orchestrateMLBShadowQuarantinePredictionV2,
  type MLBShadowQuarantineOrchestratorV2Input,
} from '@/prediction/mlb/mlb-shadow-monitoring-prediction-orchestrator-v2';

// V2 fixtures — real authorized artifact + frozen manifest
import {
  getMLBShadowCandidate003AuthorizedModelArtifact,
} from '@/prediction/mlb/mlb-shadow-candidate-003-authorized-model-artifact';
import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';

// V2 job validator (for fixture validation only)
import {
  validateMLBShadowExecutionJobV2,
} from '@/prediction/mlb/mlb-shadow-execution-job-v2-contract';

// Namespace + record contract
import {
  MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE,
} from '@/prediction/mlb/mlb-shadow-monitoring-namespace';
import {
  MLB_SHADOW_MONITORING_SCIENTIFIC_USE_NONE,
  MLB_SHADOW_MONITORING_OPERATIONAL_MODE_S1_OPERATIONAL_BLIND,
} from '@/prediction/mlb/mlb-shadow-monitoring-record-contract';

// Snapshot contract (for buildSnapshot)
import {
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';

/* -------------------------------------------------------------------------- */
/*  Frozen test timestamps                                                    */
/* -------------------------------------------------------------------------- */

const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';
const FROZEN_PREDICTION_GENERATED_AT_A = '2026-07-15T18:40:00Z';
const FROZEN_PREDICTION_GENERATED_AT_B = '2026-07-15T19:00:00Z';
const FROZEN_OFFICIAL_DATE = '2026-07-15';

/* -------------------------------------------------------------------------- */
/*  Manifest section IDs (must match the frozen real-pregame manifest)        */
/* -------------------------------------------------------------------------- */

const MANIFEST_SECTION_IDS = [
  'section-away-batting',
  'section-away-bullpen',
  'section-away-starter',
  'section-game-context',
  'section-home-batting',
  'section-home-bullpen',
  'section-home-starter',
] as const;

/* -------------------------------------------------------------------------- */
/*  Snapshot builder — produces a structurally valid canonical pregame        */
/*  snapshot with section payloads controlled by the caller.                   */
/* -------------------------------------------------------------------------- */

function buildSnapshot(
  sectionPayloads: Record<string, Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    contractVersion: MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    snapshotId: 'snapshot-v2-test-001',
    capturedAt: FROZEN_CAPTURED_AT,
    dataCutoffAt: FROZEN_DATA_CUTOFF,
    game: {
      gameId: 'game-v2-test-001',
      scheduledStartAt: FROZEN_SCHEDULED_START,
      officialDate: FROZEN_OFFICIAL_DATE,
      season: 2026,
      gameType: 'REGULAR_SEASON',
      status: 'SCHEDULED',
      homeTeamId: 'home-test-001',
      awayTeamId: 'away-test-001',
      venueId: 'venue-test-001',
      neutralSite: false,
      doubleheader: null,
    },
    startingPitchers: {
      home: {
        state: 'PROBABLE',
        pitcherId: 'p-home',
        announcedAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-game'],
      },
      away: {
        state: 'PROBABLE',
        pitcherId: 'p-away',
        announcedAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-game'],
      },
    },
    sourceReferences: [
      {
        sourceRefId: 'src-game',
        sourceName: 'MLB Stats API',
        sourceCategory: 'OFFICIAL',
        roles: ['GAME_IDENTITY', 'STARTING_PITCHER', 'TEAM_STATS'],
        providerRecordId: null,
        fetchedAt: FROZEN_CAPTURED_AT,
        sourceUpdatedAt: FROZEN_DATA_CUTOFF,
      },
    ],
    sections: MANIFEST_SECTION_IDS.map((sectionId) => ({
      sectionId,
      kind: 'GAME_CONTEXT',
      entity: { scope: 'GAME', entityId: null },
      status: 'AVAILABLE',
      asOfAt: FROZEN_DATA_CUTOFF,
      sourceRefIds: ['src-game'],
      payload: sectionPayloads[sectionId] ?? {},
    })),
    dataCompleteness: 'COMPLETE',
    warnings: [],
  };
}

const ALL_PRESENT_PAYLOADS: Record<string, Record<string, unknown>> = {
  'section-away-bullpen': {
    recentWorkload: { extraInningGames: 0, gamesInPrevious3Days: 2 },
  },
  'section-away-batting': {
    seasonStats: {
      runsAllowedPerGame: 4.5,
      runsScoredPerGame: 5.0,
      winRate: 0.6,
    },
  },
  'section-away-starter': { availability: 1 },
  'section-game-context': {
    doubleHeaderGameNumber: 0,
    scheduledInnings: 9,
  },
  'section-home-bullpen': {
    recentWorkload: { extraInningGames: 1, gamesInPrevious3Days: 3 },
  },
  'section-home-batting': {
    seasonStats: {
      runsAllowedPerGame: 3.5,
      runsScoredPerGame: 6.0,
      winRate: 0.7,
    },
  },
  'section-home-starter': { availability: 1 },
};

/* -------------------------------------------------------------------------- */
/*  V2 orchestrator input builder                                             */
/* -------------------------------------------------------------------------- */

function buildOrchestratorV2Input(
  repoRoot: string,
  overrides: Partial<MLBShadowQuarantineOrchestratorV2Input> = {},
): MLBShadowQuarantineOrchestratorV2Input {
  return {
    repoRoot,
    shadowRecordId: 'synthetic-shadow-v2-001',
    gamePk: 990000001,
    predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT_A,
    authorizedModelArtifact: getMLBShadowCandidate003AuthorizedModelArtifact(),
    featureManifest: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    snapshot: buildSnapshot(ALL_PRESENT_PAYLOADS),
    officialDate: FROZEN_OFFICIAL_DATE,
    scheduledStartAt: FROZEN_SCHEDULED_START,
    latencyMs: 0,
    featureManifestId: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
    featureManifestFingerprint:
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
    timingReferenceContractVersion: 'mlb-canonical-pregame-snapshot-v1',
    timingReferenceCutoffAt: FROZEN_DATA_CUTOFF,
    ...overrides,
  };
}

/**
 * Deep-clone a frozen object via JSON round-trip (test-only).
 */
function cloneJob(job: MLBShadowQuarantineOrchestratorV2Input): MLBShadowQuarantineOrchestratorV2Input {
  return JSON.parse(JSON.stringify(job));
}

/* -------------------------------------------------------------------------- */
/*  Fixture validation                                                      */
/* -------------------------------------------------------------------------- */

function expectValidV2Job(
  input: MLBShadowQuarantineOrchestratorV2Input,
): void {
  const validation = validateMLBShadowExecutionJobV2(input);
  expect(validation.ok).toBe(true);
}

/* -------------------------------------------------------------------------- */
/*  Real implementations captured for mock restoration                        */
/* -------------------------------------------------------------------------- */

type PersistFn = typeof persistMLBShadowQuarantinedPrediction;
type ReadFileFn = typeof fs.readFile;

let realPersist: PersistFn;
let realReadFile: ReadFileFn;

beforeAll(async () => {
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
  vi.mocked(persistMLBShadowQuarantinedPrediction).mockReset();
  vi.mocked(persistMLBShadowQuarantinedPrediction).mockImplementation(realPersist);
  vi.mocked(fs.readFile).mockReset();
  vi.mocked(fs.readFile).mockImplementation(realReadFile);
});

/* -------------------------------------------------------------------------- */
/*  Temp directory helpers                                                   */
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
/*  Mock store-result helpers (mirror V1 exactly)                             */
/* -------------------------------------------------------------------------- */

function mockPersistedResult(
  shadowRecordId = 'synthetic-shadow-v2-001',
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
  shadowRecordId = 'synthetic-shadow-v2-001',
): MLBShadowPredictionPersistenceResult {
  return {
    ok: false,
    status: 'ALREADY_EXISTS',
    storeVersion: MLB_SHADOW_MONITORING_PREDICTION_STORE_VERSION,
    artifactCreated: false,
    shadowRecordId,
    gamePk: 990000001,
    relativePath: null,
    verificationOk: null,
    issues: [],
  };
}

function mockVerificationFailedResult(
  shadowRecordId = 'synthetic-shadow-v2-001',
): MLBShadowPredictionPersistenceResult {
  return {
    ok: false,
    status: 'VERIFICATION_FAILED',
    storeVersion: MLB_SHADOW_MONITORING_PREDICTION_STORE_VERSION,
    artifactCreated: true,
    tempCleanupFailed: false,
    shadowRecordId,
    gamePk: 990000001,
    relativePath: 'var/mlb-development/mlb-shadow-monitoring/quarantine/predictions/abc123.json',
    verificationOk: false,
    issues: [],
  };
}

function mockStoreFailureResult(
  status: Exclude<
    MLBShadowPredictionFailureStatus,
    'ALREADY_EXISTS' | 'VERIFICATION_FAILED'
  >,
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
  const hash = createHash('sha256')
    .update(shadowRecordId, 'utf-8')
    .digest('hex');
  return join(
    repoRoot,
    MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE,
    hash + '.json',
  );
}

/* -------------------------------------------------------------------------- */
/*  Tampered artifact builder for compute-failure tests                        */
/* -------------------------------------------------------------------------- */

function buildTamperedArtifact(): unknown {
  const tampered = JSON.parse(
    JSON.stringify(getMLBShadowCandidate003AuthorizedModelArtifact()),
  ) as Record<string, unknown>;
  const model = tampered.model as Record<string, unknown>;
  const coeffs = model.coefficients as Array<Record<string, unknown>>;
  coeffs[0].valueCoefficient = 999;
  return tampered;
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                      */
/* -------------------------------------------------------------------------- */

describe('mlb-shadow-monitoring-prediction-orchestrator-v2 (L5E2S V2)', () => {
  /* ========================================================================== */
  /*  A. Successful orchestration                                              */
  /* ========================================================================== */

  describe('A. successful orchestration', () => {
    /* 1. successful orchestration returns ok:true safe operational record */
    it('1. successful V2 orchestration returns ok:true safe operational record', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-1-');
      const input = buildOrchestratorV2Input(repoRoot);
      expectValidV2Job(input);

      const result = await orchestrateMLBShadowQuarantinePredictionV2(input);

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
    it('2. successful V2 orchestration persists a prediction artifact under temp repoRoot', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-2-');
      const input = buildOrchestratorV2Input(repoRoot);
      expectValidV2Job(input);

      const result = await orchestrateMLBShadowQuarantinePredictionV2(input);

      expect(result.ok).toBe(true);

      // Artifact must exist at the canonical temp path
      const artifactPath = artifactPathFor(repoRoot, 'synthetic-shadow-v2-001');
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
    it('3-13. V2 public return contains no sensitive prediction or persistence fields', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-3-');
      const input = buildOrchestratorV2Input(repoRoot);
      expectValidV2Job(input);

      const result = await orchestrateMLBShadowQuarantinePredictionV2(input);

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

    /* 4. prediction-store is called after successful computation */
    it('4. prediction-store is called with repoRoot + payload after successful computation', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-4-');
      const input = buildOrchestratorV2Input(repoRoot);
      expectValidV2Job(input);

      await orchestrateMLBShadowQuarantinePredictionV2(input);

      expect(vi.mocked(persistMLBShadowQuarantinedPrediction)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(persistMLBShadowQuarantinedPrediction)).toHaveBeenCalledWith(
        repoRoot,
        expect.objectContaining({ shadowRecordId: 'synthetic-shadow-v2-001' }),
      );
    });
  });

  /* ========================================================================== */
  /*  B. Compute failure → no persistence                                      */
  /* ========================================================================== */

  describe('B. compute failure → no persistence', () => {
    /* 14. computation failure (tampered artifact) prevents persistence */
    it('14. computation failure (tampered artifact) prevents persistence', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-14-');
      const input = buildOrchestratorV2Input(repoRoot, {
        authorizedModelArtifact: buildTamperedArtifact(),
      });

      const result = await orchestrateMLBShadowQuarantinePredictionV2(input);

      expect(result.ok).toBe(true);
      expect(
        vi.mocked(persistMLBShadowQuarantinedPrediction),
      ).not.toHaveBeenCalled();

      // No artifact on disk
      const artifactPath = artifactPathFor(repoRoot, 'synthetic-shadow-v2-001');
      await expect(fs.access(artifactPath)).rejects.toThrow();
    });

    /* 15. computation failure maps to fixed generic PREDICTION_COMPUTE_FAILED */
    it('15. computation failure maps to PREDICTION_COMPUTE_FAILED', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-15-');
      const input = buildOrchestratorV2Input(repoRoot, {
        authorizedModelArtifact: buildTamperedArtifact(),
      });

      const result = await orchestrateMLBShadowQuarantinePredictionV2(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.pipelineStatus).toBe('PREDICTION_COMPUTE_FAILED');
        expect(result.value.failureCode).toBe('PREDICTION_COMPUTE_FAILED');
        expect(result.value.predictionPayloadGenerated).toBe(false);
        expect(result.value.predictionPayloadSchemaValid).toBe(false);
      }
      expect(
        vi.mocked(persistMLBShadowQuarantinedPrediction),
      ).not.toHaveBeenCalled();
    });

    /* 14b. computation failure via non-plain-object input prevents persistence */
    it('14b. computation failure via non-plain-object input prevents persistence', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-14b-');
      const input = buildOrchestratorV2Input(repoRoot);
      const badInput = { ...input, authorizedModelArtifact: 42 } as unknown as MLBShadowQuarantineOrchestratorV2Input;

      const result = await orchestrateMLBShadowQuarantinePredictionV2(badInput);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.pipelineStatus).toBe('PREDICTION_COMPUTE_FAILED');
      }
      expect(
        vi.mocked(persistMLBShadowQuarantinedPrediction),
      ).not.toHaveBeenCalled();
    });
  });

  /* ========================================================================== */
  /*  C. Caller cannot forge derived operational status                        */
  /* ========================================================================== */

  describe('C. caller cannot forge derived operational status', () => {
    function buildForgedInput(
      repoRoot: string,
    ): MLBShadowQuarantineOrchestratorV2Input {
      // Construct an input with extra forged fields, then cast away the
      // type error (as unknown as) to simulate a malicious caller.
      const base = buildOrchestratorV2Input(repoRoot);
      const forged = {
        ...base,
        pipelineStatus: 'HACKED_STATUS',
        failureCode: 'HACKED_CODE',
        predictionPayloadGenerated: true,
        predictionPayloadSchemaValid: true,
      };
      return forged as unknown as MLBShadowQuarantineOrchestratorV2Input;
    }

    /* 16. caller cannot supply/forge predictionPayloadGenerated */
    it('16. caller cannot forge predictionPayloadGenerated', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-16-');
      const input = buildForgedInput(repoRoot);

      // Forged fields cause UNKNOWN_FIELD rejection → compute fails.
      const result = await orchestrateMLBShadowQuarantinePredictionV2(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Compute failure → must be false, not the forged true.
        expect(result.value.predictionPayloadGenerated).toBe(false);
      }
    });

    /* 17. caller cannot supply/forge predictionPayloadSchemaValid */
    it('17. caller cannot forge predictionPayloadSchemaValid', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-17-');
      const input = buildForgedInput(repoRoot);

      const result = await orchestrateMLBShadowQuarantinePredictionV2(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.predictionPayloadSchemaValid).toBe(false);
      }
    });

    /* 18. caller cannot supply/forge pipelineStatus */
    it('18. caller cannot forge pipelineStatus', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-18-');
      const input = buildForgedInput(repoRoot);

      const result = await orchestrateMLBShadowQuarantinePredictionV2(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.pipelineStatus).toBe('PREDICTION_COMPUTE_FAILED');
      }
    });

    /* 19. caller cannot supply/forge failureCode */
    it('19. caller cannot forge failureCode', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-19-');
      const input = buildForgedInput(repoRoot);

      const result = await orchestrateMLBShadowQuarantinePredictionV2(input);

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
      const repoRoot = await trackedTempDir('orch-v2-test-20-');
      const input = buildOrchestratorV2Input(repoRoot);
      expectValidV2Job(input);

      // Override store mock to return PERSISTED.
      vi.mocked(persistMLBShadowQuarantinedPrediction).mockReset();
      vi.mocked(persistMLBShadowQuarantinedPrediction).mockResolvedValueOnce(
        mockPersistedResult(),
      );

      const result = await orchestrateMLBShadowQuarantinePredictionV2(input);

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
      const repoRoot = await trackedTempDir('orch-v2-test-21-');
      const input = buildOrchestratorV2Input(repoRoot);
      expectValidV2Job(input);

      // First call — persists successfully.
      const first = await orchestrateMLBShadowQuarantinePredictionV2(input);
      expect(first.ok).toBe(true);
      if (first.ok) {
        expect(first.value.pipelineStatus).toBe('QUARANTINE_PERSISTED');
      }

      // Second call — identical retry: store returns IDEMPOTENT_IDENTICAL_SUCCESS.
      const second = await orchestrateMLBShadowQuarantinePredictionV2(input);
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
      const repoRoot = await trackedTempDir('orch-v2-test-22-');
      const input = buildOrchestratorV2Input(repoRoot);
      expectValidV2Job(input);

      // First call — persists successfully.
      await orchestrateMLBShadowQuarantinePredictionV2(input);

      const artifactPath = artifactPathFor(repoRoot, 'synthetic-shadow-v2-001');
      const originalBytes = await fs.readFile(artifactPath, 'utf-8');

      // Second call — should get IDEMPOTENT_IDENTICAL_SUCCESS, NOT overwrite.
      const second = await orchestrateMLBShadowQuarantinePredictionV2(input);
      expect(second.ok).toBe(true);

      const unchangedBytes = await fs.readFile(artifactPath, 'utf-8');
      expect(unchangedBytes).toBe(originalBytes);
    });

    /* 23. duplicate execution does not read/unblind existing artifact */
    it('23. duplicate execution does not read/unblind existing artifact', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-23-');
      const input = buildOrchestratorV2Input(repoRoot);
      expectValidV2Job(input);

      // First call.
      const first = await orchestrateMLBShadowQuarantinePredictionV2(input);
      expect(first.ok).toBe(true);

      // Second call — identical retry.
      const second = await orchestrateMLBShadowQuarantinePredictionV2(input);
      expect(second.ok).toBe(true);
      if (second.ok) {
        // Return must be operational record only — no prediction data.
        const json = JSON.stringify(second.value);
        expect(json).not.toContain('HOME');
        expect(json).not.toContain('AWAY');
        expect(json).not.toContain('MAX_PROBABILITY');
        expect(json).not.toContain('predictedWinner');
        expect(json).not.toContain('predictedSide');
        expect(json).not.toContain('homeWinProbability');
        expect(json).not.toContain('awayWinProbability');
        expect(second.value).not.toHaveProperty('predictedWinner');
        expect(second.value).not.toHaveProperty('predictedSide');
        expect(second.value).not.toHaveProperty('homeWinProbability');
        expect(second.value).not.toHaveProperty('awayWinProbability');
      }
    });

    /* DIFFERENT-PAYLOAD SAME-ID returns QUARANTINE_ALREADY_EXISTS_DUPLICATE */
    it('DIFFERENT-PAYLOAD SAME-ID returns QUARANTINE_ALREADY_EXISTS_DUPLICATE with safe record', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-different-payload-');
      const input = buildOrchestratorV2Input(repoRoot);
      expectValidV2Job(input);

      // First call — persists successfully.
      vi.mocked(persistMLBShadowQuarantinedPrediction).mockResolvedValueOnce(
        mockPersistedResult(),
      );
      const first = await orchestrateMLBShadowQuarantinePredictionV2(input);
      expect(first.ok).toBe(true);
      if (first.ok) {
        expect(first.value.pipelineStatus).toBe('QUARANTINE_PERSISTED');
      }

      // Same id + same gamePk, but a DIFFERENT predictionGeneratedAt.
      const input2 = buildOrchestratorV2Input(repoRoot, {
        predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT_B,
      });
      // Override verifier for second call (real artifact passes).
      vi.mocked(persistMLBShadowQuarantinedPrediction).mockResolvedValueOnce(
        mockAlreadyExistsResult(),
      );
      const second = await orchestrateMLBShadowQuarantinePredictionV2(input2);
      expect(second.ok).toBe(true);
      if (second.ok) {
        expect(second.value.pipelineStatus).toBe(
          'QUARANTINE_ALREADY_EXISTS_DUPLICATE',
        );
        expect(second.value.failureCode).toBe('ALREADY_EXISTS');
        expect(second.value.predictionPayloadGenerated).toBe(true);
        expect(second.value.predictionPayloadSchemaValid).toBe(true);

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
      }
    });

    /* STABLE-RETRY IDENTICAL-INPUT returns deep-equal operational records */
    it('STABLE-RETRY IDENTICAL-INPUT returns deep-equal operational records', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-stable-retry-');
      const input = cloneJob(buildOrchestratorV2Input(repoRoot));
      expectValidV2Job(input);

      // First call — persists successfully (writes canonical artifact bytes).
      const first = await orchestrateMLBShadowQuarantinePredictionV2(input);
      expect(first.ok).toBe(true);

      // Second call — identical retry: store returns IDEMPOTENT_IDENTICAL_SUCCESS.
      const second = await orchestrateMLBShadowQuarantinePredictionV2(input);
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
    it('24. VERIFICATION_FAILED maps to QUARANTINE_VERIFICATION_FAILED', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-24-');
      const input = buildOrchestratorV2Input(repoRoot);
      expectValidV2Job(input);

      // Mock readFile to return mismatched bytes → store read-back verification fails.
      vi.mocked(fs.readFile).mockResolvedValueOnce(
        'mismatched-canonical-bytes',
      );

      const result = await orchestrateMLBShadowQuarantinePredictionV2(input);

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
      const repoRoot = await trackedTempDir('orch-v2-test-25-');
      const input = buildOrchestratorV2Input(repoRoot);
      expectValidV2Job(input);

      vi.mocked(fs.readFile).mockResolvedValueOnce(
        'mismatched-canonical-bytes',
      );

      await orchestrateMLBShadowQuarantinePredictionV2(input);

      // The artifact MUST still exist on disk — not deleted.
      const artifactPath = artifactPathFor(repoRoot, 'synthetic-shadow-v2-001');
      await expect(fs.access(artifactPath)).resolves.toBeUndefined();
    });

    /* 26. verification-failed artifact is not deleted/rewritten */
    it('26. verification-failed artifact is not deleted/rewritten', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-26-');
      const input = buildOrchestratorV2Input(repoRoot);
      expectValidV2Job(input);

      vi.mocked(fs.readFile).mockResolvedValueOnce(
        'mismatched-canonical-bytes',
      );

      const result = await orchestrateMLBShadowQuarantinePredictionV2(input);

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
      const artifactPath = artifactPathFor(repoRoot, 'synthetic-shadow-v2-001');
      await expect(fs.access(artifactPath)).resolves.toBeUndefined();
    });

    /* 27. PAYLOAD_HASH_MISMATCH maps to QUARANTINE_WRITE_FAILED with allowlisted code */
    it('27. PAYLOAD_HASH_MISMATCH maps to QUARANTINE_WRITE_FAILED with allowlisted code', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-27-');
      const input = buildOrchestratorV2Input(repoRoot);
      expectValidV2Job(input);

      vi.mocked(persistMLBShadowQuarantinedPrediction).mockReset();
      vi.mocked(persistMLBShadowQuarantinedPrediction).mockResolvedValueOnce(
        mockStoreFailureResult('PAYLOAD_HASH_MISMATCH'),
      );

      const result = await orchestrateMLBShadowQuarantinePredictionV2(input);

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
      const repoRoot = await trackedTempDir('orch-v2-test-28-');
      const input = buildOrchestratorV2Input(repoRoot);
      expectValidV2Job(input);

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
      vi.mocked(persistMLBShadowQuarantinedPrediction).mockResolvedValueOnce(
        unexpectedResult,
      );

      const result = await orchestrateMLBShadowQuarantinePredictionV2(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.pipelineStatus).toBe('QUARANTINE_WRITE_FAILED');
        expect(result.value.failureCode).toBe('QUARANTINE_WRITE_FAILED');
        expect(result.value.failureCode).not.toBe('UNEXPECTED_FUTURE_STATUS');
      }
    });
  });

  /* ========================================================================== */
  /*  E. Locked scientific policy                                                */
  /* ========================================================================== */

  describe('E. locked scientific policy', () => {
    /* 29. locked scientific policy fields remain builder-owned */
    it('29. locked scientific policy fields remain builder-owned', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-29-');
      const input = buildOrchestratorV2Input(repoRoot);
      expectValidV2Job(input);

      const result = await orchestrateMLBShadowQuarantinePredictionV2(input);

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

    /* 30. sourceCandidateFingerprint remains recipe fingerprint only */
    it('30. sourceCandidateFingerprint remains recipe fingerprint only', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-30-');
      const input = buildOrchestratorV2Input(repoRoot);
      expectValidV2Job(input);

      const result = await orchestrateMLBShadowQuarantinePredictionV2(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sourceCandidateRecipeId).toBe('mlb-v1-inner-candidate-003');
        expect(result.value.sourceCandidateFingerprint).toBe(
          'ce35df51cdf38ed9bf91aa2fb78871443f259c963d8c2700e8b6fe5d960a95bc',
        );
      }
    });
  });

  /* ========================================================================== */
  /*  F. Filesystem safety                                                     */
  /* ========================================================================== */

  describe('F. filesystem safety', () => {
    /* 31. temporary repoRoot only */
    it('31. temporary repoRoot only — no files outside temp root', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-31-');
      const input = buildOrchestratorV2Input(repoRoot);
      expectValidV2Job(input);

      const result = await orchestrateMLBShadowQuarantinePredictionV2(input);

      expect(result.ok).toBe(true);

      // Artifact path must be within repoRoot.
      const artifactPath = artifactPathFor(repoRoot, 'synthetic-shadow-v2-001');
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
      const repoRoot = await trackedTempDir('orch-v2-test-32-');
      const input = buildOrchestratorV2Input(repoRoot);
      expectValidV2Job(input);

      await orchestrateMLBShadowQuarantinePredictionV2(input);

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

  /* ========================================================================== */
  /*  G. Input immutability                                                    */
  /* ========================================================================== */

  describe('G. input immutability', () => {
    /* 16. input is not mutated */
    it('16g. input is not mutated', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-16g-');
      const frozenInput = buildOrchestratorV2Input(repoRoot);
      Object.freeze(frozenInput);
      const snapshotBefore = JSON.stringify(frozenInput);

      vi.mocked(persistMLBShadowQuarantinedPrediction).mockReset();
      vi.mocked(persistMLBShadowQuarantinedPrediction).mockResolvedValueOnce(
        mockPersistedResult(),
      );

      await orchestrateMLBShadowQuarantinePredictionV2(frozenInput);
      const snapshotAfter = JSON.stringify(frozenInput);
      expect(snapshotAfter).toBe(snapshotBefore);
    });

    /* 17. authorized model artifact is not mutated */
    it('17g. authorized model artifact is not mutated', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-17g-');
      const artifact = getMLBShadowCandidate003AuthorizedModelArtifact();
      const artifactBefore = JSON.parse(JSON.stringify(artifact));
      const input = buildOrchestratorV2Input(repoRoot);

      vi.mocked(persistMLBShadowQuarantinedPrediction).mockReset();
      vi.mocked(persistMLBShadowQuarantinedPrediction).mockResolvedValueOnce(
        mockPersistedResult(),
      );

      await orchestrateMLBShadowQuarantinePredictionV2(input);
      const artifactAfter = JSON.parse(JSON.stringify(artifact));
      expect(artifactAfter).toEqual(artifactBefore);
    });

    /* 18. featureManifest is not mutated */
    it('18g. featureManifest is not mutated', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-18g-');
      const manifest = MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1;
      const manifestBefore = JSON.parse(JSON.stringify(manifest));
      const input = buildOrchestratorV2Input(repoRoot);

      vi.mocked(persistMLBShadowQuarantinedPrediction).mockReset();
      vi.mocked(persistMLBShadowQuarantinedPrediction).mockResolvedValueOnce(
        mockPersistedResult(),
      );

      await orchestrateMLBShadowQuarantinePredictionV2(input);
      const manifestAfter = JSON.parse(JSON.stringify(manifest));
      expect(manifestAfter).toEqual(manifestBefore);
    });

    /* 19. snapshot is not mutated */
    it('19g. snapshot is not mutated', async () => {
      const repoRoot = await trackedTempDir('orch-v2-test-19g-');
      const input = buildOrchestratorV2Input(repoRoot);
      const snapshot = input.snapshot as Record<string, unknown>;
      const snapshotBefore = JSON.parse(JSON.stringify(snapshot));

      vi.mocked(persistMLBShadowQuarantinedPrediction).mockReset();
      vi.mocked(persistMLBShadowQuarantinedPrediction).mockResolvedValueOnce(
        mockPersistedResult(),
      );

      await orchestrateMLBShadowQuarantinePredictionV2(input);
      const snapshotAfter = JSON.parse(JSON.stringify(snapshot));
      expect(snapshotAfter).toEqual(snapshotBefore);
    });
  });
});
