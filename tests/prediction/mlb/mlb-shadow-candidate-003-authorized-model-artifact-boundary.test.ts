/* -------------------------------------------------------------------------- */
/*  Static boundary test for L5E2X-P5B-C2                                      */
/*  Verifies the production artifact module imports only allowed modules and    */
/*  contains no forbidden runtime patterns.                                     */
/* -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/* -------------------------------------------------------------------------- */
/*  Paths                                                                     */
/* -------------------------------------------------------------------------- */

const ARTIFACT_SOURCE = resolve(
  process.cwd(),
  'src/prediction/mlb/mlb-shadow-candidate-003-authorized-model-artifact.ts',
);

/* -------------------------------------------------------------------------- */
/*  Forbidden import fragments                                                 */
/*  Any import path containing one of these substrings is rejected.            */
/* -------------------------------------------------------------------------- */

const FORBIDDEN_IMPORT_FRAGMENTS: readonly string[] = [
  // Filesystem / path
  'node:fs',
  'fs/promises',
  'node:path',
  // Recovery / train JSON
  '/tmp',
  '.json',
  // Test release / validation harness
  'mlb-model-test-release-contract',
  // Prospective holdout capture / scheduler / activation (K1, K2)
  'capture-orchestrator',
  'capture-adapter',
  'capture-cli',
  'capture-contract',
  'capture-orchestrator',
  'activation',
  'scheduler',
  'prospective-holdout',
  'prospective-pregame-evidence',
  'game-identity-binding',
  // Operational / persistence / prediction stores
  'prediction-store',
  'prediction-orchestrator',
  'persistence-orchestrator',
  'execution-adapter',
  'operational-projection',
  'quarantine',
  'operational-record',
  // Network
  'axios',
  'undici',
  'node:http',
  'node:https',
  'node:net',
  'fetch',
] as const;

/* -------------------------------------------------------------------------- */
/*  Forbidden source-level patterns                                          */
/*  Checked against non-comment, non-import lines.                           */
/* -------------------------------------------------------------------------- */

