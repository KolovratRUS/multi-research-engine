/* -------------------------------------------------------------------------- */
/*  Functional tests for the MLB Shadow Preparation Request Orchestrator        */
/*  (P5F-C5)                                                                   */
/* -------------------------------------------------------------------------- */
/*
 * Mock strategy:
 *  - resolveOrAllocateMLBShadowPreparationIdentity -> wrapped real; overridden per-test
 *  - prepareMLBShadowPreparedExecutionJobV2         -> wrapped real; overridden per-test
 *  - node:fs/promises                                -> NOT mocked (real in integration section)
 *
 * C4 filesystem edge-cases are NOT duplicated here — covered by dedicated C4
 * identity-store tests.  C5 tests focus on orchestration: correct C4 invocation,
 * exact 12-field C3 input, and result discrimination.
 */

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/* -------------------------------------------------------------------------- */
/*  Module mocks                                                              */
/* -------------------------------------------------------------------------- */

vi.mock(
  '@/prediction/mlb/mlb-shadow-preparation-identity-store',
  async (importActual) => {
    const actual = await importActual<
      typeof import('@/prediction/mlb/mlb-shadow-preparation-identity-store')
    >();
    return {
      ...actual,
      resolveOrAllocateMLBShadowPreparationIdentity: vi.fn(
        actual.resolveOrAllocateMLBShadowPreparationIdentity,
      ),
    };
  },
);

vi.mock(
  '@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-preparation',
  async (importActual) => {
    const actual = await importActual<
      typeof import('@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-preparation')
    >();
    return {
      ...actual,
      prepareMLBShadowPreparedExecutionJobV2: vi.fn(
        actual.prepareMLBShadowPreparedExecutionJobV2,
      ),
    };
  },
);

/* -------------------------------------------------------------------------- */
/*  C5 orchestrator imports                                                    */
/* -------------------------------------------------------------------------- */

import {
  orchestrateMLBShadowPreparation,
  MLB_SHADOW_PREPARATION_REQUEST_ORCHESTRATION_VERSION,
} from '@/prediction/mlb/mlb-shadow-preparation-request-orchestrator';
import type {
  MLBShadowPreparationRequestOrchestrationRequest,
  MLBShadowPreparationRequestOrchestrationResult,
} from '@/prediction/mlb/mlb-shadow-preparation-request-orchestrator';

/* -------------------------------------------------------------------------- */
/*  Mocked C4 / C3 imports (for controlled result construction + type imports) */
/* -------------------------------------------------------------------------- */

import {
  resolveOrAllocateMLBShadowPreparationIdentity,
  MLB_SHADOW_PREPARATION_IDENTITY_STORE_VERSION,
} from '@/prediction/mlb/mlb-shadow-preparation-identity-store';
import type { MLBShadowPreparationIdentityResolutionResult } from '@/prediction/mlb/mlb-shadow-preparation-identity-store';

import {
  prepareMLBShadowPreparedExecutionJobV2,
  MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_PREPARATION_VERSION,
} from '@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-preparation';
import type {
  MLBShadowPreparedExecutionJobV2PreparationInput,
  MLBShadowPreparedExecutionJobV2PreparationResult,
} from '@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-preparation';
import type { MLBShadowPreparedExecutionJobV2PersistenceResult } from '@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-store';

/* -------------------------------------------------------------------------- */
/*  Sealed-source re-exports (constants needed for fixture construction)       */
/* -------------------------------------------------------------------------- */

import { MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1 } from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';
import { MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT } from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';
import { MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION } from '@/prediction/mlb/mlb-pregame-snapshot-contract';

/* -------------------------------------------------------------------------- */
/*  Frozen test constants                                                     */
/* -------------------------------------------------------------------------- */

const FROZEN_PREDICTION_GENERATED_AT = '2026-07-15T18:40:00Z';
const FROZEN_OFFICIAL_DATE = '2026-07-15';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';

const STORE_VERSION = 'mlb-shadow-prepared-execution-job-v2-store-v1';

const GAME_PK = 714000;
const PREPARATION_REQUEST_ID = 'prep-001';
const SHADOW_001 = 'shadow-prep-test-001';
const SHADOW_002 = 'shadow-prep-test-002';

/* -------------------------------------------------------------------------- */
/*  Temp-directory helpers                                                    */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  Real implementations captured for mock restoration                        */
/* -------------------------------------------------------------------------- */

let realResolve: typeof resolveOrAllocateMLBShadowPreparationIdentity;
let realPrepare: typeof prepareMLBShadowPreparedExecutionJobV2;

beforeAll(async () => {
  const c4Actual = await vi.importActual<
    typeof import('@/prediction/mlb/mlb-shadow-preparation-identity-store')
  >('@/prediction/mlb/mlb-shadow-preparation-identity-store');
  realResolve = c4Actual.resolveOrAllocateMLBShadowPreparationIdentity;

  const c3Actual = await vi.importActual<
    typeof import('@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-preparation')
  >('@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-preparation');
  realPrepare = c3Actual.prepareMLBShadowPreparedExecutionJobV2;
});

/* -------------------------------------------------------------------------- */
/*  beforeEach: reset all mocks to clean state                                */
/* -------------------------------------------------------------------------- */

beforeEach(() => {
  vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockReset();
  vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockReset();
});

/* ========================================================================== */
/*  Mock C4 result helpers                                                    */
/* ========================================================================== */

function mockC4PERSISTED(
  shadowRecordId = SHADOW_001,
): MLBShadowPreparationIdentityResolutionResult {
  return {
    ok: true,
    status: 'PERSISTED',
    storeVersion: MLB_SHADOW_PREPARATION_IDENTITY_STORE_VERSION,
    artifactCreated: true,
    tempCleanupFailed: false,
    preparationRequestId: PREPARATION_REQUEST_ID,
    gamePk: GAME_PK,
    shadowRecordId,
    relativePath: `operational/preparation-identities/${shadowRecordId}.json`,
    issues: Object.freeze([]),
    verificationOk: true,
  };
}

