import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/prediction/mlb/mlb-inner-development-campaign-registration', () => ({
  registerMLBInnerDevelopmentCampaignCandidate: vi.fn(),
}));

import {
  registerMLBInnerDevelopmentCampaignCandidate,
} from '@/prediction/mlb/mlb-inner-development-campaign-registration';

const registrationMock = vi.mocked(registerMLBInnerDevelopmentCampaignCandidate);

import {
  registerAuthorizedMLBInnerDevelopmentFirstRealCandidate,
  MLB_INNER_DEVELOPMENT_REAL_REGISTRATION_AUTHORIZATION,
  type MLBInnerDevelopmentRealCandidateRegistrationInput,
} from '@/prediction/mlb/mlb-inner-development-real-candidate-registration';
import {
  MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE,
  MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE_ID,
  MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE_FINGERPRINT,
} from '@/prediction/mlb/mlb-inner-development-first-real-candidate-recipe';

const TEST_REPO_ROOT = '/tmp/mre-real-registration-test';

function makeInput(
  overrides: Partial<MLBInnerDevelopmentRealCandidateRegistrationInput> = {},
): MLBInnerDevelopmentRealCandidateRegistrationInput {
  return {
    repositoryRoot: overrides.repositoryRoot ?? TEST_REPO_ROOT,
    registrationTimestamp: overrides.registrationTimestamp ?? '2026-04-01T00:00:00.000Z',
    attemptTimestamp: overrides.attemptTimestamp ?? '2026-04-01T00:00:00.000Z',
    authorization: overrides.authorization ?? MLB_INNER_DEVELOPMENT_REAL_REGISTRATION_AUTHORIZATION,
  };
}

describe('Phase 8V-D3-C-E4-B4-I3B-B MLB inner development real candidate registration guard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('1. invalid authorization fails closed without calling generic registration', async () => {
    const input = makeInput({ authorization: 'WRONG_TOKEN' });
    const result = await registerAuthorizedMLBInnerDevelopmentFirstRealCandidate(input);

    expect(result).toEqual({
      ok: false,
      state: 'REAL_REGISTRATION_NOT_AUTHORIZED',
      issues: [
        {
          code: 'REAL_REGISTRATION_NOT_AUTHORIZED',
          path: '$.authorization',
          message: 'Explicit one-time real registration authorization is required',
        },
      ],
    });

    expect(registrationMock).not.toHaveBeenCalled();
  });

  it('2. authorized call invokes generic registration exactly once with frozen recipe', async () => {
    registrationMock.mockResolvedValue({
      ok: true,
      value: {
        candidateRecipeId: MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE_ID,
        recipeFingerprint: MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE_FINGERPRINT,
        registrationSequence: 1,
        attemptNumber: 1,
        distinctRecipeCount: 1,
        evaluationCount: 1,
      },
    });

    const input = makeInput();
    const result = await registerAuthorizedMLBInnerDevelopmentFirstRealCandidate(input);

    expect(registrationMock).toHaveBeenCalledTimes(1);
    const [repositoryRoot, genericInput] = registrationMock.mock.calls[0] as [
      string,
      {
        candidateRecipe: typeof MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE;
        registrationTimestamp: string;
        attemptTimestamp: string;
      },
    ];

    expect(repositoryRoot).toBe(TEST_REPO_ROOT);
    expect(genericInput.candidateRecipe).toBe(MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE);
    expect(genericInput.candidateRecipe).toEqual({
      candidateRecipeId: MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE_ID,
      preprocessingPolicyId: 'raw-finite-feature-values-with-default-missing-v1',
      featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
      modelFamilyId: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
      regularizationConfig: { kind: 'L2', strength: 0.01 },
      optimizerConfig: {
        solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
        learningRate: 0.01,
        maxIterations: 1000,
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
        candidateRecipeId: MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE_ID,
        recipeFingerprint: MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE_FINGERPRINT,
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
    const result = await registerAuthorizedMLBInnerDevelopmentFirstRealCandidate(input);

    expect(registrationMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual(syntheticFailure);
  });

  it('4. public input type does not expose recipe override fields', () => {
    const input = makeInput();
    const keys = Object.keys(input) as readonly (keyof MLBInnerDevelopmentRealCandidateRegistrationInput)[];

    expect(keys).toEqual(['repositoryRoot', 'registrationTimestamp', 'attemptTimestamp', 'authorization']);
  });
});
