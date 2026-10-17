/* -------------------------------------------------------------------------- */
/*  Boundary audit: mlb-shadow-execution-adapter-v2.ts                         */
/*  Phase: 8V-D3-C-E4-B4-I3G-LIVE1-L5E2X-P5E-C3                              */
/* -------------------------------------------------------------------------- */
/*  Reads the PRODUCTION adapter source (not the test) and asserts the       */
/*  P5E-C3 boundary invariants:                                              */
/*    - direct imports limited to the V2 job contract + V2 persistence        */
/*      orchestrator modules                                                */
/*    - no forbidden imports (V1 modules, stores, computation, orchestrator, */
/*      candidate-003 artifact, feature manifest, snapshot, namespace, etc.) */
/*    - no runtime generators (Date.now / new Date / randomUUID /            */
/*      Math.random / randomBytes / performance.now)                          */
/*    - no CLI / network / filesystem primitives                            */
/*    - no K1 / K2 / scheduler / capture / activation / TRAIN / outcome /    */
/*      grading / performance                                               */
/*    - no direct calls to lower-layer functions                           */
/*      (computeMLBShadowQuarantinedPrediction,                              */
/*       orchestrateMLBShadowQuarantinePrediction,                           */
/*       persistMLBShadowQuarantinedPrediction,                              */
/*       persistMLBShadowMonitoringPredictionOperationalRecord,              */
/*       buildMLBShadowPredictionOperationalRecord)                        */
/*    - exactly one call site to validateMLBShadowExecutionJobV2              */
/*    - exactly one call site to orchestrateMLBShadowMonitoringPrediction    */
/*      PersistenceV2                                                        */
/*    - no try/catch (adapter does NOT catch delegate errors)                */
/*    - no production source imports the V2 adapter (dormant)                */
/*                                                                              */
/*  node:fs / node:path are used HERE solely as audit tooling to read the     */
/*  production source. They are NOT present in the audited adapter source.    */
/*  Comments are stripped before pattern audits to avoid false positives.     */
/* -------------------------------------------------------------------------- */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

/* -------------------------------------------------------------------------- */
/*  Locate the adapter source and src root                                    */
/* -------------------------------------------------------------------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const V2_DIR = join(
  __dirname,
  '../../../src/prediction/mlb',
);
const SRC_ROOT = join(__dirname, '../../../src');

const ADAPTER_PATH = join(V2_DIR, 'mlb-shadow-execution-adapter-v2.ts');
const HANDOFF_SOURCE = join(
  V2_DIR,
  'mlb-shadow-prepared-execution-job-v2-handoff.ts',
);

let sourceText: string;
try {
  sourceText = readFileSync(ADAPTER_PATH, 'utf8');
} catch (error) {
  throw new Error(
    `Boundary audit cannot read adapter source at ${ADAPTER_PATH}: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Strip /* ... *\/ and // comments so documentation text does not cause
 *  false positives in code-level audits. Safe for this adapter: no string
 *  literal contains `//` or `/*` sequences.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, '');
}

function extractImportPaths(src: string): string[] {
  const paths: string[] = [];
  const re = /from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    paths.push(m[1]);
  }
  return paths;
}

function extractImportSources(content: string): string[] {
  const sources: string[] = [];
  // Matches: import ... from '...' (including `import type`)
  const re =
    /import\s+(?:type\s+)?(?:[^'"]+?)\s+from\s+['"]([^'"]+)['"]/g;
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

function basenameOf(path: string): string {
  return path.split('/').pop() ?? '';
}

/** Walk a directory recursively for .ts files (excludes .d.ts). */
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
/*  Audit constants — computed once at module scope                           */
/* -------------------------------------------------------------------------- */

const sourceCode = stripComments(sourceText);
const importPaths = extractImportPaths(sourceCode);

/* Only the V2 job contract + V2 persistence orchestrator are permitted. */
const ALLOWED_IMPORT_BASENAMES: ReadonlySet<string> = new Set(
  [
    'mlb-shadow-execution-job-v2-contract',
    'mlb-shadow-monitoring-persistence-orchestrator-v2',
  ],
);

/*
 * Forbidden import basenames — exact match (NOT substring) to avoid
 * false positives from -v2 suffixes.
 * V1 modules are forbidden; V2 prediction orchestrator / computation are
 * also forbidden; all stores, projections, artifacts, manifests, and
 * namespace modules are forbidden.
 */
