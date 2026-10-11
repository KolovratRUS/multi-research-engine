/* -------------------------------------------------------------------------- */
/*  BOUNDARY TEST — V2 shadow prediction computation seam                      */
/*  Phase: 8V-D3-C-E4-B4-I3G-LIVE1-L5E2X-P5D-C1                               */
/*                                                                            */
/*  Verifies that the production V2 computation module imports ONLY pure,     */
/*  lawful dependencies and performs NO I/O, NO clock reads, NO randomness,    */
/*  NO training, NO historical-metric access, NO persistence.                   */
/*                                                                            */
/*  Source under inspection:                                                  */
/*    src/prediction/mlb/mlb-shadow-monitoring-prediction-computation-v2.ts   */
/* -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ML_DIR = join(__dirname, '../../../src/prediction/mlb');
const SRC_ROOT = join(__dirname, '../../../src');
const V2_DIR = join(__dirname, '../../../src/prediction/mlb');

const V2_COMPUTATION_SOURCE = join(
  V2_DIR,
  'mlb-shadow-monitoring-prediction-computation-v2.ts',
);
const V1_COMPUTATION_SOURCE = join(
  ML_DIR,
  'mlb-shadow-monitoring-prediction-computation.ts',
);
const V1_INFERENCE_SOURCE = join(
  ML_DIR,
  'mlb-offline-pregame-inference-contract.ts',
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
  const re = /import\s+(?:type\s+)?(?:[^'"]+?)\\s+from\\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    sources.push(match[1]);
  }
  // Matches side-effect-only imports: import '...'
  const se = /import\\s+['"]([^'"]+)['"]/g;
  while ((match = se.exec(content)) !== null) {
    sources.push(match[1]);
  }
  return sources;
}

/* -------------------------------------------------------------------------- */
/*  Allowed direct imports for the V2 computation production module.           */
/*  Everything else is a prohibited dependency.                                */
/* -------------------------------------------------------------------------- */
const ALLOWED_V2_COMPUTATION_IMPORTS: ReadonlySet<string> = new Set([
  'node:crypto',
  '@/prediction/mlb/mlb-shadow-execution-job-v2-contract',
  '@/prediction/mlb/mlb-feature-vector-contract',
  '@/prediction/mlb/mlb-shadow-monitoring-quarantine-contract',
]);

/* -------------------------------------------------------------------------- */
/*  Prohibited substrings — must NEVER appear in V2 computation source.       */
/* -------------------------------------------------------------------------- */
const PROHIBITED_SOURCE_TEXT: ReadonlyArray<string> = [
  'mlb-model-test-release-contract',
  'MLBModelTestReleaseResult',
  'releasedModelResult',
  'mlb-logistic-regression-fit-contract',
  'mlb-shadow-model-fingerprint',
  'mlb-offline-pregame-inference-contract',
  'node:fs',
  "from 'fs'",
  'from "fs"',
  'axios',
  'Date.now',
  'new Date',
  'performance.now',
  'Math.random',
  'randomUUID',
  'randomBytes',
  'fetch(',
  'mlb-shadow-execution-job-contract',
  'mlb-shadow-monitoring-prediction-orchestrator',
  'mlb-shadow-monitoring-persistence-orchestrator',
  'mlb-shadow-execution-adapter',
];

/* -------------------------------------------------------------------------- */
/*  V2 module filename used for non-interference checks.                      */
/* -------------------------------------------------------------------------- */
const V2_COMPUTATION_MODULE =
  'mlb-shadow-monitoring-prediction-computation-v2';

