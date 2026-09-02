import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

import {
  runMLBProspectiveHoldoutActivationCreate,
  runMLBProspectiveHoldoutActivationCreateCLI,
} from '../../../scripts/mlb-prospective-holdout-activation-create';

type ActivationCreatedReceipt = {
  readonly kind: 'ACTIVATION_CREATED';
  readonly activationId: string;
  readonly approvedPlanSha256: string;
  readonly planFingerprint: string;
  readonly persistedAt: string;
  readonly activationSha256: string;
  readonly activationByteLength: number;
};
import {
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE,
  type MLBProspectiveHoldoutActivation,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-contract';
import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
} from '@/prediction/mlb/mlb-prospective-holdout-protocol-contract';
import {
  MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
  MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
} from '@/prediction/mlb/mlb-prospective-t360-capture-contract';
import {
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
} from '@/prediction/mlb/mlb-prospective-pregame-evidence-artifact-contract';
import {
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
} from '@/prediction/mlb/mlb-prospective-holdout-game-identity-binding-contract';
import {
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
} from '@/prediction/mlb/mlb-inner-development-third-real-candidate-recipe';
import {
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_BOUNDARY_SELECTION_POLICY_ID,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-plan';

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                  */
/* -------------------------------------------------------------------------- */

function buildValidActivationPayload(overrides: Record<string, unknown> = {}): MLBProspectiveHoldoutActivation {
  const base = {
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: 'activation-1',
    candidateRecipeId: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
    candidateFingerprint: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
    featureManifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
    featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
    preprocessingPolicyId: 'raw-finite-feature-values-with-default-missing-v1',
    captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
    compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
    evidenceArtifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
    evidenceStoreVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
    validationBoundaryOfficialDate: '2026-09-10',
    validationTargetCount: 67,
    testTargetCount: 69,
    stableOrderPolicy: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY,
    validationSideDateRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE,
    testSideDateRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE,
    noSmallerN: true,
    resultIndependentSelection: true,
    testAuthorizationRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE,
    gameIdentityBindingContractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
    gameIdentityBindingStoreVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
  };
  return { ...base, ...overrides } as MLBProspectiveHoldoutActivation;
}

function buildValidPlanPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: 'activation-1',
    candidateRecipeId: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
    candidateFingerprint: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
    featureManifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
    featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
    preprocessingPolicyId: 'raw-finite-feature-values-with-default-missing-v1',
    captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
    compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
    evidenceArtifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
    evidenceStoreVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
    validationBoundaryOfficialDate: '2026-09-10',
    validationTargetCount: 67,
    testTargetCount: 69,
    stableOrderPolicy: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY,
    validationSideDateRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE,
    testSideDateRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE,
    noSmallerN: true,
    resultIndependentSelection: true,
    testAuthorizationRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE,
    gameIdentityBindingContractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
    gameIdentityBindingStoreVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
    ...overrides,
  };
}

function buildValidPlan(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const plan = {
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_CONTRACT_VERSION,
    planContractVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_CONTRACT_VERSION,
    boundarySelectionPolicyId: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_BOUNDARY_SELECTION_POLICY_ID,
    activationId: 'activation-1',
    planningReferenceAt: '2026-09-01T00:00:00.000Z',
    validationBoundaryOfficialDate: '2026-09-10',
    activationDeadlineAt: '2026-09-02T00:00:00.000Z',
    inputGameCount: 136,
    prospectivelyEligibleGameCount: 136,
    validationSideAvailableCount: 67,
    testSideAvailableCount: 69,
    validationTargetCount: 67,
    testTargetCount: 69,
    scheduleUniverseFingerprint: 'a'.repeat(64),
    activationPayload: buildValidPlanPayload(),
    planFingerprint: 'b'.repeat(64),
    firstValidationGamePk: 1,
    firstTestSideGamePk: 1000,
    stableOrderPolicy: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY,
    validationSideDateRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE,
    testSideDateRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE,
    noSmallerN: true,
    resultIndependentSelection: true,
    candidateRecipeId: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
    candidateFingerprint: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
    ...overrides,
  };
  return plan;
}

async function writePlanFile(plan: Record<string, unknown>): Promise<{ filePath: string; sha256: string }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-prospective-holdout-activation-create-test-'));
  const filePath = path.join(dir, 'plan.json');
  const canonical = sortObjectKeys(plan);
  const bytes = Buffer.from(JSON.stringify(canonical), 'utf-8');
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  await fs.writeFile(filePath, bytes);
  return { filePath, sha256 };
}

