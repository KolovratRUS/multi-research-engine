import {
  registerMLBInnerDevelopmentCampaignCandidate,
  type MLBInnerDevelopmentCampaignRegistrationResult,
} from './mlb-inner-development-campaign-registration';
import {
  MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE,
} from './mlb-inner-development-first-real-candidate-recipe';

export const MLB_INNER_DEVELOPMENT_REAL_REGISTRATION_AUTHORIZATION =
  'EXPLICIT_ONE_TIME_REAL_REGISTRATION' as const;

export type MLBInnerDevelopmentRealCandidateRegistrationInput = Readonly<{
  repositoryRoot: string;
  registrationTimestamp: string;
  attemptTimestamp: string;
  authorization: string;
}>;

export type MLBInnerDevelopmentRealCandidateRegistrationResult =
  | Readonly<{
      ok: false;
      state: 'REAL_REGISTRATION_NOT_AUTHORIZED';
      issues: readonly Readonly<{ code: string; path: string; message: string }>[];
    }>
  | MLBInnerDevelopmentCampaignRegistrationResult;

export async function registerAuthorizedMLBInnerDevelopmentFirstRealCandidate(
  input: MLBInnerDevelopmentRealCandidateRegistrationInput,
): Promise<MLBInnerDevelopmentRealCandidateRegistrationResult> {
  if (input.authorization !== MLB_INNER_DEVELOPMENT_REAL_REGISTRATION_AUTHORIZATION) {
    return {
      ok: false,
      state: 'REAL_REGISTRATION_NOT_AUTHORIZED',
      issues: [
        {
          code: 'REAL_REGISTRATION_NOT_AUTHORIZED',
          path: '$.authorization',
          message: 'Explicit one-time real registration authorization is required',
        },
      ],
    };
  }

  return registerMLBInnerDevelopmentCampaignCandidate(input.repositoryRoot, {
    candidateRecipe: MLB_INNER_DEVELOPMENT_FIRST_REAL_CANDIDATE_RECIPE,
    registrationTimestamp: input.registrationTimestamp,
    attemptTimestamp: input.attemptTimestamp,
  });
}
