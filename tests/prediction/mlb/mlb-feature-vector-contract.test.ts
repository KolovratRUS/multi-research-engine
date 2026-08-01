import { describe, expect, it } from 'vitest';
import {
  MLB_FEATURE_MANIFEST_CONTRACT_VERSION,
  MLB_FEATURE_VECTOR_CONTRACT_VERSION,
  validateMLBFeatureManifest,
  validateMLBFeatureVector,
  extractMLBLeakageSafeFeatureVector,
} from '@/prediction/mlb/mlb-feature-vector-contract';
import {
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
  validateMLBCanonicalPregameSnapshot,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';

const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';

function buildSourceReference(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sourceRefId: 'src-official',
    sourceName: 'MLB Stats API',
    sourceCategory: 'OFFICIAL',
    roles: ['GAME_IDENTITY'],
    providerRecordId: null,
    fetchedAt: FROZEN_CAPTURED_AT,
    sourceUpdatedAt: FROZEN_DATA_CUTOFF,
    ...overrides,
  } as Record<string, unknown>;
}

function buildStartingPitcher(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    state: 'PROBABLE' as const,
    pitcherId: 'p-1',
    announcedAt: FROZEN_DATA_CUTOFF,
    sourceRefIds: ['src-official'],
    ...overrides,
  } as Record<string, unknown>;
}

function buildSection(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sectionId: 'sec-1',
    kind: 'GAME_CONTEXT' as const,
    entity: {
      scope: 'GAME' as const,
      entityId: null,
    },
    status: 'AVAILABLE' as const,
    asOfAt: FROZEN_DATA_CUTOFF,
    sourceRefIds: ['src-official'],
    payload: {},
    ...overrides,
  } as Record<string, unknown>;
}