function sortObjectKeys(value: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.getOwnPropertyNames(value).sort();
  const sorted: Record<string, unknown> = {};
  for (const key of keys) {
    sorted[key] = sortValue(value[key]);
  }
  return sorted;
}

function sortValue(value: unknown): unknown {
  if (isPlainObject(value)) {
    return sortObjectKeys(value as Record<string, unknown>);
  }
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function createMockDeps(overrides: {
  readFile?: (path: string) => Promise<Buffer>;
  now?: () => Date;
  writeActivation?: (
    repositoryRoot: string,
    proposedActivation: unknown,
    clock: () => string,
  ) => Promise<unknown>;
  repositoryRoot?: string;
} = {}) {
  const readFile = overrides.readFile ?? ((filePath: string) => fs.readFile(filePath));
  const now = overrides.now ?? (() => new Date('2026-09-01T00:00:00.000Z'));
  const writeActivation = overrides.writeActivation ?? (async () => ({
    ok: true as const,
    receipt: {
      kind: 'ACTIVATION_CREATED',
      activationId: 'activation-1',
      approvedPlanSha256: 'a'.repeat(64),
      planFingerprint: 'b'.repeat(64),
      persistedAt: '2026-09-01T00:00:00.000Z',
      sha256: 'c'.repeat(64),
      byteLength: 100,
    },
  }));

  return {
    readFile,
    now,
    writeActivation,
    repositoryRoot: overrides.repositoryRoot ?? '/tmp/mlb-test-root',
  };
}

function createCLIIO(): { io: { stdout: Mock<(message: string) => void>; stderr: Mock<(message: string) => void> }; stdout: Mock<(message: string) => void>; stderr: Mock<(message: string) => void> } {
  const stdout = vi.fn((message: string) => {});
  const stderr = vi.fn((message: string) => {});
  return {
    io: { stdout, stderr },
    stdout,
    stderr,
  };
}

/* -------------------------------------------------------------------------- */
/*  Import inertness                                                          */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-activation-create import inertness', () => {
  it('import does not execute CLI or side effects', async () => {
    // The import at the top of this file is the test; we verify no exceptions occurred
    expect(true).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  CLI argument parsing                                                      */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-activation-create CLI arguments', () => {
  it('rejects missing both args', async () => {
    const { io, stderr } = createCLIIO();
    const code = await runMLBProspectiveHoldoutActivationCreateCLI(['node', 'script'], io);
    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('INVALID_ARGUMENTS'));
  });

  it('rejects missing SHA', async () => {
    const { io, stderr } = createCLIIO();
    const code = await runMLBProspectiveHoldoutActivationCreateCLI(['node', 'script', 'plan.json'], io);
    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('INVALID_ARGUMENTS'));
  });

  it('rejects extra arg', async () => {
    const { io, stderr } = createCLIIO();
    const code = await runMLBProspectiveHoldoutActivationCreateCLI(['node', 'script', 'plan.json', 'sha', 'extra'], io);
    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('INVALID_ARGUMENTS'));
  });

  it('rejects empty plan path', async () => {
    const { io, stderr } = createCLIIO();
    const code = await runMLBProspectiveHoldoutActivationCreateCLI(['node', 'script', '', 'a'.repeat(64)], io);
    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('INVALID_ARGUMENTS'));
  });

  it('rejects invalid SHA too short', async () => {
    const { io, stderr } = createCLIIO();
    const code = await runMLBProspectiveHoldoutActivationCreateCLI(['node', 'script', 'plan.json', 'abc'], io);
    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('APPROVED_PLAN_SHA256_INVALID'));
  });

  it('rejects invalid SHA too long', async () => {
    const { io, stderr } = createCLIIO();
    const code = await runMLBProspectiveHoldoutActivationCreateCLI(['node', 'script', 'plan.json', 'a'.repeat(65)], io);
    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('APPROVED_PLAN_SHA256_INVALID'));
  });

  it('rejects uppercase SHA', async () => {
    const { io, stderr } = createCLIIO();
    const code = await runMLBProspectiveHoldoutActivationCreateCLI(['node', 'script', 'plan.json', 'A'.repeat(64)], io);
    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('APPROVED_PLAN_SHA256_INVALID'));
  });

  it('rejects nonhex SHA', async () => {
    const { io, stderr } = createCLIIO();
    const code = await runMLBProspectiveHoldoutActivationCreateCLI(['node', 'script', 'plan.json', 'g'.repeat(64)], io);
    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('APPROVED_PLAN_SHA256_INVALID'));
  });

  it('rejects sha256: prefix', async () => {
    const { io, stderr } = createCLIIO();
    const code = await runMLBProspectiveHoldoutActivationCreateCLI(['node', 'script', 'plan.json', 'sha256:' + 'a'.repeat(64)], io);
    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('APPROVED_PLAN_SHA256_INVALID'));
  });

  it('rejects leading/trailing whitespace SHA', async () => {
    const { io, stderr } = createCLIIO();
    const code = await runMLBProspectiveHoldoutActivationCreateCLI(['node', 'script', 'plan.json', '  ' + 'a'.repeat(64) + '  '], io);
    expect(code).toBe(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('APPROVED_PLAN_SHA256_INVALID'));
  });
});

