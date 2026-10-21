/* -------------------------------------------------------------------------- */
/*  Functional tests for the MLB Shadow Preparation Identity store (P5F-C4)      */
/* -------------------------------------------------------------------------- */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import {
  mkdtemp,
  rm,
  writeFile,
  mkdir,
  readFile,
  readdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    link: vi.fn(actual.link),
    unlink: vi.fn(actual.unlink),
  };
});

import {
  MLB_SHADOW_PREPARATION_IDENTITY_STORE_VERSION,
  resolveOrAllocateMLBShadowPreparationIdentity,
  type MLBShadowPreparationIdentityResolutionResult,
} from '@/prediction/mlb/mlb-shadow-preparation-identity-store';
import {
  MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-shadow-preparation-identity-contract';

/* -------------------------------------------------------------------------- */
/*  Test fixtures                                                             */
/* -------------------------------------------------------------------------- */

const NAMESPACE_DIR = join(
  'var',
  'mlb-development',
  'mlb-shadow-monitoring',
  'operational',
  'preparation-identities',
);

/* -------------------------------------------------------------------------- */

interface TestContext {
  repoRoot: string;
  generatorCallCount: number;
}

let ctx: TestContext;

beforeEach(async () => {
  ctx = {
    repoRoot: await mkdtemp(join(tmpdir(), 'prep-id-test-')),
    generatorCallCount: 0,
  };
});

afterEach(async () => {
  const actualFs =
    await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  vi.mocked(fs.link).mockReset();
  vi.mocked(fs.link).mockImplementation(actualFs.link);
  vi.mocked(fs.unlink).mockReset();
  vi.mocked(fs.unlink).mockImplementation(actualFs.unlink);
  await rm(ctx.repoRoot, { recursive: true, force: true });
});

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function computeArtifactFilename(preparationRequestId: string): string {
  return (
    createHash('sha256')
      .update(preparationRequestId, 'utf-8')
      .digest('hex') + '.json'
  );
}

function getArtifactPath(repoRoot: string, requestId: string): string {
  return join(repoRoot, NAMESPACE_DIR, computeArtifactFilename(requestId));
}

function makeGenerator(prefix: string): () => string {
  return () => {
    ctx.generatorCallCount++;
    return `${prefix}-${ctx.generatorCallCount}`;
  };
}

function buildCanonicalJson(record: {
  contractVersion: string;
  preparationRequestId: string;
  gamePk: number;
  shadowRecordId: string;
}): string {
  return JSON.stringify({
    contractVersion: record.contractVersion,
    preparationRequestId: record.preparationRequestId,
    gamePk: record.gamePk,
    shadowRecordId: record.shadowRecordId,
  });
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                       */
/* -------------------------------------------------------------------------- */

describe('mlb-shadow-preparation-identity-store', () => {
  /* 1. First allocation and immutable persistence */
  describe('1. First allocation', () => {
    it('1.1. allocates and persists a new identity', async () => {
      const gen = makeGenerator('shadow');
      const result = await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        'prep-001',
        714000,
        gen,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.status).toBe('PERSISTED');
        expect(result.storeVersion).toBe(
          MLB_SHADOW_PREPARATION_IDENTITY_STORE_VERSION,
        );
        expect(result.artifactCreated).toBe(true);
        expect(result.tempCleanupFailed).toBe(false);
        expect(result.preparationRequestId).toBe('prep-001');
        expect(result.gamePk).toBe(714000);
        expect(result.shadowRecordId).toBe('shadow-1');
        expect(result.verificationOk).toBe(true);
      }
      expect(ctx.generatorCallCount).toBe(1);
    });

    it('1.2. persisted artifact exists on filesystem with correct SHA256', async () => {
      const gen = makeGenerator('shadow');
      const result = await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        'prep-001',
        714000,
        gen,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const filePath = getArtifactPath(ctx.repoRoot, 'prep-001');
      const fileContent = await readFile(filePath, 'utf8');

      expect(fileContent).toContain('prep-001');
      expect(fileContent).toContain('714000');
      expect(fileContent).toContain(result.shadowRecordId);
      /* Verify artifact hash by reading the file in the isolated temp fixture. */
      const expectedCanonicalJson = buildCanonicalJson({
        contractVersion: MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION,
        preparationRequestId: 'prep-001',
        gamePk: 714000,
        shadowRecordId: result.shadowRecordId,
      });
      const expectedSha256 = createHash('sha256')
        .update(expectedCanonicalJson, 'utf-8')
        .digest('hex');
      const actualSha256 = createHash('sha256')
        .update(fileContent, 'utf-8')
        .digest('hex');
      expect(actualSha256).toBe(expectedSha256);
    });

    it('1.3. second allocation with same params is idempotent', async () => {
      const gen = makeGenerator('shadow');

      const first = await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        'prep-001',
        714000,
        gen,
      );
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      const firstShadowId = first.shadowRecordId;

      const second = await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        'prep-001',
        714000,
        gen,
      );
      expect(second.ok).toBe(true);
      if (!second.ok) return;

      expect(second.status).toBe('IDEMPOTENT_IDENTICAL_SUCCESS');
      expect(second.artifactCreated).toBe(false);
      expect(second.tempCleanupFailed).toBe(false);
      expect(second.verificationOk).toBe(true);
      expect(second.shadowRecordId).toBe(firstShadowId);
      expect(ctx.generatorCallCount).toBe(1);
    });

    it('1.4. allocated artifact has correct contractVersion in content', async () => {
      const gen = makeGenerator('shadow');
      await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        'prep-001',
        714000,
        gen,
      );

      const filePath = getArtifactPath(ctx.repoRoot, 'prep-001');
      const content = JSON.parse(await readFile(filePath, 'utf8')) as Record<
        string,
        unknown
      >;

      expect(content['contractVersion']).toBe(
        MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION,
      );
    });
  });

  /* 2. Generator-free existing-record idempotence */
  describe('2. Generator-free idempotence', () => {
    it('2.1. existing record fast path does not call generator', async () => {
      const gen = makeGenerator('shadow');

      // First call creates the record
      const first = await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        'prep-001',
        714000,
        gen,
      );
      expect(first.ok).toBe(true);
      expect(ctx.generatorCallCount).toBe(1);

      // Second call should NOT call generator
      const second = await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        'prep-001',
        714000,
        gen,
      );
      expect(second.ok).toBe(true);
      if (second.ok) {
        expect(second.status).toBe('IDEMPOTENT_IDENTICAL_SUCCESS');
        expect(second.tempCleanupFailed).toBe(false);
        expect(second.verificationOk).toBe(true);
      }
      expect(ctx.generatorCallCount).toBe(1);
    });

    it('2.2. existing record fast path returns same shadowRecordId', async () => {
      const gen = makeGenerator('shadow');

      const first = await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        'prep-001',
        714000,
        gen,
      );
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      const firstId = first.shadowRecordId;

      const second = await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        'prep-001',
        714000,
        gen,
      );
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.shadowRecordId).toBe(firstId);
      expect(second.tempCleanupFailed).toBe(false);
      expect(second.verificationOk).toBe(true);
    });
  });

  /* 3. Same preparationRequestId with different gamePk */
  describe('3. Same preparationRequestId, different gamePk', () => {
    it('3.1. returns GAME_PK_MISMATCH when gamePk differs', async () => {
      const gen = makeGenerator('shadow');

      const first = await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        'prep-001',
        714000,
        gen,
      );
      expect(first.ok).toBe(true);

      const second = await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        'prep-001',
        714001, // different gamePk
        gen,
      );
      expect(second.ok).toBe(false);
      if (!second.ok) {
        expect(second.status).toBe('GAME_PK_MISMATCH');
        expect(second.artifactCreated).toBe(false);
      }
      // Generator should not be called on the second attempt
      expect(ctx.generatorCallCount).toBe(1);
    });
  });

  /* 4. Existing record identity mismatch (tampered preparationRequestId) */
  describe('4. Existing record identity mismatch', () => {
    it('4.1. tampered preparationRequestId in file returns RECORD_IDENTITY_MISMATCH', async () => {
      const gen = makeGenerator('shadow');

      // Pre-create a file with wrong preparationRequestId but correct filename
      const fileName = computeArtifactFilename('prep-001');
      const filePath = join(ctx.repoRoot, NAMESPACE_DIR, fileName);
      await mkdir(join(ctx.repoRoot, NAMESPACE_DIR), { recursive: true });

      const tamperedContent = buildCanonicalJson({
        contractVersion: MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION,
        preparationRequestId: 'prep-999', // WRONG — filename is for prep-001
        gamePk: 714000,
        shadowRecordId: 'shadow-tampered',
      });
      await writeFile(filePath, tamperedContent, 'utf8');

      const result = await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        'prep-001',
        714000,
        gen,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe('RECORD_IDENTITY_MISMATCH');
        expect(result.artifactCreated).toBe(false);
      }
      expect(ctx.generatorCallCount).toBe(0);
    });
  });

  /* 5. Deterministic concurrency with winner/loser */
  describe('5. Concurrency — same request', () => {
    it('5.1. concurrent allocation returns same shadowRecordId with winner/loser', async () => {
      const generatedIds: string[] = [];
      const gen = () => {
        ctx.generatorCallCount++;
        const id = `shadow-${ctx.generatorCallCount}`;
        generatedIds.push(id);
        return id;
      };

      const [resultA, resultB] = await Promise.all([
        resolveOrAllocateMLBShadowPreparationIdentity(
          ctx.repoRoot,
          'prep-001',
          714000,
          gen,
        ),
        resolveOrAllocateMLBShadowPreparationIdentity(
          ctx.repoRoot,
          'prep-001',
          714000,
          gen,
        ),
      ]);

      // Both result objects must be successful
      expect(resultA.ok).toBe(true);
      expect(resultB.ok).toBe(true);
      if (!resultA.ok || !resultB.ok) return;

      // Both successful results must carry an empty issues array
      expect(resultA.issues).toEqual([]);
      expect(resultB.issues).toEqual([]);

      // Both must return the SAME persisted shadowRecordId
      expect(resultA.shadowRecordId).toBe(resultB.shadowRecordId);

      // Exactly one PERSISTED result and one IDEMPOTENT_IDENTICAL_SUCCESS
      // result. Do NOT assume caller A or B wins — identify winner by status.
      const persisted = [resultA, resultB].filter(
        (r) => r.status === 'PERSISTED',
      );
      const idempotent = [resultA, resultB].filter(
        (r) => r.status === 'IDEMPOTENT_IDENTICAL_SUCCESS',
      );
      expect(persisted).toHaveLength(1);
      expect(idempotent).toHaveLength(1);
      const winner = persisted[0];
      const loser = idempotent[0];

      // Winner has artifactCreated=true, loser has artifactCreated=false
      expect(winner.artifactCreated).toBe(true);
      expect(winner.tempCleanupFailed).toBe(false);
      expect(winner.verificationOk).toBe(true);
      expect(winner.issues).toEqual([]);
      expect(loser.artifactCreated).toBe(false);
      expect(loser.tempCleanupFailed).toBe(false);
      expect(loser.verificationOk).toBe(true);
      expect(loser.issues).toEqual([]);

      // Winning ID must be among the generated provisional IDs
      expect(generatedIds).toContain(winner.shadowRecordId);

      // Both return the winner's shadowRecordId (loser discards its own if it had one)
      expect(winner.shadowRecordId).toBe(loser.shadowRecordId);

      // Final canonical registry artifact contains the winning ID
      const artifactPath = getArtifactPath(ctx.repoRoot, 'prep-001');
      const content = await readFile(artifactPath, 'utf-8');
      expect(content).toContain(winner.shadowRecordId);

      // Exactly one final registry artifact exists; no unexpected temp files
      const nsDir = join(ctx.repoRoot, NAMESPACE_DIR);
      const files = await readdir(nsDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));
      const tmpFiles = files.filter((f) => f.endsWith('.tmp'));
      expect(jsonFiles).toHaveLength(1);
      expect(tmpFiles).toHaveLength(0);

      // Generator calls: 1 or 2 are valid for this unbarriered Promise.all test.
      //  - 1: caller A won the race end-to-end; caller B hit the existing-record
      //       fast path (generator-free) and adopted the persisted ID.
      //  - 2: both callers generated provisional IDs; one won fs.link, the loser
      //       received EEXIST and adopted the winner's identity.
      expect(ctx.generatorCallCount).toBeGreaterThanOrEqual(1);
      expect(ctx.generatorCallCount).toBeLessThanOrEqual(2);

      // Every generated ID is unique (corrected: Set.size, not Set.length)
      expect(new Set(generatedIds).size).toBe(generatedIds.length);

      if (ctx.generatorCallCount === 2) {
        // Two provisional IDs were generated: confirm the losing provisional ID
        // is not persisted in the final artifact.
        const losingId = generatedIds.find((id) => id !== winner.shadowRecordId);
        expect(losingId).toBeDefined();
        if (!losingId) return;
        expect(losingId).not.toBe(winner.shadowRecordId);
        expect(content).not.toContain(losingId);
      } else {
        // One ID was generated: the second caller used the generator-free fast
        // path and returned the already-persisted ID. No losing provisional ID
        // exists to check.
        expect(generatedIds).toHaveLength(1);
        expect(winner.shadowRecordId).toBe(generatedIds[0]);
      }
    });

    it('5.2. concurrent allocation with different preparationRequests are independent', async () => {
      const gen = makeGenerator('shadow');

      const [resultA, resultB] = await Promise.all([
        resolveOrAllocateMLBShadowPreparationIdentity(
          ctx.repoRoot,
          'prep-001',
          714000,
          gen,
        ),
        resolveOrAllocateMLBShadowPreparationIdentity(
          ctx.repoRoot,
          'prep-002',
          714001,
          gen,
        ),
      ]);

      expect(resultA.ok).toBe(true);
      expect(resultB.ok).toBe(true);
      if (!resultA.ok || !resultB.ok) return;

      expect(resultA.status).toBe('PERSISTED');
      expect(resultB.status).toBe('PERSISTED');
      expect(resultA.shadowRecordId).not.toBe(resultB.shadowRecordId);
      expect(ctx.generatorCallCount).toBe(2);
    });
  });

  /* 6. Input validation (fail-closed, zero FS) */
  describe('6. Input validation', () => {
    it('6.1. empty preparationRequestId returns VALIDATION_FAILED without FS writes', async () => {
      const gen = makeGenerator('shadow');
      const result = await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        '',
        714000,
        gen,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe('VALIDATION_FAILED');
        expect(result.artifactCreated).toBe(false);
      }
      expect(ctx.generatorCallCount).toBe(0);
    });

    it('6.2. zero gamePk returns VALIDATION_FAILED', async () => {
      const gen = makeGenerator('shadow');
      const result = await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        'prep-001',
        0,
        gen,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe('VALIDATION_FAILED');
      }
      expect(ctx.generatorCallCount).toBe(0);
    });

    it('6.3. negative gamePk returns VALIDATION_FAILED', async () => {
      const gen = makeGenerator('shadow');
      const result = await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        'prep-001',
        -1,
        gen,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe('VALIDATION_FAILED');
      }
      expect(ctx.generatorCallCount).toBe(0);
    });

    it('6.4. NaN gamePk returns VALIDATION_FAILED', async () => {
      const gen = makeGenerator('shadow');
      const result = await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        'prep-001',
        NaN,
        gen,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe('VALIDATION_FAILED');
      }
      expect(ctx.generatorCallCount).toBe(0);
    });

    it('6.5. whitespace-only preparationRequestId returns VALIDATION_FAILED', async () => {
      const gen = makeGenerator('shadow');
      const result = await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        '   ',
        714000,
        gen,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe('VALIDATION_FAILED');
      }
      expect(ctx.generatorCallCount).toBe(0);
    });

    it('6.6. control-character preparationRequestId returns VALIDATION_FAILED', async () => {
      const gen = makeGenerator('shadow');
      const result = await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        'prep\x00evil',
        714000,
        gen,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe('VALIDATION_FAILED');
        expect(result.preparationRequestId).toBeNull();
      }
      expect(ctx.generatorCallCount).toBe(0);
    });

    it('6.7. invalid preparationRequestId is never echoed in failure result', async () => {
      const gen = makeGenerator('shadow');

      // Empty string
      const emptyResult = await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        '',
        714000,
        gen,
      );
      expect(emptyResult.ok).toBe(false);
      if (!emptyResult.ok) {
        expect(emptyResult.status).toBe('VALIDATION_FAILED');
        expect(emptyResult.preparationRequestId).toBeNull();
        expect(emptyResult.artifactCreated).toBe(false);
        expect(emptyResult.tempCleanupFailed).toBe(false);
        expect(emptyResult.verificationOk).toBeNull();
        expect(emptyResult.relativePath).toBeNull();
      }

      // Whitespace-only
      const wsResult = await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        '   ',
        714000,
        gen,
      );
      expect(wsResult.ok).toBe(false);
      if (!wsResult.ok) {
        expect(wsResult.status).toBe('VALIDATION_FAILED');
        expect(wsResult.preparationRequestId).toBeNull();
      }

      // Control-character with valid prefix
      const ctrlResult = await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        'prep\x00evil',
        714000,
        gen,
      );
      expect(ctrlResult.ok).toBe(false);
      if (!ctrlResult.ok) {
        expect(ctrlResult.status).toBe('VALIDATION_FAILED');
        expect(ctrlResult.preparationRequestId).toBeNull();
      }

      expect(ctx.generatorCallCount).toBe(0);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  7. Deterministic EEXIST race (mocked fs.link)                     */
  /*  Follows the precedent of tests F/G/H in the monitoring store.     */
  /* ------------------------------------------------------------------ */
  describe('7. Deterministic EEXIST race', () => {
    /* O1. EEXIST loser with successful temp cleanup */
    it('O1. EEXIST race: loser adopts winner shadowRecordId, cleanup succeeds', async () => {
      const gen = makeGenerator('shadow');
      const winnerShadowId = 'winner-shadow-999';
      const winnerCanonicalJson = buildCanonicalJson({
        contractVersion: MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION,
        preparationRequestId: 'prep-001',
        gamePk: 714000,
        shadowRecordId: winnerShadowId,
      });
      const loserCanonicalJson = buildCanonicalJson({
        contractVersion: MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION,
        preparationRequestId: 'prep-001',
        gamePk: 714000,
        shadowRecordId: 'shadow-1',
      });

      // Mock fs.link: simulate concurrent winner writing identical-record
      // bytes (same prepId + gamePk, different shadowRecordId) then EEXIST.
      vi.mocked(fs.link).mockImplementationOnce(
        async (_src, finalPath) => {
          await fs.writeFile(finalPath, winnerCanonicalJson, 'utf-8');
          const err = new Error('EEXIST') as NodeJS.ErrnoException;
          err.code = 'EEXIST';
          throw err;
        },
      );

      const result = await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        'prep-001',
        714000,
        gen,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.status).toBe('IDEMPOTENT_IDENTICAL_SUCCESS');
        expect(result.artifactCreated).toBe(false);
        expect(result.verificationOk).toBe(true);
        expect(result.tempCleanupFailed).toBe(false);
        // Loser adopts the winner's shadowRecordId, discarding provisional 'shadow-1'
        expect(result.shadowRecordId).toBe(winnerShadowId);
        expect(result.shadowRecordId).not.toBe('shadow-1');
      }
      // Generator called once (loser created a provisional ID before losing)
      expect(ctx.generatorCallCount).toBe(1);

      // Proves EEXIST was actually exercised
      expect(vi.mocked(fs.link)).toHaveBeenCalledTimes(1);

      // The competing winner artifact is valid and canonical — no overwrite
      const artifactPath = getArtifactPath(ctx.repoRoot, 'prep-001');
      const content = await readFile(artifactPath, 'utf-8');
      expect(content).toBe(winnerCanonicalJson);
      expect(content).not.toBe(loserCanonicalJson);

      // No temp files remain after successful cleanup
      const nsDir = join(ctx.repoRoot, NAMESPACE_DIR);
      const files = await readdir(nsDir);
      const tempFiles = files.filter((f) => f.endsWith('.tmp'));
      expect(tempFiles).toHaveLength(0);
    });

    /* O2. EEXIST loser with failed temp cleanup */
    it('O2. EEXIST race: temp cleanup failure truthfully propagated', async () => {
      const gen = makeGenerator('shadow');
      const winnerShadowId = 'winner-shadow-999';
      const winnerCanonicalJson = buildCanonicalJson({
        contractVersion: MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION,
        preparationRequestId: 'prep-001',
        gamePk: 714000,
        shadowRecordId: winnerShadowId,
      });

      // Mock fs.link: simulate concurrent winner
      vi.mocked(fs.link).mockImplementationOnce(
        async (_src, finalPath) => {
          await fs.writeFile(finalPath, winnerCanonicalJson, 'utf-8');
          const err = new Error('EEXIST') as NodeJS.ErrnoException;
          err.code = 'EEXIST';
          throw err;
        },
      );

      // Mock fs.unlink to fail — temp cleanup should report tempCleanupFailed=true
      vi.mocked(fs.unlink).mockImplementationOnce(async () => {
        const err = new Error('mocked unlink failure') as NodeJS.ErrnoException;
        err.code = 'EIO';
        throw err;
      });

      const result = await resolveOrAllocateMLBShadowPreparationIdentity(
        ctx.repoRoot,
        'prep-001',
        714000,
        gen,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.status).toBe('IDEMPOTENT_IDENTICAL_SUCCESS');
        expect(result.artifactCreated).toBe(false);
        expect(result.verificationOk).toBe(true);
        // tempCleanupFailed truthfully reflects the failure
        expect(result.tempCleanupFailed).toBe(true);
        // Loser still adopts the winner's shadowRecordId
        expect(result.shadowRecordId).toBe(winnerShadowId);
      }

      // EEXIST was actually exercised
      expect(vi.mocked(fs.link)).toHaveBeenCalledTimes(1);

      // Winner's canonical artifact preserved — no overwrite or remap
      const artifactPath = getArtifactPath(ctx.repoRoot, 'prep-001');
      const content = await readFile(artifactPath, 'utf-8');
      expect(content).toBe(winnerCanonicalJson);
    });
  });
});
