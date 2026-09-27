import { describe, it, expect } from 'vitest';
import {
  buildMLBShadowPredictionOperationalRecord,
  type MLBShadowPredictionOperationalRecordInput,
} from '@/prediction/mlb/mlb-shadow-monitoring-operational-projection';
import {
  MLB_SHADOW_MONITORING_OPERATIONAL_MODE_S1_OPERATIONAL_BLIND,
  MLB_SHADOW_MONITORING_SCIENTIFIC_USE_NONE,
} from '@/prediction/mlb/mlb-shadow-monitoring-record-contract';

/* -------------------------------------------------------------------------- */
/*  Frozen builder-owned candidate provenance                                 */
/* -------------------------------------------------------------------------- */

const FROZEN_CANDIDATE003_RECIPE_ID = 'mlb-v1-inner-candidate-003';
const FROZEN_CANDIDATE003_RECIPE_FINGERPRINT =
  'ce35df51cdf38ed9bf91aa2fb78871443f259c963d8c2700e8b6fe5d960a95bc';

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('mlb-shadow-monitoring-operational-projection', () => {
  describe('builder-owned candidate provenance', () => {
    it('candidate provenance is builder-owned (frozen constants)', () => {
      const input: MLBShadowPredictionOperationalRecordInput = {
        shadowRecordId: 'synthetic-shadow-001',
        gamePk: 990000001,
        pipelineStatus: 'COMPLETED',
      };

      const result = buildMLBShadowPredictionOperationalRecord(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sourceCandidateRecipeId).toBe(FROZEN_CANDIDATE003_RECIPE_ID);
        expect(result.value.sourceCandidateFingerprint).toBe(
          FROZEN_CANDIDATE003_RECIPE_FINGERPRINT,
        );
      }
    });
  });

  describe('candidate cannot be injected by caller', () => {
    it('candidate-999 cannot be injected via input override', () => {
      const maliciousInput = {
        shadowRecordId: 'synthetic-shadow-001',
        sourceCandidateRecipeId: 'candidate-999',
        sourceCandidateFingerprint: '0000000000000000000000000000000000000000000000000000000000000000',
        featureManifestId: 'fake-manifest',
        featureManifestFingerprint: 'fake-fingerprint',
      } as unknown as MLBShadowPredictionOperationalRecordInput;

      const result = buildMLBShadowPredictionOperationalRecord(maliciousInput);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sourceCandidateRecipeId).toBe(FROZEN_CANDIDATE003_RECIPE_ID);
        expect(result.value.sourceCandidateFingerprint).toBe(
          FROZEN_CANDIDATE003_RECIPE_FINGERPRINT,
        );
      }
    });

    it('candidate recipe id and fingerprint are never null even with empty input', () => {
      const result = buildMLBShadowPredictionOperationalRecord({});
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sourceCandidateRecipeId).toBe(FROZEN_CANDIDATE003_RECIPE_ID);
        expect(result.value.sourceCandidateFingerprint).toBe(
          FROZEN_CANDIDATE003_RECIPE_FINGERPRINT,
        );
      }
    });
  });

  describe('no sensitive prediction fields exposed', () => {
    const FORBIDDEN_FIELDS = [
      'predictedWinner',
      'predictedSide',
      'predictedTeamId',
      'probabilities',
      'decisionPolicy',
      'payloadHash',
      'predictionPayloadHash',
      'modelFingerprint',
      'modelSha256',
      'resultPayloadHash',
      'outcome',
      'scores',
      'correctness',
      'accuracy',
      'brier',
      'logLoss',
      'calibration',
      'performance',
      'roi',
    ];

    it('no sensitive prediction/digest/outcome/performance fields in record', () => {
      const input: MLBShadowPredictionOperationalRecordInput = {
        shadowRecordId: 'synthetic-shadow-001',
        gamePk: 990000001,
        pipelineStatus: 'COMPLETED',
      };

      const result = buildMLBShadowPredictionOperationalRecord(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const recordKeys = Object.keys(result.value);
        for (const field of FORBIDDEN_FIELDS) {
          expect(recordKeys).not.toContain(field);
        }
      }
    });

    it('no model fingerprint in record', () => {
      const result = buildMLBShadowPredictionOperationalRecord({
        shadowRecordId: 'synthetic-shadow-001',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).not.toHaveProperty('modelFingerprint');
        expect(result.value).not.toHaveProperty('modelSha256');
      }
    });

    it('no payload hash in record', () => {
      const result = buildMLBShadowPredictionOperationalRecord({
        shadowRecordId: 'synthetic-shadow-001',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).not.toHaveProperty('payloadHash');
        expect(result.value).not.toHaveProperty('predictionPayloadHash');
        expect(result.value).not.toHaveProperty('resultPayloadHash');
      }
    });

    it('no outcome/performance fields in record', () => {
      const result = buildMLBShadowPredictionOperationalRecord({
        shadowRecordId: 'synthetic-shadow-001',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).not.toHaveProperty('outcome');
        expect(result.value).not.toHaveProperty('scores');
        expect(result.value).not.toHaveProperty('correctness');
        expect(result.value).not.toHaveProperty('accuracy');
        expect(result.value).not.toHaveProperty('brier');
        expect(result.value).not.toHaveProperty('logLoss');
        expect(result.value).not.toHaveProperty('calibration');
        expect(result.value).not.toHaveProperty('performance');
        expect(result.value).not.toHaveProperty('roi');
      }
    });

    it('combined operational and sensitive return = NO', () => {
      const result = buildMLBShadowPredictionOperationalRecord({
        shadowRecordId: 'synthetic-shadow-001',
        gamePk: 990000001,
        pipelineStatus: 'COMPLETED',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const recordKeys = Object.keys(result.value);
        const hasSensitive = FORBIDDEN_FIELDS.some((f) => recordKeys.includes(f));
        const hasOperational = recordKeys.includes('contractVersion') && recordKeys.includes('mode');
        // Should have operational metadata but NOT sensitive fields
        expect(hasOperational).toBe(true);
        expect(hasSensitive).toBe(false);
      }
    });
  });

  describe('locked scientific policy', () => {
    it('S1_OPERATIONAL_BLIND + scientificUse NONE + all eligibility flags false', () => {
      const result = buildMLBShadowPredictionOperationalRecord({
        shadowRecordId: 'synthetic-shadow-001',
        gamePk: 990000001,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.contractVersion).toBe(
          'mlb-shadow-monitoring-operational-record-v1',
        );
        expect(result.value.mode).toBe(
          MLB_SHADOW_MONITORING_OPERATIONAL_MODE_S1_OPERATIONAL_BLIND,
        );
        expect(result.value.scientificUse).toBe(
          MLB_SHADOW_MONITORING_SCIENTIFIC_USE_NONE,
        );
        expect(result.value.isProspectiveHoldoutEvidence).toBe(false);
        expect(result.value.eligibleForFutureValidation).toBe(false);
        expect(result.value.eligibleForFutureTest).toBe(false);
      }
    });

    it('frozen locks are set even with fully empty input', () => {
      const result = buildMLBShadowPredictionOperationalRecord({});
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.mode).toBe(
          MLB_SHADOW_MONITORING_OPERATIONAL_MODE_S1_OPERATIONAL_BLIND,
        );
        expect(result.value.scientificUse).toBe(
          MLB_SHADOW_MONITORING_SCIENTIFIC_USE_NONE,
        );
        expect(result.value.isProspectiveHoldoutEvidence).toBe(false);
        expect(result.value.eligibleForFutureValidation).toBe(false);
        expect(result.value.eligibleForFutureTest).toBe(false);
      }
    });
  });
});
