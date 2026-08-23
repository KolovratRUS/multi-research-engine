import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/prediction/mlb/mlb-inner-development-campaign-registration', () => ({
  registerMLBInnerDevelopmentCampaignCandidate: vi.fn(),
}));

import {
  registerMLBInnerDevelopmentCampaignCandidate,
} from '@/prediction/mlb/mlb-inner-development-campaign-registration';

const registrationMock = vi.mocked(registerMLBInnerDevelopmentCampaignCandidate);

import {
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
} from '@/prediction/mlb/mlb-inner-development-third-real-candidate-recipe';
import {
  MLB_INNER_DEVELOPMENT_SECOND_REAL_CANDIDATE_RECIPE_ID,
  MLB_INNER_DEVELOPMENT_SECOND_REAL_CANDIDATE_RECIPE_FINGERPRINT,
} from '@/prediction/mlb/mlb-inner-development-second-real-candidate-recipe';
import {
  MLB_INNER_DEVELOPMENT_THIRD_REAL_REGISTRATION_AUTHORIZATION,
  registerAuthorizedMLBInnerDevelopmentThirdRealCandidate,
  type MLBInnerDevelopmentThirdRealCandidateRegistrationInput,
} from '@/prediction/mlb/mlb-inner-development-third-real-candidate-registration';
import {
  computeMLBInnerCandidateRecipeFingerprint,
} from '@/prediction/mlb/mlb-train-only-inner-development-evaluator';

const TEST_REPO_ROOT = '/tmp/mre-third-real-registration-test';

function makeInput(
  overrides: Partial<MLBInnerDevelopmentThirdRealCandidateRegistrationInput> = {},
): MLBInnerDevelopmentThirdRealCandidateRegistrationInput {
  return {
    repositoryRoot: overrides.repositoryRoot ?? TEST_REPO_ROOT,
    registrationTimestamp: overrides.registrationTimestamp ?? '2026-04-01T00:00:00.000Z',
    attemptTimestamp: overrides.attemptTimestamp ?? '2026-04-01T00:00:00.000Z',
    authorization: overrides.authorization ?? MLB_INNER_DEVELOPMENT_THIRD_REAL_REGISTRATION_AUTHORIZATION,
  };
}

