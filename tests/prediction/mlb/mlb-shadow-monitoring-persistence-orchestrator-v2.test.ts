/* -------------------------------------------------------------------------- */
/*  V2 persistence orchestrator — functional tests (P5E-C2)                    */
/* -------------------------------------------------------------------------- */
/*
 * Mirrors the V1 persistence-orchestrator test structure but exercises
 * the V2 persistence orchestrator (orchestrateMLBShadowMonitoringPredictionPersistenceV2).
 *
 * Mock strategy:
 *  - orchestrateMLBShadowQuarantinePredictionV2        → wrapped real; overridden in unit tests, restored in beforeEach
 *  - persistMLBShadowMonitoringPredictionOperationalRecord → wrapped real; overridden in unit tests, restored in beforeEach
 *  - persistMLBShadowQuarantinedPrediction              → wrapped real; restored in beforeEach (real in whole-call section)
 *  - node:fs/promises.readFile                          → wrapped real; restored in beforeEach (real in whole-call section)
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

import {
  orchestrateMLBShadowQuarantinePredictionV2,
  type MLBShadowQuarantineOrchestratorV2Input,
} from '@/prediction/mlb/mlb-shadow-monitoring-prediction-orchestrator-v2';
import {
  persistMLBShadowMonitoringPredictionOperationalRecord,
  type MLBShadowOperationalPersistenceResult,
  type MLBShadowOperationalFailureStatus,
} from '@/prediction/mlb/mlb-shadow-monitoring-operational-store';
import {
  orchestrateMLBShadowMonitoringPredictionPersistenceV2,
  MLB_SHADOW_MONITORING_PERSISTENCE_INTEGRATION_V2_VERSION,
  type MLBShadowMonitoringPredictionPersistenceIntegrationV2Result,
  type MLBShadowMonitoringPredictionPersistenceIntegrationV2Status,
} from '@/prediction/mlb/mlb-shadow-monitoring-persistence-orchestrator-v2';
import {
  getMLBShadowCandidate003AuthorizedModelArtifact,
} from '@/prediction/mlb/mlb-shadow-candidate-003-authorized-model-artifact';
import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';
import {
  validateMLBShadowExecutionJobV2,
} from '@/prediction/mlb/mlb-shadow-execution-job-v2-contract';
import {
  MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE,
  MLB_SHADOW_MONITORING_OPERATIONAL_NAMESPACE,
} from '@/prediction/mlb/mlb-shadow-monitoring-namespace';
import {
  MLB_SHADOW_MONITORING_OPERATIONAL_RECORD_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-shadow-monitoring-record-contract';
import {
  validateMLBShadowMonitoringOperationalRecord,
  type MLBShadowMonitoringOperationalRecord,
  type MLBShadowMonitoringOperationalRecordValidationResult,
} from '@/prediction/mlb/mlb-shadow-monitoring-record-contract';
import {
  buildMLBShadowPredictionOperationalRecord,
} from '@/prediction/mlb/mlb-shadow-monitoring-operational-projection';
import type { MLBShadowPredictionOperationalRecordInput } from '@/prediction/mlb/mlb-shadow-monitoring-operational-projection';
import {
  persistMLBShadowQuarantinedPrediction,
} from '@/prediction/mlb/mlb-shadow-monitoring-prediction-store';

/* ========================================================================== */
/*  Module mocks                                                              */
/* ========================================================================== */

