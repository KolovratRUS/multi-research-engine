import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';

import {
  MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME,
  MLB_INNER_DEVELOPMENT_MAX_DISTINCT_RECIPES,
  MLBInnerDevelopmentCampaignLedger,
  validateMLBInnerDevelopmentCampaignLedger,
} from '@/prediction/mlb/mlb-inner-development-campaign-ledger';
import {
  MLB_INNER_DEVELOPMENT_CYCLE_ID,
  MLB_INNER_DEVELOPMENT_RECIPE_BUDGET_CONTRACT_VERSION,
  computeMLBInnerCandidateRecipeFingerprint,
  MLBInnerCandidateRecipe,
} from '@/prediction/mlb/mlb-train-only-inner-development-evaluator';
import {
  MLBInnerDevelopmentCampaignLedgerStorePaths,
  resolveMLBInnerDevelopmentCampaignLedgerStorePaths,
  MLBInnerDevelopmentCampaignLedgerStoreReadIssue,
  MLBInnerDevelopmentCampaignLedgerStoreReadResult,
  readMLBInnerDevelopmentCampaignLedger,
  MLBInnerDevelopmentCampaignLedgerStoreWriteIssue,
  MLBInnerDevelopmentCampaignLedgerStoreWriteResult,
  writeMLBInnerDevelopmentCampaignLedger,
  MLBInnerDevelopmentCampaignLockIssue,
  MLBInnerDevelopmentCampaignLockResult,
  acquireMLBInnerDevelopmentCampaignLock,
  MLBInnerDevelopmentCampaignLockReleaseIssue,
  MLBInnerDevelopmentCampaignLockReleaseResult,
  releaseMLBInnerDevelopmentCampaignLock,
} from '@/prediction/mlb/mlb-inner-development-campaign-ledger-store';

function makeValidLedger(contractVersion: string = MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION): MLBInnerDevelopmentCampaignLedger {
  return {
    ledgerContractVersion: contractVersion as typeof MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
    developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    budget: {
      contractVersion: MLB_INNER_DEVELOPMENT_RECIPE_BUDGET_CONTRACT_VERSION,
      cycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
      maxDistinctRecipes: MLB_INNER_DEVELOPMENT_MAX_DISTINCT_RECIPES,
      seenRecipeIds: [],
      seenRecipeFingerprints: [],
      seenComplexityRanks: [],
      evaluationCount: 0,
    },
    registeredRecipes: [],
    attempts: [],
  };
}

function makeFingerprintedRecipe(id: string): { recipe: MLBInnerCandidateRecipe; fingerprint: string } {
  const recipe: MLBInnerCandidateRecipe = {
    candidateRecipeId: id,
    preprocessingPolicyId: `prep-${id}`,
    featurePolicyId: `feat-${id}`,
    modelFamilyId: `model-${id}`,
    regularizationConfig: { strength: 0.1 },
    optimizerConfig: { lr: 0.01 },
    otherModelAffectingChoices: {},
    complexityRank: 1,
  };
  const fp = computeMLBInnerCandidateRecipeFingerprint(recipe);
  if (!fp.ok) {
    throw new Error(fp.issues.map(i => i.message).join('; '));
  }
  return { recipe, fingerprint: fp.fingerprint };
}

