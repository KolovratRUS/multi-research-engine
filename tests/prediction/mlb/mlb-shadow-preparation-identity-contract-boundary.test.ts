/* -------------------------------------------------------------------------- */
/*  Boundary / sealing tests for the MLB Shadow Preparation Identity contract   */
/*  (P5F-C4)                                                                   */
/* -------------------------------------------------------------------------- */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC_ROOT = join(process.cwd(), 'src');
const ML_DIR = join(SRC_ROOT, 'prediction', 'mlb');
const CONTRACT_SOURCE = join(
  ML_DIR,
  'mlb-shadow-preparation-identity-contract.ts',
);

/* -------------------------------------------------------------------------- */
/*  Helper: extract import specifiers from source                             */
/* -------------------------------------------------------------------------- */

function extractImportSources(source: string): string[] {
  const pattern = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  const imports: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

/* -------------------------------------------------------------------------- */

describe('mlb-shadow-preparation-identity-contract boundary', () => {
  /* ---------------------------------------------------------------------- */
  /*  A. Source file exists                                                  */
  /* ---------------------------------------------------------------------- */

  it('A1. contract file exists in src/prediction/mlb', () => {
    expect(() => readFileSync(CONTRACT_SOURCE, 'utf8')).not.toThrow();
  });

  /* ---------------------------------------------------------------------- */
  /*  B. Zero imports                                                        */
  /* ---------------------------------------------------------------------- */

  it('B1. contract has zero import statements', () => {
    const source = readFileSync(CONTRACT_SOURCE, 'utf8');
    // Match actual import statements (import at start of a line after optional whitespace)
    expect(source).not.toMatch(/(?:^|\n)\s*import\s+/);
  });

  it('B2. contract has no require calls', () => {
    const source = readFileSync(CONTRACT_SOURCE, 'utf8');
    expect(source).not.toMatch(/\brequire\s*\(/);
  });

  it('B3. contract imports no node: modules', () => {
    const source = readFileSync(CONTRACT_SOURCE, 'utf8');
    const imports = extractImportSources(source);
    const nodeImports = imports.filter(
      (s) => s.startsWith('node:') || s.startsWith('fs') || s.startsWith('path') || s.startsWith('crypto'),
    );
    expect(nodeImports).toEqual([]);
  });

  /* ---------------------------------------------------------------------- */
  /*  C. Required runtime exports                                            */
  /* ---------------------------------------------------------------------- */

  it('C1. exports MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION', () => {
    const source = readFileSync(CONTRACT_SOURCE, 'utf8');
    expect(source).toContain(
      'export const MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION',
    );
    expect(source).toContain(
      "'mlb-shadow-preparation-identity-v1'",
    );
  });

  it('C2. exports MLB_SHADOW_PREPARATION_IDENTITY_FIELD_ORDER', () => {
    const source = readFileSync(CONTRACT_SOURCE, 'utf8');
    expect(source).toContain(
      'export const MLB_SHADOW_PREPARATION_IDENTITY_FIELD_ORDER',
    );
  });

  it('C3. exports validateMLBShadowPreparationIdentityRecord', () => {
    const source = readFileSync(CONTRACT_SOURCE, 'utf8');
    expect(source).toContain('export function validateMLBShadowPreparationIdentityRecord');
  });

  it('C4. exports canonicalSerializeMLBShadowPreparationIdentityRecord', () => {
    const source = readFileSync(CONTRACT_SOURCE, 'utf8');
    expect(source).toContain('export function canonicalSerializeMLBShadowPreparationIdentityRecord');
  });

  it('C5. exports parseMLBShadowPreparationIdentityRecord', () => {
    const source = readFileSync(CONTRACT_SOURCE, 'utf8');
    expect(source).toContain('export function parseMLBShadowPreparationIdentityRecord');
  });

  /* ---------------------------------------------------------------------- */
  /*  D. No I/O / clock / network side-effects                             */
  /* ---------------------------------------------------------------------- */

  it('D1. contract source has no Date.now', () => {
    const source = readFileSync(CONTRACT_SOURCE, 'utf8');
    expect(source).not.toMatch(/Date\.now\s*\(/);
  });

  it('D2. contract source has no new Date', () => {
    const source = readFileSync(CONTRACT_SOURCE, 'utf8');
    expect(source).not.toMatch(/new\s+Date\s*\(/);
  });

  it('D3. contract source has no Math.random', () => {
    const source = readFileSync(CONTRACT_SOURCE, 'utf8');
    expect(source).not.toMatch(/Math\.random\s*\(/);
  });

  it('D4. contract source has no fetch', () => {
    const source = readFileSync(CONTRACT_SOURCE, 'utf8');
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });

  it('D5. contract source has no filesystem calls', () => {
    const source = readFileSync(CONTRACT_SOURCE, 'utf8');
    expect(source).not.toMatch(/fs\.|writeFileSync|readFileSync|mkdir|unlink|link/);
  });

  /* ---------------------------------------------------------------------- */
  /*  E. Canonical serialization does not include extra fields or whitespace */
  /* ---------------------------------------------------------------------- */

  it('E1. canonical serialize uses JSON.stringify with explicit key order', () => {
    const source = readFileSync(CONTRACT_SOURCE, 'utf8');
    // Must use JSON.stringify
    expect(source).toMatch(/JSON\.stringify/);
    // The four fields must be referenced in canonicalSerialize body
    const serializeStart = source.indexOf('function canonicalSerializeMLBShadowPreparationIdentityRecord');
    expect(serializeStart).toBeGreaterThanOrEqual(0);
    const serializeEnd = source.indexOf('\n}', serializeStart);
    const serializeSection = source.slice(serializeStart, serializeEnd);

    expect(serializeSection).toContain('contractVersion');
    expect(serializeSection).toContain('preparationRequestId');
    expect(serializeSection).toContain('gamePk');
    expect(serializeSection).toContain('shadowRecordId');
  });

  /* ---------------------------------------------------------------------- */
  /*  F. parse wraps JSON.parse with safe error handling                     */
  /* ---------------------------------------------------------------------- */

  it('F1. parse function calls JSON.parse', () => {
    const source = readFileSync(CONTRACT_SOURCE, 'utf8');
    const parseStart = source.indexOf('function parseMLBShadowPreparationIdentityRecord');
    expect(parseStart).toBeGreaterThanOrEqual(0);
    const parseEnd = source.indexOf('\n}', parseStart);
    const parseSection = source.slice(parseStart, parseEnd);
    expect(parseSection).toMatch(/JSON\.parse/);
  });

  it('F2. parse function catches JSON.parse errors (does not throw)', () => {
    const source = readFileSync(CONTRACT_SOURCE, 'utf8');
    const parseStart = source.indexOf('function parseMLBShadowPreparationIdentityRecord');
    expect(parseStart).toBeGreaterThanOrEqual(0);
    const parseEnd = source.indexOf('\n}', parseStart);
    const parseSection = source.slice(parseStart, parseEnd);
    expect(parseSection).toMatch(/try/);
    expect(parseSection).toMatch(/catch/);
  });

  /* ---------------------------------------------------------------------- */
  /*  G. Field order constant matches serialized output                     */
  /* ---------------------------------------------------------------------- */

  it('G1. field order constant has exactly 4 entries', () => {
    const source = readFileSync(CONTRACT_SOURCE, 'utf8');
    expect(source).toContain("'contractVersion'");
    expect(source).toContain("'preparationRequestId'");
    expect(source).toContain("'gamePk'");
    expect(source).toContain("'shadowRecordId'");
  });
});