function mockC4CleanupWarning(
  shadowRecordId = SHADOW_001,
): MLBShadowPreparationIdentityResolutionResult {
  return {
    ok: true,
    status: 'PERSISTED_WITH_CLEANUP_WARNING',
    storeVersion: MLB_SHADOW_PREPARATION_IDENTITY_STORE_VERSION,
    artifactCreated: true,
    tempCleanupFailed: true,
    preparationRequestId: PREPARATION_REQUEST_ID,
    gamePk: GAME_PK,
    shadowRecordId,
    relativePath: `operational/preparation-identities/${shadowRecordId}.json`,
    issues: Object.freeze([]),
    verificationOk: true,
  };
}

function mockC4Failure(
  status: string,
): MLBShadowPreparationIdentityResolutionResult {
  return {
    ok: false,
    status: status as any,
    storeVersion: MLB_SHADOW_PREPARATION_IDENTITY_STORE_VERSION,
    artifactCreated: false,
    tempCleanupFailed: false,
    preparationRequestId: null,
    gamePk: null,
    shadowRecordId: null,
    relativePath: null,
    issues: Object.freeze([]),
    verificationOk: null,
  };
}

function mockC4VerificationFailed(
  shadowRecordId = SHADOW_001,
): MLBShadowPreparationIdentityResolutionResult {
  return {
    ok: false,
    status: 'VERIFICATION_FAILED',
    storeVersion: MLB_SHADOW_PREPARATION_IDENTITY_STORE_VERSION,
    artifactCreated: true,
    tempCleanupFailed: false,
    preparationRequestId: PREPARATION_REQUEST_ID,
    gamePk: GAME_PK,
    shadowRecordId,
    relativePath: `operational/preparation-identities/${shadowRecordId}.json`,
    issues: Object.freeze([]),
    verificationOk: false,
  };
}

/* ========================================================================== */
/*  Mock C3 result helpers                                                    */
/* ========================================================================== */

function mockPersistPERSISTED(
  shadowRecordId = SHADOW_001,
): MLBShadowPreparedExecutionJobV2PersistenceResult {
  return {
    ok: true,
    storeVersion: STORE_VERSION,
    status: 'PERSISTED',
    artifactCreated: true,
    tempCleanupFailed: false,
    shadowRecordId,
    relativePath: `quarantine/prepared-jobs/${shadowRecordId}.json`,
    verificationOk: true,
    issues: Object.freeze([]),
  };
}

function mockPersistIDEMPOTENT(
  shadowRecordId = SHADOW_001,
): MLBShadowPreparedExecutionJobV2PersistenceResult {
  return {
    ok: true,
    storeVersion: STORE_VERSION,
    status: 'IDEMPOTENT_IDENTICAL_SUCCESS',
    artifactCreated: false,
    tempCleanupFailed: false,
    shadowRecordId,
    relativePath: `quarantine/prepared-jobs/${shadowRecordId}.json`,
    verificationOk: true,
    issues: Object.freeze([]),
  };
}

function mockPersistFailure(
  status: string,
  shadowRecordId = SHADOW_001,
): MLBShadowPreparedExecutionJobV2PersistenceResult {
  return {
    ok: false,
    storeVersion: STORE_VERSION,
    status: status as any,
    artifactCreated: false,
    tempCleanupFailed: false,
    shadowRecordId,
    relativePath: null,
    verificationOk: null,
    issues: Object.freeze([]),
  };
}

function mockC3StoreResult(
  storeResult: MLBShadowPreparedExecutionJobV2PersistenceResult,
): MLBShadowPreparedExecutionJobV2PreparationResult {
  return {
    preparationVersion: MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_PREPARATION_VERSION,
    kind: 'STORE_RESULT',
    result: storeResult,
  };
}

function mockC3InputRejected(): MLBShadowPreparedExecutionJobV2PreparationResult {
  return {
    preparationVersion: MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_PREPARATION_VERSION,
    kind: 'INPUT_REJECTED',
    status: 'PREPARATION_INPUT_INVALID',
  };
}

function mockC3Failure(): MLBShadowPreparedExecutionJobV2PreparationResult {
  return {
    preparationVersion: MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_PREPARATION_VERSION,
    kind: 'PREPARATION_FAILURE',
    status: 'PREPARATION_UNEXPECTED_FAILURE',
  };
}

/* ========================================================================== */
/*  Fixture builders                                                          */
/* ========================================================================== */

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
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidRequest(
  overrides: Record<string, unknown> = {},
): MLBShadowPreparationRequestOrchestrationRequest {
  const base = {
    gamePk: GAME_PK,
    predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
    featureManifest: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    snapshot: buildValidSnapshot(),
    officialDate: FROZEN_OFFICIAL_DATE,
    scheduledStartAt: FROZEN_SCHEDULED_START,
    latencyMs: 1234,
    featureManifestId: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
    featureManifestFingerprint:
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
    timingReferenceContractVersion:
      'mlb-offline-pregame-inference-contract-v1',
    timingReferenceCutoffAt: FROZEN_DATA_CUTOFF,
    repoRoot: join(tmpdir(), 'mlb-c5-mock-test'),
    preparationRequestId: PREPARATION_REQUEST_ID,
  };
  return {
    ...base,
    ...overrides,
  } as MLBShadowPreparationRequestOrchestrationRequest;
}

/* ========================================================================== */
/*  Generator trackers                                                        */
/* ========================================================================== */

let shadowIdCounter = 0;
function createShadowId(): string {
  shadowIdCounter++;
  return `shadow-gen-${shadowIdCounter}`;
}

function createTracker(): {
  calls: number;
  gen: () => string;
} {
  const t = { calls: 0, gen: () => { t.calls++; return `shadow-gen-${t.calls}`; } };
  return t;
}

