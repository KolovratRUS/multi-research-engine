/* -------------------------------------------------------------------------- */
/*  Boundary / sealing tests for the prepared-job dispatch-eligibility gate     */
/*  Phase: P5F-C6 — read-only eligibility gate (no execution, no writes)        */
/* -------------------------------------------------------------------------- */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ML_DIR = join(__dirname, '../../../src/prediction/mlb');
const SRC_ROOT = join(__dirname, '../../../src');

const ELIGIBILITY_SOURCE = join(
  ML_DIR,
  'mlb-shadow-prepared-job-dispatch-eligibility.ts',
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
  const se = /import\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    sources.push(match[1]);
  }
  while ((match = se.exec(content)) !== null) {
    sources.push(match[1]);
  }
  return sources;
}

/* -------------------------------------------------------------------------- */
/*  Find all production files that import a given module substring.           */
/* -------------------------------------------------------------------------- */
function findImporters(moduleSubstring: string, excludeSelf: string = ''): string[] {
  const allFiles = walk(SRC_ROOT);
  const importers: string[] = [];
  for (const file of allFiles) {
    if (file === excludeSelf) continue;
    const content = readFileSync(file, 'utf8');
    const imports = extractImportSources(content);
    if (imports.some((s) => s.includes(moduleSubstring))) {
      importers.push(file);
    }
  }
  return importers.sort();
}

/* -------------------------------------------------------------------------- */
/*  Sealed file paths                                                          */
/* -------------------------------------------------------------------------- */
const HANDOFF_SOURCE = join(
  ML_DIR,
  'mlb-shadow-prepared-execution-job-v2-handoff.ts',
);
const READER_SOURCE = join(
  ML_DIR,
  'mlb-shadow-prepared-execution-job-v2-reader.ts',
);
const ADAPTER_SOURCE = join(
  ML_DIR,
  'mlb-shadow-execution-adapter-v2.ts',
);
const STORE_SOURCE = join(
  ML_DIR,
  'mlb-shadow-prepared-execution-job-v2-store.ts',
);
const PREPARATION_SOURCE = join(
  ML_DIR,
  'mlb-shadow-prepared-execution-job-v2-preparation.ts',
);
const ORCHESTRATOR_SOURCE = join(
  ML_DIR,
  'mlb-shadow-preparation-request-orchestrator.ts',
);
const CANDIDATE003_SOURCE = join(
  ML_DIR,
  'mlb-shadow-candidate-003-authorized-model-artifact.ts',
);
const CONTRACT_SOURCE = join(
  ML_DIR,
  'mlb-shadow-prepared-execution-job-v2-contract.ts',
);
const EXECUTION_JOB_CONTRACT_SOURCE = join(
  ML_DIR,
  'mlb-shadow-execution-job-v2-contract.ts',
);

/* -------------------------------------------------------------------------- */
/*  Sealed source file hashes (Section 16 — Seven frozen R3 source seals)     */
/* -------------------------------------------------------------------------- */
const SEALED_SOURCES: ReadonlyArray<{ name: string; path: string; sha256: string; bytes: number }> = [
  { name: 'preparation', path: PREPARATION_SOURCE, sha256: '297c42928d8577d0e7c6a487b84659b943fe64d55636089dbc4c45285a970340', bytes: 10186 },
  { name: 'contract', path: CONTRACT_SOURCE, sha256: '91c2e95d00c3675363afa04c1e39ef52daae01d3ef59f268ecfed5917f252a1b', bytes: 14344 },
  { name: 'store', path: STORE_SOURCE, sha256: 'b83c1a974d89d0cd354e177f2cb79bc463e21c09071e027e00572fa891343c2a', bytes: 24830 },
  { name: 'reader', path: READER_SOURCE, sha256: 'c3ddc65ea871959ec228a90c5f4e6b5ff9860b0f13cbae5262f96102833bb57e', bytes: 14601 },
  { name: 'handoff', path: HANDOFF_SOURCE, sha256: '31f0b0d1c6a453e1d41557887b67966538a51f5c525d4f6d4e17914245ca8871', bytes: 7351 },
  { name: 'execution-job-contract', path: EXECUTION_JOB_CONTRACT_SOURCE, sha256: '04a0a759dffbdf91491ede491c24ff4bedf772707194d700e62f929da08d69b6', bytes: 31363 },
  { name: 'candidate-003', path: CANDIDATE003_SOURCE, sha256: '5e86bfa80ffa0dc8319ddb48f72e1c63efa052750be7e993cf09dd30d2ae7e27', bytes: 34648 },
];

