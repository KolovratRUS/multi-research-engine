/* -------------------------------------------------------------------------- */
/*  L5E2U import + public-contract boundary audit                              */
/* -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/* -- Production file under audit -- */
const SRC_ROOT = resolve(process.cwd(), 'src/prediction/mlb');
const ORCHESTRATOR_FILE = 'mlb-shadow-monitoring-persistence-orchestrator.ts';
const orchestratorPath = resolve(SRC_ROOT, ORCHESTRATOR_FILE);
const orchestratorSource = readFileSync(orchestratorPath, 'utf-8');

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function extractImportPaths(content: string): string[] {
  const regex = /from\s+['"]([^'"]+)['"]/g;
  const paths: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

/**
 * Returns the source with comment-only lines removed.
 * Lines starting with `//`, `*`, `/*`, or `\*` (JSDoc body) are stripped.
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
/*  Allowed (whitelist) imports — L5E2U may only depend on these modules      */
/* -------------------------------------------------------------------------- */

const ALLOWED_IMPORTS = [
  './mlb-shadow-monitoring-prediction-orchestrator',
  './mlb-shadow-monitoring-operational-store',
  './mlb-shadow-monitoring-record-contract',
];

/* -------------------------------------------------------------------------- */
/*  Forbidden import fragments — must never appear in an import path           */
/* -------------------------------------------------------------------------- */

const FORBIDDEN_IMPORT_FRAGMENTS = [
  'mlb-shadow-monitoring-prediction-computation',
  'mlb-shadow-monitoring-prediction-store',
  'mlb-shadow-model-fingerprint',
  'node:fs',
  'node:fs/promises',
];

/* -------------------------------------------------------------------------- */
/*  Forbidden code tokens — must never appear in non-comment source code      */
/* -------------------------------------------------------------------------- */

const FORBIDDEN_CODE_PATTERNS: RegExp[] = [
  /unlink\s*\(/,
  /rename\s*\(/,
  /\brm\s*\(/,
  /\brmSync\s*\(/,
  /\boutcome\b/i,
  /\bgrading\b/i,
  /\bperformance\b/i,
];

/* -------------------------------------------------------------------------- */
/*  Forbidden public-contract fields — must never appear as property keys     */
/*  in the public result type or return objects                               */
/* -------------------------------------------------------------------------- */

const FORBIDDEN_PUBLIC_FIELDS = [
  'relativePath',
  'issues',
  'error',
  'message',
  'predictedWinner',
  'predictedSide',
  'homeWinProbability',
  'awayWinProbability',
  'decisionPolicy',
  'payloadHash',
  'modelFingerprint',
  'fittedModelFingerprint',
];

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('L5E2U import boundary — orchestrator', () => {
  const importPaths = extractImportPaths(orchestratorSource);

  it('imports only allowed L5E2S, L5E2T, and safe-contract modules', () => {
    const disallowed = importPaths.filter(
      (p) => !ALLOWED_IMPORTS.includes(p),
    );
    expect(disallowed).toEqual([]);
  });

  it('L5E2U_IMPORT_BOUNDARY = PASS (whitelist clean)', () => {
    const disallowed = importPaths.filter(
      (p) => !ALLOWED_IMPORTS.includes(p),
    );
    if (disallowed.length > 0) {
      throw new Error(
        `Disallowed imports in orchestrator: ${disallowed.join(', ')}`,
      );
    }
    expect(true).toBe(true);
  });

  it('does not import prediction computation, prediction store, or model fingerprint', () => {
    const violations = importPaths.filter((imp) =>
      FORBIDDEN_IMPORT_FRAGMENTS.some((frag) =>
        imp.toLowerCase().includes(frag.toLowerCase()),
      ),
    );
    expect(violations).toEqual([]);
  });

  it('does not import node:fs or node:fs/promises directly', () => {
    const fsViolations = importPaths.filter((p) =>
      p.toLowerCase().includes('node:fs'),
    );
    expect(fsViolations).toEqual([]);
  });
});

describe('L5E2U code-boundary — no forbidden runtime patterns', () => {
  const codeOnly = stripCommentLines(orchestratorSource);

  it('does not use unlink / rename / rm / rmSync', () => {
    for (const pattern of FORBIDDEN_CODE_PATTERNS) {
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

describe('L5E2U public-contract — no forbidden fields exposed', () => {
  const codeOnly = stripCommentLines(orchestratorSource);

  it('no forbidden public-contract field appears in non-comment code', () => {
    const violations = FORBIDDEN_PUBLIC_FIELDS.filter((field) => {
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

  it('L5E2U_PUBLIC_FIREWALL = PASS (no sensitive fields)', () => {
    const violations = FORBIDDEN_PUBLIC_FIELDS.filter((field) => {
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
        `Forbidden public fields in orchestrator: ${violations.join(', ')}`,
      );
    }
    expect(true).toBe(true);
  });

  it('safe pipeline fields (pipelineStatus, failureCode) are NOT in the forbidden list', () => {
    expect(FORBIDDEN_PUBLIC_FIELDS).not.toContain('pipelineStatus');
    expect(FORBIDDEN_PUBLIC_FIELDS).not.toContain('failureCode');
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

    /* Extract only the Readonly<{ ... }> body of the result type. */
    const resultTypeMatch = orchestratorSource.match(
      /MLBShadowMonitoringPredictionPersistenceIntegrationResult\s*=\s*Readonly<\{([\s\S]*?)\}>;/m,
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
    const forbiddenInType = FORBIDDEN_PUBLIC_FIELDS.filter((f) =>
      fieldNames.includes(f),
    );
    expect(forbiddenInType).toEqual([]);
  });
});