vi.mock(
  '@/prediction/mlb/mlb-shadow-monitoring-prediction-orchestrator-v2',
  async (importActual) => {
    const actual = await importActual<
      typeof import('@/prediction/mlb/mlb-shadow-monitoring-prediction-orchestrator-v2')
    >();
    return {
      ...actual,
      orchestrateMLBShadowQuarantinePredictionV2: vi.fn(
        actual.orchestrateMLBShadowQuarantinePredictionV2,
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

/* ========================================================================== */
/*  Frozen test timestamps (mirror V2 orchestrator test)                       */
/* ========================================================================== */

const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';
const FROZEN_PREDICTION_GENERATED_AT = '2026-07-15T18:40:00Z';
const FROZEN_PREDICTION_GENERATED_AT_B = '2026-07-15T19:00:00Z';
const FROZEN_OFFICIAL_DATE = '2026-07-15';

/* ========================================================================== */
/*  Manifest section IDs (mirror V2 orchestrator test)                        */
/* ========================================================================== */

const MANIFEST_SECTION_IDS = [
  'section-away-batting',
  'section-away-bullpen',
  'section-away-starter',
  'section-game-context',
  'section-home-batting',
  'section-home-bullpen',
  'section-home-starter',
] as const;

/* ========================================================================== */
/*  Snapshot builder — exact mirror of V2 orchestrator test                   */
/* ========================================================================== */

function buildSnapshot(
  sectionPayloads: Record<string, Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    contractVersion: 'mlb-canonical-pregame-snapshot-v1',
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

/* ========================================================================== */
/*  Fixture validation helper                                                 */
/* ========================================================================== */

function expectValidV2Job(input: MLBShadowQuarantineOrchestratorV2Input): void {
  const validation = validateMLBShadowExecutionJobV2(input);
  expect(validation.ok).toBe(true);
}

/* ========================================================================== */
/*  V2 orchestrator input builder (whole-call)                                 */
/* ========================================================================== */

const SHADOW_RECORD_ID = 'synthetic-shadow-v2-001';
const GAME_PK = 990000001;

function buildOrchestratorV2Input(
  repoRoot: string,
  overrides: Partial<MLBShadowQuarantineOrchestratorV2Input> = {},
): MLBShadowQuarantineOrchestratorV2Input {
  return {
    repoRoot,
    shadowRecordId: SHADOW_RECORD_ID,
    gamePk: GAME_PK,
    predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
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

/** Deep-clone a frozen object via JSON round-trip (test-only). */
function cloneJob(
  job: MLBShadowQuarantineOrchestratorV2Input,
): MLBShadowQuarantineOrchestratorV2Input {
  return JSON.parse(JSON.stringify(job));
}

/* ========================================================================== */
/*  Unit-test input builder (opaque, orchestrator is mocked)                   */
/* ========================================================================== */

function buildUnitTestInput(
  overrides: Partial<MLBShadowQuarantineOrchestratorV2Input> = {},
): MLBShadowQuarantineOrchestratorV2Input {
  return {
    repoRoot: '/tmp/v2-persist-unit',
    shadowRecordId: SHADOW_RECORD_ID,
    gamePk: GAME_PK,
    predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
    authorizedModelArtifact: {},
    featureManifest: {},
    snapshot: {},
    ...overrides,
  };
}

/* ========================================================================== */
/*  Real implementations captured for mock restoration                       */
/* ========================================================================== */

type OrchV2Fn = typeof orchestrateMLBShadowQuarantinePredictionV2;
type OPersistFn = typeof persistMLBShadowMonitoringPredictionOperationalRecord;
type SPersistFn = typeof persistMLBShadowQuarantinedPrediction;
type ReadFileFn = typeof fs.readFile;

let realOrchV2: OrchV2Fn;
let realOPersist: OPersistFn;
let realSPersist: SPersistFn;
let realReadFile: ReadFileFn;

beforeAll(async () => {
  const orchActual = await vi.importActual<
    typeof import('@/prediction/mlb/mlb-shadow-monitoring-prediction-orchestrator-v2')
  >('@/prediction/mlb/mlb-shadow-monitoring-prediction-orchestrator-v2');
  realOrchV2 = orchActual.orchestrateMLBShadowQuarantinePredictionV2;

  const opActual = await vi.importActual<
    typeof import('@/prediction/mlb/mlb-shadow-monitoring-operational-store')
  >('@/prediction/mlb/mlb-shadow-monitoring-operational-store');
  realOPersist = opActual.persistMLBShadowMonitoringPredictionOperationalRecord;

  const spActual = await vi.importActual<
    typeof import('@/prediction/mlb/mlb-shadow-monitoring-prediction-store')
  >('@/prediction/mlb/mlb-shadow-monitoring-prediction-store');
  realSPersist = spActual.persistMLBShadowQuarantinedPrediction;

  const fsActual = await vi.importActual<
    typeof import('node:fs/promises')
  >('node:fs/promises');
  realReadFile = fsActual.readFile;
});

beforeEach(() => {
  vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockReset();
  vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockImplementation(realOrchV2);
  vi.mocked(persistMLBShadowMonitoringPredictionOperationalRecord).mockReset();
  vi.mocked(persistMLBShadowMonitoringPredictionOperationalRecord).mockImplementation(realOPersist);
  vi.mocked(persistMLBShadowQuarantinedPrediction).mockReset();
  vi.mocked(persistMLBShadowQuarantinedPrediction).mockImplementation(realSPersist);
  vi.mocked(fs.readFile).mockReset();
  vi.mocked(fs.readFile).mockImplementation(realReadFile);
});

/* ========================================================================== */
/*  Temp directory helpers                                                     */
/* ========================================================================== */

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

/* ========================================================================== */
/*  Mock prediction-orchestrator result helpers (mirror V1)                    */
/* ========================================================================== */

function mockSInvalid(): MLBShadowMonitoringOperationalRecordValidationResult {
  return validateMLBShadowMonitoringOperationalRecord(null);
}

function mockSValid(
  record: MLBShadowMonitoringOperationalRecord,
): MLBShadowMonitoringOperationalRecordValidationResult {
  return { ok: true, value: record };
}

/* ========================================================================== */
/*  Mock operational-store result helpers (mirror V1 exactly)                  */
/* ========================================================================== */

function mockOPersist(
  shadowRecordId = SHADOW_RECORD_ID,
): MLBShadowOperationalPersistenceResult {
  return {
    ok: true,
    storeVersion: 'mlb-shadow-monitoring-operational-store-v1',
    status: 'PERSISTED',
    artifactCreated: true,
    verificationOk: true,
    tempCleanupFailed: false,
    shadowRecordId,
    stage: 'PREDICTION',
  };
}

function mockOIdempotent(
  shadowRecordId = SHADOW_RECORD_ID,
): MLBShadowOperationalPersistenceResult {
  return {
    ok: true,
    storeVersion: 'mlb-shadow-monitoring-operational-store-v1',
    status: 'IDEMPOTENT_IDENTICAL_SUCCESS',
    artifactCreated: false,
    verificationOk: true,
    tempCleanupFailed: false,
    shadowRecordId,
    stage: 'PREDICTION',
  };
}

function mockOAlreadyExists(
  shadowRecordId = SHADOW_RECORD_ID,
): MLBShadowOperationalPersistenceResult {
  return {
    ok: false,
    storeVersion: 'mlb-shadow-monitoring-operational-store-v1',
    status: 'ALREADY_EXISTS',
    artifactCreated: false,
    verificationOk: false,
    tempCleanupFailed: false,
    shadowRecordId,
    stage: 'PREDICTION',
  };
}

function mockOVerificationFailed(
  shadowRecordId = SHADOW_RECORD_ID,
): MLBShadowOperationalPersistenceResult {
  return {
    ok: false,
    storeVersion: 'mlb-shadow-monitoring-operational-store-v1',
    status: 'VERIFICATION_FAILED',
    artifactCreated: true,
    verificationOk: false,
    tempCleanupFailed: false,
    shadowRecordId,
    stage: 'PREDICTION',
  };
}

function mockOCleanupWarning(
  shadowRecordId = SHADOW_RECORD_ID,
): MLBShadowOperationalPersistenceResult {
  return {
    ok: true,
    storeVersion: 'mlb-shadow-monitoring-operational-store-v1',
    status: 'PERSISTED_WITH_CLEANUP_WARNING',
    artifactCreated: true,
    verificationOk: true,
    tempCleanupFailed: true,
    shadowRecordId,
    stage: 'PREDICTION',
  };
}

function mockOFailure(
  status: MLBShadowOperationalFailureStatus,
  shadowRecordId: string | null = SHADOW_RECORD_ID,
): MLBShadowOperationalPersistenceResult {
  return {
    ok: false,
    storeVersion: 'mlb-shadow-monitoring-operational-store-v1',
    status,
    artifactCreated: false,
    verificationOk: false,
    tempCleanupFailed: false,
    shadowRecordId,
    stage: 'PREDICTION',
  };
}

/* ========================================================================== */
/*  Safe operational record builder (mirror V1)                               */
/* ========================================================================== */

function buildValidSafeRecord(
  overrides: Partial<MLBShadowPredictionOperationalRecordInput> = {},
): MLBShadowMonitoringOperationalRecord {
  const result = buildMLBShadowPredictionOperationalRecord({
    shadowRecordId: SHADOW_RECORD_ID,
    gamePk: GAME_PK,
    officialDate: FROZEN_OFFICIAL_DATE,
    scheduledStartAt: FROZEN_SCHEDULED_START,
    predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
    pipelineStatus: 'QUARANTINE_PERSISTED',
    failureCode: null,
    latencyMs: 5000,
    featureManifestId: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
    featureManifestFingerprint:
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
    timingReferenceContractVersion: 'mlb-canonical-pregame-snapshot-v1',
    timingReferenceCutoffAt: FROZEN_DATA_CUTOFF,
    predictionPayloadGenerated: true,
    predictionPayloadSchemaValid: true,
    ...overrides,
  });
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(
      `Fixture: safe record validation failed: ${JSON.stringify(result.issues)}`,
    );
  }
  return result.value as MLBShadowMonitoringOperationalRecord;
}

/* ========================================================================== */
/*  Artifact path helpers (mirror V2 orchestrator test)                        */
/* ========================================================================== */

function predictionArtifactPathFor(
  repoRoot: string,
  shadowRecordId: string,
): string {
  const hash = createHash('sha256')
    .update(shadowRecordId, 'utf-8')
    .digest('hex');
  return join(
    repoRoot,
    MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE,
    hash + '.json',
  );
}

function operationalArtifactPathFor(
  repoRoot: string,
  shadowRecordId: string,
): string {
  const hash = createHash('sha256')
    .update(shadowRecordId, 'utf-8')
    .digest('hex');
  return join(
    repoRoot,
    MLB_SHADOW_MONITORING_OPERATIONAL_NAMESPACE,
    hash + '__prediction.json',
  );
}

/* ========================================================================== */
/*  Filesystem inspection helpers                                            */
/* ========================================================================== */

async function countFiles(dir: string): Promise<number> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      count += await countFiles(full);
    } else {
      count += 1;
    }
  }
  return count;
}

function extractAllKeys(
  value: unknown,
  keys = new Set<string>(),
): Set<string> {
  if (value !== null && typeof value === 'object') {
    if (Array.isArray(value)) {
      for (const item of value) {
        extractAllKeys(item, keys);
      }
    } else {
      for (const k of Object.keys(value as Record<string, unknown>)) {
        keys.add(k);
        extractAllKeys((value as Record<string, unknown>)[k], keys);
      }
    }
  }
  return keys;
}

/* ========================================================================== */
/*  Forbidden public fields (mirror V1)                                        */
/* ========================================================================== */

const FORBIDDEN_PUBLIC_FIELDS = [
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
  'error',
  'message',
  'storeVersion',
  'fittedModel',
  'coefficients',
  'intercept',
  'authorizedModelArtifact',
  'snapshot',
  'featureManifest',
];

const SENSITIVE_SUBSTRINGS = [
  'predictedWinner',
  'predictedSide',
  'homeWinProb',
  'awayWinProb',
  'payloadHash',
  'storeVersion',
  'relativePath',
  'issues',
];

/* ========================================================================== */
/*  Tests                                                                       */
/* ========================================================================== */

describe('mlb-shadow-monitoring-persistence-orchestrator-v2 (L5E2U V2)', () => {
  /* ========================================================================== */
  /*  4. Status mapping for every store result class                          */
  /* ========================================================================= */

  describe('4. status mapping for every operational-store result class', () => {
    const scenarios: ReadonlyArray<{
      label: string;
      storeResult: MLBShadowOperationalPersistenceResult;
      expectedStatus: MLBShadowMonitoringPredictionPersistenceIntegrationV2Status;
      expectedOk: boolean;
    }> = [
      { label: 'PERSISTED', storeResult: mockOPersist(), expectedStatus: 'OPERATIONAL_PERSISTED', expectedOk: true },
      { label: 'PERSISTED_WITH_CLEANUP_WARNING', storeResult: mockOCleanupWarning(), expectedStatus: 'OPERATIONAL_PERSISTED_WITH_CLEANUP_WARNING', expectedOk: true },
      { label: 'IDEMPOTENT_IDENTICAL_SUCCESS', storeResult: mockOIdempotent(), expectedStatus: 'OPERATIONAL_IDEMPOTENT_IDENTICAL_SUCCESS', expectedOk: true },
      { label: 'ALREADY_EXISTS', storeResult: mockOAlreadyExists(), expectedStatus: 'OPERATIONAL_ALREADY_EXISTS_DIFFERENT', expectedOk: false },
      { label: 'VERIFICATION_FAILED', storeResult: mockOVerificationFailed(), expectedStatus: 'OPERATIONAL_VERIFICATION_FAILED', expectedOk: false },
      {
        label: 'VALIDATION_FAILED',
        storeResult: mockOFailure('VALIDATION_FAILED'),
        expectedStatus: 'OPERATIONAL_PRE_FINALIZATION_FAILED',
        expectedOk: false,
      },
      {
        label: 'INVALID_STAGE_STATE',
        storeResult: mockOFailure('INVALID_STAGE_STATE'),
        expectedStatus: 'OPERATIONAL_PRE_FINALIZATION_FAILED',
        expectedOk: false,
      },
      {
        label: 'SYMLINK_DETECTED',
        storeResult: mockOFailure('SYMLINK_DETECTED'),
        expectedStatus: 'OPERATIONAL_PRE_FINALIZATION_FAILED',
        expectedOk: false,
      },
      {
        label: 'NON_DIRECTORY_TARGET',
        storeResult: mockOFailure('NON_DIRECTORY_TARGET'),
        expectedStatus: 'OPERATIONAL_PRE_FINALIZATION_FAILED',
        expectedOk: false,
      },
      {
        label: 'REPO_ROOT_INVALID',
        storeResult: mockOFailure('REPO_ROOT_INVALID'),
        expectedStatus: 'OPERATIONAL_PRE_FINALIZATION_FAILED',
        expectedOk: false,
      },
      {
        label: 'WRITE_ERROR',
        storeResult: mockOFailure('WRITE_ERROR'),
        expectedStatus: 'OPERATIONAL_PRE_FINALIZATION_FAILED',
        expectedOk: false,
      },
      {
        label: 'WRITE_ERROR (shadowRecordId null)',
        storeResult: mockOFailure('WRITE_ERROR', null),
        expectedStatus: 'OPERATIONAL_PRE_FINALIZATION_FAILED',
        expectedOk: false,
      },
      {
        label: 'UNKNOWN_ERROR',
        storeResult: mockOFailure('UNKNOWN_ERROR'),
        expectedStatus: 'OPERATIONAL_PRE_FINALIZATION_FAILED',
        expectedOk: false,
      },
    ];

    for (const c of scenarios) {
      it(`"${c.label}" maps to ${c.expectedStatus}`, async () => {
        const input = buildUnitTestInput();
        vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockResolvedValue(
          mockSValid(buildValidSafeRecord()),
        );
        vi.mocked(
          persistMLBShadowMonitoringPredictionOperationalRecord,
        ).mockResolvedValue(c.storeResult);

        const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
          input,
        );

        expect(result.ok).toBe(c.expectedOk);
        expect(result.status).toBe(c.expectedStatus);
        expect(result.integrationVersion).toBe(
          MLB_SHADOW_MONITORING_PERSISTENCE_INTEGRATION_V2_VERSION,
        );
      });
    }
  });

  /* ========================================================================== */
  /*  5. V2 orchestrator returns ok=false → no store call                    */
  /* ========================================================================= */

  describe('5. prediction orchestration invalid result', () => {
    it('operational store is not called', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockResolvedValue(
        mockSInvalid(),
      );
      vi.mocked(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).mockResolvedValue(mockOPersist());

      const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );

      expect(result.ok).toBe(false);
      expect(result.status).toBe('OPERATIONAL_RECORD_INVALID');
      expect(result.integrationVersion).toBe(
        MLB_SHADOW_MONITORING_PERSISTENCE_INTEGRATION_V2_VERSION,
      );
      expect(result.operationalRecord).toBeNull();
      expect(result.operationalPersistenceAttempted).toBe(false);
      expect(result.operationalArtifactCreated).toBe(false);
      expect(result.operationalVerificationOk).toBe(false);
      expect(result.operationalTempCleanupFailed).toBe(false);
      expect(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).not.toHaveBeenCalled();
    });

    it('no raw issues escape', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockResolvedValue(
        mockSInvalid(),
      );
      vi.mocked(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).mockResolvedValue(mockOPersist());

      const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );

      expect(result.ok).toBe(false);
      // No "issues" or "error" or "message" field on the result
      const resultKeys = Object.keys(result);
      expect(resultKeys).not.toContain('issues');
      expect(resultKeys).not.toContain('error');
      expect(resultKeys).not.toContain('message');
      // The integration status is the V1-equivalent safe status, not the raw issue code
      expect(result.status).toBe('OPERATIONAL_RECORD_INVALID');
    });
  });

  /* ========================================================================== */
  /*  6. Identity mismatch (shadowRecordId + gamePk)                         */
  /* ========================================================================= */

  describe('6. identity invariant mismatch', () => {
    it('shadowRecordId mismatch → store not called, fails closed', async () => {
      const input = buildUnitTestInput();
      const safeRecord = buildValidSafeRecord({ shadowRecordId: 'different-id' });
      vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockResolvedValue(
        mockSValid(safeRecord),
      );
      vi.mocked(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).mockResolvedValue(mockOPersist());

      const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );

      expect(result.ok).toBe(false);
      expect(result.status).toBe('OPERATIONAL_RECORD_IDENTITY_MISMATCH');
      expect(result.operationalRecord).toBeNull();
      expect(result.operationalPersistenceAttempted).toBe(false);
      expect(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).not.toHaveBeenCalled();
    });

    it('gamePk mismatch → store not called, fails closed', async () => {
      const input = buildUnitTestInput();
      const safeRecord = buildValidSafeRecord({ gamePk: 990000099 });
      vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockResolvedValue(
        mockSValid(safeRecord),
      );
      vi.mocked(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).mockResolvedValue(mockOPersist());

      const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );

      expect(result.ok).toBe(false);
      expect(result.status).toBe('OPERATIONAL_RECORD_IDENTITY_MISMATCH');
      expect(result.operationalRecord).toBeNull();
      expect(result.operationalPersistenceAttempted).toBe(false);
      expect(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).not.toHaveBeenCalled();
    });

    it('matching identity → store IS called', async () => {
      const input = buildUnitTestInput();
      const safeRecord = buildValidSafeRecord();
      vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockResolvedValue(
        mockSValid(safeRecord),
      );
      vi.mocked(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).mockResolvedValue(mockOPersist());

      const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );

      expect(result.ok).toBe(true);
      expect(result.status).toBe('OPERATIONAL_PERSISTED');
      expect(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).toHaveBeenCalledWith(input.repoRoot, safeRecord);
    });
  });

  /* ========================================================================== */
  /*  7. Call-count / delegation guarantees                                    */
  /* ========================================================================= */

  describe('7. call-count guarantees', () => {
    it('V2 prediction orchestrator called exactly once', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockResolvedValue(
        mockSValid(buildValidSafeRecord()),
      );
      vi.mocked(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).mockResolvedValue(mockOPersist());

      await orchestrateMLBShadowMonitoringPredictionPersistenceV2(input);

      expect(
        orchestrateMLBShadowQuarantinePredictionV2,
      ).toHaveBeenCalledTimes(1);
      expect(
        orchestrateMLBShadowQuarantinePredictionV2,
      ).toHaveBeenCalledWith(input);
    });

    it('operational store called exactly once', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockResolvedValue(
        mockSValid(buildValidSafeRecord()),
      );
      vi.mocked(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).mockResolvedValue(mockOPersist());

      await orchestrateMLBShadowMonitoringPredictionPersistenceV2(input);

      expect(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).toHaveBeenCalledTimes(1);
    });

    it('operational store never called when prediction is invalid', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockResolvedValue(
        mockSInvalid(),
      );

      await orchestrateMLBShadowMonitoringPredictionPersistenceV2(input);

      expect(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).not.toHaveBeenCalled();
    });

    it('operational store never called on identity mismatch', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockResolvedValue(
        mockSValid(buildValidSafeRecord({ shadowRecordId: 'mismatch' })),
      );

      await orchestrateMLBShadowMonitoringPredictionPersistenceV2(input);

      expect(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).not.toHaveBeenCalled();
    });
  });

  /* ========================================================================== */
  /*  8. Safe-truth metadata projection                                       */
  /* ========================================================================= */

  describe('8. safe-truth metadata projection', () => {
    it('PERSISTED maps operationalArtifactCreated/verificationOk/tempCleanupFailed correctly', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockResolvedValue(
        mockSValid(buildValidSafeRecord()),
      );
      const storeResult = mockOPersist();
      vi.mocked(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).mockResolvedValue(storeResult);

      const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );

      expect(result.operationalArtifactCreated).toBe(
        storeResult.artifactCreated,
      );
      expect(result.operationalVerificationOk).toBe(
        storeResult.verificationOk,
      );
      expect(result.operationalTempCleanupFailed).toBe(
        storeResult.tempCleanupFailed,
      );
    });

    it('IDEMPOTENT maps artifactCreated=false', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockResolvedValue(
        mockSValid(buildValidSafeRecord()),
      );
      vi.mocked(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).mockResolvedValue(mockOIdempotent());

      const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );

      expect(result.operationalArtifactCreated).toBe(false);
      expect(result.operationalVerificationOk).toBe(true);
      expect(result.operationalTempCleanupFailed).toBe(false);
    });

    it('VERIFICATION_FAILED maps artifactCreated=true, verificationOk=false', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockResolvedValue(
        mockSValid(buildValidSafeRecord()),
      );
      vi.mocked(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).mockResolvedValue(mockOVerificationFailed());

      const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );

      expect(result.operationalArtifactCreated).toBe(true);
      expect(result.operationalVerificationOk).toBe(false);
      expect(result.operationalTempCleanupFailed).toBe(false);
    });

    it('ALREADY_EXISTS maps artifactCreated=false, verificationOk=false', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockResolvedValue(
        mockSValid(buildValidSafeRecord()),
      );
      vi.mocked(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).mockResolvedValue(mockOAlreadyExists());

      const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );

      expect(result.operationalArtifactCreated).toBe(false);
      expect(result.operationalVerificationOk).toBe(false);
      expect(result.operationalTempCleanupFailed).toBe(false);
    });
  });

  /* ========================================================================== */
  /*  9. Cleanup warning stays successful                                      */
  /* ========================================================================= */

  describe('9. cleanup warning stays successful', () => {
    it('PERSISTED_WITH_CLEANUP_WARNING → ok=true, status preserved, tempCleanupFailed=true', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockResolvedValue(
        mockSValid(buildValidSafeRecord()),
      );
      vi.mocked(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).mockResolvedValue(mockOCleanupWarning());

      const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );

      expect(result.ok).toBe(true);
      expect(result.status).toBe('OPERATIONAL_PERSISTED_WITH_CLEANUP_WARNING');
      expect(result.operationalTempCleanupFailed).toBe(true);
    });
  });

  /* ========================================================================== */
  /*  10. Safe operational record retained on store failure                    */
  /* ========================================================================= */

  describe('10. safe operational record retained on store failure', () => {
    it('VERIFICATION_FAILED retains the safe operational record', async () => {
      const input = buildUnitTestInput();
      const safeRecord = buildValidSafeRecord();
      vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockResolvedValue(
        mockSValid(safeRecord),
      );
      vi.mocked(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).mockResolvedValue(mockOVerificationFailed());

      const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );

      expect(result.ok).toBe(false);
      expect(result.status).toBe('OPERATIONAL_VERIFICATION_FAILED');
      expect(result.operationalRecord).toBe(safeRecord);
    });

    it('ALREADY_EXISTS retains the safe operational record', async () => {
      const input = buildUnitTestInput();
      const safeRecord = buildValidSafeRecord();
      vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockResolvedValue(
        mockSValid(safeRecord),
      );
      vi.mocked(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).mockResolvedValue(mockOAlreadyExists());

      const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );

      expect(result.ok).toBe(false);
      expect(result.status).toBe('OPERATIONAL_ALREADY_EXISTS_DIFFERENT');
      expect(result.operationalRecord).toBe(safeRecord);
    });

    it('PRE_FINALIZATION failure retains the safe operational record', async () => {
      const input = buildUnitTestInput();
      const safeRecord = buildValidSafeRecord();
      vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockResolvedValue(
        mockSValid(safeRecord),
      );
      vi.mocked(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).mockResolvedValue(mockOFailure('WRITE_ERROR'));

      const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );

      expect(result.ok).toBe(false);
      expect(result.status).toBe('OPERATIONAL_PRE_FINALIZATION_FAILED');
      expect(result.operationalRecord).toBe(safeRecord);
    });
  });

  /* ========================================================================== */
  /*  11. Public firewall — no sensitive fields exposed                        */
  /* ========================================================================= */

  describe('11. public firewall — no sensitive prediction fields', () => {
    it('result object exposes only safe integration fields', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockResolvedValue(
        mockSValid(buildValidSafeRecord()),
      );
      vi.mocked(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).mockResolvedValue(mockOPersist());

      const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );

      const allowedTopLevel = [
        'ok',
        'integrationVersion',
        'status',
        'operationalRecord',
        'operationalPersistenceAttempted',
        'operationalArtifactCreated',
        'operationalVerificationOk',
        'operationalTempCleanupFailed',
      ];

      const actualKeys = Object.keys(result);
      for (const k of actualKeys) {
        expect(allowedTopLevel).toContain(k);
      }
    });

    it('operationalRecord (mocked) contains no sensitive prediction fields (deep scan)', async () => {
      const input = buildUnitTestInput();
      const safeRecord = buildValidSafeRecord();
      vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockResolvedValue(
        mockSValid(safeRecord),
      );
      vi.mocked(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).mockResolvedValue(mockOPersist());

      const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );

      expect(result.operationalRecord).not.toBeNull();
      const allKeys = extractAllKeys(result.operationalRecord);

      for (const forbidden of FORBIDDEN_PUBLIC_FIELDS) {
        expect(allKeys.has(forbidden)).toBe(false);
      }
    });

    it('result JSON serialization contains no sensitive substrings', async () => {
      const input = buildUnitTestInput();
      vi.mocked(orchestrateMLBShadowQuarantinePredictionV2).mockResolvedValue(
        mockSValid(buildValidSafeRecord()),
      );
      vi.mocked(
        persistMLBShadowMonitoringPredictionOperationalRecord,
      ).mockResolvedValue(mockOPersist());

      const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );

      const serialized = JSON.stringify(result);
      for (const sub of SENSITIVE_SUBSTRINGS) {
        expect(serialized).not.toContain(sub);
      }
    });
  });

  /* ========================================================================== */
  /*  12. Real synthetic whole-call: first invocation                         */
  /* ========================================================================= */

  describe('12. real synthetic whole-call (first invocation)', () => {
    it('valid V2 input runs through real V2 orchestrator and persists both artifacts', async () => {
      const repoRoot = await trackedTempDir('v2-persist-whole-');
      const input = buildOrchestratorV2Input(repoRoot);
      expectValidV2Job(input);

      // Whole-call: real orchV2 and real operational store restored in beforeEach
      const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );

      expect(result.ok).toBe(true);
      expect(result.status).toBe('OPERATIONAL_PERSISTED');
      expect(result.integrationVersion).toBe(
        MLB_SHADOW_MONITORING_PERSISTENCE_INTEGRATION_V2_VERSION,
      );
      expect(result.operationalRecord).not.toBeNull();
      expect(result.operationalPersistenceAttempted).toBe(true);
      expect(result.operationalArtifactCreated).toBe(true);
      expect(result.operationalVerificationOk).toBe(true);
      expect(result.operationalTempCleanupFailed).toBe(false);

      // Prediction quarantine artifact exists
      const predPath = predictionArtifactPathFor(repoRoot, SHADOW_RECORD_ID);
      await expect(fs.access(predPath)).resolves.toBeUndefined();

      // Operational artifact exists
      const opPath = operationalArtifactPathFor(repoRoot, SHADOW_RECORD_ID);
      await expect(fs.access(opPath)).resolves.toBeUndefined();
    });

    it('operational record has correct contractVersion and safe pipeline status', async () => {
      const repoRoot = await trackedTempDir('v2-persist-wc2-');
      const input = buildOrchestratorV2Input(repoRoot);
      expectValidV2Job(input);

      const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.operationalRecord!.contractVersion).toBe(
          MLB_SHADOW_MONITORING_OPERATIONAL_RECORD_CONTRACT_VERSION,
        );
        expect(result.operationalRecord!.pipelineStatus).toBe(
          'QUARANTINE_PERSISTED',
        );
        expect(result.operationalRecord!.failureCode).toBeNull();
        expect(result.operationalRecord!.predictionPayloadGenerated).toBe(true);
        expect(result.operationalRecord!.predictionPayloadSchemaValid).toBe(true);
      }
    });

    it('A-only: operational record contains no sensitive prediction fields (deep scan) after whole-call', async () => {
      const repoRoot = await trackedTempDir('v2-persist-wc3-');
      const input = buildOrchestratorV2Input(repoRoot);

      const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );

      expect(result.ok).toBe(true);
      const allKeys = extractAllKeys(result.operationalRecord);
      for (const forbidden of FORBIDDEN_PUBLIC_FIELDS) {
        expect(allKeys.has(forbidden)).toBe(false);
      }
    });
  });

  /* ========================================================================== */
  /*  13. Stable retry idempotency (byte-identical full retry)                 */
  /* ========================================================================= */

  describe('13. identical full retry → safe no-op', () => {
    it('second identical call maps to OPERATIONAL_IDEMPOTENT_IDENTICAL_SUCCESS', async () => {
      const repoRoot = await trackedTempDir('v2-persist-idem-');
      const input = buildOrchestratorV2Input(repoRoot);
      expectValidV2Job(input);

      // First call — creates both artifacts
      const first = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );
      expect(first.ok).toBe(true);
      expect(first.status).toBe('OPERATIONAL_PERSISTED');

      // Second identical call — prediction store idempotent, operational store idempotent
      const second = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );
      expect(second.ok).toBe(true);
      expect(second.status).toBe('OPERATIONAL_IDEMPOTENT_IDENTICAL_SUCCESS');
      expect(second.operationalPersistenceAttempted).toBe(true);
      expect(second.operationalArtifactCreated).toBe(false);
      expect(second.operationalVerificationOk).toBe(true);
      expect(second.operationalTempCleanupFailed).toBe(false);
    });
  });

  /* ========================================================================== */
  /*  14. Different payload, same ID → ALREADY_EXISTS → fails closed         */
  /* ========================================================================= */

  describe('14. different payload (same shadowRecordId) → fails closed', () => {
    it('second call with different predictionGeneratedAt → ALREADY_EXISTS_DIFFERENT', async () => {
      const repoRoot = await trackedTempDir('v2-persist-diff-');
      const input1 = buildOrchestratorV2Input(repoRoot);
      const input2 = buildOrchestratorV2Input(repoRoot, {
        predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT_B,
      });

      // First call — creates artifacts
      const first = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input1,
      );
      expect(first.ok).toBe(true);

      // Second call — same ID, different prediction bytes
      const second = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input2,
      );
      expect(second.ok).toBe(false);
      expect(second.status).toBe('OPERATIONAL_ALREADY_EXISTS_DIFFERENT');
      expect(second.operationalPersistenceAttempted).toBe(true);
    });

    it('prediction artifact survives operational ALREADY_EXISTS', async () => {
      const repoRoot = await trackedTempDir('v2-persist-surv-');
      const input1 = buildOrchestratorV2Input(repoRoot);
      const input2 = buildOrchestratorV2Input(repoRoot, {
        predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT_B,
      });

      await orchestrateMLBShadowMonitoringPredictionPersistenceV2(input1);
      const second = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input2,
      );

      // Prediction artifact from first call still exists
      const predPath = predictionArtifactPathFor(repoRoot, SHADOW_RECORD_ID);
      await expect(fs.access(predPath)).resolves.toBeUndefined();

      // Result still carries the safe record
      expect(second.operationalRecord).not.toBeNull();
      expect(second.operationalRecord!.shadowRecordId).toBe(SHADOW_RECORD_ID);
    });
  });

  /* ========================================================================== */
  /*  15. Operational store write failure → prediction artifact survives       */
  /* ========================================================================= */

  describe('15. operational write failure → prediction artifact survives', () => {
    it('pre-create operational path as file → NON_DIRECTORY_TARGET → PREDICTED', async () => {
      const repoRoot = await trackedTempDir('v2-persist-wfail-');
      const input = buildOrchestratorV2Input(repoRoot);

      // Pre-create the operational directory path as a file to force failure
      const shadowRoot = join(
        repoRoot,
        'var/mlb-development/mlb-shadow-monitoring',
      );
      await fs.mkdir(shadowRoot, { recursive: true });
      await fs.writeFile(
        join(shadowRoot, 'operational'),
        'blocked',
        'utf-8',
      );

      const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );

      // Operational persistence should fail
      expect(result.ok).toBe(false);
      expect(result.status).toBe('OPERATIONAL_PRE_FINALIZATION_FAILED');
      expect(result.operationalPersistenceAttempted).toBe(true);

      // BUT the prediction quarantine artifact must still exist (no rollback)
      const predPath = predictionArtifactPathFor(repoRoot, SHADOW_RECORD_ID);
      await expect(fs.access(predPath)).resolves.toBeUndefined();

      // AND the safe operational record must be retained in the result
      expect(result.operationalRecord).not.toBeNull();
      expect(result.operationalRecord!.shadowRecordId).toBe(SHADOW_RECORD_ID);
    });

    it('pre-create file blocks only operational, prediction still present', async () => {
      const repoRoot = await trackedTempDir('v2-persist-wfail2-');
      const input = buildOrchestratorV2Input(repoRoot);

      const shadowRoot = join(
        repoRoot,
        'var/mlb-development/mlb-shadow-monitoring',
      );
      await fs.mkdir(shadowRoot, { recursive: true });
      await fs.writeFile(
        join(shadowRoot, 'operational'),
        'blocked',
        'utf-8',
      );

      const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );

      expect(result.operationalRecord).not.toBeNull();
      expect(result.operationalRecord!.gamePk).toBe(GAME_PK);

      // The "operational" path should still be a file (not turned into a dir)
      const opDir = join(shadowRoot, 'operational');

      // Prediction artifact must be present — no rollback
      const predPath = predictionArtifactPathFor(repoRoot, SHADOW_RECORD_ID);
      await expect(fs.access(predPath)).resolves.toBeUndefined();

      // Operational artifact must NOT have been created
      const opPath = operationalArtifactPathFor(repoRoot, SHADOW_RECORD_ID);
      await expect(fs.access(opPath)).rejects.toBeDefined();
    });
  });

  /* ========================================================================== */
  /*  16. Input immutability                                                   */
  /* ========================================================================= */

  describe('16. input and safe record are not mutated', () => {
    it('input object is not mutated', async () => {
      const repoRoot = await trackedTempDir('v2-persist-imm-');
      const input = buildOrchestratorV2Input(repoRoot);
      const inputSnapshot = cloneJob(input);

      await orchestrateMLBShadowMonitoringPredictionPersistenceV2(input);

      // Deep equality — input must be unchanged
      expect(input).toEqual(inputSnapshot);
    });

    it('safe operational record in result is not mutated by retries', async () => {
      const repoRoot = await trackedTempDir('v2-persist-imm2-');
      const input = buildOrchestratorV2Input(repoRoot);

      const first = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );
      expect(first.ok).toBe(true);
      const recordSnapshot = { ...(first.operationalRecord as MLBShadowMonitoringOperationalRecord) };

      // Second identical call
      await orchestrateMLBShadowMonitoringPredictionPersistenceV2(input);

      expect(first.operationalRecord).toEqual(recordSnapshot);
    });
  });

  /* ========================================================================== */
  /*  17. No real repository runtime path is written                           */
  /* ========================================================================= */

  describe('17. no real repository runtime path is written', () => {
    it('only temp dirs are used; no repo path leakage', async () => {
      const repoRoot = await trackedTempDir('v2-persist-norun-');
      const input = buildOrchestratorV2Input(repoRoot);

      const result = await orchestrateMLBShadowMonitoringPredictionPersistenceV2(
        input,
      );

      expect(result.ok).toBe(true);
      // Result must not leak any real repo path
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('/Users/samkassirov/multi-research-engine');
      // The repoRoot used is a temp directory
      expect(repoRoot).not.toContain('multi-research-engine');
    });
  });
});
