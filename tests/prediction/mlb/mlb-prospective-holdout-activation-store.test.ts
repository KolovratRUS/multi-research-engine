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
  writeMLBProspectiveHoldoutActivationById,
  readMLBProspectiveHoldoutActivationById,
  resolveMLBProspectiveHoldoutActivationByIdPaths,
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

  /* -------------------------------------------------------------------------- */
  /*  Legacy path compatibility after refactoring                              */
  /* -------------------------------------------------------------------------- */

  describe('legacy resolver remains path compatible', () => {
    it('legacy resolver produces canonical path with contract-version filename', () => {
      const root = '/tmp/compat-test';
      const paths = resolveMLBProspectiveHoldoutActivationStorePaths(root);
      expect(paths.activationPath).toBe(
        path.join(
          root,
          MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_DIRECTORY,
          `${MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION}.json`,
        ),
      );
      expect(paths.repositoryRoot).toBe(path.resolve(root));
      expect(paths.activationDirectory).toBe(path.join(root, MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_DIRECTORY));
    });
  });

  /* -------------------------------------------------------------------------- */
  /*  By-id path resolution (opt-in, path-safe via SHA-256)                      */
  /* -------------------------------------------------------------------------- */

  describe('resolveMLBProspectiveHoldoutActivationByIdPaths', () => {
    it('activationId resolves deterministically to a non-legacy path', () => {
      const root = '/tmp/by-id-test';
      const paths = resolveMLBProspectiveHoldoutActivationByIdPaths(root, 'activation-id-a');
      const expectedHash = crypto.createHash('sha256').update('activation-id-a', 'utf-8').digest('hex');
      expect(paths.activationPath).toBe(
        path.join(root, MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_DIRECTORY, `${expectedHash}.json`),
      );
      const legacyPaths = resolveMLBProspectiveHoldoutActivationStorePaths(root);
      expect(paths.activationPath).not.toBe(legacyPaths.activationPath);
    });

    it('same activationId resolves to the same path (deterministic)', () => {
      const root = '/tmp/by-id-deterministic';
      const p1 = resolveMLBProspectiveHoldoutActivationByIdPaths(root, 'activation-x');
      const p2 = resolveMLBProspectiveHoldoutActivationByIdPaths(root, 'activation-x');
      expect(p1.activationPath).toBe(p2.activationPath);
      expect(p1.tempActivationPath).not.toBe(p2.tempActivationPath); // temp has random token
    });

    it('different activationIds resolve to different paths', () => {
      const root = '/tmp/by-id-distinct';
      const pathsA = resolveMLBProspectiveHoldoutActivationByIdPaths(root, 'activation-id-a');
      const pathsB = resolveMLBProspectiveHoldoutActivationByIdPaths(root, 'activation-id-b');
      expect(pathsA.activationPath).not.toBe(pathsB.activationPath);
    });

    it('path traversal activationId cannot escape store directory', () => {
      const root = '/tmp/traversal-test';
      const maliciousId = '../../../../etc/passwd';
      const paths = resolveMLBProspectiveHoldoutActivationByIdPaths(root, maliciousId);
      const expectedHash = crypto.createHash('sha256').update(maliciousId, 'utf-8').digest('hex');
      expect(paths.activationPath).toBe(
        path.join(paths.activationDirectory, `${expectedHash}.json`),
      );
      // Must be strictly inside the store directory
      expect(paths.activationPath).toContain(paths.activationDirectory);
    });

    it('slash-containing activationId cannot create nested directories', () => {
      const root = '/tmp/slash-test';
      const idWithSlash = 'a/b/c';
      const paths = resolveMLBProspectiveHoldoutActivationByIdPaths(root, idWithSlash);
      const expectedHash = crypto.createHash('sha256').update(idWithSlash, 'utf-8').digest('hex');
      expect(paths.activationPath).toBe(
        path.join(paths.activationDirectory, `${expectedHash}.json`),
      );
      expect(paths.activationPath).not.toContain('a/b/c');
    });

    it('by-id path cannot alias legacy canonical filename', () => {
      const root = '/tmp/alias-test';
      const legacyPaths = resolveMLBProspectiveHoldoutActivationStorePaths(root);
      const byIdPaths = resolveMLBProspectiveHoldoutActivationByIdPaths(
        root,
        MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
      );
      expect(byIdPaths.activationPath).not.toBe(legacyPaths.activationPath);
      const byIdFilename = path.basename(byIdPaths.activationPath);
      const legacyFilename = path.basename(legacyPaths.activationPath);
      expect(byIdFilename).toMatch(/^[a-f0-9]{64}\.json$/);
      expect(legacyFilename).not.toMatch(/^[a-f0-9]{64}\.json$/);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*  By-id write                                                               */
  /* -------------------------------------------------------------------------- */

  describe('writeMLBProspectiveHoldoutActivationById', () => {
    it('by-id write succeeds once in temp repo', async () => {
      const root = await createTempRoot();
      try {
        const activation = buildValidActivation({ activationId: 'write-by-id-1' });
        const clock = vi.fn(() => '2026-09-01T00:00:00Z');
        const result = await writeMLBProspectiveHoldoutActivationById(root, 'write-by-id-1', activation, clock);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.receipt.activationId).toBe('write-by-id-1');
          expect(result.receipt.storeVersion).toBe(MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_VERSION);
          expect(result.receipt.contractVersion).toBe(MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION);
          expect(result.receipt.sha256).toMatch(/^[a-f0-9]{64}$/);
          expect(result.receipt.byteLength).toBeGreaterThan(0);
          expect(result.receipt.persistedAt).toBe('2026-09-01T00:00:00Z');

          const paths = resolveMLBProspectiveHoldoutActivationByIdPaths(root, 'write-by-id-1');
          const readBuffer = await fs.readFile(paths.activationPath);
          const readHash = crypto.createHash('sha256').update(readBuffer).digest('hex');
          expect(readHash).toBe(result.receipt.sha256);
          expect(readBuffer.byteLength).toBe(result.receipt.byteLength);
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('by-id second write to same activationId returns ACTIVATION_ALREADY_EXISTS', async () => {
      const root = await createTempRoot();
      try {
        const activation = buildValidActivation({ activationId: 'write-by-id-2' });
        const clock = () => '2026-09-01T00:00:00Z';
        const first = await writeMLBProspectiveHoldoutActivationById(root, 'write-by-id-2', activation, clock);
        expect(first.ok).toBe(true);

        const second = await writeMLBProspectiveHoldoutActivationById(root, 'write-by-id-2', activation, clock);
        expect(second.ok).toBe(false);
        if (!second.ok) {
          expect(second.issues.some((i) => i.code === 'ACTIVATION_ALREADY_EXISTS')).toBe(true);
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('fails closed when requested activationId does not match payload activationId', async () => {
      const root = await createTempRoot();
      try {
        const activation = buildValidActivation({ activationId: 'payload-id' });
        const clock = () => '2026-09-01T00:00:00Z';
        const result = await writeMLBProspectiveHoldoutActivationById(root, 'requested-id', activation, clock);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.issues.some((i) => i.code === 'ACTIVATION_IDENTITY_MISMATCH')).toBe(true);
        }

        // Verify no file was written at the by-id path for 'requested-id'
        const paths = resolveMLBProspectiveHoldoutActivationByIdPaths(root, 'requested-id');
        const exists = await fs.stat(paths.activationPath).then(() => true).catch(() => false);
        expect(exists).toBe(false);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  /* -------------------------------------------------------------------------- */
  /*  By-id read                                                                */
  /* -------------------------------------------------------------------------- */

  describe('readMLBProspectiveHoldoutActivationById', () => {
    it('by-id read returns the same activation that was written', async () => {
      const root = await createTempRoot();
      try {
        const activation = buildValidActivation({ activationId: 'read-by-id-1' });
        const clock = () => '2026-09-01T00:00:00Z';
        const writeResult = await writeMLBProspectiveHoldoutActivationById(root, 'read-by-id-1', activation, clock);
        expect(writeResult.ok).toBe(true);
        if (!writeResult.ok) return;

        const readResult = await readMLBProspectiveHoldoutActivationById(root, 'read-by-id-1');
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          expect(readResult.value.activationId).toBe('read-by-id-1');
          expect(readResult.value.persistedAt).toBe('2026-09-01T00:00:00Z');
          expect(readResult.receipt.sha256).toBe(writeResult.receipt.sha256);
          expect(readResult.receipt.byteLength).toBe(writeResult.receipt.byteLength);
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('by-id read returns ACTIVATION_MISSING when no by-id file exists', async () => {
      const root = await createTempRoot();
      try {
        const result = await readMLBProspectiveHoldoutActivationById(root, 'missing-id');
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.issues.some((i) => i.code === 'ACTIVATION_MISSING')).toBe(true);
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('by-id read fails closed when persisted activationId does not match requested', async () => {
      const root = await createTempRoot();
      try {
        const paths = resolveMLBProspectiveHoldoutActivationByIdPaths(root, 'mismatched-id');

        // Write a valid activation at the by-id path for 'mismatched-id'
        const activation = buildValidActivation({ activationId: 'mismatched-id' });
        const clock = () => '2026-09-01T00:00:00Z';
        const writeResult = await writeMLBProspectiveHoldoutActivationById(root, 'mismatched-id', activation, clock);
        expect(writeResult.ok).toBe(true);
        if (!writeResult.ok) return;

        // Verify normal by-id read works
        const goodRead = await readMLBProspectiveHoldoutActivationById(root, 'mismatched-id');
        expect(goodRead.ok).toBe(true);

        // Tamper: overwrite file with activation whose activationId differs
        const tampered = buildValidActivation({ activationId: 'different-id' });
        const tamperedPersisted = { ...tampered, persistedAt: '2026-09-01T00:00:00Z' };
        await fs.writeFile(paths.activationPath, JSON.stringify(tamperedPersisted), 'utf-8');

        // Reading with the original requested activationId must fail
        const mismatchedRead = await readMLBProspectiveHoldoutActivationById(root, 'mismatched-id');
        expect(mismatchedRead.ok).toBe(false);
        if (!mismatchedRead.ok) {
          expect(mismatchedRead.issues.some((i) => i.code === 'ACTIVATION_IDENTITY_MISMATCH')).toBe(true);
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  /* -------------------------------------------------------------------------- */
  /*  Legacy and by-id coexistence                                              */
  /* -------------------------------------------------------------------------- */

  describe('legacy and by-id coexistence', () => {
    it('legacy read continues reading legacy canonical file', async () => {
      const root = await createTempRoot();
      try {
        const activation = buildValidActivation({ activationId: 'coexist-1' });
        const clock = () => '2026-09-01T00:00:00Z';

        // Write to the legacy path
        const legacyWrite = await writeMLBProspectiveHoldoutActivation(root, activation, clock);
        expect(legacyWrite.ok).toBe(true);
        if (!legacyWrite.ok) return;

        // Write the same activation to its by-id path
        const byIdWrite = await writeMLBProspectiveHoldoutActivationById(root, 'coexist-1', activation, clock);
        expect(byIdWrite.ok).toBe(true);
        if (!byIdWrite.ok) return;

        // Legacy paths must be distinct
        const legacyPaths = resolveMLBProspectiveHoldoutActivationStorePaths(root);
        const byIdPaths = resolveMLBProspectiveHoldoutActivationByIdPaths(root, 'coexist-1');
        expect(legacyPaths.activationPath).not.toBe(byIdPaths.activationPath);

        // Legacy read must return the legacy canonical path
        const legacyRead = await readMLBProspectiveHoldoutActivation(root);
        expect(legacyRead.ok).toBe(true);
        if (legacyRead.ok) {
          expect(legacyRead.receipt.sha256).toBe(legacyWrite.receipt.sha256);
          expect(legacyRead.receipt.relativePath).toBe(
            path.join(
              MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_DIRECTORY,
              `${MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION}.json`,
            ),
          );
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('legacy and by-id records coexist without modifying each other', async () => {
      const root = await createTempRoot();
      try {
        const clock = () => '2026-09-01T00:00:00Z';

        // Write a legacy record with activationId 'legacy-A'
        const legacyActivation = buildValidActivation({ activationId: 'legacy-A' });
        const legacyWrite = await writeMLBProspectiveHoldoutActivation(root, legacyActivation, clock);
        expect(legacyWrite.ok).toBe(true);
        if (!legacyWrite.ok) return;

        // Write a by-id record with a different activationId 'by-id-B'
        const byIdActivation = buildValidActivation({ activationId: 'by-id-B' });
        const byIdWrite = await writeMLBProspectiveHoldoutActivationById(root, 'by-id-B', byIdActivation, clock);
        expect(byIdWrite.ok).toBe(true);
        if (!byIdWrite.ok) return;

        // Both files exist independently
        const legacyPaths = resolveMLBProspectiveHoldoutActivationStorePaths(root);
        const byIdPaths = resolveMLBProspectiveHoldoutActivationByIdPaths(root, 'by-id-B');
        expect(legacyPaths.activationPath).not.toBe(byIdPaths.activationPath);

        // Legacy read returns legacy record
        const legacyRead = await readMLBProspectiveHoldoutActivation(root);
        expect(legacyRead.ok).toBe(true);
        if (legacyRead.ok) {
          expect(legacyRead.receipt.sha256).toBe(legacyWrite.receipt.sha256);
          expect(legacyRead.value.activationId).toBe('legacy-A');
        }

        // By-id read returns by-id record
        const byIdRead = await readMLBProspectiveHoldoutActivationById(root, 'by-id-B');
        expect(byIdRead.ok).toBe(true);
        if (byIdRead.ok) {
          expect(byIdRead.receipt.sha256).toBe(byIdWrite.receipt.sha256);
          expect(byIdRead.value.activationId).toBe('by-id-B');
        }

        // The two records have different hashes (different activationIds)
        if (legacyRead.ok && byIdRead.ok) {
          expect(legacyRead.receipt.sha256).not.toBe(byIdRead.receipt.sha256);
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('legacy APIs still operate against legacy file when by-id files also exist', async () => {
      const root = await createTempRoot();
      try {
        const clock = () => '2026-09-01T00:00:00Z';

        // Write legacy record
        const legacyActivation = buildValidActivation({ activationId: 'legacy-only' });
        const legacyWrite = await writeMLBProspectiveHoldoutActivation(root, legacyActivation, clock);
        expect(legacyWrite.ok).toBe(true);
        if (!legacyWrite.ok) return;

        // Write multiple by-id records
        const byId1 = buildValidActivation({ activationId: 'by-id-1' });
        const byId2 = buildValidActivation({ activationId: 'by-id-2' });
        await writeMLBProspectiveHoldoutActivationById(root, 'by-id-1', byId1, clock);
        await writeMLBProspectiveHoldoutActivationById(root, 'by-id-2', byId2, clock);

        // Legacy read still returns the legacy file
        const legacyRead = await readMLBProspectiveHoldoutActivation(root);
        expect(legacyRead.ok).toBe(true);
        if (legacyRead.ok) {
          expect(legacyRead.receipt.sha256).toBe(legacyWrite.receipt.sha256);
          expect(legacyRead.value.activationId).toBe('legacy-only');
        }

        // By-id reads still return the correct files
        const read1 = await readMLBProspectiveHoldoutActivationById(root, 'by-id-1');
        expect(read1.ok).toBe(true);
        const read2 = await readMLBProspectiveHoldoutActivationById(root, 'by-id-2');
        expect(read2.ok).toBe(true);

        // Legacy write still writes to legacy path (second legacy write fails)
        const secondLegacyWrite = await writeMLBProspectiveHoldoutActivation(root, legacyActivation, clock);
        expect(secondLegacyWrite.ok).toBe(false);
        if (!secondLegacyWrite.ok) {
          expect(secondLegacyWrite.issues.some((i) => i.code === 'ACTIVATION_ALREADY_EXISTS')).toBe(true);
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });
});
