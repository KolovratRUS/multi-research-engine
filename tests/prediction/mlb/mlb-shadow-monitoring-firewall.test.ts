import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MLB_SHADOW_MONITORING_FOUNDATION_SOURCES,
  MLB_SHADOW_MONITORING_FOUNDATION_SOURCE_PATHS,
  MLB_SHADOW_MONITORING_FORBIDDEN_IMPORTS,
  MLB_SHADOW_MONITORING_FORBIDDEN_SIDE_EFFECT_PATTERNS,
  MLB_SHADOW_MONITORING_FORBIDDEN_IO_MODULES,
} from '@/prediction/mlb/mlb-shadow-monitoring-firewall';

/* -------------------------------------------------------------------------- */
/*  Static analysis helpers                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Extracts all module specifiers from import/export-from statements in a
 * TypeScript source string.
 */
function moduleSources(source: string): string[] {
  const sources = new Set<string>();
  const regex =
    /(?:^|\n)\s*(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    sources.add(match[1]);
  }
  // Also capture bare side-effect imports: import 'foo'
  const bareRegex = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;
  while ((match = bareRegex.exec(source)) !== null) {
    sources.add(match[1]);
  }
  return Array.from(sources);
}

/**
 * Reads a foundation source file from src/prediction/mlb/.
 */
function readFoundationSource(fileName: string): string {
  const fullPath = new URL(
    `../../../src/prediction/mlb/${fileName}`,
    import.meta.url,
  ).pathname;
  return readFileSync(fullPath, 'utf8');
}

/**
 * Reads a foundation source file by its full relative path.
 */
function readFoundationSourceFile(relativePath: string): string {
  const fullPath = new URL(
    `../../../${relativePath}`,
    import.meta.url,
  ).pathname;
  return readFileSync(fullPath, 'utf8');
}

/**
 * Returns true if a source line is a comment or string literal
 * (and therefore should be exempt from side-effect audits).
 */
function isCommentOrStringLine(line: string): boolean {
  const trimmed = line.trimStart();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('"') ||
    trimmed.startsWith("'")
  );
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                       */
/* -------------------------------------------------------------------------- */

