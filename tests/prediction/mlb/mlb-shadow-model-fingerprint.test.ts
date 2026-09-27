import { describe, expect, it } from 'vitest';
import {
  MLB_SHADOW_MODEL_FINGERPRINT_CONTRACT_VERSION,
  MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256,
  computeMLBShadowModelFingerprint,
  verifyMLBShadowCandidate003AuthoritativeModel,
} from '@/prediction/mlb/mlb-shadow-model-fingerprint';
import {
  MLB_LOGISTIC_REGRESSION_MODEL_CONTRACT_VERSION,
  type MLBDeterministicLogisticRegressionModel,
} from '@/prediction/mlb/mlb-logistic-regression-fit-contract';

/* -------------------------------------------------------------------------- */
/*  Synthetic structurally valid model builder                               */
/* -------------------------------------------------------------------------- */

/**
 * A synthetic model that is structurally valid (passes
 * validateMLBDeterministicLogisticRegressionModel) but is NOT the
 * frozen candidate-003 model. Used for all non-freeze tests.
 */
function buildValidSyntheticModel(
  overrides: Partial<MLBDeterministicLogisticRegressionModel> = {},
): MLBDeterministicLogisticRegressionModel {
  return {
    contractVersion: MLB_LOGISTIC_REGRESSION_MODEL_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    modelId: 'synthetic-model-001',
    planId: 'synthetic-plan-001',
    matrixId: 'synthetic-matrix-001',
    configId: 'synthetic-config-001',
    manifestId: 'synthetic-manifest-001',
    datasetId: 'synthetic-dataset-001',
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    featureIds: ['feat_a', 'feat_b'],
    intercept: 0.123,
    coefficients: [
      {
        featureId: 'feat_a',
        valueCoefficient: 0.456,
        missingIndicatorCoefficient: 0.001,
      },
      {
        featureId: 'feat_b',
        valueCoefficient: -0.789,
        missingIndicatorCoefficient: 0.002,
      },
    ],
    trainingRowCount: 360,
    iterationsCompleted: 50,
    converged: true,
    finalTrainingObjective: 0.312,
    ...overrides,
  } as MLBDeterministicLogisticRegressionModel;
}

