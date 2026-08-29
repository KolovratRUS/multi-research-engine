import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_FAILURE_CODES,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_DIRECTORY,
  computeBindingId,
  canonicalSerializeGameIdentityBinding,
  validateMLBProspectiveHoldoutGameIdentityBindingPrepared,
  validateMLBProspectiveHoldoutGameIdentityBinding,
  type MLBProspectiveHoldoutGameIdentityBindingPrepared,
  type MLBProspectiveHoldoutGameIdentityBinding,
  type MLBProspectiveHoldoutGameIdentityBindingReceipt,
  type MLBProspectiveHoldoutGameIdentityBindingIssue,
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
  const base = {
    contractVersion: MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
    sport: 'MLB' as const,
    target: 'OFFICIAL_FINAL_GAME_WINNER' as const,
    snapshotId: 'snapshot-1',
    capturedAt: FROZEN_DATA_CUTOFF,
    dataCutoffAt: FROZEN_DATA_CUTOFF,
    game: {
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
    },
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
    ...overrides,
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

function buildValidPreparedEvidence(overrides: Record<string, unknown> = {}): MLBProspectivePregameEvidencePrepared {
  const snapshot = buildValidSnapshotObject();
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

  return { ...base, ...overrides } as MLBProspectivePregameEvidencePrepared;
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
  overrides: Record<string, unknown> = {},
): MLBProspectiveHoldoutGameIdentityBindingPrepared {
  const evidencePrepared = buildValidPreparedEvidence();
  const scheduleGame = {
    gamePk: 900001,
    officialDate: '2026-07-15',
    startTimeUtc: new Date(FROZEN_SCHEDULED_START),
  };

  const base: MLBProspectiveHoldoutGameIdentityBindingPrepared = {
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: 'activation-900001',
    authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
    scheduleGame,
    evidence: withPersistedAt(evidencePrepared, FROZEN_DATA_CUTOFF),
    evidenceReceipt: {
      storeVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
      artifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
      artifactId: 'mlb-prospective-holdout-protocol-v1::activation-900001::900001::snapshot-1::2026-07-15T06:00:00.000Z',
      protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
      activationId: 'activation-900001',
      gameId: '900001',
      snapshotId: 'snapshot-1',
      relativePath: 'abc123.json',
      sha256: '',
      byteLength: 0,
      persistedAt: FROZEN_DATA_CUTOFF,
    },
  };

  // Compute real evidence receipt values
  const evidenceValidation = validateMLBProspectivePregameEvidence(base.evidence);
  expect(evidenceValidation.ok).toBe(true);
  if (!evidenceValidation.ok) {
    throw new Error('Invalid evidence');
  }
  const expectedBytes = Buffer.from(
    JSON.stringify(
      Object.getOwnPropertyNames(base.evidence)
        .sort()
        .reduce((obj, key) => { obj[key] = base.evidence[key as keyof MLBProspectivePregameEvidence]; return obj; }, {} as Record<string, unknown>),
    ),
    'utf8',
  );
  const expectedSha256 = crypto.createHash('sha256').update(expectedBytes).digest('hex');

  return {
    ...base,
    evidenceReceipt: {
      ...base.evidenceReceipt,
      sha256: expectedSha256,
      byteLength: expectedBytes.byteLength,
    },
  } as MLBProspectiveHoldoutGameIdentityBindingPrepared;
}

describe('mlb-prospective-holdout-game-identity-binding-contract', () => {
  describe('contract versions', () => {
    it('exports the binding contract version', () => {
      expect(MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION).toBe('mlb-prospective-holdout-game-identity-binding-v1');
    });

    it('exports the binding store version', () => {
      expect(MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION).toBe('mlb-prospective-holdout-game-identity-binding-store-v1');
    });

    it('exports the binding store directory', () => {
      expect(MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_DIRECTORY).toBe('var/mlb-development/mlb-prospective-holdout-game-identity-bindings');
    });

    it('exports all failure codes', () => {
      expect(MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_FAILURE_CODES).toEqual([
        'INVALID_BINDING_INPUT',
        'SCHEDULE_GAME_VALIDATION_FAILED',
        'GAME_PK_EVIDENCE_IDENTITY_MISMATCH',
        'SOURCE_CROSSCHECK_MISMATCH',
        'EVIDENCE_REVALIDATION_FAILED',
        'ARTIFACT_ID_MISMATCH',
        'RECEIPT_SHA_MISMATCH',
        'RECEIPT_BYTE_LENGTH_MISMATCH',
        'INVALID_PERSISTED_AT',
        'BINDING_TIMING_VIOLATION',
        'BINDING_ALREADY_EXISTS',
        'WRITE_FAILED',
        'HASH_VERIFICATION_FAILED',
        'TEMPORARY_FILE_CLEANUP_FAILED',
        'PROHIBITED_FIELD',
        'MISSING_FIELD',
        'IDENTITY_MISMATCH',
        'INVALID_STRING',
        'INVALID_DATE',
        'INVALID_TIMESTAMP',
        'INVALID_JSON_VALUE',
      ]);
    });
  });

  describe('canonicalSerializeGameIdentityBinding', () => {
    it('produces deterministic sorted JSON for a validated binding', () => {
      const binding: MLBProspectiveHoldoutGameIdentityBinding = {
        contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: 'activation-1',
        authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
        gamePk: 900001,
        gameId: '900001',
        evidenceArtifactId: 'aid-1',
        evidenceSha256: 'sha256-1',
        evidenceArtifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
        evidenceStoreVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
        snapshotId: 'snap-1',
        officialDate: '2026-07-15',
        scheduledStartAt: FROZEN_SCHEDULED_START,
        scientificCutoffAt: SCIENTIFIC_CUTOFF,
        evidencePersistedAt: FROZEN_DATA_CUTOFF,
        persistedAt: FROZEN_DATA_CUTOFF,
      };
      const first = canonicalSerializeGameIdentityBinding(binding);
      const second = canonicalSerializeGameIdentityBinding(binding);
      expect(first).toBe(second);
      expect(JSON.parse(first)).toEqual(binding);
    });

    it('preserves array order', () => {
      const binding: MLBProspectiveHoldoutGameIdentityBinding = {
        contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: 'activation-1',
        authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
        gamePk: 900001,
        gameId: '900001',
        evidenceArtifactId: 'aid-1',
        evidenceSha256: 'sha256-1',
        evidenceArtifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
        evidenceStoreVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
        snapshotId: 'snap-1',
        officialDate: '2026-07-15',
        scheduledStartAt: FROZEN_SCHEDULED_START,
        scientificCutoffAt: SCIENTIFIC_CUTOFF,
        evidencePersistedAt: FROZEN_DATA_CUTOFF,
        persistedAt: FROZEN_DATA_CUTOFF,
      };
      const serialized = canonicalSerializeGameIdentityBinding(binding);
      expect(serialized).toContain('"gameId":"900001"');
      expect(serialized).not.toContain('undefined');
      expect(serialized).not.toContain('function');
    });

    it('throws on non-plain input', () => {
      expect(() => Reflect.apply(canonicalSerializeGameIdentityBinding, null, []))
        .toThrow(TypeError);
    });
  });

  describe('computeBindingId', () => {
    it('returns the same id for identical immutable identity', () => {
      const first = computeBindingId({
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: 'a-1',
        gamePk: 900001,
        evidenceArtifactId: 'aid-1',
        evidenceSha256: 'sha-1',
      });
      const second = computeBindingId({
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: 'a-1',
        gamePk: 900001,
        evidenceArtifactId: 'aid-1',
        evidenceSha256: 'sha-1',
      });
      expect(first).toBe(second);
    });

    it('returns different ids when gamePk differs', () => {
      const first = computeBindingId({
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: 'a-1',
        gamePk: 900001,
        evidenceArtifactId: 'aid-1',
        evidenceSha256: 'sha-1',
      });
      const second = computeBindingId({
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: 'a-1',
        gamePk: 900002,
        evidenceArtifactId: 'aid-1',
        evidenceSha256: 'sha-1',
      });
      expect(first).not.toBe(second);
    });

    it('returns different ids when evidenceSha256 differs', () => {
      const first = computeBindingId({
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: 'a-1',
        gamePk: 900001,
        evidenceArtifactId: 'aid-1',
        evidenceSha256: 'sha-1',
      });
      const second = computeBindingId({
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: 'a-1',
        gamePk: 900001,
        evidenceArtifactId: 'aid-1',
        evidenceSha256: 'sha-2',
      });
      expect(first).not.toBe(second);
    });

    it('does not change when persistedAt differs', () => {
      const first = computeBindingId({
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: 'a-1',
        gamePk: 900001,
        evidenceArtifactId: 'aid-1',
        evidenceSha256: 'sha-1',
      });
      const second = computeBindingId({
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: 'a-1',
        gamePk: 900001,
        evidenceArtifactId: 'aid-1',
        evidenceSha256: 'sha-1',
      });
      expect(first).toBe(second);
    });
  });

  describe('validateMLBProspectiveHoldoutGameIdentityBindingPrepared', () => {
    it('accepts a valid prepared binding derived from scheduleGame', async () => {
      const evidenceRoot = await createTempRoot('mlb-binding-contract-evidence-');
      try {
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const prepared: MLBProspectiveHoldoutGameIdentityBindingPrepared = {
          contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
          protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
          activationId: 'activation-900001',
          authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
          scheduleGame,
          evidence: withPersistedAt(evidencePrepared, evidenceReceipt.persistedAt),
          evidenceReceipt,
        };

        const result = validateMLBProspectiveHoldoutGameIdentityBindingPrepared(prepared);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.gamePk).toBe(900001);
          expect(result.value.gameId).toBe('900001');
          expect(result.value.evidenceSha256).toBe(evidenceReceipt.sha256);
        }
      } finally {
        await fs.rm(evidenceRoot, { recursive: true, force: true });
      }
    });

    it('rejects top-level injected gamePk', async () => {
      const evidenceRoot = await createTempRoot('mlb-binding-contract-evidence-');
      try {
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const prepared = {
          contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
          protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
          activationId: 'activation-900001',
          authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
          scheduleGame,
          evidence: withPersistedAt(evidencePrepared, evidenceReceipt.persistedAt),
          evidenceReceipt,
          gamePk: 900002,
        };

        const result = validateMLBProspectiveHoldoutGameIdentityBindingPrepared(prepared);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          const prohibited = result.issues.find((i) => i.path === '$.gamePk');
          expect(prohibited).toBeDefined();
        }
      } finally {
        await fs.rm(evidenceRoot, { recursive: true, force: true });
      }
    });

    it('rejects gamePk/evidence gameId mismatch', async () => {
      const evidenceRoot = await createTempRoot('mlb-binding-contract-evidence-');
      try {
        const evidencePrepared = buildValidPreparedEvidence({ gameId: '900001' });
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900002,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const prepared: MLBProspectiveHoldoutGameIdentityBindingPrepared = {
          contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
          protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
          activationId: 'activation-900001',
          authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
          scheduleGame,
          evidence: withPersistedAt(evidencePrepared, evidenceReceipt.persistedAt),
          evidenceReceipt,
        };

        const result = validateMLBProspectiveHoldoutGameIdentityBindingPrepared(prepared);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          const mismatch = result.issues.find((i) => i.code === 'GAME_PK_EVIDENCE_IDENTITY_MISMATCH');
          expect(mismatch).toBeDefined();
        }
      } finally {
        await fs.rm(evidenceRoot, { recursive: true, force: true });
      }
    });

    it('rejects source/evidence officialDate mismatch', async () => {
      const evidenceRoot = await createTempRoot('mlb-binding-contract-evidence-');
      try {
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-16',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const prepared: MLBProspectiveHoldoutGameIdentityBindingPrepared = {
          contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
          protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
          activationId: 'activation-900001',
          authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
          scheduleGame,
          evidence: withPersistedAt(evidencePrepared, evidenceReceipt.persistedAt),
          evidenceReceipt,
        };

        const result = validateMLBProspectiveHoldoutGameIdentityBindingPrepared(prepared);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          const mismatch = result.issues.find((i) => i.code === 'SOURCE_CROSSCHECK_MISMATCH');
          expect(mismatch).toBeDefined();
        }
      } finally {
        await fs.rm(evidenceRoot, { recursive: true, force: true });
      }
    });

    it('rejects source/evidence scheduledStartAt mismatch', async () => {
      const evidenceRoot = await createTempRoot('mlb-binding-contract-evidence-');
      try {
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date('2026-07-15T13:00:00Z'),
        };

        const prepared: MLBProspectiveHoldoutGameIdentityBindingPrepared = {
          contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
          protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
          activationId: 'activation-900001',
          authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
          scheduleGame,
          evidence: withPersistedAt(evidencePrepared, evidenceReceipt.persistedAt),
          evidenceReceipt,
        };

        const result = validateMLBProspectiveHoldoutGameIdentityBindingPrepared(prepared);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          const mismatch = result.issues.find((i) => i.code === 'SOURCE_CROSSCHECK_MISMATCH');
          expect(mismatch).toBeDefined();
        }
      } finally {
        await fs.rm(evidenceRoot, { recursive: true, force: true });
      }
    });
  });

  describe('H receipt identity tampering', () => {
    it('rejects tampered artifactId', async () => {
      const evidenceRoot = await createTempRoot('mlb-binding-contract-evidence-');
      try {
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const tamperedReceipt = {
          ...evidenceReceipt,
          artifactId: 'tampered-artifact-id',
        };

        const prepared: MLBProspectiveHoldoutGameIdentityBindingPrepared = {
          contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
          protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
          activationId: 'activation-900001',
          authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
          scheduleGame,
          evidence: withPersistedAt(evidencePrepared, evidenceReceipt.persistedAt),
          evidenceReceipt: tamperedReceipt,
        };

        const result = validateMLBProspectiveHoldoutGameIdentityBindingPrepared(prepared);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          const mismatch = result.issues.find((i) => i.code === 'ARTIFACT_ID_MISMATCH');
          expect(mismatch).toBeDefined();
        }
      } finally {
        await fs.rm(evidenceRoot, { recursive: true, force: true });
      }
    });

    it('rejects tampered sha256', async () => {
      const evidenceRoot = await createTempRoot('mlb-binding-contract-evidence-');
      try {
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const tamperedReceipt = {
          ...evidenceReceipt,
          sha256: '0'.repeat(64),
        };

        const prepared: MLBProspectiveHoldoutGameIdentityBindingPrepared = {
          contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
          protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
          activationId: 'activation-900001',
          authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
          scheduleGame,
          evidence: withPersistedAt(evidencePrepared, evidenceReceipt.persistedAt),
          evidenceReceipt: tamperedReceipt,
        };

        const result = validateMLBProspectiveHoldoutGameIdentityBindingPrepared(prepared);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          const mismatch = result.issues.find((i) => i.code === 'RECEIPT_SHA_MISMATCH');
          expect(mismatch).toBeDefined();
        }
      } finally {
        await fs.rm(evidenceRoot, { recursive: true, force: true });
      }
    });

    it('rejects tampered byteLength', async () => {
      const evidenceRoot = await createTempRoot('mlb-binding-contract-evidence-');
      try {
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const tamperedReceipt = {
          ...evidenceReceipt,
          byteLength: 999999,
        };

        const prepared: MLBProspectiveHoldoutGameIdentityBindingPrepared = {
          contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
          protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
          activationId: 'activation-900001',
          authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
          scheduleGame,
          evidence: withPersistedAt(evidencePrepared, evidenceReceipt.persistedAt),
          evidenceReceipt: tamperedReceipt,
        };

        const result = validateMLBProspectiveHoldoutGameIdentityBindingPrepared(prepared);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          const mismatch = result.issues.find((i) => i.code === 'RECEIPT_BYTE_LENGTH_MISMATCH');
          expect(mismatch).toBeDefined();
        }
      } finally {
        await fs.rm(evidenceRoot, { recursive: true, force: true });
      }
    });

    it('rejects tampered persistedAt', async () => {
      const evidenceRoot = await createTempRoot('mlb-binding-contract-evidence-');
      try {
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const tamperedReceipt = {
          ...evidenceReceipt,
          persistedAt: '2026-07-15T04:00:00Z',
        };

        const prepared: MLBProspectiveHoldoutGameIdentityBindingPrepared = {
          contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
          protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
          activationId: 'activation-900001',
          authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
          scheduleGame,
          evidence: withPersistedAt(evidencePrepared, evidenceReceipt.persistedAt),
          evidenceReceipt: tamperedReceipt,
        };

        const result = validateMLBProspectiveHoldoutGameIdentityBindingPrepared(prepared);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          const mismatch = result.issues.find((i) => i.code === 'ARTIFACT_ID_MISMATCH');
          expect(mismatch).toBeDefined();
        }
      } finally {
        await fs.rm(evidenceRoot, { recursive: true, force: true });
      }
    });

    it('rejects tampered storeVersion', async () => {
      const evidenceRoot = await createTempRoot('mlb-binding-contract-evidence-');
      try {
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const tamperedReceipt = JSON.parse(JSON.stringify(evidenceReceipt)) as Record<string, unknown>;
        tamperedReceipt.storeVersion = 'tampered-store-version';

        const prepared = {
          contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
          protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
          activationId: 'activation-900001',
          authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
          scheduleGame,
          evidence: withPersistedAt(evidencePrepared, evidenceReceipt.persistedAt),
          evidenceReceipt: tamperedReceipt,
        };

        const result = validateMLBProspectiveHoldoutGameIdentityBindingPrepared(prepared);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          const mismatch = result.issues.find((i) => i.code === 'ARTIFACT_ID_MISMATCH');
          expect(mismatch).toBeDefined();
        }
      } finally {
        await fs.rm(evidenceRoot, { recursive: true, force: true });
      }
    });
  });

  describe('H evidence tampering', () => {
    it('rejects tampered evidence with original receipt via revalidation', async () => {
      const evidenceRoot = await createTempRoot('mlb-binding-contract-evidence-');
      try {
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        // Tamper evidence by changing rawSnapshot gameId
        const mutableSnapshot = JSON.parse(JSON.stringify(evidencePrepared.rawSnapshot)) as Record<string, unknown>;
        mutableSnapshot.game = { ...(mutableSnapshot.game as Record<string, unknown>), gameId: '999999' };
        const tamperedEvidence = {
          ...evidencePrepared,
          rawSnapshot: mutableSnapshot,
          persistedAt: evidenceReceipt.persistedAt,
        };

        const prepared: unknown = {
          contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
          protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
          activationId: 'activation-900001',
          authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
          scheduleGame,
          evidence: tamperedEvidence,
          evidenceReceipt,
        };

        const result = validateMLBProspectiveHoldoutGameIdentityBindingPrepared(prepared);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          const revalidation = result.issues.find((i) => i.code === 'EVIDENCE_REVALIDATION_FAILED');
          expect(revalidation).toBeDefined();
        }
      } finally {
        await fs.rm(evidenceRoot, { recursive: true, force: true });
      }
    });
  });

  describe('hostile keys', () => {
    it('rejects unknown enumerable keys', async () => {
      const evidenceRoot = await createTempRoot('mlb-binding-contract-evidence-');
      try {
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const base = {
          contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
          protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
          activationId: 'activation-900001',
          authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
          scheduleGame,
          evidence: withPersistedAt(evidencePrepared, evidenceReceipt.persistedAt),
          evidenceReceipt,
        };
        const prepared = { ...base, winner: 'home' };

        const result = validateMLBProspectiveHoldoutGameIdentityBindingPrepared(prepared);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          const prohibited = result.issues.find((i) => i.path === '$.winner');
          expect(prohibited).toBeDefined();
        }
      } finally {
        await fs.rm(evidenceRoot, { recursive: true, force: true });
      }
    });

    it('rejects symbol keys', async () => {
      const evidenceRoot = await createTempRoot('mlb-binding-contract-evidence-');
      try {
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const sym = Symbol('bad');
        const prepared: unknown = {
          contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
          protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
          activationId: 'activation-900001',
          authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
          scheduleGame,
          evidence: withPersistedAt(evidencePrepared, evidenceReceipt.persistedAt),
          evidenceReceipt,
          [sym]: 'bad',
        };

        const result = validateMLBProspectiveHoldoutGameIdentityBindingPrepared(prepared);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          const symbolIssue = result.issues.find((i) => i.path === `$[${String(sym)}]`);
          expect(symbolIssue).toBeDefined();
        }
      } finally {
        await fs.rm(evidenceRoot, { recursive: true, force: true });
      }
    });

    it('rejects accessor properties', async () => {
      const evidenceRoot = await createTempRoot('mlb-binding-contract-evidence-');
      try {
        const evidencePrepared = buildValidPreparedEvidence();
        const evidenceClock = () => FROZEN_DATA_CUTOFF;
        const evidenceReceipt = await persistSyntheticEvidence(evidenceRoot, evidencePrepared, evidenceClock);

        const scheduleGame = {
          gamePk: 900001,
          officialDate: '2026-07-15',
          startTimeUtc: new Date(FROZEN_SCHEDULED_START),
        };

        const prepared: unknown = {
          contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
          protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
          activationId: 'activation-900001',
          authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
          scheduleGame,
          evidence: withPersistedAt(evidencePrepared, evidenceReceipt.persistedAt),
          evidenceReceipt,
          get winner() { return 'home'; },
        };

        const result = validateMLBProspectiveHoldoutGameIdentityBindingPrepared(prepared);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          const accessor = result.issues.find((i) => i.path === '$.winner');
          expect(accessor).toBeDefined();
        }
      } finally {
        await fs.rm(evidenceRoot, { recursive: true, force: true });
      }
    });
  });

  describe('persisted binding rejects preparation fields', () => {
    it('rejects persisted binding with injected scheduleGame', () => {
      const persisted: MLBProspectiveHoldoutGameIdentityBinding = {
        contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: 'activation-900001',
        authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
        gamePk: 900001,
        gameId: '900001',
        evidenceArtifactId: 'aid-1',
        evidenceSha256: 'sha-1',
        evidenceArtifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
        evidenceStoreVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
        snapshotId: 'snapshot-1',
        officialDate: '2026-07-15',
        scheduledStartAt: FROZEN_SCHEDULED_START,
        scientificCutoffAt: SCIENTIFIC_CUTOFF,
        evidencePersistedAt: FROZEN_DATA_CUTOFF,
        persistedAt: FROZEN_DATA_CUTOFF,
      };

      const hostile: Record<string, unknown> = {
        ...persisted,
        scheduleGame: { gamePk: 900001 },
      };
      const result = validateMLBProspectiveHoldoutGameIdentityBinding(hostile);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const scheduleGameField = result.issues.find((i) => i.path === '$.scheduleGame');
        expect(scheduleGameField).toBeDefined();
      }
    });

    it('rejects persisted binding with injected evidence', () => {
      const persisted: MLBProspectiveHoldoutGameIdentityBinding = {
        contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: 'activation-900001',
        authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
        gamePk: 900001,
        gameId: '900001',
        evidenceArtifactId: 'aid-1',
        evidenceSha256: 'sha-1',
        evidenceArtifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
        evidenceStoreVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
        snapshotId: 'snapshot-1',
        officialDate: '2026-07-15',
        scheduledStartAt: FROZEN_SCHEDULED_START,
        scientificCutoffAt: SCIENTIFIC_CUTOFF,
        evidencePersistedAt: FROZEN_DATA_CUTOFF,
        persistedAt: FROZEN_DATA_CUTOFF,
      };

      const hostile: Record<string, unknown> = {
        ...persisted,
        evidence: {},
      };
      const result = validateMLBProspectiveHoldoutGameIdentityBinding(hostile);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const evidenceField = result.issues.find((i) => i.path === '$.evidence');
        expect(evidenceField).toBeDefined();
      }
    });

    it('rejects persisted binding with injected evidenceReceipt', () => {
      const persisted: MLBProspectiveHoldoutGameIdentityBinding = {
        contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
        protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
        activationId: 'activation-900001',
        authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
        gamePk: 900001,
        gameId: '900001',
        evidenceArtifactId: 'aid-1',
        evidenceSha256: 'sha-1',
        evidenceArtifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
        evidenceStoreVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
        snapshotId: 'snapshot-1',
        officialDate: '2026-07-15',
        scheduledStartAt: FROZEN_SCHEDULED_START,
        scientificCutoffAt: SCIENTIFIC_CUTOFF,
        evidencePersistedAt: FROZEN_DATA_CUTOFF,
        persistedAt: FROZEN_DATA_CUTOFF,
      };

      const hostile: Record<string, unknown> = {
        ...persisted,
        evidenceReceipt: {},
      };
      const result = validateMLBProspectiveHoldoutGameIdentityBinding(hostile);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const receiptField = result.issues.find((i) => i.path === '$.evidenceReceipt');
        expect(receiptField).toBeDefined();
      }
    });
  });
});
