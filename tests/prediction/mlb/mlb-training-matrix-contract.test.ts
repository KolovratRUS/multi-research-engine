import { describe, expect, it } from 'vitest';
import {
  MLB_TRAINING_MATRIX_CONTRACT_VERSION,
  MLB_TRAINING_TARGET_ENCODING,
  validateMLBTrainingMatrix,
  buildMLBLeakageSafeTrainingMatrix,
} from '@/prediction/mlb/mlb-training-matrix-contract';
import {
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
  validateMLBCanonicalPregameSnapshot,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';
import {
  validateMLBFeatureManifest,
  validateMLBFeatureVector,
  extractMLBLeakageSafeFeatureVector,
} from '@/prediction/mlb/mlb-feature-vector-contract';
import {
  validateMLBHistoricalLabelledDataset,
} from '@/prediction/mlb/mlb-historical-labelled-dataset-contract';

const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';

function buildGame(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    gameId: 'game-1',
    scheduledStartAt: FROZEN_SCHEDULED_START,
    officialDate: '2026-07-10',
    season: 2026,
    gameType: 'REGULAR_SEASON',
    status: 'SCHEDULED',
    homeTeamId: 'home-1',
    awayTeamId: 'away-1',
    venueId: 'venue-1',
    neutralSite: false,
    doubleheader: null,
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contractVersion: MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    snapshotId: 'snapshot-1',
    capturedAt: FROZEN_CAPTURED_AT,
    dataCutoffAt: FROZEN_DATA_CUTOFF,
    game: buildGame(),
    startingPitchers: {
      home: {
        state: 'PROBABLE',
        pitcherId: 'p-1',
        announcedAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
      },
      away: {
        state: 'PROBABLE',
        pitcherId: 'p-2',
        announcedAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-away'],
      },
    },
    sourceReferences: [
      {
        sourceRefId: 'src-away',
        sourceName: 'MLB Stats API',
        sourceCategory: 'OFFICIAL',
        roles: ['STARTING_PITCHER'],
        providerRecordId: null,
        fetchedAt: FROZEN_CAPTURED_AT,
        sourceUpdatedAt: FROZEN_DATA_CUTOFF,
      },
      {
        sourceRefId: 'src-official',
        sourceName: 'MLB Stats API',
        sourceCategory: 'OFFICIAL',
        roles: ['GAME_IDENTITY'],
        providerRecordId: null,
        fetchedAt: FROZEN_CAPTURED_AT,
        sourceUpdatedAt: FROZEN_DATA_CUTOFF,
      },
    ],
    sections: [
      {
        sectionId: 'sec-1',
        kind: 'GAME_CONTEXT',
        entity: { scope: 'GAME', entityId: null },
        status: 'AVAILABLE',
        asOfAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
        payload: {},
      },
    ],
    dataCompleteness: 'COMPLETE',
    warnings: [],
    ...overrides,
  } as Record<string, unknown>;
}

function buildExtractableSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return buildValidSnapshot({
    sections: [
      {
        sectionId: 'sec-1',
        kind: 'GAME_CONTEXT',
        entity: { scope: 'GAME', entityId: null },
        status: 'AVAILABLE',
        asOfAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
        payload: { count: 7 },
      },
    ],
    ...overrides,
  } as Record<string, unknown>);
}

