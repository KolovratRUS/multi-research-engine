import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_DIRECTORY,
  writeMLBProspectiveHoldoutActivation,
  readMLBProspectiveHoldoutActivation,
  resolveMLBProspectiveHoldoutActivationStorePaths,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-store';
import {
  type MLBProspectiveHoldoutActivation,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-contract';
import {
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
} from '@/prediction/mlb/mlb-prospective-holdout-game-identity-binding-contract';
import {
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
} from '@/prediction/mlb/mlb-inner-development-third-real-candidate-recipe';
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

function buildValidActivation(overrides: Record<string, unknown> = {}): MLBProspectiveHoldoutActivation {
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
    stableOrderPolicy: 'scheduledStartAt_ASC_gamePk_ASC',
    validationSideDateRule: 'OFFICIAL_DATE_LTE_BOUNDARY',
    testSideDateRule: 'OFFICIAL_DATE_GT_BOUNDARY',
    noSmallerN: true,
    resultIndependentSelection: true,
    testAuthorizationRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE,
    gameIdentityBindingContractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
    gameIdentityBindingStoreVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
  };
  return { ...base, ...overrides } as MLBProspectiveHoldoutActivation;
}

async function createTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'mlb-prospective-holdout-activation-store-test-'));
}

describe('mlb-prospective-holdout-activation-store', () => {
  describe('resolveMLBProspectiveHoldoutActivationStorePaths', () => {
    it('derives activation path under fixed store root', () => {
      const root = '/tmp/repo';
      const paths = resolveMLBProspectiveHoldoutActivationStorePaths(root);
      expect(paths.activationPath).toBe(
        path.join(root, MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_DIRECTORY, `${MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION}.json`),
      );
    });
  });

  describe('writeMLBProspectiveHoldoutActivation', () => {
    it('writes valid activation and returns receipt with hash/length', async () => {
      const root = await createTempRoot();
      try {
        const activation = buildValidActivation();
        const clock = vi.fn(() => '2026-09-01T00:00:00Z');
        const result = await writeMLBProspectiveHoldoutActivation(root, activation, clock);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.receipt.storeVersion).toBe(MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_VERSION);
          expect(result.receipt.contractVersion).toBe(MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION);
          expect(result.receipt.activationId).toBe('activation-1');
          expect(result.receipt.sha256).toMatch(/^[a-f0-9]{64}$/);
          expect(result.receipt.byteLength).toBeGreaterThan(0);
          expect(result.receipt.persistedAt).toBe('2026-09-01T00:00:00Z');

          const canonicalPath = path.join(root, MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_DIRECTORY, `${MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION}.json`);
          const readBuffer = await fs.readFile(canonicalPath);
          const readHash = crypto.createHash('sha256').update(readBuffer).digest('hex');
          expect(readHash).toBe(result.receipt.sha256);
          expect(readBuffer.byteLength).toBe(result.receipt.byteLength);
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('rejects duplicate writes with ACTIVATION_ALREADY_EXISTS', async () => {
      const root = await createTempRoot();
      try {
        const activation = buildValidActivation();
        const clock = () => '2026-09-01T00:00:00Z';
        const first = await writeMLBProspectiveHoldoutActivation(root, activation, clock);
        expect(first.ok).toBe(true);

        const second = await writeMLBProspectiveHoldoutActivation(root, activation, clock);
        expect(second.ok).toBe(false);
        if (!second.ok) {
          expect(second.issues.some((i) => i.code === 'ACTIVATION_ALREADY_EXISTS')).toBe(true);
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('handles concurrent same-identity writes with exactly one success', async () => {
      const root = await createTempRoot();
      try {
        const activation = buildValidActivation();
        const clock = () => '2026-09-01T00:00:00Z';
        const [first, second] = await Promise.all([
          writeMLBProspectiveHoldoutActivation(root, activation, clock),
          writeMLBProspectiveHoldoutActivation(root, activation, clock),
        ]);
        const successes = [first, second].filter((r) => r.ok).length;
        const alreadyExists = [first, second].filter(
          (r) => !r.ok && r.issues.some((i) => i.code === 'ACTIVATION_ALREADY_EXISTS'),
        ).length;
        expect(successes).toBe(1);
        expect(alreadyExists).toBe(1);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('rejects invalid activation without writing', async () => {
      const root = await createTempRoot();
      try {
        const activation = buildValidActivation({ validationTargetCount: 66 });
        const clock = () => '2026-09-01T00:00:00Z';
        const result = await writeMLBProspectiveHoldoutActivation(root, activation, clock);
        expect(result.ok).toBe(false);

        const canonicalPath = path.join(root, MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_DIRECTORY, `${MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION}.json`);
        const exists = await fs.stat(canonicalPath).then(() => true).catch(() => false);
        expect(exists).toBe(false);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('readMLBProspectiveHoldoutActivation', () => {
    it('reads back persisted activation and receipt', async () => {
      const root = await createTempRoot();
      try {
        const activation = buildValidActivation();
        const clock = () => '2026-09-01T00:00:00Z';
        const writeResult = await writeMLBProspectiveHoldoutActivation(root, activation, clock);
        expect(writeResult.ok).toBe(true);
        if (!writeResult.ok) return;

        const readResult = await readMLBProspectiveHoldoutActivation(root);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          expect(readResult.value.activationId).toBe('activation-1');
          expect(readResult.value.persistedAt).toBe('2026-09-01T00:00:00Z');
          expect(readResult.receipt.sha256).toBe(writeResult.receipt.sha256);
          expect(readResult.receipt.byteLength).toBe(writeResult.receipt.byteLength);
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('returns ACTIVATION_MISSING when no activation exists', async () => {
      const root = await createTempRoot();
      try {
        const result = await readMLBProspectiveHoldoutActivation(root);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.issues.some((i) => i.code === 'ACTIVATION_MISSING')).toBe(true);
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('activation before T-360 invariant', () => {
    it('accepts persistedAt strictly before evidence scientific cutoff', async () => {
      const root = await createTempRoot();
      try {
        const activation = buildValidActivation();
        const clock = () => '2026-09-10T06:00:00Z';
        const result = await writeMLBProspectiveHoldoutActivation(root, activation, clock);
        expect(result.ok).toBe(true);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('rejects persistedAt equal to evidence scientific cutoff', async () => {
      const root = await createTempRoot();
      try {
        const activation = buildValidActivation();
        const clock = () => '2026-09-10T06:00:00.000Z';
        const result = await writeMLBProspectiveHoldoutActivation(root, activation, clock);
        // Store does not enforce T-360 cutoff; cohort registration does.
        expect(result.ok).toBe(true);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });
});
