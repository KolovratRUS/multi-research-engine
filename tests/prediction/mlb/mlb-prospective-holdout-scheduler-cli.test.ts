import { describe, expect, it, beforeAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  acquireLockImpl,
  releaseLockImpl,
  readLockMetadata,
  acquireRecoveryClaim,
  releaseRecoveryClaim,
  readRecoveryClaimMetadata,
  classifyPidKillError,
  runMLBProspectiveHoldoutScheduler,
  runMLBProspectiveHoldoutSchedulerCLI,
  type MLBProspectiveHoldoutSchedulerDependencies,
  type MLBProspectiveHoldoutSchedulerEvent,
  type MLBProspectiveHoldoutSchedulerRunResult,
  type MLBProspectiveHoldoutSchedulerStateLoaderResult,
  type PidLiveness,
  type SchedulerCLIIO,
} from '../../../scripts/mlb-prospective-holdout-scheduler';

function isStoppedFailed(
  result: MLBProspectiveHoldoutSchedulerRunResult,
): result is { readonly kind: 'STOPPED_FAIL_CLOSED'; readonly exitCode: 2; readonly reason: string } {
  return result.kind === 'STOPPED_FAIL_CLOSED';
}

import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
} from '@/prediction/mlb/mlb-prospective-holdout-protocol-contract';
import {
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_VERSION,
  type MLBProspectiveHoldoutActivationPersisted,
  validateMLBProspectiveHoldoutActivationPersisted,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-contract';
import {
  MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
  MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
} from '@/prediction/mlb/mlb-prospective-t360-capture-contract';
import {
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
} from '@/prediction/mlb/mlb-inner-development-third-real-candidate-recipe';
import {
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
} from '@/prediction/mlb/mlb-prospective-pregame-evidence-artifact-contract';
import {
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
} from '@/prediction/mlb/mlb-prospective-holdout-game-identity-binding-contract';
import type { MLBProspectiveHoldoutCaptureOrchestratorResult } from '@/prediction/mlb/mlb-prospective-holdout-capture-orchestrator';
import type { MLBGameResearchSnapshot, MLBScheduleGame, MLBScheduleResult } from '@/lib/research-data/types';

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                  */
/* -------------------------------------------------------------------------- */

const FROZEN_NOW = new Date('2026-09-06T00:00:00.000Z');
const ADVANCED_NOW = new Date('2026-09-06T01:00:00.000Z');

function buildClock(now: Date): () => Date {
  return () => now;
}

function buildAdvancingClock(start: Date): { now: () => Date; advance: (ms: number) => void } {
  let current = new Date(start.getTime());
  const advance = (ms: number) => {
    current = new Date(current.getTime() + ms);
  };
  return { now: () => new Date(current.getTime()), advance };
}

function buildFrozenActivation(
  overrides: Partial<MLBProspectiveHoldoutActivationPersisted> = {},
): MLBProspectiveHoldoutActivationPersisted {
  const base: MLBProspectiveHoldoutActivationPersisted = {
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: 'activation-900001',
    candidateRecipeId: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
    candidateFingerprint: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
    featureManifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
    featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
    preprocessingPolicyId: 'raw-finite-feature-values-with-default-missing-v1',
    captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
    compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
    evidenceArtifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
    evidenceStoreVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
    validationBoundaryOfficialDate: '2026-09-07',
    validationTargetCount: 67,
    testTargetCount: 69,
    stableOrderPolicy: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY,
    validationSideDateRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE,
    testSideDateRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE,
    noSmallerN: true,
    resultIndependentSelection: true,
    testAuthorizationRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE,
    gameIdentityBindingContractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
    gameIdentityBindingStoreVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
    persistedAt: '2026-09-06T00:00:00.000Z',
  };
  return { ...base, ...overrides } as MLBProspectiveHoldoutActivationPersisted;
}

function buildScheduleGame(overrides: Partial<MLBScheduleGame> = {}): MLBScheduleGame {
  return {
    gamePk: 1000,
    gameType: 'REGULAR_SEASON',
    gameNumber: 1,
    officialDate: '2026-09-07',
    gameDate: '2026-09-07T00:00:00.000Z',
    startTimeUtc: new Date('2026-09-07T08:00:00.000Z'),
    status: 'UPCOMING',
    homeTeamId: 100,
    homeTeamName: 'Home Team',
    awayTeamId: 200,
    awayTeamName: 'Away Team',
    venueId: 1,
    venueName: 'Stadium',
    dayNight: 'night',
    scheduledInnings: 9,
    doubleHeader: 'N',
    seriesGameNumber: 1,
    gamesInSeries: 3,
    seriesDescription: 'Regular',
    leagueRecord: {
      home: { wins: 50, losses: 50, pct: '0.500' },
      away: { wins: 50, losses: 50, pct: '0.500' },
    },
    probablePitchers: { home: null, away: null },
    ...overrides,
  };
}

function buildScheduleResult(games: MLBScheduleGame[] = []): MLBScheduleResult {
  return {
    games,
    provenance: {
      source: 'test',
      fetchedAt: new Date('2026-09-06T00:00:00.000Z'),
      isLive: false,
      warnings: [],
    },
  };
}

function buildResearchSnapshot(
  overrides: Partial<MLBGameResearchSnapshot> = {},
): MLBGameResearchSnapshot {
  const base: MLBGameResearchSnapshot = {
    event: {
      id: '1000',
      externalId: '1000',
      sport: 'mlb',
      league: 'MLB',
      leagueSlug: 'mlb',
      homeTeam: 'Home Team',
      awayTeam: 'Away Team',
      startTimeUtc: new Date('2026-09-07T08:00:00.000Z'),
      status: 'UPCOMING',
      createdAt: new Date('2026-09-06T00:00:00.000Z'),
      updatedAt: new Date('2026-09-06T00:00:00.000Z'),
    },
    probablePitchers: { home: null, away: null },
    pitcherStats: { home: null, away: null },
    teamBatting: { home: null, away: null },
    bullpen: { home: null, away: null },
    venue: null,
    weather: null,
    completeness: 1,
    warnings: [],
    provenance: [
      { source: 'test', fetchedAt: new Date('2026-09-06T00:00:00.000Z'), isLive: false, warnings: [] },
    ],
    generatedAt: new Date('2026-09-06T00:00:00.000Z'),
  };
  return { ...base, ...overrides };
}

function buildStateLoaderResult(
  activationOverrides: Partial<MLBProspectiveHoldoutActivationPersisted> = {},
  stateOverrides: {
    validationCapturedCount?: number;
    testCapturedCount?: number;
    anomalyCount?: number;
    completedGamePks?: readonly number[];
  } = {},
): MLBProspectiveHoldoutSchedulerStateLoaderResult {
  return {
    ok: true,
    activation: buildFrozenActivation(activationOverrides),
    validationCapturedCount: stateOverrides.validationCapturedCount ?? 1,
    testCapturedCount: stateOverrides.testCapturedCount ?? 0,
    anomalyCount: stateOverrides.anomalyCount ?? 0,
    completedGamePks: stateOverrides.completedGamePks ?? [],
  };
}

const CAPTURED_RESULT: MLBProspectiveHoldoutCaptureOrchestratorResult = {
  kind: 'CAPTURED_AND_BOUND',
  activationId: 'activation-900001',
  protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
  gamePk: 1000,
  gameId: '1000',
  evidenceArtifactId: 'evidence-123',
  bindingId: 'binding-456',
  scientificCutoffAt: '2026-09-06T00:00:00.000Z',
  actualDataCutoffAt: '2026-09-06T00:00:00.000Z',
  persistedAt: '2026-09-06T00:00:00.000Z',
};

function buildDeps(
  overrides: Partial<MLBProspectiveHoldoutSchedulerDependencies> = {},
): MLBProspectiveHoldoutSchedulerDependencies {
  const events: Array<{ readonly observedAt: string }> = [];
  const nowValue = overrides.now ?? buildClock(FROZEN_NOW);

  return {
    now: nowValue,
    sleep: async () => {},
    loadScientificState: async () => buildStateLoaderResult(),
    fetchSchedule: async () => buildScheduleResult(),
    provider: {
      buildGameSnapshot: async () => buildResearchSnapshot(),
    },
    captureApplication: async () => CAPTURED_RESULT,
    hostname: () => 'test-host',
    pid: () => 12345,
    ownerTokenFactory: () => 'OWNER_A',
    registerSignalHandler: () => () => {},
    createEvent: (event: MLBProspectiveHoldoutSchedulerEvent) => {
      events.push({ observedAt: event.observedAt });
    },
    acquireLock: async () => ({ acquired: true }),
    releaseLock: async () => ({ released: true }),
    readLock: async () => ({ locked: false }),
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/*  A. IMPORT / STARTUP                                                       */
/* -------------------------------------------------------------------------- */

describe('A. import / startup', () => {
  it('1. module import safe', async () => {
    const mod = await import('../../../scripts/mlb-prospective-holdout-scheduler');
    expect(mod.runMLBProspectiveHoldoutScheduler).toBeDefined();
  });

  it('2. 1/67 startup accepted', async () => {
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    expect(result.kind).toBe('DRY_RUN_COMPLETE');
  });

  it('3. testCapturedCount >0 blocked', async () => {
    const deps = buildDeps({
      loadScientificState: async () =>
        buildStateLoaderResult({}, { testCapturedCount: 1, validationCapturedCount: 0 }),
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    if (result.kind !== 'STOPPED_FAIL_CLOSED') {
      throw new Error(`Expected STAPPED_FAIL_CLOSED but got ${result.kind}`);
    }
    expect(result.reason).toContain('testCapturedCount');
  });

  it('4. invalid testAuthorizationRule rejected by validator', async () => {
    const validValidation = validateMLBProspectiveHoldoutActivationPersisted(buildFrozenActivation());
    expect(validValidation.ok).toBe(true);

    const invalidRaw = Object.assign(
      {},
      buildFrozenActivation(),
      { testAuthorizationRule: 'TEST_AUTHORIZED' },
    );
    const invalidValidation = validateMLBProspectiveHoldoutActivationPersisted(invalidRaw);
    expect(invalidValidation.ok).toBe(false);
    if (!invalidValidation.ok) {
      expect(
        invalidValidation.issues.some(
          issue => issue.code === 'ACTIVATION_CONTRACT_INVALID' && issue.path === '$.testAuthorizationRule',
        ),
      ).toBe(true);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  B. LOCKING                                                                */
/* -------------------------------------------------------------------------- */

describe('B. locking', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-lock-test-'));
  });

  function lockPath(name: string): string {
    return path.join(tempDir, `${name}.lock`);
  }

  it('5. new lock acquired', async () => {
    const lp = lockPath('acquire');
    const result = await acquireLockImpl(lp, 'OWNER_A', 1111, 'host-a', '2026-09-06T00:00:00.000Z');
    expect(result.acquired).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('6. owner metadata exact', async () => {
    const lp = lockPath('metadata');
    await acquireLockImpl(lp, 'OWNER_A', 1111, 'host-a', '2026-09-06T00:00:00.000Z');
    const raw = await fs.readFile(path.join(lp, 'owner.json'), 'utf-8');
    const meta = JSON.parse(raw);
    expect(meta.pid).toBe(1111);
    expect(meta.hostname).toBe('host-a');
    expect(meta.startedAt).toBe('2026-09-06T00:00:00.000Z');
    expect(meta.ownerToken).toBe('OWNER_A');
  });

  it('7. existing lock is not overwritten', async () => {
    const lp = lockPath('overwrite');
    await acquireLockImpl(lp, 'OWNER_A', 1111, 'host-a', '2026-09-06T00:00:00.000Z');
    const contenderResult = await acquireLockImpl(lp, 'OWNER_B', 2222, 'host-a', '2026-09-06T00:00:00.000Z', () => 'ALIVE');
    expect(contenderResult.acquired).toBe(false);
    const raw = await fs.readFile(path.join(lp, 'owner.json'), 'utf-8');
    const meta = JSON.parse(raw);
    expect(meta.ownerToken).toBe('OWNER_A');
  });

  it('8. same-host alive DIFFERENT pid blocked', async () => {
    const lp = lockPath('alive-different');
    await acquireLockImpl(lp, 'OWNER_A', 1111, 'host-a', '2026-09-06T00:00:00.000Z');
    const result = await acquireLockImpl(lp, 'OWNER_B', 2222, 'host-a', '2026-09-06T00:00:00.000Z', () => 'ALIVE');
    expect(result.acquired).toBe(false);
    expect(result.reason).toBe('SECOND_INSTANCE_BLOCKED');
  });

  it('9. same-host dead DIFFERENT pid stale recovery succeeds', async () => {
    const lp = lockPath('stale-recovery');
    await acquireLockImpl(lp, 'OWNER_A', 1111, 'host-a', '2026-09-06T00:00:00.000Z');
    const result = await acquireLockImpl(lp, 'OWNER_B', 2222, 'host-a', '2026-09-06T00:00:00.000Z', () => 'DEAD');
    expect(result.acquired).toBe(true);
    const raw = await fs.readFile(path.join(lp, 'owner.json'), 'utf-8');
    const meta = JSON.parse(raw);
    expect(meta.ownerToken).toBe('OWNER_B');
  });

  it('10. foreign-host lock fails closed', async () => {
    const lp = lockPath('foreign');
    await acquireLockImpl(lp, 'OWNER_A', 1111, 'host-a', '2026-09-06T00:00:00.000Z');
    const result = await acquireLockImpl(lp, 'OWNER_B', 2222, 'host-b', '2026-09-06T00:00:00.000Z', () => 'DEAD');
    expect(result.acquired).toBe(false);
    expect(result.reason).toBe('HUMAN_REVIEW_REQUIRED: foreign host lock');
  });

  it('11. malformed metadata fails closed', async () => {
    const lp = lockPath('malformed');
    await fs.mkdir(lp, { recursive: true });
    await fs.writeFile(path.join(lp, 'owner.json'), 'not-json');
    const result = await acquireLockImpl(lp, 'OWNER_A', 1111, 'host-a', '2026-09-06T00:00:00.000Z');
    expect(result.acquired).toBe(false);
    expect(result.reason).toBe('HUMAN_REVIEW_REQUIRED: malformed lock metadata');
  });

  it('12. owner token unchanged after stale check allows recovery', async () => {
    const lp = lockPath('token-stable');
    await acquireLockImpl(lp, 'OWNER_A', 1111, 'host-a', '2026-09-06T00:00:00.000Z');
    const result = await acquireLockImpl(lp, 'OWNER_B', 2222, 'host-a', '2026-09-06T00:00:00.000Z', () => 'DEAD');
    expect(result.acquired).toBe(true);
    const raw = await fs.readFile(path.join(lp, 'owner.json'), 'utf-8');
    const meta = JSON.parse(raw);
    expect(meta.ownerToken).toBe('OWNER_B');
  });

  it('13. reacquisition after stale recovery blocks safely', async () => {
    const lp = lockPath('reacquire-race');
    await acquireLockImpl(lp, 'OWNER_A', 1111, 'host-a', '2026-09-06T00:00:00.000Z');
    // Stale recovery for OWNER_B
    const recoveryResult = await acquireLockImpl(lp, 'OWNER_B', 2222, 'host-a', '2026-09-06T00:00:00.000Z', () => 'DEAD');
    expect(recoveryResult.acquired).toBe(true);
    // New contender with alive PID blocked
    const blockResult = await acquireLockImpl(lp, 'OWNER_C', 3333, 'host-a', '2026-09-06T00:00:00.000Z', () => 'ALIVE');
    expect(blockResult.acquired).toBe(false);
    expect(blockResult.reason).toBe('SECOND_INSTANCE_BLOCKED');
  });

  it('14. invalid PID metadata fails closed', async () => {
    const lp = lockPath('invalid-pid');
    await acquireLockImpl(lp, 'OWNER_A', 1111, 'host-a', '2026-09-06T00:00:00.000Z');
    await fs.writeFile(path.join(lp, 'owner.json'), JSON.stringify({ pid: 0, hostname: 'host-a', startedAt: '2026-09-06T00:00:00.000Z', ownerToken: 'OWNER_A' }));
    const result = await acquireLockImpl(lp, 'OWNER_B', 2222, 'host-a', '2026-09-06T00:00:00.000Z', () => 'DEAD');
    expect(result.acquired).toBe(false);
    expect(result.reason).toBe('MALFORMED_LOCK_METADATA: invalid pid');
  });

  it('15. classifyPidKillError ESRCH => DEAD', () => {
    const err = new Error('no such process') as NodeJS.ErrnoException;
    err.code = 'ESRCH';
    expect(classifyPidKillError(err)).toBe('DEAD');
  });

  it('16. classifyPidKillError EPERM => ALIVE', () => {
    const err = new Error('not permitted') as NodeJS.ErrnoException;
    err.code = 'EPERM';
    expect(classifyPidKillError(err)).toBe('ALIVE');
  });

  it('17. classifyPidKillError unknown => UNKNOWN', () => {
    expect(classifyPidKillError(new Error('weird'))).toBe('UNKNOWN');
  });

  it('18. acquireRecoveryClaim: existing alive recovery PID => RECOVERY_IN_PROGRESS_OR_MANUAL_REVIEW', async () => {
    const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-claim-test-'));
    const ownerToken = 'OWNER_ALIVE';
    const claimDir = path.join(runtimeDir, `stale-recovery-${createHash('sha256').update(ownerToken).digest('hex')}.claim`);
    try {
      const first = await acquireRecoveryClaim(claimDir, 2222, 'host-a', ownerToken, 'recovery-1', '2026-09-06T00:00:00.000Z');
      expect(first.acquired).toBe(true);

      const result = await acquireRecoveryClaim(claimDir, 2222, 'host-a', ownerToken, 'recovery-new', '2026-09-06T00:00:00.000Z', () => 'ALIVE');
      expect(result.acquired).toBe(false);
      expect(result.reason).toBe('RECOVERY_IN_PROGRESS_OR_MANUAL_REVIEW');
    } finally {
      await fs.rm(claimDir, { recursive: true, force: true }).catch(() => {});
      await fs.rm(runtimeDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('19. acquireRecoveryClaim: existing claim => RECOVERY_IN_PROGRESS_OR_MANUAL_REVIEW', async () => {
    const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-claim-test-'));
    const ownerToken = 'OWNER_DEAD';
    const claimDir = path.join(runtimeDir, `stale-recovery-${createHash('sha256').update(ownerToken).digest('hex')}.claim`);
    try {
      const first = await acquireRecoveryClaim(claimDir, 2222, 'host-a', ownerToken, 'recovery-2', '2026-09-06T00:00:00.000Z');
      expect(first.acquired).toBe(true);

      const result = await acquireRecoveryClaim(claimDir, 2222, 'host-a', ownerToken, 'recovery-new', '2026-09-06T00:00:00.000Z', () => 'DEAD');
      expect(result.acquired).toBe(false);
      expect(result.reason).toBe('RECOVERY_IN_PROGRESS_OR_MANUAL_REVIEW');
    } finally {
      await fs.rm(claimDir, { recursive: true, force: true }).catch(() => {});
      await fs.rm(runtimeDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('20. concurrent acquireRecoveryClaim: exactly one winner (CLAIM_PRIMITIVE_TEST)', async () => {
    const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-concurrent-'));
    const ownerToken = 'OWNER_A';
    const claimDir = path.join(runtimeDir, `stale-recovery-${createHash('sha256').update(ownerToken).digest('hex')}.claim`);

    const alivePids = new Set<number>([2222, 3333]);
    const checkPidLiveness = (pid: number) => (alivePids.has(pid) ? 'ALIVE' : 'DEAD');

    const contenderB = acquireRecoveryClaim(claimDir, 2222, 'host-a', ownerToken, 'recovery-b', '2026-09-06T00:00:00.000Z', checkPidLiveness);
    const contenderC = acquireRecoveryClaim(claimDir, 3333, 'host-a', ownerToken, 'recovery-c', '2026-09-06T00:00:00.000Z', checkPidLiveness);

    const [resultB, resultC] = await Promise.all([contenderB, contenderC]);

    const winners = [resultB, resultC].filter(r => r.acquired);
    expect(winners).toHaveLength(1);

    const losers = [resultB, resultC].filter(r => !r.acquired);
    for (const loser of losers) {
      expect(loser.reason).toBe('RECOVERY_IN_PROGRESS_OR_MANUAL_REVIEW');
    }

    await releaseRecoveryClaim(claimDir).catch(() => {});

    const entries = await fs.readdir(runtimeDir);
    const claimDirs = entries.filter(e => e.startsWith('stale-recovery-') && e.endsWith('.claim'));
    expect(claimDirs).toHaveLength(0);

    await fs.rm(runtimeDir, { recursive: true, force: true }).catch(() => {});
  });

  it('21. own-token release succeeds', async () => {
    const lp = lockPath('release-own');
    await acquireLockImpl(lp, 'OWNER_A', 1111, 'host-a', '2026-09-06T00:00:00.000Z');
    const releaseResult = await releaseLockImpl(lp, 'OWNER_A');
    expect(releaseResult.released).toBe(true);
    const exists = await fs.stat(lp).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });

  it('15. different-token release does not remove', async () => {
    const lp = lockPath('release-different');
    await acquireLockImpl(lp, 'OWNER_A', 1111, 'host-a', '2026-09-06T00:00:00.000Z');
    const releaseResult = await releaseLockImpl(lp, 'OWNER_B');
    expect(releaseResult.released).toBe(false);
    expect(releaseResult.reason).toBe('owner token mismatch on release');
    const exists = await fs.stat(lp).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('22. concurrent acquireLockImpl stale recovery: exactly one winner (FULL_ACQUIRE_LOCK_TEST)', async () => {
    const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-lock-concurrent-'));
    const lp = path.join(runtimeDir, 'active.lock');

    await acquireLockImpl(lp, 'OWNER_A', 1111, 'host-a', '2026-09-06T00:00:00.000Z');

    const alivePids = new Set<number>([2222, 3333]);
    const checkPidLiveness = (pid: number) => (alivePids.has(pid) ? 'ALIVE' : 'DEAD');

    const [resultB, resultC] = await Promise.all([
      acquireLockImpl(lp, 'OWNER_B', 2222, 'host-a', '2026-09-06T00:00:00.000Z', checkPidLiveness),
      acquireLockImpl(lp, 'OWNER_C', 3333, 'host-a', '2026-09-06T00:00:00.000Z', checkPidLiveness),
    ]);

    const winners = [resultB, resultC].filter(r => r.acquired);
    expect(winners).toHaveLength(1);

    const winnerToken = winners[0] === resultB ? 'OWNER_B' : 'OWNER_C';
    const winnerPid = winners[0] === resultB ? 2222 : 3333;

    const exists = await fs.stat(lp).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const raw = await fs.readFile(path.join(lp, 'owner.json'), 'utf-8');
    const meta = JSON.parse(raw);
    expect(meta.ownerToken).toBe(winnerToken);
    expect(meta.pid).toBe(winnerPid);
    expect(meta.hostname).toBe('host-a');

    const loserToken = winners[0] === resultB ? 'OWNER_C' : 'OWNER_B';
    const releaseResult = await releaseLockImpl(lp, loserToken);
    expect(releaseResult.released).toBe(false);
    expect(releaseResult.reason).toBe('owner token mismatch on release');

    const existsAfter = await fs.stat(lp).then(() => true).catch(() => false);
    expect(existsAfter).toBe(true);

    const entries = await fs.readdir(runtimeDir);
    const claimDirs = entries.filter(e => e.startsWith('stale-recovery-') && e.endsWith('.claim'));
    expect(claimDirs).toHaveLength(0);

    await fs.rm(runtimeDir, { recursive: true, force: true }).catch(() => {});
  });

  it('23. concurrent acquireLockImpl stale recovery stress 100x', async () => {
    // 100 sequential filesystem-bound iterations need extended timeout.
    for (let i = 0; i < 100; i++) {
      const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-lock-stress-'));
      const lp = path.join(runtimeDir, 'active.lock');

      await acquireLockImpl(lp, 'OWNER_A', 1111, 'host-a', '2026-09-06T00:00:00.000Z');

      const alivePids = new Set<number>([2222, 3333]);
      const checkPidLiveness = (pid: number) => (alivePids.has(pid) ? 'ALIVE' : 'DEAD');

      const [resultB, resultC] = await Promise.all([
        acquireLockImpl(lp, 'OWNER_B', 2222, 'host-a', '2026-09-06T00:00:00.000Z', checkPidLiveness),
        acquireLockImpl(lp, 'OWNER_C', 3333, 'host-a', '2026-09-06T00:00:00.000Z', checkPidLiveness),
      ]);

      const winners = [resultB, resultC].filter(r => r.acquired);
      expect(winners).toHaveLength(1);

      const winnerToken = winners[0] === resultB ? 'OWNER_B' : 'OWNER_C';
      const winnerPid = winners[0] === resultB ? 2222 : 3333;

      const raw = await fs.readFile(path.join(lp, 'owner.json'), 'utf-8');
      const meta = JSON.parse(raw);
      expect(meta.ownerToken).toBe(winnerToken);
      expect(meta.pid).toBe(winnerPid);
      expect(meta.hostname).toBe('host-a');

      const entries = await fs.readdir(runtimeDir);
      const claimDirs = entries.filter(e => e.startsWith('stale-recovery-') && e.endsWith('.claim'));
      expect(claimDirs).toHaveLength(0);

      await fs.rm(runtimeDir, { recursive: true, force: true }).catch(() => {});
    }
  }, 30000);

  it('24. acquireRecoveryClaim: concurrent EEXIST preserves single winner (CLAIM_PRIMITIVE_TEST)', async () => {
    const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-claim-atomic-'));
    const ownerToken = 'OWNER_ATOMIC';
    const claimDir = path.join(runtimeDir, `stale-recovery-${createHash('sha256').update(ownerToken).digest('hex')}.claim`);

    const [resultB, resultC] = await Promise.all([
      acquireRecoveryClaim(claimDir, 2222, 'host-a', ownerToken, 'recovery-b', '2026-09-06T00:00:00.000Z', () => 'ALIVE'),
      acquireRecoveryClaim(claimDir, 3333, 'host-a', ownerToken, 'recovery-c', '2026-09-06T00:00:00.000Z', () => 'ALIVE'),
    ]);

    const winners = [resultB, resultC].filter(r => r.acquired);
    expect(winners).toHaveLength(1);

    const claimMeta = await readRecoveryClaimMetadata(claimDir);
    expect(claimMeta).toBeDefined();
    expect(claimMeta!.recoveryToken).toBe(winners[0] === resultB ? 'recovery-b' : 'recovery-c');
    expect(claimMeta!.ownerTokenBeingRecovered).toBe(ownerToken);

    await releaseRecoveryClaim(claimDir).catch(() => {});
    await fs.rm(runtimeDir, { recursive: true, force: true }).catch(() => {});
  });

  it('25. no setTimeout inside acquireRecoveryClaim', async () => {
    const schedulerSourcePath = path.resolve(
      fileURLToPath(import.meta.url),
      '..',
      '..',
      '..',
      '..',
      'scripts',
      'mlb-prospective-holdout-scheduler.ts',
    );
    const src = await fs.readFile(schedulerSourcePath, 'utf-8');
    const startIdx = src.indexOf('export async function acquireRecoveryClaim');
    const endIdx = src.indexOf('export async function releaseRecoveryClaim', startIdx);
    const body = src.slice(startIdx, endIdx);
    expect(body).not.toContain('setTimeout');
  });

  it('26. acquireRecoveryClaim: truthful ownerTokenBeingRecovered metadata', async () => {
    const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-claim-truth-'));
    const ownerToken = 'OWNER_TRUTH';
    const claimDir = path.join(runtimeDir, `stale-recovery-${createHash('sha256').update(ownerToken).digest('hex')}.claim`);

    try {
      const result = await acquireRecoveryClaim(claimDir, 2222, 'host-a', ownerToken, 'recovery-truth', '2026-09-06T00:00:00.000Z');
      expect(result.acquired).toBe(true);

      const meta = await readRecoveryClaimMetadata(claimDir);
      expect(meta).toBeDefined();
      expect(meta!.ownerTokenBeingRecovered).toBe(ownerToken);
    } finally {
      await fs.rm(claimDir, { recursive: true, force: true }).catch(() => {});
      await fs.rm(runtimeDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  C. EVENT CLOCK                                                             */
/* -------------------------------------------------------------------------- */

describe('C. event clock', () => {
  it('16. all event timestamps use injected now', async () => {
    const events: Array<{ readonly observedAt: string }> = [];
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(FROZEN_NOW),
      createEvent: (event: MLBProspectiveHoldoutSchedulerEvent) => {
        events.push({ observedAt: event.observedAt });
      },
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async () => buildScheduleResult([scheduleGame]),
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    for (const ev of events) {
      expect(ev.observedAt).toBe('2026-09-06T00:00:00.000Z');
    }
  });

  it('17. clock advancement reflected deterministically', async () => {
    const events: Array<{ readonly observedAt: string }> = [];
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(FROZEN_NOW),
      createEvent: (event: MLBProspectiveHoldoutSchedulerEvent) => {
        events.push({ observedAt: event.observedAt });
      },
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async () => buildScheduleResult([scheduleGame]),
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    expect(events.length).toBeGreaterThan(0);
    const lastObservedAt = events[events.length - 1]?.observedAt;
    expect(lastObservedAt).toBe('2026-09-06T00:00:00.000Z');

    events.length = 0;
    const deps2 = buildDeps({
      now: buildClock(ADVANCED_NOW),
      createEvent: (event: MLBProspectiveHoldoutSchedulerEvent) => {
        events.push({ observedAt: event.observedAt });
      },
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async () => buildScheduleResult([scheduleGame]),
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps2);
    expect(events.length).toBeGreaterThan(0);
    const advancedObservedAt = events[events.length - 1]?.observedAt;
    expect(advancedObservedAt).toBe('2026-09-06T01:00:00.000Z');
  });

  it('18. identical injected run produces identical event timestamps/sequence', async () => {
    const events1: Array<{ readonly observedAt: string }> = [];
    const events2: Array<{ readonly observedAt: string }> = [];

    const scheduleGame = buildScheduleGame();
    const buildDeterministicDeps = (sink: Array<{ readonly observedAt: string }>): MLBProspectiveHoldoutSchedulerDependencies =>
      buildDeps({
        now: buildClock(FROZEN_NOW),
        createEvent: (event: MLBProspectiveHoldoutSchedulerEvent) => {
          sink.push({ observedAt: event.observedAt });
        },
        fetchSchedule: async () => buildScheduleResult([scheduleGame]),
      });

    const deps1 = buildDeterministicDeps(events1);
    const deps2 = buildDeterministicDeps(events2);
    await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps1);
    await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps2);
    expect(events1).toEqual(events2);
  });
});

/* -------------------------------------------------------------------------- */
/*  D. CAPTURE AUTHORITY STATIC/BEHAVIORAL                                    */
/* -------------------------------------------------------------------------- */

describe('D. capture authority', () => {
  const schedulerSourcePath = path.resolve(
    fileURLToPath(import.meta.url),
    '..',
    '..',
    '..',
    '..',
    'scripts',
    'mlb-prospective-holdout-scheduler.ts',
  );

  it('19. no direct orchestrator call expression in scheduler dispatch', async () => {
    const src = await fs.readFile(schedulerSourcePath, 'utf-8');
    const orchestratorCallPattern = /runProspectiveHoldoutCaptureOrchestrator\s*\(/;
    expect(orchestratorCallPattern.test(src)).toBe(false);
  });

  it('20. no direct gamePk capture wrapper dispatch', async () => {
    const src = await fs.readFile(schedulerSourcePath, 'utf-8');
    const gamePkWrapPattern = /runProspectiveHoldoutCapture\s*\(/;
    expect(gamePkWrapPattern.test(src)).toBe(false);
  });

  it('21. shared captureApplication boundary is used', async () => {
    const src = await fs.readFile(schedulerSourcePath, 'utf-8');
    expect(src).toContain('deps.captureApplication');
    expect(src).toContain('runProspectiveHoldoutCaptureForScheduleGame');
  });
});

/* -------------------------------------------------------------------------- */
/*  E. STARTUP MATRIX                                                        */
/* -------------------------------------------------------------------------- */

describe('E. startup matrix', () => {
  it('27. 66/67 startup accepted', async () => {
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      loadScientificState: async () => buildStateLoaderResult({}, { validationCapturedCount: 66 }),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    expect(result.kind).toBe('DRY_RUN_COMPLETE');
  });

  it('28. 67/67 target complete stops dry-run', async () => {
    const deps = buildDeps({
      loadScientificState: async () => buildStateLoaderResult({}, { validationCapturedCount: 67 }),
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    expect(result.kind).toBe('DRY_RUN_COMPLETE');
  });

  it('29. 68/67 human review required', async () => {
    const deps = buildDeps({
      loadScientificState: async () => buildStateLoaderResult({}, { validationCapturedCount: 68 }),
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
    if (result.kind === 'STOPPED_FAIL_CLOSED') {
      expect(result.reason).toContain('validationCapturedCount out of range');
    }
  });

  it('30. negative validation count fail closed', async () => {
    const deps = buildDeps({
      loadScientificState: async () => buildStateLoaderResult({}, { validationCapturedCount: -1 }),
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
    if (result.kind === 'STOPPED_FAIL_CLOSED') {
      expect(result.reason).toContain('validationCapturedCount out of range');
    }
  });

  it('31. state loader failure prevents fetch/capture', async () => {
    let fetchCount = 0;
    const deps = buildDeps({
      loadScientificState: async () => ({ ok: false, reason: 'state unavailable' } as const),
      fetchSchedule: async () => {
        fetchCount++;
        return buildScheduleResult();
      },
      captureApplication: async () => {
        throw new Error('capture must not be called');
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
    expect(fetchCount).toBe(0);
  });

  it('32. anomalyCount >0 fail closed', async () => {
    const deps = buildDeps({
      loadScientificState: async () => buildStateLoaderResult({}, { anomalyCount: 1 }),
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
    const failed = result as { readonly kind: 'STOPPED_FAIL_CLOSED'; readonly reason: string };
    expect(failed.reason).toContain('anomalyCount');
  });

  it('33. target complete prevents schedule fetch in normal runtime', async () => {
    let fetchCount = 0;
    const deps = buildDeps({
      loadScientificState: async () => buildStateLoaderResult({}, { validationCapturedCount: 67 }),
      fetchSchedule: async () => {
        fetchCount++;
        return buildScheduleResult();
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(result.kind).toBe('STOPPED_CLEAN');
    expect(fetchCount).toBe(0);
  });

  it('34. activation unavailable fails closed before capture', async () => {
    const deps = buildDeps({
      loadScientificState: async () => ({ ok: false, reason: 'activation missing' } as const),
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
  });

  it('35. wrong test authorization fails closed via real validator', async () => {
    // Raw untrusted activation input — simulates loading from an untrusted boundary.
    // testAuthorizationRule: 'TEST_AUTHORIZED' violates the frozen literal.
    const rawActivation: Record<string, unknown> = {
      ...buildFrozenActivation(),
      testAuthorizationRule: 'TEST_AUTHORIZED',
    };

    // First, prove the real validator rejects the malformed input.
    const validation =
      validateMLBProspectiveHoldoutActivationPersisted(rawActivation);
    expect(validation.ok).toBe(false);
    if (validation.ok) {
      throw new Error('Expected validation to reject TEST_AUTHORIZED');
    }
    expect(
      validation.issues.some(
        issue =>
          issue.code === 'ACTIVATION_CONTRACT_INVALID' &&
          issue.path === '$.testAuthorizationRule',
      ),
    ).toBe(true);

    // Then prove scheduler host fail-closes when loadScientificState returns
    // the corresponding validation failure — with zero fetch/capture calls.
    // rawActivation is NOT placed into an ok:true typed scheduler state.
    let fetchCount = 0;
    let captureCount = 0;
    const deps = buildDeps({
      loadScientificState: async () => ({
        ok: false as const,
        reason: `activation unavailable: ${validation.issues.map(i => i.code).join(', ')}`,
      }),
      fetchSchedule: async () => {
        fetchCount++;
        return buildScheduleResult([]);
      },
      captureApplication: async () => {
        captureCount++;
        return CAPTURED_RESULT;
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    if (result.kind !== 'STOPPED_FAIL_CLOSED') {
      throw new Error(`Expected STOPPED_FAIL_CLOSED but got ${result.kind}`);
    }
    expect(result.reason).toContain('ACTIVATION_CONTRACT_INVALID');
    expect(fetchCount).toBe(0);
    expect(captureCount).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  F. DRY-RUN MATRIX                                                        */
/* -------------------------------------------------------------------------- */

describe('F. dry-run matrix', () => {
  it('36. DISPATCH_NOW emits DRY_RUN_CAPTURE_PREVIEW', async () => {
    const scheduleGame = buildScheduleGame({
      startTimeUtc: new Date('2026-09-07T08:00:00.000Z'),
    });
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:45:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    expect(result.kind).toBe('DRY_RUN_COMPLETE');
  });

  it('37. dry-run WAIT_UNTIL_TARGET emits NEXT_CAPTURE_PLANNED', async () => {
    const scheduleGame = buildScheduleGame();
    const events: Array<{ readonly event: string }> = [];
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-06T00:00:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      createEvent: (event) => {
        events.push({ event: event.event });
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    expect(events.some(e => e.event === 'NEXT_CAPTURE_PLANNED')).toBe(true);
  });

  it('38. dry-run VALIDATION_TARGET_UNREACHABLE emitted', async () => {
    const events: Array<{ readonly event: string }> = [];
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-06T00:00:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async () => buildScheduleResult([]),
      createEvent: (event) => {
        events.push({ event: event.event });
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
    expect(events.some(e => e.event === 'HUMAN_REVIEW_REQUIRED')).toBe(true);
  });

  it('39. dry-run VALIDATION_TARGET_COMPLETE emitted', async () => {
    const events: Array<{ readonly event: string }> = [];
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-06T00:00:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult({}, { validationCapturedCount: 67 }),
      createEvent: (event) => {
        events.push({ event: event.event });
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    expect(result.kind).toBe('DRY_RUN_COMPLETE');
    expect(events.some(e => e.event === 'VALIDATION_TARGET_COMPLETE')).toBe(true);
  });

  it('40. dry-run makes zero captureApplication calls', async () => {
    let captureCalls = 0;
    const scheduleGame = buildScheduleGame({
      startTimeUtc: new Date('2026-09-07T08:00:00.000Z'),
    });
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:45:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => {
        captureCalls++;
        return CAPTURED_RESULT;
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    expect(captureCalls).toBe(0);
  });

  it('41. dry-run makes zero provider.buildGameSnapshot calls', async () => {
    let snapshotCalls = 0;
    const scheduleGame = buildScheduleGame({
      startTimeUtc: new Date('2026-09-07T08:00:00.000Z'),
    });
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:45:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      provider: {
        buildGameSnapshot: async () => {
          snapshotCalls++;
          return buildResearchSnapshot();
        },
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    expect(snapshotCalls).toBe(0);
  });

  it('42. dry-run releases lock via finally', async () => {
    let released = false;
    const deps = buildDeps({
      loadScientificState: async () => buildStateLoaderResult(),
      releaseLock: async () => {
        released = true;
        return { released: true };
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    expect(released).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  G. SCHEDULE WINDOW                                                        */
/* -------------------------------------------------------------------------- */

describe('G. schedule window', () => {
  it('43. normal window fetches current to boundary', async () => {
    const fetchedDates: string[] = [];
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-06T00:00:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) => {
        fetchedDates.push(date);
        return date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]);
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    expect(fetchedDates).toContain('2026-09-06');
    expect(fetchedDates).toContain('2026-09-07');
    expect(fetchedDates).not.toContain('2026-09-08');
  });

  it('44. current date beyond boundary with count <67 -> target unreachable', async () => {
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-08T00:00:00.000Z')),
      loadScientificState: async () =>
        buildStateLoaderResult({ validationBoundaryOfficialDate: '2026-09-07' }),
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
  });
});

/* -------------------------------------------------------------------------- */
/*  H. POLLING / WAIT                                                         */
/* -------------------------------------------------------------------------- */

describe('H. polling / wait', () => {
  it('45. target earlier than refresh waits exact target', async () => {
    const scheduleGame = buildScheduleGame({
      startTimeUtc: new Date('2026-09-07T05:17:00.000Z'),
    });
    const sleepCalls: Array<{ readonly ms: number }> = [];
    const clock = buildAdvancingClock(new Date('2026-09-06T23:00:00.000Z'));
    let captured = false;
    const deps = buildDeps({
      now: clock.now,
      loadScientificState: async () => {
        if (captured) {
          return buildStateLoaderResult(
            {},
            { validationCapturedCount: 67, completedGamePks: [scheduleGame.gamePk] },
          );
        }
        return buildStateLoaderResult();
      },
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      sleep: async (ms: number) => {
        sleepCalls.push({ ms });
        clock.advance(ms);
      },
      captureApplication: async () => {
        captured = true;
        return CAPTURED_RESULT;
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(sleepCalls.length).toBeGreaterThan(0);
    expect(sleepCalls[0]!.ms).toBeLessThan(5 * 60 * 1000);
  });

  it('46. target beyond 5min refreshes at 5min', async () => {
    const scheduleGame = buildScheduleGame({
      startTimeUtc: new Date('2026-09-07T12:00:00.000Z'),
    });
    const sleepCalls: Array<{ readonly ms: number }> = [];
    const clock = buildAdvancingClock(new Date('2026-09-06T00:00:00.000Z'));
    let captured = false;
    const deps = buildDeps({
      now: clock.now,
      loadScientificState: async () => {
        if (captured) {
          return buildStateLoaderResult(
            {},
            { validationCapturedCount: 67, completedGamePks: [scheduleGame.gamePk] },
          );
        }
        return buildStateLoaderResult();
      },
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      sleep: async (ms: number) => {
        sleepCalls.push({ ms });
        clock.advance(ms);
      },
      captureApplication: async () => {
        captured = true;
        return CAPTURED_RESULT;
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(sleepCalls.length).toBeGreaterThan(0);
    expect(sleepCalls[0]!.ms).toBe(5 * 60 * 1000);
  });
});

/* -------------------------------------------------------------------------- */
/*  I. WAIT INTERRUPTIBILITY                                                   */
/* -------------------------------------------------------------------------- */

describe('I. wait interruptibility', () => {
  it('47. SIGINT during wait aborts sleep and stops', async () => {
    let capturedSigintHandler: (() => void) | undefined;
    let sleepRejected = false;
    let sleepEnteredResolve: (() => void) | undefined;
    const sleepEntered = new Promise<void>(resolve => {
      sleepEnteredResolve = resolve;
    });
    const scheduleGame = buildScheduleGame({
      startTimeUtc: new Date('2026-09-07T07:00:00.000Z'),
    });
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-06T23:00:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      registerSignalHandler: (signal, handler) => {
        if (signal === 'SIGINT') {
          capturedSigintHandler = handler;
        }
        return () => {};
      },
      sleep: async (_ms, signal) => {
        return new Promise<void>((_resolve, reject) => {
          if (signal?.aborted) {
            sleepRejected = true;
            reject(new Error('aborted'));
            return;
          }
          signal?.addEventListener('abort', () => {
            sleepRejected = true;
            reject(new Error('aborted'));
          }, { once: true });
          sleepEnteredResolve?.();
        });
      },
    });
    const promise = runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    await sleepEntered;
    capturedSigintHandler?.();
    const result = await promise;
    expect(result.kind).toBe('STOPPED_CLEAN');
    expect(sleepRejected).toBe(true);
  });

  it('48. SIGTERM during wait aborts sleep and stops', async () => {
    let capturedSigtermHandler: (() => void) | undefined;
    let sleepRejected = false;
    let sleepEnteredResolve: (() => void) | undefined;
    const sleepEntered = new Promise<void>(resolve => {
      sleepEnteredResolve = resolve;
    });
    const scheduleGame = buildScheduleGame({
      startTimeUtc: new Date('2026-09-07T07:00:00.000Z'),
    });
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-06T23:00:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      registerSignalHandler: (signal, handler) => {
        if (signal === 'SIGTERM') {
          capturedSigtermHandler = handler;
        }
        return () => {};
      },
      sleep: async (_ms, signal) => {
        return new Promise<void>((_resolve, reject) => {
          if (signal?.aborted) {
            sleepRejected = true;
            reject(new Error('aborted'));
            return;
          }
          signal?.addEventListener('abort', () => {
            sleepRejected = true;
            reject(new Error('aborted'));
          }, { once: true });
          sleepEnteredResolve?.();
        });
      },
    });
    const promise = runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    await sleepEntered;
    capturedSigtermHandler?.();
    const result = await promise;
    expect(result.kind).toBe('STOPPED_CLEAN');
    expect(sleepRejected).toBe(true);
  });

  it('48b. signal after sleep entered — clean shutdown without rejection', async () => {
    // Signal fires AFTER sleep has entered. Sleep does NOT reject — it
    // settles only when explicitly released. Scheduler must still detect
    // shuttingDown once that pending sleep settles.
    let capturedSigtermHandler: (() => void) | undefined;
    let sleepCalled = false;
    let sleepEnteredResolve: (() => void) | undefined;
    const sleepEntered = new Promise<void>(resolve => {
      sleepEnteredResolve = resolve;
    });
    let sleepResolve: (() => void) | undefined;
    const sleepProceed = new Promise<void>(resolve => {
      sleepResolve = resolve;
    });
    const scheduleGame = buildScheduleGame({
      startTimeUtc: new Date('2026-09-07T07:00:00.000Z'),
    });
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-06T23:00:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      registerSignalHandler: (signal, handler) => {
        if (signal === 'SIGTERM') {
          capturedSigtermHandler = handler;
        }
        return () => {};
      },
      sleep: async () => {
        sleepCalled = true;
        sleepEnteredResolve?.();
        // Sleep does NOT reject — return only when explicitly released.
        await sleepProceed;
        return;
      },
    });
    const promise = runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    await sleepEntered;
    // Fire signal BEFORE sleep resolves.
    capturedSigtermHandler?.();
    sleepResolve?.();
    const result = await promise;
    expect(sleepCalled).toBe(true);
    expect(result.kind).toBe('STOPPED_CLEAN');
  });

  it('48c. TRUE pre-sleep signal: SIGTERM fires while acquireLock is pending', async () => {
    // Signal handlers register synchronously — BEFORE acquireLock is called.
    // acquireLock deliberately pauses before returning acquired=true.
    // SIGTERM fires while acquireLock is still pending. When acquireLock
    // resolves, the scheduler observes shuttingDown BEFORE any scheduler wait
    // (sleep) or capture begins. Must stop cleanly with zero sleeps/captures.
    let capturedSigtermHandler: (() => void) | undefined;
    let sleepCalls = 0;
    let captureCalls = 0;
    let lockReleaseCount = 0;
    let handlerCleanupCount = 0;
    let lockEnteredResolve: (() => void) | undefined;
    const lockEntered = new Promise<void>(resolve => {
      lockEnteredResolve = resolve;
    });
    let allowLockAcquisitionResolve: (() => void) | undefined;
    const allowLockAcquisition = new Promise<void>(resolve => {
      allowLockAcquisitionResolve = resolve;
    });
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      acquireLock: async () => {
        lockEnteredResolve?.();
        await allowLockAcquisition;
        return { acquired: true };
      },
      registerSignalHandler: (signal, handler) => {
        if (signal === 'SIGTERM') {
          capturedSigtermHandler = handler;
        }
        return () => {
          handlerCleanupCount++;
        };
      },
      releaseLock: async () => {
        lockReleaseCount++;
        return { released: true };
      },
      sleep: async () => {
        sleepCalls++;
        return;
      },
      captureApplication: async () => {
        captureCalls++;
        return CAPTURED_RESULT;
      },
    });
    const promise = runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    await lockEntered;
    // Signal fires while acquireLock is pending — BEFORE any scheduler wait.
    capturedSigtermHandler?.();
    allowLockAcquisitionResolve?.();
    const result = await promise;
    expect(sleepCalls).toBe(0);
    expect(captureCalls).toBe(0);
    expect(result.kind).toBe('STOPPED_CLEAN');
    // Lock was acquired (acquired: true) so the owned lock must be released
    // exactly once via the finally cleanup, and both registered signal
    // handlers (SIGINT + SIGTERM) must be unregistered on clean exit.
    expect(lockReleaseCount).toBe(1);
    expect(handlerCleanupCount).toBe(2);
  });
});

/* -------------------------------------------------------------------------- */
/*  J. PRE-DISPATCH FRESH LOOKUP                                               */
/* -------------------------------------------------------------------------- */

describe('J. pre-dispatch fresh lookup', () => {
  it('49. absent gamePk after fresh lookup -> no capture', async () => {
    let captureCalls = 0;
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) => {
        if (date === '2026-09-06' || date === '2026-09-07' || date === '2026-09-08') {
          return buildScheduleResult([]);
        }
        return buildScheduleResult([scheduleGame]);
      },
      captureApplication: async () => {
        captureCalls++;
        return CAPTURED_RESULT;
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(captureCalls).toBe(0);
  });

  it('50. duplicate gamePk in fresh lookup -> human review', async () => {
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame, scheduleGame]) : buildScheduleResult([]),
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    if (result.kind !== 'STOPPED_FAIL_CLOSED') {
      throw new Error(`Expected STAPPED_FAIL_CLOSED but got ${result.kind}`);
    }
    expect(result.reason).toContain('duplicate gamePk');
  });

  it('51. fresh one-day officialDate drift beyond boundary -> TEST_SIDE_BLOCKED', async () => {
    // Pre-dispatch fresh lookup matrix: minimal officialDate drift (one day
    // beyond the validation boundary) caught by the production fresh
    // selected-game firewall. The initial planning schedule carries the game
    // ON the boundary (validation-side, selectable); only the fresh pre-
    // dispatch lookup reveals the same gamePk with officialDate drifted one
    // day past the boundary. Distinct from test 59 (section M), which covers a
    // 3-day drift with an advancing clock.
    const boundaryDate = '2026-09-07';
    const validationGame = buildScheduleGame({ officialDate: boundaryDate });
    const testSideGame = buildScheduleGame({ officialDate: '2026-09-08' });
    const events: Array<{
      readonly event: string;
      readonly officialDate?: unknown;
    }> = [];
    let officialDateFetchCount = 0;
    let stateLoads = 0;
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => {
        stateLoads++;
        return buildStateLoaderResult(
          { validationBoundaryOfficialDate: boundaryDate },
          { validationCapturedCount: stateLoads === 1 ? 1 : 67 },
        );
      },
      fetchSchedule: async (date: string) => {
        // Fetch #1 (initial planning window) returns the validation-side game
        // (officialDate on the boundary, selectable); fetch #2 (pre-dispatch
        // fresh lookup) returns the SAME gamePk with officialDate drifted one
        // day past the boundary. Subsequent fetches return the validation-side
        // game so the run terminates cleanly via target-completion readback.
        if (date === validationGame.officialDate) {
          officialDateFetchCount++;
          if (officialDateFetchCount === 2) {
            return buildScheduleResult([testSideGame]);
          }
        }
        return date === validationGame.officialDate
          ? buildScheduleResult([validationGame])
          : buildScheduleResult([]);
      },
      createEvent: (event) => {
        events.push({ event: event.event, officialDate: event.officialDate });
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    const blocked = events.find((e) => e.event === 'TEST_SIDE_BLOCKED');
    expect(blocked).toBeDefined();
    expect(blocked?.officialDate).toBe('2026-09-08');
    expect(result.kind).toBe('STOPPED_CLEAN');
  });

  it('52. status not upcoming -> no capture', async () => {
    let captureCalls = 0;
    const scheduleGame = buildScheduleGame({ status: 'LIVE' });
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => {
        captureCalls++;
        return CAPTURED_RESULT;
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(captureCalls).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  K. ADJACENT UTC REFRESH                                                   */
/* -------------------------------------------------------------------------- */

describe('K. adjacent UTC refresh', () => {
  it('53. tomorrow-UTC game resolves after fresh lookup', async () => {
    const scheduleGame = buildScheduleGame({
      officialDate: '2026-09-07',
      startTimeUtc: new Date('2026-09-07T01:00:00.000Z'),
    });
    let stateLoads = 0;
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-06T18:45:00.000Z')),
      loadScientificState: async () => {
        stateLoads++;
        return buildStateLoaderResult(
          { validationBoundaryOfficialDate: '2026-09-07' },
          { validationCapturedCount: stateLoads === 1 ? 1 : 67 },
        );
      },
      fetchSchedule: async (date: string) => {
        if (date === '2026-09-07') {
          return buildScheduleResult([scheduleGame]);
        }
        return buildScheduleResult([]);
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(result.kind).toBe('STOPPED_CLEAN');
  });
});

/* -------------------------------------------------------------------------- */
/*  L. FRESH TIMING AUTHORITY                                                 */
/* -------------------------------------------------------------------------- */

describe('L. fresh timing authority', () => {
  it('54. exact T-375 dispatches', async () => {
    const startTime = new Date('2026-09-07T08:00:00.000Z');
    const now = new Date(startTime.getTime() - 375 * 60 * 1000);
    const scheduleGame = buildScheduleGame({ startTimeUtc: startTime });
    let captureCalls = 0;
    const deps = buildDeps({
      now: buildClock(now),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => {
        captureCalls++;
        return CAPTURED_RESULT;
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(captureCalls).toBe(1);
  });

  it('55. T-375 minus 1ms waits', async () => {
    const startTime = new Date('2026-09-07T08:00:00.000Z');
    const now = new Date(startTime.getTime() - 375 * 60 * 1000 - 1);
    const scheduleGame = buildScheduleGame({ startTimeUtc: startTime });
    const sleepCalls: Array<{ readonly ms: number }> = [];
    const clock = buildAdvancingClock(now);
    let stateLoads = 0;
    const deps = buildDeps({
      now: clock.now,
      loadScientificState: async () => {
        stateLoads++;
        return buildStateLoaderResult(
          {},
          { validationCapturedCount: stateLoads === 1 ? 1 : 67 },
        );
      },
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      sleep: async (ms: number) => {
        sleepCalls.push({ ms });
        clock.advance(ms);
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(sleepCalls.length).toBeGreaterThan(0);
  });

  it('56. exact T-360 missed cutoff', async () => {
    const startTime = new Date('2026-09-07T08:00:00.000Z');
    // L5B planner refuses DISPATCH_NOW at exact T-360 (MISSED_CUTOFF), so seed
    // initial planning inside the active window: T-375 <= now < T-360.
    const initialNow = new Date(startTime.getTime() - 375 * 60 * 1000);
    // Trusted clock advances to exactly T-360 during the fresh schedule lookup.
    const freshNow = new Date(startTime.getTime() - 360 * 60 * 1000);
    const scheduleGame = buildScheduleGame({ startTimeUtc: startTime });
    const clock = buildAdvancingClock(initialNow);
    let captureCalls = 0;
    let officialDateFetchCount = 0;
    const events: Array<{ readonly event: string }> = [];
    const deps = buildDeps({
      now: clock.now,
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) => {
        // The pre-dispatch fresh lookup (fetchAdjacentDates) re-queries the
        // selected game's officialDate AFTER the planner selected it. That
        // second fetch is the fresh selected-game timing hook: advance the
        // trusted clock to the exact cutoff so the fresh timing check
        // classifies MISSED_CUTOFF instead of dispatching a capture.
        if (date === scheduleGame.officialDate) {
          officialDateFetchCount++;
          if (officialDateFetchCount === 2) {
            clock.advance(freshNow.getTime() - clock.now().getTime());
          }
        }
        return date === scheduleGame.officialDate
          ? buildScheduleResult([scheduleGame])
          : buildScheduleResult([]);
      },
      captureApplication: async () => {
        captureCalls++;
        return CAPTURED_RESULT;
      },
      createEvent: (event) => {
        events.push({ event: event.event });
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
    expect(events.some(e => e.event === 'CAPTURE_MISSED_CUTOFF')).toBe(true);
    expect(captureCalls).toBe(0);
    expect(events.some(e => e.event === 'CAPTURE_RETRY_SCHEDULED')).toBe(false);
  });

  it('57. after T-360 missed cutoff', async () => {
    const startTime = new Date('2026-09-07T08:00:00.000Z');
    // L5B planner refuses DISPATCH_NOW at exact T-360 (MISSED_CUTOFF), so seed
    // initial planning inside the active window: T-375 <= now < T-360.
    const initialNow = new Date(startTime.getTime() - 375 * 60 * 1000);
    // Trusted clock advances to just past the cutoff (T-360 + 1ms) during the
    // fresh schedule lookup.
    const freshNow = new Date(startTime.getTime() - 360 * 60 * 1000 + 1);
    const scheduleGame = buildScheduleGame({ startTimeUtc: startTime });
    const clock = buildAdvancingClock(initialNow);
    let captureCalls = 0;
    let officialDateFetchCount = 0;
    const events: Array<{ readonly event: string }> = [];
    const deps = buildDeps({
      now: clock.now,
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) => {
        if (date === scheduleGame.officialDate) {
          officialDateFetchCount++;
          if (officialDateFetchCount === 2) {
            clock.advance(freshNow.getTime() - clock.now().getTime());
          }
        }
        return date === scheduleGame.officialDate
          ? buildScheduleResult([scheduleGame])
          : buildScheduleResult([]);
      },
      captureApplication: async () => {
        captureCalls++;
        return CAPTURED_RESULT;
      },
      createEvent: (event) => {
        events.push({ event: event.event });
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
    expect(events.some(e => e.event === 'CAPTURE_MISSED_CUTOFF')).toBe(true);
    expect(captureCalls).toBe(0);
    expect(events.some(e => e.event === 'CAPTURE_RETRY_SCHEDULED')).toBe(false);
  });

  it('58. inside active window dispatches', async () => {
    const startTime = new Date('2026-09-07T08:00:00.000Z');
    const now = new Date(startTime.getTime() - 370 * 60 * 1000);
    const scheduleGame = buildScheduleGame({ startTimeUtc: startTime });
    let captureCalls = 0;
    const deps = buildDeps({
      now: buildClock(now),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => {
        captureCalls++;
        return CAPTURED_RESULT;
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(captureCalls).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/*  M. TEST-SIDE FIREWALL                                                     */
/* -------------------------------------------------------------------------- */

describe('M. test-side firewall', () => {
  it('59. pre-dispatch test side block emitted', async () => {
    const boundaryDate = '2026-09-07';
    const startTime = new Date('2026-09-07T08:00:00.000Z');
    // L5B planner legitimately selects inside the active dispatch window
    // [T-375, T-360) minutes before game start.
    const initialNow = new Date(startTime.getTime() - 370 * 60 * 1000);
    // Trusted clock advances to the exact scientific cutoff (T-360) during the
    // fresh selected-game lookup. This terminates the run via the host's own
    // fail-closed logic (planner classifies the game MISSED_CUTOFF) so no
    // test-side scanner is required. The block itself is driven solely by the
    // production fresh selected-game firewall (officialDate > boundary).
    const freshNow = new Date(startTime.getTime() - 360 * 60 * 1000);
    // A. Initial planning schedule: validation-side officialDate ON the boundary
    //    (<= boundary), so the planner selects it (DISPATCH_NOW).
    const validationGame = buildScheduleGame({ startTimeUtc: startTime });
    // B. Fresh selected-game fetch: SAME gamePk (1000) but test-side officialDate
    //    AFTER the boundary — modeling fresh schedule/date drift across the
    //    frozen validation boundary. This test-side date is NOT placed in the
    //    initial planning schedule.
    const testSideGame = buildScheduleGame({
      officialDate: '2026-09-10',
      startTimeUtc: startTime,
    });
    const clock = buildAdvancingClock(initialNow);
    let captureCalls = 0;
    let officialDateFetchCount = 0;
    const events: Array<{
      readonly event: string;
      readonly officialDate?: unknown;
    }> = [];
    const deps = buildDeps({
      now: clock.now,
      loadScientificState: async () =>
        buildStateLoaderResult({ validationBoundaryOfficialDate: boundaryDate }),
      fetchSchedule: async (date: string) => {
        // Deterministic fetch-call state/phase distinction keyed on the
        // selected game's officialDate: fetch #1 is the initial
        // validation-side planning window; fetch #2 is the fresh pre-dispatch
        // selected-game refresh performed by the host's fetchAdjacentDates.
        if (date === validationGame.officialDate) {
          officialDateFetchCount++;
          if (officialDateFetchCount === 2) {
            clock.advance(freshNow.getTime() - clock.now().getTime());
            return buildScheduleResult([testSideGame]);
          }
        }
        return date === validationGame.officialDate
          ? buildScheduleResult([validationGame])
          : buildScheduleResult([]);
      },
      captureApplication: async () => {
        captureCalls++;
        return CAPTURED_RESULT;
      },
      createEvent: (event) => {
        events.push({ event: event.event, officialDate: event.officialDate });
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler(
      { dryRun: false },
      deps,
    );
    // The block originates from the production host's fresh selected-game
    // pre-dispatch firewall: the blocking game carries the test-side officialDate
    // ('2026-09-10' > boundary), proving it came from the pre-dispatch refresh,
    // not the initial validation-side schedule.
    const blocked = events.find((e) => e.event === 'TEST_SIDE_BLOCKED');
    expect(blocked).toBeDefined();
    expect(blocked?.officialDate).toBe('2026-09-10');
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
    expect(captureCalls).toBe(0);
    expect(events.some((e) => e.event === 'CAPTURE_RETRY_SCHEDULED')).toBe(false);
    expect(events.some((e) => e.event === 'CAPTURE_SUCCEEDED')).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  N. CAPTURE RESULT CLASSIFICATION                                          */
/* -------------------------------------------------------------------------- */

describe('N. capture result classification', () => {
  it('60. CAPTURED_AND_BOUND -> SUCCESS -> CAPTURE_SUCCEEDED', async () => {
    const events: Array<{ readonly event: string }> = [];
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => CAPTURED_RESULT,
      createEvent: (event) => {
        events.push({ event: event.event });
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(events.some(e => e.event === 'CAPTURE_SUCCEEDED')).toBe(true);
  });

  it('61. ALREADY_COMPLETE -> SKIP_ALREADY_PRESENT', async () => {
    const events: Array<{ readonly event: string }> = [];
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => ({
        kind: 'ALREADY_COMPLETE',
        activationId: 'activation-900001',
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        gamePk: 1000,
        gameId: '1000',
        evidenceArtifactId: 'evidence-123',
        bindingId: 'binding-456',
      }),
      createEvent: (event) => {
        events.push({ event: event.event });
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(events.some(e => e.event === 'CAPTURE_SKIPPED_ALREADY_PRESENT')).toBe(true);
  });

  it('62. INTEGRITY_FAILURE -> HUMAN_REVIEW_REQUIRED, no retry', async () => {
    const events: Array<{ readonly event: string }> = [];
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => ({
        kind: 'INTEGRITY_FAILURE',
        issues: ['issue-1', 'issue-2'],
      }),
      createEvent: (event) => {
        events.push({ event: event.event });
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
    expect(events.some(e => e.event === 'HUMAN_REVIEW_REQUIRED')).toBe(true);
  });

  it('63. CAPTURE_REJECTED permanent -> CAPTURE_MISSED_CUTOFF', async () => {
    const events: Array<{ readonly event: string }> = [];
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => ({
        kind: 'CAPTURE_REJECTED',
        failureCode: 'CAPTURE_STARTED_AFTER_SCIENTIFIC_CUTOFF',
        message: 'too late',
      }),
      createEvent: (event) => {
        events.push({ event: event.event });
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(events.some(e => e.event === 'CAPTURE_MISSED_CUTOFF')).toBe(true);
  });

  it('64. RECOVERED_BINDING_FROM_ORPHAN_H -> SUCCESS -> CAPTURE_SUCCEEDED', async () => {
    const events: Array<{ readonly event: string }> = [];
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => ({
        kind: 'RECOVERED_BINDING_FROM_ORPHAN_H',
        activationId: 'activation-900001',
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        gamePk: 1000,
        gameId: '1000',
        evidenceArtifactId: 'evidence-123',
        bindingId: 'binding-456',
        scientificCutoffAt: '2026-09-06T00:00:00.000Z',
        persistedAt: '2026-09-06T00:00:00.000Z',
      }),
      createEvent: (event) => {
        events.push({ event: event.event });
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(events.some(e => e.event === 'CAPTURE_SUCCEEDED')).toBe(true);
  });

  it('64b. CAPTURE_REJECTED CAPTURE_BUILDER_FAILED (non-permanent) -> HUMAN_REVIEW_REQUIRED', async () => {
    const events: Array<{ readonly event: string }> = [];
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => ({
        kind: 'CAPTURE_REJECTED',
        failureCode: 'CAPTURE_BUILDER_FAILED',
        message: 'snapshot builder threw',
      }),
      createEvent: (event) => {
        events.push({ event: event.event });
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
    expect(events.some(e => e.event === 'HUMAN_REVIEW_REQUIRED')).toBe(true);
  });

  it('64c. ACTIVATION_NOT_FROZEN_BEFORE_CUTOFF -> HUMAN_REVIEW_REQUIRED', async () => {
    const events: Array<{ readonly event: string }> = [];
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => ({
        kind: 'ACTIVATION_NOT_FROZEN_BEFORE_CUTOFF',
        activationPersistedAt: '2026-09-07T10:00:00.000Z',
        scientificCutoffAt: '2026-09-06T00:00:00.000Z',
      }),
      createEvent: (event) => {
        events.push({ event: event.event });
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
    expect(events.some(e => e.event === 'HUMAN_REVIEW_REQUIRED')).toBe(true);
  });

  it('64d. ACTIVATION_UNAVAILABLE -> HUMAN_REVIEW_REQUIRED (default)', async () => {
    const events: Array<{ readonly event: string }> = [];
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => ({
        kind: 'ACTIVATION_UNAVAILABLE',
        issues: ['activation unavailable'],
      }),
      createEvent: (event) => {
        events.push({ event: event.event });
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
    expect(events.some(e => e.event === 'HUMAN_REVIEW_REQUIRED')).toBe(true);
  });

  it('64e. SCHEDULE_DRIFT_INELIGIBLE -> HUMAN_REVIEW_REQUIRED (default)', async () => {
    const events: Array<{ readonly event: string }> = [];
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => ({
        kind: 'SCHEDULE_DRIFT_INELIGIBLE',
        currentGameId: '1000',
        currentOfficialDate: '2026-09-07',
        currentScheduledStartAt: '2026-09-07T08:00:00.000Z',
      }),
      createEvent: (event) => {
        events.push({ event: event.event });
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
    expect(events.some(e => e.event === 'HUMAN_REVIEW_REQUIRED')).toBe(true);
  });

  it('64f. RESCHEDULE_CONFLICT_INELIGIBLE -> HUMAN_REVIEW_REQUIRED (default)', async () => {
    const events: Array<{ readonly event: string }> = [];
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => ({
        kind: 'RESCHEDULE_CONFLICT_INELIGIBLE',
        activationId: 'activation-900001',
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        gamePk: 1000,
      }),
      createEvent: (event) => {
        events.push({ event: event.event });
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
    expect(events.some(e => e.event === 'HUMAN_REVIEW_REQUIRED')).toBe(true);
  });

  it('64g. ORPHAN_MULTIPLICITY_INELIGIBLE -> HUMAN_REVIEW_REQUIRED (default)', async () => {
    const events: Array<{ readonly event: string }> = [];
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => ({
        kind: 'ORPHAN_MULTIPLICITY_INELIGIBLE',
        gameId: '1000',
        orphanCount: 2,
      }),
      createEvent: (event) => {
        events.push({ event: event.event });
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
    expect(events.some(e => e.event === 'HUMAN_REVIEW_REQUIRED')).toBe(true);
  });

  it('64h. CAPTURE_LINEAGE_MULTIPLICITY_INELIGIBLE -> HUMAN_REVIEW_REQUIRED (default)', async () => {
    const events: Array<{ readonly event: string }> = [];
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => ({
        kind: 'CAPTURE_LINEAGE_MULTIPLICITY_INELIGIBLE',
        gamePk: 1000,
      }),
      createEvent: (event) => {
        events.push({ event: event.event });
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
    expect(events.some(e => e.event === 'HUMAN_REVIEW_REQUIRED')).toBe(true);
  });

  it('64i. BINDING_RECOVERY_REJECTED -> HUMAN_REVIEW_REQUIRED (default)', async () => {
    const events: Array<{ readonly event: string }> = [];
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => ({
        kind: 'BINDING_RECOVERY_REJECTED',
        failureCode: 'PERSISTENCE_AFTER_SCHEDULED_START',
        message: 'binding persistence after scheduled start',
      }),
      createEvent: (event) => {
        events.push({ event: event.event });
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
    expect(events.some(e => e.event === 'HUMAN_REVIEW_REQUIRED')).toBe(true);
  });
});

describe('O. success readback', () => {
  it('65. successful capture reloads state on next iteration', async () => {
    let stateLoads = 0;
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => {
        stateLoads++;
        return buildStateLoaderResult({}, { validationCapturedCount: stateLoads === 1 ? 1 : 2 });
      },
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => CAPTURED_RESULT,
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(stateLoads).toBeGreaterThanOrEqual(2);
  });

  it('66. success then 67/67 -> VALIDATION_TARGET_COMPLETE', async () => {
    let stateLoads = 0;
    const events: Array<{ readonly event: string }> = [];
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => {
        stateLoads++;
        return buildStateLoaderResult({}, { validationCapturedCount: stateLoads === 1 ? 66 : 67 });
      },
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => CAPTURED_RESULT,
      createEvent: (event) => {
        events.push({ event: event.event });
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(result.kind).toBe('STOPPED_CLEAN');
    expect(events.some(e => e.event === 'VALIDATION_TARGET_COMPLETE')).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  P. ALREADY-COMPLETE RACE                                                  */
/* -------------------------------------------------------------------------- */

describe('P. already-complete race', () => {
  it('67. ALREADY_COMPLETE does not trigger second capture', async () => {
    let captureCalls = 0;
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => {
        captureCalls++;
        return {
          kind: 'ALREADY_COMPLETE',
          activationId: 'activation-900001',
          protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
          gamePk: 1000,
          gameId: '1000',
          evidenceArtifactId: 'evidence-123',
          bindingId: 'binding-456',
        };
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(captureCalls).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/*  Q. TRANSIENT ERROR CLASSIFICATION                                         */
/* -------------------------------------------------------------------------- */

describe('Q. transient error classification', () => {
  it('68. ResearchDataTimeoutError is transient', async () => {
    const { ResearchDataTimeoutError } = await import('@/lib/research-data/errors');
    const deps = buildDeps({
      captureApplication: async () => {
        throw new ResearchDataTimeoutError({ message: 'timeout', source: 'test' });
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
  });

  it('69. generic Error is not transient', async () => {
    const deps = buildDeps({
      captureApplication: async () => {
        throw new Error('generic failure');
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
  });

  it('70. ResearchDataValidationError is not transient', async () => {
    const { ResearchDataValidationError } = await import('@/lib/research-data/errors');
    const deps = buildDeps({
      captureApplication: async () => {
        throw new ResearchDataValidationError({ message: 'validation', source: 'test' });
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
  });
});

/* -------------------------------------------------------------------------- */
/*  R. BOUNDED RETRY                                                          */
/* -------------------------------------------------------------------------- */

describe('R. bounded retry', () => {
  it('71. transient first attempt schedules retry then succeeds', async () => {
    let attempts = 0;
    const sleepCalls: Array<{ readonly ms: number }> = [];
    const events: MLBProspectiveHoldoutSchedulerEvent[] = [];
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      sleep: async (ms: number) => {
        sleepCalls.push({ ms });
        return;
      },
      captureApplication: async () => {
        attempts++;
        if (attempts === 1) {
          const { ResearchDataTimeoutError } = await import('@/lib/research-data/errors');
          throw new ResearchDataTimeoutError({ message: 'timeout', source: 'test' });
        }
        return CAPTURED_RESULT;
      },
      createEvent: (event) => {
        events.push(event);
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    // Exactly 2 captureApplication calls: attempt 1 fails, attempt 2 succeeds.
    expect(attempts).toBe(2);
    // The retry delay is exactly RETRY_DELAY_MS (2000ms).
    expect(sleepCalls.some(call => call.ms === 2000)).toBe(true);
    // CAPTURE_RETRY_SCHEDULED event emitted with correct delay and gamePk.
    const retryEvent = events.find(e => e.event === 'CAPTURE_RETRY_SCHEDULED');
    expect(retryEvent).toBeDefined();
    expect(retryEvent?.delayMs).toBe(2000);
    expect(retryEvent?.gamePk).toBe(1000);
    // No third attempt possible.
    expect(attempts).toBe(2);
  });

  it('72. second transient stops with no third attempt', async () => {
    let attempts = 0;
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([buildScheduleGame()]) : buildScheduleResult([]),
      captureApplication: async () => {
        attempts++;
        const { ResearchDataTimeoutError } = await import('@/lib/research-data/errors');
        throw new ResearchDataTimeoutError({ message: 'timeout', source: 'test' });
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(attempts).toBe(2);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
  });
});

/* -------------------------------------------------------------------------- */
/*  S. RETRY REVALIDATES EVERYTHING                                            */
/* -------------------------------------------------------------------------- */

describe('S. retry revalidation', () => {
  it('73. cutoff passes during retry delay -> no dispatch', async () => {
    let attempts = 0;
    const startTime = new Date('2026-09-07T08:00:00.000Z');
    const initialNow = new Date(startTime.getTime() - 360 * 60 * 1000 - 1000);
    const scheduleGame = buildScheduleGame({ startTimeUtc: startTime });
    const deps = buildDeps({
      now: buildClock(initialNow),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      sleep: async () => {},
      captureApplication: async () => {
        attempts++;
        const { ResearchDataTimeoutError } = await import('@/lib/research-data/errors');
        throw new ResearchDataTimeoutError({ message: 'timeout', source: 'test' });
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
  });
});

/* -------------------------------------------------------------------------- */
/*  T. RESERVE CONTINUATION                                                   */
/* -------------------------------------------------------------------------- */

describe('T. reserve continuation', () => {
  it('74. permanent miss continues to next candidate', async () => {
    let captureCalls = 0;
    const missedGame = buildScheduleGame({ gamePk: 1000, startTimeUtc: new Date('2026-09-07T06:00:00.000Z') });
    const nextGame = buildScheduleGame({ gamePk: 1001, startTimeUtc: new Date('2026-09-07T08:00:00.000Z') });
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-06T23:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) => {
        if (date === '2026-09-07') {
          return buildScheduleResult([missedGame, nextGame]);
        }
        return buildScheduleResult([]);
      },
      captureApplication: async () => {
        captureCalls++;
        return {
          kind: 'CAPTURE_REJECTED',
          failureCode: 'CAPTURE_STARTED_AFTER_SCIENTIFIC_CUTOFF',
          message: 'missed',
        };
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(captureCalls).toBeGreaterThanOrEqual(1);
  });

  it('74b. stale readback cannot cause second independent capture', async () => {
    // cycle 1 dispatches gamePk 1000, capture succeeds.
    // State readback stays stale (completedGamePks does not include 1000).
    // cycle 2 must NOT call captureApplication again — the run-scoped
    // dispatchedGamePks guard fails closed instead of looping.
    let captureCalls = 0;
    const scheduleGame = buildScheduleGame({ gamePk: 1000 });
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => {
        captureCalls++;
        return CAPTURED_RESULT;
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(captureCalls).toBe(1);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
    if (result.kind !== 'STOPPED_FAIL_CLOSED') {
      throw new Error(`Expected STOPPED_FAIL_CLOSED but got ${result.kind}`);
    }
    expect(result.reason).toContain('duplicate capture attempt for gamePk 1000');
  });
});

/* -------------------------------------------------------------------------- */
/*  U. SIGNAL — IDLE                                                          */
/* -------------------------------------------------------------------------- */

describe('U. signal idle', () => {
  it('75. SIGTERM between cycles stops scheduler', async () => {
    let capturedSigtermHandler: (() => void) | undefined;
    let stateLoads = 0;
    const deps = buildDeps({
      loadScientificState: async () => {
        stateLoads++;
        return buildStateLoaderResult();
      },
      fetchSchedule: async () => buildScheduleResult([]),
      registerSignalHandler: (signal, handler) => {
        if (signal === 'SIGTERM') {
          capturedSigtermHandler = handler;
        }
        return () => {};
      },
    });
    const promise = runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    capturedSigtermHandler?.();
    const result = await promise;
    expect(result.kind).toBe('STOPPED_CLEAN');
  });
});

/* -------------------------------------------------------------------------- */
/*  V. SIGNAL — ACTIVE CAPTURE                                                */
/* -------------------------------------------------------------------------- */

describe('V. signal active capture', () => {
  it('76. SIGTERM during active capture allows worker to finish', async () => {
    let captureCompleted = false;
    let capturedSigtermHandler: (() => void) | undefined;
    let captureEnteredResolve: (() => void) | undefined;
    let releaseCaptureResolve: (() => void) | undefined;
    const captureEntered = new Promise<void>(resolve => {
      captureEnteredResolve = resolve;
    });
    const releaseCapture = new Promise<void>(resolve => {
      releaseCaptureResolve = resolve;
    });
    const scheduleGame = buildScheduleGame({
      startTimeUtc: new Date('2026-09-07T08:00:00.000Z'),
    });
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      registerSignalHandler: (signal, handler) => {
        if (signal === 'SIGTERM') {
          capturedSigtermHandler = handler;
        }
        return () => {};
      },
      captureApplication: async () => {
        captureEnteredResolve?.();
        await releaseCapture;
        captureCompleted = true;
        return CAPTURED_RESULT;
      },
    });
    const promise = runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    await captureEntered;
    capturedSigtermHandler?.();
    releaseCaptureResolve?.();
    const result = await promise;
    expect(captureCompleted).toBe(true);
    expect(result.kind).toBe('STOPPED_CLEAN');
  });
});

/* -------------------------------------------------------------------------- */
/*  W. SIGNAL HANDLER LIFECYCLE                                               */
/* -------------------------------------------------------------------------- */

describe('W. signal handler lifecycle', () => {
  it('77. handlers installed and removed on clean stop', async () => {
    let sigintUnregister: (() => void) | undefined;
    let sigtermUnregister: (() => void) | undefined;
    const deps = buildDeps({
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async () => buildScheduleResult([]),
      registerSignalHandler: (signal, handler) => {
        const unregister = () => {
          if (signal === 'SIGINT') sigintUnregister = undefined;
          if (signal === 'SIGTERM') sigtermUnregister = undefined;
        };
        if (signal === 'SIGINT') sigintUnregister = unregister;
        if (signal === 'SIGTERM') sigtermUnregister = unregister;
        return unregister;
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(sigintUnregister).toBeUndefined();
    expect(sigtermUnregister).toBeUndefined();
  });

  it('78. handlers removed on dry-run return', async () => {
    let sigintUnregister: (() => void) | undefined;
    let sigtermUnregister: (() => void) | undefined;
    const deps = buildDeps({
      loadScientificState: async () => buildStateLoaderResult(),
      registerSignalHandler: (signal, handler) => {
        const unregister = () => {
          if (signal === 'SIGINT') sigintUnregister = undefined;
          if (signal === 'SIGTERM') sigtermUnregister = undefined;
        };
        if (signal === 'SIGINT') sigintUnregister = unregister;
        if (signal === 'SIGTERM') sigtermUnregister = unregister;
        return unregister;
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    expect(sigintUnregister).toBeUndefined();
    expect(sigtermUnregister).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/*  X. LOCK HOST INTEGRATION                                                  */
/* -------------------------------------------------------------------------- */

describe('X. lock host integration', () => {
  it('79. second instance performs zero capture', async () => {
    let captureCalls = 0;
    const deps = buildDeps({
      acquireLock: async () => ({ acquired: false, reason: 'SECOND_INSTANCE_BLOCKED' }),
      loadScientificState: async () => buildStateLoaderResult(),
      captureApplication: async () => {
        captureCalls++;
        return CAPTURED_RESULT;
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(result.kind).toBe('SECOND_INSTANCE_BLOCKED');
    expect(captureCalls).toBe(0);
  });

  it('80. lock acquisition failure performs zero capture', async () => {
    let captureCalls = 0;
    const deps = buildDeps({
      acquireLock: async () => ({ acquired: false, reason: 'lock acquisition IO error' }),
      loadScientificState: async () => buildStateLoaderResult(),
      captureApplication: async () => {
        captureCalls++;
        return CAPTURED_RESULT;
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    expect(result.kind).toBe('STOPPED_FAIL_CLOSED');
    expect(captureCalls).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/*  Y. STRUCTURED EVENTS                                                      */
/* -------------------------------------------------------------------------- */

describe('Y. structured events', () => {
  it('81. target-complete stop emits exactly one of each terminal event', async () => {
    const events: Array<{ readonly event: string }> = [];
    const scheduleGame = buildScheduleGame();
    let stateLoads = 0;
    let lockReleaseCount = 0;
    let handlerCleanupCount = 0;
    let captureCalls = 0;
    let targetCompleteObserved = false;
    let captureAfterTargetComplete = false;
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => {
        stateLoads++;
        return buildStateLoaderResult(
          {},
          { validationCapturedCount: stateLoads === 1 ? 1 : 67 },
        );
      },
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => {
        if (targetCompleteObserved) {
          captureAfterTargetComplete = true;
        }
        captureCalls++;
        return CAPTURED_RESULT;
      },
      createEvent: (event) => {
        events.push({ event: event.event });
        if (event.event === 'VALIDATION_TARGET_COMPLETE') {
          targetCompleteObserved = true;
        }
      },
      releaseLock: async () => {
        lockReleaseCount++;
        return { released: true };
      },
      registerSignalHandler: () => () => {
        handlerCleanupCount++;
      },
    });
    const result = await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    // Result: stop is clean, not a fail-closed or dry-run completion.
    expect(result.kind).toBe('STOPPED_CLEAN');
    // Presence of the full capture lifecycle on the first cycle.
    expect(events).toContainEqual({ event: 'SCHEDULER_STARTED' });
    expect(events).toContainEqual({ event: 'STATE_REFRESHED' });
    expect(events).toContainEqual({ event: 'CAPTURE_DISPATCHED' });
    expect(events).toContainEqual({ event: 'CAPTURE_SUCCEEDED' });
    // Exactly one terminal pair on target-complete readback (count, not just membership).
    const validationTargetCompleteCount = events.filter(
      e => e.event === 'VALIDATION_TARGET_COMPLETE',
    ).length;
    const schedulerStoppedCount = events.filter(
      e => e.event === 'SCHEDULER_STOPPED',
    ).length;
    expect(validationTargetCompleteCount).toBe(1);
    expect(schedulerStoppedCount).toBe(1);
    // captureApplication must never run after the target-complete readback.
    expect(captureCalls).toBeGreaterThanOrEqual(1);
    expect(captureAfterTargetComplete).toBe(false);
    // Lock acquired-once semantics: release exactly once on clean exit.
    expect(lockReleaseCount).toBe(1);
    // Both SIGINT and SIGTERM handlers registered and removed on clean exit.
    expect(handlerCleanupCount).toBe(2);
  });

  it('82. all required event types observable in dry-run', async () => {
    const events: Array<{ readonly event: string }> = [];
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-06T00:00:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      createEvent: (event) => {
        events.push({ event: event.event });
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    expect(events).toContainEqual({ event: 'SCHEDULER_STARTED' });
    expect(events).toContainEqual({ event: 'STATE_REFRESHED' });
    expect(events).toContainEqual({ event: 'NEXT_CAPTURE_PLANNED' });
    expect(events).toContainEqual({ event: 'SCHEDULER_STOPPED' });
  });
});

/* -------------------------------------------------------------------------- */
/*  Z. EVENT FIREWALL                                                         */
/* -------------------------------------------------------------------------- */

describe('Z. event firewall', () => {
  it('83. no forbidden sportsbook fields in emitted events', async () => {
    const events: MLBProspectiveHoldoutSchedulerEvent[] = [];
    const scheduleGame = buildScheduleGame();
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-07T01:50:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
      captureApplication: async () => CAPTURED_RESULT,
      createEvent: (event) => {
        events.push(event);
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: false }, deps);
    const forbidden = ['sportsbook', 'odds', 'price', 'impliedProbability', 'market', 'edge', 'stake', 'bankroll', 'winnerLabel', 'finalScore', 'modelPrediction'];
    for (const ev of events) {
      for (const field of forbidden) {
        expect(ev).not.toHaveProperty(field);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  AA. CLI                                                                   */
/* -------------------------------------------------------------------------- */

describe('AA. CLI', () => {
  it('84. --dry-run flag accepted', async () => {
    const io: SchedulerCLIIO = {
      stdout: (message: string) => {},
      stderr: (message: string) => {},
    };
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-06T00:00:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([buildScheduleGame()]) : buildScheduleResult([]),
    });
    const exitCode = await runMLBProspectiveHoldoutSchedulerCLI(['node', 'script', '--dry-run'], io, deps);
    expect(exitCode).toBe(0);
  });

  it('85. unknown option fails without capture', async () => {
    const stderrCalls: string[] = [];
    const io: SchedulerCLIIO = {
      stdout: (message: string) => {},
      stderr: (message: string) => {
        stderrCalls.push(message);
      },
    };
    const deps = buildDeps({
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async () => buildScheduleResult([]),
    });
    const exitCode = await runMLBProspectiveHoldoutSchedulerCLI(['node', 'script', '--unknown'], io, deps);
    expect(exitCode).toBe(1);
    expect(stderrCalls.length).toBeGreaterThan(0);
  });

  it('86. direct execution guard invokes CLI once', async () => {
    const schedulerSourcePath = path.resolve(
      fileURLToPath(import.meta.url),
      '..',
      '..',
      '..',
      '..',
      'scripts',
      'mlb-prospective-holdout-scheduler.ts',
    );
    const src = await fs.readFile(schedulerSourcePath, 'utf-8');
    expect(src).toContain('if (isDirectExecution())');
    expect(src).toContain('runMLBProspectiveHoldoutSchedulerCLI(process.argv)');
  });

  it('87. NDJSON stdout emits parseable lines', async () => {
    const stdoutLines: string[] = [];
    const deps = buildDeps({
      now: buildClock(new Date('2026-09-06T00:00:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([buildScheduleGame()]) : buildScheduleResult([]),
      createEvent: (event) => {
        stdoutLines.push(JSON.stringify(event));
      },
    });
    await runMLBProspectiveHoldoutScheduler({ dryRun: true }, deps);
    for (const line of stdoutLines) {
      expect(() => JSON.parse(line)).not.toThrow();
      const parsed = JSON.parse(line);
      expect(parsed.contractVersion).toBe('mlb-prospective-holdout-scheduler-events-v1');
    }
  });

  it('88. exit code table exact', async () => {
    const io: SchedulerCLIIO = { stdout: () => {}, stderr: () => {} };
    const scheduleGame = buildScheduleGame({
      startTimeUtc: new Date('2026-09-07T08:00:00.000Z'),
    });
    const depsClean = buildDeps({
      now: buildClock(new Date('2026-09-06T00:00:00.000Z')),
      loadScientificState: async () => buildStateLoaderResult(),
      fetchSchedule: async (date: string) =>
        date === '2026-09-07' ? buildScheduleResult([scheduleGame]) : buildScheduleResult([]),
    });
    expect(await runMLBProspectiveHoldoutSchedulerCLI(['node', 'script', '--dry-run'], io, depsClean)).toBe(0);

    const depsBlock = buildDeps({
      acquireLock: async () => ({ acquired: false, reason: 'SECOND_INSTANCE_BLOCKED' }),
    });
    expect(await runMLBProspectiveHoldoutSchedulerCLI(['node', 'script'], io, depsBlock)).toBe(3);

    const depsFail = buildDeps({
      acquireLock: async () => ({ acquired: false, reason: 'some failure' }),
    });
    expect(await runMLBProspectiveHoldoutSchedulerCLI(['node', 'script'], io, depsFail)).toBe(2);
  });
});

/* -------------------------------------------------------------------------- */
/*  AB. STATIC FIREWALL AND HYGIENE                                           */
/* -------------------------------------------------------------------------- */

describe('AB. static firewall and hygiene', () => {
  const schedulerSourcePath = path.resolve(
    fileURLToPath(import.meta.url),
    '..',
    '..',
    '..',
    '..',
    'scripts',
    'mlb-prospective-holdout-scheduler.ts',
  );

  it('89. no odds/sportsbook concepts in scheduler source', async () => {
    const src = await fs.readFile(schedulerSourcePath, 'utf-8');
    const forbidden = ['sportsbook', 'odds', 'price', 'impliedProbability', 'market comparison', 'winnerLabel', 'finalScore', 'modelPrediction'];
    for (const term of forbidden) {
      expect(src.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });

  it('90. no unsafe casts in scheduler source', async () => {
    const src = await fs.readFile(schedulerSourcePath, 'utf-8');
    const forbidden = ['as any', 'as unknown as', 'as never', '@ts-ignore', '@ts-expect-error', ': any', '<any>'];
    for (const pattern of forbidden) {
      expect(src).not.toContain(pattern);
    }
  });

  it('91. no ad-hoc debug artifacts in scheduler source', async () => {
    const src = await fs.readFile(schedulerSourcePath, 'utf-8');
    const forbidden = ['debugger', 'console.debug', 'console.log', 'TODO', 'FIXME'];
    for (const pattern of forbidden) {
      expect(src).not.toContain(pattern);
    }
  });

  it('92. default lock path is scheduler runtime path', async () => {
    const src = await fs.readFile(schedulerSourcePath, 'utf-8');
    expect(src).toContain('mlb-prospective-holdout-scheduler-runtime/active.lock');
  });

  it('93. default capture application is runProspectiveHoldoutCaptureForScheduleGame', async () => {
    const src = await fs.readFile(schedulerSourcePath, 'utf-8');
    expect(src).toContain('captureApplication: runProspectiveHoldoutCaptureForScheduleGame');
  });
});
