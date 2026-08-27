import { describe, expect, it } from 'vitest';
import {
  MLB_HISTORICAL_HOLDOUT_RETIREMENT_RECORD,
  MLB_HISTORICAL_HOLDOUT_RETIREMENT_RECORD_CONTRACT_VERSION,
  MLB_HISTORICAL_HOLDOUT_RETIREMENT_REASON,
  MLB_HISTORICAL_HOLDOUT_RETIRED_DATASET_ID,
  MLB_HISTORICAL_HOLDOUT_RETIRED_DATASET_SHA256,
  MLB_HISTORICAL_HOLDOUT_VALIDATION_ROW_COUNT,
  MLB_HISTORICAL_HOLDOUT_VALIDATION_DATE_START,
  MLB_HISTORICAL_HOLDOUT_VALIDATION_DATE_END,
  MLB_HISTORICAL_HOLDOUT_TEST_ROW_COUNT,
  MLB_HISTORICAL_HOLDOUT_TEST_DATE_START,
  MLB_HISTORICAL_HOLDOUT_TEST_DATE_END,
  MLB_HISTORICAL_HOLDOUT_SUPERSEDED_BY,
  validateMLBHistoricalHoldoutRetirementRecord,
} from '@/prediction/mlb/mlb-historical-holdout-retirement-record';

function buildValidRecord(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    contractVersion: MLB_HISTORICAL_HOLDOUT_RETIREMENT_RECORD_CONTRACT_VERSION,
    retiredDatasetId: MLB_HISTORICAL_HOLDOUT_RETIRED_DATASET_ID,
    retiredDatasetSha256: MLB_HISTORICAL_HOLDOUT_RETIRED_DATASET_SHA256,
    reason: MLB_HISTORICAL_HOLDOUT_RETIREMENT_REASON,
    historicalValidation: {
      rowCount: MLB_HISTORICAL_HOLDOUT_VALIDATION_ROW_COUNT,
      dateStart: MLB_HISTORICAL_HOLDOUT_VALIDATION_DATE_START,
      dateEnd: MLB_HISTORICAL_HOLDOUT_VALIDATION_DATE_END,
    },
    historicalTest: {
      rowCount: MLB_HISTORICAL_HOLDOUT_TEST_ROW_COUNT,
      dateStart: MLB_HISTORICAL_HOLDOUT_TEST_DATE_START,
      dateEnd: MLB_HISTORICAL_HOLDOUT_TEST_DATE_END,
    },
    validationPayloadAvailable: false,
    validationConsumed: false,
    testPayloadAvailable: false,
    testAccessed: false,
    liveRematerializationExactEquivalenceProven: false,
    supersededForOperationalPromotionBy: MLB_HISTORICAL_HOLDOUT_SUPERSEDED_BY,
    ...overrides,
  };
}

