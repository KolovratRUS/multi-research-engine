import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  validateHistoricalResearchExportManifest,
  buildHistoricalResearchExport,
  type HistoricalResearchExport,
} from '@/lib/backtesting/historical-research-export';
import {
  buildFixtureOrchestrationResult,
  buildFixturePrediction,
  buildFixtureComparison,
  FIXTURE_GENERATED_AT,
} from './helpers/historical-research-export-fixtures';

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'historical-research-export');

function buildValidFULL(): HistoricalResearchExport {
  return buildHistoricalResearchExport({
    orchestrationResult: buildFixtureOrchestrationResult([
      buildFixturePrediction({
        gamePk: 1,
        warnings: ['full-warn'],
        includedEvidenceDomains: ['team-offense'],
        excludedEvidenceDomains: ['starting-pitcher'],
      }),
    ]),
    researchConstruction: 'FULL',
    source: 'fixture',
    generatedAt: FIXTURE_GENERATED_AT,
  });
}

function buildValidTEAM_ONLY(): HistoricalResearchExport {
  return buildHistoricalResearchExport({
    orchestrationResult: buildFixtureOrchestrationResult([
      buildFixturePrediction({
        gamePk: 2,
        researchConstructionMode: 'TEAM_ONLY',
        researchModelVersion: 'team-only-v1',
        warnings: ['team-warn'],
      }),
    ]),
    researchConstruction: 'TEAM_ONLY',
    source: 'fixture',
    generatedAt: FIXTURE_GENERATED_AT,
  });
}

function buildValidBOTH(): HistoricalResearchExport {
  return buildHistoricalResearchExport({
    orchestrationResult: buildFixtureOrchestrationResult([
      buildFixturePrediction({ gamePk: 1 }),
      buildFixturePrediction({ gamePk: 2, researchConstructionMode: 'TEAM_ONLY', researchModelVersion: 'team-only-v1' }),
    ]),
    researchConstruction: 'BOTH',
    source: 'fixture',
    generatedAt: FIXTURE_GENERATED_AT,
    comparison: buildFixtureComparison(),
  });
}

function buildValidAbstention(): HistoricalResearchExport {
  return buildHistoricalResearchExport({
    orchestrationResult: buildFixtureOrchestrationResult([], [
      buildFixturePrediction({
        gamePk: 3,
        abstained: true,
        abstentionReason: 'QUALITY_BELOW_THRESHOLD',
        warnings: ['abs-warn-1', 'abs-warn-2'],
        researchConstructionMode: 'TEAM_ONLY',
        researchModelVersion: 'team-only-v1',
      }),
    ]),
    researchConstruction: 'TEAM_ONLY',
    source: 'fixture',
    generatedAt: FIXTURE_GENERATED_AT,
  });
}

function mutateExport(exportObj: HistoricalResearchExport, mutator: (obj: Record<string, unknown>) => void): unknown {
  const copy = JSON.parse(JSON.stringify(exportObj)) as Record<string, unknown>;
  mutator(copy);
  return copy;
}