const FORBIDDEN_IMPORT_BASENAMES: ReadonlySet<string> = new Set([
  // V1 adapter + contract
  'mlb-shadow-execution-adapter',
  'mlb-shadow-execution-job-contract',
  // V1 + V2 persistence / prediction / computation orchestrators
  'mlb-shadow-monitoring-persistence-orchestrator',
  'mlb-shadow-monitoring-prediction-orchestrator',
  'mlb-shadow-monitoring-prediction-orchestrator-v2',
  'mlb-shadow-monitoring-prediction-computation',
  'mlb-shadow-monitoring-prediction-computation-v2',
  // Stores
  'mlb-shadow-monitoring-prediction-store',
  'mlb-shadow-monitoring-operational-store',
  // Projection / contracts
  'mlb-shadow-monitoring-operational-projection',
  'mlb-shadow-monitoring-record-contract',
  'mlb-shadow-monitoring-quarantine-contract',
  'mlb-shadow-monitoring-namespace',
  'mlb-shadow-monitoring-firewall',
  // Scientific / model artifacts / manifests / snapshots
  'mlb-shadow-candidate-003-authorized-model-artifact',
  'mlb-real-pregame-winner-feature-manifest-v1',
  'mlb-feature-vector-contract',
  'mlb-pregame-snapshot-contract',
  'mlb-shadow-model-fingerprint',
  'mlb-offline-pregame-inference-contract',
  'mlb-model-test-release-contract',
  'mlb-logistic-regression-fit-contract',
]);

/* Forbidden node:/network import substrings (no overlap with allowed). */
const FORBIDDEN_IMPORT_SUBSTRINGS: ReadonlyArray<string> = [
  'node:fs',
  'node:fs/promises',
  'node:path',
  'node:http',
  'node:https',
  'axios',
  'undici',
];

