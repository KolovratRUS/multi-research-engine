import { describe, expect, it } from 'vitest';
import {
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
} from '@/prediction/mlb/mlb-inner-development-third-real-candidate-recipe';
import {
  MLB_INNER_DEVELOPMENT_SECOND_REAL_CANDIDATE_RECIPE,
  MLB_INNER_DEVELOPMENT_SECOND_REAL_CANDIDATE_RECIPE_FINGERPRINT,
  MLB_INNER_DEVELOPMENT_SECOND_REAL_CANDIDATE_RECIPE_ID,
} from '@/prediction/mlb/mlb-inner-development-second-real-candidate-recipe';
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

describe('MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE', () => {
  it('1. exports a frozen recipe object', () => {
    expect(Object.isFrozen(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE)).toBe(true);
  });

  it('2. exports the expected recipe id', () => {
    expect(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID).toBe(
      'mlb-v1-inner-candidate-003',
    );
  });

  it('3. recipe id matches the recipe', () => {
    expect(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE.candidateRecipeId).toBe(
      MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
    );
  });

  it('4. exact frozen recipe structure', () => {
    expect(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE).toEqual({
      candidateRecipeId: 'mlb-v1-inner-candidate-003',
      preprocessingPolicyId:
        'raw-finite-feature-values-with-default-missing-v1',
      featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
      modelFamilyId: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
      regularizationConfig: {
        kind: 'L2',
        strength: 0.1,
      },
      optimizerConfig: {
        solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
        learningRate: 0.01,
        maxIterations: 5000,
        tolerance: 0.0001,
      },
      otherModelAffectingChoices: {},
      complexityRank: 1,
    });
  });

  it('5. canonical policy context', () => {
    const recipe = MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE;
    expect(recipe.preprocessingPolicyId).toBe(
      'raw-finite-feature-values-with-default-missing-v1',
    );
    expect(recipe.featurePolicyId).toBe(
      'mlb-real-pregame-winner-feature-policy-v1',
    );
    expect(recipe.modelFamilyId).toBe('L2_LOGISTIC_REGRESSION_BINARY_V1');
  });

  it('6. complexityRank is 1', () => {
    expect(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE.complexityRank).toBe(1);
  });

  it('7. recipe is not caller-overridable', () => {
    expect(typeof MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE).toBe('object');
    expect(Object.isFrozen(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE)).toBe(true);
  });

  it('8. recipe is not runtime-configurable', () => {
    expect(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE.candidateRecipeId).not.toContain(
      'process.env',
    );
    expect(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE.candidateRecipeId).not.toContain(
      'Math.random',
    );
  });

  it('9. pure materialization succeeds', () => {
    const result = materializeMLBInnerDevelopmentCandidateRecipe(
      MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.materialized.configuration.algorithm).toBe(
        'L2_LOGISTIC_REGRESSION_BINARY_V1',
      );
      expect(result.materialized.configuration.regularization.kind).toBe('L2');
      expect(result.materialized.configuration.regularization.strength).toBe(0.1);
      expect(result.materialized.configuration.optimization.solver).toBe(
        'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
      );
      expect(result.materialized.configuration.optimization.learningRate).toBe(0.01);
      expect(result.materialized.configuration.optimization.maxIterations).toBe(5000);
      expect(result.materialized.configuration.optimization.tolerance).toBe(0.0001);
      expect(result.materialized.candidateRecipeId).toBe(
        MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE.candidateRecipeId,
      );
    }
  });

  it('10. deterministic fingerprint matches frozen value', () => {
    const fingerprintResult = computeMLBInnerCandidateRecipeFingerprint(
      MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE,
    );
    expect(fingerprintResult.ok).toBe(true);
    if (fingerprintResult.ok) {
      expect(fingerprintResult.fingerprint).toBe(
        MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
      );
    }
  });

  it('11. fingerprint does not include candidateRecipeId', () => {
    const base = MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE;
    const mutated = {
      ...base,
      candidateRecipeId: 'mlb-v1-inner-candidate-004',
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
    const base = MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE;
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

  it('13. only regularizationConfig.strength differs from candidate 002', () => {
    const candidate002 = MLB_INNER_DEVELOPMENT_SECOND_REAL_CANDIDATE_RECIPE;
    const candidate003 = MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE;

    expect(candidate003.preprocessingPolicyId).toBe(
      candidate002.preprocessingPolicyId,
    );
    expect(candidate003.featurePolicyId).toBe(candidate002.featurePolicyId);
    expect(candidate003.modelFamilyId).toBe(candidate002.modelFamilyId);
    expect(candidate003.regularizationConfig).not.toEqual(
      candidate002.regularizationConfig,
    );
    expect(candidate003.optimizerConfig.solver).toBe(
      candidate002.optimizerConfig.solver,
    );
    expect(candidate003.optimizerConfig.learningRate).toBe(
      candidate002.optimizerConfig.learningRate,
    );
    expect(candidate003.optimizerConfig.maxIterations).toBe(
      candidate002.optimizerConfig.maxIterations,
    );
    expect(candidate003.optimizerConfig.tolerance).toBe(
      candidate002.optimizerConfig.tolerance,
    );
    expect(candidate003.otherModelAffectingChoices).toEqual(
      candidate002.otherModelAffectingChoices,
    );
    expect(candidate003.complexityRank).toBe(candidate002.complexityRank);
  });

  it('14. optimizer is identical to candidate 002', () => {
    const candidate002 = MLB_INNER_DEVELOPMENT_SECOND_REAL_CANDIDATE_RECIPE;
    const candidate003 = MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE;

    expect(candidate003.optimizerConfig).toEqual(candidate002.optimizerConfig);
    expect(candidate003.optimizerConfig.maxIterations).toBe(5000);
    expect(candidate002.optimizerConfig.maxIterations).toBe(5000);
  });

  it('15. fingerprints are distinct from candidate 001 and 002', () => {
    expect(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT).not.toBe(
      MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE_FINGERPRINT,
    );
    expect(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT).not.toBe(
      MLB_INNER_DEVELOPMENT_SECOND_REAL_CANDIDATE_RECIPE_FINGERPRINT,
    );
  });
});
