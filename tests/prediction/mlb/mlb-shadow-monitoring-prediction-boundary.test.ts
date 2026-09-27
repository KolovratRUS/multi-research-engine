import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/* -------------------------------------------------------------------------- */
/*  Files under the L5E2Q import + runtime boundary                           */
/* -------------------------------------------------------------------------- */

const SRC_ROOT = resolve(process.cwd(), 'src/prediction/mlb');

const FILES_UNDER_TEST = [
  'mlb-shadow-model-fingerprint.ts',
  'mlb-shadow-monitoring-prediction-computation.ts',
  'mlb-shadow-monitoring-operational-projection.ts',
];

/* -------------------------------------------------------------------------- */
/*  Forbidden import path fragments (conceptual)                              */
/*                                                                            */
/*  K1 / K2            = capture orchestrator + scheduler activation paths   */
/*  scheduler          = mlb-prospective-holdout-scheduler-core               */
/*  activation         = mlb-prospective-holdout-activation-*                */
/*  evidence writer    = mlb-prospective-pregame-evidence-*                  */
/*  binding writer     = mlb-prospective-holdout-game-identity-binding-*      */
/*  outcomes           = mlb-offline-official-final-game-outcome-*           */
/*  grading            = mlb-offline-recommendation-bundle-grading-*        */
/*  persistence        = store / persist modules + node:fs                  */
/*  network            = node:http(s), node:net, axios, undici, etc.          */
/*  child_process      = node:child_process                                  */
/* -------------------------------------------------------------------------- */

const FORBIDDEN_IMPORT_FRAGMENTS = [
  // K1 / K2 concepts — capture orchestrator + scheduler activation
  'capture-orchestrator',
  'scheduler',
  // activation
  'activation',
  // evidence writer
  'evidence-writer',
  'evidence-writer',
  'evidence-artifact',
  'evidence-store',
  // binding writer
  'game-identity-binding',
  'binding-contract',
  'binding-store',
  // outcomes
  'official-final-game-outcome',
  // grading
  'grading-contract',
  'grading',
  // persistence / store
  '-store',
  'persistence',
  // filesystem
  'node:fs',
  'node:fs/promises',
  // network
  'node:http',
  'node:https',
  'node:net',
  'node:tls',
  'axios',
  'undici',
  'node-fetch',
  'got',
  // child process
  'node:child_process',
  'child_process',
];

const FORBIDDEN_RUNTIME_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: 'require()', pattern: /\brequire\s*\(/ },
  { label: 'eval()', pattern: /\beval\s*\(/ },
  { label: 'new Function()', pattern: /new\s+Function\s*\(/ },
  { label: 'process.env', pattern: /process\.env/ },
  { label: 'process.stdout', pattern: /process\.stdout/ },
  { label: 'process.stderr', pattern: /process\.stderr/ },
  { label: 'Date.now()', pattern: /Date\.now\s*\(/ },
  { label: 'Math.random()', pattern: /Math\.random\s*\(/ },
  { label: 'Date.UTC()', pattern: /Date\.UTC\s*\(/ },
  { label: 'setTimeout()', pattern: /setTimeout\s*\(/ },
  { label: 'setInterval()', pattern: /setInterval\s*\(/ },
  { label: 'setImmediate()', pattern: /setImmediate\s*\(/ },
  { label: 'dynamic import()', pattern: /\bimport\s*\(/ },
  { label: 'fetch()', pattern: /\bfetch\s*\(/ },
  { label: 'writeFile', pattern: /\bwriteFile/ },
  { label: 'appendFile', pattern: /\bappendFile/ },
  { label: 'unlink', pattern: /\bunlink/ },
  { label: 'fs.mkdir', pattern: /fs\.mkdir/ },
  { label: 'fs.rmdir', pattern: /fs\.rmdir/ },
  { label: 'fs.rename', pattern: /fs\.rename/ },
  { label: 'fs.unlink', pattern: /fs\.unlink/ },
  { label: 'fs.chmod', pattern: /fs\.chmod/ },
  { label: 'fs.open', pattern: /fs\.open\b/ },
  { label: 'fs.writeFile', pattern: /fs\.writeFile/ },
  { label: 'fs.appendFile', pattern: /fs\.appendFile/ },
  { label: 'fs.rm', pattern: /fs\.rm\b/ },
  { label: 'fs.rmdir', pattern: /fs\.rmdir/ },
];

/* -------------------------------------------------------------------------- */
/*  Operational projection additional forbidden imports                        */
/* -------------------------------------------------------------------------- */

const OPERATIONAL_PROJECTION_FORBIDDEN_IMPORTS = [
  'mlb-shadow-model-fingerprint',
  'mlb-shadow-monitoring-quarantine-contract',
  'mlb-shadow-monitoring-prediction-computation',
];

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

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('L5E2Q boundary — import audit', () => {
  for (const file of FILES_UNDER_TEST) {
    const filePath = resolve(SRC_ROOT, file);
    const content = readFileSync(filePath, 'utf-8');
    const importPaths = extractImportPaths(content);

    describe(`${file}`, () => {
      it(`has no forbidden import paths`, () => {
        const violations = importPaths.filter((imp) =>
          FORBIDDEN_IMPORT_FRAGMENTS.some((frag) =>
            imp.toLowerCase().includes(frag.toLowerCase()),
          ),
        );
        expect(violations).toEqual([]);
      });

      it(`L5E2Q_IMPORT_BOUNDARY = PASS`, () => {
        const violations = importPaths.filter((imp) =>
          FORBIDDEN_IMPORT_FRAGMENTS.some((frag) =>
            imp.toLowerCase().includes(frag.toLowerCase()),
          ),
        );
        if (violations.length > 0) {
          throw new Error(`Forbidden imports in ${file}: ${violations.join(', ')}`);
        }
        expect(true).toBe(true);
      });
    });
  }

  describe('operational projection — no quarantine/fingerprint/prediction-computation imports', () => {
    const filePath = resolve(SRC_ROOT, 'mlb-shadow-monitoring-operational-projection.ts');
    const content = readFileSync(filePath, 'utf-8');
    const importPaths = extractImportPaths(content);

    it('does not import model fingerprint', () => {
      const hits = importPaths.filter((p) =>
        p.includes('mlb-shadow-model-fingerprint'),
      );
      expect(hits).toEqual([]);
    });

    it('does not import quarantine contract', () => {
      const hits = importPaths.filter((p) =>
        p.includes('mlb-shadow-monitoring-quarantine-contract'),
      );
      expect(hits).toEqual([]);
    });

    it('does not import prediction computation', () => {
      const hits = importPaths.filter((p) =>
        p.includes('mlb-shadow-monitoring-prediction-computation'),
      );
      expect(hits).toEqual([]);
    });
  });
});

describe('L5E2Q boundary — runtime side-effect audit', () => {
  for (const file of FILES_UNDER_TEST) {
    const filePath = resolve(SRC_ROOT, file);
    const content = readFileSync(filePath, 'utf-8');

    describe(`${file}`, () => {
      it(`L5E2Q_RUNTIME_SIDE_EFFECT_AUDIT = PASS`, () => {
        const violations: string[] = [];
        for (const { label, pattern } of FORBIDDEN_RUNTIME_PATTERNS) {
          if (pattern.test(content)) {
            violations.push(label);
          }
        }
        if (violations.length > 0) {
          throw new Error(`Runtime side-effects in ${file}: ${violations.join(', ')}`);
        }
        expect(true).toBe(true);
      });
    });
  }
});
