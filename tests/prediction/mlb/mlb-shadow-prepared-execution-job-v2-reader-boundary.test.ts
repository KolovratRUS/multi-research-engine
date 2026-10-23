/* -------------------------------------------------------------------------- */
/*  Boundary / sealing tests for the prepared-execution-job V2 reader          */
/*  Phase: P5F-C2A-R1 — reader-only (no execution, no store import, no writes) */
/* -------------------------------------------------------------------------- */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ML_DIR = join(__dirname, '../../../src/prediction/mlb');
const SRC_ROOT = join(__dirname, '../../../src');

const READER_SOURCE = join(
  ML_DIR,
  'mlb-shadow-prepared-execution-job-v2-reader.ts',
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
  const re = /import\s+(?:type\s+)?[^'"]+\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    sources.push(match[1]);
  }
  const se = /import\s+['"]([^'"]+)['"]/g;
  while ((match = se.exec(content)) !== null) {
    sources.push(match[1]);
  }
  return sources;
}

/* -------------------------------------------------------------------------- */
/*  Allowed direct project imports for the reader — EXACTLY:                    */
/*  - the prepared contract                                                   */
/*  - the shadow-monitoring namespace module                                  */
/* -------------------------------------------------------------------------- */
const ALLOWED_READER_PROJECT_IMPORTS: ReadonlySet<string> = new Set([
  './mlb-shadow-prepared-execution-job-v2-contract',
  './mlb-shadow-monitoring-namespace',
]);

/* -------------------------------------------------------------------------- */
/*  Allowed Node core modules for the reader — ONLY:                           */
/*  node:crypto, node:fs, node:fs/promises, node:path                          */
/* -------------------------------------------------------------------------- */
const ALLOWED_NODE_IMPORTS: ReadonlySet<string> = new Set([
  'node:crypto',
  'node:fs',
  'node:fs/promises',
  'node:path',
]);

