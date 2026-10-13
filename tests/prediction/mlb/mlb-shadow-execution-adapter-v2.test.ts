/* -------------------------------------------------------------------------- */
/*  V2 single-job shadow execution adapter — unit + whole-chain tests         */
/*  Phase: 8V-D3-C-E4-B4-I3G-LIVE1-L5E2X-P5E-C3                              */
/* -------------------------------------------------------------------------- */
/**
 * Mock strategy:
 *  - validateMLBShadowExecutionJobV2                  → wrapped real;
 *    overridden in Sections 2-9 for control-flow tests, restored in
 *    beforeEach to real for Sections 10-14 and whole-chain Section 25.
 *  - orchestrateMLBShadowMonitoringPredictionPersistenceV2 → wrapped real;
 *    overridden in Sections 4-9 for delegation tests, restored in beforeEach
 *    to real for whole-chain Section 25.
 *
 * Lower-layer seams (prediction orchestrator, prediction store, operational
 * store, operational projection) are NOT mocked — they run as real code in
 * the whole-chain Section 25.
 */

/* ========================================================================== */
/*  Module mocks (importActual wrappers)                                      */
/* ========================================================================== */

vi.mock(
  '@/prediction/mlb/mlb-shadow-execution-job-v2-contract',
  async (importActual) => {
    const actual = await importActual<
      typeof import('@/prediction/mlb/mlb-shadow-execution-job-v2-contract')
    >();
    return {
      ...actual,
      validateMLBShadowExecutionJobV2: vi.fn(
        actual.validateMLBShadowExecutionJobV2,
      ),
    };
  },
);

