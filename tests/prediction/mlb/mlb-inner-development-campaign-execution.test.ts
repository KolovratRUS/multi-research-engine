import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  MLB_INNER_DEVELOPMENT_CYCLE_ID,
  type MLBInnerCandidateRecipe,
  computeMLBInnerCandidateRecipeFingerprint,
} from '@/prediction/mlb/mlb-train-only-inner-development-evaluator';
import {
  MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_RESET_PREVENTION_ANCHOR,
  validateMLBInnerDevelopmentCampaignAnchor,
  validateMLBInnerDevelopmentCampaignLedger,
  MLBInnerDevelopmentCampaignAnchor,
  MLBInnerDevelopmentCampaignLedger,
  type MLBInnerDevelopmentAttemptExecutionProvenance,
} from '@/prediction/mlb/mlb-inner-development-campaign-ledger';
import {
  resolveMLBInnerDevelopmentCampaignLedgerStorePaths,
  writeMLBInnerDevelopmentCampaignLedger,
  acquireMLBInnerDevelopmentCampaignLock,
  releaseMLBInnerDevelopmentCampaignLock,
} from '@/prediction/mlb/mlb-inner-development-campaign-ledger-store';
import {
  initializeMLBInnerDevelopmentCampaign,
  inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld,
  MLBInnerDevelopmentCampaignGenesisInput,
} from '@/prediction/mlb/mlb-inner-development-campaign-lifecycle';
import {
  registerMLBInnerDevelopmentCampaignCandidate,
  MLBInnerDevelopmentCampaignRegistrationInput,
} from '@/prediction/mlb/mlb-inner-development-campaign-registration';
import {
  claimMLBInnerDevelopmentAttemptForExecution,
  finalizeMLBInnerDevelopmentAttemptTerminal,
  type MLBInnerDevelopmentAttemptClaimInput,
  type MLBInnerDevelopmentAttemptFinalizeInput,
} from '@/prediction/mlb/mlb-inner-development-campaign-execution';
import type { MLBInnerDevelopmentCandidateExecutionResult } from '@/prediction/mlb/mlb-inner-development-candidate-execution';

const VALID_TIMESTAMP = '2026-04-01T00:00:00.000Z';

function makeGenesisInput(genesisTimestamp: string): MLBInnerDevelopmentCampaignGenesisInput {
  return {
    authorization: 'EXPLICIT_ONE_TIME_GENESIS' as const,
    genesisTimestamp,
  };
}

function makeRecipe(overrides: Partial<MLBInnerCandidateRecipe> = {}): MLBInnerCandidateRecipe {
  return {
    candidateRecipeId: overrides.candidateRecipeId ?? 'synthetic-recipe-1',
    preprocessingPolicyId: overrides.preprocessingPolicyId ?? 'preprocessing-1',
    featurePolicyId: overrides.featurePolicyId ?? 'feature-1',
    modelFamilyId: overrides.modelFamilyId ?? 'synthetic-model-1',
    regularizationConfig: overrides.regularizationConfig ?? { type: 'l2', value: 0.1 },
    optimizerConfig: overrides.optimizerConfig ?? { type: 'adam', learningRate: 0.01 },
    otherModelAffectingChoices: overrides.otherModelAffectingChoices ?? { seed: 1 },
    complexityRank: overrides.complexityRank ?? 1,
  };
}

function makeRegistrationInput(overrides: {
  candidateRecipe?: MLBInnerCandidateRecipe;
  registrationTimestamp?: unknown;
  attemptTimestamp?: unknown;
} = {}): MLBInnerDevelopmentCampaignRegistrationInput {
  const candidateRecipe = overrides.candidateRecipe ?? makeRecipe();
  return {
    candidateRecipe,
    registrationTimestamp: (overrides.registrationTimestamp ?? VALID_TIMESTAMP) as string,
    attemptTimestamp: (overrides.attemptTimestamp ?? VALID_TIMESTAMP) as string,
  };
}

async function setupReadyCampaign(tempRoot: string): Promise<MLBInnerDevelopmentCampaignLedger> {
  await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput(VALID_TIMESTAMP));
  const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
  expect(inspection.ok).toBe(true);
  if (!inspection.ok) {
    throw new Error('Failed to setup READY campaign');
  }
  return inspection.ledger;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

async function snapshotCanonicalLedgerBytes(tempRoot: string): Promise<string> {
  const ledgerPath = path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME);
  return await fs.readFile(ledgerPath, 'utf-8');
}

