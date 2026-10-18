/* -------------------------------------------------------------------------- */
/*  Boundary / sealing tests for the prepared-execution-job V2 store           */
/*  Phase: C1B — quarantine write-once prepared-job store (dormant)              */
/* -------------------------------------------------------------------------- */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ML_DIR = join(__dirname, '../../../src/prediction/mlb');
const SRC_ROOT = join(__dirname, '../../../src');

const STORE_SOURCE = join(
  ML_DIR,
  'mlb-shadow-prepared-execution-job-v2-store.ts',
);

/* -------------------------------------------------------------------------- */
/*  Walk a directory recursively for .ts files (excludes .d.ts).              */
/* -------------------------------------------------------------------------- */
function walk(dir: string, files: string[] = []): string[] {
  const list = readdirSync(dir);
  for (const entry of list) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, files);
    } else if (
      full.endsWith('.ts') &&
      !full.endsWith('.d.ts')
    ) {
      files.push(full);
    }
  }
  return files;
}

/* -------------------------------------------------------------------------- */
/*  Extract all ES module import source paths from source text.                */
/* -------------------------------------------------------------------------- */
function extractImportSources(content: string): string[] {
  const sources: string[] = [];
  // Matches: import ... from '...'  (including `import type`, named, default, namespace)
  const re = /import\s+(?:type\s+)?[^'"]+\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    sources.push(match[1]);
  }
  // Matches side-effect-only imports: import '...'
  const se = /import\s+['"]([^'"]+)['"]/g;
  while ((match = se.exec(content)) !== null) {
    sources.push(match[1]);
  }
  return sources;
}

/* -------------------------------------------------------------------------- */
/*  Allowed direct imports for the prepared store.                              */
/*  Source-truth: the store may import the prepared contract, the namespace    */
/*  module, and Node core stdlib (fs, path, crypto).                            */
/* -------------------------------------------------------------------------- */
const ALLOWED_STORE_IMPORTS: ReadonlySet<string> = new Set([
  './mlb-shadow-prepared-execution-job-v2-contract',
  './mlb-shadow-monitoring-namespace',
  'node:fs/promises',
  'node:path',
  'node:crypto',
]);

/* -------------------------------------------------------------------------- */
/*  Prohibited import substrings — must NEVER appear in store import sources.   */
/* -------------------------------------------------------------------------- */
const PROHIBITED_IMPORT_SUBSTRINGS: ReadonlyArray<string> = [
  'mlb-shadow-candidate-003-authorized-model-artifact',
  'mlb-shadow-execution-adapter-v2',
  'mlb-shadow-monitoring-persistence-orchestrator-v2',
  'mlb-shadow-monitoring-prediction-orchestrator-v2',
  'mlb-shadow-monitoring-prediction-computation-v2',
  'mlb-shadow-monitoring-prediction-store',
  'mlb-shadow-monitoring-operational-store',
  'mlb-feature-vector-contract',
  'mlb-pregame-snapshot-contract',
  'mlb-real-pregame-winner-feature-manifest-v1',
  'mlb-logistic-regression-fit-contract',
  'mlb-shadow-model-fingerprint',
  'mlb-model-test-release-contract',
  'node:http',
  'node:https',
  'axios',
  'undici',
];

/* -------------------------------------------------------------------------- */
/*  Prohibited execution-function names in store source.                        */
/* -------------------------------------------------------------------------- */
const PROHIBITED_EXECUTE_PATTERNS: ReadonlyArray<string> = [
  'executeMLBShadowExecutionJobV2',
  'runMLBShadowExecutionJobV2',
  'computeMLBShadowPrediction',
  'evaluateMLBShadow',
  'fitMLBShadow',
];

