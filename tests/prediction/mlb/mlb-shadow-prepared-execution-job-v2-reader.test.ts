/* -------------------------------------------------------------------------- */
/*  Functional tests for the prepared-execution-job V2 reader (P5F-C2A-R1)     */
/*  Reader-only: exactly one authorized handoff importer (P5F-C2B-R1).          */
/* -------------------------------------------------------------------------- */
import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

import {
  persistMLBShadowPreparedExecutionJobV2,
} from '@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-store';
import {
  validateMLBShadowPreparedExecutionJobV2,
  MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_FIELD_ORDER,
} from '@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-contract';
import {
  readMLBShadowPreparedExecutionJobV2,
  MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_READER_VERSION,
} from '@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-reader';
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
import { MLB_SHADOW_MONITORING_NAMESPACE_ROOT } from '@/prediction/mlb/mlb-shadow-monitoring-namespace';

/* -------------------------------------------------------------------------- */
/*  Test constants + fixture builders (mirror the sealed store test fixtures)  */
/* -------------------------------------------------------------------------- */

const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';
const FROZEN_PREDICTION_GENERATED_AT = '2026-07-15T18:40:00Z';
const FROZEN_OFFICIAL_DATE = '2026-07-15';
const FROZEN_MANIFEST_FINGERPRINT =
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT;

const SYNTHETIC_SHADOW_RECORD_ID = 'shadow-001';

const READER_SOURCE_PATH = join(
  process.cwd(),
  'src/prediction/mlb/mlb-shadow-prepared-execution-job-v2-reader.ts',
);

const PREPARED_JOBS_RELATIVE = 'quarantine/prepared-jobs';

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
    featureManifestId: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
    featureManifestFingerprint: FROZEN_MANIFEST_FINGERPRINT,
    timingReferenceContractVersion: 'mlb-offline-pregame-inference-contract-v1',
    timingReferenceCutoffAt: FROZEN_DATA_CUTOFF,
  };
  return { ...base, ...overrides };
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex');
}

function preparedJobsDirFor(repoRoot: string): string {
  return join(repoRoot, MLB_SHADOW_MONITORING_NAMESPACE_ROOT, PREPARED_JOBS_RELATIVE);
}

function artifactPathFor(repoRoot: string, shadowRecordId: string): string {
  return join(preparedJobsDirFor(repoRoot), sha256Hex(shadowRecordId) + '.json');
}

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

async function ensurePreparedDir(repoRoot: string): Promise<void> {
  await fs.mkdir(preparedJobsDirFor(repoRoot), { recursive: true });
}

async function persistValid(
  repoRoot: string,
  job: Record<string, unknown> = buildValidPreparedJob(),
): Promise<void> {
  const result = await persistMLBShadowPreparedExecutionJobV2(repoRoot, job);
  if (!result.ok) {
    throw new Error(`persist failed: ${JSON.stringify(result)}`);
  }
}

async function writeArtifactBytes(
  repoRoot: string,
  shadowRecordId: string,
  bytes: Buffer,
): Promise<string> {
  await ensurePreparedDir(repoRoot);
  const path = artifactPathFor(repoRoot, shadowRecordId);
  await fs.writeFile(path, bytes);
  return path;
}

/** Recursively collect all file + directory paths (relative), sorted. */
async function collectTree(root: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(dir: string, relBase: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      const rel = relBase ? join(relBase, entry.name) : entry.name;
      results.push(rel);
      if (entry.isDirectory()) {
        await walk(full, rel);
      }
    }
  }
  await walk(root, '');
  return results.sort();
}

/** Recursively list .ts files (excludes .d.ts). */
async function walkTsFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkTsFiles(full)));
    } else if (
      full.endsWith('.ts') &&
      !full.endsWith('.d.ts') &&
      // skip node_modules
      !full.includes('node_modules')
    ) {
      files.push(full);
    }
  }
  return files;
}

function extractImportSources(content: string): string[] {
  const sources: string[] = [];
  const re = /import\s+(?:type\s+)?[^'"]+\s+from\s+['"]([^'"]+)['"]/g;
  const se = /import\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    sources.push(m[1]);
  }
  while ((m = se.exec(content)) !== null) {
    sources.push(m[1]);
  }
  return sources;
}

