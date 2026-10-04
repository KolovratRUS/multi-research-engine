/* -------------------------------------------------------------------------- */
/*  Boundary audit: mlb-shadow-execution-job-contract.ts                       */
/* -------------------------------------------------------------------------- */
/*  This audit test reads the PRODUCTION contract source (not the test) and      */
/*  asserts the L5E2V-C1 boundary invariants:                                    */
/*    - direct imports are limited to pure contracts/validators                */
/*    - no runtime generators (Date.now / new Date / randomUUID / randomBytes / */
/*      Math.random)                                                               */
/*    - no L5E2U invocation / persistence / capture / scheduler / network      */
/*    - no filesystem / http access                                              */
/*                                                                              */
/*  node:fs / node:url / node:path are used HERE solely as audit tooling to     */
/*  read the production source text; they are NOT present in the audited source. */
/*  Comments are stripped before pattern audits so that documentation text      */
/*  (which may name a generator while asserting its absence) does not cause     */
/*  false positives.                                                            */
/* -------------------------------------------------------------------------- */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const CONTRACT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../src/prediction/mlb/mlb-shadow-execution-job-contract.ts',
);

let sourceText: string;
try {
  sourceText = readFileSync(CONTRACT_PATH, 'utf8');
} catch (error) {
  throw new Error(
    `Boundary audit cannot read contract source at ${CONTRACT_PATH}: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}

/**
 * Strip comments (/* ... *​/ and // ... ) so documentation that names forbidden
 * APIs does not trigger false positives in the code-level audits. Safe for this
 * contract: no string literal contains `//` or `/* *​/` sequences.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, '');
}

const codeSource = stripComments(sourceText);

/* -------------------------------------------------------------------------- */
/*  Allowed + forbidden module sets                                            */
/* -------------------------------------------------------------------------- */
// Direct imports the contract is permitted to carry (pure contracts/validators).
const ALLOWED_IMPORT_BASENAMES: ReadonlySet<string> = new Set<string>([
  'mlb-model-test-release-contract',
  'mlb-shadow-model-fingerprint',
  'mlb-feature-vector-contract',
  'mlb-real-pregame-winner-feature-manifest-v1',
  'mlb-pregame-snapshot-contract',
]);

// Substrings that must NEVER appear in the contract's direct imports.
const FORBIDDEN_IMPORT_SUBSTRINGS: ReadonlyArray<string> = [
  'mlb-shadow-monitoring-persistence-orchestrator',
  'mlb-shadow-monitoring-prediction-orchestrator',
  'mlb-shadow-monitoring-prediction-store',
  'mlb-shadow-monitoring-operational-store',
  'mlb-prospective-holdout-capture',
  'mlb-prospective-holdout-scheduler',
  'mlb-prospective-holdout-activation',
  'mlb-inner-development-train-artifact',
  'mlb-inner-development-candidate',
  'mlb-inner-development-real-candidate-execution',
  'MLBResearchDataAdapter',
  'src/lib/research-data',
  'node:fs',
  'node:fs/promises',
  'node:http',
  'node:https',
];

// Runtime generators that must never appear in the contract code.
const FORBIDDEN_RUNTIME_PATTERNS: ReadonlyArray<RegExp> = [
  /Date\.now\b/,
  /new\s+Date\b/,
  /randomUUID\b/,
  /randomBytes\b/,
  /Math\.random\b/,
];

// L5E2U / execution / persistence symbols that must never appear in the contract.
const FORBIDDEN_SYMBOLS: ReadonlyArray<string> = [
  'orchestrateMLBShadowMonitoringPredictionPersistence',
  'inferMLBOfflinePregameWinner',
  'extractMLBLeakageSafeFeatureVector',
  'MLBResearchDataAdapter',
  'fetchRecentGamesBefore',
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */
function extractImportPaths(src: string): string[] {
  const paths: string[] = [];
  const re = /from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    paths.push(m[1] ?? m[2]);
  }
  return paths;
}

function basenameOf(path: string): string {
  return path.split('/').pop() ?? '';
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                    */
/* -------------------------------------------------------------------------- */
describe('L5E2V-C1 boundary audit: mlb-shadow-execution-job-contract.ts', () => {
  it('direct imports are limited to pure contracts/validators', () => {
    const imports = extractImportPaths(codeSource);
    expect(imports.length).toBeGreaterThan(0);
    for (const path of imports) {
      const base = basenameOf(path);
      expect(
        ALLOWED_IMPORT_BASENAMES.has(base),
        `Non-allowlisted direct import: ${path} (basename ${base})`,
      ).toBe(true);
    }
  });

  it('no forbidden module is imported', () => {
    const imports = extractImportPaths(codeSource);
    for (const path of imports) {
      for (const forbidden of FORBIDDEN_IMPORT_SUBSTRINGS) {
        expect(
          path.toLowerCase().includes(forbidden.toLowerCase()),
          `Forbidden import substring "${forbidden}" present in: ${path}`,
        ).toBe(false);
      }
    }
  });

  it('source contains no sportsbook/market/data-adapter imports', () => {
    for (const forbidden of ['sportsbook', 'bookmaker', 'marketconsensus']) {
      const importLine = new RegExp(
        String.raw`from\s+['"][^'"]*${forbidden}[^'"]*['"]`,
        'i',
      );
      expect(importLine.test(codeSource)).toBe(false);
    }
  });

  it('no runtime generators present in source code', () => {
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      expect(
        pattern.test(codeSource),
        `Forbidden runtime generator pattern found: ${pattern}`,
      ).toBe(false);
    }
  });

  it('no L5E2U invocation / persistence / capture / network symbols', () => {
    for (const sym of FORBIDDEN_SYMBOLS) {
      expect(
        new RegExp(`\\b${sym}\\b`).test(codeSource),
        `Forbidden symbol found in contract source: ${sym}`,
      ).toBe(false);
    }
  });

  it('contract does not import node:fs / node:http (no filesystem or network)', () => {
    expect(/node:(fs|fs\/promises|http|https)\b/.test(codeSource)).toBe(false);
  });

  it('contract exports the version constant and validator', () => {
    expect(sourceText).toContain('MLB_SHADOW_EXECUTION_JOB_CONTRACT_VERSION');
    expect(sourceText).toContain(
      "MLB_SHADOW_EXECUTION_JOB_CONTRACT_VERSION =\n  'mlb-shadow-execution-job-v1'",
    );
    expect(sourceText).toContain('function validateMLBShadowExecutionJob(');
    expect(sourceText).toContain('export type MLBShadowExecutionJobV1');
  });

  it('contract does not define sportsbook/prohibited job fields in the type', () => {
    const prohibitedFieldNames = [
      'predictedWinner',
      'predictedSide',
      'homeWinProbability',
      'awayWinProbability',
      'decisionPolicy',
      'predictionPayloadHash',
      'payloadHash',
      'resultPayloadHash',
      'outcome',
      'correct',
      'correctness',
      'grading',
      'performance',
      'sportsbook',
      'odds',
      'line',
      'spread',
      'total',
      'impliedProbability',
      'marketProbability',
      'value',
      'edge',
      'expectedValue',
    ];
    const startMatch = sourceText.match(
      /export type MLBShadowExecutionJobV1 = Readonly<\{[\s\S]*?\}>;/,
    );
    expect(startMatch).not.toBeNull();
    const typeBlock = startMatch ? startMatch[0] : '';
    for (const name of prohibitedFieldNames) {
      const propRe = new RegExp(String.raw`\b${name}\s*:`);
      expect(
        propRe.test(typeBlock),
        `Prohibited field "${name}" present in MLBShadowExecutionJobV1`,
      ).toBe(false);
    }
  });
});
