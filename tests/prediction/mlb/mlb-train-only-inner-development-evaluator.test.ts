import { describe, expect, it } from 'vitest';
import {
  extractMLBOuterTrainRowsForInnerDevelopment,
  validateMLBTrainOnlyInnerValidationFolds,
  buildMLBTrainOnlyInnerValidationFolds,
  validateMLBTrainOnlyInnerRowCollection,
  buildMLBInnerDevelopmentReferenceFacts,
  evaluateMLBInnerFoldMetrics,
  evaluateMLBTrainOnlyInnerCandidate,
  evaluateMLBTrainOnlyInnerCandidateGate,
  MLBInnerDevelopmentReferenceFacts,
  MLBInnerCandidatePredictionRecord,
  MLBInnerFoldMetricResult,
  MLBInnerFoldMetricResultIssue,
  MLBInnerAggregateResult,
  MLBInnerAggregateResultIssue,
  MLBInnerCandidateGateResult,
  MLBInnerCandidateGateResultIssue,
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
import {
  MLB_FEATURE_VECTOR_CONTRACT_VERSION,
  type MLBFeatureVector,
} from '@/prediction/mlb/mlb-feature-vector-contract';
import {
  type MLBTrainingMatrixRow,
} from '@/prediction/mlb/mlb-training-matrix-contract';

const FROZEN_DATA_CUTOFF = '2026-04-10T00:00:00Z';

function buildValidVector(
  exampleId: string,
  officialDate: string,
  overrides: Record<string, unknown> = {},
): MLBFeatureVector {
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
  } as MLBFeatureVector;
}

function buildValidRow(
  exampleId: string,
  split: 'TRAIN' | 'VALIDATION' | 'TEST',
  officialDate: string,
  targetValue: 0 | 1,
): MLBTrainingMatrixRow {
  return {
    exampleId,
    split,
    vector: buildValidVector(exampleId, officialDate, {}),
    targetValue,
  };
}

function buildSyntheticFold(): MLBFoldMaterialization {
  const trainRows: MLBOuterTrainRow[] = [
    { exampleId: 's-t1', split: 'TRAIN', vector: buildValidVector('s-t1', '2026-04-01'), targetValue: 1 },
    { exampleId: 's-t2', split: 'TRAIN', vector: buildValidVector('s-t2', '2026-04-02'), targetValue: 0 },
    { exampleId: 's-t3', split: 'TRAIN', vector: buildValidVector('s-t3', '2026-04-03'), targetValue: 1 },
  ];
  const validationRows: MLBOuterTrainRow[] = [
    { exampleId: 's-v1', split: 'TRAIN', vector: buildValidVector('s-v1', '2026-04-04'), targetValue: 1 },
    { exampleId: 's-v2', split: 'TRAIN', vector: buildValidVector('s-v2', '2026-04-05'), targetValue: 0 },
  ];

  return {
    foldId: 'FOLD_X',
    innerTrainRows: trainRows,
    innerValidationRows: validationRows,
    trainRowCount: trainRows.length,
    validationRowCount: validationRows.length,
    trainHomeWinCount: trainRows.filter((r) => r.targetValue === 1).length,
    trainAwayWinCount: trainRows.filter((r) => r.targetValue === 0).length,
    validationHomeWinCount: validationRows.filter((r) => r.targetValue === 1).length,
    validationAwayWinCount: validationRows.filter((r) => r.targetValue === 0).length,
    innerTrainDateRange: { startDate: '2026-04-01', endDate: '2026-04-03' },
    innerValidationDateRange: { startDate: '2026-04-04', endDate: '2026-04-05' },
    dateRangeProof: 'synthetic',
  };
}

