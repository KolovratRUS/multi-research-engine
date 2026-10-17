/* -------------------------------------------------------------------------- */
/*  Functional tests for the P5F-C2B-R1 handoff                                */
/*  Phase: 8V-D3-C-E4-B4-I3G-LIVE1-L5E2X-P5F-C2B-R1                           */
/* -------------------------------------------------------------------------- */
/*  Mock strategy:                                                              */
/*    - readMLBShadowPreparedExecutionJobV2  → wrapped real; overridden          */
/*      per-section for control-flow tests, restored to real in beforeEach.    */
/*    - executeMLBShadowExecutionJobV2       → wrapped real; overridden          */
/*      per-section for result-preservation tests, restored to real in          */
/*      beforeEach for the whole-chain integration test.                       */
/*                                                                            */
/*  Lower-layer seams (prediction orchestrator, prediction store, operational  */
/*  store, quota store) are NOT mocked — they run as real code under the       */
/*  whole-chain integration test in an isolated temp directory.                */
/* -------------------------------------------------------------------------- */

/* ========================================================================== */
/*  Module mocks (importActual wrappers)                                      */
/* ========================================================================== */

vi.mock(
  '@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-reader',
  async (importActual) => {
    const actual = await importActual<
      typeof import('@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-reader')
    >();
    return {
      ...actual,
      readMLBShadowPreparedExecutionJobV2: vi.fn(
        actual.readMLBShadowPreparedExecutionJobV2,
      ),
    };
  },
);

vi.mock(
  '@/prediction/mlb/mlb-shadow-execution-adapter-v2',
  async (importActual) => {
    const actual = await importActual<
      typeof import('@/prediction/mlb/mlb-shadow-execution-adapter-v2')
    >();
    return {
      ...actual,
      executeMLBShadowExecutionJobV2: vi.fn(
        actual.executeMLBShadowExecutionJobV2,
      ),
    };
  },
);

/* ========================================================================== */
/*  Imports                                                                   */
/* ========================================================================== */

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
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

/* -- Module under test -- */
import {
  MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_HANDOFF_VERSION,
  executeStoredMLBShadowPreparedExecutionJobV2,
} from '@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-handoff';
import type { MLBShadowPreparedExecutionJobV2HandoffResult } from '@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-handoff';

/* -- Mocked dependencies (wrappers around real implementations) -- */
import {
  readMLBShadowPreparedExecutionJobV2,
  MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_READER_VERSION,
} from '@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-reader';
import type { MLBShadowPreparedExecutionJobV2ReaderResult } from '@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-reader';

import {
  executeMLBShadowExecutionJobV2,
  MLB_SHADOW_EXECUTION_ADAPTER_V2_VERSION,
} from '@/prediction/mlb/mlb-shadow-execution-adapter-v2';
import type { MLBShadowExecutionAdapterV2Result } from '@/prediction/mlb/mlb-shadow-execution-adapter-v2';

/* -- Test-only imports (for fixtures + integration setup) -- */
import { persistMLBShadowPreparedExecutionJobV2 } from '@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-store';
import type { MLBShadowPreparedExecutionJobV2 } from '@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-contract';
import { getMLBShadowCandidate003AuthorizedModelArtifact } from '@/prediction/mlb/mlb-shadow-candidate-003-authorized-model-artifact';
import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';
import { MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION } from '@/prediction/mlb/mlb-pregame-snapshot-contract';
import {
  MLB_SHADOW_MONITORING_NAMESPACE_ROOT,
  MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE,
  MLB_SHADOW_MONITORING_OPERATIONAL_NAMESPACE,
} from '@/prediction/mlb/mlb-shadow-monitoring-namespace';
import {
  MLB_SHADOW_MONITORING_PERSISTENCE_INTEGRATION_V2_VERSION,
} from '@/prediction/mlb/mlb-shadow-monitoring-persistence-orchestrator-v2';
import type { MLBShadowMonitoringPredictionPersistenceIntegrationV2Result } from '@/prediction/mlb/mlb-shadow-monitoring-persistence-orchestrator-v2';

/* ========================================================================== */
/*  Constants                                                                   */
/* ========================================================================== */

const HANDOFF_VERSION =
  'mlb-shadow-prepared-execution-job-v2-handoff-v1';
const READER_VERSION = 'mlb-shadow-prepared-execution-job-v2-reader-v1';
const ADAPTER_VERSION = 'mlb-shadow-execution-adapter-v2';

/* Frozen test timestamps */
const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';
const FROZEN_PREDICTION_GENERATED_AT = '2026-07-15T18:40:00Z';
const FROZEN_OFFICIAL_DATE = '2026-07-15';

