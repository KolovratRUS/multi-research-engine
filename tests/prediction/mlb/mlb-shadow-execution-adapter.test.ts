/* -------------------------------------------------------------------------- */
/*  Single-job shadow execution adapter — unit tests                            */
/* -------------------------------------------------------------------------- */
/**
 * All persistence and validation is mocked so NO real L5E2U execution or
 * persistence occurs. Tests cover adapter control-flow, result-preservation,
 * firewall, and identity invariants.
 */

vi.mock(
  '@/prediction/mlb/mlb-shadow-execution-job-contract',
  () => ({
    MLB_SHADOW_EXECUTION_JOB_CONTRACT_VERSION: 'mlb-shadow-execution-job-v1',
    validateMLBShadowExecutionJob: vi.fn(),
  }),
);

vi.mock(
  '@/prediction/mlb/mlb-shadow-monitoring-persistence-orchestrator',
  () => ({
    MLB_SHADOW_MONITORING_PERSISTENCE_ORCHESTRATOR_VERSION:
      'mlb-shadow-monitoring-persistence-orchestrator-v1',
    orchestrateMLBShadowMonitoringPredictionPersistence: vi.fn(),
  }),
);

/* -------------------------------------------------------------------------- */
/*  Imports (mocked modules)                                                  */
/* -------------------------------------------------------------------------- */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateMLBShadowExecutionJob,
  type MLBShadowExecutionJobValidationResult,
} from '@/prediction/mlb/mlb-shadow-execution-job-contract';
import {
  orchestrateMLBShadowMonitoringPredictionPersistence,
} from '@/prediction/mlb/mlb-shadow-monitoring-persistence-orchestrator';
import type { MLBShadowMonitoringPredictionPersistenceIntegrationResult } from '@/prediction/mlb/mlb-shadow-monitoring-persistence-orchestrator';
import type { MLBShadowExecutionJobV1 } from '@/prediction/mlb/mlb-shadow-execution-job-contract';
import type { MLBShadowMonitoringOperationalRecord } from '@/prediction/mlb/mlb-shadow-monitoring-record-contract';

/* -- Module under test -- */
import {
  executeMLBShadowExecutionJob,
  MLB_SHADOW_EXECUTION_ADAPTER_VERSION,
  type MLBShadowExecutionAdapterResult,
  type MLBShadowExecutionAdapterInvalidResult,
} from '@/prediction/mlb/mlb-shadow-execution-adapter';

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */
const ADAPTER_VERSION = 'mlb-shadow-execution-adapter-v1';
const L5E2U_VERSION = 'mlb-shadow-monitoring-persistence-orchestrator-v1';
const INVALID_STATUS = 'EXECUTION_JOB_INVALID';

/* -------------------------------------------------------------------------- */
/*  Mocked job + L5E2U result factories                                       */
/* -------------------------------------------------------------------------- */
/** A minimal validated job object (validator is mocked, so shape is opaque). */
const FAKE_VALIDATED_JOB = Object.freeze({
  repoRoot: '/tmp/fake-repo',
  shadowRecordId: 'synthetic-shadow-001',
  gamePk: 990000001,
  predictionGeneratedAt: '2026-07-15T18:40:00Z',
  releasedModelResult: { candidate: 'candidate-003' },
  featureManifest: { manifestId: 'manifest-1' },
  snapshot: { snapshotId: 'snapshot-1' },
  officialDate: '2026-07-15',
  scheduledStartAt: '2026-07-15T12:00:00Z',
  latencyMs: 5000,
  featureManifestId: 'manifest-1',
  featureManifestFingerprint:
    '0'.repeat(64),
  timingReferenceContractVersion: 'mlb-offline-pregame-inference-v1',
  timingReferenceCutoffAt: '2026-07-15T09:00:00Z',
}) as unknown as MLBShadowExecutionJobV1;

/** Issues that must NEVER escape through the adapter. */
const LEAKY_ISSUES: MLBShadowExecutionJobValidationResult = {
  ok: false,
  issues: [
    {
      code: 'MODEL_NOT_AUTHORITATIVE',
      path: '$.releasedModelResult',
      message: 'Released model is not the frozen candidate-003 model',
    },
    {
      code: 'ODDS_CONTAMINATION',
      path: '$.featureManifest',
      message: 'Feature manifest contains a prohibited odds/sportsbook field',
    },
    {
      code: 'UNKNOWN_FIELD',
      path: '$.sportsbookOdds',
      message: 'Unknown field: sportsbookOdds',
    },
  ],
} as const;

