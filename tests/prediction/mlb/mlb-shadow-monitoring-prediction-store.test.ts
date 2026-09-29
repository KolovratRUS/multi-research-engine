import { describe, it, expect, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: vi.fn(actual.readFile),
  };
});

import {
  persistMLBShadowQuarantinedPrediction,
  MLB_SHADOW_MONITORING_PREDICTION_STORE_VERSION,
  type MLBShadowPredictionPersistenceResult,
} from '@/prediction/mlb/mlb-shadow-monitoring-prediction-store';
import {
  validateMLBShadowQuarantinedPredictionPayload,
} from '@/prediction/mlb/mlb-shadow-monitoring-quarantine-contract';
import {
  MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE,
} from '@/prediction/mlb/mlb-shadow-monitoring-namespace';

/* -------------------------------------------------------------------------- */
/*  Test constants + factories                                                */
/* -------------------------------------------------------------------------- */

const SYNTHETIC_SHADOW_RECORD_ID = 'synthetic-shadow-001';
const SYNTHETIC_GAME_PK = 990000001;
const VALID_TIMESTAMP = '2024-06-15T18:40:00Z';
const VALID_PAYLOAD_HASH = 'a'.repeat(64); // placeholder, will be recomputed

const STORE_SOURCE_PATH = resolve(
  process.cwd(),
  'src/prediction/mlb/mlb-shadow-monitoring-prediction-store.ts',
);

const PREDICTIONS_REL = MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE;
// var/mlb-development/mlb-shadow-monitoring/quarantine/predictions

/**
 * Recomputes the payload hash exactly as the store and prediction-computation
 * do: SHA-256 of canonical JSON of 8 fields, UTF-8, lowercase hex.
 */
function computeHash(fields: Record<string, unknown>): string {
  const canonical = JSON.stringify({
    shadowRecordId: fields.shadowRecordId,
    gamePk: fields.gamePk,
    predictedWinner: fields.predictedWinner,
    predictedSide: fields.predictedSide,
    homeWinProbability: fields.homeWinProbability,
    awayWinProbability: fields.awayWinProbability,
    decisionPolicy: fields.decisionPolicy,
    predictionGeneratedAt: fields.predictionGeneratedAt,
  });
  return createHash('sha256').update(canonical, 'utf-8').digest('hex');
}

function buildValidPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const base = {
    shadowRecordId: SYNTHETIC_SHADOW_RECORD_ID,
    gamePk: SYNTHETIC_GAME_PK,
    predictedWinner: 'HOME',
    predictedSide: 'HOME',
    homeWinProbability: 0.6,
    awayWinProbability: 0.4,
    decisionPolicy: 'MAX_PROBABILITY',
    predictionGeneratedAt: VALID_TIMESTAMP,
  };
  const merged = { ...base, ...overrides };
  const payloadHash = computeHash(merged);
  return { ...merged, payloadHash };
}

async function createTempRepo(): Promise<string> {
  return fs.mkdtemp(join(tmpdir(), 'mlb-shadow-store-test-'));
}

function artifactPathFor(repoRoot: string, shadowRecordId: string): string {
  const hash = createHash('sha256').update(shadowRecordId, 'utf-8').digest('hex');
  return join(repoRoot, PREDICTIONS_REL, hash + '.json');
}

const cleanupDirs: string[] = [];

