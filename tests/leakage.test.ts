import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RESEARCH_DIR = join(__dirname, '../src/lib/research');

const FORBIDDEN_MODULE_PREFIXES = [
  '../../odds',
  '../odds',
  '@/lib/odds',
];

const FORBIDDEN_SYMBOLS = [
  'PricedCandidate',
  'OddsSample',
  'CanonicalBookmaker',
  'CanonicalBookmakerValue',
  'OddsProvider',
  'NormalizedOdds',
  'MarketMatch',
  'MultiBuildOptions',
  'MultiBuildResult',
  'TierConfig',
  'LegResult',
  'MultiStatus',
];

function walk(dir: string, files: string[] = []): string[] {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, files);
    } else if (full.endsWith('.ts') && !full.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

interface ImportRecord {
  symbols: string[];
  source: string;
}

function extractImports(content: string): ImportRecord[] {
  const imports: ImportRecord[] = [];
  const regex = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    imports.push({
      symbols: match[1].split(',').map((s) => s.trim()),
      source: match[2],
    });
  }
  return imports;
}

describe('Stage 1 leakage check', () => {
  it('research files must not import Stage 2 odds or candidate pricing types', () => {
    const files = walk(RESEARCH_DIR);
    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const imports = extractImports(content);

      for (const imp of imports) {
        for (const prefix of FORBIDDEN_MODULE_PREFIXES) {
          if (imp.source.startsWith(prefix)) {
            violations.push(`${file} imports from forbidden module ${imp.source}`);
          }
        }
        for (const sym of FORBIDDEN_SYMBOLS) {
          if (imp.symbols.includes(sym)) {
            violations.push(`${file} imports forbidden symbol ${sym}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
