import {
  registerMLBInnerDevelopmentCampaignCandidate,
  type MLBInnerDevelopmentCampaignRegistrationResult,
} from './mlb-inner-development-campaign-registration';
import {
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
} from './mlb-inner-development-third-real-candidate-recipe';

export const MLB_INNER_DEVELOPMENT_THIRD_REAL_REGISTRATION_AUTHORIZATION =
  'EXPLICIT_ONE_TIME_REAL_THIRD_CANDIDATE_REGISTRATION' as const;

export type MLBInnerDevelopmentThirdRealCandidateRegistrationInput =
  Readonly<{
    repositoryRoot: string;
    registrationTimestamp: string;
    attemptTimestamp: string;
    authorization: string;
  }>;

export type MLBInnerDevelopmentThirdRealCandidateRegistrationResult =
  | Readonly<{
      ok: false;
      state: 'REAL_REGISTRATION_NOT_AUTHORIZED';
      issues: readonly Readonly<{ code: string; path: string; message: string }>[];
    }>
  | MLBInnerDevelopmentCampaignRegistrationResult;

export async function registerAuthorizedMLBInnerDevelopmentThirdRealCandidate(
  input: MLBInnerDevelopmentThirdRealCandidateRegistrationInput,
): Promise<MLBInnerDevelopmentThirdRealCandidateRegistrationResult> {
  if (input.authorization !== MLB_INNER_DEVELOPMENT_THIRD_REAL_REGISTRATION_AUTHORIZATION) {
    return {
      ok: false,
      state: 'REAL_REGISTRATION_NOT_AUTHORIZED',
      issues: [
        {
          code: 'REAL_REGISTRATION_NOT_AUTHORIZED',
          path: '$.authorization',
          message: 'Explicit one-time real third-candidate registration authorization is required',
        },
      ],
    };
  }

  return registerMLBInnerDevelopmentCampaignCandidate(input.repositoryRoot, {
    candidateRecipe: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE,
    registrationTimestamp: input.registrationTimestamp,
    attemptTimestamp: input.attemptTimestamp,
  });
}