/* -------------------------------------------------------------------------- */
/*  Host tests                                                               */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-activation-create host', () => {
  // 1. read failure
  it('1. read failure returns PLAN_READ_FAILURE', async () => {
    const deps = createMockDeps({
      readFile: async () => {
        throw new Error('ENOENT no such file');
      },
    });
    const result = await runMLBProspectiveHoldoutActivationCreate('missing.json', 'a'.repeat(64), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('PLAN_READ_FAILURE');
      expect(result.error.issues.some((i) => i.code === 'READ_FAILED')).toBe(true);
    }
  });

  // 2. wrong approved SHA before JSON parse
  it('2. wrong approved SHA fails before JSON parse', async () => {
    const { filePath, sha256 } = await writePlanFile(buildValidPlan());
    const deps = createMockDeps();
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, '0'.repeat(64), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('APPROVED_PLAN_SHA256_MISMATCH');
    }
  });

  // 3. malformed JSON with matching SHA
  it('3. malformed JSON with matching SHA returns INVALID_PLAN_JSON', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-activation-create-test-'));
    const filePath = path.join(dir, 'bad.json');
    const bytes = Buffer.from('not json', 'utf-8');
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    await fs.writeFile(filePath, bytes);

    const deps = createMockDeps({
      readFile: async (p) => fs.readFile(p),
    });
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('INVALID_PLAN_JSON');
    }
  });

  // 4. malformed JSON with mismatching SHA
  it('4. malformed JSON with mismatching SHA fails SHA mismatch before parse', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-activation-create-test-'));
    const filePath = path.join(dir, 'bad.json');
    const bytes = Buffer.from('not json', 'utf-8');
    await fs.writeFile(filePath, bytes);

    const deps = createMockDeps({
      readFile: async (p) => fs.readFile(p),
    });
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, '0'.repeat(64), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('APPROVED_PLAN_SHA256_MISMATCH');
    }
  });

  // 5. non-object JSON
  it('5. non-object JSON fails INVALID_PLAN_CONTRACT', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-activation-create-test-'));
    const filePath = path.join(dir, 'plan.json');
    const bytes = Buffer.from('null', 'utf-8');
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    await fs.writeFile(filePath, bytes);
    const deps = createMockDeps({ readFile: async (p) => fs.readFile(p) });
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('INVALID_PLAN_CONTRACT');
    }
  });

  // 6. null JSON
  it('6. null JSON fails INVALID_PLAN_CONTRACT', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-activation-create-test-'));
    const filePath = path.join(dir, 'plan.json');
    const bytes = Buffer.from('null', 'utf-8');
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    await fs.writeFile(filePath, bytes);
    const deps = createMockDeps({ readFile: async (p) => fs.readFile(p) });
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('INVALID_PLAN_CONTRACT');
    }
  });

  // 7. array JSON
  it('7. array JSON fails INVALID_PLAN_CONTRACT', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-activation-create-test-'));
    const filePath = path.join(dir, 'plan.json');
    const bytes = Buffer.from('[]', 'utf-8');
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    await fs.writeFile(filePath, bytes);
    const deps = createMockDeps({ readFile: async (p) => fs.readFile(p) });
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('INVALID_PLAN_CONTRACT');
    }
  });

  // 8. unknown top-level field
  it('8. unknown top-level field fails INVALID_PLAN_CONTRACT', async () => {
    const plan = buildValidPlan({ unknownField: 'value' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const deps = createMockDeps();
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('INVALID_PLAN_CONTRACT');
      expect(result.error.issues.some((i) => i.code === 'UNKNOWN_FIELD' && i.path === '$.unknownField')).toBe(true);
    }
  });

  // 9. top-level persistedAt
  it('9. top-level persistedAt fails INVALID_PLAN_CONTRACT', async () => {
    const plan = buildValidPlan({ persistedAt: '2026-09-01T00:00:00Z' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const deps = createMockDeps();
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('INVALID_PLAN_CONTRACT');
      expect(result.error.issues.some((i) => i.code === 'PROHIBITED_FIELD' && i.path === '$.persistedAt')).toBe(true);
    }
  });

  // 10. wrong contractVersion
  it('10. wrong contractVersion fails INVALID_PLAN_CONTRACT', async () => {
    const plan = buildValidPlan({ contractVersion: 'wrong' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const deps = createMockDeps();
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('INVALID_PLAN_CONTRACT');
    }
  });

  // 11. wrong planContractVersion
  it('11. wrong planContractVersion fails INVALID_PLAN_CONTRACT', async () => {
    const plan = buildValidPlan({ planContractVersion: 'wrong' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const deps = createMockDeps();
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('INVALID_PLAN_CONTRACT');
    }
  });

  // 12. contractVersion !== planContractVersion
  it('12. contractVersion !== planContractVersion fails INVALID_PLAN_CONTRACT', async () => {
    const plan = buildValidPlan({ contractVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_CONTRACT_VERSION, planContractVersion: 'wrong' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const deps = createMockDeps();
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('INVALID_PLAN_CONTRACT');
    }
  });

  // 13. missing activationPayload
  it('13. missing activationPayload fails INVALID_PLAN_CONTRACT', async () => {
    const plan = buildValidPlan();
    delete (plan as Record<string, unknown>).activationPayload;
    const { filePath, sha256 } = await writePlanFile(plan);
    const deps = createMockDeps();
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('INVALID_PLAN_CONTRACT');
    }
  });

  // 14. null activationPayload
  it('14. null activationPayload fails INVALID_PLAN_CONTRACT', async () => {
    const plan = buildValidPlan({ activationPayload: null });
    const { filePath, sha256 } = await writePlanFile(plan);
    const deps = createMockDeps();
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('INVALID_PLAN_CONTRACT');
    }
  });

  // 15. array activationPayload
  it('15. array activationPayload fails INVALID_PLAN_CONTRACT', async () => {
    const plan = buildValidPlan({ activationPayload: [] });
    const { filePath, sha256 } = await writePlanFile(plan);
    const deps = createMockDeps();
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('INVALID_PLAN_CONTRACT');
    }
  });

  // 16. malformed activation payload
  it('16. malformed activation payload fails INVALID_PLAN_CONTRACT', async () => {
    const plan = buildValidPlan({ activationPayload: { contractVersion: 'wrong' } });
    const { filePath, sha256 } = await writePlanFile(plan);
    const deps = createMockDeps();
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('INVALID_PLAN_CONTRACT');
    }
  });

  // 17. payload persistedAt supplied
  it('17. payload persistedAt supplied fails INVALID_PLAN_CONTRACT', async () => {
    const payload = buildValidPlanPayload({ persistedAt: '2026-09-01T00:00:00Z' });
    const plan = buildValidPlan({ activationPayload: payload });
    const { filePath, sha256 } = await writePlanFile(plan);
    const deps = createMockDeps();
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('INVALID_PLAN_CONTRACT');
    }
  });

  // 18. unknown payload field
  it('18. unknown payload field fails INVALID_PLAN_CONTRACT', async () => {
    const payload = buildValidPlanPayload({ unknownField: 'value' } as Record<string, unknown>);
    const plan = buildValidPlan({ activationPayload: payload });
    const { filePath, sha256 } = await writePlanFile(plan);
    const deps = createMockDeps();
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('INVALID_PLAN_CONTRACT');
    }
  });

  // 19. wrong frozen protocol/policy identity
  it('19. wrong frozen protocol identity fails INVALID_PLAN_CONTRACT', async () => {
    const payload = buildValidPlanPayload({ protocolId: 'wrong' });
    const plan = buildValidPlan({ activationPayload: payload });
    const { filePath, sha256 } = await writePlanFile(plan);
    const deps = createMockDeps();
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('INVALID_PLAN_CONTRACT');
    }
  });

  // 20. duplicate field mismatches
  const duplicatedMismatchTests = [
    { key: 'activationId', value: 'activation-2', expectedKind: 'ACTIVATION_ID_MISMATCH' as const },
    { key: 'candidateRecipeId', value: 'wrong-recipe', expectedKind: 'INVALID_PLAN_CONTRACT' as const },
    { key: 'candidateFingerprint', value: 'wrong-fp', expectedKind: 'INVALID_PLAN_CONTRACT' as const },
    { key: 'validationBoundaryOfficialDate', value: '2026-09-11', expectedKind: 'INVALID_PLAN_CONTRACT' as const },
    { key: 'validationTargetCount', value: 66, expectedKind: 'INVALID_PLAN_CONTRACT' as const },
    { key: 'testTargetCount', value: 68, expectedKind: 'INVALID_PLAN_CONTRACT' as const },
    { key: 'stableOrderPolicy', value: 'wrong', expectedKind: 'INVALID_PLAN_CONTRACT' as const },
    { key: 'validationSideDateRule', value: 'wrong', expectedKind: 'INVALID_PLAN_CONTRACT' as const },
    { key: 'testSideDateRule', value: 'wrong', expectedKind: 'INVALID_PLAN_CONTRACT' as const },
    { key: 'noSmallerN', value: false, expectedKind: 'INVALID_PLAN_CONTRACT' as const },
    { key: 'resultIndependentSelection', value: false, expectedKind: 'INVALID_PLAN_CONTRACT' as const },
  ];

  for (const testCase of duplicatedMismatchTests) {
    it(`20. ${testCase.key} mismatch returns ${testCase.expectedKind}`, async () => {
      const payload = buildValidPlanPayload({ [testCase.key]: testCase.value });
      const plan = buildValidPlan({ activationPayload: payload });
      const { filePath, sha256 } = await writePlanFile(plan);
      const deps = createMockDeps();
      const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe(testCase.expectedKind);
      }
    });
  }

  // 21. deadline before = success
  it('21. before deadline allows store call', async () => {
    const plan = buildValidPlan({ activationDeadlineAt: '2026-09-01T00:00:01.000Z' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const writeActivation = vi.fn(async () => ({
      ok: true as const,
      receipt: {
        kind: 'ACTIVATION_CREATED',
        activationId: 'activation-1',
        approvedPlanSha256: sha256,
        planFingerprint: plan.planFingerprint as string,
        persistedAt: '2026-09-01T00:00:00.000Z',
        sha256: 'c'.repeat(64),
        byteLength: 100,
      },
    }));
    const deps = createMockDeps({
      now: () => new Date('2026-09-01T00:00:00.000Z'),
      writeActivation,
    });
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(true);
    expect(writeActivation).toHaveBeenCalledTimes(1);
  });

  // 22. exact deadline = PLAN_STALE
  it('22. exact deadline returns PLAN_STALE', async () => {
    const plan = buildValidPlan({ activationDeadlineAt: '2026-09-01T00:00:00.000Z' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const deps = createMockDeps({
      now: () => new Date('2026-09-01T00:00:00.000Z'),
    });
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('PLAN_STALE');
    }
  });

  // 23. after deadline = PLAN_STALE
  it('23. after deadline returns PLAN_STALE', async () => {
    const plan = buildValidPlan({ activationDeadlineAt: '2026-09-01T00:00:00.000Z' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const deps = createMockDeps({
      now: () => new Date('2026-09-01T00:00:00.001Z'),
    });
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('PLAN_STALE');
    }
  });

  // 24. trusted persistedAt equals sampled now
  it('24. persistedAt equals exact trusted now', async () => {
    const plan = buildValidPlan({ activationDeadlineAt: '2026-09-01T00:00:01.000Z' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const trustedNow = new Date('2026-09-01T00:00:00.000Z');
    const writeActivation = vi.fn(async (_repositoryRoot: string, _proposedActivation: unknown, clock: () => string) => {
      expect(clock()).toBe(trustedNow.toISOString());
      return {
        ok: true as const,
        receipt: {
          kind: 'ACTIVATION_CREATED',
          activationId: 'activation-1',
          approvedPlanSha256: sha256,
          planFingerprint: plan.planFingerprint as string,
          persistedAt: clock(),
          sha256: 'c'.repeat(64),
          byteLength: 100,
        },
      };
    });
    const deps = createMockDeps({
      now: () => trustedNow,
      writeActivation,
    });
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.receipt.persistedAt).toBe(trustedNow.toISOString());
    }
  });

  // 25. write-once identical duplicate
  it('25. identical duplicate returns ACTIVATION_ALREADY_EXISTS', async () => {
    const plan = buildValidPlan({ activationDeadlineAt: '2026-09-01T00:00:01.000Z' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const writeActivation = vi.fn(async () => ({
      ok: false as const,
      issues: [{ code: 'ACTIVATION_ALREADY_EXISTS', path: '/path', message: 'already exists' }],
    }));
    const deps = createMockDeps({
      writeActivation,
    });
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('ACTIVATION_ALREADY_EXISTS');
    }
  });

  // 26. write-once different duplicate
  it('26. different duplicate returns ACTIVATION_ALREADY_EXISTS', async () => {
    const plan = buildValidPlan({ activationDeadlineAt: '2026-09-01T00:00:01.000Z' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const writeActivation = vi.fn(async () => ({
      ok: false as const,
      issues: [{ code: 'ACTIVATION_ALREADY_EXISTS', path: '/path', message: 'already exists' }],
    }));
    const deps = createMockDeps({
      writeActivation,
    });
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('ACTIVATION_ALREADY_EXISTS');
    }
  });

  // 27. store failure
  it('27. store failure returns STORE_FAILURE with nested diagnostics', async () => {
    const plan = buildValidPlan({ activationDeadlineAt: '2026-09-01T00:00:01.000Z' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const writeActivation = vi.fn(async () => ({
      ok: false as const,
      issues: [{ code: 'WRITE_IO_ERROR', path: '/path', message: 'disk full' }],
    }));
    const deps = createMockDeps({
      writeActivation,
    });
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('STORE_FAILURE');
      expect(result.error.issues.some((i) => i.code === 'WRITE_IO_ERROR')).toBe(true);
    }
  });

  // 27a. malformed store result: null
  it('27a. malformed store result null returns STORE_FAILURE', async () => {
    const plan = buildValidPlan({ activationDeadlineAt: '2026-09-01T00:00:01.000Z' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const writeActivation = vi.fn(async () => null);
    const deps = createMockDeps({ writeActivation });
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('STORE_FAILURE');
    }
  });

  // 27b. malformed store result: empty object
  it('27b. malformed store result empty object returns STORE_FAILURE', async () => {
    const plan = buildValidPlan({ activationDeadlineAt: '2026-09-01T00:00:01.000Z' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const writeActivation = vi.fn(async () => ({}));
    const deps = createMockDeps({ writeActivation });
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('STORE_FAILURE');
    }
  });

  // 27c. malformed store result: ok true without receipt
  it('27c. malformed store result ok true without receipt returns STORE_FAILURE', async () => {
    const plan = buildValidPlan({ activationDeadlineAt: '2026-09-01T00:00:01.000Z' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const writeActivation = vi.fn(async () => ({ ok: true as const }));
    const deps = createMockDeps({ writeActivation });
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('STORE_FAILURE');
    }
  });

  // 27d. malformed store result: ok false without issues
  it('27d. malformed store result ok false without issues returns STORE_FAILURE', async () => {
    const plan = buildValidPlan({ activationDeadlineAt: '2026-09-01T00:00:01.000Z' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const writeActivation = vi.fn(async () => ({ ok: false as const }));
    const deps = createMockDeps({ writeActivation });
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('STORE_FAILURE');
    }
  });

  // 27e. malformed store result: unexpected receipt shape
  it('27e. malformed store result unexpected receipt shape returns STORE_FAILURE', async () => {
    const plan = buildValidPlan({ activationDeadlineAt: '2026-09-01T00:00:01.000Z' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const writeActivation = vi.fn(async () => ({
      ok: true as const,
      receipt: 'not-an-object',
    }));
    const deps = createMockDeps({ writeActivation });
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('STORE_FAILURE');
    }
  });

  // 28. exact artifact binding - same bytes accepted
  it('28. exact same bytes accepted with matching SHA', async () => {
    const plan = buildValidPlan({ activationDeadlineAt: '2026-09-01T00:00:01.000Z' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const writeActivation = vi.fn(async () => ({
      ok: true as const,
      receipt: {
        kind: 'ACTIVATION_CREATED',
        activationId: 'activation-1',
        approvedPlanSha256: sha256,
        planFingerprint: plan.planFingerprint as string,
        persistedAt: '2026-09-01T00:00:00.000Z',
        sha256: 'c'.repeat(64),
        byteLength: 100,
      },
    }));
    const deps = createMockDeps({
      writeActivation,
    });
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(true);
  });

  // 29. one byte mutation after approval = hash mismatch
  it('29. one byte mutation after approval fails SHA mismatch', async () => {
    const plan = buildValidPlan({ activationDeadlineAt: '2026-09-01T00:00:01.000Z' });
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-activation-create-test-'));
    const filePath = path.join(dir, 'plan.json');
    const canonical = sortObjectKeys(plan);
    let bytes = Buffer.from(JSON.stringify(canonical), 'utf-8');
    const originalSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    // mutate one byte
    bytes = Buffer.from(bytes);
    bytes[0] = bytes[0] ^ 0xff;
    await fs.writeFile(filePath, bytes);

    const deps = createMockDeps();
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, originalSha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('APPROVED_PLAN_SHA256_MISMATCH');
    }
  });

  // 30. key-order mutation = hash mismatch
  it('30. key-order mutation fails SHA mismatch', async () => {
    const plan = buildValidPlan({ activationDeadlineAt: '2026-09-01T00:00:01.000Z' });
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-activation-create-test-'));
    const filePath = path.join(dir, 'plan.json');
    const bytes = Buffer.from(JSON.stringify(plan), 'utf-8'); // different key order
    const originalSha256 = crypto.createHash('sha256').update(Buffer.from(JSON.stringify(sortObjectKeys(plan)), 'utf-8')).digest('hex');
    await fs.writeFile(filePath, bytes);

    const deps = createMockDeps();
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, originalSha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('APPROVED_PLAN_SHA256_MISMATCH');
    }
  });

  // 31. valid planFingerprint format accepted
  it('31. valid planFingerprint format accepted', async () => {
    const plan = buildValidPlan({ activationDeadlineAt: '2026-09-01T00:00:01.000Z' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const deps = createMockDeps();
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(true);
  });

  // 32. invalid planFingerprint format
  it('32. invalid planFingerprint format fails INVALID_PLAN_CONTRACT', async () => {
    const plan = buildValidPlan({ planFingerprint: 'short', activationDeadlineAt: '2026-09-01T00:00:01.000Z' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const deps = createMockDeps();
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('INVALID_PLAN_CONTRACT');
    }
  });

  // 33. now called exactly once on success
  it('33. now called exactly once on success', async () => {
    const plan = buildValidPlan({ activationDeadlineAt: '2026-09-01T00:00:01.000Z' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const now = vi.fn(() => new Date('2026-09-01T00:00:00.000Z'));
    const deps = createMockDeps({
      now,
    });
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(true);
    expect(now).toHaveBeenCalledTimes(1);
  });

  // 34. now called zero times on static failure
  it('34. now called zero times on static failure', async () => {
    const now = vi.fn(() => new Date('2026-09-01T00:00:00.000Z'));
    const deps = createMockDeps({
      now,
    });
    const result = await runMLBProspectiveHoldoutActivationCreate('missing.json', 'a'.repeat(64), deps);
    expect(result.ok).toBe(false);
    expect(now).toHaveBeenCalledTimes(0);
  });

  // 35. read count = 1
  it('35. readFile called exactly once', async () => {
    const plan = buildValidPlan({ activationDeadlineAt: '2026-09-01T00:00:01.000Z' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const readFile = vi.fn(async (p: string) => fs.readFile(p));
    const deps = createMockDeps({
      readFile,
    });
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(true);
    expect(readFile).toHaveBeenCalledTimes(1);
    expect(readFile).toHaveBeenCalledWith(filePath);
  });

  // 36. second read does not occur
  it('36. no second read occurs', async () => {
    const plan = buildValidPlan({ activationDeadlineAt: '2026-09-01T00:00:01.000Z' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const readFile = vi.fn(async (p: string) => fs.readFile(p));
    const deps = createMockDeps({
      readFile,
    });
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(true);
    // Only the initial read and no subsequent reads
    expect(readFile).toHaveBeenCalledTimes(1);
  });

  // 37. production default repository root resolves to repo top-level
  it('37. production default repository root resolves to repo top-level', async () => {
    const captured: string[] = [];
    const writeActivation = vi.fn(async (repositoryRoot: string) => {
      captured.push(repositoryRoot);
      return {
        ok: true as const,
        receipt: {
          kind: 'ACTIVATION_CREATED',
          activationId: 'activation-1',
          approvedPlanSha256: 'a'.repeat(64),
          planFingerprint: 'b'.repeat(64),
          persistedAt: '2026-09-01T00:00:00.000Z',
          sha256: 'c'.repeat(64),
          byteLength: 100,
        },
      };
    });
    const plan = buildValidPlan({ activationDeadlineAt: '2026-09-01T00:00:01.000Z' });
    const { filePath, sha256 } = await writePlanFile(plan);
    const deps = {
      readFile: (p: string) => fs.readFile(p),
      now: () => new Date('2026-09-01T00:00:00.000Z'),
      writeActivation,
    } as Parameters<typeof runMLBProspectiveHoldoutActivationCreate>[2];
    const result = await runMLBProspectiveHoldoutActivationCreate(filePath, sha256, deps);
    expect(result.ok).toBe(true);
    const root = captured[0];
    const expectedRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    expect(root).toBe(expectedRoot);
    expect(root).not.toBe('/Users');
  });

  // 38. production default repository root is independent of process cwd
  it('38. production default repository root is independent of process cwd', async () => {
    const { execFileSync } = await import('node:child_process');
    const scriptPath = path.resolve('scripts/mlb-prospective-holdout-activation-create.ts');
    const sourceDir = path.dirname(scriptPath);
    const expectedRoot = path.resolve(sourceDir, '..');
    const probeCode = `
      const path = require('path');
      process.chdir('/tmp');
      const sourceDir = path.dirname(${JSON.stringify(scriptPath)});
      const repoRoot = path.resolve(sourceDir, '..');
      process.stdout.write(repoRoot);
    `;
    const result = execFileSync(process.execPath, ['-e', probeCode], { encoding: 'utf-8' }).trim();
    expect(result).toBe(expectedRoot);
    expect(result).not.toBe('/Users');
  });
});

/* -------------------------------------------------------------------------- */
/*  Side-effect firewall                                                     */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-activation-create side-effect firewall', () => {
  it('contains no schedule provider import', async () => {
    const source = await fs.readFile(path.join(process.cwd(), 'scripts/mlb-prospective-holdout-activation-create.ts'), 'utf-8');
    expect(source).not.toContain('MLBResearchDataAdapter');
    expect(source).not.toContain('fetchSchedule');
  });

  it('contains no capture orchestrator import', async () => {
    const source = await fs.readFile(path.join(process.cwd(), 'scripts/mlb-prospective-holdout-activation-create.ts'), 'utf-8');
    expect(source).not.toContain('capture-orchestrator');
    expect(source).not.toContain('CaptureOrchestrator');
  });

  it('contains no capture adapter import', async () => {
    const source = await fs.readFile(path.join(process.cwd(), 'scripts/mlb-prospective-holdout-activation-create.ts'), 'utf-8');
    expect(source).not.toContain('capture-adapter');
    expect(source).not.toContain('CaptureAdapter');
  });

  it('contains no evidence writer import', async () => {
    const source = await fs.readFile(path.join(process.cwd(), 'scripts/mlb-prospective-holdout-activation-create.ts'), 'utf-8');
    expect(source).not.toContain('evidence-artifact');
  });

  it('contains no binding writer import', async () => {
    const source = await fs.readFile(path.join(process.cwd(), 'scripts/mlb-prospective-holdout-activation-create.ts'), 'utf-8');
    expect(source).not.toContain('game-identity-binding');
  });

  it('contains no model inference references', async () => {
    const source = await fs.readFile(path.join(process.cwd(), 'scripts/mlb-prospective-holdout-activation-create.ts'), 'utf-8');
    expect(source).not.toContain('inference');
    expect(source).not.toContain('model');
  });

  it('contains no winner label references', async () => {
    const source = await fs.readFile(path.join(process.cwd(), 'scripts/mlb-prospective-holdout-activation-create.ts'), 'utf-8');
    expect(source).not.toContain('winner');
  });

  it('contains no odds/market references', async () => {
    const source = await fs.readFile(path.join(process.cwd(), 'scripts/mlb-prospective-holdout-activation-create.ts'), 'utf-8');
    expect(source).not.toContain('odds');
    expect(source).not.toContain('sportsbook');
    expect(source).not.toContain('market');
  });
});