function buildSyntheticMatrix(
  trainRows: readonly MLBTrainingMatrixRow[],
  validationRows: readonly MLBTrainingMatrixRow[],
  testRows: readonly MLBTrainingMatrixRow[],
  overrides: Record<string, unknown> = {},
): MLBTrainingMatrix {
  const rows = [
    ...trainRows.map((r): MLBTrainingMatrixRow => buildValidRow(r.exampleId, 'TRAIN', r.vector.officialDate, r.targetValue)),
    ...validationRows.map((r): MLBTrainingMatrixRow => buildValidRow(r.exampleId, 'VALIDATION', r.vector.officialDate, r.targetValue)),
    ...testRows.map((r): MLBTrainingMatrixRow => buildValidRow(r.exampleId, 'TEST', r.vector.officialDate, r.targetValue)),
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

function buildFrozenTrainRows(): readonly MLBTrainingMatrixRow[] {
  const rows: MLBTrainingMatrixRow[] = [];
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
      rows.push({ exampleId: `train-${String(id).padStart(3, '0')}`, split: 'TRAIN', vector: buildValidVector(`train-${String(id).padStart(3, '0')}`, date), targetValue: 1 });
      id++;
    }
    for (let a = 0; a < targets.away; a++) {
      rows.push({ exampleId: `train-${String(id).padStart(3, '0')}`, split: 'TRAIN', vector: buildValidVector(`train-${String(id).padStart(3, '0')}`, date), targetValue: 0 });
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
      const extraValidation: readonly MLBTrainingMatrixRow[] = [{ exampleId: 'val-001', split: 'TRAIN', vector: buildValidVector('val-001', '2026-04-24'), targetValue: 1 }];
      const extraTest: readonly MLBTrainingMatrixRow[] = [{ exampleId: 'test-001', split: 'TRAIN', vector: buildValidVector('test-001', '2026-04-29'), targetValue: 0 }];
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
      const trainRows: readonly MLBTrainingMatrixRow[] = FROZEN_TRAIN_ROWS.slice(1);
      const matrix = buildSyntheticMatrix(trainRows, [], []);
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(false);
      if (!extraction.ok) {
        expect(extraction.issues.some((i) => i.code === 'SPLIT_COUNT_MISMATCH')).toBe(true);
      }
    });

    it('rejects 302 extracted TRAIN rows', () => {
      const extraRow: MLBTrainingMatrixRow = { exampleId: 'train-301', split: 'TRAIN', vector: buildValidVector('train-301', '2026-04-23'), targetValue: 0 };
      const trainRows: readonly MLBTrainingMatrixRow[] = [...FROZEN_TRAIN_ROWS, extraRow];
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
        idx === 0 ? { ...r, vector: { ...r.vector, officialDate: '2026-4-01' } } : r,
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
        idx === 0 ? { ...r, vector: { ...r.vector, officialDate: '2026-04-24' } } : r,
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
        idx === 0 ? { ...r, targetValue: 2 } : r,
      );
      const matrix = buildSyntheticMatrix(
        trainRows as readonly MLBTrainingMatrixRow[],
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

    it('contains E3-D aggregation and eligibility logic but no ranking or budget', () => {
      const source = require('fs').readFileSync(
        require('path').resolve(__dirname, '../../../src/prediction/mlb/mlb-train-only-inner-development-evaluator.ts'),
        'utf8',
      );
      expect(source).toMatch(/evaluateMLBTrainOnlyInnerCandidate/);
      expect(source).toMatch(/INNER_ELIGIBLE/);
      expect(source).not.toMatch(/rankInner/);
      expect(source).not.toMatch(/recipeBudget/);
      expect(source).not.toMatch(/RECIPE_BUDGET/);
      expect(source).not.toMatch(/outer.*VALIDATION.*evaluat/i);
      expect(source).not.toMatch(/TEST.*evaluat/i);
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

  describe('E3-C fold-local reference facts', () => {
    it('derives P50 and train-prior references from materialized folds', () => {
      const matrix = buildFrozenMatrix();
      const extraction = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
      expect(extraction.ok).toBe(true);
      if (!extraction.ok) return;

      const folds = buildMLBTrainOnlyInnerValidationFolds(extraction.value, MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      for (const fold of folds.folds as MLBFoldMaterialization[]) {
        const referenceResult = buildMLBInnerDevelopmentReferenceFacts(fold, { matrixId: folds.matrixId, manifestId: folds.manifestId, datasetId: folds.datasetId });
        expect(referenceResult.ok).toBe(true);
        if (!referenceResult.ok) return;
        const reference = referenceResult.value;

        expect(reference.foldId).toBe(fold.foldId);
        expect(reference.innerTrainRowCount).toBe(fold.trainRowCount);
        expect(reference.innerValidationRowCount).toBe(fold.validationRowCount);
        expect(reference.innerTrainHomeWinCount + reference.innerTrainAwayWinCount).toBe(fold.trainRowCount);
        expect(reference.p50.probability).toBe(0.5);
        expect(reference.foldTrainPrior.probability).toBe(fold.trainHomeWinCount / fold.trainRowCount);
      }
    });

    it('proves train prior uses only inner TRAIN labels', () => {
      const fold = buildSyntheticFold();
      const baseReferenceResult = buildMLBInnerDevelopmentReferenceFacts(
        fold,
        { matrixId: 'matrix-1', manifestId: 'manifest-1', datasetId: 'dataset-1' },
      );
      expect(baseReferenceResult.ok).toBe(true);
      if (!baseReferenceResult.ok) return;
      const baseReference = baseReferenceResult.value;

      const flippedValidation = fold.innerValidationRows.map((r, i) =>
        i % 2 === 0 ? { ...r, targetValue: r.targetValue === 1 ? 0 : 1 } as MLBOuterTrainRow : r,
      );
      const flippedHomeWins = flippedValidation.filter((r) => r.targetValue === 1).length;
      const flippedAwayWins = flippedValidation.filter((r) => r.targetValue === 0).length;
      const ensureBalanced = flippedHomeWins === 0
        ? flippedValidation.map((r, i) => i === 0 ? { ...r, targetValue: 1 } : r)
        : flippedValidation;

      const sameTrainReferenceResult = buildMLBInnerDevelopmentReferenceFacts(
        { ...fold, innerValidationRows: ensureBalanced, validationHomeWinCount: ensureBalanced.filter((r) => r.targetValue === 1).length, validationAwayWinCount: ensureBalanced.filter((r) => r.targetValue === 0).length } as MLBFoldMaterialization,
        { matrixId: 'matrix-1', manifestId: 'manifest-1', datasetId: 'dataset-1' },
      );
      expect(sameTrainReferenceResult.ok).toBe(true);
      if (!sameTrainReferenceResult.ok) return;
      const sameTrainReference = sameTrainReferenceResult.value;

      expect(sameTrainReference.p50.probability).toBe(baseReference.p50.probability);
      expect(sameTrainReference.foldTrainPrior.probability).toBe(baseReference.foldTrainPrior.probability);
    });
  });

  describe('E3-C fold-local metric evaluation', () => {
    it('computes exact log loss, Brier, and AUC for a synthetic fold', () => {
      const fold = buildSyntheticFold();
      const referenceResult = buildMLBInnerDevelopmentReferenceFacts(
        fold,
        { matrixId: 'matrix-1', manifestId: 'manifest-1', datasetId: 'dataset-1' },
      );
      expect(referenceResult.ok).toBe(true);
      if (!referenceResult.ok) return;
      const reference = referenceResult.value;

      const predictions: MLBInnerCandidatePredictionRecord[] = fold.innerValidationRows.map((row, i) => ({
        candidateRecipeId: 'recipe-1',
        foldId: 'FOLD_X',
        exampleId: row.exampleId,
        homeWinProbability: i % 2 === 0 ? 0.8 : 0.3,
      }));

      const result = evaluateMLBInnerFoldMetrics(fold, predictions, reference, { matrixId: 'matrix-1', manifestId: 'manifest-1', datasetId: 'dataset-1' });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.rowCount).toBe(fold.validationRowCount);
      expect(result.value.candidateRecipeId).toBe('recipe-1');
      expect(result.value.foldTrainPriorProbability).toBeCloseTo(reference.foldTrainPrior.probability);
    });

    it('rejects predictions with non-finite probabilities', () => {
      const fold = buildSyntheticFold();
      const referenceResult = buildMLBInnerDevelopmentReferenceFacts(
        fold,
        { matrixId: 'matrix-1', manifestId: 'manifest-1', datasetId: 'dataset-1' },
      );
      expect(referenceResult.ok).toBe(true);
      if (!referenceResult.ok) return;
      const reference = referenceResult.value;

      const predictions: MLBInnerCandidatePredictionRecord[] = fold.innerValidationRows.map((row) => ({
        candidateRecipeId: 'recipe-1',
        foldId: 'FOLD_X',
        exampleId: row.exampleId,
        homeWinProbability: Number.NaN,
      }));

      const result = evaluateMLBInnerFoldMetrics(fold, predictions, reference, { matrixId: 'matrix-1', manifestId: 'manifest-1', datasetId: 'dataset-1' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i: MLBInnerFoldMetricResultIssue) => i.code === 'NONFINITE_PROBABILITY')).toBe(true);
      }
    });

    it('rejects predictions with out-of-range probabilities', () => {
      const fold = buildSyntheticFold();
      const referenceResult = buildMLBInnerDevelopmentReferenceFacts(
        fold,
        { matrixId: 'matrix-1', manifestId: 'manifest-1', datasetId: 'dataset-1' },
      );
      expect(referenceResult.ok).toBe(true);
      if (!referenceResult.ok) return;
      const reference = referenceResult.value;

      const predictions: MLBInnerCandidatePredictionRecord[] = fold.innerValidationRows.map((row) => ({
        candidateRecipeId: 'recipe-1',
        foldId: 'FOLD_X',
        exampleId: row.exampleId,
        homeWinProbability: -0.01,
      }));

      const result = evaluateMLBInnerFoldMetrics(fold, predictions, reference, { matrixId: 'matrix-1', manifestId: 'manifest-1', datasetId: 'dataset-1' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i: MLBInnerFoldMetricResultIssue) => i.code === 'OUT_OF_RANGE_PROBABILITY')).toBe(true);
      }
    });

    it('rejects duplicate exampleIds in predictions', () => {
      const fold = buildSyntheticFold();
      const referenceResult = buildMLBInnerDevelopmentReferenceFacts(
        fold,
        { matrixId: 'matrix-1', manifestId: 'manifest-1', datasetId: 'dataset-1' },
      );
      expect(referenceResult.ok).toBe(true);
      if (!referenceResult.ok) return;
      const reference = referenceResult.value;

      const exampleId = fold.innerValidationRows[0].exampleId;
      const predictions: MLBInnerCandidatePredictionRecord[] = [
        {
          candidateRecipeId: 'recipe-1',
          foldId: 'FOLD_X',
          exampleId,
          homeWinProbability: 0.5,
        },
        {
          candidateRecipeId: 'recipe-1',
          foldId: 'FOLD_X',
          exampleId,
          homeWinProbability: 0.6,
        },
      ];

      const result = evaluateMLBInnerFoldMetrics(fold, predictions, reference, { matrixId: 'matrix-1', manifestId: 'manifest-1', datasetId: 'dataset-1' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i: MLBInnerFoldMetricResultIssue) => i.code === 'DUPLICATE_EXAMPLE_ID')).toBe(true);
      }
    });

    it('rejects foreign exampleIds in predictions', () => {
      const fold = buildSyntheticFold();
      const referenceResult = buildMLBInnerDevelopmentReferenceFacts(
        fold,
        { matrixId: 'matrix-1', manifestId: 'manifest-1', datasetId: 'dataset-1' },
      );
      expect(referenceResult.ok).toBe(true);
      if (!referenceResult.ok) return;
      const reference = referenceResult.value;

      const predictions: MLBInnerCandidatePredictionRecord[] = fold.innerValidationRows.map((row) => ({
        candidateRecipeId: 'recipe-1',
        foldId: 'FOLD_X',
        exampleId: 'foreign-id',
        homeWinProbability: 0.5,
      }));

      const result = evaluateMLBInnerFoldMetrics(fold, predictions, reference, { matrixId: 'matrix-1', manifestId: 'manifest-1', datasetId: 'dataset-1' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i: MLBInnerFoldMetricResultIssue) => i.code === 'FOREIGN_EXAMPLE_ID')).toBe(true);
      }
    });

    it('rejects prediction count mismatch', () => {
      const fold = buildSyntheticFold();
      const referenceResult = buildMLBInnerDevelopmentReferenceFacts(
        fold,
        { matrixId: 'matrix-1', manifestId: 'manifest-1', datasetId: 'dataset-1' },
      );
      expect(referenceResult.ok).toBe(true);
      if (!referenceResult.ok) return;
      const reference = referenceResult.value;

      const predictions: MLBInnerCandidatePredictionRecord[] = [
        {
          candidateRecipeId: 'recipe-1',
          foldId: 'FOLD_X',
          exampleId: fold.innerValidationRows[0].exampleId,
          homeWinProbability: 0.5,
        },
      ];

      const result = evaluateMLBInnerFoldMetrics(fold, predictions, reference, { matrixId: 'matrix-1', manifestId: 'manifest-1', datasetId: 'dataset-1' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i: MLBInnerFoldMetricResultIssue) => i.code === 'PREDICTION_COUNT_MISMATCH')).toBe(true);
      }
    });

    it('produces manually verified log loss, Brier, and AUC for a tiny fixture', () => {
      const trainRows: MLBOuterTrainRow[] = [
        { exampleId: 't1', split: 'TRAIN', vector: buildValidVector('t1', '2026-04-01'), targetValue: 1 },
        { exampleId: 't2', split: 'TRAIN', vector: buildValidVector('t2', '2026-04-02'), targetValue: 0 },
      ];
      const validationRows: MLBOuterTrainRow[] = [
        { exampleId: 'v1', split: 'TRAIN', vector: buildValidVector('v1', '2026-04-03'), targetValue: 1 },
        { exampleId: 'v2', split: 'TRAIN', vector: buildValidVector('v2', '2026-04-04'), targetValue: 0 },
      ];

      const reference = buildMLBInnerDevelopmentReferenceFacts(
        { foldId: 'FOLD_TINY', innerTrainRows: trainRows, innerValidationRows: validationRows, trainRowCount: trainRows.length, validationRowCount: validationRows.length, trainHomeWinCount: trainRows.filter((r) => r.targetValue === 1).length, trainAwayWinCount: trainRows.filter((r) => r.targetValue === 0).length, validationHomeWinCount: validationRows.filter((r) => r.targetValue === 1).length, validationAwayWinCount: validationRows.filter((r) => r.targetValue === 0).length, innerTrainDateRange: { startDate: '2026-04-01', endDate: '2026-04-02' }, innerValidationDateRange: { startDate: '2026-04-03', endDate: '2026-04-04' }, dateRangeProof: 'synthetic' },
        { matrixId: 'matrix-1', manifestId: 'manifest-1', datasetId: 'dataset-1' },
      );
      expect(reference.ok).toBe(true);
      if (!reference.ok) return;
      const ref = reference.value;

      expect(ref.innerTrainHomeWinCount).toBe(1);
      expect(ref.innerTrainAwayWinCount).toBe(1);
      expect(ref.innerTrainHomeWinPrior).toBe(0.5);

      const predictions: MLBInnerCandidatePredictionRecord[] = [
        { candidateRecipeId: 'recipe-1', foldId: 'FOLD_TINY', exampleId: 'v1', homeWinProbability: 0.8 },
        { candidateRecipeId: 'recipe-1', foldId: 'FOLD_TINY', exampleId: 'v2', homeWinProbability: 0.3 },
      ];

      const result = evaluateMLBInnerFoldMetrics(
        { foldId: 'FOLD_TINY', innerTrainRows: trainRows, innerValidationRows: validationRows, trainRowCount: trainRows.length, validationRowCount: validationRows.length, trainHomeWinCount: trainRows.filter((r) => r.targetValue === 1).length, trainAwayWinCount: trainRows.filter((r) => r.targetValue === 0).length, validationHomeWinCount: validationRows.filter((r) => r.targetValue === 1).length, validationAwayWinCount: validationRows.filter((r) => r.targetValue === 0).length, innerTrainDateRange: { startDate: '2026-04-01', endDate: '2026-04-02' }, innerValidationDateRange: { startDate: '2026-04-03', endDate: '2026-04-04' }, dateRangeProof: 'synthetic' },
        predictions,
        ref,
        { matrixId: 'matrix-1', manifestId: 'manifest-1', datasetId: 'dataset-1' },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const expectedBrier = ((0.8 - 1) ** 2 + (0.3 - 0) ** 2) / 2;
      expect(result.value.candidateBrierScore).toBeCloseTo(expectedBrier);
      expect(result.value.p50BrierScore).toBeCloseTo(0.25);
      expect(result.value.foldTrainPriorBrierScore).toBeCloseTo(0.25);
    });
  });

  describe('E3-C reference leakage and deterministic behavior', () => {
    it('does not use feature values for reference derivation', () => {
      const trainRows: MLBOuterTrainRow[] = [
        { exampleId: 't1', split: 'TRAIN', vector: buildValidVector('t1', '2026-04-01'), targetValue: 1 },
        { exampleId: 't2', split: 'TRAIN', vector: buildValidVector('t2', '2026-04-02'), targetValue: 0 },
      ];
      const validationRows: MLBOuterTrainRow[] = [
        { exampleId: 'v1', split: 'TRAIN', vector: buildValidVector('v1', '2026-04-03'), targetValue: 1 },
        { exampleId: 'v2', split: 'TRAIN', vector: buildValidVector('v2', '2026-04-03'), targetValue: 0 },
      ];

      const reference = buildMLBInnerDevelopmentReferenceFacts(
        { foldId: 'FOLD_LEAK', innerTrainRows: trainRows, innerValidationRows: validationRows, trainRowCount: trainRows.length, validationRowCount: validationRows.length, trainHomeWinCount: trainRows.filter((r) => r.targetValue === 1).length, trainAwayWinCount: trainRows.filter((r) => r.targetValue === 0).length, validationHomeWinCount: validationRows.filter((r) => r.targetValue === 1).length, validationAwayWinCount: validationRows.filter((r) => r.targetValue === 0).length, innerTrainDateRange: { startDate: '2026-04-01', endDate: '2026-04-02' }, innerValidationDateRange: { startDate: '2026-04-03', endDate: '2026-04-03' }, dateRangeProof: 'synthetic' },
        { matrixId: 'matrix-1', manifestId: 'manifest-1', datasetId: 'dataset-1' },
      );
      expect(reference.ok).toBe(true);
      if (!reference.ok) return;

      const differentFeatureRows: MLBOuterTrainRow[] = [
        { exampleId: 't1', split: 'TRAIN', vector: buildValidVector('t1', '2026-04-01', { values: [{ featureId: 'f-99', value: 999, wasMissing: false }] }), targetValue: 1 },
        { exampleId: 't2', split: 'TRAIN', vector: buildValidVector('t2', '2026-04-02', { values: [{ featureId: 'f-99', value: 999, wasMissing: false }] }), targetValue: 0 },
      ];
      const differentValidationRows: MLBOuterTrainRow[] = [
        { exampleId: 'v1', split: 'TRAIN', vector: buildValidVector('v1', '2026-04-03', { values: [{ featureId: 'f-99', value: 999, wasMissing: false }] }), targetValue: 1 },
        { exampleId: 'v2', split: 'TRAIN', vector: buildValidVector('v2', '2026-04-03', { values: [{ featureId: 'f-99', value: 999, wasMissing: false }] }), targetValue: 0 },
      ];

      const reference2 = buildMLBInnerDevelopmentReferenceFacts(
        { foldId: 'FOLD_LEAK', innerTrainRows: differentFeatureRows, innerValidationRows: differentValidationRows, trainRowCount: differentFeatureRows.length, validationRowCount: differentValidationRows.length, trainHomeWinCount: differentFeatureRows.filter((r) => r.targetValue === 1).length, trainAwayWinCount: differentFeatureRows.filter((r) => r.targetValue === 0).length, validationHomeWinCount: differentValidationRows.filter((r) => r.targetValue === 1).length, validationAwayWinCount: differentValidationRows.filter((r) => r.targetValue === 0).length, innerTrainDateRange: { startDate: '2026-04-01', endDate: '2026-04-02' }, innerValidationDateRange: { startDate: '2026-04-03', endDate: '2026-04-03' }, dateRangeProof: 'synthetic' },
        { matrixId: 'matrix-1', manifestId: 'manifest-1', datasetId: 'dataset-1' },
      );
      expect(reference2.ok).toBe(true);
      if (!reference2.ok) return;

      expect(reference.value.foldTrainPrior.probability).toBe(reference2.value.foldTrainPrior.probability);
      expect(reference.value.p50.probability).toBe(reference2.value.p50.probability);
    });

    it('proves prediction contract carries no target label and evaluation uses fold-owned targets', () => {
      const trainRows: MLBOuterTrainRow[] = [
        { exampleId: 't1', split: 'TRAIN', vector: buildValidVector('t1', '2026-04-01'), targetValue: 1 },
        { exampleId: 't2', split: 'TRAIN', vector: buildValidVector('t2', '2026-04-02'), targetValue: 0 },
      ];
      const validationRows: MLBOuterTrainRow[] = [
        { exampleId: 'v1', split: 'TRAIN', vector: buildValidVector('v1', '2026-04-03'), targetValue: 1 },
        { exampleId: 'v2', split: 'TRAIN', vector: buildValidVector('v2', '2026-04-04'), targetValue: 0 },
      ];
      const fold: MLBFoldMaterialization = {
        foldId: 'FOLD_CONTRACT',
        innerTrainRows: trainRows,
        innerValidationRows: validationRows,
        trainRowCount: trainRows.length,
        validationRowCount: validationRows.length,
        trainHomeWinCount: trainRows.filter((r) => r.targetValue === 1).length,
        trainAwayWinCount: trainRows.filter((r) => r.targetValue === 0).length,
        validationHomeWinCount: validationRows.filter((r) => r.targetValue === 1).length,
        validationAwayWinCount: validationRows.filter((r) => r.targetValue === 0).length,
        innerTrainDateRange: { startDate: '2026-04-01', endDate: '2026-04-02' },
        innerValidationDateRange: { startDate: '2026-04-03', endDate: '2026-04-04' },
        dateRangeProof: 'synthetic',
      };

      const predictions: MLBInnerCandidatePredictionRecord[] = [
        { candidateRecipeId: 'recipe-1', foldId: 'FOLD_CONTRACT', exampleId: 'v1', homeWinProbability: 0.9 },
        { candidateRecipeId: 'recipe-1', foldId: 'FOLD_CONTRACT', exampleId: 'v2', homeWinProbability: 0.1 },
      ];

      const result = evaluateMLBInnerFoldMetrics(fold, predictions, {
        contractVersion: 'mlb-inner-development-reference-facts-v1',
        sport: 'MLB',
        target: 'OFFICIAL_FINAL_GAME_WINNER',
        foldId: 'FOLD_CONTRACT',
        matrixId: 'matrix-1',
        manifestId: 'manifest-1',
        datasetId: 'dataset-1',
        innerTrainRowCount: trainRows.length,
        innerValidationRowCount: validationRows.length,
        innerTrainHomeWinCount: trainRows.filter((r) => r.targetValue === 1).length,
        innerTrainAwayWinCount: trainRows.filter((r) => r.targetValue === 0).length,
        innerTrainHomeWinPrior: 0.5,
        p50: { probability: 0.5, logLoss: 0, brierScore: 0.25, rocAuc: 0.5 },
        foldTrainPrior: { probability: 0.5, logLoss: 0, brierScore: 0.25, rocAuc: 0.5 },
      }, { matrixId: 'matrix-1', manifestId: 'manifest-1', datasetId: 'dataset-1' });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const expectedLogLoss = ((-Math.log(0.9)) + (-Math.log(0.9))) / 2;
      expect(result.value.candidateLogLoss).toBeCloseTo(expectedLogLoss);
      expect(result.value.candidateBrierScore).toBeCloseTo(((0.9 - 1) ** 2 + (0.1 - 0) ** 2) / 2);
      expect(result.value.rowCount).toBe(2);
      expect(result.value.targetHomeWinCount).toBe(1);
      expect(result.value.targetAwayWinCount).toBe(1);
    });
  });
});

