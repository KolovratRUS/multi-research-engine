/* -------------------------------------------------------------------------- */
/*  Boundary audit: mlb-shadow-prepared-execution-job-v2-handoff.ts            */
/*  Phase: 8V-D3-C-E4-B4-I3G-LIVE1-L5E2X-P5F-C2B-R1                           */
/* -------------------------------------------------------------------------- */
/*  Reads the PRODUCTION handoff source (not the test) and asserts the         */
/*  P5F-C2B-R1 boundary invariants:                                            */
/*    - imports limited to the prepared reader + V2 execution adapter modules   */
/*    - no forbidden imports (prepared contract, prepared store,               */
/*      V2 execution-job-contract, persistence orchestrator, namespace,         */
/*      Node core modules)                                                      */
/*    - no clock / randomness / filesystem I/O / console / logger              */
/*    - no object spread for job reconstruction (explicit 14-field object)      */
/*    - no V2 validator call (adapter remains final V2 job authority)           */
/*    - exact kind-tagged result union (no outer `ok` field)                   */
/*    - reader called exactly once, adapter called exactly once on success      */
/*    - no retry, no recursion                                                    */
/*    - no production source imports the handoff (dormant)                     */
/*                                                                            */
/*  node:fs / node:path are used HERE solely as audit tooling to read the      */
/*  production source. They are NOT present in the audited handoff source.     */
/*  Comments are stripped before pattern audits to avoid false positives.      */
/* -------------------------------------------------------------------------- */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

/* -------------------------------------------------------------------------- */
/*  Locate the handoff source and src root                                    */
/* -------------------------------------------------------------------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ML_DIR = join(__dirname, '../../../src/prediction/mlb');
const SRC_ROOT = join(__dirname, '../../../src');

const HANDOFF_SOURCE_PATH = join(
  ML_DIR,
  'mlb-shadow-prepared-execution-job-v2-handoff.ts',
);

let sourceText: string;
try {
  sourceText = readFileSync(HANDOFF_SOURCE_PATH, 'utf8');
} catch (error) {
  throw new Error(
    `Boundary audit cannot read handoff source at ${HANDOFF_SOURCE_PATH}: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Strip /* ... *\/ and // comments so documentation text does not cause
 *  false positives in code-level audits.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, '');
}

function extractImportSources(content: string): string[] {
  const sources: string[] = [];
  const re =
    /import\s+(?:type\s+)?(?:[^'"]+?)\s+from\s+['"]([^'"]+)['"]/g;
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
const importPaths = extractImportSources(sourceCode);

/** Only the prepared reader + V2 execution adapter are permitted. */
const ALLOWED_IMPORT_BASENAMES: ReadonlySet<string> = new Set([
  'mlb-shadow-prepared-execution-job-v2-reader',
  'mlb-shadow-execution-adapter-v2',
]);

/** Forbidden import basenames — exact match. */
const FORBIDDEN_IMPORT_BASENAMES: ReadonlySet<string> = new Set([
  'mlb-shadow-prepared-execution-job-v2-contract',
  'mlb-shadow-prepared-execution-job-v2-store',
  'mlb-shadow-execution-job-v2-contract',
  'mlb-shadow-monitoring-persistence-orchestrator-v2',
  'mlb-shadow-monitoring-prediction-orchestrator-v2',
  'mlb-shadow-monitoring-prediction-orchestrator-v2',
  'mlb-shadow-monitoring-prediction-computation',
  'mlb-shadow-monitoring-prediction-computation-v2',
  'mlb-shadow-monitoring-prediction-store',
  'mlb-shadow-monitoring-operational-store',
  'mlb-shadow-monitoring-operational-projection',
  'mlb-shadow-monitoring-record-contract',
  'mlb-shadow-monitoring-quarantine-contract',
  'mlb-shadow-monitoring-namespace',
  'mlb-shadow-monitoring-firewall',
  'mlb-shadow-candidate-003-authorized-model-artifact',
  'mlb-real-pregame-winner-feature-manifest-v1',
  'mlb-feature-vector-contract',
  'mlb-pregame-snapshot-contract',
  'mlb-shadow-model-fingerprint',
  'mlb-offline-pregame-inference-contract',
  'mlb-model-test-release-contract',
  'mlb-logistic-regression-fit-contract',
  'mlb-shadow-execution-adapter',
  'mlb-shadow-execution-job-contract',
]);

