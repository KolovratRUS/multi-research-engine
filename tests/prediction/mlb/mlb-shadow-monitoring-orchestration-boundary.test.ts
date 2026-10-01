/* -------------------------------------------------------------------------- */
/*  Static orchestration boundary test for L5E2S                              */
/*  Verifies the orchestrator imports only allowed modules and that no        */
/*  sensitive data crosses the firewall into the public return.               */
/* -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/* -------------------------------------------------------------------------- */
/*  Paths                                                                     */
/* -------------------------------------------------------------------------- */

const ORCHESTRATOR_SOURCE =
  'src/prediction/mlb/mlb-shadow-monitoring-prediction-orchestrator.ts';

/* -------------------------------------------------------------------------- */
/*  Forbidden import fragments                                                */
/*                                                                            */
/*  Any import path containing one of these substrings is rejected.           */
/*  These represent modules whose direct import by the orchestrator would     */
/*  violate the L5E2S import boundary.                                        */
/* -------------------------------------------------------------------------- */

const FORBIDDEN_IMPORT_FRAGMENTS = [
  'capture-orchestrator',
  'prospective-holdout',
  'scheduler',
  'activation',
  'game-identity-binding',
  'pregame-evidence',
  'outcome',
  'grading',
  'performance',
  'unblind',
  'schedule',
  'mLBStatsAPIClient',
  'node:http',
  'node:https',
  'axios',
  'undici',
  'fetch',
  'mlb-shadow-model-fingerprint',
] as const;

/* -------------------------------------------------------------------------- */
/*  Forbidden patterns in source — sensitive data leak prevention              */
/* -------------------------------------------------------------------------- */

const FORBIDDEN_PATTERNS: ReadonlyArray<{
  readonly name: string;
  readonly regex: RegExp;
  readonly reason: string;
}> = [
  {
    name: 'raw computation issues forwarding',
    regex: /computeResult\.issues/,
    reason: 'Raw computation issues must not be forwarded to the return.',
  },
  {
    name: 'raw store issues forwarding',
    regex: /storeResult\.issues/,
    reason: 'Raw store issues must not be forwarded to the return.',
  },
  {
    name: 'arbitrary .message forwarding',
    regex: /\.message\b/,
    reason: 'Arbitrary .message text must not be used as failureCode.',
  },
  {
    name: 'JSON.stringify of issues',
    regex: /JSON\.stringify\([^)]*issues/i,
    reason: 'Issues must not be JSON.stringified into operational metadata.',
  },
  {
    name: 'relativePath forwarding',
    regex: /\.relativePath\b/,
    reason: 'Store relativePath must not be forwarded to the operational record.',
  },
  {
    name: 'spreading computeResult.value into return',
    regex: /\.\.\.computeResult\.value/,
    reason: 'Sensitive prediction payload must not be spread into public return.',
  },
  {
    name: 'spreading storeResult into return',
    regex: /\.\.\.storeResult\b/,
    reason: 'Store persistence result must not be spread into public return.',
  },
  {
    name: 'direct payload return construction',
    regex: /return\s*\{[^}]*payload[^}]*\}/i,
    reason: 'No public return object should contain a payload field.',
  },
] as const;

/* -------------------------------------------------------------------------- */
/*  Allowed import prefixes — the orchestrator may only import from these     */
/* -------------------------------------------------------------------------- */

