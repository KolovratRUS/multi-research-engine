import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ML_DIR = join(__dirname, '../../../src/prediction/mlb');
const SRC_ROOT = join(__dirname, '../../../src');

const V2_SOURCE = join(
  ML_DIR,
  'mlb-shadow-execution-job-v2-contract.ts',
);
const V1_SOURCE = join(
  ML_DIR,
  'mlb-shadow-execution-job-contract.ts',
);

/* -------------------------------------------------------------------------- */
/*  Walk a directory recursively for .ts files (excludes .d.ts).               */
/* -------------------------------------------------------------------------- */
function walk(dir: string, files: string[] = []): string[] {
  const entries = readdirSync(dir);
  for (const entry of entries) {
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
  const re = /import\s+(?:type\s+)?(?:[^'"]+?)\s+from\s+['"]([^'"]+)['"]/g;
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
/*  Allowed direct imports for the V2 production module.                      */
/*  Everything else is a prohibited dependency.                               */
/* -------------------------------------------------------------------------- */
const ALLOWED_V2_IMPORTS: ReadonlySet<string> = new Set([
  '@/prediction/mlb/mlb-shadow-candidate-003-authorized-model-artifact',
  '@/prediction/mlb/mlb-feature-vector-contract',
  '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1',
  '@/prediction/mlb/mlb-pregame-snapshot-contract',
]);

/* -------------------------------------------------------------------------- */
/*  Prohibited substrings — must NEVER appear in V2 production source.        */
/* -------------------------------------------------------------------------- */
const PROHIBITED_SOURCE_TEXT: ReadonlyArray<string> = [
  'mlb-model-test-release-contract',
  'MLBModelTestReleaseResult',
  'mlb-logistic-regression-fit-contract',
  'mlb-shadow-model-fingerprint',
  'mlb-shadow-execution-job-contract',
  'node:fs',
  "from 'fs'",
  'from "fs"',
  'axios',
  'Date.now',
  'new Date',
  'Math.random',
  'randomUUID',
  'randomBytes',
  'randomBytes',
  'fetch(',
];

/* -------------------------------------------------------------------------- */
/*  Walk target for runtime non-import checks (src directory).                */
/* -------------------------------------------------------------------------- */
const V2_MODULE_FILENAME = 'mlb-shadow-execution-job-v2-contract';

describe('mlb-shadow-execution-job-v2-contract boundary (phase sealing)', () => {
  /* ------------------------------------------------------------------ */
  /*  A. V2 production module: prohibited imports / dependencies        */
  /* ------------------------------------------------------------------ */

  it('A1. V2 imports ONLY allowed modules (no prohibited dependencies)', () => {
    const source = readFileSync(V2_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    const disallowed = imports.filter(
      (s) => !ALLOWED_V2_IMPORTS.has(s),
    );
    expect(disallowed).toEqual([]);
  });

  it('A2. V2 does NOT import mlb-model-test-release-contract', () => {
    const source = readFileSync(V2_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    expect(
      imports.some((s) =>
        s.includes('mlb-model-test-release-contract'),
      ),
    ).toBe(false);
  });

  it('A3. V2 does NOT import the V1 execution contract (execution adapter)', () => {
    const source = readFileSync(V2_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    expect(
      imports.some((s) =>
        s.includes('mlb-shadow-execution-job-contract'),
      ),
    ).toBe(false);
  });

  it('A4. V2 does NOT import mlb-shadow-model-fingerprint (gate is transitive)', () => {
    const source = readFileSync(V2_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    expect(
      imports.some((s) =>
        s.includes('mlb-shadow-model-fingerprint'),
      ),
    ).toBe(false);
  });

  it('A5. V2 does NOT import the model fitter (mlb-logistic-regression-fit-contract)', () => {
    const source = readFileSync(V2_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    expect(
      imports.some((s) =>
        s.includes('mlb-logistic-regression-fit-contract'),
      ),
    ).toBe(false);
  });

  it('A6. V2 does NOT import node:fs or fs', () => {
    const source = readFileSync(V2_SOURCE, 'utf8');
    expect(source).not.toContain('node:fs');
    expect(source).not.toContain("from 'fs'");
    expect(source).not.toContain('from "fs"');
  });

  it('A7. V2 does NOT reference network clients (fetch/axios)', () => {
    const source = readFileSync(V2_SOURCE, 'utf8');
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('axios');
  });

  /* ------------------------------------------------------------------ */
  /*  B. V2 production module: prohibited runtime patterns             */
  /* ------------------------------------------------------------------ */

  it('B1. V2 source has no clock reads (Date.now / new Date)', () => {
    const source = readFileSync(V2_SOURCE, 'utf8');
    expect(source).not.toContain('Date.now');
    expect(source).not.toContain('new Date');
  });

  it('B2. V2 source has no randomness (Math.random / randomUUID / randomBytes)', () => {
    const source = readFileSync(V2_SOURCE, 'utf8');
    expect(source).not.toContain('Math.random');
    expect(source).not.toContain('randomUUID');
    expect(source).not.toContain('randomBytes');
  });

  it('B3. V2 source has no ML-model-test-release-contract text', () => {
    const source = readFileSync(V2_SOURCE, 'utf8');
    expect(source).not.toContain('mlb-model-test-release-contract');
  });

  it('B4. V2 source has no MLBModelTestReleaseResult type reference', () => {
    const source = readFileSync(V2_SOURCE, 'utf8');
    expect(source).not.toContain('MLBModelTestReleaseResult');
  });

  /* ------------------------------------------------------------------ */
  /*  C. V2 production module: required dependency                     */
  /* ------------------------------------------------------------------ */

  it('C1. V2 DOES import the authorized-model artifact contract', () => {
    const source = readFileSync(V2_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    expect(
      imports.some((s) =>
        s.includes(
          'mlb-shadow-candidate-003-authorized-model-artifact',
        ),
      ),
    ).toBe(true);
  });

  it('C2. V2 DOES use validateMLBShadowCandidate003AuthorizedModelArtifact', () => {
    const source = readFileSync(V2_SOURCE, 'utf8');
    expect(source).toContain(
      'validateMLBShadowCandidate003AuthorizedModelArtifact',
    );
  });

  /* ------------------------------------------------------------------ */
  /*  D. V1 / V2 non-interference                                        */
  /* ------------------------------------------------------------------ */

  it('D1. V1 production module does NOT import V2', () => {
    const v1Source = readFileSync(V1_SOURCE, 'utf8');
    expect(v1Source).not.toContain(V2_MODULE_FILENAME);
  });

  it('D2. V1 production module does not mention V2 at all', () => {
    const v1Source = readFileSync(V1_SOURCE, 'utf8');
    const v1Lines = v1Source.split('\n');
    for (const line of v1Lines) {
      expect(line).not.toContain(V2_MODULE_FILENAME);
    }
  });

  /* ------------------------------------------------------------------ */
  /*  E. No existing production runtime imports V2                      */
  /* ------------------------------------------------------------------ */

  it('E1. no src/ production file imports the V2 module', () => {
    const allSourceFiles = walk(SRC_ROOT);
    const importers: string[] = [];
    for (const file of allSourceFiles) {
      const content = readFileSync(file, 'utf8');
      const imports = extractImportSources(content);
      if (
        imports.some((s) => s.includes(V2_MODULE_FILENAME))
      ) {
        importers.push(file);
      }
    }
    expect(importers).toEqual([]);
  });

  /* ------------------------------------------------------------------ */
  /*  F. V2 source completeness (no missing pieces)                     */
  /* ------------------------------------------------------------------ */

  it('F1. V2 exports the exact contract version string', () => {
    const source = readFileSync(V2_SOURCE, 'utf8');
    expect(source).toContain('mlb-shadow-execution-job-v2');
  });

  it('F2. V2 exports validateMLBShadowExecutionJobV2', () => {
    const source = readFileSync(V2_SOURCE, 'utf8');
    expect(source).toContain(
      'export function validateMLBShadowExecutionJobV2',
    );
  });
});
