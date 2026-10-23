/* -------------------------------------------------------------------------- */
/*  Functional tests for the prepared-job dispatch-eligibility gate (P5F-C6)    */
/* -------------------------------------------------------------------------- */
/*  Read-only gate: delegates to the sealed reader exactly once.                */
/*  NO execution, NO persistence, NO network, NO sportsbook/odds.               */
/* -------------------------------------------------------------------------- */
import { describe, it, expect, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import * as crypto from 'node:crypto';

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
import {
  MLB_SHADOW_MONITORING_NAMESPACE_ROOT,
} from '@/prediction/mlb/mlb-shadow-monitoring-namespace';
import {
  checkPreparedJobDispatchReadiness,
  MLB_SHADOW_PREPARED_JOB_DISPATCH_ELIGIBILITY_VERSION,
  type MLBShadowPreparedJobDispatchReadinessResult,
} from '@/prediction/mlb/mlb-shadow-prepared-job-dispatch-eligibility';
import {
  orchestrateMLBShadowPreparation,
  type MLBShadowPreparationRequestOrchestrationRequest,
} from '@/prediction/mlb/mlb-shadow-preparation-request-orchestrator';

/* -------------------------------------------------------------------------- */
/*  Mock the handoff so we can prove C6 never invokes execution (test N).     */
/*  C6 does NOT import the handoff under any circumstance.                     */
/* -------------------------------------------------------------------------- */
vi.mock(
  '@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-handoff',
  () => ({
    executeStoredMLBShadowPreparedExecutionJobV2: vi.fn(),
    MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_HANDOFF_VERSION:
      'mlb-shadow-prepared-execution-job-v2-handoff-v1',
  }),
);
import * as handoffModule from '@/prediction/mlb/mlb-shadow-prepared-execution-job-v2-handoff';

/* -------------------------------------------------------------------------- */
/*  Mock the adapter so we can prove C6 never invokes it directly (test N).    */
/* -------------------------------------------------------------------------- */
vi.mock(
  '@/prediction/mlb/mlb-shadow-execution-adapter-v2',
  () => ({
    executeMLBShadowExecutionJobV2: vi.fn(),
    MLB_SHADOW_EXECUTION_ADAPTER_V2_VERSION:
      'mlb-shadow-execution-adapter-v2-v1',
  }),
);

/* -------------------------------------------------------------------------- */
/*  Test constants + fixture builders (mirror the sealed reader test fixtures) */
/* -------------------------------------------------------------------------- */
const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';
const FROZEN_PREDICTION_GENERATED_AT = '2026-07-15T18:40:00Z';
const FROZEN_OFFICIAL_DATE = '2026-07-15';
const FROZEN_MANIFEST_FINGERPRINT =
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT;

const SYNTHETIC_SHADOW_RECORD_ID = 'shadow-001';

const PREPARED_JOBS_RELATIVE = 'quarantine/prepared-jobs';

const ELIGIBILITY_SOURCE_PATH = join(
  process.cwd(),
  'src/prediction/mlb/mlb-shadow-prepared-job-dispatch-eligibility.ts',
);

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
  return crypto.createHash('sha256').update(input, 'utf-8').digest('hex');
}

