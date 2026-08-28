import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_DIRECTORY,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_FAILURE_CODES,
  validateMLBProspectivePregameEvidencePrepared,
  validateMLBProspectivePregameEvidence,
  computeArtifactId,
  canonicalSerialize,
  type MLBProspectivePregameEvidencePrepared,
  type MLBProspectivePregameEvidence,
  type MLBProspectivePregameEvidenceReceipt,
  type MLBProspectivePregameEvidenceIssue,
} from '@/prediction/mlb/mlb-prospective-pregame-evidence-artifact-contract';
import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
  MLB_PROSPECTIVE_HOLDOUT_SCI_CUTOFF_MINUTES,
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
const SCIENTIFIC_CUTOFF_PLUS_ONE_MS = new Date(new Date(SCIENTIFIC_CUTOFF).getTime() + 1).toISOString();

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

type DeepMutable<T> = {
  -readonly [K in keyof T]:
    T[K] extends readonly (infer U)[]
      ? DeepMutable<U>[]
      : T[K] extends object
        ? DeepMutable<T[K]>
        : T[K];
};

function mutableSnapshot(
  snapshot: MLBCanonicalPregameSnapshot,
): DeepMutable<MLBCanonicalPregameSnapshot> {
  return JSON.parse(JSON.stringify(snapshot)) as DeepMutable<MLBCanonicalPregameSnapshot>;
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

describe('mlb-prospective-pregame-evidence-artifact-contract', () => {
  describe('contract versions', () => {
    it('exports the artifact contract version', () => {
      expect(MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION).toBe('mlb-prospective-pregame-evidence-artifact-v1');
    });

    it('exports the store version', () => {
      expect(MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION).toBe('mlb-prospective-pregame-evidence-store-v1');
    });

    it('exports the store directory', () => {
      expect(MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_DIRECTORY).toBe('var/mlb-development/mlb-prospective-pregame-evidence');
    });

    it('exports all failure codes', () => {
      expect(MLB_PROSPECTIVE_PREGAME_EVIDENCE_FAILURE_CODES).toEqual([
        'INVALID_EVIDENCE_INPUT',
        'ARTIFACT_VALIDATION_FAILED',
        'INVALID_PERSISTENCE_TIMESTAMP',
        'PERSISTENCE_AFTER_SCHEDULED_START',
        'PERSISTENCE_BEFORE_CAPTURE',
        'PATH_DERIVATION_FAILED',
        'ARTIFACT_ALREADY_EXISTS',
        'WRITE_FAILED',
        'HASH_VERIFICATION_FAILED',
        'TEMPORARY_FILE_CLEANUP_FAILED',
      ]);
    });
  });

  describe('validateMLBProspectivePregameEvidencePrepared', () => {
    it('accepts a valid prepared evidence', () => {
      const prepared = buildValidPrepared();
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(prepared);
      }
    });

    it('rejects non-plain objects', () => {
      const result = validateMLBProspectivePregameEvidencePrepared(null);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues[0].code).toBe('INVALID_EVIDENCE_INPUT');
      }
    });

    it('rejects unknown enumerable keys', () => {
      const base = buildValidPrepared();
      const prepared = Object.assign({}, base, { unknownField: 1 });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const unknown = result.issues.find((i) => i.path === '$.unknownField');
        expect(unknown).toBeDefined();
        expect(unknown?.code).toBe('INVALID_EVIDENCE_INPUT');
      }
    });

    it('rejects unknown symbol keys', () => {
      const base = buildValidPrepared();
      const sym = Symbol('bad');
      const prepared = Object.assign({}, base);
      Object.defineProperty(prepared, sym, {
        value: 1,
        enumerable: true,
        writable: true,
        configurable: true,
      });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === `$[${String(sym)}]`);
        expect(bad).toBeDefined();
      }
    });

    it('rejects caller-supplied persistedAt', () => {
      const prepared = Object.assign({}, buildValidPrepared(), { persistedAt: '2026-07-15T06:00:00Z' });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.persistedAt');
        expect(bad).toBeDefined();
      }
    });

    it('rejects outcome fields', () => {
      const prepared = Object.assign({}, buildValidPrepared(), { homeScore: 1 });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.homeScore');
        expect(bad).toBeDefined();
      }
    });

    it('rejects odds/market fields', () => {
      const prepared = Object.assign({}, buildValidPrepared(), { sportsbookOdds: -110 });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.sportsbookOdds');
        expect(bad).toBeDefined();
      }
    });

    it('rejects empty activationId', () => {
      const prepared = buildValidPrepared({ activationId: '   ' });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.activationId');
        expect(bad).toBeDefined();
      }
    });

    it('rejects mismatched gameId', () => {
      const prepared = buildValidPrepared({ gameId: 'game-2' });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.gameId');
        expect(bad).toBeDefined();
      }
    });

    it('rejects mismatched snapshotId', () => {
      const prepared = buildValidPrepared({ snapshotId: 'snapshot-2' });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.snapshotId');
        expect(bad).toBeDefined();
      }
    });

    it('rejects mismatched officialDate', () => {
      const prepared = buildValidPrepared({ officialDate: '2026-07-16' });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.officialDate');
        expect(bad).toBeDefined();
      }
    });

    it('rejects mismatched scheduledStartAt', () => {
      const prepared = buildValidPrepared({ scheduledStartAt: '2026-07-15T13:00:00Z' });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.scheduledStartAt');
        expect(bad).toBeDefined();
      }
    });

    it('rejects mismatched actualDataCutoffAt', () => {
      const prepared = buildValidPrepared({ actualDataCutoffAt: '2026-07-15T06:00:00Z' });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.actualDataCutoffAt');
        expect(bad).toBeDefined();
      }
    });

    it('rejects wrong scientific cutoff', () => {
      const prepared = buildValidPrepared({ scientificCutoffAt: '2026-07-15T05:01:00Z' });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.scientificCutoffAt');
        expect(bad).toBeDefined();
      }
    });

    it('rejects actualDataCutoffAt after scientific cutoff', () => {
      const prepared = buildValidPrepared({ actualDataCutoffAt: '2026-07-15T06:00:01Z' });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.actualDataCutoffAt');
        expect(bad).toBeDefined();
      }
    });
  });

  describe('T-360 evidence revalidation', () => {
    it('rejects source fetchedAt after scientific cutoff', () => {
      const snapshot = mutableSnapshot(buildValidSnapshotObject());
      snapshot.sourceReferences[0].fetchedAt = '2026-07-15T06:00:01Z';
      const prepared = buildValidPrepared({ rawSnapshot: snapshot });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path === '$.rawSnapshot.sourceReferences[0].fetchedAt')).toBe(true);
      }
    });

    it('rejects source sourceUpdatedAt after scientific cutoff', () => {
      const snapshot = mutableSnapshot(buildValidSnapshotObject());
      snapshot.sourceReferences[0].sourceUpdatedAt = '2026-07-15T06:00:01Z';
      const prepared = buildValidPrepared({ rawSnapshot: snapshot });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path === '$.rawSnapshot.sourceReferences[0].sourceUpdatedAt')).toBe(true);
      }
    });

    it('rejects home pitcher announcedAt after scientific cutoff', () => {
      const snapshot = mutableSnapshot(buildValidSnapshotObject());
      snapshot.startingPitchers.home.announcedAt = '2026-07-15T06:00:01Z';
      const prepared = buildValidPrepared({ rawSnapshot: snapshot });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path === '$.rawSnapshot.startingPitchers.home.announcedAt')).toBe(true);
      }
    });

    it('rejects section asOfAt after scientific cutoff', () => {
      const snapshot = mutableSnapshot(buildValidSnapshotObject());
      snapshot.sections[0].asOfAt = '2026-07-15T06:00:01Z';
      const prepared = buildValidPrepared({ rawSnapshot: snapshot });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path === '$.rawSnapshot.sections[0].asOfAt')).toBe(true);
      }
    });

    it('rejects t360Validation status other than ACCEPTED', () => {
      const prepared = buildValidPrepared({
        t360Validation: { status: 'REJECTED', actualDataCutoffAtLteScientificCutoff: true, sourceTimestampsProvenLteScientificCutoff: true },
      });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path === '$.t360Validation.status')).toBe(true);
      }
    });

    it('rejects away pitcher announcedAt after scientific cutoff', () => {
      const snapshot = mutableSnapshot(buildValidSnapshotObject());
      snapshot.startingPitchers.away.announcedAt = '2026-07-15T06:00:01Z';
      const prepared = buildValidPrepared({ rawSnapshot: snapshot });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path === '$.rawSnapshot.startingPitchers.away.announcedAt')).toBe(true);
      }
    });

    it('rejects scientific cutoff wrong by 1 ms', () => {
      const prepared = buildValidPrepared({ scientificCutoffAt: SCIENTIFIC_CUTOFF_PLUS_ONE_MS });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.scientificCutoffAt');
        expect(bad).toBeDefined();
      }
    });
  });

  describe('raw feature vector recomputation', () => {
    it('rejects tampered non-starter numeric value', () => {
      const prepared = buildValidPrepared();
      const tampered = {
        ...prepared,
        rawFeatureVector: {
          ...prepared.rawFeatureVector,
          values: prepared.rawFeatureVector.values.map((v) =>
            v.featureId === 'awayWinRate' ? { ...v, value: v.value + 1 } : v,
          ),
        },
      };
      const result = validateMLBProspectivePregameEvidencePrepared(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path.startsWith('$.rawFeatureVector'))).toBe(true);
      }
    });

    it('rejects tampered wasMissing flag', () => {
      const prepared = buildValidPrepared();
      const tampered = {
        ...prepared,
        rawFeatureVector: {
          ...prepared.rawFeatureVector,
          values: prepared.rawFeatureVector.values.map((v) =>
            v.featureId === 'awayWinRate' ? { ...v, wasMissing: !v.wasMissing } : v,
          ),
        },
      };
      const result = validateMLBProspectivePregameEvidencePrepared(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path === '$.rawFeatureVector')).toBe(true);
      }
    });

    it('rejects reordered features', () => {
      const prepared = buildValidPrepared();
      const reversed = [...prepared.rawFeatureVector.values].reverse();
      const tampered = {
        ...prepared,
        rawFeatureVector: {
          ...prepared.rawFeatureVector,
          values: reversed,
        },
      };
      const result = validateMLBProspectivePregameEvidencePrepared(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path === '$.rawFeatureVector.values')).toBe(true);
      }
    });

    it('rejects changed featureId', () => {
      const prepared = buildValidPrepared();
      const tampered = {
        ...prepared,
        rawFeatureVector: {
          ...prepared.rawFeatureVector,
          values: prepared.rawFeatureVector.values.map((v) =>
            v.featureId === 'awayWinRate' ? { ...v, featureId: 'homeWinRate' } : v,
          ),
        },
      };
      const result = validateMLBProspectivePregameEvidencePrepared(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path === '$.rawFeatureVector.values')).toBe(true);
      }
    });

    it('rejects changed manifestId', () => {
      const prepared = buildValidPrepared();
      const tampered = {
        ...prepared,
        rawFeatureVector: {
          ...prepared.rawFeatureVector,
          manifestId: 'bad-manifest',
        },
      };
      const result = validateMLBProspectivePregameEvidencePrepared(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path === '$.rawFeatureVector')).toBe(true);
      }
    });

    it('rejects tampered home starter value in rawFeatureVector', () => {
      const prepared = buildValidPrepared();
      const tampered = {
        ...prepared,
        rawFeatureVector: {
          ...prepared.rawFeatureVector,
          values: prepared.rawFeatureVector.values.map((v) =>
            v.featureId === 'homeStarterAvailable' ? { ...v, value: v.value + 1 } : v,
          ),
        },
      };
      const result = validateMLBProspectivePregameEvidencePrepared(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path === '$.rawFeatureVector')).toBe(true);
      }
    });

    it('rejects tampered home starter wasMissing in rawFeatureVector', () => {
      const prepared = buildValidPrepared();
      const tampered = {
        ...prepared,
        rawFeatureVector: {
          ...prepared.rawFeatureVector,
          values: prepared.rawFeatureVector.values.map((v) =>
            v.featureId === 'homeStarterAvailable' ? { ...v, wasMissing: !v.wasMissing } : v,
          ),
        },
      };
      const result = validateMLBProspectivePregameEvidencePrepared(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path === '$.rawFeatureVector')).toBe(true);
      }
    });

    it('rejects changed snapshotId in rawFeatureVector', () => {
      const prepared = buildValidPrepared();
      const tampered = {
        ...prepared,
        rawFeatureVector: { ...prepared.rawFeatureVector, snapshotId: 'snapshot-2' },
      };
      const result = validateMLBProspectivePregameEvidencePrepared(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path === '$.rawFeatureVector')).toBe(true);
      }
    });

    it('rejects changed gameId in rawFeatureVector', () => {
      const prepared = buildValidPrepared();
      const tampered = {
        ...prepared,
        rawFeatureVector: { ...prepared.rawFeatureVector, gameId: 'game-2' },
      };
      const result = validateMLBProspectivePregameEvidencePrepared(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path === '$.rawFeatureVector')).toBe(true);
      }
    });

    it('rejects changed officialDate in rawFeatureVector', () => {
      const prepared = buildValidPrepared();
      const tampered = {
        ...prepared,
        rawFeatureVector: { ...prepared.rawFeatureVector, officialDate: '2026-07-16' },
      };
      const result = validateMLBProspectivePregameEvidencePrepared(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path === '$.rawFeatureVector')).toBe(true);
      }
    });

    it('rejects changed dataCutoffAt in rawFeatureVector', () => {
      const prepared = buildValidPrepared();
      const tampered = {
        ...prepared,
        rawFeatureVector: { ...prepared.rawFeatureVector, dataCutoffAt: '2026-07-15T06:00:01Z' },
      };
      const result = validateMLBProspectivePregameEvidencePrepared(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path === '$.rawFeatureVector')).toBe(true);
      }
    });
  });

  describe('candidate-003 vector recomputation', () => {
    it('rejects tampered home starter value', () => {
      const prepared = buildValidPrepared();
      const tampered = {
        ...prepared,
        candidate003CompatibleFeatureVector: {
          ...prepared.candidate003CompatibleFeatureVector,
          values: prepared.candidate003CompatibleFeatureVector.values.map((v) =>
            v.featureId === 'homeStarterAvailable' ? { ...v, value: 1 } : v,
          ),
        },
      };
      const result = validateMLBProspectivePregameEvidencePrepared(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path === '$.candidate003CompatibleFeatureVector')).toBe(true);
      }
    });

    it('rejects tampered home starter wasMissing', () => {
      const prepared = buildValidPrepared();
      const tampered = {
        ...prepared,
        candidate003CompatibleFeatureVector: {
          ...prepared.candidate003CompatibleFeatureVector,
          values: prepared.candidate003CompatibleFeatureVector.values.map((v) =>
            v.featureId === 'homeStarterAvailable' ? { ...v, wasMissing: false } : v,
          ),
        },
      };
      const result = validateMLBProspectivePregameEvidencePrepared(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path === '$.candidate003CompatibleFeatureVector')).toBe(true);
      }
    });

    it('rejects tampered away starter value', () => {
      const prepared = buildValidPrepared();
      const tampered = {
        ...prepared,
        candidate003CompatibleFeatureVector: {
          ...prepared.candidate003CompatibleFeatureVector,
          values: prepared.candidate003CompatibleFeatureVector.values.map((v) =>
            v.featureId === 'awayStarterAvailable' ? { ...v, value: 1 } : v,
          ),
        },
      };
      const result = validateMLBProspectivePregameEvidencePrepared(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path === '$.candidate003CompatibleFeatureVector')).toBe(true);
      }
    });

    it('rejects tampered away starter wasMissing', () => {
      const prepared = buildValidPrepared();
      const tampered = {
        ...prepared,
        candidate003CompatibleFeatureVector: {
          ...prepared.candidate003CompatibleFeatureVector,
          values: prepared.candidate003CompatibleFeatureVector.values.map((v) =>
            v.featureId === 'awayStarterAvailable' ? { ...v, wasMissing: false } : v,
          ),
        },
      };
      const result = validateMLBProspectivePregameEvidencePrepared(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path === '$.candidate003CompatibleFeatureVector')).toBe(true);
      }
    });

    it('rejects tampered non-starter numeric value', () => {
      const prepared = buildValidPrepared();
      const tampered = {
        ...prepared,
        candidate003CompatibleFeatureVector: {
          ...prepared.candidate003CompatibleFeatureVector,
          values: prepared.candidate003CompatibleFeatureVector.values.map((v) =>
            v.featureId === 'awayWinRate' ? { ...v, value: v.value + 1 } : v,
          ),
        },
      };
      const result = validateMLBProspectivePregameEvidencePrepared(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path === '$.candidate003CompatibleFeatureVector')).toBe(true);
      }
    });
  });

  describe('identity and path safety', () => {
    it('derives stable artifactId from immutable identities', () => {
      const prepared = buildValidPrepared();
      const artifactId = computeArtifactId(prepared);
      expect(artifactId).toBe(
        [MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID, prepared.activationId, prepared.gameId, prepared.snapshotId, prepared.scientificCutoffAt].join('::'),
      );
    });

    it('rejects protocol mismatch', () => {
      const prepared = buildValidPrepared({ protocolId: 'bad-protocol' });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.protocolId');
        expect(bad).toBeDefined();
      }
    });

    it('rejects capture contract mismatch', () => {
      const prepared = buildValidPrepared({ captureContractVersion: 'bad-capture' });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.captureContractVersion');
        expect(bad).toBeDefined();
      }
    });

    it('rejects compatibility layer mismatch', () => {
      const prepared = buildValidPrepared({ compatibilityLayerId: 'bad-compat' });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.compatibilityLayerId');
        expect(bad).toBeDefined();
      }
    });

    it('rejects unsafe activationId', () => {
      const prepared = buildValidPrepared({ activationId: '../evil' });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.activationId');
        expect(bad).toBeDefined();
      }
    });

    it('rejects activationId with forward slash', () => {
      const prepared = buildValidPrepared({ activationId: 'foo/bar' });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.activationId');
        expect(bad).toBeDefined();
      }
    });

    it('rejects activationId with backslash', () => {
      const prepared = buildValidPrepared({ activationId: 'foo\\bar' });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.activationId');
        expect(bad).toBeDefined();
      }
    });

    it('rejects activationId containing NUL', () => {
      const prepared = buildValidPrepared({ activationId: '\0evil' });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.activationId');
        expect(bad).toBeDefined();
      }
    });

    it('rejects unsafe gameId', () => {
      const prepared = buildValidPrepared({ gameId: '../evil' });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.gameId');
        expect(bad).toBeDefined();
      }
    });

    it('rejects unsafe snapshotId', () => {
      const prepared = buildValidPrepared({ snapshotId: '../evil' });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.snapshotId');
        expect(bad).toBeDefined();
      }
    });

    it('rejects non-enumerable own key', () => {
      const base = buildValidPrepared();
      const prepared = Object.assign({}, base);
      Object.defineProperty(prepared, 'hiddenField', {
        value: 1,
        enumerable: false,
        writable: true,
        configurable: true,
      });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.hiddenField');
        expect(bad).toBeDefined();
      }
    });

    it('rejects accessor property', () => {
      const base = buildValidPrepared();
      const prepared = Object.assign({}, base);
      Object.defineProperty(prepared, 'accessorField', {
        get() { return 1; },
        enumerable: true,
        configurable: true,
      });
      const result = validateMLBProspectivePregameEvidencePrepared(prepared);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.accessorField');
        expect(bad).toBeDefined();
      }
    });
  });

  describe('canonical serialization', () => {
    it('produces deterministic bytes for the same persisted artifact', () => {
      const prepared = buildValidPrepared();
      const evidence = withPersistedAt(prepared, '2026-07-15T06:00:00Z');
      const a = canonicalSerialize(evidence);
      const b = canonicalSerialize(evidence);
      expect(a).toBe(b);
    });

    it('is stable under key reordering in input object', () => {
      const prepared = buildValidPrepared();
      const evidence = withPersistedAt(prepared, '2026-07-15T06:00:00Z');
      const reordered = Object.fromEntries(Object.entries(evidence).reverse());
      const a = canonicalSerialize(evidence);
      const b = canonicalSerialize(reordered as MLBProspectivePregameEvidence);
      expect(a).toBe(b);
    });

    it('parses to equivalent object', () => {
      const prepared = buildValidPrepared();
      const evidence = withPersistedAt(prepared, '2026-07-15T06:00:00Z');
      const serialized = canonicalSerialize(evidence);
      const parsed = JSON.parse(serialized) as MLBProspectivePregameEvidence;
      expect(parsed).toEqual(evidence);
    });

    it('rejects arbitrary unknown input', () => {
      const result = validateMLBProspectivePregameEvidence(null);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues[0].code).toBe('INVALID_EVIDENCE_INPUT');
      }
    });
  });

  describe('validateMLBProspectivePregameEvidence', () => {
    it('accepts a valid persisted artifact', () => {
      const prepared = buildValidPrepared();
      const evidence = withPersistedAt(prepared, '2026-07-15T06:00:00Z');
      const result = validateMLBProspectivePregameEvidence(evidence);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(evidence);
      }
    });

    it('rejects non-plain objects', () => {
      const result = validateMLBProspectivePregameEvidence(null);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues[0].code).toBe('INVALID_EVIDENCE_INPUT');
      }
    });

    it('rejects unknown persisted fields', () => {
      const prepared = buildValidPrepared();
      const evidence = Object.assign({}, withPersistedAt(prepared, '2026-07-15T06:00:00Z'), { unknownField: 1 });
      const result = validateMLBProspectivePregameEvidence(evidence);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.unknownField');
        expect(bad).toBeDefined();
      }
    });

    it('rejects symbol properties', () => {
      const prepared = buildValidPrepared();
      const evidence = withPersistedAt(prepared, '2026-07-15T06:00:00Z');
      const sym = Symbol('bad');
      Object.defineProperty(evidence, sym, { value: 1, enumerable: true, writable: true, configurable: true });
      const result = validateMLBProspectivePregameEvidence(evidence);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === `$[${String(sym)}]`);
        expect(bad).toBeDefined();
      }
    });

    it('rejects missing persistedAt', () => {
      const prepared = buildValidPrepared();
      const evidence = { ...prepared } as Record<string, unknown>;
      const result = validateMLBProspectivePregameEvidence(evidence);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.persistedAt');
        expect(bad).toBeDefined();
      }
    });

    it('rejects invalid persistedAt timestamp', () => {
      const prepared = buildValidPrepared();
      const evidence = withPersistedAt(prepared, 'not-a-timestamp');
      const result = validateMLBProspectivePregameEvidence(evidence);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const bad = result.issues.find((i) => i.path === '$.persistedAt');
        expect(bad).toBeDefined();
      }
    });

    it('rejects persistedAt before capturedAt', () => {
      const prepared = buildValidPrepared();
      const evidence = withPersistedAt(prepared, '2026-07-15T04:59:59Z');
      const result = validateMLBProspectivePregameEvidence(evidence);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.code === 'PERSISTENCE_BEFORE_CAPTURE')).toBe(true);
      }
    });

    it('rejects persistedAt after scheduledStartAt', () => {
      const prepared = buildValidPrepared();
      const evidence = withPersistedAt(prepared, '2026-07-15T12:00:00Z');
      const result = validateMLBProspectivePregameEvidence(evidence);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.code === 'PERSISTENCE_AFTER_SCHEDULED_START')).toBe(true);
      }
    });

    it('allows persistedAt equal to capturedAt', () => {
      const prepared = buildValidPrepared();
      const evidence = withPersistedAt(prepared, FROZEN_DATA_CUTOFF);
      const result = validateMLBProspectivePregameEvidence(evidence);
      expect(result.ok).toBe(true);
    });

    it('allows persistedAt after T-360 when evidence is still bounded', () => {
      const prepared = buildValidPrepared();
      const evidence = withPersistedAt(prepared, '2026-07-15T06:00:01Z');
      const result = validateMLBProspectivePregameEvidence(evidence);
      expect(result.ok).toBe(true);
    });

    it('rejects store metadata fields', () => {
      const prepared = buildValidPrepared();
      const evidence = Object.assign({}, withPersistedAt(prepared, '2026-07-15T06:00:00Z'), {
        sha256: 'abc',
        byteLength: 123,
        relativePath: 'foo.json',
      });
      const result = validateMLBProspectivePregameEvidence(evidence);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.code === 'INVALID_EVIDENCE_INPUT' && i.path === '$.sha256')).toBe(true);
        expect(result.issues.some((i) => i.code === 'INVALID_EVIDENCE_INPUT' && i.path === '$.byteLength')).toBe(true);
        expect(result.issues.some((i) => i.code === 'INVALID_EVIDENCE_INPUT' && i.path === '$.relativePath')).toBe(true);
      }
    });

    it('propagates prepared validation failures', () => {
      const prepared = buildValidPrepared({ gameId: 'game-2' });
      const evidence = withPersistedAt(prepared, '2026-07-15T06:00:00Z');
      const result = validateMLBProspectivePregameEvidence(evidence);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.code === 'ARTIFACT_VALIDATION_FAILED' && i.path === '$.gameId')).toBe(true);
      }
    });
  });

  describe('no outcome contamination', () => {
    it('does not contain outcome fields', () => {
      const prepared = buildValidPrepared();
      const evidence = withPersistedAt(prepared, '2026-07-15T06:00:00Z');
      const serialized = canonicalSerialize(evidence);
      const parsed = JSON.parse(serialized) as Record<string, unknown>;
      expect(parsed).not.toHaveProperty('homeScore');
      expect(parsed).not.toHaveProperty('awayScore');
      expect(parsed).not.toHaveProperty('winner');
      expect(parsed).not.toHaveProperty('homeWon');
      expect(parsed).not.toHaveProperty('label');
      expect(parsed).not.toHaveProperty('targetValue');
      expect(parsed).not.toHaveProperty('result');
      expect(parsed).not.toHaveProperty('finalStatus');
      expect(parsed).not.toHaveProperty('postgame');
      expect(parsed).not.toHaveProperty('gateResult');
      expect(parsed).not.toHaveProperty('prediction');
      expect(parsed).not.toHaveProperty('probability');
      expect(parsed).not.toHaveProperty('sportsbookOdds');
      expect(parsed).not.toHaveProperty('marketPrice');
    });
  });

  describe('non-mutation', () => {
    it('does not mutate caller object on validation failure', () => {
      const prepared = buildValidPrepared();
      const before = JSON.stringify(prepared);
      validateMLBProspectivePregameEvidencePrepared({ ...prepared, gameId: 'game-2' });
      const after = JSON.stringify(prepared);
      expect(after).toBe(before);
    });

    it('does not mutate caller object on validation success', () => {
      const prepared = buildValidPrepared();
      const before = JSON.stringify(prepared);
      validateMLBProspectivePregameEvidencePrepared(prepared);
      const after = JSON.stringify(prepared);
      expect(after).toBe(before);
    });
  });
});
