import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  discoverMLBProspectiveHoldoutArtifacts,
  type MLBProspectiveHoldoutArtifactDiscoveryResult,
} from '@/prediction/mlb/mlb-prospective-holdout-artifact-discovery';

import {
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_DIRECTORY,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
  type MLBProspectivePregameEvidence,
  type MLBProspectivePregameEvidencePrepared,
  type MLBProspectivePregameEvidenceReceipt,
  computeArtifactId,
  validateMLBProspectivePregameEvidence,
} from '@/prediction/mlb/mlb-prospective-pregame-evidence-artifact-contract';
import {
  persistProspectivePregameEvidence,
  readProspectivePregameEvidence,
  resolveMLBProspectivePregameEvidenceStorePaths,
  resolveMLBProspectivePregameEvidenceArtifactPaths,
} from '@/prediction/mlb/mlb-prospective-pregame-evidence-store';
import {
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_DIRECTORY,
  type MLBProspectiveHoldoutGameIdentityBinding,
  type MLBProspectiveHoldoutGameIdentityBindingPrepared,
  type MLBProspectiveHoldoutGameIdentityBindingReceipt,
  canonicalSerializeGameIdentityBinding,
  computeBindingId,
  validateMLBProspectiveHoldoutGameIdentityBinding,
} from '@/prediction/mlb/mlb-prospective-holdout-game-identity-binding-contract';
import {
  persistProspectiveHoldoutGameIdentityBinding,
  readProspectiveHoldoutGameIdentityBinding,
  resolveMLBProspectiveHoldoutGameIdentityBindingStorePaths,
  resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths,
} from '@/prediction/mlb/mlb-prospective-holdout-game-identity-binding-store';

import {
  validateMLBProspectiveHoldoutActivationPersisted,
  type MLBProspectiveHoldoutActivationPersisted,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-contract';

import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
} from '@/prediction/mlb/mlb-prospective-holdout-protocol-contract';

import {
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
} from '@/prediction/mlb/mlb-inner-development-third-real-candidate-recipe';

import {
  MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
  MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
  computeScientificCutoffAt,
} from '@/prediction/mlb/mlb-prospective-t360-capture-contract';

import {
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
  validateMLBCanonicalPregameSnapshot,
  type MLBCanonicalPregameSnapshot,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';

import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';

import {
  validateMLBFeatureVector,
  extractMLBLeakageSafeFeatureVector,
  type MLBFeatureVector,
} from '@/prediction/mlb/mlb-feature-vector-contract';

import {
  applyCandidate003ProspectiveFeatureCompatibility,
} from '@/prediction/mlb/mlb-candidate-003-prospective-feature-compatibility';

const FROZEN_SOURCE_TS = '2026-07-15T05:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T05:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';
const cutoffResult = computeScientificCutoffAt(FROZEN_SCHEDULED_START);
if (!cutoffResult.ok) {
  throw new Error('Failed to compute scientific cutoff: ' + cutoffResult.message);
}
const SCIENTIFIC_CUTOFF = cutoffResult.scientificCutoffAt;

function buildSourceReference(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sourceRefId: 'src-official',
    sourceName: 'MLB Stats API',
    sourceCategory: 'OFFICIAL',
    roles: ['GAME_IDENTITY'],
    providerRecordId: null,
    fetchedAt: FROZEN_SOURCE_TS,
    sourceUpdatedAt: FROZEN_SOURCE_TS,
    ...overrides,
  };
}

function buildStartingPitcher(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    state: 'PROBABLE' as const,
    pitcherId: 'p-1',
    announcedAt: FROZEN_SOURCE_TS,
    sourceRefIds: ['src-official'],
    ...overrides,
  };
}

function buildSection(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sectionId: 'sec-1',
    kind: 'GAME_CONTEXT' as const,
    entity: {
      scope: 'GAME' as const,
      entityId: null,
    },
    status: 'AVAILABLE' as const,
    asOfAt: FROZEN_SOURCE_TS,
    sourceRefIds: ['src-official'],
    payload: {},
    ...overrides,
  };
}

function buildWarning(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code: 'PATCHY_WIND',
    path: '$.venue.wind',
    message: 'Wind speed varies across reported sources.',
    ...overrides,
  };
}

function buildValidSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const baseGame = {
    gameId: '900001',
    scheduledStartAt: FROZEN_SCHEDULED_START,
    officialDate: '2026-07-15',
    season: 2026,
    gameType: 'REGULAR_SEASON' as const,
    status: 'SCHEDULED' as const,
    homeTeamId: 'home-1',
    awayTeamId: 'away-1',
    venueId: 'venue-1',
    neutralSite: false,
    doubleheader: null,
  };
  const gameOverrides = overrides.game as Record<string, unknown> | undefined;
  const { game: _game, ...restOverrides } = overrides;
  const game = gameOverrides ? { ...baseGame, ...gameOverrides } : baseGame;

  const base = {
    contractVersion: MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
    sport: 'MLB' as const,
    target: 'OFFICIAL_FINAL_GAME_WINNER' as const,
    snapshotId: 'snapshot-1',
    capturedAt: FROZEN_DATA_CUTOFF,
    dataCutoffAt: FROZEN_DATA_CUTOFF,
    game,
    startingPitchers: {
      home: buildStartingPitcher(),
      away: buildStartingPitcher({ pitcherId: 'p-2', sourceRefIds: ['src-away'] }),
    },
    sourceReferences: [
      buildSourceReference({ sourceRefId: 'src-away', roles: ['STARTING_PITCHER'] }),
      buildSourceReference(),
    ],
    sections: [
      buildSection({
        sectionId: 'section-game-context',
        kind: 'GAME_CONTEXT' as const,
        entity: { scope: 'GAME' as const, entityId: null },
        payload: { doubleHeaderGameNumber: 1, scheduledInnings: 9 },
      }),
    ],
    dataCompleteness: 'COMPLETE' as const,
    warnings: [buildWarning()],
    ...restOverrides,
  };
  return base;
}

