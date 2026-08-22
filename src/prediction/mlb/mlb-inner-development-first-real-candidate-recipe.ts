import type { MLBInnerCandidateRecipe } from '@/prediction/mlb/mlb-train-only-inner-development-evaluator';

export const MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE_ID =
  'mlb-v1-inner-candidate-001';

export const MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE_FINGERPRINT =
  'f812c40cb3b375b3a201cfc6b001154db21ce4a8052bb5782238ab9b32f0fed2';

export const MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE =
  Object.freeze(
    {
      candidateRecipeId: MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE_ID,
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
        maxIterations: 1000,
        tolerance: 0.0001,
      }),
      otherModelAffectingChoices: Object.freeze({}),
      complexityRank: 1,
    } satisfies MLBInnerCandidateRecipe,
  );
