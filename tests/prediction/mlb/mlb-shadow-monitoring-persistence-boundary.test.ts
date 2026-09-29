import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/* -------------------------------------------------------------------------- */
/*  Files under L5E2R import boundary                                          */
/* -------------------------------------------------------------------------- */

const SRC_ROOT = resolve(process.cwd(), 'src/prediction/mlb');

const STORE_FILE = 'mlb-shadow-monitoring-prediction-store.ts';

const OPERATIONAL_FILES = [
  'mlb-shadow-model-fingerprint.ts',
  'mlb-shadow-monitoring-prediction-computation.ts',
  'mlb-shadow-monitoring-operational-projection.ts',
] as const;

/* -------------------------------------------------------------------------- */
/*  Allowed (whitelist) and forbidden (blacklist) import fragments            */
/* -------------------------------------------------------------------------- */

const ALLOWED_STORE_IMPORTS = [
  'node:fs/promises',
  'node:path',
  'node:crypto',
  './mlb-shadow-monitoring-quarantine-contract',
  './mlb-shadow-monitoring-namespace',
];

const FORBIDDEN_STORE_IMPORT_FRAGMENTS = [
  // K1 / K2 concepts — capture orchestrator + scheduler activation
  'capture-orchestrator',
  'scheduler',
  // activation
  'activation',
  // evidence writer
  'prospective-pregame-evidence',
  // binding writer
  'game-identity-binding',
  // outcomes
  'outcome',
  // grading
  'grading',
  // performance
  'performance',
  // prediction computation (store must not reach into computation)
  'mlb-shadow-monitoring-prediction-computation',
  // model fingerprint (store must not reach into fingerprint)
  'mlb-shadow-model-fingerprint',
  // operational projection
  'mlb-shadow-monitoring-operational-projection',
  // record contract
  'mlb-shadow-monitoring-record-contract',
  // firewall
  'mlb-shadow-monitoring-firewall',
  // network clients
  'node:http',
  'node:https',
  'node:net',
  'axios',
  'undici',
  'fetch',
  'got',
  'node-fetch',
];

/* -------------------------------------------------------------------------- */
/*  Operational files — things they must NOT import                            */
/*                                                                            */
/*  These files are read-only / operational and must never touch the          */
/*  prediction store, filesystem, or persistence layer.                        */
/* -------------------------------------------------------------------------- */