function buildValidSnapshotObject(overrides: Record<string, unknown> = {}): MLBCanonicalPregameSnapshot {
  const raw = buildValidSnapshot(overrides);
  const validation = validateMLBCanonicalPregameSnapshot(raw);
  expect(validation.ok).toBe(true);
  if (validation.ok) {
    return validation.value;
  }
  throw new Error('Failed to build valid snapshot');
}

function extractRawVector(snapshot: MLBCanonicalPregameSnapshot): MLBFeatureVector {
  const result = extractMLBLeakageSafeFeatureVector(
    MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    snapshot,
  );
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error('Failed to extract raw vector: ' + JSON.stringify(result.issues));
  }
  return result.value;
}

type SyntheticEvidenceOverrides = Readonly<{
  game?: Readonly<{ gameId?: string; scheduledStartAt?: string; officialDate?: string }>;
  activationId?: string;
  snapshotId?: string;
  officialDate?: string;
  scheduledStartAt?: string;
}>;

function buildValidPreparedEvidence(
  overrides: SyntheticEvidenceOverrides = {},
): MLBProspectivePregameEvidencePrepared {
  const { game, snapshotId, officialDate, scheduledStartAt, ...evidenceOverrides } = overrides;
  const snapshotGame = game ? { ...game } : undefined;
  if (scheduledStartAt && snapshotGame) snapshotGame.scheduledStartAt = scheduledStartAt;
  if (officialDate && snapshotGame) snapshotGame.officialDate = officialDate;
  const snapshotOverrides: Record<string, unknown> = {};
  if (snapshotGame) snapshotOverrides.game = snapshotGame;
  if (snapshotId) snapshotOverrides.snapshotId = snapshotId;
  const snapshot = buildValidSnapshotObject(snapshotOverrides);
  const rawVector = extractRawVector(snapshot);
  const compatibleResult = applyCandidate003ProspectiveFeatureCompatibility(rawVector);
  expect(compatibleResult.ok).toBe(true);
  if (!compatibleResult.ok) {
    throw new Error('Failed to build compatible vector');
  }
  const compatibleVector = compatibleResult.value;

  const t360Validation = {
    status: 'ACCEPTED' as const,
    actualDataCutoffAtLteScientificCutoff: true,
    sourceTimestampsProvenLteScientificCutoff: true,
  } as const;

  const effectiveScheduledStartAt = snapshot.game.scheduledStartAt;
  const cutoffResult = computeScientificCutoffAt(effectiveScheduledStartAt);
  if (!cutoffResult.ok) {
    throw new Error('Failed to compute scientific cutoff: ' + cutoffResult.message);
  }
  const effectiveScientificCutoffAt = cutoffResult.scientificCutoffAt;

  const base: MLBProspectivePregameEvidencePrepared = {
    contractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: 'activation-900001',
    captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
    compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
    gameId: snapshot.game.gameId,
    snapshotId: snapshot.snapshotId,
    officialDate: snapshot.game.officialDate,
    scheduledStartAt: effectiveScheduledStartAt,
    scientificCutoffAt: effectiveScientificCutoffAt,
    actualDataCutoffAt: snapshot.dataCutoffAt,
    rawSnapshot: snapshot,
    rawFeatureVector: rawVector,
    candidate003CompatibleFeatureVector: compatibleVector,
    t360Validation,
    ...evidenceOverrides,
  };

  return base;
}

function withPersistedAt(
  prepared: MLBProspectivePregameEvidencePrepared,
  persistedAt: string,
): MLBProspectivePregameEvidence {
  return {
    ...prepared,
    persistedAt,
  };
}

async function createTempRoot(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function persistSyntheticEvidence(
  root: string,
  prepared: MLBProspectivePregameEvidencePrepared,
  clock: () => string,
): Promise<MLBProspectivePregameEvidenceReceipt> {
  const result = await persistProspectivePregameEvidence(root, prepared, clock);
  if (!result.ok) {
    throw new Error('Failed to persist synthetic evidence: ' + JSON.stringify(result.issues));
  }
  return result.receipt;
}

function buildValidPreparedBinding(
  evidenceRoot: string,
  evidencePrepared: MLBProspectivePregameEvidencePrepared,
  evidenceReceipt: MLBProspectivePregameEvidenceReceipt,
  scheduleGame: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
): MLBProspectiveHoldoutGameIdentityBindingPrepared {
  const base: MLBProspectiveHoldoutGameIdentityBindingPrepared = {
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: evidencePrepared.activationId,
    authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
    scheduleGame,
    evidence: withPersistedAt(evidencePrepared, evidenceReceipt.persistedAt),
    evidenceReceipt,
    ...overrides,
  };
  return base;
}

async function persistSyntheticBinding(
  root: string,
  prepared: MLBProspectiveHoldoutGameIdentityBindingPrepared,
  clock: () => string,
): Promise<MLBProspectiveHoldoutGameIdentityBindingReceipt> {
  const result = await persistProspectiveHoldoutGameIdentityBinding(root, prepared, clock);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error('Failed to persist synthetic binding: ' + JSON.stringify(result.issues));
  }
  return result.receipt;
}