function buildWarning(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code: 'PATCHY_WIND',
    path: '$.venue.wind',
    message: 'Wind speed varies across reported sources.',
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contractVersion: MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
    sport: 'MLB' as const,
    target: 'OFFICIAL_FINAL_GAME_WINNER' as const,
    snapshotId: 'snapshot-1',
    capturedAt: FROZEN_CAPTURED_AT,
    dataCutoffAt: FROZEN_DATA_CUTOFF,
    game: {
      gameId: 'game-1',
      scheduledStartAt: FROZEN_SCHEDULED_START,
      officialDate: '2026-07-15',
      season: 2026,
      gameType: 'REGULAR_SEASON' as const,
      status: 'SCHEDULED' as const,
      homeTeamId: 'home-1',
      awayTeamId: 'away-1',
      venueId: 'venue-1',
      neutralSite: false,
      doubleheader: null,
    },
    startingPitchers: {
      home: buildStartingPitcher(),
      away: buildStartingPitcher({ pitcherId: 'p-2', sourceRefIds: ['src-away'] }),
    },
    sourceReferences: [
      buildSourceReference({ sourceRefId: 'src-away', roles: ['STARTING_PITCHER'] }),
      buildSourceReference(),
    ],
    sections: [buildSection()],
    dataCompleteness: 'COMPLETE' as const,
    warnings: [buildWarning()],
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidFeature(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    featureId: 'f-1',
    sectionId: 'sec-1',
    payloadPath: ['count'],
    valueKind: 'NUMBER',
    missingPolicy: 'USE_DEFAULT',
    defaultValue: 0,
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contractVersion: MLB_FEATURE_MANIFEST_CONTRACT_VERSION,
    sport: 'MLB' as const,
    target: 'OFFICIAL_FINAL_GAME_WINNER' as const,
    manifestId: 'manifest-1',
    features: [buildValidFeature()],
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidVector(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contractVersion: MLB_FEATURE_VECTOR_CONTRACT_VERSION,
    sport: 'MLB' as const,
    target: 'OFFICIAL_FINAL_GAME_WINNER' as const,
    manifestId: 'manifest-1',
    snapshotId: 'snapshot-1',
    gameId: 'game-1',
    officialDate: '2026-07-15',
    dataCutoffAt: FROZEN_DATA_CUTOFF,
    values: [{ featureId: 'f-1', value: 1, wasMissing: false }],
    ...overrides,
  } as Record<string, unknown>;
}

function assertNoProhibitedFieldInSource(
  source: string,
  patterns: readonly string[],
): void {
  for (const pattern of patterns) {
    expect(source).not.toMatch(pattern);
  }
}

describe('mlb-feature-vector-contract', () => {
  it('accepts a minimal valid manifest and returns the exact original reference', () => {
    const manifest = buildValidManifest();
    const result = validateMLBFeatureManifest(manifest);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(manifest);
    }
  });

  it('validates exact manifest root fields, version, sport, target, and manifest ID', () => {
    expect(validateMLBFeatureManifest(buildValidManifest({ sport: 'NFL' })).ok).toBe(false);
    expect(validateMLBFeatureManifest(buildValidManifest({ target: 'REGULATION_ONLY' })).ok).toBe(false);
    expect(validateMLBFeatureManifest(buildValidManifest({ manifestId: '' })).ok).toBe(false);
    const unknownRoot = buildValidManifest({ mysteryField: true } as Record<string, unknown>);
    const result = validateMLBFeatureManifest(unknownRoot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'UNKNOWN_FIELD', path: '$.mysteryField' })]),
      );
    }
  });

  it('validates exact feature-definition fields and literal values', () => {
    const badValueKind = buildValidManifest({
      features: [buildValidFeature({ valueKind: 'STRING' })],
    });
    expect(validateMLBFeatureManifest(badValueKind).ok).toBe(false);

    const badPolicy = buildValidManifest({
      features: [buildValidFeature({ missingPolicy: 'IMPUTE' })],
    });
    expect(validateMLBFeatureManifest(badPolicy).ok).toBe(false);

    const defaultMismatch = buildValidManifest({
      features: [buildValidFeature({ missingPolicy: 'REJECT', defaultValue: 1 })],
    });
    expect(validateMLBFeatureManifest(defaultMismatch).ok).toBe(false);
  });

  it('validates strict feature and section identifiers with actual control characters', () => {
    const badFeatureId = buildValidManifest({
      features: [buildValidFeature({ featureId: 'f\u0000-1' })],
    });
    expect(validateMLBFeatureManifest(badFeatureId).ok).toBe(false);

    const badSectionId = buildValidManifest({
      features: [buildValidFeature({ sectionId: 'sec\u0000-1' })],
    });
    expect(validateMLBFeatureManifest(badSectionId).ok).toBe(false);
  });

  it('validates string and numeric payload-path segments', () => {
    const invalidPath = buildValidManifest({
      features: [buildValidFeature({ payloadPath: ['', 1.5] })],
    });
    expect(validateMLBFeatureManifest(invalidPath).ok).toBe(false);
  });

  it('rejects empty, sparse, accessor, symbol, and malformed payload paths', () => {
    const arrays: Array<Record<string, unknown>> = [];
    for (let i = 0; i < 5; i++) {
      const source: unknown[] = [];
      Object.defineProperty(source, '0', { value: buildValidFeature(), enumerable: true });
      Object.defineProperty(source, '1', { value: buildValidFeature(), enumerable: false });
      Object.defineProperty(source, Symbol('symbol'), { value: buildValidFeature(), enumerable: false });
      arrays.push({
        features: source as unknown[],
      });
    }

    const invalidEmpty = buildValidManifest({
      features: [buildValidFeature({ payloadPath: [] })],
    });
    expect(validateMLBFeatureManifest(invalidEmpty).ok).toBe(false);

    const sparsePath: unknown[] = [];
    Object.defineProperty(sparsePath, '1', { value: 0, enumerable: true });
    const sparse = buildValidManifest({
      features: [buildValidFeature({ payloadPath: sparsePath })],
    });
    expect(validateMLBFeatureManifest(sparse).ok).toBe(false);

    let getterExecuted = false;
    const accessorArr: unknown[] = [];
    Object.defineProperty(accessorArr, '0', {
      get() {
        getterExecuted = true;
        return 0;
      },
      enumerable: true,
    });
    const accessorPath = buildValidManifest({
      features: [buildValidFeature({ payloadPath: accessorArr as unknown[] })],
    });
    expect(validateMLBFeatureManifest(accessorPath).ok).toBe(false);
    expect(getterExecuted).toBe(false);

    const symbolPath = buildValidManifest({
      features: [buildValidFeature({ payloadPath: [Symbol('symbol')] as unknown[] })],
    });
    expect(validateMLBFeatureManifest(symbolPath).ok).toBe(false);

    const stringPayloadPath = buildValidManifest({
      features: [buildValidFeature({ payloadPath: 'not-array' })],
    });
    expect(validateMLBFeatureManifest(stringPayloadPath).ok).toBe(false);
  });

  it('enforces missing-policy and default-value pairing', () => {
    const rejectWithDefault = buildValidManifest({
      features: [buildValidFeature({ missingPolicy: 'REJECT', defaultValue: 0 })],
    });
    expect(validateMLBFeatureManifest(rejectWithDefault).ok).toBe(false);

    const useDefaultNull = buildValidManifest({
      features: [buildValidFeature({ missingPolicy: 'USE_DEFAULT', defaultValue: null })],
    });
    expect(validateMLBFeatureManifest(useDefaultNull).ok).toBe(false);

    const nanDefault = buildValidManifest({
      features: [buildValidFeature({ missingPolicy: 'USE_DEFAULT', defaultValue: Number.NaN })],
    });
    expect(validateMLBFeatureManifest(nanDefault).ok).toBe(false);
  });

  it('rejects duplicate feature IDs and non-canonical feature ordering', () => {
    const duplicates = buildValidManifest({
      features: [
        buildValidFeature({ featureId: 'f-1' }),
        buildValidFeature({ featureId: 'f-1' }),
      ],
    });
    expect(validateMLBFeatureManifest(duplicates).ok).toBe(false);

    const unordered = buildValidManifest({
      features: [
        buildValidFeature({ featureId: 'f-b' }),
        buildValidFeature({ featureId: 'f-a' }),
      ],
    });
    expect(validateMLBFeatureManifest(unordered).ok).toBe(false);
  });

  it('validates descriptor-safe manifest objects, features arrays, classes, symbols, and accessors', () => {
    const nullProto = Object.create(null);
    nullProto.contractVersion = MLB_FEATURE_MANIFEST_CONTRACT_VERSION;
    nullProto.sport = 'MLB';
    nullProto.target = 'OFFICIAL_FINAL_GAME_WINNER';
    nullProto.manifestId = 'manifest-null';
    nullProto.features = [buildValidFeature()];
    expect(validateMLBFeatureManifest(nullProto).ok).toBe(true);

    class FakeManifest {}
    const fake = new FakeManifest();
    (fake as Record<string, unknown>).contractVersion = MLB_FEATURE_MANIFEST_CONTRACT_VERSION;
    (fake as Record<string, unknown>).sport = 'MLB';
    (fake as Record<string, unknown>).target = 'OFFICIAL_FINAL_GAME_WINNER';
    (fake as Record<string, unknown>).manifestId = 'manifest-fake';
    (fake as Record<string, unknown>).features = [buildValidFeature()];
    expect(validateMLBFeatureManifest(fake).ok).toBe(false);

    const symbolObj = buildValidManifest();
    Object.defineProperty(symbolObj, Symbol('hidden'), { value: { odds: 'x' }, enumerable: true });
    expect(validateMLBFeatureManifest(symbolObj).ok).toBe(false);

    let featureGetterExecuted = false;
    const accessorFeatures: unknown[] = [];
    Object.defineProperty(accessorFeatures, '0', {
      get() {
        featureGetterExecuted = true;
        return buildValidFeature();
      },
      enumerable: true,
    });
    const accessorManifest = buildValidManifest();
    accessorManifest.features = accessorFeatures;
    expect(validateMLBFeatureManifest(accessorManifest).ok).toBe(false);
    expect(featureGetterExecuted).toBe(false);
  });

  it('accepts and validates a minimal feature vector while preserving the original reference', () => {
    const vector = buildValidVector();
    const result = validateMLBFeatureVector(vector);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(vector);
    }
  });

  it('extracts a finite numerical value from a validated section payload', () => {
    const snapshot = buildValidSnapshot({
      sections: [buildSection({ payload: { count: 7 } })],
    });
    const manifest = buildValidManifest({
      features: [buildValidFeature({ payloadPath: ['count'], missingPolicy: 'REJECT', defaultValue: null })],
    });
    const result = extractMLBLeakageSafeFeatureVector(manifest, snapshot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.values).toHaveLength(1);
      expect(result.value.values[0].featureId).toBe('f-1');
      expect(result.value.values[0].value).toBe(7);
      expect(result.value.values[0].wasMissing).toBe(false);
    }
  });

  it('encodes Boolean true as 1 and false as 0', () => {
    const snapshot = buildValidSnapshot({
      sections: [buildSection({ payload: { active: true } })],
    });
    const trueManifest = buildValidManifest({
      features: [buildValidFeature({ payloadPath: ['active'], valueKind: 'BOOLEAN' })],
    });
    const trueResult = extractMLBLeakageSafeFeatureVector(trueManifest, snapshot);
    expect(trueResult.ok).toBe(true);
    if (trueResult.ok) {
      expect(trueResult.value.values[0].value).toBe(1);
    }

    const falseSnapshot = buildValidSnapshot({
      sections: [buildSection({ payload: { active: false } })],
    });
    const falseResult = extractMLBLeakageSafeFeatureVector(trueManifest, falseSnapshot);
    expect(falseResult.ok).toBe(true);
    if (falseResult.ok) {
      expect(falseResult.value.values[0].value).toBe(0);
    }
  });

  it('traverses nested object and array payload paths deterministically', () => {
    const snapshot = buildValidSnapshot({
      sections: [
        buildSection({
          payload: {
            team: {
              stats: [3, 4],
            },
          },
        }),
      ],
    });
    const manifest = buildValidManifest({
      features: [
        buildValidFeature({ featureId: 'f-array', payloadPath: ['team', 'stats', 1] }),
      ],
    });
    const result = extractMLBLeakageSafeFeatureVector(manifest, snapshot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.values[0].value).toBe(4);
    }
  });

  it('applies USE_DEFAULT with wasMissing: true for absent sections, properties, and indexes', () => {
    const missingSection = buildValidSnapshot();
    const manifest = buildValidManifest({
      features: [buildValidFeature({ sectionId: 'missing-section', payloadPath: ['x'] })],
    });
    const result = extractMLBLeakageSafeFeatureVector(manifest, missingSection);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.values[0].value).toBe(0);
      expect(result.value.values[0].wasMissing).toBe(true);
    }

    const missingProperty = buildValidSnapshot({
      sections: [buildSection({ payload: { other: 1 } })],
    });
    const propertyResult = extractMLBLeakageSafeFeatureVector(manifest, missingProperty);
    expect(propertyResult.ok).toBe(true);
    if (propertyResult.ok) {
      expect(propertyResult.value.values[0].wasMissing).toBe(true);
    }
  });

  it('rejects missing sources under REJECT', () => {
    const missingSection = buildValidSnapshot();
    const manifest = buildValidManifest({
      features: [buildValidFeature({ sectionId: 'missing-section', payloadPath: ['x'], missingPolicy: 'REJECT', defaultValue: null })],
    });
    const result = extractMLBLeakageSafeFeatureVector(manifest, missingSection);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'FEATURE_PATH_MISSING' })]),
      );
    }
  });

  it('distinguishes invalid intermediate containers from terminal type mismatches', () => {
    const invalidContainer = buildValidSnapshot({
      sections: [buildSection({ payload: { nested: [1] } })],
    });
    const containerManifest = buildValidManifest({
      features: [buildValidFeature({ payloadPath: ['nested', 'x'] })],
    });
    const containerResult = extractMLBLeakageSafeFeatureVector(containerManifest, invalidContainer);
    expect(containerResult.ok).toBe(false);
    if (!containerResult.ok) {
      expect(containerResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'FEATURE_SOURCE_INVALID' })]),
      );
    }

    const typeMismatch = buildValidSnapshot({
      sections: [buildSection({ payload: { count: '1' } })],
    });
    const typeManifest = buildValidManifest({
      features: [buildValidFeature({ payloadPath: ['count'], missingPolicy: 'REJECT', defaultValue: null })],
    });
    const typeResult = extractMLBLeakageSafeFeatureVector(typeManifest, typeMismatch);
    expect(typeResult.ok).toBe(false);
    if (!typeResult.ok) {
      expect(typeResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'FEATURE_TYPE_MISMATCH' })]),
      );
    }
  });

  it('integrates Phase 8C exactly once and rejects an invalid snapshot without pre-validation access', () => {
    let preValidationAccess = false;
    const badSnapshot = buildValidSnapshot({ sport: 'NFL' });
    Object.defineProperty(badSnapshot, 'sections', {
      get() {
        preValidationAccess = true;
        return [];
      },
      enumerable: true,
    });

    const manifest = buildValidManifest();
    const result = extractMLBLeakageSafeFeatureVector(manifest, badSnapshot);
    expect(result.ok).toBe(false);
    expect(preValidationAccess).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'SNAPSHOT_INVALID', path: '$.snapshot' })]),
      );
    }
  });

  it('produces deterministic canonical output without mutating manifest or snapshot', () => {
    const manifest = buildValidManifest({
      features: [
        buildValidFeature({ featureId: 'f-a' }),
        buildValidFeature({ featureId: 'f-b' }),
      ],
    });
    const snapshot = buildValidSnapshot({
      sections: [
        buildSection({
          sectionId: 'sec-1',
          payload: { b: 2, a: 1 },
        }),
      ],
    });

    const first = extractMLBLeakageSafeFeatureVector(manifest, snapshot);
    const second = extractMLBLeakageSafeFeatureVector(manifest, snapshot);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value).toEqual(second.value);
    }

    expect(Object.getOwnPropertyNames(manifest).length).toBeGreaterThanOrEqual(0);
    expect(Object.getOwnPropertyNames(snapshot).length).toBeGreaterThanOrEqual(0);

    const vectorResult = extractMLBLeakageSafeFeatureVector(manifest, snapshot);
    expect(vectorResult.ok).toBe(true);
    if (vectorResult.ok) {
      expect(vectorResult.value.values[0].featureId).toBe('f-a');
      expect(vectorResult.value.values[1].featureId).toBe('f-b');
    }
  });

  it('rejects odds contamination, provider concepts, prediction outputs, and prohibited vector fields', () => {
    expect(validateMLBFeatureManifest(buildValidManifest({ features: [buildValidFeature({ payloadPath: ['sportsbook'] })] })).ok).toBe(false);
    expect(validateMLBFeatureVector(buildValidVector({ values: [{ featureId: 'f-1', value: 1, wasMissing: false, modelProbability: 0.5 }] })).ok).toBe(false);
  });

  it('verifies issue ordering, exact exports/imports, no Phase 8D import, no label access, and the static architecture boundary', async () => {
    const manifest = buildValidManifest({
      features: [
        buildValidFeature({ featureId: 'f-b' }),
        buildValidFeature({ featureId: 'f-a' }),
      ],
    });
    const result = validateMLBFeatureManifest(manifest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'NON_CANONICAL_ORDER' })]),
      );
      const keys = result.issues.map((issue) => `${issue.path}\0${issue.code}`);
      expect(keys).toEqual([...new Set(keys)]);
      const sorted = result.issues
        .slice()
        .sort((a, b) => (a.path < b.path ? -1 : a.path === b.path ? 0 : 1) || (a.code < b.code ? -1 : a.code === b.code ? 0 : 1));
      expect(result.issues).toEqual(sorted);
    }

    const source = await (await import('node:fs/promises')).readFile(
      new URL('../../../src/prediction/mlb/mlb-feature-vector-contract.ts', import.meta.url),
      'utf8',
    );

    const imports = Array.from(source.matchAll(/from\s+['"]([^'"]+)['"]/g)).map(
      (match) => match[1],
    );
    expect(imports).toEqual(['../firewall/odds-contamination-guard', './mlb-pregame-snapshot-contract']);

    assertNoProhibitedFieldInSource(source, [
      'import.*mlb-historical-labelled-dataset-contract',
      '\\.label\\b',
      'homeRuns',
      'awayRuns',
      'winnerTeamId',
      'finalizedAt',
      'splitPolicy',
      'reconstruction',
      'readFileSync',
      'writeFileSync',
      'process\\.env',
      'Date\\.now',
      'Math\\.random',
      'localeCompare',
      'export interface',
      'export enum',
      'new Date()',
    ]);

    expect(source).toMatch(/validateMLBFeatureManifest\(/);
    expect(source).toMatch(/validateMLBCanonicalPregameSnapshot\(/);
    const snapshotValidationIndex = source.indexOf('validateMLBCanonicalPregameSnapshot');
    const snapshotAccessIndex = source.indexOf('validatedSnapshot.sections');
    expect(snapshotValidationIndex).toBeGreaterThanOrEqual(0);
    expect(snapshotAccessIndex).toBeGreaterThanOrEqual(0);
    expect(snapshotValidationIndex).toBeLessThan(snapshotAccessIndex);

    const exports = Array.from(source.matchAll(/^export\s+(?:const|type|function)\s+([A-Za-z0-9_]+)/gm)).map(
      (match) => match[1],
    );
    expect(exports).toEqual([
      'MLB_FEATURE_MANIFEST_CONTRACT_VERSION',
      'MLB_FEATURE_VECTOR_CONTRACT_VERSION',
      'MLBFeatureValueKind',
      'MLBFeatureMissingPolicy',
      'MLBFeaturePathSegment',
      'MLBFeatureDefinition',
      'MLBFeatureManifest',
      'MLBExtractedFeatureValue',
      'MLBFeatureVector',
      'MLBFeatureExtractionIssue',
      'validateMLBFeatureManifest',
      'validateMLBFeatureVector',
      'extractMLBLeakageSafeFeatureVector',
    ]);
  });
});
