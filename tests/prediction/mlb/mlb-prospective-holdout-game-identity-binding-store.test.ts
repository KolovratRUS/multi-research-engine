import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  persistProspectiveHoldoutGameIdentityBinding,
  readProspectiveHoldoutGameIdentityBinding,
  resolveMLBProspectiveHoldoutGameIdentityBindingStorePaths,
  resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths,
  deriveBindingRelativePath,
} from '@/prediction/mlb/mlb-prospective-holdout-game-identity-binding-store';
import {
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_DIRECTORY,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_FAILURE_CODES,
  computeBindingId,
  canonicalSerializeGameIdentityBinding,
  type MLBProspectiveHoldoutGameIdentityBindingPrepared,
  type MLBProspectiveHoldoutGameIdentityBinding,
  type MLBProspectiveHoldoutGameIdentityBindingReceipt,
} from '@/prediction/mlb/mlb-prospective-holdout-game-identity-binding-contract';
import {
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_DIRECTORY,
  validateMLBProspectivePregameEvidence,
  type MLBProspectivePregameEvidencePrepared,
  type MLBProspectivePregameEvidence,
  type MLBProspectivePregameEvidenceReceipt,
} from '@/prediction/mlb/mlb-prospective-pregame-evidence-artifact-contract';
import {
  persistProspectivePregameEvidence,
} from '@/prediction/mlb/mlb-prospective-pregame-evidence-store';
import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
} from '@/prediction/mlb/mlb-prospective-holdout-protocol-contract';
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
function mustComputeScientificCutoffAt(scheduledStartAt: string): string {
  const result = computeScientificCutoffAt(scheduledStartAt);
  if (!result.ok) {
    throw new Error(`Failed to compute scientific cutoff: ${result.message}`);
  }
  return result.scientificCutoffAt;
}
const SCIENTIFIC_CUTOFF = mustComputeScientificCutoffAt(FROZEN_SCHEDULED_START);

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
  if (!result.ok) {
    throw new Error('Failed to extract raw feature vector: ' + JSON.stringify(result.issues));
  }
  return result.value;
}

function buildValidPreparedEvidence(
  snapshotOverrides: Record<string, unknown> = {},
): MLBProspectivePregameEvidencePrepared {
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

  const base: MLBProspectivePregameEvidencePrepared = {
    contractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: 'activation-900001',
    captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
    compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
    gameId: snapshot.game.gameId,
    snapshotId: snapshot.snapshotId,
    officialDate: snapshot.game.officialDate,
    scheduledStartAt: snapshot.game.scheduledStartAt,
    scientificCutoffAt: SCIENTIFIC_CUTOFF,
    actualDataCutoffAt: snapshot.dataCutoffAt,
    rawSnapshot: snapshot,
    rawFeatureVector: rawVector,
    candidate003CompatibleFeatureVector: compatibleVector,
    t360Validation,
  };

  return base as MLBProspectivePregameEvidencePrepared;
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
  expect(result.ok).toBe(true);
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
    activationId: 'activation-900001',
    authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
    scheduleGame,
    evidence: withPersistedAt(evidencePrepared, evidenceReceipt.persistedAt),
    evidenceReceipt,
    ...overrides,
  };
  return base;
}

async function countTempFiles(dir: string): Promise<number> {
  let count = 0;
  try {
    const entries = await fs.readdir(dir);
    for (const entry of entries) {
      if (entry.includes('.tmp-')) {
        count++;
      }
    }
  } catch {
    // ignore
  }
  return count;
}