/** Forbidden Node import substrings. */
const FORBIDDEN_NODE_IMPORTS: ReadonlyArray<string> = [
  'node:fs',
  'node:fs/promises',
  'node:path',
  'node:crypto',
  'node:os',
  'node:process',
  'node:http',
  'node:https',
  'node:stream',
  'axios',
  'undici',
];

/** Forbidden runtime patterns (checks stripped source). */
const FORBIDDEN_RUNTIME_PATTERNS: ReadonlyArray<RegExp> = [
  /Date\.now\b/,
  /new\s+Date\b/,
  /performance\.now\b/,
  /Math\.random\b/,
  /randomUUID\b/,
  /randomBytes\b/,
  /\bfetch\s*\(/,
  /process\.argv/,
  /process\.env/,
  /\.console\b/,
  /\blogger\b/,
];

/** Forbidden conceptual references (K1/K2/scheduler/etc.). */
const FORBIDDEN_REFERENCES: ReadonlyArray<RegExp> = [
  /\bK1\b/,
  /\bK2\b/,
  /\bscheduler\b/i,
  /\bcapture\b/i,
  /\bactivation\b/i,
  /\bTRAIN\b/,
  /\btrain\b/i,
  /\bgrade\b/i,
  /\bgrading\b/i,
];

/** Forbidden call patterns (source-level, comments stripped). */
const FORBIDDEN_CALL_PATTERNS: ReadonlyArray<RegExp> = [
  /validateMLBShadowExecutionJobV2\s*\(/,
  /\bawait\s+readMLBShadowPreparedExecutionJobV2\s*\(\s*[^,]*,\s*[^,]*\)\s*\.\s*readMLBShadowPreparedExecutionJobV2/,
];

/** Lower-layer function calls that must NOT appear. */
const FORBIDDEN_FUNCTION_CALLS: ReadonlyArray<string> = [
  'computeMLBShadowQuarantinedPrediction',
  'computeMLBShadowQuarantinedPredictionV2',
  'persistMLBShadowPreparedExecutionJobV2',
  'persistMLBShadowQuarantinedPrediction',
  'persistMLBShadowMonitoringPredictionOperationalRecord',
  'buildMLBShadowPredictionOperationalRecord',
  'runMLBShadowExecutionJobV2',
  'runMLBShadowQuarantinePrediction',
];

const REQUIRED_VERSION = 'mlb-shadow-prepared-execution-job-v2-handoff-v1';
const REQUIRED_FUNCTION =
  'export async function executeStoredMLBShadowPreparedExecutionJobV2';
const REQUIRED_TYPE =
  'export type MLBShadowPreparedExecutionJobV2HandoffResult';
const HANDOFF_MODULE_NAME = 'mlb-shadow-prepared-execution-job-v2-handoff';

const EXPECTED_JOB_KEYS: ReadonlyArray<string> = [
  'repoRoot',
  'shadowRecordId',
  'gamePk',
  'predictionGeneratedAt',
  'authorizedModelArtifact',
  'featureManifest',
  'snapshot',
  'officialDate',
  'scheduledStartAt',
  'latencyMs',
  'featureManifestId',
  'featureManifestFingerprint',
  'timingReferenceContractVersion',
  'timingReferenceCutoffAt',
];

const PRODUCTION_RUNTIME_PATH = join(
  process.cwd(),
  'var/mlb-development/mlb-shadow-monitoring',
);

/* -------------------------------------------------------------------------- */
/*  Tests: existence + exports                                              */
/* -------------------------------------------------------------------------- */

describe('handoff source existence + exports', () => {
  it('S1. handoff source file exists in src/prediction/mlb', () => {
    const files = walk(SRC_ROOT).map((f) => f.replace(/.*\//, ''));
    expect(
      files.some((f) =>
        f.includes('mlb-shadow-prepared-execution-job-v2-handoff'),
      ),
    ).toBe(true);
  });

  it('S2. exports exact version literal', () => {
    expect(sourceText).toContain(REQUIRED_VERSION);
    expect(sourceText).toContain(
      'export const MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_HANDOFF_VERSION',
    );
  });

  it('S3. exports executeStoredMLBShadowPreparedExecutionJobV2', () => {
    expect(sourceText).toContain(REQUIRED_FUNCTION);
  });

  it('S4. exports MLBShadowPreparedExecutionJobV2HandoffResult type', () => {
    expect(sourceText).toContain(REQUIRED_TYPE);
  });

  it('S5. does NOT export prepared value type alias', () => {
    expect(sourceText).not.toMatch(
      /export\s+type\s+MLBShadowPreparedExecutionJobV2Value\b/,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*  Tests: classification invariants (source-level proof)                     */
/* -------------------------------------------------------------------------- */

describe('handoff classification invariants', () => {
  it('S6. QUARANTINED_INTERNAL_EXECUTION classification present', () => {
    expect(sourceText).toContain('QUARANTINED_INTERNAL_EXECUTION');
  });

  it('S7. S1 operational read prohibited', () => {
    expect(sourceText).toContain('S1 operational read');
    expect(sourceText).toMatch(/PROHIBITED/);
  });

  it('S8. public operational API prohibited', () => {
    expect(sourceText).toMatch(/Public operational API.*PROHIBITED/);
  });

  it('S9. direct-user API prohibited', () => {
    expect(sourceText).toMatch(/Direct user API.*PROHIBITED/);
  });

  it('S10. scientific transformation = NO', () => {
    expect(sourceText).toMatch(/Scientific transformation.*NO/);
  });

  it('S11. runtime-only injection = repoRoot (caller-supplied)', () => {
    expect(sourceText).toMatch(
      /Runtime-only injection.*repoRoot.*caller-supplied/,
    );
  });
});

/* -------------------------------------------------------------------------- */
/*  Tests: import boundary                                                   */
/* -------------------------------------------------------------------------- */

describe('handoff import boundary', () => {
  it('S12. imports only allowed project modules (reader + adapter)', () => {
    expect(importPaths.length).toBeGreaterThan(0);
    for (const path of importPaths) {
      const base = basenameOf(path);
      if (base.startsWith('node:') || base === 'fs' || base === 'path') {
        expect.fail(
          `Forbidden Node import in handoff: ${path}`,
        );
      }
      if (base.startsWith('./') || base.startsWith('@/')) {
        expect(
          ALLOWED_IMPORT_BASENAMES.has(base),
          `Non-allowlisted project import: ${path} (basename ${base})`,
        ).toBe(true);
      }
    }
  });

  it('S13. IMPORT_BOUNDARY = PASS (whitelist clean)', () => {
    const disallowed = importPaths.filter(
      (p) =>
        !ALLOWED_IMPORT_BASENAMES.has(basenameOf(p)) &&
        !p.startsWith('node:') &&
        p !== 'fs' &&
        p !== 'path',
    );
    expect(disallowed).toEqual([]);
  });

  it('S14. does NOT import prepared-contract', () => {
    expect(sourceCode).not.toContain(
      'mlb-shadow-prepared-execution-job-v2-contract',
    );
  });

  it('S15. does NOT import prepared-store', () => {
    expect(sourceCode).not.toContain(
      'mlb-shadow-prepared-execution-job-v2-store',
    );
  });

  it('S16. does NOT import V2 execution-job-contract', () => {
    expect(sourceCode).not.toContain(
      'mlb-shadow-execution-job-v2-contract',
    );
  });

  it('S17. does NOT import persistence orchestrator', () => {
    expect(sourceCode).not.toContain(
      'mlb-shadow-monitoring-persistence-orchestrator-v2',
    );
  });

  it('S18. does NOT import namespace', () => {
    expect(sourceCode).not.toContain(
      'mlb-shadow-monitoring-namespace',
    );
  });

  it('S19. does NOT import Node core modules', () => {
    for (const path of importPaths) {
      for (const forbidden of FORBIDDEN_NODE_IMPORTS) {
        expect(
          !path.toLowerCase().includes(forbidden.toLowerCase()),
          `Forbidden Node import: ${path}`,
        ).toBe(true);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Tests: no clock / randomness / fs / console / logger                     */
/* -------------------------------------------------------------------------- */

describe('handoff no-clock / no-randomness / no-fs / no-logger', () => {
  it('S20. no runtime generators (clock + random)', () => {
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      expect(
        !pattern.test(sourceCode),
        `Forbidden runtime pattern: ${pattern}`,
      ).toBe(true);
    }
  });

  it('S21. no forbidden conceptual references', () => {
    for (const pattern of FORBIDDEN_REFERENCES) {
      expect(
        !pattern.test(sourceCode),
        `Forbidden reference: ${pattern}`,
      ).toBe(true);
    }
  });

  it('S22. no lower-layer function calls', () => {
    for (const fnName of FORBIDDEN_FUNCTION_CALLS) {
      const pattern = new RegExp(
        `\\b${fnName}\\s*\\(`,
      );
      expect(
        !pattern.test(sourceCode),
        `Forbidden function call: ${fnName}(`,
      ).toBe(true);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Tests: result union / kind literals / no outer ok                        */
/* -------------------------------------------------------------------------- */

describe('handoff result contract', () => {
  it('S23. has exact kind literals: READER_FAILURE, ADAPTER_RESULT, HANDOFF_FAILURE', () => {
    expect(sourceText).toContain("'READER_FAILURE'");
    expect(sourceText).toContain("'ADAPTER_RESULT'");
    expect(sourceText).toContain("'HANDOFF_FAILURE'");
  });

  it('S24. NO outer ok field on any result envelope', () => {
    /*
     * The handoff result type is a kind-tagged union with no `ok` discriminant.
     * Object.freeze return blocks must not include `ok:` as a field.
     * (The Extract<..., { readonly ok: false }> type-level filter is allowed.)
     */
    const freezeBlocks = sourceCode.match(
      /Object\.freeze\(\{[\s\S]*?\}\)/g,
    );
    expect(freezeBlocks).not.toBeNull();
    if (freezeBlocks === null) {
      throw new Error(
        'Expected Object.freeze result-envelope blocks in handoff source',
      );
    }
    for (const block of freezeBlocks) {
      expect(
        !block.match(/ok\s*:/),
        `Found ok: in a freeze block: ${block}`,
      ).toBe(true);
    }
  });

  it('S25. ADAPTER_RESULT carries full MLBShadowExecutionAdapterV2Result', () => {
    expect(sourceText).toContain('result: MLBShadowExecutionAdapterV2Result');
  });

  it('S26. NO Extract<AdapterResult, {ok:true}> or {ok:false} patterns', () => {
    expect(sourceText).not.toContain('Extract<MLBShadowExecutionAdapterV2Result');
    expect(sourceText).not.toContain(
      "Extract<MLBShadowExecutionAdapterV2Result, { readonly ok: true }>",
    );
    expect(sourceText).not.toContain(
      "Extract<MLBShadowExecutionAdapterV2Result, { readonly ok: false }>",
    );
  });

  it('S27. exact HANDOFF_UNEXPECTED_FAILURE spelling (no misspelling)', () => {
    expect(sourceText).toContain("'HANDOFF_UNEXPECTED_FAILURE'");
    expect(sourceText).not.toContain('HANDOFF_UNEXPECTENT_FAILURE');
    expect(sourceText).not.toContain('HANDOFF_UNEXPECTENT_FAIL');
    expect(sourceText).not.toContain('HANDOFF_UNEXPECTED_FAILING');
  });

  it('S28. READER_FAILURE fields: handoffVersion, kind, readerVersion, status', () => {
    expect(sourceText).toMatch(/kind:\s*'READER_FAILURE'/);
    expect(sourceText).toMatch(/readerVersion:/);
    expect(sourceText).toMatch(/status:\s*readerResult\.status/);
  });

  it('S29. ADAPTER_RESULT fields: handoffVersion, kind, adapterVersion, result', () => {
    expect(sourceText).toMatch(/kind:\s*'ADAPTER_RESULT'/);
    expect(sourceText).toMatch(/adapterVersion:/);
    expect(sourceText).toMatch(/result:\s*adapterResult/);
  });

  it('S30. HANDOFF_FAILURE fields: handoffVersion, kind, status', () => {
    expect(sourceText).toMatch(/kind:\s*'HANDOFF_FAILURE'/);
    expect(sourceText).toMatch(/status:\s*'HANDOFF_UNEXPECTED_FAILURE'/);
  });
});

/* -------------------------------------------------------------------------- */
/*  Tests: job construction (explicit 14 fields, no spread)                   */
/* -------------------------------------------------------------------------- */

describe('handoff job construction', () => {
  it('S31. no object spread for job reconstruction (no ...prepared or ...readerResult)', () => {
    expect(sourceCode).not.toMatch(/\.\.\.prepared\b/);
    expect(sourceCode).not.toMatch(/\.\.\.readerResult\b/);
    expect(sourceCode).not.toMatch(/\.\.\.readerResult\.value\b/);
    expect(sourceCode).not.toMatch(/\.\.\.value\b/);
  });

  it('S32. explicit 14-field object construction on reader success', () => {
    for (const key of EXPECTED_JOB_KEYS) {
      expect(sourceText).toContain(`${key}:`);
    }
  });

  it('S33. repoRoot is from caller, not from reader result', () => {
    expect(sourceText).toMatch(/repoRoot:\s*repoRoot/);
  });

  it('S34. no V2 validator call in handoff', () => {
    expect(sourceCode).not.toMatch(/validateMLBShadowExecutionJobV2\s*\(/);
  });

  it('S35. calls reader exactly once (single call site)', () => {
    const matches = sourceCode.match(
      /\breadMLBShadowPreparedExecutionJobV2\s*\(/g,
    );
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });

  it('S36. calls adapter exactly once (single call site)', () => {
    const matches = sourceCode.match(
      /\bexecuteMLBShadowExecutionJobV2\s*\(/g,
    );
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });

  it('S37. no retry loop (no for/while/do-while around calls)', () => {
    expect(sourceCode).not.toMatch(/\bfor\s*\(/);
    expect(sourceCode).not.toMatch(/\bwhile\s*\(/);
    expect(sourceCode).not.toMatch(/\bdo\s*\{/);
  });

  it('S38. no recursive self-call', () => {
    expect(sourceCode).not.toMatch(
      /executeStoredMLBShadowPreparedExecutionJobV2\s*\(.*?\)\s*\./,
    );
  });

  it('S39. Object.freeze used on envelopes (immutability)', () => {
    expect(sourceText).toContain('Object.freeze');
  });
});

/* -------------------------------------------------------------------------- */
/*  Tests: dormant / non-interference boundary                               */
/* -------------------------------------------------------------------------- */

describe('handoff dormant / non-interference boundary', () => {
  it('S40. no production source imports the handoff (HANDOFF_PRODUCTION_IMPORTERS = 0)', () => {
    const handoffBasename = basenameOf(HANDOFF_SOURCE_PATH);
    const allSourceFiles = walk(SRC_ROOT);
    const importers: string[] = [];
    for (const file of allSourceFiles) {
      if (file === HANDOFF_SOURCE_PATH) {
        continue; // skip the handoff itself
      }
      const content = readFileSync(file, 'utf8');
      const imports = extractImportSources(content);
      if (
        imports.some((s) => basenameOf(s).includes(handoffBasename))
      ) {
        importers.push(file);
      }
    }
    expect(importers).toEqual([]);
  });

  it('S41. no production source calls executeStoredMLBShadowPreparedExecutionJobV2', () => {
    const fnName = 'executeStoredMLBShadowPreparedExecutionJobV2';
    const allSourceFiles = walk(SRC_ROOT);
    const callers: string[] = [];
    for (const file of allSourceFiles) {
      if (file === HANDOFF_SOURCE_PATH) {
        continue; // the definition itself
      }
      const content = readFileSync(file, 'utf8');
      if (content.includes(fnName + '(')) {
        callers.push(file);
      }
    }
    expect(callers).toEqual([]);
  });

  it('S42. no production source mentions the handoff module name', () => {
    const allSourceFiles = walk(SRC_ROOT);
    const offenders: string[] = [];
    for (const file of allSourceFiles) {
      if (file === HANDOFF_SOURCE_PATH) {
        continue;
      }
      const content = readFileSync(file, 'utf8');
      if (content.includes(HANDOFF_MODULE_NAME)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('S43. handoff source contains QUARANTINED_INTERNAL_EXECUTION classification comment', () => {
    expect(sourceText).toContain('QUARANTINED_INTERNAL_EXECUTION');
  });

  it('S44. reader call precedes adapter call in source order', () => {
    const readerIdx = sourceCode.indexOf('readMLBShadowPreparedExecutionJobV2(');
    const adapterIdx = sourceCode.indexOf('executeMLBShadowExecutionJobV2(');
    expect(readerIdx).toBeGreaterThanOrEqual(0);
    expect(adapterIdx).toBeGreaterThanOrEqual(0);
    expect(readerIdx).toBeLessThan(adapterIdx);
  });

  it('S45. production shadow monitoring runtime has zero files', async () => {
    const count = await countRuntimeFiles();
    expect(count).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  Recursive file counter for production runtime path                         */
/* -------------------------------------------------------------------------- */

async function countRuntimeFiles(): Promise<number> {
  return countFilesRecursive(PRODUCTION_RUNTIME_PATH);
}

async function countFilesRecursive(dir: string): Promise<number> {
  let count = 0;
  try {
    const entries = await import('node:fs/promises').then((fsPromises) =>
      fsPromises.readdir(dir, { withFileTypes: true }),
    );
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        count += await countFilesRecursive(full);
      } else {
        count += 1;
      }
    }
  } catch {
    /* directory does not exist — 0 files */
  }
  return count;
}