const SYNTHETIC_SHADOW_RECORD_ID = 'shadow-001';
const INTEGRATION_GAME_PK = 990000001;

/* All 12 sealed reader failure statuses */
const READER_FAILURE_STATUSES = [
  'SHADOW_RECORD_ID_INVALID',
  'REPO_ROOT_INVALID',
  'NOT_FOUND',
  'SYMLINK_DETECTED',
  'NON_DIRECTORY_TARGET',
  'READ_ERROR',
  'MALFORMED_UTF8',
  'MALFORMED_JSON',
  'PREPARED_CONTRACT_VALIDATION_FAILED',
  'NONCANONICAL_BYTES',
  'SHADOW_RECORD_ID_MISMATCH',
  'UNKNOWN_FAILURE',
] as const;

/* Expected 14-field job keys (after repoRoot + 13 prepared fields) */
const JOB_14_KEYS = [
  'repoRoot',
  'shadowRecordId',
  'gamePk',
  'predictionGeneratedAt',
  'authorizedModelArtifact',
  'featureManifest',
  'snapshot',
  'officialDate',
  'scheduledStartAt',
  'latencyMs',
  'featureManifestId',
  'featureManifestFingerprint',
  'timingReferenceContractVersion',
  'timingReferenceCutoffAt',
] as const;

/* Sensitive keys that must NEVER appear on any handoff envelope top-level */
const SENSITIVE_KEYS = new Set([
  'error',
  'message',
  'stack',
  'cause',
  'code',
  'path',
  'errno',
  'ok',
  'predictedWinner',
  'predictedSide',
  'homeWinProbability',
  'awayWinProbability',
  'coefficients',
  'intercept',
  'candidateRecipeFingerprint',
  'modelCanonicalFingerprint',
  'payloadHash',
  'releasedModelResult',
  'prediction',
  'predictionResult',
  'computedAt',
]);

/* Production shadow-monitoring runtime path (must remain untouched) */
const PRODUCTION_RUNTIME_PATH = join(
  process.cwd(),
  'var/mlb-development/mlb-shadow-monitoring',
);

/* ========================================================================== */
/*  Mock fixture builders                                                      */
/* ========================================================================== */

/* Distinct object references for reference-preservation tests */
const MOCK_ARTIFACT_REF = Object.freeze({ candidate: 'candidate-003' });
const MOCK_MANIFEST_REF = Object.freeze({ manifestId: 'manifest-1' });
const MOCK_SNAPSHOT_REF = Object.freeze({ snapshotId: 'snap-1' });

const MOCK_PREPARED_JOB = {
  shadowRecordId: SYNTHETIC_SHADOW_RECORD_ID,
  gamePk: INTEGRATION_GAME_PK,
  predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
  authorizedModelArtifact: MOCK_ARTIFACT_REF,
  featureManifest: MOCK_MANIFEST_REF,
  snapshot: MOCK_SNAPSHOT_REF,
  officialDate: FROZEN_OFFICIAL_DATE,
  scheduledStartAt: FROZEN_SCHEDULED_START,
  latencyMs: 1234,
  featureManifestId: 'manifest-1',
  featureManifestFingerprint: 'a'.repeat(64),
  timingReferenceContractVersion: 'mlb-offline-pregame-inference-contract-v1',
  timingReferenceCutoffAt: FROZEN_DATA_CUTOFF,
} as unknown as MLBShadowPreparedExecutionJobV2;

/* Caller-supplied values (distinct from prepared job fields) */
const CALLER_REPOSITORY_ROOT = '/tmp/handoff-test-repo';
const CALLER_SHADOW_RECORD_ID = 'caller-shadow-999';

/* -------------------------------------------------------------------------- */
/*  Mock reader result builders                                                */
/* -------------------------------------------------------------------------- */

function buildMockReaderFailure(
  status: string,
): MLBShadowPreparedExecutionJobV2ReaderResult {
  return {
    ok: false,
    readerVersion: MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_READER_VERSION,
    status,
  } as unknown as MLBShadowPreparedExecutionJobV2ReaderResult;
}

function buildMockReaderSuccess(): MLBShadowPreparedExecutionJobV2ReaderResult {
  return {
    ok: true,
    readerVersion: MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_READER_VERSION,
    status: 'READ_OK',
    value: MOCK_PREPARED_JOB,
  };
}

/* -------------------------------------------------------------------------- */
/*  Mock adapter result builders                                               */
/* -------------------------------------------------------------------------- */