/** Builds a properly-typed L5E2U result. */
function buildL5E2UResult(
  overrides: Partial<MLBShadowMonitoringPredictionPersistenceIntegrationResult>,
): MLBShadowMonitoringPredictionPersistenceIntegrationResult {
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
  }) as unknown as MLBShadowMonitoringPredictionPersistenceIntegrationResult;
}

/* -------------------------------------------------------------------------- */
/*  Reset before each test                                                     */
/* -------------------------------------------------------------------------- */
beforeEach(() => {
  vi.mocked(validateMLBShadowExecutionJob).mockReset();
  vi.mocked(
    orchestrateMLBShadowMonitoringPredictionPersistence,
  ).mockReset();
});

/* -------------------------------------------------------------------------- */
/*  Section 1 — adapter version                                                 */
/* -------------------------------------------------------------------------- */
describe('Section 1 — adapter version', () => {
  it('exports the exact version string', () => {
    expect(MLB_SHADOW_EXECUTION_ADAPTER_VERSION).toBe(ADAPTER_VERSION);
  });

  it('matches the as-const literal type', () => {
    const v: typeof MLB_SHADOW_EXECUTION_ADAPTER_VERSION = ADAPTER_VERSION;
    expect(v).toBe(ADAPTER_VERSION);
  });
});

