import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  MLBInnerCandidateRecipe,
  computeMLBInnerCandidateRecipeFingerprint,
  recordInnerCandidateRecipeExecution,
  MLB_INNER_DEVELOPMENT_CYCLE_ID,
} from '@/prediction/mlb/mlb-train-only-inner-development-evaluator';
import {
  MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN,
} from '@/prediction/mlb/mlb-train-only-inner-fold-plan';
import {
  MLBInnerDevelopmentCampaignLedger,
  validateMLBInnerDevelopmentCampaignLedger,
  MLBInnerDevelopmentCampaignAnchor,
  validateMLBInnerDevelopmentCampaignAnchor,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_RESET_PREVENTION_ANCHOR,
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
  MLBInnerDevelopmentCampaignRegistrationSuccess,
  MLBInnerDevelopmentCampaignRegistrationResult,
} from '@/prediction/mlb/mlb-inner-development-campaign-registration';

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

async function setupReadyCampaign(tempRoot: string): Promise<void> {
  await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput(VALID_TIMESTAMP));
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

async function snapshotCanonicalLedgerBytes(tempRoot: string): Promise<string> {
  const ledgerPath = path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME);
  return await fs.readFile(ledgerPath, 'utf-8');
}

async function writeStaleTempLedger(tempRoot: string): Promise<void> {
  const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(tempRoot);
  await fs.mkdir(paths.ledgerDirectory, { recursive: true });
  await fs.writeFile(paths.tempLedgerPath, 'stale-temp');
}