/* ========================================================================== */
/*  A. Fresh request: C4 PERSISTED + C3 PERSISTED → C5 SUCCESS               */
/* ========================================================================== */

describe('A. fresh request orchestration', () => {
  it('1. C4 PERSISTED + C3 PERSISTED → C5 SUCCESS', async () => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      mockC4PERSISTED(SHADOW_001),
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED(SHADOW_001)),
    );

    const result = await orchestrateMLBShadowPreparation(
      buildValidRequest(),
      createShadowId,
    );

    expect(result.status).toBe('SUCCESS');
    expect(result.registryResult.ok).toBe(true);
    expect(result.registryResult.status).toBe('PERSISTED');
    if (result.status !== 'REGISTRY_FAILURE' && result.preparationResult.kind === 'STORE_RESULT') {
      expect(result.preparationResult.result.ok).toBe(true);
      expect(result.preparationResult.result.status).toBe('PERSISTED');
    } else {
      throw new Error('expected STORE_RESULT kind');
    }
  });

  it('2. C4 called with exact arguments (repoRoot, requestId, gamePk, generator)', async () => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      mockC4PERSISTED(SHADOW_001),
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED(SHADOW_001)),
    );

    const gen = createShadowId;
    const request = buildValidRequest();
    await orchestrateMLBShadowPreparation(request, gen);

    expect(
      vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity),
    ).toHaveBeenCalledTimes(1);
    const args = vi.mocked(
      resolveOrAllocateMLBShadowPreparationIdentity,
    ).mock.calls[0];
    expect(args[0]).toBe(request.repoRoot);
    expect(args[1]).toBe(PREPARATION_REQUEST_ID);
    expect(args[2]).toBe(GAME_PK);
    expect(args[3]).toBe(gen);
  });

  it('3. C3 called with request.repoRoot as first argument', async () => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      mockC4PERSISTED(SHADOW_001),
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED(SHADOW_001)),
    );

    const request = buildValidRequest();
    await orchestrateMLBShadowPreparation(request, createShadowId);

    expect(
      vi.mocked(prepareMLBShadowPreparedExecutionJobV2),
    ).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mock.calls[0][0],
    ).toBe(request.repoRoot);
  });

  it('4. C3 receives the shadowRecordId from C4 (not a generated one)', async () => {
    const registryId = 'registry-returned-id';
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      mockC4PERSISTED(registryId),
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED(registryId)),
    );

    const request = buildValidRequest();
    await orchestrateMLBShadowPreparation(request, createShadowId);

    const c3Input = vi.mocked(
      prepareMLBShadowPreparedExecutionJobV2,
    ).mock.calls[0][1] as MLBShadowPreparedExecutionJobV2PreparationInput;
    expect(c3Input.shadowRecordId).toBe(registryId);
  });
});

/* ========================================================================== */
/*  B. Identical retry: real C4 idempotent fast path                          */
/* ========================================================================== */

describe('B. identical retry with real C4', () => {
  beforeEach(() => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockImplementation(
      realResolve,
    );
  });

  it('1. first call allocates, second call reuses; generator called once', async () => {
    const repoRoot = await trackedTempDir('c5-idempotent-');
    const request = buildValidRequest({ repoRoot });

    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED()),
    );

    const tracker = createTracker();

    // First call — C4 allocates a new identity
    const first = await orchestrateMLBShadowPreparation(request, tracker.gen);
    expect(first.status).toBe('SUCCESS');
    expect(tracker.calls).toBe(1);
    expect(first.registryResult.status).toBe('PERSISTED');
    const firstId = first.registryResult.shadowRecordId as string;

    // Second call — C4 finds existing record (IDEMPOTENT_IDENTICAL_SUCCESS)
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockClear();
    const second = await orchestrateMLBShadowPreparation(request, tracker.gen);
    expect(second.status).toBe('SUCCESS');
    expect(tracker.calls).toBe(1); // generator NOT called again on fast path
    expect(second.registryResult.status).toBe('IDEMPOTENT_IDENTICAL_SUCCESS');
    expect(second.registryResult.artifactCreated).toBe(false);
    expect(second.registryResult.shadowRecordId).toBe(firstId);

    // C3 received the same shadowRecordId both times
    const c3Input = vi.mocked(
      prepareMLBShadowPreparedExecutionJobV2,
    ).mock.calls[0][1] as MLBShadowPreparedExecutionJobV2PreparationInput;
    expect(c3Input.shadowRecordId).toBe(firstId);
  });
});

/* ========================================================================== */
/*  C. Same gamePk, two distinct request IDs → independent identities         */
/* ========================================================================== */

describe('C. same gamePk, two distinct request IDs', () => {
  beforeEach(() => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockImplementation(
      realResolve,
    );
  });

  it('1. two different requestIds yield two different shadowRecordIds', async () => {
    const repoRoot = await trackedTempDir('c5-distinct-');

    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED()),
    );

    const req1 = buildValidRequest({
      repoRoot,
      preparationRequestId: 'req-a',
    });
    const req2 = buildValidRequest({
      repoRoot,
      preparationRequestId: 'req-b',
    });

    const res1 = await orchestrateMLBShadowPreparation(req1, createShadowId);
    const res2 = await orchestrateMLBShadowPreparation(req2, createShadowId);

    expect(res1.status).toBe('SUCCESS');
    expect(res2.status).toBe('SUCCESS');
    expect(res1.registryResult.shadowRecordId).not.toBe(
      res2.registryResult.shadowRecordId,
    );
    expect(res1.registryResult.preparationRequestId).toBe('req-a');
    expect(res2.registryResult.preparationRequestId).toBe('req-b');
    expect(res1.registryResult.gamePk).toBe(GAME_PK);
    expect(res2.registryResult.gamePk).toBe(GAME_PK);
  });
});

/* ========================================================================== */
/*  D. Same preparationRequestId, different gamePk → GAME_PK_MISMATCH         */
/* ========================================================================== */