const MOCK_ADAPTER_OK_TRUE: MLBShadowMonitoringPredictionPersistenceIntegrationV2Result = {
  ok: true,
  integrationVersion: MLB_SHADOW_MONITORING_PERSISTENCE_INTEGRATION_V2_VERSION,
  status: 'OPERATIONAL_PERSISTED',
  operationalRecord: null,
  operationalPersistenceAttempted: true,
  operationalArtifactCreated: true,
  operationalVerificationOk: true,
  operationalTempCleanupFailed: false,
};

const MOCK_ADAPTER_OK_FALSE_INVALID = {
  ok: false,
  adapterVersion: MLB_SHADOW_EXECUTION_ADAPTER_V2_VERSION,
  status: 'EXECUTION_JOB_INVALID',
};

const MOCK_ADAPTER_OK_FALSE_PERSISTENCE: MLBShadowMonitoringPredictionPersistenceIntegrationV2Result = {
  ok: false,
  integrationVersion: MLB_SHADOW_MONITORING_PERSISTENCE_INTEGRATION_V2_VERSION,
  status: 'OPERATIONAL_PRE_FINALIZATION_FAILED',
  operationalRecord: null,
  operationalPersistenceAttempted: false,
  operationalArtifactCreated: false,
  operationalVerificationOk: false,
  operationalTempCleanupFailed: false,
};

/* ========================================================================== */
/*  Real implementation captures                                               */
/* ========================================================================== */

let realRead: typeof readMLBShadowPreparedExecutionJobV2;
let realExecute: typeof executeMLBShadowExecutionJobV2;

beforeAll(async () => {
  const readerActual = await vi.importActual<
    typeof import('@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-reader')
  >('@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-reader');
  realRead = readerActual.readMLBShadowPreparedExecutionJobV2;

  const adapterActual = await vi.importActual<
    typeof import('@/prediction/mlb/mlb-shadow-execution-adapter-v2')
  >('@/prediction/mlb/mlb-shadow-execution-adapter-v2');
  realExecute = adapterActual.executeMLBShadowExecutionJobV2;
});

beforeEach(() => {
  vi.mocked(readMLBShadowPreparedExecutionJobV2).mockReset();
  vi.mocked(readMLBShadowPreparedExecutionJobV2).mockImplementation(realRead);
  vi.mocked(executeMLBShadowExecutionJobV2).mockReset();
  vi.mocked(executeMLBShadowExecutionJobV2).mockImplementation(realExecute);
});

/* ========================================================================== */
/*  Filesystem helpers (temp-root + counters)                                  */
/* ========================================================================== */

const cleanupDirs: string[] = [];

afterEach(async () => {
  while (cleanupDirs.length > 0) {
    const dir = cleanupDirs.pop() as string;
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
});

async function trackedTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(join(tmpdir(), prefix));
  cleanupDirs.push(dir);
  return dir;
}

async function countFiles(dir: string): Promise<number> {
  let count = 0;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        count += await countFiles(full);
      } else {
        count += 1;
      }
    }
  } catch {
    /* directory does not exist or is inaccessible — not an error */
  }
  return count;
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex');
}

function predictionArtifactPathFor(
  repoRoot: string,
  shadowRecordId: string,
): string {
  return join(
    repoRoot,
    MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE,
    sha256Hex(shadowRecordId) + '.json',
  );
}

function operationalArtifactPathFor(
  repoRoot: string,
  shadowRecordId: string,
): string {
  return join(
    repoRoot,
    MLB_SHADOW_MONITORING_OPERATIONAL_NAMESPACE,
    sha256Hex(shadowRecordId) + '__prediction.json',
  );
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

/* -------------------------------------------------------------------------- */
/*  Integration snapshot builder (7 sections, all payloads present)           */
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

function buildIntegrationSnapshot(): Record<string, unknown> {
  return {
    contractVersion: MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    snapshotId: 'snapshot-integration-001',
    capturedAt: FROZEN_CAPTURED_AT,
    dataCutoffAt: FROZEN_DATA_CUTOFF,
    game: {
      gameId: 'game-integration-001',
      scheduledStartAt: FROZEN_SCHEDULED_START,
      officialDate: FROZEN_OFFICIAL_DATE,
      season: 2026,
      gameType: 'REGULAR_SEASON',
      status: 'SCHEDULED',
      homeTeamId: 'home-integration-001',
      awayTeamId: 'away-integration-001',
      venueId: 'venue-integration-001',
      neutralSite: false,
      doubleheader: null,
    },
    startingPitchers: {
      home: {
        state: 'PROBABLE',
        pitcherId: 'p-home-integration',
        announcedAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-game'],
      },
      away: {
        state: 'PROBABLE',
        pitcherId: 'p-away-integration',
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
      payload: ALL_PRESENT_PAYLOADS[sectionId] ?? {},
    })),
    dataCompleteness: 'COMPLETE',
    warnings: [],
  };
}

