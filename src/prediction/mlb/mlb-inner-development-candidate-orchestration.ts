import {
  resumeMLBInnerDevelopmentCampaign,
  type MLBInnerDevelopmentCampaignResumeResult,
} from './mlb-inner-development-campaign-lifecycle';
import {
  MLB_INNER_DEVELOPMENT_CYCLE_ID,
  type MLBInnerCandidateRecipe,
} from './mlb-train-only-inner-development-evaluator';
import {
  materializeMLBInnerDevelopmentCandidateRecipe,
  type MLBInnerMaterializedCandidate,
} from './mlb-inner-development-candidate-materialization';
import type {
  MLBInnerDevelopmentTrainArtifactProviderResult,
} from './mlb-inner-development-train-artifact-provider';
import {
  prepareMLBInnerDevelopmentCandidateExecution,
  executeMLBInnerDevelopmentCandidate,
  type MLBInnerDevelopmentCandidatePreparationInput,
  type MLBInnerDevelopmentCandidatePreparationResult,
  type MLBInnerDevelopmentCandidatePreparationIssue,
  type MLBInnerDevelopmentCandidateExecutionResult,
  type MLBInnerDevelopmentCandidateExecutionInput,
  type MLBInnerDevelopmentCandidateFoldFitter,
} from './mlb-inner-development-candidate-execution';
import {
  claimMLBInnerDevelopmentAttemptForExecution,
  finalizeMLBInnerDevelopmentAttemptTerminal,
  type MLBInnerDevelopmentAttemptClaimInput,
  type MLBInnerDevelopmentAttemptClaimResult,
  type MLBInnerDevelopmentAttemptFinalizeInput,
  type MLBInnerDevelopmentAttemptFinalizeResult,
} from './mlb-inner-development-campaign-execution';
import type {
  MLBInnerDevelopmentAttemptExecutionProvenance,
} from './mlb-inner-development-campaign-ledger';

export type MLBInnerDevelopmentVerifiedTrainArtifactProvider = () =>
  Promise<MLBInnerDevelopmentTrainArtifactProviderResult>;

export type MLBInnerDevelopmentCandidateOrchestrationIssue = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

export type MLBInnerDevelopmentCandidateOrchestrationResult =
  | Readonly<{
      ok: false;
      state: 'PREPARATION_OR_CANONICAL_FAILURE';
      issues: readonly MLBInnerDevelopmentCandidateOrchestrationIssue[];
    }>
  | Readonly<{
      ok: false;
      state: 'CLAIM_FAILURE';
      issues: readonly MLBInnerDevelopmentCandidateOrchestrationIssue[];
    }>
  | Readonly<{
      ok: false;
      state: 'FINALIZE_FAILURE';
      issues: readonly MLBInnerDevelopmentCandidateOrchestrationIssue[];
    }>
  | Readonly<{
      ok: false;
      state: 'UNEXPECTED_EXECUTION_EXCEPTION_WITH_RUNNING_DURABLE';
      error: Error;
    }>
  | Readonly<{
      ok: true;
      state: 'EXECUTION_FINALIZED';
      candidateRecipeId: string;
      attemptNumber: number;
      finalTerminalStatus: 'COMPLETED_INNER_ELIGIBLE' | 'COMPLETED_INNER_REJECTED' | 'FAILED';
      executionResult: MLBInnerDevelopmentCandidateExecutionResult;
    }>;

export type MLBInnerDevelopmentCandidateOrchestrationInput = Readonly<{
  repositoryRoot: string;
  candidateRecipeId: string;
  attemptNumber: number;
  loadVerifiedTrainArtifact: MLBInnerDevelopmentVerifiedTrainArtifactProvider;
  foldFitter: MLBInnerDevelopmentCandidateFoldFitter;
}>;

function mapPreparationIssues(
  issues: readonly MLBInnerDevelopmentCandidatePreparationIssue[],
): readonly MLBInnerDevelopmentCandidateOrchestrationIssue[] {
  return issues.map((issue) => ({
    code: issue.code,
    path: issue.path,
    message: issue.message,
  }));
}

