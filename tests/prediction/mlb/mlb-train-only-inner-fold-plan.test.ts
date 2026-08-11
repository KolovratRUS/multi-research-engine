import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  MLB_TRAIN_ONLY_INNER_FOLD_PLAN_CONTRACT_VERSION,
  MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN,
  validateMLBTrainOnlyInnerFoldPlan,
  type MLBFoldDefinition,
  type MLBTrainOnlyInnerFoldPlan,
  type MLBTrainOnlyInnerFoldPlanIssue,
} from '@/prediction/mlb/mlb-train-only-inner-fold-plan';

function buildFold(overrides: Partial<MLBFoldDefinition> = {}): any {
  return {
    foldId: 'FOLD_1',
    innerTrainStartDate: '2026-04-01',
    innerTrainEndDate: '2026-04-07',
    innerValidationStartDate: '2026-04-08',
    innerValidationEndDate: '2026-04-11',
    expectedTrainRowCount: 91,
    expectedValidationRowCount: 51,
    expectedTrainHomeWinCount: 49,
    expectedTrainAwayWinCount: 42,
    expectedValidationHomeWinCount: 29,
    expectedValidationAwayWinCount: 22,
    ...overrides,
  };
}

function buildPlan(overrides: Partial<MLBTrainOnlyInnerFoldPlan> = {}): any {
  return {
    contractVersion: MLB_TRAIN_ONLY_INNER_FOLD_PLAN_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    folds: [buildFold()],
    ...overrides,
  };
}

function clonePlan(plan: MLBTrainOnlyInnerFoldPlan): any {
  return JSON.parse(JSON.stringify(plan));
}

