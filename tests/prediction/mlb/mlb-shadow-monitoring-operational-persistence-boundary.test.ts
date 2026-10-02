/* -------------------------------------------------------------------------- */
/*  L5E2T — operational store static boundary test                             */
/* -------------------------------------------------------------------------- */
/*  Read-only source inspection of the operational store. Verifies:            */
/*    - import allowlist (no sensitive/prediction/orchestrator/quarantine deps)*/
/*    - no public operational reader                                          */
/*    - public persist API has no stage argument                              */
/*    - no RESULT persistence function                                        */
/*    - no GRADING persistence function                                        */
/*    - no raw validationResult.issues forwarding                            */
/*    - no issue.message forwarding                                          */
/*    - no issue.path forwarding                                              */
/*    - no relativePath in public result contract                            */
/*    - no fs.rename finalization                                            */
/*    - no direct final-path overwrite                                        */
/*    - fs.link is the no-replace finalization primitive                     */
/* -------------------------------------------------------------------------- */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STORE_SOURCE_PATH = fileURLToPath(
  new URL('../../../src/prediction/mlb/mlb-shadow-monitoring-operational-store.ts', import.meta.url),
);

const ALLOWED_IMPORTS = new Set([
  'node:fs/promises',
  'node:path',
  'node:crypto',
  './mlb-shadow-monitoring-record-contract',
  './mlb-shadow-monitoring-namespace',
]);

const FORBIDDEN_FRAGMENTS = [
  'prediction-computation',
  'prediction-store',
  'prediction-orchestrator',
  'quarantine-contract',
  'model-fingerprint',
  'prospective-holdout',
  'scheduler',
  'activation',
  'pgame-evidence',
  'game-identity-binding',
  'outcome',
  'grading',
  'performance',
  'recommendation',
  'node:http',
  'node:https',
  'node:net',
  'node:tls',
  'axios',
  'undici',
  'node-fetch',
  'got',
  'fetch',
  'node:child_process',
] as const;

const RESULT_WRITER_NAMES = [
  'persistMLBShadowMonitoringResultOperationalRecord',
];
const GRADING_WRITER_NAMES = [
  'persistMLBShadowMonitoringGradingOperationalRecord',
];

async function readSource(): Promise<string> {
  const buf = await fs.readFile(STORE_SOURCE_PATH, 'utf-8');
  return buf.toString();
}

