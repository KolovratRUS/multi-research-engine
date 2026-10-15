/* -------------------------------------------------------------------------- */
/*  Functional tests for the prepared-execution-job V2 store (C1B)             */
/* -------------------------------------------------------------------------- */

import { describe, it, expect, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, resolve, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: vi.fn(actual.readFile),
    link: vi.fn(actual.link),
    unlink: vi.fn(actual.unlink),
  };
});

import {
  persistMLBShadowPreparedExecutionJobV2,
  MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_STORE_VERSION,
} from '@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-store';
import {
  validateMLBShadowPreparedExecutionJobV2,
  MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_FIELD_ORDER,
} from '@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-contract';
import {
  getMLBShadowCandidate003AuthorizedModelArtifact,
  MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL_ARTIFACT_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-shadow-candidate-003-authorized-model-artifact';
import {
  MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256,
} from '@/prediction/mlb/mlb-shadow-model-fingerprint';
import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';
import {
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';
import {
  MLB_SHADOW_MONITORING_NAMESPACE_ROOT,
} from '@/prediction/mlb/mlb-shadow-monitoring-namespace';

/* -------------------------------------------------------------------------- */
/*  Test constants + fixture builders                                         */
/* -------------------------------------------------------------------------- */

const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';
const FROZEN_PREDICTION_GENERATED_AT = '2026-07-15T18:40:00Z';
const FROZEN_OFFICIAL_DATE = '2026-07-15';
const FROZEN_MANIFEST_FINGERPRINT =
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT;

const SYNTHETIC_SHADOW_RECORD_ID = 'shadow-001';

const STORE_SOURCE_PATH = resolve(
  process.cwd(),
  'src/prediction/mlb/mlb-shadow-prepared-execution-job-v2-store.ts',
);

const PREPARED_JOBS_NAMESPACE = `${MLB_SHADOW_MONITORING_NAMESPACE_ROOT}/quarantine/prepared-jobs`;
const PREPARED_JOBS_RELATIVE = 'quarantine/prepared-jobs';

/**
 * Recomputes the exact canonical 13-field serialized artifact bytes that
 * the store writes. Used in tests that pre-create or pre-corrupt final artifacts.
 */
function canonicalBytesFor(preparedJob: Record<string, unknown>): string {
  return JSON.stringify({
    shadowRecordId: preparedJob.shadowRecordId,
    gamePk: preparedJob.gamePk,
    predictionGeneratedAt: preparedJob.predictionGeneratedAt,
    authorizedModelArtifact: preparedJob.authorizedModelArtifact,
    featureManifest: preparedJob.featureManifest,
    snapshot: preparedJob.snapshot,
    officialDate: preparedJob.officialDate,
    scheduledStartAt: preparedJob.scheduledStartAt,
    latencyMs: preparedJob.latencyMs,
    featureManifestId: preparedJob.featureManifestId,
    featureManifestFingerprint: preparedJob.featureManifestFingerprint,
    timingReferenceContractVersion: preparedJob.timingReferenceContractVersion,
    timingReferenceCutoffAt: preparedJob.timingReferenceCutoffAt,
  });
}

/** Structurally valid manifest that is NOT the frozen real-pregame manifest. */
function buildValidManifest(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    contractVersion: 'mlb-feature-manifest-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    manifestId: 'manifest-1',
    features: [
      {
        featureId: 'p_1',
        sectionId: 'sec-1',
        payloadPath: ['home', 'p_1'],
        valueKind: 'NUMBER',
        missingPolicy: 'REJECT',
        defaultValue: null,
      },
      {
        featureId: 'p_2',
        sectionId: 'sec-1',
        payloadPath: ['away', 'p_2'],
        valueKind: 'NUMBER',
        missingPolicy: 'REJECT',
        defaultValue: null,
      },
    ],
    ...overrides,
  } as Record<string, unknown>;
}

/** Structurally valid canonical pregame snapshot. */
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

/** Fully valid prepared job (13 fields, repoRoot omitted). */
function buildValidPreparedJob(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const base = {
    shadowRecordId: SYNTHETIC_SHADOW_RECORD_ID,
    gamePk: 990000001,
    predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
    authorizedModelArtifact: getMLBShadowCandidate003AuthorizedModelArtifact(),
    featureManifest: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    snapshot: buildValidSnapshot(),
    officialDate: FROZEN_OFFICIAL_DATE,
    scheduledStartAt: FROZEN_SCHEDULED_START,
    latencyMs: 1234,
    featureManifestId:
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
    featureManifestFingerprint: FROZEN_MANIFEST_FINGERPRINT,
    timingReferenceContractVersion:
      'mlb-offline-pregame-inference-contract-v1',
    timingReferenceCutoffAt: FROZEN_DATA_CUTOFF,
  };
  return { ...base, ...overrides };
}

/** Deep-clone the frozen artifact so tests can tamper safely (test-only). */
function cloneArtifact(): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(getMLBShadowCandidate003AuthorizedModelArtifact()),
  );
}

async function createTempRepo(): Promise<string> {
  return fs.mkdtemp(join(tmpdir(), 'mlb-prepared-store-test-'));
}