function makeExecutionProvenance(overrides: Partial<MLBInnerDevelopmentAttemptExecutionProvenance> = {}): MLBInnerDevelopmentAttemptExecutionProvenance {
  return {
    verifiedArtifactSha256: 'a'.repeat(64),
    verifiedArtifactByteLength: 1024,
    artifactId: 'artifact-1',
    foldPlanId: 'fold-plan-1',
    ...overrides,
  };
}

function makeSuccessExecutionResult(overrides: {
  lowLevelFitCount?: number;
  candidateRecipeId?: string;
  foldResults?: readonly import('@/prediction/mlb/mlb-train-only-inner-development-evaluator').MLBInnerFoldMetricResult[];
  aggregate?: import('@/prediction/mlb/mlb-train-only-inner-development-evaluator').MLBInnerAggregateResult;
  gate?: import('@/prediction/mlb/mlb-train-only-inner-development-evaluator').MLBInnerCandidateGateResult;
} = {}): MLBInnerDevelopmentCandidateExecutionResult {
  const defaultFoldResults: import('@/prediction/mlb/mlb-train-only-inner-development-evaluator').MLBInnerFoldMetricResult[] = [
    {
      contractVersion: 'mlb-inner-fold-metric-result-v1',
      foldId: 'FOLD_1',
      candidateRecipeId: overrides.candidateRecipeId ?? 'synthetic-recipe-1',
      rowCount: 51,
      targetHomeWinCount: 29,
      targetAwayWinCount: 22,
      candidateLogLoss: 0.5,
      candidateBrierScore: 0.3,
      candidateRocAuc: 0.8,
      p50LogLoss: 0.55,
      p50BrierScore: 0.32,
      p50RocAuc: 0.78,
      foldTrainPriorLogLoss: 0.6,
      foldTrainPriorBrierScore: 0.35,
      foldTrainPriorRocAuc: 0.75,
      foldTrainPriorProbability: 0.55,
    },
    {
      contractVersion: 'mlb-inner-fold-metric-result-v1',
      foldId: 'FOLD_2',
      candidateRecipeId: overrides.candidateRecipeId ?? 'synthetic-recipe-1',
      rowCount: 55,
      targetHomeWinCount: 34,
      targetAwayWinCount: 21,
      candidateLogLoss: 0.48,
      candidateBrierScore: 0.28,
      candidateRocAuc: 0.82,
      p50LogLoss: 0.52,
      p50BrierScore: 0.3,
      p50RocAuc: 0.8,
      foldTrainPriorLogLoss: 0.58,
      foldTrainPriorBrierScore: 0.33,
      foldTrainPriorRocAuc: 0.77,
      foldTrainPriorProbability: 0.56,
    },
    {
      contractVersion: 'mlb-inner-fold-metric-result-v1',
      foldId: 'FOLD_3',
      candidateRecipeId: overrides.candidateRecipeId ?? 'synthetic-recipe-1',
      rowCount: 55,
      targetHomeWinCount: 25,
      targetAwayWinCount: 30,
      candidateLogLoss: 0.52,
      candidateBrierScore: 0.31,
      candidateRocAuc: 0.79,
      p50LogLoss: 0.54,
      p50BrierScore: 0.31,
      p50RocAuc: 0.77,
      foldTrainPriorLogLoss: 0.59,
      foldTrainPriorBrierScore: 0.34,
      foldTrainPriorRocAuc: 0.76,
      foldTrainPriorProbability: 0.54,
    },
    {
      contractVersion: 'mlb-inner-fold-metric-result-v1',
      foldId: 'FOLD_4',
      candidateRecipeId: overrides.candidateRecipeId ?? 'synthetic-recipe-1',
      rowCount: 49,
      targetHomeWinCount: 23,
      targetAwayWinCount: 26,
      candidateLogLoss: 0.51,
      candidateBrierScore: 0.29,
      candidateRocAuc: 0.81,
      p50LogLoss: 0.53,
      p50BrierScore: 0.29,
      p50RocAuc: 0.79,
      foldTrainPriorLogLoss: 0.57,
      foldTrainPriorBrierScore: 0.32,
      foldTrainPriorRocAuc: 0.78,
      foldTrainPriorProbability: 0.55,
    },
  ];
  const defaultAggregate: import('@/prediction/mlb/mlb-train-only-inner-development-evaluator').MLBInnerAggregateResult = {
    contractVersion: 'mlb-inner-aggregate-result-v1',
    candidateRecipeId: overrides.candidateRecipeId ?? 'synthetic-recipe-1',
    foldCount: 4,
    aggregateValidationRowCount: 210,
    aggregateCandidateLogLoss: 0.5,
    aggregateCandidateBrierScore: 0.3,
    aggregateCandidateRocAuc: 0.8,
    aggregateP50LogLoss: 0.535,
    aggregateP50BrierScore: 0.305,
    aggregateP50RocAuc: 0.785,
    aggregateFoldTrainPriorLogLoss: 0.585,
    aggregateFoldTrainPriorBrierScore: 0.335,
    aggregateFoldTrainPriorRocAuc: 0.765,
    worstFoldCandidateLogLoss: 0.52,
    worstFoldCandidateBrierScore: 0.31,
    foldsBeatingP50OnLogLoss: 3,
    foldsBeatingP50OnBrier: 3,
    foldsBeatingFoldTrainPriorOnLogLoss: 3,
    foldsBeatingFoldTrainPriorOnBrier: 3,
  };
  const defaultGate: import('@/prediction/mlb/mlb-train-only-inner-development-evaluator').MLBInnerCandidateGateResult = {
    eligibility: 'INNER_ELIGIBLE',
    reasons: [],
  };
  return {
    ok: true,
    value: {
      ok: true,
      candidateRecipeId: overrides.candidateRecipeId ?? 'synthetic-recipe-1',
      verifiedArtifactSha256: 'a'.repeat(64),
      verifiedArtifactByteLength: 1024,
      artifactId: 'artifact-1',
      foldPlanId: 'fold-plan-1',
      lowLevelFitCount: overrides.lowLevelFitCount ?? 4,
      foldResults: overrides.foldResults ?? defaultFoldResults,
      aggregate: overrides.aggregate ?? defaultAggregate,
      gate: overrides.gate ?? defaultGate,
    },
  };
}