describe('D. same requestId, different gamePk → REGISTRY_FAILURE', () => {
  it('1. C4 GAME_PK_MISMATCH → C5 REGISTRY_FAILURE, C3 not called', async () => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      mockC4Failure('GAME_PK_MISMATCH'),
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED()),
    );

    const result = await orchestrateMLBShadowPreparation(
      buildValidRequest(),
      createShadowId,
    );

    expect(result.status).toBe('REGISTRY_FAILURE');
    expect(result.registryResult.ok).toBe(false);
    expect(result.registryResult.status).toBe('GAME_PK_MISMATCH');
    expect(
      vi.mocked(prepareMLBShadowPreparedExecutionJobV2),
    ).not.toHaveBeenCalled();
  });
});

/* ========================================================================== */
/*  E. Registry read failure → no C3 call                                     */
/* ========================================================================== */

describe('E. registry read failure', () => {
  it('1. C4 READ_ERROR → C5 REGISTRY_FAILURE, C3 not called', async () => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      mockC4Failure('READ_ERROR'),
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED()),
    );

    const result = await orchestrateMLBShadowPreparation(
      buildValidRequest(),
      createShadowId,
    );

    expect(result.status).toBe('REGISTRY_FAILURE');
    expect(result.registryResult.ok).toBe(false);
    expect(result.registryResult.status).toBe('READ_ERROR');
    expect(result.registryResult.artifactCreated).toBe(false);
    expect(
      vi.mocked(prepareMLBShadowPreparedExecutionJobV2),
    ).not.toHaveBeenCalled();
  });
});

/* ========================================================================== */
/*  F. Registry write failure → no C3 call                                     */
/* ========================================================================== */

describe('F. registry write failure', () => {
  it('1. C4 WRITE_ERROR → C5 REGISTRY_FAILURE, C3 not called', async () => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      mockC4Failure('WRITE_ERROR'),
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED()),
    );

    const result = await orchestrateMLBShadowPreparation(
      buildValidRequest(),
      createShadowId,
    );

    expect(result.status).toBe('REGISTRY_FAILURE');
    expect(result.registryResult.ok).toBe(false);
    expect(result.registryResult.status).toBe('WRITE_ERROR');
    expect(result.registryResult.artifactCreated).toBe(false);
    expect(
      vi.mocked(prepareMLBShadowPreparedExecutionJobV2),
    ).not.toHaveBeenCalled();
  });
});

/* ========================================================================== */
/*  G. Registry post-final verification failure → no C3 call                   */
/* ========================================================================== */

describe('G. registry post-final verification failure', () => {
  it('1. C4 VERIFICATION_FAILED (artifactCreated=true) blocks C3', async () => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      mockC4VerificationFailed(SHADOW_001),
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED()),
    );

    const result = await orchestrateMLBShadowPreparation(
      buildValidRequest(),
      createShadowId,
    );

    expect(result.status).toBe('REGISTRY_FAILURE');
    expect(result.registryResult.ok).toBe(false);
    expect(result.registryResult.status).toBe('VERIFICATION_FAILED');
    expect(result.registryResult.artifactCreated).toBe(true);
    expect(result.registryResult.verificationOk).toBe(false);
    expect(
      vi.mocked(prepareMLBShadowPreparedExecutionJobV2),
    ).not.toHaveBeenCalled();
  });
});

/* ========================================================================== */
/*  H. Registry cleanup-warning success → C3 still called                     */
/* ========================================================================== */

describe('H. registry cleanup-warning success', () => {
  it('1. C4 PERSISTED_WITH_CLEANUP_WARNING → C5 SUCCESS, C3 called with persisted ID', async () => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      mockC4CleanupWarning(SHADOW_001),
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED(SHADOW_001)),
    );

    const result = await orchestrateMLBShadowPreparation(
      buildValidRequest(),
      createShadowId,
    );

    expect(result.status).toBe('SUCCESS');
    expect(result.registryResult.status).toBe('PERSISTED_WITH_CLEANUP_WARNING');
    expect(result.registryResult.tempCleanupFailed).toBe(true);
    expect(result.registryResult.verificationOk).toBe(true);
    expect(
      vi.mocked(prepareMLBShadowPreparedExecutionJobV2),
    ).toHaveBeenCalledTimes(1);

    const c3Input = vi.mocked(
      prepareMLBShadowPreparedExecutionJobV2,
    ).mock.calls[0][1] as MLBShadowPreparedExecutionJobV2PreparationInput;
    expect(c3Input.shadowRecordId).toBe(SHADOW_001);
  });
});

/* ========================================================================== */
/*  I. Concurrent same-request calls → both reuse same persisted ID           */
/* ========================================================================== */

describe('I. concurrent same-request calls', () => {
  beforeEach(() => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockImplementation(
      realResolve,
    );
  });

  it('1. two concurrent calls both resolve to the same shadowRecordId', async () => {
    const repoRoot = await trackedTempDir('c5-concurrent-');
    const request = buildValidRequest({ repoRoot });

    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED()),
    );

    const tracker = createTracker();
    const [first, second] = await Promise.all([
      orchestrateMLBShadowPreparation(request, tracker.gen),
      orchestrateMLBShadowPreparation(request, tracker.gen),
    ]);

    expect(first.status).toBe('SUCCESS');
    expect(second.status).toBe('SUCCESS');
    expect(first.registryResult.shadowRecordId).toBe(
      second.registryResult.shadowRecordId,
    );
    // Both calls converge on the same persisted identity regardless of
    // which call won the fs.link race (winner-takes-ID, loser reads existing).
    expect(tracker.calls).toBeGreaterThanOrEqual(1);
    expect(tracker.calls).toBeLessThanOrEqual(2);
  });
});

/* ========================================================================== */
/*  J. Producer failure after successful C4 → PREPARATION_FAILURE             */
/* ========================================================================== */