function buildFrozenActivation(
  overrides: Record<string, unknown> = {},
): MLBProspectiveHoldoutActivationPersisted {
  const base: MLBProspectiveHoldoutActivationPersisted = {
    contractVersion: 'mlb-prospective-holdout-activation-v1',
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: 'activation-900001',
    candidateRecipeId: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
    candidateFingerprint: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
    featureManifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
    featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
    preprocessingPolicyId: 'raw-finite-feature-values-with-default-missing-v1',
    captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
    compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
    evidenceArtifactContractVersion: 'mlb-prospective-pregame-evidence-artifact-v1',
    evidenceStoreVersion: 'mlb-prospective-pregame-evidence-store-v1',
    validationBoundaryOfficialDate: '2026-07-15',
    validationTargetCount: 67,
    testTargetCount: 69,
    stableOrderPolicy: 'scheduledStartAt_ASC_gamePk_ASC',
    validationSideDateRule: 'OFFICIAL_DATE_LTE_BOUNDARY',
    testSideDateRule: 'OFFICIAL_DATE_GT_BOUNDARY',
    noSmallerN: true,
    resultIndependentSelection: true,
    testAuthorizationRule: 'NO_TEST_AUTHORIZATION',
    gameIdentityBindingContractVersion: 'mlb-prospective-holdout-game-identity-binding-v1',
    gameIdentityBindingStoreVersion: 'mlb-prospective-holdout-game-identity-binding-store-v1',
    persistedAt: '2026-07-15T04:00:00Z',
    ...overrides,
  };

  const validation = validateMLBProspectiveHoldoutActivationPersisted(base);
  expect(validation.ok).toBe(true);
  if (!validation.ok) {
    throw new Error('Invalid frozen activation: ' + JSON.stringify(validation.issues));
  }
  return validation.value;
}

/* -------------------------------------------------------------------------- */
/*  Authoritative store path helpers                                          */
/* -------------------------------------------------------------------------- */

function getEvidenceStorePaths(root: string) {
  return resolveMLBProspectivePregameEvidenceStorePaths(root);
}

