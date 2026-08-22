import { describe, expect, it, vi, beforeEach } from 'vitest';
import path from 'node:path';

vi.mock('@/prediction/mlb/mlb-inner-development-candidate-orchestration', () => ({
  orchestrateMLBInnerDevelopmentCandidateExecution: vi.fn(),
}));

vi.mock('@/prediction/mlb/mlb-inner-development-train-artifact-provider', () => ({
  loadMLBInnerDevelopmentTrainArtifact: vi.fn(),
}));

import {
  orchestrateMLBInnerDevelopmentCandidateExecution,
} from '@/prediction/mlb/mlb-inner-development-candidate-orchestration';
import { loadMLBInnerDevelopmentTrainArtifact } from '@/prediction/mlb/mlb-inner-development-train-artifact-provider';

const orchestratorMock = vi.mocked(orchestrateMLBInnerDevelopmentCandidateExecution);
const providerMock = vi.mocked(loadMLBInnerDevelopmentTrainArtifact);

import {
  executeAuthorizedMLBInnerDevelopmentRealCandidate,
  type MLBInnerDevelopmentRealCandidateExecutionInput,
} from '@/prediction/mlb/mlb-inner-development-real-candidate-execution';
import { fitMLBInnerDevelopmentFold } from '@/prediction/mlb/mlb-inner-development-fold-fitter';
import {
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_REPOSITORY_PATH,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
} from '@/prediction/mlb/mlb-inner-development-train-artifact-runtime-provenance';
import type {
  MLBInnerDevelopmentCandidateOrchestrationInput,
  MLBInnerDevelopmentCandidateOrchestrationResult,
} from '@/prediction/mlb/mlb-inner-development-candidate-orchestration';
import type {
  MLBInnerDevelopmentTrainArtifactSourceConfig,
  MLBInnerDevelopmentTrainArtifactReader,
} from '@/prediction/mlb/mlb-inner-development-train-artifact-provider';

const TEST_REPO_ROOT = '/tmp/mre-real-binding-test';

function makeAuthorizedInput(
  overrides: Partial<MLBInnerDevelopmentRealCandidateExecutionInput> = {},
): MLBInnerDevelopmentRealCandidateExecutionInput {
  return {
    repositoryRoot: overrides.repositoryRoot ?? TEST_REPO_ROOT,
    candidateRecipeId: overrides.candidateRecipeId ?? 'test-recipe',
    attemptNumber: overrides.attemptNumber ?? 1,
    authorization: overrides.authorization ?? 'EXPLICIT_ONE_TIME_REAL_EXECUTION',
  };
}

function createMockFinalizedResult(): MLBInnerDevelopmentCandidateOrchestrationResult {
  return {
    ok: true,
    state: 'EXECUTION_FINALIZED',
    candidateRecipeId: 'test-recipe',
    attemptNumber: 1,
    finalTerminalStatus: 'COMPLETED_INNER_ELIGIBLE',
    executionResult: {
      ok: true,
      value: {
        ok: true,
        candidateRecipeId: 'test-recipe',
        verifiedArtifactSha256: 'sha',
        verifiedArtifactByteLength: 123,
        artifactId: 'aid',
        foldPlanId: 'fpid',
        foldResults: [],
        aggregate: {
          contractVersion: 'mlb-inner-aggregate-result-v1',
          candidateRecipeId: 'test-recipe',
          foldCount: 4,
          aggregateValidationRowCount: 301,
          aggregateCandidateLogLoss: 0.5,
          aggregateCandidateBrierScore: 0.3,
          aggregateCandidateRocAuc: 0.7,
          aggregateP50LogLoss: 0.4,
          aggregateP50BrierScore: 0.25,
          aggregateP50RocAuc: 0.65,
          aggregateFoldTrainPriorLogLoss: 0.45,
          aggregateFoldTrainPriorBrierScore: 0.28,
          aggregateFoldTrainPriorRocAuc: 0.68,
          worstFoldCandidateLogLoss: 0.6,
          worstFoldCandidateBrierScore: 0.35,
          foldsBeatingP50OnLogLoss: 2,
          foldsBeatingP50OnBrier: 2,
          foldsBeatingFoldTrainPriorOnLogLoss: 2,
          foldsBeatingFoldTrainPriorOnBrier: 2,
        },
        gate: {
          eligibility: 'INNER_ELIGIBLE',
          reasons: [],
        },
        lowLevelFitCount: 4,
      },
    },
  };
}