function buildValidPreparedJobForIntegration(): Record<string, unknown> {
  return {
    shadowRecordId: SYNTHETIC_SHADOW_RECORD_ID,
    gamePk: INTEGRATION_GAME_PK,
    predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
    authorizedModelArtifact:
      getMLBShadowCandidate003AuthorizedModelArtifact(),
    featureManifest: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    snapshot: buildIntegrationSnapshot(),
    officialDate: FROZEN_OFFICIAL_DATE,
    scheduledStartAt: FROZEN_SCHEDULED_START,
    latencyMs: 0,
    featureManifestId: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
    featureManifestFingerprint:
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
    timingReferenceContractVersion: 'mlb-canonical-pregame-snapshot-v1',
    timingReferenceCutoffAt: FROZEN_DATA_CUTOFF,
  };
}

/* ========================================================================== */
/*  Section 1 — READER_FAILURE branch (12 statuses → READER_FAILURE)           */
/* ========================================================================== */

describe('Section 1 — READER_FAILURE branch', () => {
  /* Req 1: every sealed reader failure status produces READER_FAILURE */
  it('1. every sealed reader failure status produces kind=READER_FAILURE with exact fields', async () => {
    for (const status of READER_FAILURE_STATUSES) {
      vi.mocked(readMLBShadowPreparedExecutionJobV2).mockResolvedValue(
        buildMockReaderFailure(status),
      );

      const result = await executeStoredMLBShadowPreparedExecutionJobV2(
        CALLER_REPOSITORY_ROOT,
        CALLER_SHADOW_RECORD_ID,
      );

      expect(result.kind).toBe('READER_FAILURE');
      expect(result.handoffVersion).toBe(HANDOFF_VERSION);
      if (result.kind === 'READER_FAILURE') {
        expect(result.readerVersion).toBe(READER_VERSION);
        expect(result.status).toBe(status);
      }
    }
  });

  /* Req 2: reader finite failure → adapter calls = 0 */
  it('2. reader finite failure: adapter calls = 0', async () => {
    vi.mocked(readMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      buildMockReaderFailure('NOT_FOUND'),
    );

    await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      CALLER_SHADOW_RECORD_ID,
    );

    expect(
      vi.mocked(executeMLBShadowExecutionJobV2).mock.calls.length,
    ).toBe(0);
  });

  /* Req 28: reader failure returns no repoRoot */
  it('28. reader failure envelope returns no repoRoot', async () => {
    vi.mocked(readMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      buildMockReaderFailure('NOT_FOUND'),
    );

    const result = await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      CALLER_SHADOW_RECORD_ID,
    );

    expect(result).not.toHaveProperty('repoRoot');
  });

  /* Req 29: reader failure returns no shadowRecordId */
  it('29. reader failure envelope returns no shadowRecordId', async () => {
    vi.mocked(readMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      buildMockReaderFailure('NOT_FOUND'),
    );

    const result = await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      CALLER_SHADOW_RECORD_ID,
    );

    expect(result).not.toHaveProperty('shadowRecordId');
  });

  /* Req 30: reader failure returns no prepared package */
  it('30a. reader failure envelope returns no prepared package fields', async () => {
    vi.mocked(readMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      buildMockReaderFailure('NOT_FOUND'),
    );

    const result = await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      CALLER_SHADOW_RECORD_ID,
    );

    const keys = Object.keys(result).sort();
    const preparedFields = [
      'shadowRecordId',
      'gamePk',
      'predictionGeneratedAt',
      'authorizedModelArtifact',
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
    for (const f of preparedFields) {
      expect(keys).not.toContain(f);
    }
  });
});

/* ========================================================================== */
/*  Section 2 — ADAPTER_RESULT via reader success (14-field job)                */
/* ========================================================================== */