function buildValidLabelSource(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sourceName: 'Official MLB',
    sourceRecordId: 'rec-1',
    fetchedAt: '2026-07-15T12:05:00Z',
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidFinalLabel(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: 'OFFICIAL_FINAL',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    homeRuns: 5,
    awayRuns: 3,
    winnerTeamId: 'home-1',
    finalizedAt: '2026-07-15T12:05:00Z',
    source: buildValidLabelSource(),
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidReconstruction(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    mode: 'POINT_IN_TIME_AS_OF_CUTOFF',
    cutoffAt: FROZEN_DATA_CUTOFF,
    reconstructedAt: '2026-07-15T12:04:00Z',
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidExample(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    exampleId: 'example-1',
    split: 'TRAIN',
    snapshot: buildValidSnapshot(),
    reconstruction: buildValidReconstruction(),
    label: buildValidFinalLabel(),
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidDataset(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const trainSnapshot = buildValidSnapshot({
    snapshotId: 'snapshot-train',
    game: buildGame({ gameId: 'game-train', officialDate: '2026-07-10' }),
  });
  const validationSnapshot = buildValidSnapshot({
    snapshotId: 'snapshot-val',
    game: buildGame({ gameId: 'game-val', officialDate: '2026-07-18' }),
  });
  const testSnapshot = buildValidSnapshot({
    snapshotId: 'snapshot-test',
    game: buildGame({ gameId: 'game-test', officialDate: '2026-07-25' }),
  });
  return {
    contractVersion: 'mlb-historical-labelled-dataset-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    datasetId: 'dataset-1',
    createdAt: '2026-07-15T12:06:00Z',
    splitPolicy: {
      strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1',
      embargoDays: 0,
      train: { startDate: '2026-07-01', endDate: '2026-07-14' },
      validation: { startDate: '2026-07-16', endDate: '2026-07-20' },
      test: { startDate: '2026-07-22', endDate: '2026-07-31' },
    },
    examples: [
      buildValidExample({ exampleId: 'train-1', split: 'TRAIN', snapshot: trainSnapshot }),
      buildValidExample({ exampleId: 'val-1', split: 'VALIDATION', snapshot: validationSnapshot }),
      buildValidExample({ exampleId: 'test-1', split: 'TEST', snapshot: testSnapshot }),
    ],
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contractVersion: 'mlb-feature-manifest-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    manifestId: 'manifest-1',
    features: [
      {
        featureId: 'f-1',
        sectionId: 'sec-1',
        payloadPath: ['count'],
        valueKind: 'NUMBER',
        missingPolicy: 'USE_DEFAULT',
        defaultValue: 0,
      },
    ],
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidVector(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contractVersion: 'mlb-feature-vector-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    manifestId: 'manifest-1',
    snapshotId: 'snapshot-1',
    gameId: 'game-1',
    officialDate: '2026-07-10',
    dataCutoffAt: FROZEN_DATA_CUTOFF,
    values: [{ featureId: 'f-1', value: 1, wasMissing: false }],
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidMatrix(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const validVector = buildValidVector();
  const validRow: Record<string, unknown> = {
    exampleId: 'example-1',
    split: 'TRAIN',
    vector: validVector,
    targetValue: 1,
  };
  return {
    contractVersion: MLB_TRAINING_MATRIX_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: MLB_TRAINING_TARGET_ENCODING,
    matrixId: 'dataset-1::manifest-1',
    manifestId: 'manifest-1',
    datasetId: 'dataset-1',
    sourceDatasetCreatedAt: '2026-07-15T12:06:00Z',
    splitPolicy: {
      strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1',
      embargoDays: 0,
      train: { startDate: '2026-07-01', endDate: '2026-07-14' },
      validation: { startDate: '2026-07-16', endDate: '2026-07-20' },
      test: { startDate: '2026-07-22', endDate: '2026-07-31' },
    },
    splitCounts: { train: 1, validation: 0, test: 0 },
    rows: [validRow],
    ...overrides,
  } as Record<string, unknown>;
}

describe('mlb-training-matrix-contract', () => {
  it('accepts a minimal valid training matrix and returns the exact original reference', () => {
    const matrix = buildValidMatrix();
    const result = validateMLBTrainingMatrix(matrix);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(matrix);
    }
  });

  it('validates exact matrix root fields, versions, literals, and identifiers', () => {
    expect(validateMLBTrainingMatrix(buildValidMatrix({ contractVersion: 'wrong' })).ok).toBe(false);
    expect(validateMLBTrainingMatrix(buildValidMatrix({ sport: 'NFL' })).ok).toBe(false);
    expect(validateMLBTrainingMatrix(buildValidMatrix({ target: 'REGULATION_ONLY' })).ok).toBe(false);
    expect(validateMLBTrainingMatrix(buildValidMatrix({ targetEncoding: 'HOME_WIN_1' })).ok).toBe(false);
    expect(validateMLBTrainingMatrix(buildValidMatrix({ matrixId: '' })).ok).toBe(false);
    expect(validateMLBTrainingMatrix(buildValidMatrix({ manifestId: '' })).ok).toBe(false);
    expect(validateMLBTrainingMatrix(buildValidMatrix({ datasetId: '' })).ok).toBe(false);
    expect(validateMLBTrainingMatrix(buildValidMatrix({ sourceDatasetCreatedAt: 'invalid' })).ok).toBe(false);
    const unknownRoot = buildValidMatrix({ mysteryField: true } as Record<string, unknown>);
    const unknownResult = validateMLBTrainingMatrix(unknownRoot);
    expect(unknownResult.ok).toBe(false);
    if (!unknownResult.ok) {
      expect(unknownResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'UNKNOWN_FIELD', path: '$.mysteryField' })]),
      );
    }

    const nullProto = Object.create(null);
    nullProto.contractVersion = MLB_TRAINING_MATRIX_CONTRACT_VERSION;
    nullProto.sport = 'MLB';
    nullProto.target = 'OFFICIAL_FINAL_GAME_WINNER';
    nullProto.targetEncoding = MLB_TRAINING_TARGET_ENCODING;
    nullProto.matrixId = 'dataset-1::manifest-1';
    nullProto.manifestId = 'manifest-1';
    nullProto.datasetId = 'dataset-1';
    nullProto.sourceDatasetCreatedAt = '2026-07-15T12:06:00Z';
    nullProto.splitPolicy = {
      strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1',
      embargoDays: 0,
      train: { startDate: '2026-07-01', endDate: '2026-07-14' },
      validation: { startDate: '2026-07-16', endDate: '2026-07-20' },
      test: { startDate: '2026-07-22', endDate: '2026-07-31' },
    };
    nullProto.splitCounts = { train: 1, validation: 0, test: 0 };
    nullProto.rows = [{
      exampleId: 'example-1',
      split: 'TRAIN',
      vector: buildValidVector(),
      targetValue: 1,
    }];
    expect(validateMLBTrainingMatrix(nullProto).ok).toBe(true);
  });

  it('validates target encoding and rejects non-0|1 target values', () => {
    const validVector = buildValidVector();
    const validRow: Record<string, unknown> = {
      exampleId: 'example-1',
      split: 'TRAIN',
      vector: validVector,
      targetValue: 1,
    };
    expect(validateMLBTrainingMatrix(buildValidMatrix({ rows: [{ ...validRow, targetValue: 2 }] })).ok).toBe(false);
    expect(validateMLBTrainingMatrix(buildValidMatrix({ rows: [{ ...validRow, targetValue: -1 }] })).ok).toBe(false);
    expect(validateMLBTrainingMatrix(buildValidMatrix({ rows: [{ ...validRow, targetValue: '1' }] })).ok).toBe(false);
    expect(validateMLBTrainingMatrix(buildValidMatrix({ rows: [{ ...validRow, targetValue: true }] })).ok).toBe(false);
    expect(validateMLBTrainingMatrix(buildValidMatrix({ rows: [{ ...validRow, targetValue: null }] })).ok).toBe(false);
    expect(validateMLBTrainingMatrix(buildValidMatrix({ rows: [{ ...validRow, targetValue: Number.NaN }] })).ok).toBe(false);

    const results = [
      validateMLBTrainingMatrix(buildValidMatrix({ rows: [{ ...validRow, targetValue: 2 }] })),
      validateMLBTrainingMatrix(buildValidMatrix({ rows: [{ ...validRow, targetValue: -1 }] })),
      validateMLBTrainingMatrix(buildValidMatrix({ rows: [{ ...validRow, targetValue: '1' }] })),
      validateMLBTrainingMatrix(buildValidMatrix({ rows: [{ ...validRow, targetValue: true }] })),
      validateMLBTrainingMatrix(buildValidMatrix({ rows: [{ ...validRow, targetValue: null }] })),
      validateMLBTrainingMatrix(buildValidMatrix({ rows: [{ ...validRow, targetValue: Number.NaN }] })),
    ];
    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'TARGET_ENCODING_MISMATCH' })]),
        );
      }
    }
  });

  it('validates exact split-policy fields, windows, Gregorian dates, and embargo rules', () => {
    const base = buildValidMatrix();
    expect(validateMLBTrainingMatrix(buildValidMatrix({ splitPolicy: { strategy: 'WRONG' } } as Record<string, unknown>)).ok).toBe(false);
    expect(validateMLBTrainingMatrix(buildValidMatrix({ splitPolicy: { embargoDays: -1 } } as Record<string, unknown>)).ok).toBe(false);
    expect(validateMLBTrainingMatrix(buildValidMatrix({ splitPolicy: { train: { startDate: 'bad', endDate: '2026-07-14' } } } as Record<string, unknown>)).ok).toBe(false);
    expect(validateMLBTrainingMatrix(buildValidMatrix({ splitPolicy: { train: { startDate: '2026-07-14', endDate: '2026-07-01' } } } as Record<string, unknown>)).ok).toBe(false);
    expect(validateMLBTrainingMatrix(buildValidMatrix({ splitPolicy: { train: { startDate: '2026-07-01', endDate: '2026-07-18' }, validation: { startDate: '2026-07-16', endDate: '2026-07-20' }, test: { startDate: '2026-07-22', endDate: '2026-07-31' } } } as Record<string, unknown>)).ok).toBe(false);
    expect(validateMLBTrainingMatrix(buildValidMatrix({ splitPolicy: { embargoDays: 2, train: { startDate: '2026-07-01', endDate: '2026-07-14' }, validation: { startDate: '2026-07-16', endDate: '2026-07-20' }, test: { startDate: '2026-07-22', endDate: '2026-07-31' } } } as Record<string, unknown>)).ok).toBe(false);
  });

  it('validates split counts and exact row-count agreement', () => {
    const validRow: Record<string, unknown> = {
      exampleId: 'example-1',
      split: 'TRAIN',
      vector: buildValidVector(),
      targetValue: 1,
    };
    const validationVector = buildValidVector({ snapshotId: 'snapshot-2', gameId: 'game-2', officialDate: '2026-07-18' });
    const twoRows = [
      validRow,
      { ...validRow, exampleId: 'example-2', split: 'VALIDATION', vector: validationVector },
    ];
    expect(validateMLBTrainingMatrix(buildValidMatrix({ rows: twoRows, splitCounts: { train: 1, validation: 0, test: 0 } })).ok).toBe(false);
    expect(validateMLBTrainingMatrix(buildValidMatrix({ rows: twoRows, splitCounts: { train: 2, validation: 1, test: 0 } })).ok).toBe(false);
    expect(validateMLBTrainingMatrix(buildValidMatrix({ rows: twoRows, splitCounts: { train: 1, validation: 1, test: 0 } })).ok).toBe(true);
  });

  it('validates exact row fields and nested Phase 8E vectors', () => {
    const validVector = buildValidVector();
    const validRow: Record<string, unknown> = {
      exampleId: 'example-1',
      split: 'TRAIN',
      vector: validVector,
      targetValue: 1,
    };
    expect(validateMLBTrainingMatrix(buildValidMatrix({ rows: [{ ...validRow, exampleId: '' }] })).ok).toBe(false);
    expect(validateMLBTrainingMatrix(buildValidMatrix({ rows: [{ ...validRow, split: 'INVALID' }] })).ok).toBe(false);
    expect(validateMLBTrainingMatrix(buildValidMatrix({ rows: [{ ...validRow, vector: {} }] })).ok).toBe(false);
    expect(validateMLBTrainingMatrix(buildValidMatrix({ rows: [{ ...validRow, targetValue: null }] })).ok).toBe(false);

    const badVector = buildValidVector({ contractVersion: 'wrong' });
    const badVectorResult = validateMLBTrainingMatrix(buildValidMatrix({ rows: [{ ...validRow, vector: badVector }] }));
    expect(badVectorResult.ok).toBe(false);
    if (!badVectorResult.ok) {
      expect(badVectorResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'VECTOR_INVALID' })]),
      );
    }
  });

  it('rejects vector manifest mismatches and invalid vectors', () => {
    const validVector = buildValidVector();
    const validRow: Record<string, unknown> = {
      exampleId: 'example-1',
      split: 'TRAIN',
      vector: validVector,
      targetValue: 1,
    };
    const mismatchVector = buildValidVector({ manifestId: 'manifest-other' });
    const mismatchResult = validateMLBTrainingMatrix(buildValidMatrix({ rows: [{ ...validRow, vector: mismatchVector }] }));
    expect(mismatchResult.ok).toBe(false);
    if (!mismatchResult.ok) {
      expect(mismatchResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'VECTOR_IDENTITY_MISMATCH' })]),
      );
    }
  });

  it('rejects duplicate example, snapshot, and game identifiers', () => {
    const vector1 = buildValidVector({ snapshotId: 'snapshot-dup', gameId: 'game-dup' });
    const vector2 = buildValidVector({ snapshotId: 'snapshot-dup', gameId: 'game-dup' });
    const validRow: Record<string, unknown> = {
      exampleId: 'example-1',
      split: 'TRAIN',
      vector: vector1,
      targetValue: 1,
    };
    const dupExample = buildValidMatrix({ rows: [validRow, { ...validRow, exampleId: 'example-1' }], splitCounts: { train: 2, validation: 0, test: 0 } });
    const dupExampleResult = validateMLBTrainingMatrix(dupExample);
    expect(dupExampleResult.ok).toBe(false);
    if (!dupExampleResult.ok) {
      expect(dupExampleResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'DUPLICATE_ID', path: '$.rows[1].exampleId' })]),
      );
    }

    const dupSnapshot = buildValidMatrix({ rows: [validRow, { ...validRow, exampleId: 'example-2', vector: vector2 }], splitCounts: { train: 2, validation: 0, test: 0 } });
    const dupSnapshotResult = validateMLBTrainingMatrix(dupSnapshot);
    expect(dupSnapshotResult.ok).toBe(false);
    if (!dupSnapshotResult.ok) {
      expect(dupSnapshotResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'DUPLICATE_ID', path: '$.rows[1].vector.snapshotId' })]),
      );
    }

    const vector3 = buildValidVector({ snapshotId: 'snapshot-3', gameId: 'game-dup' });
    const dupGame = buildValidMatrix({ rows: [validRow, { ...validRow, exampleId: 'example-2', vector: vector3 }], splitCounts: { train: 2, validation: 0, test: 0 } });
    const dupGameResult = validateMLBTrainingMatrix(dupGame);
    expect(dupGameResult.ok).toBe(false);
    if (!dupGameResult.ok) {
      expect(dupGameResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'DUPLICATE_ID', path: '$.rows[1].vector.gameId' })]),
      );
    }
  });

  it('enforces canonical row ordering', () => {
    const vectorTrain = buildValidVector({ officialDate: '2026-07-10' });
    const vectorTest = buildValidVector({ officialDate: '2026-07-20' });
    const validRow = (split: string, vector: Record<string, unknown>): Record<string, unknown> => ({
      exampleId: 'example-1',
      split,
      vector,
      targetValue: 1,
    });
    const unordered = buildValidMatrix({
      rows: [
        validRow('TEST', vectorTest),
        validRow('TRAIN', vectorTrain),
      ],
      splitCounts: { train: 1, validation: 0, test: 1 },
    });
    const unorderedResult = validateMLBTrainingMatrix(unordered);
    expect(unorderedResult.ok).toBe(false);
    if (!unorderedResult.ok) {
      expect(unorderedResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'NON_CANONICAL_ORDER', path: '$.rows' })]),
      );
    }
  });

  it('enforces one exact feature schema across all rows', () => {
    const vectorA = buildValidVector({ values: [{ featureId: 'f-a', value: 1, wasMissing: false }] });
    const vectorB = buildValidVector({ values: [{ featureId: 'f-b', value: 2, wasMissing: false }] });
    const validRow = (vector: Record<string, unknown>): Record<string, unknown> => ({
      exampleId: 'example-1',
      split: 'TRAIN',
      vector,
      targetValue: 1,
    });
    const mismatched = buildValidMatrix({
      rows: [
        validRow(vectorA),
        { ...validRow(vectorB), exampleId: 'example-2' },
      ],
      splitCounts: { train: 2, validation: 0, test: 0 },
    });
    const mismatchedResult = validateMLBTrainingMatrix(mismatched);
    expect(mismatchedResult.ok).toBe(false);
    if (!mismatchedResult.ok) {
      expect(mismatchedResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'FEATURE_SCHEMA_MISMATCH' })]),
      );
    }
  });

  it('validates descriptor-safe matrix roots, nested objects, rows arrays, symbols, classes, and accessors', () => {
    class FakeMatrix {}
    const fake = new FakeMatrix() as Record<string, unknown>;
    fake.contractVersion = MLB_TRAINING_MATRIX_CONTRACT_VERSION;
    fake.sport = 'MLB';
    fake.target = 'OFFICIAL_FINAL_GAME_WINNER';
    fake.targetEncoding = MLB_TRAINING_TARGET_ENCODING;
    fake.matrixId = 'dataset-1::manifest-1';
    fake.manifestId = 'manifest-1';
    fake.datasetId = 'dataset-1';
    fake.sourceDatasetCreatedAt = '2026-07-15T12:06:00Z';
    fake.splitPolicy = {
      strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1',
      embargoDays: 0,
      train: { startDate: '2026-07-01', endDate: '2026-07-14' },
      validation: { startDate: '2026-07-16', endDate: '2026-07-20' },
      test: { startDate: '2026-07-22', endDate: '2026-07-31' },
    };
    fake.splitCounts = { train: 1, validation: 0, test: 0 };
    fake.rows = [{
      exampleId: 'example-1',
      split: 'TRAIN',
      vector: buildValidVector(),
      targetValue: 1,
    }];
    expect(validateMLBTrainingMatrix(fake).ok).toBe(false);

    const symbolMatrix = buildValidMatrix();
    const symbol = Symbol('hidden');
    Object.defineProperty(
      symbolMatrix,
      symbol,
      {
        value: {
          unexpected: true,
        },
        enumerable: true,
        configurable: true,
      },
    );
    const symbolResult = validateMLBTrainingMatrix(symbolMatrix);
    expect(symbolResult.ok).toBe(false);
    if (!symbolResult.ok) {
      expect(symbolResult.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'UNKNOWN_FIELD',
            path: '$[Symbol(hidden)]',
          }),
        ]),
      );
    }

    const accessorRowMatrix = buildValidMatrix();
    const row = (accessorRowMatrix.rows as unknown[])[0] as Record<string, unknown>;
    let getterExecuted = false;
    Object.defineProperty(row, 'exampleId', {
      get() {
        getterExecuted = true;
        return 'hacked';
      },
      enumerable: true,
    });
    expect(validateMLBTrainingMatrix(accessorRowMatrix).ok).toBe(false);
    expect(getterExecuted).toBe(false);

    const sparseRows: unknown[] = [];
    sparseRows[0] = { exampleId: 'a', split: 'TRAIN', vector: buildValidVector(), targetValue: 1 };
    sparseRows[2] = { exampleId: 'c', split: 'TEST', vector: buildValidVector({ snapshotId: 'snapshot-c' }), targetValue: 0 };
    expect(validateMLBTrainingMatrix(buildValidMatrix({ rows: sparseRows, splitCounts: { train: 1, validation: 0, test: 1 } })).ok).toBe(false);

    const accessorRows: unknown[] = [];
    accessorRows[0] = { exampleId: 'a', split: 'TRAIN', vector: buildValidVector(), targetValue: 1 };
    Object.defineProperty(accessorRows, '1', {
      get() {
        return { exampleId: 'b', split: 'TRAIN', vector: buildValidVector({ snapshotId: 'snapshot-b' }), targetValue: 0 };
      },
      enumerable: true,
    });
    expect(validateMLBTrainingMatrix(buildValidMatrix({ rows: accessorRows, splitCounts: { train: 2, validation: 0, test: 0 } })).ok).toBe(false);
  });

  it('builds a matrix from a valid Phase 8E manifest and Phase 8D dataset', () => {
    const manifest = buildValidManifest();
    const dataset = buildValidDataset({
      examples: [
        buildValidExample({
          exampleId: 'train-1',
          split: 'TRAIN',
          snapshot: buildExtractableSnapshot({
            snapshotId: 'snapshot-train',
            game: buildGame({ gameId: 'game-train', officialDate: '2026-07-10' }),
          }),
        }),
        buildValidExample({
          exampleId: 'val-1',
          split: 'VALIDATION',
          snapshot: buildExtractableSnapshot({
            snapshotId: 'snapshot-val',
            game: buildGame({ gameId: 'game-val', officialDate: '2026-07-18' }),
          }),
        }),
        buildValidExample({
          exampleId: 'test-1',
          split: 'TEST',
          snapshot: buildExtractableSnapshot({
            snapshotId: 'snapshot-test',
            game: buildGame({ gameId: 'game-test', officialDate: '2026-07-25' }),
          }),
        }),
      ],
    });
    const result = buildMLBLeakageSafeTrainingMatrix(manifest, dataset);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rows).toHaveLength(3);
      expect(result.value.rows[0].vector.values[0].value).toBe(7);
      expect(result.value.rows[0].split).toBe('TRAIN');
      expect(result.value.rows[1].split).toBe('VALIDATION');
      expect(result.value.rows[2].split).toBe('TEST');
    }
  });

  it('encodes an official home win as 1', () => {
    const dataset = buildValidDataset({
      examples: [
        buildValidExample({
          exampleId: 'home-win',
          split: 'TRAIN',
          snapshot: buildValidSnapshot({
            snapshotId: 'snapshot-hw',
            game: buildGame({ gameId: 'game-hw', officialDate: '2026-07-10' }),
          }),
          label: buildValidFinalLabel({ winnerTeamId: 'home-1', homeRuns: 5, awayRuns: 3 }),
        }),
      ],
    });
    const result = buildMLBLeakageSafeTrainingMatrix(buildValidManifest(), dataset);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rows).toHaveLength(1);
      expect(result.value.rows[0].targetValue).toBe(1);
    }
  });

  it('encodes an official away win as 0', () => {
    const dataset = buildValidDataset({
      examples: [
        buildValidExample({
          exampleId: 'away-win',
          split: 'TRAIN',
          snapshot: buildValidSnapshot({
            snapshotId: 'snapshot-aw',
            game: buildGame({ gameId: 'game-aw', officialDate: '2026-07-10' }),
          }),
          label: buildValidFinalLabel({ winnerTeamId: 'away-1', homeRuns: 2, awayRuns: 4 }),
        }),
      ],
    });
    const result = buildMLBLeakageSafeTrainingMatrix(buildValidManifest(), dataset);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rows).toHaveLength(1);
      expect(result.value.rows[0].targetValue).toBe(0);
    }
  });

  it('preserves TRAIN, VALIDATION, and TEST assignments, windows, embargo metadata, and split counts', () => {
    const dataset = buildValidDataset({
      splitPolicy: {
        strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1',
        embargoDays: 2,
        train: { startDate: '2026-07-01', endDate: '2026-07-14' },
        validation: { startDate: '2026-07-17', endDate: '2026-07-20' },
        test: { startDate: '2026-07-23', endDate: '2026-07-31' },
      },
      examples: [
        buildValidExample({
          exampleId: 'train-1',
          split: 'TRAIN',
          snapshot: buildExtractableSnapshot({
            snapshotId: 'snapshot-train',
            game: buildGame({ gameId: 'game-train', officialDate: '2026-07-10' }),
          }),
        }),
        buildValidExample({
          exampleId: 'val-1',
          split: 'VALIDATION',
          snapshot: buildExtractableSnapshot({
            snapshotId: 'snapshot-val',
            game: buildGame({ gameId: 'game-val', officialDate: '2026-07-18' }),
          }),
        }),
        buildValidExample({
          exampleId: 'test-1',
          split: 'TEST',
          snapshot: buildExtractableSnapshot({
            snapshotId: 'snapshot-test',
            game: buildGame({ gameId: 'game-test', officialDate: '2026-07-25' }),
          }),
        }),
      ],
    });
    const result = buildMLBLeakageSafeTrainingMatrix(buildValidManifest(), dataset);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.splitCounts.train).toBe(1);
      expect(result.value.splitCounts.validation).toBe(1);
      expect(result.value.splitCounts.test).toBe(1);
      expect(result.value.splitPolicy.embargoDays).toBe(2);
      expect(result.value.splitPolicy.train.startDate).toBe('2026-07-01');
      expect(result.value.splitPolicy.train.endDate).toBe('2026-07-14');
      expect(result.value.splitPolicy.validation.startDate).toBe('2026-07-17');
      expect(result.value.splitPolicy.validation.endDate).toBe('2026-07-20');
      expect(result.value.splitPolicy.test.startDate).toBe('2026-07-23');
      expect(result.value.splitPolicy.test.endDate).toBe('2026-07-31');
      expect(result.value.rows[0].split).toBe('TRAIN');
      expect(result.value.rows[1].split).toBe('VALIDATION');
      expect(result.value.rows[2].split).toBe('TEST');
    }
  });

  it('proves feature extraction receives only the snapshot and occurs before label access', () => {
    let validationDescriptorAccesses = 0;
    let builderLabelAccesses = 0;

    const example = buildValidExample({
      exampleId: 'extraction-fail',
      split: 'TRAIN',
      snapshot: buildExtractableSnapshot({
        snapshotId: 'snapshot-fail',
        game: buildGame({ gameId: 'game-fail', officialDate: '2026-07-10' }),
      }),
      label: buildValidFinalLabel({
        winnerTeamId: 'home-1',
        homeRuns: 5,
        awayRuns: 3,
        finalizedAt: '2026-07-15T12:05:00Z',
        source: buildValidLabelSource({ fetchedAt: '2026-07-15T12:05:00Z' }),
      }),
    });

    const proxiedExample = new Proxy(example, {
      getOwnPropertyDescriptor(target, prop) {
        if (prop === 'label') {
          validationDescriptorAccesses++;
        }
        return Object.getOwnPropertyDescriptor(target, prop);
      },
      get(target, prop) {
        if (prop === 'label') {
          builderLabelAccesses++;
        }
        return (target as unknown as Record<string | symbol, unknown>)[prop];
      },
    });

    const dataset = buildValidDataset({
      examples: [proxiedExample],
    });

    const invalidManifest = buildValidManifest({
      manifestId: 'manifest-fail',
      features: [
        {
          featureId: 'missing',
          sectionId: 'missing',
          payloadPath: ['x'],
          valueKind: 'NUMBER',
          missingPolicy: 'REJECT',
          defaultValue: null,
        },
      ],
    });

    const result = buildMLBLeakageSafeTrainingMatrix(invalidManifest, dataset);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'FEATURE_EXTRACTION_FAILED' })]),
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: '$.historicalDataset.examples[0].snapshot' })]),
      );
    }

    expect(validationDescriptorAccesses).toBeGreaterThanOrEqual(1);
    expect(builderLabelAccesses).toBe(0);
  });

  it('maps invalid manifests, invalid datasets, and extraction failures deterministically', () => {
    const dataset = buildValidDataset({
      examples: [
        buildValidExample({
          exampleId: 'extract-fail',
          split: 'TRAIN',
          snapshot: buildExtractableSnapshot({
            snapshotId: 'snapshot-fail',
            game: buildGame({ gameId: 'game-fail', officialDate: '2026-07-10' }),
          }),
        }),
      ],
    });

    const invalidManifest = buildValidManifest({ contractVersion: 'wrong' });
    const manifestResult = buildMLBLeakageSafeTrainingMatrix(invalidManifest, dataset);
    expect(manifestResult.ok).toBe(false);
    if (!manifestResult.ok) {
      expect(manifestResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'MANIFEST_INVALID', path: '$.manifest' })]),
      );
    }

    const invalidDataset = buildValidDataset({ sport: 'NFL' });
    const datasetResult = buildMLBLeakageSafeTrainingMatrix(buildValidManifest(), invalidDataset);
    expect(datasetResult.ok).toBe(false);
    if (!datasetResult.ok) {
      expect(datasetResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'DATASET_INVALID', path: '$.historicalDataset' })]),
      );
    }

    const manifest = buildValidManifest({
      features: [
        {
          featureId: 'missing',
          sectionId: 'missing',
          payloadPath: ['x'],
          valueKind: 'NUMBER',
          missingPolicy: 'REJECT',
          defaultValue: null,
        },
      ],
    });
    const extractionResult = buildMLBLeakageSafeTrainingMatrix(manifest, dataset);
    expect(extractionResult.ok).toBe(false);
    if (!extractionResult.ok) {
      expect(extractionResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'FEATURE_EXTRACTION_FAILED' })]),
      );
      expect(extractionResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: '$.historicalDataset.examples[0].snapshot' })]),
      );
    }
  });

  it('produces deterministic output without mutating the manifest or historical dataset', () => {
    const manifest = buildValidManifest();
    const dataset = buildValidDataset({
      examples: [
        buildValidExample({
          exampleId: 'train-1',
          split: 'TRAIN',
          snapshot: buildExtractableSnapshot({
            snapshotId: 'snapshot-train',
            game: buildGame({ gameId: 'game-train', officialDate: '2026-07-10' }),
          }),
        }),
      ],
    });

    const first = buildMLBLeakageSafeTrainingMatrix(manifest, dataset);
    const second = buildMLBLeakageSafeTrainingMatrix(manifest, dataset);
    expect(first.ok).toBe(second.ok);
    if (first.ok && second.ok) {
      expect(first.value).toEqual(second.value);
    }

    expect(validateMLBFeatureManifest(manifest).ok).toBe(true);
    expect(validateMLBHistoricalLabelledDataset(dataset).ok).toBe(true);
  });

  it('rejects odds contamination, raw label fields, scores, winner identity, prediction outputs, and prohibited matrix fields', () => {
    const validVector = buildValidVector();
    const validRow: Record<string, unknown> = {
      exampleId: 'example-1',
      split: 'TRAIN',
      vector: validVector,
      targetValue: 1,
    };

    const contaminated = buildValidMatrix({ sportsbook: { moneyline: -110 } });
    const contaminatedResult = validateMLBTrainingMatrix(contaminated);
    expect(contaminatedResult.ok).toBe(false);
    if (!contaminatedResult.ok) {
      expect(contaminatedResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'ODDS_CONTAMINATION' })]),
      );
    }

    const prohibitedRow = buildValidMatrix({
      rows: [{
        ...validRow,
        label: { winnerTeamId: 'home-1' },
        homeRuns: 5,
        awayRuns: 3,
        winnerTeamId: 'home-1',
        finalizedAt: '2026-07-15T12:05:00Z',
        source: { name: 'x' },
        prediction: 'HOME',
        probability: 0.9,
        recommendation: 'BET',
        stake: 100,
        grading: 'PASS',
      }],
    });
    const prohibitedResult = validateMLBTrainingMatrix(prohibitedRow);
    expect(prohibitedResult.ok).toBe(false);
    if (!prohibitedResult.ok) {
      expect(prohibitedResult.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'PROHIBITED_CONCEPT', path: '$.rows[0].label' }),
          expect.objectContaining({ code: 'PROHIBITED_CONCEPT', path: '$.rows[0].homeRuns' }),
          expect.objectContaining({ code: 'PROHIBITED_CONCEPT', path: '$.rows[0].awayRuns' }),
          expect.objectContaining({ code: 'PROHIBITED_CONCEPT', path: '$.rows[0].winnerTeamId' }),
          expect.objectContaining({ code: 'PROHIBITED_CONCEPT', path: '$.rows[0].finalizedAt' }),
          expect.objectContaining({ code: 'PROHIBITED_CONCEPT', path: '$.rows[0].source' }),
          expect.objectContaining({ code: 'PROHIBITED_CONCEPT', path: '$.rows[0].prediction' }),
          expect.objectContaining({ code: 'PROHIBITED_CONCEPT', path: '$.rows[0].probability' }),
          expect.objectContaining({ code: 'PROHIBITED_CONCEPT', path: '$.rows[0].recommendation' }),
          expect.objectContaining({ code: 'PROHIBITED_CONCEPT', path: '$.rows[0].stake' }),
          expect.objectContaining({ code: 'PROHIBITED_CONCEPT', path: '$.rows[0].grading' }),
        ]),
      );
    }
  });

  it('verifies issue ordering, exact exports/imports, no training or inference, and the static architecture boundary', async () => {
    const manifest = buildValidManifest({
      features: [
        { featureId: 'f-b', sectionId: 'sec-1', payloadPath: ['count'], valueKind: 'NUMBER', missingPolicy: 'USE_DEFAULT', defaultValue: 0 },
        { featureId: 'f-a', sectionId: 'sec-1', payloadPath: ['count'], valueKind: 'NUMBER', missingPolicy: 'USE_DEFAULT', defaultValue: 0 },
      ],
    });
    const unorderedVector = buildValidVector({
      values: [
        { featureId: 'f-b', value: 1, wasMissing: false },
        { featureId: 'f-a', value: 2, wasMissing: false },
      ],
    });
    const unorderedResult = validateMLBTrainingMatrix(buildValidMatrix({ rows: [{ exampleId: 'b', split: 'TRAIN', vector: unorderedVector, targetValue: 1 }] }));
    expect(unorderedResult.ok).toBe(false);
    if (!unorderedResult.ok) {
      expect(unorderedResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'VECTOR_INVALID' })]),
      );
      const keys = unorderedResult.issues.map((issue) => `${issue.path}\0${issue.code}`);
      expect(keys).toEqual([...new Set(keys)]);
      const sorted = unorderedResult.issues
        .slice()
        .sort((a, b) => (a.path < b.path ? -1 : a.path === b.path ? 0 : 1) || (a.code < b.code ? -1 : a.code === b.code ? 0 : 1));
      expect(unorderedResult.issues).toEqual(sorted);
    }

    const source = await (await import('node:fs/promises')).readFile(
      new URL('../../../src/prediction/mlb/mlb-training-matrix-contract.ts', import.meta.url),
      'utf8',
    );

    const exports = Array.from(source.matchAll(/^export\s+(?:const|type|function)\s+([A-Za-z0-9_]+)/gm)).map(
      (match) => match[1],
    );
    expect(exports).toEqual([
      'MLB_TRAINING_MATRIX_CONTRACT_VERSION',
      'MLB_TRAINING_TARGET_ENCODING',
      'MLBTrainingTargetValue',
      'MLBTrainingMatrixSplitCounts',
      'MLBTrainingMatrixRow',
      'MLBTrainingMatrix',
      'MLBTrainingMatrixIssue',
      'validateMLBTrainingMatrix',
      'buildMLBLeakageSafeTrainingMatrix',
    ]);

    const imports = Array.from(source.matchAll(/from\s+['"]([^'"]+)['"]/g)).map(
      (match) => match[1],
    );
    expect(imports).toEqual([
      '../firewall/odds-contamination-guard',
      './mlb-historical-labelled-dataset-contract',
      './mlb-feature-vector-contract',
    ]);

    expect(source).toMatch(/validateMLBFeatureManifest\(/);
    expect(source).toMatch(/validateMLBHistoricalLabelledDataset\(/);
    expect(source).toMatch(/extractMLBLeakageSafeFeatureVector\(/);
    expect(source).toMatch(/validateMLBTrainingMatrix\(/);

    const builderStart = source.indexOf('export function buildMLBLeakageSafeTrainingMatrix');
    expect(builderStart).toBeGreaterThanOrEqual(0);
    const builderSource = source.slice(builderStart);
    const laterExports = Array.from(builderSource.matchAll(/^export\s+(?:const|type|function)\s+([A-Za-z0-9_]+)/gm));
    expect(laterExports).toHaveLength(1);
    expect(laterExports[0][1]).toBe('buildMLBLeakageSafeTrainingMatrix');

    function extractFirstCallExpression(sourceText: string, fnName: string): string | null {
      const callStart = sourceText.indexOf(`${fnName}(`);
      if (callStart === -1) return null;
      let depth = 1;
      let i = callStart + fnName.length + 1;
      const chars = [...sourceText];
      while (i < chars.length && depth > 0) {
        if (chars[i] === '(') depth++;
        else if (chars[i] === ')') depth--;
        i++;
      }
      if (depth !== 0) return null;
      return sourceText.slice(callStart, i);
    }

    const extractorCall = extractFirstCallExpression(builderSource, 'extractMLBLeakageSafeFeatureVector');
    expect(extractorCall).not.toBeNull();

    function parseTopLevelArguments(callExpression: string): string[] {
      const argsStart = callExpression.indexOf('(') + 1;
      const argsEnd = callExpression.lastIndexOf(')');
      const argsSource = callExpression.slice(argsStart, argsEnd);
      const args: string[] = [];
      let depth = 0;
      let current = '';
      for (const char of argsSource) {
        if (char === '(' || char === '[' || char === '{') depth++;
        else if (char === ')' || char === ']' || char === '}') depth--;
        if (char === ',' && depth === 0) {
          args.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      const trimmed = current.trim();
      if (trimmed) args.push(trimmed);
      return args;
    }

    const args = parseTopLevelArguments(extractorCall as string);
    expect(args).toHaveLength(2);
    expect(args[0]).toBe('validatedManifest');
    expect(args[1]).toBe('example.snapshot');
    const normalizedArgs = args.map((arg) => arg.replace(/\s+/g, ' ').trim());
    for (const arg of normalizedArgs) {
      expect(arg).not.toMatch(/example\.label/);
      expect(arg).not.toBe('example');
      expect(arg).not.toMatch(/historicalDataset/);
      expect(arg).not.toBe('validatedDataset');
    }

    const extractorCallIndex = builderSource.indexOf('extractMLBLeakageSafeFeatureVector');
    expect(extractorCallIndex).toBeGreaterThanOrEqual(0);
    const failureGateIndex = builderSource.indexOf('if (!extractionResult.ok)');
    expect(failureGateIndex).toBeGreaterThan(extractorCallIndex);
    const labelAccessIndex = builderSource.indexOf('example.label');
    expect(labelAccessIndex).toBeGreaterThan(failureGateIndex);
    expect(labelAccessIndex).toBeGreaterThan(extractorCallIndex);
    expect(builderSource.slice(0, failureGateIndex)).not.toMatch(/example\.label/);

    const validateMatrixIndex = builderSource.indexOf('validateMLBTrainingMatrix');
    expect(validateMatrixIndex).toBeGreaterThan(builderSource.indexOf('rows.push'));

    expect(builderSource).toMatch(/example\.snapshot/);

    expect(source).not.toMatch(/readFileSync/);
    expect(source).not.toMatch(/writeFileSync/);
    expect(source).not.toMatch(/process\.env/);
    expect(source).not.toMatch(/Date\.now/);
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/localeCompare/);
    expect(source).not.toMatch(/export\s+enum/);
    expect(source).not.toMatch(/export\s+interface/);
    expect(source).not.toMatch(/trainModel|fitModel|calibrat|predictProbability|predictedWinner|persist|Prisma|database|provider adapter|live ingestion/);
  });
});
