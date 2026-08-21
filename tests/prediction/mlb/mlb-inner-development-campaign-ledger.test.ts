import { describe, expect, it } from 'vitest';
import {
  MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_RESET_PREVENTION_ANCHOR,
  MLB_INNER_DEVELOPMENT_MAX_DISTINCT_RECIPES,
  MLB_INNER_DEVELOPMENT_ATTEMPT_STATUS_VALUES,
  MLBInnerDevelopmentCampaignAnchor,
  MLBInnerDevelopmentRegisteredRecipeRecord,
  MLBInnerDevelopmentAttemptRecord,
  MLBInnerDevelopmentCampaignLedger,
  MLBInnerDevelopmentCampaignLedgerIssue,
  MLBInnerDevelopmentCampaignAnchorIssue,
  MLBInnerDevelopmentAttemptStatus,
  MLBInnerDevelopmentAttemptExecutionProvenance,
  MLBInnerDevelopmentAttemptTerminalSuccess,
  MLBInnerDevelopmentAttemptTerminalFailure,
  validateMLBInnerDevelopmentCampaignLedger,
  validateMLBInnerDevelopmentCampaignAnchor,
} from '@/prediction/mlb/mlb-inner-development-campaign-ledger';
import {
  MLB_INNER_DEVELOPMENT_CYCLE_ID,
  MLBInnerCandidateRecipe,
  MLBInnerDevelopmentRecipeBudget,
  computeMLBInnerCandidateRecipeFingerprint,
  MLBInnerFoldMetricResult,
  MLBInnerAggregateResult,
  MLBInnerCandidateGateResult,
} from '@/prediction/mlb/mlb-train-only-inner-development-evaluator';

function buildBudgetAndFingerprints(
  evaluationCount: number,
  recipeIds: string[],
): { budget: MLBInnerDevelopmentRecipeBudget; fingerprintByRecipeId: Map<string, string> } {
  const seenRecipeFingerprints: string[] = [];
  const seenComplexityRanks: number[] = [];
  const fingerprintByRecipeId = new Map<string, string>();
  for (const id of recipeIds) {
    const recipe: MLBInnerCandidateRecipe = {
      candidateRecipeId: id,
      preprocessingPolicyId: 'prep-' + id,
      featurePolicyId: 'feat-' + id,
      modelFamilyId: 'model-' + id,
      regularizationConfig: { strength: 0.1 },
      optimizerConfig: { lr: 0.01 },
      otherModelAffectingChoices: {},
      complexityRank: 1,
    };
    const fp = computeMLBInnerCandidateRecipeFingerprint(recipe);
    if (!fp.ok) {
      throw new Error(fp.issues.map(i => i.message).join('; '));
    }
    seenRecipeFingerprints.push(fp.fingerprint);
    seenComplexityRanks.push(1);
    fingerprintByRecipeId.set(id, fp.fingerprint);
  }
  return {
    budget: {
      contractVersion: 'mlb-inner-development-recipe-budget-v1',
      cycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
      maxDistinctRecipes: 12,
      seenRecipeIds: recipeIds,
      seenRecipeFingerprints,
      seenComplexityRanks,
      evaluationCount,
    },
    fingerprintByRecipeId,
  };
}

function makeRegisteredRecipe(
  candidateRecipeId: string,
  registrationSequence: number,
  registrationTimestamp: string,
  recipeFingerprint: string,
): MLBInnerDevelopmentRegisteredRecipeRecord {
  return {
    candidateRecipeId,
    registrationSequence,
    registrationTimestamp,
    recipeFingerprint,
    complexityRank: 1,
    preprocessingPolicyId: 'prep-' + candidateRecipeId,
    featurePolicyId: 'feat-' + candidateRecipeId,
    modelFamilyId: 'model-' + candidateRecipeId,
    regularizationConfig: { strength: 0.1 },
    optimizerConfig: { lr: 0.01 },
    otherModelAffectingChoices: {},
  };
}

function makeRegisteredAttempt(
  attemptNumber: number,
  candidateRecipeId: string,
  recipeFingerprint: string,
  complexityRank: number,
  attemptTimestamp: string,
): MLBInnerDevelopmentAttemptRecord {
  return {
    attemptNumber,
    candidateRecipeId,
    recipeFingerprint,
    complexityRank,
    developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
    status: 'REGISTERED',
    attemptTimestamp,
    foldIds: ['fold-1', 'fold-2', 'fold-3', 'fold-4'],
  };
}

function makeInterruptedAttempt(
  attemptNumber: number,
  candidateRecipeId: string,
  recipeFingerprint: string,
  complexityRank: number,
  attemptTimestamp: string,
): MLBInnerDevelopmentAttemptRecord {
  return {
    attemptNumber,
    candidateRecipeId,
    recipeFingerprint,
    complexityRank,
    developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
    status: 'INTERRUPTED',
    attemptTimestamp,
    foldIds: ['fold-1', 'fold-2', 'fold-3', 'fold-4'],
  };
}

function makeRunningAttempt(
  attemptNumber: number,
  candidateRecipeId: string,
  recipeFingerprint: string,
  complexityRank: number,
  attemptTimestamp: string,
  executionProvenance: MLBInnerDevelopmentAttemptExecutionProvenance,
): MLBInnerDevelopmentAttemptRecord {
  return {
    attemptNumber,
    candidateRecipeId,
    recipeFingerprint,
    complexityRank,
    developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
    status: 'RUNNING',
    attemptTimestamp,
    foldIds: ['fold-1', 'fold-2', 'fold-3', 'fold-4'],
    executionProvenance,
  };
}

function makeEligibleAttempt(
  attemptNumber: number,
  candidateRecipeId: string,
  recipeFingerprint: string,
  complexityRank: number,
  attemptTimestamp: string,
  executionProvenance: MLBInnerDevelopmentAttemptExecutionProvenance,
  terminalExecution: MLBInnerDevelopmentAttemptTerminalSuccess,
  foldIds: string[] = ['fold-1'],
): MLBInnerDevelopmentAttemptRecord {
  return {
    attemptNumber,
    candidateRecipeId,
    recipeFingerprint,
    complexityRank,
    developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
    status: 'COMPLETED_INNER_ELIGIBLE',
    attemptTimestamp,
    foldIds,
    executionProvenance,
    terminalExecution,
  };
}

function makeRejectedAttempt(
  attemptNumber: number,
  candidateRecipeId: string,
  recipeFingerprint: string,
  complexityRank: number,
  attemptTimestamp: string,
  executionProvenance: MLBInnerDevelopmentAttemptExecutionProvenance,
  terminalExecution: MLBInnerDevelopmentAttemptTerminalSuccess,
  foldIds: string[] = ['fold-1'],
): MLBInnerDevelopmentAttemptRecord {
  return {
    attemptNumber,
    candidateRecipeId,
    recipeFingerprint,
    complexityRank,
    developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
    status: 'COMPLETED_INNER_REJECTED',
    attemptTimestamp,
    foldIds,
    executionProvenance,
    terminalExecution,
  };
}

function makeFailedAttempt(
  attemptNumber: number,
  candidateRecipeId: string,
  recipeFingerprint: string,
  complexityRank: number,
  attemptTimestamp: string,
  executionProvenance: MLBInnerDevelopmentAttemptExecutionProvenance,
  terminalExecution: MLBInnerDevelopmentAttemptTerminalFailure,
  foldIds: string[] = ['fold-1'],
): MLBInnerDevelopmentAttemptRecord {
  return {
    attemptNumber,
    candidateRecipeId,
    recipeFingerprint,
    complexityRank,
    developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
    status: 'FAILED',
    attemptTimestamp,
    foldIds,
    executionProvenance,
    terminalExecution,
  };
}

const VALID_PROVENANCE_SHA256 = 'a'.repeat(64);
const VALID_PROVENANCE_BYTE_LENGTH = 1234;
const VALID_ARTIFACT_ID = 'artifact-1';
const VALID_FOLD_PLAN_ID = 'fold-plan-1';