describe('J. producer failure after successful C4', () => {
  beforeEach(() => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      mockC4PERSISTED(SHADOW_001),
    );
  });

  it('1. C3 STORE_RESULT ok=false → C5 PREPARATION_FAILURE, C4 identity preserved', async () => {
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistFailure('ALREADY_EXISTS', SHADOW_001)),
    );

    const result = await orchestrateMLBShadowPreparation(
      buildValidRequest(),
      createShadowId,
    );

    expect(result.status).toBe('PREPARATION_FAILURE');
    expect(result.registryResult.ok).toBe(true);
    expect(result.registryResult.shadowRecordId).toBe(SHADOW_001);
    if (result.status !== 'REGISTRY_FAILURE' && result.preparationResult.kind === 'STORE_RESULT') {
      expect(result.preparationResult.result.ok).toBe(false);
      expect(result.preparationResult.result.status).toBe('ALREADY_EXISTS');
    } else {
      throw new Error('expected STORE_RESULT kind');
    }
  });

  it('2. C3 INPUT_REJECTED → C5 PREPARATION_FAILURE', async () => {
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3InputRejected(),
    );

    const result = await orchestrateMLBShadowPreparation(
      buildValidRequest(),
      createShadowId,
    );

    expect(result.status).toBe('PREPARATION_FAILURE');
    if (result.status !== 'REGISTRY_FAILURE') {
      expect(result.preparationResult.kind).toBe('INPUT_REJECTED');
    }
  });

  it('3. C3 PREPARATION_FAILURE → C5 PREPARATION_FAILURE', async () => {
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3Failure(),
    );

    const result = await orchestrateMLBShadowPreparation(
      buildValidRequest(),
      createShadowId,
    );

    expect(result.status).toBe('PREPARATION_FAILURE');
    if (result.status !== 'REGISTRY_FAILURE') {
      expect(result.preparationResult.kind).toBe('PREPARATION_FAILURE');
    }
  });
});

/* ========================================================================== */
/*  K. Retry after C3 failure: existing identity reused                        */
/* ========================================================================== */

describe('K. retry after C3 failure: identity reused', () => {
  beforeEach(() => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockImplementation(
      realResolve,
    );
  });

  it('1. C3 fails first attempt; C4 returns IDEMPOTENT on retry; C5 reuses same ID', async () => {
    const repoRoot = await trackedTempDir('c5-retry-fail-');
    const request = buildValidRequest({ repoRoot });

    // First attempt: C4 allocates, C3 fails
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValueOnce(
      mockC3StoreResult(
        mockPersistFailure('ALREADY_EXISTS', SHADOW_001),
      ),
    );

    const first = await orchestrateMLBShadowPreparation(request, createShadowId);
    expect(first.status).toBe('PREPARATION_FAILURE');
    expect(first.registryResult.status).toBe('PERSISTED');
    const firstId = first.registryResult.shadowRecordId as string;

    // Second attempt: C4 finds existing identity, C3 succeeds
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValueOnce(
      mockC3StoreResult(mockPersistIDEMPOTENT(firstId)),
    );

    const second = await orchestrateMLBShadowPreparation(request, createShadowId);
    expect(second.status).toBe('SUCCESS');
    expect(second.registryResult.status).toBe('IDEMPOTENT_IDENTICAL_SUCCESS');
    expect(second.registryResult.shadowRecordId).toBe(firstId);
    expect(second.registryResult.artifactCreated).toBe(false);

    // C3 received the same shadowRecordId both times
    const firstInput = vi.mocked(
      prepareMLBShadowPreparedExecutionJobV2,
    ).mock.calls[0][1] as MLBShadowPreparedExecutionJobV2PreparationInput;
    const secondInput = vi.mocked(
      prepareMLBShadowPreparedExecutionJobV2,
    ).mock.calls[1][1] as MLBShadowPreparedExecutionJobV2PreparationInput;
    expect(firstInput.shadowRecordId).toBe(firstId);
    expect(secondInput.shadowRecordId).toBe(firstId);
  });
});

/* ========================================================================== */
/*  L. Changed payload after existing C3 artifact → C3 rejects               */
/* ========================================================================== */

describe('L. changed payload after existing C3 artifact', () => {
  beforeEach(() => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockImplementation(
      realResolve,
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockImplementation(
      realPrepare,
    );
  });

  it('1. C3 returns ALREADY_EXISTS when retry uses a changed predictionGeneratedAt', async () => {
    const repoRoot = await trackedTempDir('c5-changed-');
    const request = buildValidRequest({ repoRoot });

    // First call — real C4 + real C3: persists the artifact
    const first = await orchestrateMLBShadowPreparation(request, createShadowId);
    expect(first.status).toBe('SUCCESS');
    const persistedId = first.registryResult.shadowRecordId;

    // Second call — same identity, different predictionGeneratedAt
    const changedRequest = buildValidRequest({
      repoRoot,
      predictionGeneratedAt: '2026-08-01T18:40:00Z',
    });

    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockClear();

    const second = await orchestrateMLBShadowPreparation(changedRequest, createShadowId);
    expect(second.status).toBe('PREPARATION_FAILURE');
    expect(second.registryResult.status).toBe('IDEMPOTENT_IDENTICAL_SUCCESS');
    expect(second.registryResult.shadowRecordId).toBe(persistedId);
    if (second.status !== 'REGISTRY_FAILURE') {
      expect(second.preparationResult.kind).toBe('STORE_RESULT');
    }
    if (second.status !== 'REGISTRY_FAILURE' && second.preparationResult.kind === 'STORE_RESULT') {
      expect(second.preparationResult.result.ok).toBe(false);
      expect(second.preparationResult.result.status).toBe('ALREADY_EXISTS');
    } else {
      throw new Error('expected STORE_RESULT kind');
    }
  });
});

