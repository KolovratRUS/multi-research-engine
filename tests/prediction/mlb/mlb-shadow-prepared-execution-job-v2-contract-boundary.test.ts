/* -------------------------------------------------------------------------- */
/*  Boundary / sealing tests for the prepared-execution-job v2 contract        */
/*  Phase: P5F-A1-R1 — contract + validator only (no store, no reader,          */
/*  no factory, no CLI, no execution).                                         */
/* -------------------------------------------------------------------------- */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ML_DIR = join(__dirname, '../../../src/prediction/mlb');
const SRC_ROOT = join(__dirname, '../../../src');

const PREPARED_SOURCE = join(
  ML_DIR,
  'mlb-shadow-prepared-execution-job-v2-contract.ts',
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
/*  Allowed direct import for the prepared contract — ONLY the V2 job contract. */
/* -------------------------------------------------------------------------- */
const ALLOWED_PREPARED_IMPORTS: ReadonlySet<string> = new Set([
  '@/prediction/mlb/mlb-shadow-execution-job-v2-contract',
]);

/* -------------------------------------------------------------------------- */
/*  Prohibited module substrings — must NEVER appear in import sources.        */
/* -------------------------------------------------------------------------- */
const PROHIBITED_IMPORT_SUBSTRINGS: ReadonlyArray<string> = [
  'mlb-shadow-candidate-003-authorized-model-artifact',
  'mlb-shadow-execution-adapter-v2',
  'mlb-shadow-monitoring-persistence-orchestrator-v2',
  'mlb-shadow-monitoring-prediction-orchestrator-v2',
  'mlb-shadow-monitoring-prediction-computation-v2',
  'mlb-shadow-monitoring-prediction-store',
  'mlb-shadow-monitoring-operational-store',
  'mlb-shadow-monitoring-namespace',
  'mlb-feature-vector-contract',
  'mlb-pregame-snapshot-contract',
  'mlb-real-pregame-winner-feature-manifest-v1',
  'mlb-logistic-regression-fit-contract',
  'mlb-shadow-model-fingerprint',
  'node:fs',
  'fs/promises',
  'node:path',
  'node:crypto',
  'node:http',
  'node:https',
  'axios',
  'undici',
];

/* -------------------------------------------------------------------------- */
/*  Validation-only repoRoot sentinel (must never appear in output)            */
/* -------------------------------------------------------------------------- */
const VALIDATION_ONLY_REPOROOT_SENTINEL =
  '/__mre_shadow_prepared_job_validation_only__';

describe('mlb-shadow-prepared-execution-job-v2-contract boundary', () => {
  /* ---------------------------------------------------------------------- */
  /*  A. Prepared contract imports ONLY the V2 job contract                  */
  /* ---------------------------------------------------------------------- */

  it('A1. prepared contract imports ONLY the V2 job contract', () => {
    const source = readFileSync(PREPARED_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    const disallowed = imports.filter(
      (s) => !ALLOWED_PREPARED_IMPORTS.has(s),
    );
    expect(disallowed).toEqual([]);
  });

  it('A2. prepared contract does NOT import the model getter', () => {
    const source = readFileSync(PREPARED_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    expect(
      imports.some((s) =>
        s.includes(
          'mlb-shadow-candidate-003-authorized-model-artifact',
        ),
      ),
    ).toBe(false);
    expect(source).not.toContain(
      'getMLBShadowCandidate003AuthorizedModelArtifact',
    );
  });

  it('A3. prepared contract does NOT import prohibited modules', () => {
    const source = readFileSync(PREPARED_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    const hits = imports.filter((s) =>
      PROHIBITED_IMPORT_SUBSTRINGS.some((p) => s.includes(p)),
    );
    expect(hits).toEqual([]);
  });

  it('A4. prepared contract does NOT import node:fs, fs/promises, or node:path', () => {
    const source = readFileSync(PREPARED_SOURCE, 'utf8');
    expect(source).not.toContain('node:fs');
    expect(source).not.toContain("from 'fs'");
    expect(source).not.toContain('from "fs"');
    expect(source).not.toContain('fs/promises');
    expect(source).not.toContain('node:path');
  });

  it('A5. prepared contract does NOT import network libraries', () => {
    const source = readFileSync(PREPARED_SOURCE, 'utf8');
    expect(source).not.toContain('axios');
    expect(source).not.toContain('undici');
    expect(source).not.toContain('fetch(');
  });

  it('A6. prepared contract does NOT import node:crypto', () => {
    const source = readFileSync(PREPARED_SOURCE, 'utf8');
    expect(source).not.toContain('node:crypto');
  });

  /* ---------------------------------------------------------------------- */
  /*  B. Prepared contract: prohibited runtime patterns                    */
  /* ---------------------------------------------------------------------- */

  it('B1. prepared source has no clock reads (Date.now / new Date)', () => {
    const source = readFileSync(PREPARED_SOURCE, 'utf8');
    expect(source).not.toContain('Date.now');
    expect(source).not.toContain('new Date');
  });

  it('B2. prepared source has no randomness (Math.random / randomUUID / randomBytes)', () => {
    const source = readFileSync(PREPARED_SOURCE, 'utf8');
    expect(source).not.toContain('Math.random');
    expect(source).not.toContain('randomUUID');
    expect(source).not.toContain('randomBytes');
  });

  it('B3. prepared source has no performance.now', () => {
    const source = readFileSync(PREPARED_SOURCE, 'utf8');
    expect(source).not.toContain('performance.now');
  });

  it('B4. prepared source has no model fitter or test-release imports', () => {
    const source = readFileSync(PREPARED_SOURCE, 'utf8');
    expect(source).not.toContain('mlb-logistic-regression-fit-contract');
    expect(source).not.toContain('mlb-model-test-release-contract');
    expect(source).not.toContain('MLBModelTestRelease');
  });

  /* ---------------------------------------------------------------------- */
  /*  C. Prepared contract: required exports                               */
  /* ---------------------------------------------------------------------- */

  it('C1. prepared contract exports the exact version constant', () => {
    const source = readFileSync(PREPARED_SOURCE, 'utf8');
    expect(source).toContain(
      'mlb-shadow-prepared-execution-job-v2-v1',
    );
  });

  it('C2. prepared contract exports MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_FIELD_ORDER', () => {
    const source = readFileSync(PREPARED_SOURCE, 'utf8');
    expect(source).toContain(
      'MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_FIELD_ORDER',
    );
  });

  it('C3. prepared contract exports validateMLBShadowPreparedExecutionJobV2', () => {
    const source = readFileSync(PREPARED_SOURCE, 'utf8');
    expect(source).toContain(
      'export function validateMLBShadowPreparedExecutionJobV2',
    );
  });

  it('C4. prepared contract does NOT export the validation-only repoRoot sentinel', () => {
    const source = readFileSync(PREPARED_SOURCE, 'utf8');
    expect(source).not.toContain(
      'export const PREPARED_JOB_VALIDATION_REPOROOT_SENTINEL',
    );
    expect(source).not.toContain(
      'export { ' + VALIDATION_ONLY_REPOROOT_SENTINEL,
    );
  });

  it('C5. prepared contract does NOT embed contractVersion in the prepared job value', () => {
    const source = readFileSync(PREPARED_SOURCE, 'utf8');
    // The validated value must not include a contractVersion field
    const valueStart = source.indexOf('const preparedValue');
    const valueEnd = source.indexOf('return {', valueStart);
    const valueSection = source.slice(valueStart, valueEnd);
    expect(valueSection).not.toContain('contractVersion:');
    // But the version constant must exist as a code constant
    expect(source).toContain(
      'MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_CONTRACT_VERSION',
    );
  });

  it('C6. prepared contract DOES use validateMLBShadowExecutionJobV2 for delegation', () => {
    const source = readFileSync(PREPARED_SOURCE, 'utf8');
    expect(source).toContain('validateMLBShadowExecutionJobV2');
  });

  /* ---------------------------------------------------------------------- */
  /*  D. Prepared contract is the ONLY new production file under src/       */
  /* ---------------------------------------------------------------------- */

  it('D1. prepared contract file exists in src/prediction/mlb', () => {
    const files = walk(join(SRC_ROOT, 'prediction/mlb')).map(
      (f) => f.replace(/.*\//, ''),
    );
    expect(
      files.some((f) =>
        f.includes('mlb-shadow-prepared-execution-job-v2-contract'),
      ),
    ).toBe(true);
  });

  it('D2. prepared store and prepared reader EXIST; prepared factory/CLI ABSENT under src/', () => {
    const files = walk(SRC_ROOT).map(
      (f) => f.replace(/.*\//, ''),
    );
    // Prepared store now EXISTS
    expect(
      files.some((f) =>
        f.includes('mlb-shadow-prepared-execution-job-v2-store'),
      ),
    ).toBe(true);
    // Prepared reader now EXISTS
    expect(
      files.some((f) =>
        f.includes('mlb-shadow-prepared-execution-job-v2-reader'),
      ),
    ).toBe(true);
    // Factory and CLI must NOT exist (v1 and v2); reader-absence is intentionally
    // NOT asserted here because the reader is now part of the sealed surface.
    const prohibitedPatterns = [
      'mlb-shadow-prepared-execution-job-reader',
      'mlb-shadow-prepared-execution-job-factory',
      'mlb-shadow-prepared-execution-job-cli',
      'mlb-shadow-prepared-execution-job-v2-factory',
      'mlb-shadow-prepared-execution-job-v2-cli',
      'mlb-shadow-monitoring-prepared-job-store',
      'mlb-shadow-monitoring-preparation-store',
    ];
    for (const pattern of prohibitedPatterns) {
      expect(files.some((f) => f.includes(pattern))).toBe(false);
    }
  });
});
