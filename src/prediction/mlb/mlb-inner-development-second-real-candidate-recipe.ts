import type { MLBInnerCandidateRecipe } from '@/prediction/mlb/mlb-train-only-inner-development-evaluator';

export const MLB_INNER_DEVELOPMENT_SECOND_REAL_CANDIDATE_RECIPE_ID =
  'mlb-v1-inner-candidate-002';

export const MLB_INNER_DEVELOPMENT_SECOND_REAL_CANDIDATE_RECIPE_FINGERPRINT =
  'c1a0bbbbef214f99d434332a2ab172444468e78f9314b6c133d649b9e3d9c0cc';

export const MLB_INNER_DEVELOPMENT_SECOND_REAL_CANDIDATE_RECIPE =
  Object.freeze(
    {
      candidateRecipeId: MLB_INNER_DEVELOPMENT_SECOND_REAL_CANDIDATE_RECIPE_ID,
      preprocessingPolicyId:
        'raw-finite-feature-values-with-default-missing-v1',
      featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
      modelFamilyId: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
      regularizationConfig: Object.freeze({
        kind: 'L2',
        strength: 0.01,
      }),
      optimizerConfig: Object.freeze({
        solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
        learningRate: 0.01,
        maxIterations: 5000,
        tolerance: 0.0001,
      }),
      otherModelAffectingChoices: Object.freeze({}),
      complexityRank: 1,
    } satisfies MLBInnerCandidateRecipe,
  );