/* ========================================================================== */
/*  M. Exact C3 input object: exactly twelve own keys, no extras              */
/* ========================================================================== */

describe('M. exact C3 input shape', () => {
  beforeEach(() => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      mockC4PERSISTED(SHADOW_001),
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED(SHADOW_001)),
    );
  });

  it('1. C3 receives exactly twelve own keys (no excess, no missing)', async () => {
    await orchestrateMLBShadowPreparation(buildValidRequest(), createShadowId);

    const c3Input = vi.mocked(
      prepareMLBShadowPreparedExecutionJobV2,
    ).mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(c3Input)).toHaveLength(12);
  });

  it('2. C3 input keys are exactly the 12 expected names, in order', async () => {
    await orchestrateMLBShadowPreparation(buildValidRequest(), createShadowId);

    const c3Input = vi.mocked(
      prepareMLBShadowPreparedExecutionJobV2,
    ).mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(c3Input)).toEqual([
      'shadowRecordId',
      'gamePk',
      'predictionGeneratedAt',
      'featureManifest',
      'snapshot',
      'officialDate',
      'scheduledStartAt',
      'latencyMs',
      'featureManifestId',
      'featureManifestFingerprint',
      'timingReferenceContractVersion',
      'timingReferenceCutoffAt',
    ]);
  });

  it('3. no repoRoot key in C3 input', async () => {
    await orchestrateMLBShadowPreparation(buildValidRequest(), createShadowId);

    const c3Input = vi.mocked(
      prepareMLBShadowPreparedExecutionJobV2,
    ).mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(c3Input)).not.toContain('repoRoot');
  });

  it('4. no preparationRequestId key in C3 input', async () => {
    await orchestrateMLBShadowPreparation(buildValidRequest(), createShadowId);

    const c3Input = vi.mocked(
      prepareMLBShadowPreparedExecutionJobV2,
    ).mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(c3Input)).not.toContain('preparationRequestId');
  });
});

/* ========================================================================== */
/*  N. Optional-field handling: absent → null                                  */
/* ========================================================================== */

describe('N. optional field null handling', () => {
  beforeEach(() => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      mockC4PERSISTED(SHADOW_001),
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED(SHADOW_001)),
    );
  });

  it('1. optional fields passed through as null when null in request', async () => {
    const request = buildValidRequest({
      officialDate: null,
      scheduledStartAt: null,
      latencyMs: null,
      featureManifestId: null,
      featureManifestFingerprint: null,
      timingReferenceContractVersion: null,
      timingReferenceCutoffAt: null,
    });

    await orchestrateMLBShadowPreparation(request, createShadowId);

    const c3Input = vi.mocked(
      prepareMLBShadowPreparedExecutionJobV2,
    ).mock.calls[0][1] as MLBShadowPreparedExecutionJobV2PreparationInput;

    expect(c3Input.officialDate).toBeNull();
    expect(c3Input.scheduledStartAt).toBeNull();
    expect(c3Input.latencyMs).toBeNull();
    expect(c3Input.featureManifestId).toBeNull();
    expect(c3Input.featureManifestFingerprint).toBeNull();
    expect(c3Input.timingReferenceContractVersion).toBeNull();
    expect(c3Input.timingReferenceCutoffAt).toBeNull();
  });

  it('2. undefined optional fields are coerced to null before reaching C3', async () => {
    const request = buildValidRequest({
      officialDate: undefined,
      latencyMs: undefined,
      timingReferenceCutoffAt: undefined,
    });

    await orchestrateMLBShadowPreparation(request, createShadowId);

    const c3Input = vi.mocked(
      prepareMLBShadowPreparedExecutionJobV2,
    ).mock.calls[0][1] as Record<string, unknown>;

    // undefined must NOT reach C3 — must be coerced to null
    expect(c3Input.officialDate).toBeNull();
    expect(c3Input.latencyMs).toBeNull();
    expect(c3Input.timingReferenceCutoffAt).toBeNull();
  });
});

/* ========================================================================== */
/*  O. C3 artifact authority: C5 does not inject model artifacts              */
/* ========================================================================== */

describe('O. C3 artifact authority', () => {
  it('1. C5 does not inject authorizedModelArtifact into C3 input', async () => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      mockC4PERSISTED(SHADOW_001),
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED(SHADOW_001)),
    );

    await orchestrateMLBShadowPreparation(buildValidRequest(), createShadowId);

    const c3Input = vi.mocked(
      prepareMLBShadowPreparedExecutionJobV2,
    ).mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(c3Input)).not.toContain('authorizedModelArtifact');
  });
});

/* ========================================================================== */
/*  P. Timestamp and snapshot passthrough                                      */
/* ========================================================================== */

describe('P. timestamp and snapshot passthrough', () => {
  beforeEach(() => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      mockC4PERSISTED(SHADOW_001),
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED(SHADOW_001)),
    );
  });

  it('1. predictionGeneratedAt passed through unchanged', async () => {
    const ts = '2026-08-01T15:30:00.000Z';
    const request = buildValidRequest({ predictionGeneratedAt: ts });
    await orchestrateMLBShadowPreparation(request, createShadowId);

    const c3Input = vi.mocked(
      prepareMLBShadowPreparedExecutionJobV2,
    ).mock.calls[0][1] as MLBShadowPreparedExecutionJobV2PreparationInput;
    expect(c3Input.predictionGeneratedAt).toBe(ts);
  });

  it('2. snapshot passed through by reference', async () => {
    const snapshot = buildValidSnapshot();
    const request = buildValidRequest({ snapshot });
    await orchestrateMLBShadowPreparation(request, createShadowId);

    const c3Input = vi.mocked(
      prepareMLBShadowPreparedExecutionJobV2,
    ).mock.calls[0][1] as MLBShadowPreparedExecutionJobV2PreparationInput;
    expect(c3Input.snapshot).toBe(snapshot);
  });
});