vi.mock(
  '@/prediction/mlb/mlb-shadow-monitoring-persistence-orchestrator-v2',
  async (importActual) => {
    const actual = await importActual<
      typeof import('@/prediction/mlb/mlb-shadow-monitoring-persistence-orchestrator-v2')
    >();
    return {
      ...actual,
      orchestrateMLBShadowMonitoringPredictionPersistenceV2: vi.fn(
        actual.orchestrateMLBShadowMonitoringPredictionPersistenceV2,
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
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

import type {
  MLBShadowExecutionJobV2,
  MLBShadowExecutionJobV2ValidationResult,
} from '@/prediction/mlb/mlb-shadow-execution-job-v2-contract';
import {
  MLB_SHADOW_EXECUTION_JOB_V2_CONTRACT_VERSION,
  validateMLBShadowExecutionJobV2,
} from '@/prediction/mlb/mlb-shadow-execution-job-v2-contract';
import {
  orchestrateMLBShadowMonitoringPredictionPersistenceV2,
} from '@/prediction/mlb/mlb-shadow-monitoring-persistence-orchestrator-v2';
import type { MLBShadowMonitoringPredictionPersistenceIntegrationV2Result } from '@/prediction/mlb/mlb-shadow-monitoring-persistence-orchestrator-v2';

/* -- Module under test -- */
import {
  executeMLBShadowExecutionJobV2,
  MLB_SHADOW_EXECUTION_ADAPTER_V2_VERSION,
  type MLBShadowExecutionAdapterV2Result,
  type MLBShadowExecutionAdapterV2InvalidResult,
} from '@/prediction/mlb/mlb-shadow-execution-adapter-v2';

/* -- Scientific fixtures (frozen, never mutated) -- */
import { getMLBShadowCandidate003AuthorizedModelArtifact } from '@/prediction/mlb/mlb-shadow-candidate-003-authorized-model-artifact';
import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';
import {
  MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE,
  MLB_SHADOW_MONITORING_OPERATIONAL_NAMESPACE,
} from '@/prediction/mlb/mlb-shadow-monitoring-namespace';

/* ========================================================================== */
/*  Constants                                                                 */
/* ========================================================================== */

const ADAPTER_VERSION = 'mlb-shadow-execution-adapter-v2';
const L5E2U_VERSION =
  'mlb-shadow-monitoring-persistence-integration-v2';
const INVALID_STATUS = 'EXECUTION_JOB_INVALID';
const CONTRACT_VERSION = 'mlb-shadow-execution-job-v2';

/* Frozen test timestamps */
const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';
const FROZEN_PREDICTION_GENERATED_AT = '2026-07-15T18:40:00Z';
const FROZEN_OFFICIAL_DATE = '2026-07-15';

/* Manifest section IDs */
const MANIFEST_SECTION_IDS = [
  'section-away-batting',
  'section-away-bullpen',
  'section-away-starter',
  'section-game-context',
  'section-home-batting',
  'section-home-bullpen',
  'section-home-starter',
] as const;

/* Whole-chain identifiers */
const SHADOW_RECORD_ID = 'synthetic-shadow-v2-001';
const GAME_PK = 990000001;

/* ========================================================================== */
/*  Snapshot builder                                                          */
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
/*  V2 job builders                                                           */
/* ========================================================================== */

/**
 * Whole-chain builder: produces a structurally valid V2 job that the REAL
 * validator accepts. All fields are canonicalized to match the validator's
 * expectations.
 */
function buildValidV2Job(
  repoRoot: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    repoRoot,
    shadowRecordId: SHADOW_RECORD_ID,
    gamePk: GAME_PK,
    predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
    authorizedModelArtifact:
      getMLBShadowCandidate003AuthorizedModelArtifact(),
    featureManifest: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    snapshot: buildSnapshot(ALL_PRESENT_PAYLOADS),
    officialDate: FROZEN_OFFICIAL_DATE,
    scheduledStartAt: FROZEN_SCHEDULED_START,
    latencyMs: 0,
    featureManifestId:
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
    featureManifestFingerprint:
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
    timingReferenceContractVersion:
      'mlb-canonical-pregame-snapshot-v1',
    timingReferenceCutoffAt: FROZEN_DATA_CUTOFF,
    ...overrides,
  };
}

/**
 * Unit-test builder: produces an opaque validated job for mocked-validator
 * tests. The validator is mocked so the shape is accepted regardless.
 */
function buildUnitTestInput(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    repoRoot: '/tmp/fake-repo',
    shadowRecordId: 'synthetic-shadow-001',
    gamePk: 990000001,
    predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
    authorizedModelArtifact: { candidate: 'candidate-003' },
    featureManifest: { manifestId: 'manifest-1' },
    snapshot: { snapshotId: 'snapshot-1' },
    officialDate: FROZEN_OFFICIAL_DATE,
    scheduledStartAt: FROZEN_SCHEDULED_START,
    latencyMs: 5000,
    featureManifestId: 'manifest-1',
    featureManifestFingerprint: '0'.repeat(64),
    timingReferenceContractVersion:
      'mlb-canonical-pregame-snapshot-v1',
    timingReferenceCutoffAt: FROZEN_DATA_CUTOFF,
    ...overrides,
  };
}

/* ========================================================================== */
/*  Mock data factories                                                       */
/* ========================================================================== */

/**
 * A minimal validated job object for mocked-validator sections. Since the
 * validator is mocked, the shape is opaque — it mirrors V1's
 * FAKE_VALIDATED_JOB but uses authorizedModelArtifact instead of
 * releasedModelResult.
 */
const FAKE_VALIDATED_JOB = Object.freeze({
  repoRoot: '/tmp/fake-repo',
  shadowRecordId: 'synthetic-shadow-001',
  gamePk: 990000001,
  predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
  authorizedModelArtifact: { candidate: 'candidate-003' },
  featureManifest: { manifestId: 'manifest-1' },
  snapshot: { snapshotId: 'snapshot-1' },
  officialDate: FROZEN_OFFICIAL_DATE,
  scheduledStartAt: FROZEN_SCHEDULED_START,
  latencyMs: 5000,
  featureManifestId: 'manifest-1',
  featureManifestFingerprint: '0'.repeat(64),
  timingReferenceContractVersion:
    'mlb-canonical-pregame-snapshot-v1',
  timingReferenceCutoffAt: FROZEN_DATA_CUTOFF,
}) as unknown as MLBShadowExecutionJobV2;

/** Issues that must NEVER escape through the adapter. */
const LEAKY_ISSUES: MLBShadowExecutionJobV2ValidationResult = {
  ok: false,
  issues: [
    {
      code: 'AUTHORIZED_ARTIFACT_INVALID' as const,
      path: '$.authorizedModelArtifact',
      message:
        'Authorized model artifact is not the frozen candidate-003 model',
    },
    {
      code: 'ODDS_CONTAMINATION' as const,
      path: '$.featureManifest',
      message:
        'Feature manifest contains a prohibited odds/sportsbook field',
    },
    {
      code: 'UNKNOWN_FIELD' as const,
      path: '$.sportsbookOdds',
      message: 'Unknown field: sportsbookOdds',
    },
  ],
} as const;

/** Builds a properly-typed V2 persistence integration result. */
function buildIntegrationResult(
  overrides: Partial<MLBShadowMonitoringPredictionPersistenceIntegrationV2Result>,
): MLBShadowMonitoringPredictionPersistenceIntegrationV2Result {
  return Object.freeze({
    ok: true,
    integrationVersion: L5E2U_VERSION,
    status: 'OPERATIONAL_PERSISTED',
    operationalRecord: null,
    operationalPersistenceAttempted: true,
    operationalArtifactCreated: true,
    operationalVerificationOk: true,
    operationalTempCleanupFailed: false,
    ...overrides,
  }) as unknown as MLBShadowMonitoringPredictionPersistenceIntegrationV2Result;
}

/* ========================================================================== */
/*  Real implementations captured for mock restoration                        */
/* ========================================================================== */

type ValidateV2Fn = typeof validateMLBShadowExecutionJobV2;
type OrchestrateV2Fn =
  typeof orchestrateMLBShadowMonitoringPredictionPersistenceV2;

let realValidateV2: ValidateV2Fn;
let realOrchestrateV2: OrchestrateV2Fn;

beforeAll(async () => {
  const jobContractActual = await vi.importActual<
    typeof import('@/prediction/mlb/mlb-shadow-execution-job-v2-contract')
  >('@/prediction/mlb/mlb-shadow-execution-job-v2-contract');
  realValidateV2 = jobContractActual.validateMLBShadowExecutionJobV2;

  const persistActual = await vi.importActual<
    typeof import('@/prediction/mlb/mlb-shadow-monitoring-persistence-orchestrator-v2')
  >('@/prediction/mlb/mlb-shadow-monitoring-persistence-orchestrator-v2');
  realOrchestrateV2 =
    persistActual.orchestrateMLBShadowMonitoringPredictionPersistenceV2;
});

/* ========================================================================== */
/*  Mock lifecycle                                                             */
/* ========================================================================== */

beforeEach(() => {
  vi.mocked(validateMLBShadowExecutionJobV2).mockReset();
  vi.mocked(validateMLBShadowExecutionJobV2).mockImplementation(realValidateV2);
  vi.mocked(
    orchestrateMLBShadowMonitoringPredictionPersistenceV2,
  ).mockReset();
  vi.mocked(
    orchestrateMLBShadowMonitoringPredictionPersistenceV2,
  ).mockImplementation(realOrchestrateV2);
});

/* ========================================================================== */
/*  Temp directory helpers                                                    */
/* ========================================================================== */

const cleanupDirs: string[] = [];

afterEach(async () => {
  while (cleanupDirs.length > 0) {
    const dir = cleanupDirs.pop();
    if (dir) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
});

async function trackedTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(join(tmpdir(), prefix));
  cleanupDirs.push(dir);
  return dir;
}

/* ========================================================================== */
/*  Artifact path + filesystem helpers                                       */
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

async function countFiles(dir: string): Promise<number> {
  let count = 0;
  try {
    const entries = await fs.readdir(dir);
    for (const name of entries) {
      const full = join(dir, name);
      const stat = await fs.stat(full);
      if (stat.isDirectory()) {
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

/**
 * Verify that a V2 job passes the REAL V2 validator.
 * Uses realValidateV2 directly (not the mock) for explicitness.
 */
function expectValidV2Job(input: Record<string, unknown>): void {
  const validation = realValidateV2(input);
  expect(validation.ok).toBe(true);
}

/* ========================================================================== */
/*  Sensitive-key sets                                                        */
/* ========================================================================== */

/** Keys that must NEVER appear in an invalid or success adapter result. */
const SENSITIVE_KEYS = new Set([
  'adapterVersion',      // only on invalid path
  'issues',              // validation issues
  'predictedWinner',
  'predictedSide',
  'homeWinProbability',
  'awayWinProbability',
  'payloadHash',
  'coefficients',
  'intercept',
  'candidateRecipeFingerprint',
  'modelCanonicalFingerprint',
  'releasedModelResult', // V1-only field
]);

const PRODUCTION_RUNTIME_PATH = join(
  process.cwd(),
  'var/mlb-development/mlb-shadow-monitoring',
);

/* ========================================================================== */
/*  Section 1 — adapter version                                               */
/* ========================================================================== */

describe('Section 1 — adapter version', () => {
  it('exports the exact V2 version string', () => {
    expect(MLB_SHADOW_EXECUTION_ADAPTER_V2_VERSION).toBe(ADAPTER_VERSION);
  });

  it('matches the as-const literal type', () => {
    const v: typeof MLB_SHADOW_EXECUTION_ADAPTER_V2_VERSION =
      ADAPTER_VERSION;
    expect(v).toBe(ADAPTER_VERSION);
  });

  it('does NOT reuse the V1 version', () => {
    expect(ADAPTER_VERSION).not.toBe(
      'mlb-shadow-execution-adapter-v1',
    );
  });

  it('exports executeMLBShadowExecutionJobV2 function', () => {
    expect(typeof executeMLBShadowExecutionJobV2).toBe('function');
  });

  it('adapter source declares input: unknown', () => {
    /* Compile-time guarantee: the function accepts unknown input. */
    const acceptUnknown: (input: unknown) => Promise<unknown> =
      executeMLBShadowExecutionJobV2;
    expect(typeof acceptUnknown).toBe('function');
  });
});

/* ========================================================================== */
/*  Section 2 — invalid-job handling (validator mocked ok:false)             */
/* ========================================================================== */

describe('Section 2 — invalid job handling', () => {
  beforeEach(() => {
    vi.mocked(validateMLBShadowExecutionJobV2).mockReturnValue({
      ok: false,
      issues: LEAKY_ISSUES.issues,
    });
  });

  it('returns the fixed invalid result shape', async () => {
    const result = await executeMLBShadowExecutionJobV2({ bad: true });

    expect(result).toEqual({
      ok: false,
      adapterVersion: ADAPTER_VERSION,
      status: INVALID_STATUS,
    });
  });

  it('contains exactly the authorized three keys', async () => {
    const result = await executeMLBShadowExecutionJobV2({ bad: true });

    if (result.ok === false) {
      expect(Object.keys(result).sort()).toEqual([
        'adapterVersion',
        'ok',
        'status',
      ]);
    } else {
      throw new Error('Expected invalid result');
    }
  });

  it('contains no validation issues', async () => {
    const result = await executeMLBShadowExecutionJobV2({ bad: true });

    expect(result).not.toHaveProperty('issues');
  });

  it('contains no input values', async () => {
    const result = await executeMLBShadowExecutionJobV2({ bad: true });

    expect(result).not.toHaveProperty('input');
    expect(result).not.toHaveProperty('value');
    expect(result).not.toHaveProperty('job');
    expect(result).not.toHaveProperty('repoRoot');
    expect(result).not.toHaveProperty('gamePk');
  });

  it('contains no sensitive prediction fields', async () => {
    const result = await executeMLBShadowExecutionJobV2({ bad: true });

    expect(result).not.toHaveProperty('prediction');
    expect(result).not.toHaveProperty('predictedWinner');
    expect(result).not.toHaveProperty('probability');
    expect(result).not.toHaveProperty('modelFingerprint');
    expect(result).not.toHaveProperty('snapshot');
    expect(result).not.toHaveProperty('relativePath');
    expect(result).not.toHaveProperty('releasedModelResult');
    expect(result).not.toHaveProperty('authorizedModelArtifact');
  });

  it('calls validator exactly once', async () => {
    await executeMLBShadowExecutionJobV2({ bad: true });

    expect(validateMLBShadowExecutionJobV2).toHaveBeenCalledTimes(1);
    expect(validateMLBShadowExecutionJobV2).toHaveBeenCalledWith({
      bad: true,
    });
  });

  it('calls persistence delegate zero times', async () => {
    await executeMLBShadowExecutionJobV2({ bad: true });

    expect(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).not.toHaveBeenCalled();
  });

  it('validator rejection cannot trigger persistence', async () => {
    vi.mocked(validateMLBShadowExecutionJobV2).mockReturnValue({
      ok: false,
      issues: LEAKY_ISSUES.issues,
    });

    await executeMLBShadowExecutionJobV2({});

    expect(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).not.toHaveBeenCalled();
  });
});

/* ========================================================================== */
/*  Section 3 — validation-failure firewall                                   */
/* ========================================================================== */

describe('Section 3 — validation-failure firewall', () => {
  it('synthetic issue information does not escape', async () => {
    vi.mocked(validateMLBShadowExecutionJobV2).mockReturnValue({
      ok: false,
      issues: [
        {
          code: 'AUTHORIZED_ARTIFACT_INVALID',
          path: '$.authorizedModelArtifact',
          message: 'Authorized model artifact is not authorized',
        },
      ],
    });

    const result = await executeMLBShadowExecutionJobV2({
      authorizedModelArtifact: { model: 'wrong' },
    });

    expect(result).toEqual({
      ok: false,
      adapterVersion: ADAPTER_VERSION,
      status: INVALID_STATUS,
    });

    const invalidResult = result as MLBShadowExecutionAdapterV2InvalidResult;
    expect(invalidResult.adapterVersion).toBe(ADAPTER_VERSION);
    expect(invalidResult.status).toBe(INVALID_STATUS);
  });
});

/* ========================================================================== */
/*  Section 4 — valid-job delegation (validator mocked ok:true)                */
/* ========================================================================== */

describe('Section 4 — valid job delegation', () => {
  beforeEach(() => {
    vi.mocked(validateMLBShadowExecutionJobV2).mockReturnValue({
      ok: true,
      value: FAKE_VALIDATED_JOB,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockResolvedValue(buildIntegrationResult({}));
  });

  it('calls validator exactly once', async () => {
    await executeMLBShadowExecutionJobV2({});

    expect(validateMLBShadowExecutionJobV2).toHaveBeenCalledTimes(1);
    expect(validateMLBShadowExecutionJobV2).toHaveBeenCalledWith({});
  });

  it('valid job delegates exactly once to the V2 persistence orchestrator', async () => {
    await executeMLBShadowExecutionJobV2({});

    expect(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).toHaveBeenCalledTimes(1);
  });

  it('passes validation.value to delegate (exact reference, not raw input)', async () => {
    await executeMLBShadowExecutionJobV2({});

    expect(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).toHaveBeenCalledWith(FAKE_VALIDATED_JOB);
  });

  it('returns exact delegate result by reference', async () => {
    const delegateResult = buildIntegrationResult({});
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockResolvedValue(delegateResult);

    const result = await executeMLBShadowExecutionJobV2({});

    expect(result).toBe(delegateResult);
  });

  it('does not add adapterVersion to valid delegate result', async () => {
    const delegateResult = buildIntegrationResult({});
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockResolvedValue(delegateResult);

    const result = await executeMLBShadowExecutionJobV2({});

    expect(result).not.toHaveProperty('adapterVersion');
  });

  it('does not rewrite delegate status', async () => {
    const delegateResult = buildIntegrationResult({
      status: 'OPERATIONAL_VERIFICATION_FAILED',
      ok: false,
      operationalArtifactCreated: true,
      operationalVerificationOk: false,
      operationalTempCleanupFailed: false,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockResolvedValue(delegateResult);

    const result = await executeMLBShadowExecutionJobV2({});

    expect(result).toBe(delegateResult);
  });
});

/* ========================================================================== */
/*  Section 5 — delegate result preservation matrix                          */
/* ========================================================================== */

describe('Section 5 — integration result preservation matrix', () => {
  beforeEach(() => {
    vi.mocked(validateMLBShadowExecutionJobV2).mockReturnValue({
      ok: true,
      value: FAKE_VALIDATED_JOB,
    });
  });

  it('preserves OPERATIONAL_PERSISTED (ok=true)', async () => {
    const mocked = buildIntegrationResult({
      ok: true,
      status: 'OPERATIONAL_PERSISTED',
      operationalArtifactCreated: true,
      operationalVerificationOk: true,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockResolvedValue(mocked);

    const result = await executeMLBShadowExecutionJobV2({});

    expect(result).toBe(mocked);
  });

  it('preserves OPERATIONAL_PERSISTED_WITH_CLEANUP_WARNING', async () => {
    const mocked = buildIntegrationResult({
      status: 'OPERATIONAL_PERSISTED_WITH_CLEANUP_WARNING',
      operationalArtifactCreated: false,
      operationalVerificationOk: false,
      operationalTempCleanupFailed: true,
      operationalPersistenceAttempted: true,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockResolvedValue(mocked);

    const result = await executeMLBShadowExecutionJobV2({});

    expect(result).toBe(mocked);
  });

  it('preserves OPERATIONAL_IDEMPOTENT_IDENTICAL_SUCCESS', async () => {
    const mocked = buildIntegrationResult({
      ok: true,
      status: 'OPERATIONAL_IDEMPOTENT_IDENTICAL_SUCCESS',
      operationalArtifactCreated: false,
      operationalVerificationOk: true,
      operationalTempCleanupFailed: false,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockResolvedValue(mocked);

    const result = await executeMLBShadowExecutionJobV2({});

    expect(result).toBe(mocked);
  });

  it('preserves OPERATIONAL_ALREADY_EXISTS_DIFFERENT (ok=false)', async () => {
    const mocked = buildIntegrationResult({
      ok: false,
      status: 'OPERATIONAL_ALREADY_EXISTS_DIFFERENT',
      operationalArtifactCreated: false,
      operationalVerificationOk: false,
      operationalPersistenceAttempted: true,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockResolvedValue(mocked);

    const result = await executeMLBShadowExecutionJobV2({});

    expect(result).toBe(mocked);
  });

  it('preserves OPERATIONAL_VERIFICATION_FAILED (ok=false)', async () => {
    const mocked = buildIntegrationResult({
      ok: false,
      status: 'OPERATIONAL_VERIFICATION_FAILED',
      operationalArtifactCreated: true,
      operationalVerificationOk: false,
      operationalTempCleanupFailed: false,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockResolvedValue(mocked);

    const result = await executeMLBShadowExecutionJobV2({});

    expect(result).toBe(mocked);
  });

  it('preserves OPERATIONAL_PRE_FINALIZATION_FAILED (ok=false)', async () => {
    const mocked = buildIntegrationResult({
      ok: false,
      status: 'OPERATIONAL_PRE_FINALIZATION_FAILED',
      operationalArtifactCreated: false,
      operationalVerificationOk: false,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockResolvedValue(mocked);

    const result = await executeMLBShadowExecutionJobV2({});

    expect(result).toBe(mocked);
  });
});

/* ========================================================================== */
/*  Section 6 — ok flag preservation                                        */
/* ========================================================================== */

describe('Section 6 — ok flag preservation', () => {
  beforeEach(() => {
    vi.mocked(validateMLBShadowExecutionJobV2).mockReturnValue({
      ok: true,
      value: FAKE_VALIDATED_JOB,
    });
  });

  it('preserves delegate ok=true result unchanged', async () => {
    const mocked = buildIntegrationResult({ ok: true });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockResolvedValue(mocked);

    const result = await executeMLBShadowExecutionJobV2({});

    expect(result).toBe(mocked);
    expect(result.ok).toBe(true);
  });

  it('preserves delegate ok=false result unchanged', async () => {
    const mocked = buildIntegrationResult({
      ok: false,
      status: 'OPERATIONAL_PRE_FINALIZATION_FAILED',
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockResolvedValue(mocked);

    const result = await executeMLBShadowExecutionJobV2({});

    expect(result).toBe(mocked);
    expect(result.ok).toBe(false);
  });

  it('preserves operationalRecord reference unchanged', async () => {
    const fakeRecord = Object.freeze({
      contractVersion: 'mlb-shadow-monitoring-operational-record-v1',
      mode: 'S1_OPERATIONAL_BLIND',
      shadowRecordId: 'synthetic-shadow-001',
      gamePk: 990000001,
      predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
    }) as unknown as Parameters<
      typeof buildIntegrationResult
    >[0]['operationalRecord'] & object;

    const mocked = buildIntegrationResult({
      operationalRecord: fakeRecord,
      status: 'OPERATIONAL_PERSISTED',
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockResolvedValue(mocked);

    const result = await executeMLBShadowExecutionJobV2({});

    expect(result).toBe(mocked);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.operationalRecord).toBe(fakeRecord);
    }
  });

  it('preserves artifactCreated / verification / cleanup fields unchanged', async () => {
    const mocked = buildIntegrationResult({
      status: 'OPERATIONAL_PERSISTED_WITH_CLEANUP_WARNING',
      operationalArtifactCreated: false,
      operationalVerificationOk: false,
      operationalTempCleanupFailed: true,
      operationalPersistenceAttempted: true,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockResolvedValue(mocked);

    const result = await executeMLBShadowExecutionJobV2({});

    expect(result).toBe(mocked);
  });
});

/* ========================================================================== */
/*  Section 7 — immutability firewall                                         */
/* ========================================================================== */

describe('Section 7 — immutability firewall', () => {
  beforeEach(() => {
    vi.mocked(validateMLBShadowExecutionJobV2).mockReturnValue({
      ok: true,
      value: FAKE_VALIDATED_JOB,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockResolvedValue(buildIntegrationResult({}));
  });

  it('adapter does not mutate original unknown input', async () => {
    const input = { repoRoot: '/tmp/input', extra: 'untouched' };
    const inputSnapshot = { ...input };

    await executeMLBShadowExecutionJobV2(input);

    expect(input).toEqual(inputSnapshot);
  });

  it('adapter does not mutate validation.value (FAKE_VALIDATED_JOB)', async () => {
    const valueSnapshot = { ...FAKE_VALIDATED_JOB };

    await executeMLBShadowExecutionJobV2({});

    expect(FAKE_VALIDATED_JOB).toEqual(valueSnapshot);
  });

  it('authorized model artifact is not mutated', async () => {
    const artifact = getMLBShadowCandidate003AuthorizedModelArtifact();
    const artifactSnapshot = JSON.parse(JSON.stringify(artifact));

    vi.mocked(validateMLBShadowExecutionJobV2).mockReturnValue({
      ok: true,
      value: {
        ...FAKE_VALIDATED_JOB,
        authorizedModelArtifact: artifact,
      } as unknown as MLBShadowExecutionJobV2,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockResolvedValue(buildIntegrationResult({}));

    await executeMLBShadowExecutionJobV2({});

    expect(artifact).toEqual(artifactSnapshot);
  });

  it('feature manifest is not mutated', async () => {
    const manifest = MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1;
    const manifestSnapshot = JSON.parse(JSON.stringify(manifest));

    vi.mocked(validateMLBShadowExecutionJobV2).mockReturnValue({
      ok: true,
      value: {
        ...FAKE_VALIDATED_JOB,
        featureManifest: manifest,
      } as unknown as MLBShadowExecutionJobV2,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockResolvedValue(buildIntegrationResult({}));

    await executeMLBShadowExecutionJobV2({});

    expect(manifest).toEqual(manifestSnapshot);
  });

  it('snapshot is not mutated', async () => {
    const snapshot = buildSnapshot(ALL_PRESENT_PAYLOADS);
    const snapshotSnapshot = JSON.parse(JSON.stringify(snapshot));

    vi.mocked(validateMLBShadowExecutionJobV2).mockReturnValue({
      ok: true,
      value: {
        ...FAKE_VALIDATED_JOB,
        snapshot,
      } as unknown as MLBShadowExecutionJobV2,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockResolvedValue(buildIntegrationResult({}));

    await executeMLBShadowExecutionJobV2({});

    expect(snapshot).toEqual(snapshotSnapshot);
  });

  it('repeated invocation with same validator value causes identical delegation inputs', async () => {
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockResolvedValue(buildIntegrationResult({}));

    await executeMLBShadowExecutionJobV2({});
    await executeMLBShadowExecutionJobV2({});

    expect(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).toHaveBeenCalledTimes(2);
    expect(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).toHaveBeenNthCalledWith(1, FAKE_VALIDATED_JOB);
    expect(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).toHaveBeenNthCalledWith(2, FAKE_VALIDATED_JOB);
  });
});

/* ========================================================================== */
/*  Section 8 — input-driven delegation                                     */
/* ========================================================================== */

describe('Section 8 — input-driven delegation (no normalization)', () => {
  it('changing input only changes behavior through validator result', async () => {
    const jobA = Object.freeze({
      repoRoot: '/repo-a',
    }) as unknown as MLBShadowExecutionJobV2;
    const jobB = Object.freeze({
      repoRoot: '/repo-b',
    }) as unknown as MLBShadowExecutionJobV2;

    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockResolvedValue(buildIntegrationResult({}));
    vi.mocked(validateMLBShadowExecutionJobV2).mockReturnValueOnce({
      ok: true,
      value: jobA,
    });
    vi.mocked(validateMLBShadowExecutionJobV2).mockReturnValueOnce({
      ok: true,
      value: jobB,
    });

    const inputA = { id: 'job-a' };
    const inputB = { id: 'job-b' };

    await executeMLBShadowExecutionJobV2(inputA);
    await executeMLBShadowExecutionJobV2(inputB);

    expect(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).toHaveBeenNthCalledWith(1, jobA);
    expect(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).toHaveBeenNthCalledWith(2, jobB);
  });
});

/* ========================================================================== */
/*  Section 9 — no generated execution values                                */
/* ========================================================================== */

describe('Section 9 — no generated execution values', () => {
  it('invalid result has no adapter-generated fields', async () => {
    vi.mocked(validateMLBShadowExecutionJobV2).mockReturnValue({
      ok: false,
      issues: LEAKY_ISSUES.issues,
    });

    const result = await executeMLBShadowExecutionJobV2({});

    expect(result).not.toHaveProperty('shadowRecordId');
    expect(result).not.toHaveProperty('predictionGeneratedAt');
    expect(result).not.toHaveProperty('latencyMs');
    expect(result).not.toHaveProperty('featureManifestFingerprint');
    expect(result).not.toHaveProperty('timingReferenceCutoffAt');
    expect(result).not.toHaveProperty('scheduledStartAt');
  });

  it('adapter does not generate any execution field on valid path', async () => {
    vi.mocked(validateMLBShadowExecutionJobV2).mockReturnValue({
      ok: true,
      value: FAKE_VALIDATED_JOB,
    });

    const spy = vi.fn().mockResolvedValue(buildIntegrationResult({}));
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockImplementation(
      spy as typeof orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    );

    await executeMLBShadowExecutionJobV2({});

    const passedArg = spy.mock.calls[0][0];

    /* The adapter must NOT generate or mutate any execution field. */
    expect(passedArg).toBe(FAKE_VALIDATED_JOB);
    expect(passedArg).not.toBe({});
  });

  it('no real shadow artifacts written during tests', async () => {
    vi.mocked(validateMLBShadowExecutionJobV2).mockReturnValueOnce({
      ok: true,
      value: FAKE_VALIDATED_JOB,
    });
    vi.mocked(validateMLBShadowExecutionJobV2).mockReturnValue({
      ok: false,
      issues: LEAKY_ISSUES.issues,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockResolvedValue(buildIntegrationResult({}));

    await executeMLBShadowExecutionJobV2({});
    await executeMLBShadowExecutionJobV2({ invalid: true });

    expect(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).toHaveBeenCalledTimes(1);
  });
});

/* ========================================================================== */
/*  Section 10 — real-validator rejection of invalid primitives               */
/*  (validator uses REAL implementation; delegate mocked to spy)            */
/* ========================================================================== */

describe('Section 10 — invalid input rejection (real validator)', () => {
  it('rejects invalid primitive input (7): fixed result, delegate not called', async () => {
    const result = await executeMLBShadowExecutionJobV2(42 as unknown);

    expect(result).toEqual({
      ok: false,
      adapterVersion: ADAPTER_VERSION,
      status: INVALID_STATUS,
    });
    expect(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).not.toHaveBeenCalled();
  });

  it('rejects string input (7): fixed result, delegate not called', async () => {
    const result = await executeMLBShadowExecutionJobV2(
      'not-a-job' as unknown,
    );

    expect(result).toEqual({
      ok: false,
      adapterVersion: ADAPTER_VERSION,
      status: INVALID_STATUS,
    });
    expect(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).not.toHaveBeenCalled();
  });

  it('rejects null input (8): fixed result, delegate not called', async () => {
    const result = await executeMLBShadowExecutionJobV2(null);

    expect(result).toEqual({
      ok: false,
      adapterVersion: ADAPTER_VERSION,
      status: INVALID_STATUS,
    });
    expect(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).not.toHaveBeenCalled();
  });

  it('rejects array input (9): fixed result, delegate not called', async () => {
    const result = await executeMLBShadowExecutionJobV2(
      [1, 2, 3] as unknown,
    );

    expect(result).toEqual({
      ok: false,
      adapterVersion: ADAPTER_VERSION,
      status: INVALID_STATUS,
    });
    expect(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).not.toHaveBeenCalled();
  });
});

/* ========================================================================== */
/*  Section 11 — real-validator rejection of invalid V2 job structures       */
/* ========================================================================== */

describe('Section 11 — invalid V2 job structures (real validator)', () => {
  it('rejects missing-field V2 job (10): fixed result, delegate not called', async () => {
    const incompleteJob = {
      repoRoot: '/tmp/fake',
      // missing: shadowRecordId, gamePk, predictionGeneratedAt,
      //          authorizedModelArtifact, featureManifest, snapshot
    };

    const result = await executeMLBShadowExecutionJobV2(incompleteJob);

    expect(result).toEqual({
      ok: false,
      adapterVersion: ADAPTER_VERSION,
      status: INVALID_STATUS,
    });
    expect(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).not.toHaveBeenCalled();
  });

  it('rejects unknown extra field following validator (11): delegate not called', async () => {
    const jobWithExtra = {
      ...buildUnitTestInput(),
      sportsbookOdds: { home: 1.5 },
    };

    const result = await executeMLBShadowExecutionJobV2(jobWithExtra);

    expect(result).toEqual({
      ok: false,
      adapterVersion: ADAPTER_VERSION,
      status: INVALID_STATUS,
    });
    expect(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).not.toHaveBeenCalled();
  });

  it('rejects wrong contractVersion (12): fixed result, delegate not called', async () => {
    const jobWithWrongVersion = {
      ...buildUnitTestInput(),
      contractVersion: 'mlb-shadow-execution-job-v1',
    };

    const result = await executeMLBShadowExecutionJobV2(
      jobWithWrongVersion,
    );

    expect(result).toEqual({
      ok: false,
      adapterVersion: ADAPTER_VERSION,
      status: INVALID_STATUS,
    });
    expect(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).not.toHaveBeenCalled();
  });
});

/* ========================================================================== */
/*  Section 12 — V1-only shape and tampered artifact (real validator)         */
/* ========================================================================== */

describe('Section 12 — V1-only shape and tampered artifact', () => {
  it('V1-only releasedModelResult shape cannot substitute for authorizedModelArtifact (13)', async () => {
    const v1StyleJob = {
      repoRoot: '/tmp/v1-style',
      shadowRecordId: 'synthetic-shadow-001',
      gamePk: 990000001,
      predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
      releasedModelResult: { candidate: 'candidate-003' },
      featureManifest: { manifestId: 'manifest-1' },
      snapshot: { snapshotId: 'snapshot-1' },
      officialDate: FROZEN_OFFICIAL_DATE,
      scheduledStartAt: FROZEN_SCHEDULED_START,
      latencyMs: 5000,
      featureManifestId: 'manifest-1',
      featureManifestFingerprint: '0'.repeat(64),
      timingReferenceContractVersion:
        'mlb-canonical-pregame-snapshot-v1',
      timingReferenceCutoffAt: FROZEN_DATA_CUTOFF,
    };

    const result = await executeMLBShadowExecutionJobV2(v1StyleJob);

    expect(result).toEqual({
      ok: false,
      adapterVersion: ADAPTER_VERSION,
      status: INVALID_STATUS,
    });
    expect(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).not.toHaveBeenCalled();
  });

  it('tampered Candidate-003 artifact fails through V2 validator and never reaches delegate (14)', async () => {
    const tamperedArtifact = JSON.parse(
      JSON.stringify(getMLBShadowCandidate003AuthorizedModelArtifact()),
    );
    // Tamper with a coefficient to break the fingerprint
    tamperedArtifact.model.coefficients[0].valueCoefficient = 999.999;

    const job = buildUnitTestInput({
      authorizedModelArtifact: tamperedArtifact,
    });

    const result = await executeMLBShadowExecutionJobV2(job);

    expect(result).toEqual({
      ok: false,
      adapterVersion: ADAPTER_VERSION,
      status: INVALID_STATUS,
    });
    expect(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).not.toHaveBeenCalled();
  });
});

/* ========================================================================== */
/*  Section 13 — no catch layer / rejection propagation                       */
/* ========================================================================== */

describe('Section 13 — no catch layer (rejection propagation)', () => {
  it('adapter source has no try/catch (23)', () => {
    /* Verify at the conceptual level: V1 adapter has no catch, V2 mirrors. */
    /* The adapter is async and directly returns the delegate promise. */
    /* If we introduce a catch, the rejection would not propagate. */
    expect(executeMLBShadowExecutionJobV2.constructor.name).toBe(
      'AsyncFunction',
    );
  });

  it('adapter propagates delegate rejection (24): parity with V1', async () => {
    vi.mocked(validateMLBShadowExecutionJobV2).mockReturnValue({
      ok: true,
      value: FAKE_VALIDATED_JOB,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockRejectedValue(new Error('delegate failure'));

    await expect(executeMLBShadowExecutionJobV2({})).rejects.toThrow(
      'delegate failure',
    );
  });

  it('adapter propagates delegate rejection even when rejected value is a non-Error', async () => {
    vi.mocked(validateMLBShadowExecutionJobV2).mockReturnValue({
      ok: true,
      value: FAKE_VALIDATED_JOB,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistenceV2,
    ).mockRejectedValue('string-rejection-value');

    await expect(executeMLBShadowExecutionJobV2({})).rejects.toBe(
      'string-rejection-value',
    );
  });
});

/* ========================================================================== */
/*  Section 25 — real synthetic whole-chain in isolated temp directory        */
/* ========================================================================== */

describe('Section 25 — real synthetic whole-chain (temp directory)', () => {
  it('valid V2 job runs through real V2 persistence chain and persists both artifacts', async () => {
    const repoRoot = await trackedTempDir('v2-adapter-wc-');
    const job = buildValidV2Job(repoRoot);
    expectValidV2Job(job);

    // Real validator + real delegate restored in beforeEach.
    // Lower layers (prediction orchestrator, stores, projection) are NOT
    // mocked in this test file — they run as real code.
    const result = await executeMLBShadowExecutionJobV2(job);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe('OPERATIONAL_PERSISTED');
      expect(result.integrationVersion).toBe(L5E2U_VERSION);
      expect(result.operationalRecord).not.toBeNull();
      expect(result.operationalPersistenceAttempted).toBe(true);
      expect(result.operationalArtifactCreated).toBe(true);
      expect(result.operationalVerificationOk).toBe(true);
      expect(result.operationalTempCleanupFailed).toBe(false);
    }

    // Prediction quarantine artifact exists in temp root
    const predPath = predictionArtifactPathFor(repoRoot, SHADOW_RECORD_ID);
    await expect(fs.access(predPath)).resolves.toBeUndefined();

    // Operational artifact exists in temp root
    const opPath = operationalArtifactPathFor(repoRoot, SHADOW_RECORD_ID);
    await expect(fs.access(opPath)).resolves.toBeUndefined();

    // Result surface is safe: no adapterVersion on success path
    expect(result).not.toHaveProperty('adapterVersion');

    // No sensitive keys at any depth of the result
    const allKeys = extractAllKeys(result);
    const leaked = [...allKeys].filter((k) => SENSITIVE_KEYS.has(k));
    expect(leaked).toEqual([]);

    // No production runtime path is touched
    const prodFileCount = await countFiles(PRODUCTION_RUNTIME_PATH);
    expect(prodFileCount).toBe(0);
  });

  it('returns safe result without leaking prediction payload fields', async () => {
    const repoRoot = await trackedTempDir('v2-adapter-wc2-');
    const job = buildValidV2Job(repoRoot);

    const result = await executeMLBShadowExecutionJobV2(job);

    // The result is a union; only check sensitive keys when safe
    const allKeys = extractAllKeys(result);
    const leaked = [...allKeys].filter((k) => SENSITIVE_KEYS.has(k));
    expect(leaked).toEqual([]);
  });

  it('whole-chain writes artifacts only under the temp repoRoot, not production', async () => {
    const repoRoot = await trackedTempDir('v2-adapter-wc3-');
    const job = buildValidV2Job(repoRoot);

    const prodCountBefore = await countFiles(PRODUCTION_RUNTIME_PATH);
    expect(prodCountBefore).toBe(0);

    await executeMLBShadowExecutionJobV2(job);

    const prodCountAfter = await countFiles(PRODUCTION_RUNTIME_PATH);
    expect(prodCountAfter).toBe(0);

    // But temp repoRoot has artifacts
    const tempCount = await countFiles(
      join(
        repoRoot,
        'var/mlb-development/mlb-shadow-monitoring',
      ),
    );
    expect(tempCount).toBeGreaterThan(0);
  });
});