describe('mlb-train-only-inner-fold-plan', () => {
  describe('canonical happy path', () => {
    it('validates the canonical plan successfully', () => {
      const result = validateMLBTrainOnlyInnerFoldPlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      }
    });

    it('accepts exactly four folds', () => {
      const result = validateMLBTrainOnlyInnerFoldPlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.folds).toHaveLength(4);
      }
    });

    it('accepts explicit outer TRAIN population of 301', () => {
      const result = validateMLBTrainOnlyInnerFoldPlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.expectedOuterTrainRowCount).toBe(301);
      }
    });

    it('reconciles Fold 4 counts to the explicit outer TRAIN population', () => {
      const result = validateMLBTrainOnlyInnerFoldPlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const fold4 = result.value.folds[3];
        expect(fold4.expectedTrainRowCount + fold4.expectedValidationRowCount).toBe(301);
      }
    });

    it('validates exact fold identities and order', () => {
      const result = validateMLBTrainOnlyInnerFoldPlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const ids = result.value.folds.map((f) => f.foldId);
        expect(ids).toEqual(['FOLD_1', 'FOLD_2', 'FOLD_3', 'FOLD_4']);
      }
    });

    it('validates every date boundary exactly', () => {
      const result = validateMLBTrainOnlyInnerFoldPlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.folds[0].innerTrainStartDate).toBe('2026-04-01');
        expect(result.value.folds[0].innerTrainEndDate).toBe('2026-04-07');
        expect(result.value.folds[0].innerValidationStartDate).toBe('2026-04-08');
        expect(result.value.folds[0].innerValidationEndDate).toBe('2026-04-11');
        expect(result.value.folds[3].innerValidationEndDate).toBe('2026-04-23');
      }
    });

    it('validates every row count exactly', () => {
      const result = validateMLBTrainOnlyInnerFoldPlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.folds[0].expectedTrainRowCount).toBe(91);
        expect(result.value.folds[0].expectedValidationRowCount).toBe(51);
        expect(result.value.folds[1].expectedTrainRowCount).toBe(142);
        expect(result.value.folds[1].expectedValidationRowCount).toBe(55);
        expect(result.value.folds[2].expectedTrainRowCount).toBe(197);
        expect(result.value.folds[2].expectedValidationRowCount).toBe(55);
        expect(result.value.folds[3].expectedTrainRowCount).toBe(252);
        expect(result.value.folds[3].expectedValidationRowCount).toBe(49);
      }
    });

    it('validates every target count exactly', () => {
      const result = validateMLBTrainOnlyInnerFoldPlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.folds[0]).toEqual({
          foldId: 'FOLD_1',
          innerTrainStartDate: '2026-04-01',
          innerTrainEndDate: '2026-04-07',
          innerValidationStartDate: '2026-04-08',
          innerValidationEndDate: '2026-04-11',
          expectedTrainRowCount: 91,
          expectedValidationRowCount: 51,
          expectedTrainHomeWinCount: 49,
          expectedTrainAwayWinCount: 42,
          expectedValidationHomeWinCount: 29,
          expectedValidationAwayWinCount: 22,
        });
        expect(result.value.folds[1]).toEqual({
          foldId: 'FOLD_2',
          innerTrainStartDate: '2026-04-01',
          innerTrainEndDate: '2026-04-11',
          innerValidationStartDate: '2026-04-12',
          innerValidationEndDate: '2026-04-15',
          expectedTrainRowCount: 142,
          expectedValidationRowCount: 55,
          expectedTrainHomeWinCount: 78,
          expectedTrainAwayWinCount: 64,
          expectedValidationHomeWinCount: 34,
          expectedValidationAwayWinCount: 21,
        });
        expect(result.value.folds[2]).toEqual({
          foldId: 'FOLD_3',
          innerTrainStartDate: '2026-04-01',
          innerTrainEndDate: '2026-04-15',
          innerValidationStartDate: '2026-04-16',
          innerValidationEndDate: '2026-04-19',
          expectedTrainRowCount: 197,
          expectedValidationRowCount: 55,
          expectedTrainHomeWinCount: 112,
          expectedTrainAwayWinCount: 85,
          expectedValidationHomeWinCount: 25,
          expectedValidationAwayWinCount: 30,
        });
        expect(result.value.folds[3]).toEqual({
          foldId: 'FOLD_4',
          innerTrainStartDate: '2026-04-01',
          innerTrainEndDate: '2026-04-19',
          innerValidationStartDate: '2026-04-20',
          innerValidationEndDate: '2026-04-23',
          expectedTrainRowCount: 252,
          expectedValidationRowCount: 49,
          expectedTrainHomeWinCount: 137,
          expectedTrainAwayWinCount: 115,
          expectedValidationHomeWinCount: 23,
          expectedValidationAwayWinCount: 26,
        });
      }
    });

    it('validates that each target-count pair reconciles to its role row count', () => {
      const result = validateMLBTrainOnlyInnerFoldPlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      expect(result.ok).toBe(true);
      if (result.ok) {
        for (const fold of result.value.folds) {
          expect(fold.expectedTrainHomeWinCount + fold.expectedTrainAwayWinCount).toBe(fold.expectedTrainRowCount);
          expect(fold.expectedValidationHomeWinCount + fold.expectedValidationAwayWinCount).toBe(fold.expectedValidationRowCount);
        }
      }
    });

    it('validates both classes present in every train block', () => {
      const result = validateMLBTrainOnlyInnerFoldPlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      expect(result.ok).toBe(true);
      if (result.ok) {
        for (const fold of result.value.folds) {
          expect(fold.expectedTrainHomeWinCount > 0).toBe(true);
          expect(fold.expectedTrainAwayWinCount > 0).toBe(true);
        }
      }
    });

    it('validates both classes present in every validation block', () => {
      const result = validateMLBTrainOnlyInnerFoldPlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      expect(result.ok).toBe(true);
      if (result.ok) {
        for (const fold of result.value.folds) {
          expect(fold.expectedValidationHomeWinCount > 0).toBe(true);
          expect(fold.expectedValidationAwayWinCount > 0).toBe(true);
        }
      }
    });
  });

  describe('chronological invariant rejection', () => {
    it('rejects train end on or after validation start', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[0].innerTrainEndDate = '2026-04-08';
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'DATE_ORDER_VIOLATION' })]),
        );
      }
    });

    it('rejects validation start before train end', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[0].innerValidationStartDate = '2026-04-06';
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'DATE_ORDER_VIOLATION' })]),
        );
      }
    });

    it('rejects overlapping validation windows', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[1].innerValidationStartDate = '2026-04-10';
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'DATE_OVERLAP' })]),
        );
      }
    });

    it('rejects moved validation boundary', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[1].innerValidationEndDate = '2026-04-16';
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'DATE_ORDER_VIOLATION' })]),
        );
      }
    });

    it('rejects moved training boundary', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[2].innerTrainEndDate = '2026-04-14';
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'DATE_ORDER_VIOLATION' })]),
        );
      }
    });

    it('rejects broken expanding-window progression', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[2].innerTrainEndDate = '2026-04-10';
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'DATE_OVERLAP' })]),
        );
      }
    });

    it('rejects noncanonical train start', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[2].innerTrainStartDate = '2026-04-02';
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'DATE_ORDER_VIOLATION' })]),
        );
      }
    });

    it('rejects random/reordered folds', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      const reordered = [
        plan.folds[1],
        plan.folds[0],
        plan.folds[3],
        plan.folds[2],
      ];
      plan.folds = reordered;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'NON_CANONICAL_ORDER' })]),
        );
      }
    });

    it('rejects missing fold', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds = [plan.folds[0], plan.folds[1], plan.folds[2]];
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'FOLD_COUNT_MISMATCH' })]),
        );
      }
    });

    it('rejects duplicate fold', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds = [plan.folds[0], plan.folds[0], plan.folds[2], plan.folds[3]];
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'DUPLICATE_ID' })]),
        );
      }
    });
  });

  describe('count invariant rejection', () => {
    it('rejects zero train rows', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[0].expectedTrainRowCount = 0;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'INVALID_INTEGER' })]),
        );
      }
    });

    it('rejects zero validation rows', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[0].expectedValidationRowCount = 0;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'INVALID_INTEGER' })]),
        );
      }
    });

    it('rejects negative count', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[0].expectedTrainHomeWinCount = -1;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'INVALID_INTEGER' })]),
        );
      }
    });

    it('rejects fractional count', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[0].expectedTrainRowCount = 91.5;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'INVALID_INTEGER' })]),
        );
      }
    });

    it('rejects NaN count if it reaches the validator', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[0].expectedTrainRowCount = Number.NaN;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'INVALID_INTEGER' })]),
        );
      }
    });

    it('rejects Infinity count if it reaches the validator', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[0].expectedTrainRowCount = Infinity;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'INVALID_INTEGER' })]),
        );
      }
    });

    it('rejects train home + away != train rows', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[0].expectedTrainHomeWinCount = 50;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'COUNT_MISMATCH' })]),
        );
      }
    });

    it('rejects validation home + away != validation rows', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[0].expectedValidationAwayWinCount = 23;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'COUNT_MISMATCH' })]),
        );
      }
    });

    it('rejects class-degenerate train', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[0].expectedTrainAwayWinCount = 0;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'CLASS_DEGENERATE' })]),
        );
      }
    });

    it('rejects class-degenerate validation', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[0].expectedValidationHomeWinCount = 0;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'CLASS_DEGENERATE' })]),
        );
      }
    });

    it('rejects mutated exact row count', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[1].expectedTrainRowCount = 143;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'COUNT_MISMATCH' })]),
        );
      }
    });

    it('rejects mutated exact home-win count', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[2].expectedTrainHomeWinCount = 113;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'COUNT_MISMATCH' })]),
        );
      }
    });

    it('rejects mutated exact away-win count', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[3].expectedTrainAwayWinCount = 116;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'COUNT_MISMATCH' })]),
        );
      }
    });
  });

  describe('date parsing rigor', () => {
    const badDates = ['2026-4-01', '2026-04-1', '2026-02-30', 'not-a-date'];

    for (const badDate of badDates) {
      it(`rejects malformed date: ${badDate}`, () => {
        const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
        plan.folds[0].innerTrainStartDate = badDate;
        const result = validateMLBTrainOnlyInnerFoldPlan(plan);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.issues).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: 'INVALID_DATE' })]),
          );
        }
      });
    }
  });

  describe('exact frozen-plan protection', () => {
    it('rejects Fold 1 validation beginning one day later', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[0].innerValidationStartDate = '2026-04-09';
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'DATE_ORDER_VIOLATION' })]),
        );
      }
    });

    it('rejects Fold 4 validation ending one day earlier', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[3].innerValidationEndDate = '2026-04-22';
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'DATE_ORDER_VIOLATION' })]),
        );
      }
    });

    it('rejects Fold 2 having 143 train rows instead of 142', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[1].expectedTrainRowCount = 143;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'COUNT_MISMATCH' })]),
        );
      }
    });

    it('rejects Fold 3 train home/away counts changed while still summing to 197', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[2].expectedTrainHomeWinCount = 113;
      plan.folds[2].expectedTrainAwayWinCount = 84;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'COUNT_MISMATCH' })]),
        );
      }
    });

    it('rejects explicit outer TRAIN population of 300', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.expectedOuterTrainRowCount = 300;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'COUNT_MISMATCH' })]),
        );
      }
    });

    it('rejects explicit outer TRAIN population of 302', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.expectedOuterTrainRowCount = 302;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'COUNT_MISMATCH' })]),
        );
      }
    });

    it('rejects fractional outer TRAIN population', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.expectedOuterTrainRowCount = 301.5;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'INVALID_INTEGER' })]),
        );
      }
    });

    it('rejects NaN outer TRAIN population', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.expectedOuterTrainRowCount = Number.NaN;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'INVALID_INTEGER' })]),
        );
      }
    });

    it('rejects Infinity outer TRAIN population', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.expectedOuterTrainRowCount = Infinity;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'INVALID_INTEGER' })]),
        );
      }
    });

    it('rejects missing explicit outer TRAIN population', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      delete (plan as Record<string, unknown>).expectedOuterTrainRowCount;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'MISSING_FIELD' })]),
        );
      }
    });

    it('rejects self-consistent-looking plan where Fold 4 totals 301 but explicit population says 302', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.expectedOuterTrainRowCount = 302;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'COUNT_MISMATCH' })]),
        );
      }
    });

    it('rejects mismatch where explicit population is 301 but Fold 4 no longer reconciles', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[3].expectedTrainRowCount = 253;
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'COUNT_MISMATCH' })]),
        );
      }
    });

    it('rejects swapped fold IDs', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.folds[0].foldId = 'FOLD_2';
      plan.folds[1].foldId = 'FOLD_1';
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'NON_CANONICAL_ORDER' })]),
        );
      }
    });

    it('rejects altered contractVersion', () => {
      const plan = clonePlan(MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN);
      plan.contractVersion = 'mlb-train-only-inner-fold-plan-v2';
      const result = validateMLBTrainOnlyInnerFoldPlan(plan);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'INVALID_LITERAL' })]),
        );
      }
    });
  });

  describe('non-goal architecture assertions', () => {
    it('prohibits trainer and fit imports and references', () => {
      const source = readFileSync(new URL('../../../src/prediction/mlb/mlb-train-only-inner-fold-plan.ts', import.meta.url).pathname, 'utf8');
      expect(source).not.toMatch(/fitAndEvaluateMLBDeterministicLogisticRegression/);
      expect(source).not.toMatch(/evaluateAndReleaseMLBDeterministicModel/);
      expect(source).not.toMatch(/\btrainer\b/);
      expect(source).not.toMatch(/\bfitAndEvaluate\b/);
      expect(source).not.toMatch(/\bevaluateAndRelease\b/);
    });

    it('exports no prohibited trainer APIs', async () => {
      const mod = await import('@/prediction/mlb/mlb-train-only-inner-fold-plan');
      const exportedNames = Object.keys(mod).filter(
        (key) => key !== '__esModule' && key !== 'default',
      );
      for (const name of exportedNames) {
        expect(name).not.toMatch(/trainer/i);
        expect(name).not.toMatch(/fitAndEvaluate/i);
        expect(name).not.toMatch(/evaluateAndRelease/i);
      }
    });
  });
});