function deepCloneModel(
  model: MLBDeterministicLogisticRegressionModel,
): MLBDeterministicLogisticRegressionModel {
  return JSON.parse(JSON.stringify(model)) as MLBDeterministicLogisticRegressionModel;
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('mlb-shadow-model-fingerprint', () => {
  describe('computeMLBShadowModelFingerprint', () => {
    it('same object => same hash', () => {
      const model = buildValidSyntheticModel();
      const hash1 = computeMLBShadowModelFingerprint(model);
      const hash2 = computeMLBShadowModelFingerprint(model);
      expect(hash1).toBe(hash2);
    });

    it('identical clone => same hash', () => {
      const model = buildValidSyntheticModel();
      const hash1 = computeMLBShadowModelFingerprint(model);
      const clone = deepCloneModel(model);
      const hash2 = computeMLBShadowModelFingerprint(clone);
      expect(hash1).toBe(hash2);
    });

    it('coefficient mutation => different hash', () => {
      const model = buildValidSyntheticModel();
      const baseHash = computeMLBShadowModelFingerprint(model);
      const mutated = buildValidSyntheticModel({
        coefficients: [
          { featureId: 'feat_a', valueCoefficient: 0.457, missingIndicatorCoefficient: 0.001 },
          { featureId: 'feat_b', valueCoefficient: -0.789, missingIndicatorCoefficient: 0.002 },
        ],
      });
      const mutatedHash = computeMLBShadowModelFingerprint(mutated);
      expect(mutatedHash).not.toBe(baseHash);
    });

    it('intercept mutation => different hash', () => {
      const model = buildValidSyntheticModel();
      const baseHash = computeMLBShadowModelFingerprint(model);
      const mutated = buildValidSyntheticModel({ intercept: 0.124 });
      const mutatedHash = computeMLBShadowModelFingerprint(mutated);
      expect(mutatedHash).not.toBe(baseHash);
    });

    it('feature identity mutation => different hash', () => {
      const model = buildValidSyntheticModel();
      const baseHash = computeMLBShadowModelFingerprint(model);
      const mutated = buildValidSyntheticModel({
        coefficients: [
          { featureId: 'feat_X', valueCoefficient: 0.456, missingIndicatorCoefficient: 0.001 },
          { featureId: 'feat_b', valueCoefficient: -0.789, missingIndicatorCoefficient: 0.002 },
        ],
      });
      const mutatedHash = computeMLBShadowModelFingerprint(mutated);
      expect(mutatedHash).not.toBe(baseHash);
    });

    it('modelId mutation => different hash', () => {
      const model = buildValidSyntheticModel();
      const baseHash = computeMLBShadowModelFingerprint(model);
      const mutated = buildValidSyntheticModel({ modelId: 'synthetic-model-099' });
      const mutatedHash = computeMLBShadowModelFingerprint(mutated);
      expect(mutatedHash).not.toBe(baseHash);
    });

    it('matrixId mutation => different hash', () => {
      const model = buildValidSyntheticModel();
      const baseHash = computeMLBShadowModelFingerprint(model);
      const mutated = buildValidSyntheticModel({ matrixId: 'synthetic-matrix-099' });
      const mutatedHash = computeMLBShadowModelFingerprint(mutated);
      expect(mutatedHash).not.toBe(baseHash);
    });

    it('NaN coefficient => reject', () => {
      const model = buildValidSyntheticModel({
        coefficients: [
          { featureId: 'feat_a', valueCoefficient: Number.NaN, missingIndicatorCoefficient: 0.001 },
          { featureId: 'feat_b', valueCoefficient: -0.789, missingIndicatorCoefficient: 0.002 },
        ],
      });
      expect(() => computeMLBShadowModelFingerprint(model)).toThrow();
    });

    it('Infinity intercept => reject', () => {
      const model = buildValidSyntheticModel({ intercept: Infinity });
      expect(() => computeMLBShadowModelFingerprint(model)).toThrow();
    });

    it('negative zero intercept => reject', () => {
      const model = buildValidSyntheticModel({ intercept: -0 });
      expect(() => computeMLBShadowModelFingerprint(model)).toThrow();
    });

    it('hash format => lowercase 64-char hex', () => {
      const model = buildValidSyntheticModel();
      const hash = computeMLBShadowModelFingerprint(model);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(hash).toBe(hash.toLowerCase());
    });

    it('fingerprint contract version constant is frozen string', () => {
      expect(MLB_SHADOW_MODEL_FINGERPRINT_CONTRACT_VERSION).toBe(
        'mlb-shadow-model-fingerprint-v1',
      );
    });
  });

  describe('verifyMLBShadowCandidate003AuthoritativeModel', () => {
    it('frozen constant exactly equals the authoritative hash', () => {
      expect(MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256).toBe(
        '547fac8e2319a8ed33d1263a7e5feb4729aeecab553484cbc3218992528803cf',
      );
    });

    it('synthetic model is NOT the frozen candidate (fail-closed)', () => {
      const model = buildValidSyntheticModel();
      expect(verifyMLBShadowCandidate003AuthoritativeModel(model)).toBe(false);
    });

    it('different modelId is rejected', () => {
      const model = buildValidSyntheticModel();
      expect(verifyMLBShadowCandidate003AuthoritativeModel(model)).toBe(false);
    });

    it('invalid model (NaN) is rejected without throwing', () => {
      const model = buildValidSyntheticModel({
        coefficients: [
          { featureId: 'feat_a', valueCoefficient: Number.NaN, missingIndicatorCoefficient: 0.001 },
          { featureId: 'feat_b', valueCoefficient: -0.789, missingIndicatorCoefficient: 0.002 },
        ],
      });
      expect(() => verifyMLBShadowCandidate003AuthoritativeModel(model)).not.toThrow();
      expect(verifyMLBShadowCandidate003AuthoritativeModel(model)).toBe(false);
    });

    it('invalid model (Infinity) is rejected without throwing', () => {
      const model = buildValidSyntheticModel({ intercept: Infinity });
      expect(() => verifyMLBShadowCandidate003AuthoritativeModel(model)).not.toThrow();
      expect(verifyMLBShadowCandidate003AuthoritativeModel(model)).toBe(false);
    });

    it('invalid model (negative zero) is rejected without throwing', () => {
      const model = buildValidSyntheticModel({ intercept: -0 });
      expect(() => verifyMLBShadowCandidate003AuthoritativeModel(model)).not.toThrow();
      expect(verifyMLBShadowCandidate003AuthoritativeModel(model)).toBe(false);
    });
  });
});