/* ========================================================================== */
/*  Q. Manifest passthrough (existing 14-feature V1)                          */
/* ========================================================================== */

describe('Q. manifest passthrough', () => {
  beforeEach(() => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      mockC4PERSISTED(SHADOW_001),
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED(SHADOW_001)),
    );
  });

  it('1. featureManifest passed through unchanged (same reference)', async () => {
    await orchestrateMLBShadowPreparation(buildValidRequest(), createShadowId);

    const c3Input = vi.mocked(
      prepareMLBShadowPreparedExecutionJobV2,
    ).mock.calls[0][1] as MLBShadowPreparedExecutionJobV2PreparationInput;
    expect(c3Input.featureManifest).toBe(
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    );
  });

  it('2. featureManifestFingerprint passed through unchanged', async () => {
    await orchestrateMLBShadowPreparation(buildValidRequest(), createShadowId);

    const c3Input = vi.mocked(
      prepareMLBShadowPreparedExecutionJobV2,
    ).mock.calls[0][1] as MLBShadowPreparedExecutionJobV2PreparationInput;
    expect(c3Input.featureManifestFingerprint).toBe(
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
    );
  });

  it('3. manifest has exactly 14 features (frozen V1 invariant)', async () => {
    await orchestrateMLBShadowPreparation(buildValidRequest(), createShadowId);

    const c3Input = vi.mocked(
      prepareMLBShadowPreparedExecutionJobV2,
    ).mock.calls[0][1] as MLBShadowPreparedExecutionJobV2PreparationInput;
    expect(c3Input.featureManifest.features).toHaveLength(14);
  });
});

/* ========================================================================== */
/*  R. No automatic runtime dispatch                                           */
/*  C5 invokes only C4 and C3 — never the store, reader, handoff, or adapter.   */
/* ========================================================================== */

describe('R. no automatic runtime dispatch', () => {
  it('1. C5 calls C4 exactly once and C3 exactly once on SUCCESS', async () => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      mockC4PERSISTED(SHADOW_001),
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED(SHADOW_001)),
    );

    const result = await orchestrateMLBShadowPreparation(
      buildValidRequest(),
      createShadowId,
    );

    expect(result.status).toBe('SUCCESS');
    expect(
      vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity),
    ).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(prepareMLBShadowPreparedExecutionJobV2),
    ).toHaveBeenCalledTimes(1);
  });

  it('2. C5 makes at most one C4 call even on C4 failure (no retry loop)', async () => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      mockC4Failure('READ_ERROR'),
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED()),
    );

    const result = await orchestrateMLBShadowPreparation(
      buildValidRequest(),
      createShadowId,
    );

    expect(result.status).toBe('REGISTRY_FAILURE');
    expect(
      vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity),
    ).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(prepareMLBShadowPreparedExecutionJobV2),
    ).not.toHaveBeenCalled();
  });
});

/* ========================================================================== */
/*  T. No odds or sportsbook-price influence (fixture-level + result check)  */
/* ========================================================================== */

describe('T. no odds or sportsbook-price influence', () => {
  it('1. featureManifest contains no odds-related fields', () => {
    const manifestKeys = Object.keys(
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    );
    const featureKeys = manifestKeys.map((k) => k.toLowerCase());
    const oddsPatterns = [
      'odds',
      'sportsbook',
      'book',
      'vig',
      'juice',
      'price',
      'implied',
    ];
    const found = featureKeys.filter((k) =>
      oddsPatterns.some((p) => k.includes(p)),
    );
    expect(found).toHaveLength(0);
  });

  it('2. snapshot fixture contains no odds-related keys at any depth', () => {
    const snapshot = buildValidSnapshot();
    const oddsPatterns = [
      'odds',
      'sportsbook',
      'book',
      'vig',
      'juice',
      'price',
      'implied',
    ];
    const findOddsKeys = (obj: unknown, path = ''): string[] => {
      if (obj === null || typeof obj !== 'object') return [];
      if (Array.isArray(obj)) {
        return obj.flatMap((v, i) => findOddsKeys(v, `${path}[${i}]`));
      }
      const record = obj as Record<string, unknown>;
      return Object.entries(record).flatMap(([k, v]) => {
        const lower = k.toLowerCase();
        const matched = oddsPatterns.some((p) => lower.includes(p));
        const nested = findOddsKeys(v, `${path}.${k}`);
        return matched ? [k, ...nested] : nested;
      });
    };
    expect(findOddsKeys(snapshot)).toHaveLength(0);
  });

  it('3. C5 SUCCESS result serialized has no odds or pricing substrings', async () => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      mockC4PERSISTED(SHADOW_001),
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED(SHADOW_001)),
    );

    const result = await orchestrateMLBShadowPreparation(
      buildValidRequest(),
      createShadowId,
    );

    const resultStr = JSON.stringify(result);
    const lower = resultStr.toLowerCase();
    expect(lower).not.toContain('odds');
    expect(lower).not.toContain('sportsbook');
    expect(lower).not.toContain('book');
  });
});

/* ========================================================================== */
/*  U. No actual scientific state mutation (real C4 + real C3)                 */
/* ========================================================================== */