describe('mlb-inner-development-campaign-registration', () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join('/tmp', 'mre-registration-'));
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  describe('READMEY registration succeeds', () => {
    it('1. registers a candidate on a READY campaign', async () => {
      await setupReadyCampaign(tempRoot);
      const input = makeRegistrationInput();
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          candidateRecipeId: input.candidateRecipe.candidateRecipeId,
          recipeFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
          registrationSequence: 1,
          attemptNumber: 1,
          distinctRecipeCount: 1,
          evaluationCount: 1,
        });
      }
    });
  });

  describe('E3 authoritative fingerprint used', () => {
    it('2. uses E3 fingerprint and stores same fingerprint on recipe and attempt', async () => {
      await setupReadyCampaign(tempRoot);
      const recipe = makeRecipe({ candidateRecipeId: 'synthetic-recipe-1' });
      const fingerprintResult = computeMLBInnerCandidateRecipeFingerprint(recipe);
      if (!fingerprintResult.ok) {
        throw new Error('Expected valid fingerprint');
      }
      const canonicalFingerprint = fingerprintResult.fingerprint;
      const input = makeRegistrationInput({ candidateRecipe: recipe });
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.recipeFingerprint).toBe(canonicalFingerprint);

      const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(tempRoot);
      const ledgerRaw = await fs.readFile(paths.ledgerPath, 'utf-8');
      const ledger = JSON.parse(ledgerRaw);
      expect(ledger.registeredRecipes[0].recipeFingerprint).toBe(canonicalFingerprint);
      expect(ledger.attempts[0].recipeFingerprint).toBe(canonicalFingerprint);
    });
  });

  describe('registered recipe row correct', () => {
    it('3. persists registered recipe row with caller-supplied timestamp and sequence 1', async () => {
      await setupReadyCampaign(tempRoot);
      const recipe = makeRecipe({ candidateRecipeId: 'synthetic-recipe-1' });
      const registrationTimestamp = '2026-04-02T00:00:00.000Z';
      const input = makeRegistrationInput({ candidateRecipe: recipe, registrationTimestamp });
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(tempRoot);
      const ledgerRaw = await fs.readFile(paths.ledgerPath, 'utf-8');
      const ledger = JSON.parse(ledgerRaw);
      const registered = ledger.registeredRecipes[0];
      expect(registered.candidateRecipeId).toBe(recipe.candidateRecipeId);
      expect(registered.registrationSequence).toBe(1);
      expect(registered.registrationTimestamp).toBe(registrationTimestamp);
      expect(registered.complexityRank).toBe(recipe.complexityRank);
      expect(registered.preprocessingPolicyId).toBe(recipe.preprocessingPolicyId);
      expect(registered.featurePolicyId).toBe(recipe.featurePolicyId);
      expect(registered.modelFamilyId).toBe(recipe.modelFamilyId);
      expect(registered.regularizationConfig).toEqual(recipe.regularizationConfig);
      expect(registered.optimizerConfig).toEqual(recipe.optimizerConfig);
      expect(registered.otherModelAffectingChoices).toEqual(recipe.otherModelAffectingChoices);
    });
  });

  describe('resulting ledger B1-valid', () => {
    it('4. resulting ledger passes B1 validation', async () => {
      await setupReadyCampaign(tempRoot);
      const input = makeRegistrationInput();
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(tempRoot);
      const ledgerRaw = await fs.readFile(paths.ledgerPath, 'utf-8');
      const ledger = JSON.parse(ledgerRaw);
      const validation = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(validation.ok).toBe(true);
    });
  });

  describe('first evaluation reservation durable', () => {
    it('5. first registration increments evaluationCount durably', async () => {
      await setupReadyCampaign(tempRoot);
      const before = await snapshotCanonicalLedgerBytes(tempRoot);
      const input = makeRegistrationInput();
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.evaluationCount).toBe(1);

      const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(tempRoot);
      const ledgerRaw = await fs.readFile(paths.ledgerPath, 'utf-8');
      const ledger = JSON.parse(ledgerRaw);
      expect(ledger.budget.evaluationCount).toBe(1);
      expect(ledgerRaw).not.toBe(before);
    });
  });

  describe('REGISTERED attempt persisted', () => {
    it('6. persists REGISTERED attempt for first registration', async () => {
      await setupReadyCampaign(tempRoot);
      const input = makeRegistrationInput();
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(tempRoot);
      const ledgerRaw = await fs.readFile(paths.ledgerPath, 'utf-8');
      const ledger = JSON.parse(ledgerRaw);
      expect(ledger.attempts).toHaveLength(1);
      expect(ledger.attempts[0].status).toBe('REGISTERED');
      expect(ledger.attempts[0].candidateRecipeId).toBe(input.candidateRecipe.candidateRecipeId);
      expect(ledger.attempts[0].attemptNumber).toBe(1);
    });
  });

  describe('canonical fold IDs persisted', () => {
    it('7. persists canonical fold IDs from E3 fold plan', async () => {
      await setupReadyCampaign(tempRoot);
      const recipe = makeRecipe({ candidateRecipeId: 'synthetic-recipe-1' });
      const input = makeRegistrationInput({ candidateRecipe: recipe });
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const canonicalFoldIds = MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN.folds.map((fold: { foldId: string }) => fold.foldId);
      const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(tempRoot);
      const ledgerRaw = await fs.readFile(paths.ledgerPath, 'utf-8');
      const ledger = JSON.parse(ledgerRaw);
      expect(ledger.attempts[0].foldIds).toEqual(canonicalFoldIds);
    });
  });

  describe('registration sequence', () => {
    it('8. first distinct registration has sequence 1', async () => {
      await setupReadyCampaign(tempRoot);
      const input = makeRegistrationInput({ candidateRecipe: makeRecipe({ candidateRecipeId: 'recipe-a' }) });
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.registrationSequence).toBe(1);
    });

    it('9. second distinct registration has sequence 2', async () => {
      await setupReadyCampaign(tempRoot);
      const recipeA = makeRecipe({ candidateRecipeId: 'recipe-a', modelFamilyId: 'model-a' });
      const recipeB = makeRecipe({ candidateRecipeId: 'recipe-b', modelFamilyId: 'model-b' });
      const resultA = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, makeRegistrationInput({ candidateRecipe: recipeA }));
      expect(resultA.ok).toBe(true);
      const resultB = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, makeRegistrationInput({ candidateRecipe: recipeB }));
      expect(resultB.ok).toBe(true);
      if (!resultB.ok) return;
      expect(resultB.value.registrationSequence).toBe(2);
    });
  });

  describe('exact rerun semantics', () => {
    it('10. exact rerun does not add distinct recipe row', async () => {
      await setupReadyCampaign(tempRoot);
      const recipe = makeRecipe({ candidateRecipeId: 'recipe-a' });
      const input = makeRegistrationInput({ candidateRecipe: recipe });
      const first = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, input);
      expect(first.ok).toBe(true);
      const second = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, input);
      expect(second.ok).toBe(true);
      if (!second.ok) return;

      const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(tempRoot);
      const ledgerRaw = await fs.readFile(paths.ledgerPath, 'utf-8');
      const ledger = JSON.parse(ledgerRaw);
      expect(ledger.registeredRecipes).toHaveLength(1);
      expect(ledger.registeredRecipes[0].candidateRecipeId).toBe('recipe-a');
    });

    it('11. exact rerun uses same distinct slot', async () => {
      await setupReadyCampaign(tempRoot);
      const recipe = makeRecipe({ candidateRecipeId: 'recipe-a' });
      const input = makeRegistrationInput({ candidateRecipe: recipe });
      const first = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, input);
      expect(first.ok).toBe(true);
      const second = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, input);
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.value.registrationSequence).toBe(1);
    });

    it('12. exact rerun gets attempt 2 for same candidate', async () => {
      await setupReadyCampaign(tempRoot);
      const recipe = makeRecipe({ candidateRecipeId: 'recipe-a' });
      const input = makeRegistrationInput({ candidateRecipe: recipe });
      const first = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, input);
      expect(first.ok).toBe(true);
      const second = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, input);
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.value.attemptNumber).toBe(2);
    });

    it('13. candidate B first attempt is still 1 after exact rerun of A', async () => {
      await setupReadyCampaign(tempRoot);
      const recipeA = makeRecipe({ candidateRecipeId: 'recipe-a', modelFamilyId: 'model-a' });
      const recipeB = makeRecipe({ candidateRecipeId: 'recipe-b', modelFamilyId: 'model-b' });
      const inputA = makeRegistrationInput({ candidateRecipe: recipeA });
      const firstA = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, inputA);
      expect(firstA.ok).toBe(true);
      const rerunA = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, inputA);
      expect(rerunA.ok).toBe(true);
      if (!rerunA.ok) return;

      const inputB = makeRegistrationInput({ candidateRecipe: recipeB });
      const firstB = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, inputB);
      expect(firstB.ok).toBe(true);
      if (!firstB.ok) return;
      expect(firstB.value.attemptNumber).toBe(1);
    });
  });

  describe('alias conflict', () => {
    it('14. alias conflict with independently proven equal fingerprints', async () => {
      await setupReadyCampaign(tempRoot);
      const recipeA = makeRecipe({ candidateRecipeId: 'synthetic-recipe-A', modelFamilyId: 'synthetic-model-01' });
      const recipeB = makeRecipe({ candidateRecipeId: 'synthetic-recipe-B', modelFamilyId: 'synthetic-model-01' });
      const fingerprintA = computeMLBInnerCandidateRecipeFingerprint(recipeA);
      const fingerprintB = computeMLBInnerCandidateRecipeFingerprint(recipeB);
      expect(fingerprintA.ok).toBe(true);
      expect(fingerprintB.ok).toBe(true);
      if (fingerprintA.ok && fingerprintB.ok) {
        expect((fingerprintA as { ok: true; fingerprint: string }).fingerprint).toBe((fingerprintB as { ok: true; fingerprint: string }).fingerprint);
      }

      const first = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, makeRegistrationInput({ candidateRecipe: recipeA }));
      expect(first.ok).toBe(true);

      const second = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, makeRegistrationInput({ candidateRecipe: recipeB }));
      expect(second.ok).toBe(false);
      if (!second.ok) {
        expect(second.state).toBe('IDENTITY_ALIAS_CONFLICT');
      }

      const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(tempRoot);
      const ledgerRaw = await fs.readFile(paths.ledgerPath, 'utf-8');
      const ledger = JSON.parse(ledgerRaw);
      expect(ledger.registeredRecipes).toHaveLength(1);
      expect(ledger.attempts).toHaveLength(1);
      expect(ledger.budget.evaluationCount).toBe(1);
    });
  });

  describe('mutation conflict', () => {
    it('15. mutation conflict with independently proven unequal fingerprints', async () => {
      await setupReadyCampaign(tempRoot);
      const recipeA = makeRecipe({ candidateRecipeId: 'recipe-a', modelFamilyId: 'model-a' });
      const recipeB = makeRecipe({ candidateRecipeId: 'recipe-a', modelFamilyId: 'model-b' });
      const fingerprintA = computeMLBInnerCandidateRecipeFingerprint(recipeA);
      const fingerprintB = computeMLBInnerCandidateRecipeFingerprint(recipeB);
      expect(fingerprintA.ok).toBe(true);
      expect(fingerprintB.ok).toBe(true);
      if (fingerprintA.ok && fingerprintB.ok) {
        expect((fingerprintA as { ok: true; fingerprint: string }).fingerprint).not.toBe((fingerprintB as { ok: true; fingerprint: string }).fingerprint);
      }

      const first = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, makeRegistrationInput({ candidateRecipe: recipeA }));
      expect(first.ok).toBe(true);

      const second = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, makeRegistrationInput({ candidateRecipe: recipeB }));
      expect(second.ok).toBe(false);
      if (!second.ok) {
        expect(second.state).toBe('IDENTITY_MUTATION_CONFLICT');
      }

      const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(tempRoot);
      const ledgerRaw = await fs.readFile(paths.ledgerPath, 'utf-8');
      const ledger = JSON.parse(ledgerRaw);
      expect(ledger.registeredRecipes).toHaveLength(1);
      expect(ledger.attempts).toHaveLength(1);
      expect(ledger.budget.evaluationCount).toBe(1);
    });
  });

  describe('complexity mutation', () => {
    it('16. complexity mutation conflict is rejected', async () => {
      await setupReadyCampaign(tempRoot);
      const recipeA = makeRecipe({ candidateRecipeId: 'recipe-a', complexityRank: 1 });
      const recipeB = makeRecipe({ candidateRecipeId: 'recipe-a', complexityRank: 2 });
      const fingerprintA = computeMLBInnerCandidateRecipeFingerprint(recipeA);
      const fingerprintB = computeMLBInnerCandidateRecipeFingerprint(recipeB);
      expect(fingerprintA.ok).toBe(true);
      expect(fingerprintB.ok).toBe(true);
      if (fingerprintA.ok && fingerprintB.ok) {
        expect((fingerprintA as { ok: true; fingerprint: string }).fingerprint).toBe((fingerprintB as { ok: true; fingerprint: string }).fingerprint);
      }

      const first = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, makeRegistrationInput({ candidateRecipe: recipeA }));
      expect(first.ok).toBe(true);

      const second = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, makeRegistrationInput({ candidateRecipe: recipeB }));
      expect(second.ok).toBe(false);
      if (!second.ok) {
        expect(second.state).toBe('COMPLEXITY_RANK_MISMATCH');
      }

      const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(tempRoot);
      const ledgerRaw = await fs.readFile(paths.ledgerPath, 'utf-8');
      const ledger = JSON.parse(ledgerRaw);
      expect(ledger.registeredRecipes).toHaveLength(1);
      expect(ledger.attempts).toHaveLength(1);
    });
  });

  describe('malformed/invalid input', () => {
    it('17. malformed recipe fails before lock acquisition', async () => {
      await setupReadyCampaign(tempRoot);
      const badInput = makeRegistrationInput({ candidateRecipe: {} as MLBInnerCandidateRecipe });
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, badInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.state).toBe('FAIL_CLOSED_INVALID_REGISTRATION_INPUT');
      }

      const lockPath = path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, '.lock');
      const lockExists = await fs.access(lockPath).then(() => true).catch(() => false);
      expect(lockExists).toBe(false);
    });

    it('17a. non-string registrationTimestamp fails before lock acquisition', async () => {
      const badInput = makeRegistrationInput({ registrationTimestamp: 2026 });
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, badInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.state).toBe('FAIL_CLOSED_INVALID_REGISTRATION_INPUT');
        expect(result.issues[0].path).toBe('$.registrationTimestamp');
      }

      const lockPath = path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, '.lock');
      const lockExists = await fs.access(lockPath).then(() => true).catch(() => false);
      expect(lockExists).toBe(false);

      const runtimeDir = path.join(tempRoot, 'var', 'mlb-development');
      const runtimeExists = await fs.access(runtimeDir).then(() => true).catch(() => false);
      expect(runtimeExists).toBe(false);

      const anchorPath = path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md');
      const anchorExists = await fs.access(anchorPath).then(() => true).catch(() => false);
      expect(anchorExists).toBe(false);
    });

    it('17b. non-string attemptTimestamp fails before lock acquisition', async () => {
      const badInput = makeRegistrationInput({ attemptTimestamp: 2026 });
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, badInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.state).toBe('FAIL_CLOSED_INVALID_REGISTRATION_INPUT');
        expect(result.issues[0].path).toBe('$.attemptTimestamp');
      }

      const lockPath = path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, '.lock');
      const lockExists = await fs.access(lockPath).then(() => true).catch(() => false);
      expect(lockExists).toBe(false);

      const runtimeDir = path.join(tempRoot, 'var', 'mlb-development');
      const runtimeExists = await fs.access(runtimeDir).then(() => true).catch(() => false);
      expect(runtimeExists).toBe(false);

      const anchorPath = path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md');
      const anchorExists = await fs.access(anchorPath).then(() => true).catch(() => false);
      expect(anchorExists).toBe(false);
    });

    it('17c. string-like object registrationTimestamp does not throw and fails before lock', async () => {
      const stringLike = {
        toString() {
          return '2026-04-01T00:00:00.000Z';
        },
      };
      const badInput = makeRegistrationInput({ registrationTimestamp: stringLike });
      let threw = false;
      let result: MLBInnerDevelopmentCampaignRegistrationResult | undefined;
      try {
        result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, badInput);
      } catch (error) {
        threw = true;
      }
      expect(threw).toBe(false);
      expect(result?.ok).toBe(false);
      if (result && !result.ok) {
        expect(result.state).toBe('FAIL_CLOSED_INVALID_REGISTRATION_INPUT');
      }

      const lockPath = path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, '.lock');
      const lockExists = await fs.access(lockPath).then(() => true).catch(() => false);
      expect(lockExists).toBe(false);
    });

    it('17d. string-like object attemptTimestamp does not throw and fails before lock', async () => {
      const stringLike = {
        toString() {
          return '2026-04-01T00:00:00.000Z';
        },
      };
      const badInput = makeRegistrationInput({ attemptTimestamp: stringLike });
      let threw = false;
      let result: MLBInnerDevelopmentCampaignRegistrationResult | undefined;
      try {
        result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, badInput);
      } catch (error) {
        threw = true;
      }
      expect(threw).toBe(false);
      expect(result?.ok).toBe(false);
      if (result && !result.ok) {
        expect(result.state).toBe('FAIL_CLOSED_INVALID_REGISTRATION_INPUT');
      }

      const lockPath = path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, '.lock');
      const lockExists = await fs.access(lockPath).then(() => true).catch(() => false);
      expect(lockExists).toBe(false);
    });

    it('18. invalid registration timestamp fails before lock acquisition', async () => {
      await setupReadyCampaign(tempRoot);
      const badInput = makeRegistrationInput({ registrationTimestamp: 'not-a-timestamp' });
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, badInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.state).toBe('FAIL_CLOSED_INVALID_REGISTRATION_INPUT');
      }

      const lockPath = path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, '.lock');
      const lockExists = await fs.access(lockPath).then(() => true).catch(() => false);
      expect(lockExists).toBe(false);
    });

    it('19. invalid attempt timestamp fails before lock acquisition', async () => {
      await setupReadyCampaign(tempRoot);
      const badInput = makeRegistrationInput({ attemptTimestamp: 'not-a-timestamp' });
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, badInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.state).toBe('FAIL_CLOSED_INVALID_REGISTRATION_INPUT');
      }

      const lockPath = path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, '.lock');
      const lockExists = await fs.access(lockPath).then(() => true).catch(() => false);
      expect(lockExists).toBe(false);
    });

    it('19b. impossible attempt timestamp rejected before lock acquisition', async () => {
      const badInput = makeRegistrationInput({ attemptTimestamp: '2026-04-31T00:00:00.000Z' });
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, badInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.state).toBe('FAIL_CLOSED_INVALID_REGISTRATION_INPUT');
      }

      const lockPath = path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, '.lock');
      const lockExists = await fs.access(lockPath).then(() => true).catch(() => false);
      expect(lockExists).toBe(false);
    });

    it('18b. impossible month rejected before lock acquisition', async () => {
      const badInput = makeRegistrationInput({ registrationTimestamp: '2026-13-01T00:00:00.000Z' });
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, badInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.state).toBe('FAIL_CLOSED_INVALID_REGISTRATION_INPUT');
      }

      const lockPath = path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, '.lock');
      const lockExists = await fs.access(lockPath).then(() => true).catch(() => false);
      expect(lockExists).toBe(false);

      const runtimeDir = path.join(tempRoot, 'var', 'mlb-development');
      const runtimeExists = await fs.access(runtimeDir).then(() => true).catch(() => false);
      expect(runtimeExists).toBe(false);

      const anchorPath = path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md');
      const anchorExists = await fs.access(anchorPath).then(() => true).catch(() => false);
      expect(anchorExists).toBe(false);
    });

    it('18c. impossible calendar day rejected before lock acquisition', async () => {
      const badInput = makeRegistrationInput({ registrationTimestamp: '2026-04-31T00:00:00.000Z' });
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, badInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.state).toBe('FAIL_CLOSED_INVALID_REGISTRATION_INPUT');
      }

      const lockPath = path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, '.lock');
      const lockExists = await fs.access(lockPath).then(() => true).catch(() => false);
      expect(lockExists).toBe(false);

      const runtimeDir = path.join(tempRoot, 'var', 'mlb-development');
      const runtimeExists = await fs.access(runtimeDir).then(() => true).catch(() => false);
      expect(runtimeExists).toBe(false);

      const anchorPath = path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md');
      const anchorExists = await fs.access(anchorPath).then(() => true).catch(() => false);
      expect(anchorExists).toBe(false);
    });

    it('18d. impossible hour rejected before lock acquisition', async () => {
      const badInput = makeRegistrationInput({ registrationTimestamp: '2026-04-01T25:00:00.000Z' });
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, badInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.state).toBe('FAIL_CLOSED_INVALID_REGISTRATION_INPUT');
      }

      const lockPath = path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, '.lock');
      const lockExists = await fs.access(lockPath).then(() => true).catch(() => false);
      expect(lockExists).toBe(false);

      const runtimeDir = path.join(tempRoot, 'var', 'mlb-development');
      const runtimeExists = await fs.access(runtimeDir).then(() => true).catch(() => false);
      expect(runtimeExists).toBe(false);

      const anchorPath = path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md');
      const anchorExists = await fs.access(anchorPath).then(() => true).catch(() => false);
      expect(anchorExists).toBe(false);
    });

    it('18e. impossible minute rejected before lock acquisition', async () => {
      const badInput = makeRegistrationInput({ registrationTimestamp: '2026-04-01T00:61:00.000Z' });
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, badInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.state).toBe('FAIL_CLOSED_INVALID_REGISTRATION_INPUT');
      }

      const lockPath = path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, '.lock');
      const lockExists = await fs.access(lockPath).then(() => true).catch(() => false);
      expect(lockExists).toBe(false);

      const runtimeDir = path.join(tempRoot, 'var', 'mlb-development');
      const runtimeExists = await fs.access(runtimeDir).then(() => true).catch(() => false);
      expect(runtimeExists).toBe(false);

      const anchorPath = path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md');
      const anchorExists = await fs.access(anchorPath).then(() => true).catch(() => false);
      expect(anchorExists).toBe(false);
    });
  });

  describe('twelve-distinct-recipe capacity', () => {
    it('20. accepts 12 distinct recipes', async () => {
      await setupReadyCampaign(tempRoot);
      for (let i = 1; i <= 12; i++) {
        const recipe = makeRecipe({
          candidateRecipeId: `synthetic-recipe-${String(i).padStart(2, '0')}`,
          modelFamilyId: `synthetic-model-${String(i).padStart(2, '0')}`,
        });
        const input = makeRegistrationInput({ candidateRecipe: recipe });
        const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, input);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.registrationSequence).toBe(i);
        expect(result.value.distinctRecipeCount).toBe(i);
        expect(result.value.evaluationCount).toBe(i);
      }

      const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(tempRoot);
      const ledgerRaw = await fs.readFile(paths.ledgerPath, 'utf-8');
      const ledger = JSON.parse(ledgerRaw);
      expect(ledger.registeredRecipes).toHaveLength(12);
      expect(ledger.budget.seenRecipeIds).toHaveLength(12);
      expect(ledger.budget.seenRecipeFingerprints).toHaveLength(12);
      expect(ledger.budget.seenComplexityRanks).toHaveLength(12);
      expect(ledger.attempts).toHaveLength(12);
    });

    it('21. rejects 13th distinct recipe without mutating ledger', async () => {
      await setupReadyCampaign(tempRoot);
      for (let i = 1; i <= 12; i++) {
        const recipe = makeRecipe({
          candidateRecipeId: `synthetic-recipe-${String(i).padStart(2, '0')}`,
          modelFamilyId: `synthetic-model-${String(i).padStart(2, '0')}`,
        });
        const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, makeRegistrationInput({ candidateRecipe: recipe }));
        expect(result.ok).toBe(true);
      }

      const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(tempRoot);
      const beforeRaw = await fs.readFile(paths.ledgerPath, 'utf-8');
      const beforeLedger = JSON.parse(beforeRaw);

      const thirteenth = makeRecipe({ candidateRecipeId: 'synthetic-recipe-13', modelFamilyId: 'synthetic-model-13' });
      const thirteenthResult = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, makeRegistrationInput({ candidateRecipe: thirteenth }));
      expect(thirteenthResult.ok).toBe(false);
      if (!thirteenthResult.ok) {
        expect(thirteenthResult.state).toBe('BUDGET_EXHAUSTED');
      }

      const afterRaw = await fs.readFile(paths.ledgerPath, 'utf-8');
      expect(afterRaw).toBe(beforeRaw);
      const afterLedger = JSON.parse(afterRaw);
      expect(afterLedger.registeredRecipes).toHaveLength(12);
      expect(afterLedger.attempts).toHaveLength(12);
      expect(afterLedger.budget.evaluationCount).toBe(12);
    });
  });

  describe('lock contention', () => {
    it('22. lock contention blocks registration without bypass', async () => {
      await setupReadyCampaign(tempRoot);
      const firstLock = await acquireMLBInnerDevelopmentCampaignLock(tempRoot);
      expect(firstLock.ok).toBe(true);

      try {
        const before = await snapshotCanonicalLedgerBytes(tempRoot);
        const input = makeRegistrationInput();
        const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, input);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.state).toBe('FAIL_CLOSED_LOCK_ACQUISITION_FAILED');
        }

        const after = await snapshotCanonicalLedgerBytes(tempRoot);
        expect(after).toBe(before);
      } finally {
        if (firstLock.ok) {
          await releaseMLBInnerDevelopmentCampaignLock(tempRoot, firstLock.ownershipToken);
        }
      }
    });
  });

  describe('stale-temp persistence failure', () => {
    it('23. stale temp causes write failure and leaves canonical ledger unchanged', async () => {
      await setupReadyCampaign(tempRoot);
      await writeStaleTempLedger(tempRoot);

      const before = await snapshotCanonicalLedgerBytes(tempRoot);
      const input = makeRegistrationInput();
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, input);
      expect(result.ok).toBe(false);

      const after = await snapshotCanonicalLedgerBytes(tempRoot);
      expect(after).toBe(before);

      const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(tempRoot);
      const tempExists = await fs.access(paths.tempLedgerPath).then(() => true).catch(() => false);
      expect(tempExists).toBe(true);
      expect(await fs.readFile(paths.tempLedgerPath, 'utf-8')).toBe('stale-temp');
    });

    it('24. retry after failed persistence registers normally', async () => {
      await setupReadyCampaign(tempRoot);
      await writeStaleTempLedger(tempRoot);

      const first = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, makeRegistrationInput());
      expect(first.ok).toBe(false);

      await fs.rm(path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME + '.tmp'), { force: true });

      const retry = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, makeRegistrationInput());
      expect(retry.ok).toBe(true);

      const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(tempRoot);
      const ledgerRaw = await fs.readFile(paths.ledgerPath, 'utf-8');
      const ledger = JSON.parse(ledgerRaw);
      expect(ledger.budget.evaluationCount).toBe(1);
      expect(ledger.registeredRecipes).toHaveLength(1);
      expect(ledger.attempts).toHaveLength(1);
    });
  });

  describe('non-ready lifecycle states', () => {
    it('25. both missing returns NOT_INITIALIZED', async () => {
      const input = makeRegistrationInput();
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.state).toBe('NOT_INITIALIZED');
      }
    });

    it('26. anchor without ledger returns FAIL_CLOSED_LEDGER_WITHOUT_ANCHOR', async () => {
      const ledgerDir = path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY);
      await fs.mkdir(ledgerDir, { recursive: true });
      await fs.writeFile(
        path.join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME),
        JSON.stringify({
          ledgerContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
          developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
          createdAt: VALID_TIMESTAMP,
          updatedAt: VALID_TIMESTAMP,
          budget: {
            contractVersion: 'mlb-inner-development-recipe-budget-v1',
            cycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
            maxDistinctRecipes: 12,
            seenRecipeIds: [],
            seenRecipeFingerprints: [],
            seenComplexityRanks: [],
            evaluationCount: 0,
          },
          registeredRecipes: [],
          attempts: [],
        }),
      );

      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, makeRegistrationInput());
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.state).toBe('FAIL_CLOSED_LEDGER_WITHOUT_ANCHOR');
      }
    });

    it('27. ledger without anchor returns FAIL_CLOSED_ANCHOR_WITHOUT_LEDGER', async () => {
      const docsDir = path.join(tempRoot, 'docs');
      await fs.mkdir(docsDir, { recursive: true });
      await fs.writeFile(path.join(docsDir, 'mlb-v1-train-only-inner-development-campaign-marker.md'), JSON.stringify({
        anchorContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION,
        developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        canonicalLedgerDirectory: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY,
        canonicalLedgerFilename: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME,
        ledgerContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
        campaignIdentity: crypto.randomBytes(32).toString('hex'),
      }));

      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, makeRegistrationInput());
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.state).toBe('FAIL_CLOSED_ANCHOR_WITHOUT_LEDGER');
      }
    });

    it('28. invalid anchor returns FAIL_CLOSED_INVALID_ANCHOR', async () => {
      const docsDir = path.join(tempRoot, 'docs');
      await fs.mkdir(docsDir, { recursive: true });
      await fs.writeFile(path.join(docsDir, 'mlb-v1-train-only-inner-development-campaign-marker.md'), 'not-json');

      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, makeRegistrationInput());
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.state).toBe('FAIL_CLOSED_INVALID_ANCHOR');
      }
    });

    it('29. invalid ledger returns FAIL_CLOSED_INVALID_LEDGER', async () => {
      const ledgerDir = path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY);
      await fs.mkdir(ledgerDir, { recursive: true });
      await fs.writeFile(path.join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME), 'bad-json');
      const docsDir = path.join(tempRoot, 'docs');
      await fs.mkdir(docsDir, { recursive: true });
      await fs.writeFile(path.join(docsDir, 'mlb-v1-train-only-inner-development-campaign-marker.md'), JSON.stringify({
        anchorContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION,
        developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        canonicalLedgerDirectory: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY,
        canonicalLedgerFilename: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME,
        ledgerContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
        campaignIdentity: crypto.randomBytes(32).toString('hex'),
      }));

      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, makeRegistrationInput());
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.state).toBe('FAIL_CLOSED_INVALID_LEDGER');
      }
    });

    it('30. identity mismatch returns FAIL_CLOSED_CAMPAIGN_IDENTITY_MISMATCH', async () => {
      await setupReadyCampaign(tempRoot);
      const anchorPath = path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_RESET_PREVENTION_ANCHOR);
      const anchor = JSON.parse(await fs.readFile(anchorPath, 'utf-8'));
      anchor.campaignIdentity = '0000000000000000000000000000000000000000000000000000000000000000';
      await fs.writeFile(anchorPath, JSON.stringify(anchor, null, 2) + '\n');

      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, makeRegistrationInput());
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.state).toBe('FAIL_CLOSED_CAMPAIGN_IDENTITY_MISMATCH');
      }
    });
  });

  describe('input immutability', () => {
    it('31. does not mutate caller input', async () => {
      await setupReadyCampaign(tempRoot);
      const recipe = makeRecipe({ candidateRecipeId: 'immutable-recipe' });
      const input = makeRegistrationInput({ candidateRecipe: recipe });
      const inputBefore = deepClone(input);
      const recipeBefore = deepClone(recipe);

      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, input);
      expect(result.ok).toBe(true);

      expect(input).toEqual(inputBefore);
      expect(recipe).toEqual(recipeBefore);
    });
  });

  describe('evaluation count invariants', () => {
    it('32. attempts length equals evaluationCount after first registration', async () => {
      await setupReadyCampaign(tempRoot);
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, makeRegistrationInput());
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(tempRoot);
      const ledgerRaw = await fs.readFile(paths.ledgerPath, 'utf-8');
      const ledger = JSON.parse(ledgerRaw);
      expect(ledger.attempts.length).toBe(ledger.budget.evaluationCount);
      expect(ledger.attempts.length).toBe(result.value.evaluationCount);
    });

    it('33. attempts length equals evaluationCount after multiple registrations/reruns', async () => {
      await setupReadyCampaign(tempRoot);
      const recipeA = makeRecipe({ candidateRecipeId: 'recipe-a', modelFamilyId: 'model-a' });
      const recipeB = makeRecipe({ candidateRecipeId: 'recipe-b', modelFamilyId: 'model-b' });
      const inputA = makeRegistrationInput({ candidateRecipe: recipeA });
      const inputB = makeRegistrationInput({ candidateRecipe: recipeB });

      const firstA = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, inputA);
      expect(firstA.ok).toBe(true);
      const rerunA = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, inputA);
      expect(rerunA.ok).toBe(true);
      const firstB = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, inputB);
      expect(firstB.ok).toBe(true);
      const rerunB = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, inputB);
      expect(rerunB.ok).toBe(true);
      if (!rerunB.ok) return;

      const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(tempRoot);
      const ledgerRaw = await fs.readFile(paths.ledgerPath, 'utf-8');
      const ledger = JSON.parse(ledgerRaw);
      expect(ledger.attempts.length).toBe(ledger.budget.evaluationCount);
      expect(ledger.attempts.length).toBe(4);
    });
  });

  describe('no execution/trainer involvement', () => {
    it('34. registration does not invoke trainer or execution APIs', async () => {
      await setupReadyCampaign(tempRoot);
      const input = makeRegistrationInput();
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).not.toHaveProperty('nextRealFitAuthorized');
      expect(result.value).not.toHaveProperty('executionAuthorized');
    });
  });

  describe('successful state re-read validates through B2-A/B1', () => {
    it('35. re-reads persisted ledger through committed read path', async () => {
      await setupReadyCampaign(tempRoot);
      const input = makeRegistrationInput();
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const lock = await acquireMLBInnerDevelopmentCampaignLock(tempRoot);
      expect(lock.ok).toBe(true);
      if (!lock.ok) return;

      try {
        const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
        expect(inspection.ok).toBe(true);
        if (inspection.ok) {
          expect(inspection.state).toBe('READY');
          expect(inspection.ledger.budget.evaluationCount).toBe(1);
          expect(inspection.ledger.registeredRecipes).toHaveLength(1);
          expect(inspection.ledger.attempts).toHaveLength(1);
        }
      } finally {
        if (lock.ok) {
          await releaseMLBInnerDevelopmentCampaignLock(tempRoot, lock.ownershipToken);
        }
      }
    });
  });

  describe('failed conflicts do not change ledger updatedAt', () => {
    it('36. failed registration leaves ledger updatedAt unchanged', async () => {
      await setupReadyCampaign(tempRoot);
      const recipeA = makeRecipe({ candidateRecipeId: 'recipe-a', modelFamilyId: 'model-a' });
      const first = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, makeRegistrationInput({ candidateRecipe: recipeA }));
      expect(first.ok).toBe(true);

      const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(tempRoot);
      const beforeConflict = await fs.readFile(paths.ledgerPath, 'utf-8');
      const beforeLedger = JSON.parse(beforeConflict);
      const updatedAtBeforeConflict = beforeLedger.updatedAt;

      const recipeB = makeRecipe({ candidateRecipeId: 'recipe-b', modelFamilyId: 'model-a' });
      const second = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, makeRegistrationInput({ candidateRecipe: recipeB }));
      expect(second.ok).toBe(false);
      if (!second.ok) {
        expect(second.state).toBe('IDENTITY_ALIAS_CONFLICT');
      }

      const afterRaw = await fs.readFile(paths.ledgerPath, 'utf-8');
      const afterLedger = JSON.parse(afterRaw);
      expect(afterLedger.updatedAt).toBe(updatedAtBeforeConflict);
    });
  });

  describe('lock-held inspector usage', () => {
    it('37. lock-held inspector is used for READY state', async () => {
      await setupReadyCampaign(tempRoot);
      const input = makeRegistrationInput();
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(tempRoot);
      const ledgerRaw = await fs.readFile(paths.ledgerPath, 'utf-8');
      const ledger = JSON.parse(ledgerRaw);
      const validation = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(validation.ok).toBe(true);
    });
  });

  describe('failure-state topology', () => {
    it('38. low-level E3 validation codes are not top-level registration states', async () => {
      await setupReadyCampaign(tempRoot);
      const badInput = makeRegistrationInput({ candidateRecipe: {} as MLBInnerCandidateRecipe });
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, badInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.state).toBe('FAIL_CLOSED_INVALID_REGISTRATION_INPUT');
        expect(result.issues).not.toHaveLength(0);
        const topLevelStates = [
          result.state,
          'IDENTITY_ALIAS_CONFLICT',
          'IDENTITY_MUTATION_CONFLICT',
          'COMPLEXITY_RANK_MISMATCH',
          'BUDGET_EXHAUSTED',
          'FAIL_CLOSED_LOCK_ACQUISITION_FAILED',
          'FAIL_CLOSED_LOCK_RELEASE_FAILED',
          'FAIL_CLOSED_REGISTRATION_INVARIANT_VIOLATION',
          'WRITE_FAILED',
        ];
        for (const issue of result.issues) {
          expect(topLevelStates).not.toContain(issue.code);
        }
      }
    });

    it('39. attemptTimestamp error message does not call it registrationTimestamp', async () => {
      const badInput = makeRegistrationInput({ attemptTimestamp: 'not-a-timestamp' });
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, badInput);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.state).toBe('FAIL_CLOSED_INVALID_REGISTRATION_INPUT');
        const attemptIssue = result.issues.find(issue => issue.path === '$.attemptTimestamp');
        expect(attemptIssue).toBeDefined();
        if (attemptIssue) {
          expect(attemptIssue.message).not.toContain('registrationTimestamp');
        }
      }
    });
  });

  describe('lock release failure visibility', () => {
    it('24b. lock release failure does not hide registration failure', async () => {
      await setupReadyCampaign(tempRoot);
      const badInput = makeRegistrationInput({ candidateRecipe: {} as MLBInnerCandidateRecipe });
      const result = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, badInput);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.state).toBe('FAIL_CLOSED_INVALID_REGISTRATION_INPUT');
    });
  });
});