function makeValidProvenance(): MLBInnerDevelopmentAttemptExecutionProvenance {
  return {
    verifiedArtifactSha256: VALID_PROVENANCE_SHA256,
    verifiedArtifactByteLength: VALID_PROVENANCE_BYTE_LENGTH,
    artifactId: VALID_ARTIFACT_ID,
    foldPlanId: VALID_FOLD_PLAN_ID,
  };
}

function makeSuccessTerminal(
  foldIds: string[] = ['fold-1'],
  eligibility: 'INNER_ELIGIBLE' | 'INNER_REJECTED' = 'INNER_ELIGIBLE',
  candidateRecipeId = 'recipe-1',
): MLBInnerDevelopmentAttemptTerminalSuccess {
  const foldResults: MLBInnerFoldMetricResult[] = foldIds.map(foldId => ({
    contractVersion: 'mlb-inner-fold-metric-result-v1',
    foldId,
    candidateRecipeId,
    rowCount: 301,
    targetHomeWinCount: 160,
    targetAwayWinCount: 141,
    candidateLogLoss: 0.5,
    candidateBrierScore: 0.25,
    candidateRocAuc: 0.9,
    p50LogLoss: 0.55,
    p50BrierScore: 0.28,
    p50RocAuc: 0.88,
    foldTrainPriorLogLoss: 0.6,
    foldTrainPriorBrierScore: 0.3,
    foldTrainPriorRocAuc: 0.85,
    foldTrainPriorProbability: 0.5,
  }));
  return {
    kind: 'SUCCESS',
    lowLevelFitCount: foldResults.length,
    foldResults,
    aggregate: {
      contractVersion: 'mlb-inner-aggregate-result-v1',
      candidateRecipeId,
      foldCount: foldResults.length,
      aggregateValidationRowCount: 301 * foldResults.length,
      aggregateCandidateLogLoss: 0.5,
      aggregateCandidateBrierScore: 0.25,
      aggregateCandidateRocAuc: 0.9,
      aggregateP50LogLoss: 0.55,
      aggregateP50BrierScore: 0.28,
      aggregateP50RocAuc: 0.88,
      aggregateFoldTrainPriorLogLoss: 0.6,
      aggregateFoldTrainPriorBrierScore: 0.3,
      aggregateFoldTrainPriorRocAuc: 0.85,
      worstFoldCandidateLogLoss: 0.5,
      worstFoldCandidateBrierScore: 0.25,
      foldsBeatingP50OnLogLoss: 0,
      foldsBeatingP50OnBrier: 0,
      foldsBeatingFoldTrainPriorOnLogLoss: 0,
      foldsBeatingFoldTrainPriorOnBrier: 0,
    },
    gate: {
      eligibility,
      reasons: [],
    },
  };
}

function makeFailureTerminal(): MLBInnerDevelopmentAttemptTerminalFailure {
  return {
    kind: 'FAILURE',
    lowLevelFitCount: 0,
    failedFoldId: 'fold-1',
    issues: [],
  };
}

function makeLedger(
  budget: MLBInnerDevelopmentRecipeBudget,
  registeredRecipes: MLBInnerDevelopmentRegisteredRecipeRecord[],
  attempts: MLBInnerDevelopmentAttemptRecord[],
  createdAt = '2026-04-01T00:00:00.000Z',
  updatedAt = '2026-04-01T00:00:00.000Z',
): MLBInnerDevelopmentCampaignLedger {
  return {
    ledgerContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
    developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
    createdAt,
    updatedAt,
    budget,
    registeredRecipes,
    attempts,
  };
}

function issues(result: ReturnType<typeof validateMLBInnerDevelopmentCampaignLedger>): readonly MLBInnerDevelopmentCampaignLedgerIssue[] {
  if (result.ok) return [];
  return result.issues;
}

function anchorIssues(result: ReturnType<typeof validateMLBInnerDevelopmentCampaignAnchor>): readonly MLBInnerDevelopmentCampaignAnchorIssue[] {
  if (result.ok) return [];
  return result.issues;
}