async function countBindings(dir: string): Promise<number> {
  try {
    const entries = await fs.readdir(dir);
    return entries.filter((e) => e.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

describe('mlb-prospective-holdout-game-identity-binding-store', () => {
  describe('persistProspectiveHoldoutGameIdentityBinding', () => {
    it('writes valid binding and returns receipt', async () => {
      const root = await createTempRoot('mlb-binding-store-test-');
      try {
        const evidenceRoot = path.join(root, 'evidence');
        await fs.mkdir(evidenceRoot, { recursive: true });
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const prepared = buildValidPreparedBinding(evidenceRoot, evidencePrepared, evidenceReceipt, scheduleGame);
        const bindingClock = () => '2026-07-15T06:30:00Z';
        const result = await persistProspectiveHoldoutGameIdentityBinding(root, prepared, bindingClock);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const receipt = result.receipt;
        expect(receipt.storeVersion).toBe(MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION);
        expect(receipt.bindingContractVersion).toBe(MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION);
        expect(receipt.bindingId).toBe(
          `${MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID}::activation-900001::900001::${evidenceReceipt.artifactId}::${evidenceReceipt.sha256}`,
        );
        expect(receipt.gamePk).toBe(900001);
        expect(receipt.evidenceSha256).toBe(evidenceReceipt.sha256);

        // Direct read of final file
        const paths = resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths(root, receipt.bindingId);
        const directBytes = await fs.readFile(paths.bindingPath);
        const directSha256 = crypto.createHash('sha256').update(directBytes).digest('hex');
        const directLength = directBytes.byteLength;
        expect(directSha256).toBe(receipt.sha256);
        expect(directLength).toBe(receipt.byteLength);
        expect(directBytes.toString('utf-8')).toBe(
          canonicalSerializeGameIdentityBinding({
            contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
            protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
            activationId: 'activation-900001',
            authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
            gamePk: 900001,
            gameId: '900001',
            evidenceArtifactId: evidenceReceipt.artifactId,
            evidenceSha256: evidenceReceipt.sha256,
            evidenceArtifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
            evidenceStoreVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
            snapshotId: 'snapshot-1',
            officialDate: '2026-07-15',
            scheduledStartAt: FROZEN_SCHEDULED_START,
            scientificCutoffAt: SCIENTIFIC_CUTOFF,
            evidencePersistedAt: evidenceReceipt.persistedAt,
            persistedAt: bindingClock(),
          }),
        );
        expect(await countTempFiles(path.resolve(root, MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_DIRECTORY))).toBe(0);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('timing', () => {
    async function persistBindingWithClock(
      root: string,
      evidenceRoot: string,
      evidencePrepared: MLBProspectivePregameEvidencePrepared,
      evidenceReceipt: MLBProspectivePregameEvidenceReceipt,
      scheduleGame: Record<string, unknown>,
      clock: () => string,
    ): Promise<{ ok: boolean; receipt?: MLBProspectiveHoldoutGameIdentityBindingReceipt }> {
      const prepared = buildValidPreparedBinding(evidenceRoot, evidencePrepared, evidenceReceipt, scheduleGame);
      const result = await persistProspectiveHoldoutGameIdentityBinding(root, prepared, clock);
      return { ok: result.ok, receipt: result.ok ? result.receipt : undefined };
    }

    it('accepts binding persistedAt equal to evidence persistedAt', async () => {
      const root = await createTempRoot('mlb-binding-store-test-');
      try {
        const evidenceRoot = path.join(root, 'evidence');
        await fs.mkdir(evidenceRoot, { recursive: true });
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const { ok } = await persistBindingWithClock(root, evidenceRoot, evidencePrepared, evidenceReceipt, scheduleGame, () => FROZEN_DATA_CUTOFF);
        expect(ok).toBe(true);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('accepts binding after T-360 but before scheduled start', async () => {
      const root = await createTempRoot('mlb-binding-store-test-');
      try {
        const evidenceRoot = path.join(root, 'evidence');
        await fs.mkdir(evidenceRoot, { recursive: true });
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const { ok } = await persistBindingWithClock(root, evidenceRoot, evidencePrepared, evidenceReceipt, scheduleGame, () => '2026-07-15T06:30:00Z');
        expect(ok).toBe(true);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('rejects binding persistedAt equal to scheduledStartAt', async () => {
      const root = await createTempRoot('mlb-binding-store-test-');
      try {
        const evidenceRoot = path.join(root, 'evidence');
        await fs.mkdir(evidenceRoot, { recursive: true });
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const { ok } = await persistBindingWithClock(root, evidenceRoot, evidencePrepared, evidenceReceipt, scheduleGame, () => FROZEN_SCHEDULED_START);
        expect(ok).toBe(false);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('rejects binding persistedAt after scheduledStartAt', async () => {
      const root = await createTempRoot('mlb-binding-store-test-');
      try {
        const evidenceRoot = path.join(root, 'evidence');
        await fs.mkdir(evidenceRoot, { recursive: true });
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const { ok } = await persistBindingWithClock(root, evidenceRoot, evidencePrepared, evidenceReceipt, scheduleGame, () => '2026-07-15T13:00:00Z');
        expect(ok).toBe(false);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('rejects binding persistedAt before evidence persistedAt', async () => {
      const root = await createTempRoot('mlb-binding-store-test-');
      try {
        const evidenceRoot = path.join(root, 'evidence');
        await fs.mkdir(evidenceRoot, { recursive: true });
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const { ok } = await persistBindingWithClock(root, evidenceRoot, evidencePrepared, evidenceReceipt, scheduleGame, () => '2026-07-15T04:00:00Z');
        expect(ok).toBe(false);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('write-once', () => {
    it('rejects duplicate binding with BINDING_ALREADY_EXISTS', async () => {
      const root = await createTempRoot('mlb-binding-store-test-');
      try {
        const evidenceRoot = path.join(root, 'evidence');
        await fs.mkdir(evidenceRoot, { recursive: true });
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const prepared = buildValidPreparedBinding(evidenceRoot, evidencePrepared, evidenceReceipt, scheduleGame);
        const bindingClock = () => '2026-07-15T06:30:00Z';

        const first = await persistProspectiveHoldoutGameIdentityBinding(root, prepared, bindingClock);
        expect(first.ok).toBe(true);
        if (!first.ok) {
          throw new Error('First binding write failed');
        }

        const second = await persistProspectiveHoldoutGameIdentityBinding(root, prepared, bindingClock);
        expect(second.ok).toBe(false);
        if (!second.ok) {
          const exists = second.issues.find((i) => i.code === 'BINDING_ALREADY_EXISTS');
          expect(exists).toBeDefined();
        }

        // Original binding bytes unchanged
        const bindingId = computeBindingId({
          protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
          activationId: 'activation-900001',
          gamePk: 900001,
          evidenceArtifactId: evidenceReceipt.artifactId,
          evidenceSha256: evidenceReceipt.sha256,
        });
        const paths = resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths(root, bindingId);
        const directBytes = await fs.readFile(paths.bindingPath);
        expect(directBytes.byteLength).toBe(first.receipt.byteLength);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('concurrency', () => {
    it('allows exactly one success for concurrent same-binding writes', async () => {
      const root = await createTempRoot('mlb-binding-store-test-');
      try {
        const evidenceRoot = path.join(root, 'evidence');
        await fs.mkdir(evidenceRoot, { recursive: true });
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const prepared = buildValidPreparedBinding(evidenceRoot, evidencePrepared, evidenceReceipt, scheduleGame);
        const bindingClock = () => '2026-07-15T06:30:00Z';

        const [first, second] = await Promise.all([
          persistProspectiveHoldoutGameIdentityBinding(root, prepared, bindingClock),
          persistProspectiveHoldoutGameIdentityBinding(root, prepared, bindingClock),
        ]);

        const successes = [first, second].filter((r) => r.ok).length;
        const alreadyExists = [first, second].filter(
          (r) => !r.ok && r.issues.some((i) => i.code === 'BINDING_ALREADY_EXISTS'),
        ).length;
        const otherFailures = [first, second].filter(
          (r) => !r.ok && !r.issues.some((i) => i.code === 'BINDING_ALREADY_EXISTS'),
        ).length;

        expect(successes).toBe(1);
        expect(alreadyExists).toBe(1);
        expect(otherFailures).toBe(0);
        expect(await countBindings(path.resolve(root, MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_DIRECTORY))).toBe(1);
        expect(await countTempFiles(path.resolve(root, MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_DIRECTORY))).toBe(0);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('different bindings', () => {
    it('persists two independent bindings without collision', async () => {
      const root = await createTempRoot('mlb-binding-store-test-');
      try {
        const evidenceRoot = path.join(root, 'evidence');
        await fs.mkdir(evidenceRoot, { recursive: true });

        // First identity
        const evidencePrepared1 = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt1 = await persistSyntheticEvidence(evidenceRoot, evidencePrepared1, evidenceClock);
        const scheduleGame1 = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };
        const prepared1 = buildValidPreparedBinding(evidenceRoot, evidencePrepared1, evidenceReceipt1, scheduleGame1);

        // Second identity
        const evidencePrepared2 = buildValidPreparedEvidence({
          game: { gameId: '900002' },
          snapshotId: 'snapshot-2',
        });
        const evidenceReceipt2 = await persistSyntheticEvidence(evidenceRoot, evidencePrepared2, evidenceClock);
        const scheduleGame2 = {
          gamePk: 900002,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };
        const prepared2 = buildValidPreparedBinding(evidenceRoot, evidencePrepared2, evidenceReceipt2, scheduleGame2);

        const bindingClock = () => '2026-07-15T06:30:00Z';
        const [first, second] = await Promise.all([
          persistProspectiveHoldoutGameIdentityBinding(root, prepared1, bindingClock),
          persistProspectiveHoldoutGameIdentityBinding(root, prepared2, bindingClock),
        ]);

        expect(first.ok).toBe(true);
        expect(second.ok).toBe(true);
        if (first.ok && second.ok) {
          expect(first.receipt.bindingId).not.toBe(second.receipt.bindingId);
          expect(first.receipt.relativePath).not.toBe(second.receipt.relativePath);
          expect(first.receipt.evidenceSha256).toBe(evidenceReceipt1.sha256);
          expect(second.receipt.evidenceSha256).toBe(evidenceReceipt2.sha256);
          expect(first.receipt.gamePk).toBe(scheduleGame1.gamePk);
          expect(second.receipt.gamePk).toBe(scheduleGame2.gamePk);
        }

        const bindingDir = path.resolve(root, MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_DIRECTORY);
        expect(await countBindings(bindingDir)).toBe(2);
        expect(await countTempFiles(bindingDir)).toBe(0);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('read-back', () => {
    it('reads back a valid persisted binding', async () => {
      const root = await createTempRoot('mlb-binding-store-test-');
      try {
        const evidenceRoot = path.join(root, 'evidence');
        await fs.mkdir(evidenceRoot, { recursive: true });
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const prepared = buildValidPreparedBinding(evidenceRoot, evidencePrepared, evidenceReceipt, scheduleGame);
        const bindingClock = () => '2026-07-15T06:30:00Z';
        const writeResult = await persistProspectiveHoldoutGameIdentityBinding(root, prepared, bindingClock);
        expect(writeResult.ok).toBe(true);
        if (!writeResult.ok) return;

        const readResult = await readProspectiveHoldoutGameIdentityBinding(root, writeResult.receipt.bindingId);
        expect(readResult.ok).toBe(true);
        if (!readResult.ok) return;
        expect(readResult.value.gamePk).toBe(900001);
        expect(readResult.value.gameId).toBe('900001');
        expect(readResult.receipt.sha256).toBe(writeResult.receipt.sha256);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('fails for missing binding', async () => {
      const root = await createTempRoot('mlb-binding-store-test-');
      try {
        const result = await readProspectiveHoldoutGameIdentityBinding(root, 'missing-binding-id');
        expect(result.ok).toBe(false);
        if (!result.ok) {
          const missing = result.issues.find((i) => i.code === 'BINDING_MISSING');
          expect(missing).toBeDefined();
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('fails for tampered JSON', async () => {
      const root = await createTempRoot('mlb-binding-store-test-');
      try {
        const evidenceRoot = path.join(root, 'evidence');
        await fs.mkdir(evidenceRoot, { recursive: true });
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const prepared = buildValidPreparedBinding(evidenceRoot, evidencePrepared, evidenceReceipt, scheduleGame);
        const bindingClock = () => '2026-07-15T06:30:00Z';
        const writeResult = await persistProspectiveHoldoutGameIdentityBinding(root, prepared, bindingClock);
        expect(writeResult.ok).toBe(true);
        if (!writeResult.ok) return;

        const bindingId = writeResult.receipt.bindingId;
        const paths = resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths(root, bindingId);
        await fs.writeFile(paths.bindingPath, 'not-json', 'utf-8');

        const readResult = await readProspectiveHoldoutGameIdentityBinding(root, bindingId);
        expect(readResult.ok).toBe(false);
        if (!readResult.ok) {
          const jsonInvalid = readResult.issues.find((i) => i.code === 'BINDING_JSON_INVALID');
          expect(jsonInvalid).toBeDefined();
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('fails for contract-invalid JSON', async () => {
      const root = await createTempRoot('mlb-binding-store-test-');
      try {
        const evidenceRoot = path.join(root, 'evidence');
        await fs.mkdir(evidenceRoot, { recursive: true });
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const prepared = buildValidPreparedBinding(evidenceRoot, evidencePrepared, evidenceReceipt, scheduleGame);
        const bindingClock = () => '2026-07-15T06:30:00Z';
        const writeResult = await persistProspectiveHoldoutGameIdentityBinding(root, prepared, bindingClock);
        expect(writeResult.ok).toBe(true);
        if (!writeResult.ok) return;

        const bindingId = writeResult.receipt.bindingId;
        const paths = resolveMLBProspectiveHoldoutGameIdentityBindingArtifactPaths(root, bindingId);
        const raw = await fs.readFile(paths.bindingPath, 'utf-8');
        const parsed = JSON.parse(raw);
        parsed.gamePk = -1;
        await fs.writeFile(paths.bindingPath, JSON.stringify(parsed), 'utf-8');

        const readResult = await readProspectiveHoldoutGameIdentityBinding(root, bindingId);
        expect(readResult.ok).toBe(false);
        if (!readResult.ok) {
          const contractInvalid = readResult.issues.find((i) => i.code === 'BINDING_CONTRACT_INVALID');
          expect(contractInvalid).toBeDefined();
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('non-mutation', () => {
    it('does not mutate caller objects during success', async () => {
      const root = await createTempRoot('mlb-binding-store-test-');
      try {
        const evidenceRoot = path.join(root, 'evidence');
        await fs.mkdir(evidenceRoot, { recursive: true });
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const evidenceCopy = JSON.parse(JSON.stringify(evidencePrepared));
        const receiptCopy = { ...evidenceReceipt };
        const scheduleGameCopy = { ...scheduleGame };

        const prepared = buildValidPreparedBinding(evidenceRoot, evidencePrepared, evidenceReceipt, scheduleGame);
        const bindingClock = () => '2026-07-15T06:30:00Z';
        await persistProspectiveHoldoutGameIdentityBinding(root, prepared, bindingClock);

        expect(evidencePrepared).toEqual(evidenceCopy);
        expect(evidenceReceipt).toEqual(receiptCopy);
        expect(scheduleGame).toEqual(scheduleGameCopy);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('does not mutate caller objects on duplicate write', async () => {
      const root = await createTempRoot('mlb-binding-store-test-');
      try {
        const evidenceRoot = path.join(root, 'evidence');
        await fs.mkdir(evidenceRoot, { recursive: true });
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const evidenceCopy = JSON.parse(JSON.stringify(evidencePrepared));
        const receiptCopy = { ...evidenceReceipt };
        const scheduleGameCopy = { ...scheduleGame };

        const prepared = buildValidPreparedBinding(evidenceRoot, evidencePrepared, evidenceReceipt, scheduleGame);
        const bindingClock = () => '2026-07-15T06:30:00Z';
        const first = await persistProspectiveHoldoutGameIdentityBinding(root, prepared, bindingClock);
        expect(first.ok).toBe(true);
        await persistProspectiveHoldoutGameIdentityBinding(root, prepared, bindingClock);

        expect(evidencePrepared).toEqual(evidenceCopy);
        expect(evidenceReceipt).toEqual(receiptCopy);
        expect(scheduleGame).toEqual(scheduleGameCopy);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('does not mutate caller objects on timing failure', async () => {
      const root = await createTempRoot('mlb-binding-store-test-');
      try {
        const evidenceRoot = path.join(root, 'evidence');
        await fs.mkdir(evidenceRoot, { recursive: true });
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const evidenceCopy = JSON.parse(JSON.stringify(evidencePrepared));
        const receiptCopy = { ...evidenceReceipt };
        const scheduleGameCopy = { ...scheduleGame };

        const prepared = buildValidPreparedBinding(evidenceRoot, evidencePrepared, evidenceReceipt, scheduleGame);
        const bindingClock = () => '2026-07-15T13:00:00Z';
        await persistProspectiveHoldoutGameIdentityBinding(root, prepared, bindingClock);

        expect(evidencePrepared).toEqual(evidenceCopy);
        expect(evidenceReceipt).toEqual(receiptCopy);
        expect(scheduleGame).toEqual(scheduleGameCopy);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });
});
