/* -------------------------------------------------------------------------- */
/*  Boundary / security tests for the MLB Shadow Preparation Identity store      */
/*  (P5F-C4)                                                                   */
/* -------------------------------------------------------------------------- */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtemp,
  rm,
  writeFile,
  mkdir,
  symlink,
  readFile,
  readdir,
  realpath,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  MLB_SHADOW_PREPARATION_IDENTITY_STORE_VERSION,
  resolveOrAllocateMLBShadowPreparationIdentity,
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

const STORE_SOURCE = join(
  process.cwd(),
  'src',
  'prediction',
  'mlb',
  'mlb-shadow-preparation-identity-store.ts',
);

interface TestContext {
  repoRoot: string;
  genCalls: number;
}

let ctx: TestContext;

beforeEach(async () => {
  ctx = {
    repoRoot: await mkdtemp(join(tmpdir(), 'prep-id-bnd-')),
    genCalls: 0,
  };
});

afterEach(async () => {
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

function getNamespaceDir(repoRoot: string): string {
  return join(repoRoot, NAMESPACE_DIR);
}

function makeGen(): () => string {
  return () => {
    ctx.genCalls++;
    return `shadow-${ctx.genCalls}`;
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

describe('mlb-shadow-preparation-identity-store boundary', () => {
  /* ---------------------------------------------------------------------- */
  /*  A. Store exports                                                       */
  /* ---------------------------------------------------------------------- */

  it('A1. exports MLB_SHADOW_PREPARATION_IDENTITY_STORE_VERSION', () => {
    expect(MLB_SHADOW_PREPARATION_IDENTITY_STORE_VERSION).toBe(
      'mlb-shadow-preparation-identity-store-v1',
    );
  });

  it('A2. exports resolveOrAllocateMLBShadowPreparationIdentity', () => {
    expect(typeof resolveOrAllocateMLBShadowPreparationIdentity).toBe(
      'function',
    );
  });

  /* ---------------------------------------------------------------------- */
  /*  B. Store import allowlist                                             */
  /* ---------------------------------------------------------------------- */

  it('B1. store source file has no disallowed imports', () => {
    const source = readFileSync(STORE_SOURCE, 'utf8');

    // Extract all import sources
    const importPattern = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    const imports: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = importPattern.exec(source)) !== null) {
      imports.push(match[1]);
    }

    const allowedPrefixes = [
      'node:fs/promises',
      'node:fs',
      'node:path',
      'node:crypto',
      './mlb-shadow-preparation-identity-contract',
      './mlb-shadow-monitoring-namespace',
    ];

    for (const imp of imports) {
      const isAllowed = allowedPrefixes.some(
        (p) => imp === p || imp.startsWith(p),
      );
      expect(isAllowed).toBe(true);
    }
  });

  it('B2. store source does not import react, next, express, or other frameworks', () => {
    const source = readFileSync(STORE_SOURCE, 'utf8');
    const disallowed = [
      'react',
      'next',
      'express',
      'graphql',
      'prisma',
      'axios',
      'fetch',
    ];
    for (const kw of disallowed) {
      expect(source).not.toContain(kw);
    }
  });

  /* ---------------------------------------------------------------------- */
  /*  C. Non-existent repoRoot                                              */
  /* ---------------------------------------------------------------------- */

  it('C1. non-existent repoRoot returns REPO_ROOT_INVALID', async () => {
    const gen = makeGen();
    const result = await resolveOrAllocateMLBShadowPreparationIdentity(
      join(ctx.repoRoot, 'does-not-exist'),
      'prep-001',
      714000,
      gen,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('REPO_ROOT_INVALID');
      expect(result.artifactCreated).toBe(false);
    }
    expect(ctx.genCalls).toBe(0);
  });

  /* ---------------------------------------------------------------------- */
  /*  D. Symlink detection                                                  */
  /* ---------------------------------------------------------------------- */

  it('D1. symlink at repoRoot returns SYMLINK_DETECTED', async () => {
    const gen = makeGen();
    // Create a real dir to symlink to
    const realDir = await mkdtemp(join(tmpdir(), 'prep-id-real-'));
    // Overwrite repoRoot with a symlink to realDir
    await rm(ctx.repoRoot, { recursive: true, force: true });
    await symlink(realDir, ctx.repoRoot, 'dir');

    const result = await resolveOrAllocateMLBShadowPreparationIdentity(
      ctx.repoRoot,
      'prep-001',
      714000,
      gen,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('SYMLINK_DETECTED');
    }
    expect(ctx.genCalls).toBe(0);
  });

  it('D2. symlink at intermediate namespace dir returns SYMLINK_DETECTED', async () => {
    const gen = makeGen();
    // Create var/ as a symlink
    const varDir = join(ctx.repoRoot, 'var');
    const realVarDir = await mkdtemp(join(tmpdir(), 'prep-id-var-'));
    await symlink(realVarDir, varDir, 'dir');

    const result = await resolveOrAllocateMLBShadowPreparationIdentity(
      ctx.repoRoot,
      'prep-001',
      714000,
      gen,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('SYMLINK_DETECTED');
    }
    expect(ctx.genCalls).toBe(0);
  });

  it('D3. symlink at artifact path returns SYMLINK_DETECTED', async () => {
    const gen = makeGen();
    const nsDir = getNamespaceDir(ctx.repoRoot);
    await mkdir(nsDir, { recursive: true });

    const fileName = computeArtifactFilename('prep-001');
    const artifactPath = join(nsDir, fileName);
    const targetFile = join(ctx.repoRoot, 'target.json');
    await writeFile(targetFile, '{"test": true}', 'utf8');
    await symlink(targetFile, artifactPath);

    const result = await resolveOrAllocateMLBShadowPreparationIdentity(
      ctx.repoRoot,
      'prep-001',
      714000,
      gen,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('SYMLINK_DETECTED');
    }
    expect(ctx.genCalls).toBe(0);
  });

  /* ---------------------------------------------------------------------- */
  /*  E. Non-directory ancestor protection                                 */
  /* ---------------------------------------------------------------------- */

  it('E1. file at namespace path returns NON_DIRECTORY_TARGET', async () => {
    const gen = makeGen();
    const nsDir = getNamespaceDir(ctx.repoRoot);
    await mkdir(join(ctx.repoRoot, 'var', 'mlb-development', 'mlb-shadow-monitoring', 'operational'), {
      recursive: true,
    });
    // Create a FILE where the directory should be
    const preparationIdentitiesPath = nsDir;
    await writeFile(preparationIdentitiesPath, 'not a directory', 'utf8');

    const result = await resolveOrAllocateMLBShadowPreparationIdentity(
      ctx.repoRoot,
      'prep-001',
      714000,
      gen,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('NON_DIRECTORY_TARGET');
    }
    expect(ctx.genCalls).toBe(0);
  });

  /* ---------------------------------------------------------------------- */
  /*  F. Malformed UTF-8 existing record                                    */
  /* ---------------------------------------------------------------------- */

  it('F1. malformed UTF-8 existing record returns MALFORMED_UTF8', async () => {
    const gen = makeGen();
    const nsDir = getNamespaceDir(ctx.repoRoot);
    await mkdir(nsDir, { recursive: true });

    const fileName = computeArtifactFilename('prep-001');
    const artifactPath = join(nsDir, fileName);
    await writeFile(artifactPath, Buffer.from([0xff, 0xfe, 0x00, 0x01]), 'hex');

    const result = await resolveOrAllocateMLBShadowPreparationIdentity(
      ctx.repoRoot,
      'prep-001',
      714000,
      gen,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('MALFORMED_UTF8');
      expect(result.artifactCreated).toBe(false);
    }
    expect(ctx.genCalls).toBe(0);
  });

  /* ---------------------------------------------------------------------- */
  /*  G. Malformed JSON existing record                                     */
  /* ---------------------------------------------------------------------- */

  it('G1. malformed JSON existing record returns MALFORMED_RECORD', async () => {
    const gen = makeGen();
    const nsDir = getNamespaceDir(ctx.repoRoot);
    await mkdir(nsDir, { recursive: true });

    const fileName = computeArtifactFilename('prep-001');
    const artifactPath = join(nsDir, fileName);
    await writeFile(artifactPath, '{not valid json', 'utf8');

    const result = await resolveOrAllocateMLBShadowPreparationIdentity(
      ctx.repoRoot,
      'prep-001',
      714000,
      gen,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('MALFORMED_RECORD');
    }
    expect(ctx.genCalls).toBe(0);
  });

  it('G2. empty JSON file returns MALFORMED_RECORD', async () => {
    const gen = makeGen();
    const nsDir = getNamespaceDir(ctx.repoRoot);
    await mkdir(nsDir, { recursive: true });

    const fileName = computeArtifactFilename('prep-001');
    const artifactPath = join(nsDir, fileName);
    await writeFile(artifactPath, '', 'utf8');

    const result = await resolveOrAllocateMLBShadowPreparationIdentity(
      ctx.repoRoot,
      'prep-001',
      714000,
      gen,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('MALFORMED_RECORD');
    }
    expect(ctx.genCalls).toBe(0);
  });

  /* ---------------------------------------------------------------------- */
  /*  H. Contract-invalid existing record                                   */
  /* ---------------------------------------------------------------------- */

  it('H1. contract-invalid existing record returns RECORD_CONTRACT_INVALID', async () => {
    const gen = makeGen();
    const nsDir = getNamespaceDir(ctx.repoRoot);
    await mkdir(nsDir, { recursive: true });

    const fileName = computeArtifactFilename('prep-001');
    const artifactPath = join(nsDir, fileName);
    const badRecord = JSON.stringify({
      contractVersion: 'mlb-shadow-preparation-identity-v1',
      preparationRequestId: 'prep-001',
      gamePk: -1, // invalid
      shadowRecordId: 'shadow-001',
    });
    // Write with whitespace (also non-canonical)
    await writeFile(artifactPath, badRecord, 'utf8');

    const result = await resolveOrAllocateMLBShadowPreparationIdentity(
      ctx.repoRoot,
      'prep-001',
      714000,
      gen,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('RECORD_CONTRACT_INVALID');
    }
    expect(ctx.genCalls).toBe(0);
  });

  /* ---------------------------------------------------------------------- */
  /*  I. Noncanonical existing record                                       */
  /* ---------------------------------------------------------------------- */

  it('I1. noncanonical existing record returns NONCANONICAL_RECORD', async () => {
    const gen = makeGen();
    const nsDir = getNamespaceDir(ctx.repoRoot);
    await mkdir(nsDir, { recursive: true });

    const fileName = computeArtifactFilename('prep-001');
    const artifactPath = join(nsDir, fileName);
    // Valid JSON, passes contract validation, but NOT canonical (has whitespace)
    const nonCanonical = JSON.stringify(
      {
        contractVersion: MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION,
        preparationRequestId: 'prep-001',
        gamePk: 714000,
        shadowRecordId: 'shadow-001',
      },
      null,
      2, // pretty-printed with whitespace — non-canonical
    );
    await writeFile(artifactPath, nonCanonical, 'utf8');

    const result = await resolveOrAllocateMLBShadowPreparationIdentity(
      ctx.repoRoot,
      'prep-001',
      714000,
      gen,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('NONCANONICAL_RECORD');
    }
    expect(ctx.genCalls).toBe(0);
  });

  /* ---------------------------------------------------------------------- */
  /*  J. Temp-file cleanup                                                  */
  /* ---------------------------------------------------------------------- */

  it('J1. no temp files remain after successful allocation', async () => {
    const gen = makeGen();
    await resolveOrAllocateMLBShadowPreparationIdentity(
      ctx.repoRoot,
      'prep-001',
      714000,
      gen,
    );

    const nsDir = getNamespaceDir(ctx.repoRoot);
    const files = await readdir(nsDir);
    const tempFiles = files.filter((f) => f.endsWith('.tmp'));
    expect(tempFiles).toHaveLength(0);
  });

  it('J2. exactly one artifact file after allocation', async () => {
    const gen = makeGen();
    await resolveOrAllocateMLBShadowPreparationIdentity(
      ctx.repoRoot,
      'prep-001',
      714000,
      gen,
    );

    const nsDir = getNamespaceDir(ctx.repoRoot);
    const files = await readdir(nsDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/\.json$/);
    expect(files[0]).not.toMatch(/\.tmp$/);
  });

  /* ---------------------------------------------------------------------- */
  /*  K. Immutable persistence — existing file is never overwritten          */
  /* ---------------------------------------------------------------------- */

  it('K1. existing artifact content is not overwritten on re-allocation attempt', async () => {
    const gen = makeGen();

    // First allocation
    await resolveOrAllocateMLBShadowPreparationIdentity(
      ctx.repoRoot,
      'prep-001',
      714000,
      gen,
    );

    const filePath = getArtifactPath(ctx.repoRoot, 'prep-001');
    const firstContent = await readFile(filePath, 'utf8');

    // Attempt re-allocation with different shadowRecordId generator
    const gen2 = () => 'DIFFERENT-SHADOW-ID';
    await resolveOrAllocateMLBShadowPreparationIdentity(
      ctx.repoRoot,
      'prep-001',
      714000,
      gen2,
    );

    const secondContent = await readFile(filePath, 'utf8');
    expect(secondContent).toBe(firstContent);
  });

  /* ---------------------------------------------------------------------- */
  /*  L. Concurrent allocation produces exactly one artifact file            */
  /* ---------------------------------------------------------------------- */

  it('L1. concurrent allocation produces exactly one file', async () => {
    const gen = makeGen();
    await Promise.all([
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

    const nsDir = getNamespaceDir(ctx.repoRoot);
    const files = await readdir(nsDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/\.json$/);
  });

  /* ---------------------------------------------------------------------- */
  /*  N. Generator never called on existing-record fast path                */
  /* ---------------------------------------------------------------------- */

  it('N1. generator not called when existing record is valid', async () => {
    const gen = makeGen();

    // First call creates
    await resolveOrAllocateMLBShadowPreparationIdentity(
      ctx.repoRoot,
      'prep-001',
      714000,
      gen,
    );
    expect(ctx.genCalls).toBe(1);

    // Second call — generator not called
    await resolveOrAllocateMLBShadowPreparationIdentity(
      ctx.repoRoot,
      'prep-001',
      714000,
      gen,
    );
    expect(ctx.genCalls).toBe(1);

    // Third call — generator not called
    await resolveOrAllocateMLBShadowPreparationIdentity(
      ctx.repoRoot,
      'prep-001',
      714000,
      gen,
    );
    expect(ctx.genCalls).toBe(1);
  });

  /* ---------------------------------------------------------------------- */
  /*  M. macOS canonical-path containment                                  */
  /* ---------------------------------------------------------------------- */

  it('M1. repoRoot accessed through a symlinked parent path is accepted (macOS /var scenario)', async () => {
    /*
     * Reproduces the macOS /var -> /private/var containment bug:
     * fs.realpath resolves the canonical path differently from the
     * lexical path. The repoRoot itself is a REAL directory, but its
     * path traverses a symlinked parent (symBase -> realBase), exactly
     * like macOS /var -> /private/var. The store must resolve the
     * repoRoot canonically BEFORE the containment check so both sides
     * of the comparison are canonical.
     */
    const gen = makeGen();
    const realBase = await mkdtemp(join(tmpdir(), 'prep-id-realbase-'));
    const symBase = join(realBase, '..', 'prep-id-symbase-' + Date.now());
    await symlink(realBase, symBase, 'dir');
    // repoRoot is a real subdirectory inside realBase, accessed via symBase
    const repoRoot = join(symBase, 'repo');
    await mkdir(repoRoot, { recursive: true });

    // Verify the path traverses a symlink: realpath differs from lexical
    const lexicalRoot = repoRoot;
    const canonicalRoot = await realpath(repoRoot);
    expect(canonicalRoot).not.toBe(lexicalRoot);

    const result = await resolveOrAllocateMLBShadowPreparationIdentity(
      repoRoot,
      'prep-001',
      714000,
      gen,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe('PERSISTED');
    }
    expect(ctx.genCalls).toBe(1);

    // Cleanup
    await rm(repoRoot, { recursive: true, force: true });
    await rm(realBase, { recursive: true, force: true });
    await rm(symBase, { force: true });
  });

  it('M2. namespace-level symlink is still rejected despite canonical-path fix', async () => {
    /*
     * The canonical-path fix must NOT weaken symlink rejection inside
     * the shadow-monitoring namespace. A symlink at any namespace
     * ancestor must still return SYMLINK_DETECTED.
     */
    const gen = makeGen();
    const realDir = await mkdtemp(join(tmpdir(), 'prep-id-ns-real-'));
    const nsDir = getNamespaceDir(realDir);
    await mkdir(nsDir, { recursive: true });

    // Replace the namespace directory with a symlink
    await rm(nsDir, { recursive: true, force: true });
    const realNsTarget = await mkdtemp(join(tmpdir(), 'prep-id-ns-target-'));
    await symlink(realNsTarget, nsDir, 'dir');

    const result = await resolveOrAllocateMLBShadowPreparationIdentity(
      realDir,
      'prep-001',
      714000,
      gen,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe('SYMLINK_DETECTED');
    }
    expect(ctx.genCalls).toBe(0);

    // Cleanup
    await rm(realDir, { recursive: true, force: true });
    await rm(realNsTarget, { recursive: true, force: true });
  });
});