/* -------------------------------------------------------------------------- */
/*  Section 2 — invalid-job result                                            */
/* -------------------------------------------------------------------------- */
describe('Section 2 — invalid job handling', () => {
  beforeEach(() => {
    vi.mocked(validateMLBShadowExecutionJob).mockReturnValue({
      ok: false,
      issues: LEAKY_ISSUES.issues,
    });
  });

  it('returns the fixed invalid result shape', async () => {
    const result = await executeMLBShadowExecutionJob({ bad: true });

    expect(result).toEqual({
      ok: false,
      adapterVersion: ADAPTER_VERSION,
      status: INVALID_STATUS,
    });
  });

  it('contains exactly the authorized three keys', async () => {
    const result = await executeMLBShadowExecutionJob({ bad: true });

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
    const result = await executeMLBShadowExecutionJob({ bad: true });

    expect(result).not.toHaveProperty('issues');
  });

  it('contains no input values', async () => {
    const result = await executeMLBShadowExecutionJob({ bad: true });

    expect(result).not.toHaveProperty('input');
    expect(result).not.toHaveProperty('value');
    expect(result).not.toHaveProperty('job');
    expect(result).not.toHaveProperty('repoRoot');
    expect(result).not.toHaveProperty('gamePk');
  });

  it('contains no sensitive prediction fields', async () => {
    const result = await executeMLBShadowExecutionJob({ bad: true });

    expect(result).not.toHaveProperty('prediction');
    expect(result).not.toHaveProperty('predictedWinner');
    expect(result).not.toHaveProperty('probability');
    expect(result).not.toHaveProperty('modelFingerprint');
    expect(result).not.toHaveProperty('snapshot');
    expect(result).not.toHaveProperty('relativePath');
  });

  it('calls validator exactly once', async () => {
    await executeMLBShadowExecutionJob({ bad: true });

    expect(validateMLBShadowExecutionJob).toHaveBeenCalledTimes(1);
    expect(validateMLBShadowExecutionJob).toHaveBeenCalledWith({ bad: true });
  });

  it('calls L5E2U zero times', async () => {
    await executeMLBShadowExecutionJob({ bad: true });

    expect(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).not.toHaveBeenCalled();
  });

  it('validator rejection cannot trigger persistence', async () => {
    vi.mocked(validateMLBShadowExecutionJob).mockReturnValue({
      ok: false,
      issues: LEAKY_ISSUES.issues,
    });

    await executeMLBShadowExecutionJob({});

    expect(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/*  Section 3 — validation-failure firewall                                   */
/* -------------------------------------------------------------------------- */
describe('Section 3 — validation-failure firewall', () => {
  it('synthetic issue information does not escape', async () => {
    vi.mocked(validateMLBShadowExecutionJob).mockReturnValue({
      ok: false,
      issues: [
        {
          code: 'MODEL_NOT_AUTHORITATIVE',
          path: '$.releasedModelResult',
          message: 'Released model is not the frozen candidate-003 model',
        },
      ],
    });

    const result = await executeMLBShadowExecutionJob({
      releasedModelResult: { model: 'wrong' },
    });

    expect(result).toEqual({
      ok: false,
      adapterVersion: ADAPTER_VERSION,
      status: INVALID_STATUS,
    });

    const invalidResult = result as MLBShadowExecutionAdapterInvalidResult;
    expect(invalidResult.adapterVersion).toBe(ADAPTER_VERSION);
    expect(invalidResult.status).toBe(INVALID_STATUS);
  });
});

/* -------------------------------------------------------------------------- */
/*  Section 4 — valid-job delegation                                          */
/* -------------------------------------------------------------------------- */
describe('Section 4 — valid job delegation', () => {
  beforeEach(() => {
    vi.mocked(validateMLBShadowExecutionJob).mockReturnValue({
      ok: true,
      value: FAKE_VALIDATED_JOB,
    });
  });

  it('calls validator exactly once', async () => {
    await executeMLBShadowExecutionJob({});

    expect(validateMLBShadowExecutionJob).toHaveBeenCalledTimes(1);
    expect(validateMLBShadowExecutionJob).toHaveBeenCalledWith({});
  });

  it('calls L5E2U exactly once', async () => {
    const l5e2uResult = buildL5E2UResult({});

    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).mockResolvedValue(l5e2uResult);

    await executeMLBShadowExecutionJob({});

    expect(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).toHaveBeenCalledTimes(1);
  });

  it('passes validation.value to L5E2U (exact reference)', async () => {
    const l5e2uResult = buildL5E2UResult({});
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).mockResolvedValue(l5e2uResult);

    await executeMLBShadowExecutionJob({});

    expect(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).toHaveBeenCalledWith(FAKE_VALIDATED_JOB);
  });

  it('returns exact L5E2U result by reference', async () => {
    const l5e2uResult = buildL5E2UResult({});
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).mockResolvedValue(l5e2uResult);

    const result = await executeMLBShadowExecutionJob({});

    expect(result).toBe(l5e2uResult);
  });

  it('does not add adapterVersion to valid L5E2U result', async () => {
    const l5e2uResult = buildL5E2UResult({});
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).mockResolvedValue(l5e2uResult);

    const result = await executeMLBShadowExecutionJob({});

    expect(result).not.toHaveProperty('adapterVersion');
  });

  it('does not rewrite L5E2U status', async () => {
    const l5e2uResult = buildL5E2UResult({ status: 'OPERATIONAL_VERIFICATION_FAILED' });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).mockResolvedValue(l5e2uResult);

    const result = await executeMLBShadowExecutionJob({});

    expect(result).toBe(l5e2uResult);
  });
});