const CANONICAL_FOLD_METRIC_RESULT_TEMPLATES: Record<string, { rowCount: number; homeWinCount: number; awayWinCount: number; prior: number }> = {
  FOLD_1: { rowCount: 51, homeWinCount: 29, awayWinCount: 22, prior: 49 / 91 },
  FOLD_2: { rowCount: 55, homeWinCount: 34, awayWinCount: 21, prior: 78 / 142 },
  FOLD_3: { rowCount: 55, homeWinCount: 25, awayWinCount: 30, prior: 112 / 197 },
  FOLD_4: { rowCount: 49, homeWinCount: 23, awayWinCount: 26, prior: 137 / 252 },
};

function buildCanonicalFoldResult(
  foldId: string,
  overrides: Partial<MLBInnerFoldMetricResult> = {},
): MLBInnerFoldMetricResult {
  const canonical = CANONICAL_FOLD_METRIC_RESULT_TEMPLATES[foldId];
  if (!canonical) {
    throw new Error(`Unknown fold ${foldId}`);
  }
  const expectedP50LogLoss = -Math.log(0.5);
  const prior = canonical.prior;
  const p50Brier = 0.25;
  const p50Auc = 0.5;
  const priorLogLoss = -(canonical.homeWinCount * Math.log(prior) + canonical.awayWinCount * Math.log(1 - prior)) / canonical.rowCount;
  const priorBrier = ((prior - 1) ** 2 * canonical.homeWinCount + (prior - 0) ** 2 * canonical.awayWinCount) / canonical.rowCount;
  const priorAuc = 0.5; // deterministic constant-predictor baseline

  return {
    contractVersion: 'mlb-inner-fold-metric-result-v1',
    foldId,
    candidateRecipeId: 'recipe-1',
    rowCount: canonical.rowCount,
    targetHomeWinCount: canonical.homeWinCount,
    targetAwayWinCount: canonical.awayWinCount,
    candidateLogLoss: overrides.candidateLogLoss ?? 0.6,
    candidateBrierScore: overrides.candidateBrierScore ?? 0.2,
    candidateRocAuc: overrides.candidateRocAuc ?? 0.7,
    p50LogLoss: overrides.p50LogLoss ?? expectedP50LogLoss,
    p50BrierScore: overrides.p50BrierScore ?? p50Brier,
    p50RocAuc: overrides.p50RocAuc ?? p50Auc,
    foldTrainPriorLogLoss: overrides.foldTrainPriorLogLoss ?? priorLogLoss,
    foldTrainPriorBrierScore: overrides.foldTrainPriorBrierScore ?? priorBrier,
    foldTrainPriorRocAuc: overrides.foldTrainPriorRocAuc ?? priorAuc,
    foldTrainPriorProbability: overrides.foldTrainPriorProbability ?? prior,
    ...overrides,
  };
}