describe('mlb-shadow-prepared-execution-job-v2-store boundary', () => {
  /* ---------------------------------------------------------------------- */
  /*  A. Store file exists and is importable                                  */
  /* ---------------------------------------------------------------------- */

  it('A1. prepared store file exists in src/prediction/mlb', () => {
    const files = walk(SRC_ROOT).map(
      (f) => f.replace(/.*\//, ''),
    );
    expect(
      files.some((f) =>
        f.includes('mlb-shadow-prepared-execution-job-v2-store'),
      ),
    ).toBe(true);
  });

  it('A2. store exports the version constant and persistence function', () => {
    const source = readFileSync(STORE_SOURCE, 'utf8');

    expect(source).toContain(
      'mlb-shadow-prepared-execution-job-v2-store-v1',
    );
    expect(source).toContain(
      'export const MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_STORE_VERSION',
    );
    expect(source).toContain(
      'export async function persistMLBShadowPreparedExecutionJobV2',
    );
  });

  /* ---------------------------------------------------------------------- */
  /*  B. Store imports only allowed modules                                   */
  /* ---------------------------------------------------------------------- */

  it('B1. store imports only allowed modules', () => {
    const source = readFileSync(STORE_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    const disallowed = imports.filter(
      (s) => !ALLOWED_STORE_IMPORTS.has(s),
    );
    expect(disallowed).toEqual([]);
  });

  it('B2. store does NOT import prohibited modules', () => {
    const source = readFileSync(STORE_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    const hits = imports.filter((s) =>
      PROHIBITED_IMPORT_SUBSTRINGS.some((p) => s.includes(p)),
    );
    expect(hits).toEqual([]);
  });

  it('B3. store does NOT import network libraries (fetch, axios, undici, http, https)', () => {
    const source = readFileSync(STORE_SOURCE, 'utf8');
    expect(source).not.toContain('axios');
    expect(source).not.toContain('undici');
    expect(source).not.toContain('from "node:http"');
    expect(source).not.toContain("from 'node:http'");
    expect(source).not.toContain('from "node:https"');
    expect(source).not.toContain("from 'node:https'");
    expect(source).not.toMatch(/fetch\s*\(/);
  });

  /* ---------------------------------------------------------------------- */
  /*  C. Store has no clock reads                                            */
  /* ---------------------------------------------------------------------- */

  it('C1. store source has no Date.now', () => {
    const source = readFileSync(STORE_SOURCE, 'utf8');
    expect(source).not.toMatch(/Date\.now\s*\(/);
  });

  it('C2. store source has no new Date', () => {
    const source = readFileSync(STORE_SOURCE, 'utf8');
    expect(source).not.toMatch(/new\s+Date\s*\(/);
  });

  it('C3. store source has no Math.random', () => {
    const source = readFileSync(STORE_SOURCE, 'utf8');
    expect(source).not.toMatch(/Math\.random\s*\(/);
  });

  it('C4. store source has no performance.now', () => {
    const source = readFileSync(STORE_SOURCE, 'utf8');
    expect(source).not.toMatch(/performance\.now/);
  });

  it('C5. store uses randomUUID only for temp filename, not in canonical bytes', () => {
    const source = readFileSync(STORE_SOURCE, 'utf8');
    // randomUUID is allowed for temp file naming
    expect(source).toMatch(/randomUUID/);
    // But MUST NOT appear in buildCanonicalBytes function
    const canonicalStart = source.indexOf('function buildCanonicalBytes');
    const canonicalEnd = source.indexOf('\n}\n', canonicalStart);
    const canonicalSection = source.slice(canonicalStart, canonicalEnd);
    expect(canonicalSection).not.toMatch(/randomUUID/);
    expect(canonicalSection).not.toMatch(/Date\.now/);
    expect(canonicalSection).not.toMatch(/new Date/);
    expect(canonicalSection).not.toMatch(/Math\.random/);
    expect(canonicalSection).not.toMatch(/performance\.now/);
  });

  /* ---------------------------------------------------------------------- */
  /*  D. Store does NOT export a public reader                                */
  /* ---------------------------------------------------------------------- */

  it('D1. store does not export a reader function', () => {
    const source = readFileSync(STORE_SOURCE, 'utf8');

    const exportFnRegex = /export\s+(?:async\s+)?function\s+(\w+)/g;
    let match: RegExpExecArray | null;
    const exportedFns: string[] = [];
    while ((match = exportFnRegex.exec(source)) !== null) {
      exportedFns.push(match[1]);
    }

    for (const fn of exportedFns) {
      expect(fn.toLowerCase()).not.toMatch(/read|get/);
    }

    const exportConstRegex = /export\s+const\s+(\w+)/g;
    while ((match = exportConstRegex.exec(source)) !== null) {
      const name = match[1];
      expect(name.toLowerCase()).not.toMatch(/read|get/);
    }
  });

  it('D2. store does NOT call any execution function', () => {
    const source = readFileSync(STORE_SOURCE, 'utf8');
    for (const pattern of PROHIBITED_EXECUTE_PATTERNS) {
      expect(source).not.toContain(pattern);
    }
  });

  /* ---------------------------------------------------------------------- */
  /*  E. No production source imports the prepared store (dormancy)           */
  /* ---------------------------------------------------------------------- */

  it('E1. exactly one production source imports the prepared store — the preparation producer', () => {
    const allFiles = walk(SRC_ROOT);
    const importers: string[] = [];

    for (const file of allFiles) {
      // Skip the store file itself
      if (file === STORE_SOURCE) {
        continue;
      }
      const content = readFileSync(file, 'utf8');
      const imports = extractImportSources(content);
      const storeImports = imports.filter(
        (s) =>
          s.includes('mlb-shadow-prepared-execution-job-v2-store'),
      );
      if (storeImports.length > 0) {
        importers.push(file);
      }
    }

    // EXACTLY ONE production importer of the prepared store:
    // the dormant preparation producer.
    expect(importers).toEqual([
      join(
        ML_DIR,
        'mlb-shadow-prepared-execution-job-v2-preparation.ts',
      ),
    ]);
  });

  it('E2. no CLI file imports the prepared store', () => {
    const allFiles = walk(SRC_ROOT);
    for (const file of allFiles) {
      if (file === STORE_SOURCE) continue;
      const relativePath = file.replace(/.*\//, '');
      // Check CLI-related files
      if (
        relativePath.toLowerCase().includes('cli') ||
        file.toLowerCase().includes('/cli/') ||
        relativePath.toLowerCase().includes('command')
      ) {
        const content = readFileSync(file, 'utf8');
        expect(content).not.toContain(
          'mlb-shadow-prepared-execution-job-v2-store',
        );
      }
    }
  });

  it('E3. no scheduler file imports the prepared store', () => {
    const allFiles = walk(SRC_ROOT);
    for (const file of allFiles) {
      if (file === STORE_SOURCE) continue;
      const relativePath = file.replace(/.*\//, '');
      if (
        relativePath.toLowerCase().includes('scheduler') ||
        relativePath.toLowerCase().includes('cron')
      ) {
        const content = readFileSync(file, 'utf8');
        expect(content).not.toContain(
          'mlb-shadow-prepared-execution-job-v2-store',
        );
      }
    }
  });

  it('E4. no adapter file imports the prepared store', () => {
    const allFiles = walk(SRC_ROOT);
    for (const file of allFiles) {
      if (file === STORE_SOURCE) continue;
      const relativePath = file.replace(/.*\//, '');
      if (
        relativePath.toLowerCase().includes('adapter') ||
        file.toLowerCase().includes('/adapter/')
      ) {
        const content = readFileSync(file, 'utf8');
        expect(content).not.toContain(
          'mlb-shadow-prepared-execution-job-v2-store',
        );
      }
    }
  });

  it('E5. no orchestrator file imports the prepared store', () => {
    const allFiles = walk(SRC_ROOT);
    for (const file of allFiles) {
      if (file === STORE_SOURCE) continue;
      const relativePath = file.replace(/.*\//, '');
      if (relativePath.toLowerCase().includes('orchestrator')) {
        const content = readFileSync(file, 'utf8');
        expect(content).not.toContain(
          'mlb-shadow-prepared-execution-job-v2-store',
        );
      }
    }
  });

  it('E6. no factory/preparation file imports the prepared store (except authorized producer)', () => {
    const allFiles = walk(SRC_ROOT);
    const preparedProducerSource = join(
      ML_DIR,
      'mlb-shadow-prepared-execution-job-v2-preparation.ts',
    );
    for (const file of allFiles) {
      if (file === STORE_SOURCE) continue;
      const relativePath = file.replace(/.*\//, '');
      if (
        relativePath.toLowerCase().includes('factory') ||
        relativePath.toLowerCase().includes('preparation')
      ) {
        // Authorized exception: the preparation producer is the one sanctioned
        // importer of the prepared store. All other factory/preparation files
        // remain prohibited.
        if (file === preparedProducerSource) continue;
        const content = readFileSync(file, 'utf8');
        expect(content).not.toContain(
          'mlb-shadow-prepared-execution-job-v2-store',
        );
      }
    }
  });

  /* ---------------------------------------------------------------------- */
  /*  F. Store does NOT embed sensitive scientific fields in result type      */
  /* ---------------------------------------------------------------------- */

  it('F1. store result type does not include preparedJob, model artifact, or snapshot in success path', () => {
    const source = readFileSync(STORE_SOURCE, 'utf8');

    // The result type must NOT include fields like preparedJob,
    // authorizedModelArtifact, featureManifest, snapshot, gamePk
    // in its type definition.
    // (gamePk is excluded per the spec's preferred result fields.)
    // We verify by checking the result-type unions don't include these.
    const successResultSection = source.slice(
      source.indexOf('ok: true'),
      source.indexOf('ok: false'),
    );
    expect(successResultSection).not.toMatch(/preparedJob/);
    expect(successResultSection).not.toMatch(/authorizedModelArtifact/);
    expect(successResultSection).not.toMatch(/featureManifest/);
    expect(successResultSection).not.toMatch(/snapshot/);
    expect(successResultSection).not.toMatch(/gamePk/);
  });

  /* ---------------------------------------------------------------------- */
  /*  G. Store does NOT embed storeVersion or payloadHash in artifact bytes  */
  /* ---------------------------------------------------------------------- */

  it('G1. buildCanonicalBytes does not include storeVersion or payloadHash', () => {
    const source = readFileSync(STORE_SOURCE, 'utf8');

    const canonicalStart = source.indexOf('function buildCanonicalBytes');
    const canonicalEnd = source.indexOf('\n}\n', canonicalStart);
    const canonicalSection = source.slice(canonicalStart, canonicalEnd);

    expect(canonicalSection).not.toMatch(/storeVersion/);
    expect(canonicalSection).not.toMatch(/payloadHash/);
    expect(canonicalSection).not.toMatch(/repoRoot/);
    expect(canonicalSection).not.toMatch(/contractVersion/);
  });

  /* ---------------------------------------------------------------------- */
  /*  H. Store uses hard-link finalization (not rename or replace)           */
  /* ---------------------------------------------------------------------- */

  it('H1. store uses fs.link for finalization (not rename or replace)', () => {
    const source = readFileSync(STORE_SOURCE, 'utf8');

    // Must use fs.link for finalization
    expect(source).toMatch(/fs\.link\(/);

    // Must NOT use fs.rename, fs.renameSync, or fs.replace
    expect(source).not.toMatch(/fs\.rename\b/);
    expect(source).not.toMatch(/fs\.renameSync\b/);
    expect(source).not.toMatch(/fs\.replace\b/);

    // Must NOT use fs.rmdir or fs.rm on the final artifact
    expect(source).not.toMatch(/finalPath.*\bfs\.rm\b/);
    expect(source).not.toMatch(/finalPath.*\bfs\.unlink\b/);
  });

  /* ---------------------------------------------------------------------- */
  /*  I. Store uses O_EXCL temp file creation                                */
  /* ---------------------------------------------------------------------- */

  it('I1. store uses wx (O_EXCL) mode for temp file creation', () => {
    const source = readFileSync(STORE_SOURCE, 'utf8');

    // Must use 'wx' flag for exclusive temp creation
    expect(source).toMatch(/'wx'/)
    // Must NOT use 'w' or 'w+' for temp creation
    expect(source).not.toMatch(/open\([^)]*'w'\)/);
  });

  /* ---------------------------------------------------------------------- */
  /*  J. Store uses SHA-256(shadowRecordId) as the sole filename component    */
  /* ---------------------------------------------------------------------- */

  it('J1. filename is derived solely from SHA-256(shadowRecordId)', () => {
    const source = readFileSync(STORE_SOURCE, 'utf8');

    // Must use createHash('sha256') for the filename
    expect(source).toMatch(/createHash\(['"]sha256['"]\)/);

    // Must update with shadowRecordId
    expect(source).toMatch(/update\(validated\.shadowRecordId/);

    // Must NOT use gamePk in filename
    expect(source).not.toMatch(/\.shadowRecordId.*\.gamePk.*filename/i);

    // The artifact filename must be hex + '.json'
    expect(source).toMatch(/digest\(['"]hex['"]\).+\.json/);
  });

  /* ---------------------------------------------------------------------- */
  /*  K. Store validates before any filesystem mutation                       */
  /* ---------------------------------------------------------------------- */

  it('K1. validation call precedes all filesystem operations within the persist function', () => {
    const source = readFileSync(STORE_SOURCE, 'utf8');

    // Extract the persistMLBShadowPreparedExecutionJobV2 function body
    const fnStart = source.indexOf(
      'export async function persistMLBShadowPreparedExecutionJobV2',
    );
    expect(fnStart).toBeGreaterThanOrEqual(0);

    const fnBodyStart = source.indexOf('{', fnStart);
    // Find the matching closing brace (top-level function body, not nested)
    let depth = 1;
    let fnBodyEnd = fnBodyStart + 1;
    while (depth > 0 && fnBodyEnd < source.length) {
      if (source[fnBodyEnd] === '{') depth++;
      if (source[fnBodyEnd] === '}') depth--;
      fnBodyEnd++;
    }
    const fnBody = source.slice(fnBodyStart, fnBodyEnd);

    const validateIndex = fnBody.indexOf(
      'validateMLBShadowPreparedExecutionJobV2(',
    );

    // Find first fs operation within the function body only
    const fsOps = [
      'fs.mkdir',
      'fs.open',
      'fs.link',
      'fs.realpath',
      'fs.lstat',
      'fs.writeFile',
      'fs.stat',
    ].map((op) => fnBody.indexOf(op)).filter((i) => i !== -1);
    const earliestFsOp = Math.min(...fsOps);

    expect(validateIndex).toBeGreaterThanOrEqual(0);
    expect(earliestFsOp).toBeGreaterThan(validateIndex);
  });
});