describe('mlb-shadow-monitoring-prediction-computation-v2 boundary', () => {
  /* ------------------------------------------------------------------ */
  /*  A. V2 computation: allowed imports only                            */
  /* ------------------------------------------------------------------ */
  it('A1. V2 computation imports ONLY allowed modules', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    const disallowed = imports.filter((s) => !ALLOWED_V2_COMPUTATION_IMPORTS.has(s));
    expect(disallowed).toEqual([]);
  });

  it('A2. V2 computation does NOT import mlb-model-test-release-contract', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    expect(
      imports.some((s) => s.includes('mlb-model-test-release-contract')),
    ).toBe(false);
  });

  it('A3. V2 computation does NOT import mlb-logistic-regression-fit-contract', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    expect(
      imports.some((s) => s.includes('mlb-logistic-regression-fit-contract')),
    ).toBe(false);
  });

  it('A4. V2 computation does NOT import mlb-shadow-model-fingerprint', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    expect(
      imports.some((s) => s.includes('mlb-shadow-model-fingerprint')),
    ).toBe(false);
  });

  it('A5. V2 computation does NOT import mlb-offline-pregame-inference-contract', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    expect(
      imports.some((s) =>
        s.includes('mlb-offline-pregame-inference-contract'),
      ),
    ).toBe(false);
  });

  it('A6. V2 computation does NOT import node:fs or fs', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    expect(source).not.toContain('node:fs');
    expect(source).not.toContain("from 'fs'");
    expect(source).not.toContain('from "fs"');
  });

  it('A7. V2 computation does NOT import V1 execution job contract', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    expect(
      imports.some((s) => s.includes('mlb-shadow-execution-job-contract')),
    ).toBe(false);
  });

  /* ------------------------------------------------------------------ */
  /*  B. V2 computation: prohibited runtime patterns                   */
  /* ------------------------------------------------------------------ */
  it('B1. V2 source has no clock reads (Date.now / new Date)', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    expect(source).not.toContain('Date.now');
    expect(source).not.toContain('new Date');
  });

  it('B2. V2 source has no randomness (Math.random / randomUUID / randomBytes)', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    expect(source).not.toContain('Math.random');
    expect(source).not.toContain('randomUUID');
    expect(source).not.toContain('randomBytes');
  });

  it('B3. V2 source has no network clients (fetch / axios)', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('axios');
  });

  it('B4. V2 source has no model-test-release-contract text', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    expect(source).not.toContain('mlb-model-test-release-contract');
  });

  it('B5. V2 source has no MLBModelTestReleaseResult type reference', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    expect(source).not.toContain('MLBModelTestReleaseResult');
  });

  it('B6. V2 source has no releasedModelResult reference', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    expect(source).not.toContain('releasedModelResult');
  });

  it('B7. V2 source has no historical metric field names', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    expect(source).not.toContain('logLoss');
    expect(source).not.toContain('brierScore');
    expect(source).not.toContain('rocAuc');
    expect(source).not.toContain('correctCount');
    expect(source).not.toContain('incorrectCount');
  });

  it('B8. V2 source has no orchestrator / adapter / persistence imports', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    expect(source).not.toContain('mlb-shadow-monitoring-prediction-orchestrator');
    expect(source).not.toContain('mlb-shadow-monitoring-persistence-orchestrator');
    expect(source).not.toContain('mlb-shadow-execution-adapter');
  });

  /* ------------------------------------------------------------------ */
  /*  C. V2 computation: required dependencies used                    */
  /* ------------------------------------------------------------------ */
  it('C1. V2 uses validateMLBShadowExecutionJobV2 (job validator)', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    expect(source).toContain('validateMLBShadowExecutionJobV2');
  });

  it('C2. V2 uses extractMLBLeakageSafeFeatureVector (feature extraction)', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    expect(source).toContain('extractMLBLeakageSafeFeatureVector');
  });

  it('C3. V2 uses validateMLBShadowQuarantinedPredictionPayload (quarantine validator)', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    expect(source).toContain('validateMLBShadowQuarantinedPredictionPayload');
  });

  it('C4. V2 uses authorizedModelArtifact (authorized model path)', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    expect(source).toContain('authorizedModelArtifact');
  });

  it('C5. V2 uses createHash for pure SHA-256 (node:crypto, not fs/network)', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    expect(source).toContain('createHash');
  });

  it('C6. V2 exports computeMLBShadowQuarantinedPredictionV2', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    expect(source).toContain('export function computeMLBShadowQuarantinedPredictionV2');
  });

  /* ------------------------------------------------------------------ */
  /*  D. V1 / V2 non-interference                                        */
  /* ------------------------------------------------------------------ */
  it('D1. V1 computation source does NOT import V2', () => {
    const v1Source = readFileSync(V1_COMPUTATION_SOURCE, 'utf8');
    const v1Imports = extractImportSources(v1Source);
    expect(
      v1Imports.some((s) => s.includes(V2_COMPUTATION_MODULE)),
    ).toBe(false);
  });

  it('D2. V1 computation source does not mention V2 module', () => {
    const v1Source = readFileSync(V1_COMPUTATION_SOURCE, 'utf8');
    expect(v1Source).not.toContain(V2_COMPUTATION_MODULE);
  });

  it('D3. V1 inference source does NOT import V2', () => {
    const v1Source = readFileSync(V1_INFERENCE_SOURCE, 'utf8');
    const v1Imports = extractImportSources(v1Source);
    expect(
      v1Imports.some((s) => s.includes(V2_COMPUTATION_MODULE)),
    ).toBe(false);
  });

  it('D4. V1 inference source does not mention V2 module', () => {
    const v1Source = readFileSync(V1_INFERENCE_SOURCE, 'utf8');
    expect(v1Source).not.toContain(V2_COMPUTATION_MODULE);
  });

  /* ------------------------------------------------------------------ */
  /*  E. No existing production runtime imports V2 computation            */
  /* ------------------------------------------------------------------ */
  it('E1. no src/ production file imports the V2 computation module', () => {
    const allSourceFiles = walk(SRC_ROOT);
    const importers: string[] = [];
    for (const file of allSourceFiles) {
      const content = readFileSync(file, 'utf8');
      const imports = extractImportSources(content);
      if (imports.some((s) => s.includes(V2_COMPUTATION_MODULE))) {
        importers.push(file);
      }
    }
    expect(importers).toEqual([]);
  });

  /* ------------------------------------------------------------------ */
  /*  F. V2 source completeness                                          */
  /* ------------------------------------------------------------------ */
  it('F1. V2 source has no prohibited substring', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    for (const prohibited of PROHIBITED_SOURCE_TEXT) {
      expect(source).not.toContain(prohibited);
    }
  });

  it('F2. V2 source accepts unknown input and validates via V2 job validator', () => {
    const source = readFileSync(V2_COMPUTATION_SOURCE, 'utf8');
    expect(source).toContain('input: unknown');
    expect(source).toContain('validateMLBShadowExecutionJobV2(input)');
  });
});