function makeFailureExecutionResult(overrides: {
  lowLevelFitCount?: number;
  failedFoldId?: string;
  issues?: readonly import('@/prediction/mlb/mlb-inner-development-candidate-execution').MLBInnerDevelopmentCandidateExecutionIssue[];
} = {}): MLBInnerDevelopmentCandidateExecutionResult {
  const defaultIssues: readonly import('@/prediction/mlb/mlb-inner-development-candidate-execution').MLBInnerDevelopmentCandidateExecutionIssue[] = [];
  return {
    ok: false,
    issues: overrides.issues ?? defaultIssues,
    lowLevelFitCount: overrides.lowLevelFitCount ?? 0,
    failedFoldId: overrides.failedFoldId,
  };
}

describe('mlb-inner-development-campaign-execution', () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join('/tmp', 'mre-execution-'));
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  describe('claimMLBInnerDevelopmentAttemptForExecution', () => {
    it('claims a REGISTERED attempt and persists RUNNING with provenance', async () => {
      await setupReadyCampaign(tempRoot);
      const registrationInput = makeRegistrationInput();
      const registrationResult = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, registrationInput);
      expect(registrationResult.ok).toBe(true);
      if (!registrationResult.ok) {
        throw new Error('Registration failed');
      }

      const provenance = makeExecutionProvenance();
      const claimInput: MLBInnerDevelopmentAttemptClaimInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionProvenance: provenance,
      };

      const preInspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
      expect(preInspection.ok).toBe(true);
      if (!preInspection.ok) {
        throw new Error('Pre-claim inspection failed');
      }
      const evaluationCountBeforeClaim = preInspection.ledger.budget.evaluationCount;
      expect(evaluationCountBeforeClaim).toBeGreaterThanOrEqual(0);

      const claimResult = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
      expect(claimResult.ok).toBe(true);
      if (!claimResult.ok) {
        throw new Error('Claim failed');
      }
      expect(claimResult.state).toBe('RUNNING_CLAIMED');
      expect(claimResult.candidateRecipeId).toBe(claimInput.candidateRecipeId);
      expect(claimResult.attemptNumber).toBe(claimInput.attemptNumber);

      const postClaimInspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
      expect(postClaimInspection.ok).toBe(true);
      if (!postClaimInspection.ok) {
        throw new Error('Post-claim inspection failed');
      }

      const postClaimAttempt = postClaimInspection.ledger.attempts.find(
        a => a.candidateRecipeId === claimInput.candidateRecipeId && a.attemptNumber === claimInput.attemptNumber,
      );
      expect(postClaimAttempt).toBeDefined();
      if (!postClaimAttempt) {
        throw new Error('Post-claim attempt not found');
      }
      expect(postClaimAttempt.status).toBe('RUNNING');
      expect(postClaimAttempt.attemptTimestamp).toBe(registrationInput.attemptTimestamp);
      if ('executionProvenance' in postClaimAttempt && postClaimAttempt.executionProvenance) {
        expect(postClaimAttempt.executionProvenance).toEqual(provenance);
      }

      expect(postClaimInspection.ledger.budget.evaluationCount).toBe(evaluationCountBeforeClaim);
      expect(postClaimInspection.ledger.registeredRecipes).toHaveLength(1);
    });

    it('rejects duplicate claim of already RUNNING attempt', async () => {
      await setupReadyCampaign(tempRoot);
      const registrationInput = makeRegistrationInput();
      const registrationResult = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, registrationInput);
      expect(registrationResult.ok).toBe(true);
      if (!registrationResult.ok) {
        throw new Error('Registration failed');
      }

      const provenance = makeExecutionProvenance();
      const claimInput: MLBInnerDevelopmentAttemptClaimInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionProvenance: provenance,
      };

      const firstClaim = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
      expect(firstClaim.ok).toBe(true);

      const secondClaim = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
      expect(secondClaim.ok).toBe(false);
      if (!secondClaim.ok) {
        expect(secondClaim.state).toBe('FAIL_CLOSED_CLAIM_INVARIANT_VIOLATION');
      }

      const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
      expect(inspection.ok).toBe(true);
      if (!inspection.ok) {
        throw new Error('Inspection failed');
      }
      expect(inspection.ledger.attempts).toHaveLength(1);
    });

    it('prevents concurrent duplicate claims', async () => {
      await setupReadyCampaign(tempRoot);
      const registrationInput = makeRegistrationInput();
      const registrationResult = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, registrationInput);
      expect(registrationResult.ok).toBe(true);
      if (!registrationResult.ok) {
        throw new Error('Registration failed');
      }

      const provenance = makeExecutionProvenance();
      const claimInput: MLBInnerDevelopmentAttemptClaimInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionProvenance: provenance,
      };

      const preInspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
      expect(preInspection.ok).toBe(true);
      if (!preInspection.ok) {
        throw new Error('Pre-claim inspection failed');
      }
      const evaluationCountBeforeClaim = preInspection.ledger.budget.evaluationCount;

      const [firstClaim, secondClaim] = await Promise.all([
        claimMLBInnerDevelopmentAttemptForExecution(claimInput),
        claimMLBInnerDevelopmentAttemptForExecution(claimInput),
      ]);

      const successes = [firstClaim, secondClaim].filter(r => r.ok);
      const failures = [firstClaim, secondClaim].filter(r => !r.ok);
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);

      const postInspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
      expect(postInspection.ok).toBe(true);
      if (!postInspection.ok) {
        throw new Error('Post-concurrent inspection failed');
      }
      const runningAttempts = postInspection.ledger.attempts.filter(a => a.status === 'RUNNING');
      expect(runningAttempts).toHaveLength(1);
      expect(postInspection.ledger.budget.evaluationCount).toBe(evaluationCountBeforeClaim);
    });

    it('rejects claim when campaign is not READY', async () => {
      const ledger = await setupReadyCampaign(tempRoot);
      const ledgerPath = path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME);
      const invalidLedger = { ...ledger, developmentCycleId: 'different-cycle' };
      await fs.writeFile(ledgerPath, JSON.stringify(invalidLedger, null, 2) + '\n', 'utf-8');

      const claimInput: MLBInnerDevelopmentAttemptClaimInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: 'synthetic-recipe-1',
        attemptNumber: 1,
        executionProvenance: makeExecutionProvenance(),
      };

      const claimResult = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
      expect(claimResult.ok).toBe(false);
      if (!claimResult.ok) {
        expect(claimResult.state).toBe('FAIL_CLOSED_INVALID_LEDGER');
      }
    });

    it('rejects claim for missing candidateRecipeId', async () => {
      await setupReadyCampaign(tempRoot);
      const claimInput: MLBInnerDevelopmentAttemptClaimInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: 'missing-recipe',
        attemptNumber: 1,
        executionProvenance: makeExecutionProvenance(),
      };

      const claimResult = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
      expect(claimResult.ok).toBe(false);
      if (!claimResult.ok) {
        expect(claimResult.state).toBe('FAIL_CLOSED_CLAIM_INVARIANT_VIOLATION');
      }
    });

    it('rejects claim for already COMPLETED_INNER_ELIGIBLE attempt', async () => {
      await setupReadyCampaign(tempRoot);
      const registrationInput = makeRegistrationInput();
      const registrationResult = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, registrationInput);
      expect(registrationResult.ok).toBe(true);
      if (!registrationResult.ok) {
        throw new Error('Registration failed');
      }

      const provenance = makeExecutionProvenance();
      const claimInput: MLBInnerDevelopmentAttemptClaimInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionProvenance: provenance,
      };
      const claimResult = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
      expect(claimResult.ok).toBe(true);
      if (!claimResult.ok) {
        throw new Error('Claim failed');
      }

      const successResult = makeSuccessExecutionResult({
        lowLevelFitCount: 4,
        gate: { eligibility: 'INNER_ELIGIBLE', reasons: [] },
      });
      const finalizeInput: MLBInnerDevelopmentAttemptFinalizeInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionResult: successResult,
      };
      const finalizeResult = await finalizeMLBInnerDevelopmentAttemptTerminal(finalizeInput);
      expect(finalizeResult.ok).toBe(true);
      if (!finalizeResult.ok) {
        throw new Error('Finalize failed');
      }

      const secondClaimResult = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
      expect(secondClaimResult.ok).toBe(false);
      if (!secondClaimResult.ok) {
        expect(secondClaimResult.state).toBe('FAIL_CLOSED_CLAIM_INVARIANT_VIOLATION');
      }
    });

    it('rejects claim for already COMPLETED_INNER_REJECTED attempt', async () => {
      await setupReadyCampaign(tempRoot);
      const registrationInput = makeRegistrationInput();
      const registrationResult = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, registrationInput);
      expect(registrationResult.ok).toBe(true);
      if (!registrationResult.ok) {
        throw new Error('Registration failed');
      }

      const provenance = makeExecutionProvenance();
      const claimInput: MLBInnerDevelopmentAttemptClaimInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionProvenance: provenance,
      };
      const claimResult = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
      expect(claimResult.ok).toBe(true);
      if (!claimResult.ok) {
        throw new Error('Claim failed');
      }

      const rejectedResult = makeSuccessExecutionResult({
        lowLevelFitCount: 4,
        gate: { eligibility: 'INNER_REJECTED', reasons: ['low auc'] },
      });
      const finalizeInput: MLBInnerDevelopmentAttemptFinalizeInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionResult: rejectedResult,
      };
      const finalizeResult = await finalizeMLBInnerDevelopmentAttemptTerminal(finalizeInput);
      expect(finalizeResult.ok).toBe(true);
      if (!finalizeResult.ok) {
        throw new Error('Finalize failed');
      }

      const secondClaimResult = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
      expect(secondClaimResult.ok).toBe(false);
      if (!secondClaimResult.ok) {
        expect(secondClaimResult.state).toBe('FAIL_CLOSED_CLAIM_INVARIANT_VIOLATION');
      }
    });

    it('rejects claim for already FAILED attempt', async () => {
      await setupReadyCampaign(tempRoot);
      const registrationInput = makeRegistrationInput();
      const registrationResult = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, registrationInput);
      expect(registrationResult.ok).toBe(true);
      if (!registrationResult.ok) {
        throw new Error('Registration failed');
      }

      const provenance = makeExecutionProvenance();
      const claimInput: MLBInnerDevelopmentAttemptClaimInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionProvenance: provenance,
      };
      const claimResult = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
      expect(claimResult.ok).toBe(true);
      if (!claimResult.ok) {
        throw new Error('Claim failed');
      }

      const failureResult = makeFailureExecutionResult({
        lowLevelFitCount: 0,
        failedFoldId: 'FOLD_1',
        issues: [{ code: 'FOLD_FIT_FAILURE', path: '$.folds[0]', message: 'fit failed' }],
      });
      const finalizeInput: MLBInnerDevelopmentAttemptFinalizeInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionResult: failureResult,
      };
      const finalizeResult = await finalizeMLBInnerDevelopmentAttemptTerminal(finalizeInput);
      expect(finalizeResult.ok).toBe(true);
      if (!finalizeResult.ok) {
        throw new Error('Finalize failed');
      }

      const secondClaimResult = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
      expect(secondClaimResult.ok).toBe(false);
      if (!secondClaimResult.ok) {
        expect(secondClaimResult.state).toBe('FAIL_CLOSED_CLAIM_INVARIANT_VIOLATION');
      }
    });

    it('rejects claim with invalid execution provenance', async () => {
      await setupReadyCampaign(tempRoot);
      const registrationInput = makeRegistrationInput();
      const registrationResult = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, registrationInput);
      expect(registrationResult.ok).toBe(true);
      if (!registrationResult.ok) {
        throw new Error('Registration failed');
      }

      const claimInput: MLBInnerDevelopmentAttemptClaimInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionProvenance: { verifiedArtifactSha256: 'bad' } as MLBInnerDevelopmentAttemptExecutionProvenance,
      };

      const claimResult = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
      expect(claimResult.ok).toBe(false);
      if (!claimResult.ok) {
        expect(claimResult.state).toBe('FAIL_CLOSED_CLAIM_INVARIANT_VIOLATION');
      }
    });

    it('does not authorize execution when lock release fails after successful write', async () => {
      await setupReadyCampaign(tempRoot);
      const registrationInput = makeRegistrationInput();
      const registrationResult = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, registrationInput);
      expect(registrationResult.ok).toBe(true);
      if (!registrationResult.ok) {
        throw new Error('Registration failed');
      }

      const provenance = makeExecutionProvenance();
      const claimInput: MLBInnerDevelopmentAttemptClaimInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionProvenance: provenance,
      };

      const lockDir = path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, '.lock');
      await fs.mkdir(lockDir, { recursive: true });

      const claimResult = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
      expect(claimResult.ok).toBe(false);
      if (!claimResult.ok) {
        expect(claimResult.state).toBe('FAIL_CLOSED_LOCK_ACQUISITION_FAILED');
      }
    });
  });

  describe('finalizeMLBInnerDevelopmentAttemptTerminal', () => {
    it('finalizes RUNNING eligible attempt to COMPLETED_INNER_ELIGIBLE', async () => {
      await setupReadyCampaign(tempRoot);
      const registrationInput = makeRegistrationInput();
      const registrationResult = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, registrationInput);
      expect(registrationResult.ok).toBe(true);
      if (!registrationResult.ok) {
        throw new Error('Registration failed');
      }

      const provenance = makeExecutionProvenance();
      const claimInput: MLBInnerDevelopmentAttemptClaimInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionProvenance: provenance,
      };
      const claimResult = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
      expect(claimResult.ok).toBe(true);
      if (!claimResult.ok) {
        throw new Error('Claim failed');
      }

      const successResult = makeSuccessExecutionResult({
        lowLevelFitCount: 4,
        gate: { eligibility: 'INNER_ELIGIBLE', reasons: [] },
      });
      const finalizeInput: MLBInnerDevelopmentAttemptFinalizeInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionResult: successResult,
      };

      const finalizeResult = await finalizeMLBInnerDevelopmentAttemptTerminal(finalizeInput);
      expect(finalizeResult.ok).toBe(true);
      if (!finalizeResult.ok) {
        throw new Error('Finalize failed');
      }
      expect(finalizeResult.state).toBe('COMPLETED_INNER_ELIGIBLE');

      const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
      expect(inspection.ok).toBe(true);
      if (!inspection.ok) {
        throw new Error('Inspection failed');
      }

      const attempt = inspection.ledger.attempts.find(
        a => a.candidateRecipeId === registrationInput.candidateRecipe.candidateRecipeId && a.attemptNumber === registrationResult.value.attemptNumber,
      );
      expect(attempt?.status).toBe('COMPLETED_INNER_ELIGIBLE');
      if (!attempt) {
        throw new Error('Attempt not found');
      }
      if ('executionProvenance' in attempt && attempt.executionProvenance) {
        expect(attempt.executionProvenance).toEqual(provenance);
      }
      expect(inspection.ledger.budget.evaluationCount).toBe(1);
    });

    it('finalizes RUNNING rejected attempt to COMPLETED_INNER_REJECTED', async () => {
      await setupReadyCampaign(tempRoot);
      const registrationInput = makeRegistrationInput();
      const registrationResult = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, registrationInput);
      expect(registrationResult.ok).toBe(true);
      if (!registrationResult.ok) {
        throw new Error('Registration failed');
      }

      const provenance = makeExecutionProvenance();
      const claimInput: MLBInnerDevelopmentAttemptClaimInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionProvenance: provenance,
      };
      const claimResult = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
      expect(claimResult.ok).toBe(true);
      if (!claimResult.ok) {
        throw new Error('Claim failed');
      }

      const successResult = makeSuccessExecutionResult({
        lowLevelFitCount: 1,
        gate: { eligibility: 'INNER_REJECTED', reasons: [] },
      });
      const finalizeInput: MLBInnerDevelopmentAttemptFinalizeInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionResult: successResult,
      };

      const finalizeResult = await finalizeMLBInnerDevelopmentAttemptTerminal(finalizeInput);
      expect(finalizeResult.ok).toBe(true);
      if (!finalizeResult.ok) {
        throw new Error('Finalize failed');
      }
      expect(finalizeResult.state).toBe('COMPLETED_INNER_REJECTED');
    });

    it('finalizes RUNNING failed attempt to FAILED', async () => {
      await setupReadyCampaign(tempRoot);
      const registrationInput = makeRegistrationInput();
      const registrationResult = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, registrationInput);
      expect(registrationResult.ok).toBe(true);
      if (!registrationResult.ok) {
        throw new Error('Registration failed');
      }

      const provenance = makeExecutionProvenance();
      const claimInput: MLBInnerDevelopmentAttemptClaimInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionProvenance: provenance,
      };
      const claimResult = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
      expect(claimResult.ok).toBe(true);
      if (!claimResult.ok) {
        throw new Error('Claim failed');
      }

      const failureResult = makeFailureExecutionResult({
        lowLevelFitCount: 0,
        failedFoldId: 'fold-1',
        issues: [{ code: 'FOLD_FIT_FAILURE', path: '$.folds[0]', message: 'fit failed' }],
      });
      const finalizeInput: MLBInnerDevelopmentAttemptFinalizeInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionResult: failureResult,
      };

      const finalizeResult = await finalizeMLBInnerDevelopmentAttemptTerminal(finalizeInput);
      expect(finalizeResult.ok).toBe(true);
      if (!finalizeResult.ok) {
        throw new Error('Finalize failed');
      }
      expect(finalizeResult.state).toBe('FAILED');
    });

    it('rejects exact terminal replay', async () => {
      await setupReadyCampaign(tempRoot);
      const registrationInput = makeRegistrationInput();
      const registrationResult = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, registrationInput);
      expect(registrationResult.ok).toBe(true);
      if (!registrationResult.ok) {
        throw new Error('Registration failed');
      }

      const provenance = makeExecutionProvenance();
      const claimInput: MLBInnerDevelopmentAttemptClaimInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionProvenance: provenance,
      };
      const claimResult = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
      expect(claimResult.ok).toBe(true);
      if (!claimResult.ok) {
        throw new Error('Claim failed');
      }

      const successResult = makeSuccessExecutionResult({ lowLevelFitCount: 1 });
      const finalizeInput: MLBInnerDevelopmentAttemptFinalizeInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionResult: successResult,
      };

      const firstFinalize = await finalizeMLBInnerDevelopmentAttemptTerminal(finalizeInput);
      expect(firstFinalize.ok).toBe(true);

      const secondFinalize = await finalizeMLBInnerDevelopmentAttemptTerminal(finalizeInput);
      expect(secondFinalize.ok).toBe(false);
      if (!secondFinalize.ok) {
        expect(secondFinalize.state).toBe('FAIL_CLOSED_FINALIZE_INVARIANT_VIOLATION');
      }
    });

    it('preserves lowLevelFitCount exactly through terminal transition', async () => {
      await setupReadyCampaign(tempRoot);
      const registrationInput = makeRegistrationInput();
      const registrationResult = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, registrationInput);
      expect(registrationResult.ok).toBe(true);
      if (!registrationResult.ok) {
        throw new Error('Registration failed');
      }

      const provenance = makeExecutionProvenance();
      const claimInput: MLBInnerDevelopmentAttemptClaimInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionProvenance: provenance,
      };
      const claimResult = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
      expect(claimResult.ok).toBe(true);
      if (!claimResult.ok) {
        throw new Error('Claim failed');
      }

      const expectedLowLevelFitCount = 7;
      const successResult = makeSuccessExecutionResult({ lowLevelFitCount: expectedLowLevelFitCount });
      const finalizeInput: MLBInnerDevelopmentAttemptFinalizeInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionResult: successResult,
      };

      const finalizeResult = await finalizeMLBInnerDevelopmentAttemptTerminal(finalizeInput);
      expect(finalizeResult.ok).toBe(true);
      if (!finalizeResult.ok) {
        throw new Error('Finalize failed');
      }

      const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
      expect(inspection.ok).toBe(true);
      if (!inspection.ok) {
        throw new Error('Inspection failed');
      }

      const attempt = inspection.ledger.attempts.find(
        a => a.candidateRecipeId === registrationInput.candidateRecipe.candidateRecipeId && a.attemptNumber === registrationResult.value.attemptNumber,
      );
      if (!attempt) {
        throw new Error('Attempt not found');
      }
      if ('terminalExecution' in attempt && attempt.terminalExecution && attempt.terminalExecution.kind === 'SUCCESS') {
        expect(attempt.terminalExecution.lowLevelFitCount).toBe(expectedLowLevelFitCount);
      }
    });

    it('preserves root ledger timestamps through claim and finalize', async () => {
      const genesisTimestamp = '2026-04-01T00:00:00.000Z';
      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput(genesisTimestamp));
      const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
      expect(inspection.ok).toBe(true);
      if (!inspection.ok) {
        throw new Error('Inspection failed');
      }
      const createdAtBefore = inspection.ledger.createdAt;
      const updatedAtBefore = inspection.ledger.updatedAt;

      const registrationInput = makeRegistrationInput({ registrationTimestamp: genesisTimestamp, attemptTimestamp: genesisTimestamp });
      const registrationResult = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, registrationInput);
      expect(registrationResult.ok).toBe(true);
      if (!registrationResult.ok) {
        throw new Error('Registration failed');
      }

      const provenance = makeExecutionProvenance();
      const claimInput: MLBInnerDevelopmentAttemptClaimInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionProvenance: provenance,
      };
      const claimResult = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
      expect(claimResult.ok).toBe(true);

      const successResult = makeSuccessExecutionResult({ lowLevelFitCount: 1 });
      const finalizeInput: MLBInnerDevelopmentAttemptFinalizeInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionResult: successResult,
      };
      const finalizeResult = await finalizeMLBInnerDevelopmentAttemptTerminal(finalizeInput);
      expect(finalizeResult.ok).toBe(true);

      const finalInspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
      expect(finalInspection.ok).toBe(true);
      if (!finalInspection.ok) {
        throw new Error('Final inspection failed');
      }
      expect(finalInspection.ledger.createdAt).toBe(createdAtBefore);
    });
  });

  describe('terminal persistence failure leaves RUNNING', () => {
    it('preserves RUNNING when write fails after validation', async () => {
      await setupReadyCampaign(tempRoot);
      const registrationInput = makeRegistrationInput();
      const registrationResult = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, registrationInput);
      expect(registrationResult.ok).toBe(true);
      if (!registrationResult.ok) {
        throw new Error('Registration failed');
      }

      const provenance = makeExecutionProvenance();
      const claimInput: MLBInnerDevelopmentAttemptClaimInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionProvenance: provenance,
      };
      const claimResult = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
      expect(claimResult.ok).toBe(true);
      if (!claimResult.ok) {
        throw new Error('Claim failed');
      }

      const ledgerDir = path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY);
      const ledgerPath = path.join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME);
      const tempPath = path.join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME + '.tmp');
      await fs.writeFile(tempPath, 'FORENSIC_STALE_TEMP\n', 'utf-8');

      const successResult = makeSuccessExecutionResult({ lowLevelFitCount: 1 });
      const finalizeInput: MLBInnerDevelopmentAttemptFinalizeInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        executionResult: successResult,
      };

      const finalizeResult = await finalizeMLBInnerDevelopmentAttemptTerminal(finalizeInput);
      expect(finalizeResult.ok).toBe(false);
      if (!finalizeResult.ok) {
        expect(finalizeResult.state).toBe('FAIL_CLOSED_INVALID_LEDGER');
      }

      const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
      expect(inspection.ok).toBe(true);
      if (!inspection.ok) {
        throw new Error('Inspection failed');
      }

      const attempt = inspection.ledger.attempts.find(
        a => a.candidateRecipeId === registrationInput.candidateRecipe.candidateRecipeId && a.attemptNumber === registrationResult.value.attemptNumber,
      );
      expect(attempt?.status).toBe('RUNNING');
      expect(inspection.ledger.attempts).toHaveLength(1);
    });
  });
});
