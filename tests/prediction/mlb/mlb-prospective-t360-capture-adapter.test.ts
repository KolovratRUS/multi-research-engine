import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import {
  buildProspectiveT360CaptureAdapter,
  type MLBProspectiveT360CaptureAdapterInput,
} from '@/prediction/mlb/mlb-prospective-t360-capture-adapter';
import {
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
  validateMLBCanonicalPregameSnapshot,
  type MLBCanonicalPregameSnapshot,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';
import {
  MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
  MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
} from '@/prediction/mlb/mlb-prospective-t360-capture-contract';
import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
  MLB_PROSPECTIVE_HOLDOUT_SCI_CUTOFF_MINUTES,
} from '@/prediction/mlb/mlb-prospective-holdout-protocol-contract';

const FROZEN_SOURCE_TS = '2026-07-15T05:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T05:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';
const SCIENTIFIC_CUTOFF = new Date(
  new Date(FROZEN_SCHEDULED_START).getTime() - MLB_PROSPECTIVE_HOLDOUT_SCI_CUTOFF_MINUTES * 60 * 1000,
).toISOString();

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
  return {
    contractVersion: MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
    sport: 'MLB' as const,
    target: 'OFFICIAL_FINAL_GAME_WINNER' as const,
    snapshotId: 'snapshot-1',
    capturedAt: FROZEN_SOURCE_TS,
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
    sections: [buildSection()],
    dataCompleteness: 'COMPLETE' as const,
    warnings: [buildWarning()],
    ...overrides,
  };
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

function buildAdapterInput(overrides: Record<string, unknown> = {}): MLBProspectiveT360CaptureAdapterInput {
  return {
    gameId: 'game-1',
    scheduledStartAt: FROZEN_SCHEDULED_START,
    builder: () => buildValidSnapshotObject(),
    clock: () => '2026-07-15T05:59:59Z',
    ...overrides,
  };
}