function makeOneRecipeLedger(): MLBInnerDevelopmentCampaignLedger {
  const { recipe, fingerprint } = makeFingerprintedRecipe('recipe-1');
  return {
    ledgerContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
    developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    budget: {
      contractVersion: MLB_INNER_DEVELOPMENT_RECIPE_BUDGET_CONTRACT_VERSION,
      cycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
      maxDistinctRecipes: MLB_INNER_DEVELOPMENT_MAX_DISTINCT_RECIPES,
      seenRecipeIds: [recipe.candidateRecipeId],
      seenRecipeFingerprints: [fingerprint],
      seenComplexityRanks: [recipe.complexityRank],
      evaluationCount: 1,
    },
    registeredRecipes: [
      {
        candidateRecipeId: recipe.candidateRecipeId,
        registrationSequence: 1,
        registrationTimestamp: '2026-04-01T00:00:00.000Z',
        recipeFingerprint: fingerprint,
        complexityRank: recipe.complexityRank,
        preprocessingPolicyId: recipe.preprocessingPolicyId,
        featurePolicyId: recipe.featurePolicyId,
        modelFamilyId: recipe.modelFamilyId,
        regularizationConfig: recipe.regularizationConfig,
        optimizerConfig: recipe.optimizerConfig,
        otherModelAffectingChoices: recipe.otherModelAffectingChoices,
      },
    ],
    attempts: [
      {
        attemptNumber: 1,
        candidateRecipeId: recipe.candidateRecipeId,
        recipeFingerprint: fingerprint,
        complexityRank: recipe.complexityRank,
        developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        status: 'REGISTERED',
        attemptTimestamp: '2026-04-01T01:00:00.000Z',
        foldIds: ['fold-1', 'fold-2', 'fold-3', 'fold-4'],
      },
    ],
  };
}

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(join(tmpdir(), 'mre-ledger-store-'));
});

afterEach(async () => {
  try {
    await fs.rm(tempRoot, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures
  }
});

describe('resolveMLBInnerDevelopmentCampaignLedgerStorePaths', () => {
  it('resolves absolute paths beneath the repository root', () => {
    const paths = resolveMLBInnerDevelopmentCampaignLedgerStorePaths(tempRoot);
    expect(paths.repositoryRoot).toBe(tempRoot);
    expect(paths.ledgerDirectory).toBe(join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY));
    expect(paths.ledgerPath).toBe(join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME));
    expect(paths.tempLedgerPath).toBe(join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME) + '.tmp');
    expect(paths.lockPath).toBe(join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, '.lock'));
  });

  it('rejects non-absolute repositoryRoot', () => {
    expect(() => resolveMLBInnerDevelopmentCampaignLedgerStorePaths('relative/path')).toThrow(TypeError);
  });
});

describe('readMLBInnerDevelopmentCampaignLedger', () => {
  it('returns LEDGER_MISSING when canonical file is absent', async () => {
    const result = await readMLBInnerDevelopmentCampaignLedger(tempRoot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toEqual<MLBInnerDevelopmentCampaignLedgerStoreReadIssue>({
        code: 'LEDGER_MISSING',
        path: join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME),
        message: 'Canonical ledger file is missing',
      });
    }
  });

  it('returns LEDGER_JSON_INVALID for empty file', async () => {
    const ledgerDir = join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY);
    await fs.mkdir(ledgerDir, { recursive: true });
    await fs.writeFile(join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME), '', 'utf-8');

    const result = await readMLBInnerDevelopmentCampaignLedger(tempRoot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some(i => i.code === 'LEDGER_JSON_INVALID')).toBe(true);
    }
  });

  it('returns LEDGER_JSON_INVALID for malformed JSON', async () => {
    const ledgerDir = join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY);
    await fs.mkdir(ledgerDir, { recursive: true });
    await fs.writeFile(join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME), '{invalid json', 'utf-8');

    const result = await readMLBInnerDevelopmentCampaignLedger(tempRoot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some(i => i.code === 'LEDGER_JSON_INVALID')).toBe(true);
    }
  });

  it('returns LEDGER_CONTRACT_INVALID for JSON null', async () => {
    const ledgerDir = join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY);
    await fs.mkdir(ledgerDir, { recursive: true });
    await fs.writeFile(join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME), 'null', 'utf-8');

    const result = await readMLBInnerDevelopmentCampaignLedger(tempRoot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some(i => i.code === 'LEDGER_CONTRACT_INVALID')).toBe(true);
    }
  });

  it('returns LEDGER_CONTRACT_INVALID for JSON array', async () => {
    const ledgerDir = join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY);
    await fs.mkdir(ledgerDir, { recursive: true });
    await fs.writeFile(join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME), '[]', 'utf-8');

    const result = await readMLBInnerDevelopmentCampaignLedger(tempRoot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some(i => i.code === 'LEDGER_CONTRACT_INVALID')).toBe(true);
    }
  });

  it('returns LEDGER_CONTRACT_INVALID for wrong ledger contract version', async () => {
    const ledgerDir = join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY);
    await fs.mkdir(ledgerDir, { recursive: true });
    const invalid = { ...makeValidLedger(), ledgerContractVersion: 'wrong-version' as MLBInnerDevelopmentCampaignLedger['ledgerContractVersion'] };
    await fs.writeFile(join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME), JSON.stringify(invalid), 'utf-8');

    const result = await readMLBInnerDevelopmentCampaignLedger(tempRoot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some(i => i.code === 'LEDGER_CONTRACT_INVALID')).toBe(true);
    }
  });

  it('returns LEDGER_FOUND_VALID for a valid empty genesis ledger', async () => {
    const writeResult = await writeMLBInnerDevelopmentCampaignLedger(tempRoot, makeValidLedger());
    expect(writeResult.ok).toBe(true);

    const readResult = await readMLBInnerDevelopmentCampaignLedger(tempRoot);
    expect(readResult.ok).toBe(true);
    if (readResult.ok) {
      expect(readResult.value.budget.seenRecipeIds).toHaveLength(0);
      expect(readResult.value.attempts).toHaveLength(0);
    }
  });

  it('returns LEDGER_FOUND_VALID for a valid one-recipe ledger', async () => {
    const writeResult = await writeMLBInnerDevelopmentCampaignLedger(tempRoot, makeOneRecipeLedger());
    expect(writeResult.ok).toBe(true);

    const readResult = await readMLBInnerDevelopmentCampaignLedger(tempRoot);
    expect(readResult.ok).toBe(true);
    if (readResult.ok) {
      expect(readResult.value.budget.seenRecipeIds).toHaveLength(1);
      expect(readResult.value.attempts).toHaveLength(1);
    }
  });
});