/* Forbidden runtime patterns (checks stripped source). */
const FORBIDDEN_RUNTIME_PATTERNS: ReadonlyArray<RegExp> = [
  /Date\.now\b/,
  /new\s+Date\b/,
  /randomUUID\b/,
  /randomBytes\b/,
  /Math\.random\b/,
  /performance\.now\b/,
  /\bfetch\s*\(/,
  /process\.argv/,
  /process\.env/,
];

/* Forbidden conceptual references. */
const FORBIDDEN_REFERENCES: ReadonlyArray<RegExp> = [
  /\bK1\b/,
  /\bK2\b/,
  /\bscheduler\b/i,
  /\bcapture\b/i,
  /\bactivation\b/i,
  /\bTRAIN\b/,
  /\btrain\b/i,
  /\boutcome\b/i,
  /\bgrading\b/i,
  /\bperformance\b/i,
  /\bsportsbook\b/i,
];

/* Lower-layer functions the adapter must NOT call. */
const FORBIDDEN_FUNCTION_CALLS: ReadonlyArray<string> = [
  'computeMLBShadowQuarantinedPrediction',
  'orchestrateMLBShadowQuarantinePrediction',
  'persistMLBShadowQuarantinedPrediction',
  'persistMLBShadowMonitoringPredictionOperationalRecord',
  'buildMLBShadowPredictionOperationalRecord',
];

const REQUIRED_VERSION = 'mlb-shadow-execution-adapter-v2';
const REQUIRED_FUNCTION = 'export async function executeMLBShadowExecutionJobV2';

/* V2 execution adapter module filename for non-import checks. */
const V2_ADAPTER_MODULE = 'mlb-shadow-execution-adapter-v2';

/* Production path that must remain untouched. */
const PRODUCTION_RUNTIME_PATH = join(
  process.cwd(),
  'var/mlb-development/mlb-shadow-monitoring',
);

/* -------------------------------------------------------------------------- */
/*  Tests                                                                      */
/* -------------------------------------------------------------------------- */

describe('V2 adapter import boundary', () => {
  it('imports only allowed contract + persistence modules', () => {
    expect(importPaths.length).toBeGreaterThan(0);
    for (const path of importPaths) {
      const base = basenameOf(path);
      expect(
        ALLOWED_IMPORT_BASENAMES.has(base),
        `Non-allowlisted direct import: ${path} (basename ${base})`,
      ).toBe(true);
    }
  });

  it('IMPORT_BOUNDARY = PASS (whitelist clean)', () => {
    const disallowed = importPaths.filter(
      (p) => !ALLOWED_IMPORT_BASENAMES.has(basenameOf(p)),
    );
    if (disallowed.length > 0) {
      throw new Error(
        `Disallowed imports in adapter: ${disallowed.join(', ')}`,
      );
    }
    expect(true).toBe(true);
  });

  it('does not import any forbidden basename (exact match)', () => {
    for (const path of importPaths) {
      const base = basenameOf(path);
      expect(
        !FORBIDDEN_IMPORT_BASENAMES.has(base),
        `Forbidden import basename "${base}" present in: ${path}`,
      ).toBe(true);
    }
  });

  it('does not import node:fs / node:fs/promises / node:path / http / https', () => {
    for (const path of importPaths) {
      for (const forbidden of FORBIDDEN_IMPORT_SUBSTRINGS) {
        expect(
          !path.toLowerCase().includes(forbidden.toLowerCase()),
          `Forbidden import substring "${forbidden}" present in: ${path}`,
        ).toBe(true);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */

describe('V2 code-boundary — no forbidden runtime patterns', () => {
  it('no runtime generators present in source code (comments stripped)', () => {
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      expect(
        !pattern.test(sourceCode),
        `Forbidden runtime pattern found: ${pattern}`,
      ).toBe(true);
    }
  });

  it('no forbidden conceptual references (K1/K2/scheduler/capture/etc)', () => {
    for (const pattern of FORBIDDEN_REFERENCES) {
      expect(
        !pattern.test(sourceCode),
        `Forbidden reference found: ${pattern}`,
      ).toBe(true);
    }
  });

  it('no lower-layer function calls in source code', () => {
    for (const fnName of FORBIDDEN_FUNCTION_CALLS) {
      const pattern = new RegExp(
        `\\b${fnName}\\s*\\(`,
      );
      expect(
        !pattern.test(sourceCode),
        `Forbidden function call found in adapter source: ${fnName}(`,
      ).toBe(true);
    }
  });

  it('no try/catch in source (adapter must not catch delegate errors)', () => {
    expect(sourceCode).not.toContain('try');
    expect(sourceCode).not.toContain('catch');
    expect(sourceCode).not.toContain('finally');
  });
});

/* -------------------------------------------------------------------------- */

describe('V2 call-site count boundary', () => {
  it('has exactly one call site to validateMLBShadowExecutionJobV2', () => {
    const matches = sourceCode.match(
      /\bvalidateMLBShadowExecutionJobV2\s*\(/g,
    );
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });

  it('has exactly one call site to orchestrateMLBShadowMonitoringPredictionPersistenceV2', () => {
    const matches = sourceCode.match(
      /\borchestrateMLBShadowMonitoringPredictionPersistenceV2\s*\(/g,
    );
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });

  it('does NOT reference validateMLBShadowExecutionJob (V1) in source', () => {
    const matches = sourceCode.match(
      /\bvalidateMLBShadowExecutionJob\s*\(/g,
    );
    expect(matches).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */

describe('V2 version + export boundary', () => {
  it(`exports MLB_SHADOW_EXECUTION_ADAPTER_V2_VERSION = '${REQUIRED_VERSION}'`, () => {
    expect(sourceText).toContain(
      'MLB_SHADOW_EXECUTION_ADAPTER_V2_VERSION',
    );
    expect(sourceText).toContain(REQUIRED_VERSION);
  });

  it('exports executeMLBShadowExecutionJobV2 function', () => {
    expect(sourceText).toContain(REQUIRED_FUNCTION);
  });

  it('adapter takes unknown input (no pre-cast by caller)', () => {
    expect(sourceText).toContain('input: unknown');
  });

  it('does NOT contain V1 version string', () => {
    expect(sourceText).not.toContain(
      'mlb-shadow-execution-adapter-v1',
    );
  });
});

/* -------------------------------------------------------------------------- */

describe('V2 adapter dormant / non-interference boundary', () => {
  it('exactly one production source imports the V2 adapter (V2_ADAPTER_PRODUCTION_IMPORTERS = HANDOFF)', () => {
    const adapterBasename = basenameOf(ADAPTER_PATH);
    const allSourceFiles = walk(SRC_ROOT);
    const importers: string[] = [];
    for (const file of allSourceFiles) {
      if (file === ADAPTER_PATH) {
        continue; // skip the adapter itself
      }
      const content = readFileSync(file, 'utf8');
      const imports = extractImportSources(content);
      if (
        imports.some((s) =>
          basenameOf(s).includes(V2_ADAPTER_MODULE),
        )
      ) {
        importers.push(file);
      }
    }
    expect(importers).toEqual([HANDOFF_SOURCE]);
  });

  it('V2 adapter source exists (authorized by P5E-C3)', () => {
    expect(existsSync(ADAPTER_PATH)).toBe(true);
  });

  it('exactly one production source calls executeMLBShadowExecutionJobV2 (HANDOFF)', () => {
    const allSourceFiles = walk(SRC_ROOT);
    const callers: string[] = [];
    for (const file of allSourceFiles) {
      if (file === ADAPTER_PATH) {
        continue;
      }
      const content = readFileSync(file, 'utf8');
      if (
        content.includes('executeMLBShadowExecutionJobV2') &&
        !content.includes('executeMLBShadowExecutionJobV2(')
      ) {
        continue; // type reference, not a call
      }
      if (content.includes('executeMLBShadowExecutionJobV2(')) {
        callers.push(file);
      }
    }
    expect(callers).toEqual([HANDOFF_SOURCE]);
  });

  it('exactly one production file (HANDOFF) mentions the V2 adapter module name', () => {
    const allSourceFiles = walk(SRC_ROOT);
    const offenders: string[] = [];
    for (const file of allSourceFiles) {
      if (file === ADAPTER_PATH) {
        continue; /* the adapter itself legitimately references its own name */
      }
      const content = readFileSync(file, 'utf8');
      if (content.includes(V2_ADAPTER_MODULE)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([HANDOFF_SOURCE]);
  });
});
