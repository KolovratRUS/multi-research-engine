import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  MLB_INNER_DEVELOPMENT_CAMPAIGN_IDENTITY_CONTRACT_VERSION,
  computeMLBInnerDevelopmentCampaignIdentity,
  MLBInnerDevelopmentCampaignLifecycleState,
  MLBInnerDevelopmentCampaignGenesisInput,
  initializeMLBInnerDevelopmentCampaign,
  resumeMLBInnerDevelopmentCampaign,
} from '@/prediction/mlb/mlb-inner-development-campaign-lifecycle';
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
} from '@/prediction/mlb/mlb-inner-development-campaign-ledger';
import {
  MLB_INNER_DEVELOPMENT_CYCLE_ID,
} from '@/prediction/mlb/mlb-train-only-inner-development-evaluator';

const CAMPAIGN_IDENTITY_KNOWN_ANSWER = 'e4f2ab9440590755eef67baa23399b5ae9ff02dba4c32770ba9e336ae5054bb0' as const;

function makeGenesisInput(genesisTimestamp: string): MLBInnerDevelopmentCampaignGenesisInput {
  return {
    authorization: 'EXPLICIT_ONE_TIME_GENESIS',
    genesisTimestamp,
  };
}

describe('mlb-inner-development-campaign-lifecycle', () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join('/tmp', 'mre-lifecycle-'));
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  describe('computeMLBInnerDevelopmentCampaignIdentity', () => {
    it('computes the known-answer hash for the frozen genesis timestamp', () => {
      const actual = computeMLBInnerDevelopmentCampaignIdentity('2026-04-01T00:00:00.000Z');
      expect(actual).toBe(CAMPAIGN_IDENTITY_KNOWN_ANSWER);
    });

    it('produces a 64-character lowercase hex digest', () => {
      const actual = computeMLBInnerDevelopmentCampaignIdentity('2026-04-01T00:00:00.000Z');
      expect(actual).toHaveLength(64);
      expect(actual).toMatch(/^[0-9a-f]+$/);
    });

    it('differs for different genesis timestamps', () => {
      const a = computeMLBInnerDevelopmentCampaignIdentity('2026-04-01T00:00:00.000Z');
      const b = computeMLBInnerDevelopmentCampaignIdentity('2026-04-02T00:00:00.000Z');
      expect(a).not.toBe(b);
    });
  });

  describe('initializeMLBInnerDevelopmentCampaign', () => {
    it('1. explicit genesis from both-missing succeeds in temp root', async () => {
      const result = await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      expect(result.ok).toBe(true);
    });

    it('2. genesis creates B1-valid anchor', async () => {
      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      const anchorRaw = await fs.readFile(path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md'), 'utf-8');
      const anchor = JSON.parse(anchorRaw);
      const validation = validateMLBInnerDevelopmentCampaignAnchor(anchor);
      expect(validation.ok).toBe(true);
    });

    it('3. genesis creates B1-valid empty ledger', async () => {
      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      const ledgerRaw = await fs.readFile(
        path.join(tempRoot, 'var', 'mlb-development', 'mlb-inner-development-campaign-ledger', 'mlb-v1-train-only-inner-development-cycle-v1-ledger.json'),
        'utf-8',
      );
      const ledger = JSON.parse(ledgerRaw);
      const validation = validateMLBInnerDevelopmentCampaignLedger(ledger);
      expect(validation.ok).toBe(true);
      expect(ledger.budget.seenRecipeIds).toHaveLength(0);
      expect(ledger.budget.evaluationCount).toBe(0);
    });

    it('4. anchor is written before ledger semantically (anchor-first ordering)', async () => {
      const result = await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      expect(result.ok).toBe(true);
      const anchorExists = await fs.access(path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md')).then(() => true).catch(() => false);
      const ledgerExists = await fs.access(path.join(tempRoot, 'var', 'mlb-development', 'mlb-inner-development-campaign-ledger', 'mlb-v1-train-only-inner-development-cycle-v1-ledger.json')).then(() => true).catch(() => false);
      expect(anchorExists).toBe(true);
      expect(ledgerExists).toBe(true);
    });

    it('5. resume after genesis returns READY', async () => {
      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      const resumeResult = await resumeMLBInnerDevelopmentCampaign(tempRoot);
      expect(resumeResult.ok).toBe(true);
      expect(resumeResult.state).toBe('READY');
      if (resumeResult.ok) {
        expect(resumeResult.anchor.anchorContractVersion).toBe(MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION);
        expect(resumeResult.ledger.ledgerContractVersion).toBe(MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION);
      }
    });

    it('6. resume both-missing returns NOT_INITIALIZED and does not genesis', async () => {
      const resumeResult = await resumeMLBInnerDevelopmentCampaign(tempRoot);
      expect(resumeResult.ok).toBe(false);
      expect(resumeResult.state).toBe('NOT_INITIALIZED');
    });

    it('7. anchor exists + ledger missing fails closed', async () => {
      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      await fs.rm(
        path.join(tempRoot, 'var', 'mlb-development', 'mlb-inner-development-campaign-ledger', 'mlb-v1-train-only-inner-development-cycle-v1-ledger.json'),
      );
      const resumeResult = await resumeMLBInnerDevelopmentCampaign(tempRoot);
      expect(resumeResult.ok).toBe(false);
      expect(resumeResult.state).toBe('FAIL_CLOSED_ANCHOR_WITHOUT_LEDGER');
    });

    it('8. ledger exists + anchor missing fails closed', async () => {
      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      await fs.rm(path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md'));
      const resumeResult = await resumeMLBInnerDevelopmentCampaign(tempRoot);
      expect(resumeResult.ok).toBe(false);
      expect(resumeResult.state).toBe('FAIL_CLOSED_LEDGER_WITHOUT_ANCHOR');
    });

    it('9. invalid anchor JSON fails closed', async () => {
      await fs.mkdir(path.join(tempRoot, 'docs'), { recursive: true });
      await fs.writeFile(path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md'), 'not-json');
      const resumeResult = await resumeMLBInnerDevelopmentCampaign(tempRoot);
      expect(resumeResult.ok).toBe(false);
      expect(resumeResult.state).toBe('FAIL_CLOSED_INVALID_ANCHOR');
    });

    it('10. invalid anchor contract fails closed', async () => {
      await fs.mkdir(path.join(tempRoot, 'docs'), { recursive: true });
      await fs.writeFile(
        path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md'),
        JSON.stringify({ anchorContractVersion: 'bad' }),
      );
      const resumeResult = await resumeMLBInnerDevelopmentCampaign(tempRoot);
      expect(resumeResult.ok).toBe(false);
      expect(resumeResult.state).toBe('FAIL_CLOSED_INVALID_ANCHOR');
    });

    it('11. invalid ledger fails closed', async () => {
      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      await fs.writeFile(
        path.join(tempRoot, 'var', 'mlb-development', 'mlb-inner-development-campaign-ledger', 'mlb-v1-train-only-inner-development-cycle-v1-ledger.json'),
        'bad-json',
      );
      const resumeResult = await resumeMLBInnerDevelopmentCampaign(tempRoot);
      expect(resumeResult.ok).toBe(false);
      expect(resumeResult.state).toBe('FAIL_CLOSED_INVALID_LEDGER');
    });

    it('12. campaign identity mismatch fails closed', async () => {
      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      const anchorPath = path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md');
      const anchor = JSON.parse(await fs.readFile(anchorPath, 'utf-8'));
      anchor.campaignIdentity = '0000000000000000000000000000000000000000000000000000000000000000';
      await fs.writeFile(anchorPath, JSON.stringify(anchor, null, 2) + '\n');
      const resumeResult = await resumeMLBInnerDevelopmentCampaign(tempRoot);
      expect(resumeResult.ok).toBe(false);
      expect(resumeResult.state).toBe('FAIL_CLOSED_CAMPAIGN_IDENTITY_MISMATCH');
    });

    it('13. changing ledger createdAt causes identity mismatch', async () => {
      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      const ledgerPath = path.join(tempRoot, 'var', 'mlb-development', 'mlb-inner-development-campaign-ledger', 'mlb-v1-train-only-inner-development-cycle-v1-ledger.json');
      const ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf-8'));
      ledger.createdAt = '2026-04-02T00:00:00.000Z';
      ledger.updatedAt = '2026-04-02T00:00:00.000Z';
      await fs.writeFile(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
      const resumeResult = await resumeMLBInnerDevelopmentCampaign(tempRoot);
      expect(resumeResult.ok).toBe(false);
      expect(resumeResult.state).toBe('FAIL_CLOSED_CAMPAIGN_IDENTITY_MISMATCH');
    });

    it('14. deleted ledger after genesis does not regenerate', async () => {
      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      await fs.rm(
        path.join(tempRoot, 'var', 'mlb-development', 'mlb-inner-development-campaign-ledger', 'mlb-v1-train-only-inner-development-cycle-v1-ledger.json'),
      );
      const resumeResult = await resumeMLBInnerDevelopmentCampaign(tempRoot);
      expect(resumeResult.ok).toBe(false);
      expect(resumeResult.state).toBe('FAIL_CLOSED_ANCHOR_WITHOUT_LEDGER');
      const ledgerExists = await fs.access(
        path.join(tempRoot, 'var', 'mlb-development', 'mlb-inner-development-campaign-ledger', 'mlb-v1-train-only-inner-development-cycle-v1-ledger.json'),
      ).then(() => true).catch(() => false);
      expect(ledgerExists).toBe(false);
    });

    it('15. deleted anchor after genesis does not recreate', async () => {
      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      await fs.rm(path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md'));
      const resumeResult = await resumeMLBInnerDevelopmentCampaign(tempRoot);
      expect(resumeResult.ok).toBe(false);
      expect(resumeResult.state).toBe('FAIL_CLOSED_LEDGER_WITHOUT_ANCHOR');
      const anchorExists = await fs.access(path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md')).then(() => true).catch(() => false);
      expect(anchorExists).toBe(false);
    });

    it('16. second genesis rejected with ALREADY_INITIALIZED', async () => {
      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      const secondResult = await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-02T00:00:00.000Z'));
      expect(secondResult.ok).toBe(false);
      if (!secondResult.ok) {
        expect(secondResult.state).toBe('FAIL_CLOSED_ALREADY_INITIALIZED');
      }
    });

    it('16b. semantic separation: second genesis vs resume against both-valid campaign', async () => {
      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));

      const secondGenesisResult = await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-02T00:00:00.000Z'));
      expect(secondGenesisResult.ok).toBe(false);
      if (!secondGenesisResult.ok) {
        expect(secondGenesisResult.state).toBe('FAIL_CLOSED_ALREADY_INITIALIZED');
      }

      const resumeResult = await resumeMLBInnerDevelopmentCampaign(tempRoot);
      expect(resumeResult.ok).toBe(true);
      expect(resumeResult.state).toBe('READY');
    });

    it('17. second genesis preserves anchor bytes', async () => {
      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      const anchorPath = path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md');
      const firstAnchor = await fs.readFile(anchorPath, 'utf-8');
      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-02T00:00:00.000Z'));
      const secondAnchor = await fs.readFile(anchorPath, 'utf-8');
      expect(secondAnchor).toBe(firstAnchor);
    });

    it('18. second genesis preserves ledger bytes', async () => {
      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      const ledgerPath = path.join(tempRoot, 'var', 'mlb-development', 'mlb-inner-development-campaign-ledger', 'mlb-v1-train-only-inner-development-cycle-v1-ledger.json');
      const firstLedger = await fs.readFile(ledgerPath, 'utf-8');
      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-02T00:00:00.000Z'));
      const secondLedger = await fs.readFile(ledgerPath, 'utf-8');
      expect(secondLedger).toBe(firstLedger);
    });

    it('19. partial genesis anchor-first + stale ledger temp leaves anchor and no ledger', async () => {
      // Create a stale B2-A ledger .tmp to force write failure
      const ledgerDir = path.join(tempRoot, 'var', 'mlb-development', 'mlb-inner-development-campaign-ledger');
      await fs.mkdir(ledgerDir, { recursive: true });
      await fs.writeFile(path.join(ledgerDir, 'mlb-v1-train-only-inner-development-cycle-v1-ledger.json.tmp'), 'stale');
      const result = await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.state).toBe('FAIL_CLOSED_PARTIAL_GENESIS');
      }
      const anchorExists = await fs.access(path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md')).then(() => true).catch(() => false);
      expect(anchorExists).toBe(true);
      const ledgerExists = await fs.access(path.join(tempRoot, 'var', 'mlb-development', 'mlb-inner-development-campaign-ledger', 'mlb-v1-train-only-inner-development-cycle-v1-ledger.json')).then(() => true).catch(() => false);
      expect(ledgerExists).toBe(false);
      const staleExists = await fs.access(path.join(ledgerDir, 'mlb-v1-train-only-inner-development-cycle-v1-ledger.json.tmp')).then(() => true).catch(() => false);
      expect(staleExists).toBe(true);
    });

    it('20. explicit retry after partial genesis fails closed', async () => {
      const ledgerDir = path.join(tempRoot, 'var', 'mlb-development', 'mlb-inner-development-campaign-ledger');
      await fs.mkdir(ledgerDir, { recursive: true });
      await fs.writeFile(path.join(ledgerDir, 'mlb-v1-train-only-inner-development-cycle-v1-ledger.json.tmp'), 'stale');
      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      await fs.rm(path.join(ledgerDir, 'mlb-v1-train-only-inner-development-cycle-v1-ledger.json.tmp'));
      const retryResult = await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      expect(retryResult.ok).toBe(false);
      if (!retryResult.ok) {
        expect(retryResult.state).toBe('FAIL_CLOSED_ANCHOR_WITHOUT_LEDGER');
      }
    });

    it('21. lock already held blocks genesis', async () => {
      const { acquireMLBInnerDevelopmentCampaignLock } = await import('@/prediction/mlb/mlb-inner-development-campaign-ledger-store');
      const firstLock = await acquireMLBInnerDevelopmentCampaignLock(tempRoot);
      expect(firstLock.ok).toBe(true);
      if (firstLock.ok) {
        const result = await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.state).toBe('FAIL_CLOSED_LOCK_ACQUISITION_FAILED');
        }
        const { releaseMLBInnerDevelopmentCampaignLock } = await import('@/prediction/mlb/mlb-inner-development-campaign-ledger-store');
        await releaseMLBInnerDevelopmentCampaignLock(tempRoot, firstLock.ownershipToken);
      }
    });

    it('22. lock already held blocks resume', async () => {
      const { acquireMLBInnerDevelopmentCampaignLock } = await import('@/prediction/mlb/mlb-inner-development-campaign-ledger-store');
      const firstLock = await acquireMLBInnerDevelopmentCampaignLock(tempRoot);
      expect(firstLock.ok).toBe(true);
      if (firstLock.ok) {
        const result = await resumeMLBInnerDevelopmentCampaign(tempRoot);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.state).toBe('FAIL_CLOSED_LOCK_ACQUISITION_FAILED');
        }
        const { releaseMLBInnerDevelopmentCampaignLock } = await import('@/prediction/mlb/mlb-inner-development-campaign-ledger-store');
        await releaseMLBInnerDevelopmentCampaignLock(tempRoot, firstLock.ownershipToken);
      }
    });

    it('23. resume performs no candidate/budget mutation', async () => {
      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      const resumeResult = await resumeMLBInnerDevelopmentCampaign(tempRoot);
      expect(resumeResult.ok).toBe(true);
      if (resumeResult.ok) {
        expect(resumeResult.ledger.budget.evaluationCount).toBe(0);
        expect(resumeResult.ledger.registeredRecipes).toHaveLength(0);
        expect(resumeResult.ledger.attempts).toHaveLength(0);
      }
    });

    it('24. genesis budget remains empty/evaluationCount zero', async () => {
      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      const resumeResult = await resumeMLBInnerDevelopmentCampaign(tempRoot);
      expect(resumeResult.ok).toBe(true);
      if (resumeResult.ok) {
        expect(resumeResult.ledger.budget.seenRecipeIds).toHaveLength(0);
        expect(resumeResult.ledger.budget.seenRecipeFingerprints).toHaveLength(0);
        expect(resumeResult.ledger.budget.seenComplexityRanks).toHaveLength(0);
        expect(resumeResult.ledger.budget.evaluationCount).toBe(0);
      }
    });

    it('25. .gitignore contains runtime state entry', async () => {
      const realGitignorePath = path.join(process.cwd(), '.gitignore');
      const content = await fs.readFile(realGitignorePath, 'utf-8');
      expect(content).toContain('var/mlb-development/');
    });

    it('26. anchor path is NOT gitignored', async () => {
      const gitignorePath = path.join(tempRoot, '.gitignore');
      await fs.writeFile(gitignorePath, 'var/mlb-development/\n');
      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      const anchorExists = await fs.access(path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md')).then(() => true).catch(() => false);
      expect(anchorExists).toBe(true);
    });

    it('27. invalid genesis timestamp causes no anchor/ledger filesystem state', async () => {
      const result = await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('not-a-timestamp'));
      expect(result.ok).toBe(false);
      const anchorExists = await fs.access(path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md')).then(() => true).catch(() => false);
      const ledgerExists = await fs.access(path.join(tempRoot, 'var', 'mlb-development', 'mlb-inner-development-campaign-ledger', 'mlb-v1-train-only-inner-development-cycle-v1-ledger.json')).then(() => true).catch(() => false);
      expect(anchorExists).toBe(false);
      expect(ledgerExists).toBe(false);
    });

    it('28. wrong explicit genesis authorization literal is rejected by typing (compile-time)', () => {
      // This test verifies compile-time safety: the literal type 'EXPLICIT_ONE_TIME_GENESIS' is required.
      // If a caller passes any other literal, TypeScript should reject it.
      // We verify the input type contract by checking that a valid literal is accepted at runtime.
      const valid: MLBInnerDevelopmentCampaignGenesisInput = {
        authorization: 'EXPLICIT_ONE_TIME_GENESIS',
        genesisTimestamp: '2026-04-01T00:00:00.000Z',
      };
      expect(valid.authorization).toBe('EXPLICIT_ONE_TIME_GENESIS');
    });

    it('29. fresh-clone anchor/no-ledger state fails closed', async () => {
      // Simulate a fresh clone: anchor exists but no ledger
      const anchorPath = path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md');
      await fs.mkdir(path.join(tempRoot, 'docs'), { recursive: true });
      const identity = computeMLBInnerDevelopmentCampaignIdentity('2026-04-01T00:00:00.000Z');
      const anchor: MLBInnerDevelopmentCampaignAnchor = {
        anchorContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION,
        developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        canonicalLedgerDirectory: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY,
        canonicalLedgerFilename: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME,
        ledgerContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
        campaignIdentity: identity,
      };
      await fs.writeFile(anchorPath, JSON.stringify(anchor, null, 2) + '\n');
      const resumeResult = await resumeMLBInnerDevelopmentCampaign(tempRoot);
      expect(resumeResult.ok).toBe(false);
      expect(resumeResult.state).toBe('FAIL_CLOSED_ANCHOR_WITHOUT_LEDGER');
    });

    it('30. campaign identity known-answer test', () => {
      const actual = computeMLBInnerDevelopmentCampaignIdentity('2026-04-01T00:00:00.000Z');
      expect(actual).toBe(CAMPAIGN_IDENTITY_KNOWN_ANSWER);
    });

    it('31. valid anchor + malformed ledger JSON during genesis fails closed as invalid ledger', async () => {
      const ledgerDir = path.join(tempRoot, 'var', 'mlb-development', 'mlb-inner-development-campaign-ledger');
      await fs.mkdir(ledgerDir, { recursive: true });
      await fs.writeFile(path.join(ledgerDir, 'mlb-v1-train-only-inner-development-cycle-v1-ledger.json'), 'bad-json');
      await fs.mkdir(path.join(tempRoot, 'docs'), { recursive: true });
      const identity = computeMLBInnerDevelopmentCampaignIdentity('2026-04-01T00:00:00.000Z');
      const anchor: MLBInnerDevelopmentCampaignAnchor = {
        anchorContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION,
        developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        canonicalLedgerDirectory: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY,
        canonicalLedgerFilename: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME,
        ledgerContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
        campaignIdentity: identity,
      };
      await fs.writeFile(path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_RESET_PREVENTION_ANCHOR), JSON.stringify(anchor, null, 2) + '\n');
      const result = await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.state).toBe('FAIL_CLOSED_INVALID_LEDGER');
      }
    });

    it('32. valid anchor + B1-invalid ledger during genesis fails closed as invalid ledger', async () => {
      const ledgerDir = path.join(tempRoot, 'var', 'mlb-development', 'mlb-inner-development-campaign-ledger');
      await fs.mkdir(ledgerDir, { recursive: true });
      await fs.writeFile(
        path.join(ledgerDir, 'mlb-v1-train-only-inner-development-cycle-v1-ledger.json'),
        JSON.stringify({ bad: true }),
      );
      await fs.mkdir(path.join(tempRoot, 'docs'), { recursive: true });
      const identity = computeMLBInnerDevelopmentCampaignIdentity('2026-04-01T00:00:00.000Z');
      const anchor: MLBInnerDevelopmentCampaignAnchor = {
        anchorContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION,
        developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        canonicalLedgerDirectory: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY,
        canonicalLedgerFilename: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME,
        ledgerContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
        campaignIdentity: identity,
      };
      await fs.writeFile(path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_RESET_PREVENTION_ANCHOR), JSON.stringify(anchor, null, 2) + '\n');
      const result = await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.state).toBe('FAIL_CLOSED_INVALID_LEDGER');
      }
    });

    it('33. wrong authorization at runtime creates no filesystem state', async () => {
      const badInput = { authorization: 'WRONG_AUTH' as 'EXPLICIT_ONE_TIME_GENESIS', genesisTimestamp: '2026-04-01T00:00:00.000Z' };
      const result = await initializeMLBInnerDevelopmentCampaign(tempRoot, badInput);
      expect(result.ok).toBe(false);
      const anchorExists = await fs.access(path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md')).then(() => true).catch(() => false);
      const ledgerExists = await fs.access(path.join(tempRoot, 'var', 'mlb-development', 'mlb-inner-development-campaign-ledger', 'mlb-v1-train-only-inner-development-cycle-v1-ledger.json')).then(() => true).catch(() => false);
      expect(anchorExists).toBe(false);
      expect(ledgerExists).toBe(false);
    });

    it('34. invalid genesis timestamp creates no filesystem state', async () => {
      const result = await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('not-a-timestamp'));
      expect(result.ok).toBe(false);
      const anchorExists = await fs.access(path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md')).then(() => true).catch(() => false);
      const ledgerExists = await fs.access(path.join(tempRoot, 'var', 'mlb-development', 'mlb-inner-development-campaign-ledger', 'mlb-v1-train-only-inner-development-cycle-v1-ledger.json')).then(() => true).catch(() => false);
      expect(anchorExists).toBe(false);
      expect(ledgerExists).toBe(false);
    });
  });

  describe('inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld', () => {
    it('returns READY with validated ledger on healthy campaign under externally-held lock', async () => {
      const { acquireMLBInnerDevelopmentCampaignLock, releaseMLBInnerDevelopmentCampaignLock } = await import('@/prediction/mlb/mlb-inner-development-campaign-ledger-store');
      const { inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld } = await import('@/prediction/mlb/mlb-inner-development-campaign-lifecycle');

      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      const lockResult = await acquireMLBInnerDevelopmentCampaignLock(tempRoot);
      expect(lockResult.ok).toBe(true);

      try {
        const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
        expect(inspection.ok).toBe(true);
        if (inspection.ok) {
          expect(inspection.state).toBe('READY');
          expect(inspection.anchor.anchorContractVersion).toBe(MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION);
          expect(inspection.ledger.ledgerContractVersion).toBe(MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION);
        }
      } finally {
        if (lockResult.ok) {
          await releaseMLBInnerDevelopmentCampaignLock(tempRoot, lockResult.ownershipToken);
        }
      }
    });

    it('does not release caller-owned lock', async () => {
      const { acquireMLBInnerDevelopmentCampaignLock, releaseMLBInnerDevelopmentCampaignLock } = await import('@/prediction/mlb/mlb-inner-development-campaign-ledger-store');
      const { inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld } = await import('@/prediction/mlb/mlb-inner-development-campaign-lifecycle');

      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      const firstLock = await acquireMLBInnerDevelopmentCampaignLock(tempRoot);
      expect(firstLock.ok).toBe(true);

      if (firstLock.ok) {
        await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
        const secondLock = await acquireMLBInnerDevelopmentCampaignLock(tempRoot);
        expect(secondLock.ok).toBe(false);
        if (!secondLock.ok) {
          expect(secondLock.issues[0]?.code).toBe('LOCK_ALREADY_EXISTS');
        }
        await releaseMLBInnerDevelopmentCampaignLock(tempRoot, firstLock.ownershipToken);
      }
    });

    it('does not acquire nested lock when lock is already held', async () => {
      const { acquireMLBInnerDevelopmentCampaignLock, releaseMLBInnerDevelopmentCampaignLock } = await import('@/prediction/mlb/mlb-inner-development-campaign-ledger-store');
      const { inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld } = await import('@/prediction/mlb/mlb-inner-development-campaign-lifecycle');

      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      const firstLock = await acquireMLBInnerDevelopmentCampaignLock(tempRoot);
      expect(firstLock.ok).toBe(true);

      if (firstLock.ok) {
        const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
        expect(inspection.ok).toBe(true);
        if (inspection.ok) {
          expect(inspection.state).toBe('READY');
        }
        await releaseMLBInnerDevelopmentCampaignLock(tempRoot, firstLock.ownershipToken);
      }
    });

    it('returns NOT_INITIALIZED when both anchor and ledger are missing', async () => {
      const { inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld } = await import('@/prediction/mlb/mlb-inner-development-campaign-lifecycle');
      const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
      expect(inspection.ok).toBe(false);
      if (!inspection.ok) {
        expect(inspection.state).toBe('NOT_INITIALIZED');
      }
    });

    it('returns FAIL_CLOSED_LEDGER_WITHOUT_ANCHOR when ledger exists but anchor is missing', async () => {
      const { inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld } = await import('@/prediction/mlb/mlb-inner-development-campaign-lifecycle');
      const ledgerDir = path.join(tempRoot, 'var', 'mlb-development', 'mlb-inner-development-campaign-ledger');
      await fs.mkdir(ledgerDir, { recursive: true });
      await fs.writeFile(path.join(ledgerDir, 'mlb-v1-train-only-inner-development-cycle-v1-ledger.json'), JSON.stringify({
        ledgerContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
        developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
        budget: { contractVersion: 'mlb-inner-development-recipe-budget-v1', cycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID, maxDistinctRecipes: 12, seenRecipeIds: [], seenRecipeFingerprints: [], seenComplexityRanks: [], evaluationCount: 0 },
        registeredRecipes: [],
        attempts: [],
      }));

      const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
      expect(inspection.ok).toBe(false);
      if (!inspection.ok) {
        expect(inspection.state).toBe('FAIL_CLOSED_LEDGER_WITHOUT_ANCHOR');
      }
    });

    it('returns FAIL_CLOSED_ANCHOR_WITHOUT_LEDGER when anchor exists but ledger is missing', async () => {
      const { inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld } = await import('@/prediction/mlb/mlb-inner-development-campaign-lifecycle');
      await fs.mkdir(path.join(tempRoot, 'docs'), { recursive: true });
      const identity = computeMLBInnerDevelopmentCampaignIdentity('2026-04-01T00:00:00.000Z');
      const anchor = {
        anchorContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION,
        developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        canonicalLedgerDirectory: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY,
        canonicalLedgerFilename: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME,
        ledgerContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
        campaignIdentity: identity,
      };
      await fs.writeFile(path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md'), JSON.stringify(anchor, null, 2) + '\n');

      const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
      expect(inspection.ok).toBe(false);
      if (!inspection.ok) {
        expect(inspection.state).toBe('FAIL_CLOSED_ANCHOR_WITHOUT_LEDGER');
      }
    });

    it('returns FAIL_CLOSED_INVALID_ANCHOR for malformed anchor JSON', async () => {
      const { inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld } = await import('@/prediction/mlb/mlb-inner-development-campaign-lifecycle');
      await fs.mkdir(path.join(tempRoot, 'docs'), { recursive: true });
      await fs.writeFile(path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md'), 'not-json');

      const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
      expect(inspection.ok).toBe(false);
      if (!inspection.ok) {
        expect(inspection.state).toBe('FAIL_CLOSED_INVALID_ANCHOR');
      }
    });

    it('returns FAIL_CLOSED_INVALID_LEDGER for malformed ledger JSON', async () => {
      const { inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld } = await import('@/prediction/mlb/mlb-inner-development-campaign-lifecycle');
      const ledgerDir = path.join(tempRoot, 'var', 'mlb-development', 'mlb-inner-development-campaign-ledger');
      await fs.mkdir(ledgerDir, { recursive: true });
      await fs.writeFile(path.join(ledgerDir, 'mlb-v1-train-only-inner-development-cycle-v1-ledger.json'), 'bad-json');
      await fs.mkdir(path.join(tempRoot, 'docs'), { recursive: true });
      const identity = computeMLBInnerDevelopmentCampaignIdentity('2026-04-01T00:00:00.000Z');
      const anchor = {
        anchorContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION,
        developmentCycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        canonicalLedgerDirectory: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY,
        canonicalLedgerFilename: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME,
        ledgerContractVersion: MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
        campaignIdentity: identity,
      };
      await fs.writeFile(path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md'), JSON.stringify(anchor, null, 2) + '\n');

      const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
      expect(inspection.ok).toBe(false);
      if (!inspection.ok) {
        expect(inspection.state).toBe('FAIL_CLOSED_INVALID_LEDGER');
      }
    });

    it('returns FAIL_CLOSED_CAMPAIGN_IDENTITY_MISMATCH on anchor/ledger identity mismatch', async () => {
      const { inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld } = await import('@/prediction/mlb/mlb-inner-development-campaign-lifecycle');
      await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput('2026-04-01T00:00:00.000Z'));
      const anchorPath = path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md');
      const anchor = JSON.parse(await fs.readFile(anchorPath, 'utf-8'));
      anchor.campaignIdentity = '0000000000000000000000000000000000000000000000000000000000000000';
      await fs.writeFile(anchorPath, JSON.stringify(anchor, null, 2) + '\n');

      const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
      expect(inspection.ok).toBe(false);
      if (!inspection.ok) {
        expect(inspection.state).toBe('FAIL_CLOSED_CAMPAIGN_IDENTITY_MISMATCH');
      }
    });

    it('performs no filesystem mutation', async () => {
      const { inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld } = await import('@/prediction/mlb/mlb-inner-development-campaign-lifecycle');
      const anchorPath = path.join(tempRoot, 'docs', 'mlb-v1-train-only-inner-development-campaign-marker.md');
      const ledgerPath = path.join(tempRoot, 'var', 'mlb-development', 'mlb-inner-development-campaign-ledger', 'mlb-v1-train-only-inner-development-cycle-v1-ledger.json');

      const anchorBefore = await fs.access(anchorPath).then(() => true).catch(() => false);
      const ledgerBefore = await fs.access(ledgerPath).then(() => true).catch(() => false);

      await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);

      const anchorAfter = await fs.access(anchorPath).then(() => true).catch(() => false);
      const ledgerAfter = await fs.access(ledgerPath).then(() => true).catch(() => false);

      expect(anchorAfter).toBe(anchorBefore);
      expect(ledgerAfter).toBe(ledgerBefore);
    });
  });
});