describe('mlb-inner-development-campaign-ledger', () => {
  describe('constants', () => {
    it('freezes exact E4-A constants', () => {
      expect(MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION).toBe('mlb-inner-development-campaign-ledger-v1');
      expect(MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION).toBe('mlb-inner-development-campaign-anchor-v1');
      expect(MLB_INNER_DEVELOPMENT_CYCLE_ID).toBe('mlb-v1-train-only-inner-development-cycle-v1');
      expect(MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY).toBe('var/mlb-development/mlb-inner-development-campaign-ledger/');
      expect(MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME).toBe('mlb-v1-train-only-inner-development-cycle-v1-ledger.json');
      expect(MLB_INNER_DEVELOPMENT_CAMPAIGN_RESET_PREVENTION_ANCHOR).toBe('docs/mlb-v1-train-only-inner-development-campaign-marker.md');
      expect(MLB_INNER_DEVELOPMENT_MAX_DISTINCT_RECIPES).toBe(12);
      expect(MLB_INNER_DEVELOPMENT_ATTEMPT_STATUS_VALUES).toEqual([
        'REGISTERED',
        'RUNNING',
        'COMPLETED_INNER_ELIGIBLE',
        'COMPLETED_INNER_REJECTED',
        'FAILED',
        'INTERRUPTED',
      ]);
    });
  });

  describe('hostile runtime inputs', () => {
    it('rejects null ledger', () => {
      const result = validateMLBInnerDevelopmentCampaignLedger(null);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'NOT_PLAIN_OBJECT')).toBe(true);
    });

    it('rejects array ledger', () => {
      const result = validateMLBInnerDevelopmentCampaignLedger([]);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'NOT_PLAIN_OBJECT')).toBe(true);
    });

    it('rejects primitive ledger', () => {
      const result = validateMLBInnerDevelopmentCampaignLedger('ledger');
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'NOT_PLAIN_OBJECT')).toBe(true);
    });

    it('rejects top-level accessor without executing getter', () => {
      let getterExecuted = false;
      const ledger = {
        get ledgerContractVersion() { getterExecuted = true; return 'mlb-inner-development-campaign-ledger-v1'; },
        get developmentCycleId() { getterExecuted = true; return MLB_INNER_DEVELOPMENT_CYCLE_ID; },
        get createdAt() { getterExecuted = true; return '2026-04-01T00:00:00.000Z'; },
        get updatedAt() { getterExecuted = true; return '2026-04-01T00:00:00.000Z'; },
        get budget() { getterExecuted = true; return buildBudgetAndFingerprints(0, []).budget; },
        get registeredRecipes() { getterExecuted = true; return []; },
        get attempts() { getterExecuted = true; return []; },
      };
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'ACCESSOR_PROPERTY')).toBe(true);
      expect(getterExecuted).toBe(false);
    });

    it('rejects budget accessor without executing getter', () => {
      let budgetGetterExecuted = false;
      const ledger = {
        get budget() { budgetGetterExecuted = true; return buildBudgetAndFingerprints(0, []).budget; },
        ledgerContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
        developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
        registeredRecipes: [],
        attempts: [],
      };
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'ACCESSOR_PROPERTY')).toBe(true);
      expect(budgetGetterExecuted).toBe(false);
    });

    it('rejects recipe-record accessor without executing getter', () => {
      let recipeGetterExecuted = false;
      const { budget } = buildBudgetAndFingerprints(0, []);
      const ledger = makeLedger(
        budget,
        [{
          get candidateRecipeId() { recipeGetterExecuted = true; return 'recipe-1'; },
          get registrationSequence() { recipeGetterExecuted = true; return 1; },
          get registrationTimestamp() { recipeGetterExecuted = true; return '2026-04-01T00:00:00.000Z'; },
          get recipeFingerprint() { recipeGetterExecuted = true; return 'a'.repeat(64); },
          get complexityRank() { recipeGetterExecuted = true; return 1; },
          get preprocessingPolicyId() { recipeGetterExecuted = true; return 'prep-1'; },
          get featurePolicyId() { recipeGetterExecuted = true; return 'feat-1'; },
          get modelFamilyId() { recipeGetterExecuted = true; return 'model-1'; },
          get regularizationConfig() { recipeGetterExecuted = true; return {}; },
          get optimizerConfig() { recipeGetterExecuted = true; return {}; },
          get otherModelAffectingChoices() { recipeGetterExecuted = true; return {}; },
        }],
        [],
      );
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'ACCESSOR_PROPERTY')).toBe(true);
      expect(recipeGetterExecuted).toBe(false);
    });

    it('rejects attempt status accessor without executing getter', () => {
      let statusGetterExecuted = false;
      const { budget } = buildBudgetAndFingerprints(0, []);
      const malformedAttempt: unknown = {
        attemptNumber: 1,
        candidateRecipeId: 'recipe-1',
        recipeFingerprint: 'a'.repeat(64),
        complexityRank: 1,
        developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        get status() { statusGetterExecuted = true; return 'RUNNING'; },
        attemptTimestamp: '2026-04-01T00:00:00.000Z',
        foldIds: ['fold-1', 'fold-2', 'fold-3', 'fold-4'],
      };
      const ledger = makeLedger(budget, [], [malformedAttempt as MLBInnerDevelopmentAttemptRecord]);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'ACCESSOR_PROPERTY')).toBe(true);
      expect(statusGetterExecuted).toBe(false);
    });

    it('does not throw on cyclic input', () => {
      const cyclic: Record<string, unknown> = {
        ledgerContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
        developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
        budget: buildBudgetAndFingerprints(0, []).budget,
        registeredRecipes: [],
        attempts: [],
      };
      cyclic.self = cyclic;
      const result = validateMLBInnerDevelopmentCampaignLedger(cyclic);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'UNKNOWN_FIELD')).toBe(true);
    });

    it('rejects registeredRecipes numeric accessor without executing getter', () => {
      let indexGetterExecuted = false;
      const { budget } = buildBudgetAndFingerprints(0, []);
      const recipe: unknown = {
        candidateRecipeId: 'recipe-1',
        registrationSequence: 1,
        registrationTimestamp: '2026-04-01T00:00:00.000Z',
        recipeFingerprint: 'a'.repeat(64),
        complexityRank: 1,
        preprocessingPolicyId: 'prep-1',
        featurePolicyId: 'feat-1',
        modelFamilyId: 'model-1',
        regularizationConfig: {},
        optimizerConfig: {},
        otherModelAffectingChoices: {},
      };
      const recipes = [recipe];
      Object.defineProperty(recipes, '0', {
        get() { indexGetterExecuted = true; return recipe; },
        configurable: true,
        enumerable: true,
      });
      const ledger = makeLedger(budget, recipes as MLBInnerDevelopmentRegisteredRecipeRecord[], []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'ACCESSOR_PROPERTY')).toBe(true);
      expect(indexGetterExecuted).toBe(false);
    });

    it('rejects attempts numeric accessor without executing getter', () => {
      let indexGetterExecuted = false;
      const { budget } = buildBudgetAndFingerprints(0, []);
      const attempt: unknown = {
        attemptNumber: 1,
        candidateRecipeId: 'recipe-1',
        recipeFingerprint: 'a'.repeat(64),
        complexityRank: 1,
        developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        status: 'RUNNING',
        attemptTimestamp: '2026-04-01T00:00:00.000Z',
        foldIds: ['fold-1'],
      };
      const attempts = [attempt];
      Object.defineProperty(attempts, '0', {
        get() { indexGetterExecuted = true; return attempt; },
        configurable: true,
        enumerable: true,
      });
      const ledger = makeLedger(budget, [], attempts as MLBInnerDevelopmentAttemptRecord[]);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'ACCESSOR_PROPERTY')).toBe(true);
      expect(indexGetterExecuted).toBe(false);
    });

    it('rejects foldIds numeric accessor without executing getter', () => {
      let indexGetterExecuted = false;
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const foldId = 'fold-1';
      const foldIds = [foldId];
      Object.defineProperty(foldIds, '0', {
        get() { indexGetterExecuted = true; return foldId; },
        configurable: true,
        enumerable: true,
      });
      const attempt: unknown = {
        attemptNumber: 1,
        candidateRecipeId: 'recipe-1',
        recipeFingerprint: fp,
        complexityRank: 1,
        developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        status: 'RUNNING',
        attemptTimestamp: '2026-04-01T00:00:00.000Z',
        foldIds,
      };
      const ledger = makeLedger(budget, registered, [attempt as MLBInnerDevelopmentAttemptRecord]);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'ACCESSOR_PROPERTY')).toBe(true);
      expect(indexGetterExecuted).toBe(false);
    });

    it('rejects budget seenRecipeIds numeric accessor without executing getter', () => {
      let indexGetterExecuted = false;
      const { budget: baseBudget } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const ids = ['recipe-1'];
      Object.defineProperty(ids, '0', {
        get() { indexGetterExecuted = true; return 'recipe-1'; },
        configurable: true,
        enumerable: true,
      });
      const budget: unknown = {
        ...baseBudget,
        seenRecipeIds: ids,
      };
      const ledger = makeLedger(budget as MLBInnerDevelopmentRecipeBudget, [], []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'ACCESSOR_PROPERTY')).toBe(true);
      expect(indexGetterExecuted).toBe(false);
    });

    it('rejects budget seenRecipeFingerprints numeric accessor without executing getter', () => {
      let indexGetterExecuted = false;
      const { budget: baseBudget } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fps = ['a'.repeat(64)];
      Object.defineProperty(fps, '0', {
        get() { indexGetterExecuted = true; return 'a'.repeat(64); },
        configurable: true,
        enumerable: true,
      });
      const budget: unknown = {
        ...baseBudget,
        seenRecipeFingerprints: fps,
      };
      const ledger = makeLedger(budget as MLBInnerDevelopmentRecipeBudget, [], []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'ACCESSOR_PROPERTY')).toBe(true);
      expect(indexGetterExecuted).toBe(false);
    });

    it('rejects budget seenComplexityRanks numeric accessor without executing getter', () => {
      let indexGetterExecuted = false;
      const { budget: baseBudget } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const ranks = [1];
      Object.defineProperty(ranks, '0', {
        get() { indexGetterExecuted = true; return 1; },
        configurable: true,
        enumerable: true,
      });
      const budget: unknown = {
        ...baseBudget,
        seenComplexityRanks: ranks,
      };
      const ledger = makeLedger(budget as MLBInnerDevelopmentRecipeBudget, [], []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'ACCESSOR_PROPERTY')).toBe(true);
      expect(indexGetterExecuted).toBe(false);
    });

    it('rejects wrong-type seenRecipeIds element', () => {
      const ids = [42];
      const fps = ['a'.repeat(64)];
      const ranks = [1];
      const budget: unknown = {
        contractVersion: 'mlb-inner-development-recipe-budget-v1',
        cycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        maxDistinctRecipes: 12,
        seenRecipeIds: ids,
        seenRecipeFingerprints: fps,
        seenComplexityRanks: ranks,
        evaluationCount: 0,
      };
      const ledger = makeLedger(budget as MLBInnerDevelopmentRecipeBudget, [], []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_STRING')).toBe(true);
    });

    it('rejects wrong-type seenRecipeFingerprints element', () => {
      const { budget: baseBudget } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const { fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const fps = [{}];
      const ids = ['recipe-1'];
      const ranks = [1];
      const budget: unknown = {
        contractVersion: 'mlb-inner-development-recipe-budget-v1',
        cycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        maxDistinctRecipes: 12,
        seenRecipeIds: ids,
        seenRecipeFingerprints: fps,
        seenComplexityRanks: ranks,
        evaluationCount: 0,
      };
      const ledger = makeLedger(budget as MLBInnerDevelopmentRecipeBudget, [], []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_STRING')).toBe(true);
    });

    it('rejects wrong-type seenComplexityRanks element', () => {
      const ranks = ['1'];
      const ids = ['recipe-1'];
      const fps = ['a'.repeat(64)];
      const budget: unknown = {
        contractVersion: 'mlb-inner-development-recipe-budget-v1',
        cycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        maxDistinctRecipes: 12,
        seenRecipeIds: ids,
        seenRecipeFingerprints: fps,
        seenComplexityRanks: ranks,
        evaluationCount: 0,
      };
      const ledger = makeLedger(budget as MLBInnerDevelopmentRecipeBudget, [], []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_INTEGER')).toBe(true);
    });

    it('rejects wrong-type foldIds element', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt: unknown = {
        attemptNumber: 1,
        candidateRecipeId: 'recipe-1',
        recipeFingerprint: fp,
        complexityRank: 1,
        developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        status: 'RUNNING',
        attemptTimestamp: '2026-04-01T00:00:00.000Z',
        foldIds: [123],
      };
      const ledger = makeLedger(budget, registered, [attempt as MLBInnerDevelopmentAttemptRecord]);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_STRING')).toBe(true);
    });

    it('rejects ledger root symbol own property', () => {
      const sym = Symbol('ledger-symbol');
      const { budget } = buildBudgetAndFingerprints(0, []);
      const ledger: unknown = {
        ledgerContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
        developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
        budget,
        registeredRecipes: [],
        attempts: [],
        [sym]: 'value',
      };
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'UNKNOWN_FIELD')).toBe(true);
    });

    it('rejects registered recipe symbol own property', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const sym = Symbol('recipe-symbol');
      const recipe: unknown = {
        candidateRecipeId: 'recipe-1',
        registrationSequence: 1,
        registrationTimestamp: '2026-04-01T00:00:00.000Z',
        recipeFingerprint: fp,
        complexityRank: 1,
        preprocessingPolicyId: 'prep-1',
        featurePolicyId: 'feat-1',
        modelFamilyId: 'model-1',
        regularizationConfig: {},
        optimizerConfig: {},
        otherModelAffectingChoices: {},
        [sym]: 'value',
      };
      const ledger = makeLedger(budget, [recipe as MLBInnerDevelopmentRegisteredRecipeRecord], []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'UNKNOWN_FIELD')).toBe(true);
    });

    it('rejects attempt symbol own property', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const sym = Symbol('attempt-symbol');
      const attempt: unknown = {
        attemptNumber: 1,
        candidateRecipeId: 'recipe-1',
        recipeFingerprint: fp,
        complexityRank: 1,
        developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        status: 'RUNNING',
        attemptTimestamp: '2026-04-01T00:00:00.000Z',
        foldIds: ['fold-1'],
        [sym]: 'value',
      };
      const ledger = makeLedger(budget, [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)], [attempt as MLBInnerDevelopmentAttemptRecord]);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'UNKNOWN_FIELD')).toBe(true);
    });

    it('rejects budget symbol own property', () => {
      const { budget: baseBudget } = buildBudgetAndFingerprints(0, []);
      const sym = Symbol('budget-symbol');
      const budget: unknown = {
        ...baseBudget,
        [sym]: 'value',
      };
      const ledger = makeLedger(budget as MLBInnerDevelopmentRecipeBudget, [], []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'UNKNOWN_FIELD')).toBe(true);
    });

    it('rejects anchor symbol own property', () => {
      const sym = Symbol('anchor-symbol');
      const anchor: unknown = {
        anchorContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION,
        developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        canonicalLedgerDirectory: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY,
        canonicalLedgerFilename: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME,
        ledgerContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
        campaignIdentity: 'campaign',
        [sym]: 'value',
      };
      const result = validateMLBInnerDevelopmentCampaignAnchor(anchor);
      expect(result.ok).toBe(false);
      expect(anchorIssues(result).some(i => i.code === 'UNKNOWN_FIELD')).toBe(true);
    });
  });

  describe('empty genesis ledger', () => {
    it('validates canonical pre-candidate genesis shape', () => {
      const { budget } = buildBudgetAndFingerprints(0, []);
      const ledger = makeLedger(budget, [], []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(true);
    });
  });

  describe('one registered recipe', () => {
    it('validates ledger with one consumed distinct slot and one attempt', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempts = [makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), makeSuccessTerminal(['fold-1'], 'INNER_ELIGIBLE'))];
      const ledger = makeLedger(budget, registered, attempts, '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(true);
    });
  });

  describe('exact rerun', () => {
    it('validates ledger with one distinct recipe and two accepted executions', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(2, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempts = [
        makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), makeSuccessTerminal(['fold-1'], 'INNER_ELIGIBLE')),
        makeFailedAttempt(2, 'recipe-1', fp, 1, '2026-04-01T02:00:00.000Z', makeValidProvenance(), makeFailureTerminal()),
      ];
      const ledger = makeLedger(budget, registered, attempts, '2026-04-01T00:00:00.000Z', '2026-04-01T02:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(true);
    });
  });

  describe('twelve slot ledger', () => {
    it('validates ledger with 12 distinct recipes and matching attempts', () => {
      const ids = Array.from({ length: 12 }, (_, i) => `recipe-${i + 1}`);
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(12, ids);
      const registered: MLBInnerDevelopmentRegisteredRecipeRecord[] = [];
      for (const id of ids) {
        const fp = fingerprintByRecipeId.get(id)!;
        registered.push(makeRegisteredRecipe(id, registered.length + 1, '2026-04-01T00:00:00.000Z', fp));
      }
      const attempts = registered.map(r =>
        makeRejectedAttempt(1, r.candidateRecipeId, r.recipeFingerprint, r.complexityRank, '2026-04-01T01:00:00.000Z', makeValidProvenance(), makeSuccessTerminal(['fold-1'] as string[], 'INNER_REJECTED', r.candidateRecipeId)),
      );
      const ledger = makeLedger(budget, registered, attempts);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(true);
    });
  });

  describe('budget unknown fields', () => {
    it('rejects budget with createdAt field', () => {
      const { budget: baseBudget } = buildBudgetAndFingerprints(0, []);
      const budget: unknown = {
        ...baseBudget,
        createdAt: '2026-04-01T00:00:00.000Z',
      };
      const ledger = makeLedger(budget as MLBInnerDevelopmentRecipeBudget, [], []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'UNKNOWN_FIELD' && i.path === '$.budget.createdAt')).toBe(true);
    });

    it('rejects budget with nested budget field', () => {
      const { budget: baseBudget } = buildBudgetAndFingerprints(0, []);
      const budget: unknown = {
        ...baseBudget,
        budget: {},
      };
      const ledger = makeLedger(budget as MLBInnerDevelopmentRecipeBudget, [], []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'UNKNOWN_FIELD' && i.path === '$.budget.budget')).toBe(true);
    });

    it('rejects budget with ledgerContractVersion field', () => {
      const { budget: baseBudget } = buildBudgetAndFingerprints(0, []);
      const budget: unknown = {
        ...baseBudget,
        ledgerContractVersion: 'mlb-inner-development-campaign-ledger-v1',
      };
      const ledger = makeLedger(budget as MLBInnerDevelopmentRecipeBudget, [], []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'UNKNOWN_FIELD' && i.path === '$.budget.ledgerContractVersion')).toBe(true);
    });
  });

  describe('malformed reconciliation', () => {
    it('rejects budget recipe ID differs from recipe record', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const budgetWithWrongId: unknown = {
        ...budget,
        seenRecipeIds: ['recipe-x'],
      };
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const ledger = makeLedger(budgetWithWrongId as MLBInnerDevelopmentRecipeBudget, registered, []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'BUDGET_RECIPE_ID_MISMATCH')).toBe(true);
    });

    it('rejects budget fingerprint differs from recipe record', () => {
      const { budget } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', 'a'.repeat(64))];
      const ledger = makeLedger(budget, registered, []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'BUDGET_FINGERPRINT_MISMATCH')).toBe(true);
    });

    it('rejects budget complexity differs from recipe record', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const alteredBudget: unknown = {
        ...budget,
        seenComplexityRanks: [2],
      };
      const ledger = makeLedger(alteredBudget as MLBInnerDevelopmentRecipeBudget, registered, []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'BUDGET_COMPLEXITY_MISMATCH')).toBe(true);
    });

    it('rejects stored fingerprint differs from recomputed fingerprint', () => {
      const { fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const wrongFingerprint = 'b'.repeat(64);
      const budgetWithWrongFingerprint: unknown = {
        contractVersion: 'mlb-inner-development-recipe-budget-v1',
        cycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        maxDistinctRecipes: 12,
        seenRecipeIds: ['recipe-1'],
        seenRecipeFingerprints: [wrongFingerprint],
        seenComplexityRanks: [1],
        evaluationCount: 1,
      };
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', wrongFingerprint)];
      const ledger = makeLedger(budgetWithWrongFingerprint as MLBInnerDevelopmentRecipeBudget, registered, []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'RECIPE_FINGERPRINT_RECOMPUTE_MISMATCH')).toBe(true);
    });

    it('rejects duplicate registered recipe ID', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(2, ['recipe-1', 'recipe-2']);
      const fp1 = fingerprintByRecipeId.get('recipe-1')!;
      const fp2 = fingerprintByRecipeId.get('recipe-2')!;
      const registered = [
        makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp1),
        makeRegisteredRecipe('recipe-1', 2, '2026-04-01T00:00:00.000Z', fp2),
      ];
      const ledger = makeLedger(budget, registered, []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'DUPLICATE_REGISTERED_RECIPE_ID')).toBe(true);
    });

    it('rejects duplicate registered fingerprint', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(2, ['recipe-1', 'recipe-2']);
      const fp1 = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [
        makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp1),
        makeRegisteredRecipe('recipe-2', 2, '2026-04-01T00:00:00.000Z', fp1),
      ];
      const ledger = makeLedger(budget, registered, []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'DUPLICATE_REGISTERED_FINGERPRINT')).toBe(true);
    });

    it('rejects duplicate registration sequence', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(2, ['recipe-1', 'recipe-2']);
      const fp1 = fingerprintByRecipeId.get('recipe-1')!;
      const fp2 = fingerprintByRecipeId.get('recipe-2')!;
      const registered = [
        makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp1),
        makeRegisteredRecipe('recipe-2', 1, '2026-04-01T00:00:00.000Z', fp2),
      ];
      const ledger = makeLedger(budget, registered, []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'DUPLICATE_REGISTRATION_SEQUENCE')).toBe(true);
    });

    it('rejects recipe count differs from budget distinct count', () => {
      const { budget } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const registered: MLBInnerDevelopmentRegisteredRecipeRecord[] = [];
      const ledger = makeLedger(budget, registered, []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'RECIPE_COUNT_MISMATCH')).toBe(true);
    });

    it('rejects attempt referencing unknown candidateRecipeId', () => {
      const { budget } = buildBudgetAndFingerprints(0, []);
      const registered: MLBInnerDevelopmentRegisteredRecipeRecord[] = [];
      const attempt = makeRunningAttempt(1, 'recipe-unknown', 'a'.repeat(64), 1, '2026-04-01T00:00:00.000Z', makeValidProvenance());
      const ledger = makeLedger(budget, registered, [attempt]);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'UNREGISTERED_RECIPE_REFERENCE')).toBe(true);
    });

    it('rejects attempt fingerprint mismatch', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeRunningAttempt(1, 'recipe-1', 'b'.repeat(64), 1, '2026-04-01T00:00:00.000Z', makeValidProvenance());
      const ledger = makeLedger(budget, registered, [attempt]);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'FINGERPRINT_MISMATCH')).toBe(true);
    });

    it('rejects attempt complexity mismatch', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeRunningAttempt(1, 'recipe-1', fp, 2, '2026-04-01T00:00:00.000Z', makeValidProvenance());
      const ledger = makeLedger(budget, registered, [attempt]);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'COMPLEXITY_RANK_MISMATCH')).toBe(true);
    });

    it('rejects attempt wrong cycle', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt: unknown = {
        attemptNumber: 1,
        candidateRecipeId: 'recipe-1',
        recipeFingerprint: fp,
        complexityRank: 1,
        developmentCycleId: 'wrong-cycle',
        status: 'RUNNING',
        attemptTimestamp: '2026-04-01T00:00:00.000Z',
        foldIds: ['fold-1', 'fold-2', 'fold-3', 'fold-4'],
      };
      const ledger = makeLedger(budget, registered, [attempt as MLBInnerDevelopmentAttemptRecord]);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'CYCLE_MISMATCH')).toBe(true);
    });

    it('rejects attempt count vs evaluationCount mismatch', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(2, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempts = [makeRunningAttempt(1, 'recipe-1', fp, 1, '2026-04-01T00:00:00.000Z', makeValidProvenance())];
      const ledger = makeLedger(budget, registered, attempts);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'ATTEMPT_COUNT_MISMATCH')).toBe(true);
    });

    it('rejects wrong ledger cycle', () => {
      const { budget } = buildBudgetAndFingerprints(0, []);
      const ledger: unknown = {
        ...makeLedger(budget, [], []),
        developmentCycleId: 'wrong-cycle',
      };
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_LITERAL')).toBe(true);
    });

    it('rejects wrong ledger contract version', () => {
      const { budget } = buildBudgetAndFingerprints(0, []);
      const ledger: unknown = {
        ...makeLedger(budget, [], []),
        ledgerContractVersion: 'wrong-version',
      };
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_LITERAL')).toBe(true);
    });

    it('rejects wrong budget version', () => {
      const { budget: baseBudget } = buildBudgetAndFingerprints(0, []);
      const alteredBudget: unknown = {
        ...baseBudget,
        contractVersion: 'wrong-version',
      };
      const ledger = makeLedger(alteredBudget as MLBInnerDevelopmentRecipeBudget, [], []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_LITERAL')).toBe(true);
    });

    it('rejects maxDistinctRecipes != 12', () => {
      const { budget: baseBudget } = buildBudgetAndFingerprints(0, []);
      const alteredBudget: unknown = {
        ...baseBudget,
        maxDistinctRecipes: 10,
      };
      const ledger = makeLedger(alteredBudget as MLBInnerDevelopmentRecipeBudget, [], []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_NUMBER')).toBe(true);
    });
  });

  describe('timestamp validation', () => {
    it('rejects malformed createdAt', () => {
      const { budget } = buildBudgetAndFingerprints(0, []);
      const ledger = makeLedger(budget, [], [], 'not-a-date', '2026-04-01T00:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_TIMESTAMP')).toBe(true);
    });

    it('rejects updatedAt before createdAt', () => {
      const { budget } = buildBudgetAndFingerprints(0, []);
      const ledger = makeLedger(budget, [], [], '2026-04-02T00:00:00.000Z', '2026-04-01T00:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'TIMESTAMP_ORDER_VIOLATION')).toBe(true);
    });
  });

  describe('determinism and mutation', () => {
    it('does not mutate input', () => {
      const { budget } = buildBudgetAndFingerprints(0, []);
      const ledger = makeLedger(budget, [], []);
      const before = JSON.stringify(ledger);
      validateMLBInnerDevelopmentCampaignLedger(ledger);
      const after = JSON.stringify(ledger);
      expect(before).toBe(after);
    });

    it('is deterministic across repeated validation', () => {
      const { budget } = buildBudgetAndFingerprints(0, []);
      const ledger = makeLedger(budget, [], []);
      const r1 = validateMLBInnerDevelopmentCampaignLedger(ledger);
      const r2 = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(r1.ok).toBe(r2.ok);
      if (!r1.ok && !r2.ok) {
        expect(JSON.stringify(r1.issues)).toBe(JSON.stringify(r2.issues));
      }
    });
  });

  describe('anchor validation', () => {
    it('validates a conforming anchor', () => {
      const anchor: MLBInnerDevelopmentCampaignAnchor = {
        anchorContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION,
        developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        canonicalLedgerDirectory: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY,
        canonicalLedgerFilename: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME,
        ledgerContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
        campaignIdentity: 'mlb-v1-train-only-inner-development-cycle-v1',
      };
      const result = validateMLBInnerDevelopmentCampaignAnchor(anchor);
      expect(result.ok).toBe(true);
    });

    it('rejects anchor accessor without executing getter', () => {
      let getterExecuted = false;
      const anchor = {
        get anchorContractVersion() { getterExecuted = true; return MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION; },
        get developmentCycleId() { getterExecuted = true; return MLB_INNER_DEVELOPMENT_CYCLE_ID; },
        get canonicalLedgerDirectory() { getterExecuted = true; return MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY; },
        get canonicalLedgerFilename() { getterExecuted = true; return MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME; },
        get ledgerContractVersion() { getterExecuted = true; return MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION; },
        get campaignIdentity() { getterExecuted = true; return 'campaign'; },
      };
      const result = validateMLBInnerDevelopmentCampaignAnchor(anchor);
      expect(result.ok).toBe(false);
      expect(getterExecuted).toBe(false);
    });

    it('rejects wrong anchor contract version', () => {
      const anchor: unknown = {
        anchorContractVersion: 'wrong',
        developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        canonicalLedgerDirectory: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY,
        canonicalLedgerFilename: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME,
        ledgerContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
        campaignIdentity: 'campaign',
      };
      const result = validateMLBInnerDevelopmentCampaignAnchor(anchor);
      expect(result.ok).toBe(false);
    });
  });

  describe('attempt status enum', () => {
    it('accepts frozen REGISTERED/INTERRUPTED base-only shape', () => {
      for (const status of ['REGISTERED', 'INTERRUPTED'] as const) {
        const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
        const fp = fingerprintByRecipeId.get('recipe-1')!;
        const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
        const attempt = status === 'REGISTERED'
          ? makeRegisteredAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z')
          : makeInterruptedAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z');
        const ledger = makeLedger(budget, registered, [attempt]);
        const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
        expect(result.ok).toBe(true);
      }
    });

    it('accepts frozen RUNNING shape with provenance', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeRunningAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance());
      const ledger = makeLedger(budget, registered, [attempt]);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(true);
    });

    it('accepts frozen terminal shapes with provenance and terminal evidence', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const eligibleAttempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), makeSuccessTerminal(['fold-1'], 'INNER_ELIGIBLE'));
      const rejectedAttempt = makeRejectedAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), makeSuccessTerminal(['fold-1'] as string[], 'INNER_REJECTED'));
      const failedAttempt = makeFailedAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), makeFailureTerminal());
      const ledger1 = makeLedger(budget, registered, [eligibleAttempt]);
      const ledger2 = makeLedger(budget, registered, [rejectedAttempt]);
      const ledger3 = makeLedger(budget, registered, [failedAttempt]);
      expect(validateMLBInnerDevelopmentCampaignLedger(ledger1).ok).toBe(true);
      expect(validateMLBInnerDevelopmentCampaignLedger(ledger2).ok).toBe(true);
      expect(validateMLBInnerDevelopmentCampaignLedger(ledger3).ok).toBe(true);
    });

    it('rejects invalid status string', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt: unknown = {
        attemptNumber: 1,
        candidateRecipeId: 'recipe-1',
        recipeFingerprint: fp,
        complexityRank: 1,
        developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        status: 'UNKNOWN_STATUS',
        attemptTimestamp: '2026-04-01T01:00:00.000Z',
        foldIds: ['fold-1', 'fold-2', 'fold-3', 'fold-4'],
      };
      const ledger = makeLedger(budget, registered, [attempt as MLBInnerDevelopmentAttemptRecord]);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_STATUS')).toBe(true);
    });
  });

  describe('budget validation', () => {
    it('rejects budget with >12 distinct recipes', () => {
      const ids = Array.from({ length: 13 }, (_, i) => `recipe-${i + 1}`);
      const { budget } = buildBudgetAndFingerprints(13, ids);
      const ledger = makeLedger(budget, [], []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_NUMBER')).toBe(true);
    });

    it('rejects null seenRecipeIds element', () => {
      const { budget: baseBudget } = buildBudgetAndFingerprints(0, []);
      const budget: unknown = {
        ...baseBudget,
        seenRecipeIds: [null],
        seenRecipeFingerprints: ['a'.repeat(64)],
        seenComplexityRanks: [1],
        evaluationCount: 1,
      };
      const ledger = makeLedger(budget as MLBInnerDevelopmentRecipeBudget, [], []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_STRING')).toBe(true);
    });

    it('rejects null seenRecipeFingerprints element', () => {
      const { budget: baseBudget } = buildBudgetAndFingerprints(0, []);
      const budget: unknown = {
        ...baseBudget,
        seenRecipeIds: ['recipe-1'],
        seenRecipeFingerprints: [null],
        seenComplexityRanks: [1],
        evaluationCount: 1,
      };
      const ledger = makeLedger(budget as MLBInnerDevelopmentRecipeBudget, [], []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_STRING')).toBe(true);
    });

    it('rejects null seenComplexityRanks element', () => {
      const { budget: baseBudget } = buildBudgetAndFingerprints(0, []);
      const budget: unknown = {
        ...baseBudget,
        seenRecipeIds: ['recipe-1'],
        seenRecipeFingerprints: ['a'.repeat(64)],
        seenComplexityRanks: [null],
        evaluationCount: 1,
      };
      const ledger = makeLedger(budget as MLBInnerDevelopmentRecipeBudget, [], []);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_INTEGER')).toBe(true);
    });
  });

  describe('null hostile regressions', () => {
    it('rejects null registeredRecipes element', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempts = [makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), makeSuccessTerminal(['fold-1'], 'INNER_ELIGIBLE'))];
      const ledger = makeLedger(budget, [null as unknown as MLBInnerDevelopmentRegisteredRecipeRecord, ...registered], attempts);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'NOT_PLAIN_OBJECT')).toBe(true);
    });

    it('rejects null attempts element', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempts = [null as unknown as MLBInnerDevelopmentAttemptRecord, makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), makeSuccessTerminal(['fold-1'], 'INNER_ELIGIBLE'))];
      const ledger = makeLedger(budget, registered, attempts);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'NOT_PLAIN_OBJECT')).toBe(true);
    });

    it('rejects null foldIds element', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const baseAttempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), makeSuccessTerminal(['fold-1'], 'INNER_ELIGIBLE'));
      const ledger: unknown = {
        ledgerContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
        developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T01:00:00.000Z',
        budget,
        registeredRecipes: registered,
        attempts: [
          {
            ...baseAttempt,
            foldIds: [null, 'fold-2', 'fold-3', 'fold-4'],
          },
        ],
      };
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_STRING')).toBe(true);
    });
  });

  describe('attempt identity invariants', () => {
    it('rejects duplicate attemptNumber for same candidate', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(2, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempts = [
        makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), makeSuccessTerminal(['fold-1'], 'INNER_ELIGIBLE')),
        makeFailedAttempt(1, 'recipe-1', fp, 1, '2026-04-01T02:00:00.000Z', makeValidProvenance(), makeFailureTerminal()),
      ];
      const ledger = makeLedger(budget, registered, attempts);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_INTEGER')).toBe(true);
    });

    it('rejects first attemptNumber not equal to 1 for a candidate', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(2, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempts = [makeEligibleAttempt(2, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), makeSuccessTerminal(['fold-1'], 'INNER_ELIGIBLE'))];
      const ledger = makeLedger(budget, registered, attempts);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_INTEGER')).toBe(true);
    });

    it('rejects attemptNumber 0', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempts = [makeEligibleAttempt(0, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), makeSuccessTerminal(['fold-1'], 'INNER_ELIGIBLE'))];
      const ledger = makeLedger(budget, registered, attempts);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_INTEGER')).toBe(true);
    });

    it('rejects negative attemptNumber', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempts = [makeEligibleAttempt(-1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), makeSuccessTerminal(['fold-1'], 'INNER_ELIGIBLE'))];
      const ledger = makeLedger(budget, registered, attempts);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_INTEGER')).toBe(true);
    });

    it('accepts valid exact rerun with incremented attemptNumber', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(2, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempts = [
        makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), makeSuccessTerminal(['fold-1'], 'INNER_ELIGIBLE')),
        makeFailedAttempt(2, 'recipe-1', fp, 1, '2026-04-01T02:00:00.000Z', makeValidProvenance(), makeFailureTerminal()),
      ];
      const ledger = makeLedger(budget, registered, attempts);
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(true);
    });
  });

  describe('terminal success lossless round trip', () => {
    const canonicalFoldIds = ['FOLD_1', 'FOLD_2', 'FOLD_3', 'FOLD_4'];
    const rowCounts = [51, 55, 55, 49];

    function makeFourFoldSuccess(candidateRecipeId = 'recipe-1'): MLBInnerDevelopmentAttemptTerminalSuccess {
      const foldResults: MLBInnerFoldMetricResult[] = canonicalFoldIds.map((foldId, idx) => ({
        contractVersion: 'mlb-inner-fold-metric-result-v1',
        foldId,
        candidateRecipeId,
        rowCount: rowCounts[idx],
        targetHomeWinCount: Math.floor(rowCounts[idx] / 2),
        targetAwayWinCount: rowCounts[idx] - Math.floor(rowCounts[idx] / 2),
        candidateLogLoss: 0.5 + idx * 0.01,
        candidateBrierScore: 0.25 + idx * 0.01,
        candidateRocAuc: 0.9 - idx * 0.01,
        p50LogLoss: 0.55 + idx * 0.01,
        p50BrierScore: 0.28 + idx * 0.01,
        p50RocAuc: 0.88 - idx * 0.01,
        foldTrainPriorLogLoss: 0.6 + idx * 0.01,
        foldTrainPriorBrierScore: 0.3 + idx * 0.01,
        foldTrainPriorRocAuc: 0.85 - idx * 0.01,
        foldTrainPriorProbability: 0.5,
      }));
      const aggregateValidationRowCount = rowCounts.reduce((sum, count) => sum + count, 0);
      return {
        kind: 'SUCCESS',
        lowLevelFitCount: foldResults.length,
        foldResults,
        aggregate: {
          contractVersion: 'mlb-inner-aggregate-result-v1',
          candidateRecipeId,
          foldCount: foldResults.length,
          aggregateValidationRowCount,
          aggregateCandidateLogLoss: 0.5,
          aggregateCandidateBrierScore: 0.25,
          aggregateCandidateRocAuc: 0.9,
          aggregateP50LogLoss: 0.55,
          aggregateP50BrierScore: 0.28,
          aggregateP50RocAuc: 0.88,
          aggregateFoldTrainPriorLogLoss: 0.6,
          aggregateFoldTrainPriorBrierScore: 0.3,
          aggregateFoldTrainPriorRocAuc: 0.85,
          worstFoldCandidateLogLoss: 0.51,
          worstFoldCandidateBrierScore: 0.26,
          foldsBeatingP50OnLogLoss: 2,
          foldsBeatingP50OnBrier: 2,
          foldsBeatingFoldTrainPriorOnLogLoss: 1,
          foldsBeatingFoldTrainPriorOnBrier: 1,
        },
        gate: {
          eligibility: 'INNER_ELIGIBLE',
          reasons: [],
        },
      };
    }

    it('validates four-fold SUCCESS terminal evidence losslessly', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const terminal = makeFourFoldSuccess('recipe-1');
      const attempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), terminal, canonicalFoldIds);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(true);
      const normalized = result.ok ? (result.value.attempts[0] as MLBInnerDevelopmentAttemptRecord) : null;
      expect(normalized).not.toBeNull();
      const normalizedAttempt = normalized as MLBInnerDevelopmentAttemptRecord;
      expect((normalizedAttempt as unknown as { executionProvenance: MLBInnerDevelopmentAttemptExecutionProvenance }).executionProvenance).toEqual((attempt as unknown as { executionProvenance: MLBInnerDevelopmentAttemptExecutionProvenance }).executionProvenance);
      expect((normalizedAttempt as unknown as { terminalExecution: MLBInnerDevelopmentAttemptTerminalSuccess }).terminalExecution).toEqual((attempt as unknown as { terminalExecution: MLBInnerDevelopmentAttemptTerminalSuccess }).terminalExecution);
    });

    it('rejects fold result with unknown field', () => {
      const terminal = makeFourFoldSuccess('recipe-1');
      const unknownFold = { ...terminal.foldResults[0], unknownField: 1 };
      const invalidTerminal = {
        ...terminal,
        foldResults: [unknownFold, ...terminal.foldResults.slice(1)],
      };
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), invalidTerminal as unknown as MLBInnerDevelopmentAttemptTerminalSuccess, canonicalFoldIds);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'UNKNOWN_FIELD' && i.path === '$.attempts[0].terminalExecution.foldResults[0].unknownField')).toBe(true);
    });

    it('rejects aggregate with unknown field', () => {
      const terminal = makeFourFoldSuccess('recipe-1');
      const invalidAggregate = { ...terminal.aggregate, unknownField: 1 };
      const invalidTerminal = { ...terminal, aggregate: invalidAggregate };
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), invalidTerminal as unknown as MLBInnerDevelopmentAttemptTerminalSuccess, canonicalFoldIds);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'UNKNOWN_FIELD' && i.path === '$.attempts[0].terminalExecution.aggregate.unknownField')).toBe(true);
    });

    it('rejects gate with unknown field', () => {
      const terminal = makeFourFoldSuccess('recipe-1');
      const invalidGate = { ...terminal.gate, unknownField: 1 };
      const invalidTerminal = { ...terminal, gate: invalidGate };
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), invalidTerminal as unknown as MLBInnerDevelopmentAttemptTerminalSuccess, canonicalFoldIds);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'UNKNOWN_FIELD' && i.path === '$.attempts[0].terminalExecution.gate.unknownField')).toBe(true);
    });

    it('rejects fold result missing required field', () => {
      const terminal = makeFourFoldSuccess('recipe-1');
      const invalidFold = { ...terminal.foldResults[0] };
      delete (invalidFold as Record<string, unknown>).contractVersion;
      const invalidTerminal = {
        ...terminal,
        foldResults: [invalidFold as unknown as MLBInnerFoldMetricResult, ...terminal.foldResults.slice(1)],
      };
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), invalidTerminal as unknown as MLBInnerDevelopmentAttemptTerminalSuccess, canonicalFoldIds);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'MISSING_FIELD' && i.path === '$.attempts[0].terminalExecution.foldResults[0].contractVersion')).toBe(true);
    });

    it('rejects aggregate missing required field', () => {
      const terminal = makeFourFoldSuccess('recipe-1');
      const invalidAggregate = { ...terminal.aggregate };
      delete (invalidAggregate as Record<string, unknown>).candidateRecipeId;
      const invalidTerminal = { ...terminal, aggregate: invalidAggregate as unknown as MLBInnerAggregateResult };
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), invalidTerminal as unknown as MLBInnerDevelopmentAttemptTerminalSuccess, canonicalFoldIds);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'MISSING_FIELD' && i.path === '$.attempts[0].terminalExecution.aggregate.candidateRecipeId')).toBe(true);
    });

    it('rejects gate missing required field', () => {
      const terminal = makeFourFoldSuccess('recipe-1');
      const invalidGate = { ...terminal.gate };
      delete (invalidGate as Record<string, unknown>).eligibility;
      const invalidTerminal = { ...terminal, gate: invalidGate as unknown as MLBInnerCandidateGateResult };
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), invalidTerminal as unknown as MLBInnerDevelopmentAttemptTerminalSuccess, canonicalFoldIds);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'MISSING_FIELD' && i.path === '$.attempts[0].terminalExecution.gate.eligibility')).toBe(true);
    });

    it('rejects NaN fold metric', () => {
      const terminal = makeFourFoldSuccess('recipe-1');
      const invalidFold = { ...terminal.foldResults[0], candidateLogLoss: NaN };
      const invalidTerminal = {
        ...terminal,
        foldResults: [invalidFold as unknown as MLBInnerFoldMetricResult, ...terminal.foldResults.slice(1)],
      };
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), invalidTerminal as unknown as MLBInnerDevelopmentAttemptTerminalSuccess, canonicalFoldIds);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'NONFINITE_METRIC')).toBe(true);
    });

    it('rejects Infinity aggregate metric', () => {
      const terminal = makeFourFoldSuccess('recipe-1');
      const invalidAggregate = { ...terminal.aggregate, aggregateCandidateLogLoss: Infinity };
      const invalidTerminal = { ...terminal, aggregate: invalidAggregate };
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), invalidTerminal as unknown as MLBInnerDevelopmentAttemptTerminalSuccess, canonicalFoldIds);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'NONFINITE_METRIC')).toBe(true);
    });

    it('rejects non-positive fold rowCount', () => {
      const terminal = makeFourFoldSuccess('recipe-1');
      const invalidFold = { ...terminal.foldResults[0], rowCount: 0 };
      const invalidTerminal = {
        ...terminal,
        foldResults: [invalidFold as unknown as MLBInnerFoldMetricResult, ...terminal.foldResults.slice(1)],
      };
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), invalidTerminal as unknown as MLBInnerDevelopmentAttemptTerminalSuccess, canonicalFoldIds);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_INTEGER')).toBe(true);
    });

    it('rejects invalid aggregate foldCount', () => {
      const terminal = makeFourFoldSuccess('recipe-1');
      const invalidAggregate = { ...terminal.aggregate, foldCount: 0 };
      const invalidTerminal = { ...terminal, aggregate: invalidAggregate };
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), invalidTerminal as unknown as MLBInnerDevelopmentAttemptTerminalSuccess, canonicalFoldIds);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_INTEGER')).toBe(true);
    });

    it('rejects beating count less than zero', () => {
      const terminal = makeFourFoldSuccess('recipe-1');
      const invalidAggregate = { ...terminal.aggregate, foldsBeatingP50OnLogLoss: -1 };
      const invalidTerminal = { ...terminal, aggregate: invalidAggregate };
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), invalidTerminal as unknown as MLBInnerDevelopmentAttemptTerminalSuccess, canonicalFoldIds);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_INTEGER')).toBe(true);
    });

    it('rejects beating count greater than foldCount', () => {
      const terminal = makeFourFoldSuccess('recipe-1');
      const invalidAggregate = { ...terminal.aggregate, foldsBeatingP50OnLogLoss: 99 };
      const invalidTerminal = { ...terminal, aggregate: invalidAggregate };
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), invalidTerminal as unknown as MLBInnerDevelopmentAttemptTerminalSuccess, canonicalFoldIds);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_INTEGER')).toBe(true);
    });

    it('rejects class count mismatch', () => {
      const terminal = makeFourFoldSuccess('recipe-1');
      const invalidFold = { ...terminal.foldResults[0], targetHomeWinCount: 999, targetAwayWinCount: 1 };
      const invalidTerminal = {
        ...terminal,
        foldResults: [invalidFold as unknown as MLBInnerFoldMetricResult, ...terminal.foldResults.slice(1)],
      };
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), invalidTerminal as unknown as MLBInnerDevelopmentAttemptTerminalSuccess, canonicalFoldIds);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'CLASS_COUNT_MISMATCH')).toBe(true);
    });

    it('rejects candidate recipeId mismatch in fold result', () => {
      const terminal = makeFourFoldSuccess('recipe-1');
      const invalidFold = { ...terminal.foldResults[0], candidateRecipeId: 'other-recipe' };
      const invalidTerminal = {
        ...terminal,
        foldResults: [invalidFold as unknown as MLBInnerFoldMetricResult, ...terminal.foldResults.slice(1)],
      };
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), invalidTerminal as unknown as MLBInnerDevelopmentAttemptTerminalSuccess, canonicalFoldIds);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'MIXED_CANDIDATE_RECIPE_ID')).toBe(true);
    });

    it('rejects candidate recipeId mismatch in aggregate', () => {
      const terminal = makeFourFoldSuccess('recipe-1');
      const invalidAggregate = { ...terminal.aggregate, candidateRecipeId: 'other-recipe' };
      const invalidTerminal = { ...terminal, aggregate: invalidAggregate };
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), invalidTerminal as unknown as MLBInnerDevelopmentAttemptTerminalSuccess, canonicalFoldIds);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'IDENTITY_MISMATCH')).toBe(true);
    });

    it('rejects foldId not matching attempt.foldIds', () => {
      const terminal = makeFourFoldSuccess('recipe-1');
      const invalidFold = { ...terminal.foldResults[0], foldId: 'UNKNOWN' };
      const invalidTerminal = {
        ...terminal,
        foldResults: [invalidFold as unknown as MLBInnerFoldMetricResult, ...terminal.foldResults.slice(1)],
      };
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), invalidTerminal as unknown as MLBInnerDevelopmentAttemptTerminalSuccess, canonicalFoldIds);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_FOLD_SET')).toBe(true);
    });

    it('rejects duplicate foldIds', () => {
      const terminal = makeFourFoldSuccess('recipe-1');
      const duplicateFolds = [
        terminal.foldResults[0],
        { ...terminal.foldResults[1], foldId: 'FOLD_1' },
        terminal.foldResults[2],
        terminal.foldResults[3],
      ];
      const invalidTerminal = { ...terminal, foldResults: duplicateFolds };
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), invalidTerminal as unknown as MLBInnerDevelopmentAttemptTerminalSuccess, canonicalFoldIds);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_FOLD_SET')).toBe(true);
    });

    it('rejects mismatched aggregate foldCount', () => {
      const terminal = makeFourFoldSuccess('recipe-1');
      const invalidAggregate = { ...terminal.aggregate, foldCount: 99 };
      const invalidTerminal = { ...terminal, aggregate: invalidAggregate };
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), invalidTerminal as unknown as MLBInnerDevelopmentAttemptTerminalSuccess, canonicalFoldIds);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_FOLD_SET')).toBe(true);
    });

    it('rejects mismatched foldResults length', () => {
      const terminal = makeFourFoldSuccess('recipe-1');
      const invalidTerminal = { ...terminal, foldResults: terminal.foldResults.slice(0, 2) };
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), invalidTerminal as unknown as MLBInnerDevelopmentAttemptTerminalSuccess, canonicalFoldIds);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'INVALID_FOLD_SET')).toBe(true);
    });

    it('rejects ELIGIBLE status with INNER_REJECTED gate', () => {
      const terminal = makeFourFoldSuccess('recipe-1');
      const invalidTerminal = { ...terminal, gate: { eligibility: 'INNER_REJECTED', reasons: [] } };
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeEligibleAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), invalidTerminal as unknown as MLBInnerDevelopmentAttemptTerminalSuccess, canonicalFoldIds);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'GATE_STATUS_MISMATCH')).toBe(true);
    });

    it('rejects REJECTED status with INNER_ELIGIBLE gate', () => {
      const terminal = makeFourFoldSuccess('recipe-1');
      const invalidTerminal = { ...terminal, gate: { eligibility: 'INNER_ELIGIBLE', reasons: [] } };
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const attempt = makeRejectedAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), invalidTerminal as unknown as MLBInnerDevelopmentAttemptTerminalSuccess, canonicalFoldIds);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(false);
      expect(issues(result).some(i => i.code === 'GATE_STATUS_MISMATCH')).toBe(true);
    });

    it('accepts valid FAILED terminal with lowLevelFitCount 0', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const terminal = {
        kind: 'FAILURE',
        lowLevelFitCount: 0,
        failedFoldId: 'FOLD_1',
        issues: [{ code: 'FOLD_FIT_FAILURE', path: '$.folds[0]', message: 'fit failed' }],
      } as unknown as MLBInnerDevelopmentAttemptTerminalFailure;
      const attempt = makeFailedAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), terminal);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(true);
    });

    it('accepts valid FAILED terminal with lowLevelFitCount 3', () => {
      const { budget, fingerprintByRecipeId } = buildBudgetAndFingerprints(1, ['recipe-1']);
      const fp = fingerprintByRecipeId.get('recipe-1')!;
      const registered = [makeRegisteredRecipe('recipe-1', 1, '2026-04-01T00:00:00.000Z', fp)];
      const terminal = {
        kind: 'FAILURE',
        lowLevelFitCount: 3,
        failedFoldId: 'FOLD_2',
        issues: [
          { code: 'FOLD_FIT_FAILURE', path: '$.folds[1]', message: 'fit failed' },
          { code: 'FOLD_FIT_FAILURE', path: '$.folds[2]', message: 'fit failed' },
          { code: 'FOLD_FIT_FAILURE', path: '$.folds[3]', message: 'fit failed' },
        ],
      } as unknown as MLBInnerDevelopmentAttemptTerminalFailure;
      const attempt = makeFailedAttempt(1, 'recipe-1', fp, 1, '2026-04-01T01:00:00.000Z', makeValidProvenance(), terminal);
      const ledger = makeLedger(budget, registered, [attempt], '2026-04-01T00:00:00.000Z', '2026-04-01T01:00:00.000Z');
      const result = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(result.ok).toBe(true);
    });
  });
});
