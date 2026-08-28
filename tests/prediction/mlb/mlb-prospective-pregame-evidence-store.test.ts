import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  persistProspectivePregameEvidence,
  readProspectivePregameEvidence,
  resolveMLBProspectivePregameEvidenceArtifactPaths,
  resolveMLBProspectivePregameEvidenceStorePaths,
  deriveArtifactRelativePath,
  generateUniqueTempArtifactPath,
  type MLBProspectivePregameEvidenceClockReader,
} from '@/prediction/mlb/mlb-prospective-pregame-evidence-store';
import {
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_DIRECTORY,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_FAILURE_CODES,
  validateMLBProspectivePregameEvidencePrepared,
  computeArtifactId,
  canonicalSerialize,
  type MLBProspectivePregameEvidencePrepared,
  type MLBProspectivePregameEvidence,
  type MLBProspectivePregameEvidenceIssue,
} from '@/prediction/mlb/mlb-prospective-pregame-evidence-artifact-contract';
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
      gameId: 'game-1',
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
        sectionId: 'section-away-batting',
        kind: 'TEAM_SEASON_CONTEXT' as const,
        entity: { scope: 'AWAY_TEAM' as const, entityId: null },
        payload: { seasonStats: { runsAllowedPerGame: 3, runsScoredPerGame: 4, winRate: 6 } },
      }),
      buildSection({
        sectionId: 'section-away-bullpen',
        kind: 'BULLPEN_CONTEXT' as const,
        entity: { scope: 'AWAY_TEAM' as const, entityId: null },
        payload: { recentWorkload: { extraInningGames: 1, gamesInPrevious3Days: 2 } },
      }),
      buildSection({
        sectionId: 'section-away-starter',
        kind: 'STARTING_PITCHER_CONTEXT' as const,
        entity: { scope: 'AWAY_STARTER' as const, entityId: null },
        payload: { availability: 5 },
      }),
      buildSection({
        sectionId: 'section-game-context',
        kind: 'GAME_CONTEXT' as const,
        entity: { scope: 'GAME' as const, entityId: null },
        payload: { doubleHeaderGameNumber: 7, scheduledInnings: 14 },
      }),
      buildSection({
        sectionId: 'section-home-batting',
        kind: 'TEAM_SEASON_CONTEXT' as const,
        entity: { scope: 'HOME_TEAM' as const, entityId: null },
        payload: { seasonStats: { runsAllowedPerGame: 10, runsScoredPerGame: 11, winRate: 13 } },
      }),
      buildSection({
        sectionId: 'section-home-bullpen',
        kind: 'BULLPEN_CONTEXT' as const,
        entity: { scope: 'HOME_TEAM' as const, entityId: null },
        payload: { recentWorkload: { extraInningGames: 8, gamesInPrevious3Days: 9 } },
      }),
      buildSection({
        sectionId: 'section-home-starter',
        kind: 'STARTING_PITCHER_CONTEXT' as const,
        entity: { scope: 'HOME_STARTER' as const, entityId: null },
        payload: { availability: 12 },
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

function buildValidPrepared(overrides: Record<string, unknown> = {}): MLBProspectivePregameEvidencePrepared {
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
    activationId: 'activation-1',
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
  const artifact: MLBProspectivePregameEvidence = {
    ...prepared,
    persistedAt,
  };
  return artifact;
}

async function createTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'mlb-prospective-pregame-evidence-store-test-'));
}