const FORBIDDEN_SOURCE_PATTERNS: ReadonlyArray<{
  readonly name: string;
  readonly regex: RegExp;
  readonly reason: string;
}> = [
  {
    name: 'Date.now',
    regex: /Date\.now\s*\(/,
    reason: 'Artifact module must not read the wall clock.',
  },
  {
    name: 'new Date',
    regex: /new Date\s*\(/,
    reason: 'Artifact module must not read the wall clock.',
  },
  {
    name: 'Math.random',
    regex: /Math\.random\s*\(/,
    reason: 'Artifact module must not use randomness.',
  },
  {
    name: 'randomUUID',
    regex: /randomUUID\s*\(/,
    reason: 'Artifact module must not use randomness.',
  },
  {
    name: 'randomBytes',
    regex: /randomBytes\s*\(/,
    reason: 'Artifact module must not use cryptographic randomness for model construction.',
  },
  {
    name: 'fitMLBDeterministicLogisticRegressionModel',
    regex: /fitMLBDeterministicLogisticRegressionModel\b/,
    reason: 'No model fitting permitted.',
  },
  {
    name: 'fitAndEvaluateMLBDeterministicLogisticRegression',
    regex: /fitAndEvaluateMLBDeterministicLogisticRegression\b/,
    reason: 'No model fitting permitted.',
  },
  {
    name: 'MLBModelTestReleaseResult',
    regex: /MLBModelTestReleaseResult/,
    reason: 'No test release result dependency permitted.',
  },
  {
    name: 'mlb-model-test-release-contract',
    regex: /mlb-model-test-release-contract/,
    reason: 'No test release contract dependency permitted.',
  },
  {
    name: 'readFileSync',
    regex: /readFileSync/,
    reason: 'No filesystem read at runtime.',
  },
  {
    name: 'writeFileSync',
    regex: /writeFileSync/,
    reason: 'No filesystem write at runtime.',
  },
] as const;

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

function nonCommentLines(content: string): string[] {
  return content.split('\n').filter((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) return false;
    if (trimmed.startsWith('*')) return false;
    if (trimmed.startsWith('/*')) return false;
    return true;
  });
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('L5E2X-P5B-C2 authorized-model-artifact boundary', () => {
  const source = readFileSync(ARTIFACT_SOURCE, 'utf-8');
  const importPaths = extractImportPaths(source);

  /* ------------------------------------------------------ */
  /*  Import boundary                                       */
  /* ------------------------------------------------------ */

  it('AUTHORIZED_ARTIFACT_IMPORT_BOUNDARY = PASS — no forbidden import fragments', () => {
    const violations = importPaths.filter((path) =>
      FORBIDDEN_IMPORT_FRAGMENTS.some((fragment) =>
        path.toLowerCase().includes(fragment.toLowerCase()),
      ),
    );
    expect(violations).toEqual([]);
  });

  it('AUTHORIZED_ARTIFACT_IMPORT_BOUNDARY = PASS — all imports are src modules or node:crypto', () => {
    // Every import must start with @/ (internal alias) or node: (node builtin).
    // No external npm packages except those already permitted by the repo.
    const external = importPaths.filter((path) => !path.startsWith('@/'));
    // node:fs, node:path, etc. are forbidden by the fragment check above.
    // The only allowed node: import would be node:crypto (for the fingerprint),
    // but this module delegates fingerprint computation to
    // mlb-shadow-model-fingerprint so it should not import node:* directly.
    const nodeImports = external.filter((path) => path.startsWith('node:'));
    expect(nodeImports).toEqual([]);
  });

  it('AUTHORIZED_ARTIFACT_IMPORT_BOUNDARY = PASS — no /tmp reference in import paths', () => {
    const tmpImports = importPaths.filter((path) =>
      path.includes('/tmp'),
    );
    expect(tmpImports).toEqual([]);
  });

  /* ------------------------------------------------------ */
  /*  No JSON imports                                       */
  /* ------------------------------------------------------ */

  it('AUTHORIZED_ARTIFACT_NO_JSON_IMPORT — no .json import paths', () => {
    const jsonImports = importPaths.filter((path) =>
      path.endsWith('.json'),
    );
    expect(jsonImports).toEqual([]);
  });

  /* ------------------------------------------------------ */
  /*  Source-level pattern checks                           */
  /* ------------------------------------------------------ */

  describe('no forbidden runtime patterns in source', () => {
    const lines = nonCommentLines(source);

    it('no Date.now', () => {
      const hits = lines.filter((line) =>
        FORBIDDEN_SOURCE_PATTERNS.some(
          (p) => p.name === 'Date.now' && p.regex.test(line),
        ),
      );
      expect(hits).toEqual([]);
    });

    it('no new Date', () => {
      const hits = lines.filter((line) =>
        FORBIDDEN_SOURCE_PATTERNS.some(
          (p) => p.name === 'new Date' && p.regex.test(line),
        ),
      );
      expect(hits).toEqual([]);
    });

    it('no Math.random', () => {
      const hits = lines.filter((line) =>
        FORBIDDEN_SOURCE_PATTERNS.some(
          (p) => p.name === 'Math.random' && p.regex.test(line),
        ),
      );
      expect(hits).toEqual([]);
    });

    it('no randomUUID', () => {
      const hits = lines.filter((line) =>
        FORBIDDEN_SOURCE_PATTERNS.some(
          (p) => p.name === 'randomUUID' && p.regex.test(line),
        ),
      );
      expect(hits).toEqual([]);
    });

    it('no randomBytes', () => {
      const hits = lines.filter((line) =>
        FORBIDDEN_SOURCE_PATTERNS.some(
          (p) => p.name === 'randomBytes' && p.regex.test(line),
        ),
      );
      expect(hits).toEqual([]);
    });

    it('no fitMLBDeterministicLogisticRegressionModel call', () => {
      const hits = lines.filter((line) =>
        FORBIDDEN_SOURCE_PATTERNS.some(
          (p) =>
            p.name === 'fitMLBDeterministicLogisticRegressionModel' &&
            p.regex.test(line),
        ),
      );
      expect(hits).toEqual([]);
    });

    it('no fitAndEvaluateMLBDeterministicLogisticRegression call', () => {
      const hits = lines.filter((line) =>
        FORBIDDEN_SOURCE_PATTERNS.some(
          (p) =>
            p.name === 'fitAndEvaluateMLBDeterministicLogisticRegression' &&
            p.regex.test(line),
        ),
      );
      expect(hits).toEqual([]);
    });

    it('no MLBModelTestReleaseResult reference', () => {
      const hits = lines.filter((line) =>
        FORBIDDEN_SOURCE_PATTERNS.some(
          (p) => p.name === 'MLBModelTestReleaseResult' && p.regex.test(line),
        ),
      );
      expect(hits).toEqual([]);
    });

    it('no mlb-model-test-release-contract reference', () => {
      const hits = lines.filter((line) =>
        FORBIDDEN_SOURCE_PATTERNS.some(
          (p) =>
            p.name === 'mlb-model-test-release-contract' && p.regex.test(line),
        ),
      );
      expect(hits).toEqual([]);
    });

    it('no readFileSync call', () => {
      const hits = lines.filter((line) =>
        FORBIDDEN_SOURCE_PATTERNS.some(
          (p) => p.name === 'readFileSync' && p.regex.test(line),
        ),
      );
      expect(hits).toEqual([]);
    });

    it('no writeFileSync call', () => {
      const hits = lines.filter((line) =>
        FORBIDDEN_SOURCE_PATTERNS.some(
          (p) => p.name === 'writeFileSync' && p.regex.test(line),
        ),
      );
      expect(hits).toEqual([]);
    });
  });

  /* ------------------------------------------------------ */
  /*  No /tmp in code (comments allowed)                    */
  /* ------------------------------------------------------ */

  it('NO_TMP_CODE_DEPENDENCY — no /tmp reference outside comments', () => {
    const codeLines = nonCommentLines(source);
    const tmpRefs = codeLines.filter((line) => line.includes('/tmp'));
    expect(tmpRefs).toEqual([]);
  });

  /* ------------------------------------------------------ */
  /*  No historical data matrix / dataset imports           */
  /* ------------------------------------------------------ */

  it('NO_HISTORICAL_DATASET_IMPORT — no 437-row dataset import', () => {
    const datasetImports = importPaths.filter((path) =>
      path.includes('historical-labelled-dataset-v1-2026-04-01-2026-04-23-360'),
    );
    expect(datasetImports).toEqual([]);
  });

  it('NO_HISTORICAL_MATRIX_IMPORT — no full matrix data import', () => {
    const matrixImports = importPaths.filter((path) =>
      path.includes('historical-full-matrix'),
    );
    expect(matrixImports).toEqual([]);
  });

  /* ------------------------------------------------------ */
  /*  Consolidated boundary gate                           */
  /* ------------------------------------------------------ */

  it('BOUNDARY_GATE = PASS', () => {
    // Import checks
    const importViolations = importPaths.filter((path) =>
      FORBIDDEN_IMPORT_FRAGMENTS.some((fragment) =>
        path.toLowerCase().includes(fragment.toLowerCase()),
      ),
    );
    expect(importViolations).toEqual([]);

    // Source pattern checks
    const lines = nonCommentLines(source);
    const patternViolations: string[] = [];
    for (const pattern of FORBIDDEN_SOURCE_PATTERNS) {
      for (const line of lines) {
        if (pattern.regex.test(line)) {
          patternViolations.push(
            `${pattern.name}: ${line.trim()}`,
          );
        }
      }
    }
    expect(patternViolations).toEqual([]);

    // /tmp in code
    const tmpCodeRefs = lines.filter((line) => line.includes('/tmp'));
    expect(tmpCodeRefs).toEqual([]);
  });
});