describe('Section 2 — 14-field job construction', () => {
  beforeEach(() => {
    vi.mocked(readMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      buildMockReaderSuccess(),
    );
    vi.mocked(executeMLBShadowExecutionJobV2).mockResolvedValue(
      MOCK_ADAPTER_OK_TRUE as unknown as MLBShadowExecutionAdapterV2Result,
    );
  });

  function captureJob(): Record<string, unknown> {
    const calls = vi.mocked(executeMLBShadowExecutionJobV2).mock.calls;
    return calls[0][0] as Record<string, unknown>;
  }

  /* Req 3: reader success → adapter calls = exactly 1 */
  it('3. reader success: adapter called exactly once', async () => {
    await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    expect(
      vi.mocked(executeMLBShadowExecutionJobV2).mock.calls.length,
    ).toBe(1);
  });

  /* Req 4: adapter receives exactly 14 own keys */
  it('4. adapter receives exactly 14 own keys', async () => {
    await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    const job = captureJob();
    expect(Object.keys(job).length).toBe(14);
  });

  /* Req 5: repoRoot === caller repoRoot */
  it('5. job repoRoot === caller repoRoot', async () => {
    await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    const job = captureJob();
    expect(job.repoRoot).toBe(CALLER_REPOSITORY_ROOT);
  });

  /* Req 6: shadowRecordId === prepared.shadowRecordId */
  it('6. job shadowRecordId === prepared.shadowRecordId', async () => {
    await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    const job = captureJob();
    expect(job.shadowRecordId).toBe(MOCK_PREPARED_JOB.shadowRecordId);
  });

  /* Req 7: gamePk exact */
  it('7. job gamePk exact', async () => {
    await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    const job = captureJob();
    expect(job.gamePk).toBe(MOCK_PREPARED_JOB.gamePk);
  });

  /* Req 8: predictionGeneratedAt exact */
  it('8. job predictionGeneratedAt exact', async () => {
    await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    const job = captureJob();
    expect(job.predictionGeneratedAt).toBe(
      MOCK_PREPARED_JOB.predictionGeneratedAt,
    );
  });

  /* Req 9: authorizedModelArtifact same reference */
  it('9. job authorizedModelArtifact same reference', async () => {
    await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    const job = captureJob();
    expect(job.authorizedModelArtifact).toBe(
      MOCK_PREPARED_JOB.authorizedModelArtifact,
    );
  });

  /* Req 10: featureManifest same reference */
  it('10. job featureManifest same reference', async () => {
    await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    const job = captureJob();
    expect(job.featureManifest).toBe(MOCK_PREPARED_JOB.featureManifest);
  });

  /* Req 11: snapshot same reference */
  it('11. job snapshot same reference', async () => {
    await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    const job = captureJob();
    expect(job.snapshot).toBe(MOCK_PREPARED_JOB.snapshot);
  });

  /* Req 12: officialDate exact */
  it('12. job officialDate exact', async () => {
    await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    const job = captureJob();
    expect(job.officialDate).toBe(MOCK_PREPARED_JOB.officialDate);
  });

  /* Req 13: scheduledStartAt exact */
  it('13. job scheduledStartAt exact', async () => {
    await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    const job = captureJob();
    expect(job.scheduledStartAt).toBe(MOCK_PREPARED_JOB.scheduledStartAt);
  });

  /* Req 14: latencyMs exact */
  it('14. job latencyMs exact', async () => {
    await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    const job = captureJob();
    expect(job.latencyMs).toBe(MOCK_PREPARED_JOB.latencyMs);
  });

  /* Req 15: featureManifestId exact */
  it('15. job featureManifestId exact', async () => {
    await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    const job = captureJob();
    expect(job.featureManifestId).toBe(MOCK_PREPARED_JOB.featureManifestId);
  });

  /* Req 16: featureManifestFingerprint exact */
  it('16. job featureManifestFingerprint exact', async () => {
    await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    const job = captureJob();
    expect(job.featureManifestFingerprint).toBe(
      MOCK_PREPARED_JOB.featureManifestFingerprint,
    );
  });

  /* Req 17: timingReferenceContractVersion exact */
  it('17. job timingReferenceContractVersion exact', async () => {
    await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    const job = captureJob();
    expect(job.timingReferenceContractVersion).toBe(
      MOCK_PREPARED_JOB.timingReferenceContractVersion,
    );
  });

  /* Req 18: timingReferenceCutoffAt exact */
  it('18. job timingReferenceCutoffAt exact', async () => {
    await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    const job = captureJob();
    expect(job.timingReferenceCutoffAt).toBe(
      MOCK_PREPARED_JOB.timingReferenceCutoffAt,
    );
  });

  /* Req 19: no 15th property (exact 14 keys, correct names) */
  it('19. no 15th property — exactly 14 keys with correct names', async () => {
    await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    const job = captureJob();
    const keys = Object.keys(job);
    expect(keys.length).toBe(14);
    expect(keys.sort()).toEqual([...JOB_14_KEYS].sort());
  });
});

/* ========================================================================== */
/*  Section 3 — ADAPTER_RESULT reference preservation                            */
/* ========================================================================== */

