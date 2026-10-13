/* -------------------------------------------------------------------------- */
/*  BOUNDARY TEST — V2 shadow prediction orchestrator seam                      */
/*  Phase: 8V-D3-C-E4-B4-I3G-LIVE1-L5E2X-P5E-C1                               */
/*                                                                            */
/*  Verifies that the production V2 orchestrator module imports ONLY lawful     */
/*  dependencies and performs NO I/O, NO clock reads, NO randomness,            */
/*  NO training, NO historical-metric access, NO persistence beyond the         */
/*  existing prediction store, and NO operational-store calls.                  */
/*                                                                            */
/*  Source under inspection:                                                  */
/*    src/prediction/mlb/mlb-shadow-monitoring-prediction-orchestrator-v2.ts  */
/* -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const V2_DIR = join(__dirname, '../../../src/prediction/mlb');
const SRC_ROOT = join(__dirname, '../../../src');

const V2_ORCHESTRATOR_SOURCE = join(
  V2_DIR,
  'mlb-shadow-monitoring-prediction-orchestrator-v2.ts',
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
/*  Allowed direct imports for the V2 orchestrator production module.          */
/*  Everything else is a prohibited dependency.                                */
/* -------------------------------------------------------------------------- */
const ALLOWED_V2_ORCHESTRATOR_IMPORTS: ReadonlySet<string> = new Set([
  './mlb-shadow-monitoring-prediction-computation-v2',
  './mlb-shadow-monitoring-prediction-store',
  './mlb-shadow-monitoring-operational-projection',
  './mlb-shadow-monitoring-record-contract',
  './mlb-shadow-monitoring-quarantine-contract',
]);

/* -------------------------------------------------------------------------- */
/*  Prohibited substrings — must NEVER appear in V2 orchestrator source.        */
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
];

/* -------------------------------------------------------------------------- */
/*  V2 orchestrator module filename used for non-interference checks           */
/* -------------------------------------------------------------------------- */
const V2_ORCHESTRATOR_MODULE =
  'mlb-shadow-monitoring-prediction-orchestrator-v2';

/* -------------------------------------------------------------------------- */
/*  V1 production filenames that must NOT import V2 orchestrator                */
/* -------------------------------------------------------------------------- */
const V1_PRODUCTION_FILES = [
  'mlb-shadow-monitoring-prediction-computation',
  'mlb-shadow-monitoring-prediction-orchestrator',
  'mlb-shadow-monitoring-persistence-orchestrator',
  'mlb-shadow-monitoring-prediction-store',
  'mlb-shadow-monitoring-operational-projection',
  'mlb-shadow-monitoring-operational-store',
  'mlb-shadow-execution-adapter',
  'mlb-shadow-execution-job-contract',
  'mlb-shadow-execution-job-v2-contract',
  'mlb-shadow-monitoring-quarantine-contract',
  'mlb-shadow-monitoring-record-contract',
];

/* -------------------------------------------------------------------------- */
/*  Future V2 layer filenames that must NOT exist yet in this phase           */
/* -------------------------------------------------------------------------- */
const V2_PERSISTENCE_ORCHESTRATOR = join(
  V2_DIR,
  'mlb-shadow-monitoring-persistence-orchestrator-v2.ts',
);
const V2_EXECUTION_ADAPTER = join(
  V2_DIR,
  'mlb-shadow-execution-adapter-v2.ts',
);