/* -------------------------------------------------------------------------- */
/*  Prohibited import substrings — must NEVER appear in reader import sources.  */
/* -------------------------------------------------------------------------- */
const PROHIBITED_IMPORT_SUBSTRINGS: ReadonlyArray<string> = [
  'mlb-shadow-execution-adapter-v2',
  'mlb-shadow-execution-job-v2-contract',
  'mlb-shadow-prepared-execution-job-v2-store',
  'mlb-shadow-monitoring-persistence-orchestrator-v2',
  'mlb-shadow-monitoring-prediction-orchestrator-v2',
  'mlb-shadow-monitoring-prediction-computation-v2',
  'mlb-shadow-monitoring-prediction-store',
  'mlb-shadow-monitoring-operational-store',
  'mlb-shadow-candidate-003-authorized-model-artifact',
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
/*  Prohibited execution / prediction call patterns in reader source.           */
/* -------------------------------------------------------------------------- */
const PROHIBITED_CALL_PATTERNS: ReadonlyArray<RegExp> = [
  /executeMLBShadowExecutionJobV2\s*\(/,
  /runMLBShadowExecutionJobV2\s*\(/,
  /computeMLBShadowPrediction\s*\(/,
  /fitMLBShadow\s*\(/,
  /persistMLBShadowPreparedExecutionJobV2\s*\(/,
];

const EXPECTED_READER_STATUSES: ReadonlyArray<string> = [
  'READ_OK',
  'SHADOW_RECORD_ID_INVALID',
  'REPO_ROOT_INVALID',
  'NOT_FOUND',
  'SYMLINK_DETECTED',
  'NON_DIRECTORY_TARGET',
  'READ_ERROR',
  'MALFORMED_UTF8',
  'MALFORMED_JSON',
  'PREPARED_CONTRACT_VALIDATION_FAILED',
  'NONCANONICAL_BYTES',
  'SHADOW_RECORD_ID_MISMATCH',
  'UNKNOWN_FAILURE',
];

describe('mlb-shadow-prepared-execution-job-v2-reader boundary', () => {
  /* ---------------------------------------------------------------------- */
  /*  A. Reader file exists and exports the required symbols                 */
  /* ---------------------------------------------------------------------- */

  it('A1. reader file exists in src/prediction/mlb', () => {
    const files = walk(SRC_ROOT).map((f) => f.replace(/.*\//, ''));
    expect(
      files.some((f) =>
        f.includes('mlb-shadow-prepared-execution-job-v2-reader'),
      ),
    ).toBe(true);
  });

  it('A2. reader exports the exact version constant and reader function', () => {
    const source = readFileSync(READER_SOURCE, 'utf8');
    expect(source).toContain(
      'mlb-shadow-prepared-execution-job-v2-reader-v1',
    );
    expect(source).toContain(
      'export const MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_READER_VERSION',
    );
    expect(source).toContain(
      'export async function readMLBShadowPreparedExecutionJobV2',
    );
    // Whitespace-tolerant: normalize all whitespace runs to a single space
    // so the assertion is robust to source indentation/newline layout while
    // still proving exact field ordering + values for both result surfaces.
    const normalized = source.replace(/\s+/g, ' ');
    expect(normalized).toContain(
      'ok: false, readerVersion: MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_READER_VERSION, status,',
    );
    expect(normalized).toContain(
      "ok: true, readerVersion: MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_READER_VERSION, status: 'READ_OK', value: validation.value,",
    );
  });

  /* ---------------------------------------------------------------------- */
  /*  B. Reader imports ONLY allowed project modules                        */
  /* ---------------------------------------------------------------------- */

  it('B1. reader imports exactly the allowed project modules', () => {
    const source = readFileSync(READER_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    const projectImports = imports.filter(
      (s) => s.startsWith('./') || s.startsWith('@/'),
    );
    // No disallowed project module
    const disallowed = projectImports.filter(
      (s) => !ALLOWED_READER_PROJECT_IMPORTS.has(s),
    );
    expect(disallowed).toEqual([]);
    // And the two allowed modules are actually present
    expect(projectImports).toContain(
      './mlb-shadow-prepared-execution-job-v2-contract',
    );
    expect(projectImports).toContain(
      './mlb-shadow-monitoring-namespace',
    );
  });

  /* ---------------------------------------------------------------------- */
  /*  C. Reader imports ONLY allowed Node core modules                      */
  /* ---------------------------------------------------------------------- */

  it('C1. reader node imports are within the allowlist', () => {
    const source = readFileSync(READER_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    const nodeImports = imports.filter(
      (s) =>
        s.startsWith('node:') ||
        (s.startsWith('fs') && s === 'fs') ||
        (s.startsWith('path') && s === 'path') ||
        (s.startsWith('crypto') && s === 'crypto'),
    );
    const disallowed = nodeImports.filter(
      (s) => !ALLOWED_NODE_IMPORTS.has(s),
    );
    expect(disallowed).toEqual([]);
  });

  it('C2. reader does NOT import prohibited modules', () => {
    const source = readFileSync(READER_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    const hits = imports.filter((s) =>
      PROHIBITED_IMPORT_SUBSTRINGS.some((p) => s.includes(p)),
    );
    expect(hits).toEqual([]);
  });

  it('C3. reader does NOT import network libraries', () => {
    const source = readFileSync(READER_SOURCE, 'utf8');
    expect(source).not.toContain('axios');
    expect(source).not.toContain('undici');
    expect(source).not.toContain('from "node:http"');
    expect(source).not.toContain("from 'node:http'");
    expect(source).not.toContain('from "node:https"');
    expect(source).not.toContain("from 'node:https'");
    expect(source).not.toMatch(/fetch\s*\(/);
  });

  it('C4. reader contains NO prohibited execution/prediction call-outs', () => {
    const source = readFileSync(READER_SOURCE, 'utf8');
    for (const pattern of PROHIBITED_CALL_PATTERNS) {
      expect(source).not.toMatch(pattern);
    }
  });

  /* ---------------------------------------------------------------------- */
  /*  D. Reader has no clock / randomness                                   */
  /* ---------------------------------------------------------------------- */

  it('D1. reader has no clock reads', () => {
    const source = readFileSync(READER_SOURCE, 'utf8');
    expect(source).not.toMatch(/Date\.now\s*\(/);
    expect(source).not.toMatch(/new\s+Date\s*\(/);
    expect(source).not.toMatch(/performance\.now/);
  });

  it('D2. reader has no randomness', () => {
    const source = readFileSync(READER_SOURCE, 'utf8');
    expect(source).not.toMatch(/Math\.random\s*\(/);
    expect(source).not.toMatch(/randomUUID/);
    expect(source).not.toMatch(/randomBytes/);
  });

  /* ---------------------------------------------------------------------- */
  /*  E. Reader has no filesystem WRITE primitives; opens read-only         */
  /* ---------------------------------------------------------------------- */

  it('E1. reader uses O_RDONLY | O_NOFOLLOW for the final open', () => {
    const source = readFileSync(READER_SOURCE, 'utf8');
    expect(source).toMatch(/O_RDONLY/);
    expect(source).toMatch(/O_NOFOLLOW/);
    expect(source).toMatch(/O_RDONLY\s*\|\s*O_NOFOLLOW/);
  });

  it('E2. reader contains NO write primitives', () => {
    const source = readFileSync(READER_SOURCE, 'utf8');
    const prohibitedWriteTokens = [
      'mkdir',
      'writeFile',
      'appendFile',
      'rmdir',
      'rm(',
      'unlink',
      'fs.link',
      'fs.symlink',
      'rename',
      'chmod',
      'chown',
      'utimes',
      'truncate',
      'fsync',
      'fdatasync',
    ];
    for (const token of prohibitedWriteTokens) {
      expect(source).not.toContain(token);
    }
    // No writable open flags anywhere.
    expect(source).not.toMatch(/open\([^)]*['"][wWxX]/);
    expect(source).not.toMatch(/flags\s*[:=]\s*['"][wW][xX]?/);
  });

  it('E3. reader only uses read-only fs operations', () => {
    const source = readFileSync(READER_SOURCE, 'utf8');
    // Allowed read-only operations.
    expect(source).toMatch(/(lstat|stat|open|readFile|realpath|close)/);
  });

  /* ---------------------------------------------------------------------- */
  /*  F. Reader security invariants (source-level proof)                    */
  /* ---------------------------------------------------------------------- */

  it('F1. raw bytes originate from an open FileHandle', () => {
    const source = readFileSync(READER_SOURCE, 'utf8');
    expect(source).toMatch(/await\s+handle\.readFile\(\)/);
  });

  it('F2. fatal UTF-8 decoder present', () => {
    const source = readFileSync(READER_SOURCE, 'utf8');
    expect(source).toContain("new TextDecoder('utf-8'");
    expect(source).toMatch(/fatal\s*:\s*true/);
  });

  it('F3. canonical Buffer.equals check present', () => {
    const source = readFileSync(READER_SOURCE, 'utf8');
    expect(source).toContain('Buffer.from');
    expect(source).toMatch(/canonicalBuffer\.equals\(/);
  });

  it('F4. DIRECT content identity (not hash-only) is enforced', () => {
    const source = readFileSync(READER_SOURCE, 'utf8');
    // The reader must compare the parsed value's shadowRecordId directly.
    expect(source).toMatch(
      /validation\.value\.shadowRecordId\s*!==\s*shadowRecordId/,
    );
    // The SHA-256 must be used ONLY for the filename, never as a content-
    // identity substitute. Proven in two parts because production source
    // legitimately separates digest calculation from filename construction.
    // A. Storage digest derivation: createHash('sha256').update(.,'utf-8').digest('hex')
    expect(source).toMatch(
      /createHash\(['"]sha256['"]\)\.update\([^,]+,\s*['"]utf-8['"]\)\.digest\(['"]hex['"]\)/,
    );
    // B. Final artifact filename is formed from that digest helper + '.json',
    //    NOT from the raw shadowRecordId and NOT from a separate hash call.
    expect(source).toMatch(
      /sha256Hex\(shadowRecordId\)\s*\+\s*['"]\.json['"]/,
    );
  });

  it('F5. reader does NOT use the SHA hash as content identity', () => {
    const source = readFileSync(READER_SOURCE, 'utf8');
    // There must be no path/identity comparison based on hash equality of the
    // record id. The only equality check on shadowRecordId is the direct one.
    const hashIdentityPatterns = [
      /sha256Hex\(shadowRecordId\)\s*===\s*sha256Hex\(/,
      /hash.*===.*hash/,
    ];
    for (const p of hashIdentityPatterns) {
      expect(source).not.toMatch(p);
    }
  });

  it('F6. pre-open / post-open dev+ino identity guard present', () => {
    const source = readFileSync(READER_SOURCE, 'utf8');
    expect(source).toMatch(/bigint:\s*true/);
    expect(source).toMatch(/fdStat\.dev\s*!==\s*pre/);
    expect(source).toMatch(/fdStat\.ino/);
  });

  /* ---------------------------------------------------------------------- */
  /*  G. Finite, exact status set                                           */
  /* ---------------------------------------------------------------------- */

  it('G1. reader exposes exactly the 13 sealed statuses', () => {
    const source = readFileSync(READER_SOURCE, 'utf8');
    // Extract the region spanning the FailureStatus + Status type declarations.
    const start = source.indexOf(
      'export type MLBShadowPreparedExecutionJobV2ReaderFailureStatus',
    );
    expect(start).toBeGreaterThanOrEqual(0);
    const resultTypeIdx = source.indexOf(
      'export type MLBShadowPreparedExecutionJobV2ReaderResult',
    );
    expect(resultTypeIdx).toBeGreaterThan(start);
    const region = source.slice(start, resultTypeIdx);
    const literalRe = /'([^']+)'/g;
    const found = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = literalRe.exec(region)) !== null) {
      found.add(m[1]);
    }
    for (const s of EXPECTED_READER_STATUSES) {
      expect(found.has(s)).toBe(true);
    }
    // No extra statuses beyond the expected 13.
    expect(found.size).toBe(EXPECTED_READER_STATUSES.length);
  });

  /* ---------------------------------------------------------------------- */
  /*  H. Failure result contains no identity/path/payload/error             */
  /* ---------------------------------------------------------------------- */

  it('H1. failReader returns only ok/readerVersion/status', () => {
    const source = readFileSync(READER_SOURCE, 'utf8');
    const start = source.indexOf('function failReader');
    expect(start).toBeGreaterThanOrEqual(0);
    const end = source.indexOf('\n}\n', start);
    const fnBody = source.slice(start, end);
    const keys = (fnBody.match(/(ok|readerVersion|status|shadowRecordId|repoRoot|path|value|error|errno|stack|bytes|root)\s*:/g) || []);
    const leaked = keys.filter(
      (k) => !['ok:', 'readerVersion:', 'status:'].includes(k),
    );
    expect(leaked).toEqual([]);
  });

  /* ---------------------------------------------------------------------- */
  /*  I. No production module imports the reader                            */
  /* ---------------------------------------------------------------------- */

  it('I1. exactly two authorized production importers of the reader under src/', () => {
    const readerAuthorizedImporter = join(
      ML_DIR,
      'mlb-shadow-prepared-execution-job-v2-handoff.ts',
    );
    const eligibilityImporter = join(
      ML_DIR,
      'mlb-shadow-prepared-job-dispatch-eligibility.ts',
    );
    const allFiles = walk(SRC_ROOT);
    const readerImporters: string[] = [];
    for (const file of allFiles) {
      const content = readFileSync(file, 'utf8');
      const imports = extractImportSources(content);
      const readerImports = imports.filter((s) =>
        s.includes('mlb-shadow-prepared-execution-job-v2-reader'),
      );
      if (readerImports.length > 0) {
        readerImporters.push(file);
      }
    }
    expect(readerImporters.sort()).toEqual(
      [readerAuthorizedImporter, eligibilityImporter].sort(),
    );
  });

  it('I2. no CLI / scheduler / orchestrator / adapter imports the reader', () => {
    const allFiles = walk(SRC_ROOT);
    for (const file of allFiles) {
      const relativeName = file.replace(/.*\//, '');
      const isLifecycle =
        relativeName.toLowerCase().includes('cli') ||
        relativeName.toLowerCase().includes('command') ||
        relativeName.toLowerCase().includes('scheduler') ||
        relativeName.toLowerCase().includes('cron') ||
        relativeName.toLowerCase().includes('orchestrator') ||
        relativeName.toLowerCase().includes('adapter') ||
        relativeName.toLowerCase().includes('factory');
      if (!isLifecycle) continue;
      const content = readFileSync(file, 'utf8');
      expect(content).not.toContain(
        'mlb-shadow-prepared-execution-job-v2-reader',
      );
    }
  });
});