describe('mlb-prospective-t360-capture-adapter', () => {
  describe('pre-build cutoff guard', () => {
    it('allows builder to run when clock is before cutoff', () => {
      const builder = vi.fn(() => buildValidSnapshotObject({ capturedAt: FROZEN_DATA_CUTOFF, dataCutoffAt: FROZEN_DATA_CUTOFF }));
      const input = buildAdapterInput({
        builder,
      });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(builder).toHaveBeenCalledTimes(1);
      }
    });

    it('allows builder to run when clock is exactly at cutoff', () => {
      const builder = vi.fn(() => buildValidSnapshotObject({ capturedAt: SCIENTIFIC_CUTOFF, dataCutoffAt: SCIENTIFIC_CUTOFF }));
      const input = buildAdapterInput({
        clock: () => SCIENTIFIC_CUTOFF,
        builder,
      });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(builder).toHaveBeenCalledTimes(1);
      }
    });

    it('rejects builder when clock is after cutoff', () => {
      let builderCalled = false;
      const builder = () => {
        builderCalled = true;
        return buildValidSnapshotObject();
      };
      const input = buildAdapterInput({
        clock: () => '2026-07-15T06:00:01Z',
        builder,
      });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failureCode).toBe('CAPTURE_STARTED_AFTER_SCIENTIFIC_CUTOFF');
      }
      expect(builderCalled).toBe(false);
    });

    it('returns structured failure with exact metadata on post-cutoff attempt', () => {
      const input = buildAdapterInput({
        clock: () => '2026-07-15T06:00:01Z',
      });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.contractVersion).toBe(MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION);
        expect(result.compatibilityLayerId).toBe(MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1);
        expect(result.protocolId).toBe(MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID);
        expect(result.failureCode).toBe('CAPTURE_STARTED_AFTER_SCIENTIFIC_CUTOFF');
      }
    });
  });

  describe('builder failure handling', () => {
    it('fails closed when builder throws', () => {
      const builder = () => {
        throw new Error('builder boom');
      };
      const input = buildAdapterInput({ builder });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failureCode).toBe('CAPTURE_BUILDER_FAILED');
      }
    });

    it('fails closed when builder returns a malformed snapshot', () => {
      const malformed = buildValidSnapshotObject() as Record<string, unknown>;
      delete malformed.game;
      const builder = () => malformed as MLBCanonicalPregameSnapshot;
      const input = buildAdapterInput({ builder });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failureCode).toBe('INVALID_PREGAME_SNAPSHOT');
      }
    });
  });

  describe('returned snapshot validation', () => {
    it('accepts when actualDataCutoffAt < scientific cutoff', () => {
      const snapshot = buildValidSnapshotObject({ capturedAt: FROZEN_DATA_CUTOFF, dataCutoffAt: FROZEN_DATA_CUTOFF });
      const builder = () => snapshot;
      const input = buildAdapterInput({ builder });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.actualDataCutoffAt).toBe(FROZEN_DATA_CUTOFF);
      }
    });

    it('accepts when actualDataCutoffAt == scientific cutoff', () => {
      const snapshot = buildValidSnapshotObject({ capturedAt: SCIENTIFIC_CUTOFF, dataCutoffAt: SCIENTIFIC_CUTOFF });
      const builder = () => snapshot;
      const input = buildAdapterInput({ builder });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.actualDataCutoffAt).toBe(SCIENTIFIC_CUTOFF);
      }
    });

    it('rejects when actualDataCutoffAt > scientific cutoff', () => {
      const later = '2026-07-15T07:00:00Z';
      const snapshot = buildValidSnapshotObject({ capturedAt: later, dataCutoffAt: later });
      const builder = () => snapshot;
      const input = buildAdapterInput({ builder });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failureCode).toBe('ACTUAL_DATA_CUTOFF_AFTER_SCIENTIFIC_CUTOFF');
      }
    });

    it('does not rewrite actualDataCutoffAt to T-360 on rejection', () => {
      const later = '2026-07-15T07:00:00Z';
      const snapshot = buildValidSnapshotObject({ capturedAt: later, dataCutoffAt: later });
      const builder = () => snapshot;
      const input = buildAdapterInput({ builder });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(false);
      expect(snapshot.dataCutoffAt).toBe(later);
    });
  });

  describe('source timestamp enforcement', () => {
    it('rejects source fetchedAt after scientific cutoff', () => {
      const snapshot = buildValidSnapshotObject({
        capturedAt: SCIENTIFIC_CUTOFF,
        dataCutoffAt: SCIENTIFIC_CUTOFF,
        sourceReferences: [
          buildSourceReference({ fetchedAt: '2026-07-15T07:00:00Z', sourceRefId: 'src-away', roles: ['STARTING_PITCHER'] }),
          buildSourceReference(),
        ],
      });
      const builder = () => snapshot;
      const input = buildAdapterInput({ builder });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failureCode).toBe('MODEL_SOURCE_TIMESTAMP_AFTER_SCIENTIFIC_CUTOFF');
      }
    });

    it('rejects source sourceUpdatedAt after scientific cutoff', () => {
      const snapshot = buildValidSnapshotObject({
        capturedAt: SCIENTIFIC_CUTOFF,
        dataCutoffAt: SCIENTIFIC_CUTOFF,
        sourceReferences: [
          buildSourceReference({ sourceUpdatedAt: '2026-07-15T07:00:00Z', sourceRefId: 'src-away', roles: ['STARTING_PITCHER'] }),
          buildSourceReference(),
        ],
      });
      const builder = () => snapshot;
      const input = buildAdapterInput({ builder });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failureCode).toBe('MODEL_SOURCE_TIMESTAMP_AFTER_SCIENTIFIC_CUTOFF');
      }
    });

    it('allows starting pitcher announcedAt exactly at scientific cutoff', () => {
      const snapshot = buildValidSnapshotObject({
        capturedAt: SCIENTIFIC_CUTOFF,
        dataCutoffAt: SCIENTIFIC_CUTOFF,
        startingPitchers: {
          home: buildStartingPitcher({ announcedAt: SCIENTIFIC_CUTOFF }),
          away: buildStartingPitcher({ announcedAt: SCIENTIFIC_CUTOFF }),
        },
      });
      const builder = () => snapshot;
      const input = buildAdapterInput({ builder });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(true);
    });

    it('allows section asOfAt exactly at scientific cutoff', () => {
      const snapshot = buildValidSnapshotObject({
        capturedAt: SCIENTIFIC_CUTOFF,
        dataCutoffAt: SCIENTIFIC_CUTOFF,
        sections: [buildSection({ asOfAt: SCIENTIFIC_CUTOFF })],
      });
      const builder = () => snapshot;
      const input = buildAdapterInput({ builder });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(true);
    });

    it('allows source timestamps exactly at cutoff', () => {
      const snapshot = buildValidSnapshotObject({
        capturedAt: SCIENTIFIC_CUTOFF,
        dataCutoffAt: SCIENTIFIC_CUTOFF,
        sourceReferences: [
          buildSourceReference({ fetchedAt: SCIENTIFIC_CUTOFF, sourceUpdatedAt: SCIENTIFIC_CUTOFF, sourceRefId: 'src-away', roles: ['STARTING_PITCHER'] }),
          buildSourceReference(),
        ],
        startingPitchers: {
          home: buildStartingPitcher({ announcedAt: SCIENTIFIC_CUTOFF }),
          away: buildStartingPitcher({ announcedAt: SCIENTIFIC_CUTOFF }),
        },
        sections: [buildSection({ asOfAt: SCIENTIFIC_CUTOFF })],
      });
      const builder = () => snapshot;
      const input = buildAdapterInput({ builder });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(true);
    });

    it('accepts fetchedAt before scientific cutoff', () => {
      const snapshot = buildValidSnapshotObject({
        capturedAt: FROZEN_DATA_CUTOFF,
        dataCutoffAt: FROZEN_DATA_CUTOFF,
        sourceReferences: [
          buildSourceReference({ fetchedAt: FROZEN_SOURCE_TS, sourceRefId: 'src-away', roles: ['STARTING_PITCHER'] }),
          buildSourceReference(),
        ],
      });
      const builder = () => snapshot;
      const input = buildAdapterInput({ builder });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(true);
    });

    it('accepts sourceUpdatedAt before scientific cutoff', () => {
      const snapshot = buildValidSnapshotObject({
        capturedAt: FROZEN_DATA_CUTOFF,
        dataCutoffAt: FROZEN_DATA_CUTOFF,
        sourceReferences: [
          buildSourceReference({ sourceUpdatedAt: FROZEN_SOURCE_TS, sourceRefId: 'src-away', roles: ['STARTING_PITCHER'] }),
          buildSourceReference(),
        ],
      });
      const builder = () => snapshot;
      const input = buildAdapterInput({ builder });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(true);
    });

    it('accepts sourceUpdatedAt exactly at scientific cutoff', () => {
      const snapshot = buildValidSnapshotObject({
        capturedAt: SCIENTIFIC_CUTOFF,
        dataCutoffAt: SCIENTIFIC_CUTOFF,
        sourceReferences: [
          buildSourceReference({ sourceUpdatedAt: SCIENTIFIC_CUTOFF, sourceRefId: 'src-away', roles: ['STARTING_PITCHER'] }),
          buildSourceReference({ sourceUpdatedAt: SCIENTIFIC_CUTOFF }),
        ],
      });
      const builder = () => snapshot;
      const input = buildAdapterInput({ builder });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(true);
    });

    it('accepts null sourceUpdatedAt', () => {
      const snapshot = buildValidSnapshotObject({
        capturedAt: FROZEN_DATA_CUTOFF,
        dataCutoffAt: FROZEN_DATA_CUTOFF,
        sourceReferences: [
          buildSourceReference({ sourceUpdatedAt: null, sourceRefId: 'src-away', roles: ['STARTING_PITCHER'] }),
          buildSourceReference({ sourceUpdatedAt: null }),
        ],
      });
      const builder = () => snapshot;
      const input = buildAdapterInput({ builder });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(true);
    });

    it('accepts capturedAt after scientific cutoff when source timestamps are valid', () => {
      const snapshot = buildValidSnapshotObject({
        capturedAt: '2026-07-15T06:00:01Z',
        dataCutoffAt: FROZEN_DATA_CUTOFF,
        sourceReferences: [
          buildSourceReference({ sourceRefId: 'src-away', roles: ['STARTING_PITCHER'] }),
          buildSourceReference(),
        ],
      });
      const builder = () => snapshot;
      const input = buildAdapterInput({ builder });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(true);
    });
  });

  describe('raw snapshot immutability', () => {
    it('does not mutate raw snapshot on success', () => {
      const raw = buildValidSnapshot();
      const original = JSON.parse(JSON.stringify(raw));
      const builder = () => {
        const validation = validateMLBCanonicalPregameSnapshot(raw);
        expect(validation.ok).toBe(true);
        if (validation.ok) {
          return validation.value;
        }
        throw new Error('invalid');
      };
      const input = buildAdapterInput({ builder });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(true);
      expect(raw).toEqual(original);
    });

    it('does not mutate raw snapshot on failure', () => {
      const raw = buildValidSnapshot();
      const original = JSON.parse(JSON.stringify(raw));
      const builder = () => buildValidSnapshotObject({ capturedAt: '2026-07-15T07:00:00Z', dataCutoffAt: '2026-07-15T07:00:00Z' });
      const input = buildAdapterInput({ builder });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(false);
      expect(raw).toEqual(original);
    });
  });

  describe('game identity', () => {
    it('rejects mismatched gameId', () => {
      const baseGame = buildValidSnapshot().game as Record<string, unknown>;
      const snapshot = buildValidSnapshotObject({ game: { ...baseGame, gameId: 'game-2' } });
      const builder = () => snapshot;
      const input = buildAdapterInput({ gameId: 'game-1', builder });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failureCode).toBe('GAME_IDENTITY_MISMATCH');
      }
    });

    it('rejects mismatched scheduledStartAt', () => {
      const baseGame = buildValidSnapshot().game as Record<string, unknown>;
      const snapshot = buildValidSnapshotObject({ game: { ...baseGame, scheduledStartAt: '2026-07-15T18:00:00Z' } });
      const builder = () => snapshot;
      const input = buildAdapterInput({ scheduledStartAt: FROZEN_SCHEDULED_START, builder });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failureCode).toBe('GAME_IDENTITY_MISMATCH');
      }
    });
  });

  describe('success result shape', () => {
    it('returns strongly typed evidence with all required fields', () => {
      const builder = () => buildValidSnapshotObject({ capturedAt: FROZEN_DATA_CUTOFF, dataCutoffAt: FROZEN_DATA_CUTOFF });
      const input = buildAdapterInput({ builder });
      const result = buildProspectiveT360CaptureAdapter(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.contractVersion).toBe(MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION);
        expect(result.compatibilityLayerId).toBe(MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1);
        expect(result.protocolId).toBe(MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID);
        expect(result.gameId).toBe('game-1');
        expect(result.scheduledStartAt).toBe(FROZEN_SCHEDULED_START);
        expect(result.t360Validation.status).toBe('ACCEPTED');
        expect(result.t360Validation.actualDataCutoffAtLteScientificCutoff).toBe(true);
        expect(result.t360Validation.sourceTimestampsProvenLteScientificCutoff).toBe(true);
      }
    });
  });
});