export async function orchestrateMLBInnerDevelopmentCandidateExecution(
  input: MLBInnerDevelopmentCandidateOrchestrationInput,
): Promise<MLBInnerDevelopmentCandidateOrchestrationResult> {
  const issues: MLBInnerDevelopmentCandidateOrchestrationIssue[] = [];

  const inspection = await resumeMLBInnerDevelopmentCampaign(
    input.repositoryRoot,
  );
  if (!inspection.ok || inspection.state !== 'READY') {
    if (!inspection.ok) {
      issues.push(
        ...inspection.issues.map((issue) => ({
          code: issue.code,
          path: issue.path,
          message: issue.message,
        })),
      );
    }
    return { ok: false, state: 'PREPARATION_OR_CANONICAL_FAILURE', issues };
  }

  const ledger = inspection.ledger;

  const registeredRecipe = ledger.registeredRecipes.find(
    (recipe) => recipe.candidateRecipeId === input.candidateRecipeId,
  );
  if (!registeredRecipe) {
    issues.push({
      code: 'UNREGISTERED_RECIPE_REFERENCE',
      path: '$.candidateRecipeId',
      message: `Unknown candidateRecipeId ${input.candidateRecipeId}`,
    });
    return { ok: false, state: 'PREPARATION_OR_CANONICAL_FAILURE', issues };
  }

  const attempt = ledger.attempts.find(
    (a) =>
      a.candidateRecipeId === input.candidateRecipeId &&
      a.attemptNumber === input.attemptNumber,
  );
  if (!attempt) {
    issues.push({
      code: 'MISSING_FIELD',
      path: '$.attempts',
      message: `Attempt ${input.attemptNumber} for ${input.candidateRecipeId} not found`,
    });
    return { ok: false, state: 'PREPARATION_OR_CANONICAL_FAILURE', issues };
  }

  if (attempt.status !== 'REGISTERED') {
    issues.push({
      code: 'INVALID_STATUS',
      path: '$.attempts',
      message: `Attempt ${input.attemptNumber} for ${input.candidateRecipeId} is ${attempt.status}, expected REGISTERED`,
    });
    return { ok: false, state: 'PREPARATION_OR_CANONICAL_FAILURE', issues };
  }

  const recipe: MLBInnerCandidateRecipe = {
    candidateRecipeId: registeredRecipe.candidateRecipeId,
    preprocessingPolicyId: registeredRecipe.preprocessingPolicyId,
    featurePolicyId: registeredRecipe.featurePolicyId,
    modelFamilyId: registeredRecipe.modelFamilyId,
    regularizationConfig: registeredRecipe.regularizationConfig,
    optimizerConfig: registeredRecipe.optimizerConfig,
    otherModelAffectingChoices: registeredRecipe.otherModelAffectingChoices,
    complexityRank: registeredRecipe.complexityRank,
  };

  const materializationResult = materializeMLBInnerDevelopmentCandidateRecipe(recipe);
  if (!materializationResult.ok) {
    issues.push({
      code: materializationResult.state,
      path: '$.recipe',
      message: `Candidate materialization failed: ${materializationResult.state}`,
    });
    return { ok: false, state: 'PREPARATION_OR_CANONICAL_FAILURE', issues };
  }

  const providerResult = await input.loadVerifiedTrainArtifact();
  if (!providerResult.ok) {
    issues.push({
      code: 'TRAIN_ARTIFACT_PROVIDER_FAILURE',
      path: '$.provider',
      message: 'Verified train artifact provider failed',
    });
    return { ok: false, state: 'PREPARATION_OR_CANONICAL_FAILURE', issues };
  }

  const preparationResult = prepareMLBInnerDevelopmentCandidateExecution({
    materializedCandidate: materializationResult.materialized,
    verifiedTrainArtifact: providerResult,
  });
  if (!preparationResult.ok) {
    issues.push(...mapPreparationIssues(preparationResult.issues));
    return { ok: false, state: 'PREPARATION_OR_CANONICAL_FAILURE', issues };
  }

  const executionProvenance: MLBInnerDevelopmentAttemptExecutionProvenance = {
    verifiedArtifactSha256: preparationResult.value.verifiedArtifactSha256,
    verifiedArtifactByteLength: preparationResult.value.verifiedArtifactByteLength,
    artifactId: preparationResult.value.artifactId,
    foldPlanId: preparationResult.value.foldPlanId,
  };

  const claimInput: MLBInnerDevelopmentAttemptClaimInput = {
    repositoryRoot: input.repositoryRoot,
    candidateRecipeId: input.candidateRecipeId,
    attemptNumber: input.attemptNumber,
    executionProvenance,
  };

  const claimResult = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
  if (!claimResult.ok) {
    issues.push({
      code: claimResult.state,
      path: '$.claim',
      message: `Claim failed: ${claimResult.state}`,
    });
    return { ok: false, state: 'CLAIM_FAILURE', issues };
  }

  let executionResult: MLBInnerDevelopmentCandidateExecutionResult;
  try {
    executionResult = executeMLBInnerDevelopmentCandidate({
      preparedExecution: preparationResult.value,
      foldFitter: input.foldFitter,
    });
  } catch (error) {
    return {
      ok: false,
      state: 'UNEXPECTED_EXECUTION_EXCEPTION_WITH_RUNNING_DURABLE',
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  const finalizeInput: MLBInnerDevelopmentAttemptFinalizeInput = {
    repositoryRoot: input.repositoryRoot,
    candidateRecipeId: input.candidateRecipeId,
    attemptNumber: input.attemptNumber,
    executionResult,
  };

  const finalizeResult = await finalizeMLBInnerDevelopmentAttemptTerminal(finalizeInput);
  if (!finalizeResult.ok) {
    issues.push({
      code: finalizeResult.state,
      path: '$.finalize',
      message: `Finalize failed: ${finalizeResult.state}`,
    });
    return { ok: false, state: 'FINALIZE_FAILURE', issues };
  }

  return {
    ok: true,
    state: 'EXECUTION_FINALIZED',
    candidateRecipeId: input.candidateRecipeId,
    attemptNumber: input.attemptNumber,
    finalTerminalStatus: finalizeResult.state,
    executionResult,
  };
}