describe('U. no scientific state mutation', () => {
  beforeEach(() => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockImplementation(
      realResolve,
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockImplementation(
      realPrepare,
    );
  });

  it('1. isolated temp repoRoot: only C4 identity + C3 prepared-job namespaces created', async () => {
    const repoRoot = await trackedTempDir('c5-no-mutation-');
    const request = buildValidRequest({ repoRoot });

    const result = await orchestrateMLBShadowPreparation(
      request,
      createShadowId,
    );
    expect(result.status).toBe('SUCCESS');

    // Walk the temp repoRoot — only C4/C3 namespaces should exist
    const allFiles: string[] = [];
    const walk = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const p = join(dir, e.name);
        if (e.isDirectory()) await walk(p);
        else allFiles.push(p);
      }
    };
    await walk(repoRoot);

    const relativeFiles = allFiles.map((f) => f.slice(repoRoot.length + 1));

    // No scientific paths (pregame evidence, holdout bindings, predictions,
    // outcomes, shadow-runs, etc.)
    const hasScientificPath = relativeFiles.some(
      (f) =>
        f.includes('mlb-prospective-pregame-evidence') ||
        f.includes('mlb-prospective-holdout-game-identity-bindings') ||
        f.includes('mlb-shadow-monitoring/predictions') ||
        f.includes('mlb-shadow-monitoring/outcomes') ||
        f.includes('mlb-shadow-monitoring/operational/shadow-runs') ||
        f.includes('mlb-shadow-monitoring/operational/monitoring-predictions') ||
        f.includes('mlb-shadow-monitoring/operational/monitoring-grades'),
    );
    expect(hasScientificPath).toBe(false);

    // Should have C4 identity + C3 prepared job artifacts
    const hasC4Identity = relativeFiles.some((f) =>
      f.includes('preparation-identities'),
    );
    const hasC3Prepared = relativeFiles.some((f) =>
      f.includes('prepared-jobs'),
    );
    expect(hasC4Identity).toBe(true);
    expect(hasC3Prepared).toBe(true);

    // No execution-adapter, no handoff, no monitoring prediction files
    const hasExecutionFiles = relativeFiles.some(
      (f) =>
        f.includes('execution-jobs') ||
        f.includes('handoff') ||
        f.includes('operational/prediction'),
    );
    expect(hasExecutionFiles).toBe(false);
  });
});

/* ========================================================================== */
/*  V. Full nested diagnostics preserved                                      */
/* ========================================================================== */

describe('V. full nested diagnostics', () => {
  it('1. REGISTRY_FAILURE preserves original C4 result (by reference)', async () => {
    const registryResult = mockC4Failure('READ_ERROR');
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      registryResult,
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED()),
    );

    const result = await orchestrateMLBShadowPreparation(
      buildValidRequest(),
      createShadowId,
    );

    expect(result.status).toBe('REGISTRY_FAILURE');
    expect(result.registryResult).toBe(registryResult);
  });

  it('2. PREPARATION_FAILURE preserves original C4 + C3 results (by reference)', async () => {
    const registryResult = mockC4PERSISTED(SHADOW_001);
    const preparationResult = mockC3StoreResult(
      mockPersistFailure('WRITE_ERROR', SHADOW_001),
    );

    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      registryResult,
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      preparationResult,
    );

    const result = await orchestrateMLBShadowPreparation(
      buildValidRequest(),
      createShadowId,
    );

    expect(result.status).toBe('PREPARATION_FAILURE');
    expect(result.registryResult).toBe(registryResult);
    if (result.status !== 'REGISTRY_FAILURE') {
      expect(result.preparationResult).toBe(preparationResult);
    }
  });

  it('3. SUCCESS preserves original C4 + C3 results (by reference)', async () => {
    const registryResult = mockC4PERSISTED(SHADOW_001);
    const preparationResult = mockC3StoreResult(
      mockPersistPERSISTED(SHADOW_001),
    );

    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      registryResult,
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      preparationResult,
    );

    const result = await orchestrateMLBShadowPreparation(
      buildValidRequest(),
      createShadowId,
    );

    expect(result.status).toBe('SUCCESS');
    expect(result.registryResult).toBe(registryResult);
    if (result.status !== 'REGISTRY_FAILURE') {
      expect(result.preparationResult).toBe(preparationResult);
    }
  });

  it('4. result.status discriminates REGISTRY_FAILURE from PREPARATION_FAILURE', async () => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      mockC4Failure('READ_ERROR'),
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED()),
    );

    const registryFail = await orchestrateMLBShadowPreparation(
      buildValidRequest(),
      createShadowId,
    );

    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      mockC4PERSISTED(SHADOW_001),
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistFailure('WRITE_ERROR')),
    );

    const prepFail = await orchestrateMLBShadowPreparation(
      buildValidRequest(),
      createShadowId,
    );

    expect(registryFail.status).not.toBe(prepFail.status);
    expect(registryFail.status).toBe('REGISTRY_FAILURE');
    expect(prepFail.status).toBe('PREPARATION_FAILURE');
  });

  it('5. a C3 STORE_RESULT with ok=false is NOT reported as SUCCESS', async () => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      mockC4PERSISTED(SHADOW_001),
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistFailure('WRITE_ERROR', SHADOW_001)),
    );

    const result = await orchestrateMLBShadowPreparation(
      buildValidRequest(),
      createShadowId,
    );

    expect(result.status).not.toBe('SUCCESS');
    expect(result.status).toBe('PREPARATION_FAILURE');
  });
});

/* ========================================================================== */
/*  Orchestration version constant                                            */
/* ========================================================================== */

describe('orchestration version', () => {
  it('1. MLB_SHADOW_PREPARATION_REQUEST_ORCHESTRATION_VERSION is the expected literal', () => {
    expect(MLB_SHADOW_PREPARATION_REQUEST_ORCHESTRATION_VERSION).toBe(
      'mlb-shadow-preparation-request-orchestrator-v1',
    );
  });

  it('2. SUCCESS result carries the orchestration version', async () => {
    vi.mocked(resolveOrAllocateMLBShadowPreparationIdentity).mockResolvedValue(
      mockC4PERSISTED(SHADOW_001),
    );
    vi.mocked(prepareMLBShadowPreparedExecutionJobV2).mockResolvedValue(
      mockC3StoreResult(mockPersistPERSISTED(SHADOW_001)),
    );

    const result = await orchestrateMLBShadowPreparation(
      buildValidRequest(),
      createShadowId,
    );

    expect(result.orchestrationVersion).toBe(
      MLB_SHADOW_PREPARATION_REQUEST_ORCHESTRATION_VERSION,
    );
  });
});