function assertFailureSurface(
  result: unknown,
  expectedStatus: string,
): void {
  expect(result).not.toBeNull();
  const r = (result ?? {}) as Record<string, unknown>;
  expect(Object.keys(r).sort()).toEqual(['ok', 'readerVersion', 'status']);
  expect(r.ok).toBe(false);
  expect(r.status).toBe(expectedStatus);
  expect(r.readerVersion).toBe(
    MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_READER_VERSION,
  );
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('mlb-shadow-prepared-execution-job-v2-reader', () => {
  /* compatibility: store persists, reader reads (TEST-ONLY store import) */
  it('1. valid sealed-store artifact -> READ_OK (compatibility)', async () => {
    const repoRoot = await trackedTempDir('reader-compat-');
    const job = buildValidPreparedJob();
    await persistValid(repoRoot, job);

    const result = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe('READ_OK');
      expect(result.readerVersion).toBe(
        MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_READER_VERSION,
      );
    }
  });

  it('2. full 13-field value returned in FIELD_ORDER', async () => {
    const repoRoot = await trackedTempDir('reader-13field-');
    await persistValid(repoRoot, buildValidPreparedJob());

    const result = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value)).toEqual(
        MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_FIELD_ORDER,
      );
      expect(Object.keys(result.value).length).toBe(13);
      expect(result.value).not.toHaveProperty('repoRoot');
    }
  });

  it('3. authorizedModelArtifact preserved', async () => {
    const repoRoot = await trackedTempDir('reader-artifact-');
    await persistValid(repoRoot, buildValidPreparedJob());

    const result = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.authorizedModelArtifact).toEqual(
        getMLBShadowCandidate003AuthorizedModelArtifact(),
      );
      expect(result.value.authorizedModelArtifact.contractVersion).toBe(
        MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL_ARTIFACT_CONTRACT_VERSION,
      );
      expect(
        result.value.authorizedModelArtifact.attestation
          .modelCanonicalFingerprint,
      ).toBe(MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256);
    }
  });

  it('4. manifest / snapshot / timing preserved', async () => {
    const repoRoot = await trackedTempDir('reader-manifest-');
    await persistValid(repoRoot, buildValidPreparedJob());

    const result = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.featureManifest).toEqual(
        MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
      );
      expect(result.value.featureManifest.manifestId).toBe(
        MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
      );
      expect(result.value.featureManifestFingerprint).toBe(
        FROZEN_MANIFEST_FINGERPRINT,
      );
      expect(result.value.snapshot).toEqual(buildValidSnapshot());
      expect(result.value.snapshot.contractVersion).toBe(
        MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
      );
      expect(result.value.snapshot.snapshotId).toBe('snapshot-1');
      expect(result.value.snapshot.capturedAt).toBe(FROZEN_CAPTURED_AT);
      // timing fields
      expect(result.value.gamePk).toBe(990000001);
      expect(result.value.predictionGeneratedAt).toBe(FROZEN_PREDICTION_GENERATED_AT);
      expect(result.value.officialDate).toBe(FROZEN_OFFICIAL_DATE);
      expect(result.value.scheduledStartAt).toBe(FROZEN_SCHEDULED_START);
      expect(result.value.latencyMs).toBe(1234);
      expect(result.value.featureManifestId).toBe(
        MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
      );
      expect(result.value.timingReferenceContractVersion).toBe(
        'mlb-offline-pregame-inference-contract-v1',
      );
      expect(result.value.timingReferenceCutoffAt).toBe(FROZEN_DATA_CUTOFF);
    }
  });

  /* input validation (no filesystem access for invalid inputs) */
  it('5. invalid repoRoot -> REPO_ROOT_INVALID', async () => {
    expect(
      (
        await readMLBShadowPreparedExecutionJobV2('relative/path', SYNTHETIC_SHADOW_RECORD_ID)
      ).status,
    ).toBe('REPO_ROOT_INVALID');
    expect(
      (await readMLBShadowPreparedExecutionJobV2('', SYNTHETIC_SHADOW_RECORD_ID)).status,
    ).toBe('REPO_ROOT_INVALID');
    expect(
      (
        await readMLBShadowPreparedExecutionJobV2(
          undefined as unknown as string,
          SYNTHETIC_SHADOW_RECORD_ID,
        )
      ).status,
    ).toBe('REPO_ROOT_INVALID');
    expect(
      (
        await readMLBShadowPreparedExecutionJobV2(123 as unknown as string, SYNTHETIC_SHADOW_RECORD_ID)
      ).status,
    ).toBe('REPO_ROOT_INVALID');
  });

  it('6. invalid shadowRecordId variants -> SHADOW_RECORD_ID_INVALID', async () => {
    const repoRoot = await trackedTempDir('reader-badid-');
    const badIds: string[] = ['', '   ', 'a\tb', 'a\nb', 'ab\x00cd', 'tab\there'];
    for (const id of badIds) {
      const result = await readMLBShadowPreparedExecutionJobV2(repoRoot, id);
      expect(result.ok).toBe(false);
      expect(result.status).toBe('SHADOW_RECORD_ID_INVALID');
    }
    const result = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      undefined as unknown as string,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('SHADOW_RECORD_ID_INVALID');
  });

  it('6b. shadowRecordId validated before filesystem access', async () => {
    const result = await readMLBShadowPreparedExecutionJobV2(
      '/nonexistent/repo/root-' + sha256Hex('does-not-matter').slice(0, 12),
      '  ',
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('SHADOW_RECORD_ID_INVALID');
  });

  /* path identity */
  it('7. artifact filename is SHA-256(shadowRecordId).json', async () => {
    const repoRoot = await trackedTempDir('reader-hashname-');
    await persistValid(repoRoot, buildValidPreparedJob());

    const expectedPath = artifactPathFor(repoRoot, SYNTHETIC_SHADOW_RECORD_ID);
    expect(existsSync(expectedPath)).toBe(true);
    const basename = expectedPath.split(/[/\\]/).pop();
    expect(basename).toBe(sha256Hex(SYNTHETIC_SHADOW_RECORD_ID) + '.json');
  });

  it('8. raw shadowRecordId absent from artifact path', async () => {
    const repoRoot = await trackedTempDir('reader-rawid-');
    await persistValid(repoRoot, buildValidPreparedJob());

    const path = artifactPathFor(repoRoot, SYNTHETIC_SHADOW_RECORD_ID);
    expect(path).not.toContain(SYNTHETIC_SHADOW_RECORD_ID);
    expect(path).toContain(sha256Hex(SYNTHETIC_SHADOW_RECORD_ID));
  });

  it('9. traversal text cannot alter path', async () => {
    const repoRoot = await trackedTempDir('reader-traversal-');
    const traversalId = 'escape/../../etc/passwd';
    const job = buildValidPreparedJob({ shadowRecordId: traversalId });
    await persistValid(repoRoot, job);

    const path = artifactPathFor(repoRoot, traversalId);
    const basename = path.split(/[/\\]/).pop() as string;
    expect(basename).toBe(sha256Hex(traversalId) + '.json');
    expect(basename).not.toContain('/');
    expect(basename).not.toContain('..');
    expect(path).not.toContain(traversalId);

    const result = await readMLBShadowPreparedExecutionJobV2(repoRoot, traversalId);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe('READ_OK');
      expect(result.value.shadowRecordId).toBe(traversalId);
    }
  });

  /* filesystem safety */
  it('10. missing namespace -> NOT_FOUND', async () => {
    const repoRoot = await trackedTempDir('reader-missns-');
    const result = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('NOT_FOUND');
  });

  it('11. missing artifact (namespace exists) -> NOT_FOUND', async () => {
    const repoRoot = await trackedTempDir('reader-missart-');
    await ensurePreparedDir(repoRoot);
    const result = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('NOT_FOUND');
  });

  it('12. final symlink -> SYMLINK_DETECTED', async () => {
    const repoRoot = await trackedTempDir('reader-finalln-');
    await persistValid(repoRoot, buildValidPreparedJob());
    const artifact = artifactPathFor(repoRoot, SYNTHETIC_SHADOW_RECORD_ID);
    const target = join(repoRoot, 'target-file.txt');
    await fs.writeFile(target, Buffer.from('x'));
    await fs.rm(artifact);
    await fs.symlink(target, artifact, 'file');

    const result = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('SYMLINK_DETECTED');
  });

  it('13. ancestor symlink -> SYMLINK_DETECTED', async () => {
    const repoRoot = await trackedTempDir('reader-ancestorsym-');
    const target = await trackedTempDir('reader-anctarget-');
    // repoRoot/var is a symlink to an external target dir.
    await fs.symlink(join(target, 'var'), join(repoRoot, 'var'), 'dir');

    const result = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('SYMLINK_DETECTED');

    // cleanup the target symlink source
    await fs.rm(join(repoRoot, 'var'), { force: true });
  });

  it('14. repoRoot symlink -> SYMLINK_DETECTED', async () => {
    const realDir = await trackedTempDir('reader-realroot-');
    await persistValid(realDir, buildValidPreparedJob());

    const linkRoot = join(tmpdir(), 'reader-rootlink-' + sha256Hex(realDir).slice(0, 8));
    cleanupDirs.push(linkRoot);
    await fs.symlink(realDir, linkRoot, 'dir');

    const result = await readMLBShadowPreparedExecutionJobV2(
      linkRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('SYMLINK_DETECTED');
  });

  it('15. non-directory ancestor -> NON_DIRECTORY_TARGET', async () => {
    const repoRoot = await trackedTempDir('reader-nondir-');
    // `var` is a regular file where a directory is expected.
    await fs.writeFile(join(repoRoot, 'var'), 'blocker');
    const result = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('NON_DIRECTORY_TARGET');
  });

  it('16. directory final target -> NON_DIRECTORY_TARGET', async () => {
    const repoRoot = await trackedTempDir('reader-dirdir-');
    await ensurePreparedDir(repoRoot);
    await fs.mkdir(artifactPathFor(repoRoot, SYNTHETIC_SHADOW_RECORD_ID), {
      recursive: true,
    });
    const result = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('NON_DIRECTORY_TARGET');
  });

  /* payload integrity */
  it('17. malformed UTF-8 -> MALFORMED_UTF8', async () => {
    const repoRoot = await trackedTempDir('reader-badutf-');
    await writeArtifactBytes(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
      Buffer.from([0xff, 0xfe, 0xfd, 0xfc]),
    );
    const result = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('MALFORMED_UTF8');
  });

  it('18. malformed JSON -> MALFORMED_JSON', async () => {
    const repoRoot = await trackedTempDir('reader-badjson-');
    await writeArtifactBytes(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
      Buffer.from('not json {{{', 'utf8'),
    );
    const result = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('MALFORMED_JSON');
  });

  it('19. contract-invalid JSON -> PREPARED_CONTRACT_VALIDATION_FAILED', async () => {
    const repoRoot = await trackedTempDir('reader-badcontract-');
    await writeArtifactBytes(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
      Buffer.from('{}', 'utf8'),
    );
    const result = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('PREPARED_CONTRACT_VALIDATION_FAILED');
  });

  it('20. pretty-print rejected -> NONCANONICAL_BYTES', async () => {
    const repoRoot = await trackedTempDir('reader-pretty-');
    await persistValid(repoRoot, buildValidPreparedJob());
    const artifact = artifactPathFor(repoRoot, SYNTHETIC_SHADOW_RECORD_ID);
    const original = readFileSync(artifact);
    const pretty = Buffer.from(
      JSON.stringify(JSON.parse(original.toString('utf8')), null, 2),
      'utf8',
    );
    await fs.writeFile(artifact, pretty);
    const result = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('NONCANONICAL_BYTES');
  });

  it('21. trailing newline rejected -> NONCANONICAL_BYTES', async () => {
    const repoRoot = await trackedTempDir('reader-newline-');
    await persistValid(repoRoot, buildValidPreparedJob());
    const artifact = artifactPathFor(repoRoot, SYNTHETIC_SHADOW_RECORD_ID);
    const original = readFileSync(artifact);
    await fs.writeFile(artifact, Buffer.concat([original, Buffer.from('\n', 'utf8')]));
    const result = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('NONCANONICAL_BYTES');
  });

  it('22. reordered keys rejected -> NONCANONICAL_BYTES', async () => {
    const repoRoot = await trackedTempDir('reader-reorder-');
    const job = buildValidPreparedJob();
    const reordered = Buffer.from(
      JSON.stringify({
        latencyMs: job.latencyMs,
        snapshot: job.snapshot,
        scheduledStartAt: job.scheduledStartAt,
        authorizedModelArtifact: job.authorizedModelArtifact,
        timingReferenceCutoffAt: job.timingReferenceCutoffAt,
        featureManifest: job.featureManifest,
        timingReferenceContractVersion: job.timingReferenceContractVersion,
        gamePk: job.gamePk,
        officialDate: job.officialDate,
        featureManifestId: job.featureManifestId,
        predictionGeneratedAt: job.predictionGeneratedAt,
        shadowRecordId: job.shadowRecordId,
        featureManifestFingerprint: job.featureManifestFingerprint,
      }),
      'utf8',
    );
    await writeArtifactBytes(repoRoot, SYNTHETIC_SHADOW_RECORD_ID, reordered);
    const result = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe('NONCANONICAL_BYTES');
  });

  it('23. direct shadowRecordId mismatch -> SHADOW_RECORD_ID_MISMATCH', async () => {
    const repoRoot = await trackedTempDir('reader-mismatch-');
    const jobA = buildValidPreparedJob({ shadowRecordId: 'shadow-A' });
    await persistValid(repoRoot, jobA);
    const bytesA = readFileSync(artifactPathFor(repoRoot, 'shadow-A'));
    // Place the shadow-A content at the hash('shadow-B') path.
    await writeArtifactBytes(repoRoot, 'shadow-B', Buffer.from(bytesA));

    const result = await readMLBShadowPreparedExecutionJobV2(repoRoot, 'shadow-B');
    expect(result.ok).toBe(false);
    expect(result.status).toBe('SHADOW_RECORD_ID_MISMATCH');
  });

  it('24. exact accepted Buffer equality; 1-byte perturbation rejected', async () => {
    const repoRoot = await trackedTempDir('reader-exactbytes-');
    await persistValid(repoRoot, buildValidPreparedJob());
    const artifact = artifactPathFor(repoRoot, SYNTHETIC_SHADOW_RECORD_ID);

    // Exact canonical bytes -> accepted.
    const okResult = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(okResult.ok).toBe(true);
    if (okResult.ok) expect(okResult.status).toBe('READ_OK');

    // A single trailing byte breaks exact canonical equality.
    const canonical = readFileSync(artifact);
    await fs.writeFile(artifact, Buffer.concat([canonical, Buffer.from(' ', 'utf8')]));
    const badResult = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(badResult.ok).toBe(false);
    expect(badResult.status).toBe('NONCANONICAL_BYTES');
  });

  /* result surface / leakage */
  it('25. failure result has exactly the 3-field surface (all statuses)', async () => {
    const repoRoot = await trackedTempDir('reader-surface-');

    // NOT_FOUND
    assertFailureSurface(
      await readMLBShadowPreparedExecutionJobV2(repoRoot, 'any-id'),
      'NOT_FOUND',
    );
    // SHADOW_RECORD_ID_INVALID
    assertFailureSurface(
      await readMLBShadowPreparedExecutionJobV2(repoRoot, ''),
      'SHADOW_RECORD_ID_INVALID',
    );
    // REPO_ROOT_INVALID
    assertFailureSurface(
      await readMLBShadowPreparedExecutionJobV2('relative', 'x'),
      'REPO_ROOT_INVALID',
    );
    // MALFORMED_JSON
    await writeArtifactBytes(
      repoRoot,
      'malformed-json-id',
      Buffer.from('{bad', 'utf8'),
    );
    assertFailureSurface(
      await readMLBShadowPreparedExecutionJobV2(repoRoot, 'malformed-json-id'),
      'MALFORMED_JSON',
    );
    // PREPARED_CONTRACT_VALIDATION_FAILED
    await writeArtifactBytes(repoRoot, 'bad-contract-id', Buffer.from('{}', 'utf8'));
    assertFailureSurface(
      await readMLBShadowPreparedExecutionJobV2(repoRoot, 'bad-contract-id'),
      'PREPARED_CONTRACT_VALIDATION_FAILED',
    );
    // NONCANONICAL_BYTES — a contract-valid job canonicalized by the store,
    // then made noncanonical with one trailing ASCII SPACE. This passes
    // UTF-8 decode + JSON.parse + contract validation + shadowRecordId
    // identity, but fails exact Buffer canonical equality.
    await persistValid(
      repoRoot,
      buildValidPreparedJob({ shadowRecordId: 'noncanon-id' }),
    );
    const noncanonArtifact = artifactPathFor(repoRoot, 'noncanon-id');
    const noncanonCanonical = readFileSync(noncanonArtifact);
    await writeArtifactBytes(
      repoRoot,
      'noncanon-id',
      Buffer.concat([noncanonCanonical, Buffer.from(' ', 'utf8')]),
    );
    assertFailureSurface(
      await readMLBShadowPreparedExecutionJobV2(repoRoot, 'noncanon-id'),
      'NONCANONICAL_BYTES',
    );
  });

  it('26. failure result leaks no identity/path/payload/error', async () => {
    const repoRoot = await trackedTempDir('reader-leak-');
    const r = await readMLBShadowPreparedExecutionJobV2(repoRoot, 'secret-id-999');
    expect(r.ok).toBe(false);
    expect(r.status).toBe('NOT_FOUND');
    const serialized = JSON.stringify(r);
    expect(serialized).not.toContain('secret-id-999');
    expect(serialized).not.toContain(repoRoot);
    expect(serialized).not.toContain('shadowRecordId');
    expect(serialized).not.toContain('repoRoot');
    expect(Object.keys(r as Record<string, unknown>)).toEqual([
      'ok',
      'readerVersion',
      'status',
    ]);
  });

  /* artifact immutability + determinism + no writes */
  it('27. artifact unchanged after read', async () => {
    const repoRoot = await trackedTempDir('reader-unchanged-');
    await persistValid(repoRoot, buildValidPreparedJob());
    const artifact = artifactPathFor(repoRoot, SYNTHETIC_SHADOW_RECORD_ID);
    const before = createHash('sha256').update(readFileSync(artifact)).digest('hex');
    await readMLBShadowPreparedExecutionJobV2(repoRoot, SYNTHETIC_SHADOW_RECORD_ID);
    const after = createHash('sha256').update(readFileSync(artifact)).digest('hex');
    expect(after).toBe(before);
  });

  it('28. repeated reads are deterministic', async () => {
    const repoRoot = await trackedTempDir('reader-repeat-');
    await persistValid(repoRoot, buildValidPreparedJob());
    const r1 = await readMLBShadowPreparedExecutionJobV2(repoRoot, SYNTHETIC_SHADOW_RECORD_ID);
    const r2 = await readMLBShadowPreparedExecutionJobV2(repoRoot, SYNTHETIC_SHADOW_RECORD_ID);
    expect(r1).toEqual(r2);
  });

  it('29. reader creates no filesystem writes/directories', async () => {
    const repoRoot = await trackedTempDir('reader-nowrites-');
    await persistValid(repoRoot, buildValidPreparedJob());
    const artifact = artifactPathFor(repoRoot, SYNTHETIC_SHADOW_RECORD_ID);
    const before = await collectTree(repoRoot);
    const diskBefore = createHash('sha256').update(readFileSync(artifact)).digest('hex');
    await readMLBShadowPreparedExecutionJobV2(repoRoot, SYNTHETIC_SHADOW_RECORD_ID);
    const after = await collectTree(repoRoot);
    const diskAfter = createHash('sha256').update(readFileSync(artifact)).digest('hex');
    expect(after).toEqual(before);
    expect(diskAfter).toBe(diskBefore);
  });

  /* production isolation (source-level, test-only scan) */
  it('30. reader source does NOT import the V2 execution adapter', () => {
    const source = readFileSync(READER_SOURCE_PATH, 'utf8');
    expect(source).not.toContain('mlb-shadow-execution-adapter-v2');
  });

  it('31. reader source contains no prediction/execution call-outs', () => {
    const source = readFileSync(READER_SOURCE_PATH, 'utf8');
    expect(source).not.toMatch(/executeMLBShadowExecutionJobV2\s*\(/);
    expect(source).not.toMatch(/computeMLBShadowPrediction\s*\(/);
    expect(source).not.toMatch(/runMLBShadowExecutionJobV2\s*\(/);
    expect(source).not.toMatch(/fitMLBShadow\s*\(/);
  });

  it('32. exactly one authorized production importer of the reader under src/', async () => {
    const srcRoot = join(process.cwd(), 'src');
    const files = await walkTsFiles(srcRoot);
    const readerAuthorizedImporter = join(
      srcRoot,
      'prediction/mlb/mlb-shadow-prepared-execution-job-v2-handoff.ts',
    );
    const importers: string[] = [];
    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      const imports = extractImportSources(content);
      if (
        imports.some((s) =>
          s.includes('mlb-shadow-prepared-execution-job-v2-reader'),
        )
      ) {
        importers.push(file);
      }
    }
    expect(importers).toEqual([readerAuthorizedImporter]);
  });

  it('33. reader does not expose a prediction result (no execution fields)', async () => {
    const repoRoot = await trackedTempDir('reader-noexecution-');
    await persistValid(repoRoot, buildValidPreparedJob());
    const result = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      // The reader returns the prepared ARTIFACT only; no computed prediction.
      expect(result.value).not.toHaveProperty('prediction');
      expect(result.value).not.toHaveProperty('computedAt');
      expect(result.value).not.toHaveProperty('predictionResult');
    }
  });
});
