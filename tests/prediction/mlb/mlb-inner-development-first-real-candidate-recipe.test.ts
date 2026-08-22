import { describe, expect, it } from 'vitest';
import {
  MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE,
  MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE_FINGERPRINT,
  MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE_ID,
} from '@/prediction/mlb/mlb-inner-development-first-real-candidate-recipe';
import {
  materializeMLBInnerDevelopmentCandidateRecipe,
} from '@/prediction/mlb/mlb-inner-development-candidate-materialization';
import {
  computeMLBInnerCandidateRecipeFingerprint,
} from '@/prediction/mlb/mlb-train-only-inner-development-evaluator';

describe('MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE', () => {
  it('1. exports a frozen recipe object', () => {
    expect(Object.isFrozen(MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE)).toBe(true);
  });

  it('2. exports the expected recipe id', () => {
    expect(MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE_ID).toBe(
      'mlb-v1-inner-candidate-001',
    );
  });

  it('3. recipe id matches the recipe', () => {
    expect(MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE.candidateRecipeId).toBe(
      MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE_ID,
    );
  });

  it('4. exact frozen recipe structure', () => {
    expect(MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE).toEqual({
      candidateRecipeId: 'mlb-v1-inner-candidate-001',
      preprocessingPolicyId:
        'raw-finite-feature-values-with-default-missing-v1',
      featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
      modelFamilyId: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
      regularizationConfig: {
        kind: 'L2',
        strength: 0.01,
      },
      optimizerConfig: {
        solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
        learningRate: 0.01,
        maxIterations: 1000,
        tolerance: 0.0001,
      },
      otherModelAffectingChoices: {},
      complexityRank: 1,
    });
  });

  it('5. canonical policy context', () => {
    const recipe = MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE;
    expect(recipe.preprocessingPolicyId).toBe(
      'raw-finite-feature-values-with-default-missing-v1',
    );
    expect(recipe.featurePolicyId).toBe(
      'mlb-real-pregame-winner-feature-policy-v1',
    );
    expect(recipe.modelFamilyId).toBe(
      'L2_LOGISTIC_REGRESSION_BINARY_V1',
    );
  });

  it('6. complexityRank is 1', () => {
    expect(MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE.complexityRank).toBe(1);
  });

  it('7. recipe is not caller-overridable', () => {
    expect(typeof MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE).toBe('object');
    expect(Object.isFrozen(MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE)).toBe(true);
  });

  it('8. recipe is not runtime-configurable', () => {
    expect(MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE.candidateRecipeId).not.toContain(
      'process.env',
    );
    expect(MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE.candidateRecipeId).not.toContain(
      'Math.random',
    );
  });

  it('9. pure materialization succeeds', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.materialized.configuration.algorithm).toBe(
        'L2_LOGISTIC_REGRESSION_BINARY_V1',
      );
      expect(result.materialized.configuration.regularization.kind).toBe('L2');
      expect(result.materialized.configuration.regularization.strength).toBe(0.01);
      expect(result.materialized.configuration.optimization.solver).toBe(
        'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
      );
      expect(result.materialized.configuration.optimization.learningRate).toBe(0.01);
      expect(result.materialized.configuration.optimization.maxIterations).toBe(1000);
      expect(result.materialized.configuration.optimization.tolerance).toBe(0.0001);
      expect(result.materialized.candidateRecipeId).toBe(
        MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE.candidateRecipeId,
      );
    }
  });

  it('10. deterministic fingerprint matches frozen value', () => {
    const fingerprintResult = computeMLBInnerCandidateRecipeFingerprint(
      MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE,
    );
    expect(fingerprintResult.ok).toBe(true);
    if (fingerprintResult.ok) {
      expect(fingerprintResult.fingerprint).toBe(
        MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE_FINGERPRINT,
      );
    }
  });

  it('11. fingerprint does not include candidateRecipeId', () => {
    const base = MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE;
    const mutated = {
      ...base,
      candidateRecipeId: 'mlb-v1-inner-candidate-002',
    };
    const baseFingerprint = computeMLBInnerCandidateRecipeFingerprint(base);
    const mutatedFingerprint = computeMLBInnerCandidateRecipeFingerprint(
      mutated as Parameters<typeof computeMLBInnerCandidateRecipeFingerprint>[0],
    );
    expect(baseFingerprint.ok).toBe(true);
    expect(mutatedFingerprint.ok).toBe(true);
    if (baseFingerprint.ok && mutatedFingerprint.ok) {
      expect(baseFingerprint.fingerprint).toBe(mutatedFingerprint.fingerprint);
    }
  });

  it('12. fingerprint does not include complexityRank', () => {
    const base = MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE;
    const mutated = {
      ...base,
      complexityRank: 2,
    };
    const baseFingerprint = computeMLBInnerCandidateRecipeFingerprint(base);
    const mutatedFingerprint = computeMLBInnerCandidateRecipeFingerprint(
      mutated as Parameters<typeof computeMLBInnerCandidateRecipeFingerprint>[0],
    );
    expect(baseFingerprint.ok).toBe(true);
    expect(mutatedFingerprint.ok).toBe(true);
    if (baseFingerprint.ok && mutatedFingerprint.ok) {
      expect(baseFingerprint.fingerprint).toBe(mutatedFingerprint.fingerprint);
    }
  });
});