describe('mlb-prospective-pregame-evidence-store', () => {
  describe('fixture invariants', () => {
    it('computes scientific cutoff exactly T-360 from scheduled start', () => {
      expect(SCIENTIFIC_CUTOFF).toBe('2026-07-15T06:00:00.000Z');
      expect(SCIENTIFIC_CUTOFF).not.toBe(FROZEN_SCHEDULED_START);
    });
  });

  describe('resolveMLBProspectivePregameEvidenceArtifactPaths', () => {
    it('derives artifact path under store root', () => {
      const root = '/tmp/repo';
      const artifactId = 'a::b::c';
      const paths = resolveMLBProspectivePregameEvidenceArtifactPaths(root, artifactId);
      expect(paths.artifactPath).toBe(path.join(root, MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_DIRECTORY, `${deriveArtifactRelativePath(artifactId)}`));
      expect(paths.evidenceDirectory).toBe(path.join(root, MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_DIRECTORY));
    });

    it('rejects unsafe artifactId values', () => {
      expect(() => deriveArtifactRelativePath('')).toThrow(TypeError);
      expect(() => deriveArtifactRelativePath('  ')).toThrow(TypeError);
      expect(() => deriveArtifactRelativePath('foo\0bar')).toThrow(TypeError);
      expect(() => deriveArtifactRelativePath('/absolute')).toThrow(TypeError);
    });

    it('rejects unsafe artifactId in artifact path resolution', () => {
      expect(() => resolveMLBProspectivePregameEvidenceArtifactPaths('/tmp/repo', '../evil')).toThrow(TypeError);
      expect(() => resolveMLBProspectivePregameEvidenceArtifactPaths('/tmp/repo', '')).toThrow(TypeError);
    });

    it('resolves artifact paths under fixed store root', () => {
      const artifactId = computeArtifactId(buildValidPrepared());
      const paths = resolveMLBProspectivePregameEvidenceArtifactPaths('/tmp/repo', artifactId);
      expect(paths.artifactPath).toBe(path.join('/tmp/repo', MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_DIRECTORY, deriveArtifactRelativePath(artifactId)));
      expect(paths.evidenceDirectory).toBe(path.join('/tmp/repo', MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_DIRECTORY));
    });
  });

  describe('generateUniqueTempArtifactPath', () => {
    it('generates unique collision-safe temp paths', () => {
      const artifactPath = '/tmp/repo/var/mlb-development/abc.json';
      const a = generateUniqueTempArtifactPath(artifactPath);
      const b = generateUniqueTempArtifactPath(artifactPath);
      expect(a).not.toBe(b);
      expect(a.startsWith(`${artifactPath}.tmp-`)).toBe(true);
      expect(b.startsWith(`${artifactPath}.tmp-`)).toBe(true);
    });

    it('keeps temp path on same filesystem as final', () => {
      const artifactPath = '/tmp/repo/var/mlb-development/abc.json';
      const temp = generateUniqueTempArtifactPath(artifactPath);
      expect(path.dirname(temp)).toBe(path.dirname(artifactPath));
    });
  });

  describe('persistProspectivePregameEvidence', () => {
    it('writes valid evidence and returns receipt', async () => {
      const root = await createTempRoot();
      try {
        const prepared = buildValidPrepared();
        const clock = () => '2026-07-15T06:00:00Z';
        const result = await persistProspectivePregameEvidence(root, prepared, clock);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.receipt.storeVersion).toBe(MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION);
          expect(result.receipt.artifactContractVersion).toBe(MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION);
          expect(result.receipt.protocolId).toBe(MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID);
          expect(result.receipt.sha256).toMatch(/^[a-f0-9]{64}$/);
          expect(result.receipt.byteLength).toBeGreaterThan(0);
          expect(result.receipt.persistedAt).toBe('2026-07-15T06:00:00Z');
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('rejects duplicate writes with ARTIFACT_ALREADY_EXISTS', async () => {
      const root = await createTempRoot();
      try {
        const prepared = buildValidPrepared();
        const clock = () => '2026-07-15T06:00:00Z';
        const first = await persistProspectivePregameEvidence(root, prepared, clock);
        expect(first.ok).toBe(true);

        const second = await persistProspectivePregameEvidence(root, prepared, clock);
        expect(second.ok).toBe(false);
        if (!second.ok) {
          const failure = second.issues.find((i) => i.code === 'ARTIFACT_ALREADY_EXISTS');
          expect(failure).toBeDefined();
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('handles concurrent same-identity writes with exactly one success', async () => {
      const root = await createTempRoot();
      try {
        const prepared = buildValidPrepared();
        const clock = () => '2026-07-15T06:00:00Z';
        const [first, second] = await Promise.all([
          persistProspectivePregameEvidence(root, prepared, clock),
          persistProspectivePregameEvidence(root, prepared, clock),
        ]);
        const successes = [first, second].filter((r) => r.ok).length;
        const alreadyExists = [first, second].filter(
          (r) => !r.ok && r.issues.some((i) => i.code === 'ARTIFACT_ALREADY_EXISTS'),
        ).length;
        expect(successes).toBe(1);
        expect(alreadyExists).toBe(1);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('rejects tampered evidence with same artifactId without overwriting', async () => {
      const root = await createTempRoot();
      try {
        const prepared = buildValidPrepared();
        const clock = () => '2026-07-15T06:00:00Z';
        const first = await persistProspectivePregameEvidence(root, prepared, clock);
        expect(first.ok).toBe(true);
        if (!first.ok) return;

        const tampered = {
          ...prepared,
          rawFeatureVector: {
            ...prepared.rawFeatureVector,
            values: prepared.rawFeatureVector.values.map((v) =>
              v.featureId === 'awayWinRate' ? { ...v, value: v.value + 1 } : v,
            ),
          },
        };
        const second = await persistProspectivePregameEvidence(root, tampered, clock);
        expect(second.ok).toBe(false);

        const artifactId = computeArtifactId(prepared);
        const paths = resolveMLBProspectivePregameEvidenceArtifactPaths(root, artifactId);
        const readBuffer = await fs.readFile(paths.artifactPath);
        const readHash = crypto.createHash('sha256').update(readBuffer).digest('hex');
        expect(readHash).toBe(first.receipt!.sha256);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('verifies byte/hash truth after write', async () => {
      const root = await createTempRoot();
      try {
        const prepared = buildValidPrepared();
        const clock = () => '2026-07-15T06:00:00Z';
        const result = await persistProspectivePregameEvidence(root, prepared, clock);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const artifactId = computeArtifactId(prepared);
        const paths = resolveMLBProspectivePregameEvidenceArtifactPaths(root, artifactId);
        const readBuffer = await fs.readFile(paths.artifactPath);
        const readHash = crypto.createHash('sha256').update(readBuffer).digest('hex');
        const readLength = readBuffer.byteLength;
        expect(readHash).toBe(result.receipt.sha256);
        expect(readLength).toBe(result.receipt.byteLength);

        const serialized = canonicalSerialize(withPersistedAt(prepared, '2026-07-15T06:00:00Z'));
        expect(readBuffer.toString('utf-8')).toBe(serialized);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('rejects persistedAt before capturedAt', async () => {
      const root = await createTempRoot();
      try {
        const prepared = buildValidPrepared();
        const clock = () => '2026-07-15T04:59:59Z';
        const result = await persistProspectivePregameEvidence(root, prepared, clock);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.issues.some((i) => i.code === 'PERSISTENCE_BEFORE_CAPTURE')).toBe(true);
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('rejects persistedAt after scheduledStartAt', async () => {
      const root = await createTempRoot();
      try {
        const prepared = buildValidPrepared();
        const clock = () => '2026-07-15T12:00:00Z';
        const result = await persistProspectivePregameEvidence(root, prepared, clock);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.issues.some((i) => i.code === 'PERSISTENCE_AFTER_SCHEDULED_START')).toBe(true);
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('allows persistedAt after T-360 when evidence is still bounded', async () => {
      const root = await createTempRoot();
      try {
        const prepared = buildValidPrepared();
        const clock = () => '2026-07-15T06:00:01Z';
        const result = await persistProspectivePregameEvidence(root, prepared, clock);
        expect(result.ok).toBe(true);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('allows persistedAt equal to capturedAt', async () => {
      const root = await createTempRoot();
      try {
        const prepared = buildValidPrepared();
        const clock = () => FROZEN_DATA_CUTOFF;
        const result = await persistProspectivePregameEvidence(root, prepared, clock);
        expect(result.ok).toBe(true);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('does not mutate caller object on successful persistence', async () => {
      const root = await createTempRoot();
      try {
        const prepared = buildValidPrepared();
        const before = JSON.stringify(prepared);
        const clock = () => '2026-07-15T06:00:00Z';
        await persistProspectivePregameEvidence(root, prepared, clock);
        const after = JSON.stringify(prepared);
        expect(after).toBe(before);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('does not mutate caller object on failed persistence', async () => {
      const root = await createTempRoot();
      try {
        const prepared = buildValidPrepared();
        const before = JSON.stringify(prepared);
        const clock = () => '2026-07-15T04:59:59Z';
        await persistProspectivePregameEvidence(root, prepared, clock);
        const after = JSON.stringify(prepared);
        expect(after).toBe(before);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('succeeds despite stale unrelated temp file from prior crash', async () => {
      const root = await createTempRoot();
      try {
        const prepared = buildValidPrepared();
        const clock = () => '2026-07-15T06:00:00Z';
        const artifactId = computeArtifactId(prepared);
        const paths = resolveMLBProspectivePregameEvidenceArtifactPaths(root, artifactId);
        await fs.mkdir(paths.evidenceDirectory, { recursive: true });
        const stalePath = `${paths.artifactPath}.tmp-stale-crash-123`;
        await fs.writeFile(stalePath, 'stale');

        const result = await persistProspectivePregameEvidence(root, prepared, clock);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const staleExists = await fs.access(stalePath).then(() => true).catch(() => false);
        expect(staleExists).toBe(true);

        const files = await fs.readdir(paths.evidenceDirectory);
        const jsonFiles = files.filter((f) => f.endsWith('.json'));
        expect(jsonFiles).toHaveLength(1);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('write failure atomicity', () => {
    it('cleans temporary artifact on link failure', async () => {
      const root = await createTempRoot();
      try {
        const prepared = buildValidPrepared();
        const clock = () => '2026-07-15T06:00:00Z';
        const linkSpy = vi.spyOn(fs, 'link').mockRejectedValueOnce(new Error('link failed'));
        const result = await persistProspectivePregameEvidence(root, prepared, clock);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.issues.some((issue: MLBProspectivePregameEvidenceIssue) => issue.code === 'WRITE_FAILED')).toBe(true);
        }

        const artifactId = computeArtifactId(prepared);
        const paths = resolveMLBProspectivePregameEvidenceArtifactPaths(root, artifactId);
        const files = await fs.readdir(paths.evidenceDirectory);
        const tempFiles = files.filter((f) => f.startsWith(`${path.basename(paths.artifactPath)}.tmp`));
        expect(tempFiles).toHaveLength(0);

        linkSpy.mockRestore();
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('readProspectivePregameEvidence', () => {
    it('reads back persisted artifact', async () => {
      const root = await createTempRoot();
      try {
        const prepared = buildValidPrepared();
        const clock = () => '2026-07-15T06:00:00Z';
        const writeResult = await persistProspectivePregameEvidence(root, prepared, clock);
        expect(writeResult.ok).toBe(true);
        if (!writeResult.ok) return;

        const artifactId = computeArtifactId(prepared);
        const readResult = await readProspectivePregameEvidence(root, artifactId);
        expect(readResult.ok).toBe(true);
        if (readResult.ok) {
          expect(readResult.value).toEqual({ ...prepared, persistedAt: '2026-07-15T06:00:00Z' });
          expect(readResult.receipt.sha256).toBe(writeResult.receipt.sha256);
          expect(readResult.receipt.byteLength).toBe(writeResult.receipt.byteLength);
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('returns failure for missing artifact', async () => {
      const root = await createTempRoot();
      try {
        const result = await readProspectivePregameEvidence(root, 'missing::artifact::id');
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.issues.some((i) => i.code === 'ARTIFACT_VALIDATION_FAILED')).toBe(true);
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('failure atomicity', () => {
    it('does not leave partial artifact on invalid evidence', async () => {
      const root = await createTempRoot();
      try {
        const prepared = { ...buildValidPrepared(), gameId: 'game-2' };
        const clock = () => '2026-07-15T06:00:00Z';
        const result = await persistProspectivePregameEvidence(root, prepared, clock);
        expect(result.ok).toBe(false);

        const files = await fs.readdir(root, { recursive: true });
        const jsonFiles = files.filter((f) => String(f).endsWith('.json'));
        expect(jsonFiles).toHaveLength(0);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });

  describe('immutability after success', () => {
    it('does not expose update/replace/delete methods on store', async () => {
      const root = await createTempRoot();
      try {
        const prepared = buildValidPrepared();
        const clock = () => '2026-07-15T06:00:00Z';
        const result = await persistProspectivePregameEvidence(root, prepared, clock);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(persistProspectivePregameEvidence));
        const readMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(readProspectivePregameEvidence));
        const allMethods = new Set([...methods, ...readMethods]);
        expect(allMethods.has('update')).toBe(false);
        expect(allMethods.has('replace')).toBe(false);
        expect(allMethods.has('patch')).toBe(false);
        expect(allMethods.has('delete')).toBe(false);
        expect(allMethods.has('overwrite')).toBe(false);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });
});