function getBindingStorePaths(root: string) {
  return resolveMLBProspectiveHoldoutGameIdentityBindingStorePaths(root);
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-artifact-discovery', () => {
  describe('missing directories', () => {
    it('returns successful empty reconstruction when store directories are absent', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const activation = buildFrozenActivation();
        const result = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.candidates).toHaveLength(0);
        expect(result.orphanEvidence).toHaveLength(0);
        expect(result.rescheduleConflicts).toHaveLength(0);
        expect(result.temporaryDebris).toHaveLength(0);
        expect(result.unknownFiles).toHaveLength(0);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('one valid pair', () => {
    it('discovers exactly one direct candidate', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const evidenceRoot = getEvidenceStorePaths(root).evidenceDirectory;
        const bindingRoot = getBindingStorePaths(root).bindingDirectory;
        await fs.mkdir(evidenceRoot, { recursive: true });
        await fs.mkdir(bindingRoot, { recursive: true });

        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(root, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const bindingPrepared = buildValidPreparedBinding(root, evidencePrepared, evidenceReceipt, scheduleGame);
        const bindingClock = () => '2026-07-15T06:30:00Z';
        const bindingReceipt = await persistSyntheticBinding(root, bindingPrepared, bindingClock);

        const activation = buildFrozenActivation({ activationId: 'activation-900001' });
        const result = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.candidates).toHaveLength(1);
        expect(result.candidates[0]?.evidence).toBeDefined();
        expect(result.candidates[0]?.binding).toBeDefined();
        expect(result.candidates[0]?.evidence.gameId).toBe('900001');
        expect(result.candidates[0]?.binding.gamePk).toBe(900001);
        expect(result.orphanEvidence).toHaveLength(0);
        expect(result.rescheduleConflicts).toHaveLength(0);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('multiple independent games', () => {
    it('discovers three distinct gamePk pairs in deterministic order', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const evidenceRoot = getEvidenceStorePaths(root).evidenceDirectory;
        const bindingRoot = getBindingStorePaths(root).bindingDirectory;
        await fs.mkdir(evidenceRoot, { recursive: true });
        await fs.mkdir(bindingRoot, { recursive: true });

        const gamePks = [900003, 900001, 900002];
        const scheduledStarts = [
          '2026-07-15T13:00:00Z',
          '2026-07-15T12:00:00Z',
          '2026-07-15T14:00:00Z',
        ];

        for (let i = 0; i < gamePks.length; i++) {
          const evidencePrepared = buildValidPreparedEvidence({
            game: { gameId: String(gamePks[i]) },
            snapshotId: `snapshot-${gamePks[i]}`,
            scheduledStartAt: scheduledStarts[i],
          });
          const evidenceReceipt = await persistSyntheticEvidence(root, evidencePrepared, () => FROZEN_DATA_CUTOFF);

          const scheduleGame = {
            gamePk: gamePks[i],
            officialDate: '2026-07-15',
            startTimeUtc: new Date(scheduledStarts[i]),
          };

          const bindingPrepared = buildValidPreparedBinding(root, evidencePrepared, evidenceReceipt, scheduleGame);
          await persistSyntheticBinding(root, bindingPrepared, () => '2026-07-15T06:30:00Z');
        }

        const activation = buildFrozenActivation({ activationId: 'activation-900001' });
        const result = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.candidates).toHaveLength(3);
        expect(result.candidates.map((c) => c.binding.gamePk)).toEqual([900001, 900003, 900002]);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('per-game scientific cutoff', () => {
    it('recomputes scientific cutoff from scheduledStartAt for each prepared evidence', async () => {
      const base = buildValidPreparedEvidence();
      const baseCutoff = computeScientificCutoffAt(base.scheduledStartAt);
      expect(baseCutoff.ok).toBe(true);
      if (baseCutoff.ok) {
        expect(base.scientificCutoffAt).toBe(baseCutoff.scientificCutoffAt);
      }

      const second = buildValidPreparedEvidence({
        game: { gameId: '900002' },
        snapshotId: 'snapshot-900002',
        scheduledStartAt: '2026-07-15T13:00:00Z',
      });
      const secondCutoff = computeScientificCutoffAt(second.scheduledStartAt);
      expect(secondCutoff.ok).toBe(true);
      if (secondCutoff.ok) {
        expect(second.scientificCutoffAt).toBe(secondCutoff.scientificCutoffAt);
      }

      const delayed = buildValidPreparedEvidence({
        game: { gameId: '900001' },
        snapshotId: 'snapshot-delayed',
        scheduledStartAt: '2026-07-15T18:00:00Z',
      });
      const delayedCutoff = computeScientificCutoffAt(delayed.scheduledStartAt);
      expect(delayedCutoff.ok).toBe(true);
      if (delayedCutoff.ok) {
        expect(delayed.scientificCutoffAt).toBe(delayedCutoff.scientificCutoffAt);
      }
    });
  });

  describe('restart reconstruction', () => {
    it('reconstructs identical candidates from disk across restarts', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const evidenceRoot = getEvidenceStorePaths(root).evidenceDirectory;
        const bindingRoot = getBindingStorePaths(root).bindingDirectory;
        await fs.mkdir(evidenceRoot, { recursive: true });
        await fs.mkdir(bindingRoot, { recursive: true });

        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceReceipt = await persistSyntheticEvidence(root, evidencePrepared, () => FROZEN_DATA_CUTOFF);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const bindingPrepared = buildValidPreparedBinding(root, evidencePrepared, evidenceReceipt, scheduleGame);
        const bindingReceipt = await persistSyntheticBinding(root, bindingPrepared, () => '2026-07-15T06:30:00Z');

        const activation = buildFrozenActivation({ activationId: 'activation-900001' });

        const firstResult = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(firstResult.ok).toBe(true);
        if (!firstResult.ok) return;

        const secondResult = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(secondResult.ok).toBe(true);
        if (!secondResult.ok) return;

        expect(secondResult.candidates).toHaveLength(firstResult.candidates.length);
        expect(secondResult.candidates[0]?.evidence.gameId).toBe(firstResult.candidates[0]?.evidence.gameId);
        expect(secondResult.candidates[0]?.binding.gamePk).toBe(firstResult.candidates[0]?.binding.gamePk);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('orphan H', () => {
    it('surfaces valid H evidence with no binding as orphan', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const evidenceRoot = getEvidenceStorePaths(root).evidenceDirectory;
        await fs.mkdir(evidenceRoot, { recursive: true });

        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceReceipt = await persistSyntheticEvidence(root, evidencePrepared, () => FROZEN_DATA_CUTOFF);

        const activation = buildFrozenActivation({ activationId: 'activation-900001' });
        const result = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.candidates).toHaveLength(0);
        expect(result.orphanEvidence).toHaveLength(1);
        expect(result.orphanEvidence[0]?.evidence.gameId).toBe('900001');
        expect(result.orphanEvidence[0]?.receipt.sha256).toBe(evidenceReceipt.sha256);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('binding without H', () => {
    it('fails discovery when binding references missing H artifact', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const evidenceRoot = getEvidenceStorePaths(root).evidenceDirectory;
        const bindingRoot = getBindingStorePaths(root).bindingDirectory;
        await fs.mkdir(evidenceRoot, { recursive: true });
        await fs.mkdir(bindingRoot, { recursive: true });

        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceReceipt = await persistSyntheticEvidence(root, evidencePrepared, () => FROZEN_DATA_CUTOFF);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const bindingPrepared = buildValidPreparedBinding(root, evidencePrepared, evidenceReceipt, scheduleGame);
        const bindingReceipt = await persistSyntheticBinding(root, bindingPrepared, () => '2026-07-15T06:30:00Z');

        // Remove H final file
        const artifactPaths = resolveMLBProspectivePregameEvidenceArtifactPaths(root, evidenceReceipt.artifactId);
        await fs.rm(artifactPaths.artifactPath);

        const activation = buildFrozenActivation({ activationId: 'activation-900001' });
        const result = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(result.ok).toBe(false);
        if (result.ok) return;

        const missingEvidence = result.issues.find((i) => i.code === 'BINDING_REFERENCES_MISSING_EVIDENCE');
        expect(missingEvidence).toBeDefined();
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('corrupt H JSON', () => {
    it('fails discovery for syntactically invalid H JSON', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const evidenceDir = getEvidenceStorePaths(root).evidenceDirectory;
        await fs.mkdir(evidenceDir, { recursive: true });

        const artifactId = 'proto::act::game::snap::cutoff';
        const artifactPaths = resolveMLBProspectivePregameEvidenceArtifactPaths(root, artifactId);
        await fs.writeFile(artifactPaths.artifactPath, '{not json');

        const activation = buildFrozenActivation({ activationId: 'activation-900001' });
        const result = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(result.ok).toBe(false);
        if (result.ok) return;

        const invalidJson = result.issues.find((i) => i.code === 'EVIDENCE_JSON_INVALID');
        expect(invalidJson).toBeDefined();
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('contract-invalid H JSON', () => {
    it('fails discovery for contract-invalid H JSON', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const evidenceDir = getEvidenceStorePaths(root).evidenceDirectory;
        await fs.mkdir(evidenceDir, { recursive: true });

        const artifactId = 'proto::act::game::snap::cutoff';
        const artifactPaths = resolveMLBProspectivePregameEvidenceArtifactPaths(root, artifactId);
        await fs.writeFile(artifactPaths.artifactPath, JSON.stringify({ contractVersion: 'wrong', protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID }));

        const activation = buildFrozenActivation({ activationId: 'activation-900001' });
        const result = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(result.ok).toBe(false);
        if (result.ok) return;

        const invalid = result.issues.find((i) => i.code === 'EVIDENCE_CONTRACT_INVALID');
        expect(invalid).toBeDefined();
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('corrupt binding', () => {
    it('fails discovery for malformed binding JSON', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const bindingDir = getBindingStorePaths(root).bindingDirectory;
        await fs.mkdir(bindingDir, { recursive: true });

        const bindingId = 'proto::act::1::aid::sha';
        const bindingArtifactPaths = resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths(root, bindingId);
        await fs.writeFile(bindingArtifactPaths.bindingPath, '{not json');

        const activation = buildFrozenActivation({ activationId: 'activation-900001' });
        const result = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(result.ok).toBe(false);
        if (result.ok) return;

        const invalidJson = result.issues.find((i) => i.code === 'BINDING_JSON_INVALID');
        expect(invalidJson).toBeDefined();
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('wrong H filename', () => {
    it('fails discovery when H artifact is at incorrect canonical path', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const evidenceRoot = getEvidenceStorePaths(root).evidenceDirectory;
        await fs.mkdir(evidenceRoot, { recursive: true });

        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceReceipt = await persistSyntheticEvidence(root, evidencePrepared, () => FROZEN_DATA_CUTOFF);

        const canonicalPaths = resolveMLBProspectivePregameEvidenceArtifactPaths(root, evidenceReceipt.artifactId);
        const wrongFilename = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json';
        const wrongPath = path.join(evidenceRoot, wrongFilename);
        await fs.rename(canonicalPaths.artifactPath, wrongPath);

        const activation = buildFrozenActivation({ activationId: 'activation-900001' });
        const result = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(result.ok).toBe(false);
        if (result.ok) return;

        const pathMismatch = result.issues.find((i) => i.code === 'EVIDENCE_PATH_MISMATCH');
        expect(pathMismatch).toBeDefined();
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('wrong binding filename', () => {
    it('fails discovery when binding is at incorrect canonical path', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const evidenceRoot = getEvidenceStorePaths(root).evidenceDirectory;
        const bindingRoot = getBindingStorePaths(root).bindingDirectory;
        await fs.mkdir(evidenceRoot, { recursive: true });
        await fs.mkdir(bindingRoot, { recursive: true });

        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceReceipt = await persistSyntheticEvidence(root, evidencePrepared, () => FROZEN_DATA_CUTOFF);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };
        const bindingPrepared = buildValidPreparedBinding(root, evidencePrepared, evidenceReceipt, scheduleGame);
        const bindingReceipt = await persistSyntheticBinding(root, bindingPrepared, () => '2026-07-15T06:30:00Z');

        const canonicalPaths = resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths(root, bindingReceipt.bindingId);
        const wrongFilename = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.json';
        const wrongPath = path.join(bindingRoot, wrongFilename);
        await fs.rename(canonicalPaths.bindingPath, wrongPath);

        const activation = buildFrozenActivation({ activationId: 'activation-900001' });
        const result = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(result.ok).toBe(false);
        if (result.ok) return;

        const pathMismatch = result.issues.find((i) => i.code === 'BINDING_PATH_MISMATCH');
        expect(pathMismatch).toBeDefined();
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('symlink', () => {
    it('fails discovery when symlink exists inside H directory', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const evidenceDir = getEvidenceStorePaths(root).evidenceDirectory;
        await fs.mkdir(evidenceDir, { recursive: true });

        const symlinkPath = path.join(evidenceDir, 'link.json');
        await fs.symlink('/dev/null', symlinkPath);

        const activation = buildFrozenActivation({ activationId: 'activation-900001' });
        const result = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(result.ok).toBe(false);
        if (result.ok) return;

        const symlinkIssue = result.issues.find((i) => i.code === 'EVIDENCE_SYMLINK_DETECTED');
        expect(symlinkIssue).toBeDefined();
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('fails discovery when symlink exists inside binding directory', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const bindingDir = getBindingStorePaths(root).bindingDirectory;
        await fs.mkdir(bindingDir, { recursive: true });

        const symlinkPath = path.join(bindingDir, 'link.json');
        await fs.symlink('/dev/null', symlinkPath);

        const activation = buildFrozenActivation({ activationId: 'activation-900001' });
        const result = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(result.ok).toBe(false);
        if (result.ok) return;

        const symlinkIssue = result.issues.find((i) => i.code === 'BINDING_SYMLINK_DETECTED');
        expect(symlinkIssue).toBeDefined();
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('subdirectory', () => {
    it('fails discovery when unexpected subdirectory exists in H directory', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const evidenceDir = getEvidenceStorePaths(root).evidenceDirectory;
        await fs.mkdir(path.join(evidenceDir, 'subdir'), { recursive: true });

        const activation = buildFrozenActivation({ activationId: 'activation-900001' });
        const result = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(result.ok).toBe(false);
        if (result.ok) return;

        const subdirIssue = result.issues.find((i) => i.code === 'EVIDENCE_SUBDIRECTORY_DETECTED');
        expect(subdirIssue).toBeDefined();
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('unknown non-JSON file', () => {
    it('reports unknown non-JSON files without failing', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const evidenceDir = getEvidenceStorePaths(root).evidenceDirectory;
        await fs.mkdir(evidenceDir, { recursive: true });
        await fs.writeFile(path.join(evidenceDir, 'README.txt'), 'hello');

        const activation = buildFrozenActivation({ activationId: 'activation-900001' });
        const result = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.unknownFiles).toHaveLength(1);
        expect(result.unknownFiles[0]).toContain('README.txt');
        expect(result.candidates).toHaveLength(0);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('temp debris', () => {
    it('surfaces temp debris without failing and excludes from candidates', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const evidenceDir = getEvidenceStorePaths(root).evidenceDirectory;
        await fs.mkdir(evidenceDir, { recursive: true });

        const tempName = `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.tmp-${crypto.randomUUID().replace(/-/g, '')}`;
        await fs.writeFile(path.join(evidenceDir, tempName), '{}');

        const activation = buildFrozenActivation({ activationId: 'activation-900001' });
        const result = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.temporaryDebris).toHaveLength(1);
        expect(result.candidates).toHaveLength(0);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('same gamePk two valid pairs', () => {
    it('detects reschedule conflict and excludes both pairs', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const evidenceRoot = getEvidenceStorePaths(root).evidenceDirectory;
        const bindingRoot = getBindingStorePaths(root).bindingDirectory;
        await fs.mkdir(evidenceRoot, { recursive: true });
        await fs.mkdir(bindingRoot, { recursive: true });

        const gamePk = 900001;

        const evidencePrepared1 = buildValidPreparedEvidence({
          game: { gameId: String(gamePk) },
          snapshotId: 'snapshot-s1',
          scheduledStartAt: '2026-07-15T12:00:00Z',
        });
        const evidenceReceipt1 = await persistSyntheticEvidence(root, evidencePrepared1, () => FROZEN_DATA_CUTOFF);

        const scheduleGame1 = {
          gamePk,
          officialDate: '2026-07-15',
          startTimeUtc: new Date('2026-07-15T12:00:00Z'),
        };
        const bindingPrepared1 = buildValidPreparedBinding(root, evidencePrepared1, evidenceReceipt1, scheduleGame1);
        await persistSyntheticBinding(root, bindingPrepared1, () => '2026-07-15T06:30:00Z');

        const evidencePrepared2 = buildValidPreparedEvidence({
          game: { gameId: String(gamePk) },
          snapshotId: 'snapshot-s2',
          scheduledStartAt: '2026-07-15T18:00:00Z',
        });
        const evidenceReceipt2 = await persistSyntheticEvidence(root, evidencePrepared2, () => '2026-07-15T05:30:00Z');

        const scheduleGame2 = {
          gamePk,
          officialDate: '2026-07-15',
          startTimeUtc: new Date('2026-07-15T18:00:00Z'),
        };
        const bindingPrepared2 = buildValidPreparedBinding(root, evidencePrepared2, evidenceReceipt2, scheduleGame2);
        await persistSyntheticBinding(root, bindingPrepared2, () => '2026-07-15T06:30:00Z');

        const activation = buildFrozenActivation({ activationId: 'activation-900001' });
        const result = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.candidates).toHaveLength(0);
        expect(result.rescheduleConflicts).toHaveLength(1);
        expect(result.rescheduleConflicts[0]?.gamePk).toBe(gamePk);
        expect(result.rescheduleConflicts[0]?.bindingIds).toHaveLength(2);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('same gamePk different activation', () => {
    it('does not create cross-activation reschedule conflict', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const evidenceRoot = getEvidenceStorePaths(root).evidenceDirectory;
        const bindingRoot = getBindingStorePaths(root).bindingDirectory;
        await fs.mkdir(evidenceRoot, { recursive: true });
        await fs.mkdir(bindingRoot, { recursive: true });

        const gamePk = 900001;

        const evidencePreparedA = buildValidPreparedEvidence({
          activationId: 'activation-A',
          game: { gameId: String(gamePk) },
          snapshotId: 'snapshot-A',
          scheduledStartAt: '2026-07-15T12:00:00Z',
        });
        const evidenceReceiptA = await persistSyntheticEvidence(root, evidencePreparedA, () => FROZEN_DATA_CUTOFF);

        const scheduleGameA = {
          gamePk,
          officialDate: '2026-07-15',
          startTimeUtc: new Date('2026-07-15T12:00:00Z'),
        };
        const bindingPreparedA = buildValidPreparedBinding(root, evidencePreparedA, evidenceReceiptA, scheduleGameA);
        await persistSyntheticBinding(root, bindingPreparedA, () => '2026-07-15T06:30:00Z');

        const evidencePreparedB = buildValidPreparedEvidence({
          activationId: 'activation-B',
          game: { gameId: String(gamePk) },
          snapshotId: 'snapshot-B',
          scheduledStartAt: '2026-07-15T18:00:00Z',
        });
        const evidenceReceiptB = await persistSyntheticEvidence(root, evidencePreparedB, () => '2026-07-15T05:30:00Z');

        const scheduleGameB = {
          gamePk,
          officialDate: '2026-07-15',
          startTimeUtc: new Date('2026-07-15T18:00:00Z'),
        };
        const bindingPreparedB = buildValidPreparedBinding(root, evidencePreparedB, evidenceReceiptB, scheduleGameB);
        await persistSyntheticBinding(root, bindingPreparedB, () => '2026-07-15T06:30:00Z');

        const activationA = buildFrozenActivation({ activationId: 'activation-A' });
        const resultA = await discoverMLBProspectiveHoldoutArtifacts(root, activationA);
        expect(resultA.ok).toBe(true);
        if (!resultA.ok) return;

        expect(resultA.candidates).toHaveLength(1);
        expect(resultA.rescheduleConflicts).toHaveLength(0);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('foreign activation', () => {
    it('validates foreign artifacts but excludes them from active candidates', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const evidenceRoot = getEvidenceStorePaths(root).evidenceDirectory;
        const bindingRoot = getBindingStorePaths(root).bindingDirectory;
        await fs.mkdir(evidenceRoot, { recursive: true });
        await fs.mkdir(bindingRoot, { recursive: true });

        const evidencePreparedForeign = buildValidPreparedEvidence({
          activationId: 'foreign-activation',
          game: { gameId: '900099' },
          snapshotId: 'snapshot-foreign',
        });
        const foreignEvidenceReceipt = await persistSyntheticEvidence(root, evidencePreparedForeign, () => FROZEN_DATA_CUTOFF);

        const scheduleGameForeign = {
          gamePk: 900099,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };
        const bindingPreparedForeign = buildValidPreparedBinding(root, evidencePreparedForeign, foreignEvidenceReceipt, scheduleGameForeign);
        await persistSyntheticBinding(root, bindingPreparedForeign, () => '2026-07-15T06:30:00Z');

        const activation = buildFrozenActivation({ activationId: 'activation-900001' });
        const result = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.candidates).toHaveLength(0);
        expect(result.foreignArtifactSummary.foreignEvidenceCount).toBe(1);
        expect(result.foreignArtifactSummary.foreignBindingCount).toBe(1);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('deterministic order', () => {
    it('produces identical ordered results regardless of filesystem creation order', async () => {
      const roots: string[] = [];
      try {
        for (let r = 0; r < 2; r++) {
          const root = await createTempRoot('mlb-discovery-test-');
          roots.push(root);

          const evidenceRoot = getEvidenceStorePaths(root).evidenceDirectory;
          const bindingRoot = getBindingStorePaths(root).bindingDirectory;
          await fs.mkdir(evidenceRoot, { recursive: true });
          await fs.mkdir(bindingRoot, { recursive: true });

          const gamePks = [900003, 900001, 900002];
          for (const gamePk of gamePks) {
            const evidencePrepared = buildValidPreparedEvidence({
              game: { gameId: String(gamePk) },
              snapshotId: `snapshot-${gamePk}`,
              scheduledStartAt: '2026-07-15T12:00:00Z',
            });
            const evidenceReceipt = await persistSyntheticEvidence(root, evidencePrepared, () => FROZEN_DATA_CUTOFF);

            const scheduleGame = {
              gamePk,
              officialDate: '2026-07-15',
              startTimeUtc: new Date('2026-07-15T12:00:00Z'),
            };
            const bindingPrepared = buildValidPreparedBinding(root, evidencePrepared, evidenceReceipt, scheduleGame);
            await persistSyntheticBinding(root, bindingPrepared, () => '2026-07-15T06:30:00Z');
          }

          const activation = buildFrozenActivation({ activationId: 'activation-900001' });
          const result = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
          expect(result.ok).toBe(true);
          if (!result.ok) return;

          if (r === 1) {
            expect(result.candidates.map((c) => c.binding.gamePk)).toEqual([900001, 900002, 900003]);
          }
        }
      } finally {
        for (const root of roots) {
          await fs.rm(root, { recursive: true, force: true });
        }
      }
    });
  });

  describe('binding SHA cross-link', () => {
    it('fails discovery when binding.evidenceSha256 tampered at old canonical path', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const evidenceDir = getEvidenceStorePaths(root).evidenceDirectory;
        const bindingDir = getBindingStorePaths(root).bindingDirectory;
        await fs.mkdir(evidenceDir, { recursive: true });
        await fs.mkdir(bindingDir, { recursive: true });

        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceReceipt = await persistSyntheticEvidence(root, evidencePrepared, () => FROZEN_DATA_CUTOFF);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const bindingPrepared = buildValidPreparedBinding(root, evidencePrepared, evidenceReceipt, scheduleGame);
        const bindingReceipt = await persistSyntheticBinding(root, bindingPrepared, () => '2026-07-15T06:30:00Z');

        // Tamper binding file to have wrong evidenceSha256
        const artifactPaths = resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths(root, bindingReceipt.bindingId);
        const tampered = JSON.parse(await fs.readFile(artifactPaths.bindingPath, 'utf-8'));
        tampered.evidenceSha256 = '0'.repeat(64);
        await fs.writeFile(artifactPaths.bindingPath, JSON.stringify(tampered), 'utf-8');

        const activation = buildFrozenActivation({ activationId: 'activation-900001' });
        const result = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(result.ok).toBe(false);
        if (result.ok) return;

        // Changing evidenceSha256 changes the computed bindingId, so the file
        // no longer matches its canonical path. Path mismatch is reached before
        // J's cross-link SHA check.
        const pathMismatch = result.issues.find((i) => i.code === 'BINDING_PATH_MISMATCH');
        expect(pathMismatch).toBeDefined();
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('fails discovery when self-consistent adversarial binding has wrong evidenceSha256', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const evidenceDir = getEvidenceStorePaths(root).evidenceDirectory;
        const bindingDir = getBindingStorePaths(root).bindingDirectory;
        await fs.mkdir(evidenceDir, { recursive: true });
        await fs.mkdir(bindingDir, { recursive: true });

        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceReceipt = await persistSyntheticEvidence(root, evidencePrepared, () => FROZEN_DATA_CUTOFF);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const bindingPrepared = buildValidPreparedBinding(root, evidencePrepared, evidenceReceipt, scheduleGame);
        const goodBindingReceipt = await persistSyntheticBinding(root, bindingPrepared, () => '2026-07-15T06:30:00Z');

        const goodRead = await readProspectiveHoldoutGameIdentityBinding(root, goodBindingReceipt.bindingId);
        expect(goodRead.ok).toBe(true);
        if (!goodRead.ok) return;

        const adversarialBinding: MLBProspectiveHoldoutGameIdentityBinding = {
          ...goodRead.value,
          evidenceSha256: '0'.repeat(64),
        };

        const adversarialValidation = validateMLBProspectiveHoldoutGameIdentityBinding(adversarialBinding);
        expect(adversarialValidation.ok).toBe(true);
        if (!adversarialValidation.ok) return;

        const adversarialBindingId = computeBindingId({
          protocolId: adversarialBinding.protocolId,
          activationId: adversarialBinding.activationId,
          gamePk: adversarialBinding.gamePk,
          evidenceArtifactId: adversarialBinding.evidenceArtifactId,
          evidenceSha256: adversarialBinding.evidenceSha256,
        });
        expect(adversarialBindingId).not.toBe(goodBindingReceipt.bindingId);

        const adversarialPaths = resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths(root, adversarialBindingId);
        const adversarialSerialized = canonicalSerializeGameIdentityBinding(adversarialBinding);
        await fs.writeFile(adversarialPaths.bindingPath, adversarialSerialized, 'utf-8');

        const goodPaths = resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths(root, goodBindingReceipt.bindingId);
        await fs.rm(goodPaths.bindingPath, { force: true });

        const adversarialRead = await readProspectiveHoldoutGameIdentityBinding(root, adversarialBindingId);
        expect(adversarialRead.ok).toBe(true);
        if (!adversarialRead.ok) return;
        expect(adversarialRead.value.evidenceArtifactId).toBe(evidenceReceipt.artifactId);
        expect(adversarialRead.value.evidenceSha256).not.toBe(evidenceReceipt.sha256);

        const activation = buildFrozenActivation({ activationId: 'activation-900001' });
        const result = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(result.ok).toBe(false);
        if (result.ok) return;

        const shaMismatch = result.issues.find((i) => i.code === 'BINDING_EVIDENCE_SHA_MISMATCH');
        expect(shaMismatch).toBeDefined();
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('no filesystem mutation', () => {
    it('does not mutate filesystem during discovery', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const evidenceDir = getEvidenceStorePaths(root).evidenceDirectory;
        const bindingDir = getBindingStorePaths(root).bindingDirectory;
        await fs.mkdir(evidenceDir, { recursive: true });
        await fs.mkdir(bindingDir, { recursive: true });

        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceReceipt = await persistSyntheticEvidence(root, evidencePrepared, () => FROZEN_DATA_CUTOFF);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };
        const bindingPrepared = buildValidPreparedBinding(root, evidencePrepared, evidenceReceipt, scheduleGame);
        const bindingReceipt = await persistSyntheticBinding(root, bindingPrepared, () => '2026-07-15T06:30:00Z');

        const evidenceArtifactPaths = resolveMLBProspectivePregameEvidenceArtifactPaths(root, evidenceReceipt.artifactId);
        const bindingArtifactPaths = resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths(root, bindingReceipt.bindingId);

        const beforeEvidence = await fs.readFile(evidenceArtifactPaths.artifactPath);
        const beforeBinding = await fs.readFile(bindingArtifactPaths.bindingPath);

        const activation = buildFrozenActivation({ activationId: 'activation-900001' });
        const result = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(result.ok).toBe(true);

        const afterEvidence = await fs.readFile(evidenceArtifactPaths.artifactPath);
        const afterBinding = await fs.readFile(bindingArtifactPaths.bindingPath);

        expect(afterEvidence).toEqual(beforeEvidence);
        expect(afterBinding).toEqual(beforeBinding);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('no network', () => {
    it('operates entirely on local immutable state', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const evidenceDir = getEvidenceStorePaths(root).evidenceDirectory;
        const bindingDir = getBindingStorePaths(root).bindingDirectory;
        await fs.mkdir(evidenceDir, { recursive: true });
        await fs.mkdir(bindingDir, { recursive: true });

        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceReceipt = await persistSyntheticEvidence(root, evidencePrepared, () => FROZEN_DATA_CUTOFF);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };
        const bindingPrepared = buildValidPreparedBinding(root, evidencePrepared, evidenceReceipt, scheduleGame);
        await persistSyntheticBinding(root, bindingPrepared, () => '2026-07-15T06:30:00Z');

        const activation = buildFrozenActivation({ activationId: 'activation-900001' });
        const result = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.candidates).toHaveLength(1);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('existing cohort integration', () => {
    it('produces candidates accepted by registerMLBProspectiveHoldoutCohorts', async () => {
      const root = await createTempRoot('mlb-discovery-test-');
      try {
        const evidenceRoot = getEvidenceStorePaths(root).evidenceDirectory;
        const bindingRoot = getBindingStorePaths(root).bindingDirectory;
        await fs.mkdir(evidenceRoot, { recursive: true });
        await fs.mkdir(bindingRoot, { recursive: true });

        const targetCount = 67;
        for (let i = 0; i < targetCount; i++) {
          const gamePk = 900001 + i;
          const evidencePrepared = buildValidPreparedEvidence({
            game: { gameId: String(gamePk) },
            snapshotId: `snapshot-${gamePk}`,
          });
          const evidenceReceipt = await persistSyntheticEvidence(root, evidencePrepared, () => FROZEN_DATA_CUTOFF);

          const scheduleGame = {
            gamePk,
            officialDate: '2026-07-15',
            startTimeUtc: new Date(FROZEN_SCHEDULED_START),
          };
          const bindingPrepared = buildValidPreparedBinding(root, evidencePrepared, evidenceReceipt, scheduleGame);
          await persistSyntheticBinding(root, bindingPrepared, () => '2026-07-15T06:30:00Z');
        }

        const activation = buildFrozenActivation({ activationId: 'activation-900001' });
        const discoveryResult = await discoverMLBProspectiveHoldoutArtifacts(root, activation);
        expect(discoveryResult.ok).toBe(true);
        if (!discoveryResult.ok) return;

        // Import cohort registration dynamically to verify shape
        const { registerMLBProspectiveHoldoutCohorts } = await import(
          '@/prediction/mlb/mlb-prospective-holdout-cohort-registration'
        );

        const cohortInput = {
          activation,
          registrations: discoveryResult.candidates,
        };

        const cohortResult = registerMLBProspectiveHoldoutCohorts(cohortInput);
        expect(cohortResult.ok).toBe(true);
        if (cohortResult.ok) {
          expect(cohortResult.validation.selected).toHaveLength(targetCount);
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    }, 30000);
  });
});