describe('Section 3 — ADAPTER_RESULT reference preservation', () => {
  beforeEach(() => {
    vi.mocked(readMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      buildMockReaderSuccess(),
    );
  });

  /* Req 20: adapter ok=true → kind=ADAPTER_RESULT */
  it('20. adapter finite result with ok=true produces kind=ADAPTER_RESULT', async () => {
    vi.mocked(executeMLBShadowExecutionJobV2).mockResolvedValue(
      MOCK_ADAPTER_OK_TRUE as unknown as MLBShadowExecutionAdapterV2Result,
    );

    const result = await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    expect(result.kind).toBe('ADAPTER_RESULT');
    if (result.kind === 'ADAPTER_RESULT') {
      expect(result.result.ok).toBe(true);
    }
  });

  /* Req 21: nested adapter result is SAME REFERENCE */
  it('21. nested adapter result is the exact same reference', async () => {
    const mockResult = {
      ...MOCK_ADAPTER_OK_TRUE,
    } as unknown as MLBShadowExecutionAdapterV2Result;
    vi.mocked(executeMLBShadowExecutionJobV2).mockResolvedValue(mockResult);

    const result = await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    expect(result.kind).toBe('ADAPTER_RESULT');
    if (result.kind === 'ADAPTER_RESULT') {
      expect(result.result).toBe(mockResult);
    }
  });

  /* Req 22: adapter EXECUTION_JOB_INVALID (ok=false) → ADAPTER_RESULT, NOT HANDOFF_FAILURE */
  it('22. adapter EXECUTION_JOB_INVALID (ok=false) produces kind=ADAPTER_RESULT, not HANDOFF_FAILURE', async () => {
    vi.mocked(executeMLBShadowExecutionJobV2).mockResolvedValue(
      MOCK_ADAPTER_OK_FALSE_INVALID as unknown as MLBShadowExecutionAdapterV2Result,
    );

    const result = await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    expect(result.kind).toBe('ADAPTER_RESULT');
    if (result.kind === 'ADAPTER_RESULT') {
      expect(result.result.ok).toBe(false);
      if (result.result.status === 'EXECUTION_JOB_INVALID') {
        expect(result.result.adapterVersion).toBe(ADAPTER_VERSION);
      }
    }
  });

  /* Req 23: adapter persistence-level ok=false → ADAPTER_RESULT, NOT HANDOFF_FAILURE */
  it('23. adapter persistence ok=false (OPERATIONAL_PRE_FINALIZATION_FAILED) produces kind=ADAPTER_RESULT', async () => {
    vi.mocked(executeMLBShadowExecutionJobV2).mockResolvedValue(
      MOCK_ADAPTER_OK_FALSE_PERSISTENCE as unknown as MLBShadowExecutionAdapterV2Result,
    );

    const result = await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    expect(result.kind).toBe('ADAPTER_RESULT');
    if (result.kind === 'ADAPTER_RESULT') {
      expect(result.result.ok).toBe(false);
    }
  });

  /* Req 34: ADAPTER_RESULT nested result owns its own ok semantics */
  it('34. ADAPTER_RESULT nested result retains its own ok semantics', async () => {
    vi.mocked(executeMLBShadowExecutionJobV2).mockResolvedValue(
      MOCK_ADAPTER_OK_TRUE as unknown as MLBShadowExecutionAdapterV2Result,
    );

    const result = await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    expect(result.kind).toBe('ADAPTER_RESULT');
    if (result.kind === 'ADAPTER_RESULT') {
      expect(result.result.ok).toBe(true);
    }

    vi.mocked(executeMLBShadowExecutionJobV2).mockResolvedValue(
      MOCK_ADAPTER_OK_FALSE_INVALID as unknown as MLBShadowExecutionAdapterV2Result,
    );

    const result2 = await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    expect(result2.kind).toBe('ADAPTER_RESULT');
    if (result2.kind === 'ADAPTER_RESULT') {
      expect(result2.result.ok).toBe(false);
    }
  });
});

/* ========================================================================== */
/*  Section 4 — HANDOFF_FAILURE (unexpected throws)                            */
/* ========================================================================== */