function computeSha256(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

/* -------------------------------------------------------------------------- */
/*  Prohibited import substrings for C6 source                                */
/* -------------------------------------------------------------------------- */
const PROHIBITED_IMPORTS: ReadonlyArray<string> = [
  'mlb-shadow-prepared-execution-job-v2-handoff',
  'mlb-shadow-execution-adapter-v2',
  'mlb-shadow-execution-job-v2-contract',
  'mlb-shadow-prepared-execution-job-v2-store',
  'mlb-shadow-preparation-request-orchestrator',
  'mlb-shadow-monitoring-persistence-orchestrator-v2',
  'mlb-shadow-monitoring-prediction-orchestrator-v2',
  'mlb-shadow-monitoring-prediction-computation-v2',
  'mlb-shadow-monitoring-prediction-store',
  'mlb-shadow-monitoring-operational-store',
  'mlb-shadow-monitoring-persistence-orchestrator',
  'mlb-shadow-monitoring-prediction-orchestrator',
  'mlb-feature-vector-contract',
  'mlb-pregame-snapshot-contract',
  'mlb-real-pregame-winner-feature-manifest-v1',
  'mlb-logistic-regression-fit-contract',
  'mlb-model-test-release-contract',
  'mlb-shadow-model-fingerprint',
  'mlb-inner-development-train-artifact',
  'mlb-inner-development-candidate-recipe',
  'mlb-outer-validation-promotion-contract',
  'mlb-prospective-holdout',
  'node:fs',
  'node:fs/promises',
  'node:crypto',
  'node:path',
  'node:http',
  'node:https',
  'node:os',
  'node:process',
  'node:cron',
  'axios',
  'undici',
  'bull',
  'bullmq',
  'agenda',
  'commander',
  'yargs',
];

/* -------------------------------------------------------------------------- */
/*  Prohibited execution / dispatch call patterns in C6 source                */
/* -------------------------------------------------------------------------- */
const PROHIBITED_CALL_PATTERNS: ReadonlyArray<string> = [
  'executeStoredMLBShadowPreparedExecutionJobV2',
  'executeMLBShadowExecutionJobV2',
  'computeMLBShadowPrediction',
  'computeMLBShadowQuarantinedPredictionV2',
  'runMLBShadowExecutionJobV2',
  'persistMLBShadowPreparedExecutionJobV2',
  'prepareMLBShadowPreparedExecutionJobV2',
  'orchestrateMLBShadow',
  'fitMLBShadow',
  'captureMLBShadow',
];

/* -------------------------------------------------------------------------- */
/*  Prohibited odds / sportsbook substrings in C6 source                      */
/* -------------------------------------------------------------------------- */
const PROHIBITED_ODDS_SUBSTRINGS: ReadonlyArray<string> = [
  'odds',
  'bookmaker',
  'market',
  'sportsbook',
  'implied',
  'edge',
  'value',
  'ev,',
];

/* -------------------------------------------------------------------------- */
/*  Allowed import source for C6 (the reader only)                           */
/* -------------------------------------------------------------------------- */
const ALLOWED_C6_PROJECT_IMPORTS: ReadonlySet<string> = new Set([
  './mlb-shadow-prepared-execution-job-v2-reader',
]);

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('mlb-shadow-prepared-job-dispatch-eligibility boundary', () => {
  let source: string;

  beforeAll(() => {
    source = readFileSync(ELIGIBILITY_SOURCE, 'utf8');
  });

  /* A1. file exists in src/prediction/mlb */
  it('A1. C6 source file exists in src/prediction/mlb', () => {
    const files = walk(SRC_ROOT).map((f) => f.replace(/.*\/\\/g, '').replace(/.*\//, ''));
    expect(
      files.some((f) =>
        f.includes('mlb-shadow-prepared-job-dispatch-eligibility'),
      ),
    ).toBe(true);
  });

  /* A2. exact exports */
  it('A2. exports exact version constant + function + result type', () => {
    expect(source).toContain(
      'mlb-shadow-prepared-job-dispatch-eligibility-v1',
    );
    expect(source).toContain(
      'export const MLB_SHADOW_PREPARED_JOB_DISPATCH_ELIGIBILITY_VERSION',
    );
    expect(source).toMatch(
      /export\s+async\s+function\s+checkPreparedJobDispatchReadiness\b/,
    );
    expect(source).toContain(
      'export type MLBShadowPreparedJobDispatchReadinessResult',
    );
  });

  /* A3. function signature: (repoRoot: string, shadowRecordId: string) */
  it('A3. checkPreparedJobDispatchReadiness signature matches (repoRoot, shadowRecordId)', () => {
    expect(source).toMatch(
      /export\s+async\s+function\s+checkPreparedJobDispatchReadiness\s*\(\s*repoRoot:\s*string\s*,\s*shadowRecordId:\s*string\s*,?\s*\)/,
    );
  });

  /* A4. result type uses kind discriminant: ELIGIBLE / NOT_ELIGIBLE */
  it('A4. result type uses exact kind literals: ELIGIBLE / NOT_ELIGIBLE', () => {
    expect(source).toContain("kind: 'ELIGIBLE'");
    expect(source).toContain("kind: 'NOT_ELIGIBLE'");
    // No misleading execution-authorized flag
    expect(source).not.toMatch(/authoriz/i);
    expect(source).not.toMatch(/dispatchAuthorized/i);
    expect(source).not.toMatch(/canExecute/i);
  });

  /* ------------------------------------------------------------------ */
  /* B. Import graph                                                     */
  /* ------------------------------------------------------------------ */

  /* B1. C6 imports exactly the reader (only allowed project import) */
  it('B1. C6 project imports are exactly: the reader', () => {
    const imports = extractImportSources(source);
    const projectImports = imports.filter(
      (s) => s.startsWith('./') || s.startsWith('@/'),
    );
    const disallowed = projectImports.filter(
      (s) => !ALLOWED_C6_PROJECT_IMPORTS.has(s),
    );
    expect(disallowed).toEqual([]);
    expect(projectImports).toContain(
      './mlb-shadow-prepared-execution-job-v2-reader',
    );
  });

  /* B2. reader import is NOT type-only (runtime function is called) */
  it('B2. reader import is NOT type-only (runtime import)', () => {
    expect(source).not.toMatch(
      /import type\s*\{[^}]*\}\s*from\s*['"]\.\/mlb-shadow-prepared-execution-job-v2-reader['"]/
    );
  });

  /* B3. no prohibited imports */
  it('B3. no prohibited import substrings', () => {
    const imports = extractImportSources(source);
    for (const imp of imports) {
      for (const prohibited of PROHIBITED_IMPORTS) {
        expect(imp.includes(prohibited)).toBe(false);
      }
    }
  });

  /* B4. no Node core imports at all */
  it('B4. no Node core module imports', () => {
    const imports = extractImportSources(source);
    expect(imports.some((s) => s.startsWith('node:'))).toBe(false);
  });

  /* B5. no network library imports */
  it('B5. no network library imports', () => {
    const imports = extractImportSources(source);
    expect(imports.some((s) => s.includes('axios'))).toBe(false);
    expect(imports.some((s) => s.includes('undici'))).toBe(false);
  });

  /* ------------------------------------------------------------------ */
  /* C. Source-level sealing                                             */
  /* ------------------------------------------------------------------ */

  /* C1. no write primitives */
  it('C1. no filesystem write primitives', () => {
    const prohibitedWriteTokens = [
      'mkdir',
      'writeFile',
      'appendFile',
      'rmdir',
      'unlink',
      'fs.link',
      'fs.symlink',
      'rename',
      'chmod',
      'chown',
      'utimes',
      'truncate',
    ];
    for (const token of prohibitedWriteTokens) {
      expect(source).not.toContain(token);
    }
    expect(source).not.toMatch(/open\([^)]*['"][wWxX]/);
    expect(source).not.toMatch(/flags\s*[:=]\s*['"][wW][xX]?/);
  });

  /* C2. no clock reads */
  it('C2. no clock reads', () => {
    expect(source).not.toMatch(/Date\.now\s*\(/);
    expect(source).not.toMatch(/new\s+Date\s*\(/);
    expect(source).not.toMatch(/performance\.now/);
  });

  /* C3. no randomness */
  it('C3. no randomness', () => {
    expect(source).not.toMatch(/Math\.random\s*\(/);
    expect(source).not.toMatch(/randomUUID/);
    expect(source).not.toMatch(/randomBytes/);
  });

  /* C4. no retry loops */
  it('C4. no retry loops', () => {
    expect(source).not.toMatch(/retry/i);
  });

  /* C5. reader called exactly once */
  it('C5. reader is called exactly once', () => {
    const matches = source.match(
      /readMLBShadowPreparedExecutionJobV2\(/g,
    );
    // 1 call site only (the import does not contain a '(' after the name).
    expect(matches).toHaveLength(1);
  });

  /* C6. no hidden dispatch / execution / persistence calls */
  it('C6. no hidden dispatch / execution / persistence calls', () => {
    for (const pattern of PROHIBITED_CALL_PATTERNS) {
      expect(source).not.toContain(pattern);
    }
  });

  /* C7. no fetch / network */
  it('C7. no fetch or network calls', () => {
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/axios/);
    expect(source).not.toMatch(/undici/);
    expect(source).not.toMatch(/from\s+['"]node:http['"]/);
    expect(source).not.toMatch(/from\s+['"]node:https['"]/);
  });

  /* C8. no odds / sportsbook / market substrings */
  it('C8. no odds / sportsbook / market fields', () => {
    const lowerSource = source.toLowerCase();
    for (const sub of PROHIBITED_ODDS_SUBSTRINGS) {
      expect(lowerSource).not.toContain(sub.toLowerCase());
    }
  });

  /* C9. no CLI / scheduler references */
  it('C9. no CLI / scheduler references', () => {
    expect(source).not.toMatch(/commander|yargs|\bcli\b/i);
    expect(source).not.toMatch(/cron|scheduler|bull/i);
  });

  /* C10. result envelopes are readonly + frozen */
  it('C10. result type uses Readonly<...> envelope', () => {
    const normalized = source.replace(/\s+/g, ' ');
    expect(normalized).toMatch(/Readonly<\{[^}]*kind: 'ELIGIBLE'[^}]*\}>/);
    expect(normalized).toMatch(/Readonly<\{[^}]*kind: 'NOT_ELIGIBLE'[^}]*\}>/);
  });

  /* C11. Object.freeze used for both branches */
  it('C11. Object.freeze used for both envelope branches', () => {
    const freezeMatches = source.match(/Object\.freeze/g);
    expect(freezeMatches).not.toBeNull();
    expect(freezeMatches!.length).toBeGreaterThanOrEqual(2);
  });

  /* ------------------------------------------------------------------ */
  /* D. Production importers of C6 = ZERO                                */
  /* ------------------------------------------------------------------ */

  it('D1. C6 has zero production importers under src/', () => {
    const importers = findImporters(
      'mlb-shadow-prepared-job-dispatch-eligibility',
      ELIGIBILITY_SOURCE,
    );
    expect(importers).toEqual([]);
  });

  /* ------------------------------------------------------------------ */
  /* E. Reader importers = exactly handoff + C6                          */
  /* ------------------------------------------------------------------ */

  it('E1. reader has exactly two production importers: handoff + C6', () => {
    const importers = findImporters(
      'mlb-shadow-prepared-execution-job-v2-reader',
      READER_SOURCE,
    );
    expect(importers).toEqual([HANDOFF_SOURCE, ELIGIBILITY_SOURCE]);
  });

  /* ------------------------------------------------------------------ */
  /* F. C5 orchestration remains dormant (C5 does not import C6)         */
  /* ------------------------------------------------------------------ */

  it('F1. C5 orchestrator does NOT import C6', () => {
    const exists = existsSync(ORCHESTRATOR_SOURCE);
    if (!exists) {
      expect(true).toBe(true);
      return;
    }
    const content = readFileSync(ORCHESTRATOR_SOURCE, 'utf8');
    const imports = extractImportSources(content);
    expect(
      imports.some((s) =>
        s.includes('mlb-shadow-prepared-job-dispatch-eligibility'),
      ),
    ).toBe(false);
  });

  /* ------------------------------------------------------------------ */
  /* G. C3 preparation remains C5-only (no new importers)                 */
  /* ------------------------------------------------------------------ */

  it('G1. C3 preparation producer has exactly one importer: C5 orchestrator', () => {
    const importers = findImporters(
      'mlb-shadow-prepared-execution-job-v2-preparation',
      PREPARATION_SOURCE,
    );
    expect(importers).toEqual([ORCHESTRATOR_SOURCE]);
  });

  /* ------------------------------------------------------------------ */
  /* H. Handoff remains dormant (zero production importers)              */
  /* ------------------------------------------------------------------ */

  it('H1. handoff has zero production importers', () => {
    const importers = findImporters(
      'mlb-shadow-prepared-execution-job-v2-handoff',
      HANDOFF_SOURCE,
    );
    expect(importers).toEqual([]);
  });

  it('H2. handoff execute function has zero production callers', () => {
    const allFiles = walk(SRC_ROOT);
    const callers: string[] = [];
    for (const file of allFiles) {
      if (file === HANDOFF_SOURCE) continue;
      const content = readFileSync(file, 'utf8');
      if (content.includes('executeStoredMLBShadowPreparedExecutionJobV2(')) {
        callers.push(file);
      }
    }
    expect(callers).toEqual([]);
  });

  /* ------------------------------------------------------------------ */
  /* I. Seven sealed source files unchanged (SHA256 + bytes)             */
  /* ------------------------------------------------------------------ */

  it('I1. all seven sealed source files have unchanged SHA256 and byte count', () => {
    for (const sealed of SEALED_SOURCES) {
      expect(existsSync(sealed.path)).toBe(true);
      const hash = computeSha256(sealed.path);
      const bytes = statSync(sealed.path).size;
      expect(hash).toBe(sealed.sha256);
      expect(bytes).toBe(sealed.bytes);
    }
  });

  /* ------------------------------------------------------------------ */
  /* J. No adapter / persistence / prediction-computation import         */
  /* ------------------------------------------------------------------ */

  it('J1. C6 does not import adapter', () => {
    expect(source).not.toContain('mlb-shadow-execution-adapter-v2');
  });

  it('J2. C6 does not import persistence orchestrator', () => {
    expect(source).not.toContain('mlb-shadow-monitoring-persistence-orchestrator');
  });

  it('J3. C6 does not import prediction-computation', () => {
    expect(source).not.toContain('mlb-shadow-monitoring-prediction-computation-v2');
  });

  it('J4. C6 does not import prediction orchestrator', () => {
    expect(source).not.toContain('mlb-shadow-monitoring-prediction-orchestrator');
  });

  it('J5. C6 does not import prepared store', () => {
    expect(source).not.toContain('mlb-shadow-prepared-execution-job-v2-store');
  });

  it('J6. C6 does not import preparation producer', () => {
    expect(source).not.toContain('mlb-shadow-prepared-execution-job-v2-preparation');
  });

  it('J7. C6 does not import namespace module', () => {
    expect(source).not.toContain('mlb-shadow-monitoring-namespace');
  });

  /* ------------------------------------------------------------------ */
  /* K. No model training / snapshot acquisition imports                  */
  /* ------------------------------------------------------------------ */

  it('K1. C6 does not import model training modules', () => {
    expect(source).not.toContain('mlb-logistic-regression-fit-contract');
    expect(source).not.toContain('mlb-inner-development-train-artifact');
    expect(source).not.toContain('mlb-inner-development-candidate-recipe');
  });

  it('K2. C6 does not import snapshot acquisition modules', () => {
    expect(source).not.toContain('mlb-prospective-holdout-capture');
    expect(source).not.toContain('snapshot-acquisition');
  });

  /* ------------------------------------------------------------------ */
  /* L. Result type is a discriminated union (no any / casts)            */
  /* ------------------------------------------------------------------ */

  it('L1. no any type usage in C6 source', () => {
    expect(source).not.toMatch(/\bany\b/);
  });

  it('L2. no as unknown as casts in C6 source', () => {
    expect(source).not.toContain('as unknown as');
  });

  it('L3. no unchecked non-null assertions in C6 source', () => {
    expect(source).not.toMatch(/!\./);
  });
});