describe('writeMLBInnerDevelopmentCampaignLedger', () => {
  it('rejects invalid proposed ledger without touching filesystem', async () => {
    const ledgerDir = join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY);
    await fs.mkdir(ledgerDir, { recursive: true });
    await fs.writeFile(join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME), 'existing', 'utf-8');

    const result = await writeMLBInnerDevelopmentCampaignLedger(tempRoot, makeValidLedger('wrong-version'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some(i => i.code === 'WRITE_VALIDATION_FAILED')).toBe(true);
    }

    const content = await fs.readFile(join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME), 'utf-8');
    expect(content).toBe('existing');
    const tempExists = await fs.stat(join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME + '.tmp')).then(() => true).catch(() => false);
    expect(tempExists).toBe(false);
  });

  it('replaces canonical with validated bytes and removes temp on success', async () => {
    const ledgerA = { ...makeValidLedger(), createdAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-01T00:00:00.000Z' };
    const writeA = await writeMLBInnerDevelopmentCampaignLedger(tempRoot, ledgerA);
    expect(writeA.ok).toBe(true);

    const ledgerPath = join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME);
    const contentA = await fs.readFile(ledgerPath, 'utf-8');
    expect(contentA).toBe(JSON.stringify(ledgerA, null, 2) + '\n');

    const ledgerB = { ...makeValidLedger(), createdAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-01T01:00:00.000Z' };
    const validationB = validateMLBInnerDevelopmentCampaignLedger(ledgerB);
    expect(validationB.ok).toBe(true);
    const writeB = await writeMLBInnerDevelopmentCampaignLedger(tempRoot, ledgerB);
    expect(writeB.ok).toBe(true);

    const contentB = await fs.readFile(ledgerPath, 'utf-8');
    expect(contentB).toBe(JSON.stringify(ledgerB, null, 2) + '\n');
    expect(contentB).not.toBe(contentA);

    const tempExists = await fs.stat(ledgerPath + '.tmp').then(() => true).catch(() => false);
    expect(tempExists).toBe(false);
  });

  it('preserves stale temp and fails closed on temp collision', async () => {
    const ledgerA = makeValidLedger();
    const writeA = await writeMLBInnerDevelopmentCampaignLedger(tempRoot, ledgerA);
    expect(writeA.ok).toBe(true);

    const ledgerDir = join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY);
    const tempPath = join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME + '.tmp');
    await fs.writeFile(tempPath, 'FORENSIC_STALE_TEMP\n', 'utf-8');

    const ledgerB = makeValidLedger();
    const writeB = await writeMLBInnerDevelopmentCampaignLedger(tempRoot, ledgerB);
    expect(writeB.ok).toBe(false);
    if (!writeB.ok) {
      expect(writeB.issues.some(i => i.code === 'WRITE_IO_ERROR')).toBe(true);
    }

    const canonicalContent = await fs.readFile(join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME), 'utf-8');
    expect(canonicalContent).toBe(JSON.stringify(ledgerA, null, 2) + '\n');
    const tempContent = await fs.readFile(tempPath, 'utf-8');
    expect(tempContent).toBe('FORENSIC_STALE_TEMP\n');
  });

  it('preserves canonical bytes when temp creation fails', async () => {
    const ledgerA = makeValidLedger();
    const writeA = await writeMLBInnerDevelopmentCampaignLedger(tempRoot, ledgerA);
    expect(writeA.ok).toBe(true);

    const ledgerDir = join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY);
    const tempPath = join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME + '.tmp');
    // Create a directory at the temp path to block file creation
    await fs.mkdir(tempPath);

    const ledgerB = makeValidLedger();
    const writeB = await writeMLBInnerDevelopmentCampaignLedger(tempRoot, ledgerB);
    expect(writeB.ok).toBe(false);

    const canonicalContent = await fs.readFile(join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME), 'utf-8');
    expect(canonicalContent).toBe(JSON.stringify(ledgerA, null, 2) + '\n');

    // Cleanup: remove the blocking directory
    await fs.rmdir(tempPath);
  });

  it('rejects invalid proposed ledger without touching filesystem', async () => {
    const ledgerDir = join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY);
    await fs.mkdir(ledgerDir, { recursive: true });
    await fs.writeFile(join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME), 'existing', 'utf-8');

    const result = await writeMLBInnerDevelopmentCampaignLedger(tempRoot, makeValidLedger('wrong-version'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some(i => i.code === 'WRITE_VALIDATION_FAILED')).toBe(true);
    }

    const content = await fs.readFile(join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME), 'utf-8');
    expect(content).toBe('existing');
    const tempExists = await fs.stat(join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME + '.tmp')).then(() => true).catch(() => false);
    expect(tempExists).toBe(false);
  });

  it('preserves corrupt canonical bytes and does not create temp', async () => {
    const ledgerDir = join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY);
    await fs.mkdir(ledgerDir, { recursive: true });
    await fs.writeFile(join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME), 'not-json', 'utf-8');

    const result = await writeMLBInnerDevelopmentCampaignLedger(tempRoot, makeValidLedger());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some(i => i.code === 'WRITE_VALIDATION_FAILED')).toBe(true);
    }

    const content = await fs.readFile(join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME), 'utf-8');
    expect(content).toBe('not-json');
    const tempExists = await fs.stat(join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME + '.tmp')).then(() => true).catch(() => false);
    expect(tempExists).toBe(false);
  });
});

