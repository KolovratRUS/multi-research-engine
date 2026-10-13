/* -------------------------------------------------------------------------- */
/*  V2 persistence orchestrator import + public-contract boundary audit      */
/* -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/* -- Production file under audit -- */
const SRC_ROOT = resolve(process.cwd(), 'src/prediction/mlb');
const ORCHESTRATOR_FILE = 'mlb-shadow-monitoring-persistence-orchestrator-v2.ts';
const orchestratorPath = resolve(SRC_ROOT, ORCHESTRATOR_FILE);
const orchestratorSource = readFileSync(orchestratorPath, 'utf-8');

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function extractImportPaths(content: string): string[] {
  const paths: string[] = [];
  const re = /import\s+(?:type\s+)?(?:[^'"`;]+?)\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    paths.push(match[1]);
  }
  const se = /import\s+['"]([^'"]+)['"]/g;
  while ((match = se.exec(content)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

/**
 * Returns the source with comment-only lines removed.
 * Lines starting with `//`, `*`, `/*`, or `\\*` (JSDoc body) are stripped.
 * This prevents explanatory comments from tripping forbidden-token assertions.
 */
function stripCommentLines(content: string): string {
  return content
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//')) return false;
      if (trimmed.startsWith('*')) return false;
      if (trimmed.startsWith('/*')) return false;
      return true;
    })
    .join('\n');
}

/* -------------------------------------------------------------------------- */
/*  Allowed (whitelist) imports — V2 persistence orchestrator may only     */
/*  depend on these modules                                                */
/* -------------------------------------------------------------------------- */

const ALLOWED_IMPORTS = [
  './mlb-shadow-monitoring-prediction-orchestrator-v2',
  './mlb-shadow-monitoring-operational-store',
  './mlb-shadow-monitoring-record-contract',
];

/* -------------------------------------------------------------------------- */
/*  Forbidden exact import paths — must never appear as an import in the      */
/*  V2 persistence orchestrator. Uses EXACT matching (not substring) so        */
/*  that the allowed V2 imports (e.g. ...-v2) are not falsely caught.          */
/* -------------------------------------------------------------------------- */

const FORBIDDEN_EXACT_IMPORTS: ReadonlyArray<string> = [
  './mlb-shadow-monitoring-prediction-orchestrator',
  './mlb-shadow-monitoring-persistence-orchestrator',
  './mlb-shadow-monitoring-prediction-computation-v2',
  './mlb-shadow-monitoring-prediction-computation',
  './mlb-shadow-monitoring-prediction-store',
  './mlb-shadow-monitoring-operational-projection',
  './mlb-shadow-monitoring-opaqueness-projection',
  './mlb-shadow-monitoring-opaqueness-store',
  './mlb-shadow-execution-adapter',
  './mlb-shadow-execution-adapter-v2',
  './mlb-shadow-execution-job-contract',
  './mlb-shadow-execution-job-v2-contract',
  './mlb-model-test-release-contract',
  './mlb-shadow-model-fingerprint',
  './mlb-offline-pregame-inference-contract',
  './mlb-shadow-candidate-003-authorized-model-artifact',
  './mlb-real-pregame-winner-feature-manifest-v1',
  './mlb-pregame-snapshot-contract',
  './mlb-shadow-monitoring-quarantine-contract',
  './mlb-shadow-monitoring-namespace',
  'node:fs',
  'node:fs/promises',
  'node:http',
  'node:https',
  'node:net',
  'axios',
  'undici',
  'got',
  'node-fetch',
];

/* -------------------------------------------------------------------------- */
/*  Forbidden code tokens — must never appear in non-comment source code      */
/* -------------------------------------------------------------------------- */

const FORBIDDEN_CODE_PATTERNS: RegExp[] = [
  /Date\.now\s*\(/,
  /new Date\s*\(/,
  /performance\.now\s*\(/,
  /Math\.random\s*\(/,
  /randomUUID\s*\(/,
  /randomBytes\s*\(/,
  /\breadFileSync\b/,
  /\bwriteFileSync\b/,
  /\breadFile\b/,
  /\bwriteFile\b/,
  /\bunlink\b/,
  /\brename\b/,
  /\brmSync\b/,
  /\brm\s*\(/,
  /\bmkdir\b/,
  /\bappendFile\b/,
  /\bstatSync\b/,
];

/* -------------------------------------------------------------------------- */
/*  Forbidden property references — sensitive prediction data                    */
/* -------------------------------------------------------------------------- */

const FORBIDDEN_PROPERTY_REFS = [
  'predictedWinner',
  'predictedSide',
  'homeWinProbability',
  'awayWinProbability',
  'payloadHash',
  'modelFingerprint',
  'fittedModelFingerprint',
  'coefficients',
  'intercept',
  'probabilities',
  'authorizedModelArtifact',
  'releasedModelResult',
  'MLBModelTestReleaseResult',
  'snapshot',
  'featureManifest',
];

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('L5E2U-V2 import boundary — V2 persistence orchestrator', () => {
  const importPaths = extractImportPaths(orchestratorSource);

  it('imports only allowed L5E2S-v2, L5E2T, and safe-contract modules', () => {
    const disallowed = importPaths.filter((p) => !ALLOWED_IMPORTS.includes(p));
    expect(disallowed).toEqual([]);
  });

  it('L5E2U_IMPORT_BOUNDARY = PASS (whitelist clean)', () => {
    const disallowed = importPaths.filter((p) => !ALLOWED_IMPORTS.includes(p));
    if (disallowed.length > 0) {
      throw new Error(
        `Disallowed imports in V2 persistence orchestrator: ${disallowed.join(', ')}`,
      );
    }
    expect(true).toBe(true);
  });

  it('does not import V1 prediction orchestrator, V1 persistence orchestrator, or computation/store/adapter/fingerprint/contract modules', () => {
    const violations = importPaths.filter((imp) =>
      FORBIDDEN_EXACT_IMPORTS.includes(imp),
    );
    expect(violations).toEqual([]);
  });

  it('does not import node:fs or node:fs/promises directly', () => {
    const fsViolations = importPaths.filter(
      (p) => p === 'node:fs' || p === 'node:fs/promises',
    );
    expect(fsViolations).toEqual([]);
  });

  it('does not import any network client', () => {
    const networkViolations = importPaths.filter(
      (p) => p === 'axios' || p === 'undici' || p === 'got' || p === 'node-fetch',
    );
    expect(networkViolations).toEqual([]);
  });
});

describe('L5E2U-V2 code-boundary — no forbidden runtime patterns', () => {
  const codeOnly = stripCommentLines(orchestratorSource);

  it('does not use Date.now, new Date, performance.now, Math.random, randomUUID, randomBytes', () => {
    for (const pattern of [
      /Date\.now\s*\(/,
      /new Date\s*\(/,
      /performance\.now\s*\(/,
      /Math\.random\s*\(/,
      /randomUUID\s*\(/,
      /randomBytes\s*\(/,
    ]) {
      expect(codeOnly).not.toMatch(pattern);
    }
  });

  it('does not use direct filesystem operations', () => {
    for (const pattern of [
      /\breadFileSync\b/,
      /\bwriteFileSync\b/,
      /\breadFile\b/,
      /\bwriteFile\b/,
      /\bunlink\b/,
      /\brename\b/,
      /\brmSync\b/,
      /\brm\s*\(/,
      /\bmkdir\b/,
      /\bappendFile\b/,
      /\bstatSync\b/,
    ]) {
      expect(codeOnly).not.toMatch(pattern);
    }
  });

  it('does not reference outcome / grading / performance', () => {
    const lower = codeOnly.toLowerCase();
    expect(lower).not.toMatch(/\boutcome\b/);
    expect(lower).not.toMatch(/\bgrading\b/);
    expect(lower).not.toMatch(/\bperformance\b/);
  });
});

describe('L5E2U-V2 public-contract — no sensitive fields exposed', () => {
  const codeOnly = stripCommentLines(orchestratorSource);

  it('no sensitive property reference appears in non-comment code', () => {
    const violations = FORBIDDEN_PROPERTY_REFS.filter((field) => {
      const propAccess = new RegExp('\\.' + field + '\\b');
      const propKey = new RegExp('\\b' + field + '\\s*:');
      const stringLiteral = new RegExp("['\"]" + field + "['\"]");
      return (
        propAccess.test(codeOnly) ||
        propKey.test(codeOnly) ||
        stringLiteral.test(codeOnly)
      );
    });
    expect(violations).toEqual([]);
  });

  it('L5E2U_V2_PUBLIC_FIREWALL = PASS (no sensitive fields)', () => {
    const violations = FORBIDDEN_PROPERTY_REFS.filter((field) => {
      const propAccess = new RegExp('\\.' + field + '\\b');
      const propKey = new RegExp('\\b' + field + '\\s*:');
      const stringLiteral = new RegExp("['\"]" + field + "['\"]");
      return (
        propAccess.test(codeOnly) ||
        propKey.test(codeOnly) ||
        stringLiteral.test(codeOnly)
      );
    });
    if (violations.length > 0) {
      throw new Error(
        `Forbidden sensitive property references in V2 persistence orchestrator: ${violations.join(', ')}`,
      );
    }
    expect(true).toBe(true);
  });

  it('result type exposes only the safe integration result shape', () => {
    const allowedTopLevelFields = [
      'ok',
      'integrationVersion',
      'status',
      'operationalRecord',
      'operationalPersistenceAttempted',
      'operationalArtifactCreated',
      'operationalVerificationOk',
      'operationalTempCleanupFailed',
    ];

    /* Extract only the Readonly<{ ... }> body of the V2 result type. */
    const resultTypeMatch = orchestratorSource.match(
      /MLBShadowMonitoringPredictionPersistenceIntegrationV2Result\s*=\s*Readonly<\{([\s\S]*?)\}>;/m,
    );
    expect(resultTypeMatch).not.toBeNull();
    const typeBody = resultTypeMatch![1];

    /* Every field declared inside the type body must be in the allowlist. */
    const declaredFields = typeBody.match(/^\s+(\w+):/gm);
    expect(declaredFields).not.toBeNull();
    const fieldNames = declaredFields!.map((f) => f.trim().replace(':', ''));

    for (const field of fieldNames) {
      if (field === '') continue;
      expect(allowedTopLevelFields).toContain(field);
    }

    /* Forbidden fields must NOT appear as declared fields. */
    const forbiddenInType = FORBIDDEN_PROPERTY_REFS.filter((f) =>
      fieldNames.includes(f),
    );
    expect(forbiddenInType).toEqual([]);
  });

  it('integration status type mirrors the exact fixed safe vocabulary', () => {
    const expectedStatuses = [
      'OPERATIONAL_RECORD_INVALID',
      'OPERATIONAL_RECORD_IDENTITY_MISMATCH',
      'OPERATIONAL_PERSISTED',
      'OPERATIONAL_PERSISTED_WITH_CLEANUP_WARNING',
      'OPERATIONAL_IDEMPOTENT_IDENTICAL_SUCCESS',
      'OPERATIONAL_ALREADY_EXISTS_DIFFERENT',
      'OPERATIONAL_VERIFICATION_FAILED',
      'OPERATIONAL_PRE_FINALIZATION_FAILED',
    ];

    for (const status of expectedStatuses) {
      expect(orchestratorSource).toContain(`'${status}'`);
    }
  });
});

describe('L5E2U-V2 required delegate invocation', () => {
  it('orchestrateMLBShadowQuarantinePredictionV2 IS called', () => {
    expect(orchestratorSource).toContain(
      'orchestrateMLBShadowQuarantinePredictionV2',
    );
  });

  it('persistMLBShadowMonitoringPredictionOperationalRecord IS called', () => {
    expect(orchestratorSource).toContain(
      'persistMLBShadowMonitoringPredictionOperationalRecord',
    );
  });

  it('computeMLBShadowQuarantinedPredictionV2 is NOT imported', () => {
    const importLines = orchestratorSource
      .split('\n')
      .filter((line) => line.includes('from ') && line.includes('import'));
    const hasDirectComputationImport = importLines.some((line) =>
      line.includes('mlb-shadow-monitoring-prediction-computation-v2'),
    );
    expect(hasDirectComputationImport).toBe(false);
  });

  it('persistMLBShadowQuarantinedPrediction is NOT imported', () => {
    const importLines = orchestratorSource
      .split('\n')
      .filter((line) => line.includes('from ') && line.includes('import'));
    const hasDirectStoreImport = importLines.some((line) =>
      line.includes('mlb-shadow-monitoring-prediction-store'),
    );
    expect(hasDirectStoreImport).toBe(false);
  });

  it('validateMLBShadowExecutionJobV2 is NOT imported', () => {
    const importLines = orchestratorSource
      .split('\n')
      .filter((line) => line.includes('from ') && line.includes('import'));
    const hasJobContractImport = importLines.some((line) =>
      line.includes('mlb-shadow-execution-job-v2-contract'),
    );
    expect(hasJobContractImport).toBe(false);
  });

  it('V1 prediction orchestrator is NOT imported', () => {
    const importLines = orchestratorSource
      .split('\n')
      .filter((line) => line.includes('from ') && line.includes('import'));
    // The allowed import is '...-v2', not '...-orchestrator' (non-v2)
    const hasV1OrchestratorImport = importLines.some(
      (line) =>
        line.includes('mlb-shadow-monitoring-prediction-orchestrator') &&
        !line.includes('prediction-orchestrator-v2'),
    );
    expect(hasV1OrchestratorImport).toBe(false);
  });
});
