import { describe, expect, it } from 'vitest';
import {
  extractMLBOuterTrainRowsForInnerDevelopment,
  validateMLBTrainOnlyInnerValidationFolds,
  buildMLBTrainOnlyInnerValidationFolds,
  validateMLBTrainOnlyInnerRowCollection,
  MLB_TRAIN_ONLY_INNER_ROW_COLLECTION_CONTRACT_VERSION,
  MLB_TRAIN_ONLY_INNER_VALIDATION_FOLDS_CONTRACT_VERSION,
  MLBTrainOnlyInnerRowCollection,
  MLBTrainOnlyInnerValidationFolds,
  MLBFoldMaterialization,
  MLBOuterTrainRow,
} from '@/prediction/mlb/mlb-train-only-inner-development-evaluator';
import {
  MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN,
  validateMLBTrainOnlyInnerFoldPlan,
} from '@/prediction/mlb/mlb-train-only-inner-fold-plan';
import {
  validateMLBTrainingMatrix,
  MLB_TRAINING_MATRIX_CONTRACT_VERSION,
  type MLBTrainingMatrix,
} from '@/prediction/mlb/mlb-training-matrix-contract';
import { MLB_FEATURE_VECTOR_CONTRACT_VERSION } from '@/prediction/mlb/mlb-feature-vector-contract';

const FROZEN_DATA_CUTOFF = '2026-04-10T00:00:00Z';