describe('mlb-shadow-monitoring-firewall', () => {
  describe('foundation source set is exactly four files', () => {
    it('defines exactly four foundation source files', () => {
      expect(MLB_SHADOW_MONITORING_FOUNDATION_SOURCES).toHaveLength(4);
    });

    it('defines exactly four foundation source paths', () => {
      expect(MLB_SHADOW_MONITORING_FOUNDATION_SOURCE_PATHS).toHaveLength(4);
    });

    it('all foundation source paths end with .ts', () => {
      for (const p of MLB_SHADOW_MONITORING_FOUNDATION_SOURCE_PATHS) {
        expect(p).toMatch(/\.ts$/);
      }
    });
  });

  describe('foundation import firewall', () => {
    it('no foundation file imports forbidden scientific modules', () => {
      const violations: string[] = [];
      for (const fileName of MLB_SHADOW_MONITORING_FOUNDATION_SOURCES) {
        const source = readFoundationSource(fileName);
        const imports = moduleSources(source);
        for (const imp of imports) {
          for (const forbidden of MLB_SHADOW_MONITORING_FORBIDDEN_IMPORTS) {
            if (imp.includes(forbidden)) {
              violations.push(
                `${fileName}: import "${imp}" contains forbidden "${forbidden}"`,
              );
            }
          }
        }
      }
      expect(violations).toEqual([]);
    });

    it('no foundation file imports forbidden IO modules (fs, crypto)', () => {
      const violations: string[] = [];
      for (const fileName of MLB_SHADOW_MONITORING_FOUNDATION_SOURCES) {
        const source = readFoundationSource(fileName);
        const imports = moduleSources(source);
        for (const imp of imports) {
          for (const forbiddenModule of MLB_SHADOW_MONITORING_FORBIDDEN_IO_MODULES) {
            if (imp === forbiddenModule) {
              violations.push(
                `${fileName}: imports forbidden IO module "${imp}"`,
              );
            }
          }
        }
      }
      expect(violations).toEqual([]);
    });

    it('record-contract has no quarantine reader or unblind imports', () => {
      const source = readFoundationSource(
        'mlb-shadow-monitoring-record-contract.ts',
      );
      const imports = moduleSources(source);
      for (const imp of imports) {
        expect(imp).not.toMatch(/quarantine/i);
        expect(imp).not.toMatch(/unblind/i);
        expect(imp).not.toMatch(/reader/i);
      }
    });

    it('no foundation file imports quarantine-reader or unblind modules', () => {
      const violations: string[] = [];
      for (const fileName of MLB_SHADOW_MONITORING_FOUNDATION_SOURCES) {
        const source = readFoundationSource(fileName);
        const imports = moduleSources(source);
        for (const imp of imports) {
          if (
            imp.includes('quarantine-reader') ||
            imp.includes('unblind')
          ) {
            violations.push(`${fileName}: imports "${imp}"`);
          }
        }
      }
      expect(violations).toEqual([]);
    });
  });

  describe('runtime side-effect audit', () => {
    it('no foundation file performs runtime filesystem writes', () => {
      const violations: string[] = [];
      for (const filePath of MLB_SHADOW_MONITORING_FOUNDATION_SOURCE_PATHS) {
        const source = readFoundationSourceFile(filePath);
        for (const pattern of MLB_SHADOW_MONITORING_FORBIDDEN_SIDE_EFFECT_PATTERNS) {
          if (pattern.test(source)) {
            violations.push(
              `${filePath}: matches forbidden side-effect pattern ${pattern}`,
            );
          }
        }
      }
      expect(violations).toEqual([]);
    });

    it('no foundation file invokes network or schedule access', () => {
      const networkPatterns: RegExp[] = [
        /\bfetch\s*\(/,
        /\baxios\b/,
        /\bMLBStatsAPIClient\b/,
        /\brunProspectiveHoldoutCapture\b/,
        /\brunMLBProspectiveHoldoutScheduler\b/,
      ];
      const violations: string[] = [];
      for (const filePath of MLB_SHADOW_MONITORING_FOUNDATION_SOURCE_PATHS) {
        const source = readFoundationSourceFile(filePath);
        for (const pattern of networkPatterns) {
          if (pattern.test(source)) {
            violations.push(
              `${filePath}: matches network/schedule pattern ${pattern}`,
            );
          }
        }
      }
      expect(violations).toEqual([]);
    });

    it('L5E2P runtime side-effect audit: no side-effect calls in code lines', () => {
      // Combines all forbidden patterns and checks only non-comment,
      // non-string-literal lines for call sites. This avoids false
      // positives from documentation strings that mention forbidden
      // primitives by name.
      const allPatterns: RegExp[] = [
        ...MLB_SHADOW_MONITORING_FORBIDDEN_SIDE_EFFECT_PATTERNS,
        /\bfetch\s*\(/,
        /\baxios\b/,
        /\bMLBStatsAPIClient\b/,
        /\brunProspectiveHoldoutCapture\b/,
        /\brunMLBProspectiveHoldoutScheduler\b/,
      ];
      const violations: string[] = [];
      for (const filePath of MLB_SHADOW_MONITORING_FOUNDATION_SOURCE_PATHS) {
        const source = readFoundationSourceFile(filePath);
        const lines = source.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (isCommentOrStringLine(line)) {
            continue;
          }
          for (const pattern of allPatterns) {
            if (pattern.test(line)) {
              violations.push(
                `${filePath}:${i + 1}: ${pattern} in "${line.trim()}"`,
              );
            }
          }
        }
      }
      // The audit passes if no runtime side effects are found in
      // non-comment, non-string code lines.
      expect(violations).toEqual([]);
    });
  });
});
