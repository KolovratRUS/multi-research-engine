/* -------------------------------------------------------------------------- */
/*  Boundary / sealing tests for the dormant preparation producer (P5F-C3)     */
/*  Phase: 8V-D3-C-E4-B4-I3G-LIVE1-L5E2X-P5F-C3                               */
/* -------------------------------------------------------------------------- */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SRC_ROOT = join(__dirname, '../../../src');
const ML_DIR = join(__dirname, '../../../src/prediction/mlb');

const PREPARATION_SOURCE = join(
  ML_DIR,
  'mlb-shadow-prepared-execution-job-v2-preparation.ts',
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
/*  Find all production files that import a given module substring.            */
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
/*  Find all production files that mention a given string (excluding self).     */
/* -------------------------------------------------------------------------- */
function findMentioners(text: string, excludeSelf: string = ''): string[] {
  const allFiles = walk(SRC_ROOT);
  const mentioners: string[] = [];
  for (const file of allFiles) {
    if (file === excludeSelf) continue;
    const content = readFileSync(file, 'utf8');
    if (content.includes(text)) {
      mentioners.push(file);
    }
  }
  return mentioners.sort();
}

/* -------------------------------------------------------------------------- */
/*  Sealed file paths (for exclusion in importer checks)                       */
/* -------------------------------------------------------------------------- */
const STORE_SOURCE = join(
  ML_DIR,
  'mlb-shadow-prepared-execution-job-v2-store.ts',
);
const READER_SOURCE = join(
  ML_DIR,
  'mlb-shadow-prepared-execution-job-v2-reader.ts',
);
const HANDOFF_SOURCE = join(
  ML_DIR,
  'mlb-shadow-prepared-execution-job-v2-handoff.ts',
);
const ELIGIBILITY_SOURCE = join(
  ML_DIR,
  'mlb-shadow-prepared-job-dispatch-eligibility.ts',
);
const ADAPTER_SOURCE = join(
  ML_DIR,
  'mlb-shadow-execution-adapter-v2.ts',
);
const ORCHESTRATOR_SOURCE = join(
  ML_DIR,
  'mlb-shadow-preparation-request-orchestrator.ts',
);

/* -------------------------------------------------------------------------- */
/*  Exact 12-field raw-shape names (Section 8)                                  */
/* -------------------------------------------------------------------------- */
const EXPECTED_INPUT_FIELD_NAMES = [
  'shadowRecordId',
  'gamePk',
  'predictionGeneratedAt',
  'featureManifest',
  'snapshot',
  'officialDate',
  'scheduledStartAt',
  'latencyMs',
  'featureManifestId',
  'featureManifestFingerprint',
  'timingReferenceContractVersion',
  'timingReferenceCutoffAt',
] as const;

/* -------------------------------------------------------------------------- */
/*  Exact 13-field prepared job names (Section 12)                              */
/* -------------------------------------------------------------------------- */
const EXPECTED_PREPARED_JOB_FIELD_NAMES = [
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
] as const;

/* -------------------------------------------------------------------------- */
/*  Prohibited import substrings for the preparation producer                 */
/* -------------------------------------------------------------------------- */
const PROHIBITED_IMPORTS: ReadonlyArray<string> = [
  'mlb-shadow-prepared-execution-job-v2-reader',
  'mlb-shadow-prepared-execution-job-v2-handoff',
  'mlb-shadow-execution-adapter-v2',
  'mlb-shadow-execution-job-v2-contract',
  'mlb-shadow-monitoring-persistence-orchestrator-v2',
  'mlb-shadow-monitoring-prediction-orchestrator-v2',
  'mlb-shadow-monitoring-prediction-computation-v2',
  'mlb-shadow-monitoring-prediction-store',
  'mlb-shadow-monitoring-operational-store',
  'mlb-monitoring-prediction-grading-v2',
  'mlb-feature-vector-contract',
  'mlb-pregame-snapshot-contract',
  'mlb-real-pregame-winner-feature-manifest-v1',
  'mlb-shadow-monitoring-namespace',
  'mlb-shadow-model-fingerprint',
  'mlb-logistic-regression-fit-contract',
  'mlb-model-test-release-contract',
  'mlb-outer-validation-promotion-contract',
  'mlb-shadow-outer-validation-promotion-contract',
  'node:fs',
  'node:path',
  'node:crypto',
  'node:http',
  'node:https',
  'node:os',
  'node:process',
  'axios',
  'undici',
  'node:cron',
  'bull',
  'bullmq',
  'agenda',
  'mlb-prospective-holdout',
  'mlb-real-pregame',
];

/* -------------------------------------------------------------------------- */
/*  Prohibited execution-function names                                       */
/* -------------------------------------------------------------------------- */
const PROHIBITED_EXECUTE_PATTERNS: ReadonlyArray<string> = [
  'readMLBShadowPreparedExecutionJobV2',
  'executeStoredMLBShadowPreparedExecutionJobV2',
  'executeMLBShadowExecutionJobV2',
  'computeMLBShadowQuarantinedPredictionV2',
  'computeMLBShadowPrediction',
  'orchestrateMLBShadow',
  'runMLBShadowExecutionJobV2',
  'fitMLBShadow',
  'captureMLBShadow',
  'K1',
  'K2',
];

/* -------------------------------------------------------------------------- */
/*  Allowed import sources for the preparation producer                        */
/* -------------------------------------------------------------------------- */
const ALLOWED_PREPARATION_IMPORTS: ReadonlySet<string> = new Set([
  './mlb-shadow-prepared-execution-job-v2-store',
  './mlb-shadow-candidate-003-authorized-model-artifact',
  './mlb-shadow-prepared-execution-job-v2-contract',
]);

const PREPARATION_SOURCE_DIR = ML_DIR;

/* ========================================================================== */
/*  A. Source existence and exports                                           */
/* ========================================================================== */

describe('mlb-shadow-prepared-execution-job-v2-preparation boundary', () => {
  let source: string;

  beforeAll(() => {
    source = readFileSync(PREPARATION_SOURCE, 'utf8');
  });

  /* A1. preparation source file exists in src/prediction/mlb */
  it('A1. preparation source file exists in src/prediction/mlb', () => {
    const files = walk(SRC_ROOT).map((f) => f.replace(/.*\//, ''));
    expect(
      files.some((f) =>
        f.includes('mlb-shadow-prepared-execution-job-v2-preparation'),
      ),
    ).toBe(true);
  });

  /* A2. exact version literal */
  it('A2. exact preparation version literal', () => {
    expect(source).toContain(
      "'mlb-shadow-prepared-execution-job-v2-preparation-v1'",
    );
    expect(source).toContain(
      'MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_PREPARATION_VERSION',
    );
  });

  /* A3. exact function name */
  it('A3. exact function name exported', () => {
    expect(source).toMatch(
      /export\s+async\s+function\s+prepareMLBShadowPreparedExecutionJobV2\b/,
    );
  });

  /* A4. input type export exists */
  it('A4. MLBShadowPreparedExecutionJobV2PreparationInput type exported', () => {
    expect(source).toContain(
      'MLBShadowPreparedExecutionJobV2PreparationInput',
    );
    expect(source).toMatch(
      /export\s+type\s+MLBShadowPreparedExecutionJobV2PreparationInput\s*=/,
    );
  });

  /* A5. result type export exists */
  it('A5. MLBShadowPreparedExecutionJobV2PreparationResult type exported', () => {
    expect(source).toContain(
      'MLBShadowPreparedExecutionJobV2PreparationResult',
    );
    expect(source).toMatch(
      /export\s+type\s+MLBShadowPreparedExecutionJobV2PreparationResult\s*=/,
    );
  });

  /* A6. exact kind literals */
  it('A6. exact kind literals: INPUT_REJECTED, STORE_RESULT, PREPARATION_FAILURE', () => {
    expect(source).toContain("kind: 'INPUT_REJECTED'");
    expect(source).toContain("kind: 'STORE_RESULT'");
    expect(source).toContain("kind: 'PREPARATION_FAILURE'");
  });

  /* A7. exact status literals */
  it('A7. exact status literals: PREPARATION_INPUT_INVALID, PREPARATION_UNEXPECTED_FAILURE', () => {
    expect(source).toContain("status: 'PREPARATION_INPUT_INVALID'");
    expect(source).toContain("status: 'PREPARATION_UNEXPECTED_FAILURE'");
  });

  /* A8. NO outer ok field in producer envelopes */
  it('A8. no outer ok field in the result union (isolated through terminating >;)', () => {
    // Isolate the FULL outer union declaration: from the export type marker
    // through the `>;` that terminates the union (the `>` of the final
    // Readonly<{...}> followed by the declaration's terminating `;`). This
    // delimiter is unique to the type terminator -- interior statements end
    // with bare `;`, interior branches end with `}>` followed by `|`.
    const typeStartMarker =
      'export type MLBShadowPreparedExecutionJobV2PreparationResult';
    const typeStart = source.indexOf(typeStartMarker);
    expect(typeStart).toBeGreaterThanOrEqual(0);
    const unionTerminator = source.indexOf(
      '>;',
      typeStart + typeStartMarker.length,
    );
    expect(unionTerminator).toBeGreaterThan(typeStart);
    const unionSection = source.slice(typeStart, unionTerminator + 2);
    // Sanity: the isolated section spans the full union (last branch present)
    expect(unionSection).toContain("kind: 'PREPARATION_FAILURE'");
    expect(unionSection).not.toMatch(/\bok\s*:/);
  });

  /* ========================================================================== */
  /*  B. Import graph                                                           */
  /* ========================================================================== */

  /* B1. import sources are exactly the 3 allowed */
  it('B1. import sources are exactly: store, candidate-003, prepared contract', () => {
    const imports = extractImportSources(source);
    const importSet = new Set(imports);
    expect(importSet.size).toBe(3);
    for (const imp of imports) {
      expect(ALLOWED_PREPARATION_IMPORTS.has(imp)).toBe(true);
    }
  });

  /* B2. prepared contract import is type-only */
  it('B2. prepared contract is imported as type-only (import type)', () => {
    expect(source).toMatch(/import type\s*\{[^}]*\}\s*from\s*['"]\.\/mlb-shadow-prepared-execution-job-v2-contract['"]/);
  });

  /* B3. store import is NOT type-only (mixed runtime + type) */
  it('B3. prepared store is NOT imported as type-only', () => {
    expect(source).not.toMatch(/import type\s*\{[^}]*\}\s*from\s*['"]\.\/mlb-shadow-prepared-execution-job-v2-store['"]/);
  });

  /* B4. candidate-003 import is NOT type-only */
  it('B4. candidate-003 artifact is NOT imported as type-only', () => {
    expect(source).not.toMatch(/import type\s*\{[^}]*\}\s*from\s*['"]\.\/mlb-shadow-candidate-003-authorized-model-artifact['"]/);
  });

  /* B5. no prohibited imports */
  it('B5. no prohibited import substrings present', () => {
    const imports = extractImportSources(source);
    for (const imp of imports) {
      for (const prohibited of PROHIBITED_IMPORTS) {
        expect(imp.includes(prohibited)).toBe(false);
      }
    }
  });

  /* B6. no direct V2 execution-job-contract import */
  it('B6. no import of V2 execution-job-contract', () => {
    const imports = extractImportSources(source);
    expect(imports.some((s) => s.includes('mlb-shadow-execution-job-v2-contract'))).toBe(false);
  });

  /* B7. no reader, handoff, or adapter imports */
  it('B7. no reader / handoff / adapter imports', () => {
    const imports = extractImportSources(source);
    expect(imports.some((s) => s.includes('mlb-shadow-prepared-execution-job-v2-reader'))).toBe(false);
    expect(imports.some((s) => s.includes('mlb-shadow-prepared-execution-job-v2-handoff'))).toBe(false);
    expect(imports.some((s) => s.includes('mlb-shadow-execution-adapter-v2'))).toBe(false);
  });

  /* B8. no computation / orchestrator / store imports */
  it('B8. no computation / orchestrator / operational-store imports', () => {
    const imports = extractImportSources(source);
    const prohibited = [
      'mlb-shadow-monitoring-prediction-computation-v2',
      'mlb-shadow-monitoring-persistence-orchestrator-v2',
      'mlb-shadow-monitoring-prediction-orchestrator-v2',
      'mlb-shadow-monitoring-prediction-store',
      'mlb-shadow-monitoring-operational-store',
    ];
    for (const p of prohibited) {
      expect(imports.some((s) => s.includes(p))).toBe(false);
    }
  });

  /* B9. no namespace / feature / snapshot / manifest imports */
  it('B9. no namespace / feature / snapshot / manifest module imports', () => {
    const imports = extractImportSources(source);
    const prohibited = [
      'mlb-shadow-monitoring-namespace',
      'mlb-feature-vector-contract',
      'mlb-pregame-snapshot-contract',
      'mlb-real-pregame-winner-feature-manifest-v1',
    ];
    for (const p of prohibited) {
      expect(imports.some((s) => s.includes(p))).toBe(false);
    }
  });

  /* B10. no Node core / network imports */
  it('B10. no Node core or network library imports', () => {
    const imports = extractImportSources(source);
    expect(imports.some((s) => s.startsWith('node:'))).toBe(false);
    expect(imports.some((s) => s.includes('axios'))).toBe(false);
    expect(imports.some((s) => s.includes('undici'))).toBe(false);
  });

  /* ========================================================================== */
  /*  C. Raw-shape gate                                                         */
  /* ========================================================================== */

  /* C1. exact 12-field raw-shape names in EXPECTED_INPUT_FIELD_NAMES */
  it('C1. exactly 12 expected field names in EXPECTED_INPUT_FIELD_NAMES', () => {
    const fieldListSection = source.slice(
      source.indexOf('EXPECTED_INPUT_FIELD_NAMES'),
      source.indexOf('] as const', source.indexOf('EXPECTED_INPUT_FIELD_NAMES')) + 10,
    );
    for (const field of EXPECTED_INPUT_FIELD_NAMES) {
      expect(fieldListSection).toContain(`'${field}'`);
    }
    expect(fieldListSection.match(/'[^']+'/g)).toHaveLength(12);
  });

  /* C2. own property names inspection present */
  it('C2. Object.getOwnPropertyNames used on input', () => {
    expect(source).toMatch(/Object\.getOwnPropertyNames\(input\)/);
  });

  /* C3. own symbol inspection present */
  it('C3. Object.getOwnPropertySymbols used on input', () => {
    expect(source).toMatch(/Object\.getOwnPropertySymbols\(input\)/);
  });

  /* C4. own property descriptor inspection present */
  it('C4. Object.getOwnPropertyDescriptor used on input', () => {
    expect(source).toMatch(/Object\.getOwnPropertyDescriptor\(input/);
  });

  /* C5. accessor rejection present (get/set in descriptor) */
  it('C5. descriptor accessor rejection present', () => {
    expect(source).toMatch(/['"]get['"]\s+in\s+descriptor/);
    expect(source).toMatch(/['"]set['"]\s+in\s+descriptor/);
  });

  /* C6. no direct untrusted input.<field> access */
  it('C6. no direct property access on untrusted input for any of the 12 fields', () => {
    for (const field of EXPECTED_INPUT_FIELD_NAMES) {
      const pattern = new RegExp(`input\\.${field}(?!\\w)`);
      expect(pattern.test(source)).toBe(false);
    }
  });

  /* C7. no bracket access input[...] for raw values */
  it('C7. no bracket notation input[...] access', () => {
    expect(source).not.toMatch(/input\[/);
  });

  /* C8. no object spread of input */
  it('C8. no spread of input (...input)', () => {
    expect(source).not.toMatch(/\.\.\.input\b/);
  });

  /* C9. no Object.assign with input */
  it('C9. no Object.assign usage', () => {
    expect(source).not.toMatch(/Object\.assign/);
  });

  /* ========================================================================== */
  /*  D. Prepared job construction                                               */
  /* ========================================================================== */

  /* D1. explicit 13-field job construction */
  it('D1. explicit 13-field prepared job construction', () => {
    const jobStart = source.indexOf('preparedJob');
    const jobSection = source.slice(jobStart, source.length);
    const jobEnd = jobSection.indexOf('};');
    const jobBlock = jobSection.slice(0, jobEnd);
    for (const field of EXPECTED_PREPARED_JOB_FIELD_NAMES) {
      expect(jobBlock).toContain(field);
    }
  });

  /* D2. input type does NOT include authorizedModelArtifact */
  it('D2. input type is Omit<..., authorizedModelArtifact>', () => {
    expect(source).toMatch(/Omit<[^>]*authorizedModelArtifact[^>]*>/);
  });

  /* D3. candidate getter called exactly once in source */
  it('D3. candidate getter invoked exactly once (after gate)', () => {
    const matches = source.match(/getMLBShadowCandidate003AuthorizedModelArtifact/g);
    // 1 import + 1 call = 2
    expect(matches).toHaveLength(2);
  });

  /* D4. store function called exactly once in source */
  it('D4. store persist function invoked exactly once (after gate)', () => {
    const matches = source.match(/persistMLBShadowPreparedExecutionJobV2/g);
    // 1 import + 1 call = 2
    expect(matches).toHaveLength(2);
  });

  /* D5. no retry loop */
  it('D5. no retry loop', () => {
    expect(source).not.toMatch(/retry/);
  });

  /* D6. no recursive self-call */
  it('D6. no recursive self-call of prepareMLBShadowPreparedExecutionJobV2', () => {
    // The function name should appear only in the declaration, not in a call
    const functionName = 'prepareMLBShadowPreparedExecutionJobV2';
    // Count occurrences: should be 1 (declaration only)
    const matches = source.match(new RegExp(`\\b${functionName}\\b`, 'g'));
    expect(matches).toHaveLength(1);
  });

  /* ========================================================================== */
  /*  E. Envelope shapes and immutability                                       */
  /* ========================================================================== */

  /* E1. INPUT_REJECTED envelope: frozen, correct fields, no ok */
  it('E1. INPUT_REJECTED envelope: preparationVersion + kind + status, no ok', () => {
    const funcStart = source.indexOf('function createInputRejectedEnvelope');
    const funcSection = source.slice(funcStart);
    expect(funcSection).toContain('Object.freeze');
    expect(funcSection).toContain("kind: 'INPUT_REJECTED'");
    expect(funcSection).toContain("status: 'PREPARATION_INPUT_INVALID'");
    expect(funcSection).toContain('preparationVersion');
  });

  /* E2. STORE_RESULT envelope: frozen, correct fields, no ok */
  it('E2. STORE_RESULT envelope: preparationVersion + kind + result, no ok', () => {
    // Use `as const` to find the runtime return (not the type definition)
    const returnIdx = source.indexOf("kind: 'STORE_RESULT' as const");
    expect(returnIdx).toBeGreaterThan(-1);
    const beforeReturn = source.slice(Math.max(0, returnIdx - 300), returnIdx);
    const afterReturn = source.slice(returnIdx, returnIdx + 300);
    expect(beforeReturn).toContain('preparationVersion');
    expect(beforeReturn).toContain('Object.freeze');
    expect(afterReturn).toContain('result: storeResult');
  });

  /* E3. PREPARATION_FAILURE envelope: frozen, correct fields, no ok */
  it('E3. PREPARATION_FAILURE envelope: preparationVersion + kind + status, no ok', () => {
    const catchIdx = source.indexOf('} catch {');
    const catchSection = source.slice(catchIdx);
    expect(catchSection).toContain('Object.freeze');
    expect(catchSection).toContain("kind: 'PREPARATION_FAILURE' as const");
    expect(catchSection).toContain("status: 'PREPARATION_UNEXPECTED_FAILURE' as const");
    expect(catchSection).toContain('preparationVersion');
  });

  /* E4. Object.freeze used for all three envelope paths */
  it('E4. Object.freeze used for all three envelope paths (3+ freeze calls)', () => {
    const freezeMatches = source.match(/Object\.freeze/g);
    expect(freezeMatches).not.toBeNull();
    expect(freezeMatches!.length).toBeGreaterThanOrEqual(3);
  });

  /* E5. nested store result NOT frozen or cloned by producer */
  it('E5. store result passed by reference — no freeze/clone on storeResult', () => {
    const storeCallSection = source.slice(
      source.indexOf('persistMLBShadowPreparedExecutionJobV2('),
      source.indexOf(';', source.indexOf('persistMLBShadowPreparedExecutionJobV2(')),
    );
    // The store result variable should not be frozen or cloned
    expect(storeCallSection).not.toMatch(/Object\.freeze\([^)]*storeResult/);
    // The STORE_RESULT envelope should pass storeResult by reference, not clone it
    const storeResultEnvelope = source.slice(
      source.indexOf("kind: 'STORE_RESULT'"),
    );
    expect(storeResultEnvelope).toContain('result: storeResult');
  });

  /* ========================================================================== */
  /*  F. No clock / randomness / ID generation                                 */
  /* ========================================================================== */

  it('F1. no Date.now', () => {
    expect(source).not.toMatch(/Date\.now\s*\(/);
  });

  it('F2. no new Date', () => {
    expect(source).not.toMatch(/new\s+Date\s*\(/);
  });

  it('F3. no Math.random', () => {
    expect(source).not.toMatch(/Math\.random\s*\(/);
  });

  it('F4. no performance.now', () => {
    expect(source).not.toMatch(/performance\.now/);
  });

  it('F5. no randomUUID', () => {
    expect(source).not.toMatch(/randomUUID/);
  });

  it('F6. no randomBytes', () => {
    expect(source).not.toMatch(/randomBytes/);
  });

  it('F7. no crypto', () => {
    expect(source).not.toMatch(/crypto/);
  });

  it('F8. no uuid / nanoid', () => {
    expect(source).not.toMatch(/\buuid\b/i);
    expect(source).not.toMatch(/\bnanoid\b/i);
  });

  it('F9. no retry loop', () => {
    expect(source).not.toMatch(/retry/i);
    expect(source).not.toMatch(/retry\s*[:(=]/i);
  });

  /* ========================================================================== */
  /*  G. Production importer dormancy (Section 31)                               */
  /* ========================================================================== */

  /* G1. preparation producer has exactly one authorized importer: C5 */
  it('G1. preparation producer has exactly one authorized importer: C5', () => {
    const importers = findImporters(
      'mlb-shadow-prepared-execution-job-v2-preparation',
    );
    expect(importers).toEqual([ORCHESTRATOR_SOURCE]);
  });

  /* G2. handoff production importers = 0 */
  it('G2. handoff has zero production importers', () => {
    const importers = findImporters(
      'mlb-shadow-prepared-execution-job-v2-handoff',
    );
    expect(importers).toEqual([]);
  });

  /* G3. prepared store production importers = preparation producer only */
  it('G3. prepared store has exactly one production importer: the preparation producer', () => {
    const importers = findImporters(
      'mlb-shadow-prepared-execution-job-v2-store',
      STORE_SOURCE,
    );
    expect(importers).toEqual([
      join(
        ML_DIR,
        'mlb-shadow-prepared-execution-job-v2-preparation.ts',
      ),
    ]);
  });

  /* G4. prepared reader production importers = handoff + C6 eligibility (P5F-C6) */
  it('G4. prepared reader has exactly two production importers: handoff + C6', () => {
    const importers = findImporters(
      'mlb-shadow-prepared-execution-job-v2-reader',
      READER_SOURCE,
    );
    expect(importers).toEqual([HANDOFF_SOURCE, ELIGIBILITY_SOURCE]);
  });

  /* G5. V2 adapter production importers = handoff only */
  it('G5. V2 adapter has exactly one production importer: the handoff', () => {
    const importers = findImporters(
      'mlb-shadow-execution-adapter-v2',
      ADAPTER_SOURCE,
    );
    expect(importers).toEqual([HANDOFF_SOURCE]);
  });

  /* G6. V2 adapter production callers = handoff only */
  it('G6. executeMLBShadowExecutionJobV2 is called by handoff only', () => {
    const callers = findMentioners('executeMLBShadowExecutionJobV2(', ADAPTER_SOURCE);
    expect(callers).toEqual([HANDOFF_SOURCE]);
  });

  /* G7. V2 adapter module mentioners = handoff only (excluding adapter self) */
  it('G7. V2 adapter module mentioned by handoff only (excluding adapter self)', () => {
    const mentioners = findMentioners(
      'mlb-shadow-execution-adapter-v2',
      ADAPTER_SOURCE,
    );
    expect(mentioners).toEqual([HANDOFF_SOURCE]);
  });

  /* ========================================================================== */
  /*  H. Execution-layer separation (Section 22)                                */
  /* ========================================================================== */

  /* H1. no execution-layer function names in source */
  it('H1. no execution / reader / compute function references', () => {
    for (const pattern of PROHIBITED_EXECUTE_PATTERNS) {
      expect(source).not.toContain(pattern);
    }
  });

  /* H2. no scheduler references */
  it('H2. no scheduler references', () => {
    expect(source).not.toMatch(/cron|scheduler|bull/i);
  });

  /* H3. no CLI references */
  it('H3. no CLI references', () => {
    expect(source).not.toMatch(/commander|yargs|cli/i);
  });

  /* H4. no K1/K2 capture references */
  it('H4. no K1/K2 capture module references', () => {
    expect(source).not.toContain('K1');
    expect(source).not.toContain('K2');
    expect(source).not.toContain('mlb-prospective-holdout-capture');
    expect(source).not.toContain('captureOrchestrator');
    expect(source).not.toContain('captureAdapter');
  });

  /* ========================================================================== */
  /*  I. No network / fetch                                                     */
  /* ========================================================================== */

  it('I1. no fetch in source', () => {
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });

  it('I2. no network library imports in source', () => {
    const imports = extractImportSources(source);
    expect(imports.some((s) => s.includes('axios'))).toBe(false);
    expect(imports.some((s) => s.includes('undici'))).toBe(false);
    expect(imports.some((s) => s.startsWith('node:http'))).toBe(false);
    expect(imports.some((s) => s.startsWith('node:https'))).toBe(false);
  });

  /* ========================================================================== */
  /*  J. No prediction payload in result type                                   */
  /* ========================================================================== */

  it('J1. no prediction outcome fields in result type', () => {
    const resultTypeStart = source.indexOf(
      'export type MLBShadowPreparedExecutionJobV2PreparationResult',
    );
    const resultTypeSection = source.slice(resultTypeStart);
    expect(resultTypeSection).not.toMatch(/probability/i);
    expect(resultTypeSection).not.toMatch(/predictedWinner/i);
    expect(resultTypeSection).not.toMatch(/recommendation/i);
    expect(resultTypeSection).not.toMatch(/modelCoefficients/i);
    expect(resultTypeSection).not.toMatch(/outcome/i);
    expect(resultTypeSection).not.toMatch(/grading/i);
  });
});
