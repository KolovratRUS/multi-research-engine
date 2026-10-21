/* -------------------------------------------------------------------------- */
/*  Boundary / sealing tests for the MLB Shadow Preparation Request Orchestrator */
/*  (P5F-C5)                                                                   */
/* -------------------------------------------------------------------------- */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SRC_ROOT = join(__dirname, '../../../src');
const ML_DIR = join(__dirname, '../../../src/prediction/mlb');

const ORCHESTRATOR_SOURCE = join(
  ML_DIR,
  'mlb-shadow-preparation-request-orchestrator.ts',
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
/*  Find all production files that mention a given string (excluding self).    */
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
/*  SHA-256 helper                                                             */
/* -------------------------------------------------------------------------- */
function sha256OfFile(path: string): string {
  const content = readFileSync(path);
  return createHash('sha256').update(content).digest('hex');
}

/* -------------------------------------------------------------------------- */
/*  Sealed-file expected hashes (from Section 15 — Seven Frozen Source Seals). */
/* -------------------------------------------------------------------------- */
const SEALED_FILES: ReadonlyArray<{
  readonly path: string;
  readonly expectedSha256: string;
  readonly expectedBytes: number;
}> = [
  {
    path: join(
      ML_DIR,
      'mlb-shadow-prepared-execution-job-v2-preparation.ts',
    ),
    expectedSha256:
      '297c42928d8577d0e7c6a487b84659b943fe64d55636089dbc4c45285a970340',
    expectedBytes: 10186,
  },
  {
    path: join(
      ML_DIR,
      'mlb-shadow-prepared-execution-job-v2-contract.ts',
    ),
    expectedSha256:
      '91c2e95d00c3675363afa04c1e39ef52daae01d3ef59f268ecfed5917f252a1b',
    expectedBytes: 14344,
  },
  {
    path: join(
      ML_DIR,
      'mlb-shadow-prepared-execution-job-v2-store.ts',
    ),
    expectedSha256:
      'b83c1a974d89d0cd354e177f2cb79bc463e21c09071e027e00572fa891343c2a',
    expectedBytes: 24830,
  },
  {
    path: join(
      ML_DIR,
      'mlb-shadow-prepared-execution-job-v2-reader.ts',
    ),
    expectedSha256:
      'c3ddc65ea871959ec228a90c5f4e6b5ff9860b0f13cbae5262f96102833bb57e',
    expectedBytes: 14601,
  },
  {
    path: join(
      ML_DIR,
      'mlb-shadow-prepared-execution-job-v2-handoff.ts',
    ),
    expectedSha256:
      '31f0b0d1c6a453e1d41557887b67966538a51f5c525d4f6d4e17914245ca8871',
    expectedBytes: 7351,
  },
  {
    path: join(
      ML_DIR,
      'mlb-shadow-execution-job-v2-contract.ts',
    ),
    expectedSha256:
      '04a0a759dffbdf91491ede491c24ff4bedf772707194d700e62f929da08d69b6',
    expectedBytes: 31363,
  },
  {
    path: join(
      ML_DIR,
      'mlb-shadow-candidate-003-authorized-model-artifact.ts',
    ),
    expectedSha256:
      '5e86bfa80ffa0dc8319ddb48f72e1c63efa052750be7e993cf09dd30d2ae7e27',
    expectedBytes: 34648,
  },
];

/* -------------------------------------------------------------------------- */
/*  C4 and C3 source paths (sealed, must remain unchanged)                     */
/* -------------------------------------------------------------------------- */
const C4_SOURCE = join(
  ML_DIR,
  'mlb-shadow-preparation-identity-store.ts',
);
const C3_SOURCE = join(
  ML_DIR,
  'mlb-shadow-prepared-execution-job-v2-preparation.ts',
);

/* -------------------------------------------------------------------------- */
/*  Prohibited import substrings for the C5 orchestrator.                     */
/* -------------------------------------------------------------------------- */
const PROHIBITED_IMPORTS: ReadonlyArray<string> = [
  'mlb-shadow-prepared-execution-job-v2-store',
  'mlb-shadow-prepared-execution-job-v2-reader',
  'mlb-shadow-prepared-execution-job-v2-handoff',
  'mlb-shadow-execution-adapter-v2',
  'mlb-shadow-execution-job-v2-contract',
  'mlb-shadow-monitoring-persistence-orchestrator',
  'mlb-shadow-monitoring-prediction-orchestrator',
  'mlb-shadow-monitoring-prediction-computation',
  'mlb-shadow-monitoring-prediction-store',
  'mlb-shadow-monitoring-operational-store',
  'mlb-monitoring-prediction-grading',
  'mlb-feature-vector-contract',
  'mlb-pregame-snapshot-contract',
  'mlb-real-pregame-winner-feature-manifest',
  'mlb-shadow-model-fingerprint',
  'mlb-logistic-regression-fit-contract',
  'mlb-shadow-monitoring-namespace',
  'mlb-prospective-holdout',
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
];

/* -------------------------------------------------------------------------- */
/*  Prohibited execution-function names in C5 source.                          */
/* -------------------------------------------------------------------------- */
const PROHIBITED_EXECUTE_PATTERNS: ReadonlyArray<string> = [
  'readMLBShadowPreparedExecutionJobV2',
  'executeStoredMLBShadowPreparedExecutionJobV2',
  'executeMLBShadowExecutionJobV2',
  'computeMLBShadowQuarantinedPredictionV2',
  'computeMLBShadowPrediction',
  'orchestrateMLBShadowMonitoring',
  'runMLBShadowExecutionJobV2',
  'fitMLBShadow',
  'captureMLBShadow',
  'K1',
  'K2',
];

/* -------------------------------------------------------------------------- */
/*  Expected exact 12-field C3 input assembly names.                          */
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
/*  C4 success statuses (Section 7)                                           */
/* -------------------------------------------------------------------------- */
const C4_SUCCESS_STATUSES = [
  'PERSISTED',
  'PERSISTED_WITH_CLEANUP_WARNING',
  'IDEMPOTENT_IDENTICAL_SUCCESS',
] as const;

/* -------------------------------------------------------------------------- */
/*  Allowed import sources for C5                                             */
/* -------------------------------------------------------------------------- */
const ALLOWED_ORCHESTRATOR_IMPORTS: ReadonlySet<string> = new Set([
  './mlb-shadow-preparation-identity-store',
  './mlb-shadow-prepared-execution-job-v2-preparation',
]);

/* -------------------------------------------------------------------------- */
/*  Source text (loaded once in beforeAll)                                     */
/* -------------------------------------------------------------------------- */
let source: string;

beforeAll(() => {
  source = readFileSync(ORCHESTRATOR_SOURCE, 'utf8');
});

/* ========================================================================== */
/*  A. Source existence and exports                                             */
/* ========================================================================== */

describe('mlb-shadow-preparation-request-orchestrator boundary', () => {
  it('A1. orchestrator source file exists in src/prediction/mlb', () => {
    const files = walk(SRC_ROOT).map((f) => f.replace(/.*\//, ''));
    expect(
      files.some((f) =>
        f.includes('mlb-shadow-preparation-request-orchestrator'),
      ),
    ).toBe(true);
  });

  it('A2. exact orchestration version literal', () => {
    expect(source).toContain(
      "'mlb-shadow-preparation-request-orchestrator-v1'",
    );
    expect(source).toContain(
      'MLB_SHADOW_PREPARATION_REQUEST_ORCHESTRATION_VERSION',
    );
  });

  it('A3. exact function name exported', () => {
    expect(source).toMatch(
      /export\s+async\s+function\s+orchestrateMLBShadowPreparation\b/,
    );
  });

  it('A4. request type exported', () => {
    expect(source).toMatch(
      /export\s+type\s+MLBShadowPreparationRequestOrchestrationRequest\b/,
    );
  });

  it('A5. result type exported with exactly three discriminants', () => {
    expect(source).toMatch(
      /export\s+type\s+MLBShadowPreparationRequestOrchestrationResult\b/,
    );
    expect(source).toContain("status: 'REGISTRY_FAILURE'");
    expect(source).toContain("status: 'PREPARATION_FAILURE'");
    expect(source).toContain("status: 'SUCCESS'");
  });

  it('A6. request type omits shadowRecordId', () => {
    expect(source).toMatch(
      /Omit<[^]*MLBShadowPreparedExecutionJobV2PreparationInput[^]*'shadowRecordId'[^]*>/,
    );
  });

  it('A7. request type adds repoRoot and preparationRequestId', () => {
    expect(source).toContain('readonly repoRoot: string');
    expect(source).toContain('readonly preparationRequestId: string');
  });

  it('A8. result type has no outer ok field', () => {
    const typeStartMarker =
      'export type MLBShadowPreparationRequestOrchestrationResult';
    const typeStart = source.indexOf(typeStartMarker);
    expect(typeStart).toBeGreaterThanOrEqual(0);
    const unionTerminator = source.indexOf(
      '>;',
      typeStart + typeStartMarker.length,
    );
    expect(unionTerminator).toBeGreaterThan(typeStart);
    const unionSection = source.slice(typeStart, unionTerminator + 2);
    expect(unionSection).not.toMatch(/\bok\s*:/);
  });

  /* ========================================================================== */
  /*  B. Import graph — C5 imports ONLY C4 and C3                               */
  /* ========================================================================== */

  it('B1. import sources are exactly C4 and C3 (2 unique)', () => {
    const imports = extractImportSources(source);
    const unique = new Set(imports);
    expect(unique.size).toBe(2);
    for (const imp of imports) {
      expect(ALLOWED_ORCHESTRATOR_IMPORTS.has(imp)).toBe(true);
    }
  });

  it('B2. C4 import present as runtime import', () => {
    expect(source).toMatch(
      /import\s*\{[^}]*resolveOrAllocateMLBShadowPreparationIdentity[^}]*\}\s*from\s*['"]\.\/mlb-shadow-preparation-identity-store['"]/,
    );
  });

  it('B3. C3 import present as runtime import', () => {
    expect(source).toMatch(
      /import\s*\{[^}]*prepareMLBShadowPreparedExecutionJobV2[^}]*\}\s*from\s*['"]\.\/mlb-shadow-prepared-execution-job-v2-preparation['"]/,
    );
  });

  it('B4. C4 type-only import present for result type', () => {
    expect(source).toMatch(
      /import\s+type\s*\{[^}]*MLBShadowPreparationIdentityResolutionResult[^}]*\}\s*from\s*['"]\.\/mlb-shadow-preparation-identity-store['"]/,
    );
  });

  it('B5. C3 type-only import present for input/result types', () => {
    expect(source).toMatch(
      /import\s+type\s*\{[^}]*MLBShadowPreparedExecutionJobV2PreparationInput[^}]*[}]*\}\s*from\s*['"]\.\/mlb-shadow-prepared-execution-job-v2-preparation['"]/,
    );
  });

  it('B6. no prohibited imports in source', () => {
    const imports = extractImportSources(source);
    for (const imp of imports) {
      for (const prohibited of PROHIBITED_IMPORTS) {
        expect(imp.includes(prohibited)).toBe(false);
      }
    }
  });

  it('B7. no node: core imports', () => {
    const imports = extractImportSources(source);
    expect(imports.some((s) => s.startsWith('node:'))).toBe(false);
  });

  it('B8. no network library imports', () => {
    const imports = extractImportSources(source);
    expect(imports.some((s) => s.includes('axios'))).toBe(false);
    expect(imports.some((s) => s.includes('undici'))).toBe(false);
  });

  it('B9. no C3 store / reader / handoff / adapter imports', () => {
    const imports = extractImportSources(source);
    expect(
      imports.some((s) => s.includes('mlb-shadow-prepared-execution-job-v2-store')),
    ).toBe(false);
    expect(
      imports.some((s) => s.includes('mlb-shadow-prepared-execution-job-v2-reader')),
    ).toBe(false);
    expect(
      imports.some((s) => s.includes('mlb-shadow-prepared-execution-job-v2-handoff')),
    ).toBe(false);
    expect(
      imports.some((s) => s.includes('mlb-shadow-execution-adapter-v2')),
    ).toBe(false);
  });

  it('B10. no scientific holdout / evidence / snapshot / manifest / model imports', () => {
    const imports = extractImportSources(source);
    const prohibited = [
      'mlb-shadow-monitoring-namespace',
      'mlb-feature-vector-contract',
      'mlb-pregame-snapshot-contract',
      'mlb-real-pregame-winner-feature-manifest',
      'mlb-shadow-model-fingerprint',
      'mlb-logistic-regression-fit-contract',
      'mlb-prospective-holdout',
      'mlb-real-pregame',
    ];
    for (const p of prohibited) {
      expect(imports.some((s) => s.includes(p))).toBe(false);
    }
  });

  /* ========================================================================== */
  /*  C. C3 input construction — explicit 12-field assembly                    */
  /* ========================================================================== */

  it('C1. preparedInput object has explicit field-by-field construction (no spread)', () => {
    expect(source).not.toMatch(/\.\.\.request\b/);
    expect(source).not.toMatch(/\.\.\.overrides\b/);
    // The 12 fields must appear as keys in the preparedInput object
    for (const field of EXPECTED_INPUT_FIELD_NAMES) {
      expect(source).toContain(field);
    }
  });

  it('C2. preparedInput explicitly excludes repoRoot', () => {
    expect(source).not.toMatch(
      /preparedInput.*repoRoot|repoRoot.*preparedInput/,
    );
    // The exact 12 field keys must be present in the object literal
    const inputStart = source.indexOf('const preparedInput');
    expect(inputStart).toBeGreaterThan(-1);
    const inputEnd = source.indexOf('};', inputStart);
    const inputBlock = source.slice(inputStart, inputEnd);
    expect(inputBlock).toContain('shadowRecordId');
    expect(Object.keys(
      // Verify no extra keys: count field assignments
      inputBlock.match(/(\w+):/g) || [],
    )).toHaveLength(12);
  });

  it('C3. preparedInput explicitly excludes preparationRequestId', () => {
    const inputStart = source.indexOf('const preparedInput');
    expect(inputStart).toBeGreaterThan(-1);
    const inputEnd = source.indexOf('};', inputStart);
    const inputBlock = source.slice(inputStart, inputEnd);
    expect(inputBlock).not.toContain('preparationRequestId');
  });

  it('C4. preparedInput explicitly excludes authorizedModelArtifact', () => {
    const inputStart = source.indexOf('const preparedInput');
    expect(inputStart).toBeGreaterThan(-1);
    const inputEnd = source.indexOf('};', inputStart);
    const inputBlock = source.slice(inputStart, inputEnd);
    expect(inputBlock).not.toContain('authorizedModelArtifact');
  });

  it('C5. optional fields use ?? null (not undefined)', () => {
    const inputStart = source.indexOf('const preparedInput');
    const inputEnd = source.indexOf('};', inputStart);
    const inputBlock = source.slice(inputStart, inputEnd);
    // Every optional field must be coerced with ?? null
    expect(inputBlock).toContain('?? null');
  });

  it('C6. shadowRecordId comes from registryResult (not from request)', () => {
    expect(source).toContain('registryResult.shadowRecordId');
    expect(source).not.toMatch(/request\.shadowRecordId/);
  });

  it('C7. C3 called with request.repoRoot as first arg', () => {
    expect(source).toMatch(
      /await\s+prepareMLBShadowPreparedExecutionJobV2\(\s*request\.repoRoot/,
    );
  });

  /* ========================================================================== */
  /*  D. Orchestration order — C4 before C3                                    */
  /* ========================================================================== */

  it('D1. C4 call appears before C3 call in source', () => {
    const c4Idx = source.indexOf('resolveOrAllocateMLBShadowPreparationIdentity(');
    const c3Idx = source.indexOf('prepareMLBShadowPreparedExecutionJobV2(');
    expect(c4Idx).toBeGreaterThan(-1);
    expect(c3Idx).toBeGreaterThan(-1);
    expect(c4Idx).toBeLessThan(c3Idx);
  });

  it('D2. C4 failure short-circuits before C3 call', () => {
    const c4FailIdx = source.indexOf('!registryResult.ok');
    const c3Idx = source.indexOf('prepareMLBShadowPreparedExecutionJobV2(');
    expect(c4FailIdx).toBeGreaterThan(-1);
    expect(c4FailIdx).toBeLessThan(c3Idx);
  });

  it('D3. on C4 failure, C3 is NOT called (guard before C3)', () => {
    // The return statement for REGISTRY_FAILURE is between the C4 ok check
    // and the C3 call
    const c4FailIdx = source.indexOf('!registryResult.ok');
    const returnFailureIdx = source.indexOf(
      "status: 'REGISTRY_FAILURE'",
      c4FailIdx,
    );
    const c3Idx = source.indexOf('prepareMLBShadowPreparedExecutionJobV2(');
    expect(returnFailureIdx).toBeGreaterThan(c4FailIdx);
    expect(returnFailureIdx).toBeLessThan(c3Idx);
  });

  it('D4. C4 accepted success statuses are PERSISTED, PERSISTED_WITH_CLEANUP_WARNING, IDEMPOTENT_IDENTICAL_SUCCESS', () => {
    // C5 uses `registryResult.ok` (ok=true) as the gate; the C4 store defines
    // these three statuses as ok=true.  C5 does not hard-code individual
    // statuses — it checks the discriminant.
    expect(source).toContain('registryResult.ok');
    expect(source).not.toMatch(/VERIFICATION_FAILED/);
  });

  it('D5. C3 success gate: kind === STORE_RESULT AND result.ok', () => {
    expect(source).toContain("preparationResult.kind === 'STORE_RESULT'");
    expect(source).toContain('preparationResult.result.ok');
  });

  it('D6. C3 STORE_RESULT with ok=false falls through to PREPARATION_FAILURE', () => {
    // The SUCCESS return is inside an if block; any C3 path that does NOT
    // satisfy the gate reaches the final PREPARATION_FAILURE return.
    const successIdx = source.indexOf("status: 'SUCCESS' as const");
    const failureIdx = source.indexOf("status: 'PREPARATION_FAILURE' as const");
    expect(successIdx).toBeGreaterThan(-1);
    expect(failureIdx).toBeGreaterThan(successIdx);
  });

  /* ========================================================================== */
  /*  E. Result immutability (Object.freeze on all returns)                     */
  /* ========================================================================== */

  it('E1. Object.freeze used for REGISTRY_FAILURE result', () => {
    const idx = source.indexOf("status: 'REGISTRY_FAILURE' as const");
    expect(idx).toBeGreaterThan(-1);
    const section = source.slice(Math.max(0, idx - 200), idx + 200);
    expect(section).toContain('Object.freeze');
  });

  it('E2. Object.freeze used for SUCCESS result', () => {
    const idx = source.indexOf("status: 'SUCCESS' as const");
    expect(idx).toBeGreaterThan(-1);
    const section = source.slice(Math.max(0, idx - 200), idx + 200);
    expect(section).toContain('Object.freeze');
  });

  it('E3. Object.freeze used for PREPARATION_FAILURE result', () => {
    const idx = source.indexOf("status: 'PREPARATION_FAILURE' as const");
    expect(idx).toBeGreaterThan(-1);
    const section = source.slice(Math.max(0, idx - 200), idx + 200);
    expect(section).toContain('Object.freeze');
  });

  it('E4. three result categories, three Object.freeze calls', () => {
    const freezeCount = (source.match(/Object\.freeze/g) || []).length;
    expect(freezeCount).toBe(3);
  });

  /* ========================================================================== */
  /*  F. No clock / randomness / ID generation                                  */
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
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/retry/i);
  });

  it('F10. no internal retry / while / loop', () => {
    expect(source).not.toMatch(/\bfor\s*\(/);
    expect(source).not.toMatch(/\bwhile\s*\(/);
    expect(source).not.toMatch(/\bdo\s*\{/);
  });

  /* ========================================================================== */
  /*  G. Production importer dormancy — zero production importers of C5         */
  /* ========================================================================== */

  it('G1. C5 orchestrator has zero production importers', () => {
    const importers = findImporters(
      'mlb-shadow-preparation-request-orchestrator',
      ORCHESTRATOR_SOURCE,
    );
    expect(importers).toEqual([]);
  });

  it('G2. no production module mentions the orchestrator function', () => {
    const mentioners = findMentioners(
      'orchestrateMLBShadowPreparation',
      ORCHESTRATOR_SOURCE,
    );
    expect(mentioners).toEqual([]);
  });

  it('G3. C4 identity store importers unchanged (only C5 imports C4)', () => {
    // C5 is the only new production importer of C4
    const importers = findImporters(
      'mlb-shadow-preparation-identity-store',
      C4_SOURCE,
    );
    // At minimum, C5 must be the only NEW importer; existing importers may
    // exist in other phases but C5 must be present
    const c5Importer = importers.find((f) =>
      f.includes('mlb-shadow-preparation-request-orchestrator'),
    );
    expect(c5Importer).toBeTruthy();
  });

  it('G4. C3 preparation importers unchanged (only C5 imports C3)', () => {
    const importers = findImporters(
      'mlb-shadow-prepared-execution-job-v2-preparation',
      C3_SOURCE,
    );
    const c5Importer = importers.find((f) =>
      f.includes('mlb-shadow-preparation-request-orchestrator'),
    );
    expect(c5Importer).toBeTruthy();
  });

  /* ========================================================================== */
  /*  H. Sealed source hashes — C4 and C3 unchanged                              */
  /* ========================================================================== */

  it('H1. C3 preparation source SHA256 + byte count match sealed baseline', () => {
    const sha = sha256OfFile(C3_SOURCE);
    const bytes = statSync(C3_SOURCE).size;
    const sealed = SEALED_FILES.find((f) =>
      f.path.endsWith('mlb-shadow-prepared-execution-job-v2-preparation.ts'),
    );
    expect(sealed).toBeDefined();
    expect(sha).toBe(sealed!.expectedSha256);
    expect(bytes).toBe(sealed!.expectedBytes);
  });

  it('H2. all seven sealed source files unchanged', () => {
    for (const sealed of SEALED_FILES) {
      const sha = sha256OfFile(sealed.path);
      const bytes = statSync(sealed.path).size;
      expect(sha).toBe(sealed.expectedSha256);
      expect(bytes).toBe(sealed.expectedBytes);
    }
  });

  /* ========================================================================== */
  /*  I. No contract module created for C5                                       */
  /* ========================================================================== */

  it('I1. no mlb-shadow-preparation-request-contract.ts exists (no separate contract module)', () => {
    const contractPath = join(
      ML_DIR,
      'mlb-shadow-preparation-request-contract.ts',
    );
    expect(() => statSync(contractPath)).toThrow();
  });

  /* ========================================================================== */
  /*  J. No execution / dispatch / monitoring patterns                          */
  /* ========================================================================== */

  it('J1. no prohibited execution function names in source', () => {
    for (const pattern of PROHIBITED_EXECUTE_PATTERNS) {
      expect(source).not.toContain(pattern);
    }
  });

  it('J2. no scheduler references', () => {
    expect(source).not.toMatch(/cron|scheduler|bull/i);
  });

  it('J3. no CLI references', () => {
    expect(source).not.toMatch(/commander|yargs|cli/i);
  });

  it('J4. no K1/K2 capture module references', () => {
    expect(source).not.toContain('K1');
    expect(source).not.toContain('K2');
    expect(source).not.toContain('mlb-prospective-holdout-capture');
  });

  /* ========================================================================== */
  /*  K. No network / fetch                                                    */
  /* ========================================================================== */

  it('K1. no fetch in source', () => {
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });

  /* ========================================================================== */
  /*  L. No scientific prediction / outcome / pricing fields                   */
  /* ========================================================================== */

  it('L1. result type does not contain probability / outcome / recommendation fields', () => {
    const resultTypeStart = source.indexOf(
      'export type MLBShadowPreparationRequestOrchestrationResult',
    );
    const resultTypeEnd = source.indexOf('>;', resultTypeStart);
    expect(resultTypeEnd).toBeGreaterThan(resultTypeStart);
    const resultTypeSection = source.slice(resultTypeStart, resultTypeEnd + 2);
    expect(resultTypeSection).not.toMatch(/probability/i);
    expect(resultTypeSection).not.toMatch(/predictedWinner/i);
    expect(resultTypeSection).not.toMatch(/recommendation/i);
    expect(resultTypeSection).not.toMatch(/modelCoefficients/i);
    expect(resultTypeSection).not.toMatch(/outcome/i);
    expect(resultTypeSection).not.toMatch(/grading/i);
    expect(resultTypeSection).not.toMatch(/odds/i);
    expect(resultTypeSection).not.toMatch(/sportsbook/i);
    expect(resultTypeSection).not.toMatch(/book/i);
  });

  it('L2. source contains no odds or sportsbook references', () => {
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '');
    const lower = codeOnly.toLowerCase();
    expect(lower).not.toContain('sportsbook');
    expect(lower).not.toContain('odds');
    expect(lower).not.toContain('bookmaker');
    expect(lower).not.toContain('vig');
    expect(lower).not.toContain('juice');
  });
});
