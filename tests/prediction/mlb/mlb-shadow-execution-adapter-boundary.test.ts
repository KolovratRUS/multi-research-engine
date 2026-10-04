/* -------------------------------------------------------------------------- */
/*  Boundary audit: mlb-shadow-execution-adapter.ts                            */
/* -------------------------------------------------------------------------- */
/*  Reads the PRODUCTION adapter source (not the test) and asserts the       */
/*  L5E2W-C1 boundary invariants:                                               */
/*    - direct imports limited to the contract + L5E2U orchestrator modules  */
/*    - no forbidden imports (prediction store, forecast, capture, etc.)      */
/*    - no runtime generators (Date.now / new Date / randomUUID / Math.random) */
/*    - no CLI / network / filesystem primitives                             */
/*    - no K1 / K2 / scheduler / capture / activation / TRAIN / outcome      */
/*    - exactly one call site to validateMLBShadowExecutionJob                  */
/*    - exactly one call site to orchestrateMLBShadowMonitoringPredictionPersistence */
/*                                                                              */
/*  node:fs / node:path are used HERE solely as audit tooling to read the      */
/*  production source. They are NOT present in the audited adapter source.    */
/*  Comments are stripped before pattern audits to avoid false positives.      */
/* -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

/* -------------------------------------------------------------------------- */
/*  Locate the adapter source                                                  */
/* -------------------------------------------------------------------------- */
const ADAPTER_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../src/prediction/mlb/mlb-shadow-execution-adapter.ts',
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
/** Strip /\* ... *\/ and // comments so documentation text does not cause
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

function basenameOf(path: string): string {
  return path.split('/').pop() ?? '';
}

/* -------------------------------------------------------------------------- */
/*  Audit constants — computed once at module scope                             */
/* -------------------------------------------------------------------------- */
const sourceCode = stripComments(sourceText);
const importPaths = extractImportPaths(sourceCode);

const ALLOWED_IMPORT_BASENAMES: ReadonlySet<string> = new Set<string>([
  'mlb-shadow-execution-job-contract',
  'mlb-shadow-monitoring-persistence-orchestrator',
]);

const FORBIDDEN_IMPORT_SUBSTRINGS: ReadonlyArray<string> = [
  'mlb-shadow-monitoring-prediction-orchestrator',
  'mlb-shadow-monitoring-prediction-computation',
  'mlb-shadow-monitoring-prediction-store',
  'mlb-shadow-monitoring-operational-store',
  'mlb-shadow-model-fingerprint',
  'mlb-prospective-holdout-capture',
  'mlb-prospective-holdout-scheduler',
  'mlb-prospective-holdout-activation',
  'mlb-inner-development',
  'MLBResearchDataAdapter',
  'src/lib/research-data',
  'node:fs',
  'node:fs/promises',
  'node:http',
  'node:https',
];

const FORBIDDEN_RUNTIME_PATTERNS: ReadonlyArray<RegExp> = [
  /Date\.now\b/,
  /new\s+Date\b/,
  /randomUUID\b/,
  /randomBytes\b/,
  /Math\.random\b/,
  /\bfetch\s*\(/,
  /process\.argv/,
  /process\.env/,
];

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

const REQUIRED_VERSION = 'mlb-shadow-execution-adapter-v1';

/* -------------------------------------------------------------------------- */
/*  Tests                                                                      */
/* -------------------------------------------------------------------------- */
describe('L5E2W adapter import boundary', () => {
  it('imports only allowed contract + L5E2U modules', () => {
    expect(importPaths.length).toBeGreaterThan(0);
    for (const path of importPaths) {
      const base = basenameOf(path);
      expect(
        ALLOWED_IMPORT_BASENAMES.has(base),
        `Non-allowlisted direct import: ${path} (basename ${base})`,
      ).toBe(true);
    }
  });

  it('L5E2W_IMPORT_BOUNDARY = PASS (whitelist clean)', () => {
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

  it('does not import any forbidden module', () => {
    for (const path of importPaths) {
      for (const forbidden of FORBIDDEN_IMPORT_SUBSTRINGS) {
        expect(
          path.toLowerCase().includes(forbidden.toLowerCase()),
          `Forbidden import substring "${forbidden}" present in: ${path}`,
        ).toBe(false);
      }
    }
  });

  it('does not import node:fs / node:http / node:https', () => {
    const fsHttp = importPaths.filter((p) =>
      /node:(fs|fs\/promises|http|https)\b/.test(p),
    );
    expect(fsHttp).toEqual([]);
  });
});

describe('L5E2W code-boundary — no forbidden runtime patterns', () => {
  it('no runtime generators present in source code (comments stripped)', () => {
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      expect(
        pattern.test(sourceCode),
        `Forbidden runtime pattern found: ${pattern}`,
      ).toBe(false);
    }
  });

  it('L5E2W_RUNTIME_GENERATORS = NOT_PRESENT', () => {
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      if (pattern.test(sourceCode)) {
        throw new Error(
          `Runtime generator pattern found in adapter source: ${pattern}`,
        );
      }
    }
    expect(true).toBe(true);
  });

  it('does not reference K1 / K2 / scheduler / capture / activation / TRAIN / outcome / grading / performance', () => {
    for (const pattern of FORBIDDEN_REFERENCES) {
      expect(
        pattern.test(sourceCode),
        `Forbidden reference found: ${pattern}`,
      ).toBe(false);
    }
  });
});

describe('L5E2W call-site count boundary', () => {
  it('has exactly one call site to validateMLBShadowExecutionJob', () => {
    const matches = sourceCode.match(
      /\bvalidateMLBShadowExecutionJob\s*\(/g,
    );
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });

  it('has exactly one call site to orchestrateMLBShadowMonitoringPredictionPersistence', () => {
    const matches = sourceCode.match(
      /\borchestrateMLBShadowMonitoringPredictionPersistence\s*\(/g,
    );
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });
});

describe('L5E2W version + export boundary', () => {
  it(`exports MLB_SHADOW_EXECUTION_ADAPTER_VERSION = '${REQUIRED_VERSION}'`, () => {
    expect(sourceText).toContain(
      'MLB_SHADOW_EXECUTION_ADAPTER_VERSION',
    );
    expect(sourceText).toContain(REQUIRED_VERSION);
  });

  it('exports executeMLBShadowExecutionJob function', () => {
    expect(sourceText).toContain(
      'export async function executeMLBShadowExecutionJob',
    );
  });

  it('adapter takes unknown input (no pre-cast by caller)', () => {
    expect(sourceText).toContain('input: unknown');
  });
});