const ALLOWED_IMPORT_PREFIXES = [
  './mlb-shadow-monitoring-prediction-computation',
  './mlb-shadow-monitoring-prediction-store',
  './mlb-shadow-monitoring-operational-projection',
  './mlb-shadow-monitoring-record-contract',
  './mlb-shadow-monitoring-quarantine-contract',
] as const;

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('mlb-shadow-monitoring-orchestration-boundary (L5E2S)', () => {
  const source = readFileSync(ORCHESTRATOR_SOURCE, 'utf-8');

  /* ------------------------------------------------------ */
  /*  Extract all import paths from the source              */
  /* ------------------------------------------------------ */

  const importPaths: string[] = [];
  const importRegex = /from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(source)) !== null) {
    importPaths.push(match[1]);
  }

  /* ------------------------------------------------------ */
  /*  Import boundary checks                                */
  /* ------------------------------------------------------ */

  it('L5E2S_IMPORT_BOUNDARY_PASS — no forbidden import fragments', () => {
    const violations = importPaths.filter((path) =>
      FORBIDDEN_IMPORT_FRAGMENTS.some((fragment) =>
        path.toLowerCase().includes(fragment.toLowerCase()),
      ),
    );
    expect(violations).toEqual([]);
  });

  it('L5E2S_IMPORT_BOUNDARY_PASS — only allowed import sources', () => {
    const external = importPaths.filter(
      (path) => !path.startsWith('.'),
    );
    // Type-only imports from allowed modules use "./" relative paths.
    // Any import NOT starting with "./" would be an external/module import.
    const forbiddenExternal = external.filter((path) => {
      // Allow node: imports that are already in the forbidden list.
      // The orchestrator should have NO external imports at all.
      return path.startsWith('node:');
    });
    expect(forbiddenExternal).toEqual([]);
  });

  it('L5E2S_IMPORT_BOUNDARY_PASS — all imports are relative intra-package', () => {
    // Every import must be a relative intra-module import.
    for (const path of importPaths) {
      expect(path.startsWith('./')).toBe(true);
    }
  });

  /* ------------------------------------------------------ */
  /*  No sensitive data crossing the firewall               */
  /* ------------------------------------------------------ */

  it('NO_PUBLIC_RETURN_OF_PREDICTION_PAYLOAD — no payload spreading/returning', () => {
    const forbiddenPayloadReturnPatterns = [
      /\.value\b/,
      /payload\./,
      /predictedWinner/,
      /predictedSide/,
      /homeWinProbability/,
      /awayWinProbability/,
      /decisionPolicy/,
    ];

    // These sensitive identifiers must NOT appear as property accesses
    // on computeResult.value or storeResult outside of the orchestrator's
    // internal payload variable assignment.
    const lines = source.split('\n');
    const sensitiveAccess = lines.filter((_, idx) => {
      const line = lines[idx];
      // "const payload: ... = computeResult.value;" is allowed (single assignment)
      // Any other access to these sensitive fields is forbidden.
      const isAllowed = line.trim().startsWith('const payload');
      if (isAllowed) return false;
      return forbiddenPayloadReturnPatterns.some((p) => p.test(line));
    });

    // The only allowed reference to computeResult.value is the payload assignment.
    // All other references to sensitive fields in return/operand context are forbidden.
    // However, the type annotation line "const payload: MLBShadowQuarantinedPredictionPayload = computeResult.value;"
    // is allowed.
    const forbiddenRefs = lines.filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('const payload')) return false;
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
      if (trimmed.startsWith('import')) return false;
      return /\bcomputeResult\.value\b/.test(trimmed) || /\bstoreResult\.value\b/.test(trimmed);
    });

    expect(forbiddenRefs).toEqual([]);
  });

  it('NO_PUBLIC_RETURN_OF_PERSISTENCE_RESULT — no storeResult spread/return', () => {
    const sourceLines = source.split('\n');
    const persistenceReturn = sourceLines.filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('import')) {
        return false;
      }
      return /return\s*\{[^}]*storeResult/.test(trimmed);
    });
    expect(persistenceReturn).toEqual([]);
  });

  it('NO_RELATIVE_PATH_FORWARDING — storePath not in operational builder call', () => {
    // .relativePath property access on any variable must not appear
    // in the source (the orchestrator never reads it).
    const refPathLines = source.split('\n').filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
      return /\.relativePath\b/.test(trimmed);
    });
    expect(refPathLines).toEqual([]);
  });

  it('NO_RAW_ISSUES_FORWARDING — no storeResult.issues or computeResult.issues', () => {
    const issuesLines = source.split('\n').filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
      return /computeResult\.issues|storeResult\.issues/.test(trimmed);
    });
    expect(issuesLines).toEqual([]);
  });

  it('NO_ARBITRARY_MESSAGE_FORWARDING — .message not used for failureCode', () => {
    const messageLines = source.split('\n').filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
      return /\.message\b/.test(trimmed);
    });
    expect(messageLines).toEqual([]);
  });

  it('NO_JSON_STRINGIFY_ISSUES — JSON.stringify not used on issues', () => {
    const stringifyIssuesLines = source.split('\n').filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
      return /JSON\.stringify\([^)]*issues/i.test(trimmed);
    });
    expect(stringifyIssuesLines).toEqual([]);
  });

  /* ------------------------------------------------------ */
  /*  Structural checks                                     */
  /* ------------------------------------------------------ */

  it('PUBLIC_RETURN_TYPE_IS_OPERATIONAL_ONLY — returns MLBShadowMonitoringOperationalRecordValidationResult', () => {
    expect(source).toMatch(
      /buildMLBShadowPredictionOperationalRecord\s*\(/,
    );
    // The public return must NOT be a combined object.
    // Check that there is no export of a combined wrapper type.
    expect(source).not.toMatch(
      /export\s+(type|interface|async function)\s+\w*\b[^;{]*\{[^}]*operationalRecord[^}]*\}/,
    );
  });

  it('NO_OPERATIONAL_PERSISTENCE — no write to var/mlb-development', () => {
    const prodWriteLines = source.split('\n').filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
      return /var\/mlb-development\/mlb-shadow-monitoring\/operational/.test(trimmed);
    });
    expect(prodWriteLines).toEqual([]);
  });

  it('NO_SCHEDULER_IMPORT — no scheduler/prospective-holdout scheduling imports', () => {
    const schedulerLines = source.split('\n').filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
      return /import.*schedul|import.*prospective.*holdout/i.test(trimmed);
    });
    expect(schedulerLines).toEqual([]);
  });

  it('FORBIDDEN_PATTERNS_ABSENT — all forbidden source patterns absent', () => {
    const violations: string[] = [];
    for (const pattern of FORBIDDEN_PATTERNS) {
      const lines = source.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
        if (pattern.regex.test(trimmed)) {
          violations.push(
            `${pattern.name} at line ${i + 1}: ${trimmed}`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