const FORBIDDEN_OPERATIONAL_IMPORT_FRAGMENTS = [
  // The prediction store itself
  'mlb-shadow-monitoring-prediction-store',
  // Filesystem / persistence
  'node:fs',
  'persistence',
  // Capture orchestrator / scheduler / activation
  'capture-orchestrator',
  'scheduler',
  'activation',
  // Evidence binding
  'game-identity-binding',
  // Outcomes / grading / performance
  'outcome',
  'grading',
  'performance',
  // Network
  'axios',
  'undici',
  'fetch',
  'node:http',
  'node:https',
  'node:net',
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

describe('L5E2R persistence boundary — store import audit', () => {
  const storePath = resolve(SRC_ROOT, STORE_FILE);
  const storeSource = readFileSync(storePath, 'utf-8');
  const importPaths = extractImportPaths(storeSource);

  it('store imports only allowed persistence dependencies', () => {
    const disallowed = importPaths.filter(
      (p) => !ALLOWED_STORE_IMPORTS.includes(p),
    );
    expect(disallowed).toEqual([]);
  });

  it('L5E2R_IMPORT_BOUNDARY = PASS (store whitelist)', () => {
    const disallowed = importPaths.filter(
      (p) => !ALLOWED_STORE_IMPORTS.includes(p),
    );
    if (disallowed.length > 0) {
      throw new Error(
        `Disallowed imports in store: ${disallowed.join(', ')}`,
      );
    }
    expect(true).toBe(true);
  });

  it('store has no forbidden import fragments', () => {
    const violations = importPaths.filter((imp) =>
      FORBIDDEN_STORE_IMPORT_FRAGMENTS.some((frag) =>
        imp.toLowerCase().includes(frag.toLowerCase()),
      ),
    );
    expect(violations).toEqual([]);
  });

  it('store has no forbidden runtime patterns', () => {
    // The store must not use Date.now or Math.random
    expect(storeSource).not.toMatch(/Date\.now\s*\(/);
    expect(storeSource).not.toMatch(/Math\.random\s*\(/);
  });

  it('store uses crypto randomness (randomUUID) for temp filenames', () => {
    expect(storeSource).toMatch(/randomUUID/);
    expect(storeSource).toMatch(/node:crypto/);
  });
});

describe('L5E2R persistence boundary — operational read files cannot access prediction writer', () => {
  for (const file of OPERATIONAL_FILES) {
    const filePath = resolve(SRC_ROOT, file);
    const source = readFileSync(filePath, 'utf-8');
    const importPaths = extractImportPaths(source);

    describe(`${file}`, () => {
      it('does not import the prediction store', () => {
        const violations = importPaths.filter((p) =>
          p
            .toLowerCase()
            .includes('mlb-shadow-monitoring-prediction-store'),
        );
        expect(violations).toEqual([]);
      });

      it('does not import node:fs or node:fs/promises', () => {
        const violations = importPaths.filter((p) =>
          p.toLowerCase().includes('node:fs'),
        );
        expect(violations).toEqual([]);
      });

      it('does not import persistence modules', () => {
        const violations = importPaths.filter((p) =>
          p.toLowerCase().includes('persistence'),
        );
        expect(violations).toEqual([]);
      });
    });

    it(`${file} — OPERATIONAL_READ_CAN_ACCESS_PREDICTION_WRITER = NO`, () => {
      const violations = importPaths.filter(
        (p) =>
          p
            .toLowerCase()
            .includes('mlb-shadow-monitoring-prediction-store') ||
          p.toLowerCase().includes('node:fs') ||
          p.toLowerCase().includes('persistence'),
      );
      if (violations.length > 0) {
        throw new Error(
          `Operational file ${file} can access writer: ${violations.join(', ')}`,
        );
      }
      expect(true).toBe(true);
    });
  }

  it('L5E2R_IMPORT_BOUNDARY = PASS (operational isolation)', () => {
    for (const file of OPERATIONAL_FILES) {
      const filePath = resolve(SRC_ROOT, file);
      const source = readFileSync(filePath, 'utf-8');
      const importPaths = extractImportPaths(source);

      for (const imp of importPaths) {
        const lower = imp.toLowerCase();
        for (const frag of FORBIDDEN_OPERATIONAL_IMPORT_FRAGMENTS) {
          if (lower.includes(frag.toLowerCase())) {
            throw new Error(
              `Forbidden import in ${file}: ${imp} (matches "${frag}")`,
            );
          }
        }
      }
    }
    expect(true).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  Static result-contract guard — post-finalization verification failure     */
/* -------------------------------------------------------------------------- */

describe('L5E2R result-contract guard — post-finalization verification failure', () => {
  const storePath = resolve(SRC_ROOT, STORE_FILE);
  const storeSource = readFileSync(storePath, 'utf-8');

  it('store source retains VERIFICATION_FAILED branch in result type', () => {
    expect(storeSource).toContain("'VERIFICATION_FAILED'");
  });

  it('store source declares artifactCreated: true in verification failure branch', () => {
    expect(storeSource).toContain('artifactCreated: true');
  });

  it('store source declares verificationOk: false in verification failure branch', () => {
    expect(storeSource).toContain('verificationOk: false');
  });

  it('L5E2R_RESULT_CONTRACT = PASS (post-finalization seal)', () => {
    expect(storeSource).toContain("'VERIFICATION_FAILED'");
    expect(storeSource).toContain('artifactCreated: true');
    expect(storeSource).toContain('verificationOk: false');
  });
});