describe('mlb-shadow-monitoring-prediction-orchestrator-v2 boundary', () => {
  /* ------------------------------------------------------------------ */
  /*  A. V2 orchestrator: allowed imports only                           */
  /* ------------------------------------------------------------------ */
  it('A1. V2 orchestrator imports ONLY allowed modules', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    const disallowed = imports.filter((s) => !ALLOWED_V2_ORCHESTRATOR_IMPORTS.has(s));
    expect(disallowed).toEqual([]);
  });

  /* ------------------------------------------------------------------ */
  /*  B. V2 orchestrator: no prohibited module imports                      */
  /* ------------------------------------------------------------------ */
  it('B1. V2 orchestrator does NOT import V1 prediction computation', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    expect(
      imports.some((s) => s === './mlb-shadow-monitoring-prediction-computation'),
    ).toBe(false);
  });

  it('B2. V2 orchestrator does NOT import V1 prediction orchestrator', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    expect(
      imports.some((s) => s === './mlb-shadow-monitoring-prediction-orchestrator'),
    ).toBe(false);
  });

  it('B3. V2 orchestrator does NOT import persistence-orchestrator (V1 or V2)', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    expect(
      imports.some((s) => s.includes('mlb-shadow-monitoring-persistence-orchestrator')),
    ).toBe(false);
  });

  it('B4. V2 orchestrator does NOT import execution-adapter (V1 or V2)', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    expect(
      imports.some((s) => s.includes('mlb-shadow-execution-adapter')),
    ).toBe(false);
  });

  it('B5. V2 orchestrator does NOT import operational-store', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    expect(
      imports.some((s) => s.includes('mlb-shadow-monitoring-operational-store')),
    ).toBe(false);
  });

  it('B6. V2 orchestrator does NOT import release-result contract', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    expect(
      imports.some((s) => s.includes('mlb-model-test-release-contract')),
    ).toBe(false);
  });

  it('B7. V2 orchestrator does NOT import V2 execution-job contract', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    expect(
      imports.some((s) => s.includes('mlb-shadow-execution-job')),
    ).toBe(false);
  });

  it('B8. V2 orchestrator does NOT import node:fs / fs / fs/promises', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    expect(imports.some((s) => s === 'node:fs')).toBe(false);
    expect(imports.some((s) => s === 'node:fs/promises')).toBe(false);
    expect(imports.some((s) => s === 'fs')).toBe(false);
    expect(imports.some((s) => s === 'fs/promises')).toBe(false);
  });

  /* ------------------------------------------------------------------ */
  /*  C. V2 orchestrator: no prohibited runtime patterns                 */
  /* ------------------------------------------------------------------ */
  it('C1. V2 source has no clock reads (Date.now / new Date)', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    expect(source).not.toContain('Date.now');
    expect(source).not.toContain('new Date');
  });

  it('C2. V2 source has no randomness (Math.random / randomUUID / randomBytes)', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    expect(source).not.toContain('Math.random');
    expect(source).not.toContain('randomUUID');
    expect(source).not.toContain('randomBytes');
  });

  it('C3. V2 source has no network clients (fetch / axios)', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('axios');
  });

  it('C4. V2 source has no releasedModelResult reference', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    expect(source).not.toContain('releasedModelResult');
  });

  it('C5. V2 source has no MLBModelTestReleaseResult type reference', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    expect(source).not.toContain('MLBModelTestReleaseResult');
  });

  it('C6. V2 source has no mlb-model-test-release-contract text', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    expect(source).not.toContain('mlb-model-test-release-contract');
  });

  it('C7. V2 source has no mlb-logistic-regression-fit-contract text', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    expect(source).not.toContain('mlb-logistic-regression-fit-contract');
  });

  it('C8. V2 source has no mlb-shadow-model-fingerprint text', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    expect(source).not.toContain('mlb-shadow-model-fingerprint');
  });

  it('C9. V2 source has no mlb-offline-pregame-inference-contract text', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    expect(source).not.toContain('mlb-offline-pregame-inference-contract');
  });

  it('C10. V2 source has no orchestrator / adapter / persistence / operational-store imports', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    expect(source).not.toContain('mlb-shadow-monitoring-persistence-orchestrator');
    expect(source).not.toContain('mlb-shadow-execution-adapter');
    expect(source).not.toContain('mlb-shadow-monitoring-operational-store');
  });

  /* ------------------------------------------------------------------ */
  /*  D. V2 orchestrator: required dependencies used                    */
  /* ------------------------------------------------------------------ */
  it('D1. V2 uses computeMLBShadowQuarantinedPredictionV2', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    expect(source).toContain('computeMLBShadowQuarantinedPredictionV2');
  });

  it('D2. V2 uses persistMLBShadowQuarantinedPrediction', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    expect(source).toContain('persistMLBShadowQuarantinedPrediction');
  });

  it('D3. V2 uses buildMLBShadowPredictionOperationalRecord', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    expect(source).toContain('buildMLBShadowPredictionOperationalRecord');
  });

  /* ------------------------------------------------------------------ */
  /*  E. V2 orchestrator: prohibited functions NOT used                 */
  /* ------------------------------------------------------------------ */
  it('E1. V2 does NOT use persistMLBShadowMonitoringPredictionOperationalRecord', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    expect(source).not.toContain('persistMLBShadowMonitoringPredictionOperationalRecord');
  });

  /* ------------------------------------------------------------------ */
  /*  F. V1 production sources do NOT import the new V2 orchestrator     */
  /* ------------------------------------------------------------------ */
  it('F1. only the V2 persistence orchestrator imports the V2 prediction orchestrator', () => {
    const allSourceFiles = walk(SRC_ROOT);
    const importers: string[] = [];
    for (const file of allSourceFiles) {
      if (file === V2_ORCHESTRATOR_SOURCE) {
        continue; // skip the V2 orchestrator itself
      }
      const content = readFileSync(file, 'utf8');
      const imports = extractImportSources(content);
      if (imports.some((s) => s.includes(V2_ORCHESTRATOR_MODULE))) {
        importers.push(file);
      }
    }
    expect(importers).toEqual([V2_PERSISTENCE_ORCHESTRATOR]);
  });

  it('F2. only the V2 persistence orchestrator mentions the V2 prediction orchestrator module name', () => {
    const allSourceFiles = walk(SRC_ROOT);
    const offenders: string[] = [];
    for (const file of allSourceFiles) {
      if (file === V2_ORCHESTRATOR_SOURCE) {
        continue;
      }
      const content = readFileSync(file, 'utf8');
      if (content.includes(V2_ORCHESTRATOR_MODULE)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([V2_PERSISTENCE_ORCHESTRATOR]);
  });

  /* ------------------------------------------------------------------ */
  /*  G. No V2 persistence/adapter sources exist yet in this phase       */
  /* ------------------------------------------------------------------ */
  it('G1. V2 persistence orchestrator source now exists (authorized by P5E-C2)', () => {
    expect(existsSync(V2_PERSISTENCE_ORCHESTRATOR)).toBe(true);
  });

  it('G2. V2 execution adapter source does NOT exist', () => {
    expect(existsSync(V2_EXECUTION_ADAPTER)).toBe(false);
  });

  /* ------------------------------------------------------------------ */
  /*  H. V2 orchestrator source has no prohibited substring              */
  /* ------------------------------------------------------------------ */
  it('H1. V2 orchestrator source has no prohibited substring', () => {
    const source = readFileSync(V2_ORCHESTRATOR_SOURCE, 'utf8');
    for (const prohibited of PROHIBITED_SOURCE_TEXT) {
      expect(source).not.toContain(prohibited);
    }
  });
});
