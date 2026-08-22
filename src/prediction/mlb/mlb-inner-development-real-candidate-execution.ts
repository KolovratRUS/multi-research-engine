import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  orchestrateMLBInnerDevelopmentCandidateExecution,
  type MLBInnerDevelopmentCandidateOrchestrationInput,
  type MLBInnerDevelopmentCandidateOrchestrationResult,
  type MLBInnerDevelopmentVerifiedTrainArtifactProvider,
} from './mlb-inner-development-candidate-orchestration';
import {
  loadMLBInnerDevelopmentTrainArtifact,
  type MLBInnerDevelopmentTrainArtifactSourceConfig,
  type MLBInnerDevelopmentTrainArtifactReader,
  type MLBInnerDevelopmentTrainArtifactProviderResult,
} from './mlb-inner-development-train-artifact-provider';
import {
  type MLBInnerDevelopmentCandidateFoldFitter,
} from './mlb-inner-development-candidate-execution';
import {
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_REPOSITORY_PATH,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
} from './mlb-inner-development-train-artifact-runtime-provenance';
import { fitMLBInnerDevelopmentFold } from './mlb-inner-development-fold-fitter';

export type MLBInnerDevelopmentRealCandidateExecutionInput = Readonly<{
  repositoryRoot: string;
  candidateRecipeId: string;
  attemptNumber: number;
  authorization: string;
}>;

export type MLBInnerDevelopmentRealCandidateExecutionResult =
  | Readonly<{
      ok: false;
      state: 'REAL_EXECUTION_NOT_AUTHORIZED';
      issues: readonly Readonly<{ code: string; path: string; message: string }>[];
    }>
  | MLBInnerDevelopmentCandidateOrchestrationResult;

export async function executeAuthorizedMLBInnerDevelopmentRealCandidate(
  input: MLBInnerDevelopmentRealCandidateExecutionInput,
): Promise<MLBInnerDevelopmentRealCandidateExecutionResult> {
  if (input.authorization !== 'EXPLICIT_ONE_TIME_REAL_EXECUTION') {
    return {
      ok: false,
      state: 'REAL_EXECUTION_NOT_AUTHORIZED',
      issues: [
        {
          code: 'REAL_EXECUTION_NOT_AUTHORIZED',
          path: '$.authorization',
          message: 'Explicit one-time real execution authorization is required',
        },
      ],
    };
  }

  const frozenSourceConfig: MLBInnerDevelopmentTrainArtifactSourceConfig = {
    sourcePath: path.resolve(
      input.repositoryRoot,
      MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_REPOSITORY_PATH,
    ),
    expectedArtifactSha256: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
  };

  const reader: MLBInnerDevelopmentTrainArtifactReader = async (sourcePath: string) =>
    fs.readFile(sourcePath);

  const loadVerifiedTrainArtifact: MLBInnerDevelopmentVerifiedTrainArtifactProvider = async () =>
    loadMLBInnerDevelopmentTrainArtifact(frozenSourceConfig, reader);

  const foldFitter: MLBInnerDevelopmentCandidateFoldFitter = fitMLBInnerDevelopmentFold;

  const orchestrationInput: MLBInnerDevelopmentCandidateOrchestrationInput = {
    repositoryRoot: input.repositoryRoot,
    candidateRecipeId: input.candidateRecipeId,
    attemptNumber: input.attemptNumber,
    loadVerifiedTrainArtifact,
    foldFitter,
  };

  return orchestrateMLBInnerDevelopmentCandidateExecution(orchestrationInput);
}