describe('validateHistoricalResearchExportManifest', () => {
  it('A: valid FULL export returns valid true and no issues', () => {
    const validation = validateHistoricalResearchExportManifest(buildValidFULL());
    expect(validation.valid).toBe(true);
    expect(validation.issues).toEqual([]);
  });

  it('B: valid TEAM_ONLY export returns valid true and no issues', () => {
    const validation = validateHistoricalResearchExportManifest(buildValidTEAM_ONLY());
    expect(validation.valid).toBe(true);
    expect(validation.issues).toEqual([]);
  });

  it('C: valid BOTH export with comparison returns valid true and no issues', () => {
    const validation = validateHistoricalResearchExportManifest(buildValidBOTH());
    expect(validation.valid).toBe(true);
    expect(validation.issues).toEqual([]);
  });

  it('D: valid abstention-heavy export returns valid true and no issues', () => {
    const validation = validateHistoricalResearchExportManifest(buildValidAbstention());
    expect(validation.valid).toBe(true);
    expect(validation.issues).toEqual([]);
  });

  it('E: generated golden fixtures parse and validate cleanly', async () => {
    for (const name of ['full-export-v1.json', 'team-only-export-v1.json', 'both-export-v1.json', 'abstention-export-v1.json']) {
      const content = await fs.readFile(path.join(FIXTURE_DIR, name), 'utf-8');
      const parsed = JSON.parse(content);
      const validation = validateHistoricalResearchExportManifest(parsed);
      expect(validation.valid).toBe(true);
      expect(validation.issues).toEqual([]);
    }
  });

  it('F: detects exportVersion mismatch', () => {
    const bad = mutateExport(buildValidFULL(), (obj) => {
      const manifest = obj.manifest as Record<string, unknown>;
      manifest.exportVersion = 'historical-research-export-v9';
    });
    const validation = validateHistoricalResearchExportManifest(bad);
    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain('MANIFEST_EXPORT_VERSION_MISMATCH');
  });

  it('G: detects generatedAt mismatch', () => {
    const bad = mutateExport(buildValidFULL(), (obj) => {
      const manifest = obj.manifest as Record<string, unknown>;
      manifest.generatedAt = '2000-01-01T00:00:00.000Z';
    });
    const validation = validateHistoricalResearchExportManifest(bad);
    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain('MANIFEST_GENERATED_AT_MISMATCH');
  });

  it('H: detects source mismatch', () => {
    const bad = mutateExport(buildValidFULL(), (obj) => {
      const manifest = obj.manifest as Record<string, unknown>;
      manifest.source = 'live';
    });
    const validation = validateHistoricalResearchExportManifest(bad);
    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain('MANIFEST_SOURCE_MISMATCH');
  });

  it('I: detects researchConstruction mismatch', () => {
    const bad = mutateExport(buildValidFULL(), (obj) => {
      const manifest = obj.manifest as Record<string, unknown>;
      manifest.researchConstruction = 'TEAM_ONLY';
    });
    const validation = validateHistoricalResearchExportManifest(bad);
    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain('MANIFEST_RESEARCH_CONSTRUCTION_MISMATCH');
  });

  it('J: detects dateRange mismatch', () => {
    const bad = mutateExport(buildValidFULL(), (obj) => {
      const manifest = obj.manifest as Record<string, unknown>;
      manifest.dateRange = { startDate: '2000-01-01', endDate: '2000-01-02' };
    });
    const validation = validateHistoricalResearchExportManifest(bad);
    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain('MANIFEST_DATE_RANGE_MISMATCH');
  });

  it('K: detects requestedDateCount mismatch', () => {
    const bad = mutateExport(buildValidFULL(), (obj) => {
      const manifest = obj.manifest as Record<string, unknown>;
      manifest.requestedDateCount = 999;
    });
    const validation = validateHistoricalResearchExportManifest(bad);
    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain('MANIFEST_REQUESTED_DATE_COUNT_MISMATCH');
  });

  it('L: detects prediction count mismatch', () => {
    const bad = mutateExport(buildValidFULL(), (obj) => {
      const manifest = obj.manifest as Record<string, unknown>;
      manifest.resultCounts = { predictions: 999, abstentions: 0, warnings: 0 };
    });
    const validation = validateHistoricalResearchExportManifest(bad);
    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain('MANIFEST_PREDICTION_COUNT_MISMATCH');
  });

  it('M: detects abstention count mismatch', () => {
    const bad = mutateExport(buildValidFULL(), (obj) => {
      const manifest = obj.manifest as Record<string, unknown>;
      manifest.resultCounts = { predictions: 1, abstentions: 999, warnings: 0 };
    });
    const validation = validateHistoricalResearchExportManifest(bad);
    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain('MANIFEST_ABSTENTION_COUNT_MISMATCH');
  });

  it('N: detects warning count mismatch', () => {
    const bad = mutateExport(buildValidFULL(), (obj) => {
      const manifest = obj.manifest as Record<string, unknown>;
      manifest.resultCounts = { predictions: 1, abstentions: 0, warnings: 999 };
    });
    const validation = validateHistoricalResearchExportManifest(bad);
    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain('MANIFEST_WARNING_COUNT_MISMATCH');
  });

  it('O: detects comparisonIncluded mismatch', () => {
    const bad = mutateExport(buildValidFULL(), (obj) => {
      const manifest = obj.manifest as Record<string, unknown>;
      manifest.comparisonIncluded = true;
    });
    const validation = validateHistoricalResearchExportManifest(bad);
    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain('MANIFEST_COMPARISON_INCLUDED_MISMATCH');
  });

  it('P: detects included domain summary mismatch', () => {
    const bad = mutateExport(buildValidFULL(), (obj) => {
      const manifest = obj.manifest as Record<string, unknown>;
      manifest.evidenceDomainSummary = { included: ['missing'], excluded: [] };
    });
    const validation = validateHistoricalResearchExportManifest(bad);
    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain('MANIFEST_INCLUDED_DOMAINS_MISMATCH');
  });

  it('Q: detects excluded domain summary mismatch', () => {
    const bad = mutateExport(buildValidFULL(), (obj) => {
      const manifest = obj.manifest as Record<string, unknown>;
      manifest.evidenceDomainSummary = { included: [], excluded: ['added'] };
    });
    const validation = validateHistoricalResearchExportManifest(bad);
    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain('MANIFEST_EXCLUDED_DOMAINS_MISMATCH');
  });

  it('R: detects warning summary mismatch', () => {
    const bad = mutateExport(buildValidFULL(), (obj) => {
      const manifest = obj.manifest as Record<string, unknown>;
      manifest.warningSummary = ['missing'];
    });
    const validation = validateHistoricalResearchExportManifest(bad);
    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain('MANIFEST_WARNING_SUMMARY_MISMATCH');
  });

  it('S: detects exportId mismatch', () => {
    const bad = mutateExport(buildValidFULL(), (obj) => {
      const manifest = obj.manifest as Record<string, unknown>;
      manifest.exportId = 'historical-research-export-v1:000000000000';
    });
    const validation = validateHistoricalResearchExportManifest(bad);
    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain('MANIFEST_EXPORT_ID_MISMATCH');
  });

  it('T: detects modelProbability field if injected', () => {
    const bad = mutateExport(buildValidFULL(), (obj) => {
      obj.modelProbability = 0.9;
    });
    const validation = validateHistoricalResearchExportManifest(bad);
    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain('FORBIDDEN_FIELD_PRESENT');
  });

  it('U: detects forbidden concept key if injected', () => {
    const bad = mutateExport(buildValidFULL(), (obj) => {
      obj.sportsbook = 'fanduel';
    });
    const validation = validateHistoricalResearchExportManifest(bad);
    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain('FORBIDDEN_FIELD_PRESENT');
  });

  it('V: validation does not mutate the export object', () => {
    const exportObj = buildValidFULL();
    const before = JSON.stringify(exportObj);
    validateHistoricalResearchExportManifest(exportObj);
    expect(JSON.stringify(exportObj)).toBe(before);
  });

  it('W: validation result is JSON.stringify-safe', () => {
    const result = validateHistoricalResearchExportManifest(buildValidFULL());
    expect(() => JSON.stringify(result)).not.toThrow();
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});