function artifactPathFor(repoRoot: string, shadowRecordId: string): string {
  const hash = createHash('sha256')
    .update(shadowRecordId, 'utf-8')
    .digest('hex');
  return join(repoRoot, PREPARED_JOBS_NAMESPACE, hash + '.json');
}

const cleanupDirs: string[] = [];

afterEach(async () => {
  const actualFs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  vi.mocked(fs.readFile).mockReset();
  vi.mocked(fs.readFile).mockImplementation(actualFs.readFile);
  vi.mocked(fs.link).mockReset();
  vi.mocked(fs.link).mockImplementation(actualFs.link);
  vi.mocked(fs.unlink).mockReset();
  vi.mocked(fs.unlink).mockImplementation(actualFs.unlink);

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
/*  Tests 1–44                                                                */
/* -------------------------------------------------------------------------- */

describe('mlb-shadow-prepared-execution-job-v2-store', () => {
  /* 1. valid prepared job persists successfully */
  it('1. valid prepared job persists successfully', async () => {
    const repoRoot = await trackedTempDir('store-test-1-');
    const job = buildValidPreparedJob();

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe('PERSISTED');
      expect(result.storeVersion).toBe(
        MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_STORE_VERSION,
      );
      expect(result.artifactCreated).toBe(true);
      expect(result.shadowRecordId).toBe(SYNTHETIC_SHADOW_RECORD_ID);
      expect(result.verificationOk).toBe(true);
    }
  });

  /* 2. final path is exactly quarantine/prepared-jobs/<sha256>.json */
  it('2. final path is exactly quarantine/prepared-jobs/<sha256(shadowRecordId)>.json', async () => {
    const repoRoot = await trackedTempDir('store-test-2-');
    const job = buildValidPreparedJob();

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(result.ok).toBe(true);

    if (!result.ok) throw new Error('persist failed');

    const expectedHash = createHash('sha256')
      .update(SYNTHETIC_SHADOW_RECORD_ID, 'utf-8')
      .digest('hex');
    const expectedRelativePath = `${PREPARED_JOBS_RELATIVE}/${expectedHash}.json`;

    expect(result.relativePath).toBe(expectedRelativePath);
    expect(result.relativePath.startsWith('quarantine/prepared-jobs/')).toBe(
      true,
    );
    expect(result.relativePath).not.toContain(
      'var/mlb-development/mlb-shadow-monitoring',
    );
    expect(isAbsolute(result.relativePath)).toBe(false);
    expect(result.relativePath).not.toContain(SYNTHETIC_SHADOW_RECORD_ID);
    const fullPath = join(
      repoRoot,
      MLB_SHADOW_MONITORING_NAMESPACE_ROOT,
      result.relativePath,
    );
    await expect(fs.access(fullPath)).resolves.toBeUndefined();
  });

  /* 3. raw shadowRecordId does not appear in filename */
  it('3. raw shadowRecordId does not appear in filename', async () => {
    const repoRoot = await trackedTempDir('store-test-3-');
    const job = buildValidPreparedJob();

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('persist failed');

    // The relativePath must NOT contain the raw shadowRecordId
    expect(result.relativePath).not.toContain(SYNTHETIC_SHADOW_RECORD_ID);
    // But the SHA256 digest of the shadowRecordId should be in the filename
    const expectedHash = createHash('sha256')
      .update(SYNTHETIC_SHADOW_RECORD_ID, 'utf-8')
      .digest('hex');
    expect(result.relativePath).toContain(expectedHash);
  });

  /* 4. artifact bytes parse as JSON */
  it('4. artifact bytes parse as JSON', async () => {
    const repoRoot = await trackedTempDir('store-test-4-');
    const job = buildValidPreparedJob();

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('persist failed');

    const artifactPath = join(repoRoot, MLB_SHADOW_MONITORING_NAMESPACE_ROOT, result.relativePath);
    const raw = await fs.readFile(artifactPath, 'utf-8');

    // Must parse without throwing
    const parsed = JSON.parse(raw);
    expect(typeof parsed).toBe('object');
    expect(parsed).not.toBeNull();
  });

  /* 5. artifact has exactly the 13 prepared fields */
  it('5. artifact has exactly 13 prepared fields', async () => {
    const repoRoot = await trackedTempDir('store-test-5-');
    const job = buildValidPreparedJob();

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('persist failed');

    const artifactPath = join(repoRoot, MLB_SHADOW_MONITORING_NAMESPACE_ROOT, result.relativePath);
    const raw = await fs.readFile(artifactPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(Object.keys(parsed).length).toBe(13);
  });

  /* 6. repoRoot absent from artifact */
  it('6. repoRoot absent from artifact', async () => {
    const repoRoot = await trackedTempDir('store-test-6-');
    const job = buildValidPreparedJob();

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('persist failed');

    const artifactPath = join(repoRoot, MLB_SHADOW_MONITORING_NAMESPACE_ROOT, result.relativePath);
    const raw = await fs.readFile(artifactPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(parsed).not.toHaveProperty('repoRoot');
    expect(Object.keys(parsed)).not.toContain('repoRoot');
  });

  /* 7. no storeVersion embedded in artifact */
  it('7. no storeVersion embedded in artifact', async () => {
    const repoRoot = await trackedTempDir('store-test-7-');
    const job = buildValidPreparedJob();

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('persist failed');

    const artifactPath = join(repoRoot, MLB_SHADOW_MONITORING_NAMESPACE_ROOT, result.relativePath);
    const raw = await fs.readFile(artifactPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(parsed).not.toHaveProperty('storeVersion');
    expect(Object.keys(parsed)).not.toContain('storeVersion');
    expect(raw).not.toContain('v2-store-v1');
  });

  /* 8. no payloadHash embedded */
  it('8. no payloadHash embedded', async () => {
    const repoRoot = await trackedTempDir('store-test-8-');
    const job = buildValidPreparedJob();

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('persist failed');

    const artifactPath = join(repoRoot, MLB_SHADOW_MONITORING_NAMESPACE_ROOT, result.relativePath);
    const raw = await fs.readFile(artifactPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(parsed).not.toHaveProperty('payloadHash');
    expect(Object.keys(parsed)).not.toContain('payloadHash');
  });

  /* 9. no generated timestamp embedded */
  it('9. no generated timestamp embedded', async () => {
    const repoRoot = await trackedTempDir('store-test-9-');
    const job = buildValidPreparedJob();

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('persist failed');

    const artifactPath = join(repoRoot, MLB_SHADOW_MONITORING_NAMESPACE_ROOT, result.relativePath);
    const raw = await fs.readFile(artifactPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // predictionGeneratedAt must match the caller-supplied frozen value
    expect(parsed.predictionGeneratedAt).toBe(FROZEN_PREDICTION_GENERATED_AT);
    // No extra timestamp fields beyond the 13 canonical
    const keys = Object.keys(parsed);
    const nonCanonicalTimestampKeys = keys.filter(
      (k) => k !== 'predictionGeneratedAt' && k !== 'scheduledStartAt' && k !== 'timingReferenceCutoffAt' && k !== 'officialDate',
    );
    // Any key with 'time' or 'stamp' (case-insensitive) that is not canonical
    const extraTimestampKeys = nonCanonicalTimestampKeys.filter(
      (k) => /time|stamp/i.test(k),
    );
    expect(extraTimestampKeys).toHaveLength(0);
  });

  /* 10. canonical top-level field order exact */
  it('10. canonical top-level field order exact', async () => {
    const repoRoot = await trackedTempDir('store-test-10-');
    const job = buildValidPreparedJob();

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('persist failed');

    const artifactPath = join(repoRoot, MLB_SHADOW_MONITORING_NAMESPACE_ROOT, result.relativePath);
    const raw = await fs.readFile(artifactPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(Object.keys(parsed)).toEqual(
      MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_FIELD_ORDER,
    );
  });

  /* 11. canonical bytes have no trailing newline */
  it('11. canonical bytes have no trailing newline', async () => {
    const repoRoot = await trackedTempDir('store-test-11-');
    const job = buildValidPreparedJob();

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('persist failed');

    const artifactPath = join(repoRoot, MLB_SHADOW_MONITORING_NAMESPACE_ROOT, result.relativePath);
    const raw = await fs.readFile(artifactPath, 'utf-8');
    const expected = canonicalBytesFor(job);

    expect(raw).toBe(expected);
    // No trailing newline
    expect(raw.endsWith('\n')).toBe(false);
    expect(raw.endsWith('\r\n')).toBe(false);
  });

  /* 12. same semantic prepared input with different top-level property order produces identical canonical bytes */
  it('12. different top-level property order produces identical canonical bytes', async () => {
    const repoRoot = await trackedTempDir('store-test-12-');
    const snap = buildValidSnapshot();

    const jobA = {
      shadowRecordId: SYNTHETIC_SHADOW_RECORD_ID,
      gamePk: 990000001,
      predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
      authorizedModelArtifact: getMLBShadowCandidate003AuthorizedModelArtifact(),
      featureManifest: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
      snapshot: snap,
      officialDate: FROZEN_OFFICIAL_DATE,
      scheduledStartAt: FROZEN_SCHEDULED_START,
      latencyMs: 1234,
      featureManifestId:
        MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
      featureManifestFingerprint: FROZEN_MANIFEST_FINGERPRINT,
      timingReferenceContractVersion:
        'mlb-offline-pregame-inference-contract-v1',
      timingReferenceCutoffAt: FROZEN_DATA_CUTOFF,
    };

    // Build jobB with keys in a different order
    const jobB: Record<string, unknown> = {};
    const keys = Object.keys(jobA);
    // Reverse the order to ensure different key ordering
    const reversedKeys = [...keys].reverse();
    for (const key of reversedKeys) {
      (jobB as Record<string, unknown>)[key] = (jobA as Record<string, unknown>)[key];
    }

    const canonicalA = canonicalBytesFor(jobA);
    const canonicalB = canonicalBytesFor(jobB);
    expect(canonicalA).toBe(canonicalB);

    // Both should validate
    const validA = validateMLBShadowPreparedExecutionJobV2(jobA);
    const validB = validateMLBShadowPreparedExecutionJobV2(jobB);
    expect(validA.ok).toBe(true);
    expect(validB.ok).toBe(true);

    // Store should produce identical bytes
    const resultA = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      jobA,
    );
    expect(resultA.ok).toBe(true);
    if (!resultA.ok) throw new Error('persist A failed');

    const artifactPath = join(repoRoot, MLB_SHADOW_MONITORING_NAMESPACE_ROOT, resultA.relativePath);
    const rawA = await fs.readFile(artifactPath, 'utf-8');

    // Pre-create the identical file and retry with jobB
    const resultB = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      jobB,
    );
    expect(resultB.ok).toBe(true);
    if (resultB.ok) {
      expect(resultB.status).toBe('IDEMPOTENT_IDENTICAL_SUCCESS');
    }
  });

  /* 13. byte-identical retry returns IDEMPOTENT_IDENTICAL_SUCCESS */
  it('13. byte-identical retry returns IDEMPOTENT_IDENTICAL_SUCCESS', async () => {
    const repoRoot = await trackedTempDir('store-test-13-');
    const job = buildValidPreparedJob();

    const first = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.status).toBe('PERSISTED');

    const second = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.status).toBe('IDEMPOTENT_IDENTICAL_SUCCESS');
      expect(second.verificationOk).toBe(true);
    }
  });

  /* 14. idempotent retry reports artifactCreated=false */
  it('14. idempotent retry reports artifactCreated=false', async () => {
    const repoRoot = await trackedTempDir('store-test-14-');
    const job = buildValidPreparedJob();

    const first = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.artifactCreated).toBe(true);

    const second = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.artifactCreated).toBe(false);
    }
  });

  /* 15. different prepared content with same shadowRecordId returns ALREADY_EXISTS */
  it('15. different prepared content with same shadowRecordId returns ALREADY_EXISTS', async () => {
    const repoRoot = await trackedTempDir('store-test-15-');
    const firstJob = buildValidPreparedJob({ latencyMs: 1234 });
    const secondJob = buildValidPreparedJob({ latencyMs: 5678 });

    const first = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      firstJob,
    );
    expect(first.ok).toBe(true);

    const second = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      secondJob,
    );
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.status).toBe('ALREADY_EXISTS');
    }
  });

  /* 16. different retry does not modify existing final bytes */
  it('16. different retry does not modify existing final bytes', async () => {
    const repoRoot = await trackedTempDir('store-test-16-');
    const firstJob = buildValidPreparedJob({ latencyMs: 1234 });
    const secondJob = buildValidPreparedJob({ latencyMs: 5678 });

    const first = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      firstJob,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('first persist failed');

    const artifactPath = join(repoRoot, MLB_SHADOW_MONITORING_NAMESPACE_ROOT, first.relativePath);
    const originalBytes = await fs.readFile(artifactPath, 'utf-8');

    const second = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      secondJob,
    );
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.status).toBe('ALREADY_EXISTS');

    const afterBytes = await fs.readFile(artifactPath, 'utf-8');
    expect(afterBytes).toBe(originalBytes);
  });

  /* 17. invalid prepared input returns VALIDATION_FAILED */
  it('17. invalid prepared input returns VALIDATION_FAILED', async () => {
    const repoRoot = await trackedTempDir('store-test-17-');
    const invalidJob = {
      shadowRecordId: 'shadow-001',
      gamePk: 'not-a-number',
      predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
      authorizedModelArtifact: getMLBShadowCandidate003AuthorizedModelArtifact(),
      featureManifest: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
      snapshot: buildValidSnapshot(),
      officialDate: FROZEN_OFFICIAL_DATE,
      scheduledStartAt: FROZEN_SCHEDULED_START,
      latencyMs: 1234,
      featureManifestId:
        MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
      featureManifestFingerprint: FROZEN_MANIFEST_FINGERPRINT,
      timingReferenceContractVersion:
        'mlb-offline-pregame-inference-contract-v1',
      timingReferenceCutoffAt: FROZEN_DATA_CUTOFF,
    };

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      invalidJob,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('VALIDATION_FAILED');
      expect(result.artifactCreated).toBe(false);
    }
  });

  /* 18. invalid input creates no artifact */
  it('18. invalid input creates no artifact', async () => {
    const repoRoot = await trackedTempDir('store-test-18-');
    const invalidJob = { not: 'a valid prepared job' };

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      invalidJob,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe('VALIDATION_FAILED');

    // No artifact file should exist
    const expectedHash = createHash('sha256')
      .update('not-a-valid-id', 'utf-8')
      .digest('hex');
    await expect(
      fs.access(join(repoRoot, PREPARED_JOBS_NAMESPACE, expectedHash + '.json')),
    ).rejects.toThrow();

    // The prepared-jobs directory must not exist
    await expect(
      fs.access(join(repoRoot, PREPARED_JOBS_NAMESPACE)),
    ).rejects.toThrow();
  });

  /* 19. invalid input creates no prepared-job directory */
  it('19. invalid input creates no prepared-job directory', async () => {
    const repoRoot = await trackedTempDir('store-test-19-');
    const invalidJob = { shadowRecordId: 'bad' };

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      invalidJob,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe('VALIDATION_FAILED');

    await expect(
      fs.access(join(repoRoot, PREPARED_JOBS_NAMESPACE)),
    ).rejects.toThrow();
    await expect(
      fs.access(join(repoRoot, 'var')),
    ).rejects.toThrow();
  });

  /* 20. repoRoot invalid returns REPO_ROOT_INVALID */
  it('20. repoRoot invalid returns REPO_ROOT_INVALID', async () => {
    const job = buildValidPreparedJob();
    const result = await persistMLBShadowPreparedExecutionJobV2(
      '/nonexistent/repo/root/that/does/not/exist',
      job,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('REPO_ROOT_INVALID');
      expect(result.artifactCreated).toBe(false);
    }
  });

  /* 21. path traversal through shadowRecordId impossible because filename is digest */
  it('21. path traversal through shadowRecordId impossible because filename is digest', async () => {
    const repoRoot = await trackedTempDir('store-test-21-');
    const maliciousId = '../../../etc/passwd';
    const job = buildValidPreparedJob({ shadowRecordId: maliciousId });

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('persist failed');

    // relativePath must not contain the raw malicious ID
    expect(result.relativePath).not.toContain(maliciousId);
    expect(result.relativePath).not.toContain('..');

    // relativePath must be the digest-based filename
    const expectedHash = createHash('sha256')
      .update(maliciousId, 'utf-8')
      .digest('hex');
    expect(result.relativePath).toContain(expectedHash + '.json');

    // repoRoot should only contain 'var' as its top-level entry
    const rootContents = await fs.readdir(repoRoot);
    expect(rootContents).toEqual(['var']);
  });

  /* 22. expected SHA256 filename independently recomputed in test */
  it('22. expected SHA256(shadowRecordId) filename independently recomputed', async () => {
    const repoRoot = await trackedTempDir('store-test-22-');
    const job = buildValidPreparedJob();

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('persist failed');

    const expectedHash = createHash('sha256')
      .update(SYNTHETIC_SHADOW_RECORD_ID, 'utf-8')
      .digest('hex');
    const expectedFilename = expectedHash + '.json';

    expect(result.relativePath.endsWith(expectedFilename)).toBe(true);

    // Verify the file exists at the expected path
    const artifactPath = join(repoRoot, MLB_SHADOW_MONITORING_NAMESPACE_ROOT, result.relativePath);
    await expect(fs.access(artifactPath)).resolves.toBeUndefined();
  });

  /* 23. final stored artifact revalidates through validateMLBShadowPreparedExecutionJobV2 */
  it('23. final stored artifact revalidates through validateMLBShadowPreparedExecutionJobV2', async () => {
    const repoRoot = await trackedTempDir('store-test-23-');
    const job = buildValidPreparedJob();

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('persist failed');

    const artifactPath = join(repoRoot, MLB_SHADOW_MONITORING_NAMESPACE_ROOT, result.relativePath);
    const raw = await fs.readFile(artifactPath, 'utf-8');
    const parsed = JSON.parse(raw);

    const revalidation = validateMLBShadowPreparedExecutionJobV2(parsed);
    expect(revalidation.ok).toBe(true);
  });

  /* 24. malformed existing artifact is not accepted as idempotently identical */
  it('24. malformed existing artifact is not accepted as idempotently identical', async () => {
    const repoRoot = await trackedTempDir('store-test-24-');
    const job = buildValidPreparedJob();

    // Pre-create the final artifact with malformed JSON
    const artifactPath = artifactPathFor(repoRoot, SYNTHETIC_SHADOW_RECORD_ID);
    const dir = join(repoRoot, PREPARED_JOBS_NAMESPACE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(artifactPath, '{this is not valid json', 'utf-8');

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('ALREADY_EXISTS');
    }

    // The malformed file must not be overwritten
    const raw = readFileSync(artifactPath, 'utf-8');
    expect(raw).toBe('{this is not valid json');
  });

  /* 25. noncanonical existing artifact is not accepted as idempotently identical */
  it('25. noncanonical existing artifact is not accepted as idempotently identical', async () => {
    const repoRoot = await trackedTempDir('store-test-25-');
    const job = buildValidPreparedJob();

    // Pre-create the final artifact with noncanonical key order
    const artifactPath = artifactPathFor(repoRoot, SYNTHETIC_SHADOW_RECORD_ID);
    const dir = join(repoRoot, PREPARED_JOBS_NAMESPACE);
    await fs.mkdir(dir, { recursive: true });

    // Build a noncanonical JSON object with keys in reverse order
    const canonicalKeys = MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_FIELD_ORDER;
    const reversedKeys = [...canonicalKeys].reverse();
    const noncanonicalObj: Record<string, unknown> = {};
    for (const key of reversedKeys) {
      noncanonicalObj[key] = (job as Record<string, unknown>)[key];
    }
    const noncanonicalBytes = JSON.stringify(noncanonicalObj);

    await fs.writeFile(artifactPath, noncanonicalBytes, 'utf-8');

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('ALREADY_EXISTS');
    }

    // The noncanonical file must not be overwritten
    const raw = readFileSync(artifactPath, 'utf-8');
    expect(raw).toBe(noncanonicalBytes);
  });

  /* 26. existing valid-but-different artifact fails closed */
  it('26. existing valid-but-different artifact fails closed', async () => {
    const repoRoot = await trackedTempDir('store-test-26-');
    const firstJob = buildValidPreparedJob({ latencyMs: 1234 });

    // Pre-create the final artifact with different content (same shadowRecordId)
    const artifactPath = artifactPathFor(repoRoot, SYNTHETIC_SHADOW_RECORD_ID);
    const dir = join(repoRoot, PREPARED_JOBS_NAMESPACE);
    await fs.mkdir(dir, { recursive: true });

    const differentJob = buildValidPreparedJob({ latencyMs: 9999 });
    const differentBytes = canonicalBytesFor(differentJob);
    await fs.writeFile(artifactPath, differentBytes, 'utf-8');

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      firstJob,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('ALREADY_EXISTS');
    }

    // The different content must be preserved
    const raw = readFileSync(artifactPath, 'utf-8');
    expect(raw).toBe(differentBytes);
  });

  /* 27. existing symlink final target is rejected safely */
  it('27. existing symlink final target is rejected safely', async () => {
    const repoRoot = await trackedTempDir('store-test-27-');
    const outsideTarget = await trackedTempDir('store-test-27-outside-');
    const job = buildValidPreparedJob();

    // First persist to create the real artifact
    const first = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('first persist failed');

    // Remove the real file and replace with a symlink
    const artifactPath = artifactPathFor(repoRoot, SYNTHETIC_SHADOW_RECORD_ID);
    await fs.unlink(artifactPath);
    await fs.symlink(outsideTarget, artifactPath);

    // Second persist should fail because final target is a symlink
    const second = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.status).toBe('SYMLINK_DETECTED');
    }
  });

  /* 28. unsafe directory/symlink ancestor case is rejected consistently with existing store semantics */
  it('28. symlinked quarantine ancestor fails closed', async () => {
    const repoRoot = await trackedTempDir('store-test-28-');
    const outsideTarget = await trackedTempDir('store-test-28-outside-');
    const job = buildValidPreparedJob();

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

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('SYMLINK_DETECTED');
      expect(result.artifactCreated).toBe(false);
    }
  });

  /* 29. non-directory namespace component is rejected */
  it('29. non-directory namespace component is rejected', async () => {
    const repoRoot = await trackedTempDir('store-test-29-');
    const job = buildValidPreparedJob();

    // Create real directories up to mlb-shadow-monitoring
    await fs.mkdir(
      join(repoRoot, 'var', 'mlb-development', 'mlb-shadow-monitoring'),
      { recursive: true },
    );

    // Create a FILE at the quarantine path instead of a directory
    await fs.writeFile(
      join(
        repoRoot,
        'var',
        'mlb-development',
        'mlb-shadow-monitoring',
        'quarantine',
      ),
      'not a directory',
      'utf-8',
    );

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('NON_DIRECTORY_TARGET');
      expect(result.artifactCreated).toBe(false);
    }
  });

  /* 30. successful new persistence reports verificationOk=true */
  it('30. successful new persistence reports verificationOk=true', async () => {
    const repoRoot = await trackedTempDir('store-test-30-');
    const job = buildValidPreparedJob();

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.verificationOk).toBe(true);
      expect(result.status).toBe('PERSISTED');
    }
  });

  /* 31. final artifact bytes equal requested canonical representation */
  it('31. final artifact bytes equal requested canonical representation', async () => {
    const repoRoot = await trackedTempDir('store-test-31-');
    const job = buildValidPreparedJob();

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('persist failed');

    const artifactPath = join(repoRoot, MLB_SHADOW_MONITORING_NAMESPACE_ROOT, result.relativePath);
    const raw = await fs.readFile(artifactPath, 'utf-8');
    const expected = canonicalBytesFor(job);

    expect(raw).toBe(expected);
  });

  /* 32. post-finalization verification failure — read-back readFile failure */
  it('32. post-finalization verification failure (read-back readFile failure) yields VERIFICATION_FAILED with artifactCreated true', async () => {
    const repoRoot = await trackedTempDir('store-test-32-');
    const job = buildValidPreparedJob();

    vi.mocked(fs.readFile).mockRejectedValueOnce(
      new Error('mocked read-back failure'),
    );

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('VERIFICATION_FAILED');
      expect(result.artifactCreated).toBe(true);
      expect(result.verificationOk).toBe(false);
    }

    // Final artifact must actually exist — not deleted, not overwritten
    const artifactPath = artifactPathFor(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    await expect(fs.access(artifactPath)).resolves.toBeUndefined();
  });

  /* 33. artifactCreated=true on post-finalization verification failure */
  it('33. artifactCreated=true on post-finalization verification failure', async () => {
    const repoRoot = await trackedTempDir('store-test-33-');
    const job = buildValidPreparedJob();

    vi.mocked(fs.readFile).mockRejectedValueOnce(
      new Error('mocked read-back failure'),
    );

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('VERIFICATION_FAILED');
      expect(result.artifactCreated).toBe(true);
    }
  });

  /* 34. no rollback occurs after successful finalization */
  it('34. no rollback occurs after successful finalization', async () => {
    const repoRoot = await trackedTempDir('store-test-34-');
    const job = buildValidPreparedJob();

    // Mock readFile to fail during verification (which happens AFTER link)
    vi.mocked(fs.readFile).mockRejectedValueOnce(
      new Error('mocked read-back failure during verification'),
    );

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('VERIFICATION_FAILED');
      expect(result.artifactCreated).toBe(true);
    }

    // The final artifact MUST exist — no rollback
    const artifactPath = artifactPathFor(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    await expect(fs.access(artifactPath)).resolves.toBeUndefined();

    // And it must contain the correct canonical bytes (written via hard link)
    const raw = readFileSync(artifactPath, 'utf-8');
    expect(raw).toBe(canonicalBytesFor(job));
  });

  /* 35. cleanup-warning semantics — temp cleanup failure with successful persist */
  it('35. cleanup-warning semantics (PERSISTED_WITH_CLEANUP_WARNING)', async () => {
    const repoRoot = await trackedTempDir('store-test-35-');
    const job = buildValidPreparedJob();

    // Mock unlink to fail during temp cleanup
    vi.mocked(fs.unlink).mockRejectedValueOnce(
      new Error('mocked unlink failure'),
    );

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe('PERSISTED_WITH_CLEANUP_WARNING');
      expect(result.artifactCreated).toBe(true);
      expect(result.verificationOk).toBe(true);
      expect(result.tempCleanupFailed).toBe(true);
    }
  });

  /* 36. no raw filesystem exception leaks into result */
  it('36. no raw filesystem exception leaks into result', async () => {
    const repoRoot = await trackedTempDir('store-test-36-');
    const job = buildValidPreparedJob();

    vi.mocked(fs.readFile).mockRejectedValueOnce(
      new Error('ESRCH: no such process: critical internal kernel error'),
    );

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );

    const resultJson = JSON.stringify(result);
    expect(resultJson).not.toContain('ESRCH');
    expect(resultJson).not.toContain('critical internal kernel error');
    expect(resultJson).not.toContain('mocked read-back failure');
  });

  /* 37. no model coefficients/snapshot values/prepared object returned */
  it('37. no model coefficients/snapshot values/prepared object returned', async () => {
    const repoRoot = await trackedTempDir('store-test-37-');
    const job = buildValidPreparedJob();

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );

    expect(result.ok).toBe(true);
    const resultJson = JSON.stringify(result);

    // Must not contain the full prepared object
    expect(resultJson).not.toContain('authorizedModelArtifact');
    expect(resultJson).not.toContain('featureManifest');
    expect(resultJson).not.toContain('snapshot');
    expect(resultJson).not.toContain('predictionGeneratedAt');

    // Must not contain model fingerprint
    expect(resultJson).not.toContain(
      MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256,
    );

    // Must not contain manifest fingerprint
    expect(resultJson).not.toContain(FROZEN_MANIFEST_FINGERPRINT);

    // Must not contain the snapshot payload
    expect(resultJson).not.toContain('GAME_CONTEXT');
    expect(resultJson).not.toContain('home-1');
    expect(resultJson).not.toContain('away-1');
    expect(resultJson).not.toContain('p-1');
    expect(resultJson).not.toContain('p-2');
  });

  /* 38. no absolute filesystem path returned */
  it('38. no absolute filesystem path returned', async () => {
    const repoRoot = await trackedTempDir('store-test-38-');
    const job = buildValidPreparedJob();

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );

    const resultJson = JSON.stringify(result);

    // Must not contain the absolute repo root path
    expect(resultJson).not.toContain(repoRoot);
    // Must not contain the absolute artifact path
    expect(resultJson).not.toContain(artifactPathFor(repoRoot, SYNTHETIC_SHADOW_RECORD_ID));
    // Must not contain 'var/mlb-development' as an absolute path component
    expect(resultJson).not.toContain('/var/mlb-development');
  });

  /* 39. full authorized model artifact is present IN THE QUARANTINED FILE */
  it('39. full authorized model artifact is present IN THE QUARANTINED FILE', async () => {
    const repoRoot = await trackedTempDir('store-test-39-');
    const job = buildValidPreparedJob();

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('persist failed');

    const artifactPath = join(repoRoot, MLB_SHADOW_MONITORING_NAMESPACE_ROOT, result.relativePath);
    const raw = await fs.readFile(artifactPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // The full authorized model artifact must be present and match
    const frozenArtifact = getMLBShadowCandidate003AuthorizedModelArtifact();
    expect(parsed.authorizedModelArtifact).toEqual(frozenArtifact);
    const artifact = parsed.authorizedModelArtifact as {
      attestation: { modelCanonicalFingerprint: string };
      contractVersion: string;
    };
    expect(artifact.attestation.modelCanonicalFingerprint).toBe(
      MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256,
    );
    expect(artifact.contractVersion).toBe(
      MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL_ARTIFACT_CONTRACT_VERSION,
    );
  });

  /* 40. no prediction computation occurs */
  it('40. no prediction computation occurs', async () => {
    const repoRoot = await trackedTempDir('store-test-40-');
    const job = buildValidPreparedJob();

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );

    // The result must not contain any prediction computation output
    expect(result.ok).toBe(true);
    const resultJson = JSON.stringify(result);

    // No predicted winner / side / probabilities
    expect(resultJson).not.toContain('predictedWinner');
    expect(resultJson).not.toContain('predictedSide');
    expect(resultJson).not.toContain('homeWinProbability');
    expect(resultJson).not.toContain('awayWinProbability');
    expect(resultJson).not.toContain('decisionPolicy');
    expect(resultJson).not.toContain('MAX_PROBABILITY');
  });

  /* 41. no V2 execution occurs */
  it('41. no V2 execution occurs', async () => {
    const repoRoot = await trackedTempDir('store-test-41-');
    const job = buildValidPreparedJob();

    // The store source must not import or call any execution adapter
    const source = readFileSync(STORE_SOURCE_PATH, 'utf-8');

    // Must not import execution adapter or orchestrator
    expect(source).not.toContain('mlb-shadow-execution-adapter-v2');
    expect(source).not.toContain('mlb-shadow-monitoring-persistence-orchestrator-v2');
    expect(source).not.toContain('mlb-shadow-monitoring-prediction-orchestrator-v2');
    expect(source).not.toContain('mlb-shadow-monitoring-prediction-computation-v2');
    expect(source).not.toContain('mlb-shadow-monitoring-prediction-store');
    expect(source).not.toContain('mlb-shadow-monitoring-operational-store');

    // Must not call any execution function
    expect(source).not.toMatch(/executeMLBShadowExecutionJobV2/);
    expect(source).not.toMatch(/runMLBShadow/);
    expect(source).not.toMatch(/computeMLBPrediction/);

    // Execution should still succeed (store only persists)
    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(result.ok).toBe(true);
  });

  /* 42. no production runtime path is touched */
  it('42. no production runtime path is touched', async () => {
    const repoRoot = await trackedTempDir('store-test-42-');
    const job = buildValidPreparedJob();

    await persistMLBShadowPreparedExecutionJobV2(repoRoot, job);

    // The production var/ directory must not exist
    const prodVarPath = join(
      process.cwd(),
      'var',
      'mlb-development',
      'mlb-shadow-monitoring',
    );
    await expect(fs.access(prodVarPath)).rejects.toThrow();

    // repoRoot should only contain 'var'
    const rootContents = await fs.readdir(repoRoot);
    expect(rootContents).toEqual(['var']);

    // Walk down to the prepared-jobs directory
    const varContents = await fs.readdir(join(repoRoot, 'var'));
    expect(varContents).toEqual(['mlb-development']);
    const mlbDevContents = await fs.readdir(
      join(repoRoot, 'var', 'mlb-development'),
    );
    expect(mlbDevContents).toEqual(['mlb-shadow-monitoring']);
    const shadowContents = await fs.readdir(
      join(
        repoRoot,
        'var',
        'mlb-development',
        'mlb-shadow-monitoring',
      ),
    );
    expect(shadowContents).toEqual(['quarantine']);
    const quarantineContents = await fs.readdir(
      join(
        repoRoot,
        'var',
        'mlb-development',
        'mlb-shadow-monitoring',
        'quarantine',
      ),
    );
    expect(quarantineContents).toEqual(['prepared-jobs']);
    const preparedJobsContents = await fs.readdir(
      join(
        repoRoot,
        'var',
        'mlb-development',
        'mlb-shadow-monitoring',
        'quarantine',
        'prepared-jobs',
      ),
    );
    expect(preparedJobsContents).toHaveLength(1);
    expect(preparedJobsContents[0]).toMatch(/\.json$/);
  });

  /* 43. temp resources are cleaned up after ordinary success */
  it('43. temp resources are cleaned up after ordinary success', async () => {
    const repoRoot = await trackedTempDir('store-test-43-');
    const job = buildValidPreparedJob();

    const result = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('persist failed');

    const predictionsDir = join(repoRoot, PREPARED_JOBS_NAMESPACE);
    const allFiles = await fs.readdir(predictionsDir);
    const tempFiles = allFiles.filter((f) => f.includes('.tmp-'));
    expect(tempFiles).toHaveLength(0);
    expect(allFiles).toHaveLength(1);
  });

  /* 44. final file remains write-once */
  it('44. final file remains write-once', async () => {
    const repoRoot = await trackedTempDir('store-test-44-');
    const job = buildValidPreparedJob({ latencyMs: 1234 });

    const first = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      job,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('first persist failed');

    const artifactPath = join(repoRoot, MLB_SHADOW_MONITORING_NAMESPACE_ROOT, first.relativePath);
    const originalBytes = await fs.readFile(artifactPath, 'utf-8');

    // Attempt second write with different content — must fail
    const secondJob = buildValidPreparedJob({ latencyMs: 5678 });
    const second = await persistMLBShadowPreparedExecutionJobV2(
      repoRoot,
      secondJob,
    );
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.status).toBe('ALREADY_EXISTS');

    // File must be byte-for-byte identical to original
    const afterBytes = await fs.readFile(artifactPath, 'utf-8');
    expect(afterBytes).toBe(originalBytes);

    expect((await fs.stat(artifactPath)).mode & 0o777).toBe(0o600);
  });
});