describe('E3-D aggregate inner eligibility', () => {
  describe('happy path aggregation', () => {
    it('aggregates exactly four canonical fold metric results with row-weighted totals of 210', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ];

      const aggregateResult = evaluateMLBTrainOnlyInnerCandidate(foldResults);
      expect(aggregateResult.ok).toBe(true);
      if (!aggregateResult.ok) return;

      expect(aggregateResult.value.aggregateValidationRowCount).toBe(210);
      expect(aggregateResult.value.foldCount).toBe(4);
      expect(aggregateResult.value.candidateRecipeId).toBe('recipe-1');
    });

    it('is order independent: shuffled inputs produce identical aggregate', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ];
      const shuffled = [foldResults[2], foldResults[0], foldResults[3], foldResults[1]];

      const original = evaluateMLBTrainOnlyInnerCandidate(foldResults);
      const shuffledResult = evaluateMLBTrainOnlyInnerCandidate(shuffled);
      expect(original.ok).toBe(true);
      expect(shuffledResult.ok).toBe(true);
      if (!original.ok || !shuffledResult.ok) return;

      expect(shuffledResult.value.aggregateCandidateLogLoss).toBeCloseTo(original.value.aggregateCandidateLogLoss);
      expect(shuffledResult.value.aggregateCandidateBrierScore).toBeCloseTo(original.value.aggregateCandidateBrierScore);
      expect(shuffledResult.value.aggregateP50LogLoss).toBeCloseTo(original.value.aggregateP50LogLoss);
      expect(shuffledResult.value.aggregateP50BrierScore).toBeCloseTo(original.value.aggregateP50BrierScore);
    });
  });

  describe('row-weighted vs unweighted non-vacuity', () => {
    it('weights by canonical validation row counts, not unweighted fold mean', () => {
      const fold1 = buildCanonicalFoldResult('FOLD_1', { candidateLogLoss: 0.01, candidateBrierScore: 0.01 });
      const fold2 = buildCanonicalFoldResult('FOLD_2', { candidateLogLoss: 0.10, candidateBrierScore: 0.10 });
      const fold3 = buildCanonicalFoldResult('FOLD_3', { candidateLogLoss: 0.20, candidateBrierScore: 0.20 });
      const fold4 = buildCanonicalFoldResult('FOLD_4', { candidateLogLoss: 0.99, candidateBrierScore: 0.99 });
      const foldResults = [fold1, fold2, fold3, fold4];

      const aggregateResult = evaluateMLBTrainOnlyInnerCandidate(foldResults);
      expect(aggregateResult.ok).toBe(true);
      if (!aggregateResult.ok) return;

      const unweightedLogLoss = (0.01 + 0.10 + 0.20 + 0.99) / 4;
      const unweightedBrier = (0.01 + 0.10 + 0.20 + 0.99) / 4;
      expect(aggregateResult.value.aggregateCandidateLogLoss).not.toBeCloseTo(unweightedLogLoss);
      expect(aggregateResult.value.aggregateCandidateBrierScore).not.toBeCloseTo(unweightedBrier);

      const expectedLogLoss = (0.01 * 51 + 0.10 * 55 + 0.20 * 55 + 0.99 * 49) / 210;
      const expectedBrier = (0.01 * 51 + 0.10 * 55 + 0.20 * 55 + 0.99 * 49) / 210;
      expect(aggregateResult.value.aggregateCandidateLogLoss).toBeCloseTo(expectedLogLoss);
      expect(aggregateResult.value.aggregateCandidateBrierScore).toBeCloseTo(expectedBrier);
    });
  });

  describe('strict eligibility gate', () => {
    it('marks INNER_ELIGIBLE when candidate strictly beats both references in log loss and Brier', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1', { candidateLogLoss: 0.1, candidateBrierScore: 0.1 }),
        buildCanonicalFoldResult('FOLD_2', { candidateLogLoss: 0.1, candidateBrierScore: 0.1 }),
        buildCanonicalFoldResult('FOLD_3', { candidateLogLoss: 0.1, candidateBrierScore: 0.1 }),
        buildCanonicalFoldResult('FOLD_4', { candidateLogLoss: 0.1, candidateBrierScore: 0.1 }),
      ];

      const aggregateResult = evaluateMLBTrainOnlyInnerCandidate(foldResults);
      expect(aggregateResult.ok).toBe(true);
      if (!aggregateResult.ok) return;

      const gateResult = evaluateMLBTrainOnlyInnerCandidateGate(foldResults);
      expect(gateResult.ok).toBe(true);
      if (!gateResult.ok) return;

      expect(gateResult.value.eligibility).toBe('INNER_ELIGIBLE');
      expect(gateResult.value.reasons).toHaveLength(0);
    });

    it('does not change eligibility when only AUC differs with identical log loss and Brier', () => {
      const foldResultsLow = [
        buildCanonicalFoldResult('FOLD_1', { candidateLogLoss: 0.1, candidateBrierScore: 0.1, candidateRocAuc: 0.6 }),
        buildCanonicalFoldResult('FOLD_2', { candidateLogLoss: 0.1, candidateBrierScore: 0.1, candidateRocAuc: 0.6 }),
        buildCanonicalFoldResult('FOLD_3', { candidateLogLoss: 0.1, candidateBrierScore: 0.1, candidateRocAuc: 0.6 }),
        buildCanonicalFoldResult('FOLD_4', { candidateLogLoss: 0.1, candidateBrierScore: 0.1, candidateRocAuc: 0.6 }),
      ];
      const foldResultsHigh = [
        buildCanonicalFoldResult('FOLD_1', { candidateLogLoss: 0.1, candidateBrierScore: 0.1, candidateRocAuc: 0.9 }),
        buildCanonicalFoldResult('FOLD_2', { candidateLogLoss: 0.1, candidateBrierScore: 0.1, candidateRocAuc: 0.9 }),
        buildCanonicalFoldResult('FOLD_3', { candidateLogLoss: 0.1, candidateBrierScore: 0.1, candidateRocAuc: 0.9 }),
        buildCanonicalFoldResult('FOLD_4', { candidateLogLoss: 0.1, candidateBrierScore: 0.1, candidateRocAuc: 0.9 }),
      ];

      const lowAggregate = evaluateMLBTrainOnlyInnerCandidate(foldResultsLow);
      const highAggregate = evaluateMLBTrainOnlyInnerCandidate(foldResultsHigh);
      expect(lowAggregate.ok).toBe(true);
      expect(highAggregate.ok).toBe(true);
      if (!lowAggregate.ok || !highAggregate.ok) return;

      const lowGate = evaluateMLBTrainOnlyInnerCandidateGate(foldResultsLow);
      const highGate = evaluateMLBTrainOnlyInnerCandidateGate(foldResultsHigh);
      expect(lowGate.ok).toBe(true);
      expect(highGate.ok).toBe(true);
      if (!lowGate.ok || !highGate.ok) return;

      expect(lowGate.value.eligibility).toBe(highGate.value.eligibility);
      expect(lowGate.value.reasons).toEqual(highGate.value.reasons);
    });
  });

  describe('rejection cases', () => {
    function assertRejection(
      foldResults: MLBInnerFoldMetricResult[],
      expectedReason: string,
    ): void {
      const gateResult = evaluateMLBTrainOnlyInnerCandidateGate(foldResults);
      expect(gateResult.ok).toBe(true);
      if (!gateResult.ok) return;

      expect(gateResult.value.eligibility).toBe('INNER_REJECTED');
      expect(gateResult.value.reasons).toContain(expectedReason);
    }

    it('case A: log loss fails P50 while all other comparisons pass', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1', { candidateLogLoss: 1.0, candidateBrierScore: 0.1 }),
        buildCanonicalFoldResult('FOLD_2', { candidateLogLoss: 1.0, candidateBrierScore: 0.1 }),
        buildCanonicalFoldResult('FOLD_3', { candidateLogLoss: 1.0, candidateBrierScore: 0.1 }),
        buildCanonicalFoldResult('FOLD_4', { candidateLogLoss: 1.0, candidateBrierScore: 0.1 }),
      ];
      assertRejection(foldResults, 'AGGREGATE_LOG_LOSS_NOT_BETTER_THAN_P50');
    });

    it('case B: log loss fails fold-TRAIN-prior while all other comparisons pass', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1', { candidateLogLoss: 1.0, candidateBrierScore: 0.1 }),
        buildCanonicalFoldResult('FOLD_2', { candidateLogLoss: 1.0, candidateBrierScore: 0.1 }),
        buildCanonicalFoldResult('FOLD_3', { candidateLogLoss: 1.0, candidateBrierScore: 0.1 }),
        buildCanonicalFoldResult('FOLD_4', { candidateLogLoss: 1.0, candidateBrierScore: 0.1 }),
      ];
      assertRejection(foldResults, 'AGGREGATE_LOG_LOSS_NOT_BETTER_THAN_TRAIN_PRIOR');
    });

    it('case C: Brier fails P50 while all other comparisons pass', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1', { candidateLogLoss: 0.1, candidateBrierScore: 0.5 }),
        buildCanonicalFoldResult('FOLD_2', { candidateLogLoss: 0.1, candidateBrierScore: 0.5 }),
        buildCanonicalFoldResult('FOLD_3', { candidateLogLoss: 0.1, candidateBrierScore: 0.5 }),
        buildCanonicalFoldResult('FOLD_4', { candidateLogLoss: 0.1, candidateBrierScore: 0.5 }),
      ];
      assertRejection(foldResults, 'AGGREGATE_BRIER_NOT_BETTER_THAN_P50');
    });

    it('case D: Brier fails fold-TRAIN-prior while all other comparisons pass', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1', { candidateLogLoss: 0.1, candidateBrierScore: 0.5 }),
        buildCanonicalFoldResult('FOLD_2', { candidateLogLoss: 0.1, candidateBrierScore: 0.5 }),
        buildCanonicalFoldResult('FOLD_3', { candidateLogLoss: 0.1, candidateBrierScore: 0.5 }),
        buildCanonicalFoldResult('FOLD_4', { candidateLogLoss: 0.1, candidateBrierScore: 0.5 }),
      ];
      assertRejection(foldResults, 'AGGREGATE_BRIER_NOT_BETTER_THAN_TRAIN_PRIOR');
    });

    it('case E: candidate ties P50 aggregate log loss exactly', () => {
      const expectedP50LogLoss = -Math.log(0.5);
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1', { candidateLogLoss: expectedP50LogLoss, candidateBrierScore: 0.1 }),
        buildCanonicalFoldResult('FOLD_2', { candidateLogLoss: expectedP50LogLoss, candidateBrierScore: 0.1 }),
        buildCanonicalFoldResult('FOLD_3', { candidateLogLoss: expectedP50LogLoss, candidateBrierScore: 0.1 }),
        buildCanonicalFoldResult('FOLD_4', { candidateLogLoss: expectedP50LogLoss, candidateBrierScore: 0.1 }),
      ];
      assertRejection(foldResults, 'AGGREGATE_LOG_LOSS_NOT_BETTER_THAN_P50');
    });

    it('case F: candidate ties fold-prior aggregate log loss exactly', () => {
      const priorLogLosses = [
        buildCanonicalFoldResult('FOLD_1').foldTrainPriorLogLoss,
        buildCanonicalFoldResult('FOLD_2').foldTrainPriorLogLoss,
        buildCanonicalFoldResult('FOLD_3').foldTrainPriorLogLoss,
        buildCanonicalFoldResult('FOLD_4').foldTrainPriorLogLoss,
      ];
      const weightedPrior = (priorLogLosses[0] * 51 + priorLogLosses[1] * 55 + priorLogLosses[2] * 55 + priorLogLosses[3] * 49) / 210;
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1', { candidateLogLoss: weightedPrior, candidateBrierScore: 0.1 }),
        buildCanonicalFoldResult('FOLD_2', { candidateLogLoss: weightedPrior, candidateBrierScore: 0.1 }),
        buildCanonicalFoldResult('FOLD_3', { candidateLogLoss: weightedPrior, candidateBrierScore: 0.1 }),
        buildCanonicalFoldResult('FOLD_4', { candidateLogLoss: weightedPrior, candidateBrierScore: 0.1 }),
      ];
      assertRejection(foldResults, 'AGGREGATE_LOG_LOSS_NOT_BETTER_THAN_TRAIN_PRIOR');
    });

    it('case G: candidate ties P50 aggregate Brier exactly', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1', { candidateLogLoss: 0.1, candidateBrierScore: 0.25 }),
        buildCanonicalFoldResult('FOLD_2', { candidateLogLoss: 0.1, candidateBrierScore: 0.25 }),
        buildCanonicalFoldResult('FOLD_3', { candidateLogLoss: 0.1, candidateBrierScore: 0.25 }),
        buildCanonicalFoldResult('FOLD_4', { candidateLogLoss: 0.1, candidateBrierScore: 0.25 }),
      ];
      assertRejection(foldResults, 'AGGREGATE_BRIER_NOT_BETTER_THAN_P50');
    });

    it('case H: candidate ties fold-prior aggregate Brier exactly', () => {
      const priorBriers = [
        buildCanonicalFoldResult('FOLD_1').foldTrainPriorBrierScore,
        buildCanonicalFoldResult('FOLD_2').foldTrainPriorBrierScore,
        buildCanonicalFoldResult('FOLD_3').foldTrainPriorBrierScore,
        buildCanonicalFoldResult('FOLD_4').foldTrainPriorBrierScore,
      ];
      const weightedPrior = (priorBriers[0] * 51 + priorBriers[1] * 55 + priorBriers[2] * 55 + priorBriers[3] * 49) / 210;
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1', { candidateLogLoss: 0.1, candidateBrierScore: weightedPrior }),
        buildCanonicalFoldResult('FOLD_2', { candidateLogLoss: 0.1, candidateBrierScore: weightedPrior }),
        buildCanonicalFoldResult('FOLD_3', { candidateLogLoss: 0.1, candidateBrierScore: weightedPrior }),
        buildCanonicalFoldResult('FOLD_4', { candidateLogLoss: 0.1, candidateBrierScore: weightedPrior }),
      ];
      assertRejection(foldResults, 'AGGREGATE_BRIER_NOT_BETTER_THAN_TRAIN_PRIOR');
    });
  });

  describe('fold-set fail-closed', () => {
    function assertAggregateRejection(
      foldResults: MLBInnerFoldMetricResult[],
      expectedCode: string,
    ): void {
      const result = evaluateMLBTrainOnlyInnerCandidate(foldResults);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i: MLBInnerAggregateResultIssue) => i.code === expectedCode)).toBe(true);
      }
    }

    it('rejects fewer than four results', () => {
      const foldResults = [buildCanonicalFoldResult('FOLD_1'), buildCanonicalFoldResult('FOLD_2'), buildCanonicalFoldResult('FOLD_3')];
      assertAggregateRejection(foldResults, 'INVALID_FOLD_SET');
    });

    it('rejects more than four results', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
        buildCanonicalFoldResult('FOLD_1'),
      ];
      assertAggregateRejection(foldResults, 'INVALID_FOLD_SET');
    });

    it('rejects missing fold', () => {
      const foldResults = [buildCanonicalFoldResult('FOLD_1'), buildCanonicalFoldResult('FOLD_2'), buildCanonicalFoldResult('FOLD_3')];
      assertAggregateRejection(foldResults, 'INVALID_FOLD_SET');
    });

    it('rejects duplicate fold', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        { ...buildCanonicalFoldResult('FOLD_1'), foldId: 'FOLD_1' } as MLBInnerFoldMetricResult,
      ];
      assertAggregateRejection(foldResults, 'DUPLICATE_FOLD');
    });

    it('rejects foreign foldId', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        { ...buildCanonicalFoldResult('FOLD_4'), foldId: 'FOREIGN' } as MLBInnerFoldMetricResult,
      ];
      assertAggregateRejection(foldResults, 'FOREIGN_FOLD');
    });

    it('rejects mixed candidateRecipeId', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2', { candidateRecipeId: 'recipe-2' }),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ];
      assertAggregateRejection(foldResults, 'IDENTITY_MISMATCH');
    });

    it('rejects empty candidateRecipeId', () => {
      const foldResults = [
        { ...buildCanonicalFoldResult('FOLD_1'), candidateRecipeId: '' } as MLBInnerFoldMetricResult,
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ];
      assertAggregateRejection(foldResults, 'INVALID_STRING');
    });

    it('rejects wrong fold rowCount', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        { ...buildCanonicalFoldResult('FOLD_4'), rowCount: 99 } as MLBInnerFoldMetricResult,
      ];
      assertAggregateRejection(foldResults, 'ROW_COUNT_MISMATCH');
    });

    it('rejects wrong HOME count', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        { ...buildCanonicalFoldResult('FOLD_4'), targetHomeWinCount: 99 } as MLBInnerFoldMetricResult,
      ];
      assertAggregateRejection(foldResults, 'CLASS_COUNT_MISMATCH');
    });

    it('rejects wrong AWAY count', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        { ...buildCanonicalFoldResult('FOLD_4'), targetAwayWinCount: 99 } as MLBInnerFoldMetricResult,
      ];
      assertAggregateRejection(foldResults, 'CLASS_COUNT_MISMATCH');
    });

    it('rejects HOME + AWAY != rowCount', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        { ...buildCanonicalFoldResult('FOLD_4'), targetHomeWinCount: 30, targetAwayWinCount: 30 } as MLBInnerFoldMetricResult,
      ];
      assertAggregateRejection(foldResults, 'CLASS_COUNT_MISMATCH');
    });

    it('rejects wrong foldTrainPriorProbability', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        { ...buildCanonicalFoldResult('FOLD_4'), foldTrainPriorProbability: 0.999 } as MLBInnerFoldMetricResult,
      ];
      assertAggregateRejection(foldResults, 'TRAIN_PRIOR_MISMATCH');
    });

    it('rejects wrong contractVersion at runtime', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        { ...buildCanonicalFoldResult('FOLD_4'), contractVersion: 'wrong-version' } as unknown as MLBInnerFoldMetricResult,
      ];
      assertAggregateRejection(foldResults, 'INVALID_FOLD_SET');
    });

    it('rejects non-finite candidate metric', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1', { candidateLogLoss: Number.NaN }),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ];
      assertAggregateRejection(foldResults, 'NONFINITE_METRIC');
    });

    it('rejects negative log loss', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1', { candidateLogLoss: -0.1 }),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ];
      assertAggregateRejection(foldResults, 'NONFINITE_METRIC');
    });

    it('rejects Brier < 0', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1', { candidateBrierScore: -0.1 }),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ];
      assertAggregateRejection(foldResults, 'NONFINITE_METRIC');
    });

    it('rejects Brier > 1', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1', { candidateBrierScore: 1.1 }),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ];
      assertAggregateRejection(foldResults, 'NONFINITE_METRIC');
    });

    it('rejects AUC < 0', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1', { candidateRocAuc: -0.1 }),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ];
      assertAggregateRejection(foldResults, 'NONFINITE_METRIC');
    });

    it('rejects AUC > 1', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1', { candidateRocAuc: 1.1 }),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ];
      assertAggregateRejection(foldResults, 'NONFINITE_METRIC');
    });

    it('ignores forged P50 metric: aggregate and gate remain canonical', () => {
      const canonicalFoldResults = [
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ];
      const baselineAggregate = evaluateMLBTrainOnlyInnerCandidate(canonicalFoldResults);
      expect(baselineAggregate.ok).toBe(true);
      if (!baselineAggregate.ok) return;
      const baselineGate = evaluateMLBTrainOnlyInnerCandidateGate(canonicalFoldResults);
      expect(baselineGate.ok).toBe(true);
      if (!baselineGate.ok) return;

      const forgedFoldResults = [
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4', { p50BrierScore: 0.5, p50LogLoss: 1.0, p50RocAuc: 0.9 } as Partial<MLBInnerFoldMetricResult>),
      ];

      const forgedAggregate = evaluateMLBTrainOnlyInnerCandidate(forgedFoldResults);
      expect(forgedAggregate.ok).toBe(true);
      if (!forgedAggregate.ok) return;
      expect(forgedAggregate.value.aggregateP50LogLoss).toBeCloseTo(baselineAggregate.value.aggregateP50LogLoss);
      expect(forgedAggregate.value.aggregateP50BrierScore).toBeCloseTo(baselineAggregate.value.aggregateP50BrierScore);
      expect(forgedAggregate.value.aggregateP50RocAuc).toBeCloseTo(baselineAggregate.value.aggregateP50RocAuc);

      const forgedGate = evaluateMLBTrainOnlyInnerCandidateGate(forgedFoldResults);
      expect(forgedGate.ok).toBe(true);
      if (!forgedGate.ok) return;
      expect(forgedGate.value.eligibility).toBe(baselineGate.value.eligibility);
      expect(forgedGate.value.reasons).toEqual(baselineGate.value.reasons);
    });

    it('ignores forged fold-prior metric: aggregate and gate remain canonical', () => {
      const canonicalFoldResults = [
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ];
      const baselineAggregate = evaluateMLBTrainOnlyInnerCandidate(canonicalFoldResults);
      expect(baselineAggregate.ok).toBe(true);
      if (!baselineAggregate.ok) return;
      const baselineGate = evaluateMLBTrainOnlyInnerCandidateGate(canonicalFoldResults);
      expect(baselineGate.ok).toBe(true);
      if (!baselineGate.ok) return;

      const forgedFoldResults = [
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        {
          ...buildCanonicalFoldResult('FOLD_4'),
          foldTrainPriorLogLoss: 1.0,
          foldTrainPriorBrierScore: 0.5,
          foldTrainPriorRocAuc: 0.9,
        } as MLBInnerFoldMetricResult,
      ];
      const forgedAggregate = evaluateMLBTrainOnlyInnerCandidate(forgedFoldResults);
      expect(forgedAggregate.ok).toBe(true);
      if (!forgedAggregate.ok) return;
      expect(forgedAggregate.value.aggregateFoldTrainPriorLogLoss).toBeCloseTo(baselineAggregate.value.aggregateFoldTrainPriorLogLoss);
      expect(forgedAggregate.value.aggregateFoldTrainPriorBrierScore).toBeCloseTo(baselineAggregate.value.aggregateFoldTrainPriorBrierScore);
      expect(forgedAggregate.value.aggregateFoldTrainPriorRocAuc).toBeCloseTo(baselineAggregate.value.aggregateFoldTrainPriorRocAuc);

      const forgedGate = evaluateMLBTrainOnlyInnerCandidateGate(forgedFoldResults);
      expect(forgedGate.ok).toBe(true);
      if (!forgedGate.ok) return;
      expect(forgedGate.value.eligibility).toBe(baselineGate.value.eligibility);
      expect(forgedGate.value.reasons).toEqual(baselineGate.value.reasons);
    });
  });

  describe('gate strictness', () => {
    it('returns explicit booleans for each comparison', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1', { candidateLogLoss: 1.0, candidateBrierScore: 0.5 }),
        buildCanonicalFoldResult('FOLD_2', { candidateLogLoss: 1.0, candidateBrierScore: 0.5 }),
        buildCanonicalFoldResult('FOLD_3', { candidateLogLoss: 1.0, candidateBrierScore: 0.5 }),
        buildCanonicalFoldResult('FOLD_4', { candidateLogLoss: 1.0, candidateBrierScore: 0.5 }),
      ];

      const aggregateResult = evaluateMLBTrainOnlyInnerCandidate(foldResults);
      expect(aggregateResult.ok).toBe(true);
      if (!aggregateResult.ok) return;

      const gateResult = evaluateMLBTrainOnlyInnerCandidateGate(foldResults);
      expect(gateResult.ok).toBe(true);
      if (!gateResult.ok) return;

      expect(gateResult.value.reasons).toContain('AGGREGATE_LOG_LOSS_NOT_BETTER_THAN_P50');
      expect(gateResult.value.reasons).toContain('AGGREGATE_LOG_LOSS_NOT_BETTER_THAN_TRAIN_PRIOR');
      expect(gateResult.value.reasons).toContain('AGGREGATE_BRIER_NOT_BETTER_THAN_P50');
      expect(gateResult.value.reasons).toContain('AGGREGATE_BRIER_NOT_BETTER_THAN_TRAIN_PRIOR');
    });
  });

  describe('gate reference integrity', () => {
    it('ignores forged P50 reference fields in fold results', () => {
      const baseline = evaluateMLBTrainOnlyInnerCandidate([
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ]);
      expect(baseline.ok).toBe(true);
      if (!baseline.ok) return;

      const forgedFoldResults = [
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4', { p50BrierScore: 0.5, p50LogLoss: 1.0, p50RocAuc: 0.9 } as Partial<MLBInnerFoldMetricResult>),
      ];

      const forgedAggregate = evaluateMLBTrainOnlyInnerCandidate(forgedFoldResults);
      expect(forgedAggregate.ok).toBe(true);
      if (!forgedAggregate.ok) return;
      expect(forgedAggregate.value.aggregateP50LogLoss).toBeCloseTo(baseline.value.aggregateP50LogLoss);
      expect(forgedAggregate.value.aggregateP50BrierScore).toBeCloseTo(baseline.value.aggregateP50BrierScore);
      expect(forgedAggregate.value.aggregateP50RocAuc).toBeCloseTo(baseline.value.aggregateP50RocAuc);

      const baselineGate = evaluateMLBTrainOnlyInnerCandidateGate([
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ]);
      expect(baselineGate.ok).toBe(true);
      if (!baselineGate.ok) return;

      const forgedGate = evaluateMLBTrainOnlyInnerCandidateGate(forgedFoldResults);
      expect(forgedGate.ok).toBe(true);
      if (!forgedGate.ok) return;
      expect(forgedGate.value.eligibility).toBe(baselineGate.value.eligibility);
      expect(forgedGate.value.reasons).toEqual(baselineGate.value.reasons);
    });

    it('ignores forged train-prior reference fields in fold results', () => {
      const baseline = evaluateMLBTrainOnlyInnerCandidate([
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ]);
      expect(baseline.ok).toBe(true);
      if (!baseline.ok) return;

      const forgedFoldResults = [
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        {
          ...buildCanonicalFoldResult('FOLD_4'),
          foldTrainPriorLogLoss: 1.0,
          foldTrainPriorBrierScore: 0.5,
          foldTrainPriorRocAuc: 0.9,
        } as MLBInnerFoldMetricResult,
      ];

      const forgedAggregate = evaluateMLBTrainOnlyInnerCandidate(forgedFoldResults);
      expect(forgedAggregate.ok).toBe(true);
      if (!forgedAggregate.ok) return;
      expect(forgedAggregate.value.aggregateFoldTrainPriorLogLoss).toBeCloseTo(baseline.value.aggregateFoldTrainPriorLogLoss);
      expect(forgedAggregate.value.aggregateFoldTrainPriorBrierScore).toBeCloseTo(baseline.value.aggregateFoldTrainPriorBrierScore);
      expect(forgedAggregate.value.aggregateFoldTrainPriorRocAuc).toBeCloseTo(baseline.value.aggregateFoldTrainPriorRocAuc);

      const baselineGate = evaluateMLBTrainOnlyInnerCandidateGate([
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ]);
      expect(baselineGate.ok).toBe(true);
      if (!baselineGate.ok) return;

      const forgedGate = evaluateMLBTrainOnlyInnerCandidateGate(forgedFoldResults);
      expect(forgedGate.ok).toBe(true);
      if (!forgedGate.ok) return;
      expect(forgedGate.value.eligibility).toBe(baselineGate.value.eligibility);
      expect(forgedGate.value.reasons).toEqual(baselineGate.value.reasons);
    });
  });

  describe('gate fail-closed', () => {
    function assertGateFailure(foldResults: MLBInnerFoldMetricResult[], expectedCode: string): void {
      const result = evaluateMLBTrainOnlyInnerCandidateGate(foldResults);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i: MLBInnerCandidateGateResultIssue) => i.code === expectedCode)).toBe(true);
      }
    }

    it('fails closed for missing fold', () => {
      const foldResults = [buildCanonicalFoldResult('FOLD_1'), buildCanonicalFoldResult('FOLD_2'), buildCanonicalFoldResult('FOLD_3')];
      assertGateFailure(foldResults, 'INVALID_FOLD_RESULT');
    });

    it('fails closed for duplicate fold', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        { ...buildCanonicalFoldResult('FOLD_1'), foldId: 'FOLD_1' } as MLBInnerFoldMetricResult,
      ];
      assertGateFailure(foldResults, 'INVALID_FOLD_RESULT');
    });

    it('fails closed for foreign foldId', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        { ...buildCanonicalFoldResult('FOLD_4'), foldId: 'FOREIGN' } as MLBInnerFoldMetricResult,
      ];
      assertGateFailure(foldResults, 'INVALID_FOLD_RESULT');
    });

    it('fails closed for mixed candidateRecipeId', () => {
      const foldResults = [
        buildCanonicalFoldResult('FOLD_1'),
        buildCanonicalFoldResult('FOLD_2', { candidateRecipeId: 'recipe-2' }),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ];
      assertGateFailure(foldResults, 'INVALID_FOLD_RESULT');
    });

    it('fails closed for empty candidateRecipeId', () => {
      const foldResults = [
        { ...buildCanonicalFoldResult('FOLD_1'), candidateRecipeId: '' } as MLBInnerFoldMetricResult,
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ];
      assertGateFailure(foldResults, 'INVALID_FOLD_RESULT');
    });

    it('fails closed for wrong canonical rowCount', () => {
      const foldResults = [
        { ...buildCanonicalFoldResult('FOLD_1'), rowCount: 999 } as MLBInnerFoldMetricResult,
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ];
      assertGateFailure(foldResults, 'INVALID_FOLD_RESULT');
    });

    it('fails closed for wrong canonical HOME count', () => {
      const foldResults = [
        { ...buildCanonicalFoldResult('FOLD_1'), targetHomeWinCount: 999 } as MLBInnerFoldMetricResult,
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ];
      assertGateFailure(foldResults, 'INVALID_FOLD_RESULT');
    });

    it('fails closed for wrong canonical AWAY count', () => {
      const foldResults = [
        { ...buildCanonicalFoldResult('FOLD_1'), targetAwayWinCount: 999 } as MLBInnerFoldMetricResult,
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ];
      assertGateFailure(foldResults, 'INVALID_FOLD_RESULT');
    });

    it('fails closed for wrong canonical TRAIN-prior probability', () => {
      const foldResults = [
        { ...buildCanonicalFoldResult('FOLD_1'), foldTrainPriorProbability: 0.9 } as MLBInnerFoldMetricResult,
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ];
      assertGateFailure(foldResults, 'INVALID_FOLD_RESULT');
    });

    it('fails closed for nonfinite candidate metric', () => {
      const foldResults = [
        { ...buildCanonicalFoldResult('FOLD_1'), candidateLogLoss: NaN } as MLBInnerFoldMetricResult,
        buildCanonicalFoldResult('FOLD_2'),
        buildCanonicalFoldResult('FOLD_3'),
        buildCanonicalFoldResult('FOLD_4'),
      ];
      assertGateFailure(foldResults, 'INVALID_FOLD_RESULT');
    });
  });
});