describe('mlb-historical-holdout-retirement-record', () => {
  describe('validateMLBHistoricalHoldoutRetirementRecord', () => {
    it('1. canonical record valid', () => {
      const result = validateMLBHistoricalHoldoutRetirementRecord(buildValidRecord());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.retiredDatasetId).toBe(MLB_HISTORICAL_HOLDOUT_RETIRED_DATASET_ID);
      }
    });

    it('2. old dataset ID exact', () => {
      const result = validateMLBHistoricalHoldoutRetirementRecord(buildValidRecord());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.retiredDatasetId).toBe('mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360');
      }
    });

    it('3. old dataset SHA exact', () => {
      const result = validateMLBHistoricalHoldoutRetirementRecord(buildValidRecord());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.retiredDatasetSha256).toBe('e6730f3b9f8e5b0e32958e1997ff804f1b66cb9c323cc992a55a9d8882d742a7');
      }
    });

    it('4. 67 validation rows exact', () => {
      const result = validateMLBHistoricalHoldoutRetirementRecord(buildValidRecord());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.historicalValidation.rowCount).toBe(67);
      }
    });

    it('5. 69 TEST rows exact', () => {
      const result = validateMLBHistoricalHoldoutRetirementRecord(buildValidRecord());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.historicalTest.rowCount).toBe(69);
      }
    });

    it('6. historical dates exact', () => {
      const result = validateMLBHistoricalHoldoutRetirementRecord(buildValidRecord());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.historicalValidation.dateStart).toBe('2026-04-24');
        expect(result.value.historicalValidation.dateEnd).toBe('2026-04-28');
        expect(result.value.historicalTest.dateStart).toBe('2026-04-29');
        expect(result.value.historicalTest.dateEnd).toBe('2026-05-03');
      }
    });

    it('7. reason code exact', () => {
      const result = validateMLBHistoricalHoldoutRetirementRecord(buildValidRecord());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.reason).toBe('HISTORICAL_PAYLOAD_UNAVAILABLE_AND_NOT_REPRODUCIBLE');
      }
    });

    it('8. validationConsumed must be false', () => {
      const result = validateMLBHistoricalHoldoutRetirementRecord(
        buildValidRecord({ validationConsumed: true }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.validationConsumed')).toBe(true);
      }
    });

    it('9. testAccessed must be false', () => {
      const result = validateMLBHistoricalHoldoutRetirementRecord(
        buildValidRecord({ testAccessed: true }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.testAccessed')).toBe(true);
      }
    });

    it('10. payload availability must be false', () => {
      const result = validateMLBHistoricalHoldoutRetirementRecord(
        buildValidRecord({ validationPayloadAvailable: true, testPayloadAvailable: true }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.validationPayloadAvailable')).toBe(true);
        expect(result.issues.some((issue) => issue.path === '$.testPayloadAvailable')).toBe(true);
      }
    });

    it('11. exact-equivalence-proven must be false', () => {
      const result = validateMLBHistoricalHoldoutRetirementRecord(
        buildValidRecord({ liveRematerializationExactEquivalenceProven: true }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.liveRematerializationExactEquivalenceProven')).toBe(true);
      }
    });

    it('12. prospective protocol supersession ID exact', () => {
      const result = validateMLBHistoricalHoldoutRetirementRecord(buildValidRecord());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.supersededForOperationalPromotionBy).toBe('mlb-v1-candidate-003-prospective-holdout-v1');
      }
    });

    it('13. unknown enumerable own key rejected', () => {
      const input = buildValidRecord();
      (input as Record<string, unknown>).unknownField = 'x';
      const result = validateMLBHistoricalHoldoutRetirementRecord(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.unknownField')).toBe(true);
      }
    });

    it('14. symbol own key rejected', () => {
      const input = buildValidRecord();
      (input as Record<symbol, unknown>)[Symbol.for('sym')] = 'x';
      const result = validateMLBHistoricalHoldoutRetirementRecord(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$[Symbol(sym)]')).toBe(true);
      }
    });

    it('15. accessor rejected', () => {
      const input = buildValidRecord();
      Object.defineProperty(input, 'retiredDatasetId', {
        get() { return 'x'; },
        enumerable: true,
        configurable: true,
      });
      const result = validateMLBHistoricalHoldoutRetirementRecord(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.retiredDatasetId' && issue.code === 'INVALID_JSON_VALUE')).toBe(true);
      }
    });

    it('16. non-plain object rejected', () => {
      const result = validateMLBHistoricalHoldoutRetirementRecord(null);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$' && issue.code === 'NOT_PLAIN_OBJECT')).toBe(true);
      }
    });

    it('17. frozen record is immutable', () => {
      expect(Object.isFrozen(MLB_HISTORICAL_HOLDOUT_RETIREMENT_RECORD)).toBe(true);
      expect(typeof MLB_HISTORICAL_HOLDOUT_RETIREMENT_RECORD).toBe('object');
    });
  });
});