describe('Section 4 — HANDOFF_FAILURE on unexpected throws', () => {
  /* Req 24: reader unexpected throw → HANDOFF_FAILURE */
  it('24. reader unexpected throw → kind=HANDOFF_FAILURE', async () => {
    vi.mocked(readMLBShadowPreparedExecutionJobV2).mockRejectedValue(
      new Error('reader exploded'),
    );

    const result = await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    expect(result.kind).toBe('HANDOFF_FAILURE');
    if (result.kind === 'HANDOFF_FAILURE') {
      expect(result.status).toBe('HANDOFF_UNEXPECTED_FAILURE');
    }
  });

  /* Req 25: adapter unexpected throw → HANDOFF_FAILURE */
  it('25. adapter unexpected throw → kind=HANDOFF_FAILURE', async () => {
    vi.mocked(readMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      buildMockReaderSuccess(),
    );
    vi.mocked(executeMLBShadowExecutionJobV2).mockRejectedValue(
      new Error('adapter exploded'),
    );

    const result = await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    expect(result.kind).toBe('HANDOFF_FAILURE');
    if (result.kind === 'HANDOFF_FAILURE') {
      expect(result.status).toBe('HANDOFF_UNEXPECTED_FAILURE');
    }
  });

  /* Req 26: HANDOFF_FAILURE exact fields */
  it('26. HANDOFF_FAILURE has exactly handoffVersion + kind + status', async () => {
    vi.mocked(readMLBShadowPreparedExecutionJobV2).mockRejectedValue(
      new Error('reader exploded'),
    );

    const result = await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    expect(result.kind).toBe('HANDOFF_FAILURE');
    const keys = Object.keys(result).sort();
    expect(keys).toEqual(['handoffVersion', 'kind', 'status']);
    if (result.kind === 'HANDOFF_FAILURE') {
      expect(result.handoffVersion).toBe(HANDOFF_VERSION);
      expect(result.status).toBe('HANDOFF_UNEXPECTED_FAILURE');
    }
  });

  /* Req 27: unexpected branch contains no raw error/message/stack/cause/code/path */
  it('27. HANDOFF_FAILURE contains no raw error/message/stack/cause/code/path/errno', async () => {
    vi.mocked(readMLBShadowPreparedExecutionJobV2).mockRejectedValue(
      new Error('reader exploded'),
    );

    const result = await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    // Top-level keys are exactly 3; none are error-related.
    const topKeys = Object.keys(result);
    expect(topKeys).not.toContain('error');
    expect(topKeys).not.toContain('message');
    expect(topKeys).not.toContain('stack');
    expect(topKeys).not.toContain('cause');
    expect(topKeys).not.toContain('code');
    expect(topKeys).not.toContain('path');
    expect(topKeys).not.toContain('errno');

    // No leakage at any depth (for the frozen result envelope).
    const allKeys = extractAllKeys(result);
    const leaked = [...allKeys].filter((k) =>
      [
        'error',
        'message',
        'stack',
        'cause',
        'code',
        'path',
        'errno',
      ].includes(k),
    );
    expect(leaked).toEqual([]);
  });
});

/* ========================================================================== */
/*  Section 5 — Envelope surface / no leakage                                 */
/* ========================================================================== */

describe('Section 5 — envelope surface invariants', () => {
  /* Req 33: no outer ok property on any handoff envelope */
  it('33. no branch returns outer ok property', async () => {
    // READER_FAILURE
    vi.mocked(readMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      buildMockReaderFailure('NOT_FOUND'),
    );
    const r1 = await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(r1).not.toHaveProperty('ok');

    // ADAPTER_RESULT
    vi.mocked(readMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      buildMockReaderSuccess(),
    );
    vi.mocked(executeMLBShadowExecutionJobV2).mockResolvedValue(
      MOCK_ADAPTER_OK_TRUE as unknown as MLBShadowExecutionAdapterV2Result,
    );
    const r2 = await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(r2).not.toHaveProperty('ok');

    // HANDOFF_FAILURE
    vi.mocked(readMLBShadowPreparedExecutionJobV2).mockRejectedValue(
      new Error('boom'),
    );
    const r3 = await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(r3).not.toHaveProperty('ok');
  });

  /* Req 30 (envelope-level): no branch returns prepared package */
  it('30b. ADAPTER_RESULT envelope top-level keys do not expose prepared fields', async () => {
    vi.mocked(readMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      buildMockReaderSuccess(),
    );
    vi.mocked(executeMLBShadowExecutionJobV2).mockResolvedValue(
      MOCK_ADAPTER_OK_TRUE as unknown as MLBShadowExecutionAdapterV2Result,
    );

    const result = await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    const topKeys = Object.keys(result);
    const preparedFields = [
      'authorizedModelArtifact',
      'featureManifest',
      'snapshot',
    ];
    for (const f of preparedFields) {
      expect(topKeys).not.toContain(f);
    }
  });

  /* Req 31: no branch introduces prediction payload */
  /* Req 32: no probabilities / coefficients */
  it('31-32. envelope top-level keys contain no prediction payload / probabilities', async () => {
    vi.mocked(readMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      buildMockReaderSuccess(),
    );
    vi.mocked(executeMLBShadowExecutionJobV2).mockResolvedValue(
      MOCK_ADAPTER_OK_TRUE as unknown as MLBShadowExecutionAdapterV2Result,
    );

    const result = await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    const topKeys = Object.keys(result);
    for (const k of topKeys) {
      expect(SENSITIVE_KEYS.has(k)).toBe(false);
    }
  });

  /* Req: HANDOFF_FAILURE envelope has no prediction payload */
  it('envelope surface: HANDOFF_FAILURE has no prediction payload', async () => {
    vi.mocked(readMLBShadowPreparedExecutionJobV2).mockRejectedValue(
      new Error('boom'),
    );

    const result = await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    const topKeys = Object.keys(result);
    for (const k of topKeys) {
      expect(SENSITIVE_KEYS.has(k)).toBe(false);
    }
  });
});

