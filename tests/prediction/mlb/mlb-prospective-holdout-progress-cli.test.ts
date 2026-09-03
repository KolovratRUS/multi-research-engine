import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { runMLBProspectiveHoldoutProgressCLI } from '../../../scripts/mlb-prospective-holdout-progress';

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
  type MLBProspectiveHoldoutActivationReceipt,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-contract';

import {
  type MLBProspectiveHoldoutActivationStoreReadResult,
  type MLBProspectiveHoldoutActivationStoreReadIssue,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-store';

import {
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
} from '@/prediction/mlb/mlb-inner-development-third-real-candidate-recipe';

import {
  MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
  MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
  type MLBProspectiveT360T360Validation,
} from '@/prediction/mlb/mlb-prospective-t360-capture-contract';

import {
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
} from '@/prediction/mlb/mlb-prospective-pregame-evidence-artifact-contract';

import {
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
} from '@/prediction/mlb/mlb-prospective-holdout-game-identity-binding-contract';

import {
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
  type MLBCanonicalPregameSnapshot,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';

import {
  MLB_FEATURE_VECTOR_CONTRACT_VERSION,
  type MLBFeatureVector,
} from '@/prediction/mlb/mlb-feature-vector-contract';

import {
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION as EVIDENCE_CONTRACT_VERSION,
  type MLBProspectivePregameEvidencePrepared,
  type MLBProspectivePregameEvidence,
} from '@/prediction/mlb/mlb-prospective-pregame-evidence-artifact-contract';

import {
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION as BINDING_CONTRACT_VERSION,
  type MLBProspectiveHoldoutGameIdentityBinding,
} from '@/prediction/mlb/mlb-prospective-holdout-game-identity-binding-contract';

import {
  type MLBProspectiveHoldoutArtifactDiscoverySuccess,
  type MLBProspectiveHoldoutArtifactDiscoveryFailure,
  type MLBProspectiveHoldoutArtifactDiscoveryResult,
  type MLBProspectiveHoldoutArtifactDiscoveryCandidate,
  type MLBProspectiveHoldoutArtifactEvidenceRecord,
} from '@/prediction/mlb/mlb-prospective-holdout-artifact-discovery';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

const DEFAULT_ACTIVATION_RECEIPT: MLBProspectiveHoldoutActivationReceipt = {
  storeVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_VERSION,
  contractVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
  activationId: 'activation-900001',
  relativePath:
    'var/mlb-development/mlb-prospective-holdout-activations/mlb-prospective-holdout-activation-v1.json',
  sha256: 'a'.repeat(64),
  byteLength: 100,
  persistedAt: '2026-07-15T04:00:00Z',
};

const BASE_SNAPSHOT: MLBCanonicalPregameSnapshot = {
  contractVersion: MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
  sport: 'MLB',
  target: 'OFFICIAL_FINAL_GAME_WINNER',
  snapshotId: 'snapshot-1',
  capturedAt: '2026-07-15T00:00:00Z',
  dataCutoffAt: '2026-07-15T00:00:00Z',
  game: {
    gameId: 'game-1',
    scheduledStartAt: '2026-07-15T12:00:00Z',
    officialDate: '2026-07-15',
    season: 2026,
    gameType: 'REGULAR_SEASON',
    status: 'SCHEDULED',
    homeTeamId: 'home-team',
    awayTeamId: 'away-team',
    venueId: null,
    neutralSite: null,
    doubleheader: null,
  },
  startingPitchers: {
    home: { state: 'CONFIRMED', pitcherId: null, announcedAt: null, sourceRefIds: [] },
    away: { state: 'CONFIRMED', pitcherId: null, announcedAt: null, sourceRefIds: [] },
  },
  sourceReferences: [],
  sections: [],
  dataCompleteness: 'COMPLETE',
  warnings: [],
};

function buildBaseFeatureVector(
  snapshotId: string,
  gameId: string,
  officialDate: string,
): MLBFeatureVector {
  return {
    contractVersion: MLB_FEATURE_VECTOR_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    manifestId: 'manifest-1',
    snapshotId,
    gameId,
    officialDate,
    dataCutoffAt: '2026-07-15T00:00:00Z',
    values: [],
  };
}

const BASE_T360_VALIDATION: MLBProspectiveT360T360Validation = {
  status: 'ACCEPTED',
  actualDataCutoffAtLteScientificCutoff: true,
  sourceTimestampsProvenLteScientificCutoff: true,
};

type PreparedEvidenceFixtureOverrides = Readonly<{
  gameId?: string;
  snapshotId?: string;
  officialDate?: string;
  scheduledStartAt?: string;
  scientificCutoffAt?: string;
  actualDataCutoffAt?: string;
}>;

function buildPreparedEvidence(
  overrides: PreparedEvidenceFixtureOverrides = {},
): MLBProspectivePregameEvidencePrepared {
  const snapshot = BASE_SNAPSHOT;
  const base: MLBProspectivePregameEvidencePrepared = {
    contractVersion: EVIDENCE_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: 'activation-900001',
    captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
    compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
    gameId: snapshot.game.gameId,
    snapshotId: snapshot.snapshotId,
    officialDate: snapshot.game.officialDate,
    scheduledStartAt: snapshot.game.scheduledStartAt,
    scientificCutoffAt: '2026-07-15T00:00:00Z',
    actualDataCutoffAt: snapshot.dataCutoffAt,
    rawSnapshot: snapshot,
    rawFeatureVector: buildBaseFeatureVector(snapshot.snapshotId, snapshot.game.gameId, snapshot.game.officialDate),
    candidate003CompatibleFeatureVector: buildBaseFeatureVector(snapshot.snapshotId, snapshot.game.gameId, snapshot.game.officialDate),
    t360Validation: BASE_T360_VALIDATION,
  };
  return {
    ...base,
    gameId: overrides.gameId ?? base.gameId,
    snapshotId: overrides.snapshotId ?? base.snapshotId,
    officialDate: overrides.officialDate ?? base.officialDate,
    scheduledStartAt: overrides.scheduledStartAt ?? base.scheduledStartAt,
    scientificCutoffAt: overrides.scientificCutoffAt ?? base.scientificCutoffAt,
    actualDataCutoffAt: overrides.actualDataCutoffAt ?? base.actualDataCutoffAt,
  };
}

type BindingFixtureOverrides = Readonly<{
  gamePk?: number;
  gameId?: string;
  officialDate?: string;
  scheduledStartAt?: string;
  activationId?: string;
}>;

function buildBinding(
  overrides: BindingFixtureOverrides = {},
): MLBProspectiveHoldoutGameIdentityBinding {
  const base: MLBProspectiveHoldoutGameIdentityBinding = {
    contractVersion: BINDING_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: 'activation-900001',
    authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
    gamePk: 1,
    gameId: 'game-1',
    evidenceArtifactId: 'evidence-1',
    evidenceSha256: 'sha256',
    evidenceArtifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
    evidenceStoreVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
    snapshotId: 'snapshot-1',
    officialDate: '2026-07-15',
    scheduledStartAt: '2026-07-15T12:00:00Z',
    scientificCutoffAt: '2026-07-15T00:00:00Z',
    evidencePersistedAt: '2026-07-15T00:00:00Z',
    persistedAt: '2026-07-15T00:00:00Z',
  };
  return {
    ...base,
    gamePk: overrides.gamePk ?? base.gamePk,
    gameId: overrides.gameId ?? base.gameId,
    officialDate: overrides.officialDate ?? base.officialDate,
    scheduledStartAt: overrides.scheduledStartAt ?? base.scheduledStartAt,
    activationId: overrides.activationId ?? base.activationId,
  };
}

type CandidateFixtureOverrides = Readonly<{
  evidence?: EvidenceFixtureOverrides;
  binding?: BindingFixtureOverrides;
}>;

type EvidenceFixtureOverrides = Readonly<{
  gameId?: string;
  officialDate?: string;
  scheduledStartAt?: string;
  activationId?: string;
}>;

function buildEvidence(
  overrides: EvidenceFixtureOverrides = {},
): MLBProspectivePregameEvidence {
  const prepared = buildPreparedEvidence();
  return {
    ...prepared,
    persistedAt: '2026-07-15T00:00:00Z',
    gameId: overrides.gameId ?? prepared.gameId,
    officialDate: overrides.officialDate ?? prepared.officialDate,
    scheduledStartAt: overrides.scheduledStartAt ?? prepared.scheduledStartAt,
    activationId: overrides.activationId ?? prepared.activationId,
  };
}

function buildCandidate(
  overrides: CandidateFixtureOverrides = {},
): MLBProspectiveHoldoutArtifactDiscoveryCandidate {
  const baseEvidence = buildEvidence(overrides.evidence);
  const persistedEvidence: MLBProspectivePregameEvidence = {
    ...baseEvidence,
    persistedAt: '2026-07-15T00:00:00Z',
  };
  const baseBinding = buildBinding(overrides.binding);
  return {
    evidence: persistedEvidence,
    binding: baseBinding,
  };
}

function buildValidationCandidates(
  count: number,
  gamePkStart = 100000,
): MLBProspectiveHoldoutArtifactDiscoveryCandidate[] {
  return Array.from({ length: count }, (_, index) => {
    const gamePk = gamePkStart + index;
    const gameId = `game-${gamePk}`;
    return buildCandidate({
      evidence: {
        gameId,
        officialDate: '2026-07-15',
        scheduledStartAt: '2026-07-15T12:00:00Z',
      },
      binding: {
        gamePk,
        gameId,
        officialDate: '2026-07-15',
        scheduledStartAt: '2026-07-15T12:00:00Z',
      },
    });
  });
}

function buildTestCandidates(
  count: number,
  gamePkStart = 200000,
): MLBProspectiveHoldoutArtifactDiscoveryCandidate[] {
  return Array.from({ length: count }, (_, index) => {
    const gamePk = gamePkStart + index;
    const gameId = `game-${gamePk}`;
    return buildCandidate({
      evidence: {
        gameId,
        officialDate: '2026-07-16',
        scheduledStartAt: '2026-07-16T12:00:00Z',
      },
      binding: {
        gamePk,
        gameId,
        officialDate: '2026-07-16',
        scheduledStartAt: '2026-07-16T12:00:00Z',
      },
    });
  });
}

type ActivationFixtureOverrides = Readonly<{
  validationBoundaryOfficialDate?: string;
  persistedAt?: string;
}>;

function buildFrozenActivation(
  overrides: ActivationFixtureOverrides = {},
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
    validationBoundaryOfficialDate: '2026-07-15',
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
    persistedAt: '2026-07-15T04:00:00Z',
  };
  return {
    ...base,
    validationBoundaryOfficialDate: overrides.validationBoundaryOfficialDate ?? base.validationBoundaryOfficialDate,
    persistedAt: overrides.persistedAt ?? base.persistedAt,
  };
}

function buildEvidenceRecord(
  evidence: MLBProspectivePregameEvidence,
): MLBProspectiveHoldoutArtifactEvidenceRecord {
  return {
    evidence,
    receipt: {
      storeVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
      artifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
      artifactId: 'evidence-1',
      protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
      activationId: 'activation-900001',
      gameId: evidence.gameId,
      snapshotId: evidence.snapshotId,
      relativePath: 'var/mlb-development/mlb-prospective-pregame-evidence/evidence-1.json',
      sha256: 'a'.repeat(64),
      byteLength: 100,
      persistedAt: evidence.persistedAt,
    },
  };
}

function buildDiscoverySuccess(
  overrides: Partial<MLBProspectiveHoldoutArtifactDiscoverySuccess> = {},
): MLBProspectiveHoldoutArtifactDiscoverySuccess {
  return {
    ok: true,
    candidates: overrides.candidates ?? [],
    orphanEvidence: overrides.orphanEvidence ?? [],
    rescheduleConflicts: overrides.rescheduleConflicts ?? [],
    temporaryDebris: overrides.temporaryDebris ?? [],
    unknownFiles: overrides.unknownFiles ?? [],
    foreignArtifactSummary:
      overrides.foreignArtifactSummary ??
      { foreignEvidenceCount: 0, foreignBindingCount: 0 },
  };
}

function buildDiscoveryFailure(
  overrides: Partial<MLBProspectiveHoldoutArtifactDiscoveryFailure> = {},
): MLBProspectiveHoldoutArtifactDiscoveryFailure {
  return {
    ok: false,
    issues: overrides.issues ?? [],
  };
}

function createMockDeps(overrides: {
  readActivation?: (
    repositoryRoot: string,
  ) => Promise<MLBProspectiveHoldoutActivationStoreReadResult>;
  discoverArtifacts?: (
    repositoryRoot: string,
    activation: unknown,
  ) => Promise<MLBProspectiveHoldoutArtifactDiscoveryResult>;
  repositoryRoot?: string;
} = {}) {
  const readActivation =
    overrides.readActivation ??
    (async (): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => ({
      ok: true,
      value: buildFrozenActivation(),
      receipt: DEFAULT_ACTIVATION_RECEIPT,
    }));

  const discoverArtifacts =
    overrides.discoverArtifacts ??
    (async (): Promise<MLBProspectiveHoldoutArtifactDiscoveryResult> => ({
      ok: true,
      candidates: [],
      orphanEvidence: [],
      rescheduleConflicts: [],
      temporaryDebris: [],
      unknownFiles: [],
      foreignArtifactSummary: { foreignEvidenceCount: 0, foreignBindingCount: 0 },
    }));

  return {
    readActivation,
    discoverArtifacts,
    repositoryRoot: overrides.repositoryRoot,
  };
}

async function createTempDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-'));
}