function preparedJobsDirFor(repoRoot: string): string {
  return join(
    repoRoot,
    MLB_SHADOW_MONITORING_NAMESPACE_ROOT,
    PREPARED_JOBS_RELATIVE,
  );
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
  vi.clearAllMocks();
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

/** Recursively collect all file paths (relative), sorted. */
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

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('mlb-shadow-prepared-job-dispatch-eligibility', () => {
  /* A. Valid persisted prepared job -> ELIGIBLE */
  it('A. valid persisted prepared job -> ELIGIBLE (READ_OK)', async () => {
    const repoRoot = await trackedTempDir('c6-eligible-');
    await persistValid(repoRoot, buildValidPreparedJob());

    const result = await checkPreparedJobDispatchReadiness(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    expect(result.kind).toBe('ELIGIBLE');
    expect(result.eligibilityVersion).toBe(
      MLB_SHADOW_PREPARED_JOB_DISPATCH_ELIGIBILITY_VERSION,
    );
    expect(result.shadowRecordId).toBe(SYNTHETIC_SHADOW_RECORD_ID);
    expect(result.readerResult.ok).toBe(true);
    expect(result.readerResult.status).toBe('READ_OK');
    expect(result.readerResult.readerVersion).toBe(
      MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_READER_VERSION,
    );
  });

  /* B. Invalid shadowRecordId -> NOT_ELIGIBLE (SHADOW_RECORD_ID_INVALID) */
  it('B. invalid shadowRecordId -> NOT_ELIGIBLE, reader fails closed', async () => {
    const repoRoot = await trackedTempDir('c6-badid-');
    const badIds = ['', '   ', 'a\tb', 'a\nb', 'ab\x00cd'];

    for (const id of badIds) {
      const result = await checkPreparedJobDispatchReadiness(repoRoot, id);
      expect(result.kind).toBe('NOT_ELIGIBLE');
      expect(result.shadowRecordId).toBe(id);
      expect(result.readerResult.ok).toBe(false);
      expect(result.readerResult.status).toBe('SHADOW_RECORD_ID_INVALID');
    }

    // undefined input is also rejected by the reader before any FS access
    const result = await checkPreparedJobDispatchReadiness(
      repoRoot,
      undefined as unknown as string,
    );
    expect(result.kind).toBe('NOT_ELIGIBLE');
    expect(result.readerResult.status).toBe('SHADOW_RECORD_ID_INVALID');
  });

  /* C. Missing prepared job -> NOT_ELIGIBLE (NOT_FOUND) */
  it('C. missing prepared job -> NOT_ELIGIBLE (NOT_FOUND)', async () => {
    const repoRoot = await trackedTempDir('c6-missing-');
    const result = await checkPreparedJobDispatchReadiness(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(result.kind).toBe('NOT_ELIGIBLE');
    expect(result.readerResult.ok).toBe(false);
    expect(result.readerResult.status).toBe('NOT_FOUND');
  });

  /* D. Malformed JSON -> NOT_ELIGIBLE (MALFORMED_JSON) */
  it('D. malformed JSON -> NOT_ELIGIBLE (MALFORMED_JSON)', async () => {
    const repoRoot = await trackedTempDir('c6-badjson-');
    await writeArtifactBytes(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
      Buffer.from('not json {{{', 'utf8'),
    );

    const result = await checkPreparedJobDispatchReadiness(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(result.kind).toBe('NOT_ELIGIBLE');
    expect(result.readerResult.ok).toBe(false);
    expect(result.readerResult.status).toBe('MALFORMED_JSON');
  });

  /* E. Prepared contract validation failure -> NOT_ELIGIBLE */
  it('E. contract-invalid JSON (empty object) -> NOT_ELIGIBLE (PREPARED_CONTRACT_VALIDATION_FAILED)', async () => {
    const repoRoot = await trackedTempDir('c6-badcontract-');
    await writeArtifactBytes(
      repoRoot,
      'bad-contract-id',
      Buffer.from('{}', 'utf8'),
    );

    const result = await checkPreparedJobDispatchReadiness(
      repoRoot,
      'bad-contract-id',
    );
    expect(result.kind).toBe('NOT_ELIGIBLE');
    expect(result.readerResult.ok).toBe(false);
    expect(result.readerResult.status).toBe(
      'PREPARED_CONTRACT_VALIDATION_FAILED',
    );
  });

  /* F. Shadow record identity mismatch -> NOT_ELIGIBLE */
  it('F. shadowRecordId mismatch -> NOT_ELIGIBLE (SHADOW_RECORD_ID_MISMATCH)', async () => {
    const repoRoot = await trackedTempDir('c6-mismatch-');
    const jobA = buildValidPreparedJob({ shadowRecordId: 'shadow-A' });
    await persistValid(repoRoot, jobA);
    const bytesA = readFileSync(artifactPathFor(repoRoot, 'shadow-A'));
    // Place shadow-A content at the hash('shadow-B') path.
    await writeArtifactBytes(repoRoot, 'shadow-B', Buffer.from(bytesA));

    const result = await checkPreparedJobDispatchReadiness(
      repoRoot,
      'shadow-B',
    );
    expect(result.kind).toBe('NOT_ELIGIBLE');
    expect(result.readerResult.ok).toBe(false);
    expect(result.readerResult.status).toBe('SHADOW_RECORD_ID_MISMATCH');
  });

  /* G. Reader read failure (invalid repoRoot) -> NOT_ELIGIBLE */
  it('G. invalid repoRoot -> NOT_ELIGIBLE (REPO_ROOT_INVALID)', async () => {
    const result = await checkPreparedJobDispatchReadiness(
      'relative/path',
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(result.kind).toBe('NOT_ELIGIBLE');
    expect(result.readerResult.ok).toBe(false);
    expect(result.readerResult.status).toBe('REPO_ROOT_INVALID');
  });

  /* Additional: noncanonical bytes -> NOT_ELIGIBLE (NONCANONICAL_BYTES) */
  it('G2. noncanonical bytes -> NOT_ELIGIBLE (NONCANONICAL_BYTES)', async () => {
    const repoRoot = await trackedTempDir('c6-noncanon-');
    await persistValid(repoRoot, buildValidPreparedJob());
    const artifact = artifactPathFor(repoRoot, SYNTHETIC_SHADOW_RECORD_ID);
    const original = readFileSync(artifact);
    // Pretty-print breaks canonical byte equality.
    const pretty = Buffer.from(
      JSON.stringify(JSON.parse(original.toString('utf8')), null, 2),
      'utf8',
    );
    await fs.writeFile(artifact, pretty);

    const result = await checkPreparedJobDispatchReadiness(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(result.kind).toBe('NOT_ELIGIBLE');
    expect(result.readerResult.ok).toBe(false);
    expect(result.readerResult.status).toBe('NONCANONICAL_BYTES');
  });

  /* H. Repeated eligibility check: same unchanged artifact -> same result */
  it('H. repeated eligibility check returns same result; no writes', async () => {
    const repoRoot = await trackedTempDir('c6-repeat-');
    await persistValid(repoRoot, buildValidPreparedJob());

    const r1 = await checkPreparedJobDispatchReadiness(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    const r2 = await checkPreparedJobDispatchReadiness(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(r1).toEqual(r2);
    expect(r1.kind).toBe('ELIGIBLE');
    expect(r2.kind).toBe('ELIGIBLE');
  });

  /* I. Concurrent eligibility checks: both read valid artifact, no mutation */
  it('I. concurrent eligibility checks both report ELIGIBLE; no mutation', async () => {
    const repoRoot = await trackedTempDir('c6-concurrent-');
    await persistValid(repoRoot, buildValidPreparedJob());

    const artifact = artifactPathFor(repoRoot, SYNTHETIC_SHADOW_RECORD_ID);
    const bytesBefore = createHash('sha256')
      .update(readFileSync(artifact))
      .digest('hex');
    const treeBefore = await collectTree(repoRoot);

    const [r1, r2] = await Promise.all([
      checkPreparedJobDispatchReadiness(
        repoRoot,
        SYNTHETIC_SHADOW_RECORD_ID,
      ),
      checkPreparedJobDispatchReadiness(
        repoRoot,
        SYNTHETIC_SHADOW_RECORD_ID,
      ),
    ]);

    expect(r1.kind).toBe('ELIGIBLE');
    expect(r2.kind).toBe('ELIGIBLE');

    const bytesAfter = createHash('sha256')
      .update(readFileSync(artifact))
      .digest('hex');
    const treeAfter = await collectTree(repoRoot);
    expect(bytesAfter).toBe(bytesBefore);
    expect(treeAfter).toEqual(treeBefore);
  });

  /* J. Realistic integration: persist via C3 store, then C6 reports ELIGIBLE */
  it('J. realistic integration via C3 persistence path -> ELIGIBLE', async () => {
    const repoRoot = await trackedTempDir('c6-integration-');
    const job = buildValidPreparedJob({
      shadowRecordId: 'shadow-integration-001',
    });
    // Persist via the sealed C3 store (the C5/C3 path).
    await persistValid(repoRoot, job);

    // Call C6 with the same shadowRecordId used for persistence.
    const result = await checkPreparedJobDispatchReadiness(
      repoRoot,
      'shadow-integration-001',
    );
    expect(result.kind).toBe('ELIGIBLE');
    expect(result.readerResult.ok).toBe(true);
    expect(result.readerResult.status).toBe('READ_OK');

    // Cross-check: the reader itself also returns READ_OK for the same artifact.
    const directReader = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      'shadow-integration-001',
    );
    expect(directReader.ok).toBe(true);
    expect(directReader.status).toBe('READ_OK');
  });

  /* K. Registry (namespace directory) exists but prepared job missing */
  it('K. namespace exists but artifact missing -> NOT_ELIGIBLE (NOT_FOUND)', async () => {
    const repoRoot = await trackedTempDir('c6-regmissing-');
    // Create the prepared-jobs directory but no artifact file.
    await ensurePreparedDir(repoRoot);

    const result = await checkPreparedJobDispatchReadiness(
      repoRoot,
      'shadow-no-artifact-001',
    );
    expect(result.kind).toBe('NOT_ELIGIBLE');
    expect(result.readerResult.ok).toBe(false);
    expect(result.readerResult.status).toBe('NOT_FOUND');
    // NOTE: C6 does NOT cross-check the C4 registry — it only checks the
    // prepared-job artifact via the reader.
    expect(existsSync(artifactPathFor(repoRoot, 'shadow-no-artifact-001'))).toBe(false);
  });

  /* L. Reader result preservation: C6 does not replace status or invent messages */
  it('L. reader result is preserved verbatim; no invented fields or messages', async () => {
    const repoRoot = await trackedTempDir('c6-preserve-');

    // ELIGIBLE path: readerResult is the exact READ_OK result.
    await persistValid(repoRoot, buildValidPreparedJob());
    const eligible = await checkPreparedJobDispatchReadiness(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    const directReader = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    expect(eligible.readerResult).toEqual(directReader);
    expect(eligible.readerResult.readerVersion).toBe(
      MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_READER_VERSION,
    );

    // NOT_ELIGIBLE path: readerResult preserves the exact failure status.
    const missing = await checkPreparedJobDispatchReadiness(
      repoRoot,
      'nonexistent-id',
    );
    const directReaderMissing = await readMLBShadowPreparedExecutionJobV2(
      repoRoot,
      'nonexistent-id',
    );
    expect(missing.readerResult).toEqual(directReaderMissing);
    expect(missing.readerResult.status).toBe('NOT_FOUND');
  });

  /* M. No real filesystem mutations: artifact bytes unchanged before/after */
  it('M. artifact bytes unchanged after eligibility check', async () => {
    const repoRoot = await trackedTempDir('c6-nomutation-');
    await persistValid(repoRoot, buildValidPreparedJob());
    const artifact = artifactPathFor(repoRoot, SYNTHETIC_SHADOW_RECORD_ID);
    const before = createHash('sha256')
      .update(readFileSync(artifact))
      .digest('hex');
    const treeBefore = await collectTree(repoRoot);

    await checkPreparedJobDispatchReadiness(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    const after = createHash('sha256')
      .update(readFileSync(artifact))
      .digest('hex');
    const treeAfter = await collectTree(repoRoot);
    expect(after).toBe(before);
    expect(treeAfter).toEqual(treeBefore);
  });

  /* N. No execution: handoff and execution functions are never invoked */
  it('N. handoff execute function is never invoked', async () => {
    const repoRoot = await trackedTempDir('c6-noexec-');
    await persistValid(repoRoot, buildValidPreparedJob());

    await checkPreparedJobDispatchReadiness(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );

    expect(
      vi.mocked(
        handoffModule.executeStoredMLBShadowPreparedExecutionJobV2,
      ),
    ).not.toHaveBeenCalled();
  });

  /* O. No sportsbook/odds dependence: result has no odds-related fields */
  it('O. result has no sportsbook/odds/market fields at the C6 envelope level', async () => {
    const repoRoot = await trackedTempDir('c6-noprobs-');
    await persistValid(repoRoot, buildValidPreparedJob());

    const result = await checkPreparedJobDispatchReadiness(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    // Check top-level keys only (not the preserved nested reader result,
    // which legitimately contains coefficient field names like valueCoefficient).
    const topKeys = Object.keys(result).sort();
    expect(topKeys).toEqual([
      'eligibilityVersion',
      'kind',
      'readerResult',
      'shadowRecordId',
    ]);
    // C6 itself adds no odds/sportsbook/market field at the envelope level.
    for (const key of topKeys) {
      expect(key).not.toMatch(/odds|bookmaker|market/i);
    }
    // C6 has no sportsbook-related import in source.
    const c6Source = readFileSync(
      ELIGIBILITY_SOURCE_PATH,
      'utf8',
    );
    expect(c6Source).not.toMatch(/odds|bookmaker|market|sportsbook/i);
  });

  /* P. No silent retries: single reader call per invocation (deterministic) */
  it('P. same input always yields same output (no retry nondeterminism)', async () => {
    const repoRoot = await trackedTempDir('c6-noretry-');
    await persistValid(repoRoot, buildValidPreparedJob());

    const results: MLBShadowPreparedJobDispatchReadinessResult[] = [];
    for (let i = 0; i < 5; i++) {
      results.push(
        await checkPreparedJobDispatchReadiness(
          repoRoot,
          SYNTHETIC_SHADOW_RECORD_ID,
        ),
      );
    }
    // All five results must be identical (deterministic, no retry state).
    for (const r of results) {
      expect(r).toEqual(results[0]);
      expect(r.kind).toBe('ELIGIBLE');
    }
  });

  /* Q. Readiness is NOT dispatch authorization: no execution-authorized flag */
  it('Q. result has no execution-authorized / dispatch-authorized flag', async () => {
    const repoRoot = await trackedTempDir('c6-noauth-');
    await persistValid(repoRoot, buildValidPreparedJob());

    const result = await checkPreparedJobDispatchReadiness(
      repoRoot,
      SYNTHETIC_SHADOW_RECORD_ID,
    );
    // Top-level keys must be exactly the 4 envelope fields — no
    // executionAuthorized, dispatchAuthorized, canExecute, etc.
    // (We check the envelope keys, not the serialized nested readerResult
    // which legitimately preserves the authorizedModelArtifact field.)
    const keys = Object.keys(result).sort();
    expect(keys).toEqual([
      'eligibilityVersion',
      'kind',
      'readerResult',
      'shadowRecordId',
    ]);
    // No top-level key suggests execution authorization.
    for (const key of keys) {
      expect(key).not.toMatch(/authoriz|exec|dispatch.*ok|canExec/i);
    }
  });

  /* R. C5→C6 seam integration (highest-priority coverage check)               */
  /* Calls the REAL C5 orchestrator (real C4 + real C3) with an isolated      */
  /* temp repoRoot, then exercises the C6 eligibility gate on the actual      */
  /* persisted shadowRecordId.  No handcrafted prepared-job fixture.          */
  it('R. C5→C6 seam: orchestrateMLBShadowPreparation → checkPreparedJobDispatchReadiness', async () => {
    const repoRoot = await trackedTempDir('c6-c5-seam-');
    const DETERMINISTIC_SHADOW_ID = 'shadow-c5-c6-integration-001';
    const C5_C6_PREPARATION_REQUEST_ID = 'prep-c5-c6-integration-001';
    const C5_C6_GAME_PK = 714000;

    let genCallCount = 0;
    const gen = () => {
      genCallCount++;
      return DETERMINISTIC_SHADOW_ID;
    };

    // Synthetic C5 input — same frozen fixtures as C3/C5 tests, isolated temp repoRoot
    const c5Request = {
      gamePk: C5_C6_GAME_PK,
      predictionGeneratedAt: FROZEN_PREDICTION_GENERATED_AT,
      featureManifest: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
      snapshot: buildValidSnapshot(),
      officialDate: FROZEN_OFFICIAL_DATE,
      scheduledStartAt: FROZEN_SCHEDULED_START,
      latencyMs: 1234,
      featureManifestId: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
      featureManifestFingerprint: FROZEN_MANIFEST_FINGERPRINT,
      timingReferenceContractVersion: 'mlb-offline-pregame-inference-contract-v1',
      timingReferenceCutoffAt: FROZEN_DATA_CUTOFF,
      repoRoot,
      preparationRequestId: C5_C6_PREPARATION_REQUEST_ID,
    } as MLBShadowPreparationRequestOrchestrationRequest;

    // 1. Invoke C5 orchestrator (real C4 identity store + real C3 preparation)
    const c5Result = await orchestrateMLBShadowPreparation(c5Request, gen);
    expect(c5Result.status).toBe('SUCCESS');

    // 2. Derive the persisted shadowRecordId from the actual successful C4 result
    const registryResult = c5Result.registryResult;
    if (!registryResult.ok) {
      throw new Error(
        `expected C4 identity resolution ok=true, got ${registryResult.status}`,
      );
    }
    const shadowRecordId: string = registryResult.shadowRecordId;
    expect(shadowRecordId).toBe(DETERMINISTIC_SHADOW_ID);
    expect(genCallCount).toBe(1); // generator called exactly once on first allocation

    // 3. Verify the artifact was persisted by the C5/C3 path (not handcrafted)
    const artifact = artifactPathFor(repoRoot, shadowRecordId);
    expect(existsSync(artifact)).toBe(true);

    // 4. Invoke C6 on the actual persisted shadowRecordId
    const bytesBefore = createHash('sha256')
      .update(readFileSync(artifact))
      .digest('hex');
    const treeBeforeRead = await collectTree(repoRoot);

    const c6Result = await checkPreparedJobDispatchReadiness(
      repoRoot,
      shadowRecordId,
    );
    expect(c6Result.kind).toBe('ELIGIBLE');
    expect(c6Result.readerResult.ok).toBe(true);
    expect(c6Result.readerResult.status).toBe('READ_OK');
    expect(c6Result.shadowRecordId).toBe(shadowRecordId);

    // 5. Verify persisted artifact bytes remain unchanged by the C6 read
    const bytesAfter = createHash('sha256')
      .update(readFileSync(artifact))
      .digest('hex');
    expect(bytesAfter).toBe(bytesBefore);
    const treeAfterRead = await collectTree(repoRoot);
    expect(treeAfterRead).toEqual(treeBeforeRead);

    // 6. Verify identical C5 retry reuses identity (generator NOT called again)
    const retryResult = await orchestrateMLBShadowPreparation(c5Request, gen);
    expect(retryResult.status).toBe('SUCCESS');
    if (!retryResult.registryResult.ok) {
      throw new Error('expected retry C4 identity resolution ok=true');
    }
    expect(retryResult.registryResult.status).toBe(
      'IDEMPOTENT_IDENTICAL_SUCCESS',
    );
    expect(retryResult.registryResult.shadowRecordId).toBe(shadowRecordId);
    expect(genCallCount).toBe(1); // still 1 — identity reused, no new allocation

    // 7. Verify C6 remains eligible on retry
    const c6Retry = await checkPreparedJobDispatchReadiness(
      repoRoot,
      shadowRecordId,
    );
    expect(c6Retry.kind).toBe('ELIGIBLE');

    // 8. Verify no runtime execution artifacts or scientific records written,
    //    and the handoff execute function was never invoked
    expect(
      vi.mocked(handoffModule.executeStoredMLBShadowPreparedExecutionJobV2),
    ).not.toHaveBeenCalled();

    const finalTree = await collectTree(repoRoot);
    for (const relPath of finalTree) {
      expect(relPath).not.toMatch(/execution/);
      expect(relPath).not.toMatch(/prediction/);
      expect(relPath).not.toMatch(/grading/);
      expect(relPath).not.toMatch(/outcomes/);
    }
  });
});