/* ========================================================================== */
/*  Section 6 — No internal retry (repeated invocation)                       */
/* ========================================================================== */

describe('Section 6 — no internal retry', () => {
  /* Req 35: repeated invocation does not imply internal handoff retry */
  it('35. each handoff invocation calls reader + adapter exactly once', async () => {
    const readerCalls: number[] = [];
    const adapterCalls: number[] = [];

    vi.mocked(readMLBShadowPreparedExecutionJobV2).mockImplementation(
      async (_repoRoot, _shadowRecordId) => {
        readerCalls.push(1);
        return buildMockReaderSuccess();
      },
    );
    vi.mocked(executeMLBShadowExecutionJobV2).mockImplementation(
      async (_job) => {
        adapterCalls.push(1);
        return MOCK_ADAPTER_OK_TRUE as unknown as MLBShadowExecutionAdapterV2Result;
      },
    );

    // First invocation
    await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(readerCalls.length).toBe(1);
    expect(adapterCalls.length).toBe(1);

    // Second invocation — reader + adapter each called exactly once more (no retry)
    await executeStoredMLBShadowPreparedExecutionJobV2(
      CALLER_REPOSITORY_ROOT,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(readerCalls.length).toBe(2);
    expect(adapterCalls.length).toBe(2);
  });
});

/* ========================================================================== */
/*  Section 7 — Temp-root real chain integration (Section 22 of spec)         */
/* ========================================================================== */

describe('Section 7 — temp-root real chain integration', () => {
  it('whole-chain real sealed path: persist → reader → handoff → adapter → persistence', async () => {
    const repoRoot = await trackedTempDir('handoff-integration-');
    const preparedJob = buildValidPreparedJobForIntegration();

    /* Step 1: create lawful prepared artifact in TEMP repo */
    const persistResult = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      preparedJob,
    );
    expect(persistResult.ok).toBe(true);

    /* Snapshot production shadow runtime is clean before any execution */
    const prodBefore = await countFiles(PRODUCTION_RUNTIME_PATH);
    expect(prodBefore).toBe(0);

    /* Step 2: first handoff invocation */
    const firstResult = await executeStoredMLBShadowPreparedExecutionJobV2(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    expect(firstResult.kind).toBe('ADAPTER_RESULT');
    if (firstResult.kind === 'ADAPTER_RESULT') {
      expect(firstResult.result.ok).toBe(true);
      /* Status location is EXACTLY: returned.result.status */
      expect(firstResult.result.status).toBe('OPERATIONAL_PERSISTED');
      /* Verify not at top-level */
      expect(firstResult).not.toHaveProperty(
        'status',
        'OPERATIONAL_PERSISTED',
      );
    }

    /* Step 3: second identical invocation */
    const secondResult = await executeStoredMLBShadowPreparedExecutionJobV2(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    expect(secondResult.kind).toBe('ADAPTER_RESULT');
    if (secondResult.kind === 'ADAPTER_RESULT') {
      expect(secondResult.result.ok).toBe(true);
      expect(secondResult.result.status).toBe(
        'OPERATIONAL_IDEMPOTENT_IDENTICAL_SUCCESS',
      );
    }

    /* Verify no duplicate final artifacts — prediction + operational each exist */
    const predPath = predictionArtifactPathFor(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    const opPath = operationalArtifactPathFor(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(existsSync(predPath)).toBe(true);
    expect(existsSync(opPath)).toBe(true);

    /* Temp artifacts lawful: production runtime untouched */
    const prodAfter = await countFiles(PRODUCTION_RUNTIME_PATH);
    expect(prodAfter).toBe(0);

    /* All writes remain in TEMP root */
    const tempCount = await countFiles(
      join(repoRoot, MLB_SHADOW_MONITORING_NAMESPACE_ROOT),
    );
    expect(tempCount).toBeGreaterThan(0);
  }, 30000);
});