afterEach(async () => {
  // Reset readFile mock to prevent one-time values from carrying over
  const actualFs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  vi.mocked(fs.readFile).mockReset();
  vi.mocked(fs.readFile).mockImplementation(actualFs.readFile);

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
/*  Tests 1–30                                                                */
/* -------------------------------------------------------------------------- */

describe('mlb-shadow-monitoring-prediction-store', () => {
  /* 1. valid payload persists */
  it('valid payload persists', async () => {
    const repoRoot = await trackedTempDir('store-test-1-');
    const payload = buildValidPayload();

    const result = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe('PERSISTED');
      expect(result.storeVersion).toBe(
        MLB_SHADOW_MONITORING_PREDICTION_STORE_VERSION,
      );
      expect(result.artifactCreated).toBe(true);
      expect(result.shadowRecordId).toBe(SYNTHETIC_SHADOW_RECORD_ID);
      expect(result.gamePk).toBe(SYNTHETIC_GAME_PK);
    }
  });

  /* 2. exact nine-field persisted order */
  it('persists exactly nine fields in canonical order', async () => {
    const repoRoot = await trackedTempDir('store-test-2-');
    const payload = buildValidPayload();

    const result = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);
    expect(result.ok).toBe(true);

    let relativePath: string;
    if (result.ok) {
      relativePath = result.relativePath;
    } else {
      throw new Error('persist failed');
    }

    const artifactPath = join(repoRoot, relativePath);
    const raw = await fs.readFile(artifactPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const expectedKeys = [
      'shadowRecordId',
      'gamePk',
      'predictedWinner',
      'predictedSide',
      'homeWinProbability',
      'awayWinProbability',
      'decisionPolicy',
      'predictionGeneratedAt',
      'payloadHash',
    ];

    const actualKeys = Object.keys(parsed);
    expect(actualKeys).toEqual(expectedKeys);
    expect(actualKeys.length).toBe(9);
  });

  /* 3. validator round-trip */
  it('persisted artifact passes structural validator on re-validation', async () => {
    const repoRoot = await trackedTempDir('store-test-3-');
    const payload = buildValidPayload();

    const result = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);
    expect(result.ok).toBe(true);

    let artifactPath: string;
    if (result.ok) {
      artifactPath = join(repoRoot, result.relativePath);
    } else {
      throw new Error('persist failed');
    }

    const raw = await fs.readFile(artifactPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const revalidation = validateMLBShadowQuarantinedPredictionPayload(parsed);
    expect(revalidation.ok).toBe(true);
  });

  /* 4. payloadHash read-back verification */
  it('payloadHash in persisted artifact matches recomputed hash', async () => {
    const repoRoot = await trackedTempDir('store-test-4-');
    const payload = buildValidPayload();

    const result = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);
    expect(result.ok).toBe(true);

    let artifactPath: string;
    if (result.ok) {
      artifactPath = join(repoRoot, result.relativePath);
    } else {
      throw new Error('persist failed');
    }

    const raw = await fs.readFile(artifactPath, 'utf-8');
    const parsed = JSON.parse(raw) as {
      shadowRecordId: string;
      gamePk: number;
      predictedWinner: string;
      predictedSide: string;
      homeWinProbability: number;
      awayWinProbability: number;
      decisionPolicy: string;
      predictionGeneratedAt: string;
      payloadHash: string;
    };

    const recomputed = createHash('sha256')
      .update(
        JSON.stringify({
          shadowRecordId: parsed.shadowRecordId,
          gamePk: parsed.gamePk,
          predictedWinner: parsed.predictedWinner,
          predictedSide: parsed.predictedSide,
          homeWinProbability: parsed.homeWinProbability,
          awayWinProbability: parsed.awayWinProbability,
          decisionPolicy: parsed.decisionPolicy,
          predictionGeneratedAt: parsed.predictionGeneratedAt,
        }),
        'utf-8',
      )
      .digest('hex');

    expect(parsed.payloadHash).toBe(recomputed);
  });

  /* 5. structurally valid wrong payloadHash rejected before mutation */
  it('structurally valid wrong payloadHash rejected before mutation', async () => {
    const repoRoot = await trackedTempDir('store-test-5-');
    const payload = buildValidPayload();
    const wrongPayload = {
      ...payload,
      payloadHash: 'b'.repeat(64), // structurally valid but wrong hash
    };

    const result = await persistMLBShadowQuarantinedPrediction(
      repoRoot,
      wrongPayload,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('PAYLOAD_HASH_MISMATCH');
      expect(result.artifactCreated).toBe(false);
    }

    // Zero filesystem mutation — predictions dir must not exist
    await expect(
      fs.access(join(repoRoot, PREDICTIONS_REL)),
    ).rejects.toThrow();
  });

  /* 6. malformed payload rejected before mutation */
  it('malformed payload rejected before mutation', async () => {
    const repoRoot = await trackedTempDir('store-test-6-');
    const malformedPayload = {
      shadowRecordId: 'synthetic-shadow-001',
      gamePk: 'not-a-number', // wrong type
      predictedWinner: 'HOME',
      predictedSide: 'HOME',
      homeWinProbability: 0.6,
      awayWinProbability: 0.4,
      decisionPolicy: 'MAX_PROBABILITY',
      predictionGeneratedAt: '2024-06-15T18:40:00Z',
      payloadHash: 'a'.repeat(64),
    };

    const result = await persistMLBShadowQuarantinedPrediction(
      repoRoot,
      malformedPayload,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('VALIDATION_FAILED');
      expect(result.artifactCreated).toBe(false);
    }

    // Zero filesystem mutation
    await expect(
      fs.access(join(repoRoot, PREDICTIONS_REL)),
    ).rejects.toThrow();
  });

  /* 7. unknown field rejected before mutation */
  it('unknown field rejected before mutation', async () => {
    const repoRoot = await trackedTempDir('store-test-7-');
    const payloadWithExtra = {
      ...buildValidPayload(),
      sneakField: 'malicious',
    };

    const result = await persistMLBShadowQuarantinedPrediction(
      repoRoot,
      payloadWithExtra,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('VALIDATION_FAILED');
    }

    // Zero filesystem mutation
    await expect(
      fs.access(join(repoRoot, PREDICTIONS_REL)),
    ).rejects.toThrow();
  });

  /* 8. second identical write -> already exists */
  it('second identical write yields ALREADY_EXISTS', async () => {
    const repoRoot = await trackedTempDir('store-test-8-');
    const payload = buildValidPayload();

    const first = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);
    expect(first.ok).toBe(true);

    const second = await persistMLBShadowQuarantinedPrediction(
      repoRoot,
      payload,
    );
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.status).toBe('ALREADY_EXISTS');
    }
  });

  /* 9. second different write with same shadowRecordId -> already exists */
  it('second different write with same shadowRecordId yields ALREADY_EXISTS', async () => {
    const repoRoot = await trackedTempDir('store-test-9-');
    const firstPayload = buildValidPayload({ predictedWinner: 'HOME' });
    const secondPayload = buildValidPayload({ predictedWinner: 'AWAY' });

    const first = await persistMLBShadowQuarantinedPrediction(
      repoRoot,
      firstPayload,
    );
    expect(first.ok).toBe(true);

    const second = await persistMLBShadowQuarantinedPrediction(
      repoRoot,
      secondPayload,
    );
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.status).toBe('ALREADY_EXISTS');
    }
  });

  /* 10. first final bytes unchanged (after second write attempt) */
  it('first final bytes unchanged after second write attempt', async () => {
    const repoRoot = await trackedTempDir('store-test-10-');
    const payload = buildValidPayload();

    const first = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);
    expect(first.ok).toBe(true);

    let artifactPath: string;
    if (first.ok) {
      artifactPath = join(repoRoot, first.relativePath);
    } else {
      throw new Error('first persist failed');
    }

    const originalBytes = await fs.readFile(artifactPath, 'utf-8');

    // Attempt second write (should fail with ALREADY_EXISTS)
    const second = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);
    expect(second.ok).toBe(false);

    // File must be byte-for-byte identical
    const unchangedBytes = await fs.readFile(artifactPath, 'utf-8');
    expect(unchangedBytes).toBe(originalBytes);
  });

  /* 11. filename = sha256(shadowRecordId) + .json */
  it('filename equals sha256(shadowRecordId) + .json', async () => {
    const repoRoot = await trackedTempDir('store-test-11-');
    const payload = buildValidPayload({ shadowRecordId: 'synthetic-shadow-001' });

    const result = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);
    expect(result.ok).toBe(true);

    const expectedHash = createHash('sha256')
      .update('synthetic-shadow-001', 'utf-8')
      .digest('hex');
    const expectedFilename = expectedHash + '.json';

    if (result.ok) {
      expect(result.relativePath.endsWith(expectedFilename)).toBe(true);
      const fullPath = join(repoRoot, result.relativePath);
      await expect(fs.access(fullPath)).resolves.toBeUndefined();
    }
  });

  /* 12. no prediction value in path */
  it('no prediction value or digest in persistence path', async () => {
    const repoRoot = await trackedTempDir('store-test-12-');
    const payload = buildValidPayload();

    const result = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);
    expect(result.ok).toBe(true);

    let relPath: string;
    let payloadObj: Record<string, unknown>;
    if (result.ok) {
      relPath = result.relativePath;
      payloadObj = payload;
    } else {
      throw new Error('persist failed');
    }

    // relativePath must NOT contain prediction values
    expect(relPath).not.toContain(payloadObj.predictedWinner);
    expect(relPath).not.toContain(payloadObj.predictedSide as string);
    // Must NOT contain probabilities
    expect(relPath).not.toContain(
      String(payloadObj.homeWinProbability),
    );
    expect(relPath).not.toContain(
      String(payloadObj.awayWinProbability),
    );
    // Must NOT contain decisionPolicy
    expect(relPath).not.toContain(payloadObj.decisionPolicy);
    // Must NOT contain payloadHash
    expect(relPath).not.toContain(payloadObj.payloadHash);
    // Must NOT contain model fingerprint (no such field in payload)
  });

  /* 13. result contains no prediction */
  it('persistence result contains no prediction values', async () => {
    const repoRoot = await trackedTempDir('store-test-13-');
    const payload = buildValidPayload();

    const result = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);
    expect(result.ok).toBe(true);

    const resultJson = JSON.stringify(result);

    // The result must not contain predictedWinner value
    expect(resultJson).not.toContain('HOME');
    expect(resultJson).not.toContain('AWAY');
    // Must not contain decisionPolicy value
    expect(resultJson).not.toContain('MAX_PROBABILITY');
  });

  /* 14. result contains no probabilities */
  it('persistence result contains no probability values', async () => {
    const repoRoot = await trackedTempDir('store-test-14-');
    const payload = buildValidPayload({
      homeWinProbability: 0.42,
      awayWinProbability: 0.58,
    });

    const result = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);
    expect(result.ok).toBe(true);

    const resultJson = JSON.stringify(result);

    expect(resultJson).not.toContain('0.42');
    expect(resultJson).not.toContain('0.58');
  });

  /* 15. result contains no sensitive digest */
  it('persistence result contains no payloadHash digest', async () => {
    const repoRoot = await trackedTempDir('store-test-15-');
    const payload = buildValidPayload();
    const hash = (payload as { payloadHash: string }).payloadHash;

    const result = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);
    expect(result.ok).toBe(true);

    const resultJson = JSON.stringify(result);

    // The payloadHash must not appear in the result
    expect(resultJson).not.toContain(hash);
  });

  /* 16. restrictive artifact mode where supported */
  it('persisted artifact has restrictive file mode 0600', async () => {
    const repoRoot = await trackedTempDir('store-test-16-');
    const payload = buildValidPayload();

    const result = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);
    expect(result.ok).toBe(true);

    let artifactPath: string;
    if (result.ok) {
      artifactPath = join(repoRoot, result.relativePath);
    } else {
      throw new Error('persist failed');
    }

    const stats = await fs.stat(artifactPath);
    // Owner read/write only — no group/other access
    if (process.platform !== 'win32') {
      expect(stats.mode & 0o777).toBe(0o600);
    }
  });

  /* 17. temp removed on success */
  it('temporary file removed on success', async () => {
    const repoRoot = await trackedTempDir('store-test-17-');
    const payload = buildValidPayload();

    const result = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);
    expect(result.ok).toBe(true);

    let artifactPath: string;
    if (result.ok) {
      artifactPath = join(repoRoot, result.relativePath);
    } else {
      throw new Error('persist failed');
    }

    const predictionsDir = join(repoRoot, PREDICTIONS_REL);
    const allFiles = await fs.readdir(predictionsDir);
    const tempFiles = allFiles.filter((f) => f.includes('.tmp-'));
    expect(tempFiles).toHaveLength(0);
    // Only the artifact should exist
    expect(allFiles).toHaveLength(1);
  });

  /* 18. final bytes complete */
  it('final artifact bytes are complete and canonical', async () => {
    const repoRoot = await trackedTempDir('store-test-18-');
    const payload = buildValidPayload();

    const result = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);
    expect(result.ok).toBe(true);

    let artifactPath: string;
    let hash: string;
    if (result.ok) {
      artifactPath = join(repoRoot, result.relativePath);
      hash = (payload as { payloadHash: string }).payloadHash;
    } else {
      throw new Error('persist failed');
    }

    const raw = await fs.readFile(artifactPath, 'utf-8');
    const expected = JSON.stringify({
      shadowRecordId: SYNTHETIC_SHADOW_RECORD_ID,
      gamePk: SYNTHETIC_GAME_PK,
      predictedWinner: 'HOME',
      predictedSide: 'HOME',
      homeWinProbability: 0.6,
      awayWinProbability: 0.4,
      decisionPolicy: 'MAX_PROBABILITY',
      predictionGeneratedAt: VALID_TIMESTAMP,
      payloadHash: hash,
    });

    expect(raw).toBe(expected);
  });

  /* 19. final path remains within predictions quarantine */
  it('final artifact path remains within predictions quarantine', async () => {
    const repoRoot = await trackedTempDir('store-test-19-');
    const payload = buildValidPayload();

    const result = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);
    expect(result.ok).toBe(true);

    let relativePath: string;
    if (result.ok) {
      relativePath = result.relativePath;
    } else {
      throw new Error('persist failed');
    }

    // The relativePath must start with the predictions namespace
    expect(relativePath.startsWith(PREDICTIONS_REL)).toBe(true);

    // Must not contain `..` traversal
    expect(relativePath).not.toContain('..');

    // The full path must be within the predictions dir
    const fullPath = join(repoRoot, relativePath);
    const predictionsDir = join(repoRoot, PREDICTIONS_REL);
    expect(fullPath.startsWith(predictionsDir)).toBe(true);
  });

  /* 20. slash/backslash/.. inside logical ID cannot traverse */
  it('slash/backslash/.. inside logical ID cannot traverse because only digest is used', async () => {
    const repoRoot = await trackedTempDir('store-test-20-');
    const maliciousId = '../../../etc/passwd';
    const payload = buildValidPayload({ shadowRecordId: maliciousId });

    const result = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);
    expect(result.ok).toBe(true);

    let relPath: string;
    if (result.ok) {
      relPath = result.relativePath;
    } else {
      throw new Error('persist failed');
    }

    // relativePath must not contain the raw malicious ID
    expect(relPath).not.toContain(maliciousId);
    expect(relPath).not.toContain('..');

    // relativePath must be the digest-based filename
    const expectedHash = createHash('sha256')
      .update(maliciousId, 'utf-8')
      .digest('hex');
    expect(relPath).toContain(expectedHash + '.json');

    // repoRoot must only contain 'var' — no stray files leaked
    const rootContents = await fs.readdir(repoRoot);
    expect(rootContents).toEqual(['var']);
  });

  /* 21. symlinked mlb-shadow-monitoring ancestor fails */
  it('symlinked mlb-shadow-monitoring ancestor fails closed', async () => {
    const repoRoot = await trackedTempDir('store-test-21-');
    const outsideTarget = await trackedTempDir('store-test-21-outside-');

    // Create var/mlb-development as real directories
    await fs.mkdir(join(repoRoot, 'var', 'mlb-development'), { recursive: true });

    // Replace mlb-shadow-monitoring with a symlink to outside target
    const linkPath = join(
      repoRoot,
      'var',
      'mlb-development',
      'mlb-shadow-monitoring',
    );
    await fs.symlink(outsideTarget, linkPath);

    const payload = buildValidPayload();
    const result = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('SYMLINK_DETECTED');
      expect(result.artifactCreated).toBe(false);
    }
  });

  /* 22. symlinked quarantine ancestor fails */
  it('symlinked quarantine ancestor fails closed', async () => {
    const repoRoot = await trackedTempDir('store-test-22-');
    const outsideTarget = await trackedTempDir('store-test-22-outside-');

    // Create real directories up to mlb-shadow-monitoring
    await fs.mkdir(
      join(repoRoot, 'var', 'mlb-development', 'mlb-shadow-monitoring'),
      { recursive: true },
    );

    // Replace quarantine with a symlink
    const linkPath = join(
      repoRoot,
      'var',
      'mlb-development',
      'mlb-shadow-monitoring',
      'quarantine',
    );
    await fs.symlink(outsideTarget, linkPath);

    const payload = buildValidPayload();
    const result = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('SYMLINK_DETECTED');
      expect(result.artifactCreated).toBe(false);
    }
  });

  /* 23. symlinked predictions ancestor fails */
  it('symlinked predictions ancestor fails closed', async () => {
    const repoRoot = await trackedTempDir('store-test-23-');
    const outsideTarget = await trackedTempDir('store-test-23-outside-');

    // Create real directories up to quarantine
    await fs.mkdir(
      join(
        repoRoot,
        'var',
        'mlb-development',
        'mlb-shadow-monitoring',
        'quarantine',
      ),
      { recursive: true },
    );

    // Replace predictions with a symlink
    const linkPath = join(
      repoRoot,
      'var',
      'mlb-development',
      'mlb-shadow-monitoring',
      'quarantine',
      'predictions',
    );
    await fs.symlink(outsideTarget, linkPath);

    const payload = buildValidPayload();
    const result = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('SYMLINK_DETECTED');
      expect(result.artifactCreated).toBe(false);
    }
  });

  /* 24. symlink final target fails */
  it('symlink at final artifact target fails closed', async () => {
    const repoRoot = await trackedTempDir('store-test-24-');
    const outsideTarget = await trackedTempDir('store-test-24-outside-');

    const payload = buildValidPayload();

    // First persist to create the structure and the real artifact
    const first = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);
    expect(first.ok).toBe(true);

    let artifactPath: string;
    if (first.ok) {
      artifactPath = join(repoRoot, first.relativePath);
    } else {
      throw new Error('first persist failed');
    }

    // Remove the real file and replace with a symlink
    await fs.unlink(artifactPath);
    await fs.symlink(outsideTarget, artifactPath);

    // Second persist should fail because final target is a symlink
    const second = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.status).toBe('SYMLINK_DETECTED');
    }
  });

  /* 25. directory at final target fails */
  it('directory at final artifact target fails closed', async () => {
    const repoRoot = await trackedTempDir('store-test-25-');
    const payload = buildValidPayload();

    const result = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);
    expect(result.ok).toBe(true);

    let artifactPath: string;
    if (result.ok) {
      artifactPath = join(repoRoot, result.relativePath);
    } else {
      throw new Error('persist failed');
    }

    // Remove file and create a directory at the same path
    await fs.unlink(artifactPath);
    await fs.mkdir(artifactPath);

    // Second persist should fail because final target is a directory
    const second = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.status).toBe('NON_DIRECTORY_TARGET');
    }
  });

  /* 26. two concurrent writers -> exactly one persisted, one already-exists */
  it('two concurrent writers — exactly one persisted, one ALREADY_EXISTS', async () => {
    const repoRoot = await trackedTempDir('store-test-26-');
    const payload = buildValidPayload();

    const [r1, r2] = await Promise.all([
      persistMLBShadowQuarantinedPrediction(repoRoot, payload),
      persistMLBShadowQuarantinedPrediction(repoRoot, payload),
    ]);

    const results = [r1, r2];
    const successes = results.filter((r) => r.ok);
    const failures = results.filter((r) => !r.ok);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const failure = failures[0]!;
    if (!failure.ok) {
      expect(failure.status).toBe('ALREADY_EXISTS');
    }

    // Verify the persisted file is valid
    const success = successes[0]!;
    if (success.ok) {
      const artifactPath = join(repoRoot, success.relativePath);
      const raw = await fs.readFile(artifactPath, 'utf-8');
      expect(raw).toContain('synthetic-shadow-001');
    }
  });

  /* 27. no public reader */
  it('store does not export a public reader function', async () => {
    const source = readFileSync(STORE_SOURCE_PATH, 'utf-8');

    // Extract all exported function names
    const exportFnRegex = /export\s+(?:async\s+)?function\s+(\w+)/g;
    let match: RegExpExecArray | null;
    const exportedFns: string[] = [];
    while ((match = exportFnRegex.exec(source)) !== null) {
      exportedFns.push(match[1]);
    }

    // No exported function name should contain "read" or "get"
    for (const fn of exportedFns) {
      expect(fn.toLowerCase()).not.toMatch(/read|get/);
    }

    // Also verify no exported const that looks like a reader
    const exportConstRegex = /export\s+const\s+(\w+)/g;
    while ((match = exportConstRegex.exec(source)) !== null) {
      const name = match[1];
      expect(name.toLowerCase()).not.toMatch(/read|get/);
    }
  });

  /* 28. no write outside temp repoRoot */
  it('no filesystem write occurs outside the given repoRoot', async () => {
    const repoRoot = await trackedTempDir('store-test-28-');
    const payload = buildValidPayload();

    const result = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);
    expect(result.ok).toBe(true);

    // repoRoot should only contain 'var' as its top-level entry
    const rootContents = await fs.readdir(repoRoot);
    expect(rootContents).toEqual(['var']);

    // Walk down: var/mlb-development/mlb-shadow-monitoring/quarantine/predictions
    const varContents = await fs.readdir(join(repoRoot, 'var'));
    expect(varContents).toEqual(['mlb-development']);

    const mlbDevContents = await fs.readdir(
      join(repoRoot, 'var', 'mlb-development'),
    );
    expect(mlbDevContents).toEqual(['mlb-shadow-monitoring']);

    const shadowContents = await fs.readdir(
      join(repoRoot, 'var', 'mlb-development', 'mlb-shadow-monitoring'),
    );
    expect(shadowContents).toEqual(['quarantine']);

    const quarantineContents = await fs.readdir(
      join(repoRoot, 'var', 'mlb-development', 'mlb-shadow-monitoring', 'quarantine'),
    );
    expect(quarantineContents).toEqual(['predictions']);

    const predictionsContents = await fs.readdir(
      join(
        repoRoot,
        'var',
        'mlb-development',
        'mlb-shadow-monitoring',
        'quarantine',
        'predictions',
      ),
    );
    expect(predictionsContents).toHaveLength(1);
    expect(predictionsContents[0]).toMatch(/\.json$/);
  });

  /* 29. production shadow namespace remains absent */
  it('production shadow namespace remains absent after test writes', async () => {
    const repoRoot = await trackedTempDir('store-test-29-');
    const payload = buildValidPayload();

    await persistMLBShadowQuarantinedPrediction(repoRoot, payload);

    // The production var/ directory in the project root must not exist
    const prodPath = join(
      process.cwd(),
      'var',
      'mlb-development',
      'mlb-shadow-monitoring',
    );
    await expect(fs.access(prodPath)).rejects.toThrow();
  });

  /* 30. no Date.now / Math.random dependency in store source */
  it('store source has no Date.now or Math.random dependency', () => {
    const source = readFileSync(STORE_SOURCE_PATH, 'utf-8');

    expect(source).not.toMatch(/Date\.now\s*\(/);
    expect(source).not.toMatch(/Math\.random\s*\(/);

    // Verify crypto randomness is used instead (randomUUID from node:crypto)
    expect(source).toMatch(/randomUUID/);
  });

  /* 31. post-link read-back failure -> VERIFICATION_FAILED, artifactCreated: true */
  it('post-link read-back readFile failure yields VERIFICATION_FAILED with artifactCreated true', async () => {
    const repoRoot = await trackedTempDir('store-test-31-');
    const payload = buildValidPayload();

    vi.mocked(fs.readFile).mockRejectedValueOnce(
      new Error('mocked read-back failure'),
    );

    const result = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);

    // Truthful post-finalization failure representation
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('VERIFICATION_FAILED');
      if (result.status === 'VERIFICATION_FAILED') {
        expect(result.artifactCreated).toBe(true);
        expect(result.verificationOk).toBe(false);
        expect(result.tempCleanupFailed).toBe(false);
      }
      expect(result.shadowRecordId).toBe(SYNTHETIC_SHADOW_RECORD_ID);
      expect(result.gamePk).toBe(SYNTHETIC_GAME_PK);
      expect(result.relativePath).toMatch(/\.json$/);
    }

    // Final artifact must actually exist — not deleted, not overwritten
    const artifactPath = artifactPathFor(repoRoot, SYNTHETIC_SHADOW_RECORD_ID);
    await expect(fs.access(artifactPath)).resolves.toBeUndefined();

    // Result must not contain prediction values, probabilities, or digests
    const resultJson = JSON.stringify(result);
    expect(resultJson).not.toContain('HOME');
    expect(resultJson).not.toContain('AWAY');
    expect(resultJson).not.toContain(String(0.6));
    expect(resultJson).not.toContain(String(0.4));
    expect(resultJson).not.toContain('MAX_PROBABILITY');
  });

  /* 32. post-link read-back byte mismatch -> VERIFICATION_FAILED, artifactCreated: true */
  it('post-link read-back byte mismatch yields VERIFICATION_FAILED with artifactCreated true', async () => {
    const repoRoot = await trackedTempDir('store-test-32-');
    const payload = buildValidPayload();

    vi.mocked(fs.readFile).mockResolvedValueOnce('mismatched-canonical-bytes');

    const result = await persistMLBShadowQuarantinedPrediction(repoRoot, payload);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('VERIFICATION_FAILED');
      expect(result.artifactCreated).toBe(true);
      expect(result.verificationOk).toBe(false);
    }

    // Final artifact must actually exist — not deleted
    const artifactPath = artifactPathFor(repoRoot, SYNTHETIC_SHADOW_RECORD_ID);
    await expect(fs.access(artifactPath)).resolves.toBeUndefined();

    // Result must not contain prediction values
    const resultJson = JSON.stringify(result);
    expect(resultJson).not.toContain('HOME');
    expect(resultJson).not.toContain('MAX_PROBABILITY');
  });
});