describe('Phase 8V-D3-C-E4-B4-I3A MLB inner development real candidate execution binding', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fails closed on invalid authorization without calling orchestrator/provider/fitter', async () => {
    const input = makeAuthorizedInput({ authorization: 'WRONG_TOKEN' });
    const result = await executeAuthorizedMLBInnerDevelopmentRealCandidate(input);

    expect(result).toEqual({
      ok: false,
      state: 'REAL_EXECUTION_NOT_AUTHORIZED',
      issues: [
        {
          code: 'REAL_EXECUTION_NOT_AUTHORIZED',
          path: '$.authorization',
          message: 'Explicit one-time real execution authorization is required',
        },
      ],
    });

    expect(orchestratorMock).not.toHaveBeenCalled();
    expect(providerMock).not.toHaveBeenCalled();
  });

  it('passes exact durable identity to orchestrator and binds real provider/fitter on valid authorization', async () => {
    const syntheticOrchestrationResult = createMockFinalizedResult();
    orchestratorMock.mockResolvedValue(syntheticOrchestrationResult);

    const input = makeAuthorizedInput();
    const result = await executeAuthorizedMLBInnerDevelopmentRealCandidate(input);

    expect(result).toEqual(syntheticOrchestrationResult);

    expect(orchestratorMock).toHaveBeenCalledTimes(1);
    const orchestrationInput = orchestratorMock.mock.calls[0][0] as MLBInnerDevelopmentCandidateOrchestrationInput;

    expect(orchestrationInput.repositoryRoot).toBe(TEST_REPO_ROOT);
    expect(orchestrationInput.candidateRecipeId).toBe('test-recipe');
    expect(orchestrationInput.attemptNumber).toBe(1);
    expect(typeof orchestrationInput.loadVerifiedTrainArtifact).toBe('function');
    expect(orchestrationInput.foldFitter).toBe(fitMLBInnerDevelopmentFold);
  });

  it('uses frozen artifact path and SHA in provider config when orchestrator invokes provider', async () => {
    const syntheticOrchestrationResult = createMockFinalizedResult();
    orchestratorMock.mockImplementation(async (orchestrationInput) => {
      const providerResult = await orchestrationInput.loadVerifiedTrainArtifact();
      return syntheticOrchestrationResult;
    });

    const input = makeAuthorizedInput();
    await executeAuthorizedMLBInnerDevelopmentRealCandidate(input);

    expect(providerMock).toHaveBeenCalledTimes(1);
    const providerArgs = providerMock.mock.calls[0];
    const config = providerArgs[0] as MLBInnerDevelopmentTrainArtifactSourceConfig;
    const reader = providerArgs[1] as MLBInnerDevelopmentTrainArtifactReader;

    expect(config.sourcePath).toBe(
      path.resolve(TEST_REPO_ROOT, MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_REPOSITORY_PATH),
    );
    expect(config.expectedArtifactSha256).toBe(
      MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
    );
    expect(typeof reader).toBe('function');
  });

  it('passes through CLAIM_FAILURE from orchestrator without retry', async () => {
    const claimFailureResult = {
      ok: false,
      state: 'CLAIM_FAILURE',
      issues: [
        {
          code: 'FAIL_CLOSED_CLAIM_INVARIANT_VIOLATION',
          path: '$.attempt',
          message: 'Attempt not in REGISTERED state',
        },
      ],
    } as const;

    orchestratorMock.mockResolvedValue(claimFailureResult);

    const input = makeAuthorizedInput();
    const result = await executeAuthorizedMLBInnerDevelopmentRealCandidate(input);

    expect(result).toEqual(claimFailureResult);
    expect(orchestratorMock).toHaveBeenCalledTimes(1);
  });
});