describe('Phase 8V-D3-C-E4-B4-I3F-B MLB inner development third real candidate registration guard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('1. invalid authorization fails closed without calling generic registration', async () => {
    const input = makeInput({ authorization: 'WRONG_TOKEN' });
    const result = await registerAuthorizedMLBInnerDevelopmentThirdRealCandidate(input);

    expect(result).toEqual({
      ok: false,
      state: 'REAL_REGISTRATION_NOT_AUTHORIZED',
      issues: [
        {
          code: 'REAL_REGISTRATION_NOT_AUTHORIZED',
          path: '$.authorization',
          message: 'Explicit one-time real third-candidate registration authorization is required',
        },
      ],
    });

    expect(registrationMock).not.toHaveBeenCalled();
  });

  it('2. authorized call invokes generic registration exactly once with frozen recipe', async () => {
    registrationMock.mockResolvedValue({
      ok: true,
      value: {
        candidateRecipeId: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
        recipeFingerprint: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
        registrationSequence: 1,
        attemptNumber: 1,
        distinctRecipeCount: 1,
        evaluationCount: 1,
      },
    });

    const input = makeInput();
    const result = await registerAuthorizedMLBInnerDevelopmentThirdRealCandidate(input);

    expect(registrationMock).toHaveBeenCalledTimes(1);
    const [repositoryRoot, genericInput] = registrationMock.mock.calls[0] as [
      string,
      {
        candidateRecipe: typeof MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE;
        registrationTimestamp: string;
        attemptTimestamp: string;
      },
    ];

    expect(repositoryRoot).toBe(TEST_REPO_ROOT);
    expect(genericInput.candidateRecipe).toBe(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE);
    expect(genericInput.candidateRecipe).toEqual({
      candidateRecipeId: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
      preprocessingPolicyId: 'raw-finite-feature-values-with-default-missing-v1',
      featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
      modelFamilyId: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
      regularizationConfig: { kind: 'L2', strength: 0.1 },
      optimizerConfig: {
        solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
        learningRate: 0.01,
        maxIterations: 5000,
        tolerance: 0.0001,
      },
      otherModelAffectingChoices: {},
      complexityRank: 1,
    });
    expect(genericInput.registrationTimestamp).toBe('2026-04-01T00:00:00.000Z');
    expect(genericInput.attemptTimestamp).toBe('2026-04-01T00:00:00.000Z');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        candidateRecipeId: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
        recipeFingerprint: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
        registrationSequence: 1,
        attemptNumber: 1,
        distinctRecipeCount: 1,
        evaluationCount: 1,
      });
    }
  });

  it('3. passes through generic registration failure transparently', async () => {
    const syntheticFailure = {
      ok: false as const,
      state: 'FAIL_CLOSED_INVALID_LEDGER' as const,
      issues: [
        {
          code: 'FAIL_CLOSED_INVALID_LEDGER',
          path: '$',
          message: 'Uninitialized',
        },
      ],
    };

    registrationMock.mockResolvedValue(syntheticFailure);

    const input = makeInput();
    const result = await registerAuthorizedMLBInnerDevelopmentThirdRealCandidate(input);

    expect(registrationMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual(syntheticFailure);
  });

  it('4. public input type does not expose recipe override fields', () => {
    const input = makeInput();
    const keys = Object.keys(input) as readonly (keyof MLBInnerDevelopmentThirdRealCandidateRegistrationInput)[];

    expect(keys).toEqual(['repositoryRoot', 'registrationTimestamp', 'attemptTimestamp', 'authorization']);
  });

  it('5. candidate 003 fingerprint recomputes to expected constant', () => {
    const fingerprintResult = computeMLBInnerCandidateRecipeFingerprint(
      MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE,
    );
    expect(fingerprintResult.ok).toBe(true);
    if (fingerprintResult.ok) {
      expect(fingerprintResult.fingerprint).toBe(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT);
      expect(fingerprintResult.fingerprint).toBe('ce35df51cdf38ed9bf91aa2fb78871443f259c963d8c2700e8b6fe5d960a95bc');
    }
  });

  it('6. caller cannot redirect wrapper to candidate 001', async () => {
    const input = makeInput();
    const keys = Object.keys(input) as readonly string[];

    expect(keys).not.toContain('candidateRecipeId');
    expect(keys).not.toContain('recipeFingerprint');
    expect(keys).not.toContain('candidateRecipe');
    expect(keys).not.toContain('preprocessingPolicyId');
    expect(keys).not.toContain('featurePolicyId');
    expect(keys).not.toContain('modelFamilyId');
    expect(keys).not.toContain('regularizationConfig');
    expect(keys).not.toContain('optimizerConfig');
    expect(keys).not.toContain('otherModelAffectingChoices');
    expect(keys).not.toContain('complexityRank');

    registrationMock.mockResolvedValue({
      ok: true,
      value: {
        candidateRecipeId: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
        recipeFingerprint: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
        registrationSequence: 1,
        attemptNumber: 1,
        distinctRecipeCount: 1,
        evaluationCount: 1,
      },
    });

    const result = await registerAuthorizedMLBInnerDevelopmentThirdRealCandidate(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.candidateRecipeId).toBe(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID);
    }

    const [, genericInput] = registrationMock.mock.calls[0] as [
      string,
      {
        candidateRecipe: typeof MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE;
        registrationTimestamp: string;
        attemptTimestamp: string;
      },
    ];

    expect(genericInput.candidateRecipe.candidateRecipeId).toBe(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID);
    expect(genericInput.candidateRecipe.candidateRecipeId).not.toBe(MLB_INNER_DEVELOPMENT_SECOND_REAL_CANDIDATE_RECIPE_ID);
  });

  it('7. authorized wrapper passes candidate 003 as a new distinct recipe identity', async () => {
    registrationMock.mockResolvedValue({
      ok: true,
      value: {
        candidateRecipeId: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
        recipeFingerprint: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
        registrationSequence: 1,
        attemptNumber: 1,
        distinctRecipeCount: 1,
        evaluationCount: 1,
      },
    });

    const input = makeInput();
    const result = await registerAuthorizedMLBInnerDevelopmentThirdRealCandidate(input);

    expect(result.ok).toBe(true);
    expect(registrationMock).toHaveBeenCalledTimes(1);

    const [, genericInput] = registrationMock.mock.calls[0] as [
      string,
      {
        candidateRecipe: typeof MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE;
        registrationTimestamp: string;
        attemptTimestamp: string;
      },
    ];

    expect(genericInput.candidateRecipe.candidateRecipeId).toBe(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID);
    expect(genericInput.candidateRecipe).toBe(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE);
    expect(genericInput.candidateRecipe.regularizationConfig.strength).toBe(0.1);
  });

  it('8. duplicate complexityRank 1 is allowed for distinct recipes', () => {
    expect(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE.complexityRank).toBe(1);
    expect(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE.candidateRecipeId).not.toBe(MLB_INNER_DEVELOPMENT_SECOND_REAL_CANDIDATE_RECIPE_ID);
    expect(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT).not.toBe(MLB_INNER_DEVELOPMENT_SECOND_REAL_CANDIDATE_RECIPE_FINGERPRINT);
  });
});