describe('acquireMLBInnerDevelopmentCampaignLock', () => {
  it('acquires lock and returns ownership token', async () => {
    const result = await acquireMLBInnerDevelopmentCampaignLock(tempRoot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ownershipToken).toHaveLength(32);
    }
  });

  it('fails closed on second acquisition without release', async () => {
    const first = await acquireMLBInnerDevelopmentCampaignLock(tempRoot);
    expect(first.ok).toBe(true);

    const second = await acquireMLBInnerDevelopmentCampaignLock(tempRoot);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.issues.some(i => i.code === 'LOCK_ALREADY_EXISTS')).toBe(true);
    }
  });

  it('allows acquisition after release', async () => {
    const first = await acquireMLBInnerDevelopmentCampaignLock(tempRoot);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      throw new Error('first acquire failed');
    }

    const release = await releaseMLBInnerDevelopmentCampaignLock(tempRoot, first.ownershipToken);
    expect(release.ok).toBe(true);

    const second = await acquireMLBInnerDevelopmentCampaignLock(tempRoot);
    expect(second.ok).toBe(true);
  });

  it('allows exactly one winner on simultaneous acquisition', async () => {
    const [a, b] = await Promise.all([
      acquireMLBInnerDevelopmentCampaignLock(tempRoot),
      acquireMLBInnerDevelopmentCampaignLock(tempRoot),
    ]);

    const successes = [a, b].filter(r => r.ok);
    const failures = [a, b].filter(r => !r.ok);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    if (failures[0]) {
      expect(failures[0].issues.some(i => i.code === 'LOCK_ALREADY_EXISTS')).toBe(true);
    }
    if (successes[0] && successes[0].ok) {
      const release = await releaseMLBInnerDevelopmentCampaignLock(tempRoot, successes[0].ownershipToken);
      expect(release.ok).toBe(true);
    }
  });
});