/* -------------------------------------------------------------------------- */
/*  CLI test harness                                                          */
/* -------------------------------------------------------------------------- */

interface CLITestResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function invokeCLI(
  argv: readonly string[],
  deps: Parameters<typeof runMLBProspectiveHoldoutProgressCLI>[2],
): Promise<CLITestResult> {
  let stdout = '';
  let stderr = '';

  const exitCode = await runMLBProspectiveHoldoutProgressCLI(
    ['node', 'script', ...argv],
    {
      stdout: (text: string) => { stdout += text; },
      stderr: (text: string) => { stderr += text; },
    },
    deps,
  );

  return { exitCode, stdout, stderr };
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-progress-cli', () => {
  // 1. success requires one activation read
  it('1. success requires exactly one activation read', async () => {
    const tempRoot = await createTempDir();
    const readActivation = vi.fn(async (root: string): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => {
      if (root === tempRoot) {
        return { ok: true, value: buildFrozenActivation(), receipt: DEFAULT_ACTIVATION_RECEIPT };
      }
      return { ok: false, issues: [{ code: 'ACTIVATION_MISSING', path: root, message: 'missing' }] };
    });
    const deps = createMockDeps({ readActivation, repositoryRoot: tempRoot });
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"activationId":"activation-900001"');
    expect(readActivation).toHaveBeenCalledTimes(1);
  });

  // 2. activation unavailable → ACTIVATION_UNAVAILABLE
  it('2. activation unavailable maps to ACTIVATION_UNAVAILABLE', async () => {
    const readActivation = vi.fn(async (): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => ({
      ok: false,
      issues: [{ code: 'ACTIVATION_MISSING', path: '/missing', message: 'missing' }],
    }));
    const deps = createMockDeps({ readActivation });
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('ACTIVATION_UNAVAILABLE');
    expect(result.stdout).toBe('');
  });

  // 3. activation read failure → ACTIVATION_READ_FAILURE
  it('3. activation read failure maps to ACTIVATION_READ_FAILURE', async () => {
    const readActivation = vi.fn(async (): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => ({
      ok: false,
      issues: [{ code: 'ACTIVATION_IO_ERROR', path: '/missing', message: 'io error' }],
    }));
    const deps = createMockDeps({ readActivation });
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('ACTIVATION_READ_FAILURE');
    expect(result.stdout).toBe('');
  });

  // 4. activation state invalid → ACTIVATION_STATE_INVALID
  it('4. activation invalid state maps to ACTIVATION_STATE_INVALID', async () => {
    const readActivation = vi.fn(async (): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => ({
      ok: false,
      issues: [{ code: 'ACTIVATION_CONTRACT_INVALID', path: '/missing', message: 'invalid' }],
    }));
    const deps = createMockDeps({ readActivation });
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('ACTIVATION_STATE_INVALID');
    expect(result.stdout).toBe('');
  });

  // 5. activation JSON invalid → ACTIVATION_STATE_INVALID
  it('5. activation JSON invalid maps to ACTIVATION_STATE_INVALID', async () => {
    const readActivation = vi.fn(async (): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => ({
      ok: false,
      issues: [{ code: 'ACTIVATION_JSON_INVALID', path: '/missing', message: 'invalid json' }],
    }));
    const deps = createMockDeps({ readActivation });
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('ACTIVATION_STATE_INVALID');
    expect(result.stdout).toBe('');
  });

  // 6. discovery failure → DISCOVERY_FAILURE
  it('6. discovery failure maps to DISCOVERY_FAILURE and preserves issues', async () => {
    const readActivation = vi.fn(async (): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => ({
      ok: true,
      value: buildFrozenActivation(),
      receipt: DEFAULT_ACTIVATION_RECEIPT,
    }));
    const discoverIssues = [
      { code: 'DISCOVERY_ISSUE_1', path: 'x', message: 'first' },
      { code: 'DISCOVERY_ISSUE_2', path: 'y', message: 'second' },
    ];
    const discoverArtifacts = vi.fn(async (): Promise<MLBProspectiveHoldoutArtifactDiscoveryResult> => ({
      ok: false,
      issues: discoverIssues,
    }));
    const deps = createMockDeps({ readActivation, discoverArtifacts });
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('DISCOVERY_FAILURE');
    for (const issue of discoverIssues) {
      expect(result.stderr).toContain(issue.code);
    }
  });

  // 7. no second activation read on discovery failure
  it('7. no second activation read on discovery failure', async () => {
    const readActivation = vi.fn(async (): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => ({
      ok: true,
      value: buildFrozenActivation(),
      receipt: DEFAULT_ACTIVATION_RECEIPT,
    }));
    const discoverArtifacts = vi.fn(async (): Promise<MLBProspectiveHoldoutArtifactDiscoveryResult> => ({
      ok: false,
      issues: [{ code: 'DISCOVERY_ISSUE', path: 'x', message: 'first' }],
    }));
    const deps = createMockDeps({ readActivation, discoverArtifacts });
    await invokeCLI([], deps);
    expect(readActivation).toHaveBeenCalledTimes(1);
  });

  // 8. extra argument → INVALID_ARGUMENTS
  it('8. extra argument maps to INVALID_ARGUMENTS before activation read', async () => {
    const readActivation = vi.fn(async (): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => ({
      ok: false,
      issues: [{ code: 'ACTIVATION_MISSING', path: '/missing', message: 'missing' }],
    }));
    const deps = createMockDeps({ readActivation });
    const result = await invokeCLI(['--extra'], deps);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('INVALID_ARGUMENTS');
    expect(result.stdout).toBe('');
    expect(readActivation).toHaveBeenCalledTimes(0);
  });

  // 9. unknown flag → INVALID_ARGUMENTS
  it('9. unknown flag maps to INVALID_ARGUMENTS before activation read', async () => {
    const readActivation = vi.fn(async (): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => ({
      ok: false,
      issues: [{ code: 'ACTIVATION_MISSING', path: '/missing', message: 'missing' }],
    }));
    const deps = createMockDeps({ readActivation });
    const result = await invokeCLI(['--unknown-flag'], deps);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('INVALID_ARGUMENTS');
    expect(result.stdout).toBe('');
    expect(readActivation).toHaveBeenCalledTimes(0);
  });

  // 10. output is structured JSON on success
  it('10. success stdout is structured JSON', async () => {
    const deps = createMockDeps();
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty('activationId');
    expect(parsed).toHaveProperty('allCaptureComplete');
    expect(parsed).toHaveProperty('anomalies');
  });

  // 11. stderr empty on success
  it('11. stderr is empty on success', async () => {
    const deps = createMockDeps();
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
  });

  // 12. failure writes to stderr as structured JSON
  it('12. failure stderr is structured JSON', async () => {
    const readActivation = vi.fn(async (): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => ({
      ok: false,
      issues: [{ code: 'ACTIVATION_MISSING', path: '/missing', message: 'missing' }],
    }));
    const deps = createMockDeps({ readActivation });
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    const parsed = JSON.parse(result.stderr);
    expect(parsed).toHaveProperty('kind');
  });

  // 13. discovery failure preserves issue details via safe narrowing
  it('13. discovery failure preserves issue details via safe narrowing', async () => {
    const readActivation = vi.fn(async (): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => ({
      ok: true,
      value: buildFrozenActivation(),
      receipt: DEFAULT_ACTIVATION_RECEIPT,
    }));
    const discoverIssues = [
      { code: 'ISSUE_A', path: 'path-a', message: 'message-a' },
      { code: 'ISSUE_B', path: 'path-b', message: 'message-b' },
    ];
    const discoverArtifacts = vi.fn(async (): Promise<MLBProspectiveHoldoutArtifactDiscoveryResult> => ({
      ok: false,
      issues: discoverIssues,
    }));
    const deps = createMockDeps({ readActivation, discoverArtifacts });
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(1);
    for (const issue of discoverIssues) {
      expect(result.stderr).toContain(issue.code);
      expect(result.stderr).toContain(issue.path);
      expect(result.stderr).toContain(issue.message);
    }
  });

  // 14. no discovery failure cast
  it('14. no discovery failure unsafe cast', async () => {
    const readActivation = vi.fn(async (): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => ({
      ok: true,
      value: buildFrozenActivation(),
      receipt: DEFAULT_ACTIVATION_RECEIPT,
    }));
    const discoverArtifacts = vi.fn(async (): Promise<MLBProspectiveHoldoutArtifactDiscoveryResult> => ({
      ok: false,
      issues: [{ code: 'ISSUE', path: 'p', message: 'm' }],
    }));
    const deps = createMockDeps({ readActivation, discoverArtifacts });
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('DISCOVERY_FAILURE');
  });

  // 15. production default root equals repository top-level
  it('15. production default root equals repository top-level', async () => {
    const readActivation = vi.fn(async (root: string): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => {
      if (root === REPO_ROOT) {
        return { ok: true, value: buildFrozenActivation(), receipt: DEFAULT_ACTIVATION_RECEIPT };
      }
      return { ok: false, issues: [{ code: 'ACTIVATION_MISSING', path: root, message: 'missing' }] };
    });
    const deps = createMockDeps({ readActivation });
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(0);
    expect(readActivation).toHaveBeenCalledWith(REPO_ROOT);
  });

  // 16. production root independent of process.cwd()
  it('16. production root independent of process.cwd()', async () => {
    const originalCwd = process.cwd();
    try {
      process.chdir('/tmp');
      const readActivation = vi.fn(async (root: string): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => {
        if (root === REPO_ROOT) {
          return { ok: true, value: buildFrozenActivation(), receipt: DEFAULT_ACTIVATION_RECEIPT };
        }
        return { ok: false, issues: [{ code: 'ACTIVATION_MISSING', path: root, message: 'missing' }] };
      });
      const deps = createMockDeps({ readActivation });
      const result = await invokeCLI([], deps);
      expect(result.exitCode).toBe(0);
      expect(readActivation).toHaveBeenCalledWith(REPO_ROOT);
    } finally {
      process.chdir(originalCwd);
    }
  });

  // 17. import inert — no direct activation-state leakage in output
  it('17. import inert — no direct activation state leakage in success output', async () => {
    const activation = buildFrozenActivation({ persistedAt: '2026-07-15T04:00:00Z' });
    const candidate = buildCandidate();
    const discovery = buildDiscoverySuccess({ candidates: [candidate] });
    const readActivation = vi.fn(async (): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => ({
      ok: true,
      value: activation,
      receipt: DEFAULT_ACTIVATION_RECEIPT,
    }));
    const discoverArtifacts = vi.fn(async (): Promise<MLBProspectiveHoldoutArtifactDiscoveryResult> => discovery);
    const deps = createMockDeps({ readActivation, discoverArtifacts });
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('mlb-prospective-holdout-progress-report-v1');
    const parsed = JSON.parse(result.stdout);
    expect(parsed.activationId).toBe('activation-900001');
    expect(parsed).not.toHaveProperty('persistedAt');
  });

  // 18. discovery exactly once on success
  it('18. discovery runs exactly once on success', async () => {
    const discoverArtifacts = vi.fn(async (): Promise<MLBProspectiveHoldoutArtifactDiscoveryResult> => ({
      ok: true,
      candidates: [],
      orphanEvidence: [],
      rescheduleConflicts: [],
      temporaryDebris: [],
      unknownFiles: [],
      foreignArtifactSummary: { foreignEvidenceCount: 0, foreignBindingCount: 0 },
    }));
    const deps = createMockDeps({ discoverArtifacts });
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(0);
    expect(discoverArtifacts).toHaveBeenCalledTimes(1);
  });

  // 19. stderr empty on success
  it('19. stderr is empty on success', async () => {
    const deps = createMockDeps();
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
  });

  // 20. error output contains kind and message
  it('20. error output contains kind and message', async () => {
    const readActivation = vi.fn(async (): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => ({
      ok: false,
      issues: [{ code: 'ACTIVATION_MISSING', path: '/missing', message: 'missing' }],
    }));
    const deps = createMockDeps({ readActivation });
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('ACTIVATION_UNAVAILABLE');
    expect(result.stderr).toContain('missing');
  });

  // 21. report error discrimination via 'kind' in
  it('21. report error discrimination uses kind in guard', async () => {
    const readActivation = vi.fn(async (): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => ({
      ok: false,
      issues: [{ code: 'ACTIVATION_MISSING', path: '/missing', message: 'missing' }],
    }));
    const deps = createMockDeps({ readActivation });
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.stderr);
    expect(parsed).toHaveProperty('kind');
    expect(typeof parsed.kind).toBe('string');
  });

  // 22. discovery failure does not call report builder
  it('22. discovery failure does not call report builder', async () => {
    const readActivation = vi.fn(async (): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => ({
      ok: true,
      value: buildFrozenActivation(),
      receipt: DEFAULT_ACTIVATION_RECEIPT,
    }));
    const discoverArtifacts = vi.fn(async (): Promise<MLBProspectiveHoldoutArtifactDiscoveryResult> => ({
      ok: false,
      issues: [{ code: 'ISSUE', path: 'p', message: 'm' }],
    }));
    const deps = createMockDeps({ readActivation, discoverArtifacts });
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
  });

  // 23. exit code is 1 on discovery failure
  it('23. discovery failure exits with code 1', async () => {
    const readActivation = vi.fn(async (): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => ({
      ok: true,
      value: buildFrozenActivation(),
      receipt: DEFAULT_ACTIVATION_RECEIPT,
    }));
    const discoverArtifacts = vi.fn(async (): Promise<MLBProspectiveHoldoutArtifactDiscoveryResult> => ({
      ok: false,
      issues: [{ code: 'ISSUE', path: 'p', message: 'm' }],
    }));
    const deps = createMockDeps({ readActivation, discoverArtifacts });
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(1);
  });

  // 24. success exit code is 0
  it('24. success exits with code 0', async () => {
    const deps = createMockDeps();
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(0);
  });

  // 25. builder called with activation and discovery on success
  it('25. builder called with activation and discovery on success', async () => {
    const activation = buildFrozenActivation();
    const readActivation = vi.fn(async (): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => ({
      ok: true,
      value: activation,
      receipt: DEFAULT_ACTIVATION_RECEIPT,
    }));
    const candidate = buildCandidate();
    const discovery = buildDiscoverySuccess({ candidates: [candidate] });
    const discoverArtifacts = vi.fn(async (): Promise<MLBProspectiveHoldoutArtifactDiscoveryResult> => discovery);
    const deps = createMockDeps({ readActivation, discoverArtifacts });
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"activationId":"activation-900001"');
  });

  // 26. no capture orchestrator import
  it('26. source does not import capture orchestrator', async () => {
    const source = await fs.readFile(path.resolve('scripts/mlb-prospective-holdout-progress.ts'), 'utf-8');
    expect(source).not.toMatch(/mlb-prospective-holdout-capture-orchestrator/);
    expect(source).not.toMatch(/runMLBProspectiveHoldoutCapture/);
  });

  // 27. no filesystem scientific write
  it('27. source does not perform filesystem scientific writes', async () => {
    const source = await fs.readFile(path.resolve('scripts/mlb-prospective-holdout-progress.ts'), 'utf-8');
    expect(source).not.toMatch(/fs\.writeFile/);
    expect(source).not.toMatch(/writeActivation/);
  });

  // 28. source does not write evidence or binding artifacts
  it('28. source does not write evidence or binding artifacts', async () => {
    const source = await fs.readFile(path.resolve('scripts/mlb-prospective-holdout-progress.ts'), 'utf-8');
    expect(source).not.toMatch(/write.*evidence/i);
    expect(source).not.toMatch(/write.*binding/i);
  });

  // 29. progress field names are allowed terminology
  it('29. progress field names use allowed capture terminology', async () => {
    const deps = createMockDeps();
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty('testCapturedCount');
    expect(parsed).toHaveProperty('validationCapturedCount');
    expect(parsed).toHaveProperty('totalCapturedCount');
  });

  // 30. production default root equals repository top-level
  it('30. production default root equals repository top-level', async () => {
    const readActivation = vi.fn(async (root: string): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => {
      if (root === REPO_ROOT) {
        return { ok: true, value: buildFrozenActivation(), receipt: DEFAULT_ACTIVATION_RECEIPT };
      }
      return { ok: false, issues: [{ code: 'ACTIVATION_MISSING', path: root, message: 'missing' }] };
    });
    const deps = createMockDeps({ readActivation });
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(0);
    expect(readActivation).toHaveBeenCalledWith(REPO_ROOT);
  });

  // 31. production root independent of process.cwd()
  it('31. production root independent of process.cwd()', async () => {
    const originalCwd = process.cwd();
    try {
      process.chdir('/tmp');
      const readActivation = vi.fn(async (root: string): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => {
        if (root === REPO_ROOT) {
          return { ok: true, value: buildFrozenActivation(), receipt: DEFAULT_ACTIVATION_RECEIPT };
        }
        return { ok: false, issues: [{ code: 'ACTIVATION_MISSING', path: root, message: 'missing' }] };
      });
      const deps = createMockDeps({ readActivation });
      const result = await invokeCLI([], deps);
      expect(result.exitCode).toBe(0);
      expect(readActivation).toHaveBeenCalledWith(REPO_ROOT);
    } finally {
      process.chdir(originalCwd);
    }
  });

  // 32. builder called with object input
  it('32. builder called with object input', async () => {
    const readActivation = vi.fn(async (): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => ({
      ok: true,
      value: buildFrozenActivation(),
      receipt: DEFAULT_ACTIVATION_RECEIPT,
    }));
    const candidate = buildCandidate();
    const discovery = buildDiscoverySuccess({ candidates: [candidate] });
    const discoverArtifacts = vi.fn(async (): Promise<MLBProspectiveHoldoutArtifactDiscoveryResult> => discovery);
    const deps = createMockDeps({ readActivation, discoverArtifacts });
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.activationId).toBe('activation-900001');
  });

  // 33. no two-arg builder calls
  it('33. source uses object-input builder pattern', async () => {
    const source = await fs.readFile(path.resolve('scripts/mlb-prospective-holdout-progress.ts'), 'utf-8');
    expect(source).toMatch(/buildMLBProspectiveHoldoutProgressReport\(\s*\{/);
  });

  // 34. discovery failure preserves all issue details
  it('34. discovery failure preserves all issue details', async () => {
    const readActivation = vi.fn(async (): Promise<MLBProspectiveHoldoutActivationStoreReadResult> => ({
      ok: true,
      value: buildFrozenActivation(),
      receipt: DEFAULT_ACTIVATION_RECEIPT,
    }));
    const discoverIssues = [
      { code: 'A', path: 'p1', message: 'm1' },
      { code: 'B', path: 'p2', message: 'm2' },
    ];
    const discoverArtifacts = vi.fn(async (): Promise<MLBProspectiveHoldoutArtifactDiscoveryResult> => ({
      ok: false,
      issues: discoverIssues,
    }));
    const deps = createMockDeps({ readActivation, discoverArtifacts });
    const result = await invokeCLI([], deps);
    expect(result.exitCode).toBe(1);
    for (const issue of discoverIssues) {
      expect(result.stderr).toContain(issue.code);
      expect(result.stderr).toContain(issue.path);
      expect(result.stderr).toContain(issue.message);
    }
  });

  // 35. no capture invocation
  it('35. source does not invoke capture orchestrator', async () => {
    const source = await fs.readFile(path.resolve('scripts/mlb-prospective-holdout-progress.ts'), 'utf-8');
    expect(source).not.toMatch(/mlb-prospective-holdout-capture-orchestrator/);
    expect(source).not.toMatch(/runMLBProspectiveHoldoutCapture/);
  });

  // 36. no evidence or binding write invocation
  it('36. source does not write evidence or binding artifacts', async () => {
    const source = await fs.readFile(path.resolve('scripts/mlb-prospective-holdout-progress.ts'), 'utf-8');
    expect(source).not.toMatch(/fs\.writeFile/);
    expect(source).not.toMatch(/writeActivation/);
    expect(source).not.toMatch(/persistProspective/);
  });

  // 37. no network acquisition
  it('37. source does not acquire network or schedule data', async () => {
    const source = await fs.readFile(path.resolve('scripts/mlb-prospective-holdout-progress.ts'), 'utf-8');
    expect(source).not.toMatch(/MLB_NETWORK_CLIENT/);
    expect(source).not.toMatch(/fetch\(/i);
    expect(source).not.toMatch(/https?:\/\//);
  });

  // 38. no capture orchestrator invocation
  it('38. source does not import or invoke capture orchestrator', async () => {
    const source = await fs.readFile(path.resolve('scripts/mlb-prospective-holdout-progress.ts'), 'utf-8');
    expect(source).not.toMatch(/mlb-prospective-holdout-capture-orchestrator/);
    expect(source).not.toMatch(/runMLBProspectiveHoldoutCapture/);
  });

  // 39. no filesystem write invocation
  it('39. source does not perform filesystem write operations', async () => {
    const source = await fs.readFile(path.resolve('scripts/mlb-prospective-holdout-progress.ts'), 'utf-8');
    expect(source).not.toMatch(/fs\.writeFile/);
    expect(source).not.toMatch(/writeFileSync/);
  });

  // 40. process.stdout.write is allowed
  it('40. source may use process.stdout.write for CLI output', async () => {
    const source = await fs.readFile(path.resolve('scripts/mlb-prospective-holdout-progress.ts'), 'utf-8');
    // process.stdout.write and process.stderr.write are legitimate CLI output
    expect(source).toMatch(/process\.stdout\.write/);
    expect(source).toMatch(/process\.stderr\.write/);
  });
});