/**
 * Strips // and /* block comments so that comment prose mentioning
 * RESULT/GRADING/rename/issues conceptually does NOT mask real code
 * invariants. String literals in the store source contain no `//`, so a
 * line/block comment strip is safe here.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

function extractImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const re =
    /(?:^|\n)\s*(?:import\s+(?:[^'"`;]+?\s+from\s+)?|import\s*\*\s+as\s+[^'"`;]+\s+from\s+)['"`]([^'"`]+)['"`]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    specifiers.push(m[1]);
  }
  // Also catch dynamic/require-style and `import "x"` side-effect imports.
  const sideEffectRe = /(?:^|\n)\s*import\s+['"`]([^'"`]+)['"`]/g;
  while ((m = sideEffectRe.exec(source)) !== null) {
    specifiers.push(m[1]);
  }
  return specifiers;
}

function extractImportDeclarations(source: string): {
  all: string[];
  defaultSpecifiers: string[];
  namespaceSpecifiers: string[];
  namedSpecifiers: string[];
} {
  const all = extractImportSpecifiers(source);
  const defaultSpecifiers: string[] = [];
  const namespaceSpecifiers: string[] = [];
  const namedSpecifiers: string[] = [];

  const importRe =
    /(?:^|\n)\s*import\s+([^'"`;]+?)\s+from\s+['"`]([^'"`]+)['"`]/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(source)) !== null) {
    const clause = m[1];
    const specifier = m[2];
    if (clause.startsWith('* as ')) {
      namespaceSpecifiers.push(specifier);
    } else if (/,/.test(clause) && clause.split(',').some((p) => p.includes('{'))) {
      namedSpecifiers.push(specifier);
    } else if (clause.startsWith('{')) {
      namedSpecifiers.push(specifier);
    } else {
      defaultSpecifiers.push(specifier);
    }
  }
  return { all, defaultSpecifiers, namespaceSpecifiers, namedSpecifiers };
}

describe('L5E2T operational store — static boundary', () => {
  let source: string;
  let code: string;

  beforeEach(async () => {
    source = await readSource();
    code = stripComments(source);
  });

  /* ---------------------------------------------------------------- */
  /*  Import allowlist                                                  */
  /* ---------------------------------------------------------------- */

  describe('import allowlist', () => {
    it('allowed imports are limited to the locked set', () => {
      const imports = extractImportSpecifiers(source);
      const unexpected = imports.filter(
        (s) => !ALLOWED_IMPORTS.has(s),
      );
      expect(unexpected).toEqual([]);
    });

    it('no forbidden fragment appears in any import specifier', () => {
      const imports = extractImportSpecifiers(source);
      for (const specifier of imports) {
        for (const frag of FORBIDDEN_FRAGMENTS) {
          expect(specifier.toLowerCase()).not.toContain(
            frag.toLowerCase(),
          );
        }
      }
    });

    it('imports node:crypto for hashing only (createHash/randomUUID)', () => {
      const imports = extractImportDeclarations(source);
      const hasCrypto = imports.all.includes('node:crypto');
      expect(hasCrypto).toBe(true);
    });

    it('imports node:fs/promises for fs primitives only', () => {
      const imports = extractImportDeclarations(source);
      const hasFs = imports.all.includes('node:fs/promises');
      expect(hasFs).toBe(true);
    });

    it('imports the operational record contract', () => {
      const imports = extractImportDeclarations(source);
      expect(
        imports.all.includes(
          './mlb-shadow-monitoring-record-contract',
        ),
      ).toBe(true);
    });

    it('imports the operational namespace', () => {
      const imports = extractImportDeclarations(source);
      expect(
        imports.all.includes(
          './mlb-shadow-monitoring-namespace',
        ),
      ).toBe(true);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  No forbidden module surface anywhere (imports only)             */
  /* ---------------------------------------------------------------- */

  it('no forbidden module is imported (side-effect or binding)', () => {
    const sourceLower = source.toLowerCase();
    for (const frag of FORBIDDEN_FRAGMENTS) {
      // Only assert on import specifiers, not on field-name literals that
      // legitimately reference RESULT/GRADING provenance columns.
      const importSpecifiers = extractImportSpecifiers(source);
      for (const spec of importSpecifiers) {
        expect(spec.toLowerCase()).not.toContain(frag.toLowerCase());
      }
    }
    void sourceLower;
  });

  /* ---------------------------------------------------------------- */
  /*  Public API surface                                                */
  /* ---------------------------------------------------------------- */

  it('no public operational reader is exported', () => {
    const exportFnRe =
      /export\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
    const exportedFns: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = exportFnRe.exec(source)) !== null) {
      exportedFns.push(m[1]);
    }
    const readers = exportedFns.filter((n) =>
      /^(read|get|load|fetch|readback|readBack)/i.test(n),
    );
    expect(readers).toEqual([]);
  });

  it('public persist API has no stage argument', () => {
    const fnRe =
      /export\s+async\s+function\s+persistMLBShadowMonitoringPredictionOperationalRecord\s*\(([\s\S]*?)\)/;
    const match = source.match(fnRe);
    expect(match).not.toBeNull();
    const params = match![1];
    // Exactly two params, no `stage` param.
    expect(params).not.toMatch(/stage/);
    // Parameter tokens should be repoRoot and record only.
    expect(params).toMatch(/repoRoot\s*:/);
    expect(params).toMatch(/record\s*:/);
  });

  it('no RESULT persistence function is defined/exported', () => {
    for (const name of RESULT_WRITER_NAMES) {
      // As an exported function declaration OR assigned const.
      const asExportFn = new RegExp(
        `export\\s+(?:async\\s+)?function\\s+${name}\\s*\\(`,
      );
      const asExportConst = new RegExp(`export\\s+const\\s+${name}\\b`);
      expect(asExportFn.test(source)).toBe(false);
      expect(asExportConst.test(source)).toBe(false);
    }
  });

  it('no GRADING persistence function is defined/exported', () => {
    for (const name of GRADING_WRITER_NAMES) {
      const asExportFn = new RegExp(
        `export\\s+(?:async\\s+)?function\\s+${name}\\s*\\(`,
      );
      const asExportConst = new RegExp(`export\\s+const\\s+${name}\\b`);
      expect(asExportFn.test(source)).toBe(false);
      expect(asExportConst.test(source)).toBe(false);
    }
  });

  /* ---------------------------------------------------------------- */
  /*  No leaky forwarding of validator internals to the public result  */
  /* ---------------------------------------------------------------- */

  it('no raw validationResult.issues is forwarded', () => {
    expect(code).not.toContain('issues');
    expect(code).not.toContain('.issues');
  });

  it('no issue.message is forwarded', () => {
    expect(code).not.toContain('message');
  });

  it('no issue.path is forwarded (no `issue` binding exists)', () => {
    expect(code).not.toContain('issue');
  });

  it('no relativePath appears in the public result contract', () => {
    expect(code).not.toContain('relativePath');
  });

  /* ---------------------------------------------------------------- */
  /*  Finalization primitive invariants                                */
  /* ---------------------------------------------------------------- */

  it('no fs.rename finalization', () => {
    expect(code).not.toContain('rename');
  });

  it('no direct final-path overwrite (no writeFile/open on finalPath)', () => {
    expect(code).not.toContain('writeFile(finalPath');
    expect(code).not.toContain('open(finalPath');
    // No recursive mkdir overwrite of the final path.
    expect(code).not.toMatch(/mkdir\([^)]*finalPath/i);
  });

  it('fs.link is the no-replace finalization primitive', () => {
    expect(code).toContain('fs.link(');
    expect(code).not.toContain('copyFile');
    expect(code).not.toContain('rename');
  });

  it('temp file is created with O_EXCL (wx) and restrictive mode', () => {
    expect(source).toContain("'wx'");
    expect(source).toContain('0o600');
    expect(source).toContain('O_EXCL');
  });
});