describe('releaseMLBInnerDevelopmentCampaignLock', () => {
  it('releases lock owned by the caller', async () => {
    const acquired = await acquireMLBInnerDevelopmentCampaignLock(tempRoot);
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) {
      throw new Error('acquire failed');
    }

    const release = await releaseMLBInnerDevelopmentCampaignLock(tempRoot, acquired.ownershipToken);
    expect(release.ok).toBe(true);
  });

  it('fails closed on wrong ownership token and preserves lock', async () => {
    const acquired = await acquireMLBInnerDevelopmentCampaignLock(tempRoot);
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) {
      throw new Error('acquire failed');
    }

    const release = await releaseMLBInnerDevelopmentCampaignLock(tempRoot, 'wrong-token');
    expect(release.ok).toBe(false);
    if (!release.ok) {
      expect(release.issues.some(i => i.code === 'LOCK_RELEASE_OWNERSHIP_MISMATCH')).toBe(true);
    }

    const lockPath = join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY, '.lock');
    const stillExists = await fs.stat(lockPath).then(() => true).catch(() => false);
    expect(stillExists).toBe(true);
  });

  it('fails closed on corrupt/missing lock metadata and preserves lock', async () => {
    const ledgerDir = join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY);
    await fs.mkdir(ledgerDir, { recursive: true });
    const lockPath = join(ledgerDir, '.lock');
    await fs.mkdir(lockPath);
    // Do not write token file: missing metadata

    const acquireResult = await acquireMLBInnerDevelopmentCampaignLock(tempRoot);
    expect(acquireResult.ok).toBe(false);
    if (!acquireResult.ok) {
      expect(acquireResult.issues.some(i => i.code === 'LOCK_ALREADY_EXISTS')).toBe(true);
    }

    const releaseResult = await releaseMLBInnerDevelopmentCampaignLock(tempRoot, 'any-token');
    expect(releaseResult.ok).toBe(false);
    if (!releaseResult.ok) {
      expect(releaseResult.issues.some(i => i.code === 'LOCK_RELEASE_IO_ERROR')).toBe(true);
    }

    const stillExists = await fs.stat(lockPath).then(() => true).catch(() => false);
    expect(stillExists).toBe(true);
  });

  it('does not remove existing lock due age alone', async () => {
    const acquired = await acquireMLBInnerDevelopmentCampaignLock(tempRoot);
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) {
      throw new Error('acquire failed');
    }

    const release = await releaseMLBInnerDevelopmentCampaignLock(tempRoot, acquired.ownershipToken);
    expect(release.ok).toBe(true);

    // Simulate an old leftover lock without token metadata
    const ledgerDir = join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY);
    await fs.mkdir(ledgerDir, { recursive: true });
    const lockPath = join(ledgerDir, '.lock');
    await fs.mkdir(lockPath);

    const staleAcquire = await acquireMLBInnerDevelopmentCampaignLock(tempRoot);
    expect(staleAcquire.ok).toBe(false);
    if (!staleAcquire.ok) {
      expect(staleAcquire.issues.some(i => i.code === 'LOCK_ALREADY_EXISTS')).toBe(true);
    }

    // Cleanup stale lock for test teardown
    await fs.rmdir(lockPath);
  });
});