/* -------------------------------------------------------------------------- */
/*  Section 5 — L5E2U result preservation matrix                             */
/* -------------------------------------------------------------------------- */
describe('Section 5 — L5E2U result preservation matrix', () => {
  beforeEach(() => {
    vi.mocked(validateMLBShadowExecutionJob).mockReturnValue({
      ok: true,
      value: FAKE_VALIDATED_JOB,
    });
  });

  it('preserves successful persistence (ok=true, OPERATIONAL_PERSISTED)', async () => {
    const mocked = buildL5E2UResult({
      ok: true,
      status: 'OPERATIONAL_PERSISTED',
      operationalArtifactCreated: true,
      operationalVerificationOk: true,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).mockResolvedValue(mocked);

    const result = await executeMLBShadowExecutionJob({});

    expect(result).toBe(mocked);
  });

  it('preserves idempotent identical success', async () => {
    const mocked = buildL5E2UResult({
      ok: true,
      status: 'OPERATIONAL_IDEMPOTENT_IDENTICAL_SUCCESS',
      operationalArtifactCreated: false,
      operationalVerificationOk: true,
      operationalTempCleanupFailed: false,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).mockResolvedValue(mocked);

    const result = await executeMLBShadowExecutionJob({});

    expect(result).toBe(mocked);
  });

  it('preserves already-exists-different failure (ok=false)', async () => {
    const mocked = buildL5E2UResult({
      ok: false,
      status: 'OPERATIONAL_ALREADY_EXISTS_DIFFERENT',
      operationalArtifactCreated: false,
      operationalVerificationOk: false,
      operationalPersistenceAttempted: true,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).mockResolvedValue(mocked);

    const result = await executeMLBShadowExecutionJob({});

    expect(result).toBe(mocked);
  });

  it('preserves verification failure (ok=false)', async () => {
    const mocked = buildL5E2UResult({
      ok: false,
      status: 'OPERATIONAL_VERIFICATION_FAILED',
      operationalArtifactCreated: true,
      operationalVerificationOk: false,
      operationalTempCleanupFailed: false,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).mockResolvedValue(mocked);

    const result = await executeMLBShadowExecutionJob({});

    expect(result).toBe(mocked);
  });

  it('preserves pre-finalization failure (ok=false)', async () => {
    const mocked = buildL5E2UResult({
      ok: false,
      status: 'OPERATIONAL_PRE_FINALIZATION_FAILED',
      operationalArtifactCreated: false,
      operationalVerificationOk: false,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).mockResolvedValue(mocked);

    const result = await executeMLBShadowExecutionJob({});

    expect(result).toBe(mocked);
  });
});

/* -------------------------------------------------------------------------- */
/*  Section 6 — ok=true / ok=false preservation                               */
/* -------------------------------------------------------------------------- */
describe('Section 6 — ok flag preservation', () => {
  beforeEach(() => {
    vi.mocked(validateMLBShadowExecutionJob).mockReturnValue({
      ok: true,
      value: FAKE_VALIDATED_JOB,
    });
  });

  it('preserves L5E2U ok=true result unchanged', async () => {
    const mocked = buildL5E2UResult({ ok: true });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).mockResolvedValue(mocked);

    const result = await executeMLBShadowExecutionJob({});

    expect(result).toBe(mocked);
    expect(result.ok).toBe(true);
  });

  it('preserves L5E2U ok=false result unchanged', async () => {
    const mocked = buildL5E2UResult({
      ok: false,
      status: 'OPERATIONAL_PRE_FINALIZATION_FAILED',
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).mockResolvedValue(mocked);

    const result = await executeMLBShadowExecutionJob({});

    expect(result).toBe(mocked);
    expect(result.ok).toBe(false);
  });

  it('preserves operationalRecord reference unchanged', async () => {
    const fakeRecord = Object.freeze({
      contractVersion: 'mlb-shadow-monitoring-operational-record-v1',
      mode: 'S1_OPERATIONAL_BLIND',
      shadowRecordId: 'synthetic-shadow-001',
      gamePk: 990000001,
      predictionGeneratedAt: '2026-07-15T18:40:00Z',
    }) as unknown as MLBShadowMonitoringOperationalRecord;

    const mocked = buildL5E2UResult({
      operationalRecord: fakeRecord,
      status: 'OPERATIONAL_PERSISTED',
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).mockResolvedValue(mocked);

    const result = await executeMLBShadowExecutionJob({});

    expect(result).toBe(mocked);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.operationalRecord).toBe(fakeRecord);
    }
  });

  it('preserves artifactCreated / verification / cleanup fields unchanged', async () => {
    const mocked = buildL5E2UResult({
      status: 'OPERATIONAL_PERSISTED_WITH_CLEANUP_WARNING',
      operationalArtifactCreated: false,
      operationalVerificationOk: false,
      operationalTempCleanupFailed: true,
      operationalPersistenceAttempted: true,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).mockResolvedValue(mocked);

    const result = await executeMLBShadowExecutionJob({});

    expect(result).toBe(mocked);
  });
});

/* -------------------------------------------------------------------------- */
/*  Section 7 — immutability firewall                                         */
/* -------------------------------------------------------------------------- */
describe('Section 7 — immutability firewall', () => {
  beforeEach(() => {
    vi.mocked(validateMLBShadowExecutionJob).mockReturnValue({
      ok: true,
      value: FAKE_VALIDATED_JOB,
    });
  });

  it('adapter does not mutate original unknown input', async () => {
    const input = { repoRoot: '/tmp/input', extra: 'untouched' };
    const inputSnapshot = { ...input };

    vi.mocked(validateMLBShadowExecutionJob).mockReturnValue({
      ok: true,
      value: FAKE_VALIDATED_JOB,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).mockResolvedValue(buildL5E2UResult({}));

    await executeMLBShadowExecutionJob(input);

    expect(input).toEqual(inputSnapshot);
  });

  it('adapter does not mutate validation.value', async () => {
    const valueSnapshot = { ...FAKE_VALIDATED_JOB };

    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).mockResolvedValue(buildL5E2UResult({}));

    await executeMLBShadowExecutionJob({});

    expect(FAKE_VALIDATED_JOB).toEqual(valueSnapshot);
  });

  it('repeated invocation with same validator value causes identical delegation inputs', async () => {
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).mockResolvedValue(buildL5E2UResult({}));

    await executeMLBShadowExecutionJob({});
    await executeMLBShadowExecutionJob({});

    expect(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).toHaveBeenCalledTimes(2);
    expect(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).toHaveBeenNthCalledWith(1, FAKE_VALIDATED_JOB);
    expect(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).toHaveBeenNthCalledWith(2, FAKE_VALIDATED_JOB);
  });
});

/* -------------------------------------------------------------------------- */
/*  Section 8 — input-driven delegation                                       */
/* -------------------------------------------------------------------------- */
describe('Section 8 — input-driven delegation (no normalization)', () => {
  it('changing input only changes behavior through validator result', async () => {
    const jobA = Object.freeze({ repoRoot: '/repo-a' }) as unknown as MLBShadowExecutionJobV1;
    const jobB = Object.freeze({ repoRoot: '/repo-b' }) as unknown as MLBShadowExecutionJobV1;

    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).mockResolvedValue(buildL5E2UResult({}));

    vi.mocked(validateMLBShadowExecutionJob).mockReturnValueOnce({
      ok: true,
      value: jobA,
    });
    vi.mocked(validateMLBShadowExecutionJob).mockReturnValueOnce({
      ok: true,
      value: jobB,
    });

    const inputA = { id: 'job-a' };
    const inputB = { id: 'job-b' };

    await executeMLBShadowExecutionJob(inputA);
    await executeMLBShadowExecutionJob(inputB);

    expect(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).toHaveBeenNthCalledWith(1, jobA);
    expect(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).toHaveBeenNthCalledWith(2, jobB);
  });
});

/* -------------------------------------------------------------------------- */
/*  Section 9 — no real artifacts / no runtime generators                     */
/* -------------------------------------------------------------------------- */
describe('Section 9 — no generated execution values', () => {
  it('adapter returns invalid result with no shadowRecordId generated by adapter', async () => {
    vi.mocked(validateMLBShadowExecutionJob).mockReturnValue({
      ok: false,
      issues: LEAKY_ISSUES.issues,
    });

    const result = await executeMLBShadowExecutionJob({});

    expect(result).not.toHaveProperty('shadowRecordId');
    expect(result).not.toHaveProperty('predictionGeneratedAt');
    expect(result).not.toHaveProperty('latencyMs');
    expect(result).not.toHaveProperty('featureManifestFingerprint');
    expect(result).not.toHaveProperty('timingReferenceCutoffAt');
  });

  it('adapter does not generate any execution field on valid path', async () => {
    vi.mocked(validateMLBShadowExecutionJob).mockReturnValue({
      ok: true,
      value: FAKE_VALIDATED_JOB,
    });

    const spy = vi.fn().mockResolvedValue(buildL5E2UResult({}));
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).mockImplementation(spy as typeof orchestrateMLBShadowMonitoringPredictionPersistence);

    await executeMLBShadowExecutionJob({});

    const passedArg = spy.mock.calls[0][0];

    expect(passedArg).toBe(FAKE_VALIDATED_JOB);
    expect(passedArg).not.toBe({});
  });

  it('no real shadow artifacts written during tests', async () => {
    vi.mocked(validateMLBShadowExecutionJob).mockReturnValueOnce({
      ok: true,
      value: FAKE_VALIDATED_JOB,
    });
    vi.mocked(validateMLBShadowExecutionJob).mockReturnValue({
      ok: false,
      issues: LEAKY_ISSUES.issues,
    });
    vi.mocked(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).mockResolvedValue(buildL5E2UResult({}));

    await executeMLBShadowExecutionJob({});
    await executeMLBShadowExecutionJob({ invalid: true });

    expect(
      orchestrateMLBShadowMonitoringPredictionPersistence,
    ).toHaveBeenCalledTimes(1);
  });
});