function buildValidVector(
  exampleId: string,
  officialDate: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    contractVersion: MLB_FEATURE_VECTOR_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    manifestId: 'manifest-1',
    snapshotId: `snapshot-${exampleId}`,
    gameId: exampleId,
    officialDate,
    dataCutoffAt: FROZEN_DATA_CUTOFF,
    values: [{ featureId: 'f-1', value: 1, wasMissing: false }],
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidRow(
  exampleId: string,
  split: 'TRAIN' | 'VALIDATION' | 'TEST',
  officialDate: string,
  targetValue: 0 | 1,
): Record<string, unknown> {
  return {
    exampleId,
    split,
    vector: buildValidVector(exampleId, officialDate, {}),
    targetValue,
  };
}

function buildSyntheticMatrix(
  trainRows: Array<{ exampleId: string; officialDate: string; targetValue: 0 | 1 }>,
  validationRows: Array<{ exampleId: string; officialDate: string; targetValue: 0 | 1 }>,
  testRows: Array<{ exampleId: string; officialDate: string; targetValue: 0 | 1 }>,
  overrides: Record<string, unknown> = {},
): MLBTrainingMatrix {
  const rows = [
    ...trainRows.map((r): Record<string, unknown> => buildValidRow(r.exampleId, 'TRAIN', r.officialDate, r.targetValue)),
    ...validationRows.map((r): Record<string, unknown> => buildValidRow(r.exampleId, 'VALIDATION', r.officialDate, r.targetValue)),
    ...testRows.map((r): Record<string, unknown> => buildValidRow(r.exampleId, 'TEST', r.officialDate, r.targetValue)),
  ];

  return {
    contractVersion: MLB_TRAINING_MATRIX_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    matrixId: 'dataset-1::manifest-1',
    manifestId: 'manifest-1',
    datasetId: 'dataset-1',
    sourceDatasetCreatedAt: '2026-04-25T12:06:00Z',
    splitPolicy: {
      strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1',
      embargoDays: 0,
      train: { startDate: '2026-04-01', endDate: '2026-04-23' },
      validation: { startDate: '2026-04-24', endDate: '2026-04-28' },
      test: { startDate: '2026-04-29', endDate: '2026-05-03' },
    },
    splitCounts: {
      train: trainRows.length,
      validation: validationRows.length,
      test: testRows.length,
    },
    rows,
    ...overrides,
  } as unknown as MLBTrainingMatrix;
}

function buildFrozenTrainRows(): Array<{ exampleId: string; officialDate: string; targetValue: 0 | 1 }> {
  const rows: Array<{ exampleId: string; officialDate: string; targetValue: 0 | 1 }> = [];
  const dates = [
    '2026-04-01',
    '2026-04-02',
    '2026-04-03',
    '2026-04-04',
    '2026-04-05',
    '2026-04-06',
    '2026-04-07',
    '2026-04-08',
    '2026-04-09',
    '2026-04-10',
    '2026-04-11',
    '2026-04-12',
    '2026-04-13',
    '2026-04-14',
    '2026-04-15',
    '2026-04-16',
    '2026-04-17',
    '2026-04-18',
    '2026-04-19',
    '2026-04-20',
    '2026-04-21',
    '2026-04-22',
    '2026-04-23',
  ];

  const dateTargets: Record<string, { home: number; away: number }> = {
    '2026-04-01': { home: 7, away: 5 },
    '2026-04-02': { home: 6, away: 6 },
    '2026-04-03': { home: 8, away: 4 },
    '2026-04-04': { home: 5, away: 7 },
    '2026-04-05': { home: 9, away: 3 },
    '2026-04-06': { home: 4, away: 8 },
    '2026-04-07': { home: 10, away: 9 },
    '2026-04-08': { home: 7, away: 6 },
    '2026-04-09': { home: 6, away: 5 },
    '2026-04-10': { home: 8, away: 5 },
    '2026-04-11': { home: 8, away: 6 },
    '2026-04-12': { home: 7, away: 6 },
    '2026-04-13': { home: 9, away: 4 },
    '2026-04-14': { home: 9, away: 5 },
    '2026-04-15': { home: 9, away: 6 },
    '2026-04-16': { home: 5, away: 8 },
    '2026-04-17': { home: 6, away: 9 },
    '2026-04-18': { home: 7, away: 7 },
    '2026-04-19': { home: 7, away: 6 },
    '2026-04-20': { home: 5, away: 6 },
    '2026-04-21': { home: 6, away: 5 },
    '2026-04-22': { home: 6, away: 7 },
    '2026-04-23': { home: 6, away: 8 },
  };

  let id = 0;
  for (const date of dates) {
    const targets = dateTargets[date];
    for (let h = 0; h < targets.home; h++) {
      rows.push({ exampleId: `train-${String(id).padStart(3, '0')}`, officialDate: date, targetValue: 1 });
      id++;
    }
    for (let a = 0; a < targets.away; a++) {
      rows.push({ exampleId: `train-${String(id).padStart(3, '0')}`, officialDate: date, targetValue: 0 });
      id++;
    }
  }

  return rows;
}

const FROZEN_TRAIN_ROWS = buildFrozenTrainRows();

function buildFrozenMatrix(overrides: Record<string, unknown> = {}): MLBTrainingMatrix {
  return buildSyntheticMatrix(FROZEN_TRAIN_ROWS, [], [], overrides);
}

function clonePlan(plan: unknown): unknown {
  return JSON.parse(JSON.stringify(plan));
}

interface MutableFold {
  innerValidationStartDate: string;
  [key: string]: unknown;
}

describe('mlb-train-only-inner-development-evaluator', () => {
  describe('extraction happy path', () => {
    it('accepts valid synthetic frozen-shaped matrix and extracts exactly 301 TRAIN rows', () => {
      const matrix = buildFrozenMatrix();
      const matrixValidation = validateMLBTrainingMatrix(matrix);
      expect(matrixValidation.ok).toBe(true);

      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(true);
      if (extraction.ok) {
        expect(extraction.value.rowCount).toBe(301);
        expect(extraction.value.rows).toHaveLength(301);
        expect(extraction.value.rows.every((r) => r.split === 'TRAIN')).toBe(true);
        expect(extraction.value.matrixId).toBe('dataset-1::manifest-1');
        expect(extraction.value.manifestId).toBe('manifest-1');
        expect(extraction.value.datasetId).toBe('dataset-1');
      }
    });

    it('preserves canonical source ordering', () => {
      const matrix = buildFrozenMatrix();
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(true);
      if (extraction.ok) {
        const ids = extraction.value.rows.map((r) => r.exampleId);
        const sortedIds = [...ids].sort();
        expect(ids).toEqual(sortedIds);
      }
    });

    it('does not retain full matrix fields in the TRAIN-only collection', () => {
      const matrix = buildFrozenMatrix();
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(true);
      if (extraction.ok) {
        const keys = Object.keys(extraction.value);
        expect(keys).not.toContain('matrix');
        expect(keys).not.toContain('allRows');
        expect(keys).not.toContain('validationRows');
        expect(keys).not.toContain('testRows');
        expect(keys).toContain('rows');
        expect(extraction.value.rows).toHaveLength(301);
      }
    });

    it('rejects VALIDATION rows in the extracted collection', () => {
      const matrix = buildFrozenMatrix();
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(true);
      if (extraction.ok) {
        for (const row of extraction.value.rows) {
          expect(row.split).toBe('TRAIN');
        }
      }
    });

    it('proves split filtering is non-vacuous: extra non-TRAIN rows do not alter extraction count', () => {
      const extraValidation: Array<{ exampleId: string; officialDate: string; targetValue: 0 | 1 }> = [{ exampleId: 'val-001', officialDate: '2026-04-24', targetValue: 1 }];
      const extraTest: Array<{ exampleId: string; officialDate: string; targetValue: 0 | 1 }> = [{ exampleId: 'test-001', officialDate: '2026-04-29', targetValue: 0 }];
      const matrix = buildSyntheticMatrix(FROZEN_TRAIN_ROWS, extraValidation, extraTest);
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(true);
      if (extraction.ok) {
        expect(extraction.value.rows).toHaveLength(FROZEN_TRAIN_ROWS.length);
        const ids = extraction.value.rows.map((r) => r.exampleId);
        for (const row of extraction.value.rows) {
          expect(row.split).toBe('TRAIN');
        }
        expect(ids).not.toContain('val-001');
        expect(ids).not.toContain('test-001');
      }
    });
  });

  describe('extraction failure cases', () => {
    it('rejects invalid matrix contract', () => {
      const invalidMatrix = { ...buildFrozenMatrix(), contractVersion: 'wrong' } as unknown as MLBTrainingMatrix;
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(invalidMatrix);
      expect(extraction.ok).toBe(false);
      if (!extraction.ok) {
        expect(extraction.issues.some((i) => i.code === 'INVALID_LITERAL')).toBe(true);
        expect(extraction.issues.some((i) => i.path === '$.contractVersion')).toBe(true);
      }
    });

    it('rejects malformed rows without throwing', () => {
      const validSyntheticMatrix = buildSyntheticMatrix(FROZEN_TRAIN_ROWS, [], []);
      const malformed = { ...validSyntheticMatrix, rows: 'not-an-array' } as unknown as MLBTrainingMatrix;
      expect(() => {
        extractMLBOuterTrainRowsForInnerDevelopment(malformed);
      }).not.toThrow();
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(malformed);
      expect(extraction.ok).toBe(false);
    });

    it('rejects 300 extracted TRAIN rows', () => {
      const trainRows = FROZEN_TRAIN_ROWS.slice(1);
      const matrix = buildSyntheticMatrix(trainRows, [], []);
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(false);
      if (!extraction.ok) {
        expect(extraction.issues.some((i) => i.code === 'SPLIT_COUNT_MISMATCH')).toBe(true);
      }
    });

    it('rejects 302 extracted TRAIN rows', () => {
      const extraRow = { exampleId: 'train-301', officialDate: '2026-04-23', targetValue: 0 } as { exampleId: string; officialDate: string; targetValue: 0 | 1 };
      const trainRows = [...FROZEN_TRAIN_ROWS, extraRow];
      const matrix = buildSyntheticMatrix(trainRows, [], []);
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(false);
      if (!extraction.ok) {
        expect(extraction.issues.some((i) => i.code === 'SPLIT_COUNT_MISMATCH')).toBe(true);
      }
    });

    it('rejects duplicate TRAIN row identity', () => {
      const trainRows = FROZEN_TRAIN_ROWS.map((r, idx) =>
        idx === 1 ? { ...r, exampleId: FROZEN_TRAIN_ROWS[0].exampleId } : r,
      );
      const matrix = buildSyntheticMatrix(trainRows, [], []);
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(false);
      if (!extraction.ok) {
        expect(extraction.issues.some((i) => i.code === 'DUPLICATE_ID')).toBe(true);
      }
    });

    it('rejects malformed officialDate', () => {
      const trainRows = FROZEN_TRAIN_ROWS.map((r, idx) =>
        idx === 0 ? { ...r, officialDate: '2026-4-01' } : r,
      );
      const matrix = buildSyntheticMatrix(trainRows, [], []);
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(false);
      if (!extraction.ok) {
        expect(extraction.issues.some((i) => i.code === 'VECTOR_INVALID')).toBe(true);
      }
    });

    it('rejects TRAIN row outside frozen Apr 1-Apr 23 window', () => {
      const trainRows = FROZEN_TRAIN_ROWS.map((r, idx) =>
        idx === 0 ? { ...r, officialDate: '2026-04-24' } : r,
      );
      const matrix = buildSyntheticMatrix(trainRows, [], []);
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(false);
      if (!extraction.ok) {
        expect(extraction.issues.some((i) => i.code === 'SPLIT_POLICY_VIOLATION')).toBe(true);
      }
    });

    it('rejects invalid targetValue', () => {
      const trainRows = FROZEN_TRAIN_ROWS.map((r, idx) =>
        idx === 0 ? { ...r, targetValue: 2 } as { exampleId: string; officialDate: string; targetValue: number } : r,
      );
      const matrix = buildSyntheticMatrix(
        trainRows as Array<{ exampleId: string; officialDate: string; targetValue: 0 | 1 }>,
        [],
        [],
      );
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(false);
      if (!extraction.ok) {
        expect(extraction.issues.some((i) => i.code === 'TARGET_ENCODING_MISMATCH')).toBe(true);
      }
    });
  });

  describe('exact fold materialization', () => {
    it('materializes exactly four frozen folds with exact counts', () => {
      const matrix = buildFrozenMatrix();
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(true);
      if (!extraction.ok) return;

      const folds = buildMLBTrainOnlyInnerValidationFolds(extraction.value, MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      expect(folds.folds).toHaveLength(4);

      const expected = [
        { id: 'FOLD_1', train: 91, validation: 51, trainHome: 49, trainAway: 42, validationHome: 29, validationAway: 22 },
        { id: 'FOLD_2', train: 142, validation: 55, trainHome: 78, trainAway: 64, validationHome: 34, validationAway: 21 },
        { id: 'FOLD_3', train: 197, validation: 55, trainHome: 112, trainAway: 85, validationHome: 25, validationAway: 30 },
        { id: 'FOLD_4', train: 252, validation: 49, trainHome: 137, trainAway: 115, validationHome: 23, validationAway: 26 },
      ];

      for (let i = 0; i < expected.length; i++) {
        const fold = folds.folds[i] as MLBFoldMaterialization;
        expect(fold.foldId).toBe(expected[i].id);
        expect(fold.trainRowCount).toBe(expected[i].train);
        expect(fold.validationRowCount).toBe(expected[i].validation);
        expect(fold.trainHomeWinCount).toBe(expected[i].trainHome);
        expect(fold.trainAwayWinCount).toBe(expected[i].trainAway);
        expect(fold.validationHomeWinCount).toBe(expected[i].validationHome);
        expect(fold.validationAwayWinCount).toBe(expected[i].validationAway);
      }
    });

    it('preserves exact date windows', () => {
      const matrix = buildFrozenMatrix();
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(true);
      if (!extraction.ok) return;

      const folds = buildMLBTrainOnlyInnerValidationFolds(extraction.value, MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      const dateWindows = [
        { train: ['2026-04-01', '2026-04-07'], validation: ['2026-04-08', '2026-04-11'] },
        { train: ['2026-04-01', '2026-04-11'], validation: ['2026-04-12', '2026-04-15'] },
        { train: ['2026-04-01', '2026-04-15'], validation: ['2026-04-16', '2026-04-19'] },
        { train: ['2026-04-01', '2026-04-19'], validation: ['2026-04-20', '2026-04-23'] },
      ];

      for (let i = 0; i < dateWindows.length; i++) {
        const fold = folds.folds[i] as MLBFoldMaterialization;
        expect(fold.innerTrainDateRange.startDate).toBe(dateWindows[i].train[0]);
        expect(fold.innerTrainDateRange.endDate).toBe(dateWindows[i].train[1]);
        expect(fold.innerValidationDateRange.startDate).toBe(dateWindows[i].validation[0]);
        expect(fold.innerValidationDateRange.endDate).toBe(dateWindows[i].validation[1]);
      }
    });

    it('reconciles target counts to role row counts', () => {
      const matrix = buildFrozenMatrix();
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(true);
      if (!extraction.ok) return;

      const folds = buildMLBTrainOnlyInnerValidationFolds(extraction.value, MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      for (const fold of folds.folds as MLBFoldMaterialization[]) {
        expect(fold.trainHomeWinCount + fold.trainAwayWinCount).toBe(fold.trainRowCount);
        expect(fold.validationHomeWinCount + fold.validationAwayWinCount).toBe(fold.validationRowCount);
      }
    });
  });

  describe('deterministic membership', () => {
    it('produces identical folds on repeated execution', () => {
      const matrix = buildFrozenMatrix();
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(true);
      if (!extraction.ok) return;

      const folds1 = buildMLBTrainOnlyInnerValidationFolds(extraction.value, MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      const folds2 = buildMLBTrainOnlyInnerValidationFolds(extraction.value, MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);

      for (let i = 0; i < folds1.folds.length; i++) {
        const f1 = folds1.folds[i] as MLBFoldMaterialization;
        const f2 = folds2.folds[i] as MLBFoldMaterialization;
        expect(f1.foldId).toBe(f2.foldId);
        expect(f1.innerTrainRows.map((r) => r.exampleId)).toEqual(f2.innerTrainRows.map((r) => r.exampleId));
        expect(f1.innerValidationRows.map((r) => r.exampleId)).toEqual(f2.innerValidationRows.map((r) => r.exampleId));
        expect(f1.trainRowCount).toBe(f2.trainRowCount);
        expect(f1.validationRowCount).toBe(f2.validationRowCount);
      }
    });
  });

  describe('fail-closed fold invariants', () => {
    it('rejects noncanonical four-fold plan', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN) as { folds: MutableFold[] };
      plan.folds[0].innerValidationStartDate = '2026-04-09';
      const validation = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(validation.ok).toBe(false);
    });

    it('rejects wrong row count in fold', () => {
      const matrix = buildFrozenMatrix();
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(true);
      if (!extraction.ok) return;

      const folds = buildMLBTrainOnlyInnerValidationFolds(extraction.value, MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      const invalidFolds = {
        ...folds,
        folds: folds.folds.map((f, idx) =>
          idx === 0
            ? { ...f, trainRowCount: 92 }
            : f,
        ) as readonly MLBFoldMaterialization[],
      };
      expect(validateMLBTrainOnlyInnerValidationFolds(invalidFolds).ok).toBe(false);
    });

    it('rejects class-degenerate fold', () => {
      const matrix = buildFrozenMatrix();
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(true);
      if (!extraction.ok) return;

      const folds = buildMLBTrainOnlyInnerValidationFolds(extraction.value, MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      const invalidFolds = {
        ...folds,
        folds: folds.folds.map((f, idx) =>
          idx === 0
            ? { ...f, trainHomeWinCount: 0 }
            : f,
        ) as readonly MLBFoldMaterialization[],
      };
      expect(validateMLBTrainOnlyInnerValidationFolds(invalidFolds).ok).toBe(false);
    });

    it('rejects Fold 4 failing to cover all 301 source rows', () => {
      const matrix = buildFrozenMatrix();
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(true);
      if (!extraction.ok) return;

      const trainRows = extraction.value.rows.slice(0, 300);
      const collection = {
        ...extraction.value,
        rowCount: 300,
        rows: trainRows,
      };

      expect(validateMLBTrainOnlyInnerRowCollection(collection).ok).toBe(false);
    });

    it('rejects TRAIN-only collection with malformed vector.officialDate', () => {
      const matrix = buildFrozenMatrix();
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(true);
      if (!extraction.ok) return;

      const malformedRows = extraction.value.rows.map((row, index) =>
        index === 0
          ? {
              ...row,
              vector: {
                ...row.vector,
                officialDate: 'not-a-date',
              },
            }
          : row,
      );

      const collection = {
        ...extraction.value,
        rows: malformedRows,
      };

      expect(collection.rows.length).toBe(301);
      expect(collection.rowCount).toBe(301);
      expect(collection.homeWinCount + collection.awayWinCount).toBe(301);
      for (const row of collection.rows) {
        expect(row.split).toBe('TRAIN');
      }

      const result = validateMLBTrainOnlyInnerRowCollection(collection);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.code === 'INVALID_DATE')).toBe(true);
        expect(result.issues.some((i) => i.path === '$.rows[0].vector.officialDate')).toBe(true);
      }
    });

    it('rejects TRAIN-only collection with well-formed date outside frozen window', () => {
      const matrix = buildFrozenMatrix();
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(true);
      if (!extraction.ok) return;

      const outOfRangeRows = extraction.value.rows.map((row, index) =>
        index === 0
          ? {
              ...row,
              vector: {
                ...row.vector,
                officialDate: '2026-04-24',
              },
            }
          : row,
      );

      const collection = {
        ...extraction.value,
        rows: outOfRangeRows,
      };

      expect(collection.rows.length).toBe(301);
      expect(collection.rowCount).toBe(301);
      expect(collection.homeWinCount + collection.awayWinCount).toBe(301);
      for (const row of collection.rows) {
        expect(row.split).toBe('TRAIN');
      }

      const result = validateMLBTrainOnlyInnerRowCollection(collection);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.code === 'DATE_POLICY_VIOLATION')).toBe(true);
        expect(result.issues.some((i) => i.path === '$.rows[].vector.officialDate')).toBe(true);
      }
    });
  });

  describe('expanding-window semantics', () => {
    it('proves Fold 1 train subset of Fold 2 train, and so on', () => {
      const matrix = buildFrozenMatrix();
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(true);
      if (!extraction.ok) return;

      const folds = buildMLBTrainOnlyInnerValidationFolds(extraction.value, MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      const trainIdsByFold = folds.folds.map((f) => new Set((f as MLBFoldMaterialization).innerTrainRows.map((r) => r.exampleId)));

      for (let i = 1; i < trainIdsByFold.length; i++) {
        for (const id of trainIdsByFold[i - 1]) {
          expect(trainIdsByFold[i].has(id)).toBe(true);
        }
      }
    });

    it('proves prior validation rows become eligible training in later folds', () => {
      const matrix = buildFrozenMatrix();
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(true);
      if (!extraction.ok) return;

      const folds = buildMLBTrainOnlyInnerValidationFolds(extraction.value, MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      const fold1ValidationIds = new Set((folds.folds[0] as MLBFoldMaterialization).innerValidationRows.map((r) => r.exampleId));
      const fold2TrainIds = new Set((folds.folds[1] as MLBFoldMaterialization).innerTrainRows.map((r) => r.exampleId));

      for (const id of fold1ValidationIds) {
        expect(fold2TrainIds.has(id)).toBe(true);
      }
    });
  });

  describe('TRAIN-only API boundary', () => {
    it('does not expose full matrix in the result', () => {
      const matrix = buildFrozenMatrix();
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(true);
      if (extraction.ok) {
        const resultAny = extraction.value as unknown as Record<string, unknown>;
        expect(resultAny.matrix).toBeUndefined();
        expect(resultAny.allRows).toBeUndefined();
        expect(resultAny.validationRows).toBeUndefined();
        expect(resultAny.testRows).toBeUndefined();
        expect(resultAny.fullMatrix).toBeUndefined();
        expect(resultAny.outerValidationRows).toBeUndefined();
        expect(resultAny.outerTestRows).toBeUndefined();
      }
    });

    it('rejects passing mutated collection to buildMLBTrainOnlyInnerValidationFolds', () => {
      const matrix = buildFrozenMatrix();
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(true);
      if (!extraction.ok) return;

      const badCollection = {
        ...extraction.value,
        rows: [...extraction.value.rows, { ...extraction.value.rows[0], exampleId: 'bad' }] as unknown as MLBOuterTrainRow[],
      };
      expect(() => {
        buildMLBTrainOnlyInnerValidationFolds(badCollection as MLBTrainOnlyInnerRowCollection, MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      }).toThrow();
    });
  });

  describe('static architectural audit', () => {
    it('contains no trainer execution imports', () => {
      const source = require('fs').readFileSync(
        require('path').resolve(__dirname, '../../../src/prediction/mlb/mlb-train-only-inner-development-evaluator.ts'),
        'utf8',
      );
      expect(source).not.toMatch(/fitAndEvaluateMLBDeterministicLogisticRegression/);
      expect(source).not.toMatch(/evaluateAndReleaseMLBDeterministicModel/);
      expect(source).not.toMatch(/import.*trainer/);
    });

    it('contains no metric calculation logic', () => {
      const source = require('fs').readFileSync(
        require('path').resolve(__dirname, '../../../src/prediction/mlb/mlb-train-only-inner-development-evaluator.ts'),
        'utf8',
      );
      expect(source).not.toMatch(/logLoss/);
      expect(source).not.toMatch(/Brier/);
      expect(source).not.toMatch(/rocAuc/);
      expect(source).not.toMatch(/candidateRecipe/);
      expect(source).not.toMatch(/INNER_ELIGIBLE/);
      expect(source).not.toMatch(/rankInner/);
    });

    it('contains no odds/market inputs', () => {
      const source = require('fs').readFileSync(
        require('path').resolve(__dirname, '../../../src/prediction/mlb/mlb-train-only-inner-development-evaluator.ts'),
        'utf8',
      );
      const nonImportSource = source
        .split('\n')
        .filter((line: string) => !line.trimStart().startsWith('import '))
        .filter((line: string) => !line.includes('PROHIBITED_ROW_FIELDS'))
        .join('\n');
      expect(nonImportSource).not.toMatch(/sportsbook/);
      expect(nonImportSource).not.toMatch(/moneyline/);
      expect(nonImportSource).not.toMatch(/implied/);
      expect(nonImportSource).not.toMatch(/CLV/);
    });

    it('contains no randomization', () => {
      const source = require('fs').readFileSync(
        require('path').resolve(__dirname, '../../../src/prediction/mlb/mlb-train-only-inner-development-evaluator.ts'),
        'utf8',
      );
      expect(source).not.toMatch(/Math\.random/);
      expect(source).not.toMatch(/Date\.now/);
      expect(source).not.toMatch(/crypto\.random/);
      expect(source).not.toMatch(/shuffle/);
    });
  });

  describe('canonical plan validation', () => {
    it('accepts the canonical plan', () => {
      const result = validateMLBTrainOnlyInnerFoldPlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      expect(result.ok).toBe(true);
    });
  });

  describe('validator happy path for materialized folds', () => {
    it('accepts valid materialized folds', () => {
      const matrix = buildFrozenMatrix();
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(true);
      if (!extraction.ok) return;

      const folds = buildMLBTrainOnlyInnerValidationFolds(extraction.value, MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      const validation = validateMLBTrainOnlyInnerValidationFolds(folds);
      expect(validation.ok).toBe(true);
    });
  });
});
